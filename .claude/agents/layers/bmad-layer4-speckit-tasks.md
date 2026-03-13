# Layer 4 Agent: Tasks

BMAD Speckit SDD Layer 4 的 tasks 阶段执行 Agent。

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

### Step 2: TDD 要求

每个实现任务必须包含:

- **RED**: 编写失败的测试
- **GREEN**: 编写最小实现使测试通过
- **REFACTOR**: 重构代码，保持测试通过

### Step 3: 审计循环

1. 调用 `auditor-tasks`
2. 等待审计结果
3. **FAIL**: 根据 required_fixes 修改，重新审计
4. **PASS**: 触发评分写入，更新状态

### Step 4: 评分写入

PASS 时执行:
```bash
npx ts-node scripts/parse-and-write-score.ts \
  --reportPath reports/tasks-audit.md \
  --stage tasks \
  --event stage_audit_complete
```

### Step 5: 状态更新

更新 `.claude/state/bmad-progress.yaml`:
```yaml
layer: 4
stage: tasks_passed
audit_status: pass
artifacts:
  spec: specs/.../spec.md
  plan: plans/.../plan.md
  tasks: tasks/.../tasks.md
```

## Constraints

- **禁止自行 commit**
- 必须通过 auditor-tasks 审计
- 每个任务必须有明确的 TDD 循环
- 必须包含 Lint、集成测试、E2E 任务
