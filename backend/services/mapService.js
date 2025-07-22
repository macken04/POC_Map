/**
 * Map Service for High-Resolution Export
 * Handles server-side map generation using Mapbox GL JS and Puppeteer
 * Generates 300 DPI print-quality images for A4 and A3 formats
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs').promises;
const config = require('../config');

class MapService {
  constructor() {
    this.appConfig = config.getConfig();
    this.browser = null;
    this.isInitialized = false;
  }

  /**
   * Initialize Puppeteer browser instance
   */
  async initialize() {
    if (this.isInitialized && this.browser && this.browser.isConnected()) {
      return this;
    }

    // Clean up any existing browser instance
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (error) {
        // Ignore cleanup errors
      }
      this.browser = null;
      this.isInitialized = false;
    }

    try {
      console.log('MapService: Initializing Puppeteer browser...');
      
      // Try to launch with minimal configuration first
      const launchOptions = {
        headless: true,
        timeout: 60000,
        defaultViewport: null,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--disable-default-apps',
          '--disable-features=VizDisplayCompositor'
        ]
      };

      // Try to use system Chrome if available (better compatibility on macOS)
      try {
        // First try with executablePath detection
        this.browser = await puppeteer.launch(launchOptions);
      } catch (firstError) {
        console.log('MapService: First launch attempt failed, trying with different configuration...');
        
        // Try with old headless mode
        launchOptions.headless = 'old';
        try {
          this.browser = await puppeteer.launch(launchOptions);
        } catch (secondError) {
          console.log('MapService: Second launch attempt failed, trying with pipe transport...');
          
          // Try with pipe transport (sometimes more stable)
          launchOptions.pipe = true;
          launchOptions.headless = true;
          delete launchOptions.args; // Remove all args for minimal config
          this.browser = await puppeteer.launch(launchOptions);
        }
      }

      // Test connection with a simple operation
      const pages = await this.browser.pages();
      if (pages.length === 0) {
        await this.browser.newPage();
      }

      this.isInitialized = true;
      console.log('MapService: Browser initialized successfully');
      return this;

    } catch (error) {
      console.error('MapService: Failed to initialize browser:', error);
      this.browser = null;
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * Generate high-resolution map image
   */
  async generateMap(mapOptions) {
    const {
      routeCoordinates,
      bounds,
      center,
      format = 'A4',
      style = 'outdoors-v11',
      routeColor = '#FF4444',
      routeWidth = 4,
      showStartEnd = true,
      title = '',
      outputPath
    } = mapOptions;

    // Ensure browser is initialized and connected
    if (!this.browser || !this.browser.isConnected()) {
      await this.initialize();
    }

    let page;
    try {
      page = await this.browser.newPage();
    } catch (error) {
      // If newPage fails, try reinitializing
      console.log('MapService: Failed to create new page, reinitializing browser...');
      await this.initialize();
      page = await this.browser.newPage();
    }

    try {
      console.log(`MapService: Generating ${format} map...`);

      // Set dimensions based on format (300 DPI)
      const dimensions = this.getPrintDimensions(format);
      
      // Set viewport to match print dimensions
      await page.setViewport({
        width: dimensions.width,
        height: dimensions.height,
        deviceScaleFactor: 1 // We'll handle DPI in the HTML
      });

      // Generate HTML for map rendering
      const mapHTML = this.generateMapHTML({
        routeCoordinates,
        bounds,
        center,
        style,
        routeColor,
        routeWidth,
        showStartEnd,
        title,
        dimensions
      });

      // Set page content
      await page.setContent(mapHTML, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      // Wait for map to be fully loaded
      await page.waitForFunction(() => {
        return window.mapLoaded === true;
      }, { timeout: 30000 });

      // Take screenshot
      const screenshot = await page.screenshot({
        type: 'png',
        fullPage: false,
        clip: {
          x: 0,
          y: 0,
          width: dimensions.width,
          height: dimensions.height
        }
      });

      // Save to file if output path provided
      if (outputPath) {
        await fs.writeFile(outputPath, screenshot);
        console.log(`MapService: Map saved to ${outputPath}`);
      }

      console.log(`MapService: ${format} map generated successfully`);
      return screenshot;

    } catch (error) {
      console.error('MapService: Map generation failed:', error);
      throw error;
    } finally {
      await page.close();
    }
  }

  /**
   * Get print dimensions for specific format
   */
  getPrintDimensions(format) {
    const dimensions = {
      A4: { width: 2480, height: 3508 }, // 8.27" x 11.69" at 300 DPI
      A3: { width: 3508, height: 4961 }  // 11.69" x 16.53" at 300 DPI
    };

    const dimension = dimensions[format.toUpperCase()];
    if (!dimension) {
      throw new Error(`Unsupported format: ${format}. Supported formats: A4, A3`);
    }

    return dimension;
  }

  /**
   * Generate HTML content for map rendering
   */
  generateMapHTML(options) {
    const {
      routeCoordinates,
      bounds,
      center,
      style,
      routeColor,
      routeWidth,
      showStartEnd,
      title,
      dimensions
    } = options;

    // Convert coordinates to GeoJSON format
    const routeGeoJSON = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: routeCoordinates.map(coord => [coord[1], coord[0]]) // [lng, lat] for GeoJSON
      }
    };

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Map Export</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <script src='https://api.mapbox.com/mapbox-gl-js/v3.13.0/mapbox-gl.js'></script>
    <link href='https://api.mapbox.com/mapbox-gl-js/v3.13.0/mapbox-gl.css' rel='stylesheet' />
    <style>
        body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
        #map { width: ${dimensions.width}px; height: ${dimensions.height}px; }
        .map-title {
            position: absolute;
            top: 20px;
            left: 20px;
            z-index: 1000;
            background: rgba(255, 255, 255, 0.9);
            padding: 10px 15px;
            border-radius: 4px;
            font-weight: bold;
            font-size: 18px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            max-width: 300px;
            word-wrap: break-word;
        }
        .print-info {
            position: absolute;
            bottom: 10px;
            right: 10px;
            z-index: 1000;
            background: rgba(255, 255, 255, 0.8);
            padding: 5px 10px;
            border-radius: 3px;
            font-size: 10px;
            color: #666;
        }
    </style>
</head>
<body>
    <div id="map"></div>
    ${title ? `<div class="map-title">${title}</div>` : ''}
    <div class="print-info">Generated by Print My Ride • 300 DPI</div>
    
    <script>
        window.mapLoaded = false;
        
        // Mapbox access token
        mapboxgl.accessToken = '${this.appConfig.mapbox.accessToken}';
        
        // Create map
        const map = new mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/mapbox/${style}',
            center: [${center[1]}, ${center[0]}],
            zoom: 12,
            preserveDrawingBuffer: true,
            interactive: false,
            attributionControl: false
        });

        map.on('load', function() {
            // Add route source
            map.addSource('route', {
                type: 'geojson',
                data: ${JSON.stringify(routeGeoJSON)}
            });

            // Add route layer
            map.addLayer({
                id: 'route',
                type: 'line',
                source: 'route',
                layout: {
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                paint: {
                    'line-color': '${routeColor}',
                    'line-width': ${routeWidth}
                }
            });

            ${showStartEnd ? `
            // Add start marker
            const startCoord = ${JSON.stringify(routeCoordinates[0])};
            new mapboxgl.Marker({
                color: '#10B981'
            })
            .setLngLat([startCoord[1], startCoord[0]])
            .addTo(map);

            // Add end marker
            const endCoord = ${JSON.stringify(routeCoordinates[routeCoordinates.length - 1])};
            new mapboxgl.Marker({
                color: '#EF4444'
            })
            .setLngLat([endCoord[1], endCoord[0]])
            .addTo(map);
            ` : ''}

            // Fit to bounds with padding
            const boundsPadding = 50;
            map.fitBounds([
                [${bounds.west}, ${bounds.south}],
                [${bounds.east}, ${bounds.north}]
            ], {
                padding: boundsPadding
            });

            // Mark as loaded after a short delay to ensure rendering is complete
            setTimeout(function() {
                window.mapLoaded = true;
            }, 2000);
        });

        map.on('error', function(e) {
            console.error('Map error:', e);
            window.mapLoaded = true; // Prevent infinite waiting
        });
    </script>
</body>
</html>`;
  }

  /**
   * Generate map preview (lower resolution for quick display)
   */
  async generatePreview(mapOptions) {
    const previewOptions = {
      ...mapOptions,
      format: 'preview' // Custom preview format
    };

    // Override dimensions for preview
    const originalGetDimensions = this.getPrintDimensions;
    this.getPrintDimensions = (format) => {
      if (format === 'preview') {
        return { width: 800, height: 600 };
      }
      return originalGetDimensions.call(this, format);
    };

    try {
      const screenshot = await this.generateMap(previewOptions);
      return screenshot;
    } finally {
      // Restore original method
      this.getPrintDimensions = originalGetDimensions;
    }
  }

  /**
   * Batch generate multiple maps
   */
  async generateBatch(mapOptionsArray) {
    const results = [];
    
    for (const mapOptions of mapOptionsArray) {
      try {
        const screenshot = await this.generateMap(mapOptions);
        results.push({
          success: true,
          data: screenshot,
          options: mapOptions
        });
      } catch (error) {
        results.push({
          success: false,
          error: error.message,
          options: mapOptions
        });
      }
    }

    return results;
  }

  /**
   * Validate map options
   */
  validateMapOptions(mapOptions) {
    const required = ['routeCoordinates', 'bounds', 'center'];
    const missing = required.filter(field => !mapOptions[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    if (!Array.isArray(mapOptions.routeCoordinates) || mapOptions.routeCoordinates.length === 0) {
      throw new Error('routeCoordinates must be a non-empty array');
    }

    if (mapOptions.format && !['A4', 'A3'].includes(mapOptions.format.toUpperCase())) {
      throw new Error('format must be A4 or A3');
    }

    return true;
  }

  /**
   * Get service status and capabilities
   */
  async getStatus() {
    let browserConnected = false;
    
    if (this.browser) {
      try {
        browserConnected = this.browser.isConnected();
        // Additional check by testing if we can get pages
        if (browserConnected) {
          await this.browser.pages();
        }
      } catch (error) {
        browserConnected = false;
        // Reset state if browser connection is broken
        this.isInitialized = false;
        this.browser = null;
      }
    }

    return {
      initialized: this.isInitialized,
      browserConnected,
      supportedFormats: ['A4', 'A3'],
      supportedStyles: [
        'streets-v11',
        'outdoors-v11',
        'satellite-v9',
        'light-v10',
        'dark-v10'
      ]
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.browser) {
      console.log('MapService: Closing browser...');
      try {
        if (this.browser.isConnected()) {
          await this.browser.close();
        }
      } catch (error) {
        console.warn('MapService: Error during browser cleanup:', error.message);
      }
      this.browser = null;
      this.isInitialized = false;
    }
  }
}

// Export singleton instance
const mapService = new MapService();

module.exports = mapService;
module.exports.MapService = MapService;