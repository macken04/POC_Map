/**
 * Cache Integration Test Suite
 * Tests caching integration with Strava API routes
 */

const axios = require('axios');
const { cache, generateStravaKey, getCachedOrFetch } = require('../services/cacheManager');

class CacheIntegrationTester {
  constructor() {
    this.testResults = [];
    this.baseUrl = 'http://localhost:3000/api/strava';
    this.mockSession = {
      athlete: { id: 'test-user-cache-integration' }
    };
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
   * Test cache key generation for different scenarios
   */
  testCacheKeyGeneration() {
    try {
      const mockReq1 = {
        session: { athlete: { id: 'user-123' } },
        query: { page: 1, per_page: 30 }
      };

      const mockReq2 = {
        session: { athlete: { id: 'user-456' } },
        query: { page: 1, per_page: 30 }
      };

      const mockReq3 = {
        session: { athlete: { id: 'user-123' } },
        query: { page: 2, per_page: 30 } // Different pagination
      };

      const key1 = generateStravaKey(mockReq1, 'activities');
      const key2 = generateStravaKey(mockReq2, 'activities');
      const key3 = generateStravaKey(mockReq3, 'activities', { includePagination: true });

      // Different users should have different keys
      this.logResult('Different User Keys',
        key1 !== key2,
        'Different users generate different cache keys'
      );

      // Same user with different params should have different keys (when pagination is included)
      this.logResult('Different Param Keys',
        key1 !== key3,
        'Different parameters generate different cache keys'
      );

      // Same request should generate same key
      const key1Repeat = generateStravaKey(mockReq1, 'activities');
      this.logResult('Consistent Key Generation',
        key1 === key1Repeat,
        'Identical requests generate identical keys'
      );

    } catch (error) {
      this.logResult('Cache Key Generation', false, '', error);
    }
  }

  /**
   * Test cache-first strategy with mock API calls
   */
  async testCacheFirstStrategy() {
    try {
      let apiCallCount = 0;
      const testData = { id: 1, name: 'Test Activity', timestamp: Date.now() };

      const mockApiCall = async () => {
        apiCallCount++;
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 10));
        return { ...testData, apiCallCount };
      };

      const cacheKey = 'integration-test:cache-first:test-key';

      // Clear any existing cache
      cache.delete('activities', cacheKey);

      // First call - should hit API
      const startTime1 = performance.now();
      const result1 = await getCachedOrFetch('activities', cacheKey, mockApiCall);
      const time1 = performance.now() - startTime1;

      // Second call - should use cache
      const startTime2 = performance.now();
      const result2 = await getCachedOrFetch('activities', cacheKey, mockApiCall);
      const time2 = performance.now() - startTime2;

      this.logResult('Cache-First API Call Count',
        apiCallCount === 1,
        'API called only once for repeated requests'
      );

      this.logResult('Cache-First Data Consistency',
        result1.apiCallCount === result2.apiCallCount,
        'Cached data matches original data'
      );

      this.logResult('Cache-First Performance',
        time2 < time1,
        `Cache faster than API: ${time1.toFixed(2)}ms vs ${time2.toFixed(2)}ms`
      );

    } catch (error) {
      this.logResult('Cache-First Strategy', false, '', error);
    }
  }

  /**
   * Test cache behavior with different TTLs
   */
  async testDifferentCacheTTLs() {
    try {
      const testData1 = { type: 'activities', data: 'short-lived' };
      const testData2 = { type: 'activityDetails', data: 'long-lived' };
      const testData3 = { type: 'activityStreams', data: 'very-long-lived' };

      // Set items with different TTLs
      cache.set('activities', 'ttl-test-1', testData1);
      cache.set('activityDetails', 'ttl-test-2', testData2);  
      cache.set('activityStreams', 'ttl-test-3', testData3);

      // All should be available immediately
      const immediate1 = cache.get('activities', 'ttl-test-1');
      const immediate2 = cache.get('activityDetails', 'ttl-test-2');
      const immediate3 = cache.get('activityStreams', 'ttl-test-3');

      this.logResult('Immediate Cache Access',
        immediate1 && immediate2 && immediate3,
        'All cache types accessible immediately after set'
      );

      // Check TTL configuration is working
      const stats = cache.getStats();
      const activitiesTTL = parseInt(stats.cacheDetails.activities.ttl);
      const detailsTTL = parseInt(stats.cacheDetails.activityDetails.ttl);
      const streamsTTL = parseInt(stats.cacheDetails.activityStreams.ttl);

      this.logResult('TTL Configuration',
        activitiesTTL < detailsTTL && detailsTTL < streamsTTL,
        `TTLs properly configured: ${activitiesTTL}s < ${detailsTTL}s < ${streamsTTL}s`
      );

    } catch (error) {
      this.logResult('Different Cache TTLs', false, '', error);
    }
  }

  /**
   * Test cache statistics accuracy
   */
  async testCacheStatistics() {
    try {
      // Clear cache for clean test
      cache.clearAll();

      // Generate known cache activity
      const testKey1 = 'stats-test-hit-1';
      const testKey2 = 'stats-test-hit-2';
      const testKey3 = 'stats-test-miss';

      // Set some data
      cache.set('activities', testKey1, { data: 'test1' });
      cache.set('activities', testKey2, { data: 'test2' });

      // Generate hits and misses
      cache.get('activities', testKey1); // hit
      cache.get('activities', testKey2); // hit  
      cache.get('activities', testKey3); // miss
      cache.get('activities', testKey1); // hit again

      const stats = cache.getStats();
      const activityStats = stats.cacheDetails.activities;

      this.logResult('Hit Count Accuracy',
        activityStats.hits === 3,
        `Expected 3 hits, got ${activityStats.hits}`
      );

      this.logResult('Miss Count Accuracy',
        activityStats.misses === 1,
        `Expected 1 miss, got ${activityStats.misses}`
      );

      this.logResult('Set Count Accuracy',
        activityStats.sets === 2,
        `Expected 2 sets, got ${activityStats.sets}`
      );

      this.logResult('Hit Rate Calculation',
        stats.hitRate === '75.00%',
        `Expected 75.00% hit rate, got ${stats.hitRate}`
      );

    } catch (error) {
      this.logResult('Cache Statistics', false, '', error);
    }
  }

  /**
   * Test cache invalidation scenarios
   */
  testCacheInvalidation() {
    try {
      const cacheManager = require('../services/cacheManager');

      // Set up test data for multiple users
      cache.set('activities', 'user-123:activities:list-1', { data: 'user123-activities' });
      cache.set('activityDetails', 'user-123:activity-456:details', { data: 'user123-activity456' });
      cache.set('athlete', 'user-123:athlete:profile', { data: 'user123-profile' });
      cache.set('activities', 'user-789:activities:list-1', { data: 'user789-activities' });

      // Test user-specific invalidation
      cacheManager.invalidateUserCache('user-123', ['activities', 'athlete']);

      const invalidated1 = cache.get('activities', 'user-123:activities:list-1');
      const invalidated2 = cache.get('athlete', 'user-123:athlete:profile');
      const preserved1 = cache.get('activityDetails', 'user-123:activity-456:details');
      const preserved2 = cache.get('activities', 'user-789:activities:list-1');

      this.logResult('User-Specific Invalidation',
        invalidated1 === null && invalidated2 === null && 
        preserved1 !== null && preserved2 !== null,
        'Only specified user and cache types invalidated'
      );

      // Test action-based invalidation
      cache.set('activities', 'user-456:activities:list-1', { data: 'user456-activities' });
      cache.set('activityDetails', 'user-456:activity-789:details', { data: 'activity789' });

      cacheManager.invalidateOnUserAction('user-456', 'activity_updated', '789');

      const actionInvalidated1 = cache.get('activities', 'user-456:activities:list-1');
      const actionInvalidated2 = cache.get('activityDetails', 'user-456:activity-789:details');

      this.logResult('Action-Based Invalidation',
        actionInvalidated1 === null,
        'Activity list invalidated on activity update'
      );

    } catch (error) {
      this.logResult('Cache Invalidation', false, '', error);
    }
  }

  /**
   * Test concurrent cache access (simplified test)
   */
  async testConcurrentAccess() {
    try {
      let apiCallCount = 0;
      const fastApiCall = async () => {
        apiCallCount++;
        return { id: apiCallCount, timestamp: Date.now() };
      };

      const cacheKey = 'concurrent-test:same-key';
      
      // Clear cache first
      cache.delete('activities', cacheKey);
      
      // First call to populate cache
      const result1 = await getCachedOrFetch('activities', cacheKey, fastApiCall);
      
      // Subsequent calls should use cache
      const result2 = await getCachedOrFetch('activities', cacheKey, fastApiCall);
      const result3 = await getCachedOrFetch('activities', cacheKey, fastApiCall);

      this.logResult('Concurrent Access Safety',
        apiCallCount === 1 && result1.id === result2.id && result2.id === result3.id,
        `API called ${apiCallCount} times for 3 sequential requests`
      );

    } catch (error) {
      this.logResult('Concurrent Access', false, '', error);
    }
  }

  /**
   * Test memory usage with large datasets
   */
  testMemoryUsage() {
    try {
      const initialStats = cache.getStats();
      const initialMemory = initialStats.memoryUsage;

      // Add substantial amount of data
      const largeData = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        name: `Large Activity ${i}`,
        description: 'A'.repeat(1000), // 1KB of text
        coordinates: Array.from({ length: 100 }, (_, j) => [Math.random(), Math.random()])
      }));

      largeData.forEach((data, i) => {
        cache.set('activities', `memory-test-${i}`, data);
      });

      const afterStats = cache.getStats();
      const afterMemory = afterStats.memoryUsage;

      this.logResult('Memory Usage Tracking',
        afterMemory !== initialMemory,
        `Memory usage changed from ${initialMemory} to ${afterMemory}`
      );

      // Clean up
      cache.clear('activities');

    } catch (error) {
      this.logResult('Memory Usage', false, '', error);
    }
  }

  /**
   * Test cache health check functionality
   */
  testCacheHealthCheck() {
    try {
      const cacheManager = require('../services/cacheManager');
      
      const health = cacheManager.healthCheck();

      this.logResult('Health Check Response',
        health.status && health.enabled !== undefined && health.timestamp,
        'Health check returns proper structure'
      );

      this.logResult('Health Check Status',
        health.status === 'healthy',
        `Cache health status: ${health.status}`
      );

    } catch (error) {
      this.logResult('Cache Health Check', false, '', error);
    }
  }

  /**
   * Run all integration tests
   */
  async runAllTests() {
    console.log('🔗 Starting Cache Integration Test Suite...\n');

    try {
      // Core integration tests
      this.testCacheKeyGeneration();
      await this.testCacheFirstStrategy();
      await this.testDifferentCacheTTLs();
      await this.testCacheStatistics();
      
      // Advanced integration tests
      this.testCacheInvalidation();
      await this.testConcurrentAccess();
      this.testMemoryUsage();
      this.testCacheHealthCheck();

    } catch (error) {
      console.error('Integration test suite error:', error);
    }

    return this.printSummary();
  }

  /**
   * Print test summary
   */
  printSummary() {
    console.log('\n📊 Integration Test Summary');
    console.log('============================');

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

    console.log(`\n${passed === total ? '🎉 All integration tests passed!' : '⚠️  Some integration tests failed'}`);
    
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
  const tester = new CacheIntegrationTester();
  tester.runAllTests()
    .then(result => {
      process.exit(result.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Integration test execution failed:', error);
      process.exit(1);
    });
}

module.exports = CacheIntegrationTester;