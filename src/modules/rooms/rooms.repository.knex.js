const map = r => r && ({ id: r.id, name: r.name, capacity: r.capacity,
  buildingId: r.building_id, building: { id: r.building_id, name: r.building_name } });
function createRoomsRepository(db) {
  const query = () => db('rooms as r').join('buildings as b', 'b.id', 'r.building_id')
    .select('r.*', 'b.name as building_name');
  return {
    async findAll({ buildingId } = {}) {
      const q = query(); if (buildingId !== undefined) q.where('r.building_id', buildingId);
      return (await q.orderBy('r.id')).map(map);
    },
    async findById(id) { return map(await query().where('r.id', id).first()); },
    async lockById(id) { await db('rooms').where({ id }).forUpdate().first(); },
    async create(data) {
      const [r] = await db('rooms').insert({ building_id: data.buildingId, name: data.name, capacity: data.capacity }).returning('*');
      return this.findById(r.id);
    },
    async update(id, data) {
      const columns = { buildingId: 'building_id', name: 'name', capacity: 'capacity' };
      const row = Object.fromEntries(Object.entries(data).map(([key, value]) => [columns[key], value]));
      await db('rooms').where({ id }).update(row);
      return this.findById(id);
    },
    async remove(id) { return db('rooms').where({ id }).delete(); },
  };
}
module.exports = { createRoomsRepository };
