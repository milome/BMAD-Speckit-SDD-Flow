# Journey Ledger 模板

```markdown
## P0 Journey Ledger

| Journey ID | Story | User-visible goal | Blocking dependencies | Smoke Proof | Full E2E / deferred reason | Closure Note |
|------------|-------|-------------------|-----------------------|-------------|----------------------------|--------------|
| J01 | US1 | [用户可见目标] | [依赖项] | `tests/e2e/smoke/...` | `tests/e2e/full/...` 或 deferred reason | `closure-notes/J01.md` |
| J02 | US2 | [用户可见目标] | [依赖项] | `tests/e2e/smoke/...` | `N/A`（写明原因） | `closure-notes/J02.md` |
```

**填写要求**：
- 只记录真正的 `journey`，不要写成技术模块列表。
- `Smoke Proof` 必须可执行或至少能明确生成。
- `Closure Note` 为空时，Journey 不能宣称完成。
