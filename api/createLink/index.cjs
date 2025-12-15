const { getTableClient, normalizeSlug, jsonResponse, uuidv4, generateRandomSlug } = require("../shared.cjs");

module.exports = async function (context, req) {
  const body = req.body || {};
  context.log && context.log.info && context.log.info('createLink request body:', JSON.stringify(req.body));

  let {
    type = "external", // internal | external | premium
    slug,
    targetUrl,
    mode = "public",
    password,
    platformRedirects = {},
    geoMap = {},
    langMap = {},
    startDate,
    expiryDate,
    visitLimit,
    title,
    isCaseSensitive = false,
    createdBy = "anonymous"
  } = body;

  if (!targetUrl) {
    context.res = jsonResponse(400, { error: "Missing target URL." });
    return;
  }

  try {
    let tableName;
    let partitionKey;
    switch (type) {
      case "internal":
        tableName = "InternalLinks";
        partitionKey = "internal";
        break;
      case "premium":
      case "external":
      default:
        tableName = "ExternalLinks";
        partitionKey = type === "premium" ? "premium" : "free";
        break;
    }
    
    // Force case-sensitive for external free URLs
    if (type === "external" && partitionKey === "free") {
      isCaseSensitive = true;
    }
    
    // Force case-sensitive for external premium URLs
    if (type === "premium" && partitionKey === "premium") {
      isCaseSensitive = true;
    }

    const table = getTableClient(tableName);

    let finalSlug =
      slug && slug.trim() !== ""
        ? normalizeSlug(slug, isCaseSensitive)
        : ((type === "external" && partitionKey === "free") || (type === "premium" && partitionKey === "premium")
            ? generateRandomSlug(5, 7) 
            : uuidv4().substring(0, 6));

    // URL-encode slug for Azure Table Storage (RowKey doesn't allow / \ # ?)
    const encodedSlug = encodeURIComponent(finalSlug);

    // Check if slug already exists
    try {
      await table.getEntity(partitionKey, encodedSlug);
      context.res = jsonResponse(409, {
        error: "Slug already exists. Choose another."
      });
      return;
    } catch {
      // ok, slug is new
    }

    const entity = {
      partitionKey,
      rowKey: encodedSlug,
      originalSlug: finalSlug,
      targetUrl,
      defaultUrl: targetUrl,
      mode,
      password,
      createdAt: new Date().toISOString(),
      createdBy,
      platformRedirects,
      geoMap,
      langMap,
      startDate,
      expiryDate,
      visitLimit: visitLimit ? parseInt(visitLimit) : null,
      visits: 0,
      title,
      isCaseSensitive
    };

    // Table storage doesn't accept complex objects; serialize maps to JSON strings
    if (entity.platformRedirects && typeof entity.platformRedirects === 'object') {
      entity.platformRedirects = JSON.stringify(entity.platformRedirects);
    }
    if (entity.geoMap && typeof entity.geoMap === 'object') {
      entity.geoMap = JSON.stringify(entity.geoMap);
    }
    if (entity.langMap && typeof entity.langMap === 'object') {
      entity.langMap = JSON.stringify(entity.langMap);
    }

    await table.createEntity(entity);

    // Build fallback base URL from request host when DOMAIN is not set
    const envDomain = process.env.DOMAIN && process.env.DOMAIN.trim();
    const hostHeader = (req && (req.headers && (req.headers['x-forwarded-host'] || req.headers['host']))) || "";
    const siteHost = envDomain || hostHeader.replace(/^https?:\/\//i, "");
    const base = siteHost ? `https://${siteHost}` : "";

    context.res = jsonResponse(200, {
      message: "Shortened URL created successfully.",
      slug: finalSlug,
      fullUrl:
        type === "internal"
          ? (base ? `${base}/${finalSlug}` : finalSlug)
          : (base ? `${base}/ext/${finalSlug}` : `ext/${finalSlug}`)
    });
  } catch (err) {
    // Log full error (stack if available) for diagnostics
    if (context && context.log && typeof context.log.error === "function") {
      context.log.error("Error creating link:", err && (err.stack || err.message || err));
    } else {
      console.error("Error creating link:", err && (err.stack || err.message || err));
    }

    // Return minimal error details to the client to aid debugging (remove in production)
    const detail = err && err.message ? err.message : "Unknown server error";
    context.res = jsonResponse(500, { error: "Server error.", details: detail });
  }
};
