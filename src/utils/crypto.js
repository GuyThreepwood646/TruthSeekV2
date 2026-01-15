/**
 * TruthSeek Cryptography Utilities
 * Web Crypto API encryption for API key storage
 */

const ENCRYPTION_ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for GCM
const STORAGE_KEY_NAME = 'truthseek_encryption_key';

/**
 * Get or generate encryption key
 * @returns {Promise<CryptoKey>} Encryption key
 */
async function getOrGenerateKey() {
  try {
    // Try to retrieve existing key from storage
    const result = await chrome.storage.local.get([STORAGE_KEY_NAME]);
    
    if (result[STORAGE_KEY_NAME]) {
      // Import existing key
      const keyData = base64ToArrayBuffer(result[STORAGE_KEY_NAME]);
      return await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: ENCRYPTION_ALGORITHM, length: KEY_LENGTH },
        true,
        ['encrypt', 'decrypt']
      );
    }
    
    // Generate new key
    const key = await crypto.subtle.generateKey(
      { name: ENCRYPTION_ALGORITHM, length: KEY_LENGTH },
      true,
      ['encrypt', 'decrypt']
    );
    
    // Export and store key
    const exportedKey = await crypto.subtle.exportKey('raw', key);
    const keyBase64 = arrayBufferToBase64(exportedKey);
    await chrome.storage.local.set({ [STORAGE_KEY_NAME]: keyBase64 });
    
    console.log('Generated new encryption key');
    return key;
    
  } catch (error) {
    console.error('Error getting/generating encryption key:', error);
    throw new Error('Failed to initialize encryption key');
  }
}

/**
 * Encrypt plaintext string
 * @param {string} plaintext - Text to encrypt
 * @returns {Promise<string>} Base64-encoded encrypted data (IV + ciphertext)
 */
export async function encrypt(plaintext) {
  try {
    if (!plaintext || typeof plaintext !== 'string') {
      throw new Error('Plaintext must be a non-empty string');
    }
    
    // Get encryption key
    const key = await getOrGenerateKey();
    
    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    
    // Convert plaintext to ArrayBuffer
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    
    // Encrypt
    const ciphertext = await crypto.subtle.encrypt(
      { name: ENCRYPTION_ALGORITHM, iv },
      key,
      data
    );
    
    // Combine IV + ciphertext
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);
    
    // Return as base64
    return arrayBufferToBase64(combined.buffer);
    
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt encrypted string
 * @param {string} encryptedBase64 - Base64-encoded encrypted data (IV + ciphertext)
 * @returns {Promise<string>} Decrypted plaintext
 */
export async function decrypt(encryptedBase64) {
  try {
    if (!encryptedBase64 || typeof encryptedBase64 !== 'string') {
      throw new Error('Encrypted data must be a non-empty string');
    }
    
    // Get encryption key
    const key = await getOrGenerateKey();
    
    // Decode from base64
    const combined = base64ToArrayBuffer(encryptedBase64);
    
    // Extract IV and ciphertext
    const iv = combined.slice(0, IV_LENGTH);
    const ciphertext = combined.slice(IV_LENGTH);
    
    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: ENCRYPTION_ALGORITHM, iv },
      key,
      ciphertext
    );
    
    // Convert to string
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
    
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Securely delete encryption key (for testing/reset)
 * WARNING: This will make all encrypted data unrecoverable
 * @returns {Promise<void>}
 */
export async function deleteEncryptionKey() {
  try {
    await chrome.storage.local.remove([STORAGE_KEY_NAME]);
    console.log('Encryption key deleted');
  } catch (error) {
    console.error('Error deleting encryption key:', error);
    throw new Error('Failed to delete encryption key');
  }
}

/**
 * Convert ArrayBuffer to base64 string
 * @param {ArrayBuffer} buffer
 * @returns {string}
 */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert base64 string to ArrayBuffer
 * @param {string} base64
 * @returns {ArrayBuffer}
 */
function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

