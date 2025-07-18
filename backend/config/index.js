/**
 * Configuration loader for different environments
 * Loads and validates environment variables
 */

const path = require('path');
const fs = require('fs');
const { validateAndThrow } = require('../utils/envValidator');

// Load environment variables
require('dotenv').config();

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
      maxAge: parseInt(process.env.SESSION_MAX_AGE) || 86400000, // 24 hours
      secure: env === 'production'
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
      redirectUri: process.env.STRAVA_REDIRECT_URI
    },
    
    mapbox: {
      accessToken: process.env.MAPBOX_ACCESS_TOKEN
    },
    
    shopify: {
      apiKey: process.env.SHOPIFY_API_KEY,
      secretKey: process.env.SHOPIFY_SECRET_KEY,
      storeUrl: process.env.SHOPIFY_STORE_URL,
      webhookSecret: process.env.SHOPIFY_WEBHOOK_SECRET
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

module.exports = {
  getConfig,
  getSanitizedConfig,
  get,
  isEnvironment
};