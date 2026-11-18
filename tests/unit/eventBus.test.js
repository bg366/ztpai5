const { createEventBus } = require('../../src/events/eventBus');
test.each(['sync', 'async'])('błąd listenera %s nie blokuje innych listenerów ani publish', async type => {
  const logger = { error: jest.fn() };
  const bus = createEventBus({ logger });
  const saved = jest.fn();
  bus.subscribe('reservation.created', type === 'sync'
    ? () => { throw new Error('audit unavailable'); }
    : async () => { throw new Error('audit unavailable'); });
  bus.subscribe('reservation.created', saved);
  expect(() => bus.publish('reservation.created', { reservationId: 1 })).not.toThrow();
  await bus.drain();
  expect(saved).toHaveBeenCalledTimes(1);
  expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('audit unavailable'));
});
