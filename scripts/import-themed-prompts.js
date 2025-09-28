#!/usr/bin/env node

/**
 * Script to import themed prompts from JSON files into DynamoDB
 * Run: node scripts/import-themed-prompts.js
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure AWS
const client = new DynamoDBClient({ region: 'us-east-1' });
const dynamodb = DynamoDBDocumentClient.from(client);
const TABLE_NAME = 'personal-board-prompt-management';

// Theme mapping
const THEME_NAMES = {
    'simon_sinek': 'Sinek',
    'barack_obama': 'Obama',
    'lou_holtz': 'Holtz',
    'jon_stewart': 'Stewart'
};

/**
 * Extract theme from prompt ID
 */
function extractTheme(promptId) {
    for (const [key, theme] of Object.entries(THEME_NAMES)) {
        if (promptId.includes(key)) {
            return theme;
        }
    }
    return null;
}

/**
 * Import prompts from a JSON file
 */
async function importPromptsFromFile(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    const importedPrompts = [];

    for (const [promptId, promptData] of Object.entries(data.prompts)) {
        const theme = extractTheme(promptId);

        const item = {
            PK: `PROMPT#${promptId}`,
            SK: 'CONFIG',
            promptId: promptId,
            name: promptData.name,
            category: promptData.category,
            status: promptData.status || 'inactive',
            isCustom: promptData.isCustom !== false,
            theme: theme, // Add theme tag
            systemPrompt: promptData.systemPrompt,
            userPromptTemplate: promptData.userPromptTemplate,
            variables: promptData.variables || [],
            tokenCount: promptData.tokenCount || 1500,
            createdAt: new Date().toISOString()
        };

        try {
            await dynamodb.send(new PutCommand({
                TableName: TABLE_NAME,
                Item: item
            }));
            console.log(`✅ Imported: ${promptId} (${theme || 'no theme'})`);
            importedPrompts.push({
                promptId,
                category: promptData.category,
                theme
            });
        } catch (error) {
            console.error(`❌ Failed to import ${promptId}:`, error.message);
        }
    }

    return importedPrompts;
}

/**
 * Create theme configurations in DynamoDB
 */
async function createThemeConfigurations(importedPrompts) {
    // Group prompts by theme
    const themes = {};

    importedPrompts.forEach(prompt => {
        if (prompt.theme) {
            if (!themes[prompt.theme]) {
                themes[prompt.theme] = {};
            }
            themes[prompt.theme][prompt.category] = prompt.promptId;
        }
    });

    // Create theme records
    for (const [themeName, prompts] of Object.entries(themes)) {
        const themeConfig = {
            PK: `THEME#${themeName}`,
            SK: 'CONFIG',
            themeName: getThemeDisplayName(themeName),
            description: getThemeDescription(themeName),
            prompts: prompts,
            createdAt: new Date().toISOString()
        };

        try {
            await dynamodb.send(new PutCommand({
                TableName: TABLE_NAME,
                Item: themeConfig
            }));
            console.log(`✅ Created theme configuration: ${themeName}`);
        } catch (error) {
            console.error(`❌ Failed to create theme ${themeName}:`, error.message);
        }
    }

    // Create Default theme with current configuration
    const defaultTheme = {
        PK: 'THEME#Default',
        SK: 'CONFIG',
        themeName: 'Default',
        description: 'Standard advisor configuration',
        prompts: {
            skills: 'superpowers_advisor',
            goals: 'goals_advisor',
            overall: 'board_analysis_advisor',
            board_members: 'board_member_advisor',
            mentors: 'mentor_advisor',
            writing: 'writing_advisor'
            // coaches, sponsors, connectors, peers use fallback
        },
        createdAt: new Date().toISOString()
    };

    try {
        await dynamodb.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: defaultTheme
        }));
        console.log('✅ Created Default theme configuration');
    } catch (error) {
        console.error('❌ Failed to create Default theme:', error.message);
    }
}

/**
 * Get theme display name
 */
function getThemeDisplayName(theme) {
    const names = {
        'Sinek': 'Simon Sinek - Start with WHY',
        'Obama': 'Barack Obama - Coalition Builder',
        'Holtz': 'Lou Holtz - Fundamentals',
        'Stewart': 'Jon Stewart - Reality Check'
    };
    return names[theme] || theme;
}

/**
 * Get theme description
 */
function getThemeDescription(theme) {
    const descriptions = {
        'Sinek': 'Purpose-driven advisor style focusing on WHY, HOW, and WHAT',
        'Obama': 'Calm, pragmatic, and inclusive advisor building coalitions',
        'Holtz': 'Direct, motivational coach focused on fundamentals and execution',
        'Stewart': 'Witty, candid advisor who cuts through vagueness with humor'
    };
    return descriptions[theme] || 'Custom advisor theme';
}

/**
 * Main import function
 */
async function main() {
    console.log('🚀 Starting themed prompts import...\n');

    const promptsDir = path.join(__dirname, '../prompts');

    try {
        // Read all JSON files in prompts directory
        const files = await fs.readdir(promptsDir);
        const jsonFiles = files.filter(f => f.endsWith('.json'));

        console.log(`📁 Found ${jsonFiles.length} prompt files to import\n`);

        const allImportedPrompts = [];

        // Import prompts from each file
        for (const file of jsonFiles) {
            console.log(`\n📄 Importing from ${file}:`);
            const filePath = path.join(promptsDir, file);
            const imported = await importPromptsFromFile(filePath);
            allImportedPrompts.push(...imported);
        }

        console.log('\n📦 Creating theme configurations...\n');
        await createThemeConfigurations(allImportedPrompts);

        console.log('\n✨ Import completed successfully!');
        console.log(`📊 Total prompts imported: ${allImportedPrompts.length}`);

        // Summary by theme
        const themeCounts = {};
        allImportedPrompts.forEach(p => {
            const theme = p.theme || 'None';
            themeCounts[theme] = (themeCounts[theme] || 0) + 1;
        });

        console.log('\n📈 Prompts by theme:');
        Object.entries(themeCounts).forEach(([theme, count]) => {
            console.log(`   ${theme}: ${count} prompts`);
        });

    } catch (error) {
        console.error('❌ Import failed:', error);
        process.exit(1);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export { importPromptsFromFile, createThemeConfigurations };