/**
 * Mapbox GL JS Integration Component for Shopify Dawn Theme
 * Provides map rendering, customization, and high-resolution export functionality
 * 
 * Depends on:
 * - mapbox-gl.js (loaded via CDN)
 * - mapbox-config.js (configuration utilities)
 * 
 * Usage:
 * const mapIntegration = new MapboxIntegration('map-container');
 * mapIntegration.renderRouteMap(routeData);
 */

class MapboxIntegration {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.container = null; // Will be assigned during init()
    this.map = null;
    this.config = null;
    this.eventSystem = null;
    this.routeLayer = null;
    this.markersLayer = null;
    this.isInitialized = false;
    this.resizeObserver = null;
    this.resizeDebounceTimer = null;
    this.lastKnownDimensions = { width: 0, height: 0 };
    this.currentBreakpoint = null;
    this.orientationChangeHandler = null;

    // Route animation and visualization properties
    this.routeAnimation = {
      isPlaying: false,
      isPaused: false,
      progress: 0,
      animationId: null,
      startTime: null,
      pausedTime: 0,
      duration: 5000, // Default 5 seconds
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

    // Default options with responsive enhancements
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
      // Route animation options
      enableAnimation: true,
      animationDuration: 5000, // 5 seconds default
      animationSpeed: 1.0, // 1x speed
      showRouteStats: true,
      showWaypoints: false, // Disabled by default for cleaner route display
      waypointInterval: 1000, // Every 1km
      elevationProfile: false, // Disabled by default (requires elevation data)
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
      // Responsive configuration
      responsive: {
        enabled: true,
        aspectRatio: 'auto', // 'auto', '16:9', '4:3', '1:1' or null for flexible
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

    // Initialize performance optimizations
    this.initializePerformanceOptimizations();
    
    // Initialize memory management
    this.initializeMemoryManagement();
    
    // Initialize progressive loading
    this.initializeProgressiveLoading();

    // Initialize activity-based styling system
    this.initializeActivityStyling();

    // Initialize canvas size manager
    this.canvasSizeManager = null;
    this.initializeCanvasSizeManager();

    // Bind methods
    this.init = this.init.bind(this);
    this.renderRouteMap = this.renderRouteMap.bind(this);
    this.exportHighResolution = this.exportHighResolution.bind(this);
    this.resizeForPrintFormat = this.resizeForPrintFormat.bind(this);
    this.updateCanvasSize = this.updateCanvasSize.bind(this);
    this.cleanup = this.cleanup.bind(this);

    // Store container ID for validation during init (after DOM is ready)
    this.containerId = containerId;
    this.container = null; // Will be found during init()
  }

  /**
   * Initialize the map with base configuration
   */
  async init() {
    if (this.isInitialized) {
      return this;
    }

    try {
      // Validate container exists in DOM
      this.container = document.getElementById(this.containerId);
      if (!this.container) {
        throw new Error(`Container '${this.containerId}' not found in DOM. Make sure the element exists when MapboxIntegration.init() is called.`);
      }
      console.log(`MapboxIntegration: Container '${this.containerId}' found successfully`);

      // Validate dependencies
      if (typeof mapboxgl === 'undefined') {
        throw new Error('Mapbox GL JS is not loaded');
      }

      if (typeof MapboxConfig === 'undefined') {
        throw new Error('MapboxConfig is not loaded');
      }

      // Initialize configuration (now async)
      this.config = await MapboxConfig.init();

      // Validate dependencies
      MapboxConfig.validateDependencies();

      // Create map with optimized options for browser compatibility
      const mapOptions = this.config.getOptimizedMapOptions({
        container: this.containerId,
        style: this.config.getStyleUrl(this.options.style),
        center: [0, 0], // Will be set when route is loaded
        zoom: 10,
        interactive: this.options.allowInteraction
      });

      this.map = new mapboxgl.Map(mapOptions);

      // Apply browser-specific optimizations after map creation
      this.applyBrowserSpecificOptimizations();

      // Initialize object pools now that map is available
      this.initializeObjectPools();

      // Add controls if enabled
      if (this.options.showControls) {
        this.addMapControls();
      }

      // Wait for map to load
      await new Promise((resolve) => {
        this.map.on('load', resolve);
      });

      // Initialize event system if enabled
      if (this.options.enableEventSystem && typeof MapboxEventSystem !== 'undefined') {
        this.initializeEventSystem();
      }

      // Setup responsive handling after map is loaded
      this.setupResponsiveHandling();

      // Apply saved style settings
      this.applySavedStyleSettings();

      // Load saved customization state
      this.loadCustomizationState();

      this.isInitialized = true;
      console.log('MapboxIntegration: Initialized successfully');
      
      return this;

    } catch (error) {
      console.error('MapboxIntegration: Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize the comprehensive event system
   */
  initializeEventSystem() {
    try {
      console.log('MapboxIntegration: Initializing event system...');
      
      this.eventSystem = new MapboxEventSystem(this.map, this.options.eventSystemOptions);
      
      // Set up default event handlers for map functionality
      this.setupDefaultEventHandlers();
      
      console.log('MapboxIntegration: Event system initialized successfully');
      
    } catch (error) {
      console.error('MapboxIntegration: Failed to initialize event system:', error);
      this.eventSystem = null;
    }
  }

  /**
   * Set up default event handlers for enhanced map functionality
   */
  setupDefaultEventHandlers() {
    if (!this.eventSystem) return;

    // Route interaction events
    this.eventSystem.on('route-clicked', (eventData) => {
      this.handleRouteClick(eventData);
    });

    this.eventSystem.on('feature-hover', (eventData) => {
      this.handleFeatureHover(eventData);
    });

    this.eventSystem.on('feature-hover-out', (eventData) => {
      this.handleFeatureHoverOut(eventData);
    });

    // Map interaction events
    this.eventSystem.on('map-empty-click', (eventData) => {
      this.handleMapEmptyClick(eventData);
    });

    this.eventSystem.on('map-double-click', (eventData) => {
      this.handleMapDoubleClick(eventData);
    });

    // Touch and gesture events
    this.eventSystem.on('gesture-pinch', (eventData) => {
      this.handlePinchGesture(eventData);
    });

    this.eventSystem.on('gesture-rotate', (eventData) => {
      this.handleRotateGesture(eventData);
    });

    // System events
    this.eventSystem.on('system-error', (eventData) => {
      this.handleSystemError(eventData);
    });

    // Export events
    this.eventSystem.on('export-started', (eventData) => {
      this.handleExportStarted(eventData);
    });

    this.eventSystem.on('export-completed', (eventData) => {
      this.handleExportCompleted(eventData);
    });
  }

  /**
   * Setup event handlers for map customization features
   * Handles style changes, color adjustments, and UI customization events
   */
  setupCustomizationEventHandlers() {
    if (!this.eventSystem) return;

    // Style customization events
    this.eventSystem.on('style-changed', (eventData) => {
      this.handleStyleChange(eventData);
    });

    this.eventSystem.on('color-changed', (eventData) => {
      this.handleColorChange(eventData);
    });

    // UI customization events
    this.eventSystem.on('customization-panel-toggle', (eventData) => {
      this.handleCustomizationPanelToggle(eventData);
    });

    // Route customization events
    this.eventSystem.on('route-style-update', (eventData) => {
      this.handleRouteStyleUpdate(eventData);
    });

    console.log('MapboxIntegration: Customization event handlers initialized');
  }

  /**
   * Handle route click events
   */
  handleRouteClick(eventData) {
    console.log('Route clicked:', eventData.clickedRoute);
    
    // Show route information popup
    if (eventData.coordinates) {
      const popup = new mapboxgl.Popup()
        .setLngLat([eventData.coordinates.lng, eventData.coordinates.lat])
        .setHTML(`
          <div style="padding: 10px;">
            <h4 style="margin: 0 0 8px 0;">Route Information</h4>
            <p style="margin: 0; font-size: 12px;">
              Click position: ${eventData.coordinates.lat.toFixed(6)}, ${eventData.coordinates.lng.toFixed(6)}
            </p>
          </div>
        `)
        .addTo(this.map);
    }

    // Emit custom event for external listeners
    this.emit('route-interaction', eventData);
  }

  /**
   * Handle feature hover events
   */
  handleFeatureHover(eventData) {
    // Add visual feedback for hovered features
    if (eventData.hoveredFeatures && eventData.hoveredFeatures.length > 0) {
      const feature = eventData.hoveredFeatures[0];
      
      // Highlight route segments and show detailed information
      if (feature.layer?.id?.includes('route')) {
        this.highlightRouteSegment(feature);
        this.showSegmentInfo(feature, eventData.coordinates);
      }
    }

    this.emit('feature-hover', eventData);
  }

  /**
   * Handle feature hover out events
   */
  handleFeatureHoverOut(eventData) {
    // Remove visual feedback and segment info
    this.removeRouteHighlight();
    this.hideSegmentInfo();
    this.emit('feature-hover-out', eventData);
  }

  /**
   * Handle empty map area clicks
   */
  handleMapEmptyClick(eventData) {
    // Close any open popups
    if (this.map._popup) {
      this.map._popup.remove();
    }

    this.emit('map-empty-click', eventData);
  }

  /**
   * Handle map double-click events
   */
  handleMapDoubleClick(eventData) {
    // Custom double-click behavior - focus on clicked point
    if (eventData.coordinates && this.options.allowInteraction) {
      this.map.easeTo({
        center: [eventData.coordinates.lng, eventData.coordinates.lat],
        zoom: Math.min(this.map.getZoom() + 1, this.map.getMaxZoom()),
        duration: 500
      });
    }

    this.emit('map-double-click', eventData);
  }

  /**
   * Handle pinch gesture events
   */
  handlePinchGesture(eventData) {
    // Custom pinch behavior - provide haptic feedback on supported devices
    if (navigator.vibrate && eventData.scaleFactor) {
      const intensity = Math.abs(eventData.scaleFactor - 1) * 100;
      if (intensity > 20) {
        navigator.vibrate(10);
      }
    }

    this.emit('pinch-gesture', eventData);
  }

  /**
   * Handle rotate gesture events
   */
  handleRotateGesture(eventData) {
    // Custom rotate behavior
    if (Math.abs(eventData.rotationDelta) > 30 && navigator.vibrate) {
      navigator.vibrate(15);
    }

    this.emit('rotate-gesture', eventData);
  }

  /**
   * Handle system errors
   */
  handleSystemError(eventData) {
    console.error('Event system error:', eventData.error);
    
    // Show user-friendly error message
    this.showNotification(
      `Map interaction error: ${eventData.error}`,
      'error',
      5000
    );

    this.emit('system-error', eventData);
  }

  /**
   * Handle export started events
   */
  handleExportStarted(eventData) {
    this.showNotification('Generating high-resolution map...', 'info');
    this.emit('export-started', eventData);
  }

  /**
   * Handle export completed events
   */
  handleExportCompleted(eventData) {
    this.showNotification('Map export completed successfully!', 'success');
    this.emit('export-completed', eventData);
  }

  /**
   * Handle style change events
   */
  handleStyleChange(eventData) {
    console.log('Map style changed:', eventData.style);
    // Style change implementation would go here
    this.emit('style-changed', eventData);
  }

  /**
   * Handle color change events
   */
  handleColorChange(eventData) {
    console.log('Map color changed:', eventData.color);
    // Color change implementation would go here
    this.emit('color-changed', eventData);
  }

  /**
   * Handle customization panel toggle events
   */
  handleCustomizationPanelToggle(eventData) {
    console.log('Customization panel toggle:', eventData.visible);
    // Panel toggle implementation would go here
    this.emit('customization-panel-toggle', eventData);
  }

  /**
   * Handle route style update events
   */
  handleRouteStyleUpdate(eventData) {
    console.log('Route style update:', eventData.style);
    // Route style update implementation would go here
    this.emit('route-style-update', eventData);
  }

  /**
   * Highlight route segment
   */
  highlightRouteSegment(feature) {
    // Add highlight layer if it doesn't exist
    if (!this.map.getLayer('route-highlight')) {
      this.map.addLayer({
        id: 'route-highlight',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#FFD700',
          'line-width': this.options.routeWidth + 2,
          'line-opacity': 0.8
        }
      });
    }
  }

  /**
   * Remove route highlight
   */
  removeRouteHighlight() {
    if (this.map.getLayer('route-highlight')) {
      this.map.removeLayer('route-highlight');
    }
  }

  /**
   * Show detailed segment information on hover
   * @param {Object} feature - The hovered map feature
   * @param {Object} coordinates - Mouse coordinates {lat, lng}
   */
  showSegmentInfo(feature, coordinates) {
    if (!feature || !coordinates) return;
    
    // Get segment information based on layer type
    let segmentInfo = this.getSegmentDetails(feature);
    
    // Create popup content
    const popupContent = this.createSegmentInfoPopup(segmentInfo, feature);
    
    // Remove existing popup if any
    if (this.segmentInfoPopup) {
      this.segmentInfoPopup.remove();
    }
    
    // Create and show new popup
    this.segmentInfoPopup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      className: 'segment-info-popup',
      maxWidth: '280px',
      offset: [0, -10]
    })
      .setLngLat([coordinates.lng, coordinates.lat])
      .setHTML(popupContent)
      .addTo(this.map);
  }

  /**
   * Hide segment information popup
   */
  hideSegmentInfo() {
    if (this.segmentInfoPopup) {
      this.segmentInfoPopup.remove();
      this.segmentInfoPopup = null;
    }
  }

  /**
   * Get detailed information about a route segment
   * @param {Object} feature - The map feature
   * @returns {Object} - Segment details
   */
  getSegmentDetails(feature) {
    const layerId = feature.layer?.id;
    const properties = feature.properties || {};
    const metadata = feature.layer?.metadata || {};
    
    // Base segment info
    const segmentInfo = {
      activityType: metadata.activityType || this.activityStyles.currentActivity.type || 'Unknown',
      isElevationGradient: metadata.isElevationGradient || false,
      elevation: null,
      distance: null,
      speed: null,
      gradient: null
    };

    // Add elevation information if available
    if (metadata.isElevationGradient && metadata.elevation !== undefined) {
      segmentInfo.elevation = {
        meters: Math.round(metadata.elevation),
        feet: Math.round(metadata.elevation * 3.28084)
      };
    } else if (properties.elevation !== undefined) {
      segmentInfo.elevation = {
        meters: Math.round(properties.elevation),
        feet: Math.round(properties.elevation * 3.28084)
      };
    }

    // Add activity-specific information
    const currentActivity = this.activityStyles.currentActivity;
    if (currentActivity.elevation && currentActivity.speed) {
      // Try to find the closest data point for more detailed info
      // This would require additional logic to map coordinates to data points
      segmentInfo.hasDetailedData = true;
    }

    return segmentInfo;
  }

  /**
   * Create HTML content for segment info popup
   * @param {Object} segmentInfo - Segment information
   * @param {Object} feature - The map feature
   * @returns {string} - HTML content
   */
  createSegmentInfoPopup(segmentInfo, feature) {
    const activityType = segmentInfo.activityType || 'Route';
    
    let content = `
      <div class="segment-info-content">
        <div class="segment-header">
          <strong>${this.formatActivityType(activityType)}</strong>
        </div>
    `;

    // Add elevation information
    if (segmentInfo.elevation) {
      content += `
        <div class="segment-detail">
          <span class="detail-label">Elevation:</span>
          <span class="detail-value">${segmentInfo.elevation.meters}m (${segmentInfo.elevation.feet}ft)</span>
        </div>
      `;
    }

    // Add gradient information for elevation segments
    if (segmentInfo.isElevationGradient) {
      content += `
        <div class="segment-detail">
          <span class="detail-label">Segment:</span>
          <span class="detail-value">Elevation-based coloring</span>
        </div>
      `;
    }

    // Add activity type information
    const activityStyle = this.activityStyles.currentActivity.style;
    if (activityStyle) {
      content += `
        <div class="segment-detail">
          <span class="detail-label">Style:</span>
          <span class="detail-value" style="color: ${activityStyle.color}">
            ${activityStyle.dashArray ? 'Dashed' : 'Solid'} line
          </span>
        </div>
      `;
    }

    // Add hover instruction
    content += `
        <div class="segment-hint">
          <small>Hover for route details</small>
        </div>
      </div>
    `;

    return content;
  }

  /**
   * Format activity type for display
   * @param {string} activityType - Raw activity type
   * @returns {string} - Formatted activity type
   */
  formatActivityType(activityType) {
    const typeMap = {
      'Run': 'Running',
      'TrailRun': 'Trail Running',
      'VirtualRun': 'Virtual Run',
      'Ride': 'Cycling',
      'MountainBikeRide': 'Mountain Biking',
      'GravelRide': 'Gravel Cycling',
      'EBikeRide': 'E-Bike',
      'VirtualRide': 'Virtual Cycling',
      'Walk': 'Walking',
      'Hike': 'Hiking',
      'Swim': 'Swimming',
      'Kayaking': 'Kayaking',
      'Canoeing': 'Canoeing',
      'Rowing': 'Rowing',
      'Surfing': 'Surfing',
      'AlpineSki': 'Alpine Skiing',
      'BackcountrySki': 'Backcountry Skiing',
      'NordicSki': 'Nordic Skiing',
      'Snowboard': 'Snowboarding',
      'Snowshoe': 'Snowshoeing',
      'Workout': 'Workout',
      'Yoga': 'Yoga',
      'WeightTraining': 'Weight Training',
      'Crossfit': 'CrossFit'
    };
    
    return typeMap[activityType] || activityType;
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
   * Add standard map controls
   */
  addMapControls() {
    if (!this.options || !this.options.controlPositions) {
      console.error('MapboxIntegration: options not properly initialized');
      return;
    }

    const positions = this.options.controlPositions;

    // Navigation controls (zoom, rotate) with mobile-friendly options
    const navControl = new mapboxgl.NavigationControl({ 
      showCompass: !this.options.mobileOptimized || this.isDesktop(), 
      showZoom: true,
      visualizePitch: this.options.allowInteraction
    });
    this.map.addControl(navControl, positions.navigation);

    // Fullscreen control
    this.map.addControl(new mapboxgl.FullscreenControl(), positions.fullscreen);

    // Scale control for distance reference (if enabled)
    if (this.options.enableScale) {
      this.map.addControl(new mapboxgl.ScaleControl({
        maxWidth: this.options.mobileOptimized && !this.isDesktop() ? 80 : 100,
        unit: 'metric'
      }), positions.scale);
    }

    // Geolocation control with proper permissions handling (if enabled)
    if (this.options.enableGeolocation) {
      this.addGeolocationControl();
    }

    // Style switcher control
    this.addStyleSwitcher();

    // Export control if enabled
    if (this.options.enableExport) {
      this.addExportControl();
    }

    // Enhance keyboard accessibility
    this.enhanceKeyboardAccessibility();

    // Add mobile-specific enhancements
    if (this.options.mobileOptimized) {
      this.addMobileEnhancements();
    }
  }

  /**
   * Responsive utility methods
   */

  /**
   * Get current breakpoint based on viewport width
   */
  getCurrentBreakpoint() {
    if (!this.options || !this.options.responsive || !this.options.responsive.breakpoints) {
      // Fallback to simple detection
      const width = window.innerWidth;
      if (width <= 480) return 'mobile';
      if (width <= 768) return 'tablet';
      return 'desktop';
    }

    const width = window.innerWidth;
    const breakpoints = this.options.responsive.breakpoints;
    
    if (width <= breakpoints.mobile.max) {
      return 'mobile';
    } else if (width <= breakpoints.tablet.max) {
      return 'tablet';
    } else {
      return 'desktop';
    }
  }

  /**
   * Check if device is desktop (for responsive control layout)
   */
  isDesktop() {
    return this.getCurrentBreakpoint() === 'desktop';
  }

  /**
   * Check if device is mobile
   */
  isMobile() {
    return this.getCurrentBreakpoint() === 'mobile';
  }

  /**
   * Check if device is tablet
   */
  isTablet() {
    return this.getCurrentBreakpoint() === 'tablet';
  }

  /**
   * Get device pixel ratio with fallback
   */
  getDevicePixelRatio() {
    return window.devicePixelRatio || 1;
  }

  /**
   * Check if device has touch capability
   */
  isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  /**
   * Get optimal container dimensions based on responsive settings
   */
  getOptimalDimensions() {
    if (!this.container) return null;

    const containerRect = this.container.getBoundingClientRect();
    const responsive = this.options.responsive;
    let { width, height } = containerRect;

    // Handle aspect ratio constraints
    if (responsive.aspectRatio && responsive.aspectRatio !== 'auto') {
      const ratios = {
        '16:9': 16/9,
        '4:3': 4/3,
        '1:1': 1
      };

      const ratio = ratios[responsive.aspectRatio];
      if (ratio) {
        const calculatedHeight = width / ratio;
        height = Math.max(responsive.minHeight, Math.min(calculatedHeight, responsive.maxHeight));
      }
    } else {
      // Apply min/max height constraints for flexible aspect ratio
      height = Math.max(responsive.minHeight, Math.min(height, responsive.maxHeight));
    }

    return { width, height };
  }

  /**
   * Apply responsive container sizing
   */
  applyResponsiveContainer() {
    if (!this.container || !this.options || !this.options.responsive || !this.options.responsive.enabled) return;

    const dimensions = this.getOptimalDimensions();
    if (!dimensions) return;

    // Apply dimensions to container
    this.container.style.width = `${dimensions.width}px`;
    this.container.style.height = `${dimensions.height}px`;
    
    // Store last known dimensions for resize comparison
    this.lastKnownDimensions = dimensions;

    // Apply responsive CSS classes
    this.updateResponsiveClasses();
  }

  /**
   * Update responsive CSS classes based on current breakpoint
   */
  updateResponsiveClasses() {
    if (!this.container) return;

    const currentBreakpoint = this.getCurrentBreakpoint();
    const breakpoints = ['mobile', 'tablet', 'desktop'];

    // Remove old breakpoint classes
    breakpoints.forEach(bp => {
      this.container.classList.remove(`mapbox-${bp}`);
    });

    // Add current breakpoint class
    this.container.classList.add(`mapbox-${currentBreakpoint}`);
    this.currentBreakpoint = currentBreakpoint;
  }

  /**
   * Setup responsive resize handling
   */
  setupResponsiveHandling() {
    if (!this.options || !this.options.responsive || !this.options.responsive.enabled) return;

    // Setup ResizeObserver for container changes
    if ('ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          this.handleContainerResize(entry.contentRect);
        }
      });
      this.resizeObserver.observe(this.container);
    }

    // Setup window resize handler as fallback
    window.addEventListener('resize', this.handleWindowResize.bind(this));

    // Setup orientation change handler for mobile devices
    if (this.isTouchDevice()) {
      this.orientationChangeHandler = () => {
        // Delay to allow orientation change to complete
        setTimeout(() => {
          this.handleOrientationChange();
        }, 100);
      };
      window.addEventListener('orientationchange', this.orientationChangeHandler);
    }

    // Initial responsive setup
    this.applyResponsiveContainer();
  }

  /**
   * Handle container resize with debouncing
   */
  handleContainerResize(rect) {
    if (this.resizeDebounceTimer) {
      clearTimeout(this.resizeDebounceTimer);
    }

    this.resizeDebounceTimer = setTimeout(() => {
      const newDimensions = { width: rect.width, height: rect.height };
      
      // Check if dimensions actually changed significantly (avoid micro-adjustments)
      const threshold = 5;
      if (Math.abs(newDimensions.width - this.lastKnownDimensions.width) > threshold ||
          Math.abs(newDimensions.height - this.lastKnownDimensions.height) > threshold) {
        
        this.performResponsiveUpdate(newDimensions);
      }
    }, this.options?.responsive?.resizeDebounce || 250);
  }

  /**
   * Handle window resize (fallback for ResizeObserver)
   */
  handleWindowResize() {
    if (this.resizeDebounceTimer) {
      clearTimeout(this.resizeDebounceTimer);
    }

    this.resizeDebounceTimer = setTimeout(() => {
      const rect = this.container?.getBoundingClientRect();
      if (rect) {
        this.handleContainerResize(rect);
      }
    }, this.options?.responsive?.resizeDebounce || 250);
  }

  /**
   * Handle orientation change on mobile devices
   */
  handleOrientationChange() {
    // Force container recalculation after orientation change
    if (this.container) {
      this.applyResponsiveContainer();
      
      if (this.map) {
        // Trigger map resize after orientation change
        this.map.resize();
        
        // Re-fit bounds if route exists and maintain center is enabled
        if (this.options?.responsive?.maintainCenter) {
          this.maintainMapView();
        }
      }
    }
  }

  /**
   * Perform responsive update with map adjustments
   */
  performResponsiveUpdate(newDimensions) {
    // Store current map state for restoration
    const mapState = this.getMapState();
    
    // Apply new container dimensions
    this.applyResponsiveContainer();
    
    if (this.map) {
      // Trigger map resize
      this.map.resize();
      
      // Check if breakpoint changed and update controls accordingly
      const newBreakpoint = this.getCurrentBreakpoint();
      if (newBreakpoint !== this.currentBreakpoint) {
        this.handleBreakpointChange(newBreakpoint);
      }
      
      // Restore or adjust map view
      if (this.options?.responsive?.maintainCenter && mapState) {
        this.restoreMapView(mapState);
      }
    }
    
    console.log('MapboxIntegration: Responsive update completed', newDimensions);
  }

  /**
   * Handle breakpoint changes by updating controls
   */
  handleBreakpointChange(newBreakpoint) {
    console.log(`MapboxIntegration: Breakpoint changed to ${newBreakpoint}`);
    
    // Update control configurations based on new breakpoint
    const controlConfig = this.options?.responsive?.breakpoints?.[newBreakpoint]?.controls || 'full';
    
    // Remove existing controls
    if (this.map) {
      // This would need implementation to remove and re-add controls
      // For now, we'll update CSS classes and let CSS handle the changes
      this.updateResponsiveClasses();
      
      // Apply breakpoint-specific optimizations
      this.applyBreakpointOptimizations(newBreakpoint);
    }
  }

  /**
   * Apply optimizations specific to breakpoint
   */
  applyBreakpointOptimizations(breakpoint) {
    if (!this.map) return;
    
    switch (breakpoint) {
      case 'mobile':
        // Mobile optimizations
        if (this.options?.responsive?.adaptivePerformance) {
          // Reduce animation duration for better performance
          this.map.easeTo = this.map.easeTo.bind(this.map);
        }
        // Disable pitch on mobile for better UX
        this.map.touchPitch?.disable();
        break;
        
      case 'tablet':
        // Tablet optimizations
        this.map.touchPitch?.enable();
        break;
        
      case 'desktop':
        // Desktop optimizations - enable all features
        this.map.touchPitch?.enable();
        break;
    }
  }

  /**
   * Maintain current map view during resize
   */
  maintainMapView() {
    if (!this.map) return;
    
    // If route exists, refit to route bounds
    if (this.map.getSource('route')) {
      const bounds = this.calculateRouteBounds();
      if (bounds) {
        this.map.fitBounds(bounds, { 
          padding: this.getResponsivePadding(),
          duration: 300
        });
      }
    }
  }

  /**
   * Restore map view from saved state
   */
  restoreMapView(mapState) {
    if (!this.map || !mapState) return;
    
    try {
      this.map.easeTo({
        center: mapState.center,
        zoom: mapState.zoom,
        bearing: mapState.bearing,
        pitch: mapState.pitch,
        duration: 300
      });
    } catch (error) {
      console.warn('MapboxIntegration: Could not restore map view', error);
    }
  }

  /**
   * Get responsive padding based on current breakpoint
   */
  getResponsivePadding() {
    switch (this.getCurrentBreakpoint()) {
      case 'mobile':
        return 20;
      case 'tablet':
        return 30;
      case 'desktop':
      default:
        return 50;
    }
  }

  /**
   * Calculate route bounds for fitting
   */
  calculateRouteBounds() {
    const source = this.map.getSource('route');
    if (!source || !source._data) return null;
    
    const coordinates = source._data.geometry.coordinates;
    if (!coordinates || coordinates.length === 0) return null;
    
    let minLng = coordinates[0][0];
    let maxLng = coordinates[0][0];
    let minLat = coordinates[0][1];
    let maxLat = coordinates[0][1];
    
    coordinates.forEach(coord => {
      minLng = Math.min(minLng, coord[0]);
      maxLng = Math.max(maxLng, coord[0]);
      minLat = Math.min(minLat, coord[1]);
      maxLat = Math.max(maxLat, coord[1]);
    });
    
    return [[minLng, minLat], [maxLng, maxLat]];
  }

  /**
   * Add mobile-specific enhancements
   */
  addMobileEnhancements() {
    // Add comprehensive responsive styling for controls
    const style = document.createElement('style');
    style.textContent = `
      /* Enhanced responsive map styles */
      .mapbox-mobile .mapboxgl-ctrl-group {
        margin: 8px !important;
        background: rgba(255, 255, 255, 0.95) !important;
        backdrop-filter: blur(8px);
      }
      .mapbox-mobile .mapboxgl-ctrl-group button {
        min-width: 44px !important;
        min-height: 44px !important;
        font-size: 16px !important;
        touch-action: manipulation;
      }
      .mapbox-mobile .mapboxgl-ctrl-fullscreen {
        display: none !important;
      }
      .mapbox-mobile .mapbox-style-switcher {
        font-size: 16px !important;
        min-height: 44px !important;
        padding: 8px !important;
        background: rgba(255, 255, 255, 0.95) !important;
      }
      
      /* Tablet responsive styles */
      .mapbox-tablet .mapboxgl-ctrl-group {
        margin: 6px !important;
      }
      .mapbox-tablet .mapboxgl-ctrl-group button {
        min-width: 36px !important;
        min-height: 36px !important;
      }
      
      /* Desktop enhancements */
      .mapbox-desktop .mapboxgl-ctrl-group {
        margin: 10px !important;
      }
      
      /* Container responsive styles */
      .mapbox-container {
        position: relative;
        width: 100%;
        overflow: hidden;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      }
      
      .mapbox-mobile .mapbox-container {
        border-radius: 4px;
      }
      
      /* Touch-optimized popups */
      .mapbox-mobile .mapboxgl-popup-content {
        padding: 12px !important;
        font-size: 14px !important;
        line-height: 1.4 !important;
        min-width: 200px !important;
      }
      
      .mapbox-mobile .mapboxgl-popup-close-button {
        width: 30px !important;
        height: 30px !important;
        font-size: 18px !important;
        line-height: 30px !important;
      }

      /* Segment Info Popup Styles */
      .segment-info-popup .mapboxgl-popup-content {
        padding: 12px 14px !important;
        border-radius: 8px !important;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif !important;
        min-width: 200px !important;
        max-width: 280px !important;
      }

      .segment-info-popup .mapboxgl-popup-tip {
        border-top-color: #ffffff !important;
      }

      .segment-info-content {
        font-size: 13px;
        line-height: 1.4;
      }

      .segment-header {
        margin-bottom: 8px;
        padding-bottom: 6px;
        border-bottom: 1px solid #e5e7eb;
        font-size: 14px;
        color: #1f2937;
      }

      .segment-detail {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 6px;
        padding: 2px 0;
      }

      .detail-label {
        font-weight: 500;
        color: #6b7280;
        margin-right: 8px;
        min-width: 70px;
      }

      .detail-value {
        font-weight: 600;
        color: #374151;
        text-align: right;
        flex: 1;
      }

      .segment-hint {
        margin-top: 8px;
        padding-top: 6px;
        border-top: 1px solid #f3f4f6;
        text-align: center;
        color: #9ca3af;
        font-style: italic;
      }

      /* Mobile responsive adjustments for popup */
      @media (max-width: 480px) {
        .segment-info-popup .mapboxgl-popup-content {
          padding: 10px 12px !important;
          min-width: 180px !important;
          max-width: 250px !important;
        }
        
        .segment-info-content {
          font-size: 12px;
        }
        
        .segment-header {
          font-size: 13px;
        }
        
        .detail-label {
          min-width: 60px;
        }
      }
    `;
    document.head.appendChild(style);

    // Enhanced touch interactions based on device type
    if (this.map) {
      const breakpoint = this.getCurrentBreakpoint();
      
      if (breakpoint === 'mobile') {
        // Mobile-specific optimizations
        this.map.touchZoomRotate.setMinZoom(this.map.getMinZoom());
        this.map.touchPitch?.disable(); // Disable pitch on mobile for better UX
        this.map.doubleClickZoom.enable();
        
        // Reduce gesture sensitivity for better touch experience
        if (this.map.touchZoomRotate) {
          this.map.touchZoomRotate.enable({ around: 'center' });
        }
        
        // Disable rotation gesture on mobile (can be confusing)
        this.map.touchZoomRotate.disableRotation();
        
      } else if (breakpoint === 'tablet') {
        // Tablet optimizations
        this.map.touchPitch?.enable();
        this.map.doubleClickZoom.enable();
        this.map.touchZoomRotate.enableRotation();
        
      } else {
        // Desktop - enable all features
        this.map.touchPitch?.enable();
        this.map.doubleClickZoom.enable();
        this.map.touchZoomRotate.enableRotation();
      }
    }
    
    // Add container wrapper class
    if (this.container && !this.container.classList.contains('mapbox-container')) {
      this.container.classList.add('mapbox-container');
    }
  }

  /**
   * Add geolocation control with proper permissions handling
   */
  addGeolocationControl() {
    const geolocateControl = new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true,
        timeout: 6000,
        maximumAge: 300000
      },
      trackUserLocation: true,
      showAccuracyCircle: true,
      showUserHeading: true
    });

    // Add error handling for permissions
    geolocateControl.on('error', (error) => {
      console.warn('Geolocation error:', error.message);
      
      // Show user-friendly message based on error type
      let message = 'Location access unavailable';
      if (error.code === error.PERMISSION_DENIED) {
        message = 'Location permission denied. Enable location access to use this feature.';
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        message = 'Your location could not be determined.';
      } else if (error.code === error.TIMEOUT) {
        message = 'Location request timed out.';
      }
      
      this.showNotification(message, 'warning');
    });

    geolocateControl.on('geolocate', (position) => {
      console.log('User location:', position.coords.latitude, position.coords.longitude);
      this.showNotification('Location found successfully', 'success');
    });

    this.map.addControl(geolocateControl, this.options.controlPositions.geolocation);
  }

  /**
   * Enhance keyboard accessibility for map controls
   */
  enhanceKeyboardAccessibility() {
    // Add keyboard navigation support
    this.map.getContainer().setAttribute('tabindex', '0');
    
    // Add keyboard event listeners
    this.map.getContainer().addEventListener('keydown', (e) => {
      const zoomDelta = 1;
      const panDelta = 50;
      
      switch(e.key) {
        case 'ArrowUp':
          e.preventDefault();
          this.map.panBy([0, -panDelta]);
          break;
        case 'ArrowDown':
          e.preventDefault();
          this.map.panBy([0, panDelta]);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          this.map.panBy([-panDelta, 0]);
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.map.panBy([panDelta, 0]);
          break;
        case '+':
        case '=':
          e.preventDefault();
          this.map.zoomIn();
          break;
        case '-':
          e.preventDefault();
          this.map.zoomOut();
          break;
        case 'f':
        case 'F':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            // Toggle fullscreen if available
            const fullscreenElement = document.querySelector('.mapboxgl-ctrl-fullscreen');
            if (fullscreenElement) fullscreenElement.click();
          }
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          this.map.resetNorth();
          break;
      }
    });

    // Add ARIA labels for accessibility
    const mapContainer = this.map.getContainer();
    mapContainer.setAttribute('role', 'application');
    mapContainer.setAttribute('aria-label', 'Interactive map with route visualization. Use arrow keys to pan, + and - to zoom.');
  }

  /**
   * Show notification to user
   */
  showNotification(message, type = 'info', duration = 4000) {
    const notification = document.createElement('div');
    notification.className = `map-notification map-notification--${type}`;
    notification.textContent = message;
    
    const colors = {
      success: '#10B981',
      warning: '#F59E0B', 
      error: '#EF4444',
      info: '#3B82F6'
    };

    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${colors[type] || colors.info};
      color: white;
      padding: 12px 16px;
      border-radius: 6px;
      font-family: Arial, sans-serif;
      font-size: 14px;
      z-index: 10001;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      max-width: 300px;
      word-wrap: break-word;
      opacity: 0;
      transform: translateX(100%);
      transition: all 0.3s ease;
    `;

    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateX(0)';
    }, 50);

    // Auto remove
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (notification.parentNode) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, duration);
  }

  /**
   * Add comprehensive style management control with opacity, presets, and persistence
   */
  addStyleSwitcher() {
    const styles = this.config.getAvailableStyles();
    const self = this;
    
    class AdvancedStyleControl {
      constructor() {
        this.isExpanded = false;
        this.currentPreset = 'default';
        this.styleSettings = self.loadStyleSettings();
      }

      onAdd(map) {
        this.map = map;
        this.container = document.createElement('div');
        this.container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group advanced-style-control';
        this.container.style.cssText = `
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(8px);
          border-radius: 6px;
          overflow: hidden;
          transition: all 0.3s ease;
          min-width: 200px;
        `;

        this.createMainButton();
        this.createExpandedPanel();
        this.loadSavedSettings();

        return this.container;
      }

      createMainButton() {
        this.mainButton = document.createElement('button');
        this.mainButton.className = 'style-switcher-main-btn';
        this.mainButton.innerHTML = `
          <span style="margin-right: 8px;">🎨</span>
          <span>Style</span>
          <span style="margin-left: auto; transform: rotate(${this.isExpanded ? '180deg' : '0deg'}); transition: transform 0.3s;">▼</span>
        `;
        this.mainButton.style.cssText = `
          width: 100%;
          padding: 8px 12px;
          background: transparent;
          border: none;
          font-size: 13px;
          cursor: pointer;
          display: flex;
          align-items: center;
          color: #374151;
        `;

        this.mainButton.addEventListener('click', () => {
          this.togglePanel();
        });

        this.container.appendChild(this.mainButton);
      }

      createExpandedPanel() {
        this.panel = document.createElement('div');
        this.panel.className = 'style-control-panel';
        this.panel.style.cssText = `
          max-height: 0;
          overflow: hidden;
          transition: max-height 0.3s ease;
          border-top: 1px solid #E5E7EB;
          background: white;
        `;

        // Map Style Section
        const mapStyleSection = this.createSection('Map Style');
        this.mapStyleSelect = document.createElement('select');
        this.mapStyleSelect.style.cssText = `
          width: 100%;
          padding: 6px;
          border: 1px solid #D1D5DB;
          border-radius: 4px;
          font-size: 12px;
          background: white;
        `;

        Object.entries(styles).forEach(([name, url]) => {
          const option = document.createElement('option');
          option.value = url;
          option.textContent = name.charAt(0).toUpperCase() + name.slice(1);
          this.mapStyleSelect.appendChild(option);
        });

        this.mapStyleSelect.addEventListener('change', (e) => {
          this.map.setStyle(e.target.value);
          self.saveStyleSettings('mapStyle', e.target.value);
        });

        mapStyleSection.appendChild(this.mapStyleSelect);

        // Style Presets Section
        const presetsSection = this.createSection('Style Presets');
        this.createPresetButtons(presetsSection);

        // Layer Opacity Section
        const opacitySection = this.createSection('Layer Opacity');
        this.createOpacityControls(opacitySection);

        // Route Customization Section
        const routeSection = this.createSection('Route Style');
        this.createRouteControls(routeSection);

        // Layer Visibility Section
        const visibilitySection = this.createSection('Layer Visibility');
        this.createVisibilityControls(visibilitySection);

        this.panel.appendChild(mapStyleSection);
        this.panel.appendChild(presetsSection);
        this.panel.appendChild(opacitySection);
        this.panel.appendChild(routeSection);
        this.panel.appendChild(visibilitySection);

        this.container.appendChild(this.panel);
      }

      createSection(title) {
        const section = document.createElement('div');
        section.style.cssText = `
          padding: 12px;
          border-bottom: 1px solid #F3F4F6;
        `;

        const header = document.createElement('h4');
        header.textContent = title;
        header.style.cssText = `
          margin: 0 0 8px 0;
          font-size: 13px;
          font-weight: 600;
          color: #374151;
        `;

        section.appendChild(header);
        return section;
      }

      createPresetButtons(container) {
        const presets = {
          default: { name: 'Default', icon: '🌍' },
          minimalist: { name: 'Minimalist', icon: '◦' },
          highContrast: { name: 'High Contrast', icon: '⚫' },
          printReady: { name: 'Print Ready', icon: '🖨️' }
        };

        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
        `;

        Object.entries(presets).forEach(([key, preset]) => {
          const button = document.createElement('button');
          button.innerHTML = `${preset.icon} ${preset.name}`;
          button.style.cssText = `
            padding: 6px 8px;
            font-size: 11px;
            border: 1px solid #D1D5DB;
            border-radius: 4px;
            background: ${this.currentPreset === key ? '#EBF8FF' : 'white'};
            color: ${this.currentPreset === key ? '#1E40AF' : '#6B7280'};
            cursor: pointer;
            transition: all 0.2s;
          `;

          button.addEventListener('click', () => {
            this.applyPreset(key);
            this.updatePresetButtons(key);
          });

          buttonContainer.appendChild(button);
        });

        container.appendChild(buttonContainer);
      }

      createOpacityControls(container) {
        const opacityLayers = [
          { key: 'background', name: 'Background', default: 1 },
          { key: 'water', name: 'Water', default: 1 },
          { key: 'terrain', name: 'Terrain', default: 0.8 },
          { key: 'roads', name: 'Roads', default: 0.9 },
          { key: 'labels', name: 'Labels', default: 1 }
        ];

        opacityLayers.forEach(layer => {
          const control = document.createElement('div');
          control.style.cssText = `
            display: flex;
            align-items: center;
            margin-bottom: 8px;
          `;

          const label = document.createElement('label');
          label.textContent = layer.name;
          label.style.cssText = `
            flex: 1;
            font-size: 12px;
            color: #6B7280;
          `;

          const slider = document.createElement('input');
          slider.type = 'range';
          slider.min = '0';
          slider.max = '100';
          slider.value = (this.styleSettings.opacity?.[layer.key] ?? layer.default) * 100;
          slider.style.cssText = `
            width: 80px;
            margin-left: 8px;
          `;

          const value = document.createElement('span');
          value.textContent = `${slider.value}%`;
          value.style.cssText = `
            width: 35px;
            text-align: right;
            font-size: 11px;
            color: #9CA3AF;
            margin-left: 6px;
          `;

          slider.addEventListener('input', (e) => {
            const opacity = e.target.value / 100;
            value.textContent = `${e.target.value}%`;
            this.updateLayerOpacity(layer.key, opacity);
            self.saveStyleSettings(`opacity.${layer.key}`, opacity);
          });

          control.appendChild(label);
          control.appendChild(slider);
          control.appendChild(value);
          container.appendChild(control);
        });
      }

      createRouteControls(container) {
        // Route Color
        const colorContainer = document.createElement('div');
        colorContainer.style.cssText = `
          display: flex;
          align-items: center;
          margin-bottom: 8px;
        `;

        const colorLabel = document.createElement('label');
        colorLabel.textContent = 'Color';
        colorLabel.style.cssText = `
          flex: 1;
          font-size: 12px;
          color: #6B7280;
        `;

        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = this.styleSettings.routeColor || self.options.routeColor;
        colorInput.style.cssText = `
          width: 40px;
          height: 30px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        `;

        colorInput.addEventListener('change', (e) => {
          self.updateRouteStyle({ routeColor: e.target.value });
          self.saveStyleSettings('routeColor', e.target.value);
        });

        colorContainer.appendChild(colorLabel);
        colorContainer.appendChild(colorInput);

        // Route Width
        const widthContainer = document.createElement('div');
        widthContainer.style.cssText = `
          display: flex;
          align-items: center;
          margin-bottom: 8px;
        `;

        const widthLabel = document.createElement('label');
        widthLabel.textContent = 'Width';
        widthLabel.style.cssText = `
          flex: 1;
          font-size: 12px;
          color: #6B7280;
        `;

        const widthSlider = document.createElement('input');
        widthSlider.type = 'range';
        widthSlider.min = '1';
        widthSlider.max = '10';
        widthSlider.value = this.styleSettings.routeWidth || self.options.routeWidth;
        widthSlider.style.cssText = `
          width: 80px;
          margin-left: 8px;
        `;

        const widthValue = document.createElement('span');
        widthValue.textContent = `${widthSlider.value}px`;
        widthValue.style.cssText = `
          width: 35px;
          text-align: right;
          font-size: 11px;
          color: #9CA3AF;
          margin-left: 6px;
        `;

        widthSlider.addEventListener('input', (e) => {
          widthValue.textContent = `${e.target.value}px`;
          self.updateRouteStyle({ routeWidth: parseInt(e.target.value) });
          self.saveStyleSettings('routeWidth', parseInt(e.target.value));
        });

        widthContainer.appendChild(widthLabel);
        widthContainer.appendChild(widthSlider);
        widthContainer.appendChild(widthValue);

        // Route Effects
        const effectsContainer = document.createElement('div');
        effectsContainer.style.cssText = `
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-top: 8px;
        `;

        const effects = [
          { key: 'shadow', name: 'Shadow', icon: '🌫️' },
          { key: 'glow', name: 'Glow', icon: '✨' },
          { key: 'dashed', name: 'Dashed', icon: '╶' }
        ];

        effects.forEach(effect => {
          const button = document.createElement('button');
          button.innerHTML = `${effect.icon}`;
          button.title = effect.name;
          button.style.cssText = `
            width: 32px;
            height: 28px;
            border: 1px solid #D1D5DB;
            border-radius: 4px;
            background: ${this.styleSettings.routeEffects?.[effect.key] ? '#EBF8FF' : 'white'};
            color: ${this.styleSettings.routeEffects?.[effect.key] ? '#1E40AF' : '#6B7280'};
            cursor: pointer;
            font-size: 12px;
          `;

          button.addEventListener('click', () => {
            const isActive = !this.styleSettings.routeEffects?.[effect.key];
            self.updateRouteEffect(effect.key, isActive);
            self.saveStyleSettings(`routeEffects.${effect.key}`, isActive);
            
            // Update button appearance
            button.style.background = isActive ? '#EBF8FF' : 'white';
            button.style.color = isActive ? '#1E40AF' : '#6B7280';
          });

          effectsContainer.appendChild(button);
        });

        container.appendChild(colorContainer);
        container.appendChild(widthContainer);
        container.appendChild(effectsContainer);
      }

      createVisibilityControls(container) {
        const layers = [
          { key: 'route', name: 'Route Line', visible: true },
          { key: 'markers', name: 'Markers', visible: true },
          { key: 'waypoints', name: 'Waypoints', visible: true },
          { key: 'stats', name: 'Statistics', visible: true }
        ];

        layers.forEach(layer => {
          const control = document.createElement('div');
          control.style.cssText = `
            display: flex;
            align-items: center;
            margin-bottom: 6px;
          `;

          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.checked = this.styleSettings.visibility?.[layer.key] ?? layer.visible;
          checkbox.style.cssText = `
            margin-right: 8px;
          `;

          const label = document.createElement('label');
          label.textContent = layer.name;
          label.style.cssText = `
            font-size: 12px;
            color: #6B7280;
            cursor: pointer;
          `;

          checkbox.addEventListener('change', (e) => {
            self.updateLayerVisibility(layer.key, e.target.checked);
            self.saveStyleSettings(`visibility.${layer.key}`, e.target.checked);
          });

          control.appendChild(checkbox);
          control.appendChild(label);
          container.appendChild(control);
        });
      }

      togglePanel() {
        this.isExpanded = !this.isExpanded;
        const arrow = this.mainButton.querySelector('span:last-child');
        arrow.style.transform = `rotate(${this.isExpanded ? '180deg' : '0deg'})`;
        
        if (this.isExpanded) {
          this.panel.style.maxHeight = '400px';
        } else {
          this.panel.style.maxHeight = '0';
        }
      }

      applyPreset(presetKey) {
        const presets = {
          default: {
            mapStyle: 'outdoors',
            opacity: { background: 1, water: 1, terrain: 0.8, roads: 0.9, labels: 1 },
            routeColor: '#FF4444',
            routeWidth: 3,
            routeEffects: { shadow: false, glow: false, dashed: false }
          },
          minimalist: {
            mapStyle: 'light',
            opacity: { background: 1, water: 0.6, terrain: 0.4, roads: 0.5, labels: 0.8 },
            routeColor: '#2563EB',
            routeWidth: 2,
            routeEffects: { shadow: false, glow: false, dashed: false }
          },
          highContrast: {
            mapStyle: 'dark',
            opacity: { background: 1, water: 1, terrain: 1, roads: 1, labels: 1 },
            routeColor: '#FBBF24',
            routeWidth: 4,
            routeEffects: { shadow: true, glow: true, dashed: false }
          },
          printReady: {
            mapStyle: 'streets',
            opacity: { background: 1, water: 0.8, terrain: 0.6, roads: 0.7, labels: 0.9 },
            routeColor: '#DC2626',
            routeWidth: 3,
            routeEffects: { shadow: false, glow: false, dashed: false }
          }
        };

        const preset = presets[presetKey];
        if (preset) {
          // Apply map style
          this.map.setStyle(styles[preset.mapStyle]);
          this.mapStyleSelect.value = styles[preset.mapStyle];
          
          // Apply opacity settings
          Object.entries(preset.opacity).forEach(([key, opacity]) => {
            this.updateLayerOpacity(key, opacity);
          });
          
          // Apply route settings
          self.updateRouteStyle({
            routeColor: preset.routeColor,
            routeWidth: preset.routeWidth
          });
          
          // Apply effects
          Object.entries(preset.routeEffects).forEach(([key, active]) => {
            self.updateRouteEffect(key, active);
          });
          
          // Save and update UI
          self.saveStyleSettings('preset', presetKey);
          this.styleSettings = preset;
          this.currentPreset = presetKey;
          this.refreshUI();
        }
      }

      updatePresetButtons(activeKey) {
        const buttons = this.container.querySelectorAll('.style-control-panel button');
        buttons.forEach((button, index) => {
          const keys = ['default', 'minimalist', 'highContrast', 'printReady'];
          const isActive = keys[index] === activeKey;
          button.style.background = isActive ? '#EBF8FF' : 'white';
          button.style.color = isActive ? '#1E40AF' : '#6B7280';
        });
      }

      updateLayerOpacity(layerKey, opacity) {
        // This is a simplified implementation
        // In reality, you'd need to target specific Mapbox layers
        console.log(`Updating ${layerKey} opacity to ${opacity}`);
      }

      refreshUI() {
        // Update color input
        const colorInput = this.container.querySelector('input[type="color"]');
        if (colorInput) colorInput.value = this.styleSettings.routeColor;
        
        // Update width slider
        const widthSlider = this.container.querySelector('input[type="range"]');
        if (widthSlider) {
          widthSlider.value = this.styleSettings.routeWidth;
          const widthValue = widthSlider.nextElementSibling;
          if (widthValue) widthValue.textContent = `${this.styleSettings.routeWidth}px`;
        }
      }

      loadSavedSettings() {
        // Apply saved settings to UI
        if (this.styleSettings.mapStyle) {
          this.mapStyleSelect.value = this.styleSettings.mapStyle;
        }
        
        if (this.styleSettings.preset) {
          this.currentPreset = this.styleSettings.preset;
          this.updatePresetButtons(this.currentPreset);
        }
      }

      onRemove() {
        this.container.parentNode.removeChild(this.container);
        this.map = undefined;
      }
    }

    this.map.addControl(new AdvancedStyleControl(), this.options.controlPositions.style);
  }

  /**
   * Add export control for high-resolution downloads
   */
  addExportControl() {
    const self = this;

    class ExportControl {
      onAdd(map) {
        this.map = map;
        this.container = document.createElement('div');
        this.container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';

        const button = document.createElement('button');
        button.className = 'mapboxgl-ctrl-icon';
        button.type = 'button';
        button.title = 'Export High Resolution';
        button.innerHTML = '📸';
        button.style.cssText = 'background: white; border: none; cursor: pointer; font-size: 14px;';

        button.addEventListener('click', () => {
          self.showExportDialog();
        });

        this.container.appendChild(button);
        return this.container;
      }

      onRemove() {
        this.container.parentNode.removeChild(this.container);
        this.map = undefined;
      }
    }

    this.map.addControl(new ExportControl(), this.options.controlPositions.export);
  }

  /**
   * Show export dialog with format options
   */
  showExportDialog() {
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: white; border: 1px solid #ccc; border-radius: 8px; padding: 20px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 10000; font-family: Arial, sans-serif;
    `;

    dialog.innerHTML = `
      <h3 style="margin: 0 0 15px 0;">Export High-Resolution Map</h3>
      <label>Format: 
        <select id="export-format" style="margin-left: 10px;">
          <option value="A4">A4 Portrait (300 DPI)</option>
          <option value="A3">A3 Portrait (300 DPI)</option>
        </select>
      </label>
      <div style="margin-top: 15px;">
        <button id="export-confirm" style="background: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 4px; margin-right: 10px; cursor: pointer;">Export</button>
        <button id="export-cancel" style="background: #6b7280; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Cancel</button>
      </div>
    `;

    document.body.appendChild(dialog);

    // Event handlers
    dialog.querySelector('#export-confirm').addEventListener('click', () => {
      const format = dialog.querySelector('#export-format').value;
      document.body.removeChild(dialog);
      
      // Emit export started event
      this.emit('export-started', { format, timestamp: Date.now() });
      
      this.exportHighResolution(format);
    });

    dialog.querySelector('#export-cancel').addEventListener('click', () => {
      document.body.removeChild(dialog);
    });
  }

  /**
   * Performance optimization configuration and state
   */
  initializePerformanceOptimizations() {
    this.performanceOptimization = {
      // Frame rate control
      targetFrameRate: 60, // Default for desktop
      mobileFrameRate: 30, // Reduced for mobile
      lastFrameTime: 0,
      frameInterval: 16.67, // 60fps = 16.67ms per frame
      
      // Visibility optimization
      isMapVisible: true,
      visibilityObserver: null,
      pauseRenderingWhenHidden: true,
      
      // Battery optimization
      reducedMotion: false,
      lowPowerMode: false,
      adaptiveQuality: true,
      
      // Animation control
      animationFrameId: null,
      isAnimating: false,
      
      // Performance monitoring
      frameCount: 0,
      lastFPSCheck: 0,
      currentFPS: 0
    };
    
    // Detect reduced motion preference
    if (window.matchMedia) {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.performanceOptimization.reducedMotion = prefersReducedMotion.matches;
      
      prefersReducedMotion.addEventListener('change', (e) => {
        this.performanceOptimization.reducedMotion = e.matches;
        this.adaptPerformanceSettings();
      });
    }
    
    // Detect mobile devices for frame rate adjustment
    if (this.options?.responsive?.enabled && this.getCurrentBreakpoint() === 'mobile') {
      this.performanceOptimization.targetFrameRate = this.performanceOptimization.mobileFrameRate;
      this.performanceOptimization.frameInterval = 1000 / this.performanceOptimization.mobileFrameRate;
    }
    
    // Set up visibility observer
    this.setupVisibilityObserver();
    
    // Set up performance monitoring
    this.setupPerformanceMonitoring();
  }

  /**
   * Set up Intersection Observer for map visibility
   */
  setupVisibilityObserver() {
    if (!('IntersectionObserver' in window) || !this.container) {
      return;
    }
    
    this.performanceOptimization.visibilityObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const wasVisible = this.performanceOptimization.isMapVisible;
          this.performanceOptimization.isMapVisible = entry.isIntersecting;
          
          if (wasVisible !== this.performanceOptimization.isMapVisible) {
            this.handleVisibilityChange();
          }
        });
      },
      { threshold: 0.1 } // Trigger when 10% of map is visible
    );
    
    this.performanceOptimization.visibilityObserver.observe(this.container);
  }

  /**
   * Handle map visibility changes
   */
  handleVisibilityChange() {
    if (!this.map) return;
    
    if (this.performanceOptimization.isMapVisible) {
      // Map became visible - resume normal rendering
      if (this.performanceOptimization.pauseRenderingWhenHidden) {
        this.resumeRendering();
      }
    } else {
      // Map hidden - reduce/pause rendering
      if (this.performanceOptimization.pauseRenderingWhenHidden) {
        this.pauseRendering();
      }
    }
  }

  /**
   * Pause rendering when map is not visible
   */
  pauseRendering() {
    if (!this.map) return;
    
    // Cancel any ongoing animations
    if (this.performanceOptimization.animationFrameId) {
      cancelAnimationFrame(this.performanceOptimization.animationFrameId);
      this.performanceOptimization.animationFrameId = null;
    }
    
    // Pause route animations
    if (this.routeAnimation.isPlaying && !this.routeAnimation.isPaused) {
      this.pauseRouteAnimation();
    }
    
    // Reduce map update frequency
    this.map.setRenderWorldCopies(false);
  }

  /**
   * Resume rendering when map becomes visible
   */
  resumeRendering() {
    if (!this.map) return;
    
    // Resume route animations if they were playing
    if (this.routeAnimation.isPaused && this.routeAnimation.progress > 0) {
      this.startRouteAnimation();
    }
    
    // Restore normal rendering
    this.map.setRenderWorldCopies(true);
    
    // Trigger a map update
    this.map.triggerRepaint();
  }

  /**
   * Throttled animation frame for battery efficiency
   */
  requestOptimizedAnimationFrame(callback) {
    const now = performance.now();
    const elapsed = now - this.performanceOptimization.lastFrameTime;
    
    if (elapsed >= this.performanceOptimization.frameInterval) {
      this.performanceOptimization.lastFrameTime = now;
      this.performanceOptimization.animationFrameId = requestAnimationFrame(callback);
    } else {
      // Schedule for the next appropriate frame
      const remaining = this.performanceOptimization.frameInterval - elapsed;
      setTimeout(() => {
        this.performanceOptimization.animationFrameId = requestAnimationFrame(callback);
      }, remaining);
    }
  }

  /**
   * Set up performance monitoring
   */
  setupPerformanceMonitoring() {
    if (!window.performance) return;
    
    // Monitor FPS
    setInterval(() => {
      this.calculateFPS();
    }, 1000);
    
    // Monitor memory usage (if available)
    if (performance.memory) {
      setInterval(() => {
        this.monitorMemoryUsage();
      }, 5000);
    }
  }

  /**
   * Calculate current FPS
   */
  calculateFPS() {
    const now = performance.now();
    if (this.performanceOptimization.lastFPSCheck) {
      const elapsed = now - this.performanceOptimization.lastFPSCheck;
      this.performanceOptimization.currentFPS = Math.round(1000 / elapsed);
      
      // Adapt quality based on FPS
      if (this.performanceOptimization.adaptiveQuality) {
        this.adaptQualityBasedOnFPS();
      }
    }
    this.performanceOptimization.lastFPSCheck = now;
  }

  /**
   * Monitor memory usage and trigger cleanup if needed
   */
  monitorMemoryUsage() {
    if (!performance.memory) return;
    
    const memoryInfo = performance.memory;
    const memoryUsageRatio = memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit;
    
    // If memory usage is high (>75%), trigger cleanup
    if (memoryUsageRatio > 0.75) {
      console.warn('High memory usage detected, triggering cleanup');
      this.performMemoryCleanup();
    }
  }

  /**
   * Adapt performance settings based on current conditions
   */
  adaptPerformanceSettings() {
    if (!this.map) return;
    
    // Adjust frame rate based on device capabilities
    const capabilities = MapboxConfig.detectBrowserCapabilities();
    
    if (capabilities.platform.mobile || capabilities.performance === 'low') {
      this.performanceOptimization.targetFrameRate = 30;
      this.performanceOptimization.frameInterval = 33.33; // 30fps
    } else if (capabilities.performance === 'high') {
      this.performanceOptimization.targetFrameRate = 60;
      this.performanceOptimization.frameInterval = 16.67; // 60fps
    }
    
    // Reduce motion if user prefers it
    if (this.performanceOptimization.reducedMotion) {
      this.options.animationDuration = Math.max(this.options.animationDuration * 0.5, 1000);
      this.options.enableAnimation = false;
    }
  }

  /**
   * Adapt rendering quality based on FPS
   */
  adaptQualityBasedOnFPS() {
    if (!this.map) return;
    
    const fps = this.performanceOptimization.currentFPS;
    
    if (fps < 20) {
      // Very low FPS - reduce quality significantly
      this.map.setMaxZoom(16);
      if (this.map.getCanvas()) {
        this.map.getCanvas().style.imageRendering = 'pixelated';
      }
    } else if (fps < 30) {
      // Low FPS - reduce quality moderately
      this.map.setMaxZoom(18);
    } else {
      // Good FPS - restore full quality
      this.map.setMaxZoom(20);
      if (this.map.getCanvas()) {
        this.map.getCanvas().style.imageRendering = 'auto';
      }
    }
  }

  /**
   * Perform memory cleanup to free resources
   */
  performMemoryCleanup() {
    // Clear any cached data that's not essential
    if (this.progressiveLoading && this.progressiveLoading.allChunks) {
      // Keep only visible chunks, remove distant ones
      const visibleChunkIds = new Set();
      this.progressiveLoading.allChunks.forEach(chunk => {
        if (chunk.priority > 0) {
          visibleChunkIds.add(chunk.id);
        }
      });
      
      // Remove non-visible chunks from memory
      this.progressiveLoading.loadedChunks.forEach(chunkId => {
        if (!visibleChunkIds.has(chunkId)) {
          const sourceId = `route-chunk-${chunkId}`;
          const layerId = `route-line-chunk-${chunkId}`;
          
          try {
            if (this.map.getLayer(layerId)) {
              this.map.removeLayer(layerId);
            }
            if (this.map.getSource(sourceId)) {
              this.map.removeSource(sourceId);
            }
            this.progressiveLoading.loadedChunks.delete(chunkId);
          } catch (error) {
            // Ignore cleanup errors
          }
        }
      });
    }
    
    // Force garbage collection if available
    if (window.gc) {
      window.gc();
    }
  }

  /**
   * Comprehensive performance monitoring and reporting system
   */
  getPerformanceMetrics() {
    const now = performance.now();
    
    // Basic performance data
    const memoryInfo = performance.memory ? {
      used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
      total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
      limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024),
      percentage: Math.round((performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100)
    } : null;
    
    // Browser capabilities
    const capabilities = this.config ? this.config.detectBrowserCapabilities() : null;
    
    // Map performance metrics
    const mapMetrics = this.map ? {
      isLoaded: this.map.loaded(),
      isRendering: this.map._painting,
      zoom: this.map.getZoom(),
      center: this.map.getCenter(),
      sourcesCount: Object.keys(this.map.getStyle()?.sources || {}).length,
      layersCount: (this.map.getStyle()?.layers || []).length
    } : null;
    
    return {
      timestamp: now,
      
      // Performance metrics
      performance: {
        fps: this.performanceOptimization?.currentFPS || 0,
        targetFrameRate: this.performanceOptimization?.targetFrameRate || 60,
        isVisible: this.performanceOptimization?.isMapVisible !== false,
        reducedMotion: this.performanceOptimization?.reducedMotion || false
      },
      
      // Memory metrics (enhanced from memory management)
      memory: this.getMemoryStats(),
      
      // Progressive loading metrics
      progressiveLoading: {
        enabled: this.progressiveLoading?.enabled || false,
        loadedChunks: this.progressiveLoading?.loadedChunks.size || 0,
        totalChunks: this.progressiveLoading?.allChunks.length || 0,
        isLoading: this.progressiveLoading?.isLoading || false,
        totalPoints: this.progressiveLoading?.totalPoints || 0
      },
      
      // Browser capabilities
      browser: capabilities ? {
        name: capabilities.browser.name,
        version: capabilities.browser.version,
        platform: capabilities.platform,
        performance: capabilities.performance,
        webglSupport: capabilities.features.webgl.supported,
        webglWarnings: capabilities.features.webgl.warnings
      } : null,
      
      // Map state
      map: mapMetrics,
      
      // Route animation state
      animation: {
        isPlaying: this.routeAnimation?.isPlaying || false,
        isPaused: this.routeAnimation?.isPaused || false,
        progress: this.routeAnimation?.progress || 0,
        duration: this.routeAnimation?.duration || 0
      }
    };
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport() {
    const metrics = this.getPerformanceMetrics();
    const report = {
      summary: {
        timestamp: new Date().toISOString(),
        status: 'good', // good, warning, critical
        score: 100, // 0-100
        warnings: [],
        recommendations: []
      },
      metrics: metrics,
      analysis: {}
    };
    
    // Analyze performance and generate score
    let score = 100;
    const warnings = [];
    const recommendations = [];
    
    // FPS Analysis
    if (metrics.performance.fps < 20) {
      score -= 30;
      warnings.push('Very low FPS detected');
      recommendations.push('Consider reducing map complexity or enabling performance optimizations');
    } else if (metrics.performance.fps < 30) {
      score -= 15;
      warnings.push('Low FPS detected');
      recommendations.push('Some optimizations may help improve performance');
    }
    
    // Memory Analysis
    if (metrics.memory?.memory?.percentage > 85) {
      score -= 25;
      warnings.push('High memory usage detected');
      recommendations.push('Memory cleanup recommended');
    } else if (metrics.memory?.memory?.percentage > 70) {
      score -= 10;
      warnings.push('Moderate memory usage');
      recommendations.push('Monitor memory usage closely');
    }
    
    // Progressive Loading Analysis
    if (metrics.progressiveLoading.enabled && metrics.progressiveLoading.totalChunks > 0) {
      const loadingProgress = metrics.progressiveLoading.loadedChunks / metrics.progressiveLoading.totalChunks;
      if (loadingProgress < 0.5) {
        score -= 5;
        warnings.push('Route still loading');
      }
    }
    
    // Browser Compatibility Analysis
    if (metrics.browser?.webglSupport === false) {
      score -= 20;
      warnings.push('WebGL not supported - reduced functionality');
      recommendations.push('Upgrade browser or enable WebGL for better performance');
    }
    
    // Leak Detection Analysis
    const leakCount = metrics.memory?.leakDetection?.eventListeners +
                     metrics.memory?.leakDetection?.timeouts +
                     metrics.memory?.leakDetection?.intervals;
    if (leakCount > 200) {
      score -= 15;
      warnings.push('Potential memory leaks detected');
      recommendations.push('Review event listener and timer cleanup');
    }
    
    // Determine status
    let status = 'good';
    if (score < 70) {
      status = 'critical';
    } else if (score < 85) {
      status = 'warning';
    }
    
    report.summary.status = status;
    report.summary.score = Math.max(0, score);
    report.summary.warnings = warnings;
    report.summary.recommendations = recommendations;
    
    return report;
  }

  /**
   * Log performance metrics to console (development mode)
   */
  logPerformanceMetrics() {
    const report = this.generatePerformanceReport();
    
    console.group('📊 Map Performance Report');
    console.log('Status:', report.summary.status.toUpperCase());
    console.log('Score:', `${report.summary.score}/100`);
    
    if (report.summary.warnings.length > 0) {
      console.warn('⚠️ Warnings:', report.summary.warnings);
    }
    
    if (report.summary.recommendations.length > 0) {
      console.info('💡 Recommendations:', report.summary.recommendations);
    }
    
    console.log('Performance Metrics:', report.metrics.performance);
    console.log('Memory Usage:', report.metrics.memory?.memory);
    console.log('Browser Info:', report.metrics.browser);
    console.groupEnd();
    
    return report;
  }

  /**
   * Create performance monitoring dashboard UI
   */
  createPerformanceDashboard() {
    // Only show in development mode
    if (window.location.hostname !== 'localhost' && !window.debugMode) {
      return;
    }
    
    const dashboard = document.createElement('div');
    dashboard.id = 'mapbox-performance-dashboard';
    dashboard.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      width: 300px;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 15px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 11px;
      z-index: 10000;
      max-height: 80vh;
      overflow-y: auto;
      backdrop-filter: blur(10px);
    `;
    
    const updateDashboard = () => {
      const report = this.generatePerformanceReport();
      const m = report.metrics;
      
      const statusColor = {
        good: '#10B981',
        warning: '#F59E0B',
        critical: '#EF4444'
      }[report.summary.status];
      
      dashboard.innerHTML = `
        <div style="border-bottom: 1px solid #333; margin-bottom: 10px; padding-bottom: 10px;">
          <strong>🗺️ Map Performance Monitor</strong>
          <span style="float: right; color: ${statusColor};">
            ${report.summary.score}/100
          </span>
        </div>
        
        <div><strong>FPS:</strong> ${m.performance.fps} / ${m.performance.targetFrameRate}</div>
        <div><strong>Memory:</strong> ${m.memory?.memory?.used || 'N/A'}MB (${m.memory?.memory?.percentage || 0}%)</div>
        <div><strong>Chunks:</strong> ${m.progressiveLoading.loadedChunks} / ${m.progressiveLoading.totalChunks}</div>
        <div><strong>Browser:</strong> ${m.browser?.name || 'Unknown'}</div>
        <div><strong>WebGL:</strong> ${m.browser?.webglSupport ? '✅' : '❌'}</div>
        <div><strong>Visible:</strong> ${m.performance.isVisible ? '👁️' : '👁️‍🗨️'}</div>
        
        ${m.map ? `
        <div style="margin-top: 10px; border-top: 1px solid #333; padding-top: 10px;">
          <div><strong>Zoom:</strong> ${Math.round(m.map.zoom * 10) / 10}</div>
          <div><strong>Sources:</strong> ${m.map.sourcesCount}</div>
          <div><strong>Layers:</strong> ${m.map.layersCount}</div>
        </div>
        ` : ''}
        
        ${report.summary.warnings.length > 0 ? `
        <div style="margin-top: 10px; padding: 8px; background: rgba(239, 68, 68, 0.2); border-radius: 4px;">
          <strong>⚠️ Issues:</strong><br>
          ${report.summary.warnings.map(w => `• ${w}`).join('<br>')}
        </div>
        ` : ''}
        
        <button onclick="this.parentElement.remove()" style="
          position: absolute; top: 5px; right: 8px; 
          background: none; border: none; color: #999; 
          cursor: pointer; font-size: 14px;
        ">&times;</button>
      `;
    };
    
    // Initial update
    updateDashboard();
    
    // Update every 2 seconds
    const interval = setInterval(updateDashboard, 2000);
    
    // Cleanup when dashboard is removed
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.removedNodes.forEach((node) => {
            if (node === dashboard) {
              clearInterval(interval);
              observer.disconnect();
            }
          });
        }
      });
    });
    
    observer.observe(document.body, { childList: true });
    document.body.appendChild(dashboard);
    
    return dashboard;
  }

  /**
   * Apply browser-specific optimizations after map creation
   */
  applyBrowserSpecificOptimizations() {
    if (!this.map) {
      console.warn('Map not available for browser optimizations');
      return;
    }
    
    if (!this.config) {
      console.warn('Config not available for browser optimizations, using fallback');
      // Use a simple fallback for browser detection
      const userAgent = navigator.userAgent;
      const browser = { 
        name: userAgent.includes('Chrome') ? 'chrome' : 
              userAgent.includes('Firefox') ? 'firefox' :
              userAgent.includes('Safari') ? 'safari' : 'unknown'
      };
      const platform = { 
        mobile: /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)
      };
      
      // Apply basic optimizations without full config
      if (browser.name === 'chrome') {
        this.applyChromeOptimizations();
      }
      if (platform.mobile) {
        this.applyMobileOptimizations(platform);
      }
      return;
    }
    
    const capabilities = this.config.detectBrowserCapabilities();
    const browser = capabilities.browser;
    const platform = capabilities.platform;
    
    // Safari-specific optimizations
    if (browser.name === 'safari') {
      this.applySafariOptimizations(platform);
    }
    
    // Firefox-specific optimizations
    if (browser.name === 'firefox') {
      this.applyFirefoxOptimizations();
    }
    
    // Edge-specific optimizations
    if (browser.name === 'edge') {
      this.applyEdgeOptimizations();
    }
    
    // Chrome-specific optimizations
    if (browser.name === 'chrome') {
      this.applyChromeOptimizations();
    }
    
    // Mobile-specific optimizations
    if (platform.mobile) {
      this.applyMobileOptimizations(platform);
    }
    
    // WebGL fallback handling
    if (!capabilities.features.webgl.supported) {
      this.applyWebGLFallbacks();
    }
  }

  /**
   * Safari-specific optimizations
   */
  applySafariOptimizations(platform) {
    // Safari has issues with certain map interactions
    if (platform.ios) {
      // iOS Safari optimizations
      this.map.dragRotate.disable();
      this.map.touchPitch?.disable();
      
      // Fix viewport issues on iOS
      const canvas = this.map.getCanvas();
      if (canvas) {
        canvas.style.touchAction = 'pan-x pan-y';
      }
      
      // Handle iOS viewport changes
      window.addEventListener('orientationchange', () => {
        setTimeout(() => {
          this.map.resize();
          // Force repaint after orientation change
          this.map.triggerRepaint();
        }, 100);
      });
    }
    
    // Desktop Safari optimizations
    if (platform.desktop) {
      // Reduce animation smoothness for better performance
      this.map.setFadeDuration(150);
      
      // Handle Safari's unique scrolling behavior
      const container = this.map.getContainer();
      container.addEventListener('wheel', (e) => {
        e.preventDefault();
      }, { passive: false });
    }
  }

  /**
   * Firefox-specific optimizations
   */
  applyFirefoxOptimizations() {
    // Firefox performs better with reduced fade duration
    this.map.setFadeDuration(100);
    
    // Firefox-specific canvas optimizations
    const canvas = this.map.getCanvas();
    if (canvas) {
      // Disable image smoothing for better performance in Firefox
      const context = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (context) {
        // Firefox-specific WebGL optimizations
        context.getExtension('WEBGL_lose_context');
      }
    }
    
    // Optimize animation frame rate for Firefox
    if (this.performanceOptimization) {
      this.performanceOptimization.targetFrameRate = Math.min(45, this.performanceOptimization.targetFrameRate);
      this.performanceOptimization.frameInterval = 1000 / this.performanceOptimization.targetFrameRate;
    }
  }

  /**
   * Edge-specific optimizations
   */
  applyEdgeOptimizations() {
    // Edge (Chromium) generally works well, but has some specific needs
    const canvas = this.map.getCanvas();
    if (canvas) {
      // Edge sometimes has rendering issues without this
      canvas.style.outline = 'none';
    }
    
    // Edge-specific touch handling
    this.map.getContainer().style.msTouchAction = 'pan-x pan-y';
  }

  /**
   * Chrome-specific optimizations
   */
  applyChromeOptimizations() {
    // Chrome generally has the best Mapbox support
    // Enable advanced features that work well in Chrome
    const canvas = this.map.getCanvas();
    if (canvas) {
      // Chrome supports high DPI rendering well
      const context = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (context && window.devicePixelRatio > 1) {
        // High DPI rendering is automatically handled by Mapbox GL JS v2+
        // setPixelRatio was deprecated and removed in favor of automatic handling
        console.log('High DPI display detected, automatic handling enabled');
      }
    }
  }

  /**
   * Mobile-specific optimizations
   */
  applyMobileOptimizations(platform) {
    // General mobile optimizations
    this.map.dragPan.disable();
    this.map.scrollZoom.disable();
    this.map.doubleClickZoom.disable();
    
    // Enable touch-friendly interactions
    this.map.touchZoomRotate.enable();
    
    // Optimize for mobile viewport
    const container = this.map.getContainer();
    container.style.touchAction = 'pan-x pan-y';
    
    // Mobile-specific performance settings
    this.map.setMaxZoom(16); // Limit zoom to reduce memory usage
    
    // Android-specific optimizations
    if (platform.android) {
      // Android Chrome has specific needs
      this.map.setFadeDuration(200); // Slightly longer for smoother animations
      
      // Handle Android back button if in WebView
      if (window.AndroidInterface) {
        // Custom Android handling if needed
        this.setupAndroidIntegration();
      }
    }
  }

  /**
   * WebGL fallback optimizations
   */
  applyWebGLFallbacks() {
    console.warn('WebGL not supported - applying fallback optimizations');
    
    // Disable expensive features
    this.map.setMaxZoom(14);
    this.map.setFadeDuration(0); // Disable transitions
    
    // Use simpler interaction methods
    this.map.dragRotate.disable();
    this.map.touchPitch?.disable();
    this.map.keyboard.disable();
    
    // Show warning to user
    this.showBrowserCompatibilityWarning();
  }

  /**
   * Show browser compatibility warning
   */
  showBrowserCompatibilityWarning() {
    const container = this.map.getContainer();
    const warning = document.createElement('div');
    warning.className = 'map-compatibility-warning';
    warning.style.cssText = `
      position: absolute;
      top: 10px;
      left: 10px;
      right: 10px;
      background: rgba(255, 193, 7, 0.9);
      color: #000;
      padding: 10px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 1000;
      backdrop-filter: blur(5px);
    `;
    warning.innerHTML = `
      <strong>Browser Compatibility Notice:</strong> 
      Your browser has limited map support. For the best experience, 
      please use Chrome, Firefox, Safari, or Edge.
      <button onclick="this.parentElement.remove()" style="float: right; background: none; border: none; font-size: 16px; cursor: pointer;">&times;</button>
    `;
    
    container.appendChild(warning);
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
      if (warning.parentElement) {
        warning.remove();
      }
    }, 10000);
  }

  /**
   * Android-specific integration setup
   */
  setupAndroidIntegration() {
    // Handle Android WebView specific requirements
    if (window.AndroidInterface) {
      // Example: Handle back button
      this.map.on('movestart', () => {
        window.AndroidInterface.onMapInteraction();
      });
    }
  }

  /**
   * Enhanced memory management configuration and state
   */
  initializeMemoryManagement() {
    this.memoryManagement = {
      // Object pooling
      pools: {
        markers: [],
        popups: [],
        geojsonFeatures: []
      },
      
      // Memory leak detection
      leakDetection: {
        enabled: true,
        objects: new WeakMap(),
        intervals: new Set(),
        timeouts: new Set(),
        eventListeners: new Map()
      },
      
      // Resource tracking
      resourceTracking: {
        sources: new Set(),
        layers: new Set(),
        images: new Set(),
        sprites: new Set()
      },
      
      // Cleanup scheduling
      autoCleanup: {
        enabled: true,
        interval: 30000, // 30 seconds
        intervalId: null
      },
      
      // Memory thresholds
      thresholds: {
        warningLevel: 0.7, // 70% of limit
        criticalLevel: 0.85, // 85% of limit
        cleanupLevel: 0.75 // 75% of limit
      }
    };
    
    // Start automatic cleanup if enabled
    this.startAutoCleanup();
    
    // Set up memory leak detection
    this.setupMemoryLeakDetection();
  }

  /**
   * Object pool for reusing objects
   */
  createObjectPool(type, createFn, resetFn, initialSize = 10) {
    const pool = [];
    
    for (let i = 0; i < initialSize; i++) {
      pool.push(createFn());
    }
    
    return {
      get: () => {
        if (pool.length > 0) {
          const obj = pool.pop();
          resetFn(obj);
          return obj;
        }
        return createFn();
      },
      
      release: (obj) => {
        if (pool.length < 50) { // Limit pool size
          resetFn(obj);
          pool.push(obj);
        }
      },
      
      clear: () => {
        pool.length = 0;
      },
      
      size: () => pool.length
    };
  }

  /**
   * Initialize object pools
   */
  initializeObjectPools() {
    // Marker pool
    this.memoryManagement.pools.markers = this.createObjectPool(
      'marker',
      () => new mapboxgl.Marker(),
      (marker) => {
        marker.remove();
        marker.getPopup()?.remove();
      }
    );
    
    // Popup pool
    this.memoryManagement.pools.popups = this.createObjectPool(
      'popup',
      () => new mapboxgl.Popup(),
      (popup) => {
        popup.remove();
        popup.setHTML('');
      }
    );
    
    // GeoJSON feature pool
    this.memoryManagement.pools.geojsonFeatures = this.createObjectPool(
      'geojson',
      () => ({
        type: 'Feature',
        properties: {},
        geometry: { type: 'Point', coordinates: [0, 0] }
      }),
      (feature) => {
        feature.properties = {};
        feature.geometry.coordinates = [0, 0];
      }
    );
  }

  /**
   * Set up memory leak detection
   */
  setupMemoryLeakDetection() {
    if (!this.memoryManagement.leakDetection.enabled) return;
    
    // Override addEventListener to track listeners
    this.trackEventListeners();
    
    // Override setTimeout/setInterval to track timers
    this.trackTimers();
    
    // Periodic leak detection
    setInterval(() => {
      this.detectMemoryLeaks();
    }, 60000); // Check every minute
  }

  /**
   * Track event listeners for leak detection
   */
  trackEventListeners() {
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    const originalRemoveEventListener = EventTarget.prototype.removeEventListener;
    const listeners = this.memoryManagement.leakDetection.eventListeners;
    
    EventTarget.prototype.addEventListener = function(type, listener, options) {
      const key = `${this.constructor.name}-${type}`;
      if (!listeners.has(key)) {
        listeners.set(key, new Set());
      }
      listeners.get(key).add(listener);
      
      return originalAddEventListener.call(this, type, listener, options);
    };
    
    EventTarget.prototype.removeEventListener = function(type, listener, options) {
      const key = `${this.constructor.name}-${type}`;
      if (listeners.has(key)) {
        listeners.get(key).delete(listener);
      }
      
      return originalRemoveEventListener.call(this, type, listener, options);
    };
  }

  /**
   * Track setTimeout and setInterval calls
   */
  trackTimers() {
    const originalSetTimeout = window.setTimeout;
    const originalSetInterval = window.setInterval;
    const originalClearTimeout = window.clearTimeout;
    const originalClearInterval = window.clearInterval;
    
    const timeouts = this.memoryManagement.leakDetection.timeouts;
    const intervals = this.memoryManagement.leakDetection.intervals;
    
    window.setTimeout = function(fn, delay) {
      const id = originalSetTimeout.call(this, (...args) => {
        timeouts.delete(id);
        return fn.apply(this, args);
      }, delay);
      timeouts.add(id);
      return id;
    };
    
    window.setInterval = function(fn, delay) {
      const id = originalSetInterval.call(this, fn, delay);
      intervals.add(id);
      return id;
    };
    
    window.clearTimeout = function(id) {
      timeouts.delete(id);
      return originalClearTimeout.call(this, id);
    };
    
    window.clearInterval = function(id) {
      intervals.delete(id);
      return originalClearInterval.call(this, id);
    };
  }

  /**
   * Start automatic cleanup routine
   */
  startAutoCleanup() {
    if (!this.memoryManagement.autoCleanup.enabled) return;
    
    this.memoryManagement.autoCleanup.intervalId = setInterval(() => {
      this.performAutomaticCleanup();
    }, this.memoryManagement.autoCleanup.interval);
  }

  /**
   * Stop automatic cleanup
   */
  stopAutoCleanup() {
    if (this.memoryManagement.autoCleanup.intervalId) {
      clearInterval(this.memoryManagement.autoCleanup.intervalId);
      this.memoryManagement.autoCleanup.intervalId = null;
    }
  }

  /**
   * Perform automatic cleanup
   */
  performAutomaticCleanup() {
    if (!performance.memory) return;
    
    const memoryInfo = performance.memory;
    const memoryUsageRatio = memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit;
    
    if (memoryUsageRatio > this.memoryManagement.thresholds.cleanupLevel) {
      console.log('Memory usage high, performing cleanup');
      this.performDeepCleanup();
    }
  }

  /**
   * Detect potential memory leaks
   */
  detectMemoryLeaks() {
    const leaks = [];
    
    // Check for excessive event listeners
    this.memoryManagement.leakDetection.eventListeners.forEach((listeners, key) => {
      if (listeners.size > 100) {
        leaks.push(`Excessive event listeners: ${key} (${listeners.size})`);
      }
    });
    
    // Check for uncleaned timers
    if (this.memoryManagement.leakDetection.timeouts.size > 50) {
      leaks.push(`Uncleaned timeouts: ${this.memoryManagement.leakDetection.timeouts.size}`);
    }
    
    if (this.memoryManagement.leakDetection.intervals.size > 10) {
      leaks.push(`Uncleaned intervals: ${this.memoryManagement.leakDetection.intervals.size}`);
    }
    
    // Check for excessive map resources
    if (this.memoryManagement.resourceTracking.sources.size > 100) {
      leaks.push(`Too many map sources: ${this.memoryManagement.resourceTracking.sources.size}`);
    }
    
    if (leaks.length > 0) {
      console.warn('Potential memory leaks detected:', leaks);
      this.performDeepCleanup();
    }
  }

  /**
   * Perform deep cleanup of resources
   */
  performDeepCleanup() {
    // Clean object pools
    Object.values(this.memoryManagement.pools).forEach(pool => {
      if (pool && typeof pool.clear === 'function') {
        pool.clear();
      }
    });
    
    // Clean up map resources that are no longer needed
    if (this.map) {
      // Remove old sources and layers that might be lingering
      this.cleanupOrphanedMapResources();
    }
    
    // Force garbage collection if available
    if (window.gc) {
      window.gc();
    }
    
    console.log('Deep cleanup completed');
  }

  /**
   * Clean up orphaned map resources
   */
  cleanupOrphanedMapResources() {
    if (!this.map) return;
    
    // Get all current sources and layers
    const style = this.map.getStyle();
    if (!style) return;
    
    const currentSources = new Set(Object.keys(style.sources || {}));
    const currentLayers = new Set((style.layers || []).map(l => l.id));
    
    // Find orphaned resources
    const orphanedSources = [...this.memoryManagement.resourceTracking.sources]
      .filter(id => !currentSources.has(id));
      
    const orphanedLayers = [...this.memoryManagement.resourceTracking.layers]
      .filter(id => !currentLayers.has(id));
    
    // Clean up orphaned resources
    orphanedSources.forEach(id => {
      this.memoryManagement.resourceTracking.sources.delete(id);
    });
    
    orphanedLayers.forEach(id => {
      this.memoryManagement.resourceTracking.layers.delete(id);
    });
    
    console.log(`Cleaned ${orphanedSources.length} orphaned sources and ${orphanedLayers.length} orphaned layers`);
  }

  /**
   * Track map resource creation
   */
  trackMapResource(type, id) {
    if (this.memoryManagement.resourceTracking[type]) {
      this.memoryManagement.resourceTracking[type].add(id);
    }
  }

  /**
   * Untrack map resource
   */
  untrackMapResource(type, id) {
    if (this.memoryManagement.resourceTracking[type]) {
      this.memoryManagement.resourceTracking[type].delete(id);
    }
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats() {
    const memoryInfo = performance.memory ? {
      used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
      total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
      limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024),
      percentage: Math.round((performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100)
    } : null;
    
    return {
      memory: memoryInfo,
      pools: {
        markers: this.memoryManagement.pools.markers?.size() || 0,
        popups: this.memoryManagement.pools.popups?.size() || 0,
        geojsonFeatures: this.memoryManagement.pools.geojsonFeatures?.size() || 0
      },
      resources: {
        sources: this.memoryManagement.resourceTracking.sources.size,
        layers: this.memoryManagement.resourceTracking.layers.size,
        images: this.memoryManagement.resourceTracking.images.size
      },
      leakDetection: {
        eventListeners: Array.from(this.memoryManagement.leakDetection.eventListeners.entries())
          .reduce((acc, [key, listeners]) => acc + listeners.size, 0),
        timeouts: this.memoryManagement.leakDetection.timeouts.size,
        intervals: this.memoryManagement.leakDetection.intervals.size
      }
    };
  }

  /**
   * Progressive loading configuration and state
   */
  initializeProgressiveLoading() {
    this.progressiveLoading = {
      enabled: true,
      chunkSize: 1000, // Points per chunk
      viewportBuffer: 0.2, // 20% buffer around viewport
      loadedChunks: new Set(),
      allChunks: [],
      isLoading: false,
      totalPoints: 0
    };
  }

  /**
   * Activity-based styling system configuration
   */
  initializeActivityStyling() {
    this.activityStyles = {
      // Activity type style mappings
      styleMap: {
        // Running activities
        'Run': { color: '#DC2626', width: 3, dashArray: null, zIndex: 100 },
        'TrailRun': { color: '#B91C1C', width: 3, dashArray: null, zIndex: 100 },
        'VirtualRun': { color: '#EF4444', width: 2.5, dashArray: [2, 3], zIndex: 90 },
        
        // Cycling activities
        'Ride': { color: '#2563EB', width: 3, dashArray: null, zIndex: 95 },
        'MountainBikeRide': { color: '#1D4ED8', width: 3.5, dashArray: null, zIndex: 95 },
        'GravelRide': { color: '#3B82F6', width: 3, dashArray: [4, 2], zIndex: 95 },
        'EBikeRide': { color: '#60A5FA', width: 2.5, dashArray: null, zIndex: 90 },
        'VirtualRide': { color: '#93C5FD', width: 2.5, dashArray: [3, 2], zIndex: 85 },
        
        // Walking activities  
        'Walk': { color: '#059669', width: 2.5, dashArray: [1, 2], zIndex: 80 },
        'Hike': { color: '#047857', width: 3, dashArray: null, zIndex: 85 },
        
        // Water activities
        'Swim': { color: '#0891B2', width: 4, dashArray: null, zIndex: 70 },
        'Kayaking': { color: '#0E7490', width: 3, dashArray: null, zIndex: 75 },
        'Canoeing': { color: '#155E75', width: 3, dashArray: null, zIndex: 75 },
        'Rowing': { color: '#164E63', width: 3, dashArray: null, zIndex: 75 },
        'Surfing': { color: '#06B6D4', width: 3.5, dashArray: [5, 3], zIndex: 75 },
        
        // Winter activities
        'AlpineSki': { color: '#7C3AED', width: 3.5, dashArray: null, zIndex: 90 },
        'BackcountrySki': { color: '#6D28D9', width: 3, dashArray: null, zIndex: 90 },
        'NordicSki': { color: '#8B5CF6', width: 2.5, dashArray: null, zIndex: 85 },
        'Snowboard': { color: '#A855F7', width: 3.5, dashArray: null, zIndex: 90 },
        'Snowshoe': { color: '#C084FC', width: 2.5, dashArray: [2, 2], zIndex: 80 },
        
        // Other activities
        'Workout': { color: '#F59E0B', width: 2, dashArray: [1, 1], zIndex: 60 },
        'Yoga': { color: '#F97316', width: 2, dashArray: [1, 3], zIndex: 60 },
        'WeightTraining': { color: '#EA580C', width: 2, dashArray: [2, 1], zIndex: 60 },
        'Crossfit': { color: '#DC2626', width: 2.5, dashArray: [3, 1], zIndex: 65 },
        
        // Default fallback
        'default': { color: '#6B7280', width: 2.5, dashArray: null, zIndex: 50 }
      },
      
      // Elevation-based gradient options
      elevationGradients: {
        enabled: false,
        colorStops: [
          { elevation: 0, color: '#22C55E' },      // Green for low elevation
          { elevation: 500, color: '#EAB308' },    // Yellow for medium elevation  
          { elevation: 1000, color: '#F97316' },   // Orange for high elevation
          { elevation: 2000, color: '#DC2626' },   // Red for very high elevation
          { elevation: 3000, color: '#7C2D12' }    // Dark red for extreme elevation
        ],
        segments: 50, // Number of gradient segments for smooth transitions
        opacity: 0.8
      },
      
      // Speed-based gradient options
      speedGradients: {
        enabled: false,
        colorStops: [
          { speed: 0, color: '#DC2626' },       // Red for slow/stopped
          { speed: 5, color: '#F97316' },       // Orange for moderate speed
          { speed: 15, color: '#EAB308' },      // Yellow for good speed
          { speed: 25, color: '#22C55E' },      // Green for fast speed
          { speed: 40, color: '#10B981' }       // Bright green for very fast
        ],
        segments: 30,
        opacity: 0.9
      },
      
      // Current activity data
      currentActivity: {
        type: null,
        sport_type: null,
        elevation: null,
        speed: null,
        style: null
      }
    };
  }

  /**
   * Initialize canvas size manager for dynamic print sizing
   */
  initializeCanvasSizeManager() {
    try {
      // Check if CanvasSizeManager is available
      if (typeof CanvasSizeManager !== 'undefined') {
        this.canvasSizeManager = new CanvasSizeManager({
          maxViewportWidth: 1200,
          maxViewportHeight: 800,
          minViewportWidth: 400,
          minViewportHeight: 300,
          resizeDebounce: 300,
          enableTransitions: true,
          memoryThreshold: 500,
          viewportScaleFactor: 0.8
        });

        console.log('Canvas Size Manager initialized successfully');
      } else {
        console.warn('CanvasSizeManager not available - dynamic canvas sizing disabled');
        this.canvasSizeManager = null;
      }
    } catch (error) {
      console.error('Failed to initialize Canvas Size Manager:', error);
      this.canvasSizeManager = null;
    }
  }

  /**
   * Get activity-based style for route rendering
   * @param {Object} activityData - Activity data with type, sport_type, elevation, speed
   * @returns {Object} - Style configuration for the activity
   */
  getActivityStyle(activityData = {}) {
    const { type, sport_type, elevation, speed } = activityData;
    
    // Store current activity data
    this.activityStyles.currentActivity = {
      type,
      sport_type,
      elevation,
      speed,
      style: null
    };
    
    // Determine primary activity type
    const activityType = sport_type || type || 'default';
    
    // Get style from mapping or use default
    const baseStyle = this.activityStyles.styleMap[activityType] || 
                      this.activityStyles.styleMap['default'];
    
    // Clone the base style to avoid mutations
    const style = {
      color: baseStyle.color,
      width: baseStyle.width,
      dashArray: baseStyle.dashArray,
      zIndex: baseStyle.zIndex,
      opacity: 1.0
    };
    
    // Store the computed style
    this.activityStyles.currentActivity.style = style;
    
    console.log(`Activity style applied: ${activityType}`, style);
    
    return style;
  }

  /**
   * Generate elevation-based gradient segments for route coloring
   * @param {Array} coordinates - Route coordinates [[lat, lng], ...]
   * @param {Array} elevationData - Elevation data points
   * @returns {Array} - Array of route segments with gradient colors
   */
  generateElevationGradient(coordinates, elevationData) {
    if (!elevationData || elevationData.length === 0 || !this.activityStyles.elevationGradients.enabled) {
      return null;
    }
    
    const { colorStops, segments, opacity } = this.activityStyles.elevationGradients;
    const gradientSegments = [];
    
    // Calculate points per segment
    const pointsPerSegment = Math.max(1, Math.floor(coordinates.length / segments));
    
    for (let i = 0; i < coordinates.length - 1; i += pointsPerSegment) {
      const segmentEnd = Math.min(i + pointsPerSegment, coordinates.length - 1);
      const segmentCoords = coordinates.slice(i, segmentEnd + 1);
      
      // Get average elevation for this segment
      const elevationIndices = elevationData.filter(e => e.index >= i && e.index <= segmentEnd);
      const avgElevation = elevationIndices.length > 0 
        ? elevationIndices.reduce((sum, e) => sum + e.elevation_meters, 0) / elevationIndices.length
        : 0;
      
      // Find appropriate color for elevation
      const color = this.getElevationColor(avgElevation, colorStops);
      
      gradientSegments.push({
        coordinates: segmentCoords.map(coord => [coord[1], coord[0]]), // Convert to [lng, lat]
        elevation: avgElevation,
        color,
        opacity
      });
    }
    
    return gradientSegments;
  }

  /**
   * Get color for specific elevation value
   * @param {number} elevation - Elevation in meters
   * @param {Array} colorStops - Array of elevation color stops
   * @returns {string} - Hex color value
   */
  getElevationColor(elevation, colorStops) {
    // Handle edge cases
    if (elevation <= colorStops[0].elevation) return colorStops[0].color;
    if (elevation >= colorStops[colorStops.length - 1].elevation) {
      return colorStops[colorStops.length - 1].color;
    }
    
    // Find the two color stops to interpolate between
    for (let i = 0; i < colorStops.length - 1; i++) {
      const lower = colorStops[i];
      const upper = colorStops[i + 1];
      
      if (elevation >= lower.elevation && elevation <= upper.elevation) {
        // Calculate interpolation factor
        const factor = (elevation - lower.elevation) / (upper.elevation - lower.elevation);
        return this.interpolateColor(lower.color, upper.color, factor);
      }
    }
    
    return colorStops[0].color; // Fallback
  }

  /**
   * Interpolate between two hex colors
   * @param {string} color1 - Start color (hex)
   * @param {string} color2 - End color (hex)
   * @param {number} factor - Interpolation factor (0-1)
   * @returns {string} - Interpolated hex color
   */
  interpolateColor(color1, color2, factor) {
    // Convert hex to RGB
    const rgb1 = this.hexToRgb(color1);
    const rgb2 = this.hexToRgb(color2);
    
    if (!rgb1 || !rgb2) return color1;
    
    // Interpolate each component
    const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * factor);
    const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * factor);
    const b = Math.round(rgb1.b + (rgb2.b - rgb1.b) * factor);
    
    // Convert back to hex
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
  }

  /**
   * Convert hex color to RGB object
   * @param {string} hex - Hex color string
   * @returns {Object|null} - RGB object {r, g, b} or null if invalid
   */
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  /**
   * Enable or disable elevation-based gradient rendering
   * @param {boolean} enabled - Whether to enable elevation gradients
   */
  toggleElevationGradient(enabled) {
    this.activityStyles.elevationGradients.enabled = enabled;
    console.log(`Elevation gradient ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Enable or disable speed-based gradient rendering
   * @param {boolean} enabled - Whether to enable speed gradients
   */
  toggleSpeedGradient(enabled) {
    this.activityStyles.speedGradients.enabled = enabled;
    console.log(`Speed gradient ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Chunk large route datasets for progressive loading
   */
  chunkRouteData(coordinates) {
    if (!coordinates || coordinates.length === 0) return [];
    
    const chunks = [];
    const chunkSize = this.progressiveLoading.chunkSize;
    
    for (let i = 0; i < coordinates.length; i += chunkSize) {
      const chunk = {
        id: chunks.length,
        coordinates: coordinates.slice(i, i + chunkSize),
        bounds: null,
        loaded: false,
        priority: 0 // Will be calculated based on viewport
      };
      
      // Calculate bounds for this chunk
      if (chunk.coordinates.length > 0) {
        const lngs = chunk.coordinates.map(coord => coord[1] || coord.lng || coord[0]);
        const lats = chunk.coordinates.map(coord => coord[0] || coord.lat || coord[1]);
        
        chunk.bounds = {
          north: Math.max(...lats),
          south: Math.min(...lats),
          east: Math.max(...lngs),
          west: Math.min(...lngs)
        };
      }
      
      chunks.push(chunk);
    }
    
    return chunks;
  }

  /**
   * Calculate chunk priority based on viewport visibility
   */
  calculateChunkPriority(chunk) {
    if (!chunk.bounds || !this.map) return 0;
    
    const mapBounds = this.map.getBounds();
    const viewport = {
      north: mapBounds.getNorth(),
      south: mapBounds.getSouth(),
      east: mapBounds.getEast(),
      west: mapBounds.getWest()
    };
    
    // Add buffer to viewport
    const buffer = this.progressiveLoading.viewportBuffer;
    const latRange = viewport.north - viewport.south;
    const lngRange = viewport.east - viewport.west;
    
    const bufferedViewport = {
      north: viewport.north + (latRange * buffer),
      south: viewport.south - (latRange * buffer),
      east: viewport.east + (lngRange * buffer),
      west: viewport.west - (lngRange * buffer)
    };
    
    // Check intersection with buffered viewport
    const intersects = !(
      chunk.bounds.south > bufferedViewport.north ||
      chunk.bounds.north < bufferedViewport.south ||
      chunk.bounds.east < bufferedViewport.west ||
      chunk.bounds.west > bufferedViewport.east
    );
    
    if (!intersects) return 0;
    
    // Calculate overlap area for priority
    const overlapNorth = Math.min(chunk.bounds.north, bufferedViewport.north);
    const overlapSouth = Math.max(chunk.bounds.south, bufferedViewport.south);
    const overlapEast = Math.min(chunk.bounds.east, bufferedViewport.east);
    const overlapWest = Math.max(chunk.bounds.west, bufferedViewport.west);
    
    const overlapArea = (overlapNorth - overlapSouth) * (overlapEast - overlapWest);
    const chunkArea = (chunk.bounds.north - chunk.bounds.south) * (chunk.bounds.east - chunk.bounds.west);
    
    return overlapArea / chunkArea; // Priority 0-1 based on visibility percentage
  }

  /**
   * Load route chunks progressively based on viewport
   */
  async loadVisibleChunks() {
    if (!this.progressiveLoading.enabled || this.progressiveLoading.isLoading) {
      return;
    }
    
    this.progressiveLoading.isLoading = true;
    
    try {
      // Calculate priorities for all chunks
      this.progressiveLoading.allChunks.forEach(chunk => {
        chunk.priority = this.calculateChunkPriority(chunk);
      });
      
      // Sort by priority (highest first)
      const chunksToLoad = this.progressiveLoading.allChunks
        .filter(chunk => chunk.priority > 0 && !this.progressiveLoading.loadedChunks.has(chunk.id))
        .sort((a, b) => b.priority - a.priority)
        .slice(0, 3); // Load up to 3 chunks per batch
      
      if (chunksToLoad.length === 0) return;
      
      // Load chunks
      for (const chunk of chunksToLoad) {
        await this.loadRouteChunk(chunk);
        this.progressiveLoading.loadedChunks.add(chunk.id);
      }
      
      // Update loading indicator
      const loadedCount = this.progressiveLoading.loadedChunks.size;
      const totalCount = this.progressiveLoading.allChunks.length;
      const progress = Math.round((loadedCount / totalCount) * 100);
      
      if (loadedCount < totalCount) {
        this.updateLoadingIndicator(`Loading route... ${progress}%`);
      } else {
        this.hideLoadingIndicator();
      }
      
    } finally {
      this.progressiveLoading.isLoading = false;
    }
  }

  /**
   * Load a single route chunk
   */
  async loadRouteChunk(chunk) {
    if (!chunk || chunk.loaded) return;
    
    const sourceId = `route-chunk-${chunk.id}`;
    const layerId = `route-line-chunk-${chunk.id}`;
    
    // Convert coordinates to GeoJSON format
    const geoJsonCoords = chunk.coordinates.map(coord => [
      coord[1] || coord.lng || coord[0], // longitude
      coord[0] || coord.lat || coord[1]  // latitude
    ]);
    
    // Add source for this chunk
    this.map.addSource(sourceId, {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: { chunkId: chunk.id },
        geometry: {
          type: 'LineString',
          coordinates: geoJsonCoords
        }
      }
    });
    
    // Add layer for this chunk
    this.map.addLayer({
      id: layerId,
      type: 'line',
      source: sourceId,
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': this.options.routeColor,
        'line-width': this.options.routeWidth,
        'line-opacity': 0.8
      }
    });
    
    chunk.loaded = true;
    
    // Small delay to prevent overwhelming the browser
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  /**
   * Set up viewport-based loading listeners
   */
  setupProgressiveLoadingListeners() {
    if (!this.map) return;
    
    // Load chunks when map moves or zooms
    const debouncedLoad = this.debounce(() => {
      this.loadVisibleChunks();
    }, 250);
    
    this.map.on('moveend', debouncedLoad);
    this.map.on('zoomend', debouncedLoad);
    
    // Initial load
    this.map.on('idle', () => {
      if (this.progressiveLoading.allChunks.length > 0 && this.progressiveLoading.loadedChunks.size === 0) {
        this.loadVisibleChunks();
      }
    });
  }

  /**
   * Check if progressive loading should be used for this route
   */
  shouldUseProgressiveLoading(coordinates) {
    return coordinates && coordinates.length > this.progressiveLoading.chunkSize;
  }

  /**
   * Clear progressive loading state
   */
  clearProgressiveLoading() {
    if (!this.progressiveLoading) return;
    
    // Remove all chunk sources and layers
    this.progressiveLoading.loadedChunks.forEach(chunkId => {
      const sourceId = `route-chunk-${chunkId}`;
      const layerId = `route-line-chunk-${chunkId}`;
      
      try {
        if (this.map.getLayer(layerId)) {
          this.map.removeLayer(layerId);
        }
        if (this.map.getSource(sourceId)) {
          this.map.removeSource(sourceId);
        }
      } catch (error) {
        console.warn(`Failed to remove chunk ${chunkId}:`, error);
      }
    });
    
    // Reset state
    this.progressiveLoading.loadedChunks.clear();
    this.progressiveLoading.allChunks = [];
    this.progressiveLoading.isLoading = false;
  }

  /**
   * Update loading indicator with progress
   */
  updateLoadingIndicator(message) {
    const indicator = document.querySelector('.map-loading-indicator');
    if (indicator) {
      const messageElement = indicator.querySelector('.loading-message');
      if (messageElement) {
        messageElement.textContent = message;
      }
    }
  }

  /**
   * Utility: Debounce function calls
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Render a route map from activity data
   */
  async renderRouteMap(routeData) {
    if (!this.isInitialized) {
      await this.init();
    }

    try {
      const { coordinates, bounds, title, customization = {}, stats = {} } = routeData;
      
      if (!coordinates || coordinates.length === 0) {
        throw new Error('No route coordinates provided');
      }

      // Show loading indicator
      if (this.options.showRouteStats) {
        this.showLoadingIndicator('Rendering route...');
      }

      // Clear existing route if present
      this.clearRoute();

      // Validate and store route data for animation
      this.routeAnimation.coordinates = coordinates
        .filter(coord => {
          if (!Array.isArray(coord) || coord.length < 2) return false;
          const lat = coord[0], lng = coord[1];
          return !isNaN(lat) && !isNaN(lng) && 
                 lat >= -90 && lat <= 90 && 
                 lng >= -180 && lng <= 180;
        })
        .map(coord => [coord[1], coord[0]]); // [lng, lat] for GeoJSON
      
      // Check if we have valid coordinates after filtering
      if (this.routeAnimation.coordinates.length === 0) {
        throw new Error('No valid coordinates found after validation');
      }
      
      console.log(`Valid coordinates: ${this.routeAnimation.coordinates.length}/${coordinates.length}`);
      
      this.routeStats = {
        distance: stats.distance || this.calculateDistance(coordinates),
        duration: stats.duration || 0,
        elevationGain: stats.elevationGain || 0,
        waypoints: []
      };

      // Get activity-based styling
      const activityData = {
        type: routeData.type || stats.type,
        sport_type: routeData.sport_type || stats.sport_type,
        elevation: routeData.elevation || stats.elevation,
        speed: routeData.speed || stats.speed
      };
      
      const activityStyle = this.getActivityStyle(activityData);
      
      // Check for elevation-based gradient rendering
      const elevationGradients = routeData.elevation 
        ? this.generateElevationGradient(coordinates, routeData.elevation)
        : null;

      // Check if progressive loading should be used for large datasets
      if (this.shouldUseProgressiveLoading(coordinates)) {
        console.log(`Large route detected (${coordinates.length} points) - using progressive loading`);
        
        // Prepare chunks for progressive loading
        this.progressiveLoading.allChunks = this.chunkRouteData(coordinates);
        this.progressiveLoading.totalPoints = coordinates.length;
        
        // Set up progressive loading listeners
        this.setupProgressiveLoadingListeners();
        
        // Start with immediate visible chunks
        setTimeout(() => this.loadVisibleChunks(), 100);
        
      } else {
        // Use standard loading for smaller routes
        this.map.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: this.routeAnimation.coordinates
            }
          }
        });
      }

      // Add animated route layer (initially empty)
      this.map.addSource('route-animated', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: []
          }
        }
      });

      // Apply activity-based styling (with customization override)
      const routeColor = customization.routeColor || activityStyle.color;
      const routeWidth = customization.routeWidth || activityStyle.width;
      const routeOpacity = customization.routeOpacity || activityStyle.opacity;

      // Create main route layer with activity styling
      const mainLayerPaint = {
        'line-color': routeColor,
        'line-width': routeWidth,
        'line-opacity': this.options.enableAnimation ? routeOpacity * 0.8 : routeOpacity
      };

      // Add dash array if specified for activity type
      const mainLayerLayout = {
        'line-join': 'round',
        'line-cap': 'round'
      };
      
      if (activityStyle.dashArray && !customization.routeColor) {
        mainLayerPaint['line-dasharray'] = activityStyle.dashArray;
      }

      // Main route layer (full route, dimmed when animating)
      this.map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: mainLayerLayout,
        paint: mainLayerPaint,
        metadata: {
          activityType: activityData.type || activityData.sport_type,
          zIndex: activityStyle.zIndex
        }
      });

      // Animated route layer (bright, shows progress) - always solid line for animation
      this.map.addLayer({
        id: 'route-animated',
        type: 'line',
        source: 'route-animated',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': routeColor,
          'line-width': routeWidth + 1,
          'line-opacity': 1.0
        },
        metadata: {
          activityType: activityData.type || activityData.sport_type,
          zIndex: activityStyle.zIndex + 10
        }
      });

      // Add elevation-based gradient segments if available
      if (elevationGradients && elevationGradients.length > 0) {
        console.log(`Adding ${elevationGradients.length} elevation gradient segments`);
        
        elevationGradients.forEach((segment, index) => {
          const segmentId = `route-elevation-${index}`;
          
          // Add source for this gradient segment
          this.map.addSource(segmentId, {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {
                elevation: segment.elevation
              },
              geometry: {
                type: 'LineString',
                coordinates: segment.coordinates
              }
            }
          });
          
          // Add layer for this gradient segment with higher z-index than main route
          this.map.addLayer({
            id: `${segmentId}-line`,
            type: 'line',
            source: segmentId,
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': segment.color,
              'line-width': routeWidth + 0.5, // Slightly wider to show on top
              'line-opacity': segment.opacity
            },
            metadata: {
              isElevationGradient: true,
              elevation: segment.elevation,
              zIndex: activityStyle.zIndex + 5 // Above main route, below animation
            }
          });
        });
      }

      // Add start and end markers if requested
      if (customization.showStartEnd !== false) {
        this.addStartEndMarkers(coordinates);
      }

      // Add waypoint markers if explicitly enabled (default: false for cleaner route display)
      if (this.options.showWaypoints && customization.showWaypoints !== false) {
        this.addWaypointMarkers(coordinates);
      }

      // Add route statistics overlay if enabled
      if (this.options.showRouteStats) {
        this.addRouteStatsOverlay();
      }

      // Add route animation controls if enabled
      if (this.options.enableAnimation) {
        this.addRouteAnimationControls();
      }

      // Fit map to route bounds
      if (bounds) {
        this.map.fitBounds([
          [bounds.west, bounds.south],
          [bounds.east, bounds.north]
        ], { padding: 50 });
      }

      // Ensure proper layer z-ordering
      setTimeout(() => {
        this.enforceLayerZOrder();
      }, 100);

      // Hide loading indicator
      this.hideLoadingIndicator();

      console.log('MapboxIntegration: Route rendered successfully');
      
      return this;

    } catch (error) {
      this.hideLoadingIndicator();
      console.error('MapboxIntegration: Failed to render route:', error);
      throw error;
    }
  }

  /**
   * Add start and end markers to the route
   */
  addStartEndMarkers(coordinates) {
    if (coordinates.length < 2) return;

    const startCoord = coordinates[0];
    const endCoord = coordinates[coordinates.length - 1];

    // Start marker (green)
    const startMarker = new mapboxgl.Marker({
      color: '#10B981'
    })
    .setLngLat([startCoord[1], startCoord[0]])
    .setPopup(new mapboxgl.Popup().setHTML('<strong>Start</strong>'))
    .addTo(this.map);

    // End marker (red)
    const endMarker = new mapboxgl.Marker({
      color: '#EF4444'
    })
    .setLngLat([endCoord[1], endCoord[0]])
    .setPopup(new mapboxgl.Popup().setHTML('<strong>Finish</strong>'))
    .addTo(this.map);

    // Store markers for cleanup
    this.markers = [startMarker, endMarker];
  }

  /**
   * Clear existing route and markers
   */
  clearRoute() {
    // Stop any running animation
    this.stopRouteAnimation();

    // Remove route layers
    if (this.map.getSource('route')) {
      this.map.removeLayer('route-line');
      this.map.removeSource('route');
    }

    if (this.map.getSource('route-animated')) {
      this.map.removeLayer('route-animated');
      this.map.removeSource('route-animated');
    }

    // Remove elevation gradient layers
    this.clearElevationGradientLayers();

    // Clear markers
    if (this.markers) {
      this.markers.forEach(marker => marker.remove());
      this.markers = [];
    }

    // Clear waypoint markers
    if (this.waypointMarkers) {
      this.waypointMarkers.forEach(marker => marker.remove());
      this.waypointMarkers = [];
    }

    // Remove route controls
    if (this.routeControls) {
      this.routeControls.remove();
      this.routeControls = null;
    }

    // Remove stats overlay
    this.removeRouteStatsOverlay();

    // Clear progressive loading state
    this.clearProgressiveLoading();

    // Reset animation state
    this.routeAnimation = {
      isPlaying: false,
      isPaused: false,
      progress: 0,
      animationId: null,
      startTime: null,
      pausedTime: 0,
      duration: this.options.animationDuration,
      coordinates: [],
      currentSegment: 0
    };
  }

  /**
   * Clear elevation gradient layers from the map
   */
  clearElevationGradientLayers() {
    if (!this.map) return;
    
    // Find and remove all elevation gradient layers
    const layers = this.map.getStyle().layers || [];
    const elevationLayers = layers.filter(layer => 
      layer.id.startsWith('route-elevation-') && layer.id.endsWith('-line')
    );
    
    elevationLayers.forEach(layer => {
      try {
        this.map.removeLayer(layer.id);
        
        // Also remove the corresponding source
        const sourceId = layer.id.replace('-line', '');
        if (this.map.getSource(sourceId)) {
          this.map.removeSource(sourceId);
        }
      } catch (error) {
        console.warn(`Failed to remove elevation gradient layer ${layer.id}:`, error);
      }
    });
    
    console.log(`Cleared ${elevationLayers.length} elevation gradient layers`);
  }

  /**
   * Ensure proper z-index ordering for all route layers
   * Higher zIndex values should render on top
   */
  enforceLayerZOrder() {
    if (!this.map || !this.map.isStyleLoaded()) return;
    
    // Get all route-related layers with their metadata
    const routeLayers = [];
    const layers = this.map.getStyle().layers || [];
    
    layers.forEach(layer => {
      if (layer.id.includes('route') && layer.metadata?.zIndex !== undefined) {
        routeLayers.push({
          id: layer.id,
          zIndex: layer.metadata.zIndex,
          isElevationGradient: layer.metadata.isElevationGradient || false,
          activityType: layer.metadata.activityType
        });
      }
    });
    
    // Sort by zIndex (lower values render first/below)
    routeLayers.sort((a, b) => a.zIndex - b.zIndex);
    
    // Re-order layers to match zIndex hierarchy
    let previousLayerId = null;
    routeLayers.forEach((routeLayer, index) => {
      try {
        // Move layer to correct position
        if (previousLayerId) {
          this.map.moveLayer(routeLayer.id, previousLayerId);
        }
        previousLayerId = routeLayer.id;
        
        console.log(`Layer ${routeLayer.id} ordered with zIndex ${routeLayer.zIndex}`);
      } catch (error) {
        console.warn(`Failed to reorder layer ${routeLayer.id}:`, error);
      }
    });
    
    console.log(`Enforced z-order for ${routeLayers.length} route layers`);
  }

  /**
   * Add a new route layer with proper z-index positioning
   * @param {Object} layerConfig - Mapbox layer configuration
   * @param {number} zIndex - Z-index for layer ordering
   * @param {string} beforeLayerId - Optional layer ID to insert before
   */
  addRouteLayerWithZOrder(layerConfig, zIndex, beforeLayerId = null) {
    if (!this.map || !layerConfig) return;
    
    // Add zIndex to metadata
    layerConfig.metadata = layerConfig.metadata || {};
    layerConfig.metadata.zIndex = zIndex;
    
    // Find the correct position to insert based on zIndex
    if (!beforeLayerId) {
      const layers = this.map.getStyle().layers || [];
      
      // Find the first layer with higher zIndex to insert before
      for (let i = layers.length - 1; i >= 0; i--) {
        const layer = layers[i];
        if (layer.metadata?.zIndex !== undefined && layer.metadata.zIndex > zIndex) {
          beforeLayerId = layer.id;
          break;
        }
      }
    }
    
    // Add the layer
    try {
      if (beforeLayerId) {
        this.map.addLayer(layerConfig, beforeLayerId);
      } else {
        this.map.addLayer(layerConfig);
      }
      
      console.log(`Added route layer ${layerConfig.id} with zIndex ${zIndex}`);
    } catch (error) {
      console.error(`Failed to add route layer ${layerConfig.id}:`, error);
    }
  }

  /**
   * Get route layers ordered by z-index
   * @returns {Array} - Array of layer objects sorted by zIndex
   */
  getOrderedRouteLayers() {
    if (!this.map) return [];
    
    const routeLayers = [];
    const layers = this.map.getStyle().layers || [];
    
    layers.forEach(layer => {
      if (layer.id.includes('route') && layer.metadata?.zIndex !== undefined) {
        routeLayers.push({
          id: layer.id,
          zIndex: layer.metadata.zIndex,
          type: layer.type,
          activityType: layer.metadata.activityType,
          isElevationGradient: layer.metadata.isElevationGradient || false,
          visible: this.map.getLayoutProperty(layer.id, 'visibility') !== 'none'
        });
      }
    });
    
    return routeLayers.sort((a, b) => a.zIndex - b.zIndex);
  }

  /**
   * Toggle visibility of route layers by activity type
   * @param {string} activityType - Activity type to toggle
   * @param {boolean} visible - Whether to show or hide
   */
  toggleActivityRoutes(activityType, visible) {
    if (!this.map) return;
    
    const layers = this.map.getStyle().layers || [];
    let toggledCount = 0;
    
    layers.forEach(layer => {
      if (layer.metadata?.activityType === activityType) {
        try {
          this.map.setLayoutProperty(
            layer.id, 
            'visibility', 
            visible ? 'visible' : 'none'
          );
          toggledCount++;
        } catch (error) {
          console.warn(`Failed to toggle visibility for layer ${layer.id}:`, error);
        }
      }
    });
    
    console.log(`Toggled visibility for ${toggledCount} ${activityType} route layers`);
    return toggledCount;
  }

  /**
   * Set opacity for all route layers of a specific activity type
   * @param {string} activityType - Activity type
   * @param {number} opacity - Opacity value (0-1)
   */
  setActivityRouteOpacity(activityType, opacity) {
    if (!this.map) return;
    
    const layers = this.map.getStyle().layers || [];
    let updatedCount = 0;
    
    layers.forEach(layer => {
      if (layer.metadata?.activityType === activityType && layer.type === 'line') {
        try {
          this.map.setPaintProperty(layer.id, 'line-opacity', opacity);
          updatedCount++;
        } catch (error) {
          console.warn(`Failed to set opacity for layer ${layer.id}:`, error);
        }
      }
    });
    
    console.log(`Set opacity to ${opacity} for ${updatedCount} ${activityType} route layers`);
    return updatedCount;
  }

  /**
   * Bring route layers to front (highest z-index)
   * @param {string} activityType - Activity type to bring to front
   */
  bringActivityRoutesToFront(activityType) {
    if (!this.map) return;
    
    const routeLayers = this.getOrderedRouteLayers();
    const maxZIndex = Math.max(...routeLayers.map(l => l.zIndex), 100);
    
    const activityLayers = routeLayers.filter(l => l.activityType === activityType);
    
    activityLayers.forEach((layer, index) => {
      try {
        // Update metadata zIndex
        const layerDef = this.map.getLayer(layer.id);
        if (layerDef.metadata) {
          layerDef.metadata.zIndex = maxZIndex + index + 1;
        }
        
        // Move layer to top
        this.map.moveLayer(layer.id);
      } catch (error) {
        console.warn(`Failed to bring layer ${layer.id} to front:`, error);
      }
    });
    
    console.log(`Brought ${activityLayers.length} ${activityType} layers to front`);
  }

  /**
   * Test route styling and rendering functionality
   * @returns {Object} - Test results
   */
  testRouteStyling() {
    const testResults = {
      timestamp: new Date().toISOString(),
      tests: [],
      success: true,
      summary: {}
    };

    // Test 1: Activity style mapping
    try {
      const runStyle = this.getActivityStyle({ type: 'Run' });
      const cyclingStyle = this.getActivityStyle({ type: 'Ride' });
      
      testResults.tests.push({
        name: 'Activity Style Mapping',
        passed: runStyle.color === '#DC2626' && cyclingStyle.color === '#2563EB',
        details: { runStyle, cyclingStyle }
      });
    } catch (error) {
      testResults.tests.push({
        name: 'Activity Style Mapping',
        passed: false,
        error: error.message
      });
      testResults.success = false;
    }

    // Test 2: Elevation gradient generation
    try {
      const mockElevation = [
        { index: 0, elevation_meters: 100 },
        { index: 50, elevation_meters: 200 },
        { index: 100, elevation_meters: 300 }
      ];
      const mockCoords = Array.from({ length: 101 }, (_, i) => [40.7128 + i * 0.001, -74.0060 + i * 0.001]);
      
      this.toggleElevationGradient(true);
      const gradients = this.generateElevationGradient(mockCoords, mockElevation);
      
      testResults.tests.push({
        name: 'Elevation Gradient Generation',
        passed: gradients && gradients.length > 0,
        details: { segmentCount: gradients?.length || 0 }
      });
    } catch (error) {
      testResults.tests.push({
        name: 'Elevation Gradient Generation',
        passed: false,
        error: error.message
      });
      testResults.success = false;
    }

    // Test 3: Color interpolation
    try {
      const interpolatedColor = this.interpolateColor('#FF0000', '#0000FF', 0.5);
      const expectedRGB = this.hexToRgb(interpolatedColor);
      
      testResults.tests.push({
        name: 'Color Interpolation',
        passed: expectedRGB && expectedRGB.r > 0 && expectedRGB.b > 0,
        details: { interpolatedColor, rgb: expectedRGB }
      });
    } catch (error) {
      testResults.tests.push({
        name: 'Color Interpolation',
        passed: false,
        error: error.message
      });
      testResults.success = false;
    }

    // Test 4: Layer Z-order management
    try {
      const orderedLayers = this.getOrderedRouteLayers();
      testResults.tests.push({
        name: 'Layer Z-order Management',
        passed: Array.isArray(orderedLayers),
        details: { layerCount: orderedLayers.length }
      });
    } catch (error) {
      testResults.tests.push({
        name: 'Layer Z-order Management',
        passed: false,
        error: error.message
      });
      testResults.success = false;
    }

    // Generate summary
    const passedTests = testResults.tests.filter(t => t.passed).length;
    const totalTests = testResults.tests.length;
    
    testResults.summary = {
      passed: passedTests,
      total: totalTests,
      passRate: Math.round((passedTests / totalTests) * 100),
      overall: testResults.success ? 'PASS' : 'FAIL'
    };

    console.log('Route Styling Test Results:', testResults);
    return testResults;
  }

  /**
   * Performance benchmark for route rendering
   * @param {Object} testData - Test route data
   * @returns {Object} - Performance metrics
   */
  benchmarkRoutePerformance(testData) {
    const metrics = {
      timestamp: new Date().toISOString(),
      tests: {},
      recommendations: []
    };

    // Test activity style performance
    const styleStart = performance.now();
    for (let i = 0; i < 1000; i++) {
      this.getActivityStyle({ type: 'Run' });
    }
    const styleEnd = performance.now();
    
    metrics.tests.activityStyling = {
      iterations: 1000,
      totalTime: styleEnd - styleStart,
      avgTime: (styleEnd - styleStart) / 1000,
      performance: (styleEnd - styleStart) < 10 ? 'excellent' : 'needs optimization'
    };

    // Test color interpolation performance
    if (testData?.coordinates?.length > 100) {
      const colorStart = performance.now();
      for (let i = 0; i < 100; i++) {
        this.interpolateColor('#FF0000', '#0000FF', Math.random());
      }
      const colorEnd = performance.now();
      
      metrics.tests.colorInterpolation = {
        iterations: 100,
        totalTime: colorEnd - colorStart,
        avgTime: (colorEnd - colorStart) / 100,
        performance: (colorEnd - colorStart) < 5 ? 'excellent' : 'acceptable'
      };
    }

    // Memory usage estimation
    const routeLayers = this.getOrderedRouteLayers();
    metrics.memory = {
      routeLayers: routeLayers.length,
      estimatedMemoryUsage: routeLayers.length * 50 + 'KB' // Rough estimation
    };

    // Performance recommendations
    if (metrics.tests.activityStyling.totalTime > 10) {
      metrics.recommendations.push('Consider caching activity styles for better performance');
    }
    
    if (routeLayers.length > 20) {
      metrics.recommendations.push('Consider layer pooling for routes with many segments');
    }

    console.log('Route Performance Metrics:', metrics);
    return metrics;
  }

  /**
   * Resize canvas for specific print format with dynamic sizing
   * @param {string} format - Print format (A4, A3)
   * @param {string} orientation - Orientation (portrait, landscape)
   * @param {number} quality - Target DPI for preview (default: 150)
   * @param {Object} options - Resize options
   * @returns {Promise<Object>} Resize result with dimensions
   */
  async resizeForPrintFormat(format, orientation, quality = 150, options = {}) {
    if (!this.canvasSizeManager) {
      console.warn('Canvas Size Manager not available - using default sizing');
      return this.fallbackResize(format, orientation);
    }

    try {
      console.log(`Resizing canvas for ${format} ${orientation} at ${quality} DPI`);

      // Resize the canvas container
      const dimensions = await this.canvasSizeManager.resizeCanvas(
        this.container,
        format,
        orientation,
        quality,
        options
      );

      // Trigger map resize to adjust to new container dimensions
      if (this.map) {
        // Wait for DOM update
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        // Resize map to fit new container
        this.map.resize();
        
        // Optionally maintain map view
        if (options.maintainView !== false) {
          await this.maintainMapViewDuringResize();
        }
      }

      // Emit resize event for external listeners
      this.emit('canvas-resized', {
        format,
        orientation,
        quality,
        dimensions,
        timestamp: Date.now()
      });

      console.log('Canvas resize completed:', dimensions);
      return dimensions;

    } catch (error) {
      console.error('Canvas resize failed:', error);
      throw new Error(`Failed to resize canvas: ${error.message}`);
    }
  }

  /**
   * Update canvas size with new dimensions (internal method)
   * @param {number} width - New width in pixels
   * @param {number} height - New height in pixels
   * @param {Object} options - Update options
   * @returns {Promise<void>} Update completion promise
   */
  async updateCanvasSize(width, height, options = {}) {
    if (!this.container) {
      throw new Error('Map container not found');
    }

    try {
      // Apply new dimensions with optional animation
      if (options.animate !== false && this.canvasSizeManager?.options.enableTransitions) {
        // Animated resize
        this.container.style.transition = 'width 300ms ease-out, height 300ms ease-out';
        this.container.style.width = `${width}px`;
        this.container.style.height = `${height}px`;

        // Wait for animation to complete
        await new Promise(resolve => {
          const handleTransition = (event) => {
            if (event.target === this.container && event.propertyName === 'width') {
              this.container.removeEventListener('transitionend', handleTransition);
              this.container.style.transition = '';
              resolve();
            }
          };
          this.container.addEventListener('transitionend', handleTransition);
          
          // Fallback timeout
          setTimeout(() => {
            this.container.removeEventListener('transitionend', handleTransition);
            this.container.style.transition = '';
            resolve();
          }, 500);
        });
      } else {
        // Immediate resize
        this.container.style.width = `${width}px`;
        this.container.style.height = `${height}px`;
        await new Promise(resolve => requestAnimationFrame(resolve));
      }

      // Trigger map resize
      if (this.map) {
        this.map.resize();
      }

    } catch (error) {
      console.error('Canvas size update failed:', error);
      throw error;
    }
  }

  /**
   * Maintain map view during resize operations
   * @returns {Promise<void>} View maintenance completion
   */
  async maintainMapViewDuringResize() {
    if (!this.map) return;

    try {
      // Store current map state
      const mapState = {
        center: this.map.getCenter(),
        zoom: this.map.getZoom(),
        bearing: this.map.getBearing(),
        pitch: this.map.getPitch()
      };

      // If we have route bounds, fit to them instead
      if (this.routeLayer && this.map.getSource('route')) {
        const routeData = this.map.getSource('route')._data;
        if (routeData && routeData.features && routeData.features.length > 0) {
          const coordinates = [];
          routeData.features.forEach(feature => {
            if (feature.geometry && feature.geometry.coordinates) {
              coordinates.push(...feature.geometry.coordinates);
            }
          });

          if (coordinates.length > 0) {
            const bounds = coordinates.reduce((bounds, coord) => {
              return bounds.extend(coord);
            }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));

            this.map.fitBounds(bounds, {
              padding: this.getResponsivePadding(),
              duration: 300
            });
            return;
          }
        }
      }

      // Fallback: restore original view
      this.map.easeTo({
        center: mapState.center,
        zoom: mapState.zoom,
        bearing: mapState.bearing,
        pitch: mapState.pitch,
        duration: 300
      });

    } catch (error) {
      console.warn('Could not maintain map view during resize:', error);
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
      A4: { portrait: { width: 800, height: 600 }, landscape: { width: 600, height: 800 } },
      A3: { portrait: { width: 1000, height: 800 }, landscape: { width: 800, height: 1000 } }
    };

    const size = basicSizes[format]?.[orientation] || basicSizes.A4.portrait;
    
    this.container.style.width = `${size.width}px`;
    this.container.style.height = `${size.height}px`;
    
    if (this.map) {
      this.map.resize();
    }

    return {
      viewport: size,
      print: size,
      scaling: { factor: 1, x: 1, y: 1 },
      aspectRatio: size.width / size.height,
      memoryEstimate: { estimatedMB: 50, isHighMemory: false }
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
      quality: 150,
      dimensions: {
        viewport: { width: 800, height: 600 },
        print: { width: 2480, height: 3508 },
        scaling: { factor: 0.32, x: 0.32, y: 0.17 },
        aspectRatio: 0.71,
        memoryEstimate: { estimatedMB: 50, isHighMemory: false }
      }
    };
  }

  /**
   * Export high-resolution map for printing with advanced DPI manipulation
   * @param {string} format - Export format (A4, A3, etc.)
   * @param {number} targetDPI - Target DPI (default: 300)
   * @param {Object} options - Export options
   */
  async exportHighResolution(format = 'A4', targetDPI = 300, options = {}) {
    if (!this.isInitialized) {
      throw new Error('Map not initialized');
    }

    const dpiManager = this.config.getDPIManager();
    let originalDPIState = null;

    try {
      console.log(`Starting high-resolution export: ${format} format at ${targetDPI} DPI...`);
      
      // Create export configuration with DPI awareness
      const exportConfig = this.config.createExportConfig(format, targetDPI, options);
      console.log('Export configuration:', exportConfig);

      // Check memory requirements and warn if needed
      if (exportConfig.memoryOptimized) {
        console.warn(`Memory optimization enabled due to high requirements: ${exportConfig.metadata.memoryInfo.estimatedMemoryMB}MB`);
      }

      // Set up DPI for high-resolution rendering
      if (dpiManager && exportConfig.highDPISupported) {
        originalDPIState = dpiManager.getCurrentDPIInfo();
        const scalingFactor = dpiManager.setDPI(targetDPI);
        console.log(`DPI set to ${targetDPI} (scaling factor: ${scalingFactor})`);
      } else {
        console.warn('Using fallback DPI method - quality may be limited');
      }

      // Create export container
      const exportContainer = this.createExportContainer(exportConfig);
      
      // Create high-resolution map instance
      const exportMap = await this.createHighDPIMap(exportContainer, exportConfig);
      
      // Copy current map state to export map
      await this.copyMapState(exportMap, exportConfig);
      
      // Wait for map to be fully loaded
      await this.waitForMapLoad(exportMap);
      
      // Export the high-resolution image
      const exportResult = await this.captureHighDPICanvas(exportMap, exportConfig);
      
      // Clean up resources
      this.cleanupExportResources(exportMap, exportContainer);
      
      // Restore original DPI
      if (dpiManager && originalDPIState && originalDPIState.isOverridden !== exportResult.dpiWasOverridden) {
        dpiManager.restoreOriginalDPI();
        console.log('Original DPI restored');
      }

      // Process and download the result
      await this.processExportResult(exportResult, format, targetDPI);
      
      console.log(`High-resolution export completed: ${format} format at ${targetDPI} DPI`);
      return exportResult;

    } catch (error) {
      console.error('High-resolution export failed:', error);
      
      // Ensure cleanup and DPI restoration
      if (dpiManager && originalDPIState && originalDPIState.isOverridden) {
        try {
          dpiManager.restoreOriginalDPI();
        } catch (restoreError) {
          console.error('Failed to restore original DPI:', restoreError);
        }
      }
      
      throw error;
    }
  }

  /**
   * Create container for high-resolution export
   * @param {Object} exportConfig - Export configuration
   * @returns {HTMLElement} Export container element
   */
  createExportContainer(exportConfig) {
    const container = document.createElement('div');
    container.id = `export-container-${Date.now()}`;
    container.style.cssText = `
      position: absolute;
      top: -10000px;
      left: -10000px;
      width: ${exportConfig.width}px;
      height: ${exportConfig.height}px;
      visibility: hidden;
      pointer-events: none;
    `;
    
    document.body.appendChild(container);
    return container;
  }

  /**
   * Create high-DPI optimized map instance
   * @param {HTMLElement} container - Container element
   * @param {Object} exportConfig - Export configuration
   * @returns {mapboxgl.Map} Map instance
   */
  async createHighDPIMap(container, exportConfig) {
    const mapOptions = {
      container: container,
      style: this.map.getStyle(),
      center: this.map.getCenter(),
      zoom: this.map.getZoom(),
      bearing: this.map.getBearing(),
      pitch: this.map.getPitch(),
      preserveDrawingBuffer: exportConfig.preserveDrawingBuffer,
      antialias: exportConfig.antialias,
      interactive: exportConfig.interactive,
      attributionControl: exportConfig.attributionControl,
      maxZoom: exportConfig.maxZoom,
      fadeDuration: 0, // Disable animations for export
      transformRequest: (url, resourceType) => {
        // Optimize tile loading for export
        if (resourceType === 'Tile' && exportConfig.memoryOptimized) {
          return {
            url: url.replace(/@2x/, ''), // Use standard resolution tiles if memory constrained
          };
        }
        return { url };
      }
    };

    return new mapboxgl.Map(mapOptions);
  }

  /**
   * Copy current map state to export map
   * @param {mapboxgl.Map} exportMap - Export map instance
   * @param {Object} exportConfig - Export configuration
   */
  async copyMapState(exportMap, exportConfig) {
    return new Promise((resolve) => {
      exportMap.on('load', () => {
        try {
          // Copy layers and sources from main map
          const style = this.map.getStyle();
          
          if (style.sources && style.layers) {
            // Add route layer if it exists
            if (this.routeLayer && this.map.getSource('route')) {
              const routeSource = this.map.getSource('route');
              exportMap.addSource('route', {
                type: 'geojson',
                data: routeSource._data
              });
              
              exportMap.addLayer({
                id: 'route',
                type: 'line',
                source: 'route',
                layout: {
                  'line-join': 'round',
                  'line-cap': 'round'
                },
                paint: {
                  'line-color': this.options.routeColor,
                  'line-width': Math.round(this.options.routeWidth * exportConfig.scalingFactor)
                }
              });
            }

            // Add markers if they exist
            if (this.waypointMarkers && this.waypointMarkers.length > 0) {
              this.waypointMarkers.forEach((marker, index) => {
                const markerElement = marker.getElement().cloneNode(true);
                new mapboxgl.Marker(markerElement)
                  .setLngLat(marker.getLngLat())
                  .addTo(exportMap);
              });
            }
          }
          
          resolve();
        } catch (error) {
          console.error('Failed to copy map state:', error);
          resolve(); // Continue even if copying fails
        }
      });
    });
  }

  /**
   * Wait for map to be fully loaded and rendered
   * @param {mapboxgl.Map} map - Map instance
   * @returns {Promise} Promise that resolves when map is ready
   */
  waitForMapLoad(map) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Map load timeout'));
      }, 30000); // 30 second timeout

      const checkReady = () => {
        if (map.loaded() && map.isStyleLoaded()) {
          clearTimeout(timeout);
          // Additional delay to ensure tiles are loaded
          setTimeout(resolve, 1000);
        } else {
          setTimeout(checkReady, 100);
        }
      };

      checkReady();
    });
  }

  /**
   * Capture high-DPI canvas with proper scaling
   * @param {mapboxgl.Map} map - Map instance
   * @param {Object} exportConfig - Export configuration
   * @returns {Object} Export result with image data and metadata
   */
  async captureHighDPICanvas(map, exportConfig) {
    try {
      const canvas = map.getCanvas();
      const context = canvas.getContext('2d');
      
      // Get the actual canvas dimensions (may be scaled by device pixel ratio)
      const actualWidth = canvas.width;
      const actualHeight = canvas.height;
      
      console.log(`Capturing canvas: ${actualWidth}x${actualHeight} (target: ${exportConfig.width}x${exportConfig.height})`);

      // Export as high-quality PNG
      const dataURL = canvas.toDataURL('image/png', 1.0);
      
      // Create result object with metadata
      const result = {
        dataURL,
        format: exportConfig.format,
        targetDPI: exportConfig.targetDPI,
        actualDimensions: { width: actualWidth, height: actualHeight },
        logicalDimensions: { width: exportConfig.width, height: exportConfig.height },
        scalingFactor: exportConfig.scalingFactor,
        memoryUsed: exportConfig.metadata.memoryInfo.estimatedMemoryMB,
        timestamp: new Date().toISOString(),
        dpiWasOverridden: exportConfig.highDPISupported,
        qualitySettings: {
          antialias: exportConfig.antialias,
          preserveDrawingBuffer: exportConfig.preserveDrawingBuffer,
          memoryOptimized: exportConfig.memoryOptimized
        }
      };

      return result;
    } catch (error) {
      console.error('Canvas capture failed:', error);
      throw new Error(`Failed to capture high-DPI canvas: ${error.message}`);
    }
  }

  /**
   * Clean up export resources
   * @param {mapboxgl.Map} map - Map instance to remove
   * @param {HTMLElement} container - Container to remove
   */
  cleanupExportResources(map, container) {
    try {
      if (map) {
        map.remove();
      }
    } catch (error) {
      console.warn('Failed to remove export map:', error);
    }

    try {
      if (container && container.parentNode) {
        container.parentNode.removeChild(container);
      }
    } catch (error) {
      console.warn('Failed to remove export container:', error);
    }
  }

  /**
   * Process export result and trigger download
   * @param {Object} exportResult - Export result data
   * @param {string} format - Export format
   * @param {number} targetDPI - Target DPI
   */
  async processExportResult(exportResult, format, targetDPI) {
    const filename = `map_export_${format.toLowerCase()}_${targetDPI}dpi_${Date.now()}.png`;
    
    // Trigger download
    this.downloadImage(exportResult.dataURL, filename);
    
    // Store result for potential reuse
    this.lastExportResult = exportResult;
    
    // Emit export completed event with detailed metadata
    this.emit('export-completed', {
      ...exportResult,
      filename,
      success: true
    });
    
    // Log performance metrics
    console.log('Export performance metrics:', {
      format: exportResult.format,
      dpi: exportResult.targetDPI,
      dimensions: exportResult.actualDimensions,
      memoryUsed: exportResult.memoryUsed,
      scalingFactor: exportResult.scalingFactor,
      processingTime: Date.now() - new Date(exportResult.timestamp).getTime()
    });
  }

  /**
   * Get export capabilities and recommendations
   * @returns {Object} Export capabilities information
   */
  getExportCapabilities() {
    if (!this.config) {
      return { available: false, reason: 'Configuration not loaded' };
    }

    const dpiSupport = this.config.checkHighDPISupport();
    const memoryInfo = this.config.calculateHighDPIMemory('A4', 300);
    
    return {
      available: true,
      highDPISupported: dpiSupport.supported,
      dpiManager: !!this.config.getDPIManager(),
      supportedFormats: ['A4', 'A3', 'A2', 'A1', 'LETTER', 'LEGAL'],
      supportedDPI: [96, 150, 300, 600],
      memoryWarning: memoryInfo.isMemoryIntensive,
      recommendations: {
        maxDPIForDevice: memoryInfo.recommendOptimization ? 150 : 300,
        suggestedFormat: memoryInfo.isMemoryIntensive ? 'A4' : 'A3',
        browserOptimizations: dpiSupport.warnings || []
      }
    };
  }

  /**
   * Trigger download of image data
   */
  downloadImage(dataURL, filename) {
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Update map style
   */
  setStyle(styleName) {
    if (!this.isInitialized) return;
    
    const styleUrl = this.config.getStyleUrl(styleName);
    this.map.setStyle(styleUrl);
  }

  /**
   * Update route customization with enhanced styling options
   */
  updateRouteStyle(customization) {
    if (!this.map.getLayer('route-line')) return;

    if (customization.routeColor) {
      this.map.setPaintProperty('route-line', 'line-color', customization.routeColor);
      this.map.setPaintProperty('route-animated', 'line-color', customization.routeColor);
      this.options.routeColor = customization.routeColor;
    }

    if (customization.routeWidth) {
      this.map.setPaintProperty('route-line', 'line-width', customization.routeWidth);
      this.map.setPaintProperty('route-animated', 'line-width', customization.routeWidth + 1);
      this.options.routeWidth = customization.routeWidth;
    }

    if (customization.routeOpacity !== undefined) {
      this.map.setPaintProperty('route-line', 'line-opacity', customization.routeOpacity);
    }
  }

  /**
   * Update route effects (shadow, glow, dashed patterns)
   */
  updateRouteEffect(effectType, active) {
    const layerId = `route-${effectType}`;
    
    if (active) {
      // Remove existing effect layer if present
      if (this.map.getLayer(layerId)) {
        this.map.removeLayer(layerId);
      }

      switch (effectType) {
        case 'shadow':
          this.map.addLayer({
            id: layerId,
            type: 'line',
            source: 'route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': '#000000',
              'line-width': this.options.routeWidth + 2,
              'line-opacity': 0.3,
              'line-translate': [2, 2]
            }
          }, 'route-line'); // Insert below main route layer
          break;

        case 'glow':
          this.map.addLayer({
            id: layerId,
            type: 'line',
            source: 'route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': this.options.routeColor,
              'line-width': this.options.routeWidth + 6,
              'line-opacity': 0.4,
              'line-blur': 3
            }
          }, 'route-line');
          break;

        case 'dashed':
          this.map.setPaintProperty('route-line', 'line-dasharray', [2, 2]);
          break;
      }
    } else {
      // Remove effect
      if (this.map.getLayer(layerId)) {
        this.map.removeLayer(layerId);
      }
      
      if (effectType === 'dashed') {
        this.map.setPaintProperty('route-line', 'line-dasharray', null);
      }
    }
  }

  /**
   * Update layer visibility
   */
  updateLayerVisibility(layerKey, visible) {
    switch (layerKey) {
      case 'route':
        const routeLayerVisible = visible ? 'visible' : 'none';
        if (this.map.getLayer('route-line')) {
          this.map.setLayoutProperty('route-line', 'visibility', routeLayerVisible);
        }
        if (this.map.getLayer('route-animated')) {
          this.map.setLayoutProperty('route-animated', 'visibility', routeLayerVisible);
        }
        break;

      case 'markers':
        if (this.markers) {
          this.markers.forEach(marker => {
            marker.getElement().style.display = visible ? 'block' : 'none';
          });
        }
        break;

      case 'waypoints':
        if (this.waypointMarkers) {
          this.waypointMarkers.forEach(marker => {
            marker.getElement().style.display = visible ? 'block' : 'none';
          });
        }
        break;

      case 'stats':
        const statsOverlay = document.getElementById('route-stats-overlay');
        if (statsOverlay) {
          statsOverlay.style.display = visible ? 'block' : 'none';
        }
        break;

      case 'annotations':
        if (this.customAnnotations) {
          this.customAnnotations.forEach(annotation => {
            annotation.marker.getElement().style.display = visible ? 'block' : 'none';
          });
        }
        break;
    }
  }

  // === MAP CUSTOMIZATION INTERFACE METHODS ===

  /**
   * Initialize map customization interface with extended functionality
   * This extends the existing functionality to include advanced customization controls
   * @param {Object} options - Customization options
   */
  initMapCustomization(options = {}) {
    this.customizationOptions = {
      enableStyleSelector: options.enableStyleSelector !== false,
      enableColorPicker: options.enableColorPicker !== false,
      enableAnnotations: options.enableAnnotations !== false,
      enableTextLabels: options.enableTextLabels !== false,
      ...options
    };

    // Initialize customization state
    this.customizationState = {
      currentStyle: 'outdoors',
      routeColor: '#fc5200',
      routeWidth: 4,
      routeOpacity: 1,
      annotations: [],
      textLabels: [],
      styleHistory: [],
      undoStack: [],
      redoStack: []
    };

    // Store references to annotation markers
    this.customAnnotations = [];
    this.textLabelMarkers = [];

    // Initialize event handlers for customization
    this.setupCustomizationEventHandlers();

    console.log('Map customization interface initialized');
  }

  /**
   * Render enhanced style selector with thumbnails and real-time preview
   * @param {string} containerId - Container element ID
   */
  renderStyleSelector(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.warn('Style selector container not found:', containerId);
      return;
    }

    const styles = [
      { 
        id: 'outdoors', 
        name: 'Outdoors', 
        url: 'mapbox://styles/mapbox/outdoors-v12',
        description: 'Perfect for hiking and cycling routes',
        thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjRjVGNUY1Ii8+CjxwYXRoIGQ9Im0xMCAzMGMwLTUgNS0xMCAxMC0xMHMxMCA1IDEwIDEwLTUgMTAtMTAgMTAtMTAtNS0xMC0xMHoiIGZpbGw9IiM0Q0FGNTAIP4KPC9zdmc+'
      },
      { 
        id: 'streets', 
        name: 'Streets', 
        url: 'mapbox://styles/mapbox/streets-v12',
        description: 'Urban routes with street details',
        thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjRkZGRkZGIi8+CjxwYXRoIGQ9Im0xMCAyMGgyMG0tMjAgMTBoMjBtLTIwLTIwaDIwIiBzdHJva2U9IiMyMTk2RjMiIHN0cm9rZS13aWR0aD0iMiIvPgo8L3N2Zz4K'
      },
      { 
        id: 'satellite', 
        name: 'Satellite', 
        url: 'mapbox://styles/mapbox/satellite-streets-v12',
        description: 'Aerial view with street overlay',
        thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjMEY0QzMzIi8+CjxjaXJjbGUgY3g9IjIwIiBjeT0iMjAiIHI9IjgiIGZpbGw9IiNGRkZGRkYiIG9wYWNpdHk9IjAuMyIvPgo8L3N2Zz4K'
      },
      { 
        id: 'light', 
        name: 'Light', 
        url: 'mapbox://styles/mapbox/light-v11',
        description: 'Clean minimal design',
        thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjRkFGQUZBIi8+CjxwYXRoIGQ9Im0xNSAxNWgxMHYxMGgtMTB6IiBmaWxsPSIjRTBFMEUwIi8+Cjwvc3ZnPgo='
      },
      { 
        id: 'dark', 
        name: 'Dark', 
        url: 'mapbox://styles/mapbox/dark-v11',
        description: 'High contrast dark theme',
        thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjMjQyNDI0Ii8+CjxwYXRoIGQ9Im0xNSAxNWgxMHYxMGgtMTB6IiBmaWxsPSIjNDA0MDQwIi8+Cjwvc3ZnPgo='
      }
    ];

    const styleGridHTML = `
      <div class="map-style-selector">
        <h3 class="style-selector-title">Map Style</h3>
        <div class="style-grid">
          ${styles.map(style => `
            <div class="style-option ${this.customizationState.currentStyle === style.id ? 'selected' : ''}" 
                 data-style-id="${style.id}"
                 tabindex="0"
                 role="button"
                 aria-label="Select ${style.name} map style">
              <div class="style-thumbnail">
                <img src="${style.thumbnail}" alt="${style.name} preview" loading="lazy">
              </div>
              <div class="style-info">
                <span class="style-name">${style.name}</span>
                <span class="style-description">${style.description}</span>
              </div>
              <div class="style-check">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    container.innerHTML = styleGridHTML;

    // Add event listeners
    container.querySelectorAll('.style-option').forEach(option => {
      const styleId = option.dataset.styleId;
      
      // Click handler
      option.addEventListener('click', () => {
        this.setMapStyle(styleId);
        this.updateStyleSelectorUI(container, styleId);
      });
      
      // Keyboard handler
      option.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.setMapStyle(styleId);
          this.updateStyleSelectorUI(container, styleId);
        }
      });
      
      // Hover preview (optional - can be enabled later)
      option.addEventListener('mouseenter', () => {
        if (this.customizationOptions.hoverPreview) {
          this.previewMapStyle(styleId);
        }
      });
    });
  }

  /**
   * Update style selector UI to reflect current selection
   */
  updateStyleSelectorUI(container, selectedStyleId) {
    container.querySelectorAll('.style-option').forEach(option => {
      if (option.dataset.styleId === selectedStyleId) {
        option.classList.add('selected');
        option.setAttribute('aria-pressed', 'true');
      } else {
        option.classList.remove('selected');
        option.setAttribute('aria-pressed', 'false');
      }
    });
  }

  /**
   * Render color picker UI (placeholder implementation)
   */
  renderColorPicker(containerId) {
    try {
      const container = document.getElementById(containerId);
      if (!container) {
        console.warn('MapboxIntegration: Color picker container not found:', containerId);
        return;
      }

      console.log('MapboxIntegration: Enhanced color picker not yet implemented');
      
      // Placeholder implementation - basic color picker
      container.innerHTML = `
        <div class="enhanced-color-picker">
          <h4>Route Color</h4>
          <p>Enhanced color picker will be implemented here.</p>
        </div>
      `;
      
    } catch (error) {
      console.warn('MapboxIntegration: Failed to render color picker:', error);
    }
  }

  /**
   * Render annotation tools UI (placeholder implementation)
   */
  renderAnnotationTools(containerId) {
    try {
      const container = document.getElementById(containerId);
      if (!container) {
        console.warn('MapboxIntegration: Annotation tools container not found:', containerId);
        return;
      }

      console.log('MapboxIntegration: Annotation tools not yet implemented');
      
      // Placeholder implementation
      container.innerHTML = `
        <div class="annotation-tools">
          <h4>Map Annotations</h4>
          <p>Annotation tools will be implemented here.</p>
        </div>
      `;
      
    } catch (error) {
      console.warn('MapboxIntegration: Failed to render annotation tools:', error);
    }
  }

  /**
   * Set map style with enhanced feedback and state management
   */
  setMapStyle(styleId) {
    try {
      if (!this.isInitialized) {
        console.warn('MapboxIntegration: Map not initialized yet');
        return false;
      }

      if (!this.map) {
        console.error('MapboxIntegration: Map instance not available');
        return false;
      }

      if (!this.config) {
        console.error('MapboxIntegration: MapboxConfig not available');
        return false;
      }

      if (!styleId) {
        console.error('MapboxIntegration: Style ID is required');
        return false;
      }

      const previousStyle = this.customizationState?.currentStyle || 'outdoors';
      
      // Validate style exists
      const styleUrl = this.config.getStyleUrl(styleId);
      if (!styleUrl) {
        console.error(`MapboxIntegration: Invalid style ID: ${styleId}`);
        return false;
      }

      // Update customization state
      if (this.customizationState) {
        this.customizationState.currentStyle = styleId;
      }

      console.log(`MapboxIntegration: Changing map style from '${previousStyle}' to '${styleId}'`);

      // Save to undo stack
      this.saveToUndoStack('style-change', { from: previousStyle, to: styleId });

      // Apply style change
      this.map.setStyle(styleUrl);

      // Re-initialize layers after style load
      this.map.once('style.load', () => {
        try {
          this.reinitializeCustomizationLayers();
          
          // Emit style changed event if event system is available
          if (this.emit) {
            this.emit('style-changed', { styleId, styleUrl });
          }
          
          console.log(`MapboxIntegration: Style successfully changed to '${styleId}'`);
        } catch (error) {
          console.error('MapboxIntegration: Error in style.load handler:', error);
        }
      });

      // Handle potential style load errors
      this.map.once('error', (e) => {
        console.error('MapboxIntegration: Map style load error:', e);
        
        // Revert to previous style on error
        if (previousStyle && previousStyle !== styleId) {
          setTimeout(() => {
            console.log('MapboxIntegration: Reverting to previous style due to error');
            this.setMapStyle(previousStyle);
          }, 1000);
        }
      });

      // Update localStorage
      this.saveCustomizationState();
      
      return true;
      
    } catch (error) {
      console.error('MapboxIntegration: Failed to set map style:', error);
      return false;
    }
  }

  /**
   * Save current customization state to localStorage
   */
  saveCustomizationState() {
    try {
      const stateToSave = {
        currentStyle: this.customizationState.currentStyle,
        routeColor: this.customizationState.routeColor,
        routeWidth: this.customizationState.routeWidth,
        routeOpacity: this.customizationState.routeOpacity,
        annotations: this.customizationState.annotations,
        textLabels: this.customizationState.textLabels
      };
      
      localStorage.setItem('mapbox-customization-state', JSON.stringify(stateToSave));
      console.log('MapboxIntegration: Customization state saved');
      
    } catch (error) {
      console.warn('MapboxIntegration: Failed to save customization state:', error);
    }
  }

  /**
   * Load customization state from localStorage
   */
  loadCustomizationState() {
    try {
      const saved = localStorage.getItem('mapbox-customization-state');
      if (saved) {
        const state = JSON.parse(saved);
        
        // Merge with current state
        this.customizationState = {
          ...this.customizationState,
          ...state
        };
        
        console.log('MapboxIntegration: Customization state loaded');
        return true;
      }
    } catch (error) {
      console.warn('MapboxIntegration: Failed to load customization state:', error);
    }
    return false;
  }

  /**
   * Save action to undo stack for undo/redo functionality
   */
  saveToUndoStack(actionType, actionData) {
    try {
      const undoAction = {
        type: actionType,
        data: actionData,
        timestamp: Date.now()
      };
      
      this.customizationState.undoStack.push(undoAction);
      
      // Limit undo stack size
      if (this.customizationState.undoStack.length > 50) {
        this.customizationState.undoStack.shift();
      }
      
      // Clear redo stack when new action is performed
      this.customizationState.redoStack = [];
      
      console.log('MapboxIntegration: Action saved to undo stack:', actionType);
      
    } catch (error) {
      console.warn('MapboxIntegration: Failed to save to undo stack:', error);
    }
  }

  /**
   * Re-initialize customization layers after style changes
   */
  reinitializeCustomizationLayers() {
    try {
      console.log('MapboxIntegration: Reinitializing customization layers...');
      
      // Wait for style to fully load
      if (!this.map.isStyleLoaded()) {
        setTimeout(() => this.reinitializeCustomizationLayers(), 100);
        return;
      }
      
      // Re-add route layers if route data exists
      if (this.routeData && this.routeData.coordinates) {
        this.addRouteLayerWithZOrder({
          id: 'route-line',
          type: 'line',
          source: {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: this.routeData.coordinates.map(coord => [coord[1], coord[0]])
              }
            }
          },
          paint: {
            'line-color': this.customizationState.routeColor,
            'line-width': this.customizationState.routeWidth,
            'line-opacity': this.customizationState.routeOpacity
          }
        }, 100);
      }
      
      // Re-add annotations
      this.customizationState.annotations.forEach(annotation => {
        this.addAnnotationMarker(annotation);
      });
      
      // Re-add text labels
      this.customizationState.textLabels.forEach(label => {
        this.addTextLabel(label);
      });
      
      console.log('MapboxIntegration: Customization layers reinitialized');
      
    } catch (error) {
      console.warn('MapboxIntegration: Failed to reinitialize customization layers:', error);
    }
  }

  /**
   * Add annotation marker to map (placeholder function)
   */
  addAnnotationMarker(annotation) {
    try {
      if (!annotation || !annotation.coordinates) {
        console.warn('MapboxIntegration: Invalid annotation data');
        return;
      }
      
      // Placeholder implementation - can be enhanced later
      console.log('MapboxIntegration: Adding annotation marker:', annotation);
      
    } catch (error) {
      console.warn('MapboxIntegration: Failed to add annotation marker:', error);
    }
  }

  /**
   * Add text label to map (placeholder function)
   */
  addTextLabel(label) {
    try {
      if (!label || !label.coordinates) {
        console.warn('MapboxIntegration: Invalid text label data');
        return;
      }
      
      // Placeholder implementation - can be enhanced later
      console.log('MapboxIntegration: Adding text label:', label);
      
    } catch (error) {
      console.warn('MapboxIntegration: Failed to add text label:', error);
    }
  }

  /**
   * Load style settings from localStorage
   */
  loadStyleSettings() {
    try {
      const saved = localStorage.getItem('mapbox-style-settings');
      if (saved) {
        const settings = JSON.parse(saved);
        return {
          preset: 'default',
          mapStyle: 'outdoors',
          opacity: { background: 1, water: 1, terrain: 0.8, roads: 0.9, labels: 1 },
          routeColor: this.options.routeColor,
          routeWidth: this.options.routeWidth,
          routeEffects: { shadow: false, glow: false, dashed: false },
          visibility: { route: true, markers: true, waypoints: true, stats: true },
          ...settings
        };
      }
    } catch (error) {
      console.warn('MapboxIntegration: Failed to load style settings:', error);
    }
    
    // Return default settings
    return {
      preset: 'default',
      mapStyle: 'outdoors',
      opacity: { background: 1, water: 1, terrain: 0.8, roads: 0.9, labels: 1 },
      routeColor: this.options.routeColor,
      routeWidth: this.options.routeWidth,
      routeEffects: { shadow: false, glow: false, dashed: false },
      visibility: { route: true, markers: true, waypoints: true, stats: true }
    };
  }

  /**
   * Save style settings to localStorage
   */
  saveStyleSettings(key, value) {
    try {
      const currentSettings = this.loadStyleSettings();
      
      // Handle nested keys like 'opacity.background'
      if (key.includes('.')) {
        const parts = key.split('.');
        let target = currentSettings;
        
        for (let i = 0; i < parts.length - 1; i++) {
          if (!target[parts[i]]) {
            target[parts[i]] = {};
          }
          target = target[parts[i]];
        }
        
        target[parts[parts.length - 1]] = value;
      } else {
        currentSettings[key] = value;
      }
      
      localStorage.setItem('mapbox-style-settings', JSON.stringify(currentSettings));
      console.log('MapboxIntegration: Style settings saved:', key, value);
      
    } catch (error) {
      console.warn('MapboxIntegration: Failed to save style settings:', error);
    }
  }

  /**
   * Apply saved style settings on initialization
   */
  applySavedStyleSettings() {
    const settings = this.loadStyleSettings();
    
    // Apply saved map style
    if (settings.mapStyle && settings.mapStyle !== 'outdoors') {
      const styleUrl = this.config.getStyleUrl(settings.mapStyle);
      if (styleUrl) {
        this.map.setStyle(styleUrl);
      }
    }
    
    // Apply saved route styling
    if (settings.routeColor || settings.routeWidth) {
      this.updateRouteStyle({
        routeColor: settings.routeColor,
        routeWidth: settings.routeWidth
      });
    }
    
    // Apply saved route effects
    if (settings.routeEffects) {
      Object.entries(settings.routeEffects).forEach(([effect, active]) => {
        if (active) {
          this.updateRouteEffect(effect, active);
        }
      });
    }
    
    // Apply saved layer visibility
    if (settings.visibility) {
      Object.entries(settings.visibility).forEach(([layer, visible]) => {
        this.updateLayerVisibility(layer, visible);
      });
    }
  }

  /**
   * Get current map state for saving
   */
  getMapState() {
    if (!this.isInitialized) return null;

    return {
      center: this.map.getCenter(),
      zoom: this.map.getZoom(),
      bearing: this.map.getBearing(),
      pitch: this.map.getPitch(),
      style: this.map.getStyle()
    };
  }

  /**
   * Calculate distance between coordinates using Haversine formula
   */
  calculateDistance(coordinates) {
    if (!coordinates || coordinates.length < 2) return 0;
    
    let totalDistance = 0;
    for (let i = 1; i < coordinates.length; i++) {
      const [lat1, lng1] = coordinates[i - 1];
      const [lat2, lng2] = coordinates[i];
      
      // Validate coordinates before calculation
      if (isNaN(lat1) || isNaN(lng1) || isNaN(lat2) || isNaN(lng2)) {
        continue; // Skip invalid coordinate pairs
      }
      
      const R = 6371000; // Earth's radius in meters
      const φ1 = lat1 * Math.PI / 180;
      const φ2 = lat2 * Math.PI / 180;
      const Δφ = (lat2 - lat1) * Math.PI / 180;
      const Δλ = (lng2 - lng1) * Math.PI / 180;

      const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      
      const segmentDistance = R * c;
      if (!isNaN(segmentDistance) && segmentDistance > 0) {
        totalDistance += segmentDistance;
      }
    }
    return totalDistance;
  }

  /**
   * Add waypoint markers along the route
   */
  addWaypointMarkers(coordinates) {
    if (!coordinates || coordinates.length < 2) return;

    const distance = this.calculateDistance(coordinates);
    const interval = this.options.waypointInterval; // meters
    const waypoints = [];
    
    if (distance <= interval * 2) return; // Skip if route is too short

    let currentDistance = 0;
    let nextWaypointDistance = interval;
    
    for (let i = 1; i < coordinates.length; i++) {
      const segmentDistance = this.calculateDistance([coordinates[i - 1], coordinates[i]]);
      currentDistance += segmentDistance;
      
      if (currentDistance >= nextWaypointDistance) {
        waypoints.push({
          coordinate: coordinates[i],
          distance: Math.round(currentDistance)
        });
        nextWaypointDistance += interval;
      }
    }

    // Create waypoint markers
    waypoints.forEach((waypoint, index) => {
      const marker = new mapboxgl.Marker({
        color: '#3B82F6',
        scale: 0.8
      })
      .setLngLat([waypoint.coordinate[1], waypoint.coordinate[0]])
      .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <div style="padding: 8px; font-size: 12px;">
          <strong>Waypoint ${index + 1}</strong><br>
          Distance: ${(waypoint.distance / 1000).toFixed(1)} km
        </div>
      `))
      .addTo(this.map);

      this.waypointMarkers.push(marker);
    });

    this.routeStats.waypoints = waypoints;
  }

  /**
   * Add route statistics overlay
   */
  addRouteStatsOverlay() {
    const stats = this.routeStats;
    
    const overlay = document.createElement('div');
    overlay.id = 'route-stats-overlay';
    overlay.style.cssText = `
      position: absolute;
      top: 10px;
      left: 10px;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(8px);
      padding: 12px;
      border-radius: 8px;
      font-family: Arial, sans-serif;
      font-size: 13px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      z-index: 1000;
      max-width: 200px;
    `;
    
    const formatDistance = (meters) => {
      if (meters >= 1000) {
        return `${(meters / 1000).toFixed(1)} km`;
      }
      return `${Math.round(meters)} m`;
    };
    
    const formatDuration = (seconds) => {
      if (!seconds) return 'Unknown';
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      
      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      }
      return `${minutes}m ${secs}s`;
    };

    overlay.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 8px; color: #1F2937;">Route Statistics</div>
      <div style="margin-bottom: 4px;">
        <span style="color: #6B7280;">Distance:</span> 
        <strong>${formatDistance(stats.distance)}</strong>
      </div>
      ${stats.duration ? `
        <div style="margin-bottom: 4px;">
          <span style="color: #6B7280;">Duration:</span> 
          <strong>${formatDuration(stats.duration)}</strong>
        </div>
      ` : ''}
      ${stats.elevationGain ? `
        <div style="margin-bottom: 4px;">
          <span style="color: #6B7280;">Elevation:</span> 
          <strong>+${Math.round(stats.elevationGain)}m</strong>
        </div>
      ` : ''}
      <div>
        <span style="color: #6B7280;">Waypoints:</span> 
        <strong>${stats.waypoints.length}</strong>
      </div>
    `;

    this.map.getContainer().appendChild(overlay);
  }

  /**
   * Remove route statistics overlay
   */
  removeRouteStatsOverlay() {
    const overlay = document.getElementById('route-stats-overlay');
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  }

  /**
   * Add route animation controls
   */
  addRouteAnimationControls() {
    const self = this;

    class RouteAnimationControl {
      onAdd(map) {
        this.map = map;
        this.container = document.createElement('div');
        this.container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group route-animation-control';
        this.container.style.cssText = `
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(8px);
          padding: 8px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: Arial, sans-serif;
          font-size: 12px;
        `;

        // Play/Pause button
        this.playButton = document.createElement('button');
        this.playButton.innerHTML = '▶️';
        this.playButton.title = 'Play Route Animation';
        this.playButton.style.cssText = `
          background: none;
          border: none;
          font-size: 16px;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
        `;
        this.playButton.addEventListener('click', () => {
          if (self.routeAnimation.isPlaying) {
            self.pauseRouteAnimation();
          } else {
            self.startRouteAnimation();
          }
        });

        // Reset button
        this.resetButton = document.createElement('button');
        this.resetButton.innerHTML = '⏹️';
        this.resetButton.title = 'Reset Animation';
        this.resetButton.style.cssText = this.playButton.style.cssText;
        this.resetButton.addEventListener('click', () => {
          self.resetRouteAnimation();
        });

        // Speed control
        this.speedSelect = document.createElement('select');
        this.speedSelect.style.cssText = `
          background: white;
          border: 1px solid #ccc;
          border-radius: 4px;
          padding: 2px 4px;
          font-size: 11px;
        `;
        
        const speeds = [
          { value: 0.5, label: '0.5x' },
          { value: 1.0, label: '1x' },
          { value: 1.5, label: '1.5x' },
          { value: 2.0, label: '2x' },
          { value: 3.0, label: '3x' }
        ];

        speeds.forEach(speed => {
          const option = document.createElement('option');
          option.value = speed.value;
          option.textContent = speed.label;
          if (speed.value === self.options.animationSpeed) {
            option.selected = true;
          }
          this.speedSelect.appendChild(option);
        });

        this.speedSelect.addEventListener('change', (e) => {
          self.options.animationSpeed = parseFloat(e.target.value);
          self.routeAnimation.duration = self.options.animationDuration / self.options.animationSpeed;
        });

        // Progress bar
        this.progressContainer = document.createElement('div');
        this.progressContainer.style.cssText = `
          width: 100px;
          height: 4px;
          background: #E5E7EB;
          border-radius: 2px;
          overflow: hidden;
          position: relative;
        `;

        this.progressBar = document.createElement('div');
        this.progressBar.style.cssText = `
          width: 0%;
          height: 100%;
          background: ${self.options.routeColor};
          transition: width 0.1s ease;
        `;

        this.progressContainer.appendChild(this.progressBar);

        // Assembly
        this.container.appendChild(this.playButton);
        this.container.appendChild(this.resetButton);
        this.container.appendChild(this.speedSelect);
        this.container.appendChild(this.progressContainer);

        return this.container;
      }

      onRemove() {
        this.container.parentNode.removeChild(this.container);
        this.map = undefined;
      }

      updatePlayButton(isPlaying) {
        this.playButton.innerHTML = isPlaying ? '⏸️' : '▶️';
        this.playButton.title = isPlaying ? 'Pause Animation' : 'Play Route Animation';
      }

      updateProgress(progress) {
        this.progressBar.style.width = `${progress * 100}%`;
      }
    }

    this.routeControls = new RouteAnimationControl();
    this.map.addControl(this.routeControls, 'bottom-right');
  }

  /**
   * Start route animation
   */
  startRouteAnimation() {
    if (!this.routeAnimation.coordinates || this.routeAnimation.coordinates.length === 0) {
      console.warn('No route coordinates available for animation');
      return;
    }

    this.routeAnimation.isPlaying = true;
    this.routeAnimation.isPaused = false;
    this.routeAnimation.duration = this.options.animationDuration / this.options.animationSpeed;

    if (this.routeAnimation.progress === 0) {
      this.routeAnimation.startTime = performance.now();
    } else {
      // Resume from pause
      this.routeAnimation.startTime = performance.now() - (this.routeAnimation.progress * this.routeAnimation.duration);
    }

    // Update control buttons
    if (this.routeControls) {
      this.routeControls.updatePlayButton(true);
    }

    // Start animation loop
    this.animateRoute();

    // Emit event
    this.emit('route-animation-started', {
      duration: this.routeAnimation.duration,
      speed: this.options.animationSpeed
    });
  }

  /**
   * Pause route animation
   */
  pauseRouteAnimation() {
    this.routeAnimation.isPlaying = false;
    this.routeAnimation.isPaused = true;

    if (this.routeAnimation.animationId) {
      cancelAnimationFrame(this.routeAnimation.animationId);
      this.routeAnimation.animationId = null;
    }

    // Update control buttons
    if (this.routeControls) {
      this.routeControls.updatePlayButton(false);
    }

    // Emit event
    this.emit('route-animation-paused', {
      progress: this.routeAnimation.progress
    });
  }

  /**
   * Stop route animation
   */
  stopRouteAnimation() {
    this.routeAnimation.isPlaying = false;
    this.routeAnimation.isPaused = false;

    if (this.routeAnimation.animationId) {
      cancelAnimationFrame(this.routeAnimation.animationId);
      this.routeAnimation.animationId = null;
    }

    // Update control buttons
    if (this.routeControls) {
      this.routeControls.updatePlayButton(false);
    }
  }

  /**
   * Reset route animation
   */
  resetRouteAnimation() {
    this.stopRouteAnimation();
    
    this.routeAnimation.progress = 0;
    this.routeAnimation.currentSegment = 0;
    this.routeAnimation.startTime = null;

    // Clear animated route
    if (this.map.getSource('route-animated')) {
      this.map.getSource('route-animated').setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: []
        }
      });
    }

    // Update progress bar
    if (this.routeControls) {
      this.routeControls.updateProgress(0);
    }

    // Emit event
    this.emit('route-animation-reset');
  }

  /**
   * Animation loop for route progression
   */
  animateRoute() {
    if (!this.routeAnimation.isPlaying) return;

    const now = performance.now();
    const elapsed = now - this.routeAnimation.startTime;
    this.routeAnimation.progress = Math.min(elapsed / this.routeAnimation.duration, 1);

    // Calculate current position in route
    const totalCoords = this.routeAnimation.coordinates.length;
    const currentIndex = Math.floor(this.routeAnimation.progress * (totalCoords - 1));
    
    // Get coordinates up to current progress
    const animatedCoords = this.routeAnimation.coordinates.slice(0, currentIndex + 1);
    
    // Update animated route layer
    if (this.map.getSource('route-animated') && animatedCoords.length > 1) {
      this.map.getSource('route-animated').setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: animatedCoords
        }
      });
    }

    // Update progress bar
    if (this.routeControls) {
      this.routeControls.updateProgress(this.routeAnimation.progress);
    }

    // Check if animation complete
    if (this.routeAnimation.progress >= 1) {
      this.routeAnimation.isPlaying = false;
      
      // Update control buttons
      if (this.routeControls) {
        this.routeControls.updatePlayButton(false);
      }

      // Emit completion event
      this.emit('route-animation-completed');
      
      return;
    }

    // Continue animation with optimized frame rate
    this.requestOptimizedAnimationFrame(() => this.animateRoute());
  }

  /**
   * Show loading indicator
   */
  showLoadingIndicator(message = 'Loading...') {
    const container = this.map.getContainer();
    let loader = document.getElementById('mapbox-loader');
    
    if (!loader) {
      loader = document.createElement('div');
      loader.id = 'mapbox-loader';
      loader.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(255, 255, 255, 0.95);
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        font-family: Arial, sans-serif;
        font-size: 14px;
        z-index: 1001;
        display: flex;
        align-items: center;
        gap: 12px;
      `;
      
      loader.innerHTML = `
        <div style="
          width: 20px;
          height: 20px;
          border: 2px solid #E5E7EB;
          border-top: 2px solid #3B82F6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        "></div>
        <span>${message}</span>
        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      `;
      
      container.appendChild(loader);
    } else {
      loader.querySelector('span').textContent = message;
    }
  }

  /**
   * Hide loading indicator
   */
  hideLoadingIndicator() {
    const loader = document.getElementById('mapbox-loader');
    if (loader && loader.parentNode) {
      loader.parentNode.removeChild(loader);
    }
  }

  /**
   * Cleanup and destroy map instance
   */
  cleanup() {
    // Clean up route animations
    this.stopRouteAnimation();
    
    // Clean up responsive handling
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    
    if (this.resizeDebounceTimer) {
      clearTimeout(this.resizeDebounceTimer);
      this.resizeDebounceTimer = null;
    }
    
    if (this.orientationChangeHandler) {
      window.removeEventListener('orientationchange', this.orientationChangeHandler);
      this.orientationChangeHandler = null;
    }
    
    // Remove window resize listener
    window.removeEventListener('resize', this.handleWindowResize.bind(this));

    // Cleanup performance optimizations
    if (this.performanceOptimization) {
      // Cancel any ongoing animation frames
      if (this.performanceOptimization.animationFrameId) {
        cancelAnimationFrame(this.performanceOptimization.animationFrameId);
        this.performanceOptimization.animationFrameId = null;
      }
      
      // Disconnect visibility observer
      if (this.performanceOptimization.visibilityObserver) {
        this.performanceOptimization.visibilityObserver.disconnect();
        this.performanceOptimization.visibilityObserver = null;
      }
      
      this.performanceOptimization = null;
    }

    // Cleanup memory management
    if (this.memoryManagement) {
      // Stop automatic cleanup
      this.stopAutoCleanup();
      
      // Clear object pools
      Object.values(this.memoryManagement.pools).forEach(pool => {
        if (pool && typeof pool.clear === 'function') {
          pool.clear();
        }
      });
      
      // Clean up leak detection timers
      this.memoryManagement.leakDetection.timeouts.forEach(id => {
        clearTimeout(id);
      });
      this.memoryManagement.leakDetection.intervals.forEach(id => {
        clearInterval(id);
      });
      
      this.memoryManagement = null;
    }

    // Cleanup canvas size manager
    if (this.canvasSizeManager) {
      this.canvasSizeManager.cleanup();
      this.canvasSizeManager = null;
    }

    // Cleanup event system
    if (this.eventSystem) {
      this.eventSystem.cleanup();
      this.eventSystem = null;
    }

    if (this.map) {
      this.clearRoute();
      this.map.remove();
      this.map = null;
    }
    
    // Remove any remaining UI elements
    this.hideLoadingIndicator();
    
    this.isInitialized = false;
    this.currentBreakpoint = null;
  }

  /**
   * Get debug information
   */
  getDebugInfo() {
    return {
      initialized: this.isInitialized,
      containerId: this.containerId,
      hasContainer: !!this.container,
      hasMap: !!this.map,
      hasEventSystem: !!this.eventSystem,
      eventSystemStatus: this.eventSystem ? this.eventSystem.getStatus() : null,
      eventSystemMetrics: this.eventSystem ? this.eventSystem.getPerformanceMetrics() : null,
      options: this.options,
      configDebug: this.config ? this.config.getDebugInfo() : null
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
   * Initialize custom track controls (stub implementation to prevent errors)
   * TODO: Implement custom track controls functionality if needed
   */
  initializeCustomTrackControls() {
    console.log('MapboxIntegration: initializeCustomTrackControls called (stub implementation)');
    // This is a stub implementation to prevent "not a function" errors
    // Add actual implementation here if needed
    return this;
  }

  /**
   * Initialize route functionality (stub implementation to prevent errors)
   * TODO: Implement route initialization functionality if needed
   */
  initializeRoute() {
    console.log('MapboxIntegration: initializeRoute called (stub implementation)');
    // This is a stub implementation to prevent "not a function" errors
    // Add actual implementation here if needed
    return this;
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