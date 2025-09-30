/**
 * Admin Interface for Personal Board AI Advisor Configuration
 * Now with DynamoDB backend and 5-minute TTL caching
 */

// Configuration
const AI_API_BASE_URL = 'https://hvr92xfbo6.execute-api.us-east-1.amazonaws.com/production';
const CACHE_TTL_MINUTES = 5;

// Admin interface flag to prevent authentication conflicts
window.ADMIN_INTERFACE = true;

// Override any authentication functions that might be loaded
if (typeof window.ensureAuthenticated !== 'undefined') {
    console.log('🛡️ ADMIN SECURITY: Overriding authentication functions for admin interface');
    window.ensureAuthenticated = function() {
        console.log('🛡️ ADMIN SECURITY: Blocked authentication call in admin interface');
        return Promise.resolve('admin-mode');
    };
}

// Prevent authentication modals in admin interface
if (typeof window.showAuthenticationModal !== 'undefined') {
    window.showAuthenticationModal = function() {
        console.log('🛡️ ADMIN SECURITY: Blocked authentication modal in admin interface');
        return Promise.resolve(null);
    };
}

// Global state
let currentPrompts = {};
let currentStats = {
    totalPrompts: 0,
    activePrompts: 0,
    avgTokens: 0,
    apiVersion: 'v2.0'
};
let activeSelections = {};
let adminPassword = null;
let availableThemes = [];
let activeThemeId = null;

// Cache management
const CACHE_KEY = 'admin_prompt_data';
const CACHE_TIMESTAMP_KEY = 'admin_prompt_data_timestamp';

/**
 * Prompt user for admin password
 */
async function promptForPassword(showError = false) {
    return new Promise((resolve, reject) => {
        // Create modal backdrop
        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop';
        backdrop.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        // Create modal
        const modal = document.createElement('div');
        modal.className = 'password-modal';
        modal.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
            max-width: 400px;
            width: 90%;
        `;

        modal.innerHTML = `
            <h3 style="margin: 0 0 20px 0; color: #333;">Admin Authentication Required</h3>
            <p style="margin: 0 0 20px 0; color: #666;">Enter the admin password to access prompt management:</p>
            ${showError ? '<p style="margin: 0 0 20px 0; color: #e74c3c; font-weight: bold;">❌ Incorrect password. Please try again.</p>' : ''}
            <input type="password" id="admin-password-input"
                   style="width: 100%; padding: 10px; border: 1px solid ${showError ? '#e74c3c' : '#ddd'}; border-radius: 4px; margin-bottom: 20px;"
                   placeholder="Enter admin password">
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button id="password-cancel"
                        style="padding: 10px 20px; border: 1px solid #ddd; background: #f5f5f5; border-radius: 4px; cursor: pointer;">
                    Cancel
                </button>
                <button id="password-submit"
                        style="padding: 10px 20px; border: none; background: #007cba; color: white; border-radius: 4px; cursor: pointer;">
                    Login
                </button>
            </div>
        `;

        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);

        const passwordInput = document.getElementById('admin-password-input');
        const submitBtn = document.getElementById('password-submit');
        const cancelBtn = document.getElementById('password-cancel');

        // Focus on input
        passwordInput.focus();

        // Handle submit
        const handleSubmit = async () => {
            const password = passwordInput.value.trim();
            if (!password) {
                passwordInput.style.borderColor = '#e74c3c';
                passwordInput.focus();
                return;
            }

            // Store password temporarily
            sessionStorage.setItem('adminPassword', password);
            adminPassword = password;

            // Test the password by making a simple API call
            try {
                const response = await fetch(`${AI_API_BASE_URL}/admin/prompts`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'X-Admin-Password': password
                    }
                });

                if (response.status === 401) {
                    // Wrong password - clear stored password and show error
                    sessionStorage.removeItem('adminPassword');
                    adminPassword = null;
                    document.body.removeChild(backdrop);
                    // Recursively call with error flag
                    const result = await promptForPassword(true);
                    resolve(result);
                } else if (response.ok) {
                    // Password is correct
                    document.body.removeChild(backdrop);
                    resolve(password);
                } else {
                    // Other error
                    throw new Error(`Unexpected response: ${response.status}`);
                }
            } catch (error) {
                console.error('Error validating password:', error);
                // On network error, assume password might be ok and continue
                document.body.removeChild(backdrop);
                resolve(password);
            }
        };

        // Handle cancel
        const handleCancel = () => {
            sessionStorage.removeItem('adminPassword');
            adminPassword = null;
            document.body.removeChild(backdrop);
            reject(new Error('Password prompt cancelled'));
        };

        // Event listeners
        submitBtn.addEventListener('click', handleSubmit);
        cancelBtn.addEventListener('click', handleCancel);
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleSubmit();
            }
        });

        // Click backdrop to cancel
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                handleCancel();
            }
        });
    });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async function() {
    try {
        console.log('🚀 Initializing Admin Interface...');

        // Check for stored password or prompt for it
        adminPassword = sessionStorage.getItem('adminPassword');
        if (!adminPassword) {
            await promptForPassword();
        }

        await loadPromptData();
        await loadThemes();
        await loadTokenStats();
        loadPromptCategories();
        setupSearch();
        setupThemeSelector();
        console.log('✅ Admin interface ready');
    } catch (error) {
        console.error('❌ Failed to initialize admin interface:', error);
        showNotification('Failed to load prompt configurations', 'error');
    }
});

/**
 * Make authenticated API call with automatic password re-prompt on 401
 */
async function authenticatedFetch(url, options = {}) {
    // Ensure password header is included
    options.headers = {
        ...options.headers,
        'X-Admin-Password': adminPassword
    };

    const response = await fetch(url, options);

    if (response.status === 401) {
        // Password is invalid or expired - clear it and re-prompt
        sessionStorage.removeItem('adminPassword');
        adminPassword = null;

        // Prompt for password again
        try {
            await promptForPassword(true);
            // Retry the request with new password
            options.headers['X-Admin-Password'] = adminPassword;
            return await fetch(url, options);
        } catch (error) {
            console.error('Password prompt cancelled');
            throw new Error('Authentication required');
        }
    }

    return response;
}

/**
 * Check if cached data is still valid
 */
function isCacheValid() {
    const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
    if (!timestamp) return false;

    const cacheTime = new Date(timestamp);
    const now = new Date();
    const diffMinutes = (now - cacheTime) / (1000 * 60);

    return diffMinutes < CACHE_TTL_MINUTES;
}

/**
 * Get data from cache
 */
function getCachedData() {
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        return cached ? JSON.parse(cached) : null;
    } catch (error) {
        console.error('Error parsing cached data:', error);
        return null;
    }
}

/**
 * Store data in cache
 */
function setCachedData(data) {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
        localStorage.setItem(CACHE_TIMESTAMP_KEY, new Date().toISOString());
    } catch (error) {
        console.error('Error caching data:', error);
    }
}

/**
 * Clear cache
 */
function clearCache() {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TIMESTAMP_KEY);
}

/**
 * Setup search functionality
 */
function setupSearch() {
    const searchInput = document.getElementById('prompt-search');
    const clearBtn = document.getElementById('clear-search');

    if (!searchInput || !clearBtn) return;

    // Handle input changes
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        filterPrompts(searchTerm);

        // Show/hide clear button
        if (searchTerm) {
            clearBtn.classList.add('visible');
        } else {
            clearBtn.classList.remove('visible');
        }
    });

    // Handle clear button click
    clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearBtn.classList.remove('visible');
        filterPrompts('');
        searchInput.focus();
    });
}

/**
 * Filter prompts based on search term
 */
function filterPrompts(searchTerm) {
    const promptCards = document.querySelectorAll('.prompt-card');
    const categoryGroups = document.querySelectorAll('.category-group');

    if (!searchTerm) {
        // Show all prompts and categories
        promptCards.forEach(card => {
            card.style.display = '';
        });
        categoryGroups.forEach(group => {
            group.style.display = '';
        });
        return;
    }

    // Hide all category groups initially
    categoryGroups.forEach(group => {
        group.style.display = 'none';
    });

    // Filter prompt cards
    promptCards.forEach(card => {
        const promptName = card.querySelector('h3')?.textContent?.toLowerCase() || '';
        const category = card.closest('.category-group')?.querySelector('h2')?.textContent?.toLowerCase() || '';
        const description = card.querySelector('.prompt-description')?.textContent?.toLowerCase() || '';

        // Check if search term matches name, category, or description
        if (promptName.includes(searchTerm) ||
            category.includes(searchTerm) ||
            description.includes(searchTerm)) {
            card.style.display = '';
            // Show the parent category group
            const parentGroup = card.closest('.category-group');
            if (parentGroup) {
                parentGroup.style.display = '';
            }
        } else {
            card.style.display = 'none';
        }
    });

    // Hide empty categories
    categoryGroups.forEach(group => {
        const visibleCards = group.querySelectorAll('.prompt-card:not([style*="display: none"])');
        if (visibleCards.length === 0) {
            group.style.display = 'none';
        }
    });
}

/**
 * Load prompt data from backend with caching
 */
async function loadPromptData(forceRefresh = false) {
    try {
        // Check cache first unless force refresh
        if (!forceRefresh && isCacheValid()) {
            const cached = getCachedData();
            if (cached) {
                console.log('📋 Loading from cache');
                currentPrompts = cached.prompts || {};
                currentStats = cached.stats || currentStats;
                activeSelections = cached.activeSelections || {};
                updateStatsDisplay();
                return;
            }
        }

        console.log('🌐 Fetching fresh data from backend');

        const response = await authenticatedFetch(`${AI_API_BASE_URL}/admin/prompts`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Transform backend data to match frontend expectations
        currentPrompts = {};
        data.prompts.forEach(prompt => {
            // Get the category for this prompt
            const category = getCategoryForPrompt(prompt);

            currentPrompts[prompt.promptId] = {
                promptId: prompt.promptId,
                name: prompt.name,
                type: prompt.type,
                memberType: prompt.memberType,
                status: getPromptStatus(prompt.promptId, data.activeSelections),
                isCustom: prompt.isCustom,
                tokenCount: prompt.tokenCount,
                systemPrompt: prompt.systemPrompt,
                userPromptTemplate: prompt.userPromptTemplate,
                variables: prompt.variables,
                category: category,
                lastModified: prompt.createdAt || prompt.updatedAt
            };
        });

        currentStats = data.stats;
        activeSelections = data.activeSelections;

        // Cache the data
        setCachedData({
            prompts: currentPrompts,
            stats: currentStats,
            activeSelections: activeSelections
        });

        updateStatsDisplay();
        console.log('📋 Loaded', Object.keys(currentPrompts).length, 'prompts');

    } catch (error) {
        console.error('❌ Failed to load prompt data:', error);
        showNotification('Failed to load prompt data from server', 'error');
    }
}

/**
 * Determine if a prompt is active based on active selections
 */
function getPromptStatus(promptId, activeSelections) {
    for (const [advisorType, activePromptId] of Object.entries(activeSelections)) {
        if (activePromptId === promptId) {
            return 'active';
        }
    }
    return 'inactive';
}

/**
 * Get category for a prompt based on its type and properties
 */
function getCategoryForPrompt(prompt) {
    // If prompt already has a category field, use it
    if (prompt.category) {
        return prompt.category;
    }

    // Map memberType to categories
    if (prompt.memberType) {
        return prompt.memberType; // mentors, coaches, sponsors, connectors, peers
    }

    // Map type to categories
    switch (prompt.type) {
        case 'goals_advisor':
        case 'superpowers_advisor':
            // Check name for better classification
            return prompt.name && prompt.name.includes('Superpower') ? 'skills' : 'goals';
        case 'board_analysis_advisor':
        case 'board_analysis':
        case 'form_completion':
            return 'overall';
        case 'mentor_advisor':
            // If no memberType, default to mentors
            return 'mentors';
        case 'board_member_advisor':
            return 'board_members';
        default:
            return null; // Don't map unknown types
    }
}

/**
 * Update the stats display
 */
function updateStatsDisplay() {
    document.getElementById('total-prompts').textContent = currentStats.totalPrompts || Object.keys(currentPrompts).length;
    document.getElementById('active-prompts').textContent = currentStats.activePrompts || Object.keys(activeSelections).length;
    document.getElementById('avg-tokens').textContent = currentStats.avgTokens || 0;
}

/**
 * Refresh data from server (clear cache and reload)
 */
async function refreshData() {
    clearCache();
    const refreshBtn = document.querySelector('.refresh-btn');
    if (refreshBtn) {
        refreshBtn.disabled = true;
        refreshBtn.textContent = 'Refreshing...';
    }

    try {
        await loadPromptData(true);
        await loadThemes();
        loadPromptCategories();
        populateThemeSelector();
        showNotification('Data refreshed successfully', 'success');
    } catch (error) {
        showNotification('Failed to refresh data', 'error');
    } finally {
        if (refreshBtn) {
            refreshBtn.disabled = false;
            refreshBtn.textContent = 'Refresh';
        }
    }
}

/**
 * Load and display prompt categories
 */
function loadPromptCategories() {
    const container = document.getElementById('prompt-categories');
    if (!container) {
        console.error('❌ prompt-categories container not found');
        return;
    }

    console.log('📊 Loading categories with prompts:', Object.keys(currentPrompts).length);

    // Define the valid categories that should be shown
    const validCategories = {
        'skills': 'Skills & Superpowers',
        'goals': 'Goals & Vision',
        'board_members': 'Board Members (Fallback)',
        'mentors': 'Mentors',
        'coaches': 'Coaches',
        'connectors': 'Connectors',
        'sponsors': 'Sponsors',
        'peers': 'Peers',
        'overall': 'Overall Board Advisor',
        'writing': 'Writing Assistant'
    };

    // Group prompts by category - map old prompts to categories too
    const categories = {};
    Object.entries(currentPrompts).forEach(([promptId, prompt]) => {
        let category = prompt.category;

        // If no category field, map from old structure
        if (!category) {
            if (prompt.memberType) {
                // Board member types map directly to categories
                category = prompt.memberType; // mentors, coaches, sponsors, connectors, peers
            } else if (prompt.type === 'goals_advisor' || prompt.type === 'superpowers_advisor') {
                // Map goals_advisor to either skills or goals
                category = prompt.name && prompt.name.includes('Superpower') ? 'skills' : 'goals';
            } else if (prompt.type === 'board_analysis_advisor' || prompt.type === 'board_analysis') {
                category = 'overall';
            } else if (prompt.type === 'form_completion') {
                category = 'overall'; // Form completion is an overall board function
            } else if (prompt.type === 'mentor_advisor' && !prompt.memberType) {
                category = 'mentors'; // Default mentor_advisor to mentors
            } else if (prompt.type === 'board_member_advisor') {
                category = 'board_members'; // Generic board member advisor fallback
            }
        }

        // Only include prompts that map to valid categories
        if (category && validCategories[category]) {
            if (!categories[category]) categories[category] = [];
            categories[category].push({ promptId, ...prompt });
        }
    });

    console.log('📁 Mapped categories:', Object.keys(categories));
    console.log('🔍 Active selections:', activeSelections);

    // Clear existing content
    container.innerHTML = '';

    // Show loading if no prompts loaded yet
    if (Object.keys(currentPrompts).length === 0) {
        console.log('⏳ No prompts loaded yet, showing spinner');
        container.innerHTML = `
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p>Loading AI prompt configurations...</p>
            </div>
        `;
        return;
    }

    console.log('✅ Creating category sections...');

    // Create category sections - ensure all 8 categories are shown
    Object.entries(validCategories).forEach(([categoryKey, categoryName]) => {
        const prompts = categories[categoryKey] || [];
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'prompt-category';

        // Show active prompt indicator and deactivate button for member types
        const activePromptId = activeSelections[categoryKey];

        // Handle 'None' as explicit fallback state
        let activeIndicator;
        if (activePromptId === 'None') {
            activeIndicator = '<span class="fallback-indicator">Using Fallback (board_member_advisor)</span>';
        } else if (activePromptId) {
            // Look up the prompt name from currentPrompts
            const activePrompt = currentPrompts[activePromptId];
            const displayName = activePrompt ? activePrompt.name : activePromptId;
            activeIndicator = `<span class="active-indicator">Active: ${displayName}</span>`;
        } else {
            activeIndicator = '<span class="inactive-indicator">No active prompt</span>';
        }

        // Only show deactivate button for member types that can fallback to board_member_advisor
        const memberTypes = ['mentors', 'coaches', 'sponsors', 'connectors', 'peers'];
        const showDeactivate = memberTypes.includes(categoryKey) && activePromptId && activePromptId !== 'None';
        const deactivateButton = showDeactivate ?
            `<button class="category-deactivate-btn" onclick="deactivateCategory('${categoryKey}')" title="Deactivate to use fallback prompt">
                <i class="icon-x"></i> Use Fallback
            </button>` : '';

        categoryDiv.innerHTML = `
            <div class="category-header">
                <div class="category-header-left">
                    <h3 class="category-title">${categoryName}</h3>
                    <span class="category-count">${prompts.length} prompts</span>
                </div>
                <div class="category-header-right">
                    ${activeIndicator}
                    ${deactivateButton}
                </div>
            </div>
            <div class="category-description">
                Advanced AI prompts for ${categoryName.toLowerCase()} functionality
            </div>
            <div class="prompts-grid">
                ${prompts.map(prompt => createPromptCard(prompt, categoryKey)).join('')}
            </div>
        `;
        container.appendChild(categoryDiv);
    });
}

/**
 * Create HTML for a single prompt card
 */
function createPromptCard(prompt, categoryKey) {
    const isActive = activeSelections[categoryKey] === prompt.promptId;
    const isCustom = prompt.isCustom;

    return `
        <div class="prompt-card ${isActive ? 'active' : ''}" data-type="${prompt.promptId}">
            <div class="prompt-header">
                <h4 class="prompt-title">${prompt.name}</h4>
                <div class="prompt-badges">
                    ${isActive && !isCustom ? '<span class="default-badge">Active Default</span>' : ''}
                    ${isActive && isCustom ? '<span class="active-badge">Active Custom</span>' : ''}
                    ${isCustom ? '<span class="custom-badge">Custom</span>' : '<span class="system-badge">System</span>'}
                </div>
            </div>

            <div class="prompt-meta">
                <div class="token-count">${prompt.tokenCount || 0} tokens</div>
            </div>

            <div class="prompt-description">
                System prompt for ${prompt.name.toLowerCase()} functionality
            </div>

            <div class="prompt-actions">
                <button class="action-btn view-btn" onclick="viewPrompt('${prompt.promptId}')">
                    <i class="icon-eye"></i> View
                </button>
                <button class="action-btn test-btn" onclick="testPrompt('${prompt.promptId}')">
                    <i class="icon-test"></i> Test
                </button>
                ${isCustom ? `
                    <button class="action-btn duplicate-btn" onclick="duplicatePrompt('${prompt.promptId}')">
                        <i class="icon-copy"></i> Duplicate
                    </button>
                ` : `
                    <button class="action-btn duplicate-btn" onclick="duplicatePrompt('${prompt.promptId}')">
                        <i class="icon-copy"></i> Duplicate
                    </button>
                `}
                ${!isActive ? `
                    <button class="action-btn activate-btn" onclick="activatePrompt('${prompt.promptId}')">
                        <i class="icon-check"></i> Activate
                    </button>
                ` : ''}
                ${isCustom ? `
                    <button class="action-btn delete-btn" onclick="deleteCustomPrompt('${prompt.promptId}')">
                        <i class="icon-delete"></i> Delete
                    </button>
                ` : ''}
            </div>
        </div>
    `;
}

/**
 * Activate a prompt
 */
async function activatePrompt(promptId) {
    console.log('🎯 ACTIVATE DEBUG: Starting activation for promptId:', promptId);

    // Prevent any potential authentication flows
    console.log('🎯 ACTIVATE DEBUG: This is admin interface - no authentication required');

    try {
        const url = `${AI_API_BASE_URL}/admin/prompts/${promptId}/activate`;
        console.log('🎯 ACTIVATE DEBUG: Request URL:', url);

        // Send proper PUT request with headers and body
        const response = await authenticatedFetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'activate'
            })
        });

        console.log('🎯 ACTIVATE DEBUG: Response status:', response.status);
        console.log('🎯 ACTIVATE DEBUG: Response headers:', [...response.headers.entries()]);

        if (!response.ok) {
            const errorText = await response.text();
            console.log('🎯 ACTIVATE DEBUG: Error response body:', errorText);
            throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();
        console.log('🎯 ACTIVATE DEBUG: Success response:', result);

        showNotification('Prompt activated successfully', 'success');
        await refreshData(); // Refresh to get updated state

    } catch (error) {
        console.error('🎯 ACTIVATE DEBUG: Error activating prompt:', error);
        showNotification(`Failed to activate prompt: ${error.message}`, 'error');
    }
}

/**
 * Deactivate a category (set to use fallback prompt)
 * Uses the same activate API but with promptId = "None"
 */
async function deactivateCategory(categoryKey) {
    console.log('🎯 CATEGORY DEACTIVATE: Starting deactivation for category:', categoryKey);

    try {
        // Use the same activate API endpoint but with "None" as the promptId
        const url = `${AI_API_BASE_URL}/admin/prompts/None/activate`;
        console.log('🎯 CATEGORY DEACTIVATE: Request URL:', url);

        const response = await authenticatedFetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'activate',
                category: categoryKey  // Pass the category so lambda knows which ADVISOR# entry to update
            })
        });

        console.log('🎯 CATEGORY DEACTIVATE: Response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.log('🎯 CATEGORY DEACTIVATE: Error response body:', errorText);
            throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();
        console.log('🎯 CATEGORY DEACTIVATE: Success response:', result);

        showNotification(`${categoryKey} category deactivated - now using fallback prompt`, 'success');
        await refreshData(); // Refresh to get updated state

    } catch (error) {
        console.error('🎯 CATEGORY DEACTIVATE: Error deactivating category:', error);
        showNotification(`Failed to deactivate ${categoryKey} category: ${error.message}`, 'error');
    }
}

/**
 * Create a new prompt
 */
async function createPrompt(promptData) {
    try {
        const response = await authenticatedFetch(`${AI_API_BASE_URL}/admin/prompts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(promptData)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        showNotification(`Prompt "${promptData.name}" created successfully`, 'success');
        await refreshData();
        return result;

    } catch (error) {
        console.error('Error creating prompt:', error);
        showNotification('Failed to create prompt', 'error');
        throw error;
    }
}

/**
 * Delete a custom prompt
 */
async function deleteCustomPrompt(promptId) {
    console.log('🗑️ DELETE DEBUG: Starting deletion for promptId:', promptId);

    if (!confirm('Are you sure you want to delete this custom prompt?')) {
        console.log('🗑️ DELETE DEBUG: User cancelled deletion');
        return;
    }

    // Prevent any potential authentication flows
    console.log('🗑️ DELETE DEBUG: This is admin interface - no authentication required');

    try {
        const url = `${AI_API_BASE_URL}/admin/prompts/${promptId}`;
        console.log('🗑️ DELETE DEBUG: Request URL:', url);

        // Send proper DELETE request
        const response = await authenticatedFetch(url, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log('🗑️ DELETE DEBUG: Response status:', response.status);
        console.log('🗑️ DELETE DEBUG: Response headers:', [...response.headers.entries()]);

        if (!response.ok) {
            const errorText = await response.text();
            console.log('🗑️ DELETE DEBUG: Error response body:', errorText);
            throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();
        console.log('🗑️ DELETE DEBUG: Success response:', result);

        showNotification('Custom prompt deleted successfully', 'success');
        await refreshData();

    } catch (error) {
        console.error('🗑️ DELETE DEBUG: Error deleting prompt:', error);
        showNotification(`Failed to delete prompt: ${error.message}`, 'error');
    }
}

/**
 * Show notification message
 */
function showNotification(message, type = 'info') {
    // Remove any existing notification
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

/**
 * View prompt details
 */
function viewPrompt(promptId) {
    const prompt = currentPrompts[promptId];
    if (!prompt) return;

    document.getElementById('view-prompt-title').textContent = prompt.name;
    document.getElementById('view-system-prompt').textContent = prompt.systemPrompt;
    document.getElementById('view-user-prompt').textContent = prompt.userPromptTemplate;
    document.getElementById('view-config').innerHTML = `
        <p><strong>Type:</strong> ${prompt.type}</p>
        ${prompt.memberType ? `<p><strong>Member Type:</strong> ${prompt.memberType}</p>` : ''}
        <p><strong>Token Count:</strong> ${prompt.tokenCount}</p>
        <p><strong>Status:</strong> ${prompt.status}</p>
        <p><strong>Variables:</strong> ${prompt.variables ? prompt.variables.join(', ') : 'None'}</p>
        <p><strong>Last Modified:</strong> ${new Date(prompt.lastModified).toLocaleString()}</p>
    `;

    document.getElementById('view-prompt-modal').style.display = 'block';
}

/**
 * Test prompt functionality (placeholder)
 */
function testPrompt(promptId) {
    showNotification('Prompt testing functionality coming soon', 'info');
}

/**
 * Duplicate prompt
 */
function duplicatePrompt(promptId) {
    console.log('🔄 Duplicating prompt:', promptId);

    const prompt = currentPrompts[promptId];
    if (!prompt) {
        console.error('Prompt not found:', promptId);
        console.log('Available prompts:', Object.keys(currentPrompts));
        return;
    }

    console.log('📋 Prompt to duplicate:', prompt);

    // Show the modal first
    showAddPromptModal();

    // Then fill the fields after a small delay to ensure modal is rendered
    setTimeout(() => {
        const nameField = document.getElementById('prompt-name');
        const categoryField = document.getElementById('prompt-category');
        const systemPromptField = document.getElementById('system-prompt');
        const userTemplateField = document.getElementById('user-prompt-template');
        const variablesField = document.getElementById('prompt-variables');

        console.log('📝 Form fields found:', {
            name: !!nameField,
            category: !!categoryField,
            system: !!systemPromptField,
            user: !!userTemplateField,
            variables: !!variablesField
        });

        if (nameField) {
            nameField.value = `${prompt.name} (Copy)`;
            console.log('✅ Set name:', nameField.value);
        }

        // Set the category field based on the prompt's category
        if (categoryField) {
            const category = prompt.category || getCategoryForPrompt(prompt);
            categoryField.value = category || '';
            console.log('✅ Set category:', categoryField.value);
        }

        if (systemPromptField) {
            systemPromptField.value = prompt.systemPrompt || '';
            console.log('✅ Set system prompt length:', systemPromptField.value.length);
        }

        if (userTemplateField) {
            userTemplateField.value = prompt.userPromptTemplate || '';
            console.log('✅ Set user template length:', userTemplateField.value.length);
        }

        if (variablesField) {
            variablesField.value = prompt.variables ? prompt.variables.join(', ') : '';
            console.log('✅ Set variables:', variablesField.value);
        }
    }, 100);
}

/**
 * Export configuration
 */
function exportConfig() {
    const config = {
        prompts: currentPrompts,
        activeSelections: activeSelections,
        stats: currentStats,
        exportTime: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `prompt-config-${new Date().toISOString().split('T')[0]}.json`;
    a.click();

    URL.revokeObjectURL(url);
    showNotification('Configuration exported successfully', 'success');
}

// Modal functions
function showAddPromptModal() {
    document.getElementById('add-prompt-modal').style.display = 'block';
}

function hideAddPromptModal() {
    document.getElementById('add-prompt-modal').style.display = 'none';
    document.getElementById('add-prompt-form').reset();
}

function hideViewPromptModal() {
    document.getElementById('view-prompt-modal').style.display = 'none';
}

function editPrompt() {
    console.log('✏️ EDIT DEBUG: Edit prompt requested');

    // Get the current prompt data from the view modal
    const title = document.getElementById('view-prompt-title').textContent;
    console.log('✏️ EDIT DEBUG: Prompt title:', title);

    // For now, we'll implement a basic version that opens the add modal with current data
    // TODO: Implement proper edit modal with pre-filled data
    showNotification('Prompt editing: Please create a new prompt with updated content for now', 'info');
    hideViewPromptModal();
    showAddPromptModal();
}

async function handleAddPrompt(event) {
    event.preventDefault();

    const formData = new FormData(event.target);

    // CRITICAL DEBUG: Log everything
    console.log('🔍 ALL FormData entries:');
    for (let [key, value] of formData.entries()) {
        console.log(`  ${key}: "${value}"`);
    }

    // Check form elements directly
    console.log('📝 Direct element values:');
    const form = event.target;
    console.log(`  prompt-name input: "${form.querySelector('#prompt-name')?.value}"`);
    console.log(`  prompt-category select: "${form.querySelector('#prompt-category')?.value}"`);
    console.log(`  system-prompt textarea: "${form.querySelector('#system-prompt')?.value?.substring(0, 50)}..."`);

    const promptData = {
        name: formData.get('prompt-name'),
        category: formData.get('prompt-category'),
        systemPrompt: formData.get('system-prompt'),
        userPromptTemplate: formData.get('user-prompt-template'),
        variables: formData.get('prompt-variables') ? formData.get('prompt-variables').split(',').map(v => v.trim()) : [],
        tokenCount: Math.floor(Math.random() * 500) + 1000 // Estimate
    };

    console.log('📋 Final promptData object:', JSON.stringify(promptData, null, 2));

    try {
        await createPrompt(promptData);
        hideAddPromptModal();
    } catch (error) {
        // Error already shown in createPrompt
    }
}

/**
 * Show add prompt modal
 */
function showAddPromptModal() {
    const modal = document.getElementById('add-prompt-modal');
    if (modal) {
        modal.style.display = 'block';
        // Clear form
        const form = document.getElementById('add-prompt-form');
        if (form) form.reset();
    }
}

/**
 * Hide add prompt modal
 */
function hideAddPromptModal() {
    const modal = document.getElementById('add-prompt-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

/**
 * Hide view prompt modal
 */
function hideViewPromptModal() {
    const modal = document.getElementById('view-prompt-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

/**
 * Load available themes from the server
 */
async function loadThemes() {
    try {
        const response = await authenticatedFetch(`${AI_API_BASE_URL}/admin/themes`);

        if (!response.ok) {
            throw new Error(`Failed to load themes: ${response.status}`);
        }

        const data = await response.json();
        availableThemes = data.themes || [];
        activeThemeId = data.activeThemeId;

        console.log(`📚 Loaded ${availableThemes.length} themes, active: ${activeThemeId}`);

    } catch (error) {
        console.error('❌ Error loading themes:', error);
        showNotification('Failed to load themes', 'error');
    }
}

/**
 * Setup theme selector UI
 */
function setupThemeSelector() {
    // Add theme selector to the control section
    const controlSection = document.querySelector('.admin-controls');
    if (!controlSection) return;

    // Create theme selector container
    const themeSelectorDiv = document.createElement('div');
    themeSelectorDiv.className = 'theme-selector-section';
    themeSelectorDiv.innerHTML = `
        <div class="theme-selector-container">
            <label for="theme-select" class="theme-label">Theme:</label>
            <select id="theme-select" class="theme-select">
                <option value="">Select a theme...</option>
            </select>
            <button id="activate-theme-btn" class="admin-btn admin-btn-primary" onclick="activateSelectedTheme()" disabled>
                Activate Theme
            </button>
            <button id="save-current-btn" class="admin-btn admin-btn-secondary" onclick="showSaveCurrentModal()">
                Save Current Advisors
            </button>
            <button id="delete-theme-btn" class="admin-btn admin-btn-danger" onclick="deleteSelectedTheme()" style="display: none;">
                Delete Theme
            </button>
        </div>
        <div id="theme-preview" class="theme-preview" style="display: none;">
            <!-- Theme preview will be populated here -->
        </div>
    `;

    // Insert before the control buttons
    const controlButtons = controlSection.querySelector('.control-buttons');
    controlSection.insertBefore(themeSelectorDiv, controlButtons);

    // Populate theme selector
    populateThemeSelector();
}

/**
 * Populate the theme selector dropdown
 */
function populateThemeSelector() {
    const themeSelect = document.getElementById('theme-select');
    if (!themeSelect) return;

    // Clear existing options except the first
    themeSelect.innerHTML = '<option value="">Select a theme...</option>';

    // Add theme options
    availableThemes.forEach(theme => {
        const option = document.createElement('option');
        option.value = theme.themeId;
        option.textContent = theme.themeName;
        if (theme.themeId === activeThemeId) {
            option.textContent += ' (Active)';
            option.selected = true;
        }
        themeSelect.appendChild(option);
    });

    // Add event listener for theme selection
    themeSelect.addEventListener('change', handleThemeSelection);
}

/**
 * Handle theme selection
 */
function handleThemeSelection() {
    const themeSelect = document.getElementById('theme-select');
    const activateBtn = document.getElementById('activate-theme-btn');
    const previewDiv = document.getElementById('theme-preview');

    const selectedThemeId = themeSelect.value;

    if (!selectedThemeId) {
        activateBtn.disabled = true;
        previewDiv.style.display = 'none';
        return;
    }

    // Find the selected theme
    const selectedTheme = availableThemes.find(t => t.themeId === selectedThemeId);
    if (!selectedTheme) return;

    // Enable activate button if not already active
    activateBtn.disabled = (selectedThemeId === activeThemeId);

    // Show/hide delete button - don't allow deletion of Default theme
    const deleteBtn = document.getElementById('delete-theme-btn');
    if (selectedThemeId === 'Default') {
        deleteBtn.style.display = 'none';
    } else {
        deleteBtn.style.display = 'inline-block';
    }

    // Show theme preview
    showThemePreview(selectedTheme);
}

/**
 * Show theme preview
 */
function showThemePreview(theme) {
    const previewDiv = document.getElementById('theme-preview');
    if (!previewDiv) return;

    // Board member categories
    const boardMemberCategories = ['mentors', 'coaches', 'sponsors', 'connectors', 'peers'];

    // Categorize changes
    const changes = {
        activated: [],
        fallback: [],
        unchanged: []
    };

    // Check each category
    const allCategories = {
        'skills': 'Skills & Superpowers',
        'goals': 'Goals & Vision',
        'board_members': 'Board Members (Fallback)',
        'mentors': 'Mentors',
        'coaches': 'Coaches',
        'sponsors': 'Sponsors',
        'connectors': 'Connectors',
        'peers': 'Peers',
        'overall': 'Overall Board',
        'writing': 'Writing Assistant'
    };

    Object.keys(allCategories).forEach(category => {
        if (theme.prompts && theme.prompts[category]) {
            changes.activated.push(`✅ ${allCategories[category]} → ${theme.prompts[category].replace(/_/g, ' ')}`);
        } else if (boardMemberCategories.includes(category)) {
            changes.fallback.push(`🔄 ${allCategories[category]} → Use Board Members fallback`);
        } else if (category !== 'board_members') {
            changes.unchanged.push(`➖ ${allCategories[category]} → No change`);
        }
    });

    // Build preview HTML
    let previewHTML = `
        <h3>Theme Preview: ${theme.themeName}</h3>
        <p class="theme-description">${theme.description || ''}</p>
        <div class="theme-changes">
    `;

    if (changes.activated.length > 0) {
        previewHTML += '<div class="change-section"><strong>Will be updated:</strong><ul>';
        changes.activated.forEach(change => {
            previewHTML += `<li>${change}</li>`;
        });
        previewHTML += '</ul></div>';
    }

    if (changes.fallback.length > 0) {
        previewHTML += '<div class="change-section"><strong>Will use fallback:</strong><ul>';
        changes.fallback.forEach(change => {
            previewHTML += `<li>${change}</li>`;
        });
        previewHTML += '</ul></div>';
    }

    if (changes.unchanged.length > 0) {
        previewHTML += '<div class="change-section"><strong>Will stay unchanged:</strong><ul>';
        changes.unchanged.forEach(change => {
            previewHTML += `<li>${change}</li>`;
        });
        previewHTML += '</ul></div>';
    }

    previewHTML += '</div>';

    previewDiv.innerHTML = previewHTML;
    previewDiv.style.display = 'block';
}

/**
 * Activate selected theme
 */
async function activateSelectedTheme() {
    const themeSelect = document.getElementById('theme-select');
    const selectedThemeId = themeSelect.value;

    if (!selectedThemeId) return;

    const activateBtn = document.getElementById('activate-theme-btn');
    activateBtn.disabled = true;
    activateBtn.textContent = 'Activating...';

    try {
        const response = await authenticatedFetch(`${AI_API_BASE_URL}/admin/themes/${selectedThemeId}/activate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to activate theme: ${response.status}`);
        }

        const result = await response.json();

        showNotification(`Theme activated successfully`, 'success');

        // Refresh all data to reflect changes (clears cache and reloads everything)
        await refreshData();

    } catch (error) {
        console.error('❌ Error activating theme:', error);
        showNotification('Failed to activate theme', 'error');
    } finally {
        activateBtn.textContent = 'Activate Theme';
        handleThemeSelection(); // Re-enable button if needed
    }
}

/**
 * Show modal to save current configuration as a new theme
 */
function showSaveCurrentModal() {
    // Create modal backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop save-theme-backdrop';
    backdrop.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.3s ease-out;
    `;

    // Create modal
    const modal = document.createElement('div');
    modal.className = 'save-theme-modal';
    modal.style.cssText = `
        background: white;
        padding: 30px;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        max-width: 500px;
        width: 90%;
        position: relative;
        animation: slideIn 0.3s ease-out;
    `;

    modal.innerHTML = `
        <div class="save-theme-header">
            <h2 style="margin: 0 0 8px 0; color: #007cba; font-size: 24px;">Save Current Advisors</h2>
            <p style="margin: 0 0 25px 0; color: #666; font-size: 14px;">Create a new theme from your current advisor configuration</p>
            <button class="modal-close-btn" onclick="closeSaveCurrentModal()" style="
                position: absolute;
                top: 20px;
                right: 20px;
                background: none;
                border: none;
                font-size: 24px;
                color: #999;
                cursor: pointer;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: all 0.2s;
            " onmouseover="this.style.background='#f0f0f0'; this.style.color='#333'" onmouseout="this.style.background='none'; this.style.color='#999'">×</button>
        </div>

        <form id="save-theme-form" onsubmit="handleSaveCurrentTheme(event)" style="display: flex; flex-direction: column; gap: 20px;">
            <div class="form-group">
                <label for="theme-name" style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">Theme Name</label>
                <input type="text"
                       id="theme-name"
                       name="theme-name"
                       required
                       placeholder="e.g., My Custom Advisors"
                       style="
                           width: 100%;
                           padding: 12px;
                           border: 2px solid #e0e0e0;
                           border-radius: 6px;
                           font-size: 16px;
                           transition: border-color 0.2s;
                           box-sizing: border-box;
                       "
                       onfocus="this.style.borderColor='#007cba'"
                       onblur="this.style.borderColor='#e0e0e0'">
            </div>

            <div class="form-group">
                <label for="theme-description" style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">Description (Optional)</label>
                <textarea id="theme-description"
                          name="theme-description"
                          rows="3"
                          placeholder="Describe the purpose or style of this advisor configuration..."
                          style="
                              width: 100%;
                              padding: 12px;
                              border: 2px solid #e0e0e0;
                              border-radius: 6px;
                              font-size: 14px;
                              resize: vertical;
                              min-height: 80px;
                              transition: border-color 0.2s;
                              box-sizing: border-box;
                              font-family: inherit;
                          "
                          onfocus="this.style.borderColor='#007cba'"
                          onblur="this.style.borderColor='#e0e0e0'"></textarea>
            </div>

            <div class="current-config-preview" style="
                background: #f8f9fa;
                padding: 15px;
                border-radius: 6px;
                border: 1px solid #e0e0e0;
            ">
                <h3 style="margin: 0 0 10px 0; font-size: 16px; color: #333;">Current Configuration Preview</h3>
                <div id="current-config-list" style="font-size: 14px; color: #666;">
                    Loading current advisors...
                </div>
            </div>

            <div class="modal-actions" style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 10px;">
                <button type="button"
                        class="cancel-btn"
                        onclick="closeSaveCurrentModal()"
                        style="
                            padding: 12px 24px;
                            border: 2px solid #ddd;
                            background: white;
                            color: #666;
                            border-radius: 6px;
                            cursor: pointer;
                            font-size: 14px;
                            font-weight: 500;
                            transition: all 0.2s;
                        "
                        onmouseover="this.style.borderColor='#bbb'; this.style.color='#333'"
                        onmouseout="this.style.borderColor='#ddd'; this.style.color='#666'">
                    Cancel
                </button>
                <button type="submit"
                        class="save-btn"
                        style="
                            padding: 12px 24px;
                            border: none;
                            background: #007cba;
                            color: white;
                            border-radius: 6px;
                            cursor: pointer;
                            font-size: 14px;
                            font-weight: 500;
                            transition: all 0.2s;
                        "
                        onmouseover="this.style.background='#005a8a'"
                        onmouseout="this.style.background='#007cba'">
                    Save Theme
                </button>
            </div>
        </form>
    `;

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    // Add CSS animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes slideIn {
            from { transform: translateY(-50px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);

    // Focus on the name input
    setTimeout(() => {
        document.getElementById('theme-name').focus();
    }, 100);

    // Load current configuration preview
    loadCurrentConfigPreview();

    // Close on backdrop click
    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
            closeSaveCurrentModal();
        }
    });

    // Close on Escape key
    document.addEventListener('keydown', handleSaveModalKeydown);
}

/**
 * Close the save current theme modal
 */
function closeSaveCurrentModal() {
    const backdrop = document.querySelector('.save-theme-backdrop');
    if (backdrop) {
        backdrop.remove();
    }
    document.removeEventListener('keydown', handleSaveModalKeydown);
}

/**
 * Handle keyboard events for save modal
 */
function handleSaveModalKeydown(event) {
    if (event.key === 'Escape') {
        closeSaveCurrentModal();
    }
}

/**
 * Load current configuration preview
 */
function loadCurrentConfigPreview() {
    const previewDiv = document.getElementById('current-config-list');
    if (!previewDiv) return;

    const configItems = [];

    // Define the categories to show in the correct order
    const categoriesToShow = [
        'skills',
        'goals',
        'board_members',
        'mentors',
        'coaches',
        'sponsors',
        'connectors',
        'peers',
        'overall',
        'writing'
    ];

    const categoryNames = {
        'skills': 'Skills & Superpowers',
        'goals': 'Goals & Vision',
        'board_members': 'Board Members (Fallback)',
        'mentors': 'Mentors',
        'coaches': 'Coaches',
        'sponsors': 'Sponsors',
        'connectors': 'Connectors',
        'peers': 'Peers',
        'overall': 'Overall Board',
        'writing': 'Writing Assistant'
    };

    // Show active prompts for main categories only
    categoriesToShow.forEach(category => {
        const promptId = activeSelections[category];
        const categoryName = categoryNames[category];

        if (promptId === 'None' || !promptId) {
            configItems.push(`• <strong>${categoryName}:</strong> <em>Using fallback</em>`);
        } else {
            const prompt = currentPrompts[promptId];
            const promptName = prompt ? prompt.name : promptId;
            configItems.push(`• <strong>${categoryName}:</strong> ${promptName}`);
        }
    });

    if (configItems.length === 0) {
        previewDiv.innerHTML = '<em>No active advisors found</em>';
    } else {
        previewDiv.innerHTML = configItems.join('<br>');
    }
}

/**
 * Delete selected theme
 */
async function deleteSelectedTheme() {
    const themeSelect = document.getElementById('theme-select');
    const selectedThemeId = themeSelect.value;

    if (!selectedThemeId || selectedThemeId === 'Default') {
        showNotification('Cannot delete Default theme', 'error');
        return;
    }

    const selectedTheme = availableThemes.find(t => t.themeId === selectedThemeId);
    if (!selectedTheme) {
        showNotification('Theme not found', 'error');
        return;
    }

    // Confirm deletion
    if (!confirm(`Are you sure you want to delete the theme "${selectedTheme.themeName}"? This action cannot be undone.`)) {
        return;
    }

    try {
        const response = await authenticatedFetch(`${AI_API_BASE_URL}/admin/themes/${selectedThemeId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error(`Failed to delete theme: ${response.status}`);
        }

        showNotification(`Theme "${selectedTheme.themeName}" deleted successfully`, 'success');

        // If we deleted the currently active theme, reset to Default
        if (selectedThemeId === activeThemeId) {
            activeThemeId = 'Default';
        }

        // Refresh all data to reflect changes
        await refreshData();

    } catch (error) {
        console.error('❌ Error deleting theme:', error);
        showNotification('Failed to delete theme', 'error');
    }
}

/**
 * Handle save current theme form submission
 */
async function handleSaveCurrentTheme(event) {
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);
    const themeName = formData.get('theme-name').trim();
    const description = formData.get('theme-description').trim() || `Custom theme: ${themeName}`;

    if (!themeName) {
        showNotification('Please enter a theme name', 'error');
        return;
    }

    const saveBtn = form.querySelector('.save-btn');
    const originalText = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
        const response = await authenticatedFetch(`${AI_API_BASE_URL}/admin/themes/advanced/save`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: themeName,
                description: description
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to save theme: ${response.status}`);
        }

        const result = await response.json();

        showNotification(`Theme "${themeName}" saved successfully`, 'success');
        closeSaveCurrentModal();

        // Refresh all data to show new theme
        await refreshData();

    } catch (error) {
        console.error('❌ Error saving theme:', error);
        showNotification('Failed to save theme', 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
    }
}

// =============================================================================
// Token Management Functions
// =============================================================================

/**
 * Create token management UI if it doesn't exist
 */
function createTokenManagementUI() {
    // Check if already exists
    if (document.querySelector('.token-management-section')) {
        return;
    }

    // Find insertion point (before prompt-categories)
    const promptCategoriesEl = document.getElementById('prompt-categories');
    if (!promptCategoriesEl) {
        console.error('Could not find prompt-categories element to insert token management');
        return;
    }

    // Create token management section
    const tokenSection = document.createElement('div');
    tokenSection.className = 'token-management-section';
    tokenSection.innerHTML = `
        <div class="section-header">
            <h2>Access Token Management</h2>
            <p class="section-subtitle">Provide access tokens for users to access the application</p>
        </div>

        <div class="token-stats">
            <div class="stat-card">
                <div class="stat-number" id="available-tokens">-</div>
                <div class="stat-label">Available</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="assigned-tokens">-</div>
                <div class="stat-label">Assigned</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="claimed-tokens">-</div>
                <div class="stat-label">Claimed</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="total-tokens">-</div>
                <div class="stat-label">Total</div>
            </div>
        </div>

        <div class="token-actions">
            <button class="admin-btn admin-btn-primary" onclick="getNextToken()">
                Get Next Token
            </button>
            <button class="admin-btn admin-btn-secondary" onclick="showGenerateTokensModal()">
                Generate New Tokens
            </button>
            <button class="admin-btn admin-btn-secondary" onclick="refreshTokenStats()">
                Refresh Stats
            </button>
        </div>

        <div class="token-result" id="token-result" style="display: none;">
            <div class="token-display">
                <label>Access Token:</label>
                <div class="token-code-display">
                    <span id="token-code"></span>
                    <button class="copy-btn" onclick="copyTokenToClipboard()" title="Copy to clipboard">📋</button>
                </div>
                <p class="token-info">Token has been assigned and copied to clipboard. Expires in 2 weeks.</p>
            </div>
        </div>
    `;

    // Insert before prompt categories
    promptCategoriesEl.parentNode.insertBefore(tokenSection, promptCategoriesEl);

    // Create modals if they don't exist
    createTokenModals();
}

/**
 * Create token modals if they don't exist
 */
function createTokenModals() {
    // Check if modals already exist
    if (document.getElementById('generate-tokens-modal')) {
        return;
    }

    // Find app container
    const appContainer = document.querySelector('.app');
    if (!appContainer) {
        console.error('Could not find app container to insert modals');
        return;
    }

    // Create modals container
    const modalsContainer = document.createElement('div');
    modalsContainer.innerHTML = `
        <!-- Generate Tokens Modal -->
        <div id="generate-tokens-modal" class="modal" style="display: none;">
            <div class="modal-content admin-modal-content">
                <div class="modal-header">
                    <h2>Generate New Tokens</h2>
                    <button class="modal-close" onclick="hideGenerateTokensModal()">×</button>
                </div>
                <form id="generate-tokens-form" onsubmit="handleGenerateTokens(event)">
                    <div class="form-group">
                        <label for="token-count">Number of Tokens</label>
                        <input type="number" id="token-count" name="token-count" value="10" min="1" max="100" required>
                        <small>Generate between 1 and 100 new access tokens</small>
                    </div>

                    <div class="modal-actions">
                        <button type="button" class="admin-btn admin-btn-secondary" onclick="hideGenerateTokensModal()">
                            Cancel
                        </button>
                        <button type="submit" class="admin-btn admin-btn-primary">
                            Generate Tokens
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- No Tokens Available Modal -->
        <div id="no-tokens-modal" class="modal" style="display: none;">
            <div class="modal-content admin-modal-content">
                <div class="modal-header">
                    <h2>No Tokens Available</h2>
                    <button class="modal-close" onclick="hideNoTokensModal()">×</button>
                </div>
                <div class="modal-body">
                    <div class="no-tokens-message">
                        <p>There are currently no available access tokens.</p>
                        <p>You can generate new tokens using the "Generate New Tokens" button, or wait for existing assigned tokens to expire.</p>
                    </div>
                </div>
                <div class="modal-actions">
                    <button class="admin-btn admin-btn-secondary" onclick="hideNoTokensModal()">
                        Close
                    </button>
                    <button class="admin-btn admin-btn-primary" onclick="hideNoTokensModal(); showGenerateTokensModal();">
                        Generate Tokens
                    </button>
                </div>
            </div>
        </div>
    `;

    // Append modals to app container
    appContainer.appendChild(modalsContainer);
}

/**
 * Load token statistics
 */
async function loadTokenStats() {
    // Create UI if it doesn't exist
    createTokenManagementUI();

    // Check if token management elements exist
    if (!document.getElementById('available-tokens')) {
        console.log('Token management elements not found, skipping token stats load');
        return;
    }

    if (!adminPassword) {
        adminPassword = await promptForPassword();
        if (!adminPassword) return;
    }

    try {
        const response = await fetch(`${AI_API_BASE_URL}/admin/tokens/stats`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Admin-Password': adminPassword
            }
        });

        if (response.ok) {
            const stats = await response.json();
            updateTokenStatsDisplay(stats);
        } else {
            console.error('Failed to load token stats');
        }
    } catch (error) {
        console.error('Error loading token stats:', error);
    }
}

/**
 * Update token stats display
 */
function updateTokenStatsDisplay(stats) {
    const availableEl = document.getElementById('available-tokens');
    const assignedEl = document.getElementById('assigned-tokens');
    const claimedEl = document.getElementById('claimed-tokens');
    const totalEl = document.getElementById('total-tokens');

    if (availableEl) availableEl.textContent = stats.AVAILABLE || 0;
    if (assignedEl) assignedEl.textContent = stats.ASSIGNED || 0;
    if (claimedEl) claimedEl.textContent = stats.CLAIMED || 0;
    if (totalEl) totalEl.textContent = stats.total || 0;
}

/**
 * Get next available token
 */
async function getNextToken() {
    if (!adminPassword) {
        adminPassword = await promptForPassword();
        if (!adminPassword) return;
    }

    try {
        const response = await fetch(`${AI_API_BASE_URL}/admin/tokens/next`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Admin-Password': adminPassword
            }
        });

        if (response.ok) {
            const result = await response.json();
            displayToken(result.accessCode);
            // Copy to clipboard automatically
            await copyTokenToClipboard(result.accessCode);
            // Refresh stats
            await loadTokenStats();
        } else if (response.status === 404) {
            // No tokens available
            console.log('No tokens available, showing modal');
            showNoTokensModal();
        } else {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.error('Failed to get next token:', errorData);
            alert(`Failed to get next token: ${errorData.error || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Error getting next token:', error);
        alert('Error getting next token. Please check your connection and try again.');
    }
}

/**
 * Display token in the result area
 */
function displayToken(token) {
    const tokenCodeEl = document.getElementById('token-code');
    const tokenResultEl = document.getElementById('token-result');

    if (tokenCodeEl) tokenCodeEl.textContent = token;
    if (tokenResultEl) tokenResultEl.style.display = 'block';
}

/**
 * Copy token to clipboard
 */
async function copyTokenToClipboard(tokenOverride = null) {
    const tokenCodeEl = document.getElementById('token-code');
    const token = tokenOverride || (tokenCodeEl ? tokenCodeEl.textContent : '');

    try {
        await navigator.clipboard.writeText(token);

        // Update copy button to show success
        const copyBtn = document.querySelector('.copy-btn');
        const originalText = copyBtn.textContent;
        copyBtn.textContent = '✓';
        copyBtn.style.color = 'green';

        setTimeout(() => {
            copyBtn.textContent = originalText;
            copyBtn.style.color = '';
        }, 2000);

    } catch (error) {
        console.error('Failed to copy to clipboard:', error);

        // Fallback: select the text
        const tokenElement = document.getElementById('token-code');
        const range = document.createRange();
        range.selectNode(tokenElement);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);

        alert('Token selected. Please copy manually with Ctrl+C (Cmd+C on Mac)');
    }
}

/**
 * Refresh token statistics
 */
async function refreshTokenStats() {
    await loadTokenStats();
}

/**
 * Show generate tokens modal
 */
function showGenerateTokensModal() {
    document.getElementById('generate-tokens-modal').style.display = 'flex';
}

/**
 * Hide generate tokens modal
 */
function hideGenerateTokensModal() {
    document.getElementById('generate-tokens-modal').style.display = 'none';
}

/**
 * Handle generate tokens form submission
 */
async function handleGenerateTokens(event) {
    event.preventDefault();

    if (!adminPassword) {
        adminPassword = await promptForPassword();
        if (!adminPassword) return;
    }

    const formData = new FormData(event.target);
    const count = parseInt(formData.get('token-count'));

    try {
        const response = await fetch(`${AI_API_BASE_URL}/admin/tokens/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Admin-Password': adminPassword
            },
            body: JSON.stringify({ count: count })
        });

        if (response.ok) {
            const result = await response.json();
            alert(`Successfully generated ${count} new tokens!`);
            hideGenerateTokensModal();
            // Refresh stats
            await loadTokenStats();
        } else {
            const error = await response.json();
            console.error('Failed to generate tokens:', error);
            alert(`Failed to generate tokens: ${error.error || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Error generating tokens:', error);
        alert('Error generating tokens. Please check your connection and try again.');
    }
}

/**
 * Show no tokens available modal
 */
function showNoTokensModal() {
    document.getElementById('no-tokens-modal').style.display = 'flex';
}

/**
 * Hide no tokens available modal
 */
function hideNoTokensModal() {
    document.getElementById('no-tokens-modal').style.display = 'none';
}

// Global functions for HTML onclick handlers
window.viewPrompt = viewPrompt;
window.editPrompt = editPrompt;
window.testPrompt = testPrompt;
window.duplicatePrompt = duplicatePrompt;
window.activatePrompt = activatePrompt;
window.deleteCustomPrompt = deleteCustomPrompt;
window.showAddPromptModal = showAddPromptModal;
window.hideAddPromptModal = hideAddPromptModal;
window.hideViewPromptModal = hideViewPromptModal;
window.handleAddPrompt = handleAddPrompt;
window.exportConfig = exportConfig;
window.refreshData = refreshData;
window.activateSelectedTheme = activateSelectedTheme;
window.deleteSelectedTheme = deleteSelectedTheme;
window.showSaveCurrentModal = showSaveCurrentModal;
window.closeSaveCurrentModal = closeSaveCurrentModal;
window.handleSaveCurrentTheme = handleSaveCurrentTheme;
window.getNextToken = getNextToken;
window.refreshTokenStats = refreshTokenStats;
window.showGenerateTokensModal = showGenerateTokensModal;
window.hideGenerateTokensModal = hideGenerateTokensModal;
window.handleGenerateTokens = handleGenerateTokens;
window.showNoTokensModal = showNoTokensModal;
window.hideNoTokensModal = hideNoTokensModal;
window.copyTokenToClipboard = copyTokenToClipboard;