const { getTableClient, jsonResponse } = require("../shared.cjs");

module.exports = async function (context, req) {
  const { email, code } = req.body || {};

  if (!email || !code) {
    context.res = jsonResponse(400, { error: "Missing email or code." });
    return;
  }

  try {
    const usersTable = getTableClient("Users");

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

        // Code is valid. We do NOT delete it here, as it's needed for the final signup step.
        context.res = jsonResponse(200, { message: "Code is valid." });

    } catch (err) {
        if (err.statusCode === 404) {
             context.res = jsonResponse(400, { error: "Invalid or expired verification session." });
             return;
        }
        throw err;
    }

  } catch (err) {
    context.log.error("validateCode error:", err.message);
    context.res = jsonResponse(500, { error: "Server error." });
  }
};
