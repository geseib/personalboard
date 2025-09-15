// bedrock-chat.js
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

const bedrock = new BedrockRuntimeClient({ region: 'us-east-1' });

/**
 * Call Bedrock Claude with system + user messages and get a text reply.
 * Includes fallback from Sonnet to Haiku for cost optimization.
 *
 * @param {Object} params
 * @param {string} [params.system] - Optional system instruction
 * @param {string} params.user     - Required user prompt
 * @param {number} [params.max_tokens=2000]
 * @param {number} [params.temperature=0.7]
 * @returns {Promise<{model:string,text:string,raw:any,error?:string}>}
 */
async function bedrockChat({ system, user, max_tokens = 2000, temperature = 0.7 }) {
  if (!user) throw new Error('`user` prompt is required');

  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens,
    temperature,
    ...(system ? { system } : {}),
    messages: [
      {
        role: 'user',
        content: [{ type: 'text', text: user }]
      }
    ]
  };

  try {
    // Try Sonnet first
    const res = await bedrock.send(new InvokeModelCommand({
      modelId: 'arn:aws:bedrock:us-east-1:239601476690:inference-profile/us.anthropic.claude-3-5-sonnet-20241022-v2:0',
      body: JSON.stringify(payload)
    }));
    const body = JSON.parse(new TextDecoder().decode(res.body));
    const text = body?.content?.[0]?.text?.trim() ?? '';
    return { model: 'claude-3.5-sonnet', text, raw: body };
  } catch (err) {
    console.warn('Sonnet failed, falling back to Haiku:', err.message);
    
    // Fallback to Haiku
    try {
      const res2 = await bedrock.send(new InvokeModelCommand({
        modelId: 'arn:aws:bedrock:us-east-1:239601476690:inference-profile/us.anthropic.claude-3-5-haiku-20241022-v1:0',
        body: JSON.stringify(payload)
      }));
      const body2 = JSON.parse(new TextDecoder().decode(res2.body));
      const text2 = body2?.content?.[0]?.text?.trim() ?? '';
      return { model: 'claude-3.5-haiku', text: text2, raw: body2, error: err?.message };
    } catch (err2) {
      console.error('Both models failed:', err2.message);
      throw new Error(`Both Sonnet and Haiku failed: ${err.message} | ${err2.message}`);
    }
  }
}

module.exports = { bedrockChat };