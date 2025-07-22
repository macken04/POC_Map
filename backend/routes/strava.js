const express = require('express');
const router = express.Router();
const { requireAuth } = require('./auth');
const { refreshTokenIfNeeded } = require('../middleware/tokenRefresh');
const rateLimitManager = require('../middleware/rateLimiting');
const { 
  validateAndParseQuery, 
  filterActivities, 
  sortActivities, 
  buildStravaApiParams, 
  getFilterSummary 
} = require('../utils/activityFilters');
const { cache, generateStravaKey, getCachedOrFetch } = require('../services/cacheManager');

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
 * Helper function to make authenticated requests to Strava API
 * Enhanced with rate limit tracking
 */
async function stravaApiRequest(url, accessToken) {
  // Debug logging for token access
  console.log('Strava API request:', {
    url: url.replace(/\?.*$/, ''),
    hasToken: !!accessToken,
    tokenPrefix: accessToken ? accessToken.substring(0, 8) + '...' : 'MISSING'
  });

  if (!accessToken) {
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
    // Generate cache key for this user's athlete data
    const cacheKey = generateStravaKey(req, 'athlete');

    // Use cache-first strategy
    const athlete = await getCachedOrFetch('athlete', cacheKey, async () => {
      // INTEGRATION: req.getAccessToken() method provided by requireAuth middleware from auth.js
      return await stravaApiRequest(
        'https://www.strava.com/api/v3/athlete',
        req.getAccessToken()
      );
    });

    const response = {
      success: true,
      athlete: {
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
      }
    };

    res.json(response);

  } catch (error) {
    console.error('Error fetching athlete data:', error);
    
    if (error.status === 401) {
      return res.status(401).json({
        error: 'Token expired',
        message: 'Strava access token has expired. Please re-authenticate.'
      });
    }

    res.status(500).json({
      error: 'Failed to fetch athlete data',
      message: 'Unable to retrieve athlete information from Strava'
    });
  }
});

/**
 * Get user activities with enhanced filtering and sorting
 * Query parameters:
 * - page: Page number (default: 1)
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

    // Build Strava API parameters (only supported parameters)
    const stravaParams = buildStravaApiParams(parsedParams);

    // Generate cache key (without pagination for better cache hits)
    const cacheKey = generateStravaKey(req, 'activities', parsedParams);

    // Fetch activities using cache-first strategy
    const activities = await getCachedOrFetch('activities', cacheKey, async () => {
      return await stravaApiRequest(
        `https://www.strava.com/api/v3/athlete/activities?${stravaParams}`,
        req.getAccessToken()
      );
    });

    // Format activity data for map generation
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

    res.json({
      success: true,
      activities: sortedActivities,
      pagination: {
        page: parsedParams.page,
        per_page: parsedParams.per_page,
        total_activities: sortedActivities.length,
        original_count: formattedActivities.length,
        filtered_count: sortedActivities.length
      },
      filters_applied: {
        active_filters: filterSummary.activeFilters,
        sort_by: filterSummary.sortBy,
        sort_order: filterSummary.sortOrder
      }
    });

  } catch (error) {
    console.error('Error fetching activities:', error);
    
    if (error.status === 401) {
      return res.status(401).json({
        error: 'Token expired',
        message: 'Strava access token has expired. Please re-authenticate.'
      });
    }

    res.status(500).json({
      error: 'Failed to fetch activities',
      message: 'Unable to retrieve activities from Strava'
    });
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

    // Use cache-first strategy for activity details
    const activity = await getCachedOrFetch('activityDetails', cacheKey, async () => {
      return await stravaApiRequest(
        `https://www.strava.com/api/v3/activities/${id}`,
        req.getAccessToken()
      );
    });

    // Format detailed activity data
    const detailedActivity = {
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

    res.json({
      success: true,
      activity: detailedActivity
    });

  } catch (error) {
    console.error('Error fetching activity details:', error);
    
    if (error.status === 401) {
      return res.status(401).json({
        error: 'Token expired',
        message: 'Strava access token has expired. Please re-authenticate.'
      });
    }
    
    if (error.status === 404) {
      return res.status(404).json({
        error: 'Activity not found',
        message: 'The requested activity does not exist or you do not have access to it'
      });
    }

    res.status(500).json({
      error: 'Failed to fetch activity details',
      message: 'Unable to retrieve activity details from Strava'
    });
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

    // Use cache-first strategy for activity streams (longest TTL since GPS data is immutable)
    const streams = await getCachedOrFetch('activityStreams', cacheKey, async () => {
      return await stravaApiRequest(
        `https://www.strava.com/api/v3/activities/${id}/streams/${types}?key_by_type=true`,
        req.getAccessToken()
      );
    });

    res.json({
      success: true,
      activity_id: parseInt(id),
      streams: streams
    });

  } catch (error) {
    console.error('Error fetching activity streams:', error);
    
    if (error.status === 401) {
      return res.status(401).json({
        error: 'Token expired',
        message: 'Strava access token has expired. Please re-authenticate.'
      });
    }
    
    if (error.status === 404) {
      return res.status(404).json({
        error: 'Activity or streams not found',
        message: 'The requested activity streams do not exist or you do not have access to them'
      });
    }

    res.status(500).json({
      error: 'Failed to fetch activity streams',
      message: 'Unable to retrieve activity streams from Strava'
    });
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

module.exports = router;