import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import { resolveGoalExecutionAuthority } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-execution-authority';
import { standaloneGoalSemanticIRHash } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/standalone-goal-semantic-hash';
import { resolveStandaloneGoalSemanticPayload } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/standalone-goal-semantic-representation';

const require = createRequire(import.meta.url);
const { buildSourceSnapshot } = require('../../packages/bmad-speckit/dist/utils/goal-contract/dual-view-derivation.js');
const { extractSourceObligations } = require('../../packages/bmad-speckit/dist/utils/goal-contract/source-obligation-extractor.js');

const ROOT = process.cwd();
const FIXTURE = path.resolve('packages/bmad-speckit/tests/fixtures/standalone-goal/real-source-plan-20260904.md');
const ORACLE = path.resolve('packages/bmad-speckit/tests/fixtures/standalone-goal/real-source-plan-20260904.expected.json');
const SOURCE_SHA256 = '06f1c8f44fdfea09fb0f12832cd0a319c7938c79aac91aae48f44b54dc731d4a';
const CLAUSE_SET_HASH = 'sha256:b7b4c71170320c07124b4365a0cc459ffa01b94201a356173d525c29f24288ce';
const CLI = path.resolve('scripts/bmad-speckit-cli.js');

const json = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const refs = (row: any, field: string): string[] => Array.isArray(row[field]) ? row[field] : [];
const without = (row: any, field: string) => Object.fromEntries(Object.entries(row).filter(([key]) => key !== field));
const ids = (rows: any[], field: string) => rows.map((row) => String(row[field])).sort();

describe('standalone Goal contract full frozen Source Plan CLI', () => {
  it('publishes one complete sparse hash-closed authority without an authoring Judge', () => {
    const sourceBytes = readFileSync(FIXTURE);
    expect(sourceBytes).toHaveLength(214296);
    expect(sha256(sourceBytes)).toBe(SOURCE_SHA256);
    expect(() => new TextDecoder('utf-8', { fatal: true }).decode(sourceBytes)).not.toThrow();
    expect(path.resolve(json(path.resolve('package.json')).bin['bmad-speckit'])).toBe(CLI);

    const oracle = json(ORACLE);
    const oracleBlocks = oracle.sections.flatMap((section: any) => section.blocks);
    const oracleClauses = oracleBlocks.flatMap((block: any) => block.semantics ?? []);
    const expectedWorks = [...new Set(oracleBlocks.map((block: any) => block.context?.work)
      .filter((id: unknown) => typeof id === 'string' && /^WORK-\d{2}$/u.test(id as string)))].sort();
    const source = extractSourceObligations({ snapshot: buildSourceSnapshot({
      sourceType: 'source_plan', sourcePath: FIXTURE, rawBytes: sourceBytes,
    }) });
    expect(oracle.verification).toMatchObject({ clauses: 2241, works: 16, unexplainedBlocks: [], uncoveredByteRanges: [] });
    expect(new Set(oracleClauses.map((row: any) => row.id)).size).toBe(2241);
    expect(new Set(source.sourceClauseCoverage.map((row: any) => row.id)).size).toBe(2241);
    const sourceClauseSpans = source.sourceClauseCoverage.map((row: any) => ({ startByte: row.startByte,
      endByteExclusive: row.endByteExclusive, exactTextHash: row.exactTextHash }));
    const oracleClauseSpans = oracleClauses.map((row: any) => ({ startByte: row.byteStart,
      endByteExclusive: row.byteEnd, exactTextHash: `sha256:${sha256(Buffer.from(row.text, 'utf8'))}` }));
    expect(sha256Stable(sourceClauseSpans)).toBe(sha256Stable(oracleClauseSpans));
    expect(expectedWorks).toEqual(Array.from({ length: 16 }, (_, index) => `WORK-${String(index + 1).padStart(2, '0')}`));

    const runRoot = mkdtempSync(path.join(tmpdir(), 'standalone-real-source-cli-'));
    try {
      const out = path.join(runRoot, 'real-source-goal-execution-plan.md');
      const result = spawnSync(process.execPath, [CLI,
        'goal-contract', 'generate',
        '--entry', 'standalone_goal_contract', '--source', FIXTURE, '--out', out, '--json',
      ], {
        cwd: ROOT,
        encoding: 'utf8',
        env: { ...process.env, BMAD_SKIP_CONSUMER_MCP_INSTALL: '1' },
        timeout: 420_000,
        maxBuffer: 4 * 1024 * 1024,
        windowsHide: true,
      });
      expect(result.status, result.error?.message || result.stderr?.slice(0, 1600)).toBe(0);
      const generation = JSON.parse(result.stdout);
      expect(generation).toMatchObject({
        ok: true,
        entryScenario: 'standalone_goal_contract',
        sourcePlanHash: `sha256:${SOURCE_SHA256}`,
        unmappedSourceObligations: 0,
        goalJudgeDispatchCount: 0,
      });

      const coverage = json(generation.coverageReceiptPath);
      expect(coverage).toMatchObject({
        schemaVersion: 'goal-contract-source-coverage-receipt/v2',
        sourcePlanHash: generation.sourcePlanHash,
        sourceBytes: 214296,
        decision: 'pass',
        unmappedSourceObligations: [],
        orphanGeneratedRefs: [],
        blockingReasons: [],
      });
      expect(coverage.sourceClauseCoverage.reduce((sum: number, row: any) => sum + row.clauseCount, 0)).toBe(2241);
      expect(coverage.sourceClauseCoverage[0].clauseSetHash).toBe(CLAUSE_SET_HASH);
      expect(json(generation.generationReceiptPath).goalExecutionIRHash).toBe(generation.goalExecutionIRHash);

      const semantic = json(generation.standaloneGoalSemanticIrRef.path);
      const gate = json(generation.internalSemanticGateRef.path);
      const goalIr = resolveGoalExecutionAuthority(json(generation.goalExecutionIrRef.path));
      const closure = json(generation.closureRef.path);
      const active = json(generation.activeAuthorityRef.path);
      const semanticPayload: any = resolveStandaloneGoalSemanticPayload(semantic);

      expect(semantic.standaloneGoalSemanticIRHash).toBe(generation.standaloneGoalSemanticIrRef.hash);
      expect(standaloneGoalSemanticIRHash(semantic)).toBe(semantic.standaloneGoalSemanticIRHash);
      expect(gate).toMatchObject({
        decision: 'pass',
        issueCodes: [],
        sourcePlanHash: generation.sourcePlanHash,
        standaloneGoalSemanticIRHash: semantic.standaloneGoalSemanticIRHash,
      });
      expect(gate.gateHash).toBe(generation.internalSemanticGateRef.hash);
      expect(sha256Stable(without(gate, 'gateHash'))).toBe(gate.gateHash);
      expect(gate.metrics.candidateObligationCount).toBe(semanticPayload.obligations.length);
      expect(gate.metrics.actionCount).toBe(16);
      expect(gate.metrics.referenceCount).toBeGreaterThan(0);
      expect(goalIr.atomicTasks).toHaveLength(16);
      expect(ids(semanticPayload.obligations.filter((row: any) => row.executionRole === 'action'), 'obligationId')).toEqual(expectedWorks);
      expect(ids(semanticPayload.atoms, 'requirementRef')).toEqual(expectedWorks);
      expect(ids(goalIr.obligations.filter((row: any) => row.executionRole === 'action'), 'obligationId')).toEqual(expectedWorks);
      expect(goalIr.atomicTasks.every((row: any) => refs(row, 'obligationRefs').length === 1)).toBe(true);
      expect(ids(goalIr.atomicTasks.flatMap((row: any) => refs(row, 'obligationRefs')).map((obligationId) => ({ obligationId })), 'obligationId')).toEqual(expectedWorks);
      expect(new Set(goalIr.atomicTasks.map((row: any) => row.taskId)).size).toBe(16);
      expect(goalIr.goalExecutionIRHash).toBe(generation.goalExecutionIRHash);
      expect(goalIr.standaloneLineage).toMatchObject({ sourcePlanHash: generation.sourcePlanHash,
        standaloneGoalSemanticIRHash: semantic.standaloneGoalSemanticIRHash, internalSemanticGateHash: gate.gateHash });
      expect(closure).toMatchObject({ decision: 'pass', goalExecutionIRHash: generation.goalExecutionIRHash });
      expect(closure.goalExecutionClosureHash).toBe(generation.closureRef.hash);
      expect(sha256Stable(without(closure, 'goalExecutionClosureHash'))).toBe(closure.goalExecutionClosureHash);
      expect(active).toMatchObject({ profile: 'standalone', goalExecutionIRHash: generation.goalExecutionIRHash });
      expect(active.activeAuthorityHash).toBe(generation.activeAuthorityRef.hash);
      expect(sha256Stable(without(active, 'activeAuthorityHash'))).toBe(active.activeAuthorityHash);
      expect(active.standaloneSemanticIrRef.hash).toBe(semantic.standaloneGoalSemanticIRHash);
      expect(active.standaloneInternalSemanticGateRef.hash).toBe(gate.gateHash);
      expect(active.goalExecutionIrRef.hash).toBe(goalIr.goalExecutionIRHash);
      expect(active.closureRef.hash).toBe(closure.goalExecutionClosureHash);

      const universe = semanticPayload.obligations.length;
      const nonGlobal = semanticPayload.executionConstraints.filter((row: any) => row.scope !== 'global');
      expect(nonGlobal.some((row: any) => refs(row, 'applicableMustRefs').length === universe)).toBe(false);
      expect(semanticPayload.executionConstraints.some((row: any) =>
        refs(row, 'applicableMustRefs').length === universe &&
        refs(row, 'premiseRefs').length === universe
      )).toBe(false);
      const actionSet = new Set(expectedWorks);
      expect(nonGlobal.some((row: any) => {
        const actionRefs = [...new Set(refs(row, 'applicableMustRefs').filter((ref) => actionSet.has(ref)))];
        return actionRefs.length === expectedWorks.length;
      })).toBe(false);

      const markdownBytes = readFileSync(out);
      expect(`sha256:${sha256(markdownBytes)}`).toBe(generation.goalContractDocumentHash);
      const markdown = markdownBytes.toString('utf8');
      for (const heading of ['## Authority Model', '## Implementation Tasks', '## Strict Acceptance Checklist',
        '## Acceptance Traceability Matrix', '## Required Test Commands', '## Stop Conditions']) {
        expect(markdown).toContain(heading);
      }
    } finally {
      rmSync(runRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  }, 450_000);
});
