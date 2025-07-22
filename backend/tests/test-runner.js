/**
 * Master Test Runner for Mapbox Integration
 * Runs all validation tests and generates comprehensive report
 */

const MapboxIntegrationTest = require('./mapbox-integration-test');
const DPIExportValidator = require('./dpi-export-validation');
const fs = require('fs').promises;
const path = require('path');

class MasterTestRunner {
  constructor() {
    this.startTime = Date.now();
    this.results = {
      integrationTests: null,
      dpiValidation: null,
      summary: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        successRate: '0%',
        executionTime: 0,
        timestamp: new Date().toISOString()
      }
    };
  }

  async runAllTests() {
    console.log('🚀 Starting Comprehensive Mapbox Test Suite...\n');
    
    // Run Integration Tests
    console.log('📋 Running Integration Tests...');
    const integrationTest = new MapboxIntegrationTest();
    this.results.integrationTests = await integrationTest.runAllTests();
    
    console.log('\n📐 Running DPI Export Validation...');
    const dpiValidator = new DPIExportValidator();
    this.results.dpiValidation = dpiValidator.runAllValidations();
    
    // Calculate summary
    this.calculateSummary();
    
    // Generate comprehensive report
    await this.generateReport();
    
    console.log('\n🎯 Master Test Suite Complete!');
    console.log(`📊 Overall Success Rate: ${this.results.summary.successRate}`);
    console.log(`⏱️  Total Execution Time: ${this.results.summary.executionTime}ms`);
    
    return this.results;
  }
  
  calculateSummary() {
    // Safely extract integration test results
    const integrationPassed = (this.results.integrationTests && 
      typeof this.results.integrationTests.passedTests === 'number') ? 
      this.results.integrationTests.passedTests : 0;
    const integrationFailed = (this.results.integrationTests && 
      typeof this.results.integrationTests.failedTests === 'number') ? 
      this.results.integrationTests.failedTests : 0;
    
    // Safely extract DPI validation results
    const dpiPassed = (this.results.dpiValidation && 
      this.results.dpiValidation.results && 
      Array.isArray(this.results.dpiValidation.results)) ? 
      this.results.dpiValidation.results.filter(r => r.success).length : 0;
    const dpiTotal = (this.results.dpiValidation && 
      this.results.dpiValidation.results && 
      Array.isArray(this.results.dpiValidation.results)) ? 
      this.results.dpiValidation.results.length : 0;
    const dpiFailed = dpiTotal - dpiPassed;
    
    const totalTests = (integrationPassed + integrationFailed) + dpiTotal;
    const totalPassed = integrationPassed + dpiPassed;
    const totalFailed = integrationFailed + dpiFailed;
    const successRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : '0';
    
    this.results.summary = {
      totalTests,
      passedTests: totalPassed,
      failedTests: totalFailed,
      successRate: `${successRate}%`,
      executionTime: Date.now() - this.startTime,
      timestamp: new Date().toISOString(),
      breakdown: {
        integrationTests: {
          passed: integrationPassed,
          failed: integrationFailed,
          rate: integrationPassed + integrationFailed > 0 ? 
            `${((integrationPassed / (integrationPassed + integrationFailed)) * 100).toFixed(1)}%` : '0%'
        },
        dpiValidation: {
          passed: dpiPassed,
          failed: dpiFailed,
          rate: dpiTotal > 0 ? `${((dpiPassed / dpiTotal) * 100).toFixed(1)}%` : '0%'
        }
      }
    };
  }
  
  async generateReport() {
    const reportData = {
      ...this.results,
      testEnvironment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        timestamp: new Date().toISOString()
      }
    };
    
    const reportPath = path.join(__dirname, 'comprehensive-test-report.json');
    await fs.writeFile(reportPath, JSON.stringify(reportData, null, 2));
    console.log(`📝 Comprehensive report saved to: ${reportPath}`);
    
    // Also generate a markdown summary
    await this.generateMarkdownSummary();
  }
  
  async generateMarkdownSummary() {
    const { summary } = this.results;
    const markdown = `# Mapbox Integration Test Results

## Summary
- **Total Tests**: ${summary.totalTests}
- **Passed**: ✅ ${summary.passedTests}
- **Failed**: ❌ ${summary.failedTests}
- **Success Rate**: ${summary.successRate}
- **Execution Time**: ${summary.executionTime}ms
- **Timestamp**: ${summary.timestamp}

## Test Breakdown

### Integration Tests
- **Passed**: ${summary.breakdown.integrationTests.passed}
- **Failed**: ${summary.breakdown.integrationTests.failed}
- **Success Rate**: ${summary.breakdown.integrationTests.rate}

### DPI Export Validation
- **Passed**: ${summary.breakdown.dpiValidation.passed}
- **Failed**: ${summary.breakdown.dpiValidation.failed}
- **Success Rate**: ${summary.breakdown.dpiValidation.rate}

## Test Environment
- **Node.js**: ${process.version}
- **Platform**: ${process.platform}
- **Architecture**: ${process.arch}

## Next Steps
${summary.failedTests > 0 ? 
  '⚠️ Some tests failed. Review the detailed report for more information.' :
  '🎉 All tests passed! The Mapbox integration is ready for use.'}

---
*Generated by Mapbox Integration Test Suite*
`;

    const summaryPath = path.join(__dirname, 'test-summary.md');
    await fs.writeFile(summaryPath, markdown);
    console.log(`📄 Markdown summary saved to: ${summaryPath}`);
  }
}

// Export for external usage
module.exports = MasterTestRunner;

// Run tests if this file is executed directly
if (require.main === module) {
  const runner = new MasterTestRunner();
  runner.runAllTests()
    .then(results => {
      const exitCode = results.summary.failedTests > 0 ? 1 : 0;
      process.exit(exitCode);
    })
    .catch(error => {
      console.error('Master test runner failed:', error);
      process.exit(1);
    });
}