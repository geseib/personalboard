import {buildAdvisorRequest,parseAdvice,adviceFields} from './advisor-utils.js';
test('keeps unsaved skills and mentees in the nested profile without changing saved data',()=>{
 const data={you:{superpowers:[{description:'old'}],mentees:[{notes:'old'}]},goals:[]};
 const request=buildAdvisorRequest('mentees',{notes:'new'},data,0,'Help me prepare');
 expect(request.data.boardData.you.mentees[0].notes).toBe('new');
 expect(data.you.mentees[0].notes).toBe('old');
 expect(request.data.advisorQuestion).toBe('Help me prepare');
 expect(buildAdvisorRequest('superpowers',{description:'new'},data,0,'').data.allSkills[0].description).toBe('new');
});
test('retains preambles, unknown headings, paragraphs and numbered ideas from any model',()=>{
 const sections=parseAdvice('Opening context.\n\n## A different heading\n1. First idea\n   Extra detail\n2. Second idea\n\n### Questions\n- Ask this?');
 expect(sections.flatMap(s=>s.items).join('\n')).toContain('Opening context.');
 expect(sections[1].items).toEqual(['First idea\nExtra detail','Second idea']);
 expect(sections[2].items).toEqual(['Ask this?']);
 expect(parseAdvice('Plain unstructured response.')[0].items).toEqual(['Plain unstructured response.']);
 expect(adviceFields('mentees').map(f=>f.key)).toContain('whatYouTeach');
});
