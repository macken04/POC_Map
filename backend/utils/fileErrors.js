/**
 * File Operation Error Classes
 * Custom error types for comprehensive file system error handling
 * Provides detailed error information and user-friendly messages
 */

/**
 * Base file operation error class
 */
class FileOperationError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
    this.userMessage = this.generateUserMessage();
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Generate user-friendly error message
   */
  generateUserMessage() {
    switch (this.code) {
      case 'FILE_NOT_FOUND':
        return 'The requested file could not be found.';
      case 'ACCESS_DENIED':
        return 'You do not have permission to access this file.';
      case 'STORAGE_FULL':
        return 'Storage space is full. Please delete some files and try again.';
      case 'FILE_TOO_LARGE':
        return 'The file is too large to be processed.';
      case 'INVALID_FORMAT':
        return 'The file format is not supported.';
      case 'CORRUPTION_DETECTED':
        return 'The file appears to be corrupted and cannot be processed.';
      default:
        return 'An error occurred while processing the file.';
    }
  }

  /**
   * Convert error to JSON for API responses
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      userMessage: this.userMessage,
      details: this.details,
      timestamp: this.timestamp
    };
  }
}

/**
 * File not found error
 */
class FileNotFoundError extends FileOperationError {
  constructor(filePath, details = {}) {
    super(`File not found: ${filePath}`, 'FILE_NOT_FOUND', {
      filePath,
      ...details
    });
  }
}

/**
 * File access denied error
 */
class FileAccessDeniedError extends FileOperationError {
  constructor(filePath, userId, details = {}) {
    super(`Access denied to file: ${filePath}`, 'ACCESS_DENIED', {
      filePath,
      userId,
      ...details
    });
  }
}

/**
 * Storage full error
 */
class StorageFullError extends FileOperationError {
  constructor(storageType, availableSpace, requiredSpace, details = {}) {
    super(`Storage full in ${storageType}: ${availableSpace} available, ${requiredSpace} required`, 'STORAGE_FULL', {
      storageType,
      availableSpace,
      requiredSpace,
      ...details
    });
  }
}

/**
 * File too large error
 */
class FileTooLargeError extends FileOperationError {
  constructor(fileSize, maxSize, details = {}) {
    super(`File too large: ${fileSize} bytes exceeds maximum ${maxSize} bytes`, 'FILE_TOO_LARGE', {
      fileSize,
      maxSize,
      ...details
    });
  }
}

/**
 * Invalid file format error
 */
class InvalidFileFormatError extends FileOperationError {
  constructor(filename, expectedFormats, actualFormat, details = {}) {
    super(`Invalid file format: ${filename}. Expected ${expectedFormats.join(', ')}, got ${actualFormat}`, 'INVALID_FORMAT', {
      filename,
      expectedFormats,
      actualFormat,
      ...details
    });
  }
}

/**
 * File corruption detected error
 */
class FileCorruptionError extends FileOperationError {
  constructor(filename, checksumMismatch, details = {}) {
    super(`File corruption detected: ${filename}`, 'CORRUPTION_DETECTED', {
      filename,
      checksumMismatch,
      ...details
    });
  }
}

/**
 * File operation timeout error
 */
class FileOperationTimeoutError extends FileOperationError {
  constructor(operation, timeout, details = {}) {
    super(`File operation timed out: ${operation} exceeded ${timeout}ms`, 'OPERATION_TIMEOUT', {
      operation,
      timeout,
      ...details
    });
  }
}

/**
 * Insufficient permissions error
 */
class InsufficientPermissionsError extends FileOperationError {
  constructor(operation, requiredPermission, details = {}) {
    super(`Insufficient permissions for ${operation}: requires ${requiredPermission}`, 'INSUFFICIENT_PERMISSIONS', {
      operation,
      requiredPermission,
      ...details
    });
  }
}

/**
 * File system quota exceeded error
 */
class QuotaExceededError extends FileOperationError {
  constructor(userId, currentUsage, quota, details = {}) {
    super(`Quota exceeded for user ${userId}: ${currentUsage} / ${quota}`, 'QUOTA_EXCEEDED', {
      userId,
      currentUsage,
      quota,
      ...details
    });
  }
}

/**
 * Concurrent file access error
 */
class ConcurrentAccessError extends FileOperationError {
  constructor(filename, conflictingOperation, details = {}) {
    super(`Concurrent access conflict for ${filename}: ${conflictingOperation} in progress`, 'CONCURRENT_ACCESS', {
      filename,
      conflictingOperation,
      ...details
    });
  }
}

/**
 * File validation error
 */
class FileValidationError extends FileOperationError {
  constructor(filename, validationErrors, details = {}) {
    super(`File validation failed for ${filename}: ${validationErrors.join(', ')}`, 'VALIDATION_FAILED', {
      filename,
      validationErrors,
      ...details
    });
  }
}

/**
 * Network/IO error during file operations
 */
class FileIOError extends FileOperationError {
  constructor(operation, systemError, details = {}) {
    super(`IO error during ${operation}: ${systemError.message}`, 'IO_ERROR', {
      operation,
      systemError: {
        code: systemError.code,
        errno: systemError.errno,
        syscall: systemError.syscall,
        path: systemError.path
      },
      ...details
    });
  }
}

/**
 * Error handler utility class
 */
class FileErrorHandler {
  /**
   * Convert system errors to custom file errors
   */
  static handleSystemError(error, context = {}) {
    const { operation, filePath, userId } = context;

    switch (error.code) {
      case 'ENOENT':
        return new FileNotFoundError(filePath || error.path, { originalError: error });
      
      case 'EACCES':
      case 'EPERM':
        return new FileAccessDeniedError(filePath || error.path, userId, { originalError: error });
      
      case 'ENOSPC':
        return new StorageFullError('disk', 0, 'unknown', { originalError: error });
      
      case 'EMFILE':
      case 'ENFILE':
        return new FileOperationError('Too many open files', 'TOO_MANY_FILES', { originalError: error });
      
      case 'EISDIR':
        return new FileOperationError('Expected file but found directory', 'IS_DIRECTORY', { originalError: error });
      
      case 'ENOTDIR':
        return new FileOperationError('Expected directory but found file', 'NOT_DIRECTORY', { originalError: error });
      
      case 'EEXIST':
        return new FileOperationError('File already exists', 'FILE_EXISTS', { originalError: error });
      
      case 'ETIMEDOUT':
        return new FileOperationTimeoutError(operation || 'file operation', 30000, { originalError: error });
      
      default:
        return new FileIOError(operation || 'unknown operation', error);
    }
  }

  /**
   * Create retry configuration for different error types
   */
  static getRetryConfig(error) {
    if (!(error instanceof FileOperationError)) {
      return { shouldRetry: false };
    }

    switch (error.code) {
      case 'IO_ERROR':
      case 'OPERATION_TIMEOUT':
      case 'TOO_MANY_FILES':
        return {
          shouldRetry: true,
          maxRetries: 3,
          baseDelay: 1000,
          backoffMultiplier: 2
        };
      
      case 'CONCURRENT_ACCESS':
        return {
          shouldRetry: true,
          maxRetries: 5,
          baseDelay: 500,
          backoffMultiplier: 1.5
        };
      
      case 'STORAGE_FULL':
        return {
          shouldRetry: true,
          maxRetries: 2,
          baseDelay: 5000,
          backoffMultiplier: 1
        };
      
      default:
        return { shouldRetry: false };
    }
  }

  /**
   * Execute operation with retry logic
   */
  static async executeWithRetry(operation, context = {}) {
    let lastError;
    let attempt = 0;

    while (true) {
      try {
        return await operation();
      } catch (error) {
        attempt++;
        
        // Convert system errors to custom errors
        const fileError = error instanceof FileOperationError ? 
          error : 
          this.handleSystemError(error, context);

        lastError = fileError;

        // Check if we should retry
        const retryConfig = this.getRetryConfig(fileError);
        
        if (!retryConfig.shouldRetry || attempt >= (retryConfig.maxRetries || 1)) {
          throw fileError;
        }

        // Calculate delay with exponential backoff
        const delay = retryConfig.baseDelay * Math.pow(retryConfig.backoffMultiplier, attempt - 1);
        
        console.warn(`FileErrorHandler: Attempt ${attempt} failed, retrying in ${delay}ms:`, fileError.message);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Log error with appropriate level and context
   */
  static logError(error, context = {}) {
    const logData = {
      error: error instanceof FileOperationError ? error.toJSON() : {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      context,
      timestamp: new Date().toISOString()
    };

    // Determine log level based on error severity
    if (error instanceof FileOperationError) {
      switch (error.code) {
        case 'FILE_NOT_FOUND':
        case 'ACCESS_DENIED':
          console.warn('FileErrorHandler:', JSON.stringify(logData, null, 2));
          break;
        
        case 'CORRUPTION_DETECTED':
        case 'STORAGE_FULL':
        case 'QUOTA_EXCEEDED':
          console.error('FileErrorHandler:', JSON.stringify(logData, null, 2));
          break;
        
        default:
          console.info('FileErrorHandler:', JSON.stringify(logData, null, 2));
      }
    } else {
      console.error('FileErrorHandler (Unexpected):', JSON.stringify(logData, null, 2));
    }
  }

  /**
   * Convert error to HTTP response format
   */
  static toHttpResponse(error) {
    if (!(error instanceof FileOperationError)) {
      return {
        status: 500,
        body: {
          error: 'Internal server error',
          message: 'An unexpected error occurred',
          timestamp: new Date().toISOString()
        }
      };
    }

    const statusMap = {
      'FILE_NOT_FOUND': 404,
      'ACCESS_DENIED': 403,
      'INSUFFICIENT_PERMISSIONS': 403,
      'STORAGE_FULL': 507,
      'FILE_TOO_LARGE': 413,
      'INVALID_FORMAT': 400,
      'VALIDATION_FAILED': 400,
      'CORRUPTION_DETECTED': 410,
      'OPERATION_TIMEOUT': 408,
      'QUOTA_EXCEEDED': 507,
      'CONCURRENT_ACCESS': 409,
      'FILE_EXISTS': 409,
      'TOO_MANY_FILES': 503,
      'IO_ERROR': 500
    };

    return {
      status: statusMap[error.code] || 500,
      body: {
        error: error.code,
        message: error.userMessage,
        details: error.details,
        timestamp: error.timestamp
      }
    };
  }
}

module.exports = {
  FileOperationError,
  FileNotFoundError,
  FileAccessDeniedError,
  StorageFullError,
  FileTooLargeError,
  InvalidFileFormatError,
  FileCorruptionError,
  FileOperationTimeoutError,
  InsufficientPermissionsError,
  QuotaExceededError,
  ConcurrentAccessError,
  FileValidationError,
  FileIOError,
  FileErrorHandler
};