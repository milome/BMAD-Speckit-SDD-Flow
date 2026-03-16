# Doc Comment 审计 Checklist

**用途**：供 code-reviewer、audit-prompts、人工审计引用。用于验证导出符号的 JSDoc 完整性。

---

## §1 适用范围

- `packages/bmad-speckit/src/**/*.js`
- `scoring/**/*.ts`
- `scripts/**/*.ts`

排除：`**/__tests__/**`、`**/*.test.js`、`**/*.test.ts`。

---

## §2 必填项

| 符号类型 | 必填 tag | 说明 |
|----------|----------|------|
| 导出函数 | @description | 函数用途说明 |
| 有参数 | @param {Type} name - 说明 | 含类型与说明 |
| 有返回值 | @returns {Type} 说明 | 含类型与说明 |
| 无返回值（void） | @description | 不要求 @returns |
| 导出类 | @description | 类职责说明；其 public 方法按函数规则 |
| 导出常量 | @description | 常量含义 |

---

## §3 验收方式

```bash
npm run lint
```

验收通过条件：`npm run lint` 无错误、无警告（针对上述适用范围内的文件）。

---

## §4 参考

- 多语言 doc 规范与必填 tag 对照：[doc-comment-standards-by-language.md](./doc-comment-standards-by-language.md)

---

*本 checklist 与 ESLint jsdoc 规则一致；审计时须执行验收命令验证。*
