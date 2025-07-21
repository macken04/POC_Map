/**
 * Route Integration Tests
 * Tests the complete integration between auth.js and strava.js routes
 * Validates middleware chain, error handling, and session management
 */

const http = require('http');
const config = require('../config');

class RouteIntegrationTester {
  constructor() {
    this.baseUrl = `http://localhost:${config.getConfig().port}`;
    this.testResults = [];
    this.sessionId = null;
    this.cookies = [];
  }

  /**
   * Make HTTP request with session persistence
   */
  async makeRequest(method, path, options = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const requestOptions = {
        method: method,
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'RouteIntegrationTester/1.0',
          ...options.headers
        }
      };

      // Include cookies for session persistence
      if (this.cookies.length > 0) {
        requestOptions.headers['Cookie'] = this.cookies.join('; ');
      }

      const req = http.request(requestOptions, (res) => {
        let data = '';
        
        // Capture session cookies
        if (res.headers['set-cookie']) {
          this.cookies = res.headers['set-cookie'].map(cookie => cookie.split(';')[0]);
        }

        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const jsonData = data ? JSON.parse(data) : {};
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              data: jsonData
            });
          } catch (error) {
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              data: data,
              parseError: error.message
            });
          }
        });
      });

      req.on('error', reject);

      if (options.body) {
        req.write(JSON.stringify(options.body));
      }

      req.end();
    });
  }

  /**
   * Test helper to record test results
   */
  recordTest(testName, passed, details = {}) {
    const result = {
      test: testName,
      passed,
      timestamp: new Date().toISOString(),
      ...details
    };
    this.testResults.push(result);
    console.log(`[${passed ? 'PASS' : 'FAIL'}] ${testName}`, details.error || '');
    return result;
  }

  /**
   * Test 1: Authentication Status Endpoint Integration
   */
  async testAuthStatusIntegration() {
    try {
      const response = await this.makeRequest('GET', '/auth/status');
      
      const passed = response.statusCode === 200 && 
                    response.data.hasOwnProperty('authenticated') &&
                    response.data.authenticated === false;
      
      return this.recordTest('Auth Status Integration', passed, {
        statusCode: response.statusCode,
        authenticated: response.data.authenticated,
        error: passed ? null : 'Auth status endpoint not working correctly'
      });
    } catch (error) {
      return this.recordTest('Auth Status Integration', false, {
        error: `Request failed: ${error.message}`
      });
    }
  }

  /**
   * Test 2: Unauthenticated Strava API Access (Should Fail)
   */
  async testUnauthenticatedStravaAccess() {
    try {
      const response = await this.makeRequest('GET', '/api/strava/athlete');
      
      const passed = response.statusCode === 401 &&
                    response.data.error === 'Authentication required';
      
      return this.recordTest('Unauthenticated Strava Access Protection', passed, {
        statusCode: response.statusCode,
        error: passed ? null : 'Should reject unauthenticated access with 401'
      });
    } catch (error) {
      return this.recordTest('Unauthenticated Strava Access Protection', false, {
        error: `Request failed: ${error.message}`
      });
    }
  }

  /**
   * Test 3: OAuth Authorization URL Generation
   */
  async testOAuthAuthorizationFlow() {
    try {
      const response = await this.makeRequest('GET', '/auth/strava');
      
      // Should redirect to Strava with proper parameters
      const passed = response.statusCode === 302 &&
                    response.headers.location &&
                    response.headers.location.includes('strava.com/oauth/authorize');
      
      return this.recordTest('OAuth Authorization URL Generation', passed, {
        statusCode: response.statusCode,
        redirectLocation: response.headers.location,
        error: passed ? null : 'Should redirect to Strava authorization URL'
      });
    } catch (error) {
      return this.recordTest('OAuth Authorization URL Generation', false, {
        error: `Request failed: ${error.message}`
      });
    }
  }

  /**
   * Test 4: OAuth Callback Error Handling
   */
  async testOAuthCallbackErrorHandling() {
    try {
      // Test with missing authorization code
      const response = await this.makeRequest('GET', '/auth/strava/callback?error=access_denied');
      
      const passed = response.statusCode >= 400 && response.data.error;
      
      return this.recordTest('OAuth Callback Error Handling', passed, {
        statusCode: response.statusCode,
        errorHandled: !!response.data.error,
        error: passed ? null : 'Should handle OAuth callback errors properly'
      });
    } catch (error) {
      return this.recordTest('OAuth Callback Error Handling', false, {
        error: `Request failed: ${error.message}`
      });
    }
  }

  /**
   * Test 5: CSRF Protection (State Parameter)
   */
  async testCSRFProtection() {
    try {
      // First get a session by accessing /auth/strava
      await this.makeRequest('GET', '/auth/strava');
      
      // Then try callback with invalid state
      const response = await this.makeRequest('GET', '/auth/strava/callback?code=test_code&state=invalid_state');
      
      const passed = response.statusCode >= 400 &&
                    (response.data.error === 'state_mismatch' || 
                     response.data.message?.includes('Security validation failed'));
      
      return this.recordTest('CSRF Protection (State Parameter)', passed, {
        statusCode: response.statusCode,
        csrfDetected: passed,
        error: passed ? null : 'Should detect and reject invalid state parameter'
      });
    } catch (error) {
      return this.recordTest('CSRF Protection (State Parameter)', false, {
        error: `Request failed: ${error.message}`
      });
    }
  }

  /**
   * Test 6: Session Validation Integration
   */
  async testSessionValidation() {
    try {
      // Clear cookies to simulate new session
      this.cookies = [];
      
      const response = await this.makeRequest('GET', '/auth/status');
      
      const passed = response.statusCode === 200 &&
                    response.data.authenticated === false;
      
      return this.recordTest('Session Validation Integration', passed, {
        statusCode: response.statusCode,
        sessionValid: passed,
        error: passed ? null : 'Should handle session validation correctly'
      });
    } catch (error) {
      return this.recordTest('Session Validation Integration', false, {
        error: `Request failed: ${error.message}`
      });
    }
  }

  /**
   * Test 7: Rate Limiting Integration
   */
  async testRateLimitingIntegration() {
    try {
      const requests = [];
      
      // Make multiple rapid requests to test rate limiting
      for (let i = 0; i < 5; i++) {
        requests.push(this.makeRequest('GET', '/api/strava/athlete'));
      }
      
      const responses = await Promise.all(requests);
      
      // All should be 401 (unauthenticated) or 429 (rate limited)
      const allBlocked = responses.every(resp => resp.statusCode === 401 || resp.statusCode === 429);
      
      return this.recordTest('Rate Limiting Integration', allBlocked, {
        responseCodes: responses.map(r => r.statusCode),
        error: allBlocked ? null : 'Rate limiting should protect all routes'
      });
    } catch (error) {
      return this.recordTest('Rate Limiting Integration', false, {
        error: `Request failed: ${error.message}`
      });
    }
  }

  /**
   * Test 8: Error Response Consistency
   */
  async testErrorResponseConsistency() {
    try {
      const authResponse = await this.makeRequest('GET', '/auth/status');
      const stravaResponse = await this.makeRequest('GET', '/api/strava/athlete');
      
      // Both should have consistent error response structure
      const authStructure = authResponse.data.hasOwnProperty('authenticated');
      const stravaStructure = stravaResponse.data.hasOwnProperty('error') && 
                             stravaResponse.data.hasOwnProperty('message');
      
      const passed = authStructure && stravaStructure;
      
      return this.recordTest('Error Response Consistency', passed, {
        authStructureValid: authStructure,
        stravaStructureValid: stravaStructure,
        error: passed ? null : 'Error responses should have consistent structure'
      });
    } catch (error) {
      return this.recordTest('Error Response Consistency', false, {
        error: `Request failed: ${error.message}`
      });
    }
  }

  /**
   * Test 9: Middleware Chain Integration
   */
  async testMiddlewareChainIntegration() {
    try {
      // Test that all Strava endpoints use the same middleware chain
      const endpoints = [
        '/api/strava/athlete',
        '/api/strava/activities',
        '/api/strava/activities/search'
      ];
      
      const responses = await Promise.all(
        endpoints.map(endpoint => this.makeRequest('GET', endpoint))
      );
      
      // All should return 401 with authentication required
      const consistentAuth = responses.every(resp => 
        resp.statusCode === 401 && resp.data.error === 'Authentication required'
      );
      
      return this.recordTest('Middleware Chain Integration', consistentAuth, {
        responses: responses.map(r => ({ status: r.statusCode, error: r.data.error })),
        error: consistentAuth ? null : 'All Strava endpoints should use consistent middleware'
      });
    } catch (error) {
      return this.recordTest('Middleware Chain Integration', false, {
        error: `Request failed: ${error.message}`
      });
    }
  }

  /**
   * Test 10: Health Check Integration
   */
  async testHealthCheckIntegration() {
    try {
      const response = await this.makeRequest('GET', '/health');
      
      const passed = response.statusCode === 200 &&
                    response.data.status === 'healthy' &&
                    response.data.checks;
      
      return this.recordTest('Health Check Integration', passed, {
        statusCode: response.statusCode,
        healthStatus: response.data.status,
        error: passed ? null : 'Health check should indicate system status'
      });
    } catch (error) {
      return this.recordTest('Health Check Integration', false, {
        error: `Request failed: ${error.message}`
      });
    }
  }

  /**
   * Run all integration tests
   */
  async runAllTests() {
    console.log('Starting Route Integration Tests...\n');
    
    await this.testAuthStatusIntegration();
    await this.testUnauthenticatedStravaAccess();
    await this.testOAuthAuthorizationFlow();
    await this.testOAuthCallbackErrorHandling();
    await this.testCSRFProtection();
    await this.testSessionValidation();
    await this.testRateLimitingIntegration();
    await this.testErrorResponseConsistency();
    await this.testMiddlewareChainIntegration();
    await this.testHealthCheckIntegration();
    
    return this.generateReport();
  }

  /**
   * Generate comprehensive test report
   */
  generateReport() {
    const passed = this.testResults.filter(r => r.passed).length;
    const failed = this.testResults.filter(r => !r.passed).length;
    const total = this.testResults.length;
    
    const report = {
      summary: {
        total,
        passed,
        failed,
        passRate: `${Math.round((passed / total) * 100)}%`
      },
      timestamp: new Date().toISOString(),
      results: this.testResults,
      recommendations: this.generateRecommendations()
    };
    
    console.log('\n=== Route Integration Test Report ===');
    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Pass Rate: ${report.summary.passRate}`);
    
    if (failed > 0) {
      console.log('\nFailed Tests:');
      this.testResults.filter(r => !r.passed).forEach(test => {
        console.log(`- ${test.test}: ${test.error}`);
      });
    }
    
    console.log('\nRecommendations:');
    report.recommendations.forEach(rec => console.log(`- ${rec}`));
    
    return report;
  }

  /**
   * Generate recommendations based on test results
   */
  generateRecommendations() {
    const recommendations = [];
    const failedTests = this.testResults.filter(r => !r.passed);
    
    if (failedTests.length === 0) {
      recommendations.push('All integration tests passed! Route integration is working correctly.');
    } else {
      recommendations.push('Some integration tests failed. Review the detailed results above.');
      
      if (failedTests.some(t => t.test.includes('Authentication'))) {
        recommendations.push('Check authentication middleware integration between routes.');
      }
      
      if (failedTests.some(t => t.test.includes('CSRF'))) {
        recommendations.push('Verify CSRF protection is working correctly in OAuth flow.');
      }
      
      if (failedTests.some(t => t.test.includes('Rate Limiting'))) {
        recommendations.push('Review rate limiting configuration and middleware chain.');
      }
      
      if (failedTests.some(t => t.test.includes('Error'))) {
        recommendations.push('Ensure consistent error handling across all routes.');
      }
    }
    
    return recommendations;
  }
}

// Export for use in other test files
module.exports = RouteIntegrationTester;

// Run tests if called directly
if (require.main === module) {
  const tester = new RouteIntegrationTester();
  
  // Check if server is running
  console.log('Checking if server is running...');
  tester.makeRequest('GET', '/health')
    .then(response => {
      if (response.statusCode === 200) {
        console.log('Server is running. Starting integration tests...\n');
        return tester.runAllTests();
      } else {
        throw new Error(`Server not responding. Status: ${response.statusCode}`);
      }
    })
    .then(report => {
      console.log('\nIntegration tests completed.');
      
      if (report.summary.failed > 0) {
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Integration test error:', error.message);
      console.log('\nPlease ensure the server is running with: npm run dev');
      process.exit(1);
    });
}