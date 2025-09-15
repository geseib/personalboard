# DynamoDB Code-Activated API Gateway Auth (48h, client-locked)

This project gives you a **code-list in DynamoDB**, a one-time **activation** that
claims a code and returns a **JWT good for 48 hours**, and a **Lambda Authorizer**
that protects your API routes without hitting the database on every call.

## What you get
- **DynamoDB table** `AccessCodes` with TTL cleanup
- **ActivateFn** (`POST /activate`) — atomically claims a code and returns a JWT (48h)
- **AuthorizerFn** — verifies JWT on every protected route
- **GenerateCodesFn** — console-run Lambda that batch-creates codes in DynamoDB
- **ProtectedFn** (`GET /protected/hello`) — test endpoint, requires a valid token

## Deploy (SAM)
```bash
# Pre-reqs: AWS SAM CLI, Node 18/20, AWS credentials
cd dynamo-code-auth
npm install
sam build
sam deploy --guided
```

During `sam deploy --guided`, set the stack name and region.  
**Important:** Create a secure parameter for your JWT secret beforehand (or edit the template to provide another secret source):

```bash
aws ssm put-parameter   --name /myapp/jwt-secret   --type SecureString   --value "$(openssl rand -base64 48)"   --overwrite
```

> The template uses a CloudFormation dynamic reference: `{{resolve:ssm-secure:/myapp/jwt-secret:1}}`

## Try it

1) **Generate codes** (from AWS Console → Test the `GenerateCodesFn`) with an event like:
```json
{ "count": 10, "prefix": "EVT25-", "length": 8, "notes": "launch batch" }
```

2) On the frontend (local or your site), run something like:
```js
// Persist a clientId per-browser
let clientId = localStorage.getItem('clientId');
if (!clientId) { clientId = crypto.randomUUID(); localStorage.setItem('clientId', clientId); }

// Ask user for their code & activate once
const code = prompt("Enter your access code");
const r = await fetch("https://<your-api-id>.execute-api.<region>.amazonaws.com/prod/activate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ code, clientId })
});
if (!r.ok) throw new Error("Activation failed");
const { token, expiresAt } = await r.json();
localStorage.setItem("sessionToken", token);

// Call protected APIs with the token
const hello = await fetch("https://<your-api-id>.execute-api.<region>.amazonaws.com/prod/protected/hello", {
  headers: { Authorization: `Bearer ${localStorage.getItem("sessionToken")}` }
});
console.log(await hello.text());
```

3) **CORS**: add an API Gateway CORS configuration or a proxy layer if calling from a browser.  
4) **Rotation/cleanup**: claimed codes auto-expire in 48h; items are auto-removed later via table TTL.

## Security notes
- The JWT is **bound to the browser** via `sub = clientId` and expires in **48h**.
- You can add extra checks (origin, UA hash, IP hint) inside the authorizer for more stickiness.
- For higher assurance, move to Cognito + JWT authorizer later; this pattern is meant for “code gates”.

## Project layout
```
dynamo-code-auth/
  package.json
  template.yaml
  src/
    activate/activate.js
    authorizer/authorizer.js
    generate-codes/generate-codes.js
    protected/hello.js
```
