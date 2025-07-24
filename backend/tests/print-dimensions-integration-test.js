/**
 * Print Dimensions Integration Test
 * Tests the enhanced print dimensions in the context of actual map generation
 * This test verifies that the new orientation and format options work end-to-end
 */

const path = require('path');
const fs = require('fs').promises;
const mapService = require('../services/mapService');

console.log('Print Dimensions Integration Test');
console.log('================================\n');

async function runIntegrationTest() {
    try {
        console.log('1. Initializing MapService...');
        await mapService.initialize();
        console.log('✓ MapService initialized');

        // Sample route coordinates (a simple square route)
        const sampleRoute = [
            [53.3498, -6.2603], // Dublin area
            [53.3598, -6.2603],
            [53.3598, -6.2503], 
            [53.3498, -6.2503],
            [53.3498, -6.2603]  // Back to start
        ];

        const bounds = {
            north: 53.3598,
            south: 53.3498,
            east: -6.2503,
            west: -6.2603
        };

        const center = [53.3548, -6.2553];

        // Test cases with different formats and orientations
        const testCases = [
            { format: 'A4', orientation: 'portrait', desc: 'A4 Portrait' },
            { format: 'A4', orientation: 'landscape', desc: 'A4 Landscape' },
            { format: 'A3', orientation: 'landscape', desc: 'A3 Landscape' },
            { format: 'SQUARE_SMALL', orientation: 'portrait', desc: 'Square Small' },
            { format: 'WIDESCREEN_16_9', orientation: 'landscape', desc: 'Widescreen 16:9' }
        ];

        console.log('\n2. Testing map generation with different formats and orientations:');

        for (const testCase of testCases) {
            try {
                console.log(`\n   Testing ${testCase.desc}...`);
                
                // Get dimensions for this test case
                const dimensions = mapService.getPrintDimensions(testCase.format, testCase.orientation);
                console.log(`   Expected dimensions: ${dimensions.width}x${dimensions.height}px`);

                // Create map options
                const mapOptions = {
                    routeCoordinates: sampleRoute,
                    bounds: bounds,
                    center: center,
                    format: testCase.format,
                    orientation: testCase.orientation,
                    style: 'outdoors-v11',
                    routeColor: '#FF4444',
                    routeWidth: 4,
                    showStartEnd: true,
                    title: `Test Map - ${testCase.desc}`,
                    outputPath: path.join(__dirname, `test-output-${testCase.format.toLowerCase()}-${testCase.orientation}.png`)
                };

                // Validate options first
                mapService.validateMapOptions(mapOptions);
                console.log('   ✓ Options validation passed');

                // Generate the map (this will create the actual image)
                console.log('   Generating map image...');
                const screenshot = await mapService.generateMap(mapOptions);
                
                if (screenshot && screenshot.length > 0) {
                    console.log(`   ✓ Map generated successfully (${screenshot.length} bytes)`);
                    
                    // Verify file was created
                    try {
                        const stats = await fs.stat(mapOptions.outputPath);
                        console.log(`   ✓ File saved: ${stats.size} bytes`);
                    } catch (error) {
                        console.log('   ⚠ File not found (normal for preview mode)');
                    }
                } else {
                    console.error(`   ✗ Map generation failed - no screenshot data`);
                }

            } catch (error) {
                console.error(`   ✗ Failed to generate ${testCase.desc}: ${error.message}`);
            }
        }

        console.log('\n3. Testing batch generation with mixed formats:');
        
        const batchOptions = [
            {
                routeCoordinates: sampleRoute,
                bounds: bounds,
                center: center,
                format: 'A4',
                orientation: 'portrait',
                title: 'Batch Test 1'
            },
            {
                routeCoordinates: sampleRoute,
                bounds: bounds,
                center: center,
                format: 'A4',
                orientation: 'landscape', 
                title: 'Batch Test 2'
            }
        ];

        try {
            const batchResults = await mapService.generateBatch(batchOptions);
            console.log(`✓ Batch generation completed: ${batchResults.length} results`);
            
            batchResults.forEach((result, index) => {
                if (result.success) {
                    console.log(`   ✓ Batch item ${index + 1}: Success (${result.data.length} bytes)`);
                } else {
                    console.error(`   ✗ Batch item ${index + 1}: Failed - ${result.error}`);
                }
            });
        } catch (error) {
            console.error(`✗ Batch generation failed: ${error.message}`);
        }

        console.log('\n4. Testing preview generation:');
        try {
            const previewOptions = {
                routeCoordinates: sampleRoute,
                bounds: bounds,
                center: center,
                format: 'A3', // This will be overridden by preview dimensions
                orientation: 'landscape',
                title: 'Preview Test'
            };

            const preview = await mapService.generatePreview(previewOptions);
            if (preview && preview.length > 0) {
                console.log(`✓ Preview generated successfully (${preview.length} bytes)`);
            } else {
                console.error('✗ Preview generation failed');
            }
        } catch (error) {
            console.error(`✗ Preview generation failed: ${error.message}`);
        }

        console.log('\n5. Testing error handling with invalid formats:');
        
        const invalidTestCases = [
            { format: 'INVALID_FORMAT', orientation: 'portrait', desc: 'Invalid format' },
            { format: 'A4', orientation: 'diagonal', desc: 'Invalid orientation' },
            { format: '', orientation: 'portrait', desc: 'Empty format' }
        ];

        for (const testCase of invalidTestCases) {
            try {
                const mapOptions = {
                    routeCoordinates: sampleRoute,
                    bounds: bounds,
                    center: center,
                    format: testCase.format,
                    orientation: testCase.orientation,
                    title: testCase.desc
                };

                mapService.validateMapOptions(mapOptions);
                console.error(`✗ Should have rejected ${testCase.desc}`);
            } catch (error) {
                console.log(`✓ Correctly rejected ${testCase.desc}: ${error.message}`);
            }
        }

        console.log('\n6. Testing service status after operations:');
        const finalStatus = await mapService.getStatus();
        console.log('✓ Final service status:');
        console.log(`    Initialized: ${finalStatus.initialized}`);
        console.log(`    Browser connected: ${finalStatus.browserConnected}`);
        console.log(`    Supported formats: ${finalStatus.supportedFormats.length} formats`);

    } catch (error) {
        console.error('Integration test failed:', error);
    } finally {
        // Cleanup
        console.log('\n7. Cleaning up...');
        try {
            await mapService.cleanup();
            console.log('✓ MapService cleaned up');
        } catch (error) {
            console.warn('Cleanup warning:', error.message);
        }

        // Clean up test files
        const testFiles = [
            'test-output-a4-portrait.png',
            'test-output-a4-landscape.png', 
            'test-output-a3-landscape.png',
            'test-output-square_small-portrait.png',
            'test-output-widescreen_16_9-landscape.png'
        ];

        for (const file of testFiles) {
            try {
                await fs.unlink(path.join(__dirname, file));
                console.log(`✓ Cleaned up ${file}`);
            } catch (error) {
                // File doesn't exist, which is fine
            }
        }
    }
}

console.log('================================');
console.log('Starting integration test...');
console.log('This test requires a valid Mapbox token in config.');
console.log('================================\n');

runIntegrationTest().then(() => {
    console.log('\n================================');
    console.log('Integration test completed');
    console.log('================================');
}).catch(error => {
    console.error('\n================================');
    console.error('Integration test failed:', error);
    console.error('================================');
});