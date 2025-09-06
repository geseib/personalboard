import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { jsPDF } from 'jspdf';
import { connectionLevels } from './utils.js';
// use direct paths so images resolve without a bundler


const pages = [
  { key: 'intro', title: 'Intro', image: '/images/Slide2.png', quote: '', quotePosition: 'center' },
  { key: 'mentors', title: 'Mentors', image: '/images/Slide4.png', quote: 'A mentor opens doors.', quotePosition: 'bottom-right' },
  { key: 'coaches', title: 'Coaches', image: '/images/Slide6.png', quote: 'Coaches refine potential.', quotePosition: 'bottom-left' },
  { key: 'connectors', title: 'Connectors', image: '/images/Slide7.png', quote: 'Connections spark growth.', quotePosition: 'center' },
  { key: 'sponsors', title: 'Sponsors', image: '/images/Slide8.png', quote: 'Sponsorship elevates.', quotePosition: 'bottom-right' },
  { key: 'peers', title: 'Peers', image: '/images/Slide9.png', quote: 'Peers share the path.', quotePosition: 'bottom-right' },
  { key: 'board', title: 'Board', image: '/images/Slide10.png', quote: '', quotePosition: 'center' }
];

function App() {
  const [current, setCurrent] = useState('intro');
  const [data, setData] = useState(() => JSON.parse(localStorage.getItem('boardData') || '{}'));
  const [showLearn, setShowLearn] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [showUploadSuccess, setShowUploadSuccess] = useState(false);

  useEffect(() => {
    localStorage.setItem('boardData', JSON.stringify(data));
  }, [data]);

  const page = pages.find(p => p.key === current);

  const handleAdd = type => {
    setFormType(type);
    setEditingItem(null);
    setEditingIndex(null);
    setShowForm(true);
  };

  const handleEdit = (type, item, index) => {
    setFormType(type);
    setEditingItem(item);
    setEditingIndex(index);
    setShowForm(true);
  };

  const handleDelete = (type, index) => {
    setData(prev => {
      const list = [...prev[type]];
      list.splice(index, 1);
      return { ...prev, [type]: list };
    });
  };

  const saveEntry = entry => {
    setData(prev => {
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

  const handleUpload = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const obj = JSON.parse(ev.target.result);
        setData(obj);
        setShowUploadSuccess(true);
        setTimeout(() => setShowUploadSuccess(false), 3000);
      } catch (err) {
        alert('Invalid JSON');
      }
    };
    reader.readAsText(file);
  };

  const downloadJSON = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'board.json';
    a.click();
  };

  const downloadPDF = () => {
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
    
    // Timeline Section Background
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(15, currentY - 5, pageWidth - 30, 55, 3, 3, 'F');
    
    // Timeline Header
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(17, 24, 39);
    doc.text('Annual Meeting Timeline', 20, currentY + 5);
    currentY += 15;
    
    // Draw timeline
    const timelineY = currentY;
    const timelineHeight = 25;
    const monthWidth = (pageWidth - 50) / 12;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Timeline background
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(25, timelineY, pageWidth - 50, timelineHeight, 2, 2, 'F');
    doc.setDrawColor(229, 231, 235);
    doc.roundedRect(25, timelineY, pageWidth - 50, timelineHeight, 2, 2, 'S');
    
    // Month labels
    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(107, 114, 128);
    months.forEach((month, idx) => {
      doc.text(month, 25 + (idx * monthWidth) + monthWidth/2, timelineY - 3, { align: 'center' });
      // Add vertical separator
      if (idx > 0) {
        doc.setDrawColor(243, 244, 246);
        doc.line(25 + idx * monthWidth, timelineY, 25 + idx * monthWidth, timelineY + timelineHeight);
      }
    });
    
    // Plot meetings based on cadence
    const colors = {
      mentors: [16, 185, 129],
      coaches: [59, 130, 246],
      connectors: [245, 158, 11],
      sponsors: [139, 92, 246],
      peers: [239, 68, 68]
    };
    
    let legendY = 5;
    Object.keys(data).forEach((type, typeIdx) => {
      if (data[type]) {
        const color = colors[type] || [100, 100, 100];
        doc.setFillColor(...color);
        
        data[type].forEach((person, personIdx) => {
          const yPos = timelineY + 5 + (personIdx * 4);
          
          // Calculate meeting dots based on cadence
          const meetingMonths = getMeetingMonths(person.cadence);
          meetingMonths.forEach(month => {
            const xPos = 25 + (month * monthWidth) + monthWidth/2;
            doc.circle(xPos, yPos, 2, 'F');
          });
          
          // Legend item
          if (personIdx === 0) {
            doc.circle(pageWidth - 35, timelineY + legendY, 1.5, 'F');
            doc.setFontSize(7);
            doc.text(type, pageWidth - 30, timelineY + legendY + 1);
            legendY += 5;
          }
        });
      }
    });
    
    currentY = timelineY + timelineHeight + 30;
    
    // Board Section Background
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(15, currentY - 5, pageWidth - 30, 100, 3, 3, 'F');
    
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
    
    // Position board members around table
    const allMembers = [];
    Object.keys(data).forEach(type => {
      if (data[type]) {
        data[type].forEach(person => {
          allMembers.push({ ...person, type });
        });
      }
    });
    
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
      doc.text(member.name.substring(0, 15), boxX, boxY + 2, { align: 'center' });
      
      doc.setFont(undefined, 'normal');
      doc.setTextColor(107, 114, 128);
      doc.setFontSize(7);
      doc.text(member.role.substring(0, 20), boxX, boxY + 6, { align: 'center' });
    });
    
    currentY = tableY + tableHeight/2 + 65;
    
    // Check if we need a new page
    if (currentY > pageHeight - 40) {
      doc.addPage();
      currentY = 20;
    }
    
    // Role Descriptions Section
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(15, currentY - 5, pageWidth - 30, 80, 3, 3, 'F');
    
    // Role Descriptions
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(17, 24, 39);
    doc.text('Role Descriptions', 20, currentY + 5);
    currentY += 15;
    
    const roleDescriptions = {
      mentors: 'Mentors provide wisdom, guidance, and share their experience to help navigate your career journey.',
      coaches: 'Coaches help refine specific skills and provide tactical guidance for immediate challenges.',
      connectors: 'Connectors introduce new opportunities and expand your professional network.',
      sponsors: 'Sponsors advocate for your advancement and open doors to new positions and opportunities.',
      peers: 'Peers share similar experiences and provide mutual support through common challenges.'
    };
    
    doc.setFontSize(9);
    Object.keys(roleDescriptions).forEach(role => {
      if (data[role] && data[role].length > 0) {
        doc.setFont(undefined, 'bold');
        const color = colors[role] || [0, 0, 0];
        doc.setTextColor(...color);
        // Add colored bullet
        doc.setFillColor(...color);
        doc.circle(22, currentY - 1, 1.5, 'F');
        
        doc.setTextColor(...color);
        doc.text(`${role.charAt(0).toUpperCase() + role.slice(1)}:`, 27, currentY);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(75, 85, 99);
        const lines = doc.splitTextToSize(roleDescriptions[role], pageWidth - 60);
        doc.text(lines, 35, currentY);
        currentY += lines.length * 4 + 5;
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
      if (data[type] && data[type].length > 0) {
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
          
          // Member card background
          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(229, 231, 235);
          doc.roundedRect(25, currentY - 3, pageWidth - 50, 28, 2, 2, 'FD');
          
          // Colored sidebar
          doc.setFillColor(...color);
          doc.rect(25, currentY - 3, 3, 28, 'F');
          
          doc.setFontSize(11);
          doc.setFont(undefined, 'bold');
          doc.setTextColor(17, 24, 39);
          doc.text(member.name, 32, currentY + 3);
          currentY += 6;
          
          doc.setFontSize(9);
          doc.setFont(undefined, 'normal');
          doc.setTextColor(75, 85, 99);
          doc.text(`Role: ${member.role}`, 35, currentY);
          currentY += 4;
          doc.text(`Connection: ${member.connection}`, 35, currentY);
          currentY += 4;
          doc.text(`Cadence: ${member.cadence}`, 35, currentY);
          currentY += 4;
          
          if (member.notes) {
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
    setData({});
    localStorage.removeItem('boardData');
    setCurrent('intro');
  };

  return (
    <div className="app" style={{ backgroundImage: `url(${page.image})` }}>
      <input type="file" id="upload" accept="application/json" style={{ display: 'none' }} onChange={handleUpload} />
      <div className="top-buttons">
        <button onClick={() => document.getElementById('upload').click()}>Upload</button>
        <button onClick={reset}>Start New</button>
      </div>
      <Quote text={page.quote} position={page.quotePosition} />
      {current !== 'intro' && current !== 'board' && (
        <div className="actions">
          <button onClick={() => setShowLearn(true)}>Learn</button>
          <button onClick={() => handleAdd(current)}>+ Add</button>
        </div>
      )}
      {current === 'board' && (
        <div className="board-actions">
          <button onClick={downloadJSON}>Download JSON</button>
          <button onClick={downloadPDF}>Download PDF</button>
        </div>
      )}
      <div className="content">
        {current === 'intro' ? <Intro /> : current === 'board' ? <Board data={data} /> : <List type={current} items={data[current] || []} onEdit={handleEdit} onDelete={handleDelete} />}
      </div>
      <nav className="nav">
        {pages.map(p => {
          const count = p.key === 'intro' || p.key === 'board' ? 0 : (data[p.key] || []).length;
          const showCount = p.key !== 'intro' && p.key !== 'board';
          
          return (
            <button key={p.key} className={p.key === current ? 'active' : ''} onClick={() => setCurrent(p.key)}>
              <span className="nav-title">{p.title}</span>
              {showCount && (
                <span className="nav-count">{count}</span>
              )}
              {p.key === 'mentors' && Object.keys(data).every(key => !data[key] || data[key].length === 0) && (
                <div className="start-here-arrow">
                  <div className="start-here-text">Start here!</div>
                  <svg className="arrow-svg" viewBox="0 0 24 24" width="24" height="24">
                    <path 
                      d="M7 10l5 5 5-5z" 
                      fill="#2563eb"
                    />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </nav>
      {showLearn && <LearnModal type={current} onClose={() => setShowLearn(false)} />}
      {showForm && <FormModal type={formType} item={editingItem} onSave={saveEntry} onClose={() => setShowForm(false)} />}
      {showUploadSuccess && <UploadSuccessPopup />}
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

function Intro() {
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
    </div>
  );
}

function List({ type, items, onEdit, onDelete }) {
  return (
    <div className="list">
      {items.map((item, idx) => (
        <div key={idx} className="card">
          <div className="card-header">
            <h3>{item.name}</h3>
            <div className="card-actions">
              <button className="icon-btn edit-btn" onClick={() => onEdit(type, item, idx)} title="Edit">
                ✏️
              </button>
              <button className="icon-btn delete-btn" onClick={() => onDelete(type, idx)} title="Delete">
                🗑️
              </button>
            </div>
          </div>
          <p>{item.role}</p>
          <p>{item.connection}</p>
          <p>{item.cadence}</p>
          <p>{item.notes}</p>
        </div>
      ))}
    </div>
  );
}

function Board({ data }) {
  // Flatten all board members with their types
  const allMembers = [];
  Object.keys(data).forEach(type => {
    if (data[type]) {
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
      {/* Timeline */}
      <div className="timeline-section">
        <h3>Annual Meeting Timeline</h3>
        <div className="timeline">
          <div className="timeline-months">
            {months.map(month => (
              <div key={month} className="timeline-month">
                <span className="month-label">{month}</span>
                <div className="month-column">
                  {Object.keys(data).map(type => {
                    if (!data[type]) return null;
                    return data[type].map((person, idx) => {
                      const meetingMonths = getMeetingMonths(person.cadence);
                      if (meetingMonths.includes(months.indexOf(month))) {
                        return (
                          <div 
                            key={`${type}-${idx}`}
                            className="meeting-dot"
                            style={{ backgroundColor: colors[type] }}
                            title={`${person.name} (${type})`}
                          />
                        );
                      }
                      return null;
                    });
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="timeline-legend">
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
    </div>
  );
}

function LearnModal({ type, onClose }) {
  const content = {
    mentors: {
      title: 'Mentors: Your Wisdom Guides',
      description: 'Mentors are experienced professionals who have walked the path you aspire to take. They provide strategic career advice, share lessons learned from their journeys, and help you navigate complex professional decisions.',
      importance: 'A mentor opens doors by sharing their network, institutional knowledge, and hard-earned wisdom. They help you avoid common pitfalls and accelerate your growth by learning from their experiences rather than making every mistake yourself.',
      whatToLookFor: 'Look for someone 5-10 years ahead of where you want to be, who demonstrates values you admire, and who has shown interest in your development. They should have experience in your field or desired career path and be willing to invest time in your growth.',
      howTheyHelp: 'Mentors provide strategic perspective on career moves, industry insights, introductions to their network, and honest feedback on your professional development. They help you see the bigger picture and make informed decisions about your future.'
    },
    coaches: {
      title: 'Coaches: Your Skill Developers', 
      description: 'Coaches are focused on helping you develop specific skills and capabilities. Unlike mentors who provide broad wisdom, coaches zero in on particular areas where you need improvement and push you to achieve your potential.',
      importance: 'Coaches refine potential by providing targeted feedback, skill development strategies, and accountability for improvement. They help bridge the gap between where you are and where you want to be in specific competencies.',
      whatToLookFor: 'Seek someone with deep expertise in the skills you want to develop, who can provide constructive feedback and structured learning approaches. They might be peers, superiors, or even external professionals who excel in areas where you want to grow.',
      howTheyHelp: 'Coaches give you specific exercises, feedback on your performance, and hold you accountable for skill development. They help you practice, refine techniques, and build confidence in areas critical to your success.'
    },
    connectors: {
      title: 'Connectors: Your Network Expanders',
      description: 'Connectors are the social catalysts in your network – people who know everyone and love making introductions. They have extensive networks across industries and are generous with their connections.',
      importance: 'Connections spark growth by expanding your reach far beyond your immediate circle. In today\'s interconnected world, opportunities often come through relationships, and connectors multiply your networking capacity exponentially.',
      whatToLookFor: 'Identify natural networkers who are well-connected in your industry or desired field, who enjoy making introductions, and who seem to know someone everywhere they go. They should be generous with their network and excited about connecting people.',
      howTheyHelp: 'Connectors introduce you to new opportunities, potential clients, collaborators, or employers. They expand your professional reach, help you discover hidden job markets, and connect you with people who can advance your goals.'
    },
    sponsors: {
      title: 'Sponsors: Your Advocates',
      description: 'Sponsors are influential people who actively advocate for you in rooms where you\'re not present. They go beyond giving advice to actually using their political capital and influence to advance your career.',
      importance: 'Sponsorship elevates your career by having someone with power and influence actively promote your interests. While mentors give advice, sponsors take action on your behalf, recommending you for opportunities and speaking up for your contributions.',
      whatToLookFor: 'Look for someone with influence in your organization or industry who believes in your potential and is willing to stake their reputation on your success. They should have the power to make things happen and be willing to use it for you.',
      howTheyHelp: 'Sponsors recommend you for promotions, advocate for your ideas in leadership meetings, nominate you for high-visibility projects, and ensure your contributions are recognized. They actively open doors rather than just pointing them out.'
    },
    peers: {
      title: 'Peers: Your Journey Companions',
      description: 'Peers are professionals at similar career stages who face comparable challenges and opportunities. They provide mutual support, shared problem-solving, and the camaraderie of people walking similar paths.',
      importance: 'Peers share the path by offering real-time support for current challenges, celebrating wins together, and providing honest perspectives from people who truly understand your situation. They offer reciprocal relationships where you both give and receive support.',
      whatToLookFor: 'Connect with professionals at similar career levels who work in your field or adjacent areas, who share similar values and ambitions, and who are open to mutual support and collaboration.',
      howTheyHelp: 'Peers provide emotional support during tough times, share strategies for common challenges, offer networking opportunities within their circles, and create accountability partnerships for mutual growth and development.'
    }
  };

  const roleNames = {
    mentors: 'mentor',
    coaches: 'coach', 
    connectors: 'connector',
    sponsors: 'sponsor',
    peers: 'peer'
  };

  const typeContent = content[type];

  return (
    <div className="modal">
      <div className="modal-content" style={{maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto'}}>
        <h2>{typeContent.title}</h2>
        
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

        <div style={{background: '#f8fafc', padding: '12px', borderRadius: '8px', marginBottom: '16px', borderLeft: '4px solid #2563eb'}}>
          <p style={{margin: '0', fontSize: '14px', color: '#4b5563'}}>
            <strong>Remember:</strong> Your personal board members may not even know they're on your "board." Focus on building authentic relationships and providing mutual value. Consider their name, role, connection level, meeting cadence, and notes on engagement.
          </p>
        </div>

        <div className="learn-cta">
          Now click the <strong>+ Add</strong> button and add your {roleNames[type]}!
        </div>
        
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

function FormModal({ type, item, onSave, onClose }) {
  const cadenceOptions = ['Daily', 'Weekly', 'Bi-weekly', 'Monthly', 'Quarterly', 'Annually', 'Ad-hoc'];
  const [form, setForm] = useState(item || { name: '', role: '', connection: 'Not yet', cadence: 'Monthly', notes: '' });
  const [cadenceIndex, setCadenceIndex] = useState(cadenceOptions.indexOf(form.cadence) >= 0 ? cadenceOptions.indexOf(form.cadence) : 3);
  
  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });
  
  const handleCadenceChange = e => {
    const index = parseInt(e.target.value);
    setCadenceIndex(index);
    setForm({ ...form, cadence: cadenceOptions[index] });
  };
  
  const save = () => {
    onSave(form);
  };
  
  return (
    <div className="modal">
      <div className="modal-content">
        <h2>{item ? 'Edit' : 'Add'} {type.slice(0, -1)}</h2>
        <input name="name" placeholder="Name" value={form.name} onChange={handleChange} />
        <input name="role" placeholder="Role" value={form.role} onChange={handleChange} />
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
        <div className="modal-buttons">
          <button onClick={save}>Save</button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
