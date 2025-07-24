/**
 * Enhanced Error Response Handler Middleware
 * Provides comprehensive error responses with recovery suggestions,
 * error codes, debugging information, and user-friendly messages.
 * 
 * Features:
 * - Standardized error response format
 * - Context-aware recovery suggestions
 * - Request ID tracking for debugging
 * - Error categorization and severity levels
 * - Integration with existing error handling systems
 */

const crypto = require('crypto');

class ErrorResponseHandler {
  constructor(options = {}) {
    this.options = Object.assign({
      // Response settings
      includeStackTrace: process.env.NODE_ENV === 'development',
      includeRequestId: true,
      includeRecoverySuggestions: true,
      
      // Logging settings
      enableErrorLogging: true,
      logLevel: 'error',
      
      // Security settings
      sanitizeErrorMessages: true,
      maxErrorDetailLength: 1000,
      
      // Performance settings
      enablePerformanceTracking: true,
      slowRequestThreshold: 5000, // 5 seconds
      
      // Recovery suggestions
      enableContextualSuggestions: true,
      includeDocumentationLinks: false
    }, options);

    this.errorStats = {
      totalErrors: 0,
      errorsByType: new Map(),
      errorsByEndpoint: new Map(),
      recentErrors: []
    };

    console.log('ErrorResponseHandler initialized with options:', this.options);
  }

  /**
   * Error categories for classification
   */
  static ERROR_CATEGORIES = {
    AUTHENTICATION: 'authentication',
    AUTHORIZATION: 'authorization',
    VALIDATION: 'validation',
    NETWORK: 'network',
    DATA_PROCESSING: 'data_processing',
    SYSTEM: 'system',
    RATE_LIMIT: 'rate_limit',
    EXTERNAL_API: 'external_api',
    FILE_PROCESSING: 'file_processing',
    PERFORMANCE: 'performance'
  };

  /**
   * Error severity levels
   */
  static ERROR_SEVERITY = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
  };

  /**
   * Standard error codes
   */
  static ERROR_CODES = {
    // Authentication & Authorization
    AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
    AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
    AUTH_REQUIRED: 'AUTH_REQUIRED',
    INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
    
    // Validation
    VALIDATION_FAILED: 'VALIDATION_FAILED',
    INVALID_INPUT_FORMAT: 'INVALID_INPUT_FORMAT',
    MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
    COORDINATE_VALIDATION_FAILED: 'COORDINATE_VALIDATION_FAILED',
    
    // File Processing
    FILE_TOO_LARGE: 'FILE_TOO_LARGE',
    INVALID_FILE_FORMAT: 'INVALID_FILE_FORMAT',
    FILE_PARSING_FAILED: 'FILE_PARSING_FAILED',
    FILE_CORRUPTED: 'FILE_CORRUPTED',
    
    // External APIs
    STRAVA_API_ERROR: 'STRAVA_API_ERROR',
    STRAVA_RATE_LIMIT: 'STRAVA_RATE_LIMIT',
    MAPBOX_API_ERROR: 'MAPBOX_API_ERROR',
    
    // System & Performance
    INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
    REQUEST_TIMEOUT: 'REQUEST_TIMEOUT',
    MEMORY_LIMIT_EXCEEDED: 'MEMORY_LIMIT_EXCEEDED',
    
    // Data Processing
    DATA_PROCESSING_FAILED: 'DATA_PROCESSING_FAILED',
    ROUTE_GENERATION_FAILED: 'ROUTE_GENERATION_FAILED',
    COORDINATE_CONVERSION_FAILED: 'COORDINATE_CONVERSION_FAILED'
  };

  /**
   * Main error handling middleware
   * @param {Error} error - Error object
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  handleError(error, req, res, next) {
    // Generate request ID if not exists
    const requestId = req.requestId || this.generateRequestId();
    req.requestId = requestId;

    // Start processing time tracking
    const processingStart = Date.now();

    try {
      // Classify and process the error
      const processedError = this.processError(error, req);
      
      // Update error statistics
      this.updateErrorStats(processedError, req);
      
      // Log the error
      this.logError(processedError, req);
      
      // Generate recovery suggestions
      const recoverySuggestions = this.options.includeRecoverySuggestions ? 
        this.generateRecoverySuggestions(processedError, req) : [];
      
      // Create standardized response
      const errorResponse = {
        success: false,
        error: {
          code: processedError.code,
          type: processedError.type,
          category: processedError.category,
          severity: processedError.severity,
          message: processedError.message,
          details: processedError.details,
          timestamp: processedError.timestamp,
          ...(this.options.includeRequestId && { requestId: requestId }),
          ...(this.options.includeRecoverySuggestions && { 
            recoverySuggestions: recoverySuggestions 
          }),
          ...(this.options.includeStackTrace && processedError.stack && { 
            stack: processedError.stack 
          })
        },
        meta: {
          processingTime: Date.now() - processingStart,
          endpoint: `${req.method} ${req.path}`,
          ...(this.options.enablePerformanceTracking && {
            performanceNotes: this.getPerformanceNotes(req, processingStart)
          })
        }
      };

      // Set appropriate HTTP status code
      const statusCode = this.getHttpStatusCode(processedError);
      
      // Send response
      res.status(statusCode).json(errorResponse);
      
    } catch (handlingError) {
      // Fallback error response if error handling itself fails
      console.error('Error handling failed:', handlingError);
      
      res.status(500).json({
        success: false,
        error: {
          code: ErrorResponseHandler.ERROR_CODES.INTERNAL_SERVER_ERROR,
          type: 'internal_server_error',
          category: ErrorResponseHandler.ERROR_CATEGORIES.SYSTEM,
          severity: ErrorResponseHandler.ERROR_SEVERITY.CRITICAL,
          message: 'An internal server error occurred',
          timestamp: new Date().toISOString(),
          requestId: requestId
        }
      });
    }
  }

  /**
   * Process and classify error
   * @param {Error} error - Original error
   * @param {Object} req - Express request object
   * @returns {Object} Processed error object
   */
  processError(error, req) {
    const processed = {
      timestamp: new Date().toISOString(),
      originalMessage: error.message,
      stack: error.stack
    };

    // Determine error type and category based on error properties
    if (error.status === 401 || error.message?.includes('token')) {
      processed.code = ErrorResponseHandler.ERROR_CODES.AUTH_TOKEN_EXPIRED;
      processed.type = 'authentication_error';
      processed.category = ErrorResponseHandler.ERROR_CATEGORIES.AUTHENTICATION;
      processed.severity = ErrorResponseHandler.ERROR_SEVERITY.MEDIUM;
      processed.message = 'Authentication required or token expired';
      processed.details = 'Please re-authenticate to access this resource';
      
    } else if (error.status === 403) {
      processed.code = ErrorResponseHandler.ERROR_CODES.INSUFFICIENT_PERMISSIONS;
      processed.type = 'authorization_error';
      processed.category = ErrorResponseHandler.ERROR_CATEGORIES.AUTHORIZATION;
      processed.severity = ErrorResponseHandler.ERROR_SEVERITY.MEDIUM;
      processed.message = 'Insufficient permissions';
      processed.details = 'You do not have permission to access this resource';
      
    } else if (error.status === 404) {
      processed.code = 'RESOURCE_NOT_FOUND';
      processed.type = 'not_found_error';
      processed.category = ErrorResponseHandler.ERROR_CATEGORIES.VALIDATION;
      processed.severity = ErrorResponseHandler.ERROR_SEVERITY.LOW;
      processed.message = 'Resource not found';
      processed.details = `The requested resource at ${req.path} was not found`;
      
    } else if (error.status === 429 || error.message?.includes('rate limit')) {
      processed.code = ErrorResponseHandler.ERROR_CODES.STRAVA_RATE_LIMIT;
      processed.type = 'rate_limit_error';
      processed.category = ErrorResponseHandler.ERROR_CATEGORIES.RATE_LIMIT;
      processed.severity = ErrorResponseHandler.ERROR_SEVERITY.MEDIUM;
      processed.message = 'Rate limit exceeded';
      processed.details = 'Too many requests. Please wait before trying again';
      
    } else if (error.message?.includes('validation') || error.name === 'ValidationError') {
      processed.code = ErrorResponseHandler.ERROR_CODES.VALIDATION_FAILED;
      processed.type = 'validation_error';
      processed.category = ErrorResponseHandler.ERROR_CATEGORIES.VALIDATION;
      processed.severity = ErrorResponseHandler.ERROR_SEVERITY.MEDIUM;
      processed.message = 'Input validation failed';
      processed.details = this.extractValidationDetails(error);
      
    } else if (error.message?.includes('file') || error.message?.includes('upload')) {
      processed.code = this.getFileErrorCode(error);
      processed.type = 'file_processing_error';
      processed.category = ErrorResponseHandler.ERROR_CATEGORIES.FILE_PROCESSING;
      processed.severity = ErrorResponseHandler.ERROR_SEVERITY.MEDIUM;
      processed.message = 'File processing error';
      processed.details = this.sanitizeMessage(error.message);
      
    } else if (error.message?.includes('Strava') || error.message?.includes('strava')) {
      processed.code = ErrorResponseHandler.ERROR_CODES.STRAVA_API_ERROR;
      processed.type = 'external_api_error';
      processed.category = ErrorResponseHandler.ERROR_CATEGORIES.EXTERNAL_API;
      processed.severity = ErrorResponseHandler.ERROR_SEVERITY.HIGH;
      processed.message = 'Strava API error';
      processed.details = this.sanitizeMessage(error.message);
      
    } else if (error.message?.includes('timeout') || error.code === 'TIMEOUT') {
      processed.code = ErrorResponseHandler.ERROR_CODES.REQUEST_TIMEOUT;
      processed.type = 'timeout_error';
      processed.category = ErrorResponseHandler.ERROR_CATEGORIES.PERFORMANCE;
      processed.severity = ErrorResponseHandler.ERROR_SEVERITY.HIGH;
      processed.message = 'Request timeout';
      processed.details = 'The request took too long to complete';
      
    } else if (error.message?.includes('memory') || error.code === 'MEMORY_LIMIT') {
      processed.code = ErrorResponseHandler.ERROR_CODES.MEMORY_LIMIT_EXCEEDED;
      processed.type = 'memory_error';
      processed.category = ErrorResponseHandler.ERROR_CATEGORIES.PERFORMANCE;
      processed.severity = ErrorResponseHandler.ERROR_SEVERITY.HIGH;
      processed.message = 'Memory limit exceeded';
      processed.details = 'The request requires more memory than available';
      
    } else if (error.message?.includes('coordinates') || error.message?.includes('coordinate')) {
      processed.code = ErrorResponseHandler.ERROR_CODES.COORDINATE_VALIDATION_FAILED;
      processed.type = 'coordinate_error';
      processed.category = ErrorResponseHandler.ERROR_CATEGORIES.DATA_PROCESSING;
      processed.severity = ErrorResponseHandler.ERROR_SEVERITY.MEDIUM;
      processed.message = 'Coordinate validation failed';
      processed.details = this.sanitizeMessage(error.message);
      
    } else {
      // Default/unknown error
      processed.code = ErrorResponseHandler.ERROR_CODES.INTERNAL_SERVER_ERROR;
      processed.type = 'internal_server_error';
      processed.category = ErrorResponseHandler.ERROR_CATEGORIES.SYSTEM;
      processed.severity = ErrorResponseHandler.ERROR_SEVERITY.HIGH;
      processed.message = 'An internal server error occurred';
      processed.details = this.options.includeStackTrace ? 
        this.sanitizeMessage(error.message) : 
        'Please try again or contact support if the problem persists';
    }

    return processed;
  }

  /**
   * Generate recovery suggestions based on error type
   * @param {Object} processedError - Processed error object
   * @param {Object} req - Express request object
   * @returns {Array} Array of recovery suggestion objects
   */
  generateRecoverySuggestions(processedError, req) {
    const suggestions = [];

    switch (processedError.code) {
      case ErrorResponseHandler.ERROR_CODES.AUTH_TOKEN_EXPIRED:
        suggestions.push({
          action: 'reauthenticate',
          description: 'Re-authenticate with Strava to refresh your access token',
          url: '/auth/strava',
          priority: 'high'
        });
        break;

      case ErrorResponseHandler.ERROR_CODES.STRAVA_RATE_LIMIT:
        suggestions.push({
          action: 'wait_and_retry',
          description: 'Wait 15 minutes before making another request',
          waitTime: 900, // 15 minutes in seconds
          priority: 'high'
        });
        suggestions.push({
          action: 'reduce_request_frequency',
          description: 'Try making fewer requests or implementing caching',
          priority: 'medium'
        });
        break;

      case ErrorResponseHandler.ERROR_CODES.FILE_TOO_LARGE:
        suggestions.push({
          action: 'reduce_file_size',
          description: 'Upload a smaller file (maximum 10MB)',
          maxFileSize: '10MB',
          priority: 'high'
        });
        suggestions.push({
          action: 'compress_file',
          description: 'Try compressing your GPX/TCX file before uploading',
          priority: 'medium'
        });
        break;

      case ErrorResponseHandler.ERROR_CODES.INVALID_FILE_FORMAT:
        suggestions.push({
          action: 'check_file_format',
          description: 'Ensure your file is in GPX or TCX format',
          supportedFormats: ['gpx', 'tcx'],
          priority: 'high'
        });
        suggestions.push({
          action: 'export_from_strava',
          description: 'Export the route directly from Strava instead of uploading',
          priority: 'medium'
        });
        break;

      case ErrorResponseHandler.ERROR_CODES.COORDINATE_VALIDATION_FAILED:
        suggestions.push({
          action: 'validate_coordinates',
          description: 'Check that your route contains valid GPS coordinates',
          priority: 'high'
        });
        suggestions.push({
          action: 'try_different_route',
          description: 'Try with a different route or re-export from your GPS device',
          priority: 'medium'
        });
        break;

      case ErrorResponseHandler.ERROR_CODES.REQUEST_TIMEOUT:
        suggestions.push({
          action: 'retry_request',
          description: 'Retry the request - it may have been a temporary issue',
          retryDelay: 5, // 5 seconds
          priority: 'high'
        });
        suggestions.push({
          action: 'reduce_data_size',
          description: 'Try processing a smaller route or fewer activities',
          priority: 'medium'
        });
        break;

      case ErrorResponseHandler.ERROR_CODES.MEMORY_LIMIT_EXCEEDED:
        suggestions.push({
          action: 'simplify_route',
          description: 'Try uploading a route with fewer data points',
          priority: 'high'
        });
        suggestions.push({
          action: 'split_large_routes',
          description: 'Break large routes into smaller segments',
          priority: 'medium'
        });
        break;

      case ErrorResponseHandler.ERROR_CODES.VALIDATION_FAILED:
        suggestions.push({
          action: 'check_input_data',
          description: 'Verify that all required fields are filled correctly',
          priority: 'high'
        });
        suggestions.push({
          action: 'review_error_details',
          description: 'Check the specific validation errors in the response details',
          priority: 'medium'
        });
        break;

      default:
        // Generic suggestions
        suggestions.push({
          action: 'refresh_page',
          description: 'Try refreshing the page and attempting the operation again',
          priority: 'medium'
        });
        suggestions.push({
          action: 'contact_support',
          description: 'If the problem persists, contact support with the request ID',
          priority: 'low'
        });
        break;
    }

    // Add contextual suggestions based on request path
    if (req.path.includes('/activities')) {
      suggestions.push({
        action: 'check_strava_connection',
        description: 'Ensure your Strava account is properly connected',
        priority: 'medium'
      });
    }

    if (req.path.includes('/upload')) {
      suggestions.push({
        action: 'verify_file_integrity',
        description: 'Make sure your file is not corrupted and contains valid GPS data',
        priority: 'medium'
      });
    }

    return suggestions.slice(0, 3); // Limit to 3 most relevant suggestions
  }

  /**
   * Extract validation details from error
   * @param {Error} error - Validation error
   * @returns {string} Formatted validation details
   */
  extractValidationDetails(error) {
    if (error.details && Array.isArray(error.details)) {
      return error.details.map(detail => detail.message).join('; ');
    }
    
    if (error.errors && typeof error.errors === 'object') {
      return Object.keys(error.errors)
        .map(key => `${key}: ${error.errors[key].message || error.errors[key]}`)
        .join('; ');
    }
    
    return this.sanitizeMessage(error.message);
  }

  /**
   * Get file-specific error code
   * @param {Error} error - File-related error
   * @returns {string} Error code
   */
  getFileErrorCode(error) {
    if (error.message?.includes('too large') || error.code === 'LIMIT_FILE_SIZE') {
      return ErrorResponseHandler.ERROR_CODES.FILE_TOO_LARGE;
    }
    
    if (error.message?.includes('format') || error.message?.includes('invalid')) {
      return ErrorResponseHandler.ERROR_CODES.INVALID_FILE_FORMAT;
    }
    
    if (error.message?.includes('parsing') || error.message?.includes('parse')) {
      return ErrorResponseHandler.ERROR_CODES.FILE_PARSING_FAILED;
    }
    
    if (error.message?.includes('corrupted') || error.message?.includes('malformed')) {
      return ErrorResponseHandler.ERROR_CODES.FILE_CORRUPTED;
    }
    
    return ErrorResponseHandler.ERROR_CODES.DATA_PROCESSING_FAILED;
  }

  /**
   * Get HTTP status code for error
   * @param {Object} processedError - Processed error object
   * @returns {number} HTTP status code
   */
  getHttpStatusCode(processedError) {
    switch (processedError.category) {
      case ErrorResponseHandler.ERROR_CATEGORIES.AUTHENTICATION:
        return 401;
      case ErrorResponseHandler.ERROR_CATEGORIES.AUTHORIZATION:
        return 403;
      case ErrorResponseHandler.ERROR_CATEGORIES.VALIDATION:
        return processedError.type === 'not_found_error' ? 404 : 400;
      case ErrorResponseHandler.ERROR_CATEGORIES.RATE_LIMIT:
        return 429;
      case ErrorResponseHandler.ERROR_CATEGORIES.FILE_PROCESSING:
        return 422;
      case ErrorResponseHandler.ERROR_CATEGORIES.EXTERNAL_API:
        return 502;
      case ErrorResponseHandler.ERROR_CATEGORIES.PERFORMANCE:
        return processedError.code === ErrorResponseHandler.ERROR_CODES.REQUEST_TIMEOUT ? 408 : 503;
      default:
        return 500;
    }
  }

  /**
   * Get performance notes for the request
   * @param {Object} req - Express request object
   * @param {number} processingStart - Processing start time
   * @returns {Array} Performance notes
   */
  getPerformanceNotes(req, processingStart) {
    const notes = [];
    const processingTime = Date.now() - processingStart;
    
    if (processingTime > this.options.slowRequestThreshold) {
      notes.push({
        type: 'slow_request',
        message: `Request processing took ${processingTime}ms (threshold: ${this.options.slowRequestThreshold}ms)`,
        suggestion: 'Consider optimizing the request or reducing data size'
      });
    }
    
    // Check memory usage if available
    if (process.memoryUsage) {
      const memUsage = process.memoryUsage();
      const memoryMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      
      if (memoryMB > 100) { // More than 100MB
        notes.push({
          type: 'high_memory_usage',
          message: `High memory usage detected: ${memoryMB}MB`,
          suggestion: 'Consider processing smaller datasets or implementing streaming'
        });
      }
    }
    
    return notes;
  }

  /**
   * Sanitize error message for security
   * @param {string} message - Original error message
   * @returns {string} Sanitized message
   */
  sanitizeMessage(message) {
    if (!this.options.sanitizeErrorMessages) {
      return message;
    }
    
    if (!message || typeof message !== 'string') {
      return 'An error occurred';
    }
    
    // Remove sensitive information patterns
    let sanitized = message
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[email]') // Email addresses
      .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[ip]') // IP addresses
      .replace(/\/[a-zA-Z]:[\\\/].*/g, '[path]') // File paths
      .replace(/Bearer\s+[a-zA-Z0-9_-]+/g, 'Bearer [token]') // Bearer tokens
      .replace(/password[s]?[:\s=]+[^\s]+/gi, 'password=[hidden]') // Passwords
      .replace(/key[s]?[:\s=]+[^\s]+/gi, 'key=[hidden]'); // API keys
    
    // Truncate if too long
    if (sanitized.length > this.options.maxErrorDetailLength) {
      sanitized = sanitized.substring(0, this.options.maxErrorDetailLength) + '...';
    }
    
    return sanitized;
  }

  /**
   * Log error with appropriate level
   * @param {Object} processedError - Processed error object
   * @param {Object} req - Express request object
   */
  logError(processedError, req) {
    if (!this.options.enableErrorLogging) return;
    
    const logData = {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      error: {
        code: processedError.code,
        type: processedError.type,
        category: processedError.category,
        severity: processedError.severity,
        message: processedError.message
      },
      timestamp: processedError.timestamp
    };
    
    switch (processedError.severity) {
      case ErrorResponseHandler.ERROR_SEVERITY.CRITICAL:
        console.error(`[CRITICAL ERROR]`, logData);
        break;
      case ErrorResponseHandler.ERROR_SEVERITY.HIGH:
        console.error(`[HIGH ERROR]`, logData);
        break;
      case ErrorResponseHandler.ERROR_SEVERITY.MEDIUM:
        console.warn(`[MEDIUM ERROR]`, logData);
        break;
      case ErrorResponseHandler.ERROR_SEVERITY.LOW:
        console.info(`[LOW ERROR]`, logData);
        break;
    }
  }

  /**
   * Update error statistics
   * @param {Object} processedError - Processed error object
   * @param {Object} req - Express request object
   */
  updateErrorStats(processedError, req) {
    this.errorStats.totalErrors++;
    
    // Update by type
    const typeKey = processedError.type;
    this.errorStats.errorsByType.set(typeKey, (this.errorStats.errorsByType.get(typeKey) || 0) + 1);
    
    // Update by endpoint
    const endpointKey = `${req.method} ${req.path}`;
    this.errorStats.errorsByEndpoint.set(endpointKey, (this.errorStats.errorsByEndpoint.get(endpointKey) || 0) + 1);
    
    // Add to recent errors (keep last 100)
    this.errorStats.recentErrors.push({
      timestamp: processedError.timestamp,
      type: processedError.type,
      code: processedError.code,
      endpoint: endpointKey,
      requestId: req.requestId
    });
    
    if (this.errorStats.recentErrors.length > 100) {
      this.errorStats.recentErrors.shift();
    }
  }

  /**
   * Generate unique request ID
   * @returns {string} Request ID
   */
  generateRequestId() {
    return `req_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Express middleware factory
   * @param {Object} options - Middleware options
   * @returns {Function} Express middleware function
   */
  static middleware(options = {}) {
    const handler = new ErrorResponseHandler(options);
    return (error, req, res, next) => handler.handleError(error, req, res, next);
  }

  /**
   * Get error statistics
   * @returns {Object} Error statistics
   */
  getErrorStats() {
    return {
      totalErrors: this.errorStats.totalErrors,
      errorsByType: Object.fromEntries(this.errorStats.errorsByType),
      errorsByEndpoint: Object.fromEntries(this.errorStats.errorsByEndpoint),
      recentErrorCount: this.errorStats.recentErrors.length,
      recentErrors: this.errorStats.recentErrors.slice(-10) // Last 10 errors
    };
  }

  /**
   * Clear error statistics
   * @param {number} olderThanHours - Clear errors older than specified hours
   */
  clearErrorStats(olderThanHours = 24) {
    const cutoffTime = Date.now() - (olderThanHours * 60 * 60 * 1000);
    
    this.errorStats.recentErrors = this.errorStats.recentErrors.filter(
      error => new Date(error.timestamp).getTime() > cutoffTime
    );
  }
}

module.exports = ErrorResponseHandler;