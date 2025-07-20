/**
 * Rate Limiting Middleware
 * Provides protection against excessive requests and Strava API rate limit handling
 */

const oauthErrorHandler = require('./errorHandler');

class RateLimitManager {
  constructor() {
    // In-memory storage for rate limiting (in production, use Redis)
    this.requestCounts = new Map();
    this.stravaRateLimits = new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Cleanup every minute
  }

  /**
   * Client-side rate limiting to prevent abuse
   * @param {Object} options - Rate limiting configuration
   * @returns {Function} Express middleware
   */
  createClientRateLimit(options = {}) {
    const config = {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 50, // requests per window
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      message: 'Too many requests from this IP, please try again later.',
      ...options
    };

    return (req, res, next) => {
      const clientId = this.getClientIdentifier(req);
      const now = Date.now();
      const windowStart = now - config.windowMs;

      // Get or create request history for this client
      if (!this.requestCounts.has(clientId)) {
        this.requestCounts.set(clientId, []);
      }

      const requests = this.requestCounts.get(clientId);
      
      // Remove old requests outside the window
      const validRequests = requests.filter(timestamp => timestamp > windowStart);
      
      // Check if limit exceeded
      if (validRequests.length >= config.maxRequests) {
        console.warn('Client rate limit exceeded:', {
          clientId,
          requestCount: validRequests.length,
          limit: config.maxRequests,
          windowMs: config.windowMs,
          timestamp: new Date().toISOString()
        });

        const rateLimitError = new Error(config.message);
        rateLimitError.code = 'client_rate_limited';
        rateLimitError.status = 429;
        rateLimitError.retryAfter = Math.ceil(config.windowMs / 1000);
        
        return oauthErrorHandler.handleOAuthError(rateLimitError, req, res, next, 'rate_limiting');
      }

      // Add current request
      validRequests.push(now);
      this.requestCounts.set(clientId, validRequests);

      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': config.maxRequests,
        'X-RateLimit-Remaining': Math.max(0, config.maxRequests - validRequests.length - 1),
        'X-RateLimit-Reset': new Date(now + config.windowMs).toISOString()
      });

      next();
    };
  }

  /**
   * OAuth-specific rate limiting (more restrictive)
   * @param {Object} options - OAuth rate limiting configuration
   * @returns {Function} Express middleware
   */
  createOAuthRateLimit(options = {}) {
    const config = {
      windowMs: 10 * 60 * 1000, // 10 minutes
      maxRequests: 10, // OAuth attempts per window
      message: 'Too many authentication attempts. Please wait before trying again.',
      ...options
    };

    return this.createClientRateLimit(config);
  }

  /**
   * Strava API rate limit tracking and handling
   * @param {Object} stravaResponse - Response from Strava API
   * @param {string} endpoint - API endpoint called
   */
  trackStravaRateLimit(stravaResponse, endpoint = 'unknown') {
    const rateLimitHeaders = {
      limit: stravaResponse.headers?.get('x-ratelimit-limit'),
      usage: stravaResponse.headers?.get('x-ratelimit-usage'),
      remaining: stravaResponse.headers?.get('x-ratelimit-remaining')
    };

    if (rateLimitHeaders.limit) {
      const rateLimitInfo = {
        ...rateLimitHeaders,
        endpoint,
        timestamp: Date.now(),
        resetTime: this.calculateStravaResetTime(rateLimitHeaders.usage)
      };

      this.stravaRateLimits.set('current', rateLimitInfo);

      // Log rate limit status
      console.log('Strava rate limit status:', {
        endpoint,
        usage: rateLimitHeaders.usage,
        remaining: rateLimitHeaders.remaining,
        resetTime: rateLimitInfo.resetTime
      });

      // Warn if approaching limits
      const [requests15min, requests24hr] = rateLimitHeaders.usage?.split(',').map(Number) || [0, 0];
      const [limit15min, limit24hr] = rateLimitHeaders.limit?.split(',').map(Number) || [100, 1000];

      if (requests15min > limit15min * 0.8 || requests24hr > limit24hr * 0.8) {
        console.warn('Approaching Strava rate limits:', {
          usage15min: `${requests15min}/${limit15min}`,
          usage24hr: `${requests24hr}/${limit24hr}`,
          endpoint
        });
      }
    }
  }

  /**
   * Check if we're at risk of hitting Strava rate limits
   * @returns {Object} Rate limit status
   */
  getStravaRateLimitStatus() {
    const current = this.stravaRateLimits.get('current');
    
    if (!current) {
      return { safe: true, message: 'No rate limit data available' };
    }

    const [requests15min, requests24hr] = current.usage?.split(',').map(Number) || [0, 0];
    const [limit15min, limit24hr] = current.limit?.split(',').map(Number) || [100, 1000];

    const usage15minPercent = (requests15min / limit15min) * 100;
    const usage24hrPercent = (requests24hr / limit24hr) * 100;

    const safe = usage15minPercent < 90 && usage24hrPercent < 90;

    return {
      safe,
      usage15min: `${requests15min}/${limit15min}`,
      usage24hr: `${requests24hr}/${limit24hr}`,
      usage15minPercent: Math.round(usage15minPercent),
      usage24hrPercent: Math.round(usage24hrPercent),
      resetTime: current.resetTime,
      lastUpdated: current.timestamp
    };
  }

  /**
   * Middleware to check Strava rate limits before making API calls
   * @returns {Function} Express middleware
   */
  checkStravaRateLimit() {
    return (req, res, next) => {
      const status = this.getStravaRateLimitStatus();
      
      if (!status.safe) {
        console.warn('Blocking request due to Strava rate limit risk:', status);
        
        const rateLimitError = new Error('API rate limit protection activated. Please try again later.');
        rateLimitError.code = 'rate_limit_protection';
        rateLimitError.status = 429;
        rateLimitError.retryAfter = 300; // 5 minutes
        
        return oauthErrorHandler.handleOAuthError(rateLimitError, req, res, next, 'strava_rate_limit');
      }

      // Add rate limit info to request for monitoring
      req.stravaRateLimit = status;
      next();
    };
  }

  /**
   * Enhanced fetch wrapper that handles Strava rate limits
   * @param {string} url - URL to fetch
   * @param {Object} options - Fetch options
   * @returns {Promise} Enhanced fetch response
   */
  async stravaApiRequest(url, options = {}) {
    const response = await fetch(url, options);
    
    // Track rate limit info
    this.trackStravaRateLimit(response, this.extractEndpointFromUrl(url));

    // Handle 429 responses
    if (response.status === 429) {
      const retryAfter = response.headers?.get('retry-after') || '300';
      
      const rateLimitError = new Error('Strava API rate limit exceeded');
      rateLimitError.code = 'strava_rate_limited';
      rateLimitError.status = 429;
      rateLimitError.retryAfter = parseInt(retryAfter);
      rateLimitError.response = response;
      
      throw rateLimitError;
    }

    return response;
  }

  /**
   * Get client identifier for rate limiting
   * @param {Object} req - Express request
   * @returns {string} Client identifier
   */
  getClientIdentifier(req) {
    // Combine IP and User-Agent for better identification
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    const sessionId = req.sessionID || 'no-session';
    
    // Create a hash-like identifier
    return `${ip}:${userAgent.slice(0, 50)}:${sessionId}`.replace(/[^a-zA-Z0-9:]/g, '');
  }

  /**
   * Calculate Strava API reset time
   * @param {string} usage - Usage header from Strava
   * @returns {Date} Reset time
   */
  calculateStravaResetTime(usage) {
    // Strava resets every 15 minutes and daily
    const now = new Date();
    const next15min = new Date(now);
    next15min.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0);
    
    return next15min;
  }

  /**
   * Extract endpoint name from URL for logging
   * @param {string} url - API URL
   * @returns {string} Endpoint name
   */
  extractEndpointFromUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname.split('/').pop() || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Cleanup old rate limit data
   */
  cleanup() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    // Clean up client request counts
    for (const [clientId, requests] of this.requestCounts.entries()) {
      const validRequests = requests.filter(timestamp => now - timestamp < maxAge);
      
      if (validRequests.length === 0) {
        this.requestCounts.delete(clientId);
      } else {
        this.requestCounts.set(clientId, validRequests);
      }
    }

    // Clean up old Strava rate limit data
    for (const [key, data] of this.stravaRateLimits.entries()) {
      if (now - data.timestamp > maxAge) {
        this.stravaRateLimits.delete(key);
      }
    }

    console.log(`Rate limit cleanup completed. Active clients: ${this.requestCounts.size}`);
  }

  /**
   * Get rate limiting statistics for monitoring
   * @returns {Object} Rate limiting statistics
   */
  getStats() {
    return {
      activeClients: this.requestCounts.size,
      stravaRateLimit: this.getStravaRateLimitStatus(),
      memoryUsage: {
        requestCounts: this.requestCounts.size,
        stravaRateLimits: this.stravaRateLimits.size
      }
    };
  }

  /**
   * Manually reset rate limits for a client (admin function)
   * @param {string} clientId - Client identifier
   */
  resetClientRateLimit(clientId) {
    this.requestCounts.delete(clientId);
    console.log(`Rate limit reset for client: ${clientId}`);
  }

  /**
   * Destroy rate limiting manager and cleanup
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.requestCounts.clear();
    this.stravaRateLimits.clear();
  }
}

// Create singleton instance
const rateLimitManager = new RateLimitManager();

// Graceful shutdown
process.on('SIGTERM', () => rateLimitManager.destroy());
process.on('SIGINT', () => rateLimitManager.destroy());

module.exports = rateLimitManager;