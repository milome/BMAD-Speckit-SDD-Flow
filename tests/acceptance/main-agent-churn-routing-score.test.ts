import { execSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildMainAgentDispatchInstruction } from '../../scripts/main-agent-orchestration';
import { defaultRuntimeContextFile, writeRuntimeContext } from '../../scripts/runtime-context';
import {
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
      '  story-payments: in-progress',
      '  story-ledger: ready-for-dev',
      '  story-docs: backlog',
    ].join('\n'),
    'utf8'
  );
  writeUserStoryMappingIndex(root, index);
}

function runRouteIntake(root: string, inputPath: string): any {
  const command = [
    'npx ts-node --project tsconfig.node.json --transpile-only scripts/main-agent-orchestration.ts',
    '--cwd',
    `"${root}"`,
    '--flow',
    'story',
    '--stage',
    'implement',
    '--action',
    'route-intake',
    '--input',
    `"${inputPath}"`,
  ].join(' ');
  return JSON.parse(execSync(command, { cwd: process.cwd(), encoding: 'utf8' }));
}

describe('main-agent churn routing score', () => {
  it('produces a stable and explainable routing score order through the main-agent CLI surface', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-route-score-'));
    try {
      bootstrapProject(root, {
        version: 1,
        updatedAt: new Date().toISOString(),
        source: '_bmad-output/runtime/governance/user_story_mapping.json',
        items: [
          {
            requirementId: 'REQ-A',
            sourceType: 'churn_in',
            epicId: 'epic-payments',
            storyId: 'story-payments',
            flow: 'story',
            sprintId: 'SPRINT-1',
            allowedWriteScope: ['src/payments/**', 'tests/payments/**'],
            status: 'planned',
            updatedAt: new Date().toISOString(),
          },
          {
            requirementId: 'REQ-B',
            sourceType: 'churn_in',
            epicId: 'epic-payments',
            storyId: 'story-ledger',
            flow: 'story',
            sprintId: 'SPRINT-1',
            allowedWriteScope: ['src/ledger/**'],
            status: 'planned',
            updatedAt: new Date().toISOString(),
          },
          {
            requirementId: 'REQ-C',
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

      const inputPath = path.join(root, 'candidate.json');
      writeFileSync(
        inputPath,
        JSON.stringify(
          {
            requirementId: 'REQ-NEW-PAYMENTS',
            sourceType: 'churn_in',
            flow: 'story',
            sprintId: 'SPRINT-1',
            epicId: 'epic-payments',
            storyId: 'story-payments',
            changedPaths: ['src/payments/charge.ts'],
            readiness: { implementationReady: true, riskLevel: 'low' },
          },
          null,
          2
        ),
        'utf8'
      );

      const result = runRouteIntake(root, inputPath);

      expect(result.scoring[0].route.storyId).toBe('story-payments');
      expect(result.scoring[0].scoreBreakdown.impact).toBeGreaterThan(0);
      expect(result.scoring[0].scoreBreakdown.dependency).toBeGreaterThan(0);
      expect(result.scoring[0].scoreBreakdown.capacity).toBeGreaterThan(0);
      expect(result.scoring[0].scoreBreakdown.weightedTotal).toBeGreaterThanOrEqual(
        result.scoring[1].scoreBreakdown.weightedTotal
      );
      expect(result.scoring[1].scoreBreakdown.weightedTotal).toBeGreaterThanOrEqual(
        result.scoring[2].scoreBreakdown.weightedTotal
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('hydrates dispatch packets with allowedWriteScope from user_story_mapping instead of fallback scope', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-route-scope-'));
    try {
      bootstrapProject(root, {
        version: 1,
        updatedAt: new Date().toISOString(),
        source: '_bmad-output/runtime/governance/user_story_mapping.json',
        items: [
          {
            requirementId: 'REQ-PAYMENTS-02',
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
      writeRuntimeContext(
        root,
        defaultRuntimeContextFile({
          flow: 'story',
          stage: 'implement',
          epicId: 'epic-payments',
          storyId: 'story-payments',
          artifactRoot: '_bmad-output/implementation-artifacts/epic-payments/story-payments',
          updatedAt: new Date().toISOString(),
        })
      );

      const instruction = buildMainAgentDispatchInstruction({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
        hydratePacket: true,
      });

      expect(instruction).not.toBeNull();
      const packet = JSON.parse(readFileSync(instruction!.packetPath, 'utf8')) as {
        allowedWriteScope: string[];
      };
      expect(packet.allowedWriteScope).toEqual(['src/payments/**', 'tests/payments/**']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('returns reroute from the main-agent CLI surface instead of splitting into a side flow', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-route-reroute-'));
    try {
      bootstrapProject(root, {
        version: 1,
        updatedAt: new Date().toISOString(),
        source: '_bmad-output/runtime/governance/user_story_mapping.json',
        items: [
          {
            requirementId: 'REQ-REROUTE-02',
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
            requirementId: 'REQ-REFERENCE-03',
            sourceType: 'churn_in',
            epicId: 'epic-payments',
            storyId: 'story-payments',
            flow: 'story',
            sprintId: 'SPRINT-1',
            allowedWriteScope: ['src/payments/**'],
            status: 'planned',
            updatedAt: new Date().toISOString(),
          },
        ],
      });

      const inputPath = path.join(root, 'reroute-candidate.json');
      writeFileSync(
        inputPath,
        JSON.stringify(
          {
            requirementId: 'REQ-REROUTE-02',
            sourceType: 'churn_in',
            flow: 'story',
            sprintId: 'SPRINT-1',
            epicId: 'epic-payments',
            storyId: 'story-payments',
            changedPaths: ['src/payments/charge.ts'],
            readiness: { implementationReady: true, riskLevel: 'low' },
          },
          null,
          2
        ),
        'utf8'
      );

      const result = runRouteIntake(root, inputPath);

      expect(result.decision.verdict).toBe('reroute');
      expect(result.decision.route.storyId).toBe('story-payments');
      expect(result.decision.queueSyncPath).toContain('adaptive-intake-queue-sync');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
