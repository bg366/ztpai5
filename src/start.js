const { spawn } = require('node:child_process');

// Node pozostaje PID 1 również podczas migracji, więc odbiera SIGTERM od Dockera.
console.log('Running database migrations');
const migration = spawn(process.execPath, [require.resolve('knex/bin/cli.js'), 'migrate:latest'], {
  stdio: 'inherit',
});
let stopping = false;
function stop(signal) {
  stopping = true;
  console.log(`${signal} received during migrations`);
  migration.kill(signal);
}
const onTerm = () => stop('SIGTERM');
const onInt = () => stop('SIGINT');
process.on('SIGTERM', onTerm);
process.on('SIGINT', onInt);
migration.on('error', error => {
  console.error(error.message);
  process.exitCode = 1;
});
migration.on('close', code => {
  process.off('SIGTERM', onTerm);
  process.off('SIGINT', onInt);
  if (stopping) return;
  if (code !== 0) { process.exitCode = 1; return; }
  require('./server');
});
