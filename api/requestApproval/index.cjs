const { getTableClient, getEmailClient, jsonResponse } = require("../shared.cjs");

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

    // --- Send Email to Admin ---
    const adminEmail = process.env.ADMIN_EMAIL;
    const senderEmail = process.env.SENDER_EMAIL || "donotreply@yourdomain.com";
    const adminSecret = process.env.ADMIN_SECRET;
    
    if (adminEmail && adminSecret) {
        try {
            const host = req.headers.host || "go.junseo.ng";
            const protocol = host.includes("localhost") ? "http" : "https";
            const baseUrl = `${protocol}://${host}/api/adminApprove`;
            
            const approveUrl = `${baseUrl}?userId=${user.rowKey}&status=approved&secret=${adminSecret}`;
            const rejectUrl = `${baseUrl}?userId=${user.rowKey}&status=rejected&secret=${adminSecret}`;

            const emailClient = getEmailClient();
            const emailMessage = {
                senderAddress: senderEmail,
                content: {
                    subject: `[Approval Request] ${user.displayName}`,
                    plainText: `Premium Go URL Shortener(ext) approval request from ${user.displayName} (${user.email}). \n\nApprove: ${approveUrl} \nReject: ${rejectUrl}`,
                    html: `
                        <html>
                            <body>
                                <h2>Premium Go URL Shortener(ext) Approval Request</h2>
                                <p><strong>Name:</strong> ${user.displayName}</p>
                                <p><strong>Email:</strong> ${user.email}</p>
                                <p><strong>Current Status:</strong> ${user.status}</p>
                                <p><strong>Requested At:</strong> ${user.approvalRequestedAt}</p>
                                <br>
                                <p>
                                    <a href="${approveUrl}" style="background-color: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-right: 10px;">Approve Request</a>
                                    <a href="${rejectUrl}" style="background-color: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reject Request</a>
                                </p>
                                <br>
                                <p><small>Note: These links will perform the action immediately using the admin secret.</small></p>
                            </body>
                        </html>
                    `
                },
                recipients: {
                    to: [{ address: adminEmail }]
                }
            };

            const poller = await emailClient.beginSend(emailMessage);
            await poller.pollUntilDone();
        } catch (emailErr) {
            context.log.error("Failed to send admin notification:", emailErr.message);
        }
    } else {
        context.log.warn("ADMIN_EMAIL or ADMIN_SECRET not set, skipping admin notification.");
    }

    context.res = jsonResponse(200, { message: "Approval requested.", status: "pending" });

  } catch (err) {
    if (err.statusCode === 404) {
        context.res = jsonResponse(404, { error: "User not found." });
    } else {
        context.res = jsonResponse(500, { error: err.message });
    }
  }
};
