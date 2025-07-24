/**
 * OAuth Test Runner
 * Comprehensive test suite runner for all OAuth implementation tests
 */

// Load environment variables
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const fs = require('fs');

// Import all test classes
const OAuthUnitTester = require('./oauth-unit-tests');
const OAuthIntegrationTester = require('./oauth-integration-tests');
const EnhancedTokenRefreshTester = require('./oauth-token-refresh-enhanced');
const CSRFProtectionTester = require('./oauth-csrf-protection-test');
const OAuthErrorHandlingTester = require('./oauth-error-handling-test');

class OAuthTestRunner {
  constructor() {
    this.allResults = [];
    this.totalTests = 0;
    this.totalPassed = 0;
    this.totalFailed = 0;
    this.startTime = new Date();
  }

  /**
   * Run all OAuth test suites
   */
  async runAllTests() {
    console.log('🧪 Starting Comprehensive OAuth Test Suite...\n');
    console.log('===============================================\n');

    const testSuites = [
      {
        name: 'Unit Tests',
        tester: new OAuthUnitTester(),
        description: 'Testing individual OAuth components and functions'
      },
      {
        name: 'Integration Tests',
        tester: new OAuthIntegrationTester(),
        description: 'Testing OAuth flow integration with Express server'
      },
      {
        name: 'Enhanced Token Refresh Tests',
        tester: new EnhancedTokenRefreshTester(),
        description: 'Testing token refresh mechanism with edge cases'
      },
      {
        name: 'CSRF Protection Tests',
        tester: new CSRFProtectionTester(),
        description: 'Testing CSRF attack prevention and state parameter security'
      },
      {
        name: 'Error Handling Tests',
        tester: new OAuthErrorHandlingTester(),
        description: 'Testing comprehensive error handling scenarios'
      }
    ];

    for (const suite of testSuites) {
      await this.runTestSuite(suite);
      console.log('\n' + '='.repeat(50) + '\n');
    }

    this.generateComprehensiveReport();
  }

  /**
   * Run individual test suite
   */
  async runTestSuite(suite) {
    console.log(`📋 ${suite.name}`);
    console.log(`${suite.description}\n`);

    try {
      const startTime = Date.now();
      const result = await suite.tester.runAllTests();
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Add timing information
      result.duration = duration;
      result.suiteName = suite.name;

      this.allResults.push(result);
      this.updateTotals(result);

      console.log(`\n⏱️ Test suite completed in ${duration}ms`);
      console.log(`✅ ${result.summary.passed} passed, ❌ ${result.summary.failed} failed`);

    } catch (error) {
      console.error(`❌ Test suite "${suite.name}" failed:`, error.message);
      
      const errorResult = {
        suiteName: suite.name,
        type: 'error',
        summary: { total: 0, passed: 0, failed: 1 },
        error: error.message,
        timestamp: new Date().toISOString()
      };
      
      this.allResults.push(errorResult);
      this.totalFailed += 1;
    }
  }

  /**
   * Update total counters
   */
  updateTotals(result) {
    this.totalTests += result.summary.total;
    this.totalPassed += result.summary.passed;
    this.totalFailed += result.summary.failed;
  }

  /**
   * Generate comprehensive test report
   */
  generateComprehensiveReport() {
    const endTime = new Date();
    const totalDuration = endTime - this.startTime;
    const overallSuccessRate = this.totalTests > 0 ? 
      ((this.totalPassed / this.totalTests) * 100).toFixed(1) : 0;

    console.log('📊 COMPREHENSIVE OAUTH TEST RESULTS');
    console.log('===================================');
    console.log(`Total Test Suites: ${this.allResults.length}`);
    console.log(`Total Tests: ${this.totalTests}`);
    console.log(`Total Passed: ${this.totalPassed}`);
    console.log(`Total Failed: ${this.totalFailed}`);
    console.log(`Overall Success Rate: ${overallSuccessRate}%`);
    console.log(`Total Duration: ${totalDuration}ms\n`);

    // Suite-by-suite breakdown
    console.log('📋 Test Suite Breakdown:');
    console.log('-'.repeat(40));
    
    this.allResults.forEach(result => {
      const status = result.summary.failed === 0 ? '✅' : '❌';
      const rate = result.summary.total > 0 ? 
        ((result.summary.passed / result.summary.total) * 100).toFixed(1) : 0;
      
      console.log(`${status} ${result.suiteName}`);
      console.log(`   ${result.summary.passed}/${result.summary.total} tests passed (${rate}%)`);
      if (result.duration) {
        console.log(`   Duration: ${result.duration}ms`);
      }
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      console.log('');
    });

    // Generate detailed report file
    const comprehensiveReport = {
      overview: {
        testDate: this.startTime.toISOString(),
        totalDuration: totalDuration,
        totalSuites: this.allResults.length,
        totalTests: this.totalTests,
        totalPassed: this.totalPassed,
        totalFailed: this.totalFailed,
        overallSuccessRate: overallSuccessRate
      },
      suiteResults: this.allResults,
      recommendations: this.generateRecommendations(),
      environment: this.getEnvironmentInfo(),
      timestamp: endTime.toISOString()
    };

    // Save comprehensive report
    const reportPath = './oauth-comprehensive-test-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(comprehensiveReport, null, 2));
    
    // Generate summary report
    this.generateSummaryReport(comprehensiveReport);

    console.log('📄 Reports Generated:');
    console.log(`   Detailed: ${reportPath}`);
    console.log(`   Summary: ./oauth-test-summary.md`);

    // Final assessment
    if (this.totalFailed === 0) {
      console.log('\n🎉 ALL OAUTH TESTS PASSED!');
      console.log('Your OAuth implementation is robust and secure.');
    } else {
      console.log('\n⚠️ SOME TESTS FAILED');
      console.log('Please review the failed tests and fix the issues.');
      console.log('Check the detailed report for specific recommendations.');
    }

    return comprehensiveReport;
  }

  /**
   * Generate recommendations based on test results
   */
  generateRecommendations() {
    const recommendations = [];

    // Check for failed test patterns
    this.allResults.forEach(result => {
      if (result.summary.failed > 0) {
        switch (result.type) {
          case 'unit_tests':
            recommendations.push({
              category: 'Unit Tests',
              issue: 'Component-level functionality issues detected',
              recommendation: 'Review individual OAuth component implementations',
              priority: 'high'
            });
            break;
          case 'integration_tests':
            recommendations.push({
              category: 'Integration',
              issue: 'OAuth flow integration issues detected',
              recommendation: 'Check Express server middleware and route configurations',
              priority: 'high'
            });
            break;
          case 'enhanced_token_refresh_tests':
            recommendations.push({
              category: 'Token Refresh',
              issue: 'Token refresh mechanism issues detected',
              recommendation: 'Review token refresh logic and error handling',
              priority: 'medium'
            });
            break;
          case 'csrf_protection_tests':
            recommendations.push({
              category: 'Security',
              issue: 'CSRF protection vulnerabilities detected',
              recommendation: 'Critical: Fix CSRF protection immediately',
              priority: 'critical'
            });
            break;
          case 'oauth_error_handling_tests':
            recommendations.push({
              category: 'Error Handling',
              issue: 'Error handling gaps detected',
              recommendation: 'Improve error handling and user experience',
              priority: 'medium'
            });
            break;
        }
      }
    });

    // General recommendations
    if (this.totalFailed === 0) {
      recommendations.push({
        category: 'Maintenance',
        issue: 'All tests passing',
        recommendation: 'Continue regular testing and monitor for regressions',
        priority: 'low'
      });
    }

    return recommendations;
  }

  /**
   * Get environment information
   */
  getEnvironmentInfo() {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      environment: process.env.NODE_ENV || 'development',
      testRunner: 'OAuth Comprehensive Test Suite v1.0'
    };
  }

  /**
   * Generate markdown summary report
   */
  generateSummaryReport(report) {
    const markdown = `# OAuth Implementation Test Summary

## Overview
- **Test Date:** ${report.overview.testDate}
- **Total Duration:** ${report.overview.totalDuration}ms
- **Test Suites:** ${report.overview.totalSuites}
- **Total Tests:** ${report.overview.totalTests}
- **Success Rate:** ${report.overview.overallSuccessRate}%

## Results
✅ **Passed:** ${report.overview.totalPassed}
❌ **Failed:** ${report.overview.totalFailed}

## Test Suite Details

${report.suiteResults.map(suite => `
### ${suite.suiteName}
- **Tests:** ${suite.summary.passed}/${suite.summary.total} passed
- **Success Rate:** ${suite.summary.total > 0 ? ((suite.summary.passed / suite.summary.total) * 100).toFixed(1) : 0}%
- **Duration:** ${suite.duration || 'N/A'}ms
${suite.error ? `- **Error:** ${suite.error}` : ''}
`).join('')}

## Recommendations

${report.recommendations.map(rec => `
### ${rec.category} (${rec.priority.toUpperCase()})
**Issue:** ${rec.issue}
**Recommendation:** ${rec.recommendation}
`).join('')}

## Environment
- **Node Version:** ${report.environment.nodeVersion}
- **Platform:** ${report.environment.platform}
- **Environment:** ${report.environment.environment}

---
*Generated by ${report.environment.testRunner}*
`;

    fs.writeFileSync('./oauth-test-summary.md', markdown);
  }
}

// Run comprehensive tests if called directly
if (require.main === module) {
  const runner = new OAuthTestRunner();
  
  runner.runAllTests()
    .then((report) => {
      // Exit with appropriate code
      process.exit(report.overview.totalFailed === 0 ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ Test runner execution failed:', error);
      process.exit(1);
    });
}

module.exports = OAuthTestRunner;