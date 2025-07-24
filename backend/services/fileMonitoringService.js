/**
 * File Monitoring Service
 * Tracks file operations, storage usage, and performance metrics
 * Provides insights and alerts for file storage management
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const config = require('../config');
const fileStorageService = require('./fileStorageService');
const FileCompressionUtils = require('../utils/fileCompressionUtils');

class FileMonitoringService {
  constructor() {
    this.appConfig = config.getConfig();
    this.metrics = {
      operations: new Map(), // operation type -> count
      errors: new Map(),     // error type -> count
      performance: new Map(), // operation type -> { totalTime, count, avgTime }
      storage: {
        totalFiles: 0,
        totalSize: 0,
        compressionSavings: 0,
        lastUpdated: null
      },
      hourlyStats: new Map(), // hour -> stats
      dailyStats: new Map()   // date -> stats
    };
    this.isMonitoring = false;
    this.monitoringInterval = null;
  }

  /**
   * Initialize monitoring service
   */
  async initialize() {
    if (this.isMonitoring) {
      return;
    }

    try {
      console.log('FileMonitoringService: Initializing monitoring...');

      // Load existing metrics if available
      await this.loadPersistedMetrics();

      // Start periodic monitoring
      const monitoringInterval = this.appConfig.monitoring?.interval || 300000; // 5 minutes default
      this.startPeriodicMonitoring(monitoringInterval);

      this.isMonitoring = true;
      console.log('FileMonitoringService: Monitoring initialized successfully');

    } catch (error) {
      console.error('FileMonitoringService: Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Record a file operation with timing
   */
  recordOperation(operationType, duration, success = true, metadata = {}) {
    try {
      const now = new Date();
      const hour = now.getHours();
      const date = now.toISOString().split('T')[0];

      // Update operation counts
      const currentCount = this.metrics.operations.get(operationType) || 0;
      this.metrics.operations.set(operationType, currentCount + 1);

      // Update performance metrics
      const perfKey = operationType;
      const currentPerf = this.metrics.performance.get(perfKey) || { totalTime: 0, count: 0, avgTime: 0 };
      currentPerf.totalTime += duration;
      currentPerf.count += 1;
      currentPerf.avgTime = currentPerf.totalTime / currentPerf.count;
      this.metrics.performance.set(perfKey, currentPerf);

      // Update hourly stats
      const hourKey = `${date}_${hour.toString().padStart(2, '0')}`;
      const hourlyStats = this.metrics.hourlyStats.get(hourKey) || {
        operations: 0,
        errors: 0,
        totalTime: 0,
        avgTime: 0
      };
      hourlyStats.operations += 1;
      hourlyStats.totalTime += duration;
      hourlyStats.avgTime = hourlyStats.totalTime / hourlyStats.operations;
      if (!success) hourlyStats.errors += 1;
      this.metrics.hourlyStats.set(hourKey, hourlyStats);

      // Update daily stats
      const dailyStats = this.metrics.dailyStats.get(date) || {
        operations: 0,
        errors: 0,
        totalTime: 0,
        avgTime: 0,
        uniqueUsers: new Set()
      };
      dailyStats.operations += 1;
      dailyStats.totalTime += duration;
      dailyStats.avgTime = dailyStats.totalTime / dailyStats.operations;
      if (!success) dailyStats.errors += 1;
      if (metadata.userId) dailyStats.uniqueUsers.add(metadata.userId);
      this.metrics.dailyStats.set(date, dailyStats);

      // Log slow operations
      const slowThreshold = this.appConfig.monitoring?.slowOperationThreshold || 5000; // 5 seconds
      if (duration > slowThreshold) {
        console.warn(`FileMonitoringService: Slow operation detected - ${operationType}: ${duration}ms`, metadata);
      }

    } catch (error) {
      console.error('FileMonitoringService: Error recording operation:', error);
    }
  }

  /**
   * Record an error
   */
  recordError(errorType, errorDetails = {}) {
    try {
      const currentCount = this.metrics.errors.get(errorType) || 0;
      this.metrics.errors.set(errorType, currentCount + 1);

      // Log high error rates
      const totalOperations = Array.from(this.metrics.operations.values()).reduce((sum, count) => sum + count, 0);
      const totalErrors = Array.from(this.metrics.errors.values()).reduce((sum, count) => sum + count, 0);
      const errorRate = totalOperations > 0 ? (totalErrors / totalOperations) : 0;

      if (errorRate > 0.1) { // More than 10% error rate
        console.warn(`FileMonitoringService: High error rate detected: ${(errorRate * 100).toFixed(1)}%`);
      }

    } catch (error) {
      console.error('FileMonitoringService: Error recording error:', error);
    }
  }

  /**
   * Start periodic monitoring
   */
  startPeriodicMonitoring(interval) {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    console.log(`FileMonitoringService: Starting periodic monitoring every ${interval}ms`);

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.updateStorageMetrics();
        await this.checkStorageAlerts();
        await this.persistMetrics();
        await this.cleanupOldMetrics();
      } catch (error) {
        console.error('FileMonitoringService: Error in periodic monitoring:', error);
      }
    }, interval);
  }

  /**
   * Stop periodic monitoring
   */
  stopPeriodicMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('FileMonitoringService: Stopped periodic monitoring');
    }
  }

  /**
   * Update storage metrics
   */
  async updateStorageMetrics() {
    try {
      const storageStats = await fileStorageService.getStorageStats();
      
      this.metrics.storage = {
        totalFiles: storageStats.total.files,
        totalSize: storageStats.total.size,
        directories: storageStats.directories,
        lastUpdated: new Date().toISOString()
      };

      // Calculate compression savings if compression is used
      try {
        let totalCompressionSavings = 0;
        for (const [type, dirPath] of Object.entries(fileStorageService.directories)) {
          if (type === 'metadata') continue;
          
          try {
            const compressionStats = await FileCompressionUtils.getDirectoryCompressionStats(dirPath);
            totalCompressionSavings += compressionStats.totalSpaceSaved || 0;
          } catch (compressionError) {
            // Compression stats not available for this directory
          }
        }
        this.metrics.storage.compressionSavings = totalCompressionSavings;
      } catch (error) {
        // Compression tracking not available
      }

    } catch (error) {
      console.error('FileMonitoringService: Error updating storage metrics:', error);
    }
  }

  /**
   * Check for storage alerts
   */
  async checkStorageAlerts() {
    try {
      const alerts = [];
      const thresholds = this.appConfig.monitoring?.alerts || {};

      // Check storage usage
      const maxStorageSize = this.appConfig.storage?.maxStorageSize || 1073741824; // 1GB
      const usagePercent = (this.metrics.storage.totalSize / maxStorageSize) * 100;

      if (usagePercent > (thresholds.storageWarning || 80)) {
        alerts.push({
          type: 'storage_warning',
          message: `Storage usage is ${usagePercent.toFixed(1)}% of maximum`,
          severity: usagePercent > (thresholds.storageCritical || 95) ? 'critical' : 'warning',
          timestamp: new Date().toISOString()
        });
      }

      // Check error rates
      const totalOperations = Array.from(this.metrics.operations.values()).reduce((sum, count) => sum + count, 0);
      const totalErrors = Array.from(this.metrics.errors.values()).reduce((sum, count) => sum + count, 0);
      const errorRate = totalOperations > 0 ? (totalErrors / totalOperations) : 0;

      if (errorRate > (thresholds.errorRate || 0.1)) {
        alerts.push({
          type: 'high_error_rate',
          message: `Error rate is ${(errorRate * 100).toFixed(1)}%`,
          severity: errorRate > (thresholds.errorRateCritical || 0.2) ? 'critical' : 'warning',
          timestamp: new Date().toISOString()
        });
      }

      // Check slow operations
      const slowOperations = Array.from(this.metrics.performance.entries())
        .filter(([_, perf]) => perf.avgTime > (thresholds.slowOperation || 5000));

      if (slowOperations.length > 0) {
        alerts.push({
          type: 'slow_operations',
          message: `${slowOperations.length} operation types are running slowly`,
          details: slowOperations.map(([op, perf]) => ({ operation: op, avgTime: perf.avgTime })),
          severity: 'warning',
          timestamp: new Date().toISOString()
        });
      }

      // Log alerts
      for (const alert of alerts) {
        if (alert.severity === 'critical') {
          console.error('FileMonitoringService: CRITICAL ALERT -', alert.message);
        } else {
          console.warn('FileMonitoringService: Warning -', alert.message);
        }
      }

      return alerts;

    } catch (error) {
      console.error('FileMonitoringService: Error checking storage alerts:', error);
      return [];
    }
  }

  /**
   * Get current monitoring metrics
   */
  getMetrics() {
    return {
      operations: Object.fromEntries(this.metrics.operations),
      errors: Object.fromEntries(this.metrics.errors),
      performance: Object.fromEntries(this.metrics.performance),
      storage: this.metrics.storage,
      summary: {
        totalOperations: Array.from(this.metrics.operations.values()).reduce((sum, count) => sum + count, 0),
        totalErrors: Array.from(this.metrics.errors.values()).reduce((sum, count) => sum + count, 0),
        errorRate: this.calculateErrorRate(),
        averageOperationTime: this.calculateAverageOperationTime(),
        isMonitoring: this.isMonitoring
      }
    };
  }

  /**
   * Get performance report
   */
  getPerformanceReport(timeRange = '24h') {
    try {
      const now = new Date();
      let startTime;

      switch (timeRange) {
        case '1h':
          startTime = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case '24h':
          startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        default:
          startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }

      // Filter metrics by time range
      const filteredHourlyStats = Array.from(this.metrics.hourlyStats.entries())
        .filter(([hourKey, _]) => {
          const [date, hour] = hourKey.split('_');
          const hourDate = new Date(`${date}T${hour}:00:00`);
          return hourDate >= startTime;
        })
        .map(([hourKey, stats]) => ({ hour: hourKey, ...stats }));

      const filteredDailyStats = Array.from(this.metrics.dailyStats.entries())
        .filter(([date, _]) => {
          const dayDate = new Date(`${date}T00:00:00`);
          return dayDate >= startTime;
        })
        .map(([date, stats]) => ({ 
          date, 
          ...stats,
          uniqueUsers: stats.uniqueUsers ? stats.uniqueUsers.size : 0
        }));

      return {
        timeRange,
        startTime: startTime.toISOString(),
        endTime: now.toISOString(),
        hourlyStats: filteredHourlyStats,
        dailyStats: filteredDailyStats,
        topOperations: this.getTopOperations(),
        topErrors: this.getTopErrors(),
        performanceTrends: this.getPerformanceTrends(filteredHourlyStats)
      };

    } catch (error) {
      console.error('FileMonitoringService: Error generating performance report:', error);
      return { error: error.message };
    }
  }

  /**
   * Get top operations by count
   */
  getTopOperations(limit = 10) {
    return Array.from(this.metrics.operations.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([operation, count]) => ({ operation, count }));
  }

  /**
   * Get top errors by count
   */
  getTopErrors(limit = 10) {
    return Array.from(this.metrics.errors.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([error, count]) => ({ error, count }));
  }

  /**
   * Calculate error rate
   */
  calculateErrorRate() {
    const totalOperations = Array.from(this.metrics.operations.values()).reduce((sum, count) => sum + count, 0);
    const totalErrors = Array.from(this.metrics.errors.values()).reduce((sum, count) => sum + count, 0);
    return totalOperations > 0 ? (totalErrors / totalOperations) : 0;
  }

  /**
   * Calculate average operation time
   */
  calculateAverageOperationTime() {
    const performances = Array.from(this.metrics.performance.values());
    if (performances.length === 0) return 0;
    
    const totalTime = performances.reduce((sum, perf) => sum + perf.totalTime, 0);
    const totalCount = performances.reduce((sum, perf) => sum + perf.count, 0);
    
    return totalCount > 0 ? (totalTime / totalCount) : 0;
  }

  /**
   * Get performance trends
   */
  getPerformanceTrends(hourlyStats) {
    if (hourlyStats.length < 2) return { trend: 'insufficient_data' };

    const recentStats = hourlyStats.slice(-6); // Last 6 hours
    const earlierStats = hourlyStats.slice(0, Math.min(6, hourlyStats.length - 6));

    if (recentStats.length === 0 || earlierStats.length === 0) {
      return { trend: 'insufficient_data' };
    }

    const recentAvg = recentStats.reduce((sum, stat) => sum + stat.avgTime, 0) / recentStats.length;
    const earlierAvg = earlierStats.reduce((sum, stat) => sum + stat.avgTime, 0) / earlierStats.length;

    const change = ((recentAvg - earlierAvg) / earlierAvg) * 100;

    return {
      trend: change > 10 ? 'degrading' : change < -10 ? 'improving' : 'stable',
      changePercent: change,
      recentAverage: recentAvg,
      previousAverage: earlierAvg
    };
  }

  /**
   * Persist metrics to storage
   */
  async persistMetrics() {
    try {
      const metricsDir = path.join(this.appConfig.storage.generatedMapsDir, '..', 'monitoring');
      await fs.mkdir(metricsDir, { recursive: true });

      const metricsPath = path.join(metricsDir, 'file-metrics.json');
      const metricsData = {
        operations: Object.fromEntries(this.metrics.operations),
        errors: Object.fromEntries(this.metrics.errors),
        performance: Object.fromEntries(this.metrics.performance),
        storage: this.metrics.storage,
        hourlyStats: Object.fromEntries(this.metrics.hourlyStats),
        dailyStats: Object.fromEntries(
          Array.from(this.metrics.dailyStats.entries()).map(([date, stats]) => [
            date,
            { ...stats, uniqueUsers: Array.from(stats.uniqueUsers || []) }
          ])
        ),
        lastPersisted: new Date().toISOString()
      };

      await fs.writeFile(metricsPath, JSON.stringify(metricsData, null, 2));

    } catch (error) {
      console.error('FileMonitoringService: Error persisting metrics:', error);
    }
  }

  /**
   * Load persisted metrics
   */
  async loadPersistedMetrics() {
    try {
      const metricsDir = path.join(this.appConfig.storage.generatedMapsDir, '..', 'monitoring');
      const metricsPath = path.join(metricsDir, 'file-metrics.json');

      const metricsData = JSON.parse(await fs.readFile(metricsPath, 'utf8'));

      this.metrics.operations = new Map(Object.entries(metricsData.operations || {}));
      this.metrics.errors = new Map(Object.entries(metricsData.errors || {}));
      this.metrics.performance = new Map(Object.entries(metricsData.performance || {}));
      this.metrics.storage = metricsData.storage || this.metrics.storage;
      this.metrics.hourlyStats = new Map(Object.entries(metricsData.hourlyStats || {}));
      this.metrics.dailyStats = new Map(
        Object.entries(metricsData.dailyStats || {}).map(([date, stats]) => [
          date,
          { ...stats, uniqueUsers: new Set(stats.uniqueUsers || []) }
        ])
      );

      console.log('FileMonitoringService: Loaded persisted metrics');

    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn('FileMonitoringService: Could not load persisted metrics:', error.message);
      }
    }
  }

  /**
   * Clean up old metrics to prevent unbounded growth
   */
  async cleanupOldMetrics() {
    try {
      const now = new Date();
      const cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days

      // Clean up old hourly stats
      for (const [hourKey] of this.metrics.hourlyStats) {
        const [date, hour] = hourKey.split('_');
        const hourDate = new Date(`${date}T${hour}:00:00`);
        if (hourDate < cutoffDate) {
          this.metrics.hourlyStats.delete(hourKey);
        }
      }

      // Clean up old daily stats
      for (const [date] of this.metrics.dailyStats) {
        const dayDate = new Date(`${date}T00:00:00`);
        if (dayDate < cutoffDate) {
          this.metrics.dailyStats.delete(date);
        }
      }

    } catch (error) {
      console.error('FileMonitoringService: Error cleaning up old metrics:', error);
    }
  }

  /**
   * Shutdown monitoring service
   */
  async shutdown() {
    console.log('FileMonitoringService: Shutting down...');
    
    this.stopPeriodicMonitoring();
    
    // Persist final metrics
    try {
      await this.persistMetrics();
    } catch (error) {
      console.error('FileMonitoringService: Error persisting final metrics:', error);
    }
    
    this.isMonitoring = false;
    console.log('FileMonitoringService: Shutdown complete');
  }
}

// Export singleton instance
const fileMonitoringService = new FileMonitoringService();

module.exports = fileMonitoringService;
module.exports.FileMonitoringService = FileMonitoringService;