const { getTableClient, getEmailClient, jsonResponse } = require("../shared.cjs");

module.exports = async function (context, req) {
  // Support both POST (from dashboard) and GET (from direct email links)
  const isGet = req.method === "GET";
  const { userId, secret, status } = isGet ? req.query : (req.body || {});
  
  const adminSecret = process.env.ADMIN_SECRET;
  
  if (!adminSecret || secret !== adminSecret) {
      if (isGet) {
          context.res = {
              status: 401,
              headers: { "Content-Type": "text/html" },
              body: "<h1>Unauthorized</h1><p>Invalid or missing admin secret.</p>"
          };
      } else {
          context.res = jsonResponse(401, { error: "Unauthorized" });
      }
      return;
  }

  if (!userId || !status) {
    if (isGet) {
        context.res = {
            status: 400,
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
            status: 400,
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
    const user = await usersTable.getEntity("Users", userId);
    
    // Only update if actually changing status (idempotency)
    if (user.status !== status) {
        user.status = status;
        await usersTable.updateEntity(user);

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
              plainText: `Hi ${user.displayName},\n\n${messageText}\n\nBest regards,\nGo.junseo.ng`,
              html: `
                <html>
                  <body>
                    <h2>Status Update</h2>
                    <p>Hi <strong>${user.displayName}</strong>,</p>
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
          // Speed up response by not waiting for full delivery confirmation
          context.log(`User notification email initiated for ${user.email}`); 
        } catch (emailErr) {
          if (context.log && context.log.error) {
              context.log.error("Failed to send notification email:", emailErr.message);
          } else {
              console.error("Failed to send notification email:", emailErr.message);
          }
        }
    }

    if (isGet) {
        context.res = {
            status: 200,
            headers: { "Content-Type": "text/html" },
            body: `<h1>Success</h1><p>User <strong>${user.displayName}</strong> (${user.email}) has been <strong>${status}</strong>.</p><p><a href="/">Return to site</a></p>`
        };
    } else {
        context.res = jsonResponse(200, { message: `User ${user.displayName} (${user.email}) set to ${status}.` });
    }

  } catch (err) {
    if (err.statusCode === 404) {
        if (isGet) {
            context.res = {
                status: 404,
                headers: { "Content-Type": "text/html" },
                body: "<h1>Not Found</h1><p>User not found.</p>"
            };
        } else {
            context.res = jsonResponse(404, { error: "User not found." });
        }
    } else {
        if (isGet) {
            context.res = {
                status: 500,
                headers: { "Content-Type": "text/html" },
                body: `<h1>Error</h1><p>${err.message}</p>`
            };
        } else {
            context.res = jsonResponse(500, { error: err.message });
        }
    }
  }
};
