const { ValidationError } = require("../errors/AppError");

// Każdy błąd Zoda zamieniamy na { location, field, message }.
// Nieznane pola Zod zgłasza jednym błędem z listą kluczy, więc rozbijamy go na osobne wpisy.
function toDetails(location, issue) {
  if (issue.code === "unrecognized_keys") {
    return issue.keys.map((key) => ({
      location, field: [...issue.path, key].join("."), message: "Unknown field",
    }));
  }
  return [{ location, field: issue.path.join(".") || null, message: issue.message }];
}

function validate(schemas) {
  return (req, res, next) => {
    const validated = {};
    const details = [];

    for (const location of ["params", "query", "body"]) {
      if (!schemas[location]) continue;
      const result = schemas[location].safeParse(req[location]);
      if (result.success) {
        validated[location] = result.data;
      } else {
        details.push(...result.error.issues.flatMap((issue) => toDetails(location, issue)));
      }
    }

    if (details.length > 0) {
      throw new ValidationError(details);
    }
    req.validated = validated;
    next();
  };
}

module.exports = { validate };
