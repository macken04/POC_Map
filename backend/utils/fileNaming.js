/**
 * File Naming Utilities
 * Advanced file naming conventions, validation, and parsing utilities
 * Supports collision prevention and metadata extraction from filenames
 */

const crypto = require('crypto');
const path = require('path');

class FileNaming {
  /**
   * File naming patterns and validation rules
   */
  static patterns = {
    map: /^map_(\d+)_(\w+)_([A-Z0-9]+)_(\d+)_([a-f0-9]{8})\.(png|jpg|jpeg)$/i,
    metadata: /^map_(\d+)_(\w+)_([A-Z0-9]+)_(\d+)_([a-f0-9]{8})_metadata\.json$/i,
    preview: /^preview_(\d+)_(\w+)_(\d+)_([a-f0-9]{8})\.(png|jpg|jpeg)$/i,
    thumbnail: /^thumb_(\d+)_(\w+)_(\d+)_([a-f0-9]{8})\.(png|jpg|jpeg)$/i
  };

  /**
   * Valid file formats and their extensions
   */
  static formats = {
    A4: { width: 2480, height: 3508, dpi: 300 },
    A3: { width: 3508, height: 4961, dpi: 300 },
    LETTER: { width: 2550, height: 3300, dpi: 300 },
    LEGAL: { width: 2550, height: 4200, dpi: 300 }
  };

  /**
   * Valid file types and their purposes
   */
  static fileTypes = {
    map: { purpose: 'High-resolution printable map', extensions: ['png', 'jpg'] },
    preview: { purpose: 'Low-resolution preview image', extensions: ['png', 'jpg'] },
    thumbnail: { purpose: 'Small thumbnail image', extensions: ['png', 'jpg'] },
    metadata: { purpose: 'File metadata JSON', extensions: ['json'] }
  };

  /**
   * Generate a secure, collision-resistant filename
   * @param {Object} options - Filename generation options
   * @returns {string} Generated filename
   */
  static generateFilename(options = {}) {
    const {
      type = 'map',
      userId,
      activityId,
      format = 'A4',
      extension = 'png',
      includeTimestamp = true,
      customSuffix = ''
    } = options;

    // Validate inputs
    this.validateFileType(type);
    this.validateFormat(format);
    this.validateExtension(extension, type);
    this.validateUserId(userId);
    this.validateActivityId(activityId);

    const timestamp = includeTimestamp ? Date.now() : '';
    const randomComponent = Math.random().toString(36).substr(2, 9);
    
    // Create collision-resistant hash
    const hashData = `${userId}_${activityId}_${format}_${timestamp}_${randomComponent}_${customSuffix}`;
    const hash = crypto.createHash('sha256').update(hashData).digest('hex').substr(0, 8);
    
    // Construct filename based on type
    switch (type) {
      case 'map':
        return `map_${userId}_${activityId}_${format}_${timestamp}_${hash}.${extension}`;
      case 'preview':
        return `preview_${userId}_${activityId}_${timestamp}_${hash}.${extension}`;
      case 'thumbnail':
        return `thumb_${userId}_${activityId}_${timestamp}_${hash}.${extension}`;
      case 'metadata':
        return `map_${userId}_${activityId}_${format}_${timestamp}_${hash}_metadata.json`;
      default:
        throw new Error(`Unsupported file type: ${type}`);
    }
  }

  /**
   * Parse filename to extract metadata
   * @param {string} filename - Filename to parse
   * @returns {Object} Parsed metadata
   */
  static parseFilename(filename) {
    const baseName = path.parse(filename).name;
    const extension = path.parse(filename).ext.slice(1);

    // Try different patterns
    for (const [type, pattern] of Object.entries(this.patterns)) {
      const match = filename.match(pattern);
      if (match) {
        switch (type) {
          case 'map':
            return {
              type: 'map',
              userId: match[1],
              activityId: match[2],
              format: match[3],
              timestamp: parseInt(match[4]),
              hash: match[5],
              extension: match[6],
              isValid: true
            };
          case 'metadata':
            return {
              type: 'metadata',
              userId: match[1],
              activityId: match[2],
              format: match[3],
              timestamp: parseInt(match[4]),
              hash: match[5],
              extension: 'json',
              isValid: true
            };
          case 'preview':
            return {
              type: 'preview',
              userId: match[1],
              activityId: match[2],
              timestamp: parseInt(match[3]),
              hash: match[4],
              extension: match[5],
              isValid: true
            };
          case 'thumbnail':
            return {
              type: 'thumbnail',
              userId: match[1],
              activityId: match[2],
              timestamp: parseInt(match[3]),
              hash: match[4],
              extension: match[5],
              isValid: true
            };
        }
      }
    }

    // If no pattern matches, return basic info
    return {
      type: 'unknown',
      filename: filename,
      baseName: baseName,
      extension: extension,
      isValid: false,
      error: 'Filename does not match any known pattern'
    };
  }

  /**
   * Generate metadata filename from map filename
   * @param {string} mapFilename - Map filename
   * @returns {string} Metadata filename
   */
  static getMetadataFilename(mapFilename) {
    const parsed = this.parseFilename(mapFilename);
    
    if (!parsed.isValid || parsed.type !== 'map') {
      throw new Error(`Cannot generate metadata filename for invalid map file: ${mapFilename}`);
    }

    return `map_${parsed.userId}_${parsed.activityId}_${parsed.format}_${parsed.timestamp}_${parsed.hash}_metadata.json`;
  }

  /**
   * Generate preview filename from map filename
   * @param {string} mapFilename - Map filename
   * @returns {string} Preview filename
   */
  static getPreviewFilename(mapFilename) {
    const parsed = this.parseFilename(mapFilename);
    
    if (!parsed.isValid || parsed.type !== 'map') {
      throw new Error(`Cannot generate preview filename for invalid map file: ${mapFilename}`);
    }

    return `preview_${parsed.userId}_${parsed.activityId}_${parsed.timestamp}_${parsed.hash}.${parsed.extension}`;
  }

  /**
   * Generate thumbnail filename from map filename
   * @param {string} mapFilename - Map filename
   * @returns {string} Thumbnail filename
   */
  static getThumbnailFilename(mapFilename) {
    const parsed = this.parseFilename(mapFilename);
    
    if (!parsed.isValid || parsed.type !== 'map') {
      throw new Error(`Cannot generate thumbnail filename for invalid map file: ${mapFilename}`);
    }

    return `thumb_${parsed.userId}_${parsed.activityId}_${parsed.timestamp}_${parsed.hash}.${parsed.extension}`;
  }

  /**
   * Validate filename format
   * @param {string} filename - Filename to validate
   * @returns {Object} Validation result
   */
  static validateFilename(filename) {
    if (!filename || typeof filename !== 'string') {
      return {
        isValid: false,
        error: 'Filename must be a non-empty string'
      };
    }

    const parsed = this.parseFilename(filename);
    
    if (!parsed.isValid) {
      return {
        isValid: false,
        error: parsed.error || 'Invalid filename format'
      };
    }

    // Additional validation checks
    const validationErrors = [];

    // Check timestamp is reasonable (not too far in past/future)
    if (parsed.timestamp) {
      const now = Date.now();
      const timestampAge = now - parsed.timestamp;
      
      if (timestampAge < -86400000) { // More than 1 day in future
        validationErrors.push('Timestamp appears to be in the future');
      }
      
      if (timestampAge > 31536000000) { // More than 1 year old
        validationErrors.push('Timestamp appears to be very old');
      }
    }

    // Check format validity
    if (parsed.format && !this.formats[parsed.format.toUpperCase()]) {
      validationErrors.push(`Invalid format: ${parsed.format}`);
    }

    // Check extension validity
    if (parsed.extension && parsed.type) {
      const allowedExtensions = this.fileTypes[parsed.type]?.extensions || [];
      if (!allowedExtensions.includes(parsed.extension.toLowerCase())) {
        validationErrors.push(`Invalid extension ${parsed.extension} for type ${parsed.type}`);
      }
    }

    return {
      isValid: validationErrors.length === 0,
      errors: validationErrors.length > 0 ? validationErrors : undefined,
      parsed: parsed
    };
  }

  /**
   * Generate a filename registry entry for tracking
   * @param {string} filename - Filename to register
   * @param {Object} metadata - Additional metadata
   * @returns {Object} Registry entry
   */
  static createRegistryEntry(filename, metadata = {}) {
    const parsed = this.parseFilename(filename);
    const validation = this.validateFilename(filename);

    return {
      filename,
      ...parsed,
      createdAt: new Date().toISOString(),
      validation: validation,
      metadata: metadata
    };
  }

  /**
   * Check if two filenames represent the same logical file
   * @param {string} filename1 - First filename
   * @param {string} filename2 - Second filename
   * @returns {boolean} True if they represent the same file
   */
  static areRelatedFiles(filename1, filename2) {
    try {
      const parsed1 = this.parseFilename(filename1);
      const parsed2 = this.parseFilename(filename2);

      if (!parsed1.isValid || !parsed2.isValid) {
        return false;
      }

      // Check if they have the same user, activity, and timestamp
      return (
        parsed1.userId === parsed2.userId &&
        parsed1.activityId === parsed2.activityId &&
        parsed1.timestamp === parsed2.timestamp
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Private validation methods
   */
  static validateFileType(type) {
    if (!this.fileTypes[type]) {
      throw new Error(`Invalid file type: ${type}. Valid types: ${Object.keys(this.fileTypes).join(', ')}`);
    }
  }

  static validateFormat(format) {
    if (!this.formats[format.toUpperCase()]) {
      throw new Error(`Invalid format: ${format}. Valid formats: ${Object.keys(this.formats).join(', ')}`);
    }
  }

  static validateExtension(extension, type) {
    const allowedExtensions = this.fileTypes[type]?.extensions || [];
    if (!allowedExtensions.includes(extension.toLowerCase())) {
      throw new Error(`Invalid extension ${extension} for type ${type}. Allowed: ${allowedExtensions.join(', ')}`);
    }
  }

  static validateUserId(userId) {
    if (!userId || (typeof userId !== 'string' && typeof userId !== 'number')) {
      throw new Error('UserId must be a non-empty string or number');
    }
  }

  static validateActivityId(activityId) {
    if (!activityId || (typeof activityId !== 'string' && typeof activityId !== 'number')) {
      throw new Error('ActivityId must be a non-empty string or number');
    }
  }

  /**
   * Generate a batch of related filenames
   * @param {Object} baseOptions - Base options for filename generation
   * @returns {Object} Collection of related filenames
   */
  static generateFilenameBatch(baseOptions) {
    const { userId, activityId, format = 'A4', extension = 'png' } = baseOptions;

    const timestamp = Date.now();
    const sharedOptions = { userId, activityId, format, timestamp };

    return {
      map: this.generateFilename({ ...sharedOptions, type: 'map', extension }),
      preview: this.generateFilename({ ...sharedOptions, type: 'preview', extension }),
      thumbnail: this.generateFilename({ ...sharedOptions, type: 'thumbnail', extension }),
      metadata: this.generateFilename({ ...sharedOptions, type: 'metadata' })
    };
  }

  /**
   * Get file format information
   * @param {string} format - Format name
   * @returns {Object} Format details
   */
  static getFormatInfo(format) {
    const formatInfo = this.formats[format.toUpperCase()];
    if (!formatInfo) {
      throw new Error(`Unknown format: ${format}`);
    }
    return { ...formatInfo, name: format.toUpperCase() };
  }

  /**
   * Get all supported formats
   * @returns {Array} List of supported formats
   */
  static getSupportedFormats() {
    return Object.keys(this.formats);
  }

  /**
   * Get all supported file types
   * @returns {Array} List of supported file types
   */
  static getSupportedFileTypes() {
    return Object.keys(this.fileTypes);
  }
}

module.exports = FileNaming;