const rateLimitManager = require('../middleware/rateLimiting');
const { cache, generateStravaKey, getCachedOrFetch } = require('./cacheManager');
const gpxTcxParser = require('./gpxTcxParser');

/**
 * Centralized Strava API Service
 * 
 * This service provides a clean abstraction layer for all Strava API interactions.
 * It handles authentication, rate limiting, caching, and error handling consistently
 * across all Strava API endpoints used in the application.
 * 
 * FEATURES:
 * - Automatic rate limit management and protection
 * - Intelligent caching with appropriate TTL values
 * - Consistent error handling and authentication validation
 * - Support for both Strava API and direct GPX/TCX file processing
 * - Data transformation for map generation compatibility
 * 
 * AUTHENTICATION INTEGRATION:
 * - Uses token management from auth middleware
 * - Handles token refresh automatically via middleware
 * - Provides consistent authentication error handling
 */

class StravaService {
  /**
   * Make authenticated request to Strava API with rate limiting and error handling
   * @param {string} url - Strava API endpoint URL
   * @param {string} accessToken - User's access token
   * @returns {Promise<Object>} - Parsed JSON response
   */
  async stravaApiRequest(url, accessToken) {
    if (!accessToken) {
      console.error('No access token provided for Strava API request');
      const error = new Error('No access token provided for Strava API request');
      error.status = 401;
      throw error;
    }

    const response = await rateLimitManager.stravaApiRequest(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'User-Agent': 'PrintMyRide/1.0'
      }
    });

    if (!response.ok) {
      const error = new Error(`Strava API request failed: ${response.status}`);
      error.status = response.status;
      error.response = response;
      throw error;
    }

    return response.json();
  }

  /**
   * Get authenticated athlete information
   * @param {Object} req - Express request object (for caching and auth)
   * @returns {Promise<Object>} - Athlete data
   */
  async getAthlete(req) {
    const cacheKey = generateStravaKey(req, 'athlete');
    
    return await getCachedOrFetch('athlete', cacheKey, async () => {
      return await this.stravaApiRequest(
        'https://www.strava.com/api/v3/athlete',
        req.getAccessToken()
      );
    });
  }

  /**
   * Get user activities with pagination and filtering
   * @param {Object} req - Express request object
   * @param {Object} stravaParams - Query string for Strava API
   * @param {Object} parsedParams - Parsed filter parameters
   * @returns {Promise<Object>} - Activities data
   */
  async getActivities(req, stravaParams, parsedParams) {
    const cacheKey = generateStravaKey(req, 'activities', parsedParams);
    
    return await getCachedOrFetch('activities', cacheKey, async () => {
      return await this.stravaApiRequest(
        `https://www.strava.com/api/v3/athlete/activities?${stravaParams}`,
        req.getAccessToken()
      );
    });
  }

  /**
   * Get detailed information for a specific activity
   * @param {Object} req - Express request object
   * @param {string|number} activityId - Activity ID
   * @returns {Promise<Object>} - Detailed activity data
   */
  async getActivityDetails(req, activityId) {
    if (!activityId || isNaN(parseInt(activityId))) {
      const error = new Error('Activity ID must be a valid number');
      error.status = 400;
      throw error;
    }

    const cacheKey = generateStravaKey(req, `activity-${activityId}`, {});
    
    return await getCachedOrFetch('activityDetails', cacheKey, async () => {
      return await this.stravaApiRequest(
        `https://www.strava.com/api/v3/activities/${activityId}`,
        req.getAccessToken()
      );
    });
  }

  /**
   * Get activity streams (GPS and sensor data)
   * @param {Object} req - Express request object
   * @param {string|number} activityId - Activity ID
   * @param {string} types - Stream types to fetch (default: 'latlng,altitude,time')
   * @returns {Promise<Object>} - Activity streams data
   */
  async getActivityStreams(req, activityId, types = 'latlng,altitude,time') {
    if (!activityId || isNaN(parseInt(activityId))) {
      const error = new Error('Activity ID must be a valid number');
      error.status = 400;
      throw error;
    }

    const cacheKey = generateStravaKey(req, `activity-${activityId}-streams`, { types });
    
    return await getCachedOrFetch('activityStreams', cacheKey, async () => {
      return await this.stravaApiRequest(
        `https://www.strava.com/api/v3/activities/${activityId}/streams/${types}?key_by_type=true`,
        req.getAccessToken()
      );
    });
  }

  /**
   * Format activity data for map generation and frontend consumption
   * @param {Array} activities - Raw activities from Strava API
   * @returns {Array} - Formatted activities
   */
  formatActivitiesForMap(activities) {
    return activities.map(activity => ({
      id: activity.id,
      name: activity.name,
      type: activity.type,
      sport_type: activity.sport_type,
      start_date: activity.start_date,
      start_date_local: activity.start_date_local,
      distance: activity.distance,
      moving_time: activity.moving_time,
      elapsed_time: activity.elapsed_time,
      total_elevation_gain: activity.total_elevation_gain,
      start_latlng: activity.start_latlng,
      end_latlng: activity.end_latlng,
      map: activity.map ? {
        id: activity.map.id,
        summary_polyline: activity.map.summary_polyline,
        resource_state: activity.map.resource_state
      } : null,
      average_speed: activity.average_speed,
      max_speed: activity.max_speed,
      has_heartrate: activity.has_heartrate,
      elev_high: activity.elev_high,
      elev_low: activity.elev_low
    }));
  }

  /**
   * Format detailed activity data for map generation
   * @param {Object} activity - Raw activity from Strava API
   * @returns {Object} - Formatted detailed activity
   */
  formatDetailedActivity(activity) {
    return {
      id: activity.id,
      name: activity.name,
      description: activity.description,
      type: activity.type,
      sport_type: activity.sport_type,
      start_date: activity.start_date,
      start_date_local: activity.start_date_local,
      timezone: activity.timezone,
      distance: activity.distance,
      moving_time: activity.moving_time,
      elapsed_time: activity.elapsed_time,
      total_elevation_gain: activity.total_elevation_gain,
      start_latlng: activity.start_latlng,
      end_latlng: activity.end_latlng,
      map: activity.map ? {
        id: activity.map.id,
        polyline: activity.map.polyline,
        summary_polyline: activity.map.summary_polyline,
        resource_state: activity.map.resource_state
      } : null,
      average_speed: activity.average_speed,
      max_speed: activity.max_speed,
      average_heartrate: activity.average_heartrate,
      max_heartrate: activity.max_heartrate,
      elev_high: activity.elev_high,
      elev_low: activity.elev_low,
      device_name: activity.device_name,
      gear_id: activity.gear_id
    };
  }

  /**
   * Format athlete data for frontend consumption
   * @param {Object} athlete - Raw athlete from Strava API
   * @returns {Object} - Formatted athlete data
   */
  formatAthleteData(athlete) {
    return {
      id: athlete.id,
      username: athlete.username,
      firstname: athlete.firstname,
      lastname: athlete.lastname,
      city: athlete.city,
      state: athlete.state,
      country: athlete.country,
      profile: athlete.profile,
      profile_medium: athlete.profile_medium,
      created_at: athlete.created_at,
      updated_at: athlete.updated_at
    };
  }

  /**
   * Process uploaded GPX/TCX file and extract route data
   * @param {Buffer} fileBuffer - Uploaded file buffer
   * @param {string} filename - Original filename
   * @param {string} mimetype - File mime type
   * @returns {Promise<Object>} - Processed route data in standardized format
   */
  async processUploadedRouteFile(fileBuffer, filename, mimetype) {
    try {
      // Determine file format
      const fileExtension = filename.toLowerCase().split('.').pop();
      let parsedData;

      if (fileExtension === 'gpx' || mimetype.includes('gpx')) {
        parsedData = await gpxTcxParser.parseGPXFile(fileBuffer, filename);
      } else if (fileExtension === 'tcx' || mimetype.includes('tcx')) {
        parsedData = await gpxTcxParser.parseTCXFile(fileBuffer, filename);
      } else {
        // Try to detect format from content
        const content = fileBuffer.toString('utf8');
        if (gpxTcxParser.validateGPXFormat(content)) {
          parsedData = await gpxTcxParser.parseGPXFile(fileBuffer, filename);
        } else if (gpxTcxParser.validateTCXFormat(content)) {
          parsedData = await gpxTcxParser.parseTCXFile(fileBuffer, filename);
        } else {
          throw new Error('Unable to determine file format - not a valid GPX or TCX file');
        }
      }

      // Transform to standardized format for the application
      return this.standardizeRouteData(parsedData, 'upload');

    } catch (error) {
      console.error('Error processing uploaded route file:', error);
      
      // Re-throw parsing errors as-is (they have detailed error info)
      if (error.success === false && error.error) {
        throw error;
      }
      
      // Handle other errors
      throw new Error(`Failed to process uploaded file: ${error.message}`);
    }
  }

  /**
   * Convert route data to standardized format for map rendering
   * @param {Object} routeData - Route data from any source (Strava API or file upload)
   * @param {string} source - Data source ('strava' or 'upload')
   * @returns {Object} - Standardized route data
   */
  standardizeRouteData(routeData, source = 'strava') {
    const standardized = {
      id: routeData.id || `upload_${Date.now()}`,
      name: routeData.name || 'Uploaded Route',
      type: routeData.type || 'Unknown',
      source: source,
      coordinates: [],
      elevation: [],
      timestamps: [],
      distance: routeData.distance || 0,
      total_elevation_gain: routeData.total_elevation_gain || 0,
      moving_time: routeData.moving_time || 0,
      start_latlng: null,
      end_latlng: null,
      bounds: null,
      geojson: null
    };

    // Process coordinates based on source
    if (source === 'strava' && routeData.map?.polyline) {
      // Handle Strava polyline data
      const polyline = require('@mapbox/polyline');
      try {
        const coordinates = polyline.decode(routeData.map.polyline).map(point => [point[0], point[1]]);
        standardized.coordinates = coordinates;
        standardized.start_latlng = coordinates.length > 0 ? coordinates[0] : null;
        standardized.end_latlng = coordinates.length > 0 ? coordinates[coordinates.length - 1] : null;
        standardized.bounds = this.calculateBounds(coordinates);
        
        // Create GeoJSON for map rendering
        standardized.geojson = {
          type: 'Feature',
          properties: {
            name: standardized.name,
            type: standardized.type,
            source: source,
            distance: standardized.distance
          },
          geometry: {
            type: 'LineString',
            coordinates: coordinates.map(coord => [coord[1], coord[0]]) // Convert to [lng, lat]
          }
        };
      } catch (polylineError) {
        console.error('Error decoding Strava polyline:', polylineError);
      }
    } else if (source === 'upload' && routeData.coordinates) {
      // Handle uploaded file data (already processed by GPX/TCX parser)
      standardized.coordinates = routeData.coordinates;
      standardized.elevation = routeData.elevation || [];
      standardized.timestamps = routeData.timestamps || [];
      standardized.bounds = routeData.bounds;
      standardized.start_latlng = routeData.coordinates.length > 0 ? routeData.coordinates[0] : null;
      standardized.end_latlng = routeData.coordinates.length > 0 ? routeData.coordinates[routeData.coordinates.length - 1] : null;
      standardized.geojson = routeData.geojson;
      
      // Add additional metadata from parsed file
      if (routeData.metadata) {
        standardized.metadata = routeData.metadata;
        standardized.has_elevation = routeData.has_elevation;
        standardized.has_timestamps = routeData.has_timestamps;
        standardized.format = routeData.format;
      }
    }

    return standardized;
  }

  /**
   * Calculate bounding box for an array of coordinates
   * @param {Array} coordinates - Array of [lat, lng] coordinates
   * @returns {Object|null} - Bounding box object or null if no coordinates
   */
  calculateBounds(coordinates) {
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length === 0) {
      return null;
    }

    let minLat = coordinates[0][0];
    let maxLat = coordinates[0][0];
    let minLng = coordinates[0][1];
    let maxLng = coordinates[0][1];

    for (const coord of coordinates) {
      if (coord[0] < minLat) minLat = coord[0];
      if (coord[0] > maxLat) maxLat = coord[0];
      if (coord[1] < minLng) minLng = coord[1];
      if (coord[1] > maxLng) maxLng = coord[1];
    }

    return {
      southwest: [minLng, minLat],
      northeast: [maxLng, maxLat],
      center: [(minLng + maxLng) / 2, (minLat + maxLat) / 2]
    };
  }

  /**
   * Validate route data before processing
   * @param {Object} routeData - Route data to validate
   * @returns {boolean} - True if valid
   */
  validateRouteData(routeData) {
    if (!routeData) return false;
    
    // Basic validation - can be expanded
    const hasCoordinates = routeData.coordinates && routeData.coordinates.length > 0;
    const hasValidId = routeData.id && (typeof routeData.id === 'string' || typeof routeData.id === 'number');
    
    return hasCoordinates || hasValidId;
  }

  /**
   * Handle common Strava API errors
   * @param {Error} error - Error from Strava API request
   * @returns {Object} - Formatted error response
   */
  handleStravaError(error) {
    console.error('Strava API error:', error);
    
    if (error.status === 401) {
      return {
        status: 401,
        error: 'Token expired',
        message: 'Strava access token has expired. Please re-authenticate.'
      };
    }
    
    if (error.status === 404) {
      return {
        status: 404,
        error: 'Resource not found',
        message: 'The requested resource does not exist or you do not have access to it'
      };
    }
    
    if (error.status === 429) {
      return {
        status: 429,
        error: 'Rate limit exceeded',
        message: 'Strava API rate limit exceeded. Please try again later.'
      };
    }
    
    return {
      status: 500,
      error: 'API request failed',
      message: 'Unable to complete request to Strava API'
    };
  }
}

// Export singleton instance
module.exports = new StravaService();