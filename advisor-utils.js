export function adviceFields(type) {
 if(type==='goals')return [{key:'description',label:'Goal description'},{key:'notes',label:'Strategy & notes'}];
 if(type==='superpowers')return [{key:'description',label:'Your expertise'},{key:'notes',label:'Examples & notes'}];
 if(type==='mentees')return [{key:'notes',label:'Notes'},{key:'whatYouTeach',label:'What you teach'},{key:'whatYouLearn',label:'What you learn'}];
 return [{key:'notes',label:'Notes'},{key:'whatToLearn',label:'What you want to learn'},{key:'whatTheyGet',label:'What you offer in return'}];
}
export function buildAdvisorRequest(type,form,board,index,question) {
 const nested=type==='superpowers'||type==='mentees';
 const original=(nested?board.you?.[type]:board[type])||[];
 const items=original.map(item=>({...item}));
 if(Number.isInteger(index)&&index>=0&&index<items.length)items[index]={...form};else items.push({...form});
 const complete=nested?{...board,you:{...board.you,[type]:items}}:{...board,[type]:items};
 return {type:type==='superpowers'?'superpowers_advisor':`${type}_advisor`,data:{memberType:type,skillCategory:form.name,currentDescription:form.description,currentNotes:form.notes,currentFormData:{...form},allGoals:complete.goals||[],goals:complete.goals||[],allSkills:complete.you?.superpowers||[],boardData:complete,existingMembers:complete,advisorQuestion:question.trim()}};
}
// Preserve every section, including introductory prose and unfamiliar model headings.
export function parseAdvice(value) {
 const sections=[];let section={title:'Perspective',items:[]};let item='';
 const flush=()=>{if(item.trim())section.items.push(item.trim());item='';};
 const finish=()=>{flush();if(section.items.length)sections.push(section);};
 for(const raw of String(value||'').split('\n')){
  const line=raw.trim();const heading=line.match(/^#{1,6}\s+(.+)/)||line.match(/^\*\*([^*]+)\*\*:?$/);
  if(heading){finish();section={title:heading[1],items:[]};continue;}
  if(/^([-*_])(\s*\1){2,}$/.test(line)){flush();continue;} // horizontal rule, not an idea
  if(/^[-*•]\s+|^\d+[.)]\s+/.test(line)){flush();item=line.replace(/^([-*•]|\d+[.)])\s+/,'');}
  else if(!line){flush();}else item+=(item?'\n':'')+line;
 }
 finish();return sections;
}
// Text copied into a draft: drop a bold lead-in title ("**Title** - details") and Markdown markers.
export function ideaText(item) {
 let text=String(item||'').trim();
 const lead=text.match(/^\*\*([^*]+)\*\*(?:\s*[:\-–—]\s*|\s*\n+|(?<=:\*\*)\s+)([\s\S]+)$/);
 if(lead&&lead[2].trim())text=lead[2];
 return text.replace(/^>\s?/gm,'').replace(/\*\*([^*]+)\*\*/g,'$1').replace(/(^|[^*\w])\*([^*\n]+)\*(?=[^*\w]|$)/g,'$1$2').replace(/\*\*/g,'').trim();
}
