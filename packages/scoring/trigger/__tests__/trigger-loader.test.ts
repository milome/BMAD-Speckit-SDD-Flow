import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  loadTriggerConfig,
  shouldWriteScore,
  scoringEnabledForTriggerStage,
  resetTriggerConfigCache,
} from '../trigger-loader';

const TMP = path.join(process.cwd(), '_bmad', '_config', 'e5s1-tmp-trigger-test');

describe('trigger-loader', () => {
  const realConfigPath = path.resolve(process.cwd(), '_bmad', '_config', 'scoring-trigger-modes.yaml');

  beforeEach(() => {
    resetTriggerConfigCache();
  });

  it('enabled=true + event=stage_audit_complete + stage=speckit_1_2 → write: true', () => {
    const d = shouldWriteScore('stage_audit_complete', 'speckit_1_2', 'real_dev', realConfigPath);
    expect(d.write).toBe(true);
    expect(d.writeMode).toBe('single_file');
  });

  it('enabled=false → write: false', () => {
    const tmpDir = path.join(process.cwd(), 'packages', 'scoring', 'data', 'e5s1-trigger-tmp');
    fs.mkdirSync(tmpDir, { recursive: true });
    const cfg = path.join(tmpDir, 'scoring-trigger-modes-disabled.yaml');
    fs.writeFileSync(
      cfg,
      `
scoring_write_control:
  enabled: false
  call_mapping:
    x: { event: stage_audit_complete, stage: speckit_1_2 }
event_to_write_mode:
  stage_audit_complete: { default: single_file }
`,
      'utf-8'
    );
    resetTriggerConfigCache();
    try {
      const d = shouldWriteScore('stage_audit_complete', 'speckit_1_2', 'real_dev', cfg);
      expect(d.write).toBe(false);
      expect(d.reason).toBe('scoring disabled');
    } finally {
      if (fs.existsSync(cfg)) fs.unlinkSync(cfg);
    }
  });

  it('stage 未注册 → write: false', () => {
    const d = shouldWriteScore('stage_audit_complete', 'nonexistent_stage', 'real_dev', realConfigPath);
    expect(d.write).toBe(false);
    expect(d.reason).toBe('stage not registered in call_mapping');
  });

  it('scoringEnabledForTriggerStage 使用 call_mapping 中的 event（含 story_status_change）', () => {
    const s2 = scoringEnabledForTriggerStage('bmad_story_stage2', 'real_dev', realConfigPath);
    const s4 = scoringEnabledForTriggerStage('bmad_story_stage4', 'eval_question', realConfigPath);
    expect(s2.enabled).toBe(true);
    expect(s4.enabled).toBe(true);
    expect(scoringEnabledForTriggerStage('nonexistent_trigger', 'real_dev', realConfigPath).enabled).toBe(
      false
    );
  });

  it('real_dev 和 eval_question 返回正确 writeMode（story_status_change eval_question=jsonl）', () => {
    const dReal = shouldWriteScore('story_status_change', 'bmad_story_stage2', 'real_dev', realConfigPath);
    const dEval = shouldWriteScore('story_status_change', 'bmad_story_stage2', 'eval_question', realConfigPath);
    expect(dReal.write).toBe(true);
    expect(dEval.write).toBe(true);
    expect(dReal.writeMode).toBe('single_file');
    expect(dEval.writeMode).toBe('jsonl');
  });

  it('config 文件不存在 → 抛异常', () => {
    resetTriggerConfigCache();
    expect(() => loadTriggerConfig(path.join(TMP, 'nonexistent.yaml'))).toThrow(/not found/);
  });

  it('二次调用不重读文件（缓存生效）', () => {
    const c1 = loadTriggerConfig(realConfigPath);
    const c2 = loadTriggerConfig(realConfigPath);
    expect(c1).toBe(c2);
  });

  it('different config paths do not reuse the same cached config object', () => {
    const tmpDir = path.join(process.cwd(), 'packages', 'scoring', 'data', 'e5s1-trigger-cache-paths');
    fs.mkdirSync(tmpDir, { recursive: true });
    const cfgA = path.join(tmpDir, 'a.yaml');
    const cfgB = path.join(tmpDir, 'b.yaml');
    fs.writeFileSync(
      cfgA,
      `
scoring_write_control:
  enabled: true
  fail_policy: continue
  call_mapping:
    a: { event: stage_audit_complete, stage: speckit_1_2 }
event_to_write_mode:
  stage_audit_complete: { default: single_file }
`,
      'utf-8'
    );
    fs.writeFileSync(
      cfgB,
      `
scoring_write_control:
  enabled: false
  fail_policy: continue
  call_mapping:
    b: { event: stage_audit_complete, stage: speckit_1_2 }
event_to_write_mode:
  stage_audit_complete: { default: single_file }
`,
      'utf-8'
    );
    resetTriggerConfigCache();
    try {
      const a = loadTriggerConfig(cfgA);
      const b = loadTriggerConfig(cfgB);
      expect(a).not.toBe(b);
      expect(a.scoring_write_control.enabled).toBe(true);
      expect(b.scoring_write_control.enabled).toBe(false);
    } finally {
      if (fs.existsSync(cfgA)) fs.unlinkSync(cfgA);
      if (fs.existsSync(cfgB)) fs.unlinkSync(cfgB);
    }
  });
});
