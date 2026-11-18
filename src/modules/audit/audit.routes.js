const { Router } = require('express');
const { z } = require('zod');
const { positiveIntParam } = require('../../common/schemas');
const { validate } = require('../../middleware/validate');
const query = z.strictObject({
  page: positiveIntParam.default(1),
  limit: positiveIntParam.pipe(z.number().max(100)).default(20),
  eventType: z.enum(['reservation.created', 'reservation.cancelled']).optional(),
});
function createAuditRouter(auditRepository) {
  const router = Router();
  router.get('/', validate({ query }), async (req, res) => {
    res.json(await auditRepository.findPage(req.validated.query));
  });
  return router;
}
module.exports = { createAuditRouter };
