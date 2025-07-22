/**
 * High-Resolution Screenshot Functionality Test
 * Tests the actual screenshot generation, dimensions, quality, and file output
 */

const fs = require('fs').promises;
const path = require('path');
const { MapService } = require('../services/mapService');
const config = require('../config');

class ScreenshotFunctionalityTest {
  constructor() {
    this.config = config.getConfig();
    this.testResults = [];
    this.startTime = Date.now();
    this.mapService = new MapService();
    this.testOutputDir = path.join(__dirname, 'screenshot-test-output');
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
   * Setup test environment
   */
  async setupTestEnvironment() {
    try {
      // Create output directory for test screenshots
      await fs.mkdir(this.testOutputDir, { recursive: true });
      console.log(`📁 Test output directory: ${this.testOutputDir}`);
      return true;
    } catch (error) {
      console.error('Failed to setup test environment:', error);
      return false;
    }
  }

  /**
   * Test 1: Basic Screenshot Generation
   */
  async testBasicScreenshotGeneration() {
    try {
      await this.mapService.initialize();

      // Test data - simple route around Dublin
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
      const outputPath = path.join(this.testOutputDir, 'test-basic-screenshot.png');

      const mapOptions = {
        routeCoordinates: testRouteCoordinates,
        bounds,
        center,
        format: 'A4',
        style: 'outdoors-v11',
        routeColor: '#FF4444',
        routeWidth: 4,
        showStartEnd: true,
        title: 'Test Route Map',
        outputPath
      };

      const screenshot = await this.mapService.generateMap(mapOptions);
      
      // Check if file was created
      const fileExists = await fs.access(outputPath).then(() => true).catch(() => false);
      const fileStats = fileExists ? await fs.stat(outputPath) : null;
      
      if (fileExists && fileStats && fileStats.size > 0) {
        this.logResult(
          'Basic Screenshot Generation',
          true,
          'Screenshot generated successfully',
          { 
            filePath: outputPath,
            fileSize: `${(fileStats.size / 1024 / 1024).toFixed(2)} MB`,
            bufferLength: screenshot.length,
            timestamp: fileStats.mtime
          }
        );
      } else {
        this.logResult(
          'Basic Screenshot Generation',
          false,
          'Screenshot file not created or empty',
          { fileExists, fileSize: fileStats?.size || 0 }
        );
      }
    } catch (error) {
      this.logResult(
        'Basic Screenshot Generation',
        false,
        'Failed to generate basic screenshot',
        { error: error.message }
      );
    }
  }

  /**
   * Test 2: High-Resolution A4 and A3 Formats
   */
  async testHighResolutionFormats() {
    const formats = ['A4', 'A3'];
    const formatResults = {};
    
    for (const format of formats) {
      try {
        const dimensions = this.mapService.getPrintDimensions(format);
        const outputPath = path.join(this.testOutputDir, `test-${format.toLowerCase()}-screenshot.png`);
        
        const testRouteCoordinates = [
          [53.3498, -6.2603],
          [53.3560, -6.2570]
        ];

        const mapOptions = {
          routeCoordinates: testRouteCoordinates,
          bounds: {
            north: 53.3570,
            south: 53.3490,
            east: -6.2560,
            west: -6.2610
          },
          center: [53.3529, -6.2586],
          format,
          style: 'outdoors-v11',
          routeColor: '#FF4444',
          routeWidth: 4,
          showStartEnd: true,
          title: `${format} Test Map`,
          outputPath
        };

        const screenshot = await this.mapService.generateMap(mapOptions);
        const fileExists = await fs.access(outputPath).then(() => true).catch(() => false);
        const fileStats = fileExists ? await fs.stat(outputPath) : null;
        
        const success = fileExists && fileStats && fileStats.size > 0;
        formatResults[format] = {
          success,
          dimensions,
          fileSize: fileStats ? fileStats.size : 0,
          filePath: outputPath
        };
        
      } catch (error) {
        formatResults[format] = {
          success: false,
          error: error.message
        };
      }
    }

    const allFormatsWork = Object.values(formatResults).every(result => result.success);
    
    this.logResult(
      'High-Resolution Formats',
      allFormatsWork,
      allFormatsWork ? 'All formats generated successfully' : 'Some formats failed',
      formatResults
    );
  }

  /**
   * Test 3: Screenshot Quality and Dimensions Validation
   */
  async testScreenshotQuality() {
    try {
      // Generate a test screenshot for dimension analysis
      const outputPath = path.join(this.testOutputDir, 'quality-test-screenshot.png');
      
      const mapOptions = {
        routeCoordinates: [[53.3498, -6.2603], [53.3560, -6.2570]],
        bounds: { north: 53.3570, south: 53.3490, east: -6.2560, west: -6.2610 },
        center: [53.3529, -6.2586],
        format: 'A4',
        style: 'outdoors-v11',
        routeColor: '#FF4444',
        routeWidth: 4,
        showStartEnd: true,
        title: 'Quality Test Map',
        outputPath
      };

      await this.mapService.generateMap(mapOptions);
      
      // Check file properties
      const fileStats = await fs.stat(outputPath);
      const expectedDimensions = this.mapService.getPrintDimensions('A4');
      
      const qualityMetrics = {
        fileSize: fileStats.size,
        fileSizeMB: (fileStats.size / 1024 / 1024).toFixed(2),
        expectedDimensions,
        minimumExpectedSize: 1024 * 1024, // At least 1MB for high-res
        created: fileStats.birthtime,
        modified: fileStats.mtime
      };

      const qualityGood = fileStats.size > qualityMetrics.minimumExpectedSize;
      
      this.logResult(
        'Screenshot Quality',
        qualityGood,
        qualityGood ? 'Screenshot quality meets expectations' : 'Screenshot quality below expectations',
        qualityMetrics
      );
      
    } catch (error) {
      this.logResult(
        'Screenshot Quality',
        false,
        'Failed to validate screenshot quality',
        { error: error.message }
      );
    }
  }

  /**
   * Test 4: Different Map Styles and Options
   */
  async testMapStylesAndOptions() {
    const styles = ['outdoors-v11', 'streets-v11', 'satellite-v9'];
    const styleResults = {};
    
    for (const style of styles) {
      try {
        const outputPath = path.join(this.testOutputDir, `test-style-${style}.png`);
        
        const mapOptions = {
          routeCoordinates: [[53.3498, -6.2603], [53.3560, -6.2570]],
          bounds: { north: 53.3570, south: 53.3490, east: -6.2560, west: -6.2610 },
          center: [53.3529, -6.2586],
          format: 'A4',
          style,
          routeColor: style === 'satellite-v9' ? '#FFFF00' : '#FF4444', // Yellow on satellite
          routeWidth: 4,
          showStartEnd: true,
          title: `${style} Style Test`,
          outputPath
        };

        await this.mapService.generateMap(mapOptions);
        const fileExists = await fs.access(outputPath).then(() => true).catch(() => false);
        const fileStats = fileExists ? await fs.stat(outputPath) : null;
        
        styleResults[style] = {
          success: fileExists && fileStats && fileStats.size > 0,
          fileSize: fileStats ? fileStats.size : 0,
          filePath: outputPath
        };
        
      } catch (error) {
        styleResults[style] = {
          success: false,
          error: error.message
        };
      }
    }

    const allStylesWork = Object.values(styleResults).every(result => result.success);
    
    this.logResult(
      'Map Styles and Options',
      allStylesWork,
      allStylesWork ? 'All map styles rendered successfully' : 'Some map styles failed',
      styleResults
    );
  }

  /**
   * Test 5: Performance and Speed Test
   */
  async testPerformanceAndSpeed() {
    try {
      const performanceMetrics = [];
      const iterations = 3;
      
      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        const outputPath = path.join(this.testOutputDir, `performance-test-${i + 1}.png`);
        
        const mapOptions = {
          routeCoordinates: [[53.3498, -6.2603], [53.3560, -6.2570]],
          bounds: { north: 53.3570, south: 53.3490, east: -6.2560, west: -6.2610 },
          center: [53.3529, -6.2586],
          format: 'A4',
          style: 'outdoors-v11',
          routeColor: '#FF4444',
          routeWidth: 4,
          showStartEnd: true,
          title: `Performance Test ${i + 1}`,
          outputPath
        };

        await this.mapService.generateMap(mapOptions);
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        performanceMetrics.push({
          iteration: i + 1,
          duration,
          filePath: outputPath
        });
      }

      const averageTime = performanceMetrics.reduce((sum, metric) => sum + metric.duration, 0) / iterations;
      const maxTime = Math.max(...performanceMetrics.map(m => m.duration));
      const minTime = Math.min(...performanceMetrics.map(m => m.duration));
      
      // Performance is good if average is under 30 seconds and max is under 60 seconds
      const performanceGood = averageTime < 30000 && maxTime < 60000;
      
      this.logResult(
        'Performance and Speed',
        performanceGood,
        performanceGood ? 'Screenshot generation performance is acceptable' : 'Screenshot generation is too slow',
        {
          iterations,
          averageTime: `${averageTime}ms`,
          minTime: `${minTime}ms`,
          maxTime: `${maxTime}ms`,
          metrics: performanceMetrics
        }
      );
      
    } catch (error) {
      this.logResult(
        'Performance and Speed',
        false,
        'Failed to test performance',
        { error: error.message }
      );
    }
  }

  /**
   * Run all screenshot functionality tests
   */
  async runAllTests() {
    console.log('📸 Starting High-Resolution Screenshot Functionality Tests...\n');
    
    // Setup test environment
    const setupSuccess = await this.setupTestEnvironment();
    if (!setupSuccess) {
      console.error('❌ Failed to setup test environment');
      return { success: false, error: 'Setup failed' };
    }

    const tests = [
      'testBasicScreenshotGeneration',
      'testHighResolutionFormats',
      'testScreenshotQuality',
      'testMapStylesAndOptions',
      'testPerformanceAndSpeed'
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

    // Generate summary and cleanup
    const summary = await this.generateTestSummary();
    return summary;
  }

  /**
   * Generate test summary and cleanup
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
      outputDirectory: this.testOutputDir,
      results: this.testResults
    };

    console.log('\n📊 Screenshot Functionality Test Summary:');
    console.log(`Total Tests: ${totalTests}`);
    console.log(`✅ Passed: ${passedTests}`);
    console.log(`❌ Failed: ${failedTests}`);
    console.log(`📈 Success Rate: ${summary.successRate}`);
    console.log(`⏱️  Total Time: ${summary.totalTime}`);
    console.log(`📁 Test screenshots saved to: ${this.testOutputDir}`);

    try {
      // List generated files
      const files = await fs.readdir(this.testOutputDir);
      const pngFiles = files.filter(f => f.endsWith('.png'));
      console.log(`📸 Generated screenshots: ${pngFiles.length}`);
      pngFiles.forEach(file => console.log(`   - ${file}`));
    } catch (error) {
      console.warn('Could not list generated files:', error.message);
    }

    // Cleanup
    try {
      await this.mapService.cleanup();
      console.log('🧹 MapService cleanup completed');
    } catch (error) {
      console.warn('Cleanup warning:', error.message);
    }

    if (passedTests === totalTests) {
      console.log('🎉 All screenshot functionality tests passed!');
    } else {
      console.log('⚠️  Some screenshot tests failed. Review the issues above.');
    }

    return summary;
  }
}

// Export test class
module.exports = ScreenshotFunctionalityTest;

// Run tests if this file is executed directly
if (require.main === module) {
  const test = new ScreenshotFunctionalityTest();
  test.runAllTests()
    .then(summary => {
      process.exit(summary.failedTests > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Test runner failed:', error);
      process.exit(1);
    });
}