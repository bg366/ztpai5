const { createReservationsService } = require('../../src/modules/reservations/reservations.service');
const { createReservationsRepository } = require('../../src/modules/reservations/reservations.repository.memory');
const { createRoomsRepository } = require('../../src/modules/rooms/rooms.repository.memory');

const NOW = new Date('2030-01-01T08:00:00Z');
const owner = { id: 1, role: 'USER' };
const other = { id: 2, role: 'USER' };
const admin = { id: 3, role: 'ADMIN' };
const input = (changes = {}) => ({
  roomId: 1, participants: 10,
  startTime: '2030-01-02T10:00:00Z', endTime: '2030-01-02T11:00:00Z', ...changes,
});
function setup() {
  const state = {
    buildings: [{ id: 1, name: 'A' }],
    rooms: [{ id: 1, buildingId: 1, name: '101', capacity: 10 }, { id: 2, buildingId: 1, name: '102', capacity: 10 }],
    users: [owner, other, admin].map(user => ({ ...user, email: `${user.id}@example.com` })),
    reservations: [], nextReservationId: 1,
  };
  const repositories = {
    reservationsRepository: createReservationsRepository(state),
    roomsRepository: createRoomsRepository(state),
  };
  const clock = { value: NOW };
  const eventBus = { publish: jest.fn() };
  const service = createReservationsService({ ...repositories, now: () => clock.value, eventBus });
  return { service, state, repositories, eventBus, clock };
}

describe('tworzenie rezerwacji', () => {
  test.each([
    ['częściowe z lewej', '09:30', '10:30'],
    ['częściowe z prawej', '10:30', '11:30'],
    ['nowa zawiera starą', '09:00', '12:00'],
    ['stara zawiera nową', '10:15', '10:45'],
    ['identyczny przedział', '10:00', '11:00'],
  ])('odrzuca nakładanie: %s', async (_, start, end) => {
    const { service, eventBus } = setup();
    await service.create(input(), owner);
    eventBus.publish.mockClear();
    await expect(service.create(input({ startTime: `2030-01-02T${start}:00Z`, endTime: `2030-01-02T${end}:00Z` }), owner))
      .rejects.toMatchObject({ code: 'ROOM_ALREADY_BOOKED' });
    expect(eventBus.publish).not.toHaveBeenCalled();
  });
  test.each([['09:00', '10:00'], ['11:00', '12:00']])('pozwala na stykający się przedział %s-%s', async (start, end) => {
    const { service } = setup();
    await service.create(input(), owner);
    await expect(service.create(input({ startTime: `2030-01-02T${start}:00Z`, endTime: `2030-01-02T${end}:00Z` }), owner))
      .resolves.toMatchObject({ status: 'CONFIRMED' });
  });
  test('pozwala na ten sam czas w innej sali', async () => {
    const { service } = setup();
    await service.create(input(), owner);
    await expect(service.create(input({ roomId: 2 }), owner)).resolves.toMatchObject({ roomId: 2 });
  });
  test('anulowana rezerwacja nie blokuje czasu', async () => {
    const { service } = setup();
    const created = await service.create(input(), owner);
    await service.cancel(created.id, owner);
    await expect(service.create(input(), owner)).resolves.toMatchObject({ status: 'CONFIRMED' });
  });
  test('pozwala na participants == capacity', async () => {
    const { service } = setup();
    await expect(service.create(input({ participants: 10 }), owner)).resolves.toMatchObject({ participants: 10 });
  });
  test('odrzuca capacity + 1', async () => {
    const { service } = setup();
    await expect(service.create(input({ participants: 11 }), owner)).rejects.toMatchObject({ code: 'ROOM_CAPACITY_EXCEEDED' });
  });
  test.each([15, 480])('pozwala na dokładnie %i minut', async minutes => {
    const { service } = setup();
    const endTime = new Date(Date.parse(input().startTime) + minutes * 60000).toISOString();
    await expect(service.create(input({ endTime }), owner)).resolves.toMatchObject({ status: 'CONFIRMED' });
  });
  test.each([14, 481])('odrzuca %i minut', async minutes => {
    const { service } = setup();
    const endTime = new Date(Date.parse(input().startTime) + minutes * 60000).toISOString();
    await expect(service.create(input({ endTime }), owner)).rejects.toMatchObject({ code: 'INVALID_DURATION' });
  });
  test('odrzuca początek w przeszłości', async () => {
    const { service, clock } = setup();
    clock.value = new Date('2030-01-03T08:00:00Z');
    await expect(service.create(input(), owner)).rejects.toMatchObject({ code: 'START_TIME_IN_PAST' });
  });
});

describe('anulowanie i własność', () => {
  test('odrzuca anulowanie w chwili rozpoczęcia', async () => {
    const { service, clock, eventBus } = setup();
    const created = await service.create(input(), owner);
    clock.value = created.startTime;
    eventBus.publish.mockClear();
    await expect(service.cancel(created.id, owner)).rejects.toMatchObject({ code: 'RESERVATION_ALREADY_STARTED' });
    expect(eventBus.publish).not.toHaveBeenCalled();
  });
  test('ponowne anulowanie zachowuje cancelledAt i nie publikuje eventu', async () => {
    const { service, eventBus, clock } = setup();
    const created = await service.create(input(), owner);
    const cancelled = await service.cancel(created.id, owner);
    eventBus.publish.mockClear();
    clock.value = new Date('2030-01-01T09:00:00Z');
    const again = await service.cancel(created.id, owner);
    expect(again.cancelledAt).toEqual(cancelled.cancelledAt);
    expect(eventBus.publish).not.toHaveBeenCalled();
  });
  test('obcy USER nie może odczytać ani anulować rezerwacji', async () => {
    const { service, eventBus } = setup();
    const created = await service.create(input(), owner);
    eventBus.publish.mockClear();
    await expect(service.getById(created.id, other)).rejects.toMatchObject({ code: 'RESERVATION_NOT_FOUND' });
    await expect(service.cancel(created.id, other)).rejects.toMatchObject({ code: 'RESERVATION_NOT_FOUND' });
    expect(eventBus.publish).not.toHaveBeenCalled();
  });
  test('ADMIN może odczytać i anulować cudzą rezerwację', async () => {
    const { service, eventBus } = setup();
    const created = await service.create(input(), owner);
    await expect(service.getById(created.id, admin)).resolves.toMatchObject({ userId: owner.id });
    await expect(service.cancel(created.id, admin)).resolves.toMatchObject({ status: 'CANCELLED' });
    expect(eventBus.publish).toHaveBeenLastCalledWith('reservation.cancelled', {
      reservationId: created.id, roomId: 1, userId: 1, cancelledBy: 3,
    });
  });
});

describe('publikacja po transakcji', () => {
  test('publikuje reservation.created dopiero po COMMIT', async () => {
    const { repositories, eventBus } = setup();
    let committed = false;
    const service = createReservationsService({ ...repositories, eventBus, now: () => NOW,
      runInTransaction: async callback => {
        const result = await callback(repositories);
        expect(eventBus.publish).not.toHaveBeenCalled();
        committed = true;
        return result;
      },
    });
    eventBus.publish.mockImplementation(() => expect(committed).toBe(true));
    const created = await service.create(input(), owner);
    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    expect(eventBus.publish).toHaveBeenCalledWith('reservation.created', {
      reservationId: created.id, roomId: 1, userId: 1,
      startTime: '2030-01-02T10:00:00.000Z', endTime: '2030-01-02T11:00:00.000Z',
    });
  });
  test('nie publikuje eventu po błędzie COMMIT', async () => {
    const { repositories, eventBus } = setup();
    const service = createReservationsService({ ...repositories, eventBus, now: () => NOW,
      runInTransaction: async callback => {
        await callback(repositories);
        throw Object.assign(new Error('rollback'), { code: 'COMMIT_FAILED' });
      },
    });
    await expect(service.create(input(), owner)).rejects.toMatchObject({ code: 'COMMIT_FAILED' });
    expect(eventBus.publish).not.toHaveBeenCalled();
  });
  test('anulowanie również publikuje dopiero po COMMIT', async () => {
    const { service: original, repositories, eventBus } = setup();
    const created = await original.create(input(), owner);
    eventBus.publish.mockClear();
    const service = createReservationsService({ ...repositories, eventBus, now: () => NOW,
      runInTransaction: async callback => {
        const result = await callback(repositories);
        expect(eventBus.publish).not.toHaveBeenCalled();
        return result;
      },
    });
    await service.cancel(created.id, admin);
    expect(eventBus.publish).toHaveBeenCalledTimes(1);
  });
});
