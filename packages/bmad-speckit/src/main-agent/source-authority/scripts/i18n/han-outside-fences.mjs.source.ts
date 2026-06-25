'use strict';

const originalSource = "#!/usr/bin/env node\n/**\n * Count lines matching Han outside ``` ... ``` fences.\n * Fence toggle: trimmed line starts with ``` (triple backtick).\n */\nimport fs from \"node:fs\";\n\nconst HAN = /[\\u4e00-\\u9fff]/;\nconst files = process.argv.slice(2);\nif (files.length === 0) {\n  console.error(\"Usage: node han-outside-fences.mjs <file>...\");\n  process.exit(2);\n}\n\nfor (const fp of files) {\n  const s = fs.readFileSync(fp, \"utf8\");\n  let inFence = false;\n  let count = 0;\n  const hits = [];\n  for (const line of s.split(/\\r?\\n/)) {\n    const t = line.trimStart();\n    if (t.startsWith(\"```\")) {\n      inFence = !inFence;\n      continue;\n    }\n    if (!inFence && HAN.test(line)) {\n      count++;\n      if (hits.length < 3) hits.push(line.slice(0, 100));\n    }\n  }\n  console.log(`${fp}\\t${count}`);\n  if (count > 0 && process.env.VERBOSE) {\n    for (const h of hits) console.log(\"  sample:\", h);\n  }\n}\n";

module.exports = {
  originalPath: "scripts/i18n/han-outside-fences.mjs",
  originalSource,
};
