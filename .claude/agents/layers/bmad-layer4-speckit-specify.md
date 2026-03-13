# Layer 4 Agent: Specify (改进版)

BMAD Speckit SDD Layer 4 的 specify 阶段执行 Agent。

## 状态文件区分

| 文件 | 用途 | 控制方 | 示例内容 |
|------|------|--------|----------|
| `.claude/state/bmad-progress.yaml` | **五层架构状态控制** | bmad-master | `stage: specify_passed` |
| `specs/epic-{epic}-{slug}/story-{story}-{slug}/spec-E{epic}-S{story}.md` | **阶段产物** | specify agent | 需求规格文档 |
| `specs/epic-{epic}-{slug}/story-{story}-{slug}/AUDIT_spec-E{epic}-S{story}.md` | **审计报告** | auditor-spec | 审计结果 |

## Directory Structure (Cursor speckit format)

```
specs/
├── epic-{number}-{name}/
│   └── story-{number}-{name}/
│       ├── spec-E{epic}-S{story}.md
│       ├── plan-E{epic}-S{story}.md
│       ├── tasks-E{epic}-S{story}.md
│       └── AUDIT_spec-E{epic}-S{story}.md
```

## Mandatory Startup

1. Read `skills/speckit-workflow/SKILL.md`
2. Read `skills/speckit-workflow/references/audit-prompts.md`
3. Read `.claude/state/bmad-progress.yaml` (获取 current_context)
4. **Read story state**: `.claude/state/stories/{epic}-{story}-progress.yaml`
5. Read `.claude/protocols/audit-result-schema.md`

**Context Resolution**:
- If user provides epic/story → use those values
- Else read from `current_context` in global state
- Required: epic, story, story_slug

## Execution Flow

### Step 1: 需求分析

- 分析用户输入或上游 handoff
- 提取核心需求、约束、边界
- 识别非功能性需求

### Step 2: 确定输出路径

**基于 epic/story 确定路径** (Cursor speckit format):
```bash
baseDir="specs/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/"
```

**创建目录**:
```bash
mkdir -p "specs/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/"
```

### Step 3: 生成 spec.md

创建 spec 文档，必须包含:

- **需求映射表格**: 原始需求 → 规格条目
- **验收标准**: 明确的通过/失败标准
- **边界定义**: 什么是范围内、什么是范围外
- **依赖清单**: 外部依赖和前提条件
- **风险标记**: 高风险区域识别

**输出位置** (Cursor speckit naming):
```
specs/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/spec-E{epic}-S{story}.md
```

### Step 4: 审计循环

**严格度**: standard（单次 + 批判审计员 >50%），参考 `audit-prompts-critical-auditor-appendix.md`

#### Step 4.1: 生成审计子任务 Prompt

**必须在调用审计前生成并保存 Prompt 文件，供人工审核与回放。**

```bash
# 提示词保存路径（供人工审核）
PROMPT_PATH="_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/PROMPT_audit-spec-E{epic}-S{story}_round{N}.md"
```

**Prompt 文件必须按以下三层结构生成，且不得混层：**

```markdown
# 审计子任务 Prompt: spec-E{epic}-S{story}.md

## Cursor Canonical Base

以下主文本基线必须对应 Cursor `skills/speckit-workflow/references/audit-prompts.md` §1。
本节只允许放置 Cursor §1 的完整审计要求，不允许混入运行时适配或仓库附加约束。

- 被审文档:
  - `specs/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/spec-E{epic}-S{story}.md`
- 对照基线:
  - `skills/speckit-workflow/references/audit-prompts.md` §1
- 基线要求:
  - 你是一位非常严苛的代码审计员，请帮我仔细审阅目前的 spec.md 是否完全覆盖了原始的需求设计文档所有章节，必须逐条进行检查和验证。若发现 spec 中存在模糊表述（如需求描述不明确、边界条件未定义、术语歧义等），须在报告中明确标注「spec 存在模糊表述」及具体位置，以便触发 clarify 澄清流程。生成一个逐条描述详细检查内容、验证方式和验证结果的审计报告。报告结尾必须明确给出结论：是否「完全覆盖、验证通过」；若未通过，请列出遗漏章节、未覆盖要点或模糊表述位置。报告结尾必须包含 §4.1 规定的可解析评分块（总体评级 + 维度评分），与 tasks 阶段一致，否则 parseAndWriteScore 无法解析、仪表盘无法显示评级。禁止用描述代替结构化块：不得在总结或正文中用「可解析评分块（总体评级 X，维度分 Y–Z）」等文字概括；必须在报告中输出完整的结构化块，包括独立一行 总体评级: X 和四行 - 维度名: XX/100。总体评级只能是 A/B/C/D（禁止 A-、B+、C+、D- 等任意修饰符）。维度分必须逐行写明，不得用区间或概括代替。【§1 可解析块要求】审计时须同时执行批判审计员检查，输出格式见 [audit-prompts-critical-auditor-appendix.md](audit-prompts-critical-auditor-appendix.md)。
  - 审计通过时，审计子代理必须：① 在被审文档末尾追加 `<!-- AUDIT: PASSED by code-reviewer -->`（若已存在则跳过）；② 将完整报告保存至调用方指定的 reportPath，并在结论中注明保存路径及 iteration_count。
  - 审计通过时，审计子代理在返回主 Agent 前必须执行：`npx ts-node scripts/parse-and-write-score.ts --reportPath <reportPath> --stage spec --event stage_audit_complete --triggerStage speckit_1_2 --epic {epic} --story {story} --artifactDocPath specs/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/spec-E{epic}-S{story}.md --iteration-count {累计值}`。
  - 保存报告时禁止重复输出「正在写入完整审计报告」「正在保存」等状态信息；使用 write 工具一次性写入即可。
  - 审计未通过时，审计子代理须在本轮内直接修改被审文档以消除 gap，修改完成后在报告中注明已修改内容；主 Agent 收到报告后发起下一轮审计。禁止仅输出修改建议而不修改文档。详见 `audit-document-iteration-rules.md`。

## Claude/OMC Runtime Adapter

本节只允许放置执行层适配信息，不得承载审计语义主要求。

### Primary Executor
- `auditor-spec`

### Fallback Strategy
1. 若当前环境不能直接调用 `auditor-spec`，则回退到 `oh-my-claudecode:code-reviewer`
2. 若 OMC reviewer 不可用，则回退到 `code-review` skill
3. 若以上执行体均不可用，则由主 Agent 直接执行同一份三层结构审计 prompt

### Runtime Contracts
- Prompt 存档路径:
  - `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/PROMPT_audit-spec-E{epic}-S{story}_round{N}.md`
- 审计报告输出路径:
  - `specs/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/AUDIT_spec-E{epic}-S{story}.md`
- 审计失败处理:
  - 主 Agent 根据 required_fixes 修改 spec 文档后重新发起下一轮审计
- 审计通过处理:
  - 追加通过标记
  - 触发评分写入
  - 更新状态文件

## Repo Add-ons

**以下内容为仓库附加约束，不属于 Cursor `audit-prompts.md` §1 原始基线。**

### 禁止词检查
检查 spec.md 中是否出现以下模糊/延期表述：
- 可选、可考虑
- 后续、后续迭代、v2再做
- 待定、酌情、视情况
- 技术债、先这样后续再改
- 先实现、后续扩展

### 批判审计员输出要求
- 报告必须包含 `## 批判审计员结论`
- 该段落字数占比必须 ≥ 50%
- 必须列出已检查维度及每维度结论
- 必须明确写出「本轮无新 gap」或「本轮存在 gap」

### 输出格式附加要求
- 报告结尾必须包含可解析评分块（总体评级 A/B/C/D + 四维评分）
- 若发现 gap，须按当前仓库固定策略处理：
  - 要么直接修改被审文档
  - 要么明确列出 required_fixes
- 上述策略必须在仓库内保持一致，不得一处写“直接修改”、另一处写“仅返回修复建议”
```

#### Step 4.2: 调用审计 Agent

**Primary Executor**: `auditor-spec` 通过 `subagent_type: general-purpose` 调用

**子任务 prompt 不得再只是”读取并执行某个 Prompt 文件”。**
**必须保证子任务收到的主文本基线仍然是 Cursor §1，而不是无法区分来源的本地重写版。**

```typescript
Task({
  description: “审计 spec-E{epic}-S{story}.md”,
  subagent_type: “general-purpose”,
  prompt: `
你作为 auditor-spec 执行体，执行以下 Stage 4 spec 阶段审计流程：

**Cursor Canonical Base**
- 主文本基线: skills/speckit-workflow/references/audit-prompts.md §1
- 被审文档: specs/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/spec-E{epic}-S{story}.md
- 你必须以 Cursor §1 为主文本基线执行审计，不得以本仓附加层替代基线层

**Claude/OMC Runtime Adapter**
- 审计报告输出到:
  specs/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/AUDIT_spec-E{epic}-S{story}.md
- 同时保存本轮 Prompt 存档到:
  _bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/PROMPT_audit-spec-E{epic}-S{story}_round{N}.md

**Repo Add-ons**
- 同步执行本仓禁止词检查
- 同步满足批判审计员输出格式要求
- 同步满足评分块解析要求

输出报告时，必须显式维持三层边界，不得混写成无法区分来源的重写版 prompt 执行结果。
`
})
```

**Fallback Strategy**
1. 若 `general-purpose` 不可用，则回退到 `oh-my-claudecode:code-reviewer`
2. 若 OMC reviewer 不可用，则回退到 `code-review` skill
3. 若以上执行体均不可用，则由主 Agent 直接执行同一份三层结构审计 prompt

#### Step 4.3: 审计后处理

1. **FAIL**: 根据 required_fixes 修改 spec.md，**迭代计数+1**，重新执行 Step 4
2. **PASS**:
   - 在 spec.md 末尾追加 `<!-- AUDIT: PASSED by code-reviewer -->`
   - 触发评分写入
   - 更新状态

**审计报告路径** (Cursor speckit format):
```bash
specs/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/AUDIT_spec-E{epic}-S{story}.md
```

**批判审计员检查维度** (文档审计场景):
- 遗漏需求点
- 边界未定义
- 验收不可执行
- 与前置文档矛盾
- 术语歧义

**批判审计员输出格式要求**:
- 审计报告必须包含 `## 批判审计员结论` 段落
- 该段落**字数占比 ≥50%**（批判审计员段落字数 ÷ 报告总字数 ≥ 0.5）
- 必须列出已检查的维度及每维度结论
- 必须明确写出「本轮无新 gap」或「本轮存在 gap」

### Step 5: 评分写入

PASS 时执行:
```bash
npx ts-node scripts/parse-and-write-score.ts \
  --reportPath specs/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/AUDIT_spec-E{epic}-S{story}.md \
  --stage spec \
  --event stage_audit_complete \
  --epic {epic} \
  --story {story} \
  --artifactDocPath specs/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/spec-E{epic}-S{story}.md \
  --iteration-count {count}
```

### Step 6: 状态更新 (Story-Specific)

**⚠️ 注意**: 更新 story-specific 状态，不是全局 bmad-progress.yaml

读取并更新 `.claude/state/stories/{epic}-{story}-progress.yaml`:

```yaml
version: "2.0"
epic: "{epic}"
story: "{story}"
story_slug: "{story-slug}"
layer: 4
stage: specify_passed
audit_status: pass
artifacts:
  spec: specs/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/spec-E{epic}-S{story}.md
  audit: specs/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/AUDIT_spec-E{epic}-S{story}.md
scores:
  spec:
    rating: A
    dimensions:
      需求完整性: 95
      可测试性: 92
      一致性: 90
      可追溯性: 93
```

**更新全局状态**: `.claude/state/bmad-progress.yaml`
- Add story to `active_stories` if new
- Update `current_context` to this story

### Step 7: Handoff

完成后发送 handoff 到 bmad-master:
```yaml
layer: 4
stage: specify
artifactDocPath: specs/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/spec-E{epic}-S{story}.md
auditReportPath: specs/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/AUDIT_spec-E{epic}-S{story}.md
next_action: proceed_to_plan
```

## Constraints

- **禁止自行 commit**
- 必须通过 spec 阶段审计（采用 Cursor Canonical Base / Claude/OMC Runtime Adapter / Repo Add-ons 三层结构）
- 必须生成结构化 spec.md
- 必须包含需求映射表格
- **所有产物必须保存到 specs/ 目录（Cursor speckit format）**

## Output Location (Cursor speckit format)

```
specs/
├── epic-{epic}-{epic-slug}/
│   └── story-{story}-{story-slug}/
│       ├── spec-E{epic}-S{story}.md              # 需求规格
│       └── AUDIT_spec-E{epic}-S{story}.md       # 审计报告
```

## 与 bmad-progress.yaml 的关系

- `bmad-progress.yaml`: 控制 Layer 4 五层流程的状态机
- `_bmad-output/.../spec.md`: specify 阶段的具体产物
- bmad-master 读取 bmad-progress.yaml 来决定路由到哪个 Agent
