const { z } = require('zod');
const { idParams } = require('../../common/schemas');
module.exports = { roomIdParams: idParams, createRoomBody: z.strictObject({
  buildingId: z.int().positive(), name: z.string().trim().min(1).max(100), capacity: z.int().positive(),
}) };
