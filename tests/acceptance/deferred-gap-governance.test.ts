import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { readOrchestrationState } from '../../scripts/orchestration-state';

const ROOT = join(import.meta.dirname, '..', '..');

function buildReadinessReport(lines: string[]): string {
  return [
    '# Implementation Readiness Report',
    '',
    '## Blockers Requiring Immediate Action',
    '',
    '- IR-BLK-001: missing proof chain',
    '',
    '## Deferred Gaps',
    '',
    ...lines,
    '',
    '## Deferred Gaps Tracking',
    '',
    '| Gap ID | 描述 | 原因 | 解决时机 | Owner | 状态检查点 |',
    '|--------|------|------|----------|-------|-----------|',
    '| Epic3-4-UX | 缺少正式 UX 规范 | MVP 可基于 PRD | Epic 3 开始前 | UX Designer | Epic 3 Planning |',
    '',
    '## Four-Signal Governance Contract Status',
    '',
    'P0 Journey Coverage Matrix / Smoke E2E Preconditions Traceability / Evidence & Proof Chain / Cross-Document Traceability / Four-Signal Contract Verification',
    '',
    '## P0 Journey Coverage Matrix',
    '',
    '| PRD Journey ID | PRD Journey Name | Arch P0 Key Path | Epic Coverage | Status | Evidence |',
    '|----------------|------------------|------------------|---------------|--------|----------|',
    '| J01 | Checkout | KP-01 | Epic 1 | ✅ | arch.md |',
    '',
    '## Smoke E2E Preconditions Traceability',
    '',
    '- E2E test strategy',
    '- Critical paths',
    '',
    '## Cross-Document Traceability',
    '',
    '- PRD Requirement',
    '- Architecture Decision',
    '- Epic Story',
    '- Traceability Status',
    '',
    '## Four-Signal Contract Verification',
    '',
    '- P0 Journey smoke E2E evidence traceability',
    '',
  ].join('\n');
}

describe('deferred gap governance', () => {
  it('locks sprint planning, gate config, and weekly audit workflow contracts', () => {
    const gateConfig = readFileSync(join(ROOT, '_bmad', '_config', 'architecture-gates.yaml'), 'utf8');
    const sprintInstructions = readFileSync(
      join(ROOT, '_bmad', 'bmm', 'workflows', '4-implementation', 'sprint-planning', 'instructions.md'),
      'utf8'
    );
    const sprintTemplate = readFileSync(
      join(ROOT, '_bmad', 'bmm', 'workflows', '4-implementation', 'sprint-planning', 'sprint-status-template.yaml'),
      'utf8'
    );
    const sprintChecklist = readFileSync(
      join(ROOT, '_bmad', 'bmm', 'workflows', '4-implementation', 'sprint-planning', 'checklist.md'),
      'utf8'
    );
    const workflow = readFileSync(join(ROOT, '.github', 'workflows', 'deferred-gap-audit.yml'), 'utf8');

    expect(gateConfig).toContain('- Deferred Gaps Tracking');
    expect(sprintInstructions).toContain('If the latest readiness report contains deferred gaps');
    expect(sprintInstructions).toContain('deferred_gap_plan');
    expect(sprintTemplate).toContain('deferred_gap_plan:');
    expect(sprintTemplate).toContain('planned_work_items:');
    expect(sprintChecklist).toContain('every deferred gap appears under `deferred_gap_plan.items`');
    expect(workflow).toContain("cron: '0 2 * * 1'");
    expect(workflow).toContain('npx bmad-speckit deferred-gap-audit');
  });

  it('blocks pre-continue when a deferred gap disappears without resolution evidence and enqueues remediation follow-up', () => {
    const project = mkdtempSync(join(tmpdir(), 'deferred-gap-governance-'));
    try {
      cpSync(join(ROOT, '_bmad'), join(project, '_bmad'), { recursive: true });
      mkdirSync(join(project, '.git'), { recursive: true });
      writeFileSync(join(project, '.git', 'HEAD'), 'ref: refs/heads/feature-gap\n', 'utf8');

      const reportDir = join(project, '_bmad-output', 'planning-artifacts', 'feature-gap');
      mkdirSync(reportDir, { recursive: true });

      writeFileSync(
        join(reportDir, 'implementation-readiness-report-2026-04-07.md'),
        buildReadinessReport([
          '- J04-Smoke-E2E: P0 Journey J04 缺少 Smoke E2E',
          '  - Reason: P2 优先级',
          '  - Resolution Target: Sprint 2+',
          '  - Owner: Dev Team',
          '- Epic3-4-UX: 缺少正式 UX 规范',
          '  - Reason: MVP 可基于 PRD',
          '  - Resolution Target: Epic 3 开始前',
          '  - Owner: UX Designer',
        ]),
        'utf8'
      );

      writeFileSync(
        join(reportDir, 'implementation-readiness-report-2026-04-08.md'),
        buildReadinessReport([
          '- Epic3-4-UX: 缺少正式 UX 规范',
          '  - Reason: MVP 可基于 PRD',
          '  - Resolution Target: Epic 3 开始前',
          '  - Owner: UX Designer',
        ]),
        'utf8'
      );

      let stdout = '';
      try {
        stdout = execFileSync(
          process.execPath,
          [
            join(ROOT, '_bmad', 'runtime', 'hooks', 'pre-continue-check.cjs'),
            'check-implementation-readiness',
            'step-06-final-assessment',
          ],
          {
            cwd: project,
            encoding: 'utf8',
            env: {
              ...process.env,
              BMAD_PRECONTINUE_ARTIFACT_PATH: join(
                reportDir,
                'implementation-readiness-report-2026-04-08.md'
              ),
            },
            stdio: ['ignore', 'pipe', 'pipe'],
          }
        );
      } catch (error: any) {
        stdout = error.stdout || '';
      }

      const result = JSON.parse(stdout) as {
        ok: boolean;
        failures: string[];
        next_action?: string;
        ready?: boolean;
        orchestration_state?: string;
        pending_packet?: string;
        session_id?: string;
        deferredGapAudit?: {
          deferred_gap_count: number;
          deferred_gaps_explicit: boolean;
          previousReportPath: string | null;
        };
      };

      expect(result.ok).toBe(false);
      expect(result.failures).toEqual(
        expect.arrayContaining([
          'deferred_gap_consistency: gap J04-Smoke-E2E was removed without resolution evidence',
        ])
      );
      expect(result.next_action).toBe('dispatch_remediation');
      expect(result.ready).toBe(true);
      expect(typeof result.orchestration_state).toBe('string');
      expect(typeof result.pending_packet).toBe('string');
      expect(typeof result.session_id).toBe('string');
      expect(result.deferredGapAudit?.deferred_gap_count).toBe(1);
      expect(result.deferredGapAudit?.deferred_gaps_explicit).toBe(true);

      const state = readOrchestrationState(project, result.session_id!);
      expect(state?.nextAction).toBe('dispatch_remediation');
      expect(state?.pendingPacket?.status).toBe('ready_for_main_agent');

      const pendingDir = join(project, '_bmad-output', 'runtime', 'governance', 'queue', 'pending');
      expect(existsSync(pendingDir)).toBe(false);
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });
});
