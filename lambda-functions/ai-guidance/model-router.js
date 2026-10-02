// All browser features share this registry and routing policy. No client model overrides.
const PRICING_DATE = '2026-10-01';
const MODELS = [
 {id:'nova-micro',name:'Amazon Nova Micro',provider:'bedrock',modelId:'us.amazon.nova-micro-v1:0',inputPrice:0.035,outputPrice:0.14},
 {id:'nova-lite',name:'Amazon Nova Lite',provider:'bedrock',modelId:'us.amazon.nova-lite-v1:0',inputPrice:0.06,outputPrice:0.24},
 {id:'claude-haiku',name:'Claude Haiku 4.5',provider:'bedrock',modelId:'us.anthropic.claude-haiku-4-5-20251001-v1:0',inputPrice:1.1,outputPrice:5.5},
 {id:'claude-sonnet',name:'Claude Sonnet 4.6',provider:'bedrock',modelId:'us.anthropic.claude-sonnet-4-6',inputPrice:3.3,outputPrice:16.5},
 {id:'gemini-flash-lite',name:'Gemini 2.5 Flash-Lite',provider:'gemini',modelId:'gemini-2.5-flash-lite',inputPrice:0.10,outputPrice:0.40}
].map(model=>Object.freeze({...model,pricingDate:PRICING_DATE,currency:'USD',priceUnit:'per million tokens'}));
const DEFAULT_SETTINGS = Object.freeze({defaultModel:'nova-micro',overrides:{},fallbackModel:null,revision:0});
function modelFor(id){const model=MODELS.find(m=>m.id===id);if(!model)throw new Error('Unsupported AI model');return model;}
function validateSettings(settings){
 if(!settings||typeof settings!=='object'||Array.isArray(settings))throw Error('AI settings must be an object');
 modelFor(settings.defaultModel);
 const overrides=settings.overrides??{};
 if(typeof overrides!=='object'||Array.isArray(overrides))throw Error('Invalid task overrides');
 for(const [task,id] of Object.entries(overrides)){if(!['writing','board'].includes(task))throw Error('Unsupported AI task');if(id)modelFor(id);}
 if(settings.fallbackModel)modelFor(settings.fallbackModel);
 return {defaultModel:settings.defaultModel,overrides:Object.fromEntries(Object.entries(overrides).filter(([,id])=>id)),fallbackModel:settings.fallbackModel||null};
}
function taskFor(type){return type==='board_analysis'||type==='board_analysis_advisor'||type==='goal_alignment'?'board':'writing';}
function isTransient(error){return ['TimeoutError','AbortError','ThrottlingException','ServiceUnavailableException','InternalServerException','ModelTimeoutException','ModelNotReadyException'].includes(error.name)||error.status===429||error.status>=500;}
const TOTAL_BUDGET_MS = 24000;
function timeoutError(){return Object.assign(Error('AI request timed out'),{name:'TimeoutError'});}
async function bounded(operation, timeoutMs){
 if(timeoutMs<=0)throw timeoutError();
 const controller=new AbortController();let timer;
 try {
  return await Promise.race([
   Promise.resolve().then(()=>operation({signal:controller.signal,timeoutMs})),
   new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(timeoutError());},timeoutMs);})
  ]);
 }finally{clearTimeout(timer);}
}
function createRouter({loadSettings,invoke,now=Date.now}){
 async function run(id,params){
  const model=modelFor(id),start=now();const result=await bounded(options=>invoke(model,{...params,...options}),params.timeoutMs);
  if(typeof result.text!=='string'||!result.text.trim())throw Error('The model returned no text. Try a different prompt or model.');
  const usage=result.usage||{};
  const estimatedCostUsd=Number.isFinite(usage.inputTokens)&&Number.isFinite(usage.outputTokens)?Number(((usage.inputTokens*model.inputPrice+usage.outputTokens*model.outputPrice)/1e6).toFixed(10)):null;
  return {text:result.text.trim(),model:id,actualModel:id,requestedModel:id,provider:model.provider,modelId:model.modelId,requestedModelId:model.modelId,actualModelId:model.modelId,stopReason:result.stopReason||null,truncated:['max_tokens','MAX_TOKENS'].includes(result.stopReason),usage,latencyMs:now()-start,estimatedCostUsd,pricingDate:PRICING_DATE,fallbackUsed:false};
 }
 async function generate(params){
  if(typeof params.user!=='string'||!params.user.trim()||params.user.length>60000)throw Error('A prompt of 1–60,000 characters is required');
  const start=now();
  const deadline=Math.min(start+TOTAL_BUDGET_MS,params.deadlineMs||Infinity);
  const remaining=()=>Math.max(0,deadline-now());
  const settings=validateSettings(await bounded(loadSettings,Math.min(2000,remaining())));
  const selected=settings.overrides[params.task||'writing']||settings.defaultModel;
  const hasFallback=settings.fallbackModel&&settings.fallbackModel!==selected;
  const primaryTimeout=hasFallback?Math.floor(remaining()/2):remaining();
  try{return await run(selected,{...params,timeoutMs:primaryTimeout});}catch(error){
   if(!settings.fallbackModel||settings.fallbackModel===selected||!isTransient(error))throw error;
   const result=await run(settings.fallbackModel,{...params,timeoutMs:remaining()});
   return {...result,requestedModel:selected,requestedModelId:modelFor(selected).modelId,fallbackUsed:true,latencyMs:now()-start,fallbackReason:'The selected model was unavailable.'};
  }
 }
 async function compare({modelIds,prompt,task='writing'}){
  if(!Array.isArray(modelIds)||modelIds.length<1||modelIds.length>2||new Set(modelIds).size!==modelIds.length)throw Error('Select one or two different models');
  modelIds.forEach(modelFor);
  if(typeof prompt!=='string'||!prompt.trim()||prompt.length>12000)throw Error('Test prompt must contain 1–12,000 characters');
  if(!['writing','board'].includes(task))throw Error('Unsupported AI task');
  const deadline=now()+TOTAL_BUDGET_MS;
  const results=await Promise.all(modelIds.map(async id=>{try{return await run(id,{user:prompt,system:task==='writing'?'You are a concise writing partner. Preserve facts and the author’s voice. Do not invent details.':'You are a thoughtful career advisor. Give practical, concise suggestions grounded in the supplied information.',max_tokens:800,temperature:0.3,timeoutMs:Math.max(0,deadline-now())});}catch(error){return {requestedModel:id,actualModel:null,fallbackUsed:false,error:'Model test failed. Check provider access, credentials, quota, and model availability.'};}}));
  return {results};
 }
 return {generate,compare};
}
module.exports={MODELS,DEFAULT_SETTINGS,validateSettings,taskFor,createRouter};
