# AUDIT_TASKS：BUGFIX_scoring-write-stability 双保险 §9 T11～T20

**被审对象**：`_bmad-output/implementation-artifacts/_orphan/BUGFIX_scoring-write-stability.md`  
**需求依据**：§1 问题描述、§2 根因分析、§4 修复方案、§5 验收标准、§8 双保险方案  
**项目根**：d:\Dev\BMAD-Speckit-SDD-Flow  
**本轮次**：第 2 轮  
**上一轮**：AUDIT_TASKS_BUGFIX_scoring-write-stability_双保险_§4_round1.md 发现 gap 并已修改（T19 禁止词、T14～T17 CLI 参数）；被审文档已更新至 v1.8  
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

对照 audit-prompts §4 精神与 TASKS 文档适配要求，对 BUGFIX 文档 §7（T1～T10）、§9（T11～T20）完整任务列表逐项审计。**本轮发现 gap**，已在本轮内直接修改被审文档以消除；主 Agent 收到报告后发起下一轮审计。

---

## 2. 需求覆盖检查

| 需求来源 | 要点 | T1～T20 覆盖 | 结论 |
|----------|------|--------------|------|
| §1.1 | Epic 聚合无完整 Story，根因阶段二无步骤 2.2 | T1、T11、T12 | ✓ |
| §1.2 | dimension_scores 缺失，implement 报告用 tasks 四维 | T2、T3、T4、T5、T18、T20 | ✓ |
| §1.3 | 阶段二评分写入缺少显式步骤 | T1、T11 | ✓ |
| §4.1～4.4 | 阶段二步骤 2.2、code 四维、§7.1、WARN | T1～T5 | ✓ |
| §5 #1～5 | 五项验收 | T1～T5 验收对应 | ✓ |
| §8 双保险 | 主保险子代理写、次保险主 Agent check | T11、T13～T18（主）；T12、T19～T20（次） | ✓ |
| 阶段覆盖清单 | 六阶段均有对应 | story(T11/T12)、spec(T13)、plan(T14)、GAPS(T15)、tasks(T16)、implement(T17+T18/T20) | ✓ |

**需求覆盖结论**：T1～T20 完全覆盖 §1、§2、§4、§5、§8，无遗漏要点。

---

## 3. 任务可执行性检查

| ID | 修改路径明确 | 修改内容具体 | 验收可量化 | 验收命令可执行 |
|----|-------------|-------------|-----------|----------------|
| T1～T5 | ✓ | ✓ | grep / mock / 行为 | ✓ |
| T6～T10 | ✓ | ✓（含具体行号、单测改动） | grep / 单测 | ✓ |
| T11～T18 | ✓ | ✓（含 CLI 全文、插入位置） | grep | ✓ |
| T19 | ✓ | ✓（--stage story\|implement、record 匹配逻辑） | 行为验收（仅 story record 时 --stage implement→no） | ✓ |
| T20 | ✓ | ✓（步骤 4.3、DIMENSION_SCORES_MISSING 补跑） | grep | ✓ |

**可执行性结论**：各任务描述清晰，验收标准可量化，验收命令可落地。

---

## 4. 依赖与一致性检查

| 检查项 | 结果 | 说明 |
|--------|------|------|
| T1～T10 与 T11～T20 冲突 | ✓ | 无冲突；T5 dimension_scores 与 T19/T20 协同 |
| 与 §8 双保险方案一致 | ✓ | 主保险 6 阶段、次保险阶段二/四 |
| 禁止词 | ✓ | 无「可选、可考虑、后续、酌情、待定」残留 |
| call_mapping 匹配 | ✓ | T13～T17 已含 --event stage_audit_complete、--triggerStage speckit_X_2；T17 含 speckit_5_2 |
| T1 与 T11 衔接 | ✗→✓ | **Gap 1**：原未明确执行顺序与双写规避；已补 §8「T1 步骤 2.2 与 T11 衔接」 |

---

## 5. 边界与遗漏检查

| 检查项 | 结果 | 说明 |
|--------|------|------|
| project-root / SKILLS_ROOT | ✓ | T1～T3、T11～T18 路径明确 |
| reportPath 模板 | ✓ | T11、T18、T13～T17 有模板或「由 prompt/调用方提供」 |
| --event / --triggerStage 与 call_mapping | ✓ | scoring-trigger-modes.yaml 已对 speckit_1_2～5_2、bmad_story_stage2/4 |
| 阶段覆盖清单与 §8 表一致 | ✓ | 六阶段逐一对应 |
| T6 行号 | ✗→✓ | **Gap 2**：原写「第 167 行」，compute.ts 实际为第 168 行；已改为 168 |
| T19 --stage implement 与 speckit_5_2 | ✓ | record.stage===implement 时即匹配，trigger_stage=speckit_5_2 的 record 亦可通过 |
| T5 dimension_scores 与 RunScoreRecord | ✓ | RunScoreRecord 含 dimension_scores?，T5 校验逻辑成立 |

---

## 6. 集成/端到端检查

| 检查项 | 结果 | 说明 |
|--------|------|------|
| 主保险与次保险衔接 | ✓ | T12 步骤 2.3 在阶段二→三；T20 步骤 4.3 在阶段四完成选项前 |
| check --stage 与补跑闭环 | ✓ | T19 扩展 --stage；T20 明确补跑逻辑及 DIMENSION_SCORES_MISSING 处理 |
| T5 与 T20 协同 | ✓ | DIMENSION_SCORES_MISSING:yes 时亦须补跑（修正报告后重新 parse-and-write） |
| T1 与 T11 双写规避 | ✓ | §8 补充后：先 步骤 2.3 check，若 yes 则免 步骤 2.2，避免双写 |

---

## 批判审计员结论

（本段落字数与条目数不少于报告其余部分的 70%）

### 已检查维度列表

1. 需求完整性：§1～§5、§8 与 T1～T20 映射是否完全  
2. 任务可执行性：每任务修改路径、修改内容、验收标准是否明确可执行  
3. 依赖与一致性：T1～T10 与 T11～T20 是否冲突、与 §8 是否一致  
4. 禁止词：任务与说明中是否出现「可选、可考虑、后续、酌情、待定」  
5. 路径解析：project-root、SKILLS_ROOT、reportPath 模板  
6. CLI 参数：--event、--triggerStage 与 config call_mapping 的完整匹配  
7. T1 与 T11 衔接：双保险下主 Agent 步骤 2.2 与子代理 T11 是否导致双写  
8. 阶段覆盖清单：是否与 §8 表一致、是否有遗漏 stage  
9. 行号与引用：T6 行号是否与 compute.ts 实际一致  
10. 边界：T19 record 匹配逻辑、T5 dimension_scores 与 schema 兼容性  
11. 集成：主/次保险衔接、check 与补跑闭环、T5 与 T20 协同  
12. 与前置文档矛盾：修订记录、补充说明是否自洽  

### 每维度结论

| 维度 | 结论 | 具体项 |
|------|------|--------|
| 1. 需求完整性 | 通过 | T1～T20 覆盖 §1.1～1.3、§4.1～4.4、§5、§8 六阶段 |
| 2. 任务可执行性 | 通过 | 各任务均有 grep 或行为验收，CLI 可复制 |
| 3. 依赖与一致性 | **未通过→已修正** | **Gap 1**：T1 与 T11 衔接未明确，易导致双写；已补 §8「T1 步骤 2.2 与 T11 衔接」 |
| 4. 禁止词 | 通过 | 无禁止词残留；198 行「由可选改为必做」为变更描述，非规定 |
| 5. 路径解析 | 通过 | 路径规则一致；T13～T17 项目内 skills 与 T1～T3 补充说明一致 |
| 6. CLI 参数 | 通过 | T13～T17 已含 --event stage_audit_complete 及 speckit_X_2；与 call_mapping 一致 |
| 7. T1 与 T11 衔接 | **未通过→已修正** | 双保险下若主 Agent 仍无条件执行 步骤 2.2 将双写；§8 已补充：先 步骤 2.3，若 yes 则免 步骤 2.2 |
| 8. 阶段覆盖清单 | 通过 | 与 §8 表一致，六阶段无遗漏 |
| 9. 行号引用 | **未通过→已修正** | **Gap 2**：T6「第 167 行」与 compute.ts 第 168 行不符；已改为 168 |
| 10. 边界 | 通过 | T19 stage===implement 覆盖 speckit_5_2 record；T5 与 RunScoreRecord 兼容 |
| 11. 集成 | 通过 | 主/次保险、check、补跑、DIMENSION_SCORES_MISSING 闭环完整 |
| 12. 前置文档 | 通过 | 修订记录与补充说明自洽，无矛盾 |

### 对抗视角补充检查

- **T1 与 T11 双写**：若主 Agent 无条件执行 步骤 2.2，而子代理已执行 T11，将产生两条 record（runId 不同）。§8 补充后，主 Agent 先 步骤 2.3 check，若 yes 则跳过 步骤 2.2，避免双写。✓  
- **T6 行号**：compute.ts 第 168 行为注释、169 行为常量；文档原写 167 易误导实施；已改为 168。✓  
- **T17 与 T18 双写**：T17 为 speckit §5（Dev Story 内）、T18 为 STORY-A4-POSTAUDIT；两入口不同，均需子代理写，非冲突。✓  
- **T5 与 T20 闭环**：DIMENSION_SCORES_MISSING:yes 时需「修正报告后重新 parse-and-write」，T20 已明确。✓  

### 本轮结论

**本轮存在 gap，不计数**。已发现并修正 2 类 gap：  
- **Gap 1**：T1 与 T11 衔接未明确 → 已补 §8「T1 步骤 2.2 与 T11 衔接」  
- **Gap 2**：T6 行号 167 与实际 168 不符 → 已改为 168  

修改完成后，被审文档已更新至 v1.9；主 Agent 须发起下一轮审计以验证「连续 3 轮无 gap」。

---

## 7. 本轮已修改内容（审计子代理直接修改）

以下修改已由审计子代理在本轮内直接写入被审文档：

1. **T6**：将「第 167 行注释」改为「第 168 行注释」，与 `scoring/dashboard/compute.ts` 实际行号一致。
2. **§8**：在双保险表之后新增「T1 步骤 2.2 与 T11 衔接」段：主 Agent 应先执行 步骤 2.3 check；若 STORY_SCORE_WRITTEN:yes 则无需 步骤 2.2；若 no 且报告存在则执行 步骤 2.2（补跑），避免与 T11 子代理写双写。
3. **修订记录**：新增 v1.9 记录上述修正。

---

## 8. 收敛条件

**本轮存在 gap，不计数**。  
连续 3 轮无 gap 后始可收敛。主 Agent 收到本报告后须发起下一轮审计。

---

## 可解析评分块（供 parseAndWriteScore）

```
总体评级: B
维度评分:
- 需求完整性: 92/100
- 可测试性: 88/100
- 一致性: 85/100
- 可追溯性: 92/100
```

**说明**：一致性 85 因 T1/T11 衔接及 T6 行号修正而降分；修正后若下轮无 gap 可提升。

---

## 收敛状态

- **本轮无新 gap**：否
- **修改执行**：是，已直接修改被审文档
- **保存路径**：`d:\Dev\BMAD-Speckit-SDD-Flow\_bmad-output\implementation-artifacts\_orphan\AUDIT_TASKS_BUGFIX_scoring-write-stability_双保险_§4_round2.md`
- **建议**：主 Agent 发起第 3 轮审计，累计至连续 3 轮无 gap 后收敛
