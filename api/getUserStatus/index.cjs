const { getTableClient, jsonResponse } = require("../shared.cjs");

module.exports = async function (context, req) {
  const userId = req.query.userId;

  if (!userId) {
    context.res = jsonResponse(400, { error: "Missing userId." });
    return;
  }

  try {
    const usersTable = getTableClient("Users");
    const user = await usersTable.getEntity("Users", userId);

    context.res = jsonResponse(200, {
      status: user.status,
      displayName: user.displayName,
      email: user.email
    });
  } catch (err) {
    if (err.statusCode === 404) {
      context.res = jsonResponse(404, { error: "User not found." });
    } else {
      context.res = jsonResponse(500, { error: err.message });
    }
  }
};
