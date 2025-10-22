/**
 * MapboxRoutes.js - Route Rendering and Animation Management
 * 
 * Handles:
 * - Route rendering from GeoJSON data
 * - Route animation and playback controls
 * - Start/end markers and waypoints
 * - Activity-based route styling
 * - Route statistics and elevation profiles
 * - Layer management and z-ordering
 * 
 * Dependencies:
 * - MapboxCore (for map instance access)
 * - MapboxEventSystem (for animation events)
 */

class MapboxRoutes {
  constructor(core, eventSystem, options = {}) {
    this.core = core;
    this.eventSystem = eventSystem;
    this.map = null; // Will be set when core is initialized
    
    // Route state management
    this.routeLayer = null;
    this.markersLayer = null;
    this.waypointMarkers = [];
    
    // Route animation state
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

    // Route statistics
    this.routeStats = {
      distance: 0,
      duration: 0,
      elevationGain: 0,
      waypoints: []
    };

    // Route controls UI
    this.routeControls = null;

    // Default options
    this.options = {
      routeColor: '#FF4444',
      routeWidth: 3,
      enableAnimation: true,
      animationDuration: 5000,
      animationSpeed: 1.0,
      showRouteStats: true,
      showWaypoints: false,
      waypointInterval: 1000,
      elevationProfile: false,
      showStartEndMarkers: true,
      ...options
    };

    // Layer z-index management
    this.layerZIndex = {
      route: 100,
      routeAnimated: 101,
      elevation: 99,
      markers: 102,
      waypoints: 103
    };

    // Poster-fit tracking (for camera capture alignment fix)
    this.posterFitInProgress = false;
    this.lastPosterFitTimestamp = 0;
    this.posterFitResolvers = []; // Queue of promises waiting for poster-fit completion
    this.currentPosterBounds = null; // Store current poster bounds for export

    // Bind methods
    this.renderRouteMap = this.renderRouteMap.bind(this);
    this.clearRoute = this.clearRoute.bind(this);
    this.startRouteAnimation = this.startRouteAnimation.bind(this);
    this.pauseRouteAnimation = this.pauseRouteAnimation.bind(this);
    this.stopRouteAnimation = this.stopRouteAnimation.bind(this);
    this.animateRoute = this.animateRoute.bind(this);
    this.cleanup = this.cleanup.bind(this);
  }

  /**
   * Initialize route functionality
   * @param {mapboxgl.Map} map - Map instance
   */
  init(map) {
    this.map = map;
    
    console.log('MapboxRoutes: Route functionality initialized');
    return this;
  }

  /**
   * Main method to render route on map
   * @param {Object} routeData - GeoJSON route data
   * @param {Object} customization - Route customization options
   * @param {Object} stats - Route statistics
   */
  async renderRouteMap(routeData, customization = {}, stats = {}) {
    if (!this.map) {
      throw new Error('MapboxRoutes: Map not initialized');
    }

    try {
      console.log('MapboxRoutes: Starting route rendering...', routeData);

      // Clear existing route
      this.clearRoute();

      // Extract and validate coordinates
      const coordinates = this.extractCoordinates(routeData);
      
      if (coordinates.length === 0) {
        throw new Error('No valid coordinates found in route data');
      }

      // Store coordinates for animation
      this.routeAnimation.coordinates = coordinates;
      
      // Store route statistics
      this.routeStats = {
        distance: stats.distance || this.calculateDistance(coordinates),
        duration: stats.duration || 0,
        elevationGain: stats.elevationGain || 0,
        waypoints: stats.waypoints || []
      };

      console.log(`MapboxRoutes: Valid coordinates: ${coordinates.length}`);

      // Add route source
      this.addRouteSource(routeData);

      // Add route layers with proper styling
      this.addRouteLayers(customization);

      // Add route markers if enabled
      if (this.options.showStartEndMarkers && customization.showStartEndMarkers !== false) {
        this.addStartEndMarkers(coordinates);
      }

      // Add waypoint markers if enabled
      if (this.options.showWaypoints && customization.showWaypoints === true) {
        this.addWaypointMarkers(coordinates);
      }

      // Fit map to route bounds with poster framing
      // TODO: Get format and orientation from map options or configuration
      const format = customization.format || 'A4';
      const orientation = customization.orientation || 'portrait';
      this.fitMapToRoute(coordinates, format, orientation);

      // Add route statistics overlay if enabled
      if (this.options.showRouteStats) {
        this.addRouteStatsOverlay();
      }

      // Add animation controls if enabled
      if (this.options.enableAnimation) {
        this.addRouteAnimationControls();
      }

      // Emit route rendered event
      if (this.eventSystem) {
        this.eventSystem.emit('route-rendered', {
          coordinates: coordinates.length,
          distance: this.routeStats.distance,
          timestamp: Date.now()
        });
      }

      console.log('MapboxRoutes: Route rendering completed successfully');

    } catch (error) {
      console.error('MapboxRoutes: Route rendering failed:', error);
      throw error;
    }
  }

  /**
   * Extract coordinates from route data
   * @param {Object} routeData - GeoJSON route data
   * @returns {Array} Array of coordinate pairs
   */
  extractCoordinates(routeData) {
    console.log('MapboxRoutes: Extracting coordinates from route data');
    
    let coordinates = [];

    try {
      if (routeData.geometry && routeData.geometry.coordinates) {
        // Single feature
        console.log('MapboxRoutes: Using geometry.coordinates path');
        coordinates = routeData.geometry.coordinates;
      } else if (routeData.features && Array.isArray(routeData.features)) {
        // Feature collection
        console.log('MapboxRoutes: Using features path');
        routeData.features.forEach(feature => {
          if (feature.geometry && feature.geometry.coordinates) {
            coordinates.push(...feature.geometry.coordinates);
          }
        });
      } else if (routeData.coordinates && Array.isArray(routeData.coordinates)) {
        // Direct coordinates property (our case)
        console.log('MapboxRoutes: Using routeData.coordinates path');
        coordinates = routeData.coordinates;
      } else if (Array.isArray(routeData)) {
        // Direct coordinates array
        console.log('MapboxRoutes: Using direct array path');
        coordinates = routeData;
      }

      console.log(`MapboxRoutes: Found ${coordinates.length} raw coordinates`);
      
      const validCoordinates = coordinates.filter(coord => {
        if (!Array.isArray(coord) || coord.length < 2) {
          return false;
        }
        const lng = coord[0], lat = coord[1];  // Already [lng, lat] format
        return !isNaN(lat) && !isNaN(lng) && 
               lat >= -90 && lat <= 90 && 
               lng >= -180 && lng <= 180;
      });
      
      console.log(`MapboxRoutes: Validated ${validCoordinates.length} coordinates`);
      
      if (validCoordinates.length > 0) {
        const sample = validCoordinates[0];
        console.log(`MapboxRoutes: Sample coordinate [lng, lat]: [${sample[0]}, ${sample[1]}]`);
      }
      
      return validCoordinates;

    } catch (error) {
      console.error('MapboxRoutes: Error extracting coordinates:', error);
      return [];
    }
  }

  /**
   * Add route source to map
   * @param {Object} routeData - GeoJSON route data
   */
  addRouteSource(routeData) {
    console.log('MapboxRoutes: Adding route source to map');
    
    // Extract coordinates and create proper GeoJSON
    const coordinates = this.extractCoordinates(routeData);
    
    if (coordinates.length === 0) {
      throw new Error('No valid coordinates found in route data');
    }
    
    // Create proper GeoJSON Feature
    const geoJsonData = {
      type: 'Feature',
      properties: {
        title: routeData.title || 'Route',
        distance: routeData.stats?.distance || 0
      },
      geometry: {
        type: 'LineString',
        coordinates: coordinates // Already in [lng, lat] format from extractCoordinates
      }
    };
    
    console.log(`MapboxRoutes: Created GeoJSON with ${coordinates.length} coordinates`);
    
    if (this.map.getSource('route')) {
      console.log('MapboxRoutes: Updating existing route source');
      this.map.getSource('route').setData(geoJsonData);
    } else {
      console.log('MapboxRoutes: Creating new route source');
      this.map.addSource('route', {
        type: 'geojson',
        data: geoJsonData,
        lineMetrics: true // Enable line metrics for gradient effects
      });
    }

    // Add animated route source for animation
    if (!this.map.getSource('route-animated')) {
      this.map.addSource('route-animated', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: []
          }
        },
        lineMetrics: true
      });
    }
  }

  /**
   * Add route layers with styling
   * @param {Object} customization - Route customization options
   */
  addRouteLayers(customization = {}) {
    console.log('MapboxRoutes: Adding route layers with customization:', customization);
    
    // Use actual customization values - NO DEBUG OVERRIDES
    const routeColor = customization.routeColor || this.options.routeColor;
    const routeWidth = customization.routeWidth || this.options.routeWidth;
    console.log('MapboxRoutes: Using route styling - color:', routeColor, 'width:', routeWidth);

    // Main route layer with user customization
    if (!this.map.getLayer('route-line')) {
      console.log('MapboxRoutes: Creating route-line layer with user customization');
      
      this.map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': routeColor,      // Use ACTUAL user color
          'line-width': routeWidth,      // Use ACTUAL user width  
          'line-opacity': 1.0
        }
      });
      
      console.log('MapboxRoutes: Route layer added with user styling');
    } else {
      // Update existing layer with new styling
      this.map.setPaintProperty('route-line', 'line-color', routeColor);
      this.map.setPaintProperty('route-line', 'line-width', routeWidth);
      console.log('MapboxRoutes: Updated existing route layer styling');
    }

    // Animated route layer (for animation) with complementary styling
    if (!this.map.getLayer('route-animated')) {
      // Use a slightly brighter version of the route color for animation
      const animatedColor = this.getBrighterColor(routeColor);
      
      this.map.addLayer({
        id: 'route-animated',
        type: 'line',
        source: 'route-animated',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': animatedColor,
          'line-width': Math.max(routeWidth + 1, 4), // Slightly wider for animation
          'line-opacity': 0.8
        }
      });
      
      console.log('MapboxRoutes: Animated route layer added');
    } else {
      // Update existing animated layer
      const animatedColor = this.getBrighterColor(routeColor);
      this.map.setPaintProperty('route-animated', 'line-color', animatedColor);
      this.map.setPaintProperty('route-animated', 'line-width', Math.max(routeWidth + 1, 4));
      console.log('MapboxRoutes: Updated existing animated route layer styling');
    }
  }

  /**
   * Get a brighter version of a hex color for animation effects
   * @param {string} hexColor - Original hex color
   * @returns {string} Brighter hex color
   */
  getBrighterColor(hexColor) {
    // Default fallback if parsing fails
    if (!hexColor || typeof hexColor !== 'string') {
      return '#FF6666'; // Light red fallback
    }

    try {
      // Remove # if present
      const hex = hexColor.replace('#', '');
      
      // Parse RGB components
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      
      // Brighten by adding 40 to each component (capped at 255)
      const newR = Math.min(255, r + 40);
      const newG = Math.min(255, g + 40);
      const newB = Math.min(255, b + 40);
      
      // Convert back to hex
      const toHex = (n) => {
        const hex = n.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      };
      
      return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
    } catch (error) {
      console.warn('MapboxRoutes: Error brightening color', hexColor, error);
      return '#FF6666'; // Light red fallback
    }
  }

  /**
   * Add layer with proper z-ordering
   * @param {Object} layerConfig - Layer configuration
   * @param {number} zIndex - Z-index for layer ordering
   * @param {string} beforeLayerId - ID of layer to insert before
   */
  addRouteLayerWithZOrder(layerConfig, zIndex, beforeLayerId = null) {
    if (!this.map || !layerConfig) return;
    
    // Add zIndex to metadata
    layerConfig.metadata = layerConfig.metadata || {};
    layerConfig.metadata.zIndex = zIndex;
    
    try {
      if (beforeLayerId && this.map.getLayer(beforeLayerId)) {
        this.map.addLayer(layerConfig, beforeLayerId);
      } else {
        this.map.addLayer(layerConfig);
      }
      
      console.log(`MapboxRoutes: Added layer ${layerConfig.id} with z-index ${zIndex}`);
    } catch (error) {
      console.warn(`MapboxRoutes: Could not add layer ${layerConfig.id}:`, error);
    }
  }

  /**
   * Add start and end markers
   * @param {Array} coordinates - Route coordinates (already in [lng, lat] format)
   */
  addStartEndMarkers(coordinates) {
    if (coordinates.length < 2) return;

    const startCoord = coordinates[0];
    const endCoord = coordinates[coordinates.length - 1];

    // Start marker - coordinates are already [lng, lat] format
    const startMarker = new mapboxgl.Marker({ color: '#00FF00' })
      .setLngLat(startCoord)
      .setPopup(new mapboxgl.Popup().setHTML('<strong>Start</strong>'))
      .addTo(this.map);

    // End marker - coordinates are already [lng, lat] format
    const endMarker = new mapboxgl.Marker({ color: '#FF0000' })
      .setLngLat(endCoord)
      .setPopup(new mapboxgl.Popup().setHTML('<strong>Finish</strong>'))
      .addTo(this.map);

    // Store markers for cleanup
    this.waypointMarkers.push(startMarker, endMarker);

    console.log('MapboxRoutes: Start/end markers added');
  }

  /**
   * Add waypoint markers along route
   * @param {Array} coordinates - Route coordinates (already in [lng, lat] format)
   */
  addWaypointMarkers(coordinates) {
    if (!this.options.showWaypoints || coordinates.length < 3) return;

    const interval = Math.floor(coordinates.length / 10); // 10 waypoints max
    
    for (let i = interval; i < coordinates.length - interval; i += interval) {
      const coord = coordinates[i];
      const marker = new mapboxgl.Marker({ color: '#0066FF', scale: 0.7 })
        .setLngLat(coord) // coordinates are already [lng, lat] format
        .addTo(this.map);
      
      this.waypointMarkers.push(marker);
    }

    console.log(`MapboxRoutes: Added ${this.waypointMarkers.length - 2} waypoint markers`);
  }

  /**
   * Calculate poster bounds that center the route within the poster aspect ratio
   * @param {Object} routeBounds - Route bounds object
   * @param {string} format - Print format (A4, A3, etc.)
   * @param {string} orientation - Portrait or landscape
   * @param {number} marginPercent - Margin percentage (default: 15%)
   * @returns {mapboxgl.LngLatBounds} Expanded bounds for poster framing
   */
  calculatePosterBounds(routeBounds, format = 'A4', orientation = 'portrait', marginPercent = 15) {
    // Poster aspect ratios (width/height)
    const posterAspectRatios = {
      'A4': { portrait: 2480/3508, landscape: 3508/2480 },
      'A3': { portrait: 3508/4961, landscape: 4961/3508 }
    };
    
    const posterAspectRatio = posterAspectRatios[format] ? 
      posterAspectRatios[format][orientation] : 
      posterAspectRatios.A4.portrait;
    
    // Get route bounds data
    const sw = routeBounds.getSouthWest();
    const ne = routeBounds.getNorthEast();
    
    // Calculate route center and extent
    const routeCenter = {
      lat: (ne.lat + sw.lat) / 2,
      lng: (ne.lng + sw.lng) / 2
    };
    
    const routeExtent = {
      latSpan: Math.abs(ne.lat - sw.lat),
      lngSpan: Math.abs(ne.lng - sw.lng)
    };
    
    // Calculate current route aspect ratio (lng/lat)
    const routeAspectRatio = routeExtent.lngSpan / routeExtent.latSpan;
    
    console.log(`MapboxRoutes: Route aspect ratio: ${routeAspectRatio.toFixed(3)}, Poster aspect ratio: ${posterAspectRatio.toFixed(3)}`);
    
    // Determine which dimension needs to be expanded to match poster aspect ratio
    let finalLngSpan, finalLatSpan;
    
    if (routeAspectRatio > posterAspectRatio) {
      // Route is wider than poster ratio - expand latitude
      finalLngSpan = routeExtent.lngSpan;
      finalLatSpan = finalLngSpan / posterAspectRatio;
    } else {
      // Route is taller than poster ratio - expand longitude  
      finalLatSpan = routeExtent.latSpan;
      finalLngSpan = finalLatSpan * posterAspectRatio;
    }
    
    // Apply margin padding (expand further by marginPercent)
    const marginMultiplier = 1 + (marginPercent / 100);
    finalLngSpan *= marginMultiplier;
    finalLatSpan *= marginMultiplier;
    
    // Calculate final poster bounds centered on route
    const posterSW = [
      routeCenter.lng - (finalLngSpan / 2), // west
      routeCenter.lat - (finalLatSpan / 2)  // south
    ];
    const posterNE = [
      routeCenter.lng + (finalLngSpan / 2), // east
      routeCenter.lat + (finalLatSpan / 2)  // north
    ];
    
    console.log(`MapboxRoutes: Original route bounds: SW[${sw.lng.toFixed(4)}, ${sw.lat.toFixed(4)}] NE[${ne.lng.toFixed(4)}, ${ne.lat.toFixed(4)}]`);
    console.log(`MapboxRoutes: Calculated poster bounds: SW[${posterSW[0].toFixed(4)}, ${posterSW[1].toFixed(4)}] NE[${posterNE[0].toFixed(4)}, ${posterNE[1].toFixed(4)}]`);
    console.log(`MapboxRoutes: Expansion - Lng: ${(finalLngSpan / routeExtent.lngSpan).toFixed(2)}x, Lat: ${(finalLatSpan / routeExtent.latSpan).toFixed(2)}x`);
    
    return new mapboxgl.LngLatBounds(posterSW, posterNE);
  }

  /**
   * Fit map to route bounds using poster-aware framing
   * @param {Array} coordinates - Route coordinates (already in [lng, lat] format)
   * @param {string} format - Print format for poster bounds calculation
   * @param {string} orientation - Print orientation for poster bounds calculation
   */
  fitMapToRoute(coordinates, format = 'A4', orientation = 'portrait') {
    if (coordinates.length === 0) return;

    try {
      // Mark poster fit as in progress
      this.posterFitInProgress = true;

      // Calculate tight route bounds first
      const routeBounds = coordinates.reduce((bounds, coord) => {
        return bounds.extend(coord); // coordinates are already [lng, lat] format
      }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));

      // Calculate poster bounds for proper framing
      const posterBounds = this.calculatePosterBounds(routeBounds, format, orientation, 15);

      // Store poster bounds for export/camera capture
      this.currentPosterBounds = posterBounds;
      this.lastPosterFitTimestamp = Date.now();

      // Also store in global for backward compatibility
      if (typeof window !== 'undefined') {
        window.__MAPBOX_ROUTES__ = window.__MAPBOX_ROUTES__ || {};
        window.__MAPBOX_ROUTES__.currentPosterBounds = posterBounds;
      }

      // Emit poster-fit-started event
      if (this.eventSystem) {
        this.eventSystem.emit('poster-fit-started', {
          format,
          orientation,
          timestamp: Date.now()
        });
      }

      // Track completion of all fit operations
      let fitsCompleted = 0;
      const totalFitsExpected = 1; // We'll increment this if we wait for styledata

      const onPosterFitComplete = () => {
        fitsCompleted++;
        console.log(`MapboxRoutes: Poster fit operation completed (${fitsCompleted}/${totalFitsExpected})`);

        // All fits complete - emit event and resolve promises
        if (fitsCompleted >= totalFitsExpected) {
          this.posterFitInProgress = false;

          // Emit poster-fit-complete event
          if (this.eventSystem) {
            this.eventSystem.emit('poster-fit-complete', {
              format,
              orientation,
              posterBounds: this.currentPosterBounds,
              timestamp: Date.now()
            });
          }

          // Resolve all waiting promises
          this.posterFitResolvers.forEach(resolver => {
            try {
              resolver.resolve();
            } catch (error) {
              console.warn('MapboxRoutes: Error resolving poster fit promise:', error);
            }
          });
          this.posterFitResolvers = []; // Clear the queue

          console.log('MapboxRoutes: All poster fit operations complete');
        }
      };

      const fitBoundsWithPosterFraming = () => {
        console.log('MapboxRoutes: Fitting map to poster bounds for proper framing');

        // Define padding for fitBounds
        const fitPadding = 20; // Minimal padding since bounds are already expanded

        this.map.fitBounds(posterBounds, {
          padding: fitPadding,
          duration: 1000
        });

        // 🎥 CRITICAL: Store padding in window.__MAPBOX_ROUTES__ for camera capture
        if (typeof window !== 'undefined') {
          window.__MAPBOX_ROUTES__ = window.__MAPBOX_ROUTES__ || {};
          window.__MAPBOX_ROUTES__.currentFitPadding = {
            top: fitPadding,
            right: fitPadding,
            bottom: fitPadding,
            left: fitPadding
          };
          console.log('🎯 [MapboxRoutes] Stored currentFitPadding in window.__MAPBOX_ROUTES__:', window.__MAPBOX_ROUTES__.currentFitPadding);
        }

        // Wait for moveend event to ensure fit is complete
        this.map.once('moveend', () => {
          console.log('MapboxRoutes: Map fitted to poster bounds - moveend fired');

          // 🎥 Verify padding is still set after moveend
          if (typeof window !== 'undefined' && window.__MAPBOX_ROUTES__) {
            console.log('🎯 [MapboxRoutes] Verified currentFitPadding after moveend:', window.__MAPBOX_ROUTES__.currentFitPadding);
          }

          onPosterFitComplete();
        });
      };

      // Check if map style is loaded before fitting bounds
      if (this.map.isStyleLoaded()) {
        console.log('MapboxRoutes: Map style loaded, fitting poster bounds immediately');
        fitBoundsWithPosterFraming();
      } else {
        console.log('MapboxRoutes: Map style not loaded, waiting for styledata event');
        // Wait for style to load before fitting bounds
        const fitBoundsOnStyleLoad = () => {
          console.log('MapboxRoutes: Style loaded, now fitting poster bounds');
          fitBoundsWithPosterFraming();
        };

        // Listen for styledata event (fired when style is loaded)
        this.map.once('styledata', fitBoundsOnStyleLoad);

        // Fallback timeout in case styledata doesn't fire
        setTimeout(() => {
          this.map.off('styledata', fitBoundsOnStyleLoad);
          if (this.map.isStyleLoaded()) {
            console.log('MapboxRoutes: Fallback - fitting poster bounds after timeout');
            fitBoundsWithPosterFraming();
          } else {
            console.warn('MapboxRoutes: Style still not loaded after timeout, skipping bounds fit');
            // Still mark as complete to avoid blocking
            onPosterFitComplete();
          }
        }, 2000);
      }

    } catch (error) {
      console.warn('MapboxRoutes: Could not fit poster bounds:', error);
      // Mark as complete even on error to avoid blocking
      this.posterFitInProgress = false;

      // Emit error event
      if (this.eventSystem) {
        this.eventSystem.emit('poster-fit-error', {
          error: error.message,
          timestamp: Date.now()
        });
      }

      // Resolve waiting promises anyway
      this.posterFitResolvers.forEach(resolver => resolver.resolve());
      this.posterFitResolvers = [];
    }
  }

  /**
   * Calculate route distance
   * @param {Array} coordinates - Route coordinates (already in [lng, lat] format)
   * @returns {number} Distance in meters
   */
  calculateDistance(coordinates) {
    if (coordinates.length < 2) return 0;

    let totalDistance = 0;
    
    for (let i = 1; i < coordinates.length; i++) {
      const coord1 = coordinates[i - 1];
      const coord2 = coordinates[i];
      
      // Haversine formula - coordinates are [lng, lat]
      const R = 6371000; // Earth's radius in meters
      const lat1 = coord1[1] * Math.PI / 180; // coord[1] is lat
      const lat2 = coord2[1] * Math.PI / 180; // coord[1] is lat
      const deltaLat = (coord2[1] - coord1[1]) * Math.PI / 180;
      const deltaLng = (coord2[0] - coord1[0]) * Math.PI / 180;

      const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
                Math.cos(lat1) * Math.cos(lat2) *
                Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      totalDistance += R * c;
    }

    return totalDistance;
  }

  /**
   * Add route statistics overlay
   */
  addRouteStatsOverlay() {
    const statsElement = document.createElement('div');
    statsElement.id = 'route-stats-overlay';
    statsElement.style.cssText = `
      position: absolute;
      top: 10px;
      left: 10px;
      background: rgba(255, 255, 255, 0.9);
      padding: 10px;
      border-radius: 5px;
      font-size: 12px;
      z-index: 1000;
    `;

    const distance = (this.routeStats.distance / 1000).toFixed(1);
    const elevation = this.routeStats.elevationGain.toFixed(0);
    
    statsElement.innerHTML = `
      <strong>Route Stats</strong><br>
      Distance: ${distance} km<br>
      ${elevation > 0 ? `Elevation Gain: ${elevation}m<br>` : ''}
      Coordinates: ${this.routeAnimation.coordinates.length}
    `;

    document.body.appendChild(statsElement);
  }

  /**
   * Add route animation controls
   */
  addRouteAnimationControls() {
    const controlsElement = document.createElement('div');
    controlsElement.id = 'route-animation-controls';
    controlsElement.style.cssText = `
      position: absolute;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(255, 255, 255, 0.9);
      padding: 10px;
      border-radius: 5px;
      display: flex;
      align-items: center;
      gap: 10px;
      z-index: 1000;
    `;

    // Play/Pause button
    const playButton = document.createElement('button');
    playButton.innerHTML = '▶️';
    playButton.style.cssText = 'border: none; background: none; font-size: 20px; cursor: pointer;';
    
    const self = this;
    playButton.addEventListener('click', () => {
      if (self.routeAnimation.isPlaying) {
        self.pauseRouteAnimation();
        playButton.innerHTML = '▶️';
      } else {
        self.startRouteAnimation();
        playButton.innerHTML = '⏸️';
      }
    });

    // Progress bar
    const progressContainer = document.createElement('div');
    progressContainer.style.cssText = `
      width: 200px;
      height: 6px;
      background: #ddd;
      border-radius: 3px;
      overflow: hidden;
    `;

    const progressBar = document.createElement('div');
    progressBar.style.cssText = `
      width: 0%;
      height: 100%;
      background: #4CAF50;
      transition: width 0.1s ease;
    `;
    progressContainer.appendChild(progressBar);

    // Reset button
    const resetButton = document.createElement('button');
    resetButton.innerHTML = '⏹️';
    resetButton.style.cssText = 'border: none; background: none; font-size: 20px; cursor: pointer;';
    resetButton.addEventListener('click', () => {
      self.resetRouteAnimation();
      playButton.innerHTML = '▶️';
      progressBar.style.width = '0%';
    });

    controlsElement.appendChild(playButton);
    controlsElement.appendChild(progressContainer);
    controlsElement.appendChild(resetButton);

    document.body.appendChild(controlsElement);

    // Store references for updates
    this.routeControls = {
      element: controlsElement,
      playButton: playButton,
      progressBar: progressBar,
      updatePlayButton: (isPlaying) => {
        playButton.innerHTML = isPlaying ? '⏸️' : '▶️';
      },
      updateProgress: (progress) => {
        progressBar.style.width = `${progress * 100}%`;
      }
    };
  }

  /**
   * Start route animation
   */
  startRouteAnimation() {
    if (!this.routeAnimation.coordinates || this.routeAnimation.coordinates.length === 0) {
      console.warn('MapboxRoutes: No route coordinates available for animation');
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

    // Start animation loop
    this.animateRoute();

    // Emit animation started event
    if (this.eventSystem) {
      this.eventSystem.emit('route-animation-started', {
        duration: this.routeAnimation.duration,
        speed: this.options.animationSpeed,
        timestamp: Date.now()
      });
    }

    console.log('MapboxRoutes: Route animation started');
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

    // Emit animation paused event
    if (this.eventSystem) {
      this.eventSystem.emit('route-animation-paused', {
        progress: this.routeAnimation.progress,
        timestamp: Date.now()
      });
    }

    console.log('MapboxRoutes: Route animation paused');
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

    console.log('MapboxRoutes: Route animation stopped');
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

    console.log('MapboxRoutes: Route animation reset');
  }

  /**
   * Animation loop
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
          coordinates: animatedCoords // coordinates are already [lng, lat] format
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

      // Emit animation completed event
      if (this.eventSystem) {
        this.eventSystem.emit('route-animation-completed', {
          timestamp: Date.now()
        });
      }

      console.log('MapboxRoutes: Route animation completed');
    } else {
      this.routeAnimation.animationId = requestAnimationFrame(() => this.animateRoute());
    }
  }

  /**
   * Clear route from map
   */
  clearRoute() {
    console.log('MapboxRoutes: Clearing route...');

    // Stop any running animation
    this.stopRouteAnimation();

    // Remove route layers
    const layersToRemove = ['route-line', 'route-animated'];
    layersToRemove.forEach(layerId => {
      if (this.map.getLayer(layerId)) {
        console.log(`MapboxRoutes: Removing layer ${layerId}`);
        this.map.removeLayer(layerId);
      }
    });

    // Remove route sources
    const sourcesToRemove = ['route', 'route-animated'];
    sourcesToRemove.forEach(sourceId => {
      if (this.map.getSource(sourceId)) {
        this.map.removeSource(sourceId);
      }
    });

    // Remove markers
    this.waypointMarkers.forEach(marker => marker.remove());
    this.waypointMarkers = [];

    // Remove UI elements
    const statsElement = document.getElementById('route-stats-overlay');
    if (statsElement) statsElement.remove();

    const controlsElement = document.getElementById('route-animation-controls');
    if (controlsElement) controlsElement.remove();

    // Reset animation state
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

    // Reset route controls reference
    this.routeControls = null;

    console.log('MapboxRoutes: Route cleared successfully');
  }

  /**
   * Get current route state
   * @returns {Object} Route state information
   */
  getRouteState() {
    return {
      hasRoute: this.routeAnimation.coordinates.length > 0,
      animation: {
        isPlaying: this.routeAnimation.isPlaying,
        isPaused: this.routeAnimation.isPaused,
        progress: this.routeAnimation.progress,
        duration: this.routeAnimation.duration
      },
      stats: this.routeStats,
      coordinates: this.routeAnimation.coordinates.length
    };
  }

  /**
   * Restore route after style change
   * @param {Object} routeState - Stored route state to restore
   */
  async restoreRoute(routeState) {
    if (!routeState || !routeState.hasRoute || !routeState.coordinates) {
      console.log('MapboxRoutes: No valid route state to restore');
      return false;
    }

    if (!routeState.coordinates || routeState.coordinates.length === 0) {
      console.error('MapboxRoutes: Route state has no coordinate data');
      return false;
    }

    try {
      console.log('MapboxRoutes: Starting route restoration...', {
        coordinateCount: routeState.coordinates.length,
        hasCustomization: !!routeState.customization,
        captureTime: routeState.captureTimestamp ? new Date(routeState.captureTimestamp).toISOString() : 'unknown'
      });

      // Wait for map style to be fully loaded before attempting restoration
      await this.waitForStyleReady();

      // Clear any existing route layers/sources before restoration
      this.clearRoute();

      // Restore route animation coordinates and stats with validation
      this.routeAnimation.coordinates = [...routeState.coordinates]; // Deep copy
      this.routeStats = routeState.routeStats ? { ...routeState.routeStats } : this.routeStats;

      // Update options with stored customization
      if (routeState.customization) {
        Object.assign(this.options, routeState.customization);
        console.log('MapboxRoutes: Restored customization options', routeState.customization);
      }

      // Create route data object for rendering
      const routeData = {
        coordinates: routeState.coordinates,
        title: 'Restored Route',
        stats: routeState.routeStats || {},
        metadata: {
          isRestored: true,
          originalCaptureTime: routeState.captureTimestamp,
          restorationTime: Date.now()
        }
      };

      console.log('MapboxRoutes: Re-adding route source and layers...');

      // Add route source back to map
      this.addRouteSource(routeData);

      // Add route layers with stored customization
      this.addRouteLayers(routeState.customization || {});

      // Validate that layers were created successfully
      if (!this.map.getLayer('route-line')) {
        throw new Error('Route layer was not created successfully');
      }

      // Restore start/end markers if they were shown
      if (routeState.customization && routeState.customization.showStartEndMarkers !== false) {
        this.addStartEndMarkers(routeState.coordinates);
      }

      // Restore waypoint markers if they were shown
      if (routeState.customization && routeState.customization.showWaypoints === true) {
        this.addWaypointMarkers(routeState.coordinates);
      }

      // Restore animation state if needed
      if (routeState.animation) {
        this.routeAnimation.progress = routeState.animation.progress || 0;
        this.routeAnimation.duration = routeState.animation.duration || 5000;
        
        // If animation was playing, restart it
        if (routeState.animation.isPlaying) {
          setTimeout(() => this.startRouteAnimation(), 100);
        } else if (routeState.animation.isPaused) {
          // If animation was paused, start and then pause at the right point
          setTimeout(() => {
            this.startRouteAnimation();
            setTimeout(() => this.pauseRouteAnimation(), 200);
          }, 100);
        }
      }

      // Fit map to route bounds with poster framing
      const format = routeState.customization?.format || 'A4';
      const orientation = routeState.customization?.orientation || 'portrait';
      this.fitMapToRoute(routeState.coordinates, format, orientation);

      // Add route statistics overlay if enabled
      if (this.options.showRouteStats) {
        this.addRouteStatsOverlay();
      }

      // Add animation controls if enabled
      if (this.options.enableAnimation) {
        this.addRouteAnimationControls();
      }

      // Emit route restored event
      if (this.eventSystem) {
        this.eventSystem.emit('route-restored', {
          coordinates: routeState.coordinates.length,
          customization: routeState.customization,
          timestamp: Date.now(),
          restorationSuccess: true
        });
      }

      // Validate that restoration was successful
      const validation = this.validateRouteRestoration(routeState);
      
      if (!validation.success) {
        console.error('MapboxRoutes: Route restoration validation failed:', validation.errors);
        throw new Error(`Route restoration validation failed: ${validation.errors.join(', ')}`);
      }

      if (validation.warnings.length > 0) {
        console.warn('MapboxRoutes: Route restoration completed with warnings:', validation.warnings);
      }

      console.log('MapboxRoutes: Route restored and validated successfully');
      return true;

    } catch (error) {
      console.error('MapboxRoutes: Failed to restore route:', error);
      
      // Emit restoration failure event
      if (this.eventSystem) {
        this.eventSystem.emit('route-restoration-failed', {
          error: error.message,
          routeState: routeState,
          timestamp: Date.now()
        });
      }
      
      throw error;
    }
  }

  /**
   * Wait for map style to be fully ready for route restoration
   * @returns {Promise<void>}
   */
  async waitForStyleReady() {
    if (!this.map) {
      throw new Error('Map instance not available');
    }

    // If style is already loaded, return immediately
    if (this.map.isStyleLoaded()) {
      console.log('MapboxRoutes: Style already loaded, proceeding with restoration');
      return;
    }

    console.log('MapboxRoutes: Waiting for style to load before route restoration...');

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.map.off('styledata', onStyleData);
        reject(new Error('Style loading timeout after 10 seconds'));
      }, 10000);

      const onStyleData = () => {
        if (this.map.isStyleLoaded()) {
          clearTimeout(timeout);
          this.map.off('styledata', onStyleData);
          console.log('MapboxRoutes: Style loaded, ready for route restoration');
          resolve();
        }
      };

      this.map.on('styledata', onStyleData);
    });
  }

  /**
   * Validate that route restoration was successful
   * @param {Object} expectedState - Expected route state after restoration
   * @returns {Object} Validation result
   */
  validateRouteRestoration(expectedState) {
    const validation = {
      success: true,
      errors: [],
      warnings: [],
      details: {}
    };

    try {
      // Check if map exists
      if (!this.map) {
        validation.success = false;
        validation.errors.push('Map instance not available');
        return validation;
      }

      // Check if route layers exist
      const hasRouteLayer = this.map.getLayer('route-line');
      if (!hasRouteLayer) {
        validation.success = false;
        validation.errors.push('Route layer not found on map');
      } else {
        validation.details.layerExists = true;
      }

      // Check if route source exists and has data
      const routeSource = this.map.getSource('route');
      if (!routeSource) {
        validation.success = false;
        validation.errors.push('Route source not found on map');
      } else {
        const sourceData = routeSource._data;
        if (!sourceData || !sourceData.geometry || !sourceData.geometry.coordinates) {
          validation.success = false;
          validation.errors.push('Route source has no coordinate data');
        } else {
          const coordinateCount = sourceData.geometry.coordinates.length;
          validation.details.sourceCoordinateCount = coordinateCount;
          
          // Compare coordinate count with expected
          if (expectedState && expectedState.coordinates) {
            const expectedCount = expectedState.coordinates.length;
            if (coordinateCount !== expectedCount) {
              validation.warnings.push(`Coordinate count mismatch: expected ${expectedCount}, got ${coordinateCount}`);
            }
          }
        }
      }

      // Check if route coordinates were restored correctly
      if (expectedState && expectedState.coordinates) {
        const currentCoordinates = this.routeAnimation.coordinates;
        if (!currentCoordinates || currentCoordinates.length === 0) {
          validation.success = false;
          validation.errors.push('Route animation coordinates not restored');
        } else if (currentCoordinates.length !== expectedState.coordinates.length) {
          validation.warnings.push(`Animation coordinate count mismatch: expected ${expectedState.coordinates.length}, got ${currentCoordinates.length}`);
        }
        validation.details.animationCoordinateCount = currentCoordinates ? currentCoordinates.length : 0;
      }

      // Check if route styling was restored
      if (hasRouteLayer && expectedState && expectedState.customization) {
        const layer = this.map.getLayer('route-line');
        const currentColor = this.map.getPaintProperty('route-line', 'line-color');
        const currentWidth = this.map.getPaintProperty('route-line', 'line-width');
        
        validation.details.currentStyling = {
          color: currentColor,
          width: currentWidth
        };
        
        validation.details.expectedStyling = {
          color: expectedState.customization.routeColor,
          width: expectedState.customization.routeWidth
        };

        // Check color restoration with more flexible comparison
        if (expectedState.customization.routeColor) {
          const expectedColor = expectedState.customization.routeColor.toLowerCase();
          const actualColor = (currentColor || '').toLowerCase();
          
          if (actualColor !== expectedColor) {
            validation.warnings.push(`Route color not fully restored: expected ${expectedColor}, got ${actualColor}`);
            
            // Try to fix the color immediately
            try {
              this.map.setPaintProperty('route-line', 'line-color', expectedState.customization.routeColor);
              console.log('MapboxRoutes: Corrected route color during validation');
            } catch (error) {
              console.warn('MapboxRoutes: Failed to correct route color:', error);
            }
          }
        }

        // Check width restoration with numeric comparison
        if (expectedState.customization.routeWidth !== undefined) {
          const expectedWidth = Number(expectedState.customization.routeWidth);
          const actualWidth = Number(currentWidth);
          
          if (actualWidth !== expectedWidth) {
            validation.warnings.push(`Route width not fully restored: expected ${expectedWidth}, got ${actualWidth}`);
            
            // Try to fix the width immediately
            try {
              this.map.setPaintProperty('route-line', 'line-width', expectedWidth);
              console.log('MapboxRoutes: Corrected route width during validation');
            } catch (error) {
              console.warn('MapboxRoutes: Failed to correct route width:', error);
            }
          }
        }
      }

      // Check if markers were restored if expected
      if (expectedState && expectedState.customization && expectedState.customization.showStartEndMarkers) {
        const markerCount = this.waypointMarkers.length;
        validation.details.markerCount = markerCount;
        
        if (markerCount === 0) {
          validation.warnings.push('Expected start/end markers but none found');
        }
      }

      // Check if route stats were restored
      if (expectedState && expectedState.routeStats) {
        const statsMatch = this.routeStats.distance === expectedState.routeStats.distance;
        validation.details.statsRestored = statsMatch;
        
        if (!statsMatch) {
          validation.warnings.push('Route statistics may not have been fully restored');
        }
      }

      console.log('MapboxRoutes: Route restoration validation completed', validation);
      return validation;

    } catch (error) {
      validation.success = false;
      validation.errors.push(`Validation error: ${error.message}`);
      console.error('MapboxRoutes: Route restoration validation failed:', error);
      return validation;
    }
  }

  /**
   * Perform comprehensive route health check
   * @returns {Object} Health check result
   */
  performRouteHealthCheck() {
    const healthCheck = {
      healthy: true,
      issues: [],
      status: 'unknown',
      details: {}
    };

    try {
      // Check if we have a route
      const hasRoute = this.routeAnimation.coordinates && this.routeAnimation.coordinates.length > 0;
      if (!hasRoute) {
        healthCheck.status = 'no_route';
        healthCheck.details.hasRoute = false;
        return healthCheck;
      }

      healthCheck.details.hasRoute = true;
      healthCheck.details.coordinateCount = this.routeAnimation.coordinates.length;

      // Check map and layer health
      if (!this.map) {
        healthCheck.healthy = false;
        healthCheck.issues.push('Map instance not available');
      } else {
        // Check if map is loaded
        if (!this.map.loaded()) {
          healthCheck.healthy = false;
          healthCheck.issues.push('Map not fully loaded');
        }

        // Check style
        if (!this.map.isStyleLoaded()) {
          healthCheck.healthy = false;
          healthCheck.issues.push('Map style not loaded');
        }

        // Check route layers
        const hasRouteLayer = this.map.getLayer('route-line');
        const hasRouteSource = this.map.getSource('route');
        
        if (!hasRouteLayer) {
          healthCheck.healthy = false;
          healthCheck.issues.push('Route layer missing');
        }

        if (!hasRouteSource) {
          healthCheck.healthy = false;
          healthCheck.issues.push('Route source missing');
        }

        healthCheck.details.layerExists = !!hasRouteLayer;
        healthCheck.details.sourceExists = !!hasRouteSource;
      }

      // Determine overall status
      if (healthCheck.healthy) {
        healthCheck.status = 'healthy';
      } else if (healthCheck.issues.length > 0) {
        healthCheck.status = 'unhealthy';
      }

      return healthCheck;

    } catch (error) {
      healthCheck.healthy = false;
      healthCheck.status = 'error';
      healthCheck.issues.push(`Health check error: ${error.message}`);
      return healthCheck;
    }
  }

  /**
   * Update route styling
   * @param {Object} styling - New styling options
   */
  updateRouteStyle(styling) {
    if (!styling || !this.map) return;
    
    const { routeColor, routeWidth } = styling;

    // Update main route layer color
    if (routeColor && this.map.getLayer('route-line')) {
      this.map.setPaintProperty('route-line', 'line-color', routeColor);
      
      // Update animated layer color too
      if (this.map.getLayer('route-animated')) {
        const animatedColor = this.getBrighterColor(routeColor);
        this.map.setPaintProperty('route-animated', 'line-color', animatedColor);
      }
      
      // Update options for future use
      this.options.routeColor = routeColor;
    }

    // Update route width
    if (routeWidth !== undefined && this.map.getLayer('route-line')) {
      this.map.setPaintProperty('route-line', 'line-width', routeWidth);
      
      // Update animated layer width
      if (this.map.getLayer('route-animated')) {
        this.map.setPaintProperty('route-animated', 'line-width', Math.max(routeWidth + 1, 4));
      }
      
      // Update options for future use
      this.options.routeWidth = routeWidth;
    }

    console.log('MapboxRoutes: Route style updated successfully', styling);
  }

  /**
   * Wait for poster fit operations to complete
   * This ensures camera/bounds are captured after all poster-fit adjustments are done
   * @param {number} timeout - Maximum wait time in milliseconds (default: 6000ms)
   * @returns {Promise<void>} Resolves when poster fit is complete or timeout occurs
   */
  async waitForPosterFitComplete(timeout = 6000) {
    // If no poster fit in progress, resolve immediately
    if (!this.posterFitInProgress) {
      console.log('MapboxRoutes: No poster fit in progress, resolving immediately');
      return Promise.resolve();
    }

    console.log('MapboxRoutes: Waiting for poster fit to complete...');

    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeoutId = setTimeout(() => {
        // Remove this resolver from the queue
        const index = this.posterFitResolvers.findIndex(r => r.resolve === resolve);
        if (index !== -1) {
          this.posterFitResolvers.splice(index, 1);
        }

        console.warn('MapboxRoutes: Poster fit wait timed out after', timeout, 'ms');
        resolve(); // Resolve anyway to avoid blocking (don't reject)
      }, timeout);

      // Add to resolver queue
      this.posterFitResolvers.push({
        resolve: () => {
          clearTimeout(timeoutId);
          console.log('MapboxRoutes: Poster fit complete, resolving wait');
          resolve();
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          reject(error);
        }
      });
    });
  }

  /**
   * Get current poster bounds
   * @returns {mapboxgl.LngLatBounds|null} Current poster bounds or null if not available
   */
  getPosterBounds() {
    return this.currentPosterBounds;
  }

  /**
   * Clean up route functionality
   */
  cleanup() {
    console.log('MapboxRoutes: Starting cleanup...');
    
    // Clear route from map
    this.clearRoute();
    
    // Reset state
    this.map = null;
    this.routeLayer = null;
    this.markersLayer = null;
    this.routeStats = {
      distance: 0,
      duration: 0,
      elevationGain: 0,
      waypoints: []
    };
    
    console.log('MapboxRoutes: Cleanup completed');
  }
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MapboxRoutes;
} else if (typeof define === 'function' && define.amd) {
  define(function() { return MapboxRoutes; });
} else {
  window.MapboxRoutes = MapboxRoutes;
}