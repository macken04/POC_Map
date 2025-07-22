/**
 * Cache Service for Strava API Integration
 * Provides in-memory caching to reduce API calls and improve performance
 */

class CacheService {
  constructor(config = {}) {
    // Cache storage using Maps for different data types
    this.caches = {
      activities: new Map(),      // Activity lists
      activityDetails: new Map(), // Individual activity data
      activityStreams: new Map(), // GPS/sensor data streams
      athlete: new Map()          // User profile data
    };

    // Cache configuration with different TTLs for different data types
    this.config = {
      maxSize: config.maxSize || 1000, // Maximum items per cache type
      ttl: {
        activities: config.ttl?.activities || 5 * 60 * 1000,      // 5 minutes
        activityDetails: config.ttl?.activityDetails || 60 * 60 * 1000,  // 1 hour
        activityStreams: config.ttl?.activityStreams || 24 * 60 * 60 * 1000, // 24 hours
        athlete: config.ttl?.athlete || 15 * 60 * 1000            // 15 minutes
      },
      cleanupInterval: config.cleanupInterval || 5 * 60 * 1000, // 5 minutes
      enabled: config.enabled !== false,
      warmupEnabled: config.warmupEnabled !== false,
      compression: config.compression !== false
    };

    // Statistics tracking
    this.stats = {
      hits: { activities: 0, activityDetails: 0, activityStreams: 0, athlete: 0 },
      misses: { activities: 0, activityDetails: 0, activityStreams: 0, athlete: 0 },
      sets: { activities: 0, activityDetails: 0, activityStreams: 0, athlete: 0 },
      evictions: { activities: 0, activityDetails: 0, activityStreams: 0, athlete: 0 },
      totalRequests: 0,
      totalHits: 0,
      memoryUsage: 0
    };

    // LRU tracking for cache eviction
    this.accessOrder = {
      activities: new Map(),
      activityDetails: new Map(),
      activityStreams: new Map(),
      athlete: new Map()
    };

    // Start cleanup interval
    if (this.config.enabled) {
      this.cleanupInterval = setInterval(() => this.cleanup(), this.config.cleanupInterval);
      console.log('Cache service initialized with TTLs:', this.config.ttl);
    } else {
      console.log('Cache service disabled');
    }
  }

  /**
   * Generate cache key from user ID, endpoint, and parameters
   * @param {string} userId - User identifier
   * @param {string} endpoint - API endpoint name
   * @param {Object} params - Request parameters
   * @returns {string} Cache key
   */
  generateKey(userId, endpoint, params = {}) {
    // Sort parameters for consistent key generation
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((result, key) => {
        result[key] = params[key];
        return result;
      }, {});

    const paramsString = JSON.stringify(sortedParams);
    return `${userId}:${endpoint}:${this.hashString(paramsString)}`;
  }

  /**
   * Simple hash function for parameter strings
   * @param {string} str - String to hash
   * @returns {string} Hash value
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get data from cache
   * @param {string} cacheType - Type of cache (activities, activityDetails, etc.)
   * @param {string} key - Cache key
   * @returns {Object|null} Cached data or null if not found/expired
   */
  get(cacheType, key) {
    if (!this.config.enabled || !this.caches[cacheType]) {
      return null;
    }

    const cache = this.caches[cacheType];
    const entry = cache.get(key);

    if (!entry) {
      this.stats.misses[cacheType]++;
      this.stats.totalRequests++;
      return null;
    }

    // Check if entry has expired
    if (Date.now() > entry.expiresAt) {
      cache.delete(key);
      this.accessOrder[cacheType].delete(key);
      this.stats.misses[cacheType]++;
      this.stats.totalRequests++;
      return null;
    }

    // Update access order for LRU
    this.updateAccessOrder(cacheType, key);
    
    // Update statistics
    this.stats.hits[cacheType]++;
    this.stats.totalRequests++;
    this.stats.totalHits++;

    // Decompress if needed
    const data = this.config.compression && entry.compressed ? 
      this.decompress(entry.data) : entry.data;

    console.log(`Cache HIT: ${cacheType}:${key.substring(0, 20)}...`);
    return data;
  }

  /**
   * Set data in cache
   * @param {string} cacheType - Type of cache
   * @param {string} key - Cache key
   * @param {*} data - Data to cache
   * @param {number} customTtl - Custom TTL in milliseconds (optional)
   */
  set(cacheType, key, data, customTtl = null) {
    if (!this.config.enabled || !this.caches[cacheType]) {
      return;
    }

    const cache = this.caches[cacheType];
    const ttl = customTtl || this.config.ttl[cacheType];
    
    // Check if we need to evict items due to size limit
    if (cache.size >= this.config.maxSize) {
      this.evictLRU(cacheType);
    }

    // Compress large data if compression enabled
    const shouldCompress = this.config.compression && this.shouldCompress(data);
    const processedData = shouldCompress ? this.compress(data) : data;

    const entry = {
      data: processedData,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttl,
      accessCount: 0,
      compressed: shouldCompress
    };

    cache.set(key, entry);
    this.updateAccessOrder(cacheType, key);
    this.stats.sets[cacheType]++;

    console.log(`Cache SET: ${cacheType}:${key.substring(0, 20)}... (TTL: ${ttl}ms)`);
  }

  /**
   * Update access order for LRU eviction
   * @param {string} cacheType - Cache type
   * @param {string} key - Cache key
   */
  updateAccessOrder(cacheType, key) {
    const accessMap = this.accessOrder[cacheType];
    // Remove and re-add to update order
    accessMap.delete(key);
    accessMap.set(key, Date.now());

    // Update access count
    const cache = this.caches[cacheType];
    const entry = cache.get(key);
    if (entry) {
      entry.accessCount++;
    }
  }

  /**
   * Evict least recently used item from cache
   * @param {string} cacheType - Cache type
   */
  evictLRU(cacheType) {
    const cache = this.caches[cacheType];
    const accessMap = this.accessOrder[cacheType];

    if (accessMap.size === 0) return;

    // Get the first (oldest) key
    const oldestKey = accessMap.keys().next().value;
    
    cache.delete(oldestKey);
    accessMap.delete(oldestKey);
    this.stats.evictions[cacheType]++;

    console.log(`Cache EVICT: ${cacheType}:${oldestKey.substring(0, 20)}... (LRU)`);
  }

  /**
   * Delete specific key from cache
   * @param {string} cacheType - Cache type
   * @param {string} key - Cache key
   */
  delete(cacheType, key) {
    if (!this.config.enabled || !this.caches[cacheType]) {
      return;
    }

    this.caches[cacheType].delete(key);
    this.accessOrder[cacheType].delete(key);
    console.log(`Cache DELETE: ${cacheType}:${key.substring(0, 20)}...`);
  }

  /**
   * Invalidate cache entries by pattern
   * @param {string} cacheType - Cache type
   * @param {string|RegExp} pattern - Pattern to match keys for invalidation
   */
  invalidate(cacheType, pattern) {
    if (!this.config.enabled || !this.caches[cacheType]) {
      return;
    }

    const cache = this.caches[cacheType];
    const accessMap = this.accessOrder[cacheType];
    let invalidatedCount = 0;

    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);

    for (const key of cache.keys()) {
      if (regex.test(key)) {
        cache.delete(key);
        accessMap.delete(key);
        invalidatedCount++;
      }
    }

    console.log(`Cache INVALIDATE: ${cacheType} - ${invalidatedCount} entries removed`);
  }

  /**
   * Clear entire cache type
   * @param {string} cacheType - Cache type to clear
   */
  clear(cacheType) {
    if (!this.config.enabled || !this.caches[cacheType]) {
      return;
    }

    const size = this.caches[cacheType].size;
    this.caches[cacheType].clear();
    this.accessOrder[cacheType].clear();
    
    console.log(`Cache CLEAR: ${cacheType} - ${size} entries removed`);
  }

  /**
   * Clear all caches
   */
  clearAll() {
    if (!this.config.enabled) return;

    Object.keys(this.caches).forEach(cacheType => {
      this.clear(cacheType);
    });

    // Reset statistics
    Object.keys(this.stats.hits).forEach(type => {
      this.stats.hits[type] = 0;
      this.stats.misses[type] = 0;
      this.stats.sets[type] = 0;
      this.stats.evictions[type] = 0;
    });

    this.stats.totalRequests = 0;
    this.stats.totalHits = 0;
    this.stats.memoryUsage = 0;

    console.log('All caches cleared');
  }

  /**
   * Cleanup expired entries
   */
  cleanup() {
    if (!this.config.enabled) return;

    const now = Date.now();
    let totalCleaned = 0;

    Object.keys(this.caches).forEach(cacheType => {
      const cache = this.caches[cacheType];
      const accessMap = this.accessOrder[cacheType];
      let cleaned = 0;

      for (const [key, entry] of cache.entries()) {
        if (now > entry.expiresAt) {
          cache.delete(key);
          accessMap.delete(key);
          cleaned++;
        }
      }

      totalCleaned += cleaned;
      if (cleaned > 0) {
        console.log(`Cache CLEANUP: ${cacheType} - ${cleaned} expired entries removed`);
      }
    });

    // Update memory usage estimate
    this.updateMemoryUsage();

    if (totalCleaned > 0) {
      console.log(`Cache cleanup completed: ${totalCleaned} total entries removed`);
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    this.updateMemoryUsage();

    const hitRate = this.stats.totalRequests > 0 ? 
      (this.stats.totalHits / this.stats.totalRequests * 100).toFixed(2) : 0;

    return {
      enabled: this.config.enabled,
      hitRate: `${hitRate}%`,
      totalRequests: this.stats.totalRequests,
      totalHits: this.stats.totalHits,
      totalMisses: this.stats.totalRequests - this.stats.totalHits,
      memoryUsage: this.formatBytes(this.stats.memoryUsage),
      cacheDetails: Object.keys(this.caches).reduce((details, cacheType) => {
        const cache = this.caches[cacheType];
        const hits = this.stats.hits[cacheType];
        const misses = this.stats.misses[cacheType];
        const total = hits + misses;
        const hitRate = total > 0 ? (hits / total * 100).toFixed(2) : 0;

        details[cacheType] = {
          size: cache.size,
          maxSize: this.config.maxSize,
          hitRate: `${hitRate}%`,
          hits,
          misses,
          sets: this.stats.sets[cacheType],
          evictions: this.stats.evictions[cacheType],
          ttl: `${this.config.ttl[cacheType] / 1000}s`
        };
        return details;
      }, {}),
      config: {
        maxSize: this.config.maxSize,
        cleanupInterval: `${this.config.cleanupInterval / 1000}s`,
        compression: this.config.compression,
        warmupEnabled: this.config.warmupEnabled
      }
    };
  }

  /**
   * Estimate memory usage of caches
   */
  updateMemoryUsage() {
    let totalSize = 0;

    Object.keys(this.caches).forEach(cacheType => {
      const cache = this.caches[cacheType];
      for (const [key, entry] of cache.entries()) {
        totalSize += key.length * 2; // String size approximation
        totalSize += this.estimateObjectSize(entry);
      }
    });

    this.stats.memoryUsage = totalSize;
  }

  /**
   * Estimate object size in bytes
   * @param {*} obj - Object to estimate
   * @returns {number} Estimated size in bytes
   */
  estimateObjectSize(obj) {
    const jsonString = JSON.stringify(obj);
    return jsonString ? jsonString.length * 2 : 0; // UTF-16 approximation
  }

  /**
   * Format bytes to human readable format
   * @param {number} bytes - Bytes to format
   * @returns {string} Formatted string
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Determine if data should be compressed
   * @param {*} data - Data to evaluate
   * @returns {boolean} Whether to compress
   */
  shouldCompress(data) {
    const threshold = 1024; // 1KB threshold
    const size = this.estimateObjectSize(data);
    return size > threshold;
  }

  /**
   * Simple compression (in a real app, use a proper compression library)
   * @param {*} data - Data to compress
   * @returns {*} Compressed data
   */
  compress(data) {
    // For now, just return the data as-is
    // In production, implement with zlib or similar
    return data;
  }

  /**
   * Simple decompression
   * @param {*} data - Data to decompress
   * @returns {*} Decompressed data
   */
  decompress(data) {
    // For now, just return the data as-is
    // In production, implement with zlib or similar
    return data;
  }

  /**
   * Warm up cache with frequently accessed data
   * @param {string} userId - User ID
   * @param {Function} dataFetcher - Function to fetch data
   */
  async warmUp(userId, dataFetcher) {
    if (!this.config.enabled || !this.config.warmupEnabled) {
      return;
    }

    try {
      console.log(`Starting cache warmup for user: ${userId}`);
      
      // Warm up with basic activities list
      const activitiesKey = this.generateKey(userId, 'activities', { page: 1, per_page: 30 });
      if (!this.get('activities', activitiesKey)) {
        const activities = await dataFetcher('activities', { page: 1, per_page: 30 });
        if (activities) {
          this.set('activities', activitiesKey, activities);
        }
      }

      // Warm up athlete data
      const athleteKey = this.generateKey(userId, 'athlete');
      if (!this.get('athlete', athleteKey)) {
        const athlete = await dataFetcher('athlete');
        if (athlete) {
          this.set('athlete', athleteKey, athlete);
        }
      }

      console.log(`Cache warmup completed for user: ${userId}`);
    } catch (error) {
      console.error('Cache warmup failed:', error);
    }
  }

  /**
   * Enable/disable cache
   * @param {boolean} enabled - Whether to enable cache
   */
  setEnabled(enabled) {
    this.config.enabled = enabled;
    if (!enabled && this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    } else if (enabled && !this.cleanupInterval) {
      this.cleanupInterval = setInterval(() => this.cleanup(), this.config.cleanupInterval);
    }
    console.log(`Cache ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Destroy cache service and cleanup
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    this.clearAll();
    console.log('Cache service destroyed');
  }
}

module.exports = CacheService;