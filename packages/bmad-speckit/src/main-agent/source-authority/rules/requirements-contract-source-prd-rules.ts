export interface RequirementsContractSourcePrdRules {
  templatePath: string;
  requiredHeadings: string[];
  requiredFragments: string[];
  forbiddenFragments: string[];
  allowedRequirementBearingSections: string[];
  projectionSupportingSections: string[];
  nonRequirementBearingSections: string[];
  generatedProjectionSections: string[];
  deniedCanonicalMustIdPatterns: string[];
  separationFragments: string[];
  canonicalContractFields: string[];
  sourceProjectionRequiredFields: string[];
  finalSchemaForbiddenFragments: string[];
  requiredTableColumns: Record<string, string[]>;
  semanticForbiddenFragments: string[];
  rendererReadinessSections: string[];
  sourceMetadataFields: string[];
  stableIdPrefixes: string[];
}

const REQUIREMENTS_CONTRACT_SOURCE_AUTHORITY_ROOT =
  'packages/bmad-speckit/src/main-agent/source-authority';
const REQUIREMENTS_CONTRACT_SOURCE_PRD_TEMPLATE_RELATIVE_PATH =
  'templates/requirements-contract-source-prd-template.md';
const REQUIREMENTS_CONTRACT_SOURCE_PRD_SCHEMA_RELATIVE_PATH =
  'templates/requirements-contract-source-prd-template.schema.json';

export const REQUIREMENTS_CONTRACT_SOURCE_PRD_ARTIFACT_ROLE =
  'requirement_source_prd';
export const REQUIREMENTS_CONTRACT_SOURCE_PRD_TEMPLATE_OWNER_PATH =
  `${REQUIREMENTS_CONTRACT_SOURCE_AUTHORITY_ROOT}/${REQUIREMENTS_CONTRACT_SOURCE_PRD_TEMPLATE_RELATIVE_PATH}`;
export const REQUIREMENTS_CONTRACT_SOURCE_PRD_SCHEMA_OWNER_PATH =
  `${REQUIREMENTS_CONTRACT_SOURCE_AUTHORITY_ROOT}/${REQUIREMENTS_CONTRACT_SOURCE_PRD_SCHEMA_RELATIVE_PATH}`;
export const REQUIREMENTS_CONTRACT_SOURCE_PRD_TEMPLATE_SURFACE_PATHS = [
  REQUIREMENTS_CONTRACT_SOURCE_PRD_TEMPLATE_OWNER_PATH,
  'packages/bmad-speckit/dist/main-agent/source-authority/templates/requirements-contract-source-prd-template.md',
] as const;
export const REQUIREMENTS_CONTRACT_SOURCE_PRD_SCHEMA_SURFACE_PATHS = [
  REQUIREMENTS_CONTRACT_SOURCE_PRD_SCHEMA_OWNER_PATH,
  'packages/bmad-speckit/dist/main-agent/source-authority/templates/requirements-contract-source-prd-template.schema.json',
] as const;

export const REQUIREMENTS_CONTRACT_SOURCE_PRD_RULES: RequirementsContractSourcePrdRules = {
  templatePath: REQUIREMENTS_CONTRACT_SOURCE_PRD_TEMPLATE_RELATIVE_PATH,
  requiredHeadings: [
    '# Requirements Contract Source PRD Template',
    '## Template Authority',
    '## Source Metadata',
    '## Requirement Extraction Boundary',
    '## Requirement Projection Authority',
    '## Renderer Field Source Schema',
    '## Non-Requirement-Bearing Provenance Reference',
    '## Product Context',
    '## Success Criteria',
    '## In Scope',
    '## Out Of Scope',
    '## User Journeys',
    '## Functional Requirements',
    '## Non-Functional Requirements',
    '## Negative Requirements And Not Done Conditions',
    '## Architecture Decision Records',
    '## Failure Matrix',
    '## Acceptance Evidence',
    '## Test And Verification Paths',
    '## Trace Matrix Source',
    '## Implementation Path Map',
    '## Source Current State',
    '## Source Target State',
    '## Current Target Map',
    '## Source-to-Contract Projection Map',
    '## Human-Readable ID-Bound Views',
    '## Revision History',
    '## Validation Provenance',
    '## Audit Findings',
    '## Comments',
    '## Change Log',
  ],
  requiredFragments: [
    'authoritativeImplementationSource: true',
    'sourceKind: requirements_contract_source_prd',
    'status: draft',
    'mustSources:',
    'projectedIdPattern: "^MUST-FR-[0-9]{3}$"',
    'projectedIdPattern: "^MUST-NFR-[0-9]{3}$"',
    'projectionSupportingSections:',
    'deniedCanonicalMustIdPatterns:',
    '^MUST-.*-L[0-9]+-[0-9]+$',
    'requiredViewPacks:',
    'currentSectionHeadings: ["Source Current State"]',
    'targetSectionHeadings: ["Source Target State"]',
    'currentSummary:',
    'targetSummary:',
    'diffRows:',
    'rendererFieldSourceSchema:',
    'renderedFields:',
    'canonicalMustList:',
    'applicabilityDomains:',
    'preConfirmationDrilldown:',
    'confirmationRender:',
    'requirementCreationAllowed: false',
    'traceRows:',
    'sourceToContractProjectionMap:',
    'finalField: currentTargetMap',
    'finalField: targetModificationPaths',
    'finalField: aiTddContractExecutionManifestProjection',
  ],
  forbiddenFragments: [
    'status: user_confirmed',
    'implementationReadiness: true',
    'sourceKind: sidecar_contract',
    'sourceKind: amendment',
    'sourceKind: conversation_prompt',
    'schemaVersion: requirements-contract-source/v1',
  ],
  allowedRequirementBearingSections: [
    'Functional Requirements',
    'Non-Functional Requirements',
    'Negative Requirements And Not Done Conditions',
    'Out Of Scope',
  ],
  projectionSupportingSections: [
    'Success Criteria',
    'In Scope',
    'User Journeys',
    'Architecture Decision Records',
    'Failure Matrix',
    'Acceptance Evidence',
    'Test And Verification Paths',
    'Implementation Path Map',
    'Source Current State',
    'Source Target State',
    'Current Target Map',
    'Trace Matrix Source',
  ],
  nonRequirementBearingSections: [
    'Template Authority',
    'Source Metadata',
    'Requirement Extraction Boundary',
    'Requirement Projection Authority',
    'Renderer Field Source Schema',
    'Source-to-Contract Projection Map',
    'Non-Requirement-Bearing Provenance Reference',
    'Revision History',
    'Validation Provenance',
    'Audit Findings',
    'Comments',
    'Change Log',
  ],
  generatedProjectionSections: ['Human-Readable ID-Bound Views'],
  deniedCanonicalMustIdPatterns: ['^MUST-.*-L[0-9]+-[0-9]+$'],
  separationFragments: [
    'It is not the confirmation schema and does not replace `_bmad/skills/requirements-contract-authoring/references/contract-template.md`.',
    '`_bmad/skills/requirements-contract-authoring/references/contract-template.md` defines the internal confirmation schema/reference used by the skill.',
  ],
  canonicalContractFields: [
    'contractSchemaVersion',
    'recordId',
    'requirementSetId',
    'entryFlow',
    'contractAuthoringRequired',
    'confirmationLanguage',
    'confirmationRender',
    'preConfirmationDrilldown',
    'applicability',
    'must',
    'notDone',
    'mustNot',
    'evidence',
    'acceptanceTests',
    'e2eSuites',
    'traceRows',
    'sequenceViews',
    'flowViews',
    'edgeCaseViews',
    'boundaryViews',
    'targetModificationPaths',
    'requirementBoundary',
    'currentTargetMap',
    'artifactAutomationPlan',
    'aiTddContractExecutionManifestProjection',
  ],
  sourceProjectionRequiredFields: [
    'contractSchemaVersion',
    'recordId',
    'requirementSetId',
    'entryFlow',
    'contractAuthoringRequired',
    'confirmationLanguage',
    'confirmationRender',
    'preConfirmationDrilldown',
    'applicability',
    'must',
    'notDone',
    'mustNot',
    'evidence',
    'acceptanceTests',
    'e2eSuites',
    'traceRows',
    'sequenceViews',
    'flowViews',
    'edgeCaseViews',
    'boundaryViews',
    'targetModificationPaths',
    'requirementBoundary',
    'currentTargetMap',
    'artifactAutomationPlan',
    'aiTddContractExecutionManifestProjection',
  ],
  finalSchemaForbiddenFragments: ['implementationConfirmation:', 'schemaVersion: requirements-contract-source/v1'],
  requiredTableColumns: {
    'Functional Requirements': ['Per-MUST oracle', 'Assertion source', 'Responsibility mapping'],
    'Non-Functional Requirements': ['Per-MUST oracle', 'Assertion source', 'Responsibility mapping'],
    'Acceptance Evidence': ['Oracle', 'Assertion source', 'Responsibility mapping'],
    'Test And Verification Paths': [
      'Per-MUST oracle',
      'Assertion source',
      'Responsibility mapping',
      'Target files',
    ],
    'Trace Matrix Source': [
      'Acceptance refs',
      'Per-MUST oracle',
      'Per-MUST closure assertion',
      'Responsibility mapping',
    ],
    'Implementation Path Map': ['Per-MUST oracle', 'Assertion source', 'Responsibility mapping'],
    'Current Target Map': ['Per-MUST oracle', 'Assertion source', 'Responsibility mapping'],
  },
  semanticForbiddenFragments: [
    'one row covers all MUST',
    'generic business visual',
    'generic currentTarget row',
    'keyword inferred current target',
  ],
  rendererReadinessSections: [
    'Business visual section',
    'Target modification path list',
    'Current versus target section',
    'Trace Matrix',
    'Evidence and Acceptance',
    'Negative and Not Done',
    'Scope Boundary',
    'AI-TDD manifest',
  ],
  sourceMetadataFields: [
    'id:',
    'title:',
    'status: draft',
    'authoritativeImplementationSource: true',
    'sourceKind: requirements_contract_source_prd',
    'classification:',
    'authoring:',
  ],
  stableIdPrefixes: ['FR', 'NFR', 'NEG', 'OUT', 'SC', 'UJ', 'ACC', 'E2E', 'CMD', 'TRACE', 'PATH', 'CUR', 'TGT', 'CTM'],
};

export const SOURCE_PRD_REQUIRED_SECTION_NAMES = REQUIREMENTS_CONTRACT_SOURCE_PRD_RULES.requiredHeadings.map(
  (heading) => heading.replace(/^#+\s*/u, '')
);

export const SOURCE_PRD_REQUIREMENT_BEARING_SECTIONS =
  REQUIREMENTS_CONTRACT_SOURCE_PRD_RULES.allowedRequirementBearingSections;

export const SOURCE_PRD_RULE_REGISTRY_VERSION = 'requirements-contract-source-prd-rules/v1';
