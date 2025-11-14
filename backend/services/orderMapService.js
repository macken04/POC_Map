const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const MapConfigurationService = require('./mapConfigurationService');

/**
 * OrderMapService - Dedicated service for generating maps from Shopify order data
 * 
 * This service handles high-resolution map generation for completed orders
 * without relying on session storage or temporary data. It provides multiple
 * fallback mechanisms to ensure reliable map generation.
 */
class OrderMapService {
  constructor() {
    this.mapService = null;
    this.stravaService = null;
    this.mapConfigService = new MapConfigurationService();
    this.initialized = false;
  }

  /**
   * Initialize the service with dependencies
   */
  async initialize() {
    if (this.initialized) return;

    this.mapService = require('./mapService');
    this.stravaService = require('./stravaService');
    
    await this.mapService.initialize();
    
    this.initialized = true;
    console.log('[OrderMapService] Service initialized successfully');
  }

  /**
   * Generate high-resolution map from Shopify order data
   * Uses multiple fallback strategies to ensure successful generation
   */
  async generateMapFromOrder(orderData, lineItem, webhookTopic) {
    await this.initialize();

    console.log('[OrderMapService] Starting map generation for order:', orderData.name);

    // Add timeout to prevent hanging
    const GENERATION_TIMEOUT = 5 * 60 * 1000; // 5 minutes
    const startTime = Date.now();

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Map generation timeout exceeded (${GENERATION_TIMEOUT}ms) for order ${orderData.name}`));
      }, GENERATION_TIMEOUT);
    });

    try {
      return await Promise.race([
        this.performMapGeneration(orderData, lineItem, webhookTopic),
        timeoutPromise
      ]);
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('[OrderMapService] Map generation failed after', duration, 'ms for order:', orderData.name, error);
      throw error;
    }
  }

  /**
   * Perform the actual map generation (split out for timeout handling)
   */
  async performMapGeneration(orderData, lineItem, webhookTopic) {
    const mapConfig = await this.extractMapConfiguration(orderData, lineItem);
    
    if (!mapConfig) {
      throw new Error('Could not extract valid map configuration from order data');
    }

    console.log('[OrderMapService] Using configuration source:', mapConfig.source);

    try {
      // Generate high-resolution map
      const mapPath = await this.generateHighResolutionMap(mapConfig);
      
      // Store generation record
      await this.storeGenerationRecord(orderData, lineItem, mapConfig, mapPath);

      // Handle successful configuration lifecycle
      await this.handleConfigurationLifecycle(mapConfig, orderData, lineItem);

      const generationSummary = {
        orderId: orderData.id,
        orderName: orderData.name,
        lineItemId: lineItem.id,
        configSource: mapConfig.source,
        configId: mapConfig.configId || null,
        mapPath: mapPath,
        customerEmail: orderData.customer?.email,
        webhookTopic: webhookTopic,
        completedAt: new Date().toISOString()
      };

      console.log('[OrderMapService] 🎉 MAP GENERATION COMPLETED SUCCESSFULLY:', generationSummary);

      return {
        mapPath,
        configSource: mapConfig.source,
        configId: mapConfig.configId || null,
        orderId: orderData.id,
        lineItemId: lineItem.id
      };

    } catch (error) {
      console.error('[OrderMapService] Map generation failed for order:', orderData.name, error);
      
      // Handle failed configuration lifecycle
      await this.handleConfigurationFailure(mapConfig, error, orderData, lineItem);
      
      // Re-throw the error to maintain existing error handling behavior
      throw error;
    }
  }

  /**
   * Extract map configuration using multi-tier fallback strategy
   */
  async extractMapConfiguration(orderData, lineItem) {
    const properties = lineItem.properties || [];
    
    // Strategy 1: Try to decode complete map configuration from order properties
    console.log('[OrderMapService] Strategy 1: Attempting to decode map config from order properties');
    const configFromOrder = await this.getConfigFromOrderProperties(properties);
    if (configFromOrder) {
      return { ...configFromOrder, source: 'order_properties' };
    }

    // Strategy 2: Try to find preview configuration in session storage
    console.log('[OrderMapService] Strategy 2: Searching session storage for preview config');
    const configFromSession = await this.getConfigFromSessionStorage(properties);
    if (configFromSession) {
      return { ...configFromSession, source: 'session_storage' };
    }

    // Strategy 3: Re-fetch from Strava API and reconstruct
    console.log('[OrderMapService] Strategy 3: Attempting to reconstruct from Strava API');
    const configFromStrava = await this.getConfigFromStravaAPI(properties, orderData);
    if (configFromStrava) {
      return { ...configFromStrava, source: 'strava_api_reconstruction' };
    }

    console.error('[OrderMapService] All configuration extraction strategies failed');
    return null;
  }

  /**
   * Strategy 1: Extract configuration from order line item properties
   * Updated to prioritize JSON file-based Configuration ID approach
   */
  async getConfigFromOrderProperties(properties) {
    try {
      // NEW APPROACH: Check for Configuration ID first (JSON file-based)
      const configIdProperty = properties.find(p => p.name === 'Configuration ID')?.value;
      if (configIdProperty) {
        console.log('[OrderMapService] Found Configuration ID in order properties:', configIdProperty);
        
        // Load configuration from file system
        const configData = await this.mapConfigService.loadConfiguration(configIdProperty);
        if (configData) {
          console.log('[OrderMapService] Successfully loaded configuration from file system');
          
          // Extract the actual map configuration from the nested structure
          // The configuration file has map properties nested at mapConfiguration.mapConfiguration
          let config = configData.mapConfiguration?.mapConfiguration || configData.mapConfiguration || {};
          
          // Merge dimensions from mapConfiguration into config if missing
          if (!config.width && !config.height) {
            const dimensions = configData.mapConfiguration?.dimensions || configData.dimensions;
            if (dimensions) {
              console.log('[OrderMapService] Merging dimensions from config structure');
              config.width = dimensions.width;
              config.height = dimensions.height;
            }
          }
          
          // Add print format information from configuration
          // printSize and orientation are stored at top level of mapConfiguration
          const format = configData.mapConfiguration?.printSize || configData.printSize || 'A4';
          const orientation = configData.mapConfiguration?.orientation || configData.orientation || 'portrait';

          config.format = format;
          config.orientation = orientation;
          config.dpi = 300; // Always 300 DPI for high-res printing

          // Calculate actual pixel dimensions for the format at 300 DPI
          // This is critical - dimensions must match PRINT_CONFIG values
          const printDimensions = this.mapService.getPrintDimensions(format, orientation);

          config.width = printDimensions.width;
          config.height = printDimensions.height;

          console.log('[OrderMapService] Added print configuration with dimensions:', {
            format: config.format,
            orientation: config.orientation,
            width: config.width,
            height: config.height,
            dpi: config.dpi
          });
          
          // Log configuration structure for debugging
          console.log('[OrderMapService] Configuration structure:', {
            hasWidth: !!config.width,
            hasHeight: !!config.height,
            hasCenter: !!config.center,
            hasBounds: !!config.bounds,
            hasStyle: !!config.style,
            hasRoute: !!config.route,
            configKeys: Object.keys(config)
          });
          
          // Validate required properties
          if (this.validateMapConfig(config)) {
            console.log('[OrderMapService] File-based configuration is valid');
            return { ...config, source: 'json_file', configId: configIdProperty };
          } else {
            console.warn('[OrderMapService] File-based configuration is missing required properties - attempting reconstruction');
            
            // Try to reconstruct missing properties from available data
            const reconstructedConfig = await this.reconstructConfigurationProperties(config, configData);
            if (reconstructedConfig && this.validateMapConfig(reconstructedConfig)) {
              console.log('[OrderMapService] Successfully reconstructed missing configuration properties');
              return { ...reconstructedConfig, source: 'json_file_reconstructed', configId: configIdProperty };
            }
            
            // If reconstruction failed but we have activity data, try Strava API reconstruction
            if (reconstructedConfig && reconstructedConfig.needsStravaReconstruction && configData.activityData) {
              console.log('[OrderMapService] Attempting Strava API reconstruction with stored activity data');
              try {
                const stravaConfig = await this.reconstructConfigFromStoredActivity(configData, properties);
                if (stravaConfig && this.validateMapConfig(stravaConfig)) {
                  console.log('[OrderMapService] Successfully reconstructed from stored activity data');
                  return { ...stravaConfig, source: 'strava_from_stored_data', configId: configIdProperty };
                }
              } catch (error) {
                console.warn('[OrderMapService] Strava reconstruction from stored data failed:', error.message);
              }
            }
          }
        } else {
          console.warn('[OrderMapService] Configuration file not found:', configIdProperty);
        }
      }

      // FALLBACK APPROACH: Try legacy base64 Map Config for backward compatibility
      const mapConfigProperty = properties.find(p => p.name === 'Map Config')?.value;
      if (mapConfigProperty) {
        console.log('[OrderMapService] Falling back to legacy base64 Map Config');
        
        // Decode base64 encoded configuration
        const configJSON = Buffer.from(mapConfigProperty, 'base64').toString();
        const config = JSON.parse(configJSON);

        // Validate required properties
        if (this.validateMapConfig(config)) {
          console.log('[OrderMapService] Successfully decoded legacy map config from order properties');
          return { ...config, source: 'base64_legacy' };
        } else {
          console.warn('[OrderMapService] Legacy decoded config is missing required properties');
        }
      }

      console.log('[OrderMapService] No valid configuration found in order properties');
      return null;

    } catch (error) {
      console.warn('[OrderMapService] Failed to extract config from order properties:', error.message);
      return null;
    }
  }

  /**
   * Strategy 2: Find configuration in session storage (current method)
   * Enhanced with proper session store access and error handling
   */
  async getConfigFromSessionStorage(properties) {
    try {
      const previewId = properties.find(p => p.name === 'Preview ID')?.value;
      if (!previewId) {
        console.log('[OrderMapService] No Preview ID found in order properties');
        return null;
      }

      console.log('[OrderMapService] Searching for preview configuration in session storage:', previewId);

      // Access the session store through the Express app
      const express = require('express');
      const app = express();
      
      // In a real implementation, we'd need access to the session store instance
      // For now, we'll simulate the session search logic with proper error handling
      return new Promise((resolve) => {
        // This would normally be: req.sessionStore.all((err, sessions) => {...})
        // Since we don't have direct access to the session store in this service,
        // we'll return null and rely on other fallback strategies
        console.warn('[OrderMapService] Session store access not available in this context');
        console.log('[OrderMapService] Falling back to next strategy...');
        resolve(null);
      });
    } catch (error) {
      console.warn('[OrderMapService] Session storage search failed:', error.message);
      return null;
    }
  }

  /**
   * Strategy 3: Reconstruct configuration from Strava API
   */
  async getConfigFromStravaAPI(properties, orderData) {
    try {
      const activityId = properties.find(p => p.name === 'Activity ID')?.value;
      const stravaUserId = properties.find(p => p.name === 'Strava User ID')?.value;
      
      if (!activityId) {
        console.log('[OrderMapService] Missing Activity ID for API reconstruction');
        return null;
      }

      console.log('[OrderMapService] Attempting to reconstruct config from Strava API:', {
        activityId,
        stravaUserId: stravaUserId || 'not provided'
      });

      // Get activity data from Strava API
      const activityData = await this.fetchActivityFromStrava(activityId, stravaUserId);
      if (!activityData) {
        console.warn('[OrderMapService] Failed to fetch activity data from Strava API');
        return null;
      }

      // Reconstruct map configuration from activity data
      const config = await this.reconstructConfigFromActivity(activityData, properties);
      
      if (this.validateMapConfig(config)) {
        console.log('[OrderMapService] Successfully reconstructed config from Strava API');
        return config;
      } else {
        console.warn('[OrderMapService] Reconstructed config is invalid');
        return null;
      }
    } catch (error) {
      console.error('[OrderMapService] Strava API reconstruction failed:', error.message);
      return null;
    }
  }

  /**
   * Fetch activity data from Strava API
   */
  async fetchActivityFromStrava(activityId, stravaUserId) {
    try {
      return await this.stravaService.getActivityForOrderFulfillment(activityId, stravaUserId);
    } catch (error) {
      console.error('[OrderMapService] Error fetching from Strava API:', error);
      return null;
    }
  }

  /**
   * Reconstruct complete map configuration from Strava activity data
   */
  async reconstructConfigFromActivity(activityData, orderProperties) {
    try {
      // Validate activity data first
      const validation = this.stravaService.validateActivityForMapGeneration(activityData);
      if (!validation.valid) {
        throw new Error(`Invalid activity data: ${validation.reason}`);
      }

      // Transform activity data for map configuration
      const transformedActivity = this.stravaService.transformActivityForMapConfig(activityData);

      // Extract print preferences from order properties
      const printSize = orderProperties.find(p => p.name === 'Print Size')?.value || 'A4';
      const orientation = orderProperties.find(p => p.name === 'Orientation')?.value || 'portrait';
      const mapStyle = orderProperties.find(p => p.name === 'Map Style')?.value || 'outdoors-v12';
      const routeColor = orderProperties.find(p => p.name === 'Route Color')?.value || '#fc5200';
      const routeWidth = parseInt(orderProperties.find(p => p.name === 'Route Width')?.value) || 4;

      // Calculate dimensions based on print size (300 DPI)
      const dimensions = this.getPrintDimensions(printSize, orientation);

      // Use transformed coordinates and calculate bounds
      const coordinates = transformedActivity.coordinates;
      const bounds = this.calculateBounds(coordinates);
      const center = this.calculateCenter(bounds);

      const config = {
        id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        width: dimensions.width,
        height: dimensions.height,
        format: printSize,
        orientation: orientation,
        dpi: 300,
        style: `mapbox://styles/mapbox/${mapStyle}`,
        center: center,
        bounds: bounds,
        route: {
          coordinates: coordinates,
          color: routeColor,
          width: routeWidth
        },
        markers: {
          start: coordinates[0],
          end: coordinates[coordinates.length - 1]
        },
        title: transformedActivity.name,
        activityId: transformedActivity.id,
        reconstructed: true,
        originalActivity: {
          distance: transformedActivity.distance,
          movingTime: transformedActivity.movingTime,
          elevationGain: transformedActivity.elevationGain,
          type: transformedActivity.type
        }
      };

      console.log('[OrderMapService] Successfully reconstructed config from activity:', {
        activityId: config.activityId,
        title: config.title,
        coordinateCount: coordinates.length,
        bounds: bounds
      });

      return config;
    } catch (error) {
      console.error('[OrderMapService] Error reconstructing config from activity:', error);
      return null;
    }
  }

  /**
   * Reconstruct configuration from stored activity data (without API call)
   */
  async reconstructConfigFromStoredActivity(configData, orderProperties) {
    try {
      console.log('[OrderMapService] Reconstructing from stored activity data');
      
      const activityData = configData.activityData;
      if (!activityData || !activityData.id) {
        throw new Error('No activity data available in configuration');
      }
      
      console.log('[OrderMapService] Using stored activity:', {
        id: activityData.id,
        name: activityData.name,
        type: activityData.type,
        distance: activityData.distance
      });
      
      // We need to fetch the detailed activity data with coordinates from Strava
      // Since the stored data doesn't include the GPS track
      const detailedActivity = await this.fetchActivityFromStrava(activityData.id.toString());
      if (!detailedActivity) {
        throw new Error('Could not fetch detailed activity data from Strava API');
      }
      
      // Use the existing reconstruction logic
      return await this.reconstructConfigFromActivity(detailedActivity, orderProperties);
      
    } catch (error) {
      console.error('[OrderMapService] Error reconstructing from stored activity data:', error);
      return null;
    }
  }

  /**
   * Validate that map configuration has all required properties
   */
  validateMapConfig(config) {
    if (!config) {
      console.warn('[OrderMapService] Configuration is null or undefined');
      return false;
    }
    
    const required = [
      'width', 'height', 'center', 'bounds', 'style', 'route'
    ];

    const missing = [];
    for (const prop of required) {
      if (!config[prop]) {
        missing.push(prop);
      }
    }
    
    if (missing.length > 0) {
      console.warn(`[OrderMapService] Missing required properties: ${missing.join(', ')}`);
      console.warn('[OrderMapService] Available properties:', Object.keys(config).join(', '));
      return false;
    }

    // Validate nested route properties
    if (!config.route.coordinates || !Array.isArray(config.route.coordinates)) {
      console.warn('[OrderMapService] Invalid route coordinates - expected array');
      return false;
    }
    
    if (config.route.coordinates.length === 0) {
      console.warn('[OrderMapService] Route coordinates array is empty');
      return false;
    }

    // Validate center coordinates
    if (!Array.isArray(config.center) || config.center.length !== 2) {
      console.warn('[OrderMapService] Invalid center coordinates - expected [lng, lat] array');
      return false;
    }
    
    if (typeof config.center[0] !== 'number' || typeof config.center[1] !== 'number') {
      console.warn('[OrderMapService] Center coordinates must be numbers');
      return false;
    }

    // Validate bounds
    if (!config.bounds || typeof config.bounds !== 'object') {
      console.warn('[OrderMapService] Invalid bounds - expected object');
      return false;
    }
    
    const boundsProps = ['north', 'south', 'east', 'west'];
    const missingBounds = [];
    for (const prop of boundsProps) {
      if (typeof config.bounds[prop] !== 'number') {
        missingBounds.push(prop);
      }
    }
    
    if (missingBounds.length > 0) {
      console.warn(`[OrderMapService] Invalid bounds properties: ${missingBounds.join(', ')} - expected numbers`);
      return false;
    }
    
    // Validate dimensions are positive numbers
    if (typeof config.width !== 'number' || config.width <= 0) {
      console.warn('[OrderMapService] Width must be a positive number');
      return false;
    }
    
    if (typeof config.height !== 'number' || config.height <= 0) {
      console.warn('[OrderMapService] Height must be a positive number');
      return false;
    }

    console.log('[OrderMapService] Configuration validation passed');
    return true;
  }

  /**
   * Generate high-resolution map using the map service
   */
  async generateHighResolutionMap(config) {
    try {
      console.log('[OrderMapService] Generating high-resolution map:', {
        id: config.id,
        dimensions: `${config.width}x${config.height}`,
        source: config.source
      });

      const mapPath = await this.mapService.generateHighResFromPreviewConfig(config);
      
      if (!mapPath) {
        throw new Error('Map service returned no file path');
      }

      // Verify file was created
      const fileExists = await fs.access(mapPath).then(() => true).catch(() => false);
      if (!fileExists) {
        throw new Error(`Generated map file not found at path: ${mapPath}`);
      }

      console.log('[OrderMapService] High-resolution map generated successfully:', mapPath);
      return mapPath;
    } catch (error) {
      console.error('[OrderMapService] Error generating high-resolution map:', error);
      throw new Error(`High-resolution map generation failed: ${error.message}`);
    }
  }

  /**
   * Store generation record for tracking and debugging
   */
  async storeGenerationRecord(orderData, lineItem, config, mapPath) {
    try {
      const record = {
        orderId: orderData.id,
        orderName: orderData.name,
        lineItemId: lineItem.id,
        configSource: config.source,
        mapPath: mapPath,
        customer: {
          id: orderData.customer?.id,
          email: orderData.customer?.email
        },
        generatedAt: new Date().toISOString(),
        configuration: {
          format: config.format,
          orientation: config.orientation,
          dpi: config.dpi,
          style: config.style
        }
      };

      const recordsDir = path.join(__dirname, '..', 'generated-maps', 'order-records');
      await fs.mkdir(recordsDir, { recursive: true });

      const recordFile = path.join(recordsDir, `order_${orderData.id}_${lineItem.id}.json`);
      await fs.writeFile(recordFile, JSON.stringify(record, null, 2));

      console.log('[OrderMapService] Generation record stored:', recordFile);
    } catch (error) {
      console.warn('[OrderMapService] Failed to store generation record:', error.message);
      // Don't throw - record storage failure shouldn't stop the process
    }
  }

  /**
   * Handle configuration lifecycle after successful generation
   */
  async handleConfigurationLifecycle(config, orderData, lineItem) {
    try {
      // Only handle JSON file-based configurations
      if (config.source === 'json_file' && config.configId) {
        console.log('[OrderMapService] Moving configuration to processed folder:', config.configId);
        
        const success = await this.mapConfigService.moveToProcessed(config.configId);
        if (success) {
          console.log('[OrderMapService] Configuration successfully moved to processed');
        } else {
          console.warn('[OrderMapService] Failed to move configuration to processed folder');
        }
      } else {
        console.log('[OrderMapService] Configuration not file-based, skipping lifecycle management');
      }
    } catch (error) {
      console.error('[OrderMapService] Error handling configuration lifecycle:', error);
      // Don't throw - lifecycle management failure shouldn't stop the process
    }
  }

  /**
   * Handle configuration failure
   */
  async handleConfigurationFailure(config, error, orderData, lineItem) {
    try {
      // Only handle JSON file-based configurations
      if (config.source === 'json_file' && config.configId) {
        console.log('[OrderMapService] Moving failed configuration to failed folder:', config.configId);
        
        const success = await this.mapConfigService.moveToFailed(config.configId, error);
        if (success) {
          console.log('[OrderMapService] Failed configuration successfully moved to failed folder');
        } else {
          console.warn('[OrderMapService] Failed to move configuration to failed folder');
        }
      } else {
        console.log('[OrderMapService] Configuration not file-based, skipping failure lifecycle management');
      }
    } catch (lifecycleError) {
      console.error('[OrderMapService] Error handling configuration failure lifecycle:', lifecycleError);
      // Don't throw - lifecycle management failure shouldn't stop the process
    }
  }

  /**
   * Reconstruct missing configuration properties from available data
   */
  async reconstructConfigurationProperties(config, configData) {
    try {
      console.log('[OrderMapService] Attempting to reconstruct missing configuration properties');
      
      const reconstructed = { ...config };
      
      // Ensure dimensions are set using correct print dimensions
      if (!reconstructed.width || !reconstructed.height) {
        const printConfig = configData.mapConfiguration?.config || configData.printPreferences;
        const printSize = printConfig?.printSize || 'A4';
        const orientation = printConfig?.orientation || 'portrait';
        const dimensions = this.getPrintDimensions(printSize, orientation);
        
        reconstructed.width = dimensions.width;
        reconstructed.height = dimensions.height;
        console.log('[OrderMapService] Set dimensions from print preferences:', dimensions);
      }
      
      // Ensure style is set
      if (!reconstructed.style) {
        const styleConfig = configData.mapConfiguration?.config?.style || 
                           configData.mapPreferences?.mapStyle;
        if (styleConfig) {
          // If it's already a full mapbox URL, use it as is, otherwise format it
          reconstructed.style = styleConfig.includes('mapbox://styles/') 
            ? styleConfig 
            : `mapbox://styles/mapbox/${styleConfig}`;
          console.log('[OrderMapService] Set map style from config:', reconstructed.style);
        }
      }
      
      // Default style if still missing
      if (!reconstructed.style) {
        reconstructed.style = 'mapbox://styles/mapbox/outdoors-v12';
        console.log('[OrderMapService] Using default map style');
      }
      
      // Try to extract route coordinates from various sources
      if (!reconstructed.route) {
        // Check if coordinates are embedded in the mapConfiguration
        if (configData.mapConfiguration && configData.mapConfiguration.coordinates) {
          reconstructed.route = {
            coordinates: configData.mapConfiguration.coordinates,
            color: configData.mapConfiguration.customization?.routeColor ||
                   configData.settings?.routeColor ||
                   configData.mapConfiguration.routeColor ||
                   '#fc5200',
            width: configData.mapConfiguration.customization?.routeWidth ||
                   configData.settings?.routeThickness ||
                   configData.mapConfiguration.routeWidth ||
                   4
          };
          console.log('[OrderMapService] Extracted route from embedded coordinates with color:', reconstructed.route.color);
        }
        // Check if we have a Strava polyline in activityData that we can decode
        else if (configData.mapConfiguration?.activityData?.map?.summary_polyline) {
          console.log('[OrderMapService] Found Strava polyline in activity data - decoding...');
          try {
            const coordinates = this.decodeStravaPolyline(configData.mapConfiguration.activityData.map.summary_polyline);
            if (coordinates && coordinates.length > 0) {
              reconstructed.route = {
                coordinates: coordinates,
                color: configData.mapConfiguration.customization?.routeColor ||
                       configData.settings?.routeColor ||
                       '#fc5200',
                width: configData.mapConfiguration.customization?.routeWidth ||
                       configData.settings?.routeThickness ||
                       4
              };
              console.log('[OrderMapService] Successfully decoded Strava polyline to', coordinates.length, 'coordinates with color:', reconstructed.route.color);
            }
          } catch (error) {
            console.warn('[OrderMapService] Failed to decode Strava polyline:', error.message);
          }
        }
        // Check if we have activityData with ID but no polyline - need Strava API reconstruction
        else if (configData.mapConfiguration?.activityData?.id) {
          console.log('[OrderMapService] Configuration contains activity data but no coordinates - need Strava API reconstruction');
          console.log('[OrderMapService] Activity ID:', configData.mapConfiguration.activityData.id);
          
          // For now, we'll need to fall back to Strava API, but let's set a flag
          reconstructed.needsStravaReconstruction = true;
        }
      }
      
      // Calculate bounds and center from route coordinates if missing
      if (reconstructed.route && reconstructed.route.coordinates && 
          (!reconstructed.bounds || !reconstructed.center)) {
        const bounds = this.calculateBounds(reconstructed.route.coordinates);
        const center = this.calculateCenter(bounds);
        
        if (!reconstructed.bounds) {
          reconstructed.bounds = bounds;
          console.log('[OrderMapService] Calculated bounds from route coordinates');
        }
        
        if (!reconstructed.center) {
          reconstructed.center = center;
          console.log('[OrderMapService] Calculated center from route coordinates');
        }
      }
      
      console.log('[OrderMapService] Reconstruction completed:', {
        hasWidth: !!reconstructed.width,
        hasHeight: !!reconstructed.height,
        hasCenter: !!reconstructed.center,
        hasBounds: !!reconstructed.bounds,
        hasStyle: !!reconstructed.style,
        hasRoute: !!reconstructed.route
      });
      
      return reconstructed;
      
    } catch (error) {
      console.error('[OrderMapService] Error reconstructing configuration properties:', error);
      return null;
    }
  }

  /**
   * Get print dimensions based on format and orientation
   */
  getPrintDimensions(format, orientation) {
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

    return dimensions[format]?.[orientation] || dimensions.A4.portrait;
  }

  /**
   * Calculate bounds from coordinates array
   */
  calculateBounds(coordinates) {
    const lngs = coordinates.map(coord => coord[0]);
    const lats = coordinates.map(coord => coord[1]);

    return {
      west: Math.min(...lngs),
      east: Math.max(...lngs),
      south: Math.min(...lats),
      north: Math.max(...lats)
    };
  }

  /**
   * Calculate center point from bounds
   */
  calculateCenter(bounds) {
    return [
      (bounds.west + bounds.east) / 2,
      (bounds.south + bounds.north) / 2
    ];
  }

  /**
   * Decode a Strava polyline into coordinates array
   * @param {string} polyline - Encoded polyline string from Strava
   * @returns {Array<Array<number>>} Array of [lng, lat] coordinate pairs
   */
  decodeStravaPolyline(polyline) {
    if (!polyline || typeof polyline !== 'string') {
      throw new Error('Invalid polyline string');
    }

    const coordinates = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < polyline.length) {
      let b;
      let shift = 0;
      let result = 0;

      // Decode latitude
      do {
        b = polyline.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const deltaLat = (result & 1) ? ~(result >> 1) : (result >> 1);
      lat += deltaLat;

      shift = 0;
      result = 0;

      // Decode longitude
      do {
        b = polyline.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const deltaLng = (result & 1) ? ~(result >> 1) : (result >> 1);
      lng += deltaLng;

      // Convert to decimal degrees and add to coordinates array
      // Note: Strava polylines are encoded as [lat, lng] but we return [lng, lat] for GeoJSON compatibility
      coordinates.push([lng / 1e5, lat / 1e5]);
    }

    return coordinates;
  }
}

module.exports = new OrderMapService();