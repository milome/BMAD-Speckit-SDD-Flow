# Cursor Speckit-Workflow → Claude Code CLI 完整映射

> **目标**: 零裁剪、完整准确地将 Cursor 的 speckit-workflow 适配到 Claude Code CLI

---

## Runtime Dashboard / Training-Ready SFT 子命令

这组命令不是新的 speckit 主阶段，而是 runtime 观测、agent 工具接入、以及训练数据产出的稳定入口。

| 命令                                                 | 用途                                                                 | 关键输出                                                                                                                                                 |
| ---------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bmad-speckit dashboard --json --output-json <path>` | 生成 dashboard markdown，并落一份 runtime snapshot JSON              | `_bmad-output/dashboard/runtime-dashboard.json`，顶层含 `selection` / `overview` / `runtime_context` / `stage_timeline` / `score_detail` / `sft_summary` |
| `bmad-speckit dashboard-live`                        | 启动本地 live dashboard web server                                   | stdout 打印 URL；提供 `/health`、`/api/snapshot`、`/api/runtime-context`、`/api/stage-timeline`、`/api/score-detail`、`/api/sft-summary`                 |
| `bmad-speckit runtime-mcp`                           | 以 stdio 启动 runtime dashboard MCP server                           | 默认 `MCP-first`；若未提供 `--dashboard-url`，会自动拉起 live dashboard                                                                                  |
| `bmad-speckit sft-preview`                           | 预览 canonical SFT 候选集                                            | JSON；含 accepted / rejected / downgraded、split 统计                                                                                                    |
| `bmad-speckit sft-validate`                          | 校验 `CanonicalSftSample` 与目标导出兼容性                           | JSON；含 `schema_valid`、`invalid_samples`、`rejected_samples`                                                                                           |
| `bmad-speckit sft-bundle`                            | 写出 training-ready bundle                                           | bundle 目录、`manifest.json`、`validation-report.json`、`rejection-report.json`                                                                          |
| `bmad-speckit sft-extract`                           | 兼容旧版 JSONL 导出；非 legacy target 时复用 canonical bundle writer | `legacy_instruction_io` 或 `openai_chat` / `hf_conversational` / `hf_tool_calling`                                                                       |

### Runtime 连接边界

- Agent runtime：`MCP-first`
- UI 展示：`webserver-independent fallback`
- CLI dataset 命令：优先读 `BMAD_RUNTIME_DASHBOARD_URL` / `RUNTIME_DASHBOARD_URL` 对应的 live dashboard；未提供时回退本地 shared core

### 推荐命令

```bash
npx bmad-speckit dashboard-live
npx bmad-speckit runtime-mcp --dashboard-port 43123
npx bmad-speckit dashboard --json --include-runtime
npx bmad-speckit sft-preview --target openai_chat
npx bmad-speckit sft-validate --target hf_tool_calling
npx bmad-speckit sft-bundle --target hf_conversational --bundle-dir _bmad-output/datasets
```

---

## 一、命令映射总表

| Speckit 命令     | Cursor 形式                     | Claude Code CLI 形式                       | 阶段      | 前置条件               | 产出文档                                  |
| ---------------- | ------------------------------- | ------------------------------------------ | --------- | ---------------------- | ----------------------------------------- |
| **constitution** | `/speckit.constitution`         | `claude-code --agent speckit-constitution` | §0.5      | 无                     | `constitution.md`                         |
| **specify**      | `/speckit.specify`              | `claude-code --agent speckit-specify`      | §1        | constitution 通过审计  | `spec-E{epic}-S{story}.md`                |
| **plan**         | `/speckit.plan`                 | `claude-code --agent speckit-plan`         | §2        | spec 通过审计          | `plan-E{epic}-S{story}.md`                |
| **GAPS**         | `/speckit.gaps`（兼容自动触发） | `claude-code --agent speckit-gaps`         | §3        | plan 通过审计          | `IMPLEMENTATION_GAPS-E{epic}-S{story}.md` |
| **tasks**        | `/speckit.tasks`                | `claude-code --agent speckit-tasks`        | §4        | GAPS 通过审计          | `tasks-E{epic}-S{story}.md`               |
| **implement**    | `/speckit.implement`            | `claude-code --agent speckit-implement`    | §5        | tasks 通过审计         | 可运行代码 + 测试                         |
| **clarify**      | `/speckit.clarify`              | `claude-code --agent speckit-clarify`      | §1.2 内嵌 | spec 审计发现模糊      | 更新后的 spec.md                          |
| **checklist**    | `/speckit.checklist`            | `claude-code --agent speckit-checklist`    | §2.2 内嵌 | plan 多模块/复杂       | 质量检查清单                              |
| **analyze**      | `/speckit.analyze`              | `claude-code --agent speckit-analyze`      | §4.2 内嵌 | tasks≥10 或跨 artifact | 一致性分析报告                            |

---

## 一点五、Wave 2 标准工具命令

Wave 2 把前面新增的 journey / trace / closure contract 接成了可执行工具。它们不是新的 speckit 主阶段，而是配套的本地/CI 标准检查入口。

### 1. Readiness Gate

直接调用 Python:

```bash
python _bmad/speckit/scripts/python/readiness_gate.py \
  --journey-ledger _bmad/speckit/scripts/templates/journey-ledger.template.json \
  --trace-map _bmad/speckit/scripts/templates/trace-map.template.json \
  --artifact-root _bmad/speckit/scripts/templates
```

PowerShell wrapper:

```powershell
./_bmad/speckit/scripts/powershell/run-readiness-gate.ps1 `
  -JourneyLedger _bmad/speckit/scripts/templates/journey-ledger.template.json `
  -TraceMap _bmad/speckit/scripts/templates/trace-map.template.json `
  -ArtifactRoot _bmad/speckit/scripts/templates
```

Shell wrapper:

```bash
./_bmad/speckit/scripts/shell/run-readiness-gate.sh \
  --journey-ledger _bmad/speckit/scripts/templates/journey-ledger.template.json \
  --trace-map _bmad/speckit/scripts/templates/trace-map.template.json \
  --artifact-root _bmad/speckit/scripts/templates
```

Readiness gate 最少检查：

- `journey-ledger` 必填字段与 smoke generatability
- `trace-map` 与 journey task / smoke / closure 的一致性
- closure note 是否真实存在并带有关键 marker
- blocker words / placeholder / 静默假设痕迹

### 2. Ambiguity Linter

```bash
python _bmad/speckit/scripts/python/ambiguity_linter.py \
  docs/reference/speckit-journey-ledger.schema.json \
  docs/reference/speckit-trace-map.schema.json
```

```powershell
./_bmad/speckit/scripts/powershell/run-ambiguity-linter.ps1 `
  docs/reference/speckit-journey-ledger.schema.json `
  docs/reference/speckit-trace-map.schema.json
```

用途：

- 抓 `TODO` / `TBD` / `FIXME` / `???`
- 抓 `后续补齐` / `默认如此` / `later wire in` 之类 silent assumption
- 抓角色、完成态仍是 placeholder 的文档

### 3. Generate Smoke Skeleton

```bash
python _bmad/speckit/scripts/python/generate_smoke_skeleton.py \
  --journey-ledger _bmad/speckit/scripts/templates/journey-ledger.template.json \
  --output-root tests/e2e/smoke
```

```powershell
./_bmad/speckit/scripts/powershell/generate-smoke-skeleton.ps1 `
  -JourneyLedger _bmad/speckit/scripts/templates/journey-ledger.template.json `
  -OutputRoot tests/e2e/smoke
```

规则：

- 生成的是最小 smoke skeleton，不代表真实 E2E 已完成
- 生成文件后仍需补齐用户可见完成态断言、fixture 需求、验证命令
- 推荐把 `tests/e2e/smoke/` 作为 PR gate，把 `tests/e2e/full/` 作为更重的 nightly / broader matrix

---

## 二、完整流程映射

### Layer 3 → Layer 4 → Layer 5 流程

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Layer 3: Create Story                             │
│                     (bmad-story-assistant / Layer 3 Agent)                  │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │ Handoff: Story 文档 + Epic/Story 编号
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Layer 4: Speckit Workflow                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  §0.5 constitution    ┌─────────────────┐                                  │
│  ───────────────────→ │ 生成constitution │ ──→ code-review 审计 §0.5.2       │
│                       │     .md         │    (standard 严格度)              │
│                       └─────────────────┘                                  │
│                                │                                            │
│                                ▼ (审计通过)                                 │
│                                                                             │
│  §1 specify           ┌─────────────────┐                                  │
│  ───────────────────→ │  生成spec.md    │ ──→ code-review 审计 §1.2         │
│                       │ + 需求映射表格   │    (standard + 批判审计员)         │
│                       │ + 验收标准      │ ──→ parse-and-write-score         │
│                       │ + 边界定义      │                                  │
│                       └─────────────────┘                                  │
│                                │                                            │
│              ┌─────────────────┴─────────────────┐                         │
│              │ 审计发现「模糊表述」                │                         │
│              ▼                                   │ (审计通过)               │
│  §1.2 clarify┌─────────────────┐                 │                         │
│  (内嵌) ───→ │ 澄清 → 更新spec  │ ────────────────┘                         │
│              │ 再次审计 §1.2    │                                           │
│              └─────────────────┘                                           │
│                                                                             │
│                                ▼                                            │
│                                                                             │
│  §2 plan              ┌─────────────────┐                                  │
│  ───────────────────→ │  生成plan.md    │ ──→ code-review 审计 §2.2         │
│                       │ + 需求映射表格   │    (standard + 批判审计员)         │
│                       │ + 集成/端到端测试│ ──→ parse-and-write-score         │
│                       │ + 技术架构      │                                  │
│                       └─────────────────┘                                  │
│                                │                                            │
│              ┌─────────────────┴─────────────────┐                         │
│              │ plan 多模块/复杂架构                │                         │
│              ▼                                   │ (审计通过)               │
│  §2.2 checklist┌────────────────┐                │                         │
│  (内嵌) ───→ │ 生成质量检查清单  │ ──→ 若发现问题   │                         │
│              │ 验证需求完整性   │    迭代plan → 再次审计                    │
│              └────────────────┘                                           │
│                                                                             │
│                                ▼                                            │
│                                                                             │
│  §3 GAPS              ┌─────────────────────────┐                          │
│  ───────────────────→ │ /speckit.gaps 正式入口   │ ──→ code-review 审计 §3.2  │
│                       │ 兼容自动触发 / 深度分析   │    (standard + 批判审计员)  │
│                       │ 生成IMPLEMENTATION_GAPS  │ ──→ parse-and-write-score  │
│                       └─────────────────────────┘                          │
│                                │                                            │
│                                ▼ (审计通过)                                 │
│                                                                             │
│  §4 tasks             ┌─────────────────────────┐                          │
│  ───────────────────→ │   生成tasks.md          │ ──→ code-review 审计 §4.2  │
│                       │ + 需求映射表格           │    (standard + 批判审计员)  │
│                       │ + GAP → 任务映射         │ ──→ parse-and-write-score  │
│                       │ + 集成/端到端测试用例     │                          │
│                       │ + 验收标准              │                          │
│                       └─────────────────────────┘                          │
│                                │                                            │
│              ┌─────────────────┴─────────────────┐                         │
│              │ tasks≥10 或跨多artifact           │                         │
│              ▼                                   │ (审计通过)               │
│  §4.2 analyze┌────────────────┐                 │                         │
│  (内嵌) ───→ │ 跨artifact一致性分析│ ──→ 若发现问题  │                         │
│              │ spec/plan/tasks对齐 │    迭代tasks → 再次审计                  │
│              └────────────────┘                 ▼                         │
│                                                                             │
│  §5 implement         ┌─────────────────────────────────────────────┐      │
│  ───────────────────→ │ 执行tasks.md中的任务(TDD红绿灯模式)          │      │
│                       │ 1. 【强制前置】创建prd.json + progress.txt    │      │
│                       │ 2. 【预填TDD槽位】[TDD-RED]/[TDD-GREEN]/[TDD-REFACTOR]│
│                       │ 3. 逐任务执行RED→GREEN→REFACTOR              │      │
│                       │ 4. 每完成US更新prd passes=true               │      │
│                       │ 5. 每完成US更新progress [TDD-XXX]            │      │
│                       │ 6. 检查点审计(batch间)                        │      │
│                       │ 7. 最终审计 §5.2 (strict: 连续3轮无gap)       │      │
│                       └─────────────────────────────────────────────┘      │
│                                                                             │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │ Handoff: 可运行代码 + 测试报告 + 审计报告
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Layer 5: 收尾与集成                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 三、输入/输出/控制文件映射

### 3.1 产出文档路径

| 阶段         | BMAD 路径格式                                                                                       | Standalone 路径格式                           |
| ------------ | --------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| constitution | `.claude/memory/constitution.md`                                                                    | `constitution.md`                             |
| spec         | `specs/epic-{epic}-{slug}/story-{story}-{slug}/spec-E{epic}-S{story}.md`                            | `specs/{index}-{name}/spec.md`                |
| plan         | `specs/epic-{epic}-{slug}/story-{story}-{slug}/plan-E{epic}-S{story}.md`                            | `specs/{index}-{name}/plan.md`                |
| GAPS         | `specs/epic-{epic}-{slug}/story-{story}-{slug}/IMPLEMENTATION_GAPS-E{epic}-S{story}.md`             | `specs/{index}-{name}/IMPLEMENTATION_GAPS.md` |
| tasks        | `specs/epic-{epic}-{slug}/story-{story}-{slug}/tasks-E{epic}-S{story}.md`                           | `specs/{index}-{name}/tasks.md`               |
| prd          | `_bmad-output/implementation-artifacts/epic-{epic}-{slug}/story-{story}-{slug}/prd.{stem}.json`     | `prd.{stem}.json`                             |
| progress     | `_bmad-output/implementation-artifacts/epic-{epic}-{slug}/story-{story}-{slug}/progress.{stem}.txt` | `progress.{stem}.txt`                         |
| audit报告    | `AUDIT_{stage}-E{epic}-S{story}_round{N}.md`                                                        | `_orphan/AUDIT_{slug}_round{N}.md`            |

### 3.2 过程控制文件

| 文件                  | 用途             | 更新时机                                |
| --------------------- | ---------------- | --------------------------------------- |
| `bmad-progress.yaml`  | BMAD 状态跟踪    | 每阶段完成后                            |
| `bmad-lock.yaml`      | 并发控制         | 阶段开始时锁定                          |
| `prd.{stem}.json`     | ralph-method PRD | §5.1 执行前创建，每US完成后更新 passes  |
| `progress.{stem}.txt` | TDD进度追踪      | §5.1 执行前创建，每阶段后追加 [TDD-XXX] |

---

## 四、审计循环映射

### 4.1 审计严格度

| 阶段                  | 严格度     | 收敛规则         | 批判审计员   |
| --------------------- | ---------- | ---------------- | ------------ |
| §0.5 constitution     | standard   | 单次通过         | 可选         |
| §1 specify            | standard   | 单次通过         | **必须**     |
| §2 plan               | standard   | 单次通过         | **必须**     |
| §3 GAPS               | standard   | 单次通过         | **必须**     |
| §4 tasks              | standard   | 单次通过         | **必须**     |
| §5 implement(batch间) | standard   | 单次通过         | **必须**     |
| §5.2 implement(最终)  | **strict** | **连续3轮无gap** | **必须>50%** |

### 4.2 审计提示词来源

| 阶段         | 提示词文件       | 章节                |
| ------------ | ---------------- | ------------------- |
| constitution | audit-prompts.md | §0 (通用文档完整性) |
| spec         | audit-prompts.md | §1                  |
| plan         | audit-prompts.md | §2                  |
| GAPS         | audit-prompts.md | §3                  |
| tasks        | audit-prompts.md | §4                  |
| implement    | audit-prompts.md | §5                  |

### 4.3 审计报告格式要求

**必须包含可解析评分块**（供 `bmad-speckit score` 解析）：

```markdown
## 可解析评分块（供 parseAndWriteScore）

总体评级: [A|B|C|D] (只能是A/B/C/D，禁止A-、B+等)

维度评分:

- 需求完整性: XX/100
- 可测试性: XX/100
- 一致性: XX/100
- 可追溯性: XX/100
```

---

## 五、评分系统映射

### 5.1 scoring CLI 调用参数

> 旧调用方式 `npx ts-node scripts/parse-and-write-score.ts` 已替换为 `npx bmad-speckit score`，参数不变。
>
> `--triggerStage` 的统一理解：
>
> - 它不是简单手填字符串，而是 **当前运行阶段在 scoring 侧使用的最终阶段标识**。
> - 它的基础映射来源于 `stage-mapping.yaml`。
> - 在统一 Runtime Governance 模型下，最终 `triggerStage` 应由治理层结合 `flow`、`stage`、映射规则与兼容规则共同求值得出。
> - 因此，下面示例中的 `speckit_1_2`、`speckit_2_2` 等值，应理解为“当前场景下最终采用的 `triggerStage` 示例值”。

```bash
# §1 specify
npx bmad-speckit score \
  --reportPath specs/epic-{epic}-{slug}/story-{story}-{slug}/AUDIT_spec-E{epic}-S{story}.md \
  --stage spec \
  --event stage_audit_complete \
  --triggerStage speckit_1_2 \
  --epic {epic} \
  --story {story} \
  --artifactDocPath specs/epic-{epic}-{slug}/story-{story}-{slug}/spec-E{epic}-S{story}.md \
  --iteration-count {累计失败轮数} \
  [--iterationReportPaths fail_round1_path,fail_round2_path,...]

# §2 plan
npx bmad-speckit score \
  --reportPath specs/epic-{epic}-{slug}/story-{story}-{slug}/AUDIT_plan-E{epic}-S{story}.md \
  --stage plan \
  --event stage_audit_complete \
  --triggerStage speckit_2_2 \
  ...

# §3 GAPS (stage=plan, 报告格式与plan兼容)
npx bmad-speckit score \
  --reportPath specs/.../AUDIT_GAPS-E{epic}-S{story}.md \
  --stage plan \
  --event stage_audit_complete \
  --triggerStage speckit_3_2 \
  ...

# §4 tasks
npx bmad-speckit score \
  --reportPath specs/.../AUDIT_tasks-E{epic}-S{story}.md \
  --stage tasks \
  --event stage_audit_complete \
  --triggerStage speckit_4_2 \
  ...

# §5 implement
npx bmad-speckit score \
  --reportPath _bmad-output/implementation-artifacts/.../AUDIT_implement-E{epic}-S{story}.md \
  --stage implement \
  --event stage_audit_complete \
  --triggerStage speckit_5_2 \
  --epic {epic} \
  --story {story} \
  --artifactDocPath specs/.../tasks-E{epic}-S{story}.md \
  --iteration-count {累计失败轮数}
```

### 5.2 评分触发配置

触发配置存储在: `_bmad/_config/scoring-trigger-modes.yaml`

> 统一理解：
>
> - `scoring-trigger-modes.yaml` 提供的是 **trigger 策略输入**，用于参与 `scoringEnabled` 求值。
> - `stage-mapping.yaml` 提供的是 **阶段到内部标识的基础映射**，用于参与 `triggerStage` 求值。
> - Runtime Governance 输出的才是当前场景下最终可执行的：
>   - `scoringEnabled`
>   - `triggerStage`
> - 因此，CLI 调用中的 `--triggerStage` 应与运行时治理结果保持一致，而不应脱离映射与治理规则单独理解。

```yaml
stages:
  - name: speckit_1_2 # §1 specify
    events: [stage_audit_complete]
  - name: speckit_2_2 # §2 plan
    events: [stage_audit_complete]
  - name: speckit_3_2 # §3 GAPS
    events: [stage_audit_complete]
  - name: speckit_4_2 # §4 tasks
    events: [stage_audit_complete]
  - name: speckit_5_2 # §5 implement
    events: [stage_audit_complete]
```

---

## 六、TDD红绿灯强制约束映射

### 6.1 Ralph-Method 前置检查

**执行 §5 implement 前必须验证**:

```yaml
检查项:
  - prd文件存在: "prd.{stem}.json"
  - progress文件存在: "progress.{stem}.txt"
  - prd结构符合: ralph-method schema
  - userStories与tasks可验收任务一一对应
  - progress预填TDD槽位:
      涉及生产代码: "[TDD-RED] _pending_", "[TDD-GREEN] _pending_", "[TDD-REFACTOR] _pending_"
      仅文档/配置: "[DONE] _pending_"
```

### 6.2 TDD 执行循环

```
对每个涉及生产代码的US:
  1. [TDD-RED]
     - 编写/补充测试
     - 运行测试 => 必须失败
     - progress追加: "[TDD-RED] US-00X pytest ... => N failed"
     - TodoWrite: 标记in_progress

  2. [TDD-GREEN]
     - 编写最少量生产代码
     - 运行测试 => 通过
     - progress追加: "[TDD-GREEN] US-00X pytest ... => N passed"
     - tasks.md: 更新复选框 [ ] → [x]

  3. [TDD-REFACTOR]
     - 重构优化（SOLID、命名、解耦）
     - 运行测试 => 仍通过
     - progress追加: "[TDD-REFACTOR] US-00X 重构描述 | 无需重构 ✓"
     - TodoWrite: 标记completed
     - prd更新: "passes: true"

  4. Lint检查
     - 按技术栈执行Lint
     - 必须无错误、无警告
```

### 6.3 TDD 记录格式

**progress.{stem}.txt 格式**:

```markdown
# US-001: 实现XXX功能

[TDD-RED] US-001 pytest tests/test_xxx.py -v => 3 failed
错误: ModuleNotFoundError, Test failed as expected

[TDD-GREEN] US-001 pytest tests/test_xxx.py -v => 3 passed
实现: 添加XXX类，实现YYY方法

[TDD-REFACTOR] US-001 无需重构 ✓

# 或 [TDD-REFACTOR] US-001 提取XXX工具函数，优化命名

---

# US-002: 配置更新

[DONE] US-002 2024-01-15 14:30
```

---

## 七、Agent 实现映射（当前仓库现状）

### 7.1 CLI 目标名 ↔ 当前实现文件

| CLI / 命令目标名       | 当前实现文件                                                                                     | 现状说明                                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `speckit-constitution` | `.claude/agents/speckit-constitution.md`                                                         | 已有顶层 agent                                                                                                                   |
| `speckit-specify`      | `.claude/agents/speckit-specify.md`                                                              | 顶层 alias 已落地；canonical body 为 `.claude/agents/layers/bmad-layer4-speckit-specify.md`                                      |
| `speckit-plan`         | `.claude/agents/speckit-plan.md`                                                                 | 顶层 alias 已落地；canonical body 为 `.claude/agents/layers/bmad-layer4-speckit-plan.md`                                         |
| `speckit-gaps`         | `.claude/agents/speckit-gaps.md`                                                                 | 顶层 alias 已落地；canonical body 为 `.claude/agents/layers/bmad-layer4-speckit-gaps.md`，旧名 `.claude/agents/gaps.md` 保留兼容 |
| `speckit-tasks`        | `.claude/agents/speckit-tasks.md`                                                                | 顶层 alias 已落地；canonical body 为 `.claude/agents/layers/bmad-layer4-speckit-tasks.md`                                        |
| `speckit-implement`    | `.claude/agents/speckit-implement.md` + `.claude/agents/layers/bmad-layer4-speckit-implement.md` | 顶层执行体与 BMAD Layer 4 wrapper 均已存在                                                                                       |
| `speckit-clarify`      | `.claude/agents/speckit-clarify.md`                                                              | 已有顶层 agent                                                                                                                   |
| `speckit-checklist`    | `.claude/agents/speckit-checklist.md`                                                            | 已有顶层 agent                                                                                                                   |
| `speckit-analyze`      | `.claude/agents/speckit-analyze.md`                                                              | 已有顶层 agent                                                                                                                   |

### 7.2 现有辅助 / 审计 Agent

| Agent               | 文件                                           | 用途                                                             |
| ------------------- | ---------------------------------------------- | ---------------------------------------------------------------- |
| `bmad-master`       | `.claude/agents/bmad-master.md`                | 总协调                                                           |
| `auditor-spec`      | `.claude/agents/auditors/auditor-spec.md`      | §1 审计                                                          |
| `auditor-plan`      | `.claude/agents/auditors/auditor-plan.md`      | §2 审计                                                          |
| `auditor-gaps`      | `.claude/agents/auditors/auditor-gaps.md`      | §3 审计                                                          |
| `auditor-tasks`     | `.claude/agents/auditors/auditor-tasks.md`     | §4 审计                                                          |
| `auditor-implement` | `.claude/agents/auditors/auditor-implement.md` | §5 审计                                                          |
| `gaps`              | `.claude/agents/gaps.md`                       | 旧名 gaps 分析 agent；当前可作为 `speckit-gaps` 的兼容实现体之一 |

---

## 八、Agent 命名与兼容层现状

### 8.1 已落地的顶层 alias

以下命令名现在都已经有同名顶层 `.claude/agents/*.md` 入口：

- `speckit-specify`
- `speckit-plan`
- `speckit-gaps`
- `speckit-tasks`

CLI 与文档应优先引用这些顶层 alias，而不是直接让用户依赖 `layers/` 内部路径。

### 8.2 仍需保留的兼容关系

- `.claude/agents/gaps.md` 仍作为旧名兼容实现保留
- `speckit-gaps` 的正式入口是 `.claude/agents/speckit-gaps.md`
- 4 个顶层 alias 的 canonical body 仍位于 `.claude/agents/layers/`

### 8.3 当前收口原则

1. 面向用户或 CLI 的入口统一引用顶层 alias。
2. 面向实现与阶段前置条件检查的说明，仍可引用 `layers/bmad-layer4-*` canonical body。
3. 文档必须显式区分“命令入口文件”和“内部 canonical execution body”，避免再次把两者混写成互斥事实。

---

## 九、Agent 层当前建议

1. CLI、安装验证、自检脚本统一指向 `speckit-specify / plan / gaps / tasks` 顶层 alias。
2. `layers/` 路径继续作为 canonical implementation body 暴露给维护者和阶段门禁脚本。
3. 保留 `.claude/agents/gaps.md` 作为兼容入口时，必须始终注明其从属关系，不得再把它写成正式主入口。

---

## 十、文件引用关系图（当前现状）

```
speckit-workflow/
├── SKILL.md                          # 主流程定义
├── references/
│   ├── audit-prompts.md              # §0-§5 审计提示词
│   ├── audit-prompts-critical-auditor-appendix.md  # 批判审计员
│   ├── audit-document-iteration-rules.md           # 文档审计迭代规则
│   ├── audit-post-impl-rules.md      # 实施后审计规则(strict)
│   ├── mapping-tables.md             # 映射表模板
│   ├── task-execution-tdd.md         # TDD执行规则(15条铁律)
│   ├── tasks-acceptance-templates.md # 验收模板
│   └── qa-agent-rules.md             # Agent执行规则

.claude/agents/
├── bmad-master.md                    # 总协调
├── speckit-constitution.md           # §0.5 已存在
├── speckit-specify.md                # §1 顶层 alias
├── speckit-plan.md                   # §2 顶层 alias
├── speckit-gaps.md                   # §3 正式顶层 alias
├── speckit-tasks.md                  # §4 顶层 alias
├── speckit-clarify.md                # §1.2 已存在
├── speckit-checklist.md              # §2.2 已存在
├── speckit-analyze.md                # §4.2 已存在
├── speckit-implement.md              # §5 已存在
├── gaps.md                           # 旧名兼容 gaps agent
└── auditors/
    ├── auditor-spec.md
    ├── auditor-plan.md
    ├── auditor-gaps.md
    ├── auditor-tasks.md
    └── auditor-implement.md

.claude/agents/layers/
├── bmad-layer4-speckit-specify.md    # §1 当前执行体
├── bmad-layer4-speckit-plan.md       # §2 当前执行体
├── bmad-layer4-speckit-gaps.md       # §3 当前执行体
├── bmad-layer4-speckit-tasks.md      # §4 当前执行体
└── bmad-layer4-speckit-implement.md  # §5 BMAD Layer 4 wrapper

scripts/
├── auditor-spec.ts                   # 需重构以加载audit-prompts.md
├── auditor-plan.ts                   # 需重构
├── auditor-tasks.ts                  # 需重构
├── auditor-implement.ts              # 需重构
└── parse-and-write-score.ts          # 已整合为 npx bmad-speckit score
```

---

_映射文档版本: v1.0_
_基于: speckit-workflow SKILL.md (594行)_
_创建时间: 2026-03-13_
