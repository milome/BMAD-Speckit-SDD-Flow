# Invariant Ledger 模板

```markdown
## Invariant Ledger

| Invariant ID | Applies to Journey | Rule that must never break | Evidence Type | Verification Command | Owner Task IDs |
|--------------|--------------------|----------------------------|---------------|----------------------|----------------|
| INV-01 | J01 | [不变量说明] | integration / smoke-e2e | `[命令]` | T021, T022 |
| INV-02 | J02 | [不变量说明] | unit / integration | `[命令]` | T031 |
```

**填写要求**：
- 不变量必须可验证，禁止空泛描述。
- `Evidence Type` 与 `Verification Command` 必须成对出现。
- 一个 invariant 可覆盖多个任务，但必须能回指到具体 Task IDs。
