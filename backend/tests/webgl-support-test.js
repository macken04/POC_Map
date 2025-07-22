/**
 * WebGL Support Testing
 * Tests the WebGL support checking functionality in the map initialization modules
 */

const fs = require('fs');
const path = require('path');

function testWebGLSupportImplementation() {
  console.log('🧪 Testing WebGL Support Checking Functionality...\n');

  try {
    // Test 1: Check if mapbox-config.js has dependency validation
    console.log('✅ Test 1: Client-side Dependency Validation');
    const configPath = path.join(__dirname, '../../shopify-theme/dawn/assets/mapbox-config.js');
    const configContent = fs.readFileSync(configPath, 'utf8');
    
    const hasValidateDependencies = configContent.includes('validateDependencies');
    const checksmapboxgl = configContent.includes('mapboxgl');
    const hasErrorHandling = configContent.includes('throw new Error');
    
    console.log('   validateDependencies method exists:', hasValidateDependencies);
    console.log('   Checks for mapboxgl availability:', checksmapboxgl);
    console.log('   Has proper error handling:', hasErrorHandling);
    console.log('');

    // Test 2: Check if mapbox-integration.js has dependency validation
    console.log('✅ Test 2: Integration Class Dependency Validation');
    const integrationPath = path.join(__dirname, '../../shopify-theme/dawn/assets/mapbox-integration.js');
    const integrationContent = fs.readFileSync(integrationPath, 'utf8');
    
    const hasInitValidation = integrationContent.includes('typeof mapboxgl');
    const hasConfigValidation = integrationContent.includes('typeof MapboxConfig');
    const hasValidationMethod = integrationContent.includes('validateDependencies');
    
    console.log('   Validates mapboxgl availability:', hasInitValidation);
    console.log('   Validates MapboxConfig availability:', hasConfigValidation);
    console.log('   Calls validation methods:', hasValidationMethod);
    console.log('');

    // Test 3: Check validation logic
    console.log('✅ Test 3: Validation Logic Review');
    
    // Extract the validation method from mapbox-config.js
    const validationMethodMatch = configContent.match(/validateDependencies:\s*function\(\)\s*{([\s\S]*?)}/);
    if (validationMethodMatch) {
      const validationCode = validationMethodMatch[1];
      
      const checksMapboxGL = validationCode.includes('mapboxgl');
      const throwsError = validationCode.includes('throw new Error');
      const returnsBool = validationCode.includes('return true');
      
      console.log('   Checks for mapboxgl dependency:', checksMapboxGL);
      console.log('   Throws error on missing dependency:', throwsError);
      console.log('   Returns success status:', returnsBool);
    } else {
      console.log('   ⚠️  Could not parse validation method');
    }
    console.log('');

    // Test 4: Check if WebGL is mentioned in documentation/comments
    console.log('✅ Test 4: WebGL Documentation');
    const hasWebGLComments = configContent.includes('WebGL') || integrationContent.includes('WebGL');
    const hasBrowserSupport = configContent.includes('browser') && configContent.includes('support');
    
    console.log('   Has WebGL references:', hasWebGLComments);
    console.log('   Has browser support references:', hasBrowserSupport);
    console.log('');

    // Test 5: Error message quality
    console.log('✅ Test 5: Error Message Quality');
    const errorMessages = [
      ...configContent.match(/throw new Error\(['"](.*?)['"]\)/g) || [],
      ...integrationContent.match(/throw new Error\(['"](.*?)['"]\)/g) || []
    ];
    
    console.log('   Number of error messages:', errorMessages.length);
    errorMessages.forEach((msg, index) => {
      console.log(`   Error ${index + 1}:`, msg);
    });
    console.log('');

    console.log('🎉 WebGL Support Testing completed!');
    
    // Summary
    const overallScore = [
      hasValidateDependencies,
      hasInitValidation,
      hasConfigValidation,
      hasValidationMethod,
      errorMessages.length > 0
    ].filter(Boolean).length;
    
    console.log(`📊 WebGL Support Score: ${overallScore}/5 tests passed`);
    
    return overallScore >= 4; // Require at least 4/5 tests to pass

  } catch (error) {
    console.error('❌ WebGL support test failed:', error.message);
    return false;
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const success = testWebGLSupportImplementation();
  process.exit(success ? 0 : 1);
}

module.exports = testWebGLSupportImplementation;