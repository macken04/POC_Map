/**
 * Cross-Domain Token Store
 * Manages temporary tokens for cross-domain authentication
 * Provides persistent storage that works across session contexts
 */

class CrossDomainTokenStore {
  constructor() {
    // In-memory store for tokens (could be replaced with Redis in production)
    this.tokens = new Map();
    
    // Cleanup interval for expired tokens
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredTokens();
    }, 60000); // Cleanup every minute
    
    console.log('Cross-domain token store initialized');
  }

  /**
   * Store a cross-domain token with user session info
   * @param {string} token - The cross-domain token
   * @param {Object} tokenData - Token data to store
   * @param {string} tokenData.sessionId - Session ID
   * @param {Object} tokenData.athlete - Athlete information
   * @param {number} expiresIn - Expiry time in milliseconds (default: 5 minutes)
   */
  storeToken(token, tokenData, expiresIn = 5 * 60 * 1000) {
    const expiryTime = Date.now() + expiresIn;
    
    this.tokens.set(token, {
      ...tokenData,
      expiryTime,
      createdAt: Date.now()
    });

    console.log('Cross-domain token stored:', {
      token: token.substring(0, 8) + '...',
      sessionId: tokenData.sessionId.substring(0, 8) + '...',
      expiresAt: new Date(expiryTime).toISOString(),
      athleteId: tokenData.athlete?.id
    });
  }

  /**
   * Retrieve token data if valid
   * @param {string} token - The cross-domain token
   * @returns {Object|null} Token data or null if invalid/expired
   */
  getTokenData(token) {
    const tokenData = this.tokens.get(token);
    
    if (!tokenData) {
      console.log('Cross-domain token not found:', token.substring(0, 8) + '...');
      return null;
    }

    // Check if token has expired
    if (Date.now() > tokenData.expiryTime) {
      console.log('Cross-domain token expired:', token.substring(0, 8) + '...');
      this.tokens.delete(token);
      return null;
    }

    console.log('Cross-domain token validated:', {
      token: token.substring(0, 8) + '...',
      sessionId: tokenData.sessionId.substring(0, 8) + '...',
      athleteId: tokenData.athlete?.id,
      timeRemaining: Math.round((tokenData.expiryTime - Date.now()) / 1000) + 's'
    });

    return tokenData;
  }

  /**
   * Check if a token is valid
   * @param {string} token - The cross-domain token
   * @returns {boolean} True if token exists and is not expired
   */
  isValidToken(token) {
    return this.getTokenData(token) !== null;
  }

  /**
   * Remove a specific token
   * @param {string} token - The cross-domain token to remove
   */
  removeToken(token) {
    const existed = this.tokens.delete(token);
    if (existed) {
      console.log('Cross-domain token removed:', token.substring(0, 8) + '...');
    }
  }

  /**
   * Clean up expired tokens
   */
  cleanupExpiredTokens() {
    const now = Date.now();
    let expiredCount = 0;

    for (const [token, tokenData] of this.tokens.entries()) {
      if (now > tokenData.expiryTime) {
        this.tokens.delete(token);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      console.log(`Cleaned up ${expiredCount} expired cross-domain tokens`);
    }
  }

  /**
   * Get store statistics for monitoring
   * @returns {Object} Store statistics
   */
  getStats() {
    const now = Date.now();
    let activeTokens = 0;
    let expiredTokens = 0;

    for (const [, tokenData] of this.tokens.entries()) {
      if (now > tokenData.expiryTime) {
        expiredTokens++;
      } else {
        activeTokens++;
      }
    }

    return {
      totalTokens: this.tokens.size,
      activeTokens,
      expiredTokens,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Destroy the token store and cleanup interval
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.tokens.clear();
    console.log('Cross-domain token store destroyed');
  }
}

// Create singleton instance
const tokenStore = new CrossDomainTokenStore();

// Graceful shutdown handling
process.on('SIGTERM', () => tokenStore.destroy());
process.on('SIGINT', () => tokenStore.destroy());

module.exports = tokenStore;