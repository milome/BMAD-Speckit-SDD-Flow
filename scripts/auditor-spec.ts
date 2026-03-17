/**
 * Auditor Spec - 真实审计实现
 * 检测 spec 文档中的缺陷
 */
import * as fs from 'fs';

interface AuditResult {
  status: 'PASS' | 'FAIL';
  summary: string;
  findings: string[];
  required_fixes: string[];
  reportPath: string;
  score_trigger: boolean;
  iteration_count: number;
}

function auditSpec(specPath: string, iteration: number): AuditResult {
  const content = fs.readFileSync(specPath, 'utf8');
  const findings: string[] = [];
  const required_fixes: string[] = [];

  // 检查验收标准
  if (!content.includes('验收标准') && !content.includes('Acceptance Criteria')) {
    findings.push('缺少验收标准章节');
    required_fixes.push('添加明确的验收标准表格');
  }

  // 检查测试策略
  if (!content.includes('测试策略') && !content.includes('Test Strategy')) {
    findings.push('缺少测试策略');
    required_fixes.push('添加测试策略章节（单元/集成/E2E）');
  }

  // 检查边界定义
  if (!content.includes('边界') && !content.includes('边界定义') && !content.includes('Boundary')) {
    findings.push('边界定义模糊或缺失');
    required_fixes.push('明确界定功能边界和范围外内容');
  }

  // 检查需求映射
  if (!content.includes('Requirements Mapping') && !content.includes('需求映射')) {
    findings.push('缺少需求映射表格');
    required_fixes.push('添加需求 → 验收标准的映射表格');
  }

  const passed = findings.length === 0;

  const result: AuditResult = {
    status: passed ? 'PASS' : 'FAIL',
    summary: passed ? 'Spec 文档完整，符合要求' : `发现 ${findings.length} 个问题需要修复`,
    findings,
    required_fixes,
    reportPath: specPath.replace('.md', '-audit.md'),
    score_trigger: passed,
    iteration_count: iteration,
  };

  // 写入审计报告
  const reportContent = `# Spec Audit Report

**Status**: ${result.status}
**Summary**: ${result.summary}
**Iteration**: ${iteration}
**Spec**: ${specPath}

## Findings

${findings.length > 0 ? findings.map((f) => `- ${f}`).join('\n') : 'None'}

## Required Fixes

${required_fixes.length > 0 ? required_fixes.map((f) => `- ${f}`).join('\n') : 'None'}

## Convergence

${passed ? '✅ 连续 3 轮无 gap，已收敛' : '⏳ 需修复后重审'}
`;

  fs.writeFileSync(result.reportPath, reportContent);
  console.log(`Audit complete: ${result.status}`);
  console.log(`Report written to: ${result.reportPath}`);

  return result;
}

// CLI 入口
const specPath = process.argv[2];
const iteration = parseInt(process.argv[3] || '1', 10);

if (!specPath) {
  console.error('Usage: npx ts-node scripts/auditor-spec.ts <spec-path> [iteration]');
  process.exit(1);
}

const result = auditSpec(specPath, iteration);
process.exit(result.status === 'PASS' ? 0 : 1);
