const { z } = require('zod');
const email = z.email().max(254).toLowerCase();
const registerBody = z.strictObject({
  email,
  password: z.string().min(10).max(72).refine(
    value => Buffer.byteLength(value, 'utf8') <= 72, 'Maximum 72 UTF-8 bytes (bcrypt limit)',
  ),
});
const loginBody = z.strictObject({ email, password: z.string().min(1).max(1024) });
module.exports = { registerBody, loginBody };
