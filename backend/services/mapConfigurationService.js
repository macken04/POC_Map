/**
 * Map Configuration Service
 * 
 * Handles file-based storage and management of map configurations.
 * Replaces session-based storage with persistent JSON file storage.
 * 
 * Features:
 * - Save/load configurations from file system
 * - Configuration lifecycle management (active -> processed/failed)
 * - Automatic cleanup of old configurations
 * - Error recovery and debugging support
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class MapConfigurationService {
  constructor() {
    this.basePath = path.join(__dirname, '..', 'map-configurations');
    this.activePath = path.join(this.basePath, 'active');
    this.processedPath = path.join(this.basePath, 'processed');
    this.failedPath = path.join(this.basePath, 'failed');
    
    this.isInitialized = false;
  }

  /**
   * Initialize the service and ensure directory structure exists
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      // Create directory structure
      await this.ensureDirectoryStructure();
      this.isInitialized = true;
      console.log('[MapConfigurationService] Initialized successfully');
    } catch (error) {
      console.error('[MapConfigurationService] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Ensure all required directories exist
   */
  async ensureDirectoryStructure() {
    const directories = [this.basePath, this.activePath, this.processedPath, this.failedPath];
    
    for (const dir of directories) {
      try {
        await fs.access(dir);
      } catch {
        await fs.mkdir(dir, { recursive: true });
        console.log(`[MapConfigurationService] Created directory: ${dir}`);
      }
    }
  }

  /**
   * Generate a unique configuration ID
   */
  generateConfigurationId() {
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(6).toString('hex');
    return `config_${timestamp}_${randomId}`;
  }

  /**
   * Extract timestamp from configuration ID
   */
  extractTimestampFromId(configId) {
    const match = configId.match(/^config_(\d+)_/);
    return match ? parseInt(match[1]) : 0;
  }

  /**
   * Get file path for configuration
   */
  getConfigurationPath(configId, folder = 'active') {
    const folderPath = folder === 'active' ? this.activePath :
                     folder === 'processed' ? this.processedPath :
                     folder === 'failed' ? this.failedPath : this.activePath;
    
    return path.join(folderPath, `${configId}.json`);
  }

  /**
   * Validate configuration data
   */
  validateConfiguration(config) {
    const required = ['activityId', 'printSize', 'orientation'];
    const missing = required.filter(field => !config[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required configuration fields: ${missing.join(', ')}`);
    }

    // Validate print size
    const validSizes = ['A4', 'A3', 'a4', 'a3'];
    if (!validSizes.includes(config.printSize)) {
      throw new Error(`Invalid print size: ${config.printSize}`);
    }

    // Validate orientation
    const validOrientations = ['portrait', 'landscape'];
    if (!validOrientations.includes(config.orientation)) {
      throw new Error(`Invalid orientation: ${config.orientation}`);
    }

    return true;
  }

  /**
   * Save configuration to file system
   */
  async saveConfiguration(configId, mapConfig) {
    await this.initialize();

    try {
      // Validate configuration
      this.validateConfiguration(mapConfig);

      // Prepare configuration data with metadata
      const configData = {
        id: configId,
        createdAt: new Date().toISOString(),
        status: 'active',
        mapConfiguration: mapConfig,
        metadata: {
          version: '1.0',
          source: 'json_file_service'
        }
      };

      // Write to file
      const filePath = this.getConfigurationPath(configId, 'active');
      await fs.writeFile(filePath, JSON.stringify(configData, null, 2));

      console.log(`[MapConfigurationService] Saved configuration: ${configId}`);
      return configId;

    } catch (error) {
      console.error(`[MapConfigurationService] Failed to save configuration ${configId}:`, error);
      throw error;
    }
  }

  /**
   * Load configuration from file system
   */
  async loadConfiguration(configId, folder = 'active') {
    await this.initialize();

    try {
      const filePath = this.getConfigurationPath(configId, folder);
      
      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        console.log(`[MapConfigurationService] Configuration not found: ${configId} in ${folder}`);
        return null;
      }

      // Read and parse configuration
      const fileContent = await fs.readFile(filePath, 'utf8');
      const configData = JSON.parse(fileContent);

      console.log(`[MapConfigurationService] Loaded configuration: ${configId} from ${folder}`);
      return configData;

    } catch (error) {
      console.error(`[MapConfigurationService] Failed to load configuration ${configId}:`, error);
      throw error;
    }
  }

  /**
   * Delete configuration file
   */
  async deleteConfiguration(configId, folder = 'active') {
    await this.initialize();

    try {
      const filePath = this.getConfigurationPath(configId, folder);
      
      try {
        await fs.unlink(filePath);
        console.log(`[MapConfigurationService] Deleted configuration: ${configId} from ${folder}`);
        return true;
      } catch (error) {
        if (error.code === 'ENOENT') {
          console.log(`[MapConfigurationService] Configuration not found for deletion: ${configId}`);
          return false;
        }
        throw error;
      }

    } catch (error) {
      console.error(`[MapConfigurationService] Failed to delete configuration ${configId}:`, error);
      throw error;
    }
  }

  /**
   * Move configuration to processed folder
   */
  async moveToProcessed(configId) {
    await this.initialize();

    try {
      const sourceConfig = await this.loadConfiguration(configId, 'active');
      if (!sourceConfig) {
        console.error(`[MapConfigurationService] Cannot move to processed - configuration not found: ${configId}`);
        return false;
      }

      // Update status and add processed timestamp
      sourceConfig.status = 'processed';
      sourceConfig.processedAt = new Date().toISOString();

      // Save to processed folder
      const processedPath = this.getConfigurationPath(configId, 'processed');
      await fs.writeFile(processedPath, JSON.stringify(sourceConfig, null, 2));

      // Delete from active folder
      await this.deleteConfiguration(configId, 'active');

      console.log(`[MapConfigurationService] Moved configuration to processed: ${configId}`);
      return true;

    } catch (error) {
      console.error(`[MapConfigurationService] Failed to move configuration to processed ${configId}:`, error);
      throw error;
    }
  }

  /**
   * Move configuration to failed folder
   */
  async moveToFailed(configId, error) {
    await this.initialize();

    try {
      const sourceConfig = await this.loadConfiguration(configId, 'active');
      if (!sourceConfig) {
        console.error(`[MapConfigurationService] Cannot move to failed - configuration not found: ${configId}`);
        return false;
      }

      // Update status and add failure information
      sourceConfig.status = 'failed';
      sourceConfig.failedAt = new Date().toISOString();
      sourceConfig.error = {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      };

      // Save to failed folder
      const failedPath = this.getConfigurationPath(configId, 'failed');
      await fs.writeFile(failedPath, JSON.stringify(sourceConfig, null, 2));

      // Delete from active folder
      await this.deleteConfiguration(configId, 'active');

      console.log(`[MapConfigurationService] Moved configuration to failed: ${configId}`);
      return true;

    } catch (moveError) {
      console.error(`[MapConfigurationService] Failed to move configuration to failed ${configId}:`, moveError);
      throw moveError;
    }
  }

  /**
   * List configurations in a specific folder
   */
  async listConfigurations(folder = 'active') {
    await this.initialize();

    try {
      const folderPath = folder === 'active' ? this.activePath :
                        folder === 'processed' ? this.processedPath :
                        folder === 'failed' ? this.failedPath : this.activePath;

      const files = await fs.readdir(folderPath);
      const configIds = files
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace('.json', ''));

      return configIds;

    } catch (error) {
      console.error(`[MapConfigurationService] Failed to list configurations in ${folder}:`, error);
      return [];
    }
  }

  /**
   * Cleanup old configurations
   */
  async cleanupOldConfigurations(maxAgeMs = 7 * 24 * 60 * 60 * 1000) { // 7 days default
    await this.initialize();

    try {
      const now = Date.now();
      let cleanedCount = 0;

      // Cleanup active configurations
      const activeConfigs = await this.listConfigurations('active');
      for (const configId of activeConfigs) {
        const configTime = this.extractTimestampFromId(configId);
        if (now - configTime > maxAgeMs) {
          await this.deleteConfiguration(configId, 'active');
          cleanedCount++;
        }
      }

      // Cleanup processed configurations older than 30 days
      const processedMaxAge = 30 * 24 * 60 * 60 * 1000;
      const processedConfigs = await this.listConfigurations('processed');
      for (const configId of processedConfigs) {
        const configTime = this.extractTimestampFromId(configId);
        if (now - configTime > processedMaxAge) {
          await this.deleteConfiguration(configId, 'processed');
          cleanedCount++;
        }
      }

      console.log(`[MapConfigurationService] Cleanup completed - removed ${cleanedCount} old configurations`);
      return cleanedCount;

    } catch (error) {
      console.error('[MapConfigurationService] Cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Get configuration statistics
   */
  async getStatistics() {
    await this.initialize();

    try {
      const activeCount = (await this.listConfigurations('active')).length;
      const processedCount = (await this.listConfigurations('processed')).length;
      const failedCount = (await this.listConfigurations('failed')).length;

      return {
        active: activeCount,
        processed: processedCount,
        failed: failedCount,
        total: activeCount + processedCount + failedCount
      };

    } catch (error) {
      console.error('[MapConfigurationService] Failed to get statistics:', error);
      return { active: 0, processed: 0, failed: 0, total: 0 };
    }
  }

  /**
   * Recover failed configuration (move back to active)
   */
  async recoverFailedConfiguration(configId) {
    await this.initialize();

    try {
      const failedConfig = await this.loadConfiguration(configId, 'failed');
      if (!failedConfig) {
        console.error(`[MapConfigurationService] Cannot recover - configuration not found in failed: ${configId}`);
        return false;
      }

      // Reset status for recovery
      failedConfig.status = 'active';
      failedConfig.recoveredAt = new Date().toISOString();
      delete failedConfig.error;
      delete failedConfig.failedAt;

      // Save back to active folder
      const activePath = this.getConfigurationPath(configId, 'active');
      await fs.writeFile(activePath, JSON.stringify(failedConfig, null, 2));

      // Delete from failed folder
      await this.deleteConfiguration(configId, 'failed');

      console.log(`[MapConfigurationService] Recovered configuration from failed: ${configId}`);
      return true;

    } catch (error) {
      console.error(`[MapConfigurationService] Failed to recover configuration ${configId}:`, error);
      throw error;
    }
  }
}

module.exports = MapConfigurationService;