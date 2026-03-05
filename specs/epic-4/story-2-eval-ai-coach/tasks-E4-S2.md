<!-- AUDIT: PASSED by code-reviewer -->

# Tasks: eval-ai-coach (E4-S2)

**Input**: `spec-E4-S2.md`、`plan-E4-S2.md`、`IMPLEMENTATION_GAPS-E4-S2.md`、Story 4.2  
**Prerequisites**: Story 3.3 scoring 写入可用；Story 4.1 veto 模块（`applyTierAndVeto`、`evaluateEpicVeto`）可导入

---

## 本批任务 ↔ Story 4.2 需求追溯

| 任务 ID | Story 章节 | 对应 AC | 需求要点 |
|---------|-----------|---------|----------|
| T1–T1.3 | Story 4.2 §3 T1 | AC-1 | 教练定位/职责/人格文档化 |
| T2–T2.4 | Story 4.2 §3 T2 | AC-2 | 技能配置与 fallback |
| T3–T3.5 | Story 4.2 §3 T3 | AC-3, AC-6 | 工作流入口、run_id 加载、输出 schema、veto 调用 |
| T4–T4.3 | Story 4.2 §3 T4 | AC-4, AC-6 | iteration_passed 判定与一票否决 |
| T5–T5.3 | Story 4.2 §3 T5 | AC-5 | 禁止表述校验 |
| T6–T6.4 | Story 4.2 §3 T6 | AC-3 | CLI/触发入口、集成与端到端验收 |
| T7–T7.4 | AI_COACH_ROLE_ANALYSIS §4 Task 1~4 | AC-2, AC-3 | Manifest 入驻、Agent Persona 文件、Persona 加载、路由防御 |

---

## Gaps → 任务映射（含 GAP-BMAD-1）

| Gap ID | 缺口说明 | 对应任务 |
|--------|----------|----------|
| GAP-1.1, GAP-1.2, GAP-T1 | AI 教练定义文档缺失 | T1.1–T1.3 |
| GAP-BMAD-1 | 人格定义须与 BMAD agent 四维 persona 结构一致 | T1.1, T1.2 |
| GAP-1.3, GAP-T2, GAP-P4 | 技能配置与 fallback 缺失 | T2.1–T2.4 |
| GAP-1.4, GAP-T3, GAP-P1, GAP-P2 | coachDiagnose、loader、主流程编排缺失 | T3.1–T3.5 |
| GAP-1.6, GAP-T4 | iteration_passed 判定与 veto 联动缺失 | T4.1–T4.3 |
| GAP-1.7, GAP-T5, GAP-P3 | 禁止词机制缺失 | T5.1–T5.3 |
| GAP-1.5, GAP-T6, GAP-P5, GAP-P6 | Markdown 输出、CLI、验收脚本缺失 | T6.1–T6.4 |
| GAP-MANIFEST-1 | AI Coach 入驻 manifest | T7.1 |
| GAP-MANIFEST-2 | 创建 `_bmad/scoring/agents/ai-coach.md` | T7.2 |
| GAP-MANIFEST-3 | diagnose 流程从 manifest/agent 文件读取 Persona | T7.3 |
| GAP-MANIFEST-4 | 路由防御，限制 scoring agent 常规暴露 | T7.4 |

---

## Architecture 约束表

| 组件 | 强制约束 | 任务落点 |
|------|----------|----------|
| 数据输入 | 仅消费 `scoring/data` 中 run_id 对应数据，不新增写入职责 | T3.1, T3.2 |
| 规则调用 | 复用 Story 4.1 的 `applyTierAndVeto`、`evaluateEpicVeto`，不得重复实现 veto 规则 | T3.3, T4.1 |
| 依赖方向 | `scoring/coach` 单向依赖 `scoring/veto`、`scoring/writer/types`；禁止 `veto -> coach` 反向依赖 | T3.1, T3.3, T6.3 |
| Skill 策略 | 必引 `bmad-code-reviewer-lifecycle`；不可用时走 fallback 仅读历史 scoring 数据 | T2.1–T2.4 |
| 输出契约 | 产出字段必须覆盖 `summary`、`phase_scores`、`weak_areas`、`recommendations`、`iteration_passed`；支持 JSON/Markdown | T3.4, T3.5, T6.4 |
| 关键路径集成 | 模块必须被 CLI/验收脚本导入并实际调用，禁止孤岛实现 | T6.1, T6.3, T6.4 |

---

## Phase 1：教练定义文档化（T1）

**AC**: #1  
**覆盖 Gap**: GAP-1.1, GAP-1.2, GAP-T1, GAP-BMAD-1

- [x] **T1.1** 新建 `scoring/coach/AI_COACH_DEFINITION.md`，写入定位、职责边界、与 Code Reviewer 的关系；并按 BMAD agent persona 四维结构定义人格：`role`、`identity`、`communication_style`、`principles`（对齐 `adversarial-reviewer.md` / `architect.md` 结构）。
- [x] **T1.2** 在文档内补充 REQUIREMENTS §3.14 逐条映射表，明确本 Story 的承载边界、输入来源、输出职责与不做事项。
- [x] **T1.3** 增加文档完整性自检清单（字段齐全、禁止词合规、引用路径有效），并在 Dev 记录中保留检查结果。

---

## Phase 2：技能配置与 fallback（T2）

**AC**: #2  
**覆盖 Gap**: GAP-1.3, GAP-T2, GAP-P4

- [x] **T2.1** 新增 `config/coach-trigger.yaml`（或 `scoring/coach/config.yaml`）并定义 `auto_trigger_post_impl: false` 默认值。
- [x] **T2.2** 在 `scoring/coach/config.ts`（或 `loader.ts`）实现配置加载：读取必引 Skill、触发开关与运行模式。
- [x] **T2.3** 在 `scoring/coach/diagnose.ts` 实现 fallback：当全链路 Skill 路径缺失或加载失败时，仅解读既有 scoring 数据并返回诊断，不触发新审计。
- [x] **T2.4** 单元测试：mock Skill 不可用场景，断言 fallback 分支可稳定返回且输出字段完整。

---

## Phase 3：工作流入口与输出格式（T3）

**AC**: #3, #6  
**覆盖 Gap**: GAP-1.4, GAP-T3, GAP-P1, GAP-P2

- [x] **T3.1** 建立 `scoring/coach/types.ts`：定义 `CoachDiagnoseOptions`、`CoachDiagnosisReport`，字段与 spec/plan 完全一致。
- [x] **T3.2** 建立 `scoring/coach/loader.ts`：实现 `loadRunRecords(runId)`，兼容 `{runId}.json` 与 `scores.jsonl`。
- [x] **T3.3** 在 `scoring/coach/diagnose.ts` 实现 `coachDiagnose(runId, options?)` 主流程，完成 run_id 加载、记录分组与异常处理（`run_not_found`）。
- [x] **T3.4** 在 `scoring/coach/format.ts` 实现 `formatToMarkdown(report)`，并在 `index.ts` 导出 JSON + Markdown 两种输出能力。
- [x] **T3.5** 集成测试：给定包含 veto 与 Epic veto 的 scoring 样本，断言 `coachDiagnose` 调用了 `applyTierAndVeto`、`evaluateEpicVeto` 且输出 schema 完整。

---

## Phase 4：一票否决与 iteration_passed（T4）

**AC**: #4, #6  
**覆盖 Gap**: GAP-1.6, GAP-T4

- [x] **T4.1** 在 `diagnose.ts` 实现 `iteration_passed` 判定：`!epicVeto.triggered && 所有 story record 的 veto_triggered=false && 无致命 phase_score=0 条件`。
- [x] **T4.2** 判定逻辑与 `scoring/docs/VETO_AND_ITERATION_RULES.md` §3.4.2 对齐，并在注释或文档中标注公式来源。
- [x] **T4.3** 单元 + 集成测试覆盖：环节 veto 触发、Epic veto 触发、全通过三类场景；确保 `iteration_passed=false` 时可被上层流程识别为迭代不达标。

---

## Phase 5：禁止表述校验（T5）

**AC**: #5  
**覆盖 Gap**: GAP-1.7, GAP-T5, GAP-P3

- [x] **T5.1** 新建 `scoring/coach/forbidden-words.yaml`，维护主导表述（面试、面试官、应聘、候选人）与模糊表述列表。
- [x] **T5.2** 在 `scoring/coach/forbidden.ts` 实现 `loadForbiddenWords` 与 `validateForbiddenWords`：主导表述命中报错拒绝；模糊表述命中告警记录。
- [x] **T5.3** 测试与验收脚本：构造通过/不通过样本，断言禁止词检测行为符合 spec §2.7。

---

## Phase 6：CLI 触发、集成与端到端验收（T6）

**AC**: #3  
**覆盖 Gap**: GAP-1.5, GAP-T6, GAP-P5, GAP-P6

- [x] **T6.1** 新建 `scripts/coach-diagnose.ts`，支持 `--run-id`、`--format=json|markdown`；在 `package.json` 增加 `coach:diagnose` 命令。
- [x] **T6.2** 在 `scoring/coach/README.md`（或 Story 文档）补充触发时机、配置项、错误码与示例命令。
- [x] **T6.3（集成测试）** 新建 `scoring/coach/__tests__/coach-integration.test.ts` 与 `scripts/accept-e4-s2.ts`，验证生产关键路径可导入并调用 `coachDiagnose`，且与 veto 结果一致。
- [x] **T6.4（端到端测试）** 执行 `accept-e4-s2.ts` 进行 E2E 验收：同一 run_id 输出 JSON/Markdown，两种格式字段齐全且禁止词校验通过。

---

## Phase 7：Manifest 入驻与路由防御（T7）

**AC**: #2, #3  
**覆盖 Gap**: GAP-MANIFEST-1, GAP-MANIFEST-2, GAP-MANIFEST-3, GAP-MANIFEST-4

- [x] **T7.1** 更新 `_bmad/_config/agent-manifest.csv`：新增 `ai-coach` 条目，设置 `module=scoring`（或 `eval`），并将 capabilities 限制为 scoring 数据分析/短板诊断/改进建议；禁止包含 code review / audit 执行能力。
- [x] **T7.2** 新建 `_bmad/scoring/agents/ai-coach.md`：将 `scoring/coach/AI_COACH_DEFINITION.md` 转换为 agent Persona，包含 `role`、`identity`、`communication_style`、`principles`，并写入“无 run_id 或无 scoring 数据时拒绝分析”的防御条款。
- [x] **T7.3** 修改 `scoring/coach/diagnose.ts`：实现 persona 外部加载（manifest 或 `ai-coach.md`），替代完整硬编码 prompt，并在加载失败时回退到最小安全模板。
- [x] **T7.4** 更新 `_bmad/core/agents/bmad-master.md`（及相关路由）：加入 module 级防御，`scoring` agent 不进入常规 `/bmad ask` 清单，仅在显式指定或 `coachDiagnose` 专属链路可调用。

---

## 验收表头（按 Gap 逐条验证）

| Gap ID | 对应任务 | 生产代码实现要点 | 集成/端到端要求 | 执行情况 | 验证通过 |
|--------|----------|------------------|-----------------|----------|----------|
| GAP-1.1, GAP-1.2 | T1.1–T1.3 | `AI_COACH_DEFINITION.md` 完整产出 | 文档自检清单通过 | [ ] | [ ] |
| GAP-BMAD-1 | T1.1, T1.2 | persona 四维结构对齐 BMAD agent | 文档结构核对通过 | [ ] | [ ] |
| GAP-1.3 | T2.1–T2.4 | config + fallback 生效 | fallback 测试通过 | [ ] | [ ] |
| GAP-1.4 | T3.1–T3.3 | `coachDiagnose` + loader | run_id 正常/异常路径通过 | [ ] | [ ] |
| GAP-1.5 | T3.4, T6.4 | JSON/Markdown 双格式输出 | E2E 双格式校验通过 | [ ] | [ ] |
| GAP-1.6 | T4.1–T4.3 | iteration_passed 与 veto 联动 | 集成测试通过 | [ ] | [ ] |
| GAP-1.7 | T5.1–T5.3 | 禁止词加载与校验 | 通过/阻断样本验证通过 | [ ] | [ ] |
| GAP-T6, GAP-P5, GAP-P6 | T6.1–T6.4 | CLI + accept 脚本 | 关键路径导入与 E2E 通过 | [ ] | [ ] |
| GAP-MANIFEST-1 | T7.1 | manifest 新增 ai-coach 且能力边界受限 | manifest 字段核对通过 | [x] | [x] |
| GAP-MANIFEST-2 | T7.2 | ai-coach persona 文件创建并与定义文档一致 | Persona 结构核对通过 | [x] | [x] |
| GAP-MANIFEST-3 | T7.3 | diagnose 使用外部 persona 来源 | 单测/集成测试通过 | [x] | [x] |
| GAP-MANIFEST-4 | T7.4 | 路由防御生效，常规 ask 不暴露 scoring agent | 路由行为验证通过 | [x] | [x] |

---

## 可执行验收命令（实现后执行）

```bash
npm test -- scoring/coach/__tests__/loader.test.ts
npm test -- scoring/coach/__tests__/forbidden.test.ts
npm test -- scoring/coach/__tests__/diagnose.test.ts
npm test -- scoring/coach/__tests__/coach-integration.test.ts
npx ts-node scripts/accept-e4-s2.ts --run-id=sample-run --format=json
npx ts-node scripts/accept-e4-s2.ts --run-id=sample-run --format=markdown
npm run coach:diagnose -- --run-id=sample-run --format=json
rg "coachDiagnose|formatToMarkdown" scripts scoring
rg "applyTierAndVeto|evaluateEpicVeto" scoring/coach
rg "ai-coach" _bmad/_config/agent-manifest.csv
rg "role|identity|communication_style|principles" _bmad/scoring/agents/ai-coach.md
rg "scoring|ai-coach" _bmad/core/agents/bmad-master.md
```

---

## 执行顺序

1. T1（文档与 persona）  
2. T2（配置与 fallback）  
3. T3（主流程与输出）  
4. T4（iteration_passed 与 veto 联动）  
5. T5（禁止词校验）  
6. T6（CLI、集成、端到端）
7. T7（Manifest 入驻与路由防御）

**检查点**：
- 完成 T3 后：`coachDiagnose` 基本可运行，输出 schema 可校验。  
- 完成 T4+T5 后：逻辑判定与合规校验闭环完成。  
- 完成 T6 后：生产关键路径集成与端到端验收闭环完成。
