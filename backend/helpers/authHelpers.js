/**
 * Authentication Helper Module
 * Centralized utilities for authentication patterns and OAuth integration
 * Provides consistent helpers for token validation, error handling, and status checking
 */

const tokenManager = require('../services/tokenManager');
const oauthErrorHandler = require('../middleware/errorHandler');

class AuthHelpers {
  /**
   * Validate authentication and return standardized status
   * @param {Object} req - Express request object
   * @returns {Object} Authentication validation result
   */
  static validateAuthStatus(req) {
    try {
      const authStatus = tokenManager.getAuthStatus(req);
      const tokens = tokenManager.getTokens(req);
      
      return {
        valid: authStatus.authenticated,
        expired: authStatus.tokenExpired,
        athlete: authStatus.athlete,
        tokens: {
          hasAccessToken: !!tokens?.accessToken,
          hasRefreshToken: !!tokens?.refreshToken,
          expiresAt: tokens?.expiresAt,
          storedAt: tokens?.storedAt
        },
        session: {
          id: req.sessionID,
          valid: tokenManager.validateSession(req)
        }
      };
    } catch (error) {
      console.error('Auth status validation error:', error);
      return {
        valid: false,
        expired: true,
        error: error.message
      };
    }
  }

  /**
   * Get access token with validation
   * @param {Object} req - Express request object
   * @returns {Object} Access token result with validation info
   */
  static getValidatedAccessToken(req) {
    try {
      const accessToken = tokenManager.getAccessToken(req);
      const tokens = tokenManager.getTokens(req);
      
      if (!accessToken) {
        return {
          token: null,
          valid: false,
          reason: tokens ? 'expired' : 'missing'
        };
      }
      
      return {
        token: accessToken,
        valid: true,
        expiresAt: tokens?.expiresAt,
        timeUntilExpiry: tokens?.expiresAt ? tokens.expiresAt - Math.floor(Date.now() / 1000) : null
      };
    } catch (error) {
      console.error('Token validation error:', error);
      return {
        token: null,
        valid: false,
        reason: 'error',
        error: error.message
      };
    }
  }

  /**
   * Create standardized authentication response
   * @param {boolean} success - Whether authentication was successful
   * @param {Object} data - Additional data to include
   * @param {string} message - Response message
   * @returns {Object} Standardized auth response
   */
  static createAuthResponse(success, data = {}, message = null) {
    const response = {
      success,
      timestamp: new Date().toISOString(),
      ...data
    };
    
    if (message) {
      response.message = message;
    }
    
    return response;
  }

  /**
   * Create standardized error response for authentication failures
   * @param {string} errorCode - Error code for categorization
   * @param {string} message - Human-readable error message
   * @param {number} statusCode - HTTP status code
   * @param {Object} additionalData - Additional error context
   * @returns {Object} Standardized error response
   */
  static createAuthError(errorCode, message, statusCode = 401, additionalData = {}) {
    return {
      success: false,
      error: errorCode,
      message: message,
      statusCode: statusCode,
      timestamp: new Date().toISOString(),
      ...additionalData
    };
  }

  /**
   * Check if request requires token refresh
   * @param {Object} req - Express request object
   * @returns {Object} Refresh requirement analysis
   */
  static checkRefreshRequirement(req) {
    try {
      const tokens = tokenManager.getTokens(req);
      
      if (!tokens) {
        return { required: false, reason: 'no_tokens' };
      }
      
      const now = Math.floor(Date.now() / 1000);
      const timeUntilExpiry = tokens.expiresAt - now;
      const isExpired = timeUntilExpiry <= 0;
      const expiringSoon = timeUntilExpiry < 300; // 5 minutes
      
      return {
        required: isExpired || expiringSoon,
        reason: isExpired ? 'expired' : (expiringSoon ? 'expiring_soon' : 'valid'),
        timeUntilExpiry: timeUntilExpiry,
        expiresAt: tokens.expiresAt,
        hasRefreshToken: !!tokens.refreshToken
      };
    } catch (error) {
      console.error('Refresh requirement check error:', error);
      return {
        required: true,
        reason: 'error',
        error: error.message
      };
    }
  }

  /**
   * Validate OAuth callback parameters
   * @param {Object} query - Request query parameters
   * @param {Object} session - Request session
   * @returns {Object} Validation result
   */
  static validateOAuthCallback(query, session) {
    const errors = [];
    
    // Check for OAuth errors from Strava
    if (query.error) {
      errors.push({
        field: 'oauth_error',
        code: query.error,
        message: query.error_description || 'OAuth authorization failed'
      });
    }
    
    // Validate authorization code
    if (!query.code && !query.error) {
      errors.push({
        field: 'authorization_code',
        code: 'missing_code',
        message: 'No authorization code received'
      });
    }
    
    // Validate state parameter (CSRF protection)
    if (!query.state) {
      errors.push({
        field: 'state',
        code: 'missing_state',
        message: 'Missing CSRF protection parameter'
      });
    } else if (query.state !== session?.oauthState) {
      errors.push({
        field: 'state',
        code: 'state_mismatch',
        message: 'CSRF protection validation failed'
      });
    }
    
    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Create middleware for route-specific authentication requirements
   * @param {Object} options - Authentication options
   * @returns {Function} Express middleware
   */
  static createRouteAuthMiddleware(options = {}) {
    const {
      requireValid = true,
      allowExpired = false,
      customErrorHandler = null,
      logAccess = true
    } = options;
    
    return (req, res, next) => {
      if (logAccess) {
        console.log(`Auth check for ${req.method} ${req.path}:`, {
          sessionId: req.sessionID,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
      }
      
      const authStatus = AuthHelpers.validateAuthStatus(req);
      
      if (requireValid && !authStatus.valid) {
        const errorResponse = AuthHelpers.createAuthError(
          authStatus.expired ? 'token_expired' : 'authentication_required',
          authStatus.expired ? 'Access token has expired. Please re-authenticate.' : 'Authentication required for this endpoint.',
          401,
          { path: req.path, method: req.method }
        );
        
        if (customErrorHandler) {
          return customErrorHandler(errorResponse, req, res, next);
        }
        
        return res.status(401).json(errorResponse);
      }
      
      if (!allowExpired && authStatus.expired) {
        const errorResponse = AuthHelpers.createAuthError(
          'token_expired',
          'Access token has expired. Please re-authenticate.',
          401,
          { path: req.path, method: req.method }
        );
        
        if (customErrorHandler) {
          return customErrorHandler(errorResponse, req, res, next);
        }
        
        return res.status(401).json(errorResponse);
      }
      
      // Add auth helpers to request object
      req.authHelpers = {
        getValidatedToken: () => AuthHelpers.getValidatedAccessToken(req),
        checkRefreshNeeded: () => AuthHelpers.checkRefreshRequirement(req),
        getAuthStatus: () => authStatus
      };
      
      next();
    };
  }

  /**
   * Log authentication events for monitoring and debugging
   * @param {string} event - Event type
   * @param {Object} req - Express request object
   * @param {Object} additionalData - Additional event data
   */
  static logAuthEvent(event, req, additionalData = {}) {
    const logData = {
      event,
      timestamp: new Date().toISOString(),
      sessionId: req.sessionID,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method,
      ...additionalData
    };
    
    console.log(`Auth Event [${event}]:`, logData);
  }

  /**
   * Get comprehensive authentication summary for debugging
   * @param {Object} req - Express request object
   * @returns {Object} Complete auth summary
   */
  static getAuthSummary(req) {
    try {
      const authStatus = AuthHelpers.validateAuthStatus(req);
      const tokenStatus = AuthHelpers.getValidatedAccessToken(req);
      const refreshStatus = AuthHelpers.checkRefreshRequirement(req);
      
      return {
        timestamp: new Date().toISOString(),
        session: {
          id: req.sessionID,
          valid: authStatus.session?.valid || false
        },
        authentication: {
          valid: authStatus.valid,
          expired: authStatus.expired,
          athlete: authStatus.athlete
        },
        tokens: {
          access: {
            valid: tokenStatus.valid,
            expiresAt: tokenStatus.expiresAt,
            timeUntilExpiry: tokenStatus.timeUntilExpiry
          },
          refresh: {
            required: refreshStatus.required,
            reason: refreshStatus.reason,
            hasToken: refreshStatus.hasRefreshToken
          }
        }
      };
    } catch (error) {
      return {
        timestamp: new Date().toISOString(),
        error: 'Failed to generate auth summary',
        details: error.message
      };
    }
  }

  /**
   * Integration health check - validates all auth components working together
   * @param {Object} req - Express request object
   * @returns {Object} Integration health status
   */
  static performIntegrationHealthCheck(req) {
    const checks = {};
    
    try {
      // Check token manager integration
      checks.tokenManager = {
        status: 'ok',
        sessionValid: tokenManager.validateSession(req),
        hasTokens: !!tokenManager.getTokens(req)
      };
    } catch (error) {
      checks.tokenManager = {
        status: 'error',
        error: error.message
      };
    }
    
    try {
      // Check middleware chain
      checks.middleware = {
        status: 'ok',
        refreshAvailable: typeof req.authHelpers?.checkRefreshNeeded === 'function',
        authStatusAvailable: typeof req.auth !== 'undefined'
      };
    } catch (error) {
      checks.middleware = {
        status: 'error',
        error: error.message
      };
    }
    
    try {
      // Check route integration
      checks.routeIntegration = {
        status: 'ok',
        getAccessTokenAvailable: typeof req.getAccessToken === 'function',
        getRefreshTokenAvailable: typeof req.getRefreshToken === 'function'
      };
    } catch (error) {
      checks.routeIntegration = {
        status: 'error',
        error: error.message
      };
    }
    
    const hasErrors = Object.values(checks).some(check => check.status === 'error');
    
    return {
      overall: hasErrors ? 'degraded' : 'healthy',
      timestamp: new Date().toISOString(),
      checks
    };
  }
}

module.exports = AuthHelpers;