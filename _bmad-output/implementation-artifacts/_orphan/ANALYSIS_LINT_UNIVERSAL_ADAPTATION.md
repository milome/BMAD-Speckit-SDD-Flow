# Lint 通用化适配分析报告

**生成日期**：2026-03-11  
**依据**：主流编程语言 Lint 工具适配结论（C/C++、Java、Python、JS/TS、Go、Rust、PHP、Ruby、Swift、Kotlin、C#、Shell、Dart、Lua、R、SQL 等 16+ 语言）

---

## 1. 问题与目标

### 1.1 原问题

- 原 TASKS_lint_mandatory 仅写死 `npm run lint`，缺乏跨语言通用性；
- 「若项目存在 lint」导致未配置时可不检查，质量门控不足；
- 用户要求：**对所有可运行 lint 的编程语言均须运行 lint；若项目使用某主流语言但未配置该语言的 lint，须作为重要质量问题修复，审计不予通过**。

### 1.2 目标

- **语言无关**：不绑定 npm，按技术栈选择对应 lint 工具；
- **未配置即不通过**：使用某主流语言但未配置 lint = 重要质量问题，审计不予通过；
- **可执行**：审计可基于项目特征文件推断语言并验证 lint 配置与执行。

---

## 2. 主流语言 Lint 工具适配表（最终版）

| 语言 | 项目特征 | 主流工具 | 建议执行命令 |
|------|----------|----------|--------------|
| C/C++ | CMakeLists.txt, Makefile, *.c, *.cpp | Clang-Tidy, Cppcheck, cpplint | clang-tidy / cppcheck / cpplint |
| Java | pom.xml, build.gradle, *.java | Checkstyle, SpotBugs, PMD | mvn checkstyle:check / gradlew check |
| Python | pyproject.toml, requirements.txt, *.py | Ruff, Pylint, Flake8 | ruff check . / pylint / flake8 . |
| JS/TS | package.json, *.js, *.ts | ESLint | npm run lint / eslint . |
| Go | go.mod, *.go | golangci-lint | golangci-lint run |
| Rust | Cargo.toml, *.rs | Clippy | cargo clippy |
| PHP | composer.json, *.php | PHP_CodeSniffer, PHPStan | phpcs / phpstan analyse |
| Ruby | Gemfile, *.rb | RuboCop | bundle exec rubocop |
| Swift | Package.swift, *.swift | SwiftLint | swiftlint lint |
| Kotlin | build.gradle.kts, *.kt | ktlint, detekt | gradlew ktlintCheck / detekt |
| C# | *.csproj, *.cs | StyleCop, Roslynator | dotnet format / dotnet build |
| Shell | *.sh, *.bash | ShellCheck | shellcheck **/*.sh |
| Dart | pubspec.yaml, *.dart | dart analyze | dart analyze / flutter analyze |
| Lua | *.lua | LuaCheck | luacheck . |
| R | *.R, *.Rmd | lintr | lintr::lint_package() |
| SQL | *.sql | SQLFluff | sqlfluff lint . |
| Terraform | *.tf | tflint, terraform fmt | terraform fmt -check / tflint |
| YAML | *.yaml, *.yml | yamllint | yamllint . |
| Dockerfile | Dockerfile | hadolint | hadolint Dockerfile |

完整矩阵见 `skills/speckit-workflow/references/lint-requirement-matrix.md`。

---

## 3. 统一表述模板（供各 skill 引用）

### 3.1 通用 lint 验收条目

```
**lint（必须）**：项目须按其所用技术栈配置并执行对应的 Lint 工具（见 lint-requirement-matrix.md）；验收前须执行且无错误、无警告。若项目使用 C/C++、Java、Python、JS/TS、Go、Rust、PHP、Ruby、Swift、Kotlin、C#、Shell、Dart、Lua、R、SQL 等主流语言之一但未配置该语言的 Lint 工具，须作为重要质量问题修复，审计不予通过。禁止以「与本次任务不相关」为由豁免。
```

### 3.2 审计检查项（§5 等）

```
（9）**必须**检查：项目须按技术栈配置并执行 Lint（见 lint-requirement-matrix）；若使用主流语言但未配置 Lint，须作为未通过项；已配置的须执行且无错误、无警告。**禁止**以「与本次任务不相关」豁免。
```

### 3.3 批判审计员维度

```
| lint 未通过或未配置 | 项目使用主流语言但未配置 Lint；或已配置但执行存在错误/警告；禁止以「与本次任务不相关」豁免 |
```

---

## 4. 修改策略

### 4.1 新增文件

- **lint-requirement-matrix.md**：路径 `skills/speckit-workflow/references/lint-requirement-matrix.md`，包含完整语言→工具→命令映射表。

### 4.2 需更新位置（T1–T12 + 新增 T0）

| 任务 | 修改要点 |
|------|----------|
| **T0（新增）** | 创建 lint-requirement-matrix.md |
| T1, T12 | tasks-acceptance-templates：将「npm run lint」改为通用表述并引用 matrix |
| T2, T6 | audit-prompts §5、§4：改为按技术栈 + 未配置即不通过 |
| T3 | critical-auditor-appendix：维度扩展为「未配置」或「执行有错误/警告」 |
| T4 | speckit-workflow SKILL：7.1 改为通用表述 |
| T5 | ralph-method：保留 JS/TS 示例，补充「其他语言见 matrix」及未配置不通过 |
| T7, T8, T9 | bmad-bug-assistant、bmad-story-assistant、bmad-standalone-tasks：改为通用表述 |
| T10 | speckit.implement：Step 9 改为按技术栈执行 lint |
| T11 | bmad-standalone-tasks-doc-review：lint 验收改为按技术栈 |

---

## 5. 审计检测逻辑

1. **识别项目语言**：依据 package.json、pyproject.toml、go.mod、Cargo.toml、pom.xml、*.csproj、composer.json、Gemfile、pubspec.yaml、*.sh 等。
2. **检查 Lint 配置**：在 lint-requirement-matrix 中查该语言对应的配置依据（如 package.json scripts.lint、.ruff.toml、golangci.yml 等）。
3. **执行 Lint**：运行 matrix 中建议的命令。
4. **判定**：未配置 → 未通过；有错误/警告 → 未通过；全部通过 → 通过。

---

## 6. 结论

- 将「npm run lint」替换为**按技术栈 + lint-requirement-matrix 引用**的通用表述；
- 明确**未配置 Lint = 重要质量问题，审计不予通过**；
- 在 TASKS 中新增 T0（创建 matrix）、并全面更新 T1–T12 的修改内容。
