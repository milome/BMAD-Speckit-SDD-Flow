import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  CLAUDE_REVIEWER_CANONICAL_SOURCE_PATH,
  CLAUDE_REVIEWER_RUNTIME_TARGET_PATH,
  CODEX_REVIEWER_CANONICAL_SOURCE_PATH,
  CODEX_REVIEWER_RUNTIME_TARGET_PATH,
  CURSOR_REVIEWER_CANONICAL_SOURCE_PATH,
  CURSOR_REVIEWER_RUNTIME_TARGET_PATH,
  REVIEWER_SHARED_CORE_BASE_PROMPT_PATH,
  REVIEWER_SHARED_CORE_METADATA_PATH,
  REVIEWER_SHARED_CORE_PROFILE_PACK_PATH,
} from './reviewer-contract';

export type ReviewerRuntimeHostId = 'cursor' | 'claude' | 'codex';

export interface ReviewerRuntimeDefinitionReceipt {
  host: ReviewerRuntimeHostId;
  targetPath: string;
  sourceRelativePath?: string;
  updated: boolean;
  skippedReason?: string;
}

function sourceRelativePath(host: ReviewerRuntimeHostId): string {
  if (host === 'cursor') return CURSOR_REVIEWER_CANONICAL_SOURCE_PATH;
  if (host === 'codex') return CODEX_REVIEWER_CANONICAL_SOURCE_PATH;
  return CLAUDE_REVIEWER_CANONICAL_SOURCE_PATH;
}

function targetRelativePath(host: ReviewerRuntimeHostId): string {
  if (host === 'cursor') return CURSOR_REVIEWER_RUNTIME_TARGET_PATH;
  if (host === 'codex') return CODEX_REVIEWER_RUNTIME_TARGET_PATH;
  return CLAUDE_REVIEWER_RUNTIME_TARGET_PATH;
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
    ` shared_metadata=${REVIEWER_SHARED_CORE_METADATA_PATH}` +
    ` shared_profiles=${REVIEWER_SHARED_CORE_PROFILE_PACK_PATH}` +
    ` shared_prompt=${REVIEWER_SHARED_CORE_BASE_PROMPT_PATH} -->`;

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

export function materializeReviewerDefinition(
  projectRoot: string,
  host: ReviewerRuntimeHostId
): ReviewerRuntimeDefinitionReceipt {
  const targetPath = path.join(projectRoot, targetRelativePath(host));
  const sourceRelative = sourceRelativePath(host);
  const sourcePath = path.join(projectRoot, sourceRelative);

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

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const previous = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, 'utf8') : null;
  if (previous === materialized) {
    return {
      host,
      targetPath,
      sourceRelativePath: sourceRelative,
      updated: false,
    };
  }

  fs.writeFileSync(targetPath, materialized, 'utf8');
  return {
    host,
    targetPath,
    sourceRelativePath: sourceRelative,
    updated: true,
  };
}

export function ensureReviewerRuntimeDefinition(
  projectRoot: string,
  options?: { hosts?: ReviewerRuntimeHostId[] }
): ReviewerRuntimeDefinitionReceipt[] {
  const hosts = options?.hosts ?? (['cursor', 'claude', 'codex'] as ReviewerRuntimeHostId[]);
  return hosts.map((host) => {
    const runtimeDir =
      host === 'cursor'
        ? path.join(projectRoot, '.cursor', 'agents')
        : host === 'codex'
          ? path.join(projectRoot, '.codex', 'agents')
        : path.join(projectRoot, '.claude', 'agents');
    if (!fs.existsSync(runtimeDir)) {
      return {
        host,
        targetPath: path.join(projectRoot, targetRelativePath(host)),
        updated: false,
        skippedReason: `runtime dir missing: ${path.relative(projectRoot, runtimeDir).replace(/\\/g, '/')}`,
      };
    }
    return materializeReviewerDefinition(projectRoot, host);
  });
}
