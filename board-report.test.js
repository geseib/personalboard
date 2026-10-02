import { jsPDF } from 'jspdf';
import { buildBoardReport } from './board-report.js';

function trackedDocument() {
  const doc=new jsPDF();const outliers=[];const written=[];const original=doc.text.bind(doc);
  doc.text=(value,x,y,options={})=>{
    const line=String(value);const width=doc.getTextWidth(line);
    const left=options.align==='right'?x-width:options.align==='center'?x-width/2:x;
    if(left<19.5 || left+width>190.5 || y<10 || y>289)outliers.push({line,x,y,width,left});
    written.push(line);return original(value,x,y,options);
  };
  return {doc,outliers,written};
}

test('exports every member and exact cadence, with no eight-person cap',()=>{
  const {doc,outliers,written}=trackedDocument();
  const mentors=Array.from({length:24},(_,i)=>({name:`Member ${i+1}`,cadence:'Bi-weekly',whatToLearn:'Practice thoughtful leadership.'}));
  buildBoardReport({mentors},'',{doc});
  for(const person of mentors)expect(written.filter(v=>v===person.name)).toHaveLength(2);
  expect(written.filter(v=>v==='Bi-weekly')).toHaveLength(48);
  expect(outliers).toEqual([]);
});

test('paginates long names, notes, goals, and analysis inside printable bounds',()=>{
  const {doc,outliers,written}=trackedDocument();
  const long='A detailed reflection about relationships and career direction. '.repeat(170)+'FINAL_SENTINEL';
  buildBoardReport({you:{name:'A very long personal name '.repeat(8)},goals:[{timeframe:'Long-term vision',description:long}],mentors:[{name:'A long member name '.repeat(22),notes:long,cadence:'Bi-weekly'}]},'# Reflection\n'+long,{doc});
  expect(doc.getNumberOfPages()).toBeGreaterThan(8);
  expect(written.filter(v=>v.includes('FINAL_SENTINEL'))).toHaveLength(3);
  expect(outliers).toEqual([]);
});

test('empty report stays useful and includes reciprocal mentoring when supplied',()=>{
  const {doc,written}=trackedDocument();
  buildBoardReport({you:{mentees:[{name:'Alex',whatYouTeach:'Testing',whatYouLearn:'Fresh perspectives'}]}},'',{doc});
  expect(written).toContain('Testing');expect(written).toContain('Fresh perspectives');
  expect(written).not.toContain('Board insights');
  expect(doc.getNumberOfPages()).toBe(5);
});
