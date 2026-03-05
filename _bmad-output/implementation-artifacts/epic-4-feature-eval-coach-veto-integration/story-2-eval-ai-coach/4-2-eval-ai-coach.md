# Story 4.2：eval-ai-coach

Status: ready-for-dev

**Epic**：E4 feature-eval-coach-veto-integration  
**Story ID**：4.2  
**Slug**：eval-ai-coach

<!-- Note: 可执行 validate-create-story 进行质量检查后再进入 dev-story。 -->

## Story

As a 评测运营与模型研发团队，  
I want 引入 AI 代码教练角色，实现其定位、职责、人格、技能配置、工作流、输出格式及一票否决权，  
so that 全流程审计闭环有统一出口承载者，能精准定位能力短板、给出可落地的评测/优化方案，并作为迭代结束标准的判定依据之一。

---

## 1. Scope（范围）

### 1.1 本 Story 包含

1. **AI 代码教练定位与职责**
   - 定位：用资深工程师视角，还原真实工业级开发全流程，精准定位 AI 代码模型的能力短板，设计可落地的评测/优化方案；作为「现有全流程各审计闭环的重要输出和迭代结束标准」的承载者
   - 职责边界：解读评分、定位短板、给出改进方向；设计题池补充、权重调整、检查项细化等可落地方案（建议型，非直接执行）
   - 与全流程 Code Reviewer 的关系：非替代、非并列；教练消费 Reviewer（及全链路 Skill）的产出，不重复执行审计

2. **人格定义**：资深工程师视角、工业级标准、可落地导向；输出风格：精准、可执行、无模糊表述

3. **技能配置**
   - 引用全链路 Code Reviewer Skill（必引）；speckit-workflow、bmad-story-assistant 在 post_impl 阶段按配置引用
   - fallback：若全链路 Skill 不可用，可降级为「仅解读既有 scoring 存储中的已有数据」，不执行新审计

4. **工作流**
   - 与 BMAD 五层、六环节、迭代结束标准的衔接：教练在各 stage 审计完成且得分写入后可被触发
   - 输入：scoring 存储中 run_id 对应数据；可调用 Story 4.1 的 applyTierAndVeto、evaluateEpicVeto 辅助判定
   - 输出：综合诊断报告（含 summary、phase_scores、weak_areas、recommendations、iteration_passed）
   - 触发时机：手动触发（用户请求「对本轮迭代做教练诊断」）或阶段式触发（post_impl 完成后按配置决定是否自动触发）；默认不强制，由配置决定

5. **输出格式**：含 `summary`、`phase_scores`、`weak_areas`、`recommendations`、`iteration_passed` 等字段；支持 JSON 与 Markdown；与 §3.6 schema 兼容

6. **一票否决权**：教练输出 `iteration_passed: false` 时，对全流程迭代达标行使一票否决（见 VETO_AND_ITERATION_RULES.md §3.4.2）

7. **禁止表述**：教练产出不得以「面试」为主导；仅可保留「成果可用于对外能力说明等场景」等中性表述（REQUIREMENTS §3.14）

### 1.2 本 Story 不包含

- 一票否决项与环节映射、多次迭代阶梯式扣分、Epic 级 veto 判定逻辑：由 Story 4.1 实现；本 Story 调用 4.1 导出的 applyTierAndVeto、evaluateEpicVeto
- 全链路 Skill 定义、Layer1-3 解析、scoring 写入：由 Story 3.1、3.2、3.3 实现
- 场景区分、BMAD 五层集成、数据污染防护：由 Story 4.3 实现；epics.md 已规划 4.3（待 Create Story 后）
- 权威文档 SCORING_CRITERIA_AUTHORITATIVE.md 产出：由 Story 2.2 实现

---

## 2. Acceptance Criteria（验收标准）

| AC | 验收标准 | 验证方式 |
|----|----------|----------|
| AC-1 | AI 代码教练定位、职责、人格定义明确，与 REQUIREMENTS §3.14 一致 | 文档或代码注释；与 §3.14 逐项对照 |
| AC-2 | 技能配置引用全链路 Skill；fallback 行为明确 | 配置或代码；单测或验收脚本覆盖 fallback 路径 |
| AC-3 | 工作流：输入 run_id/scoring 存储，输出含 summary、phase_scores、weak_areas、recommendations、iteration_passed | 单测或集成测试：给定 scoring 数据，断言输出格式符合 schema |
| AC-4 | 一票否决权：iteration_passed: false 时，全流程迭代不达标 | 逻辑或文档明确；可验证；与 VETO_AND_ITERATION_RULES.md 一致 |
| AC-5 | 教练产出无「面试」主导表述；仅有中性表述（如「成果可用于对外能力说明等场景」） | 全文检索教练产出；禁止词表校验 |
| AC-6 | 教练可调用 Story 4.1 的 applyTierAndVeto、evaluateEpicVeto 辅助 iteration_passed 判定 | 集成测试或验收脚本：给定含 veto/Epic veto 的 scoring 数据，教练输出正确 |

---

## 3. Tasks / Subtasks

- [x] **T1** 教练定位、职责、人格文档化（AC: #1）
  - [x] T1.1 在 scoring/coach/ 或 scoring/docs 下编写 AI_COACH_DEFINITION.md：定位、职责、人格、与全链路 Skill 的关系；与 REQUIREMENTS §3.14 逐项对照
  - [x] T1.2 验收：文档存在且含指定要点；禁止词表合规

- [x] **T2** 技能配置与 fallback（AC: #2）
  - [x] T2.1 定义教练 Skill 或配置：引用 bmad-code-reviewer-lifecycle；配置项控制 post_impl 是否自动触发
  - [x] T2.2 实现 fallback 逻辑：全链路 Skill 不可用时，仅读取既有 scoring 存储并解读，不执行新审计
  - [x] T2.3 单测或验收脚本：mock 全链路 Skill 不可用，断言 fallback 路径输出正确

- [x] **T3** 工作流与输出格式（AC: #3, #6）
  - [x] T3.1 实现 `coachDiagnose(runId, options?)` 或等效入口：输入 run_id，从 scoring 存储加载数据
  - [x] T3.2 调用 Story 4.1 的 applyTierAndVeto、evaluateEpicVeto 辅助判定环节级 veto 与 Epic 级 veto
  - [x] T3.3 输出 schema：summary、phase_scores、weak_areas、recommendations、iteration_passed；支持 JSON 与 Markdown
  - [x] T3.4 单测或集成测试：给定 scoring 数据（含 check_items、iteration_count、storyRecords），断言输出格式与内容符合 schema

- [x] **T4** 一票否决权执行（AC: #4）
  - [x] T4.1 实现 iteration_passed 判定逻辑：结合环节级 veto、Epic 8 项、环节得分与阶梯系数，输出 iteration_passed 布尔值
  - [x] T4.2 与 scoring/docs/VETO_AND_ITERATION_RULES.md 一致；iteration_passed: false 时，全流程迭代不达标
  - [x] T4.3 验收：文档或代码注释明确；可验证

- [x] **T5** 禁止表述校验（AC: #5）
  - [x] T5.1 定义教练产出禁止词表：「面试」「面试官」「应聘」「候选人」等主导表述
  - [x] T5.2 实现校验：教练产出（summary、recommendations 等）全文检索禁止词；若有则报错或警告
  - [x] T5.3 验收脚本：给定样本产出，断言禁止词校验通过

- [x] **T6** CLI 或触发入口（AC: #3）
  - [x] T6.1 提供 CLI（如 `npm run coach:diagnose -- --run-id=xxx`）或 Cursor Task 触发方式
  - [x] T6.2 文档：触发时机（手动/阶段式）、配置项说明

---

## 4. PRD 追溯

| PRD 需求 ID | 本 Story 覆盖内容 |
|-------------|-------------------|
| REQ-3.5 | 角色一票否决权（AI 代码教练全流程级） |
| REQ-3.12~3.17 | AI 代码教练的定位、职责、人格、技能配置、工作流、输出格式、一票否决权 |
| §3.14 | AI 代码教练（AI Code Coach）整节 |
| §3.4.2 | 角色一票否决权（AI 代码教练） |

---

## 5. Architecture 约束

| 组件 | 约束 |
|------|------|
| 数据输入 | 消费 scoring 存储（Story 1.2 写入的 run_id 对应数据）；schema 含 phase_score、check_items、iteration_count、iteration_records、first_pass |
| 规则调用 | 调用 Story 4.1 的 applyTierAndVeto、evaluateEpicVeto；不重复实现 veto 判定逻辑 |
| 全链路 Skill | 引用 bmad-code-reviewer-lifecycle（SKILL.md）；fallback 时仅读既有数据 |
| 输出 | 与 §3.6 schema 兼容；支持 JSON 与 Markdown |

---

## 6. Dev Notes

### 6.1 技术栈与源树组件

- **语言**：TypeScript/Node，与 scoring 模块一致
- **scoring 存储**：scoring/data/、scoring/writer；RunScoreRecord、CheckItem 等类型
- **veto 模块**：scoring/veto/ 导出 applyTierAndVeto、evaluateEpicVeto、buildVetoItemIds；见 scoring/veto/README.md
- **全链路 Skill**：_bmad/skills/bmad-code-reviewer-lifecycle/SKILL.md
- **权威文档**：scoring/docs/SCORING_CRITERIA_AUTHORITATIVE.md §14；scoring/docs/VETO_AND_ITERATION_RULES.md

### 6.2 建议实现位置

- **教练模块**：scoring/coach/ 或 _bmad/skills/bmad-ai-coach/（视项目结构）
- **CLI**：scripts/coach-diagnose.ts 或等效
- **配置**：config/coach-trigger.yaml 或 scoring/coach/config.yaml

### 6.3 测试标准

- 单元测试覆盖：coachDiagnose 输出格式、iteration_passed 判定、fallback 路径、禁止词校验
- 集成测试：给定完整 scoring 数据，断言教练输出与 4.1 veto 模块一致
- 与 scoring/veto 无循环依赖

### 6.4 与 Story 4.1 的衔接

- 教练调用 applyTierAndVeto(record) 获取 phase_score、veto_triggered、tier_coefficient
- 教练调用 evaluateEpicVeto(input) 获取 Epic 8 项判定结果
- 结合上述结果与环节得分，输出 iteration_passed

### 6.5 禁止词表合规

本 Story 文档及产出物禁止使用：可选、可考虑、后续、先实现、后续扩展、待定、酌情、视情况、技术债。

### 6.6 Dev Agent Record 填写时机

`Agent Model Used` 占位在 Dev Story 实施阶段由子代理填写实际模型版本。

---

## 7. References

- [Source: docs/BMAD/REQUIREMENTS_AI代码评测体系_全流程审计闭环输出与迭代标准_需求分析.md#§3.14]
- [Source: _bmad-output/planning-artifacts/dev/architecture.ai-code-eval-system.md#§1.1 架构分层]
- [Source: scoring/docs/SCORING_CRITERIA_AUTHORITATIVE.md#§14]
- [Source: scoring/docs/VETO_AND_ITERATION_RULES.md]
- [Source: scoring/veto/README.md]

---

## Dev Agent Record

### Agent Model Used

gpt-5.3-codex-xhigh

### Debug Log References

- T2 RED/GREEN: `npm test -- scoring/coach/__tests__/diagnose.test.ts`
- T3 RED/GREEN: `npm test -- scoring/coach/__tests__/loader.test.ts`
- T4 RED/GREEN: `npm test -- scoring/coach/__tests__/diagnose.test.ts`
- T5 RED/GREEN: `npm test -- scoring/coach/__tests__/forbidden.test.ts`
- T6 RED/GREEN: `npm test -- scoring/coach/__tests__/coach-integration.test.ts`
- 验收命令：`npx ts-node scripts/accept-e4-s2.ts --run-id=sample-run --format=json|markdown`
- CLI 命令：`npm run coach:diagnose -- --run-id=sample-run --format=json`

### Completion Notes List

- 新增 `scoring/coach` 模块：types、config、loader、diagnose、forbidden、format、index、README、forbidden-words.yaml、AI_COACH_DEFINITION.md。
- `coachDiagnose` 复用 `scoring/veto` 的 `applyTierAndVeto` 与 `evaluateEpicVeto`，未重复实现 veto 规则。
- `iteration_passed` 判定公式已对齐 `scoring/docs/VETO_AND_ITERATION_RULES.md` §3.4.2，并补充来源注释。
- 新增 CLI 与验收脚本：`scripts/coach-diagnose.ts`、`scripts/accept-e4-s2.ts`，支持 JSON/Markdown 输出。
- 已完成单元、集成、端到端验收命令并通过；`npm run coach:diagnose` 在当前 npm 版本会打印参数解析警告，但命令执行通过。

### File List

- Added: `config/coach-trigger.yaml`
- Added: `scoring/coach/AI_COACH_DEFINITION.md`
- Added: `scoring/coach/types.ts`
- Added: `scoring/coach/config.ts`
- Added: `scoring/coach/loader.ts`
- Added: `scoring/coach/diagnose.ts`
- Added: `scoring/coach/forbidden.ts`
- Added: `scoring/coach/forbidden-words.yaml`
- Added: `scoring/coach/format.ts`
- Added: `scoring/coach/index.ts`
- Added: `scoring/coach/README.md`
- Added: `scoring/coach/__tests__/loader.test.ts`
- Added: `scoring/coach/__tests__/forbidden.test.ts`
- Added: `scoring/coach/__tests__/diagnose.test.ts`
- Added: `scoring/coach/__tests__/coach-integration.test.ts`
- Added: `scripts/coach-diagnose.ts`
- Added: `scripts/accept-e4-s2.ts`
- Updated: `package.json`
- Updated: `specs/epic-4/story-2-eval-ai-coach/tasks-E4-S2.md`
- Updated: `_bmad-output/implementation-artifacts/4-2-eval-ai-coach/prd.tasks-E4-S2.json`
- Updated: `_bmad-output/implementation-artifacts/4-2-eval-ai-coach/progress.tasks-E4-S2.txt`
---

*本 Story 实现 AI 代码教练，与 Story 3.3 的 scoring 写入及 4.1 的一票否决规则衔接，满足 REQUIREMENTS §3.14。*
