/**
 * Comprehensive Export Functionality Test Suite
 * Runs all export-related tests in a coordinated manner
 * 
 * Run with: node export-functionality-test-suite.js
 * Options:
 *   --quick: Run only fast tests
 *   --full: Run all tests including visual regression
 *   --browser-only: Run only cross-browser tests
 *   --quality-only: Run only quality optimization tests
 */

const path = require('path');
const fs = require('fs').promises;

// Import test classes
const ImageQualityOptimizationTester = require('./image-quality-optimization-test');
const CrossBrowserExportTester = require('./cross-browser-export-test');
const VisualRegressionTester = require('./visual-regression-test');

class ExportFunctionalityTestSuite {
  constructor(options = {}) {
    this.options = {
      runQuick: options.runQuick || false,
      runFull: options.runFull || false,
      browserOnly: options.browserOnly || false,
      qualityOnly: options.qualityOnly || false,
      skipVisual: options.skipVisual || false,
      generateReport: options.generateReport !== false,
      cleanupOnComplete: options.cleanupOnComplete !== false
    };

    this.suiteResults = {
      testSuites: {},
      overallSummary: {
        totalSuites: 0,
        passedSuites: 0,
        failedSuites: 0,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        errors: []
      },
      startTime: Date.now(),
      environment: this.getEnvironmentInfo()
    };

    // Define test suite configurations
    this.testSuites = [
      {
        name: 'Image Quality Optimization',
        class: ImageQualityOptimizationTester,
        enabled: !this.options.browserOnly,
        priority: 'high',
        estimatedDuration: 180, // seconds
        description: 'Tests format-specific quality settings, compression, and file size optimization'
      },
      {
        name: 'Cross-Browser Export',
        class: CrossBrowserExportTester,
        enabled: !this.options.qualityOnly,
        priority: 'high',
        estimatedDuration: 300, // seconds
        description: 'Tests export functionality across different browser configurations'
      },
      {
        name: 'Visual Regression',
        class: VisualRegressionTester,
        enabled: !this.options.skipVisual && !this.options.runQuick && !this.options.browserOnly && !this.options.qualityOnly,
        priority: 'medium',
        estimatedDuration: 240, // seconds
        description: 'Compares map export outputs against baseline images'
      }
    ];
  }

  /**
   * Get environment information for the report
   */
  getEnvironmentInfo() {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
      workingDirectory: process.cwd()
    };
  }

  /**
   * Run the complete export functionality test suite
   */
  async runTestSuite() {
    console.log('🚀 Starting Export Functionality Test Suite...\n');
    console.log(this.getTestPlan());

    // Create results directory
    const resultsDir = path.join(__dirname, 'results');
    await fs.mkdir(resultsDir, { recursive: true });

    // Run enabled test suites
    const enabledSuites = this.testSuites.filter(suite => suite.enabled);
    
    for (const suiteConfig of enabledSuites) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`🧪 Running: ${suiteConfig.name}`);
      console.log(`📝 ${suiteConfig.description}`);
      console.log(`⏱️  Estimated duration: ${suiteConfig.estimatedDuration}s`);
      console.log('='.repeat(80));

      try {
        const suiteStartTime = Date.now();
        const tester = new suiteConfig.class();
        const results = await tester.runAllTests();
        const suiteDuration = Date.now() - suiteStartTime;

        // Record suite results
        this.suiteResults.testSuites[suiteConfig.name] = {
          ...results,
          duration: suiteDuration,
          config: suiteConfig,
          status: results.summary.failed === 0 ? 'passed' : 'failed'
        };

        // Update overall summary
        this.suiteResults.overallSummary.totalSuites++;
        this.suiteResults.overallSummary.totalTests += results.summary.totalTests;
        this.suiteResults.overallSummary.passedTests += results.summary.passed;
        this.suiteResults.overallSummary.failedTests += results.summary.failed;

        if (results.summary.failed === 0) {
          this.suiteResults.overallSummary.passedSuites++;
          console.log(`✅ ${suiteConfig.name}: All tests passed (${(suiteDuration / 1000).toFixed(2)}s)`);
        } else {
          this.suiteResults.overallSummary.failedSuites++;
          console.log(`❌ ${suiteConfig.name}: ${results.summary.failed} tests failed (${(suiteDuration / 1000).toFixed(2)}s)`);
          this.suiteResults.overallSummary.errors.push(...results.summary.errors);
        }

      } catch (error) {
        console.error(`🚨 ${suiteConfig.name}: Suite execution failed - ${error.message}`);
        
        this.suiteResults.testSuites[suiteConfig.name] = {
          status: 'error',
          error: error.message,
          config: suiteConfig
        };
        
        this.suiteResults.overallSummary.totalSuites++;
        this.suiteResults.overallSummary.failedSuites++;
        this.suiteResults.overallSummary.errors.push(`${suiteConfig.name}: ${error.message}`);
      }
    }

    // Generate comprehensive report
    if (this.options.generateReport) {
      await this.generateComprehensiveReport(resultsDir);
    }

    // Display final summary
    this.displayFinalSummary();

    // Cleanup if requested
    if (this.options.cleanupOnComplete) {
      await this.cleanup();
    }

    return this.suiteResults;
  }

  /**
   * Get test execution plan
   */
  getTestPlan() {
    const enabledSuites = this.testSuites.filter(suite => suite.enabled);
    const totalEstimatedTime = enabledSuites.reduce((sum, suite) => sum + suite.estimatedDuration, 0);

    let plan = '📋 TEST EXECUTION PLAN\n';
    plan += '='.repeat(50) + '\n';
    plan += `Mode: ${this.getExecutionMode()}\n`;
    plan += `Suites to run: ${enabledSuites.length}\n`;
    plan += `Estimated time: ${Math.ceil(totalEstimatedTime / 60)} minutes\n\n`;

    plan += 'Test Suites:\n';
    enabledSuites.forEach((suite, index) => {
      const status = suite.enabled ? '✅' : '⏸️ ';
      plan += `${index + 1}. ${status} ${suite.name} (${suite.estimatedDuration}s)\n`;
      plan += `   ${suite.description}\n`;
    });

    return plan;
  }

  /**
   * Get execution mode description
   */
  getExecutionMode() {
    if (this.options.runQuick) return 'Quick (essential tests only)';
    if (this.options.runFull) return 'Full (all tests including visual regression)';
    if (this.options.browserOnly) return 'Browser Focus (cross-browser tests only)';
    if (this.options.qualityOnly) return 'Quality Focus (quality optimization tests only)';
    return 'Standard (core functionality tests)';
  }

  /**
   * Generate comprehensive test report
   */
  async generateComprehensiveReport(resultsDir) {
    const reportPath = path.join(resultsDir, `export-test-report-${Date.now()}.json`);
    const htmlReportPath = path.join(resultsDir, `export-test-report-${Date.now()}.html`);

    // Generate JSON report
    await fs.writeFile(reportPath, JSON.stringify(this.suiteResults, null, 2));

    // Generate HTML report
    const htmlReport = this.generateHTMLReport();
    await fs.writeFile(htmlReportPath, htmlReport);

    console.log(`\n📊 Comprehensive reports generated:`);
    console.log(`   JSON: ${reportPath}`);
    console.log(`   HTML: ${htmlReportPath}`);
  }

  /**
   * Generate HTML report
   */
  generateHTMLReport() {
    const duration = Date.now() - this.suiteResults.startTime;
    const overallPassRate = this.suiteResults.overallSummary.totalTests > 0 
      ? ((this.suiteResults.overallSummary.passedTests / this.suiteResults.overallSummary.totalTests) * 100).toFixed(1)
      : 0;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Export Functionality Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; padding: 20px; background: #2c3e50; color: white; border-radius: 8px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { padding: 20px; background: #ecf0f1; border-radius: 8px; text-align: center; }
        .metric h3 { margin: 0 0 10px 0; color: #2c3e50; }
        .metric .value { font-size: 2em; font-weight: bold; color: #27ae60; }
        .metric .value.failed { color: #e74c3c; }
        .suite { margin-bottom: 30px; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; }
        .suite-header { padding: 15px; background: #34495e; color: white; }
        .suite-content { padding: 20px; }
        .test-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px; }
        .test-item { padding: 15px; border: 1px solid #ddd; border-radius: 4px; }
        .test-item.passed { border-left: 4px solid #27ae60; }
        .test-item.failed { border-left: 4px solid #e74c3c; }
        .error-list { background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; padding: 15px; }
        .error-item { margin: 5px 0; color: #721c24; }
        .environment { background: #d4edda; border: 1px solid #c3e6cb; border-radius: 4px; padding: 15px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎯 Export Functionality Test Report</h1>
            <p>Generated: ${new Date().toLocaleString()}</p>
            <p>Duration: ${(duration / 1000).toFixed(2)}s</p>
        </div>

        <div class="summary">
            <div class="metric">
                <h3>Test Suites</h3>
                <div class="value">${this.suiteResults.overallSummary.passedSuites}/${this.suiteResults.overallSummary.totalSuites}</div>
                <small>Passed</small>
            </div>
            <div class="metric">
                <h3>Total Tests</h3>
                <div class="value">${this.suiteResults.overallSummary.totalTests}</div>
                <small>Executed</small>
            </div>
            <div class="metric">
                <h3>Pass Rate</h3>
                <div class="value ${overallPassRate < 100 ? 'failed' : ''}">${overallPassRate}%</div>
                <small>Success Rate</small>
            </div>
            <div class="metric">
                <h3>Failed Tests</h3>
                <div class="value ${this.suiteResults.overallSummary.failedTests > 0 ? 'failed' : ''}">${this.suiteResults.overallSummary.failedTests}</div>
                <small>Issues Found</small>
            </div>
        </div>

        ${Object.entries(this.suiteResults.testSuites).map(([suiteName, suiteData]) => `
            <div class="suite">
                <div class="suite-header">
                    <h2>${suiteData.status === 'passed' ? '✅' : '❌'} ${suiteName}</h2>
                    <p>${suiteData.config ? suiteData.config.description : 'Test suite'}</p>
                    ${suiteData.duration ? `<small>Duration: ${(suiteData.duration / 1000).toFixed(2)}s</small>` : ''}
                </div>
                <div class="suite-content">
                    ${suiteData.tests ? `
                        <div class="test-grid">
                            ${Object.entries(suiteData.tests).map(([testName, testData]) => `
                                <div class="test-item ${testData.passed ? 'passed' : 'failed'}">
                                    <h4>${testData.passed ? '✅' : '❌'} ${testName}</h4>
                                    <p>${testData.message || testData.error || 'No details available'}</p>
                                    ${testData.details ? `<small>${JSON.stringify(testData.details)}</small>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    ` : `
                        <p>${suiteData.error || 'No test details available'}</p>
                    `}
                </div>
            </div>
        `).join('')}

        ${this.suiteResults.overallSummary.errors.length > 0 ? `
            <div class="error-list">
                <h3>❌ Errors and Failures</h3>
                ${this.suiteResults.overallSummary.errors.map(error => `
                    <div class="error-item">• ${error}</div>
                `).join('')}
            </div>
        ` : ''}

        <div class="environment">
            <h3>🖥️ Test Environment</h3>
            <p><strong>Node.js:</strong> ${this.suiteResults.environment.nodeVersion}</p>
            <p><strong>Platform:</strong> ${this.suiteResults.environment.platform} (${this.suiteResults.environment.arch})</p>
            <p><strong>Working Directory:</strong> ${this.suiteResults.environment.workingDirectory}</p>
            <p><strong>Memory Usage:</strong> ${(this.suiteResults.environment.memory.heapUsed / 1024 / 1024).toFixed(2)}MB heap used</p>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Display final summary
   */
  displayFinalSummary() {
    const duration = Date.now() - this.suiteResults.startTime;
    const overallPassRate = this.suiteResults.overallSummary.totalTests > 0 
      ? ((this.suiteResults.overallSummary.passedTests / this.suiteResults.overallSummary.totalTests) * 100).toFixed(1)
      : 0;

    console.log('\n' + '='.repeat(80));
    console.log('🎯 EXPORT FUNCTIONALITY TEST SUITE SUMMARY');
    console.log('='.repeat(80));
    console.log(`Execution Mode: ${this.getExecutionMode()}`);
    console.log(`Total Duration: ${(duration / 1000).toFixed(2)}s (${Math.ceil(duration / 60000)} minutes)`);
    console.log(`Test Suites: ${this.suiteResults.overallSummary.passedSuites}/${this.suiteResults.overallSummary.totalSuites} passed`);
    console.log(`Total Tests: ${this.suiteResults.overallSummary.totalTests}`);
    console.log(`Passed: ${this.suiteResults.overallSummary.passedTests}`);
    console.log(`Failed: ${this.suiteResults.overallSummary.failedTests}`);
    console.log(`Overall Pass Rate: ${overallPassRate}%`);

    // Suite-by-suite breakdown
    console.log('\n📊 Suite Breakdown:');
    for (const [suiteName, suiteData] of Object.entries(this.suiteResults.testSuites)) {
      const status = suiteData.status === 'passed' ? '✅' : suiteData.status === 'error' ? '🚨' : '❌';
      const duration = suiteData.duration ? `(${(suiteData.duration / 1000).toFixed(2)}s)` : '';
      console.log(`  ${status} ${suiteName} ${duration}`);
      
      if (suiteData.summary) {
        console.log(`     ${suiteData.summary.passed}/${suiteData.summary.totalTests} tests passed`);
      }
    }

    if (this.suiteResults.overallSummary.errors.length > 0) {
      console.log('\n❌ CRITICAL ISSUES:');
      this.suiteResults.overallSummary.errors.slice(0, 5).forEach(error => {
        console.log(`  • ${error}`);
      });
      
      if (this.suiteResults.overallSummary.errors.length > 5) {
        console.log(`  ... and ${this.suiteResults.overallSummary.errors.length - 5} more errors`);
      }
    }

    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    if (this.suiteResults.overallSummary.failedTests === 0) {
      console.log('  🎉 All tests passed! Export functionality is working correctly.');
      console.log('  🔄 Consider running full test suite periodically to catch regressions.');
    } else {
      console.log('  🔧 Review failed tests and fix underlying issues.');
      console.log('  📊 Check detailed reports for specific failure information.');
      console.log('  🧪 Run individual test suites for focused debugging.');
    }

    console.log('='.repeat(80));
  }

  /**
   * Cleanup test artifacts
   */
  async cleanup() {
    console.log('\n🧹 Cleaning up test artifacts...');
    
    try {
      const tempDir = path.join(__dirname, 'temp');
      await fs.rmdir(tempDir, { recursive: true });
      console.log('✅ Cleanup completed');
    } catch (error) {
      console.log(`⚠️  Cleanup warning: ${error.message}`);
    }
  }

  /**
   * Static method to run with command line options
   */
  static async runWithOptions(argv) {
    const options = {
      runQuick: argv.includes('--quick'),
      runFull: argv.includes('--full'),
      browserOnly: argv.includes('--browser-only'),
      qualityOnly: argv.includes('--quality-only'),
      skipVisual: argv.includes('--skip-visual'),
      generateReport: !argv.includes('--no-report'),
      cleanupOnComplete: !argv.includes('--no-cleanup')
    };

    const suite = new ExportFunctionalityTestSuite(options);
    return await suite.runTestSuite();
  }
}

// Run test suite if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  
  // Display help if requested
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Export Functionality Test Suite

Usage: node export-functionality-test-suite.js [options]

Options:
  --quick         Run only fast, essential tests
  --full          Run all tests including visual regression  
  --browser-only  Run only cross-browser tests
  --quality-only  Run only quality optimization tests
  --skip-visual   Skip visual regression tests
  --no-report     Skip generating detailed reports
  --no-cleanup    Skip cleanup of test artifacts
  --help, -h      Show this help message

Examples:
  node export-functionality-test-suite.js --quick
  node export-functionality-test-suite.js --full
  node export-functionality-test-suite.js --browser-only --no-cleanup
`);
    process.exit(0);
  }

  ExportFunctionalityTestSuite.runWithOptions(args)
    .then(results => {
      const success = results.overallSummary.failedTests === 0;
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('🚨 Export functionality test suite failed:', error);
      process.exit(1);
    });
}

module.exports = ExportFunctionalityTestSuite;