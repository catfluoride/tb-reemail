"use strict";
(async () => {
  console.info("[VALARM editor] Starting v0.5.0");
  try {
    const ok = await messenger.valarmEditor.install();
    console.info("[VALARM editor] Window listener registered:", ok);
  } catch (error) {
    console.error("[VALARM editor] Extension initialization failed", error, error?.stack);
  }
})();
