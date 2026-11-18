const request = require('supertest');
const knex = require('knex');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
if (!process.env.TEST_DATABASE_URL) throw new Error('Ustaw TEST_DATABASE_URL przed testami integracyjnymi');
const config = require('../../src/config');
const { buildApplication } = require('../../src/bootstrap');
const db = knex(require('../../knexfile'));
const logger = { log: jest.fn(), error: jest.fn() };
// buildApplication składa zależności i wywołuje createApp(), bez app.listen().
const { app, eventBus } = buildApplication({ db, logger, now: () => new Date('2030-01-01T08:00:00Z') });
const password = 'test-password-123';
let passwordHash;
let userToken;
let adminToken;
const booking = (changes = {}) => ({
  roomId: 1, participants: 5, startTime: '2030-01-02T10:00:00Z', endTime: '2030-01-02T11:00:00Z', ...changes,
});
const token = (id, role) => jwt.sign({ role }, config.JWT_SECRET, { subject: String(id), expiresIn: '15m', algorithm: 'HS256' });
const authorized = (method, url, auth = userToken) => request(app)[method](url).set('Authorization', `Bearer ${auth}`);

beforeAll(async () => {
  await db.migrate.latest();
  passwordHash = await bcrypt.hash(password, 12);
});
beforeEach(async () => {
  await eventBus.drain();
  await db.raw('TRUNCATE audit_log, reservations, rooms, buildings, users RESTART IDENTITY');
  await db('users').insert([
    { email: 'jan@example.com', password_hash: passwordHash, role: 'USER' },
    { email: 'admin@example.com', password_hash: passwordHash, role: 'ADMIN' },
    { email: 'anna@example.com', password_hash: passwordHash, role: 'USER' },
  ]);
  await db('buildings').insert({ name: 'A', address: 'Warszawska 24' });
  await db('rooms').insert({ building_id: 1, name: '101', capacity: 10 });
  userToken = token(1, 'USER');
  adminToken = token(2, 'ADMIN');
});
afterAll(async () => {
  await eventBus.drain();
  await db.destroy();
});

test('rejestracja, logowanie i GET /api/auth/me', async () => {
  const credentials = { email: 'piotr@example.com', password };
  const registered = await request(app).post('/api/auth/register').send(credentials).expect(201);
  expect(registered.body).toMatchObject({ email: credentials.email, role: 'USER' });
  expect(registered.body).not.toHaveProperty('passwordHash');
  const login = await request(app).post('/api/auth/login').send(credentials).expect(200);
  const me = await authorized('get', '/api/auth/me', login.body.accessToken).expect(200);
  expect(me.body.id).toBe(registered.body.id);
});
test('POST daje 201, Location i rekord w bazie', async () => {
  const res = await authorized('post', '/api/reservations').send(booking()).expect(201);
  expect(res.headers.location).toBe(`/api/reservations/${res.body.id}`);
  const saved = await db('reservations').where({ id: res.body.id }).first();
  expect(saved).toMatchObject({ room_id: 1, user_id: 1, participants: 5, status: 'CONFIRMED' });
  expect(saved.start_time.toISOString()).toBe('2030-01-02T10:00:00.000Z');
});
test('400 zawiera details dla błędnego body', async () => {
  const res = await authorized('post', '/api/reservations').send(booking({ participants: 0 })).expect(400);
  expect(res.body.error.code).toBe('VALIDATION_ERROR');
  expect(res.body.error.details).toContainEqual(expect.objectContaining({ location: 'body', field: 'participants' }));
});
test('401 bez tokenu', async () => {
  const res = await request(app).get('/api/reservations').expect(401);
  expect(res.body.error.code).toBe('UNAUTHORIZED');
});
test('403 przy tworzeniu sali przez USER', async () => {
  const res = await authorized('post', '/api/rooms').send({ buildingId: 1, name: '102', capacity: 20 }).expect(403);
  expect(res.body.error.code).toBe('FORBIDDEN');
});
test('404 przy pobieraniu cudzej rezerwacji przez USER', async () => {
  const created = await authorized('post', '/api/reservations').send(booking()).expect(201);
  const res = await authorized('get', `/api/reservations/${created.body.id}`, token(3, 'USER')).expect(404);
  expect(res.body.error.code).toBe('RESERVATION_NOT_FOUND');
});
test('409 ROOM_ALREADY_BOOKED przy kolizji', async () => {
  await authorized('post', '/api/reservations').send(booking()).expect(201);
  const res = await authorized('post', '/api/reservations').send(booking()).expect(409);
  expect(res.body.error.code).toBe('ROOM_ALREADY_BOOKED');
  expect(await db('reservations')).toHaveLength(1);
});
test('pagination liczy meta.total niezależnie od limitu i uwzględnia właściciela', async () => {
  for (const hour of [10, 11, 12]) {
    await authorized('post', '/api/reservations').send(booking({
      startTime: `2030-01-02T${hour}:00:00Z`, endTime: `2030-01-02T${hour + 1}:00:00Z`,
    })).expect(201);
  }
  await authorized('post', '/api/reservations', token(3, 'USER')).send(booking({
    startTime: '2030-01-03T10:00:00Z', endTime: '2030-01-03T11:00:00Z',
  })).expect(201);
  const res = await authorized('get', '/api/reservations?limit=2&page=1').expect(200);
  expect(res.body.meta).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });
  expect(res.body.data).toHaveLength(2);
});
test('utworzenie, kolizja i dwukrotne anulowanie dają dokładnie dwa eventy', async () => {
  const created = await authorized('post', '/api/reservations').send(booking()).expect(201);
  await authorized('post', '/api/reservations').send(booking()).expect(409);
  const path = `/api/reservations/${created.body.id}/cancel`;
  const first = await authorized('patch', path, adminToken).expect(200);
  const second = await authorized('patch', path, adminToken).expect(200);
  expect(second.body.cancelledAt).toBe(first.body.cancelledAt);
  await eventBus.drain();
  const rows = await db('audit_log').orderBy('id');
  expect(rows.map(row => row.event_type)).toEqual(['reservation.created', 'reservation.cancelled']);
  expect(rows[1].payload).toEqual({ reservationId: created.body.id, roomId: 1, userId: 1, cancelledBy: 2 });
  expect(logger.log).toHaveBeenCalledWith('[notification] to: jan@example.com reservation 1 cancelled by ADMIN');
  const res = await authorized('get', '/api/admin/audit-log?limit=1', adminToken).expect(200);
  expect(res.body.meta.total).toBe(2);
  expect(res.body.data).toHaveLength(1);
  expect(res.body.data[0].eventType).toBe('reservation.cancelled');
  const filtered = await authorized('get', '/api/admin/audit-log?eventType=reservation.created', adminToken).expect(200);
  expect(filtered.body.meta.total).toBe(1);
  expect(filtered.body.data[0].eventType).toBe('reservation.created');
});
test('audit log odrzuca USER i błędny filtr', async () => {
  await authorized('get', '/api/admin/audit-log').expect(403);
  const res = await authorized('get', '/api/admin/audit-log?eventType=unknown', adminToken).expect(400);
  expect(res.body.error.details).toContainEqual(expect.objectContaining({ location: 'query', field: 'eventType' }));
});
test('awaria rzeczywistego zapisu audit logu nie zmienia 201', async () => {
  await db.schema.renameTable('audit_log', 'audit_log_unavailable');
  try {
    await authorized('post', '/api/reservations').send(booking()).expect(201);
    await eventBus.drain();
    expect(await db('reservations')).toHaveLength(1);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('[event:reservation.created] handler failed'));
  } finally {
    await eventBus.drain();
    await db.schema.renameTable('audit_log_unavailable', 'audit_log');
  }
});
test('równoległe tworzenie daje jeden zapis i jeden event', async () => {
  const results = await Promise.all([1, 2, 3].map(() => authorized('post', '/api/reservations').send(booking())));
  expect(results.map(res => res.status).sort()).toEqual([201, 409, 409]);
  await eventBus.drain();
  expect(await db('audit_log')).toHaveLength(1);
});
test('równoległe anulowanie publikuje tylko raz', async () => {
  const created = await authorized('post', '/api/reservations').send(booking()).expect(201);
  const results = await Promise.all([1, 2, 3].map(() => authorized('patch', `/api/reservations/${created.body.id}/cancel`, adminToken)));
  expect(results.map(res => res.status)).toEqual([200, 200, 200]);
  expect(new Set(results.map(res => res.body.cancelledAt)).size).toBe(1);
  await eventBus.drain();
  expect(await db('audit_log').where({ event_type: 'reservation.cancelled' })).toHaveLength(1);
});
