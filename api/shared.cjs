// Shared utility for all Azure Functions (CommonJS version)
const { TableClient, AzureNamedKeyCredential } = require("@azure/data-tables");
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
async function recordVisit(slug, ip, uaString, country = "Unknown") {
  try {
    const visitsTable = getTableClient("Visits");
    const visitId = uuidv4();
    const now = new Date().toISOString();
    const deviceInfo = parseUserAgent(uaString);

    await visitsTable.createEntity({
      partitionKey: slug,
      rowKey: visitId,
      timestamp: now,
      ip: ip ? ip.substring(0, 7) + "..." : "Hidden",
      userAgent: `${deviceInfo.browser} on ${deviceInfo.os}`,
      country
    });
  } catch (err) {
    console.error("Error saving visit:", err);
  }
}

// Increment visit counter in target table
async function incrementVisit(tableName, slug) {
  const table = getTableClient(tableName);
  try {
    const entity = await table.getEntity(
      tableName === "InternalLinks" ? "internal" : "free",
      slug
    );
    entity.visits = (entity.visits || 0) + 1;
    entity.lastVisitedAt = new Date().toISOString();
    await table.updateEntity(entity, "Replace");
  } catch (err) {
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
  parseUserAgent,
  recordVisit,
  incrementVisit,
  isLinkActive,
  normalizeSlug,
  jsonResponse,
  uuidv4
};
