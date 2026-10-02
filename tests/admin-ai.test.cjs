const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createAiAdmin}=require('../lambda-functions/admin-data/ai-settings.js');
function setup(){ let current=null; const history=new Map(); const calls=[]; const service=createAiAdmin({get:async()=>current,history:async()=>[...history.values()],revision:async n=>history.get(n),save:async(next,previous,expected)=>{assert.equal(current?.revision||0,expected);history.set(previous.revision,previous);history.set(next.revision,next);current=next;},invoke:async payload=>{calls.push(payload);if(payload.internalAction==='modelRegistry')return {models:[{id:'nova-micro'}],defaults:{defaultModel:'nova-micro',overrides:{},fallbackModel:null}};if(payload.internalAction==='validateSettings')return payload.settings.defaultModel==='bad'?{error:'Invalid model'}:{settings:payload.settings};return {results:[]};}});return {service,calls};}
test('loads registry and persisted revision, activation and rollback create immutable revisions',async()=>{const {service}=setup();assert.equal((await service.settings()).settings.revision,0);const next=await service.activate({defaultModel:'nova-micro',overrides:{writing:'nova-micro'},expectedRevision:0});assert.equal(next.revision,1);await assert.rejects(service.activate({defaultModel:'nova-micro',expectedRevision:0}),/changed/);const restored=await service.rollback({revision:0,expectedRevision:1});assert.equal(restored.revision,2);assert.deepEqual(restored.overrides,{});});
test('invalid settings do not activate and comparison cannot inject privileged payload',async()=>{const {service,calls}=setup();await assert.rejects(service.activate({defaultModel:'bad',expectedRevision:0}),/Invalid model/);await service.compare({modelIds:['nova-micro'],prompt:'Help me write',task:'writing',internalAction:'validateSettings',settings:{}});assert.deepEqual(calls.at(-1),{internalAction:'compareModels',modelIds:['nova-micro'],prompt:'Help me write',task:'writing'});assert.equal((await service.settings()).settings.revision,0);});
test('comparison rejects duplicate models, unsupported tasks and oversized prompts',async()=>{const {service}=setup();for(const input of [{modelIds:['a','a'],prompt:'x',task:'writing'},{modelIds:['a'],prompt:'x',task:'unknown'},{modelIds:['a'],prompt:'x'.repeat(12001),task:'writing'}])await assert.rejects(service.compare(input),/Choose/);});
test('admin routes require configured password and never log credentials',async()=>{
 const vm=require('node:vm');const fs=require('node:fs'); const source=fs.readFileSync(require.resolve('../lambda-functions/admin-data/admin-data.js'),'utf8');
 const logs=[];const apiCalls=[];
 const command=class{constructor(input){this.input=input;}};
 const dynamo={send:async()=>({})};
 function load(password){const module={exports:{}};const context={exports:module.exports,process:{env:{ADMIN_PASSWORD:password}},Buffer,console:{log:(...args)=>logs.push(args),error:()=>{}},require:name=>{if(name==='@aws-sdk/client-dynamodb')return {DynamoDBClient:class{}};if(name==='@aws-sdk/lib-dynamodb')return {DynamoDBDocumentClient:{from:()=>dynamo},GetCommand:command};if(name==='@aws-sdk/client-lambda')return {LambdaClient:class{async send(request){apiCalls.push(request.input);return {Payload:Buffer.from(JSON.stringify({models:[],defaults:{defaultModel:'nova-micro'}}))};}},InvokeCommand:command};return require(name==='./ai-settings'?'../lambda-functions/admin-data/ai-settings.js':name);}};vm.runInNewContext(source,context);return module.exports.handler;}
 const event={httpMethod:'GET',path:'/admin/ai/settings',headers:{'X-Admin-Password':'secret'}};
 assert.equal((await load()(event)).statusCode,401);
 assert.equal((await load('secret')({...event,headers:{}})).statusCode,401);
 assert.equal((await load('secret')(event)).statusCode,200);
 assert.equal(apiCalls.length,1);
 assert.equal(JSON.stringify(logs).includes('secret'),false);
});
