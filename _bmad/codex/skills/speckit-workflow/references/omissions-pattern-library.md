# Omission Pattern Library

本库用于收敛 `readiness gate`、`ambiguity linter`、后续 checklist / audit prompt 的遗漏语义。目标不是做泛化语言审查，而是尽量早地抓住会让 `P0 journey` 跑不通的高价值缺口。

## 1. Missing Completion State

- 症状：只写“完成”“ready”“done”，没有定义什么才算用户可见完成。
- 常见后果：模块实现完成，但业务完成态未定义，E2E 无法验收。
- 默认处理：判为 definition gap，回到 clarify / readiness。

## 2. Missing Failure Trigger

- 症状：只定义成功路径，没有说明失败条件、回滚条件、告警条件。
- 常见后果：smoke 通过时看似正常，真实失败路径无人验证。
- 默认处理：补充 failure matrix 或 deferred reason，再进入 tasks / implement。

## 3. Missing Permission Boundary

- 症状：未定义谁能做、谁不能做，或权限切换点被省略。
- 常见后果：实现与 smoke 路径不一致，线上入口无法真正使用。
- 默认处理：判为 blocker，触发 re-readiness。

## 4. Missing Fixture Cleanup

- 症状：写了 fixture / seed data，但没有生命周期、清理、隔离规则。
- 常见后果：smoke / full E2E 共享脏状态，CI 偶发失败。
- 默认处理：补 fixture lifecycle 和 cleanup contract。

## 5. Missing Smoke Assertion

- 症状：只说“生成 smoke 测试”，没有断言目标、验证命令、预期结果。
- 常见后果：有测试文件但没有证明，Journey 仍不可收口。
- 默认处理：补 `Evidence Type`、`Verification Command`、`Closure Note`。

## 6. Module Complete But Journey Not Runnable

- 症状：前端、后端、数据库各自完成，但真实入口仍然没有可跑通路径。
- 常见后果：长任务后功能点丢失、集成链断裂、closure 无法写。
- 默认处理：在 tasks / implement 审计中作为 blocker，禁止宣布通过。

## 7. Silent Assumption Markers

- 高风险短语：`TODO`、`TBD`、`FIXME`、`???`、`后续补齐`、`后续考虑`、`默认如此`、`暂不处理`、`later wire in`
- 默认处理：readiness gate / ambiguity linter 直接报出。

## Tooling Notes

- `readiness_gate.py`：主要抓 blocker words、ledger 完整性、closure completeness、fixture/env placeholder。
- `ambiguity_linter.py`：主要抓 unresolved markers、silent assumptions、completion / role placeholders。
- 后续 `speckit.checklist` / audit prompts 应优先引用本库中的 blocker 类目，而不是抽象地说“文档不完整”。
