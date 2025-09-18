# Personal Board of Directors - Claude Development Guide

## 🚨 IMPORTANT: Deployment Policy

**NEVER run deployment commands automatically.** Always ask the user to run them manually:
- `npm run deploy:frontend` for frontend changes
- `npm run deploy` for backend changes

This prevents automatic deployments that can timeout or interfere with the user's workflow.

## AWS Configuration

**AWS Profile**: `adminaccess`
```bash
export AWS_PROFILE=adminaccess
```

Always use this profile for all AWS operations. If you get credential errors, refresh with:
```bash
aws sso login
```

## Deployment Commands

### Frontend Deployment
```bash
npm run deploy:frontend
```
- Builds the application using Parcel
- Syncs dist/ folder to S3
- Invalidates CloudFront cache
- Use this for frontend-only changes

### Backend Deployment
```bash
npm run deploy
```
- Uses SAM to deploy lambda functions
- Updates CloudFormation stack
- Use this for lambda function changes

### Full Deployment
```bash
npm run build        # Build frontend
sam build && sam deploy  # Deploy backend
npm run deploy:frontend  # Deploy frontend
```

## Project Structure

### Frontend
- `app.js` - Main React application
- `admin.js` - Admin interface for prompt management
- `ai-client.js` - AI guidance API client
- `dist/` - Built frontend files (auto-generated)

### Backend
- `lambda-functions/ai-guidance/` - AI guidance lambda
- `lambda-functions/admin-data/` - Admin data management lambda
- `lambda-functions/auth/` - Authentication lambdas
- `template.yaml` - SAM CloudFormation template

### Key URLs
- **Website**: https://board.seibtribe.us
- **Admin**: https://board.seibtribe.us/admin.html
- **API**: https://hvr92xfbo6.execute-api.us-east-1.amazonaws.com/production

## Common Development Tasks

### Testing AI Guidance
1. Use admin interface to activate/manage prompts
2. Test on main site with superpowers, goals, etc.
3. Check lambda logs:
   ```bash
   aws logs tail /aws/lambda/personal-board-ai-guidance --since 10m
   ```

### Debugging Issues
- **Frontend errors**: Check browser console
- **Backend errors**: Check CloudWatch logs
- **Deployment issues**: Check SAM deploy output

### Database Access
- **Table**: Personal board DynamoDB table
- **Prompt structure**: `ADVISOR#{category}` with `SK: 'PROMPT'`
- **Categories**: skills, goals, mentors, coaches, sponsors, connectors, peers, overall

## Architecture Overview

- **Frontend**: React SPA with Parcel bundler, hosted on S3 + CloudFront
- **Backend**: Node.js Lambda functions with API Gateway
- **Database**: DynamoDB with prompt management system
- **AI**: AWS Bedrock (Claude) for guidance generation
- **Auth**: JWT-based with 6-digit access codes

## Key Features

- **Personal Board Builder**: Goals, mentors, coaches, sponsors, connectors, peers
- **AI Guidance**: Context-aware advice for each board member type
- **Admin Interface**: Prompt management with activate/deactivate/duplicate
- **Export**: JSON backup and PDF generation
- **Responsive**: Works on desktop and mobile

## Data Flow

1. User fills forms → Frontend validates → Stores locally
2. AI guidance → Frontend calls `/ai-guidance` → Lambda queries DynamoDB prompts → Bedrock API
3. Admin changes → `/admin-data` → DynamoDB prompt updates
4. Access codes → JWT tokens with expiration

## Important Notes

- Always test admin interface after backend deployments
- Frontend changes only need `npm run deploy:frontend`
- Backend changes need both `sam deploy` and frontend deployment
- Use `--AWS_PROFILE=adminaccess` for all AWS CLI commands
- Check CloudFormation stack "personal-board" for infrastructure changes
- Admin interface requires activated prompts for each category
- Superpowers maps to 'skills' category internally

## Troubleshooting

### Credential Issues
```bash
aws sso login
export AWS_PROFILE=adminaccess
```

### Build Issues
```bash
npm run clean  # Clean build artifacts
npm run build  # Rebuild frontend
```

### Lambda Issues
```bash
sam build && sam deploy  # Redeploy functions
aws logs tail /aws/lambda/personal-board-ai-guidance --since 30m
```