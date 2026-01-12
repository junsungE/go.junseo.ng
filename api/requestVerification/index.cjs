const { getTableClient, getEmailClient, jsonResponse } = require("../shared.cjs");

module.exports = async function (context, req) {
  const { email, displayName } = req.body || {};

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

    // 4. Send Email via Azure Communication Services
    const senderEmail = process.env.SENDER_EMAIL || "donotreply@yourdomain.com";
    const nameParam = displayName ? `&displayName=${encodeURIComponent(displayName)}` : "";
    const linkUrl = `${process.env.URL || "https://go.junseo.ng"}/ext/premium/signup?email=${encodeURIComponent(email)}&code=${verificationCode}${nameParam}`;

    try {
      const emailClient = getEmailClient();
      const personalizedGreeting = displayName ? `Hi ${displayName},` : "Hello,";
      const emailMessage = {
        senderAddress: senderEmail,
        content: {
          subject: "Verify your email to register for Premium Go URL Shortener(ext)",
          plainText: `${personalizedGreeting}\n\nYour verification code is: ${verificationCode}\n\nAlternatively, click here to continue: ${linkUrl}`,
          html: `
            <html>
              <body>
                <h2>Verify your email</h2>
                <p>${personalizedGreeting}</p>
                <p>Your verification code to register for Premium Go URL Shortener(ext) is: <strong>${verificationCode}</strong></p>
                <p>Alternatively, <a href="${linkUrl}">click this link</a> to continue your sign up.</p>
                <p>This code will expire in 1 hour.</p>
              </body>
            </html>
          `,
        },
        recipients: {
          to: [{ address: email }],
        },
      };

      const poller = await emailClient.beginSend(emailMessage);
      await poller.pollUntilDone();
      
      context.log(`Email sent successfully to ${email}`);
    } catch (emailErr) {
      context.log.error("Failed to send email:", emailErr.message);
      // We still return 200 to avoid leaking if email service is down, 
      // but in dev we might want to know. 
      // For now, let's just log it.
    }

    context.res = jsonResponse(200, { message: "Verification code sent." });

  } catch (err) {
    context.log.error("requestVerification error:", err.message);
    context.res = jsonResponse(500, { error: "Server error." });
  }
};
