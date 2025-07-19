#!/usr/bin/env node

/**
 * Ngrok URL Capture Script
 * Automatically detects the current ngrok tunnel URL and updates environment variables
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Configuration
const NGROK_API_URL = 'http://localhost:4040/api/tunnels';
const ENV_FILE_PATH = path.join(__dirname, '..', '.env');
const MAX_RETRIES = 5;
const RETRY_DELAY = 2000; // 2 seconds

/**
 * Sleep utility function
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Capture the current ngrok URL from the ngrok API
 */
async function captureNgrokUrl() {
  let retries = 0;
  
  while (retries < MAX_RETRIES) {
    try {
      console.log(`Attempting to fetch ngrok tunnels (attempt ${retries + 1}/${MAX_RETRIES})...`);
      
      const response = await axios.get(NGROK_API_URL, {
        timeout: 5000
      });
      
      if (!response.data || !response.data.tunnels) {
        throw new Error('Invalid response from ngrok API');
      }
      
      const tunnels = response.data.tunnels;
      
      if (tunnels.length === 0) {
        throw new Error('No ngrok tunnels found');
      }
      
      // Find the HTTPS tunnel (preferred) or fallback to HTTP
      let tunnel = tunnels.find(t => t.proto === 'https' && t.config && t.config.addr);
      if (!tunnel) {
        tunnel = tunnels.find(t => t.proto === 'http' && t.config && t.config.addr);
      }
      
      if (!tunnel) {
        throw new Error('No suitable tunnel found');
      }
      
      const ngrokUrl = tunnel.public_url;
      console.log(`✅ Found ngrok tunnel: ${ngrokUrl}`);
      
      return ngrokUrl;
      
    } catch (error) {
      retries++;
      
      if (error.code === 'ECONNREFUSED') {
        console.log(`❌ Cannot connect to ngrok API (${error.message})`);
      } else {
        console.log(`❌ Error fetching ngrok URL: ${error.message}`);
      }
      
      if (retries < MAX_RETRIES) {
        console.log(`⏳ Retrying in ${RETRY_DELAY / 1000} seconds...`);
        await sleep(RETRY_DELAY);
      }
    }
  }
  
  throw new Error(`Failed to capture ngrok URL after ${MAX_RETRIES} attempts`);
}

/**
 * Update the .env file with the new ngrok URL
 */
async function updateEnvFile(ngrokUrl) {
  try {
    // Check if .env file exists
    if (!fs.existsSync(ENV_FILE_PATH)) {
      throw new Error(`.env file not found at ${ENV_FILE_PATH}`);
    }
    
    // Read and parse current .env file
    const envContent = fs.readFileSync(ENV_FILE_PATH, 'utf8');
    const envConfig = dotenv.parse(envContent);
    
    // Store previous URL for comparison
    const previousUrl = envConfig.NGROK_URL;
    
    // Update ngrok URL
    envConfig.NGROK_URL = ngrokUrl;
    
    // Also update Strava redirect URI to use the new ngrok URL
    envConfig.STRAVA_REDIRECT_URI = `${ngrokUrl}/auth/strava/callback`;
    
    // Update CORS allowed origins to include the new ngrok URL
    const allowedOrigins = envConfig.ALLOWED_ORIGINS?.split(',') || [];
    
    // Remove old ngrok URLs from allowed origins but preserve other URLs
    const filteredOrigins = allowedOrigins.filter(origin => 
      !origin.includes('ngrok.io') && !origin.includes('ngrok-free.app')
    );
    
    // Ensure Shopify store URL is always included
    const shopifyStoreUrl = 'https://print-my-ride-version-5.myshopify.com';
    if (!filteredOrigins.includes(shopifyStoreUrl)) {
      filteredOrigins.push(shopifyStoreUrl);
    }
    
    // Add the new ngrok URL
    filteredOrigins.push(ngrokUrl);
    envConfig.ALLOWED_ORIGINS = filteredOrigins.join(',');
    
    // Convert back to .env format
    const newEnvContent = Object.entries(envConfig)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    
    // Write updated .env file
    fs.writeFileSync(ENV_FILE_PATH, newEnvContent);
    
    // Log the changes
    if (previousUrl !== ngrokUrl) {
      console.log(`✅ Updated .env file:`);
      console.log(`   NGROK_URL: ${previousUrl || '(not set)'} → ${ngrokUrl}`);
      console.log(`   STRAVA_REDIRECT_URI: ${ngrokUrl}/auth/strava/callback`);
      console.log(`   ALLOWED_ORIGINS: Added ${ngrokUrl}`);
    } else {
      console.log(`ℹ️  ngrok URL unchanged: ${ngrokUrl}`);
    }
    
    return true;
    
  } catch (error) {
    console.error(`❌ Error updating .env file: ${error.message}`);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('🚀 Starting ngrok URL capture...');
    
    const ngrokUrl = await captureNgrokUrl();
    await updateEnvFile(ngrokUrl);
    
    console.log('✅ ngrok URL capture completed successfully!');
    console.log(`🌐 Current ngrok URL: ${ngrokUrl}`);
    
    // If running as a script (not required), provide usage info
    if (require.main === module) {
      console.log('\n📝 Next steps:');
      console.log('   1. Restart your server to pick up the new environment variables');
      console.log('   2. Update your Strava application settings with the new callback URL');
      console.log('   3. Test the authentication flow');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error(`💥 Failed to capture ngrok URL: ${error.message}`);
    console.error('🔧 Make sure ngrok is running and accessible at http://localhost:4040');
    process.exit(1);
  }
}

/**
 * Export functions for use as a module
 */
module.exports = {
  captureNgrokUrl,
  updateEnvFile,
  main
};

// Run main function if this script is executed directly
if (require.main === module) {
  main();
}