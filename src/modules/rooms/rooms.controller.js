const { toRoomResponse } = require("./rooms.mapper");

function createRoomsController(roomsService) {
  return {
    async update(req, res) {
      res.json(toRoomResponse(await roomsService.update(req.validated.params.id, req.validated.body)));
    },
    async remove(req, res) {
      await roomsService.remove(req.validated.params.id); res.status(204).end();
    },
    async create(req, res) {
      const room = await roomsService.create(req.validated.body);
      res.status(201).location(`/api/rooms/${room.id}`).json(toRoomResponse(room));
    },
    async list(req, res) {
      const rooms = await roomsService.list();
      res.json(rooms.map(toRoomResponse));
    },
    async getById(req, res) {
      const room = await roomsService.getById(req.validated.params.id);
      res.json(toRoomResponse(room));
    },
  };
}

module.exports = { createRoomsController };
