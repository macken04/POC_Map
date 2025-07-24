/**
 * Comprehensive Test Suite for Data Transformers
 * Tests polyline decoding/encoding and coordinate transformation utilities
 */

const {
  decodePolyline,
  encodePolyline,
  wgs84ToWebMercator,
  webMercatorToWgs84,
  transformCoordinates,
  handleAntimeridianCrossing,
  handlePolarCoordinates,
  normalizeLongitude,
  clampLatitude,
  calculateBounds
} = require('../utils/dataTransformers');

// Test constants
const DUBLIN_COORDS = [-6.2603, 53.3498]; // Dublin, Ireland
const TOKYO_COORDS = [139.6917, 35.6895]; // Tokyo, Japan
const SYDNEY_COORDS = [151.2093, -33.8688]; // Sydney, Australia
const POLAR_COORDS = [0, 89]; // Near North Pole
const ANTIMERIDIAN_COORDS = [
  [179.5, 10],
  [-179.5, 10.1],
  [-179.0, 10.2]
]; // Cross 180° longitude

// Dublin to Phoenix Park sample polyline (actual Strava data format)
const SAMPLE_POLYLINE = 'u{~vHdcqN_@aA[yCK}AAeAJ}@Hm@Xe@\\Wd@Qh@Ed@Ah@I';

console.log('=== DATA TRANSFORMERS TEST SUITE ===\n');

// ==================== POLYLINE TESTS ====================
console.log('1. POLYLINE ENCODING/DECODING TESTS');
console.log('=====================================');

try {
  // Test 1: Basic polyline decoding
  console.log('Test 1: Basic polyline decoding');
  const decodedCoords = decodePolyline(SAMPLE_POLYLINE);
  console.log(`✓ Decoded ${decodedCoords.length} coordinates from sample polyline`);
  console.log(`  First coordinate: [${decodedCoords[0][0].toFixed(6)}, ${decodedCoords[0][1].toFixed(6)}]`);
  console.log(`  Last coordinate: [${decodedCoords[decodedCoords.length-1][0].toFixed(6)}, ${decodedCoords[decodedCoords.length-1][1].toFixed(6)}]\n`);

  // Test 2: Polyline encoding and round-trip
  console.log('Test 2: Polyline encoding round-trip test');
  const testCoords = [DUBLIN_COORDS, TOKYO_COORDS, SYDNEY_COORDS];
  const encoded = encodePolyline(testCoords);
  const decoded = decodePolyline(encoded);
  
  console.log(`✓ Original coordinates: ${testCoords.length}`);
  console.log(`✓ Encoded polyline: ${encoded.substring(0, 50)}...`);
  console.log(`✓ Decoded coordinates: ${decoded.length}`);
  
  // Check accuracy
  const accuracy = testCoords.every((original, i) => {
    const [origLng, origLat] = original;
    const [decodedLng, decodedLat] = decoded[i];
    return Math.abs(origLng - decodedLng) < 0.00001 && Math.abs(origLat - decodedLat) < 0.00001;
  });
  console.log(`✓ Round-trip accuracy: ${accuracy ? 'PASS' : 'FAIL'}\n`);

  // Test 3: Error handling
  console.log('Test 3: Polyline error handling');
  
  try {
    decodePolyline(null);
    console.log('✗ FAIL: Should throw error for null input');
  } catch (error) {
    console.log('✓ Correctly throws error for null input');
  }
  
  try {
    decodePolyline('invalid_polyline_@#$%');
    console.log('✗ FAIL: Should throw error for invalid characters');
  } catch (error) {
    console.log('✓ Correctly throws error for invalid characters');
  }
  
  try {
    encodePolyline(['invalid']);
    console.log('✗ FAIL: Should throw error for invalid coordinates');
  } catch (error) {
    console.log('✓ Correctly throws error for invalid coordinates');
  }
  
  console.log('');

} catch (error) {
  console.log(`✗ POLYLINE TESTS FAILED: ${error.message}\n`);
}

// ==================== COORDINATE TRANSFORMATION TESTS ====================
console.log('2. COORDINATE TRANSFORMATION TESTS');
console.log('====================================');

try {
  // Test 4: WGS84 to Web Mercator conversion
  console.log('Test 4: WGS84 to Web Mercator transformation');
  
  const dublinMercator = wgs84ToWebMercator(DUBLIN_COORDS[0], DUBLIN_COORDS[1]);
  console.log(`✓ Dublin WGS84: [${DUBLIN_COORDS[0]}, ${DUBLIN_COORDS[1]}]`);
  console.log(`✓ Dublin Web Mercator: [${dublinMercator.x.toFixed(2)}, ${dublinMercator.y.toFixed(2)}]`);
  
  // Test round-trip accuracy
  const dublinWgs84 = webMercatorToWgs84(dublinMercator.x, dublinMercator.y);
  const lngAccuracy = Math.abs(DUBLIN_COORDS[0] - dublinWgs84.longitude) < 0.000001;
  const latAccuracy = Math.abs(DUBLIN_COORDS[1] - dublinWgs84.latitude) < 0.000001;
  console.log(`✓ Round-trip accuracy: ${lngAccuracy && latAccuracy ? 'PASS' : 'FAIL'}\n`);

  // Test 5: Coordinate array transformation
  console.log('Test 5: Coordinate array transformation');
  
  const testCoordinates = [DUBLIN_COORDS, TOKYO_COORDS, SYDNEY_COORDS];
  const mercatorCoords = transformCoordinates(testCoordinates, 'wgs84', 'webmercator');
  const backToWgs84 = transformCoordinates(mercatorCoords, 'webmercator', 'wgs84');
  
  console.log(`✓ Transformed ${testCoordinates.length} coordinates to Web Mercator`);
  console.log(`✓ Transformed back to WGS84`);
  
  // Check accuracy
  const arrayAccuracy = testCoordinates.every((original, i) => {
    const [origLng, origLat] = original;
    const [backLng, backLat] = backToWgs84[i];
    return Math.abs(origLng - backLng) < 0.000001 && Math.abs(origLat - backLat) < 0.000001;
  });
  console.log(`✓ Array transformation accuracy: ${arrayAccuracy ? 'PASS' : 'FAIL'}\n`);

  // Test 6: Polar coordinate handling
  console.log('Test 6: Polar coordinate handling');
  
  const polarTest = [[0, 89.5], [0, -89.5], [0, 95], [0, -95]]; // Include invalid latitudes
  const processedPolar = handlePolarCoordinates(polarTest);
  console.log(`✓ Processed ${polarTest.length} polar coordinates`);
  console.log(`✓ Result: ${JSON.stringify(processedPolar)}`);
  
  // Check that extreme latitudes are clamped
  const validRange = processedPolar.every(coord => 
    coord[1] >= -85.0511287798 && coord[1] <= 85.0511287798
  );
  console.log(`✓ Polar clamping: ${validRange ? 'PASS' : 'FAIL'}\n`);

} catch (error) {
  console.log(`✗ COORDINATE TRANSFORMATION TESTS FAILED: ${error.message}\n`);
}

// ==================== ANTIMERIDIAN TESTS ====================
console.log('3. ANTIMERIDIAN CROSSING TESTS');
console.log('================================');

try {
  // Test 7: Antimeridian crossing detection
  console.log('Test 7: Antimeridian crossing detection');
  
  const segments = handleAntimeridianCrossing(ANTIMERIDIAN_COORDS);
  console.log(`✓ Original coordinates: ${ANTIMERIDIAN_COORDS.length}`);
  console.log(`✓ Detected segments: ${segments.length}`);
  console.log(`✓ Segments: ${JSON.stringify(segments)}`);
  
  const hasMultipleSegments = segments.length > 1;
  console.log(`✓ Antimeridian detection: ${hasMultipleSegments ? 'PASS' : 'FAIL'}\n`);

  // Test 8: Longitude normalization
  console.log('Test 8: Longitude normalization');
  
  const testLongitudes = [270, -270, 540, -540, 179.5, -179.5];
  const normalized = testLongitudes.map(lng => normalizeLongitude(lng));
  console.log(`✓ Original: ${testLongitudes}`);
  console.log(`✓ Normalized: ${normalized}`);
  
  const validNormalization = normalized.every(lng => lng >= -180 && lng <= 180);
  console.log(`✓ Normalization: ${validNormalization ? 'PASS' : 'FAIL'}\n`);

} catch (error) {
  console.log(`✗ ANTIMERIDIAN TESTS FAILED: ${error.message}\n`);
}

// ==================== BOUNDS CALCULATION TESTS ====================
console.log('4. BOUNDS CALCULATION TESTS');
console.log('=============================');

try {
  // Test 9: Basic bounds calculation
  console.log('Test 9: Basic bounds calculation');
  
  const testBounds = [DUBLIN_COORDS, TOKYO_COORDS, SYDNEY_COORDS];
  const bounds = calculateBounds(testBounds);
  
  console.log(`✓ Test coordinates: ${testBounds.length}`);
  console.log(`✓ Bounds: SW[${bounds.southwest[0].toFixed(4)}, ${bounds.southwest[1].toFixed(4)}] NE[${bounds.northeast[0].toFixed(4)}, ${bounds.northeast[1].toFixed(4)}]`);
  console.log(`✓ Center: [${bounds.center[0].toFixed(4)}, ${bounds.center[1].toFixed(4)}]`);
  console.log(`✓ Antimeridian crossing: ${bounds.antimeridianCrossing}\n`);

  // Test 10: Antimeridian crossing bounds
  console.log('Test 10: Antimeridian crossing bounds');
  
  const antimeridianBounds = calculateBounds(ANTIMERIDIAN_COORDS, { handleAntimeridian: true });
  console.log(`✓ Antimeridian coordinates: ${ANTIMERIDIAN_COORDS.length}`);
  console.log(`✓ Bounds: SW[${antimeridianBounds.southwest[0].toFixed(4)}, ${antimeridianBounds.southwest[1].toFixed(4)}] NE[${antimeridianBounds.northeast[0].toFixed(4)}, ${antimeridianBounds.northeast[1].toFixed(4)}]`);
  console.log(`✓ Antimeridian crossing detected: ${antimeridianBounds.antimeridianCrossing}\n`);

} catch (error) {
  console.log(`✗ BOUNDS CALCULATION TESTS FAILED: ${error.message}\n`);
}

// ==================== PERFORMANCE TESTS ====================
console.log('5. PERFORMANCE TESTS');
console.log('=====================');

try {
  // Test 11: Large polyline performance
  console.log('Test 11: Large dataset performance');
  
  // Generate large coordinate array (simulating a long route)
  const largeCoordArray = [];
  for (let i = 0; i < 10000; i++) {
    largeCoordArray.push([
      -180 + (360 * i / 10000), // Longitude from -180 to 180
      80 * Math.sin(i / 100) // Latitude sine wave within valid range (-80 to 80)
    ]);
  }
  
  // Test encoding performance
  const encodeStart = performance.now();
  const largeEncoded = encodePolyline(largeCoordArray);
  const encodeTime = performance.now() - encodeStart;
  
  // Test decoding performance
  const decodeStart = performance.now();
  const largeDecoded = decodePolyline(largeEncoded);
  const decodeTime = performance.now() - decodeStart;
  
  console.log(`✓ Large dataset: ${largeCoordArray.length} coordinates`);
  console.log(`✓ Encode time: ${encodeTime.toFixed(2)}ms`);
  console.log(`✓ Decode time: ${decodeTime.toFixed(2)}ms`);
  console.log(`✓ Encoded length: ${largeEncoded.length} characters`);
  console.log(`✓ Decoded accuracy: ${largeDecoded.length === largeCoordArray.length ? 'PASS' : 'FAIL'}\n`);

  // Test transformation performance
  const transformStart = performance.now();
  const transformedLarge = transformCoordinates(largeCoordArray, 'wgs84', 'webmercator');
  const transformTime = performance.now() - transformStart;
  
  console.log(`✓ Transform time: ${transformTime.toFixed(2)}ms`);
  console.log(`✓ Transform result: ${transformedLarge.length} coordinates\n`);

} catch (error) {
  console.log(`✗ PERFORMANCE TESTS FAILED: ${error.message}\n`);
}

// ==================== EDGE CASE TESTS ====================
console.log('6. EDGE CASE TESTS');
console.log('===================');

try {
  // Test 12: Empty and null inputs
  console.log('Test 12: Edge case handling');
  
  // Empty arrays
  const emptyBounds = calculateBounds([]);
  console.log(`✓ Empty bounds: ${emptyBounds === null ? 'PASS' : 'FAIL'}`);
  
  const emptyPolyline = encodePolyline([]);
  console.log(`✓ Empty polyline encoding: ${emptyPolyline === '' ? 'PASS' : 'FAIL'}`);
  
  const emptyDecoding = decodePolyline('');
  console.log(`✓ Empty polyline decoding: ${emptyDecoding.length === 0 ? 'PASS' : 'FAIL'}`);
  
  // Single coordinate
  const singleCoord = calculateBounds([DUBLIN_COORDS]);
  const isSinglePoint = singleCoord.southwest[0] === singleCoord.northeast[0] && 
                        singleCoord.southwest[1] === singleCoord.northeast[1];
  console.log(`✓ Single coordinate bounds: ${isSinglePoint ? 'PASS' : 'FAIL'}`);
  
  // Invalid coordinate handling
  try {
    wgs84ToWebMercator(200, 50); // Invalid longitude
    console.log('✗ FAIL: Should reject invalid longitude');
  } catch (error) {
    console.log('✓ Correctly rejects invalid longitude');
  }
  
  try {
    wgs84ToWebMercator(50, 95); // Invalid latitude
    console.log('✗ FAIL: Should reject invalid latitude');
  } catch (error) {
    console.log('✓ Correctly rejects invalid latitude');
  }
  
  console.log('');

} catch (error) {
  console.log(`✗ EDGE CASE TESTS FAILED: ${error.message}\n`);
}

console.log('=== TEST SUITE COMPLETE ===');
console.log('If all tests show ✓ PASS, the implementation is working correctly.');
console.log('Any ✗ FAIL messages indicate issues that need to be addressed.\n');