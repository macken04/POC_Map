/**
 * Puppeteer Browser Configuration Test
 * Tests headless operation, browser settings, and environment-specific configurations
 */

const puppeteer = require('puppeteer');
const config = require('../config');
const { MapService } = require('../services/mapService');

class PuppeteerConfigTest {
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
    
    if (details && !success) {
      console.error('Details:', details);
    }
  }

  /**
   * Test 1: Basic Headless Browser Launch
   */
  async testHeadlessBrowserLaunch() {
    let browser = null;
    try {
      const launchOptions = {
        headless: true,
        timeout: 30000,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ]
      };

      browser = await puppeteer.launch(launchOptions);
      const isConnected = browser.isConnected();
      
      if (isConnected) {
        this.logResult(
          'Headless Browser Launch',
          true,
          'Browser launched successfully in headless mode',
          { 
            version: await browser.version(),
            wsEndpoint: browser.wsEndpoint() !== null
          }
        );
      } else {
        this.logResult(
          'Headless Browser Launch',
          false,
          'Browser launched but not connected',
          {}
        );
      }
    } catch (error) {
      this.logResult(
        'Headless Browser Launch',
        false,
        'Failed to launch headless browser',
        { error: error.message }
      );
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Test 2: Environment-Specific Configuration
   */
  async testEnvironmentConfiguration() {
    try {
      // Test development configuration
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const devConfig = config.getConfig();
      const devPuppeteerSettings = devConfig.puppeteer;
      
      // Test production configuration
      process.env.NODE_ENV = 'production';
      const prodConfig = config.getConfig();
      const prodPuppeteerSettings = prodConfig.puppeteer;
      
      // Restore original environment
      process.env.NODE_ENV = originalEnv;
      
      const configCheck = {
        devHeadless: devPuppeteerSettings?.headless !== undefined,
        prodHeadless: prodPuppeteerSettings?.headless !== undefined,
        prodArgs: Array.isArray(prodPuppeteerSettings?.args),
        environmentSpecific: devPuppeteerSettings !== prodPuppeteerSettings
      };

      const allConfigsValid = Object.values(configCheck).every(check => check);
      
      this.logResult(
        'Environment Configuration',
        allConfigsValid,
        allConfigsValid ? 'Environment-specific configurations are properly set' : 'Configuration issues detected',
        configCheck
      );
    } catch (error) {
      this.logResult(
        'Environment Configuration',
        false,
        'Failed to test environment configurations',
        { error: error.message }
      );
    }
  }

  /**
   * Test 3: Browser Launch with Multiple Fallback Options
   */
  async testFallbackConfigurations() {
    const fallbackOptions = [
      {
        name: 'Standard Configuration',
        options: {
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
      },
      {
        name: 'Old Headless Mode',
        options: {
          headless: 'old',
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
      },
      {
        name: 'Pipe Transport',
        options: {
          headless: true,
          pipe: true
        }
      }
    ];

    let successfulConfigs = 0;
    const results = {};

    for (const config of fallbackOptions) {
      let browser = null;
      try {
        browser = await puppeteer.launch({
          ...config.options,
          timeout: 15000
        });
        
        const isConnected = browser.isConnected();
        results[config.name] = isConnected;
        if (isConnected) successfulConfigs++;
        
      } catch (error) {
        results[config.name] = false;
      } finally {
        if (browser) {
          try {
            await browser.close();
          } catch (e) {
            // Ignore cleanup errors
          }
        }
      }
    }

    const hasWorkingFallback = successfulConfigs > 0;
    
    this.logResult(
      'Fallback Configurations',
      hasWorkingFallback,
      `${successfulConfigs}/${fallbackOptions.length} configurations working`,
      results
    );
  }

  /**
   * Test 4: MapService Browser Management
   */
  async testMapServiceBrowserManagement() {
    let mapService = null;
    try {
      mapService = new MapService();
      await mapService.initialize();
      
      const status = await mapService.getStatus();
      const reinitializeTest = await mapService.initialize(); // Test reinitialization
      const statusAfterReinit = await mapService.getStatus();
      
      const managementCheck = {
        initializedCorrectly: status.initialized && status.browserConnected,
        reinitializationHandled: statusAfterReinit.initialized,
        statusMethodWorks: typeof status === 'object' && status !== null,
        supportedFormats: Array.isArray(status.supportedFormats),
        supportedStyles: Array.isArray(status.supportedStyles)
      };

      const allManagementWorks = Object.values(managementCheck).every(check => check);
      
      this.logResult(
        'MapService Browser Management',
        allManagementWorks,
        allManagementWorks ? 'Browser management is working correctly' : 'Browser management issues detected',
        managementCheck
      );
      
    } catch (error) {
      this.logResult(
        'MapService Browser Management',
        false,
        'MapService browser management failed',
        { error: error.message }
      );
    } finally {
      if (mapService) {
        try {
          await mapService.cleanup();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    }
  }

  /**
   * Test 5: Viewport and Device Settings
   */
  async testViewportAndDeviceSettings() {
    let browser = null;
    let page = null;
    
    try {
      browser = await puppeteer.launch({
        headless: true,
        defaultViewport: null,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      page = await browser.newPage();
      
      // Test custom viewport settings
      const testViewports = [
        { width: 2480, height: 3508, deviceScaleFactor: 1 }, // A4
        { width: 3508, height: 4961, deviceScaleFactor: 1 }, // A3
        { width: 800, height: 600, deviceScaleFactor: 3 }    // High DPI preview
      ];
      
      let allViewportsWork = true;
      const viewportResults = {};
      
      for (const viewport of testViewports) {
        try {
          await page.setViewport(viewport);
          const actualViewport = page.viewport();
          
          const matches = actualViewport.width === viewport.width && 
                         actualViewport.height === viewport.height &&
                         actualViewport.deviceScaleFactor === viewport.deviceScaleFactor;
          
          viewportResults[`${viewport.width}x${viewport.height}`] = matches;
          if (!matches) allViewportsWork = false;
          
        } catch (error) {
          viewportResults[`${viewport.width}x${viewport.height}`] = false;
          allViewportsWork = false;
        }
      }
      
      this.logResult(
        'Viewport and Device Settings',
        allViewportsWork,
        allViewportsWork ? 'All viewport configurations work correctly' : 'Some viewport configurations failed',
        viewportResults
      );
      
    } catch (error) {
      this.logResult(
        'Viewport and Device Settings',
        false,
        'Failed to test viewport settings',
        { error: error.message }
      );
    } finally {
      if (page) await page.close();
      if (browser) await browser.close();
    }
  }

  /**
   * Run all configuration tests
   */
  async runAllTests() {
    console.log('🧪 Starting Puppeteer Configuration Tests...\n');
    
    const tests = [
      'testHeadlessBrowserLaunch',
      'testEnvironmentConfiguration',
      'testFallbackConfigurations',
      'testMapServiceBrowserManagement',
      'testViewportAndDeviceSettings'
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

    console.log('\n📊 Puppeteer Configuration Test Summary:');
    console.log(`Total Tests: ${totalTests}`);
    console.log(`✅ Passed: ${passedTests}`);
    console.log(`❌ Failed: ${failedTests}`);
    console.log(`📈 Success Rate: ${summary.successRate}`);
    console.log(`⏱️  Total Time: ${summary.totalTime}`);

    if (passedTests === totalTests) {
      console.log('🎉 All Puppeteer configuration tests passed!');
    } else {
      console.log('⚠️  Some configuration tests failed. Review the issues above.');
    }

    return summary;
  }
}

// Export test class
module.exports = PuppeteerConfigTest;

// Run tests if this file is executed directly
if (require.main === module) {
  const test = new PuppeteerConfigTest();
  test.runAllTests()
    .then(summary => {
      process.exit(summary.failedTests > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Test runner failed:', error);
      process.exit(1);
    });
}