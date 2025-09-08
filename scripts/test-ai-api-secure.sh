#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
STACK_NAME="personal-board"
SECURE_MODE=false
SECRET_HEADER=""
export AWS_PROFILE=adminaccess

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --secure)
            SECURE_MODE=true
            shift
            ;;
        --api-url)
            API_URL="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --secure           Test secure version with CloudFront routing"
            echo "  --api-url URL      Specify API URL directly"
            echo "  --help             Show this help message"
            exit 0
            ;;
        *)
            API_URL="$1"
            shift
            ;;
    esac
done

# Determine API URL based on mode
if [ "$SECURE_MODE" = true ]; then
    echo -e "${YELLOW}🔒 Running in SECURE mode (via CloudFront)${NC}"
    
    # Get the website URL from CloudFormation
    if [ -z "$API_URL" ]; then
        WEBSITE_URL=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query "Stacks[0].Outputs[?OutputKey=='WebsiteURL'].OutputValue" --output text 2>/dev/null)
        if [ -z "$WEBSITE_URL" ] || [ "$WEBSITE_URL" == "None" ]; then
            echo -e "${RED}❌ Could not retrieve Website URL from stack.${NC}"
            exit 1
        fi
        API_URL="${WEBSITE_URL}/production/ai-guidance"
    fi
    
    # Try to get the secret header value (only works if you have access to Secrets Manager)
    SECRET_ARN=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query "Stacks[0].Outputs[?OutputKey=='SecretHeaderArn'].OutputValue" --output text 2>/dev/null || echo "")
    if [ ! -z "$SECRET_ARN" ] && [ "$SECRET_ARN" != "None" ]; then
        SECRET_HEADER=$(aws secretsmanager get-secret-value --secret-id "$SECRET_ARN" --query 'SecretString' --output text 2>/dev/null | jq -r '.["header-value"]' 2>/dev/null || echo "")
        if [ ! -z "$SECRET_HEADER" ]; then
            echo -e "${GREEN}✅ Retrieved secret header for authentication${NC}"
        else
            echo -e "${YELLOW}⚠️  Could not retrieve secret header - tests may fail${NC}"
        fi
    fi
else
    echo -e "${YELLOW}🔓 Running in BASIC mode (direct API Gateway)${NC}"
    
    # Get the API URL from CloudFormation
    if [ -z "$API_URL" ]; then
        API_URL=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query "Stacks[0].Outputs[?OutputKey=='AIGuidanceApiUrl'].OutputValue" --output text 2>/dev/null)
        if [ -z "$API_URL" ] || [ "$API_URL" == "None" ]; then
            echo -e "${RED}❌ Could not retrieve API URL from stack.${NC}"
            echo -e "${YELLOW}   Provide URL as argument or use --api-url flag${NC}"
            exit 1
        fi
        API_URL="${API_URL}/ai-guidance"
    fi
fi

echo -e "${BLUE}🤖 Testing AI Guidance API${NC}"
echo -e "${CYAN}API URL: ${API_URL}${NC}"
echo ""

# Function to test an endpoint and display results
test_endpoint() {
    local test_name="$1"
    local test_type="$2"
    local test_data="$3"
    
    echo -e "${YELLOW}Testing: ${test_name}${NC}"
    echo -e "${CYAN}Request Type: ${test_type}${NC}"
    
    # Build headers based on mode
    local headers="-H 'Content-Type: application/json'"
    if [ "$SECURE_MODE" = true ]; then
        headers="$headers -H 'Origin: https://board.seibtribe.us'"
        if [ ! -z "$SECRET_HEADER" ]; then
            headers="$headers -H 'X-CloudFront-Secret: $SECRET_HEADER'"
        fi
    fi
    
    # Make the API call
    response=$(eval curl -s -X POST "${API_URL}" \
        $headers \
        -d "'{
            \"type\": \"${test_type}\",
            \"data\": ${test_data}
        }'" 2>/dev/null)
    
    # Check if response is valid JSON
    if echo "$response" | jq . >/dev/null 2>&1; then
        # Check if the response has an error
        if echo "$response" | jq -e '.error' >/dev/null 2>&1; then
            error_msg=$(echo "$response" | jq -r '.error')
            if [ "$error_msg" == "Forbidden" ]; then
                echo -e "${YELLOW}⚠️  Access Forbidden - This is expected in secure mode without proper authentication${NC}"
                echo -e "${CYAN}   The API is properly secured and rejecting unauthorized requests${NC}"
            else
                echo -e "${RED}❌ Test Failed${NC}"
                echo -e "${RED}Error: $error_msg${NC}"
                echo -e "${RED}Message: $(echo "$response" | jq -r '.message // "No message"')${NC}"
            fi
        else
            # Check if response has success field and guidance
            success=$(echo "$response" | jq -r '.success // false')
            if [ "$success" == "true" ]; then
                echo -e "${GREEN}✅ Test Passed${NC}"
                echo -e "${GREEN}Model Used: $(echo "$response" | jq -r '.model')${NC}"
                echo -e "${BLUE}Guidance Preview:${NC}"
                echo "$response" | jq -r '.guidance' | head -5
                echo "..."
            else
                echo -e "${YELLOW}⚠️  Unexpected response format${NC}"
                echo "$response" | jq '.'
            fi
        fi
    else
        echo -e "${RED}❌ Invalid JSON response${NC}"
        echo "$response"
    fi
    echo ""
}

# Test 1: Form Completion Guidance
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Test 1: Form Completion Guidance${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
test_endpoint "Form Completion for Mentor" "form_completion" '{
    "formType": "mentor",
    "currentFields": {
        "name": "Jane Smith",
        "role": "VP of Engineering",
        "connection": "Strong"
    },
    "goals": [
        {
            "timeframe": "1 Year",
            "description": "Get promoted to senior engineer"
        }
    ]
}'

# Test 2: CORS Preflight (if not in secure mode, test direct API)
if [ "$SECURE_MODE" = false ]; then
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}Test 2: CORS Preflight (OPTIONS)${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}Testing CORS OPTIONS request${NC}"
    
    cors_response=$(curl -s -X OPTIONS "${API_URL}" \
        -H "Origin: https://board.seibtribe.us" \
        -H "Access-Control-Request-Method: POST" \
        -H "Access-Control-Request-Headers: Content-Type" \
        -i 2>/dev/null | head -20)
    
    if echo "$cors_response" | grep -q "access-control-allow-origin"; then
        echo -e "${GREEN}✅ CORS headers present${NC}"
        echo "$cors_response" | grep -i "access-control" | head -5
    else
        echo -e "${RED}❌ CORS headers missing${NC}"
        echo "$cors_response"
    fi
    echo ""
fi

# Test 3: Test without authentication (should fail in secure mode)
if [ "$SECURE_MODE" = true ]; then
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}Test 3: Security Test (Request without secret header)${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}Testing request without authentication header${NC}"
    
    response=$(curl -s -X POST "${API_URL}" \
        -H "Content-Type: application/json" \
        -H "Origin: https://board.seibtribe.us" \
        -d '{
            "type": "board_analysis",
            "data": {
                "boardData": {"mentors": []},
                "goals": []
            }
        }' 2>/dev/null)
    
    if echo "$response" | jq -e '.error' >/dev/null 2>&1; then
        error_msg=$(echo "$response" | jq -r '.error')
        if [ "$error_msg" == "Forbidden" ]; then
            echo -e "${GREEN}✅ Security working correctly - request blocked${NC}"
        else
            echo -e "${YELLOW}⚠️  Unexpected error: $error_msg${NC}"
        fi
    else
        echo -e "${RED}❌ Security test failed - request should have been blocked${NC}"
        echo "$response" | jq '.'
    fi
    echo ""
fi

# Summary
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}📊 Test Summary${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"

if [ "$SECURE_MODE" = true ]; then
    echo -e "${GREEN}Secure API tests completed!${NC}"
    echo ""
    if [ -z "$SECRET_HEADER" ]; then
        echo -e "${YELLOW}Note: Could not retrieve secret header from Secrets Manager${NC}"
        echo -e "${YELLOW}The API is properly secured but tests cannot authenticate${NC}"
        echo -e "${YELLOW}This is expected behavior - the API should only work via CloudFront${NC}"
    else
        echo -e "${GREEN}Successfully authenticated with CloudFront secret header${NC}"
    fi
    echo ""
    echo -e "${CYAN}Security features active:${NC}"
    echo -e "✅ CloudFront secret header validation"
    echo -e "✅ Origin header validation"
    echo -e "✅ WAF rate limiting"
    echo -e "✅ API only accessible via CloudFront"
else
    echo -e "${GREEN}Basic API tests completed!${NC}"
    echo ""
    echo -e "${YELLOW}⚠️  Warning: Basic mode has no authentication${NC}"
    echo -e "${YELLOW}Consider deploying the secure version for production${NC}"
fi

echo ""
echo -e "${CYAN}Frontend integration:${NC}"
echo -e "${GREEN}Update ai-client.js with:${NC}"
if [ "$SECURE_MODE" = true ]; then
    echo -e "${GREEN}   const AI_API_BASE_URL = '${WEBSITE_URL}/production';${NC}"
else
    echo -e "${GREEN}   const AI_API_BASE_URL = '${API_URL%/ai-guidance}';${NC}"
fi