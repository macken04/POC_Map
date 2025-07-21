const express = require('express');
const router = express.Router();
const ShopifyIntegrationService = require('../services/shopifyIntegration');
const sessionSecurity = require('../middleware/sessionSecurity');
const { requireAuth } = require('./auth');

/**
 * Shopify Integration Routes
 * 
 * These routes handle the integration between Strava authentication
 * and Shopify store sessions, managing user context and redirects.
 */

/**
 * Get current integration status
 * Returns the status of Strava auth and Shopify session integration
 */
router.get('/status', sessionSecurity.validateSession(), (req, res) => {
  try {
    const status = ShopifyIntegrationService.getIntegrationStatus(req);
    
    res.json({
      success: true,
      status: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting integration status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get integration status',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Initialize Shopify session after Strava authentication
 * This endpoint is called automatically after successful Strava OAuth
 */
router.post('/initialize', requireAuth, (req, res) => {
  try {
    // Get current auth status to extract user data
    const authStatus = require('../services/tokenManager').getAuthStatus(req);
    
    if (!authStatus.authenticated || !authStatus.athlete) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated with Strava',
        message: 'User must complete Strava authentication first'
      });
    }

    // Initialize Shopify session with Strava user data
    const shopifySession = ShopifyIntegrationService.initializeShopifySession(req, {
      athlete: authStatus.athlete
    });

    console.log('Shopify integration initialized:', {
      stravaUserId: authStatus.athlete.id,
      sessionId: req.sessionID,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Shopify integration session initialized',
      session: shopifySession,
      user: {
        id: authStatus.athlete.id,
        displayName: authStatus.athlete.firstname || authStatus.athlete.username
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error initializing Shopify integration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initialize Shopify integration',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Generate redirect URL to Shopify store
 * Creates a secure redirect URL with user context preserved
 */
router.get('/redirect-url', requireAuth, (req, res) => {
  try {
    const destinationPath = req.query.path || '';
    
    const redirectUrl = ShopifyIntegrationService.generateShopifyRedirectUrl(req, destinationPath);
    
    res.json({
      success: true,
      redirectUrl: redirectUrl,
      message: 'Redirect URL generated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating redirect URL:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate redirect URL',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Handle redirect from Shopify store
 * Validates the incoming request and provides session context
 */
router.get('/validate-shopify-request', sessionSecurity.validateSession(), (req, res) => {
  try {
    const validation = ShopifyIntegrationService.validateShopifyRequest(req);
    
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Shopify request',
        reason: validation.reason,
        timestamp: new Date().toISOString()
      });
    }

    // Update session activity
    ShopifyIntegrationService.updateSessionActivity(req);

    res.json({
      success: true,
      message: 'Shopify request validated successfully',
      validation: validation,
      sessionContext: ShopifyIntegrationService.getSessionContextForFrontend(req),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error validating Shopify request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate Shopify request',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Get session context for frontend use
 * Returns current session state and user information
 */
router.get('/session-context', sessionSecurity.validateSession(), (req, res) => {
  try {
    const sessionContext = ShopifyIntegrationService.getSessionContextForFrontend(req);
    
    res.json({
      success: true,
      context: sessionContext,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting session context:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get session context',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Clear Shopify integration session
 * Removes Shopify-specific session data while preserving Strava auth
 */
router.post('/clear-session', sessionSecurity.validateSession(), (req, res) => {
  try {
    ShopifyIntegrationService.clearShopifySession(req);
    
    res.json({
      success: true,
      message: 'Shopify integration session cleared',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error clearing Shopify session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear Shopify session',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Integration health check
 * Comprehensive health report for the Strava-Shopify integration
 */
router.get('/health', (req, res) => {
  try {
    const healthReport = ShopifyIntegrationService.generateHealthReport(req);
    
    const statusCode = healthReport.status === 'healthy' ? 200 : 
                      healthReport.status === 'error' ? 500 : 206;
    
    res.status(statusCode).json({
      success: healthReport.status !== 'error',
      health: healthReport,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating integration health report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate health report',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Complete integration flow endpoint
 * Handles the complete flow from Strava auth to Shopify redirect
 */
router.post('/complete-flow', requireAuth, (req, res) => {
  try {
    const { destinationPath } = req.body;
    
    // Get auth status to ensure user is authenticated
    const authStatus = require('../services/tokenManager').getAuthStatus(req);
    
    if (!authStatus.authenticated) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'User must be authenticated with Strava'
      });
    }

    // Initialize Shopify session if not already done
    let shopifySession = req.session?.shopifyIntegration;
    if (!shopifySession) {
      shopifySession = ShopifyIntegrationService.initializeShopifySession(req, {
        athlete: authStatus.athlete
      });
    } else {
      // Update activity timestamp
      ShopifyIntegrationService.updateSessionActivity(req);
    }

    // Generate redirect URL
    const redirectUrl = ShopifyIntegrationService.generateShopifyRedirectUrl(req, destinationPath);
    
    console.log('Complete integration flow executed:', {
      stravaUserId: authStatus.athlete.id,
      destinationPath,
      redirectUrl,
      sessionId: req.sessionID,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Integration flow completed successfully',
      redirectUrl: redirectUrl,
      user: {
        id: authStatus.athlete.id,
        displayName: authStatus.athlete.firstname || authStatus.athlete.username
      },
      session: {
        id: req.sessionID,
        initialized: true
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error completing integration flow:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete integration flow',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;