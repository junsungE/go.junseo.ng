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
  const ip = req.headers["x-forwarded-for"] ? req.headers["x-forwarded-for"].split(",")[0].trim() : "Hidden";
  const country = req.headers["x-country"] || req.headers["cf-ipcountry"] || req.headers["x-client-geo-country"] || req.headers["client-ip-country"] || "Unknown";
  const lang = req.headers["accept-language"] ? req.headers["accept-language"].split(",")[0].trim() : "Unknown";
  const referrer = req.headers["referer"] || req.headers["referrer"] || "Direct";

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

    // Determine correct partition key for external links
    let partitionKey = scope === "internal" ? "internal" : "free";

    // Try both case-sensitive and insensitive versions (using encoded slug)
    let entity;
    try {
      entity = await table.getEntity(partitionKey, encodedSlug);
    } catch {
      // If free tier didn't work, try premium for external links
      if (scope === "external") {
        try {
          entity = await table.getEntity("premium", encodedSlug);
          partitionKey = "premium";
        } catch {
          // Still not found, try lowercase versions
        }
      }
      
      if (!entity) {
        const lowerSlug = slug.toLowerCase();
        const encodedLowerSlug = encodeURIComponent(lowerSlug);
        try {
          entity = await table.getEntity(partitionKey, encodedLowerSlug);
        } catch {
          // Try premium with lowercase if free didn't work
          if (scope === "external" && partitionKey === "free") {
            try {
              entity = await table.getEntity("premium", encodedLowerSlug);
            } catch {
              // Not found anywhere - log orphan visit
              await recordVisit(slug, ip, ua, country, lang, referrer, "notfound");
              context.res = {
                status: 302,
                headers: { Location: "/error" }
              };
              return;
            }
          } else {
            // Not found - log orphan visit
            await recordVisit(slug, ip, ua, country, lang, referrer, "notfound");
            context.res = {
              status: 302,
              headers: { Location: "/error" }
            };
            return;
          }
        }
      }
    }

    // Case sensitivity check
    if (entity.isCaseSensitive) {
      const storedSlug = entity.originalSlug || decodeURIComponent(entity.rowKey);
      if (storedSlug !== slug) {
        // Case mismatch - log orphan visit
        await recordVisit(slug, ip, ua, country, lang, referrer, "notfound");
        context.res = {
          status: 302,
          headers: { Location: "/error" }
        };
        return;
      }
    }

    // Check validity
    if (!isLinkActive(entity)) {
      // Link is inactive/expired - log orphan visit
      await recordVisit(slug, ip, ua, country, lang, referrer, "inactive");
      context.res = { status: 410, body: "This link is inactive or has expired." };
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
      let redirectUrl = entity.defaultUrl || entity.targetUrl;
      
      // Parse platformRedirects and langMap if stored as JSON strings
      let platformRedirects = entity.platformRedirects;
      let langMap = entity.langMap;
      
      if (typeof platformRedirects === 'string') {
        try { platformRedirects = JSON.parse(platformRedirects); } catch { platformRedirects = {}; }
      }
      if (typeof langMap === 'string') {
        try { langMap = JSON.parse(langMap); } catch { langMap = {}; }
      }
      
      platformRedirects = platformRedirects || {};
      langMap = langMap || {};

      // Detect platform from user-agent
      const userAgent = (req.headers["user-agent"] || "").toLowerCase();
      
      // Helper function to detect platform key from user-agent
      function detectPlatform(ua) {
        // Mobile detection (check mobile first as they're more specific)
        if (ua.includes("ipad")) return "ipados";
        if (ua.includes("iphone")) return "ios";
        if (ua.includes("android")) return "android";
        // Desktop detection
        if (ua.includes("cros")) return "chromeos";
        if (ua.includes("windows")) return "windows";
        if (ua.includes("mac")) return "macos";
        if (ua.includes("linux")) return "linux";
        return null;
      }

      const platform = detectPlatform(userAgent);

      // Check lang-locale based redirect first (takes priority)
      const acceptLanguage = req.headers["accept-language"] || "";
      let localeEntry = null;
      let matchedLocale = null;
      
      // Try exact match first, then prefix match
      for (const [locale, entry] of Object.entries(langMap)) {
        if (acceptLanguage.toLowerCase().startsWith(locale.toLowerCase())) {
          // Support both new nested format and legacy simple URL format
          if (typeof entry === 'object') {
            localeEntry = entry;
          } else if (typeof entry === 'string') {
            // Legacy format: simple URL string
            localeEntry = { main: entry };
          }
          matchedLocale = locale;
          break;
        }
      }

      if (localeEntry) {
        // First try platform-specific URL within the locale
        if (platform && localeEntry[platform]) {
          redirectUrl = localeEntry[platform];
        } else if (localeEntry.main) {
          // Fall back to locale's main URL
          redirectUrl = localeEntry.main;
        }
        // If no locale-specific URL found, fall through to global platform redirects
      }

      // If no locale-specific redirect applied, use global platform redirects
      if (!localeEntry || (!localeEntry.main && !localeEntry[platform])) {
        if (platform && platformRedirects[platform]) {
          redirectUrl = platformRedirects[platform];
        }
      }

      // Log visit and redirect
      await incrementVisit("InternalLinks", entity.rowKey, entity.partitionKey);
      await recordVisit(slug, ip, ua, country, lang, referrer);
      context.res = {
        status: 302,
        headers: { Location: redirectUrl }
      };
      return;
    }

    // External redirect (premium links also support conditional redirects)
    let redirectUrl = entity.targetUrl;
    
    // Parse platformRedirects and langMap if stored as JSON strings
    let platformRedirects = entity.platformRedirects;
    let langMap = entity.langMap;
    
    if (typeof platformRedirects === 'string') {
      try { platformRedirects = JSON.parse(platformRedirects); } catch { platformRedirects = {}; }
    }
    if (typeof langMap === 'string') {
      try { langMap = JSON.parse(langMap); } catch { langMap = {}; }
    }
    
    platformRedirects = platformRedirects || {};
    langMap = langMap || {};

    // Only apply conditional redirects for premium links
    if (entity.partitionKey === 'premium' && (Object.keys(platformRedirects).length > 0 || Object.keys(langMap).length > 0)) {
      const userAgent = (req.headers["user-agent"] || "").toLowerCase();
      
      // Helper function to detect platform key from user-agent
      function detectPlatformExternal(ua) {
        // Mobile detection (check mobile first as they're more specific)
        if (ua.includes("ipad")) return "ipados";
        if (ua.includes("iphone")) return "ios";
        if (ua.includes("android")) return "android";
        // Desktop detection
        if (ua.includes("cros")) return "chromeos";
        if (ua.includes("windows")) return "windows";
        if (ua.includes("mac")) return "macos";
        if (ua.includes("linux")) return "linux";
        return null;
      }

      const platform = detectPlatformExternal(userAgent);

      // Check lang-locale based redirect first (takes priority)
      const acceptLanguage = req.headers["accept-language"] || "";
      let localeEntry = null;
      
      // Try exact match first, then prefix match
      for (const [locale, entry] of Object.entries(langMap)) {
        if (acceptLanguage.toLowerCase().startsWith(locale.toLowerCase())) {
          // Support both new nested format and legacy simple URL format
          if (typeof entry === 'object') {
            localeEntry = entry;
          } else if (typeof entry === 'string') {
            // Legacy format: simple URL string
            localeEntry = { main: entry };
          }
          break;
        }
      }

      if (localeEntry) {
        // First try platform-specific URL within the locale
        if (platform && localeEntry[platform]) {
          redirectUrl = localeEntry[platform];
        } else if (localeEntry.main) {
          // Fall back to locale's main URL
          redirectUrl = localeEntry.main;
        }
      }

      // If no locale-specific redirect applied, use global platform redirects
      if (!localeEntry || (!localeEntry.main && !localeEntry[platform])) {
        if (platform && platformRedirects[platform]) {
          redirectUrl = platformRedirects[platform];
        }
      }
    }

    await incrementVisit("ExternalLinks", entity.rowKey, entity.partitionKey);
    await recordVisit(slug, ip, ua, country, lang, referrer);

    context.res = {
      status: 302,
      headers: { Location: redirectUrl }
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
