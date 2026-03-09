# Story 11.1: 模板拉取（GitHub Release、cache、--template、网络超时）

Status: ready-for-dev

<!-- Note: Run validate-create-story for quality check before dev-story. -->

## Story

**As a** 独立开发者或 CI 工程师，  
**I want to** 在 init 时从 GitHub Release 拉取模板并缓存到 `~/.bmad-speckit/templates/`，支持通过 `--template <tag|url>` 指定版本或自定义 URL，且网络超时由 `networkTimeoutMs` 或环境变量 `SDD_NETWORK_TIMEOUT_MS` 控制（默认 30000ms），  
**so that** 我能可靠地获取项目模板并在慢速或受限网络下通过超时与缓存策略完成初始化。

## 需求追溯

| 来源 | 章节/ID | 映射内容 |
|------|---------|----------|
| PRD | §5.2 | `--template <url\|tag>`、网络超时/模板拉取失败错误码 3 |
| PRD | §5.4 | 模板来源：GitHub Release、本地 cache、自定义 URL；版本策略 latest/指定 tag |
| PRD | §5.8 | 环境变量 `SDD_NETWORK_TIMEOUT_MS`（网络超时毫秒，默认 30000） |
| PRD | §5.9 | 全局配置 `networkTimeoutMs`（默认 30000） |
| ARCH | §3.2 | TemplateFetcher：GitHub Release 拉取、本地 cache 读写；网络超时由 networkTimeoutMs 或 SDD_NETWORK_TIMEOUT_MS 控制（默认 30000ms） |
| ARCH | §4.3 | 模板 cache 结构：`~/.bmad-speckit/templates/<template-id>/latest/`、`<tag>/` |
| Epics | 11.1 | 模板拉取：GitHub Release、cache 至 ~/.bmad-speckit/templates/、--template tag/url；网络超时控制 |

## 本 Story 范围

- **TemplateFetcher 扩展**：在 Story 10.1 已有最小实现基础上，实现完整「拉取 → 解压 → 写入 cache」流程。
- **GitHub Release 拉取**：从可配置的 `owner/repo`（默认或 `templateSource`）拉取 release tarball；支持 `latest` 与指定 tag。
- **本地 cache**：拉取成功后写入 `~/.bmad-speckit/templates/<template-id>/<tag>/`（如 `latest/`、`v1.2.3/`）；目录不存在时创建。
- **`--template <tag|url>`**：  
  - `--template <tag>`：指定 GitHub Release tag（如 `v1.0.0`），拉取该 tag 的 tarball 并缓存到 `~/.bmad-speckit/templates/<template-id>/<tag>/`。  
  - `--template <url>`：直接使用该 URL 拉取（如 `https://.../archive/refs/tags/v1.0.0.tar.gz`），解压到 cache 的临时或按 URL 指纹命名的子目录，供 init 使用；版本由用户负责。
- **网络超时**：所有 HTTP/HTTPS 请求的超时由 `networkTimeoutMs` 或 `SDD_NETWORK_TIMEOUT_MS` 控制，默认 30000ms；超时发生时输出明确错误信息（含「网络超时」或等价表述），退出码 3（网络/模板失败）。
- **配置读取顺序**：CLI 参数 > 环境变量 `SDD_NETWORK_TIMEOUT_MS` > 项目级 `_bmad-output/config/bmad-speckit.json` 的 `networkTimeoutMs` > 全局 `~/.bmad-speckit/config.json` 的 `networkTimeoutMs` > 默认 30000。

## 非本 Story 范围（由其他 Story 负责）

| 功能 | 负责 Story | 说明 |
|------|------------|------|
| `--offline` 仅使用本地 cache、不发起网络请求 | Story 11.2 | 由 Story 11.2 负责实现；本 Story 仅实现「拉取并写入 cache」与 `--template` 语义。 |
| `templateVersion` 写入 `_bmad-output/config/bmad-speckit.json` | Story 11.2 | 由 Story 11.2 负责在 init 完成后写入所用模板版本，便于复现与审计。 |
| 异常路径退出码 5（离线 cache 缺失）及 `--offline` 与 cache 缺失时的报错提示 | Story 11.2 | 由 Story 11.2 负责。 |
| ConfigCommand 对 `networkTimeoutMs` 的 get/set/list | Epic 13（Story 13.4） | 由 Story 13.4 负责 config 子命令；本 Story 仅保证 TemplateFetcher 与 init 能读取该配置。 |

## Acceptance Criteria

### AC-1: GitHub Release 拉取与 cache 写入

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | latest 拉取 | 默认或配置的 templateSource 指向有效 GitHub repo | 用户执行 init 且未传 `--template` 或传 `--template latest` | 从该 repo 的 latest release 拉取 tarball，解压并写入 `~/.bmad-speckit/templates/<template-id>/latest/` |
| 2 | 指定 tag 拉取 | 同上 | 用户传 `--template v1.2.3` | 拉取该 tag 的 release tarball，解压并写入 `~/.bmad-speckit/templates/<template-id>/v1.2.3/` |
| 3 | cache 目录创建 | `~/.bmad-speckit/templates/` 或其中 `<template-id>/<tag>/` 不存在 | 拉取成功 | 自动创建所需目录后再写入解压内容 |
| 4 | 已存在 cache | 本地已存在 `~/.bmad-speckit/templates/<template-id>/v1.2.3/` 且内容完整 | 用户再次 init 并指定同一 tag | 可复用本地 cache（实现可先校验再决定是否跳过拉取）；不要求本 Story 强制跳过拉取，但须保证 cache 写入语义一致 |

### AC-2: --template &lt;url&gt;

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 自定义 URL | 用户传 `--template https://example.com/template.tar.gz` | init 执行拉取 | 使用该 URL 发起 HTTP(S) 请求，受 networkTimeoutMs/SDD_NETWORK_TIMEOUT_MS 约束 |
| 2 | URL 拉取结果落地 | 拉取成功且为 tarball | 解压 | 解压到 cache 下可识别的目录（如按 URL 指纹或固定子目录名），供 init 后续步骤使用；不要求写入 `latest/` 或 tag 子目录 |
| 3 | 版本责任 | 用户使用自定义 URL | — | 文档或注释明确：版本与内容由用户负责，CLI 不保证 templateVersion 可读性（templateVersion 持久化由 Story 11.2 负责） |

### AC-3: 网络超时

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 超时配置默认 | 未设置环境变量与配置文件 | 发起模板拉取请求 | 使用 30000ms 超时 |
| 2 | 环境变量 | 设置 `SDD_NETWORK_TIMEOUT_MS=60000` | 发起模板拉取请求 | 使用 60000ms 超时 |
| 3 | 全局配置 | `~/.bmad-speckit/config.json` 含 `networkTimeoutMs: 15000` 且无环境变量覆盖 | 发起模板拉取请求 | 使用 15000ms 超时 |
| 4 | 超时发生 | 网络在限定时间内未返回 | 拉取请求超时 | 输出明确错误信息，包含「网络超时」或等价表述，退出码 3 |

### AC-4: 错误码与提示

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 拉取失败（非超时） | 返回 404 或非 2xx | 拉取请求完成 | 输出明确错误信息，退出码 3 |
| 2 | 解压失败 | 下载内容非有效 tarball | 解压步骤 | 输出明确错误信息，退出码 3 |

## Tasks / Subtasks

- [ ] Task 1：扩展 TemplateFetcher 支持 GitHub Release 拉取与 cache 写入（AC-1）
  - [ ] 1.1 实现从可配置 owner/repo 拉取 release tarball（latest 与指定 tag）
  - [ ] 1.2 实现解压到 `~/.bmad-speckit/templates/<template-id>/<tag>/`，缺失目录时创建
  - [ ] 1.3 确保 init 流程调用 TemplateFetcher 时传入 tag 或 latest，并复用已写入的 cache 路径
- [ ] Task 2：实现 --template &lt;tag|url&gt; 解析与行为（AC-1、AC-2）
  - [ ] 2.1 init 与 TemplateFetcher 支持 `--template <tag>`（含 `latest`）与 `--template <url>`
  - [ ] 2.2 URL 拉取时使用相同超时与错误码 3 语义；解压到 cache 下可识别目录
- [ ] Task 3：网络超时与配置链（AC-3）
  - [ ] 3.1 实现超时配置读取：CLI > SDD_NETWORK_TIMEOUT_MS > 项目级 networkTimeoutMs > 全局 networkTimeoutMs > 默认 30000
  - [ ] 3.2 所有模板拉取 HTTP(S) 请求应用该超时；超时后输出含「网络超时」的错误信息，退出码 3
- [ ] Task 4：错误处理与验收（AC-4）
  - [ ] 4.1 拉取 404/非 2xx 或解压失败时统一退出码 3 与明确提示
  - [ ] 4.2 为 TemplateFetcher 与 init 中拉取路径补充或调整单元/集成测试，覆盖 latest、tag、url、超时、失败场景

## Dev Notes

- **架构**：TemplateFetcher 位于 `src/services/template-fetcher.js`（或项目现有等价路径）；Story 10.1 中已有最小实现，本 Story 在其上扩展「拉取 → 解压 → cache 写入」及 `--template`、超时，不替换 init 流程中已有调用点，仅增强参数与行为。
- **配置**：`templateSource`（owner/repo）可从 `~/.bmad-speckit/config.json` 或项目级配置读取；默认 repo 见 PRD/ARCH（如 BMAD-Speckit-SDD-Flow 或可配置）。`networkTimeoutMs` 与 `SDD_NETWORK_TIMEOUT_MS` 已在 PRD §5.8、§5.9 与 ARCH §4.1 约定。
- **Cache 结构**：与 ARCH §4.3 一致，`~/.bmad-speckit/templates/<template-id>/latest/` 与 `~/.bmad-speckit/templates/<template-id>/<tag>/`；自定义 URL 时可采用 `<template-id>/url-<hash>/` 或等价方式，保证 init 能解析到解压根目录。
- **测试**：覆盖 (1) latest 拉取并写入 cache；(2) 指定 tag 拉取并写入对应子目录；(3) `--template <url>` 拉取与解压；(4) 超时配置链与超时触发时退出码 3；(5) 404/解压失败时退出码 3。可 mock 网络请求以稳定测试。
- **禁止词**：文档与实现中不得使用「可选」「可考虑」「后续」「先实现」「后续扩展」「待定」「酌情」「视情况」「技术债」等模糊表述；本 Story 不实现的功能已明确归属 Story 11.2 或 13.4。

### Project Structure Notes

- 若 bmad-speckit 以子包或 monorepo 形式存在，TemplateFetcher 与 init 的路径以该包内结构为准；与 Story 10.1、10.2 的 init 实现保持一致。
- 跨平台：使用 Node.js `path` 与 `fs`，避免硬编码路径分隔符；cache 根目录使用 OS 用户主目录解析（`os.homedir()` 或等价）。

### References

- [Source: _bmad-output/planning-artifacts/dev/PRD_specify-cn-like-init-multi-ai-assistant.md §5.2, §5.4, §5.8, §5.9]
- [Source: _bmad-output/planning-artifacts/dev/ARCH_specify-cn-like-init-multi-ai-assistant.md §3.2, §4.1, §4.3]
- [Source: _bmad-output/planning-artifacts/dev/epics.md Epic 11、Story 11.1]
- [Source: _bmad-output/implementation-artifacts/epic-10-speckit-init-core/story-10-1-interactive-init/10-1-interactive-init.md 模板版本选择、非本 Story 范围表]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
