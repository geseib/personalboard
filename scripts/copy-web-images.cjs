const fs = require('node:fs');
const path = require('node:path');
const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif', '.ico']);

function copyWebImages(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    // Editing projects can contain thousands of images that aren't web assets.
    if (entry.name.startsWith('.') || entry.name.endsWith('.cmproj')) continue;
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) copyWebImages(from, to);
    else if (entry.isFile() && imageExtensions.has(path.extname(entry.name).toLowerCase())) fs.copyFileSync(from, to);
  }
}

if (require.main === module) copyWebImages(path.resolve(__dirname, '../images'), path.resolve(__dirname, '../dist/images'));
module.exports = { copyWebImages };
