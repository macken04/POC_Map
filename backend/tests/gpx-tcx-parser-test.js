/**
 * GPX/TCX Parser Test Suite
 * 
 * This test suite validates the GPX/TCX parser service functionality
 * including file parsing, data extraction, error handling, and validation.
 * 
 * Test Categories:
 * 1. GPX File Parsing Tests
 * 2. TCX File Parsing Tests
 * 3. Data Validation Tests
 * 4. Error Handling Tests
 * 5. Format Detection Tests
 * 6. Integration Tests
 */

const path = require('path');
const fs = require('fs');
const gpxTcxParser = require('../services/gpxTcxParser');

// Test data - sample GPX and TCX content
const sampleGPXContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="TestGPS" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Test Route</name>
    <desc>Sample GPX for testing</desc>
    <time>2024-01-15T10:00:00Z</time>
  </metadata>
  <trk>
    <name>Test Track</name>
    <type>hiking</type>
    <trkseg>
      <trkpt lat="40.7128" lon="-74.0060">
        <ele>10.0</ele>
        <time>2024-01-15T10:00:00Z</time>
      </trkpt>
      <trkpt lat="40.7130" lon="-74.0058">
        <ele>12.0</ele>
        <time>2024-01-15T10:01:00Z</time>
      </trkpt>
      <trkpt lat="40.7132" lon="-74.0056">
        <ele>15.0</ele>
        <time>2024-01-15T10:02:00Z</time>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`;

const sampleTCXContent = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
  <Activities>
    <Activity Sport="Running">
      <Id>2024-01-15T10:00:00Z</Id>
      <Lap StartTime="2024-01-15T10:00:00Z">
        <Track>
          <Trackpoint>
            <Time>2024-01-15T10:00:00Z</Time>
            <Position>
              <LatitudeDegrees>40.7128</LatitudeDegrees>
              <LongitudeDegrees>-74.0060</LongitudeDegrees>
            </Position>
            <AltitudeMeters>10.0</AltitudeMeters>
          </Trackpoint>
          <Trackpoint>
            <Time>2024-01-15T10:01:00Z</Time>
            <Position>
              <LatitudeDegrees>40.7130</LatitudeDegrees>
              <LongitudeDegrees>-74.0058</LongitudeDegrees>
            </Position>
            <AltitudeMeters>12.0</AltitudeMeters>
          </Trackpoint>
          <Trackpoint>
            <Time>2024-01-15T10:02:00Z</Time>
            <Position>
              <LatitudeDegrees>40.7132</LatitudeDegrees>
              <LongitudeDegrees>-74.0056</LongitudeDegrees>
            </Position>
            <AltitudeMeters>15.0</AltitudeMeters>
          </Trackpoint>
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;

// Test results collector
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: []
};

// Test utility functions
function createTestBuffer(content) {
  return Buffer.from(content, 'utf8');
}

function runTest(testName, testFunction) {
  testResults.total++;
  console.log(`\n🔍 Running: ${testName}`);
  
  try {
    const result = testFunction();
    if (result === true) {
      testResults.passed++;
      console.log(`✅ PASS: ${testName}`);
    } else {
      testResults.failed++;
      console.log(`❌ FAIL: ${testName}`);
      testResults.errors.push({ test: testName, error: result || 'Test returned false' });
    }
  } catch (error) {
    testResults.failed++;
    console.log(`💥 ERROR: ${testName} - ${error.message}`);
    testResults.errors.push({ test: testName, error: error.message });
  }
}

async function runAsyncTest(testName, testFunction) {
  testResults.total++;
  console.log(`\n🔍 Running: ${testName}`);
  
  try {
    const result = await testFunction();
    if (result === true) {
      testResults.passed++;
      console.log(`✅ PASS: ${testName}`);
    } else {
      testResults.failed++;
      console.log(`❌ FAIL: ${testName}`);
      testResults.errors.push({ test: testName, error: result || 'Test returned false' });
    }
  } catch (error) {
    testResults.failed++;
    console.log(`💥 ERROR: ${testName} - ${error.message}`);
    testResults.errors.push({ test: testName, error: error.message });
  }
}

// Test Suite
async function runTestSuite() {
  console.log('🚀 Starting GPX/TCX Parser Test Suite\n');
  console.log('=' .repeat(60));

  // 1. Basic Service Availability Tests
  console.log('\n📦 BASIC SERVICE TESTS');
  console.log('-'.repeat(30));

  runTest('Service should be available', () => {
    return gpxTcxParser !== undefined && typeof gpxTcxParser === 'object';
  });

  runTest('Service should have parseGPXFile method', () => {
    return typeof gpxTcxParser.parseGPXFile === 'function';
  });

  runTest('Service should have parseTCXFile method', () => {
    return typeof gpxTcxParser.parseTCXFile === 'function';
  });

  runTest('Service should have validation methods', () => {
    return typeof gpxTcxParser.validateGPXFormat === 'function' &&
           typeof gpxTcxParser.validateTCXFormat === 'function';
  });

  // 2. Format Validation Tests
  console.log('\n🔍 FORMAT VALIDATION TESTS');
  console.log('-'.repeat(30));

  runTest('Should validate GPX format correctly', () => {
    return gpxTcxParser.validateGPXFormat(sampleGPXContent) === true;
  });

  runTest('Should validate TCX format correctly', () => {
    return gpxTcxParser.validateTCXFormat(sampleTCXContent) === true;
  });

  runTest('Should reject invalid GPX format', () => {
    return gpxTcxParser.validateGPXFormat('<invalid>content</invalid>') === false;
  });

  runTest('Should reject invalid TCX format', () => {
    return gpxTcxParser.validateTCXFormat('<gpx>content</gpx>') === false;
  });

  // 3. GPX Parsing Tests
  console.log('\n📍 GPX PARSING TESTS');
  console.log('-'.repeat(30));

  await runAsyncTest('Should parse valid GPX file', async () => {
    const buffer = createTestBuffer(sampleGPXContent);
    const result = await gpxTcxParser.parseGPXFile(buffer, 'test.gpx');
    
    return result.id && 
           result.name === 'Test Track' &&
           result.coordinates && 
           result.coordinates.length === 3 &&
           result.elevation && 
           result.elevation.length === 3 &&
           result.source === 'gpx_upload';
  });

  await runAsyncTest('Should extract GPX coordinates correctly', async () => {
    const buffer = createTestBuffer(sampleGPXContent);
    const result = await gpxTcxParser.parseGPXFile(buffer, 'test.gpx');
    
    const firstCoord = result.coordinates[0];
    return firstCoord[0] === 40.7128 && firstCoord[1] === -74.0060;
  });

  await runAsyncTest('Should extract GPX elevation data', async () => {
    const buffer = createTestBuffer(sampleGPXContent);
    const result = await gpxTcxParser.parseGPXFile(buffer, 'test.gpx');
    
    return result.elevation[0].elevation_meters === 10.0 &&
           result.elevation[1].elevation_meters === 12.0 &&
           result.elevation[2].elevation_meters === 15.0;
  });

  await runAsyncTest('Should calculate GPX distance', async () => {
    const buffer = createTestBuffer(sampleGPXContent);
    const result = await gpxTcxParser.parseGPXFile(buffer, 'test.gpx');
    
    return result.distance > 0 && typeof result.distance === 'number';
  });

  await runAsyncTest('Should calculate GPX elevation gain', async () => {
    const buffer = createTestBuffer(sampleGPXContent);
    const result = await gpxTcxParser.parseGPXFile(buffer, 'test.gpx');
    
    return result.total_elevation_gain === 5.0; // 15.0 - 10.0
  });

  await runAsyncTest('Should create GPX bounds', async () => {
    const buffer = createTestBuffer(sampleGPXContent);
    const result = await gpxTcxParser.parseGPXFile(buffer, 'test.gpx');
    
    return !!(result.bounds && 
              result.bounds.southwest && 
              result.bounds.northeast &&
              result.bounds.center);
  });

  // 4. TCX Parsing Tests
  console.log('\n🏃 TCX PARSING TESTS');
  console.log('-'.repeat(30));

  await runAsyncTest('Should parse valid TCX file', async () => {
    const buffer = createTestBuffer(sampleTCXContent);
    const result = await gpxTcxParser.parseTCXFile(buffer, 'test.tcx');
    
    return result.id && 
           result.coordinates && 
           result.coordinates.length === 3 &&
           result.elevation && 
           result.elevation.length === 3 &&
           result.source === 'tcx_upload' &&
           result.metadata.sport === 'Running';
  });

  await runAsyncTest('Should extract TCX coordinates correctly', async () => {
    const buffer = createTestBuffer(sampleTCXContent);
    const result = await gpxTcxParser.parseTCXFile(buffer, 'test.tcx');
    
    const firstCoord = result.coordinates[0];
    return firstCoord[0] === 40.7128 && firstCoord[1] === -74.0060;
  });

  await runAsyncTest('Should extract TCX timestamps', async () => {
    const buffer = createTestBuffer(sampleTCXContent);
    const result = await gpxTcxParser.parseTCXFile(buffer, 'test.tcx');
    
    return result.timestamps.length === 3 &&
           result.timestamps[0].timestamp === '2024-01-15T10:00:00Z';
  });

  // 5. Data Validation Tests
  console.log('\n✅ DATA VALIDATION TESTS');
  console.log('-'.repeat(30));

  runTest('Should validate coordinate data correctly', () => {
    const validCoords = [[40.7128, -74.0060], [40.7130, -74.0058]];
    return gpxTcxParser.validateCoordinateData(validCoords) === true;
  });

  runTest('Should reject invalid coordinate data', () => {
    const invalidCoords = [[200, -200], [40.7130, -74.0058]]; // Invalid latitude
    return gpxTcxParser.validateCoordinateData(invalidCoords) === false;
  });

  runTest('Should reject empty coordinate arrays', () => {
    return gpxTcxParser.validateCoordinateData([]) === false;
  });

  runTest('Should reject malformed coordinate data', () => {
    const malformedCoords = [40.7128, -74.0060]; // Not nested array
    return gpxTcxParser.validateCoordinateData(malformedCoords) === false;
  });

  // 6. Error Handling Tests
  console.log('\n🚨 ERROR HANDLING TESTS');
  console.log('-'.repeat(30));

  await runAsyncTest('Should handle malformed GPX files', async () => {
    const badGPX = '<gpx><broken></gpx>';
    const buffer = createTestBuffer(badGPX);
    
    try {
      await gpxTcxParser.parseGPXFile(buffer, 'bad.gpx');
      return false; // Should have thrown an error
    } catch (error) {
      return error.success === false && error.error && error.error.type === 'parsing_error';
    }
  });

  await runAsyncTest('Should handle malformed TCX files', async () => {
    const badTCX = '<TrainingCenterDatabase><Activities></TrainingCenterDatabase>';
    const buffer = createTestBuffer(badTCX);
    
    try {
      await gpxTcxParser.parseTCXFile(buffer, 'bad.tcx');
      return false; // Should have thrown an error
    } catch (error) {
      return error.success === false && error.error && error.error.type === 'parsing_error';
    }
  });

  await runAsyncTest('Should handle empty files', async () => {
    const buffer = createTestBuffer('');
    
    try {
      await gpxTcxParser.parseGPXFile(buffer, 'empty.gpx');
      return false; // Should have thrown an error
    } catch (error) {
      return error.success === false && error.error && error.error.type === 'parsing_error';
    }
  });

  // 7. Utility Function Tests
  console.log('\n🔧 UTILITY FUNCTION TESTS');
  console.log('-'.repeat(30));

  runTest('Should support GPX format', () => {
    return gpxTcxParser.isFormatSupported('gpx') === true;
  });

  runTest('Should support TCX format', () => {
    return gpxTcxParser.isFormatSupported('tcx') === true;
  });

  runTest('Should reject unsupported format', () => {
    return gpxTcxParser.isFormatSupported('kml') === false;
  });

  runTest('Should return supported formats list', () => {
    const formats = gpxTcxParser.getSupportedFormats();
    return Array.isArray(formats) && formats.includes('gpx') && formats.includes('tcx');
  });

  // 8. GeoJSON Output Tests
  console.log('\n🗺️  GEOJSON OUTPUT TESTS');
  console.log('-'.repeat(30));

  await runAsyncTest('Should create valid GeoJSON from GPX', async () => {
    const buffer = createTestBuffer(sampleGPXContent);
    const result = await gpxTcxParser.parseGPXFile(buffer, 'test.gpx');
    
    return result.geojson &&
           result.geojson.type === 'Feature' &&
           result.geojson.geometry &&
           result.geojson.geometry.type === 'LineString' &&
           result.geojson.geometry.coordinates.length === 3;
  });

  await runAsyncTest('Should create valid GeoJSON from TCX', async () => {
    const buffer = createTestBuffer(sampleTCXContent);
    const result = await gpxTcxParser.parseTCXFile(buffer, 'test.tcx');
    
    return result.geojson &&
           result.geojson.type === 'Feature' &&
           result.geojson.geometry &&
           result.geojson.geometry.type === 'LineString' &&
           result.geojson.geometry.coordinates.length === 3;
  });

  // Display Results
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${testResults.total}`);
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📈 Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);

  if (testResults.failed > 0) {
    console.log('\n💥 FAILED TESTS:');
    testResults.errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error.test}: ${error.error}`);
    });
  }

  console.log('\n' + '='.repeat(60));
  
  // Return success/failure for CI integration
  return testResults.failed === 0;
}

// Run the test suite if this file is executed directly
if (require.main === module) {
  runTestSuite().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Test suite failed to run:', error);
    process.exit(1);
  });
}

module.exports = { runTestSuite };