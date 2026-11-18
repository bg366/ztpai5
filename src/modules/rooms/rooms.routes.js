const { Router } = require("express");
const { validate } = require("../../middleware/validate");
const { createRoomsController } = require("./rooms.controller");
const { roomIdParams, createRoomBody } = require("./rooms.schemas");
const { authorize } = require('../../middleware/authorize');
const updateRoomBody = createRoomBody.partial().refine(value => Object.keys(value).length > 0, 'Provide at least one field');

function createRoomsRouter(roomsService) {
  const controller = createRoomsController(roomsService);
  const router = Router();

  router.get("/", controller.list);
  router.post("/", authorize('ADMIN'), validate({ body: createRoomBody }), controller.create);
  router.get("/:id", validate({ params: roomIdParams }), controller.getById);
  router.patch('/:id', authorize('ADMIN'), validate({ params: roomIdParams, body: updateRoomBody }), controller.update);
  router.delete('/:id', authorize('ADMIN'), validate({ params: roomIdParams }), controller.remove);

  return router;
}

module.exports = { createRoomsRouter };
