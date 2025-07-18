const express = require('express');
const router = express.Router();
const config = require('../config');

const appConfig = config.getConfig();

/**
 * Authentication routes for Strava OAuth integration
 * Handles the complete OAuth flow for Strava API access
 */

/**
 * Initiate Strava OAuth authorization
 * Redirects user to Strava authorization page
 */
router.get('/strava', (req, res) => {
  try {
    const authUrl = `https://www.strava.com/oauth/authorize?` +
      `client_id=${appConfig.strava.clientId}&` +
      `response_type=code&` +
      `redirect_uri=${encodeURIComponent(appConfig.strava.redirectUri)}&` +
      `approval_prompt=force&` +
      `scope=read,activity:read_all`;

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
 */
router.get('/strava/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    console.error('Strava OAuth error:', error);
    return res.status(400).json({ 
      error: 'Authentication failed',
      message: 'User denied access or authentication error occurred'
    });
  }

  if (!code) {
    return res.status(400).json({ 
      error: 'Missing authorization code',
      message: 'No authorization code received from Strava'
    });
  }

  try {
    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: appConfig.strava.clientId,
        client_secret: appConfig.strava.clientSecret,
        code: code,
        grant_type: 'authorization_code'
      })
    });

    if (!tokenResponse.ok) {
      throw new Error(`Token exchange failed: ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();

    // Store authentication data in session
    req.session.strava = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: tokenData.expires_at,
      athlete: tokenData.athlete
    };

    req.session.isAuthenticated = true;

    // Redirect to success page or return JSON for API clients
    if (req.query.format === 'json') {
      res.json({
        success: true,
        message: 'Authentication successful',
        athlete: {
          id: tokenData.athlete.id,
          username: tokenData.athlete.username,
          firstname: tokenData.athlete.firstname,
          lastname: tokenData.athlete.lastname
        }
      });
    } else {
      // Redirect to frontend success page
      res.redirect(`${appConfig.cors.origin}/auth/success`);
    }

  } catch (error) {
    console.error('Error during token exchange:', error);
    res.status(500).json({ 
      error: 'Authentication failed',
      message: 'Failed to complete authentication with Strava'
    });
  }
});

/**
 * Check authentication status
 * Returns current authentication state and athlete info
 */
router.get('/status', (req, res) => {
  if (!req.session.isAuthenticated || !req.session.strava) {
    return res.json({
      authenticated: false,
      message: 'Not authenticated'
    });
  }

  // Check if token is expired
  const now = Math.floor(Date.now() / 1000);
  const isExpired = req.session.strava.expiresAt <= now;

  res.json({
    authenticated: !isExpired,
    tokenExpired: isExpired,
    athlete: req.session.strava.athlete ? {
      id: req.session.strava.athlete.id,
      username: req.session.strava.athlete.username,
      firstname: req.session.strava.athlete.firstname,
      lastname: req.session.strava.athlete.lastname
    } : null
  });
});

/**
 * Logout user
 * Clears session data and revokes Strava access token
 */
router.post('/logout', async (req, res) => {
  try {
    // Revoke Strava access token if available
    if (req.session.strava?.accessToken) {
      try {
        await fetch('https://www.strava.com/oauth/deauthorize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            access_token: req.session.strava.accessToken
          })
        });
      } catch (revokeError) {
        // Log but don't fail logout if revocation fails
        console.warn('Failed to revoke Strava token:', revokeError);
      }
    }

    // Clear session
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session:', err);
        return res.status(500).json({ 
          error: 'Logout failed',
          message: 'Failed to clear session data'
        });
      }

      res.clearCookie('connect.sid'); // Clear session cookie
      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    });

  } catch (error) {
    console.error('Error during logout:', error);
    res.status(500).json({ 
      error: 'Logout failed',
      message: 'An error occurred during logout'
    });
  }
});

/**
 * Middleware to check if user is authenticated
 * Use this to protect routes that require authentication
 */
const requireAuth = (req, res, next) => {
  if (!req.session.isAuthenticated || !req.session.strava) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Please authenticate with Strava to access this resource'
    });
  }

  // Check if token is expired
  const now = Math.floor(Date.now() / 1000);
  if (req.session.strava.expiresAt <= now) {
    return res.status(401).json({
      error: 'Token expired',
      message: 'Strava access token has expired. Please re-authenticate.'
    });
  }

  next();
};

// Export the router and middleware
module.exports = router;
module.exports.requireAuth = requireAuth;