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

function resolveRuntimeBindings(host: FacilitatorHostId, mode: FacilitatorMaterializedMode) {
  if (mode === 'base') {
    return {
      facilitator: {
        resolvedRelativePath:
          host === 'cursor'
            ? '_bmad/cursor/agents/party-mode-facilitator.md'
            : '_bmad/claude/agents/party-mode-facilitator.md',
      },
      workflow: { resolvedRelativePath: '_bmad/core/skills/bmad-party-mode/workflow.md' },
      step01: {
        resolvedRelativePath: '_bmad/core/skills/bmad-party-mode/steps/step-01-agent-loading.md',
      },
      step02: {
        resolvedRelativePath:
          '_bmad/core/skills/bmad-party-mode/steps/step-02-discussion-orchestration.md',
      },
      step03: {
        resolvedRelativePath: '_bmad/core/skills/bmad-party-mode/steps/step-03-graceful-exit.md',
      },
    };
  }

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

  return {
    facilitator: { resolvedRelativePath: resolveLocalizedRelativePath(sourceRelativePath(host), mode) },
    workflow: { resolvedRelativePath: workflow },
    step01: { resolvedRelativePath: step01 },
    step02: { resolvedRelativePath: step02 },
    step03: { resolvedRelativePath: step03 },
  };
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
  return hosts.map((host) => {
    const bindings = resolveRuntimeBindings(host, mode);
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
    const sourcePath = path.join(projectRoot, bindings.facilitator.resolvedRelativePath);
    if (!fs.existsSync(sourcePath)) {
      return {
        host,
        mode,
        targetPath,
        updated: false,
        skippedReason: `source asset missing: ${bindings.facilitator.resolvedRelativePath}`,
      };
    }

    const source = fs.readFileSync(sourcePath, 'utf8');
    const rewritten = rewriteCanonicalBindings(stripGeneratedHeader(source), {
      workflow: bindings.workflow.resolvedRelativePath,
      step01: bindings.step01.resolvedRelativePath,
      step02: bindings.step02.resolvedRelativePath,
      step03: bindings.step03.resolvedRelativePath,
    });
    const materialized =
      mode === 'base'
        ? rewritten
        : injectGeneratedHeader(rewritten, {
            mode,
            sourceRelativePath: bindings.facilitator.resolvedRelativePath,
            workflowRelativePath: bindings.workflow.resolvedRelativePath,
            step01RelativePath: bindings.step01.resolvedRelativePath,
            step02RelativePath: bindings.step02.resolvedRelativePath,
            step03RelativePath: bindings.step03.resolvedRelativePath,
          });
    const previous = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, 'utf8') : null;
    if (previous === materialized) {
      return {
        host,
        mode,
        targetPath,
        sourceRelativePath: bindings.facilitator.resolvedRelativePath,
        updated: false,
      };
    }

    fs.mkdirSync(runtimeDir, { recursive: true });
    fs.writeFileSync(targetPath, materialized, 'utf8');
    return {
      host,
      mode,
      targetPath,
      sourceRelativePath: bindings.facilitator.resolvedRelativePath,
      updated: true,
    };
  });
}
