import jwt from "jsonwebtoken";
const JWT_SECRET = process.env.JWT_SECRET;

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

    const claims = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });

    // Optional: add extra binding (origin, UA hash, IP hint)
    return allow(event.methodArn, claims.sub || "user", { jti: claims.jti, exp: claims.exp });
  } catch {
    return deny(event.methodArn, "bad_token");
  }
};
