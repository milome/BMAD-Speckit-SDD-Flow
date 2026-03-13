/**
 * Accept-e2-s1: 端到端验收脚本（Epic 2 Story 1）。
 *
 * 用途：验证 scoring 规则加载、ref 解析、环节 YAML 等。
 *
 * CLI：无参数
 *
 * 退出码：0=全部通过，1=有失败
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  loadPhaseScoringYaml,
  loadGapsScoringYaml,
  loadIterationTierYaml,
  resolveRef,
} from '../scoring/parsers';

const rulesDir = path.resolve(process.cwd(), 'scoring', 'rules');
const configPath = path.resolve(process.cwd(), 'config', 'code-reviewer-config.yaml');

function main(): void {
  let passed = 0;
  const total = 7;

  // AC-1: 环节 2/3/4 YAML 符合 schema，解析成功
  try {
    const p2 = loadPhaseScoringYaml(2, { rulesDir });
    const p3 = loadPhaseScoringYaml(3, { rulesDir });
    const p4 = loadPhaseScoringYaml(4, { rulesDir });
    if (
      p2.version &&
      p2.stage &&
      p2.link_环节 === 2 &&
      p3.link_环节 === 3 &&
      p4.link_环节 === 4
    ) {
      console.log('AC-1: PASS');
      passed++;
    } else {
      console.error('AC-1: FAIL');
    }
  } catch (e) {
    console.error('AC-1: FAIL', e);
  }

  // AC-2: items 每项含 id、ref、deduct；ref 格式 code-reviewer-config#item_id
  try {
    const p2 = loadPhaseScoringYaml(2, { rulesDir });
    const valid = p2.items.every(
      (i) =>
        i.id &&
        i.ref &&
        typeof i.deduct === 'number' &&
        /^code-reviewer-config#[a-zA-Z0-9_]+$/.test(i.ref)
    );
    if (valid) {
      console.log('AC-2: PASS');
      passed++;
    } else {
      console.error('AC-2: FAIL');
    }
  } catch (e) {
    console.error('AC-2: FAIL', e);
  }

  // AC-3: veto_items 每项含 id、ref、consequence；ref 指向 veto_*
  try {
    const p2 = loadPhaseScoringYaml(2, { rulesDir });
    const valid = (p2.veto_items ?? []).every(
      (v) =>
        v.id &&
        v.ref &&
        v.consequence &&
        /^code-reviewer-config#veto_/.test(v.ref)
    );
    if (valid) {
      console.log('AC-3: PASS');
      passed++;
    } else {
      console.error('AC-3: FAIL');
    }
  } catch (e) {
    console.error('AC-3: FAIL', e);
  }

  // AC-4: gaps-scoring.yaml 可解析，产出前置 40%、后置 implement/post_impl
  try {
    const g = loadGapsScoringYaml({ rulesDir });
    if (g.weights.base.spec_coverage === 40 && g.weights.post_implement && g.weights.post_post_impl) {
      console.log('AC-4: PASS');
      passed++;
    } else {
      console.error('AC-4: FAIL');
    }
  } catch (e) {
    console.error('AC-4: FAIL', e);
  }

  // AC-5: iteration-tier.yaml 可解析，iteration_tier、severity_override
  try {
    const it = loadIterationTierYaml({ rulesDir });
    if (
      it.iteration_tier[1] === 1.0 &&
      it.iteration_tier[2] === 0.8 &&
      it.iteration_tier[3] === 0.5 &&
      it.iteration_tier[4] === 0 &&
      it.severity_override?.fatal === 3 &&
      it.severity_override?.serious === 2
    ) {
      console.log('AC-5: PASS');
      passed++;
    } else {
      console.error('AC-5: FAIL');
    }
  } catch (e) {
    console.error('AC-5: FAIL', e);
  }

  // AC-6: ref 解析；item_id 不存在时明确报错
  try {
    const r = resolveRef('code-reviewer-config#functional_correctness', configPath);
    if (r && r.item_id === 'functional_correctness') {
      let errOk = false;
      try {
        resolveRef('code-reviewer-config#nonexistent_xyz', configPath);
      } catch (err: unknown) {
        errOk = (err as Error).message?.includes('not found') ?? false;
      }
      if (errOk) {
        console.log('AC-6: PASS');
        passed++;
      } else {
        console.error('AC-6: FAIL (ref not found should throw)');
      }
    } else {
      console.error('AC-6: FAIL');
    }
  } catch (e) {
    console.error('AC-6: FAIL', e);
  }

  // AC-7: scoring/rules/default/ 下三个文件存在且 schema 校验通过
  try {
    const impl = path.join(rulesDir, 'default', 'implement-scoring.yaml');
    const test = path.join(rulesDir, 'default', 'test-scoring.yaml');
    const bugfix = path.join(rulesDir, 'default', 'bugfix-scoring.yaml');
    if (fs.existsSync(impl) && fs.existsSync(test) && fs.existsSync(bugfix)) {
      const p2 = loadPhaseScoringYaml(2, { rulesDir });
      const p3 = loadPhaseScoringYaml(3, { rulesDir });
      const p4 = loadPhaseScoringYaml(4, { rulesDir });
      if (p2.link_环节 === 2 && p3.link_环节 === 3 && p4.link_环节 === 4) {
        console.log('AC-7: PASS');
        passed++;
      } else {
        console.error('AC-7: FAIL');
      }
    } else {
      console.error('AC-7: FAIL (files missing)');
    }
  } catch (e) {
    console.error('AC-7: FAIL', e);
  }

  console.log(`\nAcceptance: ${passed}/${total} ${passed === total ? 'PASS' : 'FAIL'}`);
  process.exit(passed === total ? 0 : 1);
}

main();
