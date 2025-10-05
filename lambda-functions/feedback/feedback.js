exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  // Handle CORS preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    // Parse body - handle both direct JSON and base64 encoded JSON
    let body;
    try {
      let bodyString = event.body;
      
      // Check if body is base64 encoded
      if (event.isBase64Encoded || (typeof bodyString === 'string' && /^[A-Za-z0-9+/]+=*$/.test(bodyString) && bodyString.length > 50)) {
        try {
          bodyString = Buffer.from(event.body, 'base64').toString('utf-8');
        } catch (e) {
          // Not base64, use as is
        }
      }
      
      body = typeof bodyString === 'string' ? JSON.parse(bodyString) : bodyString;
    } catch (parseError) {
      console.error('Failed to parse body:', event.body);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid JSON in request body' })
      };
    }
    const {
      title,
      description,
      issueType, // 'bug', 'feature', 'help'
      context, // 'user' for Personal Board
      userAgent,
      url,
      additionalInfo
    } = body;

    // Validate required fields
    if (!title || !description || !issueType || !context) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'Missing required fields: title, description, issueType, context' 
        }),
        headers
      };
    }

    console.log(`📝 Creating GitHub issue: ${issueType} from ${context} - ${title}`);

    // GitHub API configuration
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const GITHUB_REPO = process.env.GITHUB_REPO || 'geseib/personalboard';
    
    if (!GITHUB_TOKEN) {
      console.error('❌ GitHub token not configured');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'GitHub integration not configured' }),
        headers
      };
    }

    // Prepare GitHub issue data
    const labels = [];
    
    // Add type label
    switch (issueType) {
      case 'bug':
        labels.push('bug');
        break;
      case 'feature':
        labels.push('enhancement');
        break;
      case 'help':
        labels.push('question');
        break;
    }
    
    // Add context label for Personal Board
    labels.push('user-feedback');
    
    // Add environment label (will be determined after URL parsing)
    let environmentLabel = null;

    // Extract environment/site information from URL
    let environment = 'unknown';
    let siteName = 'unknown';
    
    if (url) {
      try {
        const urlObj = new URL(url);
        siteName = urlObj.hostname;
        
        // Determine environment based on hostname - extract subdomain as environment name
        if (urlObj.hostname.includes('localhost') || urlObj.hostname.includes('127.0.0.1')) {
          environment = 'localhost';
          environmentLabel = 'local-dev';
        } else if (urlObj.hostname === 'board.seibtribe.us') {
          // Main production site
          environment = 'production';
          environmentLabel = 'prod-environment';
        } else if (urlObj.hostname.endsWith('.seibtribe.us')) {
          // Extract subdomain as environment name (e.g., pbod.seibtribe.us → pbod, board.dev.seibtribe.us → board.dev)
          const subdomain = urlObj.hostname.replace('.seibtribe.us', '');
          environment = subdomain;
          environmentLabel = `${subdomain}-environment`;
        }
      } catch (e) {
        console.warn('Failed to parse URL:', url);
      }
    }

    // Build issue body with metadata
    let issueBody = description;
    
    // Add environment information prominently at the top
    issueBody += '\n\n---\n**Environment Information:**\n';
    issueBody += `- **Site:** ${siteName}\n`;
    issueBody += `- **Environment:** ${environment}\n`;
    issueBody += `- **Context:** Personal Board Application\n`;
    
    if (userAgent || url || additionalInfo) {
      issueBody += '\n**Technical Details:**\n';
      
      if (url) {
        issueBody += `- **Full URL:** ${url}\n`;
      }
      
      if (userAgent) {
        issueBody += `- **User Agent:** ${userAgent}\n`;
      }
      
      if (additionalInfo) {
        issueBody += `- **Additional Info:** ${additionalInfo}\n`;
      }
    }

    // Add environment label if determined
    if (environmentLabel) {
      labels.push(environmentLabel);
    }

    // Add context information
    issueBody += `\n**Reported from:** Personal Board Application`;
    issueBody += `\n**Issue type:** ${issueType}`;
    issueBody += `\n**Submitted:** ${new Date().toISOString()}`;

    const githubIssue = {
      title: `[${issueType.toUpperCase()}][${environment.toUpperCase()}] ${title}`,
      body: issueBody,
      labels: labels
    };

    // Create GitHub issue
    const githubResponse = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/issues`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'personalboard-feedback-reporter'
      },
      body: JSON.stringify(githubIssue)
    });

    if (!githubResponse.ok) {
      const errorData = await githubResponse.text();
      console.error('❌ GitHub API error:', errorData);
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          error: 'Failed to create GitHub issue',
          details: errorData 
        }),
        headers
      };
    }

    const createdIssue = await githubResponse.json();
    console.log(`✅ GitHub issue created: #${createdIssue.number} - ${createdIssue.html_url}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        issueNumber: createdIssue.number,
        issueUrl: createdIssue.html_url,
        message: 'Issue created successfully'
      }),
      headers
    };

  } catch (error) {
    console.error('❌ Create GitHub issue error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Failed to create issue',
        details: error.message 
      }),
      headers
    };
  }
};