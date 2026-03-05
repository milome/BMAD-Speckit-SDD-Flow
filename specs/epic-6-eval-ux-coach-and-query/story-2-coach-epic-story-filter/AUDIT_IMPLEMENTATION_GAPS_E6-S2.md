# IMPLEMENTATION_GAPS-E6-S2 覆盖度审计报告

## 模型选择信息

| 项目 | 值 |
|------|-----|
| 配置来源 | .claude/agents/code-reviewer.md |
| 指定模型 | inherit（来自 frontmatter，继承主 Agent 模型） |
| 选择依据 | 子代理 YAML 中 model: inherit；可改为 fast 以节省审计成本（若环境支持） |

---

## 审计范围

| 文档 | 路径 |
|------|------|
| GAPS 文件 | `specs/epic-6/story-2-coach-epic-story-filter/IMPLEMENTATION_GAPS-E6-S2.md` |
| 原始需求 | `_bmad-output/implementation-artifacts/epic-6-eval-ux-coach-and-query/story-6-2-coach-epic-story-filter/6-2-coach-epic-story-filter.md` |
| spec | `specs/epic-6/story-2-coach-epic-story-filter/spec-E6-S2.md` |
| plan | `specs/epic-6/story-2-coach-epic-story-filter/plan-E6-S2.md` |
| 参考文档 | `scoring/docs/RUN_ID_CONVENTION.md`、`prd.eval-ux-last-mile.md` §5.1–§5.2 |

---

## 一、原始需求文档（6-2-coach-epic-story-filter.md）逐条验证

### §1 需求追溯

| 检查项 | 原始需求 | GAPS 覆盖 | 验证方式 | 结果 |
|--------|----------|-----------|----------|------|
| REQ-UX-1.5 | CLI 参数 `--epic N`，仅诊断 Epic N 相关数据 | GAP-E6-S2-1 | 对照 GAPS 表第 12 行 | ✅ |
| REQ-UX-1.6 | CLI 参数 `--story X.Y`，解析为 epicId=X, storyId=Y | GAP-E6-S2-2 | 对照 GAPS 表第 13 行 | ✅ |
| REQ-UX-2.2 | epic_id/story_id 解析规则；无约定时明确反馈 | GAP-E6-S2-3 | 对照 GAPS 表第 14 行 | ✅ |
| REQ-UX-2.4 | Epic/Story 筛选仅针对 real_dev | GAP-E6-S2-4 | 对照 GAPS 表第 15 行 | ✅ |

### §2 User Story

| 检查项 | 原始需求 | GAPS 覆盖 | 验证方式 | 结果 |
|--------|----------|-----------|----------|------|
| User Story | 运行 `/bmad-coach --epic 3` 或 `--story 3.3`，只看到指定 Epic/Story 的短板诊断 | GAP-E6-S2-1、2 | 隐含于筛选与诊断流程 | ✅ |

### §3 Scope

#### §3.1 本 Story 实现范围

| 检查项 | 原始需求 | GAPS 覆盖 | 验证方式 | 结果 |
|--------|----------|-----------|----------|------|
| §3.1-1 | `--epic N` 仅诊断 Epic N 相关数据；仅对符合 run_id 约定或含 metadata 的 record 生效 | GAP-E6-S2-1 | 对照 GAPS 表 | ✅ |
| §3.1-2 | `--story X.Y` 仅诊断 Story X.Y，解析规则 epicId=X, storyId=Y | GAP-E6-S2-2 | 对照 GAPS 表 | ✅ |
| §3.1-3 | 数据范围：仅对符合 run_id 约定或含 metadata 的 record 生效；无约定时明确反馈 | GAP-E6-S2-3、GAP-E6-S2-8 | 对照 GAPS 表 | ✅ |
| §3.1-4 | Epic/Story 筛选仅针对 scenario=real_dev（scenario !== 'eval_question'） | GAP-E6-S2-4 | 对照 GAPS 表 | ✅ |
| §3.1-5 | Story 6.3 未完成时：最小 inline 筛选（run_id 正则 + source_path 解析） | GAP-E6-S2-5、GAP-E6-S2-6 | 对照 GAPS 表 §3.3、§3.4 | ✅ |

#### §3.2 非本 Story 范围

| 检查项 | 原始需求 | GAPS 覆盖 | 验证方式 | 结果 |
|--------|----------|-----------|----------|------|
| §3.2 边界 | queryByEpic、queryByStory 为 6.3；本 Story 在 6.3 未完成时用最小 inline | GAPS §2 明确「scoring/query/ 不存在，故使用最小 inline 筛选」 | 对照 GAPS §2 当前实现快照 | ✅ |

### §4 验收标准

| 检查项 | AC | 原始需求 | GAPS 覆盖 | 验证方式 | 结果 |
|--------|-----|----------|-----------|----------|------|
| AC-1 | Epic 筛选 | 有 Epic 3 记录时 `--epic 3` → 仅诊断 Epic 3 | GAP-E6-S2-1；§4 验收命令 | 对照 GAPS §4 Gap 到任务映射 | ✅ |
| AC-2 | Story 筛选 | 有 Story 3.3 记录时 `--story 3.3` → 仅诊断 Story 3.3 | GAP-E6-S2-2；§4 验收命令 | 同上 | ✅ |
| AC-3 | 无约定数据 | 无可解析时明确反馈 | GAP-E6-S2-3、GAP-E6-S2-8 | 对照 GAPS 表 | ✅ |

### §5 实现约束与依赖

#### §5.1 现有能力（Story 6.1 产出）

| 检查项 | 原始需求 | GAPS 覆盖 | 验证方式 | 结果 |
|--------|----------|-----------|----------|------|
| §5.1 | 复用 coachDiagnose、discovery、coach-diagnose.ts；Command 文档当前未含 --epic、--story | GAPS §2 当前实现快照 与 plan Phase 依赖关系一致 | 对照 GAPS §2、§3 | ✅ |

#### §5.2 实现路径

| 检查项 | 原始需求 | GAPS 覆盖 | 验证方式 | 结果 |
|--------|----------|-----------|----------|------|
| §5.2-1 | 扩展 coach-diagnose.ts 新增 --epic、--story 解析 | GAP-E6-S2-1、2、10 | 对照 GAPS 表 | ✅ |
| §5.2-2 | 优先 query 层；否则最小 inline 筛选（run_id 正则 + source_path fallback） | GAP-E6-S2-5、6 | 对照 GAPS 表、§3 Phase 1 | ✅ |
| §5.2-3 | 无匹配时输出「无可筛选数据」或等价 | GAP-E6-S2-8 | 对照 GAPS 表 | ✅ |
| §5.2-4 | coachDiagnose 扩展 options 或封装 | GAP-E6-S2-7 | 对照 GAPS 表 | ✅ |
| §5.2-5 | Command 文档更新 | GAP-E6-S2-9 | 对照 GAPS 表 | ✅ |

#### §5.3 解析规则（RUN_ID_CONVENTION.md）

| 检查项 | 原始需求 | GAPS 覆盖 | 验证方式 | 结果 |
|--------|----------|-----------|----------|------|
| §5.3 | run_id 正则、source_path fallback、scenario 过滤 | GAP-E6-S2-3、4、5 | 对照 GAPS 表；plan §5.2 source_path 正则 | ✅ |

### §6 Tasks / Subtasks

| 检查项 | 原始需求 | GAPS 覆盖 | 验证方式 | 结果 |
|--------|----------|-----------|----------|------|
| Task 1 | 扩展 coach-diagnose.ts 支持 --epic、--story | GAP-E6-S2-1、2、10 → T3 | 对照 GAPS §4 映射 | ✅ |
| Task 1.1 | 解析并校验参数格式 | GAP-E6-S2-10 | 对照 GAPS 表 | ✅ |
| Task 1.2 | 最小 inline 筛选或复用 query | GAP-E6-S2-5、6 | 对照 GAPS 表 | ✅ |
| Task 1.3 | 无匹配时输出明确反馈 | GAP-E6-S2-8 | 对照 GAPS 表 | ✅ |
| Task 2 | 扩展 coachDiagnose 或封装 | GAP-E6-S2-7 | 对照 GAPS 表 | ✅ |
| Task 3 | 更新 commands/bmad-coach.md | GAP-E6-S2-9 | 对照 GAPS 表 | ✅ |

### §7 Dev Notes

#### §7.1 架构约束

| 检查项 | 原始需求 | GAPS 覆盖 | 验证方式 | 结果 |
|--------|----------|-----------|----------|------|
| §7.1 | 不修改 RunScoreRecord schema；epic_id/story_id 由解析得出 | GAPS 未显式写出，但 spec §4、plan 均遵循；实施顺序无 schema 变更 | 交叉对照 spec §4 | ⚠️ 建议补充：GAPS 可显式注明「架构约束：不修改 RunScoreRecord schema」 |

#### §7.2 源代码涉及

| 检查项 | 原始需求 | GAPS 覆盖 | 验证方式 | 结果 |
|--------|----------|-----------|----------|------|
| scripts/coach-diagnose.ts | 新增 --epic、--story 分支 | GAPS §2、§3 Phase 3 | 对照 | ✅ |
| scoring/coach/diagnose.ts 或新封装 | 扩展 options 或封装 | GAP-E6-S2-7、§3 Phase 2 | 对照 | ✅ |
| scoring/query/ | 6.3 已实现时复用 | GAPS §2 明确 6.3 未实现 | 对照 | ✅ |
| commands/bmad-coach.md | 参数说明 | GAP-E6-S2-9 | 对照 | ✅ |

#### §7.3 测试要求

| 检查项 | 原始需求 | GAPS 覆盖 | 验证方式 | 结果 |
|--------|----------|-----------|----------|------|
| 单元测试 | run_id 解析、source_path fallback、scenario 过滤 | GAP-E6-S2-11 | 对照 GAPS 表 | ✅ |
| 集成/端到端 | coach-diagnose.ts --epic 3、--story 3.3 有/无数据/无约定时输出符合 AC | GAPS §4 验收命令 | 对照 GAPS §4 | ✅ |

### §8 禁止词表合规声明

| 检查项 | 验证方式 | 结果 |
|--------|----------|------|
| 禁止词表 | 与 GAPS 覆盖无关，为 Story 自身合规 | N/A |

### §9 产出物清单

| 检查项 | 原始需求 | GAPS 覆盖 | 验证方式 | 结果 |
|--------|----------|-----------|----------|------|
| Command 扩展 | commands/bmad-coach.md 新增 --epic、--story | GAP-E6-S2-9 | 对照 | ✅ |
| 脚本扩展 | coach-diagnose.ts 支持 --epic、--story | GAP-E6-S2-1、2 | 对照 | ✅ |
| Coach 扩展或封装 | scoring/coach/ 内筛选或 options 扩展 | GAP-E6-S2-7、filter-epic-story.ts | 对照 | ✅ |
| 验收命令 | 可执行且输出符合 AC | GAPS §4 验收命令 | 对照 | ✅ |

### §10 References

| 检查项 | 原始需求 | GAPS 覆盖 | 验证方式 | 结果 |
|--------|----------|-----------|----------|------|
| RUN_ID_CONVENTION.md | run_id 约定、解析规则、source_path fallback | GAP-E6-S2-3、5 | 隐含于 filter-epic-story 实现 | ✅ |
| prd §5.1、5.2 | REQ-UX-1.5、1.6、2.2、2.4 | GAP-E6-S2-1~4 | 对照 | ✅ |
| story-6-1 | discovery、coachDiagnose 扩展模式 | GAPS §2、§3 Phase 依赖 | 对照 | ✅ |

---

## 二、spec-E6-S2.md 逐条验证

### §1 概述

| 检查项 | spec 内容 | GAPS 覆盖 | 验证方式 | 结果 |
|--------|-----------|-----------|----------|------|
| 输入来源 | Story 6.2、prd、RUN_ID_CONVENTION、story-6-1 | GAPS 输入声明为 spec、plan、代码基线 | 对照 GAPS 第 3–4 行 | ✅ |

### §2 需求映射清单

| 检查项 | spec 映射 | GAPS 对应 | 验证方式 | 结果 |
|--------|-----------|-----------|----------|------|
| 映射表 | spec 将 Story §1、§3、§4、§5、§7.3 映射到 spec 各节 | GAPS 表引用 Story §1、§3、§4、§7.3 | 对照 GAPS 表需求文档章节列 | ✅ |

### §3 功能规格

#### §3.1 功能目标

| 检查项 | spec 内容 | GAPS 覆盖 | 验证方式 | 结果 |
|--------|-----------|-----------|----------|------|
| 入口 | coach-diagnose.ts 扩展 --epic、--story | GAP-E6-S2-1、2 | 对照 | ✅ |
| 数据源 | getScoringDataPath() 下 *.json、scores.jsonl | GAPS §3 Phase 1 提及 loadAllRecordsForFilter | 对照 | ✅ |
| 筛选策略 | Story 6.3 未实现 → 最小 inline | GAP-E6-S2-5、6 | 对照 | ✅ |
| 输出 | Markdown/JSON；无匹配时明确反馈 | GAP-E6-S2-8 | 对照 | ✅ |

#### §3.2 参数解析

| 检查项 | spec 内容 | GAPS 覆盖 | 验证方式 | 结果 |
|--------|-----------|-----------|----------|------|
| --epic N | N 为正整数 \d+，否则报错 | GAP-E6-S2-10 | 对照 GAPS 表 | ✅ |
| --story X.Y | X.Y 为 \d+\.\d+，否则报错 | GAP-E6-S2-10 | 对照 GAPS 表 | ✅ |
| 互斥 | --epic 与 --story 不得同时传入 | GAP-E6-S2-10 | 对照 GAPS 表 | ✅ |
| 与 run-id | --epic/--story 优先于 discovery | GAPS §3 Phase 3 提及「有 --epic 或 --story 时…」 | 对照 | ✅ |

#### §3.3 最小 Inline 筛选逻辑

| 检查项 | spec 内容 | GAPS 覆盖 | 验证方式 | 结果 |
|--------|-----------|-----------|----------|------|
| §3.3.1 run_id 解析 | -e(\d+)-s(\d+)-、-e(\d+)-s(\d+)$ | GAP-E6-S2-5 | 对照 | ✅ |
| §3.3.2 source_path fallback | epic-{epic}-*/story-{story}-*、story-{epic}-{story}-* | GAP-E6-S2-5 | 对照 | ✅ |
| §3.3.3 scenario 过滤 | 排除 scenario=eval_question | GAP-E6-S2-4 | 对照 | ✅ |

#### §3.4 筛选流程

| 检查项 | spec 内容 | GAPS 覆盖 | 验证方式 | 结果 |
|--------|-----------|-----------|----------|------|
| 加载 | 加载 dataPath 下所有 RunScoreRecord | GAP-E6-S2-6 | 对照 | ✅ |
| scenario 过滤 | 排除 eval_question | GAP-E6-S2-4 | 对照 | ✅ |
| 解析 | run_id 正则 → source_path fallback | GAP-E6-S2-3、5 | 对照 | ✅ |
| 匹配 | --epic N / --story X.Y 匹配规则 | GAP-E6-S2-1、2 | 对照 | ✅ |
| 按 run_id 聚合 | 取最新 timestamp 的 run_id | plan §5.1 有详细说明；GAP-E6-S2-6 覆盖筛选流程 | 对照 plan | ✅ |
| 无匹配 | 输出明确反馈，exit 0 | GAP-E6-S2-8 | 对照 | ✅ |

#### §3.5 coachDiagnose 扩展

| 检查项 | spec 内容 | GAPS 覆盖 | 验证方式 | 结果 |
|--------|-----------|-----------|----------|------|
| 方案 A/B | options.records 或封装 | GAP-E6-S2-7 | 对照 | ✅ |
| 最终规格 | CoachDiagnoseOptions 支持 records；非空时跳过 loadRunRecords | GAP-E6-S2-7 | 对照 | ✅ |

#### §3.6 无约定数据反馈

| 检查项 | spec 内容 | GAPS 覆盖 | 验证方式 | 结果 |
|--------|-----------|-----------|----------|------|
| 无任何评分记录 | 「暂无评分数据…」 | GAP-E6-S2-8 | 对照 GAPS §4 GAP-E6-S2-8 验收 | ✅ |
| 有记录但无可解析 | 「当前评分记录无可解析 Epic/Story…」 | GAP-E6-S2-8 | 对照 | ✅ |
| 有可解析但筛选无匹配 | 「无可筛选数据」 | GAP-E6-S2-8 | 对照 | ✅ |
| 退出码 | 均为 exit 0（友好提示） | GAPS 未显式写 exit 0 | 对照 spec §3.6 | ⚠️ 建议补充：GAPS §4 或 GAP-E6-S2-8 可注明「exit 0，非错误」 |

#### §3.7 Command 文档更新

| 检查项 | spec 内容 | GAPS 覆盖 | 验证方式 | 结果 |
|--------|-----------|-----------|----------|------|
| commands/bmad-coach.md | 新增 --epic、--story 参数说明 | GAP-E6-S2-9 | 对照 | ✅ |
| .cursor/commands/bmad-coach.md | 同步（若存在） | GAPS §3 Phase 4 提及 | 对照 | ✅ |

#### §3.8 验收命令

| 检查项 | spec 内容 | GAPS 覆盖 | 验证方式 | 结果 |
|--------|-----------|-----------|----------|------|
| --epic 3 | 有 Epic 3 时仅诊断 Epic 3；无匹配时反馈 | GAPS §4 验收命令 | 对照 | ✅ |
| --story 3.3 | 有 Story 3.3 时仅诊断；无匹配时反馈 | GAPS §4 验收命令 | 对照 | ✅ |
| --epic 3 --story 3.3 | 报错互斥 | GAP-E6-S2-10、§4 | 对照 | ✅ |
| --epic abc | 报错格式无效 | GAP-E6-S2-10、§4 | 对照 | ✅ |

#### §3.9 修改文件一览

| 检查项 | spec 内容 | GAPS 覆盖 | 验证方式 | 结果 |
|--------|-----------|-----------|----------|------|
| 四类文件 | scripts、diagnose/types、coach 筛选、commands | GAPS §2、§3 Phase 1–4 | 对照 | ✅ |

### §4 数据源与 schema

| 检查项 | spec 内容 | GAPS 覆盖 | 验证方式 | 结果 |
|--------|-----------|-----------|----------|------|
| RunScoreRecord | 不修改 schema；epic_id/story_id 由解析得出 | GAPS 未显式写出 | 交叉对照 spec | ⚠️ 建议补充（见 §7.1） |

### §5 测试要求

| 检查项 | spec 内容 | GAPS 覆盖 | 验证方式 | 结果 |
|--------|-----------|-----------|----------|------|
| 单元测试 | run_id 解析、source_path fallback、scenario 过滤 | GAP-E6-S2-11 | 对照 | ✅ |
| 集成/端到端 | coach-diagnose.ts 有/无数据/无约定 | GAPS §4 | 对照 | ✅ |

### §6 依赖与约束

| 检查项 | spec 内容 | GAPS 覆盖 | 验证方式 | 结果 |
|--------|-----------|-----------|----------|------|
| Story 6.1 | 复用 discoverLatestRunId、coachDiagnose | GAPS §2、§3 | 对照 | ✅ |
| Story 6.3 | 未实现时 inline；实现后可迁移 | GAPS §2 明确 | 对照 | ✅ |
| 禁止 | 不修改 RunScoreRecord；不写入 epic_id/story_id | 未显式 | 见上文 | ⚠️ 建议补充 |

---

## 三、plan-E6-S2.md 逐条验证

### §1 需求映射清单

| 检查项 | plan 内容 | GAPS 覆盖 | 验证方式 | 结果 |
|--------|-----------|-----------|----------|------|
| 映射表 | plan 将 Story §1、§3、§4、§5、§7.3 映射到 Phase | GAPS 表需求文档章节与 plan Phase 一致 | 对照 | ✅ |

### §2 目标与约束

| 检查项 | plan 内容 | GAPS 覆盖 | 验证方式 | 结果 |
|--------|-----------|-----------|----------|------|
| 扩展 coach-diagnose.ts | --epic N、--story X.Y | GAP-E6-S2-1、2 | 对照 | ✅ |
| 最小 inline 筛选 | run_id 正则 + source_path fallback | GAP-E6-S2-5 | 对照 | ✅ |
| coachDiagnose options.records | 预筛选 records 注入 | GAP-E6-S2-7 | 对照 | ✅ |
| scenario 过滤 | scenario !== eval_question | GAP-E6-S2-4 | 对照 | ✅ |
| 无匹配反馈 | 「无可筛选数据」或等价 | GAP-E6-S2-8 | 对照 | ✅ |
| 集成/端到端测试 | 验证关键路径 | GAP-E6-S2-11、§4 | 对照 | ✅ |

### §3 实施分期

| 检查项 | plan 内容 | GAPS 覆盖 | 验证方式 | 结果 |
|--------|-----------|-----------|----------|------|
| Phase 1 | filter-epic-story.ts、loadAllRecordsForFilter、parseEpicStoryFromRecord、filterByEpicStory | GAPS §3 Phase 1 | 逐条对照 | ✅ |
| Phase 2 | CoachDiagnoseOptions.records、diagnose.ts 短路 | GAPS §3 Phase 2 | 对照 | ✅ |
| Phase 3 | coach-diagnose.ts 解析 --epic、--story | GAPS §3 Phase 3 | 对照 | ✅ |
| Phase 4 | commands 文档更新 | GAPS §3 Phase 4 | 对照 | ✅ |
| Phase 5 | filter-epic-story 单测、端到端 | GAPS §3 Phase 5 | 对照 | ✅ |

### §4 模块与文件改动设计

| 检查项 | plan 内容 | GAPS 覆盖 | 验证方式 | 结果 |
|--------|-----------|-----------|----------|------|
| §4.1 新增文件 | filter-epic-story.ts、filter-epic-story.test.ts | GAPS §3 Phase 1、5 | 对照 | ✅ |
| §4.2 修改文件 | types、diagnose、coach-diagnose、commands | GAPS §3 Phase 2–4 | 对照 | ✅ |
| §4.3 数据路径 | getScoringDataPath() | GAPS §2 提及 | 对照 | ✅ |

### §5 详细技术方案

| 检查项 | plan 内容 | GAPS 覆盖 | 验证方式 | 结果 |
|--------|-----------|-----------|----------|------|
| §5.1 filterByEpicStory 接口 | FilterEpicStoryResult / FilterEpicStoryError | GAPS §3 Phase 1 描述等价 | 对照 | ✅ |
| §5.2 source_path 解析正则 | epic-{epic}-*/story-{story}-*、story-{epic}-{story}-* | GAP-E6-S2-5 覆盖 source_path fallback | 对照 | ✅ |
| §5.3 coach-diagnose.ts 流程 | parseArgs 分支、filterByEpicStory、coachDiagnose | GAPS §3 Phase 3 | 对照 | ✅ |
| §5.4 生产代码关键路径验证 | main() 调用链 | GAPS §4 验收命令 | 对照 | ✅ |

### §6 测试计划

| 检查项 | plan 内容 | GAPS 覆盖 | 验证方式 | 结果 |
|--------|-----------|-----------|----------|------|
| §6.1 单元测试 | parseEpicStoryFromRecord、filterByEpicStory 覆盖点 | GAP-E6-S2-11 | 对照 | ✅ |
| §6.2 集成测试 | --epic 3、--story 3.3 有/无数据、互斥、格式错误 | GAPS §4 | 对照 | ✅ |
| §6.3 端到端 / CLI 验收 | AC-1、AC-2、AC-3、空目录、无参回归、参数互斥、格式错误 | GAPS §4 | 对照 | ✅ |

### §7 执行准入标准

| 检查项 | plan 内容 | GAPS 覆盖 | 验证方式 | 结果 |
|--------|-----------|-----------|----------|------|
| tasks-E6-S2.md | 任务有明确路径与验收命令 | GAPS §4 Gap 到任务映射 | 对照 | ✅ |
| filter-epic-story 单测 + CLI 验收 | 通过后才可收尾 | GAPS §3 Phase 5 | 对照 | ✅ |

---

## 四、RUN_ID_CONVENTION.md 与 prd 参考

| 检查项 | 参考文档 | GAPS 覆盖 | 验证方式 | 结果 |
|--------|----------|-----------|----------|------|
| run_id 正则 | -e(\d+)-s(\d+)-、-e(\d+)-s(\d+)$ | GAP-E6-S2-3、5 | 对照 | ✅ |
| source_path fallback | epic-{N}-*/story-{N}-*、story-{epic}-{story}-* | GAP-E6-S2-3、5 | 对照 | ✅ |
| scenario | eval_question 隔离 | GAP-E6-S2-4 | 对照 | ✅ |
| 无约定反馈 | 明确提示 | GAP-E6-S2-8 | 对照 | ✅ |

---

## 五、GAPS 内部一致性检查

| 检查项 | 验证方式 | 结果 |
|--------|----------|------|
| Gap ID 与需求文档章节对应 | 11 个 GAP 均有需求文档章节引用 | ✅ |
| 当前实现快照与 Gap 描述一致 | §2 描述的「未实现」与表中「未实现」一致 | ✅ |
| Phase 与 Gap 映射无遗漏 | §3 与 §4 中每个 Gap 均有 Phase/任务对应 | ✅ |
| 验收命令可执行 | §4 验收命令为明确 CLI 命令 | ✅ |

---

## 六、潜在遗漏与建议

### 建议补充（非强制，不影響「完全覆盖」结论）

1. **架构约束显式化**：GAPS 可增加一句「架构约束：不修改 RunScoreRecord schema；epic_id/story_id 由解析得出，不写入 record」，与 Story §7.1、spec §4 对齐。
2. **退出码约定**：GAP-E6-S2-8 或 §4 验收中可注明「无匹配/无可解析时 exit 0（友好提示，非错误）」，与 spec §3.6 一致。

### 已覆盖但未单独成 Gap 的要点

- **Story §3.1-5 依赖 6.3 处理**：GAPS §2 已明确「scoring/query/ 不存在，故使用最小 inline」，等价覆盖。
- **.cursor/commands/bmad-coach.md**：GAPS §3 Phase 4、plan §4.2 均有提及，已覆盖。

---

## 七、结论

| 维度 | 结果 |
|------|------|
| 原始需求（6-2-coach-epic-story-filter.md） | **完全覆盖**：§1–§10 所有可映射章节均对应 GAP 或 Phase |
| spec（spec-E6-S2.md） | **完全覆盖**：§1–§6 所有功能规格、参数、流程、测试均有 GAP 对应 |
| plan（plan-E6-S2.md） | **完全覆盖**：§1–§7 所有 Phase、文件改动、测试计划均有 GAP 或 §3/§4 映射 |
| 参考文档（RUN_ID_CONVENTION、prd §5.1–5.2） | **完全覆盖**：解析规则、scenario 隔离、反馈语义均已体现 |

### 最终结论

**「完全覆盖、验证通过」**

IMPLEMENTATION_GAPS-E6-S2.md 完整覆盖了原始需求 6-2-coach-epic-story-filter.md、spec-E6-S2.md、plan-E6-S2.md 的全部可实施章节与要点。11 个 GAP 与需求追溯、验收标准、实施分期、任务映射一一对应，无遗漏章节或未覆盖要点。上述两项建议为可选增强，不影響「完全覆盖」的结论。
