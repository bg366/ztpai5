exports.up = knex => knex.schema.createTable('audit_log', table => {
  table.increments('id').primary();
  table.string('event_type', 100).notNullable();
  table.jsonb('payload').notNullable();
  table.timestamp('created_at', { useTz: true }).notNullable();
  table.index(['event_type', 'created_at']);
});
exports.down = knex => knex.schema.dropTable('audit_log');
