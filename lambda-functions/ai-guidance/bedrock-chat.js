const {BedrockRuntimeClient,ConverseCommand}=require('@aws-sdk/client-bedrock-runtime');
const {DynamoDBClient}=require('@aws-sdk/client-dynamodb');
const {DynamoDBDocumentClient,GetCommand}=require('@aws-sdk/lib-dynamodb');
const {SSMClient,GetParameterCommand}=require('@aws-sdk/client-ssm');
const {MODELS,DEFAULT_SETTINGS,validateSettings,createRouter}=require('./model-router');
const region=process.env.AWS_REGION||'us-east-1';
const bedrock=new BedrockRuntimeClient({region,maxAttempts:1});
const db=DynamoDBDocumentClient.from(new DynamoDBClient({region,maxAttempts:1}));
const ssm=new SSMClient({region,maxAttempts:1});
async function loadSettings({signal}){
 const TableName=process.env.PROMPT_MANAGEMENT_TABLE||process.env.DYNAMODB_TABLE;
 if(!TableName)throw Error('AI settings table is not configured');
 const {Item}=await db.send(new GetCommand({TableName,Key:{PK:'CONFIG#AI',SK:'SETTINGS'},ConsistentRead:true}),{abortSignal:signal});
 return Item||DEFAULT_SETTINGS;
}
async function invoke(model,{system,user,max_tokens=1200,temperature=0.3,signal}){
 const maxTokens=Math.min(2500,Math.max(64,max_tokens));
 if(model.provider==='bedrock'){
  const {omitTemperature,extraOutputTokens=0,fields}=model.request||{};
  const result=await bedrock.send(new ConverseCommand({modelId:model.modelId,...(system?{system:[{text:system}]}:{}),messages:[{role:'user',content:[{text:user}]}],inferenceConfig:{maxTokens:maxTokens+extraOutputTokens,...(omitTemperature?{}:{temperature})},...(fields?{additionalModelRequestFields:fields}:{})}),{abortSignal:signal});
  // Reasoning models return reasoningContent blocks; only visible text blocks are kept.
  return {stopReason:result.stopReason,text:(result.output?.message?.content||[]).filter(c=>typeof c.text==='string').map(c=>c.text).join('\n'),usage:{inputTokens:result.usage?.inputTokens,outputTokens:result.usage?.outputTokens}};
 }
 const parameter=process.env.GEMINI_API_KEY_PARAMETER;
 if(!parameter)throw Error('Gemini API key parameter is not configured');
 const secret=await ssm.send(new GetParameterCommand({Name:parameter,WithDecryption:true}),{abortSignal:signal});
 if(!secret.Parameter?.Value)throw Error('Gemini API key is unavailable');
 const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model.modelId}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':secret.Parameter.Value},signal,body:JSON.stringify({...(system?{systemInstruction:{parts:[{text:system}]}}:{}),contents:[{role:'user',parts:[{text:user}]}],generationConfig:{maxOutputTokens:maxTokens,temperature,thinkingConfig:{thinkingBudget:0}}})});
 if(!response.ok)throw Object.assign(Error(`Gemini request failed (${response.status})`),{status:response.status});
 const result=await response.json();
 return {stopReason:result.candidates?.[0]?.finishReason,text:(result.candidates?.[0]?.content?.parts||[]).filter(p=>!p.thought).map(p=>p.text||'').join('\n'),usage:{inputTokens:result.usageMetadata?.promptTokenCount,outputTokens:result.usageMetadata?.candidatesTokenCount}};
}
const router=createRouter({loadSettings,invoke});
async function internalAction(event){
 switch(event.internalAction){
  case 'modelRegistry':return {models:MODELS.map(({request,...m})=>({...m,configured:m.provider!=='gemini'||Boolean(process.env.GEMINI_API_KEY_PARAMETER)})),defaults:DEFAULT_SETTINGS};
  case 'validateSettings': {
   const settings=validateSettings(event.settings);
   if([settings.defaultModel,settings.fallbackModel,...Object.values(settings.overrides)].includes('gemini-flash-lite')&&!process.env.GEMINI_API_KEY_PARAMETER)throw Error('Configure the server Gemini API key parameter before activating Gemini.');
   return {settings};
  }
  case 'compareModels':return router.compare(event);
  default:throw Error('Unsupported internal AI action');
 }
}
module.exports={bedrockChat:router.generate,internalAction};
