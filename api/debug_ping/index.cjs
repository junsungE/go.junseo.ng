// Minimal CommonJS health endpoint for the Functions host.
try {
  console.log('[debug_ping.cjs] module loaded', { version: process.version });
} catch (e) {
  try { console.error('[debug_ping.cjs] module-load error', String(e)); } catch (_) {}
}

module.exports = async function (context, req) {
  console.log('[debug_ping.cjs] handler invoked');
  try {
    const now = new Date().toISOString();
    const payload = {
      ok: true,
      now,
      node_version: process.version,
      storage_present: !!process.env.STORAGE_CONN,
      domain_env: process.env.DOMAIN || null,
      module_loaded: true,
      handler: 'cjs'
    };
    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    };
  } catch (err) {
    console.error('[debug_ping.cjs] handler error', err && err.stack ? err.stack : String(err));
    const message = err && err.message ? err.message : String(err);
    context.res = {
      status: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: message })
    };
  }
};
