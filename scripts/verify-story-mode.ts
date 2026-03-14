/**
 * Story Mode Workflow Verification Script
 *
 * This script verifies that the BMAD story mode conditional audit
 * functionality works correctly by simulating each stage.
 */

import {
  loadConfig,
  shouldAudit,
  shouldValidate,
  getStageConfig,
  getCurrentMode,
  getSubagentParams,
} from './bmad-config';

// Test configuration
const TEST_EPIC = 'E001';
const TEST_STORY = 'S003';
const TEST_SLUG = 'story-mode-test';

// Stage definitions with expected behavior in story mode
const STAGE_DEFINITIONS = [
  {
    name: 'story_create',
    expectAudit: true,
    expectValidation: null,
    description: 'Story创建阶段',
  },
  {
    name: 'story_audit',
    expectAudit: true,
    expectValidation: null,
    description: 'Story审计阶段',
  },
  {
    name: 'specify',
    expectAudit: false,
    expectValidation: 'basic',
    description: 'specify阶段 - 应跳过审计，执行基础验证',
  },
  {
    name: 'plan',
    expectAudit: false,
    expectValidation: 'basic',
    description: 'plan阶段 - 应跳过审计，执行基础验证',
  },
  {
    name: 'gaps',
    expectAudit: false,
    expectValidation: 'basic',
    description: 'gaps阶段 - 应跳过审计，执行基础验证',
  },
  {
    name: 'tasks',
    expectAudit: false,
    expectValidation: 'basic',
    description: 'tasks阶段 - 应跳过审计，执行基础验证',
  },
  {
    name: 'implement',
    expectAudit: false,
    expectValidation: 'test_only',
    description: 'implement阶段 - 应跳过审计，执行测试验证',
  },
  {
    name: 'post_audit',
    expectAudit: true,
    expectValidation: null,
    description: 'post_audit阶段 - 应执行完整审计',
  },
];

interface TestResult {
  stage: string;
  passed: boolean;
  expectedAudit: boolean;
  actualAudit: boolean;
  expectedValidation: string | null;
  actualValidation: string | null;
  errors: string[];
}

function runVerification(): TestResult[] {
  console.log('========================================');
  console.log('BMAD Story Mode 工作流程验证');
  console.log('========================================\n');

  const config = loadConfig();
  const currentMode = getCurrentMode(config);
  const subagentParams = getSubagentParams(config);

  console.log(`配置模式: ${currentMode}`);
  console.log(`子代理工具: ${subagentParams.tool}`);
  console.log(`子代理类型: ${subagentParams.subagent_type}\n`);

  if (currentMode !== 'story') {
    console.error('❌ 错误: 当前不是 story 模式，无法进行验证');
    console.error(`当前模式: ${currentMode}，期望模式: story`);
    process.exit(1);
  }

  console.log('========================================');
  console.log('阶段验证结果');
  console.log('========================================\n');

  const results: TestResult[] = [];
  let allPassed = true;

  for (const stageDef of STAGE_DEFINITIONS) {
    const stageConfig = getStageConfig(stageDef.name as any, config);
    const needsAudit = shouldAudit(stageDef.name as any, config);
    const validation = shouldValidate(stageDef.name as any, config);

    const result: TestResult = {
      stage: stageDef.name,
      passed: true,
      expectedAudit: stageDef.expectAudit,
      actualAudit: needsAudit,
      expectedValidation: stageDef.expectValidation,
      actualValidation: validation,
      errors: [],
    };

    // Validate audit expectation
    if (needsAudit !== stageDef.expectAudit) {
      result.passed = false;
      result.errors.push(`审计期望: ${stageDef.expectAudit}, 实际: ${needsAudit}`);
    }

    // Validate validation expectation
    if (validation !== stageDef.expectValidation) {
      result.passed = false;
      result.errors.push(`验证期望: ${stageDef.expectValidation}, 实际: ${validation}`);
    }

    if (!result.passed) {
      allPassed = false;
    }

    results.push(result);

    // Print result
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} | ${stageDef.name}`);
    console.log(`  描述: ${stageDef.description}`);
    console.log(
      `  审计: ${needsAudit ? '是' : '否'} (期望: ${stageDef.expectAudit ? '是' : '否'})`
    );
    console.log(`  验证: ${validation || 'null'} (期望: ${stageDef.expectValidation || 'null'})`);
    if (result.errors.length > 0) {
      console.log(`  错误: ${result.errors.join(', ')}`);
    }
    console.log();
  }

  console.log('========================================');
  console.log('验证总结');
  console.log('========================================');
  console.log(`总阶段数: ${results.length}`);
  console.log(`通过: ${results.filter((r) => r.passed).length}`);
  console.log(`失败: ${results.filter((r) => !r.passed).length}`);
  console.log(`结果: ${allPassed ? '✅ 全部通过' : '❌ 存在失败'}`);
  console.log('========================================');

  return results;
}

// Run the verification
const results = runVerification();

// Exit with appropriate code
const hasFailures = results.some((r) => !r.passed);
process.exit(hasFailures ? 1 : 0);
