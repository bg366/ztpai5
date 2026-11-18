const { BusinessRuleError, ConflictError, NotFoundError, ForbiddenError } = require("../../errors/AppError");

const MINUTE = 60 * 1000;
const MIN_DURATION = 15 * MINUTE;
const MAX_DURATION = 8 * 60 * MINUTE;

// Dozwolone przejścia statusów; CANCELLED jest stanem końcowym.
const STATUS_TRANSITIONS = {
  CONFIRMED: ["CANCELLED"],
  CANCELLED: [],
};

// Przedziały półotwarte [start, end): stykające się rezerwacje się nie nakładają.
const overlaps = (a, b) => a.start < b.end && b.start < a.end;

function createReservationsService({ reservationsRepository, roomsRepository, now = () => new Date(), runInTransaction }) {
  async function getById(id, currentUser) {
    const reservation = await reservationsRepository.findById(id);
    if (!reservation || (currentUser.role !== 'ADMIN' && reservation.userId !== currentUser.id)) {
      throw new NotFoundError("RESERVATION_NOT_FOUND", `Reservation ${id} not found`);
    }
    return reservation;
  }

  async function changeStatus(reservation, status, changes) {
    if (!STATUS_TRANSITIONS[reservation.status].includes(status)) {
      throw new ConflictError(
        "INVALID_STATUS_TRANSITION",
        `Cannot change status from ${reservation.status} to ${status}`,
      );
    }
    return reservationsRepository.update(reservation.id, { status, ...changes });
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
        return runInTransaction(async repositories => {
          await repositories.roomsRepository.lockById(input.roomId);
          return createReservationsService({ ...repositories, now }).create(input, currentUser);
        });
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

      return reservationsRepository.create({
        roomId: room.id,
        userId: currentUser.id,
        participants: input.participants,
        startTime: new Date(start),
        endTime: new Date(end),
        status: "CONFIRMED",
        createdAt: currentTime,
        cancelledAt: null,
      });
    },

    async cancel(id, currentUser) {
      const reservation = await getById(id, currentUser);

      // Ponowne anulowanie jest idempotentne: zwracamy rezerwację bez zmian.
      if (reservation.status === "CANCELLED") {
        return reservation;
      }

      const currentTime = now();
      if (reservation.startTime.getTime() <= currentTime.getTime()) {
        throw new ConflictError("RESERVATION_ALREADY_STARTED", "Reservation has already started");
      }
      return changeStatus(reservation, "CANCELLED", { cancelledAt: currentTime });
    },
  };
}

module.exports = { createReservationsService };
