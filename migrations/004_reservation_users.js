const { randomBytes, createHash } = require('node:crypto');
const bcrypt = require('bcryptjs');

exports.up = async knex => {
  await knex.schema.alterTable('reservations', table => {
    table.integer('user_id').references('id').inTable('users').onDelete('RESTRICT');
  });
  const owners = await knex('reservations').distinct('reserved_by');
  for (const { reserved_by: name } of owners) {
    // Stara nazwa nie potwierdza tożsamości. Nie przypisujemy historii do konta
    // założonego przez API; tworzymy osobne konto migracyjne bez znanego hasła.
    const email = `legacy-${createHash('sha256').update(name).digest('hex')}@example.invalid`;
    const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 12);
    const [user] = await knex('users').insert({ email, password_hash: passwordHash, role: 'USER' }).returning('id');
    await knex('reservations').where({ reserved_by: name }).update({ user_id: user.id });
  }
  await knex.schema.alterTable('reservations', table => {
    table.integer('user_id').notNullable().alter();
    table.index('user_id');
    table.dropColumn('reserved_by');
  });
};
exports.down = async knex => {
  await knex.schema.alterTable('reservations', table => table.text('reserved_by'));
  await knex.raw(`UPDATE reservations r SET reserved_by = u.email FROM users u WHERE r.user_id = u.id`);
  await knex.schema.alterTable('reservations', table => {
    table.text('reserved_by').notNullable().alter();
    table.dropColumn('user_id');
  });
};
