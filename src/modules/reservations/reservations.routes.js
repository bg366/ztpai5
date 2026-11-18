const { Router } = require("express");
const { validate } = require("../../middleware/validate");
const { createReservationsController } = require("./reservations.controller");
const {
  reservationIdParams,
  createReservationBody,
  listReservationsQuery,
} = require("./reservations.schemas");

function createReservationsRouter(reservationsService) {
  const controller = createReservationsController(reservationsService);
  const router = Router();

  router.get("/", validate({ query: listReservationsQuery }), controller.list);
  router.post("/", validate({ body: createReservationBody }), controller.create);
  router.get("/:id", validate({ params: reservationIdParams }), controller.getById);
  router.patch("/:id/cancel", validate({ params: reservationIdParams }), controller.cancel);

  return router;
}

module.exports = { createReservationsRouter };
