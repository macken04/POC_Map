/**
 * File Cleanup Service
 * Automated cleanup of temporary files, expired maps, and storage management
 * Implements configurable retention policies and safe deletion procedures
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const config = require('../config');
const fileStorageService = require('./fileStorageService');
const FileNaming = require('../utils/fileNaming');

class FileCleanupService {
  constructor() {
    this.appConfig = config.getConfig();
    this.isRunning = false;
    this.cleanupTimer = null;
    this.isInitialized = false;
    
    // Default retention policies (in milliseconds)
    this.retentionPolicies = {
      temporary: {
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        maxFiles: 1000,
        description: 'Preview and temporary files'
      },
      processing: {
        maxAge: 2 * 60 * 60 * 1000, // 2 hours
        maxFiles: 100,
        description: 'Files currently being processed'
      },
      permanent: {
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
        maxFiles: 10000,
        description: 'Completed, paid maps'
      },
      metadata: {
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
        maxFiles: 20000,
        description: 'File metadata records'
      }
    };

    // Override with environment configuration if available
    this.loadConfiguredPolicies();
  }

  /**
   * Load retention policies from configuration
   */
  loadConfiguredPolicies() {
    try {
      const cleanupConfig = this.appConfig.cleanup || {};
      
      // Override default policies with configured values
      Object.keys(this.retentionPolicies).forEach(type => {
        if (cleanupConfig[type]) {
          this.retentionPolicies[type] = {
            ...this.retentionPolicies[type],
            ...cleanupConfig[type]
          };
        }
      });

      console.log('FileCleanupService: Loaded retention policies:', this.retentionPolicies);

    } catch (error) {
      console.warn('FileCleanupService: Could not load configured policies, using defaults:', error.message);
    }
  }

  /**
   * Initialize the cleanup service
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('FileCleanupService: Initializing cleanup service...');

      // Ensure file storage service is initialized
      await fileStorageService.initialize();

      // Start periodic cleanup if configured
      const cleanupInterval = this.appConfig.storage?.cleanupInterval || 3600000; // 1 hour default
      if (cleanupInterval > 0) {
        this.startPeriodicCleanup(cleanupInterval);
      }

      this.isInitialized = true;
      console.log('FileCleanupService: Cleanup service initialized successfully');

    } catch (error) {
      console.error('FileCleanupService: Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Start periodic cleanup timer
   */
  startPeriodicCleanup(interval) {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    console.log(`FileCleanupService: Starting periodic cleanup every ${interval}ms`);
    
    this.cleanupTimer = setInterval(async () => {
      try {
        await this.runCleanup();
      } catch (error) {
        console.error('FileCleanupService: Periodic cleanup failed:', error);
      }
    }, interval);

    // Run initial cleanup after a short delay
    setTimeout(async () => {
      try {
        await this.runCleanup();
      } catch (error) {
        console.error('FileCleanupService: Initial cleanup failed:', error);
      }
    }, 30000); // 30 seconds delay
  }

  /**
   * Stop periodic cleanup
   */
  stopPeriodicCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      console.log('FileCleanupService: Stopped periodic cleanup');
    }
  }

  /**
   * Run a complete cleanup cycle
   */
  async runCleanup(options = {}) {
    if (this.isRunning) {
      console.log('FileCleanupService: Cleanup already running, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      console.log('FileCleanupService: Starting cleanup cycle...');

      const results = {
        startTime: new Date(startTime).toISOString(),
        endTime: null,
        duration: 0,
        directories: {},
        totalFilesDeleted: 0,
        totalSpaceFreed: 0,
        errors: []
      };

      // Clean each directory type
      for (const [type, policy] of Object.entries(this.retentionPolicies)) {
        if (options.types && !options.types.includes(type)) {
          continue; // Skip if specific types requested and this isn't one
        }

        try {
          console.log(`FileCleanupService: Cleaning ${type} directory...`);
          const directoryResult = await this.cleanDirectoryByPolicy(type, policy, options);
          results.directories[type] = directoryResult;
          results.totalFilesDeleted += directoryResult.filesDeleted;
          results.totalSpaceFreed += directoryResult.spaceFreed;

        } catch (error) {
          console.error(`FileCleanupService: Error cleaning ${type}:`, error);
          results.errors.push({
            type,
            error: error.message
          });
        }
      }

      // Clean orphaned metadata files
      try {
        const orphanResult = await this.cleanOrphanedMetadata();
        results.orphanedMetadata = orphanResult;
        results.totalFilesDeleted += orphanResult.filesDeleted;
        results.totalSpaceFreed += orphanResult.spaceFreed;
      } catch (error) {
        console.error('FileCleanupService: Error cleaning orphaned metadata:', error);
        results.errors.push({
          type: 'orphaned_metadata',
          error: error.message
        });
      }

      const endTime = Date.now();
      results.endTime = new Date(endTime).toISOString();
      results.duration = endTime - startTime;

      console.log(`FileCleanupService: Cleanup completed in ${results.duration}ms`);
      console.log(`FileCleanupService: Deleted ${results.totalFilesDeleted} files, freed ${this.formatBytes(results.totalSpaceFreed)}`);

      return results;

    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Clean a directory based on its retention policy
   */
  async cleanDirectoryByPolicy(directoryType, policy, options = {}) {
    const storageService = fileStorageService;
    const directories = storageService.directories;
    
    if (!directories[directoryType]) {
      throw new Error(`Unknown directory type: ${directoryType}`);
    }

    const directoryPath = directories[directoryType];
    const result = {
      type: directoryType,
      policy: policy,
      filesDeleted: 0,
      spaceFreed: 0,
      errors: []
    };

    try {
      // Get all files in the directory
      const files = await fs.readdir(directoryPath);
      
      // Filter and sort files by age
      const fileInfos = [];
      for (const file of files) {
        try {
          const filePath = path.join(directoryPath, file);
          const stats = await fs.stat(filePath);
          
          fileInfos.push({
            name: file,
            path: filePath,
            size: stats.size,
            mtime: stats.mtime,
            age: Date.now() - stats.mtime.getTime()
          });
        } catch (error) {
          // Skip files that can't be accessed
          console.warn(`FileCleanupService: Could not stat file ${file}:`, error.message);
        }
      }

      // Sort by age (oldest first)
      fileInfos.sort((a, b) => b.age - a.age);

      // Apply retention policies
      const filesToDelete = [];

      // Age-based cleanup
      if (policy.maxAge) {
        const expiredFiles = fileInfos.filter(info => info.age > policy.maxAge);
        filesToDelete.push(...expiredFiles);
      }

      // Count-based cleanup (keep only the newest files up to maxFiles)
      if (policy.maxFiles && fileInfos.length > policy.maxFiles) {
        const excessFiles = fileInfos.slice(policy.maxFiles);
        filesToDelete.push(...excessFiles);
      }

      // Remove duplicates
      const uniqueFilesToDelete = filesToDelete.filter((file, index, arr) => 
        arr.findIndex(f => f.path === file.path) === index
      );

      // Delete files
      for (const fileInfo of uniqueFilesToDelete) {
        try {
          // Skip if dry run
          if (options.dryRun) {
            console.log(`FileCleanupService: [DRY RUN] Would delete ${fileInfo.path}`);
            result.filesDeleted++;
            result.spaceFreed += fileInfo.size;
            continue;
          }

          // Validate file before deletion for safety
          if (await this.isFileSafeToDelete(fileInfo, directoryType)) {
            await fs.unlink(fileInfo.path);
            console.log(`FileCleanupService: Deleted ${fileInfo.path} (${this.formatBytes(fileInfo.size)})`);
            
            result.filesDeleted++;
            result.spaceFreed += fileInfo.size;

            // Also try to delete associated metadata if this is a map file
            if (directoryType !== 'metadata') {
              try {
                const metadataFilename = FileNaming.getMetadataFilename(fileInfo.name);
                const metadataPath = path.join(directories.metadata, metadataFilename);
                await fs.unlink(metadataPath);
                console.log(`FileCleanupService: Deleted associated metadata ${metadataPath}`);
              } catch (metadataError) {
                // Metadata might not exist, that's okay
              }
            }

          } else {
            console.warn(`FileCleanupService: Skipped deletion of ${fileInfo.path} (safety check failed)`);
          }

        } catch (error) {
          console.error(`FileCleanupService: Failed to delete ${fileInfo.path}:`, error);
          result.errors.push({
            file: fileInfo.path,
            error: error.message
          });
        }
      }

    } catch (error) {
      console.error(`FileCleanupService: Error reading directory ${directoryPath}:`, error);
      throw error;
    }

    return result;
  }

  /**
   * Clean orphaned metadata files (metadata without corresponding map files)
   */
  async cleanOrphanedMetadata() {
    const result = {
      filesDeleted: 0,
      spaceFreed: 0,
      errors: []
    };

    try {
      const metadataDir = fileStorageService.directories.metadata;
      const files = await fs.readdir(metadataDir);
      
      const metadataFiles = files.filter(file => file.endsWith('_metadata.json'));

      for (const metadataFile of metadataFiles) {
        try {
          // Extract the corresponding map filename
          const mapFilename = metadataFile.replace('_metadata.json', '.png');
          
          // Check if the map file exists in any directory
          let mapFileExists = false;
          for (const [type, dirPath] of Object.entries(fileStorageService.directories)) {
            if (type === 'metadata') continue;
            
            const mapFilePath = path.join(dirPath, mapFilename);
            if (fsSync.existsSync(mapFilePath)) {
              mapFileExists = true;
              break;
            }
          }

          // If map file doesn't exist, the metadata is orphaned
          if (!mapFileExists) {
            const metadataPath = path.join(metadataDir, metadataFile);
            const stats = await fs.stat(metadataPath);
            
            await fs.unlink(metadataPath);
            console.log(`FileCleanupService: Deleted orphaned metadata ${metadataPath}`);
            
            result.filesDeleted++;
            result.spaceFreed += stats.size;
          }

        } catch (error) {
          console.error(`FileCleanupService: Error processing metadata ${metadataFile}:`, error);
          result.errors.push({
            file: metadataFile,
            error: error.message
          });
        }
      }

    } catch (error) {
      console.error('FileCleanupService: Error cleaning orphaned metadata:', error);
      throw error;
    }

    return result;
  }

  /**
   * Safety check before deleting a file
   */
  async isFileSafeToDelete(fileInfo, directoryType) {
    try {
      // Check if file is currently being accessed (basic check)
      const currentStats = await fs.stat(fileInfo.path);
      
      // If the file was modified very recently, it might be in use
      const timeSinceModification = Date.now() - currentStats.mtime.getTime();
      if (timeSinceModification < 60000) { // Less than 1 minute
        return false;
      }

      // Additional safety checks based on directory type
      switch (directoryType) {
        case 'processing':
          // For processing files, be extra cautious
          return timeSinceModification > 300000; // 5 minutes

        case 'permanent':
          // For permanent files, require explicit age threshold
          return fileInfo.age > this.retentionPolicies.permanent.maxAge;

        case 'temporary':
          // Temporary files are generally safe to delete
          return true;

        case 'metadata':
          // Metadata files are safe if they don't have a corresponding map file
          return true;

        default:
          return true;
      }

    } catch (error) {
      // If we can't verify safety, err on the side of caution
      console.warn(`FileCleanupService: Could not verify safety for ${fileInfo.path}:`, error.message);
      return false;
    }
  }

  /**
   * Get cleanup statistics
   */
  async getCleanupStats() {
    const stats = {
      isRunning: this.isRunning,
      isInitialized: this.isInitialized,
      hasPeriodicCleanup: this.cleanupTimer !== null,
      retentionPolicies: this.retentionPolicies,
      directories: {}
    };

    try {
      // Get statistics for each directory
      for (const [type, dirPath] of Object.entries(fileStorageService.directories)) {
        try {
          const files = await fs.readdir(dirPath);
          let totalSize = 0;
          let oldestFile = null;
          let newestFile = null;

          for (const file of files) {
            try {
              const filePath = path.join(dirPath, file);
              const fileStat = await fs.stat(filePath);
              totalSize += fileStat.size;

              if (!oldestFile || fileStat.mtime < oldestFile.mtime) {
                oldestFile = { name: file, mtime: fileStat.mtime };
              }
              if (!newestFile || fileStat.mtime > newestFile.mtime) {
                newestFile = { name: file, mtime: fileStat.mtime };
              }
            } catch (error) {
              // Skip inaccessible files
            }
          }

          stats.directories[type] = {
            path: dirPath,
            fileCount: files.length,
            totalSize: totalSize,
            totalSizeFormatted: this.formatBytes(totalSize),
            oldestFile: oldestFile,
            newestFile: newestFile
          };

        } catch (error) {
          stats.directories[type] = {
            path: dirPath,
            error: error.message
          };
        }
      }

    } catch (error) {
      console.error('FileCleanupService: Error getting cleanup stats:', error);
    }

    return stats;
  }

  /**
   * Update retention policy for a directory type
   */
  updateRetentionPolicy(directoryType, newPolicy) {
    if (!this.retentionPolicies[directoryType]) {
      throw new Error(`Unknown directory type: ${directoryType}`);
    }

    this.retentionPolicies[directoryType] = {
      ...this.retentionPolicies[directoryType],
      ...newPolicy
    };

    console.log(`FileCleanupService: Updated retention policy for ${directoryType}:`, this.retentionPolicies[directoryType]);
  }

  /**
   * Format bytes for human-readable display
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Cleanup service shutdown
   */
  async shutdown() {
    console.log('FileCleanupService: Shutting down...');
    
    this.stopPeriodicCleanup();
    
    // Wait for any running cleanup to finish
    let attempts = 0;
    while (this.isRunning && attempts < 30) { // Wait up to 30 seconds
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }

    if (this.isRunning) {
      console.warn('FileCleanupService: Forced shutdown while cleanup was still running');
    }

    this.isInitialized = false;
    console.log('FileCleanupService: Shutdown complete');
  }
}

// Export singleton instance
const fileCleanupService = new FileCleanupService();

module.exports = fileCleanupService;
module.exports.FileCleanupService = FileCleanupService;