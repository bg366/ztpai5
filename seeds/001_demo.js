const bcrypt = require('bcryptjs');
const config = require('../src/config');
exports.seed = async knex => {
  if (!config.SEED_ADMIN_PASSWORD || !config.SEED_USER_PASSWORD) {
    throw new Error('Ustaw SEED_ADMIN_PASSWORD i SEED_USER_PASSWORD');
  }
  // Seed można ponowić: nie usuwa rezerwacji ani audit logu.
  await knex('users').insert([
    { email: 'admin@example.com', role: 'ADMIN', password_hash: await bcrypt.hash(config.SEED_ADMIN_PASSWORD, 12) },
    { email: 'jan@example.com', role: 'USER', password_hash: await bcrypt.hash(config.SEED_USER_PASSWORD, 12) },
  ]).onConflict('email').ignore();
  await knex('buildings').insert({ name: 'Budynek A', address: 'Warszawska 24, Kraków' }).onConflict('name').ignore();
  const building = await knex('buildings').where({ name: 'Budynek A' }).first();
  await knex('rooms').insert({ building_id: building.id, name: '101', capacity: 30 })
    .onConflict(['building_id', 'name']).ignore();
};
