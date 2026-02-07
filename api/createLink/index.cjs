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
    tags,
    isCaseSensitive = false,
    createdBy = "anonymous",
    origin, // Frontend will send window.location.origin
    clientToday
  } = body;

  if (!targetUrl) {
    context.res = jsonResponse(400, { error: "Missing target URL." });
    return;
  }

  // Normalize URL: auto-prepend https:// if no valid URI scheme detected
  try {
    new URL(targetUrl);
  } catch {
    targetUrl = "https://" + targetUrl;
  }

  // Validate URL format
  try {
    new URL(targetUrl);
  } catch {
    context.res = jsonResponse(400, { error: "Invalid target URL. Please provide a valid URL (e.g., https://example.com)." });
    return;
  }

  const isValidDate = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

  // Use client's local date for "today", with a sanity check (must be within 26 hours of server UTC)
  const serverUtcIso = new Date().toISOString().split("T")[0];
  let baselineToday = serverUtcIso;
  if (isValidDate(clientToday)) {
    const diff = Math.abs(new Date(clientToday) - new Date(serverUtcIso));
    if (diff <= 26 * 60 * 60 * 1000) {
      baselineToday = clientToday;
    }
  }

  if (startDate && (!isValidDate(startDate) || startDate < baselineToday)) {
    context.res = jsonResponse(400, { error: "Start date must be today or later." });
    return;
  }

  if (expiryDate && (!isValidDate(expiryDate) || expiryDate < baselineToday)) {
    context.res = jsonResponse(400, { error: "Expiry date must be today or later." });
    return;
  }

  if (startDate && expiryDate && expiryDate <= startDate) {
    context.res = jsonResponse(400, { error: "Expiry date must be later than the start date." });
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
         tableName = "ExternalLinks";
         partitionKey = "premium";
 
         // Security check: Verify user is approved
         if (!createdBy || createdBy === "anonymous") {
             context.res = jsonResponse(401, { error: "Login required for premium links." });
             return;
         }
 
         const usersTable = getTableClient("Users");
         const safeEmail = createdBy.replace(/'/g, "''");
         const userFilter = `PartitionKey eq 'Users' and email eq '${safeEmail}'`;
         
         const userIterator = usersTable.listEntities({ queryOptions: { filter: userFilter } });
         let verifiedUser = null;
         for await (const u of userIterator) {
             verifiedUser = u;
             break;
         }
 
         if (!verifiedUser) {
              context.res = jsonResponse(403, { error: "User identity verification failed." });
              return;
         }
         
         if (verifiedUser.status !== 'approved') {
              context.res = jsonResponse(403, { error: "Account must be approved to create premium links." });
              return;
         }
         break;
      case "external":
      default:
        tableName = "ExternalLinks";
        partitionKey = "free";
        break;
    }
    
    // Force case-sensitive for external free URLs
    if (type === "external" && partitionKey === "free") {
      isCaseSensitive = true;
    }
    
    // For premium: Force case-sensitive ONLY if generating a random slug (no custom slug provided)
    // If custom slug is provided, respect the isCaseSensitive flag from request.
    const isCustomSlug = slug && slug.trim() !== "";
    if (type === "premium" && partitionKey === "premium" && !isCustomSlug) {
      isCaseSensitive = true;
    }

    const table = getTableClient(tableName);

    let finalSlug =
      slug && slug.trim() !== ""
        ? normalizeSlug(slug, isCaseSensitive)
        : ((type === "external" && partitionKey === "free") || (type === "premium" && partitionKey === "premium")
            ? generateRandomSlug(5, 7) 
            : uuidv4().substring(0, 6));

    const lowerSlug = finalSlug.toLowerCase();
    const encodedFinalSlug = encodeURIComponent(finalSlug);
    const encodedLowerSlug = encodeURIComponent(lowerSlug);

    // Conflict Check:
    // 1. Exact match check (always blocked)
    try {
      await table.getEntity(partitionKey, encodedFinalSlug);
      context.res = jsonResponse(409, {
        error: "Slug already exists. Choose another."
      });
      return;
    } catch {
      // OK
    }

    // 2. Case-sensitivity overlap checks
    if (isCaseSensitive) {
      // Check if a non-case-sensitive version already exists at the lowercase slot
      if (encodedFinalSlug !== encodedLowerSlug) {
        try {
          const lowerEntity = await table.getEntity(partitionKey, encodedLowerSlug);
          if (lowerEntity.isCaseSensitive === false || lowerEntity.isCaseSensitive === "false") {
            context.res = jsonResponse(409, {
              error: "A non-case-sensitive version of this slug already exists."
            });
            return;
          }
        } catch {
          // OK
        }
      }
    } else {
      // Creating a non-case-sensitive link: Must ensure NO variations exist.
      // Check lowercase slot first
      try {
        await table.getEntity(partitionKey, encodedLowerSlug);
        context.res = jsonResponse(409, {
          error: "Slug namespace taken. To create a non-case-sensitive link, no other variations can exist."
        });
        return;
      } catch {
        // OK
      }

      // Scan for variations (to catch things like "Test" when creating "test")
      // This uses the 'slugLower' property which we will store from now on.
      const filter = `PartitionKey eq '${partitionKey}' and slugLower eq '${lowerSlug.replace(/'/g, "''")}'`;
      const entities = table.listEntities({ queryOptions: { filter } });
      for await (const _ of entities) {
        context.res = jsonResponse(409, {
          error: "Case-sensitive variations of this slug already exist. Non-case-sensitive links require a unique namespace."
        });
        return;
      }
    }

    const entity = {
      partitionKey,
      rowKey: encodedFinalSlug, // Store using exact casing (CS/Non-CS)
      originalSlug: finalSlug,
      slugLower: lowerSlug, // Added for case-insensitive collision checks
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
      tags: tags && Array.isArray(tags) ? JSON.stringify(tags) : null,
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

    // Build base URL - prefer origin from frontend (most accurate)
    // Security: Validate against allowlist to prevent spoofing
    const trustedDomains = (process.env.TRUSTED_DOMAINS || "go.junseo.ng,gentle-bush-0a1f4bd03.3.azurestaticapps.net")
      .split(",")
      .map(d => d.trim().toLowerCase());
    
    let base;
    
    if (origin) {
      // Frontend sent origin - validate it's trusted
      const originHostMatch = origin.match(/^https?:\/\/([^/:]+)/);
      if (originHostMatch) {
        const originHost = originHostMatch[1].toLowerCase();
        const isOriginTrusted = trustedDomains.some(trusted => 
          originHost === trusted || originHost.endsWith("." + trusted)
        );
        if (isOriginTrusted) {
          base = origin;
        }
      }
    }
    
    // Fallback to header detection if origin not provided or not trusted
    if (!base) {
      const proto = req.headers["x-forwarded-proto"] || "https";
      const detectedHost = req.headers["host"] || req.headers["x-forwarded-host"] || req.headers["x-ms-original-host"];
      const hostWithoutPort = (detectedHost || "").split(":")[0].toLowerCase();
      const isTrusted = trustedDomains.some(trusted => 
        hostWithoutPort === trusted || hostWithoutPort.endsWith("." + trusted)
      );
      const host = isTrusted ? detectedHost : trustedDomains[0];
      base = `${proto}://${host}`;
    }

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
