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
   * @param {number} expiresIn - Expiry time in milliseconds (default: 15 minutes for map confirmation flow)
   */
  storeToken(token, tokenData, expiresIn = 15 * 60 * 1000) {
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
   * Extend/refresh a token's expiry time
   * @param {string} token - The cross-domain token to extend
   * @param {number} expiresIn - New expiry time in milliseconds (default: 15 minutes)
   * @returns {boolean} True if token was extended, false if not found
   */
  extendToken(token, expiresIn = 15 * 60 * 1000) {
    const tokenData = this.tokens.get(token);
    
    if (!tokenData) {
      console.log('Cannot extend - token not found:', token.substring(0, 8) + '...');
      return false;
    }

    const newExpiryTime = Date.now() + expiresIn;
    tokenData.expiryTime = newExpiryTime;
    
    console.log('Cross-domain token extended:', {
      token: token.substring(0, 8) + '...',
      newExpiresAt: new Date(newExpiryTime).toISOString(),
      athleteId: tokenData.athlete?.id
    });
    
    return true;
  }

  /**
   * Store map preview data for a cross-domain token
   * @param {string} token - The cross-domain token
   * @param {string} previewId - The preview ID
   * @param {Object} previewData - The preview data to store
   * @returns {boolean} True if stored successfully, false if token not found
   */
  storeMapPreview(token, previewId, previewData) {
    const tokenData = this.tokens.get(token);
    
    if (!tokenData) {
      console.log('Cannot store preview - token not found:', token.substring(0, 8) + '...');
      return false;
    }

    // Initialize mapPreviews if not exists
    if (!tokenData.mapPreviews) {
      tokenData.mapPreviews = {};
    }

    tokenData.mapPreviews[previewId] = {
      ...previewData,
      storedAt: new Date().toISOString()
    };

    console.log('Map preview stored in cross-domain token:', {
      token: token.substring(0, 8) + '...',
      previewId,
      athleteId: tokenData.athlete?.id
    });

    return true;
  }

  /**
   * Get map preview data for a cross-domain token
   * @param {string} token - The cross-domain token
   * @param {string} previewId - The preview ID (optional - returns all if not specified)
   * @returns {Object|null} Preview data or null if not found
   */
  getMapPreview(token, previewId = null) {
    const tokenData = this.tokens.get(token);
    
    if (!tokenData || !tokenData.mapPreviews) {
      return null;
    }

    if (previewId) {
      return tokenData.mapPreviews[previewId] || null;
    }

    return tokenData.mapPreviews;
  }

  /**
   * Store confirmed map data for a cross-domain token
   * @param {string} token - The cross-domain token
   * @param {string} mapId - The confirmed map ID
   * @param {Object} mapData - The confirmed map data to store
   * @returns {boolean} True if stored successfully, false if token not found
   */
  storeConfirmedMap(token, mapId, mapData) {
    const tokenData = this.tokens.get(token);
    
    if (!tokenData) {
      console.log('Cannot store confirmed map - token not found:', token.substring(0, 8) + '...');
      return false;
    }

    // Initialize confirmedMaps if not exists
    if (!tokenData.confirmedMaps) {
      tokenData.confirmedMaps = {};
    }

    tokenData.confirmedMaps[mapId] = {
      ...mapData,
      confirmedAt: new Date().toISOString()
    };

    console.log('Confirmed map stored in cross-domain token:', {
      token: token.substring(0, 8) + '...',
      mapId,
      athleteId: tokenData.athlete?.id
    });

    return true;
  }

  /**
   * Get confirmed map data for a cross-domain token
   * @param {string} token - The cross-domain token
   * @param {string} mapId - The map ID (optional - returns all if not specified)
   * @returns {Object|null} Confirmed map data or null if not found
   */
  getConfirmedMap(token, mapId = null) {
    const tokenData = this.tokens.get(token);
    
    if (!tokenData || !tokenData.confirmedMaps) {
      return null;
    }

    if (mapId) {
      return tokenData.confirmedMaps[mapId] || null;
    }

    return tokenData.confirmedMaps;
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