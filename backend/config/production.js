/**
 * Production environment configuration
 */

module.exports = {
  // Production logging
  logging: {
    level: 'info',
    format: 'combined'
  },
  
  // Production session settings
  session: {
    secure: true,
    httpOnly: true,
    sameSite: 'strict'
  },
  
  // Production CORS settings
  cors: {
    credentials: true,
    optionsSuccessStatus: 200
  },
  
  // Production Puppeteer settings
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ]
  },
  
  // Production map export settings
  mapExport: {
    timeout: 30000,
    quality: 300
  },
  
  // Production storage settings
  storage: {
    cleanupInterval: 3600000 // 1 hour
  }
};