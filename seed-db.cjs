const AWS = require('aws-sdk');

AWS.config.update({
    region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = 'personal-board-prompt-management';

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

async function seedDatabase() {
    console.log('Seeding database...');

    // Seed prompts
    for (const prompt of INITIAL_PROMPTS) {
        const item = {
            PK: `PROMPT#${prompt.promptId}`,
            SK: 'CONFIG',
            ...prompt,
            createdAt: new Date().toISOString()
        };

        try {
            await dynamodb.put({
                TableName: TABLE_NAME,
                Item: item,
                ConditionExpression: 'attribute_not_exists(PK)'
            }).promise();
            console.log(`✓ Added prompt: ${prompt.name}`);
        } catch (err) {
            if (err.code === 'ConditionalCheckFailedException') {
                console.log(`- Prompt already exists: ${prompt.name}`);
            } else {
                console.error(`✗ Error adding prompt ${prompt.name}:`, err.message);
            }
        }
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
        try {
            await dynamodb.put({
                TableName: TABLE_NAME,
                Item: {
                    PK: `ADVISOR#${selection.advisorKey}`,
                    SK: 'PROMPT',
                    activePromptId: selection.promptId,
                    updatedAt: new Date().toISOString()
                },
                ConditionExpression: 'attribute_not_exists(PK)'
            }).promise();
            console.log(`✓ Added active selection: ${selection.advisorKey} -> ${selection.promptId}`);
        } catch (err) {
            if (err.code === 'ConditionalCheckFailedException') {
                console.log(`- Active selection already exists: ${selection.advisorKey}`);
            } else {
                console.error(`✗ Error adding active selection ${selection.advisorKey}:`, err.message);
            }
        }
    }

    console.log('Database seeding completed!');
}

seedDatabase().catch(console.error);