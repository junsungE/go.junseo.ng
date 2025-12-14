const { getTableClient } = require("../shared.cjs");

module.exports = async function (context, req) {
  try {
    const table = getTableClient("InternalLinks");
    const id = `debug-test-${Date.now()}`;
    const now = new Date().toISOString();

    const entity = {
      partitionKey: "internal",
      rowKey: id,
      debug: true,
      createdAt: now
    };

    await table.createEntity(entity);

    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, id, createdAt: now })
    };
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    const stack = err && err.stack ? err.stack : null;
    // Log on server
    if (context && context.log && typeof context.log.error === "function") {
      context.log.error("Debug create-test error:", message);
      if (stack) context.log.error(stack);
    } else {
      console.error("Debug create-test error:", message);
      if (stack) console.error(stack);
    }

    // Return masked error info (no keys)
    context.res = {
      status: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: message })
    };
  }
};
