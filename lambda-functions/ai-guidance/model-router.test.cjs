const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createRouter,validateSettings,publicGeneration,DEFAULT_SETTINGS}=require('./model-router');
test('rejects unknown models and task overrides',()=>{
 assert.throws(()=>validateSettings({defaultModel:'arbitrary-url'}));
 assert.throws(()=>validateSettings({...DEFAULT_SETTINGS,overrides:{other:'nova-lite'}}));
});
test('honors fresh task settings and reports actual model and cost',async()=>{
 let selected='nova-lite';
 const router=createRouter({loadSettings:async()=>({...DEFAULT_SETTINGS,overrides:{writing:selected}}),invoke:async(model)=>({text:model.id,usage:{inputTokens:1000,outputTokens:100}})});
 assert.equal((await router.generate({user:'Rewrite',task:'writing'})).actualModel,'nova-lite');
 selected='nova-micro';
 const result=await router.generate({user:'Rewrite',task:'writing'});
 assert.equal(result.actualModel,'nova-micro'); assert.equal(result.estimatedCostUsd,0.000049);
});
test('fallback is explicit; comparison never uses it',async()=>{
 const calls=[]; const router=createRouter({loadSettings:async()=>({...DEFAULT_SETTINGS,fallbackModel:'nova-lite'}),invoke:async(model)=>{calls.push(model.id); if(model.id==='nova-micro')throw Object.assign(Error('Unavailable'),{name:'ThrottlingException'}); return {text:'ok',usage:{}};}});
 const result=await router.generate({user:'hello'}); assert.equal(result.fallbackUsed,true); assert.equal(result.requestedModel,'nova-micro');
 calls.length=0; const compared=await router.compare({modelIds:['nova-micro','nova-lite'],prompt:'hello'});
 assert.ok(compared.results[0].error);assert.deepEqual(calls,['nova-micro','nova-lite']);
});
test('empty provider responses fail, and comparison validates bounds',async()=>{
 const router=createRouter({loadSettings:async()=>DEFAULT_SETTINGS,invoke:async()=>({text:'',usage:{}})});
 await assert.rejects(router.generate({user:'hello'}));
 await assert.rejects(router.compare({modelIds:['nova-micro'],prompt:''}));
});

test('authorization failures never silently switch providers',async()=>{
 const calls=[];const router=createRouter({loadSettings:async()=>({...DEFAULT_SETTINGS,fallbackModel:'nova-lite'}),invoke:async model=>{calls.push(model.id);throw Object.assign(Error('Denied'),{name:'AccessDeniedException'});}});
 await assert.rejects(router.generate({user:'Hello'}));assert.deepEqual(calls,['nova-micro']);
});
test('truncated responses and exact provider model IDs are reported',async()=>{
 const router=createRouter({loadSettings:async()=>DEFAULT_SETTINGS,invoke:async()=>({text:'Partial',stopReason:'max_tokens'})});
 const result=await router.generate({user:'Hello'});assert.equal(result.truncated,true);assert.equal(result.actualModelId,'us.amazon.nova-micro-v1:0');
});
test('shared deadline includes settings and reserves remaining time for fallback',async()=>{
 let clock=0;const budgets=[];
 const router=createRouter({now:()=>clock,loadSettings:async({timeoutMs})=>{assert.equal(timeoutMs,2000);clock+=1500;return {...DEFAULT_SETTINGS,fallbackModel:'nova-lite'};},invoke:async(model,{timeoutMs})=>{budgets.push(timeoutMs);clock+=timeoutMs;if(model.id==='nova-micro')throw Object.assign(Error('Timeout'),{name:'TimeoutError'});return {text:'Done'};}});
 const result=await router.generate({user:'Hello'});
 assert.deepEqual(budgets,[11250,11250]);assert.equal(clock,24000);assert.equal(result.latencyMs,24000);
});
test('real deadline timer aborts stalled primary and fallback within 24 seconds',async(t)=>{
 t.mock.timers.enable({apis:['Date','setTimeout'],now:0});
 const signals=[];
 const router=createRouter({loadSettings:async()=>({...DEFAULT_SETTINGS,fallbackModel:'nova-lite'}),invoke:async(model,{signal})=>{signals.push(signal);return new Promise(()=>{});}});
 const promise=router.generate({user:'Hello'});
 const rejected=assert.rejects(promise,{name:'TimeoutError'});
 const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
 await flush();assert.equal(signals.length,1);
 t.mock.timers.tick(12000);await flush();assert.equal(signals[0].aborted,true);assert.equal(signals.length,2);
 t.mock.timers.tick(12000);await flush();assert.equal(signals[1].aborted,true);await rejected;
});
test('settings timeout fails closed before any inference',async(t)=>{
 t.mock.timers.enable({apis:['Date','setTimeout'],now:0});let called=false,signal;
 const router=createRouter({loadSettings:async(options)=>{signal=options.signal;return new Promise(()=>{});},invoke:async()=>{called=true;}});
 const rejected=assert.rejects(router.generate({user:'Hello'}),{name:'TimeoutError'});
 await Promise.resolve();t.mock.timers.tick(2000);await rejected;assert.equal(signal.aborted,true);assert.equal(called,false);
});

test('model identity and cost are hidden from site users unless the admin enables it',async()=>{
 assert.throws(()=>validateSettings({...DEFAULT_SETTINGS,showModelToUsers:'yes'}));
 for(const show of [false,true]){
  const router=createRouter({loadSettings:async()=>({...DEFAULT_SETTINGS,showModelToUsers:show}),invoke:async()=>({text:'ok',usage:{inputTokens:10,outputTokens:5}})});
  const visible=publicGeneration(await router.generate({user:'hello'}));
  assert.equal('actualModel' in visible,show);assert.equal('estimatedCostUsd' in visible,show);assert.equal(visible.truncated,false);
 }
 assert.equal(validateSettings({defaultModel:'nova-micro'}).showModelToUsers,false);
});
