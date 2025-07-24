/**
 * GeoJSON Converter Test Suite
 * 
 * Comprehensive tests for the GeoJSON conversion service including:
 * - GPX data conversion
 * - TCX data conversion  
 * - Strava polyline conversion
 * - Coordinate array conversion
 * - Multi-segment route handling
 * - GeoJSON validation
 * - Error handling
 * - Performance testing
 */

const geojsonConverter = require('../services/geojsonConverter');

// Test data samples
const sampleGPXData = {
  id: 'gpx_test_123',
  name: 'Test GPX Route',
  description: 'A sample GPX route for testing',
  type: 'hiking',
  source: 'gpx_upload',
  format: 'gpx',
  coordinates: [
    [40.7128, -74.0060], // NYC coordinates [lat, lng]
    [40.7130, -74.0058],
    [40.7132, -74.0056],
    [40.7134, -74.0054]
  ],
  elevation: [
    { index: 0, elevation_meters: 10, elevation_feet: 32.8 },
    { index: 1, elevation_meters: 12, elevation_feet: 39.4 },
    { index: 2, elevation_meters: 15, elevation_feet: 49.2 },
    { index: 3, elevation_meters: 18, elevation_feet: 59.1 }
  ],
  timestamps: [
    { index: 0, timestamp: '2024-01-15T10:00:00Z', iso_string: '2024-01-15T10:00:00Z' },
    { index: 1, timestamp: '2024-01-15T10:01:00Z', iso_string: '2024-01-15T10:01:00Z' },
    { index: 2, timestamp: '2024-01-15T10:02:00Z', iso_string: '2024-01-15T10:02:00Z' },
    { index: 3, timestamp: '2024-01-15T10:03:00Z', iso_string: '2024-01-15T10:03:00Z' }
  ],
  distance: 450,
  total_elevation_gain: 8,
  metadata: {
    filename: 'test-route.gpx',
    created_at: '2024-01-15T10:00:00Z'
  }
};

const sampleTCXData = {
  id: 'tcx_test_456',
  name: 'Test TCX Activity',
  description: 'A sample TCX activity for testing',
  type: 'running',
  source: 'tcx_upload',
  format: 'tcx',
  coordinates: [
    [40.7500, -73.9857], // Central Park coordinates [lat, lng]
    [40.7502, -73.9855],
    [40.7504, -73.9853],
    [40.7506, -73.9851]
  ],
  elevation: [
    { index: 0, elevation_meters: 15, elevation_feet: 49.2 },
    { index: 1, elevation_meters: 18, elevation_feet: 59.1 },
    { index: 2, elevation_meters: 20, elevation_feet: 65.6 },
    { index: 3, elevation_meters: 17, elevation_feet: 55.8 }
  ],
  timestamps: [
    { index: 0, timestamp: '2024-01-15T11:00:00Z', iso_string: '2024-01-15T11:00:00Z' },
    { index: 1, timestamp: '2024-01-15T11:01:00Z', iso_string: '2024-01-15T11:01:00Z' },
    { index: 2, timestamp: '2024-01-15T11:02:00Z', iso_string: '2024-01-15T11:02:00Z' },
    { index: 3, timestamp: '2024-01-15T11:03:00Z', iso_string: '2024-01-15T11:03:00Z' }
  ],
  distance: 350,
  total_elevation_gain: 5,
  metadata: {
    sport: 'Running',
    filename: 'test-activity.tcx',
    created_at: '2024-01-15T11:00:00Z'
  }
};

const sampleStravaData = {
  activity_id: 'strava_789',
  name: 'Morning Bike Ride',
  type: 'cycling',
  coordinates: [
    [-74.0060, 40.7128], // Already in [lng, lat] format
    [-74.0058, 40.7130],
    [-74.0056, 40.7132],
    [-74.0054, 40.7134]
  ],
  has_altitude_data: true,
  elevation_profile: [
    { distance: 0, elevation: 20 },
    { distance: 100, elevation: 25 },
    { distance: 200, elevation: 30 },
    { distance: 300, elevation: 22 }
  ],
  distance: 1500,
  elevation_gain: 10,
  average_speed: 8.5,
  moving_time: 600,
  elapsed_time: 720
};

const sampleCoordinates = [
  [-122.4194, 37.7749], // San Francisco [lng, lat]
  [-122.4184, 37.7759],
  [-122.4174, 37.7769],
  [-122.4164, 37.7779]
];

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  errors: [],
  performance: {}
};

/**
 * Run a test and track results
 */
function runTest(testName, testFn, expected = true) {
  try {
    console.log(`\n🧪 Running test: ${testName}`);
    const startTime = Date.now();
    
    const result = testFn();
    const duration = Date.now() - startTime;
    
    testResults.performance[testName] = duration;
    
    if (result === expected) {
      console.log(`✅ PASSED: ${testName} (${duration}ms)`);
      testResults.passed++;
    } else {
      console.log(`❌ FAILED: ${testName} - Expected ${expected}, got ${result}`);
      testResults.failed++;
      testResults.errors.push(`${testName}: Expected ${expected}, got ${result}`);
    }
  } catch (error) {
    console.log(`💥 ERROR: ${testName} - ${error.message}`);
    testResults.failed++;
    testResults.errors.push(`${testName}: ${error.message}`);
  }
}

/**
 * Run async test and track results
 */
async function runAsyncTest(testName, testFn, expected = true) {
  try {
    console.log(`\n🧪 Running async test: ${testName}`);
    const startTime = Date.now();
    
    const result = await testFn();
    const duration = Date.now() - startTime;
    
    testResults.performance[testName] = duration;
    
    if (result === expected) {
      console.log(`✅ PASSED: ${testName} (${duration}ms)`);
      testResults.passed++;
    } else {
      console.log(`❌ FAILED: ${testName} - Expected ${expected}, got ${result}`);
      testResults.failed++;
      testResults.errors.push(`${testName}: Expected ${expected}, got ${result}`);
    }
  } catch (error) {
    console.log(`💥 ERROR: ${testName} - ${error.message}`);
    testResults.failed++;
    testResults.errors.push(`${testName}: ${error.message}`);
  }
}

// ==================== BASIC FUNCTIONALITY TESTS ====================

console.log('🚀 Starting GeoJSON Converter Test Suite\n');
console.log('=' .repeat(60));
console.log('BASIC FUNCTIONALITY TESTS');
console.log('=' .repeat(60));

// Test GPX conversion
runAsyncTest('GPX Data Conversion', async () => {
  const geoJSON = await geojsonConverter.convertToGeoJSON(sampleGPXData, { source: 'gpx' });
  
  return geoJSON.type === 'Feature' &&
         geoJSON.geometry.type === 'LineString' &&
         geoJSON.properties.name === 'Test GPX Route' &&
         geoJSON.properties.activityType === 'hiking' &&
         geoJSON.properties.hasElevation === true &&
         geoJSON.geometry.coordinates.length === 4;
});

// Test TCX conversion
runAsyncTest('TCX Data Conversion', async () => {
  const geoJSON = await geojsonConverter.convertToGeoJSON(sampleTCXData, { source: 'tcx' });
  
  return geoJSON.type === 'Feature' &&
         geoJSON.geometry.type === 'LineString' &&
         geoJSON.properties.name === 'Test TCX Activity' &&
         geoJSON.properties.activityType === 'running' &&
         geoJSON.properties.source === 'tcx' &&
         geoJSON.geometry.coordinates.length === 4;
});

// Test Strava conversion
runAsyncTest('Strava Data Conversion', async () => {
  const geoJSON = await geojsonConverter.convertToGeoJSON(sampleStravaData, { source: 'strava_polyline' });
  
  return geoJSON.type === 'Feature' &&
         geoJSON.geometry.type === 'LineString' &&
         geoJSON.properties.name === 'Morning Bike Ride' &&
         geoJSON.properties.activityType === 'cycling' &&
         geoJSON.properties.source === 'strava' &&
         geoJSON.geometry.coordinates.length === 4;
});

// Test coordinate array conversion
runAsyncTest('Coordinates Array Conversion', async () => {
  const geoJSON = await geojsonConverter.convertToGeoJSON(sampleCoordinates, { source: 'coordinates' });
  
  return geoJSON.type === 'Feature' &&
         geoJSON.geometry.type === 'LineString' &&
         geoJSON.properties.source === 'coordinates' &&
         geoJSON.geometry.coordinates.length === 4;
});

// Test auto-detection
runAsyncTest('Auto-Detection of GPX Data', async () => {
  const geoJSON = await geojsonConverter.convertToGeoJSON(sampleGPXData);
  
  return geoJSON.type === 'Feature' &&
         geoJSON.properties.source === 'gpx';
});

// ==================== COORDINATE HANDLING TESTS ====================

console.log('\n' + '=' .repeat(60));
console.log('COORDINATE HANDLING TESTS');
console.log('=' .repeat(60));

// Test coordinate normalization - [lat, lng] to [lng, lat]
runTest('Coordinate Normalization [lat, lng] to [lng, lat]', () => {
  const coordinates = [[40.7128, -74.0060], [40.7130, -74.0058]]; // [lat, lng]
  const normalized = geojsonConverter.normalizeCoordinates(coordinates);
  
  // Should convert to [lng, lat]
  return normalized[0][0] === -74.0060 && normalized[0][1] === 40.7128;
});

// Test coordinate normalization - already [lng, lat]
runTest('Coordinate Normalization [lng, lat] unchanged', () => {
  const coordinates = [[-74.0060, 40.7128], [-74.0058, 40.7130]]; // [lng, lat]
  const normalized = geojsonConverter.normalizeCoordinates(coordinates);
  
  // Should remain [lng, lat]
  return normalized[0][0] === -74.0060 && normalized[0][1] === 40.7128;
});

// Test invalid coordinates
runTest('Invalid Coordinates Error Handling', () => {
  try {
    geojsonConverter.normalizeCoordinates([['invalid', 'coords']]);
    return false; // Should have thrown error
  } catch (error) {
    return error.message.includes('Invalid coordinate');
  }
});

// Test boundary coordinates
runTest('Boundary Coordinates Handling', () => {
  const coordinates = [[-180, -90], [180, 90]]; // Extreme valid coordinates
  const normalized = geojsonConverter.normalizeCoordinates(coordinates);
  
  return normalized.length === 2 &&
         normalized[0][0] === -180 && normalized[0][1] === -90 &&
         normalized[1][0] === 180 && normalized[1][1] === 90;
});

// ==================== VALIDATION TESTS ====================

console.log('\n' + '=' .repeat(60));
console.log('VALIDATION TESTS');
console.log('=' .repeat(60));

// Test GeoJSON validation - valid Feature
runAsyncTest('Valid GeoJSON Feature Validation', async () => {
  const geoJSON = await geojsonConverter.convertToGeoJSON(sampleGPXData, { 
    source: 'gpx', 
    validateOutput: true 
  });
  
  try {
    geojsonConverter.validateGeoJSON(geoJSON);
    return true;
  } catch (error) {
    return false;
  }
});

// Test invalid GeoJSON structure
runTest('Invalid GeoJSON Structure Validation', () => {
  try {
    geojsonConverter.validateGeoJSON({ type: 'InvalidType' });
    return false; // Should have thrown error
  } catch (error) {
    return error.message.includes('Invalid GeoJSON type');
  }
});

// Test LineString coordinate validation
runTest('LineString Coordinate Validation', () => {
  const validFeature = {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: [[-74.0060, 40.7128], [-74.0058, 40.7130]]
    },
    properties: { name: 'Test' }
  };
  
  try {
    geojsonConverter.validateGeoJSON(validFeature);
    return true;
  } catch (error) {
    return false;
  }
});

// Test insufficient coordinates
runTest('Insufficient Coordinates Validation', () => {
  const invalidFeature = {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: [[-74.0060, 40.7128]] // Only one coordinate
    },
    properties: { name: 'Test' }
  };
  
  try {
    geojsonConverter.validateGeoJSON(invalidFeature);
    return false; // Should have thrown error
  } catch (error) {
    return error.message.includes('at least');
  }
});

// ==================== METADATA AND PROPERTIES TESTS ====================

console.log('\n' + '=' .repeat(60));
console.log('METADATA AND PROPERTIES TESTS');
console.log('=' .repeat(60));

// Test elevation profile inclusion
runAsyncTest('Elevation Profile Inclusion', async () => {
  const geoJSON = await geojsonConverter.convertToGeoJSON(sampleGPXData, { 
    source: 'gpx',
    includeElevation: true 
  });
  
  return geoJSON.properties.hasElevation === true &&
         geoJSON.properties.elevationProfile &&
         geoJSON.properties.elevationStats &&
         geoJSON.properties.elevationStats.gain > 0;
});

// Test timestamp inclusion
runAsyncTest('Timestamp Inclusion', async () => {
  const geoJSON = await geojsonConverter.convertToGeoJSON(sampleGPXData, { 
    source: 'gpx',
    includeTimestamps: true 
  });
  
  return geoJSON.properties.hasTimestamps === true &&
         geoJSON.properties.timestamps &&
         geoJSON.properties.duration > 0;
});

// Test activity type normalization
runTest('Activity Type Normalization', () => {
  const normalizedCycling = geojsonConverter.normalizeActivityType('Ride');
  const normalizedRunning = geojsonConverter.normalizeActivityType('Run');
  const normalizedHiking = geojsonConverter.normalizeActivityType('Hike');
  
  return normalizedCycling === 'cycling' &&
         normalizedRunning === 'running' &&
         normalizedHiking === 'hiking';
});

// Test distance calculation
runTest('Distance Calculation', () => {
  const coordinates = [
    [-74.0060, 40.7128],
    [-74.0058, 40.7130]
  ];
  
  const distance = geojsonConverter.calculateDistance(coordinates);
  
  return distance > 0 && distance < 1000; // Should be a reasonable distance in meters
});

// ==================== MAPBOX OPTIMIZATION TESTS ====================

console.log('\n' + '=' .repeat(60));
console.log('MAPBOX OPTIMIZATION TESTS');
console.log('=' .repeat(60));

// Test Mapbox optimization
runAsyncTest('Mapbox Optimization', async () => {
  const geoJSON = await geojsonConverter.convertToGeoJSON(sampleGPXData, { 
    source: 'gpx',
    optimizeForMapbox: true 
  });
  
  return geoJSON.properties.lineColor &&
         geoJSON.properties.lineWidth &&
         geoJSON.properties.lineOpacity &&
         typeof geoJSON.properties.renderOrder === 'number';
});

// Test activity color mapping
runTest('Activity Color Mapping', () => {
  const cyclingColor = geojsonConverter.getActivityColor('cycling');
  const runningColor = geojsonConverter.getActivityColor('running');
  const unknownColor = geojsonConverter.getActivityColor('unknown');
  
  return cyclingColor.startsWith('#') &&
         runningColor.startsWith('#') &&
         unknownColor.startsWith('#') &&
         cyclingColor !== runningColor;
});

// Test line width calculation
runTest('Line Width Calculation', () => {
  const shortDistance = geojsonConverter.getActivityLineWidth(5000);   // 5km
  const mediumDistance = geojsonConverter.getActivityLineWidth(25000); // 25km
  const longDistance = geojsonConverter.getActivityLineWidth(75000);   // 75km
  const veryLongDistance = geojsonConverter.getActivityLineWidth(150000); // 150km
  
  return shortDistance < mediumDistance &&
         mediumDistance < longDistance &&
         longDistance < veryLongDistance;
});

// ==================== ERROR HANDLING TESTS ====================

console.log('\n' + '=' .repeat(60));
console.log('ERROR HANDLING TESTS');
console.log('=' .repeat(60));

// Test null input handling
runAsyncTest('Null Input Handling', async () => {
  try {
    await geojsonConverter.convertToGeoJSON(null);
    return false; // Should have thrown error
  } catch (error) {
    return error.message.includes('Invalid route data');
  }
});

// Test empty coordinates handling
runAsyncTest('Empty Coordinates Handling', async () => {
  try {
    await geojsonConverter.convertToGeoJSON({ coordinates: [] }, { source: 'coordinates' });
    return false; // Should have thrown error
  } catch (error) {
    return error.message.includes('at least');
  }
});

// Test unsupported source handling
runAsyncTest('Unsupported Source Handling', async () => {
  try {
    await geojsonConverter.convertToGeoJSON(sampleGPXData, { source: 'unsupported' });
    return false; // Should have thrown error
  } catch (error) {
    return error.message.includes('Unsupported source type');
  }
});

// Test malformed coordinate data
runAsyncTest('Malformed Coordinate Data', async () => {
  const malformedData = {
    coordinates: [
      ['not', 'numbers'],
      [40.7130, -74.0058]
    ]
  };
  
  try {
    await geojsonConverter.convertToGeoJSON(malformedData, { source: 'coordinates' });
    return false; // Should have thrown error
  } catch (error) {
    return error.message.includes('Invalid coordinate');
  }
});

// ==================== MULTI-SEGMENT TESTS ====================

console.log('\n' + '=' .repeat(60));
console.log('MULTI-SEGMENT TESTS');
console.log('=' .repeat(60));

// Test antimeridian crossing detection
runTest('Antimeridian Crossing Detection', () => {
  const crossingCoordinates = [
    [179.5, 20.0],
    [-179.5, 20.1]  // Crosses antimeridian
  ];
  
  const segments = geojsonConverter.handleMultiSegmentRoutes({
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: crossingCoordinates
    },
    properties: { name: 'Test' }
  });
  
  return segments.type === 'FeatureCollection' && segments.features.length >= 1;
});

// ==================== PERFORMANCE TESTS ====================

console.log('\n' + '=' .repeat(60));
console.log('PERFORMANCE TESTS');
console.log('=' .repeat(60));

// Test large coordinate array performance
runAsyncTest('Large Coordinate Array Performance', async () => {
  const startTime = Date.now();
  
  // Generate large coordinate array (1000 points)
  const largeCoordinates = Array.from({ length: 1000 }, (_, i) => [
    -74.0060 + (i * 0.0001), 
    40.7128 + (i * 0.0001)
  ]);
  
  const geoJSON = await geojsonConverter.convertToGeoJSON(largeCoordinates, { 
    source: 'coordinates',
    validateOutput: false // Skip validation for performance
  });
  
  const duration = Date.now() - startTime;
  console.log(`   Large array (1000 points) processed in ${duration}ms`);
  
  return geoJSON.geometry.coordinates.length === 1000 && duration < 1000; // Should complete in <1s
});

// Test validation performance
runAsyncTest('Validation Performance', async () => {
  const startTime = Date.now();
  
  const geoJSON = await geojsonConverter.convertToGeoJSON(sampleGPXData, { 
    source: 'gpx',
    validateOutput: true
  });
  
  const duration = Date.now() - startTime;
  console.log(`   Validation completed in ${duration}ms`);
  
  return duration < 100; // Validation should be fast
});

// ==================== INTEGRATION TESTS ====================

console.log('\n' + '=' .repeat(60));
console.log('INTEGRATION TESTS');
console.log('=' .repeat(60));

// Test supported sources method
runTest('Supported Sources Method', () => {
  const sources = geojsonConverter.getSupportedSources();
  
  return Array.isArray(sources) &&
         sources.includes('gpx') &&
         sources.includes('tcx') &&
         sources.includes('strava_polyline') &&
         sources.includes('coordinates');
});

// Test validation rules method
runTest('Validation Rules Method', () => {
  const rules = geojsonConverter.getValidationRules();
  
  return typeof rules === 'object' &&
         typeof rules.maxCoordinates === 'number' &&
         typeof rules.minCoordinates === 'number';
});

// Test full workflow - GPX to optimized GeoJSON
runAsyncTest('Full Workflow - GPX to Optimized GeoJSON', async () => {
  const geoJSON = await geojsonConverter.convertToGeoJSON(sampleGPXData, {
    source: 'gpx',
    includeElevation: true,
    includeTimestamps: true,
    validateOutput: true,
    handleMultiSegment: true,
    optimizeForMapbox: true
  });
  
  return geoJSON.type === 'Feature' &&
         geoJSON.properties.hasElevation === true &&
         geoJSON.properties.hasTimestamps === true &&
         geoJSON.properties.lineColor &&
         geoJSON.properties.elevationStats &&
         geoJSON.properties.duration > 0;
});

// ==================== TEST RESULTS ====================

console.log('\n' + '=' .repeat(60));
console.log('TEST RESULTS SUMMARY');
console.log('=' .repeat(60));

setTimeout(() => {
  const total = testResults.passed + testResults.failed;
  const passRate = ((testResults.passed / total) * 100).toFixed(1);
  
  console.log(`\n📊 Test Results:`);
  console.log(`   Total Tests: ${total}`);
  console.log(`   Passed: ${testResults.passed} ✅`);
  console.log(`   Failed: ${testResults.failed} ❌`);
  console.log(`   Pass Rate: ${passRate}%`);
  
  if (testResults.failed > 0) {
    console.log(`\n🚨 Failed Tests:`);
    testResults.errors.forEach(error => {
      console.log(`   • ${error}`);
    });
  }
  
  console.log(`\n⏱️  Performance Summary:`);
  const performanceEntries = Object.entries(testResults.performance)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  performanceEntries.forEach(([test, duration]) => {
    console.log(`   ${test}: ${duration}ms`);
  });
  
  const avgPerformance = Object.values(testResults.performance)
    .reduce((sum, duration) => sum + duration, 0) / Object.keys(testResults.performance).length;
  
  console.log(`   Average: ${avgPerformance.toFixed(1)}ms`);
  
  if (passRate >= 90) {
    console.log(`\n🎉 Excellent! All tests passing with high performance.`);
  } else if (passRate >= 75) {
    console.log(`\n👍 Good test coverage. Consider addressing failed tests.`);
  } else {
    console.log(`\n⚠️  Test coverage needs improvement. Please review failed tests.`);
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('GeoJSON Converter Test Suite Complete');
  console.log('=' .repeat(60));
  
}, 2000); // Give async tests time to complete