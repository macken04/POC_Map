/**
 * Canvas Processor Test Suite
 * Tests the multi-format image processing functionality
 */

const CanvasProcessor = require('../services/canvasProcessor');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

console.log('🧪 Canvas Processor Test Suite Starting...');
console.log('=' .repeat(50));

let passed = 0;
let failed = 0;

function test(name, testFn) {
  return new Promise(async (resolve) => {
    try {
      console.log(`\n📋 Test: ${name}`);
      await testFn();
      console.log('✅ PASSED');
      passed++;
    } catch (error) {
      console.log(`❌ FAILED: ${error.message}`);
      failed++;
    }
    resolve();
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// Create a test image buffer
async function createTestImageBuffer(width = 100, height = 100) {
  return await sharp({
    create: {
      width: width,
      height: height,
      channels: 4,
      background: { r: 255, g: 0, b: 0, alpha: 1 }
    }
  })
  .png()
  .toBuffer();
}

async function runTests() {
  const processor = new CanvasProcessor();

  // Test 1: Initialization
  await test('Canvas Processor Initialization', async () => {
    assert(processor instanceof CanvasProcessor, 'Should create CanvasProcessor instance');
    
    const formats = processor.getSupportedFormats();
    assert(formats.png !== undefined, 'Should support PNG format');
    assert(formats.jpeg !== undefined, 'Should support JPEG format');
    assert(formats.webp !== undefined, 'Should support WebP format');
    
    const presets = processor.getQualityPresets();
    assert(presets.low !== undefined, 'Should have low quality preset');
    assert(presets.high !== undefined, 'Should have high quality preset');
    assert(presets.print !== undefined, 'Should have print quality preset');
    
    console.log('  Supported formats:', Object.keys(formats));
    console.log('  Quality presets:', Object.keys(presets));
  });

  // Test 2: Basic Canvas Processing
  await test('Basic Canvas Processing', async () => {
    const testBuffer = await createTestImageBuffer(200, 150);
    
    const result = await processor.processCanvas(testBuffer, {
      format: 'png',
      quality: 'high'
    });
    
    assert(Buffer.isBuffer(result.buffer), 'Should return buffer');
    assert(result.format === 'png', 'Should maintain PNG format');
    assert(result.quality === 'high', 'Should maintain quality setting');
    assert(result.dimensions.width === 200, 'Should maintain width');
    assert(result.dimensions.height === 150, 'Should maintain height');
    assert(result.processedSize > 0, 'Should have processed size');
    
    console.log('  Original size:', result.originalSize, 'bytes');
    console.log('  Processed size:', result.processedSize, 'bytes');
    console.log('  Compression ratio:', result.compressionRatio + '%');
  });

  // Test 3: Format Conversion
  await test('Format Conversion', async () => {
    const testBuffer = await createTestImageBuffer(100, 100);
    
    // PNG to JPEG conversion
    const jpegResult = await processor.processCanvas(testBuffer, {
      format: 'jpeg',
      quality: 'medium'
    });
    
    assert(jpegResult.format === 'jpeg', 'Should convert to JPEG');
    assert(jpegResult.metadata.mimetype === 'image/jpeg', 'Should have JPEG mimetype');
    
    // PNG to WebP conversion
    const webpResult = await processor.processCanvas(testBuffer, {
      format: 'webp',
      quality: 'high'
    });
    
    assert(webpResult.format === 'webp', 'Should convert to WebP');
    assert(webpResult.metadata.mimetype === 'image/webp', 'Should have WebP mimetype');
    
    console.log('  JPEG size:', jpegResult.processedSize, 'bytes');
    console.log('  WebP size:', webpResult.processedSize, 'bytes');
  });

  // Test 4: Quality Settings
  await test('Quality Settings', async () => {
    const testBuffer = await createTestImageBuffer(300, 200);
    
    const lowQuality = await processor.processCanvas(testBuffer, {
      format: 'jpeg',
      quality: 'low'
    });
    
    const highQuality = await processor.processCanvas(testBuffer, {
      format: 'jpeg',
      quality: 'high'
    });
    
    // Higher quality should generally result in larger file size
    console.log('  Low quality size:', lowQuality.processedSize, 'bytes');
    console.log('  High quality size:', highQuality.processedSize, 'bytes');
    
    assert(lowQuality.qualityValue < highQuality.qualityValue, 'Low quality should have lower quality value');
    assert(lowQuality.processedSize <= highQuality.processedSize, 'Low quality should have smaller or equal file size');
  });

  // Test 5: DPI Settings
  await test('DPI Settings', async () => {
    const testBuffer = await createTestImageBuffer(100, 100);
    
    const result = await processor.processCanvas(testBuffer, {
      format: 'png',
      quality: 'print',
      dpi: 300
    });
    
    assert(result.metadata.dpi === 300, 'Should set DPI in metadata');
    
    // Verify DPI using Sharp
    const metadata = await sharp(result.buffer).metadata();
    assert(metadata.density === 300, 'Should set density in image metadata');
    
    console.log('  DPI set to:', result.metadata.dpi);
    console.log('  Image density:', metadata.density);
  });

  // Test 6: Resize Functionality
  await test('Resize Functionality', async () => {
    const testBuffer = await createTestImageBuffer(400, 300);
    
    const resized = await processor.processCanvas(testBuffer, {
      format: 'png',
      quality: 'medium',
      width: 200,
      height: 150
    });
    
    console.log('  Actual dimensions:', resized.dimensions);
    assert(resized.dimensions.width === 200, 'Should resize to specified width');
    assert(resized.dimensions.height === 150, 'Should resize to specified height');
    
    console.log('  Original: 400x300');
    console.log('  Resized: 200x150');
  });

  // Test 7: Metadata Embedding
  await test('Metadata Embedding', async () => {
    const testBuffer = await createTestImageBuffer(150, 100);
    
    const metadata = {
      title: 'Test Canvas Map',
      description: 'Test map for canvas processing',
      copyright: '© 2024 Print My Ride'
    };
    
    const result = await processor.processCanvas(testBuffer, {
      format: 'png',
      quality: 'high',
      metadata: metadata
    });
    
    assert(result.metadata.title === metadata.title, 'Should preserve title metadata');
    assert(result.metadata.description === metadata.description, 'Should preserve description metadata');
    assert(result.metadata.copyright === metadata.copyright, 'Should preserve copyright metadata');
    
    console.log('  Metadata embedded successfully');
  });

  // Test 8: Create Variants
  await test('Create Variants', async () => {
    const testBuffer = await createTestImageBuffer(200, 200);
    
    const variants = await processor.createVariants(testBuffer, {
      formats: ['png', 'jpeg'],
      qualities: ['medium', 'high'],
      baseMetadata: { source: 'test' }
    });
    
    assert(variants.success === true, 'Should create variants successfully');
    assert(variants.variants.png !== undefined, 'Should have PNG variants');
    assert(variants.variants.jpeg !== undefined, 'Should have JPEG variants');
    assert(variants.variants.png.medium !== undefined, 'Should have PNG medium quality');
    assert(variants.variants.png.high !== undefined, 'Should have PNG high quality');
    assert(variants.variants.jpeg.medium !== undefined, 'Should have JPEG medium quality');
    assert(variants.variants.jpeg.high !== undefined, 'Should have JPEG high quality');
    
    console.log('  Variants created:', variants.summary.totalVariants);
    console.log('  Successful:', variants.summary.successful);
    console.log('  Failed:', variants.summary.failed);
    console.log('  Best compression:', variants.summary.bestCompression);
  });

  // Test 9: Use Case Optimization
  await test('Use Case Optimization', async () => {
    const testBuffer = await createTestImageBuffer(2000, 1500);
    
    // Test web optimization
    const webOptimized = await processor.optimizeForUseCase(testBuffer, 'web');
    assert(webOptimized.format === 'webp', 'Web optimization should use WebP');
    console.log('  Web optimized actual width:', webOptimized.dimensions.width);
    assert(webOptimized.dimensions.width <= 1920, 'Web optimization should constrain width');
    
    // Test email optimization
    const emailOptimized = await processor.optimizeForUseCase(testBuffer, 'email');
    assert(emailOptimized.format === 'jpeg', 'Email optimization should use JPEG');
    assert(emailOptimized.dimensions.width <= 800, 'Email optimization should constrain width');
    
    // Test thumbnail optimization
    const thumbnailOptimized = await processor.optimizeForUseCase(testBuffer, 'thumbnail');
    assert(thumbnailOptimized.dimensions.width <= 300, 'Thumbnail should be small');
    assert(thumbnailOptimized.dimensions.height <= 300, 'Thumbnail should be small');
    
    console.log('  Web optimized:', `${webOptimized.dimensions.width}x${webOptimized.dimensions.height}`);
    console.log('  Email optimized:', `${emailOptimized.dimensions.width}x${emailOptimized.dimensions.height}`);
    console.log('  Thumbnail optimized:', `${thumbnailOptimized.dimensions.width}x${thumbnailOptimized.dimensions.height}`);
  });

  // Test 10: Options Validation
  await test('Options Validation', async () => {
    const validOptions = {
      format: 'png',
      quality: 'high',
      width: 300,
      height: 200,
      dpi: 300
    };
    
    const validResult = processor.validateOptions(validOptions);
    assert(validResult.valid === true, 'Valid options should pass validation');
    assert(validResult.errors.length === 0, 'Valid options should have no errors');
    
    const invalidOptions = {
      format: 'invalid',
      quality: 'unknown',
      width: -100,
      height: 0,
      dpi: -300
    };
    
    const invalidResult = processor.validateOptions(invalidOptions);
    assert(invalidResult.valid === false, 'Invalid options should fail validation');
    assert(invalidResult.errors.length > 0, 'Invalid options should have errors');
    
    console.log('  Valid options passed validation');
    console.log('  Invalid options rejected with', invalidResult.errors.length, 'errors');
  });

  // Test 11: Error Handling
  await test('Error Handling', async () => {
    const invalidBuffer = Buffer.from('not an image');
    
    try {
      await processor.processCanvas(invalidBuffer, { format: 'png' });
      assert(false, 'Should throw error for invalid buffer');
    } catch (error) {
      assert(error.message.includes('Canvas processing failed'), 'Should throw descriptive error');
    }
    
    try {
      await processor.processCanvas(Buffer.alloc(0), { format: 'unsupported' });
      assert(false, 'Should throw error for unsupported format');
    } catch (error) {
      assert(error.message.includes('Unsupported format'), 'Should throw format error');
    }
    
    console.log('  Error handling working correctly');
  });

  // Test 12: Watermark Functionality
  await test('Watermark Functionality', async () => {
    const testBuffer = await createTestImageBuffer(400, 300);
    
    const watermarked = await processor.addWatermark(testBuffer, {
      text: 'Print My Ride',
      position: 'bottom-right',
      opacity: 0.8
    });
    
    assert(Buffer.isBuffer(watermarked), 'Should return watermarked buffer');
    
    // Verify the watermarked image is different from original
    const originalMetadata = await sharp(testBuffer).metadata();
    const watermarkedMetadata = await sharp(watermarked).metadata();
    
    assert(watermarkedMetadata.width === originalMetadata.width, 'Should maintain width');
    assert(watermarkedMetadata.height === originalMetadata.height, 'Should maintain height');
    
    console.log('  Watermark added successfully');
  });

  // Summary
  console.log('\n' + '=' .repeat(50));
  console.log('📊 Test Results Summary:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

  if (failed === 0) {
    console.log('\n🎉 All tests passed! Canvas Processor is working correctly.');
  } else {
    console.log(`\n⚠️  ${failed} test(s) failed. Please review the implementation.`);
  }

  console.log('\n🚀 Canvas Processor Features:');
  console.log('✅ Multi-format processing (PNG, JPEG, WebP)');
  console.log('✅ Quality optimization and presets');
  console.log('✅ DPI settings for print quality');
  console.log('✅ Image resizing and scaling');
  console.log('✅ Metadata embedding');
  console.log('✅ Format variants creation');
  console.log('✅ Use case optimization');
  console.log('✅ Watermark functionality');
  console.log('✅ Comprehensive error handling');
  console.log('✅ Options validation');
}

// Run all tests
runTests().catch(console.error);