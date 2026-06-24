#!/usr/bin/env node
/* eslint-disable no-console */
const { execFileSync } = require('node:child_process');

const UPSTREAM_COMMIT = process.env.BMAD_HELP_UPSTREAM_COMMIT || '2646672a';

function gitShow(spec) {
  return execFileSync('git', ['show', spec], { encoding: 'utf8' });
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function parseCatalog(csv) {
  const lines = csv.split(/\r?\n/u).filter(Boolean);
  const header = parseCsvLine(lines[0] || '');
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(header.map((key, index) => [key, values[index] || '']));
  });
}

function groupByModule(items) {
  return items.reduce((groups, item) => {
    groups[item.module] ||= [];
    groups[item.module].push(item);
    return groups;
  }, {});
}

function formatEntry(item) {
  const lines = [`- ${item.name} (${item.code})`];
  if (item.command) {
    lines.push(`  Command: \`${item.command}\``);
  } else {
    lines.push(`  Load: ${item['agent-name'] || 'agent'} agent skill, then ask for ${item.code}`);
  }
  lines.push(`  Agent: ${[item['agent-display-name'], item['agent-title']].filter(Boolean).join(' ') || item['agent-name'] || '-'}`);
  lines.push(`  Phase: ${item.phase || 'anytime'}; required=${item.required}`);
  lines.push(`  Description: ${item.description || '-'}`);
  lines.push(`  Outputs: ${item['output-location'] || '-'} -> ${item.outputs || '-'}`);
  return lines.join('\n');
}

function main() {
  const catalog = parseCatalog(gitShow(`${UPSTREAM_COMMIT}:_bmad/_config/bmad-help.csv`));
  const workflow = gitShow(`${UPSTREAM_COMMIT}:_bmad/core/skills/bmad-help/workflow.md`);
  const groups = groupByModule(catalog);
  const lines = [
    '# bmad-help upstream-style baseline',
    '',
    `Source: BMAD-METHOD sync commit ${UPSTREAM_COMMIT}`,
    '',
    '## Upstream Behavior Notes',
    '- This baseline follows the upstream workflow shape: module detection, input analysis, phase/sequence routing, and optional/required next steps.',
    '- It intentionally does not render Project State Card, main-agent, Codex layers, gate evidence, or five-layer status.',
    '- Without an interactive conversation state, it lists the upstream catalog by module and preserves upstream display rules.',
    '',
    '## Upstream Catalog',
    `Total catalog rows: ${catalog.length}`,
  ];

  for (const [moduleName, items] of Object.entries(groups)) {
    lines.push('');
    lines.push(`### ${moduleName} (${items.length})`);
    for (const item of items) lines.push(formatEntry(item));
  }

  lines.push('');
  lines.push('## Upstream Workflow Guidance');
  lines.push(workflow.trimEnd());
  console.log(lines.join('\n'));
}

main();
