/**
 * Cache Manager Instance
 * Singleton instance of CacheService with application configuration
 */

const CacheService = require('./cacheService');
const { getConfig } = require('../config');

// Get cache configuration from environment
const config = getConfig();
const cacheConfig = config.cache;

// Create singleton cache instance
const cacheManager = new CacheService(cacheConfig);

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('Shutting down cache manager...');
  cacheManager.destroy();
});

process.on('SIGINT', () => {
  console.log('Shutting down cache manager...');
  cacheManager.destroy();
});

// Export cache manager instance and helper functions
module.exports = {
  // Core cache instance
  cache: cacheManager,

  /**
   * Generate cache key for Strava API endpoints
   * @param {Object} req - Express request object
   * @param {string} endpoint - API endpoint name
   * @param {Object} additionalParams - Additional parameters to include in key
   * @returns {string} Cache key
   */
  generateStravaKey(req, endpoint, additionalParams = {}) {
    const userId = req.session?.athlete?.id || 'anonymous';
    const queryParams = { ...req.query, ...additionalParams };
    
    // Remove pagination params for certain cache types to increase hit rate
    if (endpoint === 'activities' && !additionalParams.includePagination) {
      delete queryParams.page;
      delete queryParams.per_page;
    }

    return cacheManager.generateKey(userId, endpoint, queryParams);
  },

  /**
   * Cache-first wrapper for Strava API calls
   * @param {string} cacheType - Type of cache (activities, activityDetails, etc.)
   * @param {string} key - Cache key
   * @param {Function} apiCall - Function that makes the API call
   * @param {number} customTtl - Custom TTL for this specific call
   * @returns {Promise<*>} Cached or fresh data
   */
  async getCachedOrFetch(cacheType, key, apiCall, customTtl = null) {
    // Try to get from cache first
    const cached = cacheManager.get(cacheType, key);
    if (cached !== null) {
      return cached;
    }

    // Cache miss - fetch from API
    try {
      const freshData = await apiCall();
      
      // Store in cache for future requests
      cacheManager.set(cacheType, key, freshData, customTtl);
      
      return freshData;
    } catch (error) {
      // On API error, don't cache the error
      console.error(`API call failed for cache key ${key}:`, error.message);
      throw error;
    }
  },

  /**
   * Invalidate user-specific cache entries
   * @param {string} userId - User ID
   * @param {string|Array} cacheTypes - Cache type(s) to invalidate
   */
  invalidateUserCache(userId, cacheTypes = ['activities', 'activityDetails', 'athlete']) {
    const types = Array.isArray(cacheTypes) ? cacheTypes : [cacheTypes];
    
    types.forEach(cacheType => {
      const pattern = new RegExp(`^${userId}:`);
      cacheManager.invalidate(cacheType, pattern);
    });
  },

  /**
   * Invalidate cache when user performs actions that change data
   * @param {string} userId - User ID
   * @param {string} action - Action performed (e.g., 'activity_updated', 'activity_deleted')
   * @param {string} activityId - Activity ID if applicable
   */
  invalidateOnUserAction(userId, action, activityId = null) {
    switch (action) {
      case 'activity_updated':
      case 'activity_deleted':
        // Invalidate activities list and specific activity details
        this.invalidateUserCache(userId, ['activities']);
        if (activityId) {
          const detailsPattern = new RegExp(`^${userId}:activity-${activityId}:`);
          const streamsPattern = new RegExp(`^${userId}:activity-${activityId}-streams:`);
          cacheManager.invalidate('activityDetails', detailsPattern);
          cacheManager.invalidate('activityStreams', streamsPattern);
        }
        break;

      case 'profile_updated':
        this.invalidateUserCache(userId, ['athlete']);
        break;

      case 'activities_privacy_changed':
        // Clear all user caches when privacy settings change
        this.invalidateUserCache(userId);
        break;

      default:
        console.warn(`Unknown cache invalidation action: ${action}`);
    }
  },

  /**
   * Get cache statistics with additional context
   * @returns {Object} Enhanced cache statistics
   */
  getStats() {
    const stats = cacheManager.getStats();
    
    // Add additional context
    stats.uptime = process.uptime();
    stats.environment = process.env.NODE_ENV || 'development';
    stats.timestamp = new Date().toISOString();

    return stats;
  },

  /**
   * Health check for cache service
   * @returns {Object} Health status
   */
  healthCheck() {
    try {
      const testKey = 'health_check_' + Date.now();
      const testData = { test: true, timestamp: Date.now() };
      
      // Test set and get operations
      cacheManager.set('activities', testKey, testData, 1000); // 1 second TTL
      const retrieved = cacheManager.get('activities', testKey);
      cacheManager.delete('activities', testKey);
      
      const isWorking = retrieved !== null && retrieved.test === true;
      
      return {
        status: isWorking ? 'healthy' : 'degraded',
        enabled: cacheConfig.enabled,
        timestamp: new Date().toISOString(),
        details: {
          setOperation: true,
          getOperation: isWorking,
          deleteOperation: true
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        enabled: cacheConfig.enabled,
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  },

  /**
   * Warm up cache for a user session
   * @param {string} userId - User ID
   * @param {Function} stravaApiCall - Function to make Strava API calls
   */
  async warmUpUserCache(userId, stravaApiCall) {
    try {
      await cacheManager.warmUp(userId, stravaApiCall);
    } catch (error) {
      console.error('Cache warmup failed:', error);
    }
  }
};