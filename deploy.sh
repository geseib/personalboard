#!/bin/bash

# Personal Board Deployment Script
# Sets up environment and deploys the SAM stack

# Check if GitHub token is set
if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ Error: GITHUB_TOKEN environment variable is not set"
    echo "Please set it with: export GITHUB_TOKEN=your_token_here"
    exit 1
fi

# Ensure AWS profile is set
export AWS_PROFILE=adminaccess

echo "🚀 Starting Personal Board deployment..."
echo "📋 Using GitHub token: ${GITHUB_TOKEN:0:20}..."

# Build and deploy
echo "🔨 Building SAM application..."
sam build

if [ $? -ne 0 ]; then
    echo "❌ SAM build failed"
    exit 1
fi

echo "🚀 Deploying SAM application..."
sam deploy --parameter-overrides GitHubToken="$GITHUB_TOKEN"

if [ $? -eq 0 ]; then
    echo "✅ Deployment completed successfully!"
    
    # Extract the feedback API URL from outputs
    FEEDBACK_API_URL=$(aws cloudformation describe-stacks \
        --stack-name personal-board \
        --query 'Stacks[0].Outputs[?OutputKey==`FeedbackApiUrl`].OutputValue' \
        --output text)
    
    if [ ! -z "$FEEDBACK_API_URL" ]; then
        echo "📝 Feedback API URL: $FEEDBACK_API_URL"
        echo ""
        echo "🔧 Next step: Update feedback.js with the API URL:"
        echo "Replace 'YOUR_LAMBDA_API_URL_HERE' with '$FEEDBACK_API_URL'"
    fi
else
    echo "❌ Deployment failed"
    exit 1
fi