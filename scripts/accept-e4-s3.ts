#!/usr/bin/env npx ts-node
/**
 * Story 4.3 accept-e4-s3: 验收场景区分、路径约束、5 份文档、禁止词
 * 1) 5 份文档存在
 * 2) validateScenarioConstraints 通过/失败符合预期
 * 3) 至少一个 BMAD 集成点可调用（accept-e3-s3 或 parseAndWriteScore）
 * 4) 5 份文档无禁止词违规
 */
import * as fs from 'fs';
import * as path from 'path';
import { validateScenarioConstraints } from '../scoring/writer/validate';
import type { RunScoreRecord } from '../scoring/writer/types';
import { parseAndWriteScore } from '../scoring/orchestrator/parse-and-write';

const DOCS = [
  'scoring/docs/SCENARIO_AND_PATH_RULES.md',
  'scoring/docs/ITERATION_END_CRITERIA.md',
  'scoring/docs/LIGHTWEIGHT_PRINCIPLES.md',
  'scoring/docs/DATA_POLLUTION_PREVENTION.md',
  'scoring/docs/BMAD_INTEGRATION_POINTS.md',
];

const FORBIDDEN_WORDS = ['可选', '可考虑', '后续', '先实现', '后续扩展', '待定', '酌情', '视情况', '技术债'];

function makeRecord(overrides: Partial<RunScoreRecord>): RunScoreRecord {
  return {
    run_id: 'accept-e4-s3',
    scenario: 'real_dev',
    stage: 'implement',
    phase_score: 20,
    phase_weight: 0.25,
    check_items: [],
    timestamp: '2026-03-05T12:00:00.000Z',
    iteration_count: 0,
    iteration_records: [],
    first_pass: true,
    ...overrides,
  };
}

function main(): number {
  const cwd = process.cwd();
  let failed = 0;

  // 1) 5 份文档存在
  for (const doc of DOCS) {
    const p = path.join(cwd, doc);
    if (!fs.existsSync(p)) {
      console.error(`FAIL: 文档不存在 ${doc}`);
      failed++;
    }
  }
  if (failed > 0) return 1;

  // 2) validateScenarioConstraints 通过/失败符合预期
  try {
    validateScenarioConstraints(makeRecord({ scenario: 'eval_question', question_version: undefined }));
    console.error('FAIL: eval_question 无 question_version 应抛错');
    failed++;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/question_version.*必填/.test(msg)) {
      console.error('FAIL: 错误信息应含 question_version 必填');
      failed++;
    }
  }
  try {
    validateScenarioConstraints(makeRecord({ scenario: 'eval_question', question_version: 'v1' }));
  } catch {
    console.error('FAIL: eval_question + question_version 应通过');
    failed++;
  }
  try {
    validateScenarioConstraints(makeRecord({ scenario: 'real_dev' }));
  } catch {
    console.error('FAIL: real_dev 可无 question_version');
    failed++;
  }

  // 3) 至少一个 BMAD 集成点可调用：直接调用 parseAndWriteScore
  const fixtures = path.join(cwd, 'scoring/parsers/__tests__/fixtures');
  const prdContent = fs.readFileSync(path.join(fixtures, 'sample-prd-report.md'), 'utf-8');
  const tempDir = path.join(cwd, '_bmad-output', 'implementation-artifacts', '4-3-eval-scenario-bmad-integration', 'accept-e4-s3-out');
  fs.mkdirSync(tempDir, { recursive: true });
  try {
    parseAndWriteScore({
      content: prdContent,
      stage: 'prd',
      runId: `accept-e4-s3-${Date.now()}`,
      scenario: 'real_dev',
      writeMode: 'single_file',
      dataPath: tempDir,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('FAIL: parseAndWriteScore 调用失败', msg);
    failed++;
  }

  // 4) 5 份文档无禁止词违规（禁止词表定义节除外）
  for (const doc of DOCS) {
    const p = path.join(cwd, doc);
    const content = fs.readFileSync(p, 'utf-8');
    for (const word of FORBIDDEN_WORDS) {
      if (content.includes(word)) {
        console.error(`FAIL: ${doc} 含禁止词 "${word}"`);
        failed++;
      }
    }
  }

  if (failed > 0) {
    console.error(`\naccept-e4-s3: ${failed} 项失败`);
    return 1;
  }
  console.log('accept-e4-s3: PASS');
  return 0;
}

process.exit(main());
