const ref = name => ({ $ref: `#/components/schemas/${name}` });
const integer = { type: 'integer', minimum: 1, maximum: 2147483647 };
const text = { type: 'string' };
const date = { type: 'string', format: 'date-time' };
const object = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false });
const array = items => ({ type: 'array', items });
const schemas = {
  Error: object({ error: object({ code: text, message: text, details: array(object({ location: text, field: { type: 'string', nullable: true }, message: text })), requestId: text }) }),
  User: object({ id: integer, email: { type: 'string', format: 'email' }, role: { type: 'string', enum: ['USER', 'ADMIN'] }, createdAt: date }),
  Register: object({ email: { type: 'string', format: 'email', maxLength: 254 }, password: { type: 'string', minLength: 10, maxLength: 72, description: 'Maksymalnie 72 bajty UTF-8 (limit bcrypt).' } }),
  Login: object({ email: { type: 'string', format: 'email', maxLength: 254 }, password: { type: 'string', minLength: 1, maxLength: 1024 } }),
  Token: object({ accessToken: text, tokenType: { type: 'string', enum: ['Bearer'] }, expiresIn: { type: 'string', example: '15m' } }),
  Building: object({ id: integer, name: text, address: text, roomsCount: { type: 'integer', minimum: 0 } }, ['id', 'name', 'address']),
  BuildingInput: object({ name: { type: 'string', minLength: 1, maxLength: 100 }, address: { type: 'string', minLength: 1, maxLength: 250 } }),
  Room: object({ id: integer, name: text, capacity: integer, building: object({ id: integer, name: text }) }),
  RoomInput: object({ buildingId: integer, name: { type: 'string', minLength: 1, maxLength: 100 }, capacity: integer }),
  Reservation: object({ id: integer, room: object({ id: integer, name: text, building: object({ id: integer, name: text }) }), user: object({ id: integer, email: { type: 'string', format: 'email' } }), participants: integer, startTime: date, endTime: date, status: { type: 'string', enum: ['CONFIRMED', 'CANCELLED'] }, createdAt: date, cancelledAt: { ...date, nullable: true } }),
  ReservationInput: object({ roomId: integer, participants: integer, startTime: date, endTime: date }),
  ReservationPage: object({ data: array(ref('Reservation')), meta: object({ page: integer, limit: { type: 'integer', minimum: 1, maximum: 100 }, total: { type: 'integer', minimum: 0 }, totalPages: { type: 'integer', minimum: 0 } }) }),
};
for (const name of ['Building', 'Room']) schemas[`${name}Patch`] = { ...schemas[`${name}Input`], required: [], minProperties: 1 };
const descriptions = {
  400: 'Niepoprawny JSON, nieznane pole, błędne dane lub reguła czasu (VALIDATION_ERROR, INVALID_JSON, INVALID_DATA, INVALID_TIME_RANGE, INVALID_DURATION, START_TIME_IN_PAST).',
  401: 'UNAUTHORIZED: brak/zły token, zły podpis, zmieniony payload lub Token expired; przy logowaniu Invalid email or password.',
  403: 'FORBIDDEN: operacja wymaga ADMIN; parametr userId również tylko dla ADMIN.',
  404: 'Nie znaleziono zasobu; obca rezerwacja zwraca taki sam RESERVATION_NOT_FOUND jak nieistniejąca.',
  409: 'Konflikt: EMAIL_TAKEN, DUPLICATE_RESOURCE, REFERENCE_CONFLICT, ROOM_ALREADY_BOOKED, ROOM_CAPACITY_EXCEEDED lub RESERVATION_ALREADY_STARTED.',
  413: 'BODY_TOO_LARGE: limit JSON wynosi 32 kB.',
  500: 'INTERNAL_ERROR: błąd serwera bez szczegółów wewnętrznych.',
};
const response = (schema, description = 'Sukces') => ({ description, content: { 'application/json': { schema } } });
function operation(tag, summary, schema, { status = 200, errors = [], body, example, parameters, publicRoute = false } = {}) {
  return {
    tags: [tag], summary,
    ...(publicRoute ? { security: [] } : {}),
    ...(parameters ? { parameters } : {}),
    ...(body ? { requestBody: { required: true, content: { 'application/json': { schema: ref(body), example } } } } : {}),
    responses: {
      [status]: status === 204 ? { description: 'Usunięto zasób (bez body).' } : response(schema),
      ...Object.fromEntries([...new Set([...errors, ...(publicRoute ? [] : [401]), ...(body ? [400, 413] : []), 500])].map(code => [code, response(ref('Error'), descriptions[code])])),
    },
  };
}
const id = { name: 'id', in: 'path', required: true, schema: integer };
const reservationExample = { roomId: 1, participants: 5, startTime: '2099-12-10T10:00:00Z', endTime: '2099-12-10T11:00:00Z' };
schemas.AuditEntry = object({ id: integer, eventType: { type: 'string', enum: ['reservation.created', 'reservation.cancelled'] }, payload: { type: 'object', additionalProperties: true }, createdAt: date });
schemas.AuditPage = object({ data: array(ref('AuditEntry')), meta: schemas.ReservationPage.properties.meta });
const paths = {
  '/health': { get: operation('Docs', 'Stan procesu API', object({ status: text }), { publicRoute: true }) },
  '/api/admin/audit-log': { get: operation('Audit', 'Audit log (ADMIN), od najnowszych wpisów', ref('AuditPage'), {
    errors: [400, 403], parameters: [
      { name: 'page', in: 'query', schema: { ...integer, default: 1 } },
      { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
      { name: 'eventType', in: 'query', schema: { type: 'string', enum: ['reservation.created', 'reservation.cancelled'] } },
    ],
  }) },
  '/api/auth/register': { post: operation('Auth', 'Rejestracja konta USER', ref('User'), { status: 201, publicRoute: true, errors: [409], body: 'Register', example: { email: 'Piotr@example.com', password: 'bardzo-dlugie-haslo' } }) },
  '/api/auth/login': { post: operation('Auth', 'Logowanie i token JWT', ref('Token'), { publicRoute: true, errors: [401], body: 'Login', example: { email: 'jan@example.com', password: 'user-password-123' } }) },
  '/api/auth/me': { get: operation('Auth', 'Dane zalogowanego użytkownika', ref('User')) },
  '/api/buildings/{id}/rooms': { get: operation('Buildings', 'Sale w budynku', array(ref('Room')), { parameters: [id], errors: [400, 404] }) },
  '/api/reservations': {
    get: operation('Reservations', 'Rezerwacje - USER widzi wyłącznie własne', ref('ReservationPage'), { errors: [400, 403], parameters: [
      ...['roomId', 'buildingId', 'userId'].map(name => ({ name, in: 'query', schema: integer, description: name === 'userId' ? 'Tylko ADMIN; USER otrzyma 403.' : 'Filtr po identyfikatorze.' })),
      { name: 'status', in: 'query', schema: { type: 'string', enum: ['CONFIRMED', 'CANCELLED'] } },
      ...['from', 'to'].map(name => ({ name, in: 'query', schema: date, description: 'Nakładanie na przedział [from, to); from musi być wcześniejsze niż to.' })),
      { name: 'page', in: 'query', schema: { ...integer, default: 1 } },
      { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
      { name: 'sort', in: 'query', schema: { type: 'string', default: 'startTime', enum: ['startTime', '-startTime', 'createdAt', '-createdAt', 'participants', '-participants'] } },
    ] }),
    post: operation('Reservations', 'Utwórz rezerwację jako zalogowany użytkownik', ref('Reservation'), { status: 201, errors: [404, 409], body: 'ReservationInput', example: reservationExample }),
  },
  '/api/reservations/{id}': { get: operation('Reservations', 'Rezerwacja właściciela lub dowolna dla ADMIN', ref('Reservation'), { parameters: [id], errors: [400, 404] }) },
  '/api/reservations/{id}/cancel': { patch: operation('Reservations', 'Anuluj rezerwację - właściciel lub ADMIN', ref('Reservation'), { parameters: [id], errors: [400, 404, 409] }) },
  '/api/debug/crash': { get: { tags: ['Debug'], summary: 'Kontrolowany błąd 500 (ADMIN)', responses: Object.fromEntries([401, 403, 500].map(code => [code, response(ref('Error'), descriptions[code])])) } },
  '/openapi.json': { get: operation('Docs', 'Specyfikacja OpenAPI (wymaga tokenu)', { type: 'object' }) },
};
for (const [plural, model, example] of [
  ['buildings', 'Building', { name: 'Budynek C', address: 'ul. Testowa 1, Kraków' }],
  ['rooms', 'Room', { buildingId: 1, name: '104', capacity: 25 }],
]) {
  const tag = plural === 'rooms' ? 'Rooms' : 'Buildings';
  paths[`/api/${plural}`] = {
    get: operation(tag, 'Lista dla każdego zalogowanego użytkownika', array(ref(model))),
    post: operation(tag, 'Utwórz (ADMIN)', ref(model), { status: 201, errors: [403, 409, ...(model === 'Room' ? [404] : [])], body: `${model}Input`, example }),
  };
  paths[`/api/${plural}/{id}`] = {
    get: operation(tag, 'Pobierz po ID', ref(model), { parameters: [id], errors: [400, 404] }),
    patch: operation(tag, 'Zmień wybrane pola (ADMIN)', ref(model), { parameters: [id], errors: [403, 404, 409], body: `${model}Patch`, example: { name: model === 'Room' ? '105' : 'Budynek D' } }),
    delete: operation(tag, 'Usuń (ADMIN) - powiązane zasoby blokują usunięcie', null, { parameters: [id], status: 204, errors: [400, 403, 404, 409] }),
  };
}
module.exports = {
  openapi: '3.0.3', info: { title: 'Room Booking API - lab5', version: '5.0.0', description: 'Rejestracja, JWT i prywatne rezerwacje. Zaloguj się, skopiuj accessToken i użyj Authorize. Dane przykładowe dotyczą wyłącznie lokalnego laboratorium.' },
  servers: [{ url: '/' }],
  tags: ['Auth', 'Buildings', 'Rooms', 'Reservations', 'Audit', 'Docs', 'Debug'].map(name => ({ name })),
  security: [{ bearerAuth: [] }],
  components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Wklej sam accessToken (bez prefiksu Bearer).' } }, schemas },
  paths,
};
