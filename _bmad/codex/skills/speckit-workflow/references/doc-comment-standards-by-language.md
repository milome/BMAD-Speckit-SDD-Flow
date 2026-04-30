# Doc Comment Standards by Language

**用途**：多语言 doc 注释规范参考、必填 tag 对照、自动化工具、覆盖率工具。供 BMAD 审计流程、code-reviewer、audit-prompts 引用。

---

## 1. 多语言 doc 规范对照表

| 语言 | doc 规范 | 必填 tag/字段 | 自动化工具 | 覆盖率工具 |
|------|----------|---------------|------------|------------|
| JavaScript/TypeScript | JSDoc | @description, @param, @returns（含类型） | eslint-plugin-jsdoc | 自定义解析 export |
| Python | docstring (Google/NumPy/Sphinx) | 首行摘要、Args/Returns/Raises | pydocstyle、interrogate | interrogate |
| Java | Javadoc | @param、@return、@throws | javadoc、detekt | 自定义 |
| Kotlin | KDoc | @param、@return、@throws | detekt | 自定义 |
| Go | godoc | 包注释、导出名注释 | golint、staticcheck | 自定义 |
| Rust | rustdoc | /// 文档、# Examples | clippy、cargo doc | cargo doc |
| C# | XML 文档注释 | \<summary\>、\<param\>、\<returns\> | StyleCop、Roslyn | 自定义 |
| Swift | 文档注释 | 首行、Parameters、Returns | SwiftLint | 自定义 |
| C/C++ | Doxygen | @brief、@param、@return | Doxygen、clang-tidy | 自定义 |
| Ruby | RDoc/YARD | 首行、@param、@return | RuboCop、YARD | 自定义 |
| PHP | phpDocumentor | @param、@return、@throws | phpcs、phpDocumentor | 自定义 |
| Scala | ScalaDoc | @param、@return、@throws | Scalastyle、sbt-doc | 自定义 |

---

## 2. 导出符号定义（按语言）

| 语言 | 导出符号定义 |
|------|--------------|
| JavaScript | `export` 或 `module.exports` 的函数、类、常量 |
| TypeScript | `export` 的函数、类、接口、类型别名、常量 |
| Python | `__all__` 中的名字，或模块顶层公开的 `def`/`class` |
| Java/Kotlin | `public` 且非内部类/接口 |
| Go | 首字母大写的标识符 |
| Rust | `pub` 项 |
| C# | `public`、`internal`（视项目） |
| Swift | `public`、`internal`（视项目） |
| C/C++ | 头文件中的声明 |
| Ruby | 顶层 `def`、`class`、`module` |
| PHP | `public` 方法、类 |
| Scala | `public` 或未标注访问级别的成员 |

---

## 3. 本项目（JS/TS）审计标准

### 3.1 适用范围

- `packages/bmad-speckit/src/**/*.js`
- `scoring/**/*.ts`
- `scripts/**/*.ts`

排除：`**/__tests__/**`、`**/*.test.js`、`**/*.test.ts`。

### 3.2 必填 tag

| 场景 | 必填 tag | 说明 |
|------|----------|------|
| 导出函数/方法 | @description | 函数用途说明 |
| 有参数 | @param {Type} name - 说明 | 含类型与说明 |
| 有返回值 | @returns {Type} 说明 | 含类型与说明 |
| 无返回值（void） | @description | 不要求 @returns |
| 导出类 | @description | 类职责说明 |
| 导出常量 | @description | 常量含义 |

不强制：@example、@throws（若有 throw 可人工检查）。

### 3.3 ESLint 规则（与 T002 一致）

```
jsdoc/require-description: error
jsdoc/require-param: error
jsdoc/require-param-description: warn
jsdoc/require-param-type: error
jsdoc/require-returns: error
jsdoc/require-returns-description: warn
jsdoc/require-returns-type: error
```

### 3.4 验收命令

```bash
npm run lint
```

---

*本表由 BMAD Party-Mode 100 轮讨论收敛，批判性审计员终审同意。*
