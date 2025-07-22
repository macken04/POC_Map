/**
 * Activity Filtering and Sorting Utilities
 * Provides comprehensive filtering and sorting capabilities for Strava activities
 * 
 * Since Strava API has limited filtering capabilities, most filtering is done client-side
 * after fetching activities from the API.
 */

/**
 * Validate and parse query parameters for activity filtering
 * @param {Object} query - Express req.query object
 * @returns {Object} - Parsed and validated parameters
 */
function validateAndParseQuery(query) {
  const params = {
    // Pagination
    page: Math.max(1, parseInt(query.page) || 1),
    per_page: Math.min(200, Math.max(1, parseInt(query.per_page) || 30)),
    
    // Date filtering (Strava API supports these)
    before: query.before,
    after: query.after,
    
    // Enhanced filtering (client-side)
    activity_types: query.activity_types ? (Array.isArray(query.activity_types) ? query.activity_types : query.activity_types.split(',')) : null,
    min_distance: query.min_distance ? parseFloat(query.min_distance) : null,
    max_distance: query.max_distance ? parseFloat(query.max_distance) : null,
    min_elevation: query.min_elevation ? parseFloat(query.min_elevation) : null,
    max_elevation: query.max_elevation ? parseFloat(query.max_elevation) : null,
    min_duration: query.min_duration ? parseInt(query.min_duration) : null, // in seconds
    max_duration: query.max_duration ? parseInt(query.max_duration) : null, // in seconds
    
    // Search
    search_name: query.search_name ? query.search_name.toLowerCase() : null,
    
    // Sorting
    sort_by: query.sort_by || 'start_date',
    sort_order: query.sort_order === 'asc' ? 'asc' : 'desc'
  };
  
  // Validate date parameters if provided
  if (params.before && isNaN(parseInt(params.before))) {
    throw new Error('Invalid before parameter: must be a Unix timestamp');
  }
  
  if (params.after && isNaN(parseInt(params.after))) {
    throw new Error('Invalid after parameter: must be a Unix timestamp');
  }
  
  // Validate distance parameters
  if (params.min_distance !== null && (isNaN(params.min_distance) || params.min_distance < 0)) {
    throw new Error('Invalid min_distance parameter: must be a positive number');
  }
  
  if (params.max_distance !== null && (isNaN(params.max_distance) || params.max_distance < 0)) {
    throw new Error('Invalid max_distance parameter: must be a positive number');
  }
  
  if (params.min_distance !== null && params.max_distance !== null && params.min_distance > params.max_distance) {
    throw new Error('min_distance cannot be greater than max_distance');
  }
  
  // Validate elevation parameters
  if (params.min_elevation !== null && isNaN(params.min_elevation)) {
    throw new Error('Invalid min_elevation parameter: must be a number');
  }
  
  if (params.max_elevation !== null && isNaN(params.max_elevation)) {
    throw new Error('Invalid max_elevation parameter: must be a number');
  }
  
  if (params.min_elevation !== null && params.max_elevation !== null && params.min_elevation > params.max_elevation) {
    throw new Error('min_elevation cannot be greater than max_elevation');
  }
  
  // Validate duration parameters
  if (params.min_duration !== null && (isNaN(params.min_duration) || params.min_duration < 0)) {
    throw new Error('Invalid min_duration parameter: must be a positive number (seconds)');
  }
  
  if (params.max_duration !== null && (isNaN(params.max_duration) || params.max_duration < 0)) {
    throw new Error('Invalid max_duration parameter: must be a positive number (seconds)');
  }
  
  if (params.min_duration !== null && params.max_duration !== null && params.min_duration > params.max_duration) {
    throw new Error('min_duration cannot be greater than max_duration');
  }
  
  // Validate sort_by parameter
  const validSortFields = ['start_date', 'distance', 'moving_time', 'elapsed_time', 'total_elevation_gain', 'average_speed', 'max_speed', 'name'];
  if (!validSortFields.includes(params.sort_by)) {
    throw new Error(`Invalid sort_by parameter: must be one of ${validSortFields.join(', ')}`);
  }
  
  // Validate activity types if provided
  if (params.activity_types) {
    const validTypes = ['Ride', 'Run', 'Swim', 'Hike', 'Walk', 'AlpineSki', 'BackcountrySki', 'Canoeing', 'Crossfit', 
                       'EBikeRide', 'Elliptical', 'Golf', 'Handcycle', 'HighIntensityIntervalTraining', 'Kayaking', 
                       'Kitesurf', 'NordicSki', 'RockClimbing', 'RollerSki', 'Rowing', 'Sail', 'Skateboard', 
                       'Snowboard', 'Snowshoe', 'Soccer', 'StairStepper', 'StandUpPaddling', 'Surfing', 'VirtualRide', 
                       'VirtualRun', 'WeightTraining', 'Windsurf', 'Workout', 'Yoga'];
    
    params.activity_types.forEach(type => {
      if (!validTypes.includes(type)) {
        console.warn(`Unknown activity type: ${type}. Will still filter by it.`);
      }
    });
  }
  
  return params;
}

/**
 * Filter activities based on provided criteria
 * @param {Array} activities - Array of activity objects from Strava API
 * @param {Object} filters - Filter parameters
 * @returns {Array} - Filtered activities
 */
function filterActivities(activities, filters) {
  if (!Array.isArray(activities)) {
    return [];
  }
  
  return activities.filter(activity => {
    // Activity type filtering
    if (filters.activity_types && filters.activity_types.length > 0) {
      const activityMatch = filters.activity_types.some(type => 
        activity.type === type || activity.sport_type === type
      );
      if (!activityMatch) return false;
    }
    
    // Distance filtering (Strava provides distance in meters)
    if (filters.min_distance !== null && (!activity.distance || activity.distance < filters.min_distance)) {
      return false;
    }
    
    if (filters.max_distance !== null && (!activity.distance || activity.distance > filters.max_distance)) {
      return false;
    }
    
    // Elevation filtering (Strava provides elevation in meters)
    if (filters.min_elevation !== null && (!activity.total_elevation_gain || activity.total_elevation_gain < filters.min_elevation)) {
      return false;
    }
    
    if (filters.max_elevation !== null && (!activity.total_elevation_gain || activity.total_elevation_gain > filters.max_elevation)) {
      return false;
    }
    
    // Duration filtering (Strava provides moving_time and elapsed_time in seconds)
    const duration = activity.moving_time || activity.elapsed_time || 0;
    
    if (filters.min_duration !== null && duration < filters.min_duration) {
      return false;
    }
    
    if (filters.max_duration !== null && duration > filters.max_duration) {
      return false;
    }
    
    // Name search filtering
    if (filters.search_name && (!activity.name || !activity.name.toLowerCase().includes(filters.search_name))) {
      return false;
    }
    
    return true;
  });
}

/**
 * Sort activities based on specified criteria
 * @param {Array} activities - Array of activity objects
 * @param {string} sortBy - Field to sort by
 * @param {string} sortOrder - 'asc' or 'desc'
 * @returns {Array} - Sorted activities
 */
function sortActivities(activities, sortBy = 'start_date', sortOrder = 'desc') {
  if (!Array.isArray(activities)) {
    return [];
  }
  
  const sorted = [...activities].sort((a, b) => {
    let aValue, bValue;
    
    switch (sortBy) {
      case 'start_date':
        aValue = new Date(a.start_date || a.start_date_local).getTime();
        bValue = new Date(b.start_date || b.start_date_local).getTime();
        break;
        
      case 'distance':
        aValue = a.distance || 0;
        bValue = b.distance || 0;
        break;
        
      case 'moving_time':
        aValue = a.moving_time || 0;
        bValue = b.moving_time || 0;
        break;
        
      case 'elapsed_time':
        aValue = a.elapsed_time || 0;
        bValue = b.elapsed_time || 0;
        break;
        
      case 'total_elevation_gain':
        aValue = a.total_elevation_gain || 0;
        bValue = b.total_elevation_gain || 0;
        break;
        
      case 'average_speed':
        aValue = a.average_speed || 0;
        bValue = b.average_speed || 0;
        break;
        
      case 'max_speed':
        aValue = a.max_speed || 0;
        bValue = b.max_speed || 0;
        break;
        
      case 'name':
        aValue = (a.name || '').toLowerCase();
        bValue = (b.name || '').toLowerCase();
        break;
        
      default:
        aValue = a[sortBy] || 0;
        bValue = b[sortBy] || 0;
    }
    
    if (sortBy === 'name') {
      // String comparison
      if (sortOrder === 'asc') {
        return aValue.localeCompare(bValue);
      } else {
        return bValue.localeCompare(aValue);
      }
    } else {
      // Numeric comparison
      if (sortOrder === 'asc') {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    }
  });
  
  return sorted;
}

/**
 * Convert date string (YYYY-MM-DD) to Unix timestamp
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {number} - Unix timestamp in seconds
 */
function dateStringToTimestamp(dateString) {
  if (!dateString) return null;
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date format: ${dateString}. Use YYYY-MM-DD format.`);
  }
  
  return Math.floor(date.getTime() / 1000);
}

/**
 * Build Strava API query parameters for server-side filtering
 * (Only supports limited parameters that Strava API accepts)
 * @param {Object} params - Validated parameters
 * @returns {URLSearchParams} - Query parameters for Strava API
 */
function buildStravaApiParams(params) {
  const apiParams = new URLSearchParams({
    page: params.page.toString(),
    per_page: params.per_page.toString()
  });
  
  // Only add parameters that Strava API supports
  if (params.before) apiParams.append('before', params.before);
  if (params.after) apiParams.append('after', params.after);
  
  return apiParams;
}

/**
 * Get filter summary for logging and debugging
 * @param {Object} filters - Applied filters
 * @param {number} originalCount - Original activity count
 * @param {number} filteredCount - Filtered activity count
 * @returns {Object} - Filter summary
 */
function getFilterSummary(filters, originalCount, filteredCount) {
  const activeFilters = [];
  
  if (filters.activity_types && filters.activity_types.length > 0) {
    activeFilters.push(`activity_types: [${filters.activity_types.join(', ')}]`);
  }
  
  if (filters.min_distance !== null || filters.max_distance !== null) {
    activeFilters.push(`distance: ${filters.min_distance || 0} - ${filters.max_distance || '∞'} meters`);
  }
  
  if (filters.min_elevation !== null || filters.max_elevation !== null) {
    activeFilters.push(`elevation: ${filters.min_elevation || 0} - ${filters.max_elevation || '∞'} meters`);
  }
  
  if (filters.min_duration !== null || filters.max_duration !== null) {
    activeFilters.push(`duration: ${filters.min_duration || 0} - ${filters.max_duration || '∞'} seconds`);
  }
  
  if (filters.search_name) {
    activeFilters.push(`name contains: "${filters.search_name}"`);
  }
  
  return {
    activeFilters,
    originalCount,
    filteredCount,
    filterEfficiency: originalCount > 0 ? ((originalCount - filteredCount) / originalCount * 100).toFixed(1) + '%' : '0%',
    sortBy: filters.sort_by,
    sortOrder: filters.sort_order
  };
}

module.exports = {
  validateAndParseQuery,
  filterActivities,
  sortActivities,
  dateStringToTimestamp,
  buildStravaApiParams,
  getFilterSummary
};