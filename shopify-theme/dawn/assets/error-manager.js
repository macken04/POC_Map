/**
 * Centralized Error Management System for Route Rendering
 * Provides unified error handling, user notifications, and recovery strategies
 * across all frontend components of the map generation system.
 * 
 * Features:
 * - Error categorization and severity levels
 * - User-friendly notification system
 * - Context-aware recovery suggestions
 * - Error logging and analytics
 * - Cross-component error state management
 */

class ErrorManager {
  constructor(options = {}) {
    this.options = Object.assign({
      // Notification settings
      showNotifications: true,
      notificationDuration: 5000,
      maxNotifications: 3,
      
      // Logging settings  
      enableLogging: true,
      enableAnalytics: false,
      logLevel: 'warn', // 'error', 'warn', 'info', 'debug'
      
      // Recovery settings
      enableAutoRetry: true,
      maxRetryAttempts: 3,
      retryDelay: 1000,
      
      // UI settings
      notificationContainer: 'error-notifications',
      modalContainer: 'error-modal',
      
      // Performance settings
      enablePerformanceMonitoring: true,
      performanceThresholds: {
        memoryUsage: 100 * 1024 * 1024, // 100MB
        responseTime: 5000, // 5 seconds
        renderTime: 2000 // 2 seconds
      }
    }, options);

    // Error tracking and state
    this.errors = new Map();
    this.errorHistory = [];
    this.activeNotifications = new Set();
    this.errorCounters = new Map();
    this.retryAttempts = new Map();
    
    // Performance monitoring
    this.performanceMetrics = {
      memoryUsage: 0,
      responseTime: 0,
      renderTime: 0,
      errorRate: 0
    };

    // Initialize UI components
    this.initializeUI();
    
    // Global error handler
    this.setupGlobalErrorHandling();
    
    console.log('ErrorManager initialized with options:', this.options);
  }

  /**
   * Error Categories and Types
   */
  static ERROR_CATEGORIES = {
    NETWORK: 'network',
    VALIDATION: 'validation', 
    RENDERING: 'rendering',
    SYSTEM: 'system',
    PERFORMANCE: 'performance',
    AUTHENTICATION: 'authentication',
    DATA_PROCESSING: 'data_processing'
  };

  static ERROR_SEVERITY = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
  };

  static ERROR_TYPES = {
    // Network errors
    NETWORK_CONNECTION: 'network_connection',
    API_REQUEST_FAILED: 'api_request_failed',
    TIMEOUT: 'timeout',
    RATE_LIMIT: 'rate_limit',
    
    // Validation errors
    INVALID_INPUT: 'invalid_input',
    COORDINATE_VALIDATION: 'coordinate_validation',
    FILE_FORMAT: 'file_format',
    DATA_INTEGRITY: 'data_integrity',
    
    // Rendering errors
    MAP_INITIALIZATION: 'map_initialization',
    ROUTE_RENDERING: 'route_rendering',
    LAYER_CREATION: 'layer_creation',
    STYLE_LOADING: 'style_loading',
    
    // System errors
    MEMORY_LIMIT: 'memory_limit',
    BROWSER_COMPATIBILITY: 'browser_compatibility',
    PERMISSION_DENIED: 'permission_denied',
    
    // Performance errors
    SLOW_RESPONSE: 'slow_response',
    HIGH_MEMORY_USAGE: 'high_memory_usage',
    RENDER_TIMEOUT: 'render_timeout'
  };

  /**
   * Initialize UI components for error notifications
   */
  initializeUI() {
    // Create notification container if it doesn't exist
    if (!document.getElementById(this.options.notificationContainer)) {
      const container = document.createElement('div');
      container.id = this.options.notificationContainer;
      container.className = 'error-notifications-container';
      container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        max-width: 400px;
        pointer-events: none;
      `;
      document.body.appendChild(container);
    }

    // Create modal container if it doesn't exist
    if (!document.getElementById(this.options.modalContainer)) {
      const modal = document.createElement('div');
      modal.id = this.options.modalContainer;
      modal.className = 'error-modal-container';
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        z-index: 10001;
        display: none;
        align-items: center;
        justify-content: center;
      `;
      document.body.appendChild(modal);
    }

    // Add CSS styles for error components
    this.addErrorStyles();
  }

  /**
   * Add CSS styles for error notifications and modals
   */
  addErrorStyles() {
    if (document.getElementById('error-manager-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'error-manager-styles';
    styles.textContent = `
      .error-notification {
        background: #ff4444;
        color: white;
        padding: 12px 16px;
        margin-bottom: 10px;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        pointer-events: auto;
        opacity: 0;
        transform: translateX(100%);
        transition: all 0.3s ease;
        position: relative;
        max-width: 100%;
        word-wrap: break-word;
      }

      .error-notification.show {
        opacity: 1;
        transform: translateX(0);
      }

      .error-notification.warning {
        background: #ff9900;
      }

      .error-notification.info {
        background: #0099ff;
      }

      .error-notification.success {
        background: #00cc44;
      }

      .error-notification-close {
        position: absolute;
        top: 8px;
        right: 8px;
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0.7;
      }

      .error-notification-close:hover {
        opacity: 1;
      }

      .error-notification-content {
        margin-right: 24px;
      }

      .error-notification-title {
        font-weight: bold;
        margin-bottom: 4px;
      }

      .error-notification-message {
        font-size: 14px;
        line-height: 1.4;
      }

      .error-notification-actions {
        margin-top: 8px;
      }

      .error-notification-action {
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        padding: 4px 8px;
        border-radius: 3px;
        cursor: pointer;
        font-size: 12px;
        margin-right: 8px;
      }

      .error-notification-action:hover {
        background: rgba(255, 255, 255, 0.3);
      }

      .error-modal {
        background: white;
        border-radius: 8px;
        padding: 24px;
        max-width: 500px;
        width: 90%;
        max-height: 80%;
        overflow-y: auto;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      }

      .error-modal-header {
        border-bottom: 1px solid #eee;
        padding-bottom: 16px;
        margin-bottom: 16px;
      }

      .error-modal-title {
        font-size: 18px;
        font-weight: bold;
        color: #333;
        margin: 0;
      }

      .error-modal-content {
        color: #666;
        line-height: 1.6;
      }

      .error-modal-actions {
        text-align: right;
        margin-top: 24px;
        padding-top: 16px;
        border-top: 1px solid #eee;
      }

      .error-modal-button {
        background: #007cba;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        margin-left: 8px;
      }

      .error-modal-button:hover {
        background: #005a87;
      }

      .error-modal-button.secondary {
        background: #ccc;
        color: #333;
      }

      .error-modal-button.secondary:hover {
        background: #bbb;
      }

      @media (max-width: 480px) {
        .error-notifications-container {
          left: 10px;
          right: 10px;
          top: 10px;
          max-width: none;
        }

        .error-modal {
          margin: 20px;
          width: calc(100% - 40px);
          padding: 16px;
        }
      }
    `;
    document.head.appendChild(styles);
  }

  /**
   * Setup global error handling
   */
  setupGlobalErrorHandling() {
    // Catch unhandled errors
    window.addEventListener('error', (event) => {
      this.handleError({
        type: ErrorManager.ERROR_TYPES.SYSTEM,
        category: ErrorManager.ERROR_CATEGORIES.SYSTEM,
        severity: ErrorManager.ERROR_SEVERITY.HIGH,
        message: event.message,
        details: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack
        }
      });
    });

    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError({
        type: ErrorManager.ERROR_TYPES.SYSTEM,
        category: ErrorManager.ERROR_CATEGORIES.SYSTEM,
        severity: ErrorManager.ERROR_SEVERITY.HIGH,
        message: 'Unhandled promise rejection',
        details: {
          reason: event.reason
        }
      });
    });
  }

  /**
   * Main error handling method
   * @param {Object} error - Error object with type, category, severity, message, and details
   * @param {Object} context - Additional context information
   */
  handleError(error, context = {}) {
    const errorId = this.generateErrorId();
    const timestamp = new Date().toISOString();
    
    const processedError = {
      id: errorId,
      timestamp,
      type: error.type || ErrorManager.ERROR_TYPES.SYSTEM,
      category: error.category || ErrorManager.ERROR_CATEGORIES.SYSTEM,
      severity: error.severity || ErrorManager.ERROR_SEVERITY.MEDIUM,
      message: error.message || 'An unknown error occurred',
      details: error.details || {},
      context: context,
      handled: false,
      retryable: this.isRetryable(error),
      recoveryActions: this.getRecoveryActions(error)
    };

    // Store error
    this.errors.set(errorId, processedError);
    this.errorHistory.push(processedError);
    
    // Update error counters
    const errorKey = `${processedError.category}_${processedError.type}`;
    this.errorCounters.set(errorKey, (this.errorCounters.get(errorKey) || 0) + 1);

    // Log error
    this.logError(processedError);

    // Show notification or modal based on severity
    if (this.options.showNotifications) {
      if (processedError.severity === ErrorManager.ERROR_SEVERITY.CRITICAL) {
        this.showErrorModal(processedError);
      } else {
        this.showErrorNotification(processedError);
      }
    }

    // Attempt automatic retry if enabled and error is retryable
    if (this.options.enableAutoRetry && processedError.retryable) {
      this.attemptRetry(processedError, context);
    }

    // Update performance metrics
    this.updateErrorMetrics();

    // Mark as handled
    processedError.handled = true;
    
    return errorId;
  }

  /**
   * Show error notification toast
   * @param {Object} error - Processed error object
   */
  showErrorNotification(error) {
    // Check notification limits
    if (this.activeNotifications.size >= this.options.maxNotifications) {
      return;
    }

    const container = document.getElementById(this.options.notificationContainer);
    if (!container) return;

    const notification = document.createElement('div');
    notification.className = `error-notification ${this.getSeverityClass(error.severity)}`;
    notification.dataset.errorId = error.id;

    const userMessage = this.getUserFriendlyMessage(error);
    const actions = this.getNotificationActions(error);

    notification.innerHTML = `
      <button class="error-notification-close" onclick="errorManager.dismissNotification('${error.id}')">&times;</button>
      <div class="error-notification-content">
        <div class="error-notification-title">${userMessage.title}</div>
        <div class="error-notification-message">${userMessage.message}</div>
        ${actions.length > 0 ? `
          <div class="error-notification-actions">
            ${actions.map(action => `
              <button class="error-notification-action" onclick="${action.callback}">
                ${action.label}
              </button>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;

    container.appendChild(notification);
    this.activeNotifications.add(error.id);

    // Animate in
    setTimeout(() => notification.classList.add('show'), 10);

    // Auto-dismiss after duration
    setTimeout(() => {
      this.dismissNotification(error.id);
    }, this.options.notificationDuration);
  }

  /**
   * Show error modal for critical errors
   * @param {Object} error - Processed error object
   */
  showErrorModal(error) {
    const container = document.getElementById(this.options.modalContainer);
    if (!container) return;

    const userMessage = this.getUserFriendlyMessage(error);
    const recoveryActions = error.recoveryActions;

    container.innerHTML = `
      <div class="error-modal">
        <div class="error-modal-header">
          <h3 class="error-modal-title">${userMessage.title}</h3>
        </div>
        <div class="error-modal-content">
          <p>${userMessage.message}</p>
          ${userMessage.details ? `<p><strong>Details:</strong> ${userMessage.details}</p>` : ''}
          ${recoveryActions.length > 0 ? `
            <p><strong>Suggested actions:</strong></p>
            <ul>
              ${recoveryActions.map(action => `<li>${action.description}</li>`).join('')}
            </ul>
          ` : ''}
        </div>
        <div class="error-modal-actions">
          ${recoveryActions.length > 0 ? `
            <button class="error-modal-button" onclick="${recoveryActions[0].callback}">
              ${recoveryActions[0].label}
            </button>
          ` : ''}
          <button class="error-modal-button secondary" onclick="errorManager.dismissModal()">
            Close
          </button>
        </div>
      </div>
    `;

    container.style.display = 'flex';
  }

  /**
   * Dismiss error notification
   * @param {string} errorId - Error ID to dismiss
   */
  dismissNotification(errorId) {
    const notification = document.querySelector(`[data-error-id="${errorId}"]`);
    if (notification) {
      notification.classList.remove('show');
      setTimeout(() => {
        notification.remove();
        this.activeNotifications.delete(errorId);
      }, 300);
    }
  }

  /**
   * Dismiss error modal
   */
  dismissModal() {
    const container = document.getElementById(this.options.modalContainer);
    if (container) {
      container.style.display = 'none';
      container.innerHTML = '';
    }
  }

  /**
   * Get user-friendly error messages
   * @param {Object} error - Error object
   * @returns {Object} User-friendly message object
   */
  getUserFriendlyMessage(error) {
    const messages = {
      [ErrorManager.ERROR_TYPES.NETWORK_CONNECTION]: {
        title: 'Connection Problem',
        message: 'Unable to connect to the server. Please check your internet connection and try again.',
        details: 'This usually resolves itself once your connection is restored.'
      },
      [ErrorManager.ERROR_TYPES.API_REQUEST_FAILED]: {
        title: 'Request Failed', 
        message: 'The server request failed. This might be a temporary issue.',
        details: 'Try refreshing the page or waiting a moment before trying again.'
      },
      [ErrorManager.ERROR_TYPES.RATE_LIMIT]: {
        title: 'Too Many Requests',
        message: 'You\'ve made too many requests too quickly. Please wait a moment before trying again.',
        details: 'This is a temporary limit to ensure good performance for all users.'
      },
      [ErrorManager.ERROR_TYPES.FILE_FORMAT]: {
        title: 'Invalid File Format',
        message: 'The uploaded file is not in a supported format. Please upload a GPX or TCX file.',
        details: 'Supported formats: .gpx, .tcx'
      },
      [ErrorManager.ERROR_TYPES.COORDINATE_VALIDATION]: {
        title: 'Invalid Coordinates',
        message: 'The route data contains invalid coordinate information.',
        details: 'Please check that your route file contains valid GPS coordinates.'
      },
      [ErrorManager.ERROR_TYPES.MAP_INITIALIZATION]: {
        title: 'Map Loading Error',
        message: 'Unable to initialize the map. This might be a temporary issue.',
        details: 'Try refreshing the page or check if your browser supports WebGL.'
      },
      [ErrorManager.ERROR_TYPES.ROUTE_RENDERING]: {
        title: 'Route Display Error',
        message: 'Unable to display the route on the map.',
        details: 'The route data might be corrupted or too large to display.'
      },
      [ErrorManager.ERROR_TYPES.MEMORY_LIMIT]: {
        title: 'Memory Limit Exceeded',
        message: 'The route data is too large for your device to process.',
        details: 'Try uploading a smaller route file or use a device with more memory.'
      },
      [ErrorManager.ERROR_TYPES.TIMEOUT]: {
        title: 'Request Timeout',
        message: 'The request took too long to complete.',
        details: 'This might be due to a large file or slow connection. Please try again.'
      }
    };

    return messages[error.type] || {
      title: 'Unexpected Error',
      message: error.message || 'An unexpected error occurred.',
      details: 'Please try refreshing the page or contact support if the problem persists.'
    };
  }

  /**
   * Get recovery actions for an error
   * @param {Object} error - Error object
   * @returns {Array} Array of recovery action objects
   */
  getRecoveryActions(error) {
    const actions = [];

    switch (error.type) {
      case ErrorManager.ERROR_TYPES.NETWORK_CONNECTION:
        actions.push({
          label: 'Retry',
          description: 'Try the request again',
          callback: 'errorManager.retryLastAction()'
        });
        break;

      case ErrorManager.ERROR_TYPES.FILE_FORMAT:
        actions.push({
          label: 'Choose Different File',
          description: 'Select a valid GPX or TCX file',
          callback: 'document.querySelector(\'input[type="file"]\').click()'
        });
        break;

      case ErrorManager.ERROR_TYPES.MAP_INITIALIZATION:
        actions.push({
          label: 'Refresh Page',
          description: 'Reload the page to reinitialize the map',
          callback: 'window.location.reload()'
        });
        break;

      case ErrorManager.ERROR_TYPES.RATE_LIMIT:
        actions.push({
          label: 'Wait and Retry',
          description: 'Wait a moment then try again',
          callback: 'setTimeout(() => errorManager.retryLastAction(), 5000)'
        });
        break;

      default:
        actions.push({
          label: 'Refresh Page',
          description: 'Reload the page and try again',
          callback: 'window.location.reload()'
        });
    }

    return actions;
  }

  /**
   * Get notification actions for an error
   * @param {Object} error - Error object  
   * @returns {Array} Array of notification action objects
   */
  getNotificationActions(error) {
    const actions = [];
    const recoveryActions = error.recoveryActions;

    if (recoveryActions.length > 0) {
      actions.push({
        label: recoveryActions[0].label,
        callback: recoveryActions[0].callback
      });
    }

    return actions;
  }

  /**
   * Check if an error is retryable
   * @param {Object} error - Error object
   * @returns {boolean} True if retryable
   */
  isRetryable(error) {
    const retryableTypes = [
      ErrorManager.ERROR_TYPES.NETWORK_CONNECTION,
      ErrorManager.ERROR_TYPES.TIMEOUT,
      ErrorManager.ERROR_TYPES.API_REQUEST_FAILED
    ];

    return retryableTypes.includes(error.type);
  }

  /**
   * Attempt automatic retry
   * @param {Object} error - Error object
   * @param {Object} context - Context information including retry function
   */
  attemptRetry(error, context) {
    const retryKey = `${error.category}_${error.type}`;
    const currentAttempts = this.retryAttempts.get(retryKey) || 0;

    if (currentAttempts >= this.options.maxRetryAttempts) {
      return false;
    }

    this.retryAttempts.set(retryKey, currentAttempts + 1);

    setTimeout(() => {
      if (context.retryFunction && typeof context.retryFunction === 'function') {
        context.retryFunction();
      }
    }, this.options.retryDelay * (currentAttempts + 1)); // Exponential backoff

    return true;
  }

  /**
   * Log error based on configured log level
   * @param {Object} error - Error object
   */
  logError(error) {
    if (!this.options.enableLogging) return;

    const logMessage = `[${error.severity.toUpperCase()}] ${error.category}:${error.type} - ${error.message}`;
    const logData = {
      error,
      timestamp: error.timestamp,
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    switch (error.severity) {
      case ErrorManager.ERROR_SEVERITY.CRITICAL:
        console.error(logMessage, logData);
        break;
      case ErrorManager.ERROR_SEVERITY.HIGH:
        console.error(logMessage, logData);
        break;
      case ErrorManager.ERROR_SEVERITY.MEDIUM:
        console.warn(logMessage, logData);
        break;
      case ErrorManager.ERROR_SEVERITY.LOW:
        console.info(logMessage, logData);
        break;
    }

    // Send to analytics if enabled
    if (this.options.enableAnalytics) {
      this.sendErrorAnalytics(error);
    }
  }

  /**
   * Send error data to analytics
   * @param {Object} error - Error object
   */
  sendErrorAnalytics(error) {
    // Implement analytics integration here
    // Could integrate with Google Analytics, custom analytics endpoint, etc.
    console.log('Analytics: Error reported', {
      category: error.category,
      type: error.type,
      severity: error.severity,
      message: error.message
    });
  }

  /**
   * Update performance metrics
   */
  updateErrorMetrics() {
    const totalErrors = this.errorHistory.length;
    const recentErrors = this.errorHistory.filter(
      error => Date.now() - new Date(error.timestamp).getTime() < 300000 // Last 5 minutes
    ).length;

    this.performanceMetrics.errorRate = totalErrors > 0 ? (recentErrors / totalErrors) * 100 : 0;

    // Monitor memory usage if available
    if (performance.memory) {
      this.performanceMetrics.memoryUsage = performance.memory.usedJSHeapSize;
      
      if (this.performanceMetrics.memoryUsage > this.options.performanceThresholds.memoryUsage) {
        this.handleError({
          type: ErrorManager.ERROR_TYPES.HIGH_MEMORY_USAGE,
          category: ErrorManager.ERROR_CATEGORIES.PERFORMANCE,
          severity: ErrorManager.ERROR_SEVERITY.MEDIUM,
          message: 'High memory usage detected',
          details: {
            memoryUsage: this.performanceMetrics.memoryUsage,
            threshold: this.options.performanceThresholds.memoryUsage
          }
        });
      }
    }
  }

  /**
   * Get severity CSS class
   * @param {string} severity - Error severity
   * @returns {string} CSS class name
   */
  getSeverityClass(severity) {
    switch (severity) {
      case ErrorManager.ERROR_SEVERITY.LOW:
        return 'info';
      case ErrorManager.ERROR_SEVERITY.MEDIUM:
        return 'warning';
      case ErrorManager.ERROR_SEVERITY.HIGH:
      case ErrorManager.ERROR_SEVERITY.CRITICAL:
        return '';
      default:
        return 'warning';
    }
  }

  /**
   * Generate unique error ID
   * @returns {string} Unique error identifier
   */
  generateErrorId() {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get error statistics
   * @returns {Object} Error statistics
   */
  getErrorStats() {
    return {
      totalErrors: this.errorHistory.length,
      errorsByCategory: Object.fromEntries(this.errorCounters),
      performanceMetrics: this.performanceMetrics,
      activeNotifications: this.activeNotifications.size
    };
  }

  /**
   * Clear error history
   * @param {number} olderThanHours - Clear errors older than specified hours
   */
  clearErrorHistory(olderThanHours = 24) {
    const cutoffTime = Date.now() - (olderThanHours * 60 * 60 * 1000);
    this.errorHistory = this.errorHistory.filter(
      error => new Date(error.timestamp).getTime() > cutoffTime
    );
  }

  /**
   * Destroy error manager and cleanup
   */
  destroy() {
    // Clear all notifications
    this.activeNotifications.forEach(errorId => this.dismissNotification(errorId));
    
    // Clear modal
    this.dismissModal();
    
    // Remove global error handlers
    window.removeEventListener('error', this.setupGlobalErrorHandling);
    window.removeEventListener('unhandledrejection', this.setupGlobalErrorHandling);
    
    // Clear data
    this.errors.clear();
    this.errorHistory = [];
    this.activeNotifications.clear();
    this.errorCounters.clear();
    this.retryAttempts.clear();
    
    console.log('ErrorManager destroyed');
  }
}

// Create global instance
window.errorManager = new ErrorManager({
  showNotifications: true,
  enableLogging: true,
  enableAutoRetry: true,
  maxRetryAttempts: 3
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ErrorManager;
}