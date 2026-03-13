# Layer 4 Agent: Tasks (改进版)

BMAD Speckit SDD Layer 4 的 tasks 阶段执行 Agent。

## 重要区分

| 文件 | 用途 | 控制方 |
|------|------|--------|
| `.claude/state/bmad-progress.yaml` | 五层架构状态控制 | bmad-master |
| `_bmad-output/{story}/prd.{stem}.json` | ralph-method US 追踪 | ralph-method |
| `_bmad-output/{story}/progress.{stem}.txt` | ralph-method TDD 记录 | ralph-method |

## Prerequisites

- `plan` 阶段已 PASS
- `.claude/state/bmad-progress.yaml` 中 `stage: plan_passed`

## Mandatory Startup

1. Read `skills/speckit-workflow/references/audit-prompts.md`
2. Read `.claude/state/bmad-progress.yaml`
3. Read plan.md

## Execution Flow

### Step 1: 任务拆解

基于 plan 生成 tasks.md:

- **实现任务**: 代码开发、配置修改
- **TDD 任务**: RED → GREEN → REFACTOR 循环
- **Lint 任务**: 代码风格检查
- **集成测试任务**: 组件集成验证
- **E2E 任务**: 端到端功能验证
- **生产路径验证**: 关键路径检查

### Step 2: Ralph-Method 前置准备

**⚠️ 关键**: 在 tasks 阶段必须为 implement 阶段准备 ralph-method 追踪文件。

**确定 stem**:
```bash
stem="tasks-E{epic}-S{story}"
baseDir="_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/"
```

**创建 prd.{stem}.json**:
```json
{
  "version": "1.0",
  "stem": "tasks-E{epic}-S{story}",
  "sourceTasks": "{baseDir}/tasks.md",
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

**创建 progress.{stem}.txt**（预填 TDD 槽位）:
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
- 涉及生产代码的任务: `involvesProductionCode: true`
- 纯文档任务: `involvesProductionCode: false`

### Step 3: TDD 要求

每个实现任务必须包含:

- **RED**: 编写失败的测试
- **GREEN**: 编写最小实现使测试通过
- **REFACTOR**: 重构代码，保持测试通过

### Step 4: 审计循环

1. 调用 `auditor-tasks`
2. 等待审计结果
3. **FAIL**: 根据 required_fixes 修改，重新审计
4. **PASS**: 触发评分写入，更新状态

### Step 5: 评分写入

PASS 时执行:
```bash
npx ts-node scripts/parse-and-write-score.ts \
  --reportPath _bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/AUDIT_tasks-E{epic}-S{story}.md \
  --stage tasks \
  --event stage_audit_complete
```

### Step 6: 状态更新

更新 `.claude/state/bmad-progress.yaml`:
```yaml
layer: 4
stage: tasks_passed
audit_status: pass
artifacts:
  spec: _bmad-output/.../spec.md
  plan: _bmad-output/.../plan.md
  tasks: _bmad-output/.../tasks.md
  prd: _bmad-output/.../prd.tasks-E{epic}-S{story}.json
  progress: _bmad-output/.../progress.tasks-E{epic}-S{story}.txt
```

### Step 7: Handoff 到 Implement

完成后发送 handoff:
```yaml
layer: 4
stage: tasks
artifacts:
  tasks: _bmad-output/.../tasks.md
  prd: _bmad-output/.../prd.tasks-E{epic}-S{story}.json
  progress: _bmad-output/.../progress.tasks-E{epic}-S{story}.txt
next_action: proceed_to_implement
next_agent: speckit-implement
```

## Constraints

- **禁止自行 commit**
- 必须通过 auditor-tasks 审计
- 每个任务必须有明确的 TDD 循环
- 必须包含 Lint、集成测试、E2E 任务
- **必须在 tasks 阶段创建 ralph-method 追踪文件** (prd/progress)

## Output Location

所有产物必须放在 `_bmad-output/` 下:

```
_bmad-output/
├── epic-{epic}-{epic-slug}/
│   └── story-{story}-{slug}/
│       ├── tasks.md
│       ├── prd.tasks-E{epic}-S{story}.json
│       ├── progress.tasks-E{epic}-S{story}.txt
│       └── AUDIT_tasks-E{epic}-S{story}.md
```
