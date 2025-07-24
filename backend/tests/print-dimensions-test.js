/**
 * Print Dimensions Configuration Test
 * Tests the enhanced print dimensions system in mapService.js
 */

const path = require('path');
const mapService = require('../services/mapService');

console.log('Print Dimensions Configuration Test');
console.log('=====================================\n');

// Test 1: Basic dimension retrieval
console.log('1. Testing basic dimension retrieval:');
try {
  const a4Portrait = mapService.getPrintDimensions('A4', 'portrait');
  const a4Landscape = mapService.getPrintDimensions('A4', 'landscape');
  
  console.log('✓ A4 Portrait:', a4Portrait);
  console.log('✓ A4 Landscape:', a4Landscape);
  console.log('✓ A4 Portrait dimensions are correct');
} catch (error) {
  console.error('✗ Basic dimension test failed:', error.message);
}

// Test 2: All supported formats
console.log('\n2. Testing all supported formats:');
try {
  const supportedFormats = mapService.getSupportedFormats();
  console.log('✓ All supported formats:');
  
  Object.keys(supportedFormats).forEach(format => {
    const portrait = supportedFormats[format].portrait;
    const landscape = supportedFormats[format].landscape;
    console.log(`  ${format}:`);
    console.log(`    Portrait: ${portrait.width}x${portrait.height}px (${portrait.widthInches}"x${portrait.heightInches}"))`);
    console.log(`    Landscape: ${landscape.width}x${landscape.height}px (${landscape.widthInches}"x${landscape.heightInches}"))`);
  });
} catch (error) {
  console.error('✗ Supported formats test failed:', error.message);
}

// Test 3: Orientation toggle
console.log('\n3. Testing orientation toggle:');
try {
  const a3Portrait = mapService.getPrintDimensions('A3', 'portrait');
  const a3Landscape = mapService.toggleOrientation('A3', 'portrait');
  const a3PortaitAgain = mapService.toggleOrientation('A3', 'landscape');
  
  console.log('✓ A3 Portrait:', `${a3Portrait.width}x${a3Portrait.height}`);
  console.log('✓ A3 Landscape (toggled):', `${a3Landscape.width}x${a3Landscape.height}`);
  console.log('✓ A3 Portrait (toggled back):', `${a3PortaitAgain.width}x${a3PortaitAgain.height}`);
  
  if (a3Portrait.width === a3PortaitAgain.width && a3Portrait.height === a3PortaitAgain.height) {
    console.log('✓ Orientation toggle works correctly');
  } else {
    console.error('✗ Orientation toggle test failed');
  }
} catch (error) {
  console.error('✗ Orientation toggle test failed:', error.message);
}

// Test 4: Dimension validation
console.log('\n4. Testing dimension validation:');
try {
  // Valid dimensions
  mapService.validatePrintDimensions(2480, 3508, 300);
  console.log('✓ Valid dimensions pass validation');
  
  // Invalid dimensions - should throw errors
  const invalidTests = [
    { args: [-100, 3508, 300], desc: 'negative width' },
    { args: [2480, -100, 300], desc: 'negative height' },
    { args: [2480, 3508, -300], desc: 'negative DPI' },
    { args: [20000, 3508, 300], desc: 'width too large' },
    { args: [2480, 20000, 300], desc: 'height too large' },
    { args: [100, 3508, 300], desc: 'width too small' },
    { args: [2480, 100, 300], desc: 'height too small' }
  ];
  
  invalidTests.forEach(test => {
    try {
      mapService.validatePrintDimensions(...test.args);
      console.error(`✗ Validation should have failed for ${test.desc}`);
    } catch (error) {
      console.log(`✓ Correctly rejected ${test.desc}: ${error.message}`);
    }
  });
} catch (error) {
  console.error('✗ Dimension validation test failed:', error.message);
}

// Test 5: Format validation
console.log('\n5. Testing format validation:');
try {
  const validFormats = ['A4', 'A3', 'A2', 'A1', 'A0', 'SQUARE_SMALL', 'WIDESCREEN_16_9'];
  const invalidFormats = ['B4', 'LETTER', 'LEGAL', 'CUSTOM'];
  
  validFormats.forEach(format => {
    if (mapService.isValidPrintSize(format)) {
      console.log(`✓ ${format} is valid`);
    } else {
      console.error(`✗ ${format} should be valid`);
    }
  });
  
  invalidFormats.forEach(format => {
    if (!mapService.isValidPrintSize(format)) {
      console.log(`✓ ${format} is correctly rejected`);
    } else {
      console.error(`✗ ${format} should be invalid`);
    }
  });
} catch (error) {
  console.error('✗ Format validation test failed:', error.message);
}

// Test 6: MM to pixels conversion
console.log('\n6. Testing millimeter to pixel conversion:');
try {
  // A4 is 210mm x 297mm
  const a4WidthPixels = mapService.calculatePixelsFromMM(210, 300); // Should be ~2480
  const a4HeightPixels = mapService.calculatePixelsFromMM(297, 300); // Should be ~3508
  
  console.log(`✓ A4 width: 210mm = ${a4WidthPixels}px at 300 DPI`);
  console.log(`✓ A4 height: 297mm = ${a4HeightPixels}px at 300 DPI`);
  
  const calculatedDimensions = mapService.calculatePixelDimensions(210, 297, 300);
  console.log('✓ Calculated A4 dimensions:', calculatedDimensions);
  
  // Verify against our config
  const configA4 = mapService.getPrintDimensions('A4', 'portrait');
  if (Math.abs(calculatedDimensions.width - configA4.width) <= 1 && 
      Math.abs(calculatedDimensions.height - configA4.height) <= 1) {
    console.log('✓ Calculated dimensions match configuration');
  } else {
    console.error('✗ Calculated dimensions do not match configuration');
    console.error('  Calculated:', calculatedDimensions);
    console.error('  Config:', { width: configA4.width, height: configA4.height });
  }
} catch (error) {
  console.error('✗ MM to pixels conversion test failed:', error.message);
}

// Test 7: Scale calculation
console.log('\n7. Testing scale calculation:');
try {
  const viewportSizes = [
    { width: 1200, height: 800, desc: 'desktop' },
    { width: 800, height: 600, desc: 'tablet' },
    { width: 375, height: 667, desc: 'mobile' }
  ];
  
  viewportSizes.forEach(viewport => {
    const a4Scale = mapService.getOptimalScale('A4', 'portrait', viewport);
    const a3Scale = mapService.getOptimalScale('A3', 'landscape', viewport);
    
    console.log(`✓ ${viewport.desc} (${viewport.width}x${viewport.height}):`);
    console.log(`    A4 portrait scale: ${a4Scale.toFixed(3)}`);
    console.log(`    A3 landscape scale: ${a3Scale.toFixed(3)}`);
  });
} catch (error) {
  console.error('✗ Scale calculation test failed:', error.message);
}

// Test 8: Container dimensions calculation
console.log('\n8. Testing container dimensions calculation:');
try {
  const containerDims = mapService.calculateContainerDimensions('A4', 'portrait', 0.25);
  console.log('✓ A4 portrait at 0.25 scale:');
  console.log(`    Display: ${containerDims.width}x${containerDims.height}px`);
  console.log(`    Original: ${containerDims.originalWidth}x${containerDims.originalHeight}px`);
  console.log(`    Scale: ${containerDims.scale}`);
  
  // Verify calculation
  const a4Dims = mapService.getPrintDimensions('A4', 'portrait');
  const expectedWidth = Math.round(a4Dims.width * 0.25);
  const expectedHeight = Math.round(a4Dims.height * 0.25);
  
  if (containerDims.width === expectedWidth && containerDims.height === expectedHeight) {
    console.log('✓ Container dimensions calculated correctly');
  } else {
    console.error('✗ Container dimensions calculation error');
  }
} catch (error) {
  console.error('✗ Container dimensions test failed:', error.message);
}

// Test 9: Service status with new formats
console.log('\n9. Testing service status:');
try {
  const status = mapService.getStatus();
  status.then(statusResult => {
    console.log('✓ Service status:');
    console.log(`    Initialized: ${statusResult.initialized}`);
    console.log(`    Browser connected: ${statusResult.browserConnected}`);
    console.log(`    Supported formats: ${statusResult.supportedFormats.join(', ')}`);
    console.log(`    Supported orientations: ${statusResult.supportedOrientations.join(', ')}`);
    console.log(`    Supported styles: ${statusResult.supportedStyles.join(', ')}`);
    
    // Verify we have the expected number of formats
    const expectedFormats = 9; // A0, A1, A2, A3, A4, SQUARE_SMALL, SQUARE_LARGE, WIDESCREEN_16_9, WIDESCREEN_4_3
    if (statusResult.supportedFormats.length === expectedFormats) {
      console.log(`✓ All ${expectedFormats} expected formats are supported`);
    } else {
      console.error(`✗ Expected ${expectedFormats} formats, got ${statusResult.supportedFormats.length}`);
    }
  });
} catch (error) {
  console.error('✗ Service status test failed:', error.message);
}

// Test 10: Map options validation with new parameters
console.log('\n10. Testing map options validation:');
try {
  const validOptions = {
    routeCoordinates: [[0, 0], [1, 1]],
    bounds: { north: 1, south: 0, east: 1, west: 0 },
    center: [0.5, 0.5],
    format: 'A3',
    orientation: 'landscape'
  };
  
  mapService.validateMapOptions(validOptions);
  console.log('✓ Valid map options pass validation');
  
  // Test invalid orientation
  const invalidOrientation = { ...validOptions, orientation: 'diagonal' };
  try {
    mapService.validateMapOptions(invalidOrientation);
    console.error('✗ Should have rejected invalid orientation');
  } catch (error) {
    console.log('✓ Correctly rejected invalid orientation:', error.message);
  }
  
  // Test invalid format
  const invalidFormat = { ...validOptions, format: 'LETTER' };
  try {
    mapService.validateMapOptions(invalidFormat);
    console.error('✗ Should have rejected invalid format');
  } catch (error) {
    console.log('✓ Correctly rejected invalid format:', error.message);
  }
} catch (error) {
  console.error('✗ Map options validation test failed:', error.message);
}

console.log('\n=====================================');
console.log('Print Dimensions Configuration Test Complete');
console.log('Run this test after implementing the changes to verify functionality.');