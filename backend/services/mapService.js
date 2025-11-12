/**
 * Map Service for High-Resolution Export
 * Handles server-side map generation using Mapbox GL JS and Puppeteer
 * Generates 300 DPI print-quality images for A4 and A3 formats
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const sharp = require('sharp');
const fetch = require('node-fetch');
const config = require('../config');

/**
 * Resolution Management System
 * Handles scaling between screen and print resolutions, DPI calculations,
 * and quality optimization for different export requirements
 */
class ResolutionManager {
  constructor() {
    // Standard DPI presets
    this.DPI_PRESETS = {
      SCREEN: 72,      // Standard screen resolution
      WEB_HIGH: 96,    // High-density web displays
      PRINT_DRAFT: 150, // Draft quality printing
      PRINT_STANDARD: 300, // Professional print quality
      PRINT_HIGH: 600  // Premium print quality
    };

    // Memory thresholds for different quality levels (in MB)
    this.MEMORY_THRESHOLDS = {
      LOW: 50,      // < 50MB - Use aggressive optimization
      MEDIUM: 200,  // 50-200MB - Standard optimization
      HIGH: 500,    // 200-500MB - Minimal optimization
      EXTREME: 1000 // > 1000MB - Warning threshold
    };

    // Quality settings based on target DPI
    this.QUALITY_SETTINGS = {
      72: { devicePixelRatio: 1, quality: 80, optimization: 'high' },
      96: { devicePixelRatio: 1.33, quality: 85, optimization: 'medium' },
      150: { devicePixelRatio: 2, quality: 90, optimization: 'medium' },
      300: { devicePixelRatio: 3, quality: 95, optimization: 'low' },
      600: { devicePixelRatio: 6, quality: 100, optimization: 'minimal' }
    };
  }

  /**
   * Calculate scaling factor for target DPI
   * @param {number} targetDPI - Desired DPI output
   * @param {number} baseDPI - Base DPI (default: 96 for web)
   * @returns {number} Scaling factor
   */
  calculateScalingFactor(targetDPI, baseDPI = 96) {
    if (!Number.isInteger(targetDPI) || targetDPI <= 0) {
      throw new Error('Target DPI must be a positive integer');
    }
    if (!Number.isInteger(baseDPI) || baseDPI <= 0) {
      throw new Error('Base DPI must be a positive integer');
    }
    
    return Math.round((targetDPI / baseDPI) * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Get quality settings for target DPI
   * @param {number} targetDPI - Target DPI
   * @returns {Object} Quality configuration
   */
  getQualitySettings(targetDPI) {
    // Find closest DPI preset
    const availableDPIs = Object.keys(this.QUALITY_SETTINGS).map(Number).sort((a, b) => a - b);
    let closestDPI = availableDPIs[0];
    
    for (const dpi of availableDPIs) {
      if (Math.abs(dpi - targetDPI) < Math.abs(closestDPI - targetDPI)) {
        closestDPI = dpi;
      }
    }

    const settings = { ...this.QUALITY_SETTINGS[closestDPI] };
    
    // Adjust for exact DPI if not in presets
    if (closestDPI !== targetDPI) {
      settings.devicePixelRatio = this.calculateScalingFactor(targetDPI, 96);
    }

    return {
      ...settings,
      targetDPI,
      actualDPI: Math.round(96 * settings.devicePixelRatio),
      scalingFactor: settings.devicePixelRatio
    };
  }

  /**
   * Calculate memory requirements for given dimensions and DPI
   * @param {number} width - Width in pixels
   * @param {number} height - Height in pixels  
   * @param {number} dpi - Target DPI
   * @returns {Object} Memory estimation
   */
  calculateMemoryRequirements(width, height, dpi) {
    const scalingFactor = this.calculateScalingFactor(dpi, 96);
    const actualWidth = Math.round(width * scalingFactor);
    const actualHeight = Math.round(height * scalingFactor);
    
    // Estimate memory usage: width * height * 4 bytes (RGBA) * buffer multiplier
    const bufferMultiplier = 2.5; // Account for browser overhead and buffers
    const estimatedBytes = actualWidth * actualHeight * 4 * bufferMultiplier;
    const estimatedMB = Math.round(estimatedBytes / (1024 * 1024));

    // Determine optimization level
    let optimizationLevel = 'minimal';
    if (estimatedMB > this.MEMORY_THRESHOLDS.EXTREME) {
      optimizationLevel = 'extreme';
    } else if (estimatedMB > this.MEMORY_THRESHOLDS.HIGH) {
      optimizationLevel = 'high';
    } else if (estimatedMB > this.MEMORY_THRESHOLDS.MEDIUM) {
      optimizationLevel = 'medium';
    } else if (estimatedMB > this.MEMORY_THRESHOLDS.LOW) {
      optimizationLevel = 'low';
    }

    return {
      estimatedMB,
      actualWidth,
      actualHeight,
      scalingFactor,
      optimizationLevel,
      isMemoryIntensive: estimatedMB > this.MEMORY_THRESHOLDS.HIGH,
      recommendTiling: estimatedMB > this.MEMORY_THRESHOLDS.EXTREME
    };
  }

  /**
   * Get DPI preset configurations
   * @returns {Object} Available DPI presets with descriptions
   */
  getDPIPresets() {
    return {
      [this.DPI_PRESETS.SCREEN]: {
        name: 'Screen Quality',
        description: 'Optimized for screen viewing (72 DPI)',
        useCase: 'Web preview, email sharing',
        quality: 'Basic'
      },
      [this.DPI_PRESETS.WEB_HIGH]: {
        name: 'High Screen Quality', 
        description: 'High-density screen displays (96 DPI)',
        useCase: 'Retina displays, high-DPI monitors',
        quality: 'Good'
      },
      [this.DPI_PRESETS.PRINT_DRAFT]: {
        name: 'Draft Print',
        description: 'Draft quality printing (150 DPI)',
        useCase: 'Proofs, internal review',
        quality: 'Draft'
      },
      [this.DPI_PRESETS.PRINT_STANDARD]: {
        name: 'Professional Print',
        description: 'Professional print quality (300 DPI)',
        useCase: 'Professional printing, wall art',
        quality: 'Professional'
      },
      [this.DPI_PRESETS.PRINT_HIGH]: {
        name: 'Premium Print',
        description: 'Premium print quality (600 DPI)',
        useCase: 'High-end printing, large format',
        quality: 'Premium'
      }
    };
  }

  /**
   * Optimize dimensions for memory constraints
   * @param {number} width - Original width
   * @param {number} height - Original height
   * @param {number} targetDPI - Target DPI
   * @param {number} maxMemoryMB - Maximum memory limit in MB
   * @returns {Object} Optimized dimensions and settings
   */
  optimizeForMemory(width, height, targetDPI, maxMemoryMB = 500) {
    let currentMemory = this.calculateMemoryRequirements(width, height, targetDPI);
    
    if (currentMemory.estimatedMB <= maxMemoryMB) {
      return {
        width,
        height,
        dpi: targetDPI,
        scalingFactor: currentMemory.scalingFactor,
        memoryMB: currentMemory.estimatedMB,
        optimized: false
      };
    }

    // Calculate reduction factor needed
    const reductionRatio = Math.sqrt(maxMemoryMB / currentMemory.estimatedMB);
    const optimizedWidth = Math.round(width * reductionRatio);
    const optimizedHeight = Math.round(height * reductionRatio);
    
    // Recalculate memory with optimized dimensions
    const optimizedMemory = this.calculateMemoryRequirements(optimizedWidth, optimizedHeight, targetDPI);

    return {
      width: optimizedWidth,
      height: optimizedHeight,
      dpi: targetDPI,
      scalingFactor: optimizedMemory.scalingFactor,
      memoryMB: optimizedMemory.estimatedMB,
      optimized: true,
      reductionRatio,
      originalDimensions: { width, height },
      originalMemoryMB: currentMemory.estimatedMB
    };
  }

  /**
   * Get preview dimensions optimized for fast display
   * @param {number} targetWidth - Target preview width
   * @param {number} targetHeight - Target preview height
   * @param {number} maxDimension - Maximum dimension limit
   * @returns {Object} Preview dimensions and settings
   */
  getPreviewDimensions(targetWidth, targetHeight, maxDimension = 800) {
    const aspectRatio = targetWidth / targetHeight;
    let previewWidth, previewHeight;

    if (targetWidth > targetHeight) {
      previewWidth = Math.min(maxDimension, targetWidth);
      previewHeight = Math.round(previewWidth / aspectRatio);
    } else {
      previewHeight = Math.min(maxDimension, targetHeight);
      previewWidth = Math.round(previewHeight * aspectRatio);
    }

    // Use screen DPI for previews
    const quality = this.getQualitySettings(this.DPI_PRESETS.SCREEN);

    return {
      width: previewWidth,
      height: previewHeight,
      dpi: this.DPI_PRESETS.SCREEN,
      quality,
      scalingFactor: quality.scalingFactor,
      aspectRatio,
      isPreview: true
    };
  }

  /**
   * Validate resolution parameters
   * @param {Object} params - Resolution parameters
   * @returns {boolean} Validation result
   */
  validateResolutionParams(params) {
    const { width, height, dpi } = params;

    if (!Number.isInteger(width) || width <= 0) {
      throw new Error('Width must be a positive integer');
    }
    if (!Number.isInteger(height) || height <= 0) {
      throw new Error('Height must be a positive integer');
    }
    if (!Number.isInteger(dpi) || dpi <= 0) {
      throw new Error('DPI must be a positive integer');
    }

    // Check reasonable limits
    if (dpi > 1200) {
      throw new Error('DPI cannot exceed 1200 (maximum supported)');
    }
    if (dpi < 36) {
      throw new Error('DPI cannot be less than 36 (minimum supported)');
    }

    const memoryCheck = this.calculateMemoryRequirements(width, height, dpi);
    if (memoryCheck.estimatedMB > this.MEMORY_THRESHOLDS.EXTREME) {
      console.warn(`High memory requirement detected: ${memoryCheck.estimatedMB}MB. Consider optimizing dimensions.`);
    }

    return true;
  }
}

class MapService {
  constructor() {
    this.appConfig = config.getConfig();
    this.browser = null;
    this.isInitialized = false;
    this.resolutionManager = new ResolutionManager();
  }

  /**
   * Normalize Mapbox style input to a proper Mapbox style URL
   * Handles various input formats and returns a consistent Mapbox style URL
   * @param {string} style - Style input (ID, partial URL, or full URL)
   * @returns {string} Normalized Mapbox style URL
   */
  static normalizeMapboxStyleURL(style) {
    if (!style || typeof style !== 'string') {
      // Default to streets-v12 if no style provided
      return 'mapbox://styles/mapbox/streets-v12';
    }

    // If already a complete mapbox:// URL, return as-is
    if (style.startsWith('mapbox://styles/')) {
      return style;
    }

    // If it's a custom style URL (https://), return as-is
    if (style.startsWith('https://') || style.startsWith('http://')) {
      return style;
    }

    // Handle style name mappings - matches frontend getMapTypeStyles() function
    const styleMap = {
      // Standard Mapbox styles
      'streets': 'streets-v11',
      'outdoors': 'outdoors-v11',
      'light': 'light-v10', 
      'dark': 'dark-v10',
      'satellite': 'satellite-v9',
      'satellite-streets': 'satellite-streets-v11',
      'terrain': 'outdoors-v11',
      'navigation-day': 'navigation-day-v1',
      'navigation-night': 'navigation-night-v1',
      
      // Custom styles from frontend (these need special handling)
      'grey': 'macken04/cm9qvmy7500hr01s5h4h67lsr',
      'classic_pink': 'macken04/cme063epj00rq01pjamus26ma',
      'classic_orange': 'macken04/cmdowyoaj004i01sb9i27ene8',
      'classic_grey': 'macken04/cmdowoyfi003o01r5h90e8r6l',
      'classic_dark': 'macken04/cmdowqfh4004h01sb14fe6x3u',
      'classic_blue': 'macken04/cmdowyoil001d01sh5937dt1p'
    };

    // Normalize the style name
    let normalizedStyle = style.toLowerCase().trim();
    
    // Check if it's a mapped style name
    if (styleMap[normalizedStyle]) {
      const mappedStyle = styleMap[normalizedStyle];
      
      // Handle custom styles (contain '/')
      if (mappedStyle.includes('/')) {
        return `mapbox://styles/${mappedStyle}`;
      }
      // Handle standard Mapbox styles
      else {
        return `mapbox://styles/mapbox/${mappedStyle}`;
      }
    }
    // If it already has version (e.g., "streets-v12"), use as-is for Mapbox styles
    else if (normalizedStyle.includes('-v')) {
      // Keep the original casing for version numbers
      normalizedStyle = style.trim();
      return `mapbox://styles/mapbox/${normalizedStyle}`;
    }
    // If it's just a base name without version, add latest version
    else {
      normalizedStyle = `${normalizedStyle}-v12`; // Default to v12 for most styles
      return `mapbox://styles/mapbox/${normalizedStyle}`;
    }
  }

  /**
   * Initialize Puppeteer browser instance with macOS ARM64 optimizations
   */
  async initialize() {
    if (this.isInitialized && this.browser && this.browser.isConnected()) {
      return this;
    }

    // Clean up any existing browser instance
    if (this.browser) {
      await this.safeBrowserClose(this.browser);
      this.browser = null;
      this.isInitialized = false;
    }

    const maxRetries = 3;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`MapService: Browser launch attempt ${attempt}/${maxRetries}...`);
        
        const browser = await this.launchBrowserWithRetry(attempt);
        if (browser) {
          this.browser = browser;
          this.isInitialized = true;
          console.log('MapService: Browser initialized successfully');
          return this;
        }
      } catch (error) {
        lastError = error;
        console.log(`MapService: Launch attempt ${attempt} failed:`, error.message);
        
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.log(`MapService: Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    console.error('MapService: All browser launch attempts failed');
    this.browser = null;
    this.isInitialized = false;
    throw lastError || new Error('Failed to initialize browser after multiple attempts');
  }

  /**
   * Launch browser with platform-specific optimizations and retry logic
   */
  async launchBrowserWithRetry(attempt) {
    const platform = process.platform;
    const arch = process.arch;
    
    console.log(`MapService: Platform detected: ${platform} ${arch}`);

    // Try platform-specific configuration first
    let launchConfig = this.getPlatformLaunchConfig(platform, arch, attempt);
    
    // If this is the final attempt and on macOS, try system Chrome as last resort
    if (attempt >= 3 && platform === 'darwin') {
      const systemChromeConfig = this.getSystemChromeConfig(launchConfig);
      if (systemChromeConfig) {
        console.log('MapService: Using system Chrome as last resort fallback');
        launchConfig = systemChromeConfig;
      }
    }
    
    console.log(`MapService: Using launch config for attempt ${attempt}:`, {
      headless: launchConfig.headless,
      pipe: launchConfig.pipe || false,
      dumpio: launchConfig.dumpio || false,
      executablePath: launchConfig.executablePath ? 'system Chrome' : 'bundled Chrome',
      argsCount: launchConfig.args.length,
      timeout: launchConfig.timeout
    });

    let browser = null;
    try {
      // Launch browser with timeout wrapper
      browser = await Promise.race([
        puppeteer.launch(launchConfig),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Browser launch timeout')), launchConfig.timeout || 45000)
        )
      ]);
      
      // Verify browser connection with comprehensive health check
      const isHealthy = await this.verifyBrowserHealth(browser);
      if (!isHealthy) {
        await this.safeBrowserClose(browser);
        throw new Error('Browser failed health check');
      }
      
      console.log('MapService: Browser launched and verified successfully');
      return browser;
      
    } catch (error) {
      console.error(`MapService: Launch configuration failed:`, error.message);
      
      // Enhanced error handling for different failure types
      if (error.message.includes('socket hang up')) {
        console.error('MapService: Socket hang up detected - Chrome process may have crashed during startup');
      } else if (error.message.includes('Protocol error')) {
        console.error('MapService: Protocol error - Chrome DevTools communication failed');
      } else if (error.message.includes('timeout')) {
        console.error('MapService: Browser launch timeout - process may be hanging');
      }
      
      // Ensure browser cleanup even on launch failure
      if (browser) {
        await this.safeBrowserClose(browser);
      }
      
      throw error;
    }
  }

  /**
   * Safely close browser with error handling
   */
  async safeBrowserClose(browser) {
    if (!browser) return;
    
    try {
      // Try graceful close first
      await browser.close();
    } catch (error) {
      console.warn('MapService: Graceful browser close failed, attempting force close:', error.message);
      try {
        // Force close if graceful fails
        await browser.disconnect();
      } catch (disconnectError) {
        console.warn('MapService: Browser disconnect also failed:', disconnectError.message);
      }
    }
  }

  /**
   * Get platform-specific launch configuration
   */
  getPlatformLaunchConfig(platform, arch, attempt) {
    const baseConfig = {
      timeout: 45000,
      defaultViewport: null,
      ignoreDefaultArgs: false
    };

    // macOS ARM64 (Apple Silicon) optimizations
    if (platform === 'darwin' && arch === 'arm64') {
      return this.getMacOSARM64Config(baseConfig, attempt);
    }
    
    // macOS Intel optimizations
    if (platform === 'darwin' && arch === 'x64') {
      return this.getMacOSIntelConfig(baseConfig, attempt);
    }
    
    // Linux optimizations
    if (platform === 'linux') {
      return this.getLinuxConfig(baseConfig, attempt);
    }
    
    // Windows optimizations
    if (platform === 'win32') {
      return this.getWindowsConfig(baseConfig, attempt);
    }
    
    // Generic fallback
    return this.getGenericConfig(baseConfig, attempt);
  }

  /**
   * macOS Apple Silicon (ARM64) specific configuration
   */
  getMacOSARM64Config(baseConfig, attempt) {
    const configs = [
      // Attempt 1: ARM64 optimized with WebSocket connection (most stable)
      {
        ...baseConfig,
        headless: 'new',
        pipe: false, // Use WebSocket instead of pipe for ARM64
        dumpio: false, // Reduce logging overhead
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--disable-extensions',
          '--no-first-run',
          '--disable-default-apps',
          '--disable-sync',
          '--disable-background-timer-throttling',
          '--disable-features=VizDisplayCompositor',
          '--disable-gpu-sandbox'
        ]
      },
      // Attempt 2: Minimal flags with WebSocket
      {
        ...baseConfig,
        headless: 'new',
        pipe: false,
        dumpio: false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--no-first-run',
          '--disable-features=VizDisplayCompositor'
        ]
      },
      // Attempt 3: Compatibility mode without problematic flags
      {
        ...baseConfig,
        headless: 'new',
        pipe: false,
        dumpio: true,
        ignoreDefaultArgs: ['--disable-extensions'],
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--no-first-run',
          '--single-process' // Last resort for ARM64 compatibility
        ]
      }
    ];

    return configs[Math.min(attempt - 1, configs.length - 1)];
  }

  /**
   * macOS Intel specific configuration
   */
  getMacOSIntelConfig(baseConfig, attempt) {
    const configs = [
      // Attempt 1: WebGL enabled for Intel Macs
      {
        ...baseConfig,
        headless: false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--enable-webgl',
          '--enable-gpu',
          '--window-size=1200,800',
          '--disable-infobars',
          '--enable-chrome-browser-cloud-management'
        ]
      },
      // Attempt 2: Headless with WebGL
      {
        ...baseConfig,
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--enable-webgl',
          '--enable-chrome-browser-cloud-management'
        ]
      },
      // Attempt 3: Basic compatibility
      {
        ...baseConfig,
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--enable-chrome-browser-cloud-management'
        ]
      }
    ];

    return configs[Math.min(attempt - 1, configs.length - 1)];
  }

  /**
   * Linux specific configuration
   */
  getLinuxConfig(baseConfig, attempt) {
    const configs = [
      {
        ...baseConfig,
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--enable-chrome-browser-cloud-management'
        ]
      },
      {
        ...baseConfig,
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--enable-chrome-browser-cloud-management'
        ]
      }
    ];

    return configs[Math.min(attempt - 1, configs.length - 1)];
  }

  /**
   * Windows specific configuration
   */
  getWindowsConfig(baseConfig, attempt) {
    const configs = [
      {
        ...baseConfig,
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--enable-webgl',
          '--no-first-run',
          '--enable-chrome-browser-cloud-management'
        ]
      },
      {
        ...baseConfig,
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--enable-chrome-browser-cloud-management'
        ]
      }
    ];

    return configs[Math.min(attempt - 1, configs.length - 1)];
  }

  /**
   * Generic fallback configuration
   */
  getGenericConfig(baseConfig, attempt) {
    return {
      ...baseConfig,
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--enable-chrome-browser-cloud-management'
      ]
    };
  }

  /**
   * Get system Chrome executable path for macOS as last resort
   */
  getSystemChromePath() {
    const chromePaths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium'
    ];

    for (const chromePath of chromePaths) {
      try {
        if (require('fs').existsSync(chromePath)) {
          console.log(`MapService: Found system Chrome at: ${chromePath}`);
          return chromePath;
        }
      } catch (error) {
        // Ignore errors, try next path
      }
    }
    return null;
  }

  /**
   * Create system Chrome fallback configuration
   */
  getSystemChromeConfig(baseConfig) {
    const executablePath = this.getSystemChromePath();
    if (!executablePath) {
      return null;
    }

    return {
      ...baseConfig,
      executablePath,
      headless: 'new',
      pipe: true,
      dumpio: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--enable-chrome-browser-cloud-management'
      ]
    };
  }

  /**
   * Comprehensive browser health verification
   */
  async verifyBrowserHealth(browser) {
    const healthCheckTimeout = 10000; // 10 seconds
    
    try {
      // Wrap health check in timeout
      return await Promise.race([
        this.performHealthCheck(browser),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Health check timeout')), healthCheckTimeout)
        )
      ]);
    } catch (error) {
      console.log('MapService: Health check failed with error:', error.message);
      return false;
    }
  }

  async performHealthCheck(browser) {
    try {
      // Test 1: Basic connection and version info
      console.log('MapService: Health check - testing connection...');
      const version = await browser.version();
      if (!version) {
        console.log('MapService: Health check failed - no version info');
        return false;
      }
      console.log('MapService: Health check - connection OK, version:', version);

      // Test 2: Page creation and basic navigation
      console.log('MapService: Health check - testing page creation...');
      const page = await browser.newPage();
      
      try {
        await page.goto('data:text/html,<html><head><title>Health Check</title></head><body>Test</body></html>', {
          waitUntil: 'domcontentloaded',
          timeout: 5000
        });
        
        // Test 3: JavaScript execution and DOM access
        console.log('MapService: Health check - testing JavaScript execution...');
        const result = await page.evaluate(() => {
          return {
            hasWindow: typeof window !== 'undefined',
            hasDocument: typeof document !== 'undefined',
            hasCanvas: typeof HTMLCanvasElement !== 'undefined',
            title: document.title
          };
        });
        
        await page.close();
        
        if (!result.hasWindow || !result.hasDocument || !result.hasCanvas) {
          console.log('MapService: Health check failed - missing essential browser APIs:', result);
          return false;
        }

        console.log('MapService: Browser health check passed - all tests OK');
        return true;
        
      } catch (pageError) {
        await page.close().catch(() => {});
        throw pageError;
      }

    } catch (error) {
      console.log('MapService: Health check component failed:', error.message);
      return false;
    }
  }

  /**
   * Generate high-resolution map image with enhanced error handling and fallbacks
   */
  async generateMap(mapOptions) {
    const {
      routeCoordinates,
      bounds,
      center,
      format = 'A4',
      orientation = 'portrait',
      dpi = 300,
      style = 'streets-v12',
      routeColor = '#FF4444',
      routeWidth = 4,
      showStartEnd = true,
      title = '',
      outputPath,
      memoryOptimization = true,
      maxMemoryMB = 500,
      // New format-specific options
      exportFormat = 'png', // 'png' or 'jpeg'
      qualityLevel = 'high', // 'low', 'medium', 'high'
      antiAliasing = true,
      optimizeText = true,
      jpegBackgroundColor = '#ffffff'
    } = mapOptions;

    console.log('MapService: Starting map generation with options:', {
      format,
      orientation,
      dpi,
      style,
      exportFormat,
      qualityLevel,
      routeCoordinatesCount: routeCoordinates?.length,
      hasBounds: !!bounds,
      hasCenter: !!center
    });

    // Validate map options
    this.validateMapOptions(mapOptions);

    // Try browser-based generation first, then fallbacks
    try {
      return await this.generateMapWithBrowser(mapOptions);
    } catch (browserError) {
      console.warn('MapService: Browser-based generation failed:', browserError.message);
      console.log('MapService: Attempting Canvas fallback...');
      
      try {
        return await this.generateCanvasMapFallback(this.convertOptionsForFallback(mapOptions));
      } catch (canvasError) {
        console.warn('MapService: Canvas fallback failed:', canvasError.message);
        console.log('MapService: Attempting Static Images API fallback...');
        
        return await this.generateStaticMapFallback(this.convertOptionsForFallback(mapOptions));
      }
    }
  }

  /**
   * Generate map using browser (Puppeteer + WebGL)
   */
  async generateMapWithBrowser(mapOptions) {
    const {
      routeCoordinates,
      bounds,
      center,
      format = 'A4',
      orientation = 'portrait',
      dpi = 300,
      style = 'streets-v12',
      routeColor = '#FF4444',
      routeWidth = 4,
      showStartEnd = true,
      title = '',
      outputPath,
      memoryOptimization = true,
      maxMemoryMB = 500,
      exportFormat = 'png',
      qualityLevel = 'high',
      antiAliasing = true,
      optimizeText = true,
      jpegBackgroundColor = '#ffffff'
    } = mapOptions;

    // Ensure browser is initialized with retry logic
    await this.ensureBrowserReady();

    let page;
    const maxPageRetries = 2;
    
    for (let pageAttempt = 1; pageAttempt <= maxPageRetries; pageAttempt++) {
      try {
        page = await this.browser.newPage();
        console.log(`MapService: Page created successfully (attempt ${pageAttempt})`);
        break;
      } catch (pageError) {
        console.log(`MapService: Page creation failed (attempt ${pageAttempt}):`, pageError.message);
        
        if (pageAttempt === maxPageRetries) {
          throw new Error(`Failed to create browser page after ${maxPageRetries} attempts: ${pageError.message}`);
        }
        
        // Try reinitializing browser
        console.log('MapService: Reinitializing browser for page creation...');
        await this.initialize();
      }
    }

    try {
      console.log(`MapService: Generating ${format} ${orientation} map at ${dpi} DPI...`);

      // Get base dimensions for format and orientation
      const baseDimensions = this.getPrintDimensions(format, orientation);
      
      // Get resolution settings and optimize if needed
      let resolutionConfig;
      if (memoryOptimization) {
        resolutionConfig = this.resolutionManager.optimizeForMemory(
          baseDimensions.width, 
          baseDimensions.height, 
          dpi, 
          maxMemoryMB
        );
        
        if (resolutionConfig.optimized) {
          console.log(`MapService: Memory optimization applied. Reduced from ${resolutionConfig.originalMemoryMB}MB to ${resolutionConfig.memoryMB}MB`);
        }
      } else {
        // No optimization, use full dimensions
        const qualitySettings = this.resolutionManager.getQualitySettings(dpi);
        resolutionConfig = {
          width: baseDimensions.width,
          height: baseDimensions.height,
          dpi,
          scalingFactor: qualitySettings.scalingFactor,
          memoryMB: this.resolutionManager.calculateMemoryRequirements(baseDimensions.width, baseDimensions.height, dpi).estimatedMB,
          optimized: false
        };
      }

      // Validate resolution parameters
      this.resolutionManager.validateResolutionParams({
        width: resolutionConfig.width,
        height: resolutionConfig.height,
        dpi: resolutionConfig.dpi
      });

      // Get quality settings for the target DPI
      const qualitySettings = this.resolutionManager.getQualitySettings(resolutionConfig.dpi);
      
      console.log(`MapService: Using resolution ${resolutionConfig.width}x${resolutionConfig.height} at ${resolutionConfig.dpi} DPI (${resolutionConfig.memoryMB}MB estimated)`);

      // Set viewport with calculated device pixel ratio
      await page.setViewport({
        width: resolutionConfig.width,
        height: resolutionConfig.height,
        deviceScaleFactor: qualitySettings.scalingFactor
      });

      // Calculate poster bounds for proper framing BEFORE generating HTML
      const posterBounds = this.calculatePosterBounds(bounds, format, orientation, 15);
      console.log(`MapService: Original bounds:`, bounds);
      console.log(`MapService: Poster bounds:`, posterBounds);

      // Generate HTML for map rendering with resolution settings
      const mapHTML = this.generateMapHTML({
        routeCoordinates,
        bounds: posterBounds, // Use poster bounds instead of tight route bounds
        center,
        style,
        routeColor,
        routeWidth,
        showStartEnd,
        title,
        dimensions: {
          ...resolutionConfig,
          ...baseDimensions, // Include original metadata
          actualWidth: Math.round(resolutionConfig.width * qualitySettings.scalingFactor),
          actualHeight: Math.round(resolutionConfig.height * qualitySettings.scalingFactor)
        },
        format,
        orientation,
        qualitySettings
      });

      // Set page content
      await page.setContent(mapHTML, {
        waitUntil: 'networkidle0',
        timeout: 45000 // Increased timeout for high-res renders
      });

      // Wait for map to be fully loaded with enhanced error handling
      try {
        await page.waitForFunction(() => {
          return window.mapLoaded === true;
        }, { timeout: 45000 });
      } catch (loadError) {
        console.error('MapService: Map loading timeout or error:', loadError.message);
        throw new Error(`Map failed to load within timeout: ${loadError.message}`);
      }

      // Configure format-specific quality settings
      const formatQualitySettings = this.getFormatQualitySettings(exportFormat, qualityLevel);
      
      // Take screenshot with optimized quality settings
      const screenshotOptions = {
        type: exportFormat === 'jpeg' ? 'jpeg' : 'png',
        fullPage: false,
        clip: {
          x: 0,
          y: 0,
          width: Math.round(resolutionConfig.width * qualitySettings.scalingFactor),
          height: Math.round(resolutionConfig.height * qualitySettings.scalingFactor)
        }
      };

      // Add format-specific quality settings
      if (exportFormat === 'jpeg') {
        screenshotOptions.quality = formatQualitySettings.quality;
        // JPEG doesn't support transparency, so no background color needed in Puppeteer
      }

      // Add quality optimization settings
      if (qualitySettings.optimization !== 'minimal') {
        screenshotOptions.optimizeForSpeed = qualitySettings.optimization === 'high';
      }

      // Add anti-aliasing configuration
      if (antiAliasing) {
        screenshotOptions.captureBeyondViewport = false; // Better for anti-aliasing
      }

      const screenshot = await page.screenshot(screenshotOptions);

      // Save to file if output path provided
      if (outputPath) {
        await fsPromises.writeFile(outputPath, screenshot);
        console.log(`MapService: Map saved to ${outputPath}`);
      }

      console.log(`MapService: ${format} ${orientation} map generated successfully at ${resolutionConfig.dpi} DPI`);
      
      return {
        image: screenshot,
        metadata: {
          format,
          orientation,
          requestedDPI: dpi,
          actualDPI: qualitySettings.actualDPI,
          dimensions: {
            logical: { width: resolutionConfig.width, height: resolutionConfig.height },
            physical: { 
              width: Math.round(resolutionConfig.width * qualitySettings.scalingFactor), 
              height: Math.round(resolutionConfig.height * qualitySettings.scalingFactor) 
            }
          },
          memoryUsage: resolutionConfig.memoryMB,
          optimized: resolutionConfig.optimized,
          scalingFactor: qualitySettings.scalingFactor,
          quality: qualitySettings
        }
      };

    } catch (error) {
      console.error('MapService: Browser-based map generation failed:', error);
      throw error;
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  /**
   * Ensure browser is ready and healthy
   */
  async ensureBrowserReady() {
    if (!this.browser || !this.browser.isConnected()) {
      console.log('MapService: Browser not ready, initializing...');
      await this.initialize();
      return;
    }

    // Test browser health
    try {
      await this.browser.version();
      console.log('MapService: Browser is ready and healthy');
    } catch (error) {
      console.log('MapService: Browser health check failed, reinitializing...');
      await this.initialize();
    }
  }

  /**
   * Convert options for fallback methods
   */
  convertOptionsForFallback(mapOptions) {
    return {
      id: mapOptions.id || `fallback_${Date.now()}`,
      routeCoordinates: mapOptions.routeCoordinates,
      route: {
        coordinates: mapOptions.routeCoordinates,
        color: mapOptions.routeColor || '#ff4444',
        width: mapOptions.routeWidth || 4
      },
      bounds: mapOptions.bounds,
      center: mapOptions.center,
      style: mapOptions.style || 'streets-v12',
      format: mapOptions.format || 'A4',
      orientation: mapOptions.orientation || 'portrait',
      dpi: mapOptions.dpi || 300,
      width: mapOptions.width,
      height: mapOptions.height,
      markers: mapOptions.showStartEnd ? {
        start: mapOptions.routeCoordinates?.[0],
        end: mapOptions.routeCoordinates?.[mapOptions.routeCoordinates.length - 1]
      } : null,
      settings: {
        mainTitle: mapOptions.title,
        titleColor: '#1f2937',
        subtitleColor: '#6b7280'
      }
    };
  }

  /**
   * Enhanced Print dimensions configuration at 300 DPI
   * Comprehensive specifications including physical dimensions, pricing, and metadata
   */
  static PRINT_CONFIG = {
    // Standard ISO 216 paper sizes at 300 DPI
    A0: {
      name: 'A0',
      description: 'Extra Large Professional Print',
      physicalSize: { width: 841, height: 1189, unit: 'mm' }, // ISO 216 standard
      portrait: { 
        width: 9933, height: 14043,
        widthInches: 33.11, heightInches: 46.81,
        aspectRatio: 0.707
      },
      landscape: { 
        width: 14043, height: 9933,
        widthInches: 46.81, heightInches: 33.11,
        aspectRatio: 1.414
      },
      pricing: { portrait: 19999, landscape: 19999 }, // $199.99 in cents
      memoryEstimateMB: { portrait: 560, landscape: 560 },
      recommendedViewingDistance: '6 feet',
      useCase: 'Architectural plans, large venue displays',
      available: false // Not commonly offered
    },
    A1: {
      name: 'A1',
      description: 'Large Professional Print',
      physicalSize: { width: 594, height: 841, unit: 'mm' },
      portrait: { 
        width: 7016, height: 9933,
        widthInches: 23.39, heightInches: 33.11,
        aspectRatio: 0.707
      },
      landscape: { 
        width: 9933, height: 7016,
        widthInches: 33.11, heightInches: 23.39,
        aspectRatio: 1.414
      },
      pricing: { portrait: 12999, landscape: 12999 }, // $129.99 in cents
      memoryEstimateMB: { portrait: 280, landscape: 280 },
      recommendedViewingDistance: '4 feet',
      useCase: 'Engineering drawings, presentation displays',
      available: false // Not commonly offered
    },
    A2: {
      name: 'A2',
      description: 'Medium-Large Professional Print',
      physicalSize: { width: 420, height: 594, unit: 'mm' },
      portrait: { 
        width: 4961, height: 7016,
        widthInches: 16.54, heightInches: 23.39,
        aspectRatio: 0.707
      },
      landscape: { 
        width: 7016, height: 4961,
        widthInches: 23.39, heightInches: 16.54,
        aspectRatio: 1.414
      },
      pricing: { portrait: 7999, landscape: 7999 }, // $79.99 in cents
      memoryEstimateMB: { portrait: 140, landscape: 140 },
      recommendedViewingDistance: '3 feet',
      useCase: 'Posters, wall art, detailed maps',
      available: false // Not commonly offered
    },
    A3: {
      name: 'A3',
      description: 'Large Premium Print',
      physicalSize: { width: 297, height: 420, unit: 'mm' },
      portrait: { 
        width: 3508, height: 4961,
        widthInches: 11.69, heightInches: 16.54,
        aspectRatio: 0.707
      },
      landscape: { 
        width: 4961, height: 3508,
        widthInches: 16.54, heightInches: 11.69,
        aspectRatio: 1.414
      },
      pricing: { portrait: 4999, landscape: 4999 }, // $49.99 in cents
      memoryEstimateMB: { portrait: 70, landscape: 70 },
      recommendedViewingDistance: '2 feet',
      useCase: 'Wall art, detailed route maps, office display',
      available: true,
      popular: true
    },
    A4: {
      name: 'A4',
      description: 'Standard Premium Print',
      physicalSize: { width: 210, height: 297, unit: 'mm' },
      portrait: { 
        width: 2480, height: 3508,
        widthInches: 8.27, heightInches: 11.69,
        aspectRatio: 0.707
      },
      landscape: { 
        width: 3508, height: 2480,
        widthInches: 11.69, heightInches: 8.27,
        aspectRatio: 1.414
      },
      pricing: { portrait: 2999, landscape: 2999 }, // $29.99 in cents
      memoryEstimateMB: { portrait: 35, landscape: 35 },
      recommendedViewingDistance: '1.5 feet',
      useCase: 'Desk display, framing, personal keepsake',
      available: true,
      popular: true,
      default: true
    },
    // Extended formats for future use
    A5: {
      name: 'A5',
      description: 'Small Premium Print',
      physicalSize: { width: 148, height: 210, unit: 'mm' },
      portrait: { 
        width: 1748, height: 2480,
        widthInches: 5.83, heightInches: 8.27,
        aspectRatio: 0.707
      },
      landscape: { 
        width: 2480, height: 1748,
        widthInches: 8.27, heightInches: 5.83,
        aspectRatio: 1.414
      },
      pricing: { portrait: 1999, landscape: 1999 }, // $19.99 in cents
      memoryEstimateMB: { portrait: 17, landscape: 17 },
      recommendedViewingDistance: '1 foot',
      useCase: 'Compact display, travel memento',
      available: false // Future offering
    },
    // Custom aspect ratios for specialized use cases
    SQUARE_SMALL: {
      name: 'Square Small',
      description: 'Compact Square Print',
      physicalSize: { width: 254, height: 254, unit: 'mm' }, // 10" x 10"
      portrait: { 
        width: 3000, height: 3000,
        widthInches: 10, heightInches: 10,
        aspectRatio: 1.0
      },
      landscape: { 
        width: 3000, height: 3000,
        widthInches: 10, heightInches: 10,
        aspectRatio: 1.0
      },
      pricing: { portrait: 3499, landscape: 3499 }, // $34.99 in cents
      memoryEstimateMB: { portrait: 36, landscape: 36 },
      recommendedViewingDistance: '1.5 feet',
      useCase: 'Instagram-style display, social media prints',
      available: false // Custom offering
    },
    SQUARE_LARGE: {
      name: 'Square Large',
      description: 'Large Square Print',
      physicalSize: { width: 381, height: 381, unit: 'mm' }, // 15" x 15"
      portrait: { 
        width: 4500, height: 4500,
        widthInches: 15, heightInches: 15,
        aspectRatio: 1.0
      },
      landscape: { 
        width: 4500, height: 4500,
        widthInches: 15, heightInches: 15,
        aspectRatio: 1.0
      },
      pricing: { portrait: 5999, landscape: 5999 }, // $59.99 in cents
      memoryEstimateMB: { portrait: 81, landscape: 81 },
      recommendedViewingDistance: '2.5 feet',
      useCase: 'Gallery wall, statement piece',
      available: false // Custom offering
    }
  };

  /**
   * Get enhanced print dimensions for specific format and orientation
   */
  getPrintDimensions(format, orientation = 'portrait') {
    const formatKey = format.toUpperCase();
    const orientationKey = orientation.toLowerCase();

    if (!this.constructor.PRINT_CONFIG[formatKey]) {
      const supportedFormats = Object.keys(this.constructor.PRINT_CONFIG).join(', ');
      throw new Error(`Unsupported format: ${format}. Supported formats: ${supportedFormats}`);
    }

    if (!this.constructor.PRINT_CONFIG[formatKey][orientationKey]) {
      throw new Error(`Unsupported orientation: ${orientation}. Supported orientations: portrait, landscape`);
    }

    const config = this.constructor.PRINT_CONFIG[formatKey];
    const dimensions = config[orientationKey];
    
    // Return comprehensive print information
    return {
      // Basic dimensions
      width: dimensions.width,
      height: dimensions.height,
      format: formatKey,
      orientation: orientationKey,
      dpi: 300,
      
      // Physical dimensions
      widthInches: dimensions.widthInches,
      heightInches: dimensions.heightInches,
      physicalSize: config.physicalSize,
      aspectRatio: dimensions.aspectRatio,
      
      // Metadata
      name: config.name,
      description: config.description,
      useCase: config.useCase,
      recommendedViewingDistance: config.recommendedViewingDistance,
      
      // Commercial information
      pricing: config.pricing[orientationKey],
      available: config.available || false,
      popular: config.popular || false,
      default: config.default || false,
      
      // Technical information
      memoryEstimateMB: config.memoryEstimateMB[orientationKey],
      totalPixels: dimensions.width * dimensions.height,
      
      // Legacy compatibility
      widthInches: (dimensions.width / 300).toFixed(2),
      heightInches: (dimensions.height / 300).toFixed(2)
    };
  }

  /**
   * Get all available print sizes (only those marked as available)
   */
  getAvailablePrintSizes() {
    const availableSizes = {};
    
    Object.entries(this.constructor.PRINT_CONFIG).forEach(([key, config]) => {
      if (config.available) {
        availableSizes[key] = {
          name: config.name,
          description: config.description,
          physicalSize: config.physicalSize,
          useCase: config.useCase,
          popular: config.popular || false,
          default: config.default || false,
          pricing: config.pricing,
          memoryEstimateMB: config.memoryEstimateMB,
          portrait: {
            ...config.portrait,
            totalPixels: config.portrait.width * config.portrait.height
          },
          landscape: {
            ...config.landscape,
            totalPixels: config.landscape.width * config.landscape.height
          }
        };
      }
    });
    
    return availableSizes;
  }

  /**
   * Get print size comparison data for UI
   */
  getPrintSizeComparison() {
    const availableSizes = this.getAvailablePrintSizes();
    const comparison = [];
    
    Object.entries(availableSizes).forEach(([key, config]) => {
      comparison.push({
        id: key,
        name: config.name,
        description: config.description,
        physicalSize: config.physicalSize,
        useCase: config.useCase,
        popular: config.popular,
        default: config.default,
        pricing: config.pricing,
        dimensions: {
          portrait: {
            width: config.portrait.width,
            height: config.portrait.height,
            widthInches: config.portrait.widthInches,
            heightInches: config.portrait.heightInches,
            aspectRatio: config.portrait.aspectRatio,
            memoryMB: config.memoryEstimateMB.portrait
          },
          landscape: {
            width: config.landscape.width,
            height: config.landscape.height,
            widthInches: config.landscape.widthInches,
            heightInches: config.landscape.heightInches,
            aspectRatio: config.landscape.aspectRatio,
            memoryMB: config.memoryEstimateMB.landscape
          }
        }
      });
    });
    
    // Sort by popularity and size (A4 first, then A3)
    comparison.sort((a, b) => {
      if (a.default) return -1;
      if (b.default) return 1;
      if (a.popular && !b.popular) return -1;
      if (b.popular && !a.popular) return 1;
      return a.name.localeCompare(b.name);
    });
    
    return comparison;
  }

  /**
   * Calculate print size recommendations based on content and usage
   */
  getRecommendedPrintSize(mapBounds, intendedUse = 'general') {
    const recommendations = [];
    const availableSizes = this.getAvailablePrintSizes();
    
    // Calculate content complexity (simplified)
    const boundsWidth = Math.abs(mapBounds.east - mapBounds.west);
    const boundsHeight = Math.abs(mapBounds.north - mapBounds.south);
    const contentAspectRatio = boundsWidth / boundsHeight;
    
    Object.entries(availableSizes).forEach(([key, config]) => {
      ['portrait', 'landscape'].forEach(orientation => {
        const dims = config[orientation];
        const printAspectRatio = dims.aspectRatio;
        const aspectRatioMatch = Math.abs(contentAspectRatio - printAspectRatio) < 0.3;
        
        let score = 0;
        let reasons = [];
        
        // Aspect ratio matching
        if (aspectRatioMatch) {
          score += 30;
          reasons.push('Good aspect ratio match');
        }
        
        // Default and popular sizes get bonuses
        if (config.default) {
          score += 20;
          reasons.push('Most popular size');
        }
        if (config.popular) {
          score += 10;
          reasons.push('Popular choice');
        }
        
        // Use case matching
        if (intendedUse === 'wall-art' && key === 'A3') {
          score += 15;
          reasons.push('Ideal for wall display');
        } else if (intendedUse === 'desk' && key === 'A4') {
          score += 15;
          reasons.push('Perfect for desk display');
        }
        
        // Memory considerations
        if (dims.memoryMB < 50) {
          score += 5;
          reasons.push('Memory efficient');
        }
        
        recommendations.push({
          format: key,
          orientation,
          score,
          reasons,
          ...this.getPrintDimensions(key, orientation)
        });
      });
    });
    
    // Sort by score (highest first)
    recommendations.sort((a, b) => b.score - a.score);
    
    return recommendations.slice(0, 4); // Return top 4 recommendations
  }

  /**
   * Toggle orientation for given dimensions
   */
  toggleOrientation(format, currentOrientation) {
    const newOrientation = currentOrientation === 'portrait' ? 'landscape' : 'portrait';
    return this.getPrintDimensions(format, newOrientation);
  }

  /**
   * Validate print dimensions
   */
  validatePrintDimensions(width, height, dpi = 300) {
    if (!Number.isInteger(width) || width <= 0) {
      throw new Error('Width must be a positive integer');
    }
    if (!Number.isInteger(height) || height <= 0) {
      throw new Error('Height must be a positive integer');
    }
    if (!Number.isInteger(dpi) || dpi <= 0) {
      throw new Error('DPI must be a positive integer');
    }
    
    // Check for reasonable print size limits (max ~50 inches at 300 DPI)
    const maxPixels = 15000; // ~50 inches at 300 DPI
    if (width > maxPixels || height > maxPixels) {
      throw new Error(`Dimensions too large. Maximum supported: ${maxPixels}px (${(maxPixels/300).toFixed(1)}" at 300 DPI)`);
    }

    // Check minimum size (at least 1 inch at 300 DPI)
    const minPixels = 300;
    if (width < minPixels || height < minPixels) {
      throw new Error(`Dimensions too small. Minimum supported: ${minPixels}px (1" at 300 DPI)`);
    }

    return true;
  }

  /**
   * Check if format is valid
   */
  isValidPrintSize(format) {
    return this.constructor.PRINT_CONFIG.hasOwnProperty(format.toUpperCase());
  }

  /**
   * Calculate pixels from millimeters at given DPI
   */
  calculatePixelsFromMM(mm, dpi = 300) {
    const inches = mm / 25.4; // Convert mm to inches
    return Math.round(inches * dpi);
  }

  /**
   * Calculate pixel dimensions from physical dimensions
   */
  calculatePixelDimensions(widthMM, heightMM, dpi = 300) {
    return {
      width: this.calculatePixelsFromMM(widthMM, dpi),
      height: this.calculatePixelsFromMM(heightMM, dpi),
      dpi
    };
  }

  /**
   * Get optimal scale factor for viewport display
   */
  getOptimalScale(format, orientation = 'portrait', viewportSize = { width: 1200, height: 800 }) {
    const printDimensions = this.getPrintDimensions(format, orientation);
    
    const scaleX = viewportSize.width / printDimensions.width;
    const scaleY = viewportSize.height / printDimensions.height;
    
    // Use the smaller scale to ensure the entire print area fits
    return Math.min(scaleX, scaleY, 1); // Don't scale up beyond 1:1
  }

  /**
   * Calculate container dimensions for display
   */
  calculateContainerDimensions(format, orientation = 'portrait', scale = 1) {
    const printDimensions = this.getPrintDimensions(format, orientation);
    
    return {
      width: Math.round(printDimensions.width * scale),
      height: Math.round(printDimensions.height * scale),
      scale,
      originalWidth: printDimensions.width,
      originalHeight: printDimensions.height
    };
  }

  /**
   * Resize map container for specific print format
   */
  resizeMapContainer(mapElement, format, orientation = 'portrait', viewportSize = null) {
    if (!mapElement) {
      throw new Error('Map element is required');
    }

    const scale = viewportSize ? 
      this.getOptimalScale(format, orientation, viewportSize) : 
      1;

    const containerDimensions = this.calculateContainerDimensions(format, orientation, scale);

    // Apply dimensions to DOM element
    mapElement.style.width = `${containerDimensions.width}px`;
    mapElement.style.height = `${containerDimensions.height}px`;

    return containerDimensions;
  }

  /**
   * Get all supported print formats with their dimensions
   */
  getSupportedFormats() {
    const formats = {};
    
    Object.keys(this.constructor.PRINT_CONFIG).forEach(format => {
      formats[format] = {
        portrait: this.getPrintDimensions(format, 'portrait'),
        landscape: this.getPrintDimensions(format, 'landscape')
      };
    });

    return formats;
  }

  /**
   * Calculate poster bounds that center the route within the poster aspect ratio
   * @param {Object} routeBounds - Original route bounds {north, south, east, west}
   * @param {string} format - Print format (A4, A3, etc.)
   * @param {string} orientation - Portrait or landscape
   * @param {number} marginPercent - Margin percentage (default: 15%)
   * @returns {Object} Expanded bounds for poster framing
   */
  calculatePosterBounds(routeBounds, format = 'A4', orientation = 'portrait', marginPercent = 15) {
    // Get poster aspect ratio
    const dimensions = this.getPrintDimensions(format, orientation);
    const posterAspectRatio = dimensions.width / dimensions.height; // width/height ratio
    
    // Calculate route center and extent
    const routeCenter = {
      lat: (routeBounds.north + routeBounds.south) / 2,
      lng: (routeBounds.east + routeBounds.west) / 2
    };
    
    const routeExtent = {
      latSpan: Math.abs(routeBounds.north - routeBounds.south),
      lngSpan: Math.abs(routeBounds.east - routeBounds.west)
    };
    
    // Calculate current route aspect ratio (lng/lat)
    const routeAspectRatio = routeExtent.lngSpan / routeExtent.latSpan;
    
    console.log(`MapService: Route aspect ratio: ${routeAspectRatio.toFixed(3)}, Poster aspect ratio: ${posterAspectRatio.toFixed(3)}`);
    
    // Determine which dimension needs to be expanded to match poster aspect ratio
    let finalLngSpan, finalLatSpan;
    
    if (routeAspectRatio > posterAspectRatio) {
      // Route is wider than poster ratio - expand latitude
      finalLngSpan = routeExtent.lngSpan;
      finalLatSpan = finalLngSpan / posterAspectRatio;
    } else {
      // Route is taller than poster ratio - expand longitude  
      finalLatSpan = routeExtent.latSpan;
      finalLngSpan = finalLatSpan * posterAspectRatio;
    }
    
    // Apply margin padding (expand further by marginPercent)
    const marginMultiplier = 1 + (marginPercent / 100);
    finalLngSpan *= marginMultiplier;
    finalLatSpan *= marginMultiplier;
    
    // Calculate final poster bounds centered on route
    const posterBounds = {
      north: routeCenter.lat + (finalLatSpan / 2),
      south: routeCenter.lat - (finalLatSpan / 2),
      east: routeCenter.lng + (finalLngSpan / 2),
      west: routeCenter.lng - (finalLngSpan / 2)
    };
    
    console.log(`MapService: Original route bounds:`, routeBounds);
    console.log(`MapService: Calculated poster bounds:`, posterBounds);
    console.log(`MapService: Expansion - Lng: ${(finalLngSpan / routeExtent.lngSpan).toFixed(2)}x, Lat: ${(finalLatSpan / routeExtent.latSpan).toFixed(2)}x`);
    
    return posterBounds;
  }

  /**
   * Generate HTML content for map rendering - LEGACY METHOD - Use generateValidatedMapHTML instead
   * This method is deprecated and should not be used. It lacks proper validation.
   */
  generateMapHTML_OLD_DEPRECATED(options) {
    const {
      routeCoordinates,
      bounds,
      center,
      style,
      routeColor,
      routeWidth,
      showStartEnd,
      title,
      dimensions,
      format = 'A4',
      orientation = 'portrait',
      qualitySettings = { scalingFactor: 3, optimization: 'low' }
    } = options;

    // Convert coordinates to GeoJSON format
    const routeGeoJSON = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: routeCoordinates.map(coord => [coord[1], coord[0]]) // [lng, lat] for GeoJSON
      }
    };

    // Calculate scaling-dependent sizes
    const scalingFactor = qualitySettings.scalingFactor;
    const actualWidth = Math.round(dimensions.width * scalingFactor);
    const actualHeight = Math.round(dimensions.height * scalingFactor);
    const actualDPI = dimensions.dpi || Math.round(96 * scalingFactor);

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Map Export - ${actualDPI} DPI</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <script src='https://api.mapbox.com/mapbox-gl-js/v3.13.0/mapbox-gl.js'></script>
    <link href='https://api.mapbox.com/mapbox-gl-js/v3.13.0/mapbox-gl.css' rel='stylesheet' />
    <style>
        body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
        /* Map sized dynamically based on resolution requirements */
        #map { width: ${actualWidth}px; height: ${actualHeight}px; }
        .map-title {
            position: absolute;
            top: ${Math.round(20 * scalingFactor)}px;
            left: ${Math.round(20 * scalingFactor)}px;
            z-index: 1000;
            background: rgba(255, 255, 255, 0.9);
            padding: ${Math.round(10 * scalingFactor)}px ${Math.round(15 * scalingFactor)}px;
            border-radius: ${Math.round(4 * scalingFactor)}px;
            font-weight: bold;
            font-size: ${Math.round(18 * scalingFactor)}px;
            box-shadow: 0 ${Math.round(2 * scalingFactor)}px ${Math.round(4 * scalingFactor)}px rgba(0,0,0,0.2);
            max-width: ${Math.round(300 * scalingFactor)}px;
            word-wrap: break-word;
        }
        .print-info {
            position: absolute;
            bottom: ${Math.round(10 * scalingFactor)}px;
            right: ${Math.round(10 * scalingFactor)}px;
            z-index: 1000;
            background: rgba(255, 255, 255, 0.8);
            padding: ${Math.round(5 * scalingFactor)}px ${Math.round(10 * scalingFactor)}px;
            border-radius: ${Math.round(3 * scalingFactor)}px;
            font-size: ${Math.round(10 * scalingFactor)}px;
            color: #666;
        }
    </style>
</head>
<body>
    <div id="map"></div>
    ${title ? `<div class="map-title">${title}</div>` : ''}
    <div class="print-info">Generated by Print My Ride • ${format} ${orientation} • ${actualDPI} DPI</div>
    
    <script>
        window.mapLoaded = false;
        
        // Mapbox access token
        mapboxgl.accessToken = '${this.appConfig.mapbox.accessToken}';
        
        // Create map
        const map = new mapboxgl.Map({
            container: 'map',
            style: '${MapService.normalizeMapboxStyleURL(style)}',
            center: [${center[1]}, ${center[0]}],
            zoom: 12,
            preserveDrawingBuffer: true,
            interactive: false,
            attributionControl: false
        });

        map.on('load', function() {
            // Add route source
            map.addSource('route', {
                type: 'geojson',
                data: ${JSON.stringify(routeGeoJSON)}
            });

            // Add route layer
            map.addLayer({
                id: 'route',
                type: 'line',
                source: 'route',
                layout: {
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                paint: {
                    'line-color': '${routeColor}',
                    'line-width': ${Math.round(routeWidth * scalingFactor)} // Scaled for target DPI
                }
            });

            ${showStartEnd ? `
            // Add start marker
            const startCoord = ${JSON.stringify(routeCoordinates[0])};
            new mapboxgl.Marker({
                color: '#10B981'
            })
            .setLngLat([startCoord[1], startCoord[0]])
            .addTo(map);

            // Add end marker
            const endCoord = ${JSON.stringify(routeCoordinates[routeCoordinates.length - 1])};
            new mapboxgl.Marker({
                color: '#EF4444'
            })
            .setLngLat([endCoord[1], endCoord[0]])
            .addTo(map);
            ` : ''}

            // Fit to poster bounds with minimal padding (scaled for target DPI)
            // Bounds are already calculated as poster bounds in the backend
            const boundsPadding = Math.round(20 * scalingFactor); // Minimal padding since bounds are already expanded
            console.log('Fitting map to pre-calculated poster bounds:', {
                north: ${bounds.north},
                south: ${bounds.south},
                east: ${bounds.east},
                west: ${bounds.west}
            });
            
            map.fitBounds([
                [${bounds.west}, ${bounds.south}],
                [${bounds.east}, ${bounds.north}]
            ], {
                padding: boundsPadding
            });

            // Mark as loaded after a short delay to ensure rendering is complete
            setTimeout(function() {
                window.mapLoaded = true;
            }, 2000);
        });

        map.on('error', function(e) {
            console.error('Map error:', e);
            const errorMsg = e.error?.message || e.message || 'Map initialization failed';
            
            // If style-related error, try fallback to default style
            if (errorMsg.includes('style') || errorMsg.includes('Failed to parse URL') || errorMsg.includes('Failed to construct')) {
                console.warn('Style error detected, attempting fallback to default style');
                window.mapError = 'Style loading failed, using default style: ' + errorMsg;
                
                // Try to create a new map with default style
                try {
                    const fallbackMap = new mapboxgl.Map({
                        container: 'map',
                        style: 'mapbox://styles/mapbox/streets-v12',
                        center: [${center[1]}, ${center[0]}],
                        zoom: 12,
                        preserveDrawingBuffer: true,
                        interactive: false,
                        attributionControl: false
                    });
                    
                    // Replace the original map instance
                    window.map = fallbackMap;
                    
                    // Re-setup event handlers for fallback map
                    fallbackMap.on('load', function() {
                        // Add route source
                        fallbackMap.addSource('route', {
                            type: 'geojson',
                            data: ${JSON.stringify(routeGeoJSON)}
                        });

                        // Add route layer
                        fallbackMap.addLayer({
                            id: 'route',
                            type: 'line',
                            source: 'route',
                            layout: {
                                'line-join': 'round',
                                'line-cap': 'round'
                            },
                            paint: {
                                'line-color': '${routeColor}',
                                'line-width': ${Math.round(routeWidth * scalingFactor)}
                            }
                        });

                        ${showStartEnd ? `
                        // Add start marker
                        const startCoord = ${JSON.stringify(routeCoordinates[0])};
                        new mapboxgl.Marker({
                            color: '#10B981'
                        })
                        .setLngLat([startCoord[1], startCoord[0]])
                        .addTo(fallbackMap);

                        // Add end marker
                        const endCoord = ${JSON.stringify(routeCoordinates[routeCoordinates.length - 1])};
                        new mapboxgl.Marker({
                            color: '#EF4444'
                        })
                        .setLngLat([endCoord[1], endCoord[0]])
                        .addTo(fallbackMap);
                        ` : ''}

                        // Fit to poster bounds
                        const boundsPadding = Math.round(20 * scalingFactor);
                        fallbackMap.fitBounds([
                            [${bounds.west}, ${bounds.south}],
                            [${bounds.east}, ${bounds.north}]
                        ], {
                            padding: boundsPadding
                        });

                        // Mark as loaded
                        setTimeout(function() {
                            window.mapLoaded = true;
                        }, 2000);
                    });
                    
                    fallbackMap.on('error', function() {
                        console.error('Fallback map also failed');
                        window.mapError = 'Both primary and fallback styles failed to load';
                        window.mapLoaded = true;
                    });
                } catch (fallbackError) {
                    console.error('Failed to create fallback map:', fallbackError);
                    window.mapError = 'Failed to create fallback map: ' + fallbackError.message;
                    window.mapLoaded = true;
                }
            } else {
                window.mapError = errorMsg;
                window.mapLoaded = true; // Prevent infinite waiting
            }
        });
    </script>
</body>
</html>`;
  }

  /**
   * Generate HTML content for map rendering - MAIN METHOD
   * Handles both old-style and new-style parameter formats
   */
  generateMapHTML(options) {
    // Check if this is new-style config (has route.coordinates) or old-style (has routeCoordinates)
    if (options.route && options.route.coordinates) {
      // New-style config - use validated method directly
      return this.generateValidatedMapHTML(options);
    } else {
      // Old-style config - convert to new format
      const convertedConfig = {
        width: options.dimensions?.width || options.width || 800,
        height: options.dimensions?.height || options.height || 600,
        center: options.center || [-0.127, 51.507],
        bounds: options.bounds || {
          west: -0.2,
          east: 0.0,
          south: 51.4,
          north: 51.6
        },
        style: options.style || 'mapbox://styles/mapbox/streets-v12',
        route: {
          coordinates: options.routeCoordinates || [],
          color: options.routeColor || '#fc5200',
          width: options.routeWidth || 4
        },
        markers: options.showStartEnd && options.routeCoordinates && options.routeCoordinates.length >= 2 ? {
          start: options.routeCoordinates[0],
          end: options.routeCoordinates[options.routeCoordinates.length - 1]
        } : null,
        title: options.title || '',
        format: options.format || 'A4',
        orientation: options.orientation || 'portrait',
        dpi: options.dimensions?.dpi || options.dpi || 300
      };

      console.log('[MapService] Converting old-style parameters to new format for HTML generation');
      return this.generateValidatedMapHTML(convertedConfig);
    }
  }

  /**
   * Generate map preview optimized for fast display
   */
  async generatePreview(mapOptions, maxDimension = 800) {
    const {
      format = 'A4',
      orientation = 'portrait'
    } = mapOptions;

    // Get target dimensions
    const targetDimensions = this.getPrintDimensions(format, orientation);
    
    // Calculate preview dimensions using resolution manager
    const previewConfig = this.resolutionManager.getPreviewDimensions(
      targetDimensions.width,
      targetDimensions.height,
      maxDimension
    );

    // Create preview options with optimized settings
    const previewOptions = {
      ...mapOptions,
      dpi: previewConfig.dpi,
      memoryOptimization: false, // Previews are already optimized
      maxMemoryMB: 100 // Low memory limit for previews
    };

    // Override dimensions temporarily
    const originalGetDimensions = this.getPrintDimensions;
    this.getPrintDimensions = (format, orientation) => {
      if (mapOptions.format === format) {
        return {
          width: previewConfig.width,
          height: previewConfig.height,
          format: format,
          orientation: orientation,
          dpi: previewConfig.dpi,
          isPreview: true
        };
      }
      return originalGetDimensions.call(this, format, orientation);
    };

    try {
      const result = await this.generateMap(previewOptions);
      
      // Return just the image for previews (not full metadata)
      return {
        image: result.image || result, // Handle both new and old return formats
        metadata: {
          ...result.metadata,
          isPreview: true,
          previewDimensions: previewConfig,
          targetDimensions: targetDimensions
        }
      };
    } finally {
      // Restore original method
      this.getPrintDimensions = originalGetDimensions;
    }
  }

  /**
   * Batch generate multiple maps
   */
  async generateBatch(mapOptionsArray) {
    const results = [];
    
    for (const mapOptions of mapOptionsArray) {
      try {
        const screenshot = await this.generateMap(mapOptions);
        results.push({
          success: true,
          data: screenshot,
          options: mapOptions
        });
      } catch (error) {
        results.push({
          success: false,
          error: error.message,
          options: mapOptions
        });
      }
    }

    return results;
  }

  /**
   * Validate map options
   */
  validateMapOptions(mapOptions) {
    const required = ['routeCoordinates', 'bounds', 'center'];
    const missing = required.filter(field => !mapOptions[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    if (!Array.isArray(mapOptions.routeCoordinates) || mapOptions.routeCoordinates.length === 0) {
      throw new Error('routeCoordinates must be a non-empty array');
    }

    if (mapOptions.format && !this.isValidPrintSize(mapOptions.format)) {
      const supportedFormats = Object.keys(this.constructor.PRINT_CONFIG).join(', ');
      throw new Error(`format must be one of: ${supportedFormats}`);
    }

    if (mapOptions.orientation && !['portrait', 'landscape'].includes(mapOptions.orientation.toLowerCase())) {
      throw new Error('orientation must be portrait or landscape');
    }

    return true;
  }

  /**
   * Get available DPI presets and their configurations
   */
  getDPIPresets() {
    return this.resolutionManager.getDPIPresets();
  }

  /**
   * Calculate memory requirements for given parameters
   */
  calculateMemoryRequirements(width, height, dpi) {
    return this.resolutionManager.calculateMemoryRequirements(width, height, dpi);
  }

  /**
   * Get quality settings for target DPI
   */
  getQualitySettings(dpi) {
    return this.resolutionManager.getQualitySettings(dpi);
  }

  /**
   * Get format-specific quality settings
   * @param {string} format - 'png' or 'jpeg'
   * @param {string} qualityLevel - 'low', 'medium', or 'high'
   * @returns {Object} Format-specific quality settings
   */
  getFormatQualitySettings(format = 'png', qualityLevel = 'high') {
    const qualityPresets = {
      png: {
        low: { quality: 1.0, compressionLevel: 9, antiAliasing: true },
        medium: { quality: 1.0, compressionLevel: 6, antiAliasing: true },
        high: { quality: 1.0, compressionLevel: 3, antiAliasing: true }
      },
      jpeg: {
        low: { quality: 0.7, antiAliasing: true },
        medium: { quality: 0.85, antiAliasing: true },
        high: { quality: 0.95, antiAliasing: true }
      }
    };

    if (!qualityPresets[format]) {
      throw new Error(`Unsupported format: ${format}. Supported formats: png, jpeg`);
    }

    if (!qualityPresets[format][qualityLevel]) {
      throw new Error(`Invalid quality level: ${qualityLevel}. Supported levels: low, medium, high`);
    }

    return {
      ...qualityPresets[format][qualityLevel],
      format,
      qualityLevel
    };
  }

  /**
   * Optimize dimensions for memory constraints
   */
  optimizeForMemory(width, height, targetDPI, maxMemoryMB = 500) {
    return this.resolutionManager.optimizeForMemory(width, height, targetDPI, maxMemoryMB);
  }

  /**
   * Validate resolution parameters
   */
  validateResolutionParams(params) {
    return this.resolutionManager.validateResolutionParams(params);
  }

  /**
   * Get resolution configuration for format and DPI
   */
  getResolutionConfig(format, orientation = 'portrait', dpi = 300, enableOptimization = true, maxMemoryMB = 500) {
    const baseDimensions = this.getPrintDimensions(format, orientation);
    
    if (enableOptimization) {
      return this.resolutionManager.optimizeForMemory(
        baseDimensions.width,
        baseDimensions.height,
        dpi,
        maxMemoryMB
      );
    } else {
      const qualitySettings = this.resolutionManager.getQualitySettings(dpi);
      const memoryInfo = this.resolutionManager.calculateMemoryRequirements(
        baseDimensions.width,
        baseDimensions.height,
        dpi
      );
      
      return {
        width: baseDimensions.width,
        height: baseDimensions.height,
        dpi,
        scalingFactor: qualitySettings.scalingFactor,
        memoryMB: memoryInfo.estimatedMB,
        optimized: false,
        qualitySettings,
        memoryInfo
      };
    }
  }

  /**
   * Get service status and capabilities
   */
  async getStatus() {
    let browserConnected = false;
    
    if (this.browser) {
      try {
        browserConnected = this.browser.isConnected();
        // Additional check by testing if we can get pages
        if (browserConnected) {
          await this.browser.pages();
        }
      } catch (error) {
        browserConnected = false;
        // Reset state if browser connection is broken
        this.isInitialized = false;
        this.browser = null;
      }
    }

    return {
      initialized: this.isInitialized,
      browserConnected,
      supportedFormats: Object.keys(this.constructor.PRINT_CONFIG),
      supportedOrientations: ['portrait', 'landscape'],
      supportedStyles: [
        'streets-v11',
        'streets-v12',
        'satellite-v9',
        'light-v10',
        'dark-v10'
      ],
      resolutionCapabilities: {
        supportedDPIs: Object.values(this.resolutionManager.DPI_PRESETS),
        dpiRange: { min: 36, max: 1200 },
        memoryThresholds: this.resolutionManager.MEMORY_THRESHOLDS,
        hasMemoryOptimization: true,
        hasPreviewGeneration: true,
        supportedQualityLevels: Object.keys(this.resolutionManager.QUALITY_SETTINGS)
      }
    };
  }

  /**
   * Generate high-resolution map from validated preview configuration
   * This optimized method reuses a successful preview configuration,
   * skipping validation and normalization steps for better performance
   */
  async generateHighResFromPreviewConfig(highResConfig) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    console.log('MapService: Generating high-res map from preview config:', {
      id: highResConfig.id,
      dimensions: `${highResConfig.width}x${highResConfig.height}`,
      dpi: highResConfig.dpi,
      style: highResConfig.style,
      sourcePreview: 'reused_validated_config'
    });

    await this.ensureBrowserReady();
    const page = await this.browser.newPage();

    try {
      // Set viewport to target dimensions (already calculated for 300 DPI in PRINT_CONFIG)
      // No scaling needed - use dimensions directly for correct output resolution
      await page.setViewport({
        width: highResConfig.width,
        height: highResConfig.height,
        deviceScaleFactor: 1
      });

      // Create HTML for map rendering using validated config
      const mapHTML = this.generateMapHTML(highResConfig);
      
      // Set page content and wait for map to load
      await page.setContent(mapHTML, { waitUntil: 'networkidle2' });
      
      // Wait for Mapbox to finish loading (reuse same validation that worked for preview)
      await page.waitForFunction(() => {
        if (window.mapError) {
          throw new Error(window.mapError);
        }
        return window.mapboxgl && window.map && window.mapLoaded === true;
      }, { timeout: 60000 });

      // Take screenshot at high resolution
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substr(2, 9);
      const filename = `map_${highResConfig.format.toLowerCase()}_${highResConfig.orientation}_${timestamp}_${randomString}.png`;
      const filePath = path.join(this.appConfig.storage.generatedMapsDir, filename);

      await page.screenshot({
        path: filePath,
        fullPage: true,
        type: 'png'
      });

      // Get file stats
      const stats = fs.statSync(filePath);
      const { width: actualWidth, height: actualHeight } = await sharp(filePath).metadata();

      console.log('MapService: High-res map generated successfully:', {
        filePath,
        fileSize: Math.round(stats.size / 1024) + ' KB',
        dimensions: `${actualWidth}x${actualHeight}`,
        dpi: highResConfig.dpi,
        sourceConfig: 'preview_reused'
      });

      return filePath;

    } catch (error) {
      console.error('MapService: Error generating high-res map from preview config:', error);
      
      // Try Canvas fallback if WebGL fails
      if (error.message?.includes('WebGL') || error.message?.includes('Map initialization failed')) {
        console.log('MapService: WebGL failed for high-res, trying Canvas-based fallback...');
        try {
          return await this.generateCanvasMapFallback(highResConfig);
        } catch (fallbackError) {
          console.error('MapService: Canvas fallback also failed:', fallbackError);
          throw new Error(`High-res generation failed: ${error.message}, Canvas fallback: ${fallbackError.message}`);
        }
      }
      
      throw new Error(`High-res generation failed: ${error.message}`);
    } finally {
      try {
        if (!page.isClosed()) {
          await page.close();
        }
      } catch (closeError) {
        console.warn('MapService: Page was already closed:', closeError.message);
      }
    }
  }

  /**
   * Generate preview image for web-quality display
   * Optimized for fast generation and smaller file sizes
   */
  async generatePreviewImage(previewConfig) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    console.log('MapService: Generating preview image with config:', {
      id: previewConfig.id,
      format: previewConfig.format,
      dimensions: `${previewConfig.width}x${previewConfig.height}`,
      dpi: previewConfig.dpi
    });

    const page = await this.browser.newPage();
    
    try {
      // Set viewport for preview (web quality)
      await page.setViewport({
        width: previewConfig.width,
        height: previewConfig.height,
        deviceScaleFactor: 1 // Web quality, no scaling
      });

      // Create HTML for map rendering
      const mapHTML = this.generateMapHTML(previewConfig);
      
      // Set page content and wait for map to load
      await page.setContent(mapHTML, { waitUntil: 'networkidle2' });
      
      // Wait for Mapbox to finish loading
      try {
        await page.waitForFunction(
          () => {
            if (window.mapError) {
              throw new Error(window.mapError);
            }
            return window.mapboxgl && window.map && window.mapLoaded === true;
          },
          { timeout: 60000 }
        );
      } catch (error) {
        console.log('MapService: WebGL rendering failed, trying Canvas-based fallback...');
        console.log('WebGL error details:', error.message);
        await page.close();
        
        // Use Canvas-based fallback with proper config
        try {
          return await this.generateCanvasMapFallback(previewConfig);
        } catch (canvasError) {
          console.log('MapService: Canvas fallback also failed, trying Static Images API...');
          return await this.generateStaticMapFallback(previewConfig);
        }
      }

      // Additional wait for map to settle
      await page.waitForTimeout(2000);

      // Create preview directory if it doesn't exist
      const previewDir = path.join(this.appConfig.storage.generatedMapsDir, 'previews');
      await this.ensureDirectoryExists(previewDir);

      // Generate filename and save image
      const filename = `${previewConfig.id}.jpg`;
      const filePath = path.join(previewDir, filename);
      
      await page.screenshot({
        path: filePath,
        type: 'jpeg',
        quality: 85, // Good quality for web preview
        fullPage: false
      });

      console.log('MapService: Preview image generated successfully:', filePath);
      return filePath;

    } catch (error) {
      console.error('MapService: Error generating preview image:', error);
      throw new Error(`Preview generation failed: ${error.message}`);
    } finally {
      try {
        if (!page.isClosed()) {
          await page.close();
        }
      } catch (closeError) {
        console.warn('MapService: Page was already closed:', closeError.message);
      }
    }
  }

  /**
   * Generate HTML content for map rendering
   */
  generateValidatedMapHTML(config) {
    // Validate required configuration properties with comprehensive safe defaults
    const validatedConfig = {
      width: config.width || 800,
      height: config.height || 600,
      center: Array.isArray(config.center) && config.center.length === 2 ? config.center : [-0.127, 51.507], // Default to London
      bounds: config.bounds && typeof config.bounds === 'object' ? config.bounds : {
        west: -0.2,
        east: 0.0,
        south: 51.4,
        north: 51.6
      },
      style: config.style || 'mapbox://styles/mapbox/streets-v12',
      route: {
        coordinates: Array.isArray(config.route?.coordinates) ? config.route.coordinates : [],
        color: config.route?.color || '#fc5200',
        width: config.route?.width || 4
      },
      markers: config.markers || null,
      title: config.title || '',
      format: config.format || 'A4',
      orientation: config.orientation || 'portrait',
      dpi: config.dpi || 300
    };

    // Additional validation for route coordinates
    if (validatedConfig.route.coordinates.length > 0) {
      // Ensure all coordinates are valid [lng, lat] pairs
      validatedConfig.route.coordinates = validatedConfig.route.coordinates.filter(coord => {
        return Array.isArray(coord) && coord.length >= 2 && 
               typeof coord[0] === 'number' && typeof coord[1] === 'number' &&
               !isNaN(coord[0]) && !isNaN(coord[1]);
      });
      
      // If we filtered out invalid coordinates, log a warning
      if (validatedConfig.route.coordinates.length !== config.route?.coordinates?.length) {
        console.warn('[MapService] Filtered out invalid route coordinates');
      }
    }

    // Generate markers from route if not provided but route exists
    if (!validatedConfig.markers && validatedConfig.route.coordinates.length >= 2) {
      validatedConfig.markers = {
        start: validatedConfig.route.coordinates[0],
        end: validatedConfig.route.coordinates[validatedConfig.route.coordinates.length - 1]
      };
    }

    // Log configuration validation for debugging
    console.log('[MapService] Generating HTML with validated config:', {
      hasCenter: !!validatedConfig.center,
      hasBounds: !!validatedConfig.bounds,
      routeCoordCount: validatedConfig.route.coordinates.length,
      hasMarkers: !!validatedConfig.markers,
      originalStyle: config.style,
      validatedStyle: validatedConfig.style,
      normalizedStyle: MapService.normalizeMapboxStyleURL(validatedConfig.style)
    });

    const routeGeoJSON = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: validatedConfig.route.coordinates // Already in [lng, lat] format from decodePolyline
      },
      properties: {}
    };

    const markersGeoJSON = validatedConfig.markers ? {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: validatedConfig.markers.start // Already in [lng, lat] format
          },
          properties: { type: 'start' }
        },
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: validatedConfig.markers.end // Already in [lng, lat] format
          },
          properties: { type: 'end' }
        }
      ]
    } : null;

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Map Preview</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <script src="https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js"></script>
    <link href="https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css" rel="stylesheet">
    <style>
        body {
            margin: 0;
            padding: 0;
            width: ${validatedConfig.width}px;
            height: ${validatedConfig.height}px;
            overflow: hidden;
        }
        #map {
            width: 100%;
            height: 100%;
        }
    </style>
</head>
<body>
    <div id="map"></div>
    <script>
        mapboxgl.accessToken = '${this.appConfig.mapbox.accessToken}';
        console.log('[MapHTML] Mapbox access token:', mapboxgl.accessToken ? 'present (' + mapboxgl.accessToken.substring(0, 8) + '...)' : 'MISSING');
        
        // Map configuration with enhanced WebGL error handling and safe defaults
        const requestedStyle = '${MapService.normalizeMapboxStyleURL(validatedConfig.style)}';
        console.log('[MapHTML] Using map style:', requestedStyle);
        console.log('[MapHTML] Original style from config:', '${validatedConfig.style}');
        
        let mapOptions = {
            container: 'map',
            style: requestedStyle,
            center: [${validatedConfig.center[1]}, ${validatedConfig.center[0]}],
            bounds: [
                [${validatedConfig.bounds.west}, ${validatedConfig.bounds.south}],
                [${validatedConfig.bounds.east}, ${validatedConfig.bounds.north}]
            ],
            fitBoundsOptions: {
                padding: 40
            },
            attributionControl: false,
            antialias: false,
            failIfMajorPerformanceCaveat: false
        };

        window.map = null;
        window.mapLoaded = false;
        window.mapError = null;

        // Check WebGL support before initializing map
        function checkWebGLSupport() {
            try {
                const canvas = document.createElement('canvas');
                const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
                return !!gl;
            } catch (e) {
                return false;
            }
        }

        // Initialize map with enhanced error handling
        try {
            if (!checkWebGLSupport()) {
                console.warn('WebGL not supported, map may have limited functionality');
            }
            
            const map = new mapboxgl.Map(mapOptions);
            window.map = map;

            // Enhanced error handling
            map.on('error', function(e) {
                console.error('Mapbox error:', e);
                const errorMsg = e.error?.message || e.message || 'Map initialization failed';
                
                // If style-related error, try fallback to default style
                if (errorMsg.includes('style') || errorMsg.includes('Failed to parse URL') || errorMsg.includes('Failed to construct') || 
                    errorMsg.includes('Not Found') || errorMsg.includes('Unauthorized') || errorMsg.includes('403') || errorMsg.includes('401')) {
                    console.error('[MapHTML] Style loading failed for:', requestedStyle);
                    console.error('[MapHTML] Error details:', errorMsg);
                    console.warn('[MapHTML] Attempting fallback to default streets style');
                    window.mapError = 'Style loading failed, using default style: ' + errorMsg;
                    
                    // Try to create a new map with default style
                    try {
                        const fallbackMapOptions = {
                            ...mapOptions,
                            style: 'mapbox://styles/mapbox/streets-v12'
                        };
                        
                        const fallbackMap = new mapboxgl.Map(fallbackMapOptions);
                        window.map = fallbackMap;
                        
                        // Re-setup event handlers for fallback map
                        fallbackMap.on('load', function() {
                            window.mapLoaded = true;
                            // Add route source and layer
                            fallbackMap.addSource('route', {
                                type: 'geojson',
                                data: ${JSON.stringify(routeGeoJSON)}
                            });

                            fallbackMap.addLayer({
                                id: 'route',
                                type: 'line',
                                source: 'route',
                                layout: {
                                    'line-join': 'round',
                                    'line-cap': 'round'
                                },
                                paint: {
                                    'line-color': '${validatedConfig.route.color}',
                                    'line-width': ${validatedConfig.route.width}
                                }
                            });

                            ${validatedConfig.markers ? `
                            // Add markers
                            fallbackMap.addSource('markers', {
                                type: 'geojson',
                                data: ${JSON.stringify(markersGeoJSON)}
                            });

                            fallbackMap.addLayer({
                                id: 'start-marker',
                                type: 'circle',
                                source: 'markers',
                                filter: ['==', ['get', 'type'], 'start'],
                                paint: {
                                    'circle-radius': 8,
                                    'circle-color': '#00ff00',
                                    'circle-stroke-color': '#ffffff',
                                    'circle-stroke-width': 2
                                }
                            });

                            fallbackMap.addLayer({
                                id: 'end-marker',
                                type: 'circle',
                                source: 'markers',
                                filter: ['==', ['get', 'type'], 'end'],
                                paint: {
                                    'circle-radius': 8,
                                    'circle-color': '#ff0000',
                                    'circle-stroke-color': '#ffffff',
                                    'circle-stroke-width': 2
                                }
                            });
                            ` : ''}
                        });
                        
                        fallbackMap.on('error', function() {
                            console.error('Fallback map also failed');
                            window.mapError = 'Both primary and fallback styles failed to load';
                            window.mapLoaded = true;
                        });
                    } catch (fallbackError) {
                        console.error('Failed to create fallback map:', fallbackError);
                        window.mapError = 'Failed to create fallback map: ' + fallbackError.message;
                        window.mapLoaded = true;
                    }
                } else {
                    // Handle other types of errors
                    window.mapError = errorMsg;
                    
                    // Try to provide more specific error information
                    if (errorMsg.includes('WebGL')) {
                        window.mapError = 'Failed to initialize WebGL. Browser may not support WebGL or GPU acceleration is disabled.';
                    }
                    
                    window.mapLoaded = true;
                }
            });

            map.on('load', function() {
            window.mapLoaded = true;
            // Add route source and layer
            map.addSource('route', {
                type: 'geojson',
                data: ${JSON.stringify(routeGeoJSON)}
            });

            map.addLayer({
                id: 'route',
                type: 'line',
                source: 'route',
                layout: {
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                paint: {
                    'line-color': '${validatedConfig.route.color}',
                    'line-width': ${validatedConfig.route.width}
                }
            });

            ${validatedConfig.markers ? `
            // Add markers
            map.addSource('markers', {
                type: 'geojson',
                data: ${JSON.stringify(markersGeoJSON)}
            });

            map.addLayer({
                id: 'start-marker',
                type: 'circle',
                source: 'markers',
                filter: ['==', ['get', 'type'], 'start'],
                paint: {
                    'circle-radius': 8,
                    'circle-color': '#00ff00',
                    'circle-stroke-color': '#ffffff',
                    'circle-stroke-width': 2
                }
            });

            map.addLayer({
                id: 'end-marker',
                type: 'circle',
                source: 'markers',
                filter: ['==', ['get', 'type'], 'end'],
                paint: {
                    'circle-radius': 8,
                    'circle-color': '#ff0000',
                    'circle-stroke-color': '#ffffff',
                    'circle-stroke-width': 2
                }
            });
            ` : ''}
            });

        } catch (initError) {
            console.error('Map initialization error:', initError);
            window.mapError = 'Failed to create map instance: ' + initError.message;
        }
    </script>
</body>
</html>`;
  }

  /**
   * Generate map using Mapbox Static Images API as fallback
   * Supports higher resolution with proper coordinate handling
   */
  async generateStaticMapFallback(config) {
    console.log('MapService: Using Static Images API fallback');
    
    try {
      const polyline = require('@mapbox/polyline');
      
      // Extract and validate route coordinates with improved detection
      const coordinates = this.extractAndValidateCoordinates(config);
      if (!coordinates || coordinates.length === 0) {
        throw new Error('No valid route coordinates found for static map generation');
      }
      
      console.log('MapService: Processing coordinates for static map:', {
        count: coordinates.length,
        first: coordinates[0],
        last: coordinates[coordinates.length - 1]
      });
      
      // Convert coordinates to [lat, lng] format for polyline encoding
      const polylineCoords = this.convertToPolylineFormat(coordinates);
      const routePolyline = polyline.encode(polylineCoords);
      
      console.log('MapService: Generated polyline with length:', routePolyline.length);
      
      // Build Static API URL with proper dimensions
      const dimensions = this.getStaticMapDimensions(config);
      const retina = dimensions.retina ? '@2x' : '';
      
      // Get route styling
      const routeStyle = this.getRouteStyleString(config);
      
      // Calculate bounds with padding
      const bounds = this.calculateStaticMapBounds(config.bounds || this.calculateRouteBounds(coordinates));
      const boundsString = `[${bounds.west},${bounds.south},${bounds.east},${bounds.north}]`;
      
      // Handle style format
      const styleId = this.normalizeStyleId(config.style || 'streets-v12');
      
      // Construct Static API URL
      const staticUrl = `https://api.mapbox.com/styles/v1/mapbox/${styleId}/static/` +
        `path${routeStyle}(${encodeURIComponent(routePolyline)})/` +
        `${boundsString}/${dimensions.width}x${dimensions.height}${retina}` +
        `?access_token=${this.appConfig.mapbox.accessToken}`;
      
      console.log('MapService: Static API URL constructed:', {
        style: styleId,
        dimensions: `${dimensions.width}x${dimensions.height}${retina}`,
        boundsString,
        polylineLength: routePolyline.length
      });
      
      // Fetch with timeout and proper error handling
      const response = await this.fetchWithTimeout(staticUrl, 30000);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('MapService: Static API error response:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`Static API failed: ${response.status} - ${errorText}`);
      }
      
      const imageBuffer = await response.buffer();
      
      // Ensure output directory exists
      const outputDir = path.join(this.appConfig.storage.generatedMapsDir, 'temporary');
      await this.ensureDirectoryExists(outputDir);
      
      // Save to file
      const filename = `${config.id || 'static_map'}.png`;
      const filePath = path.join(outputDir, filename);
      
      await fsPromises.writeFile(filePath, imageBuffer);
      
      console.log('MapService: Static map fallback generated successfully:', {
        filePath,
        fileSize: imageBuffer.length,
        dimensions: `${dimensions.width}x${dimensions.height}${retina}`
      });
      
      return filePath;
      
    } catch (error) {
      console.error('MapService: Static API fallback failed:', error);
      throw new Error(`Static map generation failed: ${error.message}`);
    }
  }

  /**
   * Extract and validate coordinates from various config structures
   */
  extractAndValidateCoordinates(config) {
    let coordinates = [];
    
    // Try different possible coordinate sources
    if (config.route?.coordinates) {
      coordinates = config.route.coordinates;
    } else if (config.routeCoordinates) {
      coordinates = config.routeCoordinates;
    } else if (config.coordinates) {
      coordinates = config.coordinates;
    } else if (config.route?.geometry?.coordinates) {
      coordinates = config.route.geometry.coordinates;
    }
    
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length === 0) {
      console.error('MapService: No coordinates found in config:', {
        hasRoute: !!config.route,
        hasRouteCoordinates: !!config.route?.coordinates,
        hasDirectRouteCoordinates: !!config.routeCoordinates,
        hasDirectCoordinates: !!config.coordinates,
        hasGeometry: !!config.route?.geometry?.coordinates
      });
      return null;
    }
    
    // Validate coordinate format
    if (!Array.isArray(coordinates[0]) || coordinates[0].length < 2) {
      console.error('MapService: Invalid coordinate format:', coordinates[0]);
      return null;
    }
    
    return coordinates;
  }

  /**
   * Convert coordinates to [lat, lng] format for polyline encoding
   */
  convertToPolylineFormat(coordinates) {
    if (!coordinates || coordinates.length === 0) {
      return [];
    }
    
    const firstCoord = coordinates[0];
    
    // Detect coordinate format: [lat, lng] vs [lng, lat]
    // Latitude is typically smaller in absolute value and within [-90, 90]
    // Longitude is within [-180, 180]
    const isLngLat = Math.abs(firstCoord[0]) > Math.abs(firstCoord[1]) && 
                     Math.abs(firstCoord[0]) <= 180 && 
                     Math.abs(firstCoord[1]) <= 90;
    
    if (isLngLat) {
      // Convert [lng, lat] to [lat, lng]
      console.log('MapService: Converting [lng, lat] to [lat, lng] for polyline');
      return coordinates.map(coord => [coord[1], coord[0]]);
    } else {
      // Already in [lat, lng] format
      console.log('MapService: Using coordinates in [lat, lng] format');
      return coordinates.map(coord => [coord[0], coord[1]]);
    }
  }

  /**
   * Get appropriate dimensions for static map based on config
   */
  getStaticMapDimensions(config) {
    let width = config.width || 800;
    let height = config.height || 600;
    let retina = false;
    
    // For high-DPI requests, use retina and adjust dimensions
    if (config.dpi && config.dpi > 96) {
      retina = true;
      // Static API @2x gives us double resolution
      // So we can request half the size and get the target resolution
      width = Math.round(width / 2);
      height = Math.round(height / 2);
    }
    
    // Ensure dimensions are within Static API limits
    width = Math.min(Math.max(width, 1), 1280);
    height = Math.min(Math.max(height, 1), 1280);
    
    return { width, height, retina };
  }

  /**
   * Get route style string for Static API
   */
  getRouteStyleString(config) {
    const color = (config.route?.color || config.routeColor || '#ff4444').replace('#', '');
    const width = config.route?.width || config.routeWidth || 3;
    
    return `-${width}+${color}`;
  }

  /**
   * Calculate appropriate bounds for static map with padding
   */
  calculateStaticMapBounds(bounds) {
    // Add padding to bounds (10% of the range)
    const latRange = bounds.north - bounds.south;
    const lngRange = bounds.east - bounds.west;
    const latPadding = latRange * 0.1;
    const lngPadding = lngRange * 0.1;
    
    return {
      north: Math.min(85, bounds.north + latPadding), // Clamp to valid lat range
      south: Math.max(-85, bounds.south - latPadding),
      east: Math.min(180, bounds.east + lngPadding), // Clamp to valid lng range
      west: Math.max(-180, bounds.west - lngPadding)
    };
  }

  /**
   * Normalize style ID for Static API
   */
  normalizeStyleId(style) {
    if (!style) return 'streets-v11';
    
    // Remove mapbox:// prefix if present
    if (style.startsWith('mapbox://styles/mapbox/')) {
      return style.replace('mapbox://styles/mapbox/', '');
    }
    
    // Handle custom styles - extract the style ID and fallback appropriately  
    if (style.startsWith('mapbox://styles/') && style.includes('/')) {
      const customStyleId = style.replace('mapbox://styles/', '');
      console.log(`MapService: Custom style detected: ${customStyleId}`);
      
      // For Static API, custom styles aren't supported, so we need to map to equivalent standard styles
      const customStyleFallbacks = {
        'macken04/cm9qvmy7500hr01s5h4h67lsr': 'light-v10' // grey style maps to light
      };
      
      if (customStyleFallbacks[customStyleId]) {
        console.log(`MapService: Using fallback style ${customStyleFallbacks[customStyleId]} for Static API`);
        return customStyleFallbacks[customStyleId];
      }
      
      // Default fallback for unknown custom styles
      console.log('MapService: Unknown custom style, using light-v10 for Static API');
      return 'light-v10';
    }
    
    // Add versioning to standard Mapbox styles if not present - updated to match frontend
    const styleVersionMap = {
      'streets': 'streets-v11',
      'outdoors': 'outdoors-v11',
      'light': 'light-v10', 
      'dark': 'dark-v10',
      'satellite': 'satellite-v9',
      'satellite-streets': 'satellite-streets-v11',
      'terrain': 'outdoors-v11',
      'grey': 'light-v10', // Fallback for grey custom style
      'navigation-day': 'navigation-day-v1',
      'navigation-night': 'navigation-night-v1'
    };
    
    // If style has no version and matches a known style, add version
    if (styleVersionMap[style]) {
      console.log(`MapService: Adding version to style '${style}' -> '${styleVersionMap[style]}'`);
      return styleVersionMap[style];
    }
    
    return style;
  }

  /**
   * Fetch with timeout support
   */
  async fetchWithTimeout(url, timeout = 30000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'PrintMyRide/1.0 MapService'
        }
      });
      
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Advanced Canvas-based fallback for 300 DPI map generation
   * Uses node-canvas when WebGL fails in browser environment
   */
  async generateCanvasMapFallback(config) {
    console.log('MapService: Using server-side Canvas fallback for 300 DPI generation');
    
    try {
      // Check if we have node-canvas available
      let Canvas, createCanvas, loadImage;
      try {
        const canvas = require('canvas');
        Canvas = canvas.Canvas;
        createCanvas = canvas.createCanvas;
        loadImage = canvas.loadImage;
        
        console.log('MapService: node-canvas available, proceeding with Canvas fallback');
      } catch (canvasError) {
        console.warn('MapService: node-canvas not available, falling back to Static Images API:', canvasError.message);
        return await this.generateStaticMapFallback(config);
      }

      // Extract and validate coordinates
      const coordinates = this.extractAndValidateCoordinates(config);
      if (!coordinates || coordinates.length === 0) {
        throw new Error('No valid coordinates found for Canvas map generation');
      }
      
      console.log('MapService: Canvas fallback using coordinates:', {
        count: coordinates.length,
        first: coordinates[0],
        last: coordinates[coordinates.length - 1]
      });
      
      // Calculate bounds for the route
      const bounds = config.bounds || this.calculateRouteBounds(coordinates);
      console.log('MapService: Using bounds for Canvas rendering:', bounds);
      
      // Get high-resolution dimensions
      const dimensions = this.getCanvasDimensions(config);
      console.log('MapService: Canvas dimensions:', dimensions);
      
      // Create high-resolution canvas
      const canvas = createCanvas(dimensions.width, dimensions.height);
      const ctx = canvas.getContext('2d');
      
      // Set high-quality rendering
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // Fill with background color
      ctx.fillStyle = config.backgroundColor || '#f8f9fa';
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);
      
      // Get optimal zoom and tile configuration
      const zoom = this.calculateOptimalZoom(bounds, dimensions.width, dimensions.height);
      console.log('MapService: Using zoom level:', zoom);
      
      // Draw map background using raster tiles
      await this.drawMapTilesOnCanvas(ctx, bounds, dimensions, zoom, config);
      
      // Draw route on top of map tiles
      await this.drawRouteOnCanvas(ctx, coordinates, bounds, dimensions.width, dimensions.height, config);
      
      // Add title and customizations
      await this.addMapDecorations(ctx, config, dimensions.width, dimensions.height);
      
      // Save high-resolution image
      const filePath = await this.saveCanvasImage(canvas, config, dimensions);
      
      console.log('MapService: High-resolution Canvas map generated successfully:', filePath);
      return filePath;
      
    } catch (error) {
      console.error('MapService: Canvas fallback failed:', error);
      console.log('MapService: Attempting Static Images API as final fallback...');
      return await this.generateStaticMapFallback(config);
    }
  }

  /**
   * Get appropriate dimensions for Canvas rendering
   */
  getCanvasDimensions(config) {
    if (config.width && config.height) {
      return {
        width: config.width,
        height: config.height,
        dpi: config.dpi || 300
      };
    }
    
    // Use print dimensions if format is specified
    if (config.format) {
      const printDims = this.getDimensionsForFormat(config.format, config.orientation);
      return printDims;
    }
    
    // Default high-resolution dimensions
    return {
      width: 2480, // A4 portrait width at 300 DPI
      height: 3508, // A4 portrait height at 300 DPI
      dpi: 300
    };
  }

  /**
   * Draw map tiles on canvas background
   */
  async drawMapTilesOnCanvas(ctx, bounds, dimensions, zoom, config) {
    try {
      const styleId = this.normalizeStyleId(config.style || 'streets-v12');
      const tileSize = 512;
      
      // Calculate tile grid
      const tiles = this.calculateTileGrid(bounds, zoom, dimensions.width, dimensions.height, tileSize);
      console.log(`MapService: Loading ${tiles.length} tiles for Canvas rendering`);
      
      // Load tiles with proper error handling
      let tilesLoaded = 0;
      const maxConcurrent = 5; // Limit concurrent tile requests
      
      for (let i = 0; i < tiles.length; i += maxConcurrent) {
        const batch = tiles.slice(i, i + maxConcurrent);
        
        await Promise.allSettled(batch.map(async (tile) => {
          try {
            await this.loadAndDrawTile(ctx, tile, styleId, tileSize);
            tilesLoaded++;
          } catch (tileError) {
            console.warn(`MapService: Failed to load tile ${tile.x},${tile.y}:`, tileError.message);
          }
        }));
      }
      
      console.log(`MapService: Successfully loaded ${tilesLoaded}/${tiles.length} tiles`);
      
    } catch (error) {
      console.error('MapService: Error drawing map tiles:', error);
      // Continue without tiles - route will still be drawn
    }
  }

  /**
   * Load and draw a single tile
   */
  async loadAndDrawTile(ctx, tile, styleId, tileSize) {
    const canvas = require('canvas');
    const axios = require('axios');
    
    const tileUrl = `https://api.mapbox.com/styles/v1/mapbox/${styleId}/tiles/${tileSize}/${tile.z}/${tile.x}/${tile.y}@2x?access_token=${this.appConfig.mapbox.accessToken}`;
    
    const response = await axios.get(tileUrl, { 
      responseType: 'arraybuffer',
      timeout: 10000 // 10 second timeout per tile
    });
    
    const tileImage = await canvas.loadImage(Buffer.from(response.data));
    
    // Draw tile at correct position
    ctx.drawImage(
      tileImage,
      tile.pixelX,
      tile.pixelY,
      tileSize,
      tileSize
    );
  }

  /**
   * Save canvas image to file
   */
  async saveCanvasImage(canvas, config, dimensions) {
    // Determine output directory
    const outputDir = config.dpi && config.dpi >= 300 
      ? path.join(this.appConfig.storage.generatedMapsDir, 'print-ready')
      : path.join(this.appConfig.storage.generatedMapsDir, 'temporary');
      
    await this.ensureDirectoryExists(outputDir);
    
    const filename = `${config.id || 'canvas_map'}.png`;
    const filePath = path.join(outputDir, filename);
    
    // Generate PNG with appropriate quality settings
    const quality = dimensions.dpi >= 300 ? 1.0 : 0.9;
    const compressionLevel = dimensions.dpi >= 300 ? 0 : 3; // Less compression for print quality
    
    const buffer = canvas.toBuffer('image/png', { 
      compressionLevel, 
      quality 
    });
    
    await fsPromises.writeFile(filePath, buffer);
    
    console.log('MapService: Canvas image saved:', {
      filePath,
      fileSize: buffer.length,
      dimensions: `${dimensions.width}x${dimensions.height}`,
      dpi: dimensions.dpi
    });
    
    return filePath;
  }

  /**
   * Calculate optimal zoom level for given bounds and dimensions
   */
  calculateOptimalZoom(bounds, width, height) {
    const latDiff = bounds.north - bounds.south;
    const lngDiff = bounds.east - bounds.west;
    
    // Calculate zoom to fit bounds in viewport
    const latZoom = Math.log2(360 / latDiff);
    const lngZoom = Math.log2(360 / lngDiff);
    
    // Use the more restrictive zoom and add some padding
    const zoom = Math.floor(Math.min(latZoom, lngZoom)) - 1;
    return Math.max(1, Math.min(18, zoom)); // Clamp between 1-18
  }

  /**
   * Calculate which map tiles are needed for the given bounds
   */
  calculateTileGrid(bounds, zoom, width, height, tileSize) {
    const tiles = [];
    
    // Convert bounds to tile coordinates
    const nwTile = this.latLngToTile(bounds.north, bounds.west, zoom);
    const seTile = this.latLngToTile(bounds.south, bounds.east, zoom);
    
    // Calculate pixel offsets
    const nwPixel = this.tileToPixel(nwTile.x, nwTile.y, zoom);
    
    for (let x = Math.floor(nwTile.x); x <= Math.ceil(seTile.x); x++) {
      for (let y = Math.floor(nwTile.y); y <= Math.ceil(seTile.y); y++) {
        const tilePixel = this.tileToPixel(x, y, zoom);
        
        tiles.push({
          x: x,
          y: y,
          z: zoom,
          pixelX: tilePixel.x - nwPixel.x,
          pixelY: tilePixel.y - nwPixel.y
        });
      }
    }
    
    return tiles;
  }

  /**
   * Convert lat/lng to tile coordinates
   */
  latLngToTile(lat, lng, zoom) {
    const scale = Math.pow(2, zoom);
    const x = ((lng + 180) / 360) * scale;
    const y = ((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2) * scale;
    
    return { x, y };
  }

  /**
   * Convert tile coordinates to pixel coordinates
   */
  tileToPixel(tileX, tileY, zoom) {
    const tileSize = 512;
    return {
      x: tileX * tileSize,
      y: tileY * tileSize
    };
  }

  /**
   * Draw route path on canvas
   */
  async drawRouteOnCanvas(ctx, coordinates, bounds, width, height, config) {
    if (!coordinates || coordinates.length === 0) return;
    
    // Determine coordinate format
    const firstCoord = coordinates[0];
    const isLngLat = Math.abs(firstCoord[0]) > Math.abs(firstCoord[1]) && Math.abs(firstCoord[0]) <= 180;
    
    // Convert coordinates to canvas pixels
    const pixelCoords = coordinates.map(coord => {
      let lng, lat;
      if (isLngLat) {
        lng = coord[0];
        lat = coord[1];
      } else {
        lat = coord[0];
        lng = coord[1];
      }
      
      const x = ((lng - bounds.west) / (bounds.east - bounds.west)) * width;
      const y = ((bounds.north - lat) / (bounds.north - bounds.south)) * height;
      return [x, y];
    });
    
    // Draw route path
    ctx.strokeStyle = config.route?.color || '#ff4444';
    ctx.lineWidth = Math.max(4, width / 800); // Scale line width with resolution
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.beginPath();
    ctx.moveTo(pixelCoords[0][0], pixelCoords[0][1]);
    
    for (let i = 1; i < pixelCoords.length; i++) {
      ctx.lineTo(pixelCoords[i][0], pixelCoords[i][1]);
    }
    
    ctx.stroke();
    
    // Draw start/end markers
    if (pixelCoords.length > 1) {
      // Start marker (green)
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(pixelCoords[0][0], pixelCoords[0][1], Math.max(8, width / 400), 0, 2 * Math.PI);
      ctx.fill();
      
      // End marker (red)
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      const lastPoint = pixelCoords[pixelCoords.length - 1];
      ctx.arc(lastPoint[0], lastPoint[1], Math.max(8, width / 400), 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  /**
   * Add title, subtitle and other decorations to canvas
   */
  async addMapDecorations(ctx, config, width, height) {
    const settings = config.settings || {};
    
    // Calculate font sizes based on resolution
    const titleFontSize = Math.max(36, width / 50);
    const subtitleFontSize = Math.max(24, width / 80);
    
    // Draw title
    if (settings.mainTitle) {
      ctx.fillStyle = settings.titleColor || '#1f2937';
      ctx.font = `bold ${titleFontSize}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      
      const titleY = height * 0.05; // 5% from top
      ctx.fillText(settings.mainTitle, width / 2, titleY);
    }
    
    // Draw subtitle
    if (settings.subtitle) {
      ctx.fillStyle = settings.subtitleColor || '#6b7280';
      ctx.font = `${subtitleFontSize}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      
      const subtitleY = height * 0.1; // 10% from top
      ctx.fillText(settings.subtitle, width / 2, subtitleY);
    }
  }

  /**
   * Calculate route bounds from coordinates
   * Handles both [lng, lat] and [lat, lng] coordinate formats
   */
  calculateRouteBounds(coordinates) {
    if (!coordinates || coordinates.length === 0) {
      throw new Error('No coordinates provided for bounds calculation');
    }
    
    // Determine coordinate format based on typical latitude/longitude ranges
    // Latitude: -90 to 90, Longitude: -180 to 180
    const firstCoord = coordinates[0];
    const isLngLat = Math.abs(firstCoord[0]) > Math.abs(firstCoord[1]) && Math.abs(firstCoord[0]) <= 180;
    
    let north, south, east, west;
    
    if (isLngLat) {
      // Coordinates are [lng, lat]
      west = coordinates[0][0];
      east = coordinates[0][0];
      south = coordinates[0][1];
      north = coordinates[0][1];
      
      for (const coord of coordinates) {
        west = Math.min(west, coord[0]);
        east = Math.max(east, coord[0]);
        south = Math.min(south, coord[1]);
        north = Math.max(north, coord[1]);
      }
    } else {
      // Coordinates are [lat, lng]
      north = coordinates[0][0];
      south = coordinates[0][0];
      east = coordinates[0][1];
      west = coordinates[0][1];
      
      for (const coord of coordinates) {
        north = Math.max(north, coord[0]);
        south = Math.min(south, coord[0]);
        east = Math.max(east, coord[1]);
        west = Math.min(west, coord[1]);
      }
    }
    
    // Add some padding (5% of the range)
    const latRange = north - south;
    const lngRange = east - west;
    const latPadding = latRange * 0.05;
    const lngPadding = lngRange * 0.05;
    
    return {
      north: north + latPadding,
      south: south - latPadding,
      east: east + lngPadding,
      west: west - lngPadding
    };
  }

  /**
   * Get dimensions for specific format and orientation
   * Helper method for Canvas fallback
   */
  getDimensionsForFormat(format, orientation) {
    return this.getPrintDimensions(format || 'A4', orientation || 'portrait');
  }

  /**
   * Generate high-resolution image for print quality (300 DPI)
   * Used for paid orders to create print-ready files
   */
  async generateHighResolutionImage(highResConfig) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    console.log('MapService: Generating high-resolution image with config:', {
      id: highResConfig.id,
      format: highResConfig.format,
      dimensions: `${highResConfig.width}x${highResConfig.height}`,
      dpi: highResConfig.dpi
    });

    const page = await this.browser.newPage();
    
    try {
      // Set viewport to target dimensions (already calculated for 300 DPI in PRINT_CONFIG)
      // No scaling needed - use dimensions directly for correct output resolution
      await page.setViewport({
        width: highResConfig.width,
        height: highResConfig.height,
        deviceScaleFactor: 1
      });

      // Create HTML for map rendering
      const mapHTML = this.generateMapHTML(highResConfig);
      
      // Set page content and wait for map to load
      await page.setContent(mapHTML, { waitUntil: 'networkidle2' });
      
      // Wait for Mapbox to finish loading
      try {
        await page.waitForFunction(
          () => {
            if (window.mapError) {
              throw new Error(window.mapError);
            }
            return window.mapboxgl && window.map && window.mapLoaded === true;
          },
          { timeout: 60000 } // Longer timeout for high-res
        );
      } catch (error) {
        console.log('MapService: WebGL rendering failed for high-res, using Canvas fallback...');
        await page.close();
        
        // Use Canvas-based fallback for true 300 DPI generation
        return await this.generateCanvasMapFallback(highResConfig);
      }

      // Additional wait for map to settle (longer for high-res)
      await page.waitForTimeout(5000);

      // Create print-ready directory if it doesn't exist
      const printDir = path.join(this.appConfig.storage.generatedMapsDir, 'print-ready');
      await this.ensureDirectoryExists(printDir);

      // Generate filename and save high-resolution image
      const filename = `${highResConfig.id}.png`;
      const filePath = path.join(printDir, filename);
      
      await page.screenshot({
        path: filePath,
        type: 'png',
        quality: 100, // Maximum quality for print
        fullPage: false
      });

      console.log('MapService: High-resolution image generated successfully:', filePath);
      return filePath;

    } catch (error) {
      console.error('MapService: Error generating high-resolution image:', error);
      throw new Error(`High-resolution generation failed: ${error.message}`);
    } finally {
      await page.close();
    }
  }

  /**
   * Generate high-resolution map from existing preview data
   * Retrieves map configuration from session storage
   */
  async generateHighResFromPreview(previewId, purchaseId, sessionData) {
    try {
      // Retrieve preview configuration from session data
      const preview = sessionData.mapPreviews?.[previewId];
      if (!preview) {
        throw new Error(`Preview ${previewId} not found in session data`);
      }

      // Convert preview config to high-resolution config
      const printSize = preview.config.format.toUpperCase();
      const orientation = preview.config.orientation.toLowerCase();

      // Define high-resolution dimensions (300 DPI)
      const highResDimensions = {
        A4: {
          portrait: { width: 2480, height: 3508 },
          landscape: { width: 3508, height: 2480 }
        },
        A3: {
          portrait: { width: 3508, height: 4961 },
          landscape: { width: 4961, height: 3508 }
        }
      };

      const dimensions = highResDimensions[printSize]?.[orientation];
      if (!dimensions) {
        throw new Error(`Invalid print size or orientation: ${printSize} ${orientation}`);
      }

      const highResConfig = {
        id: `highres_${purchaseId}`,
        width: dimensions.width,
        height: dimensions.height,
        dpi: 300,
        format: printSize,
        orientation: orientation,
        style: preview.config.style,
        route: preview.config.route,
        markers: preview.config.markers,
        center: preview.config.center,
        bounds: preview.config.bounds,
        customization: preview.config.customization || {}
      };

      console.log('MapService: Converting preview to high-resolution:', {
        previewId,
        purchaseId,
        printSize,
        orientation
      });

      return await this.generateHighResolutionImage(highResConfig);

    } catch (error) {
      console.error('MapService: Error generating high-res from preview:', error);
      throw error;
    }
  }

  /**
   * Ensure directory exists, create if it doesn't
   */
  async ensureDirectoryExists(dirPath) {
    try {
      await fsPromises.access(dirPath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        await fsPromises.mkdir(dirPath, { recursive: true });
        console.log('MapService: Created directory:', dirPath);
      } else {
        throw error;
      }
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.browser) {
      console.log('MapService: Closing browser...');
      try {
        if (this.browser.isConnected()) {
          await this.browser.close();
        }
      } catch (error) {
        console.warn('MapService: Error during browser cleanup:', error.message);
      }
      this.browser = null;
      this.isInitialized = false;
    }
  }
}

// Export singleton instance
const mapService = new MapService();

module.exports = mapService;
module.exports.MapService = MapService;