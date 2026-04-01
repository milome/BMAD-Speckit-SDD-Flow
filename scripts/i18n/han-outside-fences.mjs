#!/usr/bin/env node
/**
 * Count lines matching Han outside ``` ... ``` fences.
 * Fence toggle: trimmed line starts with ``` (triple backtick).
 */
import fs from "node:fs";

const HAN = /[\u4e00-\u9fff]/;
const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("Usage: node han-outside-fences.mjs <file>...");
  process.exit(2);
}

for (const fp of files) {
  const s = fs.readFileSync(fp, "utf8");
  let inFence = false;
  let count = 0;
  const hits = [];
  for (const line of s.split(/\r?\n/)) {
    const t = line.trimStart();
    if (t.startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (!inFence && HAN.test(line)) {
      count++;
      if (hits.length < 3) hits.push(line.slice(0, 100));
    }
  }
  console.log(`${fp}\t${count}`);
  if (count > 0 && process.env.VERBOSE) {
    for (const h of hits) console.log("  sample:", h);
  }
}
