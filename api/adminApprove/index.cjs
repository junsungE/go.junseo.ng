const { getTableClient, getEmailClient, jsonResponse } = require("../shared.cjs");

module.exports = async function (context, req) {
  const { userId, secret, status } = req.body || {};
  
  // prompt user to set ADMIN_SECRET in local.settings.json or app settings
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
      context.res = jsonResponse(401, { error: "Unauthorized" });
      return;
  }

  if (!userId || !status) {
    context.res = jsonResponse(400, { error: "Missing userId or status." });
    return;
  }

  if (status !== "approved" && status !== "rejected") {
    context.res = jsonResponse(400, { error: "Invalid status. Must be 'approved' or 'rejected'." });
    return;
  }

  try {
    const usersTable = getTableClient("Users");
    
    // Retrieve the entity first. PartitionKey is "Users" based on our new design
    const user = await usersTable.getEntity("Users", userId);
    
    // Update status
    user.status = status;
    
    await usersTable.updateEntity(user);

    // Send Notification Email
    const senderEmail = process.env.SENDER_EMAIL || "donotreply@yourdomain.com";
    const statusText = status === "approved" ? "Approved" : "Rejected";
    const messageText = status === "approved" 
        ? "Your request for Premium Go URL Shortener(ext) access has been approved! You can now sign in to your account." 
        : "Unfortunately, your request for Premium Go URL Shortener(ext) access has been rejected at this time.";

    try {
      const emailClient = getEmailClient();
      const emailMessage = {
        senderAddress: senderEmail,
        content: {
          subject: `Request ${statusText} - Premium Go URL Shortener(ext)`,
          plainText: `Hi ${user.displayName},\n\n${messageText}\n\nBest regards,\nGo.junseo.ng`,
          html: `
            <html>
              <body>
                <h2>Status Update</h2>
                <p>Hi <strong>${user.displayName}</strong>,</p>
                <p>${messageText}</p>
                <p>Best regards,<br>Go.junseo.ng</p>
              </body>
            </html>
          `,
        },
        recipients: {
          to: [{ address: user.email }],
        },
      };

      const poller = await emailClient.beginSend(emailMessage);
      await poller.pollUntilDone();
      context.log(`Notification email sent to ${user.email}`);
    } catch (emailErr) {
      context.log.error("Failed to send notification email:", emailErr.message);
    }

    context.res = jsonResponse(200, { message: `User ${user.displayName} (${user.email}) set to ${status}.` });

  } catch (err) {
    if (err.statusCode === 404) {
        context.res = jsonResponse(404, { error: "User not found." });
    } else {
        context.res = jsonResponse(500, { error: err.message });
    }
  }
};
