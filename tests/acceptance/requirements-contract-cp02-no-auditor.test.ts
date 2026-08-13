import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  validateRequirementsContractCp02AtomicClosure,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-cp00-cp04';

describe('requirements contract cp02 deterministic closure', () => {
  it('passes only atom/oracle/decision/authority/span/execution closure', () => {
    const result = validateRequirementsContractCp02AtomicClosure({
      atoms: [{
        atomId: 'MUST-001-A1',
        action: 'Persist the accepted decision.',
        oracle: 'The durable receipt can be read back byte-for-byte.',
        dependencies: [],
        coverageSeed: 'MUST-001',
        originBindings: [{ sourceRootId: 'MUST-FR-001', sourceSpanRef: 'SPAN-001' }],
        authorityRefs: ['AUTH-001'],
        spanRefs: ['SPAN-001'],
        executionConstraintRefs: ['CMD:targeted-test'],
      }],
      decisions: [],
      executionRegistry: {
        entries: [{ kind: 'CMD', id: 'targeted-test', value: 'npm test -- cp02.test.ts' }],
      },
    });
    expect(result).toMatchObject({ decision: 'pass', issueCodes: [] });
    expect(JSON.stringify(result)).not.toMatch(/auditor|judge|round/iu);
  });

  it('hard-cuts the old cp02 Auditor convergence identifier from production checkpoint code', () => {
    const checkpointSource = readFileSync(path.resolve(
      'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-checkpoint-semantic-validation.ts'
    ), 'utf8');
    const orchestrationSource = readFileSync(path.resolve(
      'packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts'
    ), 'utf8');
    const formalAuthorSource = readFileSync(path.resolve(
      'packages/bmad-speckit/src/main-agent/actions/source-authority-orchestration.ts'
    ), 'utf8');
    expect(checkpointSource).not.toContain('cp-02-atomic-decomposition-loop-convergence');
    expect(checkpointSource).not.toContain('consecutiveNoNewGapRounds');
    expect(orchestrationSource.includes('commitCriticalAuditorCheckpointOutcome')).toBe(false);
    expect(
      orchestrationSource.includes('critical_auditor_checkpoint_outcome_commit_mismatch')
    ).toBe(false);
    const legacyDeferredCompatibility = [
      'isCurrentDeferredCriticalAuditorCheckpointReceipt',
      'allowDeferredCriticalAuditorBlockers',
      'CRITICAL_AUDITOR_DEFERRED_CHECKPOINT',
      'auditorConvergenceDeferredToNextRound',
      'deferredCriticalAuditorBlockers',
    ].filter((symbol) => orchestrationSource.includes(symbol));
    expect(legacyDeferredCompatibility).toEqual([]);
    expect(formalAuthorSource).not.toContain('runCriticalAuditorReceiptLoop');
    expect(formalAuthorSource).not.toContain('consecutiveNoNewGapRounds < 3');
    const legacyFormalActionBranch = orchestrationSource.slice(
      orchestrationSource.indexOf("action === 'pre-confirmation-drilldown'"),
      orchestrationSource.indexOf("action === 'authoring-repair'")
    );
    expect(legacyFormalActionBranch).not.toContain('author-confirmation-ready-source');
    expect(legacyFormalActionBranch).not.toContain('author_confirmation_ready_source');
  });

  it('keeps the formal author CLI unreachable from the legacy Auditor loop', () => {
    const root = path.join(os.tmpdir(), `requirements-cp02-no-auditor-${process.pid}-${Date.now()}`);
    try {
      mkdirSync(path.join(root, 'docs'), { recursive: true });
      const intakePath = path.join(root, 'intake.md');
      const targetPath = path.join(root, 'requirements.md');
      writeFileSync(intakePath, [
        '---',
        'authoritySources:',
        '  - path: docs/functional.json',
        '    rootClass: functional_requirement',
        '    proposedAuthorityClass: source_authority',
        '    bodySchemaVersion: requirement-contract-requirement/v2',
        '---',
        '# Requirements',
        '',
      ].join('\n'), 'utf8');
      writeFileSync(path.join(root, 'docs', 'functional.json'), JSON.stringify({
        schemaVersion: 'requirements-contract-authority-source/v1',
        sourceRootId: 'MUST-FR-001',
        semanticBody: { text: 'System MUST persist accepted requirements.' },
      }), 'utf8');

      const run = spawnSync(process.execPath, [
        path.resolve('packages/bmad-speckit/bin/bmad-speckit.js'),
        'main-agent',
        'author-confirmation-ready-source',
        '--cwd',
        root,
        '--intake-source',
        intakePath,
        '--target-source',
        targetPath,
        '--confirmation-language',
        'en-US',
        '--legacy-orchestration',
        '--json',
      ], { cwd: process.cwd(), encoding: 'utf8', windowsHide: true });

      expect(run.status, run.stderr || run.stdout).toBe(0);
      expect(run.stderr).toBe('');
      const envelope = JSON.parse(run.stdout) as Record<string, any>;
      expect(envelope).toMatchObject({
        action: 'author-confirmation-ready-source',
        status: 'technical_planning_pending',
        data: {
          status: 'technical_planning_pending',
          issueCode: 'requirements_technical_planning_pending',
        },
      });
      const emittedPaths = readdirSync(root, { recursive: true }).map(String);
      expect(emittedPaths.filter((value) => /critical-auditor/iu.test(value))).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks cyclic atoms and execution refs outside the typed registry', () => {
    const result = validateRequirementsContractCp02AtomicClosure({
      atoms: [{
        atomId: 'ATOM-001',
        action: 'Persist the candidate.',
        oracle: 'The candidate can be read back.',
        dependencies: ['ATOM-001'],
        coverageSeed: 'MUST-001',
        originBindings: [{ sourceRootId: 'MUST-001', sourceSpanRef: 'SPAN-001' }],
        authorityRefs: ['AUTH-001'],
        spanRefs: ['SPAN-001'],
        executionConstraintRefs: ['CMD:missing-command'],
      }],
      decisions: [],
      executionRegistry: { entries: [] },
    });

    expect(result.decision).toBe('block');
    expect(result.issueCodes).toEqual(expect.arrayContaining([
      'requirements_cp02_dependency_cycle',
      'requirements_cp02_execution_constraint_unknown',
    ]));
  });
});
