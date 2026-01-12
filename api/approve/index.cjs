const { getTableClient, getEmailClient, jsonResponse } = require("../shared.cjs");

module.exports = async function (context, req) {
  // Support both POST (from dashboard) and GET (from direct email links)
  const method = req.method ? req.method.toUpperCase() : "POST";
  const isGet = method === "GET";
  
  // Safe parameter extraction
  let body = req.body;
  
  // Handle case where body might be a JSON string but not parsed
  if (body && typeof body === "string") {
      try {
          body = JSON.parse(body);
      } catch (e) {
          // If parse fails, assume it's just a query string-like body or raw buffer.
          // For this API, valid JSON is expected for POST.
      }
  }

  const query = req.query || {};
  const params = { ...query, ...(typeof body === "object" ? body : {}) };
  
  const { userId, secret, status } = params;
  
  const adminSecret = process.env.ADMIN_SECRET;
  
  if (!adminSecret || secret !== adminSecret) {
      if (isGet) {
          // Return 200 OK with error UI to prevent SWA/Browser from hiding the error
          context.res = {
              status: 200,
              headers: { "Content-Type": "text/html" },
              body: "<h1 style='color:red;'>Unauthorized</h1><p>Invalid or missing admin secret.</p>"
          };
      } else {
          // Dashboard expects JSON
          context.res = jsonResponse(403, { error: "Authorization failed. Check Admin Secret." });
      }
      return;
  }

  if (!userId || !status) {
    if (isGet) {
        context.res = {
            status: 200, 
            headers: { "Content-Type": "text/html" },
            body: "<h1>Bad Request</h1><p>Missing userId or status.</p>"
        };
    } else {
        context.res = jsonResponse(400, { error: "Missing userId or status." });
    }
    return;
  }

  if (status !== "approved" && status !== "rejected") {
    if (isGet) {
        context.res = {
            status: 200,
            headers: { "Content-Type": "text/html" },
            body: "<h1>Bad Request</h1><p>Invalid status.</p>"
        };
    } else {
        context.res = jsonResponse(400, { error: "Invalid status. Must be 'approved' or 'rejected'." });
    }
    return;
  }

  try {
    const usersTable = getTableClient("Users");
    
    // Retrieve the entity first
    let user;
    try {
        user = await usersTable.getEntity("Users", userId);
    } catch (e) {
        if (e.statusCode === 404) {
            if (isGet) {
                context.res = { status: 200, headers: { "Content-Type": "text/html" }, body: "<h1>User Not Found</h1>" };
            } else {
                context.res = jsonResponse(404, { error: "User not found." });
            }
            return;
        }
        throw e;
    }
    
    // Only update if actually changing status (idempotency)
    if (user.status !== status) {
        const oldStatus = user.status;
        user.status = status;
        await usersTable.updateEntity(user);
        context.log(`User ${user.email} status changed from ${oldStatus} to ${status}`);

        // Send Notification Email to user
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
              plainText: `Hi ${user.displayName},\n\n${messageText}\n\nBest regards,\nGo.junseo.ng/ext/premium`,
              html: `
                <html>
                  <body>
                    <h2>Status Update</h2>
                    <p>Hi ${user.displayName},</p>
                    <p>${messageText}</p>
                    <p>Best regards,<br>Go.junseo.ng/ext/premium</p>
                  </body>
                </html>
              `,
            },
            recipients: {
              to: [{ address: user.email }],
            },
          };

          const poller = await emailClient.beginSend(emailMessage);
          context.log(`User notification email initiated for ${user.email}`); 
        } catch (emailErr) {
          context.log.error("Failed to send notification email:", emailErr.message);
        }
    }

    if (isGet) {
        context.res = {
            status: 200,
            headers: { "Content-Type": "text/html" },
            body: `
                <html>
                <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                    <h1 style="color: #28a745;">Success</h1>
                    <p>User <strong>${user.displayName}</strong> (${user.email}) has been <strong>${status}</strong>.</p>
                    <br>
                    <a href="/ext/premium" style="color: #0078d4; text-decoration: none;">Return to site</a>
                </body>
                </html>
            `
        };
    } else {
        context.res = jsonResponse(200, { message: `User ${user.displayName} (${user.email}) set to ${status}.` });
    }

  } catch (err) {
    context.log.error("adminApprove general error:", err.message);
    if (isGet) {
        context.res = {
            status: 200,
            headers: { "Content-Type": "text/html" },
            body: `<h1>Error</h1><p>${err.message}</p>`
        };
    } else {
        context.res = jsonResponse(500, { error: err.message });
    }
  }
};
