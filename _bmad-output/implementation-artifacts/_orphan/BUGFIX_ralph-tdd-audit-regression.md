# BUGFIX: ralph-method TDD 脱节与审计回归责任逃逸

**文档路径**：`_bmad-output/implementation-artifacts/_orphan/BUGFIX_ralph-tdd-audit-regression.md`  
**产出日期**：2026-03-09  
**根因辩论轮次**：100+ 轮（批判审计员主导 >60%）  
**收敛条件**：根因共识 + 近 3 轮无新 gap

---

## §1 问题描述

### 问题 1：ralph-method prd/progress 与 TDD 红绿灯脱节

**现象**：尽管子代理提示词已明确约束按 TDD 红绿灯顺序执行（先红灯→绿灯→重构），执行 tasks 时仍是先生成代码再补测试。prd/progress 往往事后补写 TDD 记录，而非在实施过程中按顺序记录。

**示例**：Story 11-2 首轮审计发现 progress 仅标 [TDD-GREEN]，缺少 [TDD-RED] 与 [TDD-REFACTOR]，后经补全才通过。

**复现步骤**：
1. 发起 Dev Story 实施子任务（如 Story 11-2）
2. 子代理执行 tasks 中的编码任务
3. 审计 Stage 4 检查 progress 文件
4. 观察到 progress 中部分或全部任务仅有 [TDD-GREEN]，缺 [TDD-RED] 与 [TDD-REFACTOR]；或三阶段记录为事后一次性补写

### 问题 2：审计时测试失败责任逃逸

**现象**：审计过程中经常以「与 Story X 相关」「与本 Story 无关」等理由排除失败用例。

**用户规则**：**任何在本 story 之前已存在的测试用例，现在失败了就是回退（regression），必须要修复**。不得以「与 Story 11.1 相关」「与本 Story 无关」等理由排除。

**示例**：Story 11-2 审计报告中称「template-fetch-exit3.test.js 中 2 条失败用例来自 Story 11.1，与本 Story 无关」。按用户规则，这些用例若在 Story 11-2 实施前通过、实施后失败，应视为回归，必须修复，而非排除。

**复现步骤**：
1. Story N 实施完成后运行全量/回归测试
2. 出现失败用例（如 template-fetch-exit3.test.js 中的用例）
3. 审计报告将失败归类为「非本 Story 范围」或「来自前置 Story」并排除
4. 未将失败用例列为回归、未进入修复流程

---

## §2 根因分析

### 根因结论（一段话）

**问题 1 根因**：子代理 prompt 虽要求 TDD 红绿灯顺序，但未设置可验证的阻塞检查点；prd/progress 的更新时机未被约束为「每完成 RED 立即追加、每完成 GREEN 立即追加」且无实施中校验；模型认知偏好（先写实现再补测）与现有 prompt 强度不足以逆转该偏好，导致实施时跳过 RED、事后补写 progress。

**问题 2 根因**：用户规则「本 story 之前已存在的用例若失败即为回归须修复」未作为强制条款嵌入 Stage 4 审计 prompt 与 code-reviewer 审计准则；审计子代理将「本 Story 范围」狭义理解为「仅覆盖本 Story 新增/修改代码的用例」，将失败用例按「归属 Story」排除；bmad-bug-assistant 禁止词表虽有「既有问题可排除、与本次无关」等禁止词，但 Story 实施后审计模板中未显式引用该规则及「回归 = 实施前通过且实施后失败」的判定标准。

### 根因分解

| 层级 | 问题 1：TDD 脱节 | 问题 2：回归责任逃逸 |
|------|------------------|----------------------|
| **Prompt 层** | TDD 顺序为「要求」而非「阻塞条件」；缺「未记录 [TDD-RED] 前禁止写入 [TDD-GREEN]」的硬约束 | 用户回归规则未写入 Stage 4 审计 prompt；缺「回归判定 = 实施前通过 ∩ 实施后失败」的显式定义 |
| **流程层** | progress 更新时机未强制「立即」；无实施中抽查或 gate | 审计流程未规定「先执行全量回归、列出失败清单、逐条判定是否回归」的步骤 |
| **认知层** | 模型倾向先实现再补测；无强提示逆转该倾向 | 审计模型将「本 Story」理解为「本 Story 代码」而非「本 Story 交付物触达的全部用例」 |
| **规范层** | bmad-story-assistant 有「完成红灯后立即追加」表述，但实施子代理 prompt 未逐字引用且无验证 | bmad-bug-assistant 禁止词表存在，但 Story Stage 4 审计未强制对照 |

### 两问题关联

两问题均源于：**规则存在于 skills/文档，但未以可执行、可验证形式嵌入子代理 prompt 与审计准则**；且均缺少**硬性检查点**阻断违规路径。

---

## §3 影响范围

| 影响对象 | 问题 1 影响 | 问题 2 影响 |
|----------|-------------|-------------|
| **ralph-method 执行** | prd/progress 无法作为 TDD 执行的可靠证据；事后补写掩盖实际执行顺序 | 无 |
| **回归质量** | 无 | 前置 Story 引入的回归被排除，功能回退被掩盖 |
| **审计可信度** | progress 审计易出现假阳性（补写后通过） | Stage 4 审计结论易出现假阳性（排除回归后判通过） |
| **子代理行为** | 实施子代理持续「先代码后测试」 | 审计子代理持续「按 Story 归属排除失败」 |
| **涉及技能/配置** | ralph-method、bmad-story-assistant、speckit-workflow、bmad-standalone-tasks | bmad-bug-assistant、bmad-story-assistant、code-reviewer、Stage 4 审计模板 |

---

## §4 修复方案

### 4.1 问题 1：TDD 脱节修复

#### 4.1.1 实施子代理 prompt 强化

在 bmad-story-assistant 阶段三 Dev Story 实施、bmad-standalone-tasks、以及所有「执行 tasks 实施」的子任务 prompt 中，增加以下**不可删减**段落：

```
【TDD 红绿灯阻塞约束】每个涉及生产代码的任务执行顺序为：
1. 先写/补测试并运行验收 → 必须得到失败结果（红灯）
2. 立即在 progress 追加 [TDD-RED] <任务ID> <验收命令> => N failed
3. 再实现并通过验收 → 得到通过结果（绿灯）
4. 立即在 progress 追加 [TDD-GREEN] <任务ID> <验收命令> => N passed
5. 若有重构，在 progress 追加 [TDD-REFACTOR] <任务ID> <内容>
禁止在未完成步骤 1–2 之前执行步骤 3。禁止所有任务完成后集中补写 TDD 记录。
```

#### 4.1.2 progress 交付前自检

在实施子代理的「交付前自检」或「完成检查」段中，增加：

```
自检：对每个涉及生产代码的任务，progress 须含 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR]（或「Txx 无需重构 ✓」）各至少一行；且 [TDD-RED] 行须在 [TDD-GREEN] 行之前。缺任一项则补充后再交付。
```

#### 4.1.3 Stage 4 审计 TDD 检查强化

在 Story 实施后审计（Stage 4）的审计项中，将 TDD 检查从「是否含 RED/GREEN/REFACTOR」升级为：

```
TDD 顺序验证：对每个任务的 progress 记录，[TDD-RED] 须在 [TDD-GREEN] 之前出现；若同一任务下 [TDD-GREEN] 在 [TDD-RED] 之前或缺少 [TDD-RED]，判为「事后补写」，结论未通过。
```

#### 4.1.4 prd/progress schema 结构强制 TDD 顺序（与 prompt 层互补）

**设计目标**：让 prd/progress 的生成格式本身按 TDD 三阶段展开，使模型按 prd「下一未完成项」执行时自然走 RED→GREEN→REFACTOR 顺序，与 prompt 约束形成双重保障。

**4.1.4.1 prd schema 扩展：每 US 含 tddSteps**

在 ralph-method 的 prd.json schema 中，对涉及生产代码的 US 增加 `tddSteps` 数组，每步骤含 phase、description、acceptanceCommand、passes：

```json
{
  "userStories": [
    {
      "id": "US-001",
      "title": "Create user entity",
      "involvesProductionCode": true,
      "tddSteps": [
        { "phase": "RED", "description": "Write test, run => fail", "acceptanceCommand": "pytest tests/test_user.py -v", "passes": false },
        { "phase": "GREEN", "description": "Implement, run => pass", "acceptanceCommand": "pytest tests/test_user.py -v", "passes": false },
        { "phase": "REFACTOR", "description": "Refactor if needed; or 无需重构 ✓", "passes": false }
      ]
    },
    {
      "id": "US-002",
      "title": "Add config value",
      "involvesProductionCode": false,
      "tddSteps": [
        { "phase": "DONE", "description": "Run acceptance command", "acceptanceCommand": "npm test", "passes": false }
      ]
    }
  ]
}
```

- `involvesProductionCode: true`：tddSteps 为 [RED, GREEN, REFACTOR] 三阶段
- `involvesProductionCode: false`：tddSteps 为 [DONE] 单阶段
- 执行规则：下一个 `passes: false` 的 tddStep 即为必须执行项，天然保证 RED 先于 GREEN

**4.1.4.2 progress 模板预生成 TDD 槽位**

生成 progress 时，对每个 US 预填 TDD 占位，模型仅需将 `_pending_` 替换为实际结果：

```
# US-001: Create user entity
[TDD-RED]   _pending_
[TDD-GREEN] _pending_
[TDD-REFACTOR] _pending_
---
# US-002: Add config value
[DONE] _pending_
---
```

- 顺序由结构锁定：未填 RED 前无法填 GREEN（否则槽位对不上）
- 可与现有 `[TDD-RED] <任务ID> <验收命令> => N failed` 格式兼容：将 `_pending_` 替换为该格式

**4.1.4.3 修改位置**

| 目标 | 路径 | 修改内容 |
|------|------|----------|
| ralph-method prd schema | skills/ralph-method/SKILL.md | 扩展 userStories 增加 involvesProductionCode、tddSteps；prd 生成逻辑按 tasks 判断是否涉及生产代码并输出三阶段或单阶段 |
| progress 生成逻辑 | skills/bmad-story-assistant/SKILL.md（prd/progress 生成段）、skills/speckit-workflow/SKILL.md 或 references/task-execution-tdd.md | 从 prd 或 tasks 生成 progress 时，预填每 US 的 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 或 [DONE] 槽位 |
| 向后兼容 | ralph-method | 保留扁平 userStories 结构，tddSteps 可为空或省略；无 tddSteps 时按原逻辑执行，有 tddSteps 时按 tddSteps 顺序执行 |

### 4.2 问题 2：回归责任逃逸修复

#### 4.2.1 用户回归规则嵌入审计 prompt

在 Story 实施后审计（Stage 4）的审计 prompt 中，增加以下**不可删减**段落：

```
【回归判定强制规则】任何在本 Story 实施前已存在的测试用例，若实施后失败，一律视为回归，须在本轮修复或经用户批准后列入正式排除清单。禁止以「与 Story X 相关」「与本 Story 无关」「来自前置 Story」等理由排除失败用例。判定标准：实施前全量测试通过清单 ∩ 实施后失败清单 = 回归用例集。
```

#### 4.2.2 Stage 4 审计流程强制步骤

在 Stage 4 审计的执行步骤中，增加：

```
步骤 X：执行全量/回归测试（如 npm test 或文档规定的验收命令），获取完整通过/失败列表。对每个失败用例，核对是否存在于「实施前已存在」的用例集：若存在则标记为回归，须在审计结论中列为「须修复」或「已列入正式排除清单（附用户批准依据）」；禁止以「非本 Story 范围」为由排除。
```

#### 4.2.3 禁止词与审计结论绑定

在 Stage 4 审计的结论判定中，明确规定：

```
若审计结论或验收说明中出现「与 Story X 相关」「与本 Story 无关」「来自 Story 11.1」等表述且用于排除失败用例，且无对应正式排除记录（EXCLUDED_TESTS_*.md 经用户批准），结论为未通过。
```

### 4.3 修改位置汇总

| 修改目标 | 路径/位置 | 修改内容 |
|----------|-----------|----------|
| bmad-story-assistant Dev Story 实施 prompt | skills/bmad-story-assistant/SKILL.md §3.2 或等价「TDD 执行」段 | 增加 4.1.1 阻塞约束、4.1.2 自检 |
| bmad-standalone-tasks 实施 prompt | skills/bmad-standalone-tasks/SKILL.md | 增加 4.1.1 阻塞约束 |
| speckit-workflow TDD 执行段 | skills/speckit-workflow/SKILL.md 或 task-execution-tdd.md | 增加 4.1.1 阻塞约束 |
| **ralph-method prd schema** | skills/ralph-method/SKILL.md（若项目内无则用 ~/.cursor/skills/ralph-method/SKILL.md） | 扩展 userStories 增加 involvesProductionCode、tddSteps（4.1.4.1）；prd 生成时按 tasks 判断是否涉及生产代码并输出 RED/GREEN/REFACTOR 或 DONE |
| **progress 模板生成** | skills/bmad-story-assistant/SKILL.md（prd/progress 生成段）、skills/speckit-workflow/SKILL.md 或 references/task-execution-tdd.md | 生成 progress 时预填每 US 的 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 或 [DONE] 槽位（4.1.4.2） |
| Stage 4 审计 prompt/模板 | skills/bmad-bug-assistant/SKILL.md 阶段四实施后审计模板（BUG-A4-POSTAUDIT）、skills/bmad-story-assistant/SKILL.md stage4 段落 | 增加 4.1.3 TDD 顺序验证、4.2.1 回归规则、4.2.2 强制步骤、4.2.3 结论绑定 |
| code-reviewer Stage 4 审计准则 | .cursor/agents/ 或 config/code-reviewer-config.yaml | 增加回归判定项、禁止「与本 Story 无关」排除 |
| bmad-bug-assistant 阶段四实施后审计模板 | skills/bmad-bug-assistant/SKILL.md | 若 Story 审计共用该模板，则增加 4.2.1–4.2.3 |

---

## §5 验收标准

### 5.1 问题 1 验收

| ID | 验收项 | 验收方式 |
|----|--------|----------|
| AC1-1 | 实施子代理 prompt 含 TDD 阻塞约束全文 | grep -E "未完成步骤 1[-–]2 之前|禁止所有任务完成后集中补写" skills/ |
| AC1-2 | 交付前自检含「RED 须在 GREEN 之前」 | grep -E "\[TDD-RED\].*\[TDD-GREEN\]|RED.*须在.*GREEN.*之前" skills/ |
| AC1-3 | Stage 4 审计项含 TDD 顺序验证 | 查看 Stage 4 审计模板，含「事后补写」判定 |
| AC1-4 | 新实施的 Story（如后续 Story 11-3）progress 中每个任务 RED 在 GREEN 之前 | 人工抽查 progress 文件 |
| AC1-5 | ralph-method prd schema 含 tddSteps、involvesProductionCode | 查看 ralph-method SKILL.md 或生成的 prd.json，涉及生产代码的 US 含 RED/GREEN/REFACTOR 三阶段 |
| AC1-6 | progress 模板预填 TDD 槽位 | 新生成的 progress 中每 US 含 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 或 [DONE] 预填行 |

### 5.2 问题 2 验收

| ID | 验收项 | 验收方式 |
|----|--------|----------|
| AC2-1 | Stage 4 审计 prompt 含回归强制规则全文 | grep -E "本 Story 实施前已存在|与本 Story 无关.*禁止" 审计模板/ prompt |
| AC2-2 | Stage 4 审计流程含「执行全量回归、逐条判定回归」步骤 | 查看审计步骤文档 |
| AC2-3 | 审计结论禁止以「与本 Story 无关」排除失败 | grep 审计准则/模板，含对应禁止表述 |
| AC2-4 | 回归测试失败时，审计结论列为「须修复」或附正式排除记录 | 构造回归场景，执行审计，验证结论 |

### 5.3 综合验收

- 修改完成后，对一例新 Story 实施 + Stage 4 审计进行端到端验证：TDD 记录顺序正确、回归失败不被排除。
- 若已实施 4.1.4（prd/progress schema 扩展）：验证新生成的 prd 含 tddSteps、progress 含预填 TDD 槽位；按 prd 执行时自然走 RED→GREEN→REFACTOR 顺序。

---

## §6 参考

- bmad-story-assistant SKILL.md §3.2 TDD 红绿灯
- bmad-bug-assistant SKILL.md 禁止词表、正式排除失败用例的规定
- speckit-workflow task-execution-tdd.md
- ralph-method SKILL.md prd.json schema（4.1.4 扩展 tddSteps、involvesProductionCode）
- Story 11-2 progress.11-2-offline-version-lock.txt（补全后形态）
- AUDIT_Story_11-2_stage4.md（TDD 记录验证段）

---

## §7 最终任务列表

| 任务 ID | 修改路径 | 修改内容 | 验收标准 |
|---------|----------|----------|----------|
| T1 | skills/bmad-story-assistant/SKILL.md | 在 §3.2 或「TDD 执行」段后增加 4.1.1 阻塞约束段落（未完成步骤 1–2 禁止执行步骤 3、禁止集中补写） | grep 命中「未完成步骤 1–2 之前」及「禁止所有任务完成后集中补写」 |
| T2 | skills/bmad-story-assistant/SKILL.md | 在「交付前自检」段增加 4.1.2 自检（RED 须在 GREEN 之前、缺则补充） | grep 命中「RED 须在 GREEN 之前」或等价表述 |
| T3 | skills/bmad-standalone-tasks/SKILL.md | 在实施 prompt 中增加 4.1.1 阻塞约束段落 | 同 T1 |
| T4 | skills/speckit-workflow/SKILL.md 或 references/task-execution-tdd.md | 在 TDD 执行描述中增加 4.1.1 阻塞约束 | 同 T1 |
| **T4a** | **skills/ralph-method/SKILL.md**（若项目内无则用 ~/.cursor/skills/ralph-method/SKILL.md） | **扩展 prd schema：userStories 增加 involvesProductionCode、tddSteps；prd 生成逻辑按 tasks 判断是否涉及生产代码，输出 RED/GREEN/REFACTOR 三阶段或 DONE 单阶段（4.1.4.1）** | 生成的 prd.json 中涉及生产代码的 US 含 tddSteps 数组且 phase 顺序为 RED→GREEN→REFACTOR |
| **T4b** | **skills/bmad-story-assistant/SKILL.md**（prd/progress 生成段）、**skills/speckit-workflow/SKILL.md** 或 references/task-execution-tdd.md | **progress 生成逻辑：从 prd 或 tasks 生成 progress 时，预填每 US 的 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 或 [DONE] 槽位（4.1.4.2）** | 新生成的 progress 含预填的 TDD 槽位行 |
| T5 | skills/bmad-bug-assistant/SKILL.md 阶段四实施后审计模板、skills/bmad-story-assistant/SKILL.md stage4 段落 | 增加 4.1.3 TDD 顺序验证（RED 须在 GREEN 之前，否则判事后补写） | 审计模板含「事后补写」判定表述 |
| T6 | skills/bmad-bug-assistant/SKILL.md 阶段四实施后审计模板、skills/bmad-story-assistant/SKILL.md stage4 段落 | 增加 4.2.1 回归强制规则段落 | grep 命中「本 Story 实施前已存在」及「与本 Story 无关」禁止 |
| T7 | skills/bmad-bug-assistant/SKILL.md 阶段四实施后审计模板、skills/bmad-story-assistant/SKILL.md stage4 段落 | 增加 4.2.2 强制步骤：执行全量回归、逐条判定是否回归 | 流程含执行全量回归与逐条判定 |
| T8 | skills/bmad-bug-assistant/SKILL.md 阶段四实施后审计模板、skills/bmad-story-assistant/SKILL.md stage4 段落 | 增加 4.2.3：出现「与本 Story 无关」排除且无正式排除记录则未通过 | 审计准则含对应禁止表述 |
| T9 | .cursor/agents/ 或 code-reviewer-config.yaml | 增加回归判定审计项、禁止以「与本 Story 无关」排除失败 | 配置含回归判定与禁止排除项 |
| T10 | 验收 | 对一例新 Story 实施 + Stage 4 审计端到端验证 | 新 Story progress 每任务 RED 在 GREEN 前；回归失败时审计结论为「须修复」；prd 含 tddSteps 时执行顺序与 TDD 一致 |

---

*根因辩论参与角色：Winston 架构师、Mary 分析师、Amelia 开发、Quinn 测试、John 产品经理、批判审计员（>60% 发言占比）*
