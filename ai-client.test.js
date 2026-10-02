import { jest } from '@jest/globals';
const values = new Map();
globalThis.localStorage = {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
globalThis.window = { location: { hostname:'board.seibtribe.us' } };
const {getAIGuidance,setAPIBaseUrl}=await import('./ai-client.js');
const token='header.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64')+'.signature';
beforeEach(()=>{ values.clear(); values.set('sessionToken',token); });
afterEach(()=>jest.restoreAllMocks());

test('enhanced guidance receives the populated canonical board, including nested skills',async()=>{
 values.set('boardData',JSON.stringify({you:{name:'Alex',superpowers:[{name:'Facilitation'}],mentees:[]},goals:[{description:'Lead a team'}],mentors:[{name:'Taylor'}]}));
 values.set('goals',JSON.stringify([{description:'Stale legacy goal'}]));
 let payload;
 globalThis.fetch=async(url,request)=>{payload=JSON.parse(request.body);return {ok:true,status:200,json:async()=>({guidance:'Advice'})};};
 await getAIGuidance('board_analysis',{});
 expect(payload.context.userData.goals).toEqual([{description:'Lead a team'}]);
 expect(payload.context.userData.superpowers).toEqual([{name:'Facilitation'}]);
 expect(payload.context.userData.mentors).toEqual([{name:'Taylor'}]);
});

test('rejected credentials terminate with a recovery message instead of recursive reactivation',async()=>{
 let calls=0;
 globalThis.fetch=async()=>{calls++;return {ok:false,status:401,json:async()=>({})};};
 await expect(getAIGuidance('goals_advisor',{})).rejects.toThrow(/access.*expired|access.*rejected/i);
 expect(calls).toBe(1);
 expect(values.has('sessionToken')).toBe(false);
});

test('cancelled generation does not send a request',async()=>{
 let calls=0;globalThis.fetch=async()=>{calls++;return {ok:true,status:200,json:async()=>({})};};
 const controller=new AbortController();controller.abort();
 await expect(getAIGuidance('writing_refine',{text:'Draft'}, {},{signal:controller.signal})).rejects.toThrow();
 expect(calls).toBe(0);
});

test('rate limit errors explain retry recovery rather than HTTP status text',async()=>{
 globalThis.fetch=async()=>({ok:false,status:429,statusText:'Too Many Requests',json:async()=>({})});
 await expect(getAIGuidance('goals_advisor',{})).rejects.toThrow(/busy|wait|try again/i);
});

test('field refinement does not send the whole personal board',async()=>{
 values.set('boardData',JSON.stringify({mentors:[{name:'Private contact'}]}));
 let payload;globalThis.fetch=async(url,request)=>{payload=JSON.parse(request.body);return {ok:true,status:200,json:async()=>({guidance:'Clear draft'})};};
 await getAIGuidance('writing_refine',{text:'A draft',instruction:'Make concise'});
 expect(payload.context.userData).toEqual({});
 expect(payload.data.text).toBe('A draft');
});
test('corrupt saved context does not prevent a field-specific AI request',async()=>{
 values.set('boardData','broken-json');
 let payload;globalThis.fetch=async(url,request)=>{payload=JSON.parse(request.body);return {ok:true,status:200,json:async()=>({guidance:'Advice'})};};
 await getAIGuidance('goals_advisor',{description:'Lead a team'});
 expect(payload.context.userData.goals).toEqual([]);
 expect(payload.data.description).toBe('Lead a team');
});
test('empty successful responses are rejected without presenting an empty suggestion',async()=>{
 globalThis.fetch=async()=>({ok:true,status:200,json:async()=>({success:true,guidance:'  '})});
 await expect(getAIGuidance('goals_advisor',{})).rejects.toThrow(/no usable suggestion/i);
});

test('local override can be set and invalid URLs cannot replace it',async()=>{
 expect(()=>setAPIBaseUrl('http://localhost:3001')).not.toThrow();
 expect(()=>setAPIBaseUrl('javascript:alert(1)')).toThrow();
 let endpoint;globalThis.fetch=async(url)=>{endpoint=url;return {ok:true,status:200,json:async()=>({guidance:'OK'})};};
 await getAIGuidance('goals_advisor',{});
 expect(endpoint).toBe('http://localhost:3001/ai-guidance');
});

test('parallel writing calls share one access-code dialog and activation',async()=>{
 values.delete('sessionToken');values.set('clientId','local-test-client');
 const modals=[];
 globalThis.document={activeElement:null,body:{appendChild:el=>modals.push(el),removeChild:el=>modals.splice(modals.indexOf(el),1)},createElement:()=>{
  const controls=new Map();
  return {setAttribute(){},addEventListener(){},querySelector(selector){if(!controls.has(selector))controls.set(selector,{value:'123456',style:{},classList:{remove(){}},events:{},addEventListener(name,handler){this.events[name]=handler;},focus(){},click(){this.events.click?.();}});return controls.get(selector);}};
 }};
 let activations=0;
 globalThis.fetch=async url=>{if(url.endsWith('/activate')){activations++;return {ok:true,status:200,json:async()=>({token})};}return {ok:true,status:200,json:async()=>({guidance:'A clear draft'})};};
 const pending=[getAIGuidance('writing_refine',{text:'One'}),getAIGuidance('writing_refine',{text:'Two'})];
 const count=modals.length;
 for(const modal of [...modals])modal.querySelector('#auth-submit').click();
 await Promise.all(pending);
 expect(count).toBe(1);
 expect(activations).toBe(1);
 delete globalThis.document;
});
