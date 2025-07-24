/**
 * Enhanced Error Handling Integration
 * Integrates the ErrorResponseHandler with existing route error handling
 * while maintaining backward compatibility and adding new features.
 * 
 * Features:
 * - Request ID generation and tracking
 * - Performance monitoring integration
 * - Timeout handling for long-running operations
 * - Memory usage monitoring
 * - Integration with existing error patterns
 */

const ErrorResponseHandler = require('./errorResponseHandler');

// Create global error handler instance
const errorResponseHandler = new ErrorResponseHandler({
  includeStackTrace: process.env.NODE_ENV === 'development',
  includeRequestId: true,
  includeRecoverySuggestions: true,
  enableErrorLogging: true,
  enablePerformanceTracking: true,
  slowRequestThreshold: 5000
});

/**
 * Request ID middleware - adds unique ID to each request
 */
function requestIdMiddleware(req, res, next) {
  req.requestId = errorResponseHandler.generateRequestId();
  res.setHeader('X-Request-ID', req.requestId);
  next();
}

/**
 * Performance monitoring middleware
 */
function performanceMonitoringMiddleware(req, res, next) {
  req.startTime = Date.now();
  
  // Monitor memory usage for large requests
  if (req.file || (req.body && JSON.stringify(req.body).length > 10000)) {
    req.requiresMemoryMonitoring = true;
    req.memoryStart = process.memoryUsage();
  }
  
  next();
}

/**
 * Timeout middleware for long-running operations
 */
function timeoutMiddleware(timeoutMs = 30000) {
  return (req, res, next) => {
    req.setTimeout(timeoutMs, () => {
      const error = new Error(`Request timeout after ${timeoutMs}ms`);
      error.code = 'TIMEOUT';
      error.status = 408;
      next(error);
    });
    next();
  };
}

/**
 * Enhanced async error wrapper that integrates with ErrorResponseHandler
 */
function asyncErrorHandler(fn) {
  return (req, res, next) => {
    const startTime = req.startTime || Date.now();
    
    Promise.resolve(fn(req, res, next))
      .then(result => {
        // Check for performance issues
        const processingTime = Date.now() - startTime;
        if (processingTime > 5000) { // 5 seconds threshold
          console.warn(`Slow request detected: ${req.method} ${req.path} took ${processingTime}ms`);
        }
        
        // Check memory usage if monitoring was enabled
        if (req.requiresMemoryMonitoring && req.memoryStart) {
          const memoryEnd = process.memoryUsage();
          const memoryDiff = memoryEnd.heapUsed - req.memoryStart.heapUsed;
          
          if (memoryDiff > 50 * 1024 * 1024) { // 50MB increase
            console.warn(`High memory usage detected: ${req.method} ${req.path} used ${Math.round(memoryDiff / 1024 / 1024)}MB`);
          }
        }
        
        return result;
      })
      .catch(error => {
        // Enhance error with request context
        error.requestContext = {
          method: req.method,
          path: req.path,
          requestId: req.requestId,
          processingTime: Date.now() - startTime,
          hasFile: !!req.file,
          bodySize: req.body ? JSON.stringify(req.body).length : 0
        };
        
        next(error);
      });
  };
}

/**
 * Enhanced error response for Strava API errors
 */
function enhanceStravaError(error, req) {
  // Add Strava-specific context
  if (error.message?.includes('Strava') || error.status === 429) {
    error.category = 'external_api';
    error.service = 'strava';
    
    // Add rate limit specific information
    if (error.status === 429) {
      error.retryAfter = 900; // 15 minutes
      error.rateLimitType = 'strava_api';
    }
  }
  
  return error;
}

/**
 * Enhanced error response for file processing errors
 */
function enhanceFileProcessingError(error, req) {
  if (req.file) {
    error.fileContext = {
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      fieldName: req.file.fieldname
    };
    
    // Categorize file errors
    if (error.message?.includes('too large') || error.code === 'LIMIT_FILE_SIZE') {
      error.category = 'file_processing';
      error.fileError = 'size_exceeded';
      error.maxSize = '10MB';
    } else if (error.message?.includes('format') || error.message?.includes('parsing')) {
      error.category = 'file_processing';
      error.fileError = 'format_invalid';
      error.supportedFormats = ['GPX', 'TCX'];
    }
  }
  
  return error;
}

/**
 * Validation error enhancer
 */
function enhanceValidationError(error, req) {
  if (error.name === 'ValidationError' || error.message?.includes('validation')) {
    error.category = 'validation';
    
    // Extract validation details if available
    if (error.details && Array.isArray(error.details)) {
      error.validationErrors = error.details.map(detail => ({
        field: detail.path ? detail.path.join('.') : 'unknown',
        message: detail.message,
        value: detail.context?.value
      }));
    }
  }
  
  return error;
}

/**
 * Performance error enhancer
 */
function enhancePerformanceError(error, req) {
  const processingTime = Date.now() - (req.startTime || Date.now());
  
  if (processingTime > 10000 || error.code === 'TIMEOUT' || error.message?.includes('timeout')) {
    error.category = 'performance';
    error.performanceContext = {
      processingTime: processingTime,
      memoryUsage: process.memoryUsage(),
      hasLargePayload: (req.file && req.file.size > 5 * 1024 * 1024) || 
                      (req.body && JSON.stringify(req.body).length > 50000)
    };
  }
  
  return error;
}

/**
 * Main error enhancement middleware
 */
function errorEnhancementMiddleware(error, req, res, next) {
  // Start with the original error
  let enhancedError = error;
  
  // Apply various enhancements based on error type and request context
  enhancedError = enhanceStravaError(enhancedError, req);
  enhancedError = enhanceFileProcessingError(enhancedError, req);
  enhancedError = enhanceValidationError(enhancedError, req);
  enhancedError = enhancePerformanceError(enhancedError, req);
  
  // Pass to the main error response handler
  errorResponseHandler.handleError(enhancedError, req, res, next);
}

/**
 * Legacy error handler wrapper for backward compatibility
 * Converts old error response format to new enhanced format
 */
function legacyErrorWrapper(legacyHandler) {
  return (error, req, res, next) => {
    try {
      // Try legacy handler first
      const legacyResponse = legacyHandler(error);
      
      // If legacy handler returns a response, enhance it
      if (legacyResponse && typeof legacyResponse === 'object') {
        const enhancedResponse = {
          success: false,
          error: {
            ...legacyResponse,
            requestId: req.requestId,
            timestamp: new Date().toISOString(),
            category: legacyResponse.category || 'system',
            severity: legacyResponse.severity || 'medium'
          }
        };
        
        return res.status(legacyResponse.status || 500).json(enhancedResponse);
      }
    } catch (legacyError) {
      console.warn('Legacy error handler failed, falling back to enhanced handler:', legacyError);
    }
    
    // Fall back to enhanced error handler
    next(error);
  };
}

/**
 * Create enhanced route wrapper that includes all error handling features
 */
function createEnhancedRoute(routeHandler, options = {}) {
  const {
    timeout = 30000,
    enablePerformanceMonitoring = true,
    enableMemoryMonitoring = false
  } = options;
  
  const middlewares = [
    requestIdMiddleware,
    enablePerformanceMonitoring ? performanceMonitoringMiddleware : (req, res, next) => next(),
    timeout ? timeoutMiddleware(timeout) : (req, res, next) => next(),
    asyncErrorHandler(routeHandler)
  ];
  
  return middlewares;
}

/**
 * Express app integration helper
 */
function integreateEnhancedErrorHandling(app) {
  // Add request ID to all requests
  app.use(requestIdMiddleware);
  
  // Add performance monitoring
  app.use(performanceMonitoringMiddleware);
  
  // Add error enhancement middleware (should be after all routes)
  app.use(errorEnhancementMiddleware);
  
  console.log('Enhanced error handling integrated with Express app');
}

/**
 * Get error statistics from the handler
 */
function getErrorStats() {
  return errorResponseHandler.getErrorStats();
}

/**
 * Clear error statistics
 */
function clearErrorStats(olderThanHours = 24) {
  return errorResponseHandler.clearErrorStats(olderThanHours);
}

module.exports = {
  // Middleware functions
  requestIdMiddleware,
  performanceMonitoringMiddleware,
  timeoutMiddleware,
  asyncErrorHandler,
  errorEnhancementMiddleware,
  
  // Error enhancement functions
  enhanceStravaError,
  enhanceFileProcessingError,
  enhanceValidationError,
  enhancePerformanceError,
  
  // Integration helpers
  legacyErrorWrapper,
  createEnhancedRoute,
  integreateEnhancedErrorHandling,
  
  // Statistics
  getErrorStats,
  clearErrorStats,
  
  // Direct access to error handler
  errorResponseHandler
};