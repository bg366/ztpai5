const { NotFoundError } = require('../../errors/AppError');
function createBuildingsService({ buildingsRepository, roomsRepository }) {
  async function getById(id) {
    const building = await buildingsRepository.findById(id);
    if (!building) throw new NotFoundError('BUILDING_NOT_FOUND', `Building ${id} not found`);
    return building;
  }
  return {
    list: () => buildingsRepository.findAll(), getById,
    create: input => buildingsRepository.create(input),
    async update(id, input) { await getById(id); return buildingsRepository.update(id, input); },
    async remove(id) { await getById(id); await buildingsRepository.remove(id); },
    async rooms(id) { await getById(id); return roomsRepository.findAll({ buildingId: id }); },
  };
}
module.exports = { createBuildingsService };
