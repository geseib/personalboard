/**
 * AI Guidance Client for Personal Board of Directors
 * Provides frontend interface to the AI guidance API
 */

// API Configuration - update this with your deployed API URL
const AI_API_BASE_URL = 'https://hvr92xfbo6.execute-api.us-east-1.amazonaws.com/production';

/**
 * Call the AI guidance API
 * @param {string} type - Type of guidance: 'form_completion', 'goal_alignment', 'connection_suggestions', 'board_analysis'
 * @param {Object} data - Data specific to the guidance type
 * @param {Object} context - Additional context for the request
 * @returns {Promise<Object>} AI guidance response
 */
async function getAIGuidance(type, data, context = {}) {
  try {
    const response = await fetch(`${AI_API_BASE_URL}/ai-guidance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type,
        data,
        context
      })
    });

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