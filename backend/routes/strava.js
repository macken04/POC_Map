const express = require('express');
const router = express.Router();
const { requireAuth } = require('./auth');

/**
 * Strava API integration routes
 * Handles fetching user activities and data from Strava API
 * All routes require authentication
 */

/**
 * Helper function to make authenticated requests to Strava API
 */
async function stravaApiRequest(url, accessToken) {
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json'
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
 */
router.get('/athlete', requireAuth, async (req, res) => {
  try {
    const athlete = await stravaApiRequest(
      'https://www.strava.com/api/v3/athlete',
      req.session.strava.accessToken
    );

    res.json({
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
    });

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
 * Get user activities with pagination
 * Query parameters:
 * - page: Page number (default: 1)
 * - per_page: Activities per page (default: 30, max: 200)
 * - before: Unix timestamp for activities before this date
 * - after: Unix timestamp for activities after this date
 */
router.get('/activities', requireAuth, async (req, res) => {
  try {
    const {
      page = 1,
      per_page = 30,
      before,
      after
    } = req.query;

    // Validate pagination parameters
    const pageNum = Math.max(1, parseInt(page));
    const perPage = Math.min(200, Math.max(1, parseInt(per_page)));

    // Build query parameters
    const params = new URLSearchParams({
      page: pageNum.toString(),
      per_page: perPage.toString()
    });

    if (before) params.append('before', before);
    if (after) params.append('after', after);

    const activities = await stravaApiRequest(
      `https://www.strava.com/api/v3/athlete/activities?${params}`,
      req.session.strava.accessToken
    );

    // Filter and format activity data for map generation
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

    res.json({
      success: true,
      activities: formattedActivities,
      pagination: {
        page: pageNum,
        per_page: perPage,
        total_activities: formattedActivities.length
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
 * Includes full polyline data for map generation
 */
router.get('/activities/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        error: 'Invalid activity ID',
        message: 'Activity ID must be a valid number'
      });
    }

    const activity = await stravaApiRequest(
      `https://www.strava.com/api/v3/activities/${id}`,
      req.session.strava.accessToken
    );

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
 * Used for high-resolution map generation
 */
router.get('/activities/:id/streams', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { types = 'latlng,altitude,time' } = req.query;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        error: 'Invalid activity ID',
        message: 'Activity ID must be a valid number'
      });
    }

    const streams = await stravaApiRequest(
      `https://www.strava.com/api/v3/activities/${id}/streams/${types}?key_by_type=true`,
      req.session.strava.accessToken
    );

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
 * Search activities by criteria
 * Query parameters:
 * - q: Search query (activity name)
 * - type: Activity type filter
 * - start_date: Start date filter (YYYY-MM-DD)
 * - end_date: End date filter (YYYY-MM-DD)
 */
router.get('/activities/search', requireAuth, async (req, res) => {
  try {
    const { q, type, start_date, end_date, page = 1, per_page = 30 } = req.query;

    // First, get all activities (we'll filter client-side since Strava API doesn't support search)
    const params = new URLSearchParams({
      page: page.toString(),
      per_page: Math.min(200, parseInt(per_page)).toString()
    });

    // Add date filters if provided
    if (start_date) {
      const startTimestamp = Math.floor(new Date(start_date).getTime() / 1000);
      params.append('after', startTimestamp.toString());
    }
    
    if (end_date) {
      const endTimestamp = Math.floor(new Date(end_date).getTime() / 1000);
      params.append('before', endTimestamp.toString());
    }

    const activities = await stravaApiRequest(
      `https://www.strava.com/api/v3/athlete/activities?${params}`,
      req.session.strava.accessToken
    );

    // Filter activities based on search criteria
    let filteredActivities = activities;

    if (q) {
      const searchTerm = q.toLowerCase();
      filteredActivities = filteredActivities.filter(activity =>
        activity.name.toLowerCase().includes(searchTerm)
      );
    }

    if (type) {
      filteredActivities = filteredActivities.filter(activity =>
        activity.type.toLowerCase() === type.toLowerCase() ||
        activity.sport_type?.toLowerCase() === type.toLowerCase()
      );
    }

    // Format activities
    const formattedActivities = filteredActivities.map(activity => ({
      id: activity.id,
      name: activity.name,
      type: activity.type,
      sport_type: activity.sport_type,
      start_date: activity.start_date,
      distance: activity.distance,
      moving_time: activity.moving_time,
      start_latlng: activity.start_latlng,
      map: activity.map ? {
        summary_polyline: activity.map.summary_polyline
      } : null
    }));

    res.json({
      success: true,
      activities: formattedActivities,
      search_criteria: { q, type, start_date, end_date },
      total_results: formattedActivities.length
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

module.exports = router;