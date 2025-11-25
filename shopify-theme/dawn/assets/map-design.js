console.log('🔥 MAP-DESIGN.JS LOADED - MODERN POSTER DESIGNER VERSION 🔥');

/**
 * Modern Poster Designer - Map Design Page Manager
 * Integrates with existing MapboxIntegration class to create custom maps with 3-step workflow
 */
class MapDesign {
  constructor(options = {}) {
    console.log('🔥 MapDesign constructor called - MODERN POSTER DESIGNER VERSION 🔥');
    this.options = {
      showActivityInfo: options.showActivityInfo !== false,
      showStyleControls: options.showStyleControls !== false,
      showExportOptions: options.showExportOptions !== false,
      defaultMapStyle: options.defaultMapStyle || 'grey',
      defaultExportFormat: options.defaultExportFormat || 'A4',
      baseUrl: 'https://boss-hog-freely.ngrok-free.app'
    };

    // State management
    this.activityData = null;
    this.mapboxIntegration = null;
    this.isInitialized = false;
    this.sessionToken = null;
    this.currentStep = 'style';
    this.currentPreviewId = null;  // Track current preview for purchase flow
    this.currentSettings = {
      mapType: 'street',           // New: Currently selected map type
      mapStyle: 'streets',         // New: Currently selected map style
      colorScheme: 'synthwave',    // Keep for backward compatibility
      routeThickness: 4,
      routeColor: '#ff4444',       // New: Route line color (default red)
      mainTitle: 'EPIC RIDE',
      subtitle: 'Summer 2023',
      layout: 'portrait',
      printSize: 'a3'              // Default to A3 (most popular)
    };

    // Initialize Canvas Size Manager for precise preview-to-print matching
    this.canvasSizeManager = null;
    if (typeof CanvasSizeManager !== 'undefined') {
      this.canvasSizeManager = new CanvasSizeManager({
        viewportScaleFactor: 0.14,  // 0.14 scale (44% reduction) for compact viewing
        enableTransitions: true
      });
      console.log('CanvasSizeManager initialized with 0.14 scale');
    } else {
      console.warn('CanvasSizeManager not available');
    }

    // DOM elements
    this.elements = {
      // Map elements
      mapContainer: document.getElementById('mapbox-map'),
      mapLoading: document.getElementById('map-loading'),
      mapError: document.getElementById('map-error'),
      errorTitle: document.getElementById('error-title'),
      errorMessage: document.getElementById('error-message'),
      retryButton: document.getElementById('retry-map-button'),
      
      // Route info elements
      routeName: document.getElementById('route-name'),
      routeLocation: document.getElementById('route-location'),
      routeDistance: document.getElementById('route-distance'),
      routeElevation: document.getElementById('route-elevation'),
      routeDate: document.getElementById('route-date'),

      // NEW: Header elements
      routeBadgeToggle: document.getElementById('route-badge-toggle'),
      routeDetailsExpandable: document.getElementById('route-details-expandable'),
      summarySelectionText: document.getElementById('summary-selection-text'),
      summarySizeText: document.getElementById('summary-size-text'),

      // Step navigation (updated for tabs)
      stepTabs: document.querySelectorAll('.step-tab'),
      stepPanels: document.querySelectorAll('.step-panel'),
      footerStepCount: document.getElementById('footer-step-count'),
      footerPrice: document.getElementById('footer-price'),
      prevStepBtn: document.getElementById('prev-step-btn'),
      nextStepBtn: document.getElementById('next-step-btn'),
      
      // Style controls - New two-tier selectors (will be re-queried when needed)
      mapTypeSelector: null,
      mapStyleSelector: null,
      mapTypeOptions: null,
      styleOptions: null,
      
      // Legacy style controls (keep for compatibility)
      colorSchemes: document.querySelectorAll('.color-scheme'),
      routeThicknessSlider: document.getElementById('route-thickness-slider'),
      presetOptions: document.querySelectorAll('.preset-option'),
      
      // Text controls
      mainTitleInput: document.getElementById('main-title-input'),
      subtitleInput: document.getElementById('subtitle-input'),
      suggestionItems: document.querySelectorAll('.suggestion-item'),
      
      // Layout controls
      layoutOptions: document.querySelectorAll('.layout-option'),
      sizeOptions: document.querySelectorAll('.size-option'),
      
      // Text overlays
      titleOverlay: document.getElementById('main-title-overlay'),
      subtitleOverlay: document.getElementById('subtitle-overlay'),
      statsOverlay: document.getElementById('stats-overlay'),
      overlayDistance: document.getElementById('overlay-distance'),
      overlayElevation: document.getElementById('overlay-elevation'),
      
      // Action buttons
      saveButton: document.getElementById('save-button'),
      shareButton: document.getElementById('share-button'),

      // Summary bar elements
      summaryBar: document.querySelector('.selection-summary-bar'),
      summaryStyleText: document.getElementById('summary-style-text'),
      summarySizeText: document.getElementById('summary-size-text'),
      summaryPriceText: document.getElementById('summary-price-text'),

      // Gallery modal elements
      browseStylesBtn: document.getElementById('browse-all-styles-btn'),
      galleryModal: document.getElementById('styles-gallery-modal'),
      galleryOverlay: document.getElementById('gallery-overlay'),
      galleryCloseBtn: document.getElementById('gallery-close-btn'),
      galleryGrid: document.getElementById('gallery-grid')
    };

    this.extractSessionToken();
    this.bindEvents();
  }

  /**
   * Get organized map types and their associated styles
   * @returns {Object} Map types with their associated styles
   */
  getMapTypeStyles() {
    return {
      street: {
        name: 'Street',
        description: 'Street maps with roads and labels',
        styles: {
          streets: { name: 'Classic Streets', previewColor: '#f8f8f8', mapboxStyle: 'streets-v11' },
          light: { name: 'Light Streets', previewColor: '#f0f0f0', mapboxStyle: 'light-v10' },
          grey: { name: 'Minimal Streets', previewColor: '#808080', mapboxStyle: 'macken04/cm9qvmy7500hr01s5h4h67lsr' }
        }
      },
      classic: {
        name: 'Classic',
        description: 'Classic themed maps with multiple color variants',
        styles: {
          'classic': { name: 'Classic', previewColor: '#f8f8f8', mapboxStyle: 'macken04/cme05849o00eb01sbh2b46dz4' },
          'classic-grey': { name: 'Classic Grey', previewColor: '#888888', mapboxStyle: 'macken04/cmdowoyfi003o01r5h90e8r6l' },
          'classic-dark': { name: 'Classic Dark', previewColor: '#2c2c2c', mapboxStyle: 'macken04/cmdowqfh4004h01sb14fe6x3u' },
          'classic-blue': { name: 'Classic Blue', previewColor: '#4a90e2', mapboxStyle: 'macken04/cmdowyoil001d01sh5937dt1p' },
          'classic-orange': { name: 'Classic Orange', previewColor: '#e67e22', mapboxStyle: 'macken04/cmdowyoaj004i01sb9i27ene8' },
          'classic-pink': { name: 'Classic Pink', previewColor: '#e91e63', mapboxStyle: 'macken04/cme063epj00rq01pjamus26ma' }
        }
      },
      minimal: {
        name: 'Minimal',
        description: 'Clean, simple map styles',
        styles: {
          'minimal-dark': { name: 'Minimal Dark', previewColor: '#2c2c2c', mapboxStyle: 'macken04/cm9mvpjc8010b01quegchbmov' },
          'minimal-pink': { name: 'Minimal Pink', previewColor: '#f8bbd9', mapboxStyle: 'macken04/cm9mvpk4s010c01qu4jzgccqt' },
          'minimal-grey': { name: 'Minimal Grey', previewColor: '#808080', mapboxStyle: 'macken04/cm9mvpjxz001q01pgco8gefok' },
          'minimal-sand': { name: 'Minimal Sand', previewColor: '#e6ddd4', mapboxStyle: 'macken04/cm9mvpjrw001801s5d2xv8t27' },
          'minimal-sage': { name: 'Minimal Sage', previewColor: '#c7d2cc', mapboxStyle: 'macken04/cm9mvpjj0006y01qsckitaoib' }
        }
      },
      bubble: {
        name: 'Bubble',
        description: 'Playful bubble-themed map style',
        styles: {
          'bubble': { name: 'Bubble', previewColor: '#87ceeb', mapboxStyle: 'macken04/cmdpqgs5y00av01qs9jat5xu9' }
        }
      },
      satellite: {
        name: 'Satellite',
        description: 'Satellite imagery and aerial views',
        styles: {
          satellite: { name: 'Standard Satellite', previewColor: '#4a6741', mapboxStyle: 'satellite-v9' },
          'satellite-streets': { name: 'Satellite Streets', previewColor: '#5a7751', mapboxStyle: 'satellite-streets-v11' }
        }
      },
      terrain: {
        name: 'Terrain',
        description: 'Topographic and outdoor maps',
        styles: {
          outdoors: { name: 'Outdoors', previewColor: '#e8f5e8', mapboxStyle: 'outdoors-v11' },
          terrain: { name: 'Topographic', previewColor: '#d4b896', mapboxStyle: 'outdoors-v11' }
        }
      }
    };
  }

  /**
   * Resolve a style key to its actual Mapbox style URL
   * @param {string} styleKey - The style key (e.g., "classic-dark")
   * @returns {string} The Mapbox style URL or fallback
   */
  resolveStyleKeyToURL(styleKey) {
    if (!styleKey) return 'outdoors-v12'; // Default fallback
    
    const mapTypes = this.getMapTypeStyles();
    
    // Search through all map types to find the style
    for (const [typeKey, typeData] of Object.entries(mapTypes)) {
      if (typeData.styles[styleKey]) {
        const mapboxStyle = typeData.styles[styleKey].mapboxStyle;
        const fullStyleUrl = this.formatMapboxStyleUrl(mapboxStyle);
        console.log(`🎨 Resolved style key "${styleKey}" to URL: ${fullStyleUrl}`);
        return fullStyleUrl;
      }
    }
    
    // Handle underscore/hyphen mismatch - try normalizing the style key
    const normalizedStyleKey = styleKey.replace(/_/g, '-'); // Convert underscores to hyphens
    if (normalizedStyleKey !== styleKey) {
      console.log(`🎨 Trying normalized style key: "${styleKey}" → "${normalizedStyleKey}"`);
      for (const [typeKey, typeData] of Object.entries(mapTypes)) {
        if (typeData.styles[normalizedStyleKey]) {
          const mapboxStyle = typeData.styles[normalizedStyleKey].mapboxStyle;
          const fullStyleUrl = this.formatMapboxStyleUrl(mapboxStyle);
          console.log(`🎨 Resolved normalized style key "${normalizedStyleKey}" to URL: ${fullStyleUrl}`);
          return fullStyleUrl;
        }
      }
    }
    
    // If still not found, log warning and return fallback
    console.warn(`🎨 Style key "${styleKey}" (normalized: "${normalizedStyleKey}") not found in map types, using fallback`);
    return 'outdoors-v12';
  }

  /**
   * Format a Mapbox style identifier to a full URL
   * @param {string} styleId - Style identifier (e.g., "streets-v11" or "macken04/style123")
   * @returns {string} Full Mapbox style URL
   */
  formatMapboxStyleUrl(styleId) {
    if (!styleId) return 'mapbox://styles/mapbox/outdoors-v12';
    
    // If already a complete URL, return as-is
    if (styleId.startsWith('mapbox://styles/')) {
      return styleId;
    }
    
    // If it contains a slash, it's a custom style (username/styleid)
    if (styleId.includes('/')) {
      return `mapbox://styles/${styleId}`;
    }
    
    // Otherwise, it's a standard Mapbox style
    return `mapbox://styles/mapbox/${styleId}`;
  }

  /**
   * Initialize the map design page
   */
  async init() {
    console.log('Initializing Map Design page');
    
    // Debug page load token status
    console.log('🔍 [map-design init] Page URL:', window.location.href);
    console.log('🔍 [map-design init] URL Search Params:', window.location.search);
    
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    console.log('🔍 [map-design init] Token in URL:', urlToken ? 'EXISTS (length=' + urlToken.length + ')' : 'NOT FOUND');
    
    console.log('🔍 [map-design init] AuthUtils available:', !!window.AuthUtils);
    if (window.AuthUtils) {
      const authToken = window.AuthUtils.getToken();
      console.log('🔍 [map-design init] AuthUtils token:', authToken ? 'EXISTS (length=' + authToken.length + ')' : 'NOT FOUND');
    }
    
    // Check localStorage directly
    const storedToken = localStorage.getItem('strava_session_token');
    const storedExpiry = localStorage.getItem('strava_token_expiry');
    console.log('🔍 [map-design init] localStorage token:', storedToken ? 'EXISTS (length=' + storedToken.length + ')' : 'NOT FOUND');
    console.log('🔍 [map-design init] localStorage expiry:', storedExpiry);
    
    try {
      // Load activity data from storage or URL
      await this.loadActivityData();
      
      if (!this.activityData) {
        this.showError('No Activity Selected', 'Please select an activity from the activities page to create a custom map.');
        return;
      }

      // Display activity information
      if (this.options.showActivityInfo) {
        this.displayActivityInfo();
      }

      // Initialize Mapbox integration
      await this.initializeMap();

      // Update summary bar with initial values
      this.updateSummaryBar();

    } catch (error) {
      console.error('Failed to initialize map design:', error);
      this.showError('Initialization Failed', error.message);
    }
  }

  /**
   * Extract session token from URL parameters
   */
  extractSessionToken() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (token) {
      this.sessionToken = token;
      console.log('Session token captured for map design');
    } else {
      // Try to get token from localStorage if passed from activities page
      this.sessionToken = localStorage.getItem('stravaSessionToken');
    }
  }

  /**
   * Load activity data from storage or fetch from API with proper ID persistence
   */
  async loadActivityData() {
    console.log('Loading activity data with route ID persistence...');
    
    // Get activity ID from multiple sources with priority order
    const activityId = this.getActivityId();
    console.log('Determined activity ID:', activityId);
    
    if (activityId) {
      // Store the activity ID for future page refreshes
      this.persistActivityId(activityId);
      
      // Try to get cached activity data first
      const cachedActivity = this.getCachedActivityData(activityId);
      if (cachedActivity) {
        this.activityData = cachedActivity;
        console.log('Loaded activity data from cache:', this.activityData);
        return;
      }
      
      // If not cached, fetch from API
      console.log('Attempting to fetch activity data from API...');
      await this.fetchActivityFromAPI(activityId);
    } else {
      // For development/testing, provide sample activity data if no real data is available
      console.warn('No activity ID found. Using sample data for testing.');
      this.activityData = this.getSampleActivityData();
      // Store sample data with a fake ID for persistence testing
      this.persistActivityId('sample-123');
      this.cacheActivityData('sample-123', this.activityData);
    }
  }

  /**
   * Get activity ID from multiple sources with priority
   * @returns {string|null} Activity ID
   */
  getActivityId() {
    // Priority 1: URL parameters (multiple possible names for compatibility)
    const urlParams = new URLSearchParams(window.location.search);
    const urlActivityId = urlParams.get('activityId') || urlParams.get('activity_id') || urlParams.get('activity') || urlParams.get('id');
    if (urlActivityId) {
      console.log('Activity ID found in URL parameters:', urlActivityId);
      return urlActivityId;
    }
    
    // Priority 2: Check fresh user selection from activities page (most recent choice)
    try {
      const storedActivity = localStorage.getItem('selectedActivityData');
      if (storedActivity) {
        const parsedActivity = JSON.parse(storedActivity);
        if (parsedActivity && parsedActivity.id) {
          console.log('Activity ID found in fresh user selection:', parsedActivity.id);
          return parsedActivity.id;
        }
      }
    } catch (error) {
      console.warn('Failed to parse stored activity data for ID extraction:', error);
    }
    
    // Priority 3: Check session storage (current session)
    const sessionId = sessionStorage.getItem('currentActivityId');
    if (sessionId) {
      console.log('Activity ID found in session storage:', sessionId);
      return sessionId;
    }
    
    // Priority 4: Check localStorage for long-term persistence (fallback only)
    const persistedId = localStorage.getItem('lastActivityId');
    if (persistedId) {
      console.log('Activity ID found in persisted storage (fallback):', persistedId);
      return persistedId;
    }
    
    console.warn('No activity ID found in any source');
    return null;
  }

  /**
   * Persist activity ID for page refresh scenarios
   * @param {string} activityId - Activity ID to persist
   */
  persistActivityId(activityId) {
    if (!activityId) return;
    
    try {
      // Store in both localStorage and sessionStorage with consistent keys
      localStorage.setItem('lastActivityId', activityId);  // For long-term persistence
      sessionStorage.setItem('currentActivityId', activityId);  // For current session
      
      // Also update the URL if it doesn't already have the activity parameter
      const urlParams = new URLSearchParams(window.location.search);
      
      // Check for existing activity parameters (multiple possible names)
      if (!urlParams.has('activityId') && !urlParams.has('activity_id') && !urlParams.has('activity') && !urlParams.has('id')) {
        urlParams.set('activityId', activityId);  // Use consistent parameter name
        const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
        
        // Update URL without triggering page reload
        window.history.replaceState({ activityId: activityId }, '', newUrl);
        console.log('Updated URL with activity ID:', newUrl);
      }
      
      console.log('Activity ID persisted to storage and URL:', activityId);
    } catch (error) {
      console.error('Failed to persist activity ID:', error);
    }
  }

  /**
   * Get cached activity data for specific activity ID
   * @param {string} activityId - Activity ID
   * @returns {Object|null} Cached activity data or null
   */
  getCachedActivityData(activityId) {
    if (!activityId) return null;
    
    try {
      // Check for activity-specific cache
      const cacheKey = `activityData_${activityId}`;
      const cachedData = localStorage.getItem(cacheKey);
      
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        
        // Check if cache is still valid (24 hours)
        const cacheAge = Date.now() - (parsed.cacheTimestamp || 0);
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        
        if (cacheAge < maxAge) {
          console.log(`Found valid cached data for activity ${activityId}, age: ${Math.round(cacheAge / 1000)}s`);
          return parsed.activityData;
        } else {
          console.log(`Cached data for activity ${activityId} is expired, removing...`);
          localStorage.removeItem(cacheKey);
        }
      }
      
      // Fallback: check the general selectedActivityData if it matches our ID
      const generalStored = localStorage.getItem('selectedActivityData');
      if (generalStored) {
        const parsed = JSON.parse(generalStored);
        if (parsed && parsed.id === activityId) {
          console.log('Found matching activity in general storage');
          // Cache it properly for future use
          this.cacheActivityData(activityId, parsed);
          return parsed;
        }
      }
      
    } catch (error) {
      console.error('Failed to get cached activity data:', error);
    }
    
    return null;
  }

  /**
   * Cache activity data with activity-specific key
   * @param {string} activityId - Activity ID
   * @param {Object} activityData - Activity data to cache
   */
  cacheActivityData(activityId, activityData) {
    if (!activityId || !activityData) return;
    
    try {
      const cacheKey = `activityData_${activityId}`;
      const cacheData = {
        activityData: activityData,
        cacheTimestamp: Date.now(),
        activityId: activityId
      };
      
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      
      // Also update the general selectedActivityData for backward compatibility
      localStorage.setItem('selectedActivityData', JSON.stringify(activityData));
      
      console.log(`Activity data cached for activity ${activityId}`);
    } catch (error) {
      console.error('Failed to cache activity data:', error);
    }
  }

  /**
   * Fetch activity data from API
   * @param {string} activityId - Activity ID to fetch
   */
  async fetchActivityFromAPI(activityId) {
    try {
      const apiUrl = `${this.options.baseUrl}/api/strava/activities/${activityId}${this.sessionToken ? `?token=${this.sessionToken}` : ''}`;
      
      console.log(`Fetching activity ${activityId} from API:`, apiUrl);
      
      const response = await fetch(apiUrl, {
        credentials: 'include',
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch activity data: ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.activity) {
        this.activityData = data.activity;
        
        // Cache the successfully fetched activity data
        this.cacheActivityData(activityId, data.activity);
        
        console.log('Successfully loaded and cached activity data from API:', this.activityData);
      } else {
        throw new Error(data.message || 'Failed to load activity data from API response');
      }
    } catch (error) {
      console.error('Failed to fetch activity data from API:', error);
      
      // Try to use cached data as fallback even if expired
      const cachedFallback = this.getCachedActivityDataIgnoreExpiry(activityId);
      if (cachedFallback) {
        console.warn('Using expired cached data as fallback');
        this.activityData = cachedFallback;
        return;
      }
      
      // Final fallback to sample data
      console.warn('API fetch failed and no cached data available. Using sample data as fallback.');
      this.activityData = this.getSampleActivityData();
    }
  }

  /**
   * Get cached activity data ignoring expiry (for fallback scenarios)
   * @param {string} activityId - Activity ID
   * @returns {Object|null} Cached activity data or null
   */
  getCachedActivityDataIgnoreExpiry(activityId) {
    if (!activityId) return null;
    
    try {
      const cacheKey = `activityData_${activityId}`;
      const cachedData = localStorage.getItem(cacheKey);
      
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        console.log(`Found cached data for activity ${activityId} (ignoring expiry)`);
        return parsed.activityData;
      }
    } catch (error) {
      console.error('Failed to get cached activity data (ignore expiry):', error);
    }
    
    return null;
  }

  /**
   * Display activity information in the UI
   */
  displayActivityInfo() {
    if (!this.activityData) return;

    const activity = this.activityData;
    
    // Update route name
    if (this.elements.routeName) {
      this.elements.routeName.textContent = activity.name || 'Unnamed Activity';
    }
    
    // Update route location (extract from start coordinates or use a placeholder)
    if (this.elements.routeLocation) {
      this.elements.routeLocation.textContent = this.extractLocationFromActivity(activity);
    }
    
    // Update route stats
    if (this.elements.routeDistance) {
      const distance = (activity.distance / 1000).toFixed(1);
      this.elements.routeDistance.textContent = `${distance}km`;
    }
    
    if (this.elements.routeElevation) {
      const elevation = Math.round(activity.total_elevation_gain || 0);
      this.elements.routeElevation.textContent = `${elevation}m`;
    }
    
    if (this.elements.routeDate) {
      const date = new Date(activity.start_date_local);
      this.elements.routeDate.textContent = date.toLocaleDateString();
    }
    
    // Update overlay stats
    if (this.elements.overlayDistance) {
      const distance = (activity.distance / 1000).toFixed(1);
      this.elements.overlayDistance.textContent = `${distance}km`;
    }
    
    if (this.elements.overlayElevation) {
      const elevation = Math.round(activity.total_elevation_gain || 0);
      this.elements.overlayElevation.textContent = `${elevation}m`;
    }
  }

  /**
   * Extract location information from activity data
   */
  extractLocationFromActivity(activity) {
    // Try to get location from various fields in activity data
    if (activity.location_city && activity.location_state) {
      return `${activity.location_city}, ${activity.location_state}`;
    }
    if (activity.location_city) {
      return activity.location_city;
    }
    if (activity.timezone) {
      // Extract location hint from timezone
      const parts = activity.timezone.split('/');
      if (parts.length > 1) {
        return parts[1].replace('_', ' ');
      }
    }
    return 'Unknown Location';
  }

  /**
   * Step Navigation Functions
   */
  
  /**
   * Navigate to a specific step (updated for 4-tab horizontal layout)
   */
  navigateToStep(stepName) {
    console.log(`Navigating to step: ${stepName}`);

    const steps = ['style', 'colors', 'text', 'size'];
    const stepIndex = steps.indexOf(stepName);

    if (stepIndex === -1) {
      console.error(`Invalid step: ${stepName}`);
      return;
    }

    this.currentStep = stepName;

    // Update tab states (instead of step-item)
    if (this.elements.stepTabs) {
      this.elements.stepTabs.forEach((tab, index) => {
        const step = steps[index];
        const isActive = step === stepName;
        const isCompleted = index < stepIndex;

        tab.classList.toggle('active', isActive);
        tab.classList.toggle('completed', isCompleted);
        tab.setAttribute('aria-selected', isActive);

        // Show/hide checkmark for completed tabs
        const checkmark = tab.querySelector('.tab-checkmark');
        if (checkmark) {
          checkmark.classList.toggle('hidden', !isCompleted);
        }
      });
    }

    // Update step panels
    this.elements.stepPanels.forEach((panel) => {
      const panelStep = panel.id.replace('-step', '');
      panel.classList.toggle('active', panelStep === stepName);
    });

    // Update footer step count for 4 tabs
    if (this.elements.footerStepCount) {
      this.elements.footerStepCount.textContent = `${stepIndex + 1}/4`;
    }

    // Update navigation buttons
    this.updateNavigationButtons(stepIndex, steps.length);

    // Update selection summary in header
    this.updateSelectionSummary();

    // Add animation
    const activePanel = document.getElementById(`${stepName}-step`);
    if (activePanel) {
      activePanel.classList.add('fade-in');
      setTimeout(() => activePanel.classList.remove('fade-in'), 300);
    }
  }
  
  /**
   * Update navigation button states (updated for new footer)
   */
  updateNavigationButtons(currentIndex, totalSteps) {
    // Update previous button state
    if (this.elements.prevStepBtn) {
      this.elements.prevStepBtn.disabled = currentIndex === 0;
    }

    // Update next button text and state
    if (this.elements.nextStepBtn) {
      const isLastStep = currentIndex === totalSteps - 1;
      const buttonText = this.elements.nextStepBtn.querySelector('span');

      if (buttonText) {
        buttonText.textContent = isLastStep ? 'Create Poster' : 'Next';
      }
    }

    // Update footer price (call pricing update)
    this.updateFooterPrice();
  }

  /**
   * Toggle route details expansion in header
   */
  toggleRouteDetails() {
    const expandable = this.elements.routeDetailsExpandable;
    const toggle = this.elements.routeBadgeToggle;

    if (expandable && toggle) {
      const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', !isExpanded);
      expandable.classList.toggle('hidden', isExpanded);
    }
  }

  /**
   * Update inline selection summary in header
   */
  updateSelectionSummary() {
    // Update style selection text
    if (this.elements.summarySelectionText) {
      const displayText = this.getStyleDisplayName();
      this.elements.summarySelectionText.textContent = displayText;
    }

    // Update size text
    if (this.elements.summarySizeText) {
      const size = (this.currentSettings.printSize || 'a3').toUpperCase();
      const orientation = this.currentSettings.layout || 'portrait';
      const orientationText = orientation.charAt(0).toUpperCase() + orientation.slice(1);
      this.elements.summarySizeText.textContent = `${size} ${orientationText}`;
    }
  }

  /**
   * Get display name for current style selection
   */
  getStyleDisplayName() {
    const mapType = this.currentSettings.mapType;
    const mapColor = this.currentSettings.mapColor;

    // If using new theme/color system
    if (mapType && window.mapboxCustomization) {
      const themeStyles = window.mapboxCustomization.getThemeStyles();
      const themeName = themeStyles[mapType]?.name || mapType;

      if (mapColor) {
        const colorInfo = themeStyles[mapType]?.colors[mapColor];
        const colorName = colorInfo?.name || mapColor;
        return `${themeName} ${colorName}`;
      }
      return themeName;
    }

    // Fallback to color scheme
    return this.currentSettings.colorScheme || 'Classic Blue';
  }

  /**
   * Update footer price display
   */
  updateFooterPrice() {
    if (!this.elements.footerPrice) return;

    const size = (this.currentSettings.printSize || 'a3').toLowerCase();
    const prices = {
      'a4': '£45',
      'a3': '£55',
      'a2': '£65',
      'a1': '£75'
    };

    const price = prices[size] || '£55';
    this.elements.footerPrice.textContent = price;
  }
  
  /**
   * Navigate to next step (updated for 4-tab layout)
   */
  nextStep() {
    const steps = ['style', 'colors', 'text', 'size'];
    const currentIndex = steps.indexOf(this.currentStep);

    if (currentIndex < steps.length - 1) {
      this.navigateToStep(steps[currentIndex + 1]);
    } else {
      // Final step - preview poster (this could navigate to checkout)
      console.log('Final step - would navigate to preview/checkout');
      this.previewPoster();
    }
  }

  /**
   * Navigate to previous step (updated for 4-tab layout)
   */
  prevStep() {
    const steps = ['style', 'colors', 'text', 'size'];
    const currentIndex = steps.indexOf(this.currentStep);

    if (currentIndex > 0) {
      this.navigateToStep(steps[currentIndex - 1]);
    }
  }
  
  /**
   * Preview poster functionality - generate server-side preview and navigate to preview page
   */
  async previewPoster() {
    console.log('🎯 PREVIEW POSTER CLICKED - Starting server-side preview generation...');
    console.log('📋 Current settings:', this.currentSettings);
    console.log('📋 Activity data available:', !!this.activityData);
    console.log('📋 Map integration available:', !!this.mapboxIntegration);

    // Show loading indicator
    const loadingOverlay = this.showLoadingOverlay('Generating preview image on server...');

    try {
      // Validate required data
      if (!this.activityData || !this.activityData.id) {
        throw new Error('Activity data not available');
      }

      if (!this.mapboxIntegration || !this.mapboxIntegration.map) {
        throw new Error('Map integration not available');
      }

      const map = this.mapboxIntegration.map;
      const currentBounds = map.getBounds();

      // Extract route coordinates from map
      const routeSource = map.getSource('route');
      let coordinates = [];
      if (routeSource && routeSource._data) {
        const geojson = routeSource._data;
        if (geojson.type === 'Feature' && geojson.geometry && geojson.geometry.coordinates) {
          coordinates = geojson.geometry.coordinates;
        } else if (geojson.type === 'FeatureCollection' && geojson.features && geojson.features.length > 0) {
          coordinates = geojson.features[0].geometry.coordinates;
        }
      }

      if (!coordinates || coordinates.length === 0) {
        throw new Error('Route coordinates not available on map');
      }

      // 🎯 CRITICAL FIX: Wait for poster fit to complete before capturing camera
      // This ensures we capture the settled camera state after all poster-fit adjustments
      console.log('🎥 previewPoster: Waiting for poster fit before camera capture...');
      await this.waitForPosterFit({ reason: 'previewPoster', timeout: 6000 });
      console.log('🎥 previewPoster: Poster fit complete, capturing camera now');

      // 🎯 Additional layout wait: Ensure DOM layout is complete after poster fit
      await new Promise(resolve => requestAnimationFrame(resolve));
      console.log('🎥 previewPoster: requestAnimationFrame complete, layout settled');

      // 🎥 CAMERA CAPTURE: Get canvas dimensions for viewport tracking
      const canvas = map.getCanvas();
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      console.log('🎥 [Camera Capture - previewPoster] Canvas dimensions:', { width: canvasWidth, height: canvasHeight });

      // 🎥 CAMERA CAPTURE: Get actual padding from map instance with proper fallback chain
      let currentPadding;
      try {
        currentPadding = map.getPadding();
        if (currentPadding) {
          console.log('🎥 [Camera Capture - previewPoster] Map padding (from getPadding()):', currentPadding);
        } else {
          throw new Error('getPadding() returned undefined');
        }
      } catch (error) {
        console.warn('🎥 [Camera Capture - previewPoster] getPadding() failed, trying window.__MAPBOX_ROUTES__:', error.message);
        currentPadding = window.__MAPBOX_ROUTES__?.currentFitPadding;

        if (!currentPadding) {
          console.warn('🎥 [Camera Capture - previewPoster] No padding found, using default fallback');
          currentPadding = {
            top: 120,
            right: 120,
            bottom: 120,
            left: 120
          };
        }
        console.log('🎥 [Camera Capture - previewPoster] Map padding (from fallback):', currentPadding);
      }

      // 🎥 CAMERA CAPTURE: Capture exact map camera state for print matching
      const centerLngLat = map.getCenter();
      const camera = {
        center: [centerLngLat.lng, centerLngLat.lat],  // Ensure array format, not LngLat object
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch(),
        padding: currentPadding,
        // Add viewport dimensions for backend padding scaling and dimension validation
        viewport: {
          width: canvasWidth,
          height: canvasHeight
        }
      };

      // 🎥 Structured logging: Log complete camera capture for debugging
      console.log('🎥 [Camera Capture - previewPoster] Map center:', camera.center);
      console.log('🎥 [Camera Capture - previewPoster] Map zoom:', camera.zoom);
      console.log('🎥 [Camera Capture - previewPoster] Map bearing:', camera.bearing);
      console.log('🎥 [Camera Capture - previewPoster] Map pitch:', camera.pitch);
      console.log('🎥 [Camera Capture - previewPoster] Map padding:', camera.padding);
      console.log('🎥 [Camera Capture - previewPoster] Viewport dimensions:', camera.viewport);
      console.log('🎥 [Camera Capture - previewPoster] Complete camera object:', camera);

      // Get poster bounds for backend (optional safety net)
      const posterBounds = window.__MAPBOX_ROUTES__?.currentPosterBounds ||
        this.mapboxIntegration.routes?.getPosterBounds();

      // Prepare preview generation request
      const previewRequest = {
        activityId: this.activityData.id,
        coordinates: coordinates,
        style: this.currentSettings.mapStyle || 'streets-v12',
        format: (this.currentSettings.printSize || 'A4').toUpperCase(),
        orientation: this.currentSettings.layout || 'portrait',
        mainTitle: this.currentSettings.mainTitle || 'EPIC RIDE',
        subtitle: this.currentSettings.subtitle || '',
        showStartEnd: true,
        lineColor: this.currentSettings.routeColor,
        lineWidth: this.currentSettings.routeThickness,
        bounds: {
          north: currentBounds.getNorth(),
          south: currentBounds.getSouth(),
          east: currentBounds.getEast(),
          west: currentBounds.getWest()
        },
        camera: camera,  // Include camera for exact preview-to-print matching
        posterBounds: posterBounds ? {  // Optional: Include calculated poster bounds as safety net
          north: posterBounds.getNorth(),
          south: posterBounds.getSouth(),
          east: posterBounds.getEast(),
          west: posterBounds.getWest()
        } : null
      };

      console.log('🚀 Calling backend /api/maps/preview endpoint...');
      console.log('Preview request:', previewRequest);

      // Call backend to generate preview
      const response = await window.AuthUtils.authenticatedFetch(
        `${this.baseUrl || 'http://localhost:3000'}/api/maps/preview`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(previewRequest)
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Preview generation failed:', errorText);
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Backend preview generation initiated:', result);

      if (!result.success || !result.preview) {
        throw new Error('Invalid preview response from server');
      }

      const previewId = result.preview.id;
      console.log('📋 Preview ID:', previewId);

      // Capture client-side preview data (for display while server generates high-res)
      const clientPreviewData = await this.captureMapStateInstantly();

      // Create comprehensive preview data combining server and client info
      const previewData = {
        previewId: previewId, // Use server-generated ID
        previewUrl: clientPreviewData.previewUrl, // Client-side base64 for instant display
        activityData: this.activityData,
        settings: this.currentSettings,
        dimensions: result.preview.dimensions || clientPreviewData.dimensions,
        mapConfiguration: clientPreviewData.mapConfiguration,
        config: {
          printSize: this.currentSettings.printSize || 'A4',
          orientation: this.currentSettings.layout || 'portrait',
          style: this.currentSettings.mapStyle
        }
      };

      // Store preview data for the preview page
      if (window.AuthUtils && window.AuthUtils.storePreviewData) {
        window.AuthUtils.storePreviewData(previewData);
        console.log('✅ Preview data stored via AuthUtils');
      } else {
        console.warn('⚠️ AuthUtils not available, storing in localStorage');
        localStorage.setItem('previewData', JSON.stringify(previewData));
      }

      // Hide loading overlay
      if (loadingOverlay) {
        loadingOverlay.remove();
      }

      // Redirect to preview page
      console.log('🚀 Redirecting to preview page...');
      window.location.href = '/pages/map-preview';

    } catch (error) {
      console.error('❌ Error in previewPoster:', error);

      // Hide loading overlay
      if (loadingOverlay) {
        loadingOverlay.remove();
      }

      alert(`Preview generation failed: ${error.message}\n\nPlease try again or contact support if the issue persists.`);
    }
  }

  /**
   * Show loading overlay during preview generation
   */
  showLoadingOverlay(message) {
    const overlay = document.createElement('div');
    overlay.id = 'preview-generation-loading';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;
    overlay.innerHTML = `
      <div style="background: white; padding: 40px; border-radius: 12px; text-align: center; max-width: 400px;">
        <div style="margin-bottom: 20px;">
          <div class="spinner" style="
            border: 4px solid #f3f3f3;
            border-top: 4px solid #3498db;
            border-radius: 50%;
            width: 50px;
            height: 50px;
            animation: spin 1s linear infinite;
            margin: 0 auto;
          "></div>
        </div>
        <h3 style="margin: 0 0 10px 0; font-size: 18px; color: #333;">${message}</h3>
        <p style="margin: 0; color: #666; font-size: 14px;">This may take a few seconds...</p>
      </div>
      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  /**
   * Wait for poster fit to complete before capturing camera/bounds
   * This ensures the map has finished all poster-fit adjustments
   * @param {Object} options - Wait options
   * @param {string} options.reason - Reason for waiting (for logging)
   * @param {number} options.timeout - Timeout in milliseconds (default: 6000)
   * @returns {Promise<void>} Resolves when poster fit is complete
   */
  async waitForPosterFit({ reason = 'camera-capture', timeout = 6000 } = {}) {
    console.log(`🎯 Waiting for poster fit to complete (${reason})...`);

    try {
      // Method 1: Use MapboxRoutes.waitForPosterFitComplete if available
      if (this.mapboxIntegration?.routes?.waitForPosterFitComplete) {
        console.log('MapDesign: Using MapboxRoutes.waitForPosterFitComplete()');
        await this.mapboxIntegration.routes.waitForPosterFitComplete(timeout);
      }
      // Method 2: Listen for poster-fit-complete event
      else if (this.mapboxIntegration?.eventSystem) {
        console.log('MapDesign: Listening for poster-fit-complete event');
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            if (this.mapboxIntegration.eventSystem) {
              this.mapboxIntegration.eventSystem.off('poster-fit-complete', handler);
            }
            console.warn(`⚠️ Poster fit wait timeout after ${timeout}ms`);
            resolve(); // Don't fail, just proceed
          }, timeout);

          const handler = () => {
            clearTimeout(timer);
            console.log('MapDesign: poster-fit-complete event received');
            resolve();
          };

          this.mapboxIntegration.eventSystem.on('poster-fit-complete', handler);

          // If no poster fit in progress, resolve immediately
          if (!this.mapboxIntegration.routes?.posterFitInProgress) {
            clearTimeout(timer);
            this.mapboxIntegration.eventSystem.off('poster-fit-complete', handler);
            console.log('MapDesign: No poster fit in progress, proceeding immediately');
            resolve();
          }
        });
      }

      // Always wait for map idle + double rAF for WebGL flush
      await this.waitForMapIdle();
      await this.doubleRaf();

      console.log(`✅ Poster fit complete (${reason})`);
    } catch (error) {
      console.warn(`⚠️ Poster fit wait error (${reason}):`, error);
      // Don't throw - proceed anyway to avoid blocking
    }
  }

  /**
   * Wait for map to become idle (no movement/animation in progress)
   * @returns {Promise<void>} Resolves when map is idle
   */
  async waitForMapIdle() {
    const map = this.mapboxIntegration?.map;
    if (!map) {
      console.log('MapDesign: No map instance for waitForMapIdle');
      return;
    }

    // If map is already idle and style loaded, return immediately
    if (map.isStyleLoaded() && !map.isMoving()) {
      console.log('MapDesign: Map already idle');
      return;
    }

    console.log('MapDesign: Waiting for map idle...');
    return new Promise(resolve => {
      const onIdle = () => {
        console.log('MapDesign: Map idle event fired');
        resolve();
      };

      map.once('idle', onIdle);

      // Safety timeout - don't wait forever
      setTimeout(() => {
        map.off('idle', onIdle);
        console.log('MapDesign: Map idle timeout, proceeding anyway');
        resolve();
      }, 3000);
    });
  }

  /**
   * Double requestAnimationFrame to ensure WebGL rendering is flushed
   * @returns {Promise<void>} Resolves after two animation frames
   */
  async doubleRaf() {
    return new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          console.log('MapDesign: Double rAF complete');
          resolve();
        });
      });
    });
  }

  /**
   * Capture current map state instantly without server call
   * Returns preview data compatible with the preview page
   */
  async captureMapStateInstantly() {
    // Validation checks
    if (!this.mapboxIntegration || !this.mapboxIntegration.map) {
      throw new Error('Map integration not available');
    }

    if (!this.activityData) {
      throw new Error('Activity data not available');
    }

    const map = this.mapboxIntegration.map;

    // 🎯 CRITICAL FIX: Wait for poster fit to complete before capturing camera
    // This ensures we capture the settled camera state after all poster-fit adjustments
    console.log('🎥 captureMapStateInstantly: Waiting for poster fit before camera capture...');
    await this.waitForPosterFit({ reason: 'captureMapStateInstantly', timeout: 6000 });
    console.log('🎥 captureMapStateInstantly: Poster fit complete, capturing camera now');

    // Capture current map configuration
    const currentBounds = map.getBounds();
    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();

    // 🎥 CAMERA CAPTURE: Capture canvas dimensions for padding scaling
    const canvas = map.getCanvas();
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    console.log('🎥 [Camera Capture] Starting live camera capture...');
    console.log('🎥 [Camera Capture] Canvas dimensions:', { width: canvasWidth, height: canvasHeight });

    // 🎥 CAMERA CAPTURE: Get actual padding from map instance (not fallback)
    let currentPadding;
    try {
      currentPadding = map.getPadding();
      console.log('🎥 [Camera Capture] Map padding (from getPadding()):', currentPadding);
    } catch (error) {
      console.warn('🎥 [Camera Capture] getPadding() failed, trying window.__MAPBOX_ROUTES__:', error);
      currentPadding = window.__MAPBOX_ROUTES__?.currentFitPadding;

      if (!currentPadding) {
        console.warn('🎥 [Camera Capture] No padding found, using default fallback');
        currentPadding = {
          top: 120,
          right: 120,
          bottom: 120,
          left: 120
        };
      }
      console.log('🎥 [Camera Capture] Map padding (from fallback):', currentPadding);
    }

    // 🎥 CAMERA CAPTURE: Capture exact map camera state for print matching
    const camera = {
      center: [currentCenter.lng, currentCenter.lat],
      zoom: currentZoom,
      bearing: map.getBearing(),
      pitch: map.getPitch(),
      padding: currentPadding,
      // Add viewport dimensions for backend padding scaling
      viewport: {
        width: canvasWidth,
        height: canvasHeight
      }
    };

    console.log('🎥 [Camera Capture] Map center:', camera.center);
    console.log('🎥 [Camera Capture] Map zoom:', camera.zoom);
    console.log('🎥 [Camera Capture] Map bearing:', camera.bearing);
    console.log('🎥 [Camera Capture] Map pitch:', camera.pitch);
    console.log('🎥 [Camera Capture] Map padding:', camera.padding);
    console.log('🎥 [Camera Capture] Viewport dimensions:', camera.viewport);
    console.log('🎥 [Camera Capture] Complete camera object:', camera);

    // Generate a unique preview ID (client-side)
    const previewId = `preview_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Capture the current visible map as an image (canvas already captured above)
    const canvasImageData = canvas.toDataURL('image/jpeg', 0.85);

    // Calculate dimensions based on current settings
    const printSize = this.currentSettings.printSize || 'A4';
    const orientation = this.currentSettings.layout || 'portrait';
    const dimensions = this.calculatePreviewDimensions(printSize, orientation);

    // Create comprehensive map configuration for server-side recreation
    const mapConfiguration = {
      style: this.currentSettings.mapStyle || 'outdoors-v12',
      bounds: {
        north: currentBounds.getNorth(),
        south: currentBounds.getSouth(),
        east: currentBounds.getEast(),
        west: currentBounds.getWest()
      },
      center: [currentCenter.lng, currentCenter.lat],
      zoom: currentZoom,
      camera: camera,  // Include exact camera for preview-to-print matching
      customization: {
        mainTitle: this.currentSettings.mainTitle,
        subtitle: this.currentSettings.subtitle,
        colorScheme: this.currentSettings.colorScheme,
        routeColor: this.currentSettings.routeColor,
        routeWidth: this.currentSettings.routeThickness,
        showMarkers: true,
        layout: orientation,
        printSize: printSize
      }
    };
    
    // Create preview data object compatible with preview page expectations
    const previewData = {
      previewId: previewId,
      previewUrl: canvasImageData, // Use base64 data URL instead of server URL
      activityData: this.activityData,
      settings: this.currentSettings,
      dimensions: dimensions,
      mapConfiguration: mapConfiguration, // Store for server-side recreation during purchase
      config: {
        printSize: printSize,
        orientation: orientation,
        style: this.currentSettings.mapStyle || 'outdoors-v12',
        generationType: 'instant_client_capture'
      },
      createdAt: new Date().toISOString(),
      isClientGenerated: true // Flag to indicate this is client-generated
    };
    
    console.log('✅ Map state captured instantly:', {
      previewId: previewId,
      bounds: mapConfiguration.bounds,
      zoom: currentZoom,
      printSize: printSize,
      orientation: orientation,
      canvasSize: `${canvas.width}x${canvas.height}`
    });
    
    return previewData;
  }
  
  /**
   * Calculate preview dimensions based on print size and orientation
   */
  calculatePreviewDimensions(printSize, orientation) {
    const sizes = {
      A4: { portrait: { width: 595, height: 842 }, landscape: { width: 842, height: 595 } },
      A3: { portrait: { width: 842, height: 1191 }, landscape: { width: 1191, height: 842 } },
      A2: { portrait: { width: 1191, height: 1684 }, landscape: { width: 1684, height: 1191 } },
      A1: { portrait: { width: 1684, height: 2384 }, landscape: { width: 2384, height: 1684 } }
    };
    
    const sizeKey = printSize.toUpperCase();
    const orientationKey = orientation.toLowerCase();
    
    return sizes[sizeKey]?.[orientationKey] || sizes.A4.portrait;
  }
  
  /**
   * Create enhanced preview modal
   */
  createPreviewModal() {
    // Check if modal already exists
    let modal = document.getElementById('poster-preview-modal');
    if (modal) {
      modal.style.display = 'flex';
      return;
    }
    
    // Create modal HTML
    modal = document.createElement('div');
    modal.id = 'poster-preview-modal';
    modal.className = 'preview-modal';
    modal.innerHTML = `
      <div class="preview-modal-overlay"></div>
      <div class="preview-modal-content">
        <div class="preview-modal-header">
          <h2>Poster Preview</h2>
          <button class="preview-modal-close">&times;</button>
        </div>
        <div class="preview-modal-body">
          <div class="preview-canvas-container">
            <canvas id="preview-canvas" class="preview-canvas"></canvas>
            <div class="preview-loading">
              <div class="loading-spinner"></div>
              <p>Generating high-resolution preview...</p>
            </div>
          </div>
          <div class="preview-details">
            <h3>Poster Details</h3>
            <div class="detail-item">
              <span class="detail-label">Title:</span>
              <span class="detail-value">${this.currentSettings.mainTitle}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Subtitle:</span>
              <span class="detail-value">${this.currentSettings.subtitle}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Size:</span>
              <span class="detail-value">${this.currentSettings.printSize.toUpperCase()}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Style:</span>
              <span class="detail-value">${this.currentSettings.colorScheme}</span>
            </div>
          </div>
        </div>
        <div class="preview-modal-footer">
          <button class="nav-btn nav-btn--secondary" id="preview-close-btn">
            Close Preview
          </button>
          <button class="nav-btn nav-btn--primary" id="preview-order-btn">
            Order This Poster
          </button>
        </div>
      </div>
    `;
    
    // Add modal styles
    const style = document.createElement('style');
    style.textContent = `
      .preview-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
      }
      
      .preview-modal-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(15, 23, 42, 0.95);
        backdrop-filter: blur(10px);
      }
      
      .preview-modal-content {
        position: relative;
        background: var(--poster-glass);
        border: 1px solid var(--poster-border);
        border-radius: 0.5rem;
        max-width: 90vw;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      
      .preview-modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1.5rem;
        border-bottom: 1px solid var(--poster-border);
      }
      
      .preview-modal-header h2 {
        color: var(--poster-accent-pink);
        margin: 0;
      }
      
      .preview-modal-close {
        background: none;
        border: none;
        color: var(--poster-text-secondary);
        font-size: 2rem;
        cursor: pointer;
        padding: 0;
        line-height: 1;
      }
      
      .preview-modal-body {
        display: flex;
        flex: 1;
        min-height: 0;
      }
      
      .preview-canvas-container {
        flex: 1;
        position: relative;
        padding: 2rem;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .preview-canvas {
        max-width: 100%;
        max-height: 100%;
        border-radius: 0.5rem;
        box-shadow: var(--poster-shadow-lg);
      }
      
      .preview-loading {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        text-align: center;
        color: var(--poster-text-primary);
      }
      
      .preview-details {
        width: 300px;
        padding: 2rem;
        border-left: 1px solid var(--poster-border);
        background: rgba(30, 41, 59, 0.3);
      }
      
      .preview-details h3 {
        color: var(--poster-accent-cyan);
        margin-bottom: 1.5rem;
      }
      
      .detail-item {
        display: flex;
        justify-content: space-between;
        margin-bottom: 1rem;
        padding-bottom: 1rem;
        border-bottom: 1px solid rgba(100, 116, 139, 0.3);
      }
      
      .detail-label {
        color: var(--poster-text-secondary);
        font-weight: 500;
      }
      
      .detail-value {
        color: var(--poster-text-primary);
        font-weight: 600;
      }
      
      .preview-modal-footer {
        display: flex;
        gap: 1rem;
        padding: 1.5rem;
        border-top: 1px solid var(--poster-border);
        background: rgba(30, 41, 59, 0.3);
      }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(modal);
    
    // Bind events
    modal.querySelector('.preview-modal-close').addEventListener('click', () => {
      modal.style.display = 'none';
    });
    
    modal.querySelector('#preview-close-btn').addEventListener('click', () => {
      modal.style.display = 'none';
    });
    
    modal.querySelector('#preview-order-btn').addEventListener('click', () => {
      this.proceedToCheckout();
    });
    
    modal.querySelector('.preview-modal-overlay').addEventListener('click', () => {
      modal.style.display = 'none';
    });
  }
  
  /**
   * Generate high-resolution preview using backend API
   */
  async generateHighResPreview() {
    const loading = document.querySelector('.preview-loading');
    
    if (!this.mapboxIntegration || !this.mapboxIntegration.map) {
      console.error('Cannot generate preview: missing map');
      return;
    }
    
    if (!this.activityData) {
      console.error('Cannot generate preview: missing activity data');
      if (loading) {
        loading.innerHTML = '<p style="color: #ef4444;">Missing activity data for preview</p>';
      }
      return;
    }
    
    // Check authentication first
    console.log('🔍 [generateHighResPreview] Starting authentication check...');
    console.log('🔍 [generateHighResPreview] window.AuthUtils exists:', !!window.AuthUtils);
    
    if (!window.AuthUtils) {
      console.error('❌ [generateHighResPreview] AuthUtils not available!');
      if (loading) {
        loading.innerHTML = '<p style="color: #ef4444;">Authentication system not available</p>';
      }
      return;
    }
    
    const token = window.AuthUtils.getToken();
    console.log('🔍 [generateHighResPreview] Token from AuthUtils.getToken():', token ? 'EXISTS (length=' + token.length + ')' : 'NULL');
    
    // Check URL params as fallback
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    console.log('🔍 [generateHighResPreview] Token from URL params:', urlToken ? 'EXISTS (length=' + urlToken.length + ')' : 'NULL');
    
    // Check localStorage directly
    const storedToken = localStorage.getItem('strava_session_token');
    const storedExpiry = localStorage.getItem('strava_token_expiry');
    console.log('🔍 [generateHighResPreview] Token from localStorage:', storedToken ? 'EXISTS (length=' + storedToken.length + ')' : 'NULL');
    console.log('🔍 [generateHighResPreview] Token expiry from localStorage:', storedExpiry);
    
    // Try fallback token sources if AuthUtils failed
    let finalToken = token;
    if (!finalToken && urlToken) {
      console.log('🔄 [generateHighResPreview] Using URL token as fallback');
      finalToken = urlToken;
      
      // Store URL token in AuthUtils for future use
      if (window.AuthUtils && window.AuthUtils.storeToken) {
        console.log('🔄 [generateHighResPreview] Storing URL token in AuthUtils');
        window.AuthUtils.storeToken(urlToken);
      }
    }
    
    if (!finalToken) {
      console.error('❌ [generateHighResPreview] No valid authentication token found');
      console.log('❌ [generateHighResPreview] Checked sources: AuthUtils, URL params, localStorage');
      if (loading) {
        loading.innerHTML = '<p style="color: #ef4444;">Authentication required. <a href="/pages/strava-login">Please login</a></p>';
      }
      // Redirect to authentication
      window.AuthUtils?.requireAuthentication(window.location.pathname);
      return;
    }
    
    console.log('✅ [generateHighResPreview] Authentication check passed, proceeding with preview...');
    
    try {
      if (loading) {
        loading.style.display = 'block';
        loading.innerHTML = `
          <div class="loading-spinner"></div>
          <p>Generating high-resolution preview...</p>
        `;
      }
      
      // Capture current map configuration from Mapbox GL JS instance
      const currentBounds = this.mapboxIntegration.map.getBounds();
      const currentCenter = this.mapboxIntegration.map.getCenter();
      const currentZoom = this.mapboxIntegration.map.getZoom();
      
      // Resolve the current style key to the actual Mapbox URL
      console.log('🎨 [generateHighResPreview] Full currentSettings object:', JSON.stringify(this.currentSettings, null, 2));
      console.log('🎨 [generateHighResPreview] Current style key:', this.currentSettings.mapStyle);
      console.log('🎨 [generateHighResPreview] Current style key type:', typeof this.currentSettings.mapStyle);
      
      const resolvedStyle = this.resolveStyleKeyToURL(this.currentSettings.mapStyle);
      console.log('🎨 [generateHighResPreview] Resolved style URL:', resolvedStyle);
      
      // Prepare preview request data using map configuration approach
      const previewData = {
        activityId: this.activityData.id,
        // Send map configuration instead of route data
        mapConfiguration: {
          style: resolvedStyle,
          bounds: {
            north: currentBounds.getNorth(),
            south: currentBounds.getSouth(),
            east: currentBounds.getEast(),
            west: currentBounds.getWest()
          },
          center: [currentCenter.lng, currentCenter.lat],
          zoom: currentZoom,
          customization: {
            mainTitle: this.currentSettings.mainTitle,
            subtitle: this.currentSettings.subtitle,
            colorScheme: this.currentSettings.colorScheme,
            routeColor: this.currentSettings.routeColor,
            routeWidth: this.currentSettings.routeThickness,
            showMarkers: true
          }
        },
        format: this.currentSettings.printSize?.toUpperCase() || 'A4',
        orientation: this.currentSettings.layout || 'portrait'
      };
      
      console.log('Generating preview with data:', previewData);
      console.log('🚀 ABOUT TO CALL BACKEND API:', `${this.options.baseUrl}/api/maps/generate-preview`);
      console.log('🚀 Request payload:', JSON.stringify(previewData, null, 2));
      
      // Use AuthUtils for authenticated request with manual fallback
      let response;
      try {
        console.log('🔍 [generateHighResPreview] Attempting AuthUtils.authenticatedFetch...');
        response = await window.AuthUtils.authenticatedFetch(`${this.options.baseUrl}/api/maps/generate-preview`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(previewData)
        });
        console.log('✅ [generateHighResPreview] AuthUtils.authenticatedFetch succeeded');
      } catch (authError) {
        console.log('⚠️ [generateHighResPreview] AuthUtils.authenticatedFetch failed, using manual token:', authError.message);
        
        // Manual fallback with finalToken
        const apiUrl = `${this.options.baseUrl}/api/maps/generate-preview?token=${encodeURIComponent(finalToken)}`;
        response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(previewData)
        });
        console.log('🔄 [generateHighResPreview] Manual fetch completed');
      }
      
      console.log('🚀 API RESPONSE RECEIVED:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Array.from(response.headers.entries())
      });
      
      if (!response.ok) {
        console.error('❌ API CALL FAILED:', response.status, response.statusText);
        const error = await response.json();
        console.error('❌ Error details:', error);
        throw new Error(error.message || 'Preview generation failed');
      }
      
      console.log('✅ API call successful, parsing response...');
      const result = await response.json();
      console.log('✅ Preview generated successfully:', result);
      
      // Store the preview ID for purchase flow
      this.currentPreviewId = result.preview.id;
      console.log('✅ Preview ID stored:', this.currentPreviewId);
      
      // Store preview data for the preview page
      const previewPageData = {
        previewId: result.preview.id,
        previewUrl: result.preview.url,
        activityData: this.activityData,
        settings: this.currentSettings,
        dimensions: result.preview.dimensions,
        config: result.preview.config,
        createdAt: result.preview.createdAt
      };
      
      console.log('✅ Preview data prepared:', previewPageData);
      
      if (window.AuthUtils && window.AuthUtils.storePreviewData) {
        window.AuthUtils.storePreviewData(previewPageData);
        console.log('✅ Preview data stored via AuthUtils');
      } else {
        console.warn('⚠️ AuthUtils not available, storing in localStorage');
        localStorage.setItem('previewData', JSON.stringify(previewPageData));
      }
      
      // Redirect to preview approval page instead of showing inline
      console.log('🚀 About to redirect to preview approval page...');
      console.log('🚀 Current URL:', window.location.href);
      console.log('🚀 Target URL: /pages/map-preview');
      
      // Try multiple redirect approaches for better compatibility
      console.log('🚀 Attempting immediate redirect...');
      
      try {
        // First try immediate redirect
        window.location.href = '/pages/map-preview';
        
        // If that doesn't work within 500ms, try alternative methods
        setTimeout(() => {
          console.log('🚀 Immediate redirect may have failed, trying window.location.assign...');
          window.location.assign('/pages/map-preview');
        }, 500);
        
        // Final fallback
        setTimeout(() => {
          console.log('🚀 All redirects may have failed, trying window.location.replace...');
          window.location.replace('/pages/map-preview');
        }, 1000);
        
      } catch (redirectError) {
        console.error('❌ All redirect methods failed:', redirectError);
        
        // Manual fallback - show link to user
        if (loading) {
          loading.innerHTML = `
            <div style="text-align: center; padding: 20px;">
              <p style="color: #10b981; margin-bottom: 15px;">✅ Preview generated successfully!</p>
              <p style="margin-bottom: 15px;">Please click the link below to view your preview:</p>
              <a href="/pages/map-preview" style="display: inline-block; background: #1f2937; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                View Preview →
              </a>
            </div>
          `;
        }
      }
      
    } catch (error) {
      console.error('Error generating preview:', error);
      
      // Check if it's an authentication error
      if (error.message.includes('Authentication') || error.message.includes('401')) {
        alert('Authentication expired. Please login again.');
        // Redirect to authentication
        window.AuthUtils?.requireAuthentication(window.location.pathname);
      } else {
        // Show error to user with more details
        alert(`Failed to generate preview: ${error.message}\n\nPlease try again or check your connection.`);
      }
    }
  }
  
  /**
   * Get print dimensions for canvas
   */
  getPrintDimensions(size) {
    const dimensions = {
      a4: { width: 800, height: 1131 },
      a3: { width: 1131, height: 1600 },
      a2: { width: 1600, height: 2263 },
      a1: { width: 2263, height: 3200 }
    };
    
    const dimension = dimensions[size] || dimensions.a2;
    
    // Adjust for landscape
    if (this.currentSettings.layout === 'landscape') {
      return { width: dimension.height, height: dimension.width };
    }
    
    return dimension;
  }
  
  /**
   * Add text overlays to canvas
   */
  addTextOverlaysToCanvas(ctx, width, height) {
    // Title
    if (this.currentSettings.mainTitle) {
      ctx.font = `bold ${Math.floor(width * 0.04)}px Arial`;
      ctx.fillStyle = '#ec4899';
      ctx.textAlign = 'center';
      ctx.fillText(this.currentSettings.mainTitle, width / 2, height * 0.1);
    }
    
    // Subtitle
    if (this.currentSettings.subtitle) {
      ctx.font = `${Math.floor(width * 0.02)}px Arial`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(this.currentSettings.subtitle, width / 2, height * 0.15);
    }
    
    // Stats
    if (this.activityData) {
      const distance = (this.activityData.distance / 1000).toFixed(1);
      const elevation = Math.round(this.activityData.total_elevation_gain || 0);
      const statsText = `${distance}km — ${elevation}m`;
      
      ctx.font = `${Math.floor(width * 0.02)}px monospace`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(statsText, width / 2, height * 0.9);
    }
  }
  
  /**
   * Proceed to checkout - complete purchase flow implementation
   */
  async proceedToCheckout() {
    console.log('Proceeding to checkout with settings:', this.currentSettings);
    
    if (!this.currentPreviewId) {
      alert('Please generate a preview first before proceeding to checkout.');
      return;
    }
    
    try {
      // Show loading state
      const orderBtn = document.getElementById('preview-order-btn');
      const originalText = orderBtn.textContent;
      orderBtn.disabled = true;
      orderBtn.textContent = 'Preparing Order...';
      
      // Store design settings for reference
      localStorage.setItem('posterCheckoutData', JSON.stringify({
        previewId: this.currentPreviewId,
        settings: this.currentSettings,
        activityData: this.activityData,
        timestamp: Date.now()
      }));
      
      // Call the purchase API endpoint
      const response = await fetch(`${this.options.baseUrl}/api/maps/purchase/${this.currentPreviewId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          printSize: this.currentSettings.printSize?.toUpperCase() || 'A4',
          printOrientation: this.currentSettings.layout || 'portrait',
          quantity: 1
        }),
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Purchase preparation failed');
      }
      
      const result = await response.json();
      console.log('Purchase prepared successfully:', result);
      
      // Store purchase data for tracking
      localStorage.setItem('currentPurchaseId', result.purchase.id);
      
      // Redirect to Shopify cart with the generated cart URL
      console.log('Redirecting to Shopify cart:', result.purchase.cartUrl);
      window.location.href = result.purchase.cartUrl;
      
    } catch (error) {
      console.error('Failed to proceed to checkout:', error);
      
      // Reset button state
      const orderBtn = document.getElementById('preview-order-btn');
      if (orderBtn) {
        orderBtn.disabled = false;
        orderBtn.textContent = 'Order This Poster';
      }
      
      // Show error to user
      alert(`Checkout failed: ${error.message}`);
    }
  }





  /**
   * Initialize the Mapbox integration
   */
  async initializeMap() {
    if (!window.MapboxIntegration || !window.MapboxConfig) {
      throw new Error('Mapbox integration not loaded. Please ensure mapbox-integration.js is included.');
    }

    // Show loading state
    this.elements.mapLoading.style.display = 'flex';

    try {
      // Initialize MapboxConfig first (async)
      console.log('Initializing MapboxConfig...');
      await window.MapboxConfig.init();
      console.log('MapboxConfig initialized successfully');
      
      // Check if we have a valid Mapbox token before proceeding
      const config = window.MapboxConfig._config;
      if (!config || !config.accessToken || config.accessToken === 'pk.missing') {
        throw new Error('MapboxConfig initialization failed: No valid Mapbox access token available. Please check the backend configuration and ensure a valid Mapbox token is set in the .env file.');
      }

      // Create MapboxIntegration instance (but don't initialize yet)
      this.mapboxIntegration = new MapboxIntegration('mapbox-map', {
        style: this.options.defaultMapStyle,
        enableExportControls: false, // We'll use our custom export UI
        enableStyleControls: false, // We'll integrate with our custom controls
        preserveDrawingBuffer: true, // Important for export functionality
        showControls: true, // Keep standard controls
        responsive: { enabled: false }, // Properly disable responsive system for poster dimensions
        showRouteStats: false, // Disable route statistics overlay
        enableAnimation: false // Disable animation controls with play button
      });

      // Initialize the map (now async)
      console.log('Initializing MapboxIntegration...');
      await this.mapboxIntegration.init();
      console.log('MapboxIntegration initialized successfully');

      // Render the activity route (now has fallback to streams API)
      console.log('🗺️ About to call renderActivityRoute()...');
      await this.renderActivityRoute();
      console.log('🗺️ renderActivityRoute() completed successfully');

      // Hide loading state
      this.elements.mapLoading.style.display = 'none';

      // Apply initial layout (portrait/landscape) based on current settings
      this.updateMapLayout();

      // Initialize custom controls
      this.initializeStyleControls();

      // Set up route operation event listeners
      this.setupRouteEventListeners();

      // Try to restore any previous route state (for page refresh scenarios)
      await this.tryRestoreRouteFromStorage();

      this.isInitialized = true;
      console.log('Map design initialization complete');

    } catch (error) {
      console.error('Failed to initialize map:', error);
      this.elements.mapLoading.style.display = 'none';
      throw error;
    }
  }

  /**
   * Set up event listeners for route operations
   */
  setupRouteEventListeners() {
    if (!this.mapboxIntegration || !this.mapboxIntegration.eventSystem) {
      console.warn('MapDesign: EventSystem not available for route event listeners');
      return;
    }

    const eventSystem = this.mapboxIntegration.eventSystem;

    // Listen for route restoration events
    eventSystem.on('route-restoration-completed', (data) => {
      console.log('MapDesign: Route restoration completed event received', data);
      this.hideRouteLoading();
      this.showRouteSuccess('Route restored successfully after style change');
    });

    eventSystem.on('route-restoration-failed', (data) => {
      console.error('MapDesign: Route restoration failed event received', data);
      this.hideRouteLoading();
      this.showRouteError('Failed to restore route after style change');
    });

    // Listen for style change events
    eventSystem.on('style-changed', (data) => {
      console.log('MapDesign: Style changed event received', data);
      // Could add more feedback here if needed
    });

    // Listen for route rendering events
    eventSystem.on('route-rendered', (data) => {
      console.log('MapDesign: Route rendered event received', data);
      this.hideRouteLoading();
      this.showRouteSuccess(`Route loaded with ${data.coordinates} points`);
    });

    console.log('MapDesign: Route event listeners set up successfully');
  }

  /**
   * Try to restore route from storage (for page refresh scenarios)
   */
  async tryRestoreRouteFromStorage() {
    console.log('MapDesign: Attempting to restore route from storage after initialization...');
    
    if (!this.mapboxIntegration || !this.mapboxIntegration.tryRestoreRouteFromStorage) {
      console.log('MapDesign: MapboxIntegration not ready for route restoration');
      return;
    }
    
    try {
      const storedState = this.mapboxIntegration.tryRestoreRouteFromStorage();
      
      if (storedState && storedState.coordinates && storedState.coordinates.length > 0) {
        console.log(`MapDesign: Found stored route with ${storedState.coordinates.length} coordinates, attempting restoration...`);
        
        // If we have a stored route but no current route, try to restore it
        const currentState = this.mapboxIntegration.getCurrentRouteState();
        if (!currentState || !currentState.hasRoute) {
          console.log('MapDesign: No current route found, restoring from storage...');
          
          // Use the routes module to restore the route
          if (this.mapboxIntegration.routes && this.mapboxIntegration.routes.restoreRoute) {
            await this.mapboxIntegration.routes.restoreRoute(storedState);
            console.log('MapDesign: Route successfully restored from storage');
          }
        } else {
          console.log('MapDesign: Current route exists, skipping storage restoration');
        }
      } else {
        console.log('MapDesign: No valid stored route found for restoration');
      }
    } catch (error) {
      console.warn('MapDesign: Failed to restore route from storage:', error);
    }
  }

  /**
   * Wait for MapboxIntegration to be ready
   */
  async waitForMapReady() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Map initialization timeout'));
      }, 10000);

      const checkReady = () => {
        if (this.mapboxIntegration && this.mapboxIntegration.map && this.mapboxIntegration.isInitialized) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(checkReady, 100);
        }
      };

      checkReady();
    });
  }

  /**
   * Render the activity route on the map
   */
  async renderActivityRoute() {
    console.log('🚀 renderActivityRoute() called with activity data:', this.activityData);
    let coordinates = null;
    
    try {
      // First try to get coordinates from polyline data
      if (this.activityData.map && this.activityData.map.summary_polyline) {
        console.log('📍 Activity has polyline data, decoding...');
        coordinates = this.decodePolyline(this.activityData.map.summary_polyline);
        
        if (coordinates && coordinates.length > 0) {
          console.log(`✅ Decoded ${coordinates.length} route points from polyline in [lng, lat] format`);
          // decodePolyline already returns coordinates in [lng, lat] format for Mapbox
        } else {
          console.log('❌ Polyline decoding failed or returned empty');
        }
      } else {
        console.log('📍 Activity has NO polyline data - map:', this.activityData.map);
      }
      
      // If no polyline data or decoding failed, fetch from streams API
      if (!coordinates || coordinates.length === 0) {
        console.log('🌊 No polyline data available, fetching coordinates from streams API...');
        coordinates = await this.fetchCoordinatesFromStreams();
        
        if (!coordinates || coordinates.length === 0) {
          console.error('❌ No coordinates from streams API either');
          throw new Error('No route coordinates available from any source');
        }
        
        console.log(`✅ Fetched ${coordinates.length} route points from streams API`);
      }

      // Debug coordinate format before processing
      console.error('🔥🔥🔥 COORDINATE DEBUG - COORDINATES LENGTH:', coordinates.length);
      console.error('🔥🔥🔥 COORDINATE DEBUG - FIRST 3:', coordinates.slice(0, 3));
      console.error('🔥🔥🔥 COORDINATE DEBUG - LAST 3:', coordinates.slice(-3));
      console.error('🔥🔥🔥 COORDINATE DEBUG - STRUCTURE:', typeof coordinates[0], coordinates[0]);

      // Calculate bounds for the route
      const bounds = this.calculateBounds(coordinates);

      // Format data for MapboxIntegration.renderRouteMap
      const routeData = {
        coordinates: coordinates, // Array of [lat, lng] pairs
        bounds: bounds,
        title: this.activityData.name || 'Route',
        stats: {
          distance: this.activityData.distance || 0,
          duration: this.activityData.moving_time || 0,
          elevationGain: this.activityData.total_elevation_gain || 0
        },
        customization: {
          color: this.currentSettings.routeColor || '#ff4444',
          width: this.currentSettings.routeThickness || 4
        }
      };

      // Use MapboxIntegration's renderRouteMap method with poster format
      await this.mapboxIntegration.renderRouteMap(routeData, {
        format: this.currentSettings.printSize.toUpperCase(),
        orientation: this.currentSettings.layout
      });
      console.log('Activity route rendered successfully');
    } catch (error) {
      console.error('Failed to render activity route:', error);
      throw new Error('Failed to render route on map');
    }
  }

  /**
   * Fetch route coordinates from Strava streams API
   * @returns {Array} Array of [lat, lng] coordinate pairs
   */
  async fetchCoordinatesFromStreams() {
    console.log('🌊 fetchCoordinatesFromStreams() called for activity:', this.activityData.id);
    
    try {
      const url = `${this.options.baseUrl}/api/strava/activities/${this.activityData.id}/streams?types=latlng${this.sessionToken ? `&token=${this.sessionToken}` : ''}`;
      console.log('🌊 Calling streams API:', url);
      
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        }
      });

      console.log('🌊 Streams API response status:', response.status);

      if (!response.ok) {
        throw new Error(`Failed to fetch streams data: ${response.status}`);
      }

      const data = await response.json();
      console.log('🌊 Streams API response data:', data);
      
      if (!data.success || !data.streams || !data.streams.latlng || !data.streams.latlng.data) {
        console.error('🌊 Invalid streams data structure:', {
          success: data.success,
          hasStreams: !!data.streams,
          hasLatlng: !!(data.streams && data.streams.latlng),
          hasData: !!(data.streams && data.streams.latlng && data.streams.latlng.data)
        });
        throw new Error('No coordinate streams data available');
      }

      // The streams API returns coordinates in [lat, lng] format from Strava
      console.log(`🌊 Successfully got ${data.streams.latlng.data.length} coordinates from streams API`);
      console.log('🌊 First 3 raw coordinates from Strava API (expected [lat, lng]):', data.streams.latlng.data.slice(0, 3));
      
      // Backend now keeps coordinates in original Strava [lat, lng] format
      // Convert to [lng, lat] for Mapbox GL JS compatibility
      const convertedCoordinates = data.streams.latlng.data.map(coord => [coord[1], coord[0]]);
      
      console.log('✅ Converted coordinates to Mapbox format [lng, lat]:');
      console.log('🌊 First 3 converted coordinates:', convertedCoordinates.slice(0, 3));
      
      return convertedCoordinates;

    } catch (error) {
      console.error('🌊 Failed to fetch coordinates from streams:', error);
      return [];
    }
  }

  /**
   * Initialize style controls integration with enhanced customization features
   */
  initializeStyleControls() {
    try {
      if (!this.options.showStyleControls || !this.mapboxIntegration) {
        console.log('MapDesign: Style controls disabled or MapboxIntegration not available');
        return;
      }

      console.log('MapDesign: Initializing style controls...');

      // Initialize the customization interface if method exists
      if (typeof this.mapboxIntegration.initMapCustomization === 'function') {
        this.mapboxIntegration.initMapCustomization({
          enableStyleSelector: true,
          enableColorPicker: true,
          enableAnnotations: true,
          enableTextLabels: true
        });
      } else {
        console.warn('MapDesign: initMapCustomization method not available');
      }

      // Load saved customization state if method exists
      if (typeof this.mapboxIntegration.loadCustomizationState === 'function') {
        this.mapboxIntegration.loadCustomizationState();
      } else {
        console.warn('MapDesign: loadCustomizationState method not available');
      }

      // Enhanced style selector with thumbnails
      if (this.elements.advancedStyleControls && typeof this.mapboxIntegration.renderStyleSelector === 'function') {
        this.mapboxIntegration.renderStyleSelector('advanced-style-controls');
      }

      // Enhanced color picker 
      const colorPickerContainer = document.createElement('div');
      colorPickerContainer.id = 'enhanced-color-picker';
      colorPickerContainer.className = 'enhanced-color-picker-container';
      
      // Insert after existing color options
      const colorOptionsContainer = document.querySelector('.color-options');
      if (colorOptionsContainer && colorOptionsContainer.parentNode && typeof this.mapboxIntegration.renderColorPicker === 'function') {
        colorOptionsContainer.parentNode.insertBefore(colorPickerContainer, colorOptionsContainer.nextSibling);
        this.mapboxIntegration.renderColorPicker('enhanced-color-picker');
        
        // Hide basic color options since we have enhanced picker
        colorOptionsContainer.style.display = 'none';
      }

      // Annotation tools
      const annotationContainer = document.createElement('div');
      annotationContainer.id = 'annotation-tools-container';
      annotationContainer.className = 'annotation-tools-container';
      
      // Add annotation tools to advanced controls
      if (this.elements.advancedStyleControls && typeof this.mapboxIntegration.renderAnnotationTools === 'function') {
        this.elements.advancedStyleControls.appendChild(annotationContainer);
        this.mapboxIntegration.renderAnnotationTools('annotation-tools-container');
      }

      // Legacy support for existing controls - this is the critical map style dropdown
      if (this.elements.mapStyleSelector) {
        this.elements.mapStyleSelector.addEventListener('change', (e) => {
          console.log('MapDesign: Map style dropdown changed to:', e.target.value);
          
          if (this.mapboxIntegration && typeof this.mapboxIntegration.setStyle === 'function') {
            const success = this.mapboxIntegration.setStyle(e.target.value);
            if (!success) {
              console.error('MapDesign: Failed to change map style');
            }
          } else {
            console.error('MapDesign: setStyle method not available');
          }
        });
        
        console.log('MapDesign: Map style selector event listener attached');
      } else {
        console.warn('MapDesign: Map style selector element not found');
      }

    // Keep existing color options for fallback
    this.elements.colorOptions.forEach(option => {
      option.addEventListener('click', () => {
        // Remove active class from all options
        this.elements.colorOptions.forEach(opt => opt.classList.remove('active'));
        // Add active class to clicked option
        option.classList.add('active');
        
        // Update route color using enhanced method
        const color = option.dataset.color;
        if (this.mapboxIntegration.updateRouteColor) {
          this.mapboxIntegration.updateRouteColor(color);
        } else if (this.mapboxIntegration.updateRouteStyle) {
          this.mapboxIntegration.updateRouteStyle({ routeColor: color });
        }
      });
    });

    // Route width slider with enhanced integration
    if (this.elements.routeWidthSlider) {
      this.elements.routeWidthSlider.addEventListener('input', (e) => {
        const width = parseInt(e.target.value);
        if (this.elements.routeWidthValue) {
          this.elements.routeWidthValue.textContent = `${width}px`;
        }
        
        // Update using enhanced method if available
        if (this.mapboxIntegration.customizationState) {
          this.mapboxIntegration.customizationState.routeWidth = width;
          this.mapboxIntegration.updateRouteStyle({ routeWidth: width });
          this.mapboxIntegration.saveCustomizationState();
        } else if (this.mapboxIntegration.updateRouteStyle) {
          this.mapboxIntegration.updateRouteStyle({ routeWidth: width });
        }
      });
    }

    // Set up keyboard shortcuts for customization
    this.setupCustomizationKeyboardShortcuts();

      console.log('MapDesign: Style controls initialized successfully');
      
    } catch (error) {
      console.error('MapDesign: Failed to initialize style controls:', error);
      
      // Fallback: at least set up the basic map style selector
      if (this.elements.mapStyleSelector) {
        this.elements.mapStyleSelector.addEventListener('change', (e) => {
          console.log('MapDesign: Fallback map style change to:', e.target.value);
          
          if (this.mapboxIntegration && typeof this.mapboxIntegration.setStyle === 'function') {
            this.mapboxIntegration.setStyle(e.target.value);
          }
        });
        console.log('MapDesign: Fallback style selector initialized');
      }
    }
  }

  /**
   * Setup keyboard shortcuts for common customization actions and step navigation
   */
  setupCustomizationKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Only handle shortcuts when not in input fields
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      // Step navigation shortcuts
      if (e.key === 'ArrowLeft' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.prevStep();
      }
      
      if (e.key === 'ArrowRight' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.nextStep();
      }
      
      // Number keys for direct step navigation (1-4 for 4 tabs)
      if (e.key >= '1' && e.key <= '4') {
        e.preventDefault();
        const steps = ['style', 'colors', 'text', 'size'];
        const stepIndex = parseInt(e.key) - 1;
        if (steps[stepIndex]) {
          this.navigateToStep(steps[stepIndex]);
        }
      }
      
      // P key for preview
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        this.previewPoster();
      }
      
      // S key for save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        this.saveCurrentDesign();
      }
      
      // Color scheme shortcuts (C + number)
      if (e.key === 'c' || e.key === 'C') {
        this.colorSchemeShortcutActive = true;
        this.showToast('Press 1-6 to select color scheme', 'info');
        
        setTimeout(() => {
          this.colorSchemeShortcutActive = false;
        }, 3000);
      }
      
      if (this.colorSchemeShortcutActive && e.key >= '1' && e.key <= '6') {
        const schemes = ['synthwave', 'neon', 'sunset', 'retro', 'midnight', 'vapor'];
        const schemeIndex = parseInt(e.key) - 1;
        if (schemes[schemeIndex]) {
          this.currentSettings.colorScheme = schemes[schemeIndex];
          this.applySettingsToUI();
          this.updateMapStyle();
          this.showToast(`Applied ${schemes[schemeIndex]} color scheme`, 'success');
        }
        this.colorSchemeShortcutActive = false;
      }
      
      // Ctrl/Cmd + Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (this.mapboxIntegration && this.mapboxIntegration.undo) {
          this.mapboxIntegration.undo();
        }
      }
      
      // Ctrl/Cmd + Shift + Z for redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        if (this.mapboxIntegration && this.mapboxIntegration.redo) {
          this.mapboxIntegration.redo();
        }
      }
      
      // Escape key to cancel current action or close modals
      if (e.key === 'Escape') {
        e.preventDefault();
        this.cancelCurrentAction();
        
        // Close preview modal if open
        const modal = document.getElementById('poster-preview-modal');
        if (modal && modal.style.display !== 'none') {
          modal.style.display = 'none';
        }
      }
      
      // H key for help/shortcuts
      if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        this.showKeyboardShortcuts();
      }
    });
  }
  
  /**
   * Show keyboard shortcuts help modal
   */
  showKeyboardShortcuts() {
    const shortcuts = [
      { keys: 'Ctrl/Cmd + ←/→', description: 'Navigate between steps' },
      { keys: '1, 2, 3', description: 'Jump to step (Style, Text, Layout)' },
      { keys: 'P', description: 'Preview poster' },
      { keys: 'Ctrl/Cmd + S', description: 'Save design' },
      { keys: 'C + 1-6', description: 'Quick color scheme selection' },
      { keys: 'Ctrl/Cmd + Z', description: 'Undo last action' },
      { keys: 'Escape', description: 'Cancel action / Close modals' },
      { keys: 'H', description: 'Show this help' }
    ];
    
    const shortcutsText = shortcuts
      .map(s => `${s.keys}: ${s.description}`)
      .join('\n');
    
    this.showToast(`Keyboard Shortcuts:\n${shortcutsText}`, 'info');
  }

  /**
   * Cancel current customization action
   */
  cancelCurrentAction() {
    // Reset cursor
    if (this.mapboxIntegration && this.mapboxIntegration.map) {
      this.mapboxIntegration.map.getCanvas().style.cursor = '';
    }
    
    // Close any open modals
    const modal = document.getElementById('annotation-modal');
    if (modal && modal.style.display !== 'none') {
      if (this.mapboxIntegration.closeAnnotationModal) {
        this.mapboxIntegration.closeAnnotationModal();
      }
    }
  }






  /**
   * Show error state
   */
  showError(title, message) {
    if (this.elements.mapError) {
      this.elements.mapError.style.display = 'block';
    }
    if (this.elements.errorTitle) {
      this.elements.errorTitle.textContent = title;
    }
    if (this.elements.errorMessage) {
      this.elements.errorMessage.textContent = message;
    }
    
    // Hide loading state
    if (this.elements.mapLoading) {
      this.elements.mapLoading.style.display = 'none';
    }
  }

  /**
   * Bind event handlers
   */
  bindEvents() {
    // NEW: Tab navigation events
    if (this.elements.stepTabs) {
      this.elements.stepTabs.forEach((tab) => {
        tab.addEventListener('click', () => {
          const stepName = tab.dataset.step;
          if (stepName) {
            this.navigateToStep(stepName);
          }
        });
      });
    }

    // NEW: Route badge toggle
    if (this.elements.routeBadgeToggle) {
      this.elements.routeBadgeToggle.addEventListener('click', () => {
        this.toggleRouteDetails();
      });
    }

    // Step navigation buttons
    if (this.elements.prevStepBtn) {
      this.elements.prevStepBtn.addEventListener('click', () => this.prevStep());
    }

    if (this.elements.nextStepBtn) {
      this.elements.nextStepBtn.addEventListener('click', () => this.nextStep());
    }
    
    // Style controls events
    this.bindStyleEvents();
    
    // Text controls events
    this.bindTextEvents();
    
    // Layout controls events
    this.bindLayoutEvents();
    
    // Action button events
    this.bindActionEvents();

    // Retry button
    if (this.elements.retryButton) {
      this.elements.retryButton.addEventListener('click', () => {
        window.location.reload();
      });
    }

    // Handle page visibility changes to maintain map state
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.mapboxIntegration && this.mapboxIntegration.map) {
        // Trigger map resize when page becomes visible again
        setTimeout(() => {
          this.mapboxIntegration.map.resize();
        }, 100);
      }
    });

    // Handle window resize
    window.addEventListener('resize', this.debounce(() => {
      if (this.mapboxIntegration && this.mapboxIntegration.map) {
        this.mapboxIntegration.map.resize();
      }
    }, 250));

    // Add scroll listener for summary bar shadow effect
    const sidebar = document.querySelector('.poster-sidebar');
    if (sidebar && this.elements.summaryBar) {
      sidebar.addEventListener('scroll', () => {
        if (sidebar.scrollTop > 10) {
          this.elements.summaryBar.classList.add('scrolled');
        } else {
          this.elements.summaryBar.classList.remove('scrolled');
        }
      });
    }

    // Gallery modal events
    if (this.elements.browseStylesBtn) {
      this.elements.browseStylesBtn.addEventListener('click', () => {
        this.openStylesGallery();
      });
    }

    if (this.elements.galleryCloseBtn) {
      this.elements.galleryCloseBtn.addEventListener('click', () => {
        this.closeStylesGallery();
      });
    }

    if (this.elements.galleryOverlay) {
      this.elements.galleryOverlay.addEventListener('click', () => {
        this.closeStylesGallery();
      });
    }

    // Keyboard support for gallery (Escape key)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.elements.galleryModal && this.elements.galleryModal.classList.contains('active')) {
        this.closeStylesGallery();
      }
    });
  }

  /**
   * Update the sticky summary bar with current selections
   */
  updateSummaryBar() {
    if (!this.elements.summaryStyleText || !this.elements.summarySizeText || !this.elements.summaryPriceText) {
      return;
    }

    // Update style text (theme + color)
    let styleText = 'Select theme';
    if (this.currentSettings.mapType && window.mapboxCustomization) {
      const themeStyles = window.mapboxCustomization.getThemeStyles();
      const themeName = themeStyles[this.currentSettings.mapType]?.name || this.currentSettings.mapType;

      if (this.currentSettings.mapColor) {
        const colorInfo = themeStyles[this.currentSettings.mapType]?.colors[this.currentSettings.mapColor];
        const colorName = colorInfo?.name || this.currentSettings.mapColor;
        styleText = `${themeName} ${colorName}`;
      } else {
        styleText = themeName;
      }
    }
    this.elements.summaryStyleText.textContent = styleText;

    // Update size text
    const size = this.currentSettings.printSize || 'a3';
    const orientation = this.currentSettings.layout || 'portrait';
    const sizeText = `${size.toUpperCase()} ${orientation.charAt(0).toUpperCase() + orientation.slice(1)}`;
    this.elements.summarySizeText.textContent = sizeText;

    // Update price based on size
    const prices = {
      'a4': '£45',
      'a3': '£55',
      'a2': '£65',
      'a1': '£75'
    };
    const price = prices[size.toLowerCase()] || '£55';
    this.elements.summaryPriceText.textContent = price;

    console.log('Summary bar updated:', { style: styleText, size: sizeText, price });
  }

  /**
   * Open the styles gallery modal
   */
  openStylesGallery() {
    if (!this.elements.galleryModal) return;

    // Populate gallery with all styles
    this.populateStylesGallery();

    // Show modal
    this.elements.galleryModal.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
  }

  /**
   * Close the styles gallery modal
   */
  closeStylesGallery() {
    if (!this.elements.galleryModal) return;

    this.elements.galleryModal.classList.remove('active');
    document.body.style.overflow = ''; // Restore scrolling
  }

  /**
   * Populate the gallery with all theme and color combinations
   */
  populateStylesGallery() {
    if (!this.elements.galleryGrid || !window.mapboxCustomization) return;

    const themeStyles = window.mapboxCustomization.getThemeStyles();
    const galleryItems = [];

    // Current selection for highlighting
    const currentTheme = this.currentSettings.mapType;
    const currentColor = this.currentSettings.mapColor;

    // Generate gallery items for each theme+color combination
    Object.entries(themeStyles).forEach(([themeKey, themeInfo]) => {
      Object.entries(themeInfo.colors).forEach(([colorKey, colorInfo]) => {
        const isSelected = themeKey === currentTheme && colorKey === currentColor;

        galleryItems.push(`
          <div class="gallery-item ${isSelected ? 'selected' : ''}"
               data-theme="${themeKey}"
               data-color="${colorKey}">
            <div class="gallery-item-preview">
              <div class="style-preview-circle" style="background-color: ${colorInfo.previewColor}"></div>
            </div>
            <div class="gallery-item-info">
              <div class="gallery-item-theme">${themeInfo.name}</div>
              <div class="gallery-item-name">${colorInfo.name}</div>
            </div>
          </div>
        `);
      });
    });

    this.elements.galleryGrid.innerHTML = galleryItems.join('');

    // Add click handlers to gallery items
    this.elements.galleryGrid.querySelectorAll('.gallery-item').forEach(item => {
      item.addEventListener('click', async () => {
        const themeKey = item.dataset.theme;
        const colorKey = item.dataset.color;

        // Apply the selected style
        await this.setTheme(themeKey);
        await this.setThemeColor(themeKey, colorKey);

        // Close the gallery
        this.closeStylesGallery();
      });
    });
  }

  /**
   * Bind style control events
   */
  bindStyleEvents() {
    // Initialize the theme selector if MapboxCustomization is available
    this.initializeThemeSelector();
    
    // Direct binding for current HTML structure - Map Style buttons
    const mapStyleButtons = document.querySelectorAll('[data-style]');
    console.log('Found', mapStyleButtons.length, 'map style buttons');
    
    mapStyleButtons.forEach((button) => {
      button.addEventListener('click', async () => {
        const styleKey = button.dataset.style;
        console.log('Map style button clicked:', styleKey);
        
        // Update active state
        mapStyleButtons.forEach(btn => {
          btn.style.border = '2px solid transparent';
          btn.classList.remove('active');
        });
        button.style.border = '2px solid var(--brand-primary)';
        button.classList.add('active');
        
        // Update settings and apply to map
        this.currentSettings.mapStyle = styleKey;
        await this.updateMapStyleFromSelector(styleKey);
        
        console.log('Map style changed to:', styleKey);
      });
    });
    
    // New two-tier map selector events
    this.bindMapTypeEvents();
    this.bindMapStyleEvents();
    
    // Legacy color scheme selection (keep for backward compatibility)
    this.elements.colorSchemes.forEach((scheme) => {
      scheme.addEventListener('click', () => {
        // Update active state
        this.elements.colorSchemes.forEach(s => s.classList.remove('active'));
        scheme.classList.add('active');
        
        // Update settings
        this.currentSettings.colorScheme = scheme.dataset.scheme;
        
        // Apply to map
        this.updateMapStyle();
        
        console.log('Color scheme changed to:', this.currentSettings.colorScheme);
      });
    });
    
    // Route thickness slider
    if (this.elements.routeThicknessSlider) {
      this.elements.routeThicknessSlider.addEventListener('input', (e) => {
        const thickness = parseInt(e.target.value);
        this.currentSettings.routeThickness = thickness;

        // Update map route thickness
        this.updateRouteThickness(thickness);

        console.log('Route thickness changed to:', thickness);
      });
    }

    // Route color palette boxes
    const colorBoxes = document.querySelectorAll('.route-color-box');
    if (colorBoxes.length > 0) {
      colorBoxes.forEach((box) => {
        box.addEventListener('click', (e) => {
          const color = box.dataset.color;

          // Remove selected class from all boxes
          colorBoxes.forEach(b => b.classList.remove('selected'));

          // Add selected class to clicked box
          box.classList.add('selected');

          // Update current settings
          this.currentSettings.routeColor = color;

          // Update map route color
          this.updateRouteColor(color);

          console.log('Route color changed to:', color);
        });
      });
    }

    // Preset options
    this.elements.presetOptions.forEach((preset) => {
      preset.addEventListener('click', () => {
        const presetType = preset.dataset.preset;
        this.applyStylePreset(presetType);
        
        console.log('Style preset applied:', presetType);
      });
    });
  }

  /**
   * Bind map type selection events
   */
  bindMapTypeEvents() {
    // Re-query elements in case DOM was updated
    this.elements.mapTypeSelector = document.getElementById('map-type-selector');
    this.elements.mapTypeOptions = document.querySelectorAll('.map-type-option');
    
    console.log('🔗 Binding map type events to', this.elements.mapTypeOptions.length, 'buttons');
    
    if (this.elements.mapTypeOptions) {
      this.elements.mapTypeOptions.forEach((typeOption) => {
        typeOption.addEventListener('click', async () => {
          const typeKey = typeOption.dataset.type;
          console.log('🔘 Type button clicked:', typeKey);
          await this.setMapType(typeKey);
        });
      });
    }
  }

  /**
   * Bind map style selection events
   */
  bindMapStyleEvents() {
    // Re-query style options as they may be dynamically updated
    this.elements.mapStyleSelector = document.getElementById('map-style-selector');
    const styleOptions = document.querySelectorAll('.style-option');
    
    console.log('🔗 Binding map style events to', styleOptions.length, 'buttons');
    
    if (styleOptions) {
      styleOptions.forEach((styleOption) => {
        styleOption.addEventListener('click', async () => {
          const styleKey = styleOption.dataset.style;
          console.log('🔘 Style button clicked:', styleKey);
          await this.setMapStyle(styleKey);
        });
      });
    }
  }

  /**
   * Set map type and update available styles
   * @param {string} typeKey - Map type key
   */
  async setMapType(typeKey) {
    console.log('Map type changing to:', typeKey);
    
    // Update state
    this.currentSettings.mapType = typeKey;
    
    // Update type selector UI
    if (this.elements.mapTypeOptions) {
      this.elements.mapTypeOptions.forEach(option => {
        option.classList.toggle('active', option.dataset.type === typeKey);
      });
    }
    
    // Update style selector with options for this type
    this.updateStyleSelector(typeKey);
    
    // Set the first available style for this type as default
    const mapTypes = this.getMapTypeStyles();
    const typeStyles = mapTypes[typeKey]?.styles || {};
    const firstStyleKey = Object.keys(typeStyles)[0];
    
    if (firstStyleKey) {
      await this.setMapStyle(firstStyleKey);
    }
  }

  /**
   * Set map style and apply to map
   * @param {string} styleKey - Map style key
   */
  async setMapStyle(styleKey) {
    console.log('🎨 Map style changing to:', styleKey);
    console.log('🎨 Previous mapStyle value:', this.currentSettings.mapStyle);
    console.log('🎨 Full currentSettings before update:', JSON.stringify(this.currentSettings, null, 2));
    
    // Update state
    this.currentSettings.mapStyle = styleKey;
    console.log('🎨 Updated currentSettings.mapStyle to:', this.currentSettings.mapStyle);
    console.log('🎨 Full currentSettings after update:', JSON.stringify(this.currentSettings, null, 2));
    
    // Update style selector UI
    const styleOptions = document.querySelectorAll('.style-option');
    console.log('🎨 Found', styleOptions.length, 'style options to update');
    styleOptions.forEach(option => {
      option.classList.toggle('active', option.dataset.style === styleKey);
    });
    
    // Apply to map
    console.log('🎨 Applying style to map...');
    await this.updateMapStyleFromSelector(styleKey);
    console.log('🎨 Style application completed');
  }

  /**
   * Update the style selector with options for selected type
   * @param {string} selectedType - Currently selected map type
   */
  updateStyleSelector(selectedType) {
    const styleSelector = this.elements.mapStyleSelector;
    if (!styleSelector) return;
    
    const mapTypes = this.getMapTypeStyles();
    const typeStyles = mapTypes[selectedType]?.styles || {};
    
    styleSelector.innerHTML = Object.entries(typeStyles).map(([styleKey, styleInfo]) => `
      <button class="style-option" data-style="${styleKey}">
        <div class="style-preview" style="background-color: ${styleInfo.previewColor || '#ccc'}"></div>
        <span class="style-name">${styleInfo.name}</span>
      </button>
    `).join('');
    
    // Re-bind events for new style options
    this.bindMapStyleEvents();
  }

  /**
   * Update map style based on selector choice with route preservation
   * @param {string} styleKey - Style key from selector
   */
  async updateMapStyleFromSelector(styleKey) {
    if (!this.mapboxIntegration || !this.mapboxIntegration.map) {
      console.warn('Map not ready for style update');
      return;
    }
    
    console.log('Applying map style with route preservation:', styleKey);
    
    // Validate that the style key exists in our types
    const mapTypes = this.getMapTypeStyles();
    let styleExists = false;
    
    // Check if style exists in any map type
    for (const [typeKey, typeData] of Object.entries(mapTypes)) {
      if (typeData.styles[styleKey]) {
        styleExists = true;
        break;
      }
    }
    
    if (!styleExists) {
      console.warn('Style key not found in map types:', styleKey);
      return;
    }
    
    try {
      // Show loading feedback
      this.showRouteLoading('Updating map style...');
      
      // Use the integration's setStyle method which preserves routes
      if (this.mapboxIntegration.setStyle) {
        // Pass the style key directly - the integration will handle URL resolution
        await this.mapboxIntegration.setStyle(styleKey);
        console.log('Map style applied successfully with route preservation');
        this.hideRouteLoading();
        this.showRouteSuccess('Map style updated successfully');
      } else {
        console.warn('Route preservation not available, using core setStyle');
        // Fallback to core setStyle with style key
        if (this.mapboxIntegration.core && this.mapboxIntegration.core.setStyle) {
          await this.mapboxIntegration.core.setStyle(styleKey);
          console.log('Map style applied successfully via core');
        } else {
          console.error('No style setting method available');
          throw new Error('Map style setting not available');
        }
        this.hideRouteLoading();
      }
    } catch (error) {
      console.error('Failed to apply map style:', error);
      this.hideRouteLoading();
      this.showRouteError('Failed to update map style: ' + error.message);
    }
  }
  
  /**
   * Bind text control events
   */
  bindTextEvents() {
    // Main title input
    if (this.elements.mainTitleInput) {
      this.elements.mainTitleInput.addEventListener('input', (e) => {
        this.currentSettings.mainTitle = e.target.value;
        this.updateTextOverlay('title', e.target.value);
      });
    }
    
    // Subtitle input
    if (this.elements.subtitleInput) {
      this.elements.subtitleInput.addEventListener('input', (e) => {
        this.currentSettings.subtitle = e.target.value;
        this.updateTextOverlay('subtitle', e.target.value);
      });
    }
    
    // Text suggestions
    this.elements.suggestionItems.forEach((item) => {
      item.addEventListener('click', () => {
        const text = item.dataset.text;
        
        if (text === 'route-name' && this.activityData) {
          // Use route name
          const routeName = this.activityData.name.toUpperCase();
          this.currentSettings.mainTitle = routeName;
          if (this.elements.mainTitleInput) {
            this.elements.mainTitleInput.value = routeName;
          }
          this.updateTextOverlay('title', routeName);
        } else if (text) {
          // Use suggested text
          this.currentSettings.mainTitle = text;
          if (this.elements.mainTitleInput) {
            this.elements.mainTitleInput.value = text;
          }
          this.updateTextOverlay('title', text);
        }
      });
    });
  }
  
  /**
   * Bind layout control events
   */
  bindLayoutEvents() {
    // Direct binding for current HTML structure - Size buttons
    const sizeButtons = document.querySelectorAll('[data-size]');
    console.log('Found', sizeButtons.length, 'size option buttons');
    
    sizeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const sizeKey = button.dataset.size;
        console.log('Size button clicked:', sizeKey);
        
        // Update active state
        sizeButtons.forEach(btn => {
          btn.style.border = '2px solid transparent';
          btn.classList.remove('active');
        });
        button.style.border = '2px solid var(--brand-primary)';
        button.classList.add('active');
        
        // Update settings
        this.currentSettings.printSize = sizeKey;

        // Update pricing info
        this.updatePricingInfo(button);

        // Update map canvas dimensions for new print size
        this.updateMapLayout();

        // Update summary bar
        this.updateSummaryBar();

        console.log('Print size changed to:', sizeKey);
      });
    });
    
    // Layout options (portrait/landscape) - keep existing if elements exist
    if (this.elements.layoutOptions && this.elements.layoutOptions.length > 0) {
      this.elements.layoutOptions.forEach((layout) => {
        layout.addEventListener('click', () => {
          // Update active state
          this.elements.layoutOptions.forEach(l => l.classList.remove('active'));
          layout.classList.add('active');
          
          // Update settings
          this.currentSettings.layout = layout.dataset.layout;

          // Update map dimensions
          this.updateMapLayout();

          // Update summary bar
          this.updateSummaryBar();

          console.log('Layout changed to:', this.currentSettings.layout);
        });
      });
    }
    
    // Original size options - keep existing if elements exist
    if (this.elements.sizeOptions && this.elements.sizeOptions.length > 0) {
      this.elements.sizeOptions.forEach((size) => {
        size.addEventListener('click', () => {
          // Update active state
          this.elements.sizeOptions.forEach(s => s.classList.remove('active'));
          size.classList.add('active');
          
          // Update settings
          this.currentSettings.printSize = size.dataset.size;

          // Update pricing info
          this.updatePricingInfo(size);

          // Update map canvas dimensions for new print size
          this.updateMapLayout();

          // Update summary bar
          this.updateSummaryBar();

          console.log('Print size changed to:', this.currentSettings.printSize);
        });
      });
    }
  }
  
  /**
   * Bind action button events
   */
  bindActionEvents() {
    if (this.elements.saveButton) {
      this.elements.saveButton.addEventListener('click', () => {
        this.saveCurrentDesign();
      });
    }
    
    if (this.elements.shareButton) {
      this.elements.shareButton.addEventListener('click', () => {
        this.shareCurrentDesign();
      });
    }
    
    // Main "Create My Poster" button
    const createPosterBtn = document.getElementById('create-poster-btn');
    console.log('🔍 [bindActionEvents] Looking for create-poster-btn, found:', !!createPosterBtn);
    
    if (createPosterBtn) {
      console.log('🔍 [bindActionEvents] Binding click handler to Create My Poster button');
      createPosterBtn.addEventListener('click', async (event) => {
        console.log('🚨 [BUTTON CLICK] Create My Poster button clicked - ENTRY POINT');
        console.log('🔍 [BUTTON CLICK] Event details:', event);
        console.log('🔍 [BUTTON CLICK] Current URL:', window.location.href);
        console.log('🔍 [BUTTON CLICK] AuthUtils available:', !!window.AuthUtils);
        
        // Prevent any default actions that might cause redirect
        event.preventDefault();
        event.stopPropagation();
        
        console.log('🔍 [BUTTON CLICK] Starting server-side preview generation...');
        try {
          // Use server-side generation with Symbol Layers instead of client-side capture
          await this.generateHighResPreview();
        } catch (error) {
          console.error('❌ [BUTTON CLICK] Server-side preview failed, falling back to client-side:', error);
          // Fallback to client-side capture if server fails
          await this.previewPoster();
        }
      });
      console.log('✅ [bindActionEvents] Click handler bound successfully');
    } else {
      console.error('❌ [bindActionEvents] create-poster-btn element not found!');
    }
  }
  
  /**
   * Real-time Preview Updates
   */
  
  /**
   * Update map style based on current settings with enhanced color schemes
   * CRITICAL: Separates route styling from background style changes to preserve routes
   */
  async updateMapStyle() {
    if (!this.mapboxIntegration) return;
    
    const colorMapping = {
      synthwave: { 
        color: '#f0f', 
        gradient: 'linear-gradient(135deg, #f0f, #0ff)',
        style: 'grey',
        glow: true
      },
      neon: { 
        color: '#22d3ee', 
        gradient: '#22d3ee',
        style: 'dark',
        glow: true
      },
      sunset: { 
        color: '#ec4899', 
        gradient: 'linear-gradient(135deg, #ec4899, #a855f7)',
        style: 'dark',
        glow: false
      },
      retro: { 
        color: '#f59e0b', 
        gradient: '#f59e0b',
        style: 'grey',
        glow: false
      },
      midnight: { 
        color: '#3730a3', 
        gradient: '#3730a3',
        style: 'dark',
        glow: false
      },
      vapor: { 
        color: '#a855f7', 
        gradient: 'linear-gradient(135deg, #a855f7, #ec4899, #22d3ee)',
        style: 'dark',
        glow: true
      }
    };
    
    const mapping = colorMapping[this.currentSettings.colorScheme];
    if (!mapping) return;
    
    console.log(`MapDesign: Applying ${this.currentSettings.colorScheme} theme`);
    
    // CRITICAL: Check if we need to change the background map style
    const currentMapStyle = this.mapboxIntegration.core ? this.mapboxIntegration.core.options.style : null;
    const needsStyleChange = currentMapStyle !== mapping.style;
    
    console.log(`MapDesign: Current style: ${currentMapStyle}, Target style: ${mapping.style}, Needs change: ${needsStyleChange}`);
    
    if (needsStyleChange) {
      console.log(`MapDesign: Background map style change required from ${currentMapStyle} to ${mapping.style}`);
      
      // Show loading indicator for style change with route restoration
      this.showRouteLoading('Changing map style and preserving route...');
      
      try {
        // This will trigger route restoration automatically
        if (this.mapboxIntegration.setStyle) {
          await this.mapboxIntegration.setStyle(mapping.style);
          this.showRouteSuccess('Map style updated successfully');
        }
      } catch (error) {
        console.error('MapDesign: Style change failed:', error);
        this.showRouteError('Failed to update map style. Route may need to be reloaded.');
      } finally {
        this.hideRouteLoading();
      }
    } else {
      console.log('MapDesign: Background map style unchanged, updating route color only');
    }
    
    // ALWAYS update route color (this should NOT trigger style change)
    if (this.mapboxIntegration.updateRouteColor) {
      console.log(`MapDesign: Updating route color to ${mapping.color}`);
      
      try {
        const success = this.mapboxIntegration.updateRouteColor(mapping.color);
        if (!success) {
          this.showRouteError('Failed to update route color');
        }
      } catch (error) {
        console.error('MapDesign: Route color update failed:', error);
        this.showRouteError('Failed to update route color');
      }
    }
    
    // Apply enhanced visual effects (no style change)
    this.applyVisualEffects(mapping);
  }
  
  /**
   * Apply enhanced visual effects based on color scheme
   */
  applyVisualEffects(mapping) {
    // Add glow effects for certain color schemes
    if (mapping.glow && this.mapboxIntegration.map) {
      const map = this.mapboxIntegration.map;
      
      // Check if route layer exists before applying effects
      if (map.getLayer('route-line')) {
        map.setPaintProperty('route-line', 'line-blur', 2);
        map.setPaintProperty('route-line', 'line-opacity', 0.8);
      }
    }
    
    // Update CSS custom properties for consistent theming
    document.documentElement.style.setProperty('--current-route-color', mapping.color);
    document.documentElement.style.setProperty('--current-route-gradient', mapping.gradient);
  }
  
  /**
   * Update route thickness without triggering style changes
   */
  updateRouteThickness(thickness) {
    console.log(`MapDesign: Updating route thickness to ${thickness} (direct method)`);

    if (this.mapboxIntegration && this.mapboxIntegration.updateRouteStyle) {
      // This should now use the direct route update method
      this.mapboxIntegration.updateRouteStyle({ routeWidth: thickness });
    } else {
      console.warn('MapDesign: Cannot update route thickness - mapboxIntegration not available');
    }
  }

  /**
   * Update route color
   */
  updateRouteColor(color) {
    console.log(`MapDesign: Updating route color to ${color}`);

    if (this.mapboxIntegration && this.mapboxIntegration.updateRouteStyle) {
      // Update the route color on the map
      this.mapboxIntegration.updateRouteStyle({ routeColor: color });
    } else {
      console.warn('MapDesign: Cannot update route color - mapboxIntegration not available');
    }
  }

  /**
   * Update text overlay
   */
  updateTextOverlay(type, text) {
    if (type === 'title' && this.elements.titleOverlay) {
      this.elements.titleOverlay.textContent = text;
    } else if (type === 'subtitle' && this.elements.subtitleOverlay) {
      this.elements.subtitleOverlay.textContent = text;
    }
  }
  
  /**
   * Update map layout (portrait/landscape)
   * Uses CanvasSizeManager for precise preview-to-print matching
   */
  async updateMapLayout() {
    const previewArea = document.querySelector('.poster-preview-area');
    const mapWrapper = document.querySelector('.map-display-wrapper');

    if (!previewArea || !mapWrapper) return;

    const orientation = this.currentSettings.layout || 'portrait';
    const format = (this.currentSettings.printSize || 'A3').toUpperCase();

    console.log(`Updating map layout: ${format} ${orientation}`);

    // Update preview area class for CSS styling
    if (orientation === 'landscape') {
      previewArea.classList.add('landscape');
      previewArea.classList.remove('portrait');
    } else {
      previewArea.classList.add('portrait');
      previewArea.classList.remove('landscape');
    }

    // Update map wrapper data attributes for CSS selectors
    mapWrapper.setAttribute('data-format', format);
    mapWrapper.setAttribute('data-orientation', orientation);

    // Also add class names for backward compatibility
    mapWrapper.className = 'map-display-wrapper';
    mapWrapper.classList.add(`format-${format.toLowerCase()}`);
    mapWrapper.classList.add(`orientation-${orientation}`);

    // Use CanvasSizeManager to resize canvas to exact print dimensions (quarter-scale)
    if (this.canvasSizeManager) {
      try {
        await this.canvasSizeManager.resizeCanvas(
          mapWrapper,
          format,
          orientation,
          300, // Target 300 DPI for print
          { immediate: false } // Use smooth transition
        );
        console.log('Canvas resized using CanvasSizeManager');
      } catch (error) {
        console.error('Failed to resize canvas with CanvasSizeManager:', error);
      }
    }

    // Trigger Mapbox map resize after canvas dimension change
    if (this.mapboxIntegration && this.mapboxIntegration.map) {
      setTimeout(() => {
        console.log('Triggering Mapbox map.resize()');
        this.mapboxIntegration.map.resize();
      }, 350); // Give time for canvas resize transition + CSS
    }
  }
  
  /**
   * Update pricing information
   */
  updatePricingInfo(sizeElement) {
    const priceElement = sizeElement.querySelector('.size-price');
    const dimensionsElement = sizeElement.querySelector('.size-dimensions');
    
    if (priceElement && dimensionsElement) {
      const price = priceElement.textContent;
      const dimensions = dimensionsElement.textContent;
      
      // Update pricing info in footer
      const currentPriceEl = document.querySelector('.current-price');
      const sizeInfoEl = document.querySelector('.size-info');
      
      if (currentPriceEl) currentPriceEl.textContent = price;
      if (sizeInfoEl) sizeInfoEl.textContent = `(${this.currentSettings.printSize.toUpperCase()} - ${dimensions})`;
    }
  }
  
  /**
   * Apply style preset
   */
  applyStylePreset(presetType) {
    switch (presetType) {
      case 'retro':
        this.currentSettings.colorScheme = 'synthwave';
        this.currentSettings.routeThickness = 6;
        this.currentSettings.mainTitle = 'RETRO VIBES';
        break;
      case 'minimal':
        this.currentSettings.colorScheme = 'midnight';
        this.currentSettings.routeThickness = 2;
        this.currentSettings.mainTitle = 'MINIMALIST';
        break;
      case 'neon':
        this.currentSettings.colorScheme = 'neon';
        this.currentSettings.routeThickness = 4;
        this.currentSettings.mainTitle = 'NEON GLOW';
        break;
    }
    
    // Update UI to reflect preset
    this.applySettingsToUI();
    
    // Update map
    this.updateMapStyle();
    this.updateRouteThickness(this.currentSettings.routeThickness);
    this.updateTextOverlay('title', this.currentSettings.mainTitle);
  }
  
  /**
   * Apply current settings to UI elements
   */
  applySettingsToUI() {
    // Update color scheme selection
    this.elements.colorSchemes.forEach(scheme => {
      scheme.classList.toggle('active', scheme.dataset.scheme === this.currentSettings.colorScheme);
    });
    
    // Update thickness slider
    if (this.elements.routeThicknessSlider) {
      this.elements.routeThicknessSlider.value = this.currentSettings.routeThickness;
    }
    
    // Update text inputs
    if (this.elements.mainTitleInput) {
      this.elements.mainTitleInput.value = this.currentSettings.mainTitle;
    }
    
    if (this.elements.subtitleInput) {
      this.elements.subtitleInput.value = this.currentSettings.subtitle;
    }
    
    // Update layout selection
    this.elements.layoutOptions.forEach(layout => {
      layout.classList.toggle('active', layout.dataset.layout === this.currentSettings.layout);
    });
    
    // Update size selection
    this.elements.sizeOptions.forEach(size => {
      size.classList.toggle('active', size.dataset.size === this.currentSettings.printSize);
    });
  }
  
  /**
   * Action Functions
   */
  
  /**
   * Save current design
   */
  saveCurrentDesign() {
    console.log('Saving design with settings:', this.currentSettings);
    
    // Save to localStorage
    localStorage.setItem('savedPosterDesign', JSON.stringify({
      settings: this.currentSettings,
      activityData: this.activityData,
      timestamp: Date.now()
    }));
    
    // Show confirmation
    this.showToast('Design saved successfully!', 'success');
  }
  
  /**
   * Share current design
   */
  shareCurrentDesign() {
    console.log('Sharing design with settings:', this.currentSettings);
    
    // Create shareable URL
    const shareData = {
      title: 'My Custom Map Poster',
      text: `Check out my custom map poster: ${this.currentSettings.mainTitle}`,
      url: window.location.href
    };
    
    if (navigator.share) {
      navigator.share(shareData);
    } else {
      // Fallback - copy URL to clipboard
      navigator.clipboard.writeText(window.location.href).then(() => {
        this.showToast('Share URL copied to clipboard!', 'success');
      });
    }
  }
  
  /**
   * Show loading indicator for route operations
   * @param {string} message - Loading message
   * @param {string} containerId - Container to show loading in (default: map container)
   */
  showRouteLoading(message = 'Processing route...', containerId = 'mapbox-map') {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Remove existing loading indicator
    this.hideRouteLoading(containerId);

    const loadingEl = document.createElement('div');
    loadingEl.id = `${containerId}-route-loading`;
    loadingEl.className = 'route-loading-overlay';
    loadingEl.innerHTML = `
      <div class="route-loading-content">
        <div class="route-loading-spinner"></div>
        <p class="route-loading-message">${message}</p>
      </div>
    `;
    
    loadingEl.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(15, 23, 42, 0.8);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      border-radius: 0.5rem;
    `;
    
    container.style.position = 'relative';
    container.appendChild(loadingEl);
    
    console.log(`MapDesign: Showing route loading indicator: ${message}`);
  }

  /**
   * Hide loading indicator
   */
  hideRouteLoading(containerId = 'mapbox-map') {
    const loadingEl = document.getElementById(`${containerId}-route-loading`);
    if (loadingEl) {
      loadingEl.remove();
      console.log('MapDesign: Route loading indicator hidden');
    }
  }

  /**
   * Show route operation success message
   */
  showRouteSuccess(message, duration = 3000) {
    this.showToast(message, 'success');
    console.log(`MapDesign: Route success: ${message}`);
  }

  /**
   * Show route operation error message
   */
  showRouteError(message, duration = 5000) {
    this.showToast(message, 'error');
    console.error(`MapDesign: Route error: ${message}`);
  }

  /**
   * Show toast notification
   */
  showToast(message, type = 'info') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 2rem;
      right: 2rem;
      background: var(--poster-glass);
      color: var(--poster-text-primary);
      padding: 1rem 1.5rem;
      border-radius: 0.5rem;
      border: 1px solid var(--poster-border);
      backdrop-filter: blur(10px);
      z-index: 1000;
      animation: slideInRight 0.3s ease-out;
    `;
    
    document.body.appendChild(toast);
    
    // Remove after 3 seconds
    setTimeout(() => {
      toast.style.animation = 'slideOutRight 0.3s ease-out';
      setTimeout(() => document.body.removeChild(toast), 300);
    }, 3000);
  }

  /**
   * Get icon for activity type
   */
  getActivityIcon(type) {
    const icons = {
      'Ride': '🚴',
      'Run': '🏃',
      'Walk': '🚶',
      'Hike': '🥾',
      'Swim': '🏊',
      'VirtualRide': '🚴‍♂️',
      'EBikeRide': '🚲',
      'MountainBikeRide': '🚵'
    };
    return icons[type] || '📍';
  }

  /**
   * Format duration from seconds to readable format
   */
  formatDuration(seconds) {
    if (!seconds) return 'N/A';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  /**
   * Decode Google polyline format to coordinates
   */
  decodePolyline(polyline) {
    if (!polyline) return [];
    
    let index = 0;
    const len = polyline.length;
    let lat = 0;
    let lng = 0;
    const coordinates = [];

    while (index < len) {
      let b, shift = 0, result = 0;
      do {
        b = polyline.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = polyline.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      const latCoord = lat / 1e5;
      const lngCoord = lng / 1e5;
      
      // Validate coordinates before adding
      if (!isNaN(latCoord) && !isNaN(lngCoord) && 
          latCoord >= -90 && latCoord <= 90 && 
          lngCoord >= -180 && lngCoord <= 180) {
        // Push in [lng, lat] format for Mapbox GL JS compatibility
        coordinates.push([lngCoord, latCoord]);
      } else {
        console.warn(`Invalid coordinate skipped: [${latCoord}, ${lngCoord}]`);
      }
    }

    return coordinates;
  }

  /**
   * Calculate bounding box for coordinates
   */
  calculateBounds(coordinates) {
    if (!coordinates || coordinates.length === 0) {
      return null;
    }

    // Filter out any invalid coordinates first
    const validCoords = coordinates.filter(coord => {
      if (!Array.isArray(coord) || coord.length < 2) return false;
      const lng = coord[0], lat = coord[1];  // [lng, lat] format
      return !isNaN(lat) && !isNaN(lng) && 
             lat >= -90 && lat <= 90 && 
             lng >= -180 && lng <= 180;
    });

    if (validCoords.length === 0) {
      console.warn('No valid coordinates found for bounds calculation');
      return null;
    }

    let minLng = validCoords[0][0];
    let maxLng = validCoords[0][0];
    let minLat = validCoords[0][1];
    let maxLat = validCoords[0][1];

    for (let i = 1; i < validCoords.length; i++) {
      const [lng, lat] = validCoords[i];  // [lng, lat] format
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }

    return {
      west: minLng,
      south: minLat, 
      east: maxLng,
      north: maxLat
    };
  }

  /**
   * Debounce utility function
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Get sample activity data for testing when no real data is available
   */
  getSampleActivityData() {
    return {
      id: 'sample-123',
      name: 'Sample Cycling Route',
      type: 'Ride',
      sport_type: 'Ride',
      start_date_local: new Date().toISOString(),
      distance: 25000, // 25km in meters
      moving_time: 3600, // 1 hour in seconds
      total_elevation_gain: 250, // meters
      average_speed: 6.94, // m/s (25 km/h)
      map: {
        summary_polyline: 'u{~vFvyys@fS]pR_@hWm@bHk@nGYpHQdJ@hGJhEZvDdAvDhCfE`EfBbCl@fBZtATx@TvA`@tBbBnC|@dCDdCAjDWzBc@lDOdEChD_@pBcCnL_CzMu@hDqApVOhD@jEZfE|@|GhBrEnBbEz@|ArBjC`BlBnAlAjA|@bA^z@VtAh@lA@tG}B`Be@rA[`Ae@|AaA|BaBhFsE~FuE`IsGnHuEzEgDnDcBlBa@bBCvBQhDmCtFaD~NeEfHiBlFqAjDy@|FwA~BcA|@_@t@a@nAcAtBsCdCwE~@gCXsALyAQoDkAyGwAoGm@}AoD_KqByE{A_EoBuD{BuCcCuBsHsFaGiF}@k@qBu@gCm@qCOwBO|@f@tAj@zBdCzCz@fBj@hAz@nAfAbAtMhKtYbTxQlNrBpAxCnEjCzEtD~HzBdFvN`[tHjQvD`InCjFzHlNtDfHxBtD~L~TrBtClHjGlFrE~FrGlApB`FrTnFrUrJ`c@lOdu@`IpXvCrMzDzPfEfSbCjLfAvDzDbMtAjFfGxQdFrN|HbUzCrFdGxJlHdPfHvJpSrY~FhIdJ~QtAhEfGb\\jGp[fDfPjErXrBfKlHf[hGlV~BhLnGzV~Nrp@bJjb@pI~b@pJbj@|DhUtBjLdE~TrBfJhDpO`DjLtE~NnOfb@xNd_@|Hv[vE|TpGzWxA~FdOfn@`E~PbHzYdCnKbCbJvGnUbFvPzCpJzFdPtEjLbJpSxBtDdDbGpGhK~AhCfDbIpJ~V~E`NnGbOpKlYdFpMxO|a@~EtMhJ`VfFpNrDvI~CtHjD~Ij@hAvAbF~BdHrCrRj@zFpRbiAJx@fO`t@bEbVlAhFrD`OfKna@|AtGtBpItBhH~AtGzFhUdFdTzEjRjGdVhIz[zGhVlIlVrOdSfPjRpMlM`c@l^pT`StFlFbZzUdKvHlNbJlKzGxJbGfJzEnNfFpLbCtUvElSdCvSXdU_BpMuClOyGhMyJfLqKjKwLrJmKzGwHfFeGrCoEtAeGzBgJrE}Vh@kLcAuKcEkPaDqNmB}K}@{EkAsEiDyJkGmR{CoJmAoFkAmDkC_GaFiJqMqVyJaRmJsOqF{JoJyNcLiRoKoR}LaVeKmRoEcKwCmGqFcMoBwEm@_BiBkEcDuIsBsGiAmEm@{CkBwJqCeN_C}Q}@oFwAcLoA{Ig@_Es@oJyDoV}AkOe@gD_BoTaBqMgAiJiAaJyBuPuBcPwAoLcBeNsCuVqBwN_CsPkEk\\iBcMeA_JiAyIuBkPs@mI_A{HoAgFcA}CwCaIwDcJiGoO}EqJcGqJiEgGuKsLsF{DiGgE}CuBwJkE}RmEoP{DuKkE{HcFwK{IqSaPgKqOmEgIcBgCiAeBwEqEkFqEkJ_HcKqEgNkFyQkGeQgGwOsE}CgBkBk@yBHsEbAaFdAmGv@sE|@}E`@gCLcB_@sEcAoEcH_OuNgXwIuRaFqLuFuJ{J{Qm[{j@gJ}MaHaLeDwGqCeFyCiEkEqHoGsH_FcGkFmI}DaFaD{F}BkDoBaDsBgEaAsB_BiEcF_MgCcGcAsBoAmCkB_BcPcNoAsAaBmEoBkFsBwLoDgQsBgLu@yDkH}R}CkKyBsIgAmGg@sGQmIXeMbB_UpCaQlBcPvBuOdC}M~EuSrCsMjC}NhB_K~@cElAgE`CyHtCsJ|GaUxC_N~AiGzAaFlBqFlAsBlAuBrFeLhC_GfGiM`BuBxGwLtCiEfD_E`CcBrCcBfC}@rCo@hDCjD^|DdA`DdAbC`A~CbBtF`DjGfEjD`CrCnB~DfDbD~D~C~DxDpF~GxIrT|Z`I`K~XrY`HdInGrJ|Rz\\fOjSdR|[vMvQtTp\\fGxJxFdJpM`QfGfJnCxD~AhBfGxItC~FtB~ErCjGfCtIfAtDjD`QhEpQvAtHfElTvKpi@xEjXhDfRnCtNdCdNfCdO~Dz\\jApJ~AjNlAnLhBzPhAlNtAbOfAvLxAjTzAhMxDrZhBxP~A~K|BjOxAvKjBlObBrNdBpL|CbUxBnNzCnSxCrRjC~OtDbVlBpMxA~IJn@nBjLdErWvBlLvAtJ~AtIpCzLfBbKbDtNrBhMfAhGvEbU`BtJzCtPhAzFjFtZlAbIlApGdAzGfCtQhAlHrBhM|ArLhAvIdBhOlApLhAtIhAvGdBlKtCtQnBrKhEdU~BrOfAdIdAlGtArKrBzM~BfM~EbVxBvKfHxZ`HhWnFdUrMto@rHhXlFrTfPvm@|QxLpOhJ~MhIfObHbHrEzFxDxD~BhFbEtJdGfSfMbNxItGpDlIfH|N`IvI`E`HbDjHlAtF\\rPgBvN_D|FeB|C_A|EaC|J_CjJkBfJoCnJcDfNcI~PcGdXqH~OoE`IkDbPsGfOcCpOlB'
      },
      gear: null,
      photo_count: 0,
      trainer: false,
      commute: false
    };
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.mapboxIntegration && this.mapboxIntegration.cleanup) {
      this.mapboxIntegration.cleanup();
    }
    
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
    }

    // Clear stored activity data
    localStorage.removeItem('selectedActivityData');
  }

  /**
   * Initialize the theme selector with two-tier theme/color system
   */
  initializeThemeSelector() {
    console.log('Initializing theme selector...');
    
    const themeContainer = document.getElementById('theme-color-selector');
    if (!themeContainer) {
      console.warn('Theme selector container not found');
      return;
    }
    
    // Check if MapboxCustomization is available
    if (typeof window.MapboxCustomization === 'undefined') {
      console.warn('MapboxCustomization not available, using fallback theme selector');
      this.createFallbackThemeSelector(themeContainer);
      return;
    }
    
    try {
      // Create MapboxCustomization instance if not exists
      if (!window.mapboxCustomization) {
        window.mapboxCustomization = new MapboxCustomization();
      }
      
      // Initialize the customization with our map integration
      if (this.mapboxIntegration) {
        window.mapboxCustomization.initialize({
          map: this.mapboxIntegration.map,
          integration: this.mapboxIntegration,
          config: window.MapboxConfig
        });
      }
      
      // Create the theme selector HTML structure
      themeContainer.innerHTML = `
        <div class="style-selector-wrapper">
          <div class="map-type-section">
            <h5 class="selector-label">Choose Your Theme</h5>
            <div class="map-type-grid" id="map-theme-selector">
              <!-- Theme buttons will be populated by renderThemeSelector -->
            </div>
          </div>
          
          <div class="map-style-section">
            <h5 class="selector-label">Choose Your Color</h5>
            <div class="map-style-grid" id="map-color-selector">
              <!-- Color buttons will be populated by renderColorSelector -->
            </div>
          </div>
        </div>
      `;
      
      // Render the theme selector using MapboxCustomization
      this.renderThemeSelector();
      
      console.log('Theme selector initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize theme selector:', error);
      this.createFallbackThemeSelector(themeContainer);
    }
  }
  
  /**
   * Render the theme selector buttons with rich preview images
   */
  renderThemeSelector() {
    if (!window.mapboxCustomization) return;

    const themeStyles = window.mapboxCustomization.getThemeStyles();
    const themeContainer = document.getElementById('theme-color-selector');

    if (!themeContainer) return;

    // Get the current active theme from settings (default to 'classic' if not set)
    const activeTheme = this.currentSettings.mapType || 'classic';

    // Render large theme preview cards with gradient + icon
    const themeCards = Object.entries(themeStyles).map(([themeKey, themeInfo]) => {
      // Use gradient + icon for clean, working preview (images can be added later)
      const previewContent = this.getThemeIcon(themeKey);

      return `
        <div class="theme-card ${themeKey === activeTheme ? 'active' : ''}"
             data-theme="${themeKey}">
          <div class="theme-preview-area" style="background: ${this.getThemePreviewGradient(themeKey)}">
            ${previewContent}
          </div>
          <div class="theme-card-info">
            <div class="theme-card-name">${themeInfo.name}</div>
            <div class="theme-card-description">${themeInfo.description}</div>
          </div>
        </div>
      `;
    }).join('');

    themeContainer.innerHTML = themeCards;

    // Render colors for Tab 2 (will be shown when user navigates to Colors tab)
    this.renderColorSelector(activeTheme);

    // Add theme card event listeners
    themeContainer.querySelectorAll('.theme-card').forEach(card => {
      card.addEventListener('click', async (e) => {
        const themeKey = e.currentTarget.dataset.theme;
        await this.setTheme(themeKey);
      });
    });
  }
  
  /**
   * Render color selector for selected theme
   */
  renderColorSelector(selectedTheme) {
    if (!window.mapboxCustomization) return;

    const themeStyles = window.mapboxCustomization.getThemeStyles();
    const colorContainer = document.getElementById('map-style-options');
    const selectedTextContainer = document.getElementById('color-selected-text');

    if (!colorContainer || !themeStyles[selectedTheme]) return;

    const themeColors = themeStyles[selectedTheme].colors;
    // Get the currently active color from settings, default to first available
    const activeColor = this.currentSettings.mapColor || Object.keys(themeColors)[0];

    // Render large color swatches
    const colorSwatches = Object.entries(themeColors).map(([colorKey, colorInfo]) => `
      <div class="color-swatch ${colorKey === activeColor ? 'active' : ''}"
           data-color="${colorKey}"
           style="background-color: ${colorInfo.previewColor}">
        <svg class="color-swatch-checkmark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <polyline points="20,6 9,17 4,12"/>
        </svg>
      </div>
    `).join('');

    colorContainer.innerHTML = colorSwatches;

    // Update selected color text
    if (selectedTextContainer && themeColors[activeColor]) {
      const span = selectedTextContainer.querySelector('span');
      if (span) {
        span.textContent = themeColors[activeColor].name;
      }
    }

    // Add color swatch event listeners
    colorContainer.querySelectorAll('.color-swatch').forEach(swatch => {
      swatch.addEventListener('click', async (e) => {
        const colorKey = e.currentTarget.dataset.color;
        await this.setThemeColor(selectedTheme, colorKey);
      });
    });
  }
  
  /**
   * Set theme and update color options
   */
  async setTheme(themeKey) {
    console.log('Setting theme to:', themeKey);

    // Update internal state tracking
    this.currentSettings.mapType = themeKey;

    // Update theme card active state - remove active from all, then add to selected
    document.querySelectorAll('.theme-card').forEach(card => {
      card.classList.remove('active');
    });

    // Add active class to the selected theme card
    const selectedThemeCard = document.querySelector(`.theme-card[data-theme="${themeKey}"]`);
    if (selectedThemeCard) {
      selectedThemeCard.classList.add('active');
    }

    // Progressive disclosure: Show color section when theme is selected
    const colorSection = document.querySelector('.map-style-section');
    if (colorSection) {
      colorSection.classList.add('visible');
    }

    // Update color options for new theme
    this.renderColorSelector(themeKey);

    // Set the first color of the new theme
    if (window.mapboxCustomization) {
      const themeStyles = window.mapboxCustomization.getThemeStyles();
      const firstColorKey = Object.keys(themeStyles[themeKey]?.colors || {})[0];
      if (firstColorKey) {
        await this.setThemeColor(themeKey, firstColorKey);
      }
    }

    // Update summary bar
    this.updateSummaryBar();
  }
  
  /**
   * Set theme color and update map
   */
  async setThemeColor(themeKey, colorKey) {
    console.log('Setting theme color:', themeKey, colorKey);

    try {
      // Update color button active state - remove active from all, then add to selected
      document.querySelectorAll('.color-swatch').forEach(btn => {
        btn.classList.remove('active');
      });

      // Add active class to the selected color button
      const selectedColorBtn = document.querySelector(`[data-color="${colorKey}"]`);
      if (selectedColorBtn) {
        selectedColorBtn.classList.add('active');
      }

      // Update current settings with proper state tracking
      this.currentSettings.mapType = themeKey; // Keep consistent with theme selection
      this.currentSettings.mapTheme = themeKey;
      this.currentSettings.mapColor = colorKey;
      this.currentSettings.mapStyle = `${themeKey}_${colorKey}`; // For backward compatibility

      // Update the "Selected: [Color]" text display
      const selectedTextContainer = document.getElementById('color-selected-text');
      if (selectedTextContainer && window.mapboxCustomization) {
        const themeStyles = window.mapboxCustomization.getThemeStyles();
        const colorInfo = themeStyles[themeKey]?.colors[colorKey];
        if (colorInfo) {
          const span = selectedTextContainer.querySelector('span');
          if (span) {
            span.textContent = colorInfo.name;
          }
        }
      }
      
      // Get the style URL
      let styleUrl;
      if (window.MapboxConfig && window.MapboxConfig.getThemeStyleUrl) {
        styleUrl = window.MapboxConfig.getThemeStyleUrl(themeKey, colorKey);
      } else if (window.mapboxCustomization) {
        const themeStyles = window.mapboxCustomization.getThemeStyles();
        styleUrl = themeStyles[themeKey]?.colors[colorKey]?.url;
      }
      
      if (styleUrl && this.mapboxIntegration) {
        // Use the integration's setStyle method to preserve routes
        if (this.mapboxIntegration.setStyle) {
          await this.mapboxIntegration.setStyle(styleUrl);
        } else {
          this.mapboxIntegration.map.setStyle(styleUrl);
        }
        
        console.log('Theme applied successfully:', themeKey, colorKey);
      } else {
        console.error('Could not apply theme - missing style URL or map integration');
      }

      // Update summary bar
      this.updateSummaryBar();

    } catch (error) {
      console.error('Failed to set theme color:', error);
    }
  }
  
  /**
   * Get theme icon SVG
   */
  getThemeIcon(theme) {
    const icons = {
      classic: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20,8 L20,20 L4,20 L4,8 L12,2 L20,8 Z M6,18 L18,18 L18,10 L12,5 L6,10 L6,18 Z"/>
        <rect x="8" y="12" width="2" height="4"/>
        <rect x="14" y="12" width="2" height="4"/>
      </svg>`,
      minimal: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/>
        <circle cx="12" cy="12" r="3" fill="currentColor"/>
      </svg>`,
      bubble: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="8" cy="8" r="3" fill="currentColor" opacity="0.7"/>
        <circle cx="16" cy="8" r="2" fill="currentColor" opacity="0.5"/>
        <circle cx="12" cy="16" r="4" fill="currentColor" opacity="0.8"/>
      </svg>`
    };
    return icons[theme] || icons.classic;
  }

  /**
   * Get theme preview gradient for large theme cards (fallback)
   */
  getThemePreviewGradient(theme) {
    const gradients = {
      classic: 'linear-gradient(135deg, #f8f8f8 0%, #e0e0e0 100%)',
      minimal: 'linear-gradient(135deg, #f5f5f5 0%, #d5d5d5 100%)',
      bubble: 'linear-gradient(135deg, #e8e8ff 0%, #c8c8ff 100%)',
      street: 'linear-gradient(135deg, #fafafa 0%, #ececec 100%)',
      satellite: 'linear-gradient(135deg, #4a6741 0%, #3a5731 100%)',
      terrain: 'linear-gradient(135deg, #e8f5e8 0%, #d4e8d4 100%)'
    };
    return gradients[theme] || gradients.classic;
  }

  /**
   * Check if browser supports WebP format
   * @returns {boolean}
   */
  checkWebPSupport() {
    // Check if already detected
    if (this._webpSupport !== undefined) {
      return this._webpSupport;
    }

    // Create test canvas
    const elem = document.createElement('canvas');
    if (elem.getContext && elem.getContext('2d')) {
      // Check if WebP representation can be created
      this._webpSupport = elem.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    } else {
      this._webpSupport = false;
    }

    return this._webpSupport;
  }

  /**
   * Get preview image URL for theme + color combination
   * Returns path to WebP or PNG based on browser support
   * @param {string} themeKey - Theme key (e.g., 'classic')
   * @param {string} colorKey - Color key (e.g., 'dark')
   * @returns {string} Image URL or null if not available
   */
  getThemePreviewImage(themeKey, colorKey) {
    if (!themeKey || !colorKey) return null;

    // Construct filename from theme and color keys
    const baseFilename = `${themeKey}-${colorKey}`;

    // Check for WebP support
    const supportsWebP = this.checkWebPSupport();
    const extension = supportsWebP ? 'webp' : 'png';

    // Return asset URL
    // Note: In Shopify, we need to use the CDN path directly
    return `/assets/preview-images/${baseFilename}.${extension}`;
  }

  /**
   * Get the first color for a theme (for preview image)
   * @param {string} themeKey - Theme key
   * @returns {string} First color key or null
   */
  getFirstThemeColor(themeKey) {
    if (!window.mapboxCustomization) return null;

    const themeStyles = window.mapboxCustomization.getThemeStyles();
    const theme = themeStyles[themeKey];

    if (!theme || !theme.colors) return null;

    const colorKeys = Object.keys(theme.colors);
    return colorKeys.length > 0 ? colorKeys[0] : null;
  }

  /**
   * Create fallback theme selector if MapboxCustomization is not available
   */
  createFallbackThemeSelector(container) {
    console.log('Creating fallback theme selector');
    
    container.innerHTML = `
      <div class="text-center" style="padding: var(--space-4); color: var(--text-muted);">
        <p class="text-sm">Using basic map styles...</p>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-3); margin-top: var(--space-3);">
          <button class="card card-interactive" data-style="streets" style="padding: var(--space-3); text-align: center; border: 2px solid var(--brand-primary);">
            <div style="width: 100%; height: 60px; background: #f8f8f8; border-radius: var(--radius-sm); margin-bottom: var(--space-2);"></div>
            <span class="text-sm font-medium">Street Map</span>
          </button>
          <button class="card card-interactive" data-style="outdoors" style="padding: var(--space-3); text-align: center;">
            <div style="width: 100%; height: 60px; background: #8fbc8f; border-radius: var(--radius-sm); margin-bottom: var(--space-2);"></div>
            <span class="text-sm font-medium">Outdoors</span>
          </button>
        </div>
      </div>
    `;
    
    // Add basic event listeners for fallback buttons
    container.querySelectorAll('[data-style]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const styleKey = e.currentTarget.dataset.style;
        this.currentSettings.mapStyle = styleKey;
        
        if (this.mapboxIntegration && this.mapboxIntegration.map) {
          // Use basic Mapbox styles for fallback
          const styleUrl = styleKey === 'streets' ? 'mapbox://styles/mapbox/streets-v11' : 'mapbox://styles/mapbox/outdoors-v11';
          this.mapboxIntegration.map.setStyle(styleUrl);
        }
        
        // Update button states
        container.querySelectorAll('[data-style]').forEach(b => {
          b.style.border = b === e.currentTarget ? '2px solid var(--brand-primary)' : '2px solid transparent';
        });
      });
    });
  }

}

// Make MapDesign available globally
window.MapDesign = MapDesign;

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (window.mapDesignInstance && window.mapDesignInstance.cleanup) {
    window.mapDesignInstance.cleanup();
  }
});