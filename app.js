import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { jsPDF } from 'jspdf';
import { connectionLevels } from './utils.js';
import { getMentorAdvisorGuidance, getBoardMemberAdvisorGuidance, getGoalsAdvisorGuidance, getBoardAnalysisAdvisorGuidance, isAuthenticated, validateAccessCode, getAIGuidance } from './ai-client.js';
import { FeedbackButton } from './feedback.js';
import './feedback.css';
// use direct paths so images resolve without a bundler


const pages = [
  { key: 'intro', title: 'Intro', image: '/images/Slide2.png', quote: '', quotePosition: 'center' },
  { key: 'you', title: 'You', image: '/images/Slide11.png', quote: 'Know yourself first.', quotePosition: 'bottom-left' },
  { key: 'goals', title: 'Goals', image: '/images/Slide12.png', quote: 'Your vision shapes your board.', quotePosition: 'bottom-right' },
  { key: 'mentors', title: 'Mentors', image: '/images/Slide7.png', quote: 'A mentor opens doors.', quotePosition: 'bottom-right' },
  { key: 'coaches', title: 'Coaches', image: '/images/Slide6.png', quote: 'Coaches refine potential.', quotePosition: 'bottom-left' },
  { key: 'connectors', title: 'Connectors', image: '/images/Slide4.png', quote: 'Connections spark growth.', quotePosition: 'center' },
  { key: 'sponsors', title: 'Sponsors', image: '/images/Slide8.png', quote: 'Sponsorship elevates.', quotePosition: 'bottom-right' },
  { key: 'peers', title: 'Peers', image: '/images/Slide9.png', quote: 'Peers share the path.', quotePosition: 'bottom-right' },
  { key: 'board', title: 'Board', image: '/images/Slide10.png', quote: '', quotePosition: 'center' }
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
  const [current, setCurrent] = useState('intro');
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
  const [showAdvisorModal, setShowAdvisorModal] = useState(false);
  const [advisorGuidance, setAdvisorGuidance] = useState(null);
  const [advisorLoading, setAdvisorLoading] = useState(false);
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
    setShowAdvisorModal(false); // Close advisor modal when saving
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

  const handleAdvise = async (currentFormData, modalFormType) => {
    // Check authentication first
    if (!isAuthenticated()) {
      setShowAuthModal(true);
      return;
    }

    // Use the type passed from FormModal to ensure we're using the correct type
    const typeToUse = modalFormType || formType;

    setAdvisorLoading(true);
    setShowAdvisorModal(true);

    try {
      // Create comprehensive user data like the backup function does
      let completeUserData = { ...data };

      // Merge in current form data if editing (unsaved changes)
      if (currentFormData && typeToUse) {
        if (typeToUse === 'goals') {
          completeUserData = {
            ...completeUserData,
            goals: [
              ...(data.goals || []).filter((_, index) => index !== editingIndex),
              currentFormData
            ]
          };
        } else if (typeToUse === 'superpowers') {
          completeUserData = {
            ...completeUserData,
            you: {
              ...(data.you || {}),
              superpowers: [
                ...(data.you?.superpowers || []).filter((_, index) => index !== editingIndex),
                currentFormData
              ]
            }
          };
        } else if (typeToUse !== 'board') {
          // For board member types (mentors, coaches, etc.)
          completeUserData = {
            ...completeUserData,
            [typeToUse]: [
              ...(data[typeToUse] || []).filter((_, index) => index !== editingIndex),
              currentFormData
            ]
          };
        }
      }

      console.log('Complete user data being sent to AI:', completeUserData);

      let result;

      if (typeToUse === 'goals') {
        // Goals advisor
        result = await getGoalsAdvisorGuidance(
          currentFormData,
          completeUserData.goals || [],
          completeUserData // Pass complete user data
        );
      } else if (typeToUse === 'superpowers') {
        // Skills advisor - use skills_advisor type for active prompt selection
        result = await getAIGuidance('skills_advisor', {
          currentFormData,
          allSkills: completeUserData.superpowers || [],
          boardData: completeUserData
        });
      } else if (typeToUse === 'board') {
        // Board analysis advisor - show inline instead of modal
        setShowAdvisorModal(false);
        setAdvisorLoading(false);
        await getBoardAdvice();
        return;
      } else {
        // Board member advisor - first check for member-specific prompt, then fallback to board_member_advisor
        const learnContentMap = {
          'mentors': "Senior leaders who provide wisdom, guidance, and strategic advice. They help you see the bigger picture, understand industry dynamics, and make important career decisions. Mentors typically meet quarterly and focus on long-term career development rather than day-to-day issues.",
          'coaches': "Skilled practitioners who help you develop specific competencies and improve performance. They provide hands-on guidance, practical feedback, and help you build concrete skills. Coaches often meet weekly or bi-weekly and focus on immediate skill development and performance improvement.",
          'sponsors': "Senior leaders with organizational influence who advocate for your advancement behind closed doors. They champion your career, open doors to opportunities, and help position you for promotions. Sponsors use their political capital and networks to advance your career.",
          'connectors': "Well-networked individuals who excel at making introductions and expanding your professional network. They know people across industries and functions, and are generous with their connections. Connectors help you meet the right people at the right time.",
          'peers': "Colleagues at similar career levels who provide mutual support, collaboration, and shared learning. They offer different perspectives, help you navigate challenges, and can become long-term professional allies. Peer relationships are typically reciprocal and ongoing."
        };

        const learnContent = learnContentMap[typeToUse] || learnContentMap['mentors'];

        // Lambda will check for specific advisor type (e.g., 'mentors_advisor') first,
        // then fallback to 'board_member_advisor' if no active prompt is set
        result = await getAIGuidance(`${typeToUse}_advisor`, {
          memberType: typeToUse,
          currentFormData,
          goals: completeUserData.goals || [],
          learnContent,
          existingMembers: completeUserData
        });
      }

      console.log('AI Guidance Result:', result);
      console.log('Guidance text:', result?.guidance);
      setAdvisorGuidance(result.guidance);
    } catch (error) {
      console.error('Failed to get AI guidance:', error);
      setAdvisorGuidance('Sorry, I encountered an error while generating guidance. Please try again later.');
    } finally {
      setAdvisorLoading(false);
    }
  };

  const handleCopyToField = (content, fieldName) => {
    // This function will be called by the AdvisorModal to copy content to form fields
    // We need to update the editingItem with the new content appended to the specified field
    if (editingItem) {
      const currentValue = editingItem[fieldName] || '';
      const newValue = currentValue ? `${currentValue}\n\n${content}` : content;
      
      setEditingItem({
        ...editingItem,
        [fieldName]: newValue
      });
    }
  };

  const handleUpload = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const backupData = JSON.parse(ev.target.result);
        
        // Handle both old format (direct data) and new format (comprehensive backup)
        if (backupData.version && backupData.boardData) {
          // New comprehensive backup format
          setData(backupData.boardData);
          
          // Restore board advice if available
          if (backupData.boardAdvice) {
            setBoardAdvice(backupData.boardAdvice);
          }
          
          // Restore authentication tokens if available and valid
          if (backupData.auth) {
            if (backupData.auth.sessionToken) {
              try {
                // Validate token format and expiration before restoring
                const payload = JSON.parse(atob(backupData.auth.sessionToken.split('.')[1]));
                const now = Math.floor(Date.now() / 1000);
                
                if (payload.exp && payload.exp > now) {
                  // Token is still valid, restore it
                  localStorage.setItem('sessionToken', backupData.auth.sessionToken);
                  console.log('✅ Authentication token restored successfully');
                } else {
                  console.log('⚠️ Authentication token in backup has expired');
                }
              } catch (e) {
                console.log('⚠️ Invalid authentication token in backup');
              }
            }
            
            if (backupData.auth.clientId) {
              localStorage.setItem('clientId', backupData.auth.clientId);
            }
          }
          
          setShowUploadSuccess(true);
          setTimeout(() => setShowUploadSuccess(false), 3000);
        } else {
          // Legacy format (just board data)
          setData(backupData);
          setShowUploadSuccess(true);
          setTimeout(() => setShowUploadSuccess(false), 3000);
        }
      } catch (err) {
        alert('Invalid backup file. Please select a valid Personal Board backup (.json) file.');
      }
    };
    reader.readAsText(file);
  };

  const downloadJSON = () => {
    // Create comprehensive backup with auth tokens and board advice
    const backupData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      boardData: data,
      boardAdvice: boardAdvice,
      // Include auth tokens to maintain session across restore
      auth: {
        sessionToken: localStorage.getItem('sessionToken'),
        clientId: localStorage.getItem('clientId')
      }
    };
    
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'personal-board-backup.json';
    a.click();
  };

  const downloadPDF = async () => {
    // Use existing board advice if available, otherwise get it
    let currentBoardAdvice = boardAdvice;
    if (!currentBoardAdvice && Object.keys(data).some(key => data[key] && data[key].length > 0 && key !== 'goals')) {
      console.log('No existing analysis found, generating for PDF...');
      currentBoardAdvice = await getBoardAdvice();
    }
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    let currentY = 25;
    
    // Add header background
    doc.setFillColor(37, 99, 235); // Blue header
    doc.rect(0, 0, pageWidth, 45, 'F');
    
    // Title
    doc.setFontSize(28);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('Personal Board of Directors', pageWidth / 2, currentY, { align: 'center' });
    currentY += 12;
    
    // Date
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(229, 231, 235);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, currentY, { align: 'center' });
    currentY += 25;
    
    // Meeting Cadence Grid Section
    const allMembers = [];
    Object.keys(data).forEach(type => {
      if (data[type] && type !== 'goals' && type !== 'you') {
        data[type].forEach(person => {
          allMembers.push({ ...person, type });
        });
      }
    });
    
    // Define colors for all PDF sections
    const colors = {
      mentors: [16, 185, 129],
      coaches: [59, 130, 246],
      connectors: [245, 158, 11],
      sponsors: [139, 92, 246],
      peers: [239, 68, 68]
    };
    
    if (allMembers.length > 0) {
      const gridHeight = 25 + (allMembers.length * 12) + 15; // Header + rows + padding
      
      // Grid Section Background
      doc.setFillColor(249, 250, 251);
      doc.roundedRect(15, currentY - 5, pageWidth - 30, gridHeight, 3, 3, 'F');
      
      // Grid Header
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(17, 24, 39);
      doc.text('Meeting Cadence Overview', 20, currentY + 5);
      currentY += 20;
      
      // Grid column headers
      const gridStartX = 25;
      const nameColWidth = 60;
      const cadenceColWidth = 20;
      const cadenceColumns = ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Annually', 'Ad-hoc'];
      
      // Header row background
      doc.setFillColor(37, 99, 235);
      doc.rect(gridStartX, currentY - 3, nameColWidth + (cadenceColumns.length * cadenceColWidth), 12, 'F');
      
      // Header text
      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('Board Member', gridStartX + 2, currentY + 3);
      
      cadenceColumns.forEach((col, idx) => {
        const x = gridStartX + nameColWidth + (idx * cadenceColWidth);
        doc.text(col, x + cadenceColWidth/2, currentY + 3, { align: 'center' });
      });
      
      currentY += 12;
      
      // Grid rows
      
      allMembers.forEach((member, idx) => {
        // Alternating row background
        if (idx % 2 === 1) {
          doc.setFillColor(255, 255, 255);
          doc.rect(gridStartX, currentY - 2, nameColWidth + (cadenceColumns.length * cadenceColWidth), 10, 'F');
        }
        
        // Member name with type indicator
        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(17, 24, 39);
        const memberColor = colors[member.type] || [100, 100, 100];
        doc.setFillColor(...memberColor);
        doc.circle(gridStartX + 4, currentY + 2, 1.5, 'F');
        
        const memberText = `${member.name || 'Unknown'} (${member.type === 'coaches' ? 'coach' : member.type.slice(0, -1)})`;
        doc.text(memberText.substring(0, 35), gridStartX + 8, currentY + 3);
        
        // Cadence dot in appropriate column
        cadenceColumns.forEach((cadence, cadIdx) => {
          const x = gridStartX + nameColWidth + (cadIdx * cadenceColWidth);
          let showDot = false;
          
          if (cadence === 'Daily' && member.cadence === 'Daily') showDot = true;
          else if (cadence === 'Weekly' && member.cadence === 'Weekly') showDot = true;
          else if (cadence === 'Monthly' && (member.cadence === 'Monthly' || member.cadence === 'Bi-weekly')) showDot = true;
          else if (cadence === 'Quarterly' && member.cadence === 'Quarterly') showDot = true;
          else if (cadence === 'Annually' && member.cadence === 'Annually') showDot = true;
          else if (cadence === 'Ad-hoc' && member.cadence === 'Ad-hoc') showDot = true;
          
          if (showDot) {
            doc.setFillColor(...memberColor);
            doc.circle(x + cadenceColWidth/2, currentY + 2, 2, 'F');
          }
        });
        
        currentY += 10;
      });
      
      currentY += 15;
    } else {
      currentY += 10;
    }
    
    // Calculate board section height dynamically
    const boardSectionHeight = 200; // Header + table + member positions + padding

    // Check if we need a new page for the board section
    if (currentY + boardSectionHeight > pageHeight - 40) {
      doc.addPage();
      currentY = 20;
    }

    // Board Section Background
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(15, currentY - 5, pageWidth - 30, boardSectionHeight, 3, 3, 'F');

    // Visual Board Diagram
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(17, 24, 39);
    doc.text('Board Visualization', 20, currentY + 5);
    currentY += 15;
    
    // Draw table (vertical rectangle with rounded corners)
    const tableX = pageWidth / 2;
    const tableY = currentY + 35;
    const tableWidth = 50;
    const tableHeight = 65;
    
    // Add shadow effect
    doc.setFillColor(229, 231, 235);
    doc.roundedRect(tableX - tableWidth/2 + 1, tableY - tableHeight/2 + 1, tableWidth, tableHeight, 8, 8, 'F');
    
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(209, 213, 219);
    doc.setLineWidth(0.5);
    doc.roundedRect(tableX - tableWidth/2, tableY - tableHeight/2, tableWidth, tableHeight, 8, 8, 'FD');
    
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(37, 99, 235);
    doc.text('YOUR BOARD', tableX, tableY, { align: 'center' });
    
    // Position board members around table (reuse allMembers from cadence grid)
    const positions = [
      { x: 0, y: -45 }, // top center
      { x: 35, y: -30 }, // top-right
      { x: 45, y: -10 }, // right-top
      { x: 45, y: 10 }, // right-bottom
      { x: 35, y: 30 }, // bottom-right
      { x: 0, y: 45 }, // bottom center
      { x: -35, y: 30 }, // bottom-left
      { x: -45, y: 10 }, // left-bottom
      { x: -45, y: -10 }, // left-top
      { x: -35, y: -30 }, // top-left
      { x: 20, y: -40 }, // top-right extra
      { x: -20, y: -40 }, // top-left extra
      { x: 20, y: 40 }, // bottom-right extra
      { x: -20, y: 40 }, // bottom-left extra
      { x: 50, y: 25 }, // far right
    ];
    
    allMembers.slice(0, 8).forEach((member, idx) => {
      const pos = positions[idx % positions.length];
      const boxX = tableX + pos.x;
      const boxY = tableY + pos.y;
      const color = colors[member.type] || [100, 100, 100];
      
      // Draw member box with rounded corners
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(...color);
      doc.setLineWidth(1);
      doc.roundedRect(boxX - 22, boxY - 10, 44, 20, 2, 2, 'FD');
      
      // Member details
      doc.setFontSize(7);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...color);
      doc.text((member.type === 'coaches' ? 'COACH' : member.type.slice(0, -1).toUpperCase()), boxX, boxY - 3, { align: 'center' });
      
      doc.setFont(undefined, 'bold');
      doc.setTextColor(17, 24, 39);
      doc.setFontSize(8);
      doc.text((member.name || 'Unknown').substring(0, 15), boxX, boxY + 2, { align: 'center' });
      
      doc.setFont(undefined, 'normal');
      doc.setTextColor(107, 114, 128);
      doc.setFontSize(7);
      doc.text((member.role || 'Unknown').substring(0, 20), boxX, boxY + 6, { align: 'center' });
    });
    
    // Update currentY to the end of the board section
    // We need to account for: start position (where we drew background) + section height - top margin
    currentY = (currentY - 15 - 5) + boardSectionHeight; // Background start + height

    // Check if we need a new page for subsequent content
    if (currentY > pageHeight - 40) {
      doc.addPage();
      currentY = 20;
    }
    
    // Define role descriptions first
    const roleDescriptions = {
      mentors: {
        brief: 'Your Wisdom Guides',
        detail: 'Mentors are experienced professionals who have walked the path you aspire to take. They provide strategic career advice, share lessons learned from their journeys, and help you navigate complex professional decisions. A mentor opens doors by sharing their network, institutional knowledge, and hard-earned wisdom.'
      },
      coaches: {
        brief: 'Your Skill Developers',
        detail: 'Coaches focus on helping you develop specific skills and capabilities. Unlike mentors who provide broad wisdom, coaches zero in on particular areas where you need improvement and push you to achieve your potential. They provide targeted feedback, skill development strategies, and accountability for improvement.'
      },
      writing: {
        brief: 'Your Communication Engine',
        detail: 'Clear, compelling writing amplifies your ideas and creates opportunities. Strong writing skills help you articulate ideas clearly, influence decision-makers, build professional credibility, and advance your career through effective communication across all channels.'
      },
      connectors: {
        brief: 'Your Network Expanders',
        detail: 'Connectors are the social catalysts in your network – people who know everyone and love making introductions. They have extensive networks across industries and are generous with their connections. Connectors multiply your networking capacity exponentially by expanding your reach far beyond your immediate circle.'
      },
      sponsors: {
        brief: 'Your Advocates',
        detail: 'Sponsors are influential people who actively advocate for you in rooms where you\'re not present. They go beyond giving advice to actually using their political capital and influence to advance your career. While mentors give advice, sponsors take action on your behalf, recommending you for opportunities and speaking up for your contributions.'
      },
      peers: {
        brief: 'Your Journey Companions',
        detail: 'Peers are professionals at similar career stages who face comparable challenges and opportunities. They provide mutual support, shared problem-solving, and the camaraderie of people walking similar paths. Peers offer reciprocal relationships where you both give and receive support.'
      }
    };
    
    // Calculate height dynamically for role descriptions section
    const roleStartY = currentY;
    let roleHeight = 25; // Base height for title
    
    // Calculate total height needed for role descriptions
    const activeRoles = Object.keys(roleDescriptions).filter(role => data[role] && data[role].length > 0);
    activeRoles.forEach(role => {
      const lines = doc.splitTextToSize(roleDescriptions[role].detail, pageWidth - 45);
      roleHeight += 6 + (lines.length * 4) + 8; // Title height + text lines + spacing
    });
    
    // Draw background with calculated height
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(15, roleStartY - 5, pageWidth - 30, Math.min(roleHeight, pageHeight - roleStartY + 5), 3, 3, 'F');
    
    // Role Descriptions Title
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(17, 24, 39);
    doc.text('Role Descriptions', 20, currentY + 5);
    currentY += 20; // Increased spacing to prevent overlap
    
    doc.setFontSize(10);
    Object.keys(roleDescriptions).forEach(role => {
      if (data[role] && data[role].length > 0) {
        // Check if we need a new page
        if (currentY > pageHeight - 40) {
          doc.addPage();
          currentY = 20;
        }
        
        const color = colors[role] || [0, 0, 0];
        
        // Add colored bullet
        doc.setFillColor(...color);
        doc.circle(22, currentY - 1, 2, 'F');
        
        // Role name with brief title
        doc.setFont(undefined, 'bold');
        doc.setTextColor(...color);
        doc.setFontSize(11);
        const roleTitle = `${role.charAt(0).toUpperCase() + role.slice(1)}: ${roleDescriptions[role].brief}`;
        doc.text(roleTitle, 27, currentY);
        currentY += 6;
        
        // Detailed description
        doc.setFont(undefined, 'normal');
        doc.setTextColor(75, 85, 99);
        doc.setFontSize(9);
        const lines = doc.splitTextToSize(roleDescriptions[role].detail, pageWidth - 45);
        doc.text(lines, 27, currentY);
        currentY += lines.length * 4 + 8;
      }
    });
    
    currentY += 10;
    
    // Add new page for detailed sections
    doc.addPage();
    currentY = 20;
    
    // Detailed Member Sections Header
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, pageWidth, 30, 'F');
    
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('Board Member Details', pageWidth / 2, 18, { align: 'center' });
    currentY = 40;
    
    Object.keys(data).forEach(type => {
      if (data[type] && data[type].length > 0 && type !== 'goals') {
        // Check if we need a new page
        if (currentY > pageHeight - 60) {
          doc.addPage();
          currentY = 20;
        }
        
        // Section header with background
        const color = colors[type] || [0, 0, 0];
        doc.setFillColor(...color.map(c => Math.min(255, c + 200))); // Lighter version
        doc.roundedRect(15, currentY - 5, pageWidth - 30, 12, 2, 2, 'F');
        
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(...color);
        doc.text(type.charAt(0).toUpperCase() + type.slice(1), 20, currentY + 2);
        currentY += 12;
        
        // Member details
        data[type].forEach(member => {
          if (currentY > pageHeight - 30) {
            doc.addPage();
            currentY = 20;
          }
          
          // Calculate content height before drawing the box
          const contentStartY = currentY;
          let contentHeight = 18; // Base height for name and basic info
          
          // Calculate height for additional fields
          if (member.whatToLearn) {
            const learnLines = doc.splitTextToSize(member.whatToLearn, pageWidth - 65);
            contentHeight += 6 + (learnLines.length * 4);
          }
          
          if (member.whatTheyGet) {
            const getLines = doc.splitTextToSize(member.whatTheyGet, pageWidth - 65);
            contentHeight += 6 + (getLines.length * 4);
          }
          
          if (member.notes) {
            const noteLines = doc.splitTextToSize(member.notes, pageWidth - 65);
            contentHeight += 6 + (noteLines.length * 4);
          }
          
          // Member card background with calculated height
          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(229, 231, 235);
          doc.roundedRect(25, currentY - 3, pageWidth - 50, contentHeight, 2, 2, 'FD');
          
          // Colored sidebar with calculated height
          doc.setFillColor(...color);
          doc.rect(25, currentY - 3, 3, contentHeight, 'F');
          
          doc.setFontSize(11);
          doc.setFont(undefined, 'bold');
          doc.setTextColor(17, 24, 39);
          doc.text(member.name || 'Unknown', 32, currentY + 3);
          currentY += 6;
          
          doc.setFontSize(9);
          doc.setFont(undefined, 'normal');
          doc.setTextColor(75, 85, 99);
          doc.text(`Role: ${member.role || 'Unknown'}`, 35, currentY);
          currentY += 4;
          doc.text(`Connection: ${member.connection || 'Unknown'}`, 35, currentY);
          currentY += 4;
          doc.text(`Cadence: ${member.cadence || 'Unknown'}`, 35, currentY);
          currentY += 4;
          
          if (member.whatToLearn) {
            doc.setFont(undefined, 'bold');
            doc.setTextColor(16, 185, 129); // Green color
            doc.text('What to Learn:', 35, currentY);
            currentY += 4;
            doc.setFont(undefined, 'normal');
            doc.setTextColor(75, 85, 99);
            const learnLines = doc.splitTextToSize(member.whatToLearn, pageWidth - 65);
            doc.text(learnLines, 35, currentY);
            currentY += learnLines.length * 4 + 2;
          }
          
          if (member.whatTheyGet) {
            doc.setFont(undefined, 'bold');
            doc.setTextColor(139, 92, 246); // Purple color
            doc.text('What They Get:', 35, currentY);
            currentY += 4;
            doc.setFont(undefined, 'normal');
            doc.setTextColor(75, 85, 99);
            const getLines = doc.splitTextToSize(member.whatTheyGet, pageWidth - 65);
            doc.text(getLines, 35, currentY);
            currentY += getLines.length * 4 + 2;
          }
          
          if (member.notes) {
            doc.setFont(undefined, 'bold');
            doc.setTextColor(75, 85, 99);
            doc.text('Notes:', 35, currentY);
            currentY += 4;
            doc.setFont(undefined, 'italic');
            doc.setTextColor(107, 114, 128);
            const noteLines = doc.splitTextToSize(member.notes, pageWidth - 65);
            doc.text(noteLines, 35, currentY);
            currentY += noteLines.length * 4;
          }
          currentY += 10;
        });
        currentY += 5;
      }
    });
    
    // Goals Section
    if (data.goals && data.goals.length > 0) {
      // Check if we need a new page
      if (currentY > pageHeight - 80) {
        doc.addPage();
        currentY = 20;
      } else {
        currentY += 20; // Add some spacing from previous section
      }
      
      // Goals Section Header
      doc.setFillColor(37, 99, 235);
      doc.rect(0, currentY - 15, pageWidth, 25, 'F');
      
      doc.setFontSize(18);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('Your Goals & Vision', pageWidth / 2, currentY - 3, { align: 'center' });
      currentY += 15;
      
      // Goals background section
      const goalsStartY = currentY;
      let goalsHeight = 10; // Base height
      
      // Calculate height needed for goals
      data.goals.forEach(goal => {
        goalsHeight += 35; // Approximate height per goal
        if (goal.description) {
          const descLines = doc.splitTextToSize(goal.description, pageWidth - 60);
          goalsHeight += descLines.length * 4;
        }
        if (goal.notes) {
          const noteLines = doc.splitTextToSize(goal.notes, pageWidth - 60);
          goalsHeight += noteLines.length * 4;
        }
      });
      
      // Goals cards
      data.goals.forEach((goal, index) => {
        // Check if we need a new page for this goal
        if (currentY > pageHeight - 40) {
          doc.addPage();
          currentY = 20;
        }
        
        // Goal card background with timeline color coding
        const goalColors = {
          '3 Months (Immediate Goals)': [34, 197, 94], // Green
          '1 Year Goals': [59, 130, 246], // Blue
          '5+ Year Goals (Long-term Vision)': [168, 85, 247], // Purple
          'Beyond': [249, 115, 22] // Orange
        };
        
        const color = goalColors[goal.timeframe] || [107, 114, 128];
        
        // Card background
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(229, 231, 235);
        
        const cardStartY = currentY;
        let cardHeight = 25; // Base height
        
        // Calculate card height
        if (goal.description) {
          const descLines = doc.splitTextToSize(goal.description, pageWidth - 60);
          cardHeight += descLines.length * 4 + 8;
        }
        if (goal.notes) {
          const noteLines = doc.splitTextToSize(goal.notes, pageWidth - 60);
          cardHeight += noteLines.length * 4 + 8;
        }
        
        doc.roundedRect(25, cardStartY - 3, pageWidth - 50, cardHeight, 2, 2, 'FD');
        
        // Colored left border
        doc.setFillColor(...color);
        doc.rect(25, cardStartY - 3, 4, cardHeight, 'F');
        
        // Goal timeframe title
        doc.setFontSize(13);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(...color);
        doc.text(goal.timeframe, 35, currentY + 4);
        currentY += 10;
        
        // Goal description
        if (goal.description) {
          doc.setFontSize(10);
          doc.setFont(undefined, 'normal');
          doc.setTextColor(17, 24, 39);
          doc.text('Description:', 35, currentY);
          currentY += 5;
          
          doc.setTextColor(75, 85, 99);
          const descLines = doc.splitTextToSize(goal.description, pageWidth - 60);
          doc.text(descLines, 35, currentY);
          currentY += descLines.length * 4 + 5;
        } else {
          doc.setFontSize(9);
          doc.setFont(undefined, 'italic');
          doc.setTextColor(156, 163, 175);
          doc.text('No description set', 35, currentY);
          currentY += 8;
        }
        
        // Goal notes
        if (goal.notes) {
          doc.setFontSize(10);
          doc.setFont(undefined, 'normal');
          doc.setTextColor(17, 24, 39);
          doc.text('Notes:', 35, currentY);
          currentY += 5;
          
          doc.setTextColor(75, 85, 99);
          const noteLines = doc.splitTextToSize(goal.notes, pageWidth - 60);
          doc.text(noteLines, 35, currentY);
          currentY += noteLines.length * 4 + 8;
        } else {
          doc.setFontSize(9);
          doc.setFont(undefined, 'italic');
          doc.setTextColor(156, 163, 175);
          doc.text('No notes added', 35, currentY);
          currentY += 8;
        }
        
        currentY += 10; // Space between goal cards
      });
    }
    
    // You Section (Superpowers & Mentees)
    if (data.you && (data.you.superpowers || data.you.mentees)) {
      // Check if we need a new page
      if (currentY > pageHeight - 80) {
        doc.addPage();
        currentY = 20;
      } else {
        currentY += 20; // Add some spacing from previous section
      }
      
      // You Section Header
      doc.setFillColor(16, 185, 129); // Green header
      doc.rect(0, currentY - 15, pageWidth, 25, 'F');
      
      doc.setFontSize(18);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('About You', pageWidth / 2, currentY - 3, { align: 'center' });
      currentY += 15;
      
      // Superpowers Section
      if (data.you.superpowers && data.you.superpowers.length > 0) {
        // Superpowers subsection header
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(16, 185, 129);
        doc.text('Your Superpowers', 35, currentY);
        currentY += 10;
        
        data.you.superpowers.forEach((superpower, index) => {
          // Check if we need a new page for this superpower
          if (currentY > pageHeight - 40) {
            doc.addPage();
            currentY = 20;
          }
          
          // Superpower card background
          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(16, 185, 129);
          doc.setLineWidth(0.5);
          
          const cardStartY = currentY;
          let cardHeight = 20; // Base height
          
          // Calculate card height
          if (superpower.description) {
            const descLines = doc.splitTextToSize(superpower.description, pageWidth - 65);
            cardHeight += 6 + (descLines.length * 4);
          }
          if (superpower.notes) {
            const noteLines = doc.splitTextToSize(superpower.notes, pageWidth - 65);
            cardHeight += 6 + (noteLines.length * 4);
          }
          
          // Draw card
          doc.rect(25, cardStartY, pageWidth - 50, cardHeight, 'D');
          
          // Left border accent
          doc.setFillColor(16, 185, 129);
          doc.rect(25, cardStartY, 4, cardHeight, 'F');
          
          // Superpower name
          doc.setFontSize(12);
          doc.setFont(undefined, 'bold');
          doc.setTextColor(17, 24, 39);
          doc.text(superpower.name, 35, currentY + 8);
          currentY += 12;
          
          // Description
          if (superpower.description) {
            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(16, 185, 129);
            doc.text('Description:', 35, currentY);
            currentY += 4;
            
            doc.setFont(undefined, 'normal');
            doc.setTextColor(75, 85, 99);
            const descLines = doc.splitTextToSize(superpower.description, pageWidth - 65);
            doc.text(descLines, 35, currentY);
            currentY += descLines.length * 4 + 2;
          }
          
          // Notes
          if (superpower.notes) {
            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(107, 114, 128);
            doc.text('Examples:', 35, currentY);
            currentY += 4;
            
            doc.setFont(undefined, 'normal');
            doc.setTextColor(75, 85, 99);
            const noteLines = doc.splitTextToSize(superpower.notes, pageWidth - 65);
            doc.text(noteLines, 35, currentY);
            currentY += noteLines.length * 4 + 2;
          }
          
          currentY += 10; // Space between superpower cards
        });
        
        currentY += 10; // Space between sections
      }
      
      // Mentees Section
      if (data.you.mentees && data.you.mentees.length > 0) {
        // Check if we need a new page
        if (currentY > pageHeight - 40) {
          doc.addPage();
          currentY = 20;
        }
        
        // Mentees subsection header
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(139, 92, 246);
        doc.text('Your Mentees', 35, currentY);
        currentY += 10;
        
        data.you.mentees.forEach((mentee, index) => {
          // Check if we need a new page for this mentee
          if (currentY > pageHeight - 40) {
            doc.addPage();
            currentY = 20;
          }
          
          // Mentee card background
          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(139, 92, 246);
          doc.setLineWidth(0.5);
          
          const cardStartY = currentY;
          let cardHeight = 25; // Base height
          
          // Calculate card height based on content
          if (mentee.whatYouTeach) {
            const teachLines = doc.splitTextToSize(mentee.whatYouTeach, pageWidth - 65);
            cardHeight += 6 + (teachLines.length * 4);
          }
          if (mentee.whatYouLearn) {
            const learnLines = doc.splitTextToSize(mentee.whatYouLearn, pageWidth - 65);
            cardHeight += 6 + (learnLines.length * 4);
          }
          if (mentee.notes) {
            const noteLines = doc.splitTextToSize(mentee.notes, pageWidth - 65);
            cardHeight += 6 + (noteLines.length * 4);
          }
          
          // Draw card
          doc.rect(25, cardStartY, pageWidth - 50, cardHeight, 'D');
          
          // Left border accent
          doc.setFillColor(139, 92, 246);
          doc.rect(25, cardStartY, 4, cardHeight, 'F');
          
          // Mentee name and details
          doc.setFontSize(12);
          doc.setFont(undefined, 'bold');
          doc.setTextColor(17, 24, 39);
          doc.text(mentee.name, 35, currentY);
          currentY += 6;

          doc.setFontSize(10);
          doc.setFont(undefined, 'normal');
          doc.setTextColor(107, 114, 128);
          doc.text(`${mentee.role} | ${mentee.connection} | ${mentee.cadence}`, 35, currentY);
          currentY += 8;
          
          // What You Teach
          if (mentee.whatYouTeach) {
            doc.setFont(undefined, 'bold');
            doc.setTextColor(16, 185, 129);
            doc.text('What You Teach:', 35, currentY);
            currentY += 4;
            
            doc.setFont(undefined, 'normal');
            doc.setTextColor(75, 85, 99);
            const teachLines = doc.splitTextToSize(mentee.whatYouTeach, pageWidth - 65);
            doc.text(teachLines, 35, currentY);
            currentY += teachLines.length * 4 + 2;
          }
          
          // What You Learn
          if (mentee.whatYouLearn) {
            doc.setFont(undefined, 'bold');
            doc.setTextColor(139, 92, 246);
            doc.text('What You Learn:', 35, currentY);
            currentY += 4;
            
            doc.setFont(undefined, 'normal');
            doc.setTextColor(75, 85, 99);
            const learnLines = doc.splitTextToSize(mentee.whatYouLearn, pageWidth - 65);
            doc.text(learnLines, 35, currentY);
            currentY += learnLines.length * 4 + 2;
          }
          
          // Notes
          if (mentee.notes) {
            doc.setFont(undefined, 'bold');
            doc.setTextColor(107, 114, 128);
            doc.text('Notes:', 35, currentY);
            currentY += 4;
            
            doc.setFont(undefined, 'normal');
            doc.setTextColor(75, 85, 99);
            const noteLines = doc.splitTextToSize(mentee.notes, pageWidth - 65);
            doc.text(noteLines, 35, currentY);
            currentY += noteLines.length * 4 + 2;
          }
          
          currentY += 10; // Space between mentee cards
        });
      }
    }
    
    // Board Analysis Section
    if (currentBoardAdvice) {
      // Check if we need a new page
      if (currentY > pageHeight - 80) {
        doc.addPage();
        currentY = 20;
      } else {
        currentY += 20; // Add some spacing from previous section
      }
      
      // Board Analysis Section Header
      doc.setFillColor(16, 185, 129); // Green header
      doc.rect(0, currentY - 15, pageWidth, 25, 'F');
      
      doc.setFontSize(18);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('AI Board Analysis', pageWidth / 2, currentY - 3, { align: 'center' });
      currentY += 15;
      
      // Analysis content background
      doc.setFillColor(240, 253, 244); // Light green background
      doc.setDrawColor(187, 247, 208); // Green border
      doc.rect(20, currentY - 5, pageWidth - 40, 10, 'FD'); // Will adjust height
      
      // Analysis content with markdown support
      const analysisStartY = currentY;
      const bgStartY = analysisStartY - 5;

      // Process markdown content
      const lines = currentBoardAdvice.split('\n');
      const processedContent = [];

      lines.forEach(line => {
        line = line.trim();
        if (!line) {
          processedContent.push({ type: 'space', height: 4 });
          return;
        }

        // Headers
        if (line.startsWith('### ')) {
          processedContent.push({
            type: 'header3',
            text: line.replace('### ', ''),
            height: 6
          });
        } else if (line.startsWith('## ')) {
          processedContent.push({
            type: 'header2',
            text: line.replace('## ', ''),
            height: 7
          });
        } else if (line.startsWith('# ')) {
          processedContent.push({
            type: 'header1',
            text: line.replace('# ', ''),
            height: 8
          });
        } else if (line.startsWith('- ') || line.startsWith('* ')) {
          // Bullet points
          processedContent.push({
            type: 'bullet',
            text: line.replace(/^[*-] /, ''),
            height: 5
          });
        } else if (line.match(/^\d+\./)) {
          // Numbered lists
          processedContent.push({
            type: 'numbered',
            text: line,
            height: 5
          });
        } else {
          // Regular paragraph
          const wrappedLines = doc.splitTextToSize(line, pageWidth - 60);
          wrappedLines.forEach((wrappedLine, index) => {
            processedContent.push({
              type: 'paragraph',
              text: wrappedLine,
              height: 4
            });
          });
        }
      });

      // Calculate total height
      const totalHeight = processedContent.reduce((sum, item) => sum + item.height + 1, 0) + 10;

      // Draw background
      doc.setFillColor(240, 253, 244);
      doc.setDrawColor(187, 247, 208);
      doc.rect(20, bgStartY, pageWidth - 40, totalHeight, 'FD');

      // Render content
      processedContent.forEach(item => {
        // Check if we need a new page
        if (currentY > pageHeight - 25) {
          doc.addPage();
          currentY = 20;
        }

        if (item.type === 'space') {
          currentY += item.height;
          return;
        }

        const x = 25;

        switch (item.type) {
          case 'header1':
            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(37, 99, 235);
            doc.text(item.text, x, currentY);
            break;
          case 'header2':
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(37, 99, 235);
            doc.text(item.text, x, currentY);
            break;
          case 'header3':
            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(55, 65, 81);
            doc.text(item.text, x, currentY);
            break;
          case 'bullet':
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(55, 65, 81);
            doc.text('• ' + item.text, x + 5, currentY);
            break;
          case 'numbered':
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(55, 65, 81);
            doc.text(item.text, x + 5, currentY);
            break;
          case 'paragraph':
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(55, 65, 81);
            doc.text(item.text, x, currentY);
            break;
        }

        currentY += item.height + 1;
      });

      currentY += 10; // Final spacing
    }
    
    doc.save('personal-board.pdf');
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
    
    setData(freshData);
    localStorage.setItem('boardData', JSON.stringify(freshData));
    setCurrent('intro');
  };

  return (
    <div className="app" style={{ backgroundImage: `url(${page.image})` }}>
      <input type="file" id="upload" accept="application/json" style={{ display: 'none' }} onChange={handleUpload} />
      <div className="top-buttons">
        <BottomTooltip text="Import a backup *.json file to restore previously saved board data">
          <button onClick={() => document.getElementById('upload').click()}>Upload</button>
        </BottomTooltip>
        <BottomTooltip text="Clear all data and start with a fresh board">
          <button onClick={reset}>Start New</button>
        </BottomTooltip>
      </div>
      <Quote text={page.quote} position={page.quotePosition} />
      {current !== 'intro' && current !== 'board' && (
        <div className="actions">
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
                  padding: '8px 16px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
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
                padding: '8px 16px',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                marginRight: '10px',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#dc2626'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#ef4444'}
            >
              🎥 Video
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
            <button onClick={downloadPDF}>Download PDF</button>
          </BottomTooltip>
        </div>
      )}
      <div className="content">
        {current === 'intro' ? <Intro onLearnClick={() => setShowIntroLearn(true)} onVideoClick={() => setShowVideoModal(true)} /> : current === 'you' ? <You data={data.you || {superpowers: [], mentees: []}} onEdit={handleEdit} onDelete={handleDelete} /> : current === 'goals' ? <Goals items={data[current] || []} onEdit={handleEdit} /> : current === 'board' ? <Board data={data} boardAdvice={boardAdvice} boardAdviceLoading={boardAdviceLoading} /> : current === 'mentors' ? <List type={current} items={data[current] || []} onEdit={handleEdit} onDelete={handleDelete} onChangeRole={handleChangeRoleClick} /> : current === 'coaches' ? <List type={current} items={data[current] || []} onEdit={handleEdit} onDelete={handleDelete} onChangeRole={handleChangeRoleClick} /> : <List type={current} items={data[current] || []} onEdit={handleEdit} onDelete={handleDelete} onChangeRole={handleChangeRoleClick} />}
      </div>
      <nav className="nav">
        {pages.map(p => {
          const count = p.key === 'intro' || p.key === 'board' || p.key === 'goals' || p.key === 'you' ? 0 : (data[p.key] || []).length;
          const showCount = p.key !== 'intro' && p.key !== 'board' && p.key !== 'goals' && p.key !== 'you';
          const startHereSection = getStartHereSection();
          
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
              <button className={p.key === current ? 'active' : ''} onClick={() => {
                setCurrent(p.key);
                setShowForm(false);
                setShowAdvisorModal(false);
                setFormType(''); // Reset formType when navigating
              }}>
                <span className="nav-title">{p.title}</span>
                {showCount && (
                  <span className="nav-count">{count}</span>
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
      {showForm && <FormModal type={formType} item={editingItem} onSave={saveEntry} onClose={() => { setShowForm(false); setShowAdvisorModal(false); }} onAdvise={handleAdvise} advisorShowing={showAdvisorModal} onFormUpdate={setEditingItem} onWritingModalUpdate={setWritingResultsModal} writingResultsShowing={writingResultsModal.show} />}
      {showUploadSuccess && <UploadSuccessPopup />}
      {showVideoModal && <VideoModal onClose={() => setShowVideoModal(false)} />}
      {showMentorVideoModal && <MentorVideoModal onClose={() => setShowMentorVideoModal(false)} />}
      {showCoachVideoModal && <CoachVideoModal onClose={() => setShowCoachVideoModal(false)} />}
      {showGoalsVideoModal && <GoalsVideoModal onClose={() => setShowGoalsVideoModal(false)} />}
      {showConnectorsVideoModal && <ConnectorsVideoModal onClose={() => setShowConnectorsVideoModal(false)} />}
      {showSponsorsVideoModal && <SponsorsVideoModal onClose={() => setShowSponsorsVideoModal(false)} />}
      {showPeersVideoModal && <PeersVideoModal onClose={() => setShowPeersVideoModal(false)} />}
      {showBoardVideoModal && <BoardVideoModal onClose={() => setShowBoardVideoModal(false)} />}
      {showAdvisorModal && <AdvisorModal guidance={advisorGuidance} loading={advisorLoading} onClose={() => setShowAdvisorModal(false)} formType={formType} currentForm={editingItem} onCopyToField={handleCopyToField} />}

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

function Intro({ onLearnClick, onVideoClick }) {
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
                  ✏️
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

function You({ data, onEdit, onDelete }) {
  return (
    <div className="you-section">
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
                        ✏️
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
                    ✏️
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
                  ✏️
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
  // Flatten all board members with their types (exclude goals and you section)
  const allMembers = [];
  Object.keys(data).forEach(type => {
    if (data[type] && type !== 'goals' && type !== 'you') {
      data[type].forEach(person => {
        allMembers.push({ ...person, type });
      });
    }
  });

  // Define more positions around the table for more members - better spaced out
  const positions = [
    { top: '5%', left: '50%', transform: 'translateX(-50%)' }, // 12 o'clock (top center)
    { top: '15%', right: '-5%', transform: 'none' }, // 1-2 o'clock
    { top: '35%', right: '-8%', transform: 'none' }, // 2-3 o'clock (well beyond edge)
    { top: '55%', right: '-5%', transform: 'none' }, // 4-5 o'clock
    { top: '75%', right: '5%', transform: 'none' }, // 5 o'clock
    { bottom: '5%', left: '60%', transform: 'translateX(-50%)' }, // 6 o'clock right
    { bottom: '5%', left: '40%', transform: 'translateX(-50%)' }, // 6 o'clock left
    { top: '75%', left: '5%', transform: 'none' }, // 7 o'clock
    { top: '55%', left: '-5%', transform: 'none' }, // 7-8 o'clock
    { top: '35%', left: '-8%', transform: 'none' }, // 9-10 o'clock (well beyond edge)
    { top: '15%', left: '-5%', transform: 'none' }, // 10-11 o'clock
    { top: '8%', left: '15%', transform: 'none' }, // 11 o'clock
    { top: '8%', right: '15%', transform: 'none' }, // 1 o'clock
    { bottom: '8%', left: '15%', transform: 'none' }, // 7 o'clock
    { bottom: '8%', right: '15%', transform: 'none' }, // 5 o'clock
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
      {/* Board Analysis Advice */}
      {(boardAdvice || boardAdviceLoading) && (
        <div className="board-advice-section" style={{
          marginBottom: '30px',
          padding: '20px',
          backgroundColor: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '8px'
        }}>
          <h3 style={{ color: '#10b981', margin: '0 0 15px 0' }}>AI Board Analysis</h3>
          {boardAdviceLoading ? (
            <div style={{ color: '#6b7280' }}>Generating analysis...</div>
          ) : (
            <div
              style={{ lineHeight: '1.6', color: '#374151' }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(boardAdvice) }}
            />
          )}
        </div>
      )}
      
      {/* Meeting Cadence Grid */}
      <div className="timeline-section">
        <h3>Meeting Cadence Overview</h3>
        <div className="cadence-grid">
          <div className="grid-header">
            <div className="name-column">Board Member</div>
            <div className="cadence-column">Daily</div>
            <div className="cadence-column">Weekly</div>
            <div className="cadence-column">Monthly</div>
            <div className="cadence-column">Quarterly</div>
            <div className="cadence-column">Annually</div>
            <div className="cadence-column">Ad-hoc</div>
          </div>
          
          {allMembers.map((member, idx) => (
            <div key={idx} className="grid-row">
              <div className="name-cell">
                <span 
                  className="type-indicator"
                  style={{ backgroundColor: colors[member.type] }}
                ></span>
                <span className="member-name">{member.name}</span>
                <span className="member-role">({member.type === 'coaches' ? 'coach' : member.type.slice(0, -1)})</span>
              </div>
              
              <div className="cadence-cell">
                {member.cadence === 'Daily' && (
                  <div 
                    className="cadence-dot"
                    style={{ backgroundColor: colors[member.type] }}
                  />
                )}
              </div>
              
              <div className="cadence-cell">
                {member.cadence === 'Weekly' && (
                  <div 
                    className="cadence-dot"
                    style={{ backgroundColor: colors[member.type] }}
                  />
                )}
              </div>
              
              <div className="cadence-cell">
                {(member.cadence === 'Monthly' || member.cadence === 'Bi-weekly') && (
                  <div 
                    className="cadence-dot"
                    style={{ backgroundColor: colors[member.type] }}
                  />
                )}
              </div>
              
              <div className="cadence-cell">
                {member.cadence === 'Quarterly' && (
                  <div 
                    className="cadence-dot"
                    style={{ backgroundColor: colors[member.type] }}
                  />
                )}
              </div>
              
              <div className="cadence-cell">
                {member.cadence === 'Annually' && (
                  <div 
                    className="cadence-dot"
                    style={{ backgroundColor: colors[member.type] }}
                  />
                )}
              </div>
              
              <div className="cadence-cell">
                {member.cadence === 'Ad-hoc' && (
                  <div 
                    className="cadence-dot"
                    style={{ backgroundColor: colors[member.type] }}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
        
        <div className="timeline-legend" style={{marginTop: '20px'}}>
          {Object.keys(colors).map(type => {
            if (!data[type] || data[type].length === 0) return null;
            return (
              <div key={type} className="legend-item">
                <span className="legend-dot" style={{ backgroundColor: colors[type] }}></span>
                <span className="legend-label">{type}</span>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Board Diagram */}
      <div className="board-diagram">
        <div className="board-table">
          <div className="table-label">Your Board</div>
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
          {Object.keys(data).map(type => {
            if (!data[type] || type === 'goals' || type === 'you' || data[type].length === 0) return null;

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
                {data[type].map((member, index) => (
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

function FormModal({ type, item, onSave, onClose, onAdvise, advisorShowing, onFormUpdate, onWritingModalUpdate, writingResultsShowing }) {
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
  
  const [form, setForm] = useState(item || getDefaultForm());
  const [originalForm, setOriginalForm] = useState(null); // For rollback functionality
  const [isWritingLoading, setIsWritingLoading] = useState(false);
  const [hasWritingBackup, setHasWritingBackup] = useState(false);
  const [enhancementLevel, setEnhancementLevel] = useState(1); // 1-3 enhancement levels
  const [enhancementVersions, setEnhancementVersions] = useState([]); // Store all versions
  const [currentVersionIndex, setCurrentVersionIndex] = useState(0);

  const [cadenceIndex, setCadenceIndex] = useState(cadenceOptions.indexOf(form.cadence) >= 0 ? cadenceOptions.indexOf(form.cadence) : 3);
  
  // Sync external item changes to local form state (for AdvisorModal copy functionality)
  React.useEffect(() => {
    if (item) {
      setForm(item);
      if (item.cadence) {
        const index = cadenceOptions.indexOf(item.cadence);
        setCadenceIndex(index >= 0 ? index : 3);
      }
    }
  }, [item]);
  
  const handleChange = e => {
    const newForm = { ...form, [e.target.name]: e.target.value };
    setForm(newForm);
    if (onFormUpdate) {
      onFormUpdate(newForm); // Keep parent editingItem in sync
    }
  };
  
  const handleCadenceChange = e => {
    const index = parseInt(e.target.value);
    setCadenceIndex(index);
    const newForm = { ...form, cadence: cadenceOptions[index] };
    setForm(newForm);
    if (onFormUpdate) {
      onFormUpdate(newForm); // Keep parent editingItem in sync
    }
  };
  
  const save = () => {
    onSave(form);
  };

  // Writing cleanup functionality
  const handleWritingCleanup = async (currentForm, formType) => {
    setIsWritingLoading(true);

    try {
      // Always capture the current form state at the time of clicking Polish
      // This ensures the "before" text in the modal is what the user sees when they click
      setOriginalForm({ ...currentForm });
      setHasWritingBackup(true);

      // Prepare the form fields as a formatted string - ONLY user-specified fields
      const getPolishableFields = (form, formType) => {
        const polishableFields = [];

        // Skills (superpowers): description, notes
        if (formType === 'superpowers') {
          if (form.description?.trim()) polishableFields.push(['description', form.description]);
          if (form.notes?.trim()) polishableFields.push(['notes', form.notes]);
        }
        // Goals: description, notes
        else if (formType === 'goals') {
          if (form.description?.trim()) polishableFields.push(['description', form.description]);
          if (form.notes?.trim()) polishableFields.push(['notes', form.notes]);
        }
        // Board members (mentors, coaches, connectors, sponsors, peers): notes, whatToLearn, whatTheyGet
        else if (['mentors', 'coaches', 'connectors', 'sponsors', 'peers'].includes(formType)) {
          if (form.notes?.trim()) polishableFields.push(['notes', form.notes]);
          if (form.whatToLearn?.trim()) polishableFields.push(['whatToLearn', form.whatToLearn]);
          if (form.whatTheyGet?.trim()) polishableFields.push(['whatTheyGet', form.whatTheyGet]);
        }
        // Mentees: notes, whatYouTeach, whatYouLearn
        else if (formType === 'mentees') {
          if (form.notes?.trim()) polishableFields.push(['notes', form.notes]);
          if (form.whatYouTeach?.trim()) polishableFields.push(['whatYouTeach', form.whatYouTeach]);
          if (form.whatYouLearn?.trim()) polishableFields.push(['whatYouLearn', form.whatYouLearn]);
        }

        return polishableFields;
      };

      const fieldEntries = getPolishableFields(currentForm, formType)
        .map(([key, value]) => `**${key}:** ${value}`)
        .join('\n\n');

      // Get level-specific instructions
      const getLevelInstructions = (level) => {
        const baseInstructions = `
- Only improve the text content provided above
- Do NOT change timeframe fields (these are fixed categories)
- Do NOT change skill category names like "Business Skills", "Technical Skills", "Organizational Skills"
- Do NOT change connection levels or cadence values (these are dropdown/slider selections)
- Preserve all factual content and meaning exactly`;

        switch (level) {
          case 1:
            return `ENHANCEMENT LEVEL 1 - BASIC CORRECTIONS:
${baseInstructions}
- Focus ONLY on basic spelling and grammar corrections
- Fix typos, punctuation, and basic grammatical errors
- Do NOT change sentence structure, tone, or style
- Make minimal changes while preserving the original voice`;

          case 2:
            return `ENHANCEMENT LEVEL 2 - CLARITY IMPROVEMENTS:
${baseInstructions}
- Fix spelling, grammar, and punctuation errors
- Improve clarity and readability while maintaining the original tone
- Make minor adjustments to sentence structure for better flow
- Ensure professional yet approachable language`;

          case 3:
            return `ENHANCEMENT LEVEL 3 - COMPREHENSIVE ENHANCEMENT:
${baseInstructions}
- Fix all spelling, grammar, and punctuation errors
- Significantly improve clarity, flow, and professional impact
- Enhance sentence structure and word choice for maximum effectiveness
- Transform into polished, professional communication while preserving meaning
- Add strategic emphasis and improve overall persuasiveness`;

          default:
            return baseInstructions;
        }
      };

      // Add instruction note for AI
      const instructionNote = `

IMPORTANT INSTRUCTIONS:
${getLevelInstructions(enhancementLevel)}`;

      if (!fieldEntries) {
        alert('No text content found to polish. Please fill in some fields first.');
        setIsWritingLoading(false);
        return;
      }

      // Call the writing assistant AI
      const { getBoardMemberAdvisorGuidance } = await import('./ai-client.js');

      const response = await getBoardMemberAdvisorGuidance(
        'writing', // Use writing category
        { currentFields: fieldEntries + instructionNote }, // Send formatted field data with instructions
        [], // goals (empty for writing task)
        '', // learnContent (empty for writing task)
        [] // existingMembers (empty for writing task)
      );

      // Parse the response to extract improved field values
      console.log('AI Writing Response:', response.guidance);
      const parseResult = parseWritingResponse(response.guidance);
      const improvements = parseResult.improvements || parseResult; // Handle both old and new format
      const annotations = parseResult.annotations || {};
      console.log('Parsed improvements:', improvements);
      console.log('Parsed annotations:', annotations);

      if (improvements && Object.keys(improvements).length > 0) {
        // Create the new enhanced version
        const updatedForm = { ...form };
        let fieldsUpdated = 0;

        // Only update fields that were originally sent for polishing
        const originalFields = getPolishableFields(currentForm, formType);
        const originalFieldNames = originalFields.map(([fieldName]) => fieldName);

        Object.entries(improvements).forEach(([fieldName, improvedText]) => {
          // Only update if the field was in the original polishable fields AND exists in the form
          if (originalFieldNames.includes(fieldName) && updatedForm.hasOwnProperty(fieldName)) {
            console.log(`Updating field ${fieldName}:`, improvedText);
            updatedForm[fieldName] = improvedText;
            fieldsUpdated++;
          } else {
            console.log(`Skipping field ${fieldName} - not in original polishable fields`);
          }
        });

        if (fieldsUpdated > 0) {
          // Set backup flag if this is the first enhancement
          if (!hasWritingBackup) {
            setHasWritingBackup(true);
          }

          // Create new version with metadata
          const newVersion = {
            level: enhancementLevel,
            form: updatedForm,
            timestamp: new Date().toISOString(),
            fieldsUpdated,
            annotations: annotations
          };

          // Add to versions array
          const updatedVersions = [...enhancementVersions, newVersion];
          setEnhancementVersions(updatedVersions);
          setCurrentVersionIndex(updatedVersions.length - 1);

          // Don't apply the form immediately - let the user review and approve changes
          // The form will only be updated when they click "Apply Approved Changes"

          // Show success message with version controls
          onWritingModalUpdate({
            show: true,
            type: 'success',
            fieldsUpdated,
            improvements,
            annotations,
            originalForm: currentForm, // Always use currentForm - the form state at time of Polish click
            updatedForm: updatedForm,
            currentVersion: newVersion,
            totalVersions: updatedVersions.length,
            onApplyChanges: (finalForm) => {
              setForm(finalForm);
              if (onFormUpdate) {
                onFormUpdate(finalForm);
              }
            }
          });
        } else {
          onWritingModalUpdate({
            show: true,
            type: 'info',
            message: 'No fields were updated. The AI may not have found improvements to suggest.'
          });
        }
      } else {
        console.log('No improvements found in response');
        onWritingModalUpdate({
          show: true,
          type: 'info',
          message: 'No improvements suggested by the AI assistant.'
        });
      }

    } catch (error) {
      console.error('Writing cleanup error:', error);
      onWritingModalUpdate({
        show: true,
        type: 'error',
        message: 'Failed to polish writing. Please try again.'
      });
    } finally {
      setIsWritingLoading(false);
    }
  };

  const handleWritingRollback = () => {
    if (originalForm) {
      setForm(originalForm);
      if (onFormUpdate) {
        onFormUpdate(originalForm);
      }
      setHasWritingBackup(false);
      setOriginalForm(null);
      setEnhancementVersions([]);
      setCurrentVersionIndex(0);
    }
  };

  // Navigate between enhancement versions
  const switchToVersion = (index) => {
    if (index >= 0 && index < enhancementVersions.length) {
      const version = enhancementVersions[index];
      setForm(version.form);
      if (onFormUpdate) {
        onFormUpdate(version.form);
      }
      setCurrentVersionIndex(index);
    }
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

  // Helper function to extract and remove annotations from improved text
  const extractAnnotations = (text) => {
    const annotations = [];
    let cleanText = text;

    // Extract annotations in brackets like [Added structure and clarity...]
    const annotationRegex = /\[([^\]]+)\]/g;
    let match;

    while ((match = annotationRegex.exec(text)) !== null) {
      annotations.push(match[1]);
    }

    // Remove all annotations from the text
    cleanText = cleanText.replace(annotationRegex, '').trim();

    return { cleanText, annotations };
  };

  // Parse AI response to extract field improvements
  const parseWritingResponse = (responseText) => {
    if (!responseText) return {};

    console.log('FULL AI RESPONSE TEXT:');
    console.log('========================');
    console.log(responseText);
    console.log('========================');
    console.log('Parsing writing response:', responseText);
    const improvements = {};
    const fieldAnnotations = {};

    // Try multiple patterns to extract improvements
    // Pattern 1: **Field Name:** fieldname **Original:** original **Improved:** improved
    let fieldPattern = /\*\*Field Name:\*\*\s*([^\n*]+?)\s*\*\*Original:\*\*[\s\S]*?\*\*Improved:\*\*\s*([\s\S]*?)(?=\s*\*\*Field Name:|\s*The improved versions|\s*$)/gis;
    let match;

    while ((match = fieldPattern.exec(responseText)) !== null) {
      const fieldName = match[1].trim();
      // Clean up improved text - take only the first paragraph and remove any trailing content
      let improvedText = match[2].trim();
      // Split on double newlines and take first part (the actual improved text)
      improvedText = improvedText.split('\n\n')[0].trim();

      // Extract annotations and clean the text
      const { cleanText, annotations } = extractAnnotations(improvedText);
      console.log(`Found field: ${fieldName} -> ${cleanText}`);
      if (annotations.length > 0) {
        console.log(`Annotations for ${fieldName}:`, annotations);
      }

      // Map field display names to actual form field names
      const fieldMapping = {
        'name': 'name',
        'role': 'role',
        'role/background': 'role',
        'description': 'description',
        'notes': 'notes',
        'whattolearn': 'whatToLearn',
        'what to learn from them': 'whatToLearn',
        'whattolearn': 'whatToLearn',
        'whattheyget': 'whatTheyGet',
        'what they get from you': 'whatTheyGet',
        'whattheygetfromyou': 'whatTheyGet',
        'what you teach': 'whatYouTeach',
        'whatyouteach': 'whatYouTeach',
        'what you learn': 'whatYouLearn',
        'whatyoulearn': 'whatYouLearn',
        'timeframe': 'timeframe'
      };

      const fieldNameLower = fieldName.toLowerCase().replace(/[^a-z]/g, '');
      const actualFieldName = fieldMapping[fieldNameLower] || fieldMapping[fieldName.toLowerCase()] || fieldName;

      if (actualFieldName && cleanText && cleanText !== '[Original text]' && cleanText !== '[Enhanced version]') {
        improvements[actualFieldName] = cleanText;
        if (annotations.length > 0) {
          fieldAnnotations[actualFieldName] = annotations;
        }
      }
    }

    // If no matches found with first pattern, try simpler pattern
    if (Object.keys(improvements).length === 0) {
      console.log('Trying alternate pattern...');
      // Pattern 2: Look for **fieldname:** followed by improved text
      fieldPattern = /\*\*([^:*]+):\*\*\s*([^\n*]+)/gi;

      while ((match = fieldPattern.exec(responseText)) !== null) {
        const fieldName = match[1].trim();
        const fieldValue = match[2].trim();

        // Skip if this looks like a label rather than content
        if (fieldName.toLowerCase().includes('original') ||
            fieldName.toLowerCase().includes('field name') ||
            fieldValue.toLowerCase().includes('original text')) {
          continue;
        }

        const fieldNameLower = fieldName.toLowerCase().replace(/[^a-z]/g, '');
        const fieldMapping = {
          'name': 'name',
          'role': 'role',
          'description': 'description',
          'notes': 'notes',
          'whattolearn': 'whatToLearn',
          'whattheyget': 'whatTheyGet',
          'whatyouteach': 'whatYouTeach',
          'whatyoulearn': 'whatYouLearn',
          'timeframe': 'timeframe'
        };

        const actualFieldName = fieldMapping[fieldNameLower] || fieldName;
        if (actualFieldName && fieldValue) {
          improvements[actualFieldName] = fieldValue;
        }
      }
    }

    // Pattern 3: If still no matches, try extracting any content after "Improved:"
    if (Object.keys(improvements).length === 0) {
      console.log('Trying very simple pattern...');
      // Split by field blocks and extract improved text
      const fieldBlocks = responseText.split(/\*\*Field Name:\*\*/i);
      fieldBlocks.forEach(block => {
        if (!block.trim()) return;

        // Look for field name and improved text
        const fieldNameMatch = block.match(/^\s*([^\n*]+)/);
        const improvedMatch = block.match(/\*\*Improved:\*\*\s*([^*\n]+)/i);

        if (fieldNameMatch && improvedMatch) {
          const fieldName = fieldNameMatch[1].trim();
          const improvedText = improvedMatch[1].trim();

          console.log(`Simple pattern found: ${fieldName} -> ${improvedText}`);

          // Map to actual field names
          const fieldMapping = {
            'name': 'name',
            'role': 'role',
            'description': 'description',
            'notes': 'notes',
            'whattolearn': 'whatToLearn',
            'whattheyget': 'whatTheyGet',
            'whatyouteach': 'whatYouTeach',
            'whatyoulearn': 'whatYouLearn',
            'timeframe': 'timeframe'
          };

          const fieldNameLower = fieldName.toLowerCase().replace(/[^a-z]/g, '');
          const actualFieldName = fieldMapping[fieldNameLower] || fieldMapping[fieldName.toLowerCase()] || fieldName;

          if (actualFieldName && improvedText) {
            improvements[actualFieldName] = improvedText;
          }
        }
      });
    }

    // Pattern 4: Last resort - look for field names from our original data and extract any improved text nearby
    if (Object.keys(improvements).length === 0) {
      console.log('Trying last resort pattern - matching original field names...');
      const expectedFields = ['name', 'role', 'description', 'notes', 'whatToLearn', 'whatTheyGet', 'whatYouTeach', 'whatYouLearn'];

      expectedFields.forEach(fieldName => {
        // Look for the field name followed by improved content
        const patterns = [
          new RegExp(`\\*\\*${fieldName}:\\*\\*[^\\n]*?improved[^\\n]*?([^\\n]+)`, 'gi'),
          new RegExp(`${fieldName}[^\\n]*?improved[^\\n]*?([^\\n]+)`, 'gi'),
          new RegExp(`\\*\\*${fieldName}:\\*\\*\\s*([^\\n*]+)`, 'gi')
        ];

        for (const pattern of patterns) {
          const match = pattern.exec(responseText);
          if (match && match[1] && match[1].trim() && !improvements[fieldName]) {
            const improvedText = match[1].trim();
            if (improvedText.length > 5 && !improvedText.toLowerCase().includes('original')) {
              console.log(`Last resort pattern found for ${fieldName}: ${improvedText}`);
              improvements[fieldName] = improvedText;
              break;
            }
          }
        }
      });
    }

    console.log('Final parsed improvements:', improvements);
    console.log('Final parsed annotations:', fieldAnnotations);
    return { improvements, annotations: fieldAnnotations };
  };
  
  return (
    <div className={advisorShowing ? "modal split-screen-modal" : "modal"} onClick={handleOverlayClick} style={{
      backgroundColor: advisorShowing ? 'transparent' : 'rgba(0, 0, 0, 0.6)',
      pointerEvents: advisorShowing ? 'none' : 'auto'
    }}>
      <div className="modal-content" style={{
        ...(advisorShowing ? {
          position: 'fixed',
          left: '2%',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '45%',
          maxWidth: 'none',
          maxHeight: '85vh',
          zIndex: 1000,
          pointerEvents: 'auto'
        } : {
          maxWidth: isGoals ? '600px' : '900px'
        })
      }}>
        <h2>{item ? 'Edit' : 'Add'} {isGoals ? 'Goal' : type === 'coaches' ? 'Coach' : type.slice(0, -1)}</h2>
        
        {isGoals ? (
          <>
            <input name="timeframe" placeholder="Timeframe" value={form.timeframe} onChange={handleChange} disabled={item ? true : false} />
            <textarea name="description" placeholder="Describe your goals for this timeframe..." value={form.description || ''} onChange={handleChange}></textarea>
            <textarea name="notes" placeholder="Notes on strategy, progress, or milestones..." value={form.notes || ''} onChange={handleChange}></textarea>
          </>
        ) : isSuperpowers ? (
          <>
            <input name="name" placeholder="Skill Category" value={form.name} onChange={handleChange} disabled={item ? true : false} />
            <textarea name="description" placeholder="Describe your expertise in this area..." value={form.description || ''} onChange={handleChange} style={{minHeight: '120px'}}></textarea>
            <textarea name="notes" placeholder="Specific examples, certifications, achievements..." value={form.notes || ''} onChange={handleChange} style={{minHeight: '80px'}}></textarea>
          </>
        ) : isMentees ? (
          <div style={{display: 'flex', gap: '40px'}}>
            <div style={{flex: 1}}>
              <h3 style={{color: '#2563eb', fontSize: '0.9em', marginBottom: '8px'}}>Basic Information</h3>
              <input name="name" placeholder="Name" value={form.name} onChange={handleChange} />
              <input name="role" placeholder="Role" value={form.role} onChange={handleChange} />
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
              <textarea name="notes" placeholder="Notes" value={form.notes} onChange={handleChange}></textarea>
            </div>
            <div style={{flex: 1}}>
              <h3 style={{color: '#10b981', fontSize: '0.9em', marginBottom: '8px'}}>What You Teach Them</h3>
              <textarea 
                name="whatYouTeach" 
                placeholder="What knowledge, skills, or guidance do you provide to this person?" 
                value={form.whatYouTeach || ''} 
                onChange={handleChange}
                style={{minHeight: '100px'}}
              ></textarea>
              <h3 style={{color: '#8b5cf6', fontSize: '0.9em', marginBottom: '8px', marginTop: '16px'}}>What You Learn From Them</h3>
              <textarea 
                name="whatYouLearn" 
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
              <input name="name" placeholder="Name" value={form.name} onChange={handleChange} />
              <input name="role" placeholder="Role" value={form.role} onChange={handleChange} />
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
              <textarea name="notes" placeholder="Notes" value={form.notes} onChange={handleChange}></textarea>
            </div>
            <div style={{flex: 1}}>
              <h3 style={{color: '#10b981', fontSize: '0.9em', marginBottom: '8px'}}>What to Learn From Them</h3>
              <textarea 
                name="whatToLearn" 
                placeholder="What knowledge, skills, or insights do you want to gain from this person?" 
                value={form.whatToLearn || ''} 
                onChange={handleChange}
                style={{minHeight: '100px'}}
              ></textarea>
              <h3 style={{color: '#8b5cf6', fontSize: '0.9em', marginBottom: '8px', marginTop: '16px'}}>What They Get From You</h3>
              <textarea 
                name="whatTheyGet" 
                placeholder="What value, perspective, or benefit can you provide to them?" 
                value={form.whatTheyGet || ''} 
                onChange={handleChange}
                style={{minHeight: '100px'}}
              ></textarea>
            </div>
          </div>
        )}

        <div className="modal-buttons">
          <Tooltip text="Save this board member or goal">
            <button onClick={save}>Save</button>
          </Tooltip>
          {onAdvise && (
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
                        <span style={{ opacity: 0.7 }}>✨ Polishing...</span>
                      </>
                    ) : (
                      <>
                        ✨ Polish Writing
                      {hasWritingBackup && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleWritingRollback();
                          }}
                          style={{
                            position: 'absolute',
                            right: '-8px',
                            top: '-8px',
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            backgroundColor: '#374151',
                            color: 'white',
                            border: 'none',
                            fontSize: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Rollback to original text"
                        >
                          ↶
                        </button>
                      )}
                    </>
                  )}
                </button>
                </Tooltip>

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
                  onClick={() => onAdvise(form, type)}
                  style={{
                    backgroundColor: '#10b981',
                    color: 'white'
                  }}
                >
                  Advise
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

function AdvisorModal({ guidance, loading, onClose, formType, currentForm, onCopyToField }) {
  const [showFieldSelection, setShowFieldSelection] = useState(null);
  const [selectedContent, setSelectedContent] = useState('');

  const handleOverlayClick = (e) => {
    // Only close if clicking directly on the overlay, not on other modal content
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Define available fields based on form type
  const getAvailableFields = () => {
    if (formType === 'goals') {
      return [
        { key: 'description', label: 'Describe Your Goals' },
        { key: 'notes', label: 'Notes on Strategy' }
      ];
    } else if (formType === 'superpowers') {
      // For skills/superpowers, the actual field names are description and notes
      return [
        { key: 'description', label: 'Describe Your Expertise' },
        { key: 'notes', label: 'Specific Examples' }
      ];
    } else if (formType === 'mentees') {
      // For mentees, use whatYouTeach and whatYouLearn
      return [
        { key: 'notes', label: 'Notes' },
        { key: 'whatYouTeach', label: 'What You Teach Them' },
        { key: 'whatYouLearn', label: 'What You Learn From Them' }
      ];
    } else {
      // For board members (mentors, coaches, etc.)
      return [
        { key: 'notes', label: 'Notes' },
        { key: 'whatToLearn', label: 'What You Learn From Them' },
        { key: 'whatTheyGet', label: 'What They Get From You' }
      ];
    }
  };

  // Parse individual items from text (questions or recommendations)
  const parseItems = (text, type) => {
    if (!text) return [];
    
    // Split by bullet points, numbered lists, or line breaks
    const items = text
      .split(/(?:\n|^)(?:[\•\-\*]|\d+[\.\)])\s*/)
      .filter(item => item.trim().length > 0)
      .map(item => item.trim());
    
    return items;
  };

  // Parse the guidance into Questions, Recommendations, and Suggested Entries sections
  const parseGuidance = (text) => {
    if (!text) return { questions: [], recommendations: [], suggestedEntries: [] };

    // More flexible parsing - try multiple header formats
    const sections = text.split(/(?=#{1,3}\s*(?:Questions?|Recommendations?|Suggested\s+Entries?|Suggestions?|Key\s+(?:Questions?|Recommendations?|Suggestions?)))|(?:\n|^)(?:Questions?|Recommendations?|Suggested\s+Entries?|Suggestions?):/i);
    let questionsText = '';
    let recommendationsText = '';
    let suggestedEntriesText = '';

    sections.forEach(section => {
      const lowerSection = section.toLowerCase();
      if (lowerSection.includes('question')) {
        questionsText = section.replace(/#{1,3}\s*(?:Questions?|Key\s+Questions?)[:]*\s*/i, '').replace(/^Questions?[:]*\s*/i, '').trim();
      } else if (lowerSection.includes('recommendation')) {
        recommendationsText = section.replace(/#{1,3}\s*(?:Recommendations?|Key\s+Recommendations?)[:]*\s*/i, '').replace(/^Recommendations?[:]*\s*/i, '').trim();
      } else if (lowerSection.includes('suggested') || lowerSection.includes('suggestion')) {
        suggestedEntriesText = section.replace(/#{1,3}\s*(?:Suggested\s+Entries?|Suggestions?|Key\s+Suggestions?)[:]*\s*/i, '').replace(/^(?:Suggested\s+Entries?|Suggestions?)[:]*\s*/i, '').trim();
      }
    });

    // If no structured sections found, try to parse the entire text as recommendations
    if (!questionsText && !recommendationsText && !suggestedEntriesText) {
      // Parse entire text as recommendations to show add buttons
      recommendationsText = text;
    }

    return {
      questions: parseItems(questionsText, 'question'),
      recommendations: parseItems(recommendationsText, 'recommendation'),
      suggestedEntries: parseItems(suggestedEntriesText, 'suggestion')
    };
  };

  const { questions, recommendations, suggestedEntries } = parseGuidance(guidance);

  // Simple markdown renderer for advisor content
  const renderMarkdown = (text) => {
    if (!text) return text;

    // Check if this is a header
    const headerMatch = text.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const content = headerMatch[2];

      const styles = {
        1: { fontSize: '24px', fontWeight: '700', color: '#1f2937', marginBottom: '16px', marginTop: '24px' },
        2: { fontSize: '20px', fontWeight: '600', color: '#374151', marginBottom: '12px', marginTop: '20px' },
        3: { fontSize: '18px', fontWeight: '600', color: '#4b5563', marginBottom: '10px', marginTop: '16px' },
        4: { fontSize: '16px', fontWeight: '600', color: '#6b7280', marginBottom: '8px', marginTop: '12px' },
        5: { fontSize: '14px', fontWeight: '600', color: '#6b7280', marginBottom: '6px', marginTop: '10px' },
        6: { fontSize: '13px', fontWeight: '600', color: '#9ca3af', marginBottom: '4px', marginTop: '8px' }
      };

      return (
        <div style={{
          ...styles[level],
          borderBottom: level <= 2 ? '1px solid #e5e7eb' : 'none',
          paddingBottom: level <= 2 ? '8px' : '0'
        }}>
          {content}
        </div>
      );
    }

    // Handle bold text
    let processedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Handle italic text
    processedText = processedText.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Handle code spans
    processedText = processedText.replace(/`(.*?)`/g, '<code style="background: #f3f4f6; padding: 2px 4px; border-radius: 3px; font-size: 0.9em;">$1</code>');

    return <span dangerouslySetInnerHTML={{ __html: processedText }} />;
  };

  // Check if content is a header (shouldn't have Add button)
  const isHeader = (text) => {
    return /^#{1,6}\s+/.test(text);
  };

  const handleAddClick = (content) => {
    setSelectedContent(content);
    setShowFieldSelection(true);
  };

  const handleFieldSelect = (fieldKey) => {
    onCopyToField(selectedContent, fieldKey);
    setShowFieldSelection(false);
    setSelectedContent('');
  };

  return (
    <div className="modal advisor-modal" onClick={handleOverlayClick} style={{
      backgroundColor: 'transparent', // No overlay blur effect
      pointerEvents: 'none' // Allow clicking through to FormModal
    }}>
      <div className="modal-content" style={{
        position: 'fixed',
        right: '2%',
        top: '50%',
        transform: 'translateY(-50%)',
        width: '45%',
        maxWidth: 'none',
        padding: '24px',
        maxHeight: '85vh',
        overflowY: 'auto',
        zIndex: 1001,
        pointerEvents: 'auto' // Re-enable clicking on the modal content
      }}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
          <h2 style={{margin: 0, color: '#10b981'}}>AI Career Advisor</h2>
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

        {loading ? (
          <div style={{textAlign: 'center', padding: '40px'}}>
            <div style={{
              border: '4px solid #f3f4f6',
              borderTop: '4px solid #10b981',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              margin: '0 auto 16px',
              animation: 'spin 1s linear infinite'
            }}></div>
            <p style={{color: '#6b7280'}}>Analyzing your mentorship situation...</p>
          </div>
        ) : guidance ? (
          <div>
            {/* Check if we have structured content */}
            {(questions && questions.length > 0) || (recommendations && recommendations.length > 0) || (suggestedEntries && suggestedEntries.length > 0) ? (
              <div>
                {questions && questions.length > 0 && (
                  <div style={{marginBottom: '32px'}}>
                    <h3 style={{
                      color: '#2563eb',
                      fontSize: '18px',
                      marginBottom: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      ❓ Questions to Consider
                    </h3>
                    <div style={{
                      backgroundColor: '#eff6ff',
                      padding: '20px',
                      borderRadius: '8px',
                      borderLeft: '4px solid #2563eb'
                    }}>
                      {questions.map((question, index) => {
                        const isHeading = isHeader(question);
                        return (
                          <div key={index} style={{
                            display: isHeading ? 'block' : 'flex',
                            alignItems: isHeading ? 'normal' : 'flex-start',
                            marginBottom: isHeading ? '0' : '12px',
                            gap: isHeading ? '0' : '8px'
                          }}>
                            <div style={{flex: 1, lineHeight: '1.6'}}>
                              {renderMarkdown(question)}
                            </div>
                            {!isHeading && (
                              <button
                                onClick={() => handleAddClick(question)}
                                style={{
                                  backgroundColor: '#2563eb',
                                  color: 'white',
                                  border: 'none',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                  flexShrink: 0,
                                  fontWeight: '500'
                                }}
                                title="Add this question to a form field"
                              >
                                Add
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {recommendations && recommendations.length > 0 && (
                  <div>
                    <h3 style={{
                      color: '#10b981',
                      fontSize: '18px',
                      marginBottom: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      💡 Recommendations
                    </h3>
                    <div style={{
                      backgroundColor: '#f0fdf4',
                      padding: '20px',
                      borderRadius: '8px',
                      borderLeft: '4px solid #10b981'
                    }}>
                      {recommendations.map((recommendation, index) => {
                        const isHeading = isHeader(recommendation);
                        return (
                          <div key={index} style={{
                            display: isHeading ? 'block' : 'flex',
                            alignItems: isHeading ? 'normal' : 'flex-start',
                            marginBottom: isHeading ? '0' : '12px',
                            gap: isHeading ? '0' : '8px'
                          }}>
                            <div style={{flex: 1, lineHeight: '1.6'}}>
                              {renderMarkdown(recommendation)}
                            </div>
                            {!isHeading && (
                              <button
                                onClick={() => handleAddClick(recommendation)}
                                style={{
                                  backgroundColor: '#10b981',
                                  color: 'white',
                                  border: 'none',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                  flexShrink: 0,
                                  fontWeight: '500'
                                }}
                                title="Add this recommendation to a form field"
                              >
                                Add
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {suggestedEntries && suggestedEntries.length > 0 && (
                  <div style={{marginTop: '32px'}}>
                    <h3 style={{
                      color: '#f59e0b',
                      fontSize: '18px',
                      marginBottom: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      ✨ Suggested Entries
                    </h3>
                    <div style={{
                      backgroundColor: '#fffbeb',
                      padding: '20px',
                      borderRadius: '8px',
                      borderLeft: '4px solid #f59e0b'
                    }}>
                      {suggestedEntries.map((entry, index) => {
                        const isHeading = isHeader(entry);
                        return (
                          <div key={index} style={{
                            display: isHeading ? 'block' : 'flex',
                            alignItems: isHeading ? 'normal' : 'flex-start',
                            marginBottom: isHeading ? '0' : '12px',
                            gap: isHeading ? '0' : '8px'
                          }}>
                            <div style={{flex: 1, lineHeight: '1.6'}}>
                              {renderMarkdown(entry)}
                            </div>
                            {!isHeading && (
                              <button
                                onClick={() => handleAddClick(entry)}
                                style={{
                                  backgroundColor: '#f59e0b',
                                  color: 'white',
                                  border: 'none',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                  flexShrink: 0,
                                  fontWeight: '500'
                                }}
                                title="Add this suggested entry to a form field"
                              >
                                Add
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Fallback: Display raw guidance text when no structured sections found */
              <div>
                <h3 style={{
                  color: '#10b981',
                  fontSize: '18px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  💡 AI Guidance
                </h3>
                <div style={{
                  backgroundColor: '#f0fdf4',
                  padding: '20px',
                  borderRadius: '8px',
                  borderLeft: '4px solid #10b981',
                  lineHeight: '1.6'
                }}>
                  {/* Split guidance by lines and render each with markdown */}
                  {guidance.split('\n').map((line, index) => {
                    const isHeading = isHeader(line);
                    return (
                      <div key={index} style={{
                        marginBottom: isHeading ? '0' : '8px'
                      }}>
                        {renderMarkdown(line) || <br />}
                      </div>
                    );
                  })}
                </div>
                {/* Only show Add button if the guidance doesn't contain headers */}
                {!guidance.split('\n').some(line => isHeader(line)) && (
                  <button
                    onClick={() => handleAddClick(guidance)}
                    style={{
                      backgroundColor: '#10b981',
                      color: 'white',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      fontSize: '14px',
                      cursor: 'pointer',
                      marginTop: '16px',
                      fontWeight: '500'
                    }}
                    title="Add this guidance to a form field"
                  >
                    Add to Form
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div style={{textAlign: 'center', padding: '40px', color: '#6b7280'}}>
            <p>No guidance available at the moment.</p>
          </div>
        )}

        <div className="modal-buttons" style={{marginTop: '24px'}}>
          <button onClick={onClose}>Close</button>
        </div>

        {/* Field Selection Modal - positioned at higher z-index and centered */}
        {showFieldSelection && (
          <>
            {/* Backdrop - positioned outside and behind modal */}
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 9999
            }} onClick={() => setShowFieldSelection(false)} />
            {/* Modal content - positioned on top of backdrop */}
            <div style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: 'white',
              padding: '24px',
              borderRadius: '8px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              maxWidth: '500px',
              width: '90%',
              maxHeight: '80vh',
              overflowY: 'auto',
              zIndex: 10000 // Much higher z-index to ensure it appears on top
            }}
            onClick={(e) => e.stopPropagation()} // Prevent clicks from bubbling
            >
              <div style={{
                position: 'relative'
              }}>
              {/* Content preview */}
              <div style={{
                marginBottom: '20px',
                padding: '12px',
                backgroundColor: '#f9fafb',
                borderRadius: '6px',
                border: '1px solid #e5e7eb'
              }}>
                <p style={{margin: '0 0 8px 0', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase'}}>Content to Add:</p>
                <p style={{margin: 0, fontSize: '14px', color: '#374151', lineHeight: '1.5'}}>
                  {selectedContent}
                </p>
              </div>
              <h3 style={{margin: '0 0 16px 0', color: '#374151'}}>Select Field:</h3>
              <div style={{marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '8px'}}>
                {getAvailableFields().map(field => (
                  <button
                    key={field.key}
                    onClick={() => handleFieldSelect(field.key)}
                    style={{
                      padding: '12px 16px',
                      backgroundColor: field.key === 'whatToLearn' ? '#10b981' :
                                     field.key === 'whatTheyGet' ? '#8b5cf6' :
                                     field.key === 'description' ? '#2563eb' :
                                     '#6b7280',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '500',
                      textAlign: 'center',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => {
                      e.target.style.transform = 'translateY(-1px)';
                      e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                    }}
                    onMouseOut={(e) => {
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = 'none';
                    }}
                  >
                    Add to "{field.label}"
                  </button>
                ))}
              </div>
              <div style={{display: 'flex', justifyContent: 'center', marginTop: '16px'}}>
                <button
                  onClick={() => {
                    setShowFieldSelection(false);
                    setSelectedContent('');
                  }}
                  style={{
                    padding: '10px 24px',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                  onMouseOver={(e) => {
                    e.target.style.backgroundColor = '#dc2626';
                  }}
                  onMouseOut={(e) => {
                    e.target.style.backgroundColor = '#ef4444';
                  }}
                >
                  Cancel
                </button>
              </div>
              </div>
            </div>
          </>
        )}
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

function WritingResultsModal({ modal, onClose }) {
  if (!modal.show) return null;

  const [fieldApprovals, setFieldApprovals] = useState({});

  // Custom field name mapping based on user specifications
  const getFieldDisplayName = (fieldName) => {
    const fieldMappings = {
      // Skills section (superpowers)
      'description': 'Skills description/details',
      'notes': 'Specific examples, certifications, achievements',

      // Board members section (mentors, coaches, connectors, sponsors, peers)
      'whatToLearn': 'What you want to learn from them',
      'whatTheyGet': 'What they get from you',

      // Mentees section
      'whatYouTeach': 'What you teach them',
      'whatYouLearn': 'What you learn from them'
    };

    // Context-aware mapping for fields that appear in multiple sections
    if (fieldName === 'description') {
      return fieldMappings[fieldName] || 'Goal description/details'; // Default for goals
    }
    if (fieldName === 'notes') {
      return fieldMappings[fieldName] || 'Notes'; // Generic since it appears in all sections
    }

    return fieldMappings[fieldName] || fieldName.replace(/([A-Z])/g, ' $1').trim();
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleApprove = (fieldName) => {
    setFieldApprovals(prev => ({ ...prev, [fieldName]: 'approved' }));
  };

  const handleReject = (fieldName) => {
    setFieldApprovals(prev => ({ ...prev, [fieldName]: 'rejected' }));
  };

  const handleApplyChanges = () => {
    // Apply only approved changes
    const finalForm = { ...modal.originalForm };

    // Apply only approved fields
    Object.keys(fieldApprovals).forEach(fieldName => {
      if (fieldApprovals[fieldName] === 'approved') {
        finalForm[fieldName] = modal.updatedForm[fieldName];
      }
    });

    // Pass the final form back to the parent (need to add a callback prop)
    if (modal.onApplyChanges) {
      modal.onApplyChanges(finalForm);
    }

    onClose();
  };

  const handleCancelPolish = () => {
    // Just close the modal - no changes were applied yet
    onClose();
  };

  const getIcon = () => {
    switch (modal.type) {
      case 'success': return '✨';
      case 'error': return '❌';
      case 'info': default: return 'ℹ️';
    }
  };

  const getColor = () => {
    switch (modal.type) {
      case 'success': return '#10b981';
      case 'error': return '#ef4444';
      case 'info': default: return '#3b82f6';
    }
  };

  const getBgColor = () => {
    switch (modal.type) {
      case 'success': return '#f0fdf4';
      case 'error': return '#fef2f2';
      case 'info': default: return '#eff6ff';
    }
  };

  return (
    <div className="modal" onClick={handleOverlayClick} style={{
      background: 'rgba(0, 0, 0, 0.5)',
      backdropFilter: 'blur(8px)',
      zIndex: 2000  // Higher than regular modal (1000) to appear on top
    }}>
      <div className="modal-content" style={{
        maxWidth: '800px',
        maxHeight: '90vh',
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        borderRadius: '20px',
        border: `2px solid ${getColor()}`,
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        animation: 'modalSlideIn 0.3s ease',
        overflow: 'hidden'
      }}>
        <div style={{
          background: `linear-gradient(135deg, ${getColor()} 0%, ${getColor()}dd 100%)`,
          color: 'white',
          padding: '24px 30px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <span style={{ fontSize: '32px' }}>{getIcon()}</span>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '600' }}>
            {modal.type === 'success' && 'Writing Enhanced!'}
            {modal.type === 'error' && 'Enhancement Failed'}
            {modal.type === 'info' && 'Writing Assistant'}
          </h2>
        </div>

        <div style={{ padding: '30px', maxHeight: '60vh', overflowY: 'auto' }}>
          {modal.type === 'success' ? (
            <div>
              <div style={{
                marginBottom: '20px',
                textAlign: 'center'
              }}>
                <p style={{
                  margin: '0 0 16px 0',
                  fontSize: '18px',
                  fontWeight: '600',
                  color: getColor()
                }}>
                  Review Changes for {modal.fieldsUpdated} field{modal.fieldsUpdated > 1 ? 's' : ''}
                </p>
                <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
                  Approve or reject changes for each field individually
                </p>
              </div>

              {modal.improvements && Object.keys(modal.improvements).length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {Object.keys(modal.improvements).map(fieldName => {
                    const originalText = modal.originalForm?.[fieldName] || '';
                    const updatedText = modal.updatedForm?.[fieldName] || '';
                    const approval = fieldApprovals[fieldName];

                    return (
                      <div key={fieldName} style={{
                        border: `2px solid ${approval === 'approved' ? '#10b981' : approval === 'rejected' ? '#ef4444' : '#e5e7eb'}`,
                        borderRadius: '12px',
                        padding: '20px',
                        background: approval === 'approved' ? '#f0fdf4' : approval === 'rejected' ? '#fef2f2' : '#ffffff'
                      }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '16px'
                        }}>
                          <h3 style={{
                            margin: 0,
                            fontSize: '16px',
                            fontWeight: '600',
                            color: '#374151',
                            textTransform: 'capitalize'
                          }}>
                            {getFieldDisplayName(fieldName)}
                          </h3>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => handleApprove(fieldName)}
                              style={{
                                background: approval === 'approved' ? '#10b981' : '#ffffff',
                                color: approval === 'approved' ? '#ffffff' : '#10b981',
                                border: '2px solid #10b981',
                                borderRadius: '6px',
                                padding: '8px 16px',
                                fontSize: '14px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              ✓ Approve
                            </button>
                            <button
                              onClick={() => handleReject(fieldName)}
                              style={{
                                background: approval === 'rejected' ? '#ef4444' : '#ffffff',
                                color: approval === 'rejected' ? '#ffffff' : '#ef4444',
                                border: '2px solid #ef4444',
                                borderRadius: '6px',
                                padding: '8px 16px',
                                fontSize: '14px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              ✗ Reject
                            </button>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                          <div>
                            <h4 style={{
                              margin: '0 0 8px 0',
                              fontSize: '14px',
                              fontWeight: '600',
                              color: '#ef4444',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              Before
                            </h4>
                            <div style={{
                              background: '#fef2f2',
                              border: '1px solid #fecaca',
                              borderRadius: '8px',
                              padding: '12px',
                              fontSize: '14px',
                              color: '#374151',
                              lineHeight: '1.5',
                              minHeight: '60px',
                              whiteSpace: 'pre-wrap'
                            }}>
                              {originalText || '(empty)'}
                            </div>
                          </div>

                          <div>
                            <h4 style={{
                              margin: '0 0 8px 0',
                              fontSize: '14px',
                              fontWeight: '600',
                              color: '#10b981',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              After
                            </h4>
                            <div style={{
                              background: '#f0fdf4',
                              border: '1px solid #bbf7d0',
                              borderRadius: '8px',
                              padding: '12px',
                              fontSize: '14px',
                              color: '#374151',
                              lineHeight: '1.5',
                              minHeight: '60px',
                              whiteSpace: 'pre-wrap'
                            }}>
                              {updatedText}
                            </div>
                          </div>
                        </div>

                        {modal.annotations && modal.annotations[fieldName] && modal.annotations[fieldName].length > 0 && (
                          <div style={{
                            marginTop: '12px',
                            padding: '12px',
                            background: '#fffbeb',
                            border: '1px solid #fed7aa',
                            borderRadius: '8px'
                          }}>
                            <p style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: '600', color: '#92400e' }}>
                              AI Improvements:
                            </p>
                            <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: '#92400e' }}>
                              {modal.annotations[fieldName].map((annotation, idx) => (
                                <li key={idx}>{annotation}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{
                marginTop: '24px',
                padding: '16px',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                <button
                  onClick={handleApplyChanges}
                  style={{
                    background: '#2563eb',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 24px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease'
                  }}
                  onMouseOver={(e) => e.target.style.backgroundColor = '#1d4ed8'}
                  onMouseOut={(e) => e.target.style.backgroundColor = '#2563eb'}
                >
                  Apply Approved Changes
                </button>
              </div>
            </div>
          ) : (
            <div style={{
              background: getBgColor(),
              border: `1px solid ${getColor()}33`,
              borderRadius: '12px',
              padding: '20px',
              textAlign: 'center'
            }}>
              <p style={{
                margin: 0,
                fontSize: '16px',
                color: '#374151',
                lineHeight: '1.6'
              }}>
                {modal.message}
              </p>
            </div>
          )}
        </div>

        <div style={{
          padding: '20px 30px',
          borderTop: `1px solid ${getColor()}22`,
          display: 'flex',
          justifyContent: 'center'
        }}>
          <button
            onClick={modal.type === 'success' && modal.improvements ? handleCancelPolish : onClose}
            style={{
              background: `linear-gradient(135deg, ${getColor()} 0%, ${getColor()}dd 100%)`,
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'transform 0.2s ease',
              boxShadow: `0 4px 12px ${getColor()}44`
            }}
            onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
            onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
          >
            {modal.type === 'success' && modal.improvements ? 'Cancel' : 'Got it!'}
          </button>
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
