# IMPLEMENTATION_GAPS-E10-S3：跨平台脚本生成

**Epic**：E10 speckit-init-core  
**Story ID**：10.3  
**输入**：spec-E10-S3.md、plan-E10-S3.md、10-3-cross-platform-script.md、当前实现

---

## 1. Gaps 清单（按需求文档章节）

| 需求文档章节 | Gap ID | 需求要点 | 当前实现状态 | 缺失/偏差说明 |
|-------------|--------|----------|-------------|---------------|
| AC-1、AC-2、AC-4、spec §5 | GAP-1 | --script sh\|ps 解析；合法值 sh/ps，非法值报错退出；未传时 Windows 默认 ps、非 Windows 默认 sh；defaultScript 覆盖 | 未实现 | bin/bmad-speckit.js 无 --script 选项；init.js 无 options.script 解析、无默认值逻辑、无 ConfigManager.defaultScript 读取 |
| AC-1、plan Phase 2 | GAP-2 | POSIX shell 脚本生成：path 生成路径、UTF-8、换行符按 OS；落盘 _bmad/scripts/bmad-speckit/ 下 .sh | 未实现 | 无脚本生成模块；init 流程中无 sh 生成与写入步骤 |
| AC-2、plan Phase 3 | GAP-3 | PowerShell 脚本生成：路径/编码/换行符符合 ARCH §5.2、§5.3（换行符当前按 OS）；.ps1 落盘 | 未实现 | 无 ps 生成逻辑；init 流程中无 .ps1 写入 |
| AC-3、plan Phase 4 | GAP-4 | 编码 UTF-8、换行符当前仅按 OS（用户可配置由后续 Story 负责）；无硬编码分隔符；Windows 控制台考虑 | 未实现 | 无统一 encoding/EOL 工具；init 未对脚本相关输出做代码页处理 |
| plan Phase 5、§4.2 | GAP-5 | 在 writeSelectedAI 之后、最终输出之前调用脚本生成；传入 finalPath、resolvedScriptType、path 处理后的脚本目录；脚本生成在生产代码关键路径中被 init 调用 | 未实现 | init.js 的 runInteractiveFlow 与 runNonInteractiveFlow 中在 writeSelectedAI 后无脚本生成调用；无 script-generator 或等价模块 |
| plan §4 集成/E2E | GAP-6 | init --script sh/ps、非法值报错、Windows/非 Windows 默认、defaultScript 覆盖、编码/换行符/路径验收、生产路径 grep 验证 | 未实现 | 无 init-script 相关 E2E 或集成用例 |

---

## 2. 需求映射清单（GAPS ↔ spec + plan）

| spec 章节 | plan 对应 | Gaps 覆盖 | 覆盖状态 |
|-----------|----------|----------|----------|
| §3 AC-1 | Phase 2 | GAP-2 | ✅ |
| §3 AC-2 | Phase 3 | GAP-3 | ✅ |
| §3 AC-3 | Phase 4 | GAP-4 | ✅ |
| §3 AC-4、§5 | Phase 1 | GAP-1 | ✅ |
| §4.1 集成点 | Phase 5 | GAP-5 | ✅ |
| plan §4、§4.2 | 集成/E2E、生产路径 | GAP-6 | ✅ |

---

## 3. 当前实现摘要

| 模块/文件 | 当前状态 | 与本 Story 相关 |
|----------|----------|-----------------|
| bin/bmad-speckit.js | 有 init 命令，无 --script | 需增加 --script &lt;sh\|ps&gt; |
| src/commands/init.js | 有 runInteractiveFlow、runNonInteractiveFlow；writeSelectedAI 后无脚本生成 | 需解析 --script、默认值、调用脚本生成 |
| src/commands/init-skeleton.js | generateSkeleton、writeSelectedAI、runGitInit；使用 path、writeFileSync utf8 | 脚本生成可新模块或同包；落盘目录需 path.join(finalPath, '_bmad', 'scripts', 'bmad-speckit') 等 |
| src/utils/path.js | path 封装 | 复用 |
| ConfigManager | Story 10.4 可能未完成 | 条件读取 defaultScript |
| 无 script-generator | — | 需新增或等价逻辑 |
| 无 encoding/EOL 工具 | — | 需新增或复用现有写入（init-skeleton 已用 utf8，EOL 未统一） |
| tests/e2e | 有 init-e2e.test.js，无 --script 用例 | 需增加 init-script 集成/E2E |

<!-- AUDIT: PASSED by code-reviewer --> 参见 AUDIT_GAPS-E10-S3.md

---

<!-- AUDIT: PASSED by code-reviewer --> 参见 AUDIT_GAPS-E10-S3.md
