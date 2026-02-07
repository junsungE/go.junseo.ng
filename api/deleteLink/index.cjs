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

  const { slug, email, type } = req.body || {};

  if (!slug || !email) {
    context.res = jsonResponse(400, { error: "Missing slug or email." });
    return;
  }

  try {
    let tableName, partitionKey;
    if (type === "internal") {
      tableName = "InternalLinks";
      partitionKey = "internal";
    } else {
      tableName = "ExternalLinks";
      partitionKey = "premium";
    }

    const table = getTableClient(tableName);
    const encodedSlug = encodeURIComponent(slug);

    // Fetch the entity first to verify ownership
    let entity;
    try {
      entity = await table.getEntity(partitionKey, encodedSlug);
    } catch (err) {
      context.res = jsonResponse(404, { error: "Link not found." });
      return;
    }

    // Verify that the requesting user owns this link
    if (entity.createdBy !== email) {
      context.res = jsonResponse(403, { error: "You do not have permission to delete this link." });
      return;
    }

    // Delete the entity
    await table.deleteEntity(partitionKey, encodedSlug);

    context.res = jsonResponse(200, { success: true, message: `Slug "${slug}" deleted successfully.` });
  } catch (error) {
    context.log.error("Error deleting link:", error);
    context.res = jsonResponse(500, { error: "Failed to delete the link." });
  }
};
