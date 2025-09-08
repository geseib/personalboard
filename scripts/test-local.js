#!/usr/bin/env node

/**
 * Local test script for AI Guidance API
 * Run this after deployment to test your API endpoints
 * 
 * Usage: node test-local.js <API_URL>
 * Example: node test-local.js https://abc123.execute-api.us-east-1.amazonaws.com/production
 */

const https = require('https');

// Get API URL from command line or environment
const API_URL = process.argv[2] || process.env.AI_API_URL;

if (!API_URL) {
  console.error('❌ Please provide the API URL as an argument');
  console.error('Usage: node test-local.js <API_URL>');
  console.error('Example: node test-local.js https://abc123.execute-api.us-east-1.amazonaws.com/production');
  process.exit(1);
}

const API_ENDPOINT = `${API_URL}/ai-guidance`;

console.log('🤖 Testing AI Guidance API');
console.log(`📍 API Endpoint: ${API_ENDPOINT}`);
console.log('');

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

/**
 * Make an HTTPS request to the API
 */
function makeRequest(data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    
    const url = new URL(API_ENDPOINT);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, error: 'Invalid JSON response' });
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Test a specific endpoint
 */
async function testEndpoint(name, type, data) {
  console.log(`${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}Testing: ${name}${colors.reset}`);
  console.log(`${colors.cyan}Request Type: ${type}${colors.reset}`);
  
  try {
    const response = await makeRequest({ type, data });
    
    if (response.status === 200 && response.data.success) {
      console.log(`${colors.green}✅ Test Passed${colors.reset}`);
      console.log(`${colors.green}Model Used: ${response.data.model}${colors.reset}`);
      console.log(`${colors.blue}Guidance Preview:${colors.reset}`);
      const preview = response.data.guidance.split('\n').slice(0, 3).join('\n');
      console.log(preview);
      console.log('...');
    } else if (response.error) {
      console.log(`${colors.red}❌ Test Failed - ${response.error}${colors.reset}`);
      console.log(`Status Code: ${response.status}`);
      console.log(`Response: ${response.data}`);
    } else if (response.data.error) {
      console.log(`${colors.red}❌ Test Failed${colors.reset}`);
      console.log(`${colors.red}Error: ${response.data.error}${colors.reset}`);
      console.log(`${colors.red}Message: ${response.data.message || 'No message'}${colors.reset}`);
    } else {
      console.log(`${colors.yellow}⚠️  Unexpected response${colors.reset}`);
      console.log(JSON.stringify(response.data, null, 2));
    }
  } catch (error) {
    console.log(`${colors.red}❌ Request Failed${colors.reset}`);
    console.log(`${colors.red}Error: ${error.message}${colors.reset}`);
  }
  
  console.log('');
}

/**
 * Run all tests
 */
async function runTests() {
  // Test 1: Form Completion
  await testEndpoint(
    'Form Completion for Mentor',
    'form_completion',
    {
      formType: 'mentor',
      currentFields: {
        name: 'Jane Smith',
        role: 'VP of Engineering',
        connection: 'Strong'
      },
      goals: [
        {
          timeframe: '1 Year',
          description: 'Get promoted to senior engineer'
        }
      ]
    }
  );

  // Test 2: Goal Alignment
  await testEndpoint(
    'Goal Alignment Check',
    'goal_alignment',
    {
      goals: [
        {
          timeframe: '3 Month Goals',
          description: 'Complete AWS certification'
        },
        {
          timeframe: '1 Year Goals',
          description: 'Lead a major project'
        }
      ],
      boardMembers: {
        mentors: [
          {
            name: 'John Doe',
            role: 'CTO',
            whatToLearn: 'Leadership and strategy'
          }
        ],
        coaches: [
          {
            name: 'Sarah Lee',
            role: 'AWS Solutions Architect',
            whatToLearn: 'Cloud architecture'
          }
        ]
      }
    }
  );

  // Test 3: Connection Suggestions
  await testEndpoint(
    'Finding a Sponsor',
    'connection_suggestions',
    {
      targetRole: 'sponsor',
      currentNetwork: 'Tech company with 500 employees, active in local tech meetups',
      goals: 'Move into engineering management within 2 years',
      existingBoard: '2 mentors, 1 coach, 3 peers'
    }
  );

  // Test 4: Board Analysis
  await testEndpoint(
    'Board Composition Analysis',
    'board_analysis',
    {
      boardData: {
        mentors: [
          {name: 'Alice', role: 'CEO', cadence: 'Quarterly'}
        ],
        coaches: [
          {name: 'Bob', role: 'Agile Coach', cadence: 'Weekly'}
        ],
        peers: [
          {name: 'Charlie', role: 'Senior Engineer', cadence: 'Monthly'},
          {name: 'Diana', role: 'Product Manager', cadence: 'Bi-weekly'}
        ],
        connectors: [],
        sponsors: []
      },
      goals: [
        {
          timeframe: '5 Year Goals',
          description: 'Become a VP of Engineering'
        }
      ]
    }
  );

  // Summary
  console.log(`${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}📊 Test Summary${colors.reset}`);
  console.log(`${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.green}All tests completed!${colors.reset}`);
  console.log('');
  console.log(`${colors.cyan}To update the frontend with this API URL:${colors.reset}`);
  console.log(`${colors.green}Edit ai-client.js and set:${colors.reset}`);
  console.log(`${colors.green}const AI_API_BASE_URL = '${API_URL}';${colors.reset}`);
}

// Run the tests
runTests().catch(error => {
  console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
  process.exit(1);
});