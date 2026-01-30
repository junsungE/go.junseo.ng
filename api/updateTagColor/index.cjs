const { getTableClient, jsonResponse } = require("../shared.cjs");

module.exports = async function (context, req) {
  const method = req.method.toLowerCase();
  
  if (method === "options") {
    context.res = { 
      status: 204, 
      headers: { 
        "Access-Control-Allow-Origin": "*", 
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      } 
    };
    return;
  }

  const { email, tagName, newColor, type } = req.body || {};

  if (!email || !tagName || !newColor) {
    context.res = jsonResponse(400, { error: "Missing required fields: email, tagName, newColor" });
    return;
  }

  // Validate color format (hex color)
  if (!/^#[0-9A-Fa-f]{6}$/.test(newColor)) {
    context.res = jsonResponse(400, { error: "Invalid color format. Use hex format like #0067c5" });
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
    const safeEmail = email.replace(/'/g, "''");
    
    // Find all links by this user
    const entities = table.listEntities({
      queryOptions: { filter: `PartitionKey eq '${partitionKey}' and createdBy eq '${safeEmail}'` }
    });

    let updatedCount = 0;
    const tagNameLower = tagName.toLowerCase();

    for await (const entity of entities) {
      if (!entity.tags) continue;

      let tags;
      try {
        tags = JSON.parse(entity.tags);
      } catch (e) {
        continue;
      }

      if (!Array.isArray(tags)) continue;

      // Check if this link has the tag we're looking for
      let hasTag = false;
      const updatedTags = tags.map(tag => {
        if (tag.name && tag.name.toLowerCase() === tagNameLower) {
          hasTag = true;
          return { ...tag, color: newColor };
        }
        return tag;
      });

      if (hasTag) {
        // Update the entity with new tag colors
        const updatedEntity = {
          partitionKey: entity.partitionKey,
          rowKey: entity.rowKey,
          tags: JSON.stringify(updatedTags)
        };

        await table.updateEntity(updatedEntity, "Merge");
        updatedCount++;
      }
    }

    context.res = jsonResponse(200, { 
      success: true, 
      message: `Updated ${updatedCount} link(s) with the new tag color.`,
      updatedCount 
    });

  } catch (error) {
    context.log.error("Error updating tag color:", error);
    context.res = jsonResponse(500, { error: "Failed to update tag color." });
  }
};
