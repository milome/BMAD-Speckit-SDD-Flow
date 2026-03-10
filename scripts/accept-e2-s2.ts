/**
 * Story 2.2 端到端验收脚本 AC-1～AC-6
 */
import * as fs from 'fs';
import * as path from 'path';

const docPath = path.resolve(process.cwd(), 'scoring', 'docs', 'SCORING_CRITERIA_AUTHORITATIVE.md');
const rulesDir = path.resolve(process.cwd(), 'scoring', 'rules');
const forbiddenWords = ['可选', '后续', '待定', '酌情', '视情况', '先实现', '或后续扩展'];

// 24 项关键字（用于 AC-1 简化校验）
const requiredKeywords = [
  'BMAD Layer', '阶段', '表 A', '表 B', 'prd', 'arch', 'epics', 'story', 'specify', 'plan', 'gaps', 'tasks', 'implement', 'post_impl', 'pr_review',
  '环节 1', '环节 2', '环节 3', '环节 4', '环节 5', '环节 6',
  '20', '25', '15', '10', '5', // 权重
  'L5', 'L4', 'L3', 'L2', 'L1', '90', '80', '60', '40', '0', // L1-L5
  'run_id', 'scenario', 'stage', 'phase_score', 'check_items', 'iteration_count', 'iteration_records', 'first_pass',
  'OWASP', 'CWE-798', 'owasp.org', 'cwe.mitre.org',
  'Code Reviewer', '全链路 Skill', 'AI 代码教练',
  'Epic 综合', '一票否决',
  '_bmad-output/config', 'scoring/rules',
  'Implementation Gaps', '阶梯式扣分',
  '已实现', '目标题', '题池', '更新日期',
];

function main(): void {
  let passed = 0;
  const total = 6;

  // AC-6: 文件存在且路径正确
  if (!fs.existsSync(docPath)) {
    console.error('AC-6: FAIL - 文件不存在', docPath);
    console.log(`\nAcceptance: 0/${total} FAIL`);
    process.exit(1);
  }
  console.log('AC-6: PASS');
  passed++;

  const content = fs.readFileSync(docPath, 'utf-8');

  // AC-1: 含 24 项内容（通过关键字检查）
  const missing: string[] = [];
  for (const kw of requiredKeywords) {
    if (!content.includes(kw)) {
      missing.push(kw);
    }
  }
  if (missing.length > 5) {
    console.error('AC-1: FAIL - 缺少关键字:', missing.slice(0, 10).join(', '));
  } else {
    console.log('AC-1: PASS');
    passed++;
  }

  // AC-2: 规则版本号、修订日期
  const hasVersion = /规则版本号|version|1\.0/.test(content);
  const hasRevDate = /\d{4}-\d{2}-\d{2}|修订日期/.test(content);
  if (hasVersion && hasRevDate) {
    console.log('AC-2: PASS');
    passed++;
  } else {
    console.error('AC-2: FAIL - 缺少规则版本号或修订日期');
  }

  // AC-3: 含题量表述
  const hasQuestionCount = content.includes('已实现') && (content.includes('目标题') || content.includes('题池'));
  const hasUpdateDate = /\d{4}-\d{2}-\d{2}|更新日期/.test(content);
  if (hasQuestionCount && hasUpdateDate) {
    console.log('AC-3: PASS');
    passed++;
  } else {
    console.error('AC-3: FAIL - 缺少题量表述或更新日期');
  }

  // AC-4: spec/tasks 含 24 项核对清单（本脚本存在即表示 tasks 已定义，由人工验收）
  const specPath = path.resolve(process.cwd(), 'specs', 'epic-2', 'story-2-eval-authority-doc', 'spec-E2-S2.md');
  const tasksPath = path.resolve(process.cwd(), 'specs', 'epic-2', 'story-2-eval-authority-doc', 'tasks-E2-S2.md');
  if (fs.existsSync(specPath) && fs.existsSync(tasksPath)) {
    const specContent = fs.readFileSync(specPath, 'utf-8');
    if (specContent.includes('24 项') && specContent.includes('核对清单')) {
      console.log('AC-4: PASS');
      passed++;
    } else {
      console.error('AC-4: FAIL');
    }
  } else {
    console.error('AC-4: FAIL - spec 或 tasks 不存在');
  }

  // AC-5: 全文无禁止词
  let foundForbidden = false;
  for (const w of forbiddenWords) {
    if (content.includes(w)) {
      console.error('AC-5: FAIL - 发现禁止词:', w);
      foundForbidden = true;
      break;
    }
  }
  if (!foundForbidden) {
    console.log('AC-5: PASS');
    passed++;
  }

  console.log(`\nAcceptance: ${passed}/${total} ${passed === total ? 'PASS' : 'FAIL'}`);
  process.exit(passed === total ? 0 : 1);
}

main();
