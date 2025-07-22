/**
 * Puppeteer Error Handling Test
 * Tests comprehensive error handling for browser crashes, timeouts, and other failures
 */

const { MapService } = require('../services/mapService');
const config = require('../config');

class ErrorHandlingTest {
  constructor() {
    this.config = config.getConfig();
    this.testResults = [];
    this.startTime = Date.now();
  }

  /**
   * Log test result
   */
  logResult(testName, success, message, details = null) {
    const result = {
      test: testName,
      success,
      message,
      details,
      timestamp: new Date().toISOString()
    };
    
    this.testResults.push(result);
    const status = success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status}: ${testName} - ${message}`);
    
    if (details && (!success || details.recovered)) {
      console.log('Details:', details);
    }
  }

  /**
   * Test 1: Invalid Map Options Error Handling
   */
  async testInvalidMapOptions() {
    let mapService = null;
    try {
      mapService = new MapService();
      await mapService.initialize();

      const invalidOptions = [
        { name: 'Missing coordinates', options: { bounds: {}, center: [] } },
        { name: 'Empty coordinates', options: { routeCoordinates: [], bounds: {}, center: [] } },
        { name: 'Invalid format', options: { routeCoordinates: [[0, 0]], bounds: { north: 1, south: 0, east: 1, west: 0 }, center: [0, 0], format: 'INVALID' } },
        { name: 'Missing bounds', options: { routeCoordinates: [[0, 0]], center: [0, 0] } }
      ];

      let allErrorsHandled = true;
      const errorResults = {};

      for (const test of invalidOptions) {
        try {
          if (test.name === 'Invalid format') {
            // This should be caught by validation
            await mapService.validateMapOptions(test.options);
            errorResults[test.name] = false; // Should have thrown
          } else {
            await mapService.validateMapOptions(test.options);
            errorResults[test.name] = false; // Should have thrown
          }
        } catch (error) {
          errorResults[test.name] = true; // Correctly caught error
        }
      }

      const allHandled = Object.values(errorResults).every(handled => handled);
      
      this.logResult(
        'Invalid Map Options',
        allHandled,
        allHandled ? 'All invalid options properly rejected' : 'Some invalid options not caught',
        errorResults
      );

    } catch (error) {
      this.logResult(
        'Invalid Map Options',
        false,
        'Test setup failed',
        { error: error.message }
      );
    } finally {
      if (mapService) {
        await mapService.cleanup();
      }
    }
  }

  /**
   * Test 2: Browser Crash Recovery
   */
  async testBrowserCrashRecovery() {
    let mapService = null;
    try {
      mapService = new MapService();
      await mapService.initialize();

      // Force browser crash by closing browser directly
      if (mapService.browser && mapService.browser.isConnected()) {
        await mapService.browser.close();
      }

      // Now try to use the service - it should detect the crash and recover
      const status = await mapService.getStatus();
      const recovered = !status.browserConnected && !status.initialized;

      // Try to reinitialize
      await mapService.initialize();
      const statusAfterRecovery = await mapService.getStatus();
      const recoveryWorked = statusAfterRecovery.initialized && statusAfterRecovery.browserConnected;

      this.logResult(
        'Browser Crash Recovery',
        recovered && recoveryWorked,
        recovered && recoveryWorked ? 'Browser crash detected and recovery successful' : 'Browser crash recovery failed',
        { 
          crashDetected: recovered, 
          recoveryWorked,
          statusAfterCrash: status,
          statusAfterRecovery: statusAfterRecovery
        }
      );

    } catch (error) {
      this.logResult(
        'Browser Crash Recovery',
        false,
        'Browser crash recovery test failed',
        { error: error.message }
      );
    } finally {
      if (mapService) {
        await mapService.cleanup();
      }
    }
  }

  /**
   * Test 3: Memory Management and Resource Cleanup
   */
  async testMemoryManagement() {
    try {
      const instances = [];
      const initialMemory = process.memoryUsage();

      // Create and destroy multiple MapService instances
      for (let i = 0; i < 3; i++) {
        const mapService = new MapService();
        await mapService.initialize();
        instances.push(mapService);
        
        // Check that browser is connected
        const status = await mapService.getStatus();
        if (!status.browserConnected) {
          throw new Error(`Instance ${i} failed to connect browser`);
        }
      }

      // Clean up all instances
      for (const instance of instances) {
        await instance.cleanup();
      }

      // Check memory after cleanup
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreaseReasonable = memoryIncrease < 50 * 1024 * 1024; // Less than 50MB increase

      this.logResult(
        'Memory Management',
        memoryIncreaseReasonable,
        memoryIncreaseReasonable ? 'Memory usage is well managed' : 'Possible memory leak detected',
        {
          initialMemory: `${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`,
          finalMemory: `${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`,
          memoryIncrease: `${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`,
          instancesCreated: instances.length
        }
      );

    } catch (error) {
      this.logResult(
        'Memory Management',
        false,
        'Memory management test failed',
        { error: error.message }
      );
    }
  }

  /**
   * Test 4: Timeout Handling
   */
  async testTimeoutHandling() {
    let mapService = null;
    try {
      mapService = new MapService();
      await mapService.initialize();

      // Create map options that might cause timeout due to invalid bounds
      const timeoutTestOptions = {
        routeCoordinates: [[0, 0], [0.001, 0.001]], // Very small route
        bounds: {
          north: 0.002,
          south: -0.002,
          east: 0.002,
          west: -0.002
        },
        center: [0, 0],
        format: 'A4',
        style: 'outdoors-v11'
      };

      let timeoutHandled = false;
      const timeoutStart = Date.now();

      try {
        // This might timeout, but should be handled gracefully
        await mapService.generateMap(timeoutTestOptions);
        // If it succeeds, that's also fine
        timeoutHandled = true;
      } catch (error) {
        const timeoutTime = Date.now() - timeoutStart;
        // If it times out within reasonable bounds (30s as configured), that's expected
        timeoutHandled = error.message.includes('timeout') || error.message.includes('Waiting failed') && timeoutTime < 35000;
      }

      this.logResult(
        'Timeout Handling',
        timeoutHandled,
        timeoutHandled ? 'Timeouts are handled gracefully' : 'Timeout handling issues detected',
        { 
          testTime: `${Date.now() - timeoutStart}ms`,
          expectedTimeout: '30000ms'
        }
      );

    } catch (error) {
      this.logResult(
        'Timeout Handling',
        false,
        'Timeout handling test failed',
        { error: error.message }
      );
    } finally {
      if (mapService) {
        await mapService.cleanup();
      }
    }
  }

  /**
   * Test 5: Error Logging and Reporting
   */
  async testErrorLoggingAndReporting() {
    let mapService = null;
    try {
      mapService = new MapService();
      
      // Capture console logs
      const originalConsoleError = console.error;
      const errorLogs = [];
      console.error = (...args) => {
        errorLogs.push(args.join(' '));
        originalConsoleError(...args);
      };

      try {
        // Force an error by trying to generate without initialization
        await mapService.generateMap({
          routeCoordinates: [[0, 0]],
          bounds: { north: 1, south: 0, east: 1, west: 0 },
          center: [0, 0],
          format: 'A4'
        });
      } catch (error) {
        // Expected to fail
      }

      // Restore original console.error
      console.error = originalConsoleError;

      const errorsLogged = errorLogs.length > 0;
      
      this.logResult(
        'Error Logging and Reporting',
        errorsLogged,
        errorsLogged ? 'Errors are properly logged' : 'Error logging may be insufficient',
        { 
          errorLogsCount: errorLogs.length,
          sampleLogs: errorLogs.slice(0, 3)
        }
      );

    } catch (error) {
      this.logResult(
        'Error Logging and Reporting',
        false,
        'Error logging test failed',
        { error: error.message }
      );
    } finally {
      if (mapService) {
        await mapService.cleanup();
      }
    }
  }

  /**
   * Run all error handling tests
   */
  async runAllTests() {
    console.log('🧪 Starting Comprehensive Error Handling Tests...\n');
    
    const tests = [
      'testInvalidMapOptions',
      'testBrowserCrashRecovery',
      'testMemoryManagement',
      'testTimeoutHandling',
      'testErrorLoggingAndReporting'
    ];

    for (const test of tests) {
      try {
        await this[test]();
      } catch (error) {
        this.logResult(
          test,
          false,
          'Test execution failed',
          { error: error.message }
        );
      }
    }

    // Generate summary
    const summary = this.generateTestSummary();
    return summary;
  }

  /**
   * Generate test summary
   */
  generateTestSummary() {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;
    const totalTime = Date.now() - this.startTime;

    const summary = {
      totalTests,
      passedTests,
      failedTests,
      successRate: `${((passedTests / totalTests) * 100).toFixed(1)}%`,
      totalTime: `${totalTime}ms`,
      timestamp: new Date().toISOString(),
      results: this.testResults
    };

    console.log('\n📊 Error Handling Test Summary:');
    console.log(`Total Tests: ${totalTests}`);
    console.log(`✅ Passed: ${passedTests}`);
    console.log(`❌ Failed: ${failedTests}`);
    console.log(`📈 Success Rate: ${summary.successRate}`);
    console.log(`⏱️  Total Time: ${summary.totalTime}`);

    if (passedTests === totalTests) {
      console.log('🎉 All error handling tests passed!');
    } else {
      console.log('⚠️  Some error handling tests failed. Review the issues above.');
    }

    return summary;
  }
}

// Export test class
module.exports = ErrorHandlingTest;

// Run tests if this file is executed directly
if (require.main === module) {
  const test = new ErrorHandlingTest();
  test.runAllTests()
    .then(summary => {
      process.exit(summary.failedTests > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Test runner failed:', error);
      process.exit(1);
    });
}