/**
 * GPX/TCX Parser Service
 * 
 * This service provides robust parsing capabilities for GPX and TCX file formats.
 * It extracts coordinate data, timestamps, elevation, and metadata from uploaded
 * route files, handling various format versions and malformed data gracefully.
 * 
 * FEATURES:
 * - Support for GPX 1.0 and 1.1 formats
 * - Support for TCX (Training Center XML) format
 * - Robust error handling for malformed files
 * - Extraction of coordinates, elevation, timestamps, and metadata
 * - Data validation and integrity checks
 * - Standardized output format for map rendering
 * 
 * DEPENDENCIES:
 * - xml2js: For XML parsing
 * - xmldom: For DOM manipulation
 * - @mapbox/togeojson: For GPX to GeoJSON conversion
 */

const togeojson = require('@mapbox/togeojson');
const xml2js = require('xml2js');
const { DOMParser } = require('xmldom');
const geojsonConverter = require('./geojsonConverter');

class GPXTCXParser {
  constructor() {
    this.supportedFormats = ['gpx', 'tcx'];
    this.xml2jsParser = new xml2js.Parser({ 
      explicitArray: false,
      ignoreAttrs: false,
      mergeAttrs: true
    });
  }

  /**
   * Parse GPX file and extract route data
   * @param {Buffer} buffer - File buffer
   * @param {string} filename - Original filename
   * @returns {Promise<Object>} - Parsed route data
   */
  async parseGPXFile(buffer, filename) {
    try {
      const gpxContent = buffer.toString('utf8');
      
      // Validate GPX format
      if (!this.validateGPXFormat(gpxContent)) {
        throw new Error('Invalid GPX file format');
      }

      const dom = new DOMParser().parseFromString(gpxContent, 'text/xml');
      
      // Check for XML parsing errors
      const parseErrors = dom.getElementsByTagName('parsererror');
      if (parseErrors.length > 0) {
        throw new Error('XML parsing failed - malformed GPX file');
      }

      // Use togeojson to convert GPX to GeoJSON
      const geojson = togeojson.gpx(dom);
      
      if (!geojson || !geojson.features || geojson.features.length === 0) {
        throw new Error('No track or route data found in GPX file');
      }

      // Extract track data from the first feature (track or route)
      const feature = geojson.features[0];
      const coordinates = [];
      const elevation = [];
      const timestamps = [];

      // Handle different types of GPX features
      if (feature.geometry.type === 'LineString') {
        feature.geometry.coordinates.forEach((coord, index) => {
          coordinates.push([coord[1], coord[0]]); // Convert to [lat, lng]
          if (coord[2] !== undefined) {
            elevation.push({
              index: index,
              elevation_meters: coord[2],
              elevation_feet: coord[2] * 3.28084
            });
          }
        });
      } else if (feature.geometry.type === 'MultiLineString') {
        // Handle multi-segment tracks
        feature.geometry.coordinates.forEach(segment => {
          segment.forEach((coord, index) => {
            coordinates.push([coord[1], coord[0]]); // Convert to [lat, lng]
            if (coord[2] !== undefined) {
              elevation.push({
                index: coordinates.length - 1,
                elevation_meters: coord[2],
                elevation_feet: coord[2] * 3.28084
              });
            }
          });
        });
      }

      // Extract additional metadata from the original XML
      const metadata = await this.extractGPXMetadata(gpxContent, filename);

      // Validate extracted data
      if (!this.validateCoordinateData(coordinates)) {
        throw new Error('Invalid coordinate data extracted from GPX file');
      }

      const result = {
        id: `gpx_${Date.now()}`,
        name: metadata.name,
        description: metadata.description,
        type: metadata.type,
        source: 'gpx_upload',
        format: 'gpx',
        coordinates: coordinates,
        elevation: elevation,
        timestamps: timestamps,
        distance: this.calculateDistance(coordinates),
        total_elevation_gain: this.calculateElevationGain(elevation),
        bounds: this.calculateBounds(coordinates),
        metadata: {
          ...metadata,
          total_points: coordinates.length,
          has_elevation: elevation.length > 0,
          has_timestamps: timestamps.length > 0,
          filename: filename
        }
      };

      return this.standardizeOutputFormat(result);

    } catch (error) {
      return this.handleParsingError(error, 'GPX', filename);
    }
  }

  /**
   * Parse TCX file and extract route data
   * @param {Buffer} buffer - File buffer
   * @param {string} filename - Original filename
   * @returns {Promise<Object>} - Parsed route data
   */
  async parseTCXFile(buffer, filename) {
    try {
      const tcxContent = buffer.toString('utf8');
      
      // Validate TCX format
      if (!this.validateTCXFormat(tcxContent)) {
        throw new Error('Invalid TCX file format');
      }

      const result = await this.xml2jsParser.parseStringPromise(tcxContent);
      
      if (!result.TrainingCenterDatabase) {
        throw new Error('Invalid TCX file structure - missing TrainingCenterDatabase element');
      }

      const activities = result.TrainingCenterDatabase.Activities;
      if (!activities || !activities.Activity) {
        throw new Error('No activities found in TCX file');
      }

      const activity = Array.isArray(activities.Activity) ? activities.Activity[0] : activities.Activity;
      
      const coordinates = [];
      const elevation = [];
      const timestamps = [];

      // Extract metadata
      const metadata = this.extractTCXMetadata(activity, filename);

      // Extract track points from laps
      if (activity.Lap) {
        const laps = Array.isArray(activity.Lap) ? activity.Lap : [activity.Lap];
        
        laps.forEach(lap => {
          if (lap.Track && lap.Track.Trackpoint) {
            const trackpoints = Array.isArray(lap.Track.Trackpoint) ? lap.Track.Trackpoint : [lap.Track.Trackpoint];
            
            trackpoints.forEach((point, index) => {
              if (point.Position && point.Position.LatitudeDegrees && point.Position.LongitudeDegrees) {
                const lat = parseFloat(point.Position.LatitudeDegrees);
                const lng = parseFloat(point.Position.LongitudeDegrees);
                
                if (!isNaN(lat) && !isNaN(lng)) {
                  coordinates.push([lat, lng]);
                  
                  // Extract elevation if available
                  if (point.AltitudeMeters) {
                    const alt = parseFloat(point.AltitudeMeters);
                    if (!isNaN(alt)) {
                      elevation.push({
                        index: coordinates.length - 1,
                        elevation_meters: alt,
                        elevation_feet: alt * 3.28084
                      });
                    }
                  }
                  
                  // Extract timestamp if available
                  if (point.Time) {
                    timestamps.push({
                      index: coordinates.length - 1,
                      timestamp: point.Time,
                      iso_string: point.Time
                    });
                  }
                }
              }
            });
          }
        });
      }

      if (coordinates.length === 0) {
        throw new Error('No coordinate data found in TCX file');
      }

      // Validate extracted data
      if (!this.validateCoordinateData(coordinates)) {
        throw new Error('Invalid coordinate data extracted from TCX file');
      }

      const resultData = {
        id: `tcx_${Date.now()}`,
        name: metadata.name,
        description: metadata.description,
        type: metadata.type,
        source: 'tcx_upload',
        format: 'tcx',
        coordinates: coordinates,
        elevation: elevation,
        timestamps: timestamps,
        distance: this.calculateDistance(coordinates),
        total_elevation_gain: this.calculateElevationGain(elevation),
        bounds: this.calculateBounds(coordinates),
        metadata: {
          ...metadata,
          total_points: coordinates.length,
          has_elevation: elevation.length > 0,
          has_timestamps: timestamps.length > 0,
          filename: filename
        }
      };

      return this.standardizeOutputFormat(resultData);

    } catch (error) {
      return this.handleParsingError(error, 'TCX', filename);
    }
  }

  /**
   * Validate GPX file format
   * @param {string} content - File content
   * @returns {boolean} - True if valid GPX format
   */
  validateGPXFormat(content) {
    return content.includes('<gpx') || content.includes('xmlns="http://www.topografix.com/GPX');
  }

  /**
   * Validate TCX file format
   * @param {string} content - File content
   * @returns {boolean} - True if valid TCX format
   */
  validateTCXFormat(content) {
    return content.includes('<TrainingCenterDatabase') || content.includes('xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase');
  }

  /**
   * Extract metadata from GPX content
   * @param {string} gpxContent - GPX file content
   * @param {string} filename - Original filename
   * @returns {Promise<Object>} - Extracted metadata
   */
  async extractGPXMetadata(gpxContent, filename) {
    const metadata = {
      name: filename.replace(/\.[^/.]+$/, ''),
      description: '',
      type: 'GPX Track',
      creator: '',
      created_at: null
    };

    try {
      const result = await this.xml2jsParser.parseStringPromise(gpxContent);
      
      if (result.gpx) {
        // Extract metadata
        if (result.gpx.metadata) {
          metadata.name = result.gpx.metadata.name || metadata.name;
          metadata.description = result.gpx.metadata.desc || metadata.description;
          metadata.creator = result.gpx.creator || metadata.creator;
          metadata.created_at = result.gpx.metadata.time || null;
        }
        
        // Extract track information
        if (result.gpx.trk) {
          const track = Array.isArray(result.gpx.trk) ? result.gpx.trk[0] : result.gpx.trk;
          metadata.name = track.name || metadata.name;
          metadata.type = track.type || metadata.type;
          metadata.description = track.desc || metadata.description;
        }
        
        // Extract route information if no track
        if (!result.gpx.trk && result.gpx.rte) {
          const route = Array.isArray(result.gpx.rte) ? result.gpx.rte[0] : result.gpx.rte;
          metadata.name = route.name || metadata.name;
          metadata.type = 'GPX Route';
          metadata.description = route.desc || metadata.description;
        }
      }
    } catch (xmlError) {
      console.warn('Could not parse GPX XML for additional metadata:', xmlError.message);
    }

    return metadata;
  }

  /**
   * Extract metadata from TCX activity
   * @param {Object} activity - TCX activity object
   * @param {string} filename - Original filename
   * @returns {Object} - Extracted metadata
   */
  extractTCXMetadata(activity, filename) {
    const metadata = {
      name: filename.replace(/\.[^/.]+$/, ''),
      description: '',
      type: 'TCX Activity',
      sport: 'Unknown',
      created_at: null
    };

    if (activity.Sport) {
      metadata.sport = activity.Sport || metadata.sport;
      metadata.type = `${metadata.sport} Activity`;
    }

    if (activity.Id) {
      metadata.created_at = activity.Id;
      metadata.name = `${metadata.sport} - ${new Date(activity.Id).toLocaleDateString()}`;
    }

    if (activity.Notes) {
      metadata.description = activity.Notes;
    }

    return metadata;
  }

  /**
   * Validate coordinate data integrity
   * @param {Array} coordinates - Array of [lat, lng] coordinates
   * @returns {boolean} - True if valid
   */
  validateCoordinateData(coordinates) {
    if (!Array.isArray(coordinates) || coordinates.length === 0) {
      return false;
    }

    // Check first few coordinates for validity
    const sampleSize = Math.min(10, coordinates.length);
    for (let i = 0; i < sampleSize; i++) {
      const coord = coordinates[i];
      if (!Array.isArray(coord) || coord.length < 2) {
        return false;
      }
      
      const [lat, lng] = coord;
      if (typeof lat !== 'number' || typeof lng !== 'number') {
        return false;
      }
      
      // Check if coordinates are within valid ranges
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate total distance from coordinates
   * @param {Array} coordinates - Array of [lat, lng] coordinates
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

    return totalDistance;
  }

  /**
   * Calculate Haversine distance between two points
   * @param {Array} coord1 - [lat, lng]
   * @param {Array} coord2 - [lat, lng]
   * @returns {number} - Distance in meters
   */
  haversineDistance(coord1, coord2) {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRadians(coord2[0] - coord1[0]);
    const dLng = this.toRadians(coord2[1] - coord1[1]);
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.toRadians(coord1[0])) * Math.cos(this.toRadians(coord2[0])) *
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
   * Calculate total elevation gain
   * @param {Array} elevation - Array of elevation objects
   * @returns {number} - Total elevation gain in meters
   */
  calculateElevationGain(elevation) {
    if (!elevation || elevation.length < 2) {
      return 0;
    }

    let totalGain = 0;
    for (let i = 1; i < elevation.length; i++) {
      const diff = elevation[i].elevation_meters - elevation[i-1].elevation_meters;
      if (diff > 0) {
        totalGain += diff;
      }
    }

    return totalGain;
  }

  /**
   * Calculate bounding box for coordinates
   * @param {Array} coordinates - Array of [lat, lng] coordinates
   * @returns {Object|null} - Bounding box object
   */
  calculateBounds(coordinates) {
    if (!coordinates || coordinates.length === 0) {
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
   * Standardize output format for consistent data structure
   * @param {Object} parsedData - Raw parsed data
   * @returns {Object} - Standardized route data
   */
  standardizeOutputFormat(parsedData) {
    try {
      // Generate comprehensive GeoJSON using the new converter
      const geoJSON = geojsonConverter.convertToGeoJSON(parsedData, {
        source: parsedData.format,
        includeElevation: true,
        includeTimestamps: true,
        validateOutput: true,
        optimizeForMapbox: true
      });

      return {
        // Core identification
        id: parsedData.id,
        name: parsedData.name,
        description: parsedData.description || '',
        
        // Data source and format
        source: parsedData.source,
        format: parsedData.format,
        type: parsedData.type,
        
        // Geographic data
        coordinates: parsedData.coordinates,
        bounds: parsedData.bounds,
        
        // Elevation data
        elevation: parsedData.elevation,
        has_elevation: parsedData.elevation && parsedData.elevation.length > 0,
        
        // Temporal data
        timestamps: parsedData.timestamps,
        has_timestamps: parsedData.timestamps && parsedData.timestamps.length > 0,
        
        // Metrics
        distance: parsedData.distance,
        total_elevation_gain: parsedData.total_elevation_gain,
        
        // Enhanced GeoJSON for map rendering (using new converter)
        geojson: geoJSON,
        
        // Metadata
        metadata: parsedData.metadata
      };
    } catch (geoJSONError) {
      console.warn('GeoJSON conversion failed, falling back to basic format:', geoJSONError.message);
      
      // Fallback to basic GeoJSON format if converter fails
      return {
        // Core identification
        id: parsedData.id,
        name: parsedData.name,
        description: parsedData.description || '',
        
        // Data source and format
        source: parsedData.source,
        format: parsedData.format,
        type: parsedData.type,
        
        // Geographic data
        coordinates: parsedData.coordinates,
        bounds: parsedData.bounds,
        
        // Elevation data
        elevation: parsedData.elevation,
        has_elevation: parsedData.elevation && parsedData.elevation.length > 0,
        
        // Temporal data
        timestamps: parsedData.timestamps,
        has_timestamps: parsedData.timestamps && parsedData.timestamps.length > 0,
        
        // Metrics
        distance: parsedData.distance,
        total_elevation_gain: parsedData.total_elevation_gain,
        
        // Basic GeoJSON for map rendering (fallback)
        geojson: {
          type: 'Feature',
          properties: {
            name: parsedData.name,
            type: parsedData.type,
            source: parsedData.source,
            distance: parsedData.distance,
            elevation_gain: parsedData.total_elevation_gain
          },
          geometry: {
            type: 'LineString',
            coordinates: parsedData.coordinates.map(coord => [coord[1], coord[0]]) // Convert to [lng, lat] for GeoJSON
          }
        },
        
        // Metadata
        metadata: parsedData.metadata
      };
    }
  }

  /**
   * Handle parsing errors with detailed error information
   * @param {Error} error - Original error
   * @param {string} format - File format (GPX or TCX)
   * @param {string} filename - Original filename
   * @returns {Object} - Error response
   */
  handleParsingError(error, format, filename) {
    console.error(`${format} parsing error for file ${filename}:`, error);
    
    const errorResponse = {
      success: false,
      error: {
        type: 'parsing_error',
        format: format.toLowerCase(),
        filename: filename,
        message: error.message,
        timestamp: new Date().toISOString()
      }
    };

    // Provide more specific error guidance
    if (error.message.includes('malformed') || error.message.includes('XML parsing failed')) {
      errorResponse.error.suggestion = 'The file appears to be corrupted or not a valid XML format. Please try re-exporting the file from your GPS device or application.';
    } else if (error.message.includes('No track') || error.message.includes('No coordinate data')) {
      errorResponse.error.suggestion = 'The file does not contain any route or track data. Please ensure the file was exported with GPS coordinates.';
    } else if (error.message.includes('Invalid coordinate data')) {
      errorResponse.error.suggestion = 'The coordinate data in the file is invalid or corrupted. Please check the file integrity.';
    } else {
      errorResponse.error.suggestion = 'Please ensure the file is a valid GPX or TCX format exported from a GPS device or fitness application.';
    }

    throw errorResponse;
  }

  /**
   * Get supported file formats
   * @returns {Array} - Array of supported format strings
   */
  getSupportedFormats() {
    return [...this.supportedFormats];
  }

  /**
   * Check if a format is supported
   * @param {string} format - Format to check
   * @returns {boolean} - True if supported
   */
  isFormatSupported(format) {
    return this.supportedFormats.includes(format.toLowerCase());
  }
}

// Export singleton instance
module.exports = new GPXTCXParser();