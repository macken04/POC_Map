/**
 * OAuth Error Handler Middleware
 * Provides centralized error handling for OAuth-related operations
 * Includes user-friendly error messages and proper logging
 */

const config = require('../config');
const ErrorPageTemplates = require('../templates/errorPages');

class OAuthErrorHandler {
  constructor() {
    this.appConfig = config.getConfig();
  }

  /**
   * Handle Strava OAuth errors with context-aware responses
   * @param {Error} error - The error object
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   * @param {string} context - Error context (e.g., 'token_exchange', 'authorization', 'refresh')
   */
  handleOAuthError(error, req, res, next, context = 'oauth') {
    const errorId = this.generateErrorId();
    const userAgent = req.get('User-Agent') || 'unknown';
    const clientIP = req.ip || req.connection.remoteAddress;
    
    // Log detailed error information for debugging
    console.error(`OAuth Error [${errorId}]:`, {
      context,
      error: error.message,
      stack: error.stack,
      status: error.status,
      url: req.url,
      method: req.method,
      userAgent,
      clientIP,
      timestamp: new Date().toISOString(),
      sessionId: req.sessionID
    });

    // Determine error type and generate appropriate response
    const errorResponse = this.categorizeError(error, context, errorId);
    
    // Check if this is a browser request or API request
    const acceptsHtml = req.accepts(['html', 'json']) === 'html';
    
    if (acceptsHtml) {
      // Generate HTML error page for browser users
      const htmlPage = ErrorPageTemplates.generateErrorPage({
        title: this.getErrorTitle(errorResponse.code),
        message: errorResponse.userMessage,
        errorCode: errorResponse.code,
        errorId: errorId,
        retryUrl: '/auth/strava',
        homeUrl: '/',
        showRetry: errorResponse.retryable !== false,
        retryAfter: errorResponse.retryAfter
      });
      
      return res.status(errorResponse.status).type('html').send(htmlPage);
    }

    // Return JSON response for API clients
    res.status(errorResponse.status).json({
      error: errorResponse.code,
      message: errorResponse.userMessage,
      errorId: errorId,
      context: context,
      timestamp: new Date().toISOString(),
      ...(this.appConfig.env !== 'production' && { 
        debug: {
          originalError: error.message,
          stack: error.stack?.split('\n').slice(0, 3) // Limited stack trace
        }
      })
    });
  }

  /**
   * Categorize errors and provide appropriate user messages
   * @param {Error} error - The error object
   * @param {string} context - Error context
   * @param {string} errorId - Generated error ID
   * @returns {Object} Error response configuration
   */
  categorizeError(error, context, errorId) {
    // Network and timeout errors
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return {
        code: 'network_error',
        status: 503,
        userMessage: 'Unable to connect to Strava. Please check your internet connection and try again.',
        redirectUrl: '/auth/error',
        retryable: true,
        retryAfter: 30
      };
    }

    // Strava API specific errors
    if (error.status) {
      switch (error.status) {
        case 400:
          return {
            code: 'invalid_request',
            status: 400,
            userMessage: 'Invalid authentication request. Please try logging in again.',
            redirectUrl: '/auth/login'
          };

        case 401:
          if (context === 'token_refresh') {
            return {
              code: 'refresh_failed',
              status: 401,
              userMessage: 'Your Strava session has expired. Please log in again to continue.',
              redirectUrl: '/auth/login'
            };
          }
          return {
            code: 'unauthorized',
            status: 401,
            userMessage: 'Authentication failed. Please log in with Strava to continue.',
            redirectUrl: '/auth/login'
          };

        case 403:
          return {
            code: 'access_denied',
            status: 403,
            userMessage: 'Access denied. Please ensure you have granted the necessary permissions to access your Strava data.',
            redirectUrl: '/auth/error'
          };

        case 429:
          const retryAfter = error.response?.headers?.get('retry-after') || 300;
          return {
            code: 'rate_limited',
            status: 429,
            userMessage: `Too many requests. Please wait ${Math.ceil(retryAfter / 60)} minutes before trying again.`,
            redirectUrl: '/auth/error',
            retryable: true,
            retryAfter: parseInt(retryAfter)
          };

        case 500:
        case 502:
        case 503:
        case 504:
          return {
            code: 'strava_service_error',
            status: 503,
            userMessage: 'Strava is temporarily unavailable. Please try again in a few minutes.',
            redirectUrl: '/auth/error',
            retryable: true,
            retryAfter: 120
          };

        default:
          return {
            code: 'strava_api_error',
            status: error.status,
            userMessage: 'An error occurred while communicating with Strava. Please try again.',
            redirectUrl: '/auth/error'
          };
      }
    }

    // OAuth-specific errors
    if (context === 'authorization') {
      if (error.message.includes('access_denied')) {
        return {
          code: 'user_denied',
          status: 400,
          userMessage: 'Authorization was cancelled. You need to grant access to your Strava account to continue.',
          redirectUrl: '/auth/login'
        };
      }

      if (error.message.includes('state')) {
        return {
          code: 'security_error',
          status: 400,
          userMessage: 'Security validation failed. Please start the login process again.',
          redirectUrl: '/auth/login'
        };
      }
    }

    // Token-specific errors
    if (context === 'token_exchange' || context === 'token_refresh') {
      if (error.message.includes('invalid_grant')) {
        return {
          code: 'invalid_authorization',
          status: 400,
          userMessage: 'Authorization code has expired or is invalid. Please start the login process again.',
          redirectUrl: '/auth/login'
        };
      }
    }

    // Generic server errors
    return {
      code: 'server_error',
      status: 500,
      userMessage: 'An unexpected error occurred. Please try again or contact support if the problem persists.',
      redirectUrl: '/auth/error',
      supportInfo: {
        errorId: errorId,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Generate unique error ID for tracking
   * @returns {string} Unique error identifier
   */
  generateErrorId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `ERR_${timestamp}_${random}`.toUpperCase();
  }

  /**
   * Get appropriate error title for error code
   * @param {string} errorCode - Error code
   * @returns {string} User-friendly error title
   */
  getErrorTitle(errorCode) {
    const titleMap = {
      'network_error': 'Connection Error',
      'invalid_request': 'Invalid Request',
      'unauthorized': 'Authentication Required',
      'access_denied': 'Access Denied',
      'user_denied': 'Access Denied',
      'rate_limited': 'Too Many Requests',
      'client_rate_limited': 'Too Many Requests',
      'strava_rate_limited': 'Service Busy',
      'rate_limit_protection': 'Service Protection',
      'strava_service_error': 'Service Unavailable',
      'refresh_failed': 'Session Expired',
      'security_error': 'Security Check Failed',
      'state_mismatch': 'Security Check Failed',
      'server_error': 'Server Error',
      'service_unavailable': 'Service Unavailable'
    };

    return titleMap[errorCode] || 'Authentication Error';
  }

  /**
   * Middleware factory for handling OAuth errors
   * @param {string} context - Error context
   * @returns {Function} Express error middleware
   */
  middleware(context = 'oauth') {
    return (error, req, res, next) => {
      this.handleOAuthError(error, req, res, next, context);
    };
  }

  /**
   * Async wrapper for OAuth operations with error handling
   * @param {Function} operation - Async operation to wrap
   * @param {string} context - Error context
   * @returns {Function} Wrapped operation
   */
  wrapAsync(operation, context = 'oauth') {
    return async (req, res, next) => {
      try {
        await operation(req, res, next);
      } catch (error) {
        this.handleOAuthError(error, req, res, next, context);
      }
    };
  }

  /**
   * Check if error is retryable based on categorization
   * @param {Error} error - The error object
   * @param {string} context - Error context
   * @returns {Object} Retry information
   */
  getRetryInfo(error, context) {
    const errorResponse = this.categorizeError(error, context, 'temp');
    return {
      retryable: errorResponse.retryable || false,
      retryAfter: errorResponse.retryAfter || null
    };
  }
}

module.exports = new OAuthErrorHandler();