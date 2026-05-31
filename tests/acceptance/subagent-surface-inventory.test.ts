import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as crypto from 'node:crypto';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  runSubagentSurfaceInventory,
  subagentSurfaceInventoryInternals,
} from '../../scripts/subagent-surface-inventory';

const SOURCE_HASH = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';
const IMPLEMENTATION_HASH =
  'sha256:2222222222222222222222222222222222222222222222222222222222222222';
const ARCHITECTURE_HASH = 'sha256:3333333333333333333333333333333333333333333333333333333333333333';

function sha256Text(value: string): string {
  return `sha256:${crypto.createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function writeText(filePath: string, content: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf8');
}

function writeJson(filePath: string, value: unknown): void {
  writeText(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function registryRows(options: { unsafeEnvelope?: boolean; omitBmm?: boolean } = {}): string {
  return `
  subagentExecutionGovernance:
    subagentSurfaceInventoryPolicy:
      matchClasses:
        - code_dispatch_scripts
        - skill_and_workflow_markdown_subagent_mentions
        - bmm_bmb_bmad_research_authoring_review_workflows
        - tests_and_fixtures_that_model_subagent_behavior
      requiredInventoryRowFields:
        - surfacePath
        - matchPattern
        - matchedTextHash
        - surfaceKind
        - classification
        - registrySurfaceId
        - coverageStatus
        - explicitExclusionReason
        - exclusionReasonCode
        - canAffectControlFlow
        - requiredEnvelope
        - currentAttemptRevalidationRequired
        - ownerSubsystem
        - linkedRequirementIds
        - linkedEvidenceIds
        - scannerConfigHash
        - sourceDocumentHash
        - implementationConfirmationHash
        - architectureConfirmationHash
      failClosedWhen:
        - discovered subagent surface unregistered
        - canAffectControlFlow true but requiredEnvelope false
        - renderer or tests hardcode partial surface list as authority
  subagentExecutionSurfaceRegistry:
    - surfaceId: main_agent_codex_worker_adapter
      path: scripts/main-agent-codex-worker-adapter.ts
      surfaceType: no_hook_worker_adapter
      classification: control_worker
      canAffectControlFlow: true
      requiredEnvelope: ${options.unsafeEnvelope ? 'false' : 'true'}
      currentAttemptRevalidationRequired: true
      linkedRequirements:
        - MUST-045
    - surfaceId: standalone_task_skills
      path: _bmad/codex/skills/bmad-standalone-tasks/**
      surfaceType: skill_dispatch
      classification: control_worker
      canAffectControlFlow: true
      requiredEnvelope: true
      currentAttemptRevalidationRequired: true
      linkedRequirements:
        - MUST-045
${
  options.omitBmm
    ? ''
    : `    - surfaceId: upstream_product_brief_preview_agents
      path: _bmad/bmm/workflows/1-analysis/bmad-product-brief-preview/agents/**
      surfaceType: authoring_research_agents
      classification: authoring_assistant
      canAffectControlFlow: false
      requiredEnvelope: false
      currentAttemptRevalidationRequired: false
      linkedRequirements:
        - MUST-045
`
}
`;
}

function writeFixture(root: string, options: { unsafeEnvelope?: boolean; omitBmm?: boolean } = {}) {
  const sourcePath = path.join(root, 'docs', 'design', 'source.md');
  writeText(
    sourcePath,
    `# Source

implementationConfirmation:
  status: user_confirmed
  recordId: REQ-SUBAGENT
  requirementSetId: REQ-SUBAGENT
  sourceDocumentHash: ${SOURCE_HASH}
  implementationConfirmationHash: ${IMPLEMENTATION_HASH}
${registryRows(options)}
`
  );
  const recordPath = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    'REQ-SUBAGENT',
    'requirement-record.json'
  );
  writeJson(recordPath, {
    recordId: 'REQ-SUBAGENT',
    requirementSetId: 'REQ-SUBAGENT',
    status: 'user_confirmed',
    sourceDocumentHash: SOURCE_HASH,
    implementationConfirmationHash: IMPLEMENTATION_HASH,
    architectureConfirmationState: {
      status: 'active',
      currentArchitectureConfirmationHash: ARCHITECTURE_HASH,
    },
  });
  writeText(
    path.join(root, 'scripts', 'main-agent-codex-worker-adapter.ts'),
    'export const prompt = "Codex worker adapter requires subagent envelope";\n'
  );
  writeText(
    path.join(root, '_bmad', 'codex', 'skills', 'bmad-standalone-tasks', 'SKILL.md'),
    'Use Agent tool subagent for delegated execution.\n'
  );
  writeText(
    path.join(
      root,
      '_bmad',
      'bmm',
      'workflows',
      '1-analysis',
      'bmad-product-brief-preview',
      'agents',
      'web-researcher.md'
    ),
    'UTILIZE SUBPROCESSES AND SUBAGENTS for upstream authoring research.\n'
  );
  writeText(
    path.join(root, 'docs', 'sample.md'),
    'Example only: mcp_task and subagent_type general-purpose.\n'
  );
  writeText(
    path.join(root, 'tests', 'fixture.test.ts'),
    'const rendererOwned = "spawn_agent fixture must not be authority";\n'
  );
  return {
    sourcePath,
    recordPath,
    outPath: path.join(
      root,
      '_bmad-output',
      'runtime',
      'requirement-records',
      'REQ-SUBAGENT',
      'subagents',
      'subagent-surface-inventory.json'
    ),
  };
}

function runFixture(root: string, options: { unsafeEnvelope?: boolean; omitBmm?: boolean } = {}) {
  const cwd = process.cwd();
  try {
    process.chdir(root);
    const paths = writeFixture(root, options);
    const code = runSubagentSurfaceInventory([
      '--source',
      paths.sourcePath,
      '--requirement-record',
      paths.recordPath,
      '--out',
      paths.outPath,
      '--generated-at',
      '2026-05-21T00:00:00.000Z',
      '--generated-by',
      'vitest',
      '--json',
    ]);
    return {
      code,
      report: JSON.parse(readFileSync(paths.outPath, 'utf8')) as Record<string, unknown>,
    };
  } finally {
    process.chdir(cwd);
  }
}

describe('subagent surface inventory', () => {
  it('passes only when discovered subagent execution surfaces map to source-defined registry or explicit exclusions', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'subagent-surface-pass-'));
    try {
      const { code, report } = runFixture(root);

      expect(code).toBe(0);
      expect(report).toMatchObject({
        reportType: 'subagent_surface_inventory',
        decision: 'pass',
        authority: 'source_document_implementationConfirmation_subagentExecutionSurfaceRegistry',
        controlDecisionAuthority: 'controlled_ingest_contractChecks_only',
        directArtifactJsonControlForbidden: true,
      });
      expect(report.blockingIssues as string[]).toEqual([]);
      expect(
        (report.rows as Array<Record<string, unknown>>).some(
          (row) => row.registrySurfaceId === 'main_agent_codex_worker_adapter'
        )
      ).toBe(true);
      expect(
        (report.rows as Array<Record<string, unknown>>).some(
          (row) => row.exclusionReasonCode === 'test_fixture_only'
        )
      ).toBe(true);
      expect(report.scannerConfigHash as string).toMatch(/^sha256:[a-f0-9]{64}$/u);
      expect(report.registryHash as string).toMatch(/^sha256:[a-f0-9]{64}$/u);
      expect(report.inventoryHash as string).toMatch(/^sha256:[a-f0-9]{64}$/u);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks a BMM workflow subagent markdown surface without registry mapping', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'subagent-surface-bmm-block-'));
    try {
      const { code, report } = runFixture(root, { omitBmm: true });

      expect(code).toBe(1);
      expect(report.decision).toBe('blocked');
      expect(report.blockingIssues as string[]).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            '_bmad/bmm/workflows/1-analysis/bmad-product-brief-preview/agents/web-researcher.md'
          ),
        ])
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks control-flow-capable registry rows that do not require an envelope', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'subagent-surface-envelope-block-'));
    try {
      const { code, report } = runFixture(root, { unsafeEnvelope: true });

      expect(code).toBe(1);
      expect(report.decision).toBe('blocked');
      expect(report.blockingIssues as string[]).toContain(
        'registry_control_flow_without_envelope:main_agent_codex_worker_adapter'
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks stale scannerConfigHash rows and invalid exclusion codes before controlled ingest can record a pass', () => {
    const scannerConfigHash = sha256Text('scanner');
    const issues = subagentSurfaceInventoryInternals.validateInventory({
      rows: [
        {
          surfacePath: 'docs/example.md',
          matchPattern: 'mcp_task',
          matchedTextHash: sha256Text('mcp_task'),
          surfaceKind: 'docs_samples_and_legacy_references',
          classification: 'non_control_doc_sample',
          registrySurfaceId: '',
          coverageStatus: 'excluded',
          explicitExclusionReason: '',
          exclusionReasonCode: 'not_allowed',
          canAffectControlFlow: false,
          requiredEnvelope: false,
          currentAttemptRevalidationRequired: false,
          ownerSubsystem: 'subagent_execution_governance',
          linkedRequirementIds: ['MUST-045'],
          linkedEvidenceIds: ['EVD-044'],
          scannerConfigHash: sha256Text('stale'),
          sourceDocumentHash: SOURCE_HASH,
          implementationConfirmationHash: IMPLEMENTATION_HASH,
          architectureConfirmationHash: ARCHITECTURE_HASH,
        },
      ],
      registry: [],
      scannerConfigHash,
      registryHash: sha256Text('registry'),
      sourceDocumentHash: SOURCE_HASH,
      implementationConfirmationHash: IMPLEMENTATION_HASH,
      architectureConfirmationHash: ARCHITECTURE_HASH,
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        'excluded_reason_missing:docs/example.md',
        'excluded_reason_code_invalid:docs/example.md:not_allowed',
        'scanner_config_hash_stale:docs/example.md',
      ])
    );
  });
});
