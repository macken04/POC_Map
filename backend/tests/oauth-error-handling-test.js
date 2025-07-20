/**
 * OAuth Error Handling Tests
 * Comprehensive tests for all error scenarios and edge cases
 */

const config = require('../config');

// Test configuration
const TEST_CONFIG = {
  baseUrl: 'http://localhost:3000',
  testTimeout: 30000,
  rateLimitDelay: 1000
};

class OAuthErrorHandlingTester {
  constructor() {
    this.appConfig = config.getConfig();
    this.testResults = [];
    this.passedTests = 0;
    this.failedTests = 0;
  }

  /**
   * Run all OAuth error handling tests
   */
  async runAllTests() {
    console.log('🧪 Starting OAuth Error Handling Tests...\n');
    
    const testSuites = [
      () => this.testBasicErrorHandling(),
      () => this.testNetworkErrorHandling(),
      () => this.testRateLimitingHandling(),
      () => this.testSecurityErrorHandling(),
      () => this.testTokenRefreshErrorHandling(),
      () => this.testBrowserErrorPages(),
      () => this.testEdgeCases()
    ];

    for (const testSuite of testSuites) {
      try {
        await testSuite();
        await this.delay(TEST_CONFIG.rateLimitDelay);
      } catch (error) {
        this.logTest('Test Suite Error', false, error.message);
      }
    }

    this.printSummary();
    return this.generateTestReport();
  }

  /**
   * Test basic OAuth error handling
   */
  async testBasicErrorHandling() {
    console.log('📋 Testing Basic OAuth Error Handling...');

    // Test 1: Missing authorization code
    await this.testEndpoint(
      'GET',
      '/auth/strava/callback?state=test123',
      400,
      'Missing authorization code handling',
      (response) => response.error === 'missing_authorization_code'
    );

    // Test 2: Invalid state parameter
    await this.testEndpoint(
      'GET',
      '/auth/strava/callback?code=test&state=invalid',
      400,
      'Invalid state parameter handling',
      (response) => response.error === 'state_mismatch'
    );

    // Test 3: User denied access simulation
    await this.testEndpoint(
      'GET',
      '/auth/strava/callback?error=access_denied&state=test123',
      400,
      'User denied access handling',
      (response) => response.error === 'access_denied'
    );

    // Test 4: Invalid request error
    await this.testEndpoint(
      'GET',
      '/auth/strava/callback?error=invalid_request&state=test123',
      503,
      'Invalid request error handling',
      (response) => response.error === 'invalid_request'
    );
  }

  /**
   * Test network error handling scenarios
   */
  async testNetworkErrorHandling() {
    console.log('🌐 Testing Network Error Handling...');

    // Test timeout scenarios by testing endpoints
    await this.testEndpoint(
      'GET',
      '/auth/status',
      200,
      'Network connectivity test',
      (response) => response.hasOwnProperty('authenticated')
    );

    // Test server error handling
    await this.testEndpoint(
      'GET',
      '/auth/strava/callback?code=invalid_code_that_will_fail&state=test123',
      500,
      'Token exchange network error handling',
      (response) => response.error && response.message
    );
  }

  /**
   * Test rate limiting scenarios
   */
  async testRateLimitingHandling() {
    console.log('⏱️ Testing Rate Limiting...');

    // Test OAuth rate limiting
    const oauthRequests = [];
    for (let i = 0; i < 12; i++) { // Exceed OAuth rate limit (10 per 10 min)
      oauthRequests.push(
        this.makeRequest('GET', '/auth/strava')
      );
    }

    try {
      const responses = await Promise.all(oauthRequests);
      const rateLimitedResponse = responses.find(r => r.status === 429);
      
      this.logTest(
        'OAuth rate limiting enforcement',
        !!rateLimitedResponse,
        rateLimitedResponse ? 'Rate limit correctly enforced' : 'Rate limit not triggered'
      );
    } catch (error) {
      this.logTest('OAuth rate limiting test', false, error.message);
    }

    // Test API rate limiting
    if (this.appConfig.env !== 'production') {
      await this.testEndpoint(
        'GET',
        '/api/strava/athlete',
        401,
        'API rate limiting (unauthenticated)',
        (response) => response.error === 'Authentication required'
      );
    }
  }

  /**
   * Test security error handling
   */
  async testSecurityErrorHandling() {
    console.log('🔒 Testing Security Error Handling...');

    // Test CSRF protection
    await this.testEndpoint(
      'GET',
      '/auth/strava/callback?code=test123&state=malicious_state',
      400,
      'CSRF protection validation',
      (response) => response.error === 'state_mismatch'
    );

    // Test malformed requests
    await this.testEndpoint(
      'GET',
      '/auth/strava/callback?code=&state=',
      400,
      'Malformed request handling',
      (response) => response.error
    );

    // Test session tampering
    await this.testEndpoint(
      'GET',
      '/auth/status',
      200,
      'Session validation',
      (response) => response.authenticated === false
    );
  }

  /**
   * Test token refresh error handling
   */
  async testTokenRefreshErrorHandling() {
    console.log('🔄 Testing Token Refresh Error Handling...');

    // Test unauthenticated token refresh
    await this.testEndpoint(
      'GET',
      '/api/strava/athlete',
      401,
      'Unauthenticated API access',
      (response) => response.error === 'Authentication required'
    );

    // Test expired token handling (simulated)
    await this.testEndpoint(
      'POST',
      '/auth/logout',
      401,
      'Session validation middleware',
      (response) => response.error === 'Invalid session'
    );
  }

  /**
   * Test browser error pages
   */
  async testBrowserErrorPages() {
    console.log('🌐 Testing Browser Error Pages...');

    // Test error page generation
    const testCases = [
      { error: 'access_denied', expectedStatus: 400 },
      { error: 'rate_limited', expectedStatus: 429 },
      { error: 'service_unavailable', expectedStatus: 503 },
      { error: 'server_error', expectedStatus: 500 }
    ];

    for (const testCase of testCases) {
      await this.testEndpoint(
        'GET',
        `/auth/error?error=${testCase.error}&errorId=TEST123`,
        testCase.expectedStatus,
        `Error page for ${testCase.error}`,
        (response, rawResponse) => rawResponse.headers.get('content-type')?.includes('text/html')
      );
    }
  }

  /**
   * Test edge cases and corner scenarios
   */
  async testEdgeCases() {
    console.log('🎯 Testing Edge Cases...');

    // Test extremely long parameters
    const longString = 'a'.repeat(10000);
    await this.testEndpoint(
      'GET',
      `/auth/strava/callback?code=${longString}&state=test`,
      400,
      'Extremely long parameter handling',
      (response) => response.error
    );

    // Test special characters in parameters
    await this.testEndpoint(
      'GET',
      '/auth/strava/callback?code=test%00%01%02&state=test',
      400,
      'Special character handling',
      (response) => response.error
    );

    // Test concurrent requests
    const concurrentRequests = Array(5).fill().map(() => 
      this.makeRequest('GET', '/auth/status')
    );

    try {
      const responses = await Promise.all(concurrentRequests);
      const allSuccessful = responses.every(r => r.status === 200);
      
      this.logTest(
        'Concurrent request handling',
        allSuccessful,
        allSuccessful ? 'All concurrent requests handled' : 'Some concurrent requests failed'
      );
    } catch (error) {
      this.logTest('Concurrent request test', false, error.message);
    }

    // Test error recovery
    await this.testEndpoint(
      'GET',
      '/health',
      200,
      'Server health after error scenarios',
      (response) => response.status === 'healthy'
    );
  }

  /**
   * Test an endpoint with expected behavior
   */
  async testEndpoint(method, path, expectedStatus, testName, validator) {
    try {
      const response = await this.makeRequest(method, path);
      const jsonResponse = await response.json().catch(() => ({}));
      
      const statusMatch = response.status === expectedStatus;
      const validationPass = validator ? validator(jsonResponse, response) : true;
      const testPass = statusMatch && validationPass;
      
      this.logTest(
        testName,
        testPass,
        testPass 
          ? 'Test passed'
          : `Expected status ${expectedStatus}, got ${response.status}. Validation: ${validationPass}`
      );

      return { response, jsonResponse, testPass };
    } catch (error) {
      this.logTest(testName, false, `Network error: ${error.message}`);
      return { testPass: false, error };
    }
  }

  /**
   * Make HTTP request to test endpoint
   */
  async makeRequest(method, path) {
    const url = `${TEST_CONFIG.baseUrl}${path}`;
    
    return fetch(url, {
      method,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'OAuth-Error-Test/1.0'
      },
      timeout: TEST_CONFIG.testTimeout
    });
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
      console.log(`  ${status} ${name}: ${message}`);
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
    
    console.log('\n📊 Test Summary:');
    console.log('================');
    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${this.passedTests}`);
    console.log(`Failed: ${this.failedTests}`);
    console.log(`Success Rate: ${successRate}%`);
    
    if (this.failedTests === 0) {
      console.log('\n🎉 All tests passed! OAuth error handling is working correctly.');
    } else {
      console.log('\n⚠️ Some tests failed. Review the error handling implementation.');
    }
  }

  /**
   * Generate detailed test report
   */
  generateTestReport() {
    return {
      summary: {
        total: this.passedTests + this.failedTests,
        passed: this.passedTests,
        failed: this.failedTests,
        successRate: this.passedTests + this.failedTests > 0 
          ? ((this.passedTests / (this.passedTests + this.failedTests)) * 100).toFixed(1)
          : 0
      },
      details: this.testResults,
      timestamp: new Date().toISOString(),
      environment: this.appConfig.env,
      testConfig: TEST_CONFIG
    };
  }

  /**
   * Helper function to add delay between tests
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export for use in other test files
module.exports = OAuthErrorHandlingTester;

// Run tests if called directly
if (require.main === module) {
  const tester = new OAuthErrorHandlingTester();
  
  tester.runAllTests()
    .then((report) => {
      console.log('\n📋 Detailed Test Report Generated');
      
      // Save report to file
      const fs = require('fs');
      const reportPath = './oauth-error-test-report.json';
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`Report saved to: ${reportPath}`);
      
      // Exit with appropriate code
      process.exit(report.summary.failed === 0 ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}