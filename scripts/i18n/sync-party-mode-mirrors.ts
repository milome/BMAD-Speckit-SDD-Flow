import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');
const CANONICAL_ROOT = path.join(ROOT, '_bmad', 'core', 'skills', 'bmad-party-mode');
const MIRROR_ROOTS = [
  path.join(ROOT, '_bmad', 'skills', 'bmad-party-mode'),
  path.join(ROOT, '_bmad', 'core', 'workflows', 'party-mode'),
];

const RELATIVE_FILES = [
  'workflow.md',
  'workflow.zh.md',
  'workflow.en.md',
  'steps/step-01-agent-loading.md',
  'steps/step-01-agent-loading.zh.md',
  'steps/step-01-agent-loading.en.md',
  'steps/step-02-discussion-orchestration.md',
  'steps/step-02-discussion-orchestration.zh.md',
  'steps/step-02-discussion-orchestration.en.md',
  'steps/step-03-graceful-exit.md',
  'steps/step-03-graceful-exit.zh.md',
  'steps/step-03-graceful-exit.en.md',
] as const;

const GENERATED_HEADER_PREFIX = '<!-- GENERATED FROM:' as const;

function injectGeneratedHeader(content: string, relativeFile: string): string {
  const header = `<!-- GENERATED FROM: _bmad/core/skills/bmad-party-mode/${relativeFile.replace(/\\/g, '/')} ; DO NOT EDIT HERE -->`;
  if (content.startsWith('---\n') || content.startsWith('---\r\n')) {
    const separator = content.includes('\r\n') ? '\r\n' : '\n';
    const parts = content.split(new RegExp(`${separator}---${separator}`));
    if (parts.length >= 2) {
      const frontmatter = `${parts[0]}${separator}---${separator}`;
      const rest = content.slice(frontmatter.length);
      return `${frontmatter}${header}${separator}${rest}`;
    }
  }
  return `${header}\n${content}`;
}

export function stripGeneratedHeader(content: string): string {
  return content
    .replace(/^<!-- GENERATED FROM: .*? -->\r?\n/u, '')
    .replace(/^(---\r?\n[\s\S]*?\r?\n---\r?\n)<!-- GENERATED FROM: .*? -->\r?\n/u, '$1');
}

export function syncPartyModeMirrors(): void {
  for (const relativeFile of RELATIVE_FILES) {
    const sourcePath = path.join(CANONICAL_ROOT, relativeFile);
    if (!fs.existsSync(sourcePath)) {
      continue;
    }
    const source = fs.readFileSync(sourcePath, 'utf8');
    for (const mirrorRoot of MIRROR_ROOTS) {
      const targetPath = path.join(mirrorRoot, relativeFile);
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, injectGeneratedHeader(source, relativeFile), 'utf8');
    }
  }
}

if (require.main === module) {
  syncPartyModeMirrors();
}

export { GENERATED_HEADER_PREFIX, RELATIVE_FILES };
