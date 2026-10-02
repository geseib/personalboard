export function applyWritingEdits(current, edits, modes = {}) {
  const next = { ...current };
  for (const [field, text] of Object.entries(edits)) {
    if (!Object.prototype.hasOwnProperty.call(current, field) || typeof text !== 'string') continue;
    next[field] = modes[field] === 'append' && current[field] ? `${current[field]}\n\n${text}` : text;
  }
  return next;
}
export function fieldLabel(field) {
  return ({ description: 'Description', notes: 'Notes', whatToLearn: 'What I want to learn', whatTheyGet: 'What I can offer', whatYouTeach: 'What I teach', whatYouLearn: 'What I learn' })[field] || field;
}
export function writingConflicts(current, original, edits, modes = {}) {
  return Object.keys(edits).filter(field => modes[field] !== 'append' && current[field] !== original[field]);
}
export function undoWritingEdits(current, before, applied) {
  const form = {...current};
  const conflicts = [];
  for (const field of Object.keys(applied)) {
    if (current[field] !== applied[field]) conflicts.push(field);
    else form[field] = before[field];
  }
  return {form, conflicts};
}
export function recoverWritingDraft(saved, base) {
  if (!saved || saved.version !== 1 || saved.base !== JSON.stringify(base) || !saved.form || Array.isArray(saved.form)) return null;
  const form = {...base};
  for (const field of Object.keys(base)) {
    if (typeof saved.form[field] !== typeof base[field]) return null;
    form[field] = saved.form[field];
  }
  return JSON.stringify(form) === JSON.stringify(base) ? null : form;
}

export function clearWritingDrafts(storage) {
  try {
    const keys = Array.from({length:storage.length}, (_,index)=>storage.key(index));
    keys.filter(key=>key?.startsWith('board-entry-draft:')).forEach(key=>storage.removeItem(key));
  } catch { /* Session storage can be unavailable in private browsing. */ }
}
