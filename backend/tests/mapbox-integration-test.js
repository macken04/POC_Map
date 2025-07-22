/**
 * Mapbox GL JS Integration Test Suite
 * Tests installation, configuration, and functionality
 */

// Import both the singleton and class for testing
const mapServiceSingleton = require('../services/mapService');
const { MapService } = require('../services/mapService');
const config = require('../config');
const fs = require('fs').promises;
const path = require('path');

class MapboxIntegrationTest {
  constructor() {
    this.config = config.getConfig();
    this.testResults = [];
    this.startTime = Date.now();
    // Create a fresh MapService instance for testing
    this.mapService = new MapService();
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
   * Test 1: Dependencies Installation
   */
  async testDependenciesInstalled() {
    try {
      const packageJson = JSON.parse(
        await fs.readFile(path.join(__dirname, '..', 'package.json'), 'utf8')
      );

      const requiredDeps = ['mapbox-gl', '@mapbox/mapbox-gl-geocoder'];
      const missingDeps = requiredDeps.filter(dep => !packageJson.dependencies[dep]);
      
      if (missingDeps.length === 0) {
        this.logResult(
          'Dependencies Installation',
          true,
          'All required Mapbox dependencies are installed',
          { installed: requiredDeps }
        );
      } else {
        this.logResult(
          'Dependencies Installation',
          false,
          'Missing required dependencies',
          { missing: missingDeps }
        );
      }
    } catch (error) {
      this.logResult(
        'Dependencies Installation',
        false,
        'Failed to check dependencies',
        { error: error.message }
      );
    }
  }

  /**
   * Test 2: Environment Configuration
   */
  async testEnvironmentConfig() {
    try {
      const hasMapboxToken = !!this.config.mapbox.accessToken;
      const tokenFormat = this.config.mapbox.accessToken?.startsWith('pk.');
      
      if (hasMapboxToken && tokenFormat) {
        this.logResult(
          'Environment Configuration',
          true,
          'Mapbox access token is properly configured',
          { 
            hasToken: true,
            tokenPrefix: this.config.mapbox.accessToken.substring(0, 8) + '...'
          }
        );
      } else {
        this.logResult(
          'Environment Configuration',
          false,
          'Mapbox access token missing or invalid format',
          { hasToken: hasMapboxToken, validFormat: tokenFormat }
        );
      }
    } catch (error) {
      this.logResult(
        'Environment Configuration',
        false,
        'Failed to check environment config',
        { error: error.message }
      );
    }
  }

  /**
   * Test 3: File Structure
   */
  async testFileStructure() {
    const requiredFiles = [
      '../services/mapService.js',
      '../../shopify-theme/dawn/assets/mapbox-config.js',
      '../../shopify-theme/dawn/assets/mapbox-integration.js',
      '../../shopify-theme/dawn/layout/theme.liquid'
    ];

    let allFilesExist = true;
    const fileStatus = {};

    for (const file of requiredFiles) {
      try {
        const fullPath = path.join(__dirname, file);
        await fs.access(fullPath);
        fileStatus[file] = true;
      } catch (error) {
        fileStatus[file] = false;
        allFilesExist = false;
      }
    }

    this.logResult(
      'File Structure',
      allFilesExist,
      allFilesExist ? 'All required files are present' : 'Some required files are missing',
      fileStatus
    );
  }

  /**
   * Test 4: MapService Initialization
   */
  async testMapServiceInit() {
    try {
      await this.mapService.initialize();
      const status = await this.mapService.getStatus();
      
      if (status.initialized && status.browserConnected) {
        this.logResult(
          'MapService Initialization',
          true,
          'Map service initialized successfully',
          status
        );
      } else {
        this.logResult(
          'MapService Initialization',
          false,
          'Map service failed to initialize properly',
          status
        );
      }
    } catch (error) {
      this.logResult(
        'MapService Initialization',
        false,
        'MapService initialization failed',
        { error: error.message }
      );
    }
  }

  /**
   * Test 5: Theme Integration Check
   */
  async testThemeIntegration() {
    try {
      const themePath = path.join(__dirname, '..', '..', 'shopify-theme', 'dawn', 'layout', 'theme.liquid');
      const themeContent = await fs.readFile(themePath, 'utf8');
      
      const checks = {
        mapboxCSS: themeContent.includes('mapbox-gl.css'),
        mapboxJS: themeContent.includes('mapbox-gl.js'),
        configScript: themeContent.includes('mapbox-config.js'),
        integrationScript: themeContent.includes('mapbox-integration.js'),
        settingsConfig: themeContent.includes('shopifyMapboxSettings')
      };

      const allChecksPass = Object.values(checks).every(check => check);

      this.logResult(
        'Theme Integration',
        allChecksPass,
        allChecksPass ? 'Theme properly integrated with Mapbox' : 'Theme integration incomplete',
        checks
      );
    } catch (error) {
      this.logResult(
        'Theme Integration',
        false,
        'Failed to check theme integration',
        { error: error.message }
      );
    }
  }

  /**
   * Test 6: Map Generation (Basic)
   */
  async testBasicMapGeneration() {
    try {
      // Test data - simple route coordinates
      const testRouteCoordinates = [
        [53.3498, -6.2603], // Dublin start
        [53.3520, -6.2590], // Dublin point 2
        [53.3540, -6.2580], // Dublin point 3
        [53.3560, -6.2570]  // Dublin end
      ];

      const bounds = {
        north: 53.3570,
        south: 53.3490,
        east: -6.2560,
        west: -6.2610
      };

      const center = [53.3529, -6.2586];

      const mapOptions = {
        routeCoordinates: testRouteCoordinates,
        bounds,
        center,
        format: 'A4',
        style: 'outdoors-v11',
        routeColor: '#FF4444',
        routeWidth: 4,
        showStartEnd: true,
        title: 'Test Route Map'
      };

      // Validate options first
      this.mapService.validateMapOptions(mapOptions);

      this.logResult(
        'Map Generation (Validation)',
        true,
        'Map options validation passed',
        { validatedOptions: Object.keys(mapOptions) }
      );

    } catch (error) {
      this.logResult(
        'Map Generation (Validation)',
        false,
        'Map options validation failed',
        { error: error.message }
      );
    }
  }

  /**
   * Test 7: Performance Test
   */
  async testPerformance() {
    const performanceStart = Date.now();
    
    try {
      // Test initialization time
      const initStart = Date.now();
      await this.mapService.initialize();
      const initTime = Date.now() - initStart;

      // Test service status retrieval time  
      const statusStart = Date.now();
      await this.mapService.getStatus();
      const statusTime = Date.now() - statusStart;

      const results = {
        initializationTime: `${initTime}ms`,
        statusCheckTime: `${statusTime}ms`,
        totalTestTime: `${Date.now() - performanceStart}ms`
      };

      const performanceGood = initTime < 5000 && statusTime < 100; // Reasonable thresholds

      this.logResult(
        'Performance Test',
        performanceGood,
        performanceGood ? 'Performance within acceptable limits' : 'Performance concerns detected',
        results
      );

    } catch (error) {
      this.logResult(
        'Performance Test',
        false,
        'Performance test failed',
        { error: error.message }
      );
    }
  }

  /**
   * Test 8: Browser Compatibility Check
   */
  async testBrowserCompatibility() {
    try {
      await this.mapService.initialize();
      const status = await this.mapService.getStatus();

      const browserInfo = {
        initialized: status.initialized,
        connected: status.browserConnected,
        supportedFormats: status.supportedFormats,
        supportedStyles: status.supportedStyles
      };

      const compatibilityGood = status.initialized && status.browserConnected;

      this.logResult(
        'Browser Compatibility',
        compatibilityGood,
        compatibilityGood ? 'Browser compatibility verified' : 'Browser compatibility issues',
        browserInfo
      );

    } catch (error) {
      this.logResult(
        'Browser Compatibility',
        false,
        'Browser compatibility test failed',
        { error: error.message }
      );
    }
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('🧪 Starting Mapbox GL JS Integration Tests...\n');
    
    const tests = [
      'testDependenciesInstalled',
      'testEnvironmentConfig',
      'testFileStructure',
      'testMapServiceInit',
      'testThemeIntegration',
      'testBasicMapGeneration',
      'testPerformance',
      'testBrowserCompatibility'
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
    await this.generateTestSummary();
  }

  /**
   * Generate test summary report
   */
  async generateTestSummary() {
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

    // Log summary to console
    console.log('\n📊 Test Summary:');
    console.log(`Total Tests: ${totalTests}`);
    console.log(`✅ Passed: ${passedTests}`);
    console.log(`❌ Failed: ${failedTests}`);
    console.log(`📈 Success Rate: ${summary.successRate}`);
    console.log(`⏱️  Total Time: ${summary.totalTime}`);

    // Save detailed report to file
    const reportPath = path.join(__dirname, 'mapbox-integration-test-report.json');
    await fs.writeFile(reportPath, JSON.stringify(summary, null, 2));
    console.log(`📝 Detailed report saved to: ${reportPath}`);

    // Cleanup
    try {
      await this.mapService.cleanup();
      console.log('🧹 Cleanup completed');
    } catch (error) {
      console.warn('Cleanup warning:', error.message);
    }

    return summary;
  }
}

// Export test class for external usage
module.exports = MapboxIntegrationTest;

// Run tests if this file is executed directly
if (require.main === module) {
  const test = new MapboxIntegrationTest();
  test.runAllTests()
    .then(summary => {
      if (summary && typeof summary.failedTests === 'number') {
        const exitCode = summary.failedTests > 0 ? 1 : 0;
        process.exit(exitCode);
      } else {
        console.error('Invalid test summary received');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Test runner failed:', error);
      process.exit(1);
    });
}