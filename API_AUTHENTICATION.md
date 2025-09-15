# API Authentication System

## Overview

This document outlines the implementation of a JWT-based authentication system for securing AI API endpoints using access codes and DynamoDB for token management.

## Architecture

- **JWT Tokens**: Secure session tokens for API access
- **Access Codes**: One-time activation codes generated in batches
- **DynamoDB**: Storage for access codes and session management
- **Lambda Functions**: Code generation and authentication endpoints

## Deployment Quickstart

### Prerequisites

- AWS CLI configured with appropriate permissions
- SAM CLI installed
- Node.js and npm

### 1. Create JWT Secret (One-time Setup)

Create a secure JWT secret in AWS Systems Manager Parameter Store:

```bash
aws ssm put-parameter \
  --name /myapp/jwt-secret \
  --type SecureString \
  --value "$(openssl rand -base64 48)" \
  --overwrite
```

### 2. Deploy Authentication Service

```bash
# Extract and setup the authentication service
unzip dynamo-code-auth.zip
cd dynamo-code-auth

# Install dependencies
npm install

# Build the SAM application
sam build

# Deploy with guided configuration
sam deploy --guided
```

During the guided deployment, you'll configure:
- Stack name
- AWS region
- Parameters (if any)
- Confirmation prompts for resource creation

### 3. Generate Access Codes

After deployment, generate access codes using the Lambda console:

1. Go to AWS Lambda Console
2. Find the `GenerateCodesFn` function
3. Create a test event with the following payload:

```json
{
  "count": 25,
  "prefix": "EVT25-",
  "length": 8,
  "notes": "launch batch"
}
```

**Parameters:**
- `count`: Number of codes to generate
- `prefix`: Code prefix for organization (e.g., event name)
- `length`: Length of random suffix
- `notes`: Description for tracking purposes

## Frontend Integration

### Client Authentication Flow

```javascript
// Generate or retrieve client ID
let clientId = localStorage.getItem('clientId');
if (!clientId) {
  clientId = crypto.randomUUID();
  localStorage.setItem('clientId', clientId);
}

// Prompt user for access code
const code = prompt("Enter your access code");

// Configure API base URL
const base = "<YOUR_API_BASE>"; // e.g., https://abc123.execute-api.us-east-1.amazonaws.com/prod

// Activate access code and get JWT token
const activationResponse = await fetch(`${base}/activate`, {
  method: "POST",
  headers: { 
    "Content-Type": "application/json" 
  },
  body: JSON.stringify({ 
    code, 
    clientId 
  })
});

if (!activationResponse.ok) {
  throw new Error("Activation failed");
}

const { token } = await activationResponse.json();
localStorage.setItem("sessionToken", token);

// Use token for protected API calls
const protectedResponse = await fetch(`${base}/protected/hello`, {
  headers: { 
    Authorization: `Bearer ${token}` 
  }
});

console.log(await protectedResponse.text());
```

## Implementation Details

### Authentication Endpoints

#### POST /activate
Activates an access code and returns a JWT token.

**Request:**
```json
{
  "code": "EVT25-ABC12345",
  "clientId": "uuid-client-identifier"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600
}
```

#### Protected Routes
All protected routes require the `Authorization: Bearer <token>` header.

### Security Features

1. **One-time Access Codes**: Each code can only be activated once
2. **Client Binding**: Tokens are bound to specific client IDs
3. **Expiration**: JWT tokens have configurable expiration times
4. **Secure Storage**: JWT secrets stored in AWS Parameter Store
5. **DynamoDB Tracking**: Code usage and session management

### Error Handling

Common error responses:

- `400 Bad Request`: Missing or invalid parameters
- `401 Unauthorized`: Invalid or expired token
- `403 Forbidden`: Code already used or not found
- `500 Internal Server Error`: System error

## Monitoring and Management

### Code Usage Tracking

Monitor access code usage through:
- DynamoDB table queries
- CloudWatch logs
- Lambda function metrics

### Token Management

- Tokens automatically expire based on configuration
- Client IDs track device/browser sessions
- Audit trail maintained in DynamoDB

## Security Best Practices

1. **Rotate JWT Secrets**: Regularly update the JWT secret in Parameter Store
2. **Monitor Usage**: Set up CloudWatch alarms for unusual activity
3. **Code Distribution**: Securely distribute access codes to authorized users
4. **HTTPS Only**: Ensure all API calls use HTTPS
5. **Token Storage**: Store tokens securely in browser localStorage/sessionStorage

## Integration with Personal Board

To integrate this authentication system with the Personal Board AI API:

1. Modify the AI guidance Lambda function to require JWT authentication
2. Update the frontend to handle code activation before API calls
3. Add error handling for authentication failures
4. Implement token refresh logic if needed

### Example AI API Integration

```javascript
// Enhanced AI guidance call with authentication
const callAIGuidance = async (prompt, section) => {
  const token = localStorage.getItem('sessionToken');
  
  if (!token) {
    throw new Error('Authentication required');
  }
  
  const response = await fetch(`${apiBase}/ai-guidance`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      prompt,
      section
    })
  });
  
  if (response.status === 401) {
    // Token expired, prompt for new code
    localStorage.removeItem('sessionToken');
    throw new Error('Session expired. Please enter a new access code.');
  }
  
  if (!response.ok) {
    throw new Error('AI guidance request failed');
  }
  
  return response.json();
};
```

## Troubleshooting

### Common Issues

1. **Invalid JWT Secret**: Ensure the Parameter Store value is correctly set
2. **DynamoDB Permissions**: Verify Lambda has read/write access to DynamoDB
3. **CORS Issues**: Configure CORS headers for browser requests
4. **Code Format**: Ensure access codes match expected format and prefix

### Debug Steps

1. Check CloudWatch logs for Lambda function errors
2. Verify DynamoDB table structure and data
3. Test endpoints with curl or Postman
4. Validate JWT token format and expiration