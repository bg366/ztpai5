function createAuditRepository(db) {
  return {
    async create(event) {
      await db('audit_log').insert({ event_type: event.name, payload: event.payload, created_at: event.occurredAt });
    },
    async findPage({ page = 1, limit = 20, eventType } = {}) {
      const query = () => {
        const q = db('audit_log');
        return eventType ? q.where('event_type', eventType) : q;
      };
      const [{ total }] = await query().count('* as total');
      const rows = await query().orderBy('created_at', 'desc').orderBy('id', 'desc')
        .limit(limit).offset((page - 1) * limit);
      return {
        data: rows.map(row => ({ id: row.id, eventType: row.event_type, payload: row.payload, createdAt: row.created_at })),
        meta: { page, limit, total: Number(total), totalPages: Math.ceil(Number(total) / limit) },
      };
    },
  };
}
module.exports = { createAuditRepository };
