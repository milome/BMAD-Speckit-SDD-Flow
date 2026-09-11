import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { x as extractTar } from 'tar';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  hydrateConfirmedImplementationConfirmation,
  resolveConfirmedRequirementsAuthority,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-confirmed-authority-adapter';
import { confirmRequirementsContractIrScope } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-confirmation-acceptance';
import { compileConfirmedRequirementsGoalSemantics } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/confirmed-requirements-goal-compiler';
import { compileGoalExecutionIR } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-execution-ir';
import { resolveGoalExecutionAuthority } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-execution-authority';

const REQUEST_ID = 'REQ-GOAL-SOURCE-NORMALIZATION-FULL-20260908-05';
const SEMANTIC_REVISION_ID =
  'SEMREV-0D5C8A146837319DFB3853D66228AAA41CA384E3698E534E55AD3AA0EB053153';
const SCOPE_HASH = 'sha256:2ff9fb10cd4148882665a45db9bc6957a2d41c8ec3804940f0b39f1a1789e4f5';
const BINDING_REVISION_ID =
  'BINDREV-3B8F37598A3D57B79CD1496537657C94D9F7A0B9FE7D7928CFF36D64ED471018';
const EFFECTIVE_PASS_HASH =
  'sha256:9fa331e3a4158c09d2ad0c9b044287a1b8ff44ccd3eb0de5044aea898ade2f68';
const TYPED_GRAPH_HASH = 'sha256:99dd3e6a1750c446e5e6b30487548bbd64ab3b73675aae0a4b9e76eecfbdfe6b';
const CONFIRMATION_EVENT_ID =
  'sha256:0212462d7fc3732bb569a415a3d999b0a7b41c981605f0df2866c6ab7762e682';
const EXACT_CONFIRMATION_TEXT = `确认以上需求范围进入下一阶段
requestId=${REQUEST_ID}
semanticRevisionId=${SEMANTIC_REVISION_ID}
scopeSemanticHash=${SCOPE_HASH}
bindingRevisionId=${BINDING_REVISION_ID}
requirementsEffectivePassHash=${EFFECTIVE_PASS_HASH}`;
const FIXTURE_ROOT = path.resolve('packages/bmad-speckit/tests/fixtures/standalone-goal');
const FIXTURE_ARCHIVE = path.join(
  FIXTURE_ROOT,
  'canonical-source-plan-v1-full.confirmed-authority.tar.gz'
);
const FIXTURE_RECEIPT = path.join(
  FIXTURE_ROOT,
  'canonical-source-plan-v1-full.confirmation-receipt.json'
);
let sourcePresentation: string;
const REQ_TRACE_GENERATOR = path.resolve(
  '_bmad/skills/req-trace-matrix-prompt-generator/scripts/generate_prompt.js'
);
const GOAL_CONTRACT_COMMAND = path.resolve('packages/bmad-speckit/src/commands/goal-contract.ts');
const TSX = path.resolve('node_modules/tsx/dist/cli.mjs');
const fixtureTools = createRequire(import.meta.url)(
  '../../packages/bmad-speckit/tests/fixtures/standalone-goal/canonical-full-fixture.cjs'
);
const SOURCE_RUNNER = [
  'const { goalContractCommand } = require(process.argv[1]);',
  'Promise.resolve(goalContractCommand({}, process.argv.slice(2)))',
  '.then((code)=>{process.exitCode=code;})',
  '.catch((error)=>{console.error(error);process.exitCode=1;});',
].join('');

interface FixtureFileReceipt {
  path: string;
  bytes: number;
  sha256: string;
}

interface ConfirmedAuthorityFixtureReceipt {
  receiptHash: string;
  archive: FixtureFileReceipt;
  files: FixtureFileReceipt[];
}

let canonicalFullFixture: { canonicalSourcePath: string };

function sha256(bytes: Buffer | string): string {
  return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function verifyFixtureReceipt(): ConfirmedAuthorityFixtureReceipt {
  const receipt = readJson<ConfirmedAuthorityFixtureReceipt>(FIXTURE_RECEIPT);
  const { receiptHash, ...payload } = receipt;
  expect(receiptHash).toBe(sha256(`${JSON.stringify(payload, null, 2)}\n`));
  const archiveBytes = fs.readFileSync(FIXTURE_ARCHIVE);
  expect(archiveBytes).toHaveLength(receipt.archive.bytes);
  expect(sha256(archiveBytes)).toBe(receipt.archive.sha256);
  return receipt;
}

function recordPath(projectRoot: string): string {
  return path.join(
    projectRoot,
    '_bmad-output',
    'runtime',
    'requirement-records',
    REQUEST_ID,
    'record',
    'requirement-record.json'
  );
}

function compileReqTraceEntry(
  projectRoot: string,
  entry: 'req_trace_direct' | 'main_agent_compile'
): { packet: Record<string, any>; receipt: Record<string, any>; goalDocument: Buffer } {
  const outDir = path.join(projectRoot, 'req-trace', entry);
  const result = spawnSync(
    process.execPath,
    [
      REQ_TRACE_GENERATOR,
      '--entry',
      entry,
      '--source-document',
      sourcePresentation,
      '--requirement-record',
      recordPath(projectRoot),
      '--out-dir',
      outDir,
      '--task-report-path',
      path.join(outDir, 'task-report.json'),
      '--execution-host',
      'codex',
      '--goal-command-available',
      'true',
      '--json',
    ],
    {
      cwd: projectRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        BMAD_SPECKIT_PACKAGE_ROOT: path.resolve('packages/bmad-speckit'),
      },
      maxBuffer: 1024 * 1024,
    }
  );
  expect(result.status, `${entry}: ${result.stderr}\n${result.stdout}`).toBe(0);
  return {
    packet: readJson(path.join(outDir, 'model_packet.json')),
    receipt: readJson(path.join(outDir, 'audit_receipt.json')),
    goalDocument: fs.readFileSync(path.join(outDir, 'goal_execution.md')),
  };
}

function compileStandaloneFull(projectRoot: string): Record<string, any> {
  const out = path.join(projectRoot, 'standalone', 'full-goal-execution-plan.md');
  const result = spawnSync(
    process.execPath,
    [
      TSX,
      '-e',
      SOURCE_RUNNER,
      GOAL_CONTRACT_COMMAND,
      'generate',
      '--entry',
      'standalone_goal_contract',
      '--source',
      canonicalFullFixture.canonicalSourcePath,
      '--out',
      out,
      '--sequence-mode',
      'disabled',
      '--json',
    ],
    { cwd: path.resolve('packages/bmad-speckit'), encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }
  );
  expect(result.status, result.stderr || result.stdout).toBe(0);
  const irRoot = path.join(`${out}.authority`, 'goal', 'ir');
  const hashDirectories = fs
    .readdirSync(irRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory());
  expect(hashDirectories).toHaveLength(1);
  return resolveGoalExecutionAuthority(
    readJson(path.join(irRoot, hashDirectories[0].name, 'goal-execution-ir.json'))
  ) as unknown as Record<string, any>;
}

describe('confirmed Requirements authority adapter', () => {
  let projectRoot: string;
  let fixtureReceipt: ConfirmedAuthorityFixtureReceipt;

  beforeAll(async () => {
    fixtureReceipt = verifyFixtureReceipt();
    projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'confirmed-authority-adapter-'));
    await extractTar({ file: FIXTURE_ARCHIVE, cwd: projectRoot, strict: true });
    sourcePresentation = path.join(
      projectRoot,
      'packages',
      'bmad-speckit',
      'tests',
      'fixtures',
      'standalone-goal',
      'canonical-source-plan-v1-full.confirmed-requirements.zh-CN.md'
    );
    expect(fs.existsSync(sourcePresentation)).toBe(true);
    canonicalFullFixture = fixtureTools.materializeFullFixture({ root: projectRoot });
    for (const expected of fixtureReceipt.files) {
      const filePath = path.join(projectRoot, ...expected.path.split('/'));
      const bytes = fs.readFileSync(filePath);
      expect(bytes).toHaveLength(expected.bytes);
      expect(sha256(bytes)).toBe(expected.sha256);
    }
  });

  afterAll(() => {
    if (projectRoot) fs.rmSync(projectRoot, { recursive: true, force: true });
  });

  it('hydrates the real confirmed -05 fixture only after validating its complete lineage', () => {
    const authority = resolveConfirmedRequirementsAuthority({
      projectRoot,
      requirementRecordPath: recordPath(projectRoot),
    });

    expect(authority.schemaVersion).toBe('ConfirmedRequirementsAuthority/v1');
    expect(authority.requestId).toBe(REQUEST_ID);
    expect(authority.semanticIr.semanticRevisionId).toBe(SEMANTIC_REVISION_ID);
    expect(authority.semanticIr.scopeSemanticHash).toBe(SCOPE_HASH);
    expect(authority.sourceBinding.bindingRevisionId).toBe(BINDING_REVISION_ID);
    expect(authority.lineage.requirementsEffectivePassHash).toBe(EFFECTIVE_PASS_HASH);
    expect(authority.lineage.typedSourceGraphHash).toBe(TYPED_GRAPH_HASH);
    expect(authority.lineage.checkpointIds).toEqual([
      'cp00',
      'cp01',
      'cp02',
      'cp03',
      'cp04',
      'cp05',
      'cp06',
      'cp07',
      'cp08',
    ]);
    expect(authority.implementationConfirmation.status).toBe('user_confirmed');
    expect(authority.implementationConfirmation.must).toHaveLength(16);
    expect(authority.implementationConfirmation.implementationTasks).toHaveLength(16);
    expect(authority.implementationConfirmation.traceRows).toHaveLength(16);
    expect(authority.implementationConfirmation.requiredCommands).toHaveLength(84);
    expect(authority.typedSourceGraph.sourceNodes).toHaveLength(825);
    expect(authority.typedSourceGraph.sourceRelations).toHaveLength(9165);
  }, 120_000);

  it('replays the exact user confirmation through the production confirm-scope authority', () => {
    const result = confirmRequirementsContractIrScope({
      projectRoot,
      requestId: REQUEST_ID,
      exactConfirmationText: EXACT_CONFIRMATION_TEXT,
    });

    expect(result).toMatchObject({
      ok: true,
      action: 'confirm-scope',
      status: 'confirmation_reused',
      exitCode: 0,
      requestId: REQUEST_ID,
      semanticRevisionId: SEMANTIC_REVISION_ID,
      confirmationEventId: CONFIRMATION_EVENT_ID,
    });
  });

  it('compiles the confirmed fixture through the shared canonical Goal authority path', () => {
    const authority = resolveConfirmedRequirementsAuthority({
      projectRoot,
      requirementRecordPath: recordPath(projectRoot),
    });
    const injectedCompiler = vi.fn(compileGoalExecutionIR);
    const result = compileConfirmedRequirementsGoalSemantics(
      { authority },
      { compileGoalExecutionIR: injectedCompiler }
    );

    expect(injectedCompiler).toHaveBeenCalledOnce();

    expect(result).toMatchObject({
      schemaVersion: 'ConfirmedRequirementsGoalSemanticCompilation/v1',
      requestId: REQUEST_ID,
      canonicalGraphLint: { decision: 'pass', nodeCount: 825, relationCount: 9165 },
      goalExecutionIr: {
        schemaVersion: 'GoalExecutionIR/v3',
        profile: 'requirements_backed',
      },
      closure: { decision: 'pass' },
      projection: { renderabilityReport: { decision: 'pass' } },
    });
    expect(result.goalExecutionIr.obligations).toHaveLength(825);
    expect(result.goalExecutionIr.atomicTasks).toHaveLength(16);
    expect(result.goalExecutionIr.commands).toHaveLength(87);
    expect(result.goalExecutionIr.artifacts).toHaveLength(58);
    expect(result.goalExecutionIr.evidenceContracts).toHaveLength(55);
    expect(result.goalExecutionIr.coExecutionConstraints).toHaveLength(0);
    expect(
      result.goalExecutionIr.dependencies.filter(
        (dependency) => dependency.derivationRuleId !== 'explicit-aggregate-gate-phase/v1'
      )
    ).toHaveLength(46);
    expect(
      result.goalExecutionIr.dependencies.filter(
        (dependency) => dependency.derivationRuleId === 'explicit-aggregate-gate-phase/v1'
      )
    ).toHaveLength(7);
    expect(result.goalExecutionIr.logicalScopes.stopConditions).toHaveLength(16);
    const canonicalNodeIds = new Set(
      result.canonicalRequirementGraph.nodes.map((node) => String(node.id))
    );
    const sourceSpans = authority.semanticIr.semanticPayload.specSpanRegistry as Array<
      Record<string, any>
    >;
    expect(sourceSpans).toHaveLength(1);
    for (const span of result.goalExecutionIr.logicalSpecSpans) {
      expect(span.canonicalNodeRefs).toEqual(span.boundObligationIds);
      expect(span.canonicalNodeRefs.length).toBeLessThan(canonicalNodeIds.size);
      expect(span).toMatchObject({
        authorityClass: 'derived',
        originSpecSpanRef: sourceSpans[0].specSpanId,
      });
    }
    expect(
      new Set(result.goalExecutionIr.logicalSpecSpans.flatMap((span) => span.canonicalNodeRefs))
    ).toEqual(canonicalNodeIds);
    expect(result.goalExecutionIr.requirementsLineage).toMatchObject({
      sourceBindingHash: authority.lineage.sourceBindingHash,
      typedSourceGraphHash: TYPED_GRAPH_HASH,
      canonicalRequirementGraphHash: result.canonicalRequirementGraph.graphHash,
    });
    expect(result.closure.goalExecutionIRHash).toBe(result.goalExecutionIr.goalExecutionIRHash);
  });

  it('fails closed when a confirmed source span loses canonical lineage', () => {
    const authority = resolveConfirmedRequirementsAuthority({
      projectRoot,
      requirementRecordPath: recordPath(projectRoot),
    });
    const semanticIr = structuredClone(authority.semanticIr);
    const spans = semanticIr.semanticPayload.specSpanRegistry as Array<Record<string, any>>;
    expect(spans.length).toBeGreaterThan(0);
    spans[0].boundSemanticNodeIds = [];

    expect(() =>
      compileConfirmedRequirementsGoalSemantics({
        authority: { ...authority, semanticIr },
      })
    ).toThrowError(/requirements_spec_span_.*(?:lineage|projection|binding)/u);
  });

  it('preserves normalized semantics across canonical full standalone and confirmed Requirements', () => {
    const authority = resolveConfirmedRequirementsAuthority({
      projectRoot,
      requirementRecordPath: recordPath(projectRoot),
    });
    const requirements = compileConfirmedRequirementsGoalSemantics({ authority });
    const standalone = compileStandaloneFull(projectRoot);

    expect(standalone.profile).toBe('standalone');
    expect(standalone.semanticSource.canonicalRequirementGraphRef.semanticHash).toBe(
      requirements.canonicalRequirementGraph.semanticHash
    );
    expect(standalone.goalExecutionIRHash).not.toBe(
      requirements.goalExecutionIr.goalExecutionIRHash
    );
  }, 300_000);

  it('keeps canonical semantics stable when the full authority enters six-state readiness', () => {
    const authority = resolveConfirmedRequirementsAuthority({
      projectRoot,
      requirementRecordPath: recordPath(projectRoot),
    });
    const base = compileConfirmedRequirementsGoalSemantics({ authority });
    const typedConstraints = (
      base.goalExecutionIr.semanticSource.typedExecutionConstraints as Array<Record<string, any>>
    ).filter((constraint) => constraint.kind === 'PATH');
    const architectureHash = sha256('six-state-architecture');
    const readinessHash = sha256('six-state-readiness');
    const digest = sha256('six-state-input');
    const architecture = {
      architectureConfirmationCandidateHash: architectureHash,
      isolation: { mode: 'canonical_requirement_graph' },
      ownership: typedConstraints.map((constraint) => ({
        targetPath: constraint.canonicalValue,
        owner:
          constraint.applicableSourceRefs?.[0] ??
          constraint.scope?.owner ??
          constraint.constraintId,
        basisRefs: [constraint.constraintId],
        obligationRefs: constraint.applicableMustRefs ?? [],
        atomRefs: constraint.applicableAtomRefs ?? [],
        sourceRefs: constraint.sourceRefs ?? [constraint.constraintId],
      })),
      architectureDecisions: [],
      logicalScope: { forbiddenPaths: [] },
    };
    const readiness = {
      implementationReadinessCandidateHash: readinessHash,
      readinessScopedInputDigest: digest,
      normalizedCommands: [],
      inputArtifacts: [],
      redOutcomes: [],
    };
    const sixState = compileConfirmedRequirementsGoalSemantics({
      authority,
      sixStateContext: {
        architecture,
        readiness,
        architectureConfirmationCandidateHash: architectureHash,
        implementationReadinessCandidateHash: readinessHash,
        readinessScopedInputDigest: digest,
      },
    });

    expect(sixState.canonicalRequirementGraph.semanticHash).toBe(
      base.canonicalRequirementGraph.semanticHash
    );
    expect(sixState.goalExecutionIr.goalExecutionIRHash).not.toBe(
      base.goalExecutionIr.goalExecutionIRHash
    );
  }, 120_000);

  it('routes both req-trace entries through the shared confirmed Goal compilation', () => {
    const authority = resolveConfirmedRequirementsAuthority({
      projectRoot,
      requirementRecordPath: recordPath(projectRoot),
    });
    const shared = compileConfirmedRequirementsGoalSemantics({ authority });
    const expected = {
      canonicalRequirementGraphHash: shared.canonicalRequirementGraph.graphHash,
      canonicalRequirementSemanticHash: shared.canonicalRequirementGraph.semanticHash,
      goalExecutionIRHash: shared.goalExecutionIr.goalExecutionIRHash,
      goalExecutionClosureHash: shared.closure.goalExecutionClosureHash,
      goalExecutionProjectionHash: shared.projection.bytesHash,
    };

    for (const entry of ['req_trace_direct', 'main_agent_compile'] as const) {
      const { packet, receipt, goalDocument } = compileReqTraceEntry(projectRoot, entry);
      expect(packet.sharedGoalCompilation).toMatchObject({
        schemaVersion: 'ConfirmedRequirementsGoalCompilationRef/v1',
        compilerRoute: 'shared_goal_execution_ir_compiler',
        ...expected,
      });
      expect(receipt.sharedGoalCompilation).toEqual(packet.sharedGoalCompilation);
      const documentRef = packet.sharedGoalCompilation.goalExecutionDocumentRef;
      expect(documentRef).toMatchObject({
        schemaVersion: 'GoalExecutionProjectionDocumentRef/v1',
        compositionRecipe: 'utf8_concat(envelope,contractBody)',
        contractBodyHash: shared.projection.bytesHash,
        contractBodyLengthBytes: Buffer.byteLength(shared.projection.markdown, 'utf8'),
        documentHash: sha256(goalDocument),
      });
      const bodyStart = documentRef.contractBodyOffsetBytes as number;
      const bodyEnd = bodyStart + (documentRef.contractBodyLengthBytes as number);
      const envelope = goalDocument.subarray(0, bodyStart);
      const contractBody = goalDocument.subarray(bodyStart, bodyEnd);
      expect(sha256(envelope)).toBe(documentRef.envelopeHash);
      expect(sha256(contractBody)).toBe(shared.projection.bytesHash);
      expect(contractBody.toString('utf8')).toBe(shared.projection.markdown);
      expect(bodyEnd).toBe(goalDocument.length);
      expect(packet).not.toHaveProperty('canonicalRequirementGraph');
      expect(packet).not.toHaveProperty('goalExecutionIr');
      expect(packet).not.toHaveProperty('goalExecutionClosure');
      expect(packet.sharedGoalCompilation).not.toHaveProperty('projectionMarkdown');
    }
  }, 120_000);

  it('rejects a record pointer outside the canonical request record path', () => {
    expect(() =>
      resolveConfirmedRequirementsAuthority({
        projectRoot,
        requirementRecordPath: path.join(projectRoot, 'package.json'),
      })
    ).toThrowError('requirements_confirmed_record_path_invalid');
  });

  it('rejects typed refs that do not match the hydrated semantic authority', () => {
    const authority = resolveConfirmedRequirementsAuthority({
      projectRoot,
      requirementRecordPath: recordPath(projectRoot),
    });
    const projection = structuredClone(authority.confirmationProjection);
    const semanticIr = structuredClone(authority.semanticIr);
    projection.implementationConfirmation.typedSourceAuthorityRef.graphHash = `sha256:${'0'.repeat(64)}`;
    const semanticConfirmation = semanticIr.semanticPayload.semantics
      .implementationConfirmation as Record<string, Record<string, unknown>>;
    semanticConfirmation.typedSourceAuthorityRef.graphHash = `sha256:${'0'.repeat(64)}`;

    expect(() =>
      hydrateConfirmedImplementationConfirmation({
        semanticIr,
        confirmationProjection: projection,
        lifecycle: 'user_confirmed',
      })
    ).toThrowError('requirements_confirmed_typed_authority_ref_mismatch');
  });
});
