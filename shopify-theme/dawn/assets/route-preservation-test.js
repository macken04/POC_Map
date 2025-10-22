/**
 * Route Preservation Test Suite
 * 
 * Tests the route preservation functionality when map styles are changed.
 * This script can be run in the browser console to test the implementation.
 */

class RoutePreservationTest {
  constructor() {
    this.testResults = [];
    this.mapIntegration = null;
    this.testRouteData = this.generateTestRouteData();
  }

  /**
   * Generate test route data for Dublin
   */
  generateTestRouteData() {
    return {
      coordinates: [
        [-6.2603, 53.3498], // Dublin city center
        [-6.2588, 53.3495], // Trinity College
        [-6.2575, 53.3481], // St. Stephen's Green
        [-6.2547, 53.3472], // Grafton Street area
        [-6.2518, 53.3463], // Dublin Castle area
        [-6.2489, 53.3454], // Christ Church Cathedral
        [-6.2467, 53.3445], // Dublin Bay area
      ],
      stats: {
        distance: 1200, // meters
        duration: 900, // seconds
        elevationGain: 50 // meters
      },
      metadata: {
        name: 'Dublin City Test Route',
        activity: 'walking'
      }
    };
  }

  /**
   * Initialize test environment
   */
  async initializeTest() {
    console.log('🧪 RoutePreservationTest: Initializing test environment...');
    
    try {
      // Check if MapboxIntegration is available
      if (typeof MapboxIntegration === 'undefined') {
        throw new Error('MapboxIntegration class not found');
      }

      // Create map integration instance
      this.mapIntegration = new MapboxIntegration('map-container');
      await this.mapIntegration.init();

      console.log('✅ Test environment initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize test environment:', error);
      return false;
    }
  }

  /**
   * Test 1: Basic route rendering
   */
  async testBasicRouteRendering() {
    console.log('🧪 Test 1: Basic route rendering...');

    try {
      await this.mapIntegration.renderRouteMap(this.testRouteData, {
        routeColor: '#FF0000',
        routeWidth: 4,
        showStartEndMarkers: true
      });

      // Verify route was rendered
      const routeState = this.mapIntegration.getCurrentRouteState();
      if (!routeState || !routeState.hasRoute) {
        throw new Error('Route was not rendered successfully');
      }

      console.log('✅ Test 1 PASSED: Route rendered successfully');
      this.testResults.push({ test: 'Basic Route Rendering', status: 'PASSED' });
      return true;
    } catch (error) {
      console.error('❌ Test 1 FAILED:', error);
      this.testResults.push({ test: 'Basic Route Rendering', status: 'FAILED', error: error.message });
      return false;
    }
  }

  /**
   * Test 2: Route state capture
   */
  async testRouteStateCapture() {
    console.log('🧪 Test 2: Route state capture...');

    try {
      const routeState = this.mapIntegration.getCurrentRouteState();
      
      // Validate captured state
      if (!routeState) {
        throw new Error('No route state captured');
      }

      if (!routeState.hasRoute) {
        throw new Error('Route state indicates no route present');
      }

      if (!routeState.coordinates || routeState.coordinates.length === 0) {
        throw new Error('No coordinates in captured route state');
      }

      if (!routeState.customization) {
        throw new Error('No customization data in captured route state');
      }

      console.log('✅ Test 2 PASSED: Route state captured successfully', {
        coordinateCount: routeState.coordinates.length,
        hasCustomization: !!routeState.customization,
        hasAnimation: !!routeState.animation
      });
      
      this.testResults.push({ test: 'Route State Capture', status: 'PASSED' });
      return routeState;
    } catch (error) {
      console.error('❌ Test 2 FAILED:', error);
      this.testResults.push({ test: 'Route State Capture', status: 'FAILED', error: error.message });
      return null;
    }
  }

  /**
   * Test 3: Style change with route preservation
   */
  async testStyleChangeWithPreservation() {
    console.log('🧪 Test 3: Style change with route preservation...');

    try {
      // Capture state before style change
      const stateBefore = this.mapIntegration.getCurrentRouteState();
      if (!stateBefore) {
        throw new Error('No route state available before style change');
      }

      console.log('State before style change:', {
        coordinateCount: stateBefore.coordinates.length,
        routeColor: stateBefore.customization.routeColor
      });

      // Change style from 'grey' to 'outdoors'
      await this.mapIntegration.setStyle('outdoors');

      // Wait a moment for restoration to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Capture state after style change
      const stateAfter = this.mapIntegration.getCurrentRouteState();
      if (!stateAfter) {
        throw new Error('No route state available after style change');
      }

      console.log('State after style change:', {
        coordinateCount: stateAfter.coordinates.length,
        routeColor: stateAfter.customization.routeColor
      });

      // Validate that route was preserved
      if (stateAfter.coordinates.length !== stateBefore.coordinates.length) {
        throw new Error(`Coordinate count mismatch: before=${stateBefore.coordinates.length}, after=${stateAfter.coordinates.length}`);
      }

      if (stateAfter.customization.routeColor !== stateBefore.customization.routeColor) {
        console.warn('Route color changed during style preservation');
      }

      console.log('✅ Test 3 PASSED: Route preserved during style change');
      this.testResults.push({ test: 'Style Change Preservation', status: 'PASSED' });
      return true;
    } catch (error) {
      console.error('❌ Test 3 FAILED:', error);
      this.testResults.push({ test: 'Style Change Preservation', status: 'FAILED', error: error.message });
      return false;
    }
  }

  /**
   * Test 4: Multiple style changes
   */
  async testMultipleStyleChanges() {
    console.log('🧪 Test 4: Multiple style changes...');

    const styles = ['streets', 'satellite', 'outdoors', 'grey'];
    
    try {
      const initialState = this.mapIntegration.getCurrentRouteState();
      if (!initialState) {
        throw new Error('No initial route state for multiple style test');
      }

      for (const style of styles) {
        console.log(`Changing to style: ${style}`);
        await this.mapIntegration.setStyle(style);
        
        // Wait for restoration
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const currentState = this.mapIntegration.getCurrentRouteState();
        if (!currentState || !currentState.hasRoute) {
          throw new Error(`Route lost during style change to ${style}`);
        }

        if (currentState.coordinates.length !== initialState.coordinates.length) {
          throw new Error(`Coordinate count changed during ${style} style change`);
        }
      }

      console.log('✅ Test 4 PASSED: Route preserved through multiple style changes');
      this.testResults.push({ test: 'Multiple Style Changes', status: 'PASSED' });
      return true;
    } catch (error) {
      console.error('❌ Test 4 FAILED:', error);
      this.testResults.push({ test: 'Multiple Style Changes', status: 'FAILED', error: error.message });
      return false;
    }
  }

  /**
   * Test 5: Route validation
   */
  async testRouteValidation() {
    console.log('🧪 Test 5: Route validation...');

    try {
      const currentState = this.mapIntegration.getCurrentRouteState();
      if (!currentState) {
        throw new Error('No route state for validation test');
      }

      // Test route health check
      const healthCheck = this.mapIntegration.routes.performRouteHealthCheck();
      if (!healthCheck.healthy) {
        throw new Error(`Route health check failed: ${healthCheck.issues.join(', ')}`);
      }

      // Test route restoration validation
      const validation = this.mapIntegration.routes.validateRouteRestoration(currentState);
      if (!validation.success) {
        throw new Error(`Route validation failed: ${validation.errors.join(', ')}`);
      }

      console.log('✅ Test 5 PASSED: Route validation successful', {
        healthStatus: healthCheck.status,
        validationWarnings: validation.warnings.length
      });
      
      this.testResults.push({ test: 'Route Validation', status: 'PASSED' });
      return true;
    } catch (error) {
      console.error('❌ Test 5 FAILED:', error);
      this.testResults.push({ test: 'Route Validation', status: 'FAILED', error: error.message });
      return false;
    }
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('🚀 Starting Route Preservation Test Suite...');
    
    const initialized = await this.initializeTest();
    if (!initialized) {
      console.error('❌ Cannot run tests - initialization failed');
      return;
    }

    // Wait for map to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Run tests sequentially
    await this.testBasicRouteRendering();
    await this.testRouteStateCapture();
    await this.testStyleChangeWithPreservation();
    await this.testMultipleStyleChanges();
    await this.testRouteValidation();

    // Print results
    this.printTestResults();
  }

  /**
   * Print test results summary
   */
  printTestResults() {
    console.log('\n📊 Test Results Summary:');
    console.log('========================');
    
    let passedCount = 0;
    let failedCount = 0;

    this.testResults.forEach((result, index) => {
      const status = result.status === 'PASSED' ? '✅' : '❌';
      console.log(`${index + 1}. ${result.test}: ${status} ${result.status}`);
      
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }

      result.status === 'PASSED' ? passedCount++ : failedCount++;
    });

    console.log('========================');
    console.log(`Total Tests: ${this.testResults.length}`);
    console.log(`Passed: ${passedCount}`);
    console.log(`Failed: ${failedCount}`);
    console.log(`Success Rate: ${Math.round((passedCount / this.testResults.length) * 100)}%`);

    if (failedCount === 0) {
      console.log('🎉 All tests passed! Route preservation is working correctly.');
    } else {
      console.log('⚠️  Some tests failed. Please review the implementation.');
    }
  }

  /**
   * Quick test - just basic functionality
   */
  async quickTest() {
    console.log('⚡ Running quick route preservation test...');
    
    const initialized = await this.initializeTest();
    if (!initialized) return;

    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const routeRendered = await this.testBasicRouteRendering();
    if (!routeRendered) return;

    const styleChangeWorked = await this.testStyleChangeWithPreservation();
    
    if (styleChangeWorked) {
      console.log('🎉 Quick test PASSED - Route preservation is working!');
    } else {
      console.log('❌ Quick test FAILED - Route preservation needs attention');
    }
  }
}

// Export for use
window.RoutePreservationTest = RoutePreservationTest;

// Auto-run if this script is loaded in browser
if (typeof window !== 'undefined' && window.location) {
  console.log('Route Preservation Test Suite loaded. Run tests with:');
  console.log('const test = new RoutePreservationTest();');
  console.log('test.runAllTests(); // Full test suite');
  console.log('test.quickTest(); // Quick test');
}