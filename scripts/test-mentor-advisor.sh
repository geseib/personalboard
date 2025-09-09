#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

export AWS_PROFILE=adminaccess
STACK_NAME="personal-board"
API_URL=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query "Stacks[0].Outputs[?OutputKey=='AIGuidanceApiUrl'].OutputValue" --output text 2>/dev/null)

if [ -z "$API_URL" ] || [ "$API_URL" == "None" ]; then
    echo -e "${RED}❌ Could not retrieve API URL from stack.${NC}"
    exit 1
fi

echo -e "${BLUE}🎯 Testing AI Career Advisor for Mentors${NC}"
echo -e "${CYAN}API URL: ${API_URL}${NC}"
echo ""

# Test the mentor advisor endpoint
echo -e "${YELLOW}Testing mentor advisor guidance...${NC}"

response=$(curl -s -X POST "${API_URL}/ai-guidance" \
    -H "Content-Type: application/json" \
    -d '{
        "type": "mentor_advisor",
        "data": {
            "currentFormData": {
                "name": "Sarah Johnson",
                "role": "VP of Engineering",
                "connection": "Strong",
                "whatToLearn": "Leadership strategies and technical vision",
                "whatTheyGet": "Fresh perspective on emerging tech trends",
                "cadence": "Quarterly",
                "notes": "Met her at a conference last year, very approachable"
            },
            "goals": [
                {
                    "timeframe": "3 Month Goals",
                    "description": "Complete leadership training program"
                },
                {
                    "timeframe": "1 Year Goals", 
                    "description": "Get promoted to senior engineer"
                },
                {
                    "timeframe": "5 Year Goals",
                    "description": "Become a VP of Engineering"
                }
            ],
            "learnContent": "Senior leaders who provide wisdom, guidance, and strategic advice. They help you see the bigger picture, understand industry dynamics, and make important career decisions.",
            "existingMentors": [
                {
                    "name": "John Smith",
                    "role": "CTO",
                    "cadence": "Bi-weekly",
                    "whatToLearn": "Strategic thinking"
                }
            ]
        }
    }' 2>/dev/null)

# Check if response is valid JSON and contains guidance
if echo "$response" | jq . >/dev/null 2>&1; then
    success=$(echo "$response" | jq -r '.success // false')
    if [ "$success" == "true" ]; then
        echo -e "${GREEN}✅ Mentor Advisor Test Passed${NC}"
        echo -e "${GREEN}Model Used: $(echo "$response" | jq -r '.model')${NC}"
        echo ""
        
        # Extract and display the guidance
        guidance=$(echo "$response" | jq -r '.guidance')
        
        # Check if guidance contains Questions and Recommendations sections
        if echo "$guidance" | grep -q "# Questions" && echo "$guidance" | grep -q "# Recommendations"; then
            echo -e "${BLUE}📋 AI Career Advisor Response:${NC}"
            echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
            echo "$guidance"
            echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
            echo ""
            echo -e "${GREEN}✨ Perfect! AI provided structured questions and recommendations${NC}"
        else
            echo -e "${YELLOW}⚠️  Response format needs improvement${NC}"
            echo "$guidance" | head -10
        fi
    else
        echo -e "${RED}❌ Test Failed${NC}"
        echo -e "${RED}Error: $(echo "$response" | jq -r '.error // "Unknown error"')${NC}"
    fi
else
    echo -e "${RED}❌ Invalid JSON response${NC}"
    echo "$response"
fi

echo ""
echo -e "${BLUE}📝 To test in the web app:${NC}"
echo -e "1. Go to https://board.seibtribe.us"
echo -e "2. Navigate to the Mentors section"
echo -e "3. Click 'Add mentor' or edit an existing mentor"
echo -e "4. Fill in the form fields"
echo -e "5. Click the green 'Advise' button"
echo -e "6. Review the AI-generated questions and recommendations"