const bcrypt = require("bcryptjs");
const { getTableClient, jsonResponse } = require("../shared.cjs");

module.exports = async function (context, req) {
  const { username, password } = req.body || {}; // username can be email or displayName

  if (!username || !password) {
    context.res = jsonResponse(400, { error: "Missing username or password." });
    return;
  }

  try {
    const usersTable = getTableClient("Users");

    // Search for user by email or displayName
    // Note: In production, input should be sanitized to prevent injection, though Azure Table SDK mostly handles it if using parameterized queries (which JS SDK filter string doesn't fully abstract perfectly, but string concatenation here is a minor risk if inputs are simple strings. Ideally validation of input format is good.)
    const filter = `PartitionKey eq 'Users' and (email eq '${username.replace(/'/g, "''")}' or displayName eq '${username.replace(/'/g, "''")}')`;
    
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

    // Allow login even if pending, but frontend will handle restricted access
    // if (user.status !== "approved") { ... } 

    context.res = jsonResponse(200, {
      message: "Login successful.",
      user: {
        id: user.rowKey,
        displayName: user.displayName,
        email: user.email,
        status: user.status // pending or approved
      }
    });

  } catch (err) {
    if (context.log && context.log.error) {
        context.log.error("Login error:", err.message);
    }
    context.res = jsonResponse(500, { error: "Server error." });
  }
};
