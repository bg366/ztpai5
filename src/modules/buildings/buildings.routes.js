const { Router } = require('express');
const { z } = require('zod');
const { validate } = require('../../middleware/validate');
const { idParams } = require('../../common/schemas');
const { toRoomResponse } = require('../rooms/rooms.mapper');
const { authorize } = require('../../middleware/authorize');
const createBody = z.strictObject({ name: z.string().trim().min(1).max(100), address: z.string().trim().min(1).max(250) });
const updateBody = createBody.partial().refine(value => Object.keys(value).length > 0, 'Provide at least one field');
function createBuildingsRouter(service) {
  const router = Router();
  router.get('/', async (req,res) => res.json(await service.list()));
  router.post('/', authorize('ADMIN'), validate({ body: createBody }), async (req,res) => {
    const b = await service.create(req.validated.body); res.status(201).location(`/api/buildings/${b.id}`).json(b);
  });
  router.get('/:id', validate({ params: idParams }), async (req,res) => res.json(await service.getById(req.validated.params.id)));
  router.get('/:id/rooms', validate({ params: idParams }), async (req,res) => res.json((await service.rooms(req.validated.params.id)).map(toRoomResponse)));
  router.patch('/:id', authorize('ADMIN'), validate({ params: idParams, body: updateBody }), async (req, res) => {
    res.json(await service.update(req.validated.params.id, req.validated.body));
  });
  router.delete('/:id', authorize('ADMIN'), validate({ params: idParams }), async (req, res) => {
    await service.remove(req.validated.params.id); res.status(204).end();
  });
  return router;
}
module.exports = { createBuildingsRouter };
