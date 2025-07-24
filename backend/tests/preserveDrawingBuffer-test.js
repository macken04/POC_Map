/**
 * Test to verify preserveDrawingBuffer configuration is working correctly
 * Tests both frontend MapboxConfig and backend MapService implementations
 */

const config = require('../config');

class PreserveDrawingBufferTest {
  constructor() {
    this.config = config.getConfig();
    this.testResults = [];
  }

  /**
   * Test preserveDrawingBuffer in MapboxConfig default options
   */
  testMapboxConfig() {
    console.log('🧪 Testing MapboxConfig preserveDrawingBuffer configuration...\n');

    try {
      // Read the mapbox-config.js file to verify preserveDrawingBuffer is set
      const fs = require('fs');
      const path = require('path');
      const configPath = path.join(__dirname, '../../shopify-theme/dawn/assets/mapbox-config.js');
      
      if (!fs.existsSync(configPath)) {
        throw new Error('mapbox-config.js not found');
      }
      
      const configContent = fs.readFileSync(configPath, 'utf8');
      
      // Check if preserveDrawingBuffer is set to true in defaultOptions
      const hasPreserveDrawingBuffer = configContent.includes('preserveDrawingBuffer: true');
      const isInDefaultOptions = configContent.includes('defaultOptions: {') && 
                                 configContent.indexOf('preserveDrawingBuffer: true') > 
                                 configContent.indexOf('defaultOptions: {');
      
      console.log('📋 MapboxConfig Analysis:');
      console.log(`   preserveDrawingBuffer found: ${hasPreserveDrawingBuffer ? '✅' : '❌'}`);
      console.log(`   In defaultOptions: ${isInDefaultOptions ? '✅' : '❌'}`);
      
      // Check if it's also in export options
      const hasExportPreserveDrawingBuffer = configContent.includes('getExportMapOptions') &&
                                           configContent.includes('preserveDrawingBuffer: true');
      console.log(`   In export options: ${hasExportPreserveDrawingBuffer ? '✅' : '❌'}`);
      
      this.testResults.push({
        test: 'MapboxConfig preserveDrawingBuffer',
        passed: hasPreserveDrawingBuffer && isInDefaultOptions,
        details: {
          hasPreserveDrawingBuffer,
          isInDefaultOptions,
          hasExportPreserveDrawingBuffer
        }
      });
      
      console.log(`\n🎯 MapboxConfig Test: ${hasPreserveDrawingBuffer && isInDefaultOptions ? '✅ PASS' : '❌ FAIL'}\n`);
      
    } catch (error) {
      console.error('❌ MapboxConfig test failed:', error.message);
      this.testResults.push({
        test: 'MapboxConfig preserveDrawingBuffer',
        passed: false,
        error: error.message
      });
    }
  }

  /**
   * Test preserveDrawingBuffer in backend MapService HTML generation
   */
  testMapServiceHTML() {
    console.log('🧪 Testing MapService HTML preserveDrawingBuffer configuration...\n');

    try {
      // Read the mapService.js file to verify preserveDrawingBuffer is set
      const fs = require('fs');
      const path = require('path');
      const servicePath = path.join(__dirname, '../services/mapService.js');
      
      if (!fs.existsSync(servicePath)) {
        throw new Error('mapService.js not found');
      }
      
      const serviceContent = fs.readFileSync(servicePath, 'utf8');
      
      // Check if preserveDrawingBuffer is set in the HTML template
      const hasPreserveDrawingBuffer = serviceContent.includes('preserveDrawingBuffer: true');
      const isInMapCreation = serviceContent.includes('new mapboxgl.Map') &&
                             serviceContent.indexOf('preserveDrawingBuffer: true') > 0;
      
      console.log('📋 MapService Analysis:');
      console.log(`   preserveDrawingBuffer found: ${hasPreserveDrawingBuffer ? '✅' : '❌'}`);
      console.log(`   In map creation: ${isInMapCreation ? '✅' : '❌'}`);
      
      // Check for interactive: false (needed for export)
      const hasInteractiveFalse = serviceContent.includes('interactive: false');
      console.log(`   interactive: false found: ${hasInteractiveFalse ? '✅' : '❌'}`);
      
      this.testResults.push({
        test: 'MapService preserveDrawingBuffer',
        passed: hasPreserveDrawingBuffer && hasInteractiveFalse,
        details: {
          hasPreserveDrawingBuffer,
          isInMapCreation,
          hasInteractiveFalse
        }
      });
      
      console.log(`\n🎯 MapService Test: ${hasPreserveDrawingBuffer && hasInteractiveFalse ? '✅ PASS' : '❌ FAIL'}\n`);
      
    } catch (error) {
      console.error('❌ MapService test failed:', error.message);
      this.testResults.push({
        test: 'MapService preserveDrawingBuffer',
        passed: false,
        error: error.message
      });
    }
  }

  /**
   * Test HighResMapExporter configuration
   */
  testHighResMapExporter() {
    console.log('🧪 Testing HighResMapExporter preserveDrawingBuffer validation...\n');

    try {
      // Read the high-res-map-exporter.js file
      const fs = require('fs');
      const path = require('path');
      const exporterPath = path.join(__dirname, '../../shopify-theme/dawn/assets/high-res-map-exporter.js');
      
      if (!fs.existsSync(exporterPath)) {
        throw new Error('high-res-map-exporter.js not found');
      }
      
      const exporterContent = fs.readFileSync(exporterPath, 'utf8');
      
      // Check if it validates preserveDrawingBuffer
      const hasPreserveDrawingBufferCheck = exporterContent.includes('preserveDrawingBuffer');
      const hasCanvasAccessValidation = exporterContent.includes('getCanvas()') || 
                                       exporterContent.includes('map.getCanvas');
      const hasValidationMethod = exporterContent.includes('validateConfiguration');
      
      console.log('📋 HighResMapExporter Analysis:');
      console.log(`   preserveDrawingBuffer references: ${hasPreserveDrawingBufferCheck ? '✅' : '❌'}`);
      console.log(`   Canvas access validation: ${hasCanvasAccessValidation ? '✅' : '❌'}`);
      console.log(`   Has validation method: ${hasValidationMethod ? '✅' : '❌'}`);
      
      this.testResults.push({
        test: 'HighResMapExporter preserveDrawingBuffer',
        passed: hasPreserveDrawingBufferCheck && hasCanvasAccessValidation && hasValidationMethod,
        details: {
          hasPreserveDrawingBufferCheck,
          hasCanvasAccessValidation,
          hasValidationMethod
        }
      });
      
      console.log(`\n🎯 HighResMapExporter Test: ${hasPreserveDrawingBufferCheck && hasCanvasAccessValidation && hasValidationMethod ? '✅ PASS' : '❌ FAIL'}\n`);
      
    } catch (error) {
      console.error('❌ HighResMapExporter test failed:', error.message);
      this.testResults.push({
        test: 'HighResMapExporter preserveDrawingBuffer',
        passed: false,
        error: error.message
      });
    }
  }

  /**
   * Run all preserveDrawingBuffer tests
   */
  runAllTests() {
    console.log('🎯 preserveDrawingBuffer Configuration Validation\n');
    console.log('==================================================\n');

    this.testMapboxConfig();
    this.testMapServiceHTML();
    this.testHighResMapExporter();

    // Summary
    console.log('==================================================');
    console.log('📊 Test Summary:\n');
    
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(result => result.passed).length;
    const failedTests = totalTests - passedTests;
    
    this.testResults.forEach(result => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`   ${status}: ${result.test}`);
      if (result.error) {
        console.log(`      Error: ${result.error}`);
      }
    });
    
    console.log(`\nTotal Tests: ${totalTests}`);
    console.log(`✅ Passed: ${passedTests}`);
    console.log(`❌ Failed: ${failedTests}`);
    console.log(`📈 Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    
    if (passedTests === totalTests) {
      console.log('\n🎉 All preserveDrawingBuffer tests passed!');
      console.log('✅ Configuration is ready for high-resolution export');
    } else {
      console.log('\n⚠️  Some preserveDrawingBuffer tests failed');
      console.log('❌ Configuration needs attention before export will work');
    }
    
    return passedTests === totalTests;
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new PreserveDrawingBufferTest();
  const allPassed = tester.runAllTests();
  process.exit(allPassed ? 0 : 1);
}

module.exports = PreserveDrawingBufferTest;