/**
 * MapboxExport.js - High-Resolution Canvas Export and Print Functionality
 * 
 * Handles:
 * - High-resolution map export for print quality (300 DPI)
 * - Canvas size management and DPI manipulation
 * - Print format support (A3, A4) with proper dimensions
 * - Export container creation and cleanup
 * - Fallback export methods for browser compatibility
 * - Image download and processing
 * 
 * Dependencies:
 * - MapboxCore (for map instance and configuration)
 * - mapbox-config.js (for DPI management utilities)
 */

class MapboxExport {
  constructor(core, options = {}) {
    this.core = core;
    this.map = null; // Will be set when core is initialized
    this.container = null; // Will be set when core is initialized
    this.config = null; // Will be set from core
    
    // Canvas size manager (if available)
    this.canvasSizeManager = null;
    
    // Export state
    this.isExporting = false;
    this.exportProgress = 0;
    
    // Default export options
    this.options = {
      defaultFormat: 'A4',
      defaultOrientation: 'portrait',
      defaultDPI: 300,
      enableProgressTracking: true,
      compressionQuality: 0.9,
      supportedFormats: ['A3', 'A4'],
      supportedOrientations: ['portrait', 'landscape'],
      ...options
    };

    // Print dimensions at 300 DPI
    this.printDimensions = {
      A4: {
        portrait: { width: 2480, height: 3508, name: 'A4 Portrait' },
        landscape: { width: 3508, height: 2480, name: 'A4 Landscape' }
      },
      A3: {
        portrait: { width: 3508, height: 4961, name: 'A3 Portrait' },
        landscape: { width: 4961, height: 3508, name: 'A3 Landscape' }
      }
    };

    // Bind methods
    this.exportHighResolution = this.exportHighResolution.bind(this);
    this.resizeForPrintFormat = this.resizeForPrintFormat.bind(this);
    this.createExportContainer = this.createExportContainer.bind(this);
    this.downloadImage = this.downloadImage.bind(this);
    this.cleanup = this.cleanup.bind(this);
  }

  /**
   * Initialize export functionality
   * @param {mapboxgl.Map} map - Map instance
   * @param {HTMLElement} container - Map container element
   * @param {Object} config - Map configuration
   */
  init(map, container, config) {
    this.map = map;
    this.container = container;
    this.config = config;

    // Initialize canvas size manager if available
    this.initializeCanvasSizeManager();

    console.log('MapboxExport: Export functionality initialized');
    return this;
  }

  /**
   * Initialize canvas size manager
   */
  initializeCanvasSizeManager() {
    try {
      // Canvas size manager would be created here if it exists
      // For now, we'll use fallback methods
      this.canvasSizeManager = null;
      console.log('MapboxExport: Using fallback canvas sizing');
    } catch (error) {
      console.warn('MapboxExport: Canvas size manager not available:', error);
      this.canvasSizeManager = null;
    }
  }

  /**
   * Export high-resolution map for printing with advanced DPI manipulation
   * @param {string} format - Export format (A4, A3, etc.)
   * @param {number} targetDPI - Target DPI (default: 300)
   * @param {Object} options - Export options
   * @returns {Promise<string>} Data URL of exported image
   */
  async exportHighResolution(format = 'A4', targetDPI = 300, options = {}) {
    if (!this.map || !this.config) {
      throw new Error('MapboxExport: Map not initialized');
    }

    if (this.isExporting) {
      throw new Error('MapboxExport: Export already in progress');
    }

    this.isExporting = true;
    this.exportProgress = 0;

    const dpiManager = this.config.getDPIManager();
    let originalDPIState = null;
    let exportContainer = null;
    let exportMap = null;

    try {
      console.log(`MapboxExport: Starting high-resolution export: ${format} format at ${targetDPI} DPI...`);
      
      // Update progress
      this.updateProgress(10, 'Preparing export configuration...');

      // Store original DPI state and set high DPI
      originalDPIState = dpiManager.getCurrentState();
      await dpiManager.setDPI(targetDPI);

      // Create export configuration
      const exportConfig = this.createExportConfig(format, options.orientation || 'portrait', targetDPI, options);
      
      this.updateProgress(20, 'Creating export container...');
      
      // Create hidden container for export
      exportContainer = this.createExportContainer(exportConfig);
      
      this.updateProgress(30, 'Initializing high-resolution map...');
      
      // Create high-resolution map instance
      exportMap = await this.createHighDPIMap(exportContainer, exportConfig);
      
      this.updateProgress(50, 'Copying map state...');
      
      // Copy current map state to export map
      await this.copyMapState(exportMap, exportConfig);
      
      this.updateProgress(70, 'Waiting for map to load...');
      
      // Wait for map to be fully loaded
      await this.waitForMapLoad(exportMap);
      
      this.updateProgress(80, 'Capturing canvas...');
      
      // Capture the canvas
      const canvas = exportMap.getCanvas();
      const dataURL = canvas.toDataURL('image/png', this.options.compressionQuality);
      
      this.updateProgress(90, 'Finalizing export...');
      
      // Cleanup export resources
      this.cleanupExportResources(exportMap, exportContainer);
      
      this.updateProgress(100, 'Export completed!');
      
      console.log('MapboxExport: High-resolution export completed successfully');
      return dataURL;

    } catch (error) {
      console.error('MapboxExport: Export failed:', error);
      
      // Cleanup on error
      if (exportMap) {
        this.cleanupExportResources(exportMap, exportContainer);
      }
      
      throw new Error(`Export failed: ${error.message}`);
      
    } finally {
      // Restore original DPI state
      if (originalDPIState && dpiManager) {
        await dpiManager.restoreState(originalDPIState);
      }
      
      this.isExporting = false;
      this.exportProgress = 0;
    }
  }

  /**
   * Create export configuration object
   * @param {string} format - Print format
   * @param {string} orientation - Print orientation
   * @param {number} targetDPI - Target DPI
   * @param {Object} options - Additional options
   * @returns {Object} Export configuration
   */
  createExportConfig(format, orientation, targetDPI, options = {}) {
    const dimensions = this.printDimensions[format]?.[orientation];
    if (!dimensions) {
      throw new Error(`MapboxExport: Unsupported format/orientation: ${format} ${orientation}`);
    }

    return {
      format,
      orientation,
      targetDPI,
      width: dimensions.width,
      height: dimensions.height,
      name: dimensions.name,
      pixelRatio: targetDPI / 96, // Standard web DPI is 96
      ...options
    };
  }

  /**
   * Create export container element
   * @param {Object} exportConfig - Export configuration
   * @returns {HTMLElement} Export container
   */
  createExportContainer(exportConfig) {
    const container = document.createElement('div');
    container.id = `mapbox-export-container-${Date.now()}`;
    container.style.cssText = `
      position: absolute;
      top: -10000px;
      left: -10000px;
      width: ${exportConfig.width}px;
      height: ${exportConfig.height}px;
      visibility: hidden;
      pointer-events: none;
      background-color: white;
      overflow: hidden;
    `;
    
    document.body.appendChild(container);
    console.log(`MapboxExport: Created export container ${exportConfig.width}x${exportConfig.height}`);
    
    return container;
  }

  /**
   * Create high-DPI map instance for export
   * @param {HTMLElement} container - Export container
   * @param {Object} exportConfig - Export configuration
   * @returns {Promise<mapboxgl.Map>} High-DPI map instance
   */
  async createHighDPIMap(container, exportConfig) {
    const mapOptions = {
      container: container,
      style: this.map.getStyle(),
      center: this.map.getCenter(),
      zoom: this.map.getZoom(),
      bearing: this.map.getBearing(),
      pitch: this.map.getPitch(),
      interactive: false,
      preserveDrawingBuffer: true,
      pixelRatio: exportConfig.pixelRatio,
      antialias: true,
      optimizeForTerrain: false
    };

    console.log('MapboxExport: Creating high-DPI map with options:', mapOptions);
    return new mapboxgl.Map(mapOptions);
  }

  /**
   * Copy current map state to export map
   * @param {mapboxgl.Map} exportMap - Export map instance
   * @param {Object} exportConfig - Export configuration
   */
  async copyMapState(exportMap, exportConfig) {
    // Wait for style to load
    await new Promise((resolve) => {
      if (exportMap.isStyleLoaded()) {
        resolve();
      } else {
        exportMap.on('styledata', resolve);
      }
    });

    // Copy all sources and layers from the original map
    const style = this.map.getStyle();
    
    // Add sources
    if (style.sources) {
      for (const [sourceId, sourceData] of Object.entries(style.sources)) {
        if (!exportMap.getSource(sourceId)) {
          try {
            exportMap.addSource(sourceId, sourceData);
          } catch (error) {
            console.warn(`MapboxExport: Could not add source ${sourceId}:`, error);
          }
        }
      }
    }

    // Add layers
    if (style.layers) {
      for (const layer of style.layers) {
        if (!exportMap.getLayer(layer.id)) {
          try {
            exportMap.addLayer(layer);
          } catch (error) {
            console.warn(`MapboxExport: Could not add layer ${layer.id}:`, error);
          }
        }
      }
    }
  }

  /**
   * Wait for map to fully load
   * @param {mapboxgl.Map} map - Map instance
   * @returns {Promise<void>}
   */
  waitForMapLoad(map) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('MapboxExport: Map load timeout'));
      }, 30000);

      const checkLoaded = () => {
        if (map.loaded() && map.isStyleLoaded()) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(checkLoaded, 100);
        }
      };

      checkLoaded();
    });
  }

  /**
   * Resize map for print format
   * @param {string} format - Print format
   * @param {string} orientation - Print orientation
   * @param {number} quality - Quality setting
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Resize result
   */
  async resizeForPrintFormat(format, orientation, quality = 300, options = {}) {
    if (!this.canvasSizeManager) {
      console.warn('MapboxExport: Canvas Size Manager not available - using fallback sizing');
      return this.fallbackResize(format, orientation);
    }

    try {
      console.log(`MapboxExport: Resizing canvas for ${format} ${orientation} at ${quality} DPI`);

      // Resize the canvas container
      const dimensions = await this.canvasSizeManager.resizeCanvas(
        this.container,
        format,
        orientation,
        quality,
        options
      );

      // Trigger map resize
      if (this.map) {
        this.map.resize();
      }

      console.log('MapboxExport: Canvas resize completed', dimensions);
      return dimensions;

    } catch (error) {
      console.error('MapboxExport: Canvas resize failed:', error);
      return this.fallbackResize(format, orientation);
    }
  }

  /**
   * Fallback resize method when Canvas Size Manager is not available
   * @param {string} format - Print format
   * @param {string} orientation - Orientation
   * @returns {Object} Basic dimensions object
   */
  fallbackResize(format, orientation) {
    const basicSizes = {
      A4: { 
        portrait: { width: 800, height: 1133 }, 
        landscape: { width: 1133, height: 800 } 
      },
      A3: { 
        portrait: { width: 1133, height: 1600 }, 
        landscape: { width: 1600, height: 1133 } 
      }
    };

    const size = basicSizes[format]?.[orientation] || basicSizes.A4.portrait;
    
    this.container.style.width = `${size.width}px`;
    this.container.style.height = `${size.height}px`;
    
    if (this.map) {
      this.map.resize();
    }

    return {
      viewport: size,
      print: this.printDimensions[format][orientation],
      scaling: { factor: size.width / this.printDimensions[format][orientation].width, x: 1, y: 1 },
      aspectRatio: size.width / size.height,
      memoryEstimate: { estimatedMB: 50, isHighMemory: false }
    };
  }

  /**
   * Download image from data URL
   * @param {string} dataURL - Image data URL
   * @param {string} filename - Download filename
   */
  downloadImage(dataURL, filename) {
    try {
      const link = document.createElement('a');
      link.download = filename || `map-export-${Date.now()}.png`;
      link.href = dataURL;
      
      // Temporarily add to DOM and click
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log(`MapboxExport: Image downloaded as ${link.download}`);
    } catch (error) {
      console.error('MapboxExport: Download failed:', error);
      throw new Error(`Download failed: ${error.message}`);
    }
  }

  /**
   * Clean up export resources
   * @param {mapboxgl.Map} map - Export map instance
   * @param {HTMLElement} container - Export container
   */
  cleanupExportResources(map, container) {
    try {
      if (map) {
        map.remove();
      }
      
      if (container && container.parentNode) {
        container.parentNode.removeChild(container);
      }
      
      console.log('MapboxExport: Export resources cleaned up');
    } catch (error) {
      console.warn('MapboxExport: Cleanup warning:', error);
    }
  }

  /**
   * Update export progress
   * @param {number} percent - Progress percentage (0-100)
   * @param {string} message - Progress message
   */
  updateProgress(percent, message) {
    this.exportProgress = percent;
    
    if (this.options.enableProgressTracking) {
      console.log(`MapboxExport: ${percent}% - ${message}`);
      
      // Emit progress event if event system is available
      if (this.core.eventSystem) {
        this.core.eventSystem.emit('export-progress', {
          percent,
          message,
          timestamp: Date.now()
        });
      }
    }
  }

  /**
   * Get export capabilities
   * @returns {Object} Export capabilities information
   */
  getExportCapabilities() {
    return {
      supportedFormats: this.options.supportedFormats,
      supportedOrientations: this.options.supportedOrientations,
      maxDPI: 600,
      defaultDPI: this.options.defaultDPI,
      canvasSupported: !!document.createElement('canvas').getContext,
      preserveDrawingBuffer: this.map ? this.map.getCanvas().style.length > 0 : false,
      printDimensions: this.printDimensions
    };
  }

  /**
   * Get current canvas configuration
   * @returns {Object} Current canvas configuration
   */
  getCurrentCanvasConfig() {
    if (this.canvasSizeManager) {
      return this.canvasSizeManager.getCurrentConfig();
    }

    // Fallback configuration
    return {
      format: 'A4',
      orientation: 'portrait', 
      quality: 300,
      dimensions: {
        viewport: { width: 800, height: 1133 },
        print: { width: 2480, height: 3508 },
        scaling: { factor: 0.32, x: 0.32, y: 0.32 },
        aspectRatio: 0.71,
        memoryEstimate: { estimatedMB: 50, isHighMemory: false }
      }
    };
  }

  /**
   * Check if export is currently in progress
   * @returns {boolean} Export status
   */
  isExportInProgress() {
    return this.isExporting;
  }

  /**
   * Get current export progress
   * @returns {number} Progress percentage (0-100)
   */
  getExportProgress() {
    return this.exportProgress;
  }

  /**
   * Clean up export functionality
   */
  cleanup() {
    console.log('MapboxExport: Starting cleanup...');
    
    // Reset state
    this.isExporting = false;
    this.exportProgress = 0;
    this.map = null;
    this.container = null;
    this.config = null;
    this.canvasSizeManager = null;
    
    console.log('MapboxExport: Cleanup completed');
  }
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MapboxExport;
} else if (typeof define === 'function' && define.amd) {
  define(function() { return MapboxExport; });
} else {
  window.MapboxExport = MapboxExport;
}