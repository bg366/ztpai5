const map = row => row && ({ id: row.id, name: row.name, address: row.address,
  ...(row.rooms_count !== undefined ? { roomsCount: Number(row.rooms_count) } : {}) });
function createBuildingsRepository(db) {
  return {
    async findAll() {
      const rows = await db('buildings as b').leftJoin('rooms as r', 'r.building_id', 'b.id')
        .select('b.id', 'b.name', 'b.address').count('r.id as rooms_count').groupBy('b.id').orderBy('b.id');
      return rows.map(map);
    },
    async findById(id) { return map(await db('buildings').where({ id }).first()); },
    async create(data) { return map((await db('buildings').insert(data).returning('*'))[0]); },
    async update(id, data) { return map((await db('buildings').where({ id }).update(data).returning('*'))[0]); },
    async remove(id) { return db('buildings').where({ id }).delete(); },
  };
}
module.exports = { createBuildingsRepository };
