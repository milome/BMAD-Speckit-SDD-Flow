# plan-E6-S2 需求覆盖与测试计划审计报告

**审计时间**：2025-03-06  
**审计对象**：
- plan：`specs/epic-6/story-2-coach-epic-story-filter/plan-E6-S2.md`
- spec：`specs/epic-6/story-2-coach-epic-story-filter/spec-E6-S2.md`
- 原始需求：`_bmad-output/implementation-artifacts/epic-6-eval-ux-coach-and-query/story-6-2-coach-epic-story-filter/6-2-coach-epic-story-filter.md`

---

## 模型选择信息

| 项目 | 值 |
|------|-----|
| 配置来源 | .claude/agents/code-reviewer.md |
| 指定模型 | inherit（来自 frontmatter，继承主 Agent 模型） |
| 选择依据 | 子代理 YAML 中 model: inherit；可改为 fast 以节省审计成本（若环境支持） |

---

## 一、原始需求章节逐条覆盖检查

### 1.1 检查方法

对原始需求文档 `6-2-coach-epic-story-filter.md` 的每个有实质内容的章节，逐一对照 plan.md 与 spec.md，确认是否在 plan 中有对应实现或映射。

### 1.2 逐条验证结果

| # | 原始需求章节 | 原始需求要点 | plan 对应位置 | 验证方式 | 结果 |
|---|-------------|-------------|---------------|----------|------|
| 1 | §1 需求追溯 | REQ-UX-1.5、1.6、2.2、2.4 | plan §1 需求映射清单；Phase 1–4 | 对照 plan 第 1 节与 Phase 描述 | ✅ 覆盖 |
| 2 | §2 User Story | 运行 --epic 3 或 --story 3.3 仅看指定 Epic/Story 短板 | Phase 3 脚本扩展；§5.4 生产代码关键路径 | 功能等价性检查 | ✅ 覆盖 |
| 3 | §3.1.1 | --epic N 仅诊断 Epic N | Phase 1 filterByEpicStory；Phase 3 解析与调用 | 对照 Phase 1、3 | ✅ 覆盖 |
| 4 | §3.1.2 | --story X.Y 解析为 epicId=X, storyId=Y | Phase 3 第 1 点；§5.2 source_path 正则 | 对照 Phase 3、§5.2 | ✅ 覆盖 |
| 5 | §3.1.3 | 数据范围约束；无约定时明确反馈 | Phase 1 filterByEpicStory 返回 error；Phase 3 第 2 点 | 对照 Phase 1、3 | ✅ 覆盖 |
| 6 | §3.1.4 | Epic/Story 筛选仅针对 real_dev（scenario !== eval_question） | Phase 1「排除 scenario === 'eval_question'」 | grep plan 中 scenario | ✅ 覆盖 |
| 7 | §3.1.5 | Story 6.3 未完成时使用最小 inline 筛选 | plan §2「不依赖 scoring/query/」；Phase 1 filter-epic-story.ts | 对照 §2 与 Phase 1 | ✅ 覆盖 |
| 8 | §3.2 非本 Story 范围 | queryByEpic 等由 Story 6.3 负责 | plan 未显式声明；功能上未涉及 scoring/query | 隐含覆盖 | ✅ 可接受（非必须显式） |
| 9 | §4 AC-1 | Epic 筛选：--epic 3 → 仅诊断 Epic 3 | plan §1 映射、§6.3 验收表 AC-1 | 对照 §6.3 | ✅ 覆盖 |
| 10 | §4 AC-2 | Story 筛选：--story 3.3 → 仅诊断 Story 3.3 | plan §1 映射、§6.3 验收表 AC-2 | 对照 §6.3 | ✅ 覆盖 |
| 11 | §4 AC-3 | 无约定数据时明确反馈 | plan Phase 1 error 返回；§6.3 AC-3 | 对照 Phase 1、§6.3 | ✅ 覆盖 |
| 12 | §5.1 现有能力 | 复用 coachDiagnose、discovery、coach-diagnose | plan Phase 2 扩展 coachDiagnose；Phase 3 扩展脚本 | 对照 Phase 2、3 | ✅ 覆盖 |
| 13 | §5.2 实现路径 | 扩展 coach-diagnose；coachDiagnose 扩展；Command 更新 | Phase 2、3、4 全部分期 | 对照 Phase 2–4 | ✅ 覆盖 |
| 14 | §5.3 解析规则 | run_id 正则、source_path fallback、scenario 过滤 | plan §5.2 正则；Phase 1 scenario 排除 | 对照 §5.2、Phase 1 | ✅ 覆盖 |
| 15 | §7.1 架构约束 | 不修改 RunScoreRecord；遵循 RUN_ID_CONVENTION | plan Phase 1 未改 schema；§5.2 与 RUN_ID 一致 | 对照 Phase 1、RUN_ID_CONVENTION | ✅ 覆盖 |
| 16 | §7.2 源代码涉及 | 脚本、Coach、查询层、Command | plan §4 新增/修改文件列表 | 对照 §4.1、§4.2 | ✅ 覆盖 |
| 17 | §7.3 测试要求 | 单元 + 集成/端到端 | plan §6 测试计划 | 对照 §6 | ✅ 覆盖 |
| 18 | §9 产出物清单 | Command 扩展、脚本扩展、Coach 扩展、验收命令 | Phase 4、3、2、5 及 §6.3 | 对照 Phase 与 §6.3 | ✅ 覆盖 |

### 1.3 发现的需求映射 GAP

| GAP # | 描述 | 原始需求依据 | 建议 |
|-------|------|-------------|------|
| GAP-1 | **「无任何评分记录」时 filterByEpicStory 返回值未明确** | §3.6：无任何评分记录 → 输出「暂无评分数据，请先完成至少一轮 Dev Story」 | plan Phase 1 仅明确「无可解析」与「无匹配」两种 error。当 `loadAllRecords` 返回空数组时，filterByEpicStory 应返回 `{ error: '暂无评分数据，请先完成至少一轮 Dev Story' }`，与 discovery 行为一致。建议在 Phase 1 或 §5.1 中补充该分支。 |

---

## 二、集成测试与端到端测试计划专项审计

### 2.1 审计项与验证方式

| 审计项 | 验证方式 | 结果 |
|--------|----------|------|
| plan 是否包含集成测试计划 | 检查 plan §6.2 | ✅ 有。列明「脚本 E2E 或手动」，覆盖 --epic 3、--story 3.3 有数据/无匹配、参数互斥、格式错误。 |
| plan 是否包含端到端测试计划 | 检查 plan §6.3 | ✅ 有。端到端/CLI 验收表覆盖 AC-1、AC-2、AC-3、参数互斥、格式错误。 |
| 是否覆盖模块间协作 | 分析 plan §5.4、§6.2/6.3 验证的调用链 | ✅ 覆盖。filterByEpicStory → coachDiagnose(runId, { records }) → formatToMarkdown 为 E2E 验收目标。 |
| 是否覆盖生产代码关键路径 | 对照 coach-diagnose.ts 入口与 plan §5.4 | ✅ 覆盖。main() 在 --epic/--story 分支调用 filterByEpicStory → coachDiagnose，§6.2/6.3 以 CLI 命令验证该路径。 |
| 是否覆盖用户可见功能流程 | 对照 AC-1、AC-2、AC-3 与 plan §6.3 | ✅ 覆盖。每个 AC 均有对应验收命令与预期。 |
| 是否存在仅依赖单元测试而缺少集成/E2E 的情况 | 对照 plan §6.1、§6.2、§6.3 | ⚠️ 无此情况。plan 同时包含单元、集成、端到端。但 §6.2 写「脚本 E2E 或手动」，若仅手动执行，回归成本高。 |

### 2.2 集成/E2E 测试计划完整性评估

| 场景 | plan §6.2/6.3 是否覆盖 | 命令/验证方式 |
|------|------------------------|---------------|
| --epic 3 有数据 | ✅ | `npx ts-node scripts/coach-diagnose.ts --epic 3` |
| --story 3.3 有数据 | ✅ | `npx ts-node scripts/coach-diagnose.ts --story 3.3` |
| 无匹配（有记录但筛选后为空） | ✅ | 无约定数据时运行上述命令 |
| 无可解析（有记录但 run_id/source_path 均不匹配） | ✅ | 同上，预期输出「当前评分记录无可解析 Epic/Story...」 |
| 无任何评分记录 | ⚠️ | plan Phase 3 提「空数据」与 discovery 一致，但 §6.2/6.3 未单独列「空目录」E2E 场景 |
| 参数互斥（--epic 3 --story 3.3） | ✅ | `npx ts-node scripts/coach-diagnose.ts --epic 3 --story 3.3` |
| 格式错误（--epic abc） | ✅ | `npx ts-node scripts/coach-diagnose.ts --epic abc` |
| 无 --epic、--story 时保持现有逻辑 | ⚠️ | plan §5.3 流程图有此分支，但 §6 未明确列出「无参 discovery 路径」的回归验收 |

### 2.3 建议补充的 E2E 场景

| 场景 | 建议 |
|------|------|
| 空目录/无记录 | 在 §6.2 或 §6.3 中增加：空 dataPath 时执行 `--epic 3`，预期输出「暂无评分数据...」， exit 0。 |
| 无参 discovery 回归 | 在 §6.3 中增加：无 --epic、--story 时执行 `npx ts-node scripts/coach-diagnose.ts`，预期与 Story 6.1 行为一致（discovery → coachDiagnose）。 |
| 集成测试自动化 | 若 tasks 中采用「脚本 E2E」，建议明确是否新增 `scripts/__tests__/coach-diagnose.e2e.test.ts` 或等效自动化脚本；若仅手动，需在准入标准中说明回归方式。 |

---

## 三、生产代码关键路径与模块导入风险专项审计

### 3.1 调用链验证

| 组件 | 预期被调用位置 | plan 描述 | 实施后验证方式 |
|------|---------------|----------|----------------|
| filter-epic-story.ts | scripts/coach-diagnose.ts | Phase 3 第 2 点：调用 filterByEpicStory | 实施后 grep 确认 coach-diagnose 导入并调用 |
| filterByEpicStory | coach-diagnose.ts main() 的 --epic/--story 分支 | plan §5.4 | §6.2/6.3 CLI 验收 |
| options.records | coachDiagnose 在 options.records 非空时跳过 loadRunRecords | Phase 2 | 实施后 coach-diagnose 传入 records；diagnose.ts 有对应分支 |
| coachDiagnose(runId, { records }) | coach-diagnose.ts | Phase 3 第 2 点 | CLI 验收 |

### 3.2 模块未被导入/调用风险

| 风险 | 评估 | 依据 |
|------|------|------|
| filter-epic-story 实现完整但未被 coach-diagnose 导入 | 低 | plan Phase 3 明确写「调用 filterByEpicStory」；§5.3 流程图有该调用。实施时若漏导入，单测通过但 E2E 失败，可被发现。 |
| options.records 扩展后 diagnose 未使用 | 低 | plan Phase 2 明确修改 diagnose.ts，增加「options.records 非空时跳过 loadRunRecords」。tasks 应包含该修改。 |
| 筛选逻辑与 discovery 重复加载 | 已规避 | plan Phase 1 第 3 点在 filter-epic-story 内实现 loadAllRecordsForFilter，不修改 discovery；脚本层仅在 --epic/--story 分支调用 filterByEpicStory，无重复。 |

### 3.3 结论

plan 已明确生产代码关键路径（§5.4），且集成/E2E 计划通过 CLI 验收该路径。**不存在「模块内部实现完整但未被生产代码导入」的高风险遗漏**。实施时需在 tasks 中明确「coach-diagnose.ts 新增 import 与分支调用」。

---

## 四、spec 与 plan 一致性检查

| spec 章节 | plan 对应 | 一致性 |
|-----------|-----------|--------|
| §3.2 参数解析 | Phase 3 第 1 点、§5.3 | ✅ 一致 |
| §3.3 run_id 解析、source_path fallback | Phase 1、§5.2 | ✅ 一致 |
| §3.4 筛选流程 | Phase 1 filterByEpicStory | ✅ 一致 |
| §3.5 coachDiagnose 扩展 | Phase 2 options.records | ✅ 一致 |
| §3.6 无约定数据反馈 | Phase 1 error 返回；GAP-1 已标注 | ⚠️ 见 GAP-1 |
| §3.7 Command 文档 | Phase 4 | ✅ 一致 |
| §3.8 验收命令 | plan §6.3 | ✅ 一致 |
| §5 测试要求 | plan §6 | ✅ 一致 |

---

## 五、结论

### 5.1 覆盖性总结

- **原始需求章节**：18 个要点全部有 plan 对应，覆盖完整。
- **集成/端到端测试**：plan §6 包含集成与 E2E 计划，覆盖模块协作、关键路径、用户可见流程；非「仅依赖单元测试」。
- **生产代码关键路径**：plan 明确调用链，E2E 验收可验证；未发现「模块未导入」的高风险。

### 5.2 未通过项与遗漏

| 类型 | 编号 | 描述 |
|------|------|------|
| 需求覆盖 GAP | GAP-1 | 「无任何评分记录」时 filterByEpicStory 返回值未在 plan 中明确，需在 Phase 1 或 §5.1 补充该分支及对应 error 文案。 |
| E2E 场景补充建议 | — | 建议在 §6.2/6.3 补充：空目录验收、无参 discovery 回归验收；明确集成测试是否自动化。 |

### 5.3 最终结论

**未达到「完全覆盖、验证通过」**。

**原因**：存在 1 个需求覆盖 GAP（GAP-1：「无任何评分记录」时 filterByEpicStory  behavior 未在 plan 中显式定义）。补充 GAP-1 并采纳上述 E2E 补充建议后，可视为完全覆盖、验证通过。

### 5.4 修复建议优先级

1. **必做**：在 plan Phase 1 或 §5.1 中补充：当 `loadAllRecords`/`loadAllRecordsForFilter` 返回空数组时，`filterByEpicStory` 返回 `{ error: '暂无评分数据，请先完成至少一轮 Dev Story' }`。
2. **建议**：在 plan §6.2/6.3 中补充「空目录」与「无参 discovery 回归」的 E2E 验收场景。
3. **可选**：在 tasks-E6-S2.md 中明确集成测试为自动化脚本或手动步骤，以及回归方式。
