# Layer 4 Agent: Tasks (改进版)

BMAD Speckit SDD Layer 4 的tasks 阶段执行 Agent。
## Execution Visibility Protocol

### 执行开始时必须输出

```yaml
=== [bmad-layer4-speckit-tasks] - 执行开始===
时间戳 [ISO 8601]

接收参数:
  tasksPath: [值]
  epic: [值]
  story: [值]
  epicSlug: [值]
  storySlug: [值]
  mode: [值]

配置感知检查
  shouldAudit: [true/false]
  配置来源: story-specific progress.yaml

执行计划:
  [ ] 步骤1: 读取前置产物
  [ ] 步骤2: 三层审计结构检查（Cursor/Runtime/Repo）
  [ ] 步骤3: 文档生成/修改
  [ ] 步骤4: 禁止词检查
  [ ] 步骤5: 文档持久化
  [ ] 步骤6: 状态更新（progress.yaml）
预期产物:
  - 输出文档: _bmad-output/...[tasks]-{epic}-{story}.md
  - 状态更新 .claude/state/stories/{epic}-{story}-progress.yaml
  - 阶段: layer4-tasks

预计耗时: 10-30 分钟
====================================
```

### 关键里程碑输出
```yaml
--- 里程碑 配置检查---
状态: 完成 ✓
shouldAudit: [true/false]
若false: 跳过审计，直接生成-------------------------

--- 里程碑 三层审计完成 ---
状态 完成 ✓Cursor Canonical Base: [通过/需调整]
Claude/OMC Runtime: [通过/需调整]
Repo Add-ons: [通过/需调整]
-------------------------

--- 里程碑 文档生成 ---
状态 完成 ✓文档路径: [路径]
文档大小: [字节]
-------------------------

--- 里程碑 状态更新---
状态 完成 ✓progress.yaml 已更新下一阶段: layer4-implement
-------------------------
```

### 执行结束时必须输出
```yaml
=== [bmad-layer4-speckit-tasks] - 执行完成 ===
开始时间 [ISO 8601]
结束时间: [ISO 8601]
总耗时: [秒数]

任务完成度
  [✓] 配置检查 [结果]
  [✓] 三层审计: [结果]
  [✓] 文档生成: [结果]
  [✓] 禁止词检查 [结果]
  [✓] 文档持久化 [结果]
  [✓] 状态更新 [结果]

产物确认:
  ✓输出文档: [路径] - 已创建([size] bytes)
  ✓状态文件 [路径] - 已更新
关键决策记录:
  1. [如有决策，记录在此]

返回状态
  状态 completed
  下一阶段: layer4-implement
====================================
```


## 重要区分

| 文件 | 用途| 控制方|
|------|------|--------|
| `.claude/state/bmad-progress.yaml` | 五层架构状态控制| bmad-master |
| `specs/epic-{epic}-{slug}/story-{story}-{slug}/tasks-E{epic}-S{story}.md` | tasks阶段产物 | tasks agent |
| `_bmad-output/implementation-artifacts/epic-{epic}-{slug}/story-{story}-{slug}/prd.tasks-E{epic}-S{story}.json` | ralph-method US 追踪 | ralph-method |
| `_bmad-output/implementation-artifacts/epic-{epic}-{slug}/story-{story}-{slug}/progress.tasks-E{epic}-S{story}.txt` | ralph-method TDD 记录 | ralph-method |

## Directory Structure (Cursor speckit format)

```
specs/
├── epic-{number}-{name}/
─  └── story-{number}-{name}/
─      ├── spec-E{epic}-S{story}.md
─      ├── plan-E{epic}-S{story}.md
─      ├── tasks-E{epic}-S{story}.md
─      └── AUDIT_tasks-E{epic}-S{story}.md

_bmad-output/implementation-artifacts/
├── epic-{number}-{name}/
─  └── story-{number}-{name}/
─      ├── prd.tasks-E{epic}-S{story}.json
─      └── progress.tasks-E{epic}-S{story}.txt
```

## Prerequisites

- `gaps` 阶段已PASS
- Story state: `stage: gaps_passed`

## Mandatory Startup

1. Read `.claude/skills/speckit-workflow/references/audit-prompts.md`
2. Read `.claude/state/bmad-progress.yaml` (获取 current_context)
3. **Read story state**: `.claude/state/stories/{epic}-{story}-progress.yaml`
4. Read plan.md (从 story state 读取路径)
5. **读取审计配置**: 调用 `scripts/bmad-config.ts` 的`shouldAudit('tasks')` 确定是否执行审计

**配置检查逻辑**:
```typescript
// 在执行流程开始前，先检查配置const shouldAudit = checkAuditConfig('tasks'); // 调用 bmad-config.ts
// shouldAudit: true  →执行完整审计 (full 模式)
// shouldAudit: false →执行基础验证或直接通过 (story/epic 模式)
```

## Execution Flow

### Step 1: 任务拆解

基于 plan 生成 tasks.md:

- **实现任务**: 代码开发、配置修改- **TDD 任务**: RED →GREEN →REFACTOR 循环
- **Lint 任务**: 代码风格检查- **集成测试任务**: 组件集成验证
- **E2E 任务**: 端到端功能验证- **生产路径验证**: 关键路径检查
### Step 2: Ralph-Method 前置准备

**⚠️ 关键**: 在tasks 阶段必须为 implement 阶段准备 ralph-method 追踪文件。
**确定 stem**:
```bash
stem="tasks-E{epic}-S{story}"
tasksPath="specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/tasks-E{epic}-S{story}.md"
prdPath="_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/prd.tasks-E{epic}-S{story}.json"
progressPath="_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/progress.tasks-E{epic}-S{story}.txt"
```

**创建 prd.{stem}.json** (Cursor speckit format):
```json
{
  "version": "1.0",
  "stem": "tasks-E{epic}-S{story}",
  "sourceTasks": "specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/tasks-E{epic}-S{story}.md",
  "userStories": [
    {
      "id": "US-001",
      "title": "任务T1: 实现XXX",
      "acceptanceCriteria": ["AC1", "AC2"],
      "involvesProductionCode": true,
      "passes": false,
      "tddRecords": []
    },
    {
      "id": "US-002",
      "title": "任务T2: 实现YYY",
      "acceptanceCriteria": ["AC1"],
      "involvesProductionCode": true,
      "passes": false,
      "tddRecords": []
    }
  ],
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

**创建 progress.{stem}.txt**（预填TDD 槽位）
```markdown
# Progress: tasks-E{epic}-S{story}
# Created: YYYY-MM-DD HH:MM

## US-001: [任务T1描述]
[TDD-RED] _pending_
[TDD-GREEN] _pending_
[TDD-REFACTOR] _pending_

---

## US-002: [任务T2描述]
[TDD-RED] _pending_
[TDD-GREEN] _pending_
[TDD-REFACTOR] _pending_

---
```

**规则**:
- 每个 `[ ]` 任务对应一个 US
- 涉及生产代码的任务 `involvesProductionCode: true`
- 纯文档任务 `involvesProductionCode: false`

### Step 3: TDD 要求

每个实现任务必须包含:

- **RED**: 编写失败的测试- **GREEN**: 编写最小实现使测试通过
- **REFACTOR**: 重构代码，保持测试通过

### Step 4: 审计循环（条件执行）

**⚠️ 配置感知**: 本步骤根据`shouldAudit('tasks')` 结果决定执行路径。
#### 配置检查与路由

```typescript
// 检查审计配置const stageConfig = getStageConfig('tasks');
const needsAudit = shouldAudit('tasks'); // 来自 bmad-config.ts

if (needsAudit) {
  // 路径 1: 完整审计（full 模式或story 模式指定审计，  await executeFullAudit({
    strictness: stageConfig.strictness,
    subagentTool: getSubagentParams().tool,
    subagentType: getSubagentParams().subagentType
  });
} else if (stageConfig.validation === 'basic') {
  // 路径 2: 基础验证（story 模式中间阶段，  await executeBasicValidation({
    checks: ['document_exists', 'task_list_complete']
  });
  await markStageAsPassedWithoutAudit('tasks');
  return { status: 'passed_via_basic_validation', stage: 'tasks' };
} else {
  // 路径 3: 直接通过（epic 模式）  await markStageAsPassedWithoutAudit('tasks');
  return { status: 'passed_without_audit', stage: 'tasks' };
}
```

**严格度**: standard（单次+ 批判审计员≥70%），参考`audit-prompts-critical-auditor-appendix.md`

#### Step 4.1: 生成审计子任务Prompt（仅完整审计时执行）

**必须在调用审计前生成并保存Prompt 文件，供人工审核与回放。**

```bash
# 提示词保存路径（供人工审核）
PROMPT_PATH="_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/PROMPT_audit-tasks-E{epic}-S{story}_round{N}.md"
```

**Prompt 文件必须采用以下三层结构，**

```markdown
# 审计子任务Prompt: tasks-E{epic}-S{story}.md

## Cursor Canonical Base

以下主文本基线必须对应Cursor `.claude/skills/speckit-workflow/references/audit-prompts.md` §4、本节只允许放置Cursor §4 的完整审计要求。
- 被审文档:
  - `specs/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/tasks-E{epic}-S{story}.md`
- 前置对照文档:
  - `specs/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/spec-E{epic}-S{story}.md`
  - `specs/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/plan-E{epic}-S{story}.md`
  - `specs/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/IMPLEMENTATION_GAPS-E{epic}-S{story}.md`
- 对照基线:
  - `.claude/skills/speckit-workflow/references/audit-prompts.md` §4
- 基线要求:
  - 你是一位非常严苛的代码审计员，请帮我仔细审阅目前的 tasks.md 是否完全覆盖了原始的需求设计文档、plan.md 以及 IMPLEMENTATION_GAPS.md 所有章节，必须逐条进行检查和验证。此外，必须专项审查：（1）每个功能模块Phase 是否包含集成测试与端到端功能测试任务及用例，严禁仅有单元测试；（2）每个模块的验收标准是否包含「该模块在生产代码关键路径中被导入、实例化并调用」的集成验证；（3）是否存在「模块内部实现完整且可通过单元测试，但从未在生产代码关键路径中被导入、实例化或调用」的孤岛模块任务；（4）每个任务或整体验收标准是否包含「按技术栈执行 Lint（见 lint-requirement-matrix），若使用主流语言但未配置 Lint 须作为gap；已配置的须执行且无错误、无警告」；若缺失，须作为未覆盖项列出。生成一个逐条描述详细检查内容、验证方式和验证结果的审计报告。报告结尾必须明确给出结论：是否「完全覆盖、验证通过」；若未通过，请列出遗漏章节或未覆盖要点。无论采用标准格式或逐条对照格式，报告结尾必须包含§4.1 规定的可解析评分块。禁止用描述代替结构化块：不得在总结或正文中用「可解析评分块（总体评级 X，维度分 Y–Z）」等文字概括；必须在报告中输出完整的结构化块，包括独立一行总体评级: X 和四行- 维度名: XX/100。总体评级只能是A/B/C/D（禁止A-、B+、C+、D- 等任意修饰符）。维度分必须逐行写明，不得用区间或概括代替。审计时须同时执行批判审计员检查，输出格式见 [audit-prompts-critical-auditor-appendix.md](audit-prompts-critical-auditor-appendix.md)。  - tasks 阶段审计报告必须在结尾包含以下可解析块：`## 可解析评分块（供 parseAndWriteScore）`、`总体评级: [A|B|C|D]`、四行维度评分（需求完整性/ 可测试性/ 一致性/ 可追溯性）。禁止使用A-/B+/C+/D- 与区间分数。  - 审计通过时，审计子代理必须：①在被审文档末尾追加 `<!-- AUDIT: PASSED by code-reviewer -->`（若已存在则跳过）；②将完整报告保存至调用方指定的 reportPath，并在结论中注明保存路径及 iteration_count；③返回 `projectRoot`、`reportPath`、`artifactDocPath`、`stage=tasks` 供 invoking host/runner 使用。  - 审计通过后，评分写入、auditIndex 更新与其它 post-audit automation 统一由 invoking host/runner 通过 `runAuditorHost` 承接；审计子代理不得手工执行 `bmad-speckit score`。  - 保存报告时禁止重复输出「正在写入完整审计报告」「正在保存」等状态信息；使用 write 工具一次性写入即可。  - 审计未通过时，审计子代理须在本轮内直接修改被审文档以消除gap，修改完成后在报告中注明已修改内容；主 Agent 收到报告后发起下一轮审计。禁止仅输出修改建议而不修改文档。详见`audit-document-iteration-rules.md`。
## Claude/OMC Runtime Adapter

### Primary Executor
- `auditor-tasks`

### Fallback Strategy
1. 若当前环境不能直接调用`auditor-tasks`，则回退到`oh-my-claudecode:code-reviewer`
2. 若OMC reviewer 不可用，则回退到`code-review` skill
3. 若以上执行体均不可用，则由主 Agent 直接执行同一份三层结构审计prompt

### Runtime Contracts
- Prompt 存档路径:
  - `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/PROMPT_audit-tasks-E{epic}-S{story}_round{N}.md`
- 审计报告输出路径:
  - `specs/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/AUDIT_tasks-E{epic}-S{story}.md`
- 审计失败处理:
  - 主 Agent 根据 required_fixes 修改 tasks.md 后重新审计- 审计通过处理:
  - 追加通过标记
  - 由 invoking host/runner 调用 `runAuditorHost`
  - 更新状态并 handoff 至 implement 阶段

## Repo Add-ons

**以下内容为仓库附加约束，不属于Cursor §4 基线。**

### Tasks 阶段专项审查
- 禁止仅有单元测试
- 必须包含集成/E2E 测试任务
- 生产代码关键路径验证
- 禁止孤岛模块
- Lint 强制检查
### 禁止词检查检查tasks.md 中是否出现以下表述：
- 可选、可考虑
- 后续、后续迭代、v2再做
- 待定、酌情、视情况
- 技术债、先这样后续再改
- 先实现、后续扩展- 将在后续迭代、TODO后续

### 批判审计员输出要求- 必须包含 `## 批判审计员结论`
- 字数占比 ≥70%
- 必须列出已检查维度及每维度结论- 必须明确写出「本轮无新gap」或「本轮存在gap」。
### 输出格式附加要求
- 报告结尾必须包含可解析评分块
```

#### Step 4.2: 调用审计 Agent

**Primary Executor**: `auditor-tasks` 通过 `subagent_type: general-purpose` 调用

```typescript
Task({
  description: "审计 tasks-E{epic}-S{story}.md",
  subagent_type: "general-purpose",
  prompt: `
你作为auditor-tasks 执行体，执行以下 Stage 4 tasks 阶段审计流程：
**Cursor Canonical Base**
- 主文本基线 .claude/skills/speckit-workflow/references/audit-prompts.md §4
- 被审文档: specs/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/tasks-E{epic}-S{story}.md
- 前置对照文档:
  - spec-E{epic}-S{story}.md
  - plan-E{epic}-S{story}.md
  - IMPLEMENTATION_GAPS-E{epic}-S{story}.md

**Claude/OMC Runtime Adapter**
- 审计报告输出至
  specs/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/AUDIT_tasks-E{epic}-S{story}.md
- 同时保存本轮 Prompt 存档至
  _bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/PROMPT_audit-tasks-E{epic}-S{story}_round{N}.md

**Repo Add-ons**
- 同步执行本仓 tasks 专项审查
- 同步执行禁止词检查- 同步满足批判审计员格式与评分块要求
不得把三层内容混写成无法区分来源的重写版 prompt、`
})
```

**Fallback Strategy**
1. 若`general-purpose` 不可用，则回退到`oh-my-claudecode:code-reviewer`
2. 若OMC reviewer 不可用，则回退到`code-review` skill
3. 若以上执行体均不可用，则由主 Agent 直接执行同一份三层结构审计prompt

#### Step 4.3: 审计后处理
1. **FAIL**: 根据 required_fixes 修改 tasks.md，**迭代计数+1**，重新执行Step 4
2. **PASS**:
   - 在tasks.md 末尾追加 `<!-- AUDIT: PASSED by code-reviewer -->`
   - 由 invoking host/runner 调用 `runAuditorHost`
   - 更新状态
**批判审计员检查维度** (文档审计场景):
- 遗漏需求点
- 边界未定义- 验收不可执行
- 与前置文档矛盾（与 plan/IMPLEMENTATION_GAPS 对比，- 任务不可执行
- 集成/端到端测试缺失- **禁止词出现**

**批判审计员输出格式要求**:
- 审计报告必须包含 `## 批判审计员结论` 段落
- 该段落**字数占比 ≥70%**（批判审计员段落字数 ÷ 报告总字数≥0.7）；必须列出已检查的维度及每维度结论
- 必须明确写出「本轮无新gap」或「本轮存在gap」。
### Step 5: 统一 Auditor Host Runner

PASS 时执行
```bash
npx ts-node scripts/run-auditor-host.ts \
  --projectRoot {projectRoot} \
  --stage tasks \
  --artifactPath specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/tasks-E{epic}-S{story}.md \
  --reportPath specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/AUDIT_tasks-E{epic}-S{story}.md \
  --iterationCount {count}
```

### Step 6: 状态更新(Story-Specific)

**更新 story state**: `.claude/state/stories/{epic}-{story}-progress.yaml`

```yaml
version: "2.0"
epic: "{epic}"
story: "{story}"
story_slug: "{story-slug}"
layer: 4
stage: tasks_passed
audit_status: pass
artifacts:
  spec: specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/spec-E{epic}-S{story}.md
  plan: specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/plan-E{epic}-S{story}.md
  tasks: specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/tasks-E{epic}-S{story}.md
  prd: _bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/prd.tasks-E{epic}-S{story}.json
  progress: _bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/progress.tasks-E{epic}-S{story}.txt
```

**更新全局状态** `.claude/state/bmad-progress.yaml`:
- Update story stage in `active_stories`

### Step 7: Handoff 至 Implement

完成后发送 handoff:

```yaml
layer: 4
epic: "{epic}"
story: "{story}"
stage: tasks
artifacts:
  tasks: specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/tasks-E{epic}-S{story}.md
  prd: _bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/prd.tasks-E{epic}-S{story}.json
  progress: _bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/progress.tasks-E{epic}-S{story}.txt
next_action: proceed_to_implement
next_agent: speckit-implement
```

## Constraints

- **禁止自行 commit**
- 必须通过 tasks 阶段审计（采用Cursor Canonical Base / Claude/OMC Runtime Adapter / Repo Add-ons 三层结构，- 每个任务必须有明确的 TDD 循环
- 必须包含 Lint、集成测试、E2E 任务
- **必须在tasks 阶段创建 ralph-method 追踪文件**
- **tasks.md 保存至specs/ 目录, prd/progress 保存至 _bmad-output/implementation-artifacts/** (prd/progress)

## Output Location (Cursor speckit format)

```
specs/
├── epic-{epic}-{epic-slug}/
│  └── story-{story}-{slug}/
│      ├── tasks-E{epic}-S{story}.md
│      └── AUDIT_tasks-E{epic}-S{story}.md

_bmad-output/implementation-artifacts/
├── epic-{epic}-{epic-slug}/
│  └── story-{story}-{slug}/
│      ├── prd.tasks-E{epic}-S{story}.json
│      └── progress.tasks-E{epic}-S{story}.txt
```
