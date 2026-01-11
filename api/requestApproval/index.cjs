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

    // Update status to pending if not already
    // We don't return early if it's already pending, because we want to attempt the email again
    if (user.status !== "pending") {
        user.status = "pending";
        user.approvalRequestedAt = new Date().toISOString(); 
        await usersTable.updateEntity(user);
    }

    // --- Send Email to Admin ---
    const adminEmail = process.env.ADMIN_EMAIL;
    const senderEmail = process.env.SENDER_EMAIL;
    const adminSecret = process.env.ADMIN_SECRET;
    
    if (adminEmail && senderEmail && adminSecret) {
        try {
            const host = req.headers.host || "go.junseo.ng";
            const protocol = host.includes("localhost") ? "http" : "https";
            // Construct base URL more robustly
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
                            <body style="font-family: Arial, sans-serif;">
                                <h2>Premium Go URL Shortener(ext) Approval Request</h2>
                                <p><strong>User:</strong> ${user.displayName} (${user.email})</p>
                                <p><strong>Requested At:</strong> ${user.approvalRequestedAt}</p>
                                <br>
                                <p>
                                    <a href="${approveUrl}" style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block; margin-right: 10px;">Approve</a>
                                    <a href="${rejectUrl}" style="background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Reject</a>
                                </p>
                                <br>
                                <hr>
                                <p><small style="color: #666;">Clicking the buttons will perform the action immediately.</small></p>
                            </body>
                        </html>
                    `
                },
                recipients: {
                    to: [{ address: adminEmail }]
                }
            };

            // Start sending
            const poller = await emailClient.beginSend(emailMessage);
            
            // To ensure the email is actually processed by ACS but avoid the long 'pollUntilDone'
            // we'll wait just a moment for the initial 'Accepted' response.
            // In modern Azure Functions, wait for pollUntilDone or a reasonable timeout to ensure the send is committed.
            // Since we're hitting 'Failed to fetch' in the UI if we wait for full delivery, we'll use a Promise.race
            // or just await the start. Let's try awaiting the poller's result for a brief period.
            await Promise.race([
                poller.pollUntilDone(),
                new Promise(resolve => setTimeout(resolve, 2000)) // Wait max 2 seconds for email send
            ]);

            if (context.log) context.log(`Admin notification email processed for ${user.email}`); 
        } catch (emailErr) {
            if (context.log && context.log.error) {
                context.log.error("Failed to send admin notification:", emailErr.message);
            }
        }
    } else {
        const msg = `Missing config: adminEmail=${!!adminEmail}, senderEmail=${!!senderEmail}, adminSecret=${!!adminSecret}`;
        if (context.log && context.log.warn) context.log.warn(msg);
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
