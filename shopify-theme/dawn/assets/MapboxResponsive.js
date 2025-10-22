/**
 * MapboxResponsive.js - Responsive Map Behavior and Breakpoint Management
 * 
 * Handles:
 * - Responsive container sizing and aspect ratios
 * - Breakpoint detection and management
 * - Mobile optimization and touch device handling
 * - Container resize observers and window resize handling
 * - Orientation change management
 * - Performance optimizations based on device type
 * 
 * Dependencies:
 * - MapboxCore (for map instance access)
 */

class MapboxResponsive {
  constructor(core, options = {}) {
    this.core = core;
    this.map = null; // Will be set when core is initialized
    this.container = null; // Will be set when core is initialized
    
    // Responsive state management
    this.resizeObserver = null;
    this.resizeDebounceTimer = null;
    this.lastKnownDimensions = { width: 0, height: 0 };
    this.currentBreakpoint = null;
    this.orientationChangeHandler = null;

    // Default responsive options
    this.options = {
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
      adaptivePerformance: true,
      ...options
    };

    // Bind methods
    this.handleContainerResize = this.handleContainerResize.bind(this);
    this.handleWindowResize = this.handleWindowResize.bind(this);
    this.handleOrientationChange = this.handleOrientationChange.bind(this);
    this.cleanup = this.cleanup.bind(this);
  }

  /**
   * Initialize responsive handling
   * @param {mapboxgl.Map} map - Map instance
   * @param {HTMLElement} container - Map container element
   */
  init(map, container) {
    if (!this.options.enabled) {
      console.log('MapboxResponsive: Responsive handling disabled');
      return this;
    }

    this.map = map;
    this.container = container;

    console.log('MapboxResponsive: Initializing responsive handling...');

    // Setup responsive container
    this.applyResponsiveContainer();

    // Setup resize observers and listeners
    this.setupResizeHandling();

    // Setup orientation change handling for mobile
    this.setupOrientationHandling();

    // Initial breakpoint detection
    this.currentBreakpoint = this.getCurrentBreakpoint();
    this.applyBreakpointOptimizations(this.currentBreakpoint);

    console.log('MapboxResponsive: Initialization complete');
    return this;
  }

  /**
   * Setup resize handling with ResizeObserver and fallbacks
   */
  setupResizeHandling() {
    // Setup ResizeObserver for container changes (preferred)
    if ('ResizeObserver' in window && this.container) {
      this.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          this.handleContainerResize(entry.contentRect);
        }
      });
      this.resizeObserver.observe(this.container);
      console.log('MapboxResponsive: ResizeObserver initialized');
    } else {
      console.log('MapboxResponsive: ResizeObserver not available, using window resize fallback');
    }

    // Setup window resize handler as fallback
    window.addEventListener('resize', this.handleWindowResize);
  }

  /**
   * Setup orientation change handling for mobile devices
   */
  setupOrientationHandling() {
    if (this.isTouchDevice()) {
      this.orientationChangeHandler = () => {
        // Delay to allow orientation change to complete
        setTimeout(() => {
          this.handleOrientationChange();
        }, 100);
      };
      window.addEventListener('orientationchange', this.orientationChangeHandler);
      console.log('MapboxResponsive: Orientation change handler initialized');
    }
  }

  /**
   * Apply responsive container styling and dimensions
   */
  applyResponsiveContainer() {
    if (!this.container) return;

    const dimensions = this.getOptimalDimensions();
    
    // Apply dimensions to container
    Object.assign(this.container.style, {
      width: '100%',
      height: `${dimensions.height}px`,
      minHeight: `${this.options.minHeight}px`,
      maxHeight: this.options.maxHeight ? `${this.options.maxHeight}px` : 'none'
    });

    // Apply aspect ratio if specified
    if (this.options.aspectRatio && this.options.aspectRatio !== 'auto') {
      this.applyAspectRatio(this.options.aspectRatio);
    }

    // Update responsive CSS classes
    this.updateResponsiveClasses();

    console.log('MapboxResponsive: Container styling applied', dimensions);
  }

  /**
   * Apply aspect ratio to container
   * @param {string} ratio - Aspect ratio (e.g., '16:9', '4:3', '1:1')
   */
  applyAspectRatio(ratio) {
    if (!this.container) return;

    const ratioMap = {
      '16:9': 56.25,
      '4:3': 75,
      '3:2': 66.67,
      '1:1': 100
    };

    const paddingTop = ratioMap[ratio];
    if (paddingTop) {
      this.container.style.paddingTop = `${paddingTop}%`;
      this.container.style.height = '0';
      
      // Create inner container for map
      if (!this.container.querySelector('.mapbox-responsive-inner')) {
        const inner = document.createElement('div');
        inner.className = 'mapbox-responsive-inner';
        inner.style.position = 'absolute';
        inner.style.top = '0';
        inner.style.left = '0';
        inner.style.width = '100%';
        inner.style.height = '100%';
        
        // Move existing content to inner container
        while (this.container.firstChild) {
          inner.appendChild(this.container.firstChild);
        }
        this.container.appendChild(inner);
      }
    }
  }

  /**
   * Get optimal dimensions based on viewport and options
   * @returns {Object} Optimal width and height
   */
  getOptimalDimensions() {
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };

    const containerWidth = this.container ? this.container.offsetWidth : viewport.width;
    
    let height = Math.min(
      viewport.height * 0.6, // 60% of viewport height
      this.options.maxHeight || 800
    );
    
    height = Math.max(height, this.options.minHeight);

    // Adjust for mobile devices
    if (this.isMobile()) {
      height = Math.min(height, viewport.height * 0.5); // 50% on mobile
    }

    return {
      width: containerWidth,
      height: Math.round(height)
    };
  }

  /**
   * Update CSS classes based on current breakpoint
   */
  updateResponsiveClasses() {
    if (!this.container) return;

    const breakpoint = this.getCurrentBreakpoint();
    
    // Remove existing breakpoint classes
    this.container.classList.remove('mapbox-mobile', 'mapbox-tablet', 'mapbox-desktop');
    
    // Add current breakpoint class
    this.container.classList.add(`mapbox-${breakpoint}`);
    
    // Add device type classes
    if (this.isTouchDevice()) {
      this.container.classList.add('mapbox-touch');
    } else {
      this.container.classList.add('mapbox-no-touch');
    }

    console.log(`MapboxResponsive: CSS classes updated for ${breakpoint}`);
  }

  /**
   * Handle container resize with debouncing
   * @param {DOMRect} rect - Container dimensions
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
        this.lastKnownDimensions = newDimensions;
      }
    }, this.options.resizeDebounce);
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
    }, this.options.resizeDebounce);
  }

  /**
   * Handle orientation change on mobile devices
   */
  handleOrientationChange() {
    console.log('MapboxResponsive: Handling orientation change');
    
    // Force container recalculation after orientation change
    this.applyResponsiveContainer();
    
    if (this.map) {
      // Trigger map resize after orientation change
      this.map.resize();
      
      // Re-fit bounds if maintain center is enabled
      if (this.options.maintainCenter) {
        this.maintainMapView();
      }
    }
  }

  /**
   * Perform responsive update with map adjustments
   * @param {Object} newDimensions - New container dimensions
   */
  performResponsiveUpdate(newDimensions) {
    // Store current map state for restoration
    const mapState = this.core.getMapState();
    
    // Apply new container dimensions
    this.applyResponsiveContainer();
    
    if (this.map) {
      // Trigger map resize
      this.map.resize();
      
      // Check if breakpoint changed
      const newBreakpoint = this.getCurrentBreakpoint();
      if (newBreakpoint !== this.currentBreakpoint) {
        this.handleBreakpointChange(newBreakpoint);
      }
      
      // Restore or adjust map view
      if (this.options.maintainCenter && mapState) {
        this.restoreMapView(mapState);
      }
    }
    
    console.log('MapboxResponsive: Responsive update completed', newDimensions);
  }

  /**
   * Handle breakpoint changes
   * @param {string} newBreakpoint - New breakpoint name
   */
  handleBreakpointChange(newBreakpoint) {
    console.log(`MapboxResponsive: Breakpoint changed from ${this.currentBreakpoint} to ${newBreakpoint}`);
    
    this.currentBreakpoint = newBreakpoint;
    
    // Update CSS classes
    this.updateResponsiveClasses();
    
    // Apply breakpoint-specific optimizations
    this.applyBreakpointOptimizations(newBreakpoint);
    
    // Emit breakpoint change event
    if (this.core.eventSystem) {
      this.core.eventSystem.emit('breakpoint-changed', {
        oldBreakpoint: this.currentBreakpoint,
        newBreakpoint: newBreakpoint,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Apply optimizations specific to breakpoint
   * @param {string} breakpoint - Current breakpoint
   */
  applyBreakpointOptimizations(breakpoint) {
    if (!this.map || !this.options.adaptivePerformance) return;
    
    switch (breakpoint) {
      case 'mobile':
        // Optimize for mobile performance
        this.map.setMaxZoom(18); // Limit max zoom on mobile
        this.applyMobileOptimizations();
        break;
        
      case 'tablet':
        // Tablet optimizations
        this.map.setMaxZoom(20);
        break;
        
      case 'desktop':
        // Full desktop features
        this.map.setMaxZoom(22);
        break;
    }
    
    console.log(`MapboxResponsive: Applied optimizations for ${breakpoint}`);
  }

  /**
   * Apply mobile-specific optimizations
   */
  applyMobileOptimizations() {
    if (!this.map) return;

    // Disable pitch on mobile for better performance
    this.map.dragRotate.disable();
    this.map.touchZoomRotate.disableRotation();
    
    // Adjust animation duration for mobile
    this.map.setLayoutProperty('mapbox-gl-draw-polygon-fill-inactive', 'visibility', 'none');
  }

  /**
   * Get current breakpoint based on viewport width
   * @returns {string} Current breakpoint name
   */
  getCurrentBreakpoint() {
    const width = window.innerWidth;
    
    for (const [name, config] of Object.entries(this.options.breakpoints)) {
      if (config.min && config.max) {
        if (width >= config.min && width <= config.max) {
          return name;
        }
      } else if (config.min && width >= config.min) {
        return name;
      } else if (config.max && width <= config.max) {
        return name;
      }
    }
    
    return 'desktop'; // Default fallback
  }

  /**
   * Device detection methods
   */
  isDesktop() {
    return this.getCurrentBreakpoint() === 'desktop';
  }

  isMobile() {
    return this.getCurrentBreakpoint() === 'mobile';
  }

  isTablet() {
    return this.getCurrentBreakpoint() === 'tablet';
  }

  isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  /**
   * Maintain map view during responsive changes
   */
  maintainMapView() {
    // This would need to be implemented based on current route bounds
    // For now, we'll just trigger a resize
    if (this.map) {
      this.map.resize();
    }
  }

  /**
   * Restore map view after responsive change
   * @param {Object} mapState - Previous map state
   */
  restoreMapView(mapState) {
    if (!this.map || !mapState) return;

    this.map.easeTo({
      center: mapState.center,
      zoom: mapState.zoom,
      bearing: mapState.bearing || 0,
      pitch: mapState.pitch || 0,
      duration: 500,
      essential: true
    });
  }

  /**
   * Get current responsive state
   * @returns {Object} Current responsive state
   */
  getResponsiveState() {
    return {
      breakpoint: this.getCurrentBreakpoint(),
      dimensions: this.lastKnownDimensions,
      isTouch: this.isTouchDevice(),
      options: this.options
    };
  }

  /**
   * Update responsive options
   * @param {Object} newOptions - New responsive options
   */
  updateOptions(newOptions) {
    this.options = { ...this.options, ...newOptions };
    
    if (this.options.enabled) {
      this.applyResponsiveContainer();
    }
  }

  /**
   * Clean up event listeners and observers
   */
  cleanup() {
    console.log('MapboxResponsive: Starting cleanup...');
    
    // Clear debounce timer
    if (this.resizeDebounceTimer) {
      clearTimeout(this.resizeDebounceTimer);
    }
    
    // Disconnect resize observer
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    
    // Remove event listeners
    window.removeEventListener('resize', this.handleWindowResize);
    
    if (this.orientationChangeHandler) {
      window.removeEventListener('orientationchange', this.orientationChangeHandler);
    }
    
    // Reset state
    this.map = null;
    this.container = null;
    this.currentBreakpoint = null;
    
    console.log('MapboxResponsive: Cleanup completed');
  }
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MapboxResponsive;
} else if (typeof define === 'function' && define.amd) {
  define(function() { return MapboxResponsive; });
} else {
  window.MapboxResponsive = MapboxResponsive;
}