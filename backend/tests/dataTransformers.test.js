/**
 * Test Suite for Data Transformation Layer
 * Validates all transformation utilities for Strava API integration
 */

const {
  transformActivitySummary,
  transformActivityDetails,
  transformActivityStreams,
  transformAthleteData,
  transformForMapGeneration,
  decodePolyline,
  calculateBounds,
  formatDuration,
  normalizeActivityData,
  getActivityColorCategory,
  getActivityLineWeight
} = require('../utils/dataTransformers');

// Test data samples (based on real Strava API responses)
const mockStravaActivity = {
  id: 12345678,
  name: "Morning Ride",
  type: "Ride",
  sport_type: "MountainBikeRide",
  start_date: "2024-01-15T08:30:00Z",
  start_date_local: "2024-01-15T09:30:00+01:00",
  timezone: "Europe/London",
  distance: 25000, // 25km in meters
  moving_time: 3600, // 1 hour
  elapsed_time: 3900, // 65 minutes
  total_elevation_gain: 500,
  start_latlng: [51.5074, -0.1278], // London coordinates
  end_latlng: [51.5174, -0.1178],
  average_speed: 6.94, // m/s
  max_speed: 15.0,
  elev_high: 200,
  elev_low: 50,
  has_heartrate: true,
  average_heartrate: 145,
  max_heartrate: 180,
  device_name: "Garmin Edge 530",
  gear_id: "b12345",
  map: {
    id: "a12345",
    polyline: "u{~vFvyys@fS]",
    summary_polyline: "u{~vFvyys@fS]",
    resource_state: 3
  }
};

const mockStravaStreams = {
  latlng: {
    data: [
      [51.5074, -0.1278],
      [51.5084, -0.1268],
      [51.5094, -0.1258]
    ],
    original_size: 3,
    resolution: "high",
    series_type: "distance"
  },
  altitude: {
    data: [50, 75, 100],
    original_size: 3,
    resolution: "high", 
    series_type: "distance"
  },
  time: {
    data: [0, 30, 60],
    original_size: 3,
    resolution: "high",
    series_type: "time"
  }
};

const mockStravaAthlete = {
  id: 123456,
  username: "testuser",
  firstname: "John",
  lastname: "Doe", 
  city: "London",
  state: "England",
  country: "United Kingdom",
  profile: "avatar/large.jpg",
  profile_medium: "avatar/medium.jpg",
  created_at: "2020-01-15T10:00:00Z",
  updated_at: "2024-01-15T10:00:00Z",
  measurement_preference: "meters",
  weight: 75.0,
  ftp: 250
};

/**
 * Test runner function
 */
function runTests() {
  console.log('🧪 Starting Data Transformers Test Suite...\n');
  
  let passedTests = 0;
  let totalTests = 0;
  
  function test(name, testFn) {
    totalTests++;
    try {
      testFn();
      console.log(`✅ ${name}`);
      passedTests++;
    } catch (error) {
      console.log(`❌ ${name}: ${error.message}`);
    }
  }
  
  // Test activity summary transformation
  test('transformActivitySummary - basic transformation', () => {
    const result = transformActivitySummary(mockStravaActivity);
    
    if (result.id !== mockStravaActivity.id) throw new Error('ID not preserved');
    if (result.name !== mockStravaActivity.name) throw new Error('Name not preserved');
    if (result.distance.kilometers !== 25) throw new Error('Distance conversion failed');
    if (Math.round(result.distance.miles) !== 16) throw new Error('Miles conversion failed');
    if (result.duration.moving_time_formatted !== '1:00:00') throw new Error('Duration formatting failed');
    if (result.speed.average_kmh !== 25.0) throw new Error('Speed conversion failed'); // 6.94 m/s = 25 km/h
    if (!result.location.start_coordinates) throw new Error('Start coordinates not processed');
  });
  
  // Test activity details transformation  
  test('transformActivityDetails - detailed transformation', () => {
    const result = transformActivityDetails(mockStravaActivity);
    
    if (!result.heartrate) throw new Error('Heartrate data missing');
    if (result.heartrate.average !== 145) throw new Error('Average heartrate incorrect');
    if (!result.map) throw new Error('Map data missing');
    if (!result.social) throw new Error('Social data missing');
  });
  
  // Test activity streams transformation
  test('transformActivityStreams - streams processing', () => {
    const result = transformActivityStreams(mockStravaStreams, 12345678);
    
    if (!result.has_gps_data) throw new Error('GPS data not detected');
    if (!result.has_altitude_data) throw new Error('Altitude data not detected');
    if (!result.has_time_data) throw new Error('Time data not detected');
    if (result.coordinates.length !== 3) throw new Error('Coordinate count incorrect');
    if (!result.geojson) throw new Error('GeoJSON not generated');
    if (result.geojson.geometry.type !== 'LineString') throw new Error('GeoJSON geometry type incorrect');
  });
  
  // Test athlete data transformation
  test('transformAthleteData - athlete processing', () => {
    const result = transformAthleteData(mockStravaAthlete);
    
    if (result.id !== mockStravaAthlete.id) throw new Error('Athlete ID not preserved');
    if (result.profile.full_name !== 'John Doe') throw new Error('Full name generation failed');
    if (result.location.location_string !== 'London, England, United Kingdom') throw new Error('Location string generation failed');
  });
  
  // Test polyline decoding
  test('decodePolyline - polyline decoding', () => {
    const testPolyline = "u{~vFvyys@fS]";
    const result = decodePolyline(testPolyline);
    
    if (!Array.isArray(result)) throw new Error('Result not an array');
    if (result.length === 0) throw new Error('No coordinates decoded');
    if (!Array.isArray(result[0]) || result[0].length !== 2) throw new Error('Coordinate format incorrect');
  });
  
  // Test bounds calculation
  test('calculateBounds - bounds calculation', () => {
    const coordinates = [
      [-0.1278, 51.5074],
      [-0.1268, 51.5084], 
      [-0.1258, 51.5094]
    ];
    const result = calculateBounds(coordinates);
    
    if (!result) throw new Error('Bounds not calculated');
    if (!result.southwest || !result.northeast) throw new Error('Bounds structure incorrect');
    if (!result.center) throw new Error('Center not calculated');
  });
  
  // Test duration formatting
  test('formatDuration - duration formatting', () => {
    if (formatDuration(3600) !== '1:00:00') throw new Error('Hour formatting failed');
    if (formatDuration(90) !== '1:30') throw new Error('Minute formatting failed');
    if (formatDuration(30) !== '0:30') throw new Error('Second formatting failed');
    if (formatDuration(0) !== '0:00') throw new Error('Zero formatting failed');
  });
  
  // Test data normalization
  test('normalizeActivityData - data normalization', () => {
    const messyData = {
      id: "12345",
      distance: "25000.5", 
      name: null,
      moving_time: undefined
    };
    const result = normalizeActivityData(messyData);
    
    if (typeof result.id !== 'number') throw new Error('ID not converted to number');
    if (typeof result.distance !== 'number') throw new Error('Distance not converted to number');
    if (typeof result.name !== 'string') throw new Error('Name not converted to string');
    if (typeof result.moving_time !== 'number') throw new Error('Moving time not converted to number');
  });
  
  // Test map generation transformation
  test('transformForMapGeneration - map optimization', () => {
    const result = transformForMapGeneration(mockStravaActivity);
    
    if (!result.activity_id) throw new Error('Activity ID missing');
    if (!result.metrics) throw new Error('Metrics missing');
    if (!result.style_hints) throw new Error('Style hints missing');
    if (result.style_hints.activity_type !== 'ride') throw new Error('Activity type hint incorrect');
  });
  
  // Test activity color categories
  test('getActivityColorCategory - color categorization', () => {
    if (getActivityColorCategory('Ride') !== 'cycling') throw new Error('Cycling color category incorrect');
    if (getActivityColorCategory('Run') !== 'running') throw new Error('Running color category incorrect');
    if (getActivityColorCategory('Hike') !== 'hiking') throw new Error('Hiking color category incorrect');
    if (getActivityColorCategory('UnknownType') !== 'other') throw new Error('Unknown type fallback failed');
  });
  
  // Test line weight calculation  
  test('getActivityLineWeight - line weight calculation', () => {
    if (getActivityLineWeight(150000) !== 4) throw new Error('Long distance weight incorrect');
    if (getActivityLineWeight(75000) !== 3) throw new Error('Medium distance weight incorrect');
    if (getActivityLineWeight(25000) !== 2) throw new Error('Short distance weight incorrect');
    if (getActivityLineWeight(5000) !== 1) throw new Error('Very short distance weight incorrect');
  });
  
  // Test error handling
  test('Error handling - invalid inputs', () => {
    try {
      transformActivitySummary(null);
      throw new Error('Should have thrown error for null input');
    } catch (error) {
      if (!error.message.includes('Invalid activity data')) {
        throw new Error('Wrong error message for null input');
      }
    }
    
    try {
      transformActivityStreams(null, 123);
      throw new Error('Should have thrown error for null streams');
    } catch (error) {
      if (!error.message.includes('Invalid streams data')) {
        throw new Error('Wrong error message for null streams');
      }
    }
  });
  
  // Performance test
  test('Performance - batch transformation', () => {
    const startTime = Date.now();
    const activities = Array(1000).fill(mockStravaActivity);
    
    activities.forEach(activity => {
      transformActivitySummary(activity);
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    if (duration > 1000) { // Should complete in under 1 second
      throw new Error(`Batch transformation too slow: ${duration}ms`);
    }
  });
  
  // Integration test - complete workflow
  test('Integration - complete data flow', () => {
    // Simulate complete data transformation workflow
    const activitySummary = transformActivitySummary(mockStravaActivity);
    const activityDetails = transformActivityDetails(mockStravaActivity);
    const streams = transformActivityStreams(mockStravaStreams, mockStravaActivity.id);
    const mapData = transformForMapGeneration(mockStravaActivity);
    const athlete = transformAthleteData(mockStravaAthlete);
    
    // Verify all transformations completed successfully
    if (!activitySummary.id || !activityDetails.id) throw new Error('Activity transformation failed');
    if (!streams.has_gps_data) throw new Error('Streams transformation failed');
    if (!mapData.activity_id) throw new Error('Map transformation failed');
    if (!athlete.id) throw new Error('Athlete transformation failed');
    
    // Verify data consistency across transformations
    if (activitySummary.id !== activityDetails.id) throw new Error('Data consistency check failed');
    if (streams.activity_id !== mockStravaActivity.id) throw new Error('Stream activity ID mismatch');
  });
  
  // Final summary
  console.log(`\n🏁 Test Results: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('✅ All tests passed! Data transformation layer is ready.');
    return true;
  } else {
    console.log('❌ Some tests failed. Please review the implementation.');
    return false;
  }
}

// Run tests when file is executed directly
if (require.main === module) {
  const success = runTests();
  process.exit(success ? 0 : 1);
}

module.exports = { runTests };