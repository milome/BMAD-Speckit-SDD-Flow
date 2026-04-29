const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CLAUDE_AGENTS = path.join(ROOT, '_bmad', 'claude', 'agents');
const CODEX_AGENTS = path.join(ROOT, '_bmad', 'codex', 'agents');
const REQUIRED_CODEX_PROTOCOLS = [
  '.codex/protocols/audit-result-schema.md',
  '.codex/protocols/handoff-schema.md',
  '.codex/protocols/commit-protocol.md',
];
const REQUIRED_CODEX_SKILLS = [
  '.codex/skills/speckit-workflow/SKILL.md',
  '.codex/skills/bmad-story-assistant/SKILL.md',
  '.codex/skills/bmad-standalone-tasks/SKILL.md',
  '.codex/skills/bmad-standalone-tasks-doc-review/SKILL.md',
  '.codex/skills/bmad-rca-helper/SKILL.md',
  '.codex/skills/bmad-code-reviewer-lifecycle/SKILL.md',
];
const CODEX_ONLY_AGENT_FILES = new Set(['release-quality-proof-worker.toml']);

function walkMarkdown(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkMarkdown(full));
    if (entry.isFile() && entry.name.endsWith('.md')) out.push(full);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function toPortable(value) {
  return value.replace(/\\/g, '/');
}

function tomlString(value) {
  return JSON.stringify(value);
}

function tomlMultiline(value) {
  return `"""${value.replace(/\\/g, '\\\\').replace(/"""/g, '\\"\\"\\"')}"""`;
}

function agentNameFromRelative(relativePath) {
  return toPortable(relativePath).replace(/\.md$/u, '').replace(/\//g, '__');
}

function descriptionFromMarkdown(markdown, name) {
  const firstHeading = markdown
    .split(/\r?\n/u)
    .find((line) => /^#\s+\S/u.test(line))
    ?.replace(/^#\s+/u, '')
    .trim();
  return firstHeading
    ? `BMAD Codex custom agent for ${firstHeading}.`
    : `BMAD Codex custom agent ${name}.`;
}

function codexizeMarkdown(markdown) {
  return markdown
    .replace(/\.claude\/state\/stories\/\{epic\}-\{story\}-progress\.yaml/gu, '_bmad-output/runtime/context/stories/{epic}/{story}.json')
    .replace(/\.claude\/state\/bmad-progress\.yaml/gu, '_bmad-output/runtime/context/project.json')
    .replace(/\.claude\/state/gu, '_bmad-output/runtime/context')
    .replace(/\.claude\/skills/gu, '.codex/skills')
    .replace(/\.claude\/agents/gu, '.codex/agents')
    .replace(/\.claude\/protocols/gu, '.codex/protocols')
    .replace(/\.claude\//gu, '.codex/')
    .replace(/\.cursor\/skills/gu, '.codex/skills')
    .replace(/\.cursor\/commands/gu, '.codex/commands')
    .replace(/\.cursor\//gu, '.codex/')
    .replace(/_bmad\/claude\/hooks/gu, '_bmad/runtime/hooks')
    .replace(/Claude\/OMC Runtime/gu, 'Codex no-hooks Runtime')
    .replace(/Claude Agent Definition/gu, 'Codex Agent Source Contract')
    .replace(/oh-my-claudecode/giu, 'Codex-native reviewer')
    .replace(/OMC reviewer/giu, 'Codex reviewer')
    .replace(/Cursor Task/giu, 'Codex worker dispatch')
    .replace(/Cursor speckit format/giu, 'Codex speckit format')
    .replace(/Cursor speckit naming/giu, 'Codex speckit naming')
    .replace(/Cursor speckit-workflow/giu, 'Codex speckit-workflow')
    .replace(/Cursor Canonical Base/giu, 'Codex Canonical Base')
    .replace(/Cursor Command/giu, 'Codex command')
    .replace(/Cursor/gu, 'Codex')
    .replace(/mcp_task/giu, 'Codex worker adapter')
    .replace(/mcp-task/giu, 'Codex worker adapter')
    .replace(/generalPurpose/gu, 'general-purpose')
    .replace(/claude carrier adapter/giu, 'codex carrier adapter')
    .replace(/Claude Code CLI/gu, 'Codex CLI')
    .replace(/Claude adapter/giu, 'Codex adapter')
    .replace(/Claude agent/giu, 'source agent')
    .replace(/Claude/gu, 'Codex')
    .replace(/npm run main-agent-orchestration -- --cwd \{project-root\} --action inspect\|dispatch-plan/gu, 'npx --no-install bmad-speckit main-agent-orchestration --cwd {project-root} --action inspect|dispatch-plan')
    .replace(/npm run main-agent-orchestration -- --cwd \{project-root\} --action inspect/gu, 'npx --no-install bmad-speckit main-agent-orchestration --cwd {project-root} --action inspect')
    .replace(/npm run main-agent-orchestration -- --cwd \{project-root\} --action dispatch-plan/gu, 'npx --no-install bmad-speckit main-agent-orchestration --cwd {project-root} --action dispatch-plan')
    .replace(/npm run main-agent/giu, 'npx --no-install bmad-speckit main-agent')
    .replace(/npx ts-node scripts\//giu, 'npx --no-install bmad-speckit ')
    .replace(/npx ts-node scripts\/run-auditor-host\.ts/gu, 'npx --no-install bmad-speckit run-auditor-host')
    .replace(/`scripts\/bmad-config\.ts`/gu, '`_bmad/_config/bmad-story-config.yaml`')
    .replace(/scripts\/bmad-config\.ts/gu, '_bmad/_config/bmad-story-config.yaml')
    .replace(/`scripts\/parse-bmad-audit-result\.ts`/gu, '`npx --no-install bmad-speckit run-auditor-host`')
    .replace(/scripts\/parse-bmad-audit-result\.ts/gu, 'npx --no-install bmad-speckit run-auditor-host')
    .replace(/host_role\s*=\s*"?claude-[^"\n]*"?/giu, 'host_role = "codex-no-hooks"')
    .replace(/閫氳繃 Agent 宸ュ叿璋冪敤/gu, '閫氳繃 Codex worker adapter 璋冪敤')
    .replace(/閫氳繃 Agent 宸ュ叿鍚姩/gu, '閫氳繃 Codex worker adapter 鍚姩')
    .replace(/@"party-mode-facilitator \(agent\)"/gu, 'party-mode-facilitator');
}

function sandboxMode(name, markdown) {
  const lowered = `${name}\n${markdown.slice(0, 1200)}`.toLowerCase();
  if (
    lowered.includes('auditor') ||
    lowered.includes('reviewer') ||
    lowered.includes('analyze') ||
    lowered.includes('checklist') ||
    lowered.includes('clarify') ||
    lowered.includes('gaps')
  ) {
    return 'read-only';
  }
  return 'workspace-write';
}

function renderToml(relativePath, markdown) {
  const name = agentNameFromRelative(relativePath);
  const sourcePath = toPortable(path.join('_bmad', 'claude', 'agents', relativePath));
  const codexMarkdown = codexizeMarkdown(markdown);
  const body = [
    'You are running as a BMAD Codex custom agent on the no-hooks worker adapter.',
    '',
    'BMAD runtime metadata:',
    '- host_role: codex-no-hooks',
    '',
    `Source behavior contract: ${sourcePath}`,
    '',
    'Preserve the same responsibilities, constraints, output contracts, and verification discipline.',
    'Use Codex runtime surfaces: .codex/agents, .codex/skills, and _bmad-output/runtime/context. Do not write legacy host state.',
    'When used by BMAD main-agent dispatch, obey the dispatch packet allowedWriteScope, expectedDelta, successCriteria, stopConditions, and TaskReport path.',
    'If these instructions conflict with a narrower dispatch packet, the dispatch packet wins.',
    '',
    '--- Codex Agent Source Contract ---',
    codexMarkdown,
  ].join('\n');
  return [
    `name = ${tomlString(name)}`,
    `description = ${tomlString(descriptionFromMarkdown(codexMarkdown, name))}`,
    `sandbox_mode = ${tomlString(sandboxMode(name, codexMarkdown))}`,
    '',
    `developer_instructions = ${tomlMultiline(body)}`,
    '',
  ].join('\n');
}

function build() {
  const files = walkMarkdown(CLAUDE_AGENTS);
  const generated = files.map((source) => {
    const relative = path.relative(CLAUDE_AGENTS, source);
    const target = path.join(CODEX_AGENTS, relative).replace(/\.md$/u, '.toml');
    const markdown = fs.readFileSync(source, 'utf8');
    return { source, target, content: renderToml(relative, markdown) };
  });
  for (const alias of roleAliases()) {
    const source = path.join(CLAUDE_AGENTS, alias.source);
    if (!fs.existsSync(source)) continue;
    const markdown = fs.readFileSync(source, 'utf8');
    const target = path.join(CODEX_AGENTS, `${alias.name}.toml`);
    generated.push({
      source,
      target,
      content: renderAliasToml(alias.name, alias.source, markdown, alias.description),
    });
  }
  return generated;
}

function roleAliases() {
  return [
    {
      name: 'implementation-worker',
      source: 'speckit-implement.md',
      description: 'BMAD default implementation worker for the Codex no-hooks branch.',
    },
    {
      name: 'remediation-worker',
      source: 'speckit-implement.md',
      description: 'BMAD default remediation worker for the Codex no-hooks branch.',
    },
    {
      name: 'document-worker',
      source: 'auditors/auditor-document.md',
      description: 'BMAD default document worker for the Codex no-hooks branch.',
    },
    {
      name: 'general-purpose',
      source: 'bmad-master.md',
      description: 'BMAD general-purpose Codex agent.',
    },
    {
      name: 'codex-no-hooks-worker',
      source: 'speckit-implement.md',
      description: 'BMAD Codex no-hooks worker.',
    },
  ];
}

function repoPathForCodexDependency(relPath) {
  const normalized = relPath.replace(/\\/g, '/');
  if (normalized.startsWith('.codex/protocols/')) {
    return path.join(ROOT, '_bmad', 'codex', 'protocols', normalized.slice('.codex/protocols/'.length));
  }
  if (normalized.startsWith('.codex/skills/')) {
    return path.join(ROOT, '_bmad', 'codex', 'skills', normalized.slice('.codex/skills/'.length));
  }
  return path.join(ROOT, normalized);
}

function collectMissingDependencies(generated) {
  const required = new Set([...REQUIRED_CODEX_PROTOCOLS, ...REQUIRED_CODEX_SKILLS]);
  for (const item of generated) {
    const matches = item.content.match(/\.codex\/(?:protocols|skills)\/[A-Za-z0-9._/-]+/gu) || [];
    for (const match of matches) {
      if (match.endsWith('/')) continue;
      required.add(match.replace(/[),.;:]+$/u, ''));
    }
  }
  return [...required]
    .sort((a, b) => a.localeCompare(b))
    .filter((relPath) => !fs.existsSync(repoPathForCodexDependency(relPath)));
}

function renderAliasToml(name, relativePath, markdown, description) {
  const sourcePath = toPortable(path.join('_bmad', 'claude', 'agents', relativePath));
  const codexMarkdown = codexizeMarkdown(markdown);
  const body = [
    'You are running as a BMAD Codex custom agent alias on the no-hooks worker adapter.',
    '',
    'BMAD runtime metadata:',
    '- host_role: codex-no-hooks',
    `- alias_for_dispatch_role: ${name}`,
    '',
    `Alias name: ${name}`,
    `Source behavior contract: ${sourcePath}`,
    '',
    'Use the source behavior contract through Codex runtime surfaces, not legacy host state.',
    'When used by BMAD main-agent dispatch, obey the dispatch packet allowedWriteScope, expectedDelta, successCriteria, stopConditions, and TaskReport path.',
    'If these instructions conflict with a narrower dispatch packet, the dispatch packet wins.',
    '',
    '--- Codex Agent Source Contract ---',
    codexMarkdown,
  ].join('\n');
  return [
    `name = ${tomlString(name)}`,
    `description = ${tomlString(description)}`,
    `sandbox_mode = ${tomlString(sandboxMode(name, codexMarkdown))}`,
    '',
    `developer_instructions = ${tomlMultiline(body)}`,
    '',
  ].join('\n');
}

function main() {
  const check = process.argv.includes('--check');
  const generated = build();
  const diffs = [];
  for (const item of generated) {
    const current = fs.existsSync(item.target) ? fs.readFileSync(item.target, 'utf8') : null;
    if (current !== item.content) {
      diffs.push(toPortable(path.relative(ROOT, item.target)));
      if (!check) {
        fs.mkdirSync(path.dirname(item.target), { recursive: true });
        fs.writeFileSync(item.target, item.content, 'utf8');
      }
    }
  }
  const stale = [];
  if (fs.existsSync(CODEX_AGENTS)) {
    for (const file of walkToml(CODEX_AGENTS)) {
      const relative = toPortable(path.relative(CODEX_AGENTS, file));
      if (CODEX_ONLY_AGENT_FILES.has(relative)) {
        continue;
      }
      if (!generated.some((item) => path.resolve(item.target) === path.resolve(file))) {
        stale.push(toPortable(path.relative(ROOT, file)));
      }
    }
  }
  const missingDependencies = collectMissingDependencies(generated);
  if (check && (diffs.length > 0 || stale.length > 0 || missingDependencies.length > 0)) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          missingOrChanged: diffs,
          stale,
          missingDependencies,
          generatedCount: generated.length,
        },
        null,
        2
      )
    );
    return 1;
  }
  console.log(
    JSON.stringify(
      {
        ok: true,
        generatedCount: generated.length,
        changed: diffs.length,
        stale,
        missingDependencies,
      },
      null,
      2
    )
  );
  return 0;
}

function walkToml(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkToml(full));
    if (entry.isFile() && entry.name.endsWith('.toml')) out.push(full);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

process.exitCode = main();
