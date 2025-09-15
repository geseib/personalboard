import jwt from "jsonwebtoken";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const ssm = new SSMClient({});
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

const allow = (resource, principalId, ctx) => ({
  principalId,
  policyDocument: {
    Version: "2012-10-17",
    Statement: [{ Action: "execute-api:Invoke", Effect: "Allow", Resource: resource }],
  },
  context: ctx,
});

const deny = (resource, reason) => ({
  principalId: "anon",
  policyDocument: {
    Version: "2012-10-17",
    Statement: [{ Action: "execute-api:Invoke", Effect: "Deny", Resource: resource }],
  },
  context: { reason },
});

export const handler = async (event) => {
  try {
    const hdr = event.headers || {};
    const auth = hdr.authorization || hdr.Authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    
    if (!token) return deny(event.methodArn, "missing_token");

    // Verify the token
    const secret = await getJWTSecret();
    const claims = jwt.verify(token, secret, { algorithms: ["HS256"] });
    
    // Check if token is for Personal Board app
    if (claims.app !== "personal-board") {
      return deny(event.methodArn, "invalid_app");
    }
    
    // Check expiration (should be handled by jwt.verify but double-check)
    const now = Math.floor(Date.now() / 1000);
    if (claims.exp && claims.exp < now) {
      return deny(event.methodArn, "token_expired");
    }

    // Allow access with user context
    return allow(event.methodArn, claims.sub || "user", { 
      jti: claims.jti, 
      exp: claims.exp,
      clientId: claims.sub 
    });
  } catch (err) {
    console.error("Authorization error:", err);
    return deny(event.methodArn, "invalid_token");
  }
};