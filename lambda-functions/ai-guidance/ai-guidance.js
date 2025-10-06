// ai-guidance.js
const { bedrockChat } = require('./bedrock-chat');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');
const {
  getEnhancedBoardMemberAdvisorSystemPrompt,
  getEnhancedBoardMemberAdvisorUserPrompt,
  getEnhancedGoalsAdvisorSystemPrompt,
  getEnhancedSkillsAdvisorSystemPrompt,
  getEnhancedBoardAnalysisAdvisorSystemPrompt
} = require('./enhanced-prompt-templates');

const {
  calculateCompletionScores,
  assessAdvisorReadiness,
  analyzeSkillGoalAlignment,
  analyzeBoardGaps,
  determineJourneyStage,
  getIntelligentInsights
} = require('./advisor-intelligence');

const client = new DynamoDBClient();
const dynamodb = DynamoDBDocumentClient.from(client);
const PROMPT_TABLE = process.env.PROMPT_MANAGEMENT_TABLE || process.env.DYNAMODB_TABLE;

/**
 * Get active prompt configuration from DynamoDB using ADVISOR#{category} structure
 */
async function getActivePromptConfig(category) {
    try {
        // First get the active prompt ID for this category using ADVISOR#{category}
        const activeResult = await dynamodb.send(new GetCommand({
            TableName: PROMPT_TABLE,
            Key: {
                PK: `ADVISOR#${category}`,
                SK: 'PROMPT'
            }
        }));

        if (!activeResult.Item) {
            console.log(`No active prompt found for category: ${category}`);
            return null;
        }

        const activePromptId = activeResult.Item.activePromptId;

        // Check if activePromptId is 'None' (fallback mode)
        if (activePromptId === 'None') {
            console.log(`Category ${category} is set to fallback mode (None)`);
            return null; // This will trigger the hardcoded fallback prompts
        }

        // Now get the prompt configuration
        const promptResult = await dynamodb.send(new GetCommand({
            TableName: PROMPT_TABLE,
            Key: {
                PK: `PROMPT#${activePromptId}`,
                SK: 'CONFIG'
            }
        }));

        if (!promptResult.Item) {
            console.log(`Prompt configuration not found for ID: ${activePromptId}`);
            return null;
        }

        return promptResult.Item;
    } catch (error) {
        console.error('Error getting active prompt config:', error);
        return null;
    }
}

/**
 * Replace variables in prompt template
 */
function replacePromptVariables(template, data, context) {
    let prompt = template;

    // Handle complete user data (new format)
    let completeUserData = null;
    if (data.existingMembers && typeof data.existingMembers === 'object' && !Array.isArray(data.existingMembers)) {
        completeUserData = data.existingMembers;
    }

    // Handle board analysis data - when data contains boardData property
    if (data.boardData && typeof data.boardData === 'object') {
        // For board analysis, use boardData as the main data source
        const boardData = data.boardData;

        // Extract goals from boardData
        if (boardData.goals) {
            data.goals = boardData.goals;
        }

        // Extract skills from boardData.you.superpowers
        if (boardData.you && boardData.you.superpowers) {
            data.skills = boardData.you.superpowers;
        }

        // Set completeUserData to boardData for profile replacement
        completeUserData = boardData;
    }

    // Extract member details from currentFormData
    let memberName = '';
    let memberRole = '';
    let currentRelationship = '';

    if (data.currentFormData) {
        memberName = data.currentFormData.name || '';
        memberRole = data.currentFormData.role || '';
        currentRelationship = data.currentFormData.connection || '';
    }

    console.log('DEBUG - replacePromptVariables extracted:', {
        memberName,
        memberRole,
        currentRelationship,
        hasCompleteData: !!completeUserData,
        hasBoardData: !!data.boardData
    });

    // Replace standard variables
    prompt = prompt.replace(/\{currentFields\}/g, JSON.stringify(data.currentFields || data.currentFormData || {}));
    prompt = prompt.replace(/\{goals\}/g, JSON.stringify(data.goals || []));
    prompt = prompt.replace(/\{boardMembers\}/g, JSON.stringify(context.boardMembers || []));
    prompt = prompt.replace(/\{skills\}/g, JSON.stringify(data.skills || []));

    // Replace member-specific variables
    prompt = prompt.replace(/\{memberName\}/g, memberName);
    prompt = prompt.replace(/\{memberRole\}/g, memberRole);
    prompt = prompt.replace(/\{currentRelationship\}/g, currentRelationship);

    // Replace complete user profile for comprehensive context
    if (completeUserData) {
        let profileText = '';

        // Goals
        if (completeUserData.goals && Array.isArray(completeUserData.goals) && completeUserData.goals.length > 0) {
            profileText += 'Goals:\n';
            completeUserData.goals.forEach(goal => {
                profileText += `- ${goal.timeframe || goal.title || 'Goal'}: ${goal.description || goal.content || ''}\n`;
                if (goal.notes) profileText += `  Notes: ${goal.notes}\n`;
            });
            profileText += '\n';
        }

        // Superpowers/Skills
        if (completeUserData.you?.superpowers && Array.isArray(completeUserData.you.superpowers) && completeUserData.you.superpowers.length > 0) {
            profileText += 'My Key Skills/Superpowers:\n';
            completeUserData.you.superpowers.forEach(skill => {
                profileText += `- ${skill.name || skill.title}: ${skill.description || ''}\n`;
                if (skill.notes) profileText += `  ${skill.notes}\n`;
            });
            profileText += '\n';
        }

        // Existing board members
        const boardMemberTypes = ['mentors', 'coaches', 'sponsors', 'connectors', 'peers'];
        boardMemberTypes.forEach(type => {
            if (completeUserData[type] && Array.isArray(completeUserData[type]) && completeUserData[type].length > 0) {
                profileText += `Current ${type}:\n`;
                completeUserData[type].forEach(member => {
                    profileText += `- ${member.name || 'Unknown'}`;
                    if (member.role) profileText += ` (${member.role})`;
                    if (member.connection) profileText += ` - Connection: ${member.connection}`;
                    if (member.cadence) profileText += ` - Meets: ${member.cadence}`;
                    profileText += '\n';
                    if (member.whatToLearn) profileText += `  Learning: ${member.whatToLearn}\n`;
                    if (member.whatTheyGet) profileText += `  Providing: ${member.whatTheyGet}\n`;
                    if (member.notes) profileText += `  Notes: ${member.notes}\n`;
                });
                profileText += '\n';
            }
        });

        // Replace placeholder for complete profile - handle common template patterns
        prompt = prompt.replace(/\{completeProfile\}/g, profileText);
        prompt = prompt.replace(/\{my_current_situation\}/g, profileText);
        prompt = prompt.replace(/\{\}/g, profileText); // Handle empty placeholder
    } else {
        // Fallback if no complete data
        prompt = prompt.replace(/\{completeProfile\}/g, 'No additional profile information available');
        prompt = prompt.replace(/\{my_current_situation\}/g, 'No additional profile information available');
        prompt = prompt.replace(/\{\}/g, 'No additional profile information available');
    }

    return prompt;
}

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

    // Check if enhanced mode is enabled
    const isEnhancedMode = context?.enhancedMode === true;
    const userData = context?.userData || {};

    console.log(`Enhanced mode: ${isEnhancedMode}, User data available: ${!!userData && Object.keys(userData).length > 0}`);

    // Generate intelligent insights if enhanced mode is enabled
    let insights = null;
    if (isEnhancedMode && userData && Object.keys(userData).length > 0) {
      try {
        console.log('Generating intelligent insights for enhanced mode...');
        insights = getIntelligentInsights(userData);
        console.log(`Insights generated: journey stage=${insights.journeyStage}, overall completion=${Math.round((insights.completionScores.overall || 0) * 100)}%`);
      } catch (error) {
        console.error('Error generating intelligent insights:', error);
        // Continue without enhanced features if insights fail
      }
    }

    // Map guidance types to categories for DynamoDB lookup using new category-based structure
    let category;
    if (type === 'mentor_advisor' || type === 'board_member_advisor') {
      // For board member advisors, use the specific member type as the category
      category = data.memberType || 'mentors'; // Use memberType from request data
    } else if (type.endsWith('_advisor')) {
      // Handle specific advisor types like mentors_advisor, coaches_advisor, etc.
      const advisorType = type.replace('_advisor', '');
      category = advisorType; // mentors_advisor -> mentors, coaches_advisor -> coaches, etc.
    } else {
      // Map other guidance types to appropriate categories
      const categoryMap = {
        'form_completion': 'overall', // General form completion uses overall advisor
        'goal_alignment': 'goals',
        'connection_suggestions': 'overall', // Connection suggestions use overall advisor
        'board_analysis': 'overall',
        'goals_advisor': 'goals',
        'board_analysis_advisor': 'overall',
        'superpowers_advisor': 'skills' // Skills/Superpowers use skills category
      };
      category = categoryMap[type];
    }

    if (!category) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: `Unknown guidance type: ${type}` })
      };
    }

    // Get active prompt configuration from DynamoDB
    console.log(`Looking up active prompt for category: ${category}`);
    const promptConfig = await getActivePromptConfig(category);
    console.log(`Prompt config found:`, promptConfig ? 'YES' : 'NO');

    if (!promptConfig) {
      // Fallback to hardcoded prompts if no DynamoDB configuration found or if activePromptId is 'None'
      console.log(`No DynamoDB config found for category ${category} or fallback mode active, using hardcoded prompts`);

      let systemPrompt = '';
      let userPrompt = '';

      // Use enhanced prompts if enhanced mode is enabled and insights are available
      if (isEnhancedMode && insights) {
        console.log(`Using enhanced prompts for type: ${type}`);
        switch (type) {
          case 'form_completion':
            systemPrompt = getFormCompletionSystemPrompt();
            userPrompt = getFormCompletionUserPrompt(data, context);
            break;
          case 'board_member_advisor':
            systemPrompt = getEnhancedBoardMemberAdvisorSystemPrompt(data.memberType, insights);
            userPrompt = getEnhancedBoardMemberAdvisorUserPrompt({...data, userData}, insights);
            break;
          case 'mentor_advisor':
            systemPrompt = getEnhancedBoardMemberAdvisorSystemPrompt('mentors', insights);
            userPrompt = getEnhancedBoardMemberAdvisorUserPrompt({...data, memberType: 'mentors', userData}, insights);
            break;
          case 'goals_advisor':
            systemPrompt = getEnhancedGoalsAdvisorSystemPrompt(insights);
            userPrompt = getGoalsAdvisorUserPrompt(data, context); // Use standard user prompt for now
            break;
          case 'superpowers_advisor':
            systemPrompt = getEnhancedSkillsAdvisorSystemPrompt(insights);
            userPrompt = getSuperpowersAdvisorUserPrompt(data, context); // Use standard user prompt for now
            break;
          case 'board_analysis_advisor':
            systemPrompt = getEnhancedBoardAnalysisAdvisorSystemPrompt(insights);
            userPrompt = getBoardAnalysisAdvisorUserPrompt(data, context); // Use standard user prompt for now
            break;
          default:
            // Check if it's a generic advisor type (e.g., coaches_advisor, sponsors_advisor, etc.)
            if (type.endsWith('_advisor')) {
              const advisorType = type.replace('_advisor', '');
              // Use enhanced board member advisor for all specific advisor types
              systemPrompt = getEnhancedBoardMemberAdvisorSystemPrompt(advisorType, insights);
              userPrompt = getEnhancedBoardMemberAdvisorUserPrompt({...data, memberType: advisorType, userData}, insights);
            } else {
              return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: `No configuration found for guidance type: ${type}` })
              };
            }
        }
      } else {
        console.log(`Using standard prompts for type: ${type}`);
        switch (type) {
          case 'form_completion':
            systemPrompt = getFormCompletionSystemPrompt();
            userPrompt = getFormCompletionUserPrompt(data, context);
            break;
          case 'board_member_advisor':
            systemPrompt = getBoardMemberAdvisorSystemPrompt(data.memberType);
            userPrompt = getBoardMemberAdvisorUserPrompt(data, context);
            break;
          case 'mentor_advisor':
            systemPrompt = getMentorAdvisorSystemPrompt();
            userPrompt = getMentorAdvisorUserPrompt(data, context);
            break;
          case 'goals_advisor':
          case 'superpowers_advisor':
            systemPrompt = getSuperpowersAdvisorSystemPrompt();
            userPrompt = getSuperpowersAdvisorUserPrompt(data, context);
            break;
          case 'board_analysis_advisor':
            systemPrompt = getBoardAnalysisAdvisorSystemPrompt();
            userPrompt = getBoardAnalysisAdvisorUserPrompt(data, context);
            break;
          default:
            // Check if it's a generic advisor type (e.g., coaches_advisor, sponsors_advisor, etc.)
            if (type.endsWith('_advisor')) {
              const advisorType = type.replace('_advisor', '');
              // Use generic board member advisor for all specific advisor types
              systemPrompt = getBoardMemberAdvisorSystemPrompt(advisorType);
              userPrompt = getBoardMemberAdvisorUserPrompt(data, context);
            } else {
              return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: `No configuration found for guidance type: ${type}` })
              };
            }
        }
      }

      const response = await bedrockChat({
        system: systemPrompt,
        user: userPrompt,
        max_tokens: 2000,
        temperature: 0.3
      });

      const responseBody = {
        success: true,
        guidance: response.text,
        model: response.model,
        type: type,
        source: isEnhancedMode ? 'enhanced-fallback' : 'fallback'
      };

      // Add intelligent insights if enhanced mode
      if (isEnhancedMode && insights) {
        responseBody.insights = insights;
        responseBody.enhancedMode = true;
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(responseBody)
      };
    }

    // Use DynamoDB configuration
    console.log(`Using DynamoDB configuration for category: ${category}`);
    const systemPrompt = promptConfig.systemPrompt;
    const userPrompt = replacePromptVariables(promptConfig.userPromptTemplate, data, context);

    console.log(`Calling AI with system prompt length: ${systemPrompt ? systemPrompt.length : 0}`);
    console.log(`User prompt length: ${userPrompt ? userPrompt.length : 0}`);
    console.log('DEBUG - User prompt preview:', userPrompt ? userPrompt.substring(0, 800) + '...' : 'No user prompt');

    let response;
    try {
      response = await bedrockChat({
        system: systemPrompt,
        user: userPrompt,
        max_tokens: 2000,
        temperature: 0.3
      });

      console.log(`AI response received, text length: ${response?.text ? response.text.length : 0}`);
    } catch (error) {
      console.error(`AI call failed:`, error);
      throw error;
    }

    const responseBody = {
      success: true,
      guidance: response.text,
      model: response.model,
      type: type,
      source: isEnhancedMode ? 'enhanced-dynamodb' : 'dynamodb',
      promptId: promptConfig.promptId
    };

    // Add intelligent insights if enhanced mode
    if (isEnhancedMode && insights) {
      responseBody.insights = insights;
      responseBody.enhancedMode = true;
    }

    console.log(`Returning response with guidance length: ${responseBody.guidance ? responseBody.guidance.length : 0}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(responseBody)
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
- Always include guidance on reviewing their LinkedIn profile to identify shared connections, common experiences, interests, and conversation starters before outreach
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

// ============= BOARD MEMBER ADVISOR FUNCTIONS =============

function getBoardMemberAdvisorSystemPrompt(memberType) {
  const memberTypeInfo = {
    'mentors': {
      role: 'senior leaders who provide wisdom and strategic guidance',
      focus: 'long-term career development and industry insights',
      relationship: 'quarterly strategic guidance sessions',
      value: 'They help you see the bigger picture and navigate complex career decisions'
    },
    'coaches': {
      role: 'skilled practitioners who help develop specific competencies',
      focus: 'hands-on skill building and performance improvement',
      relationship: 'regular practice sessions and feedback loops',
      value: 'They provide practical techniques and help you build concrete capabilities'
    },
    'sponsors': {
      role: 'senior leaders who advocate for your advancement',
      focus: 'career opportunities and organizational navigation',
      relationship: 'behind-the-scenes advocacy and door-opening',
      value: 'They use their influence and networks to champion your career progression'
    },
    'connectors': {
      role: 'well-networked individuals who excel at making introductions',
      focus: 'expanding your professional network strategically',
      relationship: 'ongoing introductions and network expansion',
      value: 'They help you meet the right people at the right time for career growth'
    },
    'peers': {
      role: 'colleagues at similar career levels who provide mutual support',
      focus: 'collaboration, shared learning, and mutual advancement',
      relationship: 'reciprocal support and knowledge sharing',
      value: 'They offer diverse perspectives and can become long-term professional allies'
    }
  };

  const info = memberTypeInfo[memberType] || memberTypeInfo['mentors'];
  
  return `<role>
You are an expert career advisor specializing in ${memberType} relationships within professional boards of directors. Your expertise lies in helping professionals build meaningful, strategic relationships with ${info.role} that accelerate career growth through mutual value creation.
</role>

<objectives>
- Clarify and focus ${memberType.slice(0, -1)} relationship goals and expectations
- Dive deep into specific, actionable strategies for ${info.focus}
- Provide pointed questions that reveal blind spots and opportunities in ${info.relationship}
- Offer concrete recommendations for optimal ${memberType.slice(0, -1)} engagement
- Help maximize the unique value that ${info.value.toLowerCase()}
- Help identify how user's skills can strengthen relationships and create mutual benefit
- Uncover opportunities where common interests and complementary skills create doors
</objectives>

<approach>
- Ask probing questions that help clarify the relationship's strategic value and mutual benefit potential
- Challenge assumptions and push for specificity in goals and expectations
- Provide actionable next steps that can be implemented immediately
- Focus on building authentic, mutually beneficial professional relationships
- Consider the broader context of their career goals and existing professional network
- Analyze how the user's skills and experiences can benefit the board member
- Look for common interests, shared connections, and complementary expertise that open opportunities
- Suggest ways to discover mutual interests and create meaningful value exchanges
</approach>

<output_format>
Provide your response in exactly two sections:

# Questions
[4-6 pointed questions that dig deeper into their ${memberType.slice(0, -1)} relationship strategy, reveal blind spots, clarify goals, and uncover opportunities for mutual value creation through their skills and interests. Format each question as a numbered list item or bullet point.]

# Recommendations
[4-6 specific, actionable recommendations for building and optimizing this ${memberType.slice(0, -1)} relationship, including concrete next steps they can take within the next 30 days. Always include guidance on reviewing their LinkedIn profile to identify shared connections, common experiences, interests, conversation starters, and ways their skills might be valuable to this board member. Format each recommendation as a numbered list item or bullet point.]

# Suggested Entries
[3-4 short, specific, relevant suggested entries they could add to their form fields. Format as brief bullet points that they can directly copy and paste. Focus on practical, actionable content that matches their specific situation, goals, and opportunities for skills-based mutual value creation.]
</output_format>

Remember: Be direct, specific, and focused on actionable insights that create mutual value through skills leveraging and relationship building with this ${memberType.slice(0, -1)}.`;
}

function getBoardMemberAdvisorUserPrompt(data, context) {
  const { memberType, currentFormData, goals, learnContent, existingMembers } = data;

  // Handle both old format (separate parameters) and new format (complete user data)
  let completeUserData = existingMembers;
  if (typeof existingMembers === 'object' && !Array.isArray(existingMembers)) {
    // New format: existingMembers is actually the complete user data object
    completeUserData = existingMembers;
  }

  console.log('DEBUG - getBoardMemberAdvisorUserPrompt data:', JSON.stringify({
    memberType,
    currentFormData,
    goals: goals?.length || 0,
    completeUserDataKeys: Object.keys(completeUserData || {}),
    hasCompleteData: !!completeUserData
  }));

  let prompt = `I'm working on building a stronger ${memberType.slice(0, -1)} relationship and need your expert guidance.\n\n`;

  // Current member information being edited
  if (currentFormData) {
    prompt += `<current_${memberType.slice(0, -1)}_info>\n`;
    Object.entries(currentFormData).forEach(([field, value]) => {
      if (value && value.trim()) {
        prompt += `${field}: ${value}\n`;
      }
    });
    prompt += `</${memberType.slice(0, -1)}_info>\n\n`;
  } else {
    console.log('DEBUG - No currentFormData provided');
  }

  // Complete user profile for context
  if (completeUserData && typeof completeUserData === 'object') {
    prompt += `<my_complete_profile>\n`;

    // Goals
    if (completeUserData.goals && Array.isArray(completeUserData.goals) && completeUserData.goals.length > 0) {
      prompt += `Goals:\n`;
      completeUserData.goals.forEach(goal => {
        prompt += `- ${goal.timeframe || goal.title || 'Goal'}: ${goal.description || goal.content || ''}\n`;
        if (goal.notes) prompt += `  Notes: ${goal.notes}\n`;
      });
      prompt += `\n`;
    }

    // Superpowers/Skills
    if (completeUserData.you?.superpowers && Array.isArray(completeUserData.you.superpowers) && completeUserData.you.superpowers.length > 0) {
      prompt += `My Key Skills/Superpowers:\n`;
      completeUserData.you.superpowers.forEach(skill => {
        prompt += `- ${skill.name || skill.title}: ${skill.description || ''}\n`;
        if (skill.notes) prompt += `  ${skill.notes}\n`;
      });
      prompt += `\n`;
    }

    // Existing board members
    const boardMemberTypes = ['mentors', 'coaches', 'sponsors', 'connectors', 'peers'];
    boardMemberTypes.forEach(type => {
      if (completeUserData[type] && Array.isArray(completeUserData[type]) && completeUserData[type].length > 0) {
        prompt += `Current ${type}:\n`;
        completeUserData[type].forEach(member => {
          prompt += `- ${member.name || 'Unknown'}`;
          if (member.role) prompt += ` (${member.role})`;
          if (member.connection) prompt += ` - Connection: ${member.connection}`;
          if (member.cadence) prompt += ` - Meets: ${member.cadence}`;
          prompt += `\n`;
          if (member.whatToLearn) prompt += `  Learning: ${member.whatToLearn}\n`;
          if (member.whatTheyGet) prompt += `  Providing: ${member.whatTheyGet}\n`;
          if (member.notes) prompt += `  Notes: ${member.notes}\n`;
        });
        prompt += `\n`;
      }
    });

    prompt += `</my_complete_profile>\n\n`;
  }
  
  // Context about this type of board member
  if (learnContent) {
    prompt += `<${memberType.slice(0, -1)}_context>\n${learnContent}\n</${memberType.slice(0, -1)}_context>\n\n`;
  }
  
  // Career goals for context
  if (goals && goals.length > 0) {
    prompt += `<my_career_goals>\n`;
    goals.forEach(goal => {
      prompt += `${goal.timeframe}: ${goal.description}\n`;
    });
    prompt += `</my_career_goals>\n\n`;
  }
  
  // Existing members of this type for context
  if (existingMembers && existingMembers.length > 0) {
    prompt += `<existing_${memberType}>\n`;
    existingMembers.forEach(member => {
      prompt += `- ${member.name}`;
      if (member.role) prompt += ` (${member.role})`;
      if (member.cadence) prompt += ` - meets ${member.cadence}`;
      if (member.whatToLearn) prompt += ` - focus: ${member.whatToLearn}`;
      prompt += `\n`;
    });
    prompt += `</existing_${memberType}>\n\n`;
  }
  
  prompt += `Please provide pointed questions and specific recommendations to help me build the most effective ${memberType.slice(0, -1)} relationship possible.`;
  
  return prompt;
}

// ============= GOALS ADVISOR FUNCTIONS =============

function getGoalsAdvisorSystemPrompt() {
  return `<role>
You are an expert career strategist and goal-setting coach specializing in helping professionals create ambitious, achievable, and strategically aligned career goals. Your expertise lies in helping people set clear, actionable goals that work synergistically with their professional support network.
</role>

<objectives>
- Help refine and clarify career goals for maximum impact and achievability
- Identify potential gaps, conflicts, or missed opportunities in goal setting
- Suggest specific, measurable, and time-bound improvements to goal statements
- Align goals with their broader professional network and support systems
- Challenge assumptions and push for strategic thinking about career progression
</objectives>

<approach>
- Ask probing questions that reveal underlying motivations and potential obstacles
- Focus on creating SMART goals (Specific, Measurable, Achievable, Relevant, Time-bound)
- Consider how goals interact with and leverage their professional board of directors
- Identify potential gaps in timeline, skills, or support systems
- Push for specificity while maintaining strategic thinking
</approach>

<output_format>
Provide your response in exactly two sections:

# Questions
[4-6 pointed questions that help clarify, refine, and strengthen their goal-setting approach. Format each question as a numbered list item or bullet point.]

# Recommendations  
[4-6 specific, actionable recommendations for improving their goals, including concrete next steps they can implement within 30 days. Format each recommendation as a numbered list item or bullet point.]

# Suggested Entries
[3-4 short, specific, relevant suggested entries they could add to their goal descriptions or notes. Format as brief bullet points that they can directly copy and paste. Focus on practical, measurable goals that align with their career aspirations.]
</output_format>

Remember: Focus on strategic goal setting that leverages their professional relationships and creates clear pathways to success.`;
}

function getGoalsAdvisorUserPrompt(data, context) {
  const { currentFormData, allGoals, boardData } = data;
  
  let prompt = `I'm working on setting better career goals and need your expert guidance on goal setting and strategic planning.\n\n`;
  
  // Current goal being worked on (if editing)
  if (currentFormData) {
    prompt += `<current_goal>\n`;
    Object.entries(currentFormData).forEach(([field, value]) => {
      if (value && value.trim()) {
        prompt += `${field}: ${value}\n`;
      }
    });
    prompt += `</current_goal>\n\n`;
  }
  
  // All existing goals for context
  if (allGoals && allGoals.length > 0) {
    prompt += `<my_current_goals>\n`;
    allGoals.forEach(goal => {
      prompt += `${goal.timeframe}: ${goal.description}`;
      if (goal.notes) prompt += ` (Notes: ${goal.notes})`;
      prompt += `\n`;
    });
    prompt += `</my_current_goals>\n\n`;
  }
  
  // Board context for alignment
  if (boardData) {
    const boardTypes = ['mentors', 'coaches', 'sponsors', 'connectors', 'peers'];
    let hasBoardMembers = false;
    
    prompt += `<my_professional_board>\n`;
    boardTypes.forEach(type => {
      const members = boardData[type] || [];
      if (members.length > 0) {
        hasBoardMembers = true;
        prompt += `${type.charAt(0).toUpperCase() + type.slice(1)}:\n`;
        members.forEach(member => {
          prompt += `- ${member.name}`;
          if (member.role) prompt += ` (${member.role})`;
          if (member.whatToLearn) prompt += ` - expertise: ${member.whatToLearn}`;
          prompt += `\n`;
        });
      }
    });
    if (!hasBoardMembers) {
      prompt += `No board members defined yet.\n`;
    }
    prompt += `</my_professional_board>\n\n`;
  }
  
  prompt += `Please analyze my goal-setting approach and provide specific guidance to help me create more strategic, achievable, and impactful career goals.`;
  
  return prompt;
}

// ============= BOARD ANALYSIS ADVISOR FUNCTIONS =============

function getBoardAnalysisAdvisorSystemPrompt() {
  return `<role>
You are an expert career strategist specializing in professional board of directors analysis. Your expertise lies in evaluating the composition, balance, and strategic effectiveness of professional support networks to accelerate career growth.
</role>

<objectives>
- Analyze the overall composition and balance of their professional board
- Identify gaps, overlaps, and optimization opportunities in their network
- Assess how well their board aligns with their career goals and timeline
- Provide strategic recommendations for strengthening their professional ecosystem
- Evaluate the quality and strategic value of existing relationships
- Help identify opportunities to leverage user's skills for mutual value creation with board members
</objectives>

<approach>
- Conduct comprehensive analysis across all board member types (mentors, coaches, sponsors, connectors, peers)
- Look for patterns, gaps, and strategic opportunities in their network composition
- Consider the balance between different types of support and guidance
- Assess alignment between their goals and their support network capabilities
- Identify specific actions to optimize their board's effectiveness
- Analyze how the user's skills can be leveraged to strengthen board relationships and achieve career goals
- Look for opportunities where skills create mutual value and open doors to new connections
</approach>

<output_format>
Provide your response in exactly two sections:

# Questions
[4-6 strategic questions designed to reveal deeper insights about their board effectiveness, relationship quality, strategic alignment with career goals, and opportunities to leverage their skills for mutual benefit.]

# Recommendations
[4-6 comprehensive recommendations covering board optimization, relationship enhancement, strategic additions, skills leveraging opportunities, and specific action steps for the next 90 days.]

# Suggested Entries
[3-4 specific, actionable items they could implement immediately to improve their board effectiveness, including relationship management strategies, board member additions, or ways to apply their skills for mutual value creation.]
</output_format>

Remember: Think like a senior executive coach focused on strategic relationship portfolio optimization, skills leveraging, and long-term career success through mutual value creation.`;
}

function getBoardAnalysisAdvisorUserPrompt(data, context) {
  const { boardData } = data;

  let prompt = `I want a comprehensive analysis of my professional board of directors. Please evaluate the overall composition, identify gaps and opportunities, and help me optimize this network for maximum career impact. Include opportunities for how I can leverage my skills to create mutual value with board members and strengthen these relationships.\n\n`;

  // Goals for context
  if (boardData && boardData.goals && boardData.goals.length > 0) {
    prompt += `<my_career_goals>\n`;
    boardData.goals.forEach(goal => {
      prompt += `${goal.timeframe}: ${goal.description}`;
      if (goal.notes) prompt += ` (${goal.notes})`;
      prompt += `\n`;
    });
    prompt += `</my_career_goals>\n\n`;
  }

  // Skills/Superpowers for context - handle the 'you' section
  if (boardData && boardData.you && boardData.you.superpowers && boardData.you.superpowers.length > 0) {
    prompt += `<my_skills_and_superpowers>\n`;
    boardData.you.superpowers.forEach((skill, index) => {
      prompt += `${index + 1}. ${skill.name}`;
      if (skill.description) prompt += `: ${skill.description}`;
      if (skill.notes) prompt += ` (${skill.notes})`;
      prompt += `\n`;
    });
    prompt += `</my_skills_and_superpowers>\n\n`;
  }
  
  // Comprehensive board breakdown
  const boardTypes = [
    { key: 'mentors', name: 'Mentors', description: 'Senior leaders providing wisdom and strategic guidance' },
    { key: 'coaches', name: 'Coaches', description: 'Skill builders providing hands-on development' },
    { key: 'sponsors', name: 'Sponsors', description: 'Advocates championing career advancement' },
    { key: 'connectors', name: 'Connectors', description: 'Network expanders making strategic introductions' },
    { key: 'peers', name: 'Peers', description: 'Colleagues providing mutual support and collaboration' }
  ];
  
  prompt += `<complete_board_analysis>\n`;
  
  let totalMembers = 0;
  boardTypes.forEach(type => {
    const members = boardData[type.key] || [];
    totalMembers += members.length;
    
    prompt += `\n${type.name} (${members.length}):\n`;
    if (members.length === 0) {
      prompt += `- No ${type.key} currently defined\n`;
    } else {
      members.forEach(member => {
        prompt += `- ${member.name}`;
        if (member.role) prompt += ` (${member.role})`;
        if (member.connection) prompt += ` - Connection: ${member.connection}`;
        if (member.cadence) prompt += ` - Meets: ${member.cadence}`;
        if (member.whatToLearn) prompt += ` - Focus: ${member.whatToLearn}`;
        if (member.whatTheyGet) prompt += ` - Value Exchange: ${member.whatTheyGet}`;
        if (member.notes) prompt += ` - Notes: ${member.notes}`;
        prompt += `\n`;
      });
    }
  });
  
  prompt += `\nTotal Board Members: ${totalMembers}\n`;
  prompt += `</complete_board_analysis>\n\n`;
  
  prompt += `Please provide a comprehensive analysis of my professional board composition, identify strategic gaps and opportunities, and recommend specific actions to optimize this network for maximum career acceleration.`;

  return prompt;
}

function getSuperpowersAdvisorSystemPrompt() {
  return `<role>
You are an expert career strategist and skills development coach specializing in helping professionals identify, develop, and strategically leverage their core competencies. Your expertise lies in helping people discover their "superpowers" - the unique combination of skills that can differentiate them in their career and create mutual value in professional relationships.
</role>

<objectives>
- Help identify 2-4 key skills that can become central to their career identity and goals
- Provide guidance on how to leverage these skills for career advancement
- Suggest ways to use these skills to give back to board members and create mutual value
- Identify opportunities where skills create competitive advantage and open doors
- Connect skills development to broader career strategy and professional relationships
</objectives>

<approach>
- Focus on skills that have the highest impact potential and differentiation value
- Consider how skills can be applied to achieve their specific career goals
- Identify opportunities where skills can benefit board members and strengthen relationships
- Look for intersections between skills, goals, and market opportunities
- Suggest ways to develop and showcase these skills strategically
- Consider both technical expertise and soft skills that create unique value
</approach>

<context_awareness>
Skills are categorized as:
- Technical Skills: Programming, tools, platforms, methodologies (Examples: Python, AWS, React)
- Business Skills: Industry expertise and domain knowledge (Examples: Healthcare, fintech, e-commerce)
- Organization Skills: Leadership and management abilities (Examples: Public speaking, project management)
</context_awareness>

<output_format>
Structure your response using these exact headings:

# Questions
[4-6 pointed questions designed to help them identify their most valuable and differentiating skills, understand how to apply them strategically, and discover opportunities for mutual value creation with their board.]

# Recommendations
[4-6 specific recommendations for developing, leveraging, and showcasing their key skills, including how to use these skills to strengthen board relationships and advance their career goals.]

# Suggested Entries
[3-4 concrete, specific skill descriptions, examples, or development actions they could add to their skills sections that would create clear competitive advantage and relationship value.]
</output_format>

Remember: Focus on helping them identify the few key skills that can become their career "superpowers" - the ones that differentiate them, advance their goals, and create value for others.`;
}

function getSuperpowersAdvisorUserPrompt(data, context) {
  const { skillCategory, currentDescription, currentNotes, allSkills, goals, boardData } = data;

  let prompt = `I need expert guidance on identifying and leveraging my key skills ("superpowers") for career advancement and board relationship building.\n\n`;

  // Current skill being worked on
  if (skillCategory) {
    prompt += `<current_skill_being_worked_on>\n`;
    prompt += `Skill Category: ${skillCategory}\n`;
    if (currentDescription) prompt += `Current Description: ${currentDescription}\n`;
    if (currentNotes) prompt += `Current Notes/Examples: ${currentNotes}\n`;
    prompt += `</current_skill_being_worked_on>\n\n`;
  }

  // All skills
  if (allSkills && allSkills.length > 0) {
    prompt += `<all_my_skills>\n`;
    allSkills.forEach((skill, index) => {
      prompt += `\n${index + 1}. ${skill.name}:\n`;
      if (skill.description) prompt += `   Description: ${skill.description}\n`;
      if (skill.notes) prompt += `   Notes: ${skill.notes}\n`;
    });
    prompt += `</all_my_skills>\n\n`;
  }

  // Goals for context
  if (goals && goals.length > 0) {
    prompt += `<my_career_goals>\n`;
    goals.forEach((goal, index) => {
      prompt += `${index + 1}. ${goal.title}`;
      if (goal.timeframe) prompt += ` (${goal.timeframe})`;
      prompt += `\n`;
      if (goal.description) prompt += `   ${goal.description}\n`;
    });
    prompt += `</my_career_goals>\n\n`;
  }

  // Board context
  if (boardData) {
    prompt += `<my_board_context>\n`;
    ['mentors', 'coaches', 'sponsors', 'connectors', 'peers'].forEach(type => {
      if (boardData[type] && boardData[type].length > 0) {
        prompt += `${type.charAt(0).toUpperCase() + type.slice(1)}: ${boardData[type].length} members\n`;
      }
    });
    prompt += `</my_board_context>\n\n`;
  }

  prompt += `Please help me identify the most strategically valuable skills to focus on, how to leverage them for my career goals, and ways to use these skills to create mutual value with my board members and strengthen those relationships.`;

  return prompt;
}