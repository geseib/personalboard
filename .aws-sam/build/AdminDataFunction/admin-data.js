const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, GetCommand, PutCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient();
const dynamodb = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.PROMPT_MANAGEMENT_TABLE || process.env.DYNAMODB_TABLE;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'adminpass123';

/**
 * Validate admin password from request headers
 */
function validateAdminPassword(event) {
    const providedPassword = event.headers['X-Admin-Password'] || event.headers['x-admin-password'];

    if (!providedPassword) {
        console.log('🔒 Password validation failed: No password provided');
        return false;
    }

    if (providedPassword !== ADMIN_PASSWORD) {
        console.log('🔒 Password validation failed: Incorrect password');
        return false;
    }

    console.log('🔓 Password validation successful');
    return true;
}

/**
 * Return unauthorized response
 */
function unauthorizedResponse() {
    return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Unauthorized: Invalid admin password' })
    };
}

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Admin-Password',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

// Advisor category definitions
const ADVISOR_CATEGORIES = {
    'skills': {
        name: 'Skills & Superpowers',
        description: 'Advisors for identifying and developing your core skills and strengths',
        defaultPrompt: 'superpowers_advisor'
    },
    'goals': {
        name: 'Goals & Vision',
        description: 'Advisors for setting and achieving career goals',
        defaultPrompt: 'goals_advisor'
    },
    'mentors': {
        name: 'Mentors',
        description: 'Relationship advisors for mentor connections',
        defaultPrompt: 'mentor_advisor'
    },
    'coaches': {
        name: 'Coaches',
        description: 'Relationship advisors for coaching connections',
        defaultPrompt: 'board_member_advisor'
    },
    'sponsors': {
        name: 'Sponsors',
        description: 'Relationship advisors for sponsor connections',
        defaultPrompt: 'board_member_advisor'
    },
    'connectors': {
        name: 'Connectors',
        description: 'Relationship advisors for connector relationships',
        defaultPrompt: 'board_member_advisor'
    },
    'peers': {
        name: 'Peers',
        description: 'Relationship advisors for peer connections',
        defaultPrompt: 'board_member_advisor'
    },
    'board_members': {
        name: 'Board Members (Fallback)',
        description: 'General board member relationship advisor (fallback for member types)',
        defaultPrompt: 'board_member_advisor'
    },
    'overall': {
        name: 'Overall Board Advisor',
        description: 'Holistic advisors for comprehensive board guidance',
        defaultPrompt: 'board_analysis_advisor'
    },
    'writing': {
        name: 'Writing Assistant',
        description: 'Grammar, spelling, and writing improvement assistant',
        defaultPrompt: 'writing_advisor'
    }
};

// Initial prompt configuration data with new structure
const INITIAL_PROMPTS = [
    // Skills & Superpowers
    {
        promptId: 'superpowers_advisor',
        name: 'Skills & Superpowers Development Advisor',
        category: 'skills',
        status: 'active',
        isCustom: false,
        tokenCount: 1500,
        systemPrompt: 'You are an expert career advisor specializing in identifying, developing, and leveraging professional skills and superpowers. You help professionals discover their unique strengths, develop marketable skills, and create compelling skill narratives. You excel at providing specific, actionable skill development recommendations and crafting engaging skill descriptions.',
        userPromptTemplate: `# Skills & Superpowers Development Consultation

## Current Skill Context
**Current Skills & Superpowers:** {skills}

## Complete Career Profile
**Career Goals:** {goals}

**Current Board of Directors:** {boardMembers}

**Current Situation:** {my_current_situation}

**Skill Being Developed:** {currentFields}

## Guidance Request
Please provide structured guidance organized into the following sections:

# Questions
Provide 3-5 reflective questions to help me better understand and articulate this skill, such as:
- Questions about specific examples of using this skill
- Questions about the impact and value this skill creates
- Questions about how this skill differentiates me from others
- Questions about growth opportunities with this skill

# Recommendations
Provide 3-5 actionable recommendations for developing and leveraging this skill:
- Specific ways to strengthen and demonstrate this skill
- Opportunities to apply this skill in current or future roles
- Ways to gain recognition for this skill
- Methods to measure progress in this skill area

# Suggested Entries
Provide 3-5 compelling, specific skill descriptions or superpower statements that I could add to my profile:
- Clear, action-oriented skill descriptions
- Quantified achievements that demonstrate this skill
- Market-relevant skill positioning statements
- Unique value propositions based on this skill

Focus on making each suggestion specific, actionable, and directly applicable to my career goals and current situation.`,
        variables: ['skills', 'goals', 'boardMembers', 'my_current_situation', 'currentFields']
    },
    // Goals & Vision
    {
        promptId: 'goals_advisor',
        name: 'Strategic Goals & Career Vision Advisor',
        category: 'goals',
        status: 'active',
        isCustom: false,
        tokenCount: 1500,
        systemPrompt: 'You are a strategic career advisor specializing in goal setting, career visioning, and strategic planning. You help professionals create clear, actionable career goals that align with their values, strengths, and market opportunities. You excel at breaking down complex career aspirations into manageable steps and connecting goals to specific board member relationships and development strategies.',
        userPromptTemplate: `# Strategic Career Goals Consultation

## Current Goal Context
**Goal Being Addressed:** {currentFields}

## Complete Career Profile
**All Current Goals:** {goals}

**Current Board of Directors:** {boardMembers}

**My Complete Situation:** {my_current_situation}

## Analysis Request
Please provide a comprehensive strategic analysis focusing on:

1. **Goal Clarity & Alignment**: Assess how well this specific goal aligns with my overall career trajectory and other stated goals

2. **Strategic Pathway**: Outline 3-5 specific, actionable steps to achieve this goal with realistic timelines

3. **Board Leveraging Strategy**: Identify specific board members who could help with this goal and how to engage them

4. **Success Metrics**: Define clear, measurable indicators of progress toward this goal

5. **Risk Assessment & Mitigation**: Identify potential obstacles and strategies to overcome them

6. **Resource Requirements**: Specify what skills, knowledge, or resources I need to develop or acquire

## Output Format
Please structure your response with clear headings and actionable recommendations. Focus on strategic depth while keeping advice practical and immediately implementable.`,
        variables: ['currentFields', 'goals', 'boardMembers', 'my_current_situation']
    },
    // Board Member Categories
    {
        promptId: 'mentor_advisor',
        name: 'Mentor Relationship Advisor',
        category: 'mentors',
        status: 'active',
        isCustom: false,
        tokenCount: 1320,
        systemPrompt: 'You are an expert advisor helping professionals build and maintain effective mentoring relationships...',
        userPromptTemplate: 'Help me with this mentoring relationship:\n\nMentor: {memberName}\nRole/Background: {memberRole}\nRelationship Stage: {currentRelationship}\n\nMy Current Situation:\n{currentFields}\n\nMy Career Goals:\n{goals}\n\nPlease provide guidance...',
        variables: ['memberName', 'memberRole', 'currentRelationship', 'currentFields', 'goals']
    },
    {
        promptId: 'board_member_advisor',
        name: 'Coach Relationship Advisor',
        category: 'coaches',
        status: 'active',
        isCustom: false,
        tokenCount: 1290,
        systemPrompt: 'You are an expert advisor helping professionals work effectively with professional coaches...',
        userPromptTemplate: 'Help me optimize my coaching relationship:\n\nCoach: {memberName}\nSpecialty: {memberRole}\nCurrent Focus: {currentRelationship}\n\nMy Profile:\n{currentFields}\n\nMy Goals:\n{goals}\n\nPlease advise...',
        variables: ['memberName', 'memberRole', 'currentRelationship', 'currentFields', 'goals']
    },
    {
        promptId: 'board_member_advisor',
        name: 'Sponsor Relationship Advisor',
        category: 'sponsors',
        status: 'active',
        isCustom: false,
        tokenCount: 1380,
        systemPrompt: 'You are an expert advisor helping professionals build and leverage sponsorship relationships...',
        userPromptTemplate: 'Help me with this sponsorship relationship:\n\nSponsor: {memberName}\nPosition: {memberRole}\nCurrent Status: {currentRelationship}\n\nMy Profile:\n{currentFields}\n\nMy Aspirations:\n{goals}\n\nPlease provide strategic advice...',
        variables: ['memberName', 'memberRole', 'currentRelationship', 'currentFields', 'goals']
    },
    {
        promptId: 'board_member_advisor',
        name: 'Connector Relationship Advisor',
        category: 'connectors',
        status: 'active',
        isCustom: false,
        tokenCount: 1250,
        systemPrompt: 'You are an expert advisor helping professionals build relationships with well-connected individuals...',
        userPromptTemplate: 'Help me build this connector relationship:\n\nConnector: {memberName}\nNetwork/Industry: {memberRole}\nConnection Level: {currentRelationship}\n\nMy Background:\n{currentFields}\n\nMy Goals:\n{goals}\n\nPlease advise...',
        variables: ['memberName', 'memberRole', 'currentRelationship', 'currentFields', 'goals']
    },
    {
        promptId: 'board_member_advisor',
        name: 'Peer Relationship Advisor',
        category: 'peers',
        status: 'active',
        isCustom: false,
        tokenCount: 1200,
        systemPrompt: 'You are an expert advisor helping professionals build valuable peer-to-peer relationships...',
        userPromptTemplate: 'Help me develop this peer relationship:\n\nPeer: {memberName}\nRole/Background: {memberRole}\nCurrent Dynamic: {currentRelationship}\n\nMy Profile:\n{currentFields}\n\nMy Objectives:\n{goals}\n\nPlease provide guidance...',
        variables: ['memberName', 'memberRole', 'currentRelationship', 'currentFields', 'goals']
    },
    // Board Members (Fallback)
    {
        promptId: 'board_member_advisor',
        name: 'Board Member Relationship Advisor',
        category: 'board_members',
        status: 'active',
        isCustom: false,
        tokenCount: 1280,
        systemPrompt: `<role>
You are an expert career advisor specializing in board member relationships within professional boards of directors. Your expertise lies in helping professionals build meaningful, strategic relationships with senior leaders, mentors, coaches, sponsors, connectors, and peers that accelerate career growth through mutual value creation.
</role>

<objectives>
- Clarify and focus board member relationship goals and expectations
- Dive deep into specific, actionable strategies for relationship building
- Provide pointed questions that reveal blind spots and opportunities
- Offer concrete recommendations for optimal engagement
- Help maximize the unique value that board members provide
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
</output_format>

Remember: Be direct, specific, and focused on actionable insights that create mutual value through skills leveraging and relationship building.`,
        userPromptTemplate: `I'm working on building a stronger board member relationship and need your expert guidance.

<current_member_info>
Name: {memberName}
Role: {memberRole}
Current Relationship: {currentRelationship}
</current_member_info>

<my_profile>
{currentFields}
</my_profile>

<my_career_goals>
{goals}
</my_career_goals>

Please provide strategic guidance for optimizing this board member relationship.`,
        variables: ['memberName', 'memberRole', 'currentRelationship', 'currentFields', 'goals']
    },
    // Overall Board Advisor
    {
        promptId: 'board_analysis_advisor',
        name: 'Comprehensive Board Strategy Advisor',
        category: 'overall',
        status: 'active',
        isCustom: false,
        tokenCount: 1400,
        systemPrompt: 'You are a strategic advisor specializing in analyzing Personal Boards of Directors and providing comprehensive board strategy recommendations...',
        userPromptTemplate: 'Analyze my current board and provide strategic recommendations:\n\nCurrent Board Members:\n{boardMembers}\n\nMy Profile:\n{currentFields}\n\nMy Goals:\n{goals}\n\nPlease provide comprehensive board analysis and strategic recommendations...',
        variables: ['boardMembers', 'currentFields', 'goals']
    },
    // Writing Assistant
    {
        promptId: 'writing_advisor',
        name: 'Professional Writing Assistant',
        category: 'writing',
        status: 'active',
        isCustom: false,
        tokenCount: 1200,
        systemPrompt: 'You are a professional writing assistant specializing in improving grammar, spelling, clarity, and professional tone without changing the core meaning or intent of the content. You help make writing more polished, concise, and impactful while preserving the author\'s voice and message.',
        userPromptTemplate: `# Professional Writing Enhancement Request

## Original Content to Improve
{currentFields}

## Instructions
Please improve the writing by:
1. **Grammar & Spelling**: Correct any grammatical errors, spelling mistakes, and punctuation issues
2. **Clarity & Flow**: Enhance sentence structure and readability while maintaining the original meaning
3. **Professional Tone**: Ensure appropriate professional language and tone
4. **Conciseness**: Remove unnecessary words while preserving all key information
5. **Impact**: Strengthen word choice to make the content more compelling

## Important Guidelines
- **PRESERVE MEANING**: Do not change the core meaning, intent, or factual content
- **MAINTAIN VOICE**: Keep the author's personality and communication style
- **NO ADDITIONS**: Do not add new information, claims, or content not present in the original
- **FIELD-BY-FIELD**: Provide improved versions for each field separately

## Response Format
Please provide the improved content organized by field, using this exact structure:

### Improved Content

**Field Name:** [Exact field name]
**Original:** [Original text]
**Improved:** [Enhanced version]

**Field Name:** [Next field name]
**Original:** [Original text]
**Improved:** [Enhanced version]

Focus on making each field more professional, clear, and polished while keeping the exact same meaning and information.`,
        variables: ['currentFields']
    }
];

exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));

    try {
        // Handle CORS preflight
        if (event.httpMethod === 'OPTIONS') {
            return {
                statusCode: 200,
                headers: corsHeaders,
                body: ''
            };
        }

        // Validate admin password for all non-OPTIONS requests
        if (!validateAdminPassword(event)) {
            return unauthorizedResponse();
        }

        const { httpMethod, path } = event;

        if (httpMethod === 'GET' && path === '/admin/prompts') {
            return await getPrompts();
        } else if (httpMethod === 'POST' && path === '/admin/prompts') {
            console.log('🔍 Raw event.body:', event.body);
            console.log('🔍 isBase64Encoded:', event.isBase64Encoded);
            console.log('🔍 Content-Type header:', event.headers['content-type'] || event.headers['Content-Type']);

            const body = event.isBase64Encoded ?
                Buffer.from(event.body, 'base64').toString('utf-8') :
                event.body;

            console.log('📥 Decoded body:', body);
            console.log('📥 Body length:', body.length, 'characters');

            const promptData = JSON.parse(body);
            console.log('📋 Parsed prompt data:', JSON.stringify(promptData, null, 2));

            // Check for null values
            const nullFields = Object.entries(promptData).filter(([key, value]) => value === null);
            if (nullFields.length > 0) {
                console.log('⚠️ NULL FIELDS DETECTED:', nullFields.map(([key]) => key));
            }

            return await createPrompt(promptData);
        } else if (httpMethod === 'PUT' && path.startsWith('/admin/prompts/') && path.endsWith('/activate')) {
            const promptId = path.split('/')[3];
            const body = event.isBase64Encoded ?
                Buffer.from(event.body, 'base64').toString('utf-8') :
                event.body;
            const requestData = body ? JSON.parse(body) : {};
            return await activatePrompt(promptId, requestData);
        } else if (httpMethod === 'PUT' && path.startsWith('/admin/categories/') && path.endsWith('/deactivate')) {
            const category = path.split('/')[3];
            const body = event.isBase64Encoded ?
                Buffer.from(event.body, 'base64').toString('utf-8') :
                event.body;
            const requestData = body ? JSON.parse(body) : {};
            return await deactivateCategory(category, requestData);
        } else if (httpMethod === 'PUT' && path.startsWith('/admin/prompts/') && !path.endsWith('/activate')) {
            const promptId = path.split('/')[3];
            const body = event.isBase64Encoded ?
                Buffer.from(event.body, 'base64').toString('utf-8') :
                event.body;
            const promptData = JSON.parse(body);
            return await updatePrompt(promptId, promptData);
        } else if (httpMethod === 'DELETE' && path.startsWith('/admin/prompts/')) {
            const promptId = path.split('/')[3];
            return await deletePrompt(promptId);
        } else if (httpMethod === 'GET' && path === '/admin/seed') {
            return await seedDatabase();
        } else if (httpMethod === 'GET' && path === '/admin/themes') {
            return await getThemes();
        } else if (httpMethod === 'POST' && path.startsWith('/admin/themes/') && path.endsWith('/activate')) {
            const themeName = path.split('/')[3];
            return await activateTheme(themeName);
        } else if (httpMethod === 'DELETE' && path.startsWith('/admin/themes/')) {
            const themeName = path.split('/')[3];
            return await deleteTheme(themeName);
        } else if (httpMethod === 'POST' && path === '/admin/themes/advanced/save') {
            const body = event.isBase64Encoded ?
                Buffer.from(event.body, 'base64').toString('utf-8') :
                event.body;
            const themeData = JSON.parse(body);
            return await saveAdvancedTheme(themeData);
        }

        return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Not found' })
        };

    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: error.message })
        };
    }
};

async function getPrompts() {
    // Get all prompts
    const promptsResult = await dynamodb.send(new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'begins_with(PK, :pk)',
        ExpressionAttributeValues: {
            ':pk': 'PROMPT#'
        }
    }));

    const prompts = promptsResult.Items.map(item => ({
        promptId: item.PK.replace('PROMPT#', ''),
        ...item
    }));

    // Get active selections using ADVISOR#{category} structure
    const activeResult = await dynamodb.send(new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'begins_with(PK, :pk) AND SK = :sk',
        ExpressionAttributeValues: {
            ':pk': 'ADVISOR#',
            ':sk': 'PROMPT'
        }
    }));

    const activeSelections = {};
    activeResult.Items.forEach(item => {
        const category = item.PK.replace('ADVISOR#', '');
        activeSelections[category] = item.activePromptId;
    });

    // Calculate stats
    const totalPrompts = prompts.length;
    const activePrompts = Object.keys(activeSelections).length;
    const avgTokens = prompts.reduce((sum, p) => sum + (p.tokenCount || 0), 0) / totalPrompts;

    return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
            prompts,
            activeSelections,
            stats: {
                totalPrompts,
                activePrompts,
                avgTokens: Math.round(avgTokens)
            }
        })
    };
}

async function createPrompt(promptData) {
    const promptId = promptData.promptId || `custom_${Date.now()}`;

    // Validate category
    if (!promptData.category || !ADVISOR_CATEGORIES[promptData.category]) {
        return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Invalid or missing category. Must be one of: ' + Object.keys(ADVISOR_CATEGORIES).join(', ') })
        };
    }

    const item = {
        PK: `PROMPT#${promptId}`,
        SK: 'CONFIG',
        promptId,
        name: promptData.name,
        category: promptData.category,
        status: 'inactive',
        isCustom: true,
        theme: promptData.theme || null, // Add theme field
        tokenCount: promptData.tokenCount || 1500,
        systemPrompt: promptData.systemPrompt,
        userPromptTemplate: promptData.userPromptTemplate,
        variables: promptData.variables || [],
        createdAt: new Date().toISOString()
    };

    console.log('💾 Item being stored in DynamoDB:', JSON.stringify(item, null, 2));

    // Check for null values in the item
    const nullFields = Object.entries(item).filter(([key, value]) => value === null);
    if (nullFields.length > 0) {
        console.log('⚠️ NULL FIELDS IN DYNAMODB ITEM:', nullFields.map(([key]) => key));
    }

    await dynamodb.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: item
    }));

    console.log('✅ Successfully stored item with promptId:', promptId);

    return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({ promptId, message: 'Prompt created successfully' })
    };
}

async function updatePrompt(promptId, promptData) {
    console.log('🔄 UPDATE DEBUG: Starting update for promptId:', promptId);
    console.log('🔄 UPDATE DEBUG: Prompt data:', JSON.stringify(promptData, null, 2));

    // First check if the prompt exists
    const existingResult = await dynamodb.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: {
            PK: `PROMPT#${promptId}`,
            SK: 'CONFIG'
        }
    }));

    if (!existingResult.Item) {
        console.log('🔄 UPDATE DEBUG: Prompt not found');
        return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Prompt not found' })
        };
    }

    console.log('🔄 UPDATE DEBUG: Existing prompt:', JSON.stringify(existingResult.Item, null, 2));

    // Only allow updates to custom prompts
    if (!existingResult.Item.isCustom) {
        console.log('🔄 UPDATE DEBUG: Cannot update system prompt');
        return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Cannot update system prompts' })
        };
    }

    // Create updated item, preserving metadata
    const updatedItem = {
        PK: `PROMPT#${promptId}`,
        SK: 'CONFIG',
        promptId,
        name: promptData.name,
        type: promptData.type,
        memberType: promptData.memberType || null,
        status: existingResult.Item.status, // Preserve existing status
        isCustom: true,
        tokenCount: promptData.tokenCount || 1500,
        systemPrompt: promptData.systemPrompt,
        userPromptTemplate: promptData.userPromptTemplate,
        variables: promptData.variables || [],
        createdAt: existingResult.Item.createdAt, // Preserve creation date
        updatedAt: new Date().toISOString()
    };

    console.log('🔄 UPDATE DEBUG: Updated item:', JSON.stringify(updatedItem, null, 2));

    await dynamodb.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: updatedItem
    }));

    console.log('✅ Successfully updated prompt with promptId:', promptId);

    return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ promptId, message: 'Prompt updated successfully' })
    };
}

async function activatePrompt(promptId, requestData = {}) {
    let category;

    // Handle special case for "None" (fallback mode)
    if (promptId === 'None') {
        // For "None", the category must be provided in requestData
        category = requestData.category;
        if (!category || !ADVISOR_CATEGORIES[category]) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Category is required when setting fallback mode (None)' })
            };
        }
    } else {
        // Get prompt details for normal prompts
        const promptResult = await dynamodb.send(new GetCommand({
            TableName: TABLE_NAME,
            Key: {
                PK: `PROMPT#${promptId}`,
                SK: 'CONFIG'
            }
        }));

        if (!promptResult.Item) {
            return {
                statusCode: 404,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Prompt not found' })
            };
        }

        const prompt = promptResult.Item;

        // Determine category from either the new category field or the old type/memberType fields
        category = prompt.category;

    // If no category field, map from old structure
    if (!category) {
        // Map memberType or type to category
        if (prompt.memberType) {
            // Board member types map directly to categories
            category = prompt.memberType; // mentors, coaches, sponsors, connectors, peers
        } else if (prompt.type === 'goals_advisor' || prompt.type === 'superpowers_advisor') {
            // Map goals_advisor to either skills or goals (for now use skills for superpowers)
            category = prompt.name && prompt.name.includes('Superpower') ? 'skills' : 'goals';
        } else if (prompt.type === 'board_analysis_advisor' || prompt.type === 'board_analysis') {
            category = 'overall';
        } else if (prompt.type === 'form_completion') {
            category = 'overall'; // Form completion is an overall board function
        }
    }

        if (!category || !ADVISOR_CATEGORIES[category]) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ error: `Invalid or unmapped category for prompt: ${prompt.type || prompt.memberType || 'unknown'}` })
            };
        }
    }

    // At this point, category should be set for both normal prompts and "None"

    // Update active selection using ADVISOR#{category} structure
    await dynamodb.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: {
            PK: `ADVISOR#${category}`,
            SK: 'PROMPT',
            activePromptId: promptId,
            updatedAt: new Date().toISOString()
        }
    }));

    return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Prompt activated successfully' })
    };
}

async function deactivateCategory(category, requestData = {}) {
    console.log('🎯 DEACTIVATE DEBUG: Starting deactivation for category:', category);
    console.log('🎯 DEACTIVATE DEBUG: Request data:', JSON.stringify(requestData, null, 2));

    // Validate category exists
    if (!ADVISOR_CATEGORIES[category]) {
        console.log('🎯 DEACTIVATE DEBUG: Invalid category:', category);
        return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: `Invalid category: ${category}. Must be one of: ${Object.keys(ADVISOR_CATEGORIES).join(', ')}` })
        };
    }

    // For member types (mentors, coaches, sponsors, connectors, peers),
    // deactivation means falling back to board_member_advisor
    const memberTypes = ['mentors', 'coaches', 'sponsors', 'connectors', 'peers'];

    if (memberTypes.includes(category)) {
        // Set activePromptId to 'None' to trigger fallback mode
        console.log('🎯 DEACTIVATE DEBUG: Setting category to fallback mode (None)');

        // Update active selection to 'None' (fallback mode)
        await dynamodb.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: {
                PK: `ADVISOR#${category}`,
                SK: 'PROMPT',
                activePromptId: 'None',
                updatedAt: new Date().toISOString()
            }
        }));

        console.log('🎯 DEACTIVATE DEBUG: Successfully set fallback mode for category:', category);

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                message: `${category} category deactivated, now using fallback prompt`,
                fallbackPromptId: 'None'
            })
        };
    } else {
        // For non-member categories, also set to 'None' for fallback mode
        console.log('🎯 DEACTIVATE DEBUG: Setting non-member category to fallback mode (None)');

        // Update active selection to 'None' (fallback mode)
        await dynamodb.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: {
                PK: `ADVISOR#${category}`,
                SK: 'PROMPT',
                activePromptId: 'None',
                updatedAt: new Date().toISOString()
            }
        }));

        console.log('🎯 DEACTIVATE DEBUG: Successfully set fallback mode for category:', category);

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                message: `${category} category deactivated, now using fallback prompt`,
                fallbackPromptId: 'None'
            })
        };
    }
}

async function deletePrompt(promptId) {
    // Only allow deletion of custom prompts
    const promptResult = await dynamodb.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: {
            PK: `PROMPT#${promptId}`,
            SK: 'CONFIG'
        }
    }));

    if (!promptResult.Item) {
        return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Prompt not found' })
        };
    }

    if (!promptResult.Item.isCustom) {
        return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Cannot delete default prompts' })
        };
    }

    await dynamodb.send(new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
            PK: `PROMPT#${promptId}`,
            SK: 'CONFIG'
        }
    }));

    return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Prompt deleted successfully' })
    };
}

async function seedDatabase() {
    // Seed prompts
    for (const prompt of INITIAL_PROMPTS) {
        const item = {
            PK: `PROMPT#${prompt.promptId}`,
            SK: 'CONFIG',
            ...prompt,
            createdAt: new Date().toISOString()
        };

        await dynamodb.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: item,
            ConditionExpression: 'attribute_not_exists(PK)'
        })).catch(err => {
            if (err.name !== 'ConditionalCheckFailedException') throw err;
        });
    }

    // Seed active selections using ADVISOR#{category} structure
    const activeSelections = [
        { category: 'skills', promptId: 'superpowers_advisor' },
        { category: 'goals', promptId: 'goals_advisor' },
        { category: 'mentors', promptId: 'mentor_advisor' },
        { category: 'coaches', promptId: 'board_member_advisor' },
        { category: 'sponsors', promptId: 'board_member_advisor' },
        { category: 'connectors', promptId: 'board_member_advisor' },
        { category: 'peers', promptId: 'board_member_advisor' },
        { category: 'board_members', promptId: 'board_member_advisor' },
        { category: 'overall', promptId: 'board_analysis_advisor' },
        { category: 'writing', promptId: 'writing_advisor' }
    ];

    for (const selection of activeSelections) {
        await dynamodb.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: {
                PK: `ADVISOR#${selection.category}`,
                SK: 'PROMPT',
                activePromptId: selection.promptId,
                updatedAt: new Date().toISOString()
            },
            ConditionExpression: 'attribute_not_exists(PK)'
        })).catch(err => {
            if (err.name !== 'ConditionalCheckFailedException') throw err;
        });
    }

    return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Database seeded successfully' })
    };
}

/**
 * Get all available themes
 */
async function getThemes() {
    // Get all theme configurations
    const themesResult = await dynamodb.send(new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'begins_with(PK, :pk)',
        ExpressionAttributeValues: {
            ':pk': 'THEME#'
        }
    }));

    const themes = themesResult.Items.map(item => ({
        themeId: item.PK.replace('THEME#', ''),
        themeName: item.themeName,
        description: item.description,
        prompts: item.prompts,
        isDefault: item.PK === 'THEME#Default'
    }));

    // Get current active prompts to determine which theme is active
    const activeResult = await dynamodb.send(new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'begins_with(PK, :pk) AND SK = :sk',
        ExpressionAttributeValues: {
            ':pk': 'ADVISOR#',
            ':sk': 'PROMPT'
        }
    }));

    const currentConfig = {};
    activeResult.Items.forEach(item => {
        const category = item.PK.replace('ADVISOR#', '');
        currentConfig[category] = item.activePromptId;
    });

    // Determine which theme matches current configuration
    let activeThemeId = null;
    for (const theme of themes) {
        let isMatch = true;
        for (const [category, promptId] of Object.entries(theme.prompts)) {
            if (currentConfig[category] !== promptId) {
                isMatch = false;
                break;
            }
        }
        if (isMatch) {
            activeThemeId = theme.themeId;
            break;
        }
    }

    return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
            themes,
            activeThemeId,
            currentConfig
        })
    };
}

/**
 * Activate a theme
 */
async function activateTheme(themeName) {
    console.log('🎨 Activating theme:', themeName);

    // Get theme configuration
    const themeResult = await dynamodb.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: {
            PK: `THEME#${themeName}`,
            SK: 'CONFIG'
        }
    }));

    if (!themeResult.Item) {
        return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Theme not found' })
        };
    }

    const theme = themeResult.Item;
    const activationResults = [];

    // Board member categories that support fallback
    const boardMemberCategories = ['mentors', 'coaches', 'sponsors', 'connectors', 'peers'];

    // Apply theme prompts
    for (const [category, promptId] of Object.entries(theme.prompts)) {
        try {
            await dynamodb.send(new PutCommand({
                TableName: TABLE_NAME,
                Item: {
                    PK: `ADVISOR#${category}`,
                    SK: 'PROMPT',
                    activePromptId: promptId,
                    updatedAt: new Date().toISOString()
                }
            }));
            activationResults.push({
                category,
                promptId,
                status: 'activated'
            });
        } catch (error) {
            console.error(`Failed to activate ${category}:`, error);
            activationResults.push({
                category,
                promptId,
                status: 'failed',
                error: error.message
            });
        }
    }

    // For board member categories not specified in the theme, set to fallback
    for (const category of boardMemberCategories) {
        if (!theme.prompts[category]) {
            try {
                await dynamodb.send(new PutCommand({
                    TableName: TABLE_NAME,
                    Item: {
                        PK: `ADVISOR#${category}`,
                        SK: 'PROMPT',
                        activePromptId: 'None', // Fallback mode
                        updatedAt: new Date().toISOString()
                    }
                }));
                activationResults.push({
                    category,
                    promptId: 'None',
                    status: 'fallback'
                });
            } catch (error) {
                console.error(`Failed to set fallback for ${category}:`, error);
                activationResults.push({
                    category,
                    promptId: 'None',
                    status: 'failed',
                    error: error.message
                });
            }
        }
    }

    // Other categories (like writing) are left unchanged if not specified in theme

    return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
            message: `Theme "${theme.themeName}" activated successfully`,
            results: activationResults
        })
    };
}

/**
 * Save current configuration as Advanced theme
 */
async function saveAdvancedTheme(themeData) {
    // Get current active selections
    const activeResult = await dynamodb.send(new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'begins_with(PK, :pk) AND SK = :sk',
        ExpressionAttributeValues: {
            ':pk': 'ADVISOR#',
            ':sk': 'PROMPT'
        }
    }));

    const currentPrompts = {};
    activeResult.Items.forEach(item => {
        const category = item.PK.replace('ADVISOR#', '');
        currentPrompts[category] = item.activePromptId;
    });

    // Create or update Advanced theme
    const advancedTheme = {
        PK: 'THEME#Advanced',
        SK: 'CONFIG',
        themeName: themeData.name || 'Advanced (Custom)',
        description: themeData.description || 'Custom configuration saved from current active prompts',
        prompts: currentPrompts,
        createdAt: new Date().toISOString(),
        savedBy: themeData.savedBy || 'admin'
    };

    await dynamodb.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: advancedTheme
    }));

    return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
            message: 'Advanced theme saved successfully',
            theme: advancedTheme
        })
    };
}

/**
 * Delete a theme
 */
async function deleteTheme(themeName) {
    // Prevent deletion of Default theme
    if (themeName === 'Default') {
        return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({
                error: 'Cannot delete Default theme'
            })
        };
    }

    try {
        // Check if theme exists
        const themeResult = await dynamodb.send(new GetCommand({
            TableName: TABLE_NAME,
            Key: {
                PK: `THEME#${themeName}`,
                SK: 'CONFIG'
            }
        }));

        if (!themeResult.Item) {
            return {
                statusCode: 404,
                headers: corsHeaders,
                body: JSON.stringify({
                    error: 'Theme not found'
                })
            };
        }

        // Delete the theme
        await dynamodb.send(new DeleteCommand({
            TableName: TABLE_NAME,
            Key: {
                PK: `THEME#${themeName}`,
                SK: 'CONFIG'
            }
        }));

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                message: `Theme "${themeName}" deleted successfully`
            })
        };

    } catch (error) {
        console.error('Error deleting theme:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                error: 'Failed to delete theme'
            })
        };
    }
}