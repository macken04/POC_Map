/**
 * Mapbox Event System for Map Interactions
 * Comprehensive event handling for map clicks, hovers, gestures, and custom events
 * 
 * Features:
 * - Custom event dispatcher with throttling/debouncing
 * - Event delegation for dynamically added elements
 * - Performance optimizations for intensive events
 * - Public API for external event subscription
 * - Memory leak prevention with proper cleanup
 * 
 * Usage:
 * const eventSystem = new MapboxEventSystem(map);
 * eventSystem.on('map-click', callback);
 * eventSystem.emit('custom-event', data);
 */

class MapboxEventSystem {
  constructor(map, options = {}) {
    this.map = map;
    this.isInitialized = false;
    this.eventListeners = new Map();
    this.eventHistory = [];
    this.activeGestures = new Set();
    this.throttledCallbacks = new Map();
    this.debouncedCallbacks = new Map();
    
    // Configuration options with defaults
    this.options = Object.assign({
      enableEventHistory: true,
      maxHistoryLength: 100,
      throttleInterval: 16, // ~60fps
      debounceDelay: 250,
      enableGestureRecognition: true,
      enableAnalytics: false,
      logPerformanceMetrics: false
    }, options);

    // Performance tracking
    this.performanceMetrics = {
      eventCounts: {},
      lastEventTimes: {},
      averageProcessingTimes: {}
    };

    // Touch tracking for gesture recognition
    this.touchState = {
      touches: [],
      lastTouchTime: 0,
      gestureStartTime: 0,
      initialDistance: 0,
      initialRotation: 0
    };

    // Bind methods
    this.handleMapEvent = this.handleMapEvent.bind(this);
    this.handleUserInteraction = this.handleUserInteraction.bind(this);
    this.handleTouchEvent = this.handleTouchEvent.bind(this);
    this.cleanup = this.cleanup.bind(this);

    // Initialize if map is provided
    if (this.map) {
      this.init();
    }
  }

  /**
   * Initialize the event system
   */
  init() {
    if (this.isInitialized || !this.map) {
      return this;
    }

    try {
      console.log('MapboxEventSystem: Initializing comprehensive event handling...');

      // Add core map event listeners
      this.addMapEventListeners();
      
      // Add user interaction listeners
      this.addUserInteractionListeners();
      
      // Add touch/gesture listeners if enabled
      if (this.options.enableGestureRecognition) {
        this.addGestureListeners();
      }

      // Set up cleanup on page unload
      window.addEventListener('beforeunload', this.cleanup);
      
      this.isInitialized = true;
      this.emit('system-initialized', { timestamp: Date.now() });
      
      console.log('MapboxEventSystem: Initialization complete');
      return this;

    } catch (error) {
      console.error('MapboxEventSystem: Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Add core map event listeners
   */
  addMapEventListeners() {
    const mapEvents = [
      'load', 'resize', 'remove',
      'movestart', 'move', 'moveend',
      'zoomstart', 'zoom', 'zoomend',
      'rotatestart', 'rotate', 'rotateend',
      'pitchstart', 'pitch', 'pitchend',
      'boxzoomstart', 'boxzoomend', 'boxzoomcancel',
      'style.load', 'sourcedata', 'data',
      'error', 'webglcontextlost', 'webglcontextrestored'
    ];

    mapEvents.forEach(eventType => {
      // Create throttled handler for high-frequency events
      const handler = this.shouldThrottleEvent(eventType) 
        ? this.createThrottledHandler(eventType)
        : (event) => this.handleMapEvent(eventType, event);

      this.map.on(eventType, handler);
      
      // Store reference for cleanup
      if (!this.eventListeners.has('map')) {
        this.eventListeners.set('map', []);
      }
      this.eventListeners.get('map').push({ eventType, handler });
    });
  }

  /**
   * Add user interaction event listeners
   */
  addUserInteractionListeners() {
    const container = this.map.getContainer();
    
    const interactionEvents = [
      'click', 'dblclick', 'contextmenu',
      'mousedown', 'mouseup', 'mousemove',
      'mouseenter', 'mouseleave', 'mouseover', 'mouseout',
      'wheel'
    ];

    interactionEvents.forEach(eventType => {
      const handler = this.shouldThrottleEvent(eventType)
        ? this.createThrottledHandler(eventType, true)
        : (event) => this.handleUserInteraction(eventType, event);

      container.addEventListener(eventType, handler, { passive: false });
      
      // Store reference for cleanup
      if (!this.eventListeners.has('interaction')) {
        this.eventListeners.set('interaction', []);
      }
      this.eventListeners.get('interaction').push({ eventType, handler, element: container });
    });
  }

  /**
   * Add touch and gesture event listeners
   */
  addGestureListeners() {
    const container = this.map.getContainer();
    
    const touchEvents = [
      'touchstart', 'touchmove', 'touchend', 'touchcancel'
    ];

    touchEvents.forEach(eventType => {
      const handler = (event) => this.handleTouchEvent(eventType, event);
      container.addEventListener(eventType, handler, { passive: false });
      
      // Store reference for cleanup
      if (!this.eventListeners.has('touch')) {
        this.eventListeners.set('touch', []);
      }
      this.eventListeners.get('touch').push({ eventType, handler, element: container });
    });

    // Add orientation change listener for mobile
    window.addEventListener('orientationchange', () => {
      this.emit('orientation-change', { 
        orientation: screen.orientation?.angle || 0,
        timestamp: Date.now()
      });
    });
  }

  /**
   * Handle core map events
   */
  handleMapEvent(eventType, event) {
    const startTime = performance.now();
    
    try {
      // Create standardized event data
      const eventData = {
        type: eventType,
        originalEvent: event,
        timestamp: Date.now(),
        mapState: {
          center: this.map.getCenter(),
          zoom: this.map.getZoom(),
          bearing: this.map.getBearing(),
          pitch: this.map.getPitch()
        }
      };

      // Add specific data based on event type
      switch(eventType) {
        case 'load':
          eventData.mapLoaded = true;
          eventData.style = this.map.getStyle();
          break;
        case 'resize':
          const canvas = this.map.getCanvas();
          eventData.dimensions = {
            width: canvas.width,
            height: canvas.height
          };
          break;
        case 'error':
          eventData.error = event.error;
          console.error('Map error:', event.error);
          break;
      }

      // Emit the processed event
      this.emit(`map-${eventType}`, eventData);
      
      // Track performance
      this.trackPerformance(eventType, startTime);

    } catch (error) {
      console.error(`MapboxEventSystem: Error handling map event '${eventType}':`, error);
      this.emit('system-error', { eventType, error: error.message, timestamp: Date.now() });
    }
  }

  /**
   * Handle user interaction events
   */
  handleUserInteraction(eventType, event) {
    const startTime = performance.now();
    
    try {
      // Get map coordinates for pointer events
      let mapCoordinates = null;
      let features = [];
      
      if (event.clientX !== undefined && event.clientY !== undefined) {
        const point = [event.clientX, event.clientY];
        mapCoordinates = this.map.unproject(point);
        
        // Query map features at this point
        features = this.map.queryRenderedFeatures(point);
      }

      const eventData = {
        type: eventType,
        originalEvent: event,
        timestamp: Date.now(),
        coordinates: mapCoordinates,
        features: features,
        target: event.target,
        modifierKeys: {
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
          metaKey: event.metaKey
        }
      };

      // Add specific data for different event types
      switch(eventType) {
        case 'click':
          this.handleMapClick(eventData);
          break;
        case 'dblclick':
          this.handleMapDoubleClick(eventData);
          break;
        case 'mousemove':
          this.handleMapHover(eventData);
          break;
        case 'wheel':
          eventData.deltaY = event.deltaY;
          eventData.deltaX = event.deltaX;
          break;
      }

      // Emit the processed event
      this.emit(`user-${eventType}`, eventData);
      
      // Track performance
      this.trackPerformance(eventType, startTime);

    } catch (error) {
      console.error(`MapboxEventSystem: Error handling interaction '${eventType}':`, error);
      this.emit('system-error', { eventType, error: error.message, timestamp: Date.now() });
    }
  }

  /**
   * Handle touch events and gesture recognition
   */
  handleTouchEvent(eventType, event) {
    const startTime = performance.now();
    
    try {
      const touches = Array.from(event.touches).map(touch => ({
        id: touch.identifier,
        x: touch.clientX,
        y: touch.clientY,
        force: touch.force || 1
      }));

      const eventData = {
        type: eventType,
        originalEvent: event,
        timestamp: Date.now(),
        touches: touches,
        changedTouches: Array.from(event.changedTouches || [])
      };

      // Gesture recognition
      switch(eventType) {
        case 'touchstart':
          this.handleTouchStart(eventData);
          break;
        case 'touchmove':
          this.handleTouchMove(eventData);
          break;
        case 'touchend':
          this.handleTouchEnd(eventData);
          break;
        case 'touchcancel':
          this.resetTouchState();
          break;
      }

      // Emit the touch event
      this.emit(`touch-${eventType}`, eventData);
      
      // Track performance
      this.trackPerformance(eventType, startTime);

    } catch (error) {
      console.error(`MapboxEventSystem: Error handling touch event '${eventType}':`, error);
      this.emit('system-error', { eventType, error: error.message, timestamp: Date.now() });
    }
  }

  /**
   * Handle map click with feature detection
   */
  handleMapClick(eventData) {
    // Check if clicking on a route or marker
    const routeFeatures = eventData.features.filter(f => f.layer?.id?.includes('route'));
    const markerFeatures = eventData.features.filter(f => f.layer?.id?.includes('marker'));
    
    if (routeFeatures.length > 0) {
      eventData.clickedRoute = routeFeatures[0];
      this.emit('route-clicked', eventData);
    }
    
    if (markerFeatures.length > 0) {
      eventData.clickedMarker = markerFeatures[0];
      this.emit('marker-clicked', eventData);
    }

    // Check for empty area clicks
    if (eventData.features.length === 0) {
      this.emit('map-empty-click', eventData);
    }
  }

  /**
   * Handle map double-click
   */
  handleMapDoubleClick(eventData) {
    // Prevent default zoom behavior if needed
    if (this.hasListener('map-double-click-custom')) {
      eventData.originalEvent.preventDefault();
    }
    
    this.emit('map-double-click', eventData);
  }

  /**
   * Handle map hover with feature highlighting
   */
  handleMapHover(eventData) {
    // Implement hover state management
    const hoveredFeatures = eventData.features.filter(f => 
      f.layer?.id?.includes('route') || f.layer?.id?.includes('marker')
    );
    
    if (hoveredFeatures.length > 0) {
      eventData.hoveredFeatures = hoveredFeatures;
      this.updateCursor('pointer');
      this.emit('feature-hover', eventData);
    } else {
      this.updateCursor('');
      this.emit('feature-hover-out', eventData);
    }
  }

  /**
   * Handle touch start for gesture recognition
   */
  handleTouchStart(eventData) {
    this.touchState.touches = eventData.touches;
    this.touchState.lastTouchTime = eventData.timestamp;
    this.touchState.gestureStartTime = eventData.timestamp;

    if (eventData.touches.length === 2) {
      // Calculate initial distance and rotation for pinch/rotate gestures
      const [touch1, touch2] = eventData.touches;
      this.touchState.initialDistance = this.calculateDistance(touch1, touch2);
      this.touchState.initialRotation = this.calculateAngle(touch1, touch2);
      
      this.activeGestures.add('pinch-start');
      this.emit('gesture-pinch-start', eventData);
    }
  }

  /**
   * Handle touch move for gesture recognition
   */
  handleTouchMove(eventData) {
    if (eventData.touches.length === 2 && this.touchState.touches.length === 2) {
      const [touch1, touch2] = eventData.touches;
      const currentDistance = this.calculateDistance(touch1, touch2);
      const currentRotation = this.calculateAngle(touch1, touch2);
      
      // Pinch gesture detection
      const scaleFactor = currentDistance / this.touchState.initialDistance;
      const rotationDelta = currentRotation - this.touchState.initialRotation;
      
      if (Math.abs(scaleFactor - 1) > 0.1) {
        eventData.scaleFactor = scaleFactor;
        this.emit('gesture-pinch', eventData);
      }
      
      // Rotation gesture detection
      if (Math.abs(rotationDelta) > 10) {
        eventData.rotationDelta = rotationDelta;
        this.emit('gesture-rotate', eventData);
      }
    }
    
    this.touchState.touches = eventData.touches;
  }

  /**
   * Handle touch end for gesture completion
   */
  handleTouchEnd(eventData) {
    if (this.activeGestures.has('pinch-start')) {
      this.activeGestures.delete('pinch-start');
      this.emit('gesture-pinch-end', eventData);
    }
    
    // Reset touch state if no touches remaining
    if (eventData.touches.length === 0) {
      this.resetTouchState();
    } else {
      this.touchState.touches = eventData.touches;
    }
  }

  /**
   * Reset touch state
   */
  resetTouchState() {
    this.touchState.touches = [];
    this.touchState.initialDistance = 0;
    this.touchState.initialRotation = 0;
    this.activeGestures.clear();
  }

  /**
   * Calculate distance between two touch points
   */
  calculateDistance(touch1, touch2) {
    const dx = touch2.x - touch1.x;
    const dy = touch2.y - touch1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calculate angle between two touch points
   */
  calculateAngle(touch1, touch2) {
    return Math.atan2(touch2.y - touch1.y, touch2.x - touch1.x) * 180 / Math.PI;
  }

  /**
   * Update cursor style
   */
  updateCursor(cursor) {
    const container = this.map.getContainer();
    container.style.cursor = cursor;
  }

  /**
   * Check if event should be throttled
   */
  shouldThrottleEvent(eventType) {
    const throttledEvents = [
      'move', 'zoom', 'rotate', 'pitch',
      'mousemove', 'touchmove', 'wheel'
    ];
    return throttledEvents.some(type => eventType.includes(type));
  }

  /**
   * Create throttled event handler
   */
  createThrottledHandler(eventType, isUserInteraction = false) {
    const key = `${eventType}-${isUserInteraction ? 'interaction' : 'map'}`;
    
    if (!this.throttledCallbacks.has(key)) {
      let lastCallTime = 0;
      
      const throttledHandler = (event) => {
        const now = performance.now();
        if (now - lastCallTime >= this.options.throttleInterval) {
          lastCallTime = now;
          
          if (isUserInteraction) {
            this.handleUserInteraction(eventType, event);
          } else {
            this.handleMapEvent(eventType, event);
          }
        }
      };
      
      this.throttledCallbacks.set(key, throttledHandler);
    }
    
    return this.throttledCallbacks.get(key);
  }

  /**
   * Create debounced event handler
   */
  createDebouncedHandler(eventType, callback) {
    const key = eventType;
    
    if (!this.debouncedCallbacks.has(key)) {
      let timeoutId = null;
      
      const debouncedHandler = (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          callback.apply(this, args);
        }, this.options.debounceDelay);
      };
      
      this.debouncedCallbacks.set(key, debouncedHandler);
    }
    
    return this.debouncedCallbacks.get(key);
  }

  /**
   * Track performance metrics
   */
  trackPerformance(eventType, startTime) {
    if (!this.options.logPerformanceMetrics) return;
    
    const processingTime = performance.now() - startTime;
    
    // Update event counts
    this.performanceMetrics.eventCounts[eventType] = 
      (this.performanceMetrics.eventCounts[eventType] || 0) + 1;
    
    // Update processing times
    const currentAvg = this.performanceMetrics.averageProcessingTimes[eventType] || 0;
    const count = this.performanceMetrics.eventCounts[eventType];
    this.performanceMetrics.averageProcessingTimes[eventType] = 
      (currentAvg * (count - 1) + processingTime) / count;
    
    this.performanceMetrics.lastEventTimes[eventType] = Date.now();
  }

  /**
   * Public API: Subscribe to events
   */
  on(eventType, callback, options = {}) {
    if (typeof callback !== 'function') {
      throw new Error('Event callback must be a function');
    }

    if (!this.eventListeners.has('custom')) {
      this.eventListeners.set('custom', new Map());
    }

    const customListeners = this.eventListeners.get('custom');
    
    if (!customListeners.has(eventType)) {
      customListeners.set(eventType, []);
    }

    // Apply throttling/debouncing if requested
    let finalCallback = callback;
    
    if (options.throttle) {
      finalCallback = this.createThrottledHandler(eventType + '-custom', false);
    } else if (options.debounce) {
      finalCallback = this.createDebouncedHandler(eventType + '-custom', callback);
    }

    customListeners.get(eventType).push({
      callback: finalCallback,
      originalCallback: callback,
      options
    });

    return this;
  }

  /**
   * Public API: Unsubscribe from events
   */
  off(eventType, callback) {
    if (!this.eventListeners.has('custom')) {
      return this;
    }

    const customListeners = this.eventListeners.get('custom');
    
    if (customListeners.has(eventType)) {
      const listeners = customListeners.get(eventType);
      const index = listeners.findIndex(listener => 
        listener.originalCallback === callback || listener.callback === callback
      );
      
      if (index !== -1) {
        listeners.splice(index, 1);
        
        if (listeners.length === 0) {
          customListeners.delete(eventType);
        }
      }
    }

    return this;
  }

  /**
   * Public API: Emit custom events
   */
  emit(eventType, data = {}) {
    try {
      // Add to event history
      if (this.options.enableEventHistory) {
        this.addToHistory(eventType, data);
      }

      // Emit to custom listeners
      if (this.eventListeners.has('custom')) {
        const customListeners = this.eventListeners.get('custom');
        
        if (customListeners.has(eventType)) {
          const listeners = customListeners.get(eventType);
          listeners.forEach(({ callback }) => {
            try {
              callback(data);
            } catch (error) {
              console.error(`Error in event listener for '${eventType}':`, error);
            }
          });
        }
      }

      // Log analytics if enabled
      if (this.options.enableAnalytics) {
        this.logAnalyticsEvent(eventType, data);
      }

    } catch (error) {
      console.error(`MapboxEventSystem: Error emitting event '${eventType}':`, error);
    }

    return this;
  }

  /**
   * Check if there are listeners for an event type
   */
  hasListener(eventType) {
    if (!this.eventListeners.has('custom')) {
      return false;
    }

    const customListeners = this.eventListeners.get('custom');
    return customListeners.has(eventType) && customListeners.get(eventType).length > 0;
  }

  /**
   * Add event to history
   */
  addToHistory(eventType, data) {
    this.eventHistory.push({
      eventType,
      data,
      timestamp: Date.now()
    });

    // Trim history if it exceeds max length
    if (this.eventHistory.length > this.options.maxHistoryLength) {
      this.eventHistory.shift();
    }
  }

  /**
   * Log analytics event
   */
  logAnalyticsEvent(eventType, data) {
    // This would integrate with analytics service
    console.log(`Analytics: ${eventType}`, data);
  }

  /**
   * Public API: Get event history
   */
  getEventHistory(eventType = null, limit = null) {
    let history = this.eventHistory;

    if (eventType) {
      history = history.filter(event => event.eventType === eventType);
    }

    if (limit) {
      history = history.slice(-limit);
    }

    return [...history];
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    return { ...this.performanceMetrics };
  }

  /**
   * Get current system status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      eventListenerCounts: {
        map: this.eventListeners.get('map')?.length || 0,
        interaction: this.eventListeners.get('interaction')?.length || 0,
        touch: this.eventListeners.get('touch')?.length || 0,
        custom: this.eventListeners.has('custom') 
          ? Array.from(this.eventListeners.get('custom').values()).reduce((sum, listeners) => sum + listeners.length, 0)
          : 0
      },
      activeGestures: Array.from(this.activeGestures),
      historyLength: this.eventHistory.length,
      options: this.options
    };
  }

  /**
   * Clear all custom event listeners
   */
  removeAllListeners(eventType = null) {
    if (!this.eventListeners.has('custom')) {
      return this;
    }

    const customListeners = this.eventListeners.get('custom');

    if (eventType) {
      customListeners.delete(eventType);
    } else {
      customListeners.clear();
    }

    return this;
  }

  /**
   * Cleanup all event listeners and resources
   */
  cleanup() {
    if (!this.isInitialized) return;

    console.log('MapboxEventSystem: Cleaning up resources...');

    // Remove map event listeners
    if (this.eventListeners.has('map')) {
      this.eventListeners.get('map').forEach(({ eventType, handler }) => {
        this.map.off(eventType, handler);
      });
    }

    // Remove interaction event listeners
    if (this.eventListeners.has('interaction')) {
      this.eventListeners.get('interaction').forEach(({ eventType, handler, element }) => {
        element.removeEventListener(eventType, handler);
      });
    }

    // Remove touch event listeners
    if (this.eventListeners.has('touch')) {
      this.eventListeners.get('touch').forEach(({ eventType, handler, element }) => {
        element.removeEventListener(eventType, handler);
      });
    }

    // Clear throttled and debounced callbacks
    this.throttledCallbacks.clear();
    this.debouncedCallbacks.clear();

    // Clear all event listeners and state
    this.eventListeners.clear();
    this.eventHistory = [];
    this.activeGestures.clear();
    this.resetTouchState();

    // Remove window event listeners
    window.removeEventListener('beforeunload', this.cleanup);

    this.isInitialized = false;
    console.log('MapboxEventSystem: Cleanup completed');
  }
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MapboxEventSystem;
} else if (typeof define === 'function' && define.amd) {
  define(function() { return MapboxEventSystem; });
} else {
  window.MapboxEventSystem = MapboxEventSystem;
}