const { createAuditRouter } = require('./modules/audit/audit.routes');
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const openapi = require('./openapi');
const { requestLogger } = require('./middleware/requestLogger');
const { authenticate } = require('./middleware/authenticate');
const { authorize } = require('./middleware/authorize');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { createAuthRouter } = require('./modules/auth/auth.routes');
const { toUserResponse } = require('./modules/auth/auth.mapper');
const { createBuildingsRouter } = require('./modules/buildings/buildings.routes');
const { createRoomsRouter } = require('./modules/rooms/rooms.routes');
const { createReservationsRouter } = require('./modules/reservations/reservations.routes');
const { createDebugRouter } = require('./modules/debug/debug.routes');

function createApp({ authService, jwtSecret, buildingsService, roomsService, reservationsService, auditRepository, logger = console }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(requestLogger(logger));
  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.get('/api/docs/openapi.json', (req, res) => res.json(openapi));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi, {
    customSiteTitle: 'Room Booking API - lab5',
    swaggerOptions: { validatorUrl: null, defaultModelsExpandDepth: -1, persistAuthorization: false },
  }));
  const publicAuth = express.Router();
  publicAuth.use(express.json({ limit: '32kb' }));
  publicAuth.use(createAuthRouter(authService));
  app.use('/api/auth', (req, res, next) => {
    if (req.method === 'POST' && ['/register', '/login'].includes(req.path)) return publicAuth(req, res, next);
    next();
  });
  app.use(authenticate(jwtSecret));
  app.use(express.json({ limit: '32kb' }));
  app.get('/openapi.json', (req, res) => res.json(openapi));
  app.get('/api/auth/me', async (req, res) => res.json(toUserResponse(await authService.me(req.user))));
  app.use('/api/buildings', createBuildingsRouter(buildingsService));
  app.use('/api/rooms', createRoomsRouter(roomsService));
  app.use('/api/reservations', createReservationsRouter(reservationsService));
  app.use('/api/admin/audit-log', authorize('ADMIN'), createAuditRouter(auditRepository));
  app.use('/api/debug', authorize('ADMIN'), createDebugRouter());
  app.use(notFoundHandler);
  app.use(errorHandler(logger));
  return app;
}
module.exports = { createApp };
