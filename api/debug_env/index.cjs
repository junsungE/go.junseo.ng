module.exports = async function (context, req) {
  try {
    const storage = process.env.STORAGE_CONN || null;
    let accountName = null;
    if (storage) {
      const m = storage.match(/AccountName=([^;]+)/i);
      if (m) accountName = m[1];
    }

    const domain = process.env.DOMAIN || null;
    const hostHeader = (req && req.headers && (req.headers['x-forwarded-host'] || req.headers.host)) || null;

    let pkg = {};
    try {
      pkg = require('../package.json');
      pkg = { name: pkg.name, version: pkg.version };
    } catch {}

    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storage_present: !!storage,
        storage_account: accountName ? accountName : null,
        domain_env: domain,
        host_header: hostHeader,
        package: pkg
      })
    };
  } catch (err) {
    context.log && context.log.error && context.log.error('Debug endpoint error:', err && (err.stack || err.message || err));
    context.res = { status: 500, body: 'Debug endpoint error.' };
  }
};
