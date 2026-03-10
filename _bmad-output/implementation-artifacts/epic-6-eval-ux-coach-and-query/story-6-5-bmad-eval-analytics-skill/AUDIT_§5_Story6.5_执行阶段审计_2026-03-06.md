# Story 6.5 实施后 §5 执行阶段审计报告

**审计日期**：2026-03-06  
**审计类型**：audit-prompts §5 执行阶段审计  
**被审对象**：
- 实施依据：`_bmad-output/implementation-artifacts/epic-6-eval-ux-coach-and-query/story-6-5-bmad-eval-analytics-skill/6-5-bmad-eval-analytics-skill.md`
- 任务文档：`specs/epic-6-eval-ux-coach-and-query/story-5-bmad-eval-analytics-skill/tasks-E6-S5.md`
- 实施产物：`skills/bmad-eval-analytics/SKILL.md`、prd.tasks-E6-S5.json、progress.tasks-E6-S5.txt、spec/plan/GAPS/tasks  
**审计模式**：严苛代码审计 + 批判审计员对抗视角

---

## §5 审计项 1：任务是否真正实现（无预留/占位/假完成）

### 1.1 T1 任务逐项核查

| 任务 | 状态 | 实现证据 |
|------|------|----------|
| T1.1 新建 skills/bmad-eval-analytics/SKILL.md | [x] | 文件存在，约 35 行，含 frontmatter（name, description）与正文 |
| T1.2 description / when to use / 触发短语 / 执行指引 | [x] | description 含 4 条短语；when to use 列出「帮我看看短板」「最近一轮的 Coach 报告」「诊断一下」「看看评分短板」；执行指引明确 `npx ts-node scripts/coach-diagnose.ts`；复用说明写明 discoverLatestRunId、coachDiagnose，无独立实现 |
| T1.3 无禁止词 | [x] | grep 未检出「可选」「待后续」「待定」「将在后续」等 |

### 1.2 T2 任务逐项核查

| 任务 | 状态 | 实现证据 |
|------|------|----------|
| T2.1 验收命令可执行 | [x] | `npx ts-node scripts/coach-diagnose.ts` 执行通过，有数据时输出 Markdown 诊断；无数据时输出「暂无评分数据，请先完成至少一轮 Dev Story」（coach-diagnose.ts L45-46） |
| T2.2 验收方式说明 | [x] | SKILL.md §验收 写明有/无数据时的预期；tasks §4 列明在 Cursor 中说短语的验证方式 |

### 1.3 占位/假完成排查

- SKILL.md 无占位符、无 TODO/FIXME。
- 无「后续迭代」「待实现」等延迟表述。
- tasks 中 T1.1～T2.2 全部勾选，且与实现一一对应。

**结论**：任务真正实现，无预留或假完成。

---

## §5 审计项 2：生产代码是否在关键路径中被使用

### 2.1 Skill 指引 → coach-diagnose

| 链条 | 验证 |
|------|------|
| Skill 指引执行 coach-diagnose | SKILL.md 明确：执行命令 `npx ts-node scripts/coach-diagnose.ts` |
| coach-diagnose 使用 discoverLatestRunId | scripts/coach-diagnose.ts L10 `import { ..., discoverLatestRunId } from '../scoring/coach'`；L144 无 run-id 时调用 `discoverLatestRunId(dataPath, limit)` |
| coach-diagnose 使用 coachDiagnose | L10 `import { coachDiagnose, ... } from '../scoring/coach'`；L152 `await coachDiagnose(effectiveRunId, { dataPath })` |

### 2.2 模块导出与调用链

- scoring/coach/index.ts 导出 discoverLatestRunId（来自 discovery.ts）、coachDiagnose（来自 diagnose.ts）。
- discovery.ts L99-103：按 timestamp 降序排序，取最新 run_id。
- coach-diagnose 无参时：discoverLatestRunId → coachDiagnose → formatToMarkdown。

**结论**：Skill 指引执行 coach-diagnose，coach-diagnose 在关键路径中调用 discoverLatestRunId 与 coachDiagnose。

---

## §5 审计项 3：需实现项是否均有实现与测试/验收覆盖

### 3.1 GAP 覆盖

| Gap ID | 对应任务 | 实现 |
|--------|----------|------|
| GAP-E6-S5-1 | T1.1 | skills/bmad-eval-analytics/SKILL.md 存在 |
| GAP-E6-S5-2, 4 | T1.2, T1.3 | description / when to use 含触发短语 |
| GAP-E6-S5-3, 7 | T1.2 | 指引执行 coach-diagnose，无独立 discovery/coach |
| GAP-E6-S5-5 | T2.1, T2.2 | 验收命令可执行；自然语言触发由 Skill 文档与 Cursor 加载后人工验证 |
| GAP-E6-S5-6 | — | coach-diagnose 已满足 timestamp 最近（discovery.ts 已实现） |

### 3.2 AC 覆盖

| AC | 覆盖方式 |
|----|----------|
| AC-1 自然语言触发 | Skill 列出短语 + 指引执行 coach-diagnose；验收命令验证底层可执行 |
| AC-2 最近一轮 timestamp | coach-diagnose 无参时内部 discovery 按 timestamp 取最新 |
| AC-3 共用逻辑 | Skill 指引执行 coach-diagnose，不新建 discovery/coach 实现 |

**结论**：需实现项均有实现；底层逻辑由 coach-diagnose 与 scoring/coach 单元测试覆盖（非本 Story 新增，Story 6.1 已覆盖）；本 Story 以 Skill 文档与验收命令为主。

---

## §5 审计项 4：验收表/验收命令是否已按实际执行并填写

### 4.1 验收命令执行记录（审计时复现 2026-03-06）

**命令**：`npx ts-node scripts/coach-diagnose.ts`

```
# AI Coach Diagnosis

## Summary
诊断完成（run_id=eval-question-sample）。未触发全链路 Skill 降级。 角色边界：AI Code Coach + Iteration Gate Keeper，仅消费既有 scoring 结果。

## Phase Scores
- prd: 100

## Weak Areas
- 无

...
```

退出码 0，输出为 Markdown 格式诊断报告。

**无数据场景**：coach-diagnose.ts L98-99、L145-147 在无记录时输出「暂无评分数据，请先完成至少一轮 Dev Story」并 exit(0)。

### 4.2 验收表填写情况

| 验收项 | tasks §4 | progress | 执行证据 |
|--------|----------|----------|----------|
| npx ts-node scripts/coach-diagnose.ts | 已列出 | T2 执行通过 | 本次审计复现通过 |
| 在 Cursor 中说「帮我看看短板」 | 已列出 | 未显式记录 | 依赖 Cursor 加载 Skill 后人工验证 |
| 在 Cursor 中说「最近一轮的 Coach 报告」 | 已列出 | 未显式记录 | 同上 |

progress 仅记录「T2 验收命令...执行通过」，未单独填写「在 Cursor 中说短语」的验证结果。tasks §4 将两类验收并列：底层命令 + 自然语言触发。自然语言触发依赖 Cursor 环境与 Skill 加载，无法在 CI 中自动化。

**结论**：底层验收命令已执行并可通过复现验证；自然语言触发验收需在 Cursor 中人工执行，progress 未单独填写该条，属于文档完备性缺口（见批判审计员）。

---

## §5 审计项 5：ralph-method 合规（prd/progress 更新、US 顺序）

### 5.1 prd.tasks-E6-S5.json

| US | 标题 | acceptance | passes |
|----|------|------------|--------|
| US-001 | 新建 skills/bmad-eval-analytics/SKILL.md，触发短语与复用 coach-diagnose 指引 | T1.1-T1.3 | true |
| US-002 | 验收命令 npx ts-node scripts/coach-diagnose.ts 可执行 | T2.1, T2.2 | true |

US 与 T1、T2 对应，passes 均为 true。

### 5.2 progress.tasks-E6-S5.txt

- prd 引用、US-001～002 完成 ✓
- T1、T2 均有日期与简要说明 ✓
- 无 TDD 红绿灯标记：本 Story 以新建 Skill 文档为主，无新增生产代码，TDD 不适用。

### 5.3 US 顺序

US-001（Skill 文档）→ US-002（验收），与 T1→T2 一致。

**结论**：prd/progress 已维护，US 顺序正确。无生产代码变更，TDD 标记不强制。

---

## §5 审计项 6：是否无延迟表述；是否无标记完成但未调用

### 6.1 延迟表述排查

- SKILL.md：无「可选」「待后续」「待定」「将在后续」。
- tasks、progress、prd：无延迟表述。

### 6.2 标记完成但未调用

- T1.1～T2.2 均勾选，且对应产物存在、命令可执行。
- coach-diagnose 被 Skill 指引调用，其内部使用 discoverLatestRunId、coachDiagnose，调用链完整。

**结论**：无延迟表述；无标记完成但未调用。

---

## 审计项汇总

| §5 审计项 | 判定 |
|-----------|------|
| 1. 任务真正实现 | ✓ 无预留/占位/假完成 |
| 2. 关键路径使用 | ✓ Skill→coach-diagnose→discoverLatestRunId/coachDiagnose |
| 3. 实现与验收覆盖 | ✓ GAP/AC 均有对应 |
| 4. 验收命令执行 | ✓ 底层命令已执行；自然语言验收依赖人工（见批判审计员） |
| 5. ralph-method | ✓ prd/progress 已维护，US 顺序正确 |
| 6. 无延迟/未调用 | ✓ 通过 |

---

## 批判审计员结论

**角色**：批判审计员（Critical Auditor），对抗视角逐项质疑可操作性、可验证性、遗漏与边界。

### CA-1：验收表填写不完整

tasks-E6-S5 §4 列出三项验收：
1. `npx ts-node scripts/coach-diagnose.ts`
2. 在 Cursor 中说「帮我看看短板」
3. 在 Cursor 中说「最近一轮的 Coach 报告」

progress 仅记录「T2 验收命令...执行通过」，对应第 1 项。第 2、3 项（自然语言触发）无执行记录或勾选。若按「验收表/验收命令是否已按实际执行并填写」的严格解读，存在**验收表填写缺口**：自然语言触发两项未在 progress 或独立验收表中标注「已执行」或「待人工验证」。

**判定**：低严重性缺口。理由：自然语言触发依赖 Cursor 与 Skill 加载，无法在脚本中自动化；但应在 progress 或验收表中显式注明「T2.2 自然语言触发：待 Cursor 中人工验证」或类似表述，避免误读为「已全部执行」。

### CA-2：Skill 加载路径与可发现性

Story 6.5 产出 `skills/bmad-eval-analytics/SKILL.md`。Cursor 的 Skill 加载机制：全局 skills 通常来自 `~/.cursor/skills/`；项目内 `skills/` 是否为 Cursor 自动发现，文档未明确。若项目 skills 需手动复制或链接至全局目录，则「在 Cursor 中说短语触发」的前提（Skill 已加载）可能未满足。

**判定**：中低风险。当前实现符合 Story 产出物路径约定（`skills/`）；若项目有统一 skill 同步流程（如 sync-to-global），需在后续 Story 或运维文档中说明。本 Story 范围不包含 Cursor 加载机制实现，**不构成本轮 gap**。

### CA-3：discoverLatestRunIds vs discoverLatestRunId 命名一致性

epics.md L73 写「discoverLatestRunIds」（复数），而 spec、Story、实现均为 `discoverLatestRunId`（单数）。prd.eval-ux-last-mile 亦曾用复数。当前实现与 spec 一致为单数，语义正确（返回单个最新 run_id）。epics.md 为规划产物，非实施依据。

**判定**：非实施 gap。建议后续统一修正 epics 中的命名笔误，避免阅读混淆。

### CA-4：T2.2「验收方式说明」是否算完成

T2.2 为「验收方式说明：在 Cursor 中...Agent 应执行 coach-diagnose...」。若理解为「编写说明」则已完成（SKILL.md、tasks §4 均有说明）；若理解为「执行该验收并记录结果」则未完成（见 CA-1）。

**判定**：T2.2 可解读为「说明验收方式」而非「执行验收」。结合 tasks 表述，**可接受**为完成，但 CA-1 的填写建议仍成立。

### CA-5：coach-diagnose 无数据路径的自动化验证

T2.1 要求「无数据时输出「暂无评分数据...」」。本次审计在**有数据**环境下复现。无数据路径（如空 scoring 目录）未在本次审计中复现。coach-diagnose 代码 L98-99、L145-147 逻辑清晰，可静态确认。

**判定**：低风险。建议后续回归时在无数据环境下执行一次以完备验收证据；当前**不构成本轮 gap**。

### CA-6：GAP-E6-S5-6 与 AC-2 的可追溯性

GAPS 将 GAP-E6-S5-6（AC-2 最近一轮 timestamp）标为「coach-diagnose 已满足」，未分配任务。discovery.ts L99-103 按 timestamp 降序，取最新 run_id；coach-diagnose L144 调用 discoverLatestRunId。追溯链完整。

**判定**：无 gap。

### CA-7：行号与路径有效性

- SKILL.md 指引：`npx ts-node scripts/coach-diagnose.ts` — 路径有效，审计时执行成功。
- scoring/coach 导出：index.ts 导出 discoverLatestRunId、coachDiagnose — 存在且被 coach-diagnose 使用。
- 所引用行号（coach-diagnose L10/144/152、discovery L99-103）经核对无误。

**判定**：无失效行号或路径。

### CA-8：§5 与验收的误伤/漏网

- **误伤**：无。未将合理的设计选择（如 T2.2 作为说明任务）误判为未完成。
- **漏网**：CA-1 所指「自然语言触发验收未在 progress 中显式填写」属潜在漏网，已记录。

### CA-9：Skill description 与 when to use 的冗余与一致性

SKILL.md 的 frontmatter description 与正文 when to use 均列出触发短语。是否存在信息冗余或冲突？核查：description 为 Cursor 检索用简短摘要；when to use 为 Agent 阅读的详细指引。两者内容一致，无冲突。冗余可接受（符合 Skill 文档惯例）。

**判定**：无 gap。

### CA-10：coach-diagnose 的 --epic/--story 与本 Story 的关系

coach-diagnose 支持 `--epic`、`--story`（Story 6.2 功能）。本 Story 的 Skill 指引仅写 `npx ts-node scripts/coach-diagnose.ts`，未提可选参数。用户若说「帮我看看 Epic 3 的短板」是否应触发？Story 6.5 §3.2 明确「6.5 首版可仅支持「全部/最近一轮」；按 Epic/Story 筛选触发由 6.2 定义」。故本 Story 不要求 Skill 覆盖 --epic/--story，当前指引正确。

**判定**：无 gap。

### CA-11：prd JSON 与 tasks 的 US 粒度

prd 仅 2 个 US（US-001 对应 T1，US-002 对应 T2），tasks 有 T1.1～T1.3、T2.1～T2.2 共 5 个子任务。US 粒度粗于任务粒度，ralph-method 允许。passes 与任务完成状态一致。

**判定**：无 gap。

### CA-12：sprint-status 与 Story 6.5 状态

sprint-status.yaml 将 6-5-bmad-eval-analytics-skill 标为 backlog。若实施已完成，sprint 状态是否应更新？sprint-status 为迭代规划元数据，非本审计的验收项。实施完成与 sprint 状态可不同步。

**判定**：不构成本轮 gap；建议后续同步。

### 批判审计员最终判定

**本轮存在 1 个低严重性 gap**：
- **GAP-CA-1**：progress 或独立验收表未显式标注「在 Cursor 中说短语」两项验收的执行状态（已执行 / 待人工验证）。建议在 progress.tasks-E6-S5.txt 中补充，例如：`T2.2 自然语言触发（在 Cursor 中说「帮我看看短板」「最近一轮的 Coach 报告」）：需 Cursor 加载 Skill 后人工验证，暂无自动化证据。`

**其余 11 项对抗检查**（CA-2～CA-12）均未发现新 gap。CA-2、CA-3、CA-5、CA-12 为建议性改进或文档一致性优化，不强制要求本 Story 修复。

---

## 结论

| 维度 | 结果 |
|------|------|
| §5 六项审计 | ✓ 通过 |
| 批判审计员 | ⚠ 1 个低严重性 gap（GAP-CA-1：验收表填写） |

**综合结论**：**未通过**（因存在 GAP-CA-1）。

**修改建议**：
1. 在 `progress.tasks-E6-S5.txt` 中补充 T2.2 自然语言触发验收的说明，例如：`T2.2 自然语言触发：在 Cursor 中加载本 Skill 后说「帮我看看短板」或「最近一轮的 Coach 报告」可触发；需人工验证，无自动化记录。`
2. 或在 tasks-E6-S5 §4 验收命令汇总表中增加「执行状态」列，对三项验收分别标注「已执行」/「待人工验证」。

完成上述补充后，可再次提交 §5 审计。若团队采纳「自然语言触发验收为说明性任务、不要求 progress 填写」的解读，则本轮可视为**完全覆盖、验证通过**，且批判审计员**本轮存在 1 个低严重性 gap（GAP-CA-1）**，需团队决策是否修正。

---

**收敛建议**：若按严格标准（需补充 progress）则本轮**未通过**；若按宽松解读（T2.2 为说明任务）则**通过**。无论哪种，批判审计员本轮有 1 个已记录 gap，**非「本轮无新 gap」**。建议累计至 3 轮无 gap 后再收敛。
