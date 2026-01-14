const { getTableClient, jsonResponse } = require("../shared.cjs");

module.exports = async function (context, req) {
    const { targetUrl, createdBy, type } = req.body || {};

    if (!targetUrl || !createdBy || !type) {
        context.res = jsonResponse(400, { error: "Missing required parameters: targetUrl, createdBy, type." });
        return;
    }

    try {
        const tableName = (type === "internal") ? "InternalLinks" : "ExternalLinks";
        const partitionKey = (type === "internal") ? "internal" : "premium";
        const table = getTableClient(tableName);

        const safeUrl = targetUrl.replace(/'/g, "''");
        const safeUser = createdBy.replace(/'/g, "''");
        
        // Filter by PartitionKey (scope), targetUrl, and createdBy (user)
        const filter = `PartitionKey eq '${partitionKey}' and targetUrl eq '${safeUrl}' and createdBy eq '${safeUser}'`;
        
        const entities = table.listEntities({
            queryOptions: { filter }
        });

        const slugList = [];
        for await (const entity of entities) {
            // Use originalSlug if available, else decode RowKey
            const slug = entity.originalSlug || decodeURIComponent(entity.rowKey);
            slugList.push(slug);
        }

        context.res = jsonResponse(200, { 
            exists: slugList.length > 0,
            slugs: slugList
        });
    } catch (err) {
        context.log.error("Error checking for existing Target URL:", err);
        context.res = jsonResponse(500, { error: "Server error." });
    }
};
