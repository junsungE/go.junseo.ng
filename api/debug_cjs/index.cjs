// Minimal CommonJS function to test module loading in the Functions host.
module.exports = async function (context, req) {
  try {
    const now = new Date().toISOString();
    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, now, runtime: process.version })
    };
  } catch (e) {
    context.log && context.log.error && context.log.error(e.stack || e);
    context.res = { status: 500, body: JSON.stringify({ ok: false, error: String(e) }) };
  }
};
