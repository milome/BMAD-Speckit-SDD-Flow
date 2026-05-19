import * as fs from 'node:fs';
import * as path from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const schemaPath = path.join(repoRoot, '_bmad', '_schemas', 'requirement-record.schema.json');

function loadValidator() {
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8')) as object;
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(schema);
}

function validRecord() {
  return {
    recordId: 'REQ-SCHEMA-001',
    requirementSetId: 'REQ-SCHEMA-001',
    sourcePath: 'docs/design/example.md',
    status: 'user_confirmed',
    sourceDocumentHash: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
    implementationConfirmationHash:
      'sha256:2222222222222222222222222222222222222222222222222222222222222222',
    confirmationPageHash: 'sha256:3333333333333333333333333333333333333333333333333333333333333333',
    confirmationHistory: [
      {
        eventType: 'confirmation_recorded',
        recordId: 'REQ-SCHEMA-001',
        requirementSetId: 'REQ-SCHEMA-001',
        confirmedAt: '2026-05-19T00:00:00.000Z',
        confirmedBy: 'user',
        sourcePath: 'docs/design/example.md',
        sourceDocumentHash:
          'sha256:1111111111111111111111111111111111111111111111111111111111111111',
        sourceDocumentHashScope: 'semantic_source_excluding_confirmation_bookkeeping',
        implementationConfirmationHash:
          'sha256:2222222222222222222222222222222222222222222222222222222222222222',
        implementationConfirmationHashScope:
          'semantic_implementation_confirmation_excluding_bookkeeping',
        confirmationPageHash:
          'sha256:3333333333333333333333333333333333333333333333333333333333333333',
        confirmationText:
          '确认以上范围进入下一阶段 sourceDocumentHash=sha256:1111111111111111111111111111111111111111111111111111111111111111 implementationConfirmationHash=sha256:2222222222222222222222222222222222222222222222222222222222222222 confirmationPageHash=sha256:3333333333333333333333333333333333333333333333333333333333333333',
        renderReportPath: '_bmad-output/runtime/requirement-records/REQ-SCHEMA-001/confirmation/confirmation-render-report.json',
        htmlPath: '_bmad-output/runtime/requirement-records/REQ-SCHEMA-001/confirmation/confirmation.html',
      },
    ],
    architectureConfirmationState: {
      status: 'active',
      currentArchitectureConfirmationRunId: 'arch-001',
      currentArchitectureConfirmationHash:
        'sha256:4444444444444444444444444444444444444444444444444444444444444444',
      currentArchitectureConfirmationPath:
        '_bmad-output/runtime/requirement-records/REQ-SCHEMA-001/architecture/architecture-confirmation-arch-001.json',
      lastEventType: 'architecture_confirmation_recorded',
      updatedAt: '2026-05-19T00:00:00.000Z',
    },
    gateChecks: [
      {
        eventType: 'gate_check_recorded',
        checkId: 'gate-001',
        gate: 'Implementation Readiness Gate',
        decision: 'pass',
        recordedAt: '2026-05-19T00:00:00.000Z',
        recordedBy: 'codex',
      },
    ],
    contractChecks: [
      {
        eventType: 'contract_check_recorded',
        checkId: 'contract-001',
        contract: 'requirement_confirmation',
        decision: 'pass',
        recordedAt: '2026-05-19T00:00:00.000Z',
        recordedBy: 'codex',
      },
    ],
    artifactIndex: [
      {
        eventType: 'artifact_indexed',
        artifactType: 'confirmation_view',
        sourceOfTruthRole: 'projection',
        recordId: 'REQ-SCHEMA-001',
        requirementSetId: 'REQ-SCHEMA-001',
        path: '_bmad-output/runtime/requirement-records/REQ-SCHEMA-001/confirmation/confirmation.html',
        contentHash: 'sha256:5555555555555555555555555555555555555555555555555555555555555555',
        producer: 'render-requirements-confirmation-html',
        purpose: 'render confirmed requirement scope for human review',
        relatedRequirementIds: ['MUST-001'],
        status: 'active',
        inputVersion: 'source-v1',
        outputVersion: 'confirmation-v1',
      },
    ],
    updatedAt: '2026-05-19T00:00:00.000Z',
  };
}

describe('requirement-record.schema.json', () => {
  it('accepts a confirmed requirement record with confirmation history and decision-based checks', () => {
    const validate = loadValidator();
    const record = validRecord();

    expect(validate(record), JSON.stringify(validate.errors, null, 2)).toBe(true);
  });

  it('rejects result as a canonical control field on gate and contract checks', () => {
    const validate = loadValidator();
    const record = validRecord();
    record.gateChecks[0] = { ...record.gateChecks[0], result: 'pass' } as never;
    record.contractChecks[0] = { ...record.contractChecks[0], result: 'pass' } as never;

    expect(validate(record)).toBe(false);
    expect(JSON.stringify(validate.errors)).toContain('result');
  });

  it('rejects dashboard, score, and report fields as requirement-record control sources', () => {
    const validate = loadValidator();
    const record = {
      ...validRecord(),
      dashboard: { status: 'green' },
      score: { written: true },
      report: { decision: 'pass' },
    };

    expect(validate(record)).toBe(false);
    expect(JSON.stringify(validate.errors)).toContain('not');
  });

  it('requires explicit confirmation history instead of inferred confirmation state', () => {
    const validate = loadValidator();
    const record = validRecord();
    record.confirmationHistory = [];

    expect(validate(record)).toBe(false);
    expect(JSON.stringify(validate.errors)).toContain('minItems');
  });

  it('rejects artifact refs that cannot be used for pass-grade evidence', () => {
    const validate = loadValidator();
    const record = validRecord();
    delete (record.artifactIndex[0] as Record<string, unknown>).purpose;
    (record.artifactIndex[0] as Record<string, unknown>).relatedRequirementIds = [];

    expect(validate(record)).toBe(false);
    expect(JSON.stringify(validate.errors)).toContain('relatedRequirementIds');
  });
});
