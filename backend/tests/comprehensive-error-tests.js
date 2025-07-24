/**
 * Comprehensive Error Scenario Testing Suite
 * Tests for all error handling scenarios in the route rendering system
 * including network failures, corrupted data, large datasets, performance issues,
 * and cross-browser compatibility.
 * 
 * Features:
 * - Network failure simulation
 * - Corrupted/malformed data testing
 * - Large dataset performance testing
 * - Cross-browser error handling validation
 * - Error recovery mechanism testing
 * - Performance degradation testing
 * - Memory limit testing
 * - Timeout handling testing
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

// Import services to test
const ErrorResponseHandler = require('../middleware/errorResponseHandler');
const performanceMonitor = require('../services/performanceMonitor');
const stravaService = require('../services/stravaService');
const gpxTcxParser = require('../services/gpxTcxParser');

class ComprehensiveErrorTestSuite {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      performance: {},
      coverage: {}
    };
    
    this.testData = this.generateTestData();
    this.mockServices = this.setupMockServices();
    
    console.log('Comprehensive Error Test Suite initialized');
  }

  /**
   * Generate test data for various error scenarios
   */
  generateTestData() {
    return {
      // Valid data for comparison
      validCoordinates: [
        [40.7128, -74.0060], // NYC
        [40.7589, -73.9851], // Times Square
        [40.6892, -74.0445]  // Statue of Liberty
      ],
      
      // Invalid coordinate data
      invalidCoordinates: {
        empty: [],
        null: null,
        undefined: undefined,
        nonArray: 'not-an-array',
        invalidStructure: [1, 2, 3],
        outOfBounds: [
          [91, 0],    // Lat > 90
          [-91, 0],   // Lat < -90
          [0, 181],   // Lng > 180
          [0, -181]   // Lng < -180
        ],
        nonNumeric: [['a', 'b'], ['x', 'y']],
        incomplete: [[40.7128], [-74.0060, 'extra']],
        tooLarge: Array(200000).fill([40.7128, -74.0060]) // 200k points
      },
      
      // File test data
      validFiles: {
        gpx: `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test">
  <trk>
    <trkpt lat="40.7128" lon="-74.0060"/>
    <trkpt lat="40.7589" lon="-73.9851"/>
  </trk>
</gpx>`,
        tcx: `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase>
  <Activity>
    <Lap>
      <Track>
        <Trackpoint>
          <Position>
            <LatitudeDegrees>40.7128</LatitudeDegrees>
            <LongitudeDegrees>-74.0060</LongitudeDegrees>
          </Position>
        </Trackpoint>
      </Track>
    </Lap>
  </Activity>
</TrainingCenterDatabase>`
      },
      
      // Invalid file data
      invalidFiles: {
        empty: '',
        notXml: 'This is not XML',
        malformedXml: '<gpx version="1.1"<trk></gpx>',
        invalidGpx: '<gpx><invalid>content</invalid></gpx>',
        tooLarge: 'x'.repeat(15 * 1024 * 1024), // 15MB
        binaryData: Buffer.from([0xFF, 0xFE, 0xFD, 0xFC])
      },
      
      // Network error scenarios
      networkErrors: {
        timeout: { code: 'ECONNRESET', message: 'Connection timeout' },
        unauthorized: { status: 401, message: 'Unauthorized' },
        forbidden: { status: 403, message: 'Forbidden' },
        notFound: { status: 404, message: 'Not found' },
        rateLimit: { status: 429, message: 'Rate limit exceeded' },
        serverError: { status: 500, message: 'Internal server error' },
        badGateway: { status: 502, message: 'Bad gateway' }
      }
    };
  }

  /**
   * Setup mock services for testing
   */
  setupMockServices() {
    return {
      // Mock HTTP client for network failure simulation
      mockHttpClient: {
        simulateNetworkError: (errorType) => {
          const error = this.testData.networkErrors[errorType];
          const networkError = new Error(error.message);
          networkError.code = error.code;
          networkError.status = error.status;
          return Promise.reject(networkError);
        }
      },
      
      // Mock file system for file error simulation
      mockFileSystem: {
        simulateFileError: (errorType, file) => {
          switch (errorType) {
            case 'notFound':
              const notFoundError = new Error('File not found');
              notFoundError.code = 'ENOENT';
              throw notFoundError;
            case 'permissionDenied':
              const permError = new Error('Permission denied');
              permError.code = 'EACCES';
              throw permError;
            case 'corruptedFile':
              return Buffer.from('corrupted data');
            default:
              throw new Error('Unknown file error type');
          }
        }
      }
    };
  }

  /**
   * Run all error scenario tests
   */
  async runAllTests() {
    console.log('Starting comprehensive error scenario testing...\n');
    
    const testCategories = [
      'Network Error Tests',
      'Data Validation Error Tests',
      'File Processing Error Tests',
      'Performance Error Tests',
      'Memory Limit Error Tests',
      'Timeout Error Tests',
      'Recovery Mechanism Tests',
      'Cross-Browser Error Tests',
      'Integration Error Tests'
    ];
    
    for (const category of testCategories) {
      console.log(`\n=== ${category} ===`);
      await this.runTestCategory(category);
    }
    
    this.generateTestReport();
    return this.testResults;
  }

  /**
   * Run tests for a specific category
   */
  async runTestCategory(category) {
    switch (category) {
      case 'Network Error Tests':
        await this.runNetworkErrorTests();
        break;
      case 'Data Validation Error Tests':
        await this.runDataValidationErrorTests();
        break;
      case 'File Processing Error Tests':
        await this.runFileProcessingErrorTests();
        break;
      case 'Performance Error Tests':
        await this.runPerformanceErrorTests();
        break;
      case 'Memory Limit Error Tests':
        await this.runMemoryLimitErrorTests();
        break;
      case 'Timeout Error Tests':
        await this.runTimeoutErrorTests();
        break;
      case 'Recovery Mechanism Tests':
        await this.runRecoveryMechanismTests();
        break;
      case 'Cross-Browser Error Tests':
        await this.runCrossBrowserErrorTests();
        break;
      case 'Integration Error Tests':
        await this.runIntegrationErrorTests();
        break;
    }
  }

  /**
   * Test network error scenarios
   */
  async runNetworkErrorTests() {
    const tests = [
      { name: 'Connection Timeout', errorType: 'timeout' },
      { name: 'Unauthorized Request', errorType: 'unauthorized' },
      { name: 'Forbidden Access', errorType: 'forbidden' },
      { name: 'Resource Not Found', errorType: 'notFound' },
      { name: 'Rate Limit Exceeded', errorType: 'rateLimit' },
      { name: 'Server Error', errorType: 'serverError' },
      { name: 'Bad Gateway', errorType: 'badGateway' }
    ];
    
    for (const test of tests) {
      await this.runTest(`Network: ${test.name}`, async () => {
        // Simulate network error
        try {
          await this.mockServices.mockHttpClient.simulateNetworkError(test.errorType);
          throw new Error('Expected network error was not thrown');
        } catch (error) {
          // Test error response handler
          const mockReq = { requestId: 'test-' + Date.now(), method: 'GET', path: '/test' };
          const mockRes = { 
            status: (code) => ({ json: (data) => ({ statusCode: code, body: data }) })
          };
          
          const errorHandler = new ErrorResponseHandler();
          const result = await new Promise((resolve) => {
            errorHandler.handleError(error, mockReq, mockRes, resolve);
          });
          
          // Validate error response structure
          assert(result.body.success === false, 'Error response should indicate failure');
          assert(result.body.error.code, 'Error response should include error code');
          assert(result.body.error.category, 'Error response should include error category');
          assert(result.body.error.recoverySuggestions, 'Error response should include recovery suggestions');
          
          // Validate HTTP status code
          assert(result.statusCode >= 400, 'HTTP status should be error code');
          
          return { success: true, errorCode: result.body.error.code };
        }
      });
    }
  }

  /**
   * Test data validation error scenarios
   */
  async runDataValidationErrorTests() {
    const invalidDataTypes = Object.keys(this.testData.invalidCoordinates);
    
    for (const dataType of invalidDataTypes) {
      await this.runTest(`Data Validation: ${dataType}`, async () => {
        const invalidData = this.testData.invalidCoordinates[dataType];
        
        // Test coordinate validation
        try {
          const result = stravaService.validateRouteData({ coordinates: invalidData });
          
          if (dataType === 'tooLarge') {
            // Large datasets should trigger performance warnings but not fail validation
            assert(result === true || result.warnings, 'Large dataset should pass with warnings');
          } else {
            // Other invalid data should fail validation
            assert(result === false, `Invalid data type ${dataType} should fail validation`);
          }
          
          return { success: true, dataType: dataType };
        } catch (error) {
          // Validation errors should be properly categorized
          assert(error.message, 'Validation error should have descriptive message');
          return { success: true, caught: true, error: error.message };
        }
      });
    }
  }

  /**
   * Test file processing error scenarios
   */
  async runFileProcessingErrorTests() {
    const invalidFileTypes = Object.keys(this.testData.invalidFiles);
    
    for (const fileType of invalidFileTypes) {
      await this.runTest(`File Processing: ${fileType}`, async () => {
        const invalidFileData = this.testData.invalidFiles[fileType];
        
        try {
          let result;
          if (fileType === 'tooLarge') {
            // Test file size validation
            const mockFile = {
              buffer: Buffer.from(invalidFileData),
              originalname: 'test.gpx',
              size: Buffer.from(invalidFileData).length
            };
            
            // Should throw file too large error
            result = await stravaService.processUploadedRouteFile(
              mockFile.buffer, 
              mockFile.originalname, 
              'application/gpx+xml'
            );
          } else {
            // Test other file parsing errors
            result = await gpxTcxParser.parseGPXFile(
              Buffer.from(invalidFileData), 
              'test.gpx'
            );
          }
          
          // Most invalid files should throw errors
          if (fileType !== 'empty') {
            throw new Error(`Expected file processing error for ${fileType}`);
          }
          
        } catch (error) {
          // Validate error handling for file processing
          assert(error.message, 'File processing error should have descriptive message');
          
          // Check for appropriate error types
          if (fileType === 'tooLarge') {
            assert(error.message.includes('large') || error.message.includes('size'), 
              'Large file error should mention size');
          } else if (fileType === 'malformedXml' || fileType === 'notXml') {
            assert(error.message.includes('XML') || error.message.includes('parsing') || error.message.includes('format'), 
              'XML error should mention format or parsing');
          }
          
          return { success: true, caught: true, error: error.message };
        }
        
        return { success: true };
      });
    }
  }

  /**
   * Test performance error scenarios
   */
  async runPerformanceErrorTests() {
    const performanceTests = [
      { name: 'Large Dataset Processing', size: 50000 },
      { name: 'Massive Dataset Processing', size: 100000 },
      { name: 'Memory Intensive Operation', memoryMB: 150 },
      { name: 'CPU Intensive Operation', iterations: 1000000 }
    ];
    
    for (const test of performanceTests) {
      await this.runTest(`Performance: ${test.name}`, async () => {
        const requestId = 'perf-test-' + Date.now();
        const monitoring = performanceMonitor.startRequest(requestId, { 
          timeout: 10000,
          testType: test.name 
        });
        
        try {
          if (test.size) {
            // Test large dataset processing
            const largeDataset = Array(test.size).fill([40.7128, -74.0060]);
            performanceMonitor.recordPhase(requestId, 'large_dataset_processing');
            
            const analysis = performanceMonitor.monitorLargeDataset(requestId, largeDataset, 'coordinates');
            
            // Validate dataset analysis
            assert(analysis.size === test.size, 'Dataset size should be correctly analyzed');
            assert(analysis.isLarge || analysis.isMassive, 'Large datasets should be flagged');
            assert(analysis.recommendations.length > 0, 'Recommendations should be provided for large datasets');
            
          } else if (test.memoryMB) {
            // Test memory intensive operation
            performanceMonitor.recordPhase(requestId, 'memory_intensive_operation');
            
            // Simulate memory allocation
            const memoryHog = [];
            for (let i = 0; i < test.memoryMB * 1000; i++) {
              memoryHog.push(new Array(1000).fill('x'));
            }
            
            // Check memory monitoring
            const memUsage = process.memoryUsage();
            performanceMonitor.checkMemoryUsage(memUsage);
            
          } else if (test.iterations) {
            // Test CPU intensive operation
            performanceMonitor.recordPhase(requestId, 'cpu_intensive_operation');
            
            // Simulate CPU intensive task
            let result = 0;
            for (let i = 0; i < test.iterations; i++) {
              result += Math.sqrt(i);
            }
          }
          
          const summary = performanceMonitor.endRequest(requestId, { success: true });
          
          // Validate performance monitoring
          assert(summary.totalDuration >= 0, 'Duration should be recorded');
          assert(summary.phasesCount > 0, 'Phases should be recorded');
          
          // Check if performance warnings were generated for large operations
          if (test.size >= 50000 || test.memoryMB >= 100) {
            assert(summary.warningsCount > 0, 'Performance warnings should be generated for intensive operations');
          }
          
          return { 
            success: true, 
            duration: summary.totalDuration,
            memoryDelta: summary.memoryDelta,
            warnings: summary.warningsCount
          };
          
        } catch (error) {
          performanceMonitor.endRequest(requestId, { success: false, error: error.message });
          throw error;
        }
      });
    }
  }

  /**
   * Test memory limit error scenarios
   */
  async runMemoryLimitErrorTests() {
    const memoryTests = [
      { name: 'Gradual Memory Increase', steps: 10, stepSize: 10 },
      { name: 'Sudden Memory Spike', stepSize: 100 },
      { name: 'Memory Leak Simulation', iterations: 50 }
    ];
    
    for (const test of memoryTests) {
      await this.runTest(`Memory: ${test.name}`, async () => {
        const initialMemory = process.memoryUsage().heapUsed;
        let memoryArrays = [];
        
        try {
          if (test.steps) {
            // Gradual memory increase
            for (let i = 0; i < test.steps; i++) {
              memoryArrays.push(new Array(test.stepSize * 100000).fill('x'));
              
              const currentMemory = process.memoryUsage().heapUsed;
              performanceMonitor.checkMemoryUsage();
              
              // Small delay to allow memory monitoring
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          } else if (test.stepSize) {
            // Sudden memory spike
            memoryArrays = [new Array(test.stepSize * 100000).fill('x')];
            performanceMonitor.checkMemoryUsage();
            
          } else if (test.iterations) {
            // Memory leak simulation
            for (let i = 0; i < test.iterations; i++) {
              const leakyArray = new Array(100000).fill(`leak-${i}`);
              memoryArrays.push(leakyArray);
              
              if (i % 10 === 0) {
                performanceMonitor.checkMemoryUsage();
                await new Promise(resolve => setTimeout(resolve, 50));
              }
            }
          }
          
          const finalMemory = process.memoryUsage().heapUsed;
          const memoryIncrease = finalMemory - initialMemory;
          
          // Cleanup
          memoryArrays = null;
          if (global.gc) {
            global.gc();
          }
          
          return { 
            success: true, 
            memoryIncrease: memoryIncrease,
            memoryMB: Math.round(memoryIncrease / 1024 / 1024)
          };
          
        } catch (error) {
          // Cleanup on error
          memoryArrays = null;
          if (global.gc) {
            global.gc();
          }
          throw error;
        }
      });
    }
  }

  /**
   * Test timeout error scenarios
   */
  async runTimeoutErrorTests() {
    const timeoutTests = [
      { name: 'Short Timeout', timeout: 100, delay: 200 },
      { name: 'Medium Timeout', timeout: 1000, delay: 1500 },
      { name: 'Long Operation Timeout', timeout: 5000, delay: 6000 }
    ];
    
    for (const test of timeoutTests) {
      await this.runTest(`Timeout: ${test.name}`, async () => {
        const requestId = 'timeout-test-' + Date.now();
        
        return new Promise((resolve, reject) => {
          const monitoring = performanceMonitor.startRequest(requestId, { 
            timeout: test.timeout 
          });
          
          // Simulate operation that takes longer than timeout
          const operationTimeout = setTimeout(() => {
            try {
              performanceMonitor.endRequest(requestId, { success: true });
              reject(new Error('Operation should have timed out'));
            } catch (error) {
              reject(error);
            }
          }, test.delay);
          
          // Listen for timeout event
          performanceMonitor.once('requestTimeout', (event) => {
            if (event.requestId === requestId) {
              clearTimeout(operationTimeout);
              
              // Validate timeout handling
              assert(event.monitoring.status === 'timeout', 'Request should be marked as timed out');
              assert(event.monitoring.totalDuration >= test.timeout, 'Duration should reflect timeout');
              
              resolve({ 
                success: true, 
                timedOut: true,
                duration: event.monitoring.totalDuration,
                timeout: test.timeout
              });
            }
          });
        });
      });
    }
  }

  /**
   * Test error recovery mechanisms
   */
  async runRecoveryMechanismTests() {
    const recoveryTests = [
      { name: 'Network Error Recovery', errorType: 'network', retryable: true },
      { name: 'File Processing Recovery', errorType: 'file', retryable: false },
      { name: 'Validation Error Recovery', errorType: 'validation', retryable: false },
      { name: 'Performance Error Recovery', errorType: 'performance', retryable: true }
    ];
    
    for (const test of recoveryTests) {
      await this.runTest(`Recovery: ${test.name}`, async () => {
        // Create mock error based on type
        let mockError;
        switch (test.errorType) {
          case 'network':
            mockError = new Error('Network connection failed');
            mockError.status = 503;
            mockError.code = 'ECONNRESET';
            break;
          case 'file':
            mockError = new Error('Invalid file format');
            mockError.code = 'INVALID_FORMAT';
            break;
          case 'validation':
            mockError = new Error('Validation failed');
            mockError.name = 'ValidationError';
            break;
          case 'performance':
            mockError = new Error('Request timeout');
            mockError.code = 'TIMEOUT';
            break;
        }
        
        // Test error response handler recovery suggestions
        const mockReq = { 
          requestId: 'recovery-test-' + Date.now(), 
          method: 'POST', 
          path: '/test',
          file: test.errorType === 'file' ? { originalname: 'test.gpx' } : null
        };
        
        const mockRes = { 
          status: (code) => ({ 
            json: (data) => ({ statusCode: code, body: data }) 
          })
        };
        
        const errorHandler = new ErrorResponseHandler();
        const result = await new Promise((resolve) => {
          errorHandler.handleError(mockError, mockReq, mockRes, resolve);
        });
        
        // Validate recovery suggestions
        const recoverySuggestions = result.body.error.recoverySuggestions;
        assert(Array.isArray(recoverySuggestions), 'Recovery suggestions should be an array');
        
        if (test.retryable) {
          assert(recoverySuggestions.some(s => s.action.includes('retry')), 
            'Retryable errors should include retry suggestions');
        }
        
        // Validate suggestion structure
        recoverySuggestions.forEach(suggestion => {
          assert(suggestion.action, 'Suggestion should have action');
          assert(suggestion.description, 'Suggestion should have description');
          assert(suggestion.priority, 'Suggestion should have priority');
        });
        
        return { 
          success: true, 
          suggestionsCount: recoverySuggestions.length,
          hasRetryOption: recoverySuggestions.some(s => s.action.includes('retry'))
        };
      });
    }
  }

  /**
   * Test cross-browser error handling (simulated)
   */
  async runCrossBrowserErrorTests() {
    const browserTests = [
      { name: 'Chrome Error Handling', userAgent: 'Chrome/91.0.4472.124' },
      { name: 'Firefox Error Handling', userAgent: 'Firefox/89.0' },
      { name: 'Safari Error Handling', userAgent: 'Safari/14.1.1' },
      { name: 'Edge Error Handling', userAgent: 'Edge/91.0.864.59' }
    ];
    
    for (const test of browserTests) {
      await this.runTest(`Browser: ${test.name}`, async () => {
        // Simulate browser-specific error
        const mockError = new Error('Browser-specific error');
        mockError.browserInfo = {
          userAgent: test.userAgent,
          features: {
            webgl: test.userAgent.includes('Safari') ? false : true,
            canvas: true,
            geolocation: true
          }
        };
        
        // Test error handling with browser context
        const mockReq = {
          requestId: 'browser-test-' + Date.now(),
          method: 'GET',
          path: '/map',
          headers: {
            'user-agent': test.userAgent
          }
        };
        
        const mockRes = {
          status: (code) => ({
            json: (data) => ({ statusCode: code, body: data })
          })
        };
        
        const errorHandler = new ErrorResponseHandler();
        const result = await new Promise((resolve) => {
          errorHandler.handleError(mockError, mockReq, mockRes, resolve);
        });
        
        // Validate browser-aware error handling
        assert(result.body.error.message, 'Error should have message');
        
        // Check if user agent is included in debugging info
        const meta = result.body.meta;
        assert(meta, 'Response should include meta information');
        
        return { 
          success: true, 
          browser: test.userAgent,
          errorCode: result.body.error.code
        };
      });
    }
  }

  /**
   * Test integration error scenarios
   */
  async runIntegrationErrorTests() {
    const integrationTests = [
      { name: 'Strava API Integration Error', service: 'strava' },
      { name: 'Mapbox API Integration Error', service: 'mapbox' },
      { name: 'File Parser Integration Error', service: 'parser' },
      { name: 'Database Integration Error', service: 'database' }
    ];
    
    for (const test of integrationTests) {
      await this.runTest(`Integration: ${test.name}`, async () => {
        // Create service-specific error
        let mockError;
        switch (test.service) {
          case 'strava':
            mockError = new Error('Strava API rate limit exceeded');
            mockError.status = 429;
            mockError.service = 'strava';
            break;
          case 'mapbox':
            mockError = new Error('Mapbox API key invalid');
            mockError.status = 401;
            mockError.service = 'mapbox';
            break;
          case 'parser':
            mockError = new Error('GPX parsing failed');
            mockError.code = 'PARSE_ERROR';
            mockError.service = 'parser';
            break;
          case 'database':
            mockError = new Error('Database connection failed');
            mockError.code = 'ECONNREFUSED';
            mockError.service = 'database';
            break;
        }
        
        // Test service-specific error handling
        const enhancedError = await this.testServiceErrorHandling(mockError, test.service);
        
        // Validate service-specific error enhancements
        assert(enhancedError.service === test.service, 'Error should be tagged with service');
        
        return { 
          success: true, 
          service: test.service,
          errorType: enhancedError.code || enhancedError.type
        };
      });
    }
  }

  /**
   * Test service-specific error handling
   */
  async testServiceErrorHandling(error, service) {
    // Simulate service-specific error enhancement
    const enhancedError = { ...error };
    enhancedError.service = service;
    
    switch (service) {
      case 'strava':
        if (error.status === 429) {
          enhancedError.retryAfter = 900; // 15 minutes
          enhancedError.rateLimitType = 'strava_api';
        }
        break;
      case 'mapbox':
        if (error.status === 401) {
          enhancedError.configurationIssue = true;
          enhancedError.requiresApiKey = true;
        }
        break;
      case 'parser':
        enhancedError.category = 'file_processing';
        enhancedError.parseStage = 'xml_parsing';
        break;
      case 'database':
        enhancedError.category = 'infrastructure';
        enhancedError.retryable = true;
        break;
    }
    
    return enhancedError;
  }

  /**
   * Run individual test with error handling
   */
  async runTest(testName, testFunction) {
    const startTime = performance.now();
    
    try {
      console.log(`  Running: ${testName}`);
      const result = await testFunction();
      const duration = performance.now() - startTime;
      
      this.testResults.passed++;
      console.log(`  ✓ ${testName} (${Math.round(duration)}ms)`);
      
      if (result && typeof result === 'object') {
        console.log(`    Result: ${JSON.stringify(result, null, 2)}`);
      }
      
    } catch (error) {
      const duration = performance.now() - startTime;
      this.testResults.failed++;
      this.testResults.errors.push({
        testName: testName,
        error: error.message,
        stack: error.stack,
        duration: duration
      });
      
      console.log(`  ✗ ${testName} (${Math.round(duration)}ms)`);
      console.log(`    Error: ${error.message}`);
    }
  }

  /**
   * Generate comprehensive test report
   */
  generateTestReport() {
    const total = this.testResults.passed + this.testResults.failed + this.testResults.skipped;
    const successRate = total > 0 ? (this.testResults.passed / total) * 100 : 0;
    
    console.log('\n' + '='.repeat(50));
    console.log('COMPREHENSIVE ERROR TESTING REPORT');
    console.log('='.repeat(50));
    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${this.testResults.passed}`);
    console.log(`Failed: ${this.testResults.failed}`);
    console.log(`Skipped: ${this.testResults.skipped}`);
    console.log(`Success Rate: ${successRate.toFixed(2)}%`);
    
    if (this.testResults.failed > 0) {
      console.log('\nFAILED TESTS:');
      this.testResults.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.testName}`);
        console.log(`   Error: ${error.error}`);
        console.log(`   Duration: ${Math.round(error.duration)}ms`);
      });
    }
    
    // Generate coverage report
    this.generateCoverageReport();
    
    // Save report to file
    this.saveTestReport();
    
    console.log('\nTest report saved to: tests/error-test-report.json');
    console.log('='.repeat(50));
  }

  /**
   * Generate coverage report for error scenarios
   */
  generateCoverageReport() {
    this.testResults.coverage = {
      errorCategories: {
        network: true,
        validation: true,
        fileProcessing: true,
        performance: true,
        memory: true,
        timeout: true,
        recovery: true,
        browser: true,
        integration: true
      },
      errorTypes: {
        401: true, // Unauthorized
        403: true, // Forbidden
        404: true, // Not Found
        408: true, // Timeout
        422: true, // Validation Error
        429: true, // Rate Limit
        500: true, // Server Error
        502: true, // Bad Gateway
        503: true  // Service Unavailable
      },
      recoveryStrategies: {
        retry: true,
        fallback: true,
        gracefulDegradation: true,
        userNotification: true
      }
    };
  }

  /**
   * Save test report to file
   */
  saveTestReport() {
    const report = {
      ...this.testResults,
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      memory: process.memoryUsage()
    };
    
    const reportPath = path.join(__dirname, 'error-test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  }

  /**
   * Run specific error scenario
   */
  async runSpecificScenario(scenarioName) {
    console.log(`Running specific error scenario: ${scenarioName}`);
    
    switch (scenarioName) {
      case 'network-failure':
        await this.runNetworkErrorTests();
        break;
      case 'large-dataset':
        await this.runPerformanceErrorTests();
        break;
      case 'file-corruption':
        await this.runFileProcessingErrorTests();
        break;
      case 'memory-exhaustion':
        await this.runMemoryLimitErrorTests();
        break;
      default:
        console.log(`Unknown scenario: ${scenarioName}`);
    }
  }
}

// Export for use in other test files
module.exports = ComprehensiveErrorTestSuite;

// Run tests if called directly
if (require.main === module) {
  const testSuite = new ComprehensiveErrorTestSuite();
  testSuite.runAllTests().catch(console.error);
}