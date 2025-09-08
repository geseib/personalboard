// ai-guidance.js
const { bedrockChat } = require('./bedrock-chat');

/**
 * AWS Lambda handler for AI guidance on Personal Board of Directors
 * Provides intelligent suggestions for form completion and connections between goals and board members
 */
exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'CORS preflight successful' })
    };
  }

  try {
    // Debug logging
    console.log('Event object:', JSON.stringify({
      httpMethod: event.httpMethod,
      bodyType: typeof event.body,
      bodyLength: event.body ? event.body.length : 0,
      bodyPreview: event.body ? event.body.substring(0, 100) : 'null'
    }));

    let body;
    if (event.body) {
      try {
        let bodyString = event.body;
        
        // Check if body is base64 encoded (API Gateway can do this)
        if (event.isBase64Encoded) {
          console.log('Decoding base64 body (flag set)');
          bodyString = Buffer.from(event.body, 'base64').toString('utf-8');
        }
        
        // Try to parse as JSON first
        try {
          body = typeof bodyString === 'string' ? JSON.parse(bodyString) : bodyString;
          console.log('Parsed body successfully:', JSON.stringify(body).substring(0, 200));
        } catch (jsonError) {
          // If JSON parse fails, try base64 decoding as fallback
          console.log('JSON parse failed, trying base64 decode');
          try {
            const decodedString = Buffer.from(event.body, 'base64').toString('utf-8');
            body = JSON.parse(decodedString);
            console.log('Successfully decoded base64 and parsed JSON:', JSON.stringify(body).substring(0, 200));
          } catch (base64Error) {
            throw jsonError; // Re-throw original JSON error
          }
        }
      } catch (parseError) {
        console.error('JSON parse error:', parseError, 'Raw body:', event.body);
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid JSON in request body' })
        };
      }
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Request body is required' })
      };
    }

    const { type, data, context } = body;

    if (!type) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'guidance type is required' })
      };
    }

    let systemPrompt = '';
    let userPrompt = '';

    switch (type) {
      case 'form_completion':
        systemPrompt = getFormCompletionSystemPrompt();
        userPrompt = getFormCompletionUserPrompt(data, context);
        break;
      
      case 'goal_alignment':
        systemPrompt = getGoalAlignmentSystemPrompt();
        userPrompt = getGoalAlignmentUserPrompt(data, context);
        break;
      
      case 'connection_suggestions':
        systemPrompt = getConnectionSuggestionsSystemPrompt();
        userPrompt = getConnectionSuggestionsUserPrompt(data, context);
        break;
      
      case 'board_analysis':
        systemPrompt = getBoardAnalysisSystemPrompt();
        userPrompt = getBoardAnalysisUserPrompt(data, context);
        break;
      
      case 'mentor_advisor':
        systemPrompt = getMentorAdvisorSystemPrompt();
        userPrompt = getMentorAdvisorUserPrompt(data, context);
        break;
      
      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: `Unknown guidance type: ${type}` })
        };
    }

    const response = await bedrockChat({
      system: systemPrompt,
      user: userPrompt,
      max_tokens: 1500,
      temperature: 0.3
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        guidance: response.text,
        model: response.model,
        type: type
      })
    };

  } catch (error) {
    console.error('AI Guidance Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to generate AI guidance',
        message: error.message
      })
    };
  }
};

/**
 * System prompt for form completion guidance
 */
function getFormCompletionSystemPrompt() {
  return `You are an expert career coach and advisor helping users complete their Personal Board of Directors forms. You provide thoughtful, actionable suggestions based on best practices for professional relationships and career development.

Key principles:
- Focus on mutual value and authentic relationships
- Suggest specific, actionable content
- Consider the user's career stage and goals
- Emphasize quality over quantity in relationships
- Provide 2-3 concrete suggestions per field
- Keep responses concise and practical`;
}

/**
 * User prompt for form completion guidance
 */
function getFormCompletionUserPrompt(data, context) {
  const { formType, currentFields, goals, existingBoard } = data;
  
  let prompt = `Help me complete a ${formType} form for my Personal Board of Directors.\n\n`;
  
  if (goals && goals.length > 0) {
    prompt += `My goals are:\n`;
    goals.forEach(goal => {
      prompt += `- ${goal.timeframe}: ${goal.description || 'Not yet defined'}\n`;
    });
    prompt += `\n`;
  }

  if (currentFields) {
    prompt += `Current form fields:\n`;
    Object.entries(currentFields).forEach(([field, value]) => {
      prompt += `- ${field}: ${value || '[empty]'}\n`;
    });
    prompt += `\n`;
  }

  if (existingBoard && Object.keys(existingBoard).length > 0) {
    prompt += `My existing board includes:\n`;
    Object.entries(existingBoard).forEach(([type, members]) => {
      if (members && members.length > 0) {
        prompt += `- ${type}: ${members.length} member(s)\n`;
      }
    });
    prompt += `\n`;
  }

  prompt += `Please suggest specific content for the empty fields that would create value for both me and this ${formType}. Focus on concrete, actionable suggestions.`;

  return prompt;
}

/**
 * System prompt for goal alignment guidance
 */
function getGoalAlignmentSystemPrompt() {
  return `You are a strategic career advisor analyzing connections between career goals and Personal Board of Directors members. You identify opportunities for alignment and suggest how board members can help achieve specific goals.

Focus on:
- Concrete connections between goals and board member capabilities
- Specific ways board members can contribute to goal achievement
- Identifying gaps where new board members might be needed
- Actionable next steps for leveraging existing relationships`;
}

/**
 * User prompt for goal alignment analysis
 */
function getGoalAlignmentUserPrompt(data, context) {
  const { goals, boardMembers } = data;
  
  let prompt = `Analyze the alignment between my goals and current board members:\n\n`;
  
  if (goals && goals.length > 0) {
    prompt += `My goals:\n`;
    goals.forEach(goal => {
      prompt += `- ${goal.timeframe}: ${goal.description}\n`;
      if (goal.notes) prompt += `  Notes: ${goal.notes}\n`;
    });
    prompt += `\n`;
  }

  if (boardMembers && Object.keys(boardMembers).length > 0) {
    prompt += `My current board:\n`;
    Object.entries(boardMembers).forEach(([type, members]) => {
      if (members && members.length > 0) {
        prompt += `${type.toUpperCase()}:\n`;
        members.forEach(member => {
          prompt += `- ${member.name} (${member.role})\n`;
          if (member.whatToLearn) prompt += `  What to learn: ${member.whatToLearn}\n`;
          if (member.notes) prompt += `  Notes: ${member.notes}\n`;
        });
      }
    });
    prompt += `\n`;
  }

  prompt += `Identify specific connections between my goals and board members. Suggest how each member could help with specific goals and highlight any gaps where I need additional board members.`;

  return prompt;
}

/**
 * System prompt for connection suggestions
 */
function getConnectionSuggestionsSystemPrompt() {
  return `You are a networking expert helping users identify and approach potential Personal Board of Directors members. You provide practical advice on building professional relationships.

Focus on:
- Identifying potential candidates in various networks
- Suggesting authentic approach strategies
- Recommending value propositions for mutual benefit
- Practical next steps for relationship building`;
}

/**
 * User prompt for connection suggestions
 */
function getConnectionSuggestionsUserPrompt(data, context) {
  const { targetRole, currentNetwork, goals, existingBoard } = data;
  
  let prompt = `Help me find and approach potential ${targetRole} for my Personal Board of Directors.\n\n`;
  
  if (goals) {
    prompt += `My goals: ${goals}\n\n`;
  }

  if (currentNetwork) {
    prompt += `My current network includes: ${currentNetwork}\n\n`;
  }

  if (existingBoard) {
    prompt += `My existing board has: ${existingBoard}\n\n`;
  }

  prompt += `Suggest specific types of people I should look for, where to find them, and how to approach them authentically. Include what value I could offer in return.`;

  return prompt;
}

/**
 * System prompt for board analysis
 */
function getBoardAnalysisSystemPrompt() {
  return `You are a career strategist analyzing Personal Board of Directors composition. You evaluate balance, identify strengths and gaps, and suggest strategic improvements.

Focus on:
- Overall board composition and balance
- Identifying missing perspectives or expertise
- Suggesting strategic additions or changes
- Optimizing meeting cadences and relationships`;
}

/**
 * User prompt for board analysis
 */
function getBoardAnalysisUserPrompt(data, context) {
  const { boardData, goals } = data;
  
  let prompt = `Analyze my Personal Board of Directors composition:\n\n`;
  
  if (goals && goals.length > 0) {
    prompt += `My goals:\n`;
    goals.forEach(goal => {
      prompt += `- ${goal.timeframe}: ${goal.description}\n`;
    });
    prompt += `\n`;
  }

  if (boardData && Object.keys(boardData).length > 0) {
    prompt += `My current board:\n`;
    Object.entries(boardData).forEach(([type, members]) => {
      if (members && members.length > 0) {
        prompt += `${type.toUpperCase()} (${members.length}):\n`;
        members.forEach(member => {
          prompt += `- ${member.name}: ${member.role}, meets ${member.cadence}\n`;
        });
      } else {
        prompt += `${type.toUpperCase()}: none\n`;
      }
    });
    prompt += `\n`;
  }

  prompt += `Evaluate the balance and effectiveness of my board. Identify strengths, gaps, and strategic recommendations for improvement.`;

  return prompt;
}

/**
 * System prompt for mentor advisor guidance
 */
function getMentorAdvisorSystemPrompt() {
  return `<role>
You are an expert career advisor and executive coach specializing in professional mentorship relationships. Your expertise lies in helping professionals build meaningful, strategic mentor relationships that accelerate career growth.
</role>

<objectives>
- Clarify and focus mentor relationship goals
- Dive deep into specific, actionable mentorship strategies
- Provide pointed questions that reveal blind spots and opportunities
- Offer concrete recommendations for mentor engagement
</objectives>

<approach>
<guidelines>
- Ask probing questions that reveal underlying career aspirations and growth areas
- Focus on specificity over generalities
- Emphasize mutual value creation in mentor relationships
- Consider the mentor's perspective and time constraints
- Address potential relationship challenges proactively
</guidelines>

<output_format>
Structure your response using these exact headings:

# Questions
Provide 3-5 pointed, specific questions designed to:
- Clarify goals and expectations
- Identify potential blind spots
- Reveal opportunities for deeper engagement
- Uncover mutual value opportunities

# Recommendations
Provide 3-5 specific, actionable recommendations that:
- Enhance the mentorship relationship
- Create clear next steps
- Address any gaps or weaknesses identified
- Suggest concrete ways to add value to the mentor
</output_format>
</approach>

<personality>
You are direct, insightful, and focused on results. You challenge assumptions while being supportive. You prefer concrete examples over abstract advice.
</personality>`;
}

/**
 * User prompt for mentor advisor guidance
 */
function getMentorAdvisorUserPrompt(data, context) {
  const { currentFormData, goals, learnContent, existingMentors } = data;
  
  let prompt = `I'm working on building a stronger mentorship relationship and need your expert guidance.\n\n`;
  
  // Current mentor information
  if (currentFormData) {
    prompt += `<current_mentor_info>\n`;
    Object.entries(currentFormData).forEach(([field, value]) => {
      if (value && value.trim()) {
        prompt += `${field}: ${value}\n`;
      }
    });
    prompt += `</current_mentor_info>\n\n`;
  }
  
  // User's goals for context
  if (goals && goals.length > 0) {
    prompt += `<my_career_goals>\n`;
    goals.forEach(goal => {
      prompt += `- ${goal.timeframe}: ${goal.description}\n`;
      if (goal.notes) prompt += `  Notes: ${goal.notes}\n`;
    });
    prompt += `</my_career_goals>\n\n`;
  }
  
  // Learn content about mentors for context
  if (learnContent) {
    prompt += `<mentorship_context>\n`;
    prompt += `I understand that mentors are: ${learnContent}\n`;
    prompt += `</mentorship_context>\n\n`;
  }
  
  // Existing mentors for broader context
  if (existingMentors && existingMentors.length > 0) {
    prompt += `<existing_mentors>\n`;
    existingMentors.forEach(mentor => {
      prompt += `- ${mentor.name} (${mentor.role}): meets ${mentor.cadence || 'periodically'}\n`;
      if (mentor.whatToLearn) prompt += `  Learning: ${mentor.whatToLearn}\n`;
    });
    prompt += `</existing_mentors>\n\n`;
  }
  
  prompt += `<request>
Please analyze this mentorship situation and provide specific guidance. I want to make this relationship as valuable as possible for both of us, but I need help clarifying my approach and identifying areas I might be overlooking.

Focus on actionable insights that will help me be more strategic and thoughtful in this mentorship relationship.
</request>`;

  return prompt;
}