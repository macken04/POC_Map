/**
 * Test environment configuration
 */

module.exports = {
  // Test logging
  logging: {
    level: 'error', // Minimal logging in tests
    format: 'dev'
  },
  
  // Test session settings
  session: {
    secure: false,
    httpOnly: true,
    maxAge: 3600000 // 1 hour for tests
  },
  
  // Test CORS settings
  cors: {
    credentials: true,
    optionsSuccessStatus: 200
  },
  
  // Test Puppeteer settings
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  },
  
  // Test map export settings
  mapExport: {
    timeout: 10000,  // Shorter timeout for tests
    quality: 72      // Lower quality for faster tests
  },
  
  // Test storage settings
  storage: {
    cleanupInterval: 60000, // 1 minute for tests
    generatedMapsDir: 'test-maps'
  }
};