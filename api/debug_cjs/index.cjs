// Minimal CommonJS function to test module loading in the Functions host.
try {
  console.log('[debug_cjs] module loaded', { version: process.version });
} catch (modErr) {
  try { console.error('[debug_cjs] module-load error', String(modErr)); } catch (_) {}
}

module.exports = async function (context, req) {
  console.log('[debug_cjs] handler invoked', { method: req && req.method });
  try {
    const now = new Date().toISOString();
    const payload = { ok: true, now, runtime: process.version, handler: 'cjs' };
    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    };
  } catch (e) {
    console.error('[debug_cjs] handler error', e && e.stack ? e.stack : String(e));
    context.log && context.log.error && context.log.error(e.stack || e);
    context.res = {
      status: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: String(e) })
    };
  }
};
