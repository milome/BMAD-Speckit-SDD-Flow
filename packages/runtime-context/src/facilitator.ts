import * as fs from 'node:fs';
import * as path from 'node:path';

export type FacilitatorHostId = 'cursor' | 'claude';
export type FacilitatorMaterializedMode = 'base' | 'zh' | 'en' | 'bilingual';

export interface FacilitatorRuntimeDefinitionReceipt {
  host: FacilitatorHostId;
  mode: FacilitatorMaterializedMode;
  targetPath: string;
  sourceRelativePath?: string;
  updated: boolean;
  skippedReason?: string;
}

const CURSOR_SOURCE = '_bmad/cursor/agents/party-mode-facilitator.md' as const;
const CLAUDE_SOURCE = '_bmad/claude/agents/party-mode-facilitator.md' as const;
const CURSOR_TARGET = '.cursor/agents/party-mode-facilitator.md' as const;
const CLAUDE_TARGET = '.claude/agents/party-mode-facilitator.md' as const;

function sourceRelativePath(host: FacilitatorHostId): string {
  return host === 'cursor' ? CURSOR_SOURCE : CLAUDE_SOURCE;
}

function targetRelativePath(host: FacilitatorHostId): string {
  return host === 'cursor' ? CURSOR_TARGET : CLAUDE_TARGET;
}

function resolveLocalizedRelativePath(
  relativePath: string,
  mode: FacilitatorMaterializedMode
): string {
  if (mode === 'base') {
    return relativePath;
  }
  if (mode === 'en') {
    return relativePath.replace(/\.md$/i, '.en.md');
  }
  return relativePath.replace(/\.md$/i, '.zh.md');
}

function injectGeneratedHeader(
  content: string,
  metadata: {
    mode: FacilitatorMaterializedMode;
    sourceRelativePath: string;
    workflowRelativePath: string;
    step01RelativePath: string;
    step02RelativePath: string;
    step03RelativePath: string;
  }
): string {
  const separator = content.includes('\r\n') ? '\r\n' : '\n';
  const header =
    `<!-- RUNTIME-MATERIALIZED facilitator resolvedMode=${metadata.mode}` +
    ` source=${metadata.sourceRelativePath}` +
    ` workflow=${metadata.workflowRelativePath}` +
    ` step01=${metadata.step01RelativePath}` +
    ` step02=${metadata.step02RelativePath}` +
    ` step03=${metadata.step03RelativePath} -->`;

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
  return content.replace(/<!-- RUNTIME-MATERIALIZED facilitator[\s\S]*? -->\r?\n?/u, '');
}

function rewriteCanonicalBindings(
  content: string,
  replacements: {
    workflow: string;
    step01: string;
    step02: string;
    step03: string;
  }
): string {
  return content
    .replace(
      /_bmad\/core\/skills\/bmad-party-mode\/workflow(?:\.(?:zh|en))?\.md/gu,
      replacements.workflow
    )
    .replace(
      /_bmad\/core\/skills\/bmad-party-mode\/steps\/step-01-agent-loading(?:\.(?:zh|en))?\.md/gu,
      replacements.step01
    )
    .replace(
      /_bmad\/core\/skills\/bmad-party-mode\/steps\/step-02-discussion-orchestration(?:\.(?:zh|en))?\.md/gu,
      replacements.step02
    )
    .replace(
      /_bmad\/core\/skills\/bmad-party-mode\/steps\/step-03-graceful-exit(?:\.(?:zh|en))?\.md/gu,
      replacements.step03
    );
}

function detectMaterializedMode(
  projectRoot: string,
  explicitMode?: FacilitatorMaterializedMode
): FacilitatorMaterializedMode {
  if (explicitMode) {
    return explicitMode;
  }
  const ctxPath = path.join(projectRoot, '_bmad-output', 'runtime', 'context', 'project.json');
  if (!fs.existsSync(ctxPath)) {
    return 'base';
  }
  try {
    const raw = JSON.parse(fs.readFileSync(ctxPath, 'utf8')) as {
      languagePolicy?: { resolvedMode?: string };
    };
    const mode = raw?.languagePolicy?.resolvedMode;
    if (mode === 'zh' || mode === 'en' || mode === 'bilingual') {
      return mode;
    }
  } catch {
    /* ignore malformed context */
  }
  return 'base';
}

export function ensureFacilitatorRuntimeDefinition(
  projectRoot: string,
  options?: {
    mode?: FacilitatorMaterializedMode;
    hosts?: FacilitatorHostId[];
  }
): FacilitatorRuntimeDefinitionReceipt[] {
  const mode = detectMaterializedMode(projectRoot, options?.mode);
  const hosts = options?.hosts ?? (['cursor', 'claude'] as FacilitatorHostId[]);
  const workflow = resolveLocalizedRelativePath('_bmad/core/skills/bmad-party-mode/workflow.md', mode);
  const step01 = resolveLocalizedRelativePath(
    '_bmad/core/skills/bmad-party-mode/steps/step-01-agent-loading.md',
    mode
  );
  const step02 = resolveLocalizedRelativePath(
    '_bmad/core/skills/bmad-party-mode/steps/step-02-discussion-orchestration.md',
    mode
  );
  const step03 = resolveLocalizedRelativePath(
    '_bmad/core/skills/bmad-party-mode/steps/step-03-graceful-exit.md',
    mode
  );

  return hosts.map((host) => {
    const targetPath = path.join(projectRoot, targetRelativePath(host));
    const runtimeDir = path.dirname(targetPath);
    if (!fs.existsSync(runtimeDir)) {
      return {
        host,
        mode,
        targetPath,
        updated: false,
        skippedReason: `runtime dir missing: ${path.relative(projectRoot, runtimeDir).replace(/\\/g, '/')}`,
      };
    }
    if (mode === 'base') {
      return {
        host,
        mode,
        targetPath,
        updated: false,
        skippedReason: 'no languagePolicy.resolvedMode available',
      };
    }
    const sourceRelative = resolveLocalizedRelativePath(sourceRelativePath(host), mode);
    const sourcePath = path.join(projectRoot, sourceRelative);
    if (!fs.existsSync(sourcePath)) {
      return {
        host,
        mode,
        targetPath,
        updated: false,
        skippedReason: `source asset missing: ${sourceRelative}`,
      };
    }

    const source = fs.readFileSync(sourcePath, 'utf8');
    const materialized = injectGeneratedHeader(
      rewriteCanonicalBindings(stripGeneratedHeader(source), {
        workflow,
        step01,
        step02,
        step03,
      }),
      {
        mode,
        sourceRelativePath: sourceRelative,
        workflowRelativePath: workflow,
        step01RelativePath: step01,
        step02RelativePath: step02,
        step03RelativePath: step03,
      }
    );
    const previous = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, 'utf8') : null;
    if (previous === materialized) {
      return {
        host,
        mode,
        targetPath,
        sourceRelativePath: sourceRelative,
        updated: false,
      };
    }

    fs.mkdirSync(runtimeDir, { recursive: true });
    fs.writeFileSync(targetPath, materialized, 'utf8');
    return {
      host,
      mode,
      targetPath,
      sourceRelativePath: sourceRelative,
      updated: true,
    };
  });
}
