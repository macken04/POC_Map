/**
 * Visual Regression Test Suite for Map Exports
 * Compares map export outputs against baseline images to detect visual changes
 * 
 * Run with: node visual-regression-test.js
 * Requires: MapService, sharp (for image comparison)
 */

const path = require('path');
const fs = require('fs').promises;
const MapService = require('../services/mapService');

class VisualRegressionTester {
  constructor() {
    this.mapService = new MapService();
    this.testResults = {
      tests: {},
      summary: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        errors: []
      },
      startTime: Date.now()
    };
    
    this.baselineDir = path.join(__dirname, 'baselines');
    this.currentDir = path.join(__dirname, 'temp', 'visual-regression');
    this.diffDir = path.join(__dirname, 'temp', 'visual-diffs');
    
    // Visual regression test cases
    this.testCases = [
      {
        name: 'Basic Route A4 Portrait',
        config: {
          format: 'A4',
          orientation: 'portrait',
          dpi: 150, // Lower DPI for faster testing
          exportFormat: 'png',
          qualityLevel: 'high'
        },
        routeData: this.getBasicRouteData(),
        tolerance: 0.05 // 5% pixel difference tolerance
      },
      {
        name: 'Complex Route A3 Landscape',
        config: {
          format: 'A3',
          orientation: 'landscape',
          dpi: 150,
          exportFormat: 'png',
          qualityLevel: 'high'
        },
        routeData: this.getComplexRouteData(),
        tolerance: 0.08 // Higher tolerance for complex routes
      },
      {
        name: 'JPEG Export Quality',
        config: {
          format: 'A4',
          orientation: 'portrait',
          dpi: 150,
          exportFormat: 'jpeg',
          qualityLevel: 'high'
        },
        routeData: this.getBasicRouteData(),
        tolerance: 0.15 // Higher tolerance for JPEG compression
      },
      {
        name: 'Style Consistency Outdoors',
        config: {
          format: 'A4',
          orientation: 'portrait',
          dpi: 150,
          exportFormat: 'png',
          qualityLevel: 'high',
          style: 'outdoors-v11'
        },
        routeData: this.getBasicRouteData(),
        tolerance: 0.05
      },
      {
        name: 'Route Color Variations',
        config: {
          format: 'A4',
          orientation: 'portrait',
          dpi: 150,
          exportFormat: 'png',
          qualityLevel: 'high',
          routeColor: '#00FF00', // Green route
          routeWidth: 6
        },
        routeData: this.getBasicRouteData(),
        tolerance: 0.05
      }
    ];
  }

  /**
   * Get basic route data for testing
   */
  getBasicRouteData() {
    return {
      routeCoordinates: [
        [-122.4194, 37.7749], // San Francisco
        [-122.4094, 37.7849],
        [-122.3994, 37.7949]
      ],
      bounds: [
        [-122.4294, 37.7649],
        [-122.3894, 37.8049]
      ],
      center: [-122.4094, 37.7849],
      title: 'Basic Test Route'
    };
  }

  /**
   * Get complex route data for testing
   */
  getComplexRouteData() {
    return {
      routeCoordinates: [
        [-122.4194, 37.7749], // San Francisco
        [-122.4094, 37.7849],
        [-122.3994, 37.7949],
        [-122.3894, 37.8049],
        [-122.3794, 37.8149],
        [-122.3694, 37.8249],
        [-122.3594, 37.8149],
        [-122.3494, 37.8049]
      ],
      bounds: [
        [-122.4294, 37.7649],
        [-122.3394, 37.8349]
      ],
      center: [-122.3844, 37.7949],
      title: 'Complex Test Route with Multiple Turns'
    };
  }

  /**
   * Run all visual regression tests
   */
  async runAllTests() {
    console.log('👁️  Starting Visual Regression Tests...\n');

    // Create directories
    await this.createDirectories();

    // Initialize MapService
    try {
      await this.mapService.initialize();
      console.log('✅ MapService initialized successfully\n');
    } catch (error) {
      console.error('❌ Failed to initialize MapService:', error.message);
      return this.testResults;
    }

    // Check if baselines exist, if not create them
    const baselinesExist = await this.checkBaselines();
    if (!baselinesExist) {
      console.log('📸 No baselines found. Creating baseline images...\n');
      await this.createBaselines();
      console.log('✅ Baseline images created. Run tests again to compare.\n');
      return this.testResults;
    }

    // Run visual regression tests
    for (const testCase of this.testCases) {
      console.log(`🔍 Testing: ${testCase.name}`);
      
      try {
        await this.runVisualRegressionTest(testCase);
        console.log(`✅ ${testCase.name}: Visual regression test passed\n`);
      } catch (error) {
        console.error(`❌ ${testCase.name}: Visual regression test failed - ${error.message}\n`);
        this.testResults.summary.errors.push(`${testCase.name}: ${error.message}`);
      }
    }

    // Generate summary report
    this.generateSummaryReport();
    
    // Cleanup
    await this.cleanup();
    
    return this.testResults;
  }

  /**
   * Create necessary directories
   */
  async createDirectories() {
    await fs.mkdir(this.baselineDir, { recursive: true });
    await fs.mkdir(this.currentDir, { recursive: true });
    await fs.mkdir(this.diffDir, { recursive: true });
  }

  /**
   * Check if baseline images exist
   */
  async checkBaselines() {
    try {
      const files = await fs.readdir(this.baselineDir);
      return files.length >= this.testCases.length;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create baseline images for all test cases
   */
  async createBaselines() {
    for (const testCase of this.testCases) {
      console.log(`📸 Creating baseline: ${testCase.name}`);
      
      const baselinePath = path.join(this.baselineDir, `${this.sanitizeFileName(testCase.name)}.png`);
      
      try {
        await this.mapService.generateMap({
          ...testCase.routeData,
          ...testCase.config,
          outputPath: baselinePath
        });
        
        console.log(`  ✅ Baseline created: ${baselinePath}`);
        
      } catch (error) {
        console.error(`  ❌ Failed to create baseline: ${error.message}`);
      }
    }
  }

  /**
   * Run visual regression test for a specific test case
   */
  async runVisualRegressionTest(testCase) {
    const testName = this.sanitizeFileName(testCase.name);
    const baselinePath = path.join(this.baselineDir, `${testName}.png`);
    const currentPath = path.join(this.currentDir, `${testName}.png`);
    const diffPath = path.join(this.diffDir, `${testName}-diff.png`);

    // Generate current image
    await this.mapService.generateMap({
      ...testCase.routeData,
      ...testCase.config,
      outputPath: currentPath
    });

    // Compare images
    const comparison = await this.compareImages(baselinePath, currentPath, diffPath);
    
    // Record test result
    this.testResults.tests[testCase.name] = {
      passed: comparison.pixelDifference <= testCase.tolerance,
      pixelDifference: comparison.pixelDifference,
      tolerance: testCase.tolerance,
      baselinePath,
      currentPath,
      diffPath: comparison.pixelDifference > testCase.tolerance ? diffPath : null,
      details: comparison
    };

    this.testResults.summary.totalTests++;
    
    if (comparison.pixelDifference <= testCase.tolerance) {
      this.testResults.summary.passed++;
      console.log(`  📊 Pixel difference: ${(comparison.pixelDifference * 100).toFixed(2)}% (within ${(testCase.tolerance * 100).toFixed(1)}% tolerance)`);
    } else {
      this.testResults.summary.failed++;
      console.log(`  ⚠️  Pixel difference: ${(comparison.pixelDifference * 100).toFixed(2)}% (exceeds ${(testCase.tolerance * 100).toFixed(1)}% tolerance)`);
      console.log(`  📷 Visual diff saved: ${diffPath}`);
      
      throw new Error(`Visual regression detected: ${(comparison.pixelDifference * 100).toFixed(2)}% pixel difference`);
    }
  }

  /**
   * Compare two images and generate diff
   * Simple pixel-by-pixel comparison (in a real implementation, you'd use a library like pixelmatch)
   */
  async compareImages(baselinePath, currentPath, diffPath) {
    try {
      // Read both files
      const baselineBuffer = await fs.readFile(baselinePath);
      const currentBuffer = await fs.readFile(currentPath);

      // For this implementation, we'll do a simple buffer comparison
      // In a real scenario, you'd use an image comparison library
      const bufferDifference = this.compareBuffers(baselineBuffer, currentBuffer);
      
      // Create a simple diff report
      const comparison = {
        pixelDifference: bufferDifference,
        totalPixels: baselineBuffer.length,
        differentPixels: Math.round(baselineBuffer.length * bufferDifference),
        method: 'buffer-comparison' // Simplified comparison method
      };

      // Generate diff image placeholder (in real implementation, use proper image diff)
      if (bufferDifference > 0) {
        await this.createDiffPlaceholder(diffPath, comparison);
      }

      return comparison;
      
    } catch (error) {
      throw new Error(`Image comparison failed: ${error.message}`);
    }
  }

  /**
   * Simple buffer comparison (placeholder for proper image comparison)
   */
  compareBuffers(buffer1, buffer2) {
    if (buffer1.length !== buffer2.length) {
      return 1.0; // 100% different if sizes don't match
    }

    let differentBytes = 0;
    const sampleSize = Math.min(buffer1.length, 10000); // Sample for performance
    const step = Math.floor(buffer1.length / sampleSize);

    for (let i = 0; i < buffer1.length; i += step) {
      if (buffer1[i] !== buffer2[i]) {
        differentBytes++;
      }
    }

    return differentBytes / sampleSize;
  }

  /**
   * Create a diff image placeholder
   */
  async createDiffPlaceholder(diffPath, comparison) {
    const diffReport = `
Visual Regression Diff Report
============================

Pixel Difference: ${(comparison.pixelDifference * 100).toFixed(2)}%
Different Pixels: ${comparison.differentPixels}
Total Pixels: ${comparison.totalPixels}
Method: ${comparison.method}

Generated: ${new Date().toISOString()}

Note: This is a placeholder. In a production system, 
use a proper image diffing library like pixelmatch 
or resemblejs to generate actual visual diffs.
`;

    await fs.writeFile(diffPath.replace('.png', '.txt'), diffReport);
  }

  /**
   * Sanitize filename for cross-platform compatibility
   */
  sanitizeFileName(name) {
    return name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
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
    console.log('📊 VISUAL REGRESSION TEST SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Tests: ${this.testResults.summary.totalTests}`);
    console.log(`Passed: ${this.testResults.summary.passed}`);
    console.log(`Failed: ${this.testResults.summary.failed}`);
    console.log(`Pass Rate: ${passRate}%`);
    console.log(`Duration: ${(duration / 1000).toFixed(2)}s`);

    // Detailed test results
    console.log('\n📋 Test Details:');
    for (const [testName, result] of Object.entries(this.testResults.tests)) {
      const status = result.passed ? '✅' : '❌';
      const percentage = (result.pixelDifference * 100).toFixed(2);
      const tolerance = (result.tolerance * 100).toFixed(1);
      
      console.log(`${status} ${testName}: ${percentage}% diff (tolerance: ${tolerance}%)`);
      
      if (!result.passed && result.diffPath) {
        console.log(`    📷 Diff: ${result.diffPath}`);
      }
    }

    if (this.testResults.summary.errors.length > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.testResults.summary.errors.forEach(error => {
        console.log(`  • ${error}`);
      });
    }

    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    
    if (this.testResults.summary.failed > 0) {
      console.log('  • Review visual diffs to determine if changes are intentional');
      console.log('  • If changes are expected, update baselines with: --update-baselines');
      console.log('  • Consider adjusting tolerance levels for tests with minor variations');
    }
    
    if (this.testResults.summary.passed === this.testResults.summary.totalTests) {
      console.log('  • All visual regression tests passed - no unexpected visual changes detected');
      console.log('  • Consider adding more test cases for edge cases and different configurations');
    }

    console.log('='.repeat(80));
  }

  /**
   * Update baselines (utility method for when visual changes are intentional)
   */
  async updateBaselines() {
    console.log('🔄 Updating baselines with current test results...\n');
    
    for (const testCase of this.testCases) {
      const testName = this.sanitizeFileName(testCase.name);
      const currentPath = path.join(this.currentDir, `${testName}.png`);
      const baselinePath = path.join(this.baselineDir, `${testName}.png`);
      
      try {
        // Copy current to baseline
        await fs.copyFile(currentPath, baselinePath);
        console.log(`✅ Updated baseline: ${testCase.name}`);
      } catch (error) {
        console.error(`❌ Failed to update baseline for ${testCase.name}: ${error.message}`);
      }
    }
    
    console.log('\n🎯 Baselines updated successfully');
  }

  /**
   * Cleanup test artifacts
   */
  async cleanup() {
    try {
      await this.mapService.cleanup();
      
      // Optional: Clean up temp directories (keep for inspection)
      console.log('📁 Test results preserved in temp directories for inspection');
      console.log(`  Current: ${this.currentDir}`);
      console.log(`  Diffs: ${this.diffDir}`);
      console.log(`  Baselines: ${this.baselineDir}`);
      
    } catch (error) {
      console.log('⚠️  Cleanup warning:', error.message);
    }
  }
}

// Command line argument handling
const args = process.argv.slice(2);
const updateBaselines = args.includes('--update-baselines');

// Run tests if called directly
if (require.main === module) {
  const tester = new VisualRegressionTester();
  
  if (updateBaselines) {
    tester.updateBaselines()
      .then(() => process.exit(0))
      .catch(error => {
        console.error('🚨 Baseline update failed:', error);
        process.exit(1);
      });
  } else {
    tester.runAllTests()
      .then(results => {
        const success = results.summary.failed === 0;
        process.exit(success ? 0 : 1);
      })
      .catch(error => {
        console.error('🚨 Visual regression test suite failed:', error);
        process.exit(1);
      });
  }
}

module.exports = VisualRegressionTester;