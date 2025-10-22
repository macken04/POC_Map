/**
 * Enhanced Input Validation Layer for Route Rendering System
 * Provides comprehensive client-side validation before API calls and data processing
 * 
 * Features:
 * - Coordinate boundary validation
 * - File format and integrity validation
 * - Data structure validation
 * - Performance-aware validation for large datasets
 * - Integration with ErrorManager for user feedback
 */

class InputValidator {
  constructor(options = {}) {
    this.options = Object.assign({
      // Coordinate validation settings
      coordinateBounds: {
        latitude: { min: -90, max: 90 },
        longitude: { min: -180, max: 180 }
      },
      
      // File validation settings
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedFileTypes: ['gpx', 'tcx'],
      allowedMimeTypes: [
        'application/gpx+xml',
        'application/tcx+xml', 
        'text/xml',
        'application/xml',
        'text/plain'
      ],
      
      // Route validation settings
      maxRoutePoints: 50000, // Maximum points in a route
      minRoutePoints: 2, // Minimum points for a valid route
      maxRouteDistance: 1000000, // Maximum route distance in meters
      
      // Performance settings
      enablePerformanceValidation: true,
      maxValidationTime: 5000, // 5 seconds max for validation
      
      // Integration settings
      useErrorManager: true,
      showValidationErrors: true
    }, options);

    this.validationCache = new Map();
    this.performanceMetrics = {
      validationTime: 0,
      cacheHits: 0,
      cacheMisses: 0
    };

    console.log('InputValidator initialized with options:', this.options);
  }

  /**
   * Validation result structure
   */
  static VALIDATION_RESULT = {
    SUCCESS: 'success',
    WARNING: 'warning', 
    ERROR: 'error'
  };

  /**
   * Validation error types
   */
  static VALIDATION_ERRORS = {
    INVALID_COORDINATES: 'invalid_coordinates',
    INVALID_FILE_FORMAT: 'invalid_file_format',
    FILE_TOO_LARGE: 'file_too_large',
    ROUTE_TOO_LONG: 'route_too_long',
    ROUTE_TOO_SHORT: 'route_too_short',
    INVALID_DATA_STRUCTURE: 'invalid_data_structure',
    PERFORMANCE_THRESHOLD: 'performance_threshold',
    MISSING_REQUIRED_DATA: 'missing_required_data'
  };

  /**
   * Validate coordinates array
   * @param {Array} coordinates - Array of [lat, lng] coordinate pairs
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  validateCoordinates(coordinates, options = {}) {
    const startTime = performance.now();
    
    try {
      // Basic structure validation
      if (!Array.isArray(coordinates)) {
        return this.createValidationResult(
          InputValidator.VALIDATION_RESULT.ERROR,
          InputValidator.VALIDATION_ERRORS.INVALID_DATA_STRUCTURE,
          'Coordinates must be an array',
          { received: typeof coordinates }
        );
      }

      if (coordinates.length < this.options.minRoutePoints) {
        return this.createValidationResult(
          InputValidator.VALIDATION_RESULT.ERROR,
          InputValidator.VALIDATION_ERRORS.ROUTE_TOO_SHORT,
          `Route must have at least ${this.options.minRoutePoints} points`,
          { pointCount: coordinates.length, minimum: this.options.minRoutePoints }
        );
      }

      if (coordinates.length > this.options.maxRoutePoints) {
        return this.createValidationResult(
          InputValidator.VALIDATION_RESULT.ERROR,
          InputValidator.VALIDATION_ERRORS.ROUTE_TOO_LONG,
          `Route has too many points (${coordinates.length}). Maximum allowed: ${this.options.maxRoutePoints}`,
          { pointCount: coordinates.length, maximum: this.options.maxRoutePoints }
        );
      }

      // Validate each coordinate point
      const invalidPoints = [];
      const warnings = [];
      let totalDistance = 0;
      let previousPoint = null;

      for (let i = 0; i < coordinates.length; i++) {
        const point = coordinates[i];
        
        // Structure validation
        if (!Array.isArray(point) || point.length < 2) {
          invalidPoints.push({
            index: i,
            reason: 'Invalid coordinate structure',
            point: point
          });
          continue;
        }

        const [lat, lng] = point;

        // Type validation
        if (typeof lat !== 'number' || typeof lng !== 'number') {
          invalidPoints.push({
            index: i,
            reason: 'Coordinates must be numbers',
            point: point
          });
          continue;
        }

        // Boundary validation
        if (lat < this.options.coordinateBounds.latitude.min || 
            lat > this.options.coordinateBounds.latitude.max) {
          invalidPoints.push({
            index: i,
            reason: `Latitude out of bounds (${lat})`,
            point: point
          });
          continue;
        }

        if (lng < this.options.coordinateBounds.longitude.min || 
            lng > this.options.coordinateBounds.longitude.max) {
          invalidPoints.push({
            index: i,
            reason: `Longitude out of bounds (${lng})`,
            point: point
          });
          continue;
        }

        // Calculate distance and check for reasonable values
        if (previousPoint) {
          const distance = this.calculateDistance(previousPoint, point);
          totalDistance += distance;
          
          // Check for unreasonable jumps (>10km between consecutive points)
          if (distance > 10000) {
            warnings.push({
              index: i,
              reason: `Large distance jump detected (${Math.round(distance)}m)`,
              distance: distance,
              point: point
            });
          }
        }

        previousPoint = point;
      }

      // Check total distance
      if (totalDistance > this.options.maxRouteDistance) {
        return this.createValidationResult(
          InputValidator.VALIDATION_RESULT.ERROR,
          InputValidator.VALIDATION_ERRORS.ROUTE_TOO_LONG,
          `Route distance too long (${Math.round(totalDistance/1000)}km). Maximum: ${Math.round(this.options.maxRouteDistance/1000)}km`,
          { distance: totalDistance, maximum: this.options.maxRouteDistance }
        );
      }

      // Return results
      if (invalidPoints.length > 0) {
        return this.createValidationResult(
          InputValidator.VALIDATION_RESULT.ERROR,
          InputValidator.VALIDATION_ERRORS.INVALID_COORDINATES,
          `Found ${invalidPoints.length} invalid coordinate points`,
          { 
            invalidPoints: invalidPoints.slice(0, 10), // Limit to first 10 for performance
            totalInvalid: invalidPoints.length,
            totalPoints: coordinates.length
          }
        );
      }

      const result = this.createValidationResult(
        warnings.length > 0 ? InputValidator.VALIDATION_RESULT.WARNING : InputValidator.VALIDATION_RESULT.SUCCESS,
        null,
        warnings.length > 0 ? `Validation completed with ${warnings.length} warnings` : 'Coordinates validation successful',
        {
          pointCount: coordinates.length,
          totalDistance: totalDistance,
          warnings: warnings.slice(0, 5) // Limit warnings for performance
        }
      );

      this.recordPerformanceMetric('coordinateValidation', startTime);
      return result;

    } catch (error) {
      this.recordPerformanceMetric('coordinateValidation', startTime);
      return this.createValidationResult(
        InputValidator.VALIDATION_RESULT.ERROR,
        InputValidator.VALIDATION_ERRORS.INVALID_DATA_STRUCTURE,
        'Unexpected error during coordinate validation',
        { error: error.message }
      );
    }
  }

  /**
   * Validate uploaded file
   * @param {File} file - File object from file input
   * @returns {Object} Validation result
   */
  validateFile(file) {
    const startTime = performance.now();

    try {
      // Check if file exists
      if (!file) {
        return this.createValidationResult(
          InputValidator.VALIDATION_RESULT.ERROR,
          InputValidator.VALIDATION_ERRORS.MISSING_REQUIRED_DATA,
          'No file provided',
          {}
        );
      }

      // File size validation
      if (file.size > this.options.maxFileSize) {
        return this.createValidationResult(
          InputValidator.VALIDATION_RESULT.ERROR,
          InputValidator.VALIDATION_ERRORS.FILE_TOO_LARGE,
          `File size (${this.formatFileSize(file.size)}) exceeds maximum allowed size (${this.formatFileSize(this.options.maxFileSize)})`,
          { 
            fileSize: file.size, 
            maxSize: this.options.maxFileSize,
            fileName: file.name
          }
        );
      }

      // File extension validation
      const fileExtension = file.name.toLowerCase().split('.').pop();
      if (!this.options.allowedFileTypes.includes(fileExtension)) {
        return this.createValidationResult(
          InputValidator.VALIDATION_RESULT.ERROR,
          InputValidator.VALIDATION_ERRORS.INVALID_FILE_FORMAT,
          `Invalid file format (.${fileExtension}). Allowed formats: ${this.options.allowedFileTypes.join(', ')}`,
          { 
            fileExtension: fileExtension,
            allowedTypes: this.options.allowedFileTypes,
            fileName: file.name
          }
        );
      }

      // MIME type validation
      if (!this.options.allowedMimeTypes.includes(file.type.toLowerCase())) {
        return this.createValidationResult(
          InputValidator.VALIDATION_RESULT.WARNING,
          null,
          `Unusual MIME type (${file.type}). File may still be valid.`,
          { 
            mimeType: file.type,
            allowedMimeTypes: this.options.allowedMimeTypes,
            fileName: file.name
          }
        );
      }

      this.recordPerformanceMetric('fileValidation', startTime);

      return this.createValidationResult(
        InputValidator.VALIDATION_RESULT.SUCCESS,
        null,
        'File validation successful',
        { 
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          fileExtension: fileExtension
        }
      );

    } catch (error) {
      this.recordPerformanceMetric('fileValidation', startTime);
      return this.createValidationResult(
        InputValidator.VALIDATION_RESULT.ERROR,
        InputValidator.VALIDATION_ERRORS.INVALID_DATA_STRUCTURE,
        'Unexpected error during file validation',
        { error: error.message }
      );
    }
  }

  /**
   * Validate file content before processing
   * @param {string} content - File content as string
   * @param {string} expectedFormat - Expected format ('gpx' or 'tcx')
   * @returns {Object} Validation result
   */
  validateFileContent(content, expectedFormat) {
    const startTime = performance.now();

    try {
      if (!content || typeof content !== 'string') {
        return this.createValidationResult(
          InputValidator.VALIDATION_RESULT.ERROR,
          InputValidator.VALIDATION_ERRORS.MISSING_REQUIRED_DATA,
          'File content is empty or invalid',
          { contentType: typeof content }
        );
      }

      // Check for XML structure
      if (!content.includes('<') || !content.includes('>')) {
        return this.createValidationResult(
          InputValidator.VALIDATION_RESULT.ERROR,
          InputValidator.VALIDATION_ERRORS.INVALID_FILE_FORMAT,
          'File does not appear to be valid XML',
          { contentPreview: content.substring(0, 100) }
        );
      }

      // Format-specific validation
      let formatValid = false;
      let warnings = [];

      if (expectedFormat === 'gpx') {
        formatValid = this.validateGPXContent(content);
        if (!formatValid) {
          warnings.push('File may not be valid GPX format');
        }
      } else if (expectedFormat === 'tcx') {
        formatValid = this.validateTCXContent(content);
        if (!formatValid) {
          warnings.push('File may not be valid TCX format');
        }
      }

      // Check for common GPS data elements
      const hasTrackPoints = content.includes('<trkpt') || content.includes('<Trackpoint');
      const hasCoordinates = content.includes('lat=') && content.includes('lon=');
      const hasPosition = content.includes('<Position') || content.includes('<LatitudeDegrees');

      if (!hasTrackPoints && !hasCoordinates && !hasPosition) {
        warnings.push('No GPS track points found in file');
      }

      this.recordPerformanceMetric('contentValidation', startTime);

      const result = warnings.length > 0 ? 
        InputValidator.VALIDATION_RESULT.WARNING : 
        InputValidator.VALIDATION_RESULT.SUCCESS;

      return this.createValidationResult(
        result,
        null,
        warnings.length > 0 ? `Content validation completed with warnings` : 'Content validation successful',
        { 
          formatValid: formatValid,
          hasTrackPoints: hasTrackPoints,
          hasCoordinates: hasCoordinates,
          warnings: warnings,
          contentLength: content.length
        }
      );

    } catch (error) {
      this.recordPerformanceMetric('contentValidation', startTime);
      return this.createValidationResult(
        InputValidator.VALIDATION_RESULT.ERROR,
        InputValidator.VALIDATION_ERRORS.INVALID_DATA_STRUCTURE,
        'Unexpected error during content validation',
        { error: error.message }
      );
    }
  }

  /**
   * Validate GPX content structure
   * @param {string} content - GPX file content
   * @returns {boolean} True if valid GPX structure
   */
  validateGPXContent(content) {
    return content.includes('<gpx') && 
           (content.includes('<trk>') || content.includes('<rte>')) &&
           content.includes('</gpx>');
  }

  /**
   * Validate TCX content structure
   * @param {string} content - TCX file content
   * @returns {boolean} True if valid TCX structure
   */
  validateTCXContent(content) {
    return content.includes('<TrainingCenterDatabase') &&
           content.includes('<Activity') &&
           content.includes('</TrainingCenterDatabase>');
  }

  /**
   * Validate route data structure from API
   * @param {Object} routeData - Route data object
   * @returns {Object} Validation result
   */
  validateRouteData(routeData) {
    const startTime = performance.now();

    try {
      if (!routeData || typeof routeData !== 'object') {
        return this.createValidationResult(
          InputValidator.VALIDATION_RESULT.ERROR,
          InputValidator.VALIDATION_ERRORS.INVALID_DATA_STRUCTURE,
          'Route data must be an object',
          { received: typeof routeData }
        );
      }

      const requiredFields = ['id', 'name'];
      const missingFields = requiredFields.filter(field => !routeData[field]);

      if (missingFields.length > 0) {
        return this.createValidationResult(
          InputValidator.VALIDATION_RESULT.ERROR,
          InputValidator.VALIDATION_ERRORS.MISSING_REQUIRED_DATA,
          `Missing required fields: ${missingFields.join(', ')}`,
          { missingFields: missingFields, providedFields: Object.keys(routeData) }
        );
      }

      // Validate coordinates if present
      if (routeData.coordinates) {
        const coordResult = this.validateCoordinates(routeData.coordinates);
        if (coordResult.status === InputValidator.VALIDATION_RESULT.ERROR) {
          return coordResult;
        }
      }

      // Validate polyline data if present
      if (routeData.map && routeData.map.polyline) {
        const polylineResult = this.validatePolyline(routeData.map.polyline);
        if (polylineResult.status === InputValidator.VALIDATION_RESULT.ERROR) {
          return polylineResult;
        }
      }

      this.recordPerformanceMetric('routeDataValidation', startTime);

      return this.createValidationResult(
        InputValidator.VALIDATION_RESULT.SUCCESS,
        null,
        'Route data validation successful',
        { 
          routeId: routeData.id,
          routeName: routeData.name,
          hasCoordinates: !!routeData.coordinates,
          hasPolyline: !!(routeData.map && routeData.map.polyline)
        }
      );

    } catch (error) {
      this.recordPerformanceMetric('routeDataValidation', startTime);
      return this.createValidationResult(
        InputValidator.VALIDATION_RESULT.ERROR,
        InputValidator.VALIDATION_ERRORS.INVALID_DATA_STRUCTURE,
        'Unexpected error during route data validation',
        { error: error.message }
      );
    }
  }

  /**
   * Validate encoded polyline string
   * @param {string} polyline - Encoded polyline string
   * @returns {Object} Validation result
   */
  validatePolyline(polyline) {
    try {
      if (!polyline || typeof polyline !== 'string') {
        return this.createValidationResult(
          InputValidator.VALIDATION_RESULT.ERROR,
          InputValidator.VALIDATION_ERRORS.INVALID_DATA_STRUCTURE,
          'Polyline must be a non-empty string',
          { received: typeof polyline }
        );
      }

      // Basic polyline format validation (should contain valid encoding characters)
      const validChars = /^[a-zA-Z0-9_-]+$/;
      if (!validChars.test(polyline)) {
        return this.createValidationResult(
          InputValidator.VALIDATION_RESULT.WARNING,
          null,
          'Polyline contains unusual characters',
          { polylineLength: polyline.length }
        );
      }

      // Check reasonable length
      if (polyline.length < 10) {
        return this.createValidationResult(
          InputValidator.VALIDATION_RESULT.WARNING,
          null,
          'Polyline seems unusually short',
          { polylineLength: polyline.length }
        );
      }

      if (polyline.length > 100000) {
        return this.createValidationResult(
          InputValidator.VALIDATION_RESULT.WARNING,
          null,
          'Polyline is very long and may impact performance',
          { polylineLength: polyline.length }
        );
      }

      return this.createValidationResult(
        InputValidator.VALIDATION_RESULT.SUCCESS,
        null,
        'Polyline validation successful',
        { polylineLength: polyline.length }
      );

    } catch (error) {
      return this.createValidationResult(
        InputValidator.VALIDATION_RESULT.ERROR,
        InputValidator.VALIDATION_ERRORS.INVALID_DATA_STRUCTURE,
        'Unexpected error during polyline validation',
        { error: error.message }
      );
    }
  }

  /**
   * Validate form data before API submission
   * @param {FormData} formData - Form data object
   * @param {Array} requiredFields - List of required field names
   * @returns {Object} Validation result
   */
  validateFormData(formData, requiredFields = []) {
    try {
      if (!formData) {
        return this.createValidationResult(
          InputValidator.VALIDATION_RESULT.ERROR,
          InputValidator.VALIDATION_ERRORS.MISSING_REQUIRED_DATA,
          'Form data is required',
          {}
        );
      }

      const missingFields = [];
      const warnings = [];

      // Check required fields
      for (const field of requiredFields) {
        if (!formData.has(field) || !formData.get(field)) {
          missingFields.push(field);
        }
      }

      if (missingFields.length > 0) {
        return this.createValidationResult(
          InputValidator.VALIDATION_RESULT.ERROR,
          InputValidator.VALIDATION_ERRORS.MISSING_REQUIRED_DATA,
          `Missing required fields: ${missingFields.join(', ')}`,
          { missingFields: missingFields }
        );
      }

      // Validate file uploads if present
      const fileFields = ['gpxFile', 'tcxFile', 'routeFile'];
      for (const fileField of fileFields) {
        if (formData.has(fileField)) {
          const file = formData.get(fileField);
          if (file && file.size > 0) {
            const fileResult = this.validateFile(file);
            if (fileResult.status === InputValidator.VALIDATION_RESULT.ERROR) {
              return fileResult;
            }
            if (fileResult.status === InputValidator.VALIDATION_RESULT.WARNING) {
              warnings.push(`File ${fileField}: ${fileResult.message}`);
            }
          }
        }
      }

      return this.createValidationResult(
        warnings.length > 0 ? InputValidator.VALIDATION_RESULT.WARNING : InputValidator.VALIDATION_RESULT.SUCCESS,
        null,
        warnings.length > 0 ? `Form validation completed with warnings` : 'Form validation successful',
        { warnings: warnings }
      );

    } catch (error) {
      return this.createValidationResult(
        InputValidator.VALIDATION_RESULT.ERROR,
        InputValidator.VALIDATION_ERRORS.INVALID_DATA_STRUCTURE,
        'Unexpected error during form validation',
        { error: error.message }
      );
    }
  }

  /**
   * Calculate distance between two coordinate points using Haversine formula
   * @param {Array} point1 - [lat, lng] coordinate pair
   * @param {Array} point2 - [lat, lng] coordinate pair  
   * @returns {number} Distance in meters
   */
  calculateDistance(point1, point2) {
    const [lat1, lon1] = point1;
    const [lat2, lon2] = point2;

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
   * Format file size for display
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted file size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Create standardized validation result object
   * @param {string} status - Validation status
   * @param {string} errorType - Error type if status is error
   * @param {string} message - Human-readable message
   * @param {Object} details - Additional details
   * @returns {Object} Validation result object
   */
  createValidationResult(status, errorType, message, details) {
    const result = {
      status: status,
      message: message,
      details: details,
      timestamp: new Date().toISOString()
    };

    if (errorType) {
      result.errorType = errorType;
    }

    // Handle error manager integration
    if (this.options.useErrorManager && status === InputValidator.VALIDATION_RESULT.ERROR) {
      if (window.errorManager) {
        window.errorManager.handleError({
          type: errorType,
          category: window.ErrorManager?.ERROR_CATEGORIES?.VALIDATION || 'validation',
          severity: window.ErrorManager?.ERROR_SEVERITY?.MEDIUM || 'medium',
          message: message,
          details: details
        });
      }
    }

    return result;
  }

  /**
   * Record performance metrics
   * @param {string} operation - Operation name
   * @param {number} startTime - Start time from performance.now()
   */
  recordPerformanceMetric(operation, startTime) {
    const duration = performance.now() - startTime;
    this.performanceMetrics.validationTime += duration;

    if (this.options.enablePerformanceValidation && duration > this.options.maxValidationTime) {
      if (window.errorManager) {
        window.errorManager.handleError({
          type: InputValidator.VALIDATION_ERRORS.PERFORMANCE_THRESHOLD,
          category: window.ErrorManager?.ERROR_CATEGORIES?.PERFORMANCE || 'performance',
          severity: window.ErrorManager?.ERROR_SEVERITY?.MEDIUM || 'medium',
          message: `Validation operation ${operation} took too long (${Math.round(duration)}ms)`,
          details: { operation: operation, duration: duration, threshold: this.options.maxValidationTime }
        });
      }
    }
  }

  /**
   * Get validation performance metrics
   * @returns {Object} Performance metrics
   */
  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      averageValidationTime: this.performanceMetrics.validationTime / Math.max(1, this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses)
    };
  }

  /**
   * Clear validation cache
   */
  clearCache() {
    this.validationCache.clear();
    this.performanceMetrics.cacheHits = 0;
    this.performanceMetrics.cacheMisses = 0;
  }

  /**
   * Destroy validator and cleanup
   */
  destroy() {
    this.clearCache();
    this.performanceMetrics = {
      validationTime: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
    console.log('InputValidator destroyed');
  }
}

// Create global instance
window.inputValidator = new InputValidator({
  useErrorManager: true,
  showValidationErrors: true,
  enablePerformanceValidation: true
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = InputValidator;
}