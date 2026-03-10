# Spec 审计报告：spec-E6-S2.md vs 6-2-coach-epic-story-filter.md

**审计日期**：2025-03-06  
**审计对象**：`specs/epic-6/story-2-coach-epic-story-filter/spec-E6-S2.md`  
**需求来源**：`_bmad-output/implementation-artifacts/epic-6-eval-ux-coach-and-query/story-6-2-coach-epic-story-filter/6-2-coach-epic-story-filter.md`

---

## 模型选择信息

| 项目 | 值 |
|------|-----|
| 配置来源 | .claude/agents/code-reviewer.md |
| 指定模型 | inherit（来自 frontmatter，继承主 Agent 模型） |
| 选择依据 | 子代理 YAML 中 model: inherit；可改为 fast 以节省审计成本（若环境支持） |

---

## 1. 审计方法

- **对照维度**：原始需求文档各章节 → spec 对应位置
- **验证方式**：逐条阅读、交叉引用 RUN_ID_CONVENTION.md、prd.eval-ux-last-mile.md
- **结论判定**：完全覆盖 = 所有原始要点有明确 spec 对应；模糊表述 = 需求描述不明确、边界未定、术语歧义

---

## 2. 原始文档 §1 需求追溯

| 原始要点 | 验证内容 | spec 对应 | 验证结果 |
|----------|----------|-----------|----------|
| REQ-UX-1.5 | CLI 参数 `--epic N`，仅诊断 Epic N 相关数据 | spec §3.2、§3.4、§3.5、§3.8 | ✅ 覆盖 |
| REQ-UX-1.6 | CLI 参数 `--story X.Y`，epicId=X, storyId=Y | spec §3.2、§3.4、§3.5、§3.8 | ✅ 覆盖 |
| REQ-UX-2.2 | epic_id/story_id 解析规则；无约定时明确反馈 | spec §3.3、§3.6 | ✅ 覆盖 |
| REQ-UX-2.4 | Epic/Story 筛选仅针对 real_dev | spec §3.3.3、§3.4 | ✅ 覆盖 |

**结论**：§1 需求追溯已完全覆盖。

---

## 3. 原始文档 §2 User Story

| 原始要点 | 验证内容 | spec 对应 | 验证结果 |
|----------|----------|-----------|----------|
| As a 日常开发者 | 用户角色 | spec §3.1 功能目标 | ✅ 隐含于「入口」与「输出」 |
| I want to 运行 --epic 3 或 --story 3.3 | 能力诉求 | spec §3.2 参数解析、§3.8 验收命令 | ✅ 覆盖 |
| so that 只看指定 Epic/Story 短板诊断 | 价值目标 | spec §3.1「筛选策略」、§3.4 筛选流程 | ✅ 覆盖 |

**结论**：§2 User Story 已完全覆盖。

---

## 4. 原始文档 §3 Scope

### 4.1 §3.1 本 Story 实现范围

| 原始要点 | 验证内容 | spec 对应 | 验证结果 |
|----------|----------|-----------|----------|
| `/bmad-coach --epic N` 仅诊断 Epic N 相关数据 | 能力与范围 | spec §3.2、§3.4、§3.5 | ✅ 覆盖 |
| 仅对符合 run_id 约定或含 metadata 的 record 生效 | 数据范围约束 | spec §3.3、§3.6 | ⚠️ **模糊表述**：spec 未明确「含 metadata」的解析规则，仅覆盖 run_id 正则与 source_path fallback；若 record 通过 metadata 承载 epic_id/story_id，spec 未定义 |
| `/bmad-coach --story X.Y` 仅诊断 Story X.Y | 能力 | spec §3.2、§3.4、§3.5 | ✅ 覆盖 |
| 解析规则 epicId=X, storyId=Y | 解析规格 | spec §3.2、§3.4 | ✅ 覆盖 |
| 无约定数据时调用方得到明确反馈 | 反馈要求 | spec §3.6 | ✅ 覆盖 |
| Epic/Story 筛选仅作用于 scenario !== eval_question | 范围约束 | spec §3.3.3、§3.4 | ✅ 覆盖 |
| Story 6.3 已完成：复用 queryByEpic/queryByStory | 实现路径 | spec §3.3 前置条件、§5 依赖 | ✅ 覆盖 |
| Story 6.3 未完成：最小 inline 筛选（run_id 正则 + source_path） | 实现路径 | spec §3.3 完整规格 | ✅ 覆盖 |

### 4.2 §3.2 非本 Story 范围

| 原始要点 | 验证内容 | spec 对应 | 验证结果 |
|----------|----------|-----------|----------|
| queryByEpic 等由 Story 6.3 负责 | 边界划分 | spec §3.3 前置条件、§5 | ✅ 覆盖 |
| /bmad-scores、bmad-eval-analytics 由 6.4、6.5 负责 | 边界划分 | 未显式列举 | ✅ 可通过「本 spec 仅覆盖 coach --epic/--story」推断 |

**结论**：§3 整体覆盖完整；**存在模糊表述**：metadata 承载 epic_id/story_id 的解析规则未在 spec 中定义。

---

## 5. 原始文档 §4 验收标准

| AC | 原始 Given/When/Then | spec 对应 | 验证结果 |
|----|----------------------|-----------|----------|
| AC-1 | 存在 Epic 3 记录 → 运行 --epic 3 → 仅诊断 Epic 3 | spec §3.8 验收命令第 1 行 | ✅ 覆盖 |
| AC-2 | 存在 Story 3.3 记录 → 运行 --story 3.3 → 仅诊断 Story 3.3 | spec §3.8 验收命令第 2 行 | ✅ 覆盖 |
| AC-3 | 记录无 epic_id/story_id 可解析 → 运行 --epic/--story → 明确反馈 | spec §3.6、§3.8 | ✅ 覆盖 |

**结论**：§4 验收标准已完全覆盖。

---

## 6. 原始文档 §5 实现约束与依赖

### 6.1 §5.1 现有能力（Story 6.1 产出）

| 原始要点 | 验证内容 | spec 对应 | 验证结果 |
|----------|----------|-----------|----------|
| coachDiagnose、formatToMarkdown | 复用能力 | spec §3.5、§5 依赖 | ✅ 覆盖 |
| discoverLatestRunId | 复用能力 | spec §3.2、§3.5、§5 | ✅ 覆盖 |
| coach-diagnose.ts 支持无 --run-id、--limit、--format | 脚本能力 | spec §3.2 与 run-id 互斥 | ✅ 覆盖 |
| commands/bmad-coach.md 未含 --epic、--story | 待补充 | spec §3.7 | ✅ 覆盖 |

### 6.2 §5.2 实现路径

| 原始要点 | 验证内容 | spec 对应 | 验证结果 |
|----------|----------|-----------|----------|
| 新增 --epic N、--story X.Y 解析 | 实现步骤 | spec §3.2、§3.9 | ✅ 覆盖 |
| 有 Story 6.3 时优先 queryByEpic/queryByStory | 实现路径 | spec §3.3 前置条件 | ✅ 覆盖 |
| 最小 inline 逻辑：run_id 正则 + source_path + scenario 过滤 | 实现规格 | spec §3.3.1、§3.3.2、§3.3.3 | ✅ 覆盖 |
| 无匹配时输出明确反馈 | 行为 | spec §3.6 | ✅ 覆盖 |
| coachDiagnose 扩展 options 或封装 | 实现方案 | spec §3.5 方案 A/B 与最终规格 | ✅ 覆盖 |
| Command 文档更新、同步 .cursor/commands | 产出 | spec §3.7 | ✅ 覆盖 |

### 6.3 §5.3 解析规则（RUN_ID_CONVENTION.md）

| 原始要点 | 验证内容 | spec 对应 | 验证结果 |
|----------|----------|-----------|----------|
| run_id：-e(\d+)-s(\d+)- 或 -e(\d+)-s(\d+)$ | 正则一致性 | spec §3.3.1 | ✅ 与 RUN_ID_CONVENTION §2.1 一致 |
| source_path：epic-{N}-*/story-{N}-*、story-{epic}-{story}-* | fallback 一致性 | spec §3.3.2 | ⚠️ **歧义**：spec 中 `epic-{N}-*/story-{N}-*` 使用同一符号 {N}，易被理解为 epic=story；RUN_ID_CONVENTION 示例为 epic-5-.../story-5-...→(5,5)，建议改为 `epic-{epic}-*/story-{story}-*` 以消除歧义 |
| scenario 过滤 | 与 PRD 一致 | spec §3.3.3 | ✅ 覆盖 |

**结论**：§5 实现约束与依赖已覆盖；**存在术语歧义**：source_path 模式中的 {N} 可引发解读歧义。

---

## 7. 原始文档 §6 Tasks / Subtasks

| 原始 Task/Subtask | 验证内容 | spec 对应 | 验证结果 |
|-------------------|----------|-----------|----------|
| Task 1：扩展 coach-diagnose.ts | 主任务 | spec §3.2、§3.4、§3.6、§3.9 | ✅ 覆盖 |
| Subtask 1.1：解析参数、校验格式 | 子任务 | spec §3.2 参数解析表 | ✅ 覆盖 |
| Subtask 1.2：实现最小 inline 筛选或复用 query | 子任务 | spec §3.3、§3.4 | ✅ 覆盖 |
| Subtask 1.3：无匹配时输出明确反馈 | 子任务 | spec §3.6 | ✅ 覆盖 |
| Task 2：扩展 coachDiagnose 或封装 | 主任务 | spec §3.5 | ✅ 覆盖 |
| Subtask 2.1：确定 options/封装路径 | 子任务 | spec §3.5 方案 A/B 与最终规格 | ✅ 覆盖 |
| Subtask 2.2：实现筛选后调用链 | 子任务 | spec §3.5 最终规格 | ✅ 覆盖 |
| Task 3：更新 commands/bmad-coach.md | 主任务 | spec §3.7 | ✅ 覆盖 |
| Subtask 3.1：新增参数说明 | 子任务 | spec §3.7 | ✅ 覆盖 |
| Subtask 3.2：补充验收命令 | 子任务 | spec §3.8 | ✅ 覆盖 |

**结论**：§6 Tasks 已完全映射到 spec。

---

## 8. 原始文档 §7 Dev Notes

### 8.1 §7.1 架构约束

| 原始要点 | 验证内容 | spec 对应 | 验证结果 |
|----------|----------|-----------|----------|
| 不修改 RunScoreRecord schema | 禁止项 | spec §4、§5 禁止 | ✅ 覆盖 |
| epic_id/story_id 由解析得出，不写入 record | 设计约束 | spec §4 | ✅ 覆盖 |
| 遵循 RUN_ID_CONVENTION 解析规则与 fallback 顺序 | 实现约束 | spec §3.3、§4 | ✅ 覆盖 |
| Story 6.3 已实现则优先复用 scoring/query/ | 迁移路径 | spec §3.3 前置、§5 | ✅ 覆盖 |

### 8.2 §7.2 源代码涉及

| 原始模块 | 原始变更说明 | spec 对应 | 验证结果 |
|----------|--------------|-----------|----------|
| scripts/coach-diagnose.ts | 新增 --epic、--story 分支；调用筛选逻辑 | spec §3.9 | ✅ 覆盖 |
| scoring/coach/diagnose.ts 或新封装 | 扩展 options 或封装按 records 诊断 | spec §3.5、§3.9 | ✅ 覆盖 |
| scoring/query/ | Story 6.3 已实现时复用 | spec §3.3、§5 | ✅ 覆盖 |
| commands/bmad-coach.md、.cursor/commands/ | 参数说明与调用逻辑 | spec §3.7、§3.9 | ✅ 覆盖 |

### 8.3 §7.3 测试要求

| 原始要点 | 验证内容 | spec 对应 | 验证结果 |
|----------|----------|-----------|----------|
| 单元测试：run_id 解析、source_path fallback、scenario 过滤 | 测试范围 | 未显式要求 | ⚠️ **遗漏**：spec 未列出单元测试要求，仅 §3.8 有验收命令（集成级） |
| 集成/端到端：--epic 3、--story 3.3 在有/无/无约定数据时输出符合 AC | 测试场景 | spec §3.8 | ✅ 部分覆盖（无数据场景在 §3.6，验收命令可推断） |

**结论**：§7.1、§7.2 已覆盖；**§7.3 测试要求**：spec 未明确「单元测试」范围，存在遗漏。

---

## 9. 原始文档 §8、§9、§10

| 章节 | 原始内容 | spec 对应 | 验证结果 |
|------|----------|-----------|----------|
| §8 禁止词表合规声明 | 文档规范 | 不要求 spec 复制 | N/A |
| §9 产出物清单 | Command 扩展、脚本扩展、Coach 扩展、验收命令 | spec §3.7、§3.8、§3.9 | ✅ 覆盖 |
| §10 References | RUN_ID_CONVENTION、prd、story-6-1 | spec §1 输入来源 | ✅ 覆盖 |

---

## 10. 交叉验证：RUN_ID_CONVENTION.md

| 约定文档内容 | spec 一致性 | 验证结果 |
|--------------|-------------|----------|
| run_id 正则 -e(\d+)-s(\d+)- 或 -e(\d+)-s(\d+)$ | spec §3.3.1 完全一致 | ✅ |
| source_path 模式 epic-{N}-*/story-{N}-* | spec 使用相同符号；RUN_ID 示例 story-5-eval... 可解析为 (5,5) | ⚠️ 术语歧义（见上文 §6.3） |
| source_path 模式 story-{epic}-{story}-* | spec §3.3.2 story-4-2-eval-ai-coach → (4,2) | ✅ |
| 无法解析时明确反馈 | spec §3.6 | ✅ |

---

## 11. 模糊表述汇总

| # | 位置 | 类型 | 描述 |
|---|------|------|------|
| 1 | spec §3.1、§3.3 | 需求模糊 | 「含 metadata」的 record：原始 Story §3.1 提及「符合 run_id 约定**或含 metadata**」；spec 仅定义 run_id 与 source_path 解析，未定义 metadata 中 epic_id/story_id 的提取规则 |
| 2 | spec §3.3.2 | 术语歧义 | `epic-{N}-*/story-{N}-*` 中 {N} 可能被理解为同一变量；建议改为 `epic-{epic}-*/story-{story}-*` 明确 epic 与 story 可不同 |
| 3 | spec 全文 | 遗漏 | 原始 §7.3 要求「单元测试：筛选逻辑（run_id 解析、source_path fallback、scenario 过滤）」；spec 未列出单元测试范围，仅 §3.8 为集成验收命令 |

---

## 12. 验证方式与验证结果

| 验证项 | 验证方式 | 验证结果 |
|--------|----------|----------|
| 需求映射清单完整性 | 人工逐行对照 spec §2 与原始 §1–§6 | spec §2 映射表正确，覆盖 PRD 与 Story 要点 |
| 参数解析规格 | 对照 §3.2 与 Story §5.2、§5.3 | 格式、校验、互斥、与 run-id 关系均明确 |
| run_id 正则 | 对照 RUN_ID_CONVENTION §2.1 | 一致 |
| source_path fallback | 对照 RUN_ID_CONVENTION §3 | 模式匹配；存在术语歧义 |
| scenario 过滤 | 对照 Story §3.1、PRD REQ-UX-2.4 | 一致 |
| 无约定反馈 | 对照 Story §4 AC-3、§5.2 | 三种场景均有明确输出与退出码 |
| 验收命令可执行性 | spec §3.8 列出具体命令 | 可执行，预期明确 |
| 修改文件一览 | spec §3.9 与 Story §7.2 对照 | 一致 |

---

## 13. 结论

### 13.1 覆盖性

- **原始需求文档 §1–§6、§7.1–§7.2、§9–§10**：均已覆盖。
- **§7.3 测试要求**：spec 未明确单元测试范围，存在**遗漏**。

### 13.2 模糊表述

- **spec 存在模糊表述**，具体如下：
  1. **metadata 解析**：原始需求「符合 run_id 约定或含 metadata」中的 metadata 承载 epic_id/story_id 的解析规则未在 spec 中定义。
  2. **source_path 术语**：`epic-{N}-*/story-{N}-*` 中的 {N} 易产生歧义，建议澄清为 `epic-{epic}-*/story-{story}-*`。

### 13.3 最终结论

**未通过「完全覆盖、验证通过」**。理由：

1. **遗漏**：原始 §7.3 单元测试要求未在 spec 中体现。
2. **模糊表述**：metadata 解析规则缺失；source_path 模式存在术语歧义。

### 13.4 修改建议

| 优先级 | 建议 |
|--------|------|
| P0 | 在 spec 中补充 §3.x 或独立小节「测试要求」，明确单元测试范围：run_id 解析、source_path fallback、scenario 过滤 |
| P1 | 澄清 metadata：若本 Story 不实现 metadata 解析，在 spec §3.3 前置条件中明确「本 Story 不处理 metadata，仅支持 run_id 与 source_path」；否则补充 metadata 解析规则 |
| P2 | 将 spec §3.3.2 中 `epic-{N}-*/story-{N}-*` 改为 `epic-{epic}-*/story-{story}-*`，并注明 epic 与 story 可不同 |

---

**报告生成**：code-reviewer 子代理  
**触发 clarify 条件**：存在上述模糊表述，建议进入 clarify 流程对 metadata、source_path 术语及测试范围进行澄清。
