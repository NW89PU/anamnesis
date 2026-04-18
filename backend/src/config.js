require('dotenv').config();
const path = require('path');

module.exports = {
  DATABASE_URL: process.env.DATABASE_URL || null,
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || '',
  UPLOAD_DIR: process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads'),
  PORT: parseInt(process.env.PORT, 10) || 3000,
  API_TOKEN: process.env.API_TOKEN || '',
  ADMIN_TOKEN: process.env.ADMIN_TOKEN || '',
  APP_PIN: process.env.APP_PIN || '',
  SESSION_SECRET: process.env.SESSION_SECRET || 'anamnesis-default-dev-secret-change-me',
  SESSION_MAX_AGE_DAYS: parseInt(process.env.SESSION_MAX_AGE_DAYS, 10) || 30,
  CORS_ORIGINS: process.env.CORS_ORIGINS || '*',
  BACKUP_ENABLED: process.env.BACKUP_ENABLED === 'true',
  BACKUP_INTERVAL_HOURS: parseInt(process.env.BACKUP_INTERVAL_HOURS, 10) || 6,
  BACKUP_KEEP_COUNT: parseInt(process.env.BACKUP_KEEP_COUNT, 10) || 14,
  // Ключ шифрования для offsite бэкапов в Telegram.
  // Хранить ОТДЕЛЬНО (в password manager), не путать с ADMIN_TOKEN.
  BACKUP_ENCRYPTION_KEY: process.env.BACKUP_ENCRYPTION_KEY || '',
  NODE_ENV: process.env.NODE_ENV || 'production',
};
