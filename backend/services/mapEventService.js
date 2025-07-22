/**
 * Map Event Service for Analytics and User Interaction Tracking
 * Handles server-side logging and analysis of map interactions
 * Provides insights for UX improvement and performance optimization
 */

const fs = require('fs').promises;
const path = require('path');
const config = require('../config');

class MapEventService {
  constructor() {
    this.appConfig = config.getConfig();
    this.eventLogPath = path.join(__dirname, '..', 'logs', 'map-events.log');
    this.analyticsPath = path.join(__dirname, '..', 'logs', 'map-analytics.json');
    this.isInitialized = false;
    
    // In-memory event buffer for performance
    this.eventBuffer = [];
    this.bufferSize = 100;
    this.flushInterval = 30000; // 30 seconds
    this.flushTimer = null;

    // Analytics data structure
    this.analytics = {
      totalEvents: 0,
      eventCounts: {},
      userSessions: {},
      performanceMetrics: {},
      errorCounts: {},
      popularFeatures: {},
      lastUpdated: null
    };

    this.init();
  }

  /**
   * Initialize the service
   */
  async init() {
    try {
      // Create logs directory if it doesn't exist
      const logsDir = path.dirname(this.eventLogPath);
      await fs.mkdir(logsDir, { recursive: true });

      // Load existing analytics
      await this.loadAnalytics();

      // Start periodic flush
      this.startPeriodicFlush();

      this.isInitialized = true;
      console.log('MapEventService: Initialized successfully');

    } catch (error) {
      console.error('MapEventService: Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Load existing analytics data
   */
  async loadAnalytics() {
    try {
      const data = await fs.readFile(this.analyticsPath, 'utf8');
      this.analytics = JSON.parse(data);
      console.log('MapEventService: Loaded existing analytics data');
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn('MapEventService: Error loading analytics:', error.message);
      }
      // Use default analytics structure if file doesn't exist
    }
  }

  /**
   * Save analytics data
   */
  async saveAnalytics() {
    try {
      this.analytics.lastUpdated = new Date().toISOString();
      await fs.writeFile(this.analyticsPath, JSON.stringify(this.analytics, null, 2));
    } catch (error) {
      console.error('MapEventService: Error saving analytics:', error);
    }
  }

  /**
   * Start periodic flush of event buffer
   */
  startPeriodicFlush() {
    this.flushTimer = setInterval(async () => {
      if (this.eventBuffer.length > 0) {
        await this.flushEventBuffer();
      }
    }, this.flushInterval);
  }

  /**
   * Stop periodic flush
   */
  stopPeriodicFlush() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Log a map event
   */
  async logEvent(eventType, eventData, userId = null, sessionId = null) {
    if (!this.isInitialized) {
      console.warn('MapEventService: Service not initialized');
      return;
    }

    try {
      const timestamp = new Date().toISOString();
      
      const logEntry = {
        timestamp,
        eventType,
        userId,
        sessionId,
        data: eventData,
        userAgent: eventData.userAgent || null,
        ip: eventData.ip || null
      };

      // Add to buffer
      this.eventBuffer.push(logEntry);

      // Update analytics
      this.updateAnalytics(eventType, eventData, userId, sessionId);

      // Flush buffer if it's full
      if (this.eventBuffer.length >= this.bufferSize) {
        await this.flushEventBuffer();
      }

    } catch (error) {
      console.error('MapEventService: Error logging event:', error);
    }
  }

  /**
   * Update analytics data
   */
  updateAnalytics(eventType, eventData, userId, sessionId) {
    // Increment total events
    this.analytics.totalEvents++;

    // Update event counts
    this.analytics.eventCounts[eventType] = (this.analytics.eventCounts[eventType] || 0) + 1;

    // Update user session data
    if (userId && sessionId) {
      const sessionKey = `${userId}-${sessionId}`;
      
      if (!this.analytics.userSessions[sessionKey]) {
        this.analytics.userSessions[sessionKey] = {
          userId,
          sessionId,
          firstSeen: new Date().toISOString(),
          eventCount: 0,
          eventTypes: {}
        };
      }

      const session = this.analytics.userSessions[sessionKey];
      session.eventCount++;
      session.lastSeen = new Date().toISOString();
      session.eventTypes[eventType] = (session.eventTypes[eventType] || 0) + 1;
    }

    // Track performance metrics
    if (eventData.performanceMetrics) {
      this.updatePerformanceMetrics(eventType, eventData.performanceMetrics);
    }

    // Track errors
    if (eventType.includes('error') || eventData.error) {
      this.analytics.errorCounts[eventType] = (this.analytics.errorCounts[eventType] || 0) + 1;
    }

    // Track popular features
    if (eventData.feature || eventData.clickedRoute || eventData.hoveredFeatures) {
      this.updatePopularFeatures(eventType, eventData);
    }
  }

  /**
   * Update performance metrics
   */
  updatePerformanceMetrics(eventType, metrics) {
    if (!this.analytics.performanceMetrics[eventType]) {
      this.analytics.performanceMetrics[eventType] = {
        totalTime: 0,
        eventCount: 0,
        averageTime: 0,
        minTime: Number.MAX_SAFE_INTEGER,
        maxTime: 0
      };
    }

    const perfData = this.analytics.performanceMetrics[eventType];
    const processingTime = metrics.processingTime || metrics.duration || 0;

    perfData.totalTime += processingTime;
    perfData.eventCount++;
    perfData.averageTime = perfData.totalTime / perfData.eventCount;
    perfData.minTime = Math.min(perfData.minTime, processingTime);
    perfData.maxTime = Math.max(perfData.maxTime, processingTime);
  }

  /**
   * Update popular features tracking
   */
  updatePopularFeatures(eventType, eventData) {
    let featureType = null;
    let featureId = null;

    if (eventData.clickedRoute) {
      featureType = 'route';
      featureId = eventData.clickedRoute.id || 'route-main';
    } else if (eventData.hoveredFeatures && eventData.hoveredFeatures.length > 0) {
      featureType = 'hover';
      featureId = eventData.hoveredFeatures[0].layer?.id || 'unknown';
    } else if (eventData.feature) {
      featureType = eventData.feature.type;
      featureId = eventData.feature.id || 'unknown';
    }

    if (featureType && featureId) {
      const key = `${featureType}-${featureId}`;
      this.analytics.popularFeatures[key] = (this.analytics.popularFeatures[key] || 0) + 1;
    }
  }

  /**
   * Flush event buffer to log file
   */
  async flushEventBuffer() {
    if (this.eventBuffer.length === 0) return;

    try {
      const logEntries = this.eventBuffer.map(entry => JSON.stringify(entry)).join('\n') + '\n';
      await fs.appendFile(this.eventLogPath, logEntries);
      
      console.log(`MapEventService: Flushed ${this.eventBuffer.length} events to log`);
      this.eventBuffer = [];

      // Save analytics periodically
      await this.saveAnalytics();

    } catch (error) {
      console.error('MapEventService: Error flushing event buffer:', error);
    }
  }

  /**
   * Get analytics summary
   */
  getAnalyticsSummary() {
    const topEvents = Object.entries(this.analytics.eventCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([eventType, count]) => ({ eventType, count }));

    const topFeatures = Object.entries(this.analytics.popularFeatures)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([feature, count]) => ({ feature, count }));

    const sessionCount = Object.keys(this.analytics.userSessions).length;
    const averageEventsPerSession = sessionCount > 0 
      ? Math.round(this.analytics.totalEvents / sessionCount)
      : 0;

    return {
      totalEvents: this.analytics.totalEvents,
      sessionCount,
      averageEventsPerSession,
      topEvents,
      topFeatures,
      errorRate: this.calculateErrorRate(),
      lastUpdated: this.analytics.lastUpdated
    };
  }

  /**
   * Calculate error rate
   */
  calculateErrorRate() {
    const totalErrors = Object.values(this.analytics.errorCounts).reduce((sum, count) => sum + count, 0);
    return this.analytics.totalEvents > 0 ? (totalErrors / this.analytics.totalEvents * 100).toFixed(2) : 0;
  }

  /**
   * Get performance metrics for specific event types
   */
  getPerformanceMetrics(eventType = null) {
    if (eventType) {
      return this.analytics.performanceMetrics[eventType] || null;
    }
    return this.analytics.performanceMetrics;
  }

  /**
   * Get user session analytics
   */
  getUserSessionAnalytics(limit = 50) {
    return Object.values(this.analytics.userSessions)
      .sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen))
      .slice(0, limit);
  }

  /**
   * Generate usage report
   */
  generateUsageReport(startDate = null, endDate = null) {
    // This would filter events by date range if log parsing is implemented
    const summary = this.getAnalyticsSummary();
    const performanceMetrics = this.getPerformanceMetrics();
    const recentSessions = this.getUserSessionAnalytics(20);

    return {
      reportGenerated: new Date().toISOString(),
      period: {
        start: startDate || 'all-time',
        end: endDate || 'current'
      },
      summary,
      performanceMetrics,
      recentSessions,
      recommendations: this.generateRecommendations()
    };
  }

  /**
   * Generate recommendations based on analytics
   */
  generateRecommendations() {
    const recommendations = [];
    
    // High error rate recommendation
    const errorRate = parseFloat(this.calculateErrorRate());
    if (errorRate > 5) {
      recommendations.push({
        type: 'error-rate',
        priority: 'high',
        message: `Error rate is ${errorRate}%. Consider reviewing error logs and improving error handling.`
      });
    }

    // Performance recommendations
    const performanceIssues = Object.entries(this.analytics.performanceMetrics)
      .filter(([eventType, metrics]) => metrics.averageTime > 100)
      .map(([eventType, metrics]) => ({ eventType, averageTime: metrics.averageTime }));

    if (performanceIssues.length > 0) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        message: `Slow events detected: ${performanceIssues.map(p => `${p.eventType} (${p.averageTime.toFixed(1)}ms)`).join(', ')}`
      });
    }

    // Popular features recommendation
    const topFeatures = Object.entries(this.analytics.popularFeatures)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3);

    if (topFeatures.length > 0) {
      recommendations.push({
        type: 'feature-usage',
        priority: 'low',
        message: `Most used features: ${topFeatures.map(([feature]) => feature).join(', ')}. Consider highlighting these in the UI.`
      });
    }

    return recommendations;
  }

  /**
   * Clear old analytics data
   */
  async clearOldData(olderThanDays = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
      
      // Filter user sessions
      const filteredSessions = {};
      Object.entries(this.analytics.userSessions).forEach(([key, session]) => {
        if (new Date(session.lastSeen) > cutoffDate) {
          filteredSessions[key] = session;
        }
      });
      
      this.analytics.userSessions = filteredSessions;
      
      // Save cleaned analytics
      await this.saveAnalytics();
      
      console.log(`MapEventService: Cleared analytics data older than ${olderThanDays} days`);
    } catch (error) {
      console.error('MapEventService: Error clearing old data:', error);
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      eventBufferSize: this.eventBuffer.length,
      totalEventsLogged: this.analytics.totalEvents,
      lastAnalyticsUpdate: this.analytics.lastUpdated,
      flushIntervalMs: this.flushInterval
    };
  }

  /**
   * Cleanup service
   */
  async cleanup() {
    console.log('MapEventService: Cleaning up...');
    
    // Stop periodic flush
    this.stopPeriodicFlush();
    
    // Flush remaining events
    if (this.eventBuffer.length > 0) {
      await this.flushEventBuffer();
    }
    
    this.isInitialized = false;
    console.log('MapEventService: Cleanup completed');
  }
}

// Export singleton instance
const mapEventService = new MapEventService();

module.exports = mapEventService;
module.exports.MapEventService = MapEventService;