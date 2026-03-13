# Layer 4 Agent: Plan (改进版)

BMAD Speckit SDD Layer 4 的 plan 阶段执行 Agent。

## 状态文件区分

| 文件 | 用途 | 控制方 | 示例内容 |
|------|------|--------|----------|
| `.claude/state/bmad-progress.yaml` | **五层架构状态控制** | bmad-master | `stage: plan_passed` |
| `_bmad-output/{story}/plan.md` | **阶段产物** | plan agent | 架构规划文档 |
| `_bmad-output/{story}/AUDIT_plan-*.md` | **审计报告** | auditor-plan | 审计结果 |

## Prerequisites

- `specify` 阶段已 PASS
- `.claude/state/bmad-progress.yaml` 中 `stage: specify_passed`

## Mandatory Startup

1. Read `skills/speckit-workflow/references/audit-prompts.md`
2. Read `.claude/state/bmad-progress.yaml` (检查当前 stage)
3. Read spec.md (来自 specify 阶段产物，路径从 bmad-progress.yaml 读取)

## Execution Flow

### Step 1: 读取前置产物

从 `.claude/state/bmad-progress.yaml` 读取:
```yaml
artifacts:
  spec: _bmad-output/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/spec.md
```

读取 spec.md 作为输入。

### Step 2: 架构设计

基于 spec 生成 plan.md:

- **架构概览**: 系统组件和交互
- **数据模型**: 核心实体和关系
- **接口契约**: API/事件/消息格式
- **文件映射**: 新增/修改的文件清单
- **依赖分析**: 内部和外部依赖

**输出位置**:
```
_bmad-output/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/plan.md
```

### Step 3: 测试策略

明确测试计划:

- **集成测试**: 组件间集成验证
- **端到端功能测试**: 完整用户流程验证
- **性能测试**: 如有性能需求
- **安全测试**: 如有安全需求

### Step 4: 审计循环

1. 调用 `auditor-plan`
2. 等待审计结果
3. **FAIL**: 根据 required_fixes 修改，重新审计
4. **PASS**: 触发评分写入，更新状态

**审计报告路径**:
```bash
_bmad-output/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/AUDIT_plan-E{epic}-S{story}.md
```

### Step 5: 评分写入

PASS 时执行:
```bash
npx ts-node scripts/parse-and-write-score.ts \
  --reportPath _bmad-output/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/AUDIT_plan-E{epic}-S{story}.md \
  --stage plan \
  --event stage_audit_complete \
  --epic {epic} \
  --story {story} \
  --artifactDocPath _bmad-output/.../plan.md \
  --iteration-count {count}
```

### Step 6: 状态更新 (bmad-progress.yaml)

**⚠️ 注意**: 这是五层架构状态，不是 ralph-method。

更新 `.claude/state/bmad-progress.yaml`:
```yaml
layer: 4
stage: plan_passed
audit_status: pass
epic: "{epic}"
story: "{story}"
artifacts:
  spec: _bmad-output/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/spec.md
  plan: _bmad-output/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/plan.md
  audit: _bmad-output/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/AUDIT_plan-E{epic}-S{story}.md
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

### Step 7: Handoff

完成后发送 handoff 到 bmad-master:
```yaml
layer: 4
stage: plan
artifactDocPath: _bmad-output/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/plan.md
auditReportPath: _bmad-output/epic-{epic}-{epic-slug}/story-{story}-{story-slug}/AUDIT_plan-E{epic}-S{story}.md
next_action: proceed_to_tasks
```

## Constraints

- **禁止自行 commit**
- 必须通过 auditor-plan 审计
- 必须包含集成测试计划
- 必须包含 E2E 测试计划
- **所有产物必须保存到 _bmad-output/**

## Output Location

```
_bmad-output/
├── epic-{epic}-{epic-slug}/
│   └── story-{story}-{story-slug}/
│       ├── spec.md                              # 来自 specify
│       ├── plan.md                              # 架构规划
│       ├── AUDIT_spec-E{epic}-S{story}.md      # 来自 specify
│       └── AUDIT_plan-E{epic}-S{story}.md      # 审计报告
```

## 与 bmad-progress.yaml 的关系

- `bmad-progress.yaml`: 控制 Layer 4 五层流程的状态机
- `_bmad-output/.../plan.md`: plan 阶段的具体产物
- bmad-master 读取 bmad-progress.yaml 来决定路由到哪个 Agent
