const express = require('express');
const path = require('path');
const session = require('express-session');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const config = require('./config');
const sessionSecurity = require('./middleware/sessionSecurity');

const app = express();
const appConfig = config.getConfig();

// Middleware order is important for proper functionality
// 1. Security headers first
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://api.mapbox.com"],
      scriptSrc: ["'self'", "https://api.mapbox.com"],
      imgSrc: ["'self'", "data:", "https://api.mapbox.com", "https://**.tiles.mapbox.com"],
      connectSrc: ["'self'", "https://api.mapbox.com", "https://events.mapbox.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false // Required for Mapbox GL JS
}));

// 2. Request logging
app.use(morgan(appConfig.logging.format));

// 3. Response compression
app.use(compression());

// 4. CORS configuration
app.use(cors({
  origin: appConfig.cors.allowedOrigins,
  credentials: true
}));

// 5. Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 6. Cookie parsing
app.use(cookieParser());

// 7. Session configuration with enhanced security
app.use(session({
  secret: appConfig.session.secret,
  resave: appConfig.session.resave,
  saveUninitialized: appConfig.session.saveUninitialized,
  rolling: appConfig.session.rolling,
  name: appConfig.session.name,
  cookie: appConfig.session.cookie
}));

// 8. Session security middleware
app.use(sessionSecurity.getAllMiddleware());

// Static files
app.use('/generated-maps', express.static(appConfig.storage.generatedMapsDir));

// Health check endpoint
app.get('/health', (req, res) => {
  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: appConfig.env,
    version: require('./package.json').version,
    memory: process.memoryUsage(),
    checks: {
      server: 'ok',
      config: 'ok',
      storage: require('fs').existsSync(appConfig.storage.generatedMapsDir) ? 'ok' : 'error'
    }
  };
  
  const hasErrors = Object.values(healthStatus.checks).includes('error');
  const statusCode = hasErrors ? 503 : 200;
  
  res.status(statusCode).json(healthStatus);
});

// Import route modules
const authRoutes = require('./routes/auth');
const stravaRoutes = require('./routes/strava');
const mapRoutes = require('./routes/maps');

// Mount routes
app.use('/auth', authRoutes);
app.use('/api/strava', stravaRoutes);
app.use('/api/maps', mapRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Map Printing Backend Server is running!',
    environment: appConfig.env,
    port: appConfig.port,
    endpoints: {
      health: '/health',
      config: '/config',
      auth: '/auth',
      strava: '/api/strava',
      maps: '/api/maps'
    }
  });
});

// Configuration endpoint (non-sensitive values only)
app.get('/config', (req, res) => {
  res.json({
    environment: appConfig.env,
    port: appConfig.port,
    corsOrigin: appConfig.cors.origin,
    mapExportTimeout: appConfig.mapExport.timeout,
    mapQuality: appConfig.mapExport.quality,
    storageCleanupInterval: appConfig.storage.cleanupInterval,
    loggingLevel: appConfig.logging.level
  });
});

// Dynamic ngrok URL endpoint for frontend access
app.get('/api/ngrok-url', (req, res) => {
  try {
    const ngrokUrl = process.env.NGROK_URL || appConfig.development?.ngrokUrl;
    
    if (!ngrokUrl || ngrokUrl.includes('test-ngrok-url')) {
      return res.status(503).json({
        error: 'ngrok URL not available',
        message: 'No valid ngrok tunnel URL found. Make sure ngrok is running and URL has been captured.',
        available: false
      });
    }
    
    res.json({
      ngrokUrl: ngrokUrl,
      available: true,
      timestamp: new Date().toISOString(),
      callbackUrl: `${ngrokUrl}/auth/strava/callback`
    });
    
  } catch (error) {
    console.error('Error retrieving ngrok URL:', error);
    res.status(500).json({
      error: 'Failed to retrieve ngrok URL',
      message: 'An error occurred while fetching the current tunnel URL',
      available: false
    });
  }
});

// Shopify integration test endpoint
app.get('/api/test-shopify', (req, res) => {
  try {
    const ngrokUrl = process.env.NGROK_URL || appConfig.development?.ngrokUrl;
    const origin = req.get('Origin') || req.get('Referer');
    
    res.json({
      success: true,
      message: 'Shopify integration test successful',
      timestamp: new Date().toISOString(),
      environment: appConfig.env,
      server: {
        port: appConfig.port,
        host: appConfig.host,
        uptime: process.uptime()
      },
      ngrok: {
        url: ngrokUrl,
        available: !!(ngrokUrl && !ngrokUrl.includes('test-ngrok-url'))
      },
      cors: {
        origin: origin,
        allowedOrigins: appConfig.cors.allowedOrigins,
        corsEnabled: true
      },
      shopify: {
        storeUrl: appConfig.shopify.storeUrl,
        integrationReady: true
      },
      headers: {
        'X-Test-Source': 'shopify-integration-test',
        'X-Backend-Status': 'operational'
      }
    });
    
  } catch (error) {
    console.error('Shopify test endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Shopify integration test failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Error handling middleware
app.use((req, res, next) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.path,
    method: req.method
  });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  
  // Don't leak error details in production
  const errorResponse = {
    error: appConfig.env === 'production' ? 'Internal server error' : err.message,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method
  };
  
  res.status(err.status || 500).json(errorResponse);
});

// Start server with graceful shutdown
const server = app.listen(appConfig.port, () => {
  console.log(`Server running on port ${appConfig.port} in ${appConfig.env} mode`);
  console.log(`Configuration loaded successfully`);
  console.log(`Health check available at: http://localhost:${appConfig.port}/health`);
  
  // Create storage directory if it doesn't exist
  const fs = require('fs');
  if (!fs.existsSync(appConfig.storage.generatedMapsDir)) {
    fs.mkdirSync(appConfig.storage.generatedMapsDir, { recursive: true });
    console.log(`Created storage directory: ${appConfig.storage.generatedMapsDir}`);
  }
});

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
  
  server.close((err) => {
    if (err) {
      console.error('Error during server shutdown:', err);
      process.exit(1);
    }
    
    console.log('Server closed successfully');
    
    // Clean up any resources here
    // Close database connections, clear timers, etc.
    
    console.log('Graceful shutdown completed');
    process.exit(0);
  });
  
  // Force close server after 10 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

module.exports = app;