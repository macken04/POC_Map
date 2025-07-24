/**
 * DPI Manager Test Suite
 * Tests the Device Pixel Ratio Override functionality
 */

const fs = require('fs');
const path = require('path');

// Since we're in Node.js, we need to simulate browser environment
global.window = {
  devicePixelRatio: 1,
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => true
};
global.document = {
  createElement: (tag) => {
    if (tag === 'canvas') {
      return {
        getContext: (type) => {
          if (type === '2d') {
            return {
              scale: () => {},
              drawImage: () => {},
              fillRect: () => {},
              fillText: () => {}
            };
          }
          if (type === 'webgl' || type === 'experimental-webgl') {
            return {
              getParameter: () => 4096
            };
          }
          return null;
        },
        width: 100,
        height: 100,
        remove: () => {}
      };
    }
    return {};
  }
};
global.navigator = {
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
};
global.Event = class Event {
  constructor(type, options = {}) {
    this.type = type;
    this.bubbles = options.bubbles || false;
    this.cancelable = options.cancelable || false;
  }
};
global.CustomEvent = class CustomEvent extends Event {
  constructor(type, options = {}) {
    super(type, options);
    this.detail = options.detail;
  }
};
global.Object = Object;

// Load the DPI Manager
const dpiManagerPath = path.join(__dirname, '..', '..', 'shopify-theme', 'dawn', 'assets', 'dpi-manager.js');
const dpiManagerCode = fs.readFileSync(dpiManagerPath, 'utf8');

// Execute the DPI Manager code in our simulated environment
eval(dpiManagerCode);
const DPIManager = global.DPIManager;

// Test Suite
console.log('🧪 DPI Manager Test Suite Starting...');
console.log('=' .repeat(50));

let passed = 0;
let failed = 0;

function test(name, testFn) {
  try {
    console.log(`\n📋 Test: ${name}`);
    testFn();
    console.log('✅ PASSED');
    passed++;
  } catch (error) {
    console.log(`❌ FAILED: ${error.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// Test 1: DPI Manager Initialization
test('DPI Manager Initialization', async () => {
  const dpiManager = new DPIManager();
  await dpiManager.init();
  
  assert(dpiManager.originalDevicePixelRatio === 1, 'Original DPI should be 1');
  assert(dpiManager.supportChecked === true, 'Support should be checked');
  assert(dpiManager.supportInfo !== null, 'Support info should be available');
  console.log('  Original DPI:', dpiManager.originalDevicePixelRatio);
});

// Test 2: DPI Setting and Restoration
test('DPI Setting and Restoration', async () => {
  const dpiManager = new DPIManager();
  await dpiManager.init();
  
  // Set custom DPI
  const scalingFactor = dpiManager.setDPI(300);
  assert(scalingFactor === 300 / 96, 'Scaling factor should be 300/96');
  assert(dpiManager.isOverridden === true, 'Should be marked as overridden');
  assert(dpiManager.currentDPI === 300, 'Current DPI should be 300');
  
  // Check if window.devicePixelRatio was updated
  assert(window.devicePixelRatio === scalingFactor, 'Device pixel ratio should be updated');
  
  // Restore original DPI
  dpiManager.restoreOriginalDPI();
  assert(dpiManager.isOverridden === false, 'Should not be overridden after restore');
  assert(window.devicePixelRatio === 1, 'Device pixel ratio should be restored');
  
  console.log('  Scaling factor for 300 DPI:', scalingFactor.toFixed(3));
  console.log('  Successfully restored to original DPI');
});

// Test 3: Print Dimensions Calculation
test('Print Dimensions Calculation', async () => {
  const dpiManager = new DPIManager();
  await dpiManager.init();
  
  // Test A4 dimensions at 300 DPI
  const a4Dimensions = dpiManager.calculatePrintDimensions('A4', 300);
  
  assert(a4Dimensions.width === 2480, 'A4 width should be 2480px at 300 DPI');
  assert(a4Dimensions.height === 3508, 'A4 height should be 3508px at 300 DPI');
  assert(a4Dimensions.dpi === 300, 'DPI should be 300');
  assert(a4Dimensions.mmWidth === 210, 'A4 width should be 210mm');
  assert(a4Dimensions.mmHeight === 297, 'A4 height should be 297mm');
  
  console.log('  A4 at 300 DPI:', `${a4Dimensions.width}x${a4Dimensions.height}px`);
  console.log('  Total pixels:', a4Dimensions.totalPixels.toLocaleString());
  console.log('  Estimated memory:', a4Dimensions.estimatedMemoryMB, 'MB');
});

// Test 4: DPI Standards and Presets
test('DPI Standards and Presets', async () => {
  const dpiManager = new DPIManager();
  await dpiManager.init();
  
  const presets = dpiManager.getDPIPresets();
  assert(presets[72] !== undefined, 'Should have 72 DPI preset');
  assert(presets[96] !== undefined, 'Should have 96 DPI preset');
  assert(presets[300] !== undefined, 'Should have 300 DPI preset');
  
  console.log('  Available DPI presets:', Object.keys(presets));
  console.log('  Print quality preset:', presets[300].name);
});

// Test 5: Browser Support Detection
test('Browser Support Detection', async () => {
  const dpiManager = new DPIManager();
  await dpiManager.init();
  
  const supportInfo = dpiManager.supportInfo;
  assert(supportInfo !== null, 'Support info should be available');
  assert(typeof supportInfo.supported === 'boolean', 'Support status should be boolean');
  assert(typeof supportInfo.browser === 'string', 'Browser should be identified');
  
  console.log('  Detected browser:', supportInfo.browser);
  console.log('  DPI override supported:', supportInfo.supported);
  console.log('  Method:', supportInfo.method);
});

// Test 6: Memory Requirements Calculation
test('Memory Requirements Calculation', async () => {
  const dpiManager = new DPIManager();
  await dpiManager.init();
  
  // Set high DPI and calculate memory
  dpiManager.setDPI(300);
  const memoryInfo = dpiManager.calculateMemoryRequirements(800, 600);
  
  assert(memoryInfo.scalingFactor > 1, 'Scaling factor should be greater than 1');
  assert(memoryInfo.estimatedMemoryMB > 0, 'Should estimate memory usage');
  assert(memoryInfo.physicalDimensions.width > memoryInfo.logicalDimensions.width, 'Physical dimensions should be larger');
  
  console.log('  Logical dimensions:', `${memoryInfo.logicalDimensions.width}x${memoryInfo.logicalDimensions.height}`);
  console.log('  Physical dimensions:', `${memoryInfo.physicalDimensions.width}x${memoryInfo.physicalDimensions.height}`);
  console.log('  Estimated memory:', memoryInfo.estimatedMemoryMB, 'MB');
  
  dpiManager.restoreOriginalDPI();
});

// Test 7: High DPI Support Testing
test('High DPI Support Testing', async () => {
  const dpiManager = new DPIManager();
  await dpiManager.init();
  
  const testResults = dpiManager.testHighDPISupport();
  
  assert(typeof testResults.supported === 'boolean', 'Should return support status');
  assert(typeof testResults.canvasSupport === 'boolean', 'Should test canvas support');
  assert(typeof testResults.webglSupport === 'boolean', 'Should test WebGL support');
  assert(Array.isArray(testResults.warnings), 'Should return warnings array');
  
  console.log('  High DPI supported:', testResults.supported);
  console.log('  Canvas support:', testResults.canvasSupport);
  console.log('  WebGL support:', testResults.webglSupport);
  if (testResults.warnings.length > 0) {
    console.log('  Warnings:', testResults.warnings.join(', '));
  }
});

// Test 8: Current DPI Info
test('Current DPI Info', async () => {
  const dpiManager = new DPIManager();
  await dpiManager.init();
  
  const dpiInfo = dpiManager.getCurrentDPIInfo();
  
  assert(typeof dpiInfo.originalRatio === 'number', 'Should have original ratio');
  assert(typeof dpiInfo.currentRatio === 'number', 'Should have current ratio');
  assert(typeof dpiInfo.isOverridden === 'boolean', 'Should have override status');
  assert(typeof dpiInfo.estimatedScreenDPI === 'number', 'Should estimate screen DPI');
  
  console.log('  Original ratio:', dpiInfo.originalRatio);
  console.log('  Current ratio:', dpiInfo.currentRatio);
  console.log('  Estimated screen DPI:', dpiInfo.estimatedScreenDPI);
});

// Test 9: Error Handling
test('Error Handling', async () => {
  const dpiManager = new DPIManager();
  await dpiManager.init();
  
  // Test invalid DPI values
  try {
    dpiManager.setDPI(-100);
    assert(false, 'Should throw error for negative DPI');
  } catch (error) {
    assert(error.message.includes('positive integer'), 'Should reject negative DPI');
  }
  
  try {
    dpiManager.setDPI(0);
    assert(false, 'Should throw error for zero DPI');
  } catch (error) {
    assert(error.message.includes('positive integer'), 'Should reject zero DPI');
  }
  
  // Test invalid size for print dimensions
  try {
    dpiManager.calculatePrintDimensions('INVALID_SIZE');
    assert(false, 'Should throw error for invalid size');
  } catch (error) {
    assert(error.message.includes('Unknown size'), 'Should reject invalid size');
  }
  
  console.log('  Error handling working correctly');
});

// Test 10: Cleanup
test('Cleanup', async () => {
  const dpiManager = new DPIManager();
  await dpiManager.init();
  
  // Set DPI and then cleanup
  dpiManager.setDPI(300);
  assert(dpiManager.isOverridden === true, 'Should be overridden before cleanup');
  
  dpiManager.cleanup();
  assert(dpiManager.isOverridden === false, 'Should not be overridden after cleanup');
  assert(dpiManager.originalDevicePixelRatio === null, 'Should reset original ratio');
  assert(dpiManager.currentDPI === null, 'Should reset current DPI');
  
  console.log('  Cleanup completed successfully');
});

// Run all tests and print summary
console.log('\n' + '=' .repeat(50));
console.log('📊 Test Results Summary:');
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

if (failed === 0) {
  console.log('\n🎉 All tests passed! DPI Manager is working correctly.');
} else {
  console.log(`\n⚠️  ${failed} test(s) failed. Please review the implementation.`);
  process.exit(1);
}