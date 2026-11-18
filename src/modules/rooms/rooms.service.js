const { NotFoundError, ConflictError } = require('../../errors/AppError');
function createRoomsService({ roomsRepository, buildingsRepository, reservationsRepository, runInTransaction }) {
  async function getById(id) {
    const room = await roomsRepository.findById(id);
    if (!room) throw new NotFoundError('ROOM_NOT_FOUND', `Room ${id} not found`);
    return room;
  }
  async function checkBuilding(id) {
    if (!await buildingsRepository.findById(id)) throw new NotFoundError('BUILDING_NOT_FOUND', `Building ${id} not found`);
  }
  return {
    getById,
    list: () => roomsRepository.findAll(),
    async create(input) { await checkBuilding(input.buildingId); return roomsRepository.create(input); },
    async update(id, input) {
      if (runInTransaction) return runInTransaction(async repositories => {
        await repositories.roomsRepository.lockById(id);
        return createRoomsService(repositories).update(id, input);
      });
      await getById(id);
      if (input.buildingId !== undefined) await checkBuilding(input.buildingId);
      if (input.capacity !== undefined) {
        const active = await reservationsRepository.findAll({ roomId: id, status: 'CONFIRMED', from: new Date().toISOString() });
        if (active.some(reservation => reservation.participants > input.capacity)) {
          throw new ConflictError('ROOM_CAPACITY_EXCEEDED', 'Existing reservations exceed the new capacity');
        }
      }
      return roomsRepository.update(id, input);
    },
    async remove(id) { await getById(id); await roomsRepository.remove(id); },
  };
}
module.exports = { createRoomsService };
