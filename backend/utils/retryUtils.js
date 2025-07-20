/**
 * Retry Utilities with Exponential Backoff
 * Provides robust retry mechanisms for OAuth and API operations
 */

class RetryUtils {
  /**
   * Default retry configuration
   */
  static DEFAULT_CONFIG = {
    maxRetries: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 30000, // 30 seconds
    backoffFactor: 2,
    jitter: true,
    retryableErrors: [
      'ENOTFOUND',
      'ECONNREFUSED', 
      'ETIMEDOUT',
      'ECONNRESET',
      'EPIPE'
    ],
    retryableStatusCodes: [429, 500, 502, 503, 504]
  };

  /**
   * Execute operation with exponential backoff retry
   * @param {Function} operation - Async operation to retry
   * @param {Object} config - Retry configuration
   * @returns {Promise} Operation result
   */
  static async withRetry(operation, config = {}) {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    let lastError;
    
    for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
      try {
        const result = await operation(attempt);
        
        // Log successful retry if not first attempt
        if (attempt > 0) {
          console.log(`Operation succeeded on attempt ${attempt + 1}`);
        }
        
        return result;
      } catch (error) {
        lastError = error;
        
        // Don't retry on last attempt
        if (attempt === finalConfig.maxRetries) {
          console.error(`Operation failed after ${attempt + 1} attempts:`, error.message);
          break;
        }

        // Check if error is retryable
        if (!this.isRetryableError(error, finalConfig)) {
          console.log(`Non-retryable error encountered:`, error.message);
          throw error;
        }

        // Calculate delay with exponential backoff
        const delay = this.calculateDelay(attempt, finalConfig);
        
        console.log(`Attempt ${attempt + 1} failed: ${error.message}. Retrying in ${delay}ms...`);
        
        // Wait before next attempt
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Check if error is retryable based on configuration
   * @param {Error} error - Error to check
   * @param {Object} config - Retry configuration
   * @returns {boolean} Whether error is retryable
   */
  static isRetryableError(error, config) {
    // Check error codes (network errors)
    if (error.code && config.retryableErrors.includes(error.code)) {
      return true;
    }

    // Check HTTP status codes
    if (error.status && config.retryableStatusCodes.includes(error.status)) {
      return true;
    }

    // Check for timeout errors
    if (error.message && error.message.toLowerCase().includes('timeout')) {
      return true;
    }

    // Check for specific error types
    if (error.name === 'FetchError' || error.name === 'AbortError') {
      return true;
    }

    return false;
  }

  /**
   * Calculate delay with exponential backoff and jitter
   * @param {number} attempt - Current attempt number (0-indexed)
   * @param {Object} config - Retry configuration
   * @returns {number} Delay in milliseconds
   */
  static calculateDelay(attempt, config) {
    // Calculate exponential backoff
    let delay = config.baseDelay * Math.pow(config.backoffFactor, attempt);
    
    // Apply maximum delay limit
    delay = Math.min(delay, config.maxDelay);
    
    // Add jitter to prevent thundering herd
    if (config.jitter) {
      const jitterRange = delay * 0.1; // 10% jitter
      const jitter = (Math.random() - 0.5) * 2 * jitterRange;
      delay += jitter;
    }
    
    return Math.round(Math.max(delay, 100)); // Minimum 100ms delay
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise} Promise that resolves after delay
   */
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Wrapper for fetch operations with timeout and retry
   * @param {string} url - URL to fetch
   * @param {Object} options - Fetch options
   * @param {Object} retryConfig - Retry configuration
   * @returns {Promise} Fetch response
   */
  static async fetchWithRetry(url, options = {}, retryConfig = {}) {
    const config = { ...this.DEFAULT_CONFIG, ...retryConfig };
    
    // Add timeout to fetch options if not already present
    const finalOptions = {
      timeout: 30000, // 30 second default timeout
      ...options
    };

    const operation = async (attempt) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), finalOptions.timeout);
      
      try {
        const response = await fetch(url, {
          ...finalOptions,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        // Check for HTTP error status codes
        if (!response.ok) {
          const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
          error.status = response.status;
          error.response = response;
          throw error;
        }
        
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        
        // Handle fetch-specific errors
        if (error.name === 'AbortError') {
          const timeoutError = new Error(`Request timeout after ${finalOptions.timeout}ms`);
          timeoutError.code = 'ETIMEDOUT';
          throw timeoutError;
        }
        
        throw error;
      }
    };

    return this.withRetry(operation, config);
  }

  /**
   * Wrapper for OAuth token operations with retry
   * @param {Function} tokenOperation - Token operation function
   * @param {Object} retryConfig - Retry configuration
   * @returns {Promise} Token operation result
   */
  static async tokenOperationWithRetry(tokenOperation, retryConfig = {}) {
    const config = {
      ...this.DEFAULT_CONFIG,
      maxRetries: 2, // Fewer retries for token operations
      baseDelay: 2000, // Longer initial delay
      ...retryConfig
    };

    return this.withRetry(tokenOperation, config);
  }

  /**
   * Create a circuit breaker for repeated failures
   * @param {Object} options - Circuit breaker options
   * @returns {Object} Circuit breaker instance
   */
  static createCircuitBreaker(options = {}) {
    const config = {
      failureThreshold: 5,
      recoveryTimeout: 60000, // 1 minute
      monitoringPeriod: 120000, // 2 minutes
      ...options
    };

    let state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    let failures = 0;
    let lastFailureTime = null;
    let successCount = 0;

    return {
      async execute(operation) {
        // Check circuit breaker state
        if (state === 'OPEN') {
          const timeSinceLastFailure = Date.now() - lastFailureTime;
          
          if (timeSinceLastFailure < config.recoveryTimeout) {
            throw new Error('Circuit breaker is OPEN - service unavailable');
          }
          
          // Move to half-open state
          state = 'HALF_OPEN';
          successCount = 0;
        }

        try {
          const result = await operation();
          
          // Success - handle state transitions
          if (state === 'HALF_OPEN') {
            successCount++;
            if (successCount >= 2) {
              state = 'CLOSED';
              failures = 0;
              console.log('Circuit breaker reset to CLOSED state');
            }
          } else if (state === 'CLOSED') {
            failures = 0; // Reset failure count on success
          }
          
          return result;
        } catch (error) {
          failures++;
          lastFailureTime = Date.now();
          
          if (state === 'HALF_OPEN') {
            state = 'OPEN';
            console.log('Circuit breaker moved to OPEN state from HALF_OPEN');
          } else if (state === 'CLOSED' && failures >= config.failureThreshold) {
            state = 'OPEN';
            console.log(`Circuit breaker OPENED after ${failures} failures`);
          }
          
          throw error;
        }
      },

      getState() {
        return {
          state,
          failures,
          lastFailureTime,
          successCount
        };
      },

      reset() {
        state = 'CLOSED';
        failures = 0;
        lastFailureTime = null;
        successCount = 0;
        console.log('Circuit breaker manually reset');
      }
    };
  }
}

module.exports = RetryUtils;