# Story 13.2: 异常路径（退出码 1/2/3/4、通用错误提示、网络超时可配置）

Status: ready-for-dev

<!-- Note: Run validate-create-story for quality check before dev-story. -->

## Story

**As a** CI 工程师或脚本调用者，  
**I want to** 在 init、check 及所有子命令的异常路径上获得统一的退出码（1 通用/结构验证失败、2 --ai 无效、3 网络/模板、4 路径不可用）与明确的错误提示，且网络超时由 networkTimeoutMs/SDD_NETWORK_TIMEOUT_MS 可配置（默认 30000ms），  
**so that** 脚本可通过 `$?` 或 exitCode 可靠判断失败类型，用户可获得可操作的修复提示。

## 需求追溯

| 来源 | 章节/ID | 映射内容 |
|------|---------|----------|
| PRD | §5.2 | 错误码约定：退出码 1–5 与典型场景；--ai 无效须输出可用 AI 列表或 check --list-ai；网络超时/模板失败明确错误信息；--bmad-path 路径不可用退出码 4 |
| PRD | §5.5 | check 结构验证失败退出码 1、成功退出码 0 |
| ARCH | §3.4 | 退出码约定（constants/exit-codes.js） |
| ARCH | §3.2 | TemplateFetcher：networkTimeoutMs 或 SDD_NETWORK_TIMEOUT_MS，默认 30000ms |
| Epics | 13.2 | 异常路径：网络超时可配置、模板失败、--bmad-path 路径不可用；退出码 1–5 |
| Story 11.2 | 非本 Story 范围 | 退出码 5（离线 cache 缺失）由 Story 11.2 约定；本 Story 仅引用 5 的定义归属 |

## 本 Story 范围

- **退出码 1（通用/结构验证失败）**：未分类异常、配置解析失败、check 结构验证失败。包含但不限于：未预期异常、配置格式错误、check 验证清单不通过（_bmad、_bmad-output、AI 目标目录等结构缺失）。
- **退出码 2（--ai 无效）**：`--ai <name>` 指定的 name 不在内置列表或 registry 中；或 `--ai generic` 时未提供 `--ai-commands-dir` 且 registry 中无 `aiCommandsDir`。输出须包含可用 AI 列表或明确提示用户运行 `bmad-speckit check --list-ai`。
- **退出码 3（网络/模板）**：网络超时（由 networkTimeoutMs/SDD_NETWORK_TIMEOUT_MS 控制，默认 30000ms）、模板拉取 404/非 2xx、解压失败、模板拉取失败等。错误信息须明确（含「网络超时」或等价表述），并建议 `--offline` 或检查网络。
- **退出码 4（路径不可用）**：目标路径已存在且非空且未传 `--force`；无写权限；`--bmad-path <path>` 指向路径不存在或结构不符合 §5.5 验证清单；check 在 worktree 共享模式下验证 bmadPath 时同理。错误信息须明确说明路径不可用原因。
- **通用错误提示格式**：所有异常路径的错误信息须输出至 stderr（或 stdout，与项目现有约定一致）；每条错误信息须包含可识别的问题描述，便于用户与脚本解析；退出码 2 时须输出可用 AI 列表或提示 `run check --list-ai`；退出码 3 时须建议 `--offline` 或检查网络。
- **网络超时可配置**：网络超时由 `networkTimeoutMs`（项目级/全局配置）或环境变量 `SDD_NETWORK_TIMEOUT_MS` 控制，默认 30000ms；配置链优先级与 Story 11.1、ARCH §4.1 一致。本 Story 负责确保 init、TemplateFetcher 及所有涉及网络请求的子命令读取并使用该配置。

## 非本 Story 范围（由其他 Story 负责）

| 功能 | 负责 Story | 说明 |
|------|------------|------|
| 退出码 5（离线 cache 缺失）及 --offline 与 cache 缺失时的报错提示 | Story 11.2 | 由 Story 11.2 约定；本 Story 仅引用 5 的定义归属（ARCH §3.4、PRD §5.2）。 |
| 模板拉取实现、cache 写入、--template | Story 11.1 | 由 Story 11.1 负责；本 Story 仅约定网络超时配置与退出码 3 的语义。 |
| config 子命令 get/set/list networkTimeoutMs | Story 13.4 | 由 Story 13.4 负责；本 Story 确保 TemplateFetcher 与 init 能读取配置链得到的 networkTimeoutMs。 |
| check 结构验证具体逻辑与验证清单 | Story 13.1 | 由 Story 13.1 负责；本 Story 约定结构验证失败时退出码 1 及错误提示格式。 |
| --ai 解析、AIRegistry 实现 | Story 12.1 | 由 Story 12.1 负责；本 Story 约定 --ai 无效时退出码 2 及输出要求。 |

## Acceptance Criteria

### AC-1: 退出码 1（通用/结构验证失败）

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | check 结构验证失败 | 项目内 _bmad 或 _bmad-output 或 AI 目标目录结构不符合验证清单 | check 执行验证 | 退出码 1；stderr 输出明确错误信息，列出缺失项或不符合项 |
| 2 | 未分类异常 | init/check 等子命令发生未预期异常（如配置解析失败） | 异常被捕获 | 退出码 1；stderr 输出可识别的错误描述 |

### AC-2: 退出码 2（--ai 无效）

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | --ai 不在内置或 registry | 用户传 `--ai <name>`，name 不在内置列表或 registry | init 解析 --ai | 退出码 2；stderr 输出包含可用 AI 列表，或明确提示用户运行 `bmad-speckit check --list-ai` |
| 2 | --ai generic 无 aiCommandsDir | 用户传 `--ai generic`，未提供 `--ai-commands-dir` 且 registry 中无 aiCommandsDir | init 解析 | 退出码 2；同上输出要求 |

### AC-3: 退出码 3（网络/模板）

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 网络超时 | 模板拉取 HTTP(S) 请求在 networkTimeoutMs 内未返回 | 拉取请求超时 | 退出码 3；stderr 输出含「网络超时」或等价表述；建议 `--offline` 或检查网络 |
| 2 | 模板拉取失败 | 返回 404、非 2xx 或解压失败 | 拉取完成或解压步骤 | 退出码 3；stderr 输出明确错误信息；建议 `--offline` 或检查网络 |

### AC-4: 退出码 4（路径不可用）

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | --bmad-path 路径不存在 | 用户传 `--bmad-path <path>`，path 不存在 | init 或 check 校验 | 退出码 4；stderr 输出明确说明路径不存在或不可用 |
| 2 | --bmad-path 结构不符合 | path 存在但目录结构不符合 §5.5 验证清单 | init 或 check 校验 | 退出码 4；stderr 输出明确说明结构不符合，列出缺失项 |
| 3 | 目标路径已存在且非空 | 目标路径存在且含文件/子目录，用户未传 `--force` | init 校验 | 退出码 4；stderr 输出提示使用 `--force` 或选择其他路径 |

### AC-5: 通用错误提示格式

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 输出通道 | 任意异常路径 | 子命令退出前 | 错误信息输出至 stderr（与项目现有约定一致） |
| 2 | 内容可识别 | 任意异常路径 | 输出错误信息 | 包含可识别的问题描述（非空、非占位符） |

### AC-6: 网络超时可配置

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 配置链 | 项目级或全局 networkTimeoutMs、或 SDD_NETWORK_TIMEOUT_MS 环境变量已设置 | init 或 TemplateFetcher 发起 HTTP(S) 请求 | 使用配置链得到的超时值；未配置时默认 30000ms |
| 2 | 默认值 | 无 networkTimeoutMs 配置、无 SDD_NETWORK_TIMEOUT_MS | 发起网络请求 | 超时阈值为 30000ms |

## Tasks / Subtasks

- [ ] Task 1：退出码常量与统一映射（AC-1～AC-4）
  - [ ] 1.1 确保 `constants/exit-codes.js` 含 SUCCESS(0)、GENERAL_ERROR(1)、AI_INVALID(2)、NETWORK_TEMPLATE_FAILED(3)、TARGET_PATH_UNAVAILABLE(4)、OFFLINE_CACHE_MISSING(5)，与 ARCH §3.4、PRD §5.2 一致
  - [ ] 1.2 梳理 init、check、upgrade 等子命令中所有 process.exit 调用，确保退出码与本文档约定一致

- [ ] Task 2：退出码 2（--ai 无效）输出要求（AC-2）
  - [ ] 2.1 当 --ai 无效时，输出可用 AI 列表或明确提示 `run bmad-speckit check --list-ai`；实现可通过调用 check --list-ai 逻辑或直接输出内置+registry 列表
  - [ ] 2.2 为 --ai 无效场景补充或调整单元/集成测试，验证退出码 2 及输出内容

- [ ] Task 3：退出码 3（网络/模板）与错误提示（AC-3）
  - [ ] 3.1 确认 TemplateFetcher 与 init 在超时、404、解压失败时统一使用退出码 3，错误信息含「网络超时」或等价表述，并建议 --offline 或检查网络
  - [ ] 3.2 为网络超时、拉取失败场景补充或调整单元/集成测试

- [ ] Task 4：退出码 4（路径不可用）与错误提示（AC-4）
  - [ ] 4.1 确认 init --bmad-path、check bmadPath 验证在路径不存在或结构不符时使用退出码 4，输出明确说明
  - [ ] 4.2 确认目标路径已存在且非空且无 --force 时使用退出码 4

- [ ] Task 5：通用错误提示格式（AC-5）
  - [ ] 5.1 统一异常路径错误输出至 stderr，确保每条错误信息包含可识别的问题描述
  - [ ] 5.2 为各退出码场景补充或调整测试，验证错误信息格式

- [ ] Task 6：网络超时可配置（AC-6）
  - [ ] 6.1 确认 TemplateFetcher 与 init 从配置链（CLI 参数 > SDD_NETWORK_TIMEOUT_MS > 项目级 networkTimeoutMs > 全局 networkTimeoutMs > 默认 30000）读取超时值
  - [ ] 6.2 为超时配置链与默认值补充或调整单元/集成测试

## Dev Notes

- **退出码 5**：退出码 5（离线 cache 缺失）的定义与实现由 Story 11.2 约定；本 Story 仅确保 exit-codes.js 含 OFFLINE_CACHE_MISSING(5)，init/TemplateFetcher 在 Story 11.2 定义的场景下使用该码。
- **配置链**：网络超时配置链与 Story 11.1、ARCH §4.1 一致；ConfigManager 由 Story 10.4 实现，本 Story 通过 ConfigManager 读取 project/global networkTimeoutMs。
- **禁止词**：文档与实现中不得使用「可选」「可考虑」「后续」「先实现」「后续扩展」「待定」「酌情」「视情况」「技术债」等模糊表述；非本 Story 范围已明确归属 Story 11.1、11.2、12.1、13.1、13.4。

### Project Structure Notes

- **exit-codes.js**：`packages/bmad-speckit/src/constants/exit-codes.js` 已存在，含 SUCCESS、GENERAL_ERROR、AI_INVALID、NETWORK_TEMPLATE_FAILED、TARGET_PATH_UNAVAILABLE、OFFLINE_CACHE_MISSING。
- **init.js**：已使用 exitCodes；需校验所有异常路径退出码与本文档一致，尤其 --ai 无效时的输出。
- **check.js**：结构验证失败须退出码 1；bmadPath 验证失败须退出码 4。

### References

- [Source: _bmad-output/planning-artifacts/dev/epics.md Epic 13、Story 13.2]
- [Source: _bmad-output/planning-artifacts/dev/PRD_specify-cn-like-init-multi-ai-assistant.md §5.2 错误码、§5.5 check 退出码]
- [Source: _bmad-output/planning-artifacts/dev/ARCH_specify-cn-like-init-multi-ai-assistant.md §3.4 退出码约定、§3.2 TemplateFetcher]
- [Source: _bmad-output/implementation-artifacts/epic-11-speckit-template-offline/story-11-2-offline-version-lock/11-2-offline-version-lock.md 退出码 5 归属]
- [Source: _bmad-output/implementation-artifacts/epic-11-speckit-template-offline/story-11-1-template-fetch/11-1-template-fetch.md 网络超时、退出码 3]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
