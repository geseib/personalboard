import React,{useEffect,useRef,useState} from 'react';
import {getAIGuidance} from './ai-client.js';
import {SafeMarkdown} from './editing-workspace.js';
import {adviceFields,buildAdvisorRequest,parseAdvice} from './advisor-utils.js';

export function AdvisorWorkspace({open,onClose,type,form,boardData,entryIndex,onApply}) {
 const [question,setQuestion]=useState('');
 const [guidance,setGuidance]=useState('');
 const [stage,setStage]=useState('focus');
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const [draft,setDraft]=useState('');
 const [field,setField]=useState('notes');
 const [notice,setNotice]=useState('');
 const [metadata,setMetadata]=useState(null);
 const dialog=useRef(null),body=useRef(null),abort=useRef(null),sequence=useRef(0);
 const focusRef=useRef(null);
 const fields=adviceFields(type);
 const title=form.name||form.timeframe||'this entry';
 const close=()=>{sequence.current++;abort.current?.abort();setBusy(false);onClose();};
 useEffect(()=>{
  if(!open)return;
  setNotice('');
  focusRef.current=document.activeElement;
  const previous=document.body.style.overflow;document.body.style.overflow='hidden';
  dialog.current?.focus();
  return()=>{sequence.current++;abort.current?.abort();document.body.style.overflow=previous;if(focusRef.current?.isConnected)focusRef.current.focus();};
 },[open]);
 useEffect(()=>{if(open){body.current?.scrollTo({top:0});dialog.current?.focus();}},[stage]);
 const generate=async()=>{
  const request=++sequence.current;abort.current?.abort();abort.current=new AbortController();
  setBusy(true);setError('');setNotice('');dialog.current?.focus();
  const focus=question.trim()||'Help me see what is missing and choose one practical next step.';
  const payload=buildAdvisorRequest(type,form,boardData,entryIndex,focus);
  try{
   const result=await getAIGuidance(payload.type,payload.data,{}, {signal:abort.current.signal});
   if(request!==sequence.current)return;
   if(!result.guidance?.trim())throw Error('No advice came back. Try again with a more specific question.');
   setGuidance(result.guidance);setMetadata(result);setStage('read');
  }catch(e){if(request===sequence.current&&e.name!=='AbortError')setError(e.message||'Advice could not be prepared. Your draft is safe.');}
  finally{if(request===sequence.current){setBusy(false);dialog.current?.focus();}}
 };
 const choose=(content)=>{setDraft(content.replace(/\*\*/g,''));setField('notes');setStage('adapt');setNotice('');};
 const apply=()=>{if(!draft.trim())return;onApply(draft.trim(),field);setNotice(`Added to ${fields.find(f=>f.key===field)?.label.toLowerCase()}. Save your entry when you are ready.`);setStage('read');};
 const keyDown=e=>{
  if(e.key==='Escape'){e.stopPropagation();close();}
  if(e.key==='Tab'){
   const controls=[...dialog.current.querySelectorAll('button:not(:disabled),textarea,input,select,summary')];
   const first=controls[0],last=controls[controls.length-1];
   if(e.shiftKey&&(document.activeElement===first||document.activeElement===dialog.current)){e.preventDefault();last?.focus();}
   else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
  }
 };
 if(!open)return null;
 return <div className="advice-overlay">
  <section ref={dialog} className="advice-workspace" role="dialog" aria-modal="true" aria-labelledby="advice-title" tabIndex={-1} onKeyDown={keyDown}>
   <header className="advice-header"><div><span className="advice-kicker">A FRESH PERSPECTIVE</span><h2 id="advice-title">Think it through</h2><p>Advice for <strong>{title}</strong></p></div><button className="advice-close" aria-label="Close advice and return to editor" onClick={close}>×</button></header>
   <div className="advice-steps" aria-label="Advice process"><span aria-current={stage==='focus'?'step':undefined}>1 · Choose a focus</span><span aria-current={stage==='read'?'step':undefined}>2 · Explore advice</span><span aria-current={stage==='adapt'?'step':undefined}>3 · Make it yours</span></div>
   <div ref={body} className="advice-body" aria-busy={busy}>
    {error&&<div className="advice-error" role="alert">{error}<button onClick={generate}>Try again</button></div>}
    {notice&&<p className="advice-notice" role="status">{notice}</p>}
    {busy?<div className="advice-loading" role="status"><span className="advice-pulse"/><h3>Making space for a useful perspective</h3><p>Considering your current draft and board. This may take a moment.</p><button onClick={()=>{sequence.current++;abort.current?.abort();setBusy(false);dialog.current?.focus();}}>Cancel request</button></div>:stage==='focus'?<>
     <h3>What would help you move forward?</h3><p className="advice-muted">Choose a starting point or ask your own question. You decide what becomes part of your plan.</p>
     <div className="advice-prompts">{['Help me find a practical next step','What am I overlooking?','Help me prepare for a conversation'].map(prompt=><button key={prompt} aria-pressed={question===prompt} onClick={()=>setQuestion(prompt)}>{prompt}</button>)}</div>
     <label className="advice-label" htmlFor="advice-question">What would you like advice on?</label><textarea id="advice-question" value={question} maxLength={1500} onChange={e=>setQuestion(e.target.value)} placeholder="For example: How can I make this relationship more useful to both of us?"/>
     <details className="advice-context"><summary>Context included with your request</summary><p>Your current entry, including unsaved edits, plus the goals, strengths and relationships on your board. Only request advice when you are comfortable sharing that context with your configured AI provider.</p><SafeMarkdown text={Object.entries(form).filter(([,v])=>typeof v==='string'&&v.trim()).map(([k,v])=>`**${k}**\n${v}`).join('\n\n')}/></details>
    </>:stage==='read'?<>
     <div className="advice-reading-intro"><h3>A few things to consider</h3><p>Choose an idea to edit before adding it to your draft.</p>{metadata?.truncated&&<p className="advice-error">The response reached its length limit. Try a narrower question for a complete answer.</p>}</div>
     {parseAdvice(guidance).map((section,i)=><section className="advice-section" key={i}><h3>{section.title}</h3>{section.items.map((item,j)=><article className="advice-idea" key={j}><SafeMarkdown text={item}/><button onClick={()=>choose(item)}>Use this idea <span aria-hidden="true">↗</span></button></article>)}</section>)}
     <p className="advice-disclosure">AI suggestions are a starting point. Keep what fits your situation.{metadata?.actualModel||metadata?.model?` · ${metadata.actualModel||metadata.model}`:''}</p>
    </>:<>
     <h3>Make this idea useful to you</h3><p className="advice-muted">Edit the wording, choose where it belongs, and review the text you will keep.</p>
     <label className="advice-label" htmlFor="advice-edit">Your version</label><textarea id="advice-edit" className="advice-edit" value={draft} onChange={e=>setDraft(e.target.value)}/>
     <label className="advice-label" htmlFor="advice-field">Add to</label><select id="advice-field" value={field} onChange={e=>setField(e.target.value)}>{fields.map(f=><option key={f.key} value={f.key}>{f.label}</option>)}</select>
     <div className="advice-existing"><span className="advice-kicker">CURRENT TEXT WILL BE KEPT</span><p>{form[field]||'This field is currently empty.'}</p></div>
     <p className="advice-muted">This adds the idea after your existing text. You can undo it in the editor.</p>
    </>}
   </div>
   <footer className="advice-footer"><span>Your board changes only when you save the entry.</span><div><button onClick={stage==='adapt'?()=>setStage('read'):close}>{stage==='adapt'?'Back to advice':'Back to editor'}</button>{!busy&&(stage==='focus'?<button className="advice-primary" onClick={generate}>{guidance?'Get fresh advice':'Get advice'}</button>:stage==='adapt'?<button className="advice-primary" disabled={!draft.trim()} onClick={apply}>Add to draft</button>:<button className="advice-primary" onClick={()=>setStage('focus')}>Explore another angle</button>)}</div></footer>
  </section>
 </div>;
}
