# Cursor Speckit-Workflow → Claude Code CLI 完整映射

> **目标**: 零裁剪、完整准确地将 Cursor 的 speckit-workflow 适配到 Claude Code CLI

---

## 一、命令映射总表

| Speckit 命令 | Cursor 形式 | Claude Code CLI 形式 | 阶段 | 前置条件 | 产出文档 |
|-------------|------------|---------------------|------|---------|---------|
| **constitution** | `/speckit.constitution` | `claude-code --agent speckit-constitution` | §0.5 | 无 | `constitution.md` |
| **specify** | `/speckit.specify` | `claude-code --agent speckit-specify` | §1 | constitution 通过审计 | `spec-E{epic}-S{story}.md` |
| **plan** | `/speckit.plan` | `claude-code --agent speckit-plan` | §2 | spec 通过审计 | `plan-E{epic}-S{story}.md` |
| **GAPS** | 无独立命令（自动/触发） | `claude-code --agent speckit-gaps` | §3 | plan 通过审计 | `IMPLEMENTATION_GAPS-E{epic}-S{story}.md` |
| **tasks** | `/speckit.tasks` | `claude-code --agent speckit-tasks` | §4 | GAPS 通过审计 | `tasks-E{epic}-S{story}.md` |
| **implement** | `/speckit.implement` | `claude-code --agent speckit-implement` | §5 | tasks 通过审计 | 可运行代码 + 测试 |
| **clarify** | `/speckit.clarify` | `claude-code --agent speckit-clarify` | §1.2 内嵌 | spec 审计发现模糊 | 更新后的 spec.md |
| **checklist** | `/speckit.checklist` | `claude-code --agent speckit-checklist` | §2.2 内嵌 | plan 多模块/复杂 | 质量检查清单 |
| **analyze** | `/speckit.analyze` | `claude-code --agent speckit-analyze` | §4.2 内嵌 | tasks≥10 或跨 artifact | 一致性分析报告 |

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
│  ───────────────────→ │ 自动生成(无独立命令)      │ ──→ code-review 审计 §3.2  │
│                       │ 深度分析plan vs 当前实现   │    (standard + 批判审计员)  │
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

| 阶段 | BMAD 路径格式 | Standalone 路径格式 |
|------|--------------|---------------------|
| constitution | `.claude/memory/constitution.md` | `constitution.md` |
| spec | `specs/epic-{epic}-{slug}/story-{story}-{slug}/spec-E{epic}-S{story}.md` | `specs/{index}-{name}/spec.md` |
| plan | `specs/epic-{epic}-{slug}/story-{story}-{slug}/plan-E{epic}-S{story}.md` | `specs/{index}-{name}/plan.md` |
| GAPS | `specs/epic-{epic}-{slug}/story-{story}-{slug}/IMPLEMENTATION_GAPS-E{epic}-S{story}.md` | `specs/{index}-{name}/IMPLEMENTATION_GAPS.md` |
| tasks | `specs/epic-{epic}-{slug}/story-{story}-{slug}/tasks-E{epic}-S{story}.md` | `specs/{index}-{name}/tasks.md` |
| prd | `_bmad-output/implementation-artifacts/epic-{epic}-{slug}/story-{story}-{slug}/prd.{stem}.json` | `prd.{stem}.json` |
| progress | `_bmad-output/implementation-artifacts/epic-{epic}-{slug}/story-{story}-{slug}/progress.{stem}.txt` | `progress.{stem}.txt` |
| audit报告 | `AUDIT_{stage}-E{epic}-S{story}_round{N}.md` | `_orphan/AUDIT_{slug}_round{N}.md` |

### 3.2 过程控制文件

| 文件 | 用途 | 更新时机 |
|------|------|---------|
| `bmad-progress.yaml` | BMAD 状态跟踪 | 每阶段完成后 |
| `bmad-lock.yaml` | 并发控制 | 阶段开始时锁定 |
| `prd.{stem}.json` | ralph-method PRD | §5.1 执行前创建，每US完成后更新 passes |
| `progress.{stem}.txt` | TDD进度追踪 | §5.1 执行前创建，每阶段后追加 [TDD-XXX] |

---

## 四、审计循环映射

### 4.1 审计严格度

| 阶段 | 严格度 | 收敛规则 | 批判审计员 |
|------|--------|---------|-----------|
| §0.5 constitution | standard | 单次通过 | 可选 |
| §1 specify | standard | 单次通过 | **必须** |
| §2 plan | standard | 单次通过 | **必须** |
| §3 GAPS | standard | 单次通过 | **必须** |
| §4 tasks | standard | 单次通过 | **必须** |
| §5 implement(batch间) | standard | 单次通过 | **必须** |
| §5.2 implement(最终) | **strict** | **连续3轮无gap** | **必须>50%** |

### 4.2 审计提示词来源

| 阶段 | 提示词文件 | 章节 |
|------|-----------|------|
| constitution | audit-prompts.md | §0 (通用文档完整性) |
| spec | audit-prompts.md | §1 |
| plan | audit-prompts.md | §2 |
| GAPS | audit-prompts.md | §3 |
| tasks | audit-prompts.md | §4 |
| implement | audit-prompts.md | §5 |

### 4.3 审计报告格式要求

**必须包含可解析评分块**（供 `bmad-speckit score` 解析）：

```markdown
## 可解析评分块（供 parseAndWriteScore）

总体评级: [A|B|C|D]  (只能是A/B/C/D，禁止A-、B+等)

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

```yaml
stages:
  - name: speckit_1_2  # §1 specify
    events: [stage_audit_complete]
  - name: speckit_2_2  # §2 plan
    events: [stage_audit_complete]
  - name: speckit_3_2  # §3 GAPS
    events: [stage_audit_complete]
  - name: speckit_4_2  # §4 tasks
    events: [stage_audit_complete]
  - name: speckit_5_2  # §5 implement
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

## 七、Agent 定义映射

### 7.1 需要创建的 Agent

| Agent | 文件 | 对应 Speckit 命令 |
|-------|------|------------------|
| speckit-constitution | `.claude/agents/speckit-constitution.md` | `/speckit.constitution` |
| speckit-specify | `.claude/agents/speckit-specify.md` | `/speckit.specify` |
| speckit-plan | `.claude/agents/speckit-plan.md` | `/speckit.plan` |
| speckit-gaps | `.claude/agents/speckit-gaps.md` | `/speckit.gaps` (自动生成) |
| speckit-tasks | `.claude/agents/speckit-tasks.md` | `/speckit.tasks` |
| **speckit-implement** | `.claude/agents/speckit-implement.md` | `/speckit.implement` |
| speckit-clarify | `.claude/agents/speckit-clarify.md` | `/speckit.clarify` |
| speckit-checklist | `.claude/agents/speckit-checklist.md` | `/speckit.checklist` |
| speckit-analyze | `.claude/agents/speckit-analyze.md` | `/speckit.analyze` |

### 7.2 现有 Agent

| Agent | 文件 | 用途 |
|-------|------|------|
| bmad-master | `.claude/agents/bmad-master.md` | 总协调 |
| auditor-spec | `.claude/agents/auditors/auditor-spec.md` | §1 审计 |
| auditor-plan | `.claude/agents/auditors/auditor-plan.md` | §2 审计 |
| auditor-tasks | `.claude/agents/auditors/auditor-tasks.md` | §4 审计 |
| auditor-implement | `.claude/agents/auditors/auditor-implement.md` | §5 审计 |
| gaps | `.claude/agents/gaps.md` | Gap分析(已创建) |

---

## 八、关键缺失项清单

### 8.1 缺失的 Agent 定义

- [ ] **speckit-constitution** - §0.5 项目原则
- [ ] **speckit-implement** - §5 TDD执行 (**最关键缺失**)
- [ ] speckit-clarify - §1.2 澄清
- [ ] speckit-checklist - §2.2 检查清单
- [ ] speckit-analyze - §4.2 分析

### 8.2 缺失的审计实现

当前 `scripts/auditor-spec.ts` 的 gaps:

| 缺失项 | Speckit 要求 | 当前实现 |
|--------|-------------|---------|
| 审计提示词加载 | 读取 `audit-prompts.md` §1 | 硬编码4项检查 |
| 报告格式 | 可解析评分块(总体评级+维度评分) | 简单PASS/FAIL |
| 迭代规则 | 连续3轮无gap收敛 | 单轮检查 |
| 文档修改 | 审计子代理直接修改被审文档 | 仅返回建议 |
| 评分触发 | 自动调用parse-and-write-score | 未实现 |
| 批判审计员 | 必须执行批判审计员检查 | 未实现 |

### 8.3 缺失的 TDD 强制约束

当前实现缺少:

1. **ralph-method 前置检查**: 未检查 prd/progress 文件
2. **TDD槽位预填**: 未在 progress 中预填 `[TDD-XXX] _pending_`
3. **逐US独立执行**: 未确保每个US独立RED→GREEN→REFACTOR
4. **进度更新**: 未在每US完成后更新 prd passes=true
5. **TDD记录格式**: 未按格式 `[TDD-RED] US-00X ... => N failed` 记录

---

## 九、完整实施建议

### 9.1 优先级1: 核心执行 Agent

**speckit-implement** 是最关键缺失，需要完整实现:
1. ralph-method 前置检查
2. TDD红绿灯循环执行
3. prd/progress 自动更新
4. batch间审计调用
5. 最终 §5.2 strict 审计

### 9.2 优先级2: 审计系统重构

重构 `scripts/auditor-*.ts`:
1. 读取 `audit-prompts.md` 对应章节作为提示词
2. 输出可解析评分块格式
3. 实现连续3轮收敛逻辑
4. 集成批判审计员检查
5. 自动触发 parse-and-write-score

### 9.3 优先级3: 增强命令

实现 clarify/checklist/analyze 三个内嵌命令。

---

## 十、文件引用关系图

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
├── speckit-constitution.md           # §0.5 (缺失)
├── speckit-specify.md                # §1 (已有基础)
├── speckit-plan.md                   # §2 (已有基础)
├── speckit-gaps.md                   # §3 (缺失)
├── speckit-tasks.md                  # §4 (已有基础)
├── speckit-implement.md              # §5 (关键缺失)
├── speckit-clarify.md                # §1.2 (缺失)
├── speckit-checklist.md              # §2.2 (缺失)
├── speckit-analyze.md                # §4.2 (缺失)
├── gaps.md                           # Gap分析(已创建)
└── auditors/
    ├── auditor-spec.md
    ├── auditor-plan.md
    ├── auditor-tasks.md
    └── auditor-implement.md

scripts/
├── auditor-spec.ts                   # 需重构以加载audit-prompts.md
├── auditor-plan.ts                   # 需重构
├── auditor-tasks.ts                  # 需重构
├── auditor-implement.ts              # 需重构
└── parse-and-write-score.ts          # 已整合为 npx bmad-speckit score
```

---

*映射文档版本: v1.0*
*基于: speckit-workflow SKILL.md (594行)*
*创建时间: 2026-03-13*
