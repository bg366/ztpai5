const { noopEventBus } = require('../../events/eventBus');
const { BusinessRuleError, ConflictError, NotFoundError, ForbiddenError } = require("../../errors/AppError");

const MINUTE = 60 * 1000;
const MIN_DURATION = 15 * MINUTE;
const MAX_DURATION = 8 * 60 * MINUTE;

// Przedziały półotwarte [start, end): stykające się rezerwacje się nie nakładają.
const overlaps = (a, b) => a.start < b.end && b.start < a.end;

function createReservationsService({ reservationsRepository, roomsRepository, now = () => new Date(), runInTransaction, eventBus = noopEventBus }) {
  async function getById(id, currentUser) {
    const reservation = await reservationsRepository.findById(id);
    if (!reservation || (currentUser.role !== 'ADMIN' && reservation.userId !== currentUser.id)) {
      throw new NotFoundError("RESERVATION_NOT_FOUND", `Reservation ${id} not found`);
    }
    return reservation;
  }

  function publishCreated(reservation) {
    eventBus.publish('reservation.created', {
      reservationId: reservation.id, roomId: reservation.roomId, userId: reservation.userId,
      startTime: reservation.startTime.toISOString(), endTime: reservation.endTime.toISOString(),
    });
  }

  return {
    getById,

    async list(filters = {}, currentUser) {
      if (currentUser.role !== 'ADMIN' && filters.userId !== undefined) {
        throw new ForbiddenError('Only ADMIN can use the userId filter');
      }
      const scope = currentUser.role === 'ADMIN' ? filters : { ...filters, userId: currentUser.id };
      return reservationsRepository.findPage(scope);
    },

    async create(input, currentUser) {
      if (runInTransaction) {
        const reservation = await runInTransaction(async repositories => {
          await repositories.roomsRepository.lockById(input.roomId);
          return createReservationsService({ ...repositories, now }).create(input, currentUser);
        });
        publishCreated(reservation);
        return reservation;
      }
      const currentTime = now();
      const start = new Date(input.startTime).getTime();
      const end = new Date(input.endTime).getTime();

      if (end <= start) {
        throw new BusinessRuleError("INVALID_TIME_RANGE", "endTime must be later than startTime");
      }
      if (end - start < MIN_DURATION || end - start > MAX_DURATION) {
        throw new BusinessRuleError(
          "INVALID_DURATION",
          "Reservation must last from 15 minutes to 8 hours",
        );
      }
      if (start < currentTime.getTime()) {
        throw new BusinessRuleError("START_TIME_IN_PAST", "startTime cannot be in the past");
      }

      const room = await roomsRepository.findById(input.roomId);
      if (!room) {
        throw new NotFoundError("ROOM_NOT_FOUND", `Room ${input.roomId} not found`);
      }
      if (input.participants > room.capacity) {
        throw new ConflictError(
          "ROOM_CAPACITY_EXCEEDED",
          `Room ${room.name} has capacity ${room.capacity}`,
        );
      }

      const existing = await reservationsRepository.findAll({ roomId: room.id });
      const conflict = existing.find((reservation) =>
        reservation.status === "CONFIRMED" &&
        overlaps(
          { start, end },
          { start: reservation.startTime.getTime(), end: reservation.endTime.getTime() },
        ));
      if (conflict) {
        throw new ConflictError(
          "ROOM_ALREADY_BOOKED",
          `Room ${room.name} is already booked`,
        );
      }

      const reservation = await reservationsRepository.create({
        roomId: room.id,
        userId: currentUser.id,
        participants: input.participants,
        startTime: new Date(start),
        endTime: new Date(end),
        status: "CONFIRMED",
        createdAt: currentTime,
        cancelledAt: null,
      });
      publishCreated(reservation);
      return reservation;
    },

    async cancel(id, currentUser) {
      const change = async repositories => {
        await repositories.reservationsRepository.lockById(id);
        const service = createReservationsService({ ...repositories, now });
        const reservation = await service.getById(id, currentUser);
        if (reservation.status === 'CANCELLED') return { reservation, changed: false };
        const currentTime = now();
        if (reservation.startTime.getTime() <= currentTime.getTime()) {
          throw new ConflictError('RESERVATION_ALREADY_STARTED', 'Reservation has already started');
        }
        const updated = await repositories.reservationsRepository.update(id, {
          status: 'CANCELLED', cancelledAt: currentTime,
        });
        return { reservation: updated, changed: true };
      };
      const result = runInTransaction
        ? await runInTransaction(change)
        : await change({ reservationsRepository, roomsRepository });
      // runInTransaction rozwiązuje Promise dopiero po COMMIT.
      if (result.changed) {
        eventBus.publish('reservation.cancelled', {
          reservationId: id, roomId: result.reservation.roomId,
          userId: result.reservation.userId, cancelledBy: currentUser.id,
        });
      }
      return result.reservation;
    },
  };
}

module.exports = { createReservationsService };
