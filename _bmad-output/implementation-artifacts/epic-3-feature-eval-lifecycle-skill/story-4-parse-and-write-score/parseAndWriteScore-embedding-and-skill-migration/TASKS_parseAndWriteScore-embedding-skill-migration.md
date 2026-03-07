# TASKS：parseAndWriteScore 嵌入 + bmad-code-reviewer-lifecycle 迁移与发布

**产出日期**：2026-03-05  
**来源**：50 轮 party-mode 讨论 + code-reviewer 审计迭代（批判审计员 >70%，3 轮无 gap 收敛）  
**追加任务**：T12–T14（bmad-code-reviewer-lifecycle 发布为全局 skill、迁移、引用更新）

---

## 一、parseAndWriteScore 流程嵌入（T01–T11）

### Task T01

| 字段 | 内容 |
|------|------|
| **Task ID** | T01 |
| **修改文件** | `d:/Dev/BMAD-Speckit-SDD-Flow/config/scoring-trigger-modes.yaml` |
| **精确落点** | 顶层 `version` 行之后 |
| **具体修改** | 1）`version` 从 `"1.0"` 改为 `"1.1"`；2）新增顶层键 `scoring_write_control`，固定字段：`enabled: true`、`fail_policy: non_blocking`、`scenario_source: context`、`scenario_default: real_dev`、`write_mode_lookup_order: [event.scenario, event.default]`、`require_question_version_for_eval_question: true` |
| **验收标准** | YAML 解析成功；上述 6 个字段存在且值与说明一致 |
| **风险与回退** | 旧流程读取不到新键 → 回退：恢复 `version: "1.0"` 并删除 `scoring_write_control` 整段 |

---

### Task T02

| 字段 | 内容 |
|------|------|
| **Task ID** | T02 |
| **修改文件** | `d:/Dev/BMAD-Speckit-SDD-Flow/config/scoring-trigger-modes.yaml` |
| **精确落点** | `scoring_write_control` 下新增 `call_mapping` |
| **具体修改** | 新增 `call_mapping`，固定 7 键，每键含 `event` 与 `stage`：`speckit_1_2_audit_pass` (event: stage_audit_complete, stage: speckit_1_2)、`speckit_2_2_audit_pass`、`speckit_3_2_audit_pass`、`speckit_4_2_audit_pass`、`speckit_5_2_audit_pass`、`bmad_story_stage2_audit_pass` (event: story_status_change, stage: bmad_story_stage2)、`bmad_story_stage4_audit_pass` (event: story_status_change, stage: bmad_story_stage4) |
| **验收标准** | `call_mapping` 键数量为 7；键名与 event/stage 与上表一致 |
| **风险与回退** | 键名拼写错误 → 回退：删除 `call_mapping` 整段 |

---

### Task T03

| 字段 | 内容 |
|------|------|
| **Task ID** | T03 |
| **修改文件** | 优先项目内 `d:/Dev/BMAD-Speckit-SDD-Flow/skills/speckit-workflow/SKILL.md`；若项目中不存在则修改 Cursor 全局 `%USERPROFILE%/.cursor/skills/speckit-workflow/SKILL.md` |
| **精确落点** | `### 1.2 审计闭环` 中「审计通过可结束本步骤」后、「若未通过」前 |
| **具体修改** | 新增 `#### 审计通过后评分写入触发（强制）`，写明：读 `scoring_write_control.enabled`；`branch_id=speckit_1_2_audit_pass`；scenario 取上下文，缺省取 scenario_default；writeMode 按 event_to_write_mode[event][scenario]→default；调用 `parseAndWriteScore({ reportPath, stage: "story", runId, scenario, writeMode, question_version? })`；eval_question 缺 question_version 记 SCORE_WRITE_INPUT_INVALID 且不调用；失败不阻断主流程 |
| **验收标准** | 可检索到 `speckit_1_2_audit_pass`、`parseAndWriteScore`、`reportPath`、`runId`、`question_version`、`不阻断主流程` |
| **风险与回退** | 落点错误 → 回退：删除新增子段，恢复原 1.2 描述 |

---

### Task T04–T07

同 T03 模板，落点与 branch_id 如下：

| Task | 落点 | branch_id |
|------|------|-----------|
| T04 | §2.2 审计闭环 | speckit_2_2_audit_pass |
| T05 | §3.2 审计闭环 | speckit_3_2_audit_pass |
| T06 | §4.2 审计闭环，顺序：审计通过→评分触发→analyze复核 | speckit_4_2_audit_pass |
| T07 | §5.2 审计闭环，且要求 resultCode 进审计证据 | speckit_5_2_audit_pass |

---

### Task T08

| 字段 | 内容 |
|------|------|
| **Task ID** | T08 |
| **修改文件** | 优先项目内 `d:/Dev/BMAD-Speckit-SDD-Flow/skills/bmad-story-assistant/SKILL.md`；若项目中不存在则修改 Cursor 全局 `%USERPROFILE%/.cursor/skills/bmad-story-assistant/SKILL.md` |
| **精确落点** | `## 阶段二：Story 文档审计` 下 `### 2.2 审计子任务` 段末（即「每次审计均遵循 §2.1 的优先顺序」句之后、`---` 分隔符之前） |
| **具体修改** | 新增 `#### 审计通过后评分写入触发（强制）`，branch_id=bmad_story_stage2_audit_pass；规则与 T03 同构；缺 question_version 记 SCORE_WRITE_INPUT_INVALID 且不调用；失败 non-blocking |
| **验收标准** | 可检索到 `bmad_story_stage2_audit_pass` 与完整五参数 + question_version 规则 |
| **风险与回退** | 回退：删除新增子段 |

---

### Task T09

| 字段 | 内容 |
|------|------|
| **Task ID** | T09 |
| **修改文件** | 同上 bmad-story-assistant SKILL.md |
| **精确落点** | `## 阶段四：实施后审计` 中「通过（A/B级）」分支末尾 |
| **具体修改** | 新增 `#### 审计通过后评分写入触发（强制）`，branch_id=bmad_story_stage4_audit_pass；异常记 SCORE_WRITE_CALL_EXCEPTION；主流程继续到完成选项 |
| **验收标准** | 可检索到 `bmad_story_stage4_audit_pass` 与 `SCORE_WRITE_CALL_EXCEPTION` |
| **风险与回退** | 回退：仅移除该分支新增段 |

---

### Task T10

| 字段 | 内容 |
|------|------|
| **Task ID** | T10 |
| **修改文件** | 优先项目内 `d:/Dev/BMAD-Speckit-SDD-Flow/skills/speckit-workflow/references/audit-prompts.md`；若项目中不存在则修改 Cursor 全局对应路径 |
| **精确落点** | §5 审计提示词「必须专项审查」条目末尾 |
| **具体修改** | 新增 4 条强制检查：1）branch_id 是否配置且 enabled=true；2）parseAndWriteScore 参数证据 reportPath/stage/runId/scenario/writeMode；3）scenario=eval_question 时 question_version 必填；4）失败是否 non_blocking 且记录 resultCode |
| **验收标准** | §5 含上述 4 条关键字，语气为「必须」 |
| **风险与回退** | 回退：删除新增 4 条 |

---

### Task T11

| 字段 | 内容 |
|------|------|
| **Task ID** | T11 |
| **类型** | 验证与证据采集 |
| **具体内容** | 执行锚点与映射核对（rg）；执行 parseAndWriteScore 相关测试/验收脚本（如 `npm run accept:e3-s3` 或 `npx tsx scripts/parse-and-write-score.ts`、`scoring/orchestrator/__tests__/parse-and-write.test.ts`）；输出 resultCode 证据表（覆盖成功、输入非法、调用异常、配置跳过） |
| **验收标准** | 9 个落点关键字可检索；7 个 call_mapping 键齐全；resultCode 证据表覆盖 4 类场景 |

---

## 二、bmad-code-reviewer-lifecycle 发布与迁移（T12–T14）

### Task T12：将 bmad-code-reviewer-lifecycle 发布为全局 skill

| 字段 | 内容 |
|------|------|
| **Task ID** | T12 |
| **目标** | 使 `bmad-code-reviewer-lifecycle` 作为 Cursor 全局 skill 可用 |
| **修改内容** | 1）在 Cursor 全局 skills 目录创建该 skill：Windows `%USERPROFILE%\.cursor\skills\bmad-code-reviewer-lifecycle\`，含 SKILL.md 及所需 references；2）内容来源：T13 迁移完成后，从 `D:\Dev\BMAD-Speckit-SDD-Flow\skills\bmad-code-reviewer-lifecycle\` 复制；或 T13 前可从 `_bmad\skills\bmad-code-reviewer-lifecycle\` 复制；3）验收：Cursor 设置或 skill 列表中可识别该 skill |
| **验收标准** | `%USERPROFILE%\.cursor\skills\bmad-code-reviewer-lifecycle\SKILL.md` 存在；Cursor 可加载该 skill（可通过 `@bmad-code-reviewer-lifecycle` 或等效方式引用） |
| **风险与回退** | 全局目录权限或路径错误 → 回退：删除全局目录下新增内容 |

**执行顺序**：建议在 T13 之后执行，从项目 skills 目录复制到全局。

---

### Task T13：将 bmad-code-reviewer-lifecycle 定义迁移到项目 skills 目录

| 字段 | 内容 |
|------|------|
| **Task ID** | T13 |
| **源路径** | `d:\Dev\BMAD-Speckit-SDD-Flow\_bmad\skills\bmad-code-reviewer-lifecycle\` |
| **目标路径** | `D:\Dev\BMAD-Speckit-SDD-Flow\skills\bmad-code-reviewer-lifecycle\` |
| **具体修改** | 1）创建 `skills\bmad-code-reviewer-lifecycle\` 目录（若不存在）；2）将 `_bmad\skills\bmad-code-reviewer-lifecycle\SKILL.md` 复制到 `skills\bmad-code-reviewer-lifecycle\SKILL.md`；3）若该 skill 有 references 子目录或其它文件，一并复制保持结构；4）`_bmad` 内原文件可保留作兼容（或后续由项目策略决定是否删除） |
| **验收标准** | `D:\Dev\BMAD-Speckit-SDD-Flow\skills\bmad-code-reviewer-lifecycle\SKILL.md` 存在且内容与源一致；Unix: `test -f skills/bmad-code-reviewer-lifecycle/SKILL.md`；Windows: `Test-Path skills\bmad-code-reviewer-lifecycle\SKILL.md`（PowerShell） |
| **风险与回退** | 路径或复制错误 → 回退：删除 `skills\bmad-code-reviewer-lifecycle\` 下新建内容 |

---

### Task T14：更新所有 skill 路径引用为全局 skill 路径

| 字段 | 内容 |
|------|------|
| **Task ID** | T14 |
| **目标** | 所有引用 `bmad-code-reviewer-lifecycle` 的文件均改为**全局 skill 路径**，确保该 skill 作为全局 skill 引用和激活 |
| **全局路径格式** | Windows：`%USERPROFILE%\.cursor\skills\bmad-code-reviewer-lifecycle\SKILL.md`；跨平台文档可写：`~/.cursor/skills/bmad-code-reviewer-lifecycle/SKILL.md` |
| **需修改文件清单** | 以下文件中凡出现 `_bmad/skills/bmad-code-reviewer-lifecycle` 或项目相对路径的，统一改为全局路径： |
| | **配置文件与代码**：`config/coach-trigger.yaml`、`scoring/coach/config.ts`、`scoring/coach/README.md`、`scripts/accept-e3-s1.ts` |
| | **规格与任务文档**：`scoring/docs/BMAD_INTEGRATION_POINTS.md`、`specs/epic-4/story-3-eval-scenario-bmad-integration/spec-E4-S3.md`、`specs/epic-4/story-2-eval-ai-coach/spec-E4-S2.md`、`specs/epic-4/story-2-eval-ai-coach/tasks-E4-S2.md`、`specs/epic-3/story-3-eval-skill-scoring-write/tasks-E3-S3.md`、`specs/epic-3/story-3-eval-skill-scoring-write/plan-E3-S3.md`、`specs/epic-3/story-3-eval-skill-scoring-write/IMPLEMENTATION_GAPS-E3-S3.md`、`specs/epic-3/story-1-eval-lifecycle-skill-def/tasks-E3-S1.md`、`specs/epic-3/story-1-eval-lifecycle-skill-def/plan-E3-S1.md`、`specs/epic-3/story-1-eval-lifecycle-skill-def/spec-E3-S1.md`、`specs/epic-3/story-1-eval-lifecycle-skill-def/IMPLEMENTATION_GAPS-E3-S1.md` |
| | **项目 skills 清单**：`skills/README.md` 中补充 bmad-code-reviewer-lifecycle，并标明「全局 skill（必须）」及安装路径 |
| **具体修改** | 1）`config/coach-trigger.yaml`：`required_skill_path` 改为 `"%USERPROFILE%/.cursor/skills/bmad-code-reviewer-lifecycle/SKILL.md"` 或等价；2）`scoring/coach/config.ts`：同上；3）`scoring/coach/README.md`：路径说明改为全局；4）`scripts/accept-e3-s1.ts`：检测路径改为全局路径（或支持双路径：系统检测全局优先）；5）规格/任务文档中引用路径统一改为全局路径格式；6）`skills/README.md`：在清单中增加 bmad-code-reviewer-lifecycle，安装方式为「复制至 %USERPROFILE%\.cursor\skills\ 或 Cursor 全局 skill」 |
| **验收标准** | 对 T14「需修改文件清单」内所列文件执行 `grep "_bmad/skills/bmad-code-reviewer-lifecycle"`，均不得匹配（或仅保留注释说明的历史路径）；所有配置文件与代码均使用全局路径；`skills/README.md` 含 bmad-code-reviewer-lifecycle 条目 |
| **风险与回退** | 路径格式错误导致加载失败 → 回退：恢复各文件原路径 |

**约束**：所有引用处必须明确该 skill 为**全局 skill**，激活方式为从 Cursor 全局 skills 目录加载，不得使用 `_bmad` 内路径作为主引用。

---

## 三、执行顺序建议

1. **T13**（迁移到项目 skills）→ **T12**（发布到全局）→ **T14**（更新引用）  
2. 或：**T12**（先从 _bmad 复制到全局）→ **T13**（迁移到项目 skills，保持与全局内容一致）→ **T14**（更新引用）

推荐顺序：T13 → T12 → T14，确保项目 skills 为源、全局为发布目标。

---

## 四、审计要求（本 TASKS 文档）

- **subagent_type**：code-reviewer  
- **审计提示词**：audit-prompts.md §5  
- **角色约束**：批判审计员必须出场，发言占比 >50%  
- **收敛条件**：最后 3 轮无新 gap  
- **迭代目标**：「完全覆盖、验证通过」
