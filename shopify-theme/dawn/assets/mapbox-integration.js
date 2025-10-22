/**
 * MapboxIntegration.js - Lightweight Orchestrator for Modular Map Functionality
 * Provides the same API as the original monolithic version but uses modular architecture
 * 
 * Depends on:
 * - mapbox-gl.js (loaded via CDN)
 * - mapbox-config.js (configuration utilities)
 * - MapboxCore.js (core initialization)
 * - MapboxEventSystem.js (event handling) - ALREADY EXISTS
 * - MapboxResponsive.js (responsive behavior)
 * - MapboxExport.js (canvas export)
 * - MapboxRoutes.js (route rendering)
 * - MapboxControls.js (map controls)
 * - MapboxCustomization.js (style management)
 * - MapboxPerformance.js (performance monitoring)
 * 
 * Usage:
 * const mapIntegration = new MapboxIntegration('map-container');
 * mapIntegration.renderRouteMap(routeData);
 */

class MapboxIntegration {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.container = null;
    this.map = null;
    this.config = null;
    this.isInitialized = false;

    // Module instances
    this.core = null;
    this.eventSystem = null;
    this.responsive = null;
    this.exportModule = null;
    this.routes = null;
    this.controls = null;
    this.customization = null;
    this.performance = null;

    // Legacy properties for backward compatibility
    this.routeLayer = null;
    this.markersLayer = null;
    this.resizeObserver = null;
    this.resizeDebounceTimer = null;
    this.lastKnownDimensions = { width: 0, height: 0 };
    this.currentBreakpoint = null;
    this.orientationChangeHandler = null;

    // Route animation properties (delegated to routes module)
    this.routeAnimation = {
      isPlaying: false,
      isPaused: false,
      progress: 0,
      animationId: null,
      startTime: null,
      pausedTime: 0,
      duration: 5000,
      coordinates: [],
      currentSegment: 0
    };

    this.routeStats = {
      distance: 0,
      duration: 0,
      elevationGain: 0,
      waypoints: []
    };

    this.waypointMarkers = [];
    this.routeControls = null;

    // Default options (maintained for compatibility)
    this.options = Object.assign({
      style: 'outdoors',
      showControls: true,
      allowInteraction: true,
      enableExport: true,
      enableGeolocation: true,
      enableScale: true,
      routeColor: '#FF4444',
      routeWidth: 3,
      enableEventSystem: true,
      enableAnimation: true,
      animationDuration: 5000,
      animationSpeed: 1.0,
      showRouteStats: true,
      showWaypoints: false,
      waypointInterval: 1000,
      elevationProfile: false,
      eventSystemOptions: {
        enableEventHistory: true,
        enableGestureRecognition: true,
        enableAnalytics: false,
        logPerformanceMetrics: false
      },
      controlPositions: {
        navigation: 'top-right',
        fullscreen: 'top-right', 
        geolocation: 'top-right',
        scale: 'bottom-left',
        style: 'top-left',
        export: 'top-right'
      },
      mobileOptimized: true,
      responsive: {
        enabled: true,
        aspectRatio: 'auto',
        minHeight: 300,
        maxHeight: 800,
        breakpoints: {
          mobile: { max: 480, controls: 'minimal' },
          tablet: { min: 481, max: 768, controls: 'compact' },
          desktop: { min: 769, controls: 'full' }
        },
        resizeDebounce: 250,
        maintainCenter: true,
        adaptivePerformance: true
      }
    }, options);

    // Initialize modules
    this.initializeModules();

    // Bind methods for backward compatibility
    this.init = this.init.bind(this);
    this.renderRouteMap = this.renderRouteMap.bind(this);
    this.exportHighResolution = this.exportHighResolution.bind(this);
    this.resizeForPrintFormat = this.resizeForPrintFormat.bind(this);
    this.cleanup = this.cleanup.bind(this);

    // Initialize route persistence system
    this.initRoutePersistence();

    console.log('MapboxIntegration: Initialized with modular architecture');
  }

  /**
   * Initialize all modules
   */
  initializeModules() {
    try {
      // Core module (required)
      if (typeof MapboxCore !== 'undefined') {
        this.core = new MapboxCore(this.containerId, this.options);
      } else {
        throw new Error('MapboxCore module not available');
      }

      // Event system (use existing if available)
      if (typeof MapboxEventSystem !== 'undefined') {
        // Will be initialized with map instance later
      }

      // Responsive module
      if (typeof MapboxResponsive !== 'undefined') {
        this.responsive = new MapboxResponsive(this.core, this.options.responsive);
      }

      // Export module
      if (typeof MapboxExport !== 'undefined') {
        this.exportModule = new MapboxExport(this.core, this.options);
      }

      // Routes module
      if (typeof MapboxRoutes !== 'undefined') {
        this.routes = new MapboxRoutes(this.core, null, this.options); // EventSystem will be set later
      }

      // Controls module
      if (typeof MapboxControls !== 'undefined') {
        this.controls = new MapboxControls(this.core, this.exportModule, this.options);
      }

      // Customization module
      if (typeof MapboxCustomization !== 'undefined') {
        this.customization = new MapboxCustomization(this.core, this.routes, this, this.options);
      }

      // Performance module
      if (typeof MapboxPerformance !== 'undefined') {
        this.performance = new MapboxPerformance(this.core, this.options);
      }

      console.log('MapboxIntegration: All modules initialized');

    } catch (error) {
      console.error('MapboxIntegration: Error initializing modules:', error);
      throw error;
    }
  }

  /**
   * Initialize the map with base configuration
   * @returns {Promise<MapboxIntegration>} This instance for chaining
   */
  async init() {
    if (this.isInitialized) {
      return this;
    }

    try {
      console.log('MapboxIntegration: Starting initialization...');

      // Initialize core module
      await this.core.init();
      
      // Get map and config references
      this.map = this.core.getMap();
      this.config = this.core.getConfig();
      this.container = this.core.container;

      // Initialize event system if available
      if (typeof MapboxEventSystem !== 'undefined' && this.options.enableEventSystem) {
        this.eventSystem = new MapboxEventSystem(this.map, this.options.eventSystemOptions);
        
        // Update routes module with event system
        if (this.routes) {
          this.routes.eventSystem = this.eventSystem;
        }
      }

      // Initialize other modules with map instance
      if (this.responsive) {
        this.responsive.init(this.map, this.container);
      }

      if (this.exportModule) {
        this.exportModule.init(this.map, this.container, this.config);
      }

      if (this.routes) {
        this.routes.init(this.map);
      }

      if (this.controls) {
        this.controls.init(this.map, this.config);
        if (this.options.showControls) {
          this.controls.addMapControls();
        }
      }

      if (this.customization) {
        this.customization.init(this.map, this.config);
      }

      if (this.performance) {
        this.performance.init(this.map);
      }

      // Setup default event handlers
      this.setupDefaultEventHandlers();

      // Try to restore route for current activity ID if available (page refresh scenario)
      const currentActivityId = this.getCurrentActivityId();
      if (currentActivityId) {
        console.log('MapboxIntegration: Found activity ID on initialization, attempting route restoration:', currentActivityId);
        // Use setTimeout to allow other initialization to complete first
        setTimeout(async () => {
          const restorationSuccess = await this.tryRestoreRouteForActivity(currentActivityId);
          if (restorationSuccess) {
            console.log('MapboxIntegration: Successfully restored route for activity on page load:', currentActivityId);
          } else {
            console.warn('MapboxIntegration: Failed to restore route for activity on page load:', currentActivityId);
          }
        }, 500);
      }

      this.isInitialized = true;
      console.log('MapboxIntegration: Initialization completed successfully');
      
      return this;

    } catch (error) {
      console.error('MapboxIntegration: Initialization failed:', error);
      this.cleanup();
      throw error;
    }
  }

  /**
   * Setup default event handlers for backward compatibility
   */
  setupDefaultEventHandlers() {
    if (!this.eventSystem) return;

    // Delegate event handling to appropriate modules
    this.eventSystem.on('route-clicked', (eventData) => {
      this.handleRouteClick(eventData);
    });

    this.eventSystem.on('export-started', (eventData) => {
      this.handleExportStarted(eventData);
    });

    this.eventSystem.on('export-completed', (eventData) => {
      this.handleExportCompleted(eventData);
    });

    this.eventSystem.on('style-changed', (eventData) => {
      this.handleStyleChange(eventData);
    });

    console.log('MapboxIntegration: Default event handlers setup complete');
  }

  /**
   * Main method to render route on map
   * @param {Object} routeData - GeoJSON route data
   * @param {Object} customization - Route customization options
   * @param {Object} stats - Route statistics
   */
  async renderRouteMap(routeData, customization = {}, stats = {}) {
    if (!this.isInitialized) {
      await this.init();
    }

    if (!this.routes) {
      throw new Error('MapboxIntegration: Routes module not available');
    }

    // Additional safety check to ensure map and style are fully loaded
    if (this.map && !this.map.isStyleLoaded()) {
      console.log('MapboxIntegration: Waiting for map style to be fully loaded before rendering route...');
      await new Promise((resolve) => {
        if (this.map.isStyleLoaded()) {
          resolve();
        } else {
          this.map.once('styledata', () => {
            if (this.map.isStyleLoaded()) {
              console.log('MapboxIntegration: Map style now loaded, proceeding with route render');
              resolve();
            }
          });
          
          // Fallback timeout
          setTimeout(() => {
            console.log('MapboxIntegration: Proceeding with route render after timeout');
            resolve();
          }, 3000);
        }
      });
    }

    try {
      // Delegate to routes module
      await this.routes.renderRouteMap(routeData, customization, stats);

      // Update legacy properties for backward compatibility
      this.updateLegacyProperties();

      console.log('MapboxIntegration: Route map rendered successfully');

    } catch (error) {
      console.error('MapboxIntegration: Route rendering failed:', error);
      throw error;
    }
  }

  /**
   * Export high-resolution map for printing
   * @param {string} format - Export format (A4, A3, etc.)
   * @param {number} targetDPI - Target DPI (default: 300)
   * @param {Object} options - Export options
   */
  async exportHighResolution(format = 'A4', targetDPI = 300, options = {}) {
    if (!this.exportModule) {
      throw new Error('MapboxIntegration: Export module not available');
    }

    return await this.exportModule.exportHighResolution(format, targetDPI, options);
  }

  /**
   * Resize map for print format
   * @param {string} format - Print format
   * @param {string} orientation - Print orientation
   * @param {number} quality - Quality setting
   * @param {Object} options - Additional options
   */
  async resizeForPrintFormat(format, orientation, quality = 300, options = {}) {
    if (!this.exportModule) {
      throw new Error('MapboxIntegration: Export module not available');
    }

    return await this.exportModule.resizeForPrintFormat(format, orientation, quality, options);
  }

  /**
   * Set map style with route preservation
   * @param {string} styleName - Style name
   */
  async setStyle(styleName) {
    if (!this.core) {
      throw new Error('MapboxIntegration: Core not available');
    }

    try {
      console.log('MapboxIntegration: Starting style change process...');
      
      // Store current style before change
      const previousStyle = this.core.options.style;
      
      // Capture current route state BEFORE style change
      const routeState = this.getCurrentRouteState();
      
      console.log('MapboxIntegration: Changing style from', previousStyle, 'to', styleName);
      
      if (routeState) {
        console.log('MapboxIntegration: Route state captured for restoration:', {
          coordinateCount: routeState.coordinates.length,
          hasCustomization: !!routeState.customization,
          hasAnimation: routeState.animation.isPlaying || routeState.animation.isPaused
        });
      } else {
        console.log('MapboxIntegration: No route state found - proceeding with simple style change');
      }

      // Change the style (this clears all layers and sources)
      await this.core.setStyle(styleName);
      console.log('MapboxIntegration: Core style change completed');

      // Wait a brief moment for style to fully initialize
      await new Promise(resolve => setTimeout(resolve, 100));

      // Emit style-changed event
      if (this.eventSystem) {
        this.eventSystem.emit('style-changed', {
          previousStyle: previousStyle,
          newStyle: styleName,
          routeState: routeState,
          timestamp: Date.now()
        });
      }

      // Attempt route restoration if we have route state
      if (routeState && routeState.hasRoute) {
        try {
          console.log('MapboxIntegration: Attempting route restoration...');
          const restorationSuccess = await this.handleStyleChangeWithRestore(routeState, previousStyle, styleName);
          
          if (restorationSuccess) {
            console.log('MapboxIntegration: Style change completed with successful route restoration');
            return true;
          } else {
            console.warn('MapboxIntegration: Style change completed but route restoration failed');
            // Don't throw error - style change was successful even if restoration failed
            return true;
          }
        } catch (restorationError) {
          console.error('MapboxIntegration: Route restoration failed after style change:', restorationError);
          
          // Try to trigger error recovery as fallback
          if (window.mapErrorRecovery) {
            console.log('MapboxIntegration: Triggering error recovery as fallback...');
            try {
              await window.mapErrorRecovery.recoverFromError(
                {
                  type: 'route_restoration_failed',
                  message: restorationError.message,
                  originalError: restorationError
                },
                this.map,
                {
                  coordinates: routeState.coordinates,
                  stats: routeState.routeStats,
                  customization: routeState.customization
                }
              );
            } catch (recoveryError) {
              console.error('MapboxIntegration: Error recovery also failed:', recoveryError);
            }
          }
          
          // Don't fail the entire style change for restoration failure
          return true;
        }
      } else {
        console.log('MapboxIntegration: No route to restore - style change completed');
        return true;
      }

    } catch (error) {
      console.error('MapboxIntegration: Style change failed:', error);
      throw error;
    }
  }

  /**
   * Handle style change with route restoration
   * @param {Object} routeState - Captured route state
   * @param {string} previousStyle - Previous style name
   * @param {string} newStyle - New style name
   * @returns {Promise<boolean>} Restoration success
   */
  async handleStyleChangeWithRestore(routeState, previousStyle, newStyle) {
    if (!this.routes) {
      console.warn('MapboxIntegration: No routes module available for restoration');
      return false;
    }

    if (!routeState || !routeState.coordinates || routeState.coordinates.length === 0) {
      console.error('MapboxIntegration: Invalid route state for restoration:', routeState);
      return false;
    }

    console.log(`MapboxIntegration: Starting route restoration with retry mechanism (${routeState.coordinates.length} coordinates)`);

    // Retry configuration
    const maxRetries = 3;
    const retryDelay = 500; // 500ms

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`MapboxIntegration: Route restoration attempt ${attempt}/${maxRetries}`);
        
        // Wait for map to be fully ready before restoration
        await this.waitForMapReady();
        
        // Attempt restoration
        const restorationSuccess = await this.routes.restoreRoute(routeState);
        
        if (restorationSuccess) {
          console.log(`MapboxIntegration: Route successfully restored after style change (attempt ${attempt})`);
          
          // Validate that restoration actually worked
          const validationResult = await this.validateRouteRestoration(routeState);
          
          if (validationResult.success) {
            console.log('MapboxIntegration: Route restoration validated successfully');
            
            // Emit successful restoration event
            if (this.eventSystem) {
              this.eventSystem.emit('route-restoration-completed', {
                previousStyle: previousStyle,
                newStyle: newStyle,
                routeState: routeState,
                attempt: attempt,
                validation: validationResult,
                timestamp: Date.now()
              });
            }
            
            return true;
          } else {
            console.warn(`MapboxIntegration: Route restoration validation failed (attempt ${attempt}):`, validationResult.errors);
            
            if (attempt === maxRetries) {
              throw new Error(`Route restoration validation failed after ${maxRetries} attempts: ${validationResult.errors.join(', ')}`);
            }
            
            // Continue to retry
          }
        } else {
          console.warn(`MapboxIntegration: Route restoration returned false (attempt ${attempt})`);
          
          if (attempt === maxRetries) {
            throw new Error(`Route restoration failed after ${maxRetries} attempts`);
          }
        }
        
      } catch (error) {
        console.error(`MapboxIntegration: Route restoration attempt ${attempt} threw error:`, error);
        
        if (attempt === maxRetries) {
          // Final attempt failed - emit failure event and rethrow
          if (this.eventSystem) {
            this.eventSystem.emit('route-restoration-failed', {
              error: error.message,
              routeState: routeState,
              previousStyle: previousStyle,
              newStyle: newStyle,
              attemptsUsed: maxRetries,
              timestamp: Date.now()
            });
          }
          
          throw error;
        }
      }
      
      // Wait before retry (except on last attempt)
      if (attempt < maxRetries) {
        console.log(`MapboxIntegration: Waiting ${retryDelay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
    
    return false;
  }

  /**
   * Wait for map to be ready for route operations
   * @returns {Promise<void>}
   */
  async waitForMapReady() {
    if (!this.map) {
      throw new Error('Map instance not available');
    }

    if (this.map.loaded() && this.map.isStyleLoaded()) {
      return; // Already ready
    }

    console.log('MapboxIntegration: Waiting for map to be ready...');

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Map ready timeout after 5 seconds'));
      }, 5000);

      const checkReady = () => {
        if (this.map.loaded() && this.map.isStyleLoaded()) {
          clearTimeout(timeout);
          console.log('MapboxIntegration: Map is ready');
          resolve();
        } else {
          setTimeout(checkReady, 100);
        }
      };

      checkReady();
    });
  }

  /**
   * Validate that route restoration was successful
   * @param {Object} expectedState - Expected route state
   * @returns {Promise<Object>} Validation result
   */
  async validateRouteRestoration(expectedState) {
    console.log('MapboxIntegration: Validating route restoration...');
    
    const validation = {
      success: true,
      errors: [],
      warnings: []
    };

    try {
      // Check if current route state matches expected
      const currentState = this.getCurrentRouteState();
      
      if (!currentState || !currentState.hasRoute) {
        validation.success = false;
        validation.errors.push('No current route found after restoration');
        return validation;
      }

      if (!currentState.coordinates || currentState.coordinates.length === 0) {
        validation.success = false;
        validation.errors.push('No coordinates found in current route after restoration');
        return validation;
      }

      // Check coordinate count
      const expectedCount = expectedState.coordinates.length;
      const actualCount = currentState.coordinates.length;
      
      if (actualCount !== expectedCount) {
        validation.warnings.push(`Coordinate count mismatch: expected ${expectedCount}, got ${actualCount}`);
      }

      // Check if route is visually present on map
      if (this.map && this.map.getLayer('route-line')) {
        const layer = this.map.getLayer('route-line');
        if (layer) {
          console.log('MapboxIntegration: Route layer exists on map');
        } else {
          validation.success = false;
          validation.errors.push('Route layer not found on map after restoration');
        }
      } else {
        validation.success = false;
        validation.errors.push('Route layer missing from map after restoration');
      }

      // Check route source data
      if (this.map && this.map.getSource('route')) {
        const source = this.map.getSource('route');
        const sourceData = source._data;
        
        if (!sourceData || !sourceData.geometry || !sourceData.geometry.coordinates) {
          validation.success = false;
          validation.errors.push('Route source has no coordinate data after restoration');
        } else {
          const sourceCoordCount = sourceData.geometry.coordinates.length;
          console.log(`MapboxIntegration: Route source has ${sourceCoordCount} coordinates`);
        }
      } else {
        validation.success = false;
        validation.errors.push('Route source not found on map after restoration');
      }

      console.log('MapboxIntegration: Route restoration validation completed', validation);
      return validation;

    } catch (error) {
      validation.success = false;
      validation.errors.push(`Validation error: ${error.message}`);
      console.error('MapboxIntegration: Route restoration validation failed:', error);
      return validation;
    }
  }

  /**
   * Clean up expired route persistence data
   * @param {number} maxAge - Maximum age in milliseconds (default: 24 hours)
   */
  cleanupExpiredRouteData(maxAge = 24 * 60 * 60 * 1000) {
    console.log('MapboxIntegration: Cleaning up expired route persistence data...');
    
    const now = Date.now();
    
    try {
      // Check localStorage backup
      const localState = localStorage.getItem('routeStateBackup');
      if (localState) {
        const parsed = JSON.parse(localState);
        if (parsed.captureTimestamp && (now - parsed.captureTimestamp) > maxAge) {
          localStorage.removeItem('routeStateBackup');
          console.log('MapboxIntegration: Removed expired localStorage backup');
        }
      }
    } catch (e) {
      console.warn('MapboxIntegration: Error cleaning localStorage backup:', e);
      localStorage.removeItem('routeStateBackup'); // Remove corrupted data
    }
    
    try {
      // Check sessionStorage
      const sessionState = sessionStorage.getItem('currentRouteState');
      if (sessionState) {
        const parsed = JSON.parse(sessionState);
        if (parsed.captureTimestamp && (now - parsed.captureTimestamp) > maxAge) {
          sessionStorage.removeItem('currentRouteState');
          console.log('MapboxIntegration: Removed expired sessionStorage data');
        }
      }
    } catch (e) {
      console.warn('MapboxIntegration: Error cleaning sessionStorage:', e);
      sessionStorage.removeItem('currentRouteState'); // Remove corrupted data
    }
  }

  /**
   * Get route persistence status and information
   * @returns {Object} Persistence status information
   */
  getRoutePersistenceStatus() {
    const status = {
      hasLocalStorage: false,
      hasSessionStorage: false,
      localStorageAge: null,
      sessionStorageAge: null,
      localStorageSize: 0,
      sessionStorageSize: 0
    };
    
    const now = Date.now();
    
    try {
      const localState = localStorage.getItem('routeStateBackup');
      if (localState) {
        status.hasLocalStorage = true;
        status.localStorageSize = localState.length;
        
        const parsed = JSON.parse(localState);
        if (parsed.captureTimestamp) {
          status.localStorageAge = now - parsed.captureTimestamp;
        }
      }
    } catch (e) {
      console.warn('MapboxIntegration: Error reading localStorage status:', e);
    }
    
    try {
      const sessionState = sessionStorage.getItem('currentRouteState');
      if (sessionState) {
        status.hasSessionStorage = true;
        status.sessionStorageSize = sessionState.length;
        
        const parsed = JSON.parse(sessionState);
        if (parsed.captureTimestamp) {
          status.sessionStorageAge = now - parsed.captureTimestamp;
        }
      }
    } catch (e) {
      console.warn('MapboxIntegration: Error reading sessionStorage status:', e);
    }
    
    return status;
  }

  /**
   * Force save current route state to both storage types
   */
  forceSaveRouteState() {
    console.log('MapboxIntegration: Force saving current route state...');
    
    const state = this.getCurrentRouteState();
    if (!state) {
      console.warn('MapboxIntegration: No route state to save');
      return false;
    }
    
    try {
      // Save to both storage types
      localStorage.setItem('routeStateBackup', JSON.stringify(state));
      sessionStorage.setItem('currentRouteState', JSON.stringify(state));
      
      console.log('MapboxIntegration: Route state force saved to both storage types');
      return true;
    } catch (e) {
      console.error('MapboxIntegration: Failed to force save route state:', e);
      return false;
    }
  }

  /**
   * Initialize route persistence system
   */
  initRoutePersistence() {
    console.log('MapboxIntegration: Initializing route persistence system...');
    
    // Clean up expired data on initialization
    this.cleanupExpiredRouteData();
    
    // Set up periodic cleanup (every 30 minutes)
    if (this._persistenceCleanupInterval) {
      clearInterval(this._persistenceCleanupInterval);
    }
    
    this._persistenceCleanupInterval = setInterval(() => {
      this.cleanupExpiredRouteData();
    }, 30 * 60 * 1000); // 30 minutes
    
    // Set up beforeunload handler to save current state
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        console.log('MapboxIntegration: Page unloading, saving current route state...');
        this.forceSaveRouteState();
      });
    }
    
    console.log('MapboxIntegration: Route persistence system initialized');
  }

  /**
   * Clear route from map
   */
  clearRoute() {
    if (this.routes) {
      this.routes.clearRoute();
      this.updateLegacyProperties();
    }
  }

  /**
   * Start route animation
   */
  startRouteAnimation() {
    if (this.routes) {
      this.routes.startRouteAnimation();
      this.updateLegacyProperties();
    }
  }

  /**
   * Pause route animation
   */
  pauseRouteAnimation() {
    if (this.routes) {
      this.routes.pauseRouteAnimation();
      this.updateLegacyProperties();
    }
  }

  /**
   * Stop route animation
   */
  stopRouteAnimation() {
    if (this.routes) {
      this.routes.stopRouteAnimation();
      this.updateLegacyProperties();
    }
  }

  /**
   * Reset route animation
   */
  resetRouteAnimation() {
    if (this.routes) {
      this.routes.resetRouteAnimation();
      this.updateLegacyProperties();
    }
  }

  /**
   * Update legacy properties for backward compatibility
   */
  updateLegacyProperties() {
    if (this.routes) {
      const routeState = this.routes.getRouteState();
      this.routeAnimation = routeState.animation;
      this.routeStats = routeState.stats;
    }

    if (this.responsive) {
      const responsiveState = this.responsive.getResponsiveState();
      this.currentBreakpoint = responsiveState.breakpoint;
      this.lastKnownDimensions = responsiveState.dimensions;
    }
  }

  /**
   * Event handlers for backward compatibility
   */
  handleRouteClick(eventData) {
    console.log('MapboxIntegration: Route clicked', eventData);
  }

  handleExportStarted(eventData) {
    console.log('MapboxIntegration: Export started', eventData);
  }

  handleExportCompleted(eventData) {
    console.log('MapboxIntegration: Export completed', eventData);
  }

  async handleStyleChange(eventData) {
    console.log('MapboxIntegration: Style changed event received', eventData);

    // If we have route state, use the improved restoration method
    if (eventData.routeState && eventData.routeState.hasRoute && this.routes) {
      try {
        console.log('MapboxIntegration: Handling route restoration via handleStyleChange...');
        
        const restorationSuccess = await this.handleStyleChangeWithRestore(
          eventData.routeState, 
          eventData.previousStyle, 
          eventData.newStyle
        );
        
        if (restorationSuccess) {
          console.log('MapboxIntegration: Route restored successfully via event handler');
        } else {
          console.warn('MapboxIntegration: Route restoration failed via event handler');
        }
        
      } catch (error) {
        console.error('MapboxIntegration: Failed to restore route via event handler:', error);
        
        // Try error recovery as last resort
        if (window.mapErrorRecovery) {
          console.log('MapboxIntegration: Attempting error recovery from event handler...');
          try {
            await window.mapErrorRecovery.recoverFromError(
              {
                type: 'route_restoration_failed',
                message: error.message,
                context: 'style_change_event_handler'
              },
              this.map,
              {
                coordinates: eventData.routeState.coordinates,
                stats: eventData.routeState.routeStats,
                customization: eventData.routeState.customization
              }
            );
          } catch (recoveryError) {
            console.error('MapboxIntegration: Error recovery from event handler failed:', recoveryError);
          }
        }
      }
    } else {
      console.log('MapboxIntegration: No route to restore after style change event');
    }
  }

  /**
   * Public API: Subscribe to custom events
   */
  on(eventType, callback, options = {}) {
    if (this.eventSystem) {
      return this.eventSystem.on(eventType, callback, options);
    } else {
      console.warn('MapboxIntegration: Event system not initialized');
      return this;
    }
  }

  /**
   * Public API: Unsubscribe from events
   */
  off(eventType, callback) {
    if (this.eventSystem) {
      return this.eventSystem.off(eventType, callback);
    }
    return this;
  }

  /**
   * Public API: Emit custom events
   */
  emit(eventType, data = {}) {
    if (this.eventSystem) {
      return this.eventSystem.emit(eventType, data);
    }
    return this;
  }

  /**
   * Get current map state
   */
  getMapState() {
    if (this.core) {
      return this.core.getMapState();
    }
    return null;
  }

  /**
   * Get current activity ID from multiple sources for route-activity linking
   * Priority: URL params > sessionStorage > localStorage > MapDesign integration
   */
  getCurrentActivityId() {
    console.log('MapboxIntegration: Getting current activity ID...');
    
    try {
      // Priority 1: URL parameters (most reliable for current session)
      const urlParams = new URLSearchParams(window.location.search);
      const urlActivityId = urlParams.get('activityId') || urlParams.get('activity_id');
      if (urlActivityId) {
        console.log('MapboxIntegration: Found activity ID in URL params:', urlActivityId);
        return urlActivityId;
      }
      
      // Priority 2: SessionStorage (current browser session)
      const sessionActivityId = sessionStorage.getItem('currentActivityId');
      if (sessionActivityId) {
        console.log('MapboxIntegration: Found activity ID in sessionStorage:', sessionActivityId);
        return sessionActivityId;
      }
      
      // Priority 3: LocalStorage (persisted across sessions)
      const localActivityId = localStorage.getItem('lastActivityId');
      if (localActivityId) {
        console.log('MapboxIntegration: Found activity ID in localStorage:', localActivityId);
        return localActivityId;
      }
      
      // Priority 4: Try to get from MapDesign integration if available
      if (window.mapDesign && typeof window.mapDesign.getActivityId === 'function') {
        const mapDesignActivityId = window.mapDesign.getActivityId();
        if (mapDesignActivityId) {
          console.log('MapboxIntegration: Found activity ID from MapDesign:', mapDesignActivityId);
          return mapDesignActivityId;
        }
      }
      
      // Priority 5: Check if MapDesign has currentActivityData
      if (window.mapDesign && window.mapDesign.currentActivityData && window.mapDesign.currentActivityData.id) {
        const currentActivityId = window.mapDesign.currentActivityData.id;
        console.log('MapboxIntegration: Found activity ID from MapDesign currentActivityData:', currentActivityId);
        return currentActivityId;
      }
      
      console.log('MapboxIntegration: No activity ID found in any source');
      return null;
      
    } catch (error) {
      console.error('MapboxIntegration: Error getting activity ID:', error);
      return null;
    }
  }

  /**
   * Responsive utility methods for backward compatibility
   */
  getCurrentBreakpoint() {
    if (this.responsive) {
      return this.responsive.getCurrentBreakpoint();
    }
    return 'desktop';
  }

  isDesktop() {
    if (this.responsive) {
      return this.responsive.isDesktop();
    }
    return window.innerWidth >= 769;
  }

  isMobile() {
    if (this.responsive) {
      return this.responsive.isMobile();
    }
    return window.innerWidth <= 480;
  }

  isTablet() {
    if (this.responsive) {
      return this.responsive.isTablet();
    }
    return window.innerWidth > 480 && window.innerWidth < 769;
  }

  isTouchDevice() {
    if (this.responsive) {
      return this.responsive.isTouchDevice();
    }
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  /**
   * Get current route state for style change preservation
   * @returns {Object|null} Current route state or null if no route
   */
  getCurrentRouteState() {
    console.log('MapboxIntegration: Starting getCurrentRouteState()...');
    
    if (!this.routes) {
      console.log('MapboxIntegration: No routes module available for state capture');
      return null;
    }

    const routeState = this.routes.getRouteState();
    if (!routeState || !routeState.hasRoute) {
      console.log('MapboxIntegration: No active route to capture state from');
      return null;
    }

    // Multiple validation checks for coordinate data
    const coordinates = this.routes.routeAnimation.coordinates;
    if (!coordinates || coordinates.length === 0) {
      console.warn('MapboxIntegration: Route exists but no coordinates found in routeAnimation - trying alternative sources');
      
      // Try to get coordinates from map source as fallback
      if (this.map && this.map.getSource('route')) {
        const routeSource = this.map.getSource('route');
        const sourceData = routeSource._data;
        if (sourceData && sourceData.geometry && sourceData.geometry.coordinates) {
          console.log('MapboxIntegration: Found coordinates in map source as fallback');
          const fallbackCoordinates = sourceData.geometry.coordinates;
          if (fallbackCoordinates.length > 0) {
            // Update the routes module with the fallback coordinates
            this.routes.routeAnimation.coordinates = [...fallbackCoordinates];
            console.log(`MapboxIntegration: Restored ${fallbackCoordinates.length} coordinates from map source`);
          }
        }
      }
      
      // Final check after fallback attempt
      if (!this.routes.routeAnimation.coordinates || this.routes.routeAnimation.coordinates.length === 0) {
        console.error('MapboxIntegration: No coordinates available from any source');
        return null;
      }
    }

    // Get the final coordinates (either original or from fallback)
    const finalCoordinates = this.routes.routeAnimation.coordinates;
    console.log(`MapboxIntegration: Successfully captured ${finalCoordinates.length} coordinates for state`);

    // Validate coordinate format
    if (!this.validateCoordinateFormat(finalCoordinates)) {
      console.error('MapboxIntegration: Coordinates failed format validation');
      return null;
    }

    // Get activity ID from various sources for route-activity linking
    const activityId = this.getCurrentActivityId();
    
    // Capture complete route state including all necessary data for restoration
    const completeState = {
      hasRoute: routeState.hasRoute,
      coordinates: [...finalCoordinates], // Deep copy of coordinates array
      routeStats: { ...this.routes.routeStats }, // Deep copy of stats
      customization: this.captureCurrentCustomization(),
      animation: {
        isPlaying: routeState.animation.isPlaying || false,
        isPaused: routeState.animation.isPaused || false,
        progress: this.routes.routeAnimation.progress || 0,
        duration: this.routes.routeAnimation.duration || 5000,
        animationSpeed: this.routes.options.animationSpeed || 1.0
      },
      // CRITICAL: Store activity ID for proper route restoration
      activityId: activityId,
      // Capture current map view state for restoration
      mapState: this.getMapState(),
      // Capture timestamp for debugging
      captureTimestamp: Date.now()
    };

    console.log('MapboxIntegration: Route state captured successfully', {
      coordinateCount: finalCoordinates.length,
      hasStats: !!completeState.routeStats.distance,
      hasCustomization: !!completeState.customization.routeColor,
      animationState: completeState.animation
    });

    // Save to localStorage for page refresh persistence
    try {
      localStorage.setItem('routeStateBackup', JSON.stringify(completeState));
      console.log('MapboxIntegration: Route state saved to localStorage backup');
    } catch (e) {
      console.warn('MapboxIntegration: Failed to save route state to localStorage:', e);
    }

    return completeState;
  }

  /**
   * Capture current customization settings from all sources
   * This method gets customization from multiple sources:
   * 1. Current map layer properties (most accurate)
   * 2. Routes module options (fallback)  
   * 3. UI controls (if available)
   * @returns {Object} Complete customization state
   */
  captureCurrentCustomization() {
    const customization = {
      // Default values
      routeColor: '#FF4444',
      routeWidth: 3,
      showStartEndMarkers: true,
      showWaypoints: false,
      format: 'A4',
      orientation: 'portrait',
      enableAnimation: true,
      showRouteStats: true
    };

    // 1. Get current styling from map layers (most accurate - what's actually displayed)
    if (this.map && this.map.getLayer('route-line')) {
      try {
        const currentColor = this.map.getPaintProperty('route-line', 'line-color');
        const currentWidth = this.map.getPaintProperty('route-line', 'line-width');
        
        if (currentColor) customization.routeColor = currentColor;
        if (currentWidth !== undefined) customization.routeWidth = currentWidth;
        
        console.log('MapboxIntegration: Captured customization from map layers:', {
          color: currentColor,
          width: currentWidth
        });
      } catch (error) {
        console.warn('MapboxIntegration: Could not read current map layer properties:', error);
      }
    }

    // 2. Get settings from routes module options (fallback)
    if (this.routes && this.routes.options) {
      Object.assign(customization, {
        routeColor: this.routes.options.routeColor || customization.routeColor,
        routeWidth: this.routes.options.routeWidth || customization.routeWidth,
        showStartEndMarkers: this.routes.options.showStartEndMarkers !== false,
        showWaypoints: this.routes.options.showWaypoints || false,
        format: this.routes.options.format || customization.format,
        orientation: this.routes.options.orientation || customization.orientation,
        enableAnimation: this.routes.options.enableAnimation !== false,
        showRouteStats: this.routes.options.showRouteStats !== false
      });
    }

    // 3. Try to get settings from UI controls (if available in map-design page)
    try {
      // Color from active color option
      const activeColorOption = document.querySelector('.color-option.active');
      if (activeColorOption && activeColorOption.dataset.color) {
        customization.routeColor = activeColorOption.dataset.color;
      }

      // Width from slider
      const widthSlider = document.getElementById('route-thickness-slider');
      if (widthSlider && widthSlider.value) {
        customization.routeWidth = parseInt(widthSlider.value);
      }

      // Format from active size option
      const activeSizeOption = document.querySelector('.size-option.active');
      if (activeSizeOption && activeSizeOption.dataset.size) {
        customization.format = activeSizeOption.dataset.size.toUpperCase();
      }

      // Orientation from active layout option
      const activeLayoutOption = document.querySelector('.layout-option.active');
      if (activeLayoutOption && activeLayoutOption.dataset.layout) {
        customization.orientation = activeLayoutOption.dataset.layout;
      }

      console.log('MapboxIntegration: Enhanced customization with UI controls');
    } catch (error) {
      console.log('MapboxIntegration: UI controls not available (normal for preview page)');
    }

    console.log('MapboxIntegration: Final captured customization:', customization);
    return customization;
  }

  /**
   * Validate coordinate format for route data
   * @param {Array} coordinates - Array of coordinate pairs
   * @returns {boolean} True if coordinates are valid
   */
  validateCoordinateFormat(coordinates) {
    if (!Array.isArray(coordinates) || coordinates.length === 0) {
      console.error('validateCoordinateFormat: Coordinates is not a valid array');
      return false;
    }

    // Check first few coordinates for proper format
    const sampleSize = Math.min(5, coordinates.length);
    for (let i = 0; i < sampleSize; i++) {
      const coord = coordinates[i];
      
      if (!Array.isArray(coord) || coord.length < 2) {
        console.error(`validateCoordinateFormat: Invalid coordinate at index ${i}:`, coord);
        return false;
      }
      
      const [lng, lat] = coord;
      if (typeof lng !== 'number' || typeof lat !== 'number') {
        console.error(`validateCoordinateFormat: Non-numeric coordinate at index ${i}:`, coord);
        return false;
      }
      
      if (isNaN(lng) || isNaN(lat)) {
        console.error(`validateCoordinateFormat: NaN coordinate at index ${i}:`, coord);
        return false;
      }
      
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        console.error(`validateCoordinateFormat: Out-of-bounds coordinate at index ${i}:`, coord);
        return false;
      }
    }

    console.log(`validateCoordinateFormat: Validated ${sampleSize} coordinates successfully`);
    return true;
  }

  /**
   * Debounced route state capture to prevent excessive state saves
   * @private
   */
  _debouncedStateCaptureTimeout = null;
  
  /**
   * Capture and save route state with debouncing
   * @param {number} delay - Debounce delay in milliseconds (default: 300ms)
   */
  debouncedRouteStateCapture(delay = 300) {
    if (this._debouncedStateCaptureTimeout) {
      clearTimeout(this._debouncedStateCaptureTimeout);
    }
    
    this._debouncedStateCaptureTimeout = setTimeout(() => {
      console.log('MapboxIntegration: Performing debounced route state capture');
      const state = this.getCurrentRouteState();
      if (state) {
        // Additional save to session storage for more immediate access
        try {
          sessionStorage.setItem('currentRouteState', JSON.stringify(state));
          console.log('MapboxIntegration: Route state saved to sessionStorage');
        } catch (e) {
          console.warn('MapboxIntegration: Failed to save to sessionStorage:', e);
        }
      }
    }, delay);
  }

  /**
   * Try to restore route state from storage if needed
   * @returns {Object|null} Restored route state or null
   */
  tryRestoreRouteFromStorage() {
    console.log('MapboxIntegration: Attempting to restore route from storage...');
    
    // Try sessionStorage first (most recent)
    try {
      const sessionState = sessionStorage.getItem('currentRouteState');
      if (sessionState) {
        const parsed = JSON.parse(sessionState);
        if (parsed && parsed.coordinates && parsed.coordinates.length > 0) {
          console.log('MapboxIntegration: Found route state in sessionStorage');
          return parsed;
        }
      }
    } catch (e) {
      console.warn('MapboxIntegration: Failed to parse sessionStorage state:', e);
    }
    
    // Try localStorage backup
    try {
      const localState = localStorage.getItem('routeStateBackup');
      if (localState) {
        const parsed = JSON.parse(localState);
        if (parsed && parsed.coordinates && parsed.coordinates.length > 0) {
          console.log('MapboxIntegration: Found route state in localStorage backup');
          return parsed;
        }
      }
    } catch (e) {
      console.warn('MapboxIntegration: Failed to parse localStorage backup:', e);
    }
    
    console.log('MapboxIntegration: No valid route state found in storage');
    return null;
  }

  /**
   * Try to restore route for a specific activity ID by triggering activity reload
   * This ensures that the correct route is loaded when page refreshes with an activity ID
   * @param {string} activityId - Activity ID to restore route for
   * @returns {Promise<boolean>} Success status
   */
  async tryRestoreRouteForActivity(activityId) {
    console.log('MapboxIntegration: Attempting to restore route for activity ID:', activityId);
    
    if (!activityId) {
      console.warn('MapboxIntegration: No activity ID provided for route restoration');
      return false;
    }
    
    try {
      // First check if we have a cached route state for this activity
      const cachedRouteState = this.tryRestoreRouteFromStorage();
      if (cachedRouteState && cachedRouteState.activityId === activityId) {
        console.log('MapboxIntegration: Found matching route state in storage for activity:', activityId);
        
        // Try to restore the cached route state directly
        const restorationSuccess = await this.routes.restoreRoute(cachedRouteState);
        if (restorationSuccess) {
          console.log('MapboxIntegration: Successfully restored route from cache for activity:', activityId);
          return true;
        }
      }
      
      // If no cached state or restoration failed, trigger activity reload from MapDesign
      if (window.mapDesign && typeof window.mapDesign.loadActivityData === 'function') {
        console.log('MapboxIntegration: Triggering activity reload from MapDesign for ID:', activityId);
        
        // Set the activity ID in storage first so MapDesign can find it
        sessionStorage.setItem('currentActivityId', activityId);
        localStorage.setItem('lastActivityId', activityId);
        
        // Trigger activity reload
        await window.mapDesign.loadActivityData();
        
        // Wait a bit for the route to be processed
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check if we now have a route
        if (this.routes && this.routes.hasRoute()) {
          console.log('MapboxIntegration: Successfully restored route via activity reload for ID:', activityId);
          return true;
        }
      }
      
      console.warn('MapboxIntegration: Failed to restore route for activity ID:', activityId);
      return false;
      
    } catch (error) {
      console.error('MapboxIntegration: Error restoring route for activity ID:', activityId, error);
      return false;
    }
  }

  /**
   * Update route color without triggering style change (direct layer update)
   * @param {string} color - Hex color value
   */
  updateRouteColor(color) {
    console.log('MapboxIntegration: Updating route color to', color, '(direct method)');
    
    // First try direct route layer update (no style change needed)
    if (this.routes && this.routes.updateRouteStyle) {
      try {
        this.routes.updateRouteStyle({ routeColor: color });
        console.log('MapboxIntegration: Route color updated directly via routes module');
        
        // Update the stored options for state persistence
        if (this.routes.options) {
          this.routes.options.routeColor = color;
        }
        
        // Capture state after successful change
        this.debouncedRouteStateCapture(100);
        return true;
      } catch (error) {
        console.warn('MapboxIntegration: Direct route color update failed, trying customization module:', error);
      }
    }
    
    // Fallback to customization module
    if (!this.customization) {
      console.warn('MapboxIntegration: No customization module available for updateRouteColor');
      return false;
    }

    try {
      this.customization.updateRouteStyle({ routeColor: color });
      console.log('MapboxIntegration: Route color updated via customization module');
      
      // Capture state after successful change
      this.debouncedRouteStateCapture(100);
      return true;
    } catch (error) {
      console.error('MapboxIntegration: Failed to update route color:', error);
      return false;
    }
  }

  /**
   * Update route style without triggering full style change
   * @param {Object} styleOptions - Style options (routeColor, routeWidth, etc.)
   */
  updateRouteStyle(styleOptions) {
    console.log('MapboxIntegration: Updating route style (direct method):', styleOptions);
    
    // First try direct route layer update (no style change needed)
    if (this.routes && this.routes.updateRouteStyle) {
      try {
        this.routes.updateRouteStyle(styleOptions);
        console.log('MapboxIntegration: Route style updated directly via routes module');
        
        // Update the stored options for state persistence
        if (this.routes.options) {
          Object.assign(this.routes.options, styleOptions);
        }
        
        // Capture state after successful change
        this.debouncedRouteStateCapture(100);
        return true;
      } catch (error) {
        console.warn('MapboxIntegration: Direct route style update failed, trying customization module:', error);
      }
    }
    
    // Fallback to customization module
    if (!this.customization) {
      console.warn('MapboxIntegration: Customization module not available for updateRouteStyle');
      return false;
    }

    try {
      this.customization.updateRouteStyle(styleOptions);
      console.log('MapboxIntegration: Route style updated via customization module');
      
      // Capture state after successful change
      this.debouncedRouteStateCapture(100);
      return true;
    } catch (error) {
      console.error('MapboxIntegration: Failed to update route style:', error);
      return false;
    }
  }

  /**
   * Get debug information
   */
  getDebugInfo() {
    return {
      isInitialized: this.isInitialized,
      containerId: this.containerId,
      modules: {
        core: !!this.core,
        eventSystem: !!this.eventSystem,
        responsive: !!this.responsive,
        export: !!this.exportModule,
        routes: !!this.routes,
        controls: !!this.controls,
        customization: !!this.customization,
        performance: !!this.performance
      },
      coreDebug: this.core ? this.core.getDebugInfo() : null,
      routeState: this.routes ? this.routes.getRouteState() : null,
      performanceMetrics: this.performance ? this.performance.getPerformanceMetrics() : null
    };
  }

  /**
   * Get event history for debugging
   */
  getEventHistory(eventType = null, limit = null) {
    if (this.eventSystem) {
      return this.eventSystem.getEventHistory(eventType, limit);
    }
    return [];
  }

  /**
   * Initialize custom track controls (stub for backward compatibility)
   */
  initializeCustomTrackControls() {
    console.log('MapboxIntegration: initializeCustomTrackControls called (delegated to modules)');
    return this;
  }

  /**
   * Initialize route functionality (stub for backward compatibility)
   */
  initializeRoute() {
    console.log('MapboxIntegration: initializeRoute called (delegated to routes module)');
    return this;
  }

  /**
   * Initialize map customization interface
   * @param {Object} options - Customization options
   */
  initMapCustomization(options = {}) {
    console.log('MapboxIntegration: Initializing map customization...');
    
    if (!this.customization) {
      console.warn('MapboxIntegration: Customization module not available');
      return;
    }

    try {
      // Initialize the customization module
      this.customization.initMapCustomization(options);
      console.log('MapboxIntegration: Map customization initialized successfully');
    } catch (error) {
      console.error('MapboxIntegration: Failed to initialize map customization:', error);
    }
  }

  /**
   * Show customization panel
   */
  showCustomizationPanel() {
    if (this.customization && this.customization.showCustomizationPanel) {
      this.customization.showCustomizationPanel();
    } else {
      console.warn('MapboxIntegration: Customization panel not available');
    }
  }

  /**
   * Hide customization panel
   */
  hideCustomizationPanel() {
    if (this.customization && this.customization.hideCustomizationPanel) {
      this.customization.hideCustomizationPanel();
    } else {
      console.warn('MapboxIntegration: Customization panel not available');
    }
  }

  /**
   * Load customization state
   */
  loadCustomizationState() {
    if (this.customization && this.customization.loadCustomizationState) {
      this.customization.loadCustomizationState();
    } else {
      console.warn('MapboxIntegration: Load customization state not available');
    }
  }

  /**
   * Save customization state
   */
  saveCustomizationState() {
    if (this.customization && this.customization.saveCustomizationState) {
      this.customization.saveCustomizationState();
    } else {
      console.warn('MapboxIntegration: Save customization state not available');
    }
  }

  /**
   * Clean up all modules and resources
   */
  cleanup() {
    console.log('MapboxIntegration: Starting cleanup...');

    try {
      // Cleanup modules in reverse order
      if (this.performance) {
        this.performance.cleanup();
        this.performance = null;
      }

      if (this.customization) {
        this.customization.cleanup();
        this.customization = null;
      }

      if (this.controls) {
        this.controls.cleanup();
        this.controls = null;
      }

      if (this.routes) {
        this.routes.cleanup();
        this.routes = null;
      }

      if (this.exportModule) {
        this.exportModule.cleanup();
        this.exportModule = null;
      }

      if (this.responsive) {
        this.responsive.cleanup();
        this.responsive = null;
      }

      if (this.eventSystem) {
        this.eventSystem.cleanup();
        this.eventSystem = null;
      }

      if (this.core) {
        this.core.cleanup();
        this.core = null;
      }

      // Reset state
      this.isInitialized = false;
      this.map = null;
      this.config = null;
      this.container = null;

      console.log('MapboxIntegration: Cleanup completed successfully');

    } catch (error) {
      console.error('MapboxIntegration: Error during cleanup:', error);
    }
  }
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MapboxIntegration;
} else if (typeof define === 'function' && define.amd) {
  define(function() { return MapboxIntegration; });
} else {
  window.MapboxIntegration = MapboxIntegration;
}