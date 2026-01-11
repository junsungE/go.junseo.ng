const bcrypt = require("bcryptjs");
const { getTableClient, jsonResponse, uuidv4 } = require("../shared.cjs");

module.exports = async function (context, req) {
  const { email, displayName, password } = req.body || {};

  if (!email || !displayName || !password) {
    context.res = jsonResponse(400, {
      error: "Missing email, displayName, or password."
    });
    return;
  }

  try {
    const usersTable = getTableClient("Users");

    // Check for existing user
    const existingUsers = usersTable.listEntities({
      queryOptions: {
        filter: `PartitionKey eq 'Users' and (email eq '${email}' or displayName eq '${displayName}')`
      }
    });

    for await (const user of existingUsers) {
      context.res = jsonResponse(409, {
        error: "User with this email or displayName already exists."
      });
      return;
    }

    const userId = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);

    const entity = {
      partitionKey: "Users",
      rowKey: userId,
      email,
      displayName,
      password: hashedPassword,
      status: "pending", // pending, approved, rejected
      requestedAt: new Date().toISOString()
    };

    await usersTable.createEntity(entity);

    context.res = jsonResponse(200, {
      message:
        "Premium signup request submitted. Wait for approval from the owner.",
      userId
    });
  } catch (err) {
    if (context && context.log && typeof context.log.error === "function") {
      context.log.error("Premium signup error:", err.message);
    } else {
      console.error("Premium signup error:", err.message);
    }
    context.res = jsonResponse(500, { error: "Server error." });
  }
};
