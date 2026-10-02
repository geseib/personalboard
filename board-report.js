import { jsPDF } from 'jspdf';

import { REPORT_ROLES } from './board-roles.js';
export { REPORT_ROLES } from './board-roles.js';
const INK=[32,51,73], MUTED=[94,110,129], BLUE=[37,99,235], LIGHT=[242,246,250];
const list=value=>Array.isArray(value)?value:[];
const clean=value=>String(value??'').replace(/[\u2010-\u2015]/g,'-').replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/\u2026/g,'...').replace(/\t/g,'  ').replace(/\r/g,'');

/** One renderer for browser downloads and repeatable layout checks. No AI calls. */
export function buildBoardReport(data={}, advice='', options={}) {
  const doc=options.doc || new jsPDF({unit:'mm',format:'a4'});
  const W=210, H=297, M=20, BOTTOM=274, WIDTH=W-M*2;
  let y=28, section='Overview';
  const date=(options.date || new Date()).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
  const members=REPORT_ROLES.flatMap(role=>list(data[role.key]).map(member=>({...member,category:role})));
  const goals=list(data.goals).filter(g=>g.description?.trim()||g.notes?.trim());
  const powers=list(data.you?.superpowers).filter(g=>g.description?.trim()||g.notes?.trim());
  const name=clean(data.you?.name || 'Your personal board');
  doc.setProperties({title:`${name} | Personal Board of Directors`,subject:'Personal board, goals and relationship plan',creator:'Personal Board of Directors'});
  function font(size=10,weight='normal',color=INK){doc.setFont('helvetica',weight);doc.setFontSize(size);doc.setTextColor(...color);}
  function rule(at=y){doc.setDrawColor(222,230,238);doc.setLineWidth(.3);doc.line(M,at,W-M,at);}
  function newPage(){doc.addPage();y=30;font(8,'bold',MUTED);doc.text('PERSONAL BOARD OF DIRECTORS',M,16);font(8,'normal',MUTED);doc.text(section,W-M,16,{align:'right'});rule(21);}
  function ensure(height){if(y+height>BOTTOM)newPage();}
  function text(value,{size=10,weight='normal',color=INK,x=M,width=WIDTH,leading=5,gap=3}={}){
    font(size,weight,color);
    const lines=doc.splitTextToSize(clean(value),width);
    for(const line of lines){ensure(leading);font(size,weight,color);doc.text(line,x,y);y+=leading;}
    y+=gap;
  }
  function label(value,color=BLUE){ensure(13);text(value.toUpperCase(),{size:8,weight:'bold',color,leading:4,gap:3});}
  function heading(value,subtitle){ensure(28);text(value,{size:23,weight:'bold',leading:10,gap:2});if(subtitle)text(subtitle,{color:MUTED,leading:5,gap:8});}
  function start(title,subtitle){section=title;newPage();heading(title,subtitle);}
  function field(title,value){if(!String(value??'').trim())return;ensure(18);label(title,MUTED);text(value,{gap:5});}
  function entry(title,color=BLUE){ensure(28);rule();y+=8;text(title,{size:15,weight:'bold',color,leading:7,gap:4});}

  function keepEntry(title, fields, extra=0) {
    font(15,'bold');
    let height=12+doc.splitTextToSize(clean(title),WIDTH).length*7+extra;
    font(10);
    for(const value of fields)if(String(value??'').trim())height+=12+doc.splitTextToSize(clean(value),WIDTH).length*5;
    if(height<=220)ensure(height);
  }

  // Opening spread: a compact, factual snapshot rather than an ornamental cover.
  doc.setFillColor(...INK);doc.rect(0,0,W,7,'F');
  label('Personal Board of Directors');y+=6;
  text('People who help\nyou move forward.',{size:30,weight:'bold',leading:12,gap:7});
  text(name,{size:16,leading:8,gap:2});
  text(`Your relationship & growth plan  /  ${date}`,{size:9,color:MUTED,gap:10});
  const metrics=[['BOARD MEMBERS',members.length],['ROLES REPRESENTED',REPORT_ROLES.filter(r=>list(data[r.key]).length).length+' / 5'],['GOALS DEFINED',goals.length]];
  ensure(31);
  metrics.forEach(([title,value],i)=>{const x=M+i*58;doc.setFillColor(...LIGHT);doc.roundedRect(x,y,54,29,2,2,'F');font(20,'bold');doc.text(String(value),x+5,y+12);font(7,'bold',MUTED);doc.text(title,x+5,y+22);});y+=43;
  label('Your board at a glance');
  REPORT_ROLES.forEach(role=>{ensure(20);doc.setFillColor(...role.color);doc.roundedRect(M,y-3,1.5,13,.5,.5,'F');font(11,'bold');doc.text(role.name,M+6,y+1);font(9,'normal',MUTED);doc.text(role.purpose,M+6,y+7);font(10,'bold',role.color);doc.text(String(list(data[role.key]).length).padStart(2,'0'),W-M,y+3,{align:'right'});y+=18;});
  y+=3;rule();y+=9;
  text('A working plan, built around you.',{size:12,weight:'bold',leading:6});
  text('Use this report to prepare for conversations, make thoughtful asks, and revisit the relationships that support your goals.',{size:10,color:MUTED,gap:5});

  start('Your direction','What you are working toward - and what you already bring.');
  label('Goals & vision');
  if(!goals.length)text('No goals added yet. Start with one outcome you want to work toward.',{color:MUTED});
  goals.forEach(g=>{keepEntry(g.timeframe||'Goal',[g.description,g.notes]);entry(g.timeframe||'Goal');text(g.description||'No description added.',{gap:5});field('Strategy & progress',g.notes);y+=3;});
  if(powers.length){start('Strengths to build on','The capabilities and experiences you bring to every relationship.');powers.forEach(p=>{keepEntry(p.name||'Strength',[p.description,p.notes]);entry(p.name||'Strength',[16,145,108]);text(p.description||'',{gap:4});field('Examples & notes',p.notes);});}

  start('Your people','A complete directory of your board and the value you exchange.');
  if(!members.length)text('Your board is ready to grow. Add a person whose perspective would help with your next goal.',{color:MUTED});
  REPORT_ROLES.forEach(role=>{
    const people=members.filter(m=>m.category.key===role.key);if(!people.length)return;
    keepEntry(people[0].name||'Unnamed board member',[people[0].role,people[0].connection,people[0].cadence||'Not set',people[0].whatToLearn,people[0].whatTheyGet,people[0].notes],18);y+=3;label(`${role.name} / ${role.purpose}`,role.color);
    people.forEach(member=>{
      keepEntry(member.name||'Unnamed board member',[member.role,member.connection,member.cadence||'Not set',member.whatToLearn,member.whatTheyGet,member.notes],4);
      entry(member.name||'Unnamed board member',role.color);
      field('Role',member.role);field('Connection',member.connection);
      field('Meeting cadence',member.cadence||'Not set');
      field('What I want to learn',member.whatToLearn);field('What I offer in return',member.whatTheyGet);field('Notes',member.notes);y+=4;
    });
  });
  const mentees=list(data.you?.mentees);
  if(mentees.length){start('Paying it forward','The people you support - and what you learn together.');mentees.forEach(m=>{keepEntry(m.name||'Mentee',[m.role,m.connection,m.cadence,m.whatYouTeach,m.whatYouLearn,m.notes]);entry(m.name||'Mentee',[16,145,108]);field('Role',m.role);field('Connection',m.connection);field('Meeting cadence',m.cadence);field('What I teach',m.whatYouTeach);field('What I learn',m.whatYouLearn);field('Notes',m.notes);});}

  start('Stay connected','A practical rhythm for keeping your relationships active.');
  function tableHeader(){doc.setFillColor(...LIGHT);doc.rect(M,y-4,WIDTH,10,'F');font(8,'bold',MUTED);doc.text('PERSON / BOARD ROLE',M+3,y+2);doc.text('MEETING CADENCE',M+117,y+2);y+=13;}
  tableHeader();
  if(!members.length)text('No meeting cadence to show yet.',{color:MUTED});
  members.forEach(m=>{
    font(10,'bold');const names=doc.splitTextToSize(clean(m.name||'Unnamed board member'),105);
    font(10);const cadence=doc.splitTextToSize(clean(m.cadence||'Not set'),49);
    const height=Math.max(names.length*5+8,cadence.length*5+4);
    // Very long values use the same paginated text flow as directory entries.
    if(height>190){entry(m.name||'Unnamed board member',m.category.color);field('Board role',m.category.name);field('Meeting cadence',m.cadence||'Not set');return;}
    if(y+height>BOTTOM){newPage();tableHeader();}
    const top=y;doc.setFillColor(...m.category.color);doc.circle(M+1,y-1,1,'F');
    font(10,'bold');names.forEach((line,i)=>doc.text(line,M+5,top+i*5));font(8,'normal',MUTED);doc.text(m.category.name,M+5,top+names.length*5+1);
    font(10);cadence.forEach((line,i)=>doc.text(line,M+117,top+i*5));y+=height;rule(y-3);y+=3;
  });
  ensure(52);y+=10;label('For your next conversation');
  text('1. Share the goal you are working toward.\n2. Bring one specific question or request.\n3. Agree on a next step and a time to reconnect.',{leading:7,color:MUTED});

  if(String(advice||'').trim()){
    start('Board insights','AI-generated reflection to review alongside your own judgment.');
    for(const raw of clean(advice).split('\n')){
      const line=raw.trim();if(!line){y+=3;continue;}
      const plain=line.replace(/\*\*(.*?)\*\*/g,'$1').replace(/`([^`]+)`/g,'$1');
      if(/^#{1,6}\s/.test(line)){ensure(25);y+=4;text(plain.replace(/^#{1,6}\s+/,''),{size:15,weight:'bold',leading:7,gap:5});}
      else if(/^[-*•]\s/.test(line)){ensure(10);text('- '+plain.replace(/^[-*•]\s+/,''),{x:M+3,width:WIDTH-3,leading:5,gap:3});}
      else text(plain,{leading:5,gap:4});
    }
  }
  // Consistent folios are added last so every page has the final page count.
  const pages=doc.getNumberOfPages();
  for(let n=1;n<=pages;n++){doc.setPage(n);rule(282);font(8,'normal',MUTED);doc.text('PERSONAL BOARD OF DIRECTORS  /  PRIVATE WORKING COPY',M,288);doc.text(`${n} / ${pages}`,W-M,288,{align:'right'});}
  return doc;
}
