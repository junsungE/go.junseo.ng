const { getTableClient, jsonResponse } = require("../shared.cjs");

module.exports = async function (context, req) {
  const slug = req.query.slug;
  const type = req.query.type || "external"; // internal | premium | free

  try {
    const mainTable = (type === "internal") ? "InternalLinks" : "ExternalLinks";
    const visitsTable = getTableClient("Visits");
    const linkTable = getTableClient(mainTable);
    const partition = (type === "internal") ? "internal" : type;

    if (slug) {
        // Individual slug stats
        let entity;
        try {
          entity = await linkTable.getEntity(partition, slug);
        } catch {
          context.res = jsonResponse(404, { error: "Shortened URL not found." });
          return;
        }

        // Fetch visits for this slug
        const visits = [];
        for await (const item of visitsTable.listEntities({
          queryOptions: { filter: `PartitionKey eq '${slug.replace(/'/g, "''")}'` }
        })) {
          visits.push({
            slug: item.partitionKey,
            timestamp: item.timestamp,
            ip: item.ip,
            userAgent: item.userAgent,
            country: item.country,
            language: item.language
          });
        }

        context.res = jsonResponse(200, {
          slug,
          targetUrl: entity.targetUrl,
          title: entity.title,
          totalVisits: entity.visits || 0,
          visitLimit: entity.visitLimit || null,
          startDate: entity.startDate || null,
          expiryDate: entity.expiryDate || null,
          visits
        });
    } else {
        // All stats for a specific type
        // 1. Get all slugs for this type
        const slugs = new Set();
        const linkEntities = linkTable.listEntities({
            queryOptions: { filter: `PartitionKey eq '${partition}'` }
        });
        for await (const link of linkEntities) {
            slugs.add(link.rowKey);
        }

        if (slugs.size === 0) {
            context.res = jsonResponse(200, { visits: [] });
            return;
        }

        // 2. Fetch ALL visits and filter by slug set (In-memory filtering for simplicity)
        // Optimization note: Scanning the entire Visits table can be slow if it's large.
        const allVisits = [];
        const visitEntities = visitsTable.listEntities();
        for await (const visit of visitEntities) {
            if (slugs.has(visit.partitionKey)) {
                allVisits.push({
                    slug: decodeURIComponent(visit.partitionKey),
                    timestamp: visit.timestamp,
                    ip: visit.ip,
                    userAgent: visit.userAgent,
                    country: visit.country,
                    language: visit.language
                });
            }
        }

        // Sort by timestamp desc
        allVisits.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        context.res = jsonResponse(200, { visits: allVisits });
    }
  } catch (err) {
    if (context && context.log && typeof context.log.error === "function") {
      context.log.error("Error retrieving stats:", err.message);
    } else {
      console.error("Error retrieving stats:", err.message);
    }
    context.res = jsonResponse(500, { error: "Server error." });
  }
};
