/**
 * OAuth Unit Tests
 * Comprehensive unit tests for all OAuth-related functions and components
 */

// Load environment variables
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const tokenService = require('../services/tokenService');
const tokenManager = require('../services/tokenManager');
const sessionSecurity = require('../middleware/sessionSecurity');
const errorHandler = require('../middleware/errorHandler');
const rateLimiting = require('../middleware/rateLimiting');

class OAuthUnitTester {
  constructor() {
    this.testResults = [];
    this.passedTests = 0;
    this.failedTests = 0;
  }

  /**
   * Run all unit tests
   */
  async runAllTests() {
    console.log('🧪 Starting OAuth Unit Tests...\n');
    
    await this.testTokenService();
    await this.testTokenManager();
    await this.testSessionSecurity();
    await this.testErrorHandler();
    await this.testRateLimiting();
    
    this.printSummary();
    return this.generateReport();
  }

  /**
   * Test Token Service Functions
   */
  async testTokenService() {
    console.log('🔐 Testing Token Service Functions...');

    const testTokenData = {
      accessToken: 'test_access_token_12345',
      refreshToken: 'test_refresh_token_67890',
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      athlete: { id: 12345, username: 'test_user' }
    };

    // Test token validation
    this.test('Token validation accepts valid data', () => {
      return tokenService.validateTokenData(testTokenData);
    });

    this.test('Token validation rejects invalid data', () => {
      return !tokenService.validateTokenData({});
    });

    this.test('Token validation rejects missing access token', () => {
      const invalid = { ...testTokenData };
      delete invalid.accessToken;
      return !tokenService.validateTokenData(invalid);
    });

    // Test encryption/decryption
    this.test('Token encryption produces non-empty string', () => {
      const encrypted = tokenService.encryptTokens(testTokenData);
      return typeof encrypted === 'string' && encrypted.length > 0;
    });

    this.test('Token encryption is not reversible without key', () => {
      const encrypted = tokenService.encryptTokens(testTokenData);
      return !encrypted.includes(testTokenData.accessToken);
    });

    this.test('Token decryption recovers original data', () => {
      const encrypted = tokenService.encryptTokens(testTokenData);
      const decrypted = tokenService.decryptTokens(encrypted);
      return JSON.stringify(decrypted) === JSON.stringify(testTokenData);
    });

    this.test('Invalid encrypted data throws error', () => {
      try {
        tokenService.decryptTokens('invalid_encrypted_data');
        return false;
      } catch (error) {
        return true;
      }
    });

    // Test expiration checking
    this.test('Non-expired tokens detected correctly', () => {
      return !tokenService.isTokenExpired(testTokenData);
    });

    this.test('Expired tokens detected correctly', () => {
      const expiredData = { ...testTokenData, expiresAt: Math.floor(Date.now() / 1000) - 3600 };
      return tokenService.isTokenExpired(expiredData);
    });

    // Test token sanitization
    this.test('Token sanitization removes sensitive data', () => {
      const sanitized = tokenService.sanitizeTokenData(testTokenData);
      return sanitized.hasAccessToken && !sanitized.accessToken;
    });

    // Test secure token generation
    this.test('Secure token generation produces valid tokens', () => {
      const token = tokenService.generateSecureToken();
      return typeof token === 'string' && token.length === 64;
    });

    // Test token clearing
    this.test('Token data clearing works', () => {
      const testData = { ...testTokenData };
      tokenService.clearTokenData(testData);
      return Object.keys(testData).length === 0;
    });
  }

  /**
   * Test Token Manager Functions
   */
  async testTokenManager() {
    console.log('\n🏪 Testing Token Manager Functions...');

    const mockRequest = {
      session: {},
      sessionID: 'test-session-12345'
    };

    const testTokenData = {
      accessToken: 'manager_test_token',
      refreshToken: 'manager_refresh_token',
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      athlete: { id: 67890, username: 'manager_test' }
    };

    // Test token storage
    await this.asyncTest('Token storage stores tokens securely', async () => {
      await tokenManager.storeTokens(mockRequest, testTokenData);
      return mockRequest.session.encrypted_strava_tokens !== undefined;
    });

    // Test token retrieval
    this.test('Token retrieval returns stored tokens', () => {
      const retrieved = tokenManager.getTokens(mockRequest);
      return retrieved && retrieved.accessToken === testTokenData.accessToken;
    });

    // Test authentication status
    this.test('Authentication status detection works', () => {
      return tokenManager.isAuthenticated(mockRequest);
    });

    // Test auth status details
    this.test('Auth status provides correct details', () => {
      const status = tokenManager.getAuthStatus(mockRequest);
      return status.authenticated && status.athlete && status.athlete.id === testTokenData.athlete.id;
    });

    // Test access token retrieval
    this.test('Access token retrieval works', () => {
      const accessToken = tokenManager.getAccessToken(mockRequest);
      return accessToken === testTokenData.accessToken;
    });

    // Test refresh token retrieval
    this.test('Refresh token retrieval works', () => {
      const refreshToken = tokenManager.getRefreshToken(mockRequest);
      return refreshToken === testTokenData.refreshToken;
    });

    // Test session validation
    this.test('Session validation works for valid sessions', () => {
      return tokenManager.validateSession(mockRequest);
    });

    this.test('Session validation fails for invalid sessions', () => {
      return !tokenManager.validateSession({});
    });

    // Test token clearing
    this.test('Token clearing removes all tokens', () => {
      tokenManager.clearTokens(mockRequest);
      return !tokenManager.getTokens(mockRequest);
    });

    this.test('Cleared tokens show not authenticated', () => {
      return !tokenManager.isAuthenticated(mockRequest);
    });

    // Test token update functionality
    await this.asyncTest('Token update preserves existing data', async () => {
      await tokenManager.storeTokens(mockRequest, testTokenData);
      const newTokenData = {
        accessToken: 'updated_token',
        expiresAt: Math.floor(Date.now() / 1000) + 7200
      };
      await tokenManager.updateTokens(mockRequest, newTokenData);
      const updated = tokenManager.getTokens(mockRequest);
      return updated.accessToken === 'updated_token' && updated.athlete.id === testTokenData.athlete.id;
    });

    // Test session ID mismatch handling
    this.test('Session ID mismatch clears tokens', () => {
      const mismatchRequest = { ...mockRequest, sessionID: 'different-session' };
      const tokens = tokenManager.getTokens(mismatchRequest);
      return !tokens;
    });
  }

  /**
   * Test Session Security Middleware
   */
  async testSessionSecurity() {
    console.log('\n🛡️ Testing Session Security Middleware...');

    const mockReq = { session: {}, sessionID: 'security-test' };
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: {}
    };
    const mockNext = jest.fn();

    // Test session validation middleware
    this.test('Session validation middleware exists', () => {
      const middleware = sessionSecurity.validateSession();
      return typeof middleware === 'function';
    });

    // Test session security headers
    this.test('Security headers middleware exists', () => {
      const middleware = sessionSecurity.securityHeaders();
      return typeof middleware === 'function';
    });

    // Test authentication requirement middleware  
    this.test('Auth requirement middleware exists', () => {
      const middleware = sessionSecurity.requireAuthWithSession();
      return typeof middleware === 'function';
    });
  }

  /**
   * Test Error Handler Functions
   */
  async testErrorHandler() {
    console.log('\n⚠️ Testing Error Handler Functions...');

    // Test async wrapper function
    this.test('Async wrapper function exists', () => {
      return typeof errorHandler.wrapAsync === 'function';
    });

    // Test error categorization
    this.test('Error categorization works', () => {
      const networkError = new Error('Network error');
      networkError.code = 'ECONNREFUSED';
      const category = errorHandler.categorizeError(networkError);
      return category === 'network_error';
    });

    // Test OAuth error categorization
    this.test('OAuth error categorization works', () => {
      const oauthError = new Error('Access denied');
      oauthError.code = 'access_denied';
      const category = errorHandler.categorizeError(oauthError);
      return category === 'oauth_error';
    });

    // Test error response formatting
    this.test('Error response formatting works', () => {
      const error = new Error('Test error');
      const mockReq = { headers: { 'user-agent': 'test-browser' } };
      const response = errorHandler.formatErrorResponse(error, mockReq);
      return response.error && response.message;
    });

    // Test user-friendly error messages
    this.test('User-friendly error messages generated', () => {
      const error = new Error('Token expired');
      error.code = 'token_expired';
      const message = errorHandler.getUserFriendlyMessage(error);
      return message.includes('authentication') && !message.includes('Token expired');
    });
  }

  /**
   * Test Rate Limiting Functions
   */
  async testRateLimiting() {
    console.log('\n⏱️ Testing Rate Limiting Functions...');

    // Test OAuth rate limit creation
    this.test('OAuth rate limit middleware created', () => {
      const middleware = rateLimiting.createOAuthRateLimit();
      return typeof middleware === 'function';
    });

    // Test API rate limit creation
    this.test('API rate limit middleware created', () => {
      const middleware = rateLimiting.createAPIRateLimit();
      return typeof middleware === 'function';
    });

    // Test Strava rate limit tracking
    this.test('Strava rate limit tracking functions exist', () => {
      return typeof rateLimiting.trackStravaRateLimit === 'function' &&
             typeof rateLimiting.checkStravaRateLimit === 'function';
    });

    // Test rate limit info extraction
    this.test('Rate limit info extraction works', () => {
      const mockHeaders = {
        'x-ratelimit-limit': '600',
        'x-ratelimit-usage': '150'
      };
      const info = rateLimiting.extractRateLimitInfo(mockHeaders);
      return info.limit === 600 && info.usage === 150;
    });
  }

  /**
   * Helper function to run a test
   */
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

  /**
   * Helper function to run an async test
   */
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

  /**
   * Log test result
   */
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

  /**
   * Print test summary
   */
  printSummary() {
    const total = this.passedTests + this.failedTests;
    const successRate = total > 0 ? ((this.passedTests / total) * 100).toFixed(1) : 0;
    
    console.log('\n📊 Unit Test Summary:');
    console.log('=====================');
    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${this.passedTests}`);
    console.log(`Failed: ${this.failedTests}`);
    console.log(`Success Rate: ${successRate}%`);
    
    if (this.failedTests === 0) {
      console.log('\n🎉 All unit tests passed! OAuth components are working correctly.');
    } else {
      console.log('\n⚠️ Some unit tests failed. Review the component implementations.');
    }
  }

  /**
   * Generate test report
   */
  generateReport() {
    return {
      type: 'unit_tests',
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

// Mock Jest functions for testing environments that don't have Jest
if (typeof jest === 'undefined') {
  global.jest = {
    fn: () => ({
      mockReturnThis: () => ({
        mockReturnThis: () => ({}),
        json: () => ({}),
        status: () => ({})
      })
    })
  };
}

// Export for use in other test files
module.exports = OAuthUnitTester;

// Run tests if called directly
if (require.main === module) {
  const tester = new OAuthUnitTester();
  
  tester.runAllTests()
    .then((report) => {
      console.log('\n📋 Unit Test Report Generated');
      
      // Save report to file
      const fs = require('fs');
      const reportPath = './oauth-unit-test-report.json';
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`Report saved to: ${reportPath}`);
      
      // Exit with appropriate code
      process.exit(report.summary.failed === 0 ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ Unit test execution failed:', error);
      process.exit(1);
    });
}