import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it } from 'vitest';
import { governancePendingQueueFilePath } from '../../scripts/governance-runtime-queue';
import type { GovernancePostToolUseResult } from '../../scripts/governance-hook-types';
import {
  linkRepoNodeModulesIntoProject,
  writeMinimalRegistryAndProjectContext,
} from '../helpers/runtime-registry-fixture';

const require = createRequire(import.meta.url);
const cursorHook = require('../../_bmad/cursor/hooks/post-tool-use.cjs');
const claudeHook = require('../../_bmad/claude/hooks/post-tool-use.cjs');

const originalCwd = process.cwd();
const originalSkipBackgroundDrain = process.env.BMAD_SKIP_GOVERNANCE_BACKGROUND_DRAIN;
const tempRoots: string[] = [];

afterEach(() => {
  process.chdir(originalCwd);
  if (originalSkipBackgroundDrain === undefined) {
    delete process.env.BMAD_SKIP_GOVERNANCE_BACKGROUND_DRAIN;
  } else {
    process.env.BMAD_SKIP_GOVERNANCE_BACKGROUND_DRAIN = originalSkipBackgroundDrain;
  }
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

describe('governance post-tool-use hook', () => {
  it.each([
    ['claude', claudeHook],
    ['cursor', cursorHook],
  ])('enqueues governance rerun events and keeps %s background trigger on the unified adapter contract', (_, hook) => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'gov-post-tool-use-'));
    tempRoots.push(root);
    mkdirSync(path.join(root, '_bmad-output'), { recursive: true });
    process.chdir(root);
    process.env.BMAD_SKIP_GOVERNANCE_BACKGROUND_DRAIN = '1';

    const result = hook.postToolUse({
      type: 'governance-rerun-result',
      payload: {
        journeyContractHints: [
          {
            signal: 'smoke_task_chain',
            label: 'Smoke Task Chain',
            count: 1,
            affected_stages: ['tasks'],
            epic_stories: ['E14.S3'],
            recommendation:
              'Add at least one smoke task chain per Journey Slice and point setup tasks to that chain.',
          },
        ],
        runnerInput: {
          projectRoot: root,
          outputPath: path.join(root, '_bmad-output', 'planning-artifacts', 'attempt-2.md'),
          promptText: '继续 readiness 修复',
        },
        rerunGateResult: {
          gate: 'implementation-readiness',
          status: 'fail',
        },
      },
    }) as GovernancePostToolUseResult;

    const queueRoot = path.join(root, '_bmad-output', 'runtime', 'governance', 'queue');
    const queueBuckets = ['pending', 'processing', 'done', 'failed'] as const;
    const queueFileCount = queueBuckets.reduce((count, bucket) => {
      const bucketDir = path.join(queueRoot, bucket);
      if (!existsSync(bucketDir)) {
        return count;
      }
      return count + readdirSync(bucketDir).filter((file) => file.endsWith('.json')).length;
    }, 0);

    expect(result?.projectRoot).toBe(root);
    expect(result?.backgroundTrigger?.skipped).toBe(true);
    expect(result?.backgroundTrigger?.executorRouting).toMatchObject({
      routingMode: 'targeted',
      executorRoute: 'journey-contract-remediation',
      prioritizedSignals: ['smoke_task_chain'],
    });
    expect(result?.backgroundTrigger?.governancePresentation?.structuredMetadataLines).toEqual(
      expect.arrayContaining([
        '## Governance Structured Metadata',
        '- Routing Mode: targeted',
        '- Executor Route: journey-contract-remediation',
      ])
    );
    expect(result?.backgroundTrigger?.governancePresentation?.rawEventLines).toEqual(
      expect.arrayContaining(['## Governance Latest Raw Event', '暂无 governance raw event 摘要'])
    );
    expect(result?.backgroundTrigger?.journeyContractHints?.map((item) => item.signal)).toEqual([
      'smoke_task_chain',
    ]);
    expect(result?.backgroundTrigger?.stopReason).toBeNull();
    expect(result?.backgroundTrigger).not.toHaveProperty('pendingJourneyContractHints');
    expect(queueFileCount).toBeGreaterThanOrEqual(1);
    const pendingFiles = readdirSync(path.join(queueRoot, 'pending')).filter((file) =>
      file.endsWith('.json')
    );
    expect(pendingFiles.length).toBeGreaterThanOrEqual(1);
    const queued = JSON.parse(
      readFileSync(governancePendingQueueFilePath(root, pendingFiles[0].replace(/\.json$/i, '')), 'utf8')
    ) as {
      payload?: { journeyContractHints?: Array<{ signal: string }> };
    };
    expect(queued.payload?.journeyContractHints?.map((item: { signal: string }) => item.signal)).toEqual([
      'smoke_task_chain',
    ]);
  });

  it.each([
    ['claude', claudeHook],
    ['cursor', cursorHook],
  ])('drains stage-emitted rerun-result events before handling %s post-tool-use payload', (_, hook) => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'gov-post-tool-use-stage-event-'));
    tempRoots.push(root);
    mkdirSync(path.join(root, '_bmad-output', 'runtime', 'governance', 'queue', 'pending-events'), {
      recursive: true,
    });
    process.chdir(root);
    process.env.BMAD_SKIP_GOVERNANCE_BACKGROUND_DRAIN = '1';

    const stagedEventPath = path.join(
      root,
      '_bmad-output',
      'runtime',
      'governance',
      'queue',
      'pending-events',
      'stage-event.json'
    );
    const stagedEvent = {
      type: 'governance-rerun-result',
      payload: {
        projectRoot: root,
        sourceEventType: 'governance-pre-continue-check',
        runnerInput: {
          projectRoot: root,
          outputPath: path.join(root, '_bmad-output', 'planning-artifacts', 'attempt-stage.md'),
          promptText: '阶段治理失败后进入 rerun',
          rerunGate: 'architecture-contract-gate',
          capabilitySlot: 'bmad-create-architecture.step-04-decisions',
          attemptId: 'pre-continue-stage-1',
        },
        rerunGateResult: {
          gate: 'architecture-contract-gate',
          status: 'fail',
        },
      },
    };
    require('node:fs').writeFileSync(stagedEventPath, JSON.stringify(stagedEvent, null, 2), 'utf8');

    hook.postToolUse({
      type: 'governance-rerun-result',
      payload: {
        runnerInput: {
          projectRoot: root,
          outputPath: path.join(root, '_bmad-output', 'planning-artifacts', 'attempt-direct.md'),
          promptText: '直接 rerun',
        },
      },
    });

    const pendingDir = path.join(root, '_bmad-output', 'runtime', 'governance', 'queue', 'pending');
    const pendingFiles = readdirSync(pendingDir).filter((file) => file.endsWith('.json'));
    expect(pendingFiles.length).toBeGreaterThanOrEqual(2);
    const queuedPayloads = pendingFiles.map((file) =>
      JSON.parse(readFileSync(path.join(pendingDir, file), 'utf8')) as {
        payload?: { sourceEventType?: string; runnerInput?: { rerunGate?: string } };
      }
    );
    expect(
      queuedPayloads.some(
        (item) =>
          item.payload?.runnerInput?.rerunGate === 'architecture-contract-gate'
      )
    ).toBe(true);
    expect(existsSync(stagedEventPath)).toBe(false);
  });

  it.each([
    ['claude', claudeHook],
    ['cursor', cursorHook],
  ])('normalizes readiness remediation packets after %s writes the artifact', (_, hook) => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'gov-post-tool-use-packet-artifact-'));
    tempRoots.push(root);
    mkdirSync(path.join(root, '_bmad'), { recursive: true });
    linkRepoNodeModulesIntoProject(root);
    writeMinimalRegistryAndProjectContext(root, { flow: 'story', stage: 'story_create' });
    mkdirSync(path.join(root, '_bmad', '_config'), { recursive: true });
    require('node:fs').writeFileSync(
      path.join(root, '_bmad', '_config', 'governance-remediation.yaml'),
      ['version: 1', 'primaryHost: cursor', 'packetHosts:', '  - cursor', '  - claude'].join('\n'),
      'utf8'
    );

    const artifactPath = path.join(
      root,
      '_bmad-output',
      'planning-artifacts',
      'dev',
      'implementation-readiness-remediation-2026-04-09.md'
    );
    mkdirSync(path.dirname(artifactPath), { recursive: true });
    require('node:fs').writeFileSync(
      artifactPath,
      [
        '---',
        'reportType: Governance Remediation Artifact',
        'source: Implementation Readiness Assessment',
        'project: temp',
        'branch: dev',
        'date: 2026-04-09',
        'attemptId: implementation-readiness-2026-04-09',
        'capabilitySlot: qa.readiness',
        'outcome: needs_work',
        '---',
        '',
        '# Governance Remediation Artifact',
        '',
        '## Core Fields',
        '',
        '- Attempt ID: implementation-readiness-2026-04-09',
        '- Capability Slot: qa.readiness',
        '- Canonical Agent: PM + QA / readiness reviewer',
        '- Target Artifact(s):',
        '- prd.md',
        '- architecture.md',
        '- epics.md',
        '- Rerun Gate: implementation-readiness',
        '',
        '## Executor Routing Trace',
        '',
        '- Routing Mode: generic',
        '- Executor Route: default-gate-remediation',
        '- Packet Strategy: default-remediation-packet',
        '- Prioritized Signals: (none)',
        '- Routing Reason: generic routing',
      ].join('\n'),
      'utf8'
    );

    process.chdir(root);
    const result = hook.postToolUse({
      tool_name: 'Write',
      tool_input: {
        file_path: artifactPath,
      },
    });

    const cursorPacketPath = artifactPath.replace(/\.md$/i, '.cursor-packet.md');
    const claudePacketPath = artifactPath.replace(/\.md$/i, '.claude-packet.md');
    const cursorPacket = readFileSync(cursorPacketPath, 'utf8');
    const claudePacket = readFileSync(claudePacketPath, 'utf8');

    expect(result).toBeNull();
    expect(existsSync(cursorPacketPath)).toBe(true);
    expect(existsSync(claudePacketPath)).toBe(true);
    expect(cursorPacket).toContain('# Governance Remediation Executor Packet');
    expect(claudePacket).toContain('# Governance Remediation Executor Packet');
    expect(
      cursorPacket
        .replace(/- Host Kind: .+/g, '- Host Kind: <host>')
        .replace(/- Execution Mode: .+/g, '- Execution Mode: <mode>')
    ).toBe(
      claudePacket
        .replace(/- Host Kind: .+/g, '- Host Kind: <host>')
        .replace(/- Execution Mode: .+/g, '- Execution Mode: <mode>')
    );
  });

  it.each([
    ['claude', claudeHook],
    ['cursor', cursorHook],
  ])('re-overwrites handwritten readiness packet files after %s writes a packet path', (_, hook) => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'gov-post-tool-use-packet-overwrite-'));
    tempRoots.push(root);
    mkdirSync(path.join(root, '_bmad'), { recursive: true });
    linkRepoNodeModulesIntoProject(root);
    writeMinimalRegistryAndProjectContext(root, { flow: 'story', stage: 'story_create' });

    const artifactPath = path.join(
      root,
      '_bmad-output',
      'planning-artifacts',
      'dev',
      'implementation-readiness-remediation-2026-04-09.md'
    );
    mkdirSync(path.dirname(artifactPath), { recursive: true });
    require('node:fs').writeFileSync(
      artifactPath,
      [
        '# Governance Remediation Artifact',
        '',
        '## Core Fields',
        '- Capability Slot: qa.readiness',
        '- Target Artifact(s):',
        '- prd.md',
        '- architecture.md',
        '- epics.md',
        '- Rerun Gate: implementation-readiness',
      ].join('\n'),
      'utf8'
    );

    const cursorPacketPath = artifactPath.replace(/\.md$/i, '.cursor-packet.md');
    const claudePacketPath = artifactPath.replace(/\.md$/i, '.claude-packet.md');
    require('node:fs').writeFileSync(cursorPacketPath, '# Cursor Packet - handwritten\n', 'utf8');
    require('node:fs').writeFileSync(claudePacketPath, '# Claude Packet - handwritten\n', 'utf8');

    process.chdir(root);
    const result = hook.postToolUse({
      tool_name: 'Write',
      tool_input: {
        file_path: cursorPacketPath,
      },
    });

    expect(result).toBeNull();
    expect(readFileSync(cursorPacketPath, 'utf8')).toContain('# Governance Remediation Executor Packet');
    expect(readFileSync(claudePacketPath, 'utf8')).toContain('# Governance Remediation Executor Packet');
  });
});
