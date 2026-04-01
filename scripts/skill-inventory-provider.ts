import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { GovernanceHostKind } from './governance-remediation-runner';
import type { ExecutionSkillInventoryEntry } from './execution-intent-schema';

export type SkillInventorySource =
  | 'project-host'
  | 'project-agents'
  | 'project-workspace'
  | 'global-host'
  | 'global-agents';

export interface HostSkillInventoryEntry extends ExecutionSkillInventoryEntry {
  source: SkillInventorySource;
  priority: number;
}

export interface ResolveGovernanceSkillInventoryInput {
  projectRoot: string;
  hostKind: GovernanceHostKind;
  homeDir?: string;
}

export interface GovernanceSkillInventoryResult {
  availableSkills: string[];
  skillPaths: string[];
  skillInventory: HostSkillInventoryEntry[];
}

interface SkillInventoryRoot {
  rootPath: string;
  source: SkillInventorySource;
  priority: number;
}

interface SkillMetadata {
  title?: string;
  description?: string;
  summary?: string;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function normalizeSkillId(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeSkillPath(value: string): string {
  return value.replace(/\\/g, '/').trim();
}

function rootExists(rootPath: string): boolean {
  return rootPath.trim() !== '' && fs.existsSync(rootPath) && fs.statSync(rootPath).isDirectory();
}

function hostSkillDir(projectRoot: string, hostKind: GovernanceHostKind): string | null {
  switch (hostKind) {
    case 'cursor':
      return path.join(projectRoot, '.cursor', 'skills');
    case 'claude':
      return path.join(projectRoot, '.claude', 'skills');
    case 'codex':
      return path.join(projectRoot, '.codex', 'skills');
    case 'generic':
    default:
      return null;
  }
}

function globalHostSkillDir(homeDir: string, hostKind: GovernanceHostKind): string | null {
  switch (hostKind) {
    case 'cursor':
      return path.join(homeDir, '.cursor', 'skills');
    case 'claude':
      return path.join(homeDir, '.claude', 'skills');
    case 'codex':
      return path.join(homeDir, '.codex', 'skills');
    case 'generic':
    default:
      return null;
  }
}

function candidateRoots(input: ResolveGovernanceSkillInventoryInput): SkillInventoryRoot[] {
  const homeDir = input.homeDir ?? os.homedir();
  const roots: SkillInventoryRoot[] = [];
  const projectHostRoot = hostSkillDir(input.projectRoot, input.hostKind);
  const globalHostRoot = globalHostSkillDir(homeDir, input.hostKind);

  if (projectHostRoot) {
    roots.push({
      rootPath: projectHostRoot,
      source: 'project-host',
      priority: 100,
    });
  }

  roots.push({
    rootPath: path.join(input.projectRoot, '.agents', 'skills'),
    source: 'project-agents',
    priority: 90,
  });
  roots.push({
    rootPath: path.join(input.projectRoot, 'skills'),
    source: 'project-workspace',
    priority: 80,
  });

  if (globalHostRoot) {
    roots.push({
      rootPath: globalHostRoot,
      source: 'global-host',
      priority: 70,
    });
  }

  roots.push({
    rootPath: path.join(homeDir, '.agents', 'skills'),
    source: 'global-agents',
    priority: 60,
  });

  return roots.filter((root) => rootExists(root.rootPath));
}

function hasSkillMarkdown(dirPath: string): boolean {
  try {
    return fs
      .readdirSync(dirPath)
      .some((entry) => /^SKILL(\.[^.]+)?\.md$/iu.test(entry));
  } catch {
    return false;
  }
}

function resolveSkillMarkdownPath(dirPath: string): string | null {
  try {
    const fileName = fs
      .readdirSync(dirPath)
      .find((entry) => /^SKILL(\.[^.]+)?\.md$/iu.test(entry));
    return fileName ? path.join(dirPath, fileName) : null;
  } catch {
    return null;
  }
}

function parseFrontmatterBlock(markdown: string): Record<string, string> {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u);
  if (!match) {
    return {};
  }

  const metadata: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/u)) {
    const parsed = line.match(/^([A-Za-z0-9_-]+):\s*(.+?)\s*$/u);
    if (!parsed) {
      continue;
    }
    const key = parsed[1].trim().toLowerCase();
    const value = parsed[2].trim().replace(/^['"]|['"]$/g, '');
    if (value !== '') {
      metadata[key] = value;
    }
  }

  return metadata;
}

function compactWhitespace(value: string): string {
  return value.replace(/\s+/gu, ' ').trim();
}

function firstMarkdownHeading(markdown: string): string | undefined {
  const match = markdown.match(/^#\s+(.+?)\s*$/mu);
  return match ? compactWhitespace(match[1]) : undefined;
}

function firstMeaningfulParagraph(markdown: string): string | undefined {
  const lines = markdown.split(/\r?\n/u);
  const paragraphs: string[] = [];
  let current: string[] = [];
  let inFrontmatter = false;
  let frontmatterClosed = false;
  let inCodeFence = false;

  const flush = () => {
    const text = compactWhitespace(current.join(' '));
    if (text !== '') {
      paragraphs.push(text);
    }
    current = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!frontmatterClosed && line === '---') {
      inFrontmatter = !inFrontmatter;
      if (!inFrontmatter) {
        frontmatterClosed = true;
      }
      flush();
      continue;
    }
    if (inFrontmatter) {
      continue;
    }
    if (/^```/.test(line)) {
      inCodeFence = !inCodeFence;
      flush();
      continue;
    }
    if (inCodeFence) {
      continue;
    }
    if (line === '') {
      flush();
      continue;
    }
    if (/^#/.test(line) || /^```/.test(line) || /^[-*]\s/.test(line) || /^\d+\.\s/.test(line)) {
      flush();
      continue;
    }
    if (/^[A-Za-z0-9_-]+:\s+.+$/u.test(line) && paragraphs.length === 0 && current.length === 0) {
      continue;
    }
    current.push(line);
  }
  flush();

  return paragraphs[0];
}

function readSkillMetadata(skillMarkdownPath: string): SkillMetadata {
  try {
    const markdown = fs.readFileSync(skillMarkdownPath, 'utf8');
    const frontmatter = parseFrontmatterBlock(markdown);
    const title = frontmatter.name || frontmatter.title || firstMarkdownHeading(markdown);
    const description = frontmatter.description || frontmatter.summary;
    const summary = firstMeaningfulParagraph(markdown);

    return {
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
      ...(summary ? { summary } : {}),
    };
  } catch {
    return {};
  }
}

function collectSkillEntries(root: SkillInventoryRoot): HostSkillInventoryEntry[] {
  return fs
    .readdirSync(root.rootPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const skillDir = path.join(root.rootPath, entry.name);
      const skillMarkdownPath = resolveSkillMarkdownPath(skillDir);
      if (!skillMarkdownPath || !hasSkillMarkdown(skillDir)) {
        return null;
      }

      return {
        skillId: normalizeSkillId(entry.name),
        path: skillMarkdownPath,
        source: root.source,
        priority: root.priority,
        ...readSkillMetadata(skillMarkdownPath),
      } satisfies HostSkillInventoryEntry;
    })
    .filter((entry): entry is HostSkillInventoryEntry => entry !== null);
}

export function resolveGovernanceSkillInventory(
  input: ResolveGovernanceSkillInventoryInput
): GovernanceSkillInventoryResult {
  const entries = candidateRoots(input)
    .flatMap((root) => collectSkillEntries(root))
    .sort((left, right) => {
      if (right.priority !== left.priority) {
        return right.priority - left.priority;
      }
      return left.skillId.localeCompare(right.skillId);
    });

  const dedupedBySkillId = new Map<string, HostSkillInventoryEntry>();
  for (const entry of entries) {
    if (!dedupedBySkillId.has(entry.skillId)) {
      dedupedBySkillId.set(entry.skillId, entry);
    }
  }

  const skillInventory = [...dedupedBySkillId.values()];
  return {
    availableSkills: unique(skillInventory.map((entry) => entry.skillId)),
    skillPaths: unique(
      skillInventory
        .map((entry) => (entry.path ? normalizeSkillPath(entry.path) : ''))
        .filter(Boolean)
    ),
    skillInventory: skillInventory.map((entry) => ({
      ...entry,
      path: entry.path ? normalizeSkillPath(entry.path) : entry.path,
    })),
  };
}
