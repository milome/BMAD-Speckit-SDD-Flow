# AUDIT_TASKS：BUGFIX_scoring-write-stability 双保险 §9 T11～T20

**被审对象**：`_bmad-output/implementation-artifacts/_orphan/BUGFIX_scoring-write-stability.md`  
**需求依据**：§1 问题描述、§2 根因、§4 修复方案、§5 验收、§8 双保险方案  
**项目根**：D:\Dev\BMAD-Speckit-SDD-Flow  
**本轮次**：第 1 轮  
**审计日期**：2026-03-09

---

## 模型选择信息

| 项目 | 值 |
|------|-----|
| 配置来源 | .claude/agents/code-reviewer.md |
| 指定模型 | inherit（来自 frontmatter，继承主 Agent 模型） |
| 选择依据 | 子代理 YAML 中 model: inherit；可改为 fast 以节省审计成本（若环境支持） |

---

## 1. 审计执行摘要

对照 audit-prompts §4 精神与 TASKS 文档适配要求，对 BUGFIX 文档 §8 双保险方案与 §9 T11～T20 逐项审计。**本轮发现 gap**，已在本轮内直接修改被审文档以消除；主 Agent 收到报告后发起下一轮审计。

---

## 2. 需求覆盖检查

| 检查项 | 结果 | 说明 |
|--------|------|------|
| §9 T11～T20 覆盖双保险方案 | ✓ | 主保险 T11、T13～T18；次保险 T12、T19～T20 |
| 六阶段 stage 覆盖 | ✓ | story(T11/T12)、spec(T13)、plan(T14)、GAPS(T15)、tasks(T16)、implement(T17+T18/T20) |
| 主保险与次保险衔接 | ✓ | 阶段覆盖清单表已明确各 stage 对应任务 |
| stage 遗漏 | ✓ | 无遗漏；spec/plan/GAPS/tasks 标注「Dev Story 内部，主 Agent 不入场」 |

---

## 3. 任务可执行性检查

| ID | 修改路径明确 | 修改内容具体 | 验收可验证 |
|----|-------------|-------------|-----------|
| T11 | ✓ | 有明确插入位置、CLI 全文、报告路径模板 | grep 验收 |
| T12 | ✓ | 步骤 2.3、补跑逻辑、检查条件 | grep 验收 |
| T13 | ✓ | 有「改为」「新增」及完整 CLI 块 | grep 验收 |
| T14 | ✓（已补） | 已补充 --event、--triggerStage 等必含项 | grep 验收 |
| T15 | ✓（已补） | 同上 | grep 验收 |
| T16 | ✓（已补） | 同上 | grep 验收 |
| T17 | ✓（已补） | 已补充 --triggerStage speckit_5_2 | grep 验收 |
| T18 | ✓ | 有明确插入位置、CLI、报告路径 | grep 验收 |
| T19 | ✓（已修正） | 已移除禁止词「可选」 | 行为验收 |
| T20 | ✓ | 步骤 4.3、补跑逻辑、DIMENSION_SCORES_MISSING | grep 验收 |

---

## 4. 依赖与一致性检查

| 检查项 | 结果 | 说明 |
|--------|------|------|
| T11～T20 与 T1～T10 冲突 | ✓ | 无冲突；T5 的 dimension_scores 校验与 T19/T20 协同 |
| 与 §8 双保险方案一致 | ✓ | 主保险覆盖 6 阶段，次保险覆盖阶段二、阶段四 |
| 禁止词检查 | ✗→✓ | **Gap 1**：T19 原含「可选参数」→ 已改为「增加参数（未指定时保持现有逻辑）」 |
| T17 与 T18 双写 | ✓ | 非冲突：T17 为 speckit §5（Dev Story 内）、T18 为 STORY-A4-POSTAUDIT；两入口均需子代理写 |

---

## 5. 边界与遗漏检查

| 检查项 | 结果 | 说明 |
|--------|------|------|
| project-root 路径解析 | ✓ | T11、T12、T18、T20 使用 `{project-root}/skills/bmad-story-assistant/`；T13～T17 使用 `{project-root}/skills/speckit-workflow/` |
| reportPath 模板 | ✓ | T11：`AUDIT_Story_{epic_num}-{story_num}_stage2.md`；T18：`AUDIT_Story_{epic}-{story}_stage4.md` |
| epic/story 占位符 | ✓ | 各处一致使用 {epic}、{story} 或 {epic_num}、{story_num} |
| iteration_count 传递 | ✓ | T11、T18 明确「本 stage 累计 fail 轮数，0 表示一次通过」 |
| --event、--triggerStage 与 call_mapping | ✗→✓ | **Gap 2**：T14～T17 原未明确 --event；T17 未明确 --triggerStage speckit_5_2。parse-and-write-score 默认 event=user_explicit_request，缺 --event 会触发检查失败。已补全 |

---

## 6. 集成/端到端检查

| 检查项 | 结果 | 说明 |
|--------|------|------|
| 主保险与次保险衔接 | ✓ | T12 步骤 2.3 在阶段二→三；T20 步骤 4.3 在阶段四完成选项前 |
| check 脚本 --stage 与补跑逻辑 | ✓ | T19 扩展 --stage story|implement；T20 步骤 4.3 明确 `[--stage implement]` |
| T5 dimension_scores 与补跑闭环 | ✓ | T20 明确 DIMENSION_SCORES_MISSING:yes 时亦须补跑 |

---

## 批判审计员结论

（本段落字数与条目数不少于报告其余部分的 70%）

### 已检查维度列表

1. 需求覆盖：§8 双保险、六阶段、主/次保险是否完全映射到 T11～T20  
2. 任务可执行性：每任务修改路径、修改内容、验收标准是否明确可执行  
3. 禁止词：任务描述中是否出现「可选、可考虑、后续、酌情、待定、技术债」  
4. 路径解析：project-root、SKILLS_ROOT、reportPath 模板、epic/story 占位符  
5. CLI 参数完整性：--event、--triggerStage 与 config/scoring-trigger-modes.yaml call_mapping 的匹配  
6. audit-prompts 与 bmad-story-assistant 的 implement 双写：T17 与 T18 是否冲突  
7. T19 check --stage 与 record.stage/trigger_stage 的兼容性  
8. iteration_count 的传递与占位符说明  
9. 阶段覆盖清单是否与 §8 表一致  
10. 遗漏 stage 或任务的风险  

### 每维度结论

| 维度 | 结论 | 具体项 |
|------|------|--------|
| 1. 需求覆盖 | 通过 | 六阶段均有对应任务；阶段覆盖清单正确 |
| 2. 任务可执行性 | 通过 | 各任务均有 grep 或行为验收 |
| 3. 禁止词 | **未通过→已修正** | T19 原「增加可选参数」含禁止词「可选」；已改为「增加参数（未指定时保持现有逻辑）」 |
| 4. 路径解析 | 通过 | project-root 使用一致；T13～T17 路径为项目内 skills，未强制 SKILLS_ROOT 兜底（可接受，与 T1～T3 补充说明一致） |
| 5. CLI 参数 | **未通过→已修正** | T14～T16 原「CLI 为」仅列 --stage、--triggerStage，未列 --event；parse-and-write 默认 event=user_explicit_request，缺则 call_mapping 不匹配。T17 未列 --triggerStage speckit_5_2，为保持与 T13～T16 一致（speckit_1_2～speckit_4_2）应使用 speckit_5_2。已补全 |
| 6. T17 与 T18 双写 | 通过 | 非冲突：T17 对应 speckit §5（Dev Story 内嵌套）；T18 对应 STORY-A4-POSTAUDIT（阶段四）。两处为不同入口，均需子代理写 |
| 7. T19 与 record 兼容 | 通过 | record 含 stage、trigger_stage；T19 校验 `stage===story` 或 `trigger_stage===bmad_story_stage2` 等，与 RunScoreRecord 结构一致 |
| 8. iteration_count | 通过 | T11、T18 有明确说明；T13「累计值由 prompt 或调用方提供」 |
| 9. 阶段覆盖清单 | 通过 | 与 §8 表一致 |
| 10. 遗漏风险 | 通过 | 无遗漏 stage；spec/plan/GAPS/tasks 的「Dev Story 内部」说明合理 |

### 对抗视角补充检查

- **call_mapping 匹配**：config 中 speckit_1_2～speckit_5_2、bmad_story_stage2、bmad_story_stage4 均需 (event, stage) 匹配。T11/T12/T18/T20 用 story_status_change + bmad_story_stage2/4 ✓；T13～T17 须用 stage_audit_complete + speckit_X_2 ✓（已补全）。  
- **T17 triggerStage 选择**：call_mapping 有 speckit_5_2_audit_pass 与 implement_audit_pass。为与 speckit 流程一致，T17 应显式使用 speckit_5_2，已补充。  
- **T5 与 T20 闭环**：T5 要求 check 输出 DIMENSION_SCORES_MISSING；T20 要求该情况下补跑。闭环完整 ✓。  

### 本轮结论

**本轮存在 gap，不计数**。已发现并修正 2 类 gap：  
- Gap 1：T19 禁止词「可选」→ 已移除  
- Gap 2：T14～T17 CLI 缺 --event 或 --triggerStage → 已补全  

修改完成后，被审文档已更新至 v1.8；主 Agent 须发起下一轮审计以验证「连续 3 轮无 gap」。

---

## 7. 本轮已修改内容（审计子代理直接修改）

以下修改已由审计子代理在本轮内直接写入被审文档：

1. **T19**：将「增加可选参数」改为「增加参数（未指定时保持现有逻辑）」，消除禁止词「可选」。
2. **T14**：将「CLI 为」改为「CLI **须含**」，并补充 `--event stage_audit_complete`；验收补充 `stage_audit_complete`。
3. **T15**：同上，补充 `--event stage_audit_complete`；验收补充 `stage_audit_complete`。
4. **T16**：同上。
5. **T17**：补充 `--event stage_audit_complete`、`--triggerStage speckit_5_2`；验收补充 `speckit_5_2` 或 `stage_audit_complete`。
6. **修订记录**：新增 v1.8 记录上述修正。

---

## 8. 收敛条件

**本轮存在 gap，不计数**。  
连续 3 轮无 gap 后始可收敛。主 Agent 收到本报告后须发起下一轮审计。

---

## 可解析评分块（供 parseAndWriteScore）

```
总体评级: B

维度评分:
- 需求完整性: 90/100
- 可测试性: 85/100
- 一致性: 75/100
- 可追溯性: 90/100
```

**说明**：一致性 75 因首轮发现禁止词及 CLI 参数遗漏而降分；修正后若下轮无 gap 可提升。
