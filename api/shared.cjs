// Shared utility for all Azure Functions (CommonJS version)
const { TableClient, AzureNamedKeyCredential } = require("@azure/data-tables");
const { EmailClient } = require("@azure/communication-email");
const nodemailer = require("nodemailer");
const { v4: uuidv4 } = require("uuid");
const UAParser = require("ua-parser-js");

// Utility to get TableClient
function getTableClient(tableName) {
  const storageConn = process.env.STORAGE_CONN || "";
  if (!storageConn) {
    throw new Error("STORAGE_CONN is not set in environment");
  }
  const match = storageConn.match(/AccountName=([^;]+);AccountKey=([^;]+)/);
  if (!match) {
    throw new Error("Invalid STORAGE_CONN format");
  }
  const account = match[1];
  const key = match[2];
  const credential = new AzureNamedKeyCredential(account, key);
  const tableClient = new TableClient(
    `https://${account}.table.core.windows.net`,
    tableName,
    credential
  );
  return tableClient;
}

function getEmailClient() {
  // Old Azure Communication Services-only implementation before implementing Resend-only (kept for easy rollback):
  /*
  const connectionString = process.env.COMMUNICATION_SERVICES_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error("COMMUNICATION_SERVICES_CONNECTION_STRING is not set");
  }
  return new EmailClient(connectionString);
  */

  // Old Resend-only implementation before implementing EMAIL_PROVIDER selector (kept for rollback):
  // New Resend-backed implementation with ACS-compatible shape.
  // This keeps existing call sites unchanged:
  //   const emailClient = getEmailClient();
  //   const poller = await emailClient.beginSend(emailMessage);
  //   await poller.pollUntilDone();
  /*
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    throw new Error("RESEND_API_KEY is not set");
  }

  return {
    async beginSend(emailMessage) {
      const to = (emailMessage?.recipients?.to || [])
        .map((r) => r && r.address)
        .filter(Boolean);

      if (!to.length) {
        throw new Error("No recipient address was provided");
      }

      const resendPayload = {
        from: `Go.junseo.ng <${emailMessage.senderAddress}>`,
        to,
        subject: emailMessage?.content?.subject || "",
        text: emailMessage?.content?.plainText || undefined,
        html: emailMessage?.content?.html || undefined
      };

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(resendPayload)
      });

      const responseBody = await response.text();
      let parsedBody;
      try {
        parsedBody = responseBody ? JSON.parse(responseBody) : {};
      } catch {
        parsedBody = { raw: responseBody };
      }

      if (!response.ok) {
        throw new Error(`Resend API error (${response.status}): ${responseBody}`);
      }
        
      return {
        async pollUntilDone() {
          return {
            status: "Succeeded",
            id: parsedBody.id
          };
        }
      };
    }
  };
  */

  const provider = (process.env.EMAIL_PROVIDER || "resend").toLowerCase();

  if (provider === "acs") {
    const connectionString = process.env.COMMUNICATION_SERVICES_CONNECTION_STRING;
    if (!connectionString) {
      throw new Error("COMMUNICATION_SERVICES_CONNECTION_STRING is not set");
    }
    return new EmailClient(connectionString);
  }

  //PowerAutomate code starts
  if (provider === "powerautomate") {
    return {
      async beginSend(emailMessage) {
        const to = (emailMessage?.recipients?.to || [])
          .map((r) => r && r.address)
          .filter(Boolean);

        if (!to.length) {
          throw new Error("No recipient address was provided");
        }

        const webhookUrl = process.env.POWER_AUTOMATE_URL;
        if (!webhookUrl) {
          throw new Error("POWER_AUTOMATE_URL is not set");
        }

        const webhookMethod = (process.env.POWER_AUTOMATE_METHOD || "post").toLowerCase();
        const webhookSecret = process.env.POWER_AUTOMATE_SECRET || "";
        const payload = {
          eventType: "email.send",
          provider: "powerautomate",
          correlationId: uuidv4(),
          senderAddress: emailMessage.senderAddress || null,
          subject: emailMessage?.content?.subject || "",
          to,
          plainText: emailMessage?.content?.plainText || "",
          html: emailMessage?.content?.html || "",
          requestedAt: new Date().toISOString()
        };

        let requestUrl = webhookUrl;
        let requestOptions = {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          }
        };

        if (webhookSecret) {
          requestOptions.headers.Authorization = `Bearer ${webhookSecret}`;
        }

        if (webhookMethod === "get") {
          const query = new URLSearchParams({
            eventType: payload.eventType,
            provider: payload.provider,
            correlationId: payload.correlationId,
            senderAddress: payload.senderAddress || "",
            subject: payload.subject,
            to: payload.to.join(","),
            plainText: payload.plainText,
            html: payload.html,
            requestedAt: payload.requestedAt
          });
          requestUrl = `${webhookUrl}${webhookUrl.includes("?") ? "&" : "?"}${query.toString()}`;
          requestOptions = {
            method: "GET",
            headers: {}
          };
          if (webhookSecret) {
            requestOptions.headers.Authorization = `Bearer ${webhookSecret}`;
          }
        } else if (webhookMethod !== "post") {
          throw new Error("POWER_AUTOMATE_METHOD must be 'post' or 'get'");
        } else {
          requestOptions.body = JSON.stringify(payload);
        }

        const response = await fetch(requestUrl, requestOptions);
        const responseBody = await response.text();

        if (!response.ok) {
          throw new Error(`Power Automate webhook failed (${response.status}): ${responseBody}`);
        }

        return {
          async pollUntilDone() {
            return {
              status: "Succeeded",
              id: response.headers.get("x-correlation-id") || payload.correlationId || uuidv4()
            };
          }
        };
      }
    };
  }
  //PowerAutomate code ends

  return {
    async beginSend(emailMessage) {
      const to = (emailMessage?.recipients?.to || [])
        .map((r) => r && r.address)
        .filter(Boolean);

      if (!to.length) {
        throw new Error("No recipient address was provided");
      }

      if (provider === "resend") {
        const resendApiKey = process.env.RESEND_API_KEY;
        if (!resendApiKey) {
          throw new Error("RESEND_API_KEY is not set");
        }

        const resendPayload = {
          from: `Go.junseo.ng <${emailMessage.senderAddress}>`,
          to,
          subject: emailMessage?.content?.subject || "",
          text: emailMessage?.content?.plainText || undefined,
          html: emailMessage?.content?.html || undefined
        };

        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(resendPayload)
        });

        const responseBody = await response.text();
        let parsedBody;
        try {
          parsedBody = responseBody ? JSON.parse(responseBody) : {};
        } catch {
          parsedBody = { raw: responseBody };
        }

        if (!response.ok) {
          throw new Error(`Resend API error (${response.status}): ${responseBody}`);
        }

        return {
          async pollUntilDone() {
            return {
              status: "Succeeded",
              id: parsedBody.id || uuidv4()
            };
          }
        };
      }

      if (provider === "graph") {
        const tenantId = process.env.M365_TENANT_ID;
        const clientId = process.env.M365_CLIENT_ID;
        const clientSecret = process.env.M365_CLIENT_SECRET;
        const senderUser = process.env.M365_SENDER_USER || emailMessage.senderAddress;

        if (!tenantId || !clientId || !clientSecret || !senderUser) {
          throw new Error("Graph config is incomplete. Set M365_TENANT_ID, M365_CLIENT_ID, M365_CLIENT_SECRET, and M365_SENDER_USER.");
        }

        const tokenResponse = await fetch(
          `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              grant_type: "client_credentials",
              client_id: clientId,
              client_secret: clientSecret,
              scope: "https://graph.microsoft.com/.default"
            }).toString()
          }
        );

        const tokenBodyText = await tokenResponse.text();
        let tokenBody;
        try {
          tokenBody = tokenBodyText ? JSON.parse(tokenBodyText) : {};
        } catch {
          tokenBody = { raw: tokenBodyText };
        }

        if (!tokenResponse.ok || !tokenBody.access_token) {
          throw new Error(`Graph token request failed (${tokenResponse.status}): ${tokenBodyText}`);
        }

        const html = emailMessage?.content?.html || "";
        const plainText = emailMessage?.content?.plainText || "";
        const graphPayload = {
          message: {
            subject: emailMessage?.content?.subject || "",
            body: {
              contentType: html ? "HTML" : "Text",
              content: html || plainText
            },
            toRecipients: to.map((address) => ({
              emailAddress: { address }
            }))
          },
          saveToSentItems: "true"
        };

        const sendResponse = await fetch(
          `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(senderUser)}/sendMail`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${tokenBody.access_token}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(graphPayload)
          }
        );

        const sendBodyText = await sendResponse.text();
        if (!sendResponse.ok) {
          throw new Error(`Graph sendMail failed (${sendResponse.status}): ${sendBodyText}`);
        }

        const graphRequestId =
          sendResponse.headers.get("request-id") ||
          sendResponse.headers.get("x-ms-request-id") ||
          uuidv4();

        return {
          async pollUntilDone() {
            return {
              status: "Succeeded",
              id: graphRequestId
            };
          }
        };
      }

      if (provider === "smtp") {
        const smtpHost = process.env.SMTP_HOST;
        const smtpPort = Number(process.env.SMTP_PORT || 587);
        const smtpSecure = (process.env.SMTP_SECURE || "false").toLowerCase() === "true";
        const smtpUser = process.env.SMTP_USER;
        const smtpPass = process.env.SMTP_PASS;

        if (!smtpHost || !smtpUser || !smtpPass) {
          throw new Error("SMTP config is incomplete. Set SMTP_HOST, SMTP_USER, and SMTP_PASS.");
        }

        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpSecure,
          auth: {
            user: smtpUser,
            pass: smtpPass
          }
        });

        const info = await transporter.sendMail({
          from: `Go.junseo.ng <${emailMessage.senderAddress}>`,
          to: to.join(","),
          subject: emailMessage?.content?.subject || "",
          text: emailMessage?.content?.plainText || undefined,
          html: emailMessage?.content?.html || undefined
        });

        return {
          async pollUntilDone() {
            return {
              status: "Succeeded",
              id: info.messageId || uuidv4()
            };
          }
        };
      }

      throw new Error(`Unsupported EMAIL_PROVIDER '${provider}'. Use one of: acs, resend, graph, smtp.`);
    }
  };
}

// Parse user agent to identify device/platform
function parseUserAgent(uaString) {
  const parser = new UAParser(uaString);
  const result = parser.getResult();
  return {
    browser: result.browser.name || "Unknown",
    os: result.os.name || "Unknown",
    device: result.device.type || "Desktop"
  };
}

// Detect source app from User-Agent string
// This helps identify which app the user clicked the link from
function detectSourceApp(uaString) {
  if (!uaString) return null;
  const ua = uaString.toLowerCase();
  
  // In-app browsers and messaging apps (check these first as they're more specific)
  // Microsoft apps
  if (ua.includes('teams')) return 'Microsoft Teams';
  if (ua.includes('outlook')) return 'Microsoft Outlook';
  if (ua.includes('yammer')) return 'Microsoft Yammer';
  
  // Google apps (check before generic browser detection)
  if (ua.includes('gsa/')) return 'Google Search App';  // Google Search App
  if (ua.includes('google-chat')) return 'Google Chat';
  if (ua.includes('googledocs')) return 'Google Docs';
  if (ua.includes('googlesheets')) return 'Google Sheets';
  if (ua.includes('googleslides')) return 'Google Slides';
  if (ua.includes('googledrive')) return 'Google Drive';
  if (ua.includes('googlecalendar')) return 'Google Calendar';
  if (ua.includes('googlemeet')) return 'Google Meet';
  if (ua.includes('gmailapp') || ua.includes('gmail/')) return 'Gmail App';
  if (ua.includes('youtube')) return 'YouTube';
  if (ua.includes('googlemaps') || ua.includes('google maps')) return 'Google Maps';
  if (ua.includes('googleclassroom')) return 'Google Classroom';
  if (ua.includes('googlenews')) return 'Google News';
  if (ua.includes('googlekeep')) return 'Google Keep';
  if (ua.includes('googlephotos')) return 'Google Photos';
  
  // Apple apps (check before generic browser detection)
  if (ua.includes('apple news') || ua.includes('applenews')) return 'Apple News';
  if (ua.includes('apple mail') || ua.includes('applemail')) return 'Apple Mail';
  if (ua.includes('apple notes') || ua.includes('applenotes') || ua.includes('notes/')) return 'Apple Notes';
  if (ua.includes('apple music') || ua.includes('applemusic')) return 'Apple Music';
  if (ua.includes('apple podcasts') || ua.includes('applepodcasts')) return 'Apple Podcasts';
  if (ua.includes('apple maps') || ua.includes('applemaps')) return 'Apple Maps';
  if (ua.includes('facetime')) return 'FaceTime';
  if (ua.includes('imessage')) return 'iMessage';
  if (ua.includes('apple tv') || ua.includes('appletv')) return 'Apple TV';
  if (ua.includes('apple books') || ua.includes('applebooks') || ua.includes('ibooks')) return 'Apple Books';
  if (ua.includes('apple reminders') || ua.includes('applereminders')) return 'Apple Reminders';
  if (ua.includes('apple calendar') || ua.includes('applecalendar') || ua.includes('dataaccessd')) return 'Apple Calendar';
  if (ua.includes('apple files') || ua.includes('applefiles')) return 'Apple Files';
  if (ua.includes('apple freeform') || ua.includes('applefreeform')) return 'Apple Freeform';
  if (ua.includes('safari viewservice') || ua.includes('safarivs')) return 'Safari View (In-App)';
  
  // Social media apps
  if (ua.includes('fban') || ua.includes('fbav') || ua.includes('fb_iab')) return 'Facebook';
  if (ua.includes('instagram')) return 'Instagram';
  if (ua.includes('twitter') || ua.includes(' x/')) return 'Twitter/X';
  if (ua.includes('linkedin')) return 'LinkedIn';
  if (ua.includes('pinterest')) return 'Pinterest';
  if (ua.includes('snapchat')) return 'Snapchat';
  if (ua.includes('tiktok')) return 'TikTok';
  if (ua.includes('reddit')) return 'Reddit';
  
  // Messaging apps
  if (ua.includes('whatsapp')) return 'WhatsApp';
  if (ua.includes('telegram')) return 'Telegram';
  if (ua.includes('discord')) return 'Discord';
  if (ua.includes('slack')) return 'Slack';
  if (ua.includes('messenger')) return 'Messenger';
  if (ua.includes('viber')) return 'Viber';
  if (ua.includes('line/')) return 'LINE';
  if (ua.includes('wechat') || ua.includes('micromessenger')) return 'WeChat';
  if (ua.includes('kakaotalk')) return 'KakaoTalk';
  if (ua.includes('signal')) return 'Signal';
  if (ua.includes('zalo')) return 'Zalo';
  
  // Email apps
  if (ua.includes('thunderbird')) return 'Thunderbird';
  if (ua.includes('yahoo') && ua.includes('mail')) return 'Yahoo Mail';
  
  // Other apps
  if (ua.includes('notion')) return 'Notion';
  if (ua.includes('evernote')) return 'Evernote';
  if (ua.includes('pocket')) return 'Pocket';
  if (ua.includes('flipboard')) return 'Flipboard';
  
  // Bots and crawlers
  if (ua.includes('googlebot')) return 'Googlebot';
  if (ua.includes('bingbot')) return 'Bingbot';
  if (ua.includes('slurp')) return 'Yahoo Bot';
  if (ua.includes('duckduckbot')) return 'DuckDuckGo Bot';
  if (ua.includes('facebookexternalhit')) return 'Facebook Bot';
  if (ua.includes('twitterbot')) return 'Twitter Bot';
  if (ua.includes('linkedinbot')) return 'LinkedIn Bot';
  if (ua.includes('slackbot')) return 'Slack Bot';
  if (ua.includes('discordbot')) return 'Discord Bot';
  if (ua.includes('telegrambot')) return 'Telegram Bot';
  if (ua.includes('applebot')) return 'Apple Bot';
  
  return null; // No specific app detected
}

// Store a visit record
// visitType: "valid" (successful redirect), "notfound" (slug doesn't exist), "inactive" (link inactive/expired)
async function recordVisit(slug, ip, uaString, country = "Unknown", language = "Unknown", referrer = "Direct", visitType = "valid") {
  try {
    const visitsTable = getTableClient("Visits");
    const visitId = uuidv4();
    const now = new Date().toISOString();
    const deviceInfo = parseUserAgent(uaString);

    // URL-encode the slug for partitionKey - Azure Table Storage doesn't allow
    // forward slashes, backslashes, #, ? and control characters in keys
    const encodedSlug = encodeURIComponent(slug);

    // If country is unknown and we have a valid IP, try a quick geo lookup
    let detectedLocation = country;
    if ((!country || country === "Unknown") && ip && ip !== "Hidden" && ip !== "::1" && ip !== "127.0.0.1") {
      try {
        // Use ip-api.com (free, no key for legacy usage)
        // Note: Free tier limited to 45 req/min.
        const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city`);
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          if (geoData.status === 'success') {
            detectedLocation = `${geoData.city || ''}, ${geoData.regionName || ''}, ${geoData.country || ''}`.replace(/^, |, $/g, '').replace(/, , /g, ', ');
          }
        }
      } catch (geoErr) {
        console.error("Geo lookup failed:", geoErr.message);
      }
    }

    // Detect source app from User-Agent (useful when referrer is Direct/empty)
    const sourceApp = detectSourceApp(uaString);
    
    // Enhance referrer information with detected source app
    let finalReferrer = referrer || "Direct";
    if ((!referrer || referrer === "Direct") && sourceApp) {
      // If no website referrer but we detected an app, show the app as source
      finalReferrer = `App: ${sourceApp}`;
    } else if (referrer && referrer !== "Direct" && sourceApp) {
      // If we have both referrer and app detection, include both
      // (e.g., link shared in Teams that opens in Teams browser)
      finalReferrer = `${referrer} (via ${sourceApp})`;
    }

    await visitsTable.createEntity({
      partitionKey: encodedSlug,
      rowKey: visitId,
      timestamp: now,
      ip: ip || "Hidden",
      userAgent: `${deviceInfo.browser} on ${deviceInfo.os}`,
      country: detectedLocation || "Unknown",
      language,
      referrer: finalReferrer,
      sourceApp: sourceApp || null, // Store separately for filtering/analysis
      visitType: visitType // "valid", "notfound", or "inactive"
    });
  } catch (err) {
    console.error("Error saving visit:", err);
  }
}

// Increment visit counter in target table
async function incrementVisit(tableName, slug, partitionKey = null) {
  const table = getTableClient(tableName);
  try {
    // If no partition key provided, guess based on tableName (legacy support)
    if (!partitionKey) {
      partitionKey = tableName === "InternalLinks" ? "internal" : "free"; 
    }

    const entity = await table.getEntity(partitionKey, slug);
    entity.visits = (entity.visits || 0) + 1;
    entity.lastVisitedAt = new Date().toISOString();
    await table.updateEntity(entity, "Replace");
  } catch (err) {
    // If premium, try to find in premium partition if not found in free?
    // No, cleaner logic should be handled by caller properly passing partitionKey.
    // However, if the error is "Not Found", it might be because we defaulted to "free" but it's "premium".
    if (tableName === "ExternalLinks" && partitionKey === "free") {
      try {
        const entity = await table.getEntity("premium", slug);
        entity.visits = (entity.visits || 0) + 1;
        entity.lastVisitedAt = new Date().toISOString();
        await table.updateEntity(entity, "Replace");
        return;
      } catch (innerErr) {
        // really not found
      }
    }
    console.error("Error incrementing visit count:", err.message);
  }
}

// Common helper to validate expiry or start date
function isLinkActive(entity) {
  const now = new Date();
  if (entity.startDate && new Date(entity.startDate) > now) return false;
  if (entity.expiryDate && new Date(entity.expiryDate) < now) return false;
  if (entity.visitLimit && entity.visits >= entity.visitLimit) return false;
  return true;
}

// Case sensitivity helper
function normalizeSlug(slug, isCaseSensitive) {
  return isCaseSensitive ? slug : slug.toLowerCase();
}

// Generate random alphanumeric slug (case-sensitive, 5-7 chars)
function generateRandomSlug(minLength = 5, maxLength = 7) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const length = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Generic JSON response
function jsonResponse(status, data) {
  return {
    status,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  };
}

module.exports = {
  getTableClient,
  getEmailClient,
  parseUserAgent,
  recordVisit,
  incrementVisit,
  isLinkActive,
  normalizeSlug,
  generateRandomSlug,
  jsonResponse,
  uuidv4
};
