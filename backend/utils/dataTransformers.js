/**
 * Data Transformation Layer for Strava API Integration
 * 
 * This module provides utilities to transform Strava API responses into 
 * application-specific data structures optimized for map generation,
 * user interface display, and print processing.
 * 
 * Key Functions:
 * - Transform raw Strava activity data into normalized application format
 * - Extract and process polyline data for map rendering
 * - Convert units and normalize data types
 * - Handle missing or malformed data gracefully
 * - Optimize data structures for different use cases (list view vs. detailed view)
 */

/**
 * Transform raw Strava activity data into normalized application format
 * Optimized for activity list displays and basic filtering
 * 
 * @param {Object} stravaActivity - Raw activity object from Strava API
 * @returns {Object} - Transformed activity object
 */
function transformActivitySummary(stravaActivity) {
  if (!stravaActivity || typeof stravaActivity !== 'object') {
    throw new Error('Invalid activity data: expected object');
  }

  return {
    // Core identification
    id: stravaActivity.id,
    name: stravaActivity.name || 'Untitled Activity',
    
    // Activity classification
    type: stravaActivity.type,
    sport_type: stravaActivity.sport_type,
    
    // Timing data
    start_date: stravaActivity.start_date,
    start_date_local: stravaActivity.start_date_local,
    timezone: stravaActivity.timezone,
    
    // Performance metrics
    distance: {
      meters: stravaActivity.distance || 0,
      kilometers: (stravaActivity.distance || 0) / 1000,
      miles: (stravaActivity.distance || 0) / 1609.34
    },
    
    duration: {
      moving_time_seconds: stravaActivity.moving_time || 0,
      elapsed_time_seconds: stravaActivity.elapsed_time || 0,
      moving_time_formatted: formatDuration(stravaActivity.moving_time || 0),
      elapsed_time_formatted: formatDuration(stravaActivity.elapsed_time || 0)
    },
    
    elevation: {
      gain_meters: stravaActivity.total_elevation_gain || 0,
      gain_feet: ((stravaActivity.total_elevation_gain || 0) * 3.28084),
      high_meters: stravaActivity.elev_high,
      low_meters: stravaActivity.elev_low,
      high_feet: stravaActivity.elev_high ? stravaActivity.elev_high * 3.28084 : null,
      low_feet: stravaActivity.elev_low ? stravaActivity.elev_low * 3.28084 : null
    },
    
    speed: {
      average_mps: stravaActivity.average_speed || 0,
      max_mps: stravaActivity.max_speed || 0,
      average_kmh: parseFloat(((stravaActivity.average_speed || 0) * 3.6).toFixed(1)),
      max_kmh: parseFloat(((stravaActivity.max_speed || 0) * 3.6).toFixed(1)),
      average_mph: parseFloat(((stravaActivity.average_speed || 0) * 2.23694).toFixed(1)),
      max_mph: parseFloat(((stravaActivity.max_speed || 0) * 2.23694).toFixed(1))
    },
    
    // Location data
    location: {
      start_coordinates: stravaActivity.start_latlng ? {
        lat: stravaActivity.start_latlng[0],
        lng: stravaActivity.start_latlng[1]
      } : null,
      end_coordinates: stravaActivity.end_latlng ? {
        lat: stravaActivity.end_latlng[0],
        lng: stravaActivity.end_latlng[1]
      } : null
    },
    
    // Map data for basic visualization
    map: transformMapSummary(stravaActivity.map),
    
    // Sensor data flags
    sensors: {
      has_heartrate: stravaActivity.has_heartrate || false,
      has_power: stravaActivity.device_watts || false,
      has_cadence: stravaActivity.average_cadence !== undefined
    },
    
    // Metadata
    metadata: {
      device_name: stravaActivity.device_name,
      gear_id: stravaActivity.gear_id,
      created_at: stravaActivity.start_date,
      updated_at: stravaActivity.updated_at
    }
  };
}

/**
 * Transform detailed Strava activity data for map generation and detailed view
 * Includes full polyline data and comprehensive metrics
 * 
 * @param {Object} stravaActivity - Detailed activity object from Strava API
 * @returns {Object} - Transformed detailed activity object
 */
function transformActivityDetails(stravaActivity) {
  if (!stravaActivity || typeof stravaActivity !== 'object') {
    throw new Error('Invalid activity data: expected object');
  }

  const basicData = transformActivitySummary(stravaActivity);
  
  return {
    ...basicData,
    
    // Extended details
    description: stravaActivity.description,
    
    // Enhanced performance data
    heartrate: {
      average: stravaActivity.average_heartrate,
      max: stravaActivity.max_heartrate
    },
    
    power: {
      average_watts: stravaActivity.average_watts,
      max_watts: stravaActivity.max_watts,
      weighted_average_watts: stravaActivity.weighted_average_watts,
      kilojoules: stravaActivity.kilojoules
    },
    
    cadence: {
      average: stravaActivity.average_cadence
    },
    
    temperature: {
      average_celsius: stravaActivity.average_temp,
      average_fahrenheit: stravaActivity.average_temp ? (stravaActivity.average_temp * 9/5) + 32 : null
    },
    
    // Enhanced map data with full polyline
    map: transformMapDetails(stravaActivity.map),
    
    // Training data
    training: {
      workout_type: stravaActivity.workout_type,
      trainer: stravaActivity.trainer,
      commute: stravaActivity.commute
    },
    
    // Social data
    social: {
      achievement_count: stravaActivity.achievement_count,
      kudos_count: stravaActivity.kudos_count,
      comment_count: stravaActivity.comment_count,
      athlete_count: stravaActivity.athlete_count,
      photo_count: stravaActivity.photo_count
    }
  };
}

/**
 * Transform Strava activity streams data for map rendering
 * Converts GPS streams into format suitable for Mapbox GL JS
 * 
 * @param {Object} stravaStreams - Streams object from Strava API
 * @param {number} activityId - Activity ID for reference
 * @returns {Object} - Transformed streams data
 */
function transformActivityStreams(stravaStreams, activityId) {
  if (!stravaStreams || typeof stravaStreams !== 'object') {
    throw new Error('Invalid streams data: expected object');
  }

  const result = {
    activity_id: activityId,
    coordinates: [],
    elevation_profile: [],
    time_series: [],
    has_gps_data: false,
    has_altitude_data: false,
    has_time_data: false,
    bounds: null
  };

  // Process coordinate data
  if (stravaStreams.latlng && stravaStreams.latlng.data) {
    result.has_gps_data = true;
    result.coordinates = stravaStreams.latlng.data.map(coord => [coord[1], coord[0]]); // Convert to [lng, lat] for Mapbox
    result.bounds = calculateBounds(result.coordinates);
  }

  // Process altitude data
  if (stravaStreams.altitude && stravaStreams.altitude.data) {
    result.has_altitude_data = true;
    result.elevation_profile = stravaStreams.altitude.data.map((alt, index) => ({
      distance: index * (result.total_distance || 0) / stravaStreams.altitude.data.length,
      elevation_meters: alt,
      elevation_feet: alt * 3.28084
    }));
  }

  // Process time data
  if (stravaStreams.time && stravaStreams.time.data) {
    result.has_time_data = true;
    result.time_series = stravaStreams.time.data;
  }

  // Create GeoJSON feature for map rendering
  if (result.has_gps_data) {
    result.geojson = {
      type: 'Feature',
      properties: {
        activity_id: activityId,
        total_points: result.coordinates.length
      },
      geometry: {
        type: 'LineString',
        coordinates: result.coordinates
      }
    };
  }

  return result;
}

/**
 * Transform basic map data from activity summary
 * 
 * @param {Object} mapData - Map object from Strava activity
 * @returns {Object|null} - Transformed map summary or null if no map data
 */
function transformMapSummary(mapData) {
  if (!mapData) return null;

  return {
    id: mapData.id,
    has_polyline: Boolean(mapData.summary_polyline),
    summary_polyline: mapData.summary_polyline,
    resource_state: mapData.resource_state,
    coordinates: mapData.summary_polyline ? decodePolyline(mapData.summary_polyline) : null
  };
}

/**
 * Transform detailed map data for full map generation
 * 
 * @param {Object} mapData - Detailed map object from Strava activity
 * @returns {Object|null} - Transformed detailed map data or null if no map data
 */
function transformMapDetails(mapData) {
  if (!mapData) return null;

  const summary = transformMapSummary(mapData);
  
  return {
    ...summary,
    full_polyline: mapData.polyline,
    has_full_polyline: Boolean(mapData.polyline),
    full_coordinates: mapData.polyline ? decodePolyline(mapData.polyline) : null,
    bounds: mapData.polyline ? calculateBounds(decodePolyline(mapData.polyline)) : null
  };
}

/**
 * Transform athlete data from Strava API
 * 
 * @param {Object} stravaAthlete - Athlete object from Strava API
 * @returns {Object} - Transformed athlete data
 */
function transformAthleteData(stravaAthlete) {
  if (!stravaAthlete || typeof stravaAthlete !== 'object') {
    throw new Error('Invalid athlete data: expected object');
  }

  return {
    id: stravaAthlete.id,
    profile: {
      username: stravaAthlete.username,
      first_name: stravaAthlete.firstname,
      last_name: stravaAthlete.lastname,
      full_name: `${stravaAthlete.firstname || ''} ${stravaAthlete.lastname || ''}`.trim(),
      profile_image: stravaAthlete.profile_medium || stravaAthlete.profile,
      created_at: stravaAthlete.created_at,
      updated_at: stravaAthlete.updated_at
    },
    location: {
      city: stravaAthlete.city,
      state: stravaAthlete.state,
      country: stravaAthlete.country,
      location_string: [stravaAthlete.city, stravaAthlete.state, stravaAthlete.country]
        .filter(Boolean)
        .join(', ')
    },
    preferences: {
      measurement_preference: stravaAthlete.measurement_preference,
      weight: stravaAthlete.weight,
      ftp: stravaAthlete.ftp
    }
  };
}

/**
 * Decode Google Polyline Algorithm encoded string
 * 
 * @param {string} encoded - Encoded polyline string
 * @returns {Array} - Array of [longitude, latitude] coordinates
 */
function decodePolyline(encoded) {
  if (!encoded || typeof encoded !== 'string') {
    return [];
  }

  const coordinates = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b;
    let shift = 0;
    let result = 0;
    
    // Decode latitude
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    
    const deltaLat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += deltaLat;

    shift = 0;
    result = 0;
    
    // Decode longitude
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    
    const deltaLng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += deltaLng;

    coordinates.push([lng / 1e5, lat / 1e5]); // [longitude, latitude]
  }

  return coordinates;
}

/**
 * Calculate bounding box for an array of coordinates
 * 
 * @param {Array} coordinates - Array of [longitude, latitude] coordinates
 * @returns {Object|null} - Bounding box object or null if no coordinates
 */
function calculateBounds(coordinates) {
  if (!coordinates || !Array.isArray(coordinates) || coordinates.length === 0) {
    return null;
  }

  let minLng = coordinates[0][0];
  let maxLng = coordinates[0][0];
  let minLat = coordinates[0][1];
  let maxLat = coordinates[0][1];

  for (const coord of coordinates) {
    if (coord[0] < minLng) minLng = coord[0];
    if (coord[0] > maxLng) maxLng = coord[0];
    if (coord[1] < minLat) minLat = coord[1];
    if (coord[1] > maxLat) maxLat = coord[1];
  }

  return {
    southwest: [minLng, minLat],
    northeast: [maxLng, maxLat],
    center: [(minLng + maxLng) / 2, (minLat + maxLat) / 2]
  };
}

/**
 * Format duration in seconds to human readable format
 * 
 * @param {number} seconds - Duration in seconds
 * @returns {string} - Formatted duration string
 */
function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) {
    return '0:00';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}

/**
 * Normalize activity data for consistent processing
 * Handles missing fields and data type consistency
 * 
 * @param {Object} activity - Activity object to normalize
 * @returns {Object} - Normalized activity object
 */
function normalizeActivityData(activity) {
  if (!activity || typeof activity !== 'object') {
    throw new Error('Invalid activity data: expected object');
  }

  return {
    // Preserve other fields first
    ...activity,
    
    // Then override with normalized values
    id: parseInt(activity.id) || 0,
    distance: parseFloat(activity.distance) || 0,
    moving_time: parseInt(activity.moving_time) || 0,
    elapsed_time: parseInt(activity.elapsed_time) || 0,
    total_elevation_gain: parseFloat(activity.total_elevation_gain) || 0,
    average_speed: parseFloat(activity.average_speed) || 0,
    max_speed: parseFloat(activity.max_speed) || 0,
    
    // Ensure string fields are strings
    name: String(activity.name || ''),
    type: String(activity.type || ''),
    sport_type: String(activity.sport_type || '')
  };
}

/**
 * Transform activity data for map generation specifically
 * Optimizes data structure for Mapbox GL JS integration
 * 
 * @param {Object} activity - Activity object with map data
 * @returns {Object} - Map-optimized activity data
 */
function transformForMapGeneration(activity) {
  const normalized = normalizeActivityData(activity);
  const transformed = transformActivityDetails(normalized);
  
  return {
    activity_id: transformed.id,
    activity_name: transformed.name,
    activity_type: transformed.type,
    
    // Metrics for map display
    metrics: {
      distance_display: `${transformed.distance.kilometers.toFixed(1)} km`,
      duration_display: transformed.duration.moving_time_formatted,
      elevation_display: `${Math.round(transformed.elevation.gain_meters)} m`,
      speed_display: `${transformed.speed.average_kmh.toFixed(1)} km/h`
    },
    
    // Map rendering data
    geometry: transformed.map,
    bounds: transformed.map ? transformed.map.bounds : null,
    
    // Style hints for map rendering
    style_hints: {
      activity_type: transformed.type.toLowerCase(),
      color_category: getActivityColorCategory(transformed.type),
      line_weight: getActivityLineWeight(transformed.distance.meters)
    }
  };
}

/**
 * Get color category for activity type (for map styling)
 * 
 * @param {string} activityType - Strava activity type
 * @returns {string} - Color category for styling
 */
function getActivityColorCategory(activityType) {
  const colorMap = {
    'Ride': 'cycling',
    'VirtualRide': 'cycling',
    'EBikeRide': 'cycling',
    'Run': 'running',
    'VirtualRun': 'running',
    'Hike': 'hiking',
    'Walk': 'walking',
    'Swim': 'swimming'
  };
  
  return colorMap[activityType] || 'other';
}

/**
 * Get line weight for activity based on distance (for map styling)
 * 
 * @param {number} distanceMeters - Activity distance in meters
 * @returns {number} - Line weight for map rendering
 */
function getActivityLineWeight(distanceMeters) {
  if (distanceMeters > 100000) return 4; // Long activities (>100km)
  if (distanceMeters > 50000) return 3;  // Medium activities (50-100km)
  if (distanceMeters > 10000) return 2;  // Short activities (10-50km)
  return 1; // Very short activities (<10km)
}

module.exports = {
  transformActivitySummary,
  transformActivityDetails,
  transformActivityStreams,
  transformAthleteData,
  transformForMapGeneration,
  decodePolyline,
  calculateBounds,
  formatDuration,
  normalizeActivityData,
  getActivityColorCategory,
  getActivityLineWeight
};