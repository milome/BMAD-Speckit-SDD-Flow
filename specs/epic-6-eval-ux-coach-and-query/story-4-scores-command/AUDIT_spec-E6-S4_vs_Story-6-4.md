# Spec E6-S4 vs Story 6.4 覆盖度审计报告

**审计日期**：2026-03-06  
**审计对象**：`spec-E6-S4.md` 对 `6-4-scores-command.md` 的覆盖情况  
**审计类型**：逐条对照、模糊表述检测

---

## 1. 模型选择信息

| 项目 | 值 |
|------|-----|
| 配置来源 | .claude/agents/code-reviewer.md |
| 指定模型 | inherit（来自 frontmatter，继承主 Agent 模型） |
| 选择依据 | 子代理 YAML 中 model: inherit；可改为 fast 以节省审计成本（若环境支持） |

---

## 2. 审计方法

- **对照维度**：Story 6.4 各章节（§1–§10）的每一需求要点
- **验证方式**：在 spec 中定位对应条款，核对表述一致性、边界条件、术语等价性
- **模糊表述**：需求描述不明确、边界未定义、术语歧义、实现路径未指定

---

## 3. 原始需求文档章节清单（Story 6.4）

| 章节 | 标题 | 要点数 |
|------|------|--------|
| §1 | 需求追溯 | REQ-UX-2.6, 2.2, 2.4, 2.3, Story 6.2 迁移 |
| §2 | User Story | 叙事性描述 |
| §3.1 | 本 Story 实现范围 | 7 条 |
| §3.2 | 非本 Story 范围 | 6 项 |
| §4 | 验收标准 | AC-1～AC-6 |
| §5.1 | 依赖 Story 6.3 的处理 | 已完成 / 未完成 两条路径 |
| §5.2 | 表格输出格式约定 | 4 条 |
| §5.3 | 数据源与 schema | 3 条 |
| §5.4 | 脚本与 Command 路径 | 3 条 |
| §6 | Tasks / Subtasks | 4 Tasks |
| §7.1 | 架构约束 | 3 条 |
| §7.2 | 源代码涉及 | 4 项 |
| §7.3 | 测试要求 | 2 条 |
| §8 | 禁止词表合规声明 | 声明性 |
| §9 | 产出物清单 | 5 项 |
| §10 | References | 4 项 |

---

## 4. 逐条验证结果

### 4.1 Story §1 需求追溯

| 原始要点 | spec 对应 | 验证结果 |
|----------|-----------|----------|
| REQ-UX-2.6：`/bmad-scores` 全部摘要、`--epic 3`、`--story 3.3` | spec §3.1, §3.2 | ✅ 覆盖 |
| REQ-UX-2.2：epic_id/story_id 解析；无约定时明确反馈 | spec §3.4, §3.5 | ✅ 覆盖 |
| REQ-UX-2.4：Epic/Story 筛选仅 real_dev | spec §3.3 | ⚠️ 见 5.1 术语差异 |
| REQ-UX-2.3：同 run_id+stage 去重 | spec §3.3 | ✅ 覆盖 |
| Story 6.2 迁移：coach-diagnose 复用 scoring/query/ | spec §3.6 | ✅ 覆盖 |

### 4.2 Story §3.1 本 Story 实现范围

| 要点 | 原始描述 | spec 对应 | 验证结果 |
|------|----------|-----------|----------|
| (1) Command | 新建 `commands/bmad-scores.md`；支持无参、`--epic N`、`--story X.Y` | spec §3.1, §3.7 | ✅ |
| (2) 全部摘要 | 表格；列 run_id、stage、phase_score、phase_weight、timestamp、epic/story；**按 timestamp 或 run_id 分组展示** | spec §3.2.1 | ⚠️ **未明确「分组」**，见 5.2 |
| (2) 数据源 | `getScoringDataPath()` 下 `*.json`、`scores.jsonl`；同 run_id+stage 仅最新 | spec §3.3（通过 query 间接） | ✅ |
| (3) Epic 汇总 | Epic N 各 Story；列 Story、stage、phase_score、phase_weight、timestamp；Epic/Story 筛选仅 `scenario !== 'eval_question'` **或未设 scenario** | spec §3.2.2, §3.3 | ⚠️ **未设 scenario 未显式约定**，见 5.1 |
| (4) Story 明细 | 解析 X.Y；列 stage、phase_score、phase_weight、check_items 摘要、timestamp | spec §3.2.3 | ✅ |
| (5) 查询层复用 | 6.3 已完成则复用 query；**6.3 未完成则 inline 逻辑** | spec §3.3 | ❌ **未覆盖 6.3 未完成路径**，见 5.3 |
| (6) 输出格式 | Markdown 表格；无数据/无约定反馈 | spec §3.4, §3.5 | ✅ |
| (7) 增强任务 | coach-diagnose 迁移 | spec §3.6 | ✅ |

### 4.3 Story §3.2 非本 Story 范围

| 原始项 | spec §4 对应 | 验证结果 |
|--------|--------------|----------|
| query 层由 Story 6.3 | ✅ | ✅ |
| 仪表盘 Story 7.1 | ✅ | ✅ |
| bmad-eval-analytics Story 6.5 | ✅ | ✅ |
| 组合 queryByFilters GAP-024 | spec 未列出 | ⚠️ 轻微遗漏（非核心） |
| coach-diagnose 底层迁移 | 本 Story 增强 | ✅ |

### 4.4 Story §4 验收标准

| AC | 原始 Given/When/Then | spec 对应 | 验证结果 |
|----|----------------------|-----------|----------|
| AC-1 | 全部摘要 → 表格 | spec §3.2.1, §3.8 | ✅ |
| AC-2 | Epic 汇总 → Epic N 各 Story | spec §3.2.2, §3.8 | ✅ |
| AC-3 | Story 明细 → Story X.Y 各阶段 | spec §3.2.3, §3.8 | ✅ |
| AC-4 | 无约定数据 → 明确反馈 | spec §3.5 | ✅ |
| AC-5 | 无数据 → 「暂无评分数据...」 | spec §3.5 | ✅ |
| AC-6 | coach 迁移后行为不变 | spec §3.6, §3.8 | ✅ |

### 4.5 Story §5 实现约束与依赖

| 要点 | 原始描述 | spec 对应 | 验证结果 |
|------|----------|-----------|----------|
| §5.1 前置 | Story 6.3 已完成则复用 | spec §3.3 | ✅ |
| §5.1 6.3 未完成 | inline 逻辑（6 步） | spec | ❌ **未覆盖**，见 5.3 |
| §5.2 表头 | 三种表头示例 | spec §3.4 | ✅ |
| §5.3 数据源 | getScoringDataPath、*.json、scores.jsonl、排除 sft-dataset | spec | ⚠️ 通过 query 间接，**未显式列出** |
| §5.4 路径 | scores-summary.ts、bmad-scores.ts、bmad-scores.md | spec §3.7 | ✅ |

### 4.6 Story §6 Tasks / Subtasks

| Task | 对应 AC | spec 覆盖 | 验证结果 |
|------|---------|-----------|----------|
| Task 1：Command 与脚本 | AC-1, AC-5 | spec §3.1, §3.7 | ✅ |
| Task 2：查询与表格 | AC-1–AC-4 | spec §3.2–§3.5 | ✅ |
| Task 3：验收与同步 | - | spec §3.8 | ✅ |
| Task 4：coach 迁移 | AC-6 | spec §3.6 | ✅ |

### 4.7 Story §7 Dev Notes

| 要点 | 原始描述 | spec 对应 | 验证结果 |
|------|----------|-----------|----------|
| §7.1 架构 | 不修改 RunScoreRecord；遵循 RUN_ID_CONVENTION | spec §3.3, §1 输入来源 | ✅ |
| §7.2 模块 | Command、脚本、coach-diagnose、scoring/query | spec §3.7 | ✅ |
| §7.3 测试 | 单元测试（表格、run_id、source_path、scenario）；集成/端到端 | spec §5 | ✅ |

### 4.8 Story §9 产出物清单

| 产出 | spec 对应 | 验证结果 |
|------|-----------|----------|
| commands/bmad-scores.md | spec §3.7 | ✅ |
| scripts/scores-summary.ts 或 bmad-scores.ts | spec §3.7 | ✅ |
| formatScoresToTable | spec §3.4 | ✅ |
| 验收命令 | spec §3.8 | ✅ |
| coach 迁移验证 | spec §3.6, §3.8 | ✅ |

### 4.9 Story §10 References

| 引用 | spec 对应 | 验证结果 |
|------|-----------|----------|
| RUN_ID_CONVENTION.md | spec §1 输入来源 | ✅ |
| prd.eval-ux-last-mile.md §5.2 | spec §1 | ✅ |
| story-6-3 | spec §3.3, §1 | ✅ |
| story-6-2 | spec §3.6, §1 | ✅ |

---

## 5. spec 模糊表述与遗漏

### 5.1 术语差异 / 边界未定义

| 位置 | 问题 | 建议 |
|------|------|------|
| spec §3.3「real_dev 隔离」 | Story 6.4 §3.1(3) 为「`scenario !== 'eval_question'` 或未设 scenario」；spec 仅写「real_dev 隔离」，未明确「未设 scenario」是否纳入 | **spec 存在模糊表述**：补充「或未设 scenario 的记录视为可参与 Epic/Story 筛选」 |
| spec §3.2.1(2) | 全部摘要「按 timestamp 或 run_id 分组」：Story 有此要求，spec 未说明分组方式（排序？多级表头？） | **spec 存在模糊表述**：明确「分组」语义（如：按 run_id 分组、组内按 timestamp 排序，或全表按 timestamp 降序） |

### 5.2 实现路径模糊

| 位置 | 问题 | 建议 |
|------|------|------|
| spec §3.5 区分逻辑 | 「可复用 scoring/query 的 loader 或增加轻量检查实现」未给出具体实现路径或 API | **spec 存在模糊表述**：指定具体 API（如 `loadAndDedupeRecords` + 解析遍历）或明确「由实现者选择，验收以三种反馈文案为准」 |
| spec §3.2.3(5) | check_items_summary「有 check_items 时展示摘要（如 "3/5 passed"）」未定义 passed 的判定规则 | **spec 存在模糊表述**：引用 RunScoreRecord 中 check_items 的 schema，或明确 passed 的计数规则 |

### 5.3 范围遗漏

| 问题 | 说明 | 建议 |
|------|------|------|
| Story 6.3 未完成路径 | Story §5.1 要求 6.3 未完成时实现 inline 逻辑（6 步）；spec 假定 6.3 已完成，未覆盖 fallback | 在 spec §1 或 §4 中明确「本 spec 假设 Story 6.3 已完成；6.3 未完成时的 fallback 不在本 spec 范围」 |
| GAP-024 组合 queryByFilters | Story §3.2 列出 GAP-024；spec §4 未提及 | 可选：在 spec §4「非本 Story 范围」中补充 |

### 5.4 parseEpicStoryFromRecord 来源

| 问题 | 说明 |
|------|------|
| spec 引用 parseEpicStoryFromRecord | 未说明从 `scoring/query/parse-epic-story` 还是 `scoring/coach/filter-epic-story` 导入。Story 6.3 已交付 query 层，应统一从 `scoring/query` 导入 | 建议在 spec §3.3 或 §3.4 中写明「parseEpicStoryFromRecord 来自 `scoring/query`（或 `scoring/query/parse-epic-story`）」 |

### 5.5 coach-diagnose 迁移细节

| 问题 | 说明 |
|------|------|
| loadRunRecords 来源 | spec §3.6 提及 `loadRunRecords(runId, dataPath)`；该函数在 `scoring/coach/loader.ts`，与 query 层不同 | 已存在，实现者可从 coach 模块引用；建议 spec 补充 import 路径 `scoring/coach` 或 `scoring/coach/loader` |

---

## 6. 验证命令执行

以下验证已通过 grep / 读文件确认，未执行运行时命令：

- `parseEpicStoryFromRecord`：存在于 `scoring/query/parse-epic-story.ts`，可被 scores 脚本复用
- `loadRunRecords`：存在于 `scoring/coach/loader.ts`
- `queryByEpic`、`queryByStory`、`queryLatest`：存在于 `scoring/query/index.ts`
- Story 6.3 已交付（见 AUDIT_§5_Story6.3 等）

---

## 7. 结论

### 覆盖度小结

| 维度 | 结果 |
|------|------|
| Story §1 需求追溯 | ✅ 5/5 覆盖（1 项术语待澄清） |
| Story §3.1 实现范围 | ⚠️ 6/7 覆盖；1 项（6.3 未完成路径）未覆盖 |
| Story §3.2 非本范围 | ✅ 5/6（GAP-024 可选补充） |
| Story §4 验收标准 | ✅ 6/6 |
| Story §5 实现约束 | ⚠️ 5.1 未完成路径未覆盖；5.3 数据源未显式列出 |
| Story §6–§10 | ✅ 覆盖 |

### spec 模糊表述汇总

1. **§3.3**：「real_dev 隔离」与「未设 scenario」的边界未明确
2. **§3.2.1**：「按 timestamp 或 run_id 分组」语义未定义
3. **§3.5**：无数据/无约定/无可筛选的区分实现路径模糊
4. **§3.2.3(5)**：check_items_summary 的 passed 判定规则未定义
5. **§3.3/§3.4**：parseEpicStoryFromRecord 导入路径未指定

### 最终结论

**未完全通过**。spec 在需求映射与 AC 覆盖上基本完整，但存在：

1. **遗漏**：Story 6.3 未完成时的 fallback 路径未覆盖（若 spec 有意排除，需显式声明）
2. **模糊表述**：共 5 处（§5.1–§5.5），需通过 clarify 澄清流程补全

**建议后续动作**：

- 触发 clarify 流程，针对上述 5 处模糊表述逐条澄清并更新 spec
- 在 spec §1 或 §4 中显式声明「本 spec 假设 Story 6.3 已完成」
- 补充 parseEpicStoryFromRecord 的 import 来源与 check_items_summary 的判定规则
