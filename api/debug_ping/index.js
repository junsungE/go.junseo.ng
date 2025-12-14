// Minimal, no-dependency health endpoint to verify Functions host.
export default async function (context, req) {
  const now = new Date().toISOString();
  context.res = {
    status: 200,
    headers: { "Content-Type": "application/json" },
    body: {
      ok: true,
      now,
      storage_present: !!process.env.STORAGE_CONN,
      domain_env: process.env.DOMAIN || null
    }
  };
}
