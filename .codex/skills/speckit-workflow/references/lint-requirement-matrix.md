# Lint 工具需求矩阵（按语言）

**用途**：验收标准、实施后审计、批判审计员检查时，按项目技术栈确定 Lint 工具与执行命令。若项目使用表中某主流语言但未配置该语言的 Lint 工具，须作为重要质量问题修复，审计不予通过。

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

**通用引用表述**：项目须按其所用技术栈配置并执行对应的 Lint 工具；验收前须执行且无错误、无警告。若项目使用 C/C++、Java、Python、JS/TS、Go、Rust、PHP、Ruby、Swift、Kotlin、C#、Shell、Dart、Lua、R、SQL 等主流语言之一但未配置该语言的 Lint 工具，须作为重要质量问题修复，审计不予通过。禁止以「与本次任务不相关」为由豁免。
