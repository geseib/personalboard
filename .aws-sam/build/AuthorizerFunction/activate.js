import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import jwt from "jsonwebtoken";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ssm = new SSMClient({});
const TABLE = process.env.TABLE;

let jwtSecret = null;

async function getJWTSecret() {
  if (!jwtSecret) {
    try {
      const command = new GetParameterCommand({
        Name: "/personal-board/jwt-secret",
        WithDecryption: true
      });
      const response = await ssm.send(command);
      jwtSecret = response.Parameter.Value;
    } catch (error) {
      console.error('Failed to retrieve JWT secret:', error);
      throw new Error('Authentication configuration error');
    }
  }
  return jwtSecret;
}

export const handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  // Handle CORS preflight OPTIONS request FIRST - before any other processing
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    // Parse body - handle both direct JSON and base64 encoded JSON
    let body;
    try {
      let bodyString = event.body;
      
      // Check if body is base64 encoded
      if (event.isBase64Encoded || (typeof bodyString === 'string' && /^[A-Za-z0-9+/]+=*$/.test(bodyString) && bodyString.length > 50)) {
        try {
          bodyString = Buffer.from(event.body, 'base64').toString('utf-8');
        } catch (e) {
          // Not base64, use as is
        }
      }
      
      body = typeof bodyString === 'string' ? JSON.parse(bodyString) : bodyString;
    } catch (parseError) {
      console.error('Failed to parse body:', event.body);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid JSON in request body' })
      };
    }

    const { code, clientId } = body;
    if (!code || !clientId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Access code and client ID are required" })
      };
    }

    // Validate code is 6 digits
    if (!/^\d{6}$/.test(code)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Invalid code format. Please enter a 6-digit code." })
      };
    }

    const now = Math.floor(Date.now() / 1000);
    const exp = now + 7 * 24 * 60 * 60; // 7 days expiry for Personal Board
    const ttl = exp + 24 * 60 * 60;  // delete 24h after expiry

    const cmd = new UpdateCommand({
      TableName: TABLE,
      Key: { code },
      ConditionExpression: "attribute_not_exists(#s) OR #s = :avail OR #s = :assigned",
      UpdateExpression: "SET #s = :claimed, claimedAt = :now, expiresAt = :exp, clientId = :cid, #ttl = :ttl",
      ExpressionAttributeNames: {
        "#s": "status",
        "#ttl": "ttl"
      },
      ExpressionAttributeValues: {
        ":avail": "AVAILABLE",
        ":assigned": "ASSIGNED",
        ":claimed": "CLAIMED",
        ":now": now,
        ":exp": exp,
        ":cid": clientId,
        ":ttl": ttl,
      },
      ReturnValues: "NONE",
    });

    await ddb.send(cmd);

    const secret = await getJWTSecret();
    const token = jwt.sign(
      { 
        sub: clientId, 
        jti: code, 
        iat: now, 
        exp,
        app: "personal-board"
      },
      secret,
      { algorithm: "HS256" }
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        token, 
        expiresAt: exp,
        expiresIn: 7 * 24 * 60 * 60 // 7 days in seconds
      })
    };
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException") {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ message: "Invalid or already used access code" })
      };
    }
    console.error(err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal error processing your request" })
    };
  }
};