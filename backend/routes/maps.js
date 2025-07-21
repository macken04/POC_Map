const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const { requireAuth } = require('./auth');
const config = require('../config');

const appConfig = config.getConfig();

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

    poly.push([lat / 1e5, lng / 1e5]);
  }

  return poly;
}

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
      style = 'outdoors-v12',
      width = 800,
      height = 600,
      showStartEnd = true,
      lineColor = '#ff4444',
      lineWidth = 3
    } = req.body;

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
    const lats = routeCoordinates.map(coord => coord[0]);
    const lngs = routeCoordinates.map(coord => coord[1]);
    
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
      style: `mapbox://styles/mapbox/${style}`,
      width: parseInt(width),
      height: parseInt(height),
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

    res.json({
      success: true,
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
 * Generate a high-resolution map for printing
 * Creates a 300 DPI map image and saves it to disk
 */
router.post('/generate', requireAuth, async (req, res) => {
  try {
    const {
      activityId,
      polyline,
      coordinates,
      format = 'A4', // A4 or A3
      style = 'outdoors-v12',
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
    const lats = routeCoordinates.map(coord => coord[0]);
    const lngs = routeCoordinates.map(coord => coord[1]);
    
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

module.exports = router;