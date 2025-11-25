/**
 * Generate Static Map Preview Thumbnails
 *
 * Uses Puppeteer + Mapbox GL JS to create 220×220px thumbnails for all map themes
 * Outputs WebP (primary) + PNG (fallback) formats
 *
 * Usage: node backend/scripts/generate-theme-previews.js
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

// Sample route for consistent previews across all styles
// Using London cycling route for recognizable landmarks
const SAMPLE_ROUTE = {
  type: 'Feature',
  geometry: {
    type: 'LineString',
    coordinates: [
      [-0.118092, 51.509865],
      [-0.116092, 51.510865],
      [-0.114092, 51.511865],
      [-0.112092, 51.512865],
      [-0.110092, 51.513365]
    ]
  }
};

// Theme styles configuration (matching map-design.js)
const THEME_STYLES = {
  street: {
    name: 'Street',
    colors: {
      streets: 'mapbox://styles/mapbox/streets-v11',
      light: 'mapbox://styles/mapbox/light-v10',
      grey: 'mapbox://styles/macken04/cm9qvmy7500hr01s5h4h67lsr'
    }
  },
  classic: {
    name: 'Classic',
    colors: {
      classic: 'mapbox://styles/macken04/cme05849o00eb01sbh2b46dz4',
      grey: 'mapbox://styles/macken04/cmdowoyfi003o01r5h90e8r6l',
      dark: 'mapbox://styles/macken04/cmdowqfh4004h01sb14fe6x3u',
      blue: 'mapbox://styles/macken04/cmdowyoil001d01sh5937dt1p',
      orange: 'mapbox://styles/macken04/cmdowyoaj004i01sb9i27ene8',
      pink: 'mapbox://styles/macken04/cme063epj00rq01pjamus26ma'
    }
  },
  minimal: {
    name: 'Minimal',
    colors: {
      dark: 'mapbox://styles/macken04/cm9mvpjc8010b01quegchbmov',
      pink: 'mapbox://styles/macken04/cm9mvpk4s010c01qu4jzgccqt',
      grey: 'mapbox://styles/macken04/cm9mvpjxz001q01pgco8gefok',
      sand: 'mapbox://styles/macken04/cm9mvpjrw001801s5d2xv8t27',
      sage: 'mapbox://styles/macken04/cm9mvpjj0006y01qsckitaoib'
    }
  },
  bubble: {
    name: 'Bubble',
    colors: {
      bubble: 'mapbox://styles/macken04/cmdpqgs5y00av01qs9jat5xu9'
    }
  },
  satellite: {
    name: 'Satellite',
    colors: {
      satellite: 'mapbox://styles/mapbox/satellite-v9',
      streets: 'mapbox://styles/mapbox/satellite-streets-v11'
    }
  },
  terrain: {
    name: 'Terrain',
    colors: {
      outdoors: 'mapbox://styles/mapbox/outdoors-v11'
    }
  }
};

/**
 * Generate preview image for a single theme/color combination
 */
async function generatePreview(browser, themeKey, colorKey, styleUrl, outputPath) {
  const page = await browser.newPage();

  try {
    // Set viewport to 2x resolution for crisp @1x display
    await page.setViewport({ width: 440, height: 440, deviceScaleFactor: 2 });

    // Create HTML with Mapbox GL JS
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <link href="https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css" rel="stylesheet" />
        <script src="https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js"></script>
        <style>
          body { margin: 0; padding: 0; overflow: hidden; }
          #map { position: absolute; top: 0; bottom: 0; width: 100%; height: 100%; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          mapboxgl.accessToken = '${process.env.MAPBOX_ACCESS_TOKEN}';

          const map = new mapboxgl.Map({
            container: 'map',
            style: '${styleUrl}',
            center: [-0.115092, 51.511365],
            zoom: 14,
            preserveDrawingBuffer: true,
            interactive: false,
            attributionControl: false
          });

          map.on('load', () => {
            // Add sample route
            map.addSource('route', {
              type: 'geojson',
              data: ${JSON.stringify(SAMPLE_ROUTE)}
            });

            map.addLayer({
              id: 'route',
              type: 'line',
              source: 'route',
              paint: {
                'line-color': '#ff4444',
                'line-width': 4,
                'line-opacity': 0.9
              }
            });

            // Signal readiness after map and route are rendered
            setTimeout(() => {
              window.previewReady = true;
            }, 1500);
          });

          map.on('error', (error) => {
            console.error('Map error:', error);
            window.previewError = true;
          });
        </script>
      </body>
      </html>
    `;

    await page.setContent(html);

    // Wait for map to be ready (with timeout)
    try {
      await page.waitForFunction(() => window.previewReady === true, {
        timeout: 15000
      });
    } catch (error) {
      // Check if there was a map error
      const hasError = await page.evaluate(() => window.previewError === true);
      if (hasError) {
        throw new Error(`Map rendering failed for ${themeKey}-${colorKey}`);
      }
      throw error;
    }

    // Capture screenshot at 2x resolution
    const screenshot = await page.screenshot({
      type: 'png',
      omitBackground: false
    });

    // Generate WebP (primary format, best compression)
    await sharp(screenshot)
      .resize(220, 220, { fit: 'cover' })
      .webp({ quality: 80, effort: 6 })
      .toFile(outputPath.replace('.png', '.webp'));

    // Generate PNG (fallback format for older browsers)
    await sharp(screenshot)
      .resize(220, 220, { fit: 'cover' })
      .png({ quality: 80, compressionLevel: 9 })
      .toFile(outputPath);

    console.log(`✓ Generated: ${themeKey}-${colorKey}`);

  } catch (error) {
    console.error(`✗ Failed: ${themeKey}-${colorKey}`, error.message);
    throw error;
  } finally {
    await page.close();
  }
}

/**
 * Generate all preview images
 */
async function generateAllPreviews() {
  console.log('🗺️  Mapbox Theme Preview Generator\n');

  // Validate environment
  if (!process.env.MAPBOX_ACCESS_TOKEN) {
    console.error('❌ Error: MAPBOX_ACCESS_TOKEN not found in .env file');
    console.error('   Please add your Mapbox access token to the .env file');
    process.exit(1);
  }

  // Create output directory
  const outputDir = path.join(__dirname, '../../shopify-theme/dawn/assets/preview-images');
  try {
    await fs.mkdir(outputDir, { recursive: true });
    console.log(`📁 Output directory: ${outputDir}\n`);
  } catch (error) {
    console.error('❌ Error creating output directory:', error);
    process.exit(1);
  }

  // Launch browser
  console.log('🚀 Launching headless browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  let successCount = 0;
  let failCount = 0;
  const totalCount = Object.values(THEME_STYLES).reduce(
    (sum, theme) => sum + Object.keys(theme.colors).length,
    0
  );

  console.log(`📸 Generating ${totalCount} preview images...\n`);

  // Generate previews for each theme and color
  for (const [themeKey, themeData] of Object.entries(THEME_STYLES)) {
    console.log(`\n📦 Processing ${themeData.name} theme...`);

    for (const [colorKey, styleUrl] of Object.entries(themeData.colors)) {
      const filename = `${themeKey}-${colorKey}.png`;
      const outputPath = path.join(outputDir, filename);

      try {
        await generatePreview(browser, themeKey, colorKey, styleUrl, outputPath);
        successCount++;
      } catch (error) {
        failCount++;
        // Continue with other previews even if one fails
      }
    }
  }

  await browser.close();

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Generation Summary:');
  console.log(`   ✓ Successful: ${successCount}/${totalCount}`);
  console.log(`   ✗ Failed: ${failCount}/${totalCount}`);
  console.log(`   📁 Location: ${outputDir}`);

  // Calculate total size
  try {
    const files = await fs.readdir(outputDir);
    let totalSize = 0;
    for (const file of files) {
      const stats = await fs.stat(path.join(outputDir, file));
      totalSize += stats.size;
    }
    console.log(`   📦 Total size: ${(totalSize / 1024).toFixed(2)} KB`);
  } catch (error) {
    // Ignore size calculation errors
  }

  console.log('='.repeat(50) + '\n');

  if (failCount > 0) {
    console.log('⚠️  Some previews failed to generate. Check errors above.');
    process.exit(1);
  } else {
    console.log('✅ All previews generated successfully!');
    console.log('   You can now use these images in your Shopify theme.\n');
  }
}

// Run the script
if (require.main === module) {
  generateAllPreviews()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('\n❌ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { generateAllPreviews, generatePreview };
