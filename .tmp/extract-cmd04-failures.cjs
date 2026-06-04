const fs = require('node:fs');

const receiptPath = '.tmp/main-agent-runtime-migration-wave-3.1/command-receipts/CMD-04.json';
const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
const lines = String(receipt.stdout || '').split(/\r?\n/u);
const seen = new Set();

for (let index = 0; index < lines.length; index += 1) {
  if (!/not ok|# fail 2|AssertionError|ERR_|Error:|expected|actual|failureType|operator/i.test(lines[index])) {
    continue;
  }
  const start = Math.max(0, index - 10);
  const end = Math.min(lines.length - 1, index + 25);
  const key = `${start}:${end}`;
  if (seen.has(key)) continue;
  seen.add(key);
  console.log(`--- match line ${index + 1}`);
  console.log(lines.slice(start, end + 1).join('\n'));
}
