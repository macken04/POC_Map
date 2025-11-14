const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const multer = require('multer');
const { requireAuth } = require('./auth');
const config = require('../config');
const mapEventService = require('../services/mapEventService');
const fileStorageService = require('../services/fileStorageService');
const fileMonitoringService = require('../services/fileMonitoringService');
const fileCleanupService = require('../services/fileCleanupService');
const { MapService } = require('../services/mapService');
const FileValidationMiddleware = require('../middleware/fileValidation');
const FileNaming = require('../utils/fileNaming');
const FileCompressionUtils = require('../utils/fileCompressionUtils');
const CanvasProcessor = require('../services/canvasProcessor');
const ErrorHandlingService = require('../services/errorHandlingService');
const MapConfigurationService = require('../services/mapConfigurationService');
const { validateMapSession, validatePurchaseSession, saveSessionForRecovery } = require('../middleware/sessionValidation');

const appConfig = config.getConfig();

// Initialize error handling service
const errorHandler = new ErrorHandlingService();

// Initialize map configuration service
const mapConfigService = new MapConfigurationService();

/**
 * Map generation routes
 * Handles creating and managing maps from Strava activity data
 * All routes require authentication
 */

/**
 * Helper function to generate unique map ID
 */
function generateMapId() {
  return `map_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Helper function to decode Strava polyline
 * Converts encoded polyline to array of [lat, lng] coordinates
 */
function decodePolyline(encoded) {
  if (!encoded) return [];
  
  const poly = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    poly.push([lng / 1e5, lat / 1e5]);
  }

  return poly;
}

/**
 * Configure multer for canvas image uploads
 * Memory storage for processing canvas blobs
 */
const canvasUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for high-res images
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Accept PNG and JPEG images
    if (file.mimetype === 'image/png' || file.mimetype === 'image/jpeg') {
      cb(null, true);
    } else {
      cb(new Error('Only PNG and JPEG images are allowed for canvas export'), false);
    }
  }
});

/**
 * Generate a web-quality preview image using activity ID and map configuration
 * Improved implementation: fetches fresh activity data and uses map configuration
 */
router.post('/generate-preview', requireAuth, async (req, res) => {
  try {
    const {
      activityId,
      mapConfiguration,
      format = 'A4',
      orientation = 'portrait'
    } = req.body;

    if (!activityId) {
      return res.status(400).json({
        error: 'Missing activity ID',
        message: 'Activity ID is required for preview generation'
      });
    }

    if (!mapConfiguration) {
      return res.status(400).json({
        error: 'Missing map configuration',
        message: 'Map configuration is required for preview generation'
      });
    }

    // Define preview dimensions (web quality - 96 DPI)
    const previewDimensions = {
      A4: {
        portrait: { width: 595, height: 842 },
        landscape: { width: 842, height: 595 }
      },
      A3: {
        portrait: { width: 842, height: 1191 },
        landscape: { width: 1191, height: 842 }
      }
    };

    const selectedFormat = format.toUpperCase();
    const selectedOrientation = orientation.toLowerCase();
    
    if (!previewDimensions[selectedFormat]?.[selectedOrientation]) {
      return res.status(400).json({
        error: 'Invalid format or orientation',
        message: 'Format must be A4/A3 and orientation must be portrait/landscape'
      });
    }

    const dimensions = previewDimensions[selectedFormat][selectedOrientation];

    // Fetch fresh activity data from Strava API
    const stravaService = require('../services/stravaService');
    let activityData;
    
    try {
      // Ensure the request has the proper token access method for the service
      if (!req.getAccessToken && req.session.strava?.access_token) {
        req.getAccessToken = () => req.session.strava.access_token;
      }
      
      if (!req.getAccessToken || !req.getAccessToken()) {
        return res.status(401).json({
          error: 'Strava authentication required',
          message: 'Please authenticate with Strava first'
        });
      }

      activityData = await stravaService.getActivityDetails(req, activityId);
      console.log('Fetched fresh activity data for preview:', {
        id: activityData.id,
        name: activityData.name,
        hasPolyline: !!activityData.map?.summary_polyline
      });
    } catch (error) {
      console.error('Failed to fetch activity from Strava:', error);
      
      // Handle different types of errors more specifically
      if (error.status === 401) {
        return res.status(401).json({
          error: 'Token expired',
          message: 'Strava access token has expired. Please re-authenticate.'
        });
      } else if (error.status === 404) {
        return res.status(404).json({
          error: 'Activity not found',
          message: `Activity ${activityId} not found or you do not have access to it`
        });
      } else if (error.status === 429) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: 'Strava API rate limit exceeded. Please try again later.'
        });
      } else {
        return res.status(500).json({
          error: 'Activity fetch failed',
          message: 'Could not fetch activity data from Strava API',
          details: error.message
        });
      }
    }

    // Process route coordinates from fresh activity data
    let routeCoordinates = [];
    if (activityData.map?.summary_polyline) {
      routeCoordinates = decodePolyline(activityData.map.summary_polyline);
    }

    if (routeCoordinates.length === 0) {
      return res.status(400).json({
        error: 'No route data',
        message: 'Activity does not contain route coordinates'
      });
    }

    console.log('MapService: Decoded route coordinates:', {
      count: routeCoordinates.length,
      first: routeCoordinates[0],
      last: routeCoordinates[routeCoordinates.length - 1],
      format: '[lng, lat]'
    });

    // Use map configuration from frontend if provided, otherwise calculate bounds
    let bounds = mapConfiguration.bounds;
    let center = mapConfiguration.center;

    if (!bounds || !center) {
      // Fallback: calculate bounds from route coordinates
      // decodePolyline returns coordinates in [longitude, latitude] format
      const lngs = routeCoordinates.map(coord => coord[0]); // longitude is coord[0]
      const lats = routeCoordinates.map(coord => coord[1]); // latitude is coord[1]
      
      bounds = {
        north: Math.max(...lats),
        south: Math.min(...lats),
        east: Math.max(...lngs),
        west: Math.min(...lngs)
      };

      // Add padding to bounds
      const latPadding = (bounds.north - bounds.south) * 0.1;
      const lngPadding = (bounds.east - bounds.west) * 0.1;
      
      bounds = {
        north: bounds.north + latPadding,
        south: bounds.south - latPadding,
        east: bounds.east + lngPadding,
        west: bounds.west - lngPadding
      };

      center = [
        (bounds.north + bounds.south) / 2,
        (bounds.east + bounds.west) / 2
      ];
    }

    // Generate unique preview ID
    const previewId = `preview_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Initialize MapService for style normalization
    console.log('Initializing MapService for preview generation...');
    const mapService = require('../services/mapService');
    await mapService.initialize();

    const previewConfig = {
      id: previewId,
      center: center,
      bounds: bounds,
      style: MapService.normalizeMapboxStyleURL(mapConfiguration.style),
      width: dimensions.width,
      height: dimensions.height,
      format: selectedFormat,
      orientation: selectedOrientation,
      dpi: 96, // Web quality for preview
      route: {
        coordinates: routeCoordinates,
        color: mapConfiguration.customization?.routeColor || '#ff4444',
        width: mapConfiguration.customization?.routeWidth || 3
      },
      markers: mapConfiguration.customization?.showMarkers ? {
        start: routeCoordinates[0],
        end: routeCoordinates[routeCoordinates.length - 1]
      } : null,
      customization: mapConfiguration.customization || {}
    };

    // Log the route coordinates in the preview config
    console.log('MapService: Preview config route coordinates:', {
      count: previewConfig.route.coordinates.length,
      first: previewConfig.route.coordinates[0],
      format: '[lng, lat]'
    });
    
    // Generate the preview image
    console.log('Generating preview image with config:', previewConfig);
    const previewPath = await mapService.generatePreviewImage(previewConfig);
    console.log('Preview image generated at path:', previewPath);
    
    // Store preview metadata in session with activity reference
    if (!req.session.mapPreviews) {
      req.session.mapPreviews = {};
    }
    
    const previewData = {
      id: previewId,
      config: previewConfig,
      filePath: previewPath,
      createdAt: new Date().toISOString(),
      approved: false,
      activityId: activityId,
      activityName: activityData.name,
      mapConfiguration: mapConfiguration // Store original configuration
    };
    
    req.session.mapPreviews[previewId] = previewData;

    // Also store in cross-domain token store for cross-domain flows
    const crossDomainToken = req.query.token || req.headers['x-session-token'];
    if (crossDomainToken) {
      const crossDomainTokenStore = require('../services/crossDomainTokenStore');
      crossDomainTokenStore.storeMapPreview(crossDomainToken, previewId, previewData);
    }

    const previewUrl = `/api/maps/preview-image/${previewId}`;

    res.json({
      success: true,
      preview: {
        id: previewId,
        url: previewUrl,
        config: previewConfig,
        dimensions: dimensions,
        activityName: activityData.name,
        createdAt: new Date().toISOString()
      },
      message: 'Preview generated successfully using fresh activity data'
    });

  } catch (error) {
    console.error('Error generating preview:', error);
    res.status(500).json({
      error: 'Preview generation failed',
      message: error.message
    });
  }
});

/**
 * Generate a map preview from activity data
 * Returns map configuration for frontend rendering
 */
router.post('/preview', requireAuth, async (req, res) => {
  try {
    const {
      activityId,
      polyline,
      coordinates,
      style = 'streets-v12',
      format = 'A4',
      orientation = 'portrait',
      showStartEnd = true,
      lineColor = '#ff4444',
      lineWidth = 3
    } = req.body;

    // Define poster dimensions for preview (scaled from print dimensions)
    const posterDimensions = {
      A4: {
        portrait: { width: 595, height: 842 },  // A4 ratio scaled for preview
        landscape: { width: 842, height: 595 }
      },
      A3: {
        portrait: { width: 842, height: 1191 }, // A3 ratio scaled for preview
        landscape: { width: 1191, height: 842 }
      }
    };

    // Get dimensions based on format and orientation
    const selectedFormat = format.toUpperCase();
    const selectedOrientation = orientation.toLowerCase();
    
    if (!posterDimensions[selectedFormat]) {
      return res.status(400).json({
        error: 'Invalid format',
        message: 'Format must be A4 or A3'
      });
    }

    if (!posterDimensions[selectedFormat][selectedOrientation]) {
      return res.status(400).json({
        error: 'Invalid orientation',
        message: 'Orientation must be portrait or landscape'
      });
    }

    const dimensions = posterDimensions[selectedFormat][selectedOrientation];
    const width = dimensions.width;
    const height = dimensions.height;

    if (!activityId && !polyline && !coordinates) {
      return res.status(400).json({
        error: 'Missing activity data',
        message: 'Either activityId, polyline, or coordinates must be provided'
      });
    }

    let routeCoordinates = [];

    // Decode polyline if provided
    if (polyline) {
      routeCoordinates = decodePolyline(polyline);
    } else if (coordinates) {
      routeCoordinates = coordinates;
    }

    if (routeCoordinates.length === 0) {
      return res.status(400).json({
        error: 'No route data',
        message: 'Could not extract route coordinates from provided data'
      });
    }

    // Calculate bounding box for the route
    // decodePolyline returns coordinates in [longitude, latitude] format
    const lngs = routeCoordinates.map(coord => coord[0]); // longitude is coord[0]
    const lats = routeCoordinates.map(coord => coord[1]); // latitude is coord[1]
    
    const bounds = {
      north: Math.max(...lats),
      south: Math.min(...lats),
      east: Math.max(...lngs),
      west: Math.min(...lngs)
    };

    // Add padding to bounds
    const latPadding = (bounds.north - bounds.south) * 0.1;
    const lngPadding = (bounds.east - bounds.west) * 0.1;
    
    const paddedBounds = {
      north: bounds.north + latPadding,
      south: bounds.south - latPadding,
      east: bounds.east + lngPadding,
      west: bounds.west - lngPadding
    };

    // Calculate center point
    const center = [
      (bounds.north + bounds.south) / 2,
      (bounds.east + bounds.west) / 2
    ];

    const mapConfig = {
      id: generateMapId(),
      center: center,
      bounds: paddedBounds,
      style: MapService.normalizeMapboxStyleURL(style),
      width: parseInt(width),
      height: parseInt(height),
      format: selectedFormat,
      orientation: selectedOrientation,
      route: {
        coordinates: routeCoordinates,
        color: lineColor,
        width: lineWidth
      },
      markers: showStartEnd ? {
        start: routeCoordinates[0],
        end: routeCoordinates[routeCoordinates.length - 1]
      } : null
    };

    // Generate unique preview ID
    const previewId = `preview_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store preview metadata in session for confirmation flow
    if (!req.session.mapPreviews) {
      req.session.mapPreviews = {};
    }
    
    const previewData = {
      id: previewId,
      config: mapConfig,
      filePath: null, // No file generated for preview endpoint
      createdAt: new Date().toISOString(),
      approved: false,
      activityId: activityId,
      activityName: activityId ? `Activity ${activityId}` : 'Custom Route', // Default name for custom routes
      mapConfiguration: {
        style,
        format,
        orientation,
        showStartEnd,
        lineColor,
        lineWidth,
        polyline,
        coordinates
      }
    };
    
    req.session.mapPreviews[previewId] = previewData;

    // Also store in cross-domain token store for cross-domain flows
    const crossDomainToken = req.query.token || req.headers['x-session-token'];
    if (crossDomainToken) {
      const crossDomainTokenStore = require('../services/crossDomainTokenStore');
      crossDomainTokenStore.storeMapPreview(crossDomainToken, previewId, previewData);
    }

    res.json({
      success: true,
      previewId: previewId,
      preview: mapConfig,
      stats: {
        totalPoints: routeCoordinates.length,
        bounds: bounds,
        center: center
      }
    });

  } catch (error) {
    console.error('Error generating map preview:', error);
    res.status(500).json({
      error: 'Failed to generate preview',
      message: 'Unable to generate map preview'
    });
  }
});

/**
 * Export canvas data to high-resolution map file
 * Accepts canvas image data from frontend and processes it for storage
 */
router.post('/export-map', requireAuth, canvasUpload.single('map'), async (req, res) => {
  const progressService = req.app.locals.progressService;
  let jobId = null;
  
  try {
    const { activityId, size, style, orientation = 'portrait', quality = 'print' } = req.body;

    // Validate required fields
    if (!req.file) {
      return res.status(400).json({
        error: 'No map image provided',
        message: 'Canvas image data is required for export'
      });
    }

    if (!activityId) {
      return res.status(400).json({
        error: 'Missing activity ID',
        message: 'Activity ID is required for map export'
      });
    }

    // Validate size parameter
    const validSizes = ['A4', 'A3', 'A2', 'A1', 'A0'];
    if (size && !validSizes.includes(size.toUpperCase())) {
      return res.status(400).json({
        error: 'Invalid size',
        message: `Size must be one of: ${validSizes.join(', ')}`
      });
    }

    // Validate orientation
    const validOrientations = ['portrait', 'landscape'];
    if (orientation && !validOrientations.includes(orientation.toLowerCase())) {
      return res.status(400).json({
        error: 'Invalid orientation',
        message: `Orientation must be: ${validOrientations.join(' or ')}`
      });
    }

    // Get user information
    const userId = req.session.strava.athlete.id;
    const userName = req.session.strava.athlete.firstname || 'User';

    // Generate unique map ID and filename
    const mapId = generateMapId();
    const mapSize = (size || 'A4').toUpperCase();
    const mapOrientation = orientation.toLowerCase();

    // Start progress tracking if available
    if (progressService) {
      jobId = `export_${mapId}`;
      progressService.startJob(jobId, {
        userId: userId,
        type: 'canvas-export',
        steps: [
          'Validating canvas data',
          'Processing image',
          'Optimizing for print',
          'Saving to storage',
          'Finalizing export'
        ],
        metadata: {
          activityId: activityId,
          size: mapSize,
          orientation: mapOrientation,
          quality: quality
        },
        cancellable: false // Canvas export is quick, no need for cancellation
      });
      
      progressService.updateProgress(jobId, {
        progress: 10,
        status: 'processing',
        message: 'Validating canvas data...'
      });
    }
    
    // Initialize canvas processor
    const canvasProcessor = new CanvasProcessor();
    
    // Update progress - processing image
    if (progressService && jobId) {
      progressService.updateProgress(jobId, {
        progress: 30,
        currentStep: 1,
        message: 'Processing image for print quality...'
      });
    }

    // Process the canvas image with enhanced error handling and recovery
    let processedBuffer = req.file.buffer;
    let fileExtension = req.file.mimetype === 'image/jpeg' ? 'jpg' : 'png';
    let processedSize = req.file.size;
    
    // Create graceful degradation handler
    const degradationHandler = errorHandler.createDegradationHandler({
      fallbackQuality: 85,
      fallbackFormat: fileExtension === 'jpg' ? 'jpeg' : 'png',
      maxDimensions: { width: 4096, height: 4096 },
      enableFallbacks: true
    });
    
    const processWithRetry = async (attempt = 1) => {
      const processingOptions = {
        format: fileExtension === 'jpg' ? 'jpeg' : 'png',
        quality: quality,
        dpi: 300,
        metadata: {
          title: `${userName}'s ${mapSize} ${mapOrientation} Map`,
          description: `High-quality ${quality} print from Strava activity ${activityId}`,
          copyright: '© Print My Ride'
        },
        optimization: true
      };

      return await canvasProcessor.processCanvas(req.file.buffer, processingOptions);
    };

    try {
      // Execute canvas processing with retry logic and degradation
      const processingResult = await errorHandler.executeWithRetry(
        processWithRetry,
        {
          maxRetries: 2,
          baseDelay: 1000,
          retryStrategy: 'exponential',
          context: 'canvas_processing',
          progressCallback: (retryInfo) => {
            if (progressService && jobId) {
              progressService.updateProgress(jobId, {
                progress: 35 + (retryInfo.attempt * 5),
                currentStep: 1,
                message: `Processing image (attempt ${retryInfo.attempt + 1}/${retryInfo.maxRetries + 1})...`
              });
            }
          },
          onRetry: async (error, attempt, classification) => {
            console.warn(`Canvas processing retry ${attempt}: ${error.message}`);
            
            // Apply degradation if this is a resource-intensive error
            if (classification.category === 'resource' || classification.category === 'processing') {
              const degradedOptions = await degradationHandler(error, {
                quality: quality,
                format: fileExtension === 'jpg' ? 'jpeg' : 'png'
              });
              
              console.log('Applying degradation:', degradedOptions.degradationApplied);
              
              if (progressService && jobId) {
                progressService.updateProgress(jobId, {
                  progress: 40,
                  currentStep: 1,
                  message: `Applying quality optimization (${degradedOptions.degradationApplied})...`
                });
              }
            }
          }
        }
      );
      
      processedBuffer = processingResult.buffer;
      processedSize = processingResult.processedSize;
      
      console.log(`Canvas processed: ${req.file.size} → ${processedSize} bytes (${processingResult.compressionRatio}% reduction)`);
      
      // Update progress - optimization complete
      if (progressService && jobId) {
        progressService.updateProgress(jobId, {
          progress: 60,
          currentStep: 2,
          message: 'Image optimized for print quality',
          metadata: {
            originalSize: req.file.size,
            processedSize: processedSize,
            compressionRatio: processingResult.compressionRatio
          }
        });
      }
      
    } catch (processingError) {
      console.warn('Canvas processing failed after retries, using original:', processingError.message);
      
      const classification = errorHandler.classifyError(processingError);
      
      // Update progress with appropriate error handling message
      if (progressService && jobId) {
        progressService.updateProgress(jobId, {
          progress: 50,
          currentStep: 2,
          message: classification.userMessage || 'Using original image quality',
          metadata: { 
            processingError: processingError.message,
            errorType: classification.type,
            fallbackApplied: true
          }
        });
      }
      
      // Log detailed error information for debugging
      console.error('Detailed processing error:', {
        error: processingError.message,
        classification: classification.type,
        category: classification.category,
        severity: classification.severity,
        context: processingError.context || 'canvas_processing'
      });
    }

    const filename = `${mapId}_${mapSize}_${mapOrientation}_${quality}_${Date.now()}.${fileExtension}`;

    // Update progress - saving to storage
    if (progressService && jobId) {
      progressService.updateProgress(jobId, {
        progress: 75,
        currentStep: 3,
        message: 'Saving to permanent storage...'
      });
    }

    // Save the processed canvas image to permanent storage with retry logic
    const saveFileWithRetry = async () => {
      return await fileStorageService.saveFile(
        processedBuffer,
        filename,
        'permanent',
        {
          userId: userId.toString(),
          activityId: activityId,
          size: mapSize,
          orientation: mapOrientation,
          style: style || 'default',
          quality: quality,
          format: fileExtension,
          originalSize: req.file.size,
          processedSize: processedSize,
          uploadedAt: new Date().toISOString()
        }
      );
    };

    let mapInfo;
    try {
      mapInfo = await errorHandler.executeWithRetry(
        saveFileWithRetry,
        {
          maxRetries: 3,
          baseDelay: 1500,
          retryStrategy: 'exponential',
          context: 'file_storage',
          progressCallback: (retryInfo) => {
            if (progressService && jobId) {
              progressService.updateProgress(jobId, {
                progress: 75 + (retryInfo.attempt * 3),
                currentStep: 3,
                message: `Saving to storage (attempt ${retryInfo.attempt + 1}/${retryInfo.maxRetries + 1})...`
              });
            }
          },
          onRetry: async (error, attempt, classification) => {
            console.warn(`File storage retry ${attempt}: ${error.message}`);
            
            if (progressService && jobId) {
              progressService.updateProgress(jobId, {
                progress: 75 + (attempt * 2),
                currentStep: 3,
                message: `Retrying storage operation (${classification.userMessage})...`
              });
            }
          }
        }
      );
    } catch (storageError) {
      console.error('File storage failed after retries:', storageError.message);
      
      // Fail the progress tracking job
      if (progressService && jobId) {
        progressService.failJob(jobId, storageError);
      }
      
      const classification = errorHandler.classifyError(storageError);
      
      return res.status(500).json({
        error: 'Storage failed',
        message: classification.userMessage || 'Unable to save exported map after multiple attempts',
        details: {
          errorType: classification.type,
          category: classification.category,
          retryable: classification.retryable
        }
      });
    }

    // Store map metadata in session for Shopify checkout integration
    if (!req.session.maps) {
      req.session.maps = {};
    }

    const sessionMapData = {
      mapId: mapId,
      filename: filename,
      activityId: activityId,
      userId: userId,
      userName: userName,
      size: mapSize,
      orientation: mapOrientation,
      style: style || 'default',
      quality: quality,
      format: fileExtension,
      fileSize: req.file.size,
      filePath: mapInfo.filePath,
      url: `/api/maps/files/permanent/${filename}`,
      previewUrl: `/api/maps/files/permanent/${filename}`, // Same for now, could generate thumbnail later
      createdAt: new Date().toISOString(),
      status: 'completed'
    };

    req.session.maps[mapId] = sessionMapData;

    // Update progress - finalizing
    if (progressService && jobId) {
      progressService.updateProgress(jobId, {
        progress: 90,
        currentStep: 4,
        message: 'Finalizing export...'
      });
    }

    // Log the export event for analytics
    await mapEventService.logEvent('canvas_export', {
      mapId: mapId,
      activityId: activityId,
      size: mapSize,
      orientation: mapOrientation,
      quality: quality,
      fileSize: req.file.size,
      format: fileExtension
    }, userId, req.sessionID);

    // Complete progress tracking
    if (progressService && jobId) {
      progressService.completeJob(jobId, {
        mapId: mapId,
        filename: filename,
        fileSize: processedSize,
        downloadUrl: `/api/maps/files/permanent/${filename}`
      });
    }

    // Respond with success and map information
    res.json({
      success: true,
      mapId: mapId,
      status: 'completed',
      message: 'Canvas exported successfully',
      map: {
        id: mapId,
        filename: filename,
        size: mapSize,
        orientation: mapOrientation,
        quality: quality,
        format: fileExtension,
        fileSize: req.file.size,
        downloadUrl: `/api/maps/files/permanent/${filename}`,
        previewUrl: `/api/maps/files/permanent/${filename}`,
        createdAt: sessionMapData.createdAt
      },
      // Include session data for immediate checkout use
      checkout: {
        title: `${userName}'s ${mapSize} ${mapOrientation} Map`,
        description: `High-quality ${quality} print (${fileExtension.toUpperCase()})`,
        price: 2999, // $29.99 in cents - could be dynamic based on size
        image: `/api/maps/files/permanent/${filename}`
      }
    });

  } catch (error) {
    console.error('Error processing canvas export:', error);
    
    // Classify the error to provide appropriate response
    const classification = errorHandler.classifyError(error);
    
    // Fail progress tracking if active
    if (progressService && jobId) {
      progressService.failJob(jobId, error.message || 'Canvas export failed');
    }
    
    // Handle specific multer errors
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'File too large',
        message: 'Canvas image exceeds maximum file size limit (50MB)',
        details: {
          errorType: 'FILE_SIZE_ERROR',
          category: 'validation',
          retryable: false
        }
      });
    }

    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        error: 'Invalid file',
        message: 'Only single canvas image uploads are allowed',
        details: {
          errorType: 'FILE_TYPE_ERROR',
          category: 'validation',
          retryable: false
        }
      });
    }

    // Handle retry-exhausted errors with enhanced context
    if (error.isRetryExhausted) {
      const statusCode = classification.severity === 'high' ? 500 : 
                        classification.severity === 'medium' ? 503 : 400;
      
      return res.status(statusCode).json({
        error: 'Operation failed',
        message: classification.userMessage || 'Unable to complete export after multiple attempts',
        details: {
          errorType: classification.type,
          category: classification.category,
          severity: classification.severity,
          retryable: classification.retryable,
          totalAttempts: error.context?.totalAttempts || 1,
          context: error.context?.context || 'canvas_export'
        }
      });
    }

    // Log detailed error information for debugging and metrics
    await mapEventService.logEvent('canvas_export_error', {
      error: error.message,
      stack: error.stack,
      classification: classification.type,
      category: classification.category,
      severity: classification.severity,
      userId: req.session.strava?.athlete?.id,
      activityId: req.body.activityId,
      context: error.context || 'canvas_export',
      timestamp: new Date().toISOString()
    }, req.session.strava?.athlete?.id, req.sessionID).catch(() => {});

    // Record error metrics
    errorHandler.recordError('canvas_export_route', error);

    // Determine appropriate HTTP status code based on error classification
    const statusCode = classification.category === 'validation' ? 400 :
                      classification.category === 'resource' ? 503 :
                      classification.severity === 'low' ? 400 :
                      classification.severity === 'medium' ? 503 : 500;

    // Provide user-friendly error response
    res.status(statusCode).json({
      error: 'Export failed',
      message: classification.userMessage || 'Unable to process canvas export. Please try again.',
      details: {
        errorType: classification.type,
        category: classification.category,
        severity: classification.severity,
        retryable: classification.retryable,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * Get error handling metrics and service health
 */
router.get('/error-metrics', requireAuth, (req, res) => {
  try {
    const metrics = errorHandler.getAllErrorMetrics();
    const timestamp = new Date().toISOString();
    
    // Calculate service health based on error rates
    const serviceHealth = {
      status: 'healthy',
      issues: []
    };
    
    for (const [context, data] of Object.entries(metrics)) {
      const errorRate = data.totalErrors / Math.max(1, (Date.now() - data.firstErrorTime) / 60000); // errors per minute
      
      if (data.consecutiveFailures >= 3) {
        serviceHealth.status = 'degraded';
        serviceHealth.issues.push(`${context}: ${data.consecutiveFailures} consecutive failures`);
      }
      
      if (errorRate > 5) { // More than 5 errors per minute
        serviceHealth.status = 'unhealthy';
        serviceHealth.issues.push(`${context}: High error rate (${errorRate.toFixed(2)}/min)`);
      }
    }
    
    res.json({
      success: true,
      timestamp: timestamp,
      serviceHealth: serviceHealth,
      errorMetrics: metrics,
      summary: {
        totalContexts: Object.keys(metrics).length,
        totalErrors: Object.values(metrics).reduce((sum, data) => sum + data.totalErrors, 0),
        activeIssues: serviceHealth.issues.length
      }
    });
    
  } catch (error) {
    console.error('Error retrieving error metrics:', error);
    res.status(500).json({
      error: 'Metrics unavailable',
      message: 'Unable to retrieve error handling metrics'
    });
  }
});

/**
 * Reset error metrics for a specific context (admin endpoint)
 */
router.post('/reset-error-metrics', requireAuth, (req, res) => {
  try {
    const { context } = req.body;
    
    if (!context) {
      return res.status(400).json({
        error: 'Missing context',
        message: 'Context parameter is required'
      });
    }
    
    errorHandler.resetErrorMetrics(context);
    
    res.json({
      success: true,
      message: `Error metrics reset for context: ${context}`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error resetting metrics:', error);
    res.status(500).json({
      error: 'Reset failed',
      message: 'Unable to reset error metrics'
    });
  }
});

/**
 * Generate high-resolution map from validated preview configuration
 * This optimized endpoint reuses the configuration from a successful preview,
 * avoiding duplicate validation and processing
 */
router.post('/generate-from-preview/:previewId', requireAuth, async (req, res) => {
  try {
    const { previewId } = req.params;
    const { 
      format = 'A4', 
      orientation = 'portrait',
      dpi = 300 
    } = req.body;

    // Validate preview exists in session
    if (!req.session.mapPreviews?.[previewId]) {
      return res.status(404).json({
        error: 'Preview not found',
        message: 'Preview ID not found in session or has expired'
      });
    }

    const preview = req.session.mapPreviews[previewId];
    const previewConfig = preview.config;

    console.log('MapService: Generating high-res map from preview config:', {
      previewId,
      originalDimensions: `${previewConfig.width}x${previewConfig.height}`,
      targetFormat: format,
      targetOrientation: orientation,
      targetDpi: dpi
    });

    // Calculate high-resolution dimensions
    const highResDimensions = {
      A4: {
        portrait: { width: 2480, height: 3508 },  // 300 DPI
        landscape: { width: 3508, height: 2480 }
      },
      A3: {
        portrait: { width: 3508, height: 4961 },  // 300 DPI  
        landscape: { width: 4961, height: 3508 }
      }
    };

    const selectedFormat = format.toUpperCase();
    const selectedOrientation = orientation.toLowerCase();
    
    if (!highResDimensions[selectedFormat]?.[selectedOrientation]) {
      return res.status(400).json({
        error: 'Invalid format or orientation',
        message: 'Format must be A4/A3 and orientation must be portrait/landscape'
      });
    }

    const targetDimensions = highResDimensions[selectedFormat][selectedOrientation];

    // Create high-resolution config based on validated preview config
    const highResConfig = {
      ...previewConfig, // Reuse all validated settings
      width: targetDimensions.width,
      height: targetDimensions.height,
      format: selectedFormat,
      orientation: selectedOrientation,
      dpi: dpi,
      // Generate new ID for high-res version
      id: `highres_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    console.log('[Maps] HIGH-RES CONFIG CREATION DEBUG:', {
      previewConfigHasRoute: !!previewConfig.route,
      previewRouteColor: previewConfig.route?.color,
      highResConfigHasRoute: !!highResConfig.route,
      highResRouteColor: highResConfig.route?.color
    });

    // Initialize MapService
    const mapService = require('../services/mapService');
    await mapService.initialize();

    // Generate high-resolution map using the validated configuration
    console.log('MapService: Starting high-res generation with reused config');
    const startTime = Date.now();
    
    const mapPath = await mapService.generateHighResFromPreviewConfig(highResConfig);
    
    const generationTime = Date.now() - startTime;
    console.log(`MapService: High-res map generated in ${generationTime}ms using preview config`);

    // Return success response
    res.json({
      success: true,
      message: 'High-resolution map generated successfully from preview',
      mapPath: mapPath,
      config: {
        dimensions: targetDimensions,
        format: selectedFormat,
        orientation: selectedOrientation,
        dpi: dpi,
        generationTime: `${generationTime}ms`,
        sourcePreviewId: previewId
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error generating high-res map from preview:', error);
    res.status(500).json({
      error: 'High-resolution map generation failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Internal endpoint: Generate high-resolution map from validated preview configuration
 * This is used by Shopify webhook processing for paid orders and bypasses authentication
 * WARNING: This endpoint should only be called internally, not exposed to external users
 */
router.post('/generate-from-preview-internal/:previewId', async (req, res) => {
  try {
    const { previewId } = req.params;
    const { 
      format = 'A4', 
      orientation = 'portrait',
      dpi = 300 
    } = req.body;

    console.log('[Internal Generation] Processing internal high-res request:', {
      previewId,
      format,
      orientation,
      dpi
    });

    // For internal calls, we need to find the preview in any active session
    // This is safe because we're processing paid orders
    let previewConfig = null;
    
    // Search through all active sessions to find the preview
    // This is necessary because webhook processing doesn't have access to the original session
    const sessionStore = req.sessionStore;
    if (sessionStore && sessionStore.all) {
      await new Promise((resolve, reject) => {
        sessionStore.all((err, sessions) => {
          if (err) {
            console.error('[Internal Generation] Error accessing session store:', err);
            return reject(err);
          }
          
          // Search for preview in all sessions
          for (const sessionId in sessions) {
            const session = sessions[sessionId];
            if (session.mapPreviews && session.mapPreviews[previewId]) {
              previewConfig = session.mapPreviews[previewId].config;
              console.log('[Internal Generation] Found preview in session:', sessionId);
              break;
            }
          }
          resolve();
        });
      });
    }

    if (!previewConfig) {
      return res.status(404).json({
        error: 'Preview not found',
        message: 'Preview ID not found in any active session - may have expired'
      });
    }

    // Calculate high-resolution dimensions
    const highResDimensions = {
      A4: {
        portrait: { width: 2480, height: 3508 },  // 300 DPI
        landscape: { width: 3508, height: 2480 }
      },
      A3: {
        portrait: { width: 3508, height: 4961 },  // 300 DPI  
        landscape: { width: 4961, height: 3508 }
      }
    };

    const selectedFormat = format.toUpperCase();
    const selectedOrientation = orientation.toLowerCase();
    
    if (!highResDimensions[selectedFormat]?.[selectedOrientation]) {
      return res.status(400).json({
        error: 'Invalid format or orientation',
        message: 'Format must be A4/A3 and orientation must be portrait/landscape'
      });
    }

    const targetDimensions = highResDimensions[selectedFormat][selectedOrientation];

    // Create high-resolution config based on validated preview config
    const highResConfig = {
      ...previewConfig, // Reuse all validated settings
      width: targetDimensions.width,
      height: targetDimensions.height,
      format: selectedFormat,
      orientation: selectedOrientation,
      dpi: dpi,
      // Generate new ID for high-res version
      id: `highres_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    // Initialize MapService
    const mapService = require('../services/mapService');
    await mapService.initialize();

    // Generate high-resolution map using the validated configuration
    console.log('[Internal Generation] Starting high-res generation with reused config');
    const startTime = Date.now();
    
    const mapPath = await mapService.generateHighResFromPreviewConfig(highResConfig);
    
    const generationTime = Date.now() - startTime;
    console.log(`[Internal Generation] High-res map generated in ${generationTime}ms using preview config`);

    // Return success response
    res.json({
      success: true,
      message: 'High-resolution map generated successfully from preview (internal)',
      mapPath: mapPath,
      config: {
        dimensions: targetDimensions,
        format: selectedFormat,
        orientation: selectedOrientation,
        dpi: dpi,
        generationTime: `${generationTime}ms`,
        sourcePreviewId: previewId
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Internal Generation] Error generating high-res map from preview:', error);
    res.status(500).json({
      error: 'Internal high-resolution map generation failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Generate a high-resolution map for printing
 * Creates a 300 DPI map image and saves it to disk
 * Note: Consider using /generate-from-preview/:previewId for better performance
 */
router.post('/generate', requireAuth, async (req, res) => {
  try {
    const {
      activityId,
      polyline,
      coordinates,
      format = 'A4', // A4 or A3
      style = 'streets-v12',
      title,
      showStartEnd = true,
      lineColor = '#ff4444',
      lineWidth = 4,
      customization = {}
    } = req.body;

    if (!activityId && !polyline && !coordinates) {
      return res.status(400).json({
        error: 'Missing activity data',
        message: 'Either activityId, polyline, or coordinates must be provided'
      });
    }

    // Set dimensions based on format (300 DPI)
    const dimensions = {
      A4: { width: 2480, height: 3508 },
      A3: { width: 3508, height: 4961 }
    };

    if (!dimensions[format]) {
      return res.status(400).json({
        error: 'Invalid format',
        message: 'Format must be A4 or A3'
      });
    }

    let routeCoordinates = [];

    // Decode polyline if provided
    if (polyline) {
      routeCoordinates = decodePolyline(polyline);
    } else if (coordinates) {
      routeCoordinates = coordinates;
    }

    if (routeCoordinates.length === 0) {
      return res.status(400).json({
        error: 'No route data',
        message: 'Could not extract route coordinates from provided data'
      });
    }

    // Calculate bounding box and center
    // decodePolyline returns coordinates in [longitude, latitude] format
    const lngs = routeCoordinates.map(coord => coord[0]); // longitude is coord[0]
    const lats = routeCoordinates.map(coord => coord[1]); // latitude is coord[1]
    
    const bounds = {
      north: Math.max(...lats),
      south: Math.min(...lats),
      east: Math.max(...lngs),
      west: Math.min(...lngs)
    };

    const center = [
      (bounds.north + bounds.south) / 2,
      (bounds.east + bounds.west) / 2
    ];

    // Generate unique map ID and filename
    const mapId = generateMapId();
    const filename = `${mapId}_${format.toLowerCase()}_300dpi.png`;
    const filepath = path.join(appConfig.storage.generatedMapsDir, filename);

    // Create map generation job data
    const mapJob = {
      id: mapId,
      userId: req.session.strava.athlete.id,
      activityId: activityId,
      filename: filename,
      filepath: filepath,
      status: 'pending',
      format: format,
      dimensions: dimensions[format],
      style: `mapbox://styles/mapbox/${style}`,
      route: {
        coordinates: routeCoordinates,
        color: lineColor,
        width: lineWidth
      },
      bounds: bounds,
      center: center,
      title: title,
      showStartEnd: showStartEnd,
      customization: customization,
      createdAt: new Date().toISOString()
    };

    // Store job metadata (in production, this would go to a database)
    const metadataPath = path.join(appConfig.storage.generatedMapsDir, `${mapId}_metadata.json`);
    await fs.writeFile(metadataPath, JSON.stringify(mapJob, null, 2));

    res.json({
      success: true,
      mapId: mapId,
      status: 'queued',
      message: 'Map generation queued. Use /maps/{mapId}/status to check progress.',
      downloadUrl: `/api/maps/${mapId}/download`,
      previewUrl: `/api/maps/${mapId}/preview`
    });

    // TODO: In a production environment, this would be queued for background processing
    // For now, we'll simulate the job being processed
    setTimeout(async () => {
      try {
        // Update job status to completed (simulation)
        mapJob.status = 'completed';
        mapJob.completedAt = new Date().toISOString();
        await fs.writeFile(metadataPath, JSON.stringify(mapJob, null, 2));
      } catch (error) {
        console.error('Error updating map job status:', error);
      }
    }, 5000);

  } catch (error) {
    console.error('Error generating map:', error);
    res.status(500).json({
      error: 'Failed to generate map',
      message: 'Unable to queue map generation'
    });
  }
});

/**
 * Get maps from session (for checkout integration)
 * Returns maps stored in user session ready for Shopify checkout
 */
router.get('/session', requireAuth, async (req, res) => {
  try {
    const sessionMaps = req.session.maps || {};
    const mapIds = Object.keys(sessionMaps);

    if (mapIds.length === 0) {
      return res.json({
        success: true,
        maps: [],
        count: 0,
        message: 'No maps in session'
      });
    }

    // Convert session maps to array format
    const mapsArray = mapIds.map(mapId => {
      const mapData = sessionMaps[mapId];
      return {
        ...mapData,
        // Ensure URLs are accessible
        downloadUrl: mapData.url || `/api/maps/files/permanent/${mapData.filename}`,
        previewUrl: mapData.previewUrl || `/api/maps/files/permanent/${mapData.filename}`,
        // Add checkout-specific formatting
        checkout: {
          title: `${mapData.userName || 'User'}'s ${mapData.size} ${mapData.orientation} Map`,
          description: `High-quality ${mapData.quality} print (${mapData.format?.toUpperCase() || 'PNG'})`,
          price: mapData.size === 'A3' ? 3999 : 2999, // Dynamic pricing: A3 = $39.99, others = $29.99
          image: mapData.url || `/api/maps/files/permanent/${mapData.filename}`
        }
      };
    });

    // Sort by creation date (newest first)
    mapsArray.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      success: true,
      maps: mapsArray,
      count: mapsArray.length,
      session: {
        userId: req.session.strava?.athlete?.id,
        userName: req.session.strava?.athlete?.firstname || 'User'
      }
    });

  } catch (error) {
    console.error('Error retrieving session maps:', error);
    res.status(500).json({
      error: 'Failed to retrieve session maps',
      message: 'Unable to get maps from session'
    });
  }
});

/**
 * Clear maps from session
 * Removes all or specific maps from user session
 */
router.delete('/session/:mapId?', requireAuth, async (req, res) => {
  try {
    const { mapId } = req.params;

    if (!req.session.maps) {
      req.session.maps = {};
    }

    if (mapId) {
      // Clear specific map
      if (req.session.maps[mapId]) {
        delete req.session.maps[mapId];
        res.json({
          success: true,
          message: `Map ${mapId} removed from session`
        });
      } else {
        res.status(404).json({
          error: 'Map not found',
          message: `Map ${mapId} not found in session`
        });
      }
    } else {
      // Clear all maps
      const count = Object.keys(req.session.maps).length;
      req.session.maps = {};
      res.json({
        success: true,
        message: `${count} maps cleared from session`
      });
    }

  } catch (error) {
    console.error('Error clearing session maps:', error);
    res.status(500).json({
      error: 'Failed to clear session maps',
      message: 'Unable to clear maps from session'
    });
  }
});

/**
 * Get map generation status
 */
router.get('/:mapId/status', requireAuth, async (req, res) => {
  try {
    const { mapId } = req.params;
    
    const metadataPath = path.join(appConfig.storage.generatedMapsDir, `${mapId}_metadata.json`);
    
    try {
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
      
      // Check if user owns this map
      if (metadata.userId !== req.session.strava.athlete.id) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You do not have access to this map'
        });
      }

      res.json({
        success: true,
        map: {
          id: metadata.id,
          status: metadata.status,
          format: metadata.format,
          createdAt: metadata.createdAt,
          completedAt: metadata.completedAt,
          downloadUrl: metadata.status === 'completed' ? `/api/maps/${mapId}/download` : null,
          previewUrl: `/api/maps/${mapId}/preview`
        }
      });

    } catch (fileError) {
      return res.status(404).json({
        error: 'Map not found',
        message: 'The requested map does not exist'
      });
    }

  } catch (error) {
    console.error('Error checking map status:', error);
    res.status(500).json({
      error: 'Failed to check status',
      message: 'Unable to check map generation status'
    });
  }
});

/**
 * Download generated map
 */
router.get('/:mapId/download', requireAuth, async (req, res) => {
  try {
    const { mapId } = req.params;
    
    const metadataPath = path.join(appConfig.storage.generatedMapsDir, `${mapId}_metadata.json`);
    
    try {
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
      
      // Check if user owns this map
      if (metadata.userId !== req.session.strava.athlete.id) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You do not have access to this map'
        });
      }

      if (metadata.status !== 'completed') {
        return res.status(400).json({
          error: 'Map not ready',
          message: 'Map generation is not yet complete'
        });
      }

      // Check if file exists
      try {
        await fs.access(metadata.filepath);
      } catch {
        return res.status(404).json({
          error: 'File not found',
          message: 'Generated map file no longer exists'
        });
      }

      // Set appropriate headers for download
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Disposition', `attachment; filename="${metadata.filename}"`);
      res.setHeader('Content-Length', (await fs.stat(metadata.filepath)).size);

      // Stream file to response
      const fileStream = require('fs').createReadStream(metadata.filepath);
      fileStream.pipe(res);

    } catch (fileError) {
      return res.status(404).json({
        error: 'Map not found',
        message: 'The requested map does not exist'
      });
    }

  } catch (error) {
    console.error('Error downloading map:', error);
    res.status(500).json({
      error: 'Download failed',
      message: 'Unable to download map'
    });
  }
});

/**
 * Get user's generated maps
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const { page = 1, per_page = 20 } = req.query;
    const userId = req.session.strava.athlete.id;

    // Get all metadata files for this user
    const files = await fs.readdir(appConfig.storage.generatedMapsDir);
    const metadataFiles = files.filter(file => file.endsWith('_metadata.json'));

    const userMaps = [];
    
    for (const file of metadataFiles) {
      try {
        const metadataPath = path.join(appConfig.storage.generatedMapsDir, file);
        const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
        
        if (metadata.userId === userId) {
          userMaps.push({
            id: metadata.id,
            activityId: metadata.activityId,
            title: metadata.title,
            format: metadata.format,
            status: metadata.status,
            createdAt: metadata.createdAt,
            completedAt: metadata.completedAt,
            downloadUrl: metadata.status === 'completed' ? `/api/maps/${metadata.id}/download` : null
          });
        }
      } catch (error) {
        // Skip invalid metadata files
        console.warn('Invalid metadata file:', file);
      }
    }

    // Sort by creation date (newest first)
    userMaps.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Paginate results
    const pageNum = Math.max(1, parseInt(page));
    const perPage = Math.min(100, Math.max(1, parseInt(per_page)));
    const startIndex = (pageNum - 1) * perPage;
    const endIndex = startIndex + perPage;
    
    const paginatedMaps = userMaps.slice(startIndex, endIndex);

    res.json({
      success: true,
      maps: paginatedMaps,
      pagination: {
        page: pageNum,
        per_page: perPage,
        total: userMaps.length,
        total_pages: Math.ceil(userMaps.length / perPage)
      }
    });

  } catch (error) {
    console.error('Error fetching user maps:', error);
    res.status(500).json({
      error: 'Failed to fetch maps',
      message: 'Unable to retrieve generated maps'
    });
  }
});

/**
 * Delete a generated map
 */
router.delete('/:mapId', requireAuth, async (req, res) => {
  try {
    const { mapId } = req.params;
    
    const metadataPath = path.join(appConfig.storage.generatedMapsDir, `${mapId}_metadata.json`);
    
    try {
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
      
      // Check if user owns this map
      if (metadata.userId !== req.session.strava.athlete.id) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You do not have access to this map'
        });
      }

      // Delete map file if it exists
      try {
        await fs.unlink(metadata.filepath);
      } catch (error) {
        // File might not exist, continue with metadata deletion
        console.warn('Map file not found during deletion:', metadata.filepath);
      }

      // Delete metadata file
      await fs.unlink(metadataPath);

      res.json({
        success: true,
        message: 'Map deleted successfully'
      });

    } catch (fileError) {
      return res.status(404).json({
        error: 'Map not found',
        message: 'The requested map does not exist'
      });
    }

  } catch (error) {
    console.error('Error deleting map:', error);
    res.status(500).json({
      error: 'Failed to delete map',
      message: 'Unable to delete map'
    });
  }
});

/**
 * Log map interaction events for analytics
 */
router.post('/events', requireAuth, async (req, res) => {
  try {
    const {
      eventType,
      eventData,
      userAgent,
      timestamp
    } = req.body;

    if (!eventType) {
      return res.status(400).json({
        error: 'Missing event type',
        message: 'eventType is required'
      });
    }

    // Get user and session information
    const userId = req.session.strava?.athlete?.id;
    const sessionId = req.sessionID;
    
    // Add request metadata
    const enhancedEventData = {
      ...eventData,
      userAgent: userAgent || req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
      timestamp: timestamp || new Date().toISOString(),
      path: req.path,
      referer: req.get('Referer')
    };

    // Log the event
    await mapEventService.logEvent(eventType, enhancedEventData, userId, sessionId);

    res.json({
      success: true,
      message: 'Event logged successfully'
    });

  } catch (error) {
    console.error('Error logging map event:', error);
    res.status(500).json({
      error: 'Failed to log event',
      message: 'Unable to log map interaction event'
    });
  }
});

/**
 * Get map analytics summary (admin only)
 */
router.get('/analytics', requireAuth, async (req, res) => {
  try {
    // In a real application, you'd check for admin permissions here
    // For now, we'll allow any authenticated user to see analytics
    
    const summary = mapEventService.getAnalyticsSummary();
    
    res.json({
      success: true,
      analytics: summary
    });

  } catch (error) {
    console.error('Error retrieving map analytics:', error);
    res.status(500).json({
      error: 'Failed to retrieve analytics',
      message: 'Unable to retrieve map analytics'
    });
  }
});

/**
 * Get detailed usage report (admin only)
 */
router.get('/analytics/report', requireAuth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const report = mapEventService.generateUsageReport(startDate, endDate);
    
    res.json({
      success: true,
      report: report
    });

  } catch (error) {
    console.error('Error generating usage report:', error);
    res.status(500).json({
      error: 'Failed to generate report',
      message: 'Unable to generate usage report'
    });
  }
});

/**
 * Get map event service status
 */
router.get('/events/status', requireAuth, async (req, res) => {
  try {
    const status = mapEventService.getStatus();
    
    res.json({
      success: true,
      status: status
    });

  } catch (error) {
    console.error('Error getting event service status:', error);
    res.status(500).json({
      error: 'Failed to get status',
      message: 'Unable to get event service status'
    });
  }
});

/**
 * Enhanced File Serving Endpoints
 * Uses new file storage service with validation, caching, and streaming
 */

/**
 * Serve files from different storage types with streaming support
 * GET /api/maps/files/:type/:filename
 */
router.get('/files/:type/:filename', 
  FileValidationMiddleware.validateFileAccess({ requireAuth: true }),
  FileValidationMiddleware.validateFileIntegrity(),
  FileValidationMiddleware.rateLimit({ maxRequests: 200, windowMs: 15 * 60 * 1000 }),
  FileValidationMiddleware.setCacheHeaders(),
  FileValidationMiddleware.handleConditionalRequests(),
  FileValidationMiddleware.setSecurityHeaders(),
  FileValidationMiddleware.logFileAccess(),
  (req, res) => {
    try {
      const { filePath, parsed, metadata } = req.fileInfo;

      // Set content length if available
      if (metadata?.size) {
        res.set('Content-Length', metadata.size.toString());
      }

      // Handle range requests for streaming
      const range = req.get('Range');
      if (range) {
        const stat = fsSync.statSync(filePath);
        const fileSize = stat.size;
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;

        res.status(206);
        res.set({
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize.toString()
        });

        const stream = fsSync.createReadStream(filePath, { start, end });
        
        // Handle stream errors
        stream.on('error', (error) => {
          FileErrorHandler.logError(error, { operation: 'streamFile', filePath });
          const httpResponse = FileErrorHandler.toHttpResponse(
            FileErrorHandler.handleSystemError(error, { operation: 'streamFile', filePath })
          );
          res.status(httpResponse.status).json(httpResponse.body);
        });
        
        stream.pipe(res);
      } else {
        // Regular file serving
        const stream = fsSync.createReadStream(filePath);
        
        // Handle stream errors
        stream.on('error', (error) => {
          FileErrorHandler.logError(error, { operation: 'streamFile', filePath });
          const httpResponse = FileErrorHandler.toHttpResponse(
            FileErrorHandler.handleSystemError(error, { operation: 'streamFile', filePath })
          );
          res.status(httpResponse.status).json(httpResponse.body);
        });
        
        stream.pipe(res);
      }

    } catch (error) {
      FileErrorHandler.logError(error, { operation: 'serveFile', fileInfo: req.fileInfo });
      const httpResponse = FileErrorHandler.toHttpResponse(error);
      res.status(httpResponse.status).json(httpResponse.body);
    }
  }
);

/**
 * Get file metadata
 * GET /api/maps/files/:type/:filename/info
 */
router.get('/files/:type/:filename/info',
  FileValidationMiddleware.validateFileAccess({ requireAuth: true }),
  async (req, res) => {
    try {
      const { filename, type, metadata } = req.fileInfo;

      res.json({
        success: true,
        file: {
          filename,
          type,
          ...metadata,
          downloadUrl: `/api/maps/files/${type}/${filename}`,
          previewUrl: metadata.type === 'map' ? `/api/maps/files/temporary/${FileNaming.getPreviewFilename(filename)}` : null
        }
      });

    } catch (error) {
      console.error('Error getting file info:', error);
      res.status(500).json({
        error: 'Failed to get file info',
        message: 'Unable to retrieve file information'
      });
    }
  }
);

/**
 * Generate thumbnail for a map file
 * POST /api/maps/files/:type/:filename/thumbnail
 */
router.post('/files/:type/:filename/thumbnail',
  FileValidationMiddleware.validateFileAccess({ requireAuth: true }),
  async (req, res) => {
    try {
      const { filename, type, userId } = req.fileInfo;
      const { width = 150, height = 150 } = req.body;

      // Check if thumbnail already exists
      const thumbnailFilename = FileNaming.getThumbnailFilename(filename);
      const thumbnailPath = path.join(fileStorageService.directories.temporary, thumbnailFilename);

      if (fsSync.existsSync(thumbnailPath)) {
        return res.json({
          success: true,
          thumbnailUrl: `/api/maps/files/temporary/${thumbnailFilename}`,
          cached: true
        });
      }

      // Generate thumbnail (simplified - in production would use image processing library)
      // For now, return the original image URL as thumbnail
      res.json({
        success: true,
        thumbnailUrl: `/api/maps/files/${type}/${filename}`,
        message: 'Thumbnail generation not yet implemented, returning original'
      });

    } catch (error) {
      console.error('Error generating thumbnail:', error);
      res.status(500).json({
        error: 'Thumbnail generation failed',
        message: 'Unable to generate thumbnail'
      });
    }
  }
);

/**
 * List files in storage with enhanced filtering
 * GET /api/maps/storage/:type
 */
router.get('/storage/:type', requireAuth, async (req, res) => {
  try {
    const { type } = req.params;
    const { 
      userId, 
      format, 
      limit = 20, 
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Use current user ID if not specified
    const filterUserId = userId || req.session.strava.athlete.id.toString();

    const result = await fileStorageService.listFiles(type, {
      userId: filterUserId,
      format,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Sort results
    if (sortBy && result.files) {
      result.files.sort((a, b) => {
        const aVal = a[sortBy];
        const bVal = b[sortBy];
        
        if (sortOrder === 'desc') {
          return bVal > aVal ? 1 : -1;
        } else {
          return aVal > bVal ? 1 : -1;
        }
      });
    }

    res.json({
      success: true,
      storage: {
        type,
        ...result,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: result.total
        }
      }
    });

  } catch (error) {
    console.error('Error listing storage files:', error);
    res.status(500).json({
      error: 'Failed to list files',
      message: 'Unable to list storage files'
    });
  }
});

/**
 * Get storage statistics
 * GET /api/maps/storage-stats
 */
router.get('/storage-stats', requireAuth, async (req, res) => {
  try {
    const stats = await fileStorageService.getStorageStats();
    
    res.json({
      success: true,
      stats: stats
    });

  } catch (error) {
    console.error('Error getting storage stats:', error);
    res.status(500).json({
      error: 'Failed to get storage stats',
      message: 'Unable to retrieve storage statistics'
    });
  }
});

/**
 * Move file between storage types
 * POST /api/maps/files/:type/:filename/move
 */
router.post('/files/:type/:filename/move',
  FileValidationMiddleware.validateFileAccess({ requireAuth: true }),
  async (req, res) => {
    try {
      const { filename, type } = req.fileInfo;
      const { toType } = req.body;

      if (!toType) {
        return res.status(400).json({
          error: 'Missing destination type',
          message: 'toType parameter is required'
        });
      }

      if (!fileStorageService.directories[toType]) {
        return res.status(400).json({
          error: 'Invalid destination type',
          message: `Unknown storage type: ${toType}`
        });
      }

      const result = await fileStorageService.moveFile(filename, type, toType);

      res.json({
        success: true,
        message: `File moved from ${type} to ${toType}`,
        file: result
      });

    } catch (error) {
      console.error('Error moving file:', error);
      res.status(500).json({
        error: 'Failed to move file',
        message: 'Unable to move file between storage types'
      });
    }
  }
);

/**
 * Delete file from storage
 * DELETE /api/maps/files/:type/:filename
 */
router.delete('/files/:type/:filename',
  FileValidationMiddleware.validateFileAccess({ requireAuth: true }),
  async (req, res) => {
    try {
      const { filename, type } = req.fileInfo;

      await fileStorageService.deleteFile(filename, type);

      res.json({
        success: true,
        message: 'File deleted successfully'
      });

    } catch (error) {
      console.error('Error deleting file:', error);
      res.status(500).json({
        error: 'Failed to delete file',
        message: 'Unable to delete the requested file'
      });
    }
  }
);

/**
 * File System Management and Monitoring Endpoints
 */

/**
 * Get file system monitoring metrics
 * GET /api/maps/monitoring/metrics
 */
router.get('/monitoring/metrics', requireAuth, async (req, res) => {
  try {
    const metrics = fileMonitoringService.getMetrics();
    
    res.json({
      success: true,
      metrics: metrics
    });

  } catch (error) {
    console.error('Error getting monitoring metrics:', error);
    res.status(500).json({
      error: 'Failed to get monitoring metrics',
      message: 'Unable to retrieve system monitoring data'
    });
  }
});

/**
 * Get performance report
 * GET /api/maps/monitoring/performance?timeRange=24h
 */
router.get('/monitoring/performance', requireAuth, async (req, res) => {
  try {
    const { timeRange = '24h' } = req.query;
    const report = fileMonitoringService.getPerformanceReport(timeRange);
    
    res.json({
      success: true,
      report: report
    });

  } catch (error) {
    console.error('Error getting performance report:', error);
    res.status(500).json({
      error: 'Failed to get performance report',
      message: 'Unable to generate performance report'
    });
  }
});

/**
 * Run manual cleanup
 * POST /api/maps/maintenance/cleanup
 */
router.post('/maintenance/cleanup', requireAuth, async (req, res) => {
  try {
    const { types, dryRun = false } = req.body;
    
    const cleanupOptions = {
      types: types ? types.split(',') : undefined,
      dryRun: dryRun
    };
    
    const results = await fileCleanupService.runCleanup(cleanupOptions);
    
    res.json({
      success: true,
      message: dryRun ? 'Cleanup simulation completed' : 'Cleanup completed successfully',
      results: results
    });

  } catch (error) {
    console.error('Error running cleanup:', error);
    res.status(500).json({
      error: 'Failed to run cleanup',
      message: 'Unable to execute file cleanup'
    });
  }
});

/**
 * Get cleanup statistics and configuration
 * GET /api/maps/maintenance/cleanup-stats
 */
router.get('/maintenance/cleanup-stats', requireAuth, async (req, res) => {
  try {
    const stats = await fileCleanupService.getCleanupStats();
    
    res.json({
      success: true,
      stats: stats
    });

  } catch (error) {
    console.error('Error getting cleanup stats:', error);
    res.status(500).json({
      error: 'Failed to get cleanup stats',
      message: 'Unable to retrieve cleanup statistics'
    });
  }
});

/**
 * Compress files in a storage type
 * POST /api/maps/maintenance/compress
 */
router.post('/maintenance/compress', requireAuth, async (req, res) => {
  try {
    const { storageType = 'temporary', compressionLevel = 6 } = req.body;
    
    if (!fileStorageService.directories[storageType]) {
      return res.status(400).json({
        error: 'Invalid storage type',
        message: `Unknown storage type: ${storageType}`
      });
    }

    const directoryPath = fileStorageService.directories[storageType];
    const files = await fs.readdir(directoryPath);
    const mapFiles = files.filter(file => file.endsWith('.png') || file.endsWith('.jpg'));
    
    const filePaths = mapFiles.map(file => path.join(directoryPath, file));
    
    const results = await FileCompressionUtils.batchCompress(filePaths, {
      compressionLevel,
      concurrency: 2
    });
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    res.json({
      success: true,
      message: `Compression completed: ${successful.length} files compressed, ${failed.length} skipped`,
      results: {
        successful: successful.length,
        failed: failed.length,
        totalSpaceSaved: successful.reduce((sum, r) => sum + (r.spaceSaved || 0), 0),
        details: results
      }
    });

  } catch (error) {
    console.error('Error compressing files:', error);
    res.status(500).json({
      error: 'Failed to compress files',
      message: 'Unable to execute file compression'
    });
  }
});

/**
 * Get compression statistics for storage
 * GET /api/maps/maintenance/compression-stats/:storageType
 */
router.get('/maintenance/compression-stats/:storageType', requireAuth, async (req, res) => {
  try {
    const { storageType } = req.params;
    
    if (!fileStorageService.directories[storageType]) {
      return res.status(400).json({
        error: 'Invalid storage type',
        message: `Unknown storage type: ${storageType}`
      });
    }

    const directoryPath = fileStorageService.directories[storageType];
    const stats = await FileCompressionUtils.getDirectoryCompressionStats(directoryPath);
    
    res.json({
      success: true,
      stats: stats
    });

  } catch (error) {
    console.error('Error getting compression stats:', error);
    res.status(500).json({
      error: 'Failed to get compression stats',
      message: 'Unable to retrieve compression statistics'
    });
  }
});

/**
 * System health check with detailed file system status
 * GET /api/maps/system/health
 */
router.get('/system/health', requireAuth, async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        fileStorage: fileStorageService.getStatus(),
        monitoring: {
          isMonitoring: fileMonitoringService.isMonitoring,
          metrics: fileMonitoringService.getMetrics().summary
        },
        cleanup: await fileCleanupService.getCleanupStats()
      },
      storage: await fileStorageService.getStorageStats(),
      alerts: await fileMonitoringService.checkStorageAlerts()
    };

    // Determine overall health status
    const hasAlerts = health.alerts.some(alert => alert.severity === 'critical');
    const storageUsage = health.storage.total.size / (1073741824); // Convert to GB for comparison
    
    if (hasAlerts || storageUsage > 0.9) {
      health.status = 'degraded';
    }

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json({
      success: true,
      health: health
    });

  } catch (error) {
    console.error('Error getting system health:', error);
    res.status(503).json({
      success: false,
      health: {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      }
    });
  }
});

/**
 * Print Size Configuration Endpoints
 * Provides comprehensive print size information for the frontend
 */

/**
 * Get all available print sizes for selection UI
 * GET /api/maps/print-sizes
 */
router.get('/print-sizes', requireAuth, async (req, res) => {
  try {
    const mapService = require('../services/mapService');
    
    // Get all available print sizes
    const availableSizes = mapService.getAvailablePrintSizes();
    
    // Get comparison data for UI
    const comparison = mapService.getPrintSizeComparison();
    
    res.json({
      success: true,
      printSizes: {
        available: availableSizes,
        comparison: comparison,
        defaultSize: 'A4',
        defaultOrientation: 'portrait'
      },
      metadata: {
        dpi: 300,
        qualityDescription: 'Professional print quality',
        supportedOrientations: ['portrait', 'landscape'],
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error getting print sizes:', error);
    res.status(500).json({
      error: 'Failed to get print sizes',
      message: 'Unable to retrieve print size configuration'
    });
  }
});

/**
 * Get specific print size dimensions
 * GET /api/maps/print-sizes/:format/:orientation?
 */
router.get('/print-sizes/:format/:orientation?', requireAuth, async (req, res) => {
  try {
    const { format, orientation = 'portrait' } = req.params;
    const mapService = require('../services/mapService');
    
    // Validate format
    if (!['A3', 'A4'].includes(format.toUpperCase())) {
      return res.status(400).json({
        error: 'Invalid format',
        message: 'Only A3 and A4 formats are currently available',
        availableFormats: ['A3', 'A4']
      });
    }
    
    // Validate orientation
    if (!['portrait', 'landscape'].includes(orientation.toLowerCase())) {
      return res.status(400).json({
        error: 'Invalid orientation',
        message: 'Orientation must be portrait or landscape',
        availableOrientations: ['portrait', 'landscape']
      });
    }
    
    // Get dimensions for specified format and orientation
    const dimensions = mapService.getPrintDimensions(format, orientation);
    
    res.json({
      success: true,
      printSize: dimensions,
      alternativeOrientations: {
        portrait: format.toUpperCase() === dimensions.format ? 
          mapService.getPrintDimensions(format, 'portrait') : null,
        landscape: format.toUpperCase() === dimensions.format ? 
          mapService.getPrintDimensions(format, 'landscape') : null
      }
    });

  } catch (error) {
    console.error('Error getting print size dimensions:', error);
    
    if (error.message.includes('Unsupported format') || error.message.includes('Unsupported orientation')) {
      return res.status(400).json({
        error: 'Invalid parameters',
        message: error.message
      });
    }
    
    res.status(500).json({
      error: 'Failed to get print dimensions',
      message: 'Unable to retrieve print size dimensions'
    });
  }
});

/**
 * Get print size recommendations based on map content
 * POST /api/maps/print-size-recommendations
 */
router.post('/print-size-recommendations', requireAuth, async (req, res) => {
  try {
    const { 
      mapBounds, 
      intendedUse = 'general',
      currentSize,
      currentOrientation
    } = req.body;
    
    // Validate required parameters
    if (!mapBounds || !mapBounds.north || !mapBounds.south || !mapBounds.east || !mapBounds.west) {
      return res.status(400).json({
        error: 'Invalid map bounds',
        message: 'Map bounds must include north, south, east, and west coordinates'
      });
    }
    
    const mapService = require('../services/mapService');
    
    // Get recommendations
    const recommendations = mapService.getRecommendedPrintSize(mapBounds, intendedUse);
    
    // Calculate current selection score if provided
    let currentSelectionInfo = null;
    if (currentSize && currentOrientation) {
      try {
        const currentDimensions = mapService.getPrintDimensions(currentSize, currentOrientation);
        const currentRec = recommendations.find(r => 
          r.format === currentSize.toUpperCase() && r.orientation === currentOrientation.toLowerCase()
        );
        
        currentSelectionInfo = {
          ...currentDimensions,
          score: currentRec ? currentRec.score : 0,
          reasons: currentRec ? currentRec.reasons : ['Current selection'],
          rank: recommendations.findIndex(r => 
            r.format === currentSize.toUpperCase() && r.orientation === currentOrientation.toLowerCase()
          ) + 1
        };
      } catch (error) {
        console.warn('Could not analyze current selection:', error.message);
      }
    }
    
    // Calculate content analysis
    const boundsWidth = Math.abs(mapBounds.east - mapBounds.west);
    const boundsHeight = Math.abs(mapBounds.north - mapBounds.south);
    const contentAspectRatio = boundsWidth / boundsHeight;
    
    res.json({
      success: true,
      recommendations: recommendations,
      currentSelection: currentSelectionInfo,
      contentAnalysis: {
        aspectRatio: Math.round(contentAspectRatio * 1000) / 1000,
        isWide: contentAspectRatio > 1.2,
        isTall: contentAspectRatio < 0.8,
        isSquarish: contentAspectRatio >= 0.8 && contentAspectRatio <= 1.2,
        boundsSize: {
          width: boundsWidth,
          height: boundsHeight
        }
      },
      intendedUse: intendedUse
    });

  } catch (error) {
    console.error('Error getting print size recommendations:', error);
    res.status(500).json({
      error: 'Failed to get recommendations',
      message: 'Unable to generate print size recommendations'
    });
  }
});

/**
 * Validate print configuration for export
 * POST /api/maps/validate-print-config
 */
router.post('/validate-print-config', requireAuth, async (req, res) => {
  try {
    const { 
      format, 
      orientation, 
      mapBounds,
      quality = 'print',
      deviceCapabilities = {}
    } = req.body;
    
    // Validate required parameters
    if (!format || !orientation) {
      return res.status(400).json({
        error: 'Missing parameters',
        message: 'Format and orientation are required'
      });
    }
    
    if (!mapBounds) {
      return res.status(400).json({
        error: 'Missing map bounds',
        message: 'Map bounds are required for validation'
      });
    }
    
    const mapService = require('../services/mapService');
    const dpiManager = require('../services/mapService'); // We'll need to import actual DPI manager
    
    try {
      // Get print dimensions
      const printDimensions = mapService.getPrintDimensions(format, orientation);
      
      // Calculate memory requirements
      const memoryRequirements = mapService.calculateMemoryRequirements(
        printDimensions.width, 
        printDimensions.height, 
        printDimensions.dpi
      );
      
      // Determine if configuration is valid
      const warnings = [];
      const errors = [];
      
      // Memory validation
      if (memoryRequirements.estimatedMB > 200) {
        warnings.push({
          type: 'memory',
          message: `High memory usage expected: ${memoryRequirements.estimatedMB}MB`,
          recommendation: 'Consider using progressive rendering or reducing quality'
        });
      }
      
      if (memoryRequirements.estimatedMB > 500) {
        warnings.push({
          type: 'memory',
          severity: 'high',
          message: `Very high memory usage: ${memoryRequirements.estimatedMB}MB`,
          recommendation: 'This may cause performance issues or failures on some devices'
        });
      }
      
      // Device capability validation
      if (deviceCapabilities.deviceMemory && deviceCapabilities.deviceMemory < 4 && memoryRequirements.estimatedMB > 150) {
        warnings.push({
          type: 'device',
          message: 'Your device has limited memory. Large exports may be slow or fail.',
          recommendation: 'Consider using A4 size or draft quality'
        });
      }
      
      // Content aspect ratio validation
      if (mapBounds) {
        const boundsWidth = Math.abs(mapBounds.east - mapBounds.west);
        const boundsHeight = Math.abs(mapBounds.north - mapBounds.south);
        const contentAspectRatio = boundsWidth / boundsHeight;
        const printAspectRatio = printDimensions.aspectRatio;
        
        const aspectRatioDiff = Math.abs(contentAspectRatio - printAspectRatio);
        if (aspectRatioDiff > 0.5) {
          warnings.push({
            type: 'aspect-ratio',
            message: 'Map content may not fit well in selected print size',
            recommendation: `Consider ${contentAspectRatio > printAspectRatio ? 'landscape' : 'portrait'} orientation`,
            details: {
              contentAspectRatio: Math.round(contentAspectRatio * 100) / 100,
              printAspectRatio: Math.round(printAspectRatio * 100) / 100
            }
          });
        }
      }
      
      const isValid = errors.length === 0;
      
      res.json({
        success: true,
        valid: isValid,
        printConfiguration: {
          format: printDimensions.format,
          orientation: printDimensions.orientation,
          dimensions: {
            pixels: { width: printDimensions.width, height: printDimensions.height },
            inches: { width: printDimensions.widthInches, height: printDimensions.heightInches },
            physical: printDimensions.physicalSize
          },
          dpi: printDimensions.dpi,
          pricing: printDimensions.pricing,
          memoryEstimate: memoryRequirements.estimatedMB
        },
        warnings: warnings,
        errors: errors,
        recommendations: warnings.length > 0 ? [
          'Test print preview before final export',
          'Ensure stable internet connection for large exports',
          'Close other applications to free up memory'
        ] : []
      });
      
    } catch (dimensionError) {
      return res.status(400).json({
        error: 'Invalid print configuration',
        message: dimensionError.message
      });
    }

  } catch (error) {
    console.error('Error validating print configuration:', error);
    res.status(500).json({
      error: 'Validation failed',
      message: 'Unable to validate print configuration'
    });
  }
});

/**
 * Handle OPTIONS requests for preview images (CORS preflight)
 */
router.options('/preview-image/:previewId', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.status(200).end();
});

/**
 * Serve preview images
 */
router.get('/preview-image/:previewId', requireAuth, async (req, res) => {
  try {
    const { previewId } = req.params;
    
    if (!req.session.mapPreviews?.[previewId]) {
      return res.status(404).json({
        error: 'Preview not found',
        message: 'Preview ID not found in session'
      });
    }

    const preview = req.session.mapPreviews[previewId];
    const filePath = preview.filePath;

    // Check if file exists
    if (!fsSync.existsSync(filePath)) {
      return res.status(404).json({
        error: 'Preview file not found',
        message: 'Preview image file no longer exists'
      });
    }

    // Set appropriate headers for image serving
    res.setHeader('Content-Type', 'image/jpeg'); // Changed to JPEG since we generate JPEG files
    res.setHeader('Cache-Control', 'private, max-age=3600'); // Cache for 1 hour
    res.setHeader('Last-Modified', new Date(preview.createdAt).toUTCString());
    
    // Add CORS headers for cross-domain requests
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    // Stream the image file
    const imageStream = fsSync.createReadStream(filePath);
    imageStream.pipe(res);

  } catch (error) {
    console.error('Error serving preview image:', error);
    res.status(500).json({
      error: 'Failed to serve preview image',
      message: error.message
    });
  }
});

/**
 * Approve a preview for purchase
 */
router.post('/approve-preview/:previewId', requireAuth, async (req, res) => {
  try {
    const { previewId } = req.params;
    
    if (!req.session.mapPreviews?.[previewId]) {
      return res.status(404).json({
        error: 'Preview not found',
        message: 'Preview ID not found in session'
      });
    }

    // Mark preview as approved
    req.session.mapPreviews[previewId].approved = true;
    req.session.mapPreviews[previewId].approvedAt = new Date().toISOString();

    // Store approved preview data for purchase flow
    if (!req.session.approvedMaps) {
      req.session.approvedMaps = {};
    }
    
    req.session.approvedMaps[previewId] = {
      ...req.session.mapPreviews[previewId],
      readyForPurchase: true
    };

    res.json({
      success: true,
      message: 'Preview approved successfully',
      previewId: previewId,
      approvedAt: req.session.mapPreviews[previewId].approvedAt
    });

  } catch (error) {
    console.error('Error approving preview:', error);
    res.status(500).json({
      error: 'Failed to approve preview',
      message: error.message
    });
  }
});

/**
 * Get all previews for current session
 */
router.get('/previews', requireAuth, async (req, res) => {
  try {
    const previews = req.session.mapPreviews || {};
    
    // Return preview metadata without file paths
    const previewData = Object.keys(previews).map(previewId => ({
      id: previewId,
      config: previews[previewId].config,
      createdAt: previews[previewId].createdAt,
      approved: previews[previewId].approved,
      approvedAt: previews[previewId].approvedAt,
      url: `/api/maps/preview-image/${previewId}`,
      activityId: previews[previewId].activityId
    }));

    res.json({
      success: true,
      previews: previewData,
      total: previewData.length
    });

  } catch (error) {
    console.error('Error fetching previews:', error);
    res.status(500).json({
      error: 'Failed to fetch previews',
      message: error.message
    });
  }
});

/**
 * Delete a preview
 */
router.delete('/preview/:previewId', requireAuth, async (req, res) => {
  try {
    const { previewId } = req.params;
    
    if (!req.session.mapPreviews?.[previewId]) {
      return res.status(404).json({
        error: 'Preview not found',
        message: 'Preview ID not found in session'
      });
    }

    const preview = req.session.mapPreviews[previewId];
    
    // Delete the file if it exists
    try {
      if (fsSync.existsSync(preview.filePath)) {
        await fs.unlink(preview.filePath);
      }
    } catch (fileError) {
      console.warn('Warning: Could not delete preview file:', fileError.message);
    }

    // Remove from session
    delete req.session.mapPreviews[previewId];
    
    // Also remove from approved maps if present
    if (req.session.approvedMaps?.[previewId]) {
      delete req.session.approvedMaps[previewId];
    }

    res.json({
      success: true,
      message: 'Preview deleted successfully',
      previewId: previewId
    });

  } catch (error) {
    console.error('Error deleting preview:', error);
    res.status(500).json({
      error: 'Failed to delete preview',
      message: error.message
    });
  }
});

/**
 * Confirm map for high-resolution generation
 * Triggers background generation process without blocking user
 */
router.post('/confirm/:previewId', requireAuth, validateMapSession, saveSessionForRecovery, async (req, res) => {
  try {
    const { previewId } = req.params;
    const { printSize = 'A4', printOrientation = 'portrait' } = req.body;
    
    // COMPREHENSIVE SESSION DEBUGGING
    console.log('=== CONFIRM ROUTE SESSION DEBUG ===');
    console.log('Session ID:', req.sessionID);
    console.log('Session exists:', !!req.session);
    console.log('Session cookie:', req.headers.cookie);
    console.log('Request origin:', req.headers.origin);
    console.log('Request referer:', req.headers.referer);
    console.log('Preview ID requested:', previewId);
    console.log('Session mapPreviews exists:', !!req.session?.mapPreviews);
    console.log('Session mapPreviews keys:', req.session?.mapPreviews ? Object.keys(req.session.mapPreviews) : 'none');
    console.log('Full session data:', JSON.stringify(req.session, null, 2));
    console.log('================================');
    
    // Validate preview exists and is approved
    let preview = req.session.mapPreviews?.[previewId];
    let previewSource = 'session';

    // If not found in session, check cross-domain token store
    if (!preview) {
      const crossDomainToken = req.query.token || req.headers['x-session-token'];
      if (crossDomainToken) {
        const crossDomainTokenStore = require('../services/crossDomainTokenStore');
        preview = crossDomainTokenStore.getMapPreview(crossDomainToken, previewId);
        if (preview) {
          previewSource = 'cross-domain-token';
          console.log('Preview found in cross-domain token store:', {
            previewId,
            token: crossDomainToken.substring(0, 8) + '...'
          });
          
          // Sync preview data to current session for consistency
          if (!req.session.mapPreviews) {
            req.session.mapPreviews = {};
          }
          req.session.mapPreviews[previewId] = preview;
        }
      }
    }

    if (!preview) {
      console.log('Preview not found in storage - attempting reconstruction...');
      
      // Extract activity data from request body for reconstruction
      const { 
        activityId, 
        activityData, 
        mapConfiguration,
        polyline,
        coordinates,
        style = 'streets-v12',
        lineColor = '#ff4444',
        lineWidth = 3,
        showStartEnd = true
      } = req.body;

      // Try to reconstruct preview data from available information
      if (activityId || activityData || polyline || coordinates) {
        console.log('Reconstructing preview data from request data...');
        
        // Create reconstructed preview data
        const reconstructedPreview = {
          id: previewId,
          config: {
            // Basic map configuration
            style: style,
            center: coordinates ? coordinates[Math.floor(coordinates.length / 2)] : [0, 0],
            zoom: 12,
            width: 800,
            height: 600,
            route: {
              coordinates: coordinates || [],
              polyline: polyline || '',
              color: lineColor,
              width: lineWidth
            },
            markers: showStartEnd && coordinates ? {
              start: coordinates[0],
              end: coordinates[coordinates.length - 1]
            } : null
          },
          filePath: null, // No file for reconstructed preview
          createdAt: new Date().toISOString(),
          approved: true, // Auto-approve reconstructed previews
          activityId: activityId || 'reconstructed',
          activityName: activityData?.name || `Reconstructed Activity`,
          mapConfiguration: mapConfiguration || {
            style,
            format: req.body.printSize || 'A4',
            orientation: req.body.printOrientation || 'portrait',
            showStartEnd,
            lineColor,
            lineWidth
          },
          reconstructed: true // Flag to indicate this was reconstructed
        };

        // Store reconstructed preview in session
        if (!req.session.mapPreviews) {
          req.session.mapPreviews = {};
        }
        req.session.mapPreviews[previewId] = reconstructedPreview;

        // Also store in cross-domain token store
        const crossDomainToken = req.query.token || req.headers['x-session-token'];
        if (crossDomainToken) {
          const crossDomainTokenStore = require('../services/crossDomainTokenStore');
          crossDomainTokenStore.storeMapPreview(crossDomainToken, previewId, reconstructedPreview);
        }

        preview = reconstructedPreview;
        console.log('Preview successfully reconstructed:', {
          previewId,
          hasActivityId: !!activityId,
          hasCoordinates: !!(coordinates && coordinates.length > 0),
          hasPolyline: !!polyline
        });
      } else {
        // Fallback: Create minimal preview for confirmation without specific activity data
        console.log('No activity data provided - creating minimal fallback preview...');
        
        // Create minimal fallback preview that allows confirmation to proceed
        const fallbackPreview = {
          id: previewId,
          config: {
            style: 'streets-v12',
            center: [0, 0], // Default center
            zoom: 12,
            width: 800,
            height: 600,
            route: {
              coordinates: [],
              polyline: '',
              color: '#ff4444',
              width: 3
            },
            markers: null
          },
          filePath: null,
          createdAt: new Date().toISOString(),
          approved: true, // Auto-approve fallback previews
          activityId: 'fallback',
          activityName: 'Fallback Preview',
          mapConfiguration: {
            style: 'streets-v12',
            format: req.body.printSize || 'A4',
            orientation: req.body.printOrientation || 'portrait',
            showStartEnd: true,
            lineColor: '#ff4444',
            lineWidth: 3
          },
          reconstructed: true,
          fallback: true // Flag to indicate this is a fallback preview
        };

        // Store fallback preview in session
        if (!req.session.mapPreviews) {
          req.session.mapPreviews = {};
        }
        req.session.mapPreviews[previewId] = fallbackPreview;

        // Also store in cross-domain token store
        const crossDomainToken = req.query.token || req.headers['x-session-token'];
        if (crossDomainToken) {
          const crossDomainTokenStore = require('../services/crossDomainTokenStore');
          crossDomainTokenStore.storeMapPreview(crossDomainToken, previewId, fallbackPreview);
        }

        preview = fallbackPreview;
        console.log('Fallback preview created for confirmation:', {
          previewId,
          fallback: true,
          requestBodyKeys: Object.keys(req.body)
        });
      }
    }

    console.log('Preview found via:', previewSource);
    
    if (!preview.approved) {
      return res.status(400).json({
        error: 'Preview not approved',
        message: 'Preview must be approved before confirmation'
      });
    }

    // Generate unique purchase ID for this confirmation
    const purchaseId = `purchase_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log('[Map Confirmation] Starting background generation:', {
      previewId,
      purchaseId,
      printSize,
      printOrientation
    });

    // Prepare complete map configuration for background generation
    const dimensions = {
      A4: {
        portrait: { width: 2480, height: 3508 },
        landscape: { width: 3508, height: 2480 }
      },
      A3: {
        portrait: { width: 3508, height: 4961 },
        landscape: { width: 4961, height: 3508 }
      }
    };

    const selectedDimensions = dimensions[printSize]?.[printOrientation] || dimensions.A4.portrait;

    const highResConfig = {
      id: `highres_${purchaseId}`,
      width: selectedDimensions.width,
      height: selectedDimensions.height,
      format: printSize.toLowerCase(),
      orientation: printOrientation,
      dpi: 300, // High resolution for print
      style: preview.config.style,
      center: preview.config.center,
      bounds: preview.config.bounds,
      route: {
        coordinates: preview.config.route.coordinates,
        color: preview.config.route.color || '#fc5200',
        width: preview.config.route.width || 4
      },
      markers: preview.config.markers,
      title: preview.config.title || `Strava Activity Map - ${preview.activityId}`,
      activityId: preview.activityId,
      customization: preview.config.customization || {},
      selfContained: true
    };

    // Validate route coordinates exist
    if (!highResConfig.route.coordinates || highResConfig.route.coordinates.length === 0) {
      return res.status(400).json({
        error: 'Missing route data',
        message: 'Preview does not contain valid route coordinates for high-resolution generation'
      });
    }

    // Create background job for high-resolution generation
    const backgroundJobManager = require('../services/backgroundJobManager');
    const job = await backgroundJobManager.createJob({
      purchaseId: purchaseId,
      previewId: previewId,
      mapConfig: highResConfig,
      printSize: printSize,
      orientation: printOrientation
    });

    // Store confirmation data in session for purchase flow
    if (!req.session.confirmedMaps) {
      req.session.confirmedMaps = {};
    }

    req.session.confirmedMaps[purchaseId] = {
      id: purchaseId,
      previewId: previewId,
      jobId: job.id,
      printSize: printSize,
      orientation: printOrientation,
      confirmedAt: new Date().toISOString(),
      status: 'generating', // generating, completed, failed
      highResConfig: highResConfig
    };

    console.log('[Map Confirmation] Background generation started:', {
      purchaseId,
      jobId: job.id,
      routeCoordinatesCount: highResConfig.route.coordinates.length
    });

    // Return immediately - don't wait for generation
    res.json({
      success: true,
      message: 'Map confirmation successful - high-resolution generation started',
      purchaseId: purchaseId,
      jobId: job.id,
      printSize: printSize,
      orientation: printOrientation,
      estimatedCompletionTime: '2-5 minutes',
      status: 'generating'
    });

  } catch (error) {
    console.error('[Map Confirmation] Error:', error);
    res.status(500).json({
      error: 'Map confirmation failed',
      message: error.message
    });
  }
});

/**
 * Purchase endpoint - prepares approved map for Shopify checkout
 */
router.post('/purchase/:purchaseId', requireAuth, validatePurchaseSession, saveSessionForRecovery, async (req, res) => {
  try {
    const { purchaseId } = req.params;
    const { 
      quantity = 1,
      shippingAddress = null
    } = req.body;

    // COMPREHENSIVE SESSION DEBUGGING
    console.log('=== PURCHASE ROUTE SESSION DEBUG ===');
    console.log('Session ID:', req.sessionID);
    console.log('Session exists:', !!req.session);
    console.log('Session cookie:', req.headers.cookie);
    console.log('Request origin:', req.headers.origin);
    console.log('Request referer:', req.headers.referer);
    console.log('Purchase ID requested:', purchaseId);
    console.log('Session confirmedMaps exists:', !!req.session?.confirmedMaps);
    console.log('Session confirmedMaps keys:', req.session?.confirmedMaps ? Object.keys(req.session.confirmedMaps) : 'none');
    console.log('Session mapPreviews exists:', !!req.session?.mapPreviews);
    console.log('Session mapPreviews keys:', req.session?.mapPreviews ? Object.keys(req.session.mapPreviews) : 'none');
    console.log('Full session data:', JSON.stringify(req.session, null, 2));
    console.log('================================');

    // Verify confirmed map exists
    if (!req.session.confirmedMaps?.[purchaseId]) {
      console.error('Session validation failed - Confirmed map not found in session');
      console.error('Available purchase IDs:', req.session?.confirmedMaps ? Object.keys(req.session.confirmedMaps) : 'none');
      return res.status(404).json({
        error: 'Confirmed map not found',
        message: 'Purchase ID not found. Please confirm your map first before purchase.',
        debug: {
          sessionId: req.sessionID,
          purchaseId: purchaseId,
          availablePurchaseIds: req.session?.confirmedMaps ? Object.keys(req.session.confirmedMaps) : [],
          sessionExists: !!req.session,
          confirmedMapsExists: !!req.session?.confirmedMaps,
          mapPreviewsExists: !!req.session?.mapPreviews
        }
      });
    }

    const confirmedMap = req.session.confirmedMaps[purchaseId];
    const previewId = confirmedMap.previewId;
    
    console.log('[Purchase] Processing purchase for confirmed map:', {
      purchaseId,
      previewId,
      jobId: confirmedMap.jobId,
      status: confirmedMap.status
    });

    // Get background job manager to check generation status
    const backgroundJobManager = require('../services/backgroundJobManager');
    const job = backgroundJobManager.getJob(confirmedMap.jobId);
    
    if (!job) {
      return res.status(404).json({
        error: 'Background job not found',
        message: 'Map generation job not found. Please try confirming your map again.'
      });
    }

    // Prepare map data for Shopify
    const mapMetadata = {
      previewId: previewId,
      purchaseId: purchaseId,
      jobId: confirmedMap.jobId,
      activityId: confirmedMap.highResConfig.activityId,
      printSize: confirmedMap.printSize,
      printOrientation: confirmedMap.orientation,
      mapStyle: confirmedMap.highResConfig.style,
      routeColor: confirmedMap.highResConfig.route.color,
      routeWidth: confirmedMap.highResConfig.route.width,
      showMarkers: !!confirmedMap.highResConfig.markers,
      customization: confirmedMap.highResConfig.customization || {},
      center: confirmedMap.highResConfig.center,
      bounds: confirmedMap.highResConfig.bounds,
      generationStatus: job.status
    };

    // Store purchase data in session for webhook processing
    if (!req.session.pendingPurchases) {
      req.session.pendingPurchases = {};
    }
    
    req.session.pendingPurchases[purchaseId] = {
      id: purchaseId,
      previewId: previewId,
      jobId: confirmedMap.jobId,
      mapMetadata: mapMetadata,
      quantity: quantity,
      shippingAddress: shippingAddress,
      createdAt: new Date().toISOString(),
      status: 'pending', // Purchase status (different from generation status)
      generationJobId: confirmedMap.jobId
    };

    // Generate Shopify cart URL with line item properties
    const config = require('../config');
    const appConfig = config.getConfig();
    
    // Get athlete information from session
    const authStatus = require('../services/tokenManager').getAuthStatus(req);
    const stravaUserId = authStatus?.athlete?.id;

    // Create line item properties for Shopify (minimal data - job ID for reference)
    const lineItemProperties = {
      'Map Type': 'Custom Activity Map',
      'Print Size': confirmedMap.printSize,
      'Orientation': confirmedMap.orientation,
      'Purchase ID': purchaseId,
      'Preview ID': previewId,
      'Background Job ID': confirmedMap.jobId,
      'Activity ID': confirmedMap.highResConfig.activityId || 'custom',
      'Strava User ID': stravaUserId || 'unknown',
      'Generation Status': job.status,
      'Map Style': confirmedMap.highResConfig.style.replace('mapbox://styles/mapbox/', '').replace('mapbox://', '')
    };

    // Build Shopify cart add URL
    const shopifyStoreUrl = appConfig.shopify.storeUrl;
    const productVariantId = appConfig.shopify.productVariantIds?.[confirmedMap.printSize] || appConfig.shopify.productVariantIds?.A4 || '51199435473237'; // Default to A4 variant
    
    console.log('Debug - Print Size:', confirmedMap.printSize);
    console.log('Debug - Product Variant ID from config:', productVariantId);
    console.log('Debug - Available variants:', appConfig.shopify.productVariantIds);
    
    let cartUrl = `${shopifyStoreUrl}/cart/add?id=${productVariantId}&quantity=${quantity}`;
    console.log('Debug - Initial cartUrl:', cartUrl);
    
    // Add line item properties to URL
    Object.entries(lineItemProperties).forEach(([key, value]) => {
      cartUrl += `&properties[${encodeURIComponent(key)}]=${encodeURIComponent(value)}`;
    });
    
    console.log('Debug - Final cartUrl:', cartUrl);

    res.json({
      success: true,
      purchase: {
        id: purchaseId,
        previewId: previewId,
        cartUrl: cartUrl,
        metadata: mapMetadata,
        lineItemProperties: lineItemProperties,
        backgroundJob: {
          id: confirmedMap.jobId,
          status: job.status,
          createdAt: job.createdAt,
          estimatedCompletion: job.status === 'pending' ? '2-5 minutes' : 
                               job.status === 'processing' ? '1-3 minutes' : 'completed'
        },
        shopifyIntegration: {
          storeUrl: shopifyStoreUrl,
          productVariantId: productVariantId
        }
      },
      message: `Purchase prepared successfully - map generation is ${job.status}. Redirect to Shopify cart.`
    });

  } catch (error) {
    console.error('Error processing purchase:', error);
    res.status(500).json({
      error: 'Purchase failed',
      message: error.message
    });
  }
});

/**
 * Get purchase status
 */
router.get('/purchase-status/:purchaseId', requireAuth, async (req, res) => {
  try {
    const { purchaseId } = req.params;
    
    if (!req.session.pendingPurchases?.[purchaseId]) {
      return res.status(404).json({
        error: 'Purchase not found',
        message: 'Purchase ID not found in session'
      });
    }

    const purchase = req.session.pendingPurchases[purchaseId];
    
    res.json({
      success: true,
      purchase: {
        id: purchase.id,
        previewId: purchase.previewId,
        status: purchase.status,
        createdAt: purchase.createdAt,
        mapMetadata: purchase.mapMetadata,
        shopifyOrderId: purchase.shopifyOrderId || null,
        highResPath: purchase.highResPath || null,
        localFilePath: purchase.highResPath || null
      }
    });

  } catch (error) {
    console.error('Error getting purchase status:', error);
    res.status(500).json({
      error: 'Failed to get purchase status',
      message: error.message
    });
  }
});

/**
 * Save map configuration to file system
 * New JSON file-based approach to replace session storage
 */
router.post('/save-configuration', requireAuth, async (req, res) => {
  try {
    const { mapConfiguration, printSize, orientation } = req.body;

    if (!mapConfiguration) {
      return res.status(400).json({
        error: 'Missing map configuration',
        message: 'Map configuration data is required'
      });
    }

    // Ensure required fields are present
    const configData = {
      ...mapConfiguration,
      printSize: printSize || mapConfiguration.printSize || 'A4',
      orientation: orientation || mapConfiguration.orientation || 'portrait',
      activityId: mapConfiguration.activityId || mapConfiguration.id,
      timestamp: new Date().toISOString(),
      userId: req.session.strava?.athlete?.id || 'unknown'
    };

    // Generate unique configuration ID
    const configId = mapConfigService.generateConfigurationId();

    // Save configuration to file system
    await mapConfigService.saveConfiguration(configId, configData);

    console.log('[Maps] Configuration saved successfully:', {
      configId,
      activityId: configData.activityId,
      printSize: configData.printSize,
      userId: configData.userId
    });

    res.json({
      success: true,
      configurationId: configId,
      message: 'Configuration saved successfully'
    });

  } catch (error) {
    console.error('[Maps] Error saving configuration:', error);
    
    res.status(500).json({
      error: 'Failed to save configuration',
      message: error.message
    });
  }
});

/**
 * Purchase with configuration ID
 * Simplified purchase flow using file-based configuration
 */
router.post('/purchase-with-config', requireAuth, async (req, res) => {
  try {
    const { configurationId, printSize, activityId, quantity = 1 } = req.body;

    if (!configurationId) {
      return res.status(400).json({
        error: 'Missing configuration ID',
        message: 'Configuration ID is required for purchase'
      });
    }

    // Validate configuration exists
    const configData = await mapConfigService.loadConfiguration(configurationId);
    if (!configData) {
      return res.status(404).json({
        error: 'Configuration not found',
        message: 'The specified configuration could not be found'
      });
    }

    console.log('[Maps] Processing purchase with configuration:', {
      configurationId,
      printSize: printSize || configData.mapConfiguration.printSize,
      activityId: activityId || configData.mapConfiguration.activityId
    });

    // Build simplified Shopify order properties
    const finalPrintSize = printSize || configData.mapConfiguration.printSize || 'A4';
    const finalActivityId = activityId || configData.mapConfiguration.activityId || 'unknown';

    const orderProperties = {
      'Configuration ID': configurationId,
      'Activity ID': finalActivityId,
      'Print Size': finalPrintSize.toLowerCase(),
      'Map Type': 'Custom Activity Map',
      'Orientation': configData.mapConfiguration.orientation || 'portrait',
      'Map Style': configData.mapConfiguration.style || 'streets'
    };

    // Get product variant ID based on print size
    const productVariantId = appConfig.shopify.productVariantIds?.[finalPrintSize] || 
                            appConfig.shopify.productVariantIds?.[finalPrintSize.toUpperCase()] ||
                            appConfig.shopify.productVariantIds?.A4 || 
                            '51199435473237'; // Default fallback

    console.log('[Maps] Using product variant ID:', productVariantId, 'for size:', finalPrintSize);

    // Build cart URL with simplified properties
    let cartUrl = `${appConfig.shopify.storeUrl}/cart/add?id=${productVariantId}&quantity=${quantity}`;

    // Add line item properties to URL
    Object.entries(orderProperties).forEach(([key, value]) => {
      cartUrl += `&properties[${encodeURIComponent(key)}]=${encodeURIComponent(value)}`;
    });

    console.log('[Maps] Generated cart URL length:', cartUrl.length);

    res.json({
      success: true,
      cartUrl: cartUrl,
      configurationId: configurationId,
      orderProperties: orderProperties,
      productVariantId: productVariantId
    });

  } catch (error) {
    console.error('[Maps] Error processing purchase with config:', error);
    
    res.status(500).json({
      error: 'Failed to process purchase',
      message: error.message
    });
  }
});

/**
 * Configuration management endpoints
 */

/**
 * Get configuration statistics
 */
router.get('/config-stats', requireAuth, async (req, res) => {
  try {
    const stats = await mapConfigService.getStatistics();
    
    res.json({
      success: true,
      statistics: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Maps] Error getting configuration statistics:', error);
    res.status(500).json({
      error: 'Failed to get statistics',
      message: error.message
    });
  }
});

/**
 * Cleanup old configurations
 */
router.post('/cleanup-configs', requireAuth, async (req, res) => {
  try {
    const { maxAgeDays = 7 } = req.body;
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
    
    const cleanedCount = await mapConfigService.cleanupOldConfigurations(maxAgeMs);
    
    console.log('[Maps] Configuration cleanup completed:', {
      cleanedCount,
      maxAgeDays,
      timestamp: new Date().toISOString()
    });
    
    res.json({
      success: true,
      cleanedCount,
      maxAgeDays,
      message: `Cleaned up ${cleanedCount} old configurations`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Maps] Error cleaning up configurations:', error);
    res.status(500).json({
      error: 'Failed to cleanup configurations',
      message: error.message
    });
  }
});

/**
 * Recover failed configuration
 */
router.post('/recover-config/:configId', requireAuth, async (req, res) => {
  try {
    const { configId } = req.params;
    
    const success = await mapConfigService.recoverFailedConfiguration(configId);
    
    if (success) {
      res.json({
        success: true,
        configurationId: configId,
        message: 'Configuration recovered successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Configuration not found',
        message: 'Configuration not found in failed folder',
        configurationId: configId
      });
    }
  } catch (error) {
    console.error('[Maps] Error recovering configuration:', error);
    res.status(500).json({
      error: 'Failed to recover configuration',
      message: error.message
    });
  }
});


module.exports = router;