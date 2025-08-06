/**
 * Shopify Order Update Service
 * 
 * Handles updating Shopify orders with map file information
 * and managing order fulfillment for completed maps.
 */

const path = require('path');

class OrderUpdateService {
  constructor() {
    this.shopifyConfig = null;
    this.initialized = false;
  }

  /**
   * Initialize the service with Shopify configuration
   */
  async initialize() {
    if (this.initialized) return;

    try {
      const config = require('../config');
      this.shopifyConfig = config.getConfig().shopify;
      
      if (!this.shopifyConfig) {
        throw new Error('Shopify configuration not found');
      }

      this.initialized = true;
      console.log('[OrderUpdateService] Service initialized successfully');
    } catch (error) {
      console.error('[OrderUpdateService] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Add map file information to Shopify order
   * This will add the map filename as an order metafield
   */
  async addMapFileToOrder(orderId, job, orderData = null) {
    await this.initialize();

    try {
      console.log('[OrderUpdateService] Adding map file to order:', {
        orderId,
        jobId: job.id,
        fileName: job.fileName,
        filePath: job.filePath
      });

      // Create metafield data
      const metafieldData = {
        key: 'map_file_name',
        value: job.fileName,
        type: 'single_line_text_field',
        namespace: 'custom_maps'
      };

      // TODO: Implement actual Shopify Admin API call
      // For now, we'll simulate the API call and log the action
      
      const mockApiResponse = await this.mockShopifyApiCall('POST', `/orders/${orderId}/metafields`, {
        metafield: metafieldData
      });

      console.log('[OrderUpdateService] Map file metafield added successfully:', {
        orderId,
        metafieldId: mockApiResponse.id,
        key: metafieldData.key,
        value: metafieldData.value
      });

      // Add order note with map completion information
      await this.addOrderNote(orderId, job, orderData);

      return {
        success: true,
        mapFileMetafield: mockApiResponse
      };

    } catch (error) {
      console.error('[OrderUpdateService] Error adding map file to order:', error);
      throw new Error(`Failed to update order ${orderId}: ${error.message}`);
    }
  }

  /**
   * Add an order note with map completion information
   */
  async addOrderNote(orderId, job, orderData = null) {
    try {
      const noteText = `🗺️ Custom Map Generated Successfully

Map File: ${job.fileName}
Local File Path: ${job.filePath}
Generation Time: ${new Date(job.completedAt).toLocaleString()}
Print Size: ${job.printSize || 'A4'}
Orientation: ${job.orientation || 'portrait'}

The customer's high-resolution map has been saved locally and is ready for fulfillment.
Map generation job ID: ${job.id}`;

      const noteData = {
        note: {
          body: noteText,
          author: 'Map Generation System'
        }
      };

      // TODO: Implement actual Shopify Admin API call for order notes
      const mockNoteResponse = await this.mockShopifyApiCall('POST', `/orders/${orderId}/notes`, noteData);

      console.log('[OrderUpdateService] Order note added successfully:', {
        orderId,
        noteId: mockNoteResponse.id,
        noteLength: noteText.length
      });

      return mockNoteResponse;

    } catch (error) {
      console.error('[OrderUpdateService] Error adding order note:', error);
      throw error;
    }
  }

  /**
   * Update order fulfillment status
   */
  async fulfillOrder(orderId, job, orderData = null) {
    try {
      console.log('[OrderUpdateService] Fulfilling order with map completion:', {
        orderId,
        jobId: job.id
      });

      const fulfillmentData = {
        fulfillment: {
          location_id: null, // Digital fulfillment
          tracking_number: job.id, // Use job ID as tracking reference
          tracking_company: 'Custom Maps - Local Processing',
          notify_customer: true,
          line_items: [
            {
              id: orderData?.line_items?.[0]?.id, // First line item ID
              quantity: 1
            }
          ]
        }
      };

      // TODO: Implement actual Shopify Admin API call for fulfillment
      const mockFulfillmentResponse = await this.mockShopifyApiCall('POST', `/orders/${orderId}/fulfillments`, fulfillmentData);

      console.log('[OrderUpdateService] Order fulfilled successfully:', {
        orderId,
        fulfillmentId: mockFulfillmentResponse.id,
        trackingNumber: job.id
      });

      return mockFulfillmentResponse;

    } catch (error) {
      console.error('[OrderUpdateService] Error fulfilling order:', error);
      throw error;
    }
  }


  /**
   * Get order metafields
   */
  async getOrderMetafields(orderId, namespace = 'custom_maps') {
    await this.initialize();

    try {
      // TODO: Implement actual Shopify Admin API call
      const mockMetafields = await this.mockShopifyApiCall('GET', `/orders/${orderId}/metafields`, {
        namespace: namespace
      });

      console.log('[OrderUpdateService] Retrieved order metafields:', {
        orderId,
        namespace,
        count: mockMetafields.length
      });

      return mockMetafields;

    } catch (error) {
      console.error('[OrderUpdateService] Error getting order metafields:', error);
      throw error;
    }
  }

  /**
   * Check if order already has map file information
   */
  async orderHasMapFile(orderId) {
    try {
      const metafields = await this.getOrderMetafields(orderId);
      return metafields.some(field => field.key === 'map_file_name');
    } catch (error) {
      console.warn('[OrderUpdateService] Could not check order metafields:', error);
      return false;
    }
  }

  /**
   * Mock Shopify API call for development/testing
   * In production, this would be replaced with actual Shopify Admin API calls
   */
  async mockShopifyApiCall(method, endpoint, data = null) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockResponse = {
          id: Math.floor(Math.random() * 1000000),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          method: method,
          endpoint: endpoint,
          data: data,
          status: 'success'
        };

        console.log('[OrderUpdateService] Mock Shopify API Call:', {
          method,
          endpoint,
          responseId: mockResponse.id,
          status: 'success'
        });

        resolve(mockResponse);
      }, 100); // Simulate API delay
    });
  }

  /**
   * Real Shopify Admin API implementation (for production)
   * Uncomment and configure when ready to use actual Shopify API
   */
  /*
  async makeShopifyApiCall(method, endpoint, data = null) {
    await this.initialize();

    const shopifyDomain = this.shopifyConfig.storeUrl.replace('https://', '').replace('http://', '');
    const apiUrl = `https://${shopifyDomain}/admin/api/2023-10/orders${endpoint}`;

    const headers = {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': this.shopifyConfig.accessToken
    };

    const options = {
      method: method,
      headers: headers
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(apiUrl, options);
      
      if (!response.ok) {
        throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[OrderUpdateService] Shopify API call failed:', error);
      throw error;
    }
  }
  */

  /**
   * Get service statistics
   */
  getStats() {
    return {
      initialized: this.initialized,
      shopifyConfigured: !!this.shopifyConfig,
      storeUrl: this.shopifyConfig?.storeUrl || null
    };
  }
}

// Export singleton instance
module.exports = new OrderUpdateService();