#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const packedBmad = path.join(root, 'packages', 'bmad-speckit', '_bmad');

if (fs.existsSync(packedBmad)) {
  fs.rmSync(packedBmad, { recursive: true, force: true });
}
