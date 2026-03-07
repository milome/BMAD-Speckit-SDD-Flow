---
name: bmad-story-assistant
description: |
  BMAD Story 助手：按 Epic/Story 编号执行完整的 Create Story → 审计 → Dev Story → 实施后审计 工作流。
  阶段零：在新项目/worktree 自动检测并补丁 party-mode 展示名优化（若 _bmad 存在且未优化）。
  使用 subagent 执行任务；审计步骤优先通过 Cursor Task 调度 code-reviewer（.claude/agents/ 或 .cursor/agents/），失败则回退 mcp_task generalPurpose。
  遵循 ralph-method、TDD 红绿灯、speckit-workflow 约束。主 Agent 禁止直接修改生产代码。
  **禁止因 Epic/Story 已存在即跳过 party-mode**：仅当用户明确说「已通过 party-mode 且审计通过」时方可跳过 Create Story；否则必须执行 Create Story，涉及方案选择或设计决策时进入 party-mode 至少 100 轮。
  适用场景：用户提供 Epic 编号与 Story 编号（如 4、1 表示 Story 4.1），需生成 Story 文档、通过审计、执行 Dev Story 并完成实施后审计。全程中文。
---

# BMAD Story 助手

## 快速决策指引

### 五层架构概览
```
Layer 1: 产品定义层 (Product Brief → 复杂度评估 → PRD → Architecture)
Layer 2: Epic/Story规划层 (create-epics-and-stories)
Layer 3: Story开发层 (Create Story → Party-Mode → Story文档)
Layer 4: 技术实现层 (嵌套speckit-workflow: specify→plan→GAPS→tasks→TDD)
Layer 5: 收尾层 (批量Push + PR自动生成 + 强制人工审核 + 发布)
```

### 何时使用本技能
- 需要从Product Brief开始完整的产品开发流程
- 需要PRD/Architecture的深度生成和Party-Mode讨论
- 需要进行Epic/Story的规划和拆分
- 需要在Story级别进行方案选择和设计决策

### 何时使用speckit-workflow
- 已明确技术实现方案，只需要详细执行
- 已有Story文档，需要转换为技术规格和代码
- 不需要产品层面的讨论和决策

### 两者关系
本技能包含speckit-workflow作为Layer 4的嵌套流程。
当执行到"阶段三：Dev Story实施"时，会自动触发speckit-workflow的完整流程。

---

本 skill 定义 **Create Story → 审计 → Dev Story → 实施后审计** 的完整工作流。Epic 编号与 Story 编号由用户或上下文提供，作为 skill 的输入参数。

## 强制约束

- **主 Agent 禁止直接生成 Story 文档**：阶段一 Create Story 产出的 Story 文档必须由 mcp_task 子代理产出；主 Agent 不得以「已有需求文档」「Epic 已明确」等为由跳过子代理并自行撰写 Story 文档。
- **主 Agent 禁止直接修改生产代码**：实施必须通过 mcp_task 子代理执行。
- **禁止因 Epic/Story 已存在即跳过 party-mode**：仅当用户**明确**说明「Story 已通过 party-mode 且审计通过，跳过 Create Story」时，方可跳过阶段一、二；否则，即使 Epic/Story 文档已存在（可能由简单 bmad 命令生成、未经 party-mode 深入讨论），**必须**执行 Create Story，并在涉及多方案或设计决策时进入 party-mode 至少 100 轮辩论。

---

## 输入参数

| 参数 | 说明 | 示例 |
|------|------|------|
| `epic_num` | Epic 编号 | 4 |
| `story_num` | Story 子编号（如 1 表示 Story 4.1） | 1 |

Story 完整标识为 `{epic_num}-{story_num}`，例如 Epic 4、Story 4.1 → `4-1`。用户可直接给出（如「4、1」），或从 sprint-status 等文档解析。

---

## § 禁止词表（Story 文档）

以下词不得出现在 Story 文档的产出中。阶段一产出、阶段二审计须引用本表；审计时若 Story 文档中存在任一词，结论为未通过。

| 禁止词/短语 | 替代方向 |
|-------------|----------|
| 可选、可考虑、可以考虑 | 明确写「采用方案 A」，并简述理由。 |
| 后续、后续迭代、待后续 | 若不做且功能在 Epic 范围内，须写明由哪个 Story 负责；禁止无归属排除。若不在产品范围，须引用 Epic/PRD 依据。若做则写清本阶段完成范围。 |
| 先实现、后续扩展、或后续扩展 | 本 Story 实现 X；Y 由 Story A.B 负责（A.B 须存在且 scope 含 Y，且表述须含 Y 的具体描述）。 |
| 待定、酌情、视情况 | 改为明确条件与对应动作（如「若 X 则 Y」）。 |
| 技术债、先这样后续再改 | 不在 Story 文档中留技术债；单独开 Story 或不在本次范围。 |
| 既有问题可排除、与本次无关、历史问题暂不处理、环境问题可忽略 | 在验收/审计结论、任务完成说明中出现且**无正式排除记录**时禁止；若有正式排除记录，可在记录中作客观描述但须带客观依据（如 issue 号、复现步骤）。 |

### Story 范围表述示例（推迟闭环）

**正确示例**：
> 本 Story 实现 use_adaptive_threshold=0 路径。use_adaptive_threshold 非零时的分支逻辑由 Story 5.6 负责。（审计时须验证 Story 5.6 存在且 scope 含该描述）

**错误示例**：
> 本 Story 先实现 use_adaptive_threshold=0 路径，或后续扩展。（禁止词：先实现、或后续扩展）
> 本 Story 实现 0 路径；其余由 Story 5.6 负责。（「其余」过于模糊，审计员无法验证）

**使用说明**：阶段一 Create Story 产出要求须引用本表或贴出上表精简版；阶段二 Story 文档审计须写「若 Story 文档存在本表任一词，结论为未通过」。阶段四实施后审计须写「若验收/审计结论中出现上表「失败排除」相关禁止词且无对应正式排除记录，结论为未通过」。

---

## 正式排除失败用例的规定（与 bmad-bug-assistant 保持一致）

**原则**：任何在本次验收/回归中出现的失败用例，均须在本轮内**修复**或**列入正式排除清单**并接受审计；不得以任何未记录、未审计的理由忽略失败。

**禁止自动生成**：审计子代理、实施子代理**禁止**自动创建或更新 EXCLUDED_TESTS_*.md 或类似排除清单文件。

**须先询问用户**：当验收/回归存在失败用例且拟列入正式排除时，主 Agent 或子代理必须**先向用户询问**「是否批准将以下用例列入正式排除清单」，用户明确批准后，方可创建或更新排除清单；若用户拒绝，必须进入修复流程，不得创建排除清单。

**排除记录路径（Story 用）**：`_bmad-output/implementation-artifacts/epic-{epic_num}-{epic-slug}/story-{epic_num}-{story_num}-{slug}/EXCLUDED_TESTS_{epic_num}-{story_num}.md`。必备字段与可接受/不可接受判定与 bmad-bug-assistant「正式排除失败用例的规定」一致（用例 ID、排除理由、客观依据、本 Story 标识、审计结论）。

---

## § 何时可跳过 party-mode 与 code-review 补偿规则

### 何时可跳过 party-mode（Create Story）

**唯一允许条件**：用户**明确**说明「Story 已通过 party-mode 且审计通过，跳过 Create Story」时，可跳过阶段一、二。

**禁止**：仅因 Epic/Story 文档已存在即跳过；可能由简单 bmad 命令生成、未经 party-mode 深入讨论的文档，**必须**执行 Create Story。

### party-mode 跳过时 code-review 补偿规则

当 party-mode 被跳过时，阶段二（Story 文档审计）需**补偿**缺失的深度，否则质量门控不足。

| 情形 | 阶段二严格度 | 理由 |
|------|--------------|------|
| 无 party-mode 产出物（story 目录下无 `DEBATE_共识_*`、`party-mode 收敛纪要` 等） | **strict** | 补偿缺失的 party-mode 深度；连续 3 轮无 gap + 批判审计员 >50% |
| 有 party-mode 产出物存在 | **standard** | 已有深度，验证即可；单次 + 批判审计员 |
| 用户显式要求 strict | **strict** | 以用户为准 |

**产出物检测**：主 Agent 在阶段二审计前，检查 story 目录是否存在 party-mode 产出物；若有且用户未强制 strict，则用 standard；若无或用户要求 strict，则用 strict。

---

## 使用示例

### 示例 1：完整流程（Epic 4、Story 4.1）

用户说：「使用 bmad story 助手，生成 Epic 4、Story 4.1，并执行完整流程。」

**sprint-status 要求**：若 sprint-status.yaml 不存在，须先运行 sprint-planning 或显式确认 bypass；否则不得发起 Create Story 子任务。

主 Agent 执行顺序：
0. （阶段零-前置）若 _bmad 存在且 party-mode 未做展示名优化，自动执行补丁
1. 发起 Create Story 子任务（epic_num=4, story_num=1）
2. 产出 `_bmad-output/implementation-artifacts/epic-4-*/story-4-1-<slug>/4-1-<slug>.md` 后，发起 Story 文档审计
3. 审计通过后，发起 Dev Story 实施子任务，传入 TASKS 或 BUGFIX 文档路径
4. 实施完成后，**必须**发起实施后审计（audit-prompts.md §5）（本步骤为必须，非可选）
5. 审计通过即流程结束

### 示例 2：仅 Create Story + 审计（Epic 3、Story 2）

用户说：「帮我创建 Story 3.2 并做审计。」

主 Agent 执行：
1. mcp_task 发起 Create Story（epic_num=3, story_num=2）
2. 产出 `3-2-<title>.md` 后发起审计子任务
3. 若未通过则修改文档并再次审计，直至通过

### 示例 3：从 sprint-status 解析后执行

用户说：「按 sprint-status 里的下一个 Story 执行 bmad story 助手。」

**sprint-status 要求**：此示例仅在 sprint-status.yaml 存在时可行；若不存在，须先运行 sprint-planning 或显式确认 bypass。

主 Agent 先读取 `_bmad-output/implementation-artifacts/sprint-status.yaml`，解析出下一待办 Story（如 `4-1`），再按示例 1 的流程执行，将 epic_num=4、story_num=1 代入各阶段的 prompt。

### 示例 4：仅 Dev Story（用户明确确认已通过 party-mode 且审计）

用户说：「Story 4-1 文档已存在，**已通过 party-mode 且审计通过**，请执行 Dev Story。」

主 Agent 方可跳过阶段一、二，直接发起 Dev Story 实施子任务，传入：
- Story 文档路径：`_bmad-output/implementation-artifacts/epic-4-*/story-4-1-*/*.md`
- TASKS 文档路径：（如 `_bmad-output/implementation-artifacts/epic-4-*/story-4-1-*/TASKS_4-1-*.md`）
- 项目根目录

实施完成后按阶段四发起实施后审计。

**注意**：若用户仅说「Story 已存在」而未明确「已通过 party-mode 且审计通过」，主 Agent **不得**跳过 Create Story；须执行阶段一（含 party-mode 100 轮辩论，若有方案选择或设计决策），再审计、再 Dev Story。

---

## 阶段零（前置）：展示名文件检查与自动优化

**说明**：本阶段为技术补丁，在 Layer 1 产品定义层之前执行。与下文的「阶段零：Layer 1产品定义层」区分：前者为展示名优化，后者为产品定义。

**触发时机**：用户在本项目或 worktree 首次使用本 skill 时，或用户明确要求「检查/优化展示名」时。

**前提**：项目内已安装 `_bmad`（`{project-root}/_bmad/` 存在）。

**检查逻辑**：
1. 读取 `{project-root}/_bmad/core/workflows/party-mode/steps/step-02-discussion-orchestration.md`（以 step-02 作为 party-mode 展示名优化状态的代表文件；若 step-02 已优化，推定 workflow.md 与 step-01 同步已优化）
2. 若 step-02 中**同时不含**字符串 `必须使用 **展示名` **与** `展示名 displayName`，则判定未优化

**执行动作**：对以下三个文件应用 `search_replace` 修改。若某文件不存在则跳过。若 `old_string` 与当前文件内容不完全一致，先读取文件再根据实际格式微调 `old_string` 后重试；仍失败则跳过并提示。

### 补丁 1：workflow.md

路径：`{project-root}/_bmad/core/workflows/party-mode/workflow.md`

```yaml
old_string: "[Load agent roster and display 2-3 most diverse agents as examples]"
new_string: |
  [Load agent roster and display 2-3 most diverse agents as examples. 介绍时必须使用展示名（displayName），与 `docs/BMAD/Cursor_BMAD_多Agent使用指南.md` 及 `_bmad/_config/agent-manifest.csv` 一致。示例：Winston 架构师、Amelia 开发、Mary 分析师、John 产品经理、BMad Master、Quinn 测试、Paige 技术写作、Sally UX、Barry Quick Flow、Bond Agent 构建、Morgan Module 构建、Wendy Workflow 构建、Victor 创新策略、Dr. Quinn 问题解决、Maya 设计思维、Carson 头脑风暴、Sophia 故事讲述、Caravaggio 演示、Murat 测试架构、批判性审计员。]
```

### 补丁 2：step-01-agent-loading.md

路径：`{project-root}/_bmad/core/workflows/party-mode/steps/step-01-agent-loading.md`

修改 A：
```yaml
old_string: "- **displayName** (agent's persona name for conversations)"
new_string: "- **displayName** (agent's persona name for conversations；中文语境下使用 展示名，如 Mary 分析师、Winston 架构师，参考 `docs/BMAD/Cursor_BMAD_多Agent使用指南.md`)"
```

修改 B：
```yaml
old_string: "[Display 3-4 diverse agents to showcase variety]:

- [Icon Emoji] **[Agent Name]** ([Title]): [Brief role description]
- [Icon Emoji] **[Agent Name]** ([Title]): [Brief role description]
- [Icon Emoji] **[Agent Name]** ([Title]): [Brief role description]"
new_string: "[Display 3-4 diverse agents to showcase variety；使用 展示名 标注，如 Winston 架构师、Amelia 开发、Mary 分析师]:

- [Icon Emoji] **[展示名 displayName]** ([Title]): [Brief role description]
- [Icon Emoji] **[展示名 displayName]** ([Title]): [Brief role description]
- [Icon Emoji] **[展示名 displayName]** ([Title]): [Brief role description]"
```

### 补丁 3：step-02-discussion-orchestration.md

路径：`{project-root}/_bmad/core/workflows/party-mode/steps/step-02-discussion-orchestration.md`

修改 A（Response Structure）：
```yaml
old_string: "**Response Structure:**
[For each selected agent]:

\"[Icon Emoji] **[Agent Name]**: [Authentic in-character response]

[Bash: .claude/hooks/bmad-speak.sh \\\"[Agent Name]\\\" \\\"[Their response]\\\"]\""
new_string: "**Response Structure:**
[For each selected agent]:
- 必须使用 **展示名（displayName）** 标注发言角色，与 `_bmad/_config/agent-manifest.csv` 及 `docs/BMAD/Cursor_BMAD_多Agent使用指南.md` 一致。
- 展示名示例：BMad Master、Mary 分析师、John 产品经理、Winston 架构师、Amelia 开发、Bob Scrum Master、Quinn 测试、Paige 技术写作、Sally UX、Barry Quick Flow、Bond Agent 构建、Morgan Module 构建、Wendy Workflow 构建、Victor 创新策略、Dr. Quinn 问题解决、Maya 设计思维、Carson 头脑风暴、Sophia 故事讲述、Caravaggio 演示、Murat 测试架构、批判性审计员。

\"[Icon Emoji] **[展示名 displayName]**: [Authentic in-character response]

[Bash: .claude/hooks/bmad-speak.sh \\\"[展示名 displayName]\\\" \\\"[Their response]\\\"]\""
```

修改 B（Cross-Talk）：
```yaml
old_string: "- Agents can reference each other by name: \"As [Another Agent] mentioned...\""
new_string: "- Agents can reference each other by 展示名: \"As [Another Agent 展示名] mentioned...\"（如「正如 Winston 架构师 所说…」）"
```

修改 C（Question Handling）：
```yaml
old_string: "- Clearly highlight: **[Agent Name] asks: [Their question]**"
new_string: "- Clearly highlight: **[展示名 displayName] asks: [Their question]**（如 **Amelia 开发 asks: …**）"
```

修改 D（Moderation）：
```yaml
old_string: "- If discussion becomes circular, have bmad-master summarize and redirect"
new_string: "- If discussion becomes circular, have BMad Master 总结并引导转向"
```

**执行顺序**：阶段零在阶段一之前执行；若检测到未优化则先完成补丁，再继续后续阶段。若 `_bmad` 不存在，跳过阶段零并提示用户安装 BMAD。

**新 worktree 检测与 _bmad 定制迁移提示**：
- 若检测到当前为新 worktree（例如 cwd 为与项目根平级的 worktree 目录如 `{repo名}-{branch}`，或 `_bmad` 为全新安装），且 `_bmad-output/bmad-customization-backups/` 存在备份，则提示用户：
  > 检测到当前为新 worktree。若需恢复 _bmad 定制，可运行：`python {SKILLS_ROOT}/bmad-customization-backup/scripts/apply_bmad_backup.py --backup-path "{最新备份路径}" --project-root "{当前项目根}"`。最新备份路径为 `_bmad-output/bmad-customization-backups/` 下按时间戳排序的最新目录。
- 若无备份，不提示。

---

### 产出路径约定

**pre-speckit 产出（按 branch 子目录）**：
| 产出 | 路径 |
|------|------|
| Epic/Story 规划 | `_bmad-output/planning-artifacts/{branch}/epics.md` |
| 就绪报告 | `_bmad-output/planning-artifacts/{branch}/implementation-readiness-report-{date}.md` |
| prd（planning 级） | `_bmad-output/planning-artifacts/{branch}/prd.{ref}.json` |
| 架构设计 | `_bmad-output/planning-artifacts/{branch}/architecture.{ref}.md` 或 `ARCH_*.md` |

**branch 解析**：`git rev-parse --abbrev-ref HEAD`；若为 `HEAD` 则 `detached-{short-sha}`；`/` 替换为 `-`。
**归档**：`--archive` 时先复制到 `_archive/{branch}/{date}-{seq}/` 再写入。

**post-speckit 产出（入 story 子目录）**：
| 产出 | 路径 |
|------|------|
| Story 文档 | `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/{epic}-{story}-{slug}.md` |
| TASKS | `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/TASKS_{epic}-{story}-{slug}.md` |
| prd、progress | `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/prd.{ref}.json`、`progress.{ref}.txt` |
| DEBATE 共识 | `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/DEBATE_共识_{slug}_{date}.md` |
| 跨 Story DEBATE | `_bmad-output/implementation-artifacts/_shared/DEBATE_共识_{slug}_{date}.md` |

**子目录创建**：Create Story 产出时，若 `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/` 不存在，须先创建。子目录由 create-new-feature.ps1 -ModeBmad 在创建 spec 时同步创建，或由 bmad-story-assistant 在首次写入 Story 时创建。

---

## 阶段零：Layer 1产品定义层

**说明**：与上文的「阶段零（前置）：展示名文件检查与自动优化」区分：本阶段为产品定义层，包含 Product Brief、复杂度评估、PRD、Architecture。

在用户明确要创建新Epic或重大功能时，首先执行产品定义层。

### Step 1: Product Brief
创建或读取Product Brief文档，包含：
- 产品概述和目标
- 目标用户群体
- 核心价值和差异化
- 成功指标

### Step 2: 复杂度评估
填写三维复杂度评估问卷：
```yaml
业务复杂度 (1-5分):
  - 领域知识: [熟悉(1分)/部分新(3分)/全新(5分)]
  - 利益相关方数量: [≤2(1分)/3-5(3分)/>5(5分)]
  - 合规要求: [无(1分)/一般(3分)/严格(5分)]

技术复杂度 (1-5分):
  - 技术栈: [现有(1分)/部分新(3分)/全新(5分)]
  - 架构挑战: [无(1分)/中等(3分)/高并发大数据(5分)]
  - 集成难度: [独立(1分)/少量依赖(3分)/复杂网络(5分)]

影响范围 (1-5分):
  - [单个Story(1分)/单个模块(3分)/跨模块(4分)/全系统(5分)]
```

**聚合公式（GAP-019 修复；GAP-071 修复）**：每维度取子项**最高分**（默认保守）或**平均分**（四舍五入）；**选择条件**：默认取最高分；若用户显式选择「乐观模式」则取平均分；总分 = 业务 + 技术 + 影响，范围 3~15。

### Step 3: PRD生成
根据总分决定PRD生成方式（GAP-004 修复：边界值归属规则）：

| 总分 | PRD生成方式 |
|------|-------------|
| ≤6分（含 6 分） | 直接生成PRD |
| 7-10分（含 7、10 分） | 50轮Party-Mode后生成 |
| 11-15分（含 11、15 分） | 80轮Party-Mode后生成 |
| 15分（满分） | 80轮Party-Mode + 外部专家Review；（**GAP-081 修复**：总分范围 3~15，无 >15；满分 15 时触发）；（GAP-038 修复：专家来源可为项目内资深架构师或外部顾问，输出格式为「Review 意见 + 通过/有条件通过/不通过」） |

PRD必须包含：
- 详细需求列表（带ID）
- 验收标准
- 优先级排序
- 依赖关系

### Step 4: Architecture生成（如需）
当总分≥7分时，需要生成Architecture文档：
- 技术架构图
- 模块划分和接口定义
- 技术选型及Tradeoff分析（使用ADR格式）
- 安全和性能考量

Architecture Party-Mode角色（GAP-020 修复：与 Plan Party-Mode 差异说明）：
- 系统架构师、性能工程师、安全架构师、运维工程师、成本分析师、批判审计员
- Plan 阶段偏技术方案，Architecture 阶段偏架构决策，角色可复用；若项目有专门架构师可扩展

### 阶段零产出
- Product Brief文档
- 复杂度评估结果
- PRD文档（含需求追溯表）
- Architecture文档（如需要）

---

## Layer 2 Epic/Story规划层

在执行Create Story之前，先进行Epic/Story规划。

### create-epics-and-stories

基于PRD和Architecture文档，执行以下步骤：

1. **Epic定义**
   - 确定Epic边界和范围
   - 命名规范：`feature-{domain}-{capability}`
   - 估算Epic总体工作量

2. **Story拆分**
   - 按功能模块拆分Story
   - 每个Story可独立交付
   - 命名规范：`{epic_num}.{story_num} {description}`

3. **依赖关系分析**
   - 识别Story间的依赖关系
   - 生成依赖图（文本或图形）
   - 确定执行顺序

4. **粗粒度估算**
   - 每个Story的初步工作量估算
   - 识别高风险Story
   - 标记需要Spike的Story

### 产出物

1. **Epic列表**
   ```markdown
   | Epic ID | 名称 | 描述 | 预估工时 | 优先级 |
   |---------|------|------|---------|--------|
   | 4 | feature-metrics-cache | 指标缓存优化 | 80h | P0 |
   ```

2. **Story列表（粗粒度）**
   ```markdown
   | Story ID | 所属Epic | 描述 | 依赖 | 预估工时 | 风险 |
   |----------|---------|------|------|---------|------|
   | 4.1 | 4 | 基础缓存类实现 | 无 | 8h | 低 |
   | 4.2 | 4 | TTL机制实现 | 4.1 | 12h | 中 |
   ```

3. **依赖图**
   ```
   Story 4.1 ─┐
              ├─→ Story 4.3 ─→ Story 4.5
   Story 4.2 ─┘
   ```

### 进入阶段一的条件
- Epic和Story列表已完成
- 依赖关系已明确
- 已获得用户确认

---

## 主 Agent 传递提示词规则（必守）

- **使用完整模板、整段复制、禁止概括**：发起各阶段子任务时，必须将该阶段完整 prompt 模板整段复制到 prompt 中并替换占位符，禁止用概括语替代（如「请按 story-assistant 阶段二审计执行」「请参考技能阶段二」「审计要求见上文」）。
- **错误示例**（禁止）：「请按 story-assistant 阶段二审计执行」「请参考技能阶段二」「审计要求见上文」。
- **正确示例**：prompt 含该阶段完整模板全文、占位符已替换、发起前已输出自检结果。
- **占位符清单**：

| 阶段 | 占位符 | 含义 | 示例值 | 未替换后果 |
|------|--------|------|--------|------------|
| 阶段一 | epic_num, story_num, project-root | Epic 编号、Story 子编号、项目根目录 | 4, 1, d:/Dev/my-project | 子任务无法定位产出路径 |
| 阶段二 | Story 文档路径, project-root | 已产出 Story 文件路径、项目根 | _bmad-output/.../4-1-xxx.md | 审计对象错误或缺失 |
| 阶段三 | Story 文档路径, TASKS 路径, project-root | Story 与 TASKS 路径、项目根 | 同上 + TASKS_4-1.md | 实施对象错误 |
| 阶段四 | 同上及审计依据路径 | tasks/plan/GAPS 路径 | 由主 Agent 传入 | 审计依据缺失 |

- **自检强制**：未完成该阶段发起前自检清单并输出自检结果，不得发起；禁止先发起后补自检。
- **自检结果格式示例**：「【自检完成】阶段 X：已整段复制模板 [模板 ID]；占位符 [已替换/列出]；[其他必选项]。可以发起。」

### 主Agent发起子任务前自检清单

在发起任何子任务（mcp_task或Cursor Task）前，必须完成以下检查：

**sprint-status 检查**（阶段一 Create Story 发起前必须执行，TASKS_sprint-planning-gate T4）：
- [ ] 当用户通过 epic_num/story_num 或从 sprint-status 解析指定 Story 时，主 Agent 须在发起 Create Story 子任务**之前**检查 sprint-status 是否存在。
- [ ] 可调用 `{project-root}/scripts/check-sprint-ready.ps1 -Json`（若存在）或等价逻辑；若 `SPRINT_READY=false` 且用户未显式确认「已知绕过，继续」，不得发起 Create Story 子任务。
- [ ] 自检结果中须包含「sprint-status 已确认存在」或「用户已确认 bypass」或等价声明。

**文档存在性扫描**（阶段三 Dev Story 发起前必须执行）：
- [ ] 在发起阶段三 Dev Story 子任务前，必须执行：
  `python _bmad/scripts/bmad-speckit/python/check_speckit_prerequisites.py --epic {epic} --story {story} --project-root {project_root}`
  且退出码为 0；否则不得发起。
- [ ] 自检结果中须包含「已运行前置检查脚本且通过」或等价声明（可与 IMP-003 自检报告示例对齐：spec/plan/GAPS/tasks 四类文档存在 + 审计通过）。

**准备阶段检查**:
- [ ] 已读取相关skill文件获取最新内容
- [ ] 已确认当前处于正确的阶段（Layer 1/2/3/4/5）
- [ ] 已准备好所有必要的上下文信息
- [ ] 已确认前一阶段已完成并通过审计

**子任务配置检查**:
- [ ] subagent_type设置正确（generalPurpose/explore/shell）
- [ ] prompt包含完整的背景信息和具体要求
- [ ] 引用了正确的audit-prompts.md章节（如适用）
- [ ] 设置了合理的超时时间

**审计相关检查**:
- [ ] 已确认code-reviewer可用性或准备了回退方案
- [ ] 已准备好audit-prompts.md对应章节内容
- [ ] 已明确审计通过标准（A/B/C/D级）
- [ ] 已规划审计失败后的处理流程

**禁止事项自查**:
- [ ] 没有直接修改生产代码（必须通过子任务）
- [ ] 没有跳过必要的审计步骤
- [ ] 没有使用模糊的指令（如"考虑一下"、"看看能不能"）
- [ ] 没有遗漏需求映射或追溯

**自检确认**：
以上所有检查项完成后，在回复中明确声明：
"自检完成，所有检查项已通过，现在发起子任务。"

---

## 阶段一：Create Story

### 1.0 sprint-status 前置检查（TASKS_sprint-planning-gate T4）

**执行时机**：主 Agent 在发起 Create Story 子任务**之前**必须执行。

**检查动作**：
1. 当用户通过 epic_num/story_num（或「4、1」等形式）指定 Story 时，或从 sprint-status 解析下一 Story（示例 3）时，主 Agent **必须先**检查 sprint-status 是否存在。
2. 可调用 `scripts/check-sprint-ready.ps1 -Json` 或 `_bmad/scripts/bmad-speckit/powershell/check-sprint-ready.ps1 -Json`（若项目根有 scripts/ 则优先）。解析输出的 `SPRINT_READY`。
3. **若 sprint-status 不存在**：输出「⚠️ sprint-status.yaml 不存在，建议先运行 sprint-planning。」要求用户显式确认「已知绕过，继续」或先执行 sprint-planning；未确认前不得发起 Create Story 子任务。
4. **若 sprint-status 存在**：可附带「sprint-status 已确认」标志于子任务 prompt，简化子任务逻辑。
5. **豁免**：若用户明确「已通过 party-mode 且审计通过，跳过 Create Story」并仅请求 Dev Story，可按现有逻辑执行（Dev Story 由 dev-story 流程内部门控）。

通过 **mcp_task** 调用 subagent，执行 `/bmad-bmm-create-story` 等价工作流，生成 Epic `{epic_num}`、Story `{epic_num}-{story_num}` 文档。主 Agent 须将模板 **STORY-A1-CREATE**（阶段一 Create Story prompt）整段复制并替换占位符。

**跳过判断**：仅当用户**明确**说出「已通过 party-mode 且审计通过」「跳过 Create Story」时，主 Agent 方可跳过阶段一、二。若用户仅提供 Epic/Story 编号或说「Story 已存在」而未明确上述表述，**必须**执行 Create Story（含 party-mode 100 轮，若有方案选择或设计决策）。

### 1.1 发起子任务

**模板 ID**：STORY-A1-CREATE。**模板边界**：自代码块内首行至「…全程必须使用中文。」止。

```yaml
tool: mcp_task
subagent_type: generalPurpose
description: "Create Story {epic_num}-{story_num} via BMAD create-story workflow"
prompt: |
  【必读】本 prompt 须为完整模板且所有占位符已替换。若发现明显缺失或未替换的占位符，请勿执行，并回复：请主 Agent 将本 skill 中阶段一 Create Story prompt 模板（ID STORY-A1-CREATE）整段复制并替换占位符后重新发起。

  请执行 BMAD Create Story 工作流，生成 Epic {epic_num}、Story {epic_num}-{story_num} 的 Story 文档。

  **工作流步骤**：
  1. 加载 {project-root}/_bmad/core/tasks/workflow.xml
  2. 读取其全部内容
  3. 以 {project-root}/_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml 作为 workflow-config 参数
  4. 按照 workflow.xml 的指示执行 create-story 工作流
  5. 输出 Story 文档到 {project-root}/_bmad-output/implementation-artifacts/epic-{epic_num}-{epic-slug}/story-{epic_num}-{story_num}-{slug}/{epic_num}-{story_num}-<slug>.md（slug 从 Story 标题或用户输入推导）

  **强制约束**：
  - 创建 story 文档必须使用明确描述，禁止使用本 skill「§ 禁止词表（Story 文档）」中的词（可选、可考虑、后续、先实现、后续扩展、待定、酌情、视情况、技术债）。
  - 当功能不在本 Story 范围但属本 Epic 时，须写明「由 Story X.Y 负责」及任务具体描述；确保 X.Y 存在且 scope 含该功能（若 X.Y 不存在，审计将判不通过并建议创建）。禁止「先实现 X，或后续扩展」「其余由 X.Y 负责」等模糊表述。
  - **party-mode 强制**：无论 Epic/Story 文档是否已存在，只要涉及以下任一情形，**必须**进入 party-mode 进行多角色辩论（**最少 100 轮**，见 party-mode step-02 的「生成最终方案和最终任务列表」或 Create Story 产出方案场景）：① 有多个实现方案可选；② 存在架构/设计决策或 trade-off；③ 方案或范围存在歧义或未决点。**禁止**以「Epic 已存在」「Story 已生成」为由跳过 party-mode。共识前须达最少轮次；若未达成单一方案或仍有未闭合的 gaps/risks，继续辩论直至满足或达上限轮次。
  - 全程必须使用中文。
```

将上述 `{epic_num}`、`{story_num}`、`{project-root}` 替换为实际值（project-root 为项目根目录绝对路径）。

### 1.2 文档产出路径

Story 文档通常保存在：`_bmad-output/implementation-artifacts/epic-{epic_num}-{epic-slug}/story-{epic_num}-{story_num}-{slug}/{epic_num}-{story_num}-<slug>.md`。

---

## 阶段二：Story 文档审计

Story 文档生成后，**必须**发起审计子任务，使用 audit-prompts.md §5 精神（或适用于 Story 文档的审计提示词），迭代直至「完全覆盖、验证通过」。

### 严格度选择（strict / standard）

- **strict**：连续 3 轮无 gap + 批判审计员 >50%，引用 [audit-post-impl-rules.md](../speckit-workflow/references/audit-post-impl-rules.md)。
- **standard**：单次 + 批判审计员，引用 [audit-prompts-critical-auditor-appendix.md](../speckit-workflow/references/audit-prompts-critical-auditor-appendix.md)。

**选择逻辑**：
- 若无 party-mode 产出物（story 目录下无 `DEBATE_共识_*`、`party-mode 收敛纪要` 等）或用户要求 strict → **strict**（补偿缺失的 party-mode 深度）。
- 若有 party-mode 产出物存在且用户未强制 strict → **standard**（party-mode 已提供深度，验证即可）。

### 2.1 审计子代理优先顺序

**说明**：`mcp_task` 的 `subagent_type` 目前仅支持 `generalPurpose`、`explore`、`shell`，**不支持** `code-reviewer`。

**优先**：若项目存在 `.claude/agents/code-reviewer.md` 或 `.cursor/agents/code-reviewer.md`，Cursor 会从中发现 code-reviewer。优先通过 **Cursor Task 工具**（或等效机制）调度 code-reviewer 执行审计，并传入本阶段适用的审计提示词（见下文）。**不得**在审计步骤中强制「必须用 mcp_task」。

**回退**：若 code-reviewer 不可用（无 agents 文件、Task 无法调度等），则回退到 `mcp_task` + `subagent_type: generalPurpose`，并传入本阶段适用的审计提示词，保证审计标准一致。

**提示词**：**必须**使用本 skill 内阶段二 Story 审计完整 prompt 模板（ID STORY-A2-AUDIT）整段复制到审计子任务 prompt 中，**不得**使用其他通用审计提示词。

### 2.2 审计子任务

**模板 ID**：STORY-A2-AUDIT。**模板边界**：自代码块内首行至报告结尾格式段止；主 Agent 须整段复制并替换占位符。

```yaml
# 优先：Cursor Task 调度 code-reviewer（若 .claude/agents/ 或 .cursor/agents/ 存在）
# 回退：mcp_task（因 mcp_task 不支持 code-reviewer，回退时使用 generalPurpose）
tool: mcp_task
subagent_type: generalPurpose
description: "Audit Story {epic_num}-{story_num} document"
prompt: |
  【必读】本 prompt 须为完整审计模板且所有占位符已替换。若发现明显缺失或未替换的占位符，请勿执行，并回复：请主 Agent 将本 skill 中阶段二 Story 审计完整 prompt 模板（ID STORY-A2-AUDIT）整段复制并替换占位符后重新发起。

  你是一位非常严苛的代码审计员（对应 BMAD 工作流中的 code-reviewer 审计职责）。请对「已创建的 Story {epic_num}-{story_num} 文档」进行审计。

  审计依据：
  - 原始需求/Epic 文档
  - plan.md、IMPLEMENTATION_GAPS.md（如存在）
  - 实际生成的 Story 文档内容

  审计内容（必须逐项验证）：
  1. Story 文档是否完全覆盖原始需求与 Epic 定义。
  2. 若 Story 文档中存在本 skill § 禁止词表（Story 文档）任一词，一律判为未通过，并在修改建议中注明删除或改为明确描述。
  3. 多方案场景是否已通过辩论达成共识并选定最优方案。
  4. 是否有技术债或占位性表述。
  5. **推迟闭环**：若 Story 含「由 Story X.Y 负责」，须验证 `_bmad-output/implementation-artifacts/epic-{X}-*/story-{X}-{Y}-*/` 下 Story 文档存在且 scope/验收标准含该任务的具体描述；否则判不通过。「由 X.Y 负责」的表述须含被推迟任务的**具体描述**，便于 grep 验证。修改建议（三选一）：① 若 X.Y 不存在：创建 Story X.Y，scope 含 [任务具体描述]；② 若 X.Y 存在但 scope 不含：更新 Story X.Y，将 [任务具体描述] 加入 scope；③ 若不应推迟：删除「由 X.Y 负责」，改为本 Story 实现。
  
  验证方式：阅读 Story 文档；若含「由 Story X.Y 负责」，读取 `{project-root}/_bmad-output/implementation-artifacts/epic-{X}-*/story-{X}-{Y}-*/` 下 Story 文档，检查 scope/验收标准是否含该任务；grep 被推迟任务的关键词。

  报告结尾必须按以下格式输出：结论：通过/未通过。必达子项：① 覆盖需求与 Epic；② 明确无禁止词；③ 多方案已共识；④ 无技术债/占位表述；⑤ 推迟闭环（若有「由 X.Y 负责」则 X.Y 存在且 scope 含该任务）；⑥ 本报告结论格式符合本段要求。若任一项不满足则结论为未通过，并列出不满足项及每条对应的修改建议。

  【§Story 可解析块要求】报告结尾在结论与必达子项之后，**必须**追加可解析评分块（格式见 speckit-workflow/references/audit-prompts-critical-auditor-appendix.md §7 或 docs/BMAD/审计报告格式与解析约定.md）。须包含：独立一行「总体评级: [A|B|C|D]」及四行「- 需求完整性: XX/100」「- 可测试性: XX/100」「- 一致性: XX/100」「- 可追溯性: XX/100」。禁止用描述代替结构化块；总体评级仅限 A/B/C/D。映射建议：完全覆盖→A/90+；部分覆盖→B/80+；需修改→C/70+；不通过→D/60及以下。否则 parseAndWriteScore 无法解析、仪表盘无法显示评级。
```

若审计未通过，**根据报告执行**：若修改建议含「创建 Story X.Y」或「更新 Story X.Y」，主 Agent 须**先执行**该建议（发起 Create Story 或更新子任务），再再次发起对当前 Story 的审计；若仅需修改当前 Story 文档，**审计子代理须在本轮内直接修改**该文档，主 Agent 收到报告后再次发起审计。**禁止**仅修改当前 Story 文档即再审计，当修改建议含创建/更新其他 Story 时。文档审计迭代规则见 [audit-document-iteration-rules.md](../speckit-workflow/references/audit-document-iteration-rules.md)。每次审计均遵循 §2.1 的优先顺序（先 code-reviewer，失败则 generalPurpose）。

#### 审计通过后评分写入触发（强制）
- branch_id=bmad_story_stage2_audit_pass，event=story_status_change，triggerStage=bmad_story_stage2；要求审计子任务 prompt 中写明「审计通过后请将报告保存至 `_bmad-output/implementation-artifacts/epic-{epic}-*/story-{epic}-{story}-*/AUDIT_Story_{epic}-{story}_stage2.md`」；主 Agent 在收到通过结论后，若有 reportPath，运行 parse-and-write-score，**必须含 `--iteration-count {累计值}`**（执行审计循环的 Agent 在 pass 时传入本 stage fail 轮数；一次通过传 0；连续 3 轮无 gap 验证不计入）；stage=story；缺 question_version 时 eval_question 不调用；失败 non_blocking，记录 resultCode。

---

## 文档映射关系（与speckit-workflow）

### 文档对应矩阵

| bmad产出 | speckit产出 | 映射关系 | 阶段对应 |
|---------|------------|---------|---------|
| Product Brief | - | 源头文档 | Layer 1起点 |
| PRD | - | 需求规格 | Layer 1产出 |
| Architecture | - | 技术架构 | Layer 1产出 |
| Epic/Story列表 | - | 功能拆分 | Layer 2产出 |
| Story文档 | spec-E{epic}-S{story}.md | Story功能章节 ↔ spec功能规格章节 | Layer 3 → Layer 4 specify |
| plan + tasks（实现方案与任务列表） | plan-E{epic}-S{story}.md + tasks-E{epic}-S{story}.md | 功能清单 ↔ 任务列表 | Layer 3 → Layer 4 plan/tasks |
| BUGFIX文档 | IMPLEMENTATION_GAPS-E{epic}-S{story}.md | **GAP-063 修复**：BUGFIX 修复项可转化为 GAPS 中的「待实现差距」条目，两者为转化关系非等同 | Layer 3 → Layer 4 GAPS |
| progress.md | TDD记录 | 执行进度 ↔ 测试记录 | Layer 4执行 → 记录 |

### 需求追溯链

**扩展映射表格式**（必须在Story文档中包含）：

| PRD需求ID | PRD需求描述 | Architecture组件 | Story | spec章节 | task | 状态 |
|----------|------------|-----------------|-------|---------|------|------|
| REQ-001 | 用户登录 | AuthService | 4.1 | §2.1 | Task 1 | 已覆盖 |
| REQ-002 | JWT刷新 | AuthService | 4.1 | §2.2 | Task 2 | 推迟 |

**追溯要求**：
1. 每个PRD需求必须映射到至少一个Story
2. 每个Architecture组件必须映射到至少一个task
3. 每个Story必须包含PRD需求追溯章节
4. 每个spec-E{epic}-S{story}.md必须包含Architecture约束章节

### 时序关系

```
Layer 1: Product Brief → PRD → Architecture
              ↓
Layer 2: create-epics-and-stories → Epic/Story列表
              ↓
Layer 3: Create Story → 产出Story文档
              ↓
Layer 4: specify → 产出spec-E{epic}-S{story}.md（技术规格化Story内容）
              ↓
         plan → 产出plan-E{epic}-S{story}.md（实现方案）
              ↓
         Story文档审计（依据包含plan-E{epic}-S{story}.md）
```

### 变更管理

当PRD或Architecture发生变更时：
1. 标记受影响的Story
2. 更新Story文档的需求追溯章节
3. 通知相关开发人员
4. 重新审计受影响的部分

---

## 阶段三：Dev Story 实施（增强版）

审计通过后，执行 **/bmad-bmm-dev-story** 等价工作流，对 Story `{epic_num}-{story_num}` 进行开发实施。

### 前置检查

在开始实施前，必须确认以下检查项：
- [ ] PRD需求追溯章节已补充（列出本Story涉及的所有PRD需求ID）
- [ ] Architecture约束已传递到Story文档（列出相关的Architecture组件和约束）
- [ ] 复杂度评估已完成（确认本Story的复杂度分数）
- [ ] Epic/Story规划层的依赖分析已确认（确认前置Story已完成）

### spec 目录创建（路径须含 slug）

在 Create Story 产出 Story 文档后、执行 speckit specify 之前，**必须**确保 spec 目录已存在：

- **路径格式**：`specs/epic-{epic}/story-{story}-{slug}/`
- **slug 必选**，来源见 speckit-workflow SKILL.md §1.0（优先级：Story 标题 → Epic 名称 → Story scope → 兜底 E{epic}-S{story}）
- **创建方式**：由 BMAD 工作流脚本调用 `create-new-feature.ps1 -ModeBmad -Epic N -Story N -Slug {slug}`，或用户手动创建
- **若无法推导 slug**：须在发起 Dev Story 子任务前向用户询问，不得使用空 slug 或纯数字路径

**引用**：路径约定详见 speckit-workflow SKILL.md §1.0、DEBATE_spec目录命名规则Gap解决_100轮总结 §3.1。

### Dev Story实施流程

**必须嵌套执行 speckit-workflow 完整流程**，按以下顺序：

1. **specify** → 生成 spec-E{epic}-S{story}.md → code-review审计（迭代直至通过）
   - 输入：Story文档
   - 输出：spec-E{epic}-S{story}.md（技术规格，文件名必含Epic/Story序号）
   - 审计：code-review §1，必须通过A/B级

2. **plan** → 生成 plan-E{epic}-S{story}.md → code-review审计（迭代直至通过，必要时可进入party-mode 50轮）
   - 输入：spec-E{epic}-S{story}.md
   - 输出：plan-E{epic}-S{story}.md（实现方案）
   - 审计：code-review §2，必须通过A/B级
   - 可选：如有技术争议，启动50轮party-mode

3. **GAPS** → 生成 IMPLEMENTATION_GAPS-E{epic}-S{story}.md → code-review审计（迭代直至通过）
   - 输入：plan-E{epic}-S{story}.md + 现有代码
   - 输出：IMPLEMENTATION_GAPS-E{epic}-S{story}.md（实现差距）
   - 审计：code-review §3，必须通过A/B级

4. **tasks** → 生成 tasks-E{epic}-S{story}.md → code-review审计（迭代直至通过）
   - 输入：GAPS + plan
   - 输出：tasks-E{epic}-S{story}.md（执行任务列表）
   - 审计：code-review §4，必须通过A/B级
   - 注意：如任务数>20，启用分批执行机制

5. **执行** → TDD红绿灯模式（红灯→绿灯→重构）→ code-review审计（迭代直至通过）
   - 输入：tasks-E{epic}-S{story}.md
   - 输出：可运行代码 + TDD记录
   - 审计：code-review §5，必须通过A/B级
   - 要求：严格按照[TDD-RED]→[TDD-GREEN]→[TDD-REFACTOR]格式记录

6. **实施后审计（必须）**：子任务返回后，主 Agent 必须按阶段四发起实施后审计，禁止跳过。

### Worktree策略（修订版）

**story_count 来源（GAP-005 修复；GAP-072 修复）**：按优先级取 (1) Epic 配置 `epic.story_count`；(2) Story 列表 `len(epic.stories)`；(3) 用户输入 `--story-count N`。**冲突处理**：若 (1) 与 (2) 不同，记录警告并采用 (1)。**story_count=0 时（GAP-022 修复）**：禁止创建 worktree，提示用户先完成 Epic/Story 规划；或采用 story-level 占位策略（单 Story 占位）。

**自动检测逻辑**：
```python
worktree_base = Path(repo_root).parent  # 项目根父目录
repo_name = Path(repo_root).name  # 与 using-git-worktrees 一致
if story_count <= 2:
    worktree_type = "story-level"
    path = str(worktree_base / f"{repo_name}-story-{epic_num}-{story_num}")
elif story_count >= 3:
    worktree_type = "epic-level"
    path = str(worktree_base / f"{repo_name}-feature-epic-{epic_num}")
    branch = f"story-{epic_num}-{story_num}"
```

**Story级worktree**（Story数≤2）：
- 路径：`{父目录}/{repo名}-story-{epic_num}-{story_num}`（与项目根平级，repo名=目录名，与 using-git-worktrees 一致）
- 每个Story独立worktree
- 完全隔离，适合强依赖或高风险Story

**Epic级worktree**（Story数≥3）：
- 路径：`{父目录}/{repo名}-feature-epic-{epic_num}`（与项目根平级，repo名=目录名，与 using-git-worktrees 一致）
- 在Epic worktree内创建Story分支
- 分支名：`story-{epic_num}-{story_num}`
- 减少87%上下文切换时间

**串行/并行模式切换**：
```bash
# 切换到并行模式（需满足文件范围无重叠）
/bmad-set-worktree-mode epic=4 mode=parallel

# 切换到串行模式（默认）
/bmad-set-worktree-mode epic=4 mode=serial

# 回退到Story级
/bmad-set-worktree-mode epic=4 mode=story-level
```

### Solo 快速迭代模式（无新 worktree/branch）

**适用**：solo 开发、多 epic/story 同 branch、快速迭代、bugfix 穿插。`create-new-feature.ps1 -ModeBmad` 默认不创建 branch、不创建 worktree。

**不创建时的路径约定**：
- **spec**：`specs/epic-{epic}/story-{story}-{slug}/`，与 BMAD 一致
- **产出路径**：`_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/`，与 BMAD 一致
- **planning-artifacts**：按 `{branch}/` 子目录，`_bmad-output/planning-artifacts/{branch}/epics.md` 等

**多 epic/story 同 branch**：各 story 独立子目录 `specs/epic-{epic}/story-{story}-{slug}/` 及 `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/`，互不覆盖。

**Dev Story 执行**：在当前目录执行，不调用 worktree 创建。

### 需求追溯要求

**spec-E{epic}-S{story}.md必须包含**（文件名必含Epic/Story序号）：
```markdown
## 需求追溯

| PRD需求ID | PRD需求描述 | 对应spec章节 | 实现状态 |
|----------|------------|-------------|---------|
| REQ-001 | XXX | §2.1 | 已实现 |
```

**tasks-E{epic}-S{story}.md必须包含**（文件名必含Epic/Story序号）：
```markdown
## Architecture约束

| Architecture组件 | 约束描述 | 对应task | 验证方式 |
|-----------------|---------|---------|---------|
| CacheService | 必须支持TTL | Task 2 | 单元测试 |
```

### 冲突处理和回退

**如果发现Story文档与spec/plan冲突**：
1. 尝试在speckit阶段内解决（修改spec/plan）
2. 如无法解决，回退到Create Story重新澄清
3. 如涉及重大方案变更，重新进入party-mode

**回退命令**：
```
/bmad-bmm-correct-course epic=4 story=1 reason="需求冲突"
```

### 3.1 强制约束（保留）

1. **ralph-method**：必须创建并维护 `prd` 与 `progress` 文件；每完成一个 US 必须更新 prd（passes=true）、progress（追加 story log）；按 US-001～US-005 顺序执行。
2. **TDD 红绿灯**：每 US 必达顺序为红灯→绿灯→重构。涉及生产代码的任务：须先写/补测试并运行验收得失败（红灯），再实现并运行验收得通过（绿灯）；**progress 必须包含**每子步骤的验收命令与结果。禁止用「最终回归全部通过」替代逐任务的 TDD 记录。
3. **speckit-workflow**：禁止伪实现、占位；必须运行验收命令；架构忠实于 BUGFIX/需求文档。
4. **禁止**：在任务描述中添加「将在后续迭代」；标记完成但功能未实际调用。

### 3.2 主 Agent 职责

**主 Agent 必须执行的步骤**：1 准备 prompt（将模板 STORY-A3-DEV 整段复制并替换占位符）→ 2 执行发起前自检清单 → 3 输出自检结果 → 4 发起子任务。**禁止**：不得在未完成步骤 2、3 的情况下执行步骤 4。

- **仅负责**：发起 mcp_task、传入 BUGFIX/TASKS 文档路径、收集 subagent 输出。
- **禁止**：主 Agent 直接对生产代码执行 `search_replace` 或 `write`。
- **必须**：通过 mcp_task 将实施任务委托给 subagent。

### 3.3 发起实施子任务（STORY-A3-DEV 模板）

主 Agent 须将以下模板整段复制并替换占位符后传入 mcp_task：

```yaml
tool: mcp_task
subagent_type: generalPurpose
description: "Dev Story {epic_num}-{story_num} implementation"
prompt: |
  【必读】本 prompt 须为完整模板且所有占位符已替换。若发现明显缺失或未替换的占位符，请勿执行，并回复：请主 Agent 将本 skill 中阶段三 Dev Story 实施 prompt 模板（ID STORY-A3-DEV）整段复制并替换占位符后重新发起。

  【强制前置检查】执行以下验证，任一失败则拒绝执行并返回错误：

  1. 验证 spec-E{epic_num}-S{story_num}.md 存在且已通过审计
     - 检查路径: specs/epic-{epic_num}/story-{story_num}-*/spec-E{epic_num}-S{story_num}.md
     - 必须包含审计标记: <!-- AUDIT: PASSED by code-reviewer -->

  2. 验证 plan-E{epic_num}-S{story_num}.md 存在且已通过审计
     - 检查路径: specs/epic-{epic_num}/story-{story_num}-*/plan-E{epic_num}-S{story_num}.md
     - 必须包含审计标记: <!-- AUDIT: PASSED by code-reviewer -->

  3. 验证 IMPLEMENTATION_GAPS-E{epic_num}-S{story_num}.md 存在且已通过审计
     - 检查路径: specs/epic-{epic_num}/story-{story_num}-*/IMPLEMENTATION_GAPS-E{epic_num}-S{story_num}.md
     - 必须包含审计标记: <!-- AUDIT: PASSED by code-reviewer -->

  4. 验证 tasks-E{epic_num}-S{story_num}.md 存在且已通过审计
     - 检查路径: specs/epic-{epic_num}/story-{story_num}-*/tasks-E{epic_num}-S{story_num}.md
     - 必须包含审计标记: <!-- AUDIT: PASSED by code-reviewer -->

  5. 验证 ralph-method 追踪文件已创建或将在执行首步创建
     - 检查路径: _bmad-output/implementation-artifacts/epic-{epic_num}-*/story-{epic_num}-{story_num}-*/prd.*.json 与 progress.*.txt
     - 若不存在：子代理**必须**在开始执行 tasks 前，根据 tasks-E{epic_num}-S{story_num}.md 生成 prd 与 progress（符合 ralph-method schema），否则不得开始编码。

  如有任何一项不满足，立即返回错误：
  "前置检查失败: [具体原因]。请先完成 speckit-workflow 的完整流程（specify→plan→GAPS→tasks）。"

  ---

  你是一位非常资深的开发专家 Amelia 开发（对应 BMAD 开发职责），负责按 Story/TASKS 执行实施。请按以下规范执行。

  【必做】TDD 红绿灯记录：每完成一个涉及生产代码的任务的绿灯后，**立即**在 progress 追加两行：
  `[TDD-RED] <任务ID> <验收命令> => N failed`
  `[TDD-GREEN] <任务ID> <验收命令> => N passed`
  交付前自检：对照 TASKS/Story 任务列表逐项检查——若该任务涉及生产代码，progress 中是否有 [TDD-RED] 与 [TDD-GREEN] 各至少一行？若否，补充后再交付。

  请对 Story {epic_num}-{story_num} 执行 Dev Story 实施。

  **各 stage 审计通过后落盘与 parseAndWriteScore 约束（强制）**：在 speckit 各阶段（specify/plan/GAPS/tasks/执行）审计通过时，子代理须（1）将审计报告保存至约定路径（见 speckit-workflow 各 §x.2 的「审计通过后评分写入触发」）；**发起 spec/plan/GAPS/tasks 审计时，prompt 必须显式包含**：审计通过后请将报告保存至 `specs/epic-{epic_num}/story-{story_num}-{slug}/AUDIT_spec-E{epic_num}-S{story_num}.md`（spec 阶段）、`AUDIT_plan-E{epic_num}-S{story_num}.md`、`AUDIT_GAPS-E{epic_num}-S{story_num}.md`、`AUDIT_tasks-E{epic_num}-S{story_num}.md`（plan/GAPS/tasks 阶段，同目录）；**在结论中注明保存路径及 iteration_count**（本 stage 审计未通过轮数，0 表示一次通过）；**fail 轮报告须保存至 `AUDIT_{stage}-E{epic}-S{story}_round{N}.md`**（Story 9.4）；**验证轮报告不列入 iterationReportPaths**；pass 时主 Agent 收集本 stage 所有 fail 轮报告路径，传入 `--iterationReportPaths path1,path2,...`；（2）运行 `npx ts-node scripts/parse-and-write-score.ts --reportPath <路径> --stage <spec|plan|tasks> --event stage_audit_complete --triggerStage speckit_1_2|speckit_2_2|speckit_3_2|speckit_4_2|speckit_5_2 --epic {epic_num} --story {story_num} --artifactDocPath <对应路径> --iteration-count {累计值} [--iterationReportPaths path1,path2,...]`（triggerStage 按阶段择一；**必须含 --iteration-count**，执行审计循环的 Agent 在 pass 时传入本 stage fail 轮数，一次通过传 0，连续 3 轮无 gap 不计入）；spec/plan/tasks 阶段 artifactDocPath 为对应 spec/plan/GAPS/tasks 文档路径；implement 阶段 artifactDocPath 可为 story 子目录下的实现主文档路径或留空由解析器从 reportPath 推导；（3）若调用失败，记录 resultCode 进审计证据，不阻断流程。epic_num、story_num 由主 Agent 传入。

  **必须嵌套执行 speckit-workflow 完整流程**：specify → plan → GAPS → tasks → 执行。

  **上下文与路径**：
  - Story 文档：{project-root}/_bmad-output/implementation-artifacts/epic-{epic_num}-*/story-{epic_num}-{story_num}-*/*.md
  - 产出路径：Story 文档入 story 子目录 `epic-{epic_num}-{epic-slug}/story-{epic_num}-{story_num}-{slug}/{epic_num}-{story_num}-{slug}.md`
  - BUGFIX/TASKS 文档：（由主 Agent 传入实际路径）
  - 项目根目录：{project-root}

  **必须遵守**：ralph-method（执行前**必须**在 `_bmad-output/implementation-artifacts/epic-{epic_num}-{epic-slug}/story-{epic_num}-{story_num}-{slug}/` 创建 prd.{stem}.json 与 progress.{stem}.txt（stem 为 tasks 文档 stem）；每完成一个 US 必须更新 prd（passes=true）、progress（追加 story log）；按 US 顺序执行。**禁止**在未创建上述文件前开始编码）、TDD 红绿灯、speckit-workflow、禁止伪实现、失败用例须修或记、pytest 在项目根目录运行。

**TDD progress 验收自检（每个 US 完成后立即验证）**：
- [ ] progress.{stem}.txt 中对应 US 有 [TDD-RED] 一行（集成任务可写"首次全量运行 N failed"）
- [ ] progress.{stem}.txt 中对应 US 有 [TDD-GREEN] 一行
- [ ] progress.{stem}.txt 中对应 US 有 [TDD-REFACTOR] 一行（无需重构须显式写"无需重构 ✓"，禁止省略）

**TDD progress 强制要求**：每个 US 完成后须在 progress 追加三行 `[TDD-RED]`/`[TDD-GREEN]`/`[TDD-REFACTOR]`（集成任务 REFACTOR 可写"无新增生产代码，各模块独立性已验证，无跨模块重构 ✓"）；禁止在所有 US 完成后才集中补写。

**implement 执行约束**：执行 implement（或等价执行 tasks）时，子 Agent 必须加载 speckit-workflow 与 ralph-method 技能，或至少遵守 commands/speckit.implement.md 中嵌入的 ralph 步骤（步骤 3.5、6、8）；不得仅凭「执行 tasks」的泛化理解而跳过 prd/progress 创建与 per-US 更新。

  请读取 ralph-method 技能与 speckit-workflow 技能，严格按照其规则执行。

  子任务返回后，主 Agent 必须发起阶段四实施后审计（STORY-A4-POSTAUDIT），禁止跳过。实施后审计为必须步骤，非可选。
```

#### 3.3.1 子任务返回后兜底 cleanup（主 Agent 强制步骤）

子任务返回或超时后，**必须**检查 `_bmad-output/current_pytest_session_pid.txt`；若文件存在，**必须**执行以下命令并删除该文件；**禁止**跳过此步骤。

- **Linux/macOS**：`python tools/cleanup_test_processes.py --only-from-file --session-pid $(cat _bmad-output/current_pytest_session_pid.txt)`
- **Windows (PowerShell)**：`python tools/cleanup_test_processes.py --only-from-file --session-pid (Get-Content _bmad-output/current_pytest_session_pid.txt)`
- **Windows (cmd)**：`for /f %i in (_bmad-output\current_pytest_session_pid.txt) do python tools/cleanup_test_processes.py --only-from-file --session-pid %i`

执行完成后删除 `_bmad-output/current_pytest_session_pid.txt`。

---

## 阶段四：实施后审计（增强版）

本阶段为**必须**步骤，非可选。主 Agent 在子任务返回后必须发起，不得跳过。**严格度：strict**，须遵循 [audit-post-impl-rules.md](../speckit-workflow/references/audit-post-impl-rules.md)（路径：`skills/speckit-workflow/references/audit-post-impl-rules.md`）。

### 收敛条件（strict，必须）

- **连续 3 轮无 gap**：连续 3 次审计结论均为「完全覆盖、验证通过」，且该 3 次报告中批判审计员结论段均注明「本轮无新 gap」。任一轮为「存在 gap」则从下一轮重新计数。
- **批判审计员 >50%**：报告须包含「## 批判审计员结论」段落，该段落字数或条目数不少于报告其余部分；必填结构见 [audit-prompts-critical-auditor-appendix.md](../speckit-workflow/references/audit-prompts-critical-auditor-appendix.md)。
- 主 Agent 在发起第 2、3 轮审计前，可输出「第 N 轮审计通过，继续验证…」以提示用户。

### 前置检查

在进行实施后审计前，必须确认：
- [ ] speckit specify阶段code-review审计已通过（§1）
- [ ] speckit plan阶段code-review审计已通过（§2）
- [ ] speckit GAPS阶段code-review审计已通过（§3）
- [ ] speckit tasks阶段code-review审计已通过（§4）
- [ ] speckit执行阶段code-review审计已通过（§5）
- [ ] TDD记录完整（包含RED/GREEN/REFACTOR三个阶段）
- [ ] ralph-method进度文件已更新

如有任何一项未通过，必须先完成该项审计。

### 综合审计

使用 `audit-prompts.md §5` 进行综合验证。**报告可解析块须符合 §5.1**（四维：功能性、代码质量、测试覆盖、安全性），与 config/code-reviewer-config.yaml modes.code.dimensions 一致，否则 parseAndWriteScore(mode=code) 无法解析、仪表盘四维显示「无数据」。

**审计维度**：
1. 需求覆盖度：是否实现了Story文档中的所有需求
2. 测试完整性：单元测试、集成测试是否充分
3. 代码质量：是否符合项目编码规范
4. 文档一致性：Story文档、spec、plan、代码是否一致
5. 可追溯性：PRD需求→Story→spec→task→代码的链路是否完整

**审计方式**：
- 优先：Cursor Task调度code-reviewer
- 回退：mcp_task generalPurpose + audit-prompts.md §5内容

### 审计结论处理

**通过（A/B级）**：
- Story标记为完成
- #### 步骤 4.2：运行 parse-and-write-score（强制）
  - 主 Agent 在收到实施后审计通过结论后，**必须**执行以下操作：
  - 1. 确定报告路径：`{project-root}/_bmad-output/implementation-artifacts/epic-{epic}-*/story-{epic}-{story}-*/AUDIT_Story_{epic}-{story}_stage4.md`
  - 2. 若报告文件存在，执行：`npx ts-node scripts/parse-and-write-score.ts --reportPath <上述路径> --stage tasks --event story_status_change --triggerStage bmad_story_stage4 --epic {epic} --story {story} --artifactDocPath <story 文档路径> --iteration-count {本 stage 累计 fail 轮数，一次通过传 0}`
  - 3. 若调用失败，记录 resultCode 到审计证据，不阻断流程（non_blocking）。
- #### 审计通过后评分写入触发（强制）
  - branch_id=bmad_story_stage4_audit_pass，event=story_status_change，triggerStage=bmad_story_stage4；**要求审计子任务 prompt 中写明**「审计通过后请将报告保存至 `{project-root}/_bmad-output/implementation-artifacts/epic-{epic}-*/story-{epic}-{story}-*/AUDIT_Story_{epic}-{story}_stage4.md`」；主 Agent 在实施后审计通过后，从约定路径或子任务输出解析 reportPath；若 reportPath 存在则运行 parse-and-write-score；若 reportPath 不存在则记录 `SCORE_WRITE_SKIP_REPORT_MISSING`，**不阻断**流程；**必须含 `--iteration-count {累计值}`**（本 stage fail 轮数；一次通过传 0）；stage=tasks；异常记 SCORE_WRITE_CALL_EXCEPTION；主流程继续到完成选项。
- #### 步骤 4.3：Story 完成自检（GAP-3.2）
  - 在**提供完成选项之前**，主 Agent 必须执行：`npx ts-node scripts/check-story-score-written.ts --epic {epic} --story {story}`
  - 若输出为 `STORY_SCORE_WRITTEN:no` 且 reportPath 存在，则补跑 parse-and-write-score：`npx ts-node scripts/parse-and-write-score.ts --reportPath <报告路径> --stage tasks --event story_status_change --triggerStage bmad_story_stage4 --epic {epic} --story {story} --artifactDocPath <story 文档路径> --iteration-count {本 stage 累计 fail 轮数}`
  - 补跑失败 non_blocking，主流程继续。
- 提供完成选项（见下文）

**有条件通过（C级）**：
- 列出必须修复的问题
- 修复后重新审计

**不通过（D级）**：
- 列出重大问题
- 可能需要回退到Layer 3重新Create Story
- 或回退到speckit特定阶段重新执行

### 完成后选项

当Story审计通过后，提供以下选项（详细实现见 **Phase 5: 收尾与集成（增强版）**）：

**[0] 提交代码**
- 询问是否将当前改动提交到本地仓库
- 若选择是，自动调用 auto-commit-utf8 技能生成中文 commit message 并提交

**[1] 开始下一个Story**
- 在同一Epic worktree内切换到下一个Story分支
- 自动检测并处理跨Story依赖

**[2] 创建PR并等待review**
- 推送当前Story分支到远程
- 创建PR（调用pr-template-generator生成描述）
- 进入强制人工审核流程

**[3] 批量Push所有Story分支**
- 推送Epic下所有已完成的Story分支
- 为每个Story创建PR
- 进入批量人工审核流程

**[4] 保留分支稍后处理**
- 保持当前分支状态
- 允许稍后继续

### Epic完成检查

当Epic下所有Story都完成后：
1. 验证所有Story的PR都已merge到feature-epic-{num}分支
2. 执行Epic级集成测试
3. 创建Epic级别的PR（合并到main）
4. 再次进入强制人工审核
5. 清理Epic worktree（可选）；（**GAP-045 修复**：清理条件：Epic PR 已 merge 且无未决问题；保留时长：建议 7 天；恢复：从 main 重新 checkout feature-epic-{num} 分支）；（**GAP-086 修复**：由用户选择是否清理；或系统建议后用户确认）

### Phase 5: 收尾与集成（增强版）

**GAP-074 前置条件**：执行选项 [2] 或 [3] 前，须确认 pr-template-generator 已安装或已在前置探测中确认。若不存在，输出安装指引（如 `cursor skills install pr-template-generator` 或参考 Cursor skills 文档）并跳过 PR 描述生成；可使用占位模板替代。

当所有Story完成后，提供以下选项：

#### 选项 [0] 提交代码
- 询问是否将当前改动提交到本地仓库
- 若选择是，自动调用 auto-commit-utf8 技能生成中文 commit message 并提交

#### 选项 [1] 继续下一个Story
- 在同一Epic worktree内切换到下一个Story分支
- 自动检测并处理跨Story依赖
- 如果前置Story未完成，提示等待

#### 选项 [2] 创建PR并等待review
- 推送当前Story分支到远程
- **自动调用pr-template-generator生成PR描述**（前置条件见上方 GAP-074）
- 创建PR并进入强制人工审核流程

**pr-template-generator调用**：
```bash
# 分析当前分支的commits
analyze_commits(story_branch)

# 生成PR模板
pr_template = generate_pr_template(
    story_id="4.1",
    story_title="metrics cache fix",
    commits=commit_history,
    files_changed=changed_files,
    tests_added=test_files
)

# PR模板内容包括：
# - Story背景和目的
# - 主要改动点（基于commit message）
# - 测试覆盖情况
# - 影响范围
# - 回滚方案
```

#### 选项 [3] 批量Push所有Story分支
- 推送Epic下所有已完成的Story分支到远程
- **为每个Story自动创建PR（使用pr-template-generator，前置条件见 GAP-074）**
- 进入批量人工审核流程

**批量处理流程**：
```
For each completed_story in epic.stories:
    1. Push story_branch to origin
    2. Generate PR template using pr-template-generator
    3. Create PR with generated template
    4. Add to batch_review_queue

Display batch review summary:
- Total PRs created: N
- Epic: feature-epic-4
- Ready for review
```

**批量Push实现细节**：

**前置条件检查**：
```python
def batch_push_precheck(epic_id):
    # 1. 检查所有Story是否已完成
    incomplete_stories = get_incomplete_stories(epic_id)
    if incomplete_stories:
        warn(f"以下Story未完成: {incomplete_stories}")
        if not user_confirm("是否只推送已完成的Story？"):
            return False

    # 2. 检查远程仓库连接
    if not test_remote_connection():
        error("无法连接到远程仓库")
        return False

    # 3. 检查权限
    if not has_push_permission():
        error("没有推送权限")
        return False

    return True
```

**批量推送流程**：
```python
def batch_push_stories(epic_id):
    results = []

    for story in get_completed_stories(epic_id):
        try:
            # 1. 切换到Story分支
            checkout_branch(f"story-{epic_id}-{story.num}")

            # 2. 拉取最新代码（避免冲突）
            pull_latest()  # GAP-082 修复：pull 失败（如冲突）时默认 skip 该 Story 继续下一 Story 并记录；可选「提示用户解决」模式

            # 3. 推送到远程
            push_to_remote(f"story-{epic_id}-{story.num}")

            # 4. 生成PR模板
            pr_template = generate_pr_template(story)

            # 5. 创建PR
            pr_url = create_pull_request(
                title=f"Story {epic_id}.{story.num}: {story.title}",
                body=pr_template,
                head=f"story-{epic_id}-{story.num}",
                base=f"feature-epic-{epic_id}"
            )

            results.append({
                "story": story.num,
                "status": "success",
                "pr_url": pr_url
            })

        except Exception as e:
            results.append({
                "story": story.num,
                "status": "failed",
                "error": str(e)
            })

    return results
```

**错误处理**：
- 单个Story推送失败不影响其他Story
- 记录失败的Story和原因
- 提供重试机制

**进度显示**：
```
批量推送中...
[1/7] Story 4.1: 推送中... ✅ 完成，PR #123
[2/7] Story 4.2: 推送中... ✅ 完成，PR #124
[3/7] Story 4.3: 推送中... ❌ 失败（网络错误）
[4/7] Story 4.4: 推送中... ✅ 完成，PR #125
...

推送完成：6/7 成功
失败：Story 4.3
是否重试失败的Story？[Y/n]
```

#### 选项 [4] 保留分支稍后处理
- 保持当前分支状态
- 允许稍后继续
- 记录当前进度到元数据

#### 强制人工审核流程

无论选择哪个选项，PR Merge环节**绝对不能自动merge**：

**单PR审核界面**：
```
╔════════════════════════════════════════════════════════════╗
║                    🔒 PR审核请求                            ║
╠════════════════════════════════════════════════════════════╣
║  Epic: feature-epic-4 (用户管理系统重构)                    ║
║  PR: #123 Story 4.1: metrics cache fix                     ║
╟────────────────────────────────────────────────────────────╢
║  📊 CI状态:        ✅ 全部通过                              ║
║  📈 覆盖率变化:    +2.3%                                   ║
║  🔍 代码审查:      ✅ 已通过 code-reviewer（**GAP-059 修复**：调用时传入 mode=pr，从 code-reviewer-config 读取 pr 模式提示词）                 ║
║  📁 影响文件:      12个                                    ║
║  📝 PR描述:        [由pr-template-generator生成]           ║
║                                                            ║
║  ❓ 请选择操作：                                            ║
║  [1] ✅ 批准并Merge                                        ║
║  [2] ❌ 拒绝，返回修改                                      ║
║  [3] 👀 查看详细diff                                       ║
║  [4] ⏭️  跳过此PR                                          ║
╚════════════════════════════════════════════════════════════╝
```

**批量审核界面**：
```
╔════════════════════════════════════════════════════════════╗
║                 🔒 批量PR审核请求                           ║
╠════════════════════════════════════════════════════════════╣
║  Epic: feature-epic-4                                       ║
║  待审核PR: 3个                                              ║
╟────────────────────────────────────────────────────────────╢
║  [#123] Story 4.1 - ✅ CI通过 - ✅ 审计A级                  ║
║  [#124] Story 4.2 - ✅ CI通过 - ✅ 审计B级                  ║
║  [#125] Story 4.3 - ✅ CI通过 - ⚠️  审计C级（需关注）       ║
╟────────────────────────────────────────────────────────────╢
║  ❓ 请选择操作：                                            ║
║  [1] ✅ 批准全部并逐个Merge                                ║
║  [2] ✅ 批准部分（选择）                                   ║
║  [3] ❌ 拒绝全部，返回修改                                 ║
║  [4] 👀 逐个查看详情                                       ║
╚════════════════════════════════════════════════════════════╝
```

**重要约束**：
- 必须等待用户明确选择[1]并确认后才能merge
- 严禁自动merge
- 审核不通过的PR不能merge

#### 强制人工审核界面实现

**核心原则**：绝对不能自动merge，必须停止等待人工确认。

**单PR审核界面**：
```python
def show_pr_review_interface(pr_info):
    # 获取PR详细信息
    ci_status = get_ci_status(pr_info.id)
    coverage_change = get_coverage_change(pr_info.id)
    code_review_result = get_code_review_result(pr_info.id)
    affected_files = get_affected_files(pr_info.id)

    # 显示审核界面
    display(f"""
╔════════════════════════════════════════════════════════════╗
║                    🔒 PR审核请求                            ║
╠════════════════════════════════════════════════════════════╣
║  Epic: {pr_info.epic_name}                                  ║
║  PR: #{pr_info.id} {pr_info.title}                         ║
╟────────────────────────────────────────────────────────────╢
║  📊 CI状态:        {ci_status.emoji} {ci_status.text}       ║
║  📈 覆盖率变化:    {coverage_change}                        ║
║  🔍 代码审查:      {code_review_result.emoji} {code_review_result.grade}级 ║
║  📁 影响文件:      {len(affected_files)}个                  ║
║  📝 PR描述:        [由pr-template-generator生成]           ║
║                                                            ║
║  ❓ 请选择操作：                                            ║
║  [1] ✅ 批准并Merge                                        ║
║  [2] ❌ 拒绝，返回修改                                      ║
║  [3] 👀 查看详细diff                                       ║
║  [4] ⏭️  跳过此PR                                          ║
╚════════════════════════════════════════════════════════════╝
    """)

    # 等待用户输入（轮询模式，24h超时）
    # GAP-010 修复：Cursor/Claude 无现成 wait_for_user_input_with_polling API，需自行实现
    # 实现建议：输出 prompt 后结束本轮；用户在下条消息回复 1/2/3/4
    # 超时/提醒：仅在会话中打印提示信息，暂不集成邮件/Slack 等外接
    choice = wait_for_user_input_with_polling(
        timeout_hours=24,
        poll_interval_minutes=30,
        on_timeout=lambda: print(f"[超时提醒] PR #{pr_info.id} 待审核已超过24小时。请尽快完成审核，或选择跳过/拒绝。")
    )

    if choice == "1":
        confirm = ask("确定要批准并Merge此PR？ [yes/no]: ")
        if confirm.lower() == "yes":
            merge_pull_request(pr_info.id)
            return "merged"
        else:
            return "cancelled"
    elif choice == "2":
        reason = ask("拒绝原因: ")
        reject_pull_request(pr_info.id, reason)
        return "rejected"
    elif choice == "3":
        show_diff(pr_info.id)
        return show_pr_review_interface(pr_info)  # 递归显示
    elif choice == "4":
        return "skipped"
```

**批量审核界面**：
```python
def show_batch_review_interface(epic_id, pr_list):
    pr_statuses = [get_pr_status(pr) for pr in pr_list]

    display(f"""
╔════════════════════════════════════════════════════════════╗
║                 🔒 批量PR审核请求                           ║
╠════════════════════════════════════════════════════════════╣
║  Epic: {epic_id}                                            ║
║  待审核PR: {len(pr_list)}个                                 ║
╟────────────────────────────────────────────────────────────╢
""")

    for i, (pr, status) in enumerate(zip(pr_list, pr_statuses), 1):
        display(f"║  [#{pr.id}] Story {pr.story_id} - {status.ci_emoji} CI{status.ci_status} - {status.review_emoji} 审计{status.grade}级")

    display("""
╟────────────────────────────────────────────────────────────╢
║  ❓ 请选择操作：                                            ║
║  [1] ✅ 批准全部并逐个Merge                                ║
║  [2] ✅ 批准部分（选择）                                   ║
║  [3] ❌ 拒绝全部，返回修改                                 ║
║  [4] 👀 逐个查看详情                                       ║
╚════════════════════════════════════════════════════════════╝
    """)

    choice = wait_for_user_input_with_polling(timeout_hours=24, poll_interval_minutes=30)

    if choice == "1":
        confirm = ask(f"确定要批准全部{len(pr_list)}个PR并逐个Merge？ [yes/no]: ")
        if confirm.lower() == "yes":
            for pr in pr_list:
                merge_pull_request(pr.id)
            return "all_merged"
    elif choice == "2":
        # GAP-046/GAP-088 修复：select_prs_to_merge UI 交互
        selected = select_prs_to_merge(pr_list)
        for pr in selected:
            merge_pull_request(pr.id)
        return f"{len(selected)}_merged"
    # ... 其他选项
```

**select_prs_to_merge UI 交互（GAP-046/GAP-088）**：
```python
def select_prs_to_merge(pr_list):
    """批准部分PR时的选择逻辑"""
    display(pr_list with indices 1..n)
    raw = input("输入序号，逗号或范围，如 1,3,5 或 1-3: ")
    indices = parse_indices(raw, max_n=len(pr_list))
    # 空输入→[]；非法格式→提示重输；越界→忽略
    return [pr_list[i-1] for i in indices if 1 <= i <= len(pr_list)]
```

**审核提醒机制**（仅在会话中打印，暂不集成邮件/Slack）：
```python
# GAP-056 修复：已知限制——用户关闭会话后 reopen 时提醒无法送达；可补充「会话恢复时检查待审核 PR 并提示」
if time_since_last_activity() > timedelta(hours=24):
    print(f"[提醒] Epic {epic_id} 有待审核PR，共 {pending_pr_count} 个已超过24小时，请尽快处理。")
```

**审核SLA约定**（建议）：
- P0 PR：4小时内响应
- P1 PR：24小时内响应
- P2 PR：72小时内响应

### 4.1 审计子代理与提示词

与阶段二相同：**优先** Cursor Task 调度 code-reviewer；**回退** mcp_task generalPurpose。主 Agent 须将 **STORY-A4-POSTAUDIT** 完整 prompt 模板整段复制并替换占位符后传入。详细模板见本 skill 历史版本或 speckit-workflow references。

若审计结论为**未通过**，**必须**按审计报告修改后**再次发起**，直至「完全覆盖、验证通过」。

---

## 阶段五：Skill 自审计（技能创建时）

当本 skill 被**新建或重大修改**后，应对 skill 文件发起审计子任务。遵循 §2.1 / §4.1 优先顺序（先 code-reviewer，失败则 generalPurpose）。

```yaml
# 回退方案示例
tool: mcp_task
subagent_type: generalPurpose
description: "Audit bmad-story-assistant skill"
prompt: |
  你是一位非常严苛的代码审计员。请对「bmad-story-assistant SKILL.md」进行审计。

  审计内容：
  1. 是否完整覆盖用户要求的 Create Story、审计、Dev Story、实施后审计、Skill 自审计 全流程。
  2. Epic/Story 编号作为输入的说明是否清晰，占位符 {epic_num}、{story_num}、{project-root} 是否一致。
  3. 引用的命令、技能是否准确：/bmad-bmm-create-story、/bmad-bmm-dev-story、mcp_task、ralph-method、speckit-workflow、audit-prompts.md §5。
  4. 主 Agent 禁止直接修改生产代码、必须通过 mcp_task 委托等约束是否明确。
  5. 中文表述是否清晰无歧义。
  6. 审计步骤是否明确：mcp_task 不支持 code-reviewer；优先 Cursor Task 调度 code-reviewer、失败则回退 mcp_task generalPurpose；是否避免强制「必须用 mcp_task」；阶段二使用 Story 专用提示词、阶段四使用完整 audit-prompts §5。
  7. **推迟闭环**：禁止词表是否含「先实现、后续扩展、或后续扩展」；是否含「Story 范围表述示例」；阶段二审计是否含「由 Story X.Y 负责」的验证项；审计未通过时主 Agent 是否须先执行「创建/更新 Story X.Y」再再次审计；Create Story 是否含正面指引（功能不在本 Story 但属 Epic 时须写明归属）。

  报告结尾必须明确给出结论：是否「完全覆盖、验证通过」；若未通过，请列出未通过项及修改建议。
```

迭代修改 SKILL.md 并再次审计，直至报告结论为「完全覆盖、验证通过」。

---

## BMAD Agent 展示名与命令对照

在 mcp_task 子任务调用、Party Mode 多轮对话、工作流指引等场景中，应使用以下**展示名**指代各 Agent，以保持上下文一致性与用户体验。参考：`docs/BMAD/Cursor_BMAD_多Agent使用指南.md`。

| Agent 展示名 | 命令名 | 模块 |
|--------------|--------|------|
| BMad Master | `bmad-agent-bmad-master` | core |
| Mary 分析师 | `bmad-agent-bmm-analyst` | bmm |
| John 产品经理 | `bmad-agent-bmm-pm` | bmm |
| Winston 架构师 | `bmad-agent-bmm-architect` | bmm |
| Amelia 开发 | `bmad-agent-bmm-dev` | bmm |
| Bob Scrum Master | `bmad-agent-bmm-sm` | bmm |
| Quinn 测试 | `bmad-agent-bmm-qa` | bmm |
| Paige 技术写作 | `bmad-agent-bmm-tech-writer` | bmm |
| Sally UX | `bmad-agent-bmm-ux-designer` | bmm |
| Barry Quick Flow | `bmad-agent-bmm-quick-flow-solo-dev` | bmm |
| Bond Agent 构建 | `bmad-agent-bmb-agent-builder` | bmb |
| Morgan Module 构建 | `bmad-agent-bmb-module-builder` | bmb |
| Wendy Workflow 构建 | `bmad-agent-bmb-workflow-builder` | bmb |
| Victor 创新策略 | `bmad-agent-cis-innovation-strategist` | cis |
| Dr. Quinn 问题解决 | `bmad-agent-cis-creative-problem-solver` | cis |
| Maya 设计思维 | `bmad-agent-cis-design-thinking-coach` | cis |
| Carson 头脑风暴 | `bmad-agent-cis-brainstorming-coach` | cis |
| Sophia 故事讲述 | `bmad-agent-cis-storyteller` | cis |
| Caravaggio 演示 | `bmad-agent-cis-presentation-master` | cis |
| Murat 测试架构 | `bmad-agent-tea-tea` | tea |
| 批判性审计员 | （仅 party-mode 内使用，无独立命令） | core |

**使用说明**：
- **mcp_task 子任务上下文**：在 prompt 中引用 BMAD 工作流或推荐下一步时，使用展示名（如「可交由 Winston 架构师 做架构检查」）。
- **Party Mode 多轮对话**：Facilitator 介绍与发言时，必须使用展示名标注角色（如「🏗️ **Winston 架构师**：…」「💻 **Amelia 开发**：…」），与 `_bmad/_config/agent-manifest.csv` 的 `displayName` 及上表保持一致。

---

## 角色配置

### 批判审计员（Critical Auditor）

**角色定位**：
独立的批判性思维专家，专注于发现方案漏洞、质疑假设、挑战设计决策。
在所有Party-Mode讨论中，批判审计员必须每轮首先发言。

**核心职责**：
1. 在Layer 1 PRD Party-Mode阶段积极参与辩论（强制）
2. 在Layer 1 Architecture Party-Mode阶段积极参与辩论（强制）
3. 在Layer 3 Create Story Party-Mode阶段积极参与辩论（强制）
4. 对每个关键决策提出至少5个深度质疑
5. 记录所有未解决的gap和假设
6. 在方案未达成共识前持续挑战，不轻易妥协
7. 确保审计清单（audit-prompts.md）被严格执行

**权力与权限**：
1. **暂停权**：发现重大漏洞时，可要求暂停流程
2. **记录权**：所有质疑必须被记录并追踪
3. **复验权**：可要求对修改后的方案再次审计
4. **一票否决权**：当发现致命缺陷时，可否决方案进入下一阶段；（**GAP-060 修复**：skill 执行环境下，批判审计员行使否决权时，由 Facilitator/主 Agent 负责暂停并记录，不得进入下一阶段）

**介入阶段**：
1. **Layer 1 PRD Party-Mode**（强制）：质疑需求完整性、用户价值、市场定位
2. **Layer 1 Architecture Party-Mode**（强制）：质疑技术可行性、tradeoff合理性、过度设计
3. **Layer 3 Create Story Party-Mode**（强制）：质疑方案选择、范围界定、验收标准
4. **speckit.plan阶段**（按需）：用户明确要求或技术争议时介入
5. **审计阶段**（强化）：与code-review协同工作

**退出标准**：
1. 所有质疑都得到满意回应
2. 达到收敛条件（共识 + 近3轮无新gap）
3. 用户明确接受风险并继续
4. 记录完整的质疑清单和解决状态

**能力要求**：
1. 熟悉审计清单（audit-prompts.md）
2. 具备批判性思维和逻辑分析能力
3. 了解技术架构和实现约束
4. 有丰富的项目经验和风险识别能力

**典型质疑问题**：
- "这个需求的用户价值是什么？有数据支撑吗？"
- "这个技术方案是否过度工程化？有更简单的替代吗？"
- "这个范围界定是否清晰？边界条件考虑了吗？"
- "这个验收标准是否可测试？如何验证？"
- "未来3年的扩展性如何？技术债务会在哪里积累？"

---

## 引用与路径

| 引用 | 路径/说明 |
|------|-----------|
| Create Story 命令 | `/bmad-bmm-create-story`（或命令文件 `bmad-bmm-create-story.md`） |
| Dev Story 命令 | `/bmad-bmm-dev-story`（或命令文件 `bmad-bmm-dev-story.md`） |
| ralph-method 技能 | `ralph-method` SKILL.md |
| speckit-workflow 技能 | `speckit-workflow` SKILL.md |
| audit-prompts.md §5 | 首选：全局 skills `speckit-workflow/references/audit-prompts.md` 第 5 节（如 `~/.cursor/skills/` 下）；备选：项目内 `{project-root}/docs/speckit/skills/speckit-workflow/references/audit-prompts.md` |
| workflow.xml | `{project-root}/_bmad/core/tasks/workflow.xml` |
| create-story workflow | `{project-root}/_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml` |
| dev-story workflow | `{project-root}/_bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml` |
| party-mode workflow | `{project-root}/_bmad/core/workflows/party-mode/workflow.md` |
| agent-manifest | `{project-root}/_bmad/_config/agent-manifest.csv`（含 displayName 等） |
| implementation_artifacts | `{project-root}/_bmad-output/implementation-artifacts/` |

**说明**：`_bmad` 为项目内安装目录，不提交至版本库；各 worktree 需单独安装 BMAD 后 `_bmad` 路径方存在。

### speckit-workflow引用约束

当本技能执行到"阶段三：Dev Story实施"时，必须遵循以下约束：

1. **流程约束**
   - 必须按顺序执行：specify → plan → GAPS → tasks → 执行
   - 每个阶段必须通过code-review审计才能进入下一阶段
   - 严禁跳过任何阶段或审计

2. **文档约束**
   - Story文档必须包含PRD需求追溯章节
   - spec-E{epic}-S{story}.md必须引用Story文档的功能描述
   - plan-E{epic}-S{story}.md必须包含测试计划
   - tasks-E{epic}-S{story}.md必须包含Architecture组件约束

3. **TDD约束**
   - 必须使用统一的[TDD-RED]/[TDD-GREEN]/[TDD-REFACTOR]格式
   - 必须更新ralph-method进度文件
   - 严禁跳过红灯阶段或重构阶段

4. **审计约束**
   - 优先使用Cursor Task调度code-reviewer
   - code-reviewer不可用时使用mcp_task回退
   - 所有审计必须达到A/B级才能继续

5. **Worktree约束**
   - Story数≤2使用Story级worktree
   - Story数≥3使用Epic级worktree
   - Story分支切换时必须commit/stash未提交变更

**违规处理**：
- 发现违规立即暂停执行
- 记录违规事项和原因
- 根据严重程度决定：警告/返回上一阶段/重新Create Story

---

## 回退机制

当在实施过程中发现重大问题，允许回退到之前的阶段。

### 回退场景和命令

**场景1：speckit阶段发现Story文档不清晰**
- 症状：specify/plan阶段反复审计不通过，原因是需求不明确
- 回退命令：`/bmad-bmm-correct-course epic={num} story={num} reason="需求不清晰"`
- 回退目标：Layer 3 Create Story阶段
- 操作：重新进入party-mode澄清需求，更新Story文档

**场景2：发现技术方案有重大缺陷**
- 症状：plan阶段发现技术方案不可行，需要重新设计
- 回退命令：`/bmad-bmm-correct-course epic={num} story={num} reason="技术方案缺陷"`
- 回退目标：Layer 3 Create Story阶段
- 操作：重新进入party-mode讨论技术方案

**场景3：TDD执行发现架构问题**
- 症状：执行阶段发现需要修改架构才能通过测试
- 回退命令：`/bmad-bmm-correct-course epic={num} story={num} reason="架构问题"`
- 回退目标：speckit plan阶段
- 操作：修改plan-E{epic}-S{story}.md，必要时回到Create Story

**场景4：PRD/Architecture需要变更**
- 症状：实施过程中发现PRD或Architecture有遗漏或错误
- 回退命令：`/bmad-bmm-correct-course epic={num} story={num} reason="PRD变更"`
- 回退目标：Layer 1产品定义层
- 操作：更新PRD/Architecture，重新评估影响范围

### 回退数据保留

回退时保留以下数据：
- 原Story文档（备份为`story-{epic}-{story}-v{N}.md`）
- 已生成的spec/plan（用于参考）
- TDD记录（如有）
- 审计历史记录

### 回退限制（GAP-006 修复：与回滚区分）

- **回退**（correct-course）：回到 Create Story/speckit 等阶段，按 **Story** 计；同一 Story 最多回退 3 次，超过需要 BMad Master 介入
- **回滚**（rollback-worktree）：worktree 从 Epic 级回到 Story 级，按 **Epic** 计；同一 Epic 最多回滚 2 次（见任务 3.6）
- **BMad Master 介入（GAP-037 修复）**：回退>3 次或回滚>2 次时，需用户或项目负责人确认；审批步骤：记录原因 → 用户确认「继续」或「终止」→ 若继续则重置计数
- 回退到 Layer 1 会重置整个 Epic 的规划
- 回退/回滚操作必须记录原因和决策过程
