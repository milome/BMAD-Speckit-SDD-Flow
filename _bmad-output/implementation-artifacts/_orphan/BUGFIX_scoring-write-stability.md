# BUGFIX：评分写入准确性与稳定性

## §1 问题描述

Epic 12 仪表盘数据显示不完整，经排查发现三方面问题：

### 1.1 Epic 聚合视图「无完整 Story」

- **现象**：`npx ts-node scripts/dashboard-generate.ts --epic 12` 输出「Epic 12 下无完整 Story，暂无聚合数据」。
- **原因**：`getEpicAggregateRecords` 要求每个 Story 至少有 1 个「完整 run」（≥ 3 个 stage）。Epic 12 各 Story 仅有 implement（1 stage）或 tasks+implement（2 stage），无 Story 满足 MIN_STAGES_COMPLETE_RUN=3。
- **根因**：bmad-story-assistant 阶段二（Story 文档审计）审计通过后的 parse-and-write-score 未稳定执行；阶段二仅有段落描述，无显式「步骤 2.2」与完整 CLI 示例，主 Agent 易遗漏。

### 1.2 E12.S4 implement 阶段 JSON 缺少 dimension_scores

- **现象**：`scoring/data/dev-e12-s4-implement-*.json` 无 `dimension_scores` 字段，仪表盘四维雷达图显示「无数据」。
- **原因**：E12.S4 审计报告（AUDIT_Story_12-4_stage4.md）§6 可解析块输出的是 **需求完整性、可测试性、一致性、可追溯性**（tasks/prd 模式），而 implement 阶段 `parseAndWriteScore` 使用 `stageToMode('implement')` → `code` 模式，仅认 **功能性、代码质量、测试覆盖、安全性**。`parseDimensionScores` 中 `weights.get(dimension)` 对不匹配维度返回 null，全部被跳过，导致 `dimension_scores` 为空。
- **根因**：audit-prompts-critical-auditor-appendix.md §7 定义为「逐条对照格式」的通用可解析块，仅给出 tasks 维度（需求完整性、可测试性、一致性、可追溯性）；被 audit-prompts §5（implement）引用时，未区分 implement 阶段须使用 modes.code 维度。审计子代理采用逐条对照格式时默认跟随 §7，输出错误维度名。

### 1.3 阶段二评分写入缺少显式步骤

- **现象**：TASKS_评分全链路已为阶段四新增「步骤 4.2」与完整 CLI，阶段二仅有「审计通过后评分写入触发」段落，无对等的「步骤 2.2」。
- **影响**：主 Agent 在阶段二审计通过后，易因无显式 checklist 而跳过 parse-and-write-score，导致 Story 级 spec/plan/tasks 等 stage 评分缺失，Epic 聚合无法形成完整 run。

---

## §2 根因分析

### 2.1 流程与配置层面

| 层级 | 现状 | 缺口 |
|------|------|------|
| bmad-story-assistant 阶段二 | 有触发段落，stage=story，triggerStage=bmad_story_stage2 | 无显式步骤 2.2、无完整 CLI 示例，易被忽略 |
| bmad-story-assistant 阶段四 | 有步骤 4.2 与 CLI，stage=implement | 审计 prompt 中可解析块维度要求被 critical-auditor-appendix §7 覆盖，未强制 code 维度 |
| audit-prompts-critical-auditor-appendix §7 | 定义逐条对照格式可解析块，维度为 tasks 四维 | 未按 stage 区分：implement 需 code 四维，与 §7 冲突 |
| audit-prompts §5 / audit-prompts-code.md | 明确 §5.1 为 功能性、代码质量、测试覆盖、安全性 | 子代理若引用 appendix §7 作为输出模板，会输出错误维度 |

### 2.2 解析器行为

- `parseDimensionScores(content, stageToMode(stage))` 仅接受 config 中该 mode 已配置的维度名。
- 维度名不匹配时 `weights.get(dimension)` 为 null，该行被 `continue` 跳过。
- 无降级或映射逻辑，导致 dimension_scores 为空时直接不写入。

### 2.3 数据流断裂点

```
阶段二审计通过 → 无步骤 2.2 → 主 Agent 可能跳过 → 无 stage=story 写入
阶段四审计通过 → 步骤 4.2 存在 → 主 Agent 执行 parse-and-write-score
                → 报告用 tasks 维度 → parseDimensionScores 返回 [] → 无 dimension_scores
```

---

## §3 影响范围

- **仪表盘**：Epic 12（及类似 Epic）聚合视图不可用；E12.S4 等 Story 四维雷达图为「无数据」。
- **评分追溯**：dimension_scores 缺失影响历史分析与短板诊断。
- **全链路一致性**：stage 2 写入不稳定，导致 MIN_STAGES_COMPLETE_RUN 难以满足，Epic 级健康度无法计算。

---

## §4 修复方案

### 4.1 阶段二增加显式步骤 2.2（与阶段四对称）

**修改路径**：`skills/bmad-story-assistant/SKILL.md`（项目内优先，否则全局 `~/.cursor/skills/bmad-story-assistant/SKILL.md`）

**修改位置**：阶段二 §2.2「审计子任务」之后、「若审计未通过」之前，在「审计通过后评分写入触发（强制）」**之前**插入显式步骤 2.2。

**插入内容**：

```markdown
#### 步骤 2.2：运行 parse-and-write-score（强制）

主 Agent 在收到阶段二 Story 文档审计通过结论后，**必须**执行以下操作：

1. 确定报告路径：`{project-root}/_bmad-output/implementation-artifacts/epic-{epic}-*/story-{epic}-{story}-*/AUDIT_Story_{epic}-{story}_stage2.md`
2. 若报告文件存在，执行：
   ```bash
   npx ts-node scripts/parse-and-write-score.ts --reportPath <上述路径> --stage story --event story_status_change --triggerStage bmad_story_stage2 --epic {epic} --story {story} --iteration-count {本 stage 累计 fail 轮数，一次通过传 0}
   ```
3. 若调用失败，记录 resultCode 到审计证据，不阻断流程（non_blocking）。
```

### 4.2 阶段四审计 prompt 强制 code 维度可解析块

**修改路径**：`skills/bmad-story-assistant/SKILL.md`

**修改位置**：阶段四「综合审计」段落中，在「报告可解析块须符合 §5.1」之后，**显式追加**以下锚点句，确保传入审计子任务的 prompt 中明确写出：

> **【§5 可解析块要求（implement 专用）】** 报告结尾的可解析评分块**必须**使用 modes.code 四维：`- 功能性: XX/100`、`- 代码质量: XX/100`、`- 测试覆盖: XX/100`、`- 安全性: XX/100`。**禁止**使用 需求完整性、可测试性、一致性、可追溯性（该四维仅适用于 tasks/story 阶段）。否则 parseAndWriteScore(mode=code) 无法解析，仪表盘四维显示「无数据」。

**同时**：在 STORY-A4-POSTAUDIT 模板（或阶段四传入 code-reviewer / generalPurpose 的完整 prompt）中，**必须**包含上述【§5 可解析块要求（implement 专用）】的完整表述，并附上 audit-prompts §5.1 或 audit-prompts-code.md 中的可解析块示例（功能性、代码质量、测试覆盖、安全性）。

### 4.3 audit-prompts-critical-auditor-appendix 按 stage 区分可解析块

**修改路径**：`skills/speckit-workflow/references/audit-prompts-critical-auditor-appendix.md`

**修改内容**：将 §7 拆分为：
- **§7**：tasks/story/spec/plan/gaps 阶段的逐条对照可解析块（保持 需求完整性、可测试性、一致性、可追溯性）。
- **§7.1**：implement 阶段（code 模式）逐条对照可解析块，维度为 **功能性、代码质量、测试覆盖、安全性**，与 config/code-reviewer-config.yaml modes.code.dimensions 一致。

**§7.1 新增内容**：

```markdown
## 7.1 Implement 阶段逐条对照可解析块（code 模式）

当审计报告为 implement 阶段（执行 tasks 后审计、实施后审计）且采用逐条对照格式时，必须在结论后追加以下可解析块，**维度名须与 modes.code.dimensions 完全一致**：

- 功能性: XX/100
- 代码质量: XX/100
- 测试覆盖: XX/100
- 安全性: XX/100

**禁止**在 implement 阶段使用 §7 的 tasks 维度（需求完整性、可测试性、一致性、可追溯性）。
```

### 4.4 parseAndWriteScore 写入前校验与告警

**修改路径**：`scoring/orchestrator/parse-and-write.ts`

**修改逻辑**：当 `stage === 'implement'` 且 `dimensionScores.length === 0` 时，在写入前输出告警到 stderr 或日志：

```
WARN: implement stage report has no parseable dimension_scores. Expected dimensions: 功能性, 代码质量, 测试覆盖, 安全性. Check report parseable block matches modes.code.dimensions.
```

不阻断写入，仅便于排查。

---

## §5 验收标准

| # | 验收项 | 验收方式 |
|---|--------|----------|
| 1 | 阶段二有 步骤 2.3（先 check）与 步骤 2.2（补跑） | grep `步骤 2.3`、`步骤 2.2`、`check-story-score-written`、`parse-and-write-score` skills/bmad-story-assistant/SKILL.md |
| 2 | 阶段四 prompt 强制 code 四维 | grep `功能性`、`代码质量`、`测试覆盖`、`安全性`、`【§5 可解析块要求（implement 专用）】` |
| 3 | appendix 有 §7.1 implement 专用块 | grep `§7.1`、`implement`、`功能性` audit-prompts-critical-auditor-appendix.md |
| 4 | 新 Story 阶段四审计产出含 code 四维 | 执行一次 Dev Story 阶段四审计，检查报告可解析块；运行 parse-and-write-score，验证 JSON 含 dimension_scores |
| 5 | 新 Story 阶段二审计后评分写入 | 执行一次 Create Story 阶段二审计，检查 步骤 2.3 check 先执行、若 no 则 步骤 2.2 补跑；scoring/data 有 stage=story 记录 |

---

## §6 流程建议

1. **主 Agent 发起阶段二/四审计时**：将可解析块维度要求**整段**复制进审计 prompt，不依赖子代理自行推断。
2. **审计子代理输出前自检**：若 stage=implement，可解析块须含 功能性、代码质量、测试覆盖、安全性；若为 tasks/story，则用 需求完整性、可测试性、一致性、可追溯性。
3. **parse-and-write-score 调用后**：阶段四执行 步骤 4.3 check-story-score-written；若为 `STORY_SCORE_WRITTEN:no` 且 reportPath 存在，按步骤 4.2 补跑；补跑后再次 check，确认 dimension_scores 已写入；check 脚本须校验 dimension_scores 非空（见 T5）。

---

## §7 最终任务列表

| ID | 修改路径 | 修改内容 | 验收标准 |
|----|----------|----------|----------|
| T1 | skills/bmad-story-assistant/SKILL.md | 阶段二增加 **步骤 2.2：补跑 parse-and-write-score**（步骤 2.3 得 no 时执行）及完整 CLI。双保险下主 Agent 先执行 步骤 2.3 check，若 no 则执行本步骤补跑；见 §8 衔接说明 | grep 步骤 2.2、parse-and-write-score、stage story、bmad_story_stage2、--iteration-count 有匹配 |
| T2 | skills/bmad-story-assistant/SKILL.md | 阶段四「综合审计」增加【§5 可解析块要求（implement 专用）】锚点，明确禁止使用 tasks 四维、必须使用 code 四维 | grep 功能性、代码质量、测试覆盖、安全性、【§5 可解析块要求（implement 专用）】有匹配 |
| T3 | skills/speckit-workflow/references/audit-prompts-critical-auditor-appendix.md | 新增 §7.1 Implement 阶段逐条对照可解析块，维度为 功能性、代码质量、测试覆盖、安全性 | grep §7.1、implement、功能性 有匹配；§7 保持 tasks 维度 |
| T4 | scoring/orchestrator/parse-and-write.ts | 当 stage=implement 且 dimensionScores.length===0 时输出 WARN 日志 | 使用**故意不含 code 四维的 implement 报告**（如仅含 tasks 四维的 mock）执行 parse-and-write-score，验证 stderr 含 WARN 及 Expected dimensions |
| T5 | scripts/check-story-score-written.ts | 扩展校验：当 record 存在但 dimension_scores 为空或缺失时，输出 DIMENSION_SCORES_MISSING:yes 或等效可解析提示 | 对已知 dimension_scores 为空的 record 执行 check，验证输出含 DIMENSION_SCORES_MISSING 相关提示 |

---

## §7 最终任务列表（Party-Mode 补充版）

经至少 100 轮多角色讨论（批判审计员占比 >70%，最后 3 轮无新 gap），产出如下补充完善版。讨论记录见 `PARTY_MODE_§7_BUGFIX_scoring-write-stability_100r.md`。

| ID | 修改路径 | 修改内容 | 验收标准 |
|----|----------|----------|----------|
| T1 | `{project-root}/skills/bmad-story-assistant/SKILL.md`，若不存在则 `~/.cursor/skills/bmad-story-assistant/SKILL.md` | 阶段二增加 **步骤 2.2：补跑 parse-and-write-score**（步骤 2.3 得 no 时执行）。双保险下主 Agent 先 步骤 2.3 check，若 no 则执行本步骤补跑。内容含：① 确定报告路径；② 完整 CLI：`npx ts-node scripts/parse-and-write-score.ts --reportPath <路径> --stage story --event story_status_change --triggerStage bmad_story_stage2 --epic {epic} --story {story} --iteration-count 0`；③ 失败 non_blocking；见 §8 衔接说明 | grep `步骤 2.2`、`parse-and-write-score`、`stage story`、`bmad_story_stage2`、`--iteration-count` 均有匹配 |
| T2 | `{project-root}/skills/bmad-story-assistant/SKILL.md`，若不存在则 `~/.cursor/skills/bmad-story-assistant/SKILL.md` | ① 阶段四「综合审计」段落中，在「报告可解析块须符合 §5.1」**之后**显式追加【§5 可解析块要求（implement 专用）】锚点全文，明确禁止 tasks 四维、必须使用 code 四维（功能性、代码质量、测试覆盖、安全性）；② **同时**在 STORY-A4-POSTAUDIT 模板或阶段四传入 code-reviewer/generalPurpose 的完整 prompt 描述中，**必须**包含上述【§5 可解析块要求（implement 专用）】完整表述，并附 audit-prompts §5.1 或 audit-prompts-code.md 可解析块示例；③ 若阶段四审计 prompt 引用自 speckit-workflow，则 `skills/speckit-workflow` 的 implement 审计段落也须含该要求 | grep `功能性`、`代码质量`、`测试覆盖`、`安全性`、`【§5 可解析块要求（implement 专用）】` 均有匹配；stage4 段落及 STORY-A4-POSTAUDIT 相关描述均含可解析块要求 |
| T3 | `{project-root}/skills/speckit-workflow/references/audit-prompts-critical-auditor-appendix.md`，否则 `{SKILLS_ROOT}/speckit-workflow/references/audit-prompts-critical-auditor-appendix.md` | 新增 **§7.1 Implement 阶段逐条对照可解析块（code 模式）**。维度为 功能性、代码质量、测试覆盖、安全性，与 config/code-reviewer-config.yaml modes.code.dimensions 一致。明确禁止 implement 阶段使用 §7 的 tasks 维度。§7 保持 tasks 四维（需求完整性、可测试性、一致性、可追溯性） | grep `§7.1`、`implement`、`功能性`、`代码质量`、`测试覆盖`、`安全性` 有匹配；§7 仍含 tasks 四维 |
| T4 | `{project-root}/scoring/orchestrator/parse-and-write.ts` | 在 `parseAndWriteScore` 中，当 `stage === 'implement'` 且 `dimensionScores.length === 0` 时，在调用 `writeScoreRecordSync` 之前输出 WARN 到 stderr：`WARN: implement stage report has no parseable dimension_scores. Expected dimensions: 功能性, 代码质量, 测试覆盖, 安全性. Check report parseable block matches modes.code.dimensions.` 不阻断写入 | 使用**故意不含 code 四维的 implement 报告**（如仅含 tasks 四维的 mock）执行 `npx ts-node scripts/parse-and-write-score.ts --reportPath <mock报告> --stage implement`，验证 stderr 含 `WARN` 及 `Expected dimensions` |
| T5 | `{project-root}/scripts/check-story-score-written.ts` | 扩展校验：当 record 存在但 `dimension_scores` 为空或缺失时，输出 `DIMENSION_SCORES_MISSING:yes` 或等效可解析提示。用于步骤 4.3 闭环：补跑后再次 check 可确认 dimension_scores 已写入 | 对**已知 dimension_scores 为空的 record**（如对错误维度的 implement 报告执行 parse-and-write 后的 record）执行 check，验证输出含 dimension_scores 相关提示 |

---

## §7 补充任务列表（Party-Mode MIN_STAGES 冲突结论）

经至少 100 轮多角色讨论（批判审计员占比 >73%，最后 3 轮无新 gap），针对 **MIN_STAGES_COMPLETE_RUN 与 2-stage 设计结构性冲突**，产出最优方案 **A：将 MIN_STAGES_COMPLETE_RUN 从 3 降为 2**。讨论记录见 `PARTY_MODE_MIN_STAGES_vs_2stage_100r.md`。

| ID | 修改路径 | 修改内容 | 验收标准 |
|----|----------|----------|----------|
| T6 | `{project-root}/scoring/dashboard/compute.ts` | 将 `MIN_STAGES_COMPLETE_RUN` 从 3 改为 2；同步更新第 168 行注释「完整 run 定义：至少 2 个 stage（story+implement 为 2-stage 设计）」 | grep `MIN_STAGES_COMPLETE_RUN` 得 2；单测通过 |
| T7 | `{project-root}/scripts/dashboard-generate.ts` | 将 `INSUFFICIENT_RUN_MESSAGE` 从「数据不足，暂无完整 run（至少 3 stage）」改为「数据不足，暂无完整 run（至少 2 stage）」 | grep `至少 2 stage` 有匹配 |
| T8 | `{project-root}/scoring/dashboard/__tests__/compute.test.ts` | ① 将用例「strategy epic_story_window returns complete run with >=3 stages」改为「>=2 stages」，并用 2 条 record（story+implement）验证；② 现有 3-stage 用例保留（3>=2 仍通过） | 单测全部通过；2-stage 完整 run 用例存在 |
| T9 | `{project-root}/scoring/docs/RUN_ID_CONVENTION.md` | 在 §4.2 或适当地点增加：「当前完整 run 门槛为 MIN_STAGES_COMPLETE_RUN（见 scoring/dashboard/compute.ts）；2-stage 设计（story+implement）下为 2」 | grep `MIN_STAGES` 或 `2-stage` 有匹配 |
| T10 | `{project-root}/_bmad-output/implementation-artifacts/_orphan/TASKS_Epic级仪表盘聚合.md` | 将 US-1.2 描述中「最新完整 run（≥3 stage）」改为「最新完整 run（≥2 stage，2-stage 设计下 story+implement）」 | grep `≥2 stage` 或等价表述有匹配 |

### 补充说明（MIN_STAGES 方案 A）
1. **生效条件**：T6～T10 与 T1（阶段二步骤 2.2）共同生效。T1 保证新 Story 稳定写入 story+implement；MIN=2 使 2-stage 数据可纳入 Epic 聚合。既有 Epic 12 implement-only 数据仍不满足，聚合不可用，需新流程下完成 Create Story+Dev Story 后才有聚合数据。
2. **方案淘汰**：B（增加 stage）违背用户「避免碎片化」；C（mode 区分）过度工程；D（有则显示）改变聚合语义；E（保持 MIN=3）无效。
3. **Deferred Gap DG-1**：若未来用户启用 speckit 全链路且要求「5 stage 才算完整」，再引入 `min_stages_by_mode` 配置。

---

### 补充说明

1. **T5 由可选改为必做**：经 Party-Mode 讨论，步骤 4.3 的补跑闭环依赖 check 能识别 dimension_scores 为空，否则无法触发「报告维度错误需修正」的反馈；T5 纳入必做，已移除「可选」标注。

2. **路径解析规则**：T1、T2 的 bmad-story-assistant 路径：项目内 `{project-root}/skills/bmad-story-assistant/SKILL.md` 优先；若不存在则用全局 `~/.cursor/skills/bmad-story-assistant/SKILL.md`。T3 的 appendix 路径同理。

3. **T2 与 speckit-workflow 联动**：若阶段四审计 prompt 实际引用自 speckit-workflow，T2 实施时须同步修改 speckit-workflow 的 implement 审计段落，确保【§5 可解析块要求（implement 专用）】在两处均存在。

4. **Deferred Gap（GAP-D1）**：阶段二 stage=story 报告若使用 tasks 四维，而 `stageToMode('story')` 返回 `code`，则 `parseDimensionScores` 会因维度不匹配返回空。本 BUGFIX 聚焦 implement 与阶段二步骤 2.2 缺失；该维度一致性问题建议作为独立 BUGFIX 另行处理。

---

## §8 双保险方案（子代理写 + 主 Agent check 准入）

经讨论确定：**全在子代理写**（审计通过后、返回前由子代理执行 parse-and-write-score）减少流程交接遗漏；**主 Agent 在关键节点执行 check 脚本**做准入检查（若 STORY_SCORE_WRITTEN:no 且 reportPath 存在则补跑），形成双保险。

| 层级 | 职责 | 覆盖阶段 |
|------|------|----------|
| **主保险** | 审计子代理在结论为「通过」时，**在返回主 Agent 前**执行 parse-and-write-score | story、spec、plan、GAPS、tasks、implement（共 6 个 stage） |
| **次保险** | 主 Agent 在阶段二完成后、阶段四完成后执行 check-story-score-written；若 no 且 reportPath 存在则补跑 | 阶段二→三、阶段四→完成选项 |

**T1 步骤 2.2 与 T11 衔接**：采用双保险后，主 Agent **应先执行** 步骤 2.3 check（T12），若 `STORY_SCORE_WRITTEN:yes` 则**无需**再执行 步骤 2.2 parse-and-write；若 no 且报告存在则执行 步骤 2.2 的 parse-and-write（补跑），避免与 T11 子代理写双写。

---

## §9 最终任务列表（双保险方案，含 T1～T10 及 T11～T20）

### T1～T10（沿用既有，见 §7 及 Party-Mode 补充版、MIN_STAGES 补充）

（保持 T1～T10 不变，作为 implement 维度、MIN_STAGES、check dimension_scores 等修正）

### T11～T20（双保险：子代理写 + 主 Agent check）

| ID | 修改路径 | 修改内容 | 验收标准 |
|----|----------|----------|----------|
| **T11** | `{project-root}/skills/bmad-story-assistant/SKILL.md` | 在 **STORY-A2-AUDIT 模板**（阶段二 §2.2）的【§Story 可解析块要求】**之后**、`prompt: \|` 代码块**结束前**，新增【审计通过后必做】块：当结论为「通过」时，你（审计子代理）**在返回主 Agent 前必须**执行 `npx ts-node scripts/parse-and-write-score.ts --reportPath <保存的报告路径> --stage story --event story_status_change --triggerStage bmad_story_stage2 --epic {epic_num} --story {story_num} --iteration-count {本 stage 累计 fail 轮数，0 表示一次通过}`；报告路径为 `_bmad-output/implementation-artifacts/epic-{epic_num}-*/story-{epic_num}-{story_num}-*/AUDIT_Story_{epic_num}-{story_num}_stage2.md`；若执行失败，在结论中注明 resultCode，不阻断返回。**禁止**在未执行上述命令前返回通过结论 | grep `审计通过后必做`、`parse-and-write-score`、`stage story`、`bmad_story_stage2` 在 STORY-A2-AUDIT 模板内有匹配 |
| **T12** | `{project-root}/skills/bmad-story-assistant/SKILL.md` | 在阶段二「若审计未通过」段落**之后**、**步骤 2.2 补跑**之前，新增 **步骤 2.3：阶段二准入检查（强制，先执行）**：主 Agent 在收到阶段二通过结论后、进入阶段三之前，**必须先**执行 `npx ts-node scripts/check-story-score-written.ts --epic {epic} --story {story}`；若输出为 `STORY_SCORE_WRITTEN:no` 且报告文件存在，则主 Agent 执行 步骤 2.2 补跑；补跑后再次 check，直至 yes 或报告不存在；失败 non_blocking | grep `步骤 2.3`、`check-story-score-written`、`STORY_SCORE_WRITTEN:no` 有匹配 |
| **T13** | `{project-root}/skills/speckit-workflow/references/audit-prompts.md` | 在 **§1 spec 审计**的【审计后动作】段落中，将「以便主 Agent 调用 parse-and-write-score」改为：**你（审计子代理）在返回主 Agent 前必须执行 parse-and-write-score**。在【审计后动作】段落后**新增**完整 CLI 块：「审计通过时，在返回前必须执行：`npx ts-node scripts/parse-and-write-score.ts --reportPath <reportPath> --stage spec --event stage_audit_complete --triggerStage speckit_1_2 --epic {epic} --story {story} --artifactDocPath specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/spec-E{epic}-S{story}.md --iteration-count {累计值}`；reportPath、epic、story、epic-slug、slug、累计值由本 prompt 或调用方提供；失败在结论中注明 resultCode」 | grep `审计子代理`、`parse-and-write-score`、`stage spec`、`speckit_1_2` 在 §1 段落有匹配 |
| **T14** | `{project-root}/skills/speckit-workflow/references/audit-prompts.md` | 在 **§2 plan 审计**的【审计后动作】中，同 T13 方式修改；CLI **须含** `--event stage_audit_complete`、`--stage plan`、`--triggerStage speckit_2_2`、`--artifactDocPath specs/.../plan-E{epic}-S{story}.md`，以及 reportPath、epic、story、iteration-count（同 T13） | grep `parse-and-write-score`、`stage plan`、`speckit_2_2`、`stage_audit_complete` 在 §2 段落有匹配 |
| **T15** | `{project-root}/skills/speckit-workflow/references/audit-prompts.md` | 在 **§3 GAPS 审计**的【审计后动作】中，同 T13 方式修改；CLI **须含** `--event stage_audit_complete`、`--stage plan`、`--triggerStage speckit_3_2`、`--artifactDocPath specs/.../IMPLEMENTATION_GAPS-E{epic}-S{story}.md`（GAPS 使用 stage=plan） | grep `parse-and-write-score`、`speckit_3_2`、`IMPLEMENTATION_GAPS`、`stage_audit_complete` 在 §3 段落有匹配 |
| **T16** | `{project-root}/skills/speckit-workflow/references/audit-prompts.md` | 在 **§4 tasks 审计**的【审计后动作】中，同 T13 方式修改；CLI **须含** `--event stage_audit_complete`、`--stage tasks`、`--triggerStage speckit_4_2`、`--artifactDocPath specs/.../tasks-E{epic}-S{story}.md` | grep `parse-and-write-score`、`stage tasks`、`speckit_4_2`、`stage_audit_complete` 在 §4 段落有匹配 |
| **T17** | `{project-root}/skills/speckit-workflow/references/audit-prompts.md` | 在 **§5 implement 审计**的【审计后动作】中，同 T13 方式修改；CLI **须含** `--event stage_audit_complete`、`--stage implement`、`--triggerStage speckit_5_2`（与 config call_mapping 一致）、`--epic`、`--story`、`--artifactDocPath`、`--iteration-count`；reportPath 通常为 `AUDIT_Story_{epic}-{story}_stage4.md` 或 `AUDIT_implement-E{epic}-S{story}.md` | grep `parse-and-write-score`、`stage implement`、`speckit_5_2` 或 `stage_audit_complete` 在 §5 段落有匹配 |
| **T18** | `{project-root}/skills/bmad-story-assistant/SKILL.md` | 在 **STORY-A4-POSTAUDIT 模板**（阶段四实施后审计）中，在报告结尾格式要求**之后**、模板结束前，新增【审计通过后必做】块：当结论为「完全覆盖、验证通过」时，你（审计子代理）**在返回主 Agent 前必须**执行 `npx ts-node scripts/parse-and-write-score.ts --reportPath <报告路径> --stage implement --event story_status_change --triggerStage bmad_story_stage4 --epic {epic} --story {story} --artifactDocPath <story 文档路径> --iteration-count {本 stage 累计 fail 轮数，0 表示一次通过}`；报告路径为 `_bmad-output/implementation-artifacts/epic-{epic}-*/story-{epic}-{story}-*/AUDIT_Story_{epic}-{story}_stage4.md`；若执行失败，在结论中注明 resultCode；**禁止**在未执行前返回通过结论 | grep `审计通过后必做`、`parse-and-write-score`、`stage implement`、`bmad_story_stage4` 在 STORY-A4-POSTAUDIT 相关段落有匹配 |
| **T19** | `{project-root}/scripts/check-story-score-written.ts` | 扩展：增加参数 `--stage <story|implement>`（未指定时保持现有逻辑：任意 stage 即有 record 即 yes）。当指定 `--stage story` 时，仅当存在 `stage===story` 或 `trigger_stage===bmad_story_stage2` 的 record 时输出 `STORY_SCORE_WRITTEN:yes`；当指定 `--stage implement` 时，仅当存在 `stage===implement` 或 `trigger_stage===bmad_story_stage4` 的 record 时输出 yes | 对仅含 story record 的 epic/story 执行 `check --stage implement` 得 no；`check --stage story` 得 yes |
| **T20** | `{project-root}/skills/bmad-story-assistant/SKILL.md` | 在 **阶段四步骤 4.3**（Story 完成自检）中，将 check 调用明确为：主 Agent 在提供完成选项**之前**必须执行 `npx ts-node scripts/check-story-score-written.ts --epic {epic} --story {story} [--stage implement]`；若为 `STORY_SCORE_WRITTEN:no` 且 `AUDIT_Story_{epic}-{story}_stage4.md` 存在，则补跑 parse-and-write-score（同步骤 4.2 完整 CLI）；补跑后再次 check；若 T5 已落地，check 输出含 `DIMENSION_SCORES_MISSING:yes` 时亦须补跑（报告维度错误，需修正报告后重新 parse-and-write） | grep `check-story-score-written`、`--stage implement`、`DIMENSION_SCORES_MISSING` 在步骤 4.3 有匹配 |

### 阶段覆盖清单（双保险，禁止遗漏）

| stage | 主保险（子代理写） | 次保险（主 Agent check） |
|-------|--------------------|---------------------------|
| story | T11 STORY-A2-AUDIT | T12 步骤 2.3 |
| spec | T13 audit-prompts §1 | （Dev Story 内部，主 Agent 不入场） |
| plan | T14 audit-prompts §2 | （同上） |
| GAPS | T15 audit-prompts §3 | （同上） |
| tasks | T16 audit-prompts §4 | （同上） |
| implement | T17 audit-prompts §5 + T18 STORY-A4-POSTAUDIT | T20 步骤 4.3 |

---

**产出路径**：`_bmad-output/implementation-artifacts/_orphan/BUGFIX_scoring-write-stability.md`

**修订记录**：
- v1.0（2026-03-09）：初版，基于 Epic 12 仪表盘问题讨论总结
- v1.1（2026-03-09）：Party-Mode 100 轮讨论补充 §7，T5 改必做，路径/验收标准细化，Deferred Gap GAP-D1 记录
- v1.2（2026-03-09）：AUDIT_TASKS §4 round1 修正：§4.4 移除「可选增强」、§6 移除「可选」、原 §7 T5 移除「（可选）」并细化验收、GAP-D1 将「建议后续」改为「建议作为独立 BUGFIX 另行处理」
- v1.3（2026-03-09）：AUDIT_TASKS §4 round2 修正：第一份 §7 表格 T4 验收标准与 Party-Mode 版对齐（使用 mock 报告验收）
- v1.4（2026-03-09）：AUDIT_TASKS §4 round3 修正：第一份 §7 表格 T1 增加 --iteration-count 至修改内容与验收；T5 修改内容补充「DIMENSION_SCORES_MISSING:yes 或等效可解析提示」
- v1.5（2026-03-09）：AUDIT_TASKS §4 round4 修正：第一份 §7 表格 T1 验收补充 parse-and-write-score（与 §5 验收 1 一致）
- v1.6（2026-03-09）：Party-Mode 100 轮讨论「MIN_STAGES vs 2-stage 结构性冲突」：方案 A（MIN=2）纳入 §7 补充任务 T6～T10；讨论记录 PARTY_MODE_MIN_STAGES_vs_2stage_100r.md
- v1.7（2026-03-09）：双保险方案 §8§9：全在子代理写（T11、T13～T18）+ 主 Agent check 准入（T12、T19～T20）；覆盖 story/spec/plan/GAPS/tasks/implement 六阶段
- v1.8（2026-03-09）：AUDIT_TASKS 双保险 §4 round1：T19 移除禁止词「可选」；T14～T17 补充 --event stage_audit_complete 及 T17 --triggerStage speckit_5_2，与 call_mapping 一致
- v1.9（2026-03-09）：AUDIT_TASKS 双保险 §4 round2：T6 行号 167→168（与 compute.ts 实际一致）；§8 补充 T1 步骤 2.2 与 T11 衔接：主 Agent 应先执行 步骤 2.3 check，若 yes 则无需 步骤 2.2，若 no 则补跑，避免双写
- v1.10（2026-03-09）：AUDIT_TASKS 双保险 §4 round3：T6 行号 168→167（注释实际在第 167 行，第 168 行为常量定义）
- v1.11（2026-03-09）：AUDIT_TASKS 双保险 §4 round4：T6 行号 167→168（复核 compute.ts：第 168 行为 JSDoc 注释，第 169 行为常量定义；round3 误改）
- v1.12（2026-03-09）：AUDIT BUGFIX §7§9 SKILL一致性 round1 修正：§5 验收 1/5 与双保险流程对齐；§7 两处 T1 明确「补跑」语境；T12 修正为「若审计未通过之后、步骤 2.2 补跑之前」新增 步骤 2.3。
