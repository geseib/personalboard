/**
 * AI Guidance Client for Personal Board of Directors
 * Provides frontend interface to the AI guidance API
 */

// API Configuration - update this with your deployed API URL
const AI_API_BASE_URL = 'https://hvr92xfbo6.execute-api.us-east-1.amazonaws.com/production';

/**
 * Ensure user has authenticated with access code
 * @returns {Promise<string>} JWT token for API authentication
 */
async function ensureAuthenticated() {
  // Check for existing token
  let token = localStorage.getItem('sessionToken');
  
  // Check if token exists and is not expired
  if (token) {
    try {
      // Parse JWT to check expiration (simple base64 decode of payload)
      const payload = JSON.parse(atob(token.split('.')[1]));
      const now = Math.floor(Date.now() / 1000);
      
      if (payload.exp && payload.exp > now) {
        // Token is valid
        return token;
      }
    } catch (e) {
      // Invalid token format
      console.error('Invalid token format:', e);
    }
  }
  
  // Need to authenticate
  // Generate or retrieve client ID
  let clientId = localStorage.getItem('clientId');
  if (!clientId) {
    clientId = crypto.randomUUID();
    localStorage.setItem('clientId', clientId);
  }
  
  // Prompt for access code
  const code = prompt("Please enter your 6-digit access code to use AI features:");
  
  if (!code) {
    throw new Error('Authentication required. Please enter an access code.');
  }
  
  // Validate code format
  if (!/^\d{6}$/.test(code)) {
    throw new Error('Invalid code format. Please enter a 6-digit numeric code.');
  }
  
  // Activate the code
  const activateResponse = await fetch(`${AI_API_BASE_URL}/activate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code,
      clientId
    })
  });
  
  if (!activateResponse.ok) {
    const errorData = await activateResponse.json();
    throw new Error(errorData.message || 'Failed to activate access code. Please try again.');
  }
  
  const { token: newToken } = await activateResponse.json();
  
  // Store the token
  localStorage.setItem('sessionToken', newToken);
  
  return newToken;
}

/**
 * Call the AI guidance API
 * @param {string} type - Type of guidance: 'form_completion', 'goal_alignment', 'connection_suggestions', 'board_analysis'
 * @param {Object} data - Data specific to the guidance type
 * @param {Object} context - Additional context for the request
 * @returns {Promise<Object>} AI guidance response
 */
async function getAIGuidance(type, data, context = {}) {
  try {
    // Ensure user is authenticated
    const token = await ensureAuthenticated();
    
    const response = await fetch(`${AI_API_BASE_URL}/ai-guidance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        type,
        data,
        context
      })
    });

    if (response.status === 401) {
      // Token expired or invalid, clear it and retry
      localStorage.removeItem('sessionToken');
      // Recursive call will trigger re-authentication
      return getAIGuidance(type, data, context);
    }

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('AI Guidance API Error:', error);
    throw error;
  }
}

/**
 * Get form completion suggestions
 * @param {string} formType - Type of form (mentors, coaches, etc.)
 * @param {Object} currentFields - Current form field values
 * @param {Array} goals - User's goals
 * @param {Object} existingBoard - Current board members
 * @returns {Promise<Object>} Form completion suggestions
 */
export async function getFormCompletionGuidance(formType, currentFields, goals, existingBoard) {
  return getAIGuidance('form_completion', {
    formType,
    currentFields,
    goals,
    existingBoard
  });
}

/**
 * Get goal alignment analysis
 * @param {Array} goals - User's goals
 * @param {Object} boardMembers - Current board members
 * @returns {Promise<Object>} Goal alignment analysis
 */
export async function getGoalAlignmentGuidance(goals, boardMembers) {
  return getAIGuidance('goal_alignment', {
    goals,
    boardMembers
  });
}

/**
 * Get connection suggestions
 * @param {string} targetRole - Type of role to find (mentor, coach, etc.)
 * @param {string} currentNetwork - Description of current network
 * @param {string} goals - User's goals
 * @param {string} existingBoard - Description of existing board
 * @returns {Promise<Object>} Connection suggestions
 */
export async function getConnectionSuggestions(targetRole, currentNetwork, goals, existingBoard) {
  return getAIGuidance('connection_suggestions', {
    targetRole,
    currentNetwork,
    goals,
    existingBoard
  });
}

/**
 * Get board composition analysis
 * @param {Object} boardData - Complete board data
 * @param {Array} goals - User's goals
 * @returns {Promise<Object>} Board analysis and recommendations
 */
export async function getBoardAnalysis(boardData, goals) {
  return getAIGuidance('board_analysis', {
    boardData,
    goals
  });
}

/**
 * Get mentor advisor guidance with pointed questions and recommendations
 * @param {Object} currentFormData - Current form field values
 * @param {Array} goals - User's career goals
 * @param {string} learnContent - Learn modal content for context
 * @param {Array} existingMentors - Current mentor list
 * @returns {Promise<Object>} Pointed questions and specific recommendations
 */
export async function getMentorAdvisorGuidance(currentFormData, goals, learnContent, existingMentors) {
  return getAIGuidance('mentor_advisor', {
    currentFormData,
    goals,
    learnContent,
    existingMentors
  });
}

/**
 * Get board member advisor guidance for any board member type
 * @param {string} memberType - Type of board member (mentors, coaches, sponsors, connectors, peers)
 * @param {Object} currentFormData - Current form field values
 * @param {Array} goals - User's career goals
 * @param {string} learnContent - Learn modal content for context
 * @param {Array} existingMembers - Current members of this type
 * @returns {Promise<Object>} Pointed questions and specific recommendations
 */
export async function getBoardMemberAdvisorGuidance(memberType, currentFormData, goals, learnContent, existingMembers) {
  return getAIGuidance('board_member_advisor', {
    memberType,
    currentFormData,
    goals,
    learnContent,
    existingMembers
  });
}

/**
 * Get goals advisor guidance for goal setting and refinement
 * @param {Object} currentFormData - Current goal form data (if editing)
 * @param {Array} allGoals - All user's current goals
 * @param {Object} boardData - Complete board of directors data for context
 * @returns {Promise<Object>} Questions and recommendations for better goal setting
 */
export async function getGoalsAdvisorGuidance(currentFormData, allGoals, boardData) {
  return getAIGuidance('goals_advisor', {
    currentFormData,
    allGoals,
    boardData
  });
}

/**
 * Get comprehensive board analysis advisor guidance
 * @param {Object} boardData - Complete board of directors data
 * @returns {Promise<Object>} Analysis and recommendations across all board relationships
 */
export async function getBoardAnalysisAdvisorGuidance(boardData) {
  return getAIGuidance('board_analysis_advisor', {
    boardData
  });
}

/**
 * Update the API base URL (call this after deployment with your actual API URL)
 * @param {string} url - The deployed API Gateway URL
 */
export function setAPIBaseUrl(url) {
  AI_API_BASE_URL = url;
}

/**
 * Example usage for form completion:
 * 
 * const suggestions = await getFormCompletionGuidance(
 *   'mentors',
 *   { name: 'John Doe', role: 'Senior Engineer' },
 *   [{ timeframe: '1 Year Goals', description: 'Get promoted to lead' }],
 *   { coaches: [{ name: 'Jane Smith', role: 'Tech Lead' }] }
 * );
 * 
 * console.log(suggestions.guidance);
 */