const { EventEmitter } = require('node:events');

function createEventBus({ logger = console, now = () => new Date() } = {}) {
  const emitter = new EventEmitter();
  const pending = new Set();
  return {
    publish(name, payload) {
      emitter.emit(name, { name, payload, occurredAt: now().toISOString() });
    },
    subscribe(name, handler) {
      emitter.on(name, event => {
        const task = Promise.resolve().then(() => handler(event))
          .catch(error => logger.error(`[event:${name}] handler failed: ${error.message}`))
          .finally(() => pending.delete(task));
        pending.add(task);
      });
    },
    async drain() {
      while (pending.size) await Promise.all([...pending]);
    },
  };
}
const noopEventBus = { publish() {} };
module.exports = { createEventBus, noopEventBus };
