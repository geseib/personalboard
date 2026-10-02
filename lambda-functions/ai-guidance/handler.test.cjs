const {test}=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');
const load=Module._load;let calls=[],internalCalls=0;
Module._load=function(id,...args){
 if(id==='./bedrock-chat')return {bedrockChat:async p=>{calls.push(p);return {text:'Revised text',actualModel:'nova-lite',requestedModel:'nova-lite',truncated:false};},internalAction:async()=>{internalCalls++;return {models:[]};}};
 if(id==='@aws-sdk/client-dynamodb')return {DynamoDBClient:class{}};
 if(id==='@aws-sdk/lib-dynamodb')return {GetCommand:class{},DynamoDBDocumentClient:{from:()=>({send:async()=>({})})}};
 return load.call(this,id,...args);
};
const {handler}=require('./ai-guidance');Module._load=load;
const request=(body)=>({httpMethod:'POST',requestContext:{authorizer:{principalId:'user'}},body:JSON.stringify(body)});
test('writing refinement ignores client model overrides and uses writing route',async()=>{
 const result=await handler(request({type:'writing_refine',model:'claude-sonnet',data:{text:'My goal',instruction:'Shorter',field:'goal'}}));
 assert.equal(result.statusCode,200);assert.equal(JSON.parse(result.body).guidance,'Revised text');assert.equal(calls.at(-1).task,'writing');assert.equal(calls.at(-1).model,undefined);
});
test('API callers cannot enter internal comparison or registry operations',async()=>{
 const before=internalCalls;
 await handler({...request({internalAction:'modelRegistry'}),internalAction:'modelRegistry'});
 assert.equal(internalCalls,before);
 await handler({internalAction:'modelRegistry'});assert.equal(internalCalls,before+1);
});
test('invalid writing input rejected before any provider call',async()=>{
 const count=calls.length;
 const result=await handler(request({type:'writing_refine',data:{text:'',instruction:'   '}}));
 assert.equal(result.statusCode,400);assert.equal(calls.length,count);
});

test('empty fields can draft from nonblank instructions without inventing facts',async()=>{
 const result=await handler(request({type:'writing_refine',data:{text:'',instruction:'Draft a goal about improving presentations'}}));
 assert.equal(result.statusCode,200);assert.match(calls.at(-1).system,/bracketed placeholders/);
});

test('advisor focus reaches the provider and goal advice uses the goals prompt',async()=>{
 const result=await handler(request({type:'goals_advisor',data:{currentFormData:{description:'Learn leadership'},allGoals:[],boardData:{},advisorQuestion:'Help me choose one practical next step'},context:{}}));
 assert.equal(result.statusCode,200);
 assert.match(calls.at(-1).user,/Help me choose one practical next step/);
 assert.match(calls.at(-1).system,/goal/i);
});
test('oversized advisor questions are rejected before inference',async()=>{
 const before=calls.length;
 const result=await handler(request({type:'goals_advisor',data:{advisorQuestion:'x'.repeat(1501)},context:{}}));
 assert.equal(result.statusCode,400);assert.equal(calls.length,before);
});
