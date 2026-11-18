function registerListeners({ eventBus, auditRepository, usersRepository, logger = console }) {
  const save = event => auditRepository.create(event);
  eventBus.subscribe('reservation.created', save);
  eventBus.subscribe('reservation.cancelled', save);
  eventBus.subscribe('reservation.cancelled', async ({ payload }) => {
    if (payload.cancelledBy === payload.userId) return;
    const actor = await usersRepository.findById(payload.cancelledBy);
    if (actor?.role !== 'ADMIN') return;
    const owner = await usersRepository.findById(payload.userId);
    logger.log(`[notification] to: ${owner.email} reservation ${payload.reservationId} cancelled by ADMIN`);
  });
}
module.exports = { registerListeners };
