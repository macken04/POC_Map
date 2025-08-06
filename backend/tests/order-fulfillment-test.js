/**
 * Order Fulfillment Test Suite
 * Tests the complete order fulfillment workflow for high-resolution map generation
 */

const assert = require('assert');
const path = require('path');

// Test helper to create mock order data
function createMockOrderData() {
  return {
    id: 'test_order_123',
    name: '#TEST001',
    customer: {
      id: 'test_customer_456',
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User'
    }
  };
}

// Test helper to create mock line item with complete map configuration
function createMockLineItem() {
  const completeMapConfig = {
    id: 'test_preview_789',
    width: 2480,
    height: 3508,
    format: 'A4',
    orientation: 'portrait',
    dpi: 300,
    style: 'mapbox://styles/mapbox/outdoors-v12',
    center: [-0.127, 51.507],
    bounds: {
      west: -0.2,
      east: 0.0,
      south: 51.4,
      north: 51.6
    },
    route: {
      coordinates: [
        [-0.15, 51.45],
        [-0.14, 51.46],
        [-0.13, 51.47],
        [-0.12, 51.48]
      ],
      color: '#fc5200',
      width: 4
    },
    markers: {
      start: [-0.15, 51.45],
      end: [-0.12, 51.48]
    },
    title: 'Test Activity Map',
    activityId: 'test_activity_101',
    selfContained: true
  };

  return {
    id: 'test_line_item_789',
    properties: [
      { name: 'Map Type', value: 'Custom Activity Map' },
      { name: 'Print Size', value: 'A4' },
      { name: 'Orientation', value: 'portrait' },
      { name: 'Purchase ID', value: 'purchase_test_123' },
      { name: 'Preview ID', value: 'test_preview_789' },
      { name: 'Map Style', value: 'outdoors-v12' },
      { name: 'Activity ID', value: 'test_activity_101' },
      { name: 'Strava User ID', value: 'test_strava_user_456' },
      { name: 'Map Config', value: Buffer.from(JSON.stringify(completeMapConfig)).toString('base64') }
    ]
  };
}

async function testOrderMapServiceInitialization() {
  console.log('🧪 Testing OrderMapService initialization...');
  
  try {
    const OrderMapService = require('../services/orderMapService');
    await OrderMapService.initialize();
    console.log('✅ OrderMapService initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ OrderMapService initialization failed:', error.message);
    return false;
  }
}

async function testConfigurationExtraction() {
  console.log('🧪 Testing configuration extraction from order properties...');
  
  try {
    const OrderMapService = require('../services/orderMapService');
    await OrderMapService.initialize();
    
    const mockOrderData = createMockOrderData();
    const mockLineItem = createMockLineItem();
    
    const config = await OrderMapService.extractMapConfiguration(mockOrderData, mockLineItem);
    
    if (!config) {
      throw new Error('Configuration extraction returned null');
    }
    
    if (config.source !== 'order_properties') {
      throw new Error(`Expected config source 'order_properties', got '${config.source}'`);
    }
    
    // Validate required properties
    const requiredProps = ['width', 'height', 'center', 'bounds', 'style', 'route'];
    for (const prop of requiredProps) {
      if (!config[prop]) {
        throw new Error(`Missing required property: ${prop}`);
      }
    }
    
    console.log('✅ Configuration extraction successful:', {
      source: config.source,
      format: config.format,
      routeCoords: config.route.coordinates.length
    });
    
    return true;
  } catch (error) {
    console.error('❌ Configuration extraction failed:', error.message);
    return false;
  }
}

async function testMapConfigValidation() {
  console.log('🧪 Testing map configuration validation...');
  
  try {
    const OrderMapService = require('../services/orderMapService');
    await OrderMapService.initialize();
    
    // Test with valid configuration
    const validConfig = {
      width: 2480,
      height: 3508,
      center: [-0.127, 51.507],
      bounds: { west: -0.2, east: 0.0, south: 51.4, north: 51.6 },
      style: 'mapbox://styles/mapbox/streets-v12',
      route: {
        coordinates: [[-0.15, 51.45], [-0.12, 51.48]],
        color: '#fc5200',
        width: 4
      }
    };
    
    const isValid = OrderMapService.validateMapConfig(validConfig);
    if (!isValid) {
      throw new Error('Valid configuration failed validation');
    }
    
    // Test with invalid configuration (missing route)
    const invalidConfig = {
      width: 2480,
      height: 3508,
      center: [-0.127, 51.507],
      bounds: { west: -0.2, east: 0.0, south: 51.4, north: 51.6 },
      style: 'mapbox://styles/mapbox/streets-v12'
      // Missing route property
    };
    
    const isInvalid = OrderMapService.validateMapConfig(invalidConfig);
    if (isInvalid) {
      throw new Error('Invalid configuration passed validation');
    }
    
    console.log('✅ Map configuration validation working correctly');
    return true;
  } catch (error) {
    console.error('❌ Map configuration validation failed:', error.message);
    return false;
  }
}

async function testStravaServiceEnhancements() {
  console.log('🧪 Testing StravaService enhancements...');
  
  try {
    const StravaService = require('../services/stravaService');
    
    // Test activity validation
    const validActivity = {
      id: 'test_123',
      name: 'Test Activity',
      map: {
        polyline: 'u{~vFvyys@fS]'  // Simple test polyline
      }
    };
    
    const validation = StravaService.validateActivityForMapGeneration(validActivity);
    if (!validation.valid) {
      throw new Error(`Activity validation failed: ${validation.reason}`);
    }
    
    // Test activity transformation
    const transformed = StravaService.transformActivityForMapConfig(validActivity);
    if (!transformed.coordinates || !Array.isArray(transformed.coordinates)) {
      throw new Error('Activity transformation did not produce valid coordinates');
    }
    
    console.log('✅ StravaService enhancements working correctly:', {
      validation: validation.valid,
      coordCount: transformed.coordinates.length
    });
    
    return true;
  } catch (error) {
    console.error('❌ StravaService enhancement test failed:', error.message);
    return false;
  }
}

async function testOrderFulfillmentWorkflow() {
  console.log('🧪 Testing complete order fulfillment workflow...');
  
  try {
    const OrderMapService = require('../services/orderMapService');
    await OrderMapService.initialize();
    
    const mockOrderData = createMockOrderData();
    const mockLineItem = createMockLineItem();
    
    console.log('   • Testing configuration extraction...');
    const config = await OrderMapService.extractMapConfiguration(mockOrderData, mockLineItem);
    
    if (!config) {
      throw new Error('Failed to extract map configuration');
    }
    
    console.log('   • Testing configuration validation...');
    const isValid = OrderMapService.validateMapConfig(config);
    if (!isValid) {
      throw new Error('Extracted configuration failed validation');
    }
    
    console.log('   • Testing print dimensions calculation...');
    const dimensions = OrderMapService.getPrintDimensions('A4', 'portrait');
    if (dimensions.width !== 2480 || dimensions.height !== 3508) {
      throw new Error('Print dimensions calculation failed');
    }
    
    console.log('   • Testing bounds calculation...');
    const testCoords = [[-0.15, 51.45], [-0.12, 51.48]];
    const bounds = OrderMapService.calculateBounds(testCoords);
    if (!bounds.west || !bounds.east || !bounds.south || !bounds.north) {
      throw new Error('Bounds calculation failed');
    }
    
    console.log('✅ Complete order fulfillment workflow test passed');
    return true;
  } catch (error) {
    console.error('❌ Order fulfillment workflow test failed:', error.message);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Order Fulfillment Test Suite\n');
  
  const tests = [
    testOrderMapServiceInitialization,
    testConfigurationExtraction,
    testMapConfigValidation,
    testStravaServiceEnhancements,
    testOrderFulfillmentWorkflow
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      const result = await test();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error('❌ Test threw unexpected error:', error.message);
      failed++;
    }
    console.log(''); // Empty line for readability
  }
  
  console.log('📊 Test Results:');
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! Order fulfillment system is ready.');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the implementation.');
  }
  
  return failed === 0;
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  runTests,
  createMockOrderData,
  createMockLineItem
};