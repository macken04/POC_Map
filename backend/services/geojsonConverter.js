/**
 * GeoJSON Conversion Service
 * 
 * This service provides a unified interface for converting route data from various sources
 * (GPX, TCX, Strava polylines) into standardized GeoJSON format for map rendering.
 * 
 * FEATURES:
 * - Unified conversion interface for all route data types
 * - Comprehensive metadata handling (distance, elevation, activity type, etc.)
 * - Multi-segment route support with proper FeatureCollection structure
 * - GeoJSON specification validation
 * - Error handling and data validation
 * - Optimized output for Mapbox GL JS rendering
 * 
 * SUPPORTED INPUT FORMATS:
 * - GPX parsed data (from gpxTcxParser)
 * - TCX parsed data (from gpxTcxParser)
 * - Strava polyline data (from dataTransformers)
 * - Raw coordinate arrays
 * 
 * OUTPUT FORMAT:
 * - Standard GeoJSON FeatureCollection or Feature
 * - Enhanced properties for map styling
 * - Proper coordinate ordering [longitude, latitude]
 * - Bounds calculation and metadata
 */

const { calculateBounds, handleAntimeridianCrossing, handlePolarCoordinates } = require('../utils/dataTransformers');

class GeoJSONConverter {
  constructor() {
    this.supportedSources = ['gpx', 'tcx', 'strava_polyline', 'coordinates'];
    this.validationRules = {
      maxCoordinates: 50000, // Limit for performance
      minCoordinates: 2,     // Minimum for a valid line
      maxNameLength: 200,
      maxDescriptionLength: 1000
    };
  }

  /**
   * Convert route data to GeoJSON Feature or FeatureCollection
   * Main entry point for all conversions
   * 
   * @param {Object} routeData - Route data from various sources
   * @param {Object} options - Conversion options
   * @returns {Object} - GeoJSON Feature or FeatureCollection
   */
  async convertToGeoJSON(routeData, options = {}) {
    const {
      source = 'unknown',
      includeElevation = true,
      includeTimestamps = true,
      validateOutput = true,
      handleMultiSegment = true,
      optimizeForMapbox = true
    } = options;

    try {
      // Validate input data
      this.validateInputData(routeData, source);

      // Determine conversion method based on source
      let geoJSON;
      switch (source) {
        case 'gpx':
          geoJSON = this.convertFromGPXData(routeData, options);
          break;
        case 'tcx':
          geoJSON = this.convertFromTCXData(routeData, options);
          break;
        case 'strava_polyline':
          geoJSON = this.convertFromStravaData(routeData, options);
          break;
        case 'coordinates':
          geoJSON = this.convertFromCoordinates(routeData, options);
          break;
        default:
          // Try to auto-detect source type
          geoJSON = this.autoDetectAndConvert(routeData, options);
      }

      // Apply post-processing
      if (handleMultiSegment) {
        geoJSON = this.handleMultiSegmentRoutes(geoJSON, options);
      }

      if (optimizeForMapbox) {
        geoJSON = this.optimizeForMapbox(geoJSON, options);
      }

      // Validate output if requested
      if (validateOutput) {
        this.validateGeoJSON(geoJSON);
      }

      return geoJSON;

    } catch (error) {
      throw new Error(`GeoJSON conversion failed: ${error.message}`);
    }
  }

  /**
   * Convert GPX parsed data to GeoJSON
   * @param {Object} gpxData - Parsed GPX data
   * @param {Object} options - Conversion options
   * @returns {Object} - GeoJSON Feature
   */
  convertFromGPXData(gpxData, options = {}) {
    if (!gpxData.coordinates || !Array.isArray(gpxData.coordinates)) {
      throw new Error('Invalid GPX data: missing coordinates array');
    }

    const coordinates = this.normalizeCoordinates(gpxData.coordinates);
    
    const feature = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: coordinates
      },
      properties: {
        name: gpxData.name || 'GPX Route',
        description: gpxData.description || '',
        activityType: this.normalizeActivityType(gpxData.type || 'gpx'),
        source: 'gpx',
        
        // Distance and elevation metrics
        distance: gpxData.distance || this.calculateDistance(coordinates),
        elevationGain: gpxData.total_elevation_gain || 0,
        
        // Additional metadata
        hasElevation: Boolean(gpxData.elevation && gpxData.elevation.length > 0),
        hasTimestamps: Boolean(gpxData.timestamps && gpxData.timestamps.length > 0),
        totalPoints: coordinates.length,
        
        // Source-specific metadata
        format: 'gpx',
        filename: gpxData.metadata?.filename,
        created: gpxData.metadata?.created_at,
        
        // Calculate bounds
        bounds: calculateBounds(coordinates)
      }
    };

    // Add elevation profile if available
    if (gpxData.elevation && gpxData.elevation.length > 0 && options.includeElevation) {
      feature.properties.elevationProfile = this.processElevationData(gpxData.elevation);
      feature.properties.elevationStats = this.calculateElevationStats(gpxData.elevation);
    }

    // Add timestamps if available
    if (gpxData.timestamps && gpxData.timestamps.length > 0 && options.includeTimestamps) {
      feature.properties.timestamps = gpxData.timestamps;
      feature.properties.duration = this.calculateDuration(gpxData.timestamps);
    }

    return feature;
  }

  /**
   * Convert TCX parsed data to GeoJSON
   * @param {Object} tcxData - Parsed TCX data
   * @param {Object} options - Conversion options
   * @returns {Object} - GeoJSON Feature
   */
  convertFromTCXData(tcxData, options = {}) {
    if (!tcxData.coordinates || !Array.isArray(tcxData.coordinates)) {
      throw new Error('Invalid TCX data: missing coordinates array');
    }

    const coordinates = this.normalizeCoordinates(tcxData.coordinates);
    
    const feature = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: coordinates
      },
      properties: {
        name: tcxData.name || 'TCX Activity',
        description: tcxData.description || '',
        activityType: this.normalizeActivityType(tcxData.type || 'activity'),
        source: 'tcx',
        
        // Distance and elevation metrics
        distance: tcxData.distance || this.calculateDistance(coordinates),
        elevationGain: tcxData.total_elevation_gain || 0,
        
        // Additional metadata
        hasElevation: Boolean(tcxData.elevation && tcxData.elevation.length > 0),
        hasTimestamps: Boolean(tcxData.timestamps && tcxData.timestamps.length > 0),
        totalPoints: coordinates.length,
        
        // Source-specific metadata
        format: 'tcx',
        sport: tcxData.metadata?.sport,
        filename: tcxData.metadata?.filename,
        created: tcxData.metadata?.created_at,
        
        // Calculate bounds
        bounds: calculateBounds(coordinates)
      }
    };

    // Add elevation profile if available
    if (tcxData.elevation && tcxData.elevation.length > 0 && options.includeElevation) {
      feature.properties.elevationProfile = this.processElevationData(tcxData.elevation);
      feature.properties.elevationStats = this.calculateElevationStats(tcxData.elevation);
    }

    // Add timestamps if available
    if (tcxData.timestamps && tcxData.timestamps.length > 0 && options.includeTimestamps) {
      feature.properties.timestamps = tcxData.timestamps;
      feature.properties.duration = this.calculateDuration(tcxData.timestamps);
    }

    return feature;
  }

  /**
   * Convert Strava polyline/activity data to GeoJSON
   * @param {Object} stravaData - Strava activity or polyline data
   * @param {Object} options - Conversion options
   * @returns {Object} - GeoJSON Feature
   */
  convertFromStravaData(stravaData, options = {}) {
    let coordinates;
    
    // Handle different Strava data formats
    if (stravaData.coordinates) {
      coordinates = stravaData.coordinates;
    } else if (stravaData.geometry && stravaData.geometry.coordinates) {
      coordinates = stravaData.geometry.coordinates;
    } else if (stravaData.map && stravaData.map.coordinates) {
      coordinates = stravaData.map.coordinates;
    } else {
      throw new Error('Invalid Strava data: no coordinate data found');
    }

    coordinates = this.normalizeCoordinates(coordinates);

    const feature = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: coordinates
      },
      properties: {
        name: stravaData.name || stravaData.activity_name || 'Strava Activity',
        description: stravaData.description || '',
        activityType: this.normalizeActivityType(stravaData.type || stravaData.activity_type || 'activity'),
        source: 'strava',
        
        // Strava-specific IDs
        activityId: stravaData.id || stravaData.activity_id,
        
        // Distance and elevation metrics
        distance: stravaData.distance || this.calculateDistance(coordinates),
        elevationGain: stravaData.total_elevation_gain || stravaData.elevation_gain || 0,
        
        // Additional metadata
        hasElevation: Boolean(stravaData.elevation_profile || stravaData.has_altitude_data),
        hasTimestamps: Boolean(stravaData.time_series || stravaData.has_time_data),
        totalPoints: coordinates.length,
        
        // Strava-specific metadata
        averageSpeed: stravaData.average_speed,
        maxSpeed: stravaData.max_speed,
        movingTime: stravaData.moving_time,
        elapsedTime: stravaData.elapsed_time,
        
        // Calculate bounds
        bounds: stravaData.bounds || calculateBounds(coordinates)
      }
    };

    // Add elevation profile if available
    if (stravaData.elevation_profile && options.includeElevation) {
      feature.properties.elevationProfile = stravaData.elevation_profile;
      feature.properties.elevationStats = this.calculateElevationStats(stravaData.elevation_profile);
    }

    // Add time series if available
    if (stravaData.time_series && options.includeTimestamps) {
      feature.properties.timeSeries = stravaData.time_series;
      feature.properties.duration = stravaData.elapsed_time || stravaData.moving_time;
    }

    return feature;
  }

  /**
   * Convert raw coordinates array to GeoJSON
   * @param {Array} coordinatesData - Raw coordinates or data containing coordinates
   * @param {Object} options - Conversion options
   * @returns {Object} - GeoJSON Feature
   */
  convertFromCoordinates(coordinatesData, options = {}) {
    let coordinates;
    
    // Handle different coordinate formats
    if (Array.isArray(coordinatesData)) {
      coordinates = coordinatesData;
    } else if (coordinatesData.coordinates) {
      coordinates = coordinatesData.coordinates;
    } else {
      throw new Error('Invalid coordinate data: expected array or object with coordinates property');
    }

    coordinates = this.normalizeCoordinates(coordinates);

    const feature = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: coordinates
      },
      properties: {
        name: coordinatesData.name || options.name || 'Route',
        description: coordinatesData.description || options.description || '',
        activityType: this.normalizeActivityType(coordinatesData.type || options.activityType || 'route'),
        source: 'coordinates',
        
        // Basic metrics
        distance: this.calculateDistance(coordinates),
        totalPoints: coordinates.length,
        
        // Calculate bounds
        bounds: calculateBounds(coordinates)
      }
    };

    return feature;
  }

  /**
   * Auto-detect source type and convert
   * @param {Object} routeData - Route data of unknown type
   * @param {Object} options - Conversion options
   * @returns {Object} - GeoJSON Feature
   */
  autoDetectAndConvert(routeData, options = {}) {
    // Try to detect source type from data structure
    if (routeData.format === 'gpx' || routeData.source === 'gpx_upload') {
      return this.convertFromGPXData(routeData, options);
    }
    
    if (routeData.format === 'tcx' || routeData.source === 'tcx_upload') {
      return this.convertFromTCXData(routeData, options);
    }
    
    if (routeData.activity_id || routeData.map || routeData.polyline) {
      return this.convertFromStravaData(routeData, { ...options, source: 'strava_polyline' });
    }
    
    if (Array.isArray(routeData) || routeData.coordinates) {
      return this.convertFromCoordinates(routeData, { ...options, source: 'coordinates' });
    }

    throw new Error('Unable to auto-detect route data type');
  }

  /**
   * Handle multi-segment routes by creating FeatureCollection
   * @param {Object} geoJSON - Single Feature GeoJSON
   * @param {Object} options - Processing options
   * @returns {Object} - FeatureCollection if multi-segment, otherwise Feature
   */
  handleMultiSegmentRoutes(geoJSON, options = {}) {
    if (geoJSON.type !== 'Feature' || geoJSON.geometry.type !== 'LineString') {
      return geoJSON;
    }

    const coordinates = geoJSON.geometry.coordinates;
    const segments = handleAntimeridianCrossing(coordinates);

    if (segments.length <= 1) {
      return geoJSON; // Single segment, return as-is
    }

    // Create FeatureCollection for multi-segment route
    const features = segments.map((segmentCoords, index) => ({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: segmentCoords
      },
      properties: {
        ...geoJSON.properties,
        segmentIndex: index,
        segmentDistance: this.calculateDistance(segmentCoords),
        totalSegments: segments.length
      }
    }));

    return {
      type: 'FeatureCollection',
      features: features,
      properties: {
        ...geoJSON.properties,
        isMultiSegment: true,
        totalSegments: segments.length,
        totalDistance: features.reduce((sum, f) => sum + f.properties.segmentDistance, 0)
      }
    };
  }

  /**
   * Optimize GeoJSON for Mapbox GL JS rendering
   * @param {Object} geoJSON - GeoJSON object
   * @param {Object} options - Optimization options
   * @returns {Object} - Optimized GeoJSON
   */
  optimizeForMapbox(geoJSON, options = {}) {
    const {
      simplifyCoordinates = false,
      toleranceMeters = 1.0,
      addStyleHints = true
    } = options;

    // Handle both Feature and FeatureCollection
    const features = geoJSON.type === 'FeatureCollection' ? geoJSON.features : [geoJSON];

    const optimizedFeatures = features.map(feature => {
      let coordinates = feature.geometry.coordinates;

      // Handle polar coordinates for better Mapbox compatibility
      coordinates = handlePolarCoordinates(coordinates, {
        clampToMercatorLimits: true
      });

      // Add style hints for Mapbox rendering
      if (addStyleHints) {
        feature.properties = {
          ...feature.properties,
          // Style hints based on activity type
          lineColor: this.getActivityColor(feature.properties.activityType),
          lineWidth: this.getActivityLineWidth(feature.properties.distance || 0),
          lineOpacity: 0.8,
          // Performance hints
          renderOrder: this.getActivityRenderOrder(feature.properties.activityType)
        };
      }

      return {
        ...feature,
        geometry: {
          ...feature.geometry,
          coordinates: coordinates
        }
      };
    });

    if (geoJSON.type === 'FeatureCollection') {
      return {
        ...geoJSON,
        features: optimizedFeatures
      };
    } else {
      return optimizedFeatures[0];
    }
  }

  /**
   * Normalize coordinates to [longitude, latitude] format
   * @param {Array} coordinates - Input coordinates in various formats
   * @returns {Array} - Normalized coordinates [lng, lat]
   */
  normalizeCoordinates(coordinates) {
    if (!Array.isArray(coordinates)) {
      throw new Error('Invalid coordinates: expected array');
    }

    return coordinates.map((coord, index) => {
      if (!Array.isArray(coord) || coord.length < 2) {
        throw new Error(`Invalid coordinate at index ${index}: expected [lat, lng] or [lng, lat] array`);
      }

      let [first, second] = coord;

      // Validate that both values are numbers
      if (typeof first !== 'number' || typeof second !== 'number' || isNaN(first) || isNaN(second)) {
        throw new Error(`Invalid coordinate at index ${index}: expected numeric values, got [${typeof first}, ${typeof second}]`);
      }

      // Auto-detect coordinate order based on typical ranges:
      // Latitude: -90 to 90, Longitude: -180 to 180
      
      // Case 1: First value is clearly longitude (outside lat range) and second is latitude
      if (Math.abs(first) > 90 && Math.abs(second) <= 90) {
        // Already in [lng, lat] format
        return [first, second];
      }
      
      // Case 2: First value is in lat range and second is clearly longitude (outside lat range)  
      if (Math.abs(first) <= 90 && Math.abs(second) > 90) {
        // In [lat, lng] format, convert to [lng, lat]
        return [second, first];
      }
      
      // Case 3: Both values are in latitude range (-90 to 90)
      // Use sign and magnitude heuristics to detect coordinate order
      if (Math.abs(first) <= 90 && Math.abs(second) <= 90) {
        // Check for common longitude patterns:
        // - Western hemisphere longitudes are negative (Americas: -180 to 0)
        // - Eastern hemisphere longitudes can be large positive (Asia: 0 to 180)
        
        // If first is negative (likely western longitude) and second is positive (likely latitude)
        if (first < 0 && second >= 0) {
          // Probably [lng, lat] format
          return [first, second];
        }
        
        // If second is negative (likely western longitude) and first is positive (likely latitude)
        if (second < 0 && first >= 0) {
          // Probably [lat, lng] format, convert to [lng, lat]
          return [second, first];
        }
        
        // For other ambiguous cases, assume [lat, lng] (common GPX/TCX format)
        return [second, first];
      }

      // Apply validation for final result
      const [lng, lat] = [first, second];
      if (Math.abs(lng) > 180 || Math.abs(lat) > 90) {
        throw new Error(`Invalid coordinate at index ${index}: longitude must be [-180, 180], latitude must be [-90, 90]`);
      }

      return [lng, lat];
    });
  }

  /**
   * Normalize activity type names
   * @param {string} activityType - Raw activity type
   * @returns {string} - Normalized activity type
   */
  normalizeActivityType(activityType) {
    if (!activityType) return 'unknown';
    
    const normalized = activityType.toLowerCase().trim();
    const typeMap = {
      'ride': 'cycling',
      'virtualride': 'cycling',
      'ebikeride': 'cycling',
      'bike': 'cycling',
      'bicycle': 'cycling',
      'run': 'running',
      'virtualrun': 'running',
      'jog': 'running',
      'hike': 'hiking',
      'walk': 'walking',
      'swim': 'swimming',
      'rowing': 'rowing',
      'skiing': 'skiing',
      'gpx track': 'gpx',
      'gpx route': 'gpx',
      'tcx activity': 'activity'
    };

    return typeMap[normalized] || normalized;
  }

  /**
   * Calculate distance between coordinates using Haversine formula
   * @param {Array} coordinates - Array of [lng, lat] coordinates
   * @returns {number} - Distance in meters
   */
  calculateDistance(coordinates) {
    if (!coordinates || coordinates.length < 2) {
      return 0;
    }

    let totalDistance = 0;
    for (let i = 1; i < coordinates.length; i++) {
      totalDistance += this.haversineDistance(coordinates[i-1], coordinates[i]);
    }

    return Math.round(totalDistance);
  }

  /**
   * Calculate Haversine distance between two points
   * @param {Array} coord1 - [lng, lat]
   * @param {Array} coord2 - [lng, lat]
   * @returns {number} - Distance in meters
   */
  haversineDistance(coord1, coord2) {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRadians(coord2[1] - coord1[1]);
    const dLng = this.toRadians(coord2[0] - coord1[0]);
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.toRadians(coord1[1])) * Math.cos(this.toRadians(coord2[1])) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   * @param {number} degrees - Degrees
   * @returns {number} - Radians
   */
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Process elevation data for GeoJSON properties
   * @param {Array} elevationData - Elevation data array
   * @returns {Array} - Processed elevation profile
   */
  processElevationData(elevationData) {
    if (!Array.isArray(elevationData)) {
      return [];
    }

    return elevationData.map((point, index) => ({
      index: index,
      elevation: point.elevation_meters || point.elevation || 0,
      distance: point.distance || index * 10 // Approximate distance if not provided
    }));
  }

  /**
   * Calculate elevation statistics
   * @param {Array} elevationData - Elevation data array
   * @returns {Object} - Elevation statistics
   */
  calculateElevationStats(elevationData) {
    if (!Array.isArray(elevationData) || elevationData.length === 0) {
      return {
        gain: 0,
        loss: 0,
        min: 0,
        max: 0,
        avg: 0
      };
    }

    let gain = 0;
    let loss = 0;
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;

    for (let i = 0; i < elevationData.length; i++) {
      const elevation = elevationData[i].elevation_meters || elevationData[i].elevation || 0;
      
      sum += elevation;
      min = Math.min(min, elevation);
      max = Math.max(max, elevation);

      if (i > 0) {
        const prev = elevationData[i-1].elevation_meters || elevationData[i-1].elevation || 0;
        const diff = elevation - prev;
        if (diff > 0) {
          gain += diff;
        } else {
          loss += Math.abs(diff);
        }
      }
    }

    return {
      gain: Math.round(gain),
      loss: Math.round(loss),
      min: Math.round(min),
      max: Math.round(max),
      avg: Math.round(sum / elevationData.length)
    };
  }

  /**
   * Calculate duration from timestamps
   * @param {Array} timestamps - Timestamp data array
   * @returns {number} - Duration in seconds
   */
  calculateDuration(timestamps) {
    if (!Array.isArray(timestamps) || timestamps.length < 2) {
      return 0;
    }

    const first = new Date(timestamps[0].timestamp || timestamps[0].iso_string || timestamps[0]);
    const last = new Date(timestamps[timestamps.length - 1].timestamp || timestamps[timestamps.length - 1].iso_string || timestamps[timestamps.length - 1]);

    return Math.round((last - first) / 1000); // Convert to seconds
  }

  /**
   * Get activity color for map styling
   * @param {string} activityType - Activity type
   * @returns {string} - Hex color code
   */
  getActivityColor(activityType) {
    const colorMap = {
      'cycling': '#FF6B35',    // Orange
      'running': '#4ECDC4',    // Teal
      'hiking': '#45B7D1',     // Blue
      'walking': '#96CEB4',    // Green
      'swimming': '#FFEAA7',   // Yellow
      'rowing': '#DDA0DD',     // Plum
      'skiing': '#E17055',     // Salmon
      'gpx': '#6C5CE7',        // Purple
      'activity': '#FD79A8'    // Pink
    };

    return colorMap[activityType] || '#74B9FF'; // Default blue
  }

  /**
   * Get line width based on distance
   * @param {number} distance - Distance in meters
   * @returns {number} - Line width for map rendering
   */
  getActivityLineWidth(distance) {
    if (distance > 100000) return 4;  // >100km
    if (distance > 50000) return 3;   // 50-100km
    if (distance > 10000) return 2;   // 10-50km
    return 1;                         // <10km
  }

  /**
   * Get render order for activity type
   * @param {string} activityType - Activity type
   * @returns {number} - Render order (higher = on top)
   */
  getActivityRenderOrder(activityType) {
    const orderMap = {
      'cycling': 3,
      'running': 2,
      'hiking': 2,
      'walking': 1,
      'swimming': 1,
      'gpx': 2,
      'activity': 1
    };

    return orderMap[activityType] || 1;
  }

  /**
   * Validate input data
   * @param {Object} routeData - Input route data
   * @param {string} source - Data source type
   * @throws {Error} - If validation fails
   */
  validateInputData(routeData, source) {
    if (!routeData || typeof routeData !== 'object') {
      throw new Error('Invalid route data: expected object');
    }

    if (!this.supportedSources.includes(source) && source !== 'unknown') {
      throw new Error(`Unsupported source type: ${source}. Supported: ${this.supportedSources.join(', ')}`);
    }

    // Additional validation based on source type could be added here
  }

  /**
   * Validate GeoJSON output against specification
   * @param {Object} geoJSON - GeoJSON object to validate
   * @throws {Error} - If validation fails
   */
  validateGeoJSON(geoJSON) {
    if (!geoJSON || typeof geoJSON !== 'object') {
      throw new Error('Invalid GeoJSON: expected object');
    }

    if (!['Feature', 'FeatureCollection'].includes(geoJSON.type)) {
      throw new Error(`Invalid GeoJSON type: ${geoJSON.type}. Expected Feature or FeatureCollection`);
    }

    if (geoJSON.type === 'Feature') {
      this.validateFeature(geoJSON);
    } else if (geoJSON.type === 'FeatureCollection') {
      this.validateFeatureCollection(geoJSON);
    }
  }

  /**
   * Validate GeoJSON Feature
   * @param {Object} feature - GeoJSON Feature
   * @throws {Error} - If validation fails
   */
  validateFeature(feature) {
    if (!feature.geometry || typeof feature.geometry !== 'object') {
      throw new Error('Invalid Feature: missing geometry');
    }

    if (!feature.properties || typeof feature.properties !== 'object') {
      throw new Error('Invalid Feature: missing properties');
    }

    const { geometry } = feature;
    if (!['LineString', 'MultiLineString'].includes(geometry.type)) {
      throw new Error(`Invalid geometry type: ${geometry.type}. Expected LineString or MultiLineString`);
    }

    if (!Array.isArray(geometry.coordinates)) {
      throw new Error('Invalid geometry: coordinates must be an array');
    }

    // Validate coordinate structure
    if (geometry.type === 'LineString') {
      this.validateLineStringCoordinates(geometry.coordinates);
    } else if (geometry.type === 'MultiLineString') {
      geometry.coordinates.forEach((line, index) => {
        try {
          this.validateLineStringCoordinates(line);
        } catch (error) {
          throw new Error(`Invalid MultiLineString coordinates at index ${index}: ${error.message}`);
        }
      });
    }
  }

  /**
   * Validate GeoJSON FeatureCollection
   * @param {Object} featureCollection - GeoJSON FeatureCollection
   * @throws {Error} - If validation fails
   */
  validateFeatureCollection(featureCollection) {
    if (!Array.isArray(featureCollection.features)) {
      throw new Error('Invalid FeatureCollection: features must be an array');
    }

    featureCollection.features.forEach((feature, index) => {
      try {
        this.validateFeature(feature);
      } catch (error) {
        throw new Error(`Invalid feature at index ${index}: ${error.message}`);
      }
    });
  }

  /**
   * Validate LineString coordinates
   * @param {Array} coordinates - LineString coordinates
   * @throws {Error} - If validation fails
   */
  validateLineStringCoordinates(coordinates) {
    if (!Array.isArray(coordinates)) {
      throw new Error('LineString coordinates must be an array');
    }

    if (coordinates.length < this.validationRules.minCoordinates) {
      throw new Error(`LineString must have at least ${this.validationRules.minCoordinates} coordinates`);
    }

    if (coordinates.length > this.validationRules.maxCoordinates) {
      throw new Error(`LineString has too many coordinates (${coordinates.length} > ${this.validationRules.maxCoordinates})`);
    }

    coordinates.forEach((coord, index) => {
      if (!Array.isArray(coord) || coord.length < 2) {
        throw new Error(`Invalid coordinate at index ${index}: expected [lng, lat] array`);
      }

      const [lng, lat] = coord;
      if (typeof lng !== 'number' || typeof lat !== 'number') {
        throw new Error(`Invalid coordinate at index ${index}: expected numeric values`);
      }

      if (lng < -180 || lng > 180) {
        throw new Error(`Invalid longitude at index ${index}: ${lng} (must be -180 to 180)`);
      }

      if (lat < -90 || lat > 90) {
        throw new Error(`Invalid latitude at index ${index}: ${lat} (must be -90 to 90)`);
      }
    });
  }

  /**
   * Get supported source types
   * @returns {Array} - Array of supported source types
   */
  getSupportedSources() {
    return [...this.supportedSources];
  }

  /**
   * Get validation rules
   * @returns {Object} - Validation rules object
   */
  getValidationRules() {
    return { ...this.validationRules };
  }
}

// Export singleton instance
module.exports = new GeoJSONConverter();