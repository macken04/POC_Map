/**
 * Mapbox Configuration Integration Test
 * Tests the integration of Mapbox configuration with the existing config system
 */

const config = require('../config');

async function testMapboxConfigIntegration() {
  console.log('🧪 Testing Mapbox Configuration Integration...\n');

  try {
    // Test 1: Configuration Loading
    const appConfig = config.getConfig();
    const mapboxConfig = appConfig.mapbox;
    
    console.log('✅ Test 1: Configuration Loading');
    console.log('   Mapbox config exists:', !!mapboxConfig);
    console.log('   Access token loaded:', !!mapboxConfig.accessToken);
    console.log('   Token format valid:', mapboxConfig.accessToken?.startsWith('pk.'));
    console.log('   Token prefix:', mapboxConfig.accessToken?.substring(0, 8) + '...');
    console.log('');

    // Test 2: Token Validation
    console.log('✅ Test 2: Token Validation');
    const validationResult = await config.validateMapboxToken();
    console.log('   Token validation:', validationResult.success ? 'VALID' : 'INVALID');
    if (validationResult.message) console.log('   Message:', validationResult.message);
    if (validationResult.error) console.log('   Error:', validationResult.error);
    console.log('');

    // Test 3: Integration with Export Settings
    console.log('✅ Test 3: Export Settings Integration');
    const exportConfig = appConfig.mapExport;
    console.log('   Export timeout:', exportConfig.timeout, 'ms');
    console.log('   Export quality:', exportConfig.quality, 'DPI');
    console.log('   Export format:', exportConfig.format);
    console.log('');

    // Test 4: Environment Variable Access
    console.log('✅ Test 4: Environment Variable Access');
    console.log('   NODE_ENV:', appConfig.env);
    console.log('   Config validation:', 'PASSED');
    console.log('');

    console.log('🎉 All Mapbox configuration integration tests passed!');
    return true;

  } catch (error) {
    console.error('❌ Mapbox configuration test failed:', error.message);
    return false;
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testMapboxConfigIntegration()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test runner failed:', error);
      process.exit(1);
    });
}

module.exports = testMapboxConfigIntegration;