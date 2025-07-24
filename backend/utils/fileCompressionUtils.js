/**
 * File Compression Utilities
 * Handles compression and decompression of stored files for space efficiency
 * Supports gzip compression for metadata and optional image compression
 */

const zlib = require('zlib');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { FileOperationError, FileErrorHandler } = require('./fileErrors');

class FileCompressionUtils {
  /**
   * Compress data using gzip
   * @param {Buffer|string} data - Data to compress
   * @returns {Promise<Buffer>} Compressed data
   */
  static async compressData(data) {
    return new Promise((resolve, reject) => {
      zlib.gzip(data, (error, compressed) => {
        if (error) {
          reject(new FileOperationError('Compression failed', 'COMPRESSION_ERROR', {
            originalSize: Buffer.isBuffer(data) ? data.length : Buffer.byteLength(data),
            error: error.message
          }));
        } else {
          resolve(compressed);
        }
      });
    });
  }

  /**
   * Decompress gzipped data
   * @param {Buffer} compressedData - Compressed data to decompress
   * @returns {Promise<Buffer>} Decompressed data
   */
  static async decompressData(compressedData) {
    return new Promise((resolve, reject) => {
      zlib.gunzip(compressedData, (error, decompressed) => {
        if (error) {
          reject(new FileOperationError('Decompression failed', 'DECOMPRESSION_ERROR', {
            compressedSize: compressedData.length,
            error: error.message
          }));
        } else {
          resolve(decompressed);
        }
      });
    });
  }

  /**
   * Compress and save file with compression metadata
   * @param {string} filePath - Path to save compressed file
   * @param {Buffer|string} data - Data to compress and save
   * @param {Object} options - Compression options
   * @returns {Promise<Object>} Compression result with statistics
   */
  static async compressAndSaveFile(filePath, data, options = {}) {
    const { addMetadata = true, compressionLevel = 6 } = options;

    return await FileErrorHandler.executeWithRetry(async () => {
      const originalSize = Buffer.isBuffer(data) ? data.length : Buffer.byteLength(data);
      
      // Compress data
      const compressed = await new Promise((resolve, reject) => {
        zlib.gzip(data, { level: compressionLevel }, (error, result) => {
          if (error) {
            reject(new FileOperationError('Compression failed', 'COMPRESSION_ERROR', {
              originalSize,
              error: error.message
            }));
          } else {
            resolve(result);
          }
        });
      });

      const compressedSize = compressed.length;
      const compressionRatio = originalSize > 0 ? (compressedSize / originalSize) : 1;
      const spaceSaved = originalSize - compressedSize;
      const compressionPercent = originalSize > 0 ? ((spaceSaved / originalSize) * 100) : 0;

      // Save compressed file
      await fs.writeFile(filePath, compressed);

      // Add compression metadata if requested
      if (addMetadata) {
        const metadataPath = `${filePath}.meta`;
        const metadata = {
          originalSize,
          compressedSize,
          compressionRatio,
          compressionPercent,
          compressionLevel,
          algorithm: 'gzip',
          compressedAt: new Date().toISOString()
        };
        await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
      }

      console.log(`FileCompressionUtils: Compressed ${filePath} - ${originalSize} -> ${compressedSize} bytes (${compressionPercent.toFixed(1)}% reduction)`);

      return {
        filePath,
        originalSize,
        compressedSize,
        compressionRatio,
        compressionPercent,
        spaceSaved,
        compressionLevel,
        algorithm: 'gzip'
      };

    }, { operation: 'compressAndSaveFile', filePath });
  }

  /**
   * Load and decompress file
   * @param {string} filePath - Path to compressed file
   * @returns {Promise<Buffer>} Decompressed data
   */
  static async loadAndDecompressFile(filePath) {
    return await FileErrorHandler.executeWithRetry(async () => {
      // Check if file exists
      try {
        await fs.access(filePath);
      } catch (error) {
        throw new FileOperationError('Compressed file not found', 'FILE_NOT_FOUND', {
          filePath
        });
      }

      // Read compressed data
      const compressedData = await fs.readFile(filePath);
      
      // Decompress
      const decompressed = await this.decompressData(compressedData);
      
      console.log(`FileCompressionUtils: Decompressed ${filePath} - ${compressedData.length} -> ${decompressed.length} bytes`);
      
      return decompressed;

    }, { operation: 'loadAndDecompressFile', filePath });
  }

  /**
   * Get compression statistics for a file
   * @param {string} filePath - Path to compressed file
   * @returns {Promise<Object>} Compression statistics
   */
  static async getCompressionStats(filePath) {
    try {
      const metadataPath = `${filePath}.meta`;
      
      // Try to read metadata file
      try {
        const metadataContent = await fs.readFile(metadataPath, 'utf8');
        return JSON.parse(metadataContent);
      } catch (metadataError) {
        // If no metadata file, calculate basic stats
        const compressedData = await fs.readFile(filePath);
        const decompressed = await this.decompressData(compressedData);
        
        const originalSize = decompressed.length;
        const compressedSize = compressedData.length;
        const compressionRatio = originalSize > 0 ? (compressedSize / originalSize) : 1;
        const spaceSaved = originalSize - compressedSize;
        const compressionPercent = originalSize > 0 ? ((spaceSaved / originalSize) * 100) : 0;

        return {
          originalSize,
          compressedSize,
          compressionRatio,
          compressionPercent,
          spaceSaved,
          algorithm: 'gzip',
          calculatedAt: new Date().toISOString()
        };
      }

    } catch (error) {
      throw new FileOperationError('Could not get compression statistics', 'STATS_ERROR', {
        filePath,
        error: error.message
      });
    }
  }

  /**
   * Compress metadata files for storage efficiency
   * @param {Object} metadata - Metadata object to compress
   * @returns {Promise<Buffer>} Compressed metadata
   */
  static async compressMetadata(metadata) {
    const jsonString = JSON.stringify(metadata);
    return await this.compressData(jsonString);
  }

  /**
   * Decompress metadata files
   * @param {Buffer} compressedMetadata - Compressed metadata buffer
   * @returns {Promise<Object>} Decompressed metadata object
   */
  static async decompressMetadata(compressedMetadata) {
    const decompressed = await this.decompressData(compressedMetadata);
    return JSON.parse(decompressed.toString());
  }

  /**
   * Check if compression would be beneficial for a file
   * @param {Buffer|string} data - Data to analyze
   * @param {Object} options - Analysis options
   * @returns {Object} Compression recommendation
   */
  static analyzeCompressionBenefit(data, options = {}) {
    const { minCompressionRatio = 0.8, minSizeThreshold = 1024 } = options;
    
    const size = Buffer.isBuffer(data) ? data.length : Buffer.byteLength(data);
    
    // Don't compress very small files
    if (size < minSizeThreshold) {
      return {
        shouldCompress: false,
        reason: 'File too small for compression benefit',
        size,
        threshold: minSizeThreshold
      };
    }

    // Estimate compression ratio based on data type and content
    let estimatedRatio = 0.7; // Default assumption
    
    if (typeof data === 'string') {
      // Text data typically compresses well
      const uniqueChars = new Set(data).size;
      const totalChars = data.length;
      const entropy = uniqueChars / totalChars;
      
      if (entropy < 0.5) {
        estimatedRatio = 0.3; // High repetition, good compression
      } else if (entropy < 0.8) {
        estimatedRatio = 0.6; // Medium repetition
      } else {
        estimatedRatio = 0.9; // Low repetition, poor compression
      }
    } else {
      // Binary data - harder to estimate, use conservative estimate
      estimatedRatio = 0.8;
    }

    const shouldCompress = estimatedRatio <= minCompressionRatio;
    const estimatedSpaceSaved = size * (1 - estimatedRatio);

    return {
      shouldCompress,
      estimatedCompressionRatio: estimatedRatio,
      estimatedSpaceSaved,
      size,
      reason: shouldCompress ? 
        `Estimated ${((1 - estimatedRatio) * 100).toFixed(1)}% compression` : 
        'Insufficient compression benefit'
    };
  }

  /**
   * Batch compress multiple files
   * @param {Array} filePaths - Array of file paths to compress
   * @param {Object} options - Compression options
   * @returns {Promise<Array>} Array of compression results
   */
  static async batchCompress(filePaths, options = {}) {
    const results = [];
    const { concurrency = 3 } = options;

    // Process files in batches to avoid overwhelming the system
    for (let i = 0; i < filePaths.length; i += concurrency) {
      const batch = filePaths.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async (filePath) => {
        try {
          const data = await fs.readFile(filePath);
          const analysis = this.analyzeCompressionBenefit(data);
          
          if (analysis.shouldCompress) {
            const compressedPath = `${filePath}.gz`;
            const result = await this.compressAndSaveFile(compressedPath, data, options);
            return { ...result, originalPath: filePath, success: true };
          } else {
            return { 
              originalPath: filePath, 
              success: false, 
              reason: analysis.reason,
              size: analysis.size
            };
          }
        } catch (error) {
          return { 
            originalPath: filePath, 
            success: false, 
            error: error.message 
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Calculate total compression statistics for a directory
   * @param {string} directoryPath - Path to directory
   * @returns {Promise<Object>} Directory compression statistics
   */
  static async getDirectoryCompressionStats(directoryPath) {
    try {
      const files = await fs.readdir(directoryPath);
      const compressedFiles = files.filter(file => file.endsWith('.gz'));
      
      let totalOriginalSize = 0;
      let totalCompressedSize = 0;
      let fileCount = 0;

      for (const file of compressedFiles) {
        try {
          const filePath = path.join(directoryPath, file);
          const stats = await this.getCompressionStats(filePath);
          
          totalOriginalSize += stats.originalSize || 0;
          totalCompressedSize += stats.compressedSize || 0;
          fileCount++;
        } catch (error) {
          console.warn(`FileCompressionUtils: Could not get stats for ${file}:`, error.message);
        }
      }

      const totalSpaceSaved = totalOriginalSize - totalCompressedSize;
      const overallCompressionRatio = totalOriginalSize > 0 ? (totalCompressedSize / totalOriginalSize) : 1;
      const overallCompressionPercent = totalOriginalSize > 0 ? ((totalSpaceSaved / totalOriginalSize) * 100) : 0;

      return {
        directoryPath,
        fileCount,
        totalOriginalSize,
        totalCompressedSize,
        totalSpaceSaved,
        overallCompressionRatio,
        overallCompressionPercent,
        averageCompressionRatio: fileCount > 0 ? (overallCompressionRatio / fileCount) : 1,
        calculatedAt: new Date().toISOString()
      };

    } catch (error) {
      throw new FileOperationError('Could not calculate directory compression stats', 'DIRECTORY_STATS_ERROR', {
        directoryPath,
        error: error.message
      });
    }
  }
}

module.exports = FileCompressionUtils;