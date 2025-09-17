const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, GetCommand, PutCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient();
const dynamodb = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.PROMPT_MANAGEMENT_TABLE || process.env.DYNAMODB_TABLE;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

// Advisor category definitions
const ADVISOR_CATEGORIES = {
    'skills': {
        name: 'Skills & Superpowers',
        description: 'Advisors for identifying and developing your core skills and strengths',
        defaultPrompt: 'skills_default'
    },
    'goals': {
        name: 'Goals & Vision',
        description: 'Advisors for setting and achieving career goals',
        defaultPrompt: 'goals_default'
    },
    'mentors': {
        name: 'Mentors',
        description: 'Relationship advisors for mentor connections',
        defaultPrompt: 'mentors_default'
    },
    'coaches': {
        name: 'Coaches',
        description: 'Relationship advisors for coaching connections',
        defaultPrompt: 'coaches_default'
    },
    'sponsors': {
        name: 'Sponsors',
        description: 'Relationship advisors for sponsor connections',
        defaultPrompt: 'sponsors_default'
    },
    'connectors': {
        name: 'Connectors',
        description: 'Relationship advisors for connector relationships',
        defaultPrompt: 'connectors_default'
    },
    'peers': {
        name: 'Peers',
        description: 'Relationship advisors for peer connections',
        defaultPrompt: 'peers_default'
    },
    'overall': {
        name: 'Overall Board Advisor',
        description: 'Holistic advisors for comprehensive board guidance',
        defaultPrompt: 'overall_default'
    }
};

// Initial prompt configuration data with new structure
const INITIAL_PROMPTS = [
    // Skills & Superpowers
    {
        promptId: 'skills_default',
        name: 'Skills & Superpowers Advisor',
        category: 'skills',
        status: 'active',
        isCustom: false,
        tokenCount: 1200,
        systemPrompt: 'You are an expert career advisor specializing in identifying and developing professional skills and superpowers...',
        userPromptTemplate: 'Help me identify and develop my skills:\n\nCurrent Skills: {skills}\nCareer Goals: {goals}\nCurrent Situation: {currentFields}\n\nPlease provide guidance on developing my superpowers...',
        variables: ['skills', 'goals', 'currentFields']
    },
    // Goals & Vision
    {
        promptId: 'goals_default',
        name: 'Goals & Career Vision Advisor',
        category: 'goals',
        status: 'active',
        isCustom: false,
        tokenCount: 1300,
        systemPrompt: 'You are a strategic career advisor helping professionals set and achieve meaningful career goals...',
        userPromptTemplate: 'Help me with my career goals:\n\nCurrent Goals: {goals}\nCurrent Situation: {currentFields}\nExisting Board: {boardMembers}\n\nPlease provide strategic guidance on goal achievement...',
        variables: ['goals', 'currentFields', 'boardMembers']
    },
    // Board Member Categories
    {
        promptId: 'mentors_default',
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
        promptId: 'coaches_default',
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
        promptId: 'sponsors_default',
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
        promptId: 'connectors_default',
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
        promptId: 'peers_default',
        name: 'Peer Relationship Advisor',
        category: 'peers',
        status: 'active',
        isCustom: false,
        tokenCount: 1200,
        systemPrompt: 'You are an expert advisor helping professionals build valuable peer-to-peer relationships...',
        userPromptTemplate: 'Help me develop this peer relationship:\n\nPeer: {memberName}\nRole/Background: {memberRole}\nCurrent Dynamic: {currentRelationship}\n\nMy Profile:\n{currentFields}\n\nMy Objectives:\n{goals}\n\nPlease provide guidance...',
        variables: ['memberName', 'memberRole', 'currentRelationship', 'currentFields', 'goals']
    },
    // Overall Board Advisor
    {
        promptId: 'overall_default',
        name: 'Comprehensive Board Strategy Advisor',
        category: 'overall',
        status: 'active',
        isCustom: false,
        tokenCount: 1400,
        systemPrompt: 'You are a strategic advisor specializing in analyzing Personal Boards of Directors and providing comprehensive board strategy recommendations...',
        userPromptTemplate: 'Analyze my current board and provide strategic recommendations:\n\nCurrent Board Members:\n{boardMembers}\n\nMy Profile:\n{currentFields}\n\nMy Goals:\n{goals}\n\nPlease provide comprehensive board analysis and strategic recommendations...',
        variables: ['boardMembers', 'currentFields', 'goals']
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
            return await activatePrompt(promptId);
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

async function activatePrompt(promptId) {
    // Get prompt details
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
    let category = prompt.category;

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
        { category: 'skills', promptId: 'skills_default' },
        { category: 'goals', promptId: 'goals_default' },
        { category: 'mentors', promptId: 'mentors_default' },
        { category: 'coaches', promptId: 'coaches_default' },
        { category: 'sponsors', promptId: 'sponsors_default' },
        { category: 'connectors', promptId: 'connectors_default' },
        { category: 'peers', promptId: 'peers_default' },
        { category: 'overall', promptId: 'overall_default' }
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