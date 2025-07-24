/**
 * CSRF Protection Tests
 * Comprehensive tests for Cross-Site Request Forgery protection in OAuth flow
 */

// Load environment variables
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const crypto = require('crypto');
const config = require('../config');

class CSRFProtectionTester {
  constructor() {
    this.appConfig = config.getConfig();
    this.testResults = [];
    this.passedTests = 0;
    this.failedTests = 0;
    this.baseUrl = 'http://localhost:3000';
    this.testTimeout = 15000;
  }

  /**
   * Run all CSRF protection tests
   */
  async runAllTests() {
    console.log('🛡️ Starting CSRF Protection Tests...\n');
    
    // Check if server is running
    const serverRunning = await this.checkServerHealth();
    if (!serverRunning) {
      console.log('❌ Server not running. Start server with: npm run dev');
      this.logTest('Server availability', false, 'Server not running for CSRF tests');
    } else {
      await this.testStateParameterGeneration();
      await this.testStateParameterValidation();
      await this.testCSRFAttackPrevention();
      await this.testSessionStateBinding();
      await this.testStateParameterUniqueness();
      await this.testTimingAttackProtection();
    }
    
    this.printSummary();
    return this.generateReport();
  }

  /**
   * Check if server is running
   */
  async checkServerHealth() {
    try {
      const response = await this.makeRequest('GET', '/auth/status');
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Test state parameter generation
   */
  async testStateParameterGeneration() {
    console.log('🔐 Testing State Parameter Generation...');

    // Test 1: State parameter is generated
    await this.testEndpoint(
      'GET',
      '/auth/strava',
      302,
      'State parameter generated in authorization URL',
      async (response) => {
        const location = response.headers.get('location');
        const stateMatch = location?.match(/state=([^&]+)/);
        return stateMatch && stateMatch[1].length > 0;
      }
    );

    // Test 2: State parameter has sufficient entropy
    await this.testEndpoint(
      'GET',
      '/auth/strava',
      302,
      'State parameter has sufficient entropy (64 characters)',
      async (response) => {
        const location = response.headers.get('location');
        const stateMatch = location?.match(/state=([^&]+)/);
        return stateMatch && stateMatch[1].length === 64; // 32 bytes * 2 (hex)
      }
    );

    // Test 3: State parameter is URL-safe
    await this.testEndpoint(
      'GET',
      '/auth/strava',
      302,
      'State parameter is URL-safe (hex format)',
      async (response) => {
        const location = response.headers.get('location');
        const stateMatch = location?.match(/state=([^&]+)/);
        const state = stateMatch?.[1];
        const hexPattern = /^[a-f0-9]{64}$/i;
        return state && hexPattern.test(state);
      }
    );

    // Test 4: State parameter is cryptographically random
    const states = [];
    for (let i = 0; i < 5; i++) {
      try {
        const response = await this.makeRequest('GET', '/auth/strava');
        const location = response.headers.get('location');
        const stateMatch = location?.match(/state=([^&]+)/);
        if (stateMatch) {
          states.push(stateMatch[1]);
        }
      } catch (error) {
        // Continue collecting states
      }
    }

    this.logTest(
      'State parameters are cryptographically random',
      states.length === 5 && new Set(states).size === 5,
      states.length === 5 ? 'All states unique' : `Only ${new Set(states).size} unique states out of ${states.length}`
    );
  }

  /**
   * Test state parameter validation
   */
  async testStateParameterValidation() {
    console.log('\n✅ Testing State Parameter Validation...');

    const { cookies } = await this.createSessionWithState();

    // Test 1: Missing state parameter
    await this.testEndpoint(
      'GET',
      '/auth/strava/callback?code=test123',
      400,
      'Missing state parameter rejected',
      async (response) => {
        const data = await response.json();
        return data.error === 'missing_state';
      },
      cookies
    );

    // Test 2: Empty state parameter
    await this.testEndpoint(
      'GET',
      '/auth/strava/callback?code=test123&state=',
      400,
      'Empty state parameter rejected',
      async (response) => {
        const data = await response.json();
        return data.error === 'missing_state';
      },
      cookies
    );

    // Test 3: Invalid state parameter format
    await this.testEndpoint(
      'GET',
      '/auth/strava/callback?code=test123&state=invalid_format',
      400,
      'Invalid state parameter format rejected',
      async (response) => {
        const data = await response.json();
        return data.error === 'state_mismatch';
      },
      cookies
    );

    // Test 4: Tampered state parameter
    await this.testEndpoint(
      'GET',
      '/auth/strava/callback?code=test123&state=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      400,
      'Tampered state parameter rejected',
      async (response) => {
        const data = await response.json();
        return data.error === 'state_mismatch';
      },
      cookies
    );
  }

  /**
   * Test CSRF attack prevention
   */
  async testCSRFAttackPrevention() {
    console.log('\n🎯 Testing CSRF Attack Prevention...');

    // Test 1: Cross-origin request with stolen state
    const { state: stolenState, cookies: victimCookies } = await this.createSessionWithState();
    
    // Simulate attacker making request with victim's state but attacker's session
    const attackerCookies = await this.createNewSession();
    
    await this.testEndpoint(
      'GET',
      `/auth/strava/callback?code=test123&state=${stolenState}`,
      400,
      'Cross-session state attack prevented',
      async (response) => {
        const data = await response.json();
        return data.error === 'state_mismatch';
      },
      attackerCookies
    );

    // Test 2: Replay attack with old state
    const oldSession = await this.createSessionWithState();
    // Clear session by making new request
    await this.makeRequest('GET', '/auth/status');
    
    await this.testEndpoint(
      'GET',
      `/auth/strava/callback?code=test123&state=${oldSession.state}`,
      400,
      'Replay attack with old state prevented',
      async (response) => {
        const data = await response.json();
        return data.error === 'state_mismatch';
      },
      oldSession.cookies
    );

    // Test 3: Forged callback request without prior authorization
    const randomState = crypto.randomBytes(32).toString('hex');
    await this.testEndpoint(
      'GET',
      `/auth/strava/callback?code=test123&state=${randomState}`,
      400,
      'Forged callback without authorization prevented',
      async (response) => {
        const data = await response.json();
        return data.error === 'state_mismatch';
      }
    );
  }

  /**
   * Test session-state binding
   */
  async testSessionStateBinding() {
    console.log('\n🔗 Testing Session-State Binding...');

    // Test 1: State tied to specific session
    const session1 = await this.createSessionWithState();
    const session2 = await this.createSessionWithState();

    // Try to use session1's state with session2's cookies
    await this.testEndpoint(
      'GET',
      `/auth/strava/callback?code=test123&state=${session1.state}`,
      400,
      'State bound to specific session',
      async (response) => {
        const data = await response.json();
        return data.error === 'state_mismatch';
      },
      session2.cookies
    );

    // Test 2: Valid state works with correct session
    await this.testEndpoint(
      'GET',
      `/auth/strava/callback?code=test123&state=${session1.state}`,
      500, // Will fail at token exchange, but state validation should pass
      'Valid state works with correct session',
      async (response) => {
        const data = await response.json();
        // Should fail at token exchange, not state validation
        return !data.error || data.error !== 'state_mismatch';
      },
      session1.cookies
    );
  }

  /**
   * Test state parameter uniqueness
   */
  async testStateParameterUniqueness() {
    console.log('\n🔄 Testing State Parameter Uniqueness...');

    const statesGenerated = new Set();
    const testIterations = 10;
    let uniqueCount = 0;

    for (let i = 0; i < testIterations; i++) {
      try {
        const response = await this.makeRequest('GET', '/auth/strava');
        const location = response.headers.get('location');
        const stateMatch = location?.match(/state=([^&]+)/);
        
        if (stateMatch) {
          const state = stateMatch[1];
          if (!statesGenerated.has(state)) {
            uniqueCount++;
            statesGenerated.add(state);
          }
        }
      } catch (error) {
        // Continue test
      }
    }

    this.logTest(
      'All generated states are unique',
      uniqueCount === testIterations,
      `${uniqueCount}/${testIterations} states were unique`
    );

    // Test entropy quality
    const entropyTest = Array.from(statesGenerated).every(state => {
      const bytes = Buffer.from(state, 'hex');
      const uniqueBytes = new Set(bytes).size;
      return uniqueBytes > 10; // Good entropy should have diverse byte values
    });

    this.logTest(
      'Generated states have good entropy',
      entropyTest,
      entropyTest ? 'Entropy quality sufficient' : 'Low entropy detected'
    );
  }

  /**
   * Test timing attack protection
   */
  async testTimingAttackProtection() {
    console.log('\n⏱️ Testing Timing Attack Protection...');

    const { state: validState, cookies } = await this.createSessionWithState();
    const invalidState = crypto.randomBytes(32).toString('hex');

    // Measure timing for valid vs invalid state comparison
    const timingResults = [];

    for (let i = 0; i < 5; i++) {
      // Test invalid state timing
      const startInvalid = process.hrtime.bigint();
      try {
        await this.makeRequest('GET', `/auth/strava/callback?code=test&state=${invalidState}`, cookies);
      } catch (error) {
        // Expected to fail
      }
      const endInvalid = process.hrtime.bigint();
      
      // Test valid state timing (will fail at token exchange but state validation succeeds)
      const startValid = process.hrtime.bigint();
      try {
        await this.makeRequest('GET', `/auth/strava/callback?code=test&state=${validState}`, cookies);
      } catch (error) {
        // Expected to fail at token exchange
      }
      const endValid = process.hrtime.bigint();

      timingResults.push({
        invalidTime: Number(endInvalid - startInvalid) / 1000000, // Convert to milliseconds
        validTime: Number(endValid - startValid) / 1000000
      });
    }

    // Check if timing differences are not consistently revealing
    const avgInvalidTime = timingResults.reduce((sum, r) => sum + r.invalidTime, 0) / timingResults.length;
    const avgValidTime = timingResults.reduce((sum, r) => sum + r.validTime, 0) / timingResults.length;
    const timingDifference = Math.abs(avgValidTime - avgInvalidTime);

    this.logTest(
      'Timing attack protection (small timing differences)',
      timingDifference < 100, // Less than 100ms difference is acceptable
      `Average timing difference: ${timingDifference.toFixed(2)}ms`
    );
  }

  /**
   * Helper: Create session with state parameter
   */
  async createSessionWithState() {
    const response = await this.makeRequest('GET', '/auth/strava');
    const setCookie = response.headers.get('set-cookie');
    const cookies = setCookie ? setCookie.split(',').map(c => c.split(';')[0]).join('; ') : '';
    
    const location = response.headers.get('location');
    const stateMatch = location?.match(/state=([^&]+)/);
    const state = stateMatch ? stateMatch[1] : null;

    return { cookies, state };
  }

  /**
   * Helper: Create new session
   */
  async createNewSession() {
    const response = await this.makeRequest('GET', '/auth/status');
    const setCookie = response.headers.get('set-cookie');
    return setCookie ? setCookie.split(',').map(c => c.split(';')[0]).join('; ') : '';
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
      'User-Agent': 'CSRF-Protection-Test/1.0'
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
    
    console.log('\n📊 CSRF Protection Test Summary:');
    console.log('=================================');
    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${this.passedTests}`);
    console.log(`Failed: ${this.failedTests}`);
    console.log(`Success Rate: ${successRate}%`);
    
    if (this.failedTests === 0) {
      console.log('\n🎉 All CSRF protection tests passed!');
      console.log('OAuth flow is properly protected against CSRF attacks.');
    } else {
      console.log('\n⚠️ Some CSRF protection tests failed. Review security implementation.');
    }
  }

  /**
   * Generate test report
   */
  generateReport() {
    return {
      type: 'csrf_protection_tests',
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
module.exports = CSRFProtectionTester;

// Run tests if called directly
if (require.main === module) {
  const tester = new CSRFProtectionTester();
  
  tester.runAllTests()
    .then((report) => {
      console.log('\n📋 CSRF Protection Test Report Generated');
      
      // Save report to file
      const fs = require('fs');
      const reportPath = './oauth-csrf-protection-report.json';
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`Report saved to: ${reportPath}`);
      
      // Exit with appropriate code
      process.exit(report.summary.failed === 0 ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ CSRF protection test execution failed:', error);
      process.exit(1);
    });
}