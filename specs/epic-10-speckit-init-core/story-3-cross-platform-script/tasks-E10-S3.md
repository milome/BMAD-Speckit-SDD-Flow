# tasks-E10-S3：跨平台脚本生成

**Epic**：E10 speckit-init-core  
**Story ID**：10.3  
**输入**：spec-E10-S3.md、plan-E10-S3.md、IMPLEMENTATION_GAPS-E10-S3.md、10-3-cross-platform-script.md

---

## 1. 本批任务 ↔ 需求追溯

| 任务 ID | 需求文档 | 章节 | 需求要点 |
|---------|----------|------|----------|
| T1 | 10-3-cross-platform-script, spec §5 | AC-1, AC-2, AC-4 | --script sh\|ps 解析、默认值（Windows→ps/非Windows→sh）、defaultScript 覆盖 |
| T2 | spec §3 AC-1, plan Phase 2 | GAP-2 | POSIX shell 脚本生成，path/UTF-8/换行符，落盘 .sh |
| T3 | spec §3 AC-2, plan Phase 3 | GAP-3 | PowerShell 脚本生成，path/编码/换行符，落盘 .ps1 |
| T4 | spec §3 AC-3, plan Phase 4 | GAP-4 | 编码与换行符工具（UTF-8、LF/CRLF），无硬编码分隔符 |
| T5 | plan Phase 5 | GAP-5 | init 流程中挂载脚本生成（writeSelectedAI 之后调用） |
| T6 | plan §4 | GAP-6 | 集成测试与 E2E、生产代码关键路径验证 |

---

## 2. Gaps → 任务映射（按需求文档章节）

**核对规则**：IMPLEMENTATION_GAPS.md 中出现的每一条 Gap 必须在本任务表中出现并对应到具体任务；不得遗漏。

| 章节 | Gap ID | 本任务表行 | 对应任务 |
|------|--------|------------|----------|
| AC-1、AC-2、AC-4、spec §5 | GAP-1 | ✓ 有 | T1 |
| AC-1、plan Phase 2 | GAP-2 | ✓ 有 | T2 |
| AC-2、plan Phase 3 | GAP-3 | ✓ 有 | T3 |
| AC-3、plan Phase 4 | GAP-4 | ✓ 有 | T4 |
| plan Phase 5、§4.2 | GAP-5 | ✓ 有 | T5 |
| plan §4、§4.2 | GAP-6 | ✓ 有 | T6 |

---

## 3. 任务列表

### Phase 1：--script 参数与默认值（GAP-1）

- [x] **T1.1** bin/bmad-speckit.js：init 命令增加 `.option('--script <type>', 'Script type: sh (POSIX) or ps (PowerShell)')`
  - **验收**：`node bin/bmad-speckit.js init --help` 含 --script
- [x] **T1.2** init.js：解析 options.script；合法值为 `sh`、`ps`，非法值（如 bash、pwsh）报错并退出，退出码与现有约定一致
  - **验收**：`init --script bash --ai cursor-agent --yes` 退出码非 0，stderr 含错误提示
- [x] **T1.3** init.js：未传 --script 时，若 process.platform === 'win32' 默认 `ps`，否则默认 `sh`；若 ConfigManager 存在且 get('defaultScript') 为合法值（sh/ps），则以其覆盖
  - **验收**：Windows 上 `init --ai cursor-agent --yes`（不传 --script）生成 .ps1；非 Windows 上生成 .sh；若 defaultScript 已设置则使用 defaultScript
- [x] **T1.4** init.js：计算 resolvedScriptType（解析+默认+defaultScript 后的最终值），传入后续脚本生成步骤
  - **验收**：grep 确认 resolvedScriptType 或等效变量在脚本生成调用处被传入

### Phase 2：POSIX shell 脚本生成（GAP-2）

- [x] **T2.1** 实现 sh 脚本生成：脚本内容中路径均通过 Node.js path 模块生成，禁止硬编码 `/` 或 `\`；内容 UTF-8，换行符按配置（Phase 4 工具）
  - **验收**：生成 .sh 文件存在；文件 encoding UTF-8；脚本内无硬编码路径分隔符
- [x] **T2.2** 落盘路径：path.join(finalPath, '_bmad', 'scripts', 'bmad-speckit') 或与 10.1 一致；文件名符合 POSIX 惯例（如 bmad-speckit.sh）；目录不存在时 mkdirSync recursive
  - **验收**：init --script sh --ai cursor-agent --yes 后，目标目录下存在 .sh 文件

### Phase 3：PowerShell 脚本生成（GAP-3）

- [x] **T3.1** 实现 ps 脚本生成：路径、编码、换行符符合 ARCH §5.2、§5.3；目标 PowerShell 7+，5.1 降级支持；扩展名 .ps1
  - **验收**：生成 .ps1 文件存在；UTF-8、换行符符合配置；路径用 path 生成
- [x] **T3.2** 落盘路径：同 T2.2 目录，扩展名 .ps1
  - **验收**：init --script ps --ai cursor-agent --yes 后，目标目录下存在 .ps1 文件

### Phase 4：编码与换行符工具（GAP-4）

- [x] **T4.1** 若项目已有 encoding 相关模块则复用；否则在 packages/bmad-speckit 内实现：写入文件时 encoding 'utf8'，换行符当前仅根据 process.platform（用户可配置由后续 Story 负责）写入，禁止硬编码平台分隔符
  - **验收**：生成文件 UTF-8；LF/CRLF 按 OS；无硬编码 `/` 或 `\` 在写入逻辑中
- [x] **T4.2** Windows 控制台：init 输出与脚本相关提示时考虑代码页（如 UTF-8），避免乱码；若现有 init 已处理则复用
  - **验收**：在 Windows 上 init 完成时脚本路径/提示无乱码（可选 chcp 65001 或等价）

### Phase 5：集成挂载（GAP-5）

- [x] **T5.1** init.js：在 runInteractiveFlow 与 runNonInteractiveFlow 中，在 writeSelectedAI(finalPath, selectedAI) 之后、最终 console.log(chalk.green(...)) 之前，调用脚本生成函数，传入 finalPath、resolvedScriptType、path 处理后的脚本目录
  - **验收**：grep 确认脚本生成在 writeSelectedAI 之后被调用；两处流程（交互/非交互）均调用
- [x] **T5.2** 脚本生成函数：根据 resolvedScriptType 调用 sh 或 ps 生成逻辑，确保目录存在后写入 .sh 或 .ps1；可在 script-generator.js 或等价模块实现
  - **验收**：init 完成后对应类型脚本存在且在生产代码关键路径中被 init 调用（无孤岛模块）

### Phase 6：集成测试与 E2E（GAP-6）

- [x] **T6.1** 增加集成/E2E 用例（tests/e2e/init-script-e2e.test.js 或集成到 init-e2e.test.js）：
  - init --script sh --ai cursor-agent --yes（临时目录）→ 退出码 0，_bmad/scripts/bmad-speckit/ 下存在 .sh，UTF-8，换行符按 OS，脚本内路径无硬编码
  - init --script ps --ai cursor-agent --yes → 退出码 0，存在 .ps1，UTF-8，换行符按 OS
  - init --script bash --yes → 退出码非 0，stderr 含错误
  - Windows 上 init --ai cursor-agent --yes（不传 --script）→ 生成 .ps1
  - 非 Windows 上 init --ai cursor-agent --yes（不传 --script）→ 生成 .sh
  - （若 10.4 可用）defaultScript 覆盖：设置 defaultScript=sh，Windows 上 init 不传 --script → 生成 .sh
  - 交互式 init 后脚本生成：交互式 init 完成，不传或传 --script sh/ps → 对应脚本生成
- [x] **T6.2** 生产代码关键路径 grep 验证：脚本生成在 init.js runInteractiveFlow/runNonInteractiveFlow 中被调用；path 在生成逻辑中使用、无硬编码；ConfigManager defaultScript 在默认值解析分支被引用
  - **验收**：T6.1 用例通过；grep 验证通过

---

## 4. 需求映射清单（tasks ↔ plan + GAPS）

| plan 章节 | Gaps | tasks 对应 | 覆盖状态 |
|-----------|------|------------|----------|
| Phase 1 --script 与默认值 | GAP-1 | T1.1–T1.4 | ✅ |
| Phase 2 POSIX 生成 | GAP-2 | T2.1, T2.2 | ✅ |
| Phase 3 PowerShell 生成 | GAP-3 | T3.1, T3.2 | ✅ |
| Phase 4 编码换行符 | GAP-4 | T4.1, T4.2 | ✅ |
| Phase 5 集成挂载 | GAP-5 | T5.1, T5.2 | ✅ |
| plan §4 集成/E2E、§4.2 | GAP-6 | T6.1, T6.2 | ✅ |

---

## 5. 验收表头（按 Gap 逐条验证）

| Gap ID | 对应任务 | 生产代码实现要点（文件/类/方法/实现细节） | 集成测试要求（测试文件/用例/命令/预期） | 执行情况 | 验证通过 |
|--------|----------|------------------------------------------|----------------------------------------|----------|----------|
| GAP-1 | T1.1–T1.4 | bin --script 选项；init.js 解析、非法值退出、默认值、defaultScript、resolvedScriptType | init --script sh/ps/bash；Windows/非Windows 默认；defaultScript 覆盖 | [x] 已执行 | [x] |
| GAP-2 | T2.1, T2.2 | script-generator 或等价：sh 内容 path 生成、UTF-8/EOL 写入、落盘 _bmad/scripts/bmad-speckit/*.sh | init --script sh 后 .sh 存在、UTF-8、无硬编码路径 | [x] 已执行 | [x] |
| GAP-3 | T3.1, T3.2 | ps 生成逻辑、.ps1 落盘 | init --script ps 后 .ps1 存在、UTF-8 | [x] 已执行 | [x] |
| GAP-4 | T4.1, T4.2 | encoding/EOL 工具或复用；Windows 控制台 | 生成文件 UTF-8、LF/CRLF；控制台无乱码 | [x] 已执行 | [x] |
| GAP-5 | T5.1, T5.2 | init.js writeSelectedAI 后调用脚本生成；script-generator 被 init 引用 | grep 确认调用点；init 完成后脚本存在 | [x] 已执行 | [x] |
| GAP-6 | T6.1, T6.2 | init-script-e2e 或 init-e2e 扩展；grep 验证 | plan §4.1 全部用例 + §4.2 grep | [x] 已执行 | [x] |

<!-- AUDIT: PASSED by code-reviewer --> 参见 AUDIT_tasks-E10-S3.md

---

<!-- AUDIT: PASSED by code-reviewer --> 参见 AUDIT_tasks-E10-S3.md
