import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import jwt from "jsonwebtoken";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.TABLE;
const JWT_SECRET = process.env.JWT_SECRET;

const json = (statusCode, body) => ({
  statusCode,
  headers: { 
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "POST,OPTIONS"
  },
  body: typeof body === "string" ? JSON.stringify({ message: body }) : JSON.stringify(body),
});

export const handler = async (event) => {
  // Handle OPTIONS request for CORS
  if (event.httpMethod === 'OPTIONS') {
    return json(200, { message: 'OK' });
  }

  try {
    const { code, clientId } = JSON.parse(event.body || "{}");
    if (!code || !clientId) return json(400, "Access code and client ID are required");

    // Validate code is 6 digits
    if (!/^\d{6}$/.test(code)) {
      return json(400, "Invalid code format. Please enter a 6-digit code.");
    }

    const now = Math.floor(Date.now() / 1000);
    const exp = now + 7 * 24 * 60 * 60; // 7 days expiry for Personal Board
    const ttl = exp + 24 * 60 * 60;  // delete 24h after expiry

    const cmd = new UpdateCommand({
      TableName: TABLE,
      Key: { code },
      ConditionExpression: "attribute_not_exists(#s) OR #s = :avail",
      UpdateExpression: "SET #s = :claimed, claimedAt = :now, expiresAt = :exp, clientId = :cid, ttl = :ttl",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: {
        ":avail": "AVAILABLE",
        ":claimed": "CLAIMED",
        ":now": now,
        ":exp": exp,
        ":cid": clientId,
        ":ttl": ttl,
      },
      ReturnValues: "NONE",
    });

    await ddb.send(cmd);

    const token = jwt.sign(
      { 
        sub: clientId, 
        jti: code, 
        iat: now, 
        exp,
        app: "personal-board"
      },
      JWT_SECRET,
      { algorithm: "HS256" }
    );

    return json(200, { 
      token, 
      expiresAt: exp,
      expiresIn: 7 * 24 * 60 * 60 // 7 days in seconds
    });
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException") {
      return json(401, "Invalid or already used access code");
    }
    console.error(err);
    return json(500, "Internal error processing your request");
  }
};