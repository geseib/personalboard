#!/usr/bin/env node
// Installs a prompt definition from prompts/*.json into an environment's prompt table, then
// (with --activate) makes it the active prompt for its category, the same way the admin page does.
// The previous active prompt stays in the table, so you can switch back from admin → Prompts.
//
// Usage:
//   AWS_PROFILE=adminaccess node scripts/install-prompt.cjs prompts/goals-grounded-v1.json --stack personal-board-boarddev --activate
// Options: --stack <name> (default personal-board-boarddev), --activate, --replace (overwrite an existing record with the same id)
const {execFileSync} = require('node:child_process');
const fs = require('node:fs');

const [file, ...rest] = process.argv.slice(2);
const flag = name => rest.includes(`--${name}`);
const option = (name, fallback) => { const i = rest.indexOf(`--${name}`); return i >= 0 && rest[i + 1] ? rest[i + 1] : fallback; };
if (!file) { console.error('Usage: node scripts/install-prompt.cjs <prompts/file.json> [--stack <stack>] [--activate] [--replace]'); process.exit(2); }

const prompt = JSON.parse(fs.readFileSync(file, 'utf8'));
for (const key of ['promptId', 'name', 'category', 'systemPrompt', 'userPromptTemplate']) {
  if (typeof prompt[key] !== 'string' || !prompt[key].trim()) { console.error(`${file}: missing ${key}`); process.exit(2); }
}
const stack = option('stack', 'personal-board-boarddev');
const aws = args => execFileSync('aws', [...args, '--output', 'json'], {encoding: 'utf8'});

const table = JSON.parse(aws(['cloudformation', 'describe-stack-resource', '--stack-name', stack, '--logical-resource-id', 'PromptManagementTable']))
  .StackResourceDetail.PhysicalResourceId;
const now = new Date().toISOString();
const item = {
  PK: {S: `PROMPT#${prompt.promptId}`}, SK: {S: 'PROMPT'}, promptId: {S: prompt.promptId}, name: {S: prompt.name},
  category: {S: prompt.category}, status: {S: 'inactive'}, isCustom: {BOOL: true}, tokenCount: {N: String(prompt.tokenCount || 1500)},
  systemPrompt: {S: prompt.systemPrompt}, userPromptTemplate: {S: prompt.userPromptTemplate},
  variables: {L: (prompt.variables || []).map(v => ({S: v}))}, createdAt: {S: now}
};
aws(['dynamodb', 'put-item', '--table-name', table, '--item', JSON.stringify(item),
  ...(flag('replace') ? [] : ['--condition-expression', 'attribute_not_exists(PK)'])]);
console.log(`Installed ${prompt.promptId} in ${table}`);

if (flag('activate')) {
  const current = JSON.parse(aws(['dynamodb', 'get-item', '--table-name', table, '--key',
    JSON.stringify({PK: {S: `ADVISOR#${prompt.category}`}, SK: {S: 'PROMPT'}})])).Item?.activePromptId?.S || 'none';
  aws(['dynamodb', 'put-item', '--table-name', table, '--item', JSON.stringify({
    PK: {S: `ADVISOR#${prompt.category}`}, SK: {S: 'PROMPT'}, activePromptId: {S: prompt.promptId}, updatedAt: {S: now}
  })]);
  console.log(`Activated for "${prompt.category}" (previously: ${current}). Switch back any time in admin → Prompts.`);
}
