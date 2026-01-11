const { getTableClient, jsonResponse } = require("../shared.cjs");

module.exports = async function (context, req) {
  const { userId } = req.body || {};

  if (!userId) {
    context.res = jsonResponse(400, { error: "Missing userId." });
    return;
  }

  try {
    const usersTable = getTableClient("Users");
    
    // Retrieve user
    const user = await usersTable.getEntity("Users", userId);

    if (user.status === "approved") {
        context.res = jsonResponse(200, { message: "Already approved." });
        return;
    }

    if (user.status === "pending") {
         context.res = jsonResponse(200, { message: "Already pending approval." });
         return;
    }

    // Update status to pending
    user.status = "pending";
    user.approvalRequestedAt = new Date().toISOString(); 
    
    await usersTable.updateEntity(user);

    context.res = jsonResponse(200, { message: "Approval requested.", status: "pending" });

  } catch (err) {
    if (err.statusCode === 404) {
        context.res = jsonResponse(404, { error: "User not found." });
    } else {
        context.res = jsonResponse(500, { error: err.message });
    }
  }
};
