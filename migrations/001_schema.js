exports.up = async (knex) => {
  await knex.schema.createTable('buildings', t => {
    t.increments('id'); t.text('name').notNullable().unique();
    t.text('address').notNullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
  await knex.schema.createTable('rooms', t => {
    t.increments('id');
    t.integer('building_id').notNullable()
      .references('id').inTable('buildings').onDelete('RESTRICT');
    t.text('name').notNullable(); t.integer('capacity').notNullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.unique(['building_id', 'name']);
    t.check('capacity > 0', [], 'rooms_capacity_positive');
  });
  await knex.schema.createTable('reservations', t => {
    t.increments('id');
    t.integer('room_id').notNullable()
      .references('id').inTable('rooms').onDelete('RESTRICT');
    t.text('reserved_by').notNullable(); t.integer('participants').notNullable();
    t.timestamp('start_time', { useTz: true }).notNullable();
    t.timestamp('end_time', { useTz: true }).notNullable();
    t.text('status').notNullable();
    t.timestamp('cancelled_at', { useTz: true });
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.check('end_time > start_time', [], 'reservations_time_order');
    t.check("status IN ('CONFIRMED', 'CANCELLED')", [], 'reservations_status_allowed');
    t.check('participants > 0', [], 'reservations_participants_positive');
    t.index(['room_id', 'start_time', 'end_time'], 'reservations_overlap_idx');
  });
};
exports.down = async (knex) => {
  await knex.schema.dropTable('reservations');
  await knex.schema.dropTable('rooms');
  await knex.schema.dropTable('buildings');
};
