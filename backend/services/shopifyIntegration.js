const config = require('../config');
const tokenManager = require('./tokenManager');

const appConfig = config.getConfig();

/**
 * Shopify Integration Service
 * 
 * This service manages the integration between Strava authentication
 * and Shopify store sessions, ensuring user context is maintained
 * across the complete flow from authentication to product selection.
 */

class ShopifyIntegrationService {
  
  /**
   * Initialize user session for Shopify store integration
   * Called after successful Strava authentication
   */
  static initializeShopifySession(req, stravaUserData) {
    try {
      // Create Shopify session context with Strava user data
      req.session.shopifyIntegration = {
        initialized: true,
        initTimestamp: new Date().toISOString(),
        stravaUserId: stravaUserData.athlete.id,
        stravaUsername: stravaUserData.athlete.username,
        userDisplayName: stravaUserData.athlete.firstname || stravaUserData.athlete.username,
        sessionId: req.sessionID,
        // Store essential auth info for later use
        authStatus: 'authenticated',
        lastActivity: new Date().toISOString()
      };

      console.log('Shopify session initialized:', {
        stravaUserId: stravaUserData.athlete.id,
        sessionId: req.sessionID,
        timestamp: new Date().toISOString()
      });

      return req.session.shopifyIntegration;
    } catch (error) {
      console.error('Error initializing Shopify session:', error);
      throw new Error('Failed to initialize Shopify integration session');
    }
  }

  /**
   * Get current integration status for a user session
   */
  static getIntegrationStatus(req) {
    try {
      const authStatus = tokenManager.getAuthStatus(req);
      const shopifySession = req.session?.shopifyIntegration;
      
      const status = {
        isAuthenticated: authStatus.authenticated,
        hasShopifySession: !!shopifySession,
        canProceedToStore: authStatus.authenticated && !!shopifySession,
        stravaUserId: shopifySession?.stravaUserId || null,
        userDisplayName: shopifySession?.userDisplayName || null,
        sessionAge: shopifySession ? this.calculateSessionAge(shopifySession.initTimestamp) : null,
        lastActivity: shopifySession?.lastActivity || null
      };

      return status;
    } catch (error) {
      console.error('Error getting integration status:', error);
      return {
        isAuthenticated: false,
        hasShopifySession: false,
        canProceedToStore: false,
        error: error.message
      };
    }
  }

  /**
   * Generate secure redirect URL to Shopify store with user context
   */
  static generateShopifyRedirectUrl(req, destinationPath = '') {
    try {
      const integrationStatus = this.getIntegrationStatus(req);
      
      if (!integrationStatus.canProceedToStore) {
        throw new Error('User not authenticated or session not initialized for Shopify integration');
      }

      // Create secure parameters for Shopify redirect
      const redirectParams = new URLSearchParams({
        source: 'strava_auth',
        session_id: req.sessionID,
        user_id: integrationStatus.stravaUserId,
        timestamp: new Date().toISOString(),
        auth_status: 'verified'
      });

      const baseUrl = appConfig.shopify.storeUrl;
      const fullPath = destinationPath.startsWith('/') ? destinationPath : `/${destinationPath}`;
      const redirectUrl = `${baseUrl}${fullPath}?${redirectParams}`;

      console.log('Generated Shopify redirect URL:', {
        destinationPath,
        stravaUserId: integrationStatus.stravaUserId,
        sessionId: req.sessionID,
        redirectUrl
      });

      return redirectUrl;
    } catch (error) {
      console.error('Error generating Shopify redirect URL:', error);
      throw error;
    }
  }

  /**
   * Validate incoming request from Shopify store
   */
  static validateShopifyRequest(req) {
    try {
      const { source, session_id, user_id, timestamp, auth_status } = req.query;
      
      // Basic validation of required parameters
      if (!source || source !== 'strava_auth') {
        return { valid: false, reason: 'Invalid or missing source parameter' };
      }

      if (!session_id || session_id !== req.sessionID) {
        return { valid: false, reason: 'Session ID mismatch' };
      }

      if (!user_id) {
        return { valid: false, reason: 'Missing user ID' };
      }

      if (auth_status !== 'verified') {
        return { valid: false, reason: 'Authentication status not verified' };
      }

      // Validate session exists and matches
      const shopifySession = req.session?.shopifyIntegration;
      if (!shopifySession) {
        return { valid: false, reason: 'No Shopify integration session found' };
      }

      if (shopifySession.stravaUserId.toString() !== user_id) {
        return { valid: false, reason: 'User ID mismatch with session' };
      }

      // Check session age (reject if older than 1 hour)
      const sessionAge = this.calculateSessionAge(shopifySession.initTimestamp);
      if (sessionAge > 3600000) { // 1 hour in milliseconds
        return { valid: false, reason: 'Session expired' };
      }

      return {
        valid: true,
        sessionData: shopifySession,
        requestParams: { source, session_id, user_id, timestamp, auth_status }
      };
    } catch (error) {
      console.error('Error validating Shopify request:', error);
      return { valid: false, reason: 'Validation error: ' + error.message };
    }
  }

  /**
   * Update session activity timestamp
   */
  static updateSessionActivity(req) {
    try {
      if (req.session?.shopifyIntegration) {
        req.session.shopifyIntegration.lastActivity = new Date().toISOString();
      }
    } catch (error) {
      console.error('Error updating session activity:', error);
    }
  }

  /**
   * Clear Shopify integration session data
   */
  static clearShopifySession(req) {
    try {
      if (req.session?.shopifyIntegration) {
        delete req.session.shopifyIntegration;
        console.log('Shopify integration session cleared');
      }
    } catch (error) {
      console.error('Error clearing Shopify session:', error);
    }
  }

  /**
   * Generate session context for frontend use
   */
  static getSessionContextForFrontend(req) {
    try {
      const integrationStatus = this.getIntegrationStatus(req);
      const authStatus = tokenManager.getAuthStatus(req);

      return {
        authenticated: integrationStatus.isAuthenticated,
        shopifyReady: integrationStatus.canProceedToStore,
        user: {
          id: integrationStatus.stravaUserId,
          displayName: integrationStatus.userDisplayName,
          stravaConnected: authStatus.authenticated
        },
        session: {
          id: req.sessionID,
          age: integrationStatus.sessionAge,
          lastActivity: integrationStatus.lastActivity
        },
        shopify: {
          storeUrl: appConfig.shopify.storeUrl,
          integrationActive: integrationStatus.hasShopifySession
        }
      };
    } catch (error) {
      console.error('Error generating session context for frontend:', error);
      return {
        authenticated: false,
        shopifyReady: false,
        error: error.message
      };
    }
  }

  // Helper methods

  /**
   * Calculate session age in milliseconds
   */
  static calculateSessionAge(initTimestamp) {
    try {
      return new Date() - new Date(initTimestamp);
    } catch (error) {
      return 0;
    }
  }

  /**
   * Generate integration health report
   */
  static generateHealthReport(req) {
    try {
      const integrationStatus = this.getIntegrationStatus(req);
      const authStatus = tokenManager.getAuthStatus(req);

      return {
        status: integrationStatus.canProceedToStore ? 'healthy' : 'issues_detected',
        timestamp: new Date().toISOString(),
        checks: {
          strava_auth: authStatus.authenticated ? 'pass' : 'fail',
          session_initialized: integrationStatus.hasShopifySession ? 'pass' : 'fail',
          integration_ready: integrationStatus.canProceedToStore ? 'pass' : 'fail'
        },
        details: {
          authenticated: integrationStatus.isAuthenticated,
          shopify_session: integrationStatus.hasShopifySession,
          session_age_ms: integrationStatus.sessionAge,
          user_id: integrationStatus.stravaUserId,
          display_name: integrationStatus.userDisplayName
        },
        recommendations: this.generateHealthRecommendations(integrationStatus, authStatus)
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Generate health recommendations based on current state
   */
  static generateHealthRecommendations(integrationStatus, authStatus) {
    const recommendations = [];

    if (!authStatus.authenticated) {
      recommendations.push('User needs to authenticate with Strava first');
    }

    if (!integrationStatus.hasShopifySession && authStatus.authenticated) {
      recommendations.push('Shopify session needs to be initialized after Strava auth');
    }

    if (integrationStatus.sessionAge && integrationStatus.sessionAge > 3600000) {
      recommendations.push('Session is older than 1 hour - may need re-authentication');
    }

    if (integrationStatus.canProceedToStore) {
      recommendations.push('Integration is ready - user can proceed to Shopify store');
    }

    return recommendations;
  }
}

module.exports = ShopifyIntegrationService;