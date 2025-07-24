/**
 * Cross-Browser Export Functionality Test Suite
 * Tests high-resolution map export across different browsers
 * 
 * Run with: node cross-browser-export-test.js
 * Requires: puppeteer, MapService
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs').promises;
const MapService = require('../services/mapService');

class CrossBrowserExportTester {
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
    
    // Test configurations for different export scenarios
    this.exportTestCases = [
      {
        name: 'PNG High Quality Export',
        config: {
          format: 'A4',
          orientation: 'portrait',
          dpi: 300,
          exportFormat: 'png',
          qualityLevel: 'high'
        },
        expectedMinSizeMB: 5, // Minimum expected file size
        expectedMaxSizeMB: 15, // Maximum expected file size
        timeout: 30000
      },
      {
        name: 'JPEG Medium Quality Export',
        config: {
          format: 'A4',
          orientation: 'portrait',
          dpi: 300,
          exportFormat: 'jpeg',
          qualityLevel: 'medium'
        },
        expectedMinSizeMB: 2,
        expectedMaxSizeMB: 8,
        timeout: 30000
      },
      {
        name: 'A3 Landscape Export',
        config: {
          format: 'A3',
          orientation: 'landscape',
          dpi: 150,
          exportFormat: 'png',
          qualityLevel: 'medium'
        },
        expectedMinSizeMB: 3,
        expectedMaxSizeMB: 12,
        timeout: 45000
      },
      {
        name: 'Low DPI JPEG Export',
        config: {
          format: 'A4',
          orientation: 'portrait',
          dpi: 150,
          exportFormat: 'jpeg',
          qualityLevel: 'low'
        },
        expectedMinSizeMB: 0.5,
        expectedMaxSizeMB: 3,
        timeout: 20000
      }
    ];

    // Browser configurations for testing
    this.browsers = [
      {
        name: 'Chrome-Default',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      {
        name: 'Chrome-Mobile',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        viewport: { width: 375, height: 667, isMobile: true, hasTouch: true }
      },
      {
        name: 'Chrome-HighDPI',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--force-device-scale-factor=2'],
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080, deviceScaleFactor: 2 }
      }
    ];

    // Test map data
    this.testMapData = {
      routeCoordinates: [
        [-122.4194, 37.7749], // San Francisco
        [-122.4094, 37.7849],
        [-122.3994, 37.7949],
        [-122.3894, 37.8049]
      ],
      bounds: [
        [-122.4294, 37.7649],
        [-122.3794, 37.8149]
      ],
      center: [-122.4094, 37.7849],
      title: 'Cross-Browser Test Route'
    };
  }

  /**
   * Run all cross-browser export tests
   */
  async runAllTests() {
    console.log('🌐 Starting Cross-Browser Export Tests...\n');

    const outputDir = path.join(__dirname, 'temp', 'cross-browser-export');
    await fs.mkdir(outputDir, { recursive: true });

    // Test each browser configuration
    for (const browserConfig of this.browsers) {
      console.log(`🔍 Testing browser: ${browserConfig.name}`);
      
      try {
        await this.testBrowser(browserConfig, outputDir);
        console.log(`✅ ${browserConfig.name}: All export tests passed\n`);
      } catch (error) {
        console.error(`❌ ${browserConfig.name}: Tests failed - ${error.message}\n`);
        this.testResults.summary.errors.push(`${browserConfig.name}: ${error.message}`);
      }
    }

    // Generate comparison report
    this.generateComparisonReport();
    
    // Generate summary report
    this.generateSummaryReport();
    
    return this.testResults;
  }

  /**
   * Test export functionality in a specific browser
   */
  async testBrowser(browserConfig, outputDir) {
    const browserDir = path.join(outputDir, browserConfig.name);
    await fs.mkdir(browserDir, { recursive: true });

    // Launch browser with specific configuration
    const browser = await puppeteer.launch({
      headless: 'new',
      args: browserConfig.args || [],
      defaultViewport: browserConfig.viewport || { width: 1920, height: 1080 }
    });

    const mapService = new MapService();
    
    try {
      // Override browser instance for this test
      mapService.browser = browser;
      
      // Initialize browser results
      this.testResults.browsers[browserConfig.name] = {
        tests: {},
        capabilities: {},
        performance: {},
        errors: []
      };

      // Test browser capabilities first
      await this.testBrowserCapabilities(browser, browserConfig.name);

      // Run export test cases
      for (const testCase of this.exportTestCases) {
        console.log(`  📸 Testing: ${testCase.name}`);
        
        try {
          await this.runExportTest(mapService, testCase, browserConfig.name, browserDir);
          console.log(`    ✅ ${testCase.name}: Passed`);
        } catch (error) {
          console.log(`    ❌ ${testCase.name}: Failed - ${error.message}`);
          this.testResults.browsers[browserConfig.name].errors.push(`${testCase.name}: ${error.message}`);
        }
      }

    } finally {
      await mapService.cleanup();
      await browser.close();
    }
  }

  /**
   * Test browser capabilities for map export
   */
  async testBrowserCapabilities(browser, browserName) {
    const page = await browser.newPage();
    
    try {
      // Test WebGL support
      const webglSupported = await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        return !!gl;
      });

      // Test Canvas capabilities
      const canvasSupported = await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        return !!(ctx && typeof ctx.getImageData === 'function');
      });

      // Test high-resolution support
      const highResSupported = await page.evaluate(() => {
        return window.devicePixelRatio >= 1;
      });

      // Test memory info (if available)
      const memoryInfo = await page.evaluate(() => {
        if (performance.memory) {
          return {
            usedJSHeapSize: performance.memory.usedJSHeapSize,
            totalJSHeapSize: performance.memory.totalJSHeapSize,
            jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
          };
        }
        return null;
      });

      this.testResults.browsers[browserName].capabilities = {
        webgl: webglSupported,
        canvas: canvasSupported,
        highRes: highResSupported,
        memory: memoryInfo,
        userAgent: await page.evaluate(() => navigator.userAgent)
      };

      console.log(`    🔧 WebGL: ${webglSupported ? '✅' : '❌'}`);
      console.log(`    🔧 Canvas: ${canvasSupported ? '✅' : '❌'}`);
      console.log(`    🔧 High-DPI: ${highResSupported ? '✅' : '❌'}`);

    } finally {
      await page.close();
    }
  }

  /**
   * Run a specific export test case
   */
  async runExportTest(mapService, testCase, browserName, browserDir) {
    const startTime = Date.now();
    const outputPath = path.join(browserDir, `${testCase.name.replace(/\s+/g, '-').toLowerCase()}.${testCase.config.exportFormat}`);

    try {
      // Generate map with test configuration
      const screenshot = await mapService.generateMap({
        ...this.testMapData,
        ...testCase.config,
        outputPath
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Validate file was created
      const stats = await fs.stat(outputPath);
      const fileSizeMB = stats.size / (1024 * 1024);

      // Validate file size is within expected range
      if (fileSizeMB < testCase.expectedMinSizeMB) {
        throw new Error(`File too small: ${fileSizeMB.toFixed(2)}MB < ${testCase.expectedMinSizeMB}MB`);
      }
      if (fileSizeMB > testCase.expectedMaxSizeMB) {
        throw new Error(`File too large: ${fileSizeMB.toFixed(2)}MB > ${testCase.expectedMaxSizeMB}MB`);
      }

      // Record successful test
      this.testResults.browsers[browserName].tests[testCase.name] = {
        passed: true,
        duration,
        fileSize: stats.size,
        fileSizeMB: fileSizeMB.toFixed(2),
        outputPath,
        config: testCase.config
      };

      this.testResults.summary.totalTests++;
      this.testResults.summary.passed++;

      console.log(`      📊 Size: ${fileSizeMB.toFixed(2)}MB, Duration: ${duration}ms`);

    } catch (error) {
      // Record failed test
      this.testResults.browsers[browserName].tests[testCase.name] = {
        passed: false,
        error: error.message,
        config: testCase.config
      };

      this.testResults.summary.totalTests++;
      this.testResults.summary.failed++;
      
      throw error;
    }
  }

  /**
   * Generate cross-browser comparison report
   */
  generateComparisonReport() {
    console.log('\n' + '='.repeat(80));
    console.log('🔍 CROSS-BROWSER EXPORT COMPARISON');
    console.log('='.repeat(80));

    // Compare capabilities across browsers
    console.log('\n📋 Browser Capabilities:');
    for (const [browserName, results] of Object.entries(this.testResults.browsers)) {
      const caps = results.capabilities;
      console.log(`${browserName}:`);
      console.log(`  WebGL: ${caps.webgl ? '✅' : '❌'} | Canvas: ${caps.canvas ? '✅' : '❌'} | High-DPI: ${caps.highRes ? '✅' : '❌'}`);
      
      if (caps.memory) {
        console.log(`  Memory: ${(caps.memory.usedJSHeapSize / 1024 / 1024).toFixed(1)}MB used / ${(caps.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(1)}MB limit`);
      }
    }

    // Compare export performance
    console.log('\n⚡ Export Performance Comparison:');
    for (const testCase of this.exportTestCases) {
      console.log(`\n${testCase.name}:`);
      
      for (const [browserName, results] of Object.entries(this.testResults.browsers)) {
        const test = results.tests[testCase.name];
        if (test && test.passed) {
          console.log(`  ${browserName}: ${test.fileSizeMB}MB in ${test.duration}ms`);
        } else if (test && !test.passed) {
          console.log(`  ${browserName}: ❌ ${test.error}`);
        } else {
          console.log(`  ${browserName}: ⚠️  No data`);
        }
      }
    }

    // Identify issues
    console.log('\n⚠️  Browser-Specific Issues:');
    for (const [browserName, results] of Object.entries(this.testResults.browsers)) {
      if (results.errors.length > 0) {
        console.log(`${browserName}:`);
        results.errors.forEach(error => {
          console.log(`  • ${error}`);
        });
      }
    }
  }

  /**
   * Generate summary report
   */
  generateSummaryReport() {
    const duration = Date.now() - this.testResults.startTime;
    const passRate = this.testResults.summary.totalTests > 0 
      ? ((this.testResults.summary.passed / this.testResults.summary.totalTests) * 100).toFixed(1)
      : 0;

    console.log('\n' + '='.repeat(80));
    console.log('📊 CROSS-BROWSER EXPORT TEST SUMMARY');
    console.log('='.repeat(80));
    console.log(`Browsers Tested: ${Object.keys(this.testResults.browsers).length}`);
    console.log(`Total Export Tests: ${this.testResults.summary.totalTests}`);
    console.log(`Passed: ${this.testResults.summary.passed}`);
    console.log(`Failed: ${this.testResults.summary.failed}`);
    console.log(`Pass Rate: ${passRate}%`);
    console.log(`Duration: ${(duration / 1000).toFixed(2)}s`);

    if (this.testResults.summary.errors.length > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.testResults.summary.errors.forEach(error => {
        console.log(`  • ${error}`);
      });
    }

    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    const browserResults = Object.entries(this.testResults.browsers);
    
    // Check for consistent WebGL support
    const webglSupport = browserResults.filter(([name, results]) => results.capabilities.webgl).length;
    if (webglSupport < browserResults.length) {
      console.log('  • Some browsers lack WebGL support - provide fallback rendering');
    }

    // Check for performance variations
    const performanceVariations = this.analyzePerformanceVariations();
    if (performanceVariations.high) {
      console.log('  • High performance variation detected - consider browser-specific optimizations');
    }

    // Check for file size inconsistencies
    const fileSizeVariations = this.analyzeFileSizeVariations();
    if (fileSizeVariations.high) {
      console.log('  • File size variations detected - verify rendering consistency');
    }

    console.log('='.repeat(80));
  }

  /**
   * Analyze performance variations across browsers
   */
  analyzePerformanceVariations() {
    const testTimes = {};
    
    for (const testCase of this.exportTestCases) {
      const times = [];
      
      for (const [browserName, results] of Object.entries(this.testResults.browsers)) {
        const test = results.tests[testCase.name];
        if (test && test.passed && test.duration) {
          times.push(test.duration);
        }
      }
      
      if (times.length > 1) {
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        const variance = times.reduce((acc, time) => acc + Math.pow(time - avg, 2), 0) / times.length;
        const stdDev = Math.sqrt(variance);
        
        testTimes[testCase.name] = {
          average: avg,
          standardDeviation: stdDev,
          coefficientOfVariation: stdDev / avg
        };
      }
    }

    // High variation is coefficient of variation > 0.3
    const highVariation = Object.values(testTimes).some(stats => stats.coefficientOfVariation > 0.3);
    
    return { high: highVariation, details: testTimes };
  }

  /**
   * Analyze file size variations across browsers
   */
  analyzeFileSizeVariations() {
    const fileSizes = {};
    
    for (const testCase of this.exportTestCases) {
      const sizes = [];
      
      for (const [browserName, results] of Object.entries(this.testResults.browsers)) {
        const test = results.tests[testCase.name];
        if (test && test.passed && test.fileSize) {
          sizes.push(test.fileSize);
        }
      }
      
      if (sizes.length > 1) {
        const avg = sizes.reduce((a, b) => a + b, 0) / sizes.length;
        const variance = sizes.reduce((acc, size) => acc + Math.pow(size - avg, 2), 0) / sizes.length;
        const stdDev = Math.sqrt(variance);
        
        fileSizes[testCase.name] = {
          average: avg,
          standardDeviation: stdDev,
          coefficientOfVariation: stdDev / avg
        };
      }
    }

    // High variation is coefficient of variation > 0.1 (10% difference)
    const highVariation = Object.values(fileSizes).some(stats => stats.coefficientOfVariation > 0.1);
    
    return { high: highVariation, details: fileSizes };
  }

  /**
   * Cleanup test artifacts
   */
  async cleanup() {
    try {
      const tempDir = path.join(__dirname, 'temp', 'cross-browser-export');
      await fs.rmdir(tempDir, { recursive: true });
      console.log('🧹 Cross-browser test artifacts cleaned up');
    } catch (error) {
      console.log('⚠️  Could not clean up cross-browser test directory:', error.message);
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new CrossBrowserExportTester();
  tester.runAllTests()
    .then(results => {
      const success = results.summary.failed === 0;
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('🚨 Cross-browser export test suite failed:', error);
      process.exit(1);
    });
}

module.exports = CrossBrowserExportTester;