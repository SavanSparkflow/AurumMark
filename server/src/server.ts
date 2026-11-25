import { createApp } from './app.js';
import { connectDB } from './config/db.js';
import { ENV } from './config/env.js';
import { ExportService } from './services/exportService.js';
import { StorageService } from './services/storage.js';
import { encryptPassword, decryptPassword } from './utils/passwordCrypto.js';

// =========================================================================
// Password Conversion Functions (Console.log માં Password જોવા માટે)
// =========================================================================

// 1. Hash / Encrypted Password માંથી Original Password console માં જોવા માટે
export const getOriginalPassword = (hashPassword: string) => {
  const original = decryptPassword(hashPassword);
  console.log('========================================');
  console.log('Input Hash:    ', hashPassword);
  console.log('Original Pass: ', original || '(Unable to decrypt)');
  console.log('========================================');
  return original;
};

// 2. Original Password માંથી Hash / Encrypted Password console માં જોવા માટે
export const getHashPassword = (plainPassword: string) => {
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

// 👉 તમારે જ્યારે પણ password ચેક કરવો હોય ત્યારે uncomment કરીને save કરી શકો છો:
// getOriginalPassword('U2FsdGVkX19rqx+/py9xH4ShWhv+WI4KRmzEmes28nE=');
// getHashPassword('peri1024');

async function bootstrap() {
  await connectDB();

  const app = createApp();

  // Run initial cleanup of expired exports and schedule periodic cleanup
  ExportService.cleanupExpiredExports().catch(() => {});
  setInterval(() => {
    ExportService.cleanupExpiredExports().catch(() => {});
  }, 60 * 60 * 1000); // Hourly cleanup

  // Background Cloudinary sync for dual storage of existing local assets
  StorageService.syncLocalAssetsToCloudinary().catch((err) => {
    console.warn('Initial Cloudinary sync note:', err?.message);
  });

  const server = app.listen(ENV.PORT, () => {
    console.log(`====================================================`);
    console.log(`✨ Jewellery Watermark API running on port ${ENV.PORT}`);
    console.log(`🌐 Base URL: http://localhost:${ENV.PORT}/api/v1`);
    console.log(`🔒 Strictly 3 Roles: Company | Designer | Viewer`);
    console.log(`====================================================`);
  });

  const shutdown = async () => {
    console.log('\nGracefully shutting down...');
    server.close(() => {
      console.log('HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch((err) => {
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
