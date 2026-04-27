# Lint 宸ュ叿闇€姹傜煩闃碉紙鎸夎瑷€锛?
**鐢ㄩ€?*锛氶獙鏀舵爣鍑嗐€佸疄鏂藉悗瀹¤銆佹壒鍒ゅ璁″憳妫€鏌ユ椂锛屾寜椤圭洰鎶€鏈爤纭畾 Lint 宸ュ叿涓庢墽琛屽懡浠ゃ€傝嫢椤圭洰浣跨敤琛ㄤ腑鏌愪富娴佽瑷€浣嗘湭閰嶇疆璇ヨ瑷€鐨?Lint 宸ュ叿锛岄』浣滀负閲嶈璐ㄩ噺闂淇锛屽璁′笉浜堥€氳繃銆?
| 璇█ | 椤圭洰鐗瑰緛 | 涓绘祦宸ュ叿 | 寤鸿鎵ц鍛戒护 |
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

**閫氱敤寮曠敤琛ㄨ堪**锛氶」鐩』鎸夊叾鎵€鐢ㄦ妧鏈爤閰嶇疆骞舵墽琛屽搴旂殑 Lint 宸ュ叿锛涢獙鏀跺墠椤绘墽琛屼笖鏃犻敊璇€佹棤璀﹀憡銆傝嫢椤圭洰浣跨敤 C/C++銆丣ava銆丳ython銆丣S/TS銆丟o銆丷ust銆丳HP銆丷uby銆丼wift銆並otlin銆丆#銆丼hell銆丏art銆丩ua銆丷銆丼QL 绛変富娴佽瑷€涔嬩竴浣嗘湭閰嶇疆璇ヨ瑷€鐨?Lint 宸ュ叿锛岄』浣滀负閲嶈璐ㄩ噺闂淇锛屽璁′笉浜堥€氳繃銆傜姝互銆屼笌鏈浠诲姟涓嶇浉鍏炽€嶄负鐢辫眮鍏嶃€?
