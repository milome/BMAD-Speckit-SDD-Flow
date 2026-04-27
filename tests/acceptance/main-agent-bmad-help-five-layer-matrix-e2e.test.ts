import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  markBmadHelpFiveLayerStageComplete,
  resolveBmadHelpFiveLayerProgressState,
  runBmadHelpFiveLayerMatrix,
} from '../../scripts/main-agent-bmad-help-five-layer-matrix';
import { resolveBmadHelpRuntimePolicy } from '../../scripts/bmad-help-routing-state';

describe('bmad-help five-layer main-agent matrix', () => {
  it('proves the bmad-help first-screen route can drive every canonical layer through the main-agent control plane', () => {
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
      const deliveryState = resolveBmadHelpFiveLayerProgressState({ projectRoot: root });
      expect(deliveryState.currentLayer).toBe('layer_5');
      expect(deliveryState.currentStage).toBe('delivery_truth_gate');
      expect(deliveryState.nextRequiredLayer).toBe('layer_5');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('recognizes real artifact filenames without synthetic completion markers', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-help-real-artifacts-'));
    try {
      fs.cpSync(path.resolve('_bmad'), path.join(root, '_bmad'), { recursive: true });
      fs.mkdirSync(path.join(root, '_bmad-output', 'runtime', 'context'), { recursive: true });
      fs.mkdirSync(path.join(root, '_bmad-output', 'runtime', 'gates'), { recursive: true });
      fs.writeFileSync(
        path.join(root, '_bmad-output', 'runtime', 'context', 'project.json'),
        '{"flow":"story","stage":"prd"}\n',
        'utf8'
      );

      let state = resolveBmadHelpFiveLayerProgressState({ projectRoot: root });
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
        '{"critical_failures":0}\n',
        'utf8'
      );
      state = resolveBmadHelpFiveLayerProgressState({ projectRoot: root });
      expect(state.currentStage).toBe('delivery_truth_gate');

      fs.writeFileSync(
        path.join(root, '_bmad-output', 'runtime', 'gates', 'main-agent-delivery-truth-gate-report.json'),
        '{"completionAllowed":false}\n',
        'utf8'
      );
      state = resolveBmadHelpFiveLayerProgressState({ projectRoot: root });
      expect(state.completedLayers).toContain('layer_5');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
