#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project configuration
PROJECT_NAME="Personal Board"
STACK_NAME="personal-board"

echo -e "${BLUE}🚀 Starting deployment of ${PROJECT_NAME}...${NC}"

# Check if required tools are installed
echo -e "${YELLOW}📋 Checking prerequisites...${NC}"

if ! command -v sam &> /dev/null; then
    echo -e "${RED}❌ SAM CLI is not installed. Please install it first.${NC}"
    echo "Installation guide: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html"
    exit 1
fi

if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not installed. Please install it first.${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed. Please install Node.js first.${NC}"
    exit 1
fi

# Check if HOSTED_ZONE_ID is set
if [ -z "$HOSTED_ZONE_ID" ]; then
    echo -e "${RED}❌ HOSTED_ZONE_ID environment variable is not set.${NC}"
    echo "Please set it with: export HOSTED_ZONE_ID=your-hosted-zone-id"
    exit 1
fi

echo -e "${GREEN}✅ All prerequisites met!${NC}"

# Build the React application
echo -e "${YELLOW}🔨 Building React application...${NC}"
npm install
npm run build

# Build SAM application
echo -e "${YELLOW}🏗️  Building SAM application...${NC}"
sam build

# Deploy the infrastructure
echo -e "${YELLOW}🚀 Deploying infrastructure...${NC}"
sam deploy

# Get outputs from CloudFormation stack
echo -e "${YELLOW}📊 Retrieving stack outputs...${NC}"
BUCKET_NAME=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" --output text)
DISTRIBUTION_ID=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" --output text)
WEBSITE_URL=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query "Stacks[0].Outputs[?OutputKey=='WebsiteURL'].OutputValue" --output text)
AI_API_URL=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query "Stacks[0].Outputs[?OutputKey=='AIGuidanceApiUrl'].OutputValue" --output text 2>/dev/null || echo "N/A")

echo -e "${BLUE}📦 Bucket Name: ${BUCKET_NAME}${NC}"
echo -e "${BLUE}🌐 Distribution ID: ${DISTRIBUTION_ID}${NC}"
echo -e "${BLUE}🔗 Website URL: ${WEBSITE_URL}${NC}"
if [ "$AI_API_URL" != "N/A" ]; then
    echo -e "${BLUE}🤖 AI API URL: ${AI_API_URL}${NC}"
fi

# Sync built files to S3
echo -e "${YELLOW}📤 Syncing files to S3...${NC}"

# Sync HTML files with no cache
aws s3 sync dist/ s3://$BUCKET_NAME/ \
    --exclude "*.js" \
    --exclude "*.css" \
    --exclude "*.png" \
    --exclude "*.jpg" \
    --exclude "*.jpeg" \
    --exclude "*.gif" \
    --exclude "*.svg" \
    --exclude "*.ico" \
    --cache-control "no-cache, no-store, must-revalidate"

# Sync CSS and JS files with longer cache
aws s3 sync dist/ s3://$BUCKET_NAME/ \
    --exclude "*" \
    --include "*.js" \
    --include "*.css" \
    --cache-control "public, max-age=31536000, immutable"

# Sync images with medium cache
aws s3 sync dist/ s3://$BUCKET_NAME/ \
    --exclude "*" \
    --include "*.png" \
    --include "*.jpg" \
    --include "*.jpeg" \
    --include "*.gif" \
    --include "*.svg" \
    --include "*.ico" \
    --cache-control "public, max-age=86400"

# Copy images from public directory if they exist
if [ -d "public/images" ]; then
    echo -e "${YELLOW}🖼️  Syncing images from public directory...${NC}"
    aws s3 sync public/images/ s3://$BUCKET_NAME/images/ \
        --cache-control "public, max-age=86400"
fi

# Copy images from root directory if they exist (for slides)
if [ -d "images" ]; then
    echo -e "${YELLOW}🖼️  Syncing images from root directory...${NC}"
    aws s3 sync images/ s3://$BUCKET_NAME/images/ \
        --cache-control "public, max-age=86400"
fi

# Create CloudFront invalidation
echo -e "${YELLOW}♻️  Creating CloudFront invalidation...${NC}"
INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id $DISTRIBUTION_ID \
    --paths "/*" \
    --query 'Invalidation.Id' \
    --output text)

echo -e "${BLUE}🔄 Invalidation ID: ${INVALIDATION_ID}${NC}"

# Wait for invalidation to complete
echo -e "${YELLOW}⏳ Waiting for invalidation to complete...${NC}"
aws cloudfront wait invalidation-completed \
    --distribution-id $DISTRIBUTION_ID \
    --id $INVALIDATION_ID

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo ""
echo -e "${BLUE}🎉 ${PROJECT_NAME} is now live at:${NC}"
echo -e "${GREEN}🌐 ${WEBSITE_URL}${NC}"
echo ""
echo -e "${BLUE}📋 Deployment Summary:${NC}"
echo -e "${BLUE}   • S3 Bucket: ${BUCKET_NAME}${NC}"
echo -e "${BLUE}   • CloudFront Distribution: ${DISTRIBUTION_ID}${NC}"
echo -e "${BLUE}   • Website URL: ${WEBSITE_URL}${NC}"
echo -e "${BLUE}   • Invalidation ID: ${INVALIDATION_ID}${NC}"
if [ "$AI_API_URL" != "N/A" ]; then
    echo -e "${BLUE}   • AI API URL: ${AI_API_URL}${NC}"
    echo ""
    echo -e "${YELLOW}📝 Don't forget to update ai-client.js with the API URL:${NC}"
    echo -e "${GREEN}   const AI_API_BASE_URL = '${AI_API_URL}';${NC}"
fi