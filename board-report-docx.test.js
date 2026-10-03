import { Packer } from 'docx';
import { buildBoardReportDocument } from './board-report-docx.js';
const board={you:{name:'Maya Chen',superpowers:[{name:'Facilitation',description:'Runs clear workshops'}],mentees:[{name:'Sam',role:'Analyst'}]},
 goals:[{timeframe:'1 Year',description:'Lead a product team',notes:'Ask for a pilot'}],
 mentors:[{name:'Dana',role:'Director',cadence:'Monthly',whatToLearn:'Hiring'}],sponsors:[],coaches:[],connectors:[],peers:[{name:'Priya'}]};
test('Word report contains the same people, goals and insights as the PDF',async()=>{
 const buffer=await Packer.toBuffer(buildBoardReportDocument(board,'## Focus\n- **Ask** Dana about hiring\n---\n1. Book time',{date:new Date('2026-10-03')}));
 const {default:JSZip}=await import('jszip');
 const xml=await (await JSZip.loadAsync(buffer)).file('word/document.xml').async('string');
 for(const text of ['Maya Chen','Lead a product team','Ask for a pilot','Dana','Hiring','Priya','Sam','Facilitation','Board insights','Ask','Book time','October 3, 2026'])expect(xml).toContain(text);
 expect(xml).not.toContain('**');expect(xml).not.toContain('---');
});
test('empty boards still produce a valid document',async()=>{
 const buffer=await Packer.toBuffer(buildBoardReportDocument({}));
 expect(buffer.length).toBeGreaterThan(5000);
});
