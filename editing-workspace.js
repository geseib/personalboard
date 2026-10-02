import React, { useEffect, useRef, useState } from 'react';
import { getAIGuidance } from './ai-client.js';
import { fieldLabel } from './editing-utils.js';

// React text nodes escape untrusted model output. Markdown never becomes raw HTML.
export function SafeMarkdown({ text = '' }) {
  return <div className="safe-markdown">{String(text).split('\n').map((line, index) => {
    const heading = line.match(/^#{1,6}\s+(.*)/);
    const content = heading ? heading[1] : line;
    const parts = content.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => part.startsWith('**') ? <strong key={i}>{part.slice(2,-2)}</strong> : part.startsWith('`') ? <code key={i}>{part.slice(1,-1)}</code> : part);
    return heading ? <h4 key={index}>{parts}</h4> : <div key={index}>{parts.length && content ? parts : <br />}</div>;
  })}</div>;
}

export function WritingResultsModal({ modal, onClose }) {
  return modal.show ? <WritingReview key={modal.currentVersion?.timestamp || modal.requestId || modal.type} modal={modal} onClose={onClose} /> : null;
}
function WritingReview({ modal, onClose }) {
  const fields = Object.keys(modal.improvements || {}).filter(key => typeof modal.updatedForm?.[key] === 'string' && Object.prototype.hasOwnProperty.call(modal.originalForm || {},key));
  const [drafts, setDrafts] = useState(() => Object.fromEntries(fields.map(key => [key,modal.updatedForm[key]])));
  const [selected, setSelected] = useState(() => Object.fromEntries(fields.map(key => [key,true])));
  const [modes, setModes] = useState({});
  const [instructions, setInstructions] = useState({});
  const [history, setHistory] = useState({});
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [metadata, setMetadata] = useState(null);
  const dialog = useRef(null);
  const abort = useRef(null);
  useEffect(() => {
    const prior = document.activeElement;
    dialog.current?.focus();
    return () => { abort.current?.abort(); if (prior?.isConnected) prior.focus(); };
  }, []);
  const close = () => { abort.current?.abort(); onClose(); };
  const keyDown = e => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
    if (e.key !== 'Tab') return;
    const controls = [...dialog.current.querySelectorAll('button:not(:disabled), textarea:not(:disabled), select:not(:disabled), input:not(:disabled), [tabindex="0"]')];
    const first = controls[0], last = controls[controls.length-1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last?.focus(); }
    else if (!e.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { e.preventDefault(); first?.focus(); }
  };
  const refine = async (field, instruction) => {
    if (!instruction?.trim() || busy) return;
    const before = drafts[field];
    setBusy(field); setError('');
    abort.current = new AbortController();
    try {
      const response = await getAIGuidance('writing_refine', {text:before,instruction,field,originalText:modal.originalForm[field]}, {}, {signal:abort.current.signal});
      if (abort.current.signal.aborted) return;
      if (!response.guidance?.trim()) throw new Error('No suggestion returned. Please try again.');
      setHistory(prev => ({...prev,[field]:[...(prev[field] || []),before]}));
      setDrafts(prev => ({...prev,[field]:response.guidance.trim()}));
      setMetadata(response.metadata || response.model || null);
    } catch (err) { if (err.name !== 'AbortError') setError(err.message || 'Could not revise this suggestion. Your text is still here.'); }
    finally { setBusy(null); }
  };
  const undo = field => {
    const versions = history[field] || [];
    if (!versions.length) return;
    setDrafts(prev => ({...prev,[field]:versions[versions.length-1]}));
    setHistory(prev => ({...prev,[field]:versions.slice(0,-1)}));
  };
  const selectedFields = fields.filter(field => selected[field]);
  return <div className="modal writing-review-overlay" onMouseDown={e => { if(e.target === e.currentTarget) close(); }}>
    <section ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="writing-review-title" className="writing-review" onKeyDown={keyDown}>
      <header className="writing-review-header"><div><span className="writing-eyebrow">YOUR WORDS, WITH A LITTLE HELP</span><h2 id="writing-review-title">{modal.type === 'success' ? 'Make it sound like you' : 'Writing assistant'}</h2><p>Review, edit, or ask for another take. Your original stays safe until you apply.</p></div><button className="writing-close" aria-label="Close writing review" onClick={close}>×</button></header>
      <div className="writing-review-body">
        {modal.type !== 'success' ? <p role={modal.type === 'error' ? 'alert' : 'status'}>{modal.message}</p> : fields.map(field => <article className="writing-field-card" key={field}>
          <div className="writing-field-heading"><h3>{fieldLabel(field)}</h3><label className="writing-check"><input type="checkbox" checked={!!selected[field]} onChange={e=>setSelected(prev=>({...prev,[field]:e.target.checked}))} />Include change</label></div>
          <div className="writing-comparison"><div className="writing-original"><span className="writing-eyebrow">ORIGINAL</span><p>{modal.originalForm[field] || 'No text yet'}</p></div><div className="writing-suggestion"><label htmlFor={`suggestion-${field}`} className="writing-eyebrow">YOUR EDITABLE SUGGESTION</label><textarea id={`suggestion-${field}`} value={drafts[field]} disabled={busy === field} onChange={e=>setDrafts(prev=>({...prev,[field]:e.target.value}))} /><span className="writing-count">{drafts[field]?.length || 0} characters</span></div></div>
          <div className="writing-refine"><span className="writing-eyebrow">TRY ANOTHER DIRECTION</span><div className="writing-chips">{['Make it shorter','Keep my original voice','Make it more specific'].map(instruction=><button key={instruction} disabled={!!busy} onClick={()=>refine(field,instruction)}>{instruction}</button>)}</div><div className="writing-direction"><input aria-label={`Direction for ${fieldLabel(field)}`} placeholder="e.g. Less formal, and focus on leadership" value={instructions[field] || ''} onChange={e=>setInstructions(prev=>({...prev,[field]:e.target.value}))} onKeyDown={e=>{if(e.key==='Enter') {e.preventDefault();refine(field,instructions[field]);}}} /><button disabled={!!busy || !instructions[field]?.trim()} onClick={()=>refine(field,instructions[field])}>{busy===field ? 'Revising…' : 'Revise suggestion'}</button></div></div>
          <div className="writing-field-footer"><label>Apply to {fieldLabel(field).toLowerCase()} <select aria-label={`Apply method for ${fieldLabel(field)}`} value={modes[field] || 'replace'} onChange={e=>setModes(prev=>({...prev,[field]:e.target.value}))}><option value="replace">Replace text</option><option value="append">Append to existing text</option></select></label><button className="writing-text-button" disabled={!!busy || !(history[field]?.length)} onClick={()=>undo(field)}>Undo revision{history[field]?.length ? ` (${history[field].length})` : ''}</button></div>
        </article>)}
        {error && <p className="writing-error" role="alert">{error}</p>}
        {busy && <p role="status" className="writing-status">Revising your suggestion. You can close this review to cancel.</p>}
      </div>
      <footer className="writing-review-footer"><span>{selectedFields.length ? `${selectedFields.length} change${selectedFields.length===1?'':'s'} selected · Saved to your draft when applied` : 'Your original text is unchanged'}{typeof metadata === 'string' ? ` · ${metadata}` : ''}</span><div><button onClick={close}>Keep original</button>{modal.type==='success' && <button className="writing-primary" disabled={!!busy || !selectedFields.length} onClick={()=>{const edits=Object.fromEntries(selectedFields.map(field=>[field,drafts[field]]));const result=modal.onApplyChanges?.(edits,modes);if(result?.conflicts?.length){setError(`Your ${result.conflicts.map(fieldLabel).join(', ')} changed while this suggestion was being prepared. Keep your latest draft by closing this review and requesting a fresh suggestion, or choose Append.`);return;}close();}}>Apply {selectedFields.length === 1 ? fieldLabel(selectedFields[0]).toLowerCase() : `${selectedFields.length} changes`}</button>}</div></footer>
    </section>
  </div>;
}
