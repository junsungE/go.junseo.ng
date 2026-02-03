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
        // Encode the slug for comparison since Visits partitionKey is URL-encoded
        const encodedSlugLower = encodeURIComponent(slug).toLowerCase();
        
        // Find all case variants of this slug in the links table
        // Note: rowKey is URL-encoded in the table
        const matchingSlugs = [];
        let primaryEntity = null;
        
        for await (const link of linkTable.listEntities({
          queryOptions: { filter: `PartitionKey eq '${partition}'` }
        })) {
          if (link.rowKey.toLowerCase() === encodedSlugLower) {
            // Store decoded slug for display
            matchingSlugs.push(decodeURIComponent(link.rowKey));
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
        // Note: Visits partitionKey is URL-encoded
        const visits = [];
        for await (const item of visitsTable.listEntities()) {
          // Case-insensitive match on encoded partition key
          if (item.partitionKey.toLowerCase() === encodedSlugLower) {
            visits.push({
              slug: decodeURIComponent(item.partitionKey), // Decode for display
              timestamp: item.timestamp,
              ip: item.ip,
              userAgent: item.userAgent,
              country: item.country,
              language: item.language,
              referrer: item.referrer,
              sourceApp: item.sourceApp || null
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
        // Note: both rowKey and Visits partitionKey are URL-encoded
        const slugsLower = new Set();
        const linkEntities = linkTable.listEntities({
            queryOptions: { filter: `PartitionKey eq '${partition}'` }
        });
        for await (const link of linkEntities) {
            // Keep encoded for comparison with Visits partitionKey
            slugsLower.add(link.rowKey.toLowerCase());
        }

        if (slugsLower.size === 0) {
            context.res = jsonResponse(200, { visits: [] });
            return;
        }

        // 2. Fetch ALL visits and filter by slug set (case-insensitive)
        // Optimization note: Scanning the entire Visits table can be slow if it's large.
        // Note: Visits partitionKey is URL-encoded
        const allVisits = [];
        const visitEntities = visitsTable.listEntities();
        for await (const visit of visitEntities) {
            // Case-insensitive match on encoded partition key
            if (slugsLower.has(visit.partitionKey.toLowerCase())) {
                allVisits.push({
                    slug: decodeURIComponent(visit.partitionKey), // Decode for display
                    timestamp: visit.timestamp,
                    ip: visit.ip,
                    userAgent: visit.userAgent,
                    country: visit.country,
                    language: visit.language,
                    referrer: visit.referrer,
                    sourceApp: visit.sourceApp || null
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
