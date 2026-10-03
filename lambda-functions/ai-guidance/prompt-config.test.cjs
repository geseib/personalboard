const {test}=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');
const load=Module._load;let calls=[],records={};
class GetCommand {constructor(input){this.input=input;}}
Module._load=function(id,...args){
 if(id==='./bedrock-chat')return {bedrockChat:async p=>{calls.push(p);return {text:'Advice',actualModel:'nova-micro'};},internalAction:async()=>({})};
 if(id==='@aws-sdk/client-dynamodb')return {DynamoDBClient:class{}};
 if(id==='@aws-sdk/lib-dynamodb')return {GetCommand,DynamoDBDocumentClient:{from:()=>({send:async c=>({Item:records[`${c.input.Key.PK}|${c.input.Key.SK}`]})})}};
 return load.call(this,id,...args);
};
const {handler}=require('./ai-guidance');Module._load=load;
const request=body=>({httpMethod:'POST',requestContext:{authorizer:{principalId:'user'}},body:JSON.stringify(body)});
// Stored exactly as admin-data writes them: SK 'PROMPT' for both the pointer and the prompt.
function activate(category,promptId,systemPrompt,userPromptTemplate){
 records[`ADVISOR#${category}|PROMPT`]={activePromptId:promptId};
 records[`PROMPT#${promptId}|PROMPT`]={promptId,systemPrompt,userPromptTemplate};
}
test('admin-managed prompts stored under SK PROMPT are used',async()=>{
 activate('goals','goals_v2','STORED GOALS SYSTEM','Goals: {goals}\nEditing: {currentFields}');
 const result=await handler(request({type:'goals_advisor',data:{currentFormData:{description:'Lead projects'},allGoals:[{description:'Become a manager'}]},context:{}}));
 const body=JSON.parse(result.body);
 assert.equal(body.source,'dynamodb');assert.equal(body.promptId,'goals_v2');
 assert.equal(calls.at(-1).system,'STORED GOALS SYSTEM');
 assert.match(calls.at(-1).user,/Become a manager/);assert.match(calls.at(-1).user,/Lead projects/);
});
test('board-member placeholders are filled from the form and unknown ones never reach the model',async()=>{
 activate('mentors','mentors_v2','SYS','{memberName} ({memberRole}) via {relationship}; value {value}; last {lastContact}; {unknownField}; full: {fullBoardData}');
 await handler(request({type:'board_member_advisor',data:{memberType:'mentors',currentFormData:{name:'Dana',role:'Former director',connection:'Former manager',whatTheyGet:'Fresh perspective',notes:'Uses {braces} in notes'},goals:[]},context:{}}));
 const user=calls.at(-1).user;
 assert.match(user,/Dana \(Former director\) via Former manager; value Fresh perspective; last Not provided; Not provided;/);
 assert.doesNotMatch(user,/\{(memberName|relationship|value|lastContact|unknownField|fullBoardData)\}/);
});
test('missing or incomplete stored prompts fall back to built-in prompts',async()=>{
 records={};records['ADVISOR#goals|PROMPT']={activePromptId:'gone'};
 const body=JSON.parse((await handler(request({type:'goals_advisor',data:{allGoals:[]},context:{}}))).body);
 assert.equal(body.source,'fallback');
 records['PROMPT#gone|PROMPT']={promptId:'gone',systemPrompt:'only system'};
 assert.equal(JSON.parse((await handler(request({type:'goals_advisor',data:{allGoals:[]},context:{}}))).body).source,'fallback');
});
test('empty board roles are named so advice can point out gaps',async()=>{
 activate('goals','goals_v3','SYS','{completeProfile}');
 await handler(request({type:'goals_advisor',data:{allGoals:[],boardData:{goals:[],mentors:[{name:'Dana'}],sponsors:[],coaches:[]}},context:{}}));
 assert.match(calls.at(-1).user,/Current mentors:\n- Dana/);assert.match(calls.at(-1).user,/Current sponsors: none yet/);assert.match(calls.at(-1).user,/Current coaches: none yet/);
});
