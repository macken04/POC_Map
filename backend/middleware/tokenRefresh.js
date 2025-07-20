/**
 * Token Refresh Middleware
 * Automatically refreshes expired Strava tokens before API calls
 * Enhanced with timeout handling and retry logic
 */

const tokenManager = require('../services/tokenManager');
const RetryUtils = require('../utils/retryUtils');
const oauthErrorHandler = require('./errorHandler');

/**
 * Middleware to check and refresh expired tokens before API calls
 * Enhanced with comprehensive error handling and retry logic
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object  
 * @param {Function} next - Express next function
 */
async function refreshTokenIfNeeded(req, res, next) {
  try {
    // Only check if user is authenticated
    if (!tokenManager.isAuthenticated(req)) {
      return next();
    }

    const authStatus = tokenManager.getAuthStatus(req);
    
    // If token is expired or expiring soon (within 5 minutes), try to refresh
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = authStatus.expiresAt;
    const timeUntilExpiry = expiresAt - now;
    const shouldRefresh = authStatus.tokenExpired || timeUntilExpiry < 300; // 5 minutes

    if (shouldRefresh) {
      console.log('Token refresh needed:', {
        expired: authStatus.tokenExpired,
        timeUntilExpiry: timeUntilExpiry,
        sessionId: req.sessionID,
        timestamp: new Date().toISOString()
      });
      
      // Perform token refresh with retry logic
      const refreshOperation = async () => {
        const refreshSuccess = await tokenManager.refreshAccessToken(req);
        
        if (!refreshSuccess) {
          const refreshError = new Error('Token refresh operation failed');
          refreshError.code = 'refresh_failed';
          refreshError.status = 401;
          throw refreshError;
        }
        
        return refreshSuccess;
      };

      try {
        await RetryUtils.tokenOperationWithRetry(refreshOperation, {
          maxRetries: 2,
          baseDelay: 1000
        });
        
        console.log('Token refresh successful:', {
          sessionId: req.sessionID,
          timestamp: new Date().toISOString()
        });
        
      } catch (refreshError) {
        console.error('Token refresh failed after retries:', {
          error: refreshError.message,
          sessionId: req.sessionID,
          timestamp: new Date().toISOString()
        });
        
        // Clear tokens and require re-authentication
        tokenManager.clearTokens(req);
        
        // Use error handler for consistent error response
        return oauthErrorHandler.handleOAuthError(refreshError, req, res, next, 'token_refresh');
      }
    }

    next();
    
  } catch (error) {
    console.error('Token refresh middleware error:', {
      error: error.message,
      sessionId: req.sessionID,
      timestamp: new Date().toISOString()
    });
    
    // Handle unexpected errors in the middleware
    oauthErrorHandler.handleOAuthError(error, req, res, next, 'token_refresh_middleware');
  }
}

/**
 * Enhanced middleware with circuit breaker pattern for high-failure scenarios
 * @param {Object} options - Circuit breaker options
 * @returns {Function} Enhanced middleware function
 */
function createRobustTokenRefresh(options = {}) {
  const circuitBreaker = RetryUtils.createCircuitBreaker({
    failureThreshold: 3,
    recoveryTimeout: 300000, // 5 minutes
    ...options
  });

  return async (req, res, next) => {
    try {
      await circuitBreaker.execute(async () => {
        return new Promise((resolve, reject) => {
          refreshTokenIfNeeded(req, res, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      });
    } catch (error) {
      console.error('Circuit breaker prevented token refresh:', {
        error: error.message,
        circuitState: circuitBreaker.getState(),
        sessionId: req.sessionID,
        timestamp: new Date().toISOString()
      });
      
      // If circuit is open, provide different error message
      if (error.message.includes('Circuit breaker is OPEN')) {
        const circuitError = new Error('Token refresh service is temporarily unavailable. Please try again later.');
        circuitError.code = 'service_unavailable';
        circuitError.status = 503;
        oauthErrorHandler.handleOAuthError(circuitError, req, res, next, 'circuit_breaker');
      } else {
        oauthErrorHandler.handleOAuthError(error, req, res, next, 'token_refresh');
      }
    }
  };
}

module.exports = {
  refreshTokenIfNeeded,
  createRobustTokenRefresh
};