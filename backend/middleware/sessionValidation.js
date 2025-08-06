/**
 * Session Validation Middleware
 * Provides enhanced session validation and recovery mechanisms
 * for cross-domain Shopify integration
 */

/**
 * Validate and repair session for map preview operations
 * This middleware ensures session data exists and provides fallback mechanisms
 */
function validateMapSession(req, res, next) {
  console.log('[Session Validation] Validating map session...');
  console.log('[Session Validation] Session ID:', req.sessionID);
  console.log('[Session Validation] Session exists:', !!req.session);
  console.log('[Session Validation] Origin:', req.headers.origin);
  console.log('[Session Validation] Referer:', req.headers.referer);
  
  // Check if session exists
  if (!req.session) {
    console.error('[Session Validation] No session found - attempting recovery');
    return handleSessionError(req, res, 'No session found', {
      sessionExists: false,
      sessionId: req.sessionID || 'none'
    });
  }
  
  // Initialize session objects if they don't exist
  if (!req.session.mapPreviews) {
    console.log('[Session Validation] Initializing mapPreviews object');
    req.session.mapPreviews = {};
  }
  
  if (!req.session.confirmedMaps) {
    console.log('[Session Validation] Initializing confirmedMaps object');
    req.session.confirmedMaps = {};
  }
  
  console.log('[Session Validation] Session validation successful');
  next();
}

/**
 * Enhanced session validation for purchase operations
 * Includes additional checks for confirmed maps
 */
function validatePurchaseSession(req, res, next) {
  console.log('[Purchase Session Validation] Validating purchase session...');
  
  // First run standard map session validation
  validateMapSession(req, res, (err) => {
    if (err) return next(err);
    
    const { purchaseId } = req.params;
    
    // Check if confirmed map exists
    if (purchaseId && !req.session.confirmedMaps[purchaseId]) {
      console.error('[Purchase Session Validation] Confirmed map not found:', purchaseId);
      console.error('[Purchase Session Validation] Available purchase IDs:', Object.keys(req.session.confirmedMaps));
      
      // Attempt to recover from other session data
      const recoveredPurchase = attemptPurchaseRecovery(req, purchaseId);
      if (recoveredPurchase) {
        console.log('[Purchase Session Validation] Successfully recovered purchase data');
        req.session.confirmedMaps[purchaseId] = recoveredPurchase;
      } else {
        return handleSessionError(req, res, 'Confirmed map not found in session', {
          sessionExists: true,
          sessionId: req.sessionID,
          purchaseId: purchaseId,
          availablePurchaseIds: Object.keys(req.session.confirmedMaps || {}),
          recoveryAttempted: true
        });
      }
    }
    
    console.log('[Purchase Session Validation] Purchase session validation successful');
    next();
  });
}

/**
 * Attempt to recover purchase data from session or other sources
 */
function attemptPurchaseRecovery(req, purchaseId) {
  console.log('[Purchase Recovery] Attempting to recover purchase:', purchaseId);
  
  try {
    // Try to find matching preview data
    if (req.session.mapPreviews) {
      for (const [previewId, preview] of Object.entries(req.session.mapPreviews)) {
        if (preview.purchaseId === purchaseId || previewId.includes(purchaseId.split('_')[1])) {
          console.log('[Purchase Recovery] Found matching preview data:', previewId);
          
          // Reconstruct confirmed map data
          const confirmedMap = {
            previewId: previewId,
            purchaseId: purchaseId,
            printSize: preview.printSize || 'A4',
            printOrientation: preview.printOrientation || 'portrait',
            highResConfig: preview.highResConfig || preview.config,
            status: 'recovered',
            recoveredAt: new Date().toISOString(),
            originalPreview: preview
          };
          
          return confirmedMap;
        }
      }
    }
    
    // Try to recover from file system if available
    const fs = require('fs');
    const path = require('path');
    const recoveryPath = path.join(__dirname, '..', 'generated-maps', 'recovery', `${purchaseId}.json`);
    
    if (fs.existsSync(recoveryPath)) {
      console.log('[Purchase Recovery] Found recovery file:', recoveryPath);
      const recoveryData = JSON.parse(fs.readFileSync(recoveryPath, 'utf8'));
      return recoveryData;
    }
    
    console.log('[Purchase Recovery] No recovery data found');
    return null;
    
  } catch (error) {
    console.error('[Purchase Recovery] Recovery attempt failed:', error);
    return null;
  }
}

/**
 * Handle session errors with detailed logging and user-friendly responses
 */
function handleSessionError(req, res, message, debug = {}) {
  console.error('[Session Error]', message);
  console.error('[Session Error] Debug info:', JSON.stringify(debug, null, 2));
  
  const errorResponse = {
    error: 'Session Error',
    message: message,
    debug: debug,
    timestamp: new Date().toISOString(),
    suggestions: [
      'Clear your browser cookies and try again',
      'Ensure you completed the Strava authentication process',
      'Try refreshing the page and starting over',
      'Check that your browser allows cross-site cookies'
    ]
  };
  
  // Log to file for debugging
  logSessionError(req, message, debug);
  
  return res.status(400).json(errorResponse);
}

/**
 * Log session errors to file for debugging
 */
function logSessionError(req, message, debug) {
  try {
    const fs = require('fs');
    const path = require('path');
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      message: message,
      debug: debug,
      request: {
        url: req.url,
        method: req.method,
        headers: {
          origin: req.headers.origin,
          referer: req.headers.referer,
          userAgent: req.headers['user-agent'],
          cookie: req.headers.cookie ? 'present' : 'missing'
        },
        sessionID: req.sessionID
      }
    };
    
    const logDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const logFile = path.join(logDir, 'session-errors.log');
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
    
  } catch (error) {
    console.error('[Session Error Logging] Failed to log error:', error);
  }
}

/**
 * Middleware to save session data for recovery
 */
function saveSessionForRecovery(req, res, next) {
  // Add hook to save important session data
  const originalSend = res.send;
  res.send = function(data) {
    try {
      // Save session data if it contains important information
      if (req.session && (req.session.mapPreviews || req.session.confirmedMaps)) {
        saveSessionBackup(req);
      }
    } catch (error) {
      console.warn('[Session Backup] Failed to save session backup:', error);
    }
    
    return originalSend.call(this, data);
  };
  
  next();
}

/**
 * Save session backup to file system
 */
function saveSessionBackup(req) {
  try {
    const fs = require('fs');
    const path = require('path');
    
    const backupDir = path.join(__dirname, '..', 'generated-maps', 'recovery');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const sessionBackup = {
      sessionId: req.sessionID,
      timestamp: new Date().toISOString(),
      mapPreviews: req.session.mapPreviews || {},
      confirmedMaps: req.session.confirmedMaps || {}
    };
    
    const backupFile = path.join(backupDir, `session_${req.sessionID}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(sessionBackup, null, 2));
    
    console.log('[Session Backup] Session backed up to:', backupFile);
    
  } catch (error) {
    console.warn('[Session Backup] Failed to save session backup:', error);
  }
}

module.exports = {
  validateMapSession,
  validatePurchaseSession,
  saveSessionForRecovery,
  handleSessionError
};