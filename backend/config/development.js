/**
 * Development environment configuration
 */

module.exports = {
  // Development-specific logging
  logging: {
    level: 'debug',
    format: 'dev'
  },
  
  // Development session settings
  session: {
    secure: false,
    httpOnly: true
  },
  
  // Development CORS settings
  cors: {
    credentials: true,
    optionsSuccessStatus: 200
  },
  
  // Development Puppeteer settings
  puppeteer: {
    headless: false, // Show browser in development
    slowMo: 250,     // Slow down for debugging
    devtools: true   // Open devtools
  },
  
  // Development map export settings
  mapExport: {
    timeout: 60000,  // Longer timeout for development
    quality: 150     // Lower quality for faster development
  },
  
  // Development storage settings
  storage: {
    cleanupInterval: 300000 // 5 minutes for development
  }
};