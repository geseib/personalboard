#!/bin/bash
# Shared deploy settings, sourced by the deploy-<env>.sh scripts after STACK_NAME is set.
# Fills values that are the same every time and reuses secrets already deployed to this stack,
# so a routine redeploy only needs AWS credentials. Secret values are never printed.

# Route 53 zone for seibtribe.us (matches samconfig.toml).
export HOSTED_ZONE_ID="${HOSTED_ZONE_ID:-ZB9TUA073B5SH}"

# Read one environment variable from a deployed Lambda; prints nothing if unavailable.
deployed_lambda_env() {
    local value
    value=$(aws lambda get-function-configuration --function-name "$1" \
        --query "Environment.Variables.$2" --output text 2>/dev/null) || return 0
    if [ "$value" != "None" ]; then printf '%s' "$value"; fi
    return 0
}

if [ -z "$GITHUB_TOKEN" ]; then
    GITHUB_TOKEN=$(deployed_lambda_env "${STACK_NAME}-feedback" GITHUB_TOKEN)
    if [ -n "$GITHUB_TOKEN" ]; then echo -e "${GREEN}🔑 Reusing GitHub token from ${STACK_NAME}-feedback${NC}"; fi
fi
if [ -z "$ADMIN_PASSWORD" ]; then
    ADMIN_PASSWORD=$(deployed_lambda_env "${STACK_NAME}-admin-data" ADMIN_PASSWORD)
    if [ -n "$ADMIN_PASSWORD" ]; then echo -e "${GREEN}🔑 Reusing admin password from ${STACK_NAME}-admin-data${NC}"; fi
fi
# Optional: keep Gemini enabled if this stack already has it configured.
if [ -z "${GEMINI_API_KEY_PARAMETER+set}" ]; then
    GEMINI_API_KEY_PARAMETER=$(deployed_lambda_env "${STACK_NAME}-ai-guidance" GEMINI_API_KEY_PARAMETER)
fi
export GITHUB_TOKEN ADMIN_PASSWORD GEMINI_API_KEY_PARAMETER

if [ -z "$GITHUB_TOKEN" ]; then
    echo -e "${RED}❌ GITHUB_TOKEN is not set and could not be read from ${STACK_NAME}-feedback.${NC}"
    echo "Set it with: export GITHUB_TOKEN=your_github_token  (or run 'aws sso login' if credentials expired)"
    exit 1
fi
if [ -z "$ADMIN_PASSWORD" ]; then
    echo -e "${RED}❌ ADMIN_PASSWORD is not set and could not be read from ${STACK_NAME}-admin-data.${NC}"
    echo "Set it with: export ADMIN_PASSWORD=your_admin_password"
    exit 1
fi
