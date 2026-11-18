const { Router } = require('express');
const { validate } = require('../../middleware/validate');
const { registerBody, loginBody } = require('./auth.schemas');
const { toUserResponse } = require('./auth.mapper');
function createAuthRouter(service) {
  const router = Router();
  router.post('/register', validate({ body: registerBody }), async (req, res) => {
    res.status(201).json(toUserResponse(await service.register(req.validated.body)));
  });
  router.post('/login', validate({ body: loginBody }), async (req, res) => {
    res.json(await service.login(req.validated.body));
  });
  return router;
}
module.exports = { createAuthRouter };
