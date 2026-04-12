import * as fs from 'node:fs';
import * as path from 'node:path';

export type ReviewerRuntimeHostId = 'cursor' | 'claude';

export interface ReviewerRuntimeDefinitionReceipt {
  host: ReviewerRuntimeHostId;
  targetPath: string;
  sourceRelativePath?: string;
  updated: boolean;
  skippedReason?: string;
}

const CURSOR_SOURCE = '_bmad/cursor/agents/code-reviewer.md' as const;
const CURSOR_TARGET = '.cursor/agents/code-reviewer.md' as const;
const CLAUDE_SOURCE = '_bmad/claude/agents/code-reviewer.md' as const;
const CLAUDE_TARGET = '.claude/agents/code-reviewer.md' as const;
const SHARED_METADATA = '_bmad/core/agents/code-reviewer/metadata.json' as const;
const SHARED_PROFILE_PACK = '_bmad/core/agents/code-reviewer/profiles.json' as const;
const SHARED_BASE_PROMPT = '_bmad/core/agents/code-reviewer/base-prompt.md' as const;

function sourceRelativePath(host: ReviewerRuntimeHostId): string {
  return host === 'cursor' ? CURSOR_SOURCE : CLAUDE_SOURCE;
}

function targetRelativePath(host: ReviewerRuntimeHostId): string {
  return host === 'cursor' ? CURSOR_TARGET : CLAUDE_TARGET;
}

function injectGeneratedHeader(
  content: string,
  metadata: {
    sourceRelativePath: string;
  }
): string {
  const separator = content.includes('\r\n') ? '\r\n' : '\n';
  const header =
    `<!-- RUNTIME-MATERIALIZED reviewer source=${metadata.sourceRelativePath}` +
    ` shared_metadata=${SHARED_METADATA}` +
    ` shared_profiles=${SHARED_PROFILE_PACK}` +
    ` shared_prompt=${SHARED_BASE_PROMPT} -->`;

  if (content.startsWith(`---${separator}`)) {
    const closingMarker = `${separator}---${separator}`;
    const closingIndex = content.indexOf(closingMarker, 4);
    if (closingIndex >= 0) {
      const splitAt = closingIndex + closingMarker.length;
      return `${content.slice(0, splitAt)}${header}${separator}${content.slice(splitAt)}`;
    }
  }

  return `${header}${separator}${content}`;
}

function stripGeneratedHeader(content: string): string {
  return content.replace(/<!-- RUNTIME-MATERIALIZED reviewer[\s\S]*? -->\r?\n?/u, '');
}

export function ensureReviewerRuntimeDefinition(
  projectRoot: string,
  options?: { hosts?: ReviewerRuntimeHostId[] }
): ReviewerRuntimeDefinitionReceipt[] {
  const hosts = options?.hosts ?? (['cursor', 'claude'] as ReviewerRuntimeHostId[]);
  return hosts.map((host) => {
    const runtimeDir =
      host === 'cursor'
        ? path.join(projectRoot, '.cursor', 'agents')
        : path.join(projectRoot, '.claude', 'agents');
    if (!fs.existsSync(runtimeDir)) {
      return {
        host,
        targetPath: path.join(projectRoot, targetRelativePath(host)),
        updated: false,
        skippedReason: `runtime dir missing: ${path.relative(projectRoot, runtimeDir).replace(/\\/g, '/')}`,
      };
    }
    const sourceRelative = sourceRelativePath(host);
    const sourcePath = path.join(projectRoot, sourceRelative);
    const targetPath = path.join(projectRoot, targetRelativePath(host));
    if (!fs.existsSync(sourcePath)) {
      return {
        host,
        targetPath,
        updated: false,
        skippedReason: `source asset missing: ${sourceRelative}`,
      };
    }
    const source = fs.readFileSync(sourcePath, 'utf8');
    const materialized = injectGeneratedHeader(stripGeneratedHeader(source), {
      sourceRelativePath: sourceRelative,
    });
    const previous = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, 'utf8') : null;
    if (previous === materialized) {
      return {
        host,
        targetPath,
        sourceRelativePath: sourceRelative,
        updated: false,
      };
    }
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, materialized, 'utf8');
    return {
      host,
      targetPath,
      sourceRelativePath: sourceRelative,
      updated: true,
    };
  });
}
