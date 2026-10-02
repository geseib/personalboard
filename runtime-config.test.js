import './runtime-config.js';
const {resolveApiBaseUrl,validateApiBaseUrl}=globalThis.PersonalBoardConfig;
test('only exact known hosts choose a remote environment',()=>{
 expect(resolveApiBaseUrl('board.seibtribe.us')).toMatch(/\/production$/);
 expect(resolveApiBaseUrl('board.dev.seibtribe.us')).toMatch(/\/dev$/);
 for(const hostname of ['localhost','boardtest.seibtribe.us','evil-board.dev.example','pbod.attacker.test'])expect(resolveApiBaseUrl(hostname)).toBe('');
});
test('explicit deployment URLs require HTTPS except loopback development',()=>{
 expect(resolveApiBaseUrl('localhost','http://localhost:3001/')).toBe('http://localhost:3001');
 expect(validateApiBaseUrl('https://api.example.test/dev/')).toBe('https://api.example.test/dev');
 for(const url of ['http://example.test','javascript:alert(1)','https://user:secret@example.test','https://example.test?a=1'])expect(()=>validateApiBaseUrl(url)).toThrow();
});
