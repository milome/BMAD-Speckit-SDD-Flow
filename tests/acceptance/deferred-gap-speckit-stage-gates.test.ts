import { cpSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..');

function writeFile(project: string, relativePath: string, content: string): string {
  const fullPath = join(project, relativePath);
  mkdirSync(join(fullPath, '..'), { recursive: true });
  writeFileSync(fullPath, content, 'utf8');
  return fullPath;
}

function writeRegister(project: string, relativeDir: string, body: string): string {
  return writeFile(project, `${relativeDir}/deferred-gap-register.yaml`, body);
}

function runPreContinue(project: string, workflow: string, step: string, artifactPath: string) {
  let stdout = '';
  try {
    stdout = execFileSync(
      process.execPath,
      [join(ROOT, '_bmad', 'runtime', 'hooks', 'pre-continue-check.cjs'), workflow, step],
      {
        cwd: project,
        encoding: 'utf8',
        env: {
          ...process.env,
          BMAD_PRECONTINUE_ARTIFACT_PATH: artifactPath,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
  } catch (error: any) {
    stdout = error.stdout || '';
  }
  return JSON.parse(stdout) as {
    ok: boolean;
    failures: string[];
    deferredGapStageAudit?: {
      stage: string;
      registerPath: string;
      registerExists: boolean;
      activeGapCount: number;
    };
  };
}

describe('deferred gap speckit stage gates', () => {
  it('blocks specify when inherited deferred gaps exist but deferred-gap-register.yaml is missing', () => {
    const project = mkdtempSync(join(tmpdir(), 'deferred-gap-specify-'));
    try {
      cpSync(join(ROOT, '_bmad'), join(project, '_bmad'), { recursive: true });
      mkdirSync(join(project, '.git'), { recursive: true });
      writeFileSync(join(project, '.git', 'HEAD'), 'ref: refs/heads/feature-gap\n', 'utf8');

      writeFile(
        project,
        '_bmad-output/implementation-artifacts/sprint-status.yaml',
        [
          'deferred_gap_plan:',
          '  items:',
          '    J04-Smoke-E2E:',
          '      status: deferred',
          '      resolution_target: Sprint 2+',
          '      owner: Dev Team',
          '      planned_work_items: []',
          '      explicit_reason: Carry forward',
        ].join('\n')
      );

      const specPath = writeFile(
        project,
        'specs/feature-gap/spec.md',
        [
          '# Spec',
          '',
          '## User Journeys',
          '',
          'P0 Journey checkout smoke E2E evidence traceability',
          '',
          '## Inherited Deferred Gaps',
          '',
          '- J04-Smoke-E2E',
          '',
          '## Deferred Gap Intake Mapping',
          '',
          '| Gap ID | Requirement | Status |',
          '|--------|-------------|--------|',
          '| J04-Smoke-E2E | Checkout | acknowledged |',
        ].join('\n')
      );

      const result = runPreContinue(project, 'speckit-specify', 'workflow', specPath);
      expect(result.ok).toBe(false);
      expect(result.failures).toEqual(
        expect.arrayContaining(['deferred_gap_register_missing: missing deferred-gap-register.yaml'])
      );
      expect(result.deferredGapStageAudit?.stage).toBe('specify');
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });

  it('blocks plan when mapped gap is missing journey and production path refs', () => {
    const project = mkdtempSync(join(tmpdir(), 'deferred-gap-plan-'));
    try {
      cpSync(join(ROOT, '_bmad'), join(project, '_bmad'), { recursive: true });
      mkdirSync(join(project, '.git'), { recursive: true });
      writeFileSync(join(project, '.git', 'HEAD'), 'ref: refs/heads/feature-gap\n', 'utf8');

      const planDir = 'specs/feature-gap';
      const planPath = writeFile(
        project,
        `${planDir}/plan.md`,
        [
          '# Plan',
          '',
          '## Testing Strategy',
          '',
          'P0 Journey smoke E2E evidence traceability',
          '',
          '## Deferred Gap Architecture Mapping',
          '',
          '| Gap ID | Mapping |',
          '|--------|---------|',
          '| J04-Smoke-E2E | checkout path |',
        ].join('\n')
      );

      writeRegister(
        project,
        planDir,
        [
          'version: 1',
          'gaps:',
          '  - gap_id: J04-Smoke-E2E',
          '    source_type: inherited',
          '    lifecycle_status: open',
          '    owner: Dev Team',
          '    resolution_target: Sprint 2+',
          '    plan_mapping:',
          '      status: mapped',
          '      architecture_refs:',
          '        - architecture.md#checkout',
          '      work_item_refs:',
          '        - T021',
        ].join('\n')
      );

      const result = runPreContinue(project, 'speckit-plan', 'workflow', planPath);
      expect(result.ok).toBe(false);
      expect(result.failures).toEqual(
        expect.arrayContaining([
          'deferred_gap_plan_mapping: gap J04-Smoke-E2E is missing journey_refs',
          'deferred_gap_plan_mapping: gap J04-Smoke-E2E is missing prod_path_refs',
        ])
      );
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });

  it('blocks tasks when planned gap does not bind smoke_task_ids and closure_task_id', () => {
    const project = mkdtempSync(join(tmpdir(), 'deferred-gap-tasks-'));
    try {
      cpSync(join(ROOT, '_bmad'), join(project, '_bmad'), { recursive: true });
      mkdirSync(join(project, '.git'), { recursive: true });
      writeFileSync(join(project, '.git', 'HEAD'), 'ref: refs/heads/feature-gap\n', 'utf8');

      const tasksDir = 'specs/feature-gap';
      const tasksPath = writeFile(
        project,
        `${tasksDir}/tasks.md`,
        [
          '# Tasks',
          '',
          '## Tasks',
          '',
          '- T021',
          '',
          '## Testing',
          '',
          '- smoke E2E',
          '',
          '## Deferred Gap Task Binding',
          '',
          '| Gap ID | Task |',
          '|--------|------|',
          '| J04-Smoke-E2E | T021 |',
          '',
          '## P0 Journey Ledger',
          '',
          '| Journey ID | Story | User-visible goal | Blocking dependencies | Smoke Proof | Full E2E / deferred reason | Closure Note |',
          '|------------|-------|-------------------|-----------------------|-------------|----------------------------|--------------|',
          '| J04 | US1 | Checkout | Payments | tests/e2e/smoke/checkout.spec.ts | deferred | closure-notes/J04.md |',
          '',
          '## Journey -> Task -> Test -> Closure',
          '',
          'Smoke Task Chain: T021 -> smoke-checkout',
          'Closure Task ID: CLOSE-J04',
        ].join('\n')
      );

      writeRegister(
        project,
        tasksDir,
        [
          'version: 1',
          'gaps:',
          '  - gap_id: J04-Smoke-E2E',
          '    source_type: inherited',
          '    lifecycle_status: open',
          '    owner: Dev Team',
          '    resolution_target: Sprint 2+',
          '    journey_refs:',
          '      - J04',
          '    task_binding:',
          '      status: planned',
          '      task_ids:',
          '        - T021',
        ].join('\n')
      );

      const result = runPreContinue(project, 'speckit-tasks', 'workflow', tasksPath);
      expect(result.ok).toBe(false);
      expect(result.failures).toEqual(
        expect.arrayContaining([
          'journey_runnable_task_chain: gap J04-Smoke-E2E is missing smoke_task_ids',
          'journey_runnable_task_chain: gap J04-Smoke-E2E is missing closure_task_id',
        ])
      );
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });

  it('blocks implement when resolved gap has no production path, smoke/full E2E, or acceptance evidence', () => {
    const project = mkdtempSync(join(tmpdir(), 'deferred-gap-implement-'));
    try {
      cpSync(join(ROOT, '_bmad'), join(project, '_bmad'), { recursive: true });
      mkdirSync(join(project, '.git'), { recursive: true });
      writeFileSync(join(project, '.git', 'HEAD'), 'ref: refs/heads/feature-gap\n', 'utf8');

      const storyRoot = 'specs/feature-gap';
      const tasksPath = writeFile(
        project,
        `${storyRoot}/tasks.md`,
        [
          '# Tasks',
          '',
          '## Tasks',
          '',
          '- T021',
          '',
          '## Testing',
          '',
          '- smoke E2E',
          '',
          '## Review Findings',
          '',
          '- none',
          '',
          '## P0 Journey Ledger',
          '',
          '| Journey ID | Story | User-visible goal | Blocking dependencies | Smoke Proof | Full E2E / deferred reason | Closure Note |',
          '|------------|-------|-------------------|-----------------------|-------------|----------------------------|--------------|',
          '| J04 | US1 | Checkout | Payments | tests/e2e/smoke/checkout.spec.ts | deferred | closure-notes/J04.md |',
          '',
          '## Journey -> Task -> Test -> Closure',
          '',
          'Smoke Task Chain: T021 -> smoke-checkout',
          'Closure Task ID: CLOSE-J04',
          '',
          '## Closure Notes',
          '',
          '- closure-notes/J04.md',
        ].join('\n')
      );

      writeFile(
        project,
        `${storyRoot}/journey-ledger.yaml`,
        [
          'journeys:',
          '  - journey_id: J04',
          '    prod_path:',
          '      integrated: false',
          '      entrypoints: []',
          '      integration_evidence: []',
          '    e2e:',
          '      smoke:',
          '        test_ids:',
          '          - smoke-checkout',
          '      full:',
          '        status: deferred',
          '        defer_reason: carry-forward',
          '    acceptance:',
          '      closure_note: closure-notes/J04.md',
          '      evidence: []',
        ].join('\n')
      );
      writeFile(project, `${storyRoot}/invariant-ledger.md`, '# Invariant Ledger\n');
      writeFile(project, `${storyRoot}/trace-map.json`, JSON.stringify({ journeys: ['J04'] }, null, 2));
      writeFile(project, `${storyRoot}/closure-notes/J04.md`, '# Closure Note\n');

      writeRegister(
        project,
        storyRoot,
        [
          'version: 1',
          'gaps:',
          '  - gap_id: J04-Smoke-E2E',
          '    source_type: inherited',
          '    lifecycle_status: resolved',
          '    owner: Dev Team',
          '    resolution_target: Sprint 2+',
          '    implementation:',
          '      status: resolved',
          '      closure_evidence:',
          '        - commit:abc123',
        ].join('\n')
      );

      const result = runPreContinue(project, 'bmad-dev-story', 'workflow', tasksPath);
      expect(result.ok).toBe(false);
      expect(result.failures).toEqual(
        expect.arrayContaining([
          'production_path_integration_gate: gap J04-Smoke-E2E is resolved without production path evidence',
          'journey_runnable_proof_gate: gap J04-Smoke-E2E is resolved without smoke proof',
          'journey_runnable_proof_gate: gap J04-Smoke-E2E is resolved without full E2E proof or defer reason',
          'journey_runnable_proof_gate: gap J04-Smoke-E2E is resolved without acceptance evidence',
          'journey_runnable_proof_gate: gap J04-Smoke-E2E is resolved without journey_refs',
        ])
      );
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });
});
