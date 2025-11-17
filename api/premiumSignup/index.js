import { getTableClient, jsonResponse } from "../shared.js";
import { v4 as uuidv4 } from "uuid";

export default async function (context, req) {
  const { email, displayName } = req.body || {};

  if (!email || !displayName) {
    context.res = jsonResponse(400, { error: "Missing email or displayName." });
    return;
  }

  try {
    const usersTable = getTableClient("Users");
    const userId = uuidv4();

    const entity = {
      partitionKey: "pending",
      rowKey: userId,
      email,
      displayName,
      status: "pending", // pending, approved, rejected
      requestedAt: new Date().toISOString()
    };

    await usersTable.createEntity(entity);

    context.res = jsonResponse(200, {
      message:
        "Premium signup request submitted. Wait for approval from the owner.",
      userId
    });
  } catch (err) {
    context.log.error("Premium signup error:", err.message);
    context.res = jsonResponse(500, { error: "Server error." });
  }
}
