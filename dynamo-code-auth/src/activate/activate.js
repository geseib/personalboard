const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const jwt = require("jsonwebtoken");
const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ssm = new SSMClient({});
const TABLE = process.env.TABLE;

let jwtSecret = null;

const getJWTSecret = async () => {
  if (!jwtSecret) {
    const command = new GetParameterCommand({
      Name: "/myapp/jwt-secret",
      WithDecryption: true
    });
    const response = await ssm.send(command);
    jwtSecret = response.Parameter.Value;
  }
  return jwtSecret;
};

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  // Handle CORS preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    const { code, clientId } = JSON.parse(event.body || "{}");
    if (!code || !clientId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "code and clientId required" })
      };
    }

    const now = Math.floor(Date.now() / 1000);
    const exp = now + 48 * 60 * 60; // 48h
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

    // Get JWT secret from SSM
    const JWT_SECRET = await getJWTSecret();

    const token = jwt.sign(
      { sub: clientId, jti: code, iat: now, exp },
      JWT_SECRET,
      { algorithm: "HS256" }
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ token, expiresAt: exp })
    };
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException") {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ message: "Invalid or already-claimed code" })
      };
    }
    console.error(err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal error" })
    };
  }
};
