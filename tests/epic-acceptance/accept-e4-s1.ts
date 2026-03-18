/**
 * Story 4.1 端到端验收脚本
 * 验证 applyTierAndVeto、evaluateEpicVeto 可调用且输出正确
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  applyTierAndVeto,
  evaluateEpicVeto,
  buildVetoItemIds,
} from '../../packages/scoring/veto';

const rulesDir = path.resolve(process.cwd(), 'packages', 'scoring', 'rules');
const opts = { rulesDir };

function main(): void {
  let passed = 0;
  const total = 4;

  // 1. applyTierAndVeto: veto 未触发，阶梯应用
  try {
    const r1 = {
      run_id: 'accept-e4-s1-1',
      scenario: 'real_dev' as const,
      stage: 'prd',
      phase_score: 100,
      phase_weight: 0.2,
      check_items: [{ item_id: 'functional_correctness', passed: true, score_delta: 0 }],
      timestamp: new Date().toISOString(),
      iteration_count: 1,
      iteration_records: [],
      first_pass: false,
      raw_phase_score: 100,
    };
    const out1 = applyTierAndVeto(r1, opts);
    if (!out1.veto_triggered && out1.phase_score === 80 && out1.tier_coefficient === 0.8) {
      console.log('AC-1 (applyTierAndVeto tier): PASS');
      passed++;
    } else {
      console.error('AC-1: FAIL', out1);
    }
  } catch (e) {
    console.error('AC-1: FAIL', e);
  }

  // 2. applyTierAndVeto: veto 触发 -> phase_score=0
  try {
    const vetoIds = buildVetoItemIds(opts);
    const r2 = {
      run_id: 'accept-e4-s1-2',
      scenario: 'real_dev' as const,
      stage: 'prd',
      phase_score: 80,
      phase_weight: 0.2,
      check_items: [{ item_id: 'veto_core_logic', passed: false, score_delta: -10 }],
      timestamp: new Date().toISOString(),
      iteration_count: 0,
      iteration_records: [],
      first_pass: true,
      raw_phase_score: 80,
    };
    if (vetoIds.has('veto_core_logic')) {
      const out2 = applyTierAndVeto(r2, opts);
      if (out2.veto_triggered && out2.phase_score === 0) {
        console.log('AC-2 (applyTierAndVeto veto): PASS');
        passed++;
      } else {
        console.error('AC-2: FAIL', out2);
      }
    } else {
      console.error('AC-2: FAIL vetoIds missing veto_core_logic');
    }
  } catch (e) {
    console.error('AC-2: FAIL', e);
  }

  // 3. evaluateEpicVeto: 触发条件 ①
  try {
    const records = [
      { veto_triggered: true, phase_score: 0, iteration_count: 0, first_pass: false, iteration_records: [], check_items: [] },
      { veto_triggered: true, phase_score: 0, iteration_count: 0, first_pass: false, iteration_records: [], check_items: [] },
      { veto_triggered: true, phase_score: 0, iteration_count: 0, first_pass: false, iteration_records: [], check_items: [] },
    ];
    const out3 = evaluateEpicVeto({ storyRecords: records, epicStoryCount: 5 }, opts);
    if (out3.triggered && out3.triggeredConditions.includes('①_veto_count_ge3')) {
      console.log('AC-3 (evaluateEpicVeto ①): PASS');
      passed++;
    } else {
      console.error('AC-3: FAIL', out3);
    }
  } catch (e) {
    console.error('AC-3: FAIL', e);
  }

  // 4. grep 验证：scoring/veto 被 parse-and-write 导入
  try {
    const parseWritePath = path.join(process.cwd(), 'packages', 'scoring', 'orchestrator', 'parse-and-write.ts');
    const content = fs.readFileSync(parseWritePath, 'utf-8');
    if (content.includes("from '../veto'") || content.includes('from "../veto"')) {
      console.log('AC-4 (parse-and-write imports veto): PASS');
      passed++;
    } else {
      console.error('AC-4: FAIL - parse-and-write does not import scoring/veto');
    }
  } catch (e) {
    console.error('AC-4: FAIL', e);
  }

  console.log(`\nAccept E4-S1: ${passed}/${total} passed`);
  process.exit(passed === total ? 0 : 1);
}

main();
