/**
 * Session Security Middleware
 * Provides enhanced session security, validation, and management
 */

const tokenManager = require('../services/tokenManager');

class SessionSecurity {
  constructor() {
    this.sessionTimeout = 86400000; // 24 hours in milliseconds
    this.maxSessionAge = 604800000; // 7 days in milliseconds
  }

  /**
   * Enhanced session configuration middleware
   * Applies security headers and session settings
   */
  configureSession() {
    return (req, res, next) => {
      // Set security headers for session cookies
      if (req.session) {
        const isProduction = process.env.NODE_ENV === 'production';
        const isSecure = isProduction || req.headers['x-forwarded-proto'] === 'https';

        // Configure session cookie security
        req.session.cookie.secure = isSecure;
        req.session.cookie.httpOnly = true;
        req.session.cookie.sameSite = 'strict';
        
        // Set appropriate maxAge
        if (!req.session.cookie.maxAge) {
          req.session.cookie.maxAge = this.sessionTimeout;
        }
      }

      next();
    };
  }

  /**
   * Session validation middleware
   * Validates session integrity and handles security checks
   */
  validateSession() {
    return (req, res, next) => {
      if (!req.session) {
        return res.status(500).json({
          error: 'Session not available',
          message: 'Session middleware not properly configured'
        });
      }

      // Check session age
      if (req.session.createdAt) {
        const sessionAge = Date.now() - req.session.createdAt;
        if (sessionAge > this.maxSessionAge) {
          console.log('Session too old, destroying:', req.sessionID);
          return this.destroySessionAndRespond(req, res, 'Session expired due to age');
        }
      } else {
        // Set creation time for new sessions
        req.session.createdAt = Date.now();
      }

      // Update last activity
      req.session.lastActivity = Date.now();

      // Validate session consistency
      if (!tokenManager.validateSession(req)) {
        console.log('Session validation failed:', req.sessionID);
        return this.destroySessionAndRespond(req, res, 'Session validation failed');
      }

      next();
    };
  }

  /**
   * Session rotation middleware for security-sensitive operations
   * Regenerates session after sensitive operations like login
   */
  rotateSession() {
    return async (req, res, next) => {
      if (req.session) {
        try {
          await tokenManager.regenerateSession(req);
          console.log('Session rotated for security:', req.sessionID);
        } catch (error) {
          console.error('Session rotation failed:', error);
          return res.status(500).json({
            error: 'Session rotation failed',
            message: 'Unable to secure session'
          });
        }
      }
      next();
    };
  }

  /**
   * Session cleanup middleware
   * Handles proper cleanup of session data
   */
  cleanupSession() {
    return (req, res, next) => {
      // Add cleanup function to response locals
      res.locals.cleanupSession = () => {
        if (req.session) {
          tokenManager.clearTokens(req);
          
          // Clear sensitive session data
          const sensitiveKeys = ['oauthState', 'tempData', 'sensitiveInfo'];
          sensitiveKeys.forEach(key => {
            if (req.session[key]) {
              delete req.session[key];
            }
          });
        }
      };

      next();
    };
  }

  /**
   * CSRF protection middleware for forms and state changes
   * Validates CSRF tokens for state-changing operations
   */
  csrfProtection() {
    return (req, res, next) => {
      // Skip CSRF for GET requests and API calls that don't change state
      if (req.method === 'GET' || req.path.startsWith('/api/status')) {
        return next();
      }

      // Check for CSRF token in various locations
      const token = req.body.csrfToken || 
                   req.headers['x-csrf-token'] || 
                   req.headers['csrf-token'];

      const sessionToken = req.session.csrfToken;

      if (!token || !sessionToken || token !== sessionToken) {
        return res.status(403).json({
          error: 'CSRF validation failed',
          message: 'Invalid or missing CSRF token'
        });
      }

      next();
    };
  }

  /**
   * Rate limiting middleware for session-based operations
   * Prevents rapid session creation/destruction attacks
   */
  rateLimitSessions() {
    const attempts = new Map();
    const maxAttempts = 10;
    const windowMs = 900000; // 15 minutes

    return (req, res, next) => {
      const clientIP = req.ip || req.connection.remoteAddress;
      const now = Date.now();
      const windowStart = now - windowMs;

      // Clean old entries
      for (const [ip, data] of attempts) {
        if (data.lastAttempt < windowStart) {
          attempts.delete(ip);
        }
      }

      // Check current client
      const clientData = attempts.get(clientIP) || { count: 0, lastAttempt: 0 };
      
      if (clientData.lastAttempt > windowStart) {
        if (clientData.count >= maxAttempts) {
          return res.status(429).json({
            error: 'Too many requests',
            message: 'Session rate limit exceeded. Please wait before trying again.'
          });
        }
        clientData.count++;
      } else {
        clientData.count = 1;
      }

      clientData.lastAttempt = now;
      attempts.set(clientIP, clientData);

      next();
    };
  }

  /**
   * Session monitoring middleware
   * Logs session activity for security monitoring
   */
  monitorSession() {
    return (req, res, next) => {
      if (req.session) {
        const sessionInfo = {
          sessionId: req.sessionID,
          userAgent: req.headers['user-agent'],
          ip: req.ip,
          path: req.path,
          method: req.method,
          authenticated: tokenManager.isAuthenticated(req),
          timestamp: new Date().toISOString()
        };

        // Log suspicious activity
        if (this.isSuspiciousActivity(req, sessionInfo)) {
          console.warn('Suspicious session activity detected:', sessionInfo);
        }

        // Store session metadata for tracking
        req.session.metadata = {
          userAgent: req.headers['user-agent'],
          lastIP: req.ip,
          lastPath: req.path,
          requestCount: (req.session.metadata?.requestCount || 0) + 1
        };
      }

      next();
    };
  }

  /**
   * Detect suspicious session activity
   * @param {Object} req - Express request object
   * @param {Object} sessionInfo - Session information
   * @returns {boolean} True if activity is suspicious
   */
  isSuspiciousActivity(req, sessionInfo) {
    const metadata = req.session.metadata;
    
    if (!metadata) {
      return false;
    }

    // Check for user agent changes
    if (metadata.userAgent && metadata.userAgent !== sessionInfo.userAgent) {
      return true;
    }

    // Check for IP changes (basic check)
    if (metadata.lastIP && metadata.lastIP !== sessionInfo.ip) {
      return true;
    }

    // Check for excessive requests
    if (metadata.requestCount > 1000) {
      return true;
    }

    return false;
  }

  /**
   * Destroy session and send appropriate response
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {string} reason - Reason for session destruction
   */
  destroySessionAndRespond(req, res, reason) {
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session:', err);
      }
      
      res.clearCookie('connect.sid');
      res.status(401).json({
        error: 'Session invalid',
        message: reason,
        requiresAuthentication: true
      });
    });
  }

  /**
   * Session health check middleware
   * Provides session status information
   */
  sessionHealthCheck() {
    return (req, res, next) => {
      if (req.path === '/session/health') {
        const health = {
          hasSession: !!req.session,
          sessionId: req.sessionID,
          authenticated: tokenManager.isAuthenticated(req),
          sessionAge: req.session?.createdAt ? Date.now() - req.session.createdAt : 0,
          lastActivity: req.session?.lastActivity || 0,
          requestCount: req.session?.metadata?.requestCount || 0,
          tokenStats: tokenManager.getTokenStats(req)
        };

        return res.json({
          status: 'healthy',
          session: health,
          timestamp: new Date().toISOString()
        });
      }
      next();
    };
  }

  /**
   * Get all session security middleware as array
   * @returns {Array} Array of middleware functions
   */
  getAllMiddleware() {
    return [
      this.configureSession(),
      this.validateSession(),
      this.cleanupSession(),
      this.monitorSession(),
      this.sessionHealthCheck()
    ];
  }

  /**
   * Get authentication middleware with session integration
   * @param {Object} options - Authentication options
   * @returns {Function} Combined authentication middleware
   */
  requireAuthWithSession(options = {}) {
    return [
      this.validateSession(),
      tokenManager.requireAuth(options)
    ];
  }
}

module.exports = new SessionSecurity();