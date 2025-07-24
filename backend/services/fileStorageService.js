/**
 * File Storage Service for Map Generation
 * Handles hierarchical file organization, naming conventions, and file operations
 * Implements secure, organized storage for generated maps
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');
const {
  FileOperationError,
  FileNotFoundError,
  FileAccessDeniedError,
  StorageFullError,
  FileTooLargeError,
  InvalidFileFormatError,
  FileCorruptionError,
  FileValidationError,
  FileErrorHandler
} = require('../utils/fileErrors');

class FileStorageService {
  constructor() {
    this.appConfig = config.getConfig();
    this.baseDir = this.appConfig.storage.generatedMapsDir;
    this.isInitialized = false;
    
    // Define directory structure
    this.directories = {
      permanent: path.join(this.baseDir, 'permanent'),
      temporary: path.join(this.baseDir, 'temporary'), 
      processing: path.join(this.baseDir, 'processing'),
      metadata: path.join(this.baseDir, 'metadata')
    };
  }

  /**
   * Initialize the file storage system
   * Creates all necessary directories and sets up the storage structure
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('FileStorageService: Initializing storage directories...');

      // Create base directory if it doesn't exist
      await this.ensureDirectoryExists(this.baseDir);

      // Create all subdirectories
      for (const [type, dirPath] of Object.entries(this.directories)) {
        await this.ensureDirectoryExists(dirPath);
        console.log(`FileStorageService: Created ${type} directory at ${dirPath}`);
      }

      this.isInitialized = true;
      console.log('FileStorageService: Storage system initialized successfully');

    } catch (error) {
      console.error('FileStorageService: Failed to initialize storage system:', error);
      throw error;
    }
  }

  /**
   * Ensure a directory exists, create it if it doesn't
   */
  async ensureDirectoryExists(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        console.error(`Error creating directory ${dirPath}:`, error);
        throw error;
      }
    }
  }

  /**
   * Generate a unique filename with comprehensive metadata
   */
  generateFilename(options = {}) {
    const {
      userId,
      activityId,
      format = 'A4',
      type = 'map',
      extension = 'png'
    } = options;

    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    
    // Create a hash from key parameters for collision prevention
    const hashData = `${userId}_${activityId}_${format}_${timestamp}_${random}`;
    const hash = crypto.createHash('md5').update(hashData).digest('hex').substr(0, 8);
    
    return `${type}_${userId}_${activityId}_${format}_${timestamp}_${hash}.${extension}`;
  }

  /**
   * Generate metadata filename for a given map file
   */
  getMetadataFilename(mapFilename) {
    const baseName = path.parse(mapFilename).name;
    return `${baseName}_metadata.json`;
  }

  /**
   * Parse filename to extract metadata
   */
  parseFilename(filename) {
    const parts = path.parse(filename).name.split('_');
    
    if (parts.length < 6) {
      throw new Error(`Invalid filename format: ${filename}`);
    }

    return {
      type: parts[0],
      userId: parts[1],
      activityId: parts[2], 
      format: parts[3],
      timestamp: parseInt(parts[4]),
      hash: parts[5],
      extension: path.parse(filename).ext.slice(1)
    };
  }

  /**
   * Save a map file to the appropriate directory
   */
  async saveMapFile(buffer, options = {}) {
    const {
      userId,
      activityId,
      format,
      type = 'temporary', // 'temporary', 'permanent', 'processing'
      metadata = {}
    } = options;

    return await FileErrorHandler.executeWithRetry(async () => {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Validate inputs
      if (!buffer || !Buffer.isBuffer(buffer)) {
        throw new FileValidationError('buffer', ['Buffer must be provided and be a valid Buffer instance']);
      }

      if (!userId || !activityId) {
        throw new FileValidationError('options', ['userId and activityId are required']);
      }

      // Check file size limits
      const maxFileSize = this.appConfig.storage?.maxFileSize || 10485760; // 10MB default
      if (buffer.length > maxFileSize) {
        throw new FileTooLargeError(buffer.length, maxFileSize);
      }

      // Validate type
      if (!this.directories[type]) {
        throw new InvalidFileFormatError(type, Object.keys(this.directories), 'storage_type');
      }

      // Check available storage space
      await this.checkStorageSpace(buffer.length, type);

      // Generate unique filename
      const filename = this.generateFilename({
        userId,
        activityId,
        format,
        type: 'map'
      });

      // Construct file paths
      const filePath = path.join(this.directories[type], filename);
      const metadataFilename = this.getMetadataFilename(filename);
      const metadataPath = path.join(this.directories.metadata, metadataFilename);

      // Save the map file with atomic operation
      const tempFilePath = `${filePath}.tmp`;
      await fs.writeFile(tempFilePath, buffer);
      await fs.rename(tempFilePath, filePath);
      console.log(`FileStorageService: Map file saved to ${filePath}`);

      // Create and save metadata
      const fileMetadata = {
        filename,
        originalPath: filePath,
        type,
        userId,
        activityId,
        format,
        size: buffer.length,
        createdAt: new Date().toISOString(),
        status: type === 'processing' ? 'processing' : 'ready',
        checksum: crypto.createHash('md5').update(buffer).digest('hex'),
        ...metadata
      };

      // Save metadata atomically
      const tempMetadataPath = `${metadataPath}.tmp`;
      await fs.writeFile(tempMetadataPath, JSON.stringify(fileMetadata, null, 2));
      await fs.rename(tempMetadataPath, metadataPath);
      console.log(`FileStorageService: Metadata saved to ${metadataPath}`);

      return {
        filename,
        filePath,
        metadataPath,
        size: buffer.length,
        checksum: fileMetadata.checksum,
        url: this.getFileUrl(filename, type)
      };

    }, { 
      operation: 'saveMapFile',
      filePath: options.filename,
      userId 
    });
  }

  /**
   * Check available storage space before saving files
   */
  async checkStorageSpace(requiredBytes, storageType) {
    try {
      const dirPath = this.directories[storageType];
      const stats = await fs.statSync(dirPath);
      
      // Get filesystem stats (this is platform dependent)
      // On most systems, we can check available space
      const fs_stats = await fs.statvfs ? await fs.statvfs(dirPath) : null;
      
      if (fs_stats) {
        const availableBytes = fs_stats.bavail * fs_stats.frsize;
        
        if (availableBytes < requiredBytes) {
          throw new StorageFullError(storageType, availableBytes, requiredBytes);
        }
      }
      
      // Additional check: ensure we don't exceed configured limits
      const currentStats = await this.getStorageStats();
      const currentSize = currentStats.directories[storageType]?.size || 0;
      const maxStorageSize = this.appConfig.storage?.maxStorageSize || 1073741824; // 1GB default
      
      if (currentSize + requiredBytes > maxStorageSize) {
        throw new StorageFullError(storageType, maxStorageSize - currentSize, requiredBytes);
      }
      
    } catch (error) {
      if (error instanceof StorageFullError) {
        throw error;
      }
      // If we can't check storage space, log warning but continue
      console.warn(`FileStorageService: Could not check storage space for ${storageType}:`, error.message);
    }
  }

  /**
   * Get the URL for accessing a stored file via the web server
   */
  getFileUrl(filename, type = 'permanent') {
    return `/generated-maps/${type}/${filename}`;
  }

  /**
   * Move a file from one storage type to another (e.g., temporary to permanent)
   */
  async moveFile(filename, fromType, toType) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const sourcePath = path.join(this.directories[fromType], filename);
      const destinationPath = path.join(this.directories[toType], filename);
      
      // Check if source file exists
      await fs.access(sourcePath);
      
      // Move the file
      await fs.rename(sourcePath, destinationPath);
      
      // Update metadata
      const metadataFilename = this.getMetadataFilename(filename);
      const metadataPath = path.join(this.directories.metadata, metadataFilename);
      
      try {
        const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
        metadata.type = toType;
        metadata.originalPath = destinationPath;
        metadata.movedAt = new Date().toISOString();
        
        await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
        
        console.log(`FileStorageService: Moved ${filename} from ${fromType} to ${toType}`);
        
        return {
          filename,
          newPath: destinationPath,
          newUrl: this.getFileUrl(filename, toType)
        };
        
      } catch (metadataError) {
        console.warn(`FileStorageService: Could not update metadata for ${filename}:`, metadataError);
      }

    } catch (error) {
      console.error(`FileStorageService: Error moving file ${filename}:`, error);
      throw error;
    }
  }

  /**
   * Delete a file and its metadata
   */
  async deleteFile(filename, type) {
    return await FileErrorHandler.executeWithRetry(async () => {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Validate inputs
      if (!filename || typeof filename !== 'string') {
        throw new FileValidationError('filename', ['Filename must be a non-empty string']);
      }

      if (!this.directories[type]) {
        throw new InvalidFileFormatError(type, Object.keys(this.directories), 'storage_type');
      }

      const filePath = path.join(this.directories[type], filename);
      const metadataFilename = this.getMetadataFilename(filename);
      const metadataPath = path.join(this.directories.metadata, metadataFilename);

      // Check if file exists before attempting deletion
      try {
        await fs.access(filePath);
      } catch (error) {
        throw new FileNotFoundError(filePath);
      }

      // Delete the main file
      try {
        await fs.unlink(filePath);
        console.log(`FileStorageService: Deleted file ${filePath}`);
      } catch (error) {
        if (error.code === 'ENOENT') {
          console.warn(`FileStorageService: File ${filePath} was already deleted`);
        } else {
          throw FileErrorHandler.handleSystemError(error, {
            operation: 'deleteFile',
            filePath,
            filename
          });
        }
      }

      // Delete metadata
      try {
        await fs.unlink(metadataPath);
        console.log(`FileStorageService: Deleted metadata ${metadataPath}`);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.warn(`FileStorageService: Could not delete metadata ${metadataPath}:`, error.message);
          // Don't throw for metadata deletion failures - the main file is already deleted
        }
      }

      return true;

    }, { 
      operation: 'deleteFile',
      filePath: filename,
      storageType: type 
    });
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(filename) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const metadataFilename = this.getMetadataFilename(filename);
      const metadataPath = path.join(this.directories.metadata, metadataFilename);
      
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
      
      // Add current file stats if file exists
      try {
        const filePath = path.join(this.directories[metadata.type], filename);
        const stats = await fs.stat(filePath);
        metadata.currentSize = stats.size;
        metadata.lastModified = stats.mtime.toISOString();
        metadata.exists = true;
      } catch (error) {
        metadata.exists = false;
      }

      return metadata;

    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Metadata not found for file: ${filename}`);
      }
      throw error;
    }
  }

  /**
   * List files in a storage type with optional filtering
   */
  async listFiles(type, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const { userId, format, limit, offset = 0 } = options;

    try {
      const dirPath = this.directories[type];
      const files = await fs.readdir(dirPath);
      
      // Filter out non-map files
      const mapFiles = files.filter(file => 
        file.startsWith('map_') && file.endsWith('.png')
      );

      // Get metadata for each file and apply filters
      const fileList = [];
      for (const file of mapFiles) {
        try {
          const metadata = await this.getFileMetadata(file);
          
          // Apply filters
          if (userId && metadata.userId !== userId) continue;
          if (format && metadata.format !== format) continue;
          
          fileList.push({
            filename: file,
            ...metadata
          });
        } catch (error) {
          console.warn(`FileStorageService: Could not get metadata for ${file}:`, error);
        }
      }

      // Sort by creation date (newest first)
      fileList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      // Apply pagination
      const paginatedList = limit ? 
        fileList.slice(offset, offset + limit) : 
        fileList.slice(offset);

      return {
        files: paginatedList,
        total: fileList.length,
        type
      };

    } catch (error) {
      console.error(`FileStorageService: Error listing files in ${type}:`, error);
      throw error;
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const stats = {
      directories: {},
      total: {
        files: 0,
        size: 0
      }
    };

    for (const [type, dirPath] of Object.entries(this.directories)) {
      try {
        const files = await fs.readdir(dirPath);
        let totalSize = 0;
        let fileCount = 0;

        for (const file of files) {
          try {
            const filePath = path.join(dirPath, file);
            const stat = await fs.stat(filePath);
            totalSize += stat.size;
            fileCount++;
          } catch (error) {
            // Skip files that can't be accessed
          }
        }

        stats.directories[type] = {
          files: fileCount,
          size: totalSize,
          path: dirPath
        };

        stats.total.files += fileCount;
        stats.total.size += totalSize;

      } catch (error) {
        console.warn(`FileStorageService: Could not get stats for ${type}:`, error);
        stats.directories[type] = { files: 0, size: 0, error: error.message };
      }
    }

    return stats;
  }

  /**
   * Verify file integrity using checksum
   */
  async verifyFileIntegrity(filename, type) {
    return await FileErrorHandler.executeWithRetry(async () => {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Validate inputs
      if (!filename || typeof filename !== 'string') {
        throw new FileValidationError('filename', ['Filename must be a non-empty string']);
      }

      if (!this.directories[type]) {
        throw new InvalidFileFormatError(type, Object.keys(this.directories), 'storage_type');
      }

      const filePath = path.join(this.directories[type], filename);
      
      // Check if file exists
      try {
        await fs.access(filePath);
      } catch (error) {
        throw new FileNotFoundError(filePath);
      }

      // Get metadata
      let metadata;
      try {
        metadata = await this.getFileMetadata(filename);
      } catch (error) {
        throw new FileOperationError('Metadata not found for integrity verification', 'METADATA_MISSING', {
          filename,
          originalError: error
        });
      }

      // Read file and calculate checksum
      const fileBuffer = await fs.readFile(filePath);
      const currentChecksum = crypto.createHash('md5').update(fileBuffer).digest('hex');

      const isValid = currentChecksum === metadata.checksum;
      const sizeMatches = fileBuffer.length === metadata.size;

      // If integrity check fails, throw corruption error
      if (!isValid || !sizeMatches) {
        throw new FileCorruptionError(filename, {
          checksumMismatch: !isValid,
          sizeMismatch: !sizeMatches,
          expected: { checksum: metadata.checksum, size: metadata.size },
          actual: { checksum: currentChecksum, size: fileBuffer.length }
        });
      }

      return {
        filename,
        isValid,
        originalChecksum: metadata.checksum,
        currentChecksum,
        size: fileBuffer.length,
        originalSize: metadata.size,
        verifiedAt: new Date().toISOString()
      };

    }, { 
      operation: 'verifyFileIntegrity',
      filePath: filename,
      storageType: type 
    });
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      baseDirectory: this.baseDir,
      directories: this.directories,
      supportedTypes: Object.keys(this.directories).filter(key => key !== 'metadata')
    };
  }
}

// Export singleton instance
const fileStorageService = new FileStorageService();

module.exports = fileStorageService;
module.exports.FileStorageService = FileStorageService;