/**
 * Map Rendering Error Recovery System
 * Provides fallback strategies, graceful degradation, and retry mechanisms
 * for map rendering failures in the route visualization system.
 * 
 * Features:
 * - Fallback rendering strategies for corrupted/incomplete data
 * - Graceful degradation for partial route failures
 * - Retry mechanisms with exponential backoff
 * - Map initialization recovery
 * - Progress tracking with error state management
 * - Integration with ErrorManager and InputValidator
 */

class MapErrorRecovery {
  constructor(options = {}) {
    this.options = Object.assign({
      // Retry settings
      maxRetryAttempts: 3,
      retryDelay: 1000, // Base delay in ms
      retryBackoffMultiplier: 2,
      
      // Fallback settings
      enableFallbackRendering: true,
      fallbackMapStyle: 'mapbox://styles/mapbox/streets-v11',
      fallbackZoom: 10,
      
      // Performance settings
      maxRenderTime: 10000, // 10 seconds
      maxMemoryUsage: 200 * 1024 * 1024, // 200MB
      
      // Recovery strategies
      enablePartialRouteRendering: true,
      enableSimplifiedRendering: true,
      enableProgressiveLoading: true,
      
      // Integration settings
      useErrorManager: true,
      useInputValidator: true,
      
      // UI settings
      showRecoveryProgress: true,
      progressContainer: 'map-recovery-progress'
    }, options);

    // State tracking
    this.recoveryState = {
      isRecovering: false,
      currentAttempt: 0,
      failedOperations: new Set(),
      partialData: new Map(),
      recoveryHistory: []
    };

    // Performance monitoring
    this.performanceTracker = {
      renderStart: null,
      memoryStart: null,
      operationTimeouts: new Map()
    };

    // Recovery strategies registry
    this.recoveryStrategies = new Map();
    this.initializeRecoveryStrategies();

    console.log('MapErrorRecovery initialized with options:', this.options);
  }

  /**
   * Recovery strategy types
   */
  static RECOVERY_STRATEGIES = {
    RETRY_WITH_BACKOFF: 'retry_with_backoff',
    PARTIAL_ROUTE_RENDERING: 'partial_route_rendering',
    SIMPLIFIED_RENDERING: 'simplified_rendering',
    FALLBACK_STYLE: 'fallback_style',
    PROGRESSIVE_LOADING: 'progressive_loading',
    MEMORY_OPTIMIZATION: 'memory_optimization',
    COORDINATE_FILTERING: 'coordinate_filtering'
  };

  /**
   * Error recovery types
   */
  static RECOVERY_TYPES = {
    MAP_INITIALIZATION: 'map_initialization',
    ROUTE_RENDERING: 'route_rendering',
    STYLE_LOADING: 'style_loading',
    LAYER_CREATION: 'layer_creation',
    DATA_PROCESSING: 'data_processing',
    PERFORMANCE_DEGRADATION: 'performance_degradation'
  };

  /**
   * Initialize recovery strategies
   */
  initializeRecoveryStrategies() {
    // Map initialization recovery
    this.recoveryStrategies.set(MapErrorRecovery.RECOVERY_TYPES.MAP_INITIALIZATION, [
      MapErrorRecovery.RECOVERY_STRATEGIES.RETRY_WITH_BACKOFF,
      MapErrorRecovery.RECOVERY_STRATEGIES.FALLBACK_STYLE,
      MapErrorRecovery.RECOVERY_STRATEGIES.SIMPLIFIED_RENDERING
    ]);

    // Route rendering recovery
    this.recoveryStrategies.set(MapErrorRecovery.RECOVERY_TYPES.ROUTE_RENDERING, [
      MapErrorRecovery.RECOVERY_STRATEGIES.PARTIAL_ROUTE_RENDERING,
      MapErrorRecovery.RECOVERY_STRATEGIES.COORDINATE_FILTERING,
      MapErrorRecovery.RECOVERY_STRATEGIES.SIMPLIFIED_RENDERING,
      MapErrorRecovery.RECOVERY_STRATEGIES.PROGRESSIVE_LOADING
    ]);

    // Style loading recovery
    this.recoveryStrategies.set(MapErrorRecovery.RECOVERY_TYPES.STYLE_LOADING, [
      MapErrorRecovery.RECOVERY_STRATEGIES.FALLBACK_STYLE,
      MapErrorRecovery.RECOVERY_STRATEGIES.RETRY_WITH_BACKOFF
    ]);

    // Layer creation recovery
    this.recoveryStrategies.set(MapErrorRecovery.RECOVERY_TYPES.LAYER_CREATION, [
      MapErrorRecovery.RECOVERY_STRATEGIES.SIMPLIFIED_RENDERING,
      MapErrorRecovery.RECOVERY_STRATEGIES.RETRY_WITH_BACKOFF
    ]);

    // Performance degradation recovery
    this.recoveryStrategies.set(MapErrorRecovery.RECOVERY_TYPES.PERFORMANCE_DEGRADATION, [
      MapErrorRecovery.RECOVERY_STRATEGIES.MEMORY_OPTIMIZATION,
      MapErrorRecovery.RECOVERY_STRATEGIES.COORDINATE_FILTERING,
      MapErrorRecovery.RECOVERY_STRATEGIES.SIMPLIFIED_RENDERING
    ]);
  }

  /**
   * Main recovery orchestration method
   * @param {Object} error - Error object with recovery context
   * @param {Object} mapInstance - Mapbox map instance
   * @param {Object} routeData - Original route data
   * @returns {Promise<Object>} Recovery result
   */
  async recoverFromError(error, mapInstance, routeData) {
    const recoveryId = this.generateRecoveryId();
    this.recoveryState.isRecovering = true;
    
    try {
      this.showRecoveryProgress('Analyzing error and determining recovery strategy...');
      
      // Determine recovery type
      const recoveryType = this.determineRecoveryType(error);
      
      // Get applicable strategies
      const strategies = this.recoveryStrategies.get(recoveryType) || [];
      
      this.logRecoveryAttempt(recoveryId, error, recoveryType, strategies);
      
      // Attempt recovery strategies in order
      for (const strategy of strategies) {
        try {
          this.showRecoveryProgress(`Attempting recovery strategy: ${strategy}...`);
          
          const result = await this.executeRecoveryStrategy(
            strategy, 
            error, 
            mapInstance, 
            routeData, 
            recoveryId
          );
          
          if (result.success) {
            this.recoveryState.isRecovering = false;
            this.hideRecoveryProgress();
            this.logRecoverySuccess(recoveryId, strategy, result);
            return result;
          }
          
        } catch (strategyError) {
          console.warn(`Recovery strategy ${strategy} failed:`, strategyError);
          this.logRecoveryFailure(recoveryId, strategy, strategyError);
        }
      }
      
      // If all strategies failed, attempt final fallback
      const fallbackResult = await this.executeFinalFallback(error, mapInstance, routeData);
      
      this.recoveryState.isRecovering = false;
      this.hideRecoveryProgress();
      
      return fallbackResult;
      
    } catch (recoveryError) {
      this.recoveryState.isRecovering = false;
      this.hideRecoveryProgress();
      
      this.logRecoveryFailure(recoveryId, 'orchestration', recoveryError);
      
      // Report recovery failure to error manager
      if (this.options.useErrorManager && window.errorManager) {
        window.errorManager.handleError({
          type: 'recovery_failed',
          category: 'system',
          severity: 'high',
          message: 'Map error recovery failed completely',
          details: {
            originalError: error,
            recoveryError: recoveryError,
            recoveryId: recoveryId
          }
        });
      }
      
      return {
        success: false,
        error: recoveryError,
        recoveryId: recoveryId,
        fallbackUsed: false
      };
    }
  }

  /**
   * Execute specific recovery strategy
   * @param {string} strategy - Recovery strategy type
   * @param {Object} error - Original error
   * @param {Object} mapInstance - Map instance
   * @param {Object} routeData - Route data
   * @param {string} recoveryId - Recovery session ID
   * @returns {Promise<Object>} Strategy execution result
   */
  async executeRecoveryStrategy(strategy, error, mapInstance, routeData, recoveryId) {
    switch (strategy) {
      case MapErrorRecovery.RECOVERY_STRATEGIES.RETRY_WITH_BACKOFF:
        return await this.retryWithBackoff(error, mapInstance, routeData);
        
      case MapErrorRecovery.RECOVERY_STRATEGIES.PARTIAL_ROUTE_RENDERING:
        return await this.renderPartialRoute(error, mapInstance, routeData);
        
      case MapErrorRecovery.RECOVERY_STRATEGIES.SIMPLIFIED_RENDERING:
        return await this.renderSimplified(error, mapInstance, routeData);
        
      case MapErrorRecovery.RECOVERY_STRATEGIES.FALLBACK_STYLE:
        return await this.useFallbackStyle(error, mapInstance, routeData);
        
      case MapErrorRecovery.RECOVERY_STRATEGIES.PROGRESSIVE_LOADING:
        return await this.progressiveLoading(error, mapInstance, routeData);
        
      case MapErrorRecovery.RECOVERY_STRATEGIES.MEMORY_OPTIMIZATION:
        return await this.optimizeMemoryUsage(error, mapInstance, routeData);
        
      case MapErrorRecovery.RECOVERY_STRATEGIES.COORDINATE_FILTERING:
        return await this.filterCoordinates(error, mapInstance, routeData);
        
      default:
        throw new Error(`Unknown recovery strategy: ${strategy}`);
    }
  }

  /**
   * Retry with exponential backoff
   * @param {Object} error - Original error
   * @param {Object} mapInstance - Map instance
   * @param {Object} routeData - Route data
   * @returns {Promise<Object>} Retry result
   */
  async retryWithBackoff(error, mapInstance, routeData) {
    const maxAttempts = this.options.maxRetryAttempts;
    let attempt = 0;
    
    while (attempt < maxAttempts) {
      attempt++;
      const delay = this.options.retryDelay * Math.pow(this.options.retryBackoffMultiplier, attempt - 1);
      
      this.showRecoveryProgress(`Retry attempt ${attempt}/${maxAttempts} (waiting ${delay}ms)...`);
      
      await this.sleep(delay);
      
      try {
        // Attempt the original operation
        const result = await this.attemptOriginalOperation(error, mapInstance, routeData);
        
        if (result.success) {
          return {
            success: true,
            strategy: MapErrorRecovery.RECOVERY_STRATEGIES.RETRY_WITH_BACKOFF,
            attempts: attempt,
            data: result.data
          };
        }
        
      } catch (retryError) {
        console.warn(`Retry attempt ${attempt} failed:`, retryError);
        
        if (attempt === maxAttempts) {
          throw retryError;
        }
      }
    }
    
    throw new Error(`All ${maxAttempts} retry attempts failed`);
  }

  /**
   * Render partial route (skip corrupted segments)
   * @param {Object} error - Original error
   * @param {Object} mapInstance - Map instance
   * @param {Object} routeData - Route data
   * @returns {Promise<Object>} Partial rendering result
   */
  async renderPartialRoute(error, mapInstance, routeData) {
    if (!this.options.enablePartialRouteRendering) {
      throw new Error('Partial route rendering is disabled');
    }
    
    this.showRecoveryProgress('Analyzing route data for partial rendering...');
    
    // Validate and filter coordinates
    const coordinates = routeData.coordinates || [];
    const validSegments = [];
    const invalidSegments = [];
    
    // Split coordinates into segments and validate each
    const segmentSize = Math.min(1000, Math.max(100, Math.floor(coordinates.length / 10)));
    
    for (let i = 0; i < coordinates.length; i += segmentSize) {
      const segment = coordinates.slice(i, i + segmentSize);
      
      try {
        // Validate segment
        if (this.options.useInputValidator && window.inputValidator) {
          const validation = window.inputValidator.validateCoordinates(segment);
          if (validation.status === 'success' || validation.status === 'warning') {
            validSegments.push(segment);
          } else {
            invalidSegments.push({ index: i, segment: segment, error: validation });
          }
        } else {
          // Basic validation
          const isValid = segment.every(coord => 
            Array.isArray(coord) && 
            coord.length >= 2 && 
            typeof coord[0] === 'number' && 
            typeof coord[1] === 'number' &&
            Math.abs(coord[0]) <= 90 && 
            Math.abs(coord[1]) <= 180
          );
          
          if (isValid) {
            validSegments.push(segment);
          } else {
            invalidSegments.push({ index: i, segment: segment, error: 'Invalid coordinates' });
          }
        }
      } catch (segmentError) {
        invalidSegments.push({ index: i, segment: segment, error: segmentError.message });
      }
    }
    
    if (validSegments.length === 0) {
      throw new Error('No valid route segments found for partial rendering');
    }
    
    this.showRecoveryProgress(`Rendering ${validSegments.length} valid segments (${invalidSegments.length} segments skipped)...`);
    
    // Render valid segments
    try {
      const flattenedCoordinates = validSegments.flat();
      const partialRouteData = {
        ...routeData,
        coordinates: flattenedCoordinates,
        metadata: {
          ...routeData.metadata,
          isPartialRender: true,
          validSegments: validSegments.length,
          invalidSegments: invalidSegments.length,
          totalOriginalPoints: coordinates.length,
          renderingPoints: flattenedCoordinates.length
        }
      };
      
      // Store partial data for reference
      this.recoveryState.partialData.set('route', partialRouteData);
      
      // Attempt to render the partial route
      const renderResult = await this.renderRoute(mapInstance, partialRouteData);
      
      return {
        success: true,
        strategy: MapErrorRecovery.RECOVERY_STRATEGIES.PARTIAL_ROUTE_RENDERING,
        data: partialRouteData,
        renderResult: renderResult,
        warnings: invalidSegments.length > 0 ? [`${invalidSegments.length} route segments were skipped due to data errors`] : []
      };
      
    } catch (renderError) {
      throw new Error(`Partial route rendering failed: ${renderError.message}`);
    }
  }

  /**
   * Render with simplified styling and reduced features
   * @param {Object} error - Original error
   * @param {Object} mapInstance - Map instance
   * @param {Object} routeData - Route data
   * @returns {Promise<Object>} Simplified rendering result
   */
  async renderSimplified(error, mapInstance, routeData) {
    if (!this.options.enableSimplifiedRendering) {
      throw new Error('Simplified rendering is disabled');
    }
    
    this.showRecoveryProgress('Preparing simplified route rendering...');
    
    // Create simplified route data
    const simplifiedData = {
      ...routeData,
      coordinates: this.simplifyCoordinates(routeData.coordinates || []),
      style: {
        color: '#FF0000',
        weight: 2,
        opacity: 0.8,
        simplified: true
      },
      features: {
        elevation: false,
        animation: false,
        markers: false,
        popups: false
      }
    };
    
    try {
      const renderResult = await this.renderRoute(mapInstance, simplifiedData, {
        useSimpleStyle: true,
        skipAnimations: true,
        skipMarkers: true
      });
      
      return {
        success: true,
        strategy: MapErrorRecovery.RECOVERY_STRATEGIES.SIMPLIFIED_RENDERING,
        data: simplifiedData,
        renderResult: renderResult,
        warnings: ['Route rendered with simplified styling for better performance']
      };
      
    } catch (renderError) {
      throw new Error(`Simplified rendering failed: ${renderError.message}`);
    }
  }

  /**
   * Use fallback map style
   * @param {Object} error - Original error
   * @param {Object} mapInstance - Map instance
   * @param {Object} routeData - Route data
   * @returns {Promise<Object>} Fallback style result
   */
  async useFallbackStyle(error, mapInstance, routeData) {
    this.showRecoveryProgress('Switching to fallback map style...');
    
    try {
      // Switch to fallback style
      await new Promise((resolve, reject) => {
        mapInstance.setStyle(this.options.fallbackMapStyle);
        mapInstance.once('styledata', resolve);
        mapInstance.once('error', reject);
        
        // Timeout after 10 seconds
        setTimeout(() => reject(new Error('Style loading timeout')), 10000);
      });
      
      // Re-render route with fallback style
      const renderResult = await this.renderRoute(mapInstance, routeData);
      
      return {
        success: true,
        strategy: MapErrorRecovery.RECOVERY_STRATEGIES.FALLBACK_STYLE,
        data: routeData,
        renderResult: renderResult,
        warnings: ['Using fallback map style due to original style loading error']
      };
      
    } catch (styleError) {
      throw new Error(`Fallback style loading failed: ${styleError.message}`);
    }
  }

  /**
   * Progressive loading of route data
   * @param {Object} error - Original error
   * @param {Object} mapInstance - Map instance
   * @param {Object} routeData - Route data
   * @returns {Promise<Object>} Progressive loading result
   */
  async progressiveLoading(error, mapInstance, routeData) {
    if (!this.options.enableProgressiveLoading) {
      throw new Error('Progressive loading is disabled');
    }
    
    this.showRecoveryProgress('Starting progressive route loading...');
    
    const coordinates = routeData.coordinates || [];
    const batchSize = Math.min(5000, Math.max(500, coordinates.length / 20));
    const batches = [];
    
    // Split coordinates into batches
    for (let i = 0; i < coordinates.length; i += batchSize) {
      batches.push(coordinates.slice(i, i + batchSize));
    }
    
    try {
      let loadedBatches = 0;
      const totalBatches = batches.length;
      
      // Load batches progressively
      for (const batch of batches) {
        loadedBatches++;
        this.showRecoveryProgress(`Loading route segment ${loadedBatches}/${totalBatches}...`);
        
        const batchData = {
          ...routeData,
          coordinates: batch,
          metadata: {
            ...routeData.metadata,
            isProgressiveLoad: true,
            batchNumber: loadedBatches,
            totalBatches: totalBatches
          }
        };
        
        await this.renderRoute(mapInstance, batchData, {
          append: loadedBatches > 1,
          layerId: `route-batch-${loadedBatches}`
        });
        
        // Small delay between batches to prevent overwhelming the renderer
        await this.sleep(100);
      }
      
      return {
        success: true,
        strategy: MapErrorRecovery.RECOVERY_STRATEGIES.PROGRESSIVE_LOADING,
        data: {
          ...routeData,
          metadata: {
            ...routeData.metadata,
            progressiveLoadingUsed: true,
            totalBatches: totalBatches
          }
        },
        warnings: [`Route loaded progressively in ${totalBatches} segments`]
      };
      
    } catch (progressiveError) {
      throw new Error(`Progressive loading failed: ${progressiveError.message}`);
    }
  }

  /**
   * Optimize memory usage
   * @param {Object} error - Original error
   * @param {Object} mapInstance - Map instance
   * @param {Object} routeData - Route data
   * @returns {Promise<Object>} Memory optimization result
   */
  async optimizeMemoryUsage(error, mapInstance, routeData) {
    this.showRecoveryProgress('Optimizing memory usage...');
    
    try {
      // Clear existing layers and sources
      const layers = mapInstance.getStyle().layers;
      const sources = mapInstance.getStyle().sources;
      
      // Remove non-essential layers
      layers.forEach(layer => {
        if (layer.id.includes('route') || layer.id.includes('marker')) {
          try {
            mapInstance.removeLayer(layer.id);
          } catch (e) {
            // Layer might not exist
          }
        }
      });
      
      // Remove non-essential sources
      Object.keys(sources).forEach(sourceId => {
        if (sourceId.includes('route') || sourceId.includes('marker')) {
          try {
            mapInstance.removeSource(sourceId);
          } catch (e) {
            // Source might not exist
          }
        }
      });
      
      // Force garbage collection if available
      if (window.gc) {
        window.gc();
      }
      
      // Simplify route data
      const optimizedData = {
        ...routeData,
        coordinates: this.simplifyCoordinates(routeData.coordinates || [], 0.0001), // More aggressive simplification
        features: {
          elevation: false,
          animation: false,
          markers: false,
          popups: false
        }
      };
      
      const renderResult = await this.renderRoute(mapInstance, optimizedData, {
        useSimpleStyle: true,
        lowMemoryMode: true
      });
      
      return {
        success: true,
        strategy: MapErrorRecovery.RECOVERY_STRATEGIES.MEMORY_OPTIMIZATION,
        data: optimizedData,
        renderResult: renderResult,
        warnings: ['Memory optimizations applied - some features may be disabled']
      };
      
    } catch (optimizationError) {
      throw new Error(`Memory optimization failed: ${optimizationError.message}`);
    }
  }

  /**
   * Filter and clean coordinates
   * @param {Object} error - Original error
   * @param {Object} mapInstance - Map instance
   * @param {Object} routeData - Route data
   * @returns {Promise<Object>} Coordinate filtering result
   */
  async filterCoordinates(error, mapInstance, routeData) {
    this.showRecoveryProgress('Filtering and cleaning coordinate data...');
    
    const coordinates = routeData.coordinates || [];
    const filteredCoordinates = [];
    const removedPoints = [];
    
    try {
      // Filter coordinates
      for (let i = 0; i < coordinates.length; i++) {
        const coord = coordinates[i];
        
        // Basic validation
        if (!Array.isArray(coord) || coord.length < 2) {
          removedPoints.push({ index: i, reason: 'Invalid structure', coord: coord });
          continue;
        }
        
        const [lat, lng] = coord;
        
        // Type and range validation
        if (typeof lat !== 'number' || typeof lng !== 'number' ||
            Math.abs(lat) > 90 || Math.abs(lng) > 180 ||
            isNaN(lat) || isNaN(lng)) {
          removedPoints.push({ index: i, reason: 'Invalid coordinates', coord: coord });
          continue;
        }
        
        // Check for duplicates (within 1 meter)
        if (filteredCoordinates.length > 0) {
          const lastCoord = filteredCoordinates[filteredCoordinates.length - 1];
          const distance = this.calculateDistance(lastCoord, coord);
          
          if (distance < 1) { // Less than 1 meter
            removedPoints.push({ index: i, reason: 'Duplicate point', coord: coord });
            continue;
          }
        }
        
        filteredCoordinates.push(coord);
      }
      
      if (filteredCoordinates.length < 2) {
        throw new Error('Not enough valid coordinates after filtering');
      }
      
      const filteredData = {
        ...routeData,
        coordinates: filteredCoordinates,
        metadata: {
          ...routeData.metadata,
          coordinatesFiltered: true,
          originalPointCount: coordinates.length,
          filteredPointCount: filteredCoordinates.length,
          removedPointCount: removedPoints.length
        }
      };
      
      const renderResult = await this.renderRoute(mapInstance, filteredData);
      
      return {
        success: true,
        strategy: MapErrorRecovery.RECOVERY_STRATEGIES.COORDINATE_FILTERING,
        data: filteredData,
        renderResult: renderResult,
        warnings: removedPoints.length > 0 ? [`${removedPoints.length} invalid coordinate points were removed`] : []
      };
      
    } catch (filterError) {
      throw new Error(`Coordinate filtering failed: ${filterError.message}`);
    }
  }

  /**
   * Execute final fallback when all strategies fail
   * @param {Object} error - Original error
   * @param {Object} mapInstance - Map instance
   * @param {Object} routeData - Route data
   * @returns {Promise<Object>} Final fallback result
   */
  async executeFinalFallback(error, mapInstance, routeData) {
    this.showRecoveryProgress('Executing final fallback strategy...');
    
    try {
      // Display error message on map
      const errorOverlay = this.createErrorOverlay(error, routeData);
      
      // Try to at least show the map center based on route bounds
      if (routeData.coordinates && routeData.coordinates.length > 0) {
        const bounds = this.calculateBounds(routeData.coordinates);
        if (bounds) {
          mapInstance.fitBounds(bounds, { padding: 50 });
        }
      }
      
      return {
        success: false,
        strategy: 'final_fallback',
        error: error,
        fallbackUsed: true,
        overlay: errorOverlay,
        warnings: ['Unable to render route - displaying error information instead']
      };
      
    } catch (fallbackError) {
      return {
        success: false,
        strategy: 'final_fallback',
        error: fallbackError,
        fallbackUsed: false,
        warnings: ['Complete recovery failure - unable to display any map content']
      };
    }
  }

  /**
   * Attempt to execute the original operation that failed
   * @param {Object} error - Original error
   * @param {Object} mapInstance - Map instance
   * @param {Object} routeData - Route data
   * @returns {Promise<Object>} Operation result
   */
  async attemptOriginalOperation(error, mapInstance, routeData) {
    // This would be implemented based on the specific operation that failed
    // For now, we'll attempt a basic route render
    return await this.renderRoute(mapInstance, routeData);
  }

  /**
   * Render route on map
   * @param {Object} mapInstance - Map instance
   * @param {Object} routeData - Route data
   * @param {Object} options - Rendering options
   * @returns {Promise<Object>} Render result
   */
  async renderRoute(mapInstance, routeData, options = {}) {
    return new Promise((resolve, reject) => {
      try {
        const coordinates = routeData.coordinates || [];
        if (coordinates.length < 2) {
          throw new Error('Insufficient coordinates for route rendering');
        }
        
        // Convert coordinates to GeoJSON
        const geojson = {
          type: 'Feature',
          properties: {
            name: routeData.name || 'Route',
            ...routeData.metadata
          },
          geometry: {
            type: 'LineString',
            coordinates: coordinates.map(coord => [coord[1], coord[0]]) // [lng, lat]
          }
        };
        
        const sourceId = options.layerId ? `${options.layerId}-source` : 'route-source';
        const layerId = options.layerId || 'route-layer';
        
        // Add or update source
        if (mapInstance.getSource(sourceId)) {
          mapInstance.getSource(sourceId).setData(geojson);
        } else {
          mapInstance.addSource(sourceId, {
            type: 'geojson',
            data: geojson
          });
        }
        
        // Add or update layer
        if (!mapInstance.getLayer(layerId)) {
          mapInstance.addLayer({
            id: layerId,
            type: 'line',
            source: sourceId,
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': routeData.style?.color || '#FF0000',
              'line-width': routeData.style?.weight || 3,
              'line-opacity': routeData.style?.opacity || 0.8
            }
          });
        }
        
        // Fit bounds if not appending
        if (!options.append && coordinates.length > 0) {
          const bounds = this.calculateBounds(coordinates);
          if (bounds) {
            mapInstance.fitBounds(bounds, { padding: 50 });
          }
        }
        
        resolve({
          success: true,
          sourceId: sourceId,
          layerId: layerId,
          coordinateCount: coordinates.length
        });
        
      } catch (renderError) {
        reject(renderError);
      }
    });
  }

  /**
   * Simplify coordinates using Douglas-Peucker algorithm
   * @param {Array} coordinates - Array of coordinate pairs
   * @param {number} tolerance - Simplification tolerance
   * @returns {Array} Simplified coordinates
   */
  simplifyCoordinates(coordinates, tolerance = 0.0001) {
    if (coordinates.length <= 2) return coordinates;
    
    // Simple implementation - take every nth point
    const step = Math.max(1, Math.floor(coordinates.length / 1000));
    const simplified = [];
    
    for (let i = 0; i < coordinates.length; i += step) {
      simplified.push(coordinates[i]);
    }
    
    // Always include the last point
    if (simplified[simplified.length - 1] !== coordinates[coordinates.length - 1]) {
      simplified.push(coordinates[coordinates.length - 1]);
    }
    
    return simplified;
  }

  /**
   * Calculate bounds for coordinate array
   * @param {Array} coordinates - Array of [lat, lng] coordinates
   * @returns {Array} Bounds in [[minLng, minLat], [maxLng, maxLat]] format
   */
  calculateBounds(coordinates) {
    if (!coordinates || coordinates.length === 0) return null;
    
    let minLat = coordinates[0][0];
    let maxLat = coordinates[0][0];
    let minLng = coordinates[0][1];
    let maxLng = coordinates[0][1];
    
    for (const coord of coordinates) {
      minLat = Math.min(minLat, coord[0]);
      maxLat = Math.max(maxLat, coord[0]);
      minLng = Math.min(minLng, coord[1]);
      maxLng = Math.max(maxLng, coord[1]);
    }
    
    return [[minLng, minLat], [maxLng, maxLat]];
  }

  /**
   * Calculate distance between two points
   * @param {Array} point1 - [lat, lng]
   * @param {Array} point2 - [lat, lng]
   * @returns {number} Distance in meters
   */
  calculateDistance(point1, point2) {
    const [lat1, lon1] = point1;
    const [lat2, lon2] = point2;
    
    const R = 6371000; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c;
  }

  /**
   * Create error overlay for display on map
   * @param {Object} error - Error object
   * @param {Object} routeData - Route data
   * @returns {Object} Error overlay configuration
   */
  createErrorOverlay(error, routeData) {
    return {
      type: 'error_display',
      title: 'Route Rendering Error',
      message: 'Unable to display the route on the map',
      details: error.message,
      routeName: routeData.name || 'Unknown Route',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Determine recovery type based on error
   * @param {Object} error - Error object
   * @returns {string} Recovery type
   */
  determineRecoveryType(error) {
    if (error.type?.includes('initialization') || error.message?.includes('map')) {
      return MapErrorRecovery.RECOVERY_TYPES.MAP_INITIALIZATION;
    }
    
    if (error.type?.includes('style') || error.message?.includes('style')) {
      return MapErrorRecovery.RECOVERY_TYPES.STYLE_LOADING;
    }
    
    if (error.type?.includes('layer') || error.message?.includes('layer')) {
      return MapErrorRecovery.RECOVERY_TYPES.LAYER_CREATION;
    }
    
    if (error.type?.includes('performance') || error.type?.includes('memory')) {
      return MapErrorRecovery.RECOVERY_TYPES.PERFORMANCE_DEGRADATION;
    }
    
    // Default to route rendering recovery
    return MapErrorRecovery.RECOVERY_TYPES.ROUTE_RENDERING;
  }

  /**
   * Show recovery progress to user
   * @param {string} message - Progress message
   */
  showRecoveryProgress(message) {
    if (!this.options.showRecoveryProgress) return;
    
    const container = document.getElementById(this.options.progressContainer);
    if (container) {
      container.style.display = 'block';
      container.textContent = message;
    } else {
      // Create progress container if it doesn't exist
      const progress = document.createElement('div');
      progress.id = this.options.progressContainer;
      progress.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        z-index: 10000;
        font-family: Arial, sans-serif;
        max-width: 400px;
        text-align: center;
      `;
      progress.textContent = message;
      document.body.appendChild(progress);
    }
  }

  /**
   * Hide recovery progress
   */
  hideRecoveryProgress() {
    const container = document.getElementById(this.options.progressContainer);
    if (container) {
      container.style.display = 'none';
    }
  }

  /**
   * Log recovery attempt
   * @param {string} recoveryId - Recovery session ID
   * @param {Object} error - Original error
   * @param {string} recoveryType - Recovery type
   * @param {Array} strategies - Recovery strategies
   */
  logRecoveryAttempt(recoveryId, error, recoveryType, strategies) {
    const logEntry = {
      recoveryId: recoveryId,
      timestamp: new Date().toISOString(),
      originalError: error,
      recoveryType: recoveryType,
      strategies: strategies,
      status: 'attempting'
    };
    
    this.recoveryState.recoveryHistory.push(logEntry);
    console.log(`[Recovery ${recoveryId}] Attempting recovery for ${recoveryType}:`, logEntry);
  }

  /**
   * Log recovery success
   * @param {string} recoveryId - Recovery session ID
   * @param {string} strategy - Successful strategy
   * @param {Object} result - Recovery result
   */
  logRecoverySuccess(recoveryId, strategy, result) {
    const logEntry = {
      recoveryId: recoveryId,
      timestamp: new Date().toISOString(),
      strategy: strategy,
      result: result,
      status: 'success'
    };
    
    this.recoveryState.recoveryHistory.push(logEntry);
    console.log(`[Recovery ${recoveryId}] Success with strategy ${strategy}:`, logEntry);
  }

  /**
   * Log recovery failure
   * @param {string} recoveryId - Recovery session ID
   * @param {string} strategy - Failed strategy
   * @param {Object} error - Failure error
   */
  logRecoveryFailure(recoveryId, strategy, error) {
    const logEntry = {
      recoveryId: recoveryId,
      timestamp: new Date().toISOString(),
      strategy: strategy,
      error: error,
      status: 'failed'
    };
    
    this.recoveryState.recoveryHistory.push(logEntry);
    console.warn(`[Recovery ${recoveryId}] Failed strategy ${strategy}:`, logEntry);
  }

  /**
   * Generate unique recovery ID
   * @returns {string} Recovery session ID
   */
  generateRecoveryId() {
    return `recovery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sleep utility
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise} Sleep promise
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get recovery statistics
   * @returns {Object} Recovery statistics
   */
  getRecoveryStats() {
    const history = this.recoveryState.recoveryHistory;
    const successful = history.filter(entry => entry.status === 'success');
    const failed = history.filter(entry => entry.status === 'failed');
    
    return {
      totalRecoveries: history.length,
      successfulRecoveries: successful.length,
      failedRecoveries: failed.length,
      successRate: history.length > 0 ? (successful.length / history.length) * 100 : 0,
      isCurrentlyRecovering: this.recoveryState.isRecovering,
      currentAttempt: this.recoveryState.currentAttempt
    };
  }

  /**
   * Clear recovery history
   * @param {number} olderThanHours - Clear entries older than specified hours
   */
  clearRecoveryHistory(olderThanHours = 24) {
    const cutoffTime = Date.now() - (olderThanHours * 60 * 60 * 1000);
    this.recoveryState.recoveryHistory = this.recoveryState.recoveryHistory.filter(
      entry => new Date(entry.timestamp).getTime() > cutoffTime
    );
  }

  /**
   * Destroy recovery system and cleanup
   */
  destroy() {
    this.hideRecoveryProgress();
    this.recoveryState = {
      isRecovering: false,
      currentAttempt: 0,
      failedOperations: new Set(),
      partialData: new Map(),
      recoveryHistory: []
    };
    console.log('MapErrorRecovery destroyed');
  }
}

// Create global instance
window.mapErrorRecovery = new MapErrorRecovery({
  useErrorManager: true,
  useInputValidator: true,
  showRecoveryProgress: true,
  enablePartialRouteRendering: true,
  enableSimplifiedRendering: true,
  enableProgressiveLoading: true
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MapErrorRecovery;
}