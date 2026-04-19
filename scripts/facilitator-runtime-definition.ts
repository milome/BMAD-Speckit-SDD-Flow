import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  CLAUDE_FACILITATOR_TARGET_PATH,
  CURSOR_FACILITATOR_DEFINITION_SOURCE_PATH,
} from './reviewer-contract';
import type { FacilitatorHostId } from './facilitator-registry';
import { resolveFacilitatorRuntimeBindings } from './facilitator-registry';

export type FacilitatorMaterializedMode = 'base' | 'zh' | 'en' | 'bilingual';

export interface FacilitatorRuntimeDefinitionReceipt {
  host: FacilitatorHostId;
  mode: FacilitatorMaterializedMode;
  targetPath: string;
  sourceRelativePath?: string;
  updated: boolean;
  skippedReason?: string;
}

function runtimeTargetRelativePath(host: FacilitatorHostId): string {
  return host === 'cursor'
    ? CURSOR_FACILITATOR_DEFINITION_SOURCE_PATH
    : CLAUDE_FACILITATOR_TARGET_PATH;
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
    /* ignore malformed runtime context */
  }
  return 'base';
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

function stripExistingGeneratedHeader(content: string): string {
  return content.replace(
    /<!-- RUNTIME-MATERIALIZED facilitator[\s\S]*? -->\r?\n?/u,
    ''
  );
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

function resolveRuntimeBindings(
  projectRoot: string,
  host: FacilitatorHostId,
  mode: FacilitatorMaterializedMode
) {
  if (mode === 'base') {
    const facilitator =
      host === 'cursor'
        ? '_bmad/cursor/agents/party-mode-facilitator.md'
        : '_bmad/claude/agents/party-mode-facilitator.md';
    return {
      facilitator: { resolvedRelativePath: facilitator },
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

  return resolveFacilitatorRuntimeBindings(projectRoot, host, mode);
}

export function materializeFacilitatorDefinition(
  projectRoot: string,
  host: FacilitatorHostId,
  mode: FacilitatorMaterializedMode
): FacilitatorRuntimeDefinitionReceipt {
  const targetRelativePath = runtimeTargetRelativePath(host);
  const targetPath = path.join(projectRoot, targetRelativePath);

  const bindings = resolveRuntimeBindings(projectRoot, host, mode);
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
  const rewritten = rewriteCanonicalBindings(stripExistingGeneratedHeader(source), {
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

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
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

  fs.writeFileSync(targetPath, materialized, 'utf8');
  return {
    host,
    mode,
    targetPath,
    sourceRelativePath: bindings.facilitator.resolvedRelativePath,
    updated: true,
  };
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
    const runtimeDir =
      host === 'cursor'
        ? path.join(projectRoot, '.cursor', 'agents')
        : path.join(projectRoot, '.claude', 'agents');
    if (!fs.existsSync(runtimeDir)) {
      return {
        host,
        mode,
        targetPath: path.join(projectRoot, runtimeTargetRelativePath(host)),
        updated: false,
        skippedReason: `runtime dir missing: ${path.relative(projectRoot, runtimeDir).replace(/\\/g, '/')}`,
      };
    }
    return materializeFacilitatorDefinition(projectRoot, host, mode);
  });
}
