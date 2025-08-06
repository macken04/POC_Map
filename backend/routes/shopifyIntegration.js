const express = require('express');
const router = express.Router();
const ShopifyIntegrationService = require('../services/shopifyIntegration');
const sessionSecurity = require('../middleware/sessionSecurity');
const { requireAuth } = require('./auth');

/**
 * Shopify Integration Routes
 * 
 * These routes handle the integration between Strava authentication
 * and Shopify store sessions, managing user context and redirects.
 */

// Add debugging middleware specifically for shopify integration routes
router.use((req, res, next) => {
  console.log(`[Shopify Integration] ${req.method} ${req.path}`, {
    origin: req.get('Origin'),
    referer: req.get('Referer'),
    userAgent: req.get('User-Agent'),
    sessionID: req.sessionID
  });
  next();
});

/**
 * Get current integration status
 * Returns the status of Strava auth and Shopify session integration
 * Note: Removed sessionSecurity middleware to avoid CORS conflicts
 */
router.get('/status', (req, res) => {
  try {
    console.log('[Shopify Integration] Status endpoint called');
    console.log('[Shopify Integration] Session ID:', req.sessionID);
    console.log('[Shopify Integration] Session data:', req.session);
    console.log('[Shopify Integration] Headers received:', {
      origin: req.get('Origin'),
      referer: req.get('Referer'),
      userAgent: req.get('User-Agent'),
      cookie: req.get('Cookie')
    });
    
    const status = ShopifyIntegrationService.getIntegrationStatus(req);
    console.log('[Shopify Integration] Status result:', status);
    
    const response = {
      success: true,
      status: status,
      timestamp: new Date().toISOString()
    };
    
    console.log('[Shopify Integration] Sending response:', response);
    res.json(response);
  } catch (error) {
    console.error('[Shopify Integration] Error getting integration status:', error);
    console.error('[Shopify Integration] Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Failed to get integration status',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Initialize Shopify session after Strava authentication
 * This endpoint is called automatically after successful Strava OAuth
 */
router.post('/initialize', requireAuth, (req, res) => {
  try {
    console.log('[Shopify Integration] Initialize endpoint called');
    // Get current auth status to extract user data
    const authStatus = require('../services/tokenManager').getAuthStatus(req);
    
    if (!authStatus.authenticated || !authStatus.athlete) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated with Strava',
        message: 'User must complete Strava authentication first'
      });
    }

    // Initialize Shopify session with Strava user data
    const shopifySession = ShopifyIntegrationService.initializeShopifySession(req, {
      athlete: authStatus.athlete
    });

    console.log('Shopify integration initialized:', {
      stravaUserId: authStatus.athlete.id,
      sessionId: req.sessionID,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Shopify integration session initialized',
      session: shopifySession,
      user: {
        id: authStatus.athlete.id,
        displayName: authStatus.athlete.firstname || authStatus.athlete.username
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error initializing Shopify integration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initialize Shopify integration',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Generate redirect URL to Shopify store
 * Creates a secure redirect URL with user context preserved
 */
router.get('/redirect-url', requireAuth, (req, res) => {
  try {
    console.log('[Shopify Integration] Redirect URL endpoint called');
    const destinationPath = req.query.path || '';
    
    const redirectUrl = ShopifyIntegrationService.generateShopifyRedirectUrl(req, destinationPath);
    
    res.json({
      success: true,
      redirectUrl: redirectUrl,
      message: 'Redirect URL generated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating redirect URL:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate redirect URL',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Handle redirect from Shopify store
 * Validates the incoming request and provides session context
 * Note: Removed sessionSecurity middleware to avoid CORS conflicts
 */
router.get('/validate-shopify-request', (req, res) => {
  try {
    console.log('[Shopify Integration] Validate Shopify request endpoint called');
    const validation = ShopifyIntegrationService.validateShopifyRequest(req);
    
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Shopify request',
        reason: validation.reason,
        timestamp: new Date().toISOString()
      });
    }

    // Update session activity
    ShopifyIntegrationService.updateSessionActivity(req);

    res.json({
      success: true,
      message: 'Shopify request validated successfully',
      validation: validation,
      sessionContext: ShopifyIntegrationService.getSessionContextForFrontend(req),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error validating Shopify request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate Shopify request',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Get session context for frontend use
 * Returns current session state and user information
 * Note: Removed sessionSecurity middleware to avoid CORS conflicts
 */
router.get('/session-context', (req, res) => {
  try {
    console.log('[Shopify Integration] Session context endpoint called');
    const sessionContext = ShopifyIntegrationService.getSessionContextForFrontend(req);
    
    res.json({
      success: true,
      context: sessionContext,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting session context:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get session context',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Clear Shopify integration session
 * Removes Shopify-specific session data while preserving Strava auth
 * Note: Removed sessionSecurity middleware to avoid CORS conflicts
 */
router.post('/clear-session', (req, res) => {
  try {
    console.log('[Shopify Integration] Clear session endpoint called');
    ShopifyIntegrationService.clearShopifySession(req);
    
    res.json({
      success: true,
      message: 'Shopify integration session cleared',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error clearing Shopify session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear Shopify session',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Simple test endpoint for CORS debugging
 * No authentication or session middleware - just basic response
 */
router.get('/test-cors', (req, res) => {
  console.log('[Shopify Integration] CORS test endpoint called');
  console.log('[Shopify Integration] Request headers:', req.headers);
  
  res.json({
    success: true,
    message: 'CORS test successful',
    timestamp: new Date().toISOString(),
    requestInfo: {
      method: req.method,
      path: req.path,
      origin: req.get('Origin'),
      userAgent: req.get('User-Agent'),
      sessionID: req.sessionID
    }
  });
});

/**
 * Ultra simple test endpoint - minimal response
 */
router.get('/test-simple', (req, res) => {
  console.log('[Shopify Integration] Simple test called from:', req.get('Origin'));
  res.json({ ok: true });
});

/**
 * Integration health check
 * Comprehensive health report for the Strava-Shopify integration
 */
router.get('/health', (req, res) => {
  try {
    console.log('[Shopify Integration] Health check endpoint called');
    const healthReport = ShopifyIntegrationService.generateHealthReport(req);
    
    const statusCode = healthReport.status === 'healthy' ? 200 : 
                      healthReport.status === 'error' ? 500 : 206;
    
    res.status(statusCode).json({
      success: healthReport.status !== 'error',
      health: healthReport,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating integration health report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate health report',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Complete integration flow endpoint
 * Handles the complete flow from Strava auth to Shopify redirect
 */
router.post('/complete-flow', requireAuth, (req, res) => {
  try {
    console.log('[Shopify Integration] Complete flow endpoint called');
    const { destinationPath } = req.body;
    
    // Get auth status to ensure user is authenticated
    const authStatus = require('../services/tokenManager').getAuthStatus(req);
    
    if (!authStatus.authenticated) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'User must be authenticated with Strava'
      });
    }

    // Initialize Shopify session if not already done
    let shopifySession = req.session?.shopifyIntegration;
    if (!shopifySession) {
      shopifySession = ShopifyIntegrationService.initializeShopifySession(req, {
        athlete: authStatus.athlete
      });
    } else {
      // Update activity timestamp
      ShopifyIntegrationService.updateSessionActivity(req);
    }

    // Generate redirect URL
    const redirectUrl = ShopifyIntegrationService.generateShopifyRedirectUrl(req, destinationPath);
    
    console.log('Complete integration flow executed:', {
      stravaUserId: authStatus.athlete.id,
      destinationPath,
      redirectUrl,
      sessionId: req.sessionID,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Integration flow completed successfully',
      redirectUrl: redirectUrl,
      user: {
        id: authStatus.athlete.id,
        displayName: authStatus.athlete.firstname || authStatus.athlete.username
      },
      session: {
        id: req.sessionID,
        initialized: true
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error completing integration flow:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete integration flow',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Shopify Webhook Handler for Order Processing
 * Handles orders/create and orders/paid webhooks to trigger map generation
 */
router.post('/webhook/order', async (req, res) => {
  try {
    console.log('[Shopify Webhook] Order webhook received');
    
    const hmacHeader = req.get('X-Shopify-Hmac-Sha256');
    const topic = req.get('X-Shopify-Topic');
    const shopDomain = req.get('X-Shopify-Shop-Domain');
    
    if (!hmacHeader || !topic) {
      console.log('[Shopify Webhook] Missing required headers');
      return res.status(400).json({ error: 'Missing required webhook headers' });
    }

    // Verify webhook authenticity using preserved raw body
    const crypto = require('crypto');
    const rawBody = req.rawBody;
    
    if (!rawBody) {
      console.log('[Shopify Webhook] Raw body not available for HMAC verification');
      return res.status(400).json({ error: 'Raw body required for webhook verification' });
    }
    
    const calculatedHmac = crypto
      .createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET || process.env.SHOPIFY_SECRET_KEY)
      .update(rawBody, 'utf8')
      .digest('base64');

    if (calculatedHmac !== hmacHeader) {
      console.log('[Shopify Webhook] HMAC verification failed', {
        calculated: calculatedHmac,
        received: hmacHeader
      });
      return res.status(401).json({ error: 'Webhook verification failed' });
    }

    console.log('[Shopify Webhook] HMAC verification successful');

    // Parse the raw body as JSON for processing
    const orderData = JSON.parse(rawBody);
    console.log('[Shopify Webhook] Processing order:', {
      id: orderData.id,
      name: orderData.name,
      topic: topic,
      shopDomain: shopDomain
    });

    // Only process paid orders or order creation for map items
    if (topic === 'orders/paid' || topic === 'orders/create') {
      await processMapOrder(orderData, topic);
    }

    res.status(200).json({ success: true, message: 'Webhook processed successfully' });

  } catch (error) {
    console.error('[Shopify Webhook] Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed', message: error.message });
  }
});

// Order processing state tracker to prevent duplicates
const orderProcessingState = new Map();
const configProcessingState = new Map();
const ORDER_PROCESSING_TIMEOUT = 10 * 60 * 1000; // 10 minutes

/**
 * Check if order is currently being processed or recently processed
 */
function isOrderBeingProcessed(orderId, webhookTopic) {
  const key = `${orderId}_${webhookTopic}`;
  const processingInfo = orderProcessingState.get(key);
  
  if (!processingInfo) {
    return false;
  }
  
  // Check if processing is still within timeout window
  const now = Date.now();
  if (now - processingInfo.timestamp > ORDER_PROCESSING_TIMEOUT) {
    // Clean up expired entry
    orderProcessingState.delete(key);
    return false;
  }
  
  return true;
}

/**
 * Mark order as being processed
 */
function markOrderAsProcessing(orderId, webhookTopic) {
  const key = `${orderId}_${webhookTopic}`;
  orderProcessingState.set(key, {
    timestamp: Date.now(),
    status: 'processing'
  });
}

/**
 * Mark order processing as complete
 */
function markOrderProcessingComplete(orderId, webhookTopic) {
  const key = `${orderId}_${webhookTopic}`;
  const processingInfo = orderProcessingState.get(key);
  if (processingInfo) {
    processingInfo.status = 'completed';
    processingInfo.completedAt = Date.now();
  }
}

/**
 * Check if configuration is currently being processed
 */
function isConfigurationBeingProcessed(configId) {
  const processingInfo = configProcessingState.get(configId);
  
  if (!processingInfo) {
    return false;
  }
  
  const now = Date.now();
  if (now - processingInfo.timestamp > ORDER_PROCESSING_TIMEOUT) {
    configProcessingState.delete(configId);
    return false;
  }
  
  return true;
}

/**
 * Mark configuration as being processed
 */
function markConfigurationAsProcessing(configId) {
  configProcessingState.set(configId, {
    timestamp: Date.now(),
    status: 'processing'
  });
}

/**
 * Mark configuration processing as complete
 */
function markConfigurationProcessingComplete(configId) {
  const processingInfo = configProcessingState.get(configId);
  if (processingInfo) {
    processingInfo.status = 'completed';
    processingInfo.completedAt = Date.now();
  }
}

/**
 * Periodic cleanup of expired processing states
 */
function cleanupExpiredProcessingStates() {
  const now = Date.now();
  let cleanedCount = 0;
  
  // Clean up expired order processing states
  for (const [key, processingInfo] of orderProcessingState.entries()) {
    if (now - processingInfo.timestamp > ORDER_PROCESSING_TIMEOUT) {
      orderProcessingState.delete(key);
      cleanedCount++;
    }
  }
  
  // Clean up expired configuration processing states
  for (const [configId, processingInfo] of configProcessingState.entries()) {
    if (now - processingInfo.timestamp > ORDER_PROCESSING_TIMEOUT) {
      configProcessingState.delete(configId);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`[Processing State Cleanup] Cleaned up ${cleanedCount} expired processing states`);
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupExpiredProcessingStates, 5 * 60 * 1000);

/**
 * Process map orders and trigger high-resolution generation
 */
async function processMapOrder(orderData, webhookTopic) {
  try {
    console.log('[Map Order Processing] Processing order:', orderData.name);
    
    // Check for duplicate processing
    if (isOrderBeingProcessed(orderData.id, webhookTopic)) {
      console.log('[Map Order Processing] Order already being processed, skipping:', orderData.name, webhookTopic);
      return;
    }
    
    // Mark as processing to prevent duplicates
    markOrderAsProcessing(orderData.id, webhookTopic);

    // Find line items that contain map data
    const mapLineItems = orderData.line_items.filter(item => {
      const properties = item.properties || [];
      return properties.some(prop => prop.name === 'Purchase ID' || prop.name === 'Map Type');
    });

    if (mapLineItems.length === 0) {
      console.log('[Map Order Processing] No map items found in order');
      return;
    }

    console.log('[Map Order Processing] Found', mapLineItems.length, 'map items');

    // Process each map line item
    for (const lineItem of mapLineItems) {
      try {
        await processMapLineItem(lineItem, orderData, webhookTopic);
      } catch (error) {
        console.error('[Map Order Processing] Error processing line item:', error);
        // Continue processing other items even if one fails
      }
    }

    // Mark processing as complete
    markOrderProcessingComplete(orderData.id, webhookTopic);
    console.log('[Map Order Processing] Order processing completed:', orderData.name, webhookTopic);

  } catch (error) {
    console.error('[Map Order Processing] Error:', error);
    // Mark as failed/completed to prevent stuck state
    markOrderProcessingComplete(orderData.id, webhookTopic);
    throw error;
  }
}

/**
 * Process individual map line item - Enhanced for background job integration
 */
async function processMapLineItem(lineItem, orderData, webhookTopic) {
  try {
    // Extract map metadata from line item properties
    const properties = lineItem.properties || [];
    const configurationId = properties.find(p => p.name === 'Configuration ID')?.value;
    const activityId = properties.find(p => p.name === 'Activity ID')?.value;
    const printSize = properties.find(p => p.name === 'Print Size')?.value || 'A4';
    const orientation = properties.find(p => p.name === 'Orientation')?.value || 'portrait';
    const mapStyle = properties.find(p => p.name === 'Map Style')?.value || 'streets';
    const mapType = properties.find(p => p.name === 'Map Type')?.value;

    console.log('[Map Line Item] Processing with JSON file-based approach:', {
      configurationId,
      activityId,
      printSize,
      orientation,
      mapStyle,
      mapType,
      orderId: orderData.id,
      orderName: orderData.name,
      webhookTopic
    });

    // NEW APPROACH: Use Configuration ID if available
    if (configurationId) {
      console.log('[Map Line Item] Using JSON file-based configuration:', configurationId);
      
      // Check if this configuration is already being processed
      if (isConfigurationBeingProcessed(configurationId)) {
        console.log('[Map Line Item] Configuration already being processed, skipping:', configurationId);
        return;
      }
      
      if (webhookTopic === 'orders/paid') {
        console.log('[Map Line Item] Order paid - generating high-resolution map');
        
        // Mark configuration as processing
        markConfigurationAsProcessing(configurationId);
        
        try {
          // Use OrderMapService to generate map from configuration
          const orderMapService = require('../services/orderMapService');
          const result = await orderMapService.generateMapFromOrder(orderData, lineItem, webhookTopic);
          
          console.log('[Map Line Item] Map generation completed successfully:', {
            orderId: orderData.id,
            configurationId: result.configId,
            mapPath: result.mapPath,
            configSource: result.configSource
          });
          
          // Mark configuration processing as complete
          markConfigurationProcessingComplete(configurationId);
          
        } catch (error) {
          console.error('[Map Line Item] Map generation failed:', error);
          // Mark as complete to prevent stuck state
          markConfigurationProcessingComplete(configurationId);
          throw error;
        }
        
      } else if (webhookTopic === 'orders/create') {
        console.log('[Map Line Item] Order created - configuration ready for processing on payment');
      }
      
      return;
    }

    // FALLBACK APPROACH: Handle legacy orders without Configuration ID
    console.log('[Map Line Item] No Configuration ID found - checking for legacy approach');
    
    // Check for legacy Purchase ID or other identifiers
    const purchaseId = properties.find(p => p.name === 'Purchase ID')?.value;
    const previewId = properties.find(p => p.name === 'Preview ID')?.value;
    const mapConfig = properties.find(p => p.name === 'Map Config')?.value;

    if (purchaseId || previewId || mapConfig) {
      console.log('[Map Line Item] Found legacy identifiers - using fallback generation');
      await fallbackMapGeneration(lineItem, orderData, webhookTopic);
      return;
    }

    // No valid map identifiers found
    console.log('[Map Line Item] No valid map identifiers found - skipping processing');

  } catch (error) {
    console.error('[Map Line Item] Error processing line item:', error);
    throw error;
  }
}

/**
 * Process completed purchase - add map file to order if generation is complete
 */
async function processCompletedPurchase(job, orderData, lineItem) {
  try {
    console.log('[Completed Purchase] Processing for job:', {
      jobId: job.id,
      purchaseId: job.purchaseId,
      status: job.status,
      orderName: orderData.name
    });

    if (job.status === 'completed' && job.filePath && job.fileName) {
      // Map generation is complete - add filename to order
      console.log('[Completed Purchase] Map generation complete, adding file to order:', {
        fileName: job.fileName,
        filePath: job.filePath
      });

      // Add map filename as order metafield or note
      await addMapFileToOrder(orderData, job);
      
      // Send completion email to customer
      await sendOrderCompletionEmail(orderData, job);
      
    } else if (job.status === 'processing' || job.status === 'pending') {
      // Map generation still in progress
      console.log('[Completed Purchase] Map generation in progress, will notify when complete');
      
      // Send processing notification to customer
      await sendOrderProcessingEmail(orderData, job);
      
      // Set up listener for job completion (if not already set)
      setupJobCompletionListener(job, orderData);
      
    } else if (job.status === 'failed') {
      // Map generation failed
      console.error('[Completed Purchase] Map generation failed for job:', job.id);
      
      // Attempt retry or notify customer of issue
      await handleGenerationFailure(job, orderData);
    }

  } catch (error) {
    console.error('[Completed Purchase] Error:', error);
    throw error;
  }
}

/**
 * Process order creation - log and prepare for payment
 */
async function processOrderCreation(job, orderData, lineItem) {
  try {
    console.log('[Order Creation] Processing for job:', {
      jobId: job.id,
      purchaseId: job.purchaseId,
      status: job.status,
      orderName: orderData.name
    });

    // Just log the order creation - main processing happens on payment
    console.log('[Order Creation] Order created, waiting for payment confirmation');

  } catch (error) {
    console.error('[Order Creation] Error:', error);
    throw error;
  }
}

/**
 * Add map file information to Shopify order
 */
async function addMapFileToOrder(orderData, job) {
  try {
    // TODO: Implement Shopify API call to add order metafield or note
    // For now, just log the information
    console.log('[Order Update] Would add map file to order:', {
      orderId: orderData.id,
      orderName: orderData.name,
      fileName: job.fileName,
      filePath: job.filePath,
      customerId: orderData.customer?.id
    });

    // In a real implementation, this would make a Shopify Admin API call:
    // await shopifyAdminAPI.addOrderMetafield(orderData.id, {
    //   key: 'map_file_name',
    //   value: job.fileName,
    //   type: 'single_line_text_field'
    // });

  } catch (error) {
    console.error('[Order Update] Error adding map file to order:', error);
    throw error;
  }
}

/**
 * Set up listener for job completion
 */
function setupJobCompletionListener(job, orderData) {
  try {
    const backgroundJobManager = require('../services/backgroundJobManager');
    
    // Listen for job completion
    const handleJobCompletion = (completedJob) => {
      if (completedJob.id === job.id && completedJob.status === 'completed') {
        console.log('[Job Completion] Background job completed, updating order:', {
          jobId: completedJob.id,
          orderId: orderData.id
        });
        
        // Add map file to order
        addMapFileToOrder(orderData, completedJob).catch(error => {
          console.error('[Job Completion] Error updating order:', error);
        });
        
        // Send completion email
        sendOrderCompletionEmail(orderData, completedJob).catch(error => {
          console.error('[Job Completion] Error sending completion email:', error);
        });
        
        // Remove listener
        backgroundJobManager.removeListener('jobStatusChanged', handleJobCompletion);
      }
    };
    
    backgroundJobManager.on('jobStatusChanged', handleJobCompletion);
    
    console.log('[Job Completion] Listener set up for job:', job.id);

  } catch (error) {
    console.error('[Job Completion] Error setting up listener:', error);
  }
}

/**
 * Fallback map generation for backwards compatibility
 */
async function fallbackMapGeneration(lineItem, orderData, webhookTopic) {
  try {
    console.log('[Fallback Generation] Using legacy map generation for line item:', lineItem.id);
    
    // Use the existing generateHighResolutionMap function
    const properties = lineItem.properties || [];
    const purchaseId = properties.find(p => p.name === 'Purchase ID')?.value;
    const previewId = properties.find(p => p.name === 'Preview ID')?.value;
    const printSize = properties.find(p => p.name === 'Print Size')?.value || 'A4';
    const orientation = properties.find(p => p.name === 'Orientation')?.value || 'portrait';
    const mapStyle = properties.find(p => p.name === 'Map Style')?.value || 'outdoors-v12';
    const activityId = properties.find(p => p.name === 'Activity ID')?.value;
    
    // Extract map configuration from line item properties
    let mapConfiguration = null;
    const mapConfigProperty = properties.find(p => p.name === 'Map Config')?.value;
    if (mapConfigProperty) {
      try {
        mapConfiguration = JSON.parse(Buffer.from(mapConfigProperty, 'base64').toString());
      } catch (error) {
        console.warn('[Fallback Generation] Failed to decode map configuration:', error.message);
      }
    }

    const legacyJob = {
      id: `legacy_job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      purchaseId: purchaseId,
      previewId: previewId,
      orderId: orderData.id,
      orderName: orderData.name,
      lineItemId: lineItem.id,
      orderProperties: properties,
      customer: {
        id: orderData.customer?.id,
        email: orderData.customer?.email,
        firstName: orderData.customer?.first_name,
        lastName: orderData.customer?.last_name
      },
      mapConfig: {
        printSize: printSize,
        orientation: orientation,
        style: `mapbox://styles/mapbox/${mapStyle}`,
        activityId: activityId,
        configuration: mapConfiguration
      },
      webhookTopic: webhookTopic,
      status: 'queued',
      createdAt: new Date().toISOString()
    };

    if (webhookTopic === 'orders/paid') {
      await generateHighResolutionMap(legacyJob);
    }

  } catch (error) {
    console.error('[Fallback Generation] Error:', error);
    throw error;
  }
}

/**
 * Generate high-resolution map for completed order using robust multi-tier fallback
 * Uses OrderMapService for self-contained, session-independent processing
 */
async function generateHighResolutionMap(job) {
  try {
    console.log('[High-Res Generation] Starting robust generation for job:', job.id);

    // Use the new OrderMapService for reliable map generation
    const orderMapService = require('../services/orderMapService');
    
    const result = await orderMapService.generateMapFromOrder(
      { 
        id: job.orderId, 
        name: job.orderName,
        customer: job.customer
      },
      {
        id: job.lineItemId,
        properties: job.orderProperties || []
      },
      job.webhookTopic
    );

    if (!result || !result.mapPath) {
      throw new Error('OrderMapService failed to generate map');
    }

    console.log('[High-Res Generation] High-res map generated successfully:', {
      mapPath: result.mapPath,
      configSource: result.configSource,
      method: 'robust_multi_tier_fallback'
    });

    // Update job status with generated map path
    job.status = 'completed';
    job.completedAt = new Date().toISOString();
    job.mapFilePath = result.mapPath;
    job.configurationSource = result.configSource;

    // Store completion information
    const path = require('path');
    const fs = require('fs').promises;
    
    const jobFilePath = path.join(
      __dirname, '..', 'generated-maps', 'completed', 
      `${job.id}_completed.json`
    );
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(jobFilePath), { recursive: true });
    
    // Store completed job information
    await fs.writeFile(jobFilePath, JSON.stringify({
      ...job,
      mapFilePath: result.mapPath,
      generationMethod: 'robust_multi_tier_fallback',
      configurationSource: result.configSource,
      status: 'completed',
      completedAt: new Date().toISOString()
    }, null, 2));

    console.log('[High-Res Generation] Job completed and stored:', jobFilePath);

    // Send fulfillment email to customer with download link
    await sendOrderFulfillmentEmail(job, result.mapPath);

    console.log('[High-Res Generation] Order fulfilled successfully for job:', job.id);

  } catch (error) {
    console.error('[High-Res Generation] Error:', error);
    
    // Update job status to failed
    job.status = 'failed';
    job.failedAt = new Date().toISOString();
    job.error = error.message;
    
    // Store failed job for debugging
    try {
      const path = require('path');
      const fs = require('fs').promises;
      
      const failedJobPath = path.join(
        __dirname, '..', 'generated-maps', 'failed', 
        `${job.id}_failed.json`
      );
      
      await fs.mkdir(path.dirname(failedJobPath), { recursive: true });
      await fs.writeFile(failedJobPath, JSON.stringify(job, null, 2));
    } catch (storeError) {
      console.warn('[High-Res Generation] Could not store failed job:', storeError.message);
    }
    
    throw error;
  }
}


/**
 * Send order fulfillment email to customer - map ready for processing
 */
async function sendOrderFulfillmentEmail(job, mapFilePath) {
  try {
    console.log('[Order Fulfillment] Sending fulfillment email for job:', job.id);
    
    // In a production system, you would:
    // 1. Send completion notification to customer
    // 2. Update the Shopify order with fulfillment information
    // 3. Prepare map for physical printing/shipping if applicable
    
    console.log('[Order Fulfillment] Map ready for delivery:', {
      jobId: job.id,
      customerEmail: job.customer?.email || 'customer@example.com',
      mapFile: mapFilePath,
      orderNumber: job.orderName || 'N/A',
      fileSize: require('fs').existsSync(mapFilePath) ? 
        Math.round(require('fs').statSync(mapFilePath).size / 1024) + ' KB' : 'Unknown'
    });

    // TODO: Integrate with actual email service (SendGrid, AWS SES, etc.)
    // TODO: Update Shopify order status to fulfilled
    // TODO: Integrate with printing service if physical delivery is required
    
    console.log('[Order Fulfillment] Fulfillment completed for job:', job.id);
    
  } catch (error) {
    console.error('[Order Fulfillment] Error sending fulfillment email:', error);
    // Don't throw - fulfillment email failure shouldn't stop the entire process
  }
}

/**
 * Send order processing notification to customer
 */
async function sendOrderProcessingEmail(job) {
  try {
    console.log('[Email Notification] Sending processing notification for order:', job.orderName);
    
    // In a production system, implement email sending here
    // This would notify the customer that their order is being processed
    // and provide an estimated completion time
    
    console.log('[Email Notification] Processing notification would be sent to:', job.customer.email);
    console.log('[Email Notification] Message: Your custom map is being prepared and will be ready for fulfillment soon.');
    
  } catch (error) {
    console.error('[Email Notification] Error sending processing email:', error);
    // Don't throw - email failure shouldn't break the order processing
  }
}

/**
 * Send order completion email to customer
 */
async function sendOrderCompletionEmail(job) {
  try {
    console.log('[Email Notification] Sending completion email for order:', job.orderName);
    
    // In a production system, implement email sending here
    // This could use services like SendGrid, Mailgun, or AWS SES
    
    console.log('[Email Notification] Email would be sent to:', job.customer.email);
    
  } catch (error) {
    console.error('[Email Notification] Error sending email:', error);
    // Don't throw - email failure shouldn't break the order processing
  }
}

/**
 * Handle generation failure - retry or notify customer
 */
async function handleGenerationFailure(job, orderData) {
  try {
    console.log('[Generation Failure] Handling failed generation:', {
      jobId: job.id,
      purchaseId: job.purchaseId,
      retryCount: job.retryCount,
      error: job.error
    });

    const backgroundJobManager = require('../services/backgroundJobManager');
    
    if (job.retryCount < job.maxRetries) {
      // Attempt retry
      console.log('[Generation Failure] Attempting retry:', {
        jobId: job.id,
        retryCount: job.retryCount + 1,
        maxRetries: job.maxRetries
      });
      
      await backgroundJobManager.updateJobStatus(job.id, 'pending', {
        retryCount: job.retryCount + 1
      });
      
    } else {
      // Max retries reached - notify customer and support team
      console.error('[Generation Failure] Max retries reached for job:', job.id);
      
      // Send failure notification email to customer
      await sendGenerationFailureEmail(orderData, job);
      
      // Log for manual intervention
      console.error('[Generation Failure] Manual intervention required:', {
        orderId: orderData.id,
        orderName: orderData.name,
        customerEmail: orderData.customer?.email,
        jobId: job.id,
        error: job.error
      });
    }

  } catch (error) {
    console.error('[Generation Failure] Error handling failure:', error);
  }
}

/**
 * Send generation failure notification to customer
 */
async function sendGenerationFailureEmail(orderData, job) {
  try {
    console.log('[Generation Failure] Sending failure notification email:', {
      orderName: orderData.name,
      customerEmail: orderData.customer?.email,
      jobId: job.id
    });
    
    // In a production system, implement failure notification email here
    // This would inform the customer of the issue and provide next steps
    
    console.log('[Generation Failure] Failure notification would be sent to:', orderData.customer?.email);
    
  } catch (error) {
    console.error('[Generation Failure] Error sending failure email:', error);
  }
}

module.exports = router;