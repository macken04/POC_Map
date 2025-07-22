/**
 * Cache Service Test Suite
 * Comprehensive tests for caching functionality
 */

const CacheService = require('../services/cacheService');
const { cache, generateStravaKey, getCachedOrFetch } = require('../services/cacheManager');

class CacheServiceTester {
  constructor() {
    this.testResults = [];
    this.testCacheService = null;
  }

  /**
   * Log test result
   */
  logResult(testName, passed, message = '', error = null) {
    const result = {
      test: testName,
      passed,
      message,
      error: error?.message || null,
      timestamp: new Date().toISOString()
    };
    
    this.testResults.push(result);
    
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status}: ${testName}${message ? ' - ' + message : ''}`);
    
    if (error) {
      console.error('  Error:', error.message);
    }
  }

  /**
   * Test cache service initialization
   */
  testCacheInitialization() {
    try {
      // Test default configuration
      const cache1 = new CacheService();
      const config1 = cache1.config;
      
      this.logResult('Cache Default Init', 
        config1.enabled === true &&
        config1.maxSize === 1000 &&
        config1.ttl.activities === 5 * 60 * 1000,
        'Default configuration loaded correctly'
      );

      // Test custom configuration
      const customConfig = {
        maxSize: 500,
        ttl: { activities: 30000 },
        enabled: true
      };
      
      const cache2 = new CacheService(customConfig);
      this.logResult('Cache Custom Init',
        cache2.config.maxSize === 500 &&
        cache2.config.ttl.activities === 30000,
        'Custom configuration applied correctly'
      );

      // Test disabled cache
      const cache3 = new CacheService({ enabled: false });
      this.logResult('Cache Disabled Init',
        cache3.config.enabled === false,
        'Cache can be disabled'
      );

      cache1.destroy();
      cache2.destroy();  
      cache3.destroy();

    } catch (error) {
      this.logResult('Cache Initialization', false, '', error);
    }
  }

  /**
   * Test basic cache operations
   */
  testBasicCacheOperations() {
    try {
      this.testCacheService = new CacheService({
        maxSize: 10,
        ttl: { activities: 1000 } // 1 second TTL for testing
      });

      const testData = { id: 123, name: 'Test Activity', distance: 5000 };
      const cacheKey = 'test-user:activities:test123';

      // Test SET operation
      this.testCacheService.set('activities', cacheKey, testData);
      
      // Test GET operation (should hit)
      const retrieved1 = this.testCacheService.get('activities', cacheKey);
      this.logResult('Cache SET/GET',
        retrieved1 && retrieved1.id === 123,
        'Data stored and retrieved correctly'
      );

      // Test cache miss
      const missed = this.testCacheService.get('activities', 'nonexistent-key');
      this.logResult('Cache Miss',
        missed === null,
        'Returns null for non-existent keys'
      );

      // Test DELETE operation
      this.testCacheService.delete('activities', cacheKey);
      const retrieved2 = this.testCacheService.get('activities', cacheKey);
      this.logResult('Cache DELETE',
        retrieved2 === null,
        'Data deleted successfully'
      );

    } catch (error) {
      this.logResult('Basic Cache Operations', false, '', error);
    }
  }

  /**
   * Test cache expiration
   */
  async testCacheExpiration() {
    try {
      const testData = { test: 'expiration' };
      const cacheKey = 'test-user:activities:expiry-test';

      // Set with very short TTL
      this.testCacheService.set('activities', cacheKey, testData, 100); // 100ms TTL

      // Should be available immediately
      const immediate = this.testCacheService.get('activities', cacheKey);
      this.logResult('Cache Immediate Access',
        immediate !== null,
        'Data available immediately after set'
      );

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should be expired
      const expired = this.testCacheService.get('activities', cacheKey);
      this.logResult('Cache Expiration',
        expired === null,
        'Data expires after TTL'
      );

    } catch (error) {
      this.logResult('Cache Expiration', false, '', error);
    }
  }

  /**
   * Test LRU eviction
   */
  testLRUEviction() {
    try {
      const smallCache = new CacheService({
        maxSize: 3,
        ttl: { activities: 60000 } // Long TTL
      });

      // Fill cache to capacity
      smallCache.set('activities', 'key1', { id: 1 });
      smallCache.set('activities', 'key2', { id: 2 });
      smallCache.set('activities', 'key3', { id: 3 });

      // Add one more (should evict oldest)
      smallCache.set('activities', 'key4', { id: 4 });

      // Check that oldest was evicted
      const evicted = smallCache.get('activities', 'key1');
      const newest = smallCache.get('activities', 'key4');

      this.logResult('LRU Eviction',
        evicted === null && newest !== null,
        'Oldest item evicted when cache full'
      );

      smallCache.destroy();

    } catch (error) {
      this.logResult('LRU Eviction', false, '', error);
    }
  }

  /**
   * Test cache invalidation patterns
   */
  testCacheInvalidation() {
    try {
      // Set up test data
      this.testCacheService.set('activities', 'user123:activities:test1', { id: 1 });
      this.testCacheService.set('activities', 'user123:activities:test2', { id: 2 });
      this.testCacheService.set('activities', 'user456:activities:test3', { id: 3 });

      // Test pattern-based invalidation
      this.testCacheService.invalidate('activities', /^user123:/);

      // Check results
      const invalidated1 = this.testCacheService.get('activities', 'user123:activities:test1');
      const invalidated2 = this.testCacheService.get('activities', 'user123:activities:test2');
      const preserved = this.testCacheService.get('activities', 'user456:activities:test3');

      this.logResult('Pattern Invalidation',
        invalidated1 === null && invalidated2 === null && preserved !== null,
        'Pattern-based invalidation works correctly'
      );

      // Test clear operation
      this.testCacheService.clear('activities');
      const cleared = this.testCacheService.get('activities', 'user456:activities:test3');

      this.logResult('Cache Clear',
        cleared === null,
        'Clear operation removes all entries'
      );

    } catch (error) {
      this.logResult('Cache Invalidation', false, '', error);
    }
  }

  /**
   * Test cache statistics
   */
  testCacheStatistics() {
    try {
      // Reset statistics
      this.testCacheService.clearAll();

      // Generate some cache activity
      this.testCacheService.set('activities', 'stats-test-1', { data: 'test1' });
      this.testCacheService.set('activities', 'stats-test-2', { data: 'test2' });
      
      this.testCacheService.get('activities', 'stats-test-1'); // hit
      this.testCacheService.get('activities', 'nonexistent');  // miss

      const stats = this.testCacheService.getStats();

      this.logResult('Cache Statistics',
        stats.cacheDetails.activities.hits === 1 &&
        stats.cacheDetails.activities.misses === 1 &&
        stats.cacheDetails.activities.sets === 2,
        'Statistics tracking works correctly'
      );

      // Test hit rate calculation
      this.logResult('Hit Rate Calculation',
        stats.hitRate === '50.00%',
        'Hit rate calculated correctly'
      );

    } catch (error) {
      this.logResult('Cache Statistics', false, '', error);
    }
  }

  /**
   * Test cache manager integration
   */
  async testCacheManagerIntegration() {
    try {
      // Test key generation
      const mockReq = {
        session: { athlete: { id: 'test-user-123' } },
        query: { page: 1, per_page: 30, type: 'Ride' }
      };

      const key = generateStravaKey(mockReq, 'activities');
      this.logResult('Cache Key Generation',
        key.includes('test-user-123') && key.includes('activities'),
        'Cache keys generated correctly'
      );

      // Test cache-first strategy
      let apiCallCount = 0;
      const mockApiCall = async () => {
        apiCallCount++;
        return { id: 1, name: 'Test Activity', apiCallCount };
      };

      // First call should hit API
      const result1 = await getCachedOrFetch('activities', key, mockApiCall);
      
      // Second call should use cache
      const result2 = await getCachedOrFetch('activities', key, mockApiCall);

      this.logResult('Cache-First Strategy',
        apiCallCount === 1 && result1.apiCallCount === result2.apiCallCount,
        'API called once, subsequent requests served from cache'
      );

    } catch (error) {
      this.logResult('Cache Manager Integration', false, '', error);
    }
  }

  /**
   * Test performance with large datasets
   */
  async testCachePerformance() {
    try {
      const performanceCache = new CacheService({
        maxSize: 1000,
        ttl: { activities: 60000 }
      });

      const largeDataset = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        name: `Activity ${i + 1}`,
        distance: Math.random() * 50000,
        elevation: Math.random() * 1000
      }));

      // Test bulk set performance
      const setStart = performance.now();
      for (let i = 0; i < largeDataset.length; i++) {
        performanceCache.set('activities', `perf-test-${i}`, largeDataset[i]);
      }
      const setTime = performance.now() - setStart;

      // Test bulk get performance  
      const getStart = performance.now();
      for (let i = 0; i < largeDataset.length; i++) {
        performanceCache.get('activities', `perf-test-${i}`);
      }
      const getTime = performance.now() - getStart;

      this.logResult('Cache Performance',
        setTime < 100 && getTime < 50, // Should be very fast
        `Set: ${setTime.toFixed(2)}ms, Get: ${getTime.toFixed(2)}ms for 100 items`
      );

      performanceCache.destroy();

    } catch (error) {
      this.logResult('Cache Performance', false, '', error);
    }
  }

  /**
   * Test error handling and edge cases
   */
  testErrorHandling() {
    try {
      // Test with invalid cache type
      this.testCacheService.set('invalid-type', 'test-key', { data: 'test' });
      const invalidGet = this.testCacheService.get('invalid-type', 'test-key');
      
      this.logResult('Invalid Cache Type Handling',
        invalidGet === null,
        'Gracefully handles invalid cache types'
      );

      // Test with null/undefined data
      this.testCacheService.set('activities', 'null-test', null);
      const nullData = this.testCacheService.get('activities', 'null-test');
      
      this.logResult('Null Data Handling',
        nullData === null, // Since null is stored but treated as cache miss
        'Handles null data gracefully'
      );

      // Test cache disabled scenario
      const disabledCache = new CacheService({ enabled: false });
      disabledCache.set('activities', 'disabled-test', { data: 'test' });
      const disabledGet = disabledCache.get('activities', 'disabled-test');
      
      this.logResult('Disabled Cache Handling',
        disabledGet === null,
        'Disabled cache returns null for all operations'
      );

      disabledCache.destroy();

    } catch (error) {
      this.logResult('Error Handling', false, '', error);
    }
  }

  /**
   * Test memory cleanup
   */
  async testMemoryCleanup() {
    try {
      const cleanupCache = new CacheService({
        maxSize: 100,
        ttl: { activities: 50 }, // Very short TTL
        cleanupInterval: 100 // Very frequent cleanup
      });

      // Add data that will expire quickly
      for (let i = 0; i < 10; i++) {
        cleanupCache.set('activities', `cleanup-test-${i}`, { id: i });
      }

      const initialSize = cleanupCache.caches.activities.size;

      // Wait for cleanup to run
      await new Promise(resolve => setTimeout(resolve, 200));

      const finalSize = cleanupCache.caches.activities.size;

      this.logResult('Memory Cleanup',
        finalSize < initialSize,
        `Cache size reduced from ${initialSize} to ${finalSize} after cleanup`
      );

      cleanupCache.destroy();

    } catch (error) {
      this.logResult('Memory Cleanup', false, '', error);
    }
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('🧪 Starting Cache Service Test Suite...\n');

    try {
      // Core functionality tests
      this.testCacheInitialization();
      this.testBasicCacheOperations();
      await this.testCacheExpiration();
      this.testLRUEviction();
      this.testCacheInvalidation();
      this.testCacheStatistics();

      // Integration tests
      await this.testCacheManagerIntegration();

      // Performance and edge case tests
      await this.testCachePerformance();
      this.testErrorHandling();
      await this.testMemoryCleanup();

    } catch (error) {
      console.error('Test suite error:', error);
    } finally {
      // Cleanup
      if (this.testCacheService) {
        this.testCacheService.destroy();
      }
    }

    this.printSummary();
  }

  /**
   * Print test summary
   */
  printSummary() {
    console.log('\n📊 Test Summary');
    console.log('================');

    const passed = this.testResults.filter(r => r.passed).length;
    const failed = this.testResults.filter(r => r.passed === false).length;
    const total = this.testResults.length;

    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed} ✅`);
    console.log(`Failed: ${failed} ❌`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults
        .filter(r => !r.passed)
        .forEach(r => console.log(`  - ${r.test}: ${r.error || r.message}`));
    }

    console.log(`\n${passed === total ? '🎉 All tests passed!' : '⚠️  Some tests failed'}`);
    
    return {
      total,
      passed,
      failed,
      successRate: (passed / total) * 100,
      details: this.testResults
    };
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new CacheServiceTester();
  tester.runAllTests()
    .then(result => {
      process.exit(result.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = CacheServiceTester;