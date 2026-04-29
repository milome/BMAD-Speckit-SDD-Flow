# Journey Ledger 模板

```markdown
## P0 Journey Ledger

| Journey ID | Story | User-visible goal | Blocking dependencies | Production Path | Smoke Proof | Full E2E / deferred reason | Closure Note | Acceptance Evidence |
|------------|-------|-------------------|-----------------------|-----------------|-------------|----------------------------|--------------|--------------------|
| J01 | US1 | [用户可见目标] | [依赖项] | `src/app/...` | `tests/e2e/smoke/...` | `tests/e2e/full/...` 或 deferred reason | `closure-notes/J01.md` | `reports/J01-proof.md` |
| J02 | US2 | [用户可见目标] | [依赖项] | `src/server/...` | `tests/e2e/smoke/...` | `N/A`（写明原因） | `closure-notes/J02.md` | `reports/J02-proof.md` |
```

**填写要求**：
- 只记录真正的 `journey`，不要写成技术模块列表。
- `Smoke Proof` 必须可执行或至少能明确生成。
- `Closure Note` 为空时，Journey 不能宣称完成。
- `Production Path` 为空时，说明真实生产代码入口还未绑定。
- `Acceptance Evidence` 为空时，不得宣称该 Journey 已完成验收。
