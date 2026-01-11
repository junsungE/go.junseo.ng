const bcrypt = require("bcryptjs");
const { getTableClient, jsonResponse } = require("../shared.cjs");

module.exports = async function (context, req) {
  const { email, password } = req.body || {}; 

  if (!email || !password) {
    context.res = jsonResponse(400, { error: "Missing email or password." });
    return;
  }

  try {
    const usersTable = getTableClient("Users");

    // Search for user by email only
    const filter = `PartitionKey eq 'Users' and email eq '${email.replace(/'/g, "''")}'`;
    
    const usersIterator = usersTable.listEntities({
      queryOptions: { filter }
    });

    let user = null;
    for await (const u of usersIterator) {
      user = u;
      break; 
    }

    if (!user) {
      context.res = jsonResponse(403, { error: "Invalid credentials." });
      return;
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      context.res = jsonResponse(403, { error: "Invalid credentials." });
      return;
    }
    
    if (!user.isEmailVerified) {
        context.res = jsonResponse(403, { error: "Please verify your email first." });
        return;
    }

    // Allow sign in for all verified users. Frontend handles restricted access based on status.
    // Status can be: new (default after sign up), pending (after request), approved, rejected

    // Update lastSignIn timestamp
    user.lastSignIn = new Date().toISOString();
    await usersTable.updateEntity(user);

    context.res = jsonResponse(200, {
      message: "Sign in successful.",
      user: {
        id: user.rowKey,
        displayName: user.displayName,
        email: user.email,
        status: user.status, // key for frontend logic
        lastSignIn: user.lastSignIn
      }
    });

  } catch (err) {
    if (context.log && context.log.error) {
        context.log.error("Sign in error:", err.message);
    }
    context.res = jsonResponse(500, { error: "Server error." });
  }
};
