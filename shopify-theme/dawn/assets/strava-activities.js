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

    // Activity comparison
    this.selectedActivities = new Set();
    this.selectionModeActive = false;

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
      userName: document.getElementById('user-name'),
      // Search elements
      searchInput: document.getElementById('activity-search'),
      searchClearBtn: document.getElementById('search-clear'),
      searchResultsSummary: document.getElementById('search-results-summary'),
      resultsCountText: document.getElementById('results-count-text'),
      // Filter elements
      filterActivityTypeBtn: document.getElementById('filter-activity-type'),
      activityTypeFilter: document.getElementById('activity-type-filter'),
      dateRangeBtn: document.getElementById('date-range-button'),
      sortButton: document.getElementById('sort-button'),
      sortSelect: document.getElementById('sort-select'),
      // Selection mode
      selectionModeToggle: document.getElementById('selection-mode-toggle'),
      selectionCount: document.getElementById('selection-count'),
      // Active filter badges
      activeFiltersContainer: document.getElementById('active-filters-container'),
      activeFilterBadges: document.getElementById('active-filter-badges'),
      clearAllFiltersBtn: document.getElementById('clear-all-filters-btn'),
      // Bulk actions elements
      bulkActionsToolbar: document.getElementById('bulk-actions-toolbar'),
      bulkSelectedCount: document.getElementById('bulk-selected-count'),
      bulkCreatePosters: document.getElementById('bulk-create-posters'),
      bulkExportData: document.getElementById('bulk-export-data'),
      bulkDeselectAll: document.getElementById('bulk-deselect-all'),
      // Statistics dashboard
      statisticsDashboard: document.querySelector('.statistics-dashboard'),
      // Empty state elements
      emptyTitle: document.getElementById('empty-title'),
      emptyDescription: document.getElementById('empty-description'),
      emptyIconPath: document.getElementById('empty-icon-path'),
      emptyActiveFilters: document.getElementById('empty-active-filters'),
      emptyFilterTags: document.getElementById('empty-filter-tags'),
      emptyClearFiltersBtn: document.getElementById('empty-clear-filters'),
      // Load more elements
      loadMoreText: document.getElementById('load-more-text'),
      loadMoreArrow: document.getElementById('load-more-arrow'),
      loadMoreSpinner: document.getElementById('load-more-spinner'),
      // Infinite scroll
      infiniteScrollTrigger: document.getElementById('infinite-scroll-trigger')
    };

    // Infinite scroll observer
    this.infiniteScrollObserver = null;
    this.infiniteScrollEnabled = true; // Can be toggled by user preference

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

    // Setup infinite scroll
    this.setupInfiniteScroll();

    // Initialize keyboard shortcut hint
    this.initializeKeyboardHint();
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
        // Show skeleton loading cards instead of generic spinner
        this.showSkeletonCards(6);
      }

      // Calculate date range filter if set
      let afterDate = null;
      if (this.currentFilters.dateRange && this.currentFilters.dateRange !== '') {
        const daysAgo = parseInt(this.currentFilters.dateRange);
        if (!isNaN(daysAgo)) {
          const date = new Date();
          date.setDate(date.getDate() - daysAgo);
          afterDate = Math.floor(date.getTime() / 1000); // Strava uses Unix timestamps
        }
      }

      const apiParams = {
        page: this.currentPage,
        per_page: 30, // Standard Strava API limit
        ...(this.currentFilters.type && { activity_types: this.currentFilters.type }),
        ...(this.searchTerm && { search_name: this.searchTerm }),
        ...(afterDate && { after: afterDate }),
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

        // Update user status if user info is available in the response
        if (data.athlete || data.user) {
          this.updateUserStatus(data.athlete || data.user);
        }

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
   * Show skeleton loading cards
   */
  showSkeletonCards(count = 6) {
    const skeletonHtml = Array.from({ length: count }, () => `
      <div class="skeleton-card" role="status" aria-label="Loading activity">
        <div class="skeleton-preview">
          <div class="skeleton-type-badge"></div>
        </div>
        <div class="skeleton-details">
          <div class="skeleton-line title"></div>
          <div class="skeleton-line subtitle"></div>
          <div class="skeleton-stats">
            <div class="skeleton-stat">
              <div class="skeleton-line"></div>
              <div class="skeleton-line"></div>
            </div>
            <div class="skeleton-stat">
              <div class="skeleton-line"></div>
              <div class="skeleton-line"></div>
            </div>
          </div>
          <div class="skeleton-button"></div>
        </div>
      </div>
    `).join('');

    if (this.elements.grid) {
      this.elements.grid.innerHTML = skeletonHtml;
      this.elements.grid.classList.remove('activities-grid');
      this.elements.grid.classList.add('skeleton-grid');
      this.hideAllStates();
      this.showElement(this.elements.grid);
    }
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

    // Ensure grid has correct classes
    this.elements.grid.classList.remove('skeleton-grid');
    this.elements.grid.classList.add('activities-grid');

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

    // Update search results summary
    this.updateSearchResultsSummary();

    // Remove searching state indicator
    const searchContainer = this.elements.searchInput?.closest('.strava-activities-search');
    if (searchContainer) {
      searchContainer.classList.remove('searching');
    }
  }

  /**
   * Update search results summary
   */
  updateSearchResultsSummary() {
    const { searchResultsSummary, resultsCountText } = this.elements;

    if (!searchResultsSummary || !resultsCountText) return;

    const hasSearch = this.searchTerm && this.searchTerm.trim().length > 0;
    const hasFilters = this.currentFilters.type || this.currentFilters.dateRange;
    const count = this.filteredActivities.length;

    // Show summary if there's an active search or filters
    if (hasSearch || hasFilters) {
      searchResultsSummary.classList.remove('hidden');

      // Build result text
      let resultText = '';
      if (count === 0) {
        resultText = 'No activities found';
      } else if (count === 1) {
        resultText = '1 activity found';
      } else {
        resultText = `${count.toLocaleString()} activities found`;
      }

      // Add context based on search/filters
      if (hasSearch && hasFilters) {
        resultText += ' matching your search and filters';
      } else if (hasSearch) {
        resultText += ` for "${this.searchTerm}"`;
      } else if (hasFilters) {
        resultText += ' matching your filters';
      }

      resultsCountText.textContent = resultText;
    } else {
      searchResultsSummary.classList.add('hidden');
    }
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

    const isSelected = this.selectedActivities.has(activity.id);
    const routePath = this.generateMockRoutePath(activity.id);
    const routeColor = this.getRouteColor(activity.id);

    return `
      <div class="activity-card ${isSelected ? 'selected' : ''}"
           data-activity-id="${activity.id}"
           data-activity-type="${activity.type || activity.sport_type || 'Unknown'}"
           role="listitem">
        <!-- Activity Preview -->
        <div class="activity-card-preview">
          <!-- Selection Checkbox -->
          <div class="activity-selection-checkbox" role="checkbox" aria-checked="${isSelected}" tabindex="0">
            <input
              type="checkbox"
              class="activity-select-input"
              data-activity-id="${activity.id}"
              ${isSelected ? 'checked' : ''}
              aria-label="Select activity for comparison">
            <div class="checkbox-custom">
              <svg class="checkbox-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
          </div>

          <!-- Mock route visualization -->
          <svg class="activity-route-svg" viewBox="0 0 300 200" aria-hidden="true">
            <path
              d="${routePath}"
              class="activity-route-path"
              stroke="${routeColor}"
            />
          </svg>

          <!-- Activity type badge -->
          <div class="activity-type-badge" aria-label="${activity.type || activity.sport_type || 'Activity'} activity">
            ${this.getActivityIcon(activity.type || activity.sport_type || 'Activity')}
          </div>

          <!-- GPS indicator -->
          ${activity.map && activity.map.summary_polyline ? `
            <div class="activity-gps-indicator" aria-label="GPS route data available">
              <svg class="activity-gps-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
          ` : ''}

          <!-- Quick Actions Overlay -->
          <div class="activity-quick-actions">
            <button
              class="quick-action-btn"
              data-action="view-details"
              data-activity-id="${activity.id}"
              aria-label="View activity details"
              title="View Details">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
            <button
              class="quick-action-btn primary"
              data-action="create-poster"
              data-activity-id="${activity.id}"
              aria-label="Create poster for this activity"
              title="Create Poster">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
            <button
              class="quick-action-btn"
              data-action="share"
              data-activity-id="${activity.id}"
              aria-label="Share activity"
              title="Share">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Activity Details -->
        <div class="activity-card-details">
          <div class="activity-card-body">
            <h3 class="activity-name">${this.escapeHtml(activity.name || 'Unnamed Activity')}</h3>
            <div class="activity-meta">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              ${formattedDate}
              ${activity.location_city || activity.location_country ? `
                <span class="activity-meta-separator">•</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
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
            <button class="create-poster-button" data-activity-id="${activity.id}" aria-label="Create poster for ${this.escapeHtml(activity.name || 'activity')}">
              <span class="button-text">CREATE POSTER</span>
              <span class="button-icon">${this.getActivityIcon(activity.type || activity.sport_type || 'Activity')}</span>
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
   * Get Heroicon SVG for activity type
   */
  getActivityIcon(type) {
    const icons = {
      'Ride': '<svg class="activity-type-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><circle cx="6" cy="17" r="2.5"/><circle cx="18" cy="17" r="2.5"/><path stroke-linecap="round" stroke-linejoin="round" d="M6 17l4-9h4l4 9M12 6h2M10 8l4 9M14 8l-4 9"/></svg>',
      'Run': '<svg class="activity-type-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" /></svg>',
      'Walk': '<svg class="activity-type-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>',
      'Hike': '<svg class="activity-type-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205l3 1m1.5.5l-1.5-.5M6.75 7.364V3h-3v18m3-13.636l10.5-3.819" /></svg>',
      'Swim': '<svg class="activity-type-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" /></svg>',
      'VirtualRide': '<svg class="activity-type-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" /></svg>',
      'EBikeRide': '<svg class="activity-type-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>',
      'MountainBikeRide': '<svg class="activity-type-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg>'
    };
    return icons[type] || '<svg class="activity-type-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>';
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
   * Generate simplified elevation profile visualization
   * Creates a representative elevation curve based on total elevation gain
   */
  generateElevationProfile(activityId, totalElevationGain) {
    if (!totalElevationGain || totalElevationGain < 10) {
      // For flat routes, return nearly flat line
      return this.generateFlatElevationPath();
    }

    // Use activity ID as seed for consistent variation
    const seed = activityId % 100;
    const numPoints = 50;
    const width = 300;
    const height = 80;
    const padding = 10;

    // Generate points with some randomness based on seed
    const points = [];
    const baseElevation = height - padding;
    const maxVariation = (totalElevationGain / 100) * 30; // Scale variation based on total gain

    for (let i = 0; i < numPoints; i++) {
      const x = (i / (numPoints - 1)) * (width - 2 * padding) + padding;

      // Create natural-looking elevation changes
      const progress = i / (numPoints - 1);
      const wave1 = Math.sin(progress * Math.PI * 2 + seed * 0.1) * maxVariation * 0.4;
      const wave2 = Math.sin(progress * Math.PI * 4 + seed * 0.2) * maxVariation * 0.3;
      const wave3 = Math.sin(progress * Math.PI * 6 + seed * 0.3) * maxVariation * 0.3;

      const y = baseElevation - (wave1 + wave2 + wave3) - (maxVariation * 0.5);

      points.push({x, y});
    }

    // Create SVG path for area chart
    const pathD = this.createSmoothPath(points);
    const areaPath = `${pathD} L ${width - padding},${height} L ${padding},${height} Z`;

    return {
      linePath: pathD,
      areaPath: areaPath,
      viewBox: `0 0 ${width} ${height}`
    };
  }

  /**
   * Generate flat elevation path for routes with minimal elevation
   */
  generateFlatElevationPath() {
    const width = 300;
    const height = 80;
    const padding = 10;
    const y = height - padding - 5;

    const path = `M ${padding},${y} L ${width - padding},${y}`;
    const area = `${path} L ${width - padding},${height} L ${padding},${height} Z`;

    return {
      linePath: path,
      areaPath: area,
      viewBox: `0 0 ${width} ${height}`
    };
  }

  /**
   * Create smooth path through points using quadratic curves
   */
  createSmoothPath(points) {
    if (points.length < 2) return '';

    let path = `M ${points[0].x},${points[0].y}`;

    for (let i = 1; i < points.length - 1; i++) {
      const current = points[i];
      const next = points[i + 1];
      const controlX = current.x;
      const controlY = current.y;
      const endX = (current.x + next.x) / 2;
      const endY = (current.y + next.y) / 2;

      path += ` Q ${controlX},${controlY} ${endX},${endY}`;
    }

    // Connect to last point
    const last = points[points.length - 1];
    path += ` L ${last.x},${last.y}`;

    return path;
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
      // Loading state - show spinner and progress message
      this.elements.loadMoreBtn.disabled = true;
      if (this.elements.loadMoreText) {
        this.elements.loadMoreText.textContent = 'Loading more activities...';
      }
      // Swap icon from arrow to spinner
      if (this.elements.loadMoreArrow) {
        this.elements.loadMoreArrow.classList.add('hidden');
      }
      if (this.elements.loadMoreSpinner) {
        this.elements.loadMoreSpinner.classList.remove('hidden');
      }
      this.elements.loadMoreBtn.setAttribute('aria-busy', 'true');
    } else if (!this.hasMoreActivities) {
      // End of list state
      this.elements.loadMoreBtn.disabled = true;
      if (this.elements.loadMoreText) {
        const totalCount = this.totalActivitiesLoaded;
        this.elements.loadMoreText.textContent = totalCount > 0
          ? `All ${totalCount} activities loaded`
          : 'All activities loaded';
      }
      // Hide both icons
      if (this.elements.loadMoreArrow) {
        this.elements.loadMoreArrow.classList.add('hidden');
      }
      if (this.elements.loadMoreSpinner) {
        this.elements.loadMoreSpinner.classList.add('hidden');
      }
      this.elements.loadMoreBtn.setAttribute('aria-busy', 'false');
    } else {
      // Ready state - show arrow
      this.elements.loadMoreBtn.disabled = false;
      if (this.elements.loadMoreText) {
        this.elements.loadMoreText.textContent = 'Load More Activities';
      }
      // Swap icon from spinner to arrow
      if (this.elements.loadMoreArrow) {
        this.elements.loadMoreArrow.classList.remove('hidden');
      }
      if (this.elements.loadMoreSpinner) {
        this.elements.loadMoreSpinner.classList.add('hidden');
      }
      this.elements.loadMoreBtn.setAttribute('aria-busy', 'false');
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
   * Setup Intersection Observer for infinite scroll
   */
  setupInfiniteScroll() {
    // Check if Intersection Observer is supported
    if (!('IntersectionObserver' in window)) {
      console.warn('⚠️ [InfiniteScroll] Intersection Observer not supported, infinite scroll disabled');
      return;
    }

    if (!this.elements.infiniteScrollTrigger) {
      console.warn('⚠️ [InfiniteScroll] Trigger element not found');
      return;
    }

    // Create observer with options
    const options = {
      root: null, // viewport
      rootMargin: '200px', // trigger 200px before reaching the element
      threshold: 0.1
    };

    this.infiniteScrollObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.handleInfiniteScroll();
        }
      });
    }, options);

    // Start observing
    this.infiniteScrollObserver.observe(this.elements.infiniteScrollTrigger);
    console.log('✅ [InfiniteScroll] Observer initialized and watching');
  }

  /**
   * Handle infinite scroll trigger
   */
  handleInfiniteScroll() {
    // Only load if:
    // 1. Infinite scroll is enabled
    // 2. Not currently loading
    // 3. There are more activities to load
    // 4. Activities grid is visible (not on empty/error state)
    if (
      !this.infiniteScrollEnabled ||
      this.isLoading ||
      this.isLoadingMore ||
      !this.hasMoreActivities ||
      !this.elements.grid ||
      this.elements.grid.classList.contains('hidden')
    ) {
      return;
    }

    console.log('📜 [InfiniteScroll] Trigger reached, loading more activities');
    this.loadMoreActivities();
  }

  /**
   * Disconnect infinite scroll observer
   */
  disconnectInfiniteScroll() {
    if (this.infiniteScrollObserver) {
      this.infiniteScrollObserver.disconnect();
      console.log('🛑 [InfiniteScroll] Observer disconnected');
    }
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
   * Show empty state with context-aware messaging
   */
  showEmptyState() {
    this.hideAllStates();

    // Determine if filters or search are active
    const hasActiveFilters = this.currentFilters.type || this.currentFilters.dateRange;
    const hasSearch = this.searchTerm && this.searchTerm.trim().length > 0;
    const hasAnyFilter = hasActiveFilters || hasSearch;

    // Update icon based on context
    if (this.elements.emptyIconPath) {
      if (hasSearch) {
        // Search icon
        this.elements.emptyIconPath.setAttribute('d', 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z');
      } else if (hasActiveFilters) {
        // Filter icon
        this.elements.emptyIconPath.setAttribute('d', 'M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z');
      } else {
        // Document icon (default)
        this.elements.emptyIconPath.setAttribute('d', 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z');
      }
    }

    // Update title and description based on context - Enhanced messaging
    if (hasSearch && !hasActiveFilters) {
      // Search only - no results
      this.elements.emptyTitle.textContent = `No matches for "${this.searchTerm}"`;
      this.elements.emptyDescription.innerHTML = 'We couldn\'t find any activities matching your search. Try a different term or <button type="button" class="text-link" onclick="document.getElementById(\'empty-clear-filters\').click()">clear your search</button> to browse all activities.';
    } else if (hasActiveFilters && !hasSearch) {
      // Filters only - no results
      this.elements.emptyTitle.textContent = 'No activities match your filters';
      this.elements.emptyDescription.innerHTML = 'Your current filters didn\'t return any results. Try broadening your criteria or <button type="button" class="text-link" onclick="document.getElementById(\'empty-clear-filters\').click()">remove filters</button> to see all activities.';
    } else if (hasSearch && hasActiveFilters) {
      // Both search and filters - no results
      this.elements.emptyTitle.textContent = 'Nothing matches yet';
      this.elements.emptyDescription.innerHTML = `No activities found for "${this.searchTerm}" with your current filters. Try <button type="button" class="text-link" onclick="document.getElementById(\'empty-clear-filters\').click()">removing some filters</button> or adjusting your search.`;
    } else {
      // No filters or search - truly empty
      this.elements.emptyTitle.textContent = 'Ready to create your first map?';
      this.elements.emptyDescription.innerHTML = 'Start by recording your rides and runs on Strava. Once you have activities, you can turn them into beautiful custom maps! <a href="https://www.strava.com" target="_blank" rel="noopener">Get started with Strava</a>';
    }

    // Show/hide active filters section
    if (hasAnyFilter) {
      const filterTags = [];

      if (hasSearch) {
        filterTags.push({
          label: `Search: "${this.searchTerm}"`,
          icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>'
        });
      }

      if (this.currentFilters.type) {
        const typeLabel = this.elements.activityTypeFilter?.querySelector(`option[value="${this.currentFilters.type}"]`)?.textContent || this.currentFilters.type;
        filterTags.push({
          label: `Type: ${typeLabel}`,
          icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path>'
        });
      }

      if (this.currentFilters.dateRange) {
        const days = parseInt(this.currentFilters.dateRange);
        const label = days === 365 ? 'This year' : days === 90 ? 'Last 90 days' : days === 30 ? 'Last 30 days' : days === 7 ? 'Last 7 days' : `Last ${days} days`;
        filterTags.push({
          label: `Date: ${label}`,
          icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>'
        });
      }

      // Render filter tags
      if (this.elements.emptyFilterTags) {
        this.elements.emptyFilterTags.innerHTML = filterTags.map(tag => `
          <div class="empty-filter-tag">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              ${tag.icon}
            </svg>
            <span>${this.escapeHtml(tag.label)}</span>
          </div>
        `).join('');
      }

      // Show active filters section and clear button
      if (this.elements.emptyActiveFilters) {
        this.elements.emptyActiveFilters.classList.remove('hidden');
      }
      if (this.elements.emptyClearFiltersBtn) {
        this.elements.emptyClearFiltersBtn.classList.remove('hidden');
      }
    } else {
      // Hide active filters section and clear button
      if (this.elements.emptyActiveFilters) {
        this.elements.emptyActiveFilters.classList.add('hidden');
      }
      if (this.elements.emptyClearFiltersBtn) {
        this.elements.emptyClearFiltersBtn.classList.add('hidden');
      }
    }

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

    // Search functionality
    if (this.elements.searchInput) {
      // Debounced search handler
      const handleSearch = this.debounce(() => {
        this.searchTerm = this.elements.searchInput.value.trim();
        console.log('🔍 [Search] Searching for:', this.searchTerm);
        this.resetPagination();
        this.loadActivities();
        this.renderActiveFilterBadges();
      }, 300);

      // Input event listener
      this.elements.searchInput.addEventListener('input', (e) => {
        const value = e.target.value;

        // Show/hide clear button based on input
        if (this.elements.searchClearBtn) {
          if (value.length > 0) {
            this.elements.searchClearBtn.classList.remove('hidden');
          } else {
            this.elements.searchClearBtn.classList.add('hidden');
          }
        }

        // Add searching state indicator
        const searchContainer = this.elements.searchInput.closest('.strava-activities-search');
        if (searchContainer && value.length > 0) {
          searchContainer.classList.add('searching');
        }

        handleSearch();
      });

      // Clear button functionality
      if (this.elements.searchClearBtn) {
        this.elements.searchClearBtn.addEventListener('click', () => {
          this.elements.searchInput.value = '';
          this.elements.searchClearBtn.classList.add('hidden');
          this.searchTerm = '';
          this.resetPagination();
          this.loadActivities();
          this.renderActiveFilterBadges();
        });
      }
    }

    // Filter functionality - Activity Type
    if (this.elements.filterActivityTypeBtn && this.elements.activityTypeFilter) {
      // Toggle filter dropdown visibility
      this.elements.filterActivityTypeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = this.elements.activityTypeFilter.classList.contains('hidden');
        this.elements.activityTypeFilter.classList.toggle('hidden');

        // Update aria-expanded attribute
        this.elements.filterActivityTypeBtn.setAttribute('aria-expanded', isHidden ? 'true' : 'false');

        // Close dropdown when clicking outside
        if (isHidden) {
          setTimeout(() => {
            document.addEventListener('click', this.closeFilterDropdown.bind(this), { once: true });
          }, 0);
        }
      });

      // Handle filter selection
      this.elements.activityTypeFilter.addEventListener('change', (e) => {
        const selectedType = e.target.value;
        console.log('🎯 [Filter] Activity type selected:', selectedType || 'All');

        this.currentFilters.type = selectedType;
        this.updateFilterButton(this.elements.filterActivityTypeBtn, selectedType);
        this.elements.activityTypeFilter.classList.add('hidden');

        this.resetPagination();
        this.loadActivities();
        this.renderActiveFilterBadges();
      });
    }

    // Filter functionality - Date Range
    if (this.elements.dateRangeBtn) {
      this.elements.dateRangeBtn.addEventListener('click', (e) => {
        console.log('📅 [Filter] Date range filter clicked');
        // For now, we'll implement a simple date range selector
        this.showDateRangeSelector();
      });
    }

    // Sort functionality
    if (this.elements.sortButton) {
      this.elements.sortButton.addEventListener('click', (e) => {
        console.log('🔽 [Sort] Sort button clicked');
        e.stopPropagation();

        // Toggle sort dropdown visibility
        const isHidden = this.elements.sortSelect.classList.contains('hidden');
        this.elements.sortSelect.classList.toggle('hidden');
        this.elements.sortButton.setAttribute('aria-expanded', isHidden ? 'true' : 'false');

        // Close dropdown when clicking outside
        if (isHidden) {
          setTimeout(() => {
            document.addEventListener('click', this.closeSortDropdown.bind(this), { once: true });
          }, 0);
        }
      });

      // Handle sort selection
      this.elements.sortSelect.addEventListener('change', (e) => {
        const selectedSort = e.target.value;
        console.log('🔽 [Sort] Sort option selected:', selectedSort);

        // Parse sort value into field and order
        const [field, order] = this.parseSortValue(selectedSort);
        this.currentFilters.sortBy = field;
        this.currentFilters.sortOrder = order;

        // Update button to show active sort
        this.updateSortButton(selectedSort);
        this.elements.sortSelect.classList.add('hidden');

        // Reload activities with new sort
        this.resetPagination();
        this.loadActivities();
      });
    }

    // Selection mode toggle functionality
    if (this.elements.selectionModeToggle) {
      this.elements.selectionModeToggle.addEventListener('click', () => {
        this.toggleSelectionMode();
      });
    }

    // Bulk actions functionality
    if (this.elements.bulkCreatePosters) {
      this.elements.bulkCreatePosters.addEventListener('click', () => {
        console.log('🖼️ [Bulk Actions] Create posters for selected activities');
        this.bulkCreatePosters();
      });
    }

    if (this.elements.bulkExportData) {
      this.elements.bulkExportData.addEventListener('click', () => {
        console.log('📥 [Bulk Actions] Export data for selected activities');
        this.bulkExportData();
      });
    }

    if (this.elements.bulkDeselectAll) {
      this.elements.bulkDeselectAll.addEventListener('click', () => {
        console.log('🧹 [Bulk Actions] Deselect all activities');
        this.deselectAllActivities();
      });
    }

    // Event delegation for activity cards - handles all clicks in grid with single listener
    if (this.elements.grid) {
      this.elements.grid.addEventListener('click', (e) => {
        // Handle selection checkbox clicks
        const checkboxContainer = e.target.closest('.activity-selection-checkbox');
        if (checkboxContainer) {
          e.stopPropagation(); // Prevent card click event

          const checkbox = checkboxContainer.querySelector('.activity-select-input');
          const activityId = checkbox.dataset.activityId;
          const activity = this.activities.find(a => a.id.toString() === activityId);

          console.log('☑️ [Selection] Checkbox clicked for activity:', activityId);

          if (activity) {
            this.toggleActivitySelection(activity);
          }
          return;
        }

        // Handle quick action button clicks
        const quickActionBtn = e.target.closest('.quick-action-btn');
        if (quickActionBtn) {
          e.preventDefault();
          e.stopPropagation();

          const action = quickActionBtn.dataset.action;
          const activityId = quickActionBtn.dataset.activityId;
          const activity = this.activities.find(a => a.id.toString() === activityId);

          console.log('⚡ [Quick Action] Action:', action, 'Activity ID:', activityId);

          if (activity) {
            this.handleQuickAction(action, activity);
          }
          return;
        }

        // Handle "Create Poster" button clicks
        const button = e.target.closest('.create-poster-button');
        if (button) {
          e.preventDefault();
          e.stopPropagation();

          const activityId = button.dataset.activityId;
          console.log('🔧 [Event Delegation] Create Poster button clicked for activity:', activityId);

          const activity = this.activities.find(a => a.id.toString() === activityId);
          if (activity) {
            this.createMapForActivity(activity);
          } else {
            console.error('🚨 [Event Delegation] Activity not found:', activityId);
          }
          return;
        }

        // Handle entire card clicks - show activity details
        const card = e.target.closest('.activity-card');
        if (card) {
          const activityId = card.dataset.activityId;
          const activity = this.activities.find(a => a.id.toString() === activityId);

          console.log('🔧 [Event Delegation] Card clicked for activity:', activityId);

          if (activity) {
            this.showActivityDetails(activity);
          }
        }
      });
    }

    // Clear filters button in empty state
    if (this.elements.emptyClearFiltersBtn) {
      this.elements.emptyClearFiltersBtn.addEventListener('click', () => {
        console.log('🧹 [Empty State] Clearing all filters');
        this.clearAllFilters();
      });
    }

    // Clear all filters button in active filters container
    if (this.elements.clearAllFiltersBtn) {
      this.elements.clearAllFiltersBtn.addEventListener('click', () => {
        console.log('🧹 [Active Filters] Clearing all filters');
        this.clearAllFilters();
      });
    }

    // Global keyboard shortcuts
    this.setupKeyboardShortcuts();
  }

  /**
   * Setup keyboard shortcuts for better UX
   */
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Cmd/Ctrl + K - Focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        this.focusSearch();
        return;
      }

      // Forward slash (/) - Focus search (like GitHub)
      // Only if not already in an input
      if (e.key === '/' && !this.isInputFocused()) {
        e.preventDefault();
        this.focusSearch();
        return;
      }

      // Escape key handling
      if (e.key === 'Escape') {
        // If search is focused and has value, clear it
        if (document.activeElement === this.elements.searchInput) {
          if (this.elements.searchInput.value) {
            e.preventDefault();
            this.clearSearch();
          } else {
            // Empty search, blur it
            this.elements.searchInput.blur();
          }
          return;
        }

        // Close any open dropdowns
        this.closeAllDropdowns();
      }

      // Ctrl/Cmd + / - Show keyboard shortcuts help
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        this.showKeyboardShortcutsHelp();
        return;
      }
    });

    console.log('⌨️ [Keyboard] Keyboard shortcuts initialized');
  }

  /**
   * Focus the search input
   */
  focusSearch() {
    if (this.elements.searchInput) {
      this.elements.searchInput.focus();
      this.elements.searchInput.select(); // Select existing text if any
      console.log('⌨️ [Keyboard] Search focused');
    }
  }

  /**
   * Clear search input
   */
  clearSearch() {
    if (this.elements.searchInput) {
      this.elements.searchInput.value = '';
      if (this.elements.searchClearBtn) {
        this.elements.searchClearBtn.classList.add('hidden');
      }
      this.searchTerm = '';
      this.resetPagination();
      this.loadActivities();
      this.renderActiveFilterBadges();
      console.log('⌨️ [Keyboard] Search cleared');
    }
  }

  /**
   * Check if any input element is currently focused
   */
  isInputFocused() {
    const activeElement = document.activeElement;
    return activeElement && (
      activeElement.tagName === 'INPUT' ||
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.tagName === 'SELECT' ||
      activeElement.isContentEditable
    );
  }

  /**
   * Close all open dropdowns
   */
  closeAllDropdowns() {
    if (this.elements.activityTypeFilter) {
      this.elements.activityTypeFilter.classList.add('hidden');
    }
    if (this.elements.sortSelect) {
      this.elements.sortSelect.classList.add('hidden');
    }
    console.log('⌨️ [Keyboard] Closed all dropdowns');
  }

  /**
   * Show keyboard shortcuts help modal
   */
  showKeyboardShortcutsHelp() {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modKey = isMac ? '⌘' : 'Ctrl';

    const helpContent = `
      <div class="keyboard-shortcuts-modal" role="dialog" aria-labelledby="shortcuts-title" aria-modal="true">
        <div class="shortcuts-overlay" onclick="this.closest('.keyboard-shortcuts-modal').remove()"></div>
        <div class="shortcuts-content">
          <div class="shortcuts-header">
            <h3 id="shortcuts-title">Keyboard Shortcuts</h3>
            <button type="button" class="shortcuts-close" onclick="this.closest('.keyboard-shortcuts-modal').remove()" aria-label="Close">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="shortcuts-body">
            <div class="shortcut-section">
              <h4>Search & Navigation</h4>
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>${modKey}</kbd> + <kbd>K</kbd>
                </div>
                <div class="shortcut-description">Focus search</div>
              </div>
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>/</kbd>
                </div>
                <div class="shortcut-description">Focus search (alternative)</div>
              </div>
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>Esc</kbd>
                </div>
                <div class="shortcut-description">Clear search / Close dropdowns</div>
              </div>
            </div>
            <div class="shortcut-section">
              <h4>Help</h4>
              <div class="shortcut-item">
                <div class="shortcut-keys">
                  <kbd>${modKey}</kbd> + <kbd>/</kbd>
                </div>
                <div class="shortcut-description">Show this help</div>
              </div>
            </div>
          </div>
          <div class="shortcuts-footer">
            <p class="shortcuts-hint">Press <kbd>Esc</kbd> to close</p>
          </div>
        </div>
      </div>
    `;

    // Remove any existing modal
    const existingModal = document.querySelector('.keyboard-shortcuts-modal');
    if (existingModal) {
      existingModal.remove();
    }

    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', helpContent);

    // Close on Escape
    const modal = document.querySelector('.keyboard-shortcuts-modal');
    const closeOnEscape = (e) => {
      if (e.key === 'Escape') {
        modal.remove();
        document.removeEventListener('keydown', closeOnEscape);
      }
    };
    document.addEventListener('keydown', closeOnEscape);

    // Focus trap
    modal.querySelector('.shortcuts-close').focus();

    console.log('⌨️ [Keyboard] Showing shortcuts help');
  }

  /**
   * Initialize keyboard shortcut hint in search bar
   */
  initializeKeyboardHint() {
    const shortcutKeyElement = document.getElementById('shortcut-key');
    if (shortcutKeyElement) {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? '⌘' : 'Ctrl';
      shortcutKeyElement.textContent = `${modKey}K`;
      console.log('⌨️ [Keyboard] Initialized keyboard hint:', `${modKey}K`);
    }
  }

  /**
   * Toggle selection mode on/off
   */
  toggleSelectionMode() {
    this.selectionModeActive = !this.selectionModeActive;

    console.log('✅ [Selection Mode]', this.selectionModeActive ? 'Activated' : 'Deactivated');

    // Update body class
    if (this.selectionModeActive) {
      document.body.classList.add('selection-mode-active');
    } else {
      document.body.classList.remove('selection-mode-active');
      // Deselect all when exiting selection mode
      this.deselectAllActivities();
    }

    // Update button state
    if (this.elements.selectionModeToggle) {
      this.elements.selectionModeToggle.setAttribute('aria-pressed', this.selectionModeActive);
    }

    // Update selection count
    this.updateSelectionCount();
  }

  /**
   * Update selection count display
   */
  updateSelectionCount() {
    if (this.elements.selectionCount) {
      this.elements.selectionCount.textContent = this.selectedActivities.size;
    }
  }

  /**
   * Close filter dropdown when clicking outside
   */
  closeFilterDropdown() {
    if (this.elements.activityTypeFilter) {
      this.elements.activityTypeFilter.classList.add('hidden');
    }
  }

  /**
   * Close sort dropdown when clicking outside
   */
  closeSortDropdown() {
    if (this.elements.sortSelect) {
      this.elements.sortSelect.classList.add('hidden');
    }
  }

  /**
   * Parse sort value into field and order
   * e.g., "start_date_desc" -> ["start_date", "desc"]
   */
  parseSortValue(sortValue) {
    const parts = sortValue.split('_');
    const order = parts.pop(); // Last part is always asc or desc
    const field = parts.join('_'); // Rejoin remaining parts
    return [field, order];
  }

  /**
   * Update sort button to show active sort
   */
  updateSortButton(sortValue) {
    if (!this.elements.sortButton) return;

    const span = this.elements.sortButton.querySelector('span');
    if (span) {
      if (sortValue && sortValue !== 'start_date_desc') {
        // Show the selected sort option (not default)
        const sortText = this.elements.sortSelect?.querySelector(`option[value="${sortValue}"]`)?.textContent || 'Sort';
        span.textContent = sortText;
        this.elements.sortButton.classList.add('filter-active');
      } else {
        // Reset to default text
        span.textContent = 'Sort';
        this.elements.sortButton.classList.remove('filter-active');
      }
    }
  }

  /**
   * Clear all active filters and reset search
   */
  clearAllFilters() {
    console.log('🧹 [Filters] Clearing all filters');

    // Reset filters object
    this.currentFilters = {
      type: '',
      dateRange: null,
      sortBy: 'start_date',
      sortOrder: 'desc'
    };

    // Reset search
    this.searchTerm = '';
    if (this.elements.searchInput) {
      this.elements.searchInput.value = '';
      if (this.elements.searchClearBtn) {
        this.elements.searchClearBtn.classList.add('hidden');
      }
    }

    // Reset filter UI
    if (this.elements.activityTypeFilter) {
      this.elements.activityTypeFilter.value = '';
    }
    if (this.elements.filterActivityTypeBtn) {
      this.updateFilterButton(this.elements.filterActivityTypeBtn, '');
    }
    if (this.elements.dateRangeBtn) {
      this.updateFilterButton(this.elements.dateRangeBtn, '');
    }

    // Reset sort UI
    if (this.elements.sortSelect) {
      this.elements.sortSelect.value = 'start_date_desc';
    }
    if (this.elements.sortButton) {
      this.updateSortButton('start_date_desc');
    }

    // Reload activities
    this.resetPagination();
    this.loadActivities();

    // Update active filter badges
    this.renderActiveFilterBadges();
  }

  /**
   * Render active filter badges/chips
   */
  renderActiveFilterBadges() {
    const { activeFiltersContainer, activeFilterBadges, clearAllFiltersBtn, activityTypeFilter } = this.elements;

    if (!activeFiltersContainer || !activeFilterBadges) return;

    // Collect active filters
    const activeBadges = [];

    // Activity Type filter
    if (this.currentFilters.type) {
      const typeLabel = activityTypeFilter?.querySelector(`option[value="${this.currentFilters.type}"]`)?.textContent || this.currentFilters.type;
      activeBadges.push({
        type: 'activity-type',
        label: 'Type:',
        value: typeLabel,
        filterKey: 'type'
      });
    }

    // Date Range filter
    if (this.currentFilters.dateRange) {
      const dateRangeOptions = {
        '7': 'Last Week',
        '30': 'Last Month',
        '90': 'Last 3 Months',
        '365': 'Last Year'
      };
      const dateLabel = dateRangeOptions[this.currentFilters.dateRange] || `Last ${this.currentFilters.dateRange} days`;
      activeBadges.push({
        type: 'date-range',
        label: 'Date:',
        value: dateLabel,
        filterKey: 'dateRange'
      });
    }

    // Search term
    if (this.searchTerm && this.searchTerm.trim()) {
      activeBadges.push({
        type: 'search',
        label: 'Search:',
        value: `"${this.searchTerm}"`,
        filterKey: 'search'
      });
    }

    // Show/hide container based on active filters
    if (activeBadges.length > 0) {
      activeFiltersContainer.classList.remove('hidden');

      // Render badges
      activeFilterBadges.innerHTML = activeBadges.map(badge => `
        <div class="filter-badge" data-filter-type="${badge.type}">
          <span class="filter-badge-label">${badge.label}</span>
          <span class="filter-badge-value">${this.escapeHtml(badge.value)}</span>
          <button type="button"
                  class="filter-badge-remove"
                  data-filter-key="${badge.filterKey}"
                  aria-label="Remove ${badge.label} filter"
                  title="Remove filter">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      `).join('');

      // Add event listeners to remove buttons
      activeFilterBadges.querySelectorAll('.filter-badge-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const filterKey = btn.dataset.filterKey;
          this.removeFilter(filterKey);
        });
      });
    } else {
      activeFiltersContainer.classList.add('hidden');
    }
  }

  /**
   * Remove a specific filter
   */
  removeFilter(filterKey) {
    console.log('🗑️ [Filter] Removing filter:', filterKey);

    switch (filterKey) {
      case 'type':
        this.currentFilters.type = '';
        if (this.elements.activityTypeFilter) {
          this.elements.activityTypeFilter.value = '';
        }
        if (this.elements.filterActivityTypeBtn) {
          this.updateFilterButton(this.elements.filterActivityTypeBtn, '');
        }
        break;

      case 'dateRange':
        this.currentFilters.dateRange = null;
        if (this.elements.dateRangeBtn) {
          this.updateFilterButton(this.elements.dateRangeBtn, '');
        }
        break;

      case 'search':
        this.searchTerm = '';
        if (this.elements.searchInput) {
          this.elements.searchInput.value = '';
          if (this.elements.searchClearBtn) {
            this.elements.searchClearBtn.classList.add('hidden');
          }
        }
        break;
    }

    // Reload activities and update badges
    this.resetPagination();
    this.loadActivities();
    this.renderActiveFilterBadges();
  }

  /**
   * Update filter button to show active filter
   */
  updateFilterButton(button, filterValue) {
    if (!button) return;

    const span = button.querySelector('span');
    if (span) {
      if (filterValue) {
        // Show the selected filter value
        const filterText = this.elements.activityTypeFilter?.querySelector(`option[value="${filterValue}"]`)?.textContent || filterValue;
        span.textContent = filterText;
        button.classList.add('filter-active');
      } else {
        // Reset to default text
        span.textContent = 'Filter';
        button.classList.remove('filter-active');
      }
    }
  }

  /**
   * Show date range selector (simplified version)
   */
  showDateRangeSelector() {
    // Create a simple date range selector modal
    const ranges = [
      { label: 'Last 7 days', days: 7 },
      { label: 'Last 30 days', days: 30 },
      { label: 'Last 90 days', days: 90 },
      { label: 'This year', days: 365 },
      { label: 'All time', days: null }
    ];

    const options = ranges.map(range => `<option value="${range.days || ''}">${range.label}</option>`).join('');

    const dateRangeHtml = `
      <div class="date-range-modal" id="date-range-modal">
        <div class="date-range-content">
          <h3>Select Date Range</h3>
          <select id="date-range-select" class="date-range-select">
            <option value="">All time</option>
            ${options}
          </select>
          <div class="date-range-actions">
            <button type="button" class="btn-secondary" id="date-range-cancel">Cancel</button>
            <button type="button" class="btn-primary" id="date-range-apply">Apply</button>
          </div>
        </div>
      </div>
    `;

    // Add to DOM
    const modalDiv = document.createElement('div');
    modalDiv.innerHTML = dateRangeHtml;
    document.body.appendChild(modalDiv.firstElementChild);

    // Event listeners for modal
    const modal = document.getElementById('date-range-modal');
    const select = document.getElementById('date-range-select');
    const cancelBtn = document.getElementById('date-range-cancel');
    const applyBtn = document.getElementById('date-range-apply');

    // Set current value if exists
    if (this.currentFilters.dateRange) {
      select.value = this.currentFilters.dateRange;
    }

    cancelBtn.addEventListener('click', () => {
      modal.remove();
    });

    applyBtn.addEventListener('click', () => {
      const selectedDays = select.value;
      console.log('📅 [Filter] Date range applied:', selectedDays || 'All time');

      this.currentFilters.dateRange = selectedDays;
      this.updateFilterButton(this.elements.dateRangeBtn, selectedDays);

      modal.remove();
      this.resetPagination();
      this.loadActivities();
      this.renderActiveFilterBadges();
    });

    // Close on outside click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  /**
   * Handle quick action button clicks
   */
  handleQuickAction(action, activity) {
    console.log('⚡ [Quick Action] Handling action:', action, 'for activity:', activity.name);

    switch (action) {
      case 'view-details':
        this.showActivityDetails(activity);
        break;
      case 'create-poster':
        this.createMapForActivity(activity);
        break;
      case 'share':
        this.shareActivity(activity);
        break;
      default:
        console.warn('⚠️ [Quick Action] Unknown action:', action);
    }
  }

  /**
   * Show activity details modal/panel
   */
  showActivityDetails(activity) {
    console.log('👁️ [Details] Showing details for activity:', activity.name);

    const date = new Date(activity.start_date_local);
    const formattedDate = date.toLocaleDateString("en-US", {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const distance = (activity.distance / 1000).toFixed(2);
    const duration = this.formatDuration(activity.moving_time);
    const elevation = Math.round(activity.total_elevation_gain || 0);
    const avgSpeed = activity.average_speed ? (activity.average_speed * 3.6).toFixed(1) : 'N/A';
    const maxSpeed = activity.max_speed ? (activity.max_speed * 3.6).toFixed(1) : 'N/A';
    const avgHeartRate = activity.average_heartrate || 'N/A';
    const maxHeartRate = activity.max_heartrate || 'N/A';

    // Create modal HTML
    const modalHtml = `
      <div class="activity-details-modal" id="activity-details-modal">
        <div class="activity-details-overlay"></div>
        <div class="activity-details-content">
          <div class="activity-details-header">
            <h2>${this.escapeHtml(activity.name)}</h2>
            <button class="activity-details-close" aria-label="Close details">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="activity-details-body">
            <div class="activity-details-meta">
              <p><strong>Date:</strong> ${formattedDate}</p>
              <p><strong>Type:</strong> ${activity.type || activity.sport_type}</p>
              ${activity.location_city || activity.location_country ? `
                <p><strong>Location:</strong> ${[activity.location_city, activity.location_state, activity.location_country].filter(Boolean).join(', ')}</p>
              ` : ''}
            </div>
            <div class="activity-details-stats">
              <div class="stat-row"><span>Distance:</span><strong>${distance} km</strong></div>
              <div class="stat-row"><span>Duration:</span><strong>${duration}</strong></div>
              <div class="stat-row"><span>Elevation Gain:</span><strong>${elevation} m</strong></div>
              <div class="stat-row"><span>Avg Speed:</span><strong>${avgSpeed} km/h</strong></div>
              <div class="stat-row"><span>Max Speed:</span><strong>${maxSpeed} km/h</strong></div>
              ${avgHeartRate !== 'N/A' ? `<div class="stat-row"><span>Avg Heart Rate:</span><strong>${avgHeartRate} bpm</strong></div>` : ''}
              ${maxHeartRate !== 'N/A' ? `<div class="stat-row"><span>Max Heart Rate:</span><strong>${maxHeartRate} bpm</strong></div>` : ''}
            </div>
            <div class="activity-details-actions">
              <button class="create-poster-button" data-activity-id="${activity.id}">
                CREATE POSTER
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                  <polyline points="12,5 19,12 12,19"/>
                </svg>
              </button>
              <a href="https://www.strava.com/activities/${activity.id}" target="_blank" rel="noopener" class="load-more-button">
                View on Strava
              </a>
            </div>
          </div>
        </div>
      </div>
    `;

    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Add event listeners
    const modal = document.getElementById('activity-details-modal');
    const closeBtn = modal.querySelector('.activity-details-close');
    const overlay = modal.querySelector('.activity-details-overlay');

    const closeModal = () => {
      modal.remove();
    };

    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);

    // Close on Escape key
    document.addEventListener('keydown', function escapeHandler(e) {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', escapeHandler);
      }
    });
  }

  /**
   * Share activity
   */
  shareActivity(activity) {
    console.log('📤 [Share] Sharing activity:', activity.name);

    const shareUrl = `https://www.strava.com/activities/${activity.id}`;
    const shareText = `Check out my ${activity.type || 'activity'}: ${activity.name}`;

    // Try native Web Share API first (mobile)
    if (navigator.share) {
      navigator.share({
        title: activity.name,
        text: shareText,
        url: shareUrl
      }).catch((error) => {
        console.log('🚨 [Share] Share cancelled or failed:', error);
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(shareUrl).then(() => {
        alert('Link copied to clipboard!');
      }).catch(() => {
        // Final fallback: show URL
        prompt('Copy this link:', shareUrl);
      });
    }
  }

  /**
   * Toggle activity selection for comparison
   */
  toggleActivitySelection(activity) {
    const activityId = activity.id;

    if (this.selectedActivities.has(activityId)) {
      this.selectedActivities.delete(activityId);
      console.log('☑️ [Selection] Deselected activity:', activityId);
    } else {
      this.selectedActivities.add(activityId);
      console.log('☑️ [Selection] Selected activity:', activityId);
    }

    // Update the UI
    this.updateCardSelectionUI(activityId);
    this.updateSelectionCount();
    this.updateBulkActionsToolbar();
  }

  /**
   * Update card selection UI state
   */
  updateCardSelectionUI(activityId) {
    const card = this.elements.grid.querySelector(`[data-activity-id="${activityId}"]`);
    if (!card) return;

    const isSelected = this.selectedActivities.has(activityId);
    const checkbox = card.querySelector('.activity-select-input');
    const checkboxContainer = card.querySelector('.activity-selection-checkbox');

    if (isSelected) {
      card.classList.add('selected');
      checkbox.checked = true;
      checkboxContainer.setAttribute('aria-checked', 'true');
    } else {
      card.classList.remove('selected');
      checkbox.checked = false;
      checkboxContainer.setAttribute('aria-checked', 'false');
    }
  }

  /**
   * Update compare button state and count
   */
  updateCompareButton() {
    if (!this.elements.compareButton || !this.elements.compareCount) return;

    const count = this.selectedActivities.size;
    this.elements.compareCount.textContent = count;

    // Enable button if 2 or more activities selected
    if (count >= 2) {
      this.elements.compareButton.disabled = false;
      this.elements.compareButton.classList.add('filter-active');
    } else {
      this.elements.compareButton.disabled = true;
      this.elements.compareButton.classList.remove('filter-active');
    }

    // Update bulk actions toolbar
    this.updateBulkActionsToolbar();
  }

  /**
   * Update bulk actions toolbar visibility and count
   */
  updateBulkActionsToolbar() {
    if (!this.elements.bulkActionsToolbar || !this.elements.bulkSelectedCount) return;

    const count = this.selectedActivities.size;
    this.elements.bulkSelectedCount.textContent = count;

    // Show toolbar if any activities are selected
    if (count > 0) {
      this.elements.bulkActionsToolbar.classList.remove('hidden');
    } else {
      this.elements.bulkActionsToolbar.classList.add('hidden');
    }
  }

  /**
   * Show activity comparison modal
   */
  showComparison() {
    console.log('📊 [Comparison] Showing comparison for:', Array.from(this.selectedActivities));

    // Get selected activities data
    const selectedActivitiesData = Array.from(this.selectedActivities)
      .map(id => this.activities.find(a => a.id === id))
      .filter(Boolean);

    if (selectedActivitiesData.length < 2) {
      alert('Please select at least 2 activities to compare.');
      return;
    }

    // Create comparison modal HTML
    const modalHtml = `
      <div class="activity-comparison-modal" id="activity-comparison-modal">
        <div class="activity-comparison-overlay"></div>
        <div class="activity-comparison-content">
          <div class="activity-comparison-header">
            <h2>Activity Comparison</h2>
            <button class="activity-comparison-close" aria-label="Close comparison">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="activity-comparison-body">
            <div class="comparison-grid">
              ${selectedActivitiesData.map(activity => this.createComparisonCard(activity)).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Setup close handlers
    const modal = document.getElementById('activity-comparison-modal');
    const closeBtn = modal.querySelector('.activity-comparison-close');
    const overlay = modal.querySelector('.activity-comparison-overlay');

    const closeModal = () => {
      modal.remove();
    };

    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);

    // Close on Escape key
    document.addEventListener('keydown', function escapeHandler(e) {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', escapeHandler);
      }
    });
  }

  /**
   * Create comparison card HTML
   */
  createComparisonCard(activity) {
    const date = new Date(activity.start_date_local);
    const formattedDate = date.toLocaleDateString("en-US", {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    const distance = (activity.distance / 1000).toFixed(2);
    const duration = this.formatDuration(activity.moving_time);
    const elevation = Math.round(activity.total_elevation_gain || 0);
    const avgSpeed = activity.average_speed ? (activity.average_speed * 3.6).toFixed(1) : 'N/A';
    const avgPace = activity.average_speed ? this.formatPace(activity.average_speed) : 'N/A';

    return `
      <div class="comparison-card">
        <div class="comparison-card-header">
          <h3>${this.escapeHtml(activity.name || 'Unnamed Activity')}</h3>
          <p class="comparison-date">${formattedDate}</p>
        </div>
        <div class="comparison-card-body">
          <div class="comparison-stat">
            <span class="comparison-stat-label">Distance</span>
            <span class="comparison-stat-value">${distance} km</span>
          </div>
          <div class="comparison-stat">
            <span class="comparison-stat-label">Duration</span>
            <span class="comparison-stat-value">${duration}</span>
          </div>
          <div class="comparison-stat">
            <span class="comparison-stat-label">Elevation</span>
            <span class="comparison-stat-value">${elevation} m</span>
          </div>
          <div class="comparison-stat">
            <span class="comparison-stat-label">Avg Speed</span>
            <span class="comparison-stat-value">${avgSpeed} km/h</span>
          </div>
          <div class="comparison-stat">
            <span class="comparison-stat-label">Avg Pace</span>
            <span class="comparison-stat-value">${avgPace}</span>
          </div>
          ${activity.average_heartrate ? `
            <div class="comparison-stat">
              <span class="comparison-stat-label">Avg Heart Rate</span>
              <span class="comparison-stat-value">${Math.round(activity.average_heartrate)} bpm</span>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Format pace (min/km)
   */
  formatPace(speedInMetersPerSecond) {
    if (!speedInMetersPerSecond || speedInMetersPerSecond === 0) return 'N/A';

    const paceInSeconds = 1000 / speedInMetersPerSecond; // seconds per km
    const minutes = Math.floor(paceInSeconds / 60);
    const seconds = Math.round(paceInSeconds % 60);

    return `${minutes}:${seconds.toString().padStart(2, '0')} /km`;
  }

  /**
   * Bulk create posters for selected activities
   */
  bulkCreatePosters() {
    if (this.selectedActivities.size === 0) {
      alert('Please select at least one activity.');
      return;
    }

    const selectedActivitiesData = Array.from(this.selectedActivities)
      .map(id => this.activities.find(a => a.id === id))
      .filter(Boolean);

    // Check if all selected activities have GPS data
    const activitiesWithoutGPS = selectedActivitiesData.filter(a => !a.map || !a.map.summary_polyline);

    if (activitiesWithoutGPS.length > 0) {
      const message = `${activitiesWithoutGPS.length} of ${selectedActivitiesData.length} selected activities do not have GPS data and will be skipped.`;
      if (!confirm(`${message}\n\nDo you want to continue with the remaining activities?`)) {
        return;
      }
    }

    const activitiesWithGPS = selectedActivitiesData.filter(a => a.map && a.map.summary_polyline);

    if (activitiesWithGPS.length === 0) {
      alert('None of the selected activities have GPS data available for map creation.');
      return;
    }

    console.log(`🖼️ [Bulk Actions] Creating posters for ${activitiesWithGPS.length} activities`);

    // For now, create poster for the first activity (in future, this could batch create)
    // This is a placeholder - actual implementation would need backend support for batch processing
    if (confirm(`This will create posters for ${activitiesWithGPS.length} activities. Start with the first one?`)) {
      this.createMapForActivity(activitiesWithGPS[0]);
    }
  }

  /**
   * Bulk export data for selected activities
   */
  bulkExportData() {
    if (this.selectedActivities.size === 0) {
      alert('Please select at least one activity.');
      return;
    }

    const selectedActivitiesData = Array.from(this.selectedActivities)
      .map(id => this.activities.find(a => a.id === id))
      .filter(Boolean);

    console.log('📥 [Bulk Actions] Exporting data for', selectedActivitiesData.length, 'activities');

    // Prepare CSV data
    const csvHeaders = [
      'Activity ID',
      'Name',
      'Type',
      'Date',
      'Distance (km)',
      'Duration',
      'Elevation Gain (m)',
      'Avg Speed (km/h)',
      'Avg Pace (min/km)',
      'Avg Heart Rate (bpm)',
      'Location'
    ];

    const csvRows = selectedActivitiesData.map(activity => {
      const date = new Date(activity.start_date_local).toISOString().split('T')[0];
      const distance = (activity.distance / 1000).toFixed(2);
      const duration = this.formatDuration(activity.moving_time);
      const elevation = Math.round(activity.total_elevation_gain || 0);
      const avgSpeed = activity.average_speed ? (activity.average_speed * 3.6).toFixed(1) : 'N/A';
      const avgPace = activity.average_speed ? this.formatPace(activity.average_speed) : 'N/A';
      const avgHeartRate = activity.average_heartrate ? Math.round(activity.average_heartrate) : 'N/A';
      const location = [activity.location_city, activity.location_state, activity.location_country]
        .filter(Boolean)
        .join(', ') || 'N/A';

      return [
        activity.id,
        `"${activity.name || 'Unnamed Activity'}"`,
        activity.type || 'Activity',
        date,
        distance,
        duration,
        elevation,
        avgSpeed,
        avgPace,
        avgHeartRate,
        `"${location}"`
      ];
    });

    // Convert to CSV string
    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.join(','))
    ].join('\n');

    // Create downloadable file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `strava-activities-${new Date().toISOString().split('T')[0]}.csv`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log('📥 [Bulk Actions] Data exported successfully');
  }

  /**
   * Deselect all activities
   */
  deselectAllActivities() {
    console.log('🧹 [Bulk Actions] Deselecting all activities');

    // Clear all selections
    this.selectedActivities.clear();

    // Update all card UIs
    const allCards = this.elements.grid.querySelectorAll('.activity-card.selected');
    allCards.forEach(card => {
      const activityId = card.dataset.activityId;
      this.updateCardSelectionUI(parseInt(activityId));
    });

    // Update buttons and toolbar
    this.updateSelectionCount();
    this.updateBulkActionsToolbar();
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
      // Hide statistics dashboard when no data
      if (this.elements.statisticsDashboard) {
        this.elements.statisticsDashboard.classList.remove('loaded');
      }
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

    // Show statistics dashboard with fade-in animation
    if (this.elements.statisticsDashboard) {
      // Small delay to ensure data is rendered first
      requestAnimationFrame(() => {
        this.elements.statisticsDashboard.classList.add('loaded');
      });
    }
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
      // Handle different field name formats (firstname vs first_name, etc.)
      const firstName = userInfo.firstname || userInfo.first_name || userInfo.firstName || '';
      const lastName = userInfo.lastname || userInfo.last_name || userInfo.lastName || '';
      const username = userInfo.username || userInfo.userName || '';

      // Build display name from available info
      const fullName = `${firstName} ${lastName}`.trim();
      const displayName = fullName || username || 'Strava User';

      this.elements.userName.textContent = displayName;
      console.log('👤 User status updated:', displayName, userInfo);

      if (this.elements.userConnectionStatus) {
        this.elements.userConnectionStatus.classList.remove('hidden');
      }
    } else {
      console.warn('⚠️ Could not update user status:', {
        hasElement: !!this.elements.userName,
        hasUserInfo: !!userInfo
      });
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