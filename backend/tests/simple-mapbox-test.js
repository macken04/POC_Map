/**
 * Simple Mapbox Connectivity Test
 * Tests basic Mapbox API connectivity and token validation
 */

const https = require('https');
const config = require('../config');

class SimpleMapboxTest {
  constructor() {
    this.config = config.getConfig();
  }

  /**
   * Test Mapbox API token validity
   */
  async testMapboxToken() {
    return new Promise((resolve) => {
      const token = this.config.mapbox.accessToken;
      
      if (!token || !token.startsWith('pk.')) {
        resolve({
          success: false,
          error: 'Invalid token format',
          details: { hasToken: !!token, validFormat: false }
        });
        return;
      }

      // Test token by making a simple API call
      const url = `https://api.mapbox.com/tokens/v2?access_token=${token}`;
      
      const req = https.get(url, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const tokenInfo = JSON.parse(data);
              resolve({
                success: true,
                details: {
                  tokenValid: true,
                  scopes: tokenInfo.scopes || [],
                  usage: tokenInfo.usage || 'unknown'
                }
              });
            } catch (e) {
              resolve({
                success: false,
                error: 'Invalid JSON response',
                details: { statusCode: res.statusCode, data }
              });
            }
          } else {
            resolve({
              success: false,
              error: `HTTP ${res.statusCode}`,
              details: { statusCode: res.statusCode, data }
            });
          }
        });
      });

      req.on('error', (error) => {
        resolve({
          success: false,
          error: 'Network error',
          details: { error: error.message }
        });
      });

      req.setTimeout(10000, () => {
        req.abort();
        resolve({
          success: false,
          error: 'Request timeout',
          details: { timeout: '10s' }
        });
      });
    });
  }

  /**
   * Test Mapbox GL JS CDN availability
   */
  async testMapboxCDN() {
    return new Promise((resolve) => {
      const url = 'https://api.mapbox.com/mapbox-gl-js/v3.13.0/mapbox-gl.js';
      
      const req = https.get(url, (res) => {
        if (res.statusCode === 200) {
          resolve({
            success: true,
            details: { 
              statusCode: res.statusCode,
              contentLength: res.headers['content-length']
            }
          });
        } else {
          resolve({
            success: false,
            error: `HTTP ${res.statusCode}`,
            details: { statusCode: res.statusCode }
          });
        }
        
        // Don't need to download the full file, just check availability
        req.abort();
      });

      req.on('error', (error) => {
        resolve({
          success: false,
          error: 'Network error',
          details: { error: error.message }
        });
      });

      req.setTimeout(10000, () => {
        req.abort();
        resolve({
          success: false,
          error: 'Request timeout',
          details: { timeout: '10s' }
        });
      });
    });
  }

  /**
   * Run all simple tests
   */
  async runAllTests() {
    console.log('🧪 Starting Simple Mapbox Connectivity Tests...\n');

    console.log('1. Testing Mapbox Token Validity...');
    const tokenResult = await this.testMapboxToken();
    console.log(tokenResult.success ? '✅ Token Valid' : '❌ Token Invalid');
    if (!tokenResult.success) {
      console.error('Token Error:', tokenResult.error);
      console.error('Details:', tokenResult.details);
    } else {
      console.log('Token Details:', tokenResult.details);
    }

    console.log('\n2. Testing Mapbox CDN Availability...');
    const cdnResult = await this.testMapboxCDN();
    console.log(cdnResult.success ? '✅ CDN Available' : '❌ CDN Unavailable');
    if (!cdnResult.success) {
      console.error('CDN Error:', cdnResult.error);
      console.error('Details:', cdnResult.details);
    }

    const allTestsPass = tokenResult.success && cdnResult.success;
    
    console.log('\n📊 Simple Test Results:');
    console.log(`Token Test: ${tokenResult.success ? 'PASS' : 'FAIL'}`);
    console.log(`CDN Test: ${cdnResult.success ? 'PASS' : 'FAIL'}`);
    console.log(`Overall: ${allTestsPass ? '✅ PASS' : '❌ FAIL'}`);

    return {
      success: allTestsPass,
      tokenResult,
      cdnResult
    };
  }
}

// Export test class
module.exports = SimpleMapboxTest;

// Run tests if this file is executed directly
if (require.main === module) {
  const test = new SimpleMapboxTest();
  test.runAllTests()
    .then(summary => {
      process.exit(summary.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test runner failed:', error);
      process.exit(1);
    });
}