/**
 * Image Quality Optimization Test Suite
 * Tests format-specific quality settings, compression, and file size optimization
 * 
 * Run with: node image-quality-optimization-test.js
 * Requires: Backend services and test data
 */

const path = require('path');
const fs = require('fs').promises;
const MapService = require('../services/mapService');

class ImageQualityOptimizationTester {
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
    
    // Test map data
    this.testMapData = {
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
      title: 'Test Route - Quality Optimization'
    };
  }

  /**
   * Run all image quality optimization tests
   */
  async runAllTests() {
    console.log('🧪 Starting Image Quality Optimization Tests...\n');

    const testCategories = [
      'Format Quality Settings',
      'JPEG Export Quality',
      'PNG Compression Levels',
      'File Size Optimization',
      'Anti-aliasing Configuration',
      'Memory vs Quality Balance',
      'Format Comparison',
      'Quality Preset Validation'
    ];

    // Initialize MapService
    try {
      await this.mapService.initialize();
      console.log('✅ MapService initialized successfully\n');
    } catch (error) {
      console.error('❌ Failed to initialize MapService:', error.message);
      return this.testResults;
    }

    // Run test categories
    for (const category of testCategories) {
      console.log(`📋 Testing: ${category}`);
      try {
        await this.runTestCategory(category);
        console.log(`✅ ${category}: All tests passed\n`);
      } catch (error) {
        console.error(`❌ ${category}: Tests failed - ${error.message}\n`);
        this.testResults.summary.errors.push(`${category}: ${error.message}`);
      }
    }

    // Generate summary report
    this.generateSummaryReport();
    
    // Cleanup
    await this.cleanup();
    
    return this.testResults;
  }

  /**
   * Run tests for a specific category
   */
  async runTestCategory(category) {
    const testMethods = {
      'Format Quality Settings': () => this.testFormatQualitySettings(),
      'JPEG Export Quality': () => this.testJPEGExportQuality(),
      'PNG Compression Levels': () => this.testPNGCompressionLevels(),
      'File Size Optimization': () => this.testFileSizeOptimization(),
      'Anti-aliasing Configuration': () => this.testAntiAliasingConfiguration(),
      'Memory vs Quality Balance': () => this.testMemoryQualityBalance(),
      'Format Comparison': () => this.testFormatComparison(),
      'Quality Preset Validation': () => this.testQualityPresetValidation()
    };

    const testMethod = testMethods[category];
    if (!testMethod) {
      throw new Error(`Unknown test category: ${category}`);
    }

    await testMethod();
  }

  /**
   * Test format-specific quality settings
   */
  async testFormatQualitySettings() {
    // Test PNG quality settings
    const pngLow = this.mapService.getFormatQualitySettings('png', 'low');
    this.assert(pngLow.compressionLevel === 9, 'PNG low quality should have high compression');
    this.assert(pngLow.quality === 1.0, 'PNG should maintain full quality');
    
    const pngHigh = this.mapService.getFormatQualitySettings('png', 'high');
    this.assert(pngHigh.compressionLevel === 3, 'PNG high quality should have low compression');
    
    // Test JPEG quality settings
    const jpegLow = this.mapService.getFormatQualitySettings('jpeg', 'low');
    this.assert(jpegLow.quality === 0.7, 'JPEG low quality should be 0.7');
    
    const jpegHigh = this.mapService.getFormatQualitySettings('jpeg', 'high');
    this.assert(jpegHigh.quality === 0.95, 'JPEG high quality should be 0.95');
    
    // Test invalid format handling
    try {
      this.mapService.getFormatQualitySettings('invalid', 'high');
      throw new Error('Should have thrown error for invalid format');
    } catch (error) {
      this.assert(error.message.includes('Unsupported format'), 'Should reject invalid format');
    }

    this.recordTestResult('Format Quality Settings', true, 'All format quality settings validated');
  }

  /**
   * Test JPEG export quality levels
   */
  async testJPEGExportQuality() {
    const outputDir = path.join(__dirname, 'temp', 'jpeg-quality-test');
    await fs.mkdir(outputDir, { recursive: true });

    const qualityLevels = ['low', 'medium', 'high'];
    const results = {};

    for (const quality of qualityLevels) {
      const outputPath = path.join(outputDir, `test-${quality}.jpeg`);
      
      try {
        const screenshot = await this.mapService.generateMap({
          ...this.testMapData,
          format: 'A4',
          orientation: 'portrait',
          dpi: 150, // Lower DPI for faster testing
          exportFormat: 'jpeg',
          qualityLevel: quality,
          outputPath
        });

        // Check file exists and get stats
        const stats = await fs.stat(outputPath);
        results[quality] = {
          fileSize: stats.size,
          exists: true
        };

        console.log(`  📸 JPEG ${quality} quality: ${(stats.size / 1024).toFixed(1)}KB`);
        
      } catch (error) {
        results[quality] = {
          error: error.message,
          exists: false
        };
      }
    }

    // Validate that higher quality = larger file size
    this.assert(results.low.exists && results.medium.exists && results.high.exists, 
      'All JPEG quality levels should generate files');
    this.assert(results.low.fileSize < results.medium.fileSize, 
      'Medium quality should be larger than low quality');
    this.assert(results.medium.fileSize < results.high.fileSize, 
      'High quality should be larger than medium quality');

    this.recordTestResult('JPEG Export Quality', true, 'JPEG quality levels produce expected file sizes');
  }

  /**
   * Test PNG compression levels
   */
  async testPNGCompressionLevels() {
    const outputDir = path.join(__dirname, 'temp', 'png-compression-test');
    await fs.mkdir(outputDir, { recursive: true });

    const qualityLevels = ['low', 'medium', 'high'];
    const results = {};

    for (const quality of qualityLevels) {
      const outputPath = path.join(outputDir, `test-${quality}.png`);
      
      try {
        const screenshot = await this.mapService.generateMap({
          ...this.testMapData,
          format: 'A4',
          orientation: 'portrait',
          dpi: 150, // Lower DPI for faster testing
          exportFormat: 'png',
          qualityLevel: quality,
          outputPath
        });

        const stats = await fs.stat(outputPath);
        results[quality] = {
          fileSize: stats.size,
          exists: true
        };

        console.log(`  📸 PNG ${quality} quality: ${(stats.size / 1024).toFixed(1)}KB`);
        
      } catch (error) {
        results[quality] = {
          error: error.message,
          exists: false
        };
      }
    }

    // Validate that higher compression (low quality) = smaller file size
    this.assert(results.low.exists && results.medium.exists && results.high.exists, 
      'All PNG quality levels should generate files');
    this.assert(results.low.fileSize < results.high.fileSize, 
      'High compression (low quality) should produce smaller files');

    this.recordTestResult('PNG Compression Levels', true, 'PNG compression levels work as expected');
  }

  /**
   * Test file size optimization features
   */
  async testFileSizeOptimization() {
    const outputDir = path.join(__dirname, 'temp', 'size-optimization-test');
    await fs.mkdir(outputDir, { recursive: true });

    // Test different formats for same content
    const formats = [
      { exportFormat: 'jpeg', qualityLevel: 'low' },
      { exportFormat: 'jpeg', qualityLevel: 'high' },
      { exportFormat: 'png', qualityLevel: 'low' },
      { exportFormat: 'png', qualityLevel: 'high' }
    ];

    const fileSizes = {};

    for (const formatConfig of formats) {
      const fileName = `test-${formatConfig.exportFormat}-${formatConfig.qualityLevel}`;
      const outputPath = path.join(outputDir, `${fileName}.${formatConfig.exportFormat}`);
      
      try {
        await this.mapService.generateMap({
          ...this.testMapData,
          format: 'A4',
          orientation: 'portrait',
          dpi: 150,
          ...formatConfig,
          outputPath
        });

        const stats = await fs.stat(outputPath);
        fileSizes[fileName] = stats.size;
        
        console.log(`  📊 ${fileName}: ${(stats.size / 1024).toFixed(1)}KB`);
        
      } catch (error) {
        console.log(`  ❌ ${fileName}: Failed - ${error.message}`);
      }
    }

    // Validate optimization expectations
    this.assert(fileSizes['test-jpeg-low'] < fileSizes['test-png-low'], 
      'JPEG should be smaller than PNG at comparable quality');
    this.assert(fileSizes['test-jpeg-low'] < fileSizes['test-jpeg-high'], 
      'Low quality JPEG should be smaller than high quality');

    this.recordTestResult('File Size Optimization', true, 'File size optimization working correctly');
  }

  /**
   * Test anti-aliasing configuration
   */
  async testAntiAliasingConfiguration() {
    // Test with anti-aliasing enabled
    const mapWithAA = await this.mapService.generateMap({
      ...this.testMapData,
      format: 'A4',
      orientation: 'portrait',
      dpi: 150,
      antiAliasing: true,
      exportFormat: 'png',
      qualityLevel: 'high'
    });

    // Test with anti-aliasing disabled
    const mapWithoutAA = await this.mapService.generateMap({
      ...this.testMapData,
      format: 'A4',
      orientation: 'portrait',
      dpi: 150,
      antiAliasing: false,
      exportFormat: 'png',
      qualityLevel: 'high'
    });

    this.assert(mapWithAA && mapWithoutAA, 'Both anti-aliasing configurations should work');
    
    this.recordTestResult('Anti-aliasing Configuration', true, 'Anti-aliasing settings applied successfully');
  }

  /**
   * Test memory vs quality balance
   */
  async testMemoryQualityBalance() {
    // Test high-resolution with memory optimization
    const optimizedMap = await this.mapService.generateMap({
      ...this.testMapData,
      format: 'A4',
      orientation: 'portrait',
      dpi: 300,
      memoryOptimization: true,
      maxMemoryMB: 200,
      exportFormat: 'jpeg',
      qualityLevel: 'medium'
    });

    // Test without memory optimization
    const unoptimizedMap = await this.mapService.generateMap({
      ...this.testMapData,
      format: 'A4',
      orientation: 'portrait',
      dpi: 300,
      memoryOptimization: false,
      exportFormat: 'jpeg',
      qualityLevel: 'medium'
    });

    this.assert(optimizedMap && unoptimizedMap, 'Both memory optimization settings should work');
    
    this.recordTestResult('Memory vs Quality Balance', true, 'Memory optimization balanced with quality');
  }

  /**
   * Test format comparison
   */
  async testFormatComparison() {
    const outputDir = path.join(__dirname, 'temp', 'format-comparison-test');
    await fs.mkdir(outputDir, { recursive: true });

    // Generate same map in both formats
    const pngPath = path.join(outputDir, 'comparison.png');
    const jpegPath = path.join(outputDir, 'comparison.jpeg');

    await this.mapService.generateMap({
      ...this.testMapData,
      format: 'A4',
      orientation: 'portrait',
      dpi: 150,
      exportFormat: 'png',
      qualityLevel: 'high',
      outputPath: pngPath
    });

    await this.mapService.generateMap({
      ...this.testMapData,
      format: 'A4',
      orientation: 'portrait',
      dpi: 150,
      exportFormat: 'jpeg',
      qualityLevel: 'high',
      outputPath: jpegPath
    });

    // Compare file sizes
    const pngStats = await fs.stat(pngPath);
    const jpegStats = await fs.stat(jpegPath);

    console.log(`  📊 PNG: ${(pngStats.size / 1024).toFixed(1)}KB`);
    console.log(`  📊 JPEG: ${(jpegStats.size / 1024).toFixed(1)}KB`);
    console.log(`  📊 JPEG is ${((1 - jpegStats.size / pngStats.size) * 100).toFixed(1)}% smaller`);

    this.assert(jpegStats.size < pngStats.size, 'JPEG should be smaller than PNG');
    
    this.recordTestResult('Format Comparison', true, 'Format comparison shows expected differences');
  }

  /**
   * Test quality preset validation
   */
  async testQualityPresetValidation() {
    // Test valid quality presets
    const validPresets = ['low', 'medium', 'high'];
    const validFormats = ['png', 'jpeg'];

    for (const format of validFormats) {
      for (const preset of validPresets) {
        const settings = this.mapService.getFormatQualitySettings(format, preset);
        this.assert(settings.format === format, `Format should match: ${format}`);
        this.assert(settings.qualityLevel === preset, `Quality level should match: ${preset}`);
        this.assert(typeof settings.antiAliasing === 'boolean', 'Anti-aliasing should be boolean');
      }
    }

    // Test invalid presets
    try {
      this.mapService.getFormatQualitySettings('png', 'invalid');
      throw new Error('Should have rejected invalid quality level');
    } catch (error) {
      this.assert(error.message.includes('Invalid quality level'), 'Should reject invalid quality level');
    }

    this.recordTestResult('Quality Preset Validation', true, 'All quality presets validated correctly');
  }

  /**
   * Record test result
   */
  recordTestResult(testName, passed, message, details = null) {
    this.testResults.tests[testName] = {
      passed,
      message,
      details,
      timestamp: Date.now()
    };

    this.testResults.summary.totalTests++;
    if (passed) {
      this.testResults.summary.passed++;
    } else {
      this.testResults.summary.failed++;
      this.testResults.summary.errors.push(`${testName}: ${message}`);
    }
  }

  /**
   * Assert helper
   */
  assert(condition, message) {
    if (!condition) {
      throw new Error(message);
    }
  }

  /**
   * Generate summary report
   */
  generateSummaryReport() {
    const duration = Date.now() - this.testResults.startTime;
    const passRate = ((this.testResults.summary.passed / this.testResults.summary.totalTests) * 100).toFixed(1);

    console.log('\n' + '='.repeat(60));
    console.log('📊 IMAGE QUALITY OPTIMIZATION TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${this.testResults.summary.totalTests}`);
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

    console.log('='.repeat(60));
  }

  /**
   * Cleanup test artifacts
   */
  async cleanup() {
    try {
      await this.mapService.cleanup();
      
      // Clean up test files
      const tempDir = path.join(__dirname, 'temp');
      try {
        await fs.rmdir(tempDir, { recursive: true });
        console.log('🧹 Test artifacts cleaned up');
      } catch (error) {
        console.log('⚠️  Could not clean up temp directory:', error.message);
      }
      
    } catch (error) {
      console.log('⚠️  Cleanup warning:', error.message);
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new ImageQualityOptimizationTester();
  tester.runAllTests()
    .then(results => {
      const success = results.summary.failed === 0;
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('🚨 Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = ImageQualityOptimizationTester;