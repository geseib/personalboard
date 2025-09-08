# AI Guidance for Personal Board of Directors

This feature adds AI-powered guidance to help users build more effective Personal Boards of Directors using Amazon Bedrock with Claude 3.5 models.

## Features

### 1. Form Completion Guidance
- **Purpose**: Helps users fill out board member forms with thoughtful, specific content
- **When to use**: When adding or editing mentors, coaches, connectors, sponsors, or peers
- **What it provides**: Suggestions for what to learn, what to offer, meeting cadence, and notes

### 2. Goal Alignment Analysis
- **Purpose**: Identifies connections between user goals and current board members
- **When to use**: After defining goals or adding board members
- **What it provides**: Specific ways board members can help achieve goals, identifies gaps

### 3. Connection Suggestions
- **Purpose**: Helps find and approach potential board members
- **When to use**: When looking to add specific types of board members
- **What it provides**: Where to find candidates, how to approach them, value propositions

### 4. Board Composition Analysis
- **Purpose**: Evaluates overall board balance and effectiveness
- **When to use**: Periodically to assess board strategic value
- **What it provides**: Strengths, gaps, meeting cadence optimization, strategic recommendations

## Architecture

### Backend Components
- **Lambda Function**: `lambda-functions/ai-guidance/ai-guidance.js`
- **Bedrock Client**: `lambda-functions/ai-guidance/bedrock-chat.js`
- **API Gateway**: REST API with CORS support
- **Claude Models**: Sonnet 3.5 (primary) with Haiku 3.5 fallback

### Frontend Integration
- **Client Library**: `ai-client.js` - JavaScript functions for API calls
- **Usage**: Import functions and call with user data

## Deployment

### Prerequisites
1. AWS CLI configured with appropriate permissions
2. SAM CLI installed
3. Bedrock access enabled in your AWS account
4. Claude model access requested and approved

### Deploy Infrastructure
```bash
# Build and deploy the CloudFormation stack
sam build
sam deploy --guided

# Note the API Gateway URL from the outputs
# Update ai-client.js with the actual API URL
```

### Update API URL
After deployment, update the `AI_API_BASE_URL` in `ai-client.js` with your deployed API Gateway URL:

```javascript
const AI_API_BASE_URL = 'https://your-actual-api-id.execute-api.us-east-1.amazonaws.com/production';
```

## Frontend Integration Examples

### Form Completion Helper
```javascript
import { getFormCompletionGuidance } from './ai-client.js';

// In your form modal component
const handleGetAISuggestions = async () => {
  try {
    const suggestions = await getFormCompletionGuidance(
      'mentors',
      { 
        name: form.name, 
        role: form.role,
        connection: form.connection 
      },
      data.goals,
      data
    );
    
    // Display suggestions to user
    setSuggestions(suggestions.guidance);
  } catch (error) {
    console.error('Failed to get AI suggestions:', error);
  }
};
```

### Goal Alignment Analysis
```javascript
import { getGoalAlignmentGuidance } from './ai-client.js';

const analyzeGoalAlignment = async () => {
  try {
    const analysis = await getGoalAlignmentGuidance(
      data.goals,
      data
    );
    
    // Show alignment analysis
    setAlignmentAnalysis(analysis.guidance);
  } catch (error) {
    console.error('Failed to analyze goal alignment:', error);
  }
};
```

### Board Analysis
```javascript
import { getBoardAnalysis } from './ai-client.js';

const analyzeBoardComposition = async () => {
  try {
    const analysis = await getBoardAnalysis(
      data,  // Complete board data
      data.goals
    );
    
    // Display board analysis
    setBoardAnalysis(analysis.guidance);
  } catch (error) {
    console.error('Failed to analyze board composition:', error);
  }
};
```

## Cost Optimization

### Model Selection Strategy
1. **Primary**: Claude 3.5 Sonnet for high-quality, nuanced guidance
2. **Fallback**: Claude 3.5 Haiku for cost efficiency when Sonnet fails
3. **Token Limits**: Capped at 1500 tokens output, 0.3 temperature for focused responses

### Expected Costs
- **Sonnet**: ~$0.015 per request (typical guidance response)
- **Haiku**: ~$0.0025 per request (fallback scenarios)
- **API Gateway**: $3.50 per million requests
- **Lambda**: Minimal cost for 300s timeout, 512MB memory

## Security Features

### API Security
- **CORS**: Configured for frontend domain
- **No Authentication**: Currently open API (consider adding API keys for production)
- **IAM Permissions**: Lambda has minimal Bedrock-only permissions

### Data Privacy
- **No Storage**: AI guidance requests are not stored
- **Ephemeral Processing**: User data only exists during request processing
- **AWS Bedrock**: Follows AWS data privacy and security standards

## Error Handling

### Fallback Strategy
1. Try Claude 3.5 Sonnet
2. If Sonnet fails → automatically try Claude 3.5 Haiku
3. If both fail → return error with details

### Frontend Error Handling
```javascript
try {
  const guidance = await getAIGuidance(type, data);
  // Use guidance
} catch (error) {
  // Show user-friendly error message
  showErrorMessage('AI guidance temporarily unavailable. Please try again later.');
}
```

## Future Enhancements

### Planned Features
1. **Contextual Suggestions**: AI button on each form field
2. **Real-time Validation**: Check form completeness as user types
3. **Board Health Score**: Numerical scoring of board effectiveness
4. **Meeting Reminder Integration**: AI-generated meeting preparation
5. **Goal Progress Tracking**: AI analysis of goal achievement over time

### Possible UI Integration Points
- **"Get AI Help" buttons** in form modals
- **Analysis tab** in board view with comprehensive AI insights
- **Smart suggestions panel** that appears contextually
- **AI coach chat interface** for interactive guidance

## Troubleshooting

### Common Issues
1. **API URL not updated**: Ensure `ai-client.js` has correct deployed URL
2. **CORS errors**: Check API Gateway CORS configuration
3. **Bedrock permissions**: Verify Lambda has proper Bedrock access
4. **Model access**: Ensure Claude models are available in your AWS region

### Testing the API
```bash
# Test the deployed API directly
curl -X POST https://your-api-url/production/ai-guidance \
  -H "Content-Type: application/json" \
  -d '{
    "type": "form_completion",
    "data": {
      "formType": "mentors",
      "currentFields": {"name": "Test User"},
      "goals": [{"timeframe": "1 Year", "description": "Career growth"}]
    }
  }'
```

## Development

### Local Testing
```bash
# Test Lambda function locally
cd lambda-functions/ai-guidance
npm install
node -e "
const { handler } = require('./ai-guidance.js');
handler({
  httpMethod: 'POST',
  body: JSON.stringify({
    type: 'form_completion',
    data: { formType: 'mentors', currentFields: {} }
  })
}).then(console.log);
"
```

### Adding New Guidance Types
1. Add new case in `ai-guidance.js` switch statement
2. Create corresponding system and user prompt functions
3. Add new function to `ai-client.js`
4. Update this documentation

This AI guidance system provides intelligent, contextual help to make the Personal Board of Directors tool more effective and user-friendly.