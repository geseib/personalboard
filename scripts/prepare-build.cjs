// dist is generated output. Clear stale bundles before assembling a release.
const fs = require('node:fs');
const path = require('node:path');
fs.rmSync(path.resolve(__dirname, '../dist'), { recursive: true, force: true });
// A stale Parcel cache can reuse an old index.html whose import map lacks newly added lazy chunks
// (seen with board-report-docx: "Failed to resolve module specifier"). Release builds start clean.
fs.rmSync(path.resolve(__dirname, '../.parcel-cache'), { recursive: true, force: true });
