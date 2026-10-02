const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { copyWebImages } = require('../scripts/copy-web-images.cjs');

test('release images retain nested web assets and exclude editing projects and source documents', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'board-assets-'));
  try {
    const source = path.join(root, 'source'), output = path.join(root, 'output');
    for (const file of ['Slide1.png', 'icons/person.SVG', 'movie.cmproj/frame.png', 'deck.pptx', '.private.png']) {
      const target = path.join(source, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, file);
    }
    copyWebImages(source, output);
    assert.equal(fs.readFileSync(path.join(output, 'icons/person.SVG'), 'utf8'), 'icons/person.SVG');
    assert.deepEqual(fs.readdirSync(output).sort(), ['Slide1.png', 'icons']);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
