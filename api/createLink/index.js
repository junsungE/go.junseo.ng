import { getTableClient, normalizeSlug, jsonResponse } from "../shared.js";
import { v4 as uuidv4 } from "uuid";

export default async function (context, req) {
  const body = req.body || {};

  const {
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

    const table = getTableClient(tableName);

    let finalSlug =
      slug && slug.trim() !== ""
        ? normalizeSlug(slug, isCaseSensitive)
        : uuidv4().substring(0, 6);

    // Check if slug already exists
    try {
      await table.getEntity(partitionKey, finalSlug);
      context.res = jsonResponse(409, {
        error: "Slug already exists. Choose another."
      });
      return;
    } catch {
      // ok, slug is new
    }

    const entity = {
      partitionKey,
      rowKey: finalSlug,
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

    await table.createEntity(entity);

    context.res = jsonResponse(200, {
      message: "Shortened URL created successfully.",
      slug: finalSlug,
      fullUrl:
        type === "internal"
          ? `https://${process.env.DOMAIN}/${finalSlug}`
          : `https://${process.env.DOMAIN}/ext/${finalSlug}`
    });
  } catch (err) {
    context.log.error("Error creating link:", err.message);
    context.res = jsonResponse(500, { error: "Server error." });
  }
}
