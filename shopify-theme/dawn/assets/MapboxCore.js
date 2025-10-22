/**
 * MapboxCore.js - Core Map Initialization and Lifecycle Management
 * 
 * Handles:
 * - Map initialization and configuration
 * - Container and dependency validation
 * - Basic lifecycle methods (init, cleanup)
 * - Map state management
 * - Browser compatibility and error handling
 * 
 * Dependencies:
 * - mapbox-gl.js (loaded via CDN)
 * - mapbox-config.js (configuration utilities)
 */

class MapboxCore {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.container = null;
    this.map = null;
    this.config = null;
    this.isInitialized = false;
    
    // Core options with defaults
    this.options = {
      style: 'grey',
      allowInteraction: true,
      preserveDrawingBuffer: true, // Essential for export functionality
      ...options
    };

    // Bind methods
    this.init = this.init.bind(this);
    this.cleanup = this.cleanup.bind(this);
    this.validateDependencies = this.validateDependencies.bind(this);
    this.validateContainer = this.validateContainer.bind(this);
  }

  /**
   * Initialize the map with base configuration
   * @returns {Promise<MapboxCore>} This instance for chaining
   */
  async init() {
    if (this.isInitialized) {
      console.log('MapboxCore: Already initialized, returning existing instance');
      return this;
    }

    try {
      console.log(`MapboxCore: Starting initialization for container '${this.containerId}'`);
      
      // Validate container exists in DOM
      this.validateContainer();
      
      // Validate dependencies
      this.validateDependencies();

      // Initialize configuration
      console.log('MapboxCore: Initializing configuration...');
      this.config = await MapboxConfig.init();

      // Create map with optimized options
      const mapOptions = this.createMapOptions();
      console.log('MapboxCore: Creating map with options:', mapOptions);
      
      this.map = new mapboxgl.Map(mapOptions);

      // Wait for map to load
      await this.waitForMapLoad();

      this.isInitialized = true;
      console.log('MapboxCore: Initialization completed successfully');
      
      return this;

    } catch (error) {
      console.error('MapboxCore: Initialization failed:', error);
      this.cleanup();
      throw new Error(`MapboxCore initialization failed: ${error.message}`);
    }
  }

  /**
   * Validate that container exists in DOM
   * @throws {Error} If container not found
   */
  validateContainer() {
    this.container = document.getElementById(this.containerId);
    if (!this.container) {
      throw new Error(`Container '${this.containerId}' not found in DOM. Make sure the element exists when MapboxCore.init() is called.`);
    }
    console.log(`MapboxCore: Container '${this.containerId}' found successfully`);
  }

  /**
   * Validate required dependencies are loaded
   * @throws {Error} If dependencies missing
   */
  validateDependencies() {
    if (typeof mapboxgl === 'undefined') {
      throw new Error('Mapbox GL JS is not loaded. Include Mapbox GL JS before MapboxCore.');
    }

    if (typeof MapboxConfig === 'undefined') {
      throw new Error('MapboxConfig is not loaded. Include mapbox-config.js before MapboxCore.');
    }

    // Check WebGL support
    if (!this.checkWebGLSupport()) {
      console.warn('MapboxCore: WebGL is not supported or available. Map may have limited functionality.');
      // Don't throw error - let Mapbox GL JS handle fallback
    }

    console.log('MapboxCore: All dependencies validated successfully');
  }

  /**
   * Check if WebGL is supported by the browser
   * @returns {boolean} True if WebGL is supported
   */
  checkWebGLSupport() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      
      if (gl) {
        console.log('MapboxCore: WebGL support detected:', {
          renderer: gl.getParameter(gl.RENDERER),
          vendor: gl.getParameter(gl.VENDOR),
          version: gl.getParameter(gl.VERSION),
          maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE)
        });
        return true;
      } else {
        console.warn('MapboxCore: WebGL context could not be created');
        return false;
      }
    } catch (error) {
      console.warn('MapboxCore: WebGL support check failed:', error);
      return false;
    }
  }

  /**
   * Create optimized map options
   * @returns {Object} Map configuration options
   */
  createMapOptions() {
    const baseOptions = {
      container: this.containerId,
      style: this.config.getStyleUrl(this.options.style),
      center: [0, 0], // Will be set when route is loaded
      zoom: 10,
      interactive: this.options.allowInteraction,
      preserveDrawingBuffer: this.options.preserveDrawingBuffer,
      // Performance optimizations
      antialias: false, // Disable antialiasing for better performance
      failIfMajorPerformanceCaveat: false, // Don't fail if WebGL context can't be created
      // Reduce memory usage
      maxzoom: 18, // Limit max zoom to reduce tile loading
      // Style loading optimization
      localIdeographFontFamily: false // Disable local font loading for faster startup
    };

    // Get optimized options from config
    return this.config.getOptimizedMapOptions(baseOptions);
  }

  /**
   * Wait for map to fully load (including style)
   * @returns {Promise<void>}
   */
  waitForMapLoad() {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const timeout = setTimeout(() => {
        const elapsedTime = Date.now() - startTime;
        console.error(`MapboxCore: Map load timeout after ${elapsedTime}ms. Current state:`, {
          mapLoaded: this.map.loaded(),
          styleLoaded: this.map.isStyleLoaded(),
          isStyleLoaded: this.map.isStyleLoaded(),
          style: this.map.getStyle()?.name || 'unknown'
        });
        reject(new Error(`Map load timeout after 30 seconds. Map loaded: ${this.map.loaded()}, Style loaded: ${this.map.isStyleLoaded()}`));
      }, 30000);

      let mapLoaded = false;
      let styleLoaded = false;
      let retryCount = 0;
      const maxRetries = 3;

      const checkComplete = () => {
        if (mapLoaded && styleLoaded) {
          clearTimeout(timeout);
          const elapsedTime = Date.now() - startTime;
          console.log(`MapboxCore: Map and style loaded successfully in ${elapsedTime}ms`);
          resolve();
        }
      };

      // Enhanced style loading with retry
      const checkStyleLoaded = () => {
        const isLoaded = this.map.isStyleLoaded();
        console.log(`MapboxCore: Style loaded check #${retryCount + 1}: ${isLoaded}`);
        
        if (isLoaded) {
          styleLoaded = true;
          checkComplete();
        } else if (retryCount < maxRetries) {
          retryCount++;
          console.log(`MapboxCore: Style not loaded, retrying in 1s (attempt ${retryCount}/${maxRetries})`);
          setTimeout(checkStyleLoaded, 1000);
        }
      };

      // Wait for map load event
      this.map.on('load', () => {
        console.log('MapboxCore: Map load event fired');
        mapLoaded = true;
        // Start checking style loading
        checkStyleLoaded();
      });

      // Wait for style load event (critical for bounds fitting)
      this.map.on('styledata', () => {
        // Only consider style fully loaded, not just style changing
        if (this.map.isStyleLoaded()) {
          console.log('MapboxCore: Style load event fired and style is loaded');
          styleLoaded = true;
          checkComplete();
        } else {
          console.log('MapboxCore: Style event fired but style not fully loaded yet');
        }
      });

      // Enhanced error handling
      this.map.on('error', (error) => {
        clearTimeout(timeout);
        console.error('MapboxCore: Map load error:', {
          error: error.error,
          sourceId: error.sourceId,
          source: error.source,
          tile: error.tile
        });
        reject(new Error(`Map error: ${error.error?.message || error.error || 'Unknown map error'}`));
      });

      // Enhanced fallback check with more frequent polling
      const fallbackCheck = () => {
        if (this.map.loaded() && this.map.isStyleLoaded()) {
          console.log('MapboxCore: Fallback check - map and style are ready');
          mapLoaded = true;
          styleLoaded = true;
          checkComplete();
        }
      };

      // Run fallback checks at multiple intervals
      setTimeout(fallbackCheck, 1000);
      setTimeout(fallbackCheck, 3000);
      setTimeout(fallbackCheck, 5000);
      setTimeout(fallbackCheck, 10000);
    });
  }

  /**
   * Set map style
   * @param {string} styleName - Style name (e.g., 'outdoors', 'streets')
   * @returns {Promise<void>}
   */
  async setStyle(styleName) {
    if (!this.isInitialized || !this.map) {
      throw new Error('MapboxCore: Cannot set style - map not initialized');
    }

    try {
      const styleUrl = this.config.getStyleUrl(styleName);
      console.log(`MapboxCore: Setting style to ${styleName} (${styleUrl})`);
      
      this.map.setStyle(styleUrl);
      this.options.style = styleName;
      
      // Wait for style to load
      await new Promise((resolve) => {
        this.map.once('styledata', resolve);
      });
      
      console.log('MapboxCore: Style set successfully');
    } catch (error) {
      console.error('MapboxCore: Error setting style:', error);
      throw error;
    }
  }

  /**
   * Get current map center and zoom
   * @returns {Object} Current map state
   */
  getMapState() {
    if (!this.isInitialized || !this.map) {
      return null;
    }

    return {
      center: this.map.getCenter(),
      zoom: this.map.getZoom(),
      bearing: this.map.getBearing(),
      pitch: this.map.getPitch(),
      style: this.options.style
    };
  }

  /**
   * Set map view to specific location
   * @param {Object} state - Map state object
   * @param {Object} options - Animation options
   */
  setMapState(state, options = {}) {
    if (!this.isInitialized || !this.map) {
      console.warn('MapboxCore: Cannot set map state - map not initialized');
      return;
    }

    const defaultOptions = {
      duration: 1000,
      essential: true
    };

    this.map.easeTo({
      center: state.center,
      zoom: state.zoom,
      bearing: state.bearing || 0,
      pitch: state.pitch || 0,
      ...defaultOptions,
      ...options
    });
  }

  /**
   * Fit map to bounds
   * @param {Array} bounds - Bounds array [[west, south], [east, north]]
   * @param {Object} options - Fit bounds options
   */
  fitBounds(bounds, options = {}) {
    if (!this.isInitialized || !this.map) {
      console.warn('MapboxCore: Cannot fit bounds - map not initialized');
      return;
    }

    const defaultOptions = {
      padding: 50,
      duration: 1000
    };

    this.map.fitBounds(bounds, { ...defaultOptions, ...options });
  }

  /**
   * Resize map (call when container size changes)
   */
  resize() {
    if (this.isInitialized && this.map) {
      this.map.resize();
      console.log('MapboxCore: Map resized');
    }
  }

  /**
   * Get map instance (for advanced usage)
   * @returns {mapboxgl.Map|null} Map instance
   */
  getMap() {
    return this.map;
  }

  /**
   * Get config instance
   * @returns {MapboxConfig|null} Config instance
   */
  getConfig() {
    return this.config;
  }

  /**
   * Check if map is initialized
   * @returns {boolean} Initialization status
   */
  isReady() {
    return this.isInitialized && this.map && this.map.loaded();
  }

  /**
   * Get debug information
   * @returns {Object} Debug info
   */
  getDebugInfo() {
    return {
      containerId: this.containerId,
      isInitialized: this.isInitialized,
      isReady: this.isReady(),
      mapLoaded: this.map ? this.map.loaded() : false,
      currentStyle: this.options.style,
      mapState: this.getMapState(),
      containerExists: !!this.container,
      configLoaded: !!this.config
    };
  }

  /**
   * Clean up resources
   */
  cleanup() {
    console.log('MapboxCore: Starting cleanup...');
    
    try {
      if (this.map) {
        // Remove all event listeners
        this.map.off();
        
        // Remove map
        this.map.remove();
        this.map = null;
        console.log('MapboxCore: Map removed');
      }

      // Reset state
      this.isInitialized = false;
      this.container = null;
      this.config = null;
      
      console.log('MapboxCore: Cleanup completed');
    } catch (error) {
      console.error('MapboxCore: Error during cleanup:', error);
    }
  }
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MapboxCore;
} else if (typeof define === 'function' && define.amd) {
  define(function() { return MapboxCore; });
} else {
  window.MapboxCore = MapboxCore;
}