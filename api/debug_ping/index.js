// Minimal, no-dependency health endpoint to verify Functions host.
export default async function (context, req) {
  try {
    const now = new Date().toISOString();
    const payload = {
      ok: true,
      now,
      node_version: process.version,
      storage_present: !!process.env.STORAGE_CONN,
      domain_env: process.env.DOMAIN || null
    };
    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    };
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    context.res = {
      status: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: message })
    };
  }
}
