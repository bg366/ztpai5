const { z } = require("zod");
const { idParams, positiveIntParam } = require("../../common/schemas");

// offset: true akceptuje "Z" oraz przesunięcia typu "+01:00"; data bez strefy jest odrzucana.
const isoDateTime = z.iso.datetime({
  offset: true,
  error: "Must be an ISO 8601 date-time with time zone",
});

// strictObject odrzuca nieznane pola, np. status albo id.
const createReservationBody = z.strictObject({
  roomId: z.int().positive(),
  participants: z.int().positive(),
  startTime: isoDateTime,
  endTime: isoDateTime,
});

const listReservationsQuery = z.strictObject({
  roomId: positiveIntParam.optional(), buildingId: positiveIntParam.optional(), userId: positiveIntParam.optional(),
  status: z.enum(['CONFIRMED', 'CANCELLED']).optional(),
  from: isoDateTime.optional(), to: isoDateTime.optional(),
  page: positiveIntParam.default(1), limit: positiveIntParam.pipe(z.number().max(100)).default(20),
  sort: z.enum(['startTime', '-startTime', 'createdAt', '-createdAt', 'participants', '-participants']).default('startTime'),
}).refine(q => !q.from || !q.to || Date.parse(q.from) < Date.parse(q.to), {
  message: 'from must be earlier than to', path: ['to'],
});

module.exports = {
  reservationIdParams: idParams,
  createReservationBody,
  listReservationsQuery,
};
