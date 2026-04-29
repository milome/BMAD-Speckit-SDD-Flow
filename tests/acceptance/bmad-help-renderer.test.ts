import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import {
  buildBmadHelpOutput,
  renderBmadHelp,
} from '../../scripts/bmad-help-renderer';
import {
  buildBmadsOutput,
  renderBmads,
} from '../../scripts/bmads-renderer';

function makeRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-help-boundary-'));
  fs.cpSync(path.resolve('_bmad'), path.join(root, '_bmad'), { recursive: true });
  fs.mkdirSync(path.join(root, '_bmad-output', 'runtime', 'context'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '_bmad-output', 'runtime', 'context', 'project.json'),
    '{"flow":"story","stage":"prd"}\n',
    'utf8'
  );
  return root;
}

function existingFiles(files: string[]): string[] {
  return files.filter((file) => fs.existsSync(path.resolve(file)));
}

const BMADS_AUTO_QUARANTINE_FILES = [
  '_bmad/commands/bmads-auto.md',
  '.codex/commands/bmads-auto.md',
  '.cursor/commands/bmads-auto.md',
  '.claude/commands/bmads-auto.md',
];
const BMADS_AUTO_SKILL_FILE = '_bmad/skills/bmads-auto/SKILL.md';

describe('bmad-help and BMADS runtime boundary', () => {
  it('preserves upstream bmad-help core while allowing project skill extensions', () => {
    const report = JSON.parse(
      execFileSync(process.execPath, ['scripts/compare-bmad-help-upstream.js'], {
        cwd: path.resolve('.'),
        encoding: 'utf8',
      })
    );

    expect(report.validation.status).toBe('pass');
    expect(report.validation.upstreamCorePreserved).toBe(true);
    expect(report.validation.projectExtensionsAllowed).toBe(true);
    expect(report.validation.changedRowsWithinAllowedFields).toBe(true);
    expect(report.validation.workflowCoreRulesPreserved).toBe(true);
    expect(report.validation.noForbiddenWorkflowPollution).toBe(true);
    expect(report.catalog.added.map((item: { code: string }) => item.code).sort()).toEqual([
      'BA',
      'RG',
      'ST',
    ]);
    expect(report.catalog.changed.every((item: { highRiskRoutingFields: string[] }) =>
      item.highRiskRoutingFields.length === 0
    )).toBe(true);
  });

  it('keeps BMADS main-agent routes out of the BMAD Method help catalog', () => {
    const csv = fs.readFileSync(path.resolve('_bmad', '_config', 'bmad-help.csv'), 'utf8');

    expect(csv).not.toContain('main-agent,layer_1_intake');
    expect(csv).not.toContain('CX1');
    expect(csv).not.toContain('CX5');
    expect(csv).not.toContain('host=codex;layer=layer_1');
  });

  it('keeps bmad-help command surfaces on the upstream skill workflow', () => {
    for (const file of existingFiles([
      '_bmad/commands/bmad-help.md',
      '.codex/commands/bmad-help.md',
      '.cursor/commands/bmad-help.md',
      '.claude/commands/bmad-help.md',
    ])) {
      const content = fs.readFileSync(path.resolve(file), 'utf8');
      expect(content).toContain('_bmad/core/skills/bmad-help/SKILL.md');
      expect(content).toContain('_bmad/core/tasks/help.md');
      expect(content).toContain('READ AND EXECUTE');
      expect(content).toContain('Do **not** call `scripts/bmad-help-renderer.ts`');
      expect(content).not.toContain('Project State Card');
      expect(content).not.toContain('main-agent control');
    }
  });

  it('keeps host-specific bmad-help skill workflows free of BMADS control-plane directives', () => {
    for (const file of existingFiles([
      '_bmad/core/skills/bmad-help/workflow.md',
      '.codex/skills/bmad-help/workflow.md',
      '.cursor/skills/bmad-help/workflow.md',
      '.claude/skills/bmad-help/workflow.md',
    ])) {
      const content = fs.readFileSync(path.resolve(file), 'utf8');
      expect(content).toContain('# Task: BMAD Help');
      expect(content).toContain('## ROUTING RULES');
      expect(content).not.toContain('CODEX / MAIN-AGENT FIVE-LAYER FIRST SCREEN');
      expect(content).not.toContain('layer_1 -> layer_5');
      expect(content).not.toContain('main-agent-orchestration --host codex');
      expect(content).not.toContain('bmads-auto recommended');
      expect(content).not.toContain('bmads-auto verify');
    }
  });

  it('renders bmad-help without Project State Card, five-layer, Codex, or main-agent control plane content', () => {
    const root = makeRoot();
    try {
      const output = buildBmadHelpOutput({ projectRoot: root });
      const text = renderBmadHelp(output);

      expect(text).toContain('# bmad-help');
      expect(text).toContain('## Status Summary');
      expect(text).toContain('## Recommended Next Steps');
      expect(text).toContain('## Upstream Workflow Guidance');
      expect(text).toContain('bmad-story-assistant');
      expect(text).not.toContain('Project State Card');
      expect(text).not.toContain('layer_1 -> layer_5');
      expect(text).not.toContain('CODEX / MAIN-AGENT FIVE-LAYER FIRST SCREEN');
      expect(text).not.toContain('BMADS Advisory');
      expect(text).not.toContain('main-agent automation');
      expect(text).not.toContain('Delivery truth');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('renders BMADS runtime console from bmads-runtime.yaml and existing contracts', () => {
    const root = makeRoot();
    try {
      const output = buildBmadsOutput(root);
      const text = renderBmads(output);

      expect(text).toContain('# BMADS Runtime Console');
      expect(text).toContain('## Project State');
      expect(text).toContain('## Upstream BMAD Artifacts');
      expect(text).toContain('Product briefs: missing');
      expect(text).toContain('Governance source: orchestration-governance.contract.yaml');
      expect(text).toContain('bmad-speckit main-agent-orchestration --action inspect');
      expect(text).toContain('Run bmad-help for full BMAD Method workflow guidance');
      expect(JSON.stringify(output)).toContain('"artifacts"');
      expect(JSON.stringify(output)).toContain('_bmad/_config/orchestration-governance.contract.yaml');
      expect(JSON.stringify(output)).toContain('scripts/orchestration-dispatch-contract.ts');
      expect(JSON.stringify(output)).toContain('_bmad/_config/stage-mapping.yaml');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('keeps layer_3 story creation behind epics planning and readiness instead of direct development', () => {
    const runtime = fs.readFileSync(path.resolve('_bmad', '_config', 'bmads-runtime.yaml'), 'utf8');
    const storyCreateBlock =
      runtime.match(/ {6}- id: story_create[\s\S]*?(?=\n\n {2}- id: layer_4)/)?.[0] ?? '';

    expect(storyCreateBlock).toContain('bmad-bmm-create-epics-and-stories');
    expect(storyCreateBlock).toContain('bmad-bmm-check-implementation-readiness');
    expect(storyCreateBlock).toContain('bmad-bmm-sprint-planning');
    expect(storyCreateBlock).toContain('bmad-bmm-create-story');
    expect(storyCreateBlock).not.toContain('bmad-story-assistant');
  });

  it.skipIf(existingFiles(BMADS_AUTO_QUARANTINE_FILES).length === 0)(
    'quarantines bmads-auto and points users to main-agent orchestration across host command surfaces',
    () => {
      for (const file of existingFiles(BMADS_AUTO_QUARANTINE_FILES)) {
        const content = fs.readFileSync(path.resolve(file), 'utf8');
        expect(content).toContain('Deprecated');
        expect(content).toContain('main-agent-orchestration --action inspect');
        expect(content).toContain('main-agent-orchestration --action dispatch-plan');
        expect(content).toContain('main-agent-orchestration --action run-loop');
        expect(content).toContain('main-agent:release-gate');
        expect(content).toContain('main-agent:delivery-truth-gate');
        expect(content).toContain('Do not route through `bmads-auto`');
      }

      if (fs.existsSync(path.resolve(BMADS_AUTO_SKILL_FILE))) {
        const skill = fs.readFileSync(path.resolve(BMADS_AUTO_SKILL_FILE), 'utf8');
        expect(skill).toContain('Deprecated');
        expect(skill).toContain('Do not call `bmads-auto` from `bmads`');
        expect(skill).toContain('Do not create dispatch packets');
        expect(skill).toContain('cannot claim completion');
      }

      const rootSkill = fs.readFileSync(path.resolve('_bmad', 'skills', 'bmad-speckit', 'SKILL.md'), 'utf8');
      expect(rootSkill).toContain('Do not route through `bmads-auto`');
      expect(rootSkill).toContain('main-agent-orchestration --action inspect');
    }
  );

  it('renders completed layer artifacts and blocks story assistant when readiness is not ready', () => {
    const text = renderBmads({
      progress: {
        currentLayer: 'layer_3',
        currentStage: 'story_create',
        nextRequiredLayer: 'layer_3',
        completedLayers: ['layer_1', 'layer_2'],
        stageStatuses: [
          {
            layer: 'layer_1',
            stage: 'prd',
            completed: true,
            evidenceKind: 'strict_marker',
            evidencePath: 'D:/repo/_bmad-output/runtime/context/layer_1-prd.complete.json',
          },
          {
            layer: 'layer_2',
            stage: 'arch',
            completed: true,
            evidenceKind: 'upstream_artifact',
            evidencePath: 'D:/repo/_bmad-output/planning-artifacts/architecture.md',
          },
          {
            layer: 'layer_3',
            stage: 'story_create',
            completed: false,
            evidenceKind: 'missing',
            evidencePath: 'D:/repo/docs/stories/layer_3-story_create.complete.json',
          },
        ],
      },
      artifacts: {
        productBriefs: [],
        prds: [
          {
            path: '_bmad-output/planning-artifacts/prd.md',
            bytes: 100,
            updatedAt: '2026-04-29T00:00:00.000Z',
          },
        ],
        architectures: [
          {
            path: '_bmad-output/planning-artifacts/architecture.md',
            bytes: 100,
            updatedAt: '2026-04-29T00:00:00.000Z',
          },
        ],
        epics: [
          {
            path: '_bmad-output/planning-artifacts/epics.md',
            bytes: 100,
            updatedAt: '2026-04-29T00:00:00.000Z',
          },
        ],
      },
      currentRoute: {
        layerName: 'Epic And Story Planning',
        governanceStage: 'story_create',
        requiredGovernanceSignalsFrom: 'orchestration-governance.contract.yaml',
        recommendedWorkflows: [
          'bmad-bmm-create-epics-and-stories',
          'bmad-bmm-check-implementation-readiness',
          'bmad-bmm-sprint-planning',
          'bmad-bmm-create-story',
        ],
        blockedWorkflows: [
          {
            workflow: 'bmad-story-assistant',
            reason: 'implementation-readiness must be READY / ready_clean / repair_closed before story development.',
          },
        ],
        dispatch: null,
        gates: null,
        next: { layer: 'layer_4', stage: 'specify' },
      },
      readiness: {
        status: 'missing',
        reportPath: null,
        reason: 'No implementation-readiness report was found.',
      },
      orchestration: {
        nextAction: null,
        ready: false,
        pendingPacketStatus: 'none',
        sessionId: 'test-session',
      },
      contractStatus: {
        governance: true,
        dispatch: true,
        stageMapping: true,
      },
      advisory: {
        bmadHelpCommand: 'bmad-help',
        message: 'Run bmad-help for full BMAD Method workflow guidance.',
      },
      commandHints: ['bmads'],
    });

    expect(text).toContain('## Completed Layer Artifacts');
    expect(text).toContain('layer_1/prd: strict_marker');
    expect(text).toContain('layer_2/arch: upstream_artifact');
    expect(text).toContain('Status: missing');
    expect(text).toContain('bmad-bmm-create-epics-and-stories');
    expect(text).toContain('Blocked workflows:');
    expect(text).toContain('bmad-story-assistant: implementation-readiness must be READY');
  });

  it('marks historical readiness reports stale when runtime context is newer', () => {
    const root = makeRoot();
    try {
      const reportDir = path.join(root, '_bmad-output', 'planning-artifacts');
      const reportPath = path.join(reportDir, 'implementation-readiness-report-2026-03-23.md');
      fs.mkdirSync(reportDir, { recursive: true });
      fs.writeFileSync(reportPath, '# Implementation Readiness\n\n**READY**\n', 'utf8');
      const oldTime = new Date('2026-03-23T00:00:00Z');
      const newTime = new Date('2026-04-29T00:00:00Z');
      fs.utimesSync(reportPath, oldTime, oldTime);
      fs.utimesSync(path.join(root, '_bmad-output', 'runtime', 'context', 'project.json'), newTime, newTime);

      const output = buildBmadsOutput(root) as {
        readiness: { status: string; reason: string };
      };

      expect(output.readiness.status).toBe('stale');
      expect(output.readiness.reason).toContain('older than the active runtime context');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not expose bmad-help as a terminal/package renderer and keeps bmads as the runtime console', () => {
    const root = makeRoot();
    try {
      const env = { ...process.env, TS_NODE_PROJECT: 'tsconfig.node.json' };
      const bmadsCli = path.resolve('scripts', 'bmads-renderer.ts');
      const packageCli = path.resolve('packages', 'bmad-speckit', 'bin', 'bmad-speckit.js');
      const packageJson = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8')) as {
        scripts?: Record<string, string>;
      };

      expect(packageJson.scripts?.['bmad-help']).toBeUndefined();

      const packageHelp = execFileSync(
        process.execPath,
        [packageCli, '--help'],
        { cwd: path.resolve('.'), encoding: 'utf8' }
      );

      expect(packageHelp).not.toContain('  bmad-help ');
      expect(packageHelp).toContain('  bmads ');
      expect(packageHelp).toContain('  bmad-speckit ');

      const bmads = execFileSync(
        process.execPath,
        ['-r', 'ts-node/register/transpile-only', bmadsCli, '--cwd', root],
        { cwd: path.resolve('.'), encoding: 'utf8', env }
      );
      expect(bmads).toContain('# BMADS Runtime Console');

      const packageBmads = execFileSync(
        process.execPath,
        [packageCli, 'bmads', '--cwd', root],
        { cwd: path.resolve('.'), encoding: 'utf8' }
      );
      expect(packageBmads).toContain('# BMADS Runtime Console');

      const packageAlias = execFileSync(
        process.execPath,
        [packageCli, 'bmad-speckit', '--cwd', root],
        { cwd: path.resolve('.'), encoding: 'utf8' }
      );
      expect(packageAlias).toContain('# BMADS Runtime Console');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }, 60_000);
});
