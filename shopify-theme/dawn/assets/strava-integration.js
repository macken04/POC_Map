/**
 * Strava Integration JavaScript Module
 * Handles communication with the backend API for authentication and activity management
 * 
 * Dependencies: None (vanilla JavaScript)
 * Backend API Base URL: Configured via ngrok tunnel
 */

// Configuration
const STRAVA_CONFIG = {
  ngrokBaseUrl: 'https://boss-hog-freely.ngrok-free.app',
  endpoints: {
    // Auth endpoints
    auth: '/auth/strava',
    authStatus: '/auth/status',
    logout: '/auth/logout',
    
    // Strava API endpoints  
    athlete: '/api/strava/athlete',
    activities: '/api/strava/activities',
    activitiesLoadMore: '/api/strava/activities/load-more',
    activityDetails: '/api/strava/activities',
    activitieSearch: '/api/strava/activities/search',
    
    // Shopify integration endpoints
    integrationStatus: '/api/shopify-integration/status',
    sessionContext: '/api/shopify-integration/session-context',
    completeFlow: '/api/shopify-integration/complete-flow'
  }
};

/**
 * Base API Client for Strava Integration
 */
class StravaApiClient {
  constructor(config = STRAVA_CONFIG) {
    this.config = config;
    this.baseUrl = config.ngrokBaseUrl;
    this.debugMode = true; // Enable debug logging
  }

  /**
   * Make authenticated API request
   */
  async apiRequest(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true', // Add ngrok header
        ...options.headers
      },
      ...options
    };

    if (this.debugMode) {
      console.log(`🔄 API Request: ${options.method || 'GET'} ${url}`);
      console.log('📋 Request config:', config);
    }

    try {
      const response = await fetch(url, config);
      
      if (this.debugMode) {
        console.log(`📡 Response status: ${response.status} ${response.statusText}`);
        console.log('📋 Response headers:', Object.fromEntries(response.headers.entries()));
      }
      
      const data = await response.json();
      
      if (!response.ok) {
        const error = new Error(data.message || data.error || `HTTP ${response.status}`);
        if (this.debugMode) {
          console.error(`❌ API Error: ${endpoint}`, {
            status: response.status,
            statusText: response.statusText,
            data: data,
            url: url
          });
        }
        throw error;
      }
      
      if (this.debugMode) {
        console.log(`✅ API Success: ${endpoint}`, data);
      }
      
      return data;
    } catch (error) {
      if (this.debugMode) {
        console.error(`💥 Network Error: ${endpoint}`, {
          message: error.message,
          url: url,
          config: config
        });
      }
      throw error;
    }
  }

  /**
   * Get current authentication status
   */
  async getAuthStatus() {
    return await this.apiRequest(this.config.endpoints.authStatus);
  }

  /**
   * Get integration status (includes Shopify session info)
   */
  async getIntegrationStatus() {
    return await this.apiRequest(this.config.endpoints.integrationStatus);
  }

  /**
   * Get current session context
   */
  async getSessionContext() {
    return await this.apiRequest(this.config.endpoints.sessionContext);
  }

  /**
   * Get athlete information
   */
  async getAthlete() {
    return await this.apiRequest(this.config.endpoints.athlete);
  }

  /**
   * Get activities list
   */
  async getActivities(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = `${this.config.endpoints.activities}${queryString ? `?${queryString}` : ''}`;
    return await this.apiRequest(endpoint);
  }

  /**
   * Load more activities (for pagination)
   */
  async loadMoreActivities(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = `${this.config.endpoints.activitiesLoadMore}${queryString ? `?${queryString}` : ''}`;
    return await this.apiRequest(endpoint);
  }

  /**
   * Get detailed activity information
   */
  async getActivityDetails(activityId) {
    return await this.apiRequest(`${this.config.endpoints.activityDetails}/${activityId}`);
  }

  /**
   * Search activities
   */
  async searchActivities(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = `${this.config.endpoints.activitieSearch}${queryString ? `?${queryString}` : ''}`;
    return await this.apiRequest(endpoint);
  }

  /**
   * Logout user
   */
  async logout() {
    return await this.apiRequest(this.config.endpoints.logout, { method: 'POST' });
  }

  /**
   * Redirect to Strava authentication
   */
  redirectToAuth() {
    window.location.href = `${this.baseUrl}${this.config.endpoints.auth}`;
  }
}

/**
 * Strava Login Page Controller
 */
class StravaLogin {
  constructor() {
    this.api = new StravaApiClient();
    this.elements = this.getElements();
    this.state = {
      authenticated: false,
      loading: false,
      user: null
    };
    
    this.bindEvents();
  }

  getElements() {
    return {
      // Simplified elements for single button UI
      loginActions: document.getElementById('login-actions'),
      connectStravaBtn: document.getElementById('connect-strava-btn'),
      continueToActivitiesBtn: document.getElementById('continue-to-activities-btn'),
      successMessage: document.getElementById('success-message'),
      loadingState: document.getElementById('loading-state')
    };
  }

  bindEvents() {
    if (this.elements.connectStravaBtn) {
      this.elements.connectStravaBtn.addEventListener('click', () => this.connectStrava());
    }
    
    if (this.elements.continueToActivitiesBtn) {
      this.elements.continueToActivitiesBtn.addEventListener('click', () => this.continueToActivities());
    }
  }

  // Simple initialization - just show the connect button without status checking
  initSimple() {
    console.log('StravaLogin: Simple initialization...');
    
    // Check if user is returning from successful auth
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const athlete = urlParams.get('athlete');
    
    if (success === 'true' && athlete) {
      this.showSuccessState(athlete);
      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Auto-redirect to activities page after a brief moment
      setTimeout(() => {
        this.continueToActivities();
      }, 2000); // 2 second delay to show success message
    } else {
      // Show the connect button (default state)
      this.showConnectState();
    }
  }

  async init() {
    console.log('StravaLogin: Full initialization...');
    
    // Handle URL parameters (return from auth)
    this.handleUrlParameters();
    
    // Check current auth status
    await this.checkAuthStatus();
  }

  handleUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const athlete = urlParams.get('athlete');
    
    if (success === 'true' && athlete) {
      this.showLoadingState('Welcome back! Setting up your session...');
      // Clear URL parameters after handling
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  async checkAuthStatus() {
    try {
      this.showLoadingState('Checking your connection...');
      
      const statusData = await this.api.getIntegrationStatus();
      
      if (statusData.success && statusData.status) {
        this.updateAuthState(statusData.status);
      } else {
        throw new Error('Invalid status response');
      }
      
    } catch (error) {
      console.error('Failed to check auth status:', error);
      this.showErrorState('Unable to check connection status', error.message);
    }
  }

  updateAuthState(status) {
    this.state.authenticated = status.isAuthenticated;
    this.state.user = {
      displayName: status.userDisplayName,
      userId: status.stravaUserId
    };

    if (status.isAuthenticated) {
      this.showAuthenticatedState(status);
    } else {
      this.showUnauthenticatedState();
    }
  }

  showAuthenticatedState(status) {
    // Hide loading and error states
    this.hideLoadingState();
    this.hideErrorState();
    
    // Update auth status card
    this.elements.authStatusCard.className = 'strava-auth-card authenticated';
    this.elements.statusSpinner.style.display = 'none';
    this.elements.statusIcon.style.display = 'block';
    this.elements.statusIcon.innerHTML = '✅';
    this.elements.authStatusTitle.textContent = 'Connected Successfully!';
    this.elements.authStatusMessage.textContent = 'Your Strava account is connected and ready to use.';
    
    // Show user info
    this.elements.userWelcomeCard.style.display = 'block';
    this.elements.userDisplayName.textContent = status.userDisplayName || 'Athlete';
    this.elements.userUsername.textContent = status.stravaUserId || '-';
    this.elements.userSessionId.textContent = status.sessionAge ? `Active (${Math.round(status.sessionAge / 1000)}s ago)` : 'Active';
    
    // Update buttons
    this.elements.connectStravaBtn.style.display = 'none';
    this.elements.continueToActivitiesBtn.style.display = 'inline-block';
    this.elements.retryConnectionBtn.style.display = 'none';
    
    // Update progress steps
    this.updateProgressSteps(1);
  }

  showUnauthenticatedState() {
    // Hide loading and error states
    this.hideLoadingState();
    this.hideErrorState();
    
    // Update auth status card
    this.elements.authStatusCard.className = 'strava-auth-card not-authenticated';
    this.elements.statusSpinner.style.display = 'none';
    this.elements.statusIcon.style.display = 'block';
    this.elements.statusIcon.innerHTML = '🔗';
    this.elements.authStatusTitle.textContent = 'Ready to Connect';
    this.elements.authStatusMessage.textContent = 'Connect your Strava account to access your activities.';
    
    // Hide user info
    this.elements.userWelcomeCard.style.display = 'none';
    
    // Update buttons
    this.elements.connectStravaBtn.style.display = 'inline-block';
    this.elements.continueToActivitiesBtn.style.display = 'none';
    this.elements.retryConnectionBtn.style.display = 'none';
    
    // Update progress steps
    this.updateProgressSteps(0);
  }

  showErrorState(title, message) {
    this.hideLoadingState();
    
    // Update auth status card
    this.elements.authStatusCard.className = 'strava-auth-card error';
    this.elements.statusSpinner.style.display = 'none';
    this.elements.statusIcon.style.display = 'block';
    this.elements.statusIcon.innerHTML = '⚠️';
    this.elements.authStatusTitle.textContent = title;
    this.elements.authStatusMessage.textContent = message;
    
    // Show error message
    this.elements.errorMessage.style.display = 'block';
    this.elements.errorText.textContent = message;
    
    // Update buttons
    this.elements.connectStravaBtn.style.display = 'none';
    this.elements.continueToActivitiesBtn.style.display = 'none';
    this.elements.retryConnectionBtn.style.display = 'inline-block';
  }

  showLoadingState(message) {
    this.state.loading = true;
    this.elements.loadingOverlay.style.display = 'flex';
    this.elements.loadingMessage.textContent = message;
    
    // Update auth status card
    this.elements.statusSpinner.style.display = 'block';
    this.elements.statusIcon.style.display = 'none';
    this.elements.authStatusTitle.textContent = 'Please wait...';
    this.elements.authStatusMessage.textContent = message;
  }

  hideLoadingState() {
    this.state.loading = false;
    this.elements.loadingOverlay.style.display = 'none';
  }

  hideErrorState() {
    this.elements.errorMessage.style.display = 'none';
  }

  updateProgressSteps(activeStep) {
    const steps = ['step-connect', 'step-activities', 'step-customize', 'step-order'];
    steps.forEach((stepId, index) => {
      const element = document.getElementById(stepId);
      if (element) {
        element.className = 'progress-step';
        if (index < activeStep) {
          element.className += ' completed';
        } else if (index === activeStep) {
          element.className += ' active';
        }
      }
    });
  }

  // State management for simplified UI
  showConnectState() {
    this.elements.loginActions.style.display = 'block';
    this.elements.successMessage.style.display = 'none';
    this.elements.loadingState.style.display = 'none';
  }

  showSuccessState(athleteName) {
    this.elements.loginActions.style.display = 'none';
    this.elements.successMessage.style.display = 'block';
    this.elements.loadingState.style.display = 'none';
    
    // Update success message with athlete name if available
    const successContent = this.elements.successMessage.querySelector('.success-content h3');
    if (athleteName && successContent) {
      successContent.textContent = `Welcome back, ${athleteName}!`;
    }
    
    // Update the continue button text to show countdown
    const continueBtn = this.elements.continueToActivitiesBtn;
    if (continueBtn) {
      let countdown = 2;
      continueBtn.textContent = `Redirecting to Activities (${countdown}s)`;
      continueBtn.disabled = true;
      
      const countdownInterval = setInterval(() => {
        countdown--;
        if (countdown > 0) {
          continueBtn.textContent = `Redirecting to Activities (${countdown}s)`;
        } else {
          clearInterval(countdownInterval);
          continueBtn.textContent = 'Redirecting...';
        }
      }, 1000);
    }
  }

  showLoadingState() {
    this.elements.loginActions.style.display = 'none';
    this.elements.successMessage.style.display = 'none';
    this.elements.loadingState.style.display = 'block';
  }

  connectStrava() {
    this.showLoadingState();
    setTimeout(() => {
      this.api.redirectToAuth();
    }, 500);
  }

  continueToActivities() {
    window.location.href = '/pages/strava-activities';
  }
}

/**
 * Activity Selector Page Controller
 */
class ActivitySelector {
  constructor(options = {}) {
    this.api = new StravaApiClient();
    this.options = {
      activitiesPerPage: 12,
      showActivityStats: true,
      ...options
    };
    
    this.elements = this.getElements();
    this.state = {
      activities: [],
      filteredActivities: [],
      selectedActivity: null,
      loading: false,
      loadingMore: false,
      currentPage: 1,
      nextPage: 2,
      hasMoreActivities: true,
      totalActivitiesLoaded: 0,
      filters: {
        search: '',
        type: '',
        dateRange: ''
      }
    };
    
    this.bindEvents();
  }

  getElements() {
    return {
      // Header elements
      userInfoBar: document.getElementById('user-info-bar'),
      userNameDisplay: document.getElementById('user-name-display'),
      logoutBtn: document.getElementById('logout-btn'),
      
      // Filter elements
      activitySearch: document.getElementById('activity-search'),
      activityTypeFilter: document.getElementById('activity-type-filter'),
      dateRangeFilter: document.getElementById('date-range-filter'),
      clearFiltersBtn: document.getElementById('clear-filters-btn'),
      
      // Activity display elements
      activitiesLoading: document.getElementById('activities-loading'),
      activitiesGrid: document.getElementById('activities-grid'),
      activitiesEmpty: document.getElementById('activities-empty'),
      activitiesError: document.getElementById('activities-error'),
      activitiesErrorMessage: document.getElementById('activities-error-message'),
      retryActivitiesBtn: document.getElementById('retry-activities-btn'),
      
      // Pagination
      activitiesPagination: document.getElementById('activities-pagination'),
      loadMoreBtn: document.getElementById('load-more-btn'),
      activitiesCount: document.getElementById('activities-count'),
      paginationStatus: document.getElementById('pagination-status'),
      
      // Selection elements
      selectionInfo: document.getElementById('selection-info'),
      selectedActivityName: document.getElementById('selected-activity-name'),
      proceedToMapBtn: document.getElementById('proceed-to-map-btn'),
      clearSelectionBtn: document.getElementById('clear-selection-btn')
    };
  }

  bindEvents() {
    // Filter events
    if (this.elements.activitySearch) {
      this.elements.activitySearch.addEventListener('input', (e) => this.handleSearch(e.target.value));
    }
    
    if (this.elements.activityTypeFilter) {
      this.elements.activityTypeFilter.addEventListener('change', (e) => this.handleTypeFilter(e.target.value));
    }
    
    if (this.elements.dateRangeFilter) {
      this.elements.dateRangeFilter.addEventListener('change', (e) => this.handleDateFilter(e.target.value));
    }
    
    if (this.elements.clearFiltersBtn) {
      this.elements.clearFiltersBtn.addEventListener('click', () => this.clearFilters());
    }
    
    // Action events
    if (this.elements.logoutBtn) {
      this.elements.logoutBtn.addEventListener('click', () => this.handleLogout());
    }
    
    if (this.elements.retryActivitiesBtn) {
      this.elements.retryActivitiesBtn.addEventListener('click', () => this.loadActivities());
    }
    
    if (this.elements.loadMoreBtn) {
      this.elements.loadMoreBtn.addEventListener('click', () => this.loadMoreActivities());
    }
    
    if (this.elements.proceedToMapBtn) {
      this.elements.proceedToMapBtn.addEventListener('click', () => this.proceedToMap());
    }
    
    if (this.elements.clearSelectionBtn) {
      this.elements.clearSelectionBtn.addEventListener('click', () => this.clearSelection());
    }
  }

  async init() {
    console.log('ActivitySelector: Initializing...');
    
    // Debug element availability
    console.log('🔍 Element check:', {
      activitiesPagination: !!this.elements.activitiesPagination,
      loadMoreBtn: !!this.elements.loadMoreBtn,
      activitiesCount: !!this.elements.activitiesCount,
      paginationStatus: !!this.elements.paginationStatus
    });
    
    // Check authentication first
    try {
      const statusData = await this.api.getIntegrationStatus();
      
      if (!statusData.success || !statusData.status.isAuthenticated) {
        // Redirect to login if not authenticated
        window.location.href = '/pages/strava-login';
        return;
      }
      
      // Update user info
      this.updateUserInfo(statusData.status);
      
      // Load activities
      await this.loadActivities();
      
    } catch (error) {
      console.error('Initialization failed:', error);
      this.showErrorState('Authentication check failed', error.message);
    }
  }

  updateUserInfo(status) {
    this.elements.userInfoBar.style.display = 'flex';
    this.elements.userNameDisplay.textContent = status.userDisplayName || 'Athlete';
  }

  async loadActivities() {
    try {
      this.showLoadingState();
      
      // Reset state for fresh load
      this.state.activities = [];
      this.state.currentPage = 1;
      this.state.nextPage = 2;
      this.state.hasMoreActivities = true;
      this.state.totalActivitiesLoaded = 0;
      
      const params = {
        page: 1,
        per_page: 30, // Standard Strava API limit
        load_all: false // Start with just first page
      };
      
      // Apply current filters to initial load
      this.addFiltersToParams(params);
      
      const response = await this.api.getActivities(params);
      
      if (response.success && response.activities) {
        this.state.activities = response.activities;
        this.state.totalActivitiesLoaded = response.activities.length;
        
        // Update pagination state from response
        if (response.pagination) {
          this.state.hasMoreActivities = response.pagination.has_more_activities || false;
          this.state.nextPage = this.state.hasMoreActivities ? 2 : null;
          console.log('📊 Pagination state from server:', response.pagination);
        }
        
        this.applyFilters();
        this.renderActivities();
        
        console.log(`🚀 Loaded ${this.state.activities.length} activities (hasMore: ${this.state.hasMoreActivities})`);
        console.log('🔍 Current state:', {
          activities: this.state.activities.length,
          totalLoaded: this.state.totalActivitiesLoaded,
          hasMore: this.state.hasMoreActivities,
          nextPage: this.state.nextPage
        });
      } else {
        throw new Error('Invalid activities response');
      }
      
    } catch (error) {
      console.error('Failed to load activities:', error);
      this.showErrorState('Unable to load activities', error.message);
    }
  }

  /**
   * Add current filters to API parameters
   */
  addFiltersToParams(params) {
    if (this.state.filters.type) {
      params.activity_types = this.state.filters.type;
    }
    
    if (this.state.filters.dateRange) {
      const daysAgo = parseInt(this.state.filters.dateRange);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
      params.after = Math.floor(cutoffDate.getTime() / 1000);
    }
    
    if (this.state.filters.search) {
      params.search_name = this.state.filters.search;
    }
  }

  applyFilters() {
    let filtered = [...this.state.activities];
    
    // Search filter
    if (this.state.filters.search) {
      const searchTerm = this.state.filters.search.toLowerCase();
      filtered = filtered.filter(activity => 
        activity.name.toLowerCase().includes(searchTerm)
      );
    }
    
    // Type filter
    if (this.state.filters.type) {
      filtered = filtered.filter(activity => 
        activity.type === this.state.filters.type || activity.sport_type === this.state.filters.type
      );
    }
    
    // Date range filter
    if (this.state.filters.dateRange) {
      const daysAgo = parseInt(this.state.filters.dateRange);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
      
      filtered = filtered.filter(activity => 
        new Date(activity.start_date) >= cutoffDate
      );
    }
    
    this.state.filteredActivities = filtered;
  }

  renderActivities() {
    const container = this.elements.activitiesGrid;
    container.innerHTML = '';
    
    if (this.state.filteredActivities.length === 0) {
      this.showEmptyState();
      return;
    }
    
    this.hideAllStates();
    container.style.display = 'grid';
    
    this.state.filteredActivities.slice(0, this.options.activitiesPerPage).forEach(activity => {
      const card = this.createActivityCard(activity);
      container.appendChild(card);
    });
    
    this.updatePagination();
  }

  createActivityCard(activity) {
    const card = document.createElement('div');
    card.className = 'activity-card';
    card.dataset.activityId = activity.id;
    
    // Format activity data
    const distance = activity.distance ? (activity.distance / 1000).toFixed(1) : '0';
    const duration = this.formatDuration(activity.moving_time);
    const date = new Date(activity.start_date_local).toLocaleDateString();
    const type = activity.sport_type || activity.type;
    
    card.innerHTML = `
      <div class="activity-card-header">
        <div class="activity-type">${this.getActivityIcon(type)} ${type}</div>
        <div class="activity-date">${date}</div>
      </div>
      
      <div class="activity-card-content">
        <h3 class="activity-name">${activity.name}</h3>
        
        ${this.options.showActivityStats ? `
          <div class="activity-stats">
            <div class="stat">
              <span class="stat-value">${distance}</span>
              <span class="stat-label">km</span>
            </div>
            <div class="stat">
              <span class="stat-value">${duration}</span>
              <span class="stat-label">time</span>
            </div>
            ${activity.total_elevation_gain ? `
              <div class="stat">
                <span class="stat-value">${Math.round(activity.total_elevation_gain)}</span>
                <span class="stat-label">m elev</span>
              </div>
            ` : ''}
          </div>
        ` : ''}
        
        ${activity.map && activity.map.summary_polyline ? `
          <div class="activity-preview-map" data-polyline="${activity.map.summary_polyline}">
            <div class="map-placeholder">Route Preview</div>
          </div>
        ` : ''}
      </div>
      
      <div class="activity-card-actions">
        <button type="button" class="strava-btn strava-btn-primary activity-select-btn" 
                data-activity-id="${activity.id}">
          Select for Map
        </button>
      </div>
    `;
    
    // Add click event to select button
    const selectBtn = card.querySelector('.activity-select-btn');
    selectBtn.addEventListener('click', () => this.selectActivity(activity));
    
    return card;
  }

  getActivityIcon(type) {
    const icons = {
      'Ride': '🚴',
      'VirtualRide': '🚴',
      'EBikeRide': '🚴',
      'Run': '🏃',
      'Walk': '🚶',
      'Hike': '🥾',
      'Swim': '🏊'
    };
    return icons[type] || '🏃';
  }

  formatDuration(seconds) {
    if (!seconds) return '0:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
    }
  }

  selectActivity(activity) {
    this.state.selectedActivity = activity;
    
    // Update UI
    this.elements.selectionInfo.style.display = 'block';
    this.elements.selectedActivityName.textContent = activity.name;
    
    // Scroll to selection info
    this.elements.selectionInfo.scrollIntoView({ behavior: 'smooth' });
    
    console.log('Activity selected:', activity);
  }

  clearSelection() {
    this.state.selectedActivity = null;
    this.elements.selectionInfo.style.display = 'none';
  }

  proceedToMap() {
    if (!this.state.selectedActivity) return;
    
    // Store selected activity in sessionStorage for the next page
    sessionStorage.setItem('selectedActivity', JSON.stringify(this.state.selectedActivity));
    
    // Navigate to map customization page (to be created)
    window.location.href = '/pages/map-customizer';
  }

  // Filter handlers
  handleSearch(value) {
    this.state.filters.search = value;
    this.reloadWithFilters();
  }

  handleTypeFilter(value) {
    this.state.filters.type = value;
    this.reloadWithFilters();
  }

  handleDateFilter(value) {
    this.state.filters.dateRange = value;
    this.reloadWithFilters();
  }

  clearFilters() {
    this.state.filters = { search: '', type: '', dateRange: '' };
    this.elements.activitySearch.value = '';
    this.elements.activityTypeFilter.value = '';
    this.elements.dateRangeFilter.value = '';
    this.reloadWithFilters();
  }

  /**
   * Reload activities with current filters applied
   */
  async reloadWithFilters() {
    // Reset pagination state and reload
    this.state.activities = [];
    this.state.currentPage = 1;
    this.state.nextPage = 2;
    this.state.hasMoreActivities = true;
    this.state.totalActivitiesLoaded = 0;
    
    await this.loadActivities();
  }

  // State management
  showLoadingState() {
    this.hideAllStates();
    this.elements.activitiesLoading.style.display = 'block';
  }

  showErrorState(title, message) {
    this.hideAllStates();
    this.elements.activitiesError.style.display = 'block';
    this.elements.activitiesErrorMessage.textContent = message;
  }

  showEmptyState() {
    this.hideAllStates();
    this.elements.activitiesEmpty.style.display = 'block';
  }

  hideAllStates() {
    this.elements.activitiesLoading.style.display = 'none';
    this.elements.activitiesGrid.style.display = 'none';
    this.elements.activitiesEmpty.style.display = 'none';
    this.elements.activitiesError.style.display = 'none';
  }

  updatePagination() {
    // Update activity count display
    if (this.elements.activitiesCount) {
      this.elements.activitiesCount.textContent = this.state.totalActivitiesLoaded;
    }
    
    // Update pagination status
    if (this.elements.paginationStatus) {
      if (this.state.hasMoreActivities) {
        this.elements.paginationStatus.textContent = '(more available)';
      } else if (this.state.totalActivitiesLoaded > 0) {
        this.elements.paginationStatus.textContent = '(all loaded)';
      } else {
        this.elements.paginationStatus.textContent = '';
      }
    }
    
    // Show pagination if we have loaded activities (regardless of hasMoreActivities)
    // This ensures the user always sees feedback about loaded activities
    const showPagination = this.state.totalActivitiesLoaded > 0;
    
    console.log(`📄 Pagination: ${showPagination ? 'SHOWN' : 'HIDDEN'} (${this.state.totalActivitiesLoaded} activities, hasMore: ${this.state.hasMoreActivities})`);
    
    if (this.elements.activitiesPagination) {
      if (showPagination) {
        this.elements.activitiesPagination.style.display = 'flex'; // Use flex to match CSS
        this.updateLoadMoreButtonState();
      } else {
        this.elements.activitiesPagination.style.display = 'none';
      }
    } else {
      console.error('❌ activitiesPagination element not found!');
    }
  }

  async loadMoreActivities() {
    // Check if we can load more
    if (!this.state.hasMoreActivities || this.state.loadingMore || !this.state.nextPage) {
      console.log('Cannot load more activities:', {
        hasMore: this.state.hasMoreActivities,
        loading: this.state.loadingMore,
        nextPage: this.state.nextPage
      });
      return;
    }

    try {
      this.state.loadingMore = true;
      this.updateLoadMoreButton('Loading more activities...');
      
      const params = {
        page: this.state.nextPage,
        per_page: 30
      };
      
      // Apply current filters to load more request
      this.addFiltersToParams(params);
      
      console.log(`Loading more activities: page ${this.state.nextPage}`);
      
      const response = await this.api.loadMoreActivities(params);
      
      if (response.success && response.activities) {
        // Append new activities to existing list
        this.state.activities = this.state.activities.concat(response.activities);
        this.state.totalActivitiesLoaded += response.activities.length;
        this.state.currentPage = this.state.nextPage;
        
        // Update pagination state
        if (response.pagination) {
          this.state.hasMoreActivities = response.pagination.has_more_activities || false;
          this.state.nextPage = response.pagination.next_page;
        }
        
        // Reapply filters and re-render
        this.applyFilters();
        this.renderActivities();
        
        console.log(`Loaded ${response.activities.length} more activities. Total: ${this.state.activities.length} (hasMore: ${this.state.hasMoreActivities})`);
        
      } else {
        throw new Error('Invalid load more response');
      }
      
    } catch (error) {
      console.error('Failed to load more activities:', error);
      this.updateLoadMoreButton('Error loading activities. Try again.');
    } finally {
      this.state.loadingMore = false;
      this.updateLoadMoreButtonState();
    }
  }

  /**
   * Update load more button text and state
   */
  updateLoadMoreButton(text) {
    if (this.elements.loadMoreBtn) {
      this.elements.loadMoreBtn.textContent = text;
    }
  }

  /**
   * Update load more button based on current state
   */
  updateLoadMoreButtonState() {
    if (!this.elements.loadMoreBtn) {
      console.error('❌ loadMoreBtn element not found!');
      return;
    }
    
    console.log(`🔘 Button: ${this.state.loadingMore ? 'LOADING' : this.state.hasMoreActivities ? 'READY' : 'DONE'}`);
    
    if (this.state.loadingMore) {
      this.elements.loadMoreBtn.textContent = 'Loading...';
      this.elements.loadMoreBtn.disabled = true;
    } else if (!this.state.hasMoreActivities) {
      this.elements.loadMoreBtn.textContent = 'All activities loaded';
      this.elements.loadMoreBtn.disabled = true;
    } else {
      this.elements.loadMoreBtn.textContent = 'Load More Activities';
      this.elements.loadMoreBtn.disabled = false;
    }
    
    // Ensure button is visible
    this.elements.loadMoreBtn.style.display = 'inline-flex';
  }

  async handleLogout() {
    try {
      await this.api.logout();
      window.location.href = '/pages/strava-login';
    } catch (error) {
      console.error('Logout failed:', error);
      alert('Logout failed. Please try again.');
    }
  }
}

// Debug function for Shopify console testing
window.debugStravaIntegration = async function() {
  console.log('🔍 Starting Strava Integration Debug...');
  
  const api = new StravaApiClient();
  const results = {
    backendHealth: null,
    corsTest: null,
    mapboxConfig: null,
    authStatus: null,
    errors: []
  };
  
  // Test 1: Backend Health
  try {
    console.log('🏥 Testing backend health...');
    results.backendHealth = await fetch(`${api.baseUrl}/health`, {
      headers: { 'ngrok-skip-browser-warning': 'true' }
    }).then(r => r.json());
    console.log('✅ Backend health:', results.backendHealth);
  } catch (error) {
    console.error('❌ Backend health failed:', error);
    results.errors.push(`Backend health: ${error.message}`);
  }
  
  // Test 2: CORS Test
  try {
    console.log('🌐 Testing CORS...');
    results.corsTest = await api.apiRequest('/api/mapbox-config');
    console.log('✅ CORS test passed:', results.corsTest);
  } catch (error) {
    console.error('❌ CORS test failed:', error);
    results.errors.push(`CORS: ${error.message}`);
  }
  
  // Test 3: Mapbox Config
  try {
    console.log('🗺️ Testing Mapbox config...');
    results.mapboxConfig = await api.apiRequest('/api/mapbox-config');
    console.log('✅ Mapbox config loaded:', results.mapboxConfig);
  } catch (error) {
    console.error('❌ Mapbox config failed:', error);
    results.errors.push(`Mapbox config: ${error.message}`);
  }
  
  // Test 4: Auth Status
  try {
    console.log('🔐 Testing auth status...');
    results.authStatus = await api.apiRequest('/auth/status');
    console.log('✅ Auth status:', results.authStatus);
  } catch (error) {
    console.error('⚠️ Auth status (expected to fail if not logged in):', error);
    results.errors.push(`Auth status: ${error.message}`);
  }
  
  // Summary
  console.log('📊 Debug Summary:', results);
  
  if (results.errors.length === 0) {
    console.log('🎉 All tests passed! Integration should be working.');
  } else {
    console.log('⚠️ Some tests failed. Check the errors above.');
  }
  
  return results;
};

// Export classes for global use
window.StravaApiClient = StravaApiClient;
window.StravaLogin = StravaLogin;
window.ActivitySelector = ActivitySelector;

// Debug function for pagination testing
window.debugActivityPagination = function() {
  console.log('🧪 Testing Activity Pagination...');
  
  const paginationElement = document.getElementById('activities-pagination');
  const loadMoreBtn = document.getElementById('load-more-btn');
  const activitiesCount = document.getElementById('activities-count');
  const paginationStatus = document.getElementById('pagination-status');
  
  console.log('📋 Element Check:', {
    paginationElement: !!paginationElement,
    loadMoreBtn: !!loadMoreBtn,
    activitiesCount: !!activitiesCount,
    paginationStatus: !!paginationStatus
  });
  
  if (paginationElement) {
    console.log('🔍 Current pagination styles:', {
      display: paginationElement.style.display,
      computedDisplay: window.getComputedStyle(paginationElement).display,
      visibility: window.getComputedStyle(paginationElement).visibility
    });
    
    // Force show pagination for testing
    paginationElement.style.display = 'flex';
    if (activitiesCount) activitiesCount.textContent = '25';
    if (paginationStatus) paginationStatus.textContent = '(test mode)';
    if (loadMoreBtn) {
      loadMoreBtn.textContent = 'Test Load More';
      loadMoreBtn.style.display = 'inline-flex';
      loadMoreBtn.disabled = false;
    }
    
    console.log('✅ Pagination manually shown for testing');
  } else {
    console.error('❌ Pagination element not found in DOM');
  }
};