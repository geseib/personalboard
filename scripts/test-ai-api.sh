#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Get the API URL from CloudFormation or use command line argument
STACK_NAME="personal-board"
export AWS_PROFILE=adminaccess

if [ ! -z "$1" ]; then
    API_URL="$1"
else
    echo -e "${YELLOW}📊 Retrieving API URL from CloudFormation stack...${NC}"
    API_URL=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query "Stacks[0].Outputs[?OutputKey=='AIGuidanceApiUrl'].OutputValue" --output text 2>/dev/null)
    
    if [ -z "$API_URL" ] || [ "$API_URL" == "None" ]; then
        echo -e "${RED}❌ Could not retrieve API URL from stack. Please provide it as an argument:${NC}"
        echo -e "${YELLOW}   ./test-ai-api.sh https://your-api-id.execute-api.region.amazonaws.com/production${NC}"
        exit 1
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
    
    # Make the API call
    response=$(curl -s -X POST "${API_URL}/ai-guidance" \
        -H "Content-Type: application/json" \
        -d "{
            \"type\": \"${test_type}\",
            \"data\": ${test_data}
        }" 2>/dev/null)
    
    # Check if response is valid JSON
    if echo "$response" | jq . >/dev/null 2>&1; then
        # Check if the response has an error
        if echo "$response" | jq -e '.error' >/dev/null 2>&1; then
            echo -e "${RED}❌ Test Failed${NC}"
            echo -e "${RED}Error: $(echo "$response" | jq -r '.error')${NC}"
            echo -e "${RED}Message: $(echo "$response" | jq -r '.message // "No message"')${NC}"
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

# Test 2: Goal Alignment Analysis
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Test 2: Goal Alignment Analysis${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
test_endpoint "Goal Alignment Check" "goal_alignment" '{
    "goals": [
        {
            "timeframe": "3 Month Goals",
            "description": "Complete AWS certification"
        },
        {
            "timeframe": "1 Year Goals",
            "description": "Lead a major project"
        }
    ],
    "boardMembers": {
        "mentors": [
            {
                "name": "John Doe",
                "role": "CTO",
                "whatToLearn": "Leadership and strategy"
            }
        ],
        "coaches": [
            {
                "name": "Sarah Lee",
                "role": "AWS Solutions Architect",
                "whatToLearn": "Cloud architecture"
            }
        ]
    }
}'

# Test 3: Connection Suggestions
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Test 3: Connection Suggestions${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
test_endpoint "Finding a Sponsor" "connection_suggestions" '{
    "targetRole": "sponsor",
    "currentNetwork": "Tech company with 500 employees, active in local tech meetups",
    "goals": "Move into engineering management within 2 years",
    "existingBoard": "2 mentors, 1 coach, 3 peers"
}'

# Test 4: Board Analysis
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Test 4: Board Analysis${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
test_endpoint "Board Composition Analysis" "board_analysis" '{
    "boardData": {
        "mentors": [
            {"name": "Alice", "role": "CEO", "cadence": "Quarterly"}
        ],
        "coaches": [
            {"name": "Bob", "role": "Agile Coach", "cadence": "Weekly"}
        ],
        "peers": [
            {"name": "Charlie", "role": "Senior Engineer", "cadence": "Monthly"},
            {"name": "Diana", "role": "Product Manager", "cadence": "Bi-weekly"}
        ],
        "connectors": [],
        "sponsors": []
    },
    "goals": [
        {
            "timeframe": "5 Year Goals",
            "description": "Become a VP of Engineering"
        }
    ]
}'

# Test 5: CORS Preflight
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Test 5: CORS Preflight (OPTIONS)${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}Testing CORS OPTIONS request${NC}"
cors_response=$(curl -s -X OPTIONS "${API_URL}/ai-guidance" \
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

# Summary
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}📊 Test Summary${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}All basic API tests completed!${NC}"
echo ""
echo -e "${YELLOW}Next steps to lock down the API:${NC}"
echo -e "1. Add CloudFront origin header validation"
echo -e "2. Implement API key authentication"
echo -e "3. Add WAF rules for rate limiting"
echo -e "4. Configure CORS to only allow your domain"
echo ""
echo -e "${CYAN}To update the frontend with this API URL:${NC}"
echo -e "${GREEN}   Edit ai-client.js and set:${NC}"
echo -e "${GREEN}   const AI_API_BASE_URL = '${API_URL}';${NC}"