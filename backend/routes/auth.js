const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const config = require('../config');
const tokenManager = require('../services/tokenManager');
const sessionSecurity = require('../middleware/sessionSecurity');
const oauthErrorHandler = require('../middleware/errorHandler');
const RetryUtils = require('../utils/retryUtils');
const ErrorPageTemplates = require('../templates/errorPages');
const rateLimitManager = require('../middleware/rateLimiting');

const appConfig = config.getConfig();

/**
 * Authentication routes for Strava OAuth integration
 * Handles the complete OAuth flow for Strava API access
 */

/**
 * Error page route for OAuth errors
 * Displays user-friendly error pages for browser flows
 */
router.get('/error', ErrorPageTemplates.errorPageHandler);

/**
 * Initiate Strava OAuth authorization
 * Redirects user to Strava authorization page
 */
router.get('/strava', rateLimitManager.createOAuthRateLimit(), (req, res) => {
  try {
    // Generate CSRF protection state parameter
    const state = crypto.randomBytes(32).toString('hex');
    
    // Store state in session for validation
    req.session.oauthState = state;
    
    const authUrl = `https://www.strava.com/oauth/authorize?` +
      `client_id=${appConfig.strava.clientId}&` +
      `response_type=code&` +
      `redirect_uri=${encodeURIComponent(appConfig.strava.redirectUri)}&` +
      `approval_prompt=force&` +
      `scope=read,activity:read_all&` +
      `state=${state}`;

    res.redirect(authUrl);
  } catch (error) {
    console.error('Error initiating Strava OAuth:', error);
    res.status(500).json({ 
      error: 'Failed to initiate authentication',
      message: 'Unable to redirect to Strava authorization'
    });
  }
});

/**
 * Handle Strava OAuth callback
 * Exchanges authorization code for access token and stores in session
 * Enhanced with comprehensive error handling and retry logic
 */
router.get('/strava/callback', rateLimitManager.createOAuthRateLimit(), oauthErrorHandler.wrapAsync(async (req, res) => {
  const { code, error, state, error_description } = req.query;

  // Handle explicit OAuth errors from Strava
  if (error) {
    const errorMessages = {
      'access_denied': 'You cancelled the authorization. To use this service, you need to grant access to your Strava account.',
      'invalid_request': 'Invalid authorization request. Please try logging in again.',
      'unsupported_response_type': 'Authentication configuration error. Please contact support.',
      'invalid_scope': 'Invalid permissions requested. Please contact support.',
      'server_error': 'Strava is temporarily unavailable. Please try again in a few minutes.',
      'temporarily_unavailable': 'Strava authentication is temporarily unavailable. Please try again later.'
    };

    const userMessage = errorMessages[error] || 'Authentication failed. Please try again.';
    
    const authError = new Error(userMessage);
    authError.code = error;
    authError.description = error_description;
    authError.status = error === 'access_denied' ? 400 : 503;
    
    throw authError;
  }

  // Validate authorization code presence
  if (!code || typeof code !== 'string' || code.length === 0) {
    const missingCodeError = new Error('No authorization code received from Strava');
    missingCodeError.code = 'missing_authorization_code';
    missingCodeError.status = 400;
    throw missingCodeError;
  }

  // Validate CSRF protection state parameter
  if (!state || typeof state !== 'string') {
    const missingStateError = new Error('Missing security validation parameter');
    missingStateError.code = 'missing_state';
    missingStateError.status = 400;
    throw missingStateError;
  }

  if (state !== req.session.oauthState) {
    console.error('OAuth state mismatch:', { 
      received: state, 
      expected: req.session.oauthState,
      sessionId: req.sessionID,
      ip: req.ip 
    });
    
    const stateError = new Error('Security validation failed. Possible CSRF attack detected.');
    stateError.code = 'state_mismatch';
    stateError.status = 400;
    throw stateError;
  }

  // Clear the state from session after validation
  delete req.session.oauthState;

  // Token exchange operation with retry logic
  const tokenExchangeOperation = async () => {
    const response = await RetryUtils.fetchWithRetry('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'PrintMyRide/1.0'
      },
      timeout: 15000, // 15 second timeout
      body: JSON.stringify({
        client_id: appConfig.strava.clientId,
        client_secret: appConfig.strava.clientSecret,
        code: code,
        grant_type: 'authorization_code'
      })
    }, {
      maxRetries: 2,
      baseDelay: 1000
    });

    const tokenData = await response.json();

    // Validate token response structure
    if (!tokenData.access_token || !tokenData.refresh_token || !tokenData.athlete) {
      const invalidResponseError = new Error('Invalid token response from Strava');
      invalidResponseError.code = 'invalid_token_response';
      invalidResponseError.status = 502;
      throw invalidResponseError;
    }

    return tokenData;
  };

  // Execute token exchange with comprehensive error handling
  const tokenData = await tokenExchangeOperation();

  // Store authentication data securely using token manager
  const tokenDataForStorage = {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresAt: tokenData.expires_at,
    athlete: tokenData.athlete,
    scope: tokenData.scope,
    tokenType: tokenData.token_type || 'Bearer'
  };

  try {
    await tokenManager.storeTokens(req, tokenDataForStorage);
  } catch (storageError) {
    console.error('Token storage failed:', storageError);
    const tokenStorageError = new Error('Failed to securely store authentication tokens');
    tokenStorageError.code = 'token_storage_failed';
    tokenStorageError.status = 500;
    throw tokenStorageError;
  }

  // Successful authentication response
  const athleteInfo = {
    id: tokenData.athlete.id,
    username: tokenData.athlete.username,
    firstname: tokenData.athlete.firstname,
    lastname: tokenData.athlete.lastname
  };

  // Log successful authentication for monitoring
  console.log('Successful OAuth authentication:', {
    athleteId: tokenData.athlete.id,
    username: tokenData.athlete.username,
    scope: tokenData.scope,
    sessionId: req.sessionID,
    timestamp: new Date().toISOString()
  });

  // Return appropriate response based on request format
  if (req.query.format === 'json') {
    res.json({
      success: true,
      message: 'Authentication successful',
      athlete: athleteInfo,
      timestamp: new Date().toISOString()
    });
  } else {
    // Redirect to frontend success page with success parameters
    const successParams = new URLSearchParams({
      success: 'true',
      athlete: athleteInfo.firstname || athleteInfo.username || 'Athlete'
    });
    
    res.redirect(`${appConfig.cors.origin}/auth/success?${successParams}`);
  }
}, 'token_exchange'));

/**
 * Check authentication status
 * Returns current authentication state and athlete info
 */
router.get('/status', sessionSecurity.validateSession(), (req, res) => {
  const authStatus = tokenManager.getAuthStatus(req);
  res.json(authStatus);
});

/**
 * Logout user
 * Clears session data and revokes Strava access token
 * Enhanced with comprehensive error handling and retry logic
 */
router.post('/logout', sessionSecurity.validateSession(), oauthErrorHandler.wrapAsync(async (req, res) => {
  const sessionId = req.sessionID;
  const accessToken = tokenManager.getAccessToken(req);
  
  // Log logout attempt for monitoring
  console.log('Logout attempt:', {
    sessionId,
    hasAccessToken: !!accessToken,
    timestamp: new Date().toISOString()
  });

  // Revoke Strava access token if available (best effort, don't fail logout)
  if (accessToken) {
    try {
      await RetryUtils.fetchWithRetry('https://www.strava.com/oauth/deauthorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'PrintMyRide/1.0'
        },
        timeout: 10000, // 10 second timeout for revocation
        body: JSON.stringify({
          access_token: accessToken
        })
      }, {
        maxRetries: 1, // Only one retry for revocation
        baseDelay: 1000
      });
      
      console.log('Successfully revoked Strava access token');
    } catch (revokeError) {
      // Log warning but don't fail logout if revocation fails
      console.warn('Failed to revoke Strava token:', {
        error: revokeError.message,
        sessionId,
        timestamp: new Date().toISOString()
      });
      // Continue with logout even if revocation fails
    }
  }

  // Clear tokens using token manager (critical - must succeed)
  try {
    tokenManager.clearTokens(req);
  } catch (tokenClearError) {
    console.error('Critical error clearing tokens:', tokenClearError);
    // Continue with session destruction anyway
  }

  // Clear session with proper error handling
  const destroySession = () => {
    return new Promise((resolve, reject) => {
      if (!req.session) {
        // Session already cleared or doesn't exist
        return resolve();
      }

      req.session.destroy((err) => {
        if (err) {
          console.error('Error destroying session:', {
            error: err.message,
            sessionId,
            timestamp: new Date().toISOString()
          });
          reject(err);
        } else {
          resolve();
        }
      });
    });
  };

  try {
    await destroySession();
    
    // Clear session cookie
    res.clearCookie('connect.sid', {
      path: '/',
      httpOnly: true,
      secure: appConfig.env === 'production',
      sameSite: 'lax'
    });

    // Log successful logout
    console.log('Successful logout:', {
      sessionId,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Logged out successfully',
      timestamp: new Date().toISOString()
    });

  } catch (sessionError) {
    // Even if session destruction fails, clear client-side data
    res.clearCookie('connect.sid', {
      path: '/',
      httpOnly: true,
      secure: appConfig.env === 'production',
      sameSite: 'lax'
    });

    console.error('Session destruction failed but cleared cookie:', {
      error: sessionError.message,
      sessionId,
      timestamp: new Date().toISOString()
    });

    // Return partial success - user is effectively logged out
    res.status(206).json({ // 206 Partial Content
      success: true,
      message: 'Logged out successfully (with minor cleanup issues)',
      warning: 'Some session data may not have been fully cleared',
      timestamp: new Date().toISOString()
    });
  }
}, 'logout'));

// Export the router and enhanced authentication middleware
module.exports = router;
module.exports.requireAuth = tokenManager.requireAuth();
module.exports.requireAuthWithSession = sessionSecurity.requireAuthWithSession();