/**
 * Map Service for High-Resolution Export
 * Handles server-side map generation using Mapbox GL JS and Puppeteer
 * Generates 300 DPI print-quality images for A4 and A3 formats
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs').promises;
const config = require('../config');

/**
 * Resolution Management System
 * Handles scaling between screen and print resolutions, DPI calculations,
 * and quality optimization for different export requirements
 */
class ResolutionManager {
  constructor() {
    // Standard DPI presets
    this.DPI_PRESETS = {
      SCREEN: 72,      // Standard screen resolution
      WEB_HIGH: 96,    // High-density web displays
      PRINT_DRAFT: 150, // Draft quality printing
      PRINT_STANDARD: 300, // Professional print quality
      PRINT_HIGH: 600  // Premium print quality
    };

    // Memory thresholds for different quality levels (in MB)
    this.MEMORY_THRESHOLDS = {
      LOW: 50,      // < 50MB - Use aggressive optimization
      MEDIUM: 200,  // 50-200MB - Standard optimization
      HIGH: 500,    // 200-500MB - Minimal optimization
      EXTREME: 1000 // > 1000MB - Warning threshold
    };

    // Quality settings based on target DPI
    this.QUALITY_SETTINGS = {
      72: { devicePixelRatio: 1, quality: 80, optimization: 'high' },
      96: { devicePixelRatio: 1.33, quality: 85, optimization: 'medium' },
      150: { devicePixelRatio: 2, quality: 90, optimization: 'medium' },
      300: { devicePixelRatio: 3, quality: 95, optimization: 'low' },
      600: { devicePixelRatio: 6, quality: 100, optimization: 'minimal' }
    };
  }

  /**
   * Calculate scaling factor for target DPI
   * @param {number} targetDPI - Desired DPI output
   * @param {number} baseDPI - Base DPI (default: 96 for web)
   * @returns {number} Scaling factor
   */
  calculateScalingFactor(targetDPI, baseDPI = 96) {
    if (!Number.isInteger(targetDPI) || targetDPI <= 0) {
      throw new Error('Target DPI must be a positive integer');
    }
    if (!Number.isInteger(baseDPI) || baseDPI <= 0) {
      throw new Error('Base DPI must be a positive integer');
    }
    
    return Math.round((targetDPI / baseDPI) * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Get quality settings for target DPI
   * @param {number} targetDPI - Target DPI
   * @returns {Object} Quality configuration
   */
  getQualitySettings(targetDPI) {
    // Find closest DPI preset
    const availableDPIs = Object.keys(this.QUALITY_SETTINGS).map(Number).sort((a, b) => a - b);
    let closestDPI = availableDPIs[0];
    
    for (const dpi of availableDPIs) {
      if (Math.abs(dpi - targetDPI) < Math.abs(closestDPI - targetDPI)) {
        closestDPI = dpi;
      }
    }

    const settings = { ...this.QUALITY_SETTINGS[closestDPI] };
    
    // Adjust for exact DPI if not in presets
    if (closestDPI !== targetDPI) {
      settings.devicePixelRatio = this.calculateScalingFactor(targetDPI, 96);
    }

    return {
      ...settings,
      targetDPI,
      actualDPI: Math.round(96 * settings.devicePixelRatio),
      scalingFactor: settings.devicePixelRatio
    };
  }

  /**
   * Calculate memory requirements for given dimensions and DPI
   * @param {number} width - Width in pixels
   * @param {number} height - Height in pixels  
   * @param {number} dpi - Target DPI
   * @returns {Object} Memory estimation
   */
  calculateMemoryRequirements(width, height, dpi) {
    const scalingFactor = this.calculateScalingFactor(dpi, 96);
    const actualWidth = Math.round(width * scalingFactor);
    const actualHeight = Math.round(height * scalingFactor);
    
    // Estimate memory usage: width * height * 4 bytes (RGBA) * buffer multiplier
    const bufferMultiplier = 2.5; // Account for browser overhead and buffers
    const estimatedBytes = actualWidth * actualHeight * 4 * bufferMultiplier;
    const estimatedMB = Math.round(estimatedBytes / (1024 * 1024));

    // Determine optimization level
    let optimizationLevel = 'minimal';
    if (estimatedMB > this.MEMORY_THRESHOLDS.EXTREME) {
      optimizationLevel = 'extreme';
    } else if (estimatedMB > this.MEMORY_THRESHOLDS.HIGH) {
      optimizationLevel = 'high';
    } else if (estimatedMB > this.MEMORY_THRESHOLDS.MEDIUM) {
      optimizationLevel = 'medium';
    } else if (estimatedMB > this.MEMORY_THRESHOLDS.LOW) {
      optimizationLevel = 'low';
    }

    return {
      estimatedMB,
      actualWidth,
      actualHeight,
      scalingFactor,
      optimizationLevel,
      isMemoryIntensive: estimatedMB > this.MEMORY_THRESHOLDS.HIGH,
      recommendTiling: estimatedMB > this.MEMORY_THRESHOLDS.EXTREME
    };
  }

  /**
   * Get DPI preset configurations
   * @returns {Object} Available DPI presets with descriptions
   */
  getDPIPresets() {
    return {
      [this.DPI_PRESETS.SCREEN]: {
        name: 'Screen Quality',
        description: 'Optimized for screen viewing (72 DPI)',
        useCase: 'Web preview, email sharing',
        quality: 'Basic'
      },
      [this.DPI_PRESETS.WEB_HIGH]: {
        name: 'High Screen Quality', 
        description: 'High-density screen displays (96 DPI)',
        useCase: 'Retina displays, high-DPI monitors',
        quality: 'Good'
      },
      [this.DPI_PRESETS.PRINT_DRAFT]: {
        name: 'Draft Print',
        description: 'Draft quality printing (150 DPI)',
        useCase: 'Proofs, internal review',
        quality: 'Draft'
      },
      [this.DPI_PRESETS.PRINT_STANDARD]: {
        name: 'Professional Print',
        description: 'Professional print quality (300 DPI)',
        useCase: 'Professional printing, wall art',
        quality: 'Professional'
      },
      [this.DPI_PRESETS.PRINT_HIGH]: {
        name: 'Premium Print',
        description: 'Premium print quality (600 DPI)',
        useCase: 'High-end printing, large format',
        quality: 'Premium'
      }
    };
  }

  /**
   * Optimize dimensions for memory constraints
   * @param {number} width - Original width
   * @param {number} height - Original height
   * @param {number} targetDPI - Target DPI
   * @param {number} maxMemoryMB - Maximum memory limit in MB
   * @returns {Object} Optimized dimensions and settings
   */
  optimizeForMemory(width, height, targetDPI, maxMemoryMB = 500) {
    let currentMemory = this.calculateMemoryRequirements(width, height, targetDPI);
    
    if (currentMemory.estimatedMB <= maxMemoryMB) {
      return {
        width,
        height,
        dpi: targetDPI,
        scalingFactor: currentMemory.scalingFactor,
        memoryMB: currentMemory.estimatedMB,
        optimized: false
      };
    }

    // Calculate reduction factor needed
    const reductionRatio = Math.sqrt(maxMemoryMB / currentMemory.estimatedMB);
    const optimizedWidth = Math.round(width * reductionRatio);
    const optimizedHeight = Math.round(height * reductionRatio);
    
    // Recalculate memory with optimized dimensions
    const optimizedMemory = this.calculateMemoryRequirements(optimizedWidth, optimizedHeight, targetDPI);

    return {
      width: optimizedWidth,
      height: optimizedHeight,
      dpi: targetDPI,
      scalingFactor: optimizedMemory.scalingFactor,
      memoryMB: optimizedMemory.estimatedMB,
      optimized: true,
      reductionRatio,
      originalDimensions: { width, height },
      originalMemoryMB: currentMemory.estimatedMB
    };
  }

  /**
   * Get preview dimensions optimized for fast display
   * @param {number} targetWidth - Target preview width
   * @param {number} targetHeight - Target preview height
   * @param {number} maxDimension - Maximum dimension limit
   * @returns {Object} Preview dimensions and settings
   */
  getPreviewDimensions(targetWidth, targetHeight, maxDimension = 800) {
    const aspectRatio = targetWidth / targetHeight;
    let previewWidth, previewHeight;

    if (targetWidth > targetHeight) {
      previewWidth = Math.min(maxDimension, targetWidth);
      previewHeight = Math.round(previewWidth / aspectRatio);
    } else {
      previewHeight = Math.min(maxDimension, targetHeight);
      previewWidth = Math.round(previewHeight * aspectRatio);
    }

    // Use screen DPI for previews
    const quality = this.getQualitySettings(this.DPI_PRESETS.SCREEN);

    return {
      width: previewWidth,
      height: previewHeight,
      dpi: this.DPI_PRESETS.SCREEN,
      quality,
      scalingFactor: quality.scalingFactor,
      aspectRatio,
      isPreview: true
    };
  }

  /**
   * Validate resolution parameters
   * @param {Object} params - Resolution parameters
   * @returns {boolean} Validation result
   */
  validateResolutionParams(params) {
    const { width, height, dpi } = params;

    if (!Number.isInteger(width) || width <= 0) {
      throw new Error('Width must be a positive integer');
    }
    if (!Number.isInteger(height) || height <= 0) {
      throw new Error('Height must be a positive integer');
    }
    if (!Number.isInteger(dpi) || dpi <= 0) {
      throw new Error('DPI must be a positive integer');
    }

    // Check reasonable limits
    if (dpi > 1200) {
      throw new Error('DPI cannot exceed 1200 (maximum supported)');
    }
    if (dpi < 36) {
      throw new Error('DPI cannot be less than 36 (minimum supported)');
    }

    const memoryCheck = this.calculateMemoryRequirements(width, height, dpi);
    if (memoryCheck.estimatedMB > this.MEMORY_THRESHOLDS.EXTREME) {
      console.warn(`High memory requirement detected: ${memoryCheck.estimatedMB}MB. Consider optimizing dimensions.`);
    }

    return true;
  }
}

class MapService {
  constructor() {
    this.appConfig = config.getConfig();
    this.browser = null;
    this.isInitialized = false;
    this.resolutionManager = new ResolutionManager();
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
   * Generate high-resolution map image with resolution management
   */
  async generateMap(mapOptions) {
    const {
      routeCoordinates,
      bounds,
      center,
      format = 'A4',
      orientation = 'portrait',
      dpi = 300,
      style = 'outdoors-v11',
      routeColor = '#FF4444',
      routeWidth = 4,
      showStartEnd = true,
      title = '',
      outputPath,
      memoryOptimization = true,
      maxMemoryMB = 500,
      // New format-specific options
      exportFormat = 'png', // 'png' or 'jpeg'
      qualityLevel = 'high', // 'low', 'medium', 'high'
      antiAliasing = true,
      optimizeText = true,
      jpegBackgroundColor = '#ffffff'
    } = mapOptions;

    // Validate map options
    this.validateMapOptions(mapOptions);

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
      console.log(`MapService: Generating ${format} ${orientation} map at ${dpi} DPI...`);

      // Get base dimensions for format and orientation
      const baseDimensions = this.getPrintDimensions(format, orientation);
      
      // Get resolution settings and optimize if needed
      let resolutionConfig;
      if (memoryOptimization) {
        resolutionConfig = this.resolutionManager.optimizeForMemory(
          baseDimensions.width, 
          baseDimensions.height, 
          dpi, 
          maxMemoryMB
        );
        
        if (resolutionConfig.optimized) {
          console.log(`MapService: Memory optimization applied. Reduced from ${resolutionConfig.originalMemoryMB}MB to ${resolutionConfig.memoryMB}MB`);
        }
      } else {
        // No optimization, use full dimensions
        const qualitySettings = this.resolutionManager.getQualitySettings(dpi);
        resolutionConfig = {
          width: baseDimensions.width,
          height: baseDimensions.height,
          dpi,
          scalingFactor: qualitySettings.scalingFactor,
          memoryMB: this.resolutionManager.calculateMemoryRequirements(baseDimensions.width, baseDimensions.height, dpi).estimatedMB,
          optimized: false
        };
      }

      // Validate resolution parameters
      this.resolutionManager.validateResolutionParams({
        width: resolutionConfig.width,
        height: resolutionConfig.height,
        dpi: resolutionConfig.dpi
      });

      // Get quality settings for the target DPI
      const qualitySettings = this.resolutionManager.getQualitySettings(resolutionConfig.dpi);
      
      console.log(`MapService: Using resolution ${resolutionConfig.width}x${resolutionConfig.height} at ${resolutionConfig.dpi} DPI (${resolutionConfig.memoryMB}MB estimated)`);

      // Set viewport with calculated device pixel ratio
      await page.setViewport({
        width: resolutionConfig.width,
        height: resolutionConfig.height,
        deviceScaleFactor: qualitySettings.scalingFactor
      });

      // Generate HTML for map rendering with resolution settings
      const mapHTML = this.generateMapHTML({
        routeCoordinates,
        bounds,
        center,
        style,
        routeColor,
        routeWidth,
        showStartEnd,
        title,
        dimensions: {
          ...resolutionConfig,
          ...baseDimensions, // Include original metadata
          actualWidth: Math.round(resolutionConfig.width * qualitySettings.scalingFactor),
          actualHeight: Math.round(resolutionConfig.height * qualitySettings.scalingFactor)
        },
        format,
        orientation,
        qualitySettings
      });

      // Set page content
      await page.setContent(mapHTML, {
        waitUntil: 'networkidle0',
        timeout: 45000 // Increased timeout for high-res renders
      });

      // Wait for map to be fully loaded
      await page.waitForFunction(() => {
        return window.mapLoaded === true;
      }, { timeout: 45000 });

      // Configure format-specific quality settings
      const formatQualitySettings = this.getFormatQualitySettings(exportFormat, qualityLevel);
      
      // Take screenshot with optimized quality settings
      const screenshotOptions = {
        type: exportFormat === 'jpeg' ? 'jpeg' : 'png',
        fullPage: false,
        clip: {
          x: 0,
          y: 0,
          width: Math.round(resolutionConfig.width * qualitySettings.scalingFactor),
          height: Math.round(resolutionConfig.height * qualitySettings.scalingFactor)
        }
      };

      // Add format-specific quality settings
      if (exportFormat === 'jpeg') {
        screenshotOptions.quality = formatQualitySettings.quality;
        // JPEG doesn't support transparency, so no background color needed in Puppeteer
      }

      // Add quality optimization settings
      if (qualitySettings.optimization !== 'minimal') {
        screenshotOptions.optimizeForSpeed = qualitySettings.optimization === 'high';
      }

      // Add anti-aliasing configuration
      if (antiAliasing) {
        screenshotOptions.captureBeyondViewport = false; // Better for anti-aliasing
      }

      const screenshot = await page.screenshot(screenshotOptions);

      // Save to file if output path provided
      if (outputPath) {
        await fs.writeFile(outputPath, screenshot);
        console.log(`MapService: Map saved to ${outputPath}`);
      }

      console.log(`MapService: ${format} ${orientation} map generated successfully at ${resolutionConfig.dpi} DPI`);
      
      return {
        image: screenshot,
        metadata: {
          format,
          orientation,
          requestedDPI: dpi,
          actualDPI: qualitySettings.actualDPI,
          dimensions: {
            logical: { width: resolutionConfig.width, height: resolutionConfig.height },
            physical: { 
              width: Math.round(resolutionConfig.width * qualitySettings.scalingFactor), 
              height: Math.round(resolutionConfig.height * qualitySettings.scalingFactor) 
            }
          },
          memoryUsage: resolutionConfig.memoryMB,
          optimized: resolutionConfig.optimized,
          scalingFactor: qualitySettings.scalingFactor,
          quality: qualitySettings
        }
      };

    } catch (error) {
      console.error('MapService: Map generation failed:', error);
      throw error;
    } finally {
      await page.close();
    }
  }

  /**
   * Print dimensions configuration at 300 DPI
   * All dimensions in pixels at 300 DPI resolution
   */
  static PRINT_CONFIG = {
    // Standard ISO 216 paper sizes at 300 DPI
    A0: {
      portrait: { width: 9933, height: 14043 },  // 33.11" x 46.81" at 300 DPI
      landscape: { width: 14043, height: 9933 }
    },
    A1: {
      portrait: { width: 7016, height: 9933 },   // 23.39" x 33.11" at 300 DPI  
      landscape: { width: 9933, height: 7016 }
    },
    A2: {
      portrait: { width: 4961, height: 7016 },   // 16.54" x 23.39" at 300 DPI
      landscape: { width: 7016, height: 4961 }
    },
    A3: {
      portrait: { width: 3508, height: 4961 },   // 11.69" x 16.54" at 300 DPI
      landscape: { width: 4961, height: 3508 }
    },
    A4: {
      portrait: { width: 2480, height: 3508 },   // 8.27" x 11.69" at 300 DPI
      landscape: { width: 3508, height: 2480 }
    },
    // Common aspect ratios for custom prints
    SQUARE_SMALL: {
      portrait: { width: 3000, height: 3000 },   // 10" x 10" at 300 DPI
      landscape: { width: 3000, height: 3000 }
    },
    SQUARE_LARGE: {
      portrait: { width: 4500, height: 4500 },   // 15" x 15" at 300 DPI
      landscape: { width: 4500, height: 4500 }
    },
    WIDESCREEN_16_9: {
      portrait: { width: 2667, height: 4740 },   // 8.89" x 15.8" at 300 DPI
      landscape: { width: 4740, height: 2667 }
    },
    WIDESCREEN_4_3: {
      portrait: { width: 3000, height: 4000 },   // 10" x 13.33" at 300 DPI
      landscape: { width: 4000, height: 3000 }
    }
  };

  /**
   * Get print dimensions for specific format and orientation
   */
  getPrintDimensions(format, orientation = 'portrait') {
    const formatKey = format.toUpperCase();
    const orientationKey = orientation.toLowerCase();

    if (!this.constructor.PRINT_CONFIG[formatKey]) {
      const supportedFormats = Object.keys(this.constructor.PRINT_CONFIG).join(', ');
      throw new Error(`Unsupported format: ${format}. Supported formats: ${supportedFormats}`);
    }

    if (!this.constructor.PRINT_CONFIG[formatKey][orientationKey]) {
      throw new Error(`Unsupported orientation: ${orientation}. Supported orientations: portrait, landscape`);
    }

    const dimensions = this.constructor.PRINT_CONFIG[formatKey][orientationKey];
    
    // Add metadata for debugging and validation
    return {
      ...dimensions,
      format: formatKey,
      orientation: orientationKey,
      dpi: 300,
      widthInches: (dimensions.width / 300).toFixed(2),
      heightInches: (dimensions.height / 300).toFixed(2),
      aspectRatio: (dimensions.width / dimensions.height).toFixed(3)
    };
  }

  /**
   * Toggle orientation for given dimensions
   */
  toggleOrientation(format, currentOrientation) {
    const newOrientation = currentOrientation === 'portrait' ? 'landscape' : 'portrait';
    return this.getPrintDimensions(format, newOrientation);
  }

  /**
   * Validate print dimensions
   */
  validatePrintDimensions(width, height, dpi = 300) {
    if (!Number.isInteger(width) || width <= 0) {
      throw new Error('Width must be a positive integer');
    }
    if (!Number.isInteger(height) || height <= 0) {
      throw new Error('Height must be a positive integer');
    }
    if (!Number.isInteger(dpi) || dpi <= 0) {
      throw new Error('DPI must be a positive integer');
    }
    
    // Check for reasonable print size limits (max ~50 inches at 300 DPI)
    const maxPixels = 15000; // ~50 inches at 300 DPI
    if (width > maxPixels || height > maxPixels) {
      throw new Error(`Dimensions too large. Maximum supported: ${maxPixels}px (${(maxPixels/300).toFixed(1)}" at 300 DPI)`);
    }

    // Check minimum size (at least 1 inch at 300 DPI)
    const minPixels = 300;
    if (width < minPixels || height < minPixels) {
      throw new Error(`Dimensions too small. Minimum supported: ${minPixels}px (1" at 300 DPI)`);
    }

    return true;
  }

  /**
   * Check if format is valid
   */
  isValidPrintSize(format) {
    return this.constructor.PRINT_CONFIG.hasOwnProperty(format.toUpperCase());
  }

  /**
   * Calculate pixels from millimeters at given DPI
   */
  calculatePixelsFromMM(mm, dpi = 300) {
    const inches = mm / 25.4; // Convert mm to inches
    return Math.round(inches * dpi);
  }

  /**
   * Calculate pixel dimensions from physical dimensions
   */
  calculatePixelDimensions(widthMM, heightMM, dpi = 300) {
    return {
      width: this.calculatePixelsFromMM(widthMM, dpi),
      height: this.calculatePixelsFromMM(heightMM, dpi),
      dpi
    };
  }

  /**
   * Get optimal scale factor for viewport display
   */
  getOptimalScale(format, orientation = 'portrait', viewportSize = { width: 1200, height: 800 }) {
    const printDimensions = this.getPrintDimensions(format, orientation);
    
    const scaleX = viewportSize.width / printDimensions.width;
    const scaleY = viewportSize.height / printDimensions.height;
    
    // Use the smaller scale to ensure the entire print area fits
    return Math.min(scaleX, scaleY, 1); // Don't scale up beyond 1:1
  }

  /**
   * Calculate container dimensions for display
   */
  calculateContainerDimensions(format, orientation = 'portrait', scale = 1) {
    const printDimensions = this.getPrintDimensions(format, orientation);
    
    return {
      width: Math.round(printDimensions.width * scale),
      height: Math.round(printDimensions.height * scale),
      scale,
      originalWidth: printDimensions.width,
      originalHeight: printDimensions.height
    };
  }

  /**
   * Resize map container for specific print format
   */
  resizeMapContainer(mapElement, format, orientation = 'portrait', viewportSize = null) {
    if (!mapElement) {
      throw new Error('Map element is required');
    }

    const scale = viewportSize ? 
      this.getOptimalScale(format, orientation, viewportSize) : 
      1;

    const containerDimensions = this.calculateContainerDimensions(format, orientation, scale);

    // Apply dimensions to DOM element
    mapElement.style.width = `${containerDimensions.width}px`;
    mapElement.style.height = `${containerDimensions.height}px`;

    return containerDimensions;
  }

  /**
   * Get all supported print formats with their dimensions
   */
  getSupportedFormats() {
    const formats = {};
    
    Object.keys(this.constructor.PRINT_CONFIG).forEach(format => {
      formats[format] = {
        portrait: this.getPrintDimensions(format, 'portrait'),
        landscape: this.getPrintDimensions(format, 'landscape')
      };
    });

    return formats;
  }

  /**
   * Generate HTML content for map rendering with resolution management
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
      dimensions,
      format = 'A4',
      orientation = 'portrait',
      qualitySettings = { scalingFactor: 3, optimization: 'low' }
    } = options;

    // Convert coordinates to GeoJSON format
    const routeGeoJSON = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: routeCoordinates.map(coord => [coord[1], coord[0]]) // [lng, lat] for GeoJSON
      }
    };

    // Calculate scaling-dependent sizes
    const scalingFactor = qualitySettings.scalingFactor;
    const actualWidth = Math.round(dimensions.width * scalingFactor);
    const actualHeight = Math.round(dimensions.height * scalingFactor);
    const actualDPI = dimensions.dpi || Math.round(96 * scalingFactor);

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Map Export - ${actualDPI} DPI</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <script src='https://api.mapbox.com/mapbox-gl-js/v3.13.0/mapbox-gl.js'></script>
    <link href='https://api.mapbox.com/mapbox-gl-js/v3.13.0/mapbox-gl.css' rel='stylesheet' />
    <style>
        body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
        /* Map sized dynamically based on resolution requirements */
        #map { width: ${actualWidth}px; height: ${actualHeight}px; }
        .map-title {
            position: absolute;
            top: ${Math.round(20 * scalingFactor)}px;
            left: ${Math.round(20 * scalingFactor)}px;
            z-index: 1000;
            background: rgba(255, 255, 255, 0.9);
            padding: ${Math.round(10 * scalingFactor)}px ${Math.round(15 * scalingFactor)}px;
            border-radius: ${Math.round(4 * scalingFactor)}px;
            font-weight: bold;
            font-size: ${Math.round(18 * scalingFactor)}px;
            box-shadow: 0 ${Math.round(2 * scalingFactor)}px ${Math.round(4 * scalingFactor)}px rgba(0,0,0,0.2);
            max-width: ${Math.round(300 * scalingFactor)}px;
            word-wrap: break-word;
        }
        .print-info {
            position: absolute;
            bottom: ${Math.round(10 * scalingFactor)}px;
            right: ${Math.round(10 * scalingFactor)}px;
            z-index: 1000;
            background: rgba(255, 255, 255, 0.8);
            padding: ${Math.round(5 * scalingFactor)}px ${Math.round(10 * scalingFactor)}px;
            border-radius: ${Math.round(3 * scalingFactor)}px;
            font-size: ${Math.round(10 * scalingFactor)}px;
            color: #666;
        }
    </style>
</head>
<body>
    <div id="map"></div>
    ${title ? `<div class="map-title">${title}</div>` : ''}
    <div class="print-info">Generated by Print My Ride • ${format} ${orientation} • ${actualDPI} DPI</div>
    
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
                    'line-width': ${Math.round(routeWidth * scalingFactor)} // Scaled for target DPI
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

            // Fit to bounds with padding (scaled for target DPI)
            const boundsPadding = Math.round(50 * scalingFactor); // Scaled padding
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
   * Generate map preview optimized for fast display
   */
  async generatePreview(mapOptions, maxDimension = 800) {
    const {
      format = 'A4',
      orientation = 'portrait'
    } = mapOptions;

    // Get target dimensions
    const targetDimensions = this.getPrintDimensions(format, orientation);
    
    // Calculate preview dimensions using resolution manager
    const previewConfig = this.resolutionManager.getPreviewDimensions(
      targetDimensions.width,
      targetDimensions.height,
      maxDimension
    );

    // Create preview options with optimized settings
    const previewOptions = {
      ...mapOptions,
      dpi: previewConfig.dpi,
      memoryOptimization: false, // Previews are already optimized
      maxMemoryMB: 100 // Low memory limit for previews
    };

    // Override dimensions temporarily
    const originalGetDimensions = this.getPrintDimensions;
    this.getPrintDimensions = (format, orientation) => {
      if (mapOptions.format === format) {
        return {
          width: previewConfig.width,
          height: previewConfig.height,
          format: format,
          orientation: orientation,
          dpi: previewConfig.dpi,
          isPreview: true
        };
      }
      return originalGetDimensions.call(this, format, orientation);
    };

    try {
      const result = await this.generateMap(previewOptions);
      
      // Return just the image for previews (not full metadata)
      return {
        image: result.image || result, // Handle both new and old return formats
        metadata: {
          ...result.metadata,
          isPreview: true,
          previewDimensions: previewConfig,
          targetDimensions: targetDimensions
        }
      };
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

    if (mapOptions.format && !this.isValidPrintSize(mapOptions.format)) {
      const supportedFormats = Object.keys(this.constructor.PRINT_CONFIG).join(', ');
      throw new Error(`format must be one of: ${supportedFormats}`);
    }

    if (mapOptions.orientation && !['portrait', 'landscape'].includes(mapOptions.orientation.toLowerCase())) {
      throw new Error('orientation must be portrait or landscape');
    }

    return true;
  }

  /**
   * Get available DPI presets and their configurations
   */
  getDPIPresets() {
    return this.resolutionManager.getDPIPresets();
  }

  /**
   * Calculate memory requirements for given parameters
   */
  calculateMemoryRequirements(width, height, dpi) {
    return this.resolutionManager.calculateMemoryRequirements(width, height, dpi);
  }

  /**
   * Get quality settings for target DPI
   */
  getQualitySettings(dpi) {
    return this.resolutionManager.getQualitySettings(dpi);
  }

  /**
   * Get format-specific quality settings
   * @param {string} format - 'png' or 'jpeg'
   * @param {string} qualityLevel - 'low', 'medium', or 'high'
   * @returns {Object} Format-specific quality settings
   */
  getFormatQualitySettings(format = 'png', qualityLevel = 'high') {
    const qualityPresets = {
      png: {
        low: { quality: 1.0, compressionLevel: 9, antiAliasing: true },
        medium: { quality: 1.0, compressionLevel: 6, antiAliasing: true },
        high: { quality: 1.0, compressionLevel: 3, antiAliasing: true }
      },
      jpeg: {
        low: { quality: 0.7, antiAliasing: true },
        medium: { quality: 0.85, antiAliasing: true },
        high: { quality: 0.95, antiAliasing: true }
      }
    };

    if (!qualityPresets[format]) {
      throw new Error(`Unsupported format: ${format}. Supported formats: png, jpeg`);
    }

    if (!qualityPresets[format][qualityLevel]) {
      throw new Error(`Invalid quality level: ${qualityLevel}. Supported levels: low, medium, high`);
    }

    return {
      ...qualityPresets[format][qualityLevel],
      format,
      qualityLevel
    };
  }

  /**
   * Optimize dimensions for memory constraints
   */
  optimizeForMemory(width, height, targetDPI, maxMemoryMB = 500) {
    return this.resolutionManager.optimizeForMemory(width, height, targetDPI, maxMemoryMB);
  }

  /**
   * Validate resolution parameters
   */
  validateResolutionParams(params) {
    return this.resolutionManager.validateResolutionParams(params);
  }

  /**
   * Get resolution configuration for format and DPI
   */
  getResolutionConfig(format, orientation = 'portrait', dpi = 300, enableOptimization = true, maxMemoryMB = 500) {
    const baseDimensions = this.getPrintDimensions(format, orientation);
    
    if (enableOptimization) {
      return this.resolutionManager.optimizeForMemory(
        baseDimensions.width,
        baseDimensions.height,
        dpi,
        maxMemoryMB
      );
    } else {
      const qualitySettings = this.resolutionManager.getQualitySettings(dpi);
      const memoryInfo = this.resolutionManager.calculateMemoryRequirements(
        baseDimensions.width,
        baseDimensions.height,
        dpi
      );
      
      return {
        width: baseDimensions.width,
        height: baseDimensions.height,
        dpi,
        scalingFactor: qualitySettings.scalingFactor,
        memoryMB: memoryInfo.estimatedMB,
        optimized: false,
        qualitySettings,
        memoryInfo
      };
    }
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
      supportedFormats: Object.keys(this.constructor.PRINT_CONFIG),
      supportedOrientations: ['portrait', 'landscape'],
      supportedStyles: [
        'streets-v11',
        'outdoors-v11',
        'satellite-v9',
        'light-v10',
        'dark-v10'
      ],
      resolutionCapabilities: {
        supportedDPIs: Object.values(this.resolutionManager.DPI_PRESETS),
        dpiRange: { min: 36, max: 1200 },
        memoryThresholds: this.resolutionManager.MEMORY_THRESHOLDS,
        hasMemoryOptimization: true,
        hasPreviewGeneration: true,
        supportedQualityLevels: Object.keys(this.resolutionManager.QUALITY_SETTINGS)
      }
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