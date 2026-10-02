// dist is generated output. Clear stale bundles before assembling a release.
const fs = require('node:fs');
const path = require('node:path');
fs.rmSync(path.resolve(__dirname, '../dist'), { recursive: true, force: true });
