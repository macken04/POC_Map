/**
 * HTML Error Page Templates
 * Provides user-friendly error pages for browser-based OAuth flows
 */

class ErrorPageTemplates {
  /**
   * Generate complete HTML error page
   * @param {Object} errorInfo - Error information
   * @returns {string} Complete HTML page
   */
  static generateErrorPage(errorInfo) {
    const {
      title = 'Authentication Error',
      message = 'An error occurred during authentication',
      errorCode = 'unknown_error',
      errorId = null,
      retryUrl = '/auth/strava',
      homeUrl = '/',
      supportEmail = 'support@printmyride.com',
      showRetry = true,
      retryAfter = null
    } = errorInfo;

    const retryText = retryAfter 
      ? `Please wait ${Math.ceil(retryAfter / 60)} minutes before trying again.`
      : 'You can try again in a few moments.';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Print My Ride</title>
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 
                         'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            color: #333;
        }
        
        .error-container {
            background: white;
            border-radius: 12px;
            padding: 40px;
            max-width: 500px;
            width: 100%;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            text-align: center;
        }
        
        .error-icon {
            width: 80px;
            height: 80px;
            margin: 0 auto 24px;
            background: #ff4757;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 36px;
            color: white;
        }
        
        .error-title {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 16px;
            color: #2c3e50;
        }
        
        .error-message {
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 24px;
            color: #666;
        }
        
        .error-details {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 24px;
            font-size: 14px;
            color: #666;
        }
        
        .error-actions {
            display: flex;
            gap: 12px;
            justify-content: center;
            flex-wrap: wrap;
        }
        
        .btn {
            padding: 12px 24px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 500;
            border: none;
            cursor: pointer;
            transition: all 0.2s ease;
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }
        
        .btn-primary {
            background: #667eea;
            color: white;
        }
        
        .btn-primary:hover {
            background: #5a6fd8;
            transform: translateY(-1px);
        }
        
        .btn-secondary {
            background: #6c757d;
            color: white;
        }
        
        .btn-secondary:hover {
            background: #5a6268;
            transform: translateY(-1px);
        }
        
        .retry-info {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 6px;
            padding: 12px;
            margin-bottom: 20px;
            color: #856404;
            font-size: 14px;
        }
        
        .support-info {
            margin-top: 24px;
            padding-top: 24px;
            border-top: 1px solid #eee;
            font-size: 14px;
            color: #666;
        }
        
        .error-id {
            font-family: 'Courier New', monospace;
            background: #f1f3f4;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
        }
        
        @media (max-width: 480px) {
            .error-container {
                padding: 24px;
            }
            
            .error-actions {
                flex-direction: column;
            }
            
            .btn {
                width: 100%;
                justify-content: center;
            }
        }
    </style>
</head>
<body>
    <div class="error-container">
        <div class="error-icon">⚠️</div>
        
        <h1 class="error-title">${title}</h1>
        
        <p class="error-message">${message}</p>
        
        ${retryAfter ? `<div class="retry-info">${retryText}</div>` : ''}
        
        <div class="error-details">
            <strong>Error Code:</strong> ${errorCode}<br>
            ${errorId ? `<strong>Error ID:</strong> <span class="error-id">${errorId}</span><br>` : ''}
            <strong>Time:</strong> ${new Date().toLocaleString()}
        </div>
        
        <div class="error-actions">
            ${showRetry && !retryAfter ? `
                <a href="${retryUrl}" class="btn btn-primary">
                    🔄 Try Again
                </a>
            ` : ''}
            
            <a href="${homeUrl}" class="btn btn-secondary">
                🏠 Go Home
            </a>
        </div>
        
        <div class="support-info">
            <p>Still having trouble? <a href="mailto:${supportEmail}">Contact Support</a></p>
            ${errorId ? `<p>Include Error ID: <strong>${errorId}</strong></p>` : ''}
        </div>
    </div>

    <script>
        // Auto-retry functionality for rate limiting
        ${retryAfter ? `
            let retryTime = ${retryAfter};
            const retryCountdown = setInterval(() => {
                retryTime--;
                if (retryTime <= 0) {
                    clearInterval(retryCountdown);
                    // Add retry button
                    const actionsDiv = document.querySelector('.error-actions');
                    const retryBtn = document.createElement('a');
                    retryBtn.href = '${retryUrl}';
                    retryBtn.className = 'btn btn-primary';
                    retryBtn.innerHTML = '🔄 Try Again';
                    actionsDiv.insertBefore(retryBtn, actionsDiv.firstChild);
                    
                    // Remove retry info
                    const retryInfo = document.querySelector('.retry-info');
                    if (retryInfo) retryInfo.remove();
                }
            }, 1000);
        ` : ''}
        
        // Track error for analytics (if needed)
        console.log('OAuth Error:', {
            code: '${errorCode}',
            id: '${errorId}',
            timestamp: new Date().toISOString()
        });
    </script>
</body>
</html>
    `.trim();
  }

  /**
   * Generate specific error pages for common OAuth scenarios
   */
  
  static userDeniedAccess(errorId = null) {
    return this.generateErrorPage({
      title: 'Access Denied',
      message: 'You need to grant access to your Strava account to use this service. Your data will only be used to create personalized maps.',
      errorCode: 'access_denied',
      errorId,
      retryUrl: '/auth/strava',
      showRetry: true
    });
  }

  static rateLimited(retryAfter = 300, errorId = null) {
    return this.generateErrorPage({
      title: 'Too Many Requests',
      message: 'We\'ve hit the rate limit for Strava requests. This helps protect both services.',
      errorCode: 'rate_limited',
      errorId,
      retryAfter,
      showRetry: false
    });
  }

  static stravaServiceDown(errorId = null) {
    return this.generateErrorPage({
      title: 'Service Temporarily Unavailable',
      message: 'Strava\'s authentication service is temporarily unavailable. This is usually resolved quickly.',
      errorCode: 'service_unavailable',
      errorId,
      retryUrl: '/auth/strava',
      showRetry: true
    });
  }

  static networkError(errorId = null) {
    return this.generateErrorPage({
      title: 'Connection Error',
      message: 'Unable to connect to Strava. Please check your internet connection and try again.',
      errorCode: 'network_error',
      errorId,
      retryUrl: '/auth/strava',
      showRetry: true
    });
  }

  static invalidRequest(errorId = null) {
    return this.generateErrorPage({
      title: 'Invalid Request',
      message: 'The authentication request was invalid. This might be due to an expired or corrupted link.',
      errorCode: 'invalid_request',
      errorId,
      retryUrl: '/auth/strava',
      showRetry: true
    });
  }

  static securityError(errorId = null) {
    return this.generateErrorPage({
      title: 'Security Check Failed',
      message: 'For your security, the authentication request was rejected. Please start the login process again.',
      errorCode: 'security_error',
      errorId,
      retryUrl: '/auth/strava',
      showRetry: true
    });
  }

  static tokenExpired(errorId = null) {
    return this.generateErrorPage({
      title: 'Session Expired',
      message: 'Your Strava session has expired. Please log in again to continue using the service.',
      errorCode: 'token_expired',
      errorId,
      retryUrl: '/auth/strava',
      showRetry: true
    });
  }

  static serverError(errorId = null) {
    return this.generateErrorPage({
      title: 'Server Error',
      message: 'An unexpected error occurred on our server. Our team has been notified and will investigate.',
      errorCode: 'server_error',
      errorId,
      retryUrl: '/auth/strava',
      showRetry: true
    });
  }

  /**
   * Route handler for displaying error pages
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   */
  static errorPageHandler(req, res) {
    const { error, message, errorId, context } = req.query;
    
    // Map error codes to specific page generators
    const errorPageMap = {
      'access_denied': () => ErrorPageTemplates.userDeniedAccess(errorId),
      'user_denied': () => ErrorPageTemplates.userDeniedAccess(errorId),
      'rate_limited': () => ErrorPageTemplates.rateLimited(parseInt(req.query.retryAfter) || 300, errorId),
      'service_unavailable': () => ErrorPageTemplates.stravaServiceDown(errorId),
      'strava_service_error': () => ErrorPageTemplates.stravaServiceDown(errorId),
      'network_error': () => ErrorPageTemplates.networkError(errorId),
      'invalid_request': () => ErrorPageTemplates.invalidRequest(errorId),
      'security_error': () => ErrorPageTemplates.securityError(errorId),
      'state_mismatch': () => ErrorPageTemplates.securityError(errorId),
      'token_expired': () => ErrorPageTemplates.tokenExpired(errorId),
      'refresh_failed': () => ErrorPageTemplates.tokenExpired(errorId),
      'server_error': () => ErrorPageTemplates.serverError(errorId)
    };

    // Generate appropriate error page
    const pageGenerator = errorPageMap[error] || (() => ErrorPageTemplates.serverError(errorId));
    const htmlContent = pageGenerator();

    res.status(getStatusCodeForError(error)).type('html').send(htmlContent);
  }
}

/**
 * Helper function to get appropriate HTTP status code for error type
 * @param {string} errorCode - Error code
 * @returns {number} HTTP status code
 */
function getStatusCodeForError(errorCode) {
  const statusMap = {
    'access_denied': 400,
    'user_denied': 400,
    'invalid_request': 400,
    'security_error': 400,
    'state_mismatch': 400,
    'token_expired': 401,
    'refresh_failed': 401,
    'rate_limited': 429,
    'service_unavailable': 503,
    'strava_service_error': 503,
    'network_error': 503,
    'server_error': 500
  };

  return statusMap[errorCode] || 500;
}

module.exports = ErrorPageTemplates;