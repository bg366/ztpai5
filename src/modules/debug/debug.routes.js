const { Router } = require("express");

// Tymczasowy endpoint do pokazania obsługi nieoczekiwanego błędu 500.
function createDebugRouter() {
  const router = Router();
  router.get("/crash", () => {
    throw new Error("boom");
  });
  return router;
}

module.exports = { createDebugRouter };
