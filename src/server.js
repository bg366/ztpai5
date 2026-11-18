const config = require('./config');
const { buildApplication } = require('./bootstrap');
const { app, db, eventBus } = buildApplication();
const server = app.listen(config.PORT, '0.0.0.0', () => {
  console.log(`Room Booking API: http://localhost:${config.PORT}/api/docs/`);
});
let stopping = false;
function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    try {
      await eventBus.drain();
      await db.destroy();
      console.log('HTTP server closed, event listeners finished, database pool closed');
      process.exitCode = 0;
    } catch (error) {
      console.error(error);
      process.exitCode = 1;
    }
  });
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
