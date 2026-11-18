const bcrypt = require('bcryptjs');
const config = require('../src/config');
exports.seed = async knex => {
  if (config.NODE_ENV === 'production') throw new Error('Demo seed is disabled in production');
  const adminHash = await bcrypt.hash(config.SEED_ADMIN_PASSWORD, 12);
  const userHash = await bcrypt.hash(config.SEED_USER_PASSWORD, 12);
  await knex.transaction(async trx => {
    await trx.raw('TRUNCATE reservations, rooms, buildings, users RESTART IDENTITY');
    await trx('users').insert([
      { email: 'admin@example.com', password_hash: adminHash, role: 'ADMIN' },
      { email: 'jan@example.com', password_hash: userHash, role: 'USER' },
      { email: 'anna@example.com', password_hash: await bcrypt.hash(config.SEED_USER_PASSWORD, 12), role: 'USER' },
    ]);
    await trx('buildings').insert([
      { name: 'Budynek A', created_at: '2019-12-01T10:00:00Z', address: 'ul. Warszawska 24, Kraków' },
      { name: 'Budynek B', created_at: '2019-12-01T10:00:00Z', address: 'al. Jana Pawła II 37, Kraków' },
    ]);
    await trx('rooms').insert([
      { created_at: '2019-12-01T10:00:00Z', building_id: 1, name: '101', capacity: 30 },
      { created_at: '2019-12-01T10:00:00Z', building_id: 1, name: '102', capacity: 20 },
      { created_at: '2019-12-01T10:00:00Z', building_id: 1, name: '103', capacity: 50 },
      { created_at: '2019-12-01T10:00:00Z', building_id: 2, name: '101', capacity: 10 },
      { created_at: '2019-12-01T10:00:00Z', building_id: 2, name: '201', capacity: 40 },
    ]);
    await trx('reservations').insert(Array.from({ length: 5 }, (_, i) => ({
      room_id: i + 1, user_id: i % 2 === 0 ? 2 : 3, participants: 5 + i,
      start_time: i === 0 ? '2020-01-01T10:00:00Z' : `2099-11-10T${9+i}:00:00Z`,
      end_time: i === 0 ? '2020-01-01T12:00:00Z' : `2099-11-10T${10+i}:00:00Z`,
      status: i === 4 ? 'CANCELLED' : 'CONFIRMED',
      cancelled_at: i === 4 ? '2026-10-01T10:00:00Z' : null,
      created_at: '2019-12-01T10:00:00Z',
    })));
  });
};
