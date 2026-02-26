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

echo -e "${BLUE}🚀 Starting frontend deployment of ${PROJECT_NAME}...${NC}"

# Check if required tools are installed
echo -e "${YELLOW}📋 Checking prerequisites...${NC}"

if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not installed. Please install it first.${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed. Please install Node.js first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites met!${NC}"

# Build the React application
echo -e "${YELLOW}🔨 Building React application...${NC}"
npm install
npm run build

# Get outputs from existing CloudFormation stack
echo -e "${YELLOW}📊 Retrieving stack outputs...${NC}"
export AWS_PROFILE=adminaccess

BUCKET_NAME=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" --output text 2>/dev/null)
DISTRIBUTION_ID=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" --output text 2>/dev/null)
WEBSITE_URL=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query "Stacks[0].Outputs[?OutputKey=='WebsiteURL'].OutputValue" --output text 2>/dev/null)

if [ -z "$BUCKET_NAME" ] || [ -z "$DISTRIBUTION_ID" ]; then
    echo -e "${RED}❌ Could not retrieve stack outputs. Is the infrastructure deployed?${NC}"
    echo "Run 'npm run deploy' first to deploy the full infrastructure."
    exit 1
fi

echo -e "${BLUE}📦 Bucket Name: ${BUCKET_NAME}${NC}"
echo -e "${BLUE}🌐 Distribution ID: ${DISTRIBUTION_ID}${NC}"
echo -e "${BLUE}🔗 Website URL: ${WEBSITE_URL}${NC}"

# Sync built files to S3
echo -e "${YELLOW}📤 Syncing files to S3...${NC}"

# Delete old files first (optional - ensures clean deployment)
echo -e "${YELLOW}🧹 Cleaning S3 bucket...${NC}"
# aws s3 rm s3://$BUCKET_NAME/ --recursive --exclude "images/*"

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
    --cache-control "no-cache, no-store, must-revalidate" \
    --cli-connect-timeout 600 \
    --cli-read-timeout 600

# Sync CSS and JS files with longer cache
aws s3 sync dist/ s3://$BUCKET_NAME/ \
    --exclude "*" \
    --include "*.js" \
    --include "*.css" \
    --cache-control "public, max-age=31536000, immutable" \
    --cli-connect-timeout 600 \
    --cli-read-timeout 600

# Sync images with medium cache
aws s3 sync dist/ s3://$BUCKET_NAME/ \
    --exclude "*" \
    --include "*.png" \
    --include "*.jpg" \
    --include "*.jpeg" \
    --include "*.gif" \
    --include "*.svg" \
    --include "*.ico" \
    --cache-control "public, max-age=86400" \
    --cli-connect-timeout 600 \
    --cli-read-timeout 600

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

# Sync optimized images with long cache (content rarely changes)
if [ -d "dist/images/optimized" ]; then
    echo -e "${YELLOW}🖼️  Syncing optimized images with long cache...${NC}"
    aws s3 sync dist/images/optimized/ s3://$BUCKET_NAME/images/optimized/ \
        --cache-control "public, max-age=2592000, immutable" \
        --cli-connect-timeout 600 \
        --cli-read-timeout 600
fi

# Apply the bucket policy (in case it's missing)
echo -e "${YELLOW}🔒 Ensuring bucket policy is applied...${NC}"
cat > /tmp/bucket-policy.json <<EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowCloudFrontServicePrincipal",
            "Effect": "Allow",
            "Principal": {
                "Service": "cloudfront.amazonaws.com"
            },
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::${BUCKET_NAME}/*"
        }
    ]
}
EOF

aws s3api put-bucket-policy --bucket $BUCKET_NAME --policy file:///tmp/bucket-policy.json 2>/dev/null || true
rm /tmp/bucket-policy.json

# Create CloudFront invalidation
echo -e "${YELLOW}♻️  Creating CloudFront invalidation...${NC}"
INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id $DISTRIBUTION_ID \
    --paths "/*" \
    --query 'Invalidation.Id' \
    --output text)

echo -e "${BLUE}🔄 Invalidation ID: ${INVALIDATION_ID}${NC}"

# Optional: Wait for invalidation to complete (can be slow)
echo -e "${YELLOW}⏳ Waiting for invalidation to complete (this may take a few minutes)...${NC}"
echo -e "${YELLOW}   You can skip waiting by pressing Ctrl+C - the invalidation will continue in the background${NC}"
aws cloudfront wait invalidation-completed \
    --distribution-id $DISTRIBUTION_ID \
    --id $INVALIDATION_ID 2>/dev/null || true

echo -e "${GREEN}✅ Frontend deployment completed successfully!${NC}"
echo ""
echo -e "${BLUE}🎉 ${PROJECT_NAME} has been updated at:${NC}"
echo -e "${GREEN}🌐 ${WEBSITE_URL}${NC}"
echo ""
echo -e "${BLUE}📋 Deployment Summary:${NC}"
echo -e "${BLUE}   • Files synced to S3 bucket: ${BUCKET_NAME}${NC}"
echo -e "${BLUE}   • CloudFront cache invalidated: ${INVALIDATION_ID}${NC}"
echo -e "${BLUE}   • Website URL: ${WEBSITE_URL}${NC}"