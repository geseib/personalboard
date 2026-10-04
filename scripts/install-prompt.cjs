#!/usr/bin/env node
// Installs prompt definitions from prompts/*.json into an environment's prompt table and (with --activate)
// makes each the active prompt for its category, the same way the admin page does. Previous prompts stay in
// the table, so you can switch back from admin → Prompts.
//
// Usage (all grounded prompts):  npm run prompts:install -- --stack personal-board-boarddev [--dry-run]
// Usage (one file):              node scripts/install-prompt.cjs prompts/goals-grounded-v1.json --stack <stack> --activate
// Options: --stack <name> (default personal-board-boarddev), --activate, --dry-run (show changes, write nothing),
//          --replace (overwrite an existing record with the same id). Already-installed prompts are skipped.
const {execFileSync} = require('node:child_process');
const fs = require('node:fs');

const args = process.argv.slice(2);
const flag = name => args.includes(`--${name}`);
const option = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] ? args[i + 1] : fallback; };
const files = args.filter((arg, i) => arg.endsWith('.json') && args[i - 1] !== '--stack');
if (!files.length) { console.error('Usage: node scripts/install-prompt.cjs <prompts/file.json ...> [--stack <stack>] [--activate] [--dry-run] [--replace]'); process.exit(2); }
const stack = option('stack', 'personal-board-boarddev');
const dryRun = flag('dry-run');
const aws = cliArgs => {
  try { return execFileSync('aws', [...cliArgs, '--output', 'json'], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}); }
  catch (error) {
    const message = String(error.stderr || error.message).trim();
    console.error(/token|expired|credentials|sso/i.test(message) ? `AWS sign-in needed: run "aws sso login" (with AWS_PROFILE=adminaccess), then try again.\n${message}` : message);
    process.exit(1);
  }
};

const table = JSON.parse(aws(['cloudformation', 'describe-stack-resource', '--stack-name', stack, '--logical-resource-id', 'PromptManagementTable']))
  .StackResourceDetail.PhysicalResourceId;
console.log(`${dryRun ? 'DRY RUN - nothing will be written. ' : ''}Stack ${stack} → table ${table}\n`);
const now = new Date().toISOString();
const getItem = (pk) => JSON.parse(aws(['dynamodb', 'get-item', '--table-name', table, '--key', JSON.stringify({PK: {S: pk}, SK: {S: 'PROMPT'}})])).Item;

for (const file of files) {
const prompt = JSON.parse(fs.readFileSync(file, 'utf8'));
for (const key of ['promptId', 'name', 'category', 'systemPrompt', 'userPromptTemplate']) {
  if (typeof prompt[key] !== 'string' || !prompt[key].trim()) { console.error(`${file}: missing ${key}`); process.exit(2); }
}
const item = {
  PK: {S: `PROMPT#${prompt.promptId}`}, SK: {S: 'PROMPT'}, promptId: {S: prompt.promptId}, name: {S: prompt.name},
  category: {S: prompt.category}, status: {S: 'inactive'}, isCustom: {BOOL: true}, tokenCount: {N: String(prompt.tokenCount || 1500)},
  systemPrompt: {S: prompt.systemPrompt}, userPromptTemplate: {S: prompt.userPromptTemplate},
  variables: {L: (prompt.variables || []).map(v => ({S: v}))}, createdAt: {S: now}
};
const exists = Boolean(getItem(`PROMPT#${prompt.promptId}`));
const current = getItem(`ADVISOR#${prompt.category}`)?.activePromptId?.S || 'none';
const install = !exists || flag('replace');
const activate = flag('activate') && current !== prompt.promptId;
console.log(`${prompt.category.padEnd(14)} ${install ? (exists ? 'replace' : 'install') : 'already installed'} ${prompt.promptId}` +
  (activate ? `, activate (currently: ${current})` : flag('activate') ? ', already active' : ''));
if (dryRun) continue;
if (install) aws(['dynamodb', 'put-item', '--table-name', table, '--item', JSON.stringify(item)]);
if (activate) aws(['dynamodb', 'put-item', '--table-name', table, '--item', JSON.stringify({
  PK: {S: `ADVISOR#${prompt.category}`}, SK: {S: 'PROMPT'}, activePromptId: {S: prompt.promptId}, updatedAt: {S: now}
})]);
}
console.log(dryRun ? '\nNothing changed. Run again without --dry-run to apply.' : '\nDone. To switch any category back, use admin → Prompts.');
