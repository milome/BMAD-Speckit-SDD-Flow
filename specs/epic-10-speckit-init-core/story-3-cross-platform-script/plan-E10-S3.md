# plan-E10-S3：跨平台脚本生成实现方案

**Epic**：E10 speckit-init-core  
**Story ID**：10.3  
**输入**：spec-E10-S3.md、10-3-cross-platform-script.md

---

## 1. 需求映射清单（plan.md ↔ 需求文档 + spec.md）

| 需求文档章节 | spec.md 对应 | plan.md 对应 | 覆盖状态 |
|-------------|-------------|-------------|----------|
| Story 陈述 | §1 概述 | Phase 1–5、§4 | ✅ |
| AC-1 --script sh 生成 POSIX | spec §3 AC-1 | Phase 2 | ✅ |
| AC-2 --script ps 生成 PowerShell | spec §3 AC-2 | Phase 3 | ✅ |
| AC-3 路径、编码、换行符 | spec §3 AC-3 | Phase 2、3、4 | ✅ |
| AC-4 defaultScript 参与默认值 | spec §3 AC-4 | Phase 1 | ✅ |
| 本 Story 范围 | spec §2.1 | Phase 1–5 | ✅ |
| 架构约束 | spec §4 | Phase 1–5 依赖说明、§5 | ✅ |
| CLI 参数扩展 | spec §5 | Phase 1 | ✅ |

---

## 2. 目标与约束

- **目标**：在 init 流程中增加 `--script sh|ps` 解析与默认值逻辑，在模板拉取与 AI 配置同步之后生成对应平台的包装脚本（POSIX 或 PowerShell），保证路径用 path 模块、编码 UTF-8、换行符当前版本仅按 OS（用户可配置由后续 Story 负责）；Windows 未传 --script 时默认 ps。
- **约束**：复用 Story 10.1/10.2 的 InitCommand、init-skeleton（generateSkeleton、writeSelectedAI）；脚本生成在 writeSelectedAI 之后、最终成功输出之前执行；路径全程使用 Node.js path 模块；defaultScript 通过 ConfigManager 读取（10.4 未完成时仅用平台默认）。
- **必须包含**：集成测试与 E2E（init --script sh、init --script ps、默认值、编码/换行符/路径验证）。

---

## 3. 实施分期

### Phase 1：--script 参数与默认值（AC-1、AC-2、AC-4）

1. **bin/bmad-speckit.js**：init 命令增加 `.option('--script <type>', 'Script type: sh (POSIX) or ps (PowerShell)')`。
2. **init.js**：解析 `options.script`；合法值为 `sh`、`ps`，非法值（如 `bash`、`pwsh`）报错并退出，退出码与现有约定一致（如 exitCodes.INVALID_OPTION 或 GENERAL_ERROR）。
3. **init.js**：未传 --script 时：若平台为 Windows（`process.platform === 'win32'`），默认 `ps`；否则默认 `sh`；若 ConfigManager 存在且提供 `defaultScript`（合法值为 sh/ps），则以其覆盖上述默认。
4. **init.js**：将最终选定的 script 类型（resolvedScriptType）传入后续脚本生成逻辑；在 runNonInteractiveFlow 与 runInteractiveFlow 中，在 generateSkeleton + writeSelectedAI 之后调用脚本生成步骤，传入 finalPath、resolvedScriptType、以及 path 处理后的脚本落盘目录（如 `path.join(finalPath, '_bmad', 'scripts', 'bmad-speckit')`）。
5. **验收**：`init --script sh` 生成 .sh；`init --script ps` 生成 .ps1；`init --script bash` 报错退出；Windows 上 `init`（不传 --script）默认生成 .ps1；非 Windows 上 `init` 默认生成 .sh。

### Phase 2：POSIX shell 脚本生成（AC-1、AC-3）

1. **实现 sh 模板或生成逻辑**：脚本内容中所有路径通过 Node.js path 模块生成（或生成时传入已用 path 处理过的路径变量），禁止硬编码 `/` 或 `\`。
2. **编码与换行符**：写入文件时 encoding 'utf8'；换行符当前版本仅根据 process.platform（Windows 为 CRLF，非 Windows 为 LF）写入，用户可配置由后续 Story 负责，与 PRD §5.7 当前实现范围一致。
3. **落盘路径**：固定为 `<项目根>/_bmad/scripts/bmad-speckit/`，文件名 `bmad-speckit.sh` 或 `bmad-speckit.ps1`；目录由 path.join(finalPath, '_bmad', 'scripts', 'bmad-speckit') 构成（本 Story 不支持可配置目录）。
4. **验收**：生成 .sh 文件存在；文件编码 UTF-8；换行符符合配置；脚本内路径无硬编码分隔符。

### Phase 3：PowerShell 脚本生成（AC-2、AC-3）

1. **实现 ps 模板或生成逻辑**：路径、编码、换行符符合 ARCH §5.2、§5.3；目标 PowerShell 7+，5.1 降级支持（脚本语法兼容）。
2. **落盘路径**：同上目录，扩展名 `.ps1`（如 `bmad-speckit.ps1`）。
3. **验收**：生成 .ps1 文件存在；UTF-8、换行符符合配置；路径用 path 生成。

### Phase 4：编码与换行符工具（AC-3）

1. **复用或实现**：若项目已有 encoding 相关模块则复用；否则在 packages/bmad-speckit 内实现最小可用的 UTF-8 + 换行符写入（如 `writeFileWithEncoding(filePath, content, { encoding: 'utf8', eol: osEOL })`），换行符当前仅按 process.platform，禁止硬编码平台分隔符；用户可配置 EOL 由后续 Story 负责。
2. **Windows 控制台**：init 输出与脚本相关提示时，考虑代码页（如 chcp 65001 或输出前设置），避免乱码；若现有 init 已处理控制台编码，可复用。
3. **验收**：生成文件 UTF-8；LF/CRLF 按 OS 或配置；无硬编码 `/` 或 `\`。

### Phase 5：集成与校验

1. **init 流程挂载点**：在 init.js 的 runInteractiveFlow 与 runNonInteractiveFlow 中，在 writeSelectedAI(finalPath, selectedAI) 之后、最终 `console.log(chalk.green(...))` 之前，调用脚本生成函数，传入目标目录（finalPath）、所选 script 类型（resolvedScriptType）、以及 path 处理后的脚本目录。
2. **脚本生成函数**：根据 resolvedScriptType 调用 sh 或 ps 生成逻辑，确保目录存在（fs.mkdirSync(..., { recursive: true })），再写入对应 .sh 或 .ps1。
3. **验收**：`init --script sh` 与 `init --script ps` 各执行一次，检查生成脚本的编码、换行符、路径；在 Windows 上不传 --script 时默认生成 .ps1；生成脚本在关键路径中被 init 调用（无孤岛）。

---

## 4. 集成测试与端到端功能测试计划（必须）

### 4.1 init 命令脚本生成

| 测试类型 | 测试内容 | 命令/入口 | 预期 |
|----------|----------|-----------|------|
| 集成 | init --script sh 生成 POSIX 脚本 | `node packages/bmad-speckit/bin/bmad-speckit.js init --script sh --ai cursor-agent --yes`（临时目录） | 退出码 0，`_bmad/scripts/bmad-speckit/` 下存在 .sh，UTF-8，换行符符合配置，脚本内路径无硬编码 |
| 集成 | init --script ps 生成 PowerShell 脚本 | 同上 `--script ps` | 退出码 0，存在 .ps1，UTF-8，换行符符合配置 |
| 集成 | --script 非法值报错 | `init --script bash --yes` | 退出码非 0，stderr 含错误提示 |
| 集成 | Windows 默认 ps | 在 Windows 上 `init --ai cursor-agent --yes`（不传 --script） | 生成 .ps1 |
| 集成 | 非 Windows 默认 sh | 在 macOS/Linux 上 `init --ai cursor-agent --yes`（不传 --script） | 生成 .sh |
| 集成 | defaultScript 覆盖（若 10.4 可用） | 设置 defaultScript 为 sh，在 Windows 上 init 不传 --script | 生成 .sh |
| E2E | 交互式 init 后脚本生成 | 交互式 init 选择路径与 AI，最后不传 --script 或传 --script sh/ps | 对应脚本生成且可执行（sh 在 Git Bash/WSL 下，ps 在 PowerShell 下） |

### 4.2 生产代码关键路径验证

- **init.js**：脚本生成在 writeSelectedAI 之后被调用；验收：grep 确认脚本生成函数在 runInteractiveFlow 与 runNonInteractiveFlow 中被调用。
- **path 模块**：脚本内容与落盘路径均通过 path 构造；验收：grep 确认无硬编码 `/` 或 `\` 在生成逻辑中。
- **ConfigManager**：未传 --script 时调用 ConfigManager?.get('defaultScript')（若存在）；验收：grep 确认 defaultScript 在默认值解析分支被引用。

---

## 5. 模块与文件改动设计

### 5.1 修改文件

| 文件 | 变更 | 说明 |
|------|------|------|
| packages/bmad-speckit/bin/bmad-speckit.js | 增加 --script &lt;sh\|ps&gt; 选项 | init 命令 options |
| packages/bmad-speckit/src/commands/init.js | 解析 --script、默认值（平台 + defaultScript）、在 generateSkeleton+writeSelectedAI 之后调用脚本生成 | 核心逻辑；resolvedScriptType 传入脚本生成 |

### 5.2 新增文件

| 文件 | 说明 |
|------|------|
| packages/bmad-speckit/src/commands/script-generator.js（或 scripts/ 下） | 脚本生成：根据 scriptType 生成 sh/ps 内容，调用编码与换行符工具写入；路径用 path |
| packages/bmad-speckit/src/utils/encoding.js（若不存在且无现成模块） | UTF-8 写入 + 换行符（EOL）按 OS 或配置；供 script-generator 与后续复用 |
| packages/bmad-speckit/tests/e2e/init-script-e2e.test.js（或集成到现有 init-e2e） | init --script sh/ps、默认值、编码/换行符/路径校验 |

<!-- AUDIT: PASSED by code-reviewer --> 参见 AUDIT_plan-E10-S3.md

### 5.3 依赖关系

- Phase 1 先行（参数与默认值为脚本生成前置）。
- Phase 2、3 依赖 Phase 1 的 resolvedScriptType；Phase 4 被 Phase 2、3 复用。
- Phase 5 依赖 Phase 1–4，并在 init 流程中挂载脚本生成调用。
