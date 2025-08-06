/**
 * Token Manager Service
 * Abstracts token storage and retrieval operations with encryption
 * Provides high-level interface for secure token management
 */

const tokenService = require('./tokenService');

class TokenManager {
  constructor() {
    this.sessionTokenKey = 'encrypted_strava_tokens';
    this.sessionAuthKey = 'isAuthenticated';
  }

  /**
   * Store OAuth tokens securely in session
   * @param {Object} req - Express request object with session
   * @param {Object} tokenData - OAuth token data from Strava
   */
  async storeTokens(req, tokenData) {
    if (!req.session) {
      throw new Error('Session not available for token storage');
    }

    if (!tokenService.validateTokenData(tokenData)) {
      throw new Error('Invalid token data structure');
    }

    try {
      // Regenerate session for security before token storage (if available)
      if (req.session.regenerate) {
        await this.regenerateSession(req);
      }

      // Add timestamp for storage tracking (use current sessionID after regeneration)
      const tokenDataWithMeta = {
        ...tokenData,
        storedAt: Math.floor(Date.now() / 1000),
        sessionId: req.sessionID
      };

      // Encrypt and store tokens
      const encryptedTokens = tokenService.encryptTokens(tokenDataWithMeta);
      req.session[this.sessionTokenKey] = encryptedTokens;
      req.session[this.sessionAuthKey] = true;

      console.log('Tokens stored securely:', tokenService.sanitizeTokenData(tokenDataWithMeta));
    } catch (error) {
      console.error('Failed to store tokens:', error);
      throw new Error('Token storage failed');
    }
  }

  /**
   * Retrieve and decrypt OAuth tokens from session
   * @param {Object} req - Express request object with session
   * @returns {Object|null} Decrypted token data or null if not found
   */
  getTokens(req) {
    if (!req.session || !req.session[this.sessionTokenKey]) {
      return null;
    }

    try {
      const decryptedTokens = tokenService.decryptTokens(req.session[this.sessionTokenKey]);
      
      // Validate session consistency
      if (decryptedTokens.sessionId && decryptedTokens.sessionId !== req.sessionID) {
        console.warn('Session ID mismatch, clearing tokens for security');
        this.clearTokens(req);
        return null;
      }

      return decryptedTokens;
    } catch (error) {
      console.error('Failed to retrieve tokens:', error);
      this.clearTokens(req);
      return null;
    }
  }

  /**
   * Check if user has valid authentication
   * @param {Object} req - Express request object with session
   * @returns {boolean} True if authenticated with valid tokens
   */
  isAuthenticated(req) {
    if (!req.session || !req.session[this.sessionAuthKey]) {
      return false;
    }

    const tokens = this.getTokens(req);
    if (!tokens) {
      return false;
    }

    // Check if tokens are expired
    if (tokenService.isTokenExpired(tokens)) {
      console.log('Tokens expired, marking as unauthenticated');
      return false;
    }

    return true;
  }

  /**
   * Get authentication status with details
   * @param {Object} req - Express request object with session
   * @returns {Object} Authentication status and user info
   */
  getAuthStatus(req) {
    const tokens = this.getTokens(req);
    
    if (!tokens) {
      return {
        authenticated: false,
        message: 'Not authenticated'
      };
    }

    const isExpired = tokenService.isTokenExpired(tokens);
    
    return {
      authenticated: !isExpired,
      tokenExpired: isExpired,
      athlete: tokens.athlete ? {
        id: tokens.athlete.id,
        username: tokens.athlete.username,
        firstname: tokens.athlete.firstname,
        lastname: tokens.athlete.lastname
      } : null,
      storedAt: tokens.storedAt,
      expiresAt: tokens.expiresAt
    };
  }

  /**
   * Update existing tokens (e.g., after refresh)
   * @param {Object} req - Express request object with session
   * @param {Object} newTokenData - Updated token data
   */
  async updateTokens(req, newTokenData) {
    const existingTokens = this.getTokens(req);
    
    if (!existingTokens) {
      throw new Error('No existing tokens to update');
    }

    // Merge with existing data, preserving athlete info
    const mergedTokenData = {
      ...existingTokens,
      ...newTokenData,
      updatedAt: Math.floor(Date.now() / 1000)
    };

    await this.storeTokens(req, mergedTokenData);
    console.log('Tokens updated successfully');
  }

  /**
   * Clear all authentication data from session
   * @param {Object} req - Express request object with session
   */
  clearTokens(req) {
    if (req.session) {
      // Get encrypted tokens directly to avoid recursion
      const encryptedTokens = req.session[this.sessionTokenKey];
      if (encryptedTokens) {
        try {
          const tokens = tokenService.decryptTokens(encryptedTokens);
          tokenService.clearTokenData(tokens);
        } catch (error) {
          // Ignore decryption errors during cleanup
        }
      }

      delete req.session[this.sessionTokenKey];
      delete req.session[this.sessionAuthKey];
      
      console.log('Tokens cleared from session');
    }
  }

  /**
   * Regenerate session for security
   * @param {Object} req - Express request object with session
   * @returns {Promise} Promise that resolves when session is regenerated
   */
  regenerateSession(req) {
    return new Promise((resolve, reject) => {
      req.session.regenerate((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Validate session integrity
   * @param {Object} req - Express request object with session
   * @returns {boolean} True if session is valid
   */
  validateSession(req) {
    if (!req.session) {
      return false;
    }

    // Check if session has required properties
    if (!req.sessionID) {
      return false;
    }

    // If authenticated, ensure tokens exist and are valid
    if (req.session[this.sessionAuthKey]) {
      return !!this.getTokens(req);
    }

    return true;
  }

  /**
   * Get access token for API calls
   * @param {Object} req - Express request object with session
   * @returns {string|null} Access token or null if not available
   */
  getAccessToken(req) {
    const tokens = this.getTokens(req);
    if (!tokens || tokenService.isTokenExpired(tokens)) {
      return null;
    }
    return tokens.accessToken;
  }

  /**
   * Get refresh token for token renewal
   * @param {Object} req - Express request object with session
   * @returns {string|null} Refresh token or null if not available
   */
  getRefreshToken(req) {
    const tokens = this.getTokens(req);
    return tokens?.refreshToken || null;
  }

  /**
   * Refresh expired access token using refresh token
   * @param {Object} req - Express request object with session
   * @returns {Promise<boolean>} True if refresh successful
   */
  async refreshAccessToken(req) {
    const tokens = this.getTokens(req);
    
    if (!tokens || !tokens.refreshToken) {
      console.log('No refresh token available for token refresh');
      return false;
    }

    try {
      const config = require('../config').getConfig();
      const response = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: config.strava.clientId,
          client_secret: config.strava.clientSecret,
          refresh_token: tokens.refreshToken,
          grant_type: 'refresh_token'
        })
      });

      if (!response.ok) {
        console.error('Token refresh failed:', response.status);
        return false;
      }

      const newTokenData = await response.json();
      await this.updateTokens(req, {
        accessToken: newTokenData.access_token,
        refreshToken: newTokenData.refresh_token,
        expiresAt: newTokenData.expires_at
      });

      console.log('Access token refreshed successfully');
      return true;
    } catch (error) {
      console.error('Error refreshing access token:', error);
      return false;
    }
  }

  /**
   * Middleware factory for authentication checking
   * @param {Object} options - Options for auth middleware
   * @returns {Function} Express middleware function
   */
  requireAuth(options = {}) {
    const { 
      allowExpired = false,
      redirectUrl = null,
      errorMessage = 'Authentication required'
    } = options;

    return (req, res, next) => {
      // Check for cross-domain token authentication first
      const crossDomainToken = req.query.token || req.headers['x-session-token'];
      
      if (crossDomainToken) {
        // First check persistent token store
        const crossDomainTokenStore = require('./crossDomainTokenStore');
        const tokenData = crossDomainTokenStore.getTokenData(crossDomainToken);
        
        if (tokenData) {
          // Valid token from persistent store - extend it for ongoing operations
          crossDomainTokenStore.extendToken(crossDomainToken);
          
          // Valid token from persistent store - create auth status
          const authStatus = {
            authenticated: true,
            athlete: tokenData.athlete,
            crossDomain: true,
            tokenSource: 'persistent-store'
          };
          
          req.auth = authStatus;
          // For cross-domain, provide tokens from the token store
          req.getAccessToken = () => {
            if (tokenData.stravaTokens && tokenData.stravaTokens.accessToken) {
              return tokenData.stravaTokens.accessToken;
            }
            // Fallback to session
            return this.getAccessToken(req);
          };
          req.getRefreshToken = () => {
            if (tokenData.stravaTokens && tokenData.stravaTokens.refreshToken) {
              return tokenData.stravaTokens.refreshToken;
            }
            // Fallback to session
            return this.getRefreshToken(req);
          };
          
          return next();
        }
        
        // Fallback to session-based validation
        if (req.session && req.session.crossDomainToken === crossDomainToken &&
            req.session.crossDomainTokenExpiry > Date.now()) {
          
          // Valid cross-domain token - proceed with authentication
          const authStatus = this.getAuthStatus(req);
          
          if (!authStatus.authenticated) {
            return res.status(401).json({
              error: 'Token expired',
              message: 'Strava access token has expired. Please re-authenticate.'
            });
          }
          
          // Add auth info to request for use in routes
          req.auth = authStatus;
          req.getAccessToken = () => this.getAccessToken(req);
          req.getRefreshToken = () => this.getRefreshToken(req);
          
          return next();
        } else {
          // Invalid or expired cross-domain token
          return res.status(401).json({
            error: 'Invalid cross-domain token',
            message: 'Cross-domain token is invalid or expired. Please re-authenticate.'
          });
        }
      }
      
      // Fall back to standard session-based authentication
      if (!this.validateSession(req)) {
        return res.status(401).json({
          error: 'Invalid session',
          message: 'Session validation failed'
        });
      }

      const authStatus = this.getAuthStatus(req);
      
      if (!authStatus.authenticated) {
        if (authStatus.tokenExpired && !allowExpired) {
          return res.status(401).json({
            error: 'Token expired',
            message: 'Strava access token has expired. Please re-authenticate.'
          });
        }
        
        if (!authStatus.tokenExpired) {
          if (redirectUrl) {
            return res.redirect(redirectUrl);
          }
          
          return res.status(401).json({
            error: 'Authentication required',
            message: errorMessage
          });
        }
      }

      // Add auth info to request for use in routes
      req.auth = authStatus;
      req.getAccessToken = () => this.getAccessToken(req);
      req.getRefreshToken = () => this.getRefreshToken(req);
      
      next();
    };
  }

  /**
   * Get summary statistics for monitoring
   * @param {Object} req - Express request object with session
   * @returns {Object} Token statistics
   */
  getTokenStats(req) {
    const tokens = this.getTokens(req);
    
    if (!tokens) {
      return {
        hasTokens: false,
        authenticated: false
      };
    }

    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = tokens.expiresAt - now;
    const timeStoredAgo = now - (tokens.storedAt || now);

    return {
      hasTokens: true,
      authenticated: this.isAuthenticated(req),
      expired: tokenService.isTokenExpired(tokens),
      timeUntilExpiry: timeUntilExpiry,
      timeStoredAgo: timeStoredAgo,
      expiresAt: tokens.expiresAt,
      storedAt: tokens.storedAt,
      athlete: tokenService.sanitizeTokenData(tokens).athlete
    };
  }
}

module.exports = new TokenManager();