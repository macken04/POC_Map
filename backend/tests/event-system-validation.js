/**
 * Event System Validation and Performance Test Runner
 * Comprehensive validation of the Mapbox Event System implementation
 * 
 * Run with: node event-system-validation.js
 */

const fs = require('fs').promises;
const path = require('path');
const { performance } = require('perf_hooks');

class EventSystemValidator {
  constructor() {
    this.validationResults = {
      codeQuality: {},
      functionality: {},
      performance: {},
      security: {},
      compliance: {},
      recommendations: []
    };

    this.sourceFiles = [
      {
        name: 'Event System Core',
        path: path.join(__dirname, '..', '..', 'shopify-theme', 'dawn', 'assets', 'mapbox-event-system.js'),
        type: 'frontend'
      },
      {
        name: 'Map Integration',
        path: path.join(__dirname, '..', '..', 'shopify-theme', 'dawn', 'assets', 'mapbox-integration.js'),
        type: 'frontend'
      },
      {
        name: 'Backend Event Service',
        path: path.join(__dirname, '..', 'services', 'mapEventService.js'),
        type: 'backend'
      }
    ];
  }

  /**
   * Run comprehensive validation
   */
  async runValidation() {
    console.log('🔍 Starting Event System Validation...\n');

    try {
      // Validate source files exist
      await this.validateSourceFiles();
      
      // Code quality analysis
      await this.analyzeCodeQuality();
      
      // Functionality validation
      await this.validateFunctionality();
      
      // Performance analysis
      await this.analyzePerformance();
      
      // Security review
      await this.reviewSecurity();
      
      // Standards compliance
      await this.checkCompliance();
      
      // Generate final report
      await this.generateValidationReport();

    } catch (error) {
      console.error('❌ Validation failed:', error.message);
    }
  }

  /**
   * Validate all source files exist
   */
  async validateSourceFiles() {
    console.log('📁 Validating source files...');
    
    for (const file of this.sourceFiles) {
      try {
        const stats = await fs.stat(file.path);
        console.log(`  ✅ ${file.name} (${(stats.size / 1024).toFixed(1)}KB)`);
      } catch (error) {
        console.log(`  ❌ ${file.name} - File not found`);
        throw new Error(`Missing source file: ${file.path}`);
      }
    }
    
    console.log();
  }

  /**
   * Analyze code quality
   */
  async analyzeCodeQuality() {
    console.log('🔎 Analyzing code quality...');
    
    const codeQuality = {
      totalLines: 0,
      commentLines: 0,
      functionCount: 0,
      classCount: 0,
      complexityScore: 0,
      maintainabilityIndex: 0
    };

    for (const file of this.sourceFiles) {
      const content = await fs.readFile(file.path, 'utf8');
      const analysis = await this.analyzeFileQuality(content, file.name);
      
      codeQuality.totalLines += analysis.lines;
      codeQuality.commentLines += analysis.comments;
      codeQuality.functionCount += analysis.functions;
      codeQuality.classCount += analysis.classes;
      codeQuality.complexityScore += analysis.complexity;
      
      console.log(`  ${file.name}:`);
      console.log(`    Lines: ${analysis.lines}`);
      console.log(`    Functions: ${analysis.functions}`);
      console.log(`    Classes: ${analysis.classes}`);
      console.log(`    Comments: ${analysis.comments}`);
      console.log(`    Complexity: ${analysis.complexity}`);
    }

    codeQuality.maintainabilityIndex = this.calculateMaintainabilityIndex(codeQuality);
    
    console.log(`\n  📊 Overall Quality Metrics:`);
    console.log(`    Total Lines: ${codeQuality.totalLines}`);
    console.log(`    Comment Ratio: ${((codeQuality.commentLines / codeQuality.totalLines) * 100).toFixed(1)}%`);
    console.log(`    Functions: ${codeQuality.functionCount}`);
    console.log(`    Classes: ${codeQuality.classCount}`);
    console.log(`    Maintainability: ${codeQuality.maintainabilityIndex.toFixed(1)}/100`);

    this.validationResults.codeQuality = codeQuality;
    console.log();
  }

  /**
   * Analyze individual file quality
   */
  async analyzeFileQuality(content, fileName) {
    const lines = content.split('\n');
    const analysis = {
      lines: lines.length,
      comments: 0,
      functions: 0,
      classes: 0,
      complexity: 0
    };

    lines.forEach(line => {
      const trimmed = line.trim();
      
      // Count comments
      if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
        analysis.comments++;
      }
      
      // Count functions
      if (trimmed.includes('function ') || trimmed.match(/\w+\s*\([^)]*\)\s*{/) || trimmed.match(/\w+:\s*function/)) {
        analysis.functions++;
      }
      
      // Count classes
      if (trimmed.startsWith('class ')) {
        analysis.classes++;
      }
      
      // Basic complexity score (control structures)
      if (trimmed.includes('if ') || trimmed.includes('else') || trimmed.includes('for ') || 
          trimmed.includes('while ') || trimmed.includes('switch ') || trimmed.includes('catch ')) {
        analysis.complexity++;
      }
    });

    return analysis;
  }

  /**
   * Calculate maintainability index
   */
  calculateMaintainabilityIndex(metrics) {
    // Simplified maintainability index calculation
    const commentRatio = (metrics.commentLines / metrics.totalLines) * 100;
    const avgLinesPerFunction = metrics.functionCount > 0 ? metrics.totalLines / metrics.functionCount : 0;
    const complexityRatio = (metrics.complexityScore / metrics.totalLines) * 100;
    
    let score = 100;
    
    // Deduct points for low comment ratio
    if (commentRatio < 10) score -= 20;
    else if (commentRatio < 20) score -= 10;
    
    // Deduct points for large functions
    if (avgLinesPerFunction > 50) score -= 15;
    else if (avgLinesPerFunction > 30) score -= 10;
    
    // Deduct points for high complexity
    if (complexityRatio > 20) score -= 25;
    else if (complexityRatio > 10) score -= 15;
    
    return Math.max(0, score);
  }

  /**
   * Validate functionality requirements
   */
  async validateFunctionality() {
    console.log('⚙️ Validating functionality requirements...');
    
    const requirements = [
      {
        name: 'Event System Class',
        check: this.checkEventSystemClass.bind(this),
        weight: 20
      },
      {
        name: 'Map Integration',
        check: this.checkMapIntegration.bind(this),
        weight: 20
      },
      {
        name: 'Event Types Coverage',
        check: this.checkEventTypes.bind(this),
        weight: 15
      },
      {
        name: 'Performance Optimization',
        check: this.checkPerformanceOptimizations.bind(this),
        weight: 15
      },
      {
        name: 'Error Handling',
        check: this.checkErrorHandling.bind(this),
        weight: 10
      },
      {
        name: 'Memory Management',
        check: this.checkMemoryManagement.bind(this),
        weight: 10
      },
      {
        name: 'Public API',
        check: this.checkPublicAPI.bind(this),
        weight: 10
      }
    ];

    let totalScore = 0;
    let maxScore = 0;
    
    for (const requirement of requirements) {
      const score = await requirement.check();
      const weightedScore = (score / 100) * requirement.weight;
      totalScore += weightedScore;
      maxScore += requirement.weight;
      
      const status = score >= 80 ? '✅' : score >= 60 ? '⚠️' : '❌';
      console.log(`  ${status} ${requirement.name}: ${score}% (${weightedScore.toFixed(1)}/${requirement.weight})`);
    }

    const overallScore = (totalScore / maxScore) * 100;
    console.log(`\n  📊 Overall Functionality Score: ${overallScore.toFixed(1)}%`);
    
    this.validationResults.functionality = {
      overallScore,
      requirements: requirements.map((req, index) => ({
        name: req.name,
        score: totalScore, // This would need individual scores stored
        weight: req.weight
      }))
    };
    
    console.log();
  }

  /**
   * Check event system class implementation
   */
  async checkEventSystemClass() {
    const eventSystemFile = this.sourceFiles.find(f => f.name === 'Event System Core');
    const content = await fs.readFile(eventSystemFile.path, 'utf8');
    
    const checks = [
      content.includes('class MapboxEventSystem'),
      content.includes('constructor('),
      content.includes('init()'),
      content.includes('on('),
      content.includes('off('),
      content.includes('emit('),
      content.includes('cleanup('),
      content.includes('throttle') || content.includes('debounce'),
      content.includes('gesture'),
      content.includes('performance')
    ];

    return (checks.filter(Boolean).length / checks.length) * 100;
  }

  /**
   * Check map integration implementation
   */
  async checkMapIntegration() {
    const integrationFile = this.sourceFiles.find(f => f.name === 'Map Integration');
    const content = await fs.readFile(integrationFile.path, 'utf8');
    
    const checks = [
      content.includes('eventSystem'),
      content.includes('initializeEventSystem'),
      content.includes('setupDefaultEventHandlers'),
      content.includes('handleRouteClick'),
      content.includes('handleFeatureHover'),
      content.includes('responsive'),
      content.includes('cleanup'),
      content.includes('emit('),
      content.includes('on(')
    ];

    return (checks.filter(Boolean).length / checks.length) * 100;
  }

  /**
   * Check event types coverage
   */
  async checkEventTypes() {
    const eventSystemFile = this.sourceFiles.find(f => f.name === 'Event System Core');
    const content = await fs.readFile(eventSystemFile.path, 'utf8');
    
    const requiredEventTypes = [
      'click', 'hover', 'touch', 'gesture', 'pinch', 'rotate',
      'map-load', 'map-move', 'map-zoom', 'error', 'export'
    ];

    const foundEvents = requiredEventTypes.filter(eventType => 
      content.includes(eventType) || content.includes(eventType.replace('-', '_'))
    );

    return (foundEvents.length / requiredEventTypes.length) * 100;
  }

  /**
   * Check performance optimizations
   */
  async checkPerformanceOptimizations() {
    const eventSystemFile = this.sourceFiles.find(f => f.name === 'Event System Core');
    const content = await fs.readFile(eventSystemFile.path, 'utf8');
    
    const checks = [
      content.includes('throttle'),
      content.includes('debounce'),
      content.includes('performance.now'),
      content.includes('requestAnimationFrame') || content.includes('setTimeout'),
      content.includes('eventBuffer') || content.includes('buffer'),
      content.includes('cleanup'),
      content.includes('removeEventListener'),
      content.includes('passive')
    ];

    return (checks.filter(Boolean).length / checks.length) * 100;
  }

  /**
   * Check error handling implementation
   */
  async checkErrorHandling() {
    const files = [
      this.sourceFiles.find(f => f.name === 'Event System Core'),
      this.sourceFiles.find(f => f.name === 'Map Integration')
    ];
    
    let totalChecks = 0;
    let passedChecks = 0;
    
    for (const file of files) {
      const content = await fs.readFile(file.path, 'utf8');
      
      const checks = [
        content.includes('try {') && content.includes('catch'),
        content.includes('error'),
        content.includes('console.error'),
        content.includes('throw new Error') || content.includes('throw error'),
        content.includes('system-error') || content.includes('handleSystemError')
      ];
      
      totalChecks += checks.length;
      passedChecks += checks.filter(Boolean).length;
    }

    return (passedChecks / totalChecks) * 100;
  }

  /**
   * Check memory management
   */
  async checkMemoryManagement() {
    const eventSystemFile = this.sourceFiles.find(f => f.name === 'Event System Core');
    const content = await fs.readFile(eventSystemFile.path, 'utf8');
    
    const checks = [
      content.includes('cleanup'),
      content.includes('removeEventListener'),
      content.includes('clear()') || content.includes('delete '),
      content.includes('null') || content.includes('undefined'),
      content.includes('beforeunload'),
      content.includes('disconnect()') || content.includes('observer')
    ];

    return (checks.filter(Boolean).length / checks.length) * 100;
  }

  /**
   * Check public API implementation
   */
  async checkPublicAPI() {
    const files = this.sourceFiles.filter(f => f.type === 'frontend');
    let totalChecks = 0;
    let passedChecks = 0;
    
    for (const file of files) {
      const content = await fs.readFile(file.path, 'utf8');
      
      const checks = [
        content.includes('on('),
        content.includes('off('),
        content.includes('emit('),
        content.includes('getStatus'),
        content.includes('getDebugInfo') || content.includes('getEventHistory'),
        content.includes('module.exports') || content.includes('window.')
      ];
      
      totalChecks += checks.length;
      passedChecks += checks.filter(Boolean).length;
    }

    return (passedChecks / totalChecks) * 100;
  }

  /**
   * Analyze performance characteristics
   */
  async analyzePerformance() {
    console.log('🚀 Analyzing performance characteristics...');
    
    const performanceAnalysis = {
      codeSize: 0,
      estimatedMemoryUsage: 0,
      complexityRating: 'Low',
      optimizations: []
    };

    // Calculate total code size
    for (const file of this.sourceFiles) {
      const stats = await fs.stat(file.path);
      performanceAnalysis.codeSize += stats.size;
    }

    // Estimate memory usage based on code patterns
    const eventSystemFile = this.sourceFiles.find(f => f.name === 'Event System Core');
    const content = await fs.readFile(eventSystemFile.path, 'utf8');
    
    // Look for memory-intensive patterns
    const eventListenerCount = (content.match(/addEventListener/g) || []).length;
    const mapObjectCount = (content.match(/new Map\(\)/g) || []).length;
    const arrayCount = (content.match(/\[\]/g) || []).length;
    
    performanceAnalysis.estimatedMemoryUsage = (eventListenerCount * 1) + (mapObjectCount * 5) + (arrayCount * 2);
    
    // Check for optimizations
    if (content.includes('throttle')) performanceAnalysis.optimizations.push('Event throttling');
    if (content.includes('debounce')) performanceAnalysis.optimizations.push('Event debouncing');
    if (content.includes('passive')) performanceAnalysis.optimizations.push('Passive event listeners');
    if (content.includes('requestAnimationFrame')) performanceAnalysis.optimizations.push('RAF optimization');
    if (content.includes('WeakMap') || content.includes('WeakSet')) performanceAnalysis.optimizations.push('Weak references');

    // Determine complexity rating
    const totalLines = this.validationResults.codeQuality.totalLines;
    if (totalLines > 2000) performanceAnalysis.complexityRating = 'High';
    else if (totalLines > 1000) performanceAnalysis.complexityRating = 'Medium';
    else performanceAnalysis.complexityRating = 'Low';

    console.log(`  Code Size: ${(performanceAnalysis.codeSize / 1024).toFixed(1)}KB`);
    console.log(`  Estimated Memory: ${performanceAnalysis.estimatedMemoryUsage}KB`);
    console.log(`  Complexity: ${performanceAnalysis.complexityRating}`);
    console.log(`  Optimizations: ${performanceAnalysis.optimizations.join(', ') || 'None detected'}`);

    this.validationResults.performance = performanceAnalysis;
    console.log();
  }

  /**
   * Review security aspects
   */
  async reviewSecurity() {
    console.log('🔒 Reviewing security aspects...');
    
    const securityChecks = {
      inputValidation: false,
      xssProtection: false,
      memoryLeakPrevention: false,
      errorInfoLeakage: false,
      eventValidation: false
    };

    for (const file of this.sourceFiles) {
      const content = await fs.readFile(file.path, 'utf8');
      
      // Check for input validation
      if (content.includes('validate') || content.includes('sanitize') || content.includes('typeof')) {
        securityChecks.inputValidation = true;
      }
      
      // Check for XSS protection
      if (content.includes('innerHTML') && content.includes('textContent')) {
        securityChecks.xssProtection = true;
      }
      
      // Check for memory leak prevention
      if (content.includes('cleanup') || content.includes('removeEventListener')) {
        securityChecks.memoryLeakPrevention = true;
      }
      
      // Check for error information leakage
      if (content.includes('console.error') && !content.includes('sensitive')) {
        securityChecks.errorInfoLeakage = true;
      }
      
      // Check for event validation
      if (content.includes('eventType') && content.includes('callback')) {
        securityChecks.eventValidation = true;
      }
    }

    const securityScore = (Object.values(securityChecks).filter(Boolean).length / Object.keys(securityChecks).length) * 100;
    
    console.log(`  Input Validation: ${securityChecks.inputValidation ? '✅' : '❌'}`);
    console.log(`  XSS Protection: ${securityChecks.xssProtection ? '✅' : '❌'}`);
    console.log(`  Memory Leak Prevention: ${securityChecks.memoryLeakPrevention ? '✅' : '❌'}`);
    console.log(`  Error Info Leakage: ${securityChecks.errorInfoLeakage ? '✅' : '⚠️'}`);
    console.log(`  Event Validation: ${securityChecks.eventValidation ? '✅' : '❌'}`);
    console.log(`\n  📊 Security Score: ${securityScore.toFixed(1)}%`);

    this.validationResults.security = { checks: securityChecks, score: securityScore };
    console.log();
  }

  /**
   * Check standards compliance
   */
  async checkCompliance() {
    console.log('📋 Checking standards compliance...');
    
    const complianceChecks = {
      browserCompatibility: false,
      accessibilitySupport: false,
      performanceStandards: false,
      codingStandards: false,
      documentationStandards: false
    };

    for (const file of this.sourceFiles) {
      const content = await fs.readFile(file.path, 'utf8');
      
      // Browser compatibility
      if (content.includes('addEventListener') && !content.includes('attachEvent')) {
        complianceChecks.browserCompatibility = true;
      }
      
      // Accessibility support
      if (content.includes('aria-') || content.includes('tabindex') || content.includes('keyboard')) {
        complianceChecks.accessibilitySupport = true;
      }
      
      // Performance standards
      if (content.includes('throttle') || content.includes('debounce') || content.includes('passive')) {
        complianceChecks.performanceStandards = true;
      }
      
      // Coding standards
      if (content.includes('/**') && content.includes('const ') && content.includes('let ')) {
        complianceChecks.codingStandards = true;
      }
      
      // Documentation standards
      const commentRatio = (content.match(/\/\*\*/g) || []).length / (content.split('\n').length) * 100;
      if (commentRatio > 5) {
        complianceChecks.documentationStandards = true;
      }
    }

    const complianceScore = (Object.values(complianceChecks).filter(Boolean).length / Object.keys(complianceChecks).length) * 100;
    
    console.log(`  Browser Compatibility: ${complianceChecks.browserCompatibility ? '✅' : '❌'}`);
    console.log(`  Accessibility Support: ${complianceChecks.accessibilitySupport ? '✅' : '❌'}`);
    console.log(`  Performance Standards: ${complianceChecks.performanceStandards ? '✅' : '❌'}`);
    console.log(`  Coding Standards: ${complianceChecks.codingStandards ? '✅' : '❌'}`);
    console.log(`  Documentation Standards: ${complianceChecks.documentationStandards ? '✅' : '❌'}`);
    console.log(`\n  📊 Compliance Score: ${complianceScore.toFixed(1)}%`);

    this.validationResults.compliance = { checks: complianceChecks, score: complianceScore };
    console.log();
  }

  /**
   * Generate final validation report
   */
  async generateValidationReport() {
    console.log('📊 Generating validation report...\n');

    // Calculate overall score
    const scores = [
      this.validationResults.functionality?.overallScore || 0,
      this.validationResults.security?.score || 0,
      this.validationResults.compliance?.score || 0,
      this.validationResults.codeQuality?.maintainabilityIndex || 0
    ];
    
    const overallScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    // Generate recommendations
    this.generateRecommendations(overallScore);

    // Print final summary
    console.log('='.repeat(60));
    console.log('EVENT SYSTEM VALIDATION REPORT');
    console.log('='.repeat(60));
    console.log(`Overall Score: ${overallScore.toFixed(1)}/100`);
    console.log(`Code Quality: ${this.validationResults.codeQuality.maintainabilityIndex.toFixed(1)}/100`);
    console.log(`Functionality: ${(this.validationResults.functionality?.overallScore || 0).toFixed(1)}/100`);
    console.log(`Security: ${(this.validationResults.security?.score || 0).toFixed(1)}/100`);
    console.log(`Compliance: ${(this.validationResults.compliance?.score || 0).toFixed(1)}/100`);
    console.log('='.repeat(60));

    console.log('\n💡 KEY RECOMMENDATIONS:');
    this.validationResults.recommendations.slice(0, 5).forEach((rec, index) => {
      console.log(`${index + 1}. ${rec}`);
    });

    // Save report
    const reportPath = path.join(__dirname, `event-system-validation-report-${Date.now()}.json`);
    const reportData = {
      ...this.validationResults,
      overallScore,
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };
    
    await fs.writeFile(reportPath, JSON.stringify(reportData, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  }

  /**
   * Generate recommendations based on validation results
   */
  generateRecommendations(overallScore) {
    const recommendations = [];

    // Score-based recommendations
    if (overallScore < 70) {
      recommendations.push('Critical: Address major issues before production deployment');
    } else if (overallScore < 85) {
      recommendations.push('Important: Several improvements needed for optimal performance');
    }

    // Code quality recommendations
    const codeQuality = this.validationResults.codeQuality;
    if (codeQuality.maintainabilityIndex < 70) {
      recommendations.push('Improve code maintainability by reducing complexity and adding documentation');
    }

    const commentRatio = (codeQuality.commentLines / codeQuality.totalLines) * 100;
    if (commentRatio < 15) {
      recommendations.push('Increase code documentation with more comprehensive comments');
    }

    // Security recommendations
    const security = this.validationResults.security;
    if (security && security.score < 80) {
      recommendations.push('Strengthen security measures, particularly input validation and XSS protection');
    }

    // Performance recommendations
    const performance = this.validationResults.performance;
    if (performance && performance.codeSize > 100000) { // 100KB
      recommendations.push('Consider code splitting or optimization to reduce bundle size');
    }

    if (performance && performance.optimizations.length < 3) {
      recommendations.push('Implement additional performance optimizations (throttling, debouncing, caching)');
    }

    // Compliance recommendations
    const compliance = this.validationResults.compliance;
    if (compliance && compliance.score < 80) {
      recommendations.push('Improve standards compliance, particularly accessibility and browser compatibility');
    }

    // Default recommendations if everything looks good
    if (recommendations.length === 0) {
      recommendations.push('System validation passed - consider adding more comprehensive test coverage');
      recommendations.push('Monitor performance metrics in production environment');
      recommendations.push('Set up automated testing pipeline for continuous validation');
    }

    this.validationResults.recommendations = recommendations;
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new EventSystemValidator();
  validator.runValidation().catch(console.error);
}

module.exports = EventSystemValidator;