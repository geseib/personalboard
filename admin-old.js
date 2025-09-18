/**
 * Admin Interface for Personal Board AI Advisor Configuration
 * Provides management interface for AI prompts and system configuration
 */

// Configuration
const AI_API_BASE_URL = 'https://hvr92xfbo6.execute-api.us-east-1.amazonaws.com/production';

// Global state
let currentPrompts = {};
let currentStats = {
    totalPrompts: 9,
    activePrompts: 4,
    avgTokens: 1575, // Average of active prompts: (1600 + 1300 + 1800 + 1600) / 4
    apiVersion: 'v2.0'
};

// Prompt groupings for exclusive activation
const PROMPT_GROUPINGS = {
    'board_member_guidance': ['board_member_advisor', 'mentor_advisor'],
    'goals_guidance': ['goals_advisor'],
    'board_analysis': ['board_analysis_advisor', 'board_analysis'],
    'form_assistance': ['form_completion'],
    'networking': ['connection_suggestions'],
    'alignment': ['goal_alignment'],
    'skills_guidance': ['superpowers_advisor']
};

// Prompt type definitions with metadata
const PROMPT_TYPES = {
    'form_completion': {
        name: 'Form Completion Assistant',
        description: 'Provides suggestions for completing board member forms',
        category: 'Available But Not Implemented',
        maxTokens: 2000,
        temperature: 0.3,
        typical_tokens: 800,
        status: 'inactive',
        uiLocation: 'None - Backend only'
    },
    'goal_alignment': {
        name: 'Goal-Board Alignment Analysis',
        description: 'Analyzes connections between goals and board members',
        category: 'Available But Not Implemented',
        maxTokens: 2000,
        temperature: 0.3,
        typical_tokens: 1200,
        status: 'inactive',
        uiLocation: 'None - Backend only'
    },
    'connection_suggestions': {
        name: 'Connection & Networking Suggestions',
        description: 'Suggests networking strategies and potential connections',
        category: 'Available But Not Implemented',
        maxTokens: 2000,
        temperature: 0.3,
        typical_tokens: 1000,
        status: 'inactive',
        uiLocation: 'None - Backend only'
    },
    'board_analysis': {
        name: 'General Board Analysis',
        description: 'Basic board composition evaluation (unused - superseded by board_analysis_advisor)',
        category: 'Available But Not Implemented',
        maxTokens: 2000,
        temperature: 0.3,
        typical_tokens: 1500,
        status: 'inactive',
        uiLocation: 'None - Superseded by comprehensive version'
    },
    'mentor_advisor': {
        name: 'Legacy Mentor Advisor',
        description: 'Original mentor-specific guidance (now consolidated into board_member_advisor)',
        category: 'Available But Not Implemented',
        maxTokens: 2000,
        temperature: 0.3,
        typical_tokens: 1400,
        status: 'inactive',
        uiLocation: 'None - Legacy prompt, use board_member_advisor instead'
    },
    'board_member_advisor': {
        name: 'Board Member Relationship Advisor',
        description: 'AI guidance for all board member types (mentors, coaches, sponsors, connectors, peers)',
        category: 'Active AI Features',
        maxTokens: 2000,
        temperature: 0.3,
        typical_tokens: 1600,
        status: 'active',
        uiLocation: 'All board member form modals - "Get AI Guidance" button',
        grouping: 'board_member_guidance',
        isDefault: true,
        canDuplicate: true
    },
    'goals_advisor': {
        name: 'Goals Strategy Advisor',
        description: 'Helps refine and improve career goal setting strategies',
        category: 'Active AI Features',
        maxTokens: 2000,
        temperature: 0.3,
        typical_tokens: 1300,
        status: 'active',
        uiLocation: 'Goals page form modal - "Get AI Guidance" button',
        grouping: 'goals_guidance',
        isDefault: true,
        canDuplicate: true
    },
    'board_analysis_advisor': {
        name: 'Comprehensive Board Analysis',
        description: 'Complete board composition analysis and optimization recommendations',
        category: 'Active AI Features',
        maxTokens: 2000,
        temperature: 0.3,
        typical_tokens: 1800,
        status: 'active',
        uiLocation: 'Board page - Automatic analysis on page load',
        grouping: 'board_analysis',
        isDefault: true,
        canDuplicate: true
    },
    'superpowers_advisor': {
        name: 'Superpowers Skills Advisor',
        description: 'Strategic guidance for identifying and leveraging key skills for career advancement and board relationships',
        category: 'Skills & Development',
        maxTokens: 1800,
        temperature: 0.4,
        typical_tokens: 1600,
        status: 'active',
        uiLocation: 'You page - Skills section "Get AI Guidance" button',
        grouping: 'skills_guidance',
        isDefault: true,
        canDuplicate: true
    }
};

/**
 * Initialize the admin interface
 */
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🔧 Admin interface initializing...');
    setupEventListeners();
    updateStats();

    // Initialize prompt data first, then load categories
    try {
        await initializePromptData();
        loadPromptCategories();
        console.log('✅ Admin interface ready');
    } catch (error) {
        console.error('❌ Failed to initialize admin interface:', error);
        showNotification('Failed to load prompt configurations', 'error');
    }
});

/**
 * Initialize prompt data from the AI guidance system
 */
async function initializePromptData() {
    try {
        // Load current prompt configurations
        for (const [type, metadata] of Object.entries(PROMPT_TYPES)) {
            currentPrompts[type] = {
                ...metadata,
                systemPrompt: await getSystemPromptForType(type),
                userPromptTemplate: await getUserPromptTemplateForType(type),
                lastModified: new Date().toISOString()
                // status comes from metadata now
            };
        }
        console.log('📋 Loaded prompt configurations:', Object.keys(currentPrompts).length);
    } catch (error) {
        console.error('❌ Failed to initialize prompt data:', error);
        showNotification('Failed to load prompt configurations', 'error');
    }
}

/**
 * Get system prompt for a specific type (these are hardcoded in the Lambda function)
 */
async function getSystemPromptForType(type) {
    // These are the actual system prompts from the Lambda function
    const systemPrompts = {
        'form_completion': `You are an expert career coach and advisor helping users complete their Personal Board of Directors forms. You provide thoughtful, actionable suggestions based on best practices for professional relationships and career development.

Key principles:
- Focus on mutual value and authentic relationships
- Suggest specific, actionable content
- Consider the user's career stage and goals
- Emphasize quality over quantity in relationships
- Provide 2-3 concrete suggestions per field
- Keep responses concise and practical`,

        'goal_alignment': `You are a strategic career advisor analyzing connections between career goals and Personal Board of Directors members. You identify opportunities for alignment and suggest how board members can help achieve specific goals.

Focus on:
- Concrete connections between goals and board member capabilities
- Specific ways board members can contribute to goal achievement
- Identifying gaps where new board members might be needed
- Actionable next steps for leveraging existing relationships`,

        'connection_suggestions': `You are a networking expert helping users identify and approach potential Personal Board of Directors members. You provide practical advice on building professional relationships.

Focus on:
- Identifying potential candidates in various networks
- Suggesting authentic approach strategies
- Recommending value propositions for mutual benefit
- Practical next steps for relationship building`,

        'board_analysis': `You are a career strategist analyzing Personal Board of Directors composition. You evaluate balance, identify strengths and gaps, and suggest strategic improvements.

Focus on:
- Overall board composition and balance
- Identifying missing perspectives or expertise
- Suggesting strategic additions or changes
- Optimizing meeting cadences and relationships`,

        'mentor_advisor': `<role>
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
</personality>`,

        'board_member_advisor': `<role>
You are an expert career advisor specializing in board member relationships within professional boards of directors. Your expertise lies in helping professionals build meaningful, strategic relationships that accelerate career growth through mutual value creation.
</role>

<objectives>
- Clarify and focus board member relationship goals and expectations
- Dive deep into specific, actionable strategies for mutual value creation
- Provide pointed questions that reveal blind spots and opportunities
- Offer concrete recommendations for optimal board member engagement
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
[4-6 pointed questions that dig deeper into their board member relationship strategy, reveal blind spots, clarify goals, and uncover opportunities for mutual value creation through their skills and interests. Format each question as a numbered list item or bullet point.]

# Recommendations
[4-6 specific, actionable recommendations for building and optimizing this board member relationship, including concrete next steps they can take within the next 30 days. Always include guidance on reviewing their LinkedIn profile to identify shared connections, common experiences, interests, conversation starters, and ways their skills might be valuable to this board member. Format each recommendation as a numbered list item or bullet point.]

# Suggested Entries
[3-4 short, specific, relevant suggested entries they could add to their form fields. Format as brief bullet points that they can directly copy and paste. Focus on practical, actionable content that matches their specific situation, goals, and opportunities for skills-based mutual value creation.]
</output_format>

Remember: Be direct, specific, and focused on actionable insights that create mutual value through skills leveraging and relationship building.`,

        'goals_advisor': `<role>
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
- Push for specificity in goal statements and success metrics
- Consider both short-term tactical steps and long-term strategic vision
- Evaluate goal interdependencies and potential conflicts
- Focus on creating goals that leverage their personal board of directors effectively
</approach>

<output_format>
Structure your response using these exact headings:

# Questions
[4-6 pointed questions designed to clarify, refine, and strengthen their goal-setting approach. Focus on revealing assumptions, identifying potential gaps, and pushing for greater specificity.]

# Recommendations
[4-6 specific recommendations for improving their goals, including suggestions for better alignment with their board members, more specific success metrics, and strategic considerations they may have missed.]

# Suggested Entries
[3-4 concrete, specific goal statements or improvements they could implement immediately. Format as brief, actionable entries they can directly use or adapt.]
</output_format>

Remember: Challenge them to think bigger while staying grounded in reality. Help them create goals that are both ambitious and achievable.`,

        'board_analysis_advisor': `<role>
You are a senior executive coach and organizational development expert specializing in personal board of directors optimization. Your expertise lies in analyzing relationship portfolios and providing strategic guidance for building high-impact professional support networks.
</role>

<objectives>
- Conduct comprehensive analysis of board composition, balance, and effectiveness
- Identify strategic gaps, redundancies, and optimization opportunities
- Provide actionable recommendations for board enhancement and relationship management
- Suggest specific strategies for maximizing value from existing relationships
- Guide strategic additions and relationship development priorities
- Help identify opportunities to leverage user's skills for mutual value creation with board members
</objectives>

<approach>
- Take a holistic view of the entire relationship portfolio
- Analyze balance across different relationship types and expertise areas
- Consider both current needs and future career trajectory requirements
- Evaluate relationship quality, engagement frequency, and mutual value creation
- Identify potential synergies and collaboration opportunities within the board
- Address potential conflicts, gaps, or underutilized relationships
- Analyze how the user's skills can be leveraged to strengthen board relationships and achieve career goals
- Look for opportunities where skills create mutual value and open doors to new connections
</approach>

<output_format>
Structure your response using these exact headings:

# Questions
[4-6 strategic questions designed to reveal deeper insights about their board effectiveness, relationship quality, strategic alignment with career goals, and opportunities to leverage their skills for mutual benefit.]

# Recommendations
[4-6 comprehensive recommendations covering board optimization, relationship enhancement, strategic additions, skills leveraging opportunities, and specific action steps for the next 90 days.]

# Suggested Entries
[3-4 specific, actionable items they could implement immediately to improve their board effectiveness, including relationship management strategies, board member additions, or ways to apply their skills for mutual value creation.]
</output_format>

Remember: Think like a senior executive coach focused on strategic relationship portfolio optimization, skills leveraging, and long-term career success through mutual value creation.`,

        'superpowers_advisor': `<role>
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

Remember: Focus on helping them identify the few key skills that can become their career "superpowers" - the ones that differentiate them, advance their goals, and create value for others.`
    };

    return systemPrompts[type] || 'System prompt not configured';
}

/**
 * Get user prompt template for a specific type
 */
async function getUserPromptTemplateForType(type) {
    const userPromptTemplates = {
        'form_completion': `Help me complete a {formType} form for my Personal Board of Directors.

My goals are:
{goals}

Current form fields:
{currentFields}

My existing board includes:
{existingBoard}

Please suggest specific content for the empty fields that would create value for both me and this {formType}. Focus on concrete, actionable suggestions.`,

        'goal_alignment': `Analyze the alignment between my goals and current board members:

My goals:
{goals}

My current board:
{boardMembers}

Identify specific connections between my goals and board members. Suggest how each member could help with specific goals and highlight any gaps where I need additional board members.`,

        'connection_suggestions': `Help me find and approach potential {targetRole} for my Personal Board of Directors.

My goals: {goals}

My current network includes: {currentNetwork}

My existing board has: {existingBoard}

Suggest specific types of people I should look for, where to find them, and how to approach them authentically. Include what value I could offer in return.`,

        'board_analysis': `Analyze my Personal Board of Directors composition:

My goals:
{goals}

My current board:
{boardData}

Evaluate the balance and effectiveness of my board. Identify strengths, gaps, and strategic recommendations for improvement.`,

        'mentor_advisor': `I'm working on building a stronger mentorship relationship and need your expert guidance.

<current_mentor_info>
{currentFormData}
</current_mentor_info>

<my_career_goals>
{goals}
</my_career_goals>

<mentorship_context>
I understand that mentors are: {learnContent}
</mentorship_context>

<existing_mentors>
{existingMentors}
</existing_mentors>

<request>
Please analyze this mentorship situation and provide specific guidance. I want to make this relationship as valuable as possible for both of us, but I need help clarifying my approach and identifying areas I might be overlooking.

Focus on actionable insights that will help me be more strategic and thoughtful in this mentorship relationship.
</request>`,

        'board_member_advisor': `I'm working on building a stronger {memberType} relationship and need your expert guidance.

<current_{memberType}_info>
{currentFormData}
</current_{memberType}_info>

<{memberType}_context>
{learnContent}
</{memberType}_context>

<my_career_goals>
{goals}
</my_career_goals>

<existing_{memberType}>
{existingMembers}
</existing_{memberType}>

Please provide pointed questions and specific recommendations to help me build the most effective {memberType} relationship possible.`,

        'goals_advisor': `I need expert guidance on refining my career goals to make them more strategic and achievable.

<current_goal_info>
{currentFormData}
</current_goal_info>

<all_my_goals>
{allGoals}
</all_my_goals>

<my_board_context>
{boardData}
</my_board_context>

Please help me create more strategic, specific, and achievable goals that work well with my professional support network.`,

        'board_analysis_advisor': `I need a comprehensive analysis of my Personal Board of Directors and strategic recommendations for optimization.

<complete_board_data>
{boardData}
</complete_board_data>

<my_skills_and_superpowers>
{skillsData}
</my_skills_and_superpowers>

<my_career_goals>
{goals}
</my_career_goals>

Please provide a thorough analysis of my board composition, relationship quality, and strategic recommendations for building a more effective professional support network. Include opportunities for how I can leverage my skills to create mutual value with board members and strengthen these relationships.`,

        'superpowers_advisor': `I need expert guidance on identifying and leveraging my key skills ("superpowers") for career advancement and board relationship building.

<current_skill_being_worked_on>
Skill Category: {skillCategory}
Current Description: {currentDescription}
Current Notes/Examples: {currentNotes}
</current_skill_being_worked_on>

<all_my_skills>
{allSkills}
</all_my_skills>

<my_career_goals>
{goals}
</my_career_goals>

<my_board_context>
{boardData}
</my_board_context>

Please help me identify the most strategically valuable skills to focus on, how to leverage them for my career goals, and ways to use these skills to create mutual value with my board members and strengthen those relationships.`
    };

    return userPromptTemplates[type] || 'User prompt template not configured';
}

/**
 * Update statistics display
 */
function updateStats() {
    document.getElementById('total-prompts').textContent = currentStats.totalPrompts;
    document.getElementById('active-prompts').textContent = currentStats.activePrompts;
    document.getElementById('avg-tokens').textContent = currentStats.avgTokens;
}

/**
 * Load and display prompt categories
 */
function loadPromptCategories() {
    const container = document.getElementById('prompt-categories');
    if (!container) return;

    // Group prompts by category
    const categories = {};
    Object.entries(currentPrompts).forEach(([type, prompt]) => {
        const category = prompt.category || 'Uncategorized';
        if (!categories[category]) categories[category] = [];
        categories[category].push({ type, ...prompt });
    });

    // Clear existing content
    container.innerHTML = '';

    // Create category sections
    Object.entries(categories).forEach(([categoryName, prompts]) => {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'prompt-category';

        categoryDiv.innerHTML = `
            <div class="category-header">
                <h3 class="category-title">${categoryName}</h3>
                <span class="category-count">${prompts.length} prompts</span>
            </div>
            <div class="category-description">
                Advanced AI prompts for ${categoryName.toLowerCase()} functionality
            </div>
            <div class="prompts-grid">
                ${prompts.map(prompt => createPromptCard(prompt)).join('')}
            </div>
        `;

        container.appendChild(categoryDiv);

        // Add event listeners for buttons in this category
        const promptCards = categoryDiv.querySelectorAll('.prompt-card');
        promptCards.forEach(card => {
            const type = card.dataset.type;

            const viewBtn = card.querySelector('.view-btn');
            const editBtn = card.querySelector('.edit-btn');
            const testBtn = card.querySelector('.test-btn');
            const duplicateBtn = card.querySelector('.duplicate-btn');
            const activateBtn = card.querySelector('.activate-btn');
            const deleteBtn = card.querySelector('.delete-btn');

            if (viewBtn) viewBtn.addEventListener('click', () => viewPrompt(type));
            if (editBtn) editBtn.addEventListener('click', () => editPrompt(type));
            if (testBtn) testBtn.addEventListener('click', () => testPrompt(type));
            if (duplicateBtn) duplicateBtn.addEventListener('click', () => duplicatePrompt(type));
            if (activateBtn) activateBtn.addEventListener('click', () => activatePrompt(type));
            if (deleteBtn) deleteBtn.addEventListener('click', () => deleteCustomPrompt(type));
        });
    });
}

/**
 * Create a prompt card HTML
 */
function createPromptCard(prompt) {
    const statusClass = prompt.status === 'active' ? 'active' : 'inactive';
    const statusIcon = prompt.status === 'active' ? 'Active' : 'Inactive';

    // Determine grouping for display
    const grouping = findPromptGrouping(prompt.type);
    const groupingDisplay = grouping ? grouping.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '';

    // Create action buttons based on status and type
    let actionButtons = '';

    if (prompt.status === 'active') {
        // Active prompts get a Duplicate button
        actionButtons = `<button class="prompt-btn duplicate-btn" data-type="${prompt.type}">Duplicate</button>`;
    } else {
        // Inactive prompts get an Activate button
        actionButtons = `<button class="prompt-btn activate-btn" data-type="${prompt.type}">Activate</button>`;
    }

    // Add delete button for custom prompts
    if (prompt.isCustom) {
        actionButtons += `<button class="prompt-btn delete-btn" data-type="${prompt.type}">Delete</button>`;
    }

    return `
        <div class="prompt-card" data-type="${prompt.type}">
            <div class="prompt-header">
                <div class="prompt-title">
                    ${prompt.name}
                    ${prompt.status === 'active' && !prompt.isCustom ? '<span class="default-badge">Default</span>' : ''}
                    ${prompt.status === 'active' && prompt.isCustom ? '<span class="active-badge">Active</span>' : ''}
                    ${prompt.isCustom && prompt.status !== 'active' ? '<span class="custom-badge">Custom</span>' : ''}
                </div>
                <div class="prompt-status ${statusClass}">
                    <span class="status-text">${statusIcon}</span>
                </div>
            </div>
            <div class="prompt-description">${prompt.description || prompt.category}</div>
            <div class="prompt-meta">
                <span class="prompt-tokens">~${prompt.typical_tokens} tokens</span>
                <span class="prompt-temp">temp: ${prompt.temperature}</span>
                ${groupingDisplay ? `<span class="prompt-group">Group: ${groupingDisplay}</span>` : ''}
            </div>
            <div class="prompt-actions">
                <button class="prompt-btn view-btn" data-type="${prompt.type}">
                    View Details
                </button>
                ${actionButtons}
                <button class="prompt-btn test-btn" data-type="${prompt.type}">
                    Test
                </button>
            </div>
        </div>
    `;
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Search functionality
    const searchInput = document.getElementById('prompt-search');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }

    // Modal close handlers
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-close')) {
            hideAllModals();
        }
        if (e.target.classList.contains('modal') && !e.target.classList.contains('modal-content')) {
            hideAllModals();
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideAllModals();
        }
    });
}

/**
 * Handle search functionality
 */
function handleSearch(event) {
    const searchTerm = event.target.value.toLowerCase();
    const promptCards = document.querySelectorAll('.prompt-card');

    promptCards.forEach(card => {
        const title = card.querySelector('.prompt-title').textContent.toLowerCase();
        const description = card.querySelector('.prompt-description').textContent.toLowerCase();
        const isVisible = title.includes(searchTerm) || description.includes(searchTerm);

        card.style.display = isVisible ? 'block' : 'none';
    });
}

/**
 * View prompt details
 */
function viewPrompt(type) {
    console.log('viewPrompt called with type:', type);
    const prompt = currentPrompts[type];
    if (!prompt) {
        console.error('Prompt not found for type:', type);
        return;
    }
    console.log('Found prompt:', prompt.name);

    const modal = document.getElementById('view-prompt-modal');
    if (!modal) {
        console.error('Modal element not found');
        return;
    }
    const titleEl = document.getElementById('view-prompt-title');
    const systemPromptEl = document.getElementById('view-system-prompt');
    const userPromptEl = document.getElementById('view-user-prompt');
    const configEl = document.getElementById('view-config');

    // Set content
    titleEl.textContent = `${prompt.name} - Configuration Details`;

    // System prompt
    systemPromptEl.innerHTML = `
        <pre class="prompt-text">${escapeHtml(prompt.systemPrompt)}</pre>
        <div class="prompt-stats">
            <span>Estimated tokens: ${estimateTokens(prompt.systemPrompt)}</span>
            <span>Characters: ${prompt.systemPrompt.length}</span>
        </div>
    `;

    // User prompt template
    const userPromptContainer = document.getElementById('view-user-prompt');
    userPromptContainer.innerHTML = `
        <pre class="prompt-text">${escapeHtml(prompt.userPromptTemplate)}</pre>
        <div class="prompt-stats">
            <span>Template variables: ${(prompt.userPromptTemplate.match(/{[^}]+}/g) || []).length}</span>
            <span>Characters: ${prompt.userPromptTemplate.length}</span>
        </div>
    `;

    // Configuration details
    const configContainer = document.getElementById('view-config');
    configContainer.innerHTML = `
        <div class="config-grid">
            <div class="config-item">
                <span class="config-label">Type:</span>
                <span class="config-value">${type}</span>
            </div>
            <div class="config-item">
                <span class="config-label">Category:</span>
                <span class="config-value">${prompt.category}</span>
            </div>
            <div class="config-item">
                <span class="config-label">Max Tokens:</span>
                <span class="config-value">${prompt.maxTokens}</span>
            </div>
            <div class="config-item">
                <span class="config-label">Temperature:</span>
                <span class="config-value">${prompt.temperature}</span>
            </div>
            <div class="config-item">
                <span class="config-label">Typical Tokens:</span>
                <span class="config-value">${prompt.typical_tokens}</span>
            </div>
            <div class="config-item">
                <span class="config-label">Status:</span>
                <span class="config-value ${prompt.status}">${prompt.status}</span>
            </div>
            <div class="config-item">
                <span class="config-label">UI Location:</span>
                <span class="config-value">${prompt.uiLocation || 'Not specified'}</span>
            </div>
            <div class="config-item">
                <span class="config-label">Last Modified:</span>
                <span class="config-value">${new Date(prompt.lastModified).toLocaleDateString()}</span>
            </div>
        </div>
    `;

    // Show modal
    console.log('Showing modal');
    modal.style.display = 'block';
}

/**
 * Edit prompt
 */
function editPrompt(type) {
    showNotification('Edit functionality would modify the Lambda function source code. This requires deployment pipeline integration.', 'info');
}

/**
 * Test prompt with sample data
 */
async function testPrompt(type) {
    try {
        showNotification('Testing prompt...', 'info');

        // Sample test data for each prompt type
        const testData = getTestDataForType(type);

        // Call the AI API
        const response = await fetch(`${AI_API_BASE_URL}/ai-guidance`, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain'
            },
            body: JSON.stringify({
                type: type,
                data: testData.data,
                context: testData.context || {}
            })
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }

        const result = await response.json();

        // Show results
        showTestResults(type, testData, result);
        showNotification('Test completed successfully', 'success');

    } catch (error) {
        console.error('Test failed:', error);
        showNotification(`Test failed: ${error.message}`, 'error');
    }
}

/**
 * Get test data for a specific prompt type
 */
function getTestDataForType(type) {
    const testDataSets = {
        'form_completion': {
            data: {
                formType: 'mentors',
                currentFields: {
                    name: 'Dr. Sarah Chen',
                    role: 'VP of Engineering',
                    whatToLearn: ''
                },
                goals: [
                    { timeframe: '1 Year', description: 'Get promoted to Senior Engineering Manager' },
                    { timeframe: '3 Years', description: 'Transition to VP of Engineering role' }
                ],
                existingBoard: {
                    coaches: [{ name: 'Mike Rodriguez', role: 'Tech Lead' }]
                }
            }
        },
        'mentor_advisor': {
            data: {
                currentFormData: {
                    name: 'Dr. Sarah Chen',
                    role: 'VP of Engineering at TechCorp',
                    cadence: 'Quarterly',
                    whatToLearn: 'Executive leadership and strategic thinking'
                },
                goals: [
                    { timeframe: '1 Year', description: 'Get promoted to Senior Engineering Manager' }
                ],
                learnContent: 'Senior leaders who provide wisdom, guidance, and strategic advice',
                existingMentors: []
            }
        },
        'board_member_advisor': {
            data: {
                memberType: 'coaches',
                currentFormData: {
                    name: 'Alex Johnson',
                    role: 'Senior Software Engineer',
                    whatToLearn: 'Advanced system design and architecture'
                },
                goals: [
                    { timeframe: '6 Months', description: 'Lead a major system redesign project' }
                ],
                learnContent: 'Skilled practitioners who help develop specific competencies',
                existingMembers: []
            }
        }
    };

    return testDataSets[type] || { data: { test: true } };
}

/**
 * Show test results
 */
function showTestResults(type, testData, result) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content large-modal">
            <div class="modal-header">
                <h2>Test Results: ${PROMPT_TYPES[type]?.name || type}</h2>
                <button class="modal-close">×</button>
            </div>
            <div class="modal-body">
                <div class="test-results">
                    <div class="test-section">
                        <h3>Input Data</h3>
                        <pre class="test-data">${JSON.stringify(testData, null, 2)}</pre>
                    </div>
                    <div class="test-section">
                        <h3>AI Response</h3>
                        <div class="ai-response">
                            <div class="response-meta">
                                <span>Model: ${result.model || 'Unknown'}</span>
                                <span>Type: ${result.type}</span>
                                <span>Tokens: ~${estimateTokens(result.guidance)}</span>
                            </div>
                            <div class="response-content">
                                ${formatAIResponse(result.guidance)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.style.display = 'block';

    // Auto-remove after close
    modal.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-close') || e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}

/**
 * Format AI response for display
 */
function formatAIResponse(text) {
    // Convert markdown-style headers and formatting
    return text
        .replace(/^# (.+)$/gm, '<h4>$1</h4>')
        .replace(/^## (.+)$/gm, '<h5>$1</h5>')
        .replace(/^\* (.+)$/gm, '<li>$1</li>')
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/^(.+)$/gm, '<p>$1</p>')
        .replace(/<p><h/g, '<h')
        .replace(/<\/h([4-6])><\/p>/g, '</h$1>')
        .replace(/<p><li>/g, '<ul><li>')
        .replace(/<\/li><\/p>/g, '</li></ul>');
}

/**
 * Show add prompt modal
 */
function showAddPromptModal() {
    showNotification('Adding new prompts requires updating the Lambda function source code and redeployment.', 'info');
}

/**
 * Hide view prompt modal
 */
function hideViewPromptModal() {
    document.getElementById('view-prompt-modal').style.display = 'none';
}

/**
 * Hide all modals
 */
function hideAllModals() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.style.display = 'none';
    });
}

/**
 * Show notification
 */
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existing = document.querySelectorAll('.notification');
    existing.forEach(n => n.remove());

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span class="notification-message">${message}</span>
        <button class="notification-close" onclick="this.parentElement.remove()">×</button>
    `;

    document.body.appendChild(notification);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

/**
 * Estimate token count for text
 */
function estimateTokens(text) {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
}

/**
 * Escape HTML for safe display
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Export configuration
 */
function exportConfig() {
    const config = {
        prompts: currentPrompts,
        stats: currentStats,
        exported: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `personal-board-ai-config-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showNotification('Configuration exported successfully', 'success');
}

/**
 * Duplicate an active prompt to create a custom version
 */
function duplicatePrompt(type) {
    const prompt = currentPrompts[type];
    if (!prompt) {
        showNotification('Prompt not found', 'error');
        return;
    }

    showCustomPromptModal(prompt, type, 'duplicate');
}

/**
 * Activate an inactive prompt (deactivating others in same grouping)
 */
function activatePrompt(type) {
    const prompt = currentPrompts[type];
    if (!prompt) {
        showNotification('Prompt not found', 'error');
        return;
    }

    // Find the grouping for this prompt
    const grouping = findPromptGrouping(type);
    if (grouping) {
        // Deactivate all other prompts in this grouping
        const groupPrompts = PROMPT_GROUPINGS[grouping];
        groupPrompts.forEach(promptType => {
            if (promptType !== type && currentPrompts[promptType]) {
                currentPrompts[promptType].status = 'inactive';
            }
        });
    }

    // Activate this prompt
    currentPrompts[type].status = 'active';

    showNotification(`Activated ${prompt.name}. Other prompts in the same grouping have been deactivated.`, 'success');

    // Refresh the display
    loadPrompts();
}

/**
 * Find which grouping a prompt type belongs to
 */
function findPromptGrouping(type) {
    for (const [grouping, prompts] of Object.entries(PROMPT_GROUPINGS)) {
        if (prompts.includes(type)) {
            return grouping;
        }
    }
    return null;
}

/**
 * Show modal for creating/editing custom prompts
 */
function showCustomPromptModal(basePrompt = null, baseType = null, mode = 'create') {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'custom-prompt-modal';
    modal.style.display = 'block';

    const isEdit = mode === 'duplicate';
    const title = isEdit ? `Duplicate: ${basePrompt.name}` : 'Create Custom Prompt';

    modal.innerHTML = `
        <div class="modal-content admin-modal-content large-modal">
            <div class="modal-header">
                <h2>${title}</h2>
                <button class="modal-close" onclick="hideCustomPromptModal()">×</button>
            </div>
            <form id="custom-prompt-form">
                <div class="form-group">
                    <label for="custom-prompt-name">Prompt Name</label>
                    <input type="text" id="custom-prompt-name" required
                           value="${isEdit ? basePrompt.name + ' (Custom)' : ''}"
                           placeholder="e.g., Enhanced Board Member Advisor">
                </div>

                <div class="form-group">
                    <label for="custom-prompt-type">Prompt Type</label>
                    <input type="text" id="custom-prompt-type" required
                           value="${isEdit ? baseType + '_custom_' + Date.now() : ''}"
                           placeholder="unique_prompt_type_identifier">
                    <small>This must be unique and will be used as the prompt identifier</small>
                </div>

                <div class="form-group">
                    <label for="custom-prompt-grouping">Grouping</label>
                    <select id="custom-prompt-grouping" required>
                        <option value="">Select grouping...</option>
                        ${Object.keys(PROMPT_GROUPINGS).map(grouping =>
                            `<option value="${grouping}" ${isEdit && findPromptGrouping(baseType) === grouping ? 'selected' : ''}>
                                ${grouping.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </option>`
                        ).join('')}
                    </select>
                </div>

                <div class="form-group">
                    <label for="custom-prompt-category">Category</label>
                    <input type="text" id="custom-prompt-category" required
                           value="${isEdit ? basePrompt.category : ''}"
                           placeholder="e.g., Relationship Guidance">
                </div>

                <div class="form-group">
                    <label for="custom-system-prompt">System Prompt</label>
                    <textarea id="custom-system-prompt" rows="8" required
                              placeholder="You are a strategic career advisor...">${isEdit ? basePrompt.systemPrompt : ''}</textarea>
                </div>

                <div class="form-group">
                    <label for="custom-user-prompt-template">User Prompt Template</label>
                    <textarea id="custom-user-prompt-template" rows="6" required
                              placeholder="Template with variables like {currentFields}, {goals}, etc.">${isEdit ? basePrompt.userPromptTemplate : ''}</textarea>
                </div>

                <div class="form-group">
                    <label for="custom-max-tokens">Max Tokens</label>
                    <input type="number" id="custom-max-tokens"
                           value="${isEdit ? basePrompt.maxTokens : 2000}" min="100" max="4000">
                </div>

                <div class="form-group">
                    <label for="custom-temperature">Temperature</label>
                    <input type="number" id="custom-temperature" step="0.1" min="0" max="2"
                           value="${isEdit ? basePrompt.temperature : 0.7}">
                </div>

                <div class="modal-actions">
                    <button type="button" class="admin-btn admin-btn-secondary" onclick="hideCustomPromptModal()">
                        Cancel
                    </button>
                    <button type="submit" class="admin-btn admin-btn-primary">
                        ${isEdit ? 'Create Custom Version' : 'Create Prompt'}
                    </button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);

    // Handle form submission
    document.getElementById('custom-prompt-form').addEventListener('submit', (e) => {
        e.preventDefault();
        handleCustomPromptSubmission(mode, baseType);
    });

    // Close modal on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            hideCustomPromptModal();
        }
    });
}

/**
 * Handle custom prompt form submission
 */
function handleCustomPromptSubmission(mode, baseType) {
    const form = document.getElementById('custom-prompt-form');
    const formData = new FormData(form);

    const customType = document.getElementById('custom-prompt-type').value;
    const grouping = document.getElementById('custom-prompt-grouping').value;

    // Check if this type already exists
    if (currentPrompts[customType]) {
        showNotification('A prompt with this type already exists. Please use a different type.', 'error');
        return;
    }

    // Create the new prompt
    const newPrompt = {
        name: document.getElementById('custom-prompt-name').value,
        category: document.getElementById('custom-prompt-category').value,
        systemPrompt: document.getElementById('custom-system-prompt').value,
        userPromptTemplate: document.getElementById('custom-user-prompt-template').value,
        maxTokens: parseInt(document.getElementById('custom-max-tokens').value),
        temperature: parseFloat(document.getElementById('custom-temperature').value),
        status: 'inactive', // Start as inactive
        typical_tokens: Math.ceil(document.getElementById('custom-system-prompt').value.length / 4),
        isCustom: true,
        originalType: mode === 'duplicate' ? baseType : null,
        grouping: grouping
    };

    // Add to current prompts
    currentPrompts[customType] = newPrompt;

    // Add to the grouping
    if (!PROMPT_GROUPINGS[grouping]) {
        PROMPT_GROUPINGS[grouping] = [];
    }
    PROMPT_GROUPINGS[grouping].push(customType);

    hideCustomPromptModal();
    showNotification(`Custom prompt "${newPrompt.name}" created successfully!`, 'success');

    // Refresh the display
    loadPrompts();
}

/**
 * Hide custom prompt modal
 */
function hideCustomPromptModal() {
    const modal = document.getElementById('custom-prompt-modal');
    if (modal) {
        document.body.removeChild(modal);
    }
}

/**
 * Delete a custom prompt
 */
function deleteCustomPrompt(type) {
    const prompt = currentPrompts[type];
    if (!prompt || !prompt.isCustom) {
        showNotification('Can only delete custom prompts', 'error');
        return;
    }

    if (confirm(`Are you sure you want to delete "${prompt.name}"?`)) {
        // Remove from grouping
        const grouping = findPromptGrouping(type);
        if (grouping && PROMPT_GROUPINGS[grouping]) {
            const index = PROMPT_GROUPINGS[grouping].indexOf(type);
            if (index > -1) {
                PROMPT_GROUPINGS[grouping].splice(index, 1);
            }
        }

        // Remove from current prompts
        delete currentPrompts[type];

        showNotification(`Custom prompt "${prompt.name}" deleted successfully`, 'success');
        loadPrompts();
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
window.hideViewPromptModal = hideViewPromptModal;
window.hideCustomPromptModal = hideCustomPromptModal;
window.exportConfig = exportConfig;