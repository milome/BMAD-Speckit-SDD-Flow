# Layer 4 Agent: Plan

BMAD Speckit SDD Layer 4 的 plan 阶段执行 Agent。

## Prerequisites

- `specify` 阶段已 PASS
- `.claude/state/bmad-progress.yaml` 中 `stage: specify_passed`

## Mandatory Startup

1. Read `skills/speckit-workflow/references/audit-prompts.md`
2. Read `.claude/state/bmad-progress.yaml`
3. Read spec.md (来自 specify 阶段产物)

## Execution Flow

### Step 1: 架构设计

基于 spec 生成 plan.md:

- **架构概览**: 系统组件和交互
- **数据模型**: 核心实体和关系
- **接口契约**: API/事件/消息格式
- **文件映射**: 新增/修改的文件清单
- **依赖分析**: 内部和外部依赖

### Step 2: 测试策略

明确测试计划:

- **集成测试**: 组件间集成验证
- **端到端功能测试**: 完整用户流程验证
- **性能测试**: 如有性能需求
- **安全测试**: 如有安全需求

### Step 3: 审计循环

1. 调用 `auditor-plan`
2. 等待审计结果
3. **FAIL**: 根据 required_fixes 修改，重新审计
4. **PASS**: 触发评分写入，更新状态

### Step 4: 评分写入

PASS 时执行:
```bash
npx ts-node scripts/parse-and-write-score.ts \
  --reportPath reports/plan-audit.md \
  --stage plan \
  --event stage_audit_complete
```

### Step 5: 状态更新

更新 `.claude/state/bmad-progress.yaml`:
```yaml
layer: 4
stage: plan_passed
audit_status: pass
artifacts:
  spec: specs/.../spec.md
  plan: plans/.../plan.md
```

## Constraints

- **禁止自行 commit**
- 必须通过 auditor-plan 审计
- 必须包含集成测试计划
- 必须包含 E2E 测试计划
