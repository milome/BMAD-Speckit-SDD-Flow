import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { coachDiagnose } from '../index';
import type { RunScoreRecord } from '../../writer/types';

function writeRecord(dataPath: string, runId: string, overrides?: Partial<RunScoreRecord>): void {
  const record: RunScoreRecord = {
    run_id: runId,
    scenario: 'real_dev',
    stage: 'implement',
    phase_score: 88,
    phase_weight: 0.25,
    check_items: [{ item_id: 'functional_correctness', passed: true, score_delta: 0 }],
    timestamp: new Date().toISOString(),
    iteration_count: 0,
    iteration_records: [],
    first_pass: true,
    ...overrides,
  };
  fs.mkdirSync(dataPath, { recursive: true });
  fs.writeFileSync(path.join(dataPath, `${runId}.json`), JSON.stringify(record, null, 2), 'utf-8');
}

describe('coachDiagnose fallback', () => {
  it('returns full diagnosis fields when required skill is unavailable', async () => {
    const runId = `coach-fallback-${Date.now()}`;
    const dataPath = path.join(os.tmpdir(), `coach-fallback-${Date.now()}`);
    writeRecord(dataPath, runId);

    const result = await coachDiagnose(runId, {
      dataPath,
      requiredSkillPath: 'not/exist/skill.md',
      forceSkillLoadError: true,
    });

    if ('error' in result) {
      throw new Error(`unexpected error: ${result.error}`);
    }

    expect(result.summary).toContain('fallback');
    expect(result.phase_scores).toBeDefined();
    expect(Array.isArray(result.weak_areas)).toBe(true);
    expect(Array.isArray(result.recommendations)).toBe(true);
    expect(typeof result.iteration_passed).toBe('boolean');

    fs.rmSync(dataPath, { recursive: true, force: true });
  });

  it('sets iteration_passed=false when stage veto is triggered', async () => {
    const runId = `coach-stage-veto-${Date.now()}`;
    const dataPath = path.join(os.tmpdir(), `coach-stage-veto-${Date.now()}`);
    writeRecord(dataPath, runId, {
      check_items: [{ item_id: 'veto_core_logic', passed: false, score_delta: -10 }],
    });

    const result = await coachDiagnose(runId, { dataPath });
    if ('error' in result) {
      throw new Error(`unexpected error: ${result.error}`);
    }
    expect(result.iteration_passed).toBe(false);
    fs.rmSync(dataPath, { recursive: true, force: true });
  });

  it('sets iteration_passed=false when epic veto is triggered', async () => {
    const runId = `coach-epic-veto-${Date.now()}`;
    const dataPath = path.join(os.tmpdir(), `coach-epic-veto-${Date.now()}`);
    writeRecord(dataPath, runId, {
      check_items: [{ item_id: 'functional_correctness', passed: true, score_delta: 0 }],
      phase_score: 85,
      iteration_count: 0,
      first_pass: true,
    });

    const result = await coachDiagnose(runId, {
      dataPath,
      epicStoryCount: 4,
      passedStoryCount: 0,
      testStats: { passed: 0, total: 10 },
    });
    if ('error' in result) {
      throw new Error(`unexpected error: ${result.error}`);
    }
    expect(result.iteration_passed).toBe(false);
    fs.rmSync(dataPath, { recursive: true, force: true });
  });

  it('sets iteration_passed=true when veto conditions are all clear', async () => {
    const runId = `coach-pass-${Date.now()}`;
    const dataPath = path.join(os.tmpdir(), `coach-pass-${Date.now()}`);
    writeRecord(dataPath, runId, {
      check_items: [{ item_id: 'functional_correctness', passed: true, score_delta: 0 }],
      phase_score: 90,
      iteration_count: 0,
      first_pass: true,
    });

    const result = await coachDiagnose(runId, {
      dataPath,
      epicStoryCount: 1,
      passedStoryCount: 1,
      testStats: { passed: 10, total: 10 },
    });
    if ('error' in result) {
      throw new Error(`unexpected error: ${result.error}`);
    }
    expect(result.iteration_passed).toBe(true);
    fs.rmSync(dataPath, { recursive: true, force: true });
  });

  it('includes weakness_clusters when clusterWeaknesses finds failures (AC-B06-6)', async () => {
    const runId = `coach-weakness-clusters-${Date.now()}`;
    const dataPath = path.join(os.tmpdir(), `coach-weakness-clusters-${Date.now()}`);
    fs.mkdirSync(dataPath, { recursive: true });
    const rec1: RunScoreRecord = {
      run_id: runId,
      scenario: 'real_dev',
      stage: 'spec',
      phase_score: 70,
      phase_weight: 0.25,
      check_items: [
        { item_id: 'item_repeat', passed: false, score_delta: -10 },
      ],
      timestamp: new Date().toISOString(),
      iteration_count: 0,
      iteration_records: [],
      first_pass: true,
    };
    const rec2: RunScoreRecord = {
      ...rec1,
      stage: 'plan',
      check_items: [
        { item_id: 'item_repeat', passed: false, score_delta: -5 },
      ],
    };
    fs.writeFileSync(
      path.join(dataPath, `${runId}.json`),
      JSON.stringify([rec1, rec2], null, 2),
      'utf-8'
    );

    const result = await coachDiagnose(runId, {
      dataPath,
      requiredSkillPath: 'not/exist/skill.md',
      forceSkillLoadError: true,
    });
    if ('error' in result) {
      throw new Error(`unexpected error: ${result.error}`);
    }
    expect(Array.isArray(result.weak_areas)).toBe(true);
    expect(result.weakness_clusters).toBeDefined();
    expect(Array.isArray(result.weakness_clusters)).toBe(true);
    if (result.weakness_clusters!.length > 0) {
      const c = result.weakness_clusters![0];
      expect(c).toHaveProperty('cluster_id');
      expect(c).toHaveProperty('primary_item_ids');
      expect(c).toHaveProperty('frequency');
      expect(c).toHaveProperty('keywords');
      expect(c).toHaveProperty('severity_distribution');
      expect(c).toHaveProperty('affected_stages');
    }
    fs.rmSync(dataPath, { recursive: true, force: true });
  });

  it('documents iteration_passed formula source from VETO_AND_ITERATION_RULES §3.4.2', () => {
    const sourcePath = path.resolve(process.cwd(), 'scoring', 'coach', 'diagnose.ts');
    const source = fs.readFileSync(sourcePath, 'utf-8');
    expect(source.includes('§3.4.2')).toBe(true);
  });

  it('loads AI coach persona from manifest linked markdown source', async () => {
    const runId = `coach-persona-manifest-${Date.now()}`;
    const dataPath = path.join(os.tmpdir(), `coach-persona-manifest-${Date.now()}`);
    writeRecord(dataPath, runId);

    const result = await coachDiagnose(runId, { dataPath });
    if ('error' in result) {
      throw new Error(`unexpected error: ${result.error}`);
    }
    expect(result.summary).toContain('AI Code Coach + Iteration Gate Keeper');

    fs.rmSync(dataPath, { recursive: true, force: true });
  });

  it('falls back to explicit ai-coach.md when manifest path is invalid', async () => {
    const runId = `coach-persona-priority-${Date.now()}`;
    const dataPath = path.join(os.tmpdir(), `coach-persona-priority-data-${Date.now()}`);
    const sandboxPath = path.join(os.tmpdir(), `coach-persona-priority-sandbox-${Date.now()}`);
    writeRecord(dataPath, runId);
    fs.mkdirSync(sandboxPath, { recursive: true });

    const explicitPersonaPath = path.join(sandboxPath, 'ai-coach.md');
    fs.writeFileSync(
      explicitPersonaPath,
      [
        '```yaml',
        'persona:',
        '  role: "EXPLICIT_ROLE"',
        '  identity: "EXPLICIT_IDENTITY"',
        '  communication_style: "EXPLICIT_STYLE"',
        '  principles:',
        '    - "只消费已有审计与 scoring 数据，不替代 Reviewer。"',
        '```',
      ].join('\n'),
      'utf-8'
    );

    const manifestPath = path.join(sandboxPath, 'agent-manifest.csv');
    fs.writeFileSync(
      manifestPath,
      [
        'name,displayName,title,icon,capabilities,role,identity,communicationStyle,principles,module,path',
        '"ai-coach","AI Coach","AI Code Coach + Iteration Gate Keeper","🦉","scoring data analysis, shortfall diagnosis, improvement recommendation","INLINE_ROLE","INLINE_IDENTITY","INLINE_STYLE","- INLINE_PRINCIPLE","scoring","not/exist/ai-coach.md"',
      ].join('\n'),
      'utf-8'
    );

    const result = await coachDiagnose(runId, {
      dataPath,
      personaManifestPath: manifestPath,
      personaPath: explicitPersonaPath,
    });
    if ('error' in result) {
      throw new Error(`unexpected error: ${result.error}`);
    }

    expect(result.summary).toContain('EXPLICIT_ROLE');
    expect(result.summary).not.toContain('INLINE_ROLE');

    fs.rmSync(dataPath, { recursive: true, force: true });
    fs.rmSync(sandboxPath, { recursive: true, force: true });
  });

  it('falls back to minimum safe persona when external persona loading fails', async () => {
    const runId = `coach-persona-fallback-${Date.now()}`;
    const dataPath = path.join(os.tmpdir(), `coach-persona-fallback-${Date.now()}`);
    writeRecord(dataPath, runId);

    const result = await coachDiagnose(runId, {
      dataPath,
      personaManifestPath: 'not/exist/agent-manifest.csv',
      personaPath: 'not/exist/ai-coach.md',
    });
    if ('error' in result) {
      throw new Error(`unexpected error: ${result.error}`);
    }
    expect(
      result.recommendations.includes('只消费已有审计与 scoring 数据，不替代 Reviewer。')
    ).toBe(true);

    fs.rmSync(dataPath, { recursive: true, force: true });
  });
});
