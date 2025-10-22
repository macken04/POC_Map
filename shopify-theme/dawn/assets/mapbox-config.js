/**
 * Mapbox GL JS Configuration for Shopify Dawn Theme
 * Safely handles Mapbox access token and provides configuration utilities
 * 
 * Usage:
 * const config = MapboxConfig.init();
 * const map = new mapboxgl.Map(config.getMapOptions());
 */

(function(global) {
  'use strict';

  // MapboxConfig namespace
  const MapboxConfig = {
    // Configuration cache
    _config: null,
    _initialized: false,
    _dpiManager: null,

    /**
     * Initialize Mapbox configuration from backend API
     */
    init: async function() {
      if (this._initialized) {
        return this;
      }

      try {
        // Initialize DPI Manager if available
        if (typeof DPIManager !== 'undefined') {
          this._dpiManager = new DPIManager();
          await this._dpiManager.init();
          console.log('DPI Manager initialized successfully');
        } else {
          console.warn('DPI Manager not available - high-resolution features will be limited');
        }

        let accessToken = '';
        let defaultStyle = 'mapbox://styles/macken04/cm9qvmy7500hr01s5h4h67lsr';

        // Try to get configuration from backend API first
        try {
          const response = await this._fetchBackendConfig();
          if (response.mapbox?.accessToken) {
            accessToken = response.mapbox.accessToken;
            console.log('Mapbox configuration loaded from backend API');
          } else {
            console.warn('Backend API response missing Mapbox access token');
            console.log('Backend API response:', response);
          }
        } catch (apiError) {
          console.error('Failed to load config from backend API, trying fallbacks:', apiError);
          console.error('API Error details:', {
            message: apiError.message,
            stack: apiError.stack,
            name: apiError.name
          });
        }
        
        // Try multiple fallback methods if backend API failed or returned no token
        if (!accessToken) {
          // Fallback 1: Shopify theme settings
          accessToken = window.shopifyMapboxSettings?.accessToken || '';
          defaultStyle = window.shopifyMapboxSettings?.defaultStyle || defaultStyle;
          
          if (accessToken) {
            console.log('Using Mapbox token from Shopify theme settings');
          }
        }
        
        // Fallback 2: Environment variable passed through template
        if (!accessToken && window.mapboxAccessToken) {
          accessToken = window.mapboxAccessToken;
          console.log('Using Mapbox token from template variable');
        }
        
        // Fallback 3: Check for token in meta tags
        if (!accessToken) {
          const metaToken = document.querySelector('meta[name="mapbox-access-token"]');
          if (metaToken) {
            accessToken = metaToken.getAttribute('content');
            console.log('Using Mapbox token from meta tag');
          }
        }

        // Fallback 4: Hardcoded token as last resort (from verified working backend response)
        if (!accessToken) {
          accessToken = 'pk.eyJ1IjoibWFja2VuMDQiLCJhIjoiY20wczZ3aDR6MGFqbjJqc2pvcTI4b3ZpNSJ9.y3UVbxjA_CyzCJolmPKPIw';
          console.warn('MapboxConfig: Using hardcoded fallback token - backend API unavailable');
        }

        if (!accessToken) {
          const errorMsg = 'Mapbox access token not found. Please configure in backend .env file, theme settings, or template variables.';
          console.error('Mapbox configuration error:', errorMsg);
          
          // Provide detailed debugging information
          console.log('Debugging information:', {
            shopifyMapboxSettings: window.shopifyMapboxSettings,
            mapboxAccessToken: window.mapboxAccessToken,
            metaTokenElement: document.querySelector('meta[name="mapbox-access-token"]'),
            currentURL: window.location.href,
            userAgent: navigator.userAgent
          });
          
          // Don't throw immediately - allow initialization to continue with limited functionality
          console.warn('Continuing initialization without Mapbox token - map functionality will be limited');
          accessToken = 'pk.missing'; // Placeholder to prevent immediate crashes
        }

        // Validate token format (but allow fallback tokens)
        if (!accessToken.startsWith('pk.') && accessToken !== 'pk.missing') {
          console.error('Mapbox: Invalid access token format - should start with "pk."');
          console.warn('Using placeholder token to prevent initialization failure');
          accessToken = 'pk.missing';
        }

        // Validate and set global Mapbox access token
        if (typeof mapboxgl !== 'undefined' && accessToken !== 'pk.missing') {
          // Test token validity before setting it
          try {
            await this._validateTokenWithMapbox(accessToken);
            mapboxgl.accessToken = accessToken;
            console.log('Mapbox GL JS access token set successfully');
          } catch (tokenError) {
            console.error('Token validation failed:', tokenError);
            console.warn('Continuing with placeholder token - map functionality will be limited');
            accessToken = 'pk.missing'; // Update to missing token
          }
        } else if (accessToken === 'pk.missing') {
          console.warn('Skipping Mapbox GL JS token assignment - no valid token available');
        }

        this._config = {
          accessToken: accessToken,
          defaultStyle: defaultStyle,
          // Default theme and color
          defaultTheme: 'classic',
          defaultColor: 'classic',
          // Default map options for consistent configuration
          defaultOptions: {
            container: null, // Must be set by caller
            style: defaultStyle,
            center: [0, 0], // Will be overridden by specific implementations
            zoom: 10,
            preserveDrawingBuffer: true, // Essential for high-resolution export
            antialias: false, // Disabled for better performance
            failIfMajorPerformanceCaveat: false, // Allow fallback to software rendering
            trackResize: true,
            dragPan: true,
            scrollZoom: true,
            boxZoom: true,
            dragRotate: true,
            keyboard: true,
            doubleClickZoom: true,
            touchZoomRotate: true,
            // Performance optimizations
            maxzoom: 18, // Limit max zoom to reduce tile loading
            localIdeographFontFamily: false // Disable local font loading for faster startup
          },
          // High-resolution export settings (300 DPI)
          printDimensions: {
            A4: {
              width: 2480,
              height: 3508,
              name: 'A4 Portrait (300 DPI)'
            },
            A3: {
              width: 3508,
              height: 4961,
              name: 'A3 Portrait (300 DPI)'
            }
          },
          // Theme-based styles organized by theme and color
          themeStyles: {
            classic: {
              name: 'Classic',
              description: 'Traditional detailed maps with full street information',
              colors: {
                classic: {
                  name: 'Classic',
                  url: 'mapbox://styles/macken04/cme05849o00eb01sbh2b46dz4',
                  previewColor: '#f8f8f8'
                },
                grey: {
                  name: 'Grey',
                  url: 'mapbox://styles/macken04/cmdowoyfi003o01r5h90e8r6l',
                  previewColor: '#9ca3af'
                },
                dark: {
                  name: 'Dark',
                  url: 'mapbox://styles/macken04/cmdowqfh4004h01sb14fe6x3u',
                  previewColor: '#374151'
                },
                blue: {
                  name: 'Blue',
                  url: 'mapbox://styles/macken04/cmdowyoil001d01sh5937dt1p',
                  previewColor: '#3b82f6'
                },
                orange: {
                  name: 'Orange',
                  url: 'mapbox://styles/macken04/cmdowyoaj004i01sb9i27ene8',
                  previewColor: '#f97316'
                },
                pink: {
                  name: 'Pink',
                  url: 'mapbox://styles/macken04/cme063epj00rq01pjamus26ma',
                  previewColor: '#ec4899'
                }
              }
            },
            minimal: {
              name: 'Minimal',
              description: 'Clean, simplified maps with essential details only',
              colors: {
                dark: {
                  name: 'Dark',
                  url: 'mapbox://styles/macken04/cm9mvpjc8010b01quegchbmov',
                  previewColor: '#1f2937'
                },
                pink: {
                  name: 'Pink',
                  url: 'mapbox://styles/macken04/cm9mvpk4s010c01qu4jzgccqt',
                  previewColor: '#ec4899'
                },
                grey: {
                  name: 'Grey',
                  url: 'mapbox://styles/macken04/cm9mvpjxz001q01pgco8gefok',
                  previewColor: '#6b7280'
                },
                sand: {
                  name: 'Sand',
                  url: 'mapbox://styles/macken04/cm9mvpjrw001801s5d2xv8t27',
                  previewColor: '#d4b896'
                },
                sage: {
                  name: 'Sage',
                  url: 'mapbox://styles/macken04/cm9mvpjj0006y01qsckitaoib',
                  previewColor: '#84a584'
                }
              }
            },
            bubble: {
              name: 'Bubble',
              description: 'Unique bubble-style map design',
              colors: {
                bubble: {
                  name: 'Bubble',
                  url: 'mapbox://styles/macken04/cmdpqgs5y00av01qs9jat5xu9',
                  previewColor: '#8b5cf6'
                }
              }
            }
          }
        };

        this._initialized = true;
        console.log('Mapbox configuration initialized successfully');
        return this;

      } catch (error) {
        console.error('Mapbox configuration failed:', error);
        throw error;
      }
    },

    /**
     * Fetch Mapbox configuration from backend API
     */
    _fetchBackendConfig: async function() {
      // Use absolute backend URL for Shopify theme integration
      const backendBaseUrl = 'https://boss-hog-freely.ngrok-free.app';
      const apiUrl = `${backendBaseUrl}/api/mapbox-config`;
      
      console.log('Fetching Mapbox config from:', apiUrl);
      console.log('Current location:', window.location.href);

      const maxRetries = 2;
      const retryDelay = 2000; // 2 seconds
      let lastError;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`MapboxConfig: Attempt ${attempt}/${maxRetries} to fetch backend config`);
          console.log(`MapboxConfig: Starting fetch from ${window.location.origin} to ${apiUrl}`);
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => {
            console.warn(`MapboxConfig: Request timeout after 15s on attempt ${attempt}`);
            controller.abort();
          }, 15000); // 15 second timeout per attempt

          console.log(`MapboxConfig: About to fetch, timeout set for 15s`);

          const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              // Always add ngrok header since we're using ngrok backend
              'ngrok-skip-browser-warning': 'true',
              // Add cache control to ensure fresh config
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache'
            },
            signal: controller.signal
          });

          clearTimeout(timeoutId);
          console.log(`MapboxConfig: Fetch completed, response received on attempt ${attempt}`);
          
          console.log(`MapboxConfig: Response status ${response.status} on attempt ${attempt}`);
          console.log('Response headers:', Object.fromEntries(response.headers.entries()));
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`MapboxConfig: HTTP error ${response.status}:`, errorText);
            const error = new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
            error.details = {
              status: response.status,
              statusText: response.statusText,
              body: errorText,
              attempt: attempt
            };
            throw error;
          }
          
          console.log(`MapboxConfig: Parsing JSON response on attempt ${attempt}`);
          const config = await response.json();
          console.log(`MapboxConfig: Config received successfully on attempt ${attempt}:`, config);
          return config;
          
        } catch (error) {
          lastError = error;
          console.error(`MapboxConfig: Attempt ${attempt} failed:`, {
            message: error.message,
            name: error.name,
            details: error.details
          });
          
          // If this was the last attempt, don't wait
          if (attempt < maxRetries) {
            const currentDelay = retryDelay * attempt; // Exponential backoff
            console.log(`MapboxConfig: Waiting ${currentDelay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, currentDelay));
          }
        }
      }

      // All attempts failed
      console.error('MapboxConfig: All attempts to fetch backend config failed');
      throw new Error(`Failed to fetch Mapbox config after ${maxRetries} attempts. Last error: ${lastError.message}`);
    },

    /**
     * Validate Mapbox token by making a test API call
     */
    _validateTokenWithMapbox: async function(token) {
      if (!token || !token.startsWith('pk.')) {
        throw new Error('Invalid token format');
      }

      try {
        const testUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/test.json?access_token=${token}&limit=1`;
        
        const response = await fetch(testUrl, {
          method: 'GET',
          // Browser compatibility check for AbortSignal.timeout
          ...(typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? 
            { signal: AbortSignal.timeout(5000) } : // 5 second timeout
            {} // No timeout for older browsers
          )
        });

        if (response.status === 401) {
          throw new Error('Invalid or expired Mapbox token');
        } else if (response.status === 429) {
          // Rate limited, but token is valid
          console.warn('Mapbox API rate limited, but token appears valid');
          return true;
        } else if (!response.ok) {
          throw new Error(`Mapbox API returned status ${response.status}`);
        }

        console.log('Mapbox token validation successful');
        return true;
        
      } catch (error) {
        if (error.name === 'TimeoutError') {
          throw new Error('Token validation timeout - check network connection');
        }
        throw new Error(`Token validation failed: ${error.message}`);
      }
    },

    /**
     * Get base map options with preserveDrawingBuffer for export capability
     */
    getMapOptions: function(overrides = {}) {
      if (!this._initialized) {
        throw new Error('MapboxConfig must be initialized first');
      }

      return Object.assign({}, this._config.defaultOptions, overrides);
    },

    /**
     * Get print dimensions for specific format
     */
    getPrintDimensions: function(format = 'A4') {
      if (!this._initialized) {
        throw new Error('MapboxConfig must be initialized first');
      }

      const dimensions = this._config.printDimensions[format.toUpperCase()];
      if (!dimensions) {
        throw new Error(`Unsupported print format: ${format}`);
      }

      return dimensions;
    },

    /**
     * Get available theme styles
     */
    getThemeStyles: function() {
      if (!this._initialized) {
        throw new Error('MapboxConfig must be initialized first');
      }

      return this._config.themeStyles;
    },

    /**
     * Get available map styles (backward compatibility)
     */
    getAvailableStyles: function() {
      if (!this._initialized) {
        throw new Error('MapboxConfig must be initialized first');
      }

      // Convert theme structure to flat styles for backward compatibility
      const flatStyles = {};
      const themes = this._config.themeStyles;
      
      for (const themeKey in themes) {
        for (const colorKey in themes[themeKey].colors) {
          const styleKey = `${themeKey}_${colorKey}`;
          flatStyles[styleKey] = themes[themeKey].colors[colorKey].url;
        }
      }
      
      return flatStyles;
    },

    /**
     * Get style URL by theme and color
     */
    getThemeStyleUrl: function(theme, color) {
      if (!this._initialized) {
        throw new Error('MapboxConfig must be initialized first');
      }

      const themes = this._config.themeStyles;
      
      if (!themes[theme]) {
        console.warn(`Unknown theme '${theme}', using default`);
        return this._config.defaultStyle;
      }
      
      if (!themes[theme].colors[color]) {
        console.warn(`Unknown color '${color}' for theme '${theme}', using first available color`);
        const firstColor = Object.keys(themes[theme].colors)[0];
        return themes[theme].colors[firstColor].url;
      }

      return themes[theme].colors[color].url;
    },

    /**
     * Get style URL by name (backward compatibility)
     */
    getStyleUrl: function(styleName) {
      if (!this._initialized) {
        throw new Error('MapboxConfig must be initialized first');
      }

      // If styleName is already a full Mapbox Studio URL, return it directly
      if (styleName && (styleName.startsWith('mapbox://styles/') || styleName.startsWith('https://api.mapbox.com/styles/'))) {
        console.log(`MapboxConfig: Returning full URL directly: ${styleName}`);
        return styleName;
      }

      // Handle old-style requests or theme_color format
      if (styleName && styleName.includes('_')) {
        const [theme, color] = styleName.split('_');
        return this.getThemeStyleUrl(theme, color);
      }
      
      // For simple style names, try to find in themes
      const themes = this._config.themeStyles;
      for (const themeKey in themes) {
        if (themes[themeKey].colors[styleName]) {
          return themes[themeKey].colors[styleName].url;
        }
      }
      
      console.warn(`Unknown style '${styleName}', using default`);
      return this._config.defaultStyle;
    },

    /**
     * Create export-ready map configuration
     */
    getExportMapOptions: function(format = 'A4', overrides = {}) {
      if (!this._initialized) {
        throw new Error('MapboxConfig must be initialized first');
      }

      const dimensions = this.getPrintDimensions(format);
      
      return Object.assign({}, this._config.defaultOptions, {
        // Set dimensions for high-resolution export
        width: dimensions.width,
        height: dimensions.height,
        // Ensure drawing buffer is preserved for canvas export
        preserveDrawingBuffer: true,
        // Disable interactions for export
        interactive: false,
        // Optimize for static rendering
        dragPan: false,
        scrollZoom: false,
        boxZoom: false,
        dragRotate: false,
        keyboard: false,
        doubleClickZoom: false,
        touchZoomRotate: false
      }, overrides);
    },

    /**
     * Check WebGL support and capabilities
     */
    checkWebGLSupport: function() {
      const webglInfo = {
        supported: false,
        version: null,
        maxTextureSize: 0,
        capabilities: {},
        fallbackRequired: false,
        warnings: []
      };

      try {
        // Check for WebGL context
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        
        if (!gl) {
          webglInfo.warnings.push('WebGL not supported - maps may not render properly');
          webglInfo.fallbackRequired = true;
          return webglInfo;
        }

        webglInfo.supported = true;
        
        // Check WebGL version
        const version = gl.getParameter(gl.VERSION);
        webglInfo.version = version;
        
        // Get maximum texture size (important for high-res export)
        webglInfo.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        
        // Check for required extensions
        const requiredExtensions = [
          'OES_element_index_uint',
          'OES_standard_derivatives'
        ];
        
        webglInfo.capabilities = {};
        requiredExtensions.forEach(ext => {
          webglInfo.capabilities[ext] = !!gl.getExtension(ext);
        });
        
        // Check for optional but beneficial extensions
        const optionalExtensions = [
          'WEBGL_depth_texture',
          'OES_texture_float',
          'OES_texture_half_float'
        ];
        
        optionalExtensions.forEach(ext => {
          webglInfo.capabilities[ext] = !!gl.getExtension(ext);
        });
        
        // Performance warnings for low-end devices
        if (webglInfo.maxTextureSize < 4096) {
          webglInfo.warnings.push('Limited texture size - high resolution export may be affected');
        }
        
        // Clean up
        canvas.remove();
        
      } catch (error) {
        webglInfo.warnings.push(`WebGL check failed: ${error.message}`);
        webglInfo.fallbackRequired = true;
      }
      
      return webglInfo;
    },

    /**
     * Detect browser and platform capabilities with DPI-specific features
     */
    detectBrowserCapabilities: function() {
      const capabilities = {
        browser: this._detectBrowser(),
        platform: this._detectPlatform(),
        performance: this._detectPerformanceLevel(),
        features: {
          touchSupport: 'ontouchstart' in window,
          accelerometer: 'DeviceMotionEvent' in window,
          geolocation: 'geolocation' in navigator,
          webgl: this.checkWebGLSupport(),
          requestAnimationFrame: 'requestAnimationFrame' in window,
          intersectionObserver: 'IntersectionObserver' in window,
          // DPI-specific features
          devicePixelRatio: this._testDevicePixelRatioSupport(),
          defineProperty: this._testDefinePropertySupport(),
          canvas2d: this._testCanvas2DSupport(),
          canvasToDataURL: this._testCanvasToDataURLSupport(),
          performanceAPI: this._testPerformanceAPISupport(),
          memoryAPI: this._testMemoryAPISupport()
        },
        dpiCompatibility: this._assessDPICompatibility()
      };
      
      return capabilities;
    },

    /**
     * Test device pixel ratio support and manipulation
     * @returns {Object} Device pixel ratio support info
     */
    _testDevicePixelRatioSupport: function() {
      const support = {
        available: 'devicePixelRatio' in window,
        value: window.devicePixelRatio || 1,
        canOverride: false,
        method: null,
        limitations: []
      };

      if (support.available) {
        // Test if we can override devicePixelRatio
        try {
          const originalValue = window.devicePixelRatio;
          const testValue = 2.5;
          
          // Test defineProperty method
          Object.defineProperty(window, 'devicePixelRatio', {
            get: function() { return testValue; },
            configurable: true
          });
          
          if (window.devicePixelRatio === testValue) {
            support.canOverride = true;
            support.method = 'defineProperty';
          }
          
          // Restore original value
          Object.defineProperty(window, 'devicePixelRatio', {
            get: function() { return originalValue; },
            configurable: true
          });
          
        } catch (error) {
          support.limitations.push('defineProperty method not supported');
          
          // Test direct assignment fallback
          try {
            const originalValue = window.devicePixelRatio;
            window.devicePixelRatio = 2.5;
            
            if (window.devicePixelRatio === 2.5) {
              support.canOverride = true;
              support.method = 'assignment';
            }
            
            window.devicePixelRatio = originalValue;
          } catch (assignError) {
            support.limitations.push('direct assignment not supported');
          }
        }
      }

      return support;
    },

    /**
     * Test Object.defineProperty support
     * @returns {Object} DefineProperty support info
     */
    _testDefinePropertySupport: function() {
      const support = {
        available: typeof Object.defineProperty === 'function',
        configurable: false,
        getterSetter: false,
        limitations: []
      };

      if (support.available) {
        try {
          // Test basic defineProperty functionality
          const testObj = {};
          Object.defineProperty(testObj, 'testProp', {
            value: 'test',
            configurable: true
          });
          
          support.configurable = testObj.testProp === 'test';
          
          // Test getter/setter functionality
          Object.defineProperty(testObj, 'testGetter', {
            get: function() { return 'getter'; },
            configurable: true
          });
          
          support.getterSetter = testObj.testGetter === 'getter';
          
        } catch (error) {
          support.limitations.push(`defineProperty test failed: ${error.message}`);
        }
      }

      return support;
    },

    /**
     * Test Canvas 2D context support and features
     * @returns {Object} Canvas 2D support info
     */
    _testCanvas2DSupport: function() {
      const support = {
        available: false,
        contextType: null,
        backingStorePixelRatio: 1,
        imageSmoothing: false,
        features: [],
        limitations: []
      };

      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          support.available = true;
          support.contextType = '2d';
          
          // Check backing store pixel ratio
          support.backingStorePixelRatio = 
            ctx.webkitBackingStorePixelRatio ||
            ctx.mozBackingStorePixelRatio ||
            ctx.msBackingStorePixelRatio ||
            ctx.oBackingStorePixelRatio ||
            ctx.backingStorePixelRatio || 1;
          
          // Check image smoothing support
          if ('imageSmoothingEnabled' in ctx) {
            support.imageSmoothing = true;
            support.features.push('imageSmoothingEnabled');
          } else if ('webkitImageSmoothingEnabled' in ctx) {
            support.imageSmoothing = true;
            support.features.push('webkitImageSmoothingEnabled');
          } else if ('mozImageSmoothingEnabled' in ctx) {
            support.imageSmoothing = true;
            support.features.push('mozImageSmoothingEnabled');
          }
          
          // Check other advanced features
          if (typeof ctx.createPattern === 'function') {
            support.features.push('createPattern');
          }
          
          if (typeof ctx.createLinearGradient === 'function') {
            support.features.push('gradients');
          }
          
          if (typeof ctx.setTransform === 'function') {
            support.features.push('transforms');
          }
        }
        
        canvas.remove();
        
      } catch (error) {
        support.limitations.push(`Canvas 2D test failed: ${error.message}`);
      }

      return support;
    },

    /**
     * Test canvas toDataURL support
     * @returns {Object} ToDataURL support info
     */
    _testCanvasToDataURLSupport: function() {
      const support = {
        available: false,
        formats: [],
        qualityControl: false,
        limitations: []
      };

      try {
        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 100;
        
        if (canvas.toDataURL) {
          support.available = true;
          
          // Test PNG support (should always work)
          try {
            const pngData = canvas.toDataURL('image/png');
            if (pngData.startsWith('data:image/png')) {
              support.formats.push('png');
            }
          } catch (error) {
            support.limitations.push('PNG export failed');
          }
          
          // Test JPEG support
          try {
            const jpegData = canvas.toDataURL('image/jpeg', 0.8);
            if (jpegData.startsWith('data:image/jpeg')) {
              support.formats.push('jpeg');
              support.qualityControl = true;
            }
          } catch (error) {
            support.limitations.push('JPEG export not supported');
          }
          
          // Test WEBP support
          try {
            const webpData = canvas.toDataURL('image/webp', 0.8);
            if (webpData.startsWith('data:image/webp')) {
              support.formats.push('webp');
            }
          } catch (error) {
            // WEBP not widely supported, don't add to limitations
          }
        }
        
        canvas.remove();
        
      } catch (error) {
        support.limitations.push(`toDataURL test failed: ${error.message}`);
      }

      return support;
    },

    /**
     * Test Performance API support
     * @returns {Object} Performance API support info
     */
    _testPerformanceAPISupport: function() {
      const support = {
        available: typeof performance !== 'undefined',
        now: false,
        memory: false,
        timing: false,
        features: []
      };

      if (support.available) {
        // Test performance.now()
        if (typeof performance.now === 'function') {
          support.now = true;
          support.features.push('now');
        }
        
        // Test performance.memory
        if (performance.memory) {
          support.memory = true;
          support.features.push('memory');
        }
        
        // Test performance.timing
        if (performance.timing) {
          support.timing = true;
          support.features.push('timing');
        }
        
        // Test performance.mark/measure
        if (typeof performance.mark === 'function' && typeof performance.measure === 'function') {
          support.features.push('mark-measure');
        }
      }

      return support;
    },

    /**
     * Test Memory API support
     * @returns {Object} Memory API support info
     */
    _testMemoryAPISupport: function() {
      const support = {
        available: false,
        jsHeapSize: false,
        totalJSHeapSize: false,
        usedJSHeapSize: false,
        deviceMemory: false,
        limitations: []
      };

      try {
        if (performance.memory) {
          support.available = true;
          
          if (typeof performance.memory.totalJSHeapSize === 'number') {
            support.totalJSHeapSize = true;
          }
          
          if (typeof performance.memory.usedJSHeapSize === 'number') {
            support.usedJSHeapSize = true;
          }
          
          if (typeof performance.memory.jsHeapSizeLimit === 'number') {
            support.jsHeapSize = true;
          }
        }
        
        // Test navigator.deviceMemory (experimental)
        if (typeof navigator.deviceMemory === 'number') {
          support.deviceMemory = true;
        }
        
      } catch (error) {
        support.limitations.push(`Memory API test failed: ${error.message}`);
      }

      return support;
    },

    /**
     * Assess overall DPI compatibility for the current browser/device
     * @returns {Object} DPI compatibility assessment
     */
    _assessDPICompatibility: function() {
      const assessment = {
        overallScore: 0,
        level: 'none', // none, basic, good, excellent
        supportedDPI: [],
        recommendedDPI: 96,
        maxRecommendedDPI: 300,
        warnings: [],
        workarounds: []
      };

      try {
        const browser = this._detectBrowser();
        const platform = this._detectPlatform();
        const features = {
          devicePixelRatio: this._testDevicePixelRatioSupport(),
          defineProperty: this._testDefinePropertySupport(),
          canvas2d: this._testCanvas2DSupport(),
          canvasToDataURL: this._testCanvasToDataURLSupport()
        };

        // Calculate compatibility score
        let score = 0;
        
        // Device pixel ratio support (40% of score)
        if (features.devicePixelRatio.available) {
          score += 20;
          if (features.devicePixelRatio.canOverride) {
            score += 20;
          }
        }
        
        // Define property support (20% of score)
        if (features.defineProperty.available && features.defineProperty.getterSetter) {
          score += 20;
        }
        
        // Canvas support (30% of score)
        if (features.canvas2d.available) {
          score += 15;
          if (features.canvas2d.imageSmoothing) {
            score += 10;
          }
          if (features.canvas2d.backingStorePixelRatio > 1) {
            score += 5;
          }
        }
        
        // Export support (10% of score)
        if (features.canvasToDataURL.available) {
          score += 5;
          if (features.canvasToDataURL.formats.includes('png')) {
            score += 5;
          }
        }

        assessment.overallScore = score;

        // Determine compatibility level
        if (score >= 80) {
          assessment.level = 'excellent';
          assessment.supportedDPI = [96, 150, 300, 600];
          assessment.recommendedDPI = 300;
          assessment.maxRecommendedDPI = 600;
        } else if (score >= 60) {
          assessment.level = 'good';
          assessment.supportedDPI = [96, 150, 300];
          assessment.recommendedDPI = 300;
          assessment.maxRecommendedDPI = 300;
        } else if (score >= 40) {
          assessment.level = 'basic';
          assessment.supportedDPI = [96, 150];
          assessment.recommendedDPI = 150;
          assessment.maxRecommendedDPI = 150;
        } else {
          assessment.level = 'none';
          assessment.supportedDPI = [96];
          assessment.recommendedDPI = 96;
          assessment.maxRecommendedDPI = 96;
        }

        // Browser-specific adjustments and warnings
        if (browser.name === 'safari' && platform.mobile) {
          assessment.warnings.push('Mobile Safari has limited high-DPI support');
          assessment.recommendedDPI = Math.min(assessment.recommendedDPI, 150);
          assessment.maxRecommendedDPI = Math.min(assessment.maxRecommendedDPI, 150);
        }
        
        if (browser.name === 'firefox' && parseInt(browser.version) < 55) {
          assessment.warnings.push('Older Firefox versions have inconsistent DPI handling');
          assessment.workarounds.push('Use polyfill methods for Firefox < 55');
        }
        
        if (browser.name === 'chrome' && parseInt(browser.version) < 60) {
          assessment.warnings.push('Older Chrome versions may have memory issues with high DPI');
          assessment.maxRecommendedDPI = Math.min(assessment.maxRecommendedDPI, 300);
        }

        // Memory-based adjustments
        if (navigator.deviceMemory && navigator.deviceMemory < 4) {
          assessment.warnings.push('Limited device memory detected - reducing recommended DPI');
          assessment.recommendedDPI = Math.min(assessment.recommendedDPI, 150);
          assessment.maxRecommendedDPI = Math.min(assessment.maxRecommendedDPI, 300);
          assessment.workarounds.push('Enable memory optimization for high-DPI rendering');
        }

        // Platform-specific workarounds
        if (platform.mobile) {
          assessment.workarounds.push('Use progressive loading for mobile devices');
          assessment.workarounds.push('Implement touch-friendly export controls');
        }
        
      } catch (error) {
        console.error('DPI compatibility assessment failed:', error);
        assessment.warnings.push(`Assessment failed: ${error.message}`);
      }

      return assessment;
    },

    /**
     * Get optimized map options based on device capabilities
     */
    getOptimizedMapOptions: function(overrides = {}) {
      if (!this._initialized) {
        throw new Error('MapboxConfig must be initialized first');
      }

      const capabilities = this.detectBrowserCapabilities();
      const baseOptions = Object.assign({}, this._config.defaultOptions);
      
      // Apply performance optimizations based on device capabilities
      if (capabilities.performance === 'low') {
        // Reduce quality for low-end devices
        baseOptions.antialias = false;
        baseOptions.maxZoom = 16; // Limit zoom to reduce memory usage
      } else if (capabilities.performance === 'medium') {
        baseOptions.maxZoom = 18;
      }
      
      // Browser-specific optimizations
      if (capabilities.browser.name === 'safari' && capabilities.platform.mobile) {
        // Safari iOS optimizations
        baseOptions.dragRotate = false; // Can cause issues on mobile Safari
        baseOptions.pitchWithRotate = false;
      }
      
      if (capabilities.browser.name === 'firefox') {
        // Firefox optimizations
        baseOptions.fadeDuration = 100; // Reduce fade duration for better performance
      }
      
      // WebGL fallbacks
      if (!capabilities.features.webgl.supported) {
        console.warn('WebGL not supported - using fallback configuration');
        baseOptions.antialias = false;
        baseOptions.maxZoom = 14;
      }
      
      return Object.assign(baseOptions, overrides);
    },

    /**
     * Private method to detect browser
     */
    _detectBrowser: function() {
      const userAgent = navigator.userAgent;
      let browser = { name: 'unknown', version: 'unknown' };
      
      if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
        browser.name = 'chrome';
        browser.version = userAgent.match(/Chrome\/([0-9.]+)/)?.[1] || 'unknown';
      } else if (userAgent.includes('Firefox')) {
        browser.name = 'firefox';
        browser.version = userAgent.match(/Firefox\/([0-9.]+)/)?.[1] || 'unknown';
      } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
        browser.name = 'safari';
        browser.version = userAgent.match(/Version\/([0-9.]+)/)?.[1] || 'unknown';
      } else if (userAgent.includes('Edg')) {
        browser.name = 'edge';
        browser.version = userAgent.match(/Edg\/([0-9.]+)/)?.[1] || 'unknown';
      }
      
      return browser;
    },

    /**
     * Private method to detect platform
     */
    _detectPlatform: function() {
      const userAgent = navigator.userAgent;
      return {
        mobile: /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent),
        ios: /iPad|iPhone|iPod/.test(userAgent),
        android: /Android/.test(userAgent),
        desktop: !/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)
      };
    },

    /**
     * Private method to detect performance level
     */
    _detectPerformanceLevel: function() {
      // Use hardware concurrency as a proxy for device performance
      const cores = navigator.hardwareConcurrency || 1;
      const memory = navigator.deviceMemory || 1; // Available in some browsers
      
      if (cores >= 4 && memory >= 4) {
        return 'high';
      } else if (cores >= 2 && memory >= 2) {
        return 'medium';
      } else {
        return 'low';
      }
    },

    /**
     * Validate that all required dependencies are loaded
     */
    validateDependencies: function() {
      const dependencies = [];

      if (typeof mapboxgl === 'undefined') {
        dependencies.push('mapbox-gl');
      }

      if (dependencies.length > 0) {
        throw new Error(`Missing required dependencies: ${dependencies.join(', ')}`);
      }

      return true;
    },

    /**
     * Calculate DPI-aware dimensions for print formats
     * @param {string} format - Print format (A4, A3, etc.)
     * @param {number} targetDPI - Target DPI (default: 300)
     * @returns {Object} DPI-aware dimensions
     */
    getDPIAwareDimensions: function(format = 'A4', targetDPI = 300) {
      if (!this._initialized) {
        throw new Error('MapboxConfig must be initialized first');
      }

      if (this._dpiManager) {
        return this._dpiManager.calculatePrintDimensions(format, targetDPI);
      } else {
        // Fallback calculation without DPI manager
        const baseDimensions = this.getPrintDimensions(format);
        const scalingFactor = targetDPI / 96; // Web standard DPI
        
        return {
          width: Math.round(baseDimensions.width * scalingFactor),
          height: Math.round(baseDimensions.height * scalingFactor),
          dpi: targetDPI,
          scalingFactor,
          fallback: true
        };
      }
    },

    /**
     * Get high-resolution map options with DPI scaling
     * @param {string} format - Print format
     * @param {number} targetDPI - Target DPI
     * @param {Object} overrides - Additional options
     * @returns {Object} High-resolution map options
     */
    getHighDPIMapOptions: function(format = 'A4', targetDPI = 300, overrides = {}) {
      if (!this._initialized) {
        throw new Error('MapboxConfig must be initialized first');
      }

      const dimensions = this.getDPIAwareDimensions(format, targetDPI);
      const baseOptions = this.getExportMapOptions(format, overrides);
      
      // Calculate device pixel ratio for target DPI
      const devicePixelRatio = targetDPI / 96;
      
      return Object.assign({}, baseOptions, {
        width: dimensions.width,
        height: dimensions.height,
        pixelRatio: devicePixelRatio,
        // High-DPI specific optimizations
        renderWorldCopies: false, // Prevent duplicate world rendering
        maxZoom: Math.min(overrides.maxZoom || 18, 18), // Limit zoom for memory
        fadeDuration: 0, // Disable fade for static export
        // Additional metadata
        dpiInfo: {
          targetDPI,
          actualDPI: dimensions.dpi,
          scalingFactor: dimensions.scalingFactor || devicePixelRatio,
          memoryEstimateMB: dimensions.estimatedMemoryMB
        }
      }, overrides);
    },

    /**
     * Check if high-DPI rendering is supported
     * @returns {Object} Support information
     */
    checkHighDPISupport: function() {
      if (this._dpiManager) {
        return this._dpiManager.testHighDPISupport();
      } else {
        return {
          supported: false,
          reason: 'DPI Manager not available',
          fallbackAvailable: true
        };
      }
    },

    /**
     * Set target DPI for rendering
     * @param {number} targetDPI - Target DPI value
     * @returns {number} Actual scaling factor applied
     */
    setRenderingDPI: function(targetDPI) {
      if (!this._dpiManager) {
        console.warn('DPI Manager not available - cannot set rendering DPI');
        return 1;
      }

      try {
        return this._dpiManager.setDPI(targetDPI);
      } catch (error) {
        console.error('Failed to set rendering DPI:', error);
        throw error;
      }
    },

    /**
     * Restore original DPI settings
     */
    restoreOriginalDPI: function() {
      if (this._dpiManager) {
        this._dpiManager.restoreOriginalDPI();
      }
    },

    /**
     * Calculate memory requirements for high-DPI rendering
     * @param {string} format - Print format
     * @param {number} targetDPI - Target DPI
     * @returns {Object} Memory requirements
     */
    calculateHighDPIMemory: function(format, targetDPI = 300) {
      const dimensions = this.getDPIAwareDimensions(format, targetDPI);
      
      if (this._dpiManager) {
        return this._dpiManager.calculateMemoryRequirements(dimensions.width, dimensions.height);
      } else {
        // Fallback calculation
        const totalPixels = dimensions.width * dimensions.height;
        const estimatedMB = Math.round((totalPixels * 4 * 2.5) / (1024 * 1024));
        
        return {
          logicalDimensions: { width: dimensions.width, height: dimensions.height },
          estimatedMemoryMB: estimatedMB,
          isMemoryIntensive: estimatedMB > 200,
          recommendOptimization: estimatedMB > 500,
          fallback: true
        };
      }
    },

    /**
     * Get available DPI presets
     * @returns {Object} Available DPI presets
     */
    getDPIPresets: function() {
      if (this._dpiManager) {
        return this._dpiManager.getDPIPresets();
      } else {
        // Fallback DPI presets
        return {
          96: { name: 'Standard Web', description: 'Standard web quality (96 DPI)' },
          150: { name: 'Draft Print', description: 'Draft print quality (150 DPI)' },
          300: { name: 'Print Quality', description: 'Professional print quality (300 DPI)' }
        };
      }
    },

    /**
     * Create export configuration optimized for specific DPI
     * @param {string} format - Print format
     * @param {number} targetDPI - Target DPI
     * @param {Object} customOptions - Custom options
     * @returns {Object} Optimized export configuration
     */
    createExportConfig: function(format, targetDPI = 300, customOptions = {}) {
      if (!this._initialized) {
        throw new Error('MapboxConfig must be initialized first');
      }

      const dimensions = this.getDPIAwareDimensions(format, targetDPI);
      const memoryInfo = this.calculateHighDPIMemory(format, targetDPI);
      const dpiSupport = this.checkHighDPISupport();
      
      // Adjust settings based on memory requirements and browser support
      const optimizedOptions = {
        // Base dimensions
        width: dimensions.width,
        height: dimensions.height,
        format: format.toUpperCase(),
        
        // DPI settings
        targetDPI,
        scalingFactor: dimensions.scalingFactor || (targetDPI / 96),
        
        // Performance optimizations
        memoryOptimized: memoryInfo.recommendOptimization,
        tileSize: memoryInfo.isMemoryIntensive ? 256 : 512,
        maxZoom: memoryInfo.isMemoryIntensive ? 16 : 18,
        
        // Browser compatibility
        highDPISupported: dpiSupport.supported,
        fallbackMode: !dpiSupport.supported,
        
        // Mapbox GL JS specific settings
        preserveDrawingBuffer: true,
        antialias: !memoryInfo.isMemoryIntensive,
        interactive: false,
        attributionControl: false,
        
        // Metadata
        metadata: {
          dimensions,
          memoryInfo,
          dpiSupport,
          generatedAt: new Date().toISOString()
        }
      };

      return Object.assign(optimizedOptions, customOptions);
    },

    /**
     * Get DPI manager instance
     * @returns {DPIManager|null} DPI manager instance
     */
    getDPIManager: function() {
      return this._dpiManager;
    },

    /**
     * Get configuration summary for debugging
     */
    getDebugInfo: function() {
      if (!this._initialized) {
        return { initialized: false };
      }

      const capabilities = this.detectBrowserCapabilities();
      const dpiInfo = this._dpiManager ? this._dpiManager.getCurrentDPIInfo() : null;
      
      return {
        initialized: true,
        hasAccessToken: !!this._config.accessToken,
        tokenPrefix: this._config.accessToken.substring(0, 8) + '...',
        defaultStyle: this._config.defaultStyle,
        availableStyles: Object.keys(this._config.availableStyles),
        printFormats: Object.keys(this._config.printDimensions),
        browser: capabilities.browser,
        platform: capabilities.platform,
        performance: capabilities.performance,
        webglSupport: capabilities.features.webgl.supported,
        webglWarnings: capabilities.features.webgl.warnings,
        dpiManager: {
          available: !!this._dpiManager,
          currentDPI: dpiInfo?.currentDPI,
          isOverridden: dpiInfo?.isOverridden,
          supportInfo: dpiInfo?.supportInfo
        }
      };
    }
  };

  // Export for different module systems
  if (typeof module !== 'undefined' && module.exports) {
    // CommonJS (Node.js)
    module.exports = MapboxConfig;
  } else if (typeof define === 'function' && define.amd) {
    // AMD (RequireJS)
    define(function() { return MapboxConfig; });
  } else {
    // Browser globals
    global.MapboxConfig = MapboxConfig;
  }

})(typeof window !== 'undefined' ? window : this);