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

// Initial prompt configuration data
const INITIAL_PROMPTS = [
    {
        promptId: 'form_completion',
        name: 'Enhanced Board Member Advisor',
        type: 'form_completion',
        status: 'active',
        isCustom: false,
        tokenCount: 1450,
        systemPrompt: 'You are a strategic career advisor helping professionals build their Personal Board of Directors...',
        userPromptTemplate: 'Based on the following information about a professional:\n\nCurrent Profile:\n{currentFields}\n\nCareer Goals:\n{goals}\n\nExisting Board Members:\n{boardMembers}\n\nPlease provide strategic guidance on building their board...',
        variables: ['currentFields', 'goals', 'boardMembers']
    },
    {
        promptId: 'board_member_advisor',
        name: 'Board Member Relationship Advisor',
        type: 'board_member_advisor',
        status: 'active',
        isCustom: false,
        tokenCount: 1280,
        systemPrompt: 'You are an expert advisor helping professionals maximize value from their board member relationships...',
        userPromptTemplate: 'Help me develop my relationship with this board member:\n\nBoard Member: {memberName}\nRole: {memberRole}\nCurrent Relationship: {currentRelationship}\n\nMy Profile:\n{currentFields}\n\nMy Goals:\n{goals}\n\nPlease provide specific advice...',
        variables: ['memberName', 'memberRole', 'currentRelationship', 'currentFields', 'goals']
    },
    {
        promptId: 'mentor_advisor',
        name: 'Mentor Relationship Advisor',
        type: 'mentor_advisor',
        memberType: 'mentors',
        status: 'active',
        isCustom: false,
        tokenCount: 1320,
        systemPrompt: 'You are an expert advisor helping professionals build and maintain effective mentoring relationships...',
        userPromptTemplate: 'Help me with this mentoring relationship:\n\nMentor: {memberName}\nRole/Background: {memberRole}\nRelationship Stage: {currentRelationship}\n\nMy Current Situation:\n{currentFields}\n\nMy Career Goals:\n{goals}\n\nPlease provide guidance...',
        variables: ['memberName', 'memberRole', 'currentRelationship', 'currentFields', 'goals']
    },
    {
        promptId: 'coach_advisor',
        name: 'Coach Relationship Advisor',
        type: 'mentor_advisor',
        memberType: 'coaches',
        status: 'inactive',
        isCustom: false,
        tokenCount: 1290,
        systemPrompt: 'You are an expert advisor helping professionals work effectively with professional coaches...',
        userPromptTemplate: 'Help me optimize my coaching relationship:\n\nCoach: {memberName}\nSpecialty: {memberRole}\nCurrent Focus: {currentRelationship}\n\nMy Profile:\n{currentFields}\n\nMy Goals:\n{goals}\n\nPlease advise...',
        variables: ['memberName', 'memberRole', 'currentRelationship', 'currentFields', 'goals']
    },
    {
        promptId: 'sponsor_advisor',
        name: 'Sponsor Relationship Advisor',
        type: 'mentor_advisor',
        memberType: 'sponsors',
        status: 'inactive',
        isCustom: false,
        tokenCount: 1380,
        systemPrompt: 'You are an expert advisor helping professionals build and leverage sponsorship relationships...',
        userPromptTemplate: 'Help me with this sponsorship relationship:\n\nSponsor: {memberName}\nPosition: {memberRole}\nCurrent Status: {currentRelationship}\n\nMy Profile:\n{currentFields}\n\nMy Aspirations:\n{goals}\n\nPlease provide strategic advice...',
        variables: ['memberName', 'memberRole', 'currentRelationship', 'currentFields', 'goals']
    },
    {
        promptId: 'connector_advisor',
        name: 'Connector Relationship Advisor',
        type: 'mentor_advisor',
        memberType: 'connectors',
        status: 'inactive',
        isCustom: false,
        tokenCount: 1250,
        systemPrompt: 'You are an expert advisor helping professionals build relationships with well-connected individuals...',
        userPromptTemplate: 'Help me build this connector relationship:\n\nConnector: {memberName}\nNetwork/Industry: {memberRole}\nConnection Level: {currentRelationship}\n\nMy Background:\n{currentFields}\n\nMy Goals:\n{goals}\n\nPlease advise...',
        variables: ['memberName', 'memberRole', 'currentRelationship', 'currentFields', 'goals']
    },
    {
        promptId: 'peer_advisor',
        name: 'Peer Relationship Advisor',
        type: 'mentor_advisor',
        memberType: 'peers',
        status: 'inactive',
        isCustom: false,
        tokenCount: 1200,
        systemPrompt: 'You are an expert advisor helping professionals build valuable peer-to-peer relationships...',
        userPromptTemplate: 'Help me develop this peer relationship:\n\nPeer: {memberName}\nRole/Background: {memberRole}\nCurrent Dynamic: {currentRelationship}\n\nMy Profile:\n{currentFields}\n\nMy Objectives:\n{goals}\n\nPlease provide guidance...',
        variables: ['memberName', 'memberRole', 'currentRelationship', 'currentFields', 'goals']
    },
    {
        promptId: 'superpowers_advisor',
        name: 'Superpowers Skills Advisor',
        type: 'goals_advisor',
        status: 'active',
        isCustom: false,
        tokenCount: 1650,
        systemPrompt: 'You are a strategic career advisor specializing in identifying and developing professional superpowers...',
        userPromptTemplate: 'Help me identify and develop my key professional superpowers:\n\nMy Current Profile:\n{currentFields}\n\nMy Career Goals:\n{goals}\n\nMy Current Skills/Strengths:\n{skills}\n\nExisting Board Members:\n{boardMembers}\n\nPlease help me identify 2-4 key differentiating skills...',
        variables: ['currentFields', 'goals', 'skills', 'boardMembers']
    },
    {
        promptId: 'board_analysis_advisor',
        name: 'Board Analysis Advisor',
        type: 'board_analysis_advisor',
        status: 'active',
        isCustom: false,
        tokenCount: 1820,
        systemPrompt: 'You are a strategic advisor analyzing Personal Board of Directors for comprehensive career guidance...',
        userPromptTemplate: 'Analyze this Personal Board of Directors:\n\nUser Profile:\n{currentFields}\n\nCareer Goals:\n{goals}\n\nKey Skills/Superpowers:\n{skills}\n\nBoard Members:\n{boardMembers}\n\nPlease provide a comprehensive analysis...',
        variables: ['currentFields', 'goals', 'skills', 'boardMembers']
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

    // Get active selections
    const activeResult = await dynamodb.send(new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'begins_with(PK, :pk)',
        ExpressionAttributeValues: {
            ':pk': 'ADVISOR#'
        }
    }));

    const activeSelections = {};
    activeResult.Items.forEach(item => {
        const advisorType = item.PK.replace('ADVISOR#', '');
        activeSelections[advisorType] = item.activePromptId;
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

    const item = {
        PK: `PROMPT#${promptId}`,
        SK: 'CONFIG',
        promptId,
        name: promptData.name,
        type: promptData.type,
        memberType: promptData.memberType || null,
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
    const advisorKey = prompt.memberType || prompt.type;

    // Update active selection
    await dynamodb.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: {
            PK: `ADVISOR#${advisorKey}`,
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

    // Seed active selections
    const activeSelections = [
        { advisorKey: 'form_completion', promptId: 'form_completion' },
        { advisorKey: 'board_member_advisor', promptId: 'board_member_advisor' },
        { advisorKey: 'mentors', promptId: 'mentor_advisor' },
        { advisorKey: 'goals_advisor', promptId: 'superpowers_advisor' },
        { advisorKey: 'board_analysis_advisor', promptId: 'board_analysis_advisor' }
    ];

    for (const selection of activeSelections) {
        await dynamodb.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: {
                PK: `ADVISOR#${selection.advisorKey}`,
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