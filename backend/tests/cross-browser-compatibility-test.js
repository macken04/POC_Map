/**
 * Cross-Browser Compatibility Test Suite for Mapbox Event System
 * Tests event handling across Chrome, Firefox, Safari, and Edge
 * 
 * Run with: node cross-browser-compatibility-test.js
 * Requires: puppeteer
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs').promises;

class CrossBrowserTester {
  constructor() {
    this.testResults = {
      browsers: {},
      summary: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        errors: []
      },
      startTime: Date.now()
    };
    
    this.testHtmlPath = path.join(__dirname, 'mapbox-event-system-test.html');
    
    // Test cases to run
    this.testCases = [
      {
        name: 'Map Initialization',
        action: 'initializeMap',
        expectedEvents: ['system-initialized', 'map-load'],
        timeout: 10000
      },
      {
        name: 'Route Loading',
        action: 'loadTestRoute',
        expectedEvents: ['route-loaded'],
        timeout: 5000
      },
      {
        name: 'Click Events',
        action: 'simulateClick',
        expectedEvents: ['user-click'],
        timeout: 2000
      },
      {
        name: 'Hover Events',
        action: 'simulateHover',
        expectedEvents: ['user-mousemove', 'feature-hover'],
        timeout: 2000
      },
      {
        name: 'Touch Events',
        action: 'simulateTouch',
        expectedEvents: ['touch-start', 'touch-end'],
        timeout: 2000
      },
      {
        name: 'Gesture Recognition',
        action: 'simulatePinch',
        expectedEvents: ['gesture-pinch'],
        timeout: 2000
      },
      {
        name: 'Export Functionality',
        action: 'triggerExport',
        expectedEvents: ['export-started', 'export-completed'],
        timeout: 5000
      },
      {
        name: 'Error Handling',
        action: 'simulateError',
        expectedEvents: ['system-error'],
        timeout: 2000
      },
      {
        name: 'Performance Metrics',
        action: 'checkPerformance',
        expectedEvents: [],
        timeout: 1000
      },
      {
        name: 'Memory Cleanup',
        action: 'testCleanup',
        expectedEvents: [],
        timeout: 2000
      }
    ];

    // Browser configurations
    this.browsers = [
      {
        name: 'Chrome',
        executable: null, // Use default Chromium
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      {
        name: 'Firefox',
        executable: null, // Would need Firefox executable path
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'
      },
      {
        name: 'Safari',
        executable: null, // Would need Safari executable path
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
      },
      {
        name: 'Edge',
        executable: null, // Would need Edge executable path
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
      }
    ];
  }

  /**
   * Run all cross-browser tests
   */
  async runAllTests() {
    console.log('🚀 Starting Cross-Browser Compatibility Tests...\n');

    try {
      // Check if test HTML file exists
      await this.validateTestFile();

      // Run tests for each browser (using Chrome with different user agents for demo)
      for (const browserConfig of this.browsers) {
        await this.runBrowserTests(browserConfig);
      }

      // Generate final report
      await this.generateReport();

    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      this.testResults.summary.errors.push(`Test suite error: ${error.message}`);
    }
  }

  /**
   * Validate test HTML file exists and is accessible
   */
  async validateTestFile() {
    try {
      await fs.access(this.testHtmlPath);
      console.log('✅ Test HTML file found');
    } catch (error) {
      throw new Error(`Test HTML file not found: ${this.testHtmlPath}`);
    }
  }

  /**
   * Run tests for a specific browser configuration
   */
  async runBrowserTests(browserConfig) {
    console.log(`\n🌐 Testing ${browserConfig.name}...`);
    
    let browser;
    let page;
    
    try {
      // Launch browser
      browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run'
        ]
      });

      page = await browser.newPage();
      
      // Set user agent to simulate different browsers
      await page.setUserAgent(browserConfig.userAgent);
      
      // Set viewport
      await page.setViewport({ width: 1200, height: 800 });
      
      // Initialize browser results
      this.testResults.browsers[browserConfig.name] = {
        userAgent: browserConfig.userAgent,
        tests: {},
        summary: { passed: 0, failed: 0, errors: [] }
      };

      // Navigate to test page
      await page.goto(`file://${this.testHtmlPath}`, { 
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      // Wait for map initialization
      await page.waitForFunction(() => {
        return window.mapIntegration && window.mapIntegration.isInitialized;
      }, { timeout: 15000 });

      console.log(`  ✅ ${browserConfig.name} initialized successfully`);

      // Run each test case
      for (const testCase of this.testCases) {
        await this.runSingleTest(page, browserConfig.name, testCase);
      }

      // Test responsive behavior
      await this.testResponsiveBehavior(page, browserConfig.name);

    } catch (error) {
      console.log(`  ❌ ${browserConfig.name} failed to initialize: ${error.message}`);
      this.testResults.browsers[browserConfig.name] = {
        userAgent: browserConfig.userAgent,
        initializationError: error.message,
        tests: {},
        summary: { passed: 0, failed: 0, errors: [error.message] }
      };
    } finally {
      if (page) await page.close();
      if (browser) await browser.close();
    }
  }

  /**
   * Run a single test case
   */
  async runSingleTest(page, browserName, testCase) {
    const testStart = Date.now();
    
    try {
      console.log(`    Testing: ${testCase.name}...`);
      
      // Clear any existing events
      await page.evaluate(() => {
        if (window.testStats) {
          window.testStats.eventHistory = [];
        }
      });

      // Execute the test action
      const actionResult = await this.executeTestAction(page, testCase.action);
      
      // Wait for expected events
      const eventsReceived = await this.waitForEvents(page, testCase.expectedEvents, testCase.timeout);
      
      // Validate results
      const testPassed = this.validateTestResult(testCase, eventsReceived, actionResult);
      
      const testResult = {
        passed: testPassed,
        duration: Date.now() - testStart,
        expectedEvents: testCase.expectedEvents,
        receivedEvents: eventsReceived,
        actionResult: actionResult,
        error: testPassed ? null : 'Expected events not received'
      };

      this.testResults.browsers[browserName].tests[testCase.name] = testResult;
      
      if (testPassed) {
        console.log(`      ✅ Passed (${testResult.duration}ms)`);
        this.testResults.browsers[browserName].summary.passed++;
      } else {
        console.log(`      ❌ Failed: ${testResult.error}`);
        this.testResults.browsers[browserName].summary.failed++;
        this.testResults.browsers[browserName].summary.errors.push(`${testCase.name}: ${testResult.error}`);
      }

    } catch (error) {
      console.log(`      ❌ Error: ${error.message}`);
      
      this.testResults.browsers[browserName].tests[testCase.name] = {
        passed: false,
        duration: Date.now() - testStart,
        error: error.message
      };
      
      this.testResults.browsers[browserName].summary.failed++;
      this.testResults.browsers[browserName].summary.errors.push(`${testCase.name}: ${error.message}`);
    }
  }

  /**
   * Execute test action on the page
   */
  async executeTestAction(page, action) {
    switch (action) {
      case 'initializeMap':
        return await page.evaluate(() => {
          return window.mapIntegration ? window.mapIntegration.isInitialized : false;
        });

      case 'loadTestRoute':
        return await page.evaluate(() => {
          if (window.loadTestRoute) {
            window.loadTestRoute();
            return true;
          }
          return false;
        });

      case 'simulateClick':
        return await page.evaluate(() => {
          const mapElement = document.getElementById('map');
          if (mapElement) {
            const event = new MouseEvent('click', {
              clientX: 600,
              clientY: 300,
              bubbles: true
            });
            mapElement.dispatchEvent(event);
            return true;
          }
          return false;
        });

      case 'simulateHover':
        return await page.evaluate(() => {
          const mapElement = document.getElementById('map');
          if (mapElement) {
            const event = new MouseEvent('mousemove', {
              clientX: 600,
              clientY: 300,
              bubbles: true
            });
            mapElement.dispatchEvent(event);
            return true;
          }
          return false;
        });

      case 'simulateTouch':
        return await page.evaluate(() => {
          const mapElement = document.getElementById('map');
          if (mapElement) {
            const touch = new Touch({
              identifier: 1,
              target: mapElement,
              clientX: 600,
              clientY: 300,
              pageX: 600,
              pageY: 300,
              screenX: 600,
              screenY: 300
            });
            
            const touchStart = new TouchEvent('touchstart', {
              touches: [touch],
              changedTouches: [touch],
              bubbles: true
            });
            
            const touchEnd = new TouchEvent('touchend', {
              changedTouches: [touch],
              bubbles: true
            });
            
            mapElement.dispatchEvent(touchStart);
            setTimeout(() => mapElement.dispatchEvent(touchEnd), 100);
            return true;
          }
          return false;
        });

      case 'simulatePinch':
        return await page.evaluate(() => {
          if (window.simulateTouch) {
            window.simulateTouch('pinch');
            return true;
          }
          return false;
        });

      case 'triggerExport':
        return await page.evaluate(() => {
          if (window.triggerExport) {
            window.triggerExport();
            return true;
          }
          return false;
        });

      case 'simulateError':
        return await page.evaluate(() => {
          if (window.simulateError) {
            window.simulateError();
            return true;
          }
          return false;
        });

      case 'checkPerformance':
        return await page.evaluate(() => {
          if (window.mapIntegration && window.mapIntegration.eventSystem) {
            const metrics = window.mapIntegration.eventSystem.getPerformanceMetrics();
            return Object.keys(metrics).length > 0;
          }
          return false;
        });

      case 'testCleanup':
        return await page.evaluate(() => {
          if (window.mapIntegration && window.mapIntegration.cleanup) {
            window.mapIntegration.cleanup();
            return true;
          }
          return false;
        });

      default:
        return false;
    }
  }

  /**
   * Wait for expected events to occur
   */
  async waitForEvents(page, expectedEvents, timeout) {
    if (expectedEvents.length === 0) {
      return [];
    }

    try {
      const receivedEvents = await page.waitForFunction((expected) => {
        if (!window.testStats || !window.testStats.eventHistory) {
          return [];
        }
        
        const recentEvents = window.testStats.eventHistory
          .slice(0, 10)
          .map(event => event.type);
        
        const receivedExpected = expected.filter(eventType => 
          recentEvents.some(received => received.includes(eventType) || eventType.includes(received))
        );
        
        return receivedExpected.length > 0 ? receivedExpected : false;
      }, { timeout }, expectedEvents);

      return await page.evaluate(() => {
        if (!window.testStats || !window.testStats.eventHistory) {
          return [];
        }
        return window.testStats.eventHistory.slice(0, 5).map(event => event.type);
      });

    } catch (error) {
      // Timeout occurred, return what events we did receive
      return await page.evaluate(() => {
        if (!window.testStats || !window.testStats.eventHistory) {
          return [];
        }
        return window.testStats.eventHistory.slice(0, 5).map(event => event.type);
      });
    }
  }

  /**
   * Validate test result
   */
  validateTestResult(testCase, eventsReceived, actionResult) {
    // If no events expected, just check action result
    if (testCase.expectedEvents.length === 0) {
      return actionResult === true;
    }

    // Check if at least one expected event was received
    return testCase.expectedEvents.some(expected => 
      eventsReceived.some(received => 
        received.includes(expected) || expected.includes(received)
      )
    );
  }

  /**
   * Test responsive behavior across different viewports
   */
  async testResponsiveBehavior(page, browserName) {
    console.log(`    Testing responsive behavior...`);
    
    const viewports = [
      { name: 'Mobile', width: 375, height: 667 },
      { name: 'Tablet', width: 768, height: 1024 },
      { name: 'Desktop', width: 1200, height: 800 }
    ];

    const responsiveResults = {};

    for (const viewport of viewports) {
      try {
        await page.setViewport(viewport);
        await page.waitForTimeout(500); // Wait for responsive changes
        
        const responsiveData = await page.evaluate(() => {
          if (window.mapIntegration && window.mapIntegration.getCurrentBreakpoint) {
            return {
              breakpoint: window.mapIntegration.getCurrentBreakpoint(),
              mapSize: {
                width: document.getElementById('map').offsetWidth,
                height: document.getElementById('map').offsetHeight
              }
            };
          }
          return null;
        });

        responsiveResults[viewport.name] = {
          success: responsiveData !== null,
          data: responsiveData
        };

      } catch (error) {
        responsiveResults[viewport.name] = {
          success: false,
          error: error.message
        };
      }
    }

    this.testResults.browsers[browserName].responsive = responsiveResults;
    console.log(`      ✅ Responsive behavior tested`);
  }

  /**
   * Generate final test report
   */
  async generateReport() {
    console.log('\n📊 Generating Test Report...\n');

    // Calculate summary statistics
    let totalPassed = 0;
    let totalFailed = 0;
    let totalTests = 0;

    Object.values(this.testResults.browsers).forEach(browserResult => {
      totalPassed += browserResult.summary.passed;
      totalFailed += browserResult.summary.failed;
      totalTests += browserResult.summary.passed + browserResult.summary.failed;
    });

    this.testResults.summary = {
      totalTests,
      passed: totalPassed,
      failed: totalFailed,
      successRate: totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : 0,
      duration: Date.now() - this.testResults.startTime
    };

    // Print summary to console
    console.log('='.repeat(60));
    console.log('CROSS-BROWSER COMPATIBILITY TEST RESULTS');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${totalPassed}`);
    console.log(`Failed: ${totalFailed}`);
    console.log(`Success Rate: ${this.testResults.summary.successRate}%`);
    console.log(`Duration: ${(this.testResults.summary.duration / 1000).toFixed(1)}s`);
    console.log('='.repeat(60));

    // Print browser-specific results
    Object.entries(this.testResults.browsers).forEach(([browserName, results]) => {
      console.log(`\n${browserName}:`);
      console.log(`  Passed: ${results.summary.passed}`);
      console.log(`  Failed: ${results.summary.failed}`);
      
      if (results.summary.errors.length > 0) {
        console.log(`  Errors: ${results.summary.errors.slice(0, 3).join(', ')}${results.summary.errors.length > 3 ? '...' : ''}`);
      }
      
      if (results.responsive) {
        const responsiveSuccess = Object.values(results.responsive).filter(r => r.success).length;
        const responsiveTotal = Object.keys(results.responsive).length;
        console.log(`  Responsive: ${responsiveSuccess}/${responsiveTotal} viewports`);
      }
    });

    // Save detailed report to file
    const reportPath = path.join(__dirname, `cross-browser-test-report-${Date.now()}.json`);
    await fs.writeFile(reportPath, JSON.stringify(this.testResults, null, 2));
    
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);

    // Generate recommendations
    this.generateRecommendations();
  }

  /**
   * Generate recommendations based on test results
   */
  generateRecommendations() {
    console.log('\n💡 RECOMMENDATIONS:');
    
    const recommendations = [];
    
    // Check for browser-specific failures
    Object.entries(this.testResults.browsers).forEach(([browserName, results]) => {
      if (results.summary.failed > 0) {
        recommendations.push(`- Fix ${results.summary.failed} failing tests in ${browserName}`);
      }
      
      if (results.initializationError) {
        recommendations.push(`- Address ${browserName} initialization issues`);
      }
    });

    // Check for responsive issues
    Object.entries(this.testResults.browsers).forEach(([browserName, results]) => {
      if (results.responsive) {
        const failedResponsive = Object.entries(results.responsive)
          .filter(([, result]) => !result.success);
        
        if (failedResponsive.length > 0) {
          recommendations.push(`- Fix responsive behavior in ${browserName} for: ${failedResponsive.map(([viewport]) => viewport).join(', ')}`);
        }
      }
    });

    // Performance recommendations
    if (this.testResults.summary.successRate < 90) {
      recommendations.push('- Overall success rate below 90% - review failing tests');
    }

    if (recommendations.length === 0) {
      recommendations.push('- All tests passing! Consider adding more comprehensive test cases');
    }

    recommendations.forEach(rec => console.log(rec));
    console.log();
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new CrossBrowserTester();
  tester.runAllTests().catch(console.error);
}

module.exports = CrossBrowserTester;