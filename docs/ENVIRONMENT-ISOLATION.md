# Environment Isolation Guide

This document explains how to maintain complete isolation between different deployment environments (production, board.dev, pbod) for the Personal Board of Directors application.

## Environment Overview

| Environment | Domain | Purpose | Stack Name |
|------------|--------|---------|------------|
| Production | board.seibtribe.us | Live production environment | personal-board |
| Board.Dev | board.dev.seibtribe.us | Development/staging environment | personal-board-boarddev |
| PBOD | pbod.seibtribe.us | Alternative deployment | personal-board-pbod |

## Infrastructure Isolation

Each environment maintains its own isolated infrastructure:

### DynamoDB Tables
- **Production**: `personal-board-prompt-management`, `personal-board-access-codes`
- **Board.Dev**: `personal-board-boarddev-prompt-management`, `personal-board-boarddev-access-codes`
- **PBOD**: `personal-board-pbod-prompt-management`, `personal-board-pbod-access-codes`

### API Gateways
- **Production**: `https://hvr92xfbo6.execute-api.us-east-1.amazonaws.com/production`
- **Board.Dev**: `https://rxbslpk6u9.execute-api.us-east-1.amazonaws.com/dev`
- **PBOD**: `https://3unsrrsapf.execute-api.us-east-1.amazonaws.com/pbod`

### S3 Buckets & CloudFront
- **Production**: `board.seibtribe.us-production`
- **Board.Dev**: `board.dev.seibtribe.us-dev`
- **PBOD**: `pbod.seibtribe.us-pbod`

### Lambda Functions
- **Production**: `personal-board-*`
- **Board.Dev**: `personal-board-boarddev-*`
- **PBOD**: `personal-board-pbod-*`

## Frontend API Routing

The frontend applications use environment-aware API routing to ensure data isolation:

### ai-client.js
```javascript
const getApiBaseUrl = () => {
  const hostname = window.location.hostname;

  // Board.dev environment
  if (hostname === 'board.dev.seibtribe.us' || hostname.includes('board.dev')) {
    return 'https://rxbslpk6u9.execute-api.us-east-1.amazonaws.com/dev';
  }

  // PBOD environment
  if (hostname === 'pbod.seibtribe.us' || hostname.includes('pbod')) {
    return 'https://3unsrrsapf.execute-api.us-east-1.amazonaws.com/pbod';
  }

  // Production (default)
  return 'https://hvr92xfbo6.execute-api.us-east-1.amazonaws.com/production';
};
```

### admin.js
The admin interface uses the same routing logic to ensure admin changes stay within the correct environment.

## Deployment Scripts

Each environment has dedicated deployment scripts:

### Board.Dev Deployment
```bash
# Full deployment (backend + frontend)
./scripts/deploy-boarddev.sh

# Frontend only
npm run deploy:boarddevfront
# or
./scripts/deploy-boarddev-frontend.sh
```

### Production Deployment
```bash
# Full deployment
./scripts/deploy-board.sh

# Frontend only
npm run deploy:frontend
# or
./scripts/deploy-board-frontend.sh
```

## Copying Prompts Between Environments

To copy prompt configurations from production to another environment:

### Script: copy-prompts-to-boarddev.sh
```bash
#!/bin/bash
# Located at: scripts/copy-prompts-to-boarddev.sh
# Copies all prompts from production to board.dev environment
# Handles DynamoDB's 25-item batch limit automatically
./scripts/copy-prompts-to-boarddev.sh
```

### Manual Process
1. Export prompts from source environment
2. Filter for ADVISOR# and PROMPT# items
3. Split into batches of 25 items (DynamoDB limit)
4. Write each batch to target environment

### Important Notes
- The script automatically handles batch splitting (25 items max per batch)
- All prompt configurations and advisor settings are copied
- Active/inactive states are preserved
- Custom prompts and themed prompts are included

## Deployment Parameters

Critical CloudFormation parameters that ensure environment isolation:

```yaml
DomainName: board.dev.seibtribe.us  # Must match target environment
Environment: dev                     # Environment identifier
StackName: personal-board-boarddev   # Unique stack name
```

These parameters MUST be explicitly passed during deployment to avoid resource conflicts.

## Common Issues and Solutions

### Issue: Resource Already Exists
**Cause**: CloudFormation using default (production) values instead of environment-specific values
**Solution**: Ensure all parameters are explicitly passed in deployment script:
```bash
sam deploy --config-env $SAM_CONFIG_ENV \
    --parameter-overrides \
    "DomainName=board.dev.seibtribe.us" \
    "Environment=dev" \
    "StackName=personal-board-boarddev"
```

### Issue: Data Showing Across Environments
**Cause**: Frontend using wrong API endpoint
**Solution**: Update both `ai-client.js` and `admin.js` with correct environment detection

### Issue: Stack in ROLLBACK_COMPLETE State
**Solution**: Delete the failed stack before redeploying:
```bash
aws cloudformation delete-stack --stack-name personal-board-boarddev
```

## Verification Checklist

After deploying to a new environment, verify:

- [ ] Correct API endpoint in browser network tab
- [ ] DynamoDB tables are environment-specific
- [ ] Admin changes don't affect other environments
- [ ] CloudFront distribution uses correct S3 bucket
- [ ] Lambda functions have environment prefix
- [ ] Prompts are loaded in admin interface

## Best Practices

1. **Always use environment-specific deployment scripts** - Don't modify production scripts for other environments
2. **Test API routing** - Verify network requests go to correct endpoints
3. **Maintain parameter consistency** - Keep samconfig.toml sections aligned with deployment scripts
4. **Document API URLs** - Keep this document updated when new environments are created
5. **Use batch operations** - When copying data, respect DynamoDB's 25-item batch limit