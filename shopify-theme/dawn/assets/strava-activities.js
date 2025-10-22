/**
 * Strava Activities Manager
 * Handles fetching, displaying, and selecting Strava activities
 */
class StravaActivities {
  constructor(options = {}) {
    this.options = {
      activitiesPerPage: options.activitiesPerPage || 12,
      baseUrl: 'https://boss-hog-freely.ngrok-free.app'
    };

    // State management
    this.currentPage = 1;
    this.totalPages = 1;
    this.activities = [];
    this.filteredActivities = [];
    this.isLoading = false;
    this.isLoadingMore = false;
    this.hasMoreActivities = true;
    this.totalActivitiesLoaded = 0;
    this.searchTerm = '';
    this.currentFilters = {
      type: '',
      sortBy: 'start_date',
      sortOrder: 'desc'
    };
    
    // Simple session token
    this.sessionToken = null;

    // DOM elements
    this.elements = {
      authStatus: document.getElementById('auth-status'),
      authStatusText: document.getElementById('auth-status-text'),
      loading: document.getElementById('activities-loading'),
      error: document.getElementById('activities-error'),
      empty: document.getElementById('activities-empty'),
      grid: document.getElementById('activities-grid'),
      pagination: document.getElementById('activities-pagination'),
      loadMoreBtn: document.getElementById('load-more-btn'),
      activitiesCount: document.getElementById('activities-count'),
      paginationStatus: document.getElementById('pagination-status'),
      retryButton: document.getElementById('retry-button'),
      errorTitle: document.getElementById('error-title'),
      errorMessage: document.getElementById('error-message'),
      // New statistics dashboard elements
      totalActivities: document.getElementById('total-activities'),
      totalDistance: document.getElementById('total-distance'),
      totalElevation: document.getElementById('total-elevation'),
      totalTime: document.getElementById('total-time'),
      // User connection status
      userConnectionStatus: document.getElementById('user-connection-status'),
      userName: document.getElementById('user-name')
    };

    this.bindEvents();
  }

  /**
   * Initialize the activities manager
   */
  async init() {
    console.log('Initializing Strava Activities Manager');
    
    // Validate DOM elements are available
    this.validateDOMElements();
    
    // Initialize authentication first
    this.initializeAuthentication();
    
    await this.checkAuthentication();
  }

  /**
   * Validate required DOM elements exist
   */
  validateDOMElements() {
    console.log('🔍 [DEBUG] Validating DOM elements...');
    
    const requiredElements = [
      'grid', 'loading', 'error', 'empty', 'pagination', 
      'authStatus', 'authStatusText', 'loadMoreBtn'
    ];
    
    requiredElements.forEach(elementKey => {
      const element = this.elements[elementKey];
      const exists = !!element;
      console.log(`🔍 [DEBUG] ${elementKey}:`, exists, exists ? `#${element.id}` : 'NOT FOUND');
      
      if (!exists) {
        console.warn(`⚠️ [WARNING] Required element '${elementKey}' not found in DOM`);
      }
    });
    
    // Check grid element specifically
    if (this.elements.grid) {
      const gridStyles = window.getComputedStyle(this.elements.grid);
      console.log('🔍 [DEBUG] Activities grid initial state:', {
        id: this.elements.grid.id,
        display: gridStyles.display,
        visibility: gridStyles.visibility,
        hasHiddenClass: this.elements.grid.classList.contains('hidden')
      });
    }
  }

  /**
   * Initialize authentication - use AuthUtils for token management
   */
  initializeAuthentication() {
    console.log('🔍 [AuthUtils] Initializing authentication...');
    console.log('🔍 [AuthUtils] AuthUtils available:', !!window.AuthUtils);
    
    // First, check for token in URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    
    if (urlToken) {
      console.log('🔍 [AuthUtils] Token found in URL, storing with AuthUtils');
      // Store token using AuthUtils if available
      if (window.AuthUtils) {
        window.AuthUtils.storeToken(urlToken);
        this.sessionToken = urlToken;
      } else {
        // Fallback to direct assignment
        this.sessionToken = urlToken;
      }
      
      // Clean up the URL by removing the token parameter
      if (history.replaceState) {
        urlParams.delete('token');
        const cleanUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
        history.replaceState(null, '', cleanUrl);
      }
    } else if (window.AuthUtils) {
      // Try to get token from AuthUtils
      const authToken = window.AuthUtils.getToken();
      if (authToken) {
        console.log('🔍 [AuthUtils] Token retrieved from AuthUtils');
        this.sessionToken = authToken;
      } else {
        console.log('🔍 [AuthUtils] No token found in AuthUtils');
      }
    } else {
      console.log('🔍 [AuthUtils] AuthUtils not available and no URL token');
    }
    
    console.log('🔍 [AuthUtils] Final sessionToken status:', !!this.sessionToken);
  }

  /**
   * Create fetch headers with authentication
   * Note: Avoid custom headers for better CORS compatibility
   */
  getAuthHeaders() {
    const headers = {
      'ngrok-skip-browser-warning': 'true'
    };
    
    // Only use custom headers as fallback - prefer query parameters for CORS compatibility
    // if (this.sessionToken) {
    //   headers['X-Session-Token'] = this.sessionToken;
    // }
    
    return headers;
  }

  /**
   * Create API URL with token parameter if needed
   */
  getApiUrl(endpoint, params = {}) {
    if (this.sessionToken && !params.token) {
      params.token = this.sessionToken;
    }
    
    const queryString = new URLSearchParams(params).toString();
    const url = `${this.options.baseUrl}${endpoint}`;
    
    return queryString ? `${url}?${queryString}` : url;
  }

  /**
   * Check if user is authenticated with Strava
   */
  async checkAuthentication() {
    try {
      this.showElement(this.elements.authStatus);
      this.elements.authStatusText.textContent = 'Checking authentication...';
      
      const statusUrl = this.getApiUrl('/auth/status');
      console.log('Checking authentication at:', statusUrl);
      
      const response = await fetch(statusUrl, {
        credentials: 'include',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        console.error('Auth status request failed:', response.status, response.statusText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const authStatus = await response.json();
      console.log('Authentication response:', authStatus);

      if (authStatus.authenticated) {
        this.hideElement(this.elements.authStatus);
        
        // Update user status if user info is available
        if (authStatus.user) {
          this.updateUserStatus(authStatus.user);
        }
        
        await this.loadActivities();
      } else {
        console.log('Not authenticated:', authStatus.message);
        this.showAuthenticationError(authStatus.message);
      }
    } catch (error) {
      console.error('Authentication check failed:', error);
      
      // Check if this is a CORS error
      if (error.message.includes('CORS') || error.name === 'TypeError') {
        this.showAuthenticationError('Connection blocked by browser security. Please try connecting directly.');
      } else {
        this.showAuthenticationError(error.message);
      }
    }
  }

  /**
   * Show authentication error and redirect options
   */
  showAuthenticationError(customMessage = null) {
    this.hideAllStates();
    this.showElement(this.elements.error);
    this.elements.errorTitle.textContent = 'Authentication Required';
    this.elements.errorMessage.textContent = customMessage || 'Please connect your Strava account to view your activities.';
  }

  /**
   * Load activities from the backend API
   */
  async loadActivities(isLoadMore = false) {
    if (this.isLoading || (isLoadMore && this.isLoadingMore)) return;
    
    try {
      if (isLoadMore) {
        this.isLoadingMore = true;
        this.updateLoadMoreButton();
      } else {
        this.isLoading = true;
        this.currentPage = 1;
        this.activities = [];
        this.totalActivitiesLoaded = 0;
        this.hasMoreActivities = true;
        this.hideAllStates();
        this.showElement(this.elements.loading);
      }

      const apiParams = {
        page: this.currentPage,
        per_page: 30, // Standard Strava API limit
        ...(this.currentFilters.type && { activity_types: this.currentFilters.type }),
        ...(this.searchTerm && { search_name: this.searchTerm }),
        sort_by: this.currentFilters.sortBy,
        sort_order: this.currentFilters.sortOrder
      };

      const activitiesUrl = this.getApiUrl('/api/strava/activities', apiParams);
      console.log('🔍 [DEBUG] Making API request to:', activitiesUrl);
      console.log('🔍 [DEBUG] Request params:', apiParams);

      const response = await fetch(activitiesUrl, {
        credentials: 'include',
        headers: this.getAuthHeaders()
      });

      console.log('🔍 [DEBUG] Response status:', response.status, response.statusText);
      console.log('🔍 [DEBUG] Response headers:', Object.fromEntries(response.headers));

      if (!response.ok) {
        if (response.status === 401) {
          console.log('401 Authentication failed, showing auth error');
          this.showAuthenticationError();
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      let data;
      try {
        data = await response.json();
        console.log('🔍 [DEBUG] Raw API response:', JSON.stringify(data, null, 2));
      } catch (jsonError) {
        console.error('❌ [ERROR] Failed to parse JSON response:', jsonError);
        throw new Error('Invalid response from server: ' + jsonError.message);
      }
      
      // Handle case where response is successful but data format is unexpected
      if (!data) {
        console.error('❌ [ERROR] Response data is null or undefined');
        throw new Error('No data received from server');
      }
      
      // Check for success field - but also handle responses without it
      const hasSuccessField = data.hasOwnProperty('success');
      const isSuccess = hasSuccessField ? data.success : (data.activities !== undefined);
      
      console.log('🔍 [DEBUG] Response analysis:', {
        hasSuccessField,
        successValue: data.success,
        hasActivitiesField: data.hasOwnProperty('activities'),
        isSuccess
      });
      
      if (isSuccess) {
        const newActivities = data.activities || [];
        console.log('🔍 [DEBUG] data.success is true');
        console.log('🔍 [DEBUG] newActivities array:', newActivities);
        console.log('🔍 [DEBUG] newActivities.length:', newActivities.length);
        
        if (isLoadMore) {
          // Append new activities to existing ones
          console.log('🔍 [DEBUG] Load more mode - appending to existing activities');
          this.activities = this.activities.concat(newActivities);
        } else {
          // Replace activities for new search/filter
          console.log('🔍 [DEBUG] Fresh load mode - replacing activities');
          this.activities = newActivities;
        }
        
        this.totalActivitiesLoaded = this.activities.length;
        console.log('🔍 [DEBUG] this.activities.length after processing:', this.activities.length);
        
        // Update pagination state from backend response
        if (data.pagination) {
          this.hasMoreActivities = data.pagination.has_more_activities || false;
          console.log('🔍 [DEBUG] Pagination data found:', data.pagination);
        } else {
          // Fallback logic: if we got fewer activities than requested, likely no more
          this.hasMoreActivities = newActivities.length >= 30;
          console.log('🔍 [DEBUG] No pagination data, using fallback logic');
        }
        
        this.filteredActivities = [...this.activities];
        console.log('🔍 [DEBUG] this.filteredActivities.length:', this.filteredActivities.length);
        
        if (this.activities.length === 0) {
          console.log('🔍 [DEBUG] No activities found - showing empty state');
          this.showEmptyState();
        } else {
          console.log('🔍 [DEBUG] Activities found - rendering activities grid');
          this.renderActivities();
          this.updatePagination();
        }
        
        console.log(`🚀 Loaded ${newActivities.length} activities. Total: ${this.totalActivitiesLoaded} (hasMore: ${this.hasMoreActivities})`);
      } else {
        console.log('🔍 [DEBUG] Response indicates failure');
        console.log('🔍 [DEBUG] data.error:', data.error);
        console.log('🔍 [DEBUG] data.message:', data.message);
        
        // Handle specific error cases
        if (data.error === 'Invalid cross-domain token' || data.error === 'Token expired') {
          console.log('🔍 [DEBUG] Authentication error detected, redirecting to auth');
          this.showAuthenticationError(data.message);
          return;
        }
        
        throw new Error(data.message || data.error || 'Failed to load activities - unknown error');
      }
    } catch (error) {
      console.error('Error loading activities:', error);
      this.showError('Failed to load activities', error.message);
    } finally {
      this.isLoading = false;
      this.isLoadingMore = false;
      this.updateLoadMoreButton();
    }
  }

  /**
   * Load more activities (for pagination)
   */
  async loadMoreActivities() {
    if (!this.hasMoreActivities || this.isLoadingMore) {
      console.log('Cannot load more activities:', {
        hasMore: this.hasMoreActivities,
        loading: this.isLoadingMore
      });
      return;
    }

    this.currentPage++;
    await this.loadActivities(true);
  }

  /**
   * Render activities grid
   */
  renderActivities() {
    console.log('🔍 [DEBUG] renderActivities() called');
    console.log('🔍 [DEBUG] this.elements.grid exists:', !!this.elements.grid);
    console.log('🔍 [DEBUG] this.filteredActivities.length:', this.filteredActivities.length);
    
    // Validate DOM elements exist
    if (!this.elements.grid) {
      console.error('❌ [ERROR] Activities grid element not found!');
      return;
    }
    
    // Show all loaded activities (not paginated client-side)
    const cardHtml = this.filteredActivities.map(activity => {
      try {
        console.log('🔍 [DEBUG] Creating card for activity:', activity.id, activity.name);
        return this.createActivityCard(activity);
      } catch (cardError) {
        console.error('❌ [ERROR] Failed to create card for activity:', activity.id, cardError);
        // Return a basic error card instead of failing completely
        return `<div class="activity-card error-card">
          <div class="card-body">
            <p>Error loading activity: ${activity.name || activity.id}</p>
            <p class="text-muted">${cardError.message}</p>
          </div>
        </div>`;
      }
    }).join('');
    
    console.log('🔍 [DEBUG] Generated HTML length:', cardHtml.length);
    console.log('🔍 [DEBUG] Generated HTML preview:', cardHtml.substring(0, 200) + '...');
    
    this.elements.grid.innerHTML = cardHtml;
    
    console.log('🔍 [DEBUG] Grid innerHTML set, length:', this.elements.grid.innerHTML.length);

    this.hideAllStates();
    this.showElement(this.elements.grid);
    this.showElement(this.elements.pagination);
    
    console.log('🔍 [DEBUG] Grid element styles after show:', {
      display: this.elements.grid.style.display,
      visibility: window.getComputedStyle(this.elements.grid).visibility,
      hasHiddenClass: this.elements.grid.classList.contains('hidden')
    });

    // Update statistics dashboard
    this.updateStatistics();

    // Add click handlers for create poster buttons
    this.elements.grid.querySelectorAll('.create-poster-button').forEach(button => {
      console.log('🔧 [DEBUG] Adding click listener to button:', button, 'Activity ID:', button.dataset.activityId);
      
      // Add multiple event listeners to debug
      button.addEventListener('click', (e) => {
        console.log('🔧 [DEBUG] *** BUTTON CLICKED! ***', e.target, 'Activity ID:', button.dataset.activityId);
        console.log('🔧 [DEBUG] Event details:', e);
        e.preventDefault();
        e.stopPropagation();
        
        const activityId = button.dataset.activityId;
        const activity = this.activities.find(a => a.id.toString() === activityId);
        console.log('🔧 [DEBUG] Found activity:', activity);
        
        if (activity) {
          console.log('🔧 [DEBUG] Calling createMapForActivity...');
          this.createMapForActivity(activity);
        } else {
          console.error('🚨 [DEBUG] No activity found for ID:', activityId);
        }
      });
      
      // Add mousedown event to test if any events are firing
      button.addEventListener('mousedown', (e) => {
        console.log('🔧 [DEBUG] MOUSEDOWN detected on button:', button.dataset.activityId);
      });
      
      // Add mouseover event to test hover
      button.addEventListener('mouseover', (e) => {
        console.log('🔧 [DEBUG] MOUSEOVER detected on button:', button.dataset.activityId);
      });
    });
  }

  /**
   * Create HTML for activity card with clean design
   */
  createActivityCard(activity) {
    const date = new Date(activity.start_date_local);
    const formattedDate = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const distance = (activity.distance / 1000).toFixed(1); // Convert to km
    const duration = this.formatDuration(activity.moving_time);
    const elevation = Math.round(activity.total_elevation_gain || 0);
    const avgSpeed = activity.average_speed ? (activity.average_speed * 3.6).toFixed(1) : 'N/A'; // Convert m/s to km/h

    const isSelected = false;
    const routePath = this.generateMockRoutePath(activity.id);
    const routeColor = this.getRouteColor(activity.id);

    return `
      <div class="activity-card ${isSelected ? 'selected' : ''}" data-activity-id="${activity.id}">
        <!-- Activity Preview -->
        <div class="activity-card-preview">
          <!-- Mock route visualization -->
          <svg class="activity-route-svg" viewBox="0 0 300 200">
            <path
              d="${routePath}"
              class="activity-route-path"
              stroke="${routeColor}"
            />
          </svg>

          <!-- Activity type badge -->
          <div class="activity-type-badge">
            ${activity.sport_type || activity.type || 'Activity'}
          </div>

          <!-- GPS indicator -->
          ${activity.map && activity.map.summary_polyline ? `
            <div class="activity-gps-indicator">
              <svg class="activity-gps-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
          ` : ''}
        </div>

        <!-- Activity Details -->
        <div class="activity-card-details">
          <div class="activity-card-body">
            <h3 class="activity-name">${this.escapeHtml(activity.name || 'Unnamed Activity')}</h3>
            <div class="activity-meta">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              ${formattedDate}
              ${activity.location_city || activity.location_country ? `
                <span class="activity-meta-separator">•</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
                ${[activity.location_city, activity.location_state, activity.location_country].filter(Boolean).join(', ')}
              ` : ''}
            </div>

            <!-- Stats Grid -->
            <div class="activity-stats">
              <div class="activity-stat">
                <span class="stat-value">${distance} km</span>
                <span class="stat-label">Distance</span>
              </div>
              <div class="activity-stat">
                <span class="stat-value">${elevation} m</span>
                <span class="stat-label">Elevation</span>
              </div>
              <div class="activity-stat">
                <span class="stat-value">${duration}</span>
                <span class="stat-label">Time</span>
              </div>
              <div class="activity-stat">
                <span class="stat-value">${avgSpeed} km/h</span>
                <span class="stat-label">Avg Speed</span>
              </div>
            </div>

            <!-- Create Poster Button -->
            <button class="create-poster-button" data-activity-id="${activity.id}">
              CREATE POSTER
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="12,5 19,12 12,19"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Get SVG icon for activity type
   */
  getActivityIconSVG(type) {
    const icons = {
      'Ride': '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M5 18.89H8.54l1.57-7.78h-.01l2.14-.42 1.42 3.02h.01l1.93-.14c.48-.8 1.23-1.01 1.77-1.01C20.28 12.56 22 15.46 22 16.89S20.28 21.22 17.37 21.22c-2.52 0-4.55-2.04-4.55-4.56h-.01l-1.93.14-1.42-3.02h-.01l-2.14.42L5 18.89z"/></svg>',
      'Run': '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L9 8.3V13h2V9.6l-.2-.7z"/></svg>',
      'Walk': '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-1.5 3c-.8 0-1.5.7-1.5 1.5V13c0 .6.4 1.1 1 1.3l1.5.4v4.8h2v-6l-1.5-.4V9c.8 0 1.5-.7 1.5-1.5V6c0-.8-.7-1.5-1.5-1.5h-1.5c-.8 0-1.5.7-1.5 1.5v1.5c0 .8.7 1.5 1.5 1.5z"/></svg>',
      'Hike': '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM17.5 10.5c.8 0 1.5-.7 1.5-1.5s-.7-1.5-1.5-1.5-1.5.7-1.5 1.5.7 1.5 1.5 1.5zm-3.5 1L12 23h1.5l1.5-8.5L17 16v7h1.5V15l-2.5-2 .5-2.5c1.5 1.5 3.5 2.5 5.5 2.5V11c-1.5 0-2.5-.5-3.5-1.5L17 8c-.5-.5-1-1-1.5-1-.5 0-1 .5-1.5 1L12 10.5v2.5z"/></svg>'
    };
    return icons[type] || '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>';
  }

  /**
   * Get icon for activity type (emoji fallback)
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
   * Extract location from activity
   */
  extractLocation(activity) {
    // Try to extract location from various activity fields
    if (activity.location_city && activity.location_state) {
      return `${activity.location_city}, ${activity.location_state}`;
    } else if (activity.location_city) {
      return activity.location_city;
    } else if (activity.location_country) {
      return activity.location_country;
    } else if (activity.timezone) {
      // Extract city from timezone like "America/Los_Angeles"
      const parts = activity.timezone.split('/');
      if (parts.length > 1) {
        return parts[1].replace(/_/g, ' ');
      }
    }
    return 'Unknown Location';
  }

  /**
   * Generate mock route path for visualization
   */
  generateMockRoutePath(activityId) {
    // Use activity ID to create consistent but varied paths
    const seed = activityId % 1000;
    const startX = 20 + (seed % 20);
    const startY = 180 - (seed % 40);
    const midX = 60 + (seed % 50);
    const midY = 140 - (seed % 60);
    const endX = 120 + (seed % 40);
    const endY = 150 - (seed % 80);
    const finalX = 260 - (seed % 30);
    const finalY = 80 + (seed % 70);

    return `M${startX},${startY} Q${midX},${midY} ${endX},${endY} T${finalX},${finalY}`;
  }

  /**
   * Get route color based on activity ID
   */
  getRouteColor(activityId) {
    const colors = ['#ec4899', '#22d3ee', '#a855f7']; // pink, cyan, purple
    return colors[activityId % colors.length];
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
   * Select an activity
   */
  selectActivity(activity) {
    this.selectedActivity = activity;
    
    // Update card selection state
    this.elements.grid.querySelectorAll('.activity-card').forEach(card => {
      card.classList.remove('selected');
    });
    
    const selectedCard = this.elements.grid.querySelector(`[data-activity-id="${activity.id}"]`);
    if (selectedCard) {
      selectedCard.classList.add('selected');
    }
    
    // Show selected activity details
    this.renderSelectedActivity();
  }

  /**
   * Render selected activity details
   */
  renderSelectedActivity() {
    if (!this.selectedActivity) return;

    const activity = this.selectedActivity;
    const date = new Date(activity.start_date_local);
    const distance = (activity.distance / 1000).toFixed(2);
    const duration = this.formatDuration(activity.moving_time);
    const elevation = Math.round(activity.total_elevation_gain || 0);
    const avgSpeed = activity.average_speed ? (activity.average_speed * 3.6).toFixed(1) : 'N/A';

    document.getElementById('selected-activity-details').innerHTML = `
      <div class="selected-activity-info">
        <h4>${this.escapeHtml(activity.name)}</h4>
        <div class="selected-activity-meta">
          <span class="activity-type-badge activity-type-${(activity.type || 'Unknown').toLowerCase()}">
            ${this.getActivityIcon(activity.type)} ${activity.sport_type || activity.type}
          </span>
          <span class="activity-date">${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        
        <div class="selected-activity-stats">
          <div class="stat-group">
            <div class="stat">
              <span class="stat-label">Distance</span>
              <span class="stat-value">${distance} km</span>
            </div>
            <div class="stat">
              <span class="stat-label">Duration</span>
              <span class="stat-value">${duration}</span>
            </div>
          </div>
          <div class="stat-group">
            <div class="stat">
              <span class="stat-label">Elevation Gain</span>
              <span class="stat-value">${elevation} m</span>
            </div>
            <div class="stat">
              <span class="stat-label">Average Speed</span>
              <span class="stat-value">${avgSpeed} km/h</span>
            </div>
          </div>
        </div>
        
        ${activity.map && activity.map.summary_polyline ? 
          '<div class="map-availability success">✅ GPS route data available for map generation</div>' :
          '<div class="map-availability warning">⚠️ No GPS route data - map generation not available</div>'
        }
      </div>
    `;

    this.showElement(this.elements.selectedActivity);
    
    // Enable/disable create map button based on GPS data availability
    const hasGpsData = activity.map && activity.map.summary_polyline;
    this.elements.createMapButton.disabled = !hasGpsData;
    this.elements.createMapButton.textContent = hasGpsData ? 
      'Create Map for This Activity' : 
      'No GPS Data Available';
  }

  /**
   * Clear activity selection
   */
  clearSelection() {
    this.elements.grid.querySelectorAll('.activity-card').forEach(card => {
      card.classList.remove('selected');
    });
    this.hideElement(this.elements.selectedActivity);
  }

  /**
   * Update pagination controls
   */
  updatePagination() {
    // Update activity count display
    if (this.elements.activitiesCount) {
      this.elements.activitiesCount.textContent = this.totalActivitiesLoaded;
    }
    
    // Update pagination status
    if (this.elements.paginationStatus) {
      if (this.hasMoreActivities) {
        this.elements.paginationStatus.textContent = '(more available)';
      } else if (this.totalActivitiesLoaded > 0) {
        this.elements.paginationStatus.textContent = '(all loaded)';
      } else {
        this.elements.paginationStatus.textContent = '';
      }
    }
    
    this.updateLoadMoreButton();
  }

  /**
   * Update load more button state
   */
  updateLoadMoreButton() {
    if (!this.elements.loadMoreBtn) return;
    
    if (this.isLoadingMore) {
      this.elements.loadMoreBtn.textContent = 'Loading...';
      this.elements.loadMoreBtn.disabled = true;
    } else if (!this.hasMoreActivities) {
      this.elements.loadMoreBtn.textContent = 'All activities loaded';
      this.elements.loadMoreBtn.disabled = true;
    } else {
      this.elements.loadMoreBtn.textContent = 'Load More Activities';
      this.elements.loadMoreBtn.disabled = false;
    }
  }

  /**
   * Reset pagination state
   */
  resetPagination() {
    this.currentPage = 1;
    this.activities = [];
    this.totalActivitiesLoaded = 0;
    this.hasMoreActivities = true;
  }

  /**
   * Show error state
   */
  showError(title, message) {
    this.hideAllStates();
    this.showElement(this.elements.error);
    this.elements.errorTitle.textContent = title;
    this.elements.errorMessage.textContent = message;
  }

  /**
   * Show empty state
   */
  showEmptyState() {
    this.hideAllStates();
    this.showElement(this.elements.empty);
  }

  /**
   * Hide all state elements
   */
  hideAllStates() {
    [
      this.elements.loading,
      this.elements.error,
      this.elements.empty,
      this.elements.grid,
      this.elements.pagination
    ].forEach(element => {
      if (element) this.hideElement(element);
    });
  }

  /**
   * Show element
   */
  showElement(element) {
    if (element) {
      element.classList.remove('hidden');
    }
  }

  /**
   * Hide element
   */
  hideElement(element) {
    if (element) {
      element.classList.add('hidden');
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Bind event handlers
   */
  bindEvents() {
    // Load more functionality
    if (this.elements.loadMoreBtn) {
      this.elements.loadMoreBtn.addEventListener('click', () => {
        this.loadMoreActivities();
      });
    }

    // Retry functionality
    if (this.elements.retryButton) {
      this.elements.retryButton.addEventListener('click', () => {
        this.loadActivities();
      });
    }
  }

  /**
   * Create map for selected activity
   */
  createMapForActivity(activity) {
    console.log('🗺️ [DEBUG] Creating map for activity:', activity);
    
    // Validate activity has GPS data
    if (!activity.map || !activity.map.summary_polyline) {
      console.log('🚨 [DEBUG] Activity missing GPS data:', activity);
      alert('This activity does not have GPS route data available for map creation.');
      return;
    }

    try {
      // Clear any stale cached data before storing new selection
      localStorage.removeItem('lastActivityId');
      localStorage.removeItem('routeStateBackup');
      sessionStorage.removeItem('currentActivityId');
      
      // Clear activity-specific cache for any previous activities
      const cacheKeys = Object.keys(localStorage).filter(key => key.startsWith('activityData_'));
      cacheKeys.forEach(key => localStorage.removeItem(key));
      console.log('🧹 [DEBUG] Cleared stale cache for fresh activity selection');
      
      // Store activity data for the map design page
      localStorage.setItem('selectedActivityData', JSON.stringify(activity));
      console.log('✅ [DEBUG] Stored activity data for:', activity.name);
      console.log('🔄 [DEBUG] Navigating to /pages/map-design');
      
      // Navigate to map design page with authentication token
      console.log('🔍 [DEBUG] AuthUtils available:', !!window.AuthUtils);
      const authUtilsToken = window.AuthUtils?.getToken();
      const sessionToken = this.sessionToken;
      console.log('🔍 [DEBUG] AuthUtils token:', authUtilsToken ? 'YES (length=' + authUtilsToken.length + ')' : 'NO');
      console.log('🔍 [DEBUG] Session token:', sessionToken ? 'YES (length=' + sessionToken.length + ')' : 'NO');
      
      const token = authUtilsToken || sessionToken;
      
      if (token) {
        const mapDesignUrl = `/pages/map-design?token=${encodeURIComponent(token)}`;
        console.log('🔍 [DEBUG] Navigating with token to:', mapDesignUrl);
        window.location.href = mapDesignUrl;
      } else {
        console.log('⚠️ [DEBUG] No token available, navigating without token');
        // Try to get token from URL params as final fallback
        const urlParams = new URLSearchParams(window.location.search);
        const urlToken = urlParams.get('token');
        if (urlToken) {
          const mapDesignUrl = `/pages/map-design?token=${encodeURIComponent(urlToken)}`;
          console.log('🔍 [DEBUG] Using URL token for navigation:', mapDesignUrl);
          window.location.href = mapDesignUrl;
        } else {
          console.log('⚠️ [DEBUG] No token found anywhere, navigating without token');
          window.location.href = '/pages/map-design';
        }
      }
      
    } catch (error) {
      console.error('🚨 [DEBUG] Failed to navigate to map design:', error);
      alert('Failed to open map designer. Please try again.');
    }
  }

  /**
   * Update statistics dashboard with calculated totals
   */
  updateStatistics() {
    if (this.filteredActivities.length === 0) {
      this.setStatistic('totalActivities', '0');
      this.setStatistic('totalDistance', '0');
      this.setStatistic('totalElevation', '0');
      this.setStatistic('totalTime', '0h 0m');
      return;
    }

    // Calculate totals
    const totalActivities = this.filteredActivities.length;
    const totalDistance = this.filteredActivities.reduce((sum, activity) => sum + (activity.distance || 0), 0) / 1000; // Convert to km
    const totalElevation = this.filteredActivities.reduce((sum, activity) => sum + (activity.total_elevation_gain || 0), 0);
    const totalTimeSeconds = this.filteredActivities.reduce((sum, activity) => sum + (activity.moving_time || 0), 0);

    // Format values
    this.setStatistic('totalActivities', totalActivities.toString());
    this.setStatistic('totalDistance', totalDistance.toFixed(1));
    this.setStatistic('totalElevation', Math.round(totalElevation).toLocaleString());
    this.setStatistic('totalTime', this.formatDuration(totalTimeSeconds));
  }

  /**
   * Set a statistic value in the dashboard
   */
  setStatistic(elementKey, value) {
    const element = this.elements[elementKey];
    if (element) {
      element.textContent = value;
    }
  }

  /**
   * Update user connection status
   */
  updateUserStatus(userInfo) {
    if (this.elements.userName && userInfo) {
      const firstName = userInfo.firstname || '';
      const lastName = userInfo.lastname || '';
      const displayName = `${firstName} ${lastName}`.trim() || userInfo.username || 'User';
      
      this.elements.userName.textContent = displayName;
      
      if (this.elements.userConnectionStatus) {
        this.elements.userConnectionStatus.classList.remove('hidden');
      }
    }
  }

  /**
   * Generate enhanced route colors with gradients
   */
  getRouteColor(activityId) {
    const colors = [
      '#06b6d4', // Cyan
      '#a855f7', // Purple
      '#ec4899', // Pink
      '#10b981', // Green
      '#f59e0b', // Amber
      '#ef4444'  // Red
    ];
    
    // Use activity ID to consistently assign colors
    const index = parseInt(activityId) % colors.length;
    return colors[index];
  }

  /**
   * Generate mock route path with more realistic curves
   */
  generateMockRoutePath(activityId) {
    const seed = parseInt(activityId) || 1;
    const points = [];
    const numPoints = 8 + (seed % 5); // 8-12 points
    
    // Generate more organic route points
    for (let i = 0; i < numPoints; i++) {
      const progress = i / (numPoints - 1);
      const x = 50 + progress * 200; // Spread across SVG width
      
      // Create more natural elevation changes
      const baseY = 100; // Center Y
      const elevation = Math.sin(progress * Math.PI * 2 + seed) * 40;
      const noise = Math.sin(progress * Math.PI * 6 + seed * 2) * 15;
      const y = baseY + elevation + noise;
      
      points.push(`${x},${Math.max(20, Math.min(180, y))}`);
    }
    
    // Create smooth curve using quadratic bezier
    if (points.length < 2) return `M 50,100 L 250,100`;
    
    let path = `M ${points[0]}`;
    
    for (let i = 1; i < points.length - 1; i++) {
      const [x1, y1] = points[i].split(',');
      const [x2, y2] = points[i + 1].split(',');
      const cpx = (parseFloat(x1) + parseFloat(x2)) / 2;
      const cpy = (parseFloat(y1) + parseFloat(y2)) / 2;
      path += ` Q ${x1},${y1} ${cpx},${cpy}`;
    }
    
    path += ` L ${points[points.length - 1]}`;
    return path;
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
}

// Make StravaActivities available globally
window.StravaActivities = StravaActivities;

// Debug function for strava activities pagination testing
window.debugStravaActivitiesPagination = function() {
  console.log('🧪 Testing Strava Activities Pagination...');
  
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
    paginationElement.style.display = 'block';
    if (activitiesCount) activitiesCount.textContent = '30';
    if (paginationStatus) paginationStatus.textContent = '(test mode)';
    if (loadMoreBtn) {
      loadMoreBtn.textContent = 'Test Load More';
      loadMoreBtn.style.display = 'inline-block';
      loadMoreBtn.disabled = false;
    }
    
    console.log('✅ Pagination manually shown for testing');
  } else {
    console.error('❌ Pagination element not found in DOM');
  }
};