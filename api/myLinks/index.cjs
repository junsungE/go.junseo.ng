const { getTableClient, jsonResponse } = require("../shared.cjs");

module.exports = async function (context, req) {
  const method = req.method.toLowerCase();
  
  if (method === "options") {
    context.res = { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" } };
    return;
  }

  // Get email from query (GET) or body (POST)
  const email = (req.query && req.query.email) || (req.body && req.body.email);

  if (!email) {
    context.res = jsonResponse(400, { error: "Missing email." });
    return;
  }

  try {
    const table = getTableClient("ExternalLinks");
    // Filter by partitionKey = 'premium' and createdBy = email
    const links = [];
    const entities = table.listEntities({
      queryOptions: { filter: `PartitionKey eq 'premium' and createdBy eq '${email}'` }
    });

    for await (const entity of entities) {
      links.push({
        slug: entity.originalSlug || decodeURIComponent(entity.rowKey), // Fallback if originalSlug missing
        targetUrl: entity.targetUrl,
        createdAt: entity.createdAt,
        visits: entity.visits || 0,
        lastVisitedAt: entity.lastVisitedAt,
        expiryDate: entity.expiryDate,
        visitLimit: entity.visitLimit,
        isCaseSensitive: entity.isCaseSensitive,
        title: entity.title
      });
    }

    // Sort by createdAt desc
    links.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    context.res = jsonResponse(200, links);
  } catch (error) {
    context.log.error("Error listing links:", error);
    context.res = jsonResponse(500, { error: "Failed to list links." });
  }
};
