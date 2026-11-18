const path = require('node:path');
const config = require('./src/config');
module.exports = {
  client: 'pg', connection: config.DATABASE_URL,
  pool: { min: 0, max: 12 },
  migrations: { directory: path.join(__dirname, 'migrations') },
  seeds: { directory: path.join(__dirname, 'seeds') },
};
