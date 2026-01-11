const { getTableClient, jsonResponse } = require("../shared.cjs");

module.exports = async function (context, req) {
  const { email } = req.body || {};

  if (!email) {
    context.res = jsonResponse(400, { error: "Missing email." });
    return;
  }

  try {
    const usersTable = getTableClient("Users");

    // 1. Check if user already exists (and is verified)
    // We scan for PK="Users"
    const existingUsers = usersTable.listEntities({
      queryOptions: {
        filter: `PartitionKey eq 'Users' and email eq '${email}'`
      }
    });

    for await (const user of existingUsers) {
        // If user exists, we generally don't want to allow 're-signup' unless we want to support password reset via this flow.
        // For security, usually we say "Email taken".
        // However, if the previous user was NOT verified (stale data), we might want to overwrite. 
        // But with the NEW flow, we don't store unverified users in PK="Users". 
        // So if they exist here, they are a real user (or pending approval).
        context.res = jsonResponse(409, { error: "User with this email already exists." });
        return;
    }

    // 2. Generate Code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 3600000).toISOString(); // 1 hour

    // 3. Store in Verification partition
    // PK="Verifications", RK=email
    const entity = {
        partitionKey: "Verifications",
        rowKey: email,
        verificationCode,
        expiresAt
    };

    await usersTable.upsertEntity(entity, "Replace");

    // 4. Send Mock Email
    // Link now points to signup page with parameters
    const linkUrl = `${process.env.URL || "http://localhost:4280"}/ext/premium/signup.html?email=${encodeURIComponent(email)}&code=${verificationCode}`;
    
    context.log("---------------------------------------------------");
    context.log(`[MOCK EMAIL] To: ${email}`);
    context.log(`[MOCK EMAIL] Subject: Verify your email`);
    context.log(`[MOCK EMAIL] Code: ${verificationCode}`);
    context.log(`[MOCK EMAIL] Continue Signup Link: ${linkUrl}`);
    context.log("---------------------------------------------------");

    context.res = jsonResponse(200, { message: "Verification code sent." });

  } catch (err) {
    context.log.error("requestVerification error:", err.message);
    context.res = jsonResponse(500, { error: "Server error." });
  }
};
