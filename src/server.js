const config = require('./config');
const knex = require('knex');
const { createApp } = require('./app');
const { createRoomsService } = require('./modules/rooms/rooms.service');
const { createReservationsService } = require('./modules/reservations/reservations.service');
const { createBuildingsService } = require('./modules/buildings/buildings.service');
const { createAuthService } = require('./modules/auth/auth.service');

// Wybór implementacji pozostaje w jednym miejscu.
function buildApplication({ db = knex(require('../knexfile')), logger = console, settings = config } = {}) {
  const memory = settings.REPOSITORY === 'memory';
  const state = {
    users: [], nextUserId: 1,
    buildings: [{ id: 1, name: 'Budynek A', address: 'Warszawska 24' }],
    rooms: [{ id: 1, buildingId: 1, name: '101', capacity: 30 }],
    reservations: [], nextBuildingId: 2, nextRoomId: 2, nextReservationId: 1,
  };
  const implementation = memory ? 'memory' : 'knex';
  const factory = database => ({
    usersRepository: require(`./modules/users/users.repository.${implementation}`).createUsersRepository(memory ? state : database),
    buildingsRepository: require(`./modules/buildings/buildings.repository.${implementation}`).createBuildingsRepository(memory ? state : database),
    roomsRepository: require(`./modules/rooms/rooms.repository.${implementation}`).createRoomsRepository(memory ? state : database),
    reservationsRepository: require(`./modules/reservations/reservations.repository.${implementation}`).createReservationsRepository(memory ? state : database),
  });
  const repositories = factory(db);
  let queue = Promise.resolve();
  const runInTransaction = memory ? callback => {
    const operation = queue.then(() => callback(repositories));
    queue = operation.catch(() => {});
    return operation;
  } : callback => db.transaction(trx => callback(factory(trx)));
  const authService = createAuthService({ ...repositories, jwtSecret: settings.JWT_SECRET, jwtExpiresIn: settings.JWT_EXPIRES_IN });
  return { db, app: createApp({ logger, authService, jwtSecret: settings.JWT_SECRET,
    buildingsService: createBuildingsService(repositories),
    roomsService: createRoomsService({ ...repositories, runInTransaction }),
    reservationsService: createReservationsService({ ...repositories, runInTransaction }),
  }) };
}
if (require.main === module) {
  const { app, db } = buildApplication();
  const server = app.listen(config.PORT, '127.0.0.1', () => {
    console.log(`Room Booking API: http://localhost:${config.PORT}/api/docs`);
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
    server.close(async () => { await db.destroy(); process.exit(0); });
  });
}
module.exports = { buildApplication };
