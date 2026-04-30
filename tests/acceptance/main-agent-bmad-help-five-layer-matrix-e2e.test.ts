import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildLayer1PrdCompletionMarker,
  markBmadHelpFiveLayerStageComplete,
  resolveBmadHelpFiveLayerProgressState,
  runBmadHelpFiveLayerMatrix,
  validateLayer1PrdCompletionMarker,
  writeLayer1PrdCompletionMarker,
} from '../../scripts/main-agent-bmad-help-five-layer-matrix';
import { resolveBmadHelpRuntimePolicy } from '../../scripts/bmad-help-routing-state';

describe('BMADS five-layer main-agent matrix', () => {
  function writeLayer1Inputs(root: string): void {
    fs.mkdirSync(path.join(root, '_bmad-output', 'planning-artifacts', 'dev'), {
      recursive: true,
    });
    fs.mkdirSync(path.join(root, '_bmad-output', 'runtime', 'context'), { recursive: true });
    fs.writeFileSync(
      path.join(root, '_bmad-output', 'planning-artifacts', 'dev', 'prd.md'),
      '# PRD\n\nLayer 1 PRD evidence.\n',
      'utf8'
    );
    fs.writeFileSync(
      path.join(root, '_bmad-output', 'planning-artifacts', 'product-brief-demo.md'),
      '# Product Brief\n\nLayer 1 product brief evidence.\n',
      'utf8'
    );
    fs.writeFileSync(
      path.join(root, '_bmad-output', 'runtime', 'context', 'project.json'),
      '{"flow":"story","stage":"prd"}\n',
      'utf8'
    );
  }

  it('proves the BMADS runtime route can drive every canonical layer through the main-agent control plane', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-help-five-layer-'));
    try {
      fs.cpSync(path.resolve('_bmad'), path.join(root, '_bmad'), { recursive: true });
      fs.cpSync(path.resolve('docs'), path.join(root, 'docs'), { recursive: true });
      fs.copyFileSync(path.resolve('README.md'), path.join(root, 'README.md'));

      const report = runBmadHelpFiveLayerMatrix({ projectRoot: root });

      expect(report.allPassed).toBe(true);
      expect(report.bmadHelpEntry.catalogLoaded).toBe(true);
      expect(report.bmadHelpEntry.canonicalHelpWorkflow).toBe(true);
      expect(report.bmadHelpEntry.codexFirstClass).toBe(true);
      expect(report.bmadHelpEntry.fiveLayerCatalog).toBe(true);
      expect(report.bmadHelpEntry.docsExposeCodex).toBe(true);
      expect(report.bmadHelpEntry.bmadsRuntimeContract).toBe(true);
      expect(report.bmadHelpEntry.bmadHelpIsUpstreamOnly).toBe(true);
      expect(report.progressState.currentLayer).toBe('layer_1');
      expect(report.progressState.currentStage).toBe('prd');
      expect(report.progressState.nextRequiredLayer).toBe('layer_1');
      expect(report.layers.map((layer) => layer.id)).toEqual([
        'layer_1',
        'layer_2',
        'layer_3',
        'layer_4',
        'layer_5',
      ]);
      expect(report.layers.every((layer) => layer.passed)).toBe(true);
      expect(report.steps.length).toBeGreaterThanOrEqual(10);
      expect(report.steps.every((step) => step.passed)).toBe(true);
      expect(report.steps.every((step) => step.orchestration.pendingPacketStatus === 'completed')).toBe(
        true
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('derives the current layer from project progress instead of always recommending layer_1', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-help-five-layer-progress-'));
    try {
      fs.cpSync(path.resolve('_bmad'), path.join(root, '_bmad'), { recursive: true });
      writeLayer1Inputs(root);

      for (const [layer, stages] of [
        ['layer_1', ['prd']],
        ['layer_2', ['arch']],
        ['layer_3', ['epics', 'story_create']],
      ] as const) {
        for (const stage of stages) {
          markBmadHelpFiveLayerStageComplete({ projectRoot: root, layer, stage: stage as any });
        }
      }

      const state = resolveBmadHelpFiveLayerProgressState({ projectRoot: root });

      expect(state.completedLayers).toEqual(['layer_1', 'layer_2', 'layer_3']);
      expect(state.currentLayer).toBe('layer_4');
      expect(state.currentStage).toBe('specify');
      expect(state.nextRequiredLayer).toBe('layer_4');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('advances to layer_5 closeout after layer_4 speckit stages are complete', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-help-five-layer-closeout-'));
    try {
      fs.cpSync(path.resolve('_bmad'), path.join(root, '_bmad'), { recursive: true });
      writeLayer1Inputs(root);

      for (const [layer, stages] of [
        ['layer_1', ['prd']],
        ['layer_2', ['arch']],
        ['layer_3', ['epics', 'story_create']],
        ['layer_4', ['specify', 'plan', 'gaps', 'tasks', 'implement']],
      ] as const) {
        for (const stage of stages) {
          markBmadHelpFiveLayerStageComplete({ projectRoot: root, layer, stage: stage as any });
        }
      }

      const state = resolveBmadHelpFiveLayerProgressState({ projectRoot: root });

      expect(state.completedLayers).toEqual(['layer_1', 'layer_2', 'layer_3', 'layer_4']);
      expect(state.currentLayer).toBe('layer_5');
      expect(state.currentStage).toBe('post_audit');
      expect(state.nextRequiredLayer).toBe('layer_5');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('exposes currentLayer/currentStage/nextRequiredLayer through real bmad-help routing state', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-help-routing-five-layer-'));
    try {
      fs.cpSync(path.resolve('_bmad'), path.join(root, '_bmad'), { recursive: true });
      writeLayer1Inputs(root);
      markBmadHelpFiveLayerStageComplete({ projectRoot: root, layer: 'layer_1', stage: 'prd' as any });

      const policy = resolveBmadHelpRuntimePolicy({
        projectRoot: root,
        flow: 'story',
        stage: 'specify',
        runtimeContext: {
          flow: 'story',
          stage: 'specify',
          sourceMode: 'full_bmad',
          contextScope: 'story',
          runId: 'routing-five-layer-test',
          version: 1,
          updatedAt: new Date().toISOString(),
        },
      });

      expect(policy.helpRouting.fiveLayerProgress).toMatchObject({
        currentLayer: 'layer_2',
        currentStage: 'arch',
        nextRequiredLayer: 'layer_2',
        completedLayers: ['layer_1'],
      });
      expect(policy.fiveLayerProgress).toEqual(policy.helpRouting.fiveLayerProgress);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('keeps layer_5 closeout stages explicit through release and delivery truth gates', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-help-layer5-closeout-stages-'));
    try {
      fs.cpSync(path.resolve('_bmad'), path.join(root, '_bmad'), { recursive: true });
      writeLayer1Inputs(root);
      for (const [layer, stages] of [
        ['layer_1', ['prd']],
        ['layer_2', ['arch']],
        ['layer_3', ['epics', 'story_create']],
        ['layer_4', ['specify', 'plan', 'gaps', 'tasks', 'implement']],
        ['layer_5', ['post_audit', 'pr_review']],
      ] as const) {
        for (const stage of stages) {
          markBmadHelpFiveLayerStageComplete({ projectRoot: root, layer, stage: stage as any });
        }
      }

      const state = resolveBmadHelpFiveLayerProgressState({ projectRoot: root });

      expect(state.currentLayer).toBe('layer_5');
      expect(state.currentStage).toBe('release_gate');
      expect(state.nextRequiredLayer).toBe('layer_5');

      markBmadHelpFiveLayerStageComplete({
        projectRoot: root,
        layer: 'layer_5',
        stage: 'release_gate' as any,
      });
      const markerOnlyState = resolveBmadHelpFiveLayerProgressState({ projectRoot: root });
      expect(markerOnlyState.currentStage).toBe('release_gate');
      fs.writeFileSync(
        path.join(root, '_bmad-output', 'runtime', 'gates', 'main-agent-release-gate-report.json'),
        '{"critical_failures":0,"blocked_sprint_status_update":false}\n',
        'utf8'
      );
      const deliveryState = resolveBmadHelpFiveLayerProgressState({ projectRoot: root });
      expect(deliveryState.currentLayer).toBe('layer_5');
      expect(deliveryState.currentStage).toBe('delivery_truth_gate');
      expect(deliveryState.nextRequiredLayer).toBe('layer_5');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('requires a real layer_1 PRD completion marker instead of project.json fallback', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-help-real-artifacts-'));
    try {
      fs.cpSync(path.resolve('_bmad'), path.join(root, '_bmad'), { recursive: true });
      fs.mkdirSync(path.join(root, '_bmad-output', 'runtime', 'gates'), { recursive: true });
      fs.mkdirSync(path.join(root, '_bmad-output', 'runtime', 'context'), { recursive: true });
      fs.writeFileSync(
        path.join(root, '_bmad-output', 'runtime', 'context', 'project.json'),
        '{"flow":"story","stage":"prd"}\n',
        'utf8'
      );

      let state = resolveBmadHelpFiveLayerProgressState({ projectRoot: root });
      expect(state.currentLayer).toBe('layer_1');
      expect(state.currentStage).toBe('prd');

      writeLayer1Inputs(root);
      const markerPath = markBmadHelpFiveLayerStageComplete({
        projectRoot: root,
        layer: 'layer_1',
        stage: 'prd' as any,
      });
      const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
      expect(validateLayer1PrdCompletionMarker({ projectRoot: root, markerPath })).toBe(true);
      expect(marker.schemaVersion).toBe('layer_1_prd_completion/v1');
      expect(marker.inputs.prds).toEqual(['_bmad-output/planning-artifacts/dev/prd.md']);
      expect(marker.inputs.productBriefs).toEqual([
        '_bmad-output/planning-artifacts/product-brief-demo.md',
      ]);
      expect(marker.inputs.runtimeContext).toBe('_bmad-output/runtime/context/project.json');
      expect(marker.sources.branch).toBe('dev');
      expect(marker.acceptance).toMatchObject({
        prdPresent: true,
        productBriefPresent: true,
        contextPresent: true,
        layer1Complete: true,
      });
      expect(marker.hashes['_bmad-output/planning-artifacts/dev/prd.md']).toMatch(/^[a-f0-9]{64}$/);
      expect(marker.handoff).toMatchObject({ nextLayer: 'layer_2', nextStage: 'arch' });

      state = resolveBmadHelpFiveLayerProgressState({ projectRoot: root });
      expect(state.currentLayer).toBe('layer_2');
      expect(state.currentStage).toBe('arch');

      for (const [layer, stages] of [
        ['layer_2', ['arch']],
        ['layer_3', ['epics', 'story_create']],
        ['layer_4', ['specify', 'plan', 'gaps', 'tasks', 'implement']],
        ['layer_5', ['post_audit', 'pr_review']],
      ] as const) {
        for (const stage of stages) {
          markBmadHelpFiveLayerStageComplete({ projectRoot: root, layer, stage: stage as any });
        }
      }
      fs.writeFileSync(
        path.join(root, '_bmad-output', 'runtime', 'gates', 'main-agent-release-gate-report.json'),
        '{"critical_failures":0,"blocked_sprint_status_update":false}\n',
        'utf8'
      );
      state = resolveBmadHelpFiveLayerProgressState({ projectRoot: root });
      expect(state.currentStage).toBe('delivery_truth_gate');

      fs.writeFileSync(
        path.join(root, '_bmad-output', 'runtime', 'gates', 'main-agent-delivery-truth-gate-report.json'),
        '{"completionAllowed":false}\n',
        'utf8'
      );
      markBmadHelpFiveLayerStageComplete({
        projectRoot: root,
        layer: 'layer_5',
        stage: 'delivery_truth_gate' as any,
      });
      state = resolveBmadHelpFiveLayerProgressState({ projectRoot: root });
      expect(state.currentStage).toBe('delivery_truth_gate');
      expect(state.completedLayers).not.toContain('layer_5');

      fs.writeFileSync(
        path.join(root, '_bmad-output', 'runtime', 'gates', 'main-agent-delivery-truth-gate-report.json'),
        '{"completionAllowed":true}\n',
        'utf8'
      );
      state = resolveBmadHelpFiveLayerProgressState({ projectRoot: root });
      expect(state.completedLayers).toContain('layer_5');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails layer_1 marker validation when PRD or product brief evidence is missing', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-help-layer1-marker-invalid-'));
    try {
      fs.cpSync(path.resolve('_bmad'), path.join(root, '_bmad'), { recursive: true });
      fs.mkdirSync(path.join(root, '_bmad-output', 'runtime', 'context'), { recursive: true });
      fs.writeFileSync(
        path.join(root, '_bmad-output', 'runtime', 'context', 'project.json'),
        '{"flow":"story","stage":"prd"}\n',
        'utf8'
      );

      const marker = buildLayer1PrdCompletionMarker({
        projectRoot: root,
        generatedAt: '2026-04-29T00:00:00.000Z',
      });
      expect(marker.acceptance).toMatchObject({
        prdPresent: false,
        productBriefPresent: false,
        contextPresent: true,
        layer1Complete: false,
      });

      const markerPath = path.join(
        root,
        '_bmad-output',
        'runtime',
        'context',
        'layer_1-prd.complete.json'
      );
      fs.writeFileSync(markerPath, `${JSON.stringify(marker, null, 2)}\n`, 'utf8');
      expect(validateLayer1PrdCompletionMarker({ projectRoot: root, markerPath })).toBe(false);
      expect(() => writeLayer1PrdCompletionMarker({ projectRoot: root })).toThrow(
        /productBriefPresent=false/
      );
      const state = resolveBmadHelpFiveLayerProgressState({ projectRoot: root });
      expect(state.currentLayer).toBe('layer_1');
      expect(state.currentStage).toBe('prd');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('derives user-facing progress from upstream BMAD planning artifacts without treating them as strict markers', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-help-upstream-artifacts-'));
    try {
      fs.cpSync(path.resolve('_bmad'), path.join(root, '_bmad'), { recursive: true });
      fs.mkdirSync(path.join(root, '_bmad-output', 'planning-artifacts'), { recursive: true });
      fs.mkdirSync(path.join(root, '_bmad-output', 'runtime', 'context'), { recursive: true });
      fs.writeFileSync(
        path.join(root, '_bmad-output', 'runtime', 'context', 'project.json'),
        '{"flow":"story","stage":"prd"}\n',
        'utf8'
      );
      fs.writeFileSync(path.join(root, '_bmad-output', 'planning-artifacts', 'prd.md'), '# PRD\n', 'utf8');
      fs.writeFileSync(
        path.join(root, '_bmad-output', 'planning-artifacts', 'architecture.md'),
        '# Architecture\n',
        'utf8'
      );
      fs.writeFileSync(path.join(root, '_bmad-output', 'planning-artifacts', 'epics.md'), '# Epics\n', 'utf8');

      const state = resolveBmadHelpFiveLayerProgressState({ projectRoot: root });

      expect(state.currentLayer).toBe('layer_3');
      expect(state.currentStage).toBe('story_create');
      expect(state.completedLayers).toEqual(['layer_1', 'layer_2']);
      expect(state.stageStatuses).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ layer: 'layer_1', stage: 'prd', evidenceKind: 'upstream_artifact' }),
          expect.objectContaining({ layer: 'layer_2', stage: 'arch', evidenceKind: 'upstream_artifact' }),
          expect.objectContaining({ layer: 'layer_3', stage: 'epics', evidenceKind: 'upstream_artifact' }),
        ])
      );
      expect(
        validateLayer1PrdCompletionMarker({
          projectRoot: root,
          markerPath: path.join(root, '_bmad-output', 'runtime', 'context', 'layer_1-prd.complete.json'),
        })
      ).toBe(false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
