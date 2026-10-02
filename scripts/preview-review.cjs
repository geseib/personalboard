// Local UI review only. Never invokes a cloud provider or writes production data.
// Run after npm run build. Admin password: preview; workshop code: 123456.
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {MODELS,DEFAULT_SETTINGS,validateSettings}=require('../lambda-functions/ai-guidance/model-router');
const {createAiAdmin}=require('../lambda-functions/admin-data/ai-settings');
const root=path.resolve(__dirname,'../dist');
const port=Number(process.env.PREVIEW_PORT||8898);
let current=null;const history=new Map();
const admin=createAiAdmin({get:async()=>current,history:async()=>[...history.values()].reverse(),revision:async n=>history.get(n),save:async(next,previous,expected)=>{if((current?.revision||0)!==expected)throw Error('Stale revision');history.set(previous.revision,previous);history.set(next.revision,next);current=next;},invoke:async input=>{
 if(input.internalAction==='modelRegistry')return {models:MODELS.map(m=>({...m,configured:true})),defaults:DEFAULT_SETTINGS};
 if(input.internalAction==='validateSettings')return {settings:validateSettings(input.settings)};
 return {results:input.modelIds.map(id=>({requestedModel:id,actualModel:id,actualModelId:MODELS.find(m=>m.id===id).modelId,text:'LOCAL SAMPLE RESPONSE — not a live model result.\n\nLead a project update this quarter and ask a trusted colleague for feedback.',latencyMs:0,usage:{},estimatedCostUsd:null,fallbackUsed:false}))};
}});
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon','.mp3':'audio/mpeg'};
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 const json=(data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 try {
  if(url.pathname.startsWith('/api/')){
   let body='';for await(const chunk of req){body+=chunk;if(body.length>100000)throw Error('Request too large');}const input=body?JSON.parse(body):{};
   const route=url.pathname.slice(4);
   if(route==='/activate')return json({token:'preview.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64')+'.sample'});
   if(route==='/ai-guidance'){
    const text=input.data?.text||'';
    const suggestion=text?((input.data?.instruction||'').toLowerCase().includes('short')?'Lead with confidence and ask for feedback.':text.replace(/get better at/g,'improve at')+' I will ask a trusted colleague for feedback.'):'Over the next three months, I want to build my leadership skills by practicing [specific activity] and seeking feedback from [person].';
    return json({success:true,guidance:input.type==='writing_refine'?suggestion:'# A practical next step\n\n- Choose one project update where you can practice presenting your ideas. Keep the scope small enough to try this week.\n- Ask a trusted colleague for feedback on one specific thing, such as clarity or how you handle questions.\n\n## Questions worth exploring\n\n- What would progress look like in your next conversation?\n- Which part feels hardest right now: preparing your message, speaking up, or responding to feedback?\n\n## Make the relationship useful to both of you\n\n- Share what you tried and what changed. A short follow-up helps your advisor see how their advice made a difference.\n- Offer something useful in return, such as a fresh perspective or a resource related to their work.',...(current?.showModelToUsers?{model:'local-sample',actualModel:'local-sample'}:{}),fallbackUsed:false});
   }
   if(route.startsWith('/admin/')&&req.headers['x-admin-password']!=='preview')return json({error:'Use preview for local review.'},401);
   if(route==='/admin/ai/settings')return json(req.method==='PUT'?await admin.activate(input):await admin.settings());
   if(route==='/admin/ai/history')return json({history:await admin.history()});
   if(route==='/admin/ai/rollback')return json(await admin.rollback(input));
   if(route==='/admin/ai/compare')return json(await admin.compare(input));
   if(route==='/admin/prompts')return json({prompts:[],activeSelections:{},stats:{totalPrompts:0,activePrompts:0,avgTokens:0}});
   if(route==='/admin/themes')return json({themes:[]});
   if(route==='/admin/tokens/stats')return json({AVAILABLE:0,ASSIGNED:0,CLAIMED:0});
   return json({error:'Not provided by local fixture'},404);
  }
  let pathname=decodeURIComponent(url.pathname);if(pathname.endsWith('/'))pathname+='index.html';
  const file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep))return json({error:'Not found'},404);
  let content=await fs.promises.readFile(file);
  if(file.endsWith('.html'))content=Buffer.from(content.toString().replace(/<html[^>]*>/i,match=>match+`<script>window.PERSONAL_BOARD_CONFIG={apiBaseUrl:'http://127.0.0.1:${port}/api'};</script><style>body:after{content:'LOCAL REVIEW · Sample AI responses · No cloud calls';position:fixed;top:0;left:0;right:0;background:#172e43;color:white;font:11px system-ui;text-align:center;padding:3px;z-index:10000;pointer-events:none}</style>`));
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(content);
 }catch(error){json({error:error.code==='ENOENT'?'Not found':error.message},error.statusCode||400);}
});
server.listen(port,'127.0.0.1',()=>console.log(`Local review: http://127.0.0.1:${port}/ — sample AI only. Admin password: preview`));
