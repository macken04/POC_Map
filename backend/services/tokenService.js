/**
 * Token encryption service for secure OAuth token storage
 * Provides encryption/decryption for sensitive token data in sessions
 */

const crypto = require('crypto');

class TokenService {
  constructor() {
    this.algorithm = 'aes-256-cbc';
    this.keyLength = 32; // 256 bits
    this.ivLength = 16;  // 128 bits
    
    // Generate encryption key from environment
    this.encryptionKey = this.generateEncryptionKey();
  }

  /**
   * Generate a consistent encryption key based on environment
   * Uses session secret and environment to create deterministic key
   */
  generateEncryptionKey() {
    const sessionSecret = process.env.SESSION_SECRET;
    const environment = process.env.NODE_ENV || 'development';
    
    if (!sessionSecret) {
      throw new Error('SESSION_SECRET is required for token encryption');
    }

    // Create a deterministic key using PBKDF2
    return crypto.pbkdf2Sync(
      sessionSecret,
      `strava-tokens-${environment}`,
      100000, // iterations
      this.keyLength,
      'sha512'
    );
  }

  /**
   * Encrypt token data for secure storage
   * @param {Object} tokenData - Token data to encrypt
   * @returns {string} Encrypted token string
   */
  encryptTokens(tokenData) {
    if (!tokenData) {
      throw new Error('Token data is required for encryption');
    }

    try {
      // Convert token data to JSON string
      const plaintext = JSON.stringify(tokenData);
      
      // Generate random IV for this encryption
      const iv = crypto.randomBytes(this.ivLength);
      
      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
      
      // Encrypt the plaintext
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Combine IV + encrypted data
      const combined = iv.toString('hex') + ':' + encrypted;
      
      return Buffer.from(combined).toString('base64');
    } catch (error) {
      console.error('Token encryption failed:', error);
      throw new Error('Failed to encrypt token data');
    }
  }

  /**
   * Decrypt token data from storage
   * @param {string} encryptedData - Base64 encrypted token string
   * @returns {Object} Decrypted token data
   */
  decryptTokens(encryptedData) {
    if (!encryptedData) {
      throw new Error('Encrypted data is required for decryption');
    }

    try {
      // Parse the combined data
      const combined = Buffer.from(encryptedData, 'base64').toString();
      const [ivHex, encrypted] = combined.split(':');
      
      if (!ivHex || !encrypted) {
        throw new Error('Invalid encrypted data format');
      }
      
      const iv = Buffer.from(ivHex, 'hex');
      
      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
      
      // Decrypt the data
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      // Parse JSON and return
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Token decryption failed:', error);
      throw new Error('Failed to decrypt token data');
    }
  }

  /**
   * Validate token data structure
   * @param {Object} tokenData - Token data to validate
   * @returns {boolean} True if valid
   */
  validateTokenData(tokenData) {
    if (!tokenData || typeof tokenData !== 'object') {
      return false;
    }

    const requiredFields = ['accessToken', 'refreshToken', 'expiresAt'];
    return requiredFields.every(field => 
      tokenData.hasOwnProperty(field) && tokenData[field] !== null
    );
  }

  /**
   * Check if tokens are expired
   * @param {Object} tokenData - Token data to check
   * @returns {boolean} True if expired
   */
  isTokenExpired(tokenData) {
    if (!tokenData || !tokenData.expiresAt) {
      return true;
    }

    const now = Math.floor(Date.now() / 1000);
    return tokenData.expiresAt <= now;
  }

  /**
   * Sanitize token data for logging (removes sensitive info)
   * @param {Object} tokenData - Token data to sanitize
   * @returns {Object} Sanitized data
   */
  sanitizeTokenData(tokenData) {
    if (!tokenData) {
      return null;
    }

    return {
      hasAccessToken: !!tokenData.accessToken,
      hasRefreshToken: !!tokenData.refreshToken,
      expiresAt: tokenData.expiresAt,
      expired: this.isTokenExpired(tokenData),
      athlete: tokenData.athlete ? {
        id: tokenData.athlete.id,
        username: tokenData.athlete.username,
        firstname: tokenData.athlete.firstname,
        lastname: tokenData.athlete.lastname
      } : null
    };
  }

  /**
   * Generate a secure random token for additional security
   * @param {number} length - Length of token in bytes
   * @returns {string} Random hex token
   */
  generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Clear sensitive data from memory
   * @param {Object} tokenData - Token data to clear
   */
  clearTokenData(tokenData) {
    if (tokenData && typeof tokenData === 'object') {
      Object.keys(tokenData).forEach(key => {
        if (typeof tokenData[key] === 'string') {
          // Overwrite string data
          tokenData[key] = '';
        }
        delete tokenData[key];
      });
    }
  }
}

module.exports = new TokenService();