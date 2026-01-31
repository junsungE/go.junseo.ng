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
        // Individual slug stats - case insensitive search
        const slugLower = slug.toLowerCase();
        
        // Find all case variants of this slug in the links table
        const matchingSlugs = [];
        let primaryEntity = null;
        
        for await (const link of linkTable.listEntities({
          queryOptions: { filter: `PartitionKey eq '${partition}'` }
        })) {
          if (link.rowKey.toLowerCase() === slugLower) {
            matchingSlugs.push(link.rowKey);
            // Use the first match as primary entity for stats display
            if (!primaryEntity) {
              primaryEntity = link;
            }
          }
        }
        
        if (matchingSlugs.length === 0) {
          context.res = jsonResponse(404, { error: "Shortened URL not found." });
          return;
        }

        // Fetch visits for all case variants of this slug
        const visits = [];
        for await (const item of visitsTable.listEntities()) {
          // Case-insensitive match on partition key
          if (item.partitionKey.toLowerCase() === slugLower) {
            visits.push({
              slug: item.partitionKey, // Show actual case used when accessing
              timestamp: item.timestamp,
              ip: item.ip,
              userAgent: item.userAgent,
              country: item.country,
              language: item.language,
              referrer: item.referrer
            });
          }
        }
        
        // Sort by timestamp desc
        visits.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        context.res = jsonResponse(200, {
          slug,
          targetUrl: primaryEntity.targetUrl,
          title: primaryEntity.title,
          totalVisits: primaryEntity.visits || 0,
          visitLimit: primaryEntity.visitLimit || null,
          startDate: primaryEntity.startDate || null,
          expiryDate: primaryEntity.expiryDate || null,
          caseVariants: matchingSlugs, // Show all case variants found
          visits
        });
    } else {
        // All stats for a specific type
        // 1. Get all slugs for this type (store lowercase for case-insensitive matching)
        const slugsLower = new Set();
        const linkEntities = linkTable.listEntities({
            queryOptions: { filter: `PartitionKey eq '${partition}'` }
        });
        for await (const link of linkEntities) {
            slugsLower.add(link.rowKey.toLowerCase());
        }

        if (slugsLower.size === 0) {
            context.res = jsonResponse(200, { visits: [] });
            return;
        }

        // 2. Fetch ALL visits and filter by slug set (case-insensitive)
        // Optimization note: Scanning the entire Visits table can be slow if it's large.
        const allVisits = [];
        const visitEntities = visitsTable.listEntities();
        for await (const visit of visitEntities) {
            // Case-insensitive match
            if (slugsLower.has(visit.partitionKey.toLowerCase())) {
                allVisits.push({
                    slug: visit.partitionKey, // Show actual case used when accessing
                    timestamp: visit.timestamp,
                    ip: visit.ip,
                    userAgent: visit.userAgent,
                    country: visit.country,
                    language: visit.language,
                    referrer: visit.referrer
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
