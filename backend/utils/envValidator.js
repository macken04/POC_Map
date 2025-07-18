/**
 * Environment variable validation utility
 */

/**
 * Validation rules for environment variables
 */
const validationRules = {
  required: [
    'NODE_ENV',
    'PORT',
    'SESSION_SECRET'
  ],
  
  // Variables that should be present in production
  production: [
    'STRAVA_CLIENT_ID',
    'STRAVA_CLIENT_SECRET', 
    'MAPBOX_ACCESS_TOKEN',
    'SHOPIFY_API_KEY',
    'SHOPIFY_SECRET_KEY'
  ],
  
  // URL validation
  urls: [
    'STRAVA_REDIRECT_URI',
    'SHOPIFY_STORE_URL',
    'NGROK_URL'
  ],
  
  // Numeric validation
  numeric: [
    'PORT',
    'SESSION_MAX_AGE',
    'MAX_FILE_SIZE',
    'CLEANUP_INTERVAL',
    'MAP_EXPORT_TIMEOUT',
    'MAP_QUALITY'
  ],
  
  // Minimum string lengths
  minLength: {
    'SESSION_SECRET': 32
  },
  
  // Allowed values
  allowedValues: {
    'NODE_ENV': ['development', 'production', 'test'],
    'MAP_FORMAT': ['png', 'jpg', 'jpeg', 'webp'],
    'LOG_LEVEL': ['error', 'warn', 'info', 'debug'],
    'PUPPETEER_HEADLESS': ['true', 'false']
  }
};

/**
 * Validate environment variables
 * @param {string} environment - The environment to validate for
 * @returns {Object} - Validation result with success flag and errors
 */
function validateEnvironment(environment = process.env.NODE_ENV) {
  const errors = [];
  const warnings = [];
  
  // Check required variables
  validationRules.required.forEach(varName => {
    if (!process.env[varName]) {
      errors.push(`Missing required environment variable: ${varName}`);
    }
  });
  
  // Check production-specific variables
  if (environment === 'production') {
    validationRules.production.forEach(varName => {
      if (!process.env[varName]) {
        errors.push(`Missing required production environment variable: ${varName}`);
      }
    });
  }
  
  // Validate URLs
  validationRules.urls.forEach(varName => {
    const value = process.env[varName];
    if (value && !isValidUrl(value)) {
      errors.push(`Invalid URL format for ${varName}: ${value}`);
    }
  });
  
  // Validate numeric values
  validationRules.numeric.forEach(varName => {
    const value = process.env[varName];
    if (value && !isValidNumber(value)) {
      errors.push(`Invalid numeric value for ${varName}: ${value}`);
    }
  });
  
  // Validate minimum string lengths
  Object.entries(validationRules.minLength).forEach(([varName, minLength]) => {
    const value = process.env[varName];
    if (value && value.length < minLength) {
      errors.push(`${varName} must be at least ${minLength} characters long`);
    }
  });
  
  // Validate allowed values
  Object.entries(validationRules.allowedValues).forEach(([varName, allowedValues]) => {
    const value = process.env[varName];
    if (value && !allowedValues.includes(value)) {
      errors.push(`Invalid value for ${varName}: ${value}. Allowed values: ${allowedValues.join(', ')}`);
    }
  });
  
  // Security warnings
  if (process.env.SESSION_SECRET === 'your-secret-key' || 
      process.env.SESSION_SECRET === 'test_session_secret_for_development_only_minimum_64_characters_long_12345') {
    warnings.push('Using default SESSION_SECRET is not secure for production');
  }
  
  if (environment === 'production' && process.env.DEBUG === '*') {
    warnings.push('DEBUG=* should not be used in production');
  }
  
  return {
    success: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Check if a string is a valid URL
 * @param {string} url - The URL to validate
 * @returns {boolean} - True if valid URL
 */
function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Check if a string is a valid number
 * @param {string} value - The value to validate
 * @returns {boolean} - True if valid number
 */
function isValidNumber(value) {
  const num = parseInt(value, 10);
  return !isNaN(num) && num >= 0;
}

/**
 * Print validation results to console
 * @param {Object} validation - Validation result
 */
function printValidationResults(validation) {
  if (validation.success) {
    console.log('✅ Environment validation passed');
  } else {
    console.log('❌ Environment validation failed:');
    validation.errors.forEach(error => {
      console.log(`  - ${error}`);
    });
  }
  
  if (validation.warnings.length > 0) {
    console.log('⚠️  Environment warnings:');
    validation.warnings.forEach(warning => {
      console.log(`  - ${warning}`);
    });
  }
}

/**
 * Validate environment and throw error if validation fails
 * @param {string} environment - The environment to validate for
 */
function validateAndThrow(environment) {
  const validation = validateEnvironment(environment);
  
  if (!validation.success) {
    const errorMessage = `Environment validation failed:\n${validation.errors.join('\n')}`;
    throw new Error(errorMessage);
  }
  
  // Print warnings
  if (validation.warnings.length > 0) {
    printValidationResults(validation);
  }
  
  return validation;
}

module.exports = {
  validateEnvironment,
  validateAndThrow,
  printValidationResults,
  validationRules
};