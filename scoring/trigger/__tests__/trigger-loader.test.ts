import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  loadTriggerConfig,
  shouldWriteScore,
  resetTriggerConfigCache,
} from '../trigger-loader';

const TMP = path.join(process.cwd(), 'config', 'e5s1-tmp-trigger-test');

describe('trigger-loader', () => {
  const realConfigPath = path.resolve(process.cwd(), 'config', 'scoring-trigger-modes.yaml');

  beforeEach(() => {
    resetTriggerConfigCache();
  });

  it('enabled=true + event=stage_audit_complete + stage=speckit_1_2 → write: true', () => {
    const d = shouldWriteScore('stage_audit_complete', 'speckit_1_2', 'real_dev', realConfigPath);
    expect(d.write).toBe(true);
    expect(d.writeMode).toBe('single_file');
  });

  it('enabled=false → write: false', () => {
    const tmpDir = path.join(process.cwd(), 'scoring', 'data', 'e5s1-trigger-tmp');
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
    expect(d.reason).toBe('stage not registered');
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

  it('resetTriggerConfigCache 后重新读文件', () => {
    loadTriggerConfig(realConfigPath);
    resetTriggerConfigCache();
    const c = loadTriggerConfig(realConfigPath);
    expect(c.scoring_write_control.enabled).toBe(true);
  });
});
