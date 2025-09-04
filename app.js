import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { jsPDF } from 'jspdf';
import { connectionLevels } from './utils.js';
import slide1 from './images/Slide1.png';
import slide2 from './images/Slide2.png';
import slide3 from './images/Slide3.png';
import slide4 from './images/Slide4.png';
import slide5 from './images/Slide5.png';
import slide6 from './images/Slide6.png';
import slide7 from './images/Slide7.png';

const pages = [
  { key: 'intro', title: 'Intro', image: slide1, quote: 'Your journey begins.' },
  { key: 'mentors', title: 'Mentors', image: slide2, quote: 'A mentor opens doors.' },
  { key: 'coaches', title: 'Coaches', image: slide3, quote: 'Coaches refine potential.' },
  { key: 'connectors', title: 'Connectors', image: slide4, quote: 'Connections spark growth.' },
  { key: 'sponsors', title: 'Sponsors', image: slide5, quote: 'Sponsorship elevates.' },
  { key: 'peers', title: 'Peers', image: slide6, quote: 'Peers share the path.' },
  { key: 'board', title: 'Board', image: slide7, quote: 'Build your board.' }
];

function App() {
  const [current, setCurrent] = useState('intro');
  const [data, setData] = useState(() => JSON.parse(localStorage.getItem('boardData') || '{}'));
  const [showLearn, setShowLearn] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState('');

  useEffect(() => {
    localStorage.setItem('boardData', JSON.stringify(data));
  }, [data]);

  const page = pages.find(p => p.key === current);

  const handleAdd = type => {
    setFormType(type);
    setShowForm(true);
  };

  const saveEntry = entry => {
    setData(prev => {
      const list = prev[formType] ? [...prev[formType], entry] : [entry];
      return { ...prev, [formType]: list };
    });
    setShowForm(false);
  };

  const handleUpload = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const obj = JSON.parse(ev.target.result);
        setData(obj);
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
    let y = 10;
    Object.keys(data).forEach(type => {
      doc.text(type.toUpperCase(), 10, y);
      y += 10;
      data[type].forEach(item => {
        doc.text(`- ${item.name} (${item.role})`, 10, y);
        y += 10;
      });
      y += 10;
    });
    doc.save('board.pdf');
  };

  const reset = () => {
    setData({});
    localStorage.removeItem('boardData');
  };

  return (
    <div className="app" style={{ backgroundImage: `url(${page.image})` }}>
      <input type="file" id="upload" accept="application/json" style={{ display: 'none' }} onChange={handleUpload} />
      <div className="top-buttons">
        <button onClick={() => document.getElementById('upload').click()}>Upload</button>
        {current === 'board' && <button onClick={reset}>Start New</button>}
      </div>
      <Quote text={page.quote} />
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
        {current === 'intro' ? <Intro /> : current === 'board' ? <Board data={data} /> : <List type={current} items={data[current] || []} />}
      </div>
      <nav className="nav">
        {pages.map(p => (
          <button key={p.key} className={p.key === current ? 'active' : ''} onClick={() => setCurrent(p.key)}>
            {p.title}
          </button>
        ))}
      </nav>
      {showLearn && <LearnModal type={current} onClose={() => setShowLearn(false)} />}
      {showForm && <FormModal type={formType} onSave={saveEntry} onClose={() => setShowForm(false)} />}
    </div>
  );
}

function Quote({ text }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(timer);
  }, [text]);
  return <div className={`quote ${visible ? 'fade-in' : 'fade-out'}`}>{text}</div>;
}

function Intro() {
  return (
    <div className="intro-text">
      <h1>Build Your Personal Board</h1>
    </div>
  );
}

function List({ type, items }) {
  return (
    <div className="list">
      {items.map((item, idx) => (
        <div key={idx} className="card">
          <h3>{item.name}</h3>
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
  return (
    <div className="board-summary">
      {Object.keys(data).map(type => (
        <div key={type}>
          <h2>{type}</h2>
          <ul>
            {data[type].map((item, i) => (
              <li key={i}>{item.name} - {item.role}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function LearnModal({ type, onClose }) {
  const messages = {
    mentors: 'Mentors provide wisdom and guidance.',
    coaches: 'Coaches help refine skills.',
    connectors: 'Connectors introduce new opportunities.',
    sponsors: 'Sponsors advocate for you.',
    peers: 'Peers share experiences.'
  };
  return (
    <div className="modal">
      <div className="modal-content">
        <h2>About {type}</h2>
        <p>{messages[type]}</p>
        <p>Consider their name, role, connection level, cadence and notes on engagement.</p>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

function FormModal({ type, onSave, onClose }) {
  const [form, setForm] = useState({ name: '', role: '', connection: 'Not yet', cadence: '', notes: '' });
  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });
  const save = () => {
    onSave(form);
  };
  return (
    <div className="modal">
      <div className="modal-content">
        <h2>Add {type.slice(0, -1)}</h2>
        <input name="name" placeholder="Name" value={form.name} onChange={handleChange} />
        <input name="role" placeholder="Role" value={form.role} onChange={handleChange} />
        <select name="connection" value={form.connection} onChange={handleChange}>
          {connectionLevels.map(level => (
            <option key={level}>{level}</option>
          ))}
        </select>
        <input name="cadence" placeholder="Cadence" value={form.cadence} onChange={handleChange} />
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
