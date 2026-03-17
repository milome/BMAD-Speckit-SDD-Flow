#!/usr/bin/env ts-node
import * as fs from 'fs';

const TEST_EPIC = 'TEST';
const TEST_STORY = '001';
const TEST_EPIC_SLUG = 'test-epic';
const TEST_STORY_SLUG = 'test-story';

interface TestResult {
  name: string;
  passed: boolean;
  detail: string;
}

function runTests(): TestResult[] {
  const results: TestResult[] = [];

  console.log('=== 路径与结构验证 ===\n');

  const expectedDirs = [
    `.claude/state/stories`,
    `specs/epic-${TEST_EPIC}-${TEST_EPIC_SLUG}/story-${TEST_STORY}-${TEST_STORY_SLUG}`,
    `_bmad-output/implementation-artifacts/epic-${TEST_EPIC}-${TEST_EPIC_SLUG}/story-${TEST_STORY}-${TEST_STORY_SLUG}`
  ];

  console.log('【测试 1】目录结构可创建性');
  expectedDirs.forEach(dir => {
    try {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`  ✅ 目录可创建: ${dir}`);
      results.push({ name: `dir:${dir}`, passed: true, detail: '可创建' });
    } catch (error) {
      console.log(`  ❌ 目录创建失败: ${dir}`);
      results.push({ name: `dir:${dir}`, passed: false, detail: String(error) });
    }
  });

  console.log('\n【测试 2】Agent 文件引用完整性');
  const requiredFiles = [
    '.claude/agents/bmad-master.md',
    '.claude/agents/bmad-story-create.md',
    '.claude/agents/bmad-story-audit.md',
    '.claude/agents/layers/bmad-layer4-speckit-specify.md',
    '.claude/agents/layers/bmad-layer4-speckit-plan.md',
    '.claude/agents/layers/bmad-layer4-speckit-gaps.md',
    '.claude/agents/layers/bmad-layer4-speckit-tasks.md',
    '.claude/agents/layers/bmad-layer4-speckit-implement.md',
    '.claude/agents/auditors/auditor-spec.md',
    '.claude/agents/auditors/auditor-plan.md',
    '.claude/agents/auditors/auditor-gaps.md',
    '.claude/agents/auditors/auditor-tasks.md',
    '.claude/agents/auditors/auditor-implement.md',
    '.claude/agents/auditors/auditor-document.md',
  ];

  requiredFiles.forEach(f => {
    const exists = fs.existsSync(f);
    console.log(`  ${exists ? '✅' : '❌'} ${f}`);
    results.push({ name: `file:${f}`, passed: exists, detail: exists ? '存在' : '缺失' });
  });

  console.log('\n【测试 3】路由→前置条件一致性');
  const routePrereqMap = [
    { agent: 'plan', file: '.claude/agents/layers/bmad-layer4-speckit-plan.md', expected: 'specify_passed' },
    { agent: 'gaps', file: '.claude/agents/layers/bmad-layer4-speckit-gaps.md', expected: 'plan_passed' },
    { agent: 'tasks', file: '.claude/agents/layers/bmad-layer4-speckit-tasks.md', expected: 'gaps_passed' },
    { agent: 'implement', file: '.claude/agents/layers/bmad-layer4-speckit-implement.md', expected: 'tasks_passed' },
  ];

  routePrereqMap.forEach(check => {
    if (!fs.existsSync(check.file)) {
      results.push({ name: `prereq:${check.agent}`, passed: false, detail: '文件不存在' });
      return;
    }
    const content = fs.readFileSync(check.file, 'utf-8');
    const hasPrereq = content.includes(check.expected);
    console.log(`  ${hasPrereq ? '✅' : '❌'} ${check.agent}: Prerequisites 应为 ${check.expected}`);
    results.push({ name: `prereq:${check.agent}`, passed: hasPrereq, detail: hasPrereq ? '一致' : `不一致` });
  });

  const testDirs = [
    `specs/epic-${TEST_EPIC}-${TEST_EPIC_SLUG}`,
    `_bmad-output/implementation-artifacts/epic-${TEST_EPIC}-${TEST_EPIC_SLUG}`
  ];
  testDirs.forEach(d => {
    if (fs.existsSync(d)) {
      fs.rmSync(d, { recursive: true, force: true });
    }
  });

  return results;
}

const results = runTests();
const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;

console.log(`\n=== 结果汇总: ${passed} 通过, ${failed} 失败 ===`);
if (failed > 0) {
  console.log('\n失败项:');
  results.filter(r => !r.passed).forEach(r => {
    console.log(`  - ${r.name}: ${r.detail}`);
  });
}

process.exit(failed === 0 ? 0 : 1);
