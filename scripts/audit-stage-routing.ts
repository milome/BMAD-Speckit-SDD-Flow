#!/usr/bin/env node
/**
 * Stage Routing Audit Script (Task D1)
 *
 * 审计 bmad-master.md 中的路由逻辑，确认问题所在
 * 输出报告到 _bmad-output/routing-audit-report.md
 */

import * as fs from 'fs';
import * as path from 'path';

interface AuditResult {
  check: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  details: string;
  lineNumber?: number;
}

interface RoutingRule {
  stage: string;
  routeTo: string;
  found: boolean;
  lineNumber?: number;
}

interface AuditReport {
  timestamp: string;
  fileAudited: string;
  summary: {
    totalChecks: number;
    passed: number;
    failed: number;
    warnings: number;
  };
  results: AuditResult[];
  routingRules: RoutingRule[];
  storyTypeDetection?: {
    found: boolean;
    lineNumber?: number;
    details: string;
  };
  epicLevelRouting?: {
    found: boolean;
    lineNumber?: number;
    details: string;
  };
  autoContinueLogic?: {
    found: boolean;
    lineNumber?: number;
    details: string;
  };
}

function auditStageRouting(): AuditReport {
  const results: AuditResult[] = [];
  const routingRules: RoutingRule[] = [];

  const masterAgentPath = path.join(process.cwd(), '.claude', 'agents', 'bmad-master.md');

  // Check if file exists
  if (!fs.existsSync(masterAgentPath)) {
    return {
      timestamp: new Date().toISOString(),
      fileAudited: masterAgentPath,
      summary: { totalChecks: 1, passed: 0, failed: 1, warnings: 0 },
      results: [{
        check: '文件存在性检查',
        status: 'FAIL',
        details: `文件不存在: ${masterAgentPath}`
      }],
      routingRules: []
    };
  }

  const content = fs.readFileSync(masterAgentPath, 'utf-8');
  const lines = content.split('\n');

  // 1. 检查 Stage Routing 章节是否存在
  let stageRoutingSectionFound = false;
  let stageRoutingLineNumber = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('## Stage Routing') || lines[i].includes('### 2. Stage Routing')) {
      stageRoutingSectionFound = true;
      stageRoutingLineNumber = i + 1;
      break;
    }
  }

  results.push({
    check: 'Stage Routing 章节存在性',
    status: stageRoutingSectionFound ? 'PASS' : 'FAIL',
    details: stageRoutingSectionFound
      ? `找到 Stage Routing 章节 (第 ${stageRoutingLineNumber} 行)`
      : '未找到 Stage Routing 章节',
    lineNumber: stageRoutingLineNumber
  });

  // 2. 检查必需的路由规则
  const requiredRoutes = [
    { stage: 'null/new', routeTo: 'story_create/bmad-story-create' },
    { stage: 'story_created', routeTo: 'story_audit/bmad-story-audit' },
    { stage: 'story_audit_passed', routeTo: 'specify' },
    { stage: 'specify_passed', routeTo: 'plan' },
    { stage: 'plan_passed', routeTo: 'gaps' },
    { stage: 'gaps_passed', routeTo: 'tasks' },
    { stage: 'tasks_passed', routeTo: 'Story Type Detection' },
    { stage: 'implement_passed', routeTo: 'commit_gate' },
    { stage: 'document_audit_passed', routeTo: 'commit_gate' }
  ];

  for (const route of requiredRoutes) {
    const stageKeywords = route.stage.split('/');
    const routeKeywords = route.routeTo.split('/');

    const stageFound = stageKeywords.every(kw => content.includes(kw));
    const routeFound = routeKeywords.every(kw => content.includes(kw)) ||
      (route.routeTo === 'Story Type Detection' && content.includes('Story Type Detection'));
    const found = stageFound && routeFound;

    // 查找行号
    let lineNumber: number | undefined;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(`stage: ${route.stage}`) ||
          (route.stage === 'null/new' && lines[i].includes('`stage: null`')) ||
          lines[i].includes(`\`${route.stage}\``)) {
        lineNumber = i + 1;
        break;
      }
    }

    routingRules.push({
      stage: route.stage,
      routeTo: route.routeTo,
      found,
      lineNumber
    });

    results.push({
      check: `路由规则: ${route.stage} → ${route.routeTo}`,
      status: found ? 'PASS' : 'FAIL',
      details: found
        ? `找到路由规则 (第 ${lineNumber} 行)`
        : `未找到路由规则: ${route.stage} → ${route.routeTo}`,
      lineNumber
    });
  }

  // 3. 检查 Story Type Detection 逻辑
  let storyTypeDetectionFound = false;
  let storyTypeLineNumber = 0;
  let hasCodeFlow = false;
  let hasDocumentFlow = false;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Story Type Detection') || lines[i].includes('Story Type Routing')) {
      storyTypeDetectionFound = true;
      storyTypeLineNumber = i + 1;
    }
    if (lines[i].includes('code_flow') || lines[i].includes('Code Implementation Story')) {
      hasCodeFlow = true;
    }
    if (lines[i].includes('document_flow') || lines[i].includes('Document-Only Story')) {
      hasDocumentFlow = true;
    }
  }

  results.push({
    check: 'Story Type Detection 逻辑',
    status: storyTypeDetectionFound && hasCodeFlow && hasDocumentFlow ? 'PASS' :
            storyTypeDetectionFound ? 'WARNING' : 'FAIL',
    details: storyTypeDetectionFound
      ? `找到 Story Type Detection (第 ${storyTypeLineNumber} 行). code_flow: ${hasCodeFlow}, document_flow: ${hasDocumentFlow}`
      : '未找到 Story Type Detection 逻辑',
    lineNumber: storyTypeLineNumber
  });

  // 4. 检查 Epic-Level Routing 支持
  let epicRoutingFound = false;
  let epicRoutingLineNumber = 0;
  let hasEpicRoutingSection = false;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Epic-Level Routing') || lines[i].includes('Epic 级路由')) {
      hasEpicRoutingSection = true;
      epicRoutingLineNumber = i + 1;
    }
    if (lines[i].includes('audit_granularity.mode: epic') || lines[i].includes('epic 模式')) {
      epicRoutingFound = true;
    }
  }

  results.push({
    check: 'Epic-Level Routing 支持',
    status: hasEpicRoutingSection && epicRoutingFound ? 'PASS' :
            hasEpicRoutingSection ? 'WARNING' : 'FAIL',
    details: hasEpicRoutingSection
      ? `找到 Epic-Level Routing 章节 (第 ${epicRoutingLineNumber} 行). epic模式配置: ${epicRoutingFound}`
      : '未找到 Epic-Level Routing 章节',
    lineNumber: epicRoutingLineNumber
  });

  // 5. 检查 Auto-Continue 逻辑
  let autoContinueFound = false;
  let autoContinueLineNumber = 0;
  let hasAutoContinueCheck = false;
  let hasActionToStageMap = false;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Auto-Continue Detection') || lines[i].includes('auto_continue')) {
      autoContinueFound = true;
      autoContinueLineNumber = i + 1;
    }
    if (lines[i].includes('auto_continue_check') || lines[i].includes('auto_continue.enabled')) {
      hasAutoContinueCheck = true;
    }
    if (lines[i].includes('action_to_stage_map')) {
      hasActionToStageMap = true;
    }
  }

  results.push({
    check: 'Auto-Continue 逻辑',
    status: autoContinueFound && hasAutoContinueCheck && hasActionToStageMap ? 'PASS' :
            autoContinueFound ? 'WARNING' : 'FAIL',
    details: autoContinueFound
      ? `找到 Auto-Continue 逻辑 (第 ${autoContinueLineNumber} 行). enabled检查: ${hasAutoContinueCheck}, action映射: ${hasActionToStageMap}`
      : '未找到 Auto-Continue 逻辑',
    lineNumber: autoContinueLineNumber
  });

  // 6. 检查输出格式要求
  const hasOutputFormat = content.includes('Output Per Turn') ||
                           content.includes('Always state:') ||
                           content.includes('allowed_action');

  results.push({
    check: '输出格式要求',
    status: hasOutputFormat ? 'PASS' : 'WARNING',
    details: hasOutputFormat
      ? '找到输出格式要求 (allowed_action, follow_up, state_patch 等)'
      : '未明确找到输出格式要求',
    lineNumber: undefined
  });

  // 7. 检查三层审计结构引用
  const hasThreeLayerStructure = content.includes('Cursor Canonical Base') ||
                                  content.includes('Claude/OMC Runtime Adapter') ||
                                  content.includes('Repo Add-ons');

  results.push({
    check: '三层审计结构引用',
    status: hasThreeLayerStructure ? 'PASS' : 'WARNING',
    details: hasThreeLayerStructure
      ? '找到三层审计结构引用'
      : '未找到三层审计结构引用 (可能继承自通用协议)',
    lineNumber: undefined
  });

  // 8. 审计项 2: Auditor 文件存在性
  const requiredAuditors = [
    { stage: 'spec', file: '.claude/agents/auditors/auditor-spec.md' },
    { stage: 'plan', file: '.claude/agents/auditors/auditor-plan.md' },
    { stage: 'gaps', file: '.claude/agents/auditors/auditor-gaps.md' },
    { stage: 'tasks', file: '.claude/agents/auditors/auditor-tasks.md' },
    { stage: 'implement', file: '.claude/agents/auditors/auditor-implement.md' },
    { stage: 'document', file: '.claude/agents/auditors/auditor-document.md' },
  ];

  let auditorMissing = false;
  const auditorDetails: string[] = [];
  requiredAuditors.forEach(auditor => {
    const filePath = path.join(process.cwd(), auditor.file);
    if (fs.existsSync(filePath)) {
      auditorDetails.push(`✅ ${auditor.stage} → ${auditor.file}`);
    } else {
      auditorDetails.push(`❌ ${auditor.stage} → ${auditor.file} 不存在`);
      auditorMissing = true;
    }
  });

  results.push({
    check: 'Auditor 文件存在性',
    status: auditorMissing ? 'FAIL' : 'PASS',
    details: auditorMissing
      ? `部分 Auditor 文件缺失: ${auditorDetails.filter(d => d.startsWith('❌')).join('; ')}`
      : `所有 ${requiredAuditors.length} 个 Auditor 文件均存在`,
    lineNumber: undefined
  });

  // 9. 审计项 4: Layer 4 Agent Prerequisites 一致性
  const prerequisiteChecks = [
    { agent: 'plan', file: '.claude/agents/layers/bmad-layer4-speckit-plan.md', expected: 'specify_passed' },
    { agent: 'gaps', file: '.claude/agents/layers/bmad-layer4-speckit-gaps.md', expected: 'plan_passed' },
    { agent: 'tasks', file: '.claude/agents/layers/bmad-layer4-speckit-tasks.md', expected: 'gaps_passed' },
    { agent: 'implement', file: '.claude/agents/layers/bmad-layer4-speckit-implement.md', expected: 'tasks_passed' },
  ];

  let prereqMismatch = false;
  const prereqDetails: string[] = [];
  prerequisiteChecks.forEach(check => {
    const filePath = path.join(process.cwd(), check.file);
    if (!fs.existsSync(filePath)) {
      prereqDetails.push(`❌ ${check.agent} agent 文件不存在`);
      prereqMismatch = true;
      return;
    }

    const agentContent = fs.readFileSync(filePath, 'utf-8');
    if (agentContent.includes(check.expected)) {
      prereqDetails.push(`✅ ${check.agent} agent Prerequisites 包含 ${check.expected}`);
    } else {
      prereqDetails.push(`❌ ${check.agent} agent Prerequisites 未包含 ${check.expected}`);
      prereqMismatch = true;
    }
  });

  results.push({
    check: 'Layer 4 Agent Prerequisites 一致性',
    status: prereqMismatch ? 'FAIL' : 'PASS',
    details: prereqMismatch
      ? `Prerequisites 不一致: ${prereqDetails.filter(d => d.startsWith('❌')).join('; ')}`
      : `所有 ${prerequisiteChecks.length} 个 Layer 4 Agent Prerequisites 与路由一致`,
    lineNumber: undefined
  });

  // 计算统计
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warnings = results.filter(r => r.status === 'WARNING').length;

  const report: AuditReport = {
    timestamp: new Date().toISOString(),
    fileAudited: masterAgentPath,
    summary: {
      totalChecks: results.length,
      passed,
      failed,
      warnings
    },
    results,
    routingRules,
    storyTypeDetection: {
      found: storyTypeDetectionFound,
      lineNumber: storyTypeLineNumber,
      details: `code_flow: ${hasCodeFlow}, document_flow: ${hasDocumentFlow}`
    },
    epicLevelRouting: {
      found: hasEpicRoutingSection && epicRoutingFound,
      lineNumber: epicRoutingLineNumber,
      details: `章节: ${hasEpicRoutingSection}, epic模式: ${epicRoutingFound}`
    },
    autoContinueLogic: {
      found: autoContinueFound && hasAutoContinueCheck && hasActionToStageMap,
      lineNumber: autoContinueLineNumber,
      details: `auto_continue: ${autoContinueFound}, enabled检查: ${hasAutoContinueCheck}, action映射: ${hasActionToStageMap}`
    }
  };

  return report;
}

function generateMarkdownReport(report: AuditReport): string {
  const lines: string[] = [];

  lines.push('# Stage Routing 审计报告');
  lines.push('');
  lines.push(`**审计时间**: ${report.timestamp}`);
  lines.push(`**审计文件**: ${report.fileAudited}`);
  lines.push('');

  // 摘要
  lines.push('## 摘要');
  lines.push('');
  lines.push('| 指标 | 数值 |');
  lines.push('|------|------|');
  lines.push(`| 总检查项 | ${report.summary.totalChecks} |`);
  lines.push(`| 通过 | ${report.summary.passed} |`);
  lines.push(`| 失败 | ${report.summary.failed} |`);
  lines.push(`| 警告 | ${report.summary.warnings} |`);
  lines.push('');

  const overallStatus = report.summary.failed === 0 ? '✅ 通过' :
                         report.summary.warnings > 0 ? '⚠️ 有条件通过' : '❌ 失败';
  lines.push(`**总体状态**: ${overallStatus}`);
  lines.push('');

  // 详细结果
  lines.push('## 详细检查结果');
  lines.push('');

  for (const result of report.results) {
    const icon = result.status === 'PASS' ? '✅' :
                  result.status === 'WARNING' ? '⚠️' : '❌';
    lines.push(`### ${icon} ${result.check}`);
    lines.push('');
    lines.push(`- **状态**: ${result.status}`);
    if (result.lineNumber) {
      lines.push(`- **行号**: ${result.lineNumber}`);
    }
    lines.push(`- **详情**: ${result.details}`);
    lines.push('');
  }

  // 路由规则汇总
  lines.push('## 路由规则检查汇总');
  lines.push('');
  lines.push('| Stage | 路由目标 | 状态 | 行号 |');
  lines.push('|-------|----------|------|------|');

  for (const rule of report.routingRules) {
    const status = rule.found ? '✅' : '❌';
    const lineNum = rule.lineNumber ? rule.lineNumber.toString() : 'N/A';
    lines.push(`| ${rule.stage} | ${rule.routeTo} | ${status} | ${lineNum} |`);
  }
  lines.push('');

  // 关键功能模块
  lines.push('## 关键功能模块');
  lines.push('');

  // Story Type Detection
  lines.push('### Story Type Detection');
  lines.push('');
  if (report.storyTypeDetection) {
    const icon = report.storyTypeDetection.found ? '✅' : '❌';
    lines.push(`- **状态**: ${icon} ${report.storyTypeDetection.found ? '已找到' : '未找到'}`);
    if (report.storyTypeDetection.lineNumber) {
      lines.push(`- **行号**: ${report.storyTypeDetection.lineNumber}`);
    }
    lines.push(`- **详情**: ${report.storyTypeDetection.details}`);
  }
  lines.push('');

  // Epic-Level Routing
  lines.push('### Epic-Level Routing');
  lines.push('');
  if (report.epicLevelRouting) {
    const icon = report.epicLevelRouting.found ? '✅' : '❌';
    lines.push(`- **状态**: ${icon} ${report.epicLevelRouting.found ? '已找到' : '未找到'}`);
    if (report.epicLevelRouting.lineNumber) {
      lines.push(`- **行号**: ${report.epicLevelRouting.lineNumber}`);
    }
    lines.push(`- **详情**: ${report.epicLevelRouting.details}`);
  }
  lines.push('');

  // Auto-Continue Logic
  lines.push('### Auto-Continue Logic');
  lines.push('');
  if (report.autoContinueLogic) {
    const icon = report.autoContinueLogic.found ? '✅' : '❌';
    lines.push(`- **状态**: ${icon} ${report.autoContinueLogic.found ? '已找到' : '未找到'}`);
    if (report.autoContinueLogic.lineNumber) {
      lines.push(`- **行号**: ${report.autoContinueLogic.lineNumber}`);
    }
    lines.push(`- **详情**: ${report.autoContinueLogic.details}`);
  }
  lines.push('');

  // Auditor 文件存在性
  lines.push('### Auditor 文件存在性');
  lines.push('');
  const auditorResult = report.results.find(r => r.check === 'Auditor 文件存在性');
  if (auditorResult) {
    const icon = auditorResult.status === 'PASS' ? '✅' : '❌';
    lines.push(`- **状态**: ${icon} ${auditorResult.details}`);
  }
  lines.push('');

  // Layer 4 Agent Prerequisites 一致性
  lines.push('### Layer 4 Agent Prerequisites 一致性');
  lines.push('');
  const prereqResult = report.results.find(r => r.check === 'Layer 4 Agent Prerequisites 一致性');
  if (prereqResult) {
    const icon = prereqResult.status === 'PASS' ? '✅' : '❌';
    lines.push(`- **状态**: ${icon} ${prereqResult.details}`);
  }
  lines.push('');

  // 问题诊断
  lines.push('## 问题诊断');
  lines.push('');

  const failedChecks = report.results.filter(r => r.status === 'FAIL');
  const warningChecks = report.results.filter(r => r.status === 'WARNING');

  if (failedChecks.length === 0 && warningChecks.length === 0) {
    lines.push('✅ **所有检查项均通过，未发现明显问题。**');
    lines.push('');
    lines.push('路由逻辑结构完整，包含：');
    lines.push('- 所有必需的 stage 路由规则');
    lines.push('- Story Type Detection 逻辑');
    lines.push('- Epic-Level Routing 支持');
    lines.push('- Auto-Continue 逻辑');
  } else {
    if (failedChecks.length > 0) {
      lines.push('### ❌ 失败项');
      lines.push('');
      for (const check of failedChecks) {
        lines.push(`- **${check.check}**: ${check.details}`);
      }
      lines.push('');
    }

    if (warningChecks.length > 0) {
      lines.push('### ⚠️ 警告项');
      lines.push('');
      for (const check of warningChecks) {
        lines.push(`- **${check.check}**: ${check.details}`);
      }
      lines.push('');
    }

    lines.push('### 建议修复');
    lines.push('');

    // 检查缺失的路由规则
    const missingRoutes = report.routingRules.filter(r => !r.found);
    if (missingRoutes.length > 0) {
      lines.push('1. **补充缺失的路由规则**:');
      for (const route of missingRoutes) {
        lines.push(`   - 添加 \`${route.stage} → ${route.routeTo}\` 路由规则`);
      }
      lines.push('');
    }

    if (!report.storyTypeDetection?.found) {
      lines.push('2. **添加 Story Type Detection 逻辑**: 在 tasks_passed stage 后添加 code_flow 和 document_flow 分支');
      lines.push('');
    }

    if (!report.epicLevelRouting?.found) {
      lines.push('3. **添加 Epic-Level Routing 支持**: 支持 audit_granularity.mode = epic 时的特殊路由');
      lines.push('');
    }

    if (!report.autoContinueLogic?.found) {
      lines.push('4. **完善 Auto-Continue 逻辑**: 添加 handoff readiness 和 runtime permission 检查');
      lines.push('');
    }
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('*由 audit-stage-routing.ts 自动生成*');

  return lines.join('\n');
}

function main(): void {
  console.log('🔍 开始审计 Stage Routing 逻辑...\n');

  const report = auditStageRouting();

  console.log(`✅ 完成 ${report.summary.totalChecks} 项检查`);
  console.log(`   通过: ${report.summary.passed}`);
  console.log(`   失败: ${report.summary.failed}`);
  console.log(`   警告: ${report.summary.warnings}\n`);

  // 生成 Markdown 报告
  const markdownReport = generateMarkdownReport(report);

  // 确保输出目录存在
  const outputDir = path.join(process.cwd(), '_bmad-output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 写入报告
  const outputPath = path.join(outputDir, 'routing-audit-report.md');
  fs.writeFileSync(outputPath, markdownReport, 'utf-8');

  console.log(`📝 审计报告已保存到: ${outputPath}\n`);

  // 输出关键发现
  if (report.summary.failed > 0) {
    console.log('❌ 发现以下问题：');
    for (const result of report.results.filter(r => r.status === 'FAIL')) {
      console.log(`   - ${result.check}: ${result.details}`);
    }
    console.log('');
  }

  if (report.summary.warnings > 0) {
    console.log('⚠️ 发现以下警告：');
    for (const result of report.results.filter(r => r.status === 'WARNING')) {
      console.log(`   - ${result.check}: ${result.details}`);
    }
    console.log('');
  }

  if (report.summary.failed === 0 && report.summary.warnings === 0) {
    console.log('✅ 所有检查通过，路由逻辑结构完整！\n');
  }

  // 输出 JSON 结果供程序解析
  console.log('📊 JSON 结果:');
  console.log(JSON.stringify(report, null, 2));
}

if (require.main === module) {
  main();
}

export { auditStageRouting, generateMarkdownReport };
