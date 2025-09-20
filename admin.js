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

// Cache management
const CACHE_KEY = 'admin_prompt_data';
const CACHE_TIMESTAMP_KEY = 'admin_prompt_data_timestamp';

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async function() {
    try {
        console.log('🚀 Initializing Admin Interface...');
        await loadPromptData();
        loadPromptCategories();
        setupSearch();
        console.log('✅ Admin interface ready');
    } catch (error) {
        console.error('❌ Failed to initialize admin interface:', error);
        showNotification('Failed to load prompt configurations', 'error');
    }
});

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

        const response = await fetch(`${AI_API_BASE_URL}/admin/prompts`, {
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
        loadPromptCategories();
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
        const activeIndicator = activePromptId ? `<span class="active-indicator">Active: ${activePromptId}</span>` : '<span class="inactive-indicator">No active prompt</span>';

        // Only show deactivate button for member types that can fallback to board_member_advisor
        const memberTypes = ['mentors', 'coaches', 'sponsors', 'connectors', 'peers'];
        const showDeactivate = memberTypes.includes(categoryKey) && activePromptId;
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
        const response = await fetch(url, {
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
 */
async function deactivateCategory(categoryKey) {
    console.log('🎯 CATEGORY DEACTIVATE: Starting deactivation for category:', categoryKey);

    try {
        const url = `${AI_API_BASE_URL}/admin/categories/${categoryKey}/deactivate`;
        console.log('🎯 CATEGORY DEACTIVATE: Request URL:', url);

        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'deactivate',
                category: categoryKey
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
        const response = await fetch(`${AI_API_BASE_URL}/admin/prompts`, {
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
        const response = await fetch(url, {
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