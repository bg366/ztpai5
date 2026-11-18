const { randomUUID } = require("node:crypto");

function requestLogger(logger) {
  return (req, res, next) => {
    const started = process.hrtime.bigint();
    req.requestId = req.get("X-Request-Id") || randomUUID();
    res.set("X-Request-Id", req.requestId);

    res.on("finish", () => {
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      logger.info(
        `[${req.requestId}] ${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)} ms`,
      );
    });
    next();
  };
}

module.exports = { requestLogger };
