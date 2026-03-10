# plan-E6-S4.md 审计报告：需求覆盖与测试计划

**审计日期**：2026-03-06  
**审计对象**：`plan-E6-S4.md`  
**对照文档**：`6-4-scores-command.md`（Story 6.4）、`spec-E6-S4.md`  
**审计员**：code-reviewer 子代理

---

## 模型选择信息

| 项目 | 值 |
|------|-----|
| 配置来源 | .claude/agents/code-reviewer.md |
| 指定模型 | inherit（来自 frontmatter，继承主 Agent 模型） |
| 选择依据 | 子代理 YAML 中 model: inherit；可改为 fast 以节省审计成本（若环境支持） |

---

## 1. plan.md 与 Story 6.4 对照

### 1.1 Story §1 需求追溯

| Story 需求 | plan 覆盖位置 | 验证方式 | 结果 |
|------------|---------------|----------|------|
| REQ-UX-2.6 Command /bmad-scores | §1 需求映射、Phase 1–3、§4 | plan §1 表「Story §1 REQ-UX-2.6」✅ | ✅ 覆盖 |
| REQ-UX-2.2 epic_id/story_id 解析、无约定反馈 | Phase 2 §5.2、§5.4 | plan §5.2 无数据/无约定区分、§5.4 feedback 一致性 | ✅ 覆盖 |
| REQ-UX-2.4 Epic/Story 仅 real_dev | Phase 2 复用 query | spec §3.3 已由 query 实现，plan 复用 | ✅ 覆盖 |
| REQ-UX-2.3 同 run_id+stage 去重 | Phase 2 复用 query | spec §3.3，plan 不重复实现 | ✅ 覆盖 |
| Story 6.2 迁移 coach-diagnose | Phase 4、§5.4 | plan §3 Phase 4、§4.2、§5.4 完整描述 | ✅ 覆盖 |

### 1.2 Story §3.1 本 Story 实现范围（7 项）

| 项 | Story 描述 | plan 对应 | 验证 | 结果 |
|---|------------|-----------|------|------|
| (1) Command | 新建 commands/bmad-scores.md、/bmad-scores 触发、无参/--epic/--story | Phase 1 §4.1 | plan Phase 1.1、§4.1 表 | ✅ |
| (2) 全部摘要 | 表格、列、按 timestamp/run_id 分组 | Phase 2 formatScoresToTable mode='all'、§5.3 | plan §5.3 表 all 列 | ✅ |
| (3) Epic 汇总 | --epic N、仅 Epic N 各 Story | Phase 2 mode='epic'、Phase 1.2 queryByEpic | plan §5.3 epic 列 | ✅ |
| (4) Story 明细 | --story X.Y、各阶段、check_items 摘要 | Phase 2 mode='story'、check_items_summary | plan §5.3 story 列、§5.1 | ✅ |
| (5) 查询层复用 | queryByEpic/queryByStory/queryLatest | Phase 2.1 import、Phase 1.2 调用 | plan 明确 import 与调用 | ✅ |
| (6) 输出格式 | Markdown 表格、无数据/无约定反馈 | Phase 2、§5.2、§5.4 | plan 三种反馈文案完整 | ✅ |
| (7) coach 迁移 | filterByEpicStory → queryByEpic/queryByStory | Phase 4、§5.4 | plan 完整迁移步骤 | ✅ |

### 1.3 Story §3.2 非本 Story 范围

plan 未显式列出「非本 Story 范围」，但 plan 未涉及仪表盘、bmad-eval-analytics 自然语言、queryByFilters 等，与 Story §3.2 一致。**可接受**（非强制要求 plan 复述排除项）。

### 1.4 Story §4 验收标准 AC-1～AC-6

| AC | Story 描述 | plan 覆盖 | 验证 | 结果 |
|----|------------|-----------|------|------|
| AC-1 | 全部摘要输出表格 | Phase 5.2、§6.3 表 AC-1 | 验收命令、E2E 场景 | ✅ |
| AC-2 | Epic 汇总 Epic N 各 Story | Phase 5.2、§6.3 AC-2 | 同上 | ✅ |
| AC-3 | Story 明细 Story X.Y 各阶段 | Phase 5.2、§6.3 AC-3 | 同上 | ✅ |
| AC-4 | 无约定数据明确反馈 | §5.2、§6.3 AC-4 | 无约定场景 | ✅ |
| AC-5 | 无数据「暂无评分数据...」 | Phase 1.2、§5.2、§6.3 AC-5 | 空目录场景 | ✅ |
| AC-6 | coach 迁移后行为一致 | Phase 4、Phase 5.2、§6.3 AC-6 | coach 迁移验收 | ✅ |

### 1.5 Story §5 实现约束、§6 Tasks、§7 Dev Notes、§9 产出物

| 章节 | 对照要点 | plan 覆盖 | 结果 |
|------|----------|----------|------|
| §5.1 依赖 Story 6.3 | 6.3 已完成则复用 query | plan 假定 6.3 已完成，无 inline fallback | ✅（与 spec 一致） |
| §5.2 表格输出格式 | 三模式表头 | plan §5.3 与 spec §3.4 一致 | ✅ |
| §5.3 数据源 | getScoringDataPath、*.json、scores.jsonl | Phase 1.2 getScoringDataPath、Phase 2 通过 query 间接使用 | ✅ |
| §5.4 路径 | scores-summary.ts、bmad-scores.md | §4.1 新增文件表 | ✅ |
| §6 Tasks | 4 Task + Subtasks | plan Phase 1–5 与 Tasks 对应 | ✅ |
| §7.2 源代码涉及 | Command、脚本、coach-diagnose 修改、scoring/query 引用 | §4.1、§4.2 | ✅ |
| §9 产出物 | Command、脚本、formatScoresToTable、验收命令、迁移验证 | §4.1、§4.2、§7 | ✅ |

---

## 2. plan.md 与 spec-E6-S4.md 对照

### 2.1 spec §1 概述、§2 需求映射

plan §1 需求映射清单已与 spec §2 对齐，且 plan 输入明确引用 spec-E6-S4.md。**通过**。

### 2.2 spec §3 功能规格

| spec 章节 | 要点 | plan 覆盖 | 验证 | 结果 |
|-----------|------|-----------|------|------|
| §3.1 Command 与入口 | bmad-scores.md、scores-summary.ts、无参/--epic/--story 互斥 | Phase 1、§4.1 | 参数校验、互斥 | ✅ |
| §3.2.1 全部摘要 | queryLatest(N)、formatScoresToTable(records,'all')、列、parseEpicStoryFromRecord、分组排序 | Phase 2、§5.1、§5.3 | 简化：全表 timestamp 降序（spec 允许） | ✅ |
| §3.2.2 Epic 汇总 | queryByEpic、formatScoresToTable mode='epic'、story 格式 | Phase 2 | 列与 spec 一致 | ✅ |
| §3.2.3 Story 明细 | queryByStory、formatScoresToTable mode='story'、check_items_summary 格式 | Phase 2、§5.1 | passed/total passed、无则 '-' | ✅ |
| §3.3 查询层复用 | queryByEpic/queryByStory/queryLatest、parseEpicStoryFromRecord 来自 scoring/query | Phase 2.1 | plan 注明 parseEpicStoryFromRecord 来源 | ✅ |
| §3.4 formatScoresToTable | 参数、三 mode、表头与行映射 | §5.1、§5.3 | 接口与 spec 一致 | ✅ |
| §3.5 无数据与无约定 | 三种文案、区分逻辑（queryLatest(1)、loadAndDedupeRecords） | §5.2、§5.4 | 三种场景均有对应 | ✅ |
| §3.6 coach-diagnose 迁移 | 移除 filterByEpicStory、新增 query/loadRunRecords、--epic/--story 分支逻辑 | Phase 4、§5.4 | 步骤与 spec 逐条对应 | ✅ |
| §3.7 产出物路径 | commands、scripts、.cursor/commands、coach-diagnose 修改 | §4.1、§4.2 | 路径一致 | ✅ |
| §3.8 验收用例 | 6 场景命令与预期 | §6.3 端到端表 | 一一对应 | ✅ |

### 2.3 spec §4 非本 Story 范围

plan 未涉及 query 实现、GAP-024、仪表盘、6.5、filter-epic-story 移除。**与 spec 一致**。

### 2.4 spec §5 测试要求

| spec 要求 | plan 覆盖 | 结果 |
|-----------|-----------|------|
| 单元测试：formatScoresToTable 三种 mode、空 records | §6.1 单元测试表 | ✅ |
| 集成/端到端：scores-summary 及 --epic/--story 有数据/无数据/无约定符合 AC | §6.2、§6.3 | ✅ |
| coach 迁移回归：coach-diagnose 与迁移前一致、npm run test:scoring 全部通过 | Phase 5.2、§6.3 AC-6、§7 | ✅ |

---

## 3. 专项：集成测试与端到端测试计划

### 3.1 是否存在仅依赖单元测试而缺少集成/E2E 的情况？

**结论：否。**

plan 明确包含：

- **§6.1 单元测试**：formatScoresToTable 三种 mode、空 records、check_items_summary。
- **§6.2 集成测试**：
  - scores-summary 可执行：`npx ts-node scripts/scores-summary.ts`；
  - query 集成：scores-summary import query 并正确获取数据；
  - coach 迁移：coach-diagnose --epic/--story 使用 query 非 filterByEpicStory（grep import；行为对比）。
- **§6.3 端到端/验收**：AC-1～AC-6 六场景均有命令与预期。

plan §2 目标与约束也明确写出：「**必须包含**完整的集成测试与端到端功能测试计划：验证 scores-summary 在生产入口可执行；coach-diagnose 迁移后行为一致。」

### 3.2 模块间协作、生产代码关键路径、用户可见流程

| 验证点 | plan 覆盖 | 验证方式 |
|--------|-----------|----------|
| scores-summary 入口 → query 调用 | Phase 2.1 import、Phase 1.2 调用 | §6.2「query 集成」 |
| scores-summary 入口 → formatScoresToTable | Phase 2、Phase 3 | §6.1 单测 + §6.3 E2E |
| coach-diagnose --epic/--story → query | Phase 4、§6.2「coach 迁移」 | grep import、行为对比 |
| coach-diagnose → loadRunRecords → coachDiagnose | Phase 4.3、4.4 | 迁移流程描述 |
| 用户可见：无参/--epic/--story 输出 | §6.3 AC-1～AC-6 | 端到端验收表 |

### 3.3 模块孤岛风险（内部实现完整但未被生产路径调用）

| 模块 | 生产入口 | plan 保障 | 风险 |
|------|----------|-----------|------|
| scores-summary.ts | `npx ts-node scripts/scores-summary.ts` | §6.2、§6.3 要求可执行且输出符合 AC | **低**：验收命令即生产入口 |
| formatScoresToTable | scores-summary 调用 | Phase 2、Phase 3 明确调用 | **低** |
| queryByEpic/queryByStory/queryLatest | scores-summary、coach-diagnose（迁移后） | Phase 2.1 import、Phase 4 import | **低** |
| 迁移后 coach-diagnose | `npx ts-node scripts/coach-diagnose.ts --epic 3` | §6.2、§6.3 AC-6 行为对比 | **低** |

plan 通过「验收命令 = 生产入口」的设计，避免模块仅单测通过但未接入生产路径。

### 3.4 待补充或强化的测试计划要点

| 项目 | 现状 | 建议 |
|------|------|------|
| loadAndDedupeRecords 导出 | plan §5.2 提及从 loader 直接导入或 query index 补充导出 | 实施 tasks 时需明确：scores-summary 与 coach 迁移逻辑的「无约定/无可筛选」区分是否依赖 loadAndDedupeRecords；若依赖，需确保 loader 或 query 导出 |
| parseEpicStoryFromRecord 导出 | scoring/query/index.ts 当前**未**导出 parseEpicStoryFromRecord | plan §4.2 已注明「可选：导出 parseEpicStoryFromRecord（若未导出）」。scores-summary 可从 `scoring/query/parse-epic-story` 直接 import，或由 query index 补充导出。**非阻断** |
| fixture 数据准备 | §6.2「有 fixture 数据时运行」、§6.3 场景需有数据/无数据/无约定 | tasks 宜明确 fixture 目录或脚本，便于 CI 执行 |
| 迁移前 baseline | §6.3 AC-6「与迁移前一致」 | 需在迁移前保存 coach-diagnose --epic 3、--story 3.3 的输出作为 baseline，或通过 filter-epic-story 单测作为行为参考 |

---

## 4. 实施状态验证（代码库现状）

以下验证用于确认 plan 与当前实现的一致性，**非 plan 文档本身缺陷**：

| 检查项 | 结果 |
|--------|------|
| commands/bmad-scores.md 存在 | ❌ **不存在** |
| scripts/scores-summary.ts 存在 | ❌ **不存在** |
| formatScoresToTable 实现 | ❌ **不存在** |
| coach-diagnose.ts 使用 filterByEpicStory | ✅ 仍使用（迁移未执行） |
| scoring/query 导出 parseEpicStoryFromRecord | ❌ index.ts 未导出（可从 parse-epic-story 直接导入） |
| scoring/query loader 导出 loadAndDedupeRecords | ❌ index 未导出（可从 loader 直接 import） |

**说明**：以上为「plan 尚未进入实施或实施未完成」的表现，不视为 plan 覆盖缺陷。

---

## 5. 遗漏与未覆盖要点汇总

### 5.1 无明显遗漏

经逐条对照，plan-E6-S4.md 对 Story 6.4 与 spec-E6-S4.md 的覆盖完整，未发现遗漏章节或关键需求点。

### 5.2 可选增强（非强制）

1. **Story §5.1 6.3 未完成时的 inline fallback**：plan 与 spec 一致，假定 6.3 已完成。若需支持 6.3 未完成路径，需在 plan 或 tasks 中补充 inline 逻辑方案。
2. **spec §3.2.1(6) 分组排序**：plan 采用「全表按 timestamp 降序」的简化方案，spec 允许，无需调整。
3. **filter-epic-story.ts 移除**：spec §4 提及「迁移后若无人引用可考虑删除」，plan 未明确写出。可在 tasks 中作为可选收尾项。

---

## 6. 结论

| 审计项 | 结果 |
|--------|------|
| plan 对 Story 6.4 覆盖 | ✅ 完全覆盖 |
| plan 对 spec-E6-S4.md 覆盖 | ✅ 完全覆盖 |
| 集成测试计划 | ✅ 完整（§6.2） |
| 端到端测试计划 | ✅ 完整（§6.3，对应 AC-1～AC-6） |
| 模块孤岛风险 | ✅ 已通过验收命令与生产入口绑定规避 |
| 遗漏章节或未覆盖要点 | 无 |

---

## 最终结论

**完全覆盖、验证通过**

plan-E6-S4.md 完整覆盖了 Story 6.4（6-4-scores-command.md）与 spec-E6-S4.md 的所有章节与要点，且包含明确的单元测试、集成测试与端到端功能测试计划。集成/E2E 计划覆盖了 scores-summary 生产入口、query 集成、coach 迁移行为一致性，并通过对验收命令的依赖降低了模块未被生产路径调用的风险。

实施时建议在 tasks 中补充：loadAndDedupeRecords/parseEpicStoryFromRecord 的导入路径约定、fixture 数据准备方式、以及迁移前 baseline 的获取方式。
