// Shared utility for all Azure Functions (CommonJS version)
const { TableClient, AzureNamedKeyCredential } = require("@azure/data-tables");
const { EmailClient } = require("@azure/communication-email");
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
  const connectionString = process.env.COMMUNICATION_SERVICES_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error("COMMUNICATION_SERVICES_CONNECTION_STRING is not set");
  }
  return new EmailClient(connectionString);
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

// Store a visit record
async function recordVisit(slug, ip, uaString, country = "Unknown", language = "Unknown") {
  try {
    const visitsTable = getTableClient("Visits");
    const visitId = uuidv4();
    const now = new Date().toISOString();
    const deviceInfo = parseUserAgent(uaString);

    await visitsTable.createEntity({
      partitionKey: slug,
      rowKey: visitId,
      timestamp: now,
      ip: ip || "Hidden",
      userAgent: `${deviceInfo.browser} on ${deviceInfo.os}`,
      country,
      language
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
