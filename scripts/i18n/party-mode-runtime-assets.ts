import * as path from 'node:path';
import {
  resolveLocalizedMarkdownPath,
  type LocalizedMarkdownResolvedMode,
  type LocalizedMarkdownVariant,
} from './resolve-localized-markdown-path';
import {
  resolveLocalizedAgentDisplayProfile,
  type LocalizedAgentDisplayProfile,
} from './agent-display-names';

export type PartyModeCanonicalAssetId =
  | 'workflow'
  | 'step-01-agent-loading'
  | 'step-02-discussion-orchestration'
  | 'step-03-graceful-exit';

export type FacilitatorHostId = 'cursor' | 'claude';

const PARTY_MODE_CANONICAL_ROOT = '_bmad/core/skills/bmad-party-mode' as const;
const PARTY_MODE_CURSOR_OVERRIDE_ROOT = '_bmad/cursor/skills/bmad-party-mode' as const;
const CANONICAL_ASSET_RELATIVE_PATHS: Record<PartyModeCanonicalAssetId, string> = {
  workflow: `${PARTY_MODE_CANONICAL_ROOT}/workflow.md`,
  'step-01-agent-loading': `${PARTY_MODE_CANONICAL_ROOT}/steps/step-01-agent-loading.md`,
  'step-02-discussion-orchestration': `${PARTY_MODE_CANONICAL_ROOT}/steps/step-02-discussion-orchestration.md`,
  'step-03-graceful-exit': `${PARTY_MODE_CANONICAL_ROOT}/steps/step-03-graceful-exit.md`,
};
const CURSOR_OVERRIDE_ASSET_RELATIVE_PATHS: Partial<Record<PartyModeCanonicalAssetId, string>> = {
  'step-02-discussion-orchestration': `${PARTY_MODE_CURSOR_OVERRIDE_ROOT}/steps/step-02-discussion-orchestration.md`,
};

const FACILITATOR_SOURCE_RELATIVE_PATHS: Record<FacilitatorHostId, string> = {
  cursor: '_bmad/cursor/agents/party-mode-facilitator.md',
  claude: '_bmad/claude/agents/party-mode-facilitator.md',
};

export interface LocalizedMarkdownAssetResolution {
  baseRelativePath: string;
  resolvedRelativePath: string;
  usedFallback: boolean;
  variant: LocalizedMarkdownVariant;
}

function toPosix(value: string): string {
  return value.replace(/\\/g, '/');
}

function resolveRelativeMarkdownAsset(
  projectRoot: string,
  relativePath: string,
  resolvedMode: LocalizedMarkdownResolvedMode
): LocalizedMarkdownAssetResolution {
  const resolved = resolveLocalizedMarkdownPath({
    basePath: path.join(projectRoot, relativePath),
    resolvedMode,
  });

  return {
    baseRelativePath: toPosix(relativePath),
    resolvedRelativePath: toPosix(path.relative(projectRoot, resolved.resolvedPath)),
    usedFallback: resolved.usedFallback,
    variant: resolved.variant,
  };
}

export function resolveCanonicalPartyModeAsset(
  projectRoot: string,
  assetId: PartyModeCanonicalAssetId,
  resolvedMode: LocalizedMarkdownResolvedMode
): LocalizedMarkdownAssetResolution {
  return resolveRelativeMarkdownAsset(
    projectRoot,
    CANONICAL_ASSET_RELATIVE_PATHS[assetId],
    resolvedMode
  );
}

export function resolveCursorPartyModeAsset(
  projectRoot: string,
  assetId: PartyModeCanonicalAssetId,
  resolvedMode: LocalizedMarkdownResolvedMode
): LocalizedMarkdownAssetResolution {
  const relativePath = CURSOR_OVERRIDE_ASSET_RELATIVE_PATHS[assetId];
  if (!relativePath) {
    return resolveCanonicalPartyModeAsset(projectRoot, assetId, resolvedMode);
  }
  return resolveRelativeMarkdownAsset(projectRoot, relativePath, resolvedMode);
}

export function resolveFacilitatorSourceAsset(
  projectRoot: string,
  host: FacilitatorHostId,
  resolvedMode: LocalizedMarkdownResolvedMode
): LocalizedMarkdownAssetResolution {
  return resolveRelativeMarkdownAsset(
    projectRoot,
    FACILITATOR_SOURCE_RELATIVE_PATHS[host],
    resolvedMode
  );
}

export function resolvePartyModeSpeakerProfile(
  projectRoot: string,
  agentId: string,
  resolvedMode: LocalizedMarkdownResolvedMode
): LocalizedAgentDisplayProfile {
  return resolveLocalizedAgentDisplayProfile(projectRoot, agentId, resolvedMode);
}
