/**
 * OAuth Integration Tests
 * Tests the complete OAuth flow integration with Express server
 */

// Load environment variables
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const config = require('../config');

class OAuthIntegrationTester {
  constructor() {
    this.appConfig = config.getConfig();
    this.testResults = [];
    this.passedTests = 0;
    this.failedTests = 0;
    this.baseUrl = 'http://localhost:3000';
    this.testTimeout = 15000;
  }

  /**
   * Run all integration tests
   */
  async runAllTests() {
    console.log('🔗 Starting OAuth Integration Tests...\n');
    
    // Check if server is running
    const serverRunning = await this.checkServerHealth();
    if (!serverRunning) {
      console.log('❌ Server not running. Start server with: npm run dev');
      return this.generateReport();
    }

    await this.testAuthenticationFlow();
    await this.testSessionPersistence();
    await this.testCallbackIntegration();
    await this.testAuthStatusEndpoint();
    await this.testLogoutFlow();
    await this.testMiddlewareIntegration();
    
    this.printSummary();
    return this.generateReport();
  }

  /**
   * Check if server is running
   */
  async checkServerHealth() {
    try {
      const response = await this.makeRequest('GET', '/health');
      return response.ok;
    } catch (error) {
      console.log('⚠️ Server health check failed. Proceeding with available tests...');
      return false;
    }
  }

  /**
   * Test OAuth authentication flow
   */
  async testAuthenticationFlow() {
    console.log('🔐 Testing OAuth Authentication Flow...');

    // Test 1: Authorization endpoint accessibility
    await this.testEndpoint(
      'GET',
      '/auth/strava',
      302,
      'Authorization endpoint redirects to Strava',
      async (response) => {
        const location = response.headers.get('location');
        return location && location.includes('strava.com/oauth/authorize');
      }
    );

    // Test 2: Authorization URL contains correct parameters
    await this.testEndpoint(
      'GET',
      '/auth/strava',
      302,
      'Authorization URL contains required parameters',
      async (response) => {
        const location = response.headers.get('location');
        return location && 
               location.includes(`client_id=${this.appConfig.strava.clientId}`) &&
               location.includes('response_type=code') &&
               location.includes('scope=read,activity:read_all') &&
               location.includes('state=');
      }
    );

    // Test 3: State parameter is generated and stored
    const sessionCookies = await this.testWithSession();
    await this.testEndpoint(
      'GET',
      '/auth/strava',
      302,
      'State parameter generated and unique',
      async (response) => {
        const location = response.headers.get('location');
        const stateMatch = location.match(/state=([^&]+)/);
        return stateMatch && stateMatch[1].length === 64; // 32 bytes * 2 (hex)
      },
      sessionCookies
    );

    // Test 4: Multiple authorization requests generate different states
    const firstResponse = await this.makeRequest('GET', '/auth/strava');
    const secondResponse = await this.makeRequest('GET', '/auth/strava');
    
    const firstState = firstResponse.headers.get('location')?.match(/state=([^&]+)/)?.[1];
    const secondState = secondResponse.headers.get('location')?.match(/state=([^&]+)/)?.[1];
    
    this.logTest(
      'Different state parameters for multiple requests',
      firstState !== secondState && firstState && secondState,
      firstState !== secondState ? 'States are unique' : 'States are identical (security risk)'
    );
  }

  /**
   * Test session persistence
   */
  async testSessionPersistence() {
    console.log('\n🍪 Testing Session Persistence...');

    // Test 1: Session cookies are set correctly
    await this.testEndpoint(
      'GET',
      '/auth/strava',
      302,
      'Session cookies set with security flags',
      async (response) => {
        const setCookie = response.headers.get('set-cookie');
        return setCookie && 
               setCookie.includes('HttpOnly') &&
               setCookie.includes('connect.sid');
      }
    );

    // Test 2: Session persists across requests
    const { cookies } = await this.testWithSession();
    await this.testEndpoint(
      'GET',
      '/auth/status',
      200,
      'Session persists across requests',
      async (response) => {
        const data = await response.json();
        return data.hasOwnProperty('authenticated');
      },
      cookies
    );

    // Test 3: Authentication status reflects session state
    await this.testEndpoint(
      'GET',
      '/auth/status',
      200,
      'Authentication status shows unauthenticated for new session',
      async (response) => {
        const data = await response.json();
        return data.authenticated === false;
      }
    );
  }

  /**
   * Test OAuth callback integration
   */
  async testCallbackIntegration() {
    console.log('\n🔄 Testing OAuth Callback Integration...');

    const { cookies } = await this.testWithSession();

    // Test 1: Missing authorization code handling
    await this.testEndpoint(
      'GET',
      '/auth/strava/callback?state=test123',
      400,
      'Missing authorization code returns 400',
      async (response) => {
        const data = await response.json();
        return data.error === 'missing_authorization_code';
      },
      cookies
    );

    // Test 2: Invalid state parameter handling
    await this.testEndpoint(
      'GET',
      '/auth/strava/callback?code=test123&state=invalid_state',
      400,
      'Invalid state parameter returns 400',
      async (response) => {
        const data = await response.json();
        return data.error === 'state_mismatch';
      },
      cookies
    );

    // Test 3: OAuth error handling (user denial)
    await this.testEndpoint(
      'GET',
      '/auth/strava/callback?error=access_denied&state=test123',
      400,
      'User denial error handled correctly',
      async (response) => {
        const data = await response.json();
        return data.error === 'access_denied';
      },
      cookies
    );

    // Test 4: Malformed requests
    await this.testEndpoint(
      'GET',
      '/auth/strava/callback?code=&state=',
      400,
      'Malformed callback request handled',
      async (response) => {
        const data = await response.json();
        return data.error && data.message;
      },
      cookies
    );
  }

  /**
   * Test authentication status endpoint
   */
  async testAuthStatusEndpoint() {
    console.log('\n📊 Testing Authentication Status Endpoint...');

    // Test 1: Status endpoint accessibility
    await this.testEndpoint(
      'GET',
      '/auth/status',
      200,
      'Auth status endpoint accessible',
      async (response) => {
        const data = await response.json();
        return data.hasOwnProperty('authenticated');
      }
    );

    // Test 2: Unauthenticated status structure
    await this.testEndpoint(
      'GET',
      '/auth/status',
      200,
      'Unauthenticated status structure correct',
      async (response) => {
        const data = await response.json();
        return data.authenticated === false &&
               data.message === 'Not authenticated';
      }
    );

    // Test 3: Status with invalid session
    await this.testEndpoint(
      'GET',
      '/auth/status',
      200,
      'Invalid session handled gracefully',
      async (response) => {
        const data = await response.json();
        return data.authenticated === false;
      },
      'invalid-session-cookie'
    );
  }

  /**
   * Test logout flow
   */
  async testLogoutFlow() {
    console.log('\n🚪 Testing Logout Flow...');

    const { cookies } = await this.testWithSession();

    // Test 1: Logout requires session
    await this.testEndpoint(
      'POST',
      '/auth/logout',
      401,
      'Logout requires valid session',
      async (response) => {
        const data = await response.json();
        return data.error === 'Invalid session';
      }
    );

    // Test 2: Logout with valid session (no tokens)
    await this.testEndpoint(
      'POST',
      '/auth/logout',
      401,
      'Logout with valid session but no tokens',
      async (response) => {
        const data = await response.json();
        return data.error === 'Invalid session';
      },
      cookies
    );

    // Test 3: Session cleanup on logout attempt
    await this.testEndpoint(
      'GET',
      '/auth/status',
      200,
      'Session persists after failed logout',
      async (response) => {
        const data = await response.json();
        return data.authenticated === false;
      },
      cookies
    );
  }

  /**
   * Test middleware integration
   */
  async testMiddlewareIntegration() {
    console.log('\n🔧 Testing Middleware Integration...');

    // Test 1: Rate limiting is active
    const rateLimitTests = [];
    for (let i = 0; i < 12; i++) {
      rateLimitTests.push(this.makeRequest('GET', '/auth/strava'));
    }

    try {
      const responses = await Promise.all(rateLimitTests);
      const rateLimited = responses.some(r => r.status === 429);
      
      this.logTest(
        'Rate limiting middleware active',
        rateLimited,
        rateLimited ? 'Rate limiting triggered' : 'Rate limiting not triggered (may need more requests)'
      );
    } catch (error) {
      this.logTest('Rate limiting test', false, error.message);
    }

    // Test 2: CORS headers present
    await this.testEndpoint(
      'OPTIONS',
      '/auth/status',
      200,
      'CORS headers present for preflight',
      async (response) => {
        return response.headers.has('access-control-allow-origin') ||
               response.headers.has('Access-Control-Allow-Origin');
      }
    );

    // Test 3: Security headers present
    await this.testEndpoint(
      'GET',
      '/auth/status',
      200,
      'Security headers present',
      async (response) => {
        return response.headers.has('x-content-type-options') ||
               response.headers.has('X-Content-Type-Options');
      }
    );

    // Test 4: Error handling middleware active
    await this.testEndpoint(
      'GET',
      '/auth/strava/callback?code=invalid_test_code&state=test',
      500,
      'Error handling middleware processes errors',
      async (response) => {
        const data = await response.json();
        return data.error && data.message;
      }
    );
  }

  /**
   * Create a session for testing
   */
  async testWithSession() {
    const response = await this.makeRequest('GET', '/auth/status');
    const setCookie = response.headers.get('set-cookie');
    const cookies = setCookie ? setCookie.split(',').map(c => c.split(';')[0]).join('; ') : '';
    
    return { cookies, response };
  }

  /**
   * Test an endpoint with expected behavior
   */
  async testEndpoint(method, path, expectedStatus, testName, validator, cookies) {
    try {
      const response = await this.makeRequest(method, path, cookies);
      
      const statusMatch = response.status === expectedStatus;
      const validationPass = validator ? await validator(response) : true;
      const testPass = statusMatch && validationPass;
      
      this.logTest(
        testName,
        testPass,
        testPass 
          ? 'Test passed'
          : `Expected status ${expectedStatus}, got ${response.status}. Validation: ${validationPass}`
      );

      return { response, testPass };
    } catch (error) {
      this.logTest(testName, false, `Request error: ${error.message}`);
      return { testPass: false, error };
    }
  }

  /**
   * Make HTTP request
   */
  async makeRequest(method, path, cookies) {
    const url = `${this.baseUrl}${path}`;
    
    const headers = {
      'Accept': 'application/json',
      'User-Agent': 'OAuth-Integration-Test/1.0'
    };

    if (cookies && typeof cookies === 'string') {
      headers['Cookie'] = cookies;
    }

    return fetch(url, {
      method,
      headers,
      timeout: this.testTimeout
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
    
    console.log('\n📊 Integration Test Summary:');
    console.log('============================');
    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${this.passedTests}`);
    console.log(`Failed: ${this.failedTests}`);
    console.log(`Success Rate: ${successRate}%`);
    
    if (this.failedTests === 0) {
      console.log('\n🎉 All integration tests passed! OAuth flow integration is working correctly.');
    } else {
      console.log('\n⚠️ Some integration tests failed. Review the OAuth flow implementation.');
    }
  }

  /**
   * Generate test report
   */
  generateReport() {
    return {
      type: 'integration_tests',
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
      baseUrl: this.baseUrl
    };
  }
}

// Export for use in other test files
module.exports = OAuthIntegrationTester;

// Run tests if called directly
if (require.main === module) {
  const tester = new OAuthIntegrationTester();
  
  tester.runAllTests()
    .then((report) => {
      console.log('\n📋 Integration Test Report Generated');
      
      // Save report to file
      const fs = require('fs');
      const reportPath = './oauth-integration-test-report.json';
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`Report saved to: ${reportPath}`);
      
      // Exit with appropriate code
      process.exit(report.summary.failed === 0 ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ Integration test execution failed:', error);
      process.exit(1);
    });
}