const { getTableClient, isLinkActive, recordVisit, incrementVisit, normalizeSlug } = require("../shared.cjs");

module.exports = async function (context, req) {
  // Get original URL - Azure SWA passes this when using navigationFallback
  const originalUrl = req.headers["x-ms-original-url"] || req.url || "";
  
  // Extract the path from URL
  let urlPath = "";
  try {
    const url = new URL(originalUrl);
    urlPath = url.pathname;
  } catch {
    // Fallback: just remove protocol+host if URL parsing fails
    urlPath = originalUrl.replace(/^https?:\/\/[^\/]+/, "");
  }
  
  // Debug mode - return request info
  if (req.query.debug === "1") {
    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: req.query,
        url: req.url,
        originalUrl: originalUrl,
        urlPath: urlPath,
        headers: Object.keys(req.headers),
        method: req.method
      }, null, 2)
    };
    return;
  }
  
  // Determine scope and extract slug from path
  let scope = "internal";
  let slug = "";
  
  // Check if it's an external link (starts with /ext/)
  if (urlPath.startsWith("/ext/")) {
    scope = "external";
    slug = urlPath.replace("/ext/", "").split("?")[0];
  } else {
    // Internal link - just remove leading slash
    slug = urlPath.replace(/^\//, "").split("?")[0];
  }
  
  // Also allow query param override
  if (req.query.slug) {
    slug = req.query.slug;
  }
  if (req.query.scope) {
    scope = req.query.scope;
  }
  
  const ua = req.headers["user-agent"] || "Unknown";
  const ip = req.headers["x-forwarded-for"] ? req.headers["x-forwarded-for"].split(",")[0] : "Hidden";

  if (!slug) {
    context.res = { status: 400, body: "Missing slug." };
    return;
  }

  // URL-encode slug for Azure Table lookup (stored encoded)
  const encodedSlug = encodeURIComponent(slug);

  try {
    const tableName =
      scope === "internal"
        ? "InternalLinks"
        : scope === "external"
        ? "ExternalLinks"
        : "ExternalLinks";

    const table = getTableClient(tableName);

    // Try both case-sensitive and insensitive versions (using encoded slug)
    let entity;
    try {
      entity = await table.getEntity(scope, encodedSlug);
    } catch {
      const lowerSlug = slug.toLowerCase();
      const encodedLowerSlug = encodeURIComponent(lowerSlug);
      try {
        entity = await table.getEntity(scope, encodedLowerSlug);
      } catch {
        //context.res = { status: 404, body: "Shortened URL not found." };
        // Redirect to a friendly error page instead of returning plain text
        context.res = {
          status: 302,
          headers: { Location: "/error" }
        };
        return;
      }
    }

    // Check validity
    if (!isLinkActive(entity)) {
      context.res = { status: 410, body: "This link has expired or is inactive." };
      return;
    }

    // Internal link handling
    if (scope === "internal") {
      const mode = entity.mode || "public";
      if (mode === "private") {
        context.res = {
          status: 401,
          body: "Private link. Please log in to access."
        };
        return;
      }

      if (mode === "protected") {
        const password = req.query.pw;
        if (!password || password !== entity.password) {
          context.res = { status: 403, body: "Incorrect or missing password." };
          return;
        }
      }

      // Conditional redirects
      const deviceType = req.headers["user-agent"] ? req.headers["user-agent"].toLowerCase() : "";
      const country = req.headers["x-country"] || "Unknown";
      const lang = req.headers["accept-language"] ? req.headers["accept-language"].split(",")[0] : "Unknown";

      let redirectUrl = entity.defaultUrl;

      // Device/platform-based redirect
      if (deviceType.includes("android") && entity.androidUrl)
        redirectUrl = entity.androidUrl;
      else if (deviceType.includes("iphone") && entity.iosUrl)
        redirectUrl = entity.iosUrl;
      else if (deviceType.includes("windows") && entity.windowsUrl)
        redirectUrl = entity.windowsUrl;
      else if (deviceType.includes("mac") && entity.macosUrl)
        redirectUrl = entity.macosUrl;
      else if (deviceType.includes("linux") && entity.linuxUrl)
        redirectUrl = entity.linuxUrl;

      // Geo/language conditions
      if (entity.geoMap && entity.geoMap[country])
        redirectUrl = entity.geoMap[country];
      if (entity.langMap && entity.langMap[lang])
        redirectUrl = entity.langMap[lang];

      // Log visit and redirect
      await incrementVisit("InternalLinks", slug);
      await recordVisit(slug, ip, ua, country);
      context.res = {
        status: 302,
        headers: { Location: redirectUrl }
      };
      return;
    }

    // External redirect
    await incrementVisit("ExternalLinks", slug);
    await recordVisit(slug, ip, ua);

    context.res = {
      status: 302,
      headers: { Location: entity.targetUrl }
    };
  } catch (err) {
    if (context && context.log && typeof context.log.error === "function") {
      context.log.error("Redirect error:", err.message);
    } else {
      console.error("Redirect error:", err.message);
    }
    context.res = { status: 500, body: "Server error." };
  }
};
