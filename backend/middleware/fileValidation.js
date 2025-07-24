/**
 * File Validation Middleware
 * Handles file access validation, security checks, and user permissions
 * Provides secure file serving with proper access controls
 */

const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const FileNaming = require('../utils/fileNaming');
const fileStorageService = require('../services/fileStorageService');
const { FileErrorHandler } = require('../utils/fileErrors');

class FileValidationMiddleware {
  /**
   * Validate file access permissions
   * Ensures users can only access their own files
   */
  static validateFileAccess(options = {}) {
    const { requireAuth = true, allowAdminAccess = false } = options;

    return async (req, res, next) => {
      try {
        const { filename, type = 'permanent' } = req.params;
        const userId = req.session?.strava?.athlete?.id;

        // Check authentication if required
        if (requireAuth && !userId) {
          return res.status(401).json({
            error: 'Authentication required',
            message: 'You must be logged in to access files'
          });
        }

        // Validate filename format
        const validation = FileNaming.validateFilename(filename);
        if (!validation.isValid) {
          return res.status(400).json({
            error: 'Invalid filename',
            message: validation.errors ? validation.errors.join(', ') : 'Filename format is invalid'
          });
        }

        // Parse filename to get owner information
        const parsed = FileNaming.parseFilename(filename);
        if (!parsed.isValid) {
          return res.status(400).json({
            error: 'Cannot parse filename',
            message: 'Unable to extract metadata from filename'
          });
        }

        // Check if user owns the file (unless admin access is allowed)
        if (requireAuth && !allowAdminAccess && parsed.userId !== userId.toString()) {
          return res.status(403).json({
            error: 'Access denied',
            message: 'You do not have permission to access this file'
          });
        }

        // Validate storage type
        const storageService = fileStorageService;
        if (!storageService.directories[type]) {
          return res.status(400).json({
            error: 'Invalid storage type',  
            message: `Unknown storage type: ${type}`
          });
        }

        // Check if file exists
        const filePath = path.join(storageService.directories[type], filename);
        try {
          await fs.access(filePath);
        } catch (error) {
          return res.status(404).json({
            error: 'File not found',
            message: 'The requested file does not exist'
          });
        }

        // Add file information to request object for downstream middleware
        req.fileInfo = {
          filename,
          filePath,
          type,
          parsed,
          userId: parsed.userId,
          isOwner: parsed.userId === userId?.toString()
        };

        next();

      } catch (error) {
        console.error('FileValidationMiddleware: Validation error:', error);
        res.status(500).json({
          error: 'File validation failed',
          message: 'Unable to validate file access'
        });
      }
    };
  }

  /**
   * Validate file integrity using checksum
   */
  static validateFileIntegrity() {
    return async (req, res, next) => {
      try {
        const { filename, type } = req.fileInfo;

        // Get file metadata to check integrity
        try {
          const metadata = await fileStorageService.getFileMetadata(filename);
          
          // Verify checksum if available
          if (metadata.checksum) {
            const integrity = await fileStorageService.verifyFileIntegrity(filename, type);
            
            if (!integrity.isValid) {
              console.warn(`FileValidationMiddleware: File integrity check failed for ${filename}`);
              return res.status(410).json({
                error: 'File corrupted',
                message: 'The requested file appears to be corrupted'
              });
            }

            req.fileInfo.integrity = integrity;
          }

          req.fileInfo.metadata = metadata;

        } catch (metadataError) {
          // If metadata is missing, continue but log the issue
          console.warn(`FileValidationMiddleware: No metadata found for ${filename}:`, metadataError.message);
        }

        next();

      } catch (error) {
        console.error('FileValidationMiddleware: Integrity validation error:', error);
        res.status(500).json({
          error: 'File integrity check failed',
          message: 'Unable to verify file integrity'
        });
      }
    };
  }

  /**
   * Set appropriate caching headers based on file type
   */
  static setCacheHeaders() {
    return (req, res, next) => {
      try {
        const { type, parsed } = req.fileInfo;

        // Set cache headers based on storage type
        switch (type) {
          case 'permanent':
            // Permanent files can be cached for a long time
            res.set({
              'Cache-Control': 'public, max-age=31536000, immutable', // 1 year
              'ETag': `"${parsed.hash}"`,
              'Last-Modified': req.fileInfo.metadata?.createdAt ? 
                new Date(req.fileInfo.metadata.createdAt).toUTCString() : 
                new Date().toUTCString()
            });
            break;

          case 'temporary':
            // Temporary files should not be cached
            res.set({
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            });
            break;

          case 'processing':
            // Processing files should not be cached
            res.set({
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache'
            });
            break;

          default:
            // Default short-term caching
            res.set({
              'Cache-Control': 'public, max-age=3600', // 1 hour
              'ETag': `"${parsed.hash}"`
            });
        }

        // Set content type based on file extension
        const extension = parsed.extension.toLowerCase();
        switch (extension) {
          case 'png':
            res.set('Content-Type', 'image/png');
            break;
          case 'jpg':
          case 'jpeg':
            res.set('Content-Type', 'image/jpeg');
            break;
          case 'json':
            res.set('Content-Type', 'application/json');
            break;
          default:
            res.set('Content-Type', 'application/octet-stream');
        }

        next();

      } catch (error) {
        console.error('FileValidationMiddleware: Cache header error:', error);
        // Continue without cache headers if there's an error
        next();
      }
    };
  }

  /**
   * Handle conditional requests (If-None-Match, If-Modified-Since)
   */
  static handleConditionalRequests() {
    return (req, res, next) => {
      try {
        const { parsed, metadata } = req.fileInfo;
        const ifNoneMatch = req.get('If-None-Match');
        const ifModifiedSince = req.get('If-Modified-Since');

        // Check ETag
        if (ifNoneMatch && ifNoneMatch === `"${parsed.hash}"`) {
          return res.status(304).end();
        }

        // Check Last-Modified
        if (ifModifiedSince && metadata?.createdAt) {
          const fileModified = new Date(metadata.createdAt);
          const clientCached = new Date(ifModifiedSince);
          
          if (fileModified <= clientCached) {
            return res.status(304).end();
          }
        }

        next();

      } catch (error) {
        console.error('FileValidationMiddleware: Conditional request error:', error);
        // Continue if there's an error with conditional requests
        next();
      }
    };
  }

  /**
   * Log file access for analytics
   */
  static logFileAccess() {
    return (req, res, next) => {
      try {
        const { filename, type, userId, isOwner } = req.fileInfo;
        const clientIp = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent');

        // Log the access (could be sent to analytics service)
        console.log(`FileAccess: ${filename} (${type}) accessed by user ${userId || 'anonymous'} from ${clientIp}`);

        // Add access information to response headers for monitoring
        res.set({
          'X-File-Type': type,
          'X-Access-Time': new Date().toISOString(),
          'X-Owner-Access': isOwner ? 'true' : 'false'
        });

        next();

      } catch (error) {
        console.error('FileValidationMiddleware: Access logging error:', error);
        // Continue if logging fails
        next();
      }
    };
  }

  /**
   * Rate limiting for file access
   */
  static rateLimit(options = {}) {
    const { 
      windowMs = 15 * 60 * 1000, // 15 minutes
      maxRequests = 100,
      skipSuccessfulRequests = false 
    } = options;

    // Simple in-memory rate limiting (in production, use Redis)
    const requestCounts = new Map();

    return (req, res, next) => {
      try {
        const userId = req.session?.strava?.athlete?.id;
        const clientIp = req.ip || req.connection.remoteAddress;
        const key = userId ? `user:${userId}` : `ip:${clientIp}`;

        const now = Date.now();
        const windowStart = now - windowMs;

        // Clean up old entries
        if (requestCounts.has(key)) {
          const requests = requestCounts.get(key);
          const validRequests = requests.filter(timestamp => timestamp > windowStart);
          requestCounts.set(key, validRequests);
        }

        // Get current request count
        const requests = requestCounts.get(key) || [];
        
        if (requests.length >= maxRequests) {
          return res.status(429).json({
            error: 'Too many requests',
            message: `Rate limit exceeded. Maximum ${maxRequests} requests per ${windowMs / 1000} seconds.`,
            retryAfter: Math.ceil((requests[0] + windowMs - now) / 1000)
          });
        }

        // Add current request
        requests.push(now);
        requestCounts.set(key, requests);

        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit': maxRequests.toString(),
          'X-RateLimit-Remaining': (maxRequests - requests.length).toString(),
          'X-RateLimit-Reset': new Date(requests[0] + windowMs).toISOString()
        });

        next();

      } catch (error) {
        console.error('FileValidationMiddleware: Rate limiting error:', error);
        // Continue if rate limiting fails
        next();
      }
    };
  }

  /**
   * Security headers for file serving
   */
  static setSecurityHeaders() {
    return (req, res, next) => {
      try {
        const { parsed } = req.fileInfo;

        // Set security headers
        res.set({
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'X-XSS-Protection': '1; mode=block',
          'Referrer-Policy': 'strict-origin-when-cross-origin'
        });

        // For image files, allow inline display
        if (['png', 'jpg', 'jpeg'].includes(parsed.extension.toLowerCase())) {
          res.set('Content-Disposition', 'inline');
        } else {
          // For other files, force download
          res.set('Content-Disposition', `attachment; filename="${parsed.filename}"`);
        }

        next();

      } catch (error) {
        console.error('FileValidationMiddleware: Security headers error:', error);
        // Continue without security headers if there's an error
        next();
      }
    };
  }
}

module.exports = FileValidationMiddleware;