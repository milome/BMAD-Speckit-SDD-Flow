import {
  CLAUDE_FACILITATOR_AGENT_MENTION,
  CLAUDE_FACILITATOR_TARGET_PATH,
  CURSOR_FACILITATOR_DEFINITION_SOURCE_PATH,
  FACILITATOR_DISPLAY_NAME,
  FACILITATOR_PRODUCT_IDENTITY,
} from './reviewer-contract';
import {
  resolveCanonicalPartyModeAsset,
  resolveFacilitatorSourceAsset,
} from './i18n/party-mode-runtime-assets';
import type { LocalizedMarkdownResolvedMode } from './i18n/resolve-localized-markdown-path';

export const FACILITATOR_REGISTRY_VERSION = 'facilitator_registry_v1' as const;

export type FacilitatorHostId = 'cursor' | 'claude';
export type FacilitatorRouteTool = 'cursor-task' | 'mcp_task' | 'Agent';

export interface FacilitatorRoute {
  tool: FacilitatorRouteTool;
  subtypeOrExecutor: string;
}

export interface FacilitatorHostRegistration {
  preferredRoute: FacilitatorRoute;
  fallbackRoute: FacilitatorRoute;
}

export interface FacilitatorRegistration {
  identity: typeof FACILITATOR_PRODUCT_IDENTITY;
  displayName: typeof FACILITATOR_DISPLAY_NAME;
  registryVersion: typeof FACILITATOR_REGISTRY_VERSION;
  cursorDefinitionSourcePath: typeof CURSOR_FACILITATOR_DEFINITION_SOURCE_PATH;
  claudeTarget: {
    agentPath: typeof CLAUDE_FACILITATOR_TARGET_PATH;
    agentMention: typeof CLAUDE_FACILITATOR_AGENT_MENTION;
  };
  hosts: Record<FacilitatorHostId, FacilitatorHostRegistration>;
}

export const FACILITATOR_REGISTRY: FacilitatorRegistration = {
  identity: FACILITATOR_PRODUCT_IDENTITY,
  displayName: FACILITATOR_DISPLAY_NAME,
  registryVersion: FACILITATOR_REGISTRY_VERSION,
  cursorDefinitionSourcePath: CURSOR_FACILITATOR_DEFINITION_SOURCE_PATH,
  claudeTarget: {
    agentPath: CLAUDE_FACILITATOR_TARGET_PATH,
    agentMention: CLAUDE_FACILITATOR_AGENT_MENTION,
  },
  hosts: {
    cursor: {
      preferredRoute: {
        tool: 'mcp_task',
        subtypeOrExecutor: 'generalPurpose',
      },
      fallbackRoute: {
        tool: 'cursor-task',
        subtypeOrExecutor: FACILITATOR_DISPLAY_NAME,
      },
    },
    claude: {
      preferredRoute: {
        tool: 'Agent',
        subtypeOrExecutor: CLAUDE_FACILITATOR_AGENT_MENTION,
      },
      fallbackRoute: {
        tool: 'Agent',
        subtypeOrExecutor: 'general-purpose',
      },
    },
  },
};

export function getFacilitatorRegistration(): FacilitatorRegistration {
  return FACILITATOR_REGISTRY;
}

export function resolveFacilitatorRuntimeBindings(
  projectRoot: string,
  host: FacilitatorHostId,
  resolvedMode: LocalizedMarkdownResolvedMode
) {
  return {
    facilitator: resolveFacilitatorSourceAsset(projectRoot, host, resolvedMode),
    workflow: resolveCanonicalPartyModeAsset(projectRoot, 'workflow', resolvedMode),
    step01: resolveCanonicalPartyModeAsset(projectRoot, 'step-01-agent-loading', resolvedMode),
    step02: resolveCanonicalPartyModeAsset(
      projectRoot,
      'step-02-discussion-orchestration',
      resolvedMode
    ),
    step03: resolveCanonicalPartyModeAsset(projectRoot, 'step-03-graceful-exit', resolvedMode),
  };
}
