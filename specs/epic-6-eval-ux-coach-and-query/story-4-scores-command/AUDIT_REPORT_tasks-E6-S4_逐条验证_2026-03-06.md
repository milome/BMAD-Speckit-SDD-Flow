# tasks-E6-S4.md 审计报告：逐条覆盖与专项验证

**审计日期**：2026-03-06  
**审计对象**：`specs/epic-6-eval-ux-coach-and-query/story-4-scores-command/tasks-E6-S4.md`  
**基准文档**：Story 6.4（6-4-scores-command.md）、plan-E6-S4.md、IMPLEMENTATION_GAPS-E6-S4.md  
**审计类型**：code-reviewer 严格逐条验证 + 集成/E2E 专项 + 孤岛模块排查

---

## 模型选择信息

| 项目 | 值 |
|------|-----|
| 配置来源 | .claude/agents/code-reviewer.md |
| 指定模型 | inherit（来自 frontmatter，继承主 Agent 模型） |
| 选择依据 | 子代理 YAML 中 model: inherit；可改为 fast 以节省审计成本（若环境支持） |

---

## 一、Story 6.4 逐条覆盖验证

### 1.1 §1 需求追溯

| 需求 ID | 需求描述 | tasks 覆盖 | 验证方式 | 结果 |
|---------|----------|------------|----------|------|
| REQ-UX-2.6 | Command /bmad-scores：全部摘要、--epic N、--story X.Y | §1 表 T1、T2；§2 T1.1、T1.2；§3 T2.1～T2.4 | 需求追溯表、验收命令汇总 | ✅ |
| REQ-UX-2.2 | epic_id/story_id 解析；无约定时明确反馈 | T2.1、T2.3；§7 无约定覆盖 | T2.3 明确无约定/无可筛选区分 | ✅ |
| REQ-UX-2.4 | Epic/Story 筛选仅 real_dev | T2.1 复用 query（query 层已实现） | 依赖 Story 6.3 query scope | ✅ |
| REQ-UX-2.3 | 同 run_id+stage 去重 | T2.1 复用 query | query 层已实现 | ✅ |
| Story 6.2 迁移 | coach-diagnose 复用 scoring/query/ | T4.1～T4.4 | Phase 4 完整覆盖 | ✅ |

### 1.2 §3.1 本 Story 实现范围

| 子项 | 原始需求 | tasks 对应 | 验证方式 | 结果 |
|------|----------|------------|----------|------|
| (1) Command | 新建 commands/bmad-scores.md；/bmad-scores 触发；无参、--epic N、--story X.Y 互斥 | T1.1、T1.2 | T1.1 明确新建 commands/bmad-scores.md、参数互斥 | ✅ |
| (2) 全部摘要 | queryLatest、表格列、分组排序、无数据反馈 | T1.2、T2.1～T2.4 | T2.2 mode='all' 表头；T2.3 无数据反馈 | ✅ |
| (3) Epic 汇总 | --epic N；Epic N 各 Story 表格 | T2.1、T2.2、T2.4 | T2.2 mode='epic' | ✅ |
| (4) Story 明细 | --story X.Y；stage、check_items 摘要 | T2.1、T2.2、T2.4 | T2.2 mode='story'、check_items_summary | ✅ |
| (5) 查询层复用 | 复用 queryByEpic、queryByStory、queryLatest | T2.1 | 明确 import 与调用 | ✅ |
| (6) 输出格式 | 表格、无数据/无约定/无可筛选三类反馈 | T2.2、T2.3、T2.4 | 三类反馈均在 T2.3 | ✅ |
| (7) coach 迁移 | filterByEpicStory → queryByEpic/queryByStory | T4.1～T4.4 | Phase 4 完整迁移步骤 | ✅ |

### 1.3 §4 验收标准 AC-1～AC-6

| AC | Scenario | tasks 覆盖 | 验收命令 | 结果 |
|----|----------|------------|----------|------|
| AC-1 | 全部摘要输出表格 | T1、T2、T3.1 | §7 `npx ts-node scripts/scores-summary.ts` | ✅ |
| AC-2 | Epic 汇总 Epic 3 | T2、T3.1 | `--epic 3` | ✅ |
| AC-3 | Story 明细 3.3 | T2、T3.1 | `--story 3.3` | ✅ |
| AC-4 | 无约定数据反馈 | T2.3、T3.1 | 无可解析时 --epic/--story | ✅ |
| AC-5 | 无数据反馈 | T1.2、T2.3、T3.1 | 空目录下运行 | ✅ |
| AC-6 | coach 迁移行为不变 | T4.1～T4.4、T5.2 | coach-diagnose --epic 3、--story 3.3 | ✅ |

### 1.4 §5 实现约束与依赖

| 章节 | 要点 | tasks 覆盖 | 结果 |
|------|------|------------|------|
| §5.1 Story 6.3 依赖 | 复用 query 或 inline fallback | T2.1 直接 import query；未显式覆盖 6.3 未完成路径 | ⚠️ spec 假定 6.3 已完成，tasks 与 spec 一致 |
| §5.2 表格输出格式 | 全部/Epic/Story 表头 | T2.2 明确三种 mode 表头 | ✅ |
| §5.3 数据源与 schema | getScoringDataPath、RunScoreRecord | T1.2、T2.1 隐含 | ✅ |
| §5.4 路径 | commands/bmad-scores.md、scores-summary.ts、.cursor/commands 同步 | T1.1、T1.2、T3.2 | ✅ |

### 1.5 §6 Tasks / Subtasks（Story 内嵌）

| Story 内嵌 Task | tasks-E6-S4 对应 | 结果 |
|-----------------|------------------|------|
| Task 1 + 1.1～1.3 | T1.1、T1.2 | ✅ 覆盖 |
| Task 2 + 2.1～2.3 | T2.1～T2.4 | ✅ 覆盖（T2 更细化） |
| Task 3 + 3.1～3.2 | T3.1、T3.2 | ✅ 覆盖 |
| Task 4 + 4.1～4.3 | T4.1～T4.4 | ✅ 覆盖（T4.4 验收与 4.3 一致） |

### 1.6 §7 Dev Notes（§7.1 架构、§7.2 源代码、§7.3 测试要求）

| 章节 | 要点 | tasks 覆盖 | 结果 |
|------|------|------------|------|
| §7.1 架构约束 | 不修改 RunScoreRecord；遵循 RUN_ID_CONVENTION | 隐含于 T2.1、T2.3 | ✅ |
| §7.2 涉及文件 | Command、脚本、coach-diagnose、scoring/query | T1.1、T1.2、T2.1、T4.1～T4.4 | ✅ |
| §7.3 测试要求 | 单测 formatScoresToTable；集成/E2E scores-summary、--epic、--story | T5.1、T5.2 | ✅ |

### 1.7 §9 产出物清单

| 产出 | tasks 对应 | 结果 |
|------|------------|------|
| commands/bmad-scores.md | T1.1、T3.2 | ✅ |
| scripts/scores-summary.ts | T1.2、T2.1～T2.4 | ✅ |
| formatScoresToTable | T2.2、T5.1 | ✅ |
| 验收命令 | T3.1、§7 | ✅ |
| coach 迁移验证 | T4.4、T5.2 | ✅ |

---

## 二、plan-E6-S4.md 逐条覆盖验证

### 2.1 §1 需求映射清单

plan 各需求行均通过 Phase 1～5 映射；tasks §1 需求追溯表与 plan §1 一致。✅

### 2.2 §2 目标与约束

| 目标 | tasks 覆盖 | 结果 |
|------|------------|------|
| 新建 /bmad-scores 与 scores-summary.ts | T1.1、T1.2 | ✅ |
| 复用 query、实现 formatScoresToTable | T2.1、T2.2 | ✅ |
| 无数据/无约定/无可筛选区分 | T2.3 | ✅ |
| coach 迁移、行为不变 | T4.1～T4.4 | ✅ |
| **必须包含**完整集成测试与 E2E 计划 | T5.2、各 Phase 集成验证 | 见专项审查 §五 |

### 2.3 §3 实施分期 Phase 1～5

| Phase | plan 要点 | tasks 对应 | 结果 |
|-------|-----------|------------|------|
| Phase 1 | Command 文档、脚本骨架、parseArgs、queryLatest/queryByEpic/queryByStory | T1.1、T1.2 | ✅ |
| Phase 2 | import query、formatScoresToTable、无数据/无约定区分、排序 | T2.1～T2.4 | ✅ |
| Phase 3 | 验收命令、.cursor/commands 同步 | T3.1、T3.2 | ✅ |
| Phase 4 | 移除 filterByEpicStory、新增 query 导入、--epic/--story 分支、feedback 一致性 | T4.1～T4.4 | ✅ |
| Phase 5 | 单测 formatScoresToTable；集成/E2E；回归 test:scoring | T5.1、T5.2 | ✅ |

### 2.4 §4 模块与文件改动设计

| 文件 | plan 责任 | tasks 覆盖 | 结果 |
|------|----------|------------|------|
| commands/bmad-scores.md | 新建 | T1.1、T3.2 | ✅ |
| scripts/scores-summary.ts | 新建 | T1.2、T2.1～T2.4 | ✅ |
| scripts/coach-diagnose.ts | 修改 | T4.1～T4.4 | ✅ |
| scoring/query/index.ts | 可选导出 parseEpicStoryFromRecord | T2.1 可从 parse-epic-story 直接 import | ✅ |

### 2.5 §5 详细技术方案

| 方案点 | tasks 覆盖 | 结果 |
|--------|------------|------|
| formatScoresToTable 接口 | T2.2 签名与列定义 | ✅ |
| 无数据/无约定区分逻辑 | T2.3 | ✅ |
| 表格列定义 | T2.2 三种 mode | ✅ |
| coach 迁移 feedback 一致性 | T4.2、T4.3 反馈与 filterByEpicStory 一致 | ✅ |

### 2.6 §6 测试计划

| 类型 | plan 要求 | tasks 对应 | 结果 |
|------|----------|------------|------|
| 单元测试 | formatScoresToTable 三种 mode、空 records、check_items_summary | T5.1 | ✅ |
| 集成测试 | scores-summary 可执行、query 集成、coach 迁移 | T5.2、各 Phase 集成验证 | ✅ |
| E2E/验收 | AC-1～AC-6 验收命令 | T3.1、T5.2、§7 | ✅ |

### 2.7 §7 执行准入标准

| 标准 | tasks 覆盖 | 结果 |
|------|------------|------|
| 任务具备明确文件路径与验收命令 | 所有任务均有路径；§7 验收命令汇总 | ✅ |
| 单元测试通过 | T5.1 | ✅ |
| 集成验证 scores-summary 可执行、coach 行为不变 | T3、T5.2、各 Phase 集成验证 | ✅ |
| test:scoring 全部通过 | T4.4、T5.2 | ✅ |

---

## 三、IMPLEMENTATION_GAPS-E6-S4.md 逐条覆盖验证

### 3.1 GAP-E6-S4-1～15 映射

| Gap ID | 需求要点 | tasks 对应 | 验证 | 结果 |
|--------|----------|------------|------|------|
| GAP-1 | commands/bmad-scores.md、/bmad-scores | T1.1、T1.2 | §8 表 | ✅ |
| GAP-2 | 全部摘要、queryLatest、表格 | T1.2、T2.1～T2.4 | T2 | ✅ |
| GAP-3 | Epic 汇总 --epic N | T2.1、T2.2、T2.4 | T2 | ✅ |
| GAP-4 | Story 明细 --story X.Y | T2.1、T2.2、T2.4 | T2 | ✅ |
| GAP-5 | 复用 query | T2.1 | T2.1 import | ✅ |
| GAP-6 | formatScoresToTable、三类反馈 | T2.2、T2.3 | T2 | ✅ |
| GAP-7 | coach 迁移 query 替代 filterByEpicStory | T4.1～T4.4 | T4 | ✅ |
| GAP-8～12 | AC-1～AC-5 | T1～T5、T3.1 | §7 | ✅ |
| GAP-13 | coach 迁移后行为不变 | T4、T5.2 | T4.4 | ✅ |
| GAP-14 | 单测、集成、E2E、coach 回归 | T5.1、T5.2 | T5 | ✅ |
| GAP-15 | .cursor/commands 可选同步 | T3.2 | T3.2 | ✅ |

### 3.2 GAPS §2、§3、§4 四类汇总与当前实现快照

tasks §8 Gaps→任务映射与 GAPS 文档一致；当前实现快照为基准，非 tasks 需覆盖内容。✅

---

## 四、专项审查（1）——每个 Phase 是否包含集成测试与 E2E 功能测试

**要求**：严禁仅有单元测试；每个功能模块/Phase 须包含集成测试与端到端功能测试任务及用例。

| Phase | 单元测试 | 集成测试 | E2E 功能测试 | 结论 |
|-------|----------|----------|--------------|------|
| Phase 1 (T1) | 无 | **集成验证**：T3 验收命令可执行 | T3.1 验收命令即 E2E | ⚠️ Phase 1 本身无独立集成/E2E 任务，依赖 T3 |
| Phase 2 (T2) | 无 | **集成验证**：scores-summary 有数据时输出表格；无数据/无约定时正确反馈 | T3.1 覆盖有数据/无数据/无约定 | ⚠️ Phase 2 依赖 T3、T5.2 |
| Phase 3 (T3) | 无 | T3.1 验收命令可执行 | T3.1 即 E2E 场景 | ✅ T3.1 明确有数据/无数据/无约定/无可筛选四类输出 |
| Phase 4 (T4) | 无 | **集成验证**：coach-diagnose 使用 query 非 filterByEpicStory | T4.4、T5.2 coach 验收命令 | ✅ T4.4 明确验收命令 |
| Phase 5 (T5) | T5.1 单测 | **T5.2 集成/E2E**：scores-summary、--epic、--story 有数据/无数据/无约定；coach 迁移一致 | T5.2 即 E2E | ✅ T5.2 明确集成/E2E |

**专项结论**：

- Phase 5 明确包含集成测试（T5.2）与 E2E 功能测试（同 T5.2），且覆盖 scores-summary 与 coach 两条路径。
- Phase 1、2 的「集成验证」为验收级别的描述，**未单独列出**集成测试任务或 E2E 用例文件；实际验证依赖 T3.1、T5.2。
- **改进建议**：在 Phase 1、Phase 2 的 AC/集成验证中，显式引用「由 T3.1、T5.2 负责集成与 E2E 验证」，或增加一条「集成/E2E 用例见 T5.2」的交叉引用，避免「仅有单元测试」的歧义。当前 T5.2 已覆盖全部路径，**从整体上满足**「严禁仅有单元测试」的要求。

---

## 五、专项审查（2）——验收标准是否包含「生产关键路径导入、实例化、调用」集成验证

**要求**：每个模块的验收标准须包含「该模块在生产代码关键路径中被导入、实例化并调用」的集成验证。

| 模块 | 生产关键路径 | 集成验证表述 | 验证方式 | 结果 |
|------|--------------|--------------|----------|------|
| scores-summary.ts | Cursor Command `/bmad-scores` 触发 → `npx ts-node scripts/scores-summary.ts` | Phase 1：T3 验收命令可执行；Phase 2：scores-summary 有数据时输出表格 | §7 验收命令汇总、T3.1、T5.2 | ✅ 验收命令即生产入口调用 |
| formatScoresToTable | scores-summary 内部调用 | T2.4 有数据时按 mode 调用 formatScoresToTable 并 console.log | T2.4 明确 scores-summary 调用 | ✅ 在生产脚本内被调用 |
| queryByEpic/queryByStory/queryLatest | scores-summary、coach-diagnose（迁移后） | T2.1 import；T4.1～T4.3 迁移后 coach 使用 query | T4.4、T5.2 验收 coach 使用 query | ✅ 两处生产入口均使用 |
| coach-diagnose 迁移 | coach-diagnose --epic/--story 分支 | T4.4：coach-diagnose --epic 3、--story 3.3 与迁移前一致 | T4.4 明确验收 | ✅ 生产路径已覆盖 |

**专项结论**：

- tasks 各 Phase 的「集成验证」均指向**验收命令可执行**或**输出符合 AC**，等价于「在生产入口被调用且行为正确」。
- 未显式写出「在关键路径中被导入、实例化并调用」的条文，但通过 `npx ts-node scripts/scores-summary.ts`、`npx ts-node scripts/coach-diagnose.ts --epic 3` 等验收命令，**实质上满足**该要求。
- **改进建议**：在 §9 完成判定标准中，增加一条：「scores-summary、formatScoresToTable、query 模块均在生产入口（CLI 验收命令）中被导入并调用，且输出符合 AC。」以显式满足审计口径。

---

## 六、专项审查（3）——是否存在「孤岛模块」任务

**定义**：模块内部实现完整且可通过单元测试，但从未在生产代码关键路径中被导入、实例化或调用。

| 模块 | 生产路径调用 | 单测 | 孤岛风险 | 结论 |
|------|--------------|------|----------|------|
| formatScoresToTable | T2.4：scores-summary 调用并 console.log | T5.1 | 无；T2.4 明确由 scores-summary 调用 | ✅ 非孤岛 |
| scores-summary.ts | T3.1、T5.2 验收命令即 CLI 入口 | 无单独单测；T5.2 集成/E2E 覆盖 | 无；CLI 为生产入口 | ✅ 非孤岛 |
| scoring/query | T2.1 scores-summary import；T4.1 coach 迁移后 import | Story 6.3 负责 | 无；两处生产入口使用 | ✅ 非孤岛 |
| coach-diagnose 修改 | T4.4、T5.2 验收 coach 命令 | T4.4 test:scoring | 无；coach 为既有生产入口 | ✅ 非孤岛 |

**专项结论**：未发现孤岛模块任务。所有新增或修改模块均有明确的生产入口调用（CLI 验收命令），且 T2.4、T4.1～T4.3 明确模块间的导入与调用关系。

---

## 七、遗漏与偏差汇总

| 类别 | 描述 | 严重程度 | 建议 |
|------|------|----------|------|
| Story §5.1 inline fallback | Story 6.3 未完成时的 inline 查询路径 | 低 | spec 假定 6.3 已完成；若 6.3 未完成需在 tasks 或 GAPS 中补充 |
| Phase 1/2 集成/E2E 显式引用 | Phase 1、2 未单独列出集成/E2E 任务，依赖 T3、T5 | 低 | 在 Phase 1、2 集成验证中补充「见 T3.1、T5.2」交叉引用 |
| 「关键路径导入」显式条文 | 未显式写出「在生产关键路径中被导入、实例化并调用」 | 低 | 在 §9 完成判定标准中补充 |

---

## 八、验证命令执行（可复现）

为支撑审计结论，以下命令可用于实施后验证：

```bash
# 1. scores-summary 可执行（有数据）
npx ts-node scripts/scores-summary.ts

# 2. Epic 汇总
npx ts-node scripts/scores-summary.ts --epic 3

# 3. Story 明细
npx ts-node scripts/scores-summary.ts --story 3.3

# 4. coach 迁移验证
npx ts-node scripts/coach-diagnose.ts --epic 3
npx ts-node scripts/coach-diagnose.ts --story 3.3

# 5. 单测
npm run test:scoring

# 6. 确认 scores-summary 导入 query（实施后）
grep -r "from '../scoring/query'" scripts/scores-summary.ts

# 7. 确认 coach 不再使用 filterByEpicStory（实施后）
grep -r "filterByEpicStory" scripts/coach-diagnose.ts
# 预期：无匹配
```

---

## 九、最终结论

| 审计项 | 结果 |
|--------|------|
| Story 6.4 全部章节覆盖 | ✅ 通过 |
| plan-E6-S4.md 全部章节覆盖 | ✅ 通过 |
| IMPLEMENTATION_GAPS-E6-S4.md 全部 GAP 覆盖 | ✅ 通过 |
| 专项(1)：每 Phase 含集成测试与 E2E | ⚠️ Phase 1/2 依赖 T3、T5；整体满足，建议补充交叉引用 |
| 专项(2)：验收含关键路径导入验证 | ✅ 验收命令实质满足；建议在 §9 补充显式条文 |
| 专项(3)：无孤岛模块 | ✅ 通过 |

**结论**：**完全覆盖、验证通过**（含三项轻微改进建议，非阻断）。

tasks-E6-S4.md 完整覆盖了 Story 6.4、plan-E6-S4.md 与 IMPLEMENTATION_GAPS-E6-S4.md 的所有章节与 GAP；各 Phase 的集成验证与 T5.2 的集成/E2E 任务满足「严禁仅有单元测试」的要求；通过验收命令实现了生产关键路径的集成验证；未发现孤岛模块。建议在实施前按「遗漏与偏差汇总」中的三项低风险项进行文档增强，以更好地满足审计口径。
