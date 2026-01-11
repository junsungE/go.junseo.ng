const { getTableClient, jsonResponse } = require("../shared.cjs");

module.exports = async function (context, req) {
  const { userId, secret } = req.body || {};
  
  // prompt user to set ADMIN_SECRET in local.settings.json or app settings
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
      context.res = jsonResponse(401, { error: "Unauthorized" });
      return;
  }

  if (!userId) {
    context.res = jsonResponse(400, { error: "Missing userId." });
    return;
  }

  try {
    const usersTable = getTableClient("Users");
    
    // Retrieve the entity first. PartitionKey is "Users" based on our new design
    const user = await usersTable.getEntity("Users", userId);
    
    // Update status
    user.status = "approved";
    
    await usersTable.updateEntity(user);

    context.res = jsonResponse(200, { message: `User ${user.displayName} (${user.email}) approved.` });

  } catch (err) {
    if (err.statusCode === 404) {
        context.res = jsonResponse(404, { error: "User not found." });
    } else {
        context.res = jsonResponse(500, { error: err.message });
    }
  }
};
