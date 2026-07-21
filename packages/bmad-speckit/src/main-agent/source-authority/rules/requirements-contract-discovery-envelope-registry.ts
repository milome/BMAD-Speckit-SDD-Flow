export const REQUIREMENTS_CONTRACT_DISCOVERY_ENVELOPE_REGISTRY_OWNER_PATH =
  'packages/bmad-speckit/src/main-agent/source-authority/rules/requirements-contract-discovery-envelope-registry.ts';

const OWNER_PATH =
  '_bmad/core/tasks/bmad-create-prd/templates/prd-template.md';

export const REQUIREMENTS_CONTRACT_DISCOVERY_ENVELOPE_REGISTRY = {
  schemaVersion: 'requirements-contract-discovery-envelope-registry/v1',
  templateSchemaVersion: 'requirements-contract-discovery-envelope/v1',
  artifactRole: 'discovery_envelope',
  ownerPath: OWNER_PATH,
  surfacePaths: [
    OWNER_PATH,
    '_bmad/bmm/workflows/2-plan-workflows/create-prd/templates/prd-template.md',
    '_bmad/bmm/workflows/2-plan-workflows/bmad-create-prd/templates/prd-template.md',
    '.codex/skills/bmad-create-prd/templates/prd-template.md',
    '.cursor/skills/bmad-create-prd/templates/prd-template.md',
    '.claude/skills/bmad-create-prd/templates/prd-template.md',
    'packages/bmad-speckit/_bmad/core/tasks/bmad-create-prd/templates/prd-template.md',
    'packages/bmad-speckit/_bmad/bmm/workflows/2-plan-workflows/create-prd/templates/prd-template.md',
    'packages/bmad-speckit/_bmad/bmm/workflows/2-plan-workflows/bmad-create-prd/templates/prd-template.md',
    'packages/bmad-speckit/.cursor/skills/bmad-create-prd/templates/prd-template.md',
  ],
  manifestBindings: [
    {
      manifestPath: '_bmad/_config/files-manifest.csv',
      declaredPath:
        'bmm/workflows/2-plan-workflows/create-prd/templates/prd-template.md',
    },
    {
      manifestPath:
        'packages/bmad-speckit/_bmad/_config/files-manifest.csv',
      declaredPath:
        'bmm/workflows/2-plan-workflows/create-prd/templates/prd-template.md',
    },
  ],
  requiredFragments: [
    'templateSchemaVersion: requirements-contract-discovery-envelope/v1',
    'artifactRole: discovery_envelope',
    'authority: none',
    'discoveryState: in_progress',
    '## Input References',
    '## Discovery Transcript References',
    '## Semantic Candidate References',
    '## Open Decisions',
    '## Materialization Handoff',
  ],
  forbiddenFragments: [
    'implementationConfirmation',
    'currentTargetMap',
    'traceRows:',
    'authoritativeImplementationSource: true',
  ],
  authority: 'none',
} as const;
