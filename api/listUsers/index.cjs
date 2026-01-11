const { getTableClient, jsonResponse } = require("../shared.cjs");

module.exports = async function (context, req) {
  const { secret } = req.body || {};

  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    context.res = jsonResponse(401, { error: "Unauthorized" });
    return;
  }

  try {
    const usersTable = getTableClient("Users");
    const usersIterator = usersTable.listEntities({
      queryOptions: { filter: "PartitionKey eq 'Users'" }
    });

    const users = [];
    for await (const user of usersIterator) {
      users.push({
        id: user.rowKey,
        displayName: user.displayName,
        email: user.email,
        status: user.status,
        lastSignin: user.lastSignin || "Never",
        approvalRequestedAt: user.approvalRequestedAt
      });
    }

    // Sort by approvalRequestedAt descending
    users.sort((a, b) => new Date(b.approvalRequestedAt || 0) - new Date(a.approvalRequestedAt || 0));

    context.res = jsonResponse(200, users);
  } catch (err) {
    context.log.error("listUsers error:", err.message);
    context.res = jsonResponse(500, { error: "Server error." });
  }
};
