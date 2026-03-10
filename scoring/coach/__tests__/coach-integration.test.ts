import { describe, it, expect, vi, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as veto from '../../veto';
import { coachDiagnose, formatToMarkdown } from '../index';
import type { RunScoreRecord } from '../../writer/types';

function writeRecord(dataPath: string, runId: string, overrides?: Partial<RunScoreRecord>): void {
  const record: RunScoreRecord = {
    run_id: runId,
    scenario: 'real_dev',
    stage: 'implement',
    phase_score: 90,
    phase_weight: 0.25,
    check_items: [{ item_id: 'functional_correctness', passed: true, score_delta: 0 }],
    timestamp: new Date().toISOString(),
    iteration_count: 1,
    iteration_records: [],
    first_pass: false,
    ...overrides,
  };

  fs.mkdirSync(dataPath, { recursive: true });
  fs.writeFileSync(path.join(dataPath, `${runId}.json`), JSON.stringify(record, null, 2), 'utf-8');
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('coach integration', () => {
  it('calls applyTierAndVeto/evaluateEpicVeto and returns schema-complete report', async () => {
    const runId = `coach-int-${Date.now()}`;
    const dataPath = path.join(os.tmpdir(), `coach-int-${Date.now()}`);
    writeRecord(dataPath, runId, {
      check_items: [
        { item_id: 'veto_core_logic', passed: false, score_delta: -10 },
        { item_id: 'veto_owasp_high', passed: false, score_delta: -10 },
      ],
    });

    const applySpy = vi.spyOn(veto, 'applyTierAndVeto');
    const epicSpy = vi.spyOn(veto, 'evaluateEpicVeto');
    const result = await coachDiagnose(runId, {
      dataPath,
      epicStoryCount: 3,
      passedStoryCount: 0,
      testStats: { passed: 0, total: 10 },
    });

    expect(applySpy).toHaveBeenCalledTimes(1);
    expect(epicSpy).toHaveBeenCalledTimes(1);
    if ('error' in result) {
      throw new Error(`unexpected error: ${result.error}`);
    }

    expect(result.summary).toBeTruthy();
    expect(result.phase_scores).toBeDefined();
    expect(result.weak_areas).toBeDefined();
    expect(result.recommendations).toBeDefined();
    expect(typeof result.iteration_passed).toBe('boolean');
    expect(result.iteration_passed).toBe(false);

    const md = formatToMarkdown(result);
    expect(md).toContain('## Summary');
    expect(md).toContain('## Phase Scores');
    expect(md).toContain('## Iteration Passed');

    fs.rmSync(dataPath, { recursive: true, force: true });
  });

  it('is imported by production CLI paths', () => {
    const coachCliPath = path.resolve(process.cwd(), 'scripts', 'coach-diagnose.ts');
    const acceptPath = path.resolve(process.cwd(), 'scripts', 'accept-e4-s2.ts');
    const coachCliSource = fs.readFileSync(coachCliPath, 'utf-8');
    const acceptSource = fs.readFileSync(acceptPath, 'utf-8');

    expect(
      coachCliSource.includes("from '../scoring/coach'") ||
      coachCliSource.includes('from "../scoring/coach"')
    ).toBe(true);
    expect(
      acceptSource.includes("from '../scoring/coach'") ||
      acceptSource.includes('from "../scoring/coach"')
    ).toBe(true);
    expect(acceptSource.includes('coachDiagnose')).toBe(true);
  });
});

