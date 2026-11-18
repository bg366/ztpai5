const config = require('./config');
const { createEventBus } = require('./events/eventBus');
const { registerListeners } = require('./events/listeners');
const { createAuditRepository } = require('./modules/audit/audit.repository');
const knex = require('knex');
const { createApp } = require('./app');
const { createRoomsService } = require('./modules/rooms/rooms.service');
const { createReservationsService } = require('./modules/reservations/reservations.service');
const { createBuildingsService } = require('./modules/buildings/buildings.service');
const { createAuthService } = require('./modules/auth/auth.service');

// Wybór implementacji pozostaje w jednym miejscu.
function buildApplication({ db = knex(require('../knexfile')), logger = console, settings = config, now = () => new Date() } = {}) {
  const factory = database => ({
    usersRepository: require('./modules/users/users.repository.knex').createUsersRepository(database),
    buildingsRepository: require('./modules/buildings/buildings.repository.knex').createBuildingsRepository(database),
    roomsRepository: require('./modules/rooms/rooms.repository.knex').createRoomsRepository(database),
    reservationsRepository: require('./modules/reservations/reservations.repository.knex').createReservationsRepository(database),
  });
  const repositories = factory(db);
  const runInTransaction = callback => db.transaction(trx => callback(factory(trx)));
  const authService = createAuthService({ ...repositories, jwtSecret: settings.JWT_SECRET, jwtExpiresIn: settings.JWT_EXPIRES_IN });
  const eventBus = createEventBus({ logger, now });
  const auditRepository = createAuditRepository(db);
  registerListeners({ eventBus, auditRepository, usersRepository: repositories.usersRepository, logger });
  return { db, eventBus, app: createApp({ logger, authService, auditRepository, jwtSecret: settings.JWT_SECRET,
    buildingsService: createBuildingsService(repositories),
    roomsService: createRoomsService({ ...repositories, runInTransaction }),
    reservationsService: createReservationsService({ ...repositories, runInTransaction, eventBus, now }),
  }) };
}
module.exports = { buildApplication };
