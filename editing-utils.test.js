import { applyWritingEdits } from './editing-utils.js';
test('applies only selected text fields and preserves newer unrelated edits', () => {
  expect(applyWritingEdits({description:'Original', notes:'New note', timeframe:'Short'}, {description:'Edited', injected:'No'})).toEqual({description:'Edited',notes:'New note',timeframe:'Short'});
});
test('append respects existing text and empty fields', () => {
  expect(applyWritingEdits({notes:'Original',description:''}, {notes:'Added',description:'First'}, {notes:'append',description:'append'})).toEqual({notes:'Original\n\nAdded',description:'First'});
});
test('does not mutate drafts or apply non-text model values', () => {
  const original = {notes:'Keep'};
  expect(applyWritingEdits(original,{notes:{bad:true}})).toEqual(original);
  expect(applyWritingEdits(original,{notes:'Change'})).not.toBe(original);
  expect(original.notes).toBe('Keep');
});
test('flags overwriting text edited during an AI request but allows append', async () => {
  const {writingConflicts} = await import('./editing-utils.js');
  expect(writingConflicts({notes:'New typing'}, {notes:'Old'}, {notes:'AI'})).toEqual(['notes']);
  expect(writingConflicts({notes:'New typing'}, {notes:'Old'}, {notes:'AI'}, {notes:'append'})).toEqual([]);
});
test('undo preserves unrelated edits and refuses to erase newer writing', async () => {
  const {undoWritingEdits} = await import('./editing-utils.js');
  expect(undoWritingEdits({name:'New name',notes:'AI',description:'My newer edit'}, {name:'Old name',notes:'Old',description:'Before'}, {notes:'AI',description:'AI description'})).toEqual({form:{name:'New name',notes:'Old',description:'My newer edit'}, conflicts:['description']});
});
test('draft recovery requires the same original entry and a versioned valid form', async () => {
  const {recoverWritingDraft} = await import('./editing-utils.js');
  const base={name:'Alex',notes:'Original'};
  const saved={version:1,base:JSON.stringify(base),form:{...base,notes:'Draft'}};
  expect(recoverWritingDraft(saved,base)).toEqual({name:'Alex',notes:'Draft'});
  expect(recoverWritingDraft(saved,{name:'Alex',notes:'Other board'})).toBeNull();
  expect(recoverWritingDraft({...saved,version:0},base)).toBeNull();
  expect(recoverWritingDraft({...saved,form:{...base,notes:{bad:true}}},base)).toBeNull();
});
test('changing boards clears recovered entry drafts without touching authentication or other session data', async()=>{
  const {clearWritingDrafts}=await import('./editing-utils.js');
  const entries=new Map([['board-entry-draft:mentors:0','old'],['board-entry-draft:goals:1','old'],['adminPassword','keep']]);
  const storage={get length(){return entries.size;},key:index=>[...entries.keys()][index],removeItem:key=>entries.delete(key)};
  clearWritingDrafts(storage);
  expect([...entries.entries()]).toEqual([['adminPassword','keep']]);
});
