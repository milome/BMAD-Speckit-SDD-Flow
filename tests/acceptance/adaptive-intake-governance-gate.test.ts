import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runAdaptiveIntakeGovernanceGate } from '../../scripts/adaptive-intake-governance-gate';
import {
  readUserStoryMappingIndexOrDefault,
  writeUserStoryMappingIndex,
  type UserStoryMappingIndex,
} from '../../scripts/user-story-mapping';

function bootstrapProject(root: string, index: UserStoryMappingIndex): void {
  const contractPath = path.join(
    process.cwd(),
    '_bmad',
    '_config',
    'orchestration-governance.contract.yaml'
  );
  mkdirSync(path.join(root, '_bmad', '_config'), { recursive: true });
  mkdirSync(path.join(root, '_bmad-output', 'implementation-artifacts'), { recursive: true });
  writeFileSync(
    path.join(root, '_bmad', '_config', 'orchestration-governance.contract.yaml'),
    readFileSync(contractPath, 'utf8'),
    'utf8'
  );
  writeFileSync(
    path.join(root, '_bmad-output', 'implementation-artifacts', 'sprint-status.yaml'),
    [
      'generated: "2026-04-27"',
      'project: Fixture',
      'project_key: FIX',
      'tracking_system: file-system',
      'story_location: _bmad-output/implementation-artifacts',
      'development_status:',
      '  epic-payments: in-progress',
      '  story-payments: ready-for-dev',
      '  story-ledger: in-progress',
      '  story-docs: backlog',
    ].join('\n'),
    'utf8'
  );
  writeUserStoryMappingIndex(root, index);
}

describe('adaptive intake governance gate', () => {
  it('passes when an existing mapping is consistent and match scoring clears the auto-match threshold', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'adaptive-intake-pass-'));
    try {
      bootstrapProject(root, {
        version: 1,
        updatedAt: new Date().toISOString(),
        source: '_bmad-output/runtime/governance/user_story_mapping.json',
        items: [
          {
            requirementId: 'REQ-PAYMENTS-01',
            sourceType: 'churn_in',
            epicId: 'epic-payments',
            storyId: 'story-payments',
            flow: 'story',
            sprintId: 'SPRINT-1',
            allowedWriteScope: ['src/payments/**', 'tests/payments/**'],
            status: 'planned',
            updatedAt: new Date().toISOString(),
          },
        ],
      });

      const result = runAdaptiveIntakeGovernanceGate(
        root,
        {
          requirementId: 'REQ-PAYMENTS-01',
          sourceType: 'churn_in',
          flow: 'story',
          sprintId: 'SPRINT-1',
          epicId: 'epic-payments',
          storyId: 'story-payments',
          changedPaths: ['src/payments/charge.ts'],
          readiness: { implementationReady: true, riskLevel: 'low' },
        },
        { apply: true }
      );

      expect(result.decision.verdict).toBe('pass');
      expect(result.decision.route?.storyId).toBe('story-payments');
      expect(result.decision.applied).toBe(true);
      expect(result.scoring[0].scoreBreakdown.weightedTotal).toBeGreaterThanOrEqual(0.7);
      expect(existsSync(result.decision.queueSyncPath)).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks when sprint identity is missing even if a route candidate exists', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'adaptive-intake-missing-sprint-'));
    try {
      bootstrapProject(root, {
        version: 1,
        updatedAt: new Date().toISOString(),
        source: '_bmad-output/runtime/governance/user_story_mapping.json',
        items: [
          {
            requirementId: 'REQ-DOCS-01',
            sourceType: 'churn_in',
            epicId: 'epic-payments',
            storyId: 'story-docs',
            flow: 'story',
            sprintId: 'SPRINT-1',
            allowedWriteScope: ['docs/**'],
            status: 'planned',
            updatedAt: new Date().toISOString(),
          },
        ],
      });

      const result = runAdaptiveIntakeGovernanceGate(root, {
        requirementId: 'REQ-DOCS-01',
        sourceType: 'churn_in',
        flow: 'story',
        storyId: 'story-docs',
        epicId: 'epic-payments',
        changedPaths: ['docs/runbook.md'],
      });

      expect(result.decision.verdict).toBe('block');
      expect(result.consistency.sprintConsistency.failed).toContain('sprint_id_valid');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks when a requirement already has multiple active mappings', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'adaptive-intake-duplicate-'));
    try {
      bootstrapProject(root, {
        version: 1,
        updatedAt: new Date().toISOString(),
        source: '_bmad-output/runtime/governance/user_story_mapping.json',
        items: [
          {
            requirementId: 'REQ-LEDGER-01',
            sourceType: 'churn_in',
            epicId: 'epic-payments',
            storyId: 'story-payments',
            flow: 'story',
            sprintId: 'SPRINT-1',
            allowedWriteScope: ['src/payments/**'],
            status: 'planned',
            updatedAt: new Date().toISOString(),
          },
          {
            requirementId: 'REQ-LEDGER-01',
            sourceType: 'churn_in',
            epicId: 'epic-payments',
            storyId: 'story-ledger',
            flow: 'story',
            sprintId: 'SPRINT-1',
            allowedWriteScope: ['src/ledger/**'],
            status: 'in_progress',
            updatedAt: new Date().toISOString(),
          },
        ],
      });

      const result = runAdaptiveIntakeGovernanceGate(root, {
        requirementId: 'REQ-LEDGER-01',
        sourceType: 'churn_in',
        flow: 'story',
        sprintId: 'SPRINT-1',
        storyId: 'story-ledger',
        epicId: 'epic-payments',
        changedPaths: ['src/ledger/reconcile.ts'],
      });

      expect(result.decision.verdict).toBe('block');
      expect(result.consistency.mappingConsistency.failed).toContain(
        'requirement_to_story_unique_active'
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reroutes through the unified gate and deactivates the previous active mapping when apply=true', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'adaptive-intake-reroute-'));
    try {
      bootstrapProject(root, {
        version: 1,
        updatedAt: new Date().toISOString(),
        source: '_bmad-output/runtime/governance/user_story_mapping.json',
        items: [
          {
            requirementId: 'REQ-REROUTE-01',
            sourceType: 'churn_in',
            epicId: 'epic-payments',
            storyId: 'story-docs',
            flow: 'story',
            sprintId: 'SPRINT-1',
            allowedWriteScope: ['docs/**'],
            status: 'planned',
            updatedAt: new Date().toISOString(),
          },
          {
            requirementId: 'REQ-CATALOG-02',
            sourceType: 'churn_in',
            epicId: 'epic-payments',
            storyId: 'story-payments',
            flow: 'story',
            sprintId: 'SPRINT-1',
            allowedWriteScope: ['src/payments/**', 'tests/payments/**'],
            status: 'planned',
            updatedAt: new Date().toISOString(),
          },
        ],
      });

      const result = runAdaptiveIntakeGovernanceGate(
        root,
        {
          requirementId: 'REQ-REROUTE-01',
          sourceType: 'churn_in',
          flow: 'story',
          sprintId: 'SPRINT-1',
          storyId: 'story-payments',
          epicId: 'epic-payments',
          changedPaths: ['src/payments/charge.ts'],
          readiness: { implementationReady: true, riskLevel: 'low' },
        },
        { apply: true }
      );

      expect(result.decision.verdict).toBe('reroute');
      const updated = readUserStoryMappingIndexOrDefault(root);
      expect(
        updated.items.find(
          (item) => item.requirementId === 'REQ-REROUTE-01' && item.storyId === 'story-docs'
        )?.status
      ).toBe('blocked');
      expect(
        updated.items.find(
          (item) => item.requirementId === 'REQ-REROUTE-01' && item.storyId === 'story-payments'
        )?.status
      ).toBe('planned');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('emits a draft_pending_readiness artifact when no existing story can safely absorb the intake', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'adaptive-intake-draft-'));
    try {
      bootstrapProject(root, {
        version: 1,
        updatedAt: new Date().toISOString(),
        source: '_bmad-output/runtime/governance/user_story_mapping.json',
        items: [],
      });

      const result = runAdaptiveIntakeGovernanceGate(root, {
        requirementId: 'REQ-DRAFT-01',
        sourceType: 'churn_in',
        flow: 'story',
        sprintId: 'SPRINT-1',
        epicId: 'epic-payments',
        storyId: 'story-net-new',
        changedPaths: ['src/net-new/feature.ts'],
        summary: 'net new story needed',
      });

      expect(result.decision.verdict).toBe('warn');
      expect(result.decision.reason).toBe('draft_pending_readiness_required');
      expect(result.decision.draftPath).toBeTruthy();
      expect(existsSync(result.decision.draftPath!)).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
