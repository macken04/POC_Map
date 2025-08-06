/**
 * Configuration loader for different environments
 * Loads and validates environment variables
 */

const path = require('path');
const fs = require('fs');
const { validateAndThrow } = require('../utils/envValidator');

// Load environment variables from project root
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

/**
 * Get configuration for the current environment
 */
function getConfig() {
  const env = process.env.NODE_ENV || 'development';
  
  // Validate environment variables
  validateAndThrow(env);

  const baseConfig = {
    // Server configuration
    env: env,
    port: parseInt(process.env.PORT) || 3000,
    host: process.env.HOST || 'localhost',
    
    // Session configuration
    session: {
      secret: process.env.SESSION_SECRET,
      name: process.env.SESSION_NAME || 'connect.sid',
      // Enhanced security settings
      rolling: true, // Reset expiration on activity
      saveUninitialized: false,
      resave: false,
      // Cookie settings optimized for cross-domain Shopify integration
      cookie: {
        secure: env === 'production' || process.env.NGROK_URL?.includes('https'),
        httpOnly: true,
        maxAge: parseInt(process.env.SESSION_MAX_AGE) || 86400000, // 24 hours
        // Use 'none' for cross-domain requests with HTTPS (ngrok)
        // Use 'lax' for local development without HTTPS
        sameSite: (env === 'production' || process.env.NGROK_URL?.includes('https')) ? 'none' : 'lax',
        // Set domain to null to work across subdomains
        domain: process.env.SESSION_DOMAIN || null
      }
    },
    
    // Security configuration
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true
    },
    
    // API configuration
    strava: {
      clientId: process.env.STRAVA_CLIENT_ID,
      clientSecret: process.env.STRAVA_CLIENT_SECRET,
      redirectUri: process.env.STRAVA_REDIRECT_URI || `${process.env.NGROK_URL}/auth/strava/callback`
    },
    
    mapbox: {
      accessToken: process.env.MAPBOX_ACCESS_TOKEN
    },
    
    shopify: {
      apiKey: process.env.SHOPIFY_API_KEY,
      secretKey: process.env.SHOPIFY_SECRET_KEY,
      accessToken: process.env.SHOPIFY_ACCESS_TOKEN,
      storeUrl: process.env.SHOPIFY_STORE_URL,
      webhookSecret: process.env.SHOPIFY_WEBHOOK_SECRET,
      productVariantIds: {
        A4: process.env.SHOPIFY_PRODUCT_VARIANT_ID_A4,
        A3: process.env.SHOPIFY_PRODUCT_VARIANT_ID_A3
      }
    },
    
    // File storage configuration
    storage: {
      generatedMapsDir: path.join(__dirname, '..', process.env.GENERATED_MAPS_DIR || 'generated-maps'),
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760, // 10MB
      cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL) || 3600000 // 1 hour
    },
    
    // Logging configuration
    logging: {
      level: process.env.LOG_LEVEL || 'info',
      format: process.env.LOG_FORMAT || 'combined'
    },
    
    // Development configuration
    development: {
      ngrokUrl: process.env.NGROK_URL,
      debug: process.env.DEBUG
    },
    
    // Puppeteer configuration
    puppeteer: {
      headless: process.env.PUPPETEER_HEADLESS !== 'false',
      args: process.env.PUPPETEER_ARGS?.split(',') || ['--no-sandbox', '--disable-setuid-sandbox']
    },
    
    // Map export configuration
    mapExport: {
      timeout: parseInt(process.env.MAP_EXPORT_TIMEOUT) || 30000,
      quality: parseInt(process.env.MAP_QUALITY) || 300,
      format: process.env.MAP_FORMAT || 'png'
    },
    
    // Cache configuration
    cache: {
      enabled: process.env.CACHE_ENABLED !== 'false',
      maxSize: parseInt(process.env.CACHE_MAX_SIZE) || 1000,
      cleanupInterval: parseInt(process.env.CACHE_CLEANUP_INTERVAL) || 5 * 60 * 1000, // 5 minutes
      compression: process.env.CACHE_COMPRESSION !== 'false',
      warmupEnabled: process.env.CACHE_WARMUP_ENABLED !== 'false',
      ttl: {
        activities: parseInt(process.env.CACHE_TTL_ACTIVITIES) || 5 * 60 * 1000,        // 5 minutes
        activityDetails: parseInt(process.env.CACHE_TTL_ACTIVITY_DETAILS) || 60 * 60 * 1000, // 1 hour  
        activityStreams: parseInt(process.env.CACHE_TTL_ACTIVITY_STREAMS) || 24 * 60 * 60 * 1000, // 24 hours
        athlete: parseInt(process.env.CACHE_TTL_ATHLETE) || 15 * 60 * 1000             // 15 minutes
      }
    }
  };

  // Load environment-specific configuration
  const envConfigPath = path.join(__dirname, `${env}.js`);
  let envConfig = {};
  
  if (fs.existsSync(envConfigPath)) {
    envConfig = require(envConfigPath);
  }

  // Merge base config with environment-specific config
  // Use deep merge to preserve nested objects
  const config = deepMerge(baseConfig, envConfig);
  
  return config;
}

/**
 * Deep merge two objects
 */
function deepMerge(target, source) {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
}

/**
 * Get configuration value by path (e.g., 'session.secret')
 */
function get(path) {
  const config = getConfig();
  return path.split('.').reduce((obj, key) => obj?.[key], config);
}

/**
 * Get a sanitized version of the config without secrets
 */
function getSanitizedConfig() {
  const config = getConfig();
  
  // Create a deep copy and remove sensitive data
  const sanitized = JSON.parse(JSON.stringify(config));
  
  // Remove secrets
  if (sanitized.session?.secret) {
    sanitized.session.secret = '[HIDDEN]';
  }
  if (sanitized.strava?.clientSecret) {
    sanitized.strava.clientSecret = '[HIDDEN]';
  }
  if (sanitized.mapbox?.accessToken) {
    sanitized.mapbox.accessToken = '[HIDDEN]';
  }
  if (sanitized.shopify?.secretKey) {
    sanitized.shopify.secretKey = '[HIDDEN]';
  }
  if (sanitized.shopify?.webhookSecret) {
    sanitized.shopify.webhookSecret = '[HIDDEN]';
  }
  
  return sanitized;
}

/**
 * Check if we're in a specific environment
 */
function isEnvironment(env) {
  return process.env.NODE_ENV === env;
}

/**
 * Refresh configuration by reloading environment variables
 * Useful when ngrok URL or other dynamic values change
 */
function refreshConfig() {
  // Re-load environment variables from project root .env file
  require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
  
  // Clear require cache for environment-specific configs
  const env = process.env.NODE_ENV || 'development';
  const envConfigPath = path.join(__dirname, `${env}.js`);
  
  if (require.cache[envConfigPath]) {
    delete require.cache[envConfigPath];
  }
  
  return getConfig();
}

/**
 * Get current ngrok URL from environment
 * Returns null if not available or if it's a test URL
 */
function getNgrokUrl() {
  const ngrokUrl = process.env.NGROK_URL;
  
  if (!ngrokUrl || ngrokUrl.includes('test-ngrok-url')) {
    return null;
  }
  
  return ngrokUrl;
}

/**
 * Check if ngrok is properly configured
 */
function isNgrokConfigured() {
  const ngrokUrl = getNgrokUrl();
  return ngrokUrl !== null && (ngrokUrl.includes('ngrok.io') || ngrokUrl.includes('ngrok-free.app'));
}

/**
 * Validate Mapbox access token by making a test API call
 * @returns {Promise<Object>} - Validation result with success flag and details
 */
async function validateMapboxToken() {
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  
  if (!token) {
    return {
      success: false,
      error: 'No Mapbox access token provided'
    };
  }

  if (!token.startsWith('pk.')) {
    return {
      success: false,
      error: 'Invalid Mapbox token format. Public tokens should start with "pk."'
    };
  }

  try {
    // Test token by making a simple API call to Mapbox Geocoding API
    const https = require('https');
    const testUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/test.json?access_token=${token}&limit=1`;
    
    return new Promise((resolve) => {
      const req = https.get(testUrl, (res) => {
        if (res.statusCode === 200) {
          resolve({
            success: true,
            message: 'Mapbox token is valid and working'
          });
        } else if (res.statusCode === 401) {
          resolve({
            success: false,
            error: 'Mapbox token is invalid or expired'
          });
        } else {
          resolve({
            success: false,
            error: `Mapbox API returned status ${res.statusCode}`
          });
        }
      });
      
      req.on('error', (error) => {
        resolve({
          success: false,
          error: `Failed to validate Mapbox token: ${error.message}`
        });
      });
      
      req.setTimeout(5000, () => {
        req.destroy();
        resolve({
          success: false,
          error: 'Mapbox token validation timeout'
        });
      });
    });
  } catch (error) {
    return {
      success: false,
      error: `Token validation error: ${error.message}`
    };
  }
}

module.exports = {
  getConfig,
  getSanitizedConfig,
  get,
  isEnvironment,
  refreshConfig,
  getNgrokUrl,
  isNgrokConfigured,
  validateMapboxToken
};