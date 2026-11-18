const { z } = require("zod");

// Parametry z URL i query są stringami, dlatego najpierw sprawdzamy format, potem zamieniamy na liczbę.
const positiveIntParam = z
  .string()
  .regex(/^[1-9]\d*$/, "Must be a positive integer")
  .transform(Number).pipe(z.int().positive().max(2147483647));

const idParams = z.object({ id: positiveIntParam });

module.exports = { positiveIntParam, idParams };
