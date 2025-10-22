/**
 * Authentication Utilities for Cross-Domain Shopify Integration
 * Manages session tokens for communication with local backend server
 */

class AuthUtils {
  constructor() {
    this.TOKEN_KEY = 'strava_session_token';
    this.TOKEN_EXPIRY_KEY = 'strava_token_expiry';
    this.sessionToken = null;
    this.init();
  }

  /**
   * Initialize authentication utilities
   */
  init() {
    // Try to extract token from URL first
    this.extractTokenFromURL();
    
    // If not found in URL, try to load from storage
    if (!this.sessionToken) {
      this.loadTokenFromStorage();
    }
    
    console.log('🔍 [AuthUtils] Initialized:', {
      hasToken: !!this.sessionToken,
      tokenExpiry: this.getTokenExpiry(),
      currentUrl: window.location.href,
      tokenKeys: {
        TOKEN_KEY: this.TOKEN_KEY,
        TOKEN_EXPIRY_KEY: this.TOKEN_EXPIRY_KEY
      }
    });
  }

  /**
   * Extract session token from URL parameters
   */
  extractTokenFromURL() {
    console.log('🔍 [AuthUtils] extractTokenFromURL() called');
    console.log('🔍 [AuthUtils] Current URL:', window.location.href);
    console.log('🔍 [AuthUtils] URL search params:', window.location.search);
    
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    console.log('🔍 [AuthUtils] Token found in URL:', token ? 'YES (length=' + token.length + ')' : 'NO');
    
    if (token) {
      this.sessionToken = token;
      console.log('✅ [AuthUtils] Cross-domain session token captured from URL');
      console.log('🔍 [AuthUtils] Storing token persistently...');
      
      // Store token persistently
      this.storeToken(token);
      
      console.log('🔍 [AuthUtils] Token stored. Cleaning up URL...');
      
      // Clean up the URL by removing the token parameter
      if (history.replaceState) {
        urlParams.delete('token');
        const cleanUrl = `${window.location.pathname}${urlParams.toString() ? '?' + urlParams.toString() : ''}`;
        history.replaceState({}, document.title, cleanUrl);
        console.log('✅ [AuthUtils] Token parameter removed from URL, new URL:', cleanUrl);
      }
    } else {
      console.log('⚠️ [AuthUtils] No token found in URL parameters');
    }
  }

  /**
   * Load token from localStorage
   */
  loadTokenFromStorage() {
    try {
      const storedToken = localStorage.getItem(this.TOKEN_KEY);
      const tokenExpiry = localStorage.getItem(this.TOKEN_EXPIRY_KEY);
      
      if (storedToken && tokenExpiry) {
        const expiryTime = parseInt(tokenExpiry);
        const now = Date.now();
        
        if (now < expiryTime) {
          this.sessionToken = storedToken;
          console.log('Session token loaded from storage');
        } else {
          console.log('Stored token expired, clearing storage');
          this.clearToken();
        }
      }
    } catch (error) {
      console.warn('Failed to load token from storage:', error);
    }
  }

  /**
   * Store token in localStorage with expiry
   * @param {string} token - Session token
   * @param {number} expiryMinutes - Token expiry in minutes (default: 60)
   */
  storeToken(token, expiryMinutes = 60) {
    console.log('🔍 [AuthUtils] storeToken() called with token length:', token ? token.length : 'NULL');
    console.log('🔍 [AuthUtils] Expiry minutes:', expiryMinutes);
    
    try {
      const expiryTime = Date.now() + (expiryMinutes * 60 * 1000);
      console.log('🔍 [AuthUtils] Setting localStorage keys:', this.TOKEN_KEY, 'and', this.TOKEN_EXPIRY_KEY);
      console.log('🔍 [AuthUtils] Expiry time calculated:', new Date(expiryTime));
      
      localStorage.setItem(this.TOKEN_KEY, token);
      localStorage.setItem(this.TOKEN_EXPIRY_KEY, expiryTime.toString());
      this.sessionToken = token;
      
      console.log('✅ [AuthUtils] Session token stored successfully with expiry:', new Date(expiryTime));
      
      // Verify storage worked
      const storedToken = localStorage.getItem(this.TOKEN_KEY);
      const storedExpiry = localStorage.getItem(this.TOKEN_EXPIRY_KEY);
      console.log('🔍 [AuthUtils] Verification - stored token exists:', !!storedToken);
      console.log('🔍 [AuthUtils] Verification - stored expiry exists:', !!storedExpiry);
    } catch (error) {
      console.warn('❌ [AuthUtils] Failed to store token:', error);
    }
  }

  /**
   * Clear stored token
   */
  clearToken() {
    try {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.TOKEN_EXPIRY_KEY);
      this.sessionToken = null;
      console.log('Session token cleared');
    } catch (error) {
      console.warn('Failed to clear token:', error);
    }
  }

  /**
   * Get current session token
   * @returns {string|null} Session token or null if not available
   */
  getToken() {
    console.log('🔍 [AuthUtils] getToken() called, sessionToken exists:', !!this.sessionToken);
    if (this.sessionToken) {
      const isValid = this.isTokenValid();
      console.log('🔍 [AuthUtils] Token validity check:', isValid);
      if (isValid) {
        console.log('🔍 [AuthUtils] Returning valid token');
        return this.sessionToken;
      } else {
        console.log('⚠️ [AuthUtils] Token expired or invalid');
      }
    }
    console.log('⚠️ [AuthUtils] No valid token available');
    return null;
  }

  /**
   * Check if current token is valid (not expired)
   * @returns {boolean} True if token is valid
   */
  isTokenValid() {
    if (!this.sessionToken) {
      console.log('🔍 [AuthUtils] isTokenValid: No session token');
      return false;
    }

    try {
      const tokenExpiry = localStorage.getItem(this.TOKEN_EXPIRY_KEY);
      console.log('🔍 [AuthUtils] Token expiry from storage:', tokenExpiry);
      if (!tokenExpiry) {
        console.log('⚠️ [AuthUtils] No expiry time found in storage');
        return false;
      }

      const expiryTime = parseInt(tokenExpiry);
      const now = Date.now();
      const timeUntilExpiry = expiryTime - now;
      
      console.log('🔍 [AuthUtils] Token expires in:', Math.round(timeUntilExpiry / 1000), 'seconds');
      
      return now < expiryTime;
    } catch (error) {
      console.warn('Error checking token validity:', error);
      return false;
    }
  }

  /**
   * Get token expiry time
   * @returns {Date|null} Expiry date or null if no token
   */
  getTokenExpiry() {
    try {
      const tokenExpiry = localStorage.getItem(this.TOKEN_EXPIRY_KEY);
      return tokenExpiry ? new Date(parseInt(tokenExpiry)) : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Enhanced fetch with automatic token inclusion
   * @param {string} url - Request URL
   * @param {Object} options - Fetch options
   * @returns {Promise<Response>} Fetch response
   */
  async authenticatedFetch(url, options = {}) {
    const token = this.getToken();
    
    if (!token) {
      throw new Error('No authentication token available. Please re-authenticate.');
    }

    // Add token as query parameter
    const separator = url.includes('?') ? '&' : '?';
    const authenticatedUrl = `${url}${separator}token=${encodeURIComponent(token)}`;

    // Set default options with credentials
    const fetchOptions = {
      credentials: 'include',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    console.log('Making authenticated request:', {
      url: authenticatedUrl,
      method: fetchOptions.method || 'GET'
    });

    try {
      const response = await fetch(authenticatedUrl, fetchOptions);
      
      // Handle authentication errors
      if (response.status === 401) {
        console.warn('Authentication failed, clearing token');
        this.clearToken();
        throw new Error('Authentication expired. Please re-authenticate.');
      }
      
      return response;
    } catch (error) {
      console.error('Authenticated fetch failed:', error);
      throw error;
    }
  }

  /**
   * Check authentication status with backend
   * @returns {Promise<boolean>} True if authenticated
   */
  async checkAuthStatus() {
    const token = this.getToken();
    
    if (!token) {
      console.log('No token available for auth check');
      return false;
    }

    try {
      const response = await this.authenticatedFetch('/auth/status');
      
      if (response.ok) {
        const data = await response.json();
        console.log('Auth status check successful:', data);
        return data.authenticated || false;
      } else {
        console.warn('Auth status check failed:', response.status);
        return false;
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      return false;
    }
  }

  /**
   * Redirect to authentication if not authenticated
   * @param {string} returnUrl - URL to return to after auth (optional)
   */
  requireAuthentication(returnUrl = null) {
    const token = this.getToken();
    
    if (!token || !this.isTokenValid()) {
      console.log('Authentication required, redirecting...');
      
      // Build redirect URL
      const authUrl = new URL('/pages/strava-login', window.location.origin);
      
      if (returnUrl) {
        authUrl.searchParams.set('return', returnUrl);
      } else {
        authUrl.searchParams.set('return', window.location.pathname + window.location.search);
      }
      
      window.location.href = authUrl.toString();
      return false;
    }
    
    return true;
  }

  /**
   * Get authentication headers for manual fetch requests
   * @returns {Object} Headers object with authentication
   */
  getAuthHeaders() {
    const token = this.getToken();
    
    if (token) {
      return {
        'x-session-token': token,
        'Content-Type': 'application/json'
      };
    }
    
    return {
      'Content-Type': 'application/json'
    };
  }

  /**
   * Build authenticated URL with token parameter
   * @param {string} baseUrl - Base URL
   * @param {Object} params - Additional parameters
   * @returns {string} URL with token parameter
   */
  buildAuthenticatedUrl(baseUrl, params = {}) {
    const token = this.getToken();
    
    if (!token) {
      throw new Error('No authentication token available');
    }
    
    const url = new URL(baseUrl, window.location.origin);
    
    // Add token
    url.searchParams.set('token', token);
    
    // Add additional parameters
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        url.searchParams.set(key, value.toString());
      }
    });
    
    return url.toString();
  }

  /**
   * Store preview data for cross-page transfer
   * @param {Object} previewData - Preview data to store
   */
  storePreviewData(previewData) {
    try {
      const previewKey = 'map_preview_data';
      const dataWithTimestamp = {
        ...previewData,
        storedAt: Date.now()
      };
      
      sessionStorage.setItem(previewKey, JSON.stringify(dataWithTimestamp));
      console.log('Preview data stored for cross-page transfer');
    } catch (error) {
      console.warn('Failed to store preview data:', error);
    }
  }

  /**
   * Retrieve preview data from storage
   * @param {number} maxAgeMinutes - Maximum age in minutes (default: 10)
   * @returns {Object|null} Preview data or null if not found/expired
   */
  getPreviewData(maxAgeMinutes = 10) {
    try {
      const previewKey = 'map_preview_data';
      const storedData = sessionStorage.getItem(previewKey);
      
      if (!storedData) {
        return null;
      }
      
      const data = JSON.parse(storedData);
      const maxAge = maxAgeMinutes * 60 * 1000;
      const age = Date.now() - (data.storedAt || 0);
      
      if (age > maxAge) {
        console.log('Stored preview data expired, clearing');
        sessionStorage.removeItem(previewKey);
        return null;
      }
      
      return data;
    } catch (error) {
      console.warn('Failed to retrieve preview data:', error);
      return null;
    }
  }

  /**
   * Clear preview data from storage
   */
  clearPreviewData() {
    try {
      sessionStorage.removeItem('map_preview_data');
      console.log('Preview data cleared');
    } catch (error) {
      console.warn('Failed to clear preview data:', error);
    }
  }
}

// Create global instance
window.AuthUtils = new AuthUtils();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AuthUtils;
}