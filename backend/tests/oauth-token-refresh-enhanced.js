/**
 * Enhanced Token Refresh Tests
 * Comprehensive tests for token refresh mechanism with expired tokens,
 * race conditions, and error scenarios
 */

// Load environment variables
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const tokenManager = require('../services/tokenManager');
const { refreshTokenIfNeeded } = require('../middleware/tokenRefresh');

class EnhancedTokenRefreshTester {
  constructor() {
    this.testResults = [];
    this.passedTests = 0;
    this.failedTests = 0;
    this.originalFetch = global.fetch;
  }

  /**
   * Run all enhanced token refresh tests
   */
  async runAllTests() {
    console.log('🔄 Starting Enhanced Token Refresh Tests...\n');
    
    await this.testExpiredTokenDetection();
    await this.testAutomaticTokenRefresh();
    await this.testFailedRefreshScenarios();
    await this.testRaceConditionHandling();
    await this.testMiddlewareIntegration();
    await this.testTokenUpdatePersistence();
    await this.testRefreshTokenExpiration();
    
    this.printSummary();
    return this.generateReport();
  }

  /**
   * Test expired token detection
   */
  async testExpiredTokenDetection() {
    console.log('⏰ Testing Expired Token Detection...');

    // Test 1: Expired token detection
    const expiredTokenData = {
      accessToken: 'expired_token',
      refreshToken: 'valid_refresh_token',
      expiresAt: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
      athlete: { id: 123, username: 'testuser' }
    };

    const mockReq = this.createMockRequest();
    await tokenManager.storeTokens(mockReq, expiredTokenData);

    this.test('Expired tokens detected correctly', () => {
      const authStatus = tokenManager.getAuthStatus(mockReq);
      return authStatus.tokenExpired === true && authStatus.authenticated === false;
    });

    // Test 2: Non-expired token detection
    const validTokenData = {
      accessToken: 'valid_token',
      refreshToken: 'valid_refresh_token',
      expiresAt: Math.floor(Date.now() / 1000) + 3600, // Valid for 1 hour
      athlete: { id: 123, username: 'testuser' }
    };

    const mockReq2 = this.createMockRequest();
    await tokenManager.storeTokens(mockReq2, validTokenData);

    this.test('Valid tokens detected correctly', () => {
      const authStatus = tokenManager.getAuthStatus(mockReq2);
      return authStatus.tokenExpired === false && authStatus.authenticated === true;
    });

    // Test 3: Edge case - token expires in next minute
    const soonToExpireTokenData = {
      accessToken: 'soon_expire_token',
      refreshToken: 'valid_refresh_token',
      expiresAt: Math.floor(Date.now() / 1000) + 30, // Expires in 30 seconds
      athlete: { id: 123, username: 'testuser' }
    };

    const mockReq3 = this.createMockRequest();
    await tokenManager.storeTokens(mockReq3, soonToExpireTokenData);

    this.test('Soon-to-expire tokens still valid', () => {
      const authStatus = tokenManager.getAuthStatus(mockReq3);
      return authStatus.tokenExpired === false && authStatus.authenticated === true;
    });
  }

  /**
   * Test automatic token refresh
   */
  async testAutomaticTokenRefresh() {
    console.log('\n🔄 Testing Automatic Token Refresh...');

    // Mock successful Strava API response
    this.mockFetch({
      ok: true,
      json: () => Promise.resolve({
        access_token: 'new_refreshed_token',
        refresh_token: 'new_refresh_token',
        expires_at: Math.floor(Date.now() / 1000) + 3600
      })
    });

    const expiredTokenData = {
      accessToken: 'expired_token',
      refreshToken: 'valid_refresh_token',
      expiresAt: Math.floor(Date.now() / 1000) - 3600,
      athlete: { id: 123, username: 'testuser' }
    };

    const mockReq = this.createMockRequest();
    await tokenManager.storeTokens(mockReq, expiredTokenData);

    await this.asyncTest('Token refresh updates stored tokens', async () => {
      const success = await tokenManager.refreshAccessToken(mockReq);
      if (!success) return false;

      const updatedTokens = tokenManager.getTokens(mockReq);
      return updatedTokens.accessToken === 'new_refreshed_token' &&
             updatedTokens.refreshToken === 'new_refresh_token';
    });

    await this.asyncTest('Authentication status updates after refresh', async () => {
      const authStatus = tokenManager.getAuthStatus(mockReq);
      return authStatus.authenticated === true && authStatus.tokenExpired === false;
    });

    this.restoreFetch();
  }

  /**
   * Test failed refresh scenarios
   */
  async testFailedRefreshScenarios() {
    console.log('\n❌ Testing Failed Refresh Scenarios...');

    // Test 1: Network error during refresh
    this.mockFetch(null, new Error('Network error'));

    const mockReq1 = this.createMockRequest();
    const expiredTokenData = {
      accessToken: 'expired_token',
      refreshToken: 'valid_refresh_token',
      expiresAt: Math.floor(Date.now() / 1000) - 3600,
      athlete: { id: 123, username: 'testuser' }
    };
    await tokenManager.storeTokens(mockReq1, expiredTokenData);

    await this.asyncTest('Network error during refresh handled', async () => {
      const success = await tokenManager.refreshAccessToken(mockReq1);
      return success === false;
    });

    // Test 2: Invalid refresh token
    this.mockFetch({
      ok: false,
      status: 400,
      json: () => Promise.resolve({
        message: 'Bad Request',
        errors: [{ resource: 'RefreshToken', field: 'refresh_token', code: 'invalid' }]
      })
    });

    const mockReq2 = this.createMockRequest();
    await tokenManager.storeTokens(mockReq2, expiredTokenData);

    await this.asyncTest('Invalid refresh token handled', async () => {
      const success = await tokenManager.refreshAccessToken(mockReq2);
      return success === false;
    });

    // Test 3: Missing refresh token
    const mockReq3 = this.createMockRequest();
    const tokenDataNoRefresh = {
      accessToken: 'expired_token',
      expiresAt: Math.floor(Date.now() / 1000) - 3600,
      athlete: { id: 123, username: 'testuser' }
    };
    await tokenManager.storeTokens(mockReq3, tokenDataNoRefresh);

    await this.asyncTest('Missing refresh token handled', async () => {
      const success = await tokenManager.refreshAccessToken(mockReq3);
      return success === false;
    });

    this.restoreFetch();
  }

  /**
   * Test race condition handling
   */
  async testRaceConditionHandling() {
    console.log('\n🏃‍♂️ Testing Race Condition Handling...');

    // Mock delayed Strava API response
    this.mockFetch({
      ok: true,
      json: () => new Promise(resolve => setTimeout(() => resolve({
        access_token: 'race_test_token',
        refresh_token: 'race_test_refresh',
        expires_at: Math.floor(Date.now() / 1000) + 3600
      }), 100))
    });

    const expiredTokenData = {
      accessToken: 'expired_token',
      refreshToken: 'valid_refresh_token',
      expiresAt: Math.floor(Date.now() / 1000) - 3600,
      athlete: { id: 123, username: 'testuser' }
    };

    const mockReq = this.createMockRequest();
    await tokenManager.storeTokens(mockReq, expiredTokenData);

    await this.asyncTest('Concurrent refresh requests handled', async () => {
      // Start multiple refresh operations simultaneously
      const refreshPromises = [
        tokenManager.refreshAccessToken(mockReq),
        tokenManager.refreshAccessToken(mockReq),
        tokenManager.refreshAccessToken(mockReq)
      ];

      const results = await Promise.all(refreshPromises);
      
      // At least one should succeed
      const successCount = results.filter(r => r === true).length;
      return successCount >= 1;
    });

    this.restoreFetch();
  }

  /**
   * Test middleware integration
   */
  async testMiddlewareIntegration() {
    console.log('\n🔧 Testing Middleware Integration...');

    // Mock successful token refresh
    this.mockFetch({
      ok: true,
      json: () => Promise.resolve({
        access_token: 'middleware_refreshed_token',
        refresh_token: 'middleware_refresh_token',
        expires_at: Math.floor(Date.now() / 1000) + 3600
      })
    });

    const expiredTokenData = {
      accessToken: 'expired_token',
      refreshToken: 'valid_refresh_token',
      expiresAt: Math.floor(Date.now() / 1000) - 3600,
      athlete: { id: 123, username: 'testuser' }
    };

    const mockReq = this.createMockRequest();
    await tokenManager.storeTokens(mockReq, expiredTokenData);

    const mockRes = this.createMockResponse();
    let nextCalled = false;
    const mockNext = () => { nextCalled = true; };

    await this.asyncTest('Middleware refreshes expired tokens', async () => {
      await refreshTokenIfNeeded(mockReq, mockRes, mockNext);
      const tokens = tokenManager.getTokens(mockReq);
      return tokens && tokens.accessToken === 'middleware_refreshed_token' && nextCalled;
    });

    this.restoreFetch();
  }

  /**
   * Test token update persistence
   */
  async testTokenUpdatePersistence() {
    console.log('\n💾 Testing Token Update Persistence...');

    const initialTokenData = {
      accessToken: 'initial_token',
      refreshToken: 'initial_refresh',
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      athlete: { id: 123, username: 'testuser', firstname: 'Test', lastname: 'User' }
    };

    const mockReq = this.createMockRequest();
    await tokenManager.storeTokens(mockReq, initialTokenData);

    await this.asyncTest('Token updates preserve athlete data', async () => {
      const updateData = {
        accessToken: 'updated_token',
        refreshToken: 'updated_refresh',
        expiresAt: Math.floor(Date.now() / 1000) + 7200
      };

      await tokenManager.updateTokens(mockReq, updateData);
      const updatedTokens = tokenManager.getTokens(mockReq);

      return updatedTokens.accessToken === 'updated_token' &&
             updatedTokens.athlete.firstname === 'Test' &&
             updatedTokens.updatedAt !== undefined;
    });

    this.test('Updated tokens show correct auth status', () => {
      const authStatus = tokenManager.getAuthStatus(mockReq);
      return authStatus.authenticated === true && authStatus.athlete.firstname === 'Test';
    });
  }

  /**
   * Test refresh token expiration scenarios
   */
  async testRefreshTokenExpiration() {
    console.log('\n⌛ Testing Refresh Token Expiration...');

    // Mock Strava API refresh token expired response
    this.mockFetch({
      ok: false,
      status: 400,
      json: () => Promise.resolve({
        message: 'Bad Request',
        errors: [{ resource: 'RefreshToken', field: 'refresh_token', code: 'expired' }]
      })
    });

    const mockReq = this.createMockRequest();
    const expiredTokenData = {
      accessToken: 'expired_token',
      refreshToken: 'expired_refresh_token',
      expiresAt: Math.floor(Date.now() / 1000) - 3600,
      athlete: { id: 123, username: 'testuser' }
    };
    await tokenManager.storeTokens(mockReq, expiredTokenData);

    await this.asyncTest('Expired refresh token detected', async () => {
      const success = await tokenManager.refreshAccessToken(mockReq);
      return success === false;
    });

    this.test('Auth status reflects expired refresh token', () => {
      const authStatus = tokenManager.getAuthStatus(mockReq);
      return authStatus.authenticated === false;
    });

    this.restoreFetch();
  }

  /**
   * Helper methods
   */
  createMockRequest() {
    return {
      session: {},
      sessionID: `test-session-${Date.now()}-${Math.random()}`
    };
  }

  createMockResponse() {
    return {
      statusCode: 200,
      responseData: null,
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        this.responseData = data;
        return this;
      }
    };
  }

  mockFetch(response, error = null) {
    global.fetch = jest.fn(() => {
      if (error) {
        return Promise.reject(error);
      }
      return Promise.resolve(response);
    });
  }

  restoreFetch() {
    global.fetch = this.originalFetch;
  }

  test(description, testFn) {
    try {
      const result = testFn();
      if (result !== false) {
        this.logTest(description, true, 'Test passed');
      } else {
        this.logTest(description, false, 'Test assertion failed');
      }
    } catch (error) {
      this.logTest(description, false, error.message);
    }
  }

  async asyncTest(description, testFn) {
    try {
      const result = await testFn();
      if (result !== false) {
        this.logTest(description, true, 'Test passed');
      } else {
        this.logTest(description, false, 'Test assertion failed');
      }
    } catch (error) {
      this.logTest(description, false, error.message);
    }
  }

  logTest(name, passed, message) {
    const status = passed ? '✅' : '❌';
    const result = { name, passed, message, timestamp: new Date().toISOString() };
    
    this.testResults.push(result);
    
    if (passed) {
      this.passedTests++;
      console.log(`  ${status} ${name}`);
    } else {
      this.failedTests++;
      console.log(`  ${status} ${name}: ${message}`);
    }
  }

  printSummary() {
    const total = this.passedTests + this.failedTests;
    const successRate = total > 0 ? ((this.passedTests / total) * 100).toFixed(1) : 0;
    
    console.log('\n📊 Enhanced Token Refresh Test Summary:');
    console.log('=======================================');
    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${this.passedTests}`);
    console.log(`Failed: ${this.failedTests}`);
    console.log(`Success Rate: ${successRate}%`);
    
    if (this.failedTests === 0) {
      console.log('\n🎉 All enhanced token refresh tests passed!');
      console.log('Token refresh mechanism is robust and handles edge cases correctly.');
    } else {
      console.log('\n⚠️ Some enhanced tests failed. Review token refresh implementation.');
    }
  }

  generateReport() {
    return {
      type: 'enhanced_token_refresh_tests',
      summary: {
        total: this.passedTests + this.failedTests,
        passed: this.passedTests,
        failed: this.failedTests,
        successRate: this.passedTests + this.failedTests > 0 
          ? ((this.passedTests / (this.passedTests + this.failedTests)) * 100).toFixed(1)
          : 0
      },
      details: this.testResults,
      timestamp: new Date().toISOString()
    };
  }
}

// Mock Jest if not available
if (typeof jest === 'undefined') {
  global.jest = {
    fn: (impl) => impl || (() => {})
  };
}

// Export for use in other test files
module.exports = EnhancedTokenRefreshTester;

// Run tests if called directly
if (require.main === module) {
  const tester = new EnhancedTokenRefreshTester();
  
  tester.runAllTests()
    .then((report) => {
      console.log('\n📋 Enhanced Token Refresh Test Report Generated');
      
      // Save report to file
      const fs = require('fs');
      const reportPath = './oauth-enhanced-token-refresh-report.json';
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`Report saved to: ${reportPath}`);
      
      // Exit with appropriate code
      process.exit(report.summary.failed === 0 ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ Enhanced token refresh test execution failed:', error);
      process.exit(1);
    });
}