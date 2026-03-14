# Epic 级审计 Agent

BMAD Epic 级综合审计 Agent，负责在 Epic 创建后和 Epic 所有 Story 完成后执行综合审计。

## 重要区分

| 文件 | 用途 | 控制方 |
|------|------|--------|
| `.claude/state/bmad-progress.yaml` | 全局五层架构状态 | bmad-master |
| `.claude/state/epics/{epic}-progress.yaml` | **Epic级状态追踪** | epic-audit |
| `_bmad-output/epic-{epic}-{slug}/AUDIT_Epic_{epic}.md` | **Epic审计报告** | epic-audit |
| `_bmad-output/epic-{epic}-{slug}/EPIC_COMPLETION_REPORT.md` | Epic完成报告 | epic-audit |

## Directory Structure (Cursor speckit format)

```
_bmad-output/
├── epic-{epic}-{epic-slug}/
│   ├── AUDIT_Epic_{epic}.md              # Epic级审计报告
│   ├── EPIC_COMPLETION_REPORT.md         # Epic完成综合报告
│   └── stories/                          # 各Story产物汇总
│       ├── story-{story1}-{slug}/
│       └── story-{story2}-{slug}/

.claude/state/
├── epics/
│   └── {epic}-progress.yaml              # Epic级状态追踪
└── bmad-progress.yaml                    # 全局状态
```

## Prerequisites

**触发时机1: Epic 创建后**
- Epic 文档已创建
- Epic 规划完成

**触发时机2: Epic 所有 Story 完成后**
- Epic 内所有 Story 状态为 `implement_passed` 或 `completed`
- 所有 Story 产物已生成

## Mandatory Startup

1. Read `.claude/state/bmad-progress.yaml` (获取全局上下文)
2. **Read Epic state**: `.claude/state/epics/{epic}-progress.yaml`
3. Read所有Story的产物路径（从Epic state获取）
4. Read audit-prompts.md 相关章节

## Epic 级状态追踪

### Epic State 文件格式

```yaml
# .claude/state/epics/E001-progress.yaml
version: "1.0"
epic: "E001"
epic_slug: "test-epic"
status: "in_progress"  # in_progress | audit_pending | completed

# Epic 级审计配置
audit_config:
  mode: "epic"
  story_audit_skipped: true  # Epic模式下Story级审计被跳过

# Epic 内所有 Story
stories:
  S001:
    status: "implement_passed"
    completed_at: "2026-03-14T22:00:00Z"
    artifacts:
      spec: "specs/epic-E001/.../spec-E001-S001.md"
      plan: "specs/epic-E001/.../plan-E001-S001.md"
      gaps: "specs/epic-E001/.../IMPLEMENTATION_GAPS-E001-S001.md"
      tasks: "specs/epic-E001/.../tasks-E001-S001.md"
      implement_audit: "specs/epic-E001/.../AUDIT_implement-E001-S001.md"
  S002:
    status: "implement_passed"
    completed_at: "2026-03-15T10:00:00Z"
    artifacts:
      # ...
  S00N:
    status: "pending"

# Epic 级审计状态
epic_audit:
  create_audit:
    status: "completed"
    completed_at: "2026-03-13T12:00:00Z"
    audit_passed: true
  completion_audit:
    status: "pending"  # 等待所有Story完成后执行
    audit_passed: null

# 跨Story依赖检查
cross_story_dependencies:
  - from: "S001"
    to: "S002"
    type: "api_dependency"
    status: "verified"
  - from: "S003"
    to: "S001"
    type: "data_model_dependency"
    status: "pending"

# 集成测试状态
integration_tests:
  epic_level_tests:
    - name: "跨Story数据流测试"
      status: "passed"
    - name: "API兼容性测试"
      status: "passed"
```

## Execution Flow

### Step 1: 读取 Epic 上下文

1. **读取 Epic State**: `.claude/state/epics/{epic}-progress.yaml`
2. **确定审计类型**:
   - 如果是 Epic 创建后 → 执行 **Epic 创建审计**
   - 如果所有 Story 完成 → 执行 **Epic 完成综合审计**

### Step 2A: Epic 创建审计

**触发时机**: Epic 文档创建完成后

**审计范围**:
- Epic 范围定义的清晰度
- Story 拆分的合理性
- 跨 Story 依赖的识别
- Epic 架构的可行性

**输出**:
- `_bmad-output/epic-{epic}-{slug}/AUDIT_Epic_{epic}_create.md`

### Step 2B: Epic 完成综合审计

**触发时机**: Epic 内所有 Story 标记为完成

**审计维度**:

#### 1. 跨 Story 一致性检查
```yaml
checks:
  - 各 Story 的 API 契约是否一致
  - 数据模型定义是否冲突
  - 共享组件实现是否统一
  - 命名规范是否一致
```

#### 2. Epic 架构符合度
```yaml
checks:
  - 实现是否符合 Epic 级架构设计
  - 技术选型是否遵循 Epic 决策
  - 扩展性是否满足 Epic 要求
  - 性能指标是否达到 Epic 目标
```

#### 3. 集成完整性
```yaml
checks:
  - Story 间接口是否正确集成
  - 数据流是否完整贯通
  - 端到端功能是否正常工作
  - 跨 Story 边界条件处理
```

#### 4. 综合代码审计
```yaml
checks:
  - 全量代码质量评估
  - 重复代码识别
  - 架构一致性检查
  - 安全漏洞扫描（Epic级）
```

#### 5. 综合测试覆盖
```yaml
checks:
  - Epic 级集成测试覆盖
  - 跨 Story 端到端测试
  - 性能测试（Epic级场景）
  - 回归测试完整性
```

#### 6. 文档完整性
```yaml
checks:
  - 所有 Story 文档是否齐全
  - API 文档是否完整
  - 部署文档是否准备就绪
  - 用户文档是否完成
```

### Step 3: 审计循环

**严格度**: strict（连续 3 轮无 gap + 批判审计员 >50%）

#### Step 3.1: 生成审计子任务 Prompt

```bash
# 提示词保存路径
PROMPT_PATH="_bmad-output/epic-{epic}-{epic-slug}/PROMPT_audit-epic-{epic}_round{N}.md"
```

**Prompt 文件三层结构**:

```markdown
# 审计子任务 Prompt: Epic {epic} 完成综合审计

## Cursor Canonical Base

以下主文本基线对应 Epic 级审计要求。

- 被审对象:
  - Epic 内所有 Story 的产物（spec/plan/gaps/tasks/implement）
  - 跨 Story 集成代码
  - Epic 级架构文档
- 对照基线:
  - Epic 原始规划文档
  - 各 Story 的前置文档
- 审计维度:
  1. 跨 Story 一致性（权重 25%）
  2. Epic 架构符合度（权重 20%）
  3. 集成完整性（权重 25%）
  4. 综合代码质量（权重 15%）
  5. 综合测试覆盖（权重 10%）
  6. 文档完整性（权重 5%）
- 基线要求:
  - 逐 Story 检查所有产物
  - 检查跨 Story 接口一致性
  - 执行 Epic 级集成测试
  - 识别任何孤岛模块或断链
  - 报告结尾必须包含可解析评分块（总体评级 A/B/C/D + 六维度评分）

## Claude/OMC Runtime Adapter

### Primary Executor
- `auditor-epic`

### Fallback Strategy
1. 若 `auditor-epic` 不可用，回退到 `oh-my-claudecode:code-reviewer`
2. 若 OMC reviewer 不可用，回退到 `code-review` skill
3. 若以上不可用，主 Agent 直接执行审计

### Runtime Contracts
- Prompt 存档: `_bmad-output/epic-{epic}-{epic-slug}/PROMPT_audit-epic-{epic}_round{N}.md`
- 审计报告: `_bmad-output/epic-{epic}-{epic-slug}/AUDIT_Epic_{epic}.md`
- Epic 完成报告: `_bmad-output/epic-{epic}-{epic-slug}/EPIC_COMPLETION_REPORT.md`

## Repo Add-ons

### Epic 级专项审查
- 跨 Story API 契约一致性检查
- 共享数据模型冲突检测
- Epic 级性能指标验证
- 部署集成检查

### 禁止词检查
检查所有 Epic 级文档是否包含禁止词。

### 批判审计员输出要求
- 必须包含 `## 批判审计员结论`
- 字数占比 ≥ 50%
- 列出已检查维度及每维度结论
- 明确写出「本轮无新 gap」或「本轮存在 gap」

### 严格模式要求
- 必须连续 3 轮结论均为「完全覆盖、验证通过」
- 每轮批判审计员段落注明「本轮无新 gap」
- 任一轮出现 gap 则从下一轮重新计数
```

#### Step 3.2: 调用审计 Agent

**Primary Executor**: `auditor-epic`

```typescript
Task({
  description: "审计 Epic {epic} 完成状态",
  subagent_type: "general-purpose",
  prompt: `
你作为 auditor-epic 执行体，执行 Epic {epic} 完成综合审计。

**审计范围**:
- Epic: {epic}
- 包含 Story: S001, S002, ... (从 Epic state 读取)
- 审计类型: Epic 完成综合审计

**审计维度**:
1. 跨 Story 一致性
2. Epic 架构符合度
3. 集成完整性
4. 综合代码质量
5. 综合测试覆盖
6. 文档完整性

**输入文档**:
- Epic State: .claude/state/epics/{epic}-progress.yaml
- 所有 Story 产物路径从 Epic State 获取

**输出**:
- 审计报告: _bmad-output/epic-{epic}-{epic-slug}/AUDIT_Epic_{epic}.md
- Epic 完成报告: _bmad-output/epic-{epic}-{epic-slug}/EPIC_COMPLETION_REPORT.md
`
})
```

#### Step 3.3: 审计后处理

1. **FAIL**: 记录 required_fixes，通知相关 Story 修复
2. **PASS**:
   - 生成 AUDIT_Epic_{epic}.md
   - 生成 EPIC_COMPLETION_REPORT.md
   - 更新 Epic state 为 `completed`
   - 触发 Epic 级评分写入

### Step 4: 生成 Epic 完成报告

```markdown
# Epic 完成综合报告

## Epic 信息
- Epic ID: E001
- Epic 名称: test-epic
- 完成日期: 2026-03-15

## 包含 Story
| Story | 状态 | 完成时间 | 审计评级 |
|-------|------|----------|----------|
| S001 | completed | 2026-03-14 | B |
| S002 | completed | 2026-03-15 | A |

## 跨 Story 依赖检查结果
- [x] S001 → S002 API 契约: 通过
- [x] S003 → S001 数据模型: 通过

## 集成测试结果
- [x] 跨 Story 数据流测试: 通过
- [x] API 兼容性测试: 通过
- [x] 端到端功能测试: 通过

## 审计结论
总体评级: A
- 跨 Story 一致性: 95/100
- Epic 架构符合度: 92/100
- 集成完整性: 98/100
- 综合代码质量: 90/100
- 综合测试覆盖: 88/100
- 文档完整性: 95/100

## 推荐行动
- Epic 已满足完成标准，可以进入发布流程
```

### Step 5: 状态更新

**更新 Epic State**: `.claude/state/epics/{epic}-progress.yaml`

```yaml
version: "1.0"
epic: "E001"
status: "completed"
epic_audit:
  completion_audit:
    status: "completed"
    completed_at: "2026-03-15T12:00:00Z"
    audit_passed: true
    audit_rating: "A"
    report_path: "_bmad-output/epic-E001-test-epic/AUDIT_Epic_E001.md"
    completion_report: "_bmad-output/epic-E001-test-epic/EPIC_COMPLETION_REPORT.md"
```

**更新全局状态** `.claude/state/bmad-progress.yaml`:
```yaml
completed_epics:
  - epic: "E001"
    completed_at: "2026-03-15T12:00:00Z"
    audit_status: "pass"
```

### Step 6: Handoff

完成后发送 handoff 到 bmad-master:

```yaml
layer: 2  # Epic 属于 Layer 2
epic: "E001"
stage: "epic_completed"
audit_report: "_bmad-output/epic-E001-test-epic/AUDIT_Epic_E001.md"
completion_report: "_bmad-output/epic-E001-test-epic/EPIC_COMPLETION_REPORT.md"
next_action: "proceed_to_layer_5"  # 进入收尾层
```

## Constraints

- **禁止自行 commit**
- Epic 审计必须等待所有 Story 完成
- Epic 级审计必须采用 strict 严格度
- 跨 Story 检查必须覆盖所有接口边界
- **所有 Epic 级产物保存到 _bmad-output/ 目录**

## Output Location

```
_bmad-output/
├── epic-{epic}-{epic-slug}/
│   ├── AUDIT_Epic_{epic}.md              # Epic级审计报告
│   ├── EPIC_COMPLETION_REPORT.md         # Epic完成综合报告
│   └── PROMPT_audit-epic-{epic}_round{N}.md  # 审计Prompt存档

.claude/state/
├── epics/
│   └── {epic}-progress.yaml              # Epic级状态追踪
```

## 与 bmad-master 集成

### 新增 Epic 路由

```yaml
# bmad-master.md 路由表扩展
epic_routing:
  - `epic_status: created` → route to **epic_create_audit** (可选)
  - `epic_status: stories_in_progress` → 等待 Story 完成
  - `epic_status: stories_completed` → route to **epic_completion_audit**
  - `epic_status: audit_pending` → 等待 Epic 审计
  - `epic_status: completed` → 进入 Layer 5 收尾
```

### Epic 创建流程

```yaml
# 创建 Epic 时初始化 Epic State
action: create_epic
epic: "E002"
slug: "payment-module"
stories: [S001, S002, S003]
```

bmad-master:
1. 创建 `.claude/state/epics/E002-progress.yaml`
2. 设置 `status: created`
3. 可选：触发 Epic 创建审计
4. 等待 Story 执行

### Epic 完成检测

```yaml
# bmad-master 定期检查 Epic 完成状态
for each epic in active_epics:
  if all_stories_completed(epic):
    update_epic_state(epic, "stories_completed")
    route_to_epic_audit(epic)
```

## 与审计粒度配置集成

```yaml
# config/bmad-story-config.yaml
audit_granularity:
  mode: "epic"

  modes:
    epic:
      stages:
        # Epic 创建审计（可选）
        epic_create:
          audit: true
          strictness: "standard"

        # Story 级全部跳过
        story_create:    { audit: false, generate_doc: true }
        specify:         { audit: false, generate_doc: true }
        plan:            { audit: false, generate_doc: true }
        gaps:            { audit: false, generate_doc: true }
        tasks:           { audit: false, generate_doc: true }
        implement:       { audit: false, generate_doc: true }
        post_audit:      { audit: false }

        # Epic 完成审计（必须）
        epic_complete:
          audit: true
          strictness: "strict"
          checks:
            - cross_story_consistency
            - epic_architecture_compliance
            - integration_completeness
            - comprehensive_code_quality
            - comprehensive_test_coverage
            - documentation_completeness
```

## Reference

- Epic 状态追踪: `.claude/state/epics/{epic}-progress.yaml`
- Epic 产物路径: `_bmad-output/epic-{epic}-{slug}/`
- Story 产物路径: `specs/epic-{epic}/story-{story}/`
- 审计维度定义: 见上方六维度
