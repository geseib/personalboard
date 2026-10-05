// Publishes the admin page at every address people use: /admin and /admin.html (CloudFront rewrites /admin
// to /admin.html) and /admin/index.html. Links are made root-absolute so one file works from any of them.
// Without this, /admin.html kept serving a stale page left in S3 by older deploys.
const fs = require('node:fs');
const path = require('node:path');
const dist = path.resolve(__dirname, '../dist');
const html = fs.readFileSync(path.resolve(__dirname, '../admin/index.html'), 'utf8').replace(/(["'(])\.\.\//g, '$1/');
fs.mkdirSync(path.join(dist, 'admin'), { recursive: true });
fs.writeFileSync(path.join(dist, 'admin', 'index.html'), html);
fs.writeFileSync(path.join(dist, 'admin.html'), html);
for (const file of ['runtime-config.js', 'admin.js', 'admin.css', 'burger-menu.js', 'advisor-intelligence.js', 'enhanced-advisor-modal.js']) {
  fs.copyFileSync(path.resolve(__dirname, '..', file), path.join(dist, file));
}
