const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { requireAuth } = require('./auth');
const { refreshTokenIfNeeded } = require('../middleware/tokenRefresh');
const rateLimitManager = require('../middleware/rateLimiting');
const gpxTcxParser = require('../services/gpxTcxParser');
const { 
  validateAndParseQuery, 
  filterActivities, 
  sortActivities, 
  buildStravaApiParams, 
  getFilterSummary 
} = require('../utils/activityFilters');
const { cache, generateStravaKey, getCachedOrFetch } = require('../services/cacheManager');
const stravaService = require('../services/stravaService');
const { transformElevationForChart } = require('../utils/dataTransformers');

/**
 * Strava API integration routes
 * Handles fetching user activities and data from Strava API
 * All routes require authentication
 * 
 * AUTHENTICATION INTEGRATION:
 * ===========================
 * This module integrates with the OAuth authentication system from auth.js:
 * 
 * 1. MIDDLEWARE CHAIN:
 *    - requireAuth: Imported from auth.js, validates session and token
 *    - refreshTokenIfNeeded: Automatically refreshes expired tokens
 *    - rateLimitManager: Protects against rate limiting from Strava API
 *    - All routes use this chain: [rateLimitManager, requireAuth, refreshTokenIfNeeded]
 * 
 * 2. TOKEN ACCESS PATTERN:
 *    - All routes use req.getAccessToken() method (provided by requireAuth)
 *    - No direct session access to tokens (security best practice)
 *    - Automatic token validation and refresh handling
 * 
 * 3. ERROR HANDLING INTEGRATION:
 *    - 401 errors automatically trigger re-authentication flow
 *    - Consistent error response format across all endpoints
 *    - Strava API errors properly propagated to client
 * 
 * 4. STRAVA API INTEGRATION PATTERNS:
 *    - All API calls use stravaApiRequest() helper function
 *    - Automatic rate limit tracking and protection
 *    - Consistent request headers and error handling
 *    - Response data formatting for map generation compatibility
 * 
 * ROUTE STRUCTURE:
 * ================
 * - GET /api/strava/athlete - Get authenticated user info
 * - GET /api/strava/activities - List user activities with pagination
 * - GET /api/strava/activities/:id - Get detailed activity data
 * - GET /api/strava/activities/:id/streams - Get GPS/sensor data for maps
 * - GET /api/strava/activities/search - Search activities by criteria
 * 
 * INTEGRATION WITH MAP GENERATION:
 * ===============================
 * - Activity data formatted for Mapbox GL JS compatibility
 * - Polyline data extracted for high-resolution map rendering
 * - GPS streams provided for detailed route visualization
 */

/**
 * Multer configuration for file uploads
 * Supports GPX and TCX files with size limits and validation
 */
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1 // Single file upload
  },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.gpx', '.tcx'];
    const allowedMimeTypes = [
      'application/gpx+xml',
      'application/tcx+xml',
      'text/xml',
      'application/xml',
      'text/plain'
    ];
    
    const fileExtension = path.extname(file.originalname).toLowerCase();
    const isValidExtension = allowedExtensions.includes(fileExtension);
    const isValidMimeType = allowedMimeTypes.includes(file.mimetype.toLowerCase());
    
    if (isValidExtension || isValidMimeType) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Only GPX and TCX files are allowed. Received: ${file.originalname} (${file.mimetype})`), false);
    }
  }
});

/**
 * Helper function to make authenticated requests to Strava API
 * Enhanced with rate limit tracking
 */
async function stravaApiRequest(url, accessToken) {
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
 * INTEGRATION: Uses full middleware chain - rate limiting + auth + token refresh + Strava rate limit protection + caching
 */
router.get('/athlete', rateLimitManager.createClientRateLimit(), requireAuth, refreshTokenIfNeeded, rateLimitManager.checkStravaRateLimit(), async (req, res) => {
  try {
    const athlete = await stravaService.getAthlete(req);
    const formattedAthlete = stravaService.formatAthleteData(athlete);

    res.json({
      success: true,
      athlete: formattedAthlete
    });

  } catch (error) {
    console.error('Error fetching athlete data:', error);
    const errorResponse = stravaService.handleStravaError(error);
    res.status(errorResponse.status).json(errorResponse);
  }
});

/**
 * Upload and process GPX/TCX route files
 * POST /api/strava/upload
 * Accepts GPX or TCX files and processes them for map generation
 */
router.post('/upload', rateLimitManager.createClientRateLimit(), requireAuth, upload.single('routeFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
        message: 'Please select a GPX or TCX file to upload'
      });
    }

    const file = req.file;
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    console.log(`Processing uploaded file: ${file.originalname} (${file.size} bytes, ${file.mimetype})`);

    // Basic file validation
    if (file.size === 0) {
      return res.status(400).json({
        error: 'Empty file',
        message: 'The uploaded file appears to be empty'
      });
    }

    // Process the file using the dedicated parser service
    let parsedData;
    try {
      if (fileExtension === '.gpx') {
        parsedData = await gpxTcxParser.parseGPXFile(file.buffer, file.originalname);
      } else if (fileExtension === '.tcx') {
        parsedData = await gpxTcxParser.parseTCXFile(file.buffer, file.originalname);
      } else {
        // Try to detect format from content
        const content = file.buffer.toString('utf8');
        if (gpxTcxParser.validateGPXFormat(content)) {
          parsedData = await gpxTcxParser.parseGPXFile(file.buffer, file.originalname);
        } else if (gpxTcxParser.validateTCXFormat(content)) {
          parsedData = await gpxTcxParser.parseTCXFile(file.buffer, file.originalname);
        } else {
          throw new Error('Unable to determine file format from content');
        }
      }
    } catch (parseError) {
      console.error('Error parsing uploaded file:', parseError);
      return res.status(400).json({
        error: 'File parsing failed',
        message: `Unable to parse the uploaded file: ${parseError.message}`,
        details: 'Please ensure the file is a valid GPX or TCX format'
      });
    }

    // Validate parsed data
    if (!parsedData || !parsedData.coordinates || parsedData.coordinates.length === 0) {
      return res.status(400).json({
        error: 'No route data found',
        message: 'The uploaded file does not contain valid route coordinates'
      });
    }

    // Format the data for map generation
    const formattedRoute = {
      id: `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: parsedData.name || file.originalname.replace(/\.[^/.]+$/, ''),
      description: parsedData.description || 'Uploaded route',
      type: parsedData.type || 'Upload',
      source: 'upload',
      upload_date: new Date().toISOString(),
      filename: file.originalname,
      coordinates: parsedData.coordinates,
      elevation: parsedData.elevation || [],
      timestamps: parsedData.timestamps || [],
      distance: parsedData.distance || calculateDistance(parsedData.coordinates),
      total_elevation_gain: parsedData.total_elevation_gain || calculateElevationGain(parsedData.elevation),
      moving_time: parsedData.moving_time || 0,
      start_latlng: parsedData.coordinates.length > 0 ? parsedData.coordinates[0] : null,
      end_latlng: parsedData.coordinates.length > 0 ? parsedData.coordinates[parsedData.coordinates.length - 1] : null,
      bounds: calculateBounds(parsedData.coordinates),
      stats: {
        total_points: parsedData.coordinates.length,
        has_elevation: parsedData.elevation && parsedData.elevation.length > 0,
        has_timestamps: parsedData.timestamps && parsedData.timestamps.length > 0
      }
    };

    console.log(`Successfully processed ${file.originalname}: ${formattedRoute.stats.total_points} points, ${formattedRoute.distance}m distance`);

    res.json({
      success: true,
      message: 'Route file uploaded and processed successfully',
      route: formattedRoute
    });

  } catch (error) {
    console.error('Error processing route upload:', error);
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        message: 'The uploaded file exceeds the 10MB size limit'
      });
    }
    
    if (error.message.includes('Invalid file type')) {
      return res.status(400).json({
        error: 'Invalid file type',
        message: error.message
      });
    }

    res.status(500).json({
      error: 'Upload processing failed',
      message: 'An error occurred while processing the uploaded file'
    });
  }
});

/**
 * Get user activities with enhanced filtering and sorting
 * Query parameters:
 * - page: Page number (default: 1)
 * - per_page: Activities per page (default: 30, max: 200)
 * - load_all: Load all available activities across multiple pages (default: false)
 * - max_pages: Maximum pages to load when load_all is true (default: 10, max: 20)
 * - before: Unix timestamp for activities before this date
 * - after: Unix timestamp for activities after this date
 * - activity_types: Comma-separated list of activity types (e.g., "Ride,Run")
 * - min_distance: Minimum distance in meters
 * - max_distance: Maximum distance in meters
 * - min_elevation: Minimum total elevation gain in meters
 * - max_elevation: Maximum total elevation gain in meters
 * - min_duration: Minimum duration in seconds (moving_time)
 * - max_duration: Maximum duration in seconds (moving_time)
 * - search_name: Search activities by name (case-insensitive)
 * - sort_by: Field to sort by (start_date, distance, moving_time, elapsed_time, total_elevation_gain, average_speed, max_speed, name)
 * - sort_order: Sort order (asc, desc) - default: desc
 */
router.get('/activities', rateLimitManager.createClientRateLimit(), requireAuth, refreshTokenIfNeeded, rateLimitManager.checkStravaRateLimit(), async (req, res) => {
  try {
    // Validate and parse query parameters
    let parsedParams;
    try {
      parsedParams = validateAndParseQuery(req.query);
    } catch (validationError) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        message: validationError.message
      });
    }

    // Add new parameters for enhanced pagination
    const loadAll = req.query.load_all === 'true';
    const maxPages = Math.min(parseInt(req.query.max_pages) || 10, 20); // Safety limit
    
    let allActivities = [];
    let currentPage = parsedParams.page;
    let totalPagesLoaded = 0;
    let hasMoreActivities = true;

    // Load activities (single page or multiple pages)
    do {
      // Build Strava API parameters for current page
      const currentParams = { ...parsedParams, page: currentPage };
      const stravaParams = buildStravaApiParams(currentParams);

      // Generate cache key for current page
      const cacheKey = generateStravaKey(req, 'activities', currentParams);

      // Fetch activities for current page
      const pageActivities = await stravaService.getActivities(req, stravaParams, currentParams);
      
      if (pageActivities && pageActivities.length > 0) {
        allActivities = allActivities.concat(pageActivities);
        currentPage++;
        totalPagesLoaded++;
        
        // Check if we got fewer activities than requested (likely last page)
        if (pageActivities.length < parsedParams.per_page) {
          hasMoreActivities = false;
        }
      } else {
        hasMoreActivities = false;
      }
      
      // Safety checks to prevent infinite loops
      if (totalPagesLoaded >= maxPages) {
        hasMoreActivities = false;
      }
      
    } while (loadAll && hasMoreActivities && totalPagesLoaded < maxPages);

    // Format activity data for map generation
    const formattedActivities = stravaService.formatActivitiesForMap(allActivities);

    // Apply client-side filtering
    const filteredActivities = filterActivities(formattedActivities, parsedParams);
    
    // Apply sorting
    const sortedActivities = sortActivities(filteredActivities, parsedParams.sort_by, parsedParams.sort_order);

    // Get filter summary for logging
    const filterSummary = getFilterSummary(parsedParams, formattedActivities.length, sortedActivities.length);
    
    // Log filter application (useful for debugging and monitoring)
    if (filterSummary.activeFilters.length > 0) {
      console.log(`Applied filters: ${filterSummary.activeFilters.join(', ')} - Filtered from ${filterSummary.originalCount} to ${filterSummary.filteredCount} activities (${filterSummary.filterEfficiency} reduction)`);
    }

    // Enhanced logging for multi-page loads
    if (loadAll && totalPagesLoaded > 1) {
      console.log(`Loaded ${totalPagesLoaded} pages, ${allActivities.length} total activities (hasMore: ${hasMoreActivities})`);
    }

    res.json({
      success: true,
      activities: sortedActivities,
      pagination: {
        page: parsedParams.page,
        per_page: parsedParams.per_page,
        total_activities: sortedActivities.length,
        original_count: formattedActivities.length,
        filtered_count: sortedActivities.length,
        pages_loaded: totalPagesLoaded,
        has_more_activities: hasMoreActivities,
        load_all_used: loadAll
      },
      filters_applied: {
        active_filters: filterSummary.activeFilters,
        sort_by: filterSummary.sortBy,
        sort_order: filterSummary.sortOrder
      }
    });

  } catch (error) {
    console.error('Error fetching activities:', error);
    const errorResponse = stravaService.handleStravaError(error);
    res.status(errorResponse.status).json(errorResponse);
  }
});

/**
 * Load more activities for pagination (incremental loading)
 * Query parameters:
 * - page: Page number to load (required)
 * - per_page: Activities per page (default: 30, max: 200)
 * - before: Unix timestamp for activities before this date
 * - after: Unix timestamp for activities after this date
 * - activity_types: Comma-separated list of activity types (e.g., "Ride,Run")
 * - min_distance: Minimum distance in meters
 * - max_distance: Maximum distance in meters
 * - min_elevation: Minimum total elevation gain in meters
 * - max_elevation: Maximum total elevation gain in meters
 * - min_duration: Minimum duration in seconds (moving_time)
 * - max_duration: Maximum duration in seconds (moving_time)
 * - search_name: Search activities by name (case-insensitive)
 * - sort_by: Field to sort by (start_date, distance, moving_time, elapsed_time, total_elevation_gain, average_speed, max_speed, name)
 * - sort_order: Sort order (asc, desc) - default: desc
 */
router.get('/activities/load-more', rateLimitManager.createClientRateLimit(), requireAuth, refreshTokenIfNeeded, rateLimitManager.checkStravaRateLimit(), async (req, res) => {
  try {
    // Validate and parse query parameters
    let parsedParams;
    try {
      parsedParams = validateAndParseQuery(req.query);
    } catch (validationError) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        message: validationError.message
      });
    }

    // Ensure page number is provided and valid
    if (parsedParams.page < 1) {
      return res.status(400).json({
        error: 'Invalid page parameter',
        message: 'Page number must be 1 or greater'
      });
    }

    // Build Strava API parameters
    const stravaParams = buildStravaApiParams(parsedParams);

    // Generate cache key for this specific page and filters
    const cacheKey = generateStravaKey(req, 'activities-loadmore', parsedParams);

    // Fetch activities for the requested page
    const pageActivities = await stravaService.getActivities(req, stravaParams, parsedParams);

    // Format activity data for map generation
    const formattedActivities = stravaService.formatActivitiesForMap(pageActivities);

    // Apply client-side filtering
    const filteredActivities = filterActivities(formattedActivities, parsedParams);
    
    // Apply sorting
    const sortedActivities = sortActivities(filteredActivities, parsedParams.sort_by, parsedParams.sort_order);

    // Determine if there are potentially more activities
    const hasMoreActivities = pageActivities.length >= parsedParams.per_page;

    // Get filter summary for logging
    const filterSummary = getFilterSummary(parsedParams, formattedActivities.length, sortedActivities.length);
    
    // Log load more operation
    console.log(`Load more activities: page ${parsedParams.page}, loaded ${pageActivities.length} activities, filtered to ${sortedActivities.length}`);

    res.json({
      success: true,
      activities: sortedActivities,
      pagination: {
        page: parsedParams.page,
        per_page: parsedParams.per_page,
        activities_count: sortedActivities.length,
        original_count: formattedActivities.length,
        filtered_count: sortedActivities.length,
        has_more_activities: hasMoreActivities,
        next_page: hasMoreActivities ? parsedParams.page + 1 : null
      },
      filters_applied: {
        active_filters: filterSummary.activeFilters,
        sort_by: filterSummary.sortBy,
        sort_order: filterSummary.sortOrder
      }
    });

  } catch (error) {
    console.error('Error loading more activities:', error);
    const errorResponse = stravaService.handleStravaError(error);
    res.status(errorResponse.status).json(errorResponse);
  }
});

/**
 * Get detailed information for a specific activity
 * Includes full polyline data for map generation + caching
 */
router.get('/activities/:id', rateLimitManager.createClientRateLimit(), requireAuth, refreshTokenIfNeeded, rateLimitManager.checkStravaRateLimit(), async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        error: 'Invalid activity ID',
        message: 'Activity ID must be a valid number'
      });
    }

    // Generate cache key for this specific activity
    const cacheKey = generateStravaKey(req, `activity-${id}`, {});

    // Get activity details using Strava service
    const activity = await stravaService.getActivityDetails(req, id);

    // Format detailed activity data
    const detailedActivity = stravaService.formatDetailedActivity(activity);

    res.json({
      success: true,
      activity: detailedActivity
    });

  } catch (error) {
    console.error('Error fetching activity details:', error);
    const errorResponse = stravaService.handleStravaError(error);
    res.status(errorResponse.status).json(errorResponse);
  }
});

/**
 * Get activity streams (detailed GPS and sensor data)
 * Used for high-resolution map generation + caching (24hr TTL for static data)
 */
router.get('/activities/:id/streams', rateLimitManager.createClientRateLimit(), requireAuth, refreshTokenIfNeeded, rateLimitManager.checkStravaRateLimit(), async (req, res) => {
  try {
    const { id } = req.params;
    const { types = 'latlng,altitude,time' } = req.query;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        error: 'Invalid activity ID',
        message: 'Activity ID must be a valid number'
      });
    }

    // Generate cache key for this activity's streams with specific types
    const cacheKey = generateStravaKey(req, `activity-${id}-streams`, { types });

    // Get activity streams using Strava service
    const streams = await stravaService.getActivityStreams(req, id, types);

    res.json({
      success: true,
      activity_id: parseInt(id),
      streams: streams
    });

  } catch (error) {
    console.error('Error fetching activity streams:', error);
    const errorResponse = stravaService.handleStravaError(error);
    res.status(errorResponse.status).json(errorResponse);
  }
});

/**
 * Get elevation profile data for chart visualization
 * Optimized endpoint for elevation profile charts with performance optimizations
 */
router.get('/activities/:id/elevation', rateLimitManager.createClientRateLimit(), requireAuth, refreshTokenIfNeeded, rateLimitManager.checkStravaRateLimit(), async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      units = 'metric',
      maxPoints = 1000,
      includeGradient = 'true'
    } = req.query;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        error: 'Invalid activity ID',
        message: 'Activity ID must be a valid number'
      });
    }

    // Validate parameters
    const validUnits = ['metric', 'imperial'];
    if (!validUnits.includes(units)) {
      return res.status(400).json({
        error: 'Invalid units parameter',
        message: 'Units must be either "metric" or "imperial"'
      });
    }

    const maxPointsNum = parseInt(maxPoints);
    if (isNaN(maxPointsNum) || maxPointsNum < 10 || maxPointsNum > 2000) {
      return res.status(400).json({
        error: 'Invalid maxPoints parameter',
        message: 'maxPoints must be a number between 10 and 2000'
      });
    }

    // Generate cache key for elevation data
    const cacheKey = generateStravaKey(req, `activity-${id}-elevation`, { 
      units, 
      maxPoints: maxPointsNum, 
      includeGradient 
    });

    // Get activity streams (we need altitude, latlng, and optionally distance/time)
    const streams = await stravaService.getActivityStreams(req, id, 'latlng,altitude,time,distance');

    // Transform elevation data for chart visualization
    const elevationData = transformElevationForChart(streams, {
      maxPoints: maxPointsNum,
      includeGradient: includeGradient === 'true',
      units: units
    });

    if (!elevationData.hasData) {
      return res.status(404).json({
        error: 'No elevation data found',
        message: 'This activity does not contain elevation information'
      });
    }

    res.json({
      success: true,
      activity_id: parseInt(id),
      elevation_data: elevationData
    });

  } catch (error) {
    console.error('Error fetching elevation data:', error);
    const errorResponse = stravaService.handleStravaError(error);
    res.status(errorResponse.status).json(errorResponse);
  }
});

/**
 * Search activities by criteria - Enhanced version using new filtering utilities
 * Query parameters (backward compatible + enhanced):
 * - q: Search query (activity name) - maps to search_name parameter
 * - type: Activity type filter - maps to activity_types parameter  
 * - start_date: Start date filter (YYYY-MM-DD) - converted to after timestamp
 * - end_date: End date filter (YYYY-MM-DD) - converted to before timestamp
 * - page: Page number (default: 1)
 * - per_page: Activities per page (default: 30, max: 200)
 * 
 * Plus all enhanced filtering parameters from the main activities endpoint
 */
router.get('/activities/search', rateLimitManager.createClientRateLimit(), requireAuth, refreshTokenIfNeeded, rateLimitManager.checkStravaRateLimit(), async (req, res) => {
  try {
    // Convert legacy search parameters to new format for backward compatibility
    const enhancedQuery = { ...req.query };
    
    // Map legacy 'q' parameter to 'search_name'
    if (req.query.q) {
      enhancedQuery.search_name = req.query.q;
    }
    
    // Map legacy 'type' parameter to 'activity_types'
    if (req.query.type) {
      enhancedQuery.activity_types = req.query.type;
    }
    
    // Convert date strings to timestamps for Strava API compatibility
    if (req.query.start_date) {
      try {
        const startTimestamp = Math.floor(new Date(req.query.start_date).getTime() / 1000);
        enhancedQuery.after = startTimestamp.toString();
      } catch (dateError) {
        return res.status(400).json({
          error: 'Invalid start_date',
          message: 'start_date must be in YYYY-MM-DD format'
        });
      }
    }
    
    if (req.query.end_date) {
      try {
        const endTimestamp = Math.floor(new Date(req.query.end_date).getTime() / 1000);
        enhancedQuery.before = endTimestamp.toString();
      } catch (dateError) {
        return res.status(400).json({
          error: 'Invalid end_date',
          message: 'end_date must be in YYYY-MM-DD format'
        });
      }
    }

    // Validate and parse query parameters using enhanced filtering system
    let parsedParams;
    try {
      parsedParams = validateAndParseQuery(enhancedQuery);
    } catch (validationError) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        message: validationError.message
      });
    }

    // Build Strava API parameters (only supported parameters)
    const stravaParams = buildStravaApiParams(parsedParams);

    // Generate cache key for search (include all search parameters)
    const cacheKey = generateStravaKey(req, 'activities-search', enhancedQuery);

    // Fetch activities using cache-first strategy
    const activities = await getCachedOrFetch('activities', cacheKey, async () => {
      return await stravaApiRequest(
        `https://www.strava.com/api/v3/athlete/activities?${stravaParams}`,
        req.getAccessToken()
      );
    });

    // Format activity data (lighter format for search results)
    const formattedActivities = activities.map(activity => ({
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
      average_speed: activity.average_speed,
      max_speed: activity.max_speed,
      map: activity.map ? {
        id: activity.map.id,
        summary_polyline: activity.map.summary_polyline,
        resource_state: activity.map.resource_state
      } : null
    }));

    // Apply client-side filtering using enhanced filtering system
    const filteredActivities = filterActivities(formattedActivities, parsedParams);
    
    // Apply sorting
    const sortedActivities = sortActivities(filteredActivities, parsedParams.sort_by, parsedParams.sort_order);

    // Get filter summary for logging
    const filterSummary = getFilterSummary(parsedParams, formattedActivities.length, sortedActivities.length);
    
    // Log search operation
    if (filterSummary.activeFilters.length > 0) {
      console.log(`Search executed: ${filterSummary.activeFilters.join(', ')} - Found ${filterSummary.filteredCount} activities out of ${filterSummary.originalCount}`);
    }

    res.json({
      success: true,
      activities: sortedActivities,
      search_criteria: {
        // Backward compatibility fields
        q: req.query.q || null,
        type: req.query.type || null,
        start_date: req.query.start_date || null,
        end_date: req.query.end_date || null,
        // Enhanced filtering info
        filters_applied: filterSummary.activeFilters,
        sort_by: filterSummary.sortBy,
        sort_order: filterSummary.sortOrder
      },
      results: {
        total_results: sortedActivities.length,
        original_count: formattedActivities.length,
        filtered_count: sortedActivities.length,
        page: parsedParams.page,
        per_page: parsedParams.per_page
      }
    });

  } catch (error) {
    console.error('Error searching activities:', error);
    
    if (error.status === 401) {
      return res.status(401).json({
        error: 'Token expired',
        message: 'Strava access token has expired. Please re-authenticate.'
      });
    }

    res.status(500).json({
      error: 'Failed to search activities',
      message: 'Unable to search activities'
    });
  }
});

/**
 * Cache management endpoints for monitoring and debugging
 */

/**
 * Get cache statistics and performance metrics
 * Useful for monitoring cache effectiveness
 */
router.get('/cache/stats', rateLimitManager.createClientRateLimit(), requireAuth, (req, res) => {
  try {
    const { getStats, healthCheck } = require('../services/cacheManager');
    
    const stats = getStats();
    const health = healthCheck();
    
    res.json({
      success: true,
      cache: {
        stats,
        health,
        recommendations: generateCacheRecommendations(stats)
      }
    });
  } catch (error) {
    console.error('Error fetching cache stats:', error);
    res.status(500).json({
      error: 'Failed to fetch cache statistics',
      message: error.message
    });
  }
});

/**
 * Clear cache for current user (admin function)
 * Useful for debugging or when user data changes externally
 */
router.delete('/cache/clear', rateLimitManager.createClientRateLimit(), requireAuth, (req, res) => {
  try {
    const { invalidateUserCache } = require('../services/cacheManager');
    const userId = req.session?.athlete?.id;
    
    if (!userId) {
      return res.status(400).json({
        error: 'User not authenticated',
        message: 'Cannot clear cache without valid user session'
      });
    }

    // Clear all cache types for this user
    invalidateUserCache(userId);
    
    res.json({
      success: true,
      message: `Cache cleared for user ${userId}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({
      error: 'Failed to clear cache',
      message: error.message
    });
  }
});

/**
 * Generate cache optimization recommendations based on stats
 * @param {Object} stats - Cache statistics
 * @returns {Array} Array of recommendations
 */
function generateCacheRecommendations(stats) {
  const recommendations = [];
  const hitRate = parseFloat(stats.hitRate);
  
  if (hitRate < 30) {
    recommendations.push({
      type: 'performance',
      priority: 'high',
      message: 'Cache hit rate is low. Consider increasing TTL values or checking cache key generation.'
    });
  } else if (hitRate > 80) {
    recommendations.push({
      type: 'performance', 
      priority: 'low',
      message: 'Excellent cache performance! Current settings are optimal.'
    });
  }

  // Check for high eviction rates
  Object.entries(stats.cacheDetails).forEach(([cacheType, details]) => {
    const evictionRate = details.evictions / (details.sets || 1);
    if (evictionRate > 0.2) {
      recommendations.push({
        type: 'memory',
        priority: 'medium',
        message: `High eviction rate for ${cacheType} cache. Consider increasing maxSize.`
      });
    }
  });

  // Check memory usage
  const memoryBytes = stats.memoryUsage.includes('MB') ? 
    parseFloat(stats.memoryUsage) * 1024 * 1024 : 
    parseFloat(stats.memoryUsage) * 1024;
    
  if (memoryBytes > 100 * 1024 * 1024) { // 100MB
    recommendations.push({
      type: 'memory',
      priority: 'medium', 
      message: 'High memory usage detected. Consider enabling compression or reducing TTL values.'
    });
  }

  return recommendations;
}




/**
 * Calculate total distance from coordinates using Haversine formula
 * @param {Array} coordinates - Array of [lat, lng] coordinates
 * @returns {number} - Distance in meters
 */
function calculateDistance(coordinates) {
  if (!coordinates || coordinates.length < 2) return 0;
  
  let totalDistance = 0;
  
  for (let i = 1; i < coordinates.length; i++) {
    const [lat1, lng1] = coordinates[i - 1];
    const [lat2, lng2] = coordinates[i];
    
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    totalDistance += distance;
  }
  
  return Math.round(totalDistance);
}

/**
 * Calculate total elevation gain from elevation data
 * @param {Array} elevation - Array of elevation values in meters
 * @returns {number} - Total elevation gain in meters
 */
function calculateElevationGain(elevation) {
  if (!elevation || elevation.length < 2) return 0;
  
  let totalGain = 0;
  
  for (let i = 1; i < elevation.length; i++) {
    const gain = elevation[i] - elevation[i - 1];
    if (gain > 0) {
      totalGain += gain;
    }
  }
  
  return Math.round(totalGain);
}

/**
 * Calculate bounding box for coordinates
 * @param {Array} coordinates - Array of [lat, lng] coordinates
 * @returns {Object} - Bounding box with north, south, east, west values
 */
function calculateBounds(coordinates) {
  if (!coordinates || coordinates.length === 0) return null;
  
  let north = coordinates[0][0];
  let south = coordinates[0][0];
  let east = coordinates[0][1];
  let west = coordinates[0][1];
  
  coordinates.forEach(([lat, lng]) => {
    north = Math.max(north, lat);
    south = Math.min(south, lat);
    east = Math.max(east, lng);
    west = Math.min(west, lng);
  });
  
  return { north, south, east, west };
}

/**
 * Get GeoJSON representation of an activity route
 * POST /strava/routes/geojson
 * 
 * Converts route data from various sources (Strava, GPX, TCX) to standardized GeoJSON
 * 
 * Body parameters:
 * - routeData: Route data object (required)
 * - source: Data source type ('strava', 'gpx', 'tcx', 'coordinates') (optional, will auto-detect)
 * - options: Conversion options (optional)
 */
router.post('/routes/geojson', rateLimitManager.createClientRateLimit(), requireAuth, async (req, res) => {
  try {
    const { routeData, source, options = {} } = req.body;

    if (!routeData) {
      return res.status(400).json({
        error: 'Missing route data',
        message: 'routeData parameter is required in request body'
      });
    }

    // Import the GeoJSON converter
    const geojsonConverter = require('../services/geojsonConverter');

    // Set default conversion options
    const conversionOptions = {
      source: source || 'unknown', // Will auto-detect if unknown
      includeElevation: options.includeElevation !== false,
      includeTimestamps: options.includeTimestamps !== false,
      validateOutput: options.validateOutput !== false,
      handleMultiSegment: options.handleMultiSegment !== false,
      optimizeForMapbox: options.optimizeForMapbox !== false,
      ...options
    };

    // Convert to GeoJSON
    const geoJSON = await geojsonConverter.convertToGeoJSON(routeData, conversionOptions);

    res.json({
      success: true,
      data: geoJSON,
      metadata: {
        source: conversionOptions.source,
        conversion_time: new Date().toISOString(),
        validation_passed: conversionOptions.validateOutput,
        optimized_for_mapbox: conversionOptions.optimizeForMapbox
      }
    });

  } catch (error) {
    console.error('GeoJSON conversion error:', error);
    
    res.status(400).json({
      error: 'GeoJSON conversion failed',
      message: error.message,
      type: 'conversion_error'
    });
  }
});

/**
 * Get GeoJSON representation of a specific Strava activity
 * GET /strava/activities/:id/geojson
 * 
 * Fetches activity data from Strava and converts to GeoJSON
 */
router.get('/activities/:id/geojson', rateLimitManager.createClientRateLimit(), requireAuth, refreshTokenIfNeeded, rateLimitManager.checkStravaRateLimit(), async (req, res) => {
  try {
    const activityId = req.params.id;

    if (!activityId || isNaN(activityId)) {
      return res.status(400).json({
        error: 'Invalid activity ID',
        message: 'Activity ID must be a valid number'
      });
    }

    // Get access token
    const accessToken = req.getAccessToken();

    // Fetch activity details with streams
    const streamsUrl = `https://www.strava.com/api/v3/activities/${activityId}/streams`;
    const streamsResponse = await stravaService.stravaApiRequest(streamsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      params: {
        keys: 'latlng,altitude,time',
        key_by_type: true
      }
    });

    if (!streamsResponse.latlng || !streamsResponse.latlng.data) {
      return res.status(404).json({
        error: 'No GPS data found',
        message: 'This activity does not contain GPS coordinate data'
      });
    }

    // Also fetch activity details for metadata
    const activityUrl = `https://www.strava.com/api/v3/activities/${activityId}`;
    const activityResponse = await stravaService.stravaApiRequest(activityUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    // Transform streams data
    const { transformActivityStreams } = require('../utils/dataTransformers');
    const transformedData = transformActivityStreams(streamsResponse, activityId);

    // Add activity metadata
    transformedData.name = activityResponse.name;
    transformedData.type = activityResponse.type;
    transformedData.distance = activityResponse.distance;
    transformedData.total_elevation_gain = activityResponse.total_elevation_gain;
    transformedData.moving_time = activityResponse.moving_time;
    transformedData.elapsed_time = activityResponse.elapsed_time;

    // Convert to GeoJSON
    const geojsonConverter = require('../services/geojsonConverter');
    const geoJSON = await geojsonConverter.convertToGeoJSON(transformedData, {
      source: 'strava_polyline',
      includeElevation: true,
      includeTimestamps: true,
      validateOutput: true,
      optimizeForMapbox: true
    });

    res.json({
      success: true,
      data: geoJSON,
      metadata: {
        activity_id: activityId,
        source: 'strava_api',
        conversion_time: new Date().toISOString(),
        has_gps_data: transformedData.has_gps_data,
        has_elevation_data: transformedData.has_altitude_data,
        has_time_data: transformedData.has_time_data,
        total_points: transformedData.coordinates ? transformedData.coordinates.length : 0
      }
    });

  } catch (error) {
    console.error('Activity GeoJSON conversion error:', error);
    
    if (error.response && error.response.status === 404) {
      res.status(404).json({
        error: 'Activity not found',
        message: 'The specified activity could not be found or you do not have access to it'
      });
    } else if (error.response && error.response.status === 401) {
      res.status(401).json({
        error: 'Authentication failed',
        message: 'Your Strava authentication has expired. Please log in again.'
      });
    } else {
      res.status(500).json({
        error: 'GeoJSON conversion failed',
        message: error.message,
        type: 'conversion_error'
      });
    }
  }
});

module.exports = router;