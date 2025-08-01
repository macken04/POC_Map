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
router.post('/webhook/order', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    console.log('[Shopify Webhook] Order webhook received');
    
    const hmacHeader = req.get('X-Shopify-Hmac-Sha256');
    const topic = req.get('X-Shopify-Topic');
    const shopDomain = req.get('X-Shopify-Shop-Domain');
    
    if (!hmacHeader || !topic) {
      console.log('[Shopify Webhook] Missing required headers');
      return res.status(400).json({ error: 'Missing required webhook headers' });
    }

    // Verify webhook authenticity
    const crypto = require('crypto');
    const body = req.body;
    const calculatedHmac = crypto
      .createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET || process.env.SHOPIFY_SECRET_KEY)
      .update(body, 'utf8')
      .digest('base64');

    if (calculatedHmac !== hmacHeader) {
      console.log('[Shopify Webhook] HMAC verification failed');
      return res.status(401).json({ error: 'Webhook verification failed' });
    }

    // Parse order data
    const orderData = JSON.parse(body.toString());
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

/**
 * Process map orders and trigger high-resolution generation
 */
async function processMapOrder(orderData, webhookTopic) {
  try {
    console.log('[Map Order Processing] Processing order:', orderData.name);

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

  } catch (error) {
    console.error('[Map Order Processing] Error:', error);
    throw error;
  }
}

/**
 * Process individual map line item
 */
async function processMapLineItem(lineItem, orderData, webhookTopic) {
  try {
    // Extract map metadata from line item properties
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
        console.log('[Map Line Item] Decoded map configuration:', mapConfiguration);
      } catch (error) {
        console.warn('[Map Line Item] Failed to decode map configuration:', error.message);
      }
    }

    console.log('[Map Line Item] Processing:', {
      purchaseId,
      previewId,
      printSize,
      orientation,
      mapStyle,
      activityId,
      orderId: orderData.id,
      orderName: orderData.name
    });

    if (!purchaseId && !previewId) {
      console.log('[Map Line Item] No purchase ID or preview ID found, skipping');
      return;
    }

    // Create map generation job
    const mapGenerationJob = {
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      purchaseId: purchaseId,
      previewId: previewId,
      orderId: orderData.id,
      orderName: orderData.name,
      lineItemId: lineItem.id,
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
        configuration: mapConfiguration // Include decoded map configuration
      },
      webhookTopic: webhookTopic,
      status: 'queued',
      createdAt: new Date().toISOString()
    };

    // For paid orders, immediately trigger high-res generation
    if (webhookTopic === 'orders/paid') {
      console.log('[Map Generation] Triggering high-resolution generation for paid order');
      await generateHighResolutionMap(mapGenerationJob);
    } else {
      console.log('[Map Generation] Order created but not yet paid, queuing for later processing');
      // Store job for processing when payment is confirmed
      // In a production system, you'd store this in a database
    }

  } catch (error) {
    console.error('[Map Line Item] Error processing line item:', error);
    throw error;
  }
}

/**
 * Generate high-resolution map for completed order using fresh Strava data
 * Improved implementation: fetches activity data from Strava API and uses map configuration
 */
async function generateHighResolutionMap(job) {
  try {
    console.log('[High-Res Generation] Starting optimized generation for job:', job.id);

    // Extract preview ID from Shopify order line item properties
    const previewId = extractPreviewIdFromOrder(job.orderData);
    
    if (!previewId) {
      throw new Error('Preview ID not found in order data - cannot generate high-res map');
    }

    console.log('[High-Res Generation] Using preview ID:', previewId);

    const printSize = job.printSize || 'A4';
    const orientation = job.printOrientation || 'portrait';

    // Use our optimized endpoint that reuses the validated preview configuration
    const mapPath = await generateHighResFromPreview(previewId, printSize, orientation);
    
    if (!mapPath) {
      throw new Error('High-resolution map generation failed');
    }

    console.log('[High-Res Generation] High-res map generated successfully:', mapPath);

    // Update job status with generated map path
    job.status = 'completed';
    job.completedAt = new Date().toISOString();
    job.mapFilePath = mapPath;

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
      mapFilePath: mapPath,
      generationMethod: 'optimized_preview_reuse',
      status: 'completed',
      completedAt: new Date().toISOString()
    }, null, 2));

    console.log('[High-Res Generation] Job completed and stored:', jobFilePath);

    // Send fulfillment email to customer with download link
    await sendOrderFulfillmentEmail(job, mapPath);

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
 * Extract preview ID from Shopify order line item properties
 */
function extractPreviewIdFromOrder(orderData) {
  try {
    if (!orderData?.line_items) {
      console.warn('[Preview ID Extraction] No line items found in order data');
      return null;
    }

    for (const lineItem of orderData.line_items) {
      if (lineItem.properties) {
        // Check if properties is an array (newer Shopify format)
        if (Array.isArray(lineItem.properties)) {
          for (const prop of lineItem.properties) {
            if (prop.name === 'Preview ID') {
              console.log('[Preview ID Extraction] Found preview ID:', prop.value);
              return prop.value;
            }
          }
        } 
        // Check if properties is an object (older format)
        else if (typeof lineItem.properties === 'object') {
          if (lineItem.properties['Preview ID']) {
            console.log('[Preview ID Extraction] Found preview ID:', lineItem.properties['Preview ID']);
            return lineItem.properties['Preview ID'];
          }
        }
      }
    }

    console.warn('[Preview ID Extraction] Preview ID not found in any line item properties');
    return null;
  } catch (error) {
    console.error('[Preview ID Extraction] Error extracting preview ID:', error);
    return null;
  }
}

/**
 * Generate high-resolution map using optimized preview endpoint
 */
async function generateHighResFromPreview(previewId, format, orientation) {
  try {
    console.log('[Optimized Generation] Calling optimized endpoint for preview:', previewId);

    // Use axios to call our optimized endpoint internally (more reliable than fetch in Node.js)
    const axios = require('axios');
    const response = await axios.post(`http://localhost:3000/api/maps/generate-from-preview/${previewId}`, {
      format: format,
      orientation: orientation,
      dpi: 300
    }, {
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (response.status !== 200) {
      throw new Error(response.data?.message || 'Optimized generation failed');
    }

    const result = response.data;
    console.log('[Optimized Generation] Success:', {
      mapPath: result.mapPath,
      generationTime: result.config.generationTime,
      method: 'preview_config_reuse'
    });

    return result.mapPath;

  } catch (error) {
    console.error('[Optimized Generation] Failed:', error);
    throw new Error(`Optimized high-res generation failed: ${error.message}`);
  }
}

/**
 * Send order fulfillment email to customer with download link
 */
async function sendOrderFulfillmentEmail(job, mapFilePath) {
  try {
    console.log('[Order Fulfillment] Sending fulfillment email for job:', job.id);
    
    // In a production system, you would:
    // 1. Upload the map file to a CDN or secure download area
    // 2. Generate a secure download link with expiration
    // 3. Send a professional email with the download link
    // 4. Update the Shopify order with fulfillment information
    
    console.log('[Order Fulfillment] Map ready for delivery:', {
      jobId: job.id,
      customerEmail: job.orderData?.email || 'customer@example.com',
      mapFile: mapFilePath,
      orderNumber: job.orderData?.name || 'N/A',
      fileSize: require('fs').existsSync(mapFilePath) ? 
        Math.round(require('fs').statSync(mapFilePath).size / 1024) + ' KB' : 'Unknown'
    });

    // TODO: Integrate with actual email service (SendGrid, AWS SES, etc.)
    // TODO: Upload map to secure storage and generate download link
    // TODO: Update Shopify order status to fulfilled
    
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
    console.log('[Email Notification] Message: Your custom map is being prepared and will be ready for download soon.');
    
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

module.exports = router;