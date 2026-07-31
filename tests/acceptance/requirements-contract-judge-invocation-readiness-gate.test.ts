import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildRequirementsContractRequirementsInvocationInput,
  compileRequirementsContractRequirementsScope,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-requirements-invocation-input';
import {
  evaluateRequirementsContractJudgeInvocationReadiness,
  assertRequirementsContractJudgeInvocationReadiness,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-invocation-readiness-gate';
import { sha256 } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-governed-write';

type JsonRecord = Record<string, unknown>;

const roots: string[] = [];
const hashPattern = /^sha256:[a-f0-9]{64}$/u;

afterEach(() => {
  roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }));
});

function createRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'requirements-readiness-'));
  roots.push(root);
  return root;
}

function sourceDocumentContent(requirementText: string): string {
  return [
    '# Product requirement',
    '',
    requirementText,
    '',
    'implementationConfirmation:',
    '  status: confirmed',
    '  requirements:',
    '    - id: MUST-001',
    `      text: ${JSON.stringify(requirementText)}`,
    '',
  ].join('\n');
}

function materializeScopeFixture() {
  const root = createRoot();
  const requirementText = `Observable behavior ${randomUUID()}`;
  const sourceDocument = 'docs/requirements/source.md';
  const sourcePath = path.join(root, sourceDocument);
  mkdirSync(path.dirname(sourcePath), { recursive: true });
  writeFileSync(sourcePath, sourceDocumentContent(requirementText), 'utf8');
  const sourceDocumentHash = sha256(sourceDocumentContent(requirementText));
  const semanticModelHash = sha256(`semantic-${randomUUID()}`);
  const projectionRefs = [
    'MUST-001',
    'requirements.must:MUST-001',
    'TRACE-001',
    'traceSlices:TRACE-001',
    'EVD-001',
    'contractExecutionManifest.evidence:EVD-001',
  ];
  const projectionSetHash = sha256(JSON.stringify([...projectionRefs].sort()));
  const authority = {
    sourceDocument,
    sourceDocumentHash,
    semanticModelHash,
    projectionSetHash,
    requirements: {
      must: [{ id: 'MUST-001', text: requirementText }],
    },
    traceSlices: [{ traceId: 'TRACE-001' }],
    contractExecutionManifest: {
      evidence: [{ id: 'EVD-001' }],
      targetModificationPaths: [{ id: 'TARGET-001', path: 'src/feature.ts' }],
    },
    promptRef: { path: 'prompts/requirements.md', hash: sha256('prompt') },
    schemaRef: {
      path: 'schemas/requirements-response.schema.json',
      hash: sha256('schema'),
      schemaVersion: 'requirements-contract-requirements-judge-response/v1',
    },
    policyRef: { path: 'policy/requirements.json', hash: sha256('policy') },
    ledgerRef: { path: 'ledger/requirements.json', hash: sha256('ledger') },
    auditUnitSetRef: { path: 'audit/units.json', hash: sha256('audit-units') },
    vetoRef: { path: 'veto/requirements.json', hash: sha256('veto') },
  };
  return { root, authority, requirementText };
}

describe('requirements contract judge invocation readiness gate', () => {
  it('compiles a persisted reverse-traceable Requirements scope and typed invocation input', () => {
    const fixture = materializeScopeFixture();
    const scopePath = path.join(fixture.root, 'runtime/requirements-scope.json');
    const scope = compileRequirementsContractRequirementsScope({
      projectRoot: fixture.root,
      authority: fixture.authority,
      outputPath: scopePath,
    });

    expect(scope).toMatchObject({
      schemaVersion: 'requirements-contract-requirements-scope/v1',
      role: 'requirements',
      sourceDocument: fixture.authority.sourceDocument,
      sourceDocumentHash: fixture.authority.sourceDocumentHash,
      semanticModelHash: fixture.authority.semanticModelHash,
      projectionSetHash: fixture.authority.projectionSetHash,
      decision: 'pass',
    });
    expect(scope.scopeHash).toMatch(hashPattern);
    expect(readFileSync(scopePath, 'utf8')).toContain(
      'requirements-contract-requirements-scope/v1'
    );
    expect(JSON.stringify(scope)).toContain(fixture.requirementText);

    const readiness = evaluateRequirementsContractJudgeInvocationReadiness({
      role: 'requirements',
      attemptId: `attempt-${randomUUID()}`,
      scope,
      providerRegistryHash: sha256('registry'),
      credentialBindingHash: sha256('credential'),
      promptHash: String((fixture.authority.promptRef as JsonRecord).hash),
      schemaHash: String((fixture.authority.schemaRef as JsonRecord).hash),
      policyHash: String((fixture.authority.policyRef as JsonRecord).hash),
      ledgerHash: String((fixture.authority.ledgerRef as JsonRecord).hash),
      auditUnitSetHash: String((fixture.authority.auditUnitSetRef as JsonRecord).hash),
      vetoSetHash: String((fixture.authority.vetoRef as JsonRecord).hash),
    });
    expect(readiness).toMatchObject({
      schemaVersion: 'requirements-contract-judge-invocation-readiness-receipt/v1',
      role: 'requirements',
      sourceDocumentHash: fixture.authority.sourceDocumentHash,
      semanticModelHash: fixture.authority.semanticModelHash,
      projectionSetHash: fixture.authority.projectionSetHash,
      providerInvocationCount: 0,
      decision: 'pass',
    });
    expect(readiness.readinessHash).toMatch(hashPattern);

    const input = buildRequirementsContractRequirementsInvocationInput({
      scope,
      readinessReceipt: readiness,
      systemPrompt: 'Judge only the frozen requirements scope.',
      structuredOutputSchema: { type: 'object', required: ['decision'] },
      outputDir: 'runtime/judge-output',
    });
    expect(input).toMatchObject({
      schemaVersion: 'requirements-contract-requirements-invocation-input/v1',
      role: 'requirements',
      readinessReceiptHash: readiness.readinessHash,
      request: {
        role: 'requirements',
        sourceDocument: fixture.authority.sourceDocument,
        mustRefs: ['MUST-001'],
        projectionRefs: [
          'EVD-001',
          'MUST-001',
          'TARGET-001',
          'TRACE-001',
          'contractExecutionManifest.evidence:EVD-001',
          'contractExecutionManifest.targetModificationPaths:TARGET-001',
          'requirements.must:MUST-001',
          'traceSlices:TRACE-001',
        ],
      },
    });
    expect(input.requestHash).toMatch(hashPattern);
  });

  it('validates the readiness receipt schema', () => {
    const schema = JSON.parse(
      readFileSync(
        path.resolve(
          'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-judge-invocation-readiness-receipt.schema.json'
        ),
        'utf8'
      )
    );
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
    const receipt = evaluateRequirementsContractJudgeInvocationReadiness({
      role: 'requirements',
      attemptId: `attempt-${randomUUID()}`,
      scope: {
        sourceDocumentHash: sha256('source'),
        semanticModelHash: sha256('semantic'),
        projectionSetHash: sha256('projection'),
        scopeHash: sha256('scope'),
        requestHash: sha256('request'),
      },
      providerRegistryHash: sha256('registry'),
      credentialBindingHash: sha256('credential'),
      promptHash: sha256('prompt'),
      schemaHash: sha256('schema'),
      policyHash: sha256('policy'),
      ledgerHash: sha256('ledger'),
      auditUnitSetHash: sha256('audit-units'),
      vetoSetHash: sha256('veto'),
    });

    expect(validate(receipt), JSON.stringify(validate.errors ?? [])).toBe(true);
  });

  it('blocks stale or missing bindings before provider invocation', () => {
    const fixture = materializeScopeFixture();
    const scope = compileRequirementsContractRequirementsScope({
      projectRoot: fixture.root,
      authority: fixture.authority,
    });
    const readiness = evaluateRequirementsContractJudgeInvocationReadiness({
      role: 'requirements',
      attemptId: `attempt-${randomUUID()}`,
      scope,
      providerRegistryHash: sha256('registry'),
      credentialBindingHash: sha256('credential'),
      promptHash: sha256('prompt'),
      schemaHash: sha256('schema'),
      policyHash: sha256('policy'),
      ledgerHash: sha256('ledger'),
      auditUnitSetHash: sha256('audit-units'),
      vetoSetHash: sha256('veto'),
    });

    expect(() =>
      assertRequirementsContractJudgeInvocationReadiness({
        readinessReceipt: {
          ...readiness,
          semanticModelHash: sha256('stale-semantic'),
        },
        scope,
        providerInvocationCount: 0,
      })
    ).toThrow('requirements_contract_judge_readiness_stale:semanticModelHash');

    expect(() =>
      assertRequirementsContractJudgeInvocationReadiness({
        readinessReceipt: {
          ...readiness,
          credentialBindingHash: undefined,
        },
        scope,
        providerInvocationCount: 0,
      })
    ).toThrow('requirements_contract_judge_readiness_missing:credentialBindingHash');
  });
});
