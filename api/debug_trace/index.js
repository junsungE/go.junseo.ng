import { getTableClient } from "../shared.js";

// Temporary verbose debug endpoint. Returns caught error details (stack included).
export default async function (context, req) {
  try {
    const table = getTableClient("InternalLinks");
    const id = `trace-${Date.now()}`;
    const now = new Date().toISOString();

    const entity = {
      partitionKey: "internal",
      rowKey: id,
      trace: true,
      createdAt: now
    };

    await table.createEntity(entity);

    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: { ok: true, id, createdAt: now }
    };
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    const stack = err && err.stack ? err.stack : null;

    if (context && context.log && typeof context.log.error === "function") {
      context.log.error("Debug trace error:", message);
      if (stack) context.log.error(stack);
    } else {
      console.error("Debug trace error:", message);
      if (stack) console.error(stack);
    }

    context.res = {
      status: 500,
      headers: { "Content-Type": "application/json" },
      body: { ok: false, error: message, stack }
    };
  }
}
