#!/bin/bash

# Map existing prompts to the correct ADVISOR#{category} keys

echo "Setting up ADVISOR mappings..."

# Skills & Superpowers - use the superpowers_advisor prompt
curl -X PUT https://hvr92xfbo6.execute-api.us-east-1.amazonaws.com/production/admin/prompts/superpowers_advisor/activate
echo "✓ Skills advisor set to: superpowers_advisor"

# Goals - use the goals_advisor (which is superpowers_advisor)
# Since superpowers_advisor has type=goals_advisor, we can use it for goals too
# But we might want a different one for goals

# Mentors - use mentor_advisor
curl -X PUT https://hvr92xfbo6.execute-api.us-east-1.amazonaws.com/production/admin/prompts/mentor_advisor/activate
echo "✓ Mentors advisor set to: mentor_advisor"

# Coaches - use coach_advisor
curl -X PUT https://hvr92xfbo6.execute-api.us-east-1.amazonaws.com/production/admin/prompts/coach_advisor/activate
echo "✓ Coaches advisor set to: coach_advisor"

# Sponsors - use sponsor_advisor
curl -X PUT https://hvr92xfbo6.execute-api.us-east-1.amazonaws.com/production/admin/prompts/sponsor_advisor/activate
echo "✓ Sponsors advisor set to: sponsor_advisor"

# Connectors - use connector_advisor
curl -X PUT https://hvr92xfbo6.execute-api.us-east-1.amazonaws.com/production/admin/prompts/connector_advisor/activate
echo "✓ Connectors advisor set to: connector_advisor"

# Peers - use peer_advisor
curl -X PUT https://hvr92xfbo6.execute-api.us-east-1.amazonaws.com/production/admin/prompts/peer_advisor/activate
echo "✓ Peers advisor set to: peer_advisor"

# Overall - use board_analysis_advisor
curl -X PUT https://hvr92xfbo6.execute-api.us-east-1.amazonaws.com/production/admin/prompts/board_analysis_advisor/activate
echo "✓ Overall advisor set to: board_analysis_advisor"

echo "All ADVISOR mappings complete!"