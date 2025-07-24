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

const geojsonConverter = require('../services/geojsonConverter');

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

  // Create GeoJSON feature for map rendering using the new converter
  if (result.has_gps_data) {
    try {
      result.geojson = geojsonConverter.convertToGeoJSON(result, {
        source: 'strava_polyline',
        includeElevation: result.has_altitude_data,
        includeTimestamps: result.has_time_data,
        validateOutput: true,
        optimizeForMapbox: true
      });
    } catch (geoJSONError) {
      console.warn('GeoJSON conversion failed for activity streams, using fallback:', geoJSONError.message);
      
      // Fallback to basic GeoJSON
      result.geojson = {
        type: 'Feature',
        properties: {
          activity_id: activityId,
          total_points: result.coordinates.length,
          source: 'strava_streams'
        },
        geometry: {
          type: 'LineString',
          coordinates: result.coordinates
        }
      };
    }
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
 * Decode Google Polyline Algorithm encoded string with enhanced error handling
 * 
 * @param {string} encoded - Encoded polyline string
 * @param {Object} options - Decoding options
 * @param {number} options.precision - Precision factor (default: 1e5)
 * @param {boolean} options.validateCoords - Validate coordinate ranges (default: true)
 * @returns {Array} - Array of [longitude, latitude] coordinates
 * @throws {Error} - If decoding fails or coordinates are invalid
 */
function decodePolyline(encoded, options = {}) {
  const {
    precision = 1e5,
    validateCoords = true
  } = options;

  if (encoded === null || encoded === undefined || typeof encoded !== 'string') {
    throw new Error('Invalid polyline: expected string');  
  }

  if (encoded.length === 0) {
    return [];
  }

  const coordinates = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  try {
    while (index < encoded.length) {
      let b;
      let shift = 0;
      let result = 0;
      
      // Decode latitude
      do {
        if (index >= encoded.length) {
          throw new Error('Unexpected end of polyline string while decoding latitude');
        }
        b = encoded.charCodeAt(index++) - 63;
        if (b < 0 || b > 95) {
          throw new Error(`Invalid character in polyline at position ${index - 1}`);
        }
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      
      const deltaLat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += deltaLat;

      shift = 0;
      result = 0;
      
      // Decode longitude
      do {
        if (index >= encoded.length) {
          throw new Error('Unexpected end of polyline string while decoding longitude');
        }
        b = encoded.charCodeAt(index++) - 63;
        if (b < 0 || b > 95) {
          throw new Error(`Invalid character in polyline at position ${index - 1}`);
        }
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      
      const deltaLng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += deltaLng;

      const longitude = lng / precision;
      const latitude = lat / precision;

      // Validate coordinate ranges if requested
      if (validateCoords) {
        if (latitude < -90 || latitude > 90) {
          throw new Error(`Invalid latitude ${latitude} at coordinate ${coordinates.length}`);
        }
        if (longitude < -180 || longitude > 180) {
          throw new Error(`Invalid longitude ${longitude} at coordinate ${coordinates.length}`);
        }
      }

      coordinates.push([longitude, latitude]); // [longitude, latitude]
    }

    return coordinates;
  } catch (error) {
    throw new Error(`Polyline decoding failed: ${error.message}`);
  }
}

/**
 * Encode coordinates to Google Polyline Algorithm format
 * 
 * @param {Array} coordinates - Array of [longitude, latitude] coordinates
 * @param {Object} options - Encoding options
 * @param {number} options.precision - Precision factor (default: 1e5)
 * @returns {string} - Encoded polyline string
 * @throws {Error} - If encoding fails
 */
function encodePolyline(coordinates, options = {}) {
  const { precision = 1e5 } = options;

  if (!Array.isArray(coordinates)) {
    throw new Error('Invalid coordinates: expected array');
  }

  if (coordinates.length === 0) {
    return '';
  }

  let encoded = '';
  let prevLat = 0;
  let prevLng = 0;

  try {
    for (let i = 0; i < coordinates.length; i++) {
      const coord = coordinates[i];
      
      if (!Array.isArray(coord) || coord.length < 2) {
        throw new Error(`Invalid coordinate at index ${i}: expected [lng, lat] array`);
      }

      const lng = Math.round(coord[0] * precision);
      const lat = Math.round(coord[1] * precision);

      const deltaLat = lat - prevLat;
      const deltaLng = lng - prevLng;

      encoded += encodeSignedNumber(deltaLat);
      encoded += encodeSignedNumber(deltaLng);

      prevLat = lat;
      prevLng = lng;
    }

    return encoded;
  } catch (error) {
    throw new Error(`Polyline encoding failed: ${error.message}`);
  }
}

/**
 * Encode a signed number for polyline algorithm
 * 
 * @param {number} num - Number to encode
 * @returns {string} - Encoded string
 */
function encodeSignedNumber(num) {
  let sgn_num = num << 1;
  if (num < 0) {
    sgn_num = ~sgn_num;
  }
  return encodeNumber(sgn_num);
}

/**
 * Encode a number for polyline algorithm
 * 
 * @param {number} num - Number to encode
 * @returns {string} - Encoded string
 */
function encodeNumber(num) {
  let encoded = '';
  while (num >= 0x20) {
    encoded += String.fromCharCode((0x20 | (num & 0x1f)) + 63);
    num >>= 5;
  }
  encoded += String.fromCharCode(num + 63);
  return encoded;
}

// ==================== COORDINATE TRANSFORMATION UTILITIES ====================

/**
 * Earth radius in meters (WGS84)
 */
const EARTH_RADIUS = 6378137;

/**
 * Maximum latitude for Web Mercator projection (approximately 85.051129°)
 */
const MAX_MERCATOR_LAT = 85.0511287798;

/**
 * Convert WGS84 coordinates to Web Mercator projection
 * Used by Mapbox GL JS internally
 * 
 * @param {number} longitude - Longitude in decimal degrees (-180 to 180)
 * @param {number} latitude - Latitude in decimal degrees (-85.051129 to 85.051129)
 * @returns {Object} - {x, y} coordinates in meters
 * @throws {Error} - If coordinates are out of valid range
 */
function wgs84ToWebMercator(longitude, latitude) {
  // Validate input ranges
  if (longitude < -180 || longitude > 180) {
    throw new Error(`Invalid longitude ${longitude}: must be between -180 and 180`);
  }
  if (latitude < -MAX_MERCATOR_LAT || latitude > MAX_MERCATOR_LAT) {
    throw new Error(`Invalid latitude ${latitude}: must be between -${MAX_MERCATOR_LAT} and ${MAX_MERCATOR_LAT}`);
  }

  // Convert to radians
  const lonRad = longitude * Math.PI / 180;
  const latRad = latitude * Math.PI / 180;

  // Calculate Web Mercator coordinates
  const x = EARTH_RADIUS * lonRad;
  const y = EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + latRad / 2));

  return { x, y };
}

/**
 * Convert Web Mercator projection to WGS84 coordinates
 * 
 * @param {number} x - X coordinate in meters
 * @param {number} y - Y coordinate in meters
 * @returns {Object} - {longitude, latitude} in decimal degrees
 */
function webMercatorToWgs84(x, y) {
  // Convert from meters to radians
  const lonRad = x / EARTH_RADIUS;
  const latRad = 2 * (Math.atan(Math.exp(y / EARTH_RADIUS)) - Math.PI / 4);

  // Convert to degrees
  const longitude = lonRad * 180 / Math.PI;
  const latitude = latRad * 180 / Math.PI;

  // Clamp latitude to valid range
  const clampedLat = Math.max(-MAX_MERCATOR_LAT, Math.min(MAX_MERCATOR_LAT, latitude));

  return { longitude, latitude: clampedLat };
}

/**
 * Transform coordinates array between projection systems
 * 
 * @param {Array} coordinates - Array of [lng, lat] coordinates  
 * @param {string} fromProjection - Source projection ('wgs84' or 'webmercator')
 * @param {string} toProjection - Target projection ('wgs84' or 'webmercator')
 * @returns {Array} - Transformed coordinates array
 * @throws {Error} - If projection types are invalid or transformation fails
 */
function transformCoordinates(coordinates, fromProjection, toProjection) {
  if (!Array.isArray(coordinates)) {
    throw new Error('Invalid coordinates: expected array');
  }

  if (fromProjection === toProjection) {
    return coordinates; // No transformation needed
  }

  const validProjections = ['wgs84', 'webmercator'];
  if (!validProjections.includes(fromProjection)) {
    throw new Error(`Invalid source projection: ${fromProjection}. Valid options: ${validProjections.join(', ')}`);
  }
  if (!validProjections.includes(toProjection)) {
    throw new Error(`Invalid target projection: ${toProjection}. Valid options: ${validProjections.join(', ')}`);
  }

  return coordinates.map((coord, index) => {
    if (!Array.isArray(coord) || coord.length < 2) {
      throw new Error(`Invalid coordinate at index ${index}: expected [lng, lat] array`);
    }

    try {
      if (fromProjection === 'wgs84' && toProjection === 'webmercator') {
        const { x, y } = wgs84ToWebMercator(coord[0], coord[1]);
        return [x, y];
      } else if (fromProjection === 'webmercator' && toProjection === 'wgs84') {
        const { longitude, latitude } = webMercatorToWgs84(coord[0], coord[1]);
        return [longitude, latitude];
      }
    } catch (error) {
      throw new Error(`Coordinate transformation failed at index ${index}: ${error.message}`);
    }
  });
}

/**
 * Handle antimeridian crossing in coordinate arrays
 * Splits paths that cross the 180°/-180° longitude line
 * 
 * @param {Array} coordinates - Array of [lng, lat] coordinates
 * @param {Object} options - Processing options
 * @param {number} options.threshold - Longitude difference threshold to detect crossing (default: 180)
 * @returns {Array} - Array of coordinate arrays (segments)
 */
function handleAntimeridianCrossing(coordinates, options = {}) {
  const { threshold = 180 } = options;

  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return [coordinates];
  }

  const segments = [];
  let currentSegment = [coordinates[0]];

  for (let i = 1; i < coordinates.length; i++) {
    const prevCoord = coordinates[i - 1];
    const currentCoord = coordinates[i];

    const lngDiff = Math.abs(currentCoord[0] - prevCoord[0]);

    if (lngDiff > threshold) {
      // Antimeridian crossing detected
      segments.push([...currentSegment]);
      currentSegment = [currentCoord];
    } else {
      currentSegment.push(currentCoord);
    }
  }

  segments.push(currentSegment);
  return segments.filter(segment => segment.length > 0);
}

/**
 * Normalize longitude to -180 to 180 range
 * 
 * @param {number} longitude - Longitude in degrees
 * @returns {number} - Normalized longitude
 */
function normalizeLongitude(longitude) {
  if (typeof longitude !== 'number' || isNaN(longitude)) {
    throw new Error('Invalid longitude: expected number');
  }
  
  let normalized = longitude % 360;
  if (normalized > 180) {
    normalized -= 360;
  } else if (normalized < -180) {
    normalized += 360;
  }
  return normalized;
}

/**
 * Clamp latitude to valid WGS84 range (-90 to 90)
 * 
 * @param {number} latitude - Latitude in degrees
 * @returns {number} - Clamped latitude
 */
function clampLatitude(latitude) {
  if (typeof latitude !== 'number' || isNaN(latitude)) {
    throw new Error('Invalid latitude: expected number');
  }
  
  return Math.max(-90, Math.min(90, latitude));
}

/**
 * Handle polar coordinates near the poles
 * Clamps coordinates to valid ranges and handles edge cases
 * 
 * @param {Array} coordinates - Array of [lng, lat] coordinates
 * @param {Object} options - Processing options
 * @param {number} options.polarThreshold - Latitude threshold for polar regions (default: 85)
 * @param {boolean} options.clampToMercatorLimits - Clamp to Web Mercator limits (default: true)
 * @returns {Array} - Processed coordinates
 */
function handlePolarCoordinates(coordinates, options = {}) {
  const { 
    polarThreshold = 85,
    clampToMercatorLimits = true 
  } = options;

  if (!Array.isArray(coordinates)) {
    throw new Error('Invalid coordinates: expected array');
  }

  const maxLat = clampToMercatorLimits ? MAX_MERCATOR_LAT : 90;
  const minLat = clampToMercatorLimits ? -MAX_MERCATOR_LAT : -90;

  return coordinates.map((coord, index) => {
    if (!Array.isArray(coord) || coord.length < 2) {
      throw new Error(`Invalid coordinate at index ${index}: expected [lng, lat] array`);
    }

    let [lng, lat] = coord;

    // Normalize longitude
    lng = normalizeLongitude(lng);

    // Handle polar regions
    if (Math.abs(lat) > polarThreshold) {
      // Clamp latitude to valid range
      lat = Math.max(minLat, Math.min(maxLat, lat));
      
      // In polar regions, longitude becomes less meaningful
      // Optionally normalize to prevent extreme values
      if (Math.abs(lat) > MAX_MERCATOR_LAT - 0.1) {
        // Very close to poles - longitude is essentially meaningless
        lng = Math.max(-180, Math.min(180, lng));
      }
    } else {
      // Standard latitude clamping
      lat = clampLatitude(lat);
    }

    return [lng, lat];
  });
}

/**
 * Calculate bounding box for an array of coordinates with projection awareness
 * 
 * @param {Array} coordinates - Array of [longitude, latitude] coordinates
 * @param {Object} options - Calculation options
 * @param {string} options.projection - Coordinate projection ('wgs84' or 'webmercator')
 * @param {boolean} options.handleAntimeridian - Handle antimeridian crossing (default: true)
 * @returns {Object|null} - Bounding box object or null if no coordinates
 */
function calculateBounds(coordinates, options = {}) {
  const { 
    projection = 'wgs84',
    handleAntimeridian = true 
  } = options;

  if (!coordinates || !Array.isArray(coordinates) || coordinates.length === 0) {
    return null;
  }

  // Handle antimeridian crossing if requested and using WGS84
  let processedCoords = coordinates;
  if (handleAntimeridian && projection === 'wgs84') {
    const segments = handleAntimeridianCrossing(coordinates);
    if (segments.length > 1) {
      // For multiple segments, calculate bounds for each and combine
      const allBounds = segments.map(segment => calculateBounds(segment, { 
        ...options, 
        handleAntimeridian: false 
      })).filter(Boolean);
      
      if (allBounds.length === 0) return null;
      
      // Combine all bounds
      let minLng = allBounds[0].southwest[0];
      let maxLng = allBounds[0].northeast[0];
      let minLat = allBounds[0].southwest[1];
      let maxLat = allBounds[0].northeast[1];

      for (const bounds of allBounds) {
        minLng = Math.min(minLng, bounds.southwest[0]);
        maxLng = Math.max(maxLng, bounds.northeast[0]);
        minLat = Math.min(minLat, bounds.southwest[1]);
        maxLat = Math.max(maxLat, bounds.northeast[1]);
      }

      return {
        southwest: [minLng, minLat],
        northeast: [maxLng, maxLat],
        center: [(minLng + maxLng) / 2, (minLat + maxLat) / 2],
        antimeridianCrossing: true
      };
    }
  }

  // Standard bounds calculation
  let minLng = processedCoords[0][0];
  let maxLng = processedCoords[0][0];
  let minLat = processedCoords[0][1];
  let maxLat = processedCoords[0][1];

  for (const coord of processedCoords) {
    if (coord[0] < minLng) minLng = coord[0];
    if (coord[0] > maxLng) maxLng = coord[0];
    if (coord[1] < minLat) minLat = coord[1];
    if (coord[1] > maxLat) maxLat = coord[1];
  }

  return {
    southwest: [minLng, minLat],
    northeast: [maxLng, maxLat],
    center: [(minLng + maxLng) / 2, (minLat + maxLat) / 2],
    antimeridianCrossing: false
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

/**
 * Transform elevation data specifically for chart visualization
 * Processes raw elevation streams into optimized chart-ready format
 * 
 * @param {Object} stravaStreams - Streams data from Strava API
 * @param {Object} options - Processing options
 * @param {number} options.maxPoints - Maximum number of points for performance (default: 1000)
 * @param {boolean} options.includeGradient - Calculate gradient data (default: true)
 * @param {string} options.units - Unit system 'metric' or 'imperial' (default: 'metric')
 * @returns {Object} - Chart-ready elevation data
 */
function transformElevationForChart(stravaStreams, options = {}) {
  const {
    maxPoints = 1000,
    includeGradient = true,
    units = 'metric'
  } = options;

  if (!stravaStreams || !stravaStreams.altitude || !stravaStreams.altitude.data) {
    return {
      elevation: [],
      stats: null,
      hasData: false,
      units: units
    };
  }

  const altitudeData = stravaStreams.altitude.data;
  const latlngData = stravaStreams.latlng ? stravaStreams.latlng.data : null;
  const timeData = stravaStreams.time ? stravaStreams.time.data : null;
  const distanceData = stravaStreams.distance ? stravaStreams.distance.data : null;

  // Calculate sampling interval for performance optimization
  const totalPoints = altitudeData.length;
  const sampleInterval = Math.max(1, Math.floor(totalPoints / maxPoints));

  const elevationPoints = [];
  let cumulativeDistance = 0;
  let totalGain = 0;
  let totalLoss = 0;
  let minElevation = Infinity;
  let maxElevation = -Infinity;
  let elevationSum = 0;

  for (let i = 0; i < totalPoints; i += sampleInterval) {
    const elevation_meters = altitudeData[i];
    const elevation_feet = elevation_meters * 3.28084;
    
    // Calculate distance
    let distance_km = 0;
    let distance_miles = 0;
    
    if (distanceData && distanceData[i]) {
      distance_km = distanceData[i] / 1000;
      distance_miles = distanceData[i] / 1609.34;
    } else if (latlngData && i > 0) {
      // Calculate cumulative distance from coordinates
      const prevCoord = latlngData[i - sampleInterval] || latlngData[Math.max(0, i - 1)];
      const currentCoord = latlngData[i];
      if (prevCoord && currentCoord) {
        const segmentDistance = calculateHaversineDistance(
          prevCoord[0], prevCoord[1],
          currentCoord[0], currentCoord[1]
        );
        cumulativeDistance += segmentDistance;
      }
      distance_km = cumulativeDistance / 1000;
      distance_miles = cumulativeDistance / 1609.34;
    } else {
      // Fallback: estimate distance based on index and total distance
      const estimatedTotalDistance = estimateTotalDistance(latlngData);
      const ratio = i / (totalPoints - 1);
      distance_km = (estimatedTotalDistance * ratio) / 1000;
      distance_miles = (estimatedTotalDistance * ratio) / 1609.34;
    }

    // Calculate gradient if requested and possible
    let gradient = null;
    if (includeGradient && i > 0 && elevationPoints.length > 0) {
      const prevPoint = elevationPoints[elevationPoints.length - 1];
      const elevationDiff = elevation_meters - prevPoint.elevation_meters;
      const distanceDiff = (distance_km - prevPoint.distance_km) * 1000; // Convert to meters
      if (distanceDiff > 0) {
        gradient = (elevationDiff / distanceDiff) * 100; // Percentage grade
      }
    }

    // Track elevation statistics
    if (elevation_meters < minElevation) minElevation = elevation_meters;
    if (elevation_meters > maxElevation) maxElevation = elevation_meters;
    elevationSum += elevation_meters;

    // Calculate elevation gain/loss
    if (elevationPoints.length > 0) {
      const elevationChange = elevation_meters - elevationPoints[elevationPoints.length - 1].elevation_meters;
      if (elevationChange > 0) {
        totalGain += elevationChange;
      } else {
        totalLoss += Math.abs(elevationChange);
      }
    }

    elevationPoints.push({
      index: i,
      elevation_meters: Math.round(elevation_meters * 10) / 10,
      elevation_feet: Math.round(elevation_feet * 10) / 10,
      distance_km: Math.round(distance_km * 100) / 100,
      distance_miles: Math.round(distance_miles * 100) / 100,
      gradient: gradient ? Math.round(gradient * 10) / 10 : null,
      time_seconds: timeData ? timeData[i] : null
    });
  }

  // Calculate final statistics
  const avgElevation = elevationSum / elevationPoints.length;
  const stats = {
    gain: Math.round(totalGain),
    loss: Math.round(totalLoss),
    min: Math.round(minElevation),
    max: Math.round(maxElevation),
    avg: Math.round(avgElevation),
    // Imperial conversions
    gain_feet: Math.round(totalGain * 3.28084),
    loss_feet: Math.round(totalLoss * 3.28084),
    min_feet: Math.round(minElevation * 3.28084),
    max_feet: Math.round(maxElevation * 3.28084),
    avg_feet: Math.round(avgElevation * 3.28084),
    // Additional metrics
    elevation_range: Math.round(maxElevation - minElevation),
    elevation_range_feet: Math.round((maxElevation - minElevation) * 3.28084),
    total_distance_km: elevationPoints.length > 0 ? elevationPoints[elevationPoints.length - 1].distance_km : 0,
    total_distance_miles: elevationPoints.length > 0 ? elevationPoints[elevationPoints.length - 1].distance_miles : 0
  };

  return {
    elevation: elevationPoints,
    stats: stats,
    hasData: true,
    units: units,
    sampleInterval: sampleInterval,
    originalPoints: totalPoints
  };
}

/**
 * Calculate Haversine distance between two points
 * 
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point  
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} - Distance in meters
 */
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
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
 * Estimate total distance from coordinate array
 * 
 * @param {Array} latlngData - Array of [lat, lng] coordinates
 * @returns {number} - Estimated total distance in meters
 */
function estimateTotalDistance(latlngData) {
  if (!latlngData || latlngData.length < 2) return 0;
  
  let totalDistance = 0;
  for (let i = 1; i < latlngData.length; i++) {
    const prev = latlngData[i - 1];
    const current = latlngData[i];
    totalDistance += calculateHaversineDistance(prev[0], prev[1], current[0], current[1]);
  }
  
  return totalDistance;
}

module.exports = {
  // Activity transformation functions
  transformActivitySummary,
  transformActivityDetails,
  transformActivityStreams,
  transformAthleteData,
  transformForMapGeneration,
  transformElevationForChart,
  normalizeActivityData,
  getActivityColorCategory,
  getActivityLineWeight,
  formatDuration,
  calculateHaversineDistance,
  estimateTotalDistance,
  
  // Polyline encoding/decoding functions
  decodePolyline,
  encodePolyline,
  
  // Coordinate transformation functions
  wgs84ToWebMercator,
  webMercatorToWgs84,
  transformCoordinates,
  
  // Coordinate utility functions
  handleAntimeridianCrossing,
  handlePolarCoordinates,
  normalizeLongitude,
  clampLatitude,
  calculateBounds
};