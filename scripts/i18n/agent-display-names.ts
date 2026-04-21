import * as fs from 'node:fs';
import * as path from 'node:path';
import Ajv from 'ajv';
import * as yaml from 'js-yaml';
import {
  readAgentManifestRow,
  type AgentManifestRow,
  DEFAULT_AGENT_MANIFEST_RELATIVE_PATH,
} from './agent-manifest';

export const DEFAULT_AGENT_DISPLAY_NAMES_REGISTRY_PATH =
  '_bmad/i18n/agent-display-names.yaml' as const;

export type AgentDisplayResolvedMode = 'zh' | 'en' | 'bilingual';

export interface AgentDisplayLocaleFields {
  zh?: string;
  en?: string;
}

export interface AgentDisplayRegistryEntry {
  displayName?: AgentDisplayLocaleFields;
  title?: AgentDisplayLocaleFields;
}

export interface AgentDisplayNamesRegistry {
  version: 1;
  agents: Record<string, AgentDisplayRegistryEntry>;
}

export interface LocalizedAgentDisplayProfile {
  agentId: string;
  icon: string;
  displayName: string;
  title: string;
  source: 'registry' | 'manifest-fallback' | 'registry+manifest-fallback';
}

const REGISTRY_SCHEMA = {
  type: 'object',
  required: ['version', 'agents'],
  additionalProperties: false,
  properties: {
    version: { const: 1 },
    agents: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        additionalProperties: false,
        properties: {
          displayName: {
            type: 'object',
            additionalProperties: false,
            properties: {
              zh: { type: 'string', minLength: 1 },
              en: { type: 'string', minLength: 1 },
            },
          },
          title: {
            type: 'object',
            additionalProperties: false,
            properties: {
              zh: { type: 'string', minLength: 1 },
              en: { type: 'string', minLength: 1 },
            },
          },
        },
      },
    },
  },
} as const;

const ajv = new Ajv({ allErrors: true });
const validateRegistry = ajv.compile(REGISTRY_SCHEMA);

function loadRegistryDocument(projectRoot: string, registryPath: string): unknown {
  const resolvedPath = path.join(projectRoot, registryPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Agent display registry not found: ${resolvedPath}`);
  }
  return yaml.load(fs.readFileSync(resolvedPath, 'utf8'));
}

function normalizeLocalizedValue(value: string | undefined): string | undefined {
  if (value == null) {
    return undefined;
  }
  const normalized = value.trim();
  return normalized === '' ? undefined : normalized;
}

export function readAgentDisplayNamesRegistry(
  projectRoot: string,
  registryPath: string = DEFAULT_AGENT_DISPLAY_NAMES_REGISTRY_PATH
): AgentDisplayNamesRegistry {
  const parsed = loadRegistryDocument(projectRoot, registryPath);
  if (!validateRegistry(parsed)) {
    const detail = ajv.errorsText(validateRegistry.errors, { separator: '; ' });
    throw new Error(`Invalid agent display registry: ${detail}`);
  }
  return parsed as AgentDisplayNamesRegistry;
}

function resolveLocalizedField(
  localized: AgentDisplayLocaleFields | undefined,
  fallback: string,
  resolvedMode: AgentDisplayResolvedMode
): { value: string; usedFallback: boolean } {
  const zhValue = normalizeLocalizedValue(localized?.zh);
  const enValue = normalizeLocalizedValue(localized?.en);
  const zh = zhValue ?? fallback;
  const en = enValue ?? fallback;

  if (resolvedMode === 'zh') {
    return { value: zh, usedFallback: zhValue == null };
  }
  if (resolvedMode === 'en') {
    return { value: en, usedFallback: enValue == null };
  }
  return {
    value: `${zh} / ${en}`,
    usedFallback: zhValue == null || enValue == null,
  };
}

function resolveSourceLabel(
  entryExists: boolean,
  displayNameUsedFallback: boolean,
  titleUsedFallback: boolean
): LocalizedAgentDisplayProfile['source'] {
  if (!entryExists) {
    return 'manifest-fallback';
  }
  if (displayNameUsedFallback || titleUsedFallback) {
    return 'registry+manifest-fallback';
  }
  return 'registry';
}

export function resolveLocalizedAgentDisplayProfile(
  projectRoot: string,
  agentId: string,
  resolvedMode: AgentDisplayResolvedMode,
  options?: {
    registryPath?: string;
    manifestPath?: string;
  }
): LocalizedAgentDisplayProfile {
  const manifestRow = readAgentManifestRow(
    projectRoot,
    agentId,
    options?.manifestPath ?? DEFAULT_AGENT_MANIFEST_RELATIVE_PATH
  );
  if (!manifestRow) {
    throw new Error(`Agent manifest entry not found for agentId=${agentId}`);
  }

  let entry: AgentDisplayRegistryEntry | undefined;
  try {
    const registry = readAgentDisplayNamesRegistry(
      projectRoot,
      options?.registryPath ?? DEFAULT_AGENT_DISPLAY_NAMES_REGISTRY_PATH
    );
    entry = registry.agents[agentId];
  } catch {
    entry = undefined;
  }

  return buildLocalizedAgentDisplayProfile(manifestRow, entry, resolvedMode);
}

export function buildLocalizedAgentDisplayProfile(
  manifestRow: AgentManifestRow,
  entry: AgentDisplayRegistryEntry | undefined,
  resolvedMode: AgentDisplayResolvedMode
): LocalizedAgentDisplayProfile {
  const displayName = resolveLocalizedField(entry?.displayName, manifestRow.displayName, resolvedMode);
  const title = resolveLocalizedField(entry?.title, manifestRow.title, resolvedMode);

  return {
    agentId: manifestRow.name,
    icon: manifestRow.icon,
    displayName: displayName.value,
    title: title.value,
    source: resolveSourceLabel(entry != null, displayName.usedFallback, title.usedFallback),
  };
}
