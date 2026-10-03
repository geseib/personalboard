import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { REPORT_ROLES, getBoardGroups } from './board-roles.js';
import { connectionLevels } from './utils.js';
import { AdvisorWorkspace } from './advisor-workspace.js';
import { WritingResultsModal, SafeMarkdown } from './editing-workspace.js';
import { applyWritingEdits, fieldLabel, writingConflicts, undoWritingEdits, recoverWritingDraft, clearWritingDrafts } from './editing-utils.js';
import { getBoardAnalysisAdvisorGuidance, isAuthenticated, validateAccessCode, getAIGuidance } from './ai-client.js';
import { FeedbackButton } from './feedback.js';
import './feedback.css';
// use direct paths so images resolve without a bundler


const pages = [
  { key: 'intro', title: 'Intro', image: './images/Slide2.png', quote: '', quotePosition: 'center' },
  { key: 'you', title: 'You', image: './images/Slide11.png', quote: 'Know yourself first.', quotePosition: 'bottom-left' },
  { key: 'goals', title: 'Goals', image: './images/Slide12.png', quote: 'Your vision shapes your board.', quotePosition: 'bottom-right' },
  { key: 'mentors', title: 'Mentors', image: './images/Slide7.png', quote: 'A mentor opens doors.', quotePosition: 'bottom-right' },
  { key: 'coaches', title: 'Coaches', image: './images/Slide6.png', quote: 'Coaches refine potential.', quotePosition: 'bottom-left' },
  { key: 'connectors', title: 'Connectors', image: './images/Slide4.png', quote: 'Connections spark growth.', quotePosition: 'center' },
  { key: 'sponsors', title: 'Sponsors', image: './images/Slide8.png', quote: 'Sponsorship elevates.', quotePosition: 'bottom-right' },
  { key: 'peers', title: 'Peers', image: './images/Slide9.png', quote: 'Peers share the path.', quotePosition: 'bottom-right' },
  { key: 'board', title: 'Board', image: './images/Slide10.png', quote: '', quotePosition: 'center' }
];

// Tooltip component that matches the "Next Step" pointer styling
function Tooltip({ children, text }) {
  return (
    <div className="tooltip-container">
      {children}
      {text && <div className="tooltip">{text}</div>}
    </div>
  );
}

// Bottom tooltip component for top buttons
function BottomTooltip({ children, text }) {
  return (
    <div className="tooltip-container">
      {children}
      {text && <div className="tooltip-bottom">{text}</div>}
    </div>
  );
}

// Wide tooltip component for skills to prevent running off screen
function WideTooltip({ children, text }) {
  return (
    <div className="tooltip-container">
      {children}
      {text && <div className="tooltip-wide">{text}</div>}
    </div>
  );
}

// Simple markdown renderer for AI analysis
function renderMarkdown(text) {
  if (!text) return '';

  let html = text;

  // Convert headings
  html = html.replace(/^### (.*?)$/gm, '<h4 style="color: #1f2937; font-size: 1.1rem; font-weight: 600; margin: 20px 0 10px 0;">$1</h4>');
  html = html.replace(/^## (.*?)$/gm, '<h3 style="color: #2563eb; font-size: 1.3rem; font-weight: 600; margin: 25px 0 12px 0; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">$1</h3>');
  html = html.replace(/^# (.*?)$/gm, '<h2 style="color: #1e293b; font-size: 1.5rem; font-weight: 700; margin: 30px 0 15px 0;">$1</h2>');

  // Convert bold text (must be before italic)
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #111827; font-weight: 600;">$1</strong>');

  // Convert bullet points (must be before italic to prevent conflict)
  html = html.replace(/^• (.*?)$/gm, '<li style="margin-left: 20px; margin-bottom: 8px;">$1</li>');
  html = html.replace(/^- (.*?)$/gm, '<li style="margin-left: 20px; margin-bottom: 8px;">$1</li>');
  html = html.replace(/^\* (.*?)$/gm, '<li style="margin-left: 20px; margin-bottom: 8px;">$1</li>');

  // Convert italic text (after lists to avoid conflict)
  html = html.replace(/(?<!\*)\*(?!\*)([^*]+)\*(?!\*)/g, '<em style="font-style: italic;">$1</em>');

  // Wrap consecutive li tags in ul
  html = html.replace(/(<li.*?<\/li>\s*)+/g, function(match) {
    return '<ul style="list-style-type: disc; margin: 15px 0; padding-left: 20px;">' + match + '</ul>';
  });

  // Convert numbered lists
  html = html.replace(/^\d+\. (.*?)$/gm, '<li style="margin-left: 20px; margin-bottom: 8px;">$1</li>');

  // Wrap consecutive numbered li tags in ol
  html = html.replace(/(<li.*?<\/li>\s*)+/g, function(match) {
    if (match.includes('list-style-type: disc')) return match;
    return '<ol style="list-style-type: decimal; margin: 15px 0; padding-left: 20px;">' + match + '</ol>';
  });

  // Convert line breaks to paragraphs
  const paragraphs = html.split('\n\n');
  html = paragraphs.map(p => {
    if (p.trim().startsWith('<h') || p.trim().startsWith('<ul') || p.trim().startsWith('<ol')) {
      return p;
    }
    return `<p style="margin-bottom: 15px;">${p}</p>`;
  }).join('');

  // Convert single line breaks to <br> within paragraphs
  html = html.replace(/\n/g, '<br>');

  return html;
}

function App() {
  // Check URL parameter for section
  const urlParams = new URLSearchParams(window.location.search);
  const initialSection = urlParams.get('section') || 'intro';

  const [current, setCurrent] = useState(initialSection);
  // On small screens the tab bar scrolls; keep the active tab visible.
  useEffect(() => {
    const nav = document.querySelector('.nav');
    const active = nav?.querySelector('button.active');
    if (!nav || !active || nav.scrollWidth <= nav.clientWidth) return;
    const navBox = nav.getBoundingClientRect(), box = active.getBoundingClientRect();
    nav.scrollLeft += box.left - navBox.left - (navBox.width - box.width) / 2;
  }, [current]);

  // Handle URL parameter changes
  useEffect(() => {
    const handleUrlChange = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const section = urlParams.get('section');
      if (section && pages.some(p => p.key === section)) {
        setCurrent(section);
      }
    };

    // Listen for popstate events (back/forward buttons)
    window.addEventListener('popstate', handleUrlChange);

    return () => {
      window.removeEventListener('popstate', handleUrlChange);
    };
  }, []);

  const [data, setData] = useState(() => {
    const savedData = JSON.parse(localStorage.getItem('boardData') || '{}');
    // Initialize goals if they don't exist
    if (!savedData.goals) {
      savedData.goals = [
        { timeframe: '3 Months (Immediate Goals)', description: '', notes: '' },
        { timeframe: '1 Year Goals', description: '', notes: '' },
        { timeframe: '5+ Year Goals (Long-term Vision)', description: '', notes: '' },
        { timeframe: 'Beyond', description: '', notes: '' }
      ];
    } else {
      // Migration: Fix existing goals structure if needed
      const expectedTimeframes = [
        '3 Months (Immediate Goals)',
        '1 Year Goals',
        '5+ Year Goals (Long-term Vision)',
        'Beyond'
      ];

      if (savedData.goals.length !== expectedTimeframes.length ||
          !savedData.goals.some(g => g.timeframe === 'Beyond')) {
        // Reset goals to correct structure
        savedData.goals = expectedTimeframes.map(timeframe => {
          const existing = savedData.goals.find(g => g.timeframe === timeframe);
          return existing || { timeframe, description: '', notes: '' };
        });
      }
    }
    // Initialize you section if it doesn't exist
    if (!savedData.you) {
      savedData.you = {
        superpowers: [
          { name: 'Technical Skills', description: '', notes: '' },
          { name: 'Business Skills', description: '', notes: '' },
          { name: 'Organization Skills', description: '', notes: '' }
        ],
        mentees: []
      };
    }
    return savedData;
  });
  const [pdfExporting, setPdfExporting] = useState(false);
  const [wordExporting, setWordExporting] = useState(false);
  const [showLearn, setShowLearn] = useState(false);
  const [showIntroLearn, setShowIntroLearn] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [showUploadSuccess, setShowUploadSuccess] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showMentorVideoModal, setShowMentorVideoModal] = useState(false);
  const [showCoachVideoModal, setShowCoachVideoModal] = useState(false);
  const [showGoalsVideoModal, setShowGoalsVideoModal] = useState(false);
  const [showConnectorsVideoModal, setShowConnectorsVideoModal] = useState(false);
  const [showSponsorsVideoModal, setShowSponsorsVideoModal] = useState(false);
  const [showPeersVideoModal, setShowPeersVideoModal] = useState(false);
  const [showBoardVideoModal, setShowBoardVideoModal] = useState(false);
  const [showPodcastModal, setShowPodcastModal] = useState(false);
  const [enhancedModeEnabled, setEnhancedModeEnabled] = useState(false); // Temporarily disabled
  const [boardAdvice, setBoardAdvice] = useState(() => {
    const stored = localStorage.getItem('boardAdvice');
    return stored ? JSON.parse(stored) : null;
  });
  const [boardAdviceLoading, setBoardAdviceLoading] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [accessCode, setAccessCode] = useState('');
  const [authError, setAuthError] = useState('');
  const [writingResultsModal, setWritingResultsModal] = useState({ show: false });
  const [authLoading, setAuthLoading] = useState(false);
  const [showChangeRoleModal, setShowChangeRoleModal] = useState(false);
  const [changeRoleData, setChangeRoleData] = useState({ member: null, oldType: '', memberIndex: -1 });

  // Function to check if a section meets completion criteria
  const getSectionCompletionStatus = () => {
    const status = {};

    // You section: 1 superpower in each of the 3 categories
    if (data.you && data.you.superpowers) {
      const completedSuperpowers = data.you.superpowers.filter(sp => sp.description && sp.description.trim());
      status.you = completedSuperpowers.length >= 3;
    } else {
      status.you = false;
    }

    // Goals: 2 items in 3-month, 2 items in 1-year, 1 item in 5-year (beyond optional)
    if (data.goals) {
      const threeMonth = data.goals.find(g => g.timeframe && g.timeframe.includes('3 Month'));
      const oneYear = data.goals.find(g => g.timeframe && g.timeframe.includes('1 Year'));
      const fiveYear = data.goals.find(g => g.timeframe && g.timeframe.includes('5'));

      // More flexible goal counting - check for meaningful content rather than strict newline counting
      const countGoals = (description) => {
        if (!description || !description.trim()) return 0;
        const text = description.trim();
        // Count by newlines first, but also check for bullet points, numbers, or substantial content
        const lines = text.split('\n').filter(line => line.trim().length > 0);
        const bullets = (text.match(/^\s*[-•*\d+\.]/gm) || []).length;
        const hasSubstantialContent = text.length > 50; // Consider substantial single goal

        // If multiple lines or bullet points, count those
        if (lines.length > 1 || bullets > 1) {
          return Math.max(lines.length, bullets);
        }
        // Otherwise, count as 1 if there's substantial content
        return hasSubstantialContent ? 1 : 0;
      };

      // More lenient goals completion - if user has saved ANY meaningful content in goals, they can proceed
      const hasAnyGoalContent = data.goals.some(goal => {
        return goal.description && goal.description.trim().length > 0;
      });

      status.goals = hasAnyGoalContent;
    } else {
      status.goals = false;
    }

    // Mentors: 2 required
    status.mentors = (data.mentors || []).length >= 2;

    // Coaches: 2 required  
    status.coaches = (data.coaches || []).length >= 2;

    // Connectors: optional (always considered complete for "Start Here" purposes)
    status.connectors = true;

    // Sponsors: 1 required
    status.sponsors = (data.sponsors || []).length >= 1;

    // Peers: 1 required
    status.peers = (data.peers || []).length >= 1;

    return status;
  };

  // Function to determine which section should show "Start Here"
  const getStartHereSection = () => {
    const completionStatus = getSectionCompletionStatus();
    const sectionsOrder = ['you', 'goals', 'mentors', 'coaches', 'sponsors', 'peers', 'connectors'];
    
    // Find the leftmost incomplete section
    for (const section of sectionsOrder) {
      if (!completionStatus[section]) {
        return section;
      }
    }
    
    // If all sections are complete, don't show "Start Here" anywhere
    return null;
  };

  useEffect(() => {
    localStorage.setItem('boardData', JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    if (boardAdvice) {
      localStorage.setItem('boardAdvice', JSON.stringify(boardAdvice));
    }
  }, [boardAdvice]);

  const page = pages.find(p => p.key === current);

  const handleAdd = type => {
    setFormType(type);
    // Initialize editingItem with default form structure for new cards
    const getDefaultForm = () => {
      if (type === 'goals') return { timeframe: '', description: '', notes: '' };
      if (type === 'superpowers') return { name: '', description: '', notes: '' };
      if (type === 'mentees') return { name: '', role: '', connection: 'Not yet', cadence: 'Monthly', notes: '', whatYouTeach: '', whatYouLearn: '' };
      return { name: '', role: '', connection: 'Not yet', cadence: 'Monthly', notes: '', whatToLearn: '', whatTheyGet: '' };
    };
    setEditingItem(getDefaultForm());
    setEditingIndex(null);
    setShowForm(true);
  };

  const getBoardAdvice = async () => {
    // Check if user is authenticated
    if (!isAuthenticated()) {
      setShowAuthModal(true);
      return;
    }
    
    setBoardAdviceLoading(true);
    try {
      const result = await getBoardAnalysisAdvisorGuidance(data);
      setBoardAdvice(result.guidance || result.message || 'No analysis available');
      return result.guidance || result.message || 'No analysis available';
    } catch (error) {
      console.error('Error getting board advice:', error);
      // If auth error, return generic advice
      if (error.message?.includes('Authentication')) {
        const genericAdvice = getGenericBoardAdvice();
        setBoardAdvice(genericAdvice);
        return genericAdvice;
      }
      const errorMsg = 'Sorry, there was an error getting analysis. Please try again later.';
      setBoardAdvice(errorMsg);
      return errorMsg;
    } finally {
      setBoardAdviceLoading(false);
    }
  };
  
  const getGenericBoardAdvice = () => {
    return `🎯 Taking Action with Your Personal Board

Your Personal Board of Directors is only as valuable as the relationships you cultivate and maintain. Here are key strategies for maximizing impact:

📅 Establish Regular Cadence
• Set recurring meetings aligned with each member's suggested frequency
• Prepare specific questions and updates for each interaction
• Respect their time by being organized and focused
• Follow up on advice received and report back on outcomes

🔄 Continuously Refine Your Board
• Regularly assess if current members align with your evolving goals
• Add new members as you enter different career phases
• Gracefully transition relationships when priorities shift
• Keep connections warm even when not actively engaged

💡 Make Engagements Impactful
• Come prepared with specific challenges or decisions
• Share wins and progress to maintain engagement
• Offer value in return - share insights, make introductions
• Be authentic and vulnerable to build deeper connections

📈 Track and Measure Progress
• Document advice received and actions taken
• Review your board composition quarterly
• Celebrate milestones achieved with their support
• Adjust your approach based on what's working

✨ Remember: The most successful boards are built on mutual value exchange, consistent engagement, and genuine relationships. Your board members want to see you succeed - honor their investment with thoughtful action and regular communication.

💼 For personalized AI-powered analysis and recommendations tailored to your specific board composition and goals, attend a facilitated workshop where you'll receive an access code to unlock advanced features.`;
  };

  const handleEdit = (type, item, index) => {
    setFormType(type);
    setEditingItem(item);
    setEditingIndex(index);
    setShowForm(true);
  };

  const handleDelete = (type, index) => {
    setData(prev => {
      // Handle nested structure for "You" section
      if (type === 'mentees') {
        const you = { ...prev.you };
        you.mentees = [...you.mentees];
        you.mentees.splice(index, 1);
        return { ...prev, you };
      }
      // Handle regular sections
      const list = [...prev[type]];
      list.splice(index, 1);
      return { ...prev, [type]: list };
    });
  };

  const handleChangeRoleClick = (oldType, member, memberIndex) => {
    setChangeRoleData({ member, oldType, memberIndex });
    setShowChangeRoleModal(true);
  };

  const handleChangeRole = (newType) => {
    const { member, oldType, memberIndex } = changeRoleData;

    if (oldType === newType) {
      // No change needed
      setShowChangeRoleModal(false);
      return;
    }

    setData(prev => {
      // Remove from old type
      const oldList = [...prev[oldType]];
      oldList.splice(memberIndex, 1);

      // Add to new type
      const newList = [...(prev[newType] || [])];
      newList.push(member);

      return {
        ...prev,
        [oldType]: oldList,
        [newType]: newList
      };
    });

    setShowChangeRoleModal(false);
    setChangeRoleData({ member: null, oldType: '', memberIndex: -1 });
  };

  const saveEntry = entry => {
    setData(prev => {
      // Handle nested structure for "You" section
      if (formType === 'superpowers' || formType === 'mentees') {
        const you = { ...prev.you };
        if (editingIndex !== null) {
          // Update existing entry
          you[formType] = [...you[formType]];
          you[formType][editingIndex] = entry;
        } else {
          // Add new entry (only for mentees, superpowers are fixed)
          if (formType === 'mentees') {
            you.mentees = you.mentees ? [...you.mentees, entry] : [entry];
          }
        }
        return { ...prev, you };
      }

      // Handle regular sections
      if (editingIndex !== null) {
        // Update existing entry
        const list = [...prev[formType]];
        list[editingIndex] = entry;
        return { ...prev, [formType]: list };
      } else {
        // Add new entry
        const list = prev[formType] ? [...prev[formType], entry] : [entry];
        return { ...prev, [formType]: list };
      }
    });
    setShowForm(false);
    setEditingItem(null);
    setEditingIndex(null);
  };

  const handleAuthentication = async () => {
    setAuthLoading(true);
    setAuthError('');

    try {
      await validateAccessCode(accessCode);
      setShowAuthModal(false);
      setAccessCode('');
      // Show success message
      alert('Access code activated successfully! You now have access to AI-powered guidance.');
    } catch (error) {
      console.error('Authentication error:', error);
      setAuthError(error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const requireAuthentication = (callback) => {
    if (!isAuthenticated()) {
      setShowAuthModal(true);
      return false;
    }
    return callback();
  };

  // JSON validation functions
  const validateBoardData = (data) => {
    const errors = [];
    const warnings = [];

    // Validate 'you' section structure
    if (data.you) {
      if (data.you.superpowers && !Array.isArray(data.you.superpowers)) {
        errors.push("'you.superpowers' must be an array");
      }

      // Check for misplaced superpowers at top level (common error)
      if (data.superpowers && Array.isArray(data.superpowers)) {
        warnings.push("'superpowers' found at top level - should be under 'you' section");
        // Auto-fix: move superpowers to correct location
        if (!data.you.superpowers) {
          data.you.superpowers = data.superpowers;
          delete data.superpowers;
          warnings.push("Auto-fixed: moved 'superpowers' to 'you.superpowers'");
        }
      }
    }

    // Validate array sections
    const arraySections = ['goals', 'mentors', 'coaches', 'sponsors', 'connectors', 'peers'];
    arraySections.forEach(section => {
      if (data[section] && !Array.isArray(data[section])) {
        errors.push(`'${section}' must be an array`);
      }
    });

    return { isValid: errors.length === 0, errors, warnings, fixedData: data };
  };

  const handleUpload = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const backupData = JSON.parse(ev.target.result);
        let dataToImport;
        let validationMessages = [];

        // Handle both old format (direct data) and new format (comprehensive backup)
        if (backupData.version && backupData.boardData) {
          // New comprehensive backup format
          dataToImport = backupData.boardData;



        } else {
          // Legacy format (just board data)
          dataToImport = backupData;
        }

        // Validate the data structure
        const validation = validateBoardData(dataToImport);

        if (validation.isValid) {
          clearWritingDrafts(sessionStorage);
          setBoardAdvice(typeof backupData.boardAdvice === 'string' ? backupData.boardAdvice : '');
          localStorage.removeItem('boardAdvice');
          setData(validation.fixedData);
          let successMessage = 'Backup imported successfully!';

          if (validation.warnings.length > 0) {
            successMessage += '\n\nNotes:\n' + validation.warnings.map(w => `• ${w}`).join('\n');
            console.log('Import warnings:', validation.warnings);
          }

          alert(successMessage);
          setShowUploadSuccess(true);
          setTimeout(() => setShowUploadSuccess(false), 3000);
        } else {
          // Show detailed error message
          const errorMessage = [
            'Import failed due to data structure issues:',
            '',
            ...validation.errors.map(e => `• ${e}`),
            '',
            'Please fix these issues in the JSON file and try again.'
          ].join('\n');

          alert(errorMessage);
          console.error('Import validation errors:', validation.errors);
        }

      } catch (err) {
        console.error('JSON parse error:', err);
        alert('Invalid backup file. Please select a valid JSON file.\n\nError: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const downloadJSON = () => {
    // Back up board content only. Authentication belongs to this browser session.
    const backupData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      boardData: data,
      boardAdvice: boardAdvice
    };
    
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'personal-board-backup.json';
    a.click();
  };

  const downloadPDF = async () => {
    if (pdfExporting) return;
    setPdfExporting(true);
    try {
      // Load the renderer only when exporting. This never invokes AI.
      const { buildBoardReport } = await import('./board-report.js');
      await buildBoardReport(data, boardAdvice).save('personal-board.pdf', { returnPromise: true });
    } catch {
      alert('The PDF could not be created. Your board is safe. Please try again.');
    } finally {
      setPdfExporting(false);
    }
  };

  // Editable copy of the same report for Word, Pages or Google Docs. Never invokes AI.
  const downloadWord = async () => {
    if (wordExporting) return;
    setWordExporting(true);
    try {
      const { boardReportDocxBlob } = await import('./board-report-docx.js');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(await boardReportDocxBlob(data, boardAdvice));
      a.download = 'personal-board.docx';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    } catch {
      alert('The Word document could not be created. Your board is safe. Please try again.');
    } finally {
      setWordExporting(false);
    }
  };
  
  // Helper function to calculate meeting months based on cadence
  const getMeetingMonths = (cadence) => {
    switch(cadence) {
      case 'Daily':
        return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
      case 'Weekly':
        return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
      case 'Bi-weekly':
        return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
      case 'Monthly':
        return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
      case 'Quarterly':
        return [0, 3, 6, 9];
      case 'Annually':
        return [5]; // June
      case 'Ad-hoc':
        return [2, 7]; // March and August as examples
      default:
        return [];
    }
  };

  const reset = () => {
    // Create a fresh data structure with blank superpowers and goals but preserve structure
    const freshData = {
      you: {
        superpowers: [
          { name: 'Technical Skills', description: '', notes: '' },
          { name: 'Business Skills', description: '', notes: '' },
          { name: 'Organization Skills', description: '', notes: '' }
        ],
        mentees: []
      },
      goals: [
        { timeframe: '3 Months (Immediate Goals)', description: '', notes: '' },
        { timeframe: '1 Year Goals', description: '', notes: '' },
        { timeframe: '5+ Year Goals (Long-term Vision)', description: '', notes: '' },
        { timeframe: 'Beyond', description: '', notes: '' }
      ]
    };
    
    clearWritingDrafts(sessionStorage);
    setBoardAdvice('');
    localStorage.removeItem('boardAdvice');
    setData(freshData);
    localStorage.setItem('boardData', JSON.stringify(freshData));
    setCurrent('intro');
  };

  return (
    <div className="app" style={{ backgroundImage: `url(${page.image})` }}>
      <input type="file" id="upload" accept="application/json" style={{ display: 'none' }} onChange={handleUpload} />

      {/* Top bar with centered title and right-side buttons */}
      <div className="app-topbar" style={{
        position: 'fixed',
        top: '20px',
        left: '0',
        right: '0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 20px',
        zIndex: 100
      }}>
        {/* Left side spacer to balance layout */}
        <div style={{ width: '160px' }}></div>

        {/* Centered page title */}
        {current !== 'intro' && (
          <h1 className="page-title" style={{
            fontSize: '2.5rem',
            fontWeight: 'bold',
            color: (current === 'coaches' || current === 'sponsors') ? '#ffffff' : '#4A90E2',
            margin: '0',
            textTransform: 'capitalize',
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            textShadow: (current === 'coaches' || current === 'sponsors') ? '2px 2px 4px rgba(0,0,0,0.8)' : '1px 1px 3px rgba(0,0,0,0.3)'
          }}>
            {current === 'you' ? 'You' :
             current === 'goals' ? 'Goals' :
             current === 'mentors' ? 'Mentors' :
             current === 'coaches' ? 'Coaches' :
             current === 'sponsors' ? 'Sponsors' :
             current === 'connectors' ? 'Connectors' :
             current === 'peers' ? 'Peers' :
             current === 'board' ? 'Board' : ''}
          </h1>
        )}

        {/* Right side buttons */}
        <div className="topbar-actions" style={{ display: 'flex', gap: '12px' }}>
          <BottomTooltip text="Import a backup *.json file to restore previously saved board data">
            <button onClick={() => document.getElementById('upload').click()}>Upload</button>
          </BottomTooltip>
          <BottomTooltip text="Clear all data and start with a fresh board">
            <button onClick={reset}>Start New</button>
          </BottomTooltip>
        </div>
      </div>

      <Quote text={page.quote} position={page.quotePosition} />
      {current !== 'intro' && current !== 'board' && (
        <div className="actions">
          {/* Action buttons moved below */}
          {(current === 'you' || current === 'goals' || current === 'mentors' || current === 'coaches' || current === 'connectors' || current === 'sponsors' || current === 'peers') && (
            <BottomTooltip text="Watch video tutorial for this section">
              <button 
                onClick={() => {
                  if (current === 'goals') setShowGoalsVideoModal(true);
                  else if (current === 'mentors') setShowMentorVideoModal(true);
                  else if (current === 'coaches') setShowCoachVideoModal(true);
                  else if (current === 'connectors') setShowConnectorsVideoModal(true);
                  else if (current === 'sponsors') setShowSponsorsVideoModal(true);
                  else if (current === 'peers') setShowPeersVideoModal(true);
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  marginRight: '10px',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = '#dc2626'}
                onMouseOut={(e) => e.target.style.backgroundColor = '#ef4444'}
              >
                Video
              </button>
            </BottomTooltip>
          )}
          <BottomTooltip text="Learn about this board member type and best practices">
            <button onClick={() => setShowLearn(true)}>Learn</button>
          </BottomTooltip>
          {current !== 'you' && current !== 'goals' && (
            <BottomTooltip text="Add a new board member to this category">
              <button onClick={() => handleAdd(current)}>+ Add</button>
            </BottomTooltip>
          )}
          {current === 'you' && (
            <BottomTooltip text="Add a new mentee you're advising">
              <button onClick={() => handleAdd('mentees')}>+ Add Mentee</button>
            </BottomTooltip>
          )}
        </div>
      )}
      {current === 'board' && (
        <div className="board-actions">
          <BottomTooltip text="Watch video about your complete board">
            <button
              onClick={() => setShowBoardVideoModal(true)}
              style={{
                padding: '10px 20px',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                marginRight: '10px',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#dc2626'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#ef4444'}
            >
              Video
            </button>
          </BottomTooltip>
          <BottomTooltip text="Analyze your entire board composition and get strategic recommendations">
            <button
              onClick={getBoardAdvice}
              style={{
                backgroundColor: '#10b981',
                color: 'white'
              }}
            >
              Analyze Board
            </button>
          </BottomTooltip>
          <BottomTooltip text="Create a backup *.json file of your board data">
            <button onClick={downloadJSON}>Download Backup</button>
          </BottomTooltip>
          <BottomTooltip text="Generate a PDF report of your board and goals">
            <button onClick={downloadPDF} disabled={pdfExporting} aria-busy={pdfExporting}>{pdfExporting ? 'Preparing PDF…' : 'Download PDF'}</button>
          </BottomTooltip>
          <BottomTooltip text="Download an editable Word version of the report">
            <button onClick={downloadWord} disabled={wordExporting} aria-busy={wordExporting}>{wordExporting ? 'Preparing Word…' : 'Download Word'}</button>
          </BottomTooltip>
        </div>
      )}
      <div className={current === 'board' ? 'content report-content' : 'content'}>
        {current === 'intro' ? <Intro onLearnClick={() => setShowIntroLearn(true)} onVideoClick={() => setShowVideoModal(true)} onPodcastClick={() => setShowPodcastModal(true)} /> : current === 'you' ? <You data={data.you || {superpowers: [], mentees: []}} onEdit={handleEdit} onDelete={handleDelete} onUpdateData={(updatedYouData) => { setData({...data, you: updatedYouData}); localStorage.setItem('boardData', JSON.stringify({...data, you: updatedYouData})); }} /> : current === 'goals' ? <Goals items={data[current] || []} onEdit={handleEdit} /> : current === 'board' ? <Board data={data} boardAdvice={boardAdvice} boardAdviceLoading={boardAdviceLoading} /> : current === 'mentors' ? <List type={current} items={data[current] || []} onEdit={handleEdit} onDelete={handleDelete} onChangeRole={handleChangeRoleClick} /> : current === 'coaches' ? <List type={current} items={data[current] || []} onEdit={handleEdit} onDelete={handleDelete} onChangeRole={handleChangeRoleClick} /> : <List type={current} items={data[current] || []} onEdit={handleEdit} onDelete={handleDelete} onChangeRole={handleChangeRoleClick} />}
      </div>
      <nav className="nav" aria-label="Board sections">
        {pages.map(p => {
          const count = p.key === 'intro' || p.key === 'board' || p.key === 'goals' || p.key === 'you' ? 0 : (data[p.key] || []).length;
          const showCount = p.key !== 'intro' && p.key !== 'board' && p.key !== 'goals' && p.key !== 'you';
          const startHereSection = getStartHereSection();
          const completionStatus = getSectionCompletionStatus();
          const showCheckmark = (p.key === 'you' && completionStatus.you) || (p.key === 'goals' && completionStatus.goals);
          
          const tooltipText = 
            p.key === 'intro' ? 'Introduction to Personal Board of Directors' :
            p.key === 'you' ? 'Define your superpowers and mentoring relationships' :
            p.key === 'goals' ? 'Set your career goals and objectives' :
            p.key === 'mentors' ? 'Add senior advisors who provide wisdom and guidance' :
            p.key === 'coaches' ? 'Add skilled practitioners who help build specific competencies' :
            p.key === 'sponsors' ? 'Add influential advocates who champion your advancement' :
            p.key === 'connectors' ? 'Add well-networked individuals who expand your reach' :
            p.key === 'peers' ? 'Add colleagues who provide mutual support and perspectives' :
            p.key === 'board' ? 'View your complete board and timeline visualization' : '';
            
          return (
            <Tooltip key={p.key} text={tooltipText}>
              <button className={[p.key === current ? 'active' : '', p.key === startHereSection ? 'next-step' : ''].filter(Boolean).join(' ')} aria-current={p.key === current ? 'page' : undefined} onClick={() => {
                setCurrent(p.key);
                setShowForm(false);
                setFormType(''); // Reset formType when navigating
              }}>
                <span className="nav-title">{p.title}</span>
                {showCount && (
                  <span className="nav-count">{count}</span>
                )}
                {showCheckmark && (
                  <span className="nav-count" style={{ backgroundColor: '#2563eb' }}>✓</span>
                )}
                {p.key === startHereSection && (
                  <div className="start-here-arrow">
                    <div className="start-here-text">Next Step</div>
                    <svg className="arrow-svg" viewBox="0 0 24 24" width="24" height="24">
                      <path 
                        d="M7 10l5 5 5-5z" 
                        fill="#2563eb"
                      />
                    </svg>
                  </div>
                )}
              </button>
            </Tooltip>
          );
        })}
      </nav>
      {showLearn && <LearnModal type={current} onClose={() => setShowLearn(false)} onAddClick={() => { setShowLearn(false); handleAdd(current); }} />}
      {showIntroLearn && <IntroLearnModal onClose={() => setShowIntroLearn(false)} />}
      {showForm && <FormModal type={formType} item={editingItem} onSave={saveEntry} onClose={() => setShowForm(false)} boardData={data} onFormUpdate={setEditingItem} onWritingModalUpdate={setWritingResultsModal} entryIndex={editingIndex} writingResultsShowing={writingResultsModal.show} />}
      {showUploadSuccess && <UploadSuccessPopup />}
      {showVideoModal && <VideoModal onClose={() => setShowVideoModal(false)} />}
      {showPodcastModal && <PodcastModal onClose={() => setShowPodcastModal(false)} />}
      {showMentorVideoModal && <MentorVideoModal onClose={() => setShowMentorVideoModal(false)} />}
      {showCoachVideoModal && <CoachVideoModal onClose={() => setShowCoachVideoModal(false)} />}
      {showGoalsVideoModal && <GoalsVideoModal onClose={() => setShowGoalsVideoModal(false)} />}
      {showConnectorsVideoModal && <ConnectorsVideoModal onClose={() => setShowConnectorsVideoModal(false)} />}
      {showSponsorsVideoModal && <SponsorsVideoModal onClose={() => setShowSponsorsVideoModal(false)} />}
      {showPeersVideoModal && <PeersVideoModal onClose={() => setShowPeersVideoModal(false)} />}
      {showBoardVideoModal && <BoardVideoModal onClose={() => setShowBoardVideoModal(false)} />}
      {showAuthModal && <AuthModal
        accessCode={accessCode}
        setAccessCode={setAccessCode}
        onAuthenticate={handleAuthentication}
        onClose={() => {
          setShowAuthModal(false);
          setAccessCode('');
          setAuthError('');
        }}
        error={authError}
        loading={authLoading}
      />}

      {showChangeRoleModal && <ChangeRoleModal
        member={changeRoleData.member}
        oldType={changeRoleData.oldType}
        onChangeRole={handleChangeRole}
        onClose={() => setShowChangeRoleModal(false)}
      />}

      <WritingResultsModal
        modal={writingResultsModal}
        onClose={() => setWritingResultsModal({ show: false })}
      />

      <FeedbackButton />
    </div>
  );
}

function Quote({ text, position = 'center' }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(timer);
  }, [text]);
  return <div className={`quote quote-${position} ${visible ? 'fade-in' : 'fade-out'}`}>{text}</div>;
}

function Intro({ onLearnClick, onVideoClick, onPodcastClick }) {
  const introQuotes = [
    "You are not just building your résumé. You're building your support system.",
    "Success is not a solo journey. Build your board.",
    "Great leaders surround themselves with great advisors.",
    "Your network is your net worth, but your board is your compass.",
    "Behind every great achievement is a great support system.",
    "Careers are not ladders. They are constellations and you need the right stars to guide you."
  ];

  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsVisible(false);
      
      setTimeout(() => {
        setCurrentQuoteIndex((prevIndex) => (prevIndex + 1) % introQuotes.length);
        setIsVisible(true);
      }, 500); // Half second fade out before changing
    }, 4000); // Change quote every 4 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="intro-text">
      <h1>Build Your Personal Board</h1>
      <div className={`intro-quote ${isVisible ? 'fade-in' : 'fade-out'}`}>
        {introQuotes[currentQuoteIndex]}
      </div>
      <div className="intro-actions" style={{marginTop: '30px', display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap'}}>
        <button 
          onClick={onLearnClick}
          style={{
            padding: '12px 24px',
            backgroundColor: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => e.target.style.backgroundColor = '#1d4ed8'}
          onMouseOut={(e) => e.target.style.backgroundColor = '#2563eb'}
        >
          Learn About Personal Boards
        </button>
        <button 
          onClick={onVideoClick}
          style={{
            padding: '12px 24px',
            backgroundColor: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => e.target.style.backgroundColor = '#dc2626'}
          onMouseOut={(e) => e.target.style.backgroundColor = '#ef4444'}
        >
          Watch Video
        </button>
        <button
          onClick={onPodcastClick}
          style={{
            padding: '12px 24px',
            backgroundColor: '#8b5cf6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => e.target.style.backgroundColor = '#7c3aed'}
          onMouseOut={(e) => e.target.style.backgroundColor = '#8b5cf6'}
        >
          🎧 Listen to Podcast
        </button>
      </div>
    </div>
  );
}

function Goals({ items, onEdit }) {
  const getGoalTooltip = (timeframe) => {
    switch (timeframe) {
      case '3 Months (Immediate Goals)':
        return 'Add at least 2 specific, actionable goals you can achieve in the next 3 months. Focus on immediate priorities and quick wins.';
      case '1 Year Goals':
        return 'Add at least 2 medium-term goals for the next 12 months. These should build toward your longer-term vision.';
      case '5+ Year Goals (Long-term Vision)':
        return 'Add at least 1 long-term aspirational goal for the next 5 years. Think big picture and transformational outcomes.';
      case 'Beyond':
        return 'Optional: Add visionary goals beyond 5 years. What legacy do you want to create?';
      default:
        return 'Click edit to add your goals with specific timeframes and action items.';
    }
  };

  return (
    <div className="list">
      {items.map((item, idx) => (
        <Tooltip key={idx} text={getGoalTooltip(item.timeframe)}>
          <div className="card">
            <div className="card-header">
              <h3>{item.timeframe}</h3>
              <div className="card-actions">
                <button className="icon-btn edit-btn" onClick={() => onEdit('goals', item, idx)} title="Edit">
                  <img
                    src="./images/icons/pencil.png"
                    alt="Edit"
                    style={{
                      width: '16px',
                      height: '16px',
                      filter: 'brightness(0) saturate(100%) invert(42%) sepia(93%) saturate(1352%) hue-rotate(205deg) brightness(98%) contrast(85%)'
                    }}
                  />
                </button>
                {/* No delete button for goals */}
              </div>
            </div>
            <p><strong>Description:</strong> {item.description || 'Click edit to add your goals...'}</p>
            <p><strong>Notes:</strong> {item.notes || 'Add notes about your progress or strategy...'}</p>
          </div>
        </Tooltip>
      ))}
    </div>
  );
}

function You({ data, onEdit, onDelete, onUpdateData }) {
  const [userName, setUserName] = useState(data.name || 'Your Name');
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(userName);

  const handleNameClick = () => {
    setIsEditingName(true);
    setTempName(userName);
  };

  const handleNameSave = () => {
    setUserName(tempName);
    onUpdateData({ ...data, name: tempName });
    setIsEditingName(false);
  };

  const handleNameCancel = () => {
    setTempName(userName);
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleNameSave();
    } else if (e.key === 'Escape') {
      handleNameCancel();
    }
  };

  return (
    <div className="you-section">
      {/* User Name Title */}
      <div style={{
        textAlign: 'center',
        marginTop: '10px',
        marginBottom: '15px'
      }}>
        {isEditingName ? (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onKeyDown={handleNameKeyDown}
              onBlur={handleNameSave}
              autoFocus
              style={{
                fontSize: '28px',
                fontWeight: 'bold',
                color: '#1f2937',
                border: '2px solid #10b981',
                borderRadius: '8px',
                padding: '5px 10px',
                outline: 'none',
                textAlign: 'center'
              }}
            />
          </div>
        ) : (
          <BottomTooltip text="Add your name here">
            <div
              onClick={handleNameClick}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                padding: '5px 10px',
                borderRadius: '8px',
                transition: 'background-color 0.2s',
                ':hover': { backgroundColor: '#f3f4f6' }
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#f3f4f6'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
            >
              <h1 style={{
                fontSize: '28px',
                fontWeight: 'bold',
                color: '#1f2937'
              }}>
                {userName}
              </h1>
              <img
                src="./images/icons/pencil.png"
                alt="Edit"
                style={{
                  width: '20px',
                  height: '20px',
                  filter: 'brightness(0) saturate(100%) invert(42%) sepia(93%) saturate(1352%) hue-rotate(205deg) brightness(98%) contrast(85%)',
                  cursor: 'pointer'
                }}
              />
            </div>
          </BottomTooltip>
        )}
      </div>

      {/* Superpowers Row */}
      <div className="section-row">
        <h2 style={{color: '#10b981', marginBottom: '16px', borderBottom: '2px solid #10b981', paddingBottom: '8px', fontSize: '24px', fontWeight: 'bold'}}>Your Superpowers</h2>
        <div className="list">
          {data.superpowers && data.superpowers.map((item, idx) => {
            const getSkillTooltip = (skillCategory) => {
              switch (skillCategory) {
                case 'Technical Skills':
                  return 'Programming, tools, platforms, methodologies. Examples: Python, AWS, React.';
                case 'Business Skills':
                  return 'Industry expertise and domain knowledge. Examples: Healthcare, fintech, e-commerce.';
                case 'Organization Skills':
                  return 'Leadership and management abilities. Examples: Public speaking, project management.';
                default:
                  return 'Add skills with proficiency levels and examples.';
              }
            };
            
            return (
              <WideTooltip key={idx} text={getSkillTooltip(item.name)}>
                <div className="card superpower-card">
                  <div className="card-header">
                    <h3>{item.name}</h3>
                    <div className="card-actions">
                      <button className="icon-btn edit-btn" onClick={() => onEdit('superpowers', item, idx)} title="Edit">
                        <img
                          src="./images/icons/pencil.png"
                          alt="Edit"
                          style={{
                            width: '16px',
                            height: '16px',
                            filter: 'brightness(0) saturate(100%) invert(42%) sepia(93%) saturate(1352%) hue-rotate(205deg) brightness(98%) contrast(85%)'
                          }}
                        />
                      </button>
                      {/* No delete button for superpowers - they're fixed */}
                    </div>
                  </div>
                  <p><strong>Description:</strong> {item.description || 'Click edit to describe your skills...'}</p>
                  <p><strong>Notes:</strong> {item.notes || 'Add examples or specific details...'}</p>
                </div>
              </WideTooltip>
            );
          })}
        </div>
      </div>

      {/* Mentees Row */}
      <div className="section-row">
        <h2 style={{color: '#8b5cf6', marginBottom: '16px', borderBottom: '2px solid #8b5cf6', paddingBottom: '8px', fontSize: '24px', fontWeight: 'bold'}}>Your Mentees</h2>
        <div className="list">
          {data.mentees && data.mentees.map((item, idx) => (
            <div key={idx} className="card mentee-card">
              <div className="card-header">
                <h3>{item.name}</h3>
                <div className="card-actions">
                  <button className="icon-btn edit-btn" onClick={() => onEdit('mentees', item, idx)} title="Edit">
                    <img
                      src="./images/icons/pencil.png"
                      alt="Edit"
                      style={{
                        width: '16px',
                        height: '16px',
                        filter: 'brightness(0) saturate(100%) invert(42%) sepia(93%) saturate(1352%) hue-rotate(205deg) brightness(98%) contrast(85%)'
                      }}
                    />
                  </button>
                  <button className="icon-btn delete-btn" onClick={() => onDelete('mentees', idx)} title="Delete">
                    🗑️
                  </button>
                </div>
              </div>
              <p><strong>Role:</strong> {item.role}</p>
              <p><strong>Connection:</strong> {item.connection}</p>
              <p><strong>Cadence:</strong> {item.cadence}</p>
              {item.whatYouTeach && (
                <p><strong>What You Teach Them:</strong> {item.whatYouTeach}</p>
              )}
              {item.whatYouLearn && (
                <p><strong>What You Learn From Them:</strong> {item.whatYouLearn}</p>
              )}
              {item.notes && (
                <p><strong>Notes:</strong> {item.notes}</p>
              )}
            </div>
          ))}
          {(!data.mentees || data.mentees.length === 0) && (
            <div className="empty-state">
              <p>No mentees yet. Click "Add" to add someone you're advising.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function List({ type, items, onEdit, onDelete, onChangeRole }) {
  return (
    <div className="list">
      {items.map((item, idx) => (
        <div key={idx} className="card">
          <div className="card-header">
            <h3>{item.name}</h3>
            <div className="card-actions">
              <Tooltip text="Edit">
                <button className="icon-btn edit-btn" onClick={() => onEdit(type, item, idx)}>
                  <img
                    src="./images/icons/pencil.png"
                    alt="Edit"
                    style={{
                      width: '16px',
                      height: '16px',
                      filter: 'brightness(0) saturate(100%) invert(42%) sepia(93%) saturate(1352%) hue-rotate(205deg) brightness(98%) contrast(85%)'
                    }}
                  />
                </button>
              </Tooltip>
              <Tooltip text="Change Role">
                <button className="icon-btn change-role-btn" onClick={() => onChangeRole(type, item, idx)}>
                  🔄
                </button>
              </Tooltip>
              <Tooltip text="Delete">
                <button className="icon-btn delete-btn" onClick={() => onDelete(type, idx)}>
                  🗑️
                </button>
              </Tooltip>
            </div>
          </div>
          <p><strong>Role:</strong> {item.role}</p>
          <p><strong>Connection:</strong> {item.connection}</p>
          <p><strong>Cadence:</strong> {item.cadence}</p>
          {item.whatToLearn && (
            <p><strong>What to Learn:</strong> {item.whatToLearn}</p>
          )}
          {item.whatTheyGet && (
            <p><strong>What They Get:</strong> {item.whatTheyGet}</p>
          )}
          {item.notes && (
            <p><strong>Notes:</strong> {item.notes}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function Board({ data, boardAdvice, boardAdviceLoading }) {
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'cards'

  const memberGroups = getBoardGroups(data);
  const allMembers = memberGroups.flatMap(group => group.members.map(person => ({ ...person, type: group.key })));

  // Define positions around the table - closer and within view
  const positions = [
    { top: '10%', left: '50%', transform: 'translateX(-50%)' }, // 12 o'clock (top center)
    { top: '15%', right: '15%', transform: 'none' }, // 1 o'clock
    { top: '30%', right: '8%', transform: 'none' }, // 2 o'clock
    { top: '50%', right: '5%', transform: 'translateY(-50%)' }, // 3 o'clock (right)
    { top: '70%', right: '8%', transform: 'none' }, // 4 o'clock
    { bottom: '15%', right: '15%', transform: 'none' }, // 5 o'clock
    { bottom: '10%', right: '35%', transform: 'none' }, // 6 o'clock right
    { bottom: '10%', left: '35%', transform: 'none' }, // 6 o'clock left
    { bottom: '15%', left: '15%', transform: 'none' }, // 7 o'clock
    { top: '70%', left: '8%', transform: 'none' }, // 8 o'clock
    { top: '50%', left: '5%', transform: 'translateY(-50%)' }, // 9 o'clock (left)
    { top: '30%', left: '8%', transform: 'none' }, // 10 o'clock
    { top: '15%', left: '15%', transform: 'none' }, // 11 o'clock
    { top: '20%', right: '25%', transform: 'none' }, // Additional position
    { top: '20%', left: '25%', transform: 'none' }, // Additional position
  ];
  
  // Define text alignment for each type
  const getTextAlignment = (type) => {
    switch(type) {
      case 'mentors':
        return 'text-bottom-right';
      case 'coaches':
        return 'text-bottom-left';
      case 'sponsors':
        return 'text-bottom-right';
      case 'peers':
        return 'text-bottom-right';
      case 'connectors':
      default:
        return 'text-bottom-center';
    }
  };

  // Helper function to calculate meeting months based on cadence
  const getMeetingMonths = (cadence) => {
    switch(cadence) {
      case 'Daily':
      case 'Weekly':
      case 'Bi-weekly':
      case 'Monthly':
        return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
      case 'Quarterly':
        return [0, 3, 6, 9];
      case 'Annually':
        return [5]; // June
      case 'Ad-hoc':
        return [2, 7]; // March and August as examples
      default:
        return [];
    }
  };

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const colors = {
    mentors: '#10b981',
    coaches: '#3b82f6',
    connectors: '#f59e0b',
    sponsors: '#8b5cf6',
    peers: '#ef4444'
  };

  return (
    <div className="board-container">
      <section className="report-overview" aria-label="Board report overview">
        <span className="report-kicker">YOUR PERSONAL BOARD OF DIRECTORS</span>
        <h2>{data.you?.name ? `${data.you.name}'s growth plan` : 'Your people. Your direction.'}</h2>
        <p>The relationships, strengths, and goals that help you move forward.</p>
        <div className="report-metrics">
          <div><strong>{allMembers.length}</strong><span>Board members</span></div>
          <div><strong>{REPORT_ROLES.filter(role => data[role.key]?.length).length}<small> / 5</small></strong><span>Roles represented</span></div>
          <div><strong>{(data.goals || []).filter(goal => goal.description?.trim() || goal.notes?.trim()).length}</strong><span>Goals defined</span></div>
        </div>
        <div className="report-role-key">{REPORT_ROLES.map(role => <span key={role.key}><i style={{backgroundColor:`rgb(${role.color.join(',')})`}} />{role.name}<b>{data[role.key]?.length || 0}</b></span>)}</div>
      </section>

      {/* Board Analysis Advice */}
      {(boardAdvice || boardAdviceLoading) && (
        <section className="board-advice-section report-insights">
          <div className="report-insights-heading">
            <span className="report-kicker">YOUR BOARD / STRATEGIC REFLECTION</span>
            <h2>Board insights</h2>
            <p>A clearer view of your relationships, opportunities, and next steps.</p>
          </div>
          {boardAdviceLoading ? (
            <div style={{ color: '#6b7280' }}>Generating analysis...</div>
          ) : (
            <SafeMarkdown text={boardAdvice} />
          )}
        </section>
      )}
      
      <section className="report-cadence" aria-label="Meeting cadence">
        <span className="report-kicker">KEEP THE CONVERSATION GOING</span>
        <h2>Your meeting rhythm</h2>
        {allMembers.length ? <div className="report-table-scroll"><table>
          <thead><tr><th scope="col">Person</th><th scope="col">Board role</th><th scope="col">Meeting cadence</th></tr></thead>
          <tbody>{allMembers.map((member,index)=><tr key={`${member.type}-${index}`}><th scope="row">{member.name || 'Unnamed member'}</th><td><span className="report-role-dot" style={{backgroundColor:colors[member.type]}} />{REPORT_ROLES.find(role=>role.key===member.type)?.name}</td><td>{member.cadence || 'Not set'}</td></tr>)}</tbody>
        </table></div> : <p>Add your first board member to start planning a rhythm for staying connected.</p>}
      </section>
      <div className="report-view-controls" aria-label="Board view">
        <h2>The people in your corner</h2>
        <div><button aria-pressed={viewMode==='table'} onClick={()=>setViewMode('table')}>Board view</button><button aria-pressed={viewMode==='cards'} onClick={()=>setViewMode('cards')}>Member details</button></div>
      </div>
      {/* Board Views - Toggle between table and cards */}
      {viewMode === 'table' ? (
        <div
          className="board-diagram"

        >
          <div className="board-table">
            <div className="table-label">{data.you?.name ? `${data.you.name}'s Board` : 'Your Board'}</div>
          </div>
          {allMembers.map((member, idx) => {
            const pos = positions[idx % positions.length];
            const textAlign = getTextAlignment(member.type);
            return (
              <div
                key={idx}
                className={`board-member ${member.type} ${textAlign}`}
                style={pos}
              >
                <div className="member-type">{member.type === 'coaches' ? 'coach' : member.type.slice(0, -1)}</div>
                <div className="member-name">{member.name}</div>
                <div className="member-role">{member.role}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <div
          className="board-cards-view"

        >
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: '#1f2937',
            marginBottom: '20px',
            textAlign: 'center'
          }}>
            {data.you?.name ? `${data.you.name}'s Board` : 'Your Board'} - Card View
          </h2>

          <div className="board-cards-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '20px',
            marginBottom: '30px'
          }}>
            {/* Group members by type */}
            {['mentors', 'coaches', 'sponsors', 'connectors', 'peers'].map(type => {
              const typeMembers = allMembers.filter(m => m.type === type);
              if (typeMembers.length === 0) return null;

              return (
                <div key={type} className="board-type-section">
                  <h3 style={{
                    fontSize: '1.2rem',
                    fontWeight: '600',
                    color: colors[type],
                    marginBottom: '15px',
                    textTransform: 'capitalize',
                    borderBottom: `2px solid ${colors[type]}`,
                    paddingBottom: '5px'
                  }}>
                    {type === 'coaches' ? 'Coaches' : type.charAt(0).toUpperCase() + type.slice(1)}
                  </h3>

                  {typeMembers.map((member, idx) => (
                    <div
                      key={`${type}-${idx}`}
                      className="board-member-card"
                      style={{
                        backgroundColor: '#ffffff',
                        border: `2px solid ${colors[type]}`,
                        borderRadius: '12px',
                        padding: '15px',
                        marginBottom: '15px',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                        transition: 'transform 0.2s',
                      }}
                      onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                      onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      <h4 style={{
                        fontSize: '1.1rem',
                        fontWeight: '600',
                        color: '#1f2937',
                        marginBottom: '8px'
                      }}>
                        {member.name}
                      </h4>

                      {member.role && (
                        <p style={{
                          fontSize: '0.9rem',
                          color: '#6b7280',
                          marginBottom: '10px',
                          fontStyle: 'italic'
                        }}>
                          {member.role}
                        </p>
                      )}

                      {member.relationship && (
                        <div style={{ marginBottom: '8px' }}>
                          <span style={{ fontWeight: '600', color: colors[type], fontSize: '0.85rem' }}>
                            Relationship:
                          </span>
                          <span style={{ fontSize: '0.85rem', color: '#4b5563', marginLeft: '5px' }}>
                            {member.relationship}
                          </span>
                        </div>
                      )}

                      {member.expertise && (
                        <div style={{ marginBottom: '8px' }}>
                          <span style={{ fontWeight: '600', color: colors[type], fontSize: '0.85rem' }}>
                            Expertise:
                          </span>
                          <span style={{ fontSize: '0.85rem', color: '#4b5563', marginLeft: '5px' }}>
                            {member.expertise}
                          </span>
                        </div>
                      )}

                      {member.value && (
                        <div style={{ marginBottom: '8px' }}>
                          <span style={{ fontWeight: '600', color: colors[type], fontSize: '0.85rem' }}>
                            Value:
                          </span>
                          <span style={{ fontSize: '0.85rem', color: '#4b5563', marginLeft: '5px' }}>
                            {member.value}
                          </span>
                        </div>
                      )}

                      {member.contact && (
                        <div style={{ marginBottom: '8px' }}>
                          <span style={{ fontWeight: '600', color: colors[type], fontSize: '0.85rem' }}>
                            Contact:
                          </span>
                          <span style={{ fontSize: '0.85rem', color: '#4b5563', marginLeft: '5px' }}>
                            {member.contact}
                          </span>
                        </div>
                      )}

                      {member.cadence && (
                        <div style={{ marginBottom: '8px' }}>
                          <span style={{ fontWeight: '600', color: colors[type], fontSize: '0.85rem' }}>
                            Meeting Cadence:
                          </span>
                          <span style={{ fontSize: '0.85rem', color: '#4b5563', marginLeft: '5px' }}>
                            {member.cadence}
                          </span>
                        </div>
                      )}

                      {member.lastContact && (
                        <div style={{ marginBottom: '8px' }}>
                          <span style={{ fontWeight: '600', color: colors[type], fontSize: '0.85rem' }}>
                            Last Contact:
                          </span>
                          <span style={{ fontSize: '0.85rem', color: '#4b5563', marginLeft: '5px' }}>
                            {member.lastContact}
                          </span>
                        </div>
                      )}

                      {member.notes && (
                        <div style={{
                          marginTop: '10px',
                          paddingTop: '10px',
                          borderTop: `1px solid ${colors[type]}20`
                        }}>
                          <span style={{
                            fontWeight: '600',
                            color: colors[type],
                            fontSize: '0.85rem',
                            display: 'block',
                            marginBottom: '5px'
                          }}>
                            Notes:
                          </span>
                          <p style={{
                            fontSize: '0.85rem',
                            color: '#4b5563',
                            lineHeight: '1.4',
                            marginTop: '5px'
                          }}>
                            {member.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Goals Section - matching PDF style */}
      {data.goals && data.goals.length > 0 && (
        <div className="board-section-white" style={{
          marginTop: '40px',
          padding: '25px',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
          border: '1px solid #e5e7eb'
        }}>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: '#f97316',
            marginBottom: '20px',
            borderBottom: '2px solid #f97316',
            paddingBottom: '10px'
          }}>
            Your Goals
          </h2>
          {data.goals.map((goal, index) => (
            <div key={index} style={{
              marginBottom: '25px',
              paddingLeft: '20px',
              borderLeft: '4px solid #f97316',
              backgroundColor: '#ffffff',
              padding: '15px 15px 15px 20px',
              borderRadius: '0 8px 8px 0'
            }}>
              <h3 style={{
                fontSize: '1.2rem',
                fontWeight: '600',
                color: '#1f2937',
                marginBottom: '10px'
              }}>
                {goal.timeframe}
              </h3>
              {goal.description && (
                <div style={{ marginBottom: '10px' }}>
                  <h4 style={{
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    color: '#f97316',
                    marginBottom: '4px'
                  }}>
                    Description:
                  </h4>
                  <p style={{
                    fontSize: '0.95rem',
                    color: '#4b5563',
                    lineHeight: '1.6'
                  }}>
                    {goal.description}
                  </p>
                </div>
              )}
              {goal.notes && (
                <div>
                  <h4 style={{
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    color: '#6b7280',
                    marginBottom: '4px'
                  }}>
                    Strategy:
                  </h4>
                  <p style={{
                    fontSize: '0.95rem',
                    color: '#4b5563',
                    lineHeight: '1.6'
                  }}>
                    {goal.notes}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Superpowers Section - matching PDF style */}
      {data.you && data.you.superpowers && data.you.superpowers.length > 0 && (
        <div className="board-section-white" style={{
          marginTop: '40px',
          padding: '25px',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
          border: '1px solid #e5e7eb'
        }}>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: '#10b981',
            marginBottom: '20px',
            borderBottom: '2px solid #10b981',
            paddingBottom: '10px'
          }}>
            Your Superpowers
          </h2>
          {data.you.superpowers.map((superpower, index) => (
            <div key={index} style={{
              marginBottom: '25px',
              paddingLeft: '20px',
              borderLeft: '4px solid #10b981',
              backgroundColor: '#ffffff',
              padding: '15px 15px 15px 20px',
              borderRadius: '0 8px 8px 0'
            }}>
              <h3 style={{
                fontSize: '1.2rem',
                fontWeight: '600',
                color: '#1f2937',
                marginBottom: '10px'
              }}>
                {superpower.name}
              </h3>
              {superpower.description && (
                <div style={{ marginBottom: '10px' }}>
                  <h4 style={{
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    color: '#10b981',
                    marginBottom: '4px'
                  }}>
                    Description:
                  </h4>
                  <p style={{
                    fontSize: '0.95rem',
                    color: '#4b5563',
                    lineHeight: '1.6'
                  }}>
                    {superpower.description}
                  </p>
                </div>
              )}
              {superpower.notes && (
                <div>
                  <h4 style={{
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    color: '#6b7280',
                    marginBottom: '4px'
                  }}>
                    Examples:
                  </h4>
                  <p style={{
                    fontSize: '0.95rem',
                    color: '#4b5563',
                    lineHeight: '1.6'
                  }}>
                    {superpower.notes}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Board Member Details Section */}
      {allMembers.length > 0 && (
        <div className="board-section-white" style={{
          marginTop: '40px',
          padding: '25px',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
          border: '1px solid #e5e7eb'
        }}>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: '#2563eb',
            marginBottom: '20px',
            borderBottom: '2px solid #2563eb',
            paddingBottom: '10px'
          }}>
            Board Member Details
          </h2>
          {memberGroups.map(({key: type, members}) => {
            if (!members.length) return null;

            return (
              <div key={type} style={{ marginBottom: '30px' }}>
                <h3 style={{
                  fontSize: '1.3rem',
                  fontWeight: '600',
                  color: colors[type] || '#6b7280',
                  marginBottom: '15px',
                  textTransform: 'capitalize'
                }}>
                  {type}
                </h3>
                {members.map((member, index) => (
                  <div key={index} style={{
                    marginBottom: '25px',
                    paddingLeft: '20px',
                    borderLeft: `4px solid ${colors[type] || '#6b7280'}`,
                    backgroundColor: '#ffffff',
                    padding: '15px 15px 15px 20px',
                    borderRadius: '0 8px 8px 0'
                  }}>
                    <h4 style={{
                      fontSize: '1.2rem',
                      fontWeight: '600',
                      color: '#1f2937',
                      marginBottom: '5px'
                    }}>
                      {member.name}
                    </h4>
                    <p style={{
                      fontSize: '0.9rem',
                      color: '#6b7280',
                      marginBottom: '10px'
                    }}>
                      {member.role} • {member.connection} • {member.cadence}
                    </p>
                    {member.notes && (
                      <div style={{ marginBottom: '10px' }}>
                        <h5 style={{
                          fontSize: '0.9rem',
                          fontWeight: '600',
                          color: '#6b7280',
                          marginBottom: '4px'
                        }}>
                          Notes:
                        </h5>
                        <p style={{
                          fontSize: '0.95rem',
                          color: '#4b5563',
                          lineHeight: '1.6'
                        }}>
                          {member.notes}
                        </p>
                      </div>
                    )}
                    {member.whatToLearn && (
                      <div style={{ marginBottom: '10px' }}>
                        <h5 style={{
                          fontSize: '0.9rem',
                          fontWeight: '600',
                          color: '#10b981',
                          marginBottom: '4px'
                        }}>
                          What You Learn From Them:
                        </h5>
                        <p style={{
                          fontSize: '0.95rem',
                          color: '#4b5563',
                          lineHeight: '1.6'
                        }}>
                          {member.whatToLearn}
                        </p>
                      </div>
                    )}
                    {member.whatTheyGet && (
                      <div>
                        <h5 style={{
                          fontSize: '0.9rem',
                          fontWeight: '600',
                          color: colors[type] || '#6b7280',
                          marginBottom: '4px'
                        }}>
                          What They Get From You:
                        </h5>
                        <p style={{
                          fontSize: '0.95rem',
                          color: '#4b5563',
                          lineHeight: '1.6'
                        }}>
                          {member.whatTheyGet}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Mentees Section - matching PDF style */}
      {data.you && data.you.mentees && data.you.mentees.length > 0 && (
        <div className="board-section-white" style={{
          marginTop: '40px',
          padding: '25px',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
          border: '1px solid #e5e7eb'
        }}>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: '#8b5cf6',
            marginBottom: '20px',
            borderBottom: '2px solid #8b5cf6',
            paddingBottom: '10px'
          }}>
            Your Mentees
          </h2>
          {data.you.mentees.map((mentee, index) => (
            <div key={index} style={{
              marginBottom: '25px',
              paddingLeft: '20px',
              borderLeft: '4px solid #8b5cf6',
              backgroundColor: '#ffffff',
              padding: '15px 15px 15px 20px',
              borderRadius: '0 8px 8px 0'
            }}>
              <h3 style={{
                fontSize: '1.2rem',
                fontWeight: '600',
                color: '#1f2937',
                marginBottom: '5px'
              }}>
                {mentee.name}
              </h3>
              <p style={{
                fontSize: '0.9rem',
                color: '#6b7280',
                marginBottom: '10px'
              }}>
                {mentee.role} • {mentee.connection} • {mentee.cadence}
              </p>
              {mentee.notes && (
                <div style={{ marginBottom: '10px' }}>
                  <h4 style={{
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    color: '#6b7280',
                    marginBottom: '4px'
                  }}>
                    Notes:
                  </h4>
                  <p style={{
                    fontSize: '0.95rem',
                    color: '#4b5563',
                    lineHeight: '1.6'
                  }}>
                    {mentee.notes}
                  </p>
                </div>
              )}
              {mentee.whatYouTeach && (
                <div style={{ marginBottom: '10px' }}>
                  <h4 style={{
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    color: '#10b981',
                    marginBottom: '4px'
                  }}>
                    What You Teach Them:
                  </h4>
                  <p style={{
                    fontSize: '0.95rem',
                    color: '#4b5563',
                    lineHeight: '1.6'
                  }}>
                    {mentee.whatYouTeach}
                  </p>
                </div>
              )}
              {mentee.whatYouLearn && (
                <div>
                  <h4 style={{
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    color: '#8b5cf6',
                    marginBottom: '4px'
                  }}>
                    What You Learn From Them:
                  </h4>
                  <p style={{
                    fontSize: '0.95rem',
                    color: '#4b5563',
                    lineHeight: '1.6'
                  }}>
                    {mentee.whatYouLearn}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function IntroLearnModal({ onClose }) {
  const [currentPage, setCurrentPage] = useState(0);
  
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };
  
  const pages = [
    {
      title: "Your Personal Board of Directors: Guiding Partners",
      content: (
        <div>
          <div style={{marginBottom: '24px'}}>
            <h3 style={{color: '#2563eb', fontSize: '1.1em', marginBottom: '8px'}}>What It Is</h3>
            <p>Your Personal Board of Directors is a structured but living system to align your career with the people who will help you grow. The program takes you through:</p>
            <p><strong>Intro</strong> – Framing your career journey.</p>
            <p><strong>You</strong> – Setting technical, business, and organization superpowers.</p>
            <p><strong>Goals</strong> – Setting immediate, 1-year, and 5-year objectives.</p>
            <p><strong>Mentors</strong> – Wisdom and perspective.</p>
            <p><strong>Coaches</strong> – Skill and performance building.</p>
            <p><strong>Connectors</strong> – Expanding your network.</p>
            <p><strong>Sponsors</strong> – Advocates who open doors.</p>
            <p><strong>Peers</strong> – Honest, relatable companions.</p>
            <p><strong>Final Board Summary</strong> – A snapshot you can export as a JSON (to update later) or a PDF (to review anytime).</p>
            <p>It's part strategy, part reflection, and part relationship-building—designed to help you take charge of your career while giving back to those who support you.</p>
          </div>
          
          <div style={{marginBottom: '16px'}}>
            <h3 style={{color: '#2563eb', fontSize: '1.1em', marginBottom: '8px'}}>Why You Need It</h3>
            <p>Careers rarely move in straight lines. A strong personal board provides the steady compass that helps you adapt to shifting environments, industries, and aspirations.</p>
            <p><strong>Goal setting matters.</strong> By naming immediate, 1-year, and 5-year goals, you create a map that gives direction without locking you in. Goals should be ambitious yet achievable, designed to stretch you while keeping progress realistic.</p>
            <p><strong>Flexibility is essential.</strong> Revisiting goals regularly ensures you can adjust when life or industries change. Don't worry if a past goal no longer aligns—it wasn't wasted time. Those experiences built cross-industry skills that strengthen your adaptability.</p>
            <p><strong>Reciprocity is the foundation.</strong> Just like a friendship, these board relationships must work both ways. Mutual respect and value exchange make them durable over the long term.</p>
          </div>
        </div>
      )
    },
    {
      title: "Your Personal Board of Directors: Guiding Partners",
      content: (
        <div>
          <div style={{marginBottom: '16px'}}>
            <h3 style={{color: '#2563eb', fontSize: '1.1em', marginBottom: '8px'}}>What to Look For</h3>
            <p>Seek balance in both relationships and goals:</p>
            <p><strong>Relationships</strong> – Ensure your board spans mentors, coaches, peers, sponsors, and connectors, so you have wisdom, accountability, opportunity, and solidarity in one group.</p>
            <p><strong>Goals</strong> – Include both near-term focus (next project, upcoming role) and longer horizons (career pivots, leadership growth). Lofty goals keep you stretching; achievable ones keep you motivated.</p>
          </div>

          <div style={{marginBottom: '16px'}}>
            <h3 style={{color: '#2563eb', fontSize: '1.1em', marginBottom: '8px'}}>How They Help</h3>
            <p>Your board and your goals together provide:</p>
            <p>• A roadmap with milestones you can adjust without guilt.</p>
            <p>• Cross-pollination of ideas from different industries and disciplines.</p>
            <p>• Candid feedback, advocacy, and introductions that speed up your progress.</p>
            <p>• Encouragement when goals feel far away and perspective when it's time to realign.</p>
          </div>

          <div style={{marginBottom: '16px'}}>
            <h3 style={{color: '#10b981', fontSize: '1.1em', marginBottom: '8px'}}>What to Learn From Them</h3>
            <p>The program teaches you how to:</p>
            <p>• Set and track immediate, 1-year, and 5-year goals that grow with you.</p>
            <p>• Align board members' strengths with your goals.</p>
            <p>• Adapt lessons learned in one career path to entirely new ones.</p>
            <p>• Recognize that "misaligned" goals are not wasted—they're training ground.</p>
            <p>• Use cadence and reflection to keep both goals and relationships alive.</p>
          </div>

          <div style={{marginBottom: '16px'}}>
            <h3 style={{color: '#8b5cf6', fontSize: '1.1em', marginBottom: '8px'}}>What They Get From You</h3>
            <p>Board members benefit from your growth, but also from:</p>
            <p>• Fresh ideas and perspectives drawn from your evolving goals.</p>
            <p>• Insights from your generation, industry, or unique skill set.</p>
            <p>• The chance to collaborate, co-create, or reflect on their own journeys.</p>
            <p>• Energy and curiosity that helps them stay sharp.</p>
          </div>

          <div style={{background: '#f8fafc', padding: '12px', borderRadius: '8px', marginTop: '20px', borderLeft: '4px solid #2563eb'}}>
            <h4 style={{margin: '0 0 8px 0', color: '#2563eb'}}>Remember</h4>
            <p style={{margin: '0', fontSize: '14px', color: '#4b5563'}}>
              Your Personal Board of Directors and your goals are intertwined. The board helps guide your path, while your goals give the board direction.
            </p>
            <p style={{margin: '8px 0 0 0', fontSize: '14px', color: '#4b5563'}}>
              Think of it as an ongoing conversation: goals set the agenda, your board sharpens the discussion, and your progress reshapes the agenda over time. It's not about quick wins—it's about building momentum, relationships, and wisdom that compound over years.
            </p>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="modal" onClick={handleOverlayClick}>
      <div className="modal-content" style={{maxWidth: '700px', maxHeight: '85vh', overflowY: 'auto'}}>
        {pages[currentPage].content}
        
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #e5e7eb'}}>
          <div style={{display: 'flex', gap: '8px'}}>
            {pages.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentPage(idx)}
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  border: 'none',
                  backgroundColor: idx === currentPage ? '#2563eb' : '#d1d5db',
                  cursor: 'pointer'
                }}
              />
            ))}
          </div>
          
          <div style={{display: 'flex', gap: '12px', alignItems: 'center'}}>
            <button
              onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
              style={{
                padding: '8px 16px',
                backgroundColor: currentPage === 0 ? '#f3f4f6' : '#2563eb',
                color: currentPage === 0 ? '#9ca3af' : 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: currentPage === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              ← Previous
            </button>
            
            <span style={{color: '#6b7280', fontSize: '14px'}}>
              {currentPage + 1} of {pages.length}
            </span>
            
            {currentPage < pages.length - 1 ? (
              <button
                onClick={() => setCurrentPage(Math.min(pages.length - 1, currentPage + 1))}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Next →
              </button>
            ) : (
              <button
                onClick={onClose}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Get Started
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LearnModal({ type, onClose, onAddClick }) {
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };
  
  const content = {
    goals: {
      title: 'Goals: Your Career Compass',
      description: 'Goals are the milestones and aspirations that set your direction. In this program, you\'ll identify Immediate, 1-Year, and 5-Year goals. They act as a compass for your career, giving your Personal Board of Directors clarity on how to best support and challenge you.',
      importance: 'Without defined goals, career growth can drift. Goals provide focus, motivation, and a sense of progress. But they\'re not rigid contracts—they\'re flexible guides. Revisiting them regularly allows you to adapt to changing circumstances, industries, and interests. Most importantly: setting goals helps your board help you. When your mentors, sponsors, coaches, peers, and connectors know where you\'re headed, they can align their advice, introductions, and support to your journey.',
      whatToLookFor: 'Immediate Goals: What do you need to accomplish in the next 3–6 months? (e.g., build a new skill, complete a project, expand visibility at work). 1-Year Goals: Where do you want to be by the end of the next year? (e.g., promotion, new role, industry transition, thought leadership activity). 5-Year Goals: What\'s your larger horizon? (e.g., leadership role, career pivot, launching your own venture, establishing a reputation in a field). Good goals are lofty but achievable: ambitious enough to stretch you, grounded enough that you can make real progress.',
      howTheyHelp: 'Goals anchor your journey by: giving you and your board a shared "north star," making it easier to prioritize what matters most, turning vague aspirations into tangible steps, offering a benchmark for reflection and course correction, and guiding conversations with your board so advice is relevant and timely.',
      whatToLearn: 'From setting and revisiting goals, you\'ll learn: how to balance ambition with realism, the value of revisiting and realigning regularly without expecting overnight results, how to adapt lessons from one path to another (cross-industry skills are never wasted), and that changing your long-term goals doesn\'t erase past work—it equips you with transferable skills and resilience.',
      whatTheyGet: 'When you share your goals with your board, you give them: a clear sense of how they can help, opportunities to connect you to people, resources, or experiences aligned with your targets, and insight into your motivation and direction, which strengthens the relationship. Remember: Goal-setting is not about predicting the future—it\'s about shaping it. Your immediate, 1-year, and 5-year goals create momentum while leaving space for change. Think of them as flexible scaffolding: strong enough to support your growth, light enough to be rebuilt as your vision evolves.'
    },
    you: {
      title: 'You: Know Yourself First',
      description: 'Understanding your superpowers and mentorship relationships is foundational to building an effective personal board. Your superpowers are the unique combination of technical, business, and organizational skills that set you apart. Your mentees are people you guide, teach, or advise—relationships that keep you sharp and connected to fresh perspectives.',
      importance: 'Knowing yourself first enables authentic relationship-building with your board. When you clearly understand your strengths, you can communicate your value proposition to mentors, sponsors, and peers. When you actively mentor others, you develop leadership skills, stay current with emerging trends, and build a network of future collaborators who may become valuable connections as they advance in their careers.',
      whatToLookFor: 'Superpowers: Identify 3 core areas where you excel—Technical Skills (programming, data analysis, design, engineering), Business Skills (strategy, sales, marketing, operations), and Organization Skills (project management, team leadership, communication). Be specific about your expertise level and unique approaches. Mentees: Look for people 2-5 years behind you who are eager to learn, demonstrate potential, and align with your values. They might be junior colleagues, career changers, students, or professionals in adjacent fields.',
      howTheyHelp: 'Your superpowers become your currency in professional relationships—they\'re what you offer in exchange for wisdom, connections, and opportunities. Your mentoring relationships keep you engaged with emerging talent, expose you to fresh perspectives, and help you practice leadership skills. Both contribute to your professional brand and create reciprocal value in your network.',
      whatToLearn: 'From self-reflection on your superpowers, learn: how to articulate your unique value, where to focus your continued development, which opportunities align with your strengths, and how to position yourself in conversations with senior professionals. From mentoring others, learn: how to teach and develop talent, current trends from emerging professionals, different perspectives on industry challenges, and leadership skills through practice.',
      whatTheyGet: 'When you clearly communicate your superpowers, your board can: connect you to opportunities that match your expertise, provide targeted advice for skill development, introduce you to people who value your specific abilities, and recommend you for roles that leverage your strengths. When you mentor others, you give them: practical guidance for career development, industry insights, professional connections, and the confidence that comes from having an experienced advocate. Your mentees often become your biggest champions as they advance in their careers.'
    },
    mentors: {
      title: 'Mentors: Your Wisdom Guides',
      description: 'Mentors are experienced professionals who have walked the path you aspire to take. They provide strategic career advice, share lessons learned from their journeys, and help you navigate complex professional decisions.',
      importance: 'A mentor opens doors by sharing their network, institutional knowledge, and hard-earned wisdom. They help you avoid common pitfalls and accelerate your growth by learning from their experiences rather than making every mistake yourself.',
      whatToLookFor: 'Look for someone 5-10 years ahead of where you want to be, who demonstrates values you admire, and who has shown interest in your development. They should have experience in your field or desired career path and be willing to invest time in your growth.',
      howTheyHelp: 'Mentors provide strategic perspective on career moves, industry insights, introductions to their network, and honest feedback on your professional development. They help you see the bigger picture and make informed decisions about your future.',
      whatToLearn: 'From mentors, learn: industry best practices, strategic thinking, leadership styles, decision-making frameworks, networking strategies, career navigation tactics, and how to build influence in your organization. Ask about their failures and what they would do differently.',
      whatTheyGet: 'Mentors gain: fresh perspectives on industry trends, fulfillment from developing talent, potential future collaborators or team members, staying connected to emerging talent, validation of their expertise, and the satisfaction of giving back. Your success reflects well on them.'
    },
    coaches: {
      title: 'Coaches: Your Skill Developers',
      description: 'Coaches are focused on helping you develop specific skills and capabilities. Unlike mentors who provide broad wisdom, coaches zero in on particular areas where you need improvement and push you to achieve your potential.',
      importance: 'Coaches refine potential by providing targeted feedback, skill development strategies, and accountability for improvement. They help bridge the gap between where you are and where you want to be in specific competencies.',
      whatToLookFor: 'Seek someone with deep expertise in the skills you want to develop, who can provide constructive feedback and structured learning approaches. They might be peers, superiors, or even external professionals who excel in areas where you want to grow.',
      howTheyHelp: 'Coaches give you specific exercises, feedback on your performance, and hold you accountable for skill development. They help you practice, refine techniques, and build confidence in areas critical to your success.',
      whatToLearn: 'From coaches, learn: specific technical skills, presentation techniques, communication styles, time management methods, problem-solving approaches, productivity systems, and performance optimization strategies. Focus on actionable techniques you can immediately apply.',
      whatTheyGet: 'Coaches gain: practice in teaching and articulating their expertise, validation of their knowledge, potential consulting opportunities, refinement of their own skills through teaching, professional satisfaction from developing others, and expanded influence in their field.'
    },
    connectors: {
      title: 'Connectors: Your Network Expanders',
      description: 'Connectors are the social catalysts in your network – people who know everyone and love making introductions. They have extensive networks across industries and are generous with their connections.',
      importance: 'Connections spark growth by expanding your reach far beyond your immediate circle. In today\'s interconnected world, opportunities often come through relationships, and connectors multiply your networking capacity exponentially.',
      whatToLookFor: 'Identify natural networkers who are well-connected in your industry or desired field, who enjoy making introductions, and who seem to know someone everywhere they go. They should be generous with their network and excited about connecting people.',
      howTheyHelp: 'Connectors introduce you to new opportunities, potential clients, collaborators, or employers. They expand your professional reach, help you discover hidden job markets, and connect you with people who can advance your goals.',
      whatToLearn: 'From connectors, learn: how to build authentic relationships, networking etiquette, how to make valuable introductions, maintaining long-term professional relationships, social intelligence, reading people and situations, and how to add value to your network.',
      whatTheyGet: 'Connectors gain: strengthened network bonds through introductions, reputation as a valuable connector, first access to opportunities through their network, satisfaction from creating successful connections, reciprocal introductions to your network, and increased social capital.'
    },
    sponsors: {
      title: 'Sponsors: Your Advocates',
      description: 'Sponsors are influential people who actively advocate for you in rooms where you\'re not present. They go beyond giving advice to actually using their political capital and influence to advance your career.',
      importance: 'Sponsorship elevates your career by having someone with power and influence actively promote your interests. While mentors give advice, sponsors take action on your behalf, recommending you for opportunities and speaking up for your contributions.',
      whatToLookFor: 'Look for someone with influence in your organization or industry who believes in your potential and is willing to stake their reputation on your success. They should have the power to make things happen and be willing to use it for you.',
      howTheyHelp: 'Sponsors recommend you for promotions, advocate for your ideas in leadership meetings, nominate you for high-visibility projects, and ensure your contributions are recognized. They actively open doors rather than just pointing them out.',
      whatToLearn: 'From sponsors, learn: organizational politics, executive presence, strategic visibility, how decisions are really made, unwritten rules of advancement, building executive relationships, and how to position yourself for opportunities.',
      whatTheyGet: 'Sponsors gain: strong talent pipeline for their teams, reflected glory from your successes, loyal allies as you advance, demonstration of their leadership development skills, expansion of their influence through protégés, and potential future partnerships.'
    },
    peers: {
      title: 'Peers: Your Journey Companions',
      description: 'Peers are professionals at similar career stages who face comparable challenges and opportunities. They provide mutual support, shared problem-solving, and the camaraderie of people walking similar paths.',
      importance: 'Peers share the path by offering real-time support for current challenges, celebrating wins together, and providing honest perspectives from people who truly understand your situation. They offer reciprocal relationships where you both give and receive support.',
      whatToLookFor: 'Connect with professionals at similar career levels who work in your field or adjacent areas, who share similar values and ambitions, and who are open to mutual support and collaboration.',
      howTheyHelp: 'Peers provide emotional support during tough times, share strategies for common challenges, offer networking opportunities within their circles, and create accountability partnerships for mutual growth and development.',
      whatToLearn: 'From peers, learn: current industry trends at your level, salary benchmarks, company cultures, practical day-to-day solutions, emerging opportunities, shared resources and tools, and collaborative problem-solving approaches.',
      whatTheyGet: 'Peers gain: mutual support and encouragement, shared learning experiences, potential collaboration opportunities, expanded professional network, accountability partnership, and the comfort of not feeling alone in their journey.'
    }
  };

  const roleNames = {
    goals: 'goal',
    mentors: 'mentor',
    coaches: 'coach', 
    connectors: 'connector',
    sponsors: 'sponsor',
    peers: 'peer'
  };

  const typeContent = content[type];

  const isGoalsType = type === 'goals';

  return (
    <div className="modal" onClick={handleOverlayClick}>
      <div className="modal-content" style={{maxWidth: isGoalsType ? '600px' : '900px', maxHeight: '80vh', overflowY: 'auto'}}>
        <h2>{typeContent.title}</h2>
        
        {isGoalsType ? (
          // Original single-column layout for goals
          <>
            <div style={{marginBottom: '16px'}}>
              <h3 style={{color: '#2563eb', fontSize: '1.1em', marginBottom: '8px'}}>What They Are</h3>
              <p>{typeContent.description}</p>
            </div>

            <div style={{marginBottom: '16px'}}>
              <h3 style={{color: '#2563eb', fontSize: '1.1em', marginBottom: '8px'}}>Why You Need Them</h3>
              <p>{typeContent.importance}</p>
            </div>

            <div style={{marginBottom: '16px'}}>
              <h3 style={{color: '#2563eb', fontSize: '1.1em', marginBottom: '8px'}}>What to Look For</h3>
              <p>{typeContent.whatToLookFor}</p>
            </div>

            <div style={{marginBottom: '16px'}}>
              <h3 style={{color: '#2563eb', fontSize: '1.1em', marginBottom: '8px'}}>How They Help</h3>
              <p>{typeContent.howTheyHelp}</p>
            </div>
          </>
        ) : (
          // Two-column layout for board member types
          <div style={{display: 'flex', gap: '40px'}}>
            <div style={{flex: 1}}>
              <div style={{marginBottom: '16px'}}>
                <h3 style={{color: '#2563eb', fontSize: '1.1em', marginBottom: '8px'}}>What They Are</h3>
                <p>{typeContent.description}</p>
              </div>

              <div style={{marginBottom: '16px'}}>
                <h3 style={{color: '#2563eb', fontSize: '1.1em', marginBottom: '8px'}}>Why You Need Them</h3>
                <p>{typeContent.importance}</p>
              </div>

              <div style={{marginBottom: '16px'}}>
                <h3 style={{color: '#2563eb', fontSize: '1.1em', marginBottom: '8px'}}>What to Look For</h3>
                <p>{typeContent.whatToLookFor}</p>
              </div>

              <div style={{marginBottom: '16px'}}>
                <h3 style={{color: '#2563eb', fontSize: '1.1em', marginBottom: '8px'}}>How They Help</h3>
                <p>{typeContent.howTheyHelp}</p>
              </div>
            </div>

            <div style={{flex: 1, borderLeft: '2px solid #e5e7eb', paddingLeft: '24px'}}>
              <div style={{marginBottom: '16px'}}>
                <h3 style={{color: '#10b981', fontSize: '1.1em', marginBottom: '8px'}}>What to Learn From Them</h3>
                <p>{typeContent.whatToLearn}</p>
              </div>

              <div style={{marginBottom: '16px'}}>
                <h3 style={{color: '#8b5cf6', fontSize: '1.1em', marginBottom: '8px'}}>What They Get From You</h3>
                <p>{typeContent.whatTheyGet}</p>
              </div>

              <div style={{marginBottom: '16px', background: '#f0f9ff', padding: '12px', borderRadius: '8px', border: '1px solid #0ea5e9'}}>
                <h3 style={{color: '#0ea5e9', fontSize: '1.1em', marginBottom: '8px'}}>💼 LinkedIn Profile Review</h3>
                <p style={{margin: '0', fontSize: '14px', color: '#475569'}}>
                  Before approaching potential {roleNames[type]}s, thoroughly review their LinkedIn profile. Note their career path, current role, recent posts, shared connections, educational background, and professional interests. Look for common ground such as shared alma maters, previous companies, industry experiences, or mutual connections. This research helps you craft personalized outreach messages and find natural conversation starters. Pay attention to their engagement style - do they share thought leadership content, celebrate team wins, or advocate for causes? This insight helps you understand their values and communication preferences.
                </p>
              </div>
            </div>
          </div>
        )}

        <div style={{background: '#f8fafc', padding: '12px', borderRadius: '8px', marginBottom: '16px', borderLeft: '4px solid #2563eb'}}>
          <p style={{margin: '0', fontSize: '14px', color: '#4b5563'}}>
            <strong>Remember:</strong> Your personal board members may not even know they're on your "board." Focus on building authentic relationships and providing mutual value. Consider their name, role, connection level, meeting cadence, and notes on engagement.
          </p>
          {!isGoalsType && (
            <p style={{margin: '8px 0 0 0', fontSize: '14px', color: '#4b5563'}}>
              <strong>Value Exchange:</strong> Everyone has something to offer! Consider what your board members might learn from you: your unique talents, fresh perspectives, domain expertise, new ways of doing things, connections to your network, honest feedback, energy and enthusiasm, or insights from your generation or background. The best board relationships are mutually beneficial.
            </p>
          )}
        </div>

        {type === 'goals' ? (
          <div className="learn-cta">
            Now click the edit button on each timeframe card below to define your goals!
          </div>
        ) : (
          <button 
            className="learn-cta-button" 
            onClick={onAddClick}
            style={{
              width: '100%',
              padding: '12px 20px',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '500',
              cursor: 'pointer',
              marginBottom: '16px',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#1d4ed8'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#2563eb'}
          >
            Now click here to add a {roleNames[type]}!
          </button>
        )}
        
        <div className="modal-buttons">
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function UploadSuccessPopup() {
  return (
    <div className="upload-success-popup">
      <div className="upload-success-content">
        <div className="success-icon">✓</div>
        <div className="success-message">Upload Successful!</div>
        <div className="success-submessage">Your board data has been imported</div>
      </div>
    </div>
  );
}

function FormModal({ type, item, entryIndex, onSave, onClose, boardData, onFormUpdate, onWritingModalUpdate, writingResultsShowing }) {
  const [advisorShowing, setAdvisorShowing] = useState(false);
  const handleOverlayClick = (e) => {
    // Close FormModal when clicking on its overlay
    if (e.target === e.currentTarget) {
      onClose();
    }
  };
  
  const isGoals = type === 'goals';
  const isSuperpowers = type === 'superpowers';
  const isMentees = type === 'mentees';
  const cadenceOptions = ['Daily', 'Weekly', 'Bi-weekly', 'Monthly', 'Quarterly', 'Annually', 'Ad-hoc'];
  
  // Initialize form differently for different types
  const getDefaultForm = () => {
    if (isGoals) return { timeframe: '', description: '', notes: '' };
    if (isSuperpowers) return { name: '', description: '', notes: '' };
    if (isMentees) return { name: '', role: '', connection: 'Not yet', cadence: 'Monthly', notes: '', whatYouTeach: '', whatYouLearn: '' };
    return { name: '', role: '', connection: 'Not yet', cadence: 'Monthly', notes: '', whatToLearn: '', whatTheyGet: '' };
  };
  
  const [form, setForm] = useState({...getDefaultForm(),...item});
  const activeEditor = React.useRef(true);
  const writingAbort = React.useRef(null);
  React.useEffect(() => () => { activeEditor.current = false; writingAbort.current?.abort(); }, []);
  const formRef = React.useRef(form);
  formRef.current = form;
  const [writingTarget, setWritingTarget] = useState(isGoals || isSuperpowers ? 'description' : 'notes');
  const [writingDirection, setWritingDirection] = useState('');
  const [selectedPassage, setSelectedPassage] = useState(null);
  const editorRef = React.useRef(null);
  React.useEffect(() => {
    const prior = document.activeElement;
    editorRef.current?.querySelector('input:not(:disabled),textarea')?.focus();
    return () => { if(prior?.isConnected) prior.focus(); };
  }, []);
  const selectPassage = e => {
    const el = e.target;
    if (el.tagName !== 'TEXTAREA' || !el.name || el.selectionStart === el.selectionEnd) return;
    setWritingTarget(el.name);
    setSelectedPassage({field:el.name,start:el.selectionStart,end:el.selectionEnd,text:el.value.slice(el.selectionStart,el.selectionEnd)});
  };
  const draftBase = React.useRef({...getDefaultForm(),...item}).current;
  const draftKey = React.useRef(`board-entry-draft:${type}:${entryIndex ?? 'new'}:${item?.id || item?.timeframe || item?.name || ''}`).current;
  const [recoveredDraft, setRecoveredDraft] = useState(() => {
    try { return recoverWritingDraft(JSON.parse(sessionStorage.getItem(draftKey)),draftBase); } catch { return null; }
  });
  const persistDraft = next => { try { sessionStorage.setItem(draftKey, JSON.stringify({version:1,base:JSON.stringify(draftBase),form:next})); } catch {} };
  const [originalForm, setOriginalForm] = useState(null); // Last applied fields only, for safe undo
  const [undoMessage, setUndoMessage] = useState('');
  const [isWritingLoading, setIsWritingLoading] = useState(false);
  const [hasWritingBackup, setHasWritingBackup] = useState(false);
  const [enhancementLevel, setEnhancementLevel] = useState(1); // 1-3 enhancement levels


  const [cadenceIndex, setCadenceIndex] = useState(cadenceOptions.indexOf(form.cadence) >= 0 ? cadenceOptions.indexOf(form.cadence) : 3);
  
  // Keep the draft in sync with parent entry updates.
  React.useEffect(() => {
    if (item) {
      setForm({...getDefaultForm(),...item});
      setSelectedPassage(null);
      if (item.cadence) {
        const index = cadenceOptions.indexOf(item.cadence);
        setCadenceIndex(index >= 0 ? index : 3);
      }
    }
  }, [item]);
  
  const handleChange = e => {
    setSelectedPassage(null);
    const newForm = { ...form, [e.target.name]: e.target.value };
    persistDraft(newForm);
    setForm(newForm);
    if (onFormUpdate) {
      onFormUpdate(newForm); // Keep parent editingItem in sync
    }
  };
  
  const handleCadenceChange = e => {
    const index = parseInt(e.target.value);
    setCadenceIndex(index);
    const newForm = { ...form, cadence: cadenceOptions[index] };
    persistDraft(newForm);
    setForm(newForm);
    if (onFormUpdate) {
      onFormUpdate(newForm); // Keep parent editingItem in sync
    }
  };

  const save = () => {
    try { sessionStorage.removeItem(draftKey); } catch {}
    onSave(form);
  };

  const suggestForField = async () => {
    if (!writingDirection.trim() || isWritingLoading) return;
    setIsWritingLoading(true);
    const snapshot = { ...formRef.current };
    writingAbort.current = new AbortController();
    try {
      const response = await getAIGuidance('writing_refine', { text:selectedPassage?.field === writingTarget ? selectedPassage.text : snapshot[writingTarget] || '', instruction:writingDirection, field:writingTarget, originalText:snapshot[writingTarget] || '' }, {}, {signal:writingAbort.current.signal});
      if (!activeEditor.current) return;
      if (!response.guidance?.trim()) throw new Error('No suggestion returned. Please try again.');
      const revised = response.guidance.trim();
      const source = snapshot[writingTarget] || '';
      const improvements = { [writingTarget]:selectedPassage?.field === writingTarget ? source.slice(0,selectedPassage.start) + revised + source.slice(selectedPassage.end) : revised };
      onWritingModalUpdate({show:true,type:'success',requestId:Date.now(),improvements,originalForm:snapshot,updatedForm:{...snapshot,...improvements},onApplyChanges:(edits,modes)=>{
        const before = {...formRef.current};
        const conflicts = writingConflicts(before,snapshot,edits,modes);
        if (conflicts.length) return {conflicts};
        const next = applyWritingEdits(before,edits,modes);
        setOriginalForm({before,applied:Object.fromEntries(Object.keys(edits).map(field=>[field,next[field]]))});setUndoMessage('');setHasWritingBackup(true);persistDraft(next);setForm(next);onFormUpdate?.(next);
      }});
    } catch(error) { if (!activeEditor.current || error.name === 'AbortError') return; onWritingModalUpdate({show:true,type:'error',message:error.message || 'Could not prepare a suggestion. Your draft is unchanged.'}); }
    finally { setIsWritingLoading(false); }
  };

  // Generate plain-text suggestions separately so every supported model uses the same contract.
  const handleWritingCleanup = async (currentForm, formType) => {
    const eligible = formType === 'goals' || formType === 'superpowers' ? ['description','notes'] : formType === 'mentees' ? ['notes','whatYouTeach','whatYouLearn'] : ['notes','whatToLearn','whatTheyGet'];
    const fields = eligible.filter(field => currentForm[field]?.trim());
    if (!fields.length) { onWritingModalUpdate({show:true,type:'info',message:'Add a little text first, or use the writing instructions to start a draft.'}); return; }
    setIsWritingLoading(true);
    writingAbort.current = new AbortController();
    const instruction = [null, 'Correct spelling and grammar only. Preserve my structure, meaning, facts, and voice.', 'Improve clarity and flow. Preserve my meaning, facts, and voice.', 'Improve clarity, structure, and impact. Preserve all facts and meaning. Do not invent details.'][enhancementLevel];
    try {
      const improvements = {};
      let cursor = 0;
      await Promise.all(Array.from({length:Math.min(2,fields.length)}, async () => {
        while(cursor < fields.length) {
          const field = fields[cursor++];
          const response = await getAIGuidance('writing_refine', {text:currentForm[field],originalText:currentForm[field],field,instruction}, {}, {signal:writingAbort.current.signal});
          if (!activeEditor.current) return;
          improvements[field] = response.guidance.trim();
        }
      }));
      if (!activeEditor.current) return;
      onWritingModalUpdate({show:true,type:'success',requestId:Date.now(),improvements,originalForm:{...currentForm},updatedForm:{...currentForm,...improvements},onApplyChanges:(edits,modes)=>{
        const before = {...formRef.current};
        const conflicts = writingConflicts(before,currentForm,edits,modes);
        if (conflicts.length) return {conflicts};
        const next = applyWritingEdits(before,edits,modes);
        setOriginalForm({before,applied:Object.fromEntries(Object.keys(edits).map(field=>[field,next[field]]))});setUndoMessage('');setHasWritingBackup(true);persistDraft(next);setForm(next);onFormUpdate?.(next);
      }});
    } catch(error) {
      writingAbort.current?.abort();
      if (activeEditor.current && error.name !== 'AbortError') onWritingModalUpdate({show:true,type:'error',message:error.message || 'Could not prepare suggestions. Your draft is unchanged.'});
    } finally { if (activeEditor.current) setIsWritingLoading(false); }
  };

  const handleWritingRollback = () => {
    if (!originalForm) return;
    const result = undoWritingEdits(formRef.current, originalForm.before, originalForm.applied);
    persistDraft(result.form);
    setForm(result.form);
    onFormUpdate?.(result.form);
    setUndoMessage(result.conflicts.length ? `Kept your newer changes to ${result.conflicts.map(fieldLabel).join(', ')}. Other applied writing changes were undone.` : 'Last AI addition or edit undone. Your other edits are still here.');
    setHasWritingBackup(false);
    setOriginalForm(null);
  };

  // Helper to get level label
  const getLevelLabel = (level) => {
    switch (level) {
      case 1: return 'Basic';
      case 2: return 'Clarity';
      case 3: return 'Full';
      default: return 'Level ' + level;
    }
  };

  return (
    <>
    <div className="modal entry-editor" onClick={handleOverlayClick} style={{display:advisorShowing?'none':undefined}}>
      <div ref={editorRef} role="dialog" aria-modal={!advisorShowing} aria-label="Edit board entry" onSelect={selectPassage} onKeyDown={e=>{
        if (advisorShowing || writingResultsShowing) return;
        if(e.key==='Escape') { e.stopPropagation(); onClose(); }
        if(e.key==='Tab') {
          const controls=[...editorRef.current.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled)')];
          if(e.shiftKey && document.activeElement===controls[0]) {e.preventDefault();controls[controls.length-1]?.focus();}
          else if(!e.shiftKey && document.activeElement===controls[controls.length-1]) {e.preventDefault();controls[0]?.focus();}
        }
      }} className="modal-content" style={{maxWidth:isGoals?'600px':'900px'}}>
        <h2>{item ? 'Edit' : 'Add'} {isGoals ? 'Goal' : type === 'coaches' ? 'Coach' : type.slice(0, -1)}</h2>
        
        {recoveredDraft && <div className="writing-toolbox" role="status"><p>An unfinished draft is available from this browser session.</p><button onClick={()=>{setForm(recoveredDraft);onFormUpdate?.(recoveredDraft);setRecoveredDraft(null);}}>Restore draft</button> <button onClick={()=>{sessionStorage.removeItem(draftKey);setRecoveredDraft(null);}}>Discard recovered draft</button></div>}
        {isGoals ? (
          <>
            <input aria-label={fieldLabel("timeframe")} name="timeframe" placeholder="Timeframe" value={form.timeframe} onChange={handleChange} disabled={item ? true : false} />
            <textarea aria-label={fieldLabel("description")} name="description" placeholder="Describe your goals for this timeframe..." value={form.description || ''} onChange={handleChange}></textarea>
            <textarea aria-label={fieldLabel("notes")} name="notes" placeholder="Notes on strategy, progress, or milestones..." value={form.notes || ''} onChange={handleChange}></textarea>
          </>
        ) : isSuperpowers ? (
          <>
            <input aria-label={fieldLabel("name")} name="name" placeholder="Skill Category" value={form.name} onChange={handleChange} disabled={item ? true : false} />
            <textarea aria-label={fieldLabel("description")} name="description" placeholder="Describe your expertise in this area..." value={form.description || ''} onChange={handleChange} style={{minHeight: '120px'}}></textarea>
            <textarea aria-label={fieldLabel("notes")} name="notes" placeholder="Specific examples, certifications, achievements..." value={form.notes || ''} onChange={handleChange} style={{minHeight: '80px'}}></textarea>
          </>
        ) : isMentees ? (
          <div style={{display: 'flex', gap: '40px'}}>
            <div style={{flex: 1}}>
              <h3 style={{color: '#2563eb', fontSize: '0.9em', marginBottom: '8px'}}>Basic Information</h3>
              <input aria-label={fieldLabel("name")} name="name" placeholder="Name" value={form.name} onChange={handleChange} />
              <input aria-label={fieldLabel("role")} name="role" placeholder="Role" value={form.role} onChange={handleChange} />
              <label style={{display: 'block', color: '#6b7280', fontSize: '14px', marginBottom: '4px', marginTop: '12px'}}>Connection Level</label>
              <select name="connection" value={form.connection} onChange={handleChange}>
                {connectionLevels.map(level => (
                  <option key={level}>{level}</option>
                ))}
              </select>
              <div className="cadence-slider-container">
                <label>Cadence: <span className="cadence-value">{cadenceOptions[cadenceIndex]}</span></label>
                <input 
                  type="range" 
                  min="0" 
                  max={cadenceOptions.length - 1} 
                  value={cadenceIndex} 
                  onChange={handleCadenceChange}
                  className="cadence-slider"
                />
                <div className="cadence-labels">
                  {cadenceOptions.map((opt, idx) => (
                    <span key={idx} className={`cadence-label ${idx === cadenceIndex ? 'active' : ''}`}>
                      {opt}
                    </span>
                  ))}
                </div>
              </div>
              <textarea aria-label={fieldLabel("notes")} name="notes" placeholder="Notes" value={form.notes} onChange={handleChange}></textarea>
            </div>
            <div style={{flex: 1}}>
              <h3 style={{color: '#10b981', fontSize: '0.9em', marginBottom: '8px'}}>What You Teach Them</h3>
              <textarea aria-label={fieldLabel("whatYouTeach")} name="whatYouTeach"
                placeholder="What knowledge, skills, or guidance do you provide to this person?" 
                value={form.whatYouTeach || ''} 
                onChange={handleChange}
                style={{minHeight: '100px'}}
              ></textarea>
              <h3 style={{color: '#8b5cf6', fontSize: '0.9em', marginBottom: '8px', marginTop: '16px'}}>What You Learn From Them</h3>
              <textarea aria-label={fieldLabel("whatYouLearn")} name="whatYouLearn"
                placeholder="What fresh perspectives, skills, or insights do you gain from them?" 
                value={form.whatYouLearn || ''} 
                onChange={handleChange}
                style={{minHeight: '100px'}}
              ></textarea>
            </div>
          </div>
        ) : (
          <div style={{display: 'flex', gap: '40px'}}>
            <div style={{flex: 1}}>
              <h3 style={{color: '#2563eb', fontSize: '0.9em', marginBottom: '8px'}}>Basic Information</h3>
              <input aria-label={fieldLabel("name")} name="name" placeholder="Name" value={form.name} onChange={handleChange} />
              <input aria-label={fieldLabel("role")} name="role" placeholder="Role" value={form.role} onChange={handleChange} />
              <label style={{display: 'block', color: '#6b7280', fontSize: '14px', marginBottom: '4px', marginTop: '12px'}}>Connection Level</label>
              <select name="connection" value={form.connection} onChange={handleChange}>
                {connectionLevels.map(level => (
                  <option key={level}>{level}</option>
                ))}
              </select>
              <div className="cadence-slider-container">
                <label>Cadence: <span className="cadence-value">{cadenceOptions[cadenceIndex]}</span></label>
                <input 
                  type="range" 
                  min="0" 
                  max={cadenceOptions.length - 1} 
                  value={cadenceIndex} 
                  onChange={handleCadenceChange}
                  className="cadence-slider"
                />
                <div className="cadence-labels">
                  {cadenceOptions.map((opt, idx) => (
                    <span key={idx} className={`cadence-label ${idx === cadenceIndex ? 'active' : ''}`}>
                      {opt}
                    </span>
                  ))}
                </div>
              </div>
              <textarea aria-label={fieldLabel("notes")} name="notes" placeholder="Notes" value={form.notes} onChange={handleChange}></textarea>
            </div>
            <div style={{flex: 1}}>
              <h3 style={{color: '#10b981', fontSize: '0.9em', marginBottom: '8px'}}>What to Learn From Them</h3>
              <textarea aria-label={fieldLabel("whatToLearn")} name="whatToLearn"
                placeholder="What knowledge, skills, or insights do you want to gain from this person?" 
                value={form.whatToLearn || ''} 
                onChange={handleChange}
                style={{minHeight: '100px'}}
              ></textarea>
              <h3 style={{color: '#8b5cf6', fontSize: '0.9em', marginBottom: '8px', marginTop: '16px'}}>What They Get From You</h3>
              <textarea aria-label={fieldLabel("whatTheyGet")} name="whatTheyGet"
                placeholder="What value, perspective, or benefit can you provide to them?" 
                value={form.whatTheyGet || ''} 
                onChange={handleChange}
                style={{minHeight: '100px'}}
              ></textarea>
            </div>
          </div>
        )}

        {undoMessage && <p role="status" className="writing-status">{undoMessage}</p>}
        <section className="writing-toolbox" aria-label="Writing assistance">
          <h3>A little help finding the words</h3>
          <p>Choose a field and tell AI what you need. You can edit every suggestion before applying it.</p>
          <select aria-label="Field to improve" value={writingTarget} onChange={e=>{setWritingTarget(e.target.value);setSelectedPassage(null);}}>
            {(isGoals || isSuperpowers ? ['description','notes'] : isMentees ? ['notes','whatYouTeach','whatYouLearn'] : ['notes','whatToLearn','whatTheyGet']).map(field=><option key={field} value={field}>{fieldLabel(field)}</option>)}
          </select>
          {selectedPassage && <p>Working on selected text: “{selectedPassage.text.length > 90 ? selectedPassage.text.slice(0,90) + '…' : selectedPassage.text}” <button onClick={()=>setSelectedPassage(null)}>Use whole field</button></p>}
          <div className="writing-direction"><input aria-label="Writing instructions" placeholder="e.g. Make this clearer while keeping my voice" value={writingDirection} onChange={e=>setWritingDirection(e.target.value)} /><button onClick={suggestForField} disabled={isWritingLoading || !writingDirection.trim()}>{isWritingLoading ? 'Preparing…' : 'Suggest an edit'}</button></div>
        </section>
        <div className="modal-buttons">
          <Tooltip text="Save this board member or goal">
            <button onClick={save}>Save</button>
          </Tooltip>
          {boardData && (
            <>

              {/* Removed duplicate Enhanced Versions selector - this was causing the duplicate selector issue */}

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <Tooltip text="Polish grammar, spelling, and writing style">
                  <button
                    onClick={() => handleWritingCleanup(form, type)}
                    style={{
                      backgroundColor: '#8b5cf6',
                      color: 'white',
                      position: 'relative'
                    }}
                    disabled={isWritingLoading}
                  >
                    {isWritingLoading ? (
                      <>
                        <span style={{ opacity: 0.7 }}>✨ Preparing suggestions...</span>
                      </>
                    ) : (
                      <>
                        ✨ Improve writing

                    </>
                  )}
                </button>
                </Tooltip>

                {hasWritingBackup && <button className="writing-text-button" onClick={handleWritingRollback}>Undo last AI addition or edit</button>}
                {/* Level selector anchored below Polish button */}
                {!writingResultsShowing && (
                  <Tooltip text={`Level ${enhancementLevel} (${getLevelLabel(enhancementLevel)}): Polish grammar, spelling, and writing style`}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 8px',
                      backgroundColor: '#f3f4f6',
                      borderRadius: '6px',
                      border: '1px solid #e5e7eb'
                    }}>
                    <button
                      onClick={() => setEnhancementLevel(Math.max(1, enhancementLevel - 1))}
                      disabled={enhancementLevel <= 1 || isWritingLoading}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: enhancementLevel <= 1 ? '#d1d5db' : '#374151',
                        cursor: enhancementLevel <= 1 ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        padding: '2px 4px'
                      }}
                      title="Decrease enhancement level"
                    >
                      ←
                    </button>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#374151',
                      minWidth: '45px',
                      textAlign: 'center'
                    }}>
                      {enhancementLevel} - {getLevelLabel(enhancementLevel)}
                    </span>
                    <button
                      onClick={() => setEnhancementLevel(Math.min(3, enhancementLevel + 1))}
                      disabled={enhancementLevel >= 3 || isWritingLoading}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: enhancementLevel >= 3 ? '#d1d5db' : '#374151',
                        cursor: enhancementLevel >= 3 ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        padding: '2px 4px'
                      }}
                      title="Increase enhancement level"
                    >
                      →
                    </button>
                    </div>
                  </Tooltip>
                )}
              </div>
              <Tooltip text="Get AI-powered guidance and recommendations for this entry">
                <button
                  onClick={() => setAdvisorShowing(true)}
                  style={{
                    backgroundColor: '#10b981',
                    color: 'white'
                  }}
                >
                  Get advice
                </button>
              </Tooltip>
            </>
          )}
          <Tooltip text="Cancel and close this form">
            <button onClick={onClose}>Cancel</button>
          </Tooltip>
        </div>
      </div>
    </div>
    <AdvisorWorkspace open={advisorShowing} onClose={()=>setAdvisorShowing(false)} type={type} form={form} boardData={boardData} entryIndex={entryIndex} onApply={(content,field)=>{
      const before={...formRef.current};
      const next=applyWritingEdits(before,{[field]:content},{[field]:'append'});
      setOriginalForm({before,applied:{[field]:next[field]}});setUndoMessage('');setHasWritingBackup(true);persistDraft(next);setForm(next);onFormUpdate?.(next);
    }}/>
    </>
  );
}

function PodcastModal({ onClose }) {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(100); // Placeholder duration
  const [isPlaying, setIsPlaying] = useState(true);
  const [player, setPlayer] = useState(null);

  useEffect(() => {
    // YouTube API integration
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      const ytPlayer = new window.YT.Player('youtube-player', {
        height: '1',
        width: '1',
        videoId: '-q0kkriJVZM',
        playerVars: {
          autoplay: 1,
          loop: 1,
          playlist: '-q0kkriJVZM'
        },
        events: {
          onReady: (event) => {
            setPlayer(event.target);
            setDuration(event.target.getDuration());
            // Update time every second
            const interval = setInterval(() => {
              if (event.target && event.target.getCurrentTime) {
                setCurrentTime(event.target.getCurrentTime());
              }
            }, 1000);
            return () => clearInterval(interval);
          }
        }
      });
    };

    return () => {
      if (player) {
        player.destroy();
      }
    };
  }, []);

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTimelineClick = (e) => {
    if (!player) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const newTime = (clickX / width) * duration;
    player.seekTo(newTime);
    setCurrentTime(newTime);
  };

  const handleBack15 = () => {
    if (!player) return;
    const newTime = Math.max(0, currentTime - 15);
    player.seekTo(newTime);
    setCurrentTime(newTime);
  };

  const handleRestart = () => {
    if (!player) return;
    player.seekTo(0);
    setCurrentTime(0);
  };

  const handlePlayPause = () => {
    if (!player) return;
    if (isPlaying) {
      player.pauseVideo();
    } else {
      player.playVideo();
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="modal" onClick={handleOverlayClick}>
      <div className="modal-content" style={{maxWidth: '500px', padding: '30px'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
          <h2 style={{margin: 0}}>🎧 Personal Board Podcast</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#6b7280',
              padding: '4px'
            }}
          >
            ×
          </button>
        </div>

        <div style={{
          textAlign: 'center',
          padding: '20px',
          backgroundColor: '#f9fafb',
          borderRadius: '12px',
          marginBottom: '20px'
        }}>
          <div style={{
            display: 'inline-block',
            padding: '20px',
            backgroundColor: '#8b5cf6',
            borderRadius: '50%',
            marginBottom: '16px'
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="white">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
            </svg>
          </div>

          <h3 style={{marginBottom: '12px', color: '#374151'}}>Now Playing</h3>
          <p style={{color: '#6b7280', marginBottom: '20px'}}>Listen to the audio version of our Personal Board of Directors overview</p>

          {/* Hidden YouTube player for audio only */}
          <div id="youtube-player" style={{
            position: 'absolute',
            left: '-9999px',
            top: '-9999px'
          }}></div>

          {/* Timeline Progress Bar */}
          <div style={{marginBottom: '20px'}}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '12px',
              color: '#6b7280',
              marginBottom: '8px'
            }}>
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
            <div
              onClick={handleTimelineClick}
              style={{
                width: '100%',
                height: '6px',
                backgroundColor: '#e5e7eb',
                borderRadius: '3px',
                cursor: 'pointer',
                position: 'relative'
              }}
            >
              <div
                style={{
                  width: `${(currentTime / duration) * 100}%`,
                  height: '100%',
                  backgroundColor: '#8b5cf6',
                  borderRadius: '3px',
                  transition: 'width 0.3s ease'
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '-2px',
                  left: `${(currentTime / duration) * 100}%`,
                  transform: 'translateX(-50%)',
                  width: '10px',
                  height: '10px',
                  backgroundColor: '#8b5cf6',
                  borderRadius: '50%',
                  cursor: 'grab'
                }}
              />
            </div>
          </div>

          {/* Control Buttons */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '16px',
            marginBottom: '20px'
          }}>
            <button
              onClick={handleRestart}
              style={{
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '44px',
                height: '44px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                fontWeight: 'bold'
              }}
              title="Restart"
            >
              ↻
            </button>

            <button
              onClick={handleBack15}
              style={{
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '44px',
                height: '44px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 'bold'
              }}
              title="Back 15 seconds"
            >
              -15s
            </button>

            <button
              onClick={handlePlayPause}
              style={{
                backgroundColor: '#8b5cf6',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '44px',
                height: '44px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                fontWeight: 'bold'
              }}
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? '||' : '▶'}
            </button>
          </div>

          {/* Visual audio player representation */}
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '8px',
            padding: '16px'
          }}>
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'}}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div
                  key={i}
                  className="audio-wave-bar"
                  style={{
                    width: '3px',
                    height: `${20 + i * 3}px`,
                    backgroundColor: 'white',
                    borderRadius: '3px',
                    animation: isPlaying ? `wave ${0.8}s ease-in-out infinite` : 'none',
                    animationDelay: `${i * 0.1}s`,
                    opacity: isPlaying ? 1 : 0.5
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="modal-buttons">
          <button onClick={onClose} style={{
            width: '100%',
            padding: '12px',
            backgroundColor: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '500',
            cursor: 'pointer'
          }}>
            Stop Listening
          </button>
        </div>
      </div>
    </div>
  );
}

function VideoModal({ onClose }) {
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal" onClick={handleOverlayClick}>
      <div className="modal-content" style={{maxWidth: '800px', padding: '20px'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
          <h2 style={{margin: 0}}>Personal Board of Directors Overview</h2>
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#6b7280',
              padding: '4px'
            }}
          >
            ×
          </button>
        </div>
        
        <div style={{position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden'}}>
          <iframe 
            width="560" 
            height="315" 
            src="https://www.youtube.com/embed/hiiEeMN7vbQ?si=GEMzvg9eG3Kx95zR" 
            title="YouTube video player" 
            frameBorder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
            referrerPolicy="strict-origin-when-cross-origin" 
            allowFullScreen
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%'
            }}
          >
          </iframe>
        </div>
        
        <div className="modal-buttons" style={{marginTop: '20px'}}>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function MentorVideoModal({ onClose }) {
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };
  
  return (
    <div className="modal" onClick={handleOverlayClick}>
      <div className="modal-content" style={{maxWidth: '800px', padding: '20px'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
          <h2 style={{margin: 0}}>Mentors: Building Your Advisory Network</h2>
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#6b7280',
              padding: '4px'
            }}
          >
            ×
          </button>
        </div>
        
        <div style={{position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden'}}>
          <iframe 
            width="560" 
            height="315" 
            src="https://www.youtube.com/embed/fATAT6L9o5k?si=IYaO25tXf2Y5JvQY" 
            title="YouTube video player" 
            frameBorder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
            referrerPolicy="strict-origin-when-cross-origin" 
            allowFullScreen
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%'
            }}
          >
          </iframe>
        </div>
        
        <div className="modal-buttons" style={{marginTop: '20px'}}>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function CoachVideoModal({ onClose }) {
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };
  
  return (
    <div className="modal" onClick={handleOverlayClick}>
      <div className="modal-content" style={{maxWidth: '800px', padding: '20px'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
          <h2 style={{margin: 0}}>Coaches: Developing Your Skills</h2>
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#6b7280',
              padding: '4px'
            }}
          >
            ×
          </button>
        </div>
        
        <div style={{position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden'}}>
          <iframe 
            width="560" 
            height="315" 
            src="https://www.youtube.com/embed/oHDq1PcYkT4?si=joLEqG_YBsqOEhf3" 
            title="YouTube video player" 
            frameBorder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
            referrerPolicy="strict-origin-when-cross-origin" 
            allowFullScreen
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%'
            }}
          >
          </iframe>
        </div>
        
        <div className="modal-buttons" style={{marginTop: '20px'}}>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function GoalsVideoModal({ onClose }) {
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };
  
  return (
    <div className="modal" onClick={handleOverlayClick}>
      <div className="modal-content" style={{maxWidth: '800px', padding: '20px'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
          <h2 style={{margin: 0}}>Goals: Setting Your Direction</h2>
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#6b7280',
              padding: '4px'
            }}
          >
            ×
          </button>
        </div>
        
        <div style={{position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden'}}>
          <iframe 
            width="560" 
            height="315" 
            src="https://www.youtube.com/embed/TKVAGxoU2AM?si=lXKoRPcJXSDovqJF" 
            title="YouTube video player" 
            frameBorder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
            referrerPolicy="strict-origin-when-cross-origin" 
            allowFullScreen
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%'
            }}
          >
          </iframe>
        </div>
        
        <div className="modal-buttons" style={{marginTop: '20px'}}>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function BoardVideoModal({ onClose }) {
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };
  
  return (
    <div className="modal" onClick={handleOverlayClick}>
      <div className="modal-content" style={{maxWidth: '800px', padding: '20px'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
          <h2 style={{margin: 0}}>Grit: The Power of Passion and Perseverance</h2>
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#6b7280',
              padding: '4px'
            }}
          >
            ×
          </button>
        </div>
        
        <div style={{position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden'}}>
          <iframe 
            width="560" 
            height="315" 
            src="https://www.youtube.com/embed/H14bBuluwB8?si=mjR56k6I8P68JSm9" 
            title="YouTube video player" 
            frameBorder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
            referrerPolicy="strict-origin-when-cross-origin" 
            allowFullScreen
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%'
            }}
          >
          </iframe>
        </div>
        
        <div className="modal-buttons" style={{marginTop: '20px'}}>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function AuthModal({ accessCode, setAccessCode, onAuthenticate, onClose, error, loading }) {
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (accessCode.trim()) {
      onAuthenticate();
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6); // Only allow 6 digits
    setAccessCode(value);
  };

  return (
    <div className="modal" onClick={handleOverlayClick}>
      <div className="modal-content" style={{maxWidth: '500px'}}>
        <div className="modal-header">
          <h2>AI-Powered Analysis Access</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <p style={{marginBottom: '20px', color: '#666'}}>
            To access personalized AI-powered guidance and analysis, please enter your 6-digit access code from your facilitated workshop.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="access-code">Access Code</label>
              <input
                id="access-code"
                type="text"
                value={accessCode}
                onChange={handleInputChange}
                placeholder="000000"
                maxLength="6"
                pattern="\d{6}"
                style={{
                  fontSize: '18px',
                  textAlign: 'center',
                  letterSpacing: '2px',
                  fontFamily: 'monospace'
                }}
                disabled={loading}
                autoFocus
              />
              <small style={{color: '#666'}}>Enter exactly 6 digits</small>
            </div>

            {error && (
              <div style={{
                backgroundColor: '#ffebee',
                color: '#c62828',
                padding: '12px',
                borderRadius: '4px',
                marginBottom: '16px',
                border: '1px solid #ffcdd2'
              }}>
                {error}
              </div>
            )}

            <div className="modal-buttons" style={{marginTop: '20px'}}>
              <button type="button" onClick={onClose} disabled={loading}>
                Cancel
              </button>
              <button
                type="submit"
                className="primary"
                disabled={loading || accessCode.length !== 6}
              >
                {loading ? 'Activating...' : 'Activate Access'}
              </button>
            </div>
          </form>

          <div style={{marginTop: '20px', padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '4px'}}>
            <small style={{color: '#666'}}>
              <strong>Don't have an access code?</strong><br/>
              Access codes are provided during facilitated workshops.
              Contact your facilitator or workshop organizer for assistance.
            </small>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConnectorsVideoModal({ onClose }) {
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };
  
  return (
    <div className="modal" onClick={handleOverlayClick}>
      <div className="modal-content" style={{maxWidth: '800px', padding: '20px'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
          <h2 style={{margin: 0}}>Connectors: Expanding Your Network</h2>
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#666'
            }}
          >
            ×
          </button>
        </div>
        
        <div style={{position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden'}}>
          <iframe 
            width="560" 
            height="315" 
            src="https://www.youtube.com/embed/xFrqZjIDE44?si=StsoXN5-r0tNDqxj" 
            title="YouTube video player" 
            frameBorder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
            referrerPolicy="strict-origin-when-cross-origin" 
            allowFullScreen
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%'
            }}
          >
          </iframe>
        </div>
        
        <div className="modal-buttons" style={{marginTop: '20px'}}>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function SponsorsVideoModal({ onClose }) {
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };
  
  return (
    <div className="modal" onClick={handleOverlayClick}>
      <div className="modal-content" style={{maxWidth: '800px', padding: '20px'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
          <h2 style={{margin: 0}}>Sponsors: Your Career Advocates</h2>
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#666'
            }}
          >
            ×
          </button>
        </div>
        
        <div style={{position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden'}}>
          <iframe 
            width="560" 
            height="315" 
            src="https://www.youtube.com/embed/gpE_W50OTUc?si=9qnx6BTE17hBtuhg" 
            title="YouTube video player" 
            frameBorder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
            referrerPolicy="strict-origin-when-cross-origin" 
            allowFullScreen
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%'
            }}
          >
          </iframe>
        </div>
        
        <div className="modal-buttons" style={{marginTop: '20px'}}>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function PeersVideoModal({ onClose }) {
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };
  
  return (
    <div className="modal" onClick={handleOverlayClick}>
      <div className="modal-content" style={{maxWidth: '800px', padding: '20px'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
          <h2 style={{margin: 0}}>Peers: Your Journey Companions</h2>
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#666'
            }}
          >
            ×
          </button>
        </div>
        
        <div style={{position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden'}}>
          <iframe 
            width="560" 
            height="315" 
            src="https://www.youtube.com/embed/AMG8ObDmbaM?si=CDaXJGXj_WLhqd5W" 
            title="YouTube video player" 
            frameBorder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
            referrerPolicy="strict-origin-when-cross-origin" 
            allowFullScreen
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%'
            }}
          >
          </iframe>
        </div>
        
        <div className="modal-buttons" style={{marginTop: '20px'}}>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function ChangeRoleModal({ member, oldType, onChangeRole, onClose }) {
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const boardMemberTypes = [
    { key: 'mentors', label: 'Mentors', description: 'Wisdom & strategic guidance' },
    { key: 'coaches', label: 'Coaches', description: 'Skills & performance building' },
    { key: 'sponsors', label: 'Sponsors', description: 'Advocacy & door opening' },
    { key: 'connectors', label: 'Connectors', description: 'Network expansion' },
    { key: 'peers', label: 'Peers', description: 'Mutual support & collaboration' }
  ];

  const handleRoleSelect = (newType) => {
    onChangeRole(newType);
  };

  return (
    <div className="modal" onClick={handleOverlayClick}>
      <div className="modal-content" style={{maxWidth: '500px'}}>
        <div className="modal-header">
          <h2>Change Role for {member?.name}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <p style={{marginBottom: '20px', color: '#666'}}>
            Currently: <strong>{oldType?.charAt(0).toUpperCase() + oldType?.slice(1, -1)}</strong>
          </p>
          <p style={{marginBottom: '20px', color: '#666'}}>
            Select a new role for this board member:
          </p>

          <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
            {boardMemberTypes.map(type => (
              <button
                key={type.key}
                onClick={() => handleRoleSelect(type.key)}
                disabled={type.key === oldType}
                style={{
                  padding: '16px 20px',
                  border: `2px solid ${type.key === oldType ? '#e5e7eb' : '#2563eb'}`,
                  borderRadius: '8px',
                  background: type.key === oldType ? '#f9fafb' : 'white',
                  color: type.key === oldType ? '#9ca3af' : '#1f2937',
                  cursor: type.key === oldType ? 'not-allowed' : 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s ease',
                  opacity: type.key === oldType ? 0.5 : 1
                }}
                onMouseOver={(e) => {
                  if (type.key !== oldType) {
                    e.target.style.backgroundColor = '#eff6ff';
                    e.target.style.borderColor = '#1d4ed8';
                  }
                }}
                onMouseOut={(e) => {
                  if (type.key !== oldType) {
                    e.target.style.backgroundColor = 'white';
                    e.target.style.borderColor = '#2563eb';
                  }
                }}
              >
                <div style={{fontWeight: '600', fontSize: '16px', marginBottom: '4px'}}>
                  {type.label}
                </div>
                <div style={{fontSize: '14px', opacity: 0.8}}>
                  {type.description}
                </div>
              </button>
            ))}
          </div>

          <div style={{
            marginTop: '20px',
            padding: '12px',
            backgroundColor: '#fef3c7',
            border: '1px solid #f59e0b',
            borderRadius: '6px'
          }}>
            <p style={{margin: 0, fontSize: '14px', color: '#92400e'}}>
              💡 All member details (notes, learnings, etc.) will be preserved when changing roles.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
