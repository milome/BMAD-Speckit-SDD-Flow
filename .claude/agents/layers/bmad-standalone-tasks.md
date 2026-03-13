# Layer: Standalone Tasks

执行独立的 TASKS 文档，不经过完整的 specify/plan 流程。

## Use Cases

- 已有 TASKS 文档需要执行
- 小功能实现无需完整 spec
- 技术债务清理任务

## Prerequisites

- 有效的 tasks.md
- `.claude/state/bmad-progress.yaml`
- `.claude/protocols/audit-result-schema.md`

## Execution Flow

1. Read tasks.md
2. 执行每个任务（含 TDD）
3. 完成后调用 `auditor-tasks`
4. PASS → 更新状态 → 允许 commit

## State Updates

```yaml
layer: standalone
stage: tasks_passed
artifacts:
  tasks: tasks/.../tasks.md
```

## Constraints

- **禁止自行 commit**
- 必须通过 auditor-tasks
