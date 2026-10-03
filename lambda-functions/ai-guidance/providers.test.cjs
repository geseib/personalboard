const {test}=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');
const originalLoad=Module._load;
let settings,converse,converseContent=[{text:'One'},{text:'Two'}],secretCalls=0,secretSignal;
class Command {constructor(input){this.input=input;}}
Module._load=function(id,...args){
 if(id==='@aws-sdk/client-bedrock-runtime')return {ConverseCommand:Command,BedrockRuntimeClient:class {async send(c){converse=c.input;return {output:{message:{content:converseContent}},usage:{inputTokens:10,outputTokens:5}};}}};
 if(id==='@aws-sdk/client-dynamodb')return {DynamoDBClient:class{}};
 if(id==='@aws-sdk/lib-dynamodb')return {GetCommand:Command,DynamoDBDocumentClient:{from:()=>({send:async()=>({Item:settings})})}};
 if(id==='@aws-sdk/client-ssm')return {GetParameterCommand:Command,SSMClient:class{async send(command,options){secretSignal=options.abortSignal;secretCalls++;return {Parameter:{Value:'test-key'}};}}};
 return originalLoad.call(this,id,...args);
};
process.env.PROMPT_MANAGEMENT_TABLE='test';
const {bedrockChat,internalAction}=require('./bedrock-chat');
Module._load=originalLoad;
test('Converse adapter normalizes blocks and honors configured task',async()=>{
 settings={defaultModel:'nova-micro',overrides:{board:'claude-sonnet'}};
 const result=await bedrockChat({user:'Prompt',system:'System',task:'board'});
 assert.equal(converse.modelId,'us.anthropic.claude-sonnet-4-6');
 assert.deepEqual(converse.system,[{text:'System'}]);
 assert.equal(result.text,'One\nTwo');assert.equal(result.usage.inputTokens,10);
});
test('Gemini key stays in server header; text and token usage normalized',async()=>{
 settings={defaultModel:'gemini-flash-lite'};process.env.GEMINI_API_KEY_PARAMETER='/test/gemini';
 const originalFetch=global.fetch;
 global.fetch=async(url,options)=>{
  assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent');
  assert.equal(options.headers['x-goog-api-key'],'test-key');assert.equal(options.signal,secretSignal);assert.equal(options.signal.aborted,false);assert.equal(JSON.parse(options.body).generationConfig.thinkingConfig.thinkingBudget,0);
  return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:'Hidden',thought:true},{text:'Edited'}]}}],usageMetadata:{promptTokenCount:15,candidatesTokenCount:4}})};
 };
 try{const result=await bedrockChat({user:'Prompt'});assert.equal(result.text,'Edited');assert.equal(result.usage.inputTokens,15);assert.equal(secretCalls,1);assert.ok(!JSON.stringify(result).includes('test-key'));}finally{global.fetch=originalFetch;}
});
test('registry returns only public metadata and rejects unsupported internal actions',async()=>{
 const result=await internalAction({internalAction:'modelRegistry'});assert.equal(result.models.length,9);assert.ok(result.models.every(m=>!('request' in m)));assert.ok(!JSON.stringify(result).includes('test-key'));
 await assert.rejects(internalAction({internalAction:'unknown'}));
});

test('Kimi K2.5 gets extra output room and reasoning blocks are never returned',async()=>{
 settings={defaultModel:'kimi-k2.5'};converseContent=[{reasoningContent:{reasoningText:{text:'private'}}},{text:'Visible'}];
 try{
  const result=await bedrockChat({user:'Prompt',max_tokens:1200});
  assert.equal(converse.modelId,'moonshotai.kimi-k2.5');
  assert.equal(converse.inferenceConfig.temperature,0.3);
  assert.equal(converse.inferenceConfig.maxTokens,2200);
  assert.equal(converse.additionalModelRequestFields,undefined);
  assert.equal(result.text,'Visible');
 }finally{converseContent=[{text:'One'},{text:'Two'}];}
});
test('budget open-weight models use in-region Bedrock IDs with standard sampling',async()=>{
 settings={defaultModel:'qwen3-next-80b'};await bedrockChat({user:'Prompt'});
 assert.equal(converse.modelId,'qwen.qwen3-next-80b-a3b');assert.equal(converse.inferenceConfig.temperature,0.3);assert.equal(converse.additionalModelRequestFields,undefined);
 settings={defaultModel:'gpt-oss-120b'};await bedrockChat({user:'Prompt'});
 assert.equal(converse.modelId,'openai.gpt-oss-120b-1:0');assert.deepEqual(converse.additionalModelRequestFields,{reasoning_effort:'low'});
});
