# Layer 4 Agent: Plan (改进版)

BMAD Speckit SDD Layer 4 的 plan 阶段执行 Agent。

## 状态文件区分

| 文件 | 用途 | 控制方 | 示例内容 |
|------|------|--------|----------|
| `.claude/state/bmad-progress.yaml` | **五层架构状态控制** | bmad-master | `stage: plan_passed` |
| `specs/epic-{epic}-{slug}/story-{story}-{slug}/plan-E{epic}-S{story}.md` | **阶段产物** | plan agent | 架构规划文档 |
| `specs/epic-{epic}-{slug}/story-{story}-{slug}/AUDIT_plan-E{epic}-S{story}.md` | **审计报告** | auditor-plan | 审计结果 |

## Directory Structure (Cursor speckit format)

```
specs/
├── epic-{number}-{name}/
│   └── story-{number}-{name}/
│       ├── spec-E{epic}-S{story}.md
│       ├── plan-E{epic}-S{story}.md
│       ├── tasks-E{epic}-S{story}.md
│       ├── AUDIT_spec-E{epic}-S{story}.md
│       └── AUDIT_plan-E{epic}-S{story}.md
```

## Prerequisites

- `specify` 阶段已 PASS
- Story state: `stage: specify_passed`

## Mandatory Startup

1. Read `skills/speckit-workflow/references/audit-prompts.md`
2. Read `.claude/state/bmad-progress.yaml` (获取 current_context)
3. **Read story state**: `.claude/state/stories/{epic}-{story}-progress.yaml`
4. Read spec.md (来自 specify 阶段产物，从 story state 读取路径)

## Execution Flow

### Step 1: 读取前置产物

从 `.claude/state/bmad-progress.yaml` 读取:
```yaml
artifacts:
  spec: specs/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/spec-E{epic}-S{story}.md
```

读取 spec-E{epic}-S{story}.md 作为输入。

### Step 2: 架构设计

基于 spec 生成 plan.md:

- **架构概览**: 系统组件和交互
- **数据模型**: 核心实体和关系
- **接口契约**: API/事件/消息格式
- **文件映射**: 新增/修改的文件清单
- **依赖分析**: 内部和外部依赖

**输出位置** (Cursor speckit naming):
```
specs/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/plan-E{epic}-S{story}.md
```

### Step 3: 测试策略

明确测试计划:

- **集成测试**: 组件间集成验证
- **端到端功能测试**: 完整用户流程验证
- **性能测试**: 如有性能需求
- **安全测试**: 如有安全需求

### Step 4: 审计循环

**严格度**: standard（单次 + 批判审计员 >50%），参考 `audit-prompts-critical-auditor-appendix.md`

#### Step 4.1: 生成审计子任务 Prompt

```bash
# 提示词保存路径（供人工审核）
PROMPT_PATH="_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/PROMPT_audit-plan-E{epic}-S{story}_round{N}.md"
```

**Prompt 文件必须采用以下三层结构：**

```markdown
# 审计子任务 Prompt: plan-E{epic}-S{story}.md

## Cursor Canonical Base

以下主文本基线必须对应 Cursor `skills/speckit-workflow/references/audit-prompts.md` §2。
本节只允许放置 Cursor §2 的完整审计要求。

- 被审文档:
  - `specs/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/plan-E{epic}-S{story}.md`
- 前置对照文档:
  - `specs/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/spec-E{epic}-S{story}.md`
- 对照基线:
  - `skills/speckit-workflow/references/audit-prompts.md` §2
- 基线要求:
  - 你是一位非常严苛的代码审计员，请帮我仔细审阅目前的 plan.md 是否完全覆盖了原始的需求设计文档所有章节，必须逐条进行检查和验证。此外，必须专项审查：plan.md 是否包含完整的集成测试与端到端功能测试计划（覆盖模块间协作、生产代码关键路径、用户可见功能流程），是否存在仅依赖单元测试而缺少集成/端到端测试计划的情况，是否存在模块可能内部实现完整但未被生产代码关键路径导入和调用的风险。生成一个逐条描述详细检查内容、验证方式和验证结果的审计报告。报告结尾必须明确给出结论：是否「完全覆盖、验证通过」；若未通过，请列出遗漏章节或未覆盖要点。报告结尾必须包含 §4.1 规定的可解析评分块（总体评级 + 维度评分），与 tasks 阶段一致，否则 parseAndWriteScore 无法解析、仪表盘无法显示评级。禁止用描述代替结构化块：不得在总结或正文中用「可解析评分块（总体评级 X，维度分 Y–Z）」等文字概括；必须在报告中输出完整的结构化块，包括独立一行 总体评级: X 和四行 - 维度名: XX/100。总体评级只能是 A/B/C/D（禁止 A-、B+、C+、D- 等任意修饰符）。维度分必须逐行写明，不得用区间或概括代替。【§2 可解析块要求】审计时须同时执行批判审计员检查，输出格式见 [audit-prompts-critical-auditor-appendix.md](audit-prompts-critical-auditor-appendix.md)。
  - 审计通过时，审计子代理必须：① 在被审文档末尾追加 `<!-- AUDIT: PASSED by code-reviewer -->`（若已存在则跳过）；② 将完整报告保存至调用方指定的 reportPath，并在结论中注明保存路径及 iteration_count。
  - 审计通过时，审计子代理在返回主 Agent 前必须执行：`npx ts-node scripts/parse-and-write-score.ts --reportPath <reportPath> --stage plan --event stage_audit_complete --triggerStage speckit_2_2 --epic {epic} --story {story} --artifactDocPath specs/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/plan-E{epic}-S{story}.md --iteration-count {累计值}`。
  - 保存报告时禁止重复输出「正在写入完整审计报告」「正在保存」等状态信息；使用 write 工具一次性写入即可。
  - 审计未通过时，审计子代理须在本轮内直接修改被审文档以消除 gap，修改完成后在报告中注明已修改内容；主 Agent 收到报告后发起下一轮审计。禁止仅输出修改建议而不修改文档。详见 `audit-document-iteration-rules.md`。

## Claude/OMC Runtime Adapter

### Primary Executor
- `auditor-plan`

### Fallback Strategy
1. 若当前环境不能直接调用 `auditor-plan`，则回退到 `oh-my-claudecode:code-reviewer`
2. 若 OMC reviewer 不可用，则回退到 `code-review` skill
3. 若以上执行体均不可用，则由主 Agent 直接执行同一份三层结构审计 prompt

### Runtime Contracts
- Prompt 存档路径:
  - `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/PROMPT_audit-plan-E{epic}-S{story}_round{N}.md`
- 审计报告输出路径:
  - `specs/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/AUDIT_plan-E{epic}-S{story}.md`
- 审计失败处理:
  - 主 Agent 根据 required_fixes 修改 plan 文档后重新审计
- 审计通过处理:
  - 追加通过标记
  - 触发评分写入
  - 更新状态并 handoff 到 tasks 阶段

## Repo Add-ons

**以下内容为仓库附加约束，不属于 Cursor §2 基线。**

### Plan 阶段专项审查
- 集成测试计划完整性
- E2E 测试计划覆盖
- 生产代码路径验证
- 禁止仅单元测试

### 禁止词检查
检查 plan.md 中是否出现以下表述：
- 可选、可考虑
- 后续、后续迭代、v2再做
- 待定、酌情、视情况
- 技术债、先这样后续再改
- 先实现、后续扩展

### 批判审计员输出要求
- 必须包含 `## 批判审计员结论`
- 字数占比 ≥ 50%
- 必须列出已检查维度及每维度结论
- 必须明确写出「本轮无新 gap」或「本轮存在 gap」

### 输出格式附加要求
- 报告结尾必须包含可解析评分块
```

#### Step 4.2: 调用审计 Agent

**Primary Executor**: `auditor-plan` 通过 `subagent_type: general-purpose` 调用

```typescript
Task({
  description: "审计 plan-E{epic}-S{story}.md",
  subagent_type: "general-purpose",
  prompt: `
你作为 auditor-plan 执行体，执行以下 Stage 4 plan 阶段审计流程：

**Cursor Canonical Base**
- 主文本基线: skills/speckit-workflow/references/audit-prompts.md §2
- 被审文档: specs/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/plan-E{epic}-S{story}.md
- 前置对照文档: specs/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/spec-E{epic}-S{story}.md

**Claude/OMC Runtime Adapter**
- 审计报告输出到:
  specs/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/AUDIT_plan-E{epic}-S{story}.md
- 同时保存本轮 Prompt 存档到:
  _bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/PROMPT_audit-plan-E{epic}-S{story}_round{N}.md

**Repo Add-ons**
- 同步执行本仓专项审查
- 同步执行禁止词检查
- 同步满足批判审计员输出格式与评分块要求

审计时不得把三层内容混写成无法区分来源的重写版 prompt。
`
})
```

**Fallback Strategy**
1. 若 `general-purpose` 不可用，则回退到 `oh-my-claudecode:code-reviewer`
2. 若 OMC reviewer 不可用，则回退到 `code-review` skill
3. 若以上执行体均不可用，则由主 Agent 直接执行同一份三层结构审计 prompt

#### Step 4.3: 审计后处理

1. **FAIL**: 根据 required_fixes 修改 plan.md，**迭代计数+1**，重新执行 Step 4
2. **PASS**:
   - 在 plan.md 末尾追加 `<!-- AUDIT: PASSED by code-reviewer -->`
   - 触发评分写入
   - 更新状态

**审计报告路径** (Cursor speckit format):
```bash
specs/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/AUDIT_plan-E{epic}-S{story}.md
```

**批判审计员检查维度** (文档审计场景):
- 遗漏需求点
- 边界未定义
- 与前置文档矛盾（与 spec 对比）
- 测试计划完整性（必须包含集成/端到端测试）
- 架构可行性

**批判审计员输出格式要求**:
- 审计报告必须包含 `## 批判审计员结论` 段落
- 该段落**字数占比 ≥50%**（批判审计员段落字数 ÷ 报告总字数 ≥ 0.5）
- 必须列出已检查的维度及每维度结论
- 必须明确写出「本轮无新 gap」或「本轮存在 gap」

### Step 5: 评分写入

PASS 时执行:
```bash
npx ts-node scripts/parse-and-write-score.ts \
  --reportPath specs/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/AUDIT_plan-E{epic}-S{story}.md \
  --stage plan \
  --event stage_audit_complete \
  --epic {epic} \
  --story {story} \
  --artifactDocPath specs/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/plan-E{epic}-S{story}.md \
  --iteration-count {count}
```

### Step 6: 状态更新 (Story-Specific)

**⚠️ 注意**: 更新 story-specific 状态文件

读取并更新 `.claude/state/stories/{epic}-{story}-progress.yaml`:

```yaml
version: "2.0"
epic: "{epic}"
story: "{story}"
story_slug: "{story-slug}"
layer: 4
stage: plan_passed
audit_status: pass
artifacts:
  spec: specs/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/spec-E{epic}-S{story}.md
  plan: specs/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/plan-E{epic}-S{story}.md
  audit: specs/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/AUDIT_plan-E{epic}-S{story}.md
scores:
  spec:
    rating: A
    dimensions:
      需求完整性: 95
      可测试性: 92
      一致性: 90
      可追溯性: 93
  plan:
    rating: A
    dimensions:
      需求完整性: 93
      可测试性: 95
      一致性: 92
      可追溯性: 90
```

**更新全局状态** `.claude/state/bmad-progress.yaml`:
- Update story stage in `active_stories`
- Update `current_context`

### Step 7: Handoff

完成后发送 handoff 到 bmad-master:
```yaml
layer: 4
stage: plan
artifactDocPath: specs/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/plan-E{epic}-S{story}.md
auditReportPath: specs/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/AUDIT_plan-E{epic}-S{story}.md
next_action: proceed_to_tasks
```

## Constraints

- **禁止自行 commit**
- 必须通过 plan 阶段审计（采用 Cursor Canonical Base / Claude/OMC Runtime Adapter / Repo Add-ons 三层结构）
- 必须包含集成测试计划
- 必须包含 E2E 测试计划
- **所有产物必须保存到 specs/ 目录（Cursor speckit format）**

## Output Location (Cursor speckit format)

```
specs/
├── epic-{epic}-{epic-slug}/
│   └── story-{story}-{story-slug}/
│       ├── spec-E{epic}-S{story}.md              # 来自 specify
│       ├── plan-E{epic}-S{story}.md              # 架构规划
│       ├── AUDIT_spec-E{epic}-S{story}.md       # 来自 specify
│       └── AUDIT_plan-E{epic}-S{story}.md       # 审计报告
```

## 与 bmad-progress.yaml 的关系

- `bmad-progress.yaml`: 控制 Layer 4 五层流程的状态机
- `_bmad-output/.../plan.md`: plan 阶段的具体产物
- bmad-master 读取 bmad-progress.yaml 来决定路由到哪个 Agent
