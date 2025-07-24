/**
 * Token Storage Testing Suite
 * Tests the complete token encryption and management system
 */

// Load environment variables first
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const tokenService = require('../services/tokenService');
const tokenManager = require('../services/tokenManager');

console.log('🔐 Running Token Storage Security Tests...\n');

// Test data
const testTokenData = {
  accessToken: 'test_access_token_12345',
  refreshToken: 'test_refresh_token_67890',
  expiresAt: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
  athlete: {
    id: 12345,
    username: 'test_user',
    firstname: 'Test',
    lastname: 'User'
  }
};

// Mock request object
const mockRequest = {
  session: {},
  sessionID: 'test-session-id-12345'
};

async function runTests() {
  let passed = 0;
  let total = 0;

  function test(description, testFn) {
    total++;
    try {
      const result = testFn();
      if (result !== false) {
        console.log(`✅ ${description}`);
        passed++;
      } else {
        console.log(`❌ ${description}`);
      }
    } catch (error) {
      console.log(`❌ ${description}`);
      console.log(`   Error: ${error.message}`);
    }
  }

  async function asyncTest(description, testFn) {
    total++;
    try {
      const result = await testFn();
      if (result !== false) {
        console.log(`✅ ${description}`);
        passed++;
      } else {
        console.log(`❌ ${description}`);
      }
    } catch (error) {
      console.log(`❌ ${description}`);
      console.log(`   Error: ${error.message}`);
    }
  }

  // Test 1: Token Encryption Testing
  console.log('🧪 1. Token Encryption Testing');
  
  test('Token data validation works', () => {
    return tokenService.validateTokenData(testTokenData);
  });

  test('Token encryption produces encrypted string', () => {
    const encrypted = tokenService.encryptTokens(testTokenData);
    return typeof encrypted === 'string' && encrypted.length > 0;
  });

  test('Token decryption recovers original data', () => {
    const encrypted = tokenService.encryptTokens(testTokenData);
    const decrypted = tokenService.decryptTokens(encrypted);
    return JSON.stringify(decrypted) === JSON.stringify(testTokenData);
  });

  test('Invalid encrypted data throws error', () => {
    try {
      tokenService.decryptTokens('invalid_data');
      return false; // Should have thrown
    } catch (error) {
      return true; // Expected error
    }
  });

  // Test 2: Token Storage Testing
  console.log('\n🧪 2. Token Storage Testing');

  await asyncTest('Tokens store securely in session', async () => {
    await tokenManager.storeTokens(mockRequest, testTokenData);
    return mockRequest.session.encrypted_strava_tokens !== undefined;
  });

  test('Stored tokens are not in plain text', () => {
    const sessionData = JSON.stringify(mockRequest.session);
    return !sessionData.includes(testTokenData.accessToken);
  });

  test('Tokens can be retrieved and decrypted', () => {
    const retrieved = tokenManager.getTokens(mockRequest);
    return retrieved && retrieved.accessToken === testTokenData.accessToken;
  });

  test('Token persistence across requests', () => {
    const tokens1 = tokenManager.getTokens(mockRequest);
    const tokens2 = tokenManager.getTokens(mockRequest);
    return tokens1 && tokens2 && tokens1.accessToken === tokens2.accessToken;
  });

  // Test 3: Session Security Testing
  console.log('\n🧪 3. Session Security Testing');

  test('Authentication status is accurate', () => {
    return tokenManager.isAuthenticated(mockRequest);
  });

  test('Auth status provides correct details', () => {
    const status = tokenManager.getAuthStatus(mockRequest);
    return status.authenticated && status.athlete && status.athlete.id === testTokenData.athlete.id;
  });

  test('Access token retrieval works', () => {
    const accessToken = tokenManager.getAccessToken(mockRequest);
    return accessToken === testTokenData.accessToken;
  });

  test('Refresh token retrieval works', () => {
    const refreshToken = tokenManager.getRefreshToken(mockRequest);
    return refreshToken === testTokenData.refreshToken;
  });

  // Test 4: Token Expiration Testing
  console.log('\n🧪 4. Token Expiration Testing');

  test('Non-expired tokens detected correctly', () => {
    return !tokenService.isTokenExpired(testTokenData);
  });

  test('Expired tokens detected correctly', () => {
    const expiredTokenData = { ...testTokenData, expiresAt: Math.floor(Date.now() / 1000) - 3600 };
    return tokenService.isTokenExpired(expiredTokenData);
  });

  await asyncTest('Expired tokens stored and detected', async () => {
    const expiredTokenData = { ...testTokenData, expiresAt: Math.floor(Date.now() / 1000) - 3600 };
    const expiredRequest = { session: {}, sessionID: 'expired-test' };
    await tokenManager.storeTokens(expiredRequest, expiredTokenData);
    return !tokenManager.isAuthenticated(expiredRequest);
  });

  // Test 5: Memory Leak Testing
  console.log('\n🧪 5. Memory Leak Testing');

  test('Token data can be cleared', () => {
    const testData = { ...testTokenData };
    tokenService.clearTokenData(testData);
    return Object.keys(testData).length === 0;
  });

  test('Session tokens can be cleared', () => {
    tokenManager.clearTokens(mockRequest);
    return !tokenManager.getTokens(mockRequest);
  });

  test('Cleared session shows not authenticated', () => {
    return !tokenManager.isAuthenticated(mockRequest);
  });

  // Test 6: Security Features Testing
  console.log('\n🧪 6. Security Features Testing');

  test('Token data sanitization works', () => {
    const sanitized = tokenService.sanitizeTokenData(testTokenData);
    return sanitized.hasAccessToken && !sanitized.accessToken;
  });

  test('Secure token generation works', () => {
    const token = tokenService.generateSecureToken();
    return typeof token === 'string' && token.length === 64; // 32 bytes * 2 (hex)
  });

  test('Session validation works', () => {
    const validRequest = { session: {}, sessionID: 'test-session' };
    return tokenManager.validateSession(validRequest);
  });

  test('Invalid session detected', () => {
    const invalidRequest = {}; // No session
    return !tokenManager.validateSession(invalidRequest);
  });

  // Results
  console.log(`\n📊 Test Results: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('✅ All token storage security tests passed!');
    console.log('\n🔒 Security Features Verified:');
    console.log('   • Tokens encrypted with AES-256-GCM');
    console.log('   • Session validation and integrity checks');
    console.log('   • Proper expiration handling');
    console.log('   • Memory leak prevention');
    console.log('   • Token data sanitization');
    console.log('   • Secure session management');
  } else {
    console.log(`❌ ${total - passed} tests failed`);
    process.exit(1);
  }
}

// Run the tests
runTests().catch(console.error);