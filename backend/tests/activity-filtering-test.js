/**
 * Comprehensive Test Suite for Activity Filtering and Sorting
 * Tests all filtering parameters, sorting options, parameter validation, and error handling
 */

const { 
  validateAndParseQuery,
  filterActivities,
  sortActivities,
  buildStravaApiParams,
  getFilterSummary
} = require('../utils/activityFilters');

class ActivityFilteringTest {
  constructor() {
    this.testResults = {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      testDetails: []
    };
    
    // Mock activity data for testing
    this.mockActivities = [
      {
        id: 1,
        name: 'Morning Ride',
        type: 'Ride',
        sport_type: 'Ride',
        start_date: '2024-01-15T08:00:00Z',
        start_date_local: '2024-01-15T08:00:00',
        distance: 25000, // 25km in meters
        moving_time: 3600, // 1 hour
        elapsed_time: 3900,
        total_elevation_gain: 500,
        average_speed: 6.94, // m/s
        max_speed: 12.5,
        start_latlng: [37.7749, -122.4194],
        end_latlng: [37.7849, -122.4094]
      },
      {
        id: 2,
        name: 'Evening Run',
        type: 'Run',
        sport_type: 'Run',
        start_date: '2024-01-16T18:00:00Z',
        start_date_local: '2024-01-16T18:00:00',
        distance: 10000, // 10km
        moving_time: 2400, // 40 minutes
        elapsed_time: 2500,
        total_elevation_gain: 100,
        average_speed: 4.17,
        max_speed: 6.0,
        start_latlng: [37.7849, -122.4094],
        end_latlng: [37.7949, -122.3994]
      },
      {
        id: 3,
        name: 'Long Cycle',
        type: 'Ride',
        sport_type: 'Ride',
        start_date: '2024-01-17T07:00:00Z',
        start_date_local: '2024-01-17T07:00:00',
        distance: 80000, // 80km
        moving_time: 10800, // 3 hours
        elapsed_time: 11400,
        total_elevation_gain: 1200,
        average_speed: 7.41,
        max_speed: 15.0,
        start_latlng: [37.7949, -122.3994],
        end_latlng: [37.8049, -122.3894]
      },
      {
        id: 4,
        name: 'Quick Walk',
        type: 'Walk',
        sport_type: 'Walk',
        start_date: '2024-01-18T12:00:00Z',
        start_date_local: '2024-01-18T12:00:00',
        distance: 3000, // 3km
        moving_time: 1800, // 30 minutes
        elapsed_time: 1900,
        total_elevation_gain: 50,
        average_speed: 1.67,
        max_speed: 2.5,
        start_latlng: [37.8049, -122.3894],
        end_latlng: [37.8149, -122.3794]
      }
    ];
  }

  runTest(testName, testFunction) {
    this.testResults.totalTests++;
    try {
      const result = testFunction();
      if (result === true || (typeof result === 'object' && result.success)) {
        this.testResults.passedTests++;
        this.testResults.testDetails.push({
          name: testName,
          status: 'PASS',
          message: result.message || 'Test passed successfully'
        });
        console.log(`✅ ${testName}: PASS`);
      } else {
        throw new Error(result.message || 'Test returned false');
      }
    } catch (error) {
      this.testResults.failedTests++;
      this.testResults.testDetails.push({
        name: testName,
        status: 'FAIL',
        message: error.message,
        error: error.stack
      });
      console.log(`❌ ${testName}: FAIL - ${error.message}`);
    }
  }

  // Test query parameter validation
  testQueryValidation() {
    this.runTest('Valid query parameters', () => {
      const query = {
        page: '2',
        per_page: '50',
        activity_types: 'Ride,Run',
        min_distance: '5000',
        max_distance: '50000',
        sort_by: 'distance',
        sort_order: 'asc'
      };
      
      const result = validateAndParseQuery(query);
      
      return result.page === 2 && 
             result.per_page === 50 && 
             result.activity_types.includes('Ride') &&
             result.min_distance === 5000 &&
             result.sort_by === 'distance';
    });

    this.runTest('Invalid distance parameters', () => {
      try {
        validateAndParseQuery({ min_distance: 'invalid' });
        return false;
      } catch (error) {
        return error.message.includes('min_distance');
      }
    });

    this.runTest('Min greater than max distance', () => {
      try {
        validateAndParseQuery({ min_distance: '50000', max_distance: '10000' });
        return false;
      } catch (error) {
        return error.message.includes('min_distance cannot be greater than max_distance');
      }
    });

    this.runTest('Invalid sort field', () => {
      try {
        validateAndParseQuery({ sort_by: 'invalid_field' });
        return false;
      } catch (error) {
        return error.message.includes('Invalid sort_by parameter');
      }
    });
  }

  // Test activity type filtering
  testActivityTypeFiltering() {
    this.runTest('Filter by single activity type - Ride', () => {
      const filters = { activity_types: ['Ride'] };
      const filtered = filterActivities(this.mockActivities, filters);
      return filtered.length === 2 && filtered.every(activity => activity.type === 'Ride');
    });

    this.runTest('Filter by multiple activity types', () => {
      const filters = { activity_types: ['Ride', 'Run'] };
      const filtered = filterActivities(this.mockActivities, filters);
      return filtered.length === 3 && filtered.every(activity => ['Ride', 'Run'].includes(activity.type));
    });

    this.runTest('Filter by non-existent activity type', () => {
      const filters = { activity_types: ['Swimming'] };
      const filtered = filterActivities(this.mockActivities, filters);
      return filtered.length === 0;
    });
  }

  // Test distance filtering
  testDistanceFiltering() {
    this.runTest('Filter by minimum distance', () => {
      const filters = { min_distance: 15000 }; // 15km
      const filtered = filterActivities(this.mockActivities, filters);
      return filtered.length === 2 && filtered.every(activity => activity.distance >= 15000);
    });

    this.runTest('Filter by maximum distance', () => {
      const filters = { max_distance: 30000 }; // 30km
      const filtered = filterActivities(this.mockActivities, filters);
      return filtered.length === 3 && filtered.every(activity => activity.distance <= 30000);
    });

    this.runTest('Filter by distance range', () => {
      const filters = { min_distance: 5000, max_distance: 30000 };
      const filtered = filterActivities(this.mockActivities, filters);
      return filtered.length === 2 && 
             filtered.every(activity => activity.distance >= 5000 && activity.distance <= 30000);
    });
  }

  // Test elevation filtering
  testElevationFiltering() {
    this.runTest('Filter by minimum elevation', () => {
      const filters = { min_elevation: 200 };
      const filtered = filterActivities(this.mockActivities, filters);
      return filtered.length === 2 && filtered.every(activity => activity.total_elevation_gain >= 200);
    });

    this.runTest('Filter by maximum elevation', () => {
      const filters = { max_elevation: 600 };
      const filtered = filterActivities(this.mockActivities, filters);
      return filtered.length === 3 && filtered.every(activity => activity.total_elevation_gain <= 600);
    });
  }

  // Test duration filtering
  testDurationFiltering() {
    this.runTest('Filter by minimum duration', () => {
      const filters = { min_duration: 3000 }; // 50 minutes
      const filtered = filterActivities(this.mockActivities, filters);
      return filtered.length === 2 && filtered.every(activity => activity.moving_time >= 3000);
    });

    this.runTest('Filter by maximum duration', () => {
      const filters = { max_duration: 7200 }; // 2 hours
      const filtered = filterActivities(this.mockActivities, filters);
      return filtered.length === 3 && filtered.every(activity => activity.moving_time <= 7200);
    });
  }

  // Test name search filtering
  testNameFiltering() {
    this.runTest('Search by name - case insensitive', () => {
      const filters = { search_name: 'ride' };
      const filtered = filterActivities(this.mockActivities, filters);
      return filtered.length === 1 && filtered[0].name === 'Morning Ride';
    });

    this.runTest('Search by partial name match', () => {
      const filters = { search_name: 'long' };
      const filtered = filterActivities(this.mockActivities, filters);
      return filtered.length === 1 && filtered[0].name === 'Long Cycle';
    });

    this.runTest('Search with no matches', () => {
      const filters = { search_name: 'swimming' };
      const filtered = filterActivities(this.mockActivities, filters);
      return filtered.length === 0;
    });
  }

  // Test complex filtering combinations
  testComplexFiltering() {
    this.runTest('Multiple filter combination', () => {
      const filters = {
        activity_types: ['Ride', 'Run'],
        min_distance: 8000,
        max_elevation: 800
      };
      const filtered = filterActivities(this.mockActivities, filters);
      return filtered.length === 2 && 
             filtered.every(activity => 
               ['Ride', 'Run'].includes(activity.type) &&
               activity.distance >= 8000 &&
               activity.total_elevation_gain <= 800
             );
    });

    this.runTest('Restrictive filters return no results', () => {
      const filters = {
        activity_types: ['Ride'],
        min_distance: 100000, // 100km - no activities meet this
        min_elevation: 2000
      };
      const filtered = filterActivities(this.mockActivities, filters);
      return filtered.length === 0;
    });
  }

  // Test sorting functionality
  testSorting() {
    this.runTest('Sort by distance descending', () => {
      const sorted = sortActivities(this.mockActivities, 'distance', 'desc');
      return sorted[0].distance > sorted[1].distance && 
             sorted[1].distance > sorted[2].distance &&
             sorted[2].distance > sorted[3].distance;
    });

    this.runTest('Sort by distance ascending', () => {
      const sorted = sortActivities(this.mockActivities, 'distance', 'asc');
      return sorted[0].distance < sorted[1].distance && 
             sorted[1].distance < sorted[2].distance &&
             sorted[2].distance < sorted[3].distance;
    });

    this.runTest('Sort by name alphabetically', () => {
      const sorted = sortActivities(this.mockActivities, 'name', 'asc');
      return sorted[0].name.localeCompare(sorted[1].name) <= 0;
    });

    this.runTest('Sort by start date descending', () => {
      const sorted = sortActivities(this.mockActivities, 'start_date', 'desc');
      const firstDate = new Date(sorted[0].start_date);
      const secondDate = new Date(sorted[1].start_date);
      return firstDate >= secondDate;
    });

    this.runTest('Sort by elevation gain', () => {
      const sorted = sortActivities(this.mockActivities, 'total_elevation_gain', 'desc');
      return sorted[0].total_elevation_gain >= sorted[1].total_elevation_gain;
    });
  }

  // Test Strava API parameter building
  testStravaApiParams() {
    this.runTest('Build valid Strava API parameters', () => {
      const params = {
        page: 2,
        per_page: 50,
        before: '1705449600',
        after: '1704844800',
        // These should be ignored by buildStravaApiParams
        activity_types: ['Ride'],
        min_distance: 5000
      };
      
      const apiParams = buildStravaApiParams(params);
      const paramString = apiParams.toString();
      
      return paramString.includes('page=2') &&
             paramString.includes('per_page=50') &&
             paramString.includes('before=1705449600') &&
             paramString.includes('after=1704844800') &&
             !paramString.includes('activity_types') &&
             !paramString.includes('min_distance');
    });
  }

  // Test filter summary generation
  testFilterSummary() {
    this.runTest('Generate comprehensive filter summary', () => {
      const filters = {
        activity_types: ['Ride', 'Run'],
        min_distance: 5000,
        max_distance: 50000,
        search_name: 'morning',
        sort_by: 'distance',
        sort_order: 'desc'
      };
      
      const summary = getFilterSummary(filters, 100, 25);
      
      return summary.activeFilters.length > 0 &&
             summary.originalCount === 100 &&
             summary.filteredCount === 25 &&
             summary.sortBy === 'distance' &&
             summary.sortOrder === 'desc' &&
             summary.filterEfficiency === '75.0%';
    });
  }

  // Test edge cases and error conditions
  testEdgeCases() {
    this.runTest('Handle empty activities array', () => {
      const filtered = filterActivities([], { min_distance: 1000 });
      return Array.isArray(filtered) && filtered.length === 0;
    });

    this.runTest('Handle null activities', () => {
      const filtered = filterActivities(null, { min_distance: 1000 });
      return Array.isArray(filtered) && filtered.length === 0;
    });

    this.runTest('Handle activities with missing fields', () => {
      const incompleteActivities = [
        { id: 1, name: 'Test', type: 'Ride' }, // missing distance, elevation, etc.
        { id: 2, name: 'Test 2', type: 'Run', distance: 5000 }
      ];
      
      // Call the filter function with the same structure as parsed parameters
      const filters = { 
        min_distance: 1000,  // Already a number, not a string
        activity_types: null,
        max_distance: null,
        min_elevation: null,
        max_elevation: null,
        min_duration: null,
        max_duration: null,
        search_name: null
      };
      
      const filtered = filterActivities(incompleteActivities, filters);
      
      // Activity 1 should be filtered out (no distance), Activity 2 should pass (5000 >= 1000)
      return filtered.length === 1 && filtered[0].id === 2 && filtered[0].distance === 5000;
    });

    this.runTest('Sort empty array', () => {
      const sorted = sortActivities([], 'distance', 'desc');
      return Array.isArray(sorted) && sorted.length === 0;
    });

    this.runTest('Sort with invalid field falls back gracefully', () => {
      const sorted = sortActivities(this.mockActivities, 'nonexistent_field', 'desc');
      return Array.isArray(sorted) && sorted.length === this.mockActivities.length;
    });
  }

  // Performance test with large dataset
  testPerformance() {
    this.runTest('Performance with large dataset', () => {
      // Generate 1000 mock activities
      const largeDataset = [];
      for (let i = 0; i < 1000; i++) {
        largeDataset.push({
          id: i,
          name: `Activity ${i}`,
          type: i % 3 === 0 ? 'Ride' : (i % 3 === 1 ? 'Run' : 'Walk'),
          distance: Math.random() * 50000,
          moving_time: Math.random() * 7200,
          total_elevation_gain: Math.random() * 1500,
          start_date: new Date(2024, 0, 1 + (i % 365)).toISOString()
        });
      }

      const startTime = Date.now();
      
      // Apply complex filtering and sorting
      const filtered = filterActivities(largeDataset, {
        activity_types: ['Ride', 'Run'],
        min_distance: 5000,
        max_distance: 40000
      });
      
      const sorted = sortActivities(filtered, 'distance', 'desc');
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      console.log(`   Performance test: Processed ${largeDataset.length} activities in ${executionTime}ms`);
      
      return executionTime < 1000 && // Should complete within 1 second
             Array.isArray(sorted) &&
             sorted.length > 0;
    });
  }

  // Run all tests
  async runAllTests() {
    console.log('🧪 Starting Activity Filtering Test Suite...\n');

    this.testQueryValidation();
    this.testActivityTypeFiltering();
    this.testDistanceFiltering();
    this.testElevationFiltering();
    this.testDurationFiltering();
    this.testNameFiltering();
    this.testComplexFiltering();
    this.testSorting();
    this.testStravaApiParams();
    this.testFilterSummary();
    this.testEdgeCases();
    this.testPerformance();

    console.log(`\n📊 Test Results:`);
    console.log(`   Total Tests: ${this.testResults.totalTests}`);
    console.log(`   Passed: ${this.testResults.passedTests}`);
    console.log(`   Failed: ${this.testResults.failedTests}`);
    console.log(`   Success Rate: ${((this.testResults.passedTests / this.testResults.totalTests) * 100).toFixed(1)}%`);

    if (this.testResults.failedTests > 0) {
      console.log(`\n❌ Failed Tests:`);
      this.testResults.testDetails
        .filter(test => test.status === 'FAIL')
        .forEach(test => {
          console.log(`   - ${test.name}: ${test.message}`);
        });
    }

    return {
      success: this.testResults.failedTests === 0,
      results: this.testResults
    };
  }
}

// Browser compatibility test function
function testBrowserCompatibility() {
  console.log('\n🌐 Browser Compatibility Tests (Manual verification required):');
  console.log('   ✓ ES6 features used: const, let, arrow functions, template literals');
  console.log('   ✓ Array methods: filter, map, sort, every, includes');
  console.log('   ✓ Date API: new Date(), getTime(), toISOString()');
  console.log('   ✓ URLSearchParams API usage for query building');
  console.log('   ✓ No Node.js specific APIs in filtering utilities');
  console.log('   → Manual testing recommended in Chrome, Firefox, Safari, and Edge');
}

// Export for use in other test files or standalone execution
module.exports = ActivityFilteringTest;

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new ActivityFilteringTest();
  tester.runAllTests().then(result => {
    testBrowserCompatibility();
    process.exit(result.success ? 0 : 1);
  });
}