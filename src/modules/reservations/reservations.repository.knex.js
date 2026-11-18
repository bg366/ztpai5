const map = r => r && ({
  id: r.id, roomId: r.room_id, userId: r.user_id, user: { id: r.user_id, email: r.user_email }, participants: r.participants,
  startTime: r.start_time, endTime: r.end_time, status: r.status,
  cancelledAt: r.cancelled_at, createdAt: r.created_at,
  room: { id: r.room_id, name: r.room_name, building: { id: r.building_id, name: r.building_name } },
});
const columns = { roomId: 'room_id', userId: 'user_id', participants: 'participants',
  startTime: 'start_time', endTime: 'end_time', status: 'status', cancelledAt: 'cancelled_at', createdAt: 'created_at' };
const toRow = data => Object.fromEntries(Object.entries(columns).filter(([k]) => data[k] !== undefined).map(([k,v]) => [v,data[k]]));
const SORT = { startTime: 'r.start_time', createdAt: 'r.created_at', participants: 'r.participants' };
function createReservationsRepository(db) {
  const joined = () => db('reservations as r').join('rooms as s', 's.id', 'r.room_id')
    .join('buildings as b', 'b.id', 's.building_id').join('users as u', 'u.id', 'r.user_id');
  const select = q => q.select('r.*', 's.name as room_name', 's.building_id', 'b.name as building_name', 'u.email as user_email');
  function filtered(filters) {
    const q = joined();
    if (filters.userId !== undefined) q.where('r.user_id', filters.userId);
    if (filters.roomId !== undefined) q.where('r.room_id', filters.roomId);
    if (filters.buildingId !== undefined) q.where('s.building_id', filters.buildingId);
    if (filters.status) q.where('r.status', filters.status);
    if (filters.from) q.where('r.end_time', '>', filters.from);
    if (filters.to) q.where('r.start_time', '<', filters.to);
    return q;
  }
  return {
    async findAll(filters = {}) { return (await select(filtered(filters)).orderBy('r.id')).map(map); },
    async findPage({ page = 1, limit = 20, sort = 'startTime', ...filters } = {}) {
      const descending = sort.startsWith('-');
      const column = SORT[descending ? sort.slice(1) : sort];
      if (!column) throw new Error('Unsupported sort');
      const [{ total }] = await filtered(filters).count('r.id as total');
      const rows = await select(filtered(filters)).orderBy(column, descending ? 'desc' : 'asc')
        .orderBy('r.id', 'asc').limit(limit).offset((page - 1) * limit);
      return { data: rows.map(map), meta: { page, limit, total: Number(total), totalPages: Math.ceil(Number(total)/limit) } };
    },
    async findById(id) { return map(await select(joined()).where('r.id', id).first()); },
    async create(data) {
      const [r] = await db('reservations').insert(toRow(data)).returning('id');
      return this.findById(r.id);
    },
    async update(id, changes) {
      const rows = await db('reservations').where({ id }).update(toRow(changes)).returning('id');
      return rows.length ? this.findById(id) : null;
    },
  };
}
module.exports = { createReservationsRepository };
