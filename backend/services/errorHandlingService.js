/**
 * Error Handling Service
 * Provides centralized error handling, classification, and recovery mechanisms
 * for the canvas export system
 */

class ErrorHandlingService {
  constructor() {
    this.errorClassifications = new Map();
    this.retryStrategies = new Map();
    this.errorMetrics = new Map();
    
    this.initializeErrorClassifications();
    this.initializeRetryStrategies();
  }

  /**
   * Initialize error classifications
   */
  initializeErrorClassifications() {
    // Network-related errors
    this.errorClassifications.set('NETWORK_ERROR', {
      category: 'network',
      severity: 'medium',
      retryable: true,
      maxRetries: 3,
      backoffMultiplier: 2,
      userMessage: 'Network connection issue. Retrying...',
      logLevel: 'warn'
    });

    // File system errors
    this.errorClassifications.set('FILE_SYSTEM_ERROR', {
      category: 'filesystem',
      severity: 'high',
      retryable: true,
      maxRetries: 2,
      backoffMultiplier: 1.5,
      userMessage: 'File system issue. Attempting recovery...',
      logLevel: 'error'
    });

    // Memory/resource errors
    this.errorClassifications.set('MEMORY_ERROR', {
      category: 'resource',
      severity: 'high',
      retryable: false,
      maxRetries: 0,
      userMessage: 'Insufficient memory. Please try with a smaller image.',
      logLevel: 'error'
    });

    // Canvas processing errors
    this.errorClassifications.set('CANVAS_PROCESSING_ERROR', {
      category: 'processing',
      severity: 'medium',
      retryable: true,
      maxRetries: 2,
      backoffMultiplier: 1.5,
      userMessage: 'Image processing error. Retrying with different settings...',
      logLevel: 'warn'
    });

    // Image format errors
    this.errorClassifications.set('IMAGE_FORMAT_ERROR', {
      category: 'validation',
      severity: 'low',
      retryable: false,
      maxRetries: 0,
      userMessage: 'Invalid image format. Please check your input.',
      logLevel: 'info'
    });

    // Timeout errors
    this.errorClassifications.set('TIMEOUT_ERROR', {
      category: 'timeout',
      severity: 'medium',
      retryable: true,
      maxRetries: 1,
      backoffMultiplier: 1,
      userMessage: 'Operation timed out. Retrying...',
      logLevel: 'warn'
    });

    // Sharp processing errors
    this.errorClassifications.set('SHARP_ERROR', {
      category: 'processing',
      severity: 'medium',
      retryable: true,
      maxRetries: 2,
      backoffMultiplier: 1.2,
      userMessage: 'Image processing failed. Trying alternative method...',
      logLevel: 'warn'
    });

    // Storage errors
    this.errorClassifications.set('STORAGE_ERROR', {
      category: 'storage',
      severity: 'high',
      retryable: true,
      maxRetries: 3,
      backoffMultiplier: 2,
      userMessage: 'Storage issue. Attempting to save to alternative location...',
      logLevel: 'error'
    });
  }

  /**
   * Initialize retry strategies
   */
  initializeRetryStrategies() {
    // Exponential backoff
    this.retryStrategies.set('exponential', (attempt, baseDelay, multiplier) => {
      return baseDelay * Math.pow(multiplier, attempt - 1);
    });

    // Linear backoff
    this.retryStrategies.set('linear', (attempt, baseDelay, multiplier) => {
      return baseDelay * attempt * multiplier;
    });

    // Fixed delay
    this.retryStrategies.set('fixed', (attempt, baseDelay) => {
      return baseDelay;
    });

    // Jittered exponential backoff
    this.retryStrategies.set('jittered', (attempt, baseDelay, multiplier) => {
      const exponentialDelay = baseDelay * Math.pow(multiplier, attempt - 1);
      const jitter = Math.random() * exponentialDelay * 0.1; // 10% jitter
      return exponentialDelay + jitter;
    });
  }

  /**
   * Classify an error and determine handling strategy
   * @param {Error} error - The error to classify
   * @returns {Object} Error classification and handling strategy
   */
  classifyError(error) {
    const errorMessage = error.message?.toLowerCase() || '';
    const errorStack = error.stack?.toLowerCase() || '';

    // Network errors
    if (errorMessage.includes('network') || errorMessage.includes('connection') || 
        errorMessage.includes('timeout') || error.code === 'ECONNRESET') {
      return this.getClassification('NETWORK_ERROR');
    }

    // File system errors
    if (errorMessage.includes('enoent') || errorMessage.includes('eacces') || 
        errorMessage.includes('file') || error.code?.startsWith('E')) {
      return this.getClassification('FILE_SYSTEM_ERROR');
    }

    // Memory errors
    if (errorMessage.includes('memory') || errorMessage.includes('heap') || 
        errorMessage.includes('out of memory') || error.code === 'ERR_MEMORY_ALLOCATION_FAILED') {
      return this.getClassification('MEMORY_ERROR');
    }

    // Sharp-specific errors
    if (errorStack.includes('sharp') || errorMessage.includes('vips') || 
        errorMessage.includes('libvips') || errorMessage.includes('vipsjpeg')) {
      return this.getClassification('SHARP_ERROR');
    }

    // Canvas processing errors
    if (errorMessage.includes('canvas') || errorMessage.includes('rendering') || 
        errorMessage.includes('processing')) {
      return this.getClassification('CANVAS_PROCESSING_ERROR');
    }

    // Image format errors
    if (errorMessage.includes('format') || errorMessage.includes('invalid image') || 
        errorMessage.includes('corrupt')) {
      return this.getClassification('IMAGE_FORMAT_ERROR');
    }

    // Timeout errors
    if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
      return this.getClassification('TIMEOUT_ERROR');
    }

    // Storage errors
    if (errorMessage.includes('storage') || errorMessage.includes('disk') || 
        errorMessage.includes('write') || errorMessage.includes('save')) {
      return this.getClassification('STORAGE_ERROR');
    }

    // Default classification for unknown errors
    return {
      category: 'unknown',
      severity: 'medium',
      retryable: true,
      maxRetries: 1,
      backoffMultiplier: 1.5,
      userMessage: 'An unexpected error occurred. Retrying...',
      logLevel: 'error',
      type: 'UNKNOWN_ERROR'
    };
  }

  /**
   * Get error classification by type
   * @param {string} errorType - Error type key
   * @returns {Object} Error classification
   */
  getClassification(errorType) {
    const classification = this.errorClassifications.get(errorType);
    return classification ? { ...classification, type: errorType } : null;
  }

  /**
   * Execute operation with retry logic
   * @param {Function} operation - The operation to execute
   * @param {Object} options - Retry options
   * @returns {Promise} Operation result
   */
  async executeWithRetry(operation, options = {}) {
    const {
      maxRetries = 3,
      baseDelay = 1000,
      retryStrategy = 'exponential',
      context = 'unknown',
      progressCallback = null,
      onRetry = null
    } = options;

    let lastError = null;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        attempt++;
        
        if (progressCallback && attempt > 1) {
          progressCallback({
            message: `Retry attempt ${attempt - 1}/${maxRetries}`,
            attempt: attempt - 1,
            maxRetries
          });
        }

        const result = await operation(attempt);
        
        // Success - reset error metrics for this context
        if (this.errorMetrics.has(context)) {
          this.errorMetrics.get(context).consecutiveFailures = 0;
        }
        
        return result;
        
      } catch (error) {
        lastError = error;
        this.recordError(context, error);
        
        const classification = this.classifyError(error);
        
        // Log the error
        this.logError(error, classification, attempt, context);
        
        // Check if we should retry
        if (attempt > maxRetries || !classification.retryable) {
          break;
        }
        
        // Execute retry callback if provided
        if (onRetry) {
          try {
            await onRetry(error, attempt, classification);
          } catch (retryError) {
            console.warn('Error in retry callback:', retryError.message);
          }
        }
        
        // Calculate delay for next attempt
        if (attempt <= maxRetries) {
          const delay = this.calculateDelay(
            attempt, 
            baseDelay, 
            classification.backoffMultiplier, 
            retryStrategy
          );
          
          await this.sleep(delay);
        }
      }
    }

    // All retries exhausted, throw the last error with context
    const enhancedError = this.enhanceError(lastError, {
      context,
      totalAttempts: attempt,
      maxRetries,
      classification: this.classifyError(lastError)
    });
    
    throw enhancedError;
  }

  /**
   * Calculate retry delay
   * @param {number} attempt - Current attempt number
   * @param {number} baseDelay - Base delay in ms
   * @param {number} multiplier - Backoff multiplier
   * @param {string} strategy - Retry strategy name
   * @returns {number} Delay in milliseconds
   */
  calculateDelay(attempt, baseDelay, multiplier, strategy) {
    const strategyFunc = this.retryStrategies.get(strategy);
    if (!strategyFunc) {
      return baseDelay * attempt;
    }
    
    return Math.min(strategyFunc(attempt, baseDelay, multiplier), 30000); // Max 30s delay
  }

  /**
   * Sleep for specified duration
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise} Promise that resolves after delay
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Record error metrics
   * @param {string} context - Error context
   * @param {Error} error - The error
   */
  recordError(context, error) {
    if (!this.errorMetrics.has(context)) {
      this.errorMetrics.set(context, {
        totalErrors: 0,
        consecutiveFailures: 0,
        errorTypes: new Map(),
        lastError: null,
        firstErrorTime: Date.now()
      });
    }

    const metrics = this.errorMetrics.get(context);
    metrics.totalErrors++;
    metrics.consecutiveFailures++;
    metrics.lastError = error;

    const classification = this.classifyError(error);
    const errorType = classification.type;

    if (!metrics.errorTypes.has(errorType)) {
      metrics.errorTypes.set(errorType, 0);
    }
    metrics.errorTypes.set(errorType, metrics.errorTypes.get(errorType) + 1);
  }

  /**
   * Log error with appropriate level
   * @param {Error} error - The error
   * @param {Object} classification - Error classification
   * @param {number} attempt - Attempt number
   * @param {string} context - Error context
   */
  logError(error, classification, attempt, context) {
    const logLevel = classification.logLevel || 'error';
    const message = `[${context}] Attempt ${attempt}: ${error.message}`;
    
    switch (logLevel) {
      case 'info':
        console.info(message);
        break;
      case 'warn':
        console.warn(message);
        break;
      case 'error':
      default:
        console.error(message, {
          stack: error.stack,
          classification: classification.type,
          category: classification.category
        });
        break;
    }
  }

  /**
   * Enhance error with additional context
   * @param {Error} error - Original error
   * @param {Object} context - Additional context
   * @returns {Error} Enhanced error
   */
  enhanceError(error, context) {
    const enhancedError = new Error(error.message);
    enhancedError.name = error.name;
    enhancedError.stack = error.stack;
    enhancedError.originalError = error;
    enhancedError.context = context;
    enhancedError.timestamp = new Date().toISOString();
    enhancedError.isRetryExhausted = true;
    
    return enhancedError;
  }

  /**
   * Create graceful degradation handler
   * @param {Object} options - Degradation options
   * @returns {Function} Degradation handler
   */
  createDegradationHandler(options = {}) {
    const {
      fallbackQuality = 80,
      fallbackFormat = 'jpeg',
      maxDimensions = { width: 2048, height: 2048 },
      enableFallbacks = true
    } = options;

    return async (error, originalOptions) => {
      if (!enableFallbacks) {
        throw error;
      }

      const classification = this.classifyError(error);
      
      console.warn(`Applying graceful degradation for ${classification.type}:`, error.message);

      // Memory error degradation
      if (classification.type === 'MEMORY_ERROR') {
        return {
          ...originalOptions,
          quality: Math.min(fallbackQuality, originalOptions.quality || 100),
          width: Math.min(maxDimensions.width, originalOptions.width || 2048),
          height: Math.min(maxDimensions.height, originalOptions.height || 2048),
          format: fallbackFormat,
          degradationApplied: 'memory_optimization'
        };
      }

      // Processing error degradation
      if (classification.type === 'CANVAS_PROCESSING_ERROR' || classification.type === 'SHARP_ERROR') {
        return {
          ...originalOptions,
          quality: fallbackQuality,
          format: fallbackFormat,
          progressive: false,
          optimize: false,
          degradationApplied: 'processing_simplification'
        };
      }

      // Format error degradation
      if (classification.type === 'IMAGE_FORMAT_ERROR') {
        return {
          ...originalOptions,
          format: 'png', // Most compatible format
          quality: 100,
          degradationApplied: 'format_fallback'
        };
      }

      // Default degradation
      return {
        ...originalOptions,
        quality: fallbackQuality,
        format: fallbackFormat,
        degradationApplied: 'default_fallback'
      };
    };
  }

  /**
   * Get error metrics for context
   * @param {string} context - Error context
   * @returns {Object} Error metrics
   */
  getErrorMetrics(context) {
    return this.errorMetrics.get(context) || null;
  }

  /**
   * Reset error metrics for context
   * @param {string} context - Error context
   */
  resetErrorMetrics(context) {
    this.errorMetrics.delete(context);
  }

  /**
   * Get all error metrics
   * @returns {Object} All error metrics
   */
  getAllErrorMetrics() {
    const metrics = {};
    for (const [context, data] of this.errorMetrics) {
      metrics[context] = {
        ...data,
        errorTypes: Object.fromEntries(data.errorTypes)
      };
    }
    return metrics;
  }

  /**
   * Create circuit breaker for frequently failing operations
   * @param {Object} options - Circuit breaker options
   * @returns {Function} Circuit breaker function
   */
  createCircuitBreaker(options = {}) {
    const {
      failureThreshold = 5,
      resetTimeout = 60000,
      monitoringPeriod = 300000 // 5 minutes
    } = options;

    let state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    let failures = 0;
    let lastFailureTime = 0;
    let nextAttemptTime = 0;

    return async (operation, context = 'circuit_breaker') => {
      const now = Date.now();

      // Reset failures if monitoring period has passed
      if (now - lastFailureTime > monitoringPeriod) {
        failures = 0;
        state = 'CLOSED';
      }

      // Check circuit state
      if (state === 'OPEN') {
        if (now < nextAttemptTime) {
          throw new Error('Circuit breaker is OPEN - operation temporarily disabled');
        } else {
          state = 'HALF_OPEN';
        }
      }

      try {
        const result = await operation();
        
        // Success - reset circuit
        if (state === 'HALF_OPEN') {
          state = 'CLOSED';
          failures = 0;
        }
        
        return result;
        
      } catch (error) {
        failures++;
        lastFailureTime = now;
        
        if (failures >= failureThreshold) {
          state = 'OPEN';
          nextAttemptTime = now + resetTimeout;
          console.warn(`Circuit breaker opened for ${context} after ${failures} failures`);
        }
        
        throw error;
      }
    };
  }
}

module.exports = ErrorHandlingService;