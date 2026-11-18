const toIsoOrNull = (value) => (value ? new Date(value).toISOString() : null);

// Jawna lista pól: internalNote i inne pola wewnętrzne nie trafiają do odpowiedzi.
function toReservationResponse(reservation) {
  return {
    id: reservation.id,
    room: reservation.room,
    user: reservation.user,
    participants: reservation.participants,
    startTime: toIsoOrNull(reservation.startTime),
    endTime: toIsoOrNull(reservation.endTime),
    status: reservation.status,
    createdAt: toIsoOrNull(reservation.createdAt),
    cancelledAt: toIsoOrNull(reservation.cancelledAt),
  };
}

module.exports = { toReservationResponse };
