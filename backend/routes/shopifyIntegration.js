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

// Add debugging middleware specifically for shopify integration routes
router.use((req, res, next) => {
  console.log(`[Shopify Integration] ${req.method} ${req.path}`, {
    origin: req.get('Origin'),
    referer: req.get('Referer'),
    userAgent: req.get('User-Agent'),
    sessionID: req.sessionID
  });
  next();
});

/**
 * Get current integration status
 * Returns the status of Strava auth and Shopify session integration
 * Note: Removed sessionSecurity middleware to avoid CORS conflicts
 */
router.get('/status', (req, res) => {
  try {
    console.log('[Shopify Integration] Status endpoint called');
    console.log('[Shopify Integration] Session ID:', req.sessionID);
    console.log('[Shopify Integration] Session data:', req.session);
    console.log('[Shopify Integration] Headers received:', {
      origin: req.get('Origin'),
      referer: req.get('Referer'),
      userAgent: req.get('User-Agent'),
      cookie: req.get('Cookie')
    });
    
    const status = ShopifyIntegrationService.getIntegrationStatus(req);
    console.log('[Shopify Integration] Status result:', status);
    
    const response = {
      success: true,
      status: status,
      timestamp: new Date().toISOString()
    };
    
    console.log('[Shopify Integration] Sending response:', response);
    res.json(response);
  } catch (error) {
    console.error('[Shopify Integration] Error getting integration status:', error);
    console.error('[Shopify Integration] Error stack:', error.stack);
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
    console.log('[Shopify Integration] Initialize endpoint called');
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
    console.log('[Shopify Integration] Redirect URL endpoint called');
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
 * Note: Removed sessionSecurity middleware to avoid CORS conflicts
 */
router.get('/validate-shopify-request', (req, res) => {
  try {
    console.log('[Shopify Integration] Validate Shopify request endpoint called');
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
 * Note: Removed sessionSecurity middleware to avoid CORS conflicts
 */
router.get('/session-context', (req, res) => {
  try {
    console.log('[Shopify Integration] Session context endpoint called');
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
 * Note: Removed sessionSecurity middleware to avoid CORS conflicts
 */
router.post('/clear-session', (req, res) => {
  try {
    console.log('[Shopify Integration] Clear session endpoint called');
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
 * Simple test endpoint for CORS debugging
 * No authentication or session middleware - just basic response
 */
router.get('/test-cors', (req, res) => {
  console.log('[Shopify Integration] CORS test endpoint called');
  console.log('[Shopify Integration] Request headers:', req.headers);
  
  res.json({
    success: true,
    message: 'CORS test successful',
    timestamp: new Date().toISOString(),
    requestInfo: {
      method: req.method,
      path: req.path,
      origin: req.get('Origin'),
      userAgent: req.get('User-Agent'),
      sessionID: req.sessionID
    }
  });
});

/**
 * Ultra simple test endpoint - minimal response
 */
router.get('/test-simple', (req, res) => {
  console.log('[Shopify Integration] Simple test called from:', req.get('Origin'));
  res.json({ ok: true });
});

/**
 * Integration health check
 * Comprehensive health report for the Strava-Shopify integration
 */
router.get('/health', (req, res) => {
  try {
    console.log('[Shopify Integration] Health check endpoint called');
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
    console.log('[Shopify Integration] Complete flow endpoint called');
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