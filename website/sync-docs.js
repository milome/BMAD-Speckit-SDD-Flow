#!/usr/bin/env node
/**
 * Sync docs/ content into website/src/content/docs/ for Starlight.
 * Uses directory copy instead of symlinks for Windows compatibility.
 * Adds Starlight frontmatter (title) to markdown files that lack it.
 *
 * Usage: node website/sync-docs.js
 */

import { cpSync, rmSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, statSync } from 'fs';
import { resolve, dirname, basename, extname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const docsSource = resolve(projectRoot, 'docs');
const contentTarget = resolve(__dirname, 'src', 'content', 'docs');

const categories = ['tutorials', 'how-to', 'explanation', 'reference'];

for (const cat of categories) {
  const src = resolve(docsSource, cat);
  const dest = resolve(contentTarget, cat);

  if (!existsSync(src)) {
    console.log(`[SKIP] ${cat}/ not found in docs/`);
    continue;
  }

  if (existsSync(dest)) {
    rmSync(dest, { recursive: true, force: true });
  }
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
  console.log(`[SYNC] docs/${cat}/ → src/content/docs/${cat}/`);

  addFrontmatter(dest);
}

console.log('\nDone. Run `npm run dev` in website/ to preview.');

function addFrontmatter(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      addFrontmatter(full);
      continue;
    }
    if (!['.md', '.mdx'].includes(extname(entry))) continue;

    let content = readFileSync(full, 'utf-8');
    if (content.startsWith('---')) continue;

    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : basename(entry, extname(entry));

    content = `---\ntitle: "${title.replace(/"/g, '\\"')}"\n---\n\n${content}`;
    writeFileSync(full, content, 'utf-8');
    console.log(`  [FRONTMATTER] ${basename(full)}: "${title}"`);
  }
}
