const { randomBytes } = require('node:crypto');
require('dotenv').config({ quiet: true });

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = randomBytes(48).toString('hex');
process.env.JWT_EXPIRES_IN = '15m';
process.env.SEED_ADMIN_PASSWORD = randomBytes(16).toString('hex');
process.env.SEED_USER_PASSWORD = randomBytes(16).toString('hex');

// Tylko integracja potrzebuje bazy. Unit testy nie importują konfiguracji Knex.
if (process.env.TEST_DATABASE_URL) {
  const testUrl = new URL(process.env.TEST_DATABASE_URL);
  const devUrl = process.env.DATABASE_URL && new URL(process.env.DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(testUrl.protocol) ||
      !decodeURIComponent(testUrl.pathname).endsWith('_test') ||
      (devUrl && decodeURIComponent(testUrl.pathname) === decodeURIComponent(devUrl.pathname))) {
    throw new Error('TEST_DATABASE_URL musi wskazywać osobną bazę z końcówką _test');
  }
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
