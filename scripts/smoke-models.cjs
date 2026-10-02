#!/usr/bin/env node
// Post-deploy check: sends one short fictional prompt to each registered model through the
// admin comparison endpoint. Comparisons never change active settings and never fall back,
// so a pass means that exact model is reachable with this environment's IAM and quotas.
//
// Usage:
//   ADMIN_PASSWORD=... node scripts/smoke-models.cjs --host board.dev.seibtribe.us
//   ADMIN_PASSWORD=... node scripts/smoke-models.cjs --api https://.../dev --models nova-micro,qwen3-next-80b
// Exits 1 when any tested model fails. Each run costs a fraction of a cent per model.
require('../runtime-config.js');

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, arg, i, all) => {
  if (arg.startsWith('--')) pairs.push([arg.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : 'true']);
  return pairs;
}, []));
const password = process.env.ADMIN_PASSWORD;
const api = args.api ? globalThis.PersonalBoardConfig.validateApiBaseUrl(args.api)
  : globalThis.PersonalBoardConfig.resolveApiBaseUrl(args.host || 'board.dev.seibtribe.us');
const prompt = args.prompt || 'Make this career goal clearer while keeping my voice: I want to get better at leading projects and speaking up with senior leaders.';
const task = args.task === 'board' ? 'board' : 'writing';

if (!api) { console.error('Unknown host. Pass --host <site hostname> or --api <API base URL>.'); process.exit(2); }
if (!password) { console.error('Set ADMIN_PASSWORD in the environment (it is never printed).'); process.exit(2); }

async function admin(path, method = 'GET', body) {
  const response = await fetch(`${api}/admin/ai/${path}`, {
    method,
    headers: {'Content-Type': 'application/json', 'X-Admin-Password': password},
    ...(body ? {body: JSON.stringify(body)} : {}),
    signal: AbortSignal.timeout(30000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `${path} failed (${response.status})`);
  return data;
}

(async () => {
  console.log(`API: ${api}\nTask: ${task}\n`);
  const {models, settings} = await admin('settings');
  const wanted = args.models ? args.models.split(',').map(s => s.trim()) : models.filter(m => m.configured !== false).map(m => m.id);
  const unknown = wanted.filter(id => !models.some(m => m.id === id));
  if (unknown.length) throw new Error(`Not in this environment's registry: ${unknown.join(', ')}`);
  console.log(`Active default: ${settings.defaultModel}${settings.overrides?.writing ? ` · writing: ${settings.overrides.writing}` : ''}${settings.overrides?.board ? ` · board: ${settings.overrides.board}` : ''} · revision ${settings.revision}\n`);

  const rows = [];
  for (const id of wanted) {
    const started = Date.now();
    try {
      const {results: [result]} = await admin('compare', 'POST', {modelIds: [id], prompt, task});
      rows.push({id, ok: !result.error, result, wall: Date.now() - started});
    } catch (error) {
      rows.push({id, ok: false, result: {error: error.message}, wall: Date.now() - started});
    }
  }
  for (const {id, ok, result} of rows) {
    const cost = typeof result.estimatedCostUsd === 'number' ? `$${result.estimatedCostUsd.toFixed(6)}` : 'cost n/a';
    const detail = ok
      ? `${(result.latencyMs / 1000).toFixed(1)}s · ${result.usage?.inputTokens ?? '?'} in / ${result.usage?.outputTokens ?? '?'} out · ${cost}${result.truncated ? ' · TRUNCATED' : ''}`
      : result.error;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${id.padEnd(20)} ${detail}`);
    if (ok) console.log(`      ${String(result.text).replace(/\s+/g, ' ').slice(0, 140)}…`);
  }
  const failed = rows.filter(r => !r.ok);
  console.log(`\n${rows.length - failed.length}/${rows.length} models responded.`);
  if (rows.some(r => r.ok && r.result.truncated)) console.log('A truncated answer means the model needs more output room; check its extraOutputTokens in model-router.js.');
  process.exit(failed.length ? 1 : 0);
})().catch(error => { console.error(`Smoke test failed: ${error.message}`); process.exit(1); });
