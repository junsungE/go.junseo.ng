const bcrypt = require("bcryptjs");
const { getTableClient, jsonResponse, uuidv4 } = require("../shared.cjs");

module.exports = async function (context, req) {
  const { email, displayName, password, code } = req.body || {};

  if (!email || !displayName || !password || !code) {
    context.res = jsonResponse(400, {
      error: "Missing email, displayName, password, or verification code."
    });
    return;
  }

  try {
    const usersTable = getTableClient("Users");

    // 1. Verify the Code
    try {
        const verification = await usersTable.getEntity("Verifications", email);
        
        if (verification.verificationCode !== code) {
            context.res = jsonResponse(400, { error: "Invalid verification code." });
            return;
        }

        if (new Date() > new Date(verification.expiresAt)) {
            context.res = jsonResponse(400, { error: "Verification code expired." });
            return;
        }

        // Code is good.
        // We can optionally delete it now, or delete it after user creation.
        await usersTable.deleteEntity("Verifications", email);

    } catch (err) {
        if (err.statusCode === 404) {
             context.res = jsonResponse(400, { error: "Invalid or expired verification session. Please request a new code." });
             return;
        }
        throw err;
    }

    // 2. Check for duplicate user (Double checkrace condition)
    // Although requestVerification checked, someone else could have signed up in parallel.
    const existingUsers = usersTable.listEntities({
      queryOptions: {
        filter: `PartitionKey eq 'Users' and email eq '${email}'`
      }
    });

    for await (const user of existingUsers) {
      context.res = jsonResponse(409, { error: "User with this email already exists." });
      return;
    }

    // 3. Create User
    const userId = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);

    const entity = {
      partitionKey: "Users",
      rowKey: userId,
      email,
      displayName,
      password: hashedPassword,
      status: "pending", // pending, approved, rejected
      isEmailVerified: true, // Auto-verified because they provided valid code
      requestedAt: new Date().toISOString()
    };

    await usersTable.createEntity(entity);

    context.res = jsonResponse(200, {
      message: "Signup successful. Your account is pending admin approval.",
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
