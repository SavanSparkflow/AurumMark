import CryptoJS from 'crypto-js';
import crypto from 'crypto';
import { ENV } from '../config/env.js';

const SECRET_KEY =
  ENV.PASSWORD_ENCRYPTION_KEY ||
  ENV.JWT_ACCESS_SECRET ||
  'aurummark_jewellery_super_secret_encryption_key_2026!';

/**
 * Returns a 32-byte key for legacy AES-256-CBC decryption fallback
 */
function getLegacyKey(): Buffer {
  return crypto.createHash('sha256').update(SECRET_KEY).digest();
}

/**
 * Decrypts legacy passwords formatted as "ivHex:dataHex"
 */
function decryptLegacyPassword(encryptedText: string): string {
  const parts = encryptedText.split(':');
  if (parts.length !== 2) return '';
  const [ivHex, dataHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', getLegacyKey(), iv);
  let decrypted = decipher.update(dataHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Encrypts a plain-text password using crypto-js (AES).
 * Produces standard OpenSSL-compatible Base64 string (starts with U2FsdGVkX1...).
 */
export function encryptPassword(plainText: string): string {
  if (!plainText) return '';
  return CryptoJS.AES.encrypt(plainText, SECRET_KEY).toString();
}

/**
 * Decrypts an encrypted password string back to the original plain-text using crypto-js.
 * Also supports legacy "iv:ciphertext" fallback for backward compatibility.
 */
export function decryptPassword(encryptedText: string): string {
  if (!encryptedText) return '';

  // 1. Attempt crypto-js AES decryption
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedText, SECRET_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (decrypted) {
      return decrypted;
    }
  } catch {
    // Proceed to legacy fallback
  }

  // 2. Fallback for legacy AES-256-CBC format (iv:ciphertext)
  try {
    return decryptLegacyPassword(encryptedText);
  } catch {
    return '';
  }
}

/**
 * Compares a plain-text candidate password with the stored encrypted password.
 * Returns true if matching, false otherwise.
 */
export function comparePassword(plainText: string, storedPasswordStr: string): boolean {
  if (!plainText || !storedPasswordStr) return false;
  try {
    const decrypted = decryptPassword(storedPasswordStr);
    return decrypted === plainText;
  } catch {
    return false;
  }
}

// =========================================================================
// Password Conversion Functions (Console.log માં Password જોવા માટે)
// =========================================================================

// 1. Hash / Encrypted Password માંથી Original Password console માં જોવા માટે
export const getOriginalPassword = (hashPassword: string): string => {
  const original = decryptPassword(hashPassword);
  console.log('========================================');
  console.log('Input Hash:    ', hashPassword);
  console.log('Original Pass: ', original || '(Unable to decrypt)');
  console.log('========================================');
  return original;
};

// 2. Original Password માંથી Hash / Encrypted Password console માં જોવા માટે
export const getHashPassword = (plainPassword: string): string => {
  const hash = encryptPassword(plainPassword);
  console.log('========================================');
  console.log('Original Pass: ', plainPassword);
  console.log('Generated Hash:', hash);
  console.log('========================================');
  return hash;
};

// Aliases
export const convertHashToOriginal = getOriginalPassword;
export const convertOriginalToHash = getHashPassword;
