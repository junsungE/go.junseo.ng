const { getTableClient, jsonResponse } = require("../shared.cjs");

module.exports = async function (context, req) {
  const method = req.method.toLowerCase();
  
  if (method === "options") {
    context.res = { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" } };
    return;
  }

  // Get email from query (GET) or body (POST)
  const email = (req.query && req.query.email) || (req.body && req.body.email);
  // Get type from query - 'internal' or 'premium' (default)
  const type = (req.query && req.query.type) || (req.body && req.body.type) || 'premium';

  if (!email) {
    context.res = jsonResponse(400, { error: "Missing email." });
    return;
  }

  try {
    let tableName, partitionKey;
    if (type === 'internal') {
      tableName = 'InternalLinks';
      partitionKey = 'internal';
    } else {
      tableName = 'ExternalLinks';
      partitionKey = 'premium';
    }

    const table = getTableClient(tableName);
    // Filter by partitionKey and createdBy = email
    const links = [];
    const entities = table.listEntities({
      queryOptions: { filter: `PartitionKey eq '${partitionKey}' and createdBy eq '${email}'` }
    });

    for await (const entity of entities) {
      // Parse tags from JSON string if present
      let parsedTags = null;
      if (entity.tags) {
        try {
          parsedTags = JSON.parse(entity.tags);
        } catch (e) {
          parsedTags = null;
        }
      }

      links.push({
        slug: entity.originalSlug || decodeURIComponent(entity.rowKey), // Fallback if originalSlug missing
        targetUrl: entity.targetUrl,
        createdAt: entity.createdAt,
        visits: entity.visits || 0,
        lastVisitedAt: entity.lastVisitedAt,
        expiryDate: entity.expiryDate,
        visitLimit: entity.visitLimit,
        isCaseSensitive: entity.isCaseSensitive,
        title: entity.title,
        tags: parsedTags,
        startDate: entity.startDate
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
