/**
 * Navigation Authentication Handler
 * Dynamically updates the "Create Map" navigation link based on Strava authentication state
 *
 * Features:
 * - Checks authentication status via /auth/status endpoint
 * - Updates both desktop and mobile navigation
 * - Handles loading states
 * - Graceful error handling with fallback to unauthenticated state
 * - Progressive enhancement (navigation works without JS)
 */

(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    authStatusEndpoint: 'https://boss-hog-freely.ngrok-free.app/auth/status',
    authStatusCheckTimeout: 5000, // 5 seconds timeout
    unauthenticatedText: 'Connect Strava',
    authenticatedText: 'Create Map',
    unauthenticatedUrl: '/pages/strava-login',
    authenticatedUrl: '/pages/strava-activities',
    ctaButtonClass: 'nav-cta-button',
    loadingClass: 'loading',
    retryDelay: 1000, // 1 second retry delay
    maxRetries: 2
  };

  /**
   * Find all "Create Map" navigation links in the page
   * @returns {NodeList} All matching navigation links
   */
  function findCreateMapLinks() {
    // Find links by text content (works for both desktop and mobile menus)
    const links = document.querySelectorAll('a.nav-cta-button, a[href*="strava"], .header__menu-item a, .menu-drawer__menu-item a');
    const createMapLinks = [];

    links.forEach(link => {
      const text = link.textContent.trim();
      if (text === CONFIG.unauthenticatedText ||
          text === CONFIG.authenticatedText ||
          text === 'Create Map' ||
          link.href.includes('strava-login') ||
          link.href.includes('strava-activities')) {
        createMapLinks.push(link);
      }
    });

    return createMapLinks;
  }

  /**
   * Update a navigation link with new text and URL
   * @param {HTMLAnchorElement} link - The link element to update
   * @param {string} text - New link text
   * @param {string} url - New link URL
   */
  function updateLink(link, text, url) {
    link.textContent = text;
    link.href = url;
  }

  /**
   * Add loading state to links
   * @param {Array<HTMLAnchorElement>} links - Links to add loading state to
   */
  function addLoadingState(links) {
    links.forEach(link => {
      link.classList.add(CONFIG.loadingClass);
      link.setAttribute('aria-busy', 'true');
    });
  }

  /**
   * Remove loading state from links
   * @param {Array<HTMLAnchorElement>} links - Links to remove loading state from
   */
  function removeLoadingState(links) {
    links.forEach(link => {
      link.classList.remove(CONFIG.loadingClass);
      link.removeAttribute('aria-busy');
    });
  }

  /**
   * Update all navigation links based on authentication state
   * @param {boolean} isAuthenticated - Whether user is authenticated with Strava
   */
  function updateNavigationLinks(isAuthenticated) {
    const links = findCreateMapLinks();

    if (links.length === 0) {
      console.warn('NavAuthHandler: No "Create Map" links found in navigation');
      return;
    }

    const text = isAuthenticated ? CONFIG.authenticatedText : CONFIG.unauthenticatedText;
    const url = isAuthenticated ? CONFIG.authenticatedUrl : CONFIG.unauthenticatedUrl;

    links.forEach(link => {
      updateLink(link, text, url);
      console.log(`NavAuthHandler: Updated link to "${text}" (${url})`);
    });

    removeLoadingState(links);
  }

  /**
   * Check authentication status with the backend
   * @param {number} attempt - Current retry attempt number
   * @returns {Promise<boolean>} Promise resolving to authentication status
   */
  async function checkAuthenticationStatus(attempt = 1) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.authStatusCheckTimeout);

      const response = await fetch(CONFIG.authStatusEndpoint, {
        method: 'GET',
        credentials: 'include', // Include session cookies
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`NavAuthHandler: Auth status check returned ${response.status}`);
        return false;
      }

      const data = await response.json();
      return data.authenticated === true;

    } catch (error) {
      console.error(`NavAuthHandler: Auth status check failed (attempt ${attempt}):`, error.message);

      // Retry logic
      if (attempt < CONFIG.maxRetries) {
        console.log(`NavAuthHandler: Retrying in ${CONFIG.retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, CONFIG.retryDelay));
        return checkAuthenticationStatus(attempt + 1);
      }

      // Default to unauthenticated on error
      return false;
    }
  }

  /**
   * Initialize the authentication handler
   */
  async function initialize() {
    const links = findCreateMapLinks();

    if (links.length === 0) {
      console.log('NavAuthHandler: No Create Map links found, skipping initialization');
      return;
    }

    console.log(`NavAuthHandler: Found ${links.length} Create Map link(s), checking authentication status...`);

    // Add loading state
    addLoadingState(links);

    // Check authentication status
    const isAuthenticated = await checkAuthenticationStatus();

    console.log(`NavAuthHandler: Authentication status: ${isAuthenticated ? 'authenticated' : 'not authenticated'}`);

    // Update navigation links
    updateNavigationLinks(isAuthenticated);
  }

  /**
   * Add smooth scroll behavior for anchor links
   */
  function setupSmoothScroll() {
    document.addEventListener('click', function(event) {
      const link = event.target.closest('a[href^="/#"]');

      if (!link) return;

      const targetId = link.getAttribute('href').substring(2); // Remove '/#'
      const targetElement = document.getElementById(targetId);

      if (targetElement) {
        event.preventDefault();
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });

        // Update URL without triggering navigation
        if (history.pushState) {
          history.pushState(null, null, `#${targetId}`);
        }
      }
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      initialize();
      setupSmoothScroll();
    });
  } else {
    // DOM is already ready
    initialize();
    setupSmoothScroll();
  }

  // Re-check authentication status when user returns to page
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
      console.log('NavAuthHandler: Page visible, re-checking authentication status...');
      initialize();
    }
  });

  // Expose public API for manual refresh if needed
  window.NavAuthHandler = {
    refresh: initialize,
    checkStatus: checkAuthenticationStatus
  };

})();
