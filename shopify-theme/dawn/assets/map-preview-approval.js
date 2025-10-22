/**
 * Map Preview Approval Page Handler
 * Manages the preview display and approval flow for custom map orders
 */

class MapPreviewApproval {
  constructor(options = {}) {
    this.options = {
      baseUrl: 'http://localhost:3000',
      maxRetries: 3,
      retryDelay: 2000,
      ...options
    };

    this.previewData = null;
    this.currentRetry = 0;
    this.isInitialized = false;

    // DOM elements
    this.elements = {};

    // Print dimension constants (matching backend specifications)
    this.PRINT_DIMENSIONS = {
      A4: {
        portrait: { width: 3508, height: 4961, aspectRatio: 3508 / 4961, physicalWidth: 210, physicalHeight: 297 },
        landscape: { width: 4961, height: 3508, aspectRatio: 4961 / 3508, physicalWidth: 297, physicalHeight: 210 }
      },
      A3: {
        portrait: { width: 4961, height: 7016, aspectRatio: 4961 / 7016, physicalWidth: 297, physicalHeight: 420 },
        landscape: { width: 7016, height: 4961, aspectRatio: 7016 / 4961, physicalWidth: 420, physicalHeight: 297 }
      },
      A2: {
        portrait: { width: 7016, height: 9933, aspectRatio: 7016 / 9933, physicalWidth: 420, physicalHeight: 594 },
        landscape: { width: 9933, height: 7016, aspectRatio: 9933 / 7016, physicalWidth: 594, physicalHeight: 420 }
      },
      A1: {
        portrait: { width: 9933, height: 14043, aspectRatio: 9933 / 14043, physicalWidth: 594, physicalHeight: 841 },
        landscape: { width: 14043, height: 9933, aspectRatio: 14043 / 9933, physicalWidth: 841, physicalHeight: 594 }
      }
    };

    console.log('MapPreviewApproval initialized with options:', this.options);
  }

  /**
   * Initialize the preview approval page
   */
  async init() {
    if (this.isInitialized) {
      console.warn('MapPreviewApproval already initialized');
      return;
    }

    console.log('=== INITIALIZING MAP PREVIEW APPROVAL ===');
    console.log('Base URL:', this.options.baseUrl);
    
    try {
      console.log('Step 1: Caching DOM elements...');
      // Get DOM elements
      this.cacheElements();
      
      console.log('Step 2: Setting up event listeners...');
      // Set up event listeners
      this.setupEventListeners();
      
      console.log('Step 3: Checking authentication...');
      // Check authentication
      if (!this.checkAuthentication()) {
        console.warn('Authentication check failed, stopping initialization');
        return;
      }
      
      console.log('Step 4: Loading preview data...');
      // Load preview data
      try {
        await this.loadPreviewData();
        console.log('Step 4 COMPLETED: Preview data loaded successfully');
      } catch (dataError) {
        console.error('Step 4 FAILED: Preview data loading failed:', dataError);
        throw dataError; // Re-throw to trigger error handling
      }
      
      console.log('Step 5: Displaying preview...');
      // Display the preview
      await this.displayPreview();
      
      this.isInitialized = true;
      console.log('=== MAP PREVIEW APPROVAL INITIALIZED SUCCESSFULLY ===');
      
    } catch (error) {
      console.error('=== INITIALIZATION FAILED ===');
      console.error('Error during initialization:', error);
      console.error('Error stack:', error.stack);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      
      // Show error state immediately
      this.showError('Initialization Failed', error.message);
    }
  }

  /**
   * Cache DOM elements
   */
  cacheElements() {
    this.elements = {
      // States
      loading: document.getElementById('preview-loading'),
      error: document.getElementById('preview-error'),
      content: document.getElementById('preview-content'),
      
      // Error elements
      errorTitle: document.getElementById('error-title'),
      errorMessage: document.getElementById('error-message'),
      retryButton: document.getElementById('retry-preview-button'),
      
      // Preview elements
      previewImage: document.getElementById('preview-image'),
      previewDimensions: document.getElementById('preview-dimensions'),
      
      // Activity info
      activityName: document.getElementById('activity-name'),
      activityDistance: document.getElementById('activity-distance'),
      activityElevation: document.getElementById('activity-elevation'),
      activityDate: document.getElementById('activity-date'),
      activityType: document.getElementById('activity-type'),
      
      // Configuration
      configSize: document.getElementById('config-size'),
      configStyle: document.getElementById('config-style'),
      configTitle: document.getElementById('config-title'),
      configSubtitle: document.getElementById('config-subtitle'),
      
      // Pricing
      printPrice: document.getElementById('print-price'),
      totalPrice: document.getElementById('total-price'),
      
      // Action buttons
      orderPosterBtn: document.getElementById('add-to-cart-btn'),
      backToEditBtn: document.getElementById('back-to-edit-btn'),
      backToDesignBtn: document.getElementById('back-to-design-btn'),
      startOverBtn: document.getElementById('start-over-btn'),

      // Preview container and aspect ratio display
      previewContainer: document.getElementById('preview-container'),
      aspectRatioDisplay: document.getElementById('aspect-ratio-display'),
      aspectRatioText: document.getElementById('aspect-ratio-text'),
      posterActualSize: document.getElementById('poster-actual-size')
    };

    console.log('=== DOM ELEMENTS DEBUG ===');
    console.log('Critical state elements:');
    console.log('- loading element:', !!this.elements.loading, this.elements.loading?.id);
    console.log('- error element:', !!this.elements.error, this.elements.error?.id);
    console.log('- content element:', !!this.elements.content, this.elements.content?.id);
    
    if (this.elements.content) {
      console.log('Content element details:', {
        id: this.elements.content.id,
        className: this.elements.content.className,
        style: this.elements.content.style.cssText,
        offsetHeight: this.elements.content.offsetHeight,
        offsetWidth: this.elements.content.offsetWidth,
        hidden: this.elements.content.hidden,
        display: window.getComputedStyle(this.elements.content).display
      });
    }
    
    // Count missing elements
    const missingElements = Object.entries(this.elements).filter(([key, element]) => !element);
    if (missingElements.length > 0) {
      console.warn('Missing DOM elements:', missingElements.map(([key]) => key));
    }
    
    console.log('=== DOM ELEMENTS DEBUG END ===');
    console.log('DOM elements cached');
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Retry button
    if (this.elements.retryButton) {
      this.elements.retryButton.addEventListener('click', () => {
        this.retryPreviewLoad();
      });
    }
    
    // Navigation buttons
    if (this.elements.backToEditBtn) {
      this.elements.backToEditBtn.addEventListener('click', () => {
        this.navigateToDesign();
      });
    }
    
    if (this.elements.backToDesignBtn) {
      this.elements.backToDesignBtn.addEventListener('click', () => {
        this.navigateToDesign();
      });
    }
    
    if (this.elements.startOverBtn) {
      this.elements.startOverBtn.addEventListener('click', () => {
        this.startOver();
      });
    }
    
    // Order button with immediate click protection
    if (this.elements.orderPosterBtn) {
      this.elements.orderPosterBtn.addEventListener('click', (event) => {
        // Prevent multiple clicks and event propagation immediately
        event.preventDefault();
        event.stopImmediatePropagation();
        
        // Check if button is already disabled/processing
        if (this.elements.orderPosterBtn.disabled || this.elements.orderPosterBtn.dataset.processing === 'true') {
          console.log('Button click ignored - already processing');
          return;
        }
        
        // Mark as processing immediately
        this.elements.orderPosterBtn.dataset.processing = 'true';
        this.elements.orderPosterBtn.disabled = true;
        
        // Process the purchase
        this.processPurchase().catch((error) => {
          console.error('Purchase processing failed:', error);
          // Re-enable button on error
          this.elements.orderPosterBtn.disabled = false;
          this.elements.orderPosterBtn.dataset.processing = 'false';
          this.elements.orderPosterBtn.textContent = 'Order Poster';
        });
      }, { once: false }); // Don't use 'once' as we want error recovery
    }
    
    console.log('Event listeners set up');
  }

  /**
   * Apply aspect ratio to preview container based on print size and orientation
   */
  applyAspectRatio() {
    if (!this.previewData || !this.previewData.settings) {
      console.warn('No preview data available for aspect ratio calculation');
      return;
    }

    const settings = this.previewData.settings;
    const printSize = (settings.printSize || 'A4').toUpperCase();
    const orientation = settings.layout || 'portrait';

    console.log('=== ASPECT RATIO DEBUG ===');
    console.log('Settings object:', settings);
    console.log('Print size (raw):', settings.printSize);
    console.log('Print size (processed):', printSize);
    console.log('Orientation (raw):', settings.layout);
    console.log('Orientation (processed):', orientation);

    // Get dimension configuration for this size and orientation
    const dimensionConfig = this.PRINT_DIMENSIONS[printSize];
    if (!dimensionConfig) {
      console.error('Unknown print size:', printSize);
      return;
    }

    const dimensions = dimensionConfig[orientation];
    if (!dimensions) {
      console.error('Unknown orientation:', orientation);
      return;
    }

    console.log('Retrieved dimensions:', {
      width: dimensions.width,
      height: dimensions.height,
      physicalWidth: dimensions.physicalWidth,
      physicalHeight: dimensions.physicalHeight,
      aspectRatio: dimensions.aspectRatio
    });
    console.log('Expected display:', `${dimensions.physicalWidth / 10} x ${dimensions.physicalHeight / 10} cm`);
    console.log('=== END ASPECT RATIO DEBUG ===');

    // Apply aspect ratio class to container
    if (this.elements.previewContainer) {
      // Remove existing aspect ratio classes
      this.elements.previewContainer.classList.remove(
        'preview-container-a4-portrait',
        'preview-container-a4-landscape',
        'preview-container-a3-portrait',
        'preview-container-a3-landscape',
        'preview-container-a2-portrait',
        'preview-container-a2-landscape',
        'preview-container-a1-portrait',
        'preview-container-a1-landscape'
      );

      // Add appropriate aspect ratio class
      const aspectRatioClass = `preview-container-${printSize.toLowerCase()}-${orientation}`;
      this.elements.previewContainer.classList.add(aspectRatioClass);

      // Set data attributes
      this.elements.previewContainer.dataset.printSize = printSize;
      this.elements.previewContainer.dataset.orientation = orientation;

      console.log('Applied aspect ratio class:', aspectRatioClass);
    }

    // Update physical size display
    if (this.elements.posterActualSize) {
      const widthCm = (dimensions.physicalWidth / 10).toFixed(1);
      const heightCm = (dimensions.physicalHeight / 10).toFixed(1);
      this.elements.posterActualSize.textContent = `Actual size: ${widthCm} x ${heightCm} cm (${printSize} ${orientation})`;
    }

    // Update aspect ratio display
    if (this.elements.aspectRatioDisplay && this.elements.aspectRatioText) {
      const aspectRatioFormatted = dimensions.aspectRatio.toFixed(3);
      const pixelDimensions = `${dimensions.width} × ${dimensions.height} pixels`;
      this.elements.aspectRatioText.textContent =
        `Preview shown at actual print proportions (${pixelDimensions} at 300 DPI)`;

      // Show the aspect ratio display
      this.elements.aspectRatioDisplay.style.display = 'flex';
    }

    console.log('Aspect ratio applied successfully:', {
      printSize,
      orientation,
      aspectRatio: dimensions.aspectRatio,
      physicalSize: `${dimensions.physicalWidth}mm × ${dimensions.physicalHeight}mm`,
      pixelSize: `${dimensions.width} × ${dimensions.height}px`
    });
  }

  /**
   * Check authentication status
   */
  checkAuthentication() {
    console.log('=== AUTHENTICATION CHECK ===');
    console.log('window.AuthUtils available:', typeof window.AuthUtils !== 'undefined');
    
    if (!window.AuthUtils) {
      console.error('AuthUtils not available - authentication system not loaded');
      this.showError('System Error', 'Authentication system not available. Please refresh the page.');
      return false;
    }
    
    console.log('AuthUtils methods available:', {
      getToken: typeof window.AuthUtils.getToken === 'function',
      getPreviewData: typeof window.AuthUtils.getPreviewData === 'function',
      requireAuthentication: typeof window.AuthUtils.requireAuthentication === 'function'
    });
    
    const token = window.AuthUtils.getToken();
    console.log('Token status:', token ? 'PRESENT' : 'MISSING');
    
    if (!token) {
      console.warn('No authentication token available');
      this.showError(
        'Authentication Required', 
        'Please authenticate with Strava to view your map preview.',
        [{
          text: 'Login with Strava',
          action: () => {
            if (window.AuthUtils.requireAuthentication) {
              window.AuthUtils.requireAuthentication('/pages/map-preview');
            } else {
              window.location.href = '/auth/strava';
            }
          }
        }]
      );
      return false;
    }
    
    console.log('Authentication check passed');
    return true;
  }

  /**
   * Load preview data from storage or URL
   */
  async loadPreviewData() {
    console.log('=== LOADING PREVIEW DATA ===');
    console.log('AuthUtils available:', !!window.AuthUtils);
    
    // First try to get from AuthUtils storage
    let previewData = null;
    if (window.AuthUtils && window.AuthUtils.getPreviewData) {
      try {
        previewData = window.AuthUtils.getPreviewData();
        console.log('Preview data from AuthUtils:', previewData ? 'FOUND' : 'NULL/UNDEFINED');
        if (previewData) {
          console.log('Preview data structure:', {
            hasPreviewUrl: !!previewData.previewUrl,
            hasSettings: !!previewData.settings,
            hasActivityData: !!previewData.activityData,
            settingsKeys: previewData.settings ? Object.keys(previewData.settings) : 'none'
          });
        }
      } catch (error) {
        console.warn('Error getting preview data from AuthUtils:', error);
      }
    } else {
      console.warn('AuthUtils.getPreviewData not available');
    }
    
    // If not found, try URL parameters (fallback)
    if (!previewData) {
      console.log('No preview data in AuthUtils, checking URL parameters...');
      const urlParams = new URLSearchParams(window.location.search);
      const previewId = urlParams.get('preview');
      console.log('Preview ID from URL:', previewId);
      console.log('All URL parameters:', Array.from(urlParams.entries()));
      
      if (previewId) {
        console.log('Found preview ID in URL, fetching from backend...');
        try {
          const fetchUrl = `${this.options.baseUrl}/api/maps/preview-image/${previewId}`;
          console.log('Fetching preview from URL:', fetchUrl);
          
          if (!window.AuthUtils.authenticatedFetch) {
            throw new Error('AuthUtils.authenticatedFetch not available');
          }
          
          const response = await window.AuthUtils.authenticatedFetch(fetchUrl);
          console.log('Fetch response status:', response.status);
          console.log('Fetch response headers:', Array.from(response.headers.entries()));
          
          if (response.ok) {
            // Create minimal preview data from URL
            previewData = {
              previewId: previewId,
              previewUrl: `/api/maps/preview-image/${previewId}`,
              settings: {
                printSize: urlParams.get('size') || 'A4',
                layout: urlParams.get('orientation') || 'portrait',
                mainTitle: urlParams.get('title') || 'EPIC RIDE',
                subtitle: urlParams.get('subtitle') || 'Summer 2023'
              }
            };
            console.log('Created minimal preview data from URL:', previewData);
          } else {
            const errorText = await response.text();
            console.error('Failed to fetch preview:', response.status, response.statusText);
            console.error('Error response body:', errorText);
          }
        } catch (error) {
          console.warn('Failed to fetch preview from URL parameter:', error);
          console.warn('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
          });
        }
      } else {
        console.log('No preview ID in URL parameters');
        
        // Check if we have any other relevant URL parameters that might help
        console.log('Checking for alternative data sources...');
        const activityId = urlParams.get('activity');
        const mapData = urlParams.get('mapData');
        console.log('Activity ID:', activityId);
        console.log('Map data parameter:', mapData ? 'PRESENT' : 'MISSING');
      }
    }
    
    if (!previewData) {
      console.error('=== NO PREVIEW DATA FOUND ===');
      console.error('Sources checked:');
      console.error('1. AuthUtils.getPreviewData():', window.AuthUtils && window.AuthUtils.getPreviewData ? 'Available but returned null/undefined' : 'Method not available');
      console.error('2. URL preview parameter:', 'Not found');
      console.error('3. Alternative URL parameters:', 'Not sufficient for preview');
      
      throw new Error('No preview data available. Please generate a preview from the map design page first.');
    }
    
    this.previewData = previewData;
    console.log('=== FINAL PREVIEW DATA LOADED ===');
    console.log('Preview data summary:', {
      source: previewData.previewId ? 'URL' : 'AuthUtils',
      hasPreviewUrl: !!previewData.previewUrl,
      hasSettings: !!previewData.settings,
      hasActivityData: !!previewData.activityData
    });
  }

  /**
   * Display the preview content
   */
  async displayPreview() {
    if (!this.previewData) {
      throw new Error('No preview data to display');
    }

    console.log('Displaying preview...');

    try {
      // Hide loading, show content first
      this.setState('content');

      // Apply aspect ratio based on print size and orientation
      this.applyAspectRatio();

      // Populate activity information (always works)
      this.populateActivityInfo();

      // Populate configuration (always works)
      this.populateConfiguration();

      // Set up pricing (always works)
      this.setupPricing();

      // Try to set up preview image (might fail, but don't block the page)
      try {
        console.log('Attempting to load preview image...');
        await this.loadPreviewImage();
        console.log('Preview image loaded successfully');
      } catch (imageError) {
        console.warn('Preview image loading failed, but continuing with page display:', imageError);
        this.showImagePlaceholder('Image loading failed: ' + imageError.message);
      }

      console.log('Preview displayed successfully (with or without image)');

    } catch (error) {
      console.error('Failed to display preview content:', error);
      throw error;
    }
  }

  /**
   * Load and display the preview image (supports both server URLs and base64 data URLs)
   */
  async loadPreviewImage() {
    if (!this.elements.previewImage) {
      throw new Error('Preview image element not found');
    }
    
    console.log('=== ASYNC PREVIEW IMAGE LOADING ===');
    
    try {
      const previewUrl = this.previewData.previewUrl;
      const previewId = this.previewData.previewId || this.extractPreviewIdFromUrl(previewUrl);
      
      console.log('Preview loading mode:', {
        hasPreviewUrl: !!previewUrl,
        previewId: previewId,
        urlType: previewUrl ? (previewUrl.startsWith('data:') ? 'base64' : 'server') : 'none'
      });
      
      // Check if this is a base64 data URL (from instant client capture) - legacy support
      if (previewUrl && previewUrl.startsWith('data:')) {
        console.log('Loading preview image from base64 data URL (legacy mode)');
        return await this.loadBase64PreviewImage(previewUrl);
      }
      
      // New async mode: Poll for preview generation status
      if (previewId) {
        console.log('Starting async preview loading for preview ID:', previewId);
        return await this.pollForPreviewCompletion(previewId);
      }
      
      // Fallback for direct server URLs (backward compatibility)
      if (previewUrl) {
        console.log('Loading preview image from direct server URL (legacy mode)');
        return await this.loadDirectPreviewImage(previewUrl);
      }
      
      // No preview available
      console.warn('No preview URL or ID available');
      this.showImagePlaceholder('No preview image available - please regenerate from design page');
      
    } catch (error) {
      console.error('Error in loadPreviewImage:', error);
      this.showImagePlaceholder('Error loading preview: ' + error.message);
      // Don't throw - allow the page to continue displaying
    }
  }

  /**
   * Extract preview ID from URL path
   */
  extractPreviewIdFromUrl(url) {
    if (!url) return null;
    const match = url.match(/\/preview-image\/([^?&]+)/);
    return match ? match[1] : null;
  }

  /**
   * Poll backend for preview generation completion
   */
  async pollForPreviewCompletion(previewId) {
    console.log(`[AsyncPreview] Starting polling for preview ${previewId}`);
    
    const maxAttempts = 60; // 2 minutes max (60 * 2 seconds)
    let attempts = 0;
    
    // Show initial loading state
    this.updateImageLoadingState('Checking preview status...', 0);
    
    while (attempts < maxAttempts) {
      attempts++;
      
      try {
        console.log(`[AsyncPreview] Polling attempt ${attempts}/${maxAttempts}`);
        
        // Check status
        const statusUrl = `${this.options.baseUrl}/api/maps/preview-status/${previewId}`;
        const response = await window.AuthUtils.authenticatedFetch(statusUrl);
        
        if (!response.ok) {
          throw new Error(`Status check failed: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();
        const preview = result.preview;
        
        console.log(`[AsyncPreview] Status update:`, {
          status: preview.status,
          progress: preview.progress,
          message: preview.message,
          ready: preview.ready
        });
        
        // Update loading state with progress
        this.updateImageLoadingState(preview.message, preview.progress);
        
        // Check if completed
        if (preview.status === 'completed' && preview.ready) {
          console.log(`[AsyncPreview] Preview generation completed!`);
          
          // Load the completed image
          const imageUrl = `${this.options.baseUrl}/api/maps/preview-image/${previewId}`;
          await this.loadCompletedPreviewImage(imageUrl, previewId);
          
          return; // Success!
        }
        
        // Check if failed
        if (preview.status === 'failed') {
          const errorMsg = preview.error || 'Preview generation failed';
          console.error(`[AsyncPreview] Preview generation failed:`, errorMsg);
          throw new Error(errorMsg);
        }
        
        // Wait before next poll (shorter interval for better UX)
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`[AsyncPreview] Polling attempt ${attempts} failed:`, error);
        
        // If it's the last attempt or a critical error, give up
        if (attempts >= maxAttempts || error.message.includes('404') || error.message.includes('Authentication')) {
          throw error;
        }
        
        // For other errors, try again after a longer wait
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    // Timeout reached
    throw new Error('Preview generation timed out - please try generating a new preview');
  }

  /**
   * Update the loading state UI with progress
   */
  updateImageLoadingState(message, progress = 0) {
    const loadingPlaceholder = document.getElementById('image-loading-placeholder');
    if (loadingPlaceholder) {
      const messageEl = loadingPlaceholder.querySelector('p');
      if (messageEl) {
        messageEl.textContent = message;
      }
      
      // Add or update progress bar
      let progressBar = loadingPlaceholder.querySelector('.progress-bar');
      if (!progressBar && progress > 0) {
        progressBar = document.createElement('div');
        progressBar.className = 'progress-bar';
        progressBar.style.cssText = `
          width: 200px; height: 4px; background: #e5e7eb; border-radius: 2px; 
          margin: 16px auto 0; overflow: hidden;
        `;
        
        const progressFill = document.createElement('div');
        progressFill.className = 'progress-fill';
        progressFill.style.cssText = `
          height: 100%; background: #3b82f6; width: 0%; 
          transition: width 0.3s ease; border-radius: 2px;
        `;
        
        progressBar.appendChild(progressFill);
        loadingPlaceholder.appendChild(progressBar);
      }
      
      // Update progress
      if (progressBar) {
        const progressFill = progressBar.querySelector('.progress-fill');
        if (progressFill) {
          progressFill.style.width = `${Math.max(5, progress)}%`;
        }
      }
    }
  }

  /**
   * Load completed preview image from server
   */
  async loadCompletedPreviewImage(imageUrl, previewId) {
    console.log('Loading completed preview image from:', imageUrl);
    
    try {
      // Use authenticated fetch to get the image
      const response = await window.AuthUtils.authenticatedFetch(imageUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }
      
      // Convert response to blob
      const blob = await response.blob();
      
      // Create object URL from blob
      const objectUrl = URL.createObjectURL(blob);
      
      // Load the image
      await new Promise((resolve, reject) => {
        const img = new Image();
        
        const timeout = setTimeout(() => {
          URL.revokeObjectURL(objectUrl); // Clean up
          reject(new Error('Image load timeout'));
        }, 10000);
        
        img.onload = () => {
          clearTimeout(timeout);
          console.log('Completed preview image loaded successfully');
          this.elements.previewImage.src = objectUrl;
          this.elements.previewImage.alt = `Preview of ${this.previewData.activityData?.name || 'Custom Map'}`;
          
          // Hide the loading placeholder
          const loadingPlaceholder = document.getElementById('image-loading-placeholder');
          if (loadingPlaceholder) {
            loadingPlaceholder.style.display = 'none';
          }
          
          // Make sure image is visible
          this.elements.previewImage.style.display = 'block';
          this.elements.previewImage.style.opacity = '1';
          
          // Update dimensions info
          if (this.elements.previewDimensions && this.previewData.dimensions) {
            const { width, height } = this.previewData.dimensions;
            this.elements.previewDimensions.textContent = `${width} × ${height} pixels (300 DPI)`;
          }
          
          resolve();
        };
        
        img.onerror = () => {
          clearTimeout(timeout);
          URL.revokeObjectURL(objectUrl); // Clean up
          reject(new Error('Failed to load preview image'));
        };
        
        img.src = objectUrl;
      });
      
    } catch (error) {
      console.error('Failed to load completed preview image:', error);
      throw error;
    }
  }

  /**
   * Load base64 preview image (legacy support)
   */
  async loadBase64PreviewImage(previewUrl) {
    console.log('Loading base64 preview image (legacy mode)');
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      const timeout = setTimeout(() => {
        reject(new Error('Base64 image load timeout'));
      }, 3000);
      
      img.onload = () => {
        clearTimeout(timeout);
        this.elements.previewImage.src = previewUrl;
        this.elements.previewImage.alt = `Preview of ${this.previewData.activityData?.name || 'Custom Map'}`;
        
        // Hide loading placeholder
        const loadingPlaceholder = document.getElementById('image-loading-placeholder');
        if (loadingPlaceholder) {
          loadingPlaceholder.style.display = 'none';
        }
        
        this.elements.previewImage.style.display = 'block';
        this.elements.previewImage.style.opacity = '1';
        
        resolve();
      };
      
      img.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Invalid base64 image data'));
      };
      
      img.src = previewUrl;
    });
  }

  /**
   * Load preview image from direct URL (legacy support)
   */
  async loadDirectPreviewImage(previewUrl) {
    const imageUrl = previewUrl.startsWith('http') 
      ? previewUrl 
      : `${this.options.baseUrl}${previewUrl}`;
    
    console.log('Loading preview from direct URL (legacy mode):', imageUrl);
    
    try {
      const response = await window.AuthUtils.authenticatedFetch(imageUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      
      return new Promise((resolve, reject) => {
        const img = new Image();
        
        const timeout = setTimeout(() => {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Direct image load timeout'));
        }, 10000);
        
        img.onload = () => {
          clearTimeout(timeout);
          this.elements.previewImage.src = objectUrl;
          this.elements.previewImage.alt = `Preview of ${this.previewData.activityData?.name || 'Custom Map'}`;
          
          const loadingPlaceholder = document.getElementById('image-loading-placeholder');
          if (loadingPlaceholder) {
            loadingPlaceholder.style.display = 'none';
          }
          
          this.elements.previewImage.style.display = 'block';
          this.elements.previewImage.style.opacity = '1';
          
          resolve();
        };
        
        img.onerror = () => {
          clearTimeout(timeout);
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Failed to load direct image'));
        };
        
        img.src = objectUrl;
      });
      
    } catch (error) {
      console.error('Direct image loading failed:', error);
      throw error;
    }
  }

  /**
   * Show image placeholder when image loading fails
   */
  showImagePlaceholder(message) {
    console.log('Showing image placeholder:', message);
    
    if (this.elements.previewImage) {
      // Create a placeholder image using SVG
      const placeholderSvg = `data:image/svg+xml;base64,${btoa(`
        <svg width="600" height="400" xmlns="http://www.w3.org/2000/svg">
          <rect width="600" height="400" fill="#f3f4f6" stroke="#d1d5db" stroke-width="2" rx="8"/>
          <text x="300" y="180" font-family="Arial, sans-serif" font-size="18" fill="#6b7280" text-anchor="middle">
            Map Preview Unavailable
          </text>
          <text x="300" y="210" font-family="Arial, sans-serif" font-size="14" fill="#9ca3af" text-anchor="middle">
            ${message}
          </text>
          <text x="300" y="240" font-family="Arial, sans-serif" font-size="12" fill="#9ca3af" text-anchor="middle">
            You can still proceed with your order
          </text>
        </svg>
      `)}`;
      
      this.elements.previewImage.src = placeholderSvg;
      this.elements.previewImage.alt = 'Map preview placeholder';
    }
    
    if (this.elements.previewDimensions) {
      this.elements.previewDimensions.textContent = 'High-quality 300 DPI print preview (image temporarily unavailable)';
    }
  }

  /**
   * Populate activity information
   */
  populateActivityInfo() {
    const activityData = this.previewData.activityData;
    
    if (activityData) {
      // Activity name
      if (this.elements.activityName) {
        this.elements.activityName.textContent = activityData.name || 'Custom Route';
      }
      
      // Distance
      if (this.elements.activityDistance) {
        const distance = activityData.distance 
          ? `${(activityData.distance / 1000).toFixed(1)}km`
          : '--';
        this.elements.activityDistance.textContent = distance;
      }
      
      // Elevation
      if (this.elements.activityElevation) {
        const elevation = activityData.total_elevation_gain 
          ? `${Math.round(activityData.total_elevation_gain)}m`
          : '--';
        this.elements.activityElevation.textContent = elevation;
      }
      
      // Date
      if (this.elements.activityDate) {
        const date = activityData.start_date_local 
          ? new Date(activityData.start_date_local).toLocaleDateString()
          : '--';
        this.elements.activityDate.textContent = date;
      }
      
      // Activity type
      if (this.elements.activityType && activityData.type) {
        this.elements.activityType.textContent = activityData.type;
      }
      
      console.log('Activity information populated');
    } else {
      console.warn('No activity data available for display');
    }
  }

  /**
   * Populate configuration details
   */
  populateConfiguration() {
    const settings = this.previewData.settings || {};
    
    // Print size
    if (this.elements.configSize) {
      this.elements.configSize.textContent = settings.printSize || 'A4';
    }
    
    // Orientation (element doesn't exist in current template, skipping)
    // if (this.elements.configOrientation) {
    //   this.elements.configOrientation.textContent = 
    //     (settings.layout || 'portrait').charAt(0).toUpperCase() + 
    //     (settings.layout || 'portrait').slice(1);
    // }
    
    // Map style
    if (this.elements.configStyle) {
      const style = settings.mapStyle || 'outdoors-v12';
      const styleName = style.replace('mapbox://styles/mapbox/', '').replace('-v12', '');
      this.elements.configStyle.textContent = 
        styleName.charAt(0).toUpperCase() + styleName.slice(1);
    }
    
    // Title
    if (this.elements.configTitle) {
      this.elements.configTitle.textContent = settings.mainTitle || 'EPIC RIDE';
    }
    
    // Subtitle
    if (this.elements.configSubtitle) {
      this.elements.configSubtitle.textContent = settings.subtitle || 'Summer 2023';
    }
    
    console.log('Configuration populated');
  }

  /**
   * Set up pricing based on configuration
   */
  setupPricing() {
    const settings = this.previewData.settings || {};
    const size = settings.printSize || 'A4';
    
    // Pricing logic
    const pricing = {
      A4: 45.00,
      A3: 55.00,
      A2: 65.00,
      A1: 85.00
    };
    
    const price = pricing[size] || pricing.A4;
    const formattedPrice = `£${price.toFixed(2)}`;
    
    // Update price elements
    if (this.elements.printPrice) {
      this.elements.printPrice.textContent = formattedPrice;
    }
    
    if (this.elements.totalPrice) {
      this.elements.totalPrice.textContent = formattedPrice;
    }
    
    console.log('Pricing set up for size:', size, 'Price:', formattedPrice);
  }

  /**
   * Process purchase using JSON file-based configuration approach
   * Simplified flow: save configuration → add to cart
   */
  async processPurchase() {
    if (!this.previewData) {
      console.error('No preview data available for purchase');
      return;
    }
    
    try {
      console.log('Processing purchase with JSON file-based approach...');
      
      // Disable button to prevent double-clicks
      if (this.elements.orderPosterBtn) {
        this.elements.orderPosterBtn.disabled = true;
        this.elements.orderPosterBtn.textContent = 'Saving Configuration...';
      }
      
      // Step 1: Save map configuration to JSON file
      const rawPrintSize = this.previewData.settings?.printSize || 'A4';
      const printSize = rawPrintSize.toUpperCase(); // Ensure uppercase for backend validation

      // 🎥 FIX: Extract camera from nested location and place at top level
      // this.previewData contains mapConfiguration with camera nested inside
      // Backend expects camera at mapConfiguration.camera (not mapConfiguration.mapConfiguration.camera)
      const camera = this.previewData.mapConfiguration?.camera || this.previewData.camera || null;

      const configData = {
        mapConfiguration: {
          ...this.previewData,
          camera: camera,  // ✅ Place camera at top level
          activityId: this.previewData.activityData?.id  // Add direct activityId for backend validation
        },
        printSize: printSize,
        orientation: this.previewData.settings?.layout || 'portrait'
      };

      console.log('Step 1: Saving map configuration to file system...');
      console.log('Configuration data:', {
        activityId: this.previewData.activityData?.id,
        printSize: configData.printSize,
        orientation: configData.orientation
      });

      // 🛒 CAMERA DEBUG: Log camera configuration being sent
      console.log('🛒 [Purchase] ===== CONFIGURATION PAYLOAD DEBUG =====');
      console.log('🛒 [Purchase] Preview data camera:', this.previewData.mapConfiguration?.camera);
      console.log('🛒 [Purchase] Configuration being sent:', {
        hasCamera: !!configData.mapConfiguration.camera,
        camera: configData.mapConfiguration.camera,
        hasMapConfiguration: !!configData.mapConfiguration.mapConfiguration,
        nestedCamera: configData.mapConfiguration.mapConfiguration?.camera,
        printSize: configData.printSize,
        orientation: configData.orientation,
        activityId: configData.mapConfiguration.activityId
      });
      console.log('🛒 [Purchase] Full config object keys:', Object.keys(configData.mapConfiguration));
      if (configData.mapConfiguration.camera) {
        console.log('🛒 [Purchase] Camera details:', {
          hasCenter: !!configData.mapConfiguration.camera.center,
          hasZoom: !!configData.mapConfiguration.camera.zoom,
          hasBearing: !!configData.mapConfiguration.camera.bearing,
          hasPitch: !!configData.mapConfiguration.camera.pitch,
          hasPadding: !!configData.mapConfiguration.camera.padding,
          hasViewport: !!configData.mapConfiguration.camera.viewport,
          padding: configData.mapConfiguration.camera.padding,
          viewport: configData.mapConfiguration.camera.viewport
        });
      }
      console.log('🛒 [Purchase] ===== END CONFIGURATION PAYLOAD DEBUG =====');
      
      console.log('=== CONFIGURATION SAVE DEBUG ===');
      console.log('Saving configuration with data:', configData);
      console.log('Base URL:', this.options.baseUrl);
      console.log('Save configuration endpoint:', `${this.options.baseUrl}/api/maps/save-configuration`);
      
      const configResponse = await window.AuthUtils.authenticatedFetch(
        `${this.options.baseUrl}/api/maps/save-configuration`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(configData)
        }
      );
      
      console.log('Configuration save response status:', configResponse.status);
      console.log('Configuration save response ok:', configResponse.ok);
      
      if (!configResponse.ok) {
        const errorText = await configResponse.text();
        console.error('Configuration save failed with response:', errorText);
        
        let error;
        try {
          error = JSON.parse(errorText);
        } catch (e) {
          error = { message: `HTTP ${configResponse.status}: ${errorText}` };
        }
        throw new Error(error.message || 'Failed to save configuration');
      }
      
      const configResult = await configResponse.json();
      console.log('=== CONFIGURATION SAVE SUCCESS ===');
      console.log('Configuration result:', configResult);
      console.log('Configuration ID:', configResult.configurationId);
      console.log('=== END CONFIGURATION SAVE DEBUG ===');
      
      // Update button status
      if (this.elements.orderPosterBtn) {
        this.elements.orderPosterBtn.textContent = 'Preparing Checkout...';
      }
      
      // Step 2: Process purchase with configuration ID
      const purchaseData = {
        configurationId: configResult.configurationId,
        printSize: configData.printSize,
        activityId: this.previewData.activityId,
        quantity: 1
      };
      
      console.log('Step 2: Processing purchase with configuration ID:', configResult.configurationId);
      
      console.log('=== PURCHASE API CALL DEBUG ===');
      console.log('Making purchase request with data:', purchaseData);
      
      const purchaseResponse = await window.AuthUtils.authenticatedFetch(
        `${this.options.baseUrl}/api/maps/purchase-with-config`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(purchaseData)
        }
      );
      
      console.log('Purchase response status:', purchaseResponse.status);
      console.log('Purchase response ok:', purchaseResponse.ok);
      console.log('Purchase response headers:', Array.from(purchaseResponse.headers.entries()));
      
      if (!purchaseResponse.ok) {
        const errorText = await purchaseResponse.text();
        console.error('Purchase failed with response:', errorText);
        
        let error;
        try {
          error = JSON.parse(errorText);
        } catch (e) {
          error = { message: `HTTP ${purchaseResponse.status}: ${errorText}` };
        }
        throw new Error(error.message || 'Purchase processing failed');
      }
      
      const purchaseResult = await purchaseResponse.json();
      console.log('=== PURCHASE RESULT DEBUG ===');
      console.log('Full purchase result:', purchaseResult);
      console.log('Purchase success:', purchaseResult.success);
      console.log('Configuration ID:', purchaseResult.configurationId);
      console.log('Cart URL present:', !!purchaseResult.cartUrl);
      console.log('Cart URL length:', purchaseResult.cartUrl?.length || 0);
      console.log('Cart URL preview:', purchaseResult.cartUrl?.substring(0, 100) + '...');
      console.log('=== END PURCHASE RESULT DEBUG ===');
      
      // Redirect to Shopify cart
      if (purchaseResult.cartUrl) {
        console.log('=== NAVIGATION DEBUG ===');
        console.log('Attempting navigation to cart URL');
        console.log('Current location:', window.location.href);
        console.log('Target location:', purchaseResult.cartUrl);
        console.log('Window location object:', window.location);
        console.log('=== STARTING NAVIGATION ===');
        
        // Multiple navigation methods for reliability
        setTimeout(() => {
          console.log('Executing navigation...');
          
          try {
            // Method 1: Standard location change
            console.log('Trying window.location.href...');
            window.location.href = purchaseResult.cartUrl;
            console.log('Navigation command executed via window.location.href');
            
            // Fallback method if navigation doesn't happen within 2 seconds
            setTimeout(() => {
              console.log('Fallback navigation - checking if still on same page...');
              if (window.location.href === purchaseResult.cartUrl) {
                console.log('Navigation successful');
              } else {
                console.log('Primary navigation may have failed, trying alternative methods...');
                
                // Method 2: location.assign
                try {
                  console.log('Trying window.location.assign...');
                  window.location.assign(purchaseResult.cartUrl);
                } catch (assignError) {
                  console.error('location.assign failed:', assignError);
                  
                  // Method 3: Manual form submission (last resort)
                  console.log('Creating manual form submission...');
                  const form = document.createElement('form');
                  form.method = 'GET';
                  form.action = purchaseResult.cartUrl;
                  document.body.appendChild(form);
                  form.submit();
                }
              }
            }, 2000);
            
          } catch (navError) {
            console.error('All navigation methods failed:', navError);
            alert(`Navigation failed. Please go to: ${purchaseResult.cartUrl}`);
          }
        }, 100);
        
      } else {
        console.error('No cart URL in response!');
        console.error('Purchase result keys:', Object.keys(purchaseResult));
        throw new Error('No cart URL received from server');
      }
      
    } catch (error) {
      console.error('Purchase processing failed:', error);
      
      // Re-enable button with original state and clear processing flag
      if (this.elements.orderPosterBtn) {
        this.elements.orderPosterBtn.disabled = false;
        this.elements.orderPosterBtn.dataset.processing = 'false';
        this.elements.orderPosterBtn.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 12l2 2 4-4"/>
            <circle cx="12" cy="12" r="10"/>
          </svg>
          Order This Poster
        `;
      }
      
      // Show more specific error messages
      let errorMessage = error.message;
      if (error.message.includes('save configuration') || error.message.includes('Failed to save configuration')) {
        errorMessage = 'Unable to save your map configuration. Please try again or go back to edit your map.';
      } else if (error.message.includes('Purchase processing failed')) {
        errorMessage = 'Configuration saved successfully, but checkout setup failed. Please try again.';
      }
      
      alert(`Purchase failed: ${errorMessage}`);
    }
  }

  /**
   * Navigate back to design page
   */
  navigateToDesign() {
    // Store current preview data for design page to reload
    if (this.previewData) {
      window.AuthUtils.storePreviewData(this.previewData);
    }
    
    console.log('Navigating back to design page...');
    window.location.href = '/pages/map-design';
  }

  /**
   * Start over - go back to activities
   */
  startOver() {
    console.log('Starting over - returning to activities...');
    
    // Clear preview data
    window.AuthUtils.clearPreviewData();
    
    // Navigate to activities
    window.location.href = '/pages/strava-activities';
  }

  /**
   * Retry loading preview
   */
  async retryPreviewLoad() {
    this.currentRetry++;
    console.log(`Retrying preview load (attempt ${this.currentRetry}/${this.options.maxRetries})...`);
    
    // Show loading state
    this.setState('loading');
    
    try {
      // Wait before retry
      if (this.currentRetry > 1) {
        await this.delay(this.options.retryDelay);
      }
      
      // Retry the full initialization
      await this.loadPreviewData();
      await this.displayPreview();
      
      // Reset retry counter on success
      this.currentRetry = 0;
      
    } catch (error) {
      console.error(`Retry attempt ${this.currentRetry} failed:`, error);
      
      if (this.currentRetry >= this.options.maxRetries) {
        this.showError(
          'Failed to Load Preview',
          'Unable to load your map preview after multiple attempts. Please try generating a new preview.',
          [{
            text: 'Back to Design',
            action: () => this.navigateToDesign()
          }]
        );
      } else {
        this.showError('Loading Failed', error.message);
      }
    }
  }

  /**
   * Show error state
   */
  showError(title, message, actions = []) {
    console.log('Showing error:', title, message);
    
    this.setState('error');
    
    if (this.elements.errorTitle) {
      this.elements.errorTitle.textContent = title;
    }
    
    if (this.elements.errorMessage) {
      this.elements.errorMessage.textContent = message;
    }
    
    // Add custom actions if provided
    if (actions.length > 0) {
      const errorActions = document.querySelector('.error-actions');
      if (errorActions) {
        // Clear existing actions
        errorActions.innerHTML = '';
        
        // Add custom actions
        actions.forEach(action => {
          const button = document.createElement('button');
          button.className = 'btn btn-primary';
          button.textContent = action.text;
          button.addEventListener('click', action.action);
          errorActions.appendChild(button);
        });
      }
    }
  }

  /**
   * Set the current display state
   */
  setState(state) {
    const states = ['loading', 'error', 'content'];
    
    console.log('=== SET STATE DEBUG ===');
    console.log('Setting state to:', state);
    
    states.forEach(s => {
      const element = this.elements[s];
      console.log(`Element '${s}':`, {
        exists: !!element,
        id: element?.id,
        currentDisplay: element?.style.display,
        computedDisplay: element ? window.getComputedStyle(element).display : 'N/A',
        classes: element?.className,
        visible: element ? element.offsetHeight > 0 : false
      });
      
      if (element) {
        element.style.display = s === state ? 'block' : 'none';
        element.style.visibility = s === state ? 'visible' : 'hidden';
        
        // Ensure visibility without excessive debug styling
        if (s === state) {
          element.style.setProperty('opacity', '1', 'important'); // Full opacity
          element.style.setProperty('visibility', 'visible', 'important'); // Force visible
          element.classList.remove('hidden'); // Remove any hidden classes
          element.hidden = false; // Remove hidden attribute
          console.log(`Applied visibility styles to ${s} element`);
        }
        
        console.log(`After setting ${s}:`, {
          display: element.style.display,
          visibility: element.style.visibility,
          offsetHeight: element.offsetHeight,
          offsetWidth: element.offsetWidth
        });
      } else {
        console.error(`Element '${s}' not found! Check DOM element IDs.`);
      }
    });
    
    console.log('=== SET STATE DEBUG END ===');
    console.log('State changed to:', state);
  }

  /**
   * Utility: Delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Destroy the instance and clean up
   */
  destroy() {
    console.log('Destroying MapPreviewApproval instance...');
    
    // Remove event listeners
    Object.values(this.elements).forEach(element => {
      if (element && element.removeEventListener) {
        // Note: In a real implementation, we'd need to store references to the bound functions
        // to properly remove event listeners. For now, we'll just clear the elements.
      }
    });
    
    // Clear data
    this.previewData = null;
    this.elements = {};
    this.isInitialized = false;
    
    console.log('MapPreviewApproval destroyed');
  }
}

// Export for use
if (typeof window !== 'undefined') {
  window.MapPreviewApproval = MapPreviewApproval;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MapPreviewApproval;
}