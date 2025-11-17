// Shared utility for all Azure Functions
import { TableClient, AzureNamedKeyCredential } from "@azure/data-tables";
import { v4 as uuidv4 } from "uuid";
import UAParser from "ua-parser-js";

const STORAGE_CONN = process.env.STORAGE_CONN;

// Utility to get TableClient
export function getTableClient(tableName) {
  const match = STORAGE_CONN.match(/AccountName=([^;]+);AccountKey=([^;]+)/);
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
export function parseUserAgent(uaString) {
  const parser = new UAParser(uaString);
  const result = parser.getResult();
  return {
    browser: result.browser.name || "Unknown",
    os: result.os.name || "Unknown",
    device: result.device.type || "Desktop"
  };
}

// Store a visit record
export async function recordVisit(slug, ip, uaString, country = "Unknown") {
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
export async function incrementVisit(tableName, slug) {
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
export function isLinkActive(entity) {
  const now = new Date();
  if (entity.startDate && new Date(entity.startDate) > now) return false;
  if (entity.expiryDate && new Date(entity.expiryDate) < now) return false;
  if (entity.visitLimit && entity.visits >= entity.visitLimit) return false;
  return true;
}

// Case sensitivity helper
export function normalizeSlug(slug, isCaseSensitive) {
  return isCaseSensitive ? slug : slug.toLowerCase();
}

// Generic JSON response
export function jsonResponse(status, data) {
  return {
    status,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  };
}


/*
import { TableClient, AzureNamedKeyCredential } from "@azure/data-tables";

const account = process.env.AZURE_STORAGE_ACCOUNT;
const accountKey = process.env.AZURE_STORAGE_KEY;

const credential = new AzureNamedKeyCredential(account, accountKey);

export function getTableClient(tableName) {
  return new TableClient(
    `https://${account}.table.core.windows.net`,
    tableName,
    credential
  );
}

// Normalize slug with optional case sensitivity
export function normalizeSlug(slug, isCaseSensitive = false) {
  let result = slug.trim().replace(/\s+/g, "-");
  if (!isCaseSensitive) result = result.toLowerCase();
  return result;
}

// Simple JSON response helper
export function jsonResponse(status, obj) {
  return { status, body: JSON.stringify(obj), headers: { "Content-Type": "application/json" } };
}

// Check if link is active (start/expiry date, visit limit)
export function isLinkActive(entity) {
  const now = new Date();
  if (entity.startDate && new Date(entity.startDate) > now) return false;
  if (entity.expiryDate && new Date(entity.expiryDate) < now) return false;
  if (entity.visitLimit && entity.visits >= entity.visitLimit) return false;
  return true;
}

// Increment visit count
export async function incrementVisit(tableName, slug) {
  const table = getTableClient(tableName);
  try {
    const entity = await table.getEntity("internal", slug).catch(() => null);
    if (entity) {
      entity.visits = (entity.visits || 0) + 1;
      await table.updateEntity(entity, "Merge");
    }
  } catch {}
}

// Record visit log
export async function recordVisit(slug, ip, userAgent, country = "Unknown") {
  const visitsTable = getTableClient("Visits");
  const timestamp = new Date().toISOString();
  const entity = {
    partitionKey: slug,
    rowKey: `${timestamp}-${Math.random().toString(36).substr(2, 6)}`,
    timestamp,
    ip,
    userAgent,
    country
  };
  await visitsTable.createEntity(entity);
}
*/