/**
 * Environment configuration test script
 * Run this to validate environment configuration setup
 */

const path = require('path');
const fs = require('fs');

// Test environment variables loading
function testEnvLoading() {
  console.log('🧪 Testing environment variable loading...');
  
  // Test that .env file exists in project root
  const envPath = path.join(__dirname, '..', '..', '.env');
  if (!fs.existsSync(envPath)) {
    console.log('❌ .env file not found');
    return false;
  }
  
  // Load environment variables
  require('dotenv').config({ path: envPath });
  
  console.log('✅ Environment variables loaded');
  console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`   PORT: ${process.env.PORT}`);
  console.log(`   SESSION_SECRET: ${process.env.SESSION_SECRET ? '[HIDDEN]' : 'NOT SET'}`);
  
  return true;
}

// Test configuration loading
function testConfigLoading() {
  console.log('🧪 Testing configuration loading...');
  
  try {
    const config = require('../config');
    const appConfig = config.getConfig();
    
    console.log('✅ Configuration loaded successfully');
    console.log('   Environment:', appConfig.env);
    console.log('   Port:', appConfig.port);
    console.log('   Session secure:', appConfig.session.secure);
    console.log('   CORS origins:', appConfig.cors.allowedOrigins);
    console.log('   Storage directory:', appConfig.storage.generatedMapsDir);
    
    return true;
  } catch (error) {
    console.log('❌ Configuration loading failed:', error.message);
    return false;
  }
}

// Test environment switching
function testEnvironmentSwitching() {
  console.log('🧪 Testing environment switching...');
  
  const originalEnv = process.env.NODE_ENV;
  
  try {
    // Test development environment
    process.env.NODE_ENV = 'development';
    const config = require('../config');
    let appConfig = config.getConfig();
    
    console.log('✅ Development environment configuration loaded');
    console.log('   Puppeteer headless:', appConfig.puppeteer.headless);
    console.log('   Map quality:', appConfig.mapExport.quality);
    
    // Test production environment
    process.env.NODE_ENV = 'production';
    delete require.cache[require.resolve('../config')];
    delete require.cache[require.resolve('../config/index.js')];
    
    const configProd = require('../config');
    appConfig = configProd.getConfig();
    
    console.log('✅ Production environment configuration loaded');
    console.log('   Session secure:', appConfig.session.secure);
    console.log('   Puppeteer args:', appConfig.puppeteer.args);
    
    return true;
  } catch (error) {
    console.log('❌ Environment switching failed:', error.message);
    return false;
  } finally {
    // Restore original environment
    process.env.NODE_ENV = originalEnv;
  }
}

// Test environment validation
function testEnvironmentValidation() {
  console.log('🧪 Testing environment validation...');
  
  try {
    const { validateEnvironment } = require('../utils/envValidator');
    
    // Test current environment
    const validation = validateEnvironment();
    
    if (validation.success) {
      console.log('✅ Environment validation passed');
    } else {
      console.log('❌ Environment validation failed:');
      validation.errors.forEach(error => {
        console.log(`   - ${error}`);
      });
    }
    
    if (validation.warnings.length > 0) {
      console.log('⚠️  Environment warnings:');
      validation.warnings.forEach(warning => {
        console.log(`   - ${warning}`);
      });
    }
    
    return validation.success;
  } catch (error) {
    console.log('❌ Environment validation test failed:', error.message);
    return false;
  }
}

// Test server startup
function testServerStartup() {
  console.log('🧪 Testing server startup...');
  
  try {
    // Test configuration loading for server
    const config = require('../config');
    const appConfig = config.getConfig();
    
    // Test that required server configuration is present
    if (!appConfig.port || !appConfig.env) {
      console.log('❌ Missing required server configuration');
      return false;
    }
    
    console.log('✅ Server configuration loaded successfully');
    console.log('   Port:', appConfig.port);
    console.log('   Environment:', appConfig.env);
    
    return true;
  } catch (error) {
    console.log('❌ Server startup test failed:', error.message);
    return false;
  }
}

// Test secret management
function testSecretManagement() {
  console.log('🧪 Testing secret management...');
  
  try {
    const config = require('../config');
    const appConfig = config.getConfig();
    const sanitizedConfig = config.getSanitizedConfig();
    
    // Test that sensitive values are not exposed in sanitized config
    const sanitizedConfigString = JSON.stringify(sanitizedConfig);
    
    if (sanitizedConfigString.includes(process.env.SESSION_SECRET)) {
      console.log('❌ Session secret is exposed in sanitized configuration');
      return false;
    }
    
    if (sanitizedConfigString.includes(process.env.STRAVA_CLIENT_SECRET)) {
      console.log('❌ Strava client secret is exposed in sanitized configuration');
      return false;
    }
    
    // Test that raw config does contain secrets (as expected)
    if (!appConfig.session.secret || !appConfig.strava.clientSecret) {
      console.log('❌ Raw configuration is missing required secrets');
      return false;
    }
    
    console.log('✅ Secrets are properly protected in sanitized config');
    console.log('✅ Raw configuration contains required secrets');
    return true;
  } catch (error) {
    console.log('❌ Secret management test failed:', error.message);
    return false;
  }
}

// Run all tests
function runAllTests() {
  console.log('🚀 Running environment configuration tests...\n');
  
  const tests = [
    testEnvLoading,
    testConfigLoading,
    testEnvironmentSwitching,
    testEnvironmentValidation,
    testServerStartup,
    testSecretManagement
  ];
  
  const results = tests.map(test => {
    try {
      const result = test();
      console.log('');
      return result;
    } catch (error) {
      console.log(`❌ Test failed with error: ${error.message}\n`);
      return false;
    }
  });
  
  const passed = results.filter(result => result === true).length;
  const total = results.length;
  
  console.log(`📊 Test Results: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('✅ All environment configuration tests passed!');
  } else {
    console.log('❌ Some tests failed. Please check the configuration.');
  }
  
  return passed === total;
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests();
}

module.exports = {
  testEnvLoading,
  testConfigLoading,
  testEnvironmentSwitching,
  testEnvironmentValidation,
  testServerStartup,
  testSecretManagement,
  runAllTests
};