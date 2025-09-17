/**
 * AI Guidance Client for Personal Board of Directors
 * Provides frontend interface to the AI guidance API
 */

// API Configuration - update this with your deployed API URL
const AI_API_BASE_URL = 'https://hvr92xfbo6.execute-api.us-east-1.amazonaws.com/production';

/**
 * Show styled authentication modal for access code entry
 * @returns {Promise<string|null>} The access code entered by user or null if cancelled
 */
function showAuthenticationModal() {
  return new Promise((resolve) => {
    // Create modal elements
    const modal = document.createElement('div');
    modal.className = 'auth-modal';
    
    modal.innerHTML = `
      <div class="auth-modal-content">
        <div class="auth-modal-header">
          <h2>🔐 Access Code Required</h2>
          <p class="auth-modal-subtitle">
            AI-powered features enhance your board experience
          </p>
        </div>
        
        <div class="auth-info-box">
          <strong>ℹ️ Note:</strong> AI features require a 6-digit access code provided by your facilitator. 
          All other features of this site are available for free without a code.
        </div>
        
        <div class="auth-modal-form">
          <div class="auth-input-group">
            <label class="auth-input-label" for="access-code-input">
              Enter your 6-digit access code:
            </label>
            <input 
              type="text" 
              id="access-code-input" 
              class="auth-input" 
              placeholder="000000"
              maxlength="6"
              pattern="[0-9]{6}"
              autocomplete="off"
            />
            <div class="auth-error-message" style="display: none;">
              <span>⚠️</span>
              <span id="error-text"></span>
            </div>
          </div>
        </div>
        
        <div class="auth-button-group">
          <button class="auth-button auth-button-secondary" id="auth-cancel">
            Continue Without AI
          </button>
          <button class="auth-button auth-button-primary" id="auth-submit" disabled>
            Activate Code
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const input = modal.querySelector('#access-code-input');
    const submitBtn = modal.querySelector('#auth-submit');
    const cancelBtn = modal.querySelector('#auth-cancel');
    const errorDiv = modal.querySelector('.auth-error-message');
    const errorText = modal.querySelector('#error-text');
    
    // Focus on input
    setTimeout(() => input.focus(), 100);
    
    // Input validation
    input.addEventListener('input', (e) => {
      const value = e.target.value.replace(/\D/g, ''); // Only digits
      e.target.value = value;
      
      // Clear error state
      input.classList.remove('error');
      errorDiv.style.display = 'none';
      
      // Enable submit when 6 digits entered
      submitBtn.disabled = value.length !== 6;
    });
    
    // Submit on Enter key
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && input.value.length === 6) {
        submitBtn.click();
      }
    });
    
    // Submit button handler
    submitBtn.addEventListener('click', () => {
      const code = input.value;
      if (code.length === 6) {
        document.body.removeChild(modal);
        resolve(code);
      }
    });
    
    // Cancel button handler
    cancelBtn.addEventListener('click', () => {
      document.body.removeChild(modal);
      resolve(null);
    });
    
    // Close on backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
        resolve(null);
      }
    });
  });
}

/**
 * Validate and activate access code
 * @param {string} accessCode - 6-digit access code
 * @returns {Promise<void>} Resolves if successful, throws error if invalid
 */
async function validateAccessCode(accessCode) {
  if (!accessCode) {
    throw new Error('Access code is required. Please enter your 6-digit code.');
  }

  // Validate format
  if (!/^\d{6}$/.test(accessCode)) {
    throw new Error('Invalid format. Please enter exactly 6 digits.');
  }

  try {
    // Generate or retrieve client ID
    let clientId = localStorage.getItem('clientId');
    if (!clientId) {
      clientId = crypto.randomUUID();
      localStorage.setItem('clientId', clientId);
    }

    const activateResponse = await fetch(`${AI_API_BASE_URL}/activate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        code: accessCode,
        clientId
      })
    });

    if (!activateResponse.ok) {
      const errorData = await activateResponse.json().catch(() => ({}));
      let errorMessage = 'Access code validation failed.';
      let errorType = 'unknown';

      switch (activateResponse.status) {
        case 400:
          if (errorData.message?.includes('Invalid code format')) {
            errorMessage = 'Invalid format. Please enter exactly 6 digits.';
            errorType = 'format';
          } else if (errorData.message?.includes('required')) {
            errorMessage = 'Access code is required. Please enter your 6-digit code.';
            errorType = 'required';
          } else {
            errorMessage = errorData.message || 'Invalid request. Please check your access code.';
            errorType = 'invalid';
          }
          break;
        case 401:
          if (errorData.message?.includes('already used')) {
            errorMessage = 'This code has already been activated. Each code can only be used once. Please contact your facilitator for a new code.';
            errorType = 'used';
          } else if (errorData.message?.includes('Invalid')) {
            errorMessage = 'This access code is not valid. Please check your code or contact your facilitator.';
            errorType = 'invalid';
          } else if (errorData.message?.includes('expired')) {
            errorMessage = 'This access code has expired. Please contact your facilitator for a new code.';
            errorType = 'expired';
          } else {
            errorMessage = errorData.message || 'Access code not recognized. Please verify your code.';
            errorType = 'invalid';
          }
          break;
        case 500:
          errorMessage = 'Server error occurred. Please try again in a few moments.';
          errorType = 'server';
          break;
        default:
          errorMessage = errorData.message || 'Network error. Please check your connection and try again.';
          errorType = 'network';
      }

      // Create error object with type for better handling
      const error = new Error(errorMessage);
      error.type = errorType;
      throw error;
    }

    const { token: newToken } = await activateResponse.json();

    // Store the token
    localStorage.setItem('sessionToken', newToken);

  } catch (error) {
    console.error('AI Guidance API Error:', error);
    throw error;
  }
}

/**
 * Check if user has valid authentication
 * @returns {boolean} True if authenticated
 */
function isAuthenticated() {
  const token = localStorage.getItem('sessionToken');
  if (!token) return false;
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const now = Math.floor(Date.now() / 1000);
    return payload.exp && payload.exp > now;
  } catch {
    return false;
  }
}

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
      // Invalid token format - remove corrupted token
      console.error('Invalid token format:', e);
      localStorage.removeItem('sessionToken');
      localStorage.removeItem('clientId');
    }
  }
  
  // Need to authenticate
  // Generate or retrieve client ID
  let clientId = localStorage.getItem('clientId');
  if (!clientId) {
    clientId = crypto.randomUUID();
    localStorage.setItem('clientId', clientId);
  }
  
  // Show styled authentication modal instead of basic prompt
  const code = await showAuthenticationModal();
  
  if (!code) {
    throw new Error('Authentication required to use AI features.');
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
    let errorMessage = 'Failed to activate access code. Please try again.';
    let errorType = 'generic';
    
    // Provide specific error messages based on status code
    switch (activateResponse.status) {
      case 400:
        if (errorData.message?.includes('Invalid code format')) {
          errorMessage = 'Invalid format. Please enter exactly 6 digits.';
          errorType = 'format';
        } else if (errorData.message?.includes('required')) {
          errorMessage = 'Access code is required. Please enter your 6-digit code.';
          errorType = 'required';
        } else {
          errorMessage = errorData.message || 'Invalid request. Please check your access code.';
          errorType = 'invalid';
        }
        break;
      case 401:
        if (errorData.message?.includes('already used')) {
          errorMessage = 'This code has already been activated. Each code can only be used once. Please contact your facilitator for a new code.';
          errorType = 'used';
        } else if (errorData.message?.includes('Invalid')) {
          errorMessage = 'This access code is not valid. Please check your code or contact your facilitator.';
          errorType = 'invalid';
        } else if (errorData.message?.includes('expired')) {
          errorMessage = 'This access code has expired. Please contact your facilitator for a new code.';
          errorType = 'expired';
        } else {
          errorMessage = errorData.message || 'Access code not recognized. Please verify your code.';
          errorType = 'invalid';
        }
        break;
      case 500:
        errorMessage = 'Server error occurred. Please try again in a few moments.';
        errorType = 'server';
        break;
      default:
        errorMessage = errorData.message || 'Network error. Please check your connection and try again.';
        errorType = 'network';
    }
    
    // Create error object with type for better handling
    const error = new Error(errorMessage);
    error.type = errorType;
    throw error;
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
      // Token expired or invalid, clear it and retry once
      console.log('🔄 Authentication token expired, requesting new access code...');
      localStorage.removeItem('sessionToken');
      localStorage.removeItem('clientId');
      
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

export { isAuthenticated, validateAccessCode };

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