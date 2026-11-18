const path = require('node:path');
const { z } = require('zod');
require('dotenv').config({ path: path.join(__dirname, '../../.env'), quiet: true });

const databaseUrl = z.url().refine(value => {
  try {
    const url = new URL(value);
    return ['postgres:', 'postgresql:'].includes(url.protocol) && url.hostname && url.pathname.length > 1;
  } catch { return false; }
}, 'Expected a PostgreSQL URL with host and database name');
const password = z.string().min(10).max(72)
  .refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Maximum 72 UTF-8 bytes');
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3004),
  DATABASE_URL: databaseUrl,
  TEST_DATABASE_URL: databaseUrl.optional(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must have at least 32 characters'),
  JWT_EXPIRES_IN: z.string().regex(/^[1-9]\d{0,5}[smhd]$/, 'Use a positive duration such as 15m or 10s').default('15m'),
  SEED_ADMIN_PASSWORD: password,
  SEED_USER_PASSWORD: password,
  REPOSITORY: z.enum(['knex', 'memory']).default('knex'),
});
const result = schema.safeParse(process.env);
if (!result.success) {
  console.error('Invalid environment configuration:');
  for (const issue of result.error.issues) console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  process.exit(1);
}
module.exports = Object.freeze(result.data);
