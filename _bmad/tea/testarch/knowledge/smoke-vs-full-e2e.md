# Smoke vs Full E2E

## Principle

把 E2E 默认拆成两层：

- **smoke E2E**：验证 `P0 journey` 是否真能跑通，是 PR 默认 gate。
- **full E2E**：验证更宽覆盖面、更多角色/分支/兼容性，是 nightly 或更高成本 gate。

## Default Split

### Smoke E2E

- 目标：用户可见关键路径可跑通
- 位置：`tests/e2e/smoke/`
- 时间预算：默认 `< 10 分钟`
- 失败语义：PR blocker
- 依赖要求：fixture / env 必须最小化、隔离、可复现

### Full E2E

- 目标：更广的业务覆盖、异常路径、组合场景
- 位置：`tests/e2e/full/`
- 时间预算：默认 `< 30 分钟`，超出则分 nightly / matrix
- 失败语义：默认不做首版 PR blocker，可放 nightly 或 follow-up gate
- 依赖要求：允许更完整的数据准备，但不得复用脏状态

## Fixture Rules

- 与 `P0 journey` 直接相关的 fixture 不得依赖共享脏状态。
- smoke 与 full 可以共享 helper，但 fixture 生命周期必须独立。
- fixture 清理策略必须写进框架 README 或 fixture architecture 文档。

## CI Rules

- PR：至少跑 readiness gate、ambiguity linter、smoke E2E（或 smoke skeleton validation）
- Nightly / matrix：跑 full E2E
- 如果仓库当前还没有真实 smoke 套件，先把 smoke skeleton generation 接入 CI，直到真实套件落地
