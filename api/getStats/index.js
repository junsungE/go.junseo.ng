import { getTableClient, jsonResponse } from "../shared.js";

export default async function (context, req) {
  const slug = req.query.slug;
  const type = req.query.type || "external"; // internal | external | premium

  if (!slug) {
    context.res = jsonResponse(400, { error: "Missing slug parameter." });
    return;
  }

  try {
    const mainTable =
      type === "internal" ? "InternalLinks" : "ExternalLinks";
    const visitsTable = getTableClient("Visits");
    const linkTable = getTableClient(mainTable);

    // Get link details
    let entity;
    try {
      const partition = type === "internal" ? "internal" : type;
      entity = await linkTable.getEntity(partition, slug);
    } catch {
      context.res = jsonResponse(404, { error: "Shortened URL not found." });
      return;
    }

    // Fetch visits
    const visits = [];
    for await (const item of visitsTable.listEntities({
      queryOptions: { filter: `PartitionKey eq '${slug}'` }
    })) {
      visits.push({
        timestamp: item.timestamp,
        ip: item.ip,
        userAgent: item.userAgent,
        country: item.country
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
  } catch (err) {
    context.log.error("Error retrieving stats:", err.message);
    context.res = jsonResponse(500, { error: "Server error." });
  }
}
