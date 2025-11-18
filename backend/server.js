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
const ProgressService = require('./services/progressService');

const app = express();
const appConfig = config.getConfig();

// Middleware order is important for proper functionality
// 1. Security headers first
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://api.mapbox.com", "https://cdn.shopify.com", "https://fonts.shopify.com"],
      scriptSrc: ["'self'", "https://api.mapbox.com", "https://cdn.shopify.com", "https://monorail-edge.shopifysvc.com"],
      imgSrc: ["'self'", "data:", "https://api.mapbox.com", "https://**.tiles.mapbox.com", "https://cdn.shopify.com"],
      connectSrc: ["'self'", "https://api.mapbox.com", "https://events.mapbox.com", "https://monorail-edge.shopifysvc.com", "https://cdn.shopify.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://fonts.shopify.com", "https://cdn.shopify.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'", "https://print-my-ride-version-5.myshopify.com"]
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
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if the origin is in our allowed list
    if (appConfig.cors.allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // For development, also check localhost variants
    if (appConfig.env === 'development') {
      const localhostVariants = [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'https://localhost:3000',
        'https://127.0.0.1:3000'
      ];
      if (localhostVariants.includes(origin)) {
        return callback(null, true);
      }
    }
    
    // Allow Shopify CDN and checkout domains
    const shopifyDomains = [
      'https://cdn.shopify.com',
      'https://fonts.shopify.com',
      'https://monorail-edge.shopifysvc.com',
      'https://checkout.shopify.com'
    ];
    
    if (shopifyDomains.some(domain => origin?.startsWith(domain))) {
      return callback(null, true);
    }
    
    console.warn('CORS blocked origin:', origin, 'Allowed origins:', appConfig.cors.allowedOrigins);
    const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
    return callback(new Error(msg), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'X-Shopify-Topic', 'X-Shopify-Hmac-Sha256', 'X-Session-Token', 'ngrok-skip-browser-warning', 'Cache-Control', 'Pragma'],
  optionsSuccessStatus: 200,
  preflightContinue: false
}));

// 5. Body parsing middleware with webhook raw body preservation
// Preserve raw body for webhook routes that need HMAC verification
app.use('/api/shopify-integration/webhook', express.raw({ type: 'application/json' }), (req, res, next) => {
  // Store raw body as string for HMAC verification
  req.rawBody = req.body.toString('utf8');
  next();
});

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

// Additional CORS middleware for API routes and auth routes accessed from Shopify
app.use(['/api', '/auth'], (req, res, next) => {
  const origin = req.headers.origin;

  // Validate origin against allowed origins for security
  const isAllowedOrigin = !origin ||
    appConfig.cors.allowedOrigins.includes(origin) ||
    (appConfig.env === 'development' && origin?.includes('localhost')) ||
    origin?.includes('.myshopify.com') ||
    origin?.includes('.shopify.com');

  // Log CORS requests for debugging
  console.log(`[CORS] ${req.method} ${req.path} from origin: ${origin || 'none'} - ${isAllowedOrigin ? 'ALLOWED' : 'BLOCKED'}`);

  // Set CORS headers consistently - all or nothing to avoid browser rejection
  if (isAllowedOrigin) {
    res.header('Access-Control-Allow-Origin', origin || appConfig.cors.allowedOrigins[0]);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS,POST,PUT,DELETE');
    res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization,X-Shopify-Topic,X-Shopify-Hmac-Sha256,X-Session-Token,ngrok-skip-browser-warning,Cookie');
    res.header('Access-Control-Max-Age', '86400');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    next();
  } else {
    // Reject requests from disallowed origins
    console.warn(`[CORS] Blocked request from origin: ${origin}`);
    res.status(403).json({ error: 'CORS policy does not allow access from this origin' });
  }
});

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
const shopifyIntegrationRoutes = require('./routes/shopifyIntegration');

// Mount routes
app.use('/auth', authRoutes);
app.use('/api/strava', stravaRoutes);
app.use('/api/maps', mapRoutes);
app.use('/api/shopify-integration', shopifyIntegrationRoutes);

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

// Secure client configuration endpoint (requires authentication)
const { requireAuth } = require('./routes/auth');
app.get('/api/client-config', requireAuth, (req, res) => {
  try {
    // Only provide necessary client-side configuration to authenticated users
    res.json({
      mapbox: {
        accessToken: appConfig.mapbox.accessToken
      },
      mapExport: {
        timeout: appConfig.mapExport.timeout,
        quality: appConfig.mapExport.quality,
        format: appConfig.mapExport.format
      }
    });
  } catch (error) {
    console.error('Error providing client config:', error);
    res.status(500).json({
      error: 'Configuration unavailable',
      message: 'Unable to provide client configuration'
    });
  }
});

// Public Mapbox configuration endpoint (no auth required for basic config)
app.get('/api/mapbox-config', (req, res) => {
  try {
    // Only provide public configuration that's safe to expose
    res.json({
      mapbox: {
        accessToken: appConfig.mapbox.accessToken
      },
      styles: {
        default: 'streets-v12',
        available: ['streets-v12', 'outdoors-v12', 'satellite-v9', 'light-v11', 'dark-v11']
      }
    });
  } catch (error) {
    console.error('Error providing Mapbox config:', error);
    res.status(500).json({
      error: 'Configuration unavailable',
      message: 'Unable to provide Mapbox configuration'
    });
  }
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

// Frontend connectivity test endpoint
app.get('/api/test-frontend', (req, res) => {
  try {
    const origin = req.get('Origin') || req.get('Referer');
    const userAgent = req.get('User-Agent');
    
    res.json({
      success: true,
      message: 'Frontend connectivity test successful',
      timestamp: new Date().toISOString(),
      request: {
        origin: origin,
        userAgent: userAgent,
        method: req.method,
        headers: req.headers
      },
      server: {
        environment: appConfig.env,
        port: appConfig.port,
        uptime: process.uptime()
      },
      cors: {
        allowedOrigins: appConfig.cors.allowedOrigins,
        corsEnabled: true
      }
    });
    
  } catch (error) {
    console.error('Frontend test endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Frontend connectivity test failed',
      message: error.message,
      timestamp: new Date().toISOString()
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

// Route Integration Validation Endpoint
app.get('/api/integration-health', (req, res) => {
  try {
    const AuthHelpers = require('./helpers/authHelpers');
    
    // Perform comprehensive integration health check
    const integrationHealth = AuthHelpers.performIntegrationHealthCheck(req);
    
    // Additional server-level checks
    const serverChecks = {
      routes: {
        auth: typeof authRoutes === 'object' ? 'mounted' : 'missing',
        strava: typeof stravaRoutes === 'object' ? 'mounted' : 'missing',
        maps: typeof mapRoutes === 'object' ? 'mounted' : 'missing'
      },
      middleware: {
        session: req.session ? 'active' : 'inactive',
        cors: req.headers.origin ? 'configured' : 'default',
        security: req.headers['x-frame-options'] ? 'active' : 'inactive'
      },
      environment: {
        node_env: appConfig.env,
        port: appConfig.port,
        uptime: process.uptime()
      }
    };
    
    // Route endpoint validation
    const routeEndpoints = {
      auth_routes: [
        '/auth/strava',
        '/auth/strava/callback', 
        '/auth/status',
        '/auth/logout'
      ],
      strava_routes: [
        '/api/strava/athlete',
        '/api/strava/activities',
        '/api/strava/activities/search'
      ],
      server_routes: [
        '/health',
        '/config',
        '/api/ngrok-url'
      ]
    };
    
    const response = {
      success: true,
      message: 'Route integration validation completed',
      timestamp: new Date().toISOString(),
      integration: integrationHealth,
      server: serverChecks,
      available_endpoints: routeEndpoints,
      recommendations: generateIntegrationRecommendations(integrationHealth, serverChecks)
    };
    
    const statusCode = integrationHealth.overall === 'healthy' ? 200 : 206;
    res.status(statusCode).json(response);
    
  } catch (error) {
    console.error('Integration health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Integration health check failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Helper function to generate integration recommendations
function generateIntegrationRecommendations(integrationHealth, serverChecks) {
  const recommendations = [];
  
  if (integrationHealth.overall === 'healthy') {
    recommendations.push('All route integrations are functioning correctly');
  } else {
    recommendations.push('Some integration issues detected - check detailed status above');
  }
  
  if (serverChecks.routes.auth !== 'mounted') {
    recommendations.push('Authentication routes not properly mounted');
  }
  
  if (serverChecks.routes.strava !== 'mounted') {
    recommendations.push('Strava API routes not properly mounted');
  }
  
  if (serverChecks.middleware.session === 'inactive') {
    recommendations.push('Session middleware may not be configured correctly');
  }
  
  if (integrationHealth.checks.tokenManager?.status === 'error') {
    recommendations.push('Token manager integration has issues - check token service');
  }
  
  if (integrationHealth.checks.routeIntegration?.status === 'error') {
    recommendations.push('Route integration middleware chain needs review');
  }
  
  return recommendations;
}

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
const server = app.listen(appConfig.port, async () => {
  console.log(`Server running on port ${appConfig.port} in ${appConfig.env} mode`);
  console.log(`Configuration loaded successfully`);
  
  // Initialize progress service with WebSocket support
  const progressService = new ProgressService();
  progressService.initialize(server);
  
  // Make progress service available globally
  app.locals.progressService = progressService;
  console.log(`Health check available at: http://localhost:${appConfig.port}/health`);
  
  // Initialize file storage service
  try {
    const fileStorageService = require('./services/fileStorageService');
    await fileStorageService.initialize();
    console.log('File storage service initialized successfully');
  } catch (error) {
    console.error('Failed to initialize file storage service:', error);
  }
  
  // Initialize file cleanup service
  try {
    const fileCleanupService = require('./services/fileCleanupService');
    await fileCleanupService.initialize();
    console.log('File cleanup service initialized successfully');
  } catch (error) {
    console.error('Failed to initialize file cleanup service:', error);
  }
  
  // Initialize file monitoring service
  try {
    const fileMonitoringService = require('./services/fileMonitoringService');
    await fileMonitoringService.initialize();
    console.log('File monitoring service initialized successfully');
  } catch (error) {
    console.error('Failed to initialize file monitoring service:', error);
  }
  
  // Create storage directory if it doesn't exist (fallback)
  const fs = require('fs');
  if (!fs.existsSync(appConfig.storage.generatedMapsDir)) {
    fs.mkdirSync(appConfig.storage.generatedMapsDir, { recursive: true });
    console.log(`Created storage directory: ${appConfig.storage.generatedMapsDir}`);
  }
});

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
  
  server.close(async (err) => {
    if (err) {
      console.error('Error during server shutdown:', err);
      process.exit(1);
    }
    
    console.log('Server closed successfully');
    
    // Shutdown progress service
    try {
      if (app.locals.progressService) {
        app.locals.progressService.shutdown();
        console.log('Progress service shut down successfully');
      }
    } catch (error) {
      console.error('Error shutting down progress service:', error);
    }
    
    // Clean up file services
    try {
      const fileCleanupService = require('./services/fileCleanupService');
      await fileCleanupService.shutdown();
      console.log('File cleanup service shut down successfully');
    } catch (error) {
      console.error('Error shutting down file cleanup service:', error);
    }
    
    try {
      const fileMonitoringService = require('./services/fileMonitoringService');
      await fileMonitoringService.shutdown();
      console.log('File monitoring service shut down successfully');
    } catch (error) {
      console.error('Error shutting down file monitoring service:', error);
    }
    
    try {
      const mapService = require('./services/mapService');
      await mapService.cleanup();
      console.log('Map service cleaned up successfully');
    } catch (error) {
      console.error('Error cleaning up map service:', error);
    }
    
    console.log('Graceful shutdown completed');
    process.exit(0);
  });
  
  // Force close server after 15 seconds (increased timeout for cleanup)
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 15000);
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