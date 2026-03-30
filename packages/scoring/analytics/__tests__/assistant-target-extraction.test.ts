import { describe, expect, it } from 'vitest';
import {
  extractGapsAssistantTargets,
  extractImplementAssistantTargets,
  extractPlanAssistantTargets,
  extractSpecCoverageAssistantTargets,
  extractSpecAssistantTargets,
  extractStoryAssistantTargets,
  extractTasksAssistantTargets,
} from '../audit-report-parser';
import { extractAssistantTarget } from '../canonical-sample';

describe('assistant target extraction by real audit format', () => {
  it('extracts spec assistant target from required fixes block', () => {
    const content = `# AUDIT Report: E001-S001 Spec (Round 1)

## §4 发现的问题 (Required Fixes)

### Gap-001: FR-002 定义模糊
**位置**: §功能需求 / FR-002
**问题**: 常见一词主观
**建议**: 改为“域名格式验证”或明确列出支持的顶级域名
**修复方式**: 修改 spec.md
`;

    expect(extractSpecAssistantTargets(content)).toContain('改为“域名格式验证”或明确列出支持的顶级域名');
    expect(extractAssistantTarget(content)).toContain('域名格式验证');
  });

  it('extracts plan assistant target from numbered implementation steps', () => {
    const content = `# plan-E001-S001

1. 在 tests/story-workflow/StageValidator.test.ts 增加 allowed next stages 查询断言。
2. 在 src/story-workflow/StageValidator.ts 新增 allowed next stages 查询方法。
`;

    expect(extractPlanAssistantTargets(content)).toContain(
      '1. 在 tests/story-workflow/StageValidator.test.ts 增加 allowed next stages 查询断言。'
    );
    expect(extractAssistantTarget(content)).toContain('allowed next stages');
  });

  it('extracts plan assistant target from coverage-audit warning rows and fix suggestions', () => {
    const content = `# Spec E6-S4 vs Story 6.4 覆盖度审计报告

| (5) 查询层复用 | 6.3 已完成则复用 query；6.3 未完成则 inline 逻辑 | spec §3.3 | ❌ **未覆盖 6.3 未完成路径** |

### 未通过项与修改建议
1. Story 6.3 未完成时的 fallback 路径未覆盖
2. 补充 parseEpicStoryFromRecord 的 import 来源
`;

    expect(extractPlanAssistantTargets(content).some((item) => item.includes('fallback 路径未覆盖'))).toBe(true);
    expect(extractAssistantTarget(content)).toContain('fallback 路径未覆盖');
  });

  it('extracts tasks assistant target from task tables and checkboxes', () => {
    const content = `# tasks-E9-S4

| T5 | spec §3.4 | AC-3 | bmad-story-assistant 失败轮路径约定 |
- [x] **T6.1** scoring/veto/ 下新增 veto-and-tier 模块
`;

    expect(extractTasksAssistantTargets(content)).toContain('T5 spec §3.4');
    expect(extractTasksAssistantTargets(content)).toContain('T6.1 scoring/veto/ 下新增 veto-and-tier 模块');
    expect(extractAssistantTarget(content)).toContain('veto-and-tier');
  });

  it('extracts tasks assistant target from real story markdown checklists', () => {
    const content = `# Story 10.2: 非交互式 init

## Tasks / Subtasks
- [ ] **T1**：TTY 检测与 utils/tty.js（AC: 3）
- [ ] T1.2 InitCommand 在流程开始时检测 TTY，非 TTY 且无 --ai/--yes 时设置 internalYes=true
`;

    expect(extractTasksAssistantTargets(content)).toContain('**T1**：TTY 检测与 utils/tty.js（AC: 3）');
    expect(extractAssistantTarget(content)).toContain('internalYes=true');
  });

  it('extracts tasks assistant target from real phase/task blocks', () => {
    const content = `# Tasks E9-S4

## Phase 1：Schema + 写入（T1–T3）
### T2 [x] parseAndWriteScore 支持 iterationReportPaths（GAP-2.1, 2.2, 2.3）
- **修改**：scoring/orchestrator/parse-and-write.ts
- **内容**：新增 iterationReportPaths?: string[]
- **验收**：单测 2 fail+1 pass → 3 条
`;

    expect(extractTasksAssistantTargets(content)).toContain('Phase 1：Schema + 写入（T1–T3）');
    expect(extractAssistantTarget(content)).toContain('iterationReportPaths?: string[]');
  });

  it('extracts spec-vs-story coverage assistant target from warning rows and suggestions', () => {
    const content = `# Spec E6-S4 vs Story 6.4 覆盖度审计报告

| (5) 查询层复用 | 6.3 已完成则复用 query；6.3 未完成则 inline 逻辑 | spec §3.3 | ❌ **未覆盖 6.3 未完成路径** |

1. **遗漏**：Story 6.3 未完成时的 fallback 路径未覆盖
2. **模糊表述**：需补充分组语义
`;

    expect(extractSpecCoverageAssistantTargets(content).some((item) => item.includes('未覆盖 6.3 未完成路径'))).toBe(true);
    expect(extractAssistantTarget(content)).toContain('fallback 路径未覆盖');
  });

  it('extracts spec-vs-story coverage assistant target from conclusion lines', () => {
    const content = `# Spec E6-S4 vs Story 6.4 覆盖度审计报告

### 覆盖度小结
| Story §3.1 实现范围 | ⚠️ 6/7 覆盖；1 项未覆盖 |

### 最终结论
未完全通过。

建议后续动作：
- 触发 clarify 流程，补全 5 处模糊表述
`;

    expect(extractSpecCoverageAssistantTargets(content)).toContain('未完全通过。');
    expect(extractAssistantTarget(content)).toContain('clarify 流程');
  });

  it('extracts story assistant target from conclusion and completion guidance', () => {
    const content = `# Story 3.3 实施后 §5 执行阶段审计报告

## 批判审计员结论

**本轮无新 gap。**

## 审计结论

**完全覆盖、验证通过。**

建议主 Agent 将本 Story 标记为完成，并进入后续收尾或 Epic 集成。
`;

    expect(extractStoryAssistantTargets(content)).toContain('将本 Story 标记为完成，并进入后续收尾或 Epic 集成。');
    expect(extractAssistantTarget(content)).toContain('后续收尾或 Epic 集成');
  });

  it('extracts gaps assistant target from modified gap summary and completion hint', () => {
    const content = `# IMPLEMENTATION_GAPS 审计报告：Story 10.1

**已修改内容**：
1. **GAP-4.5**：补充模板拉取超时/网络失败 → 退出码 3
2. **GAP-8.1**：补充目标路径不可写校验 → 退出码 4

## 2. 审计结论

**完全覆盖、验证通过。**
`;

    expect(extractGapsAssistantTargets(content)).toContain('补充模板拉取超时/网络失败 → 退出码 3');
    expect(extractAssistantTarget(content)).toContain('退出码 3');
  });

  it('extracts implement assistant target from task rows and completion guidance', () => {
    const content = `# Story 3.3 实施后 §5 执行阶段审计报告

| T1 parseAndWriteScore | 阅读 parse-and-write.ts：完整实现 reportPath/content→parseAuditReport→writeScoreRecordSync | ✅ |
| T5 测试与验收 | parse-and-write.test.ts 5 用例、accept-e3-s3 3 stage 全测 | ✅ |

建议主 Agent 将本 Story 标记为完成，并进入后续收尾或 Epic 集成。
`;

    expect(extractImplementAssistantTargets(content)[0]).toContain('T1 parseAndWriteScore');
    expect(extractAssistantTarget(content)).toContain('parseAndWriteScore');
  });

  it('extracts implement assistant target from acceptance rows beyond completion guidance', () => {
    const content = `# Story 15.1 实施后审计

| 需求 | 实现 | 测试/验收 |
| AC-1 报告→scoring/data 记录 | parse-and-write.ts | parse-and-write.test.ts (5) |
| 验收命令 | 执行结果 | 报告填写 |
| npm run accept:e3-s3 | PASS (all 3 stages) | 已填写 |
`;

    expect(extractImplementAssistantTargets(content).some((item) => item.includes('AC-1 报告→scoring/data 记录'))).toBe(true);
    expect(extractAssistantTarget(content)).toContain('accept:e3-s3');
  });

  it('extracts implement assistant target from real audit scope and requirement tables', () => {
    const content = `# AUDIT Implement E001-S1

| Story 需求 | spec 对应 | 实现状态 | 验证方式 |
| add 函数 | spec §2.2.2 | ✅ 已实现 | export function add(a: number, b: number): number |

| 需求 | 实现 | 测试/验收 |
| AC-1 报告→scoring/data 记录 | parse-and-write.ts | parse-and-write.test.ts (5) |
`;

    expect(extractImplementAssistantTargets(content).some((item) => item.includes('add(a: number, b: number)'))).toBe(true);
    expect(extractAssistantTarget(content)).toContain('parse-and-write');
  });

  it('extracts implement assistant target from audit summary lines in real stage4 review', () => {
    const content = `# Story 10-5 --bmad-path worktree 共享 — 实施后审计报告（Stage 4）复核

## 3. 批判审计员结论（复核轮）
- 一致性：progress 中 T2～T6 的 RED/GREEN/REFACTOR 三项齐全

## 4. 最终结论
**结论**：**完全覆盖、验证通过**。
- **TDD 完整性**：progress 中 US-002～US-006 各段均已包含至少一行 [TDD-RED]
`;

    expect(
      extractImplementAssistantTargets(content).some((item) => item.includes('TDD 完整性'))
    ).toBe(true);
    expect(extractAssistantTarget(content)).toContain('完全覆盖、验证通过');
  });
});
