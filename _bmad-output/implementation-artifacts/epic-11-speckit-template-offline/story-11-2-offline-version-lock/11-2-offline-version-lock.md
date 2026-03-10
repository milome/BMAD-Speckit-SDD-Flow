# Story 11.2: 离线与版本锁定（--offline、templateVersion 写入、退出码 5）

Status: ready-for-dev

<!-- Note: Run validate-create-story for quality check before dev-story. -->

## Story

**As a** 独立开发者或 CI 工程师，  
**I want to** 在 init 时通过 `--offline` 仅使用本地 cache 且不发起任何网络请求，并在 init 完成后将所用 `templateVersion` 写入 `_bmad-output/config/bmad-speckit.json`；当使用 `--offline` 且所需模板在 cache 中缺失时，以退出码 5 并输出明确报错提示，  
**so that** 我能在无网或受限环境下复现初始化结果，并可通过配置审计所用模板版本；离线场景下 cache 缺失时能获得可区分的错误码与提示。

## 需求追溯

| 来源 | 章节/ID | 映射内容 |
|------|---------|----------|
| PRD | §5.4 | 模板来源：本地 cache；版本策略、版本持久化 |
| ARCH | §3.2 | TemplateFetcher：本地 cache 读写；离线模式不发起网络 |
| ARCH | §4.3 | 模板 cache 结构；项目级配置 _bmad-output/config/bmad-speckit.json |
| Epics | 11.2 | 离线与版本锁定：--offline、templateVersion 写入 bmad-speckit.json |
| Epics | 13.2 | 异常路径：退出码 5 离线 cache 缺失、--offline 与 cache 缺失时的报错提示 |

## 本 Story 范围

- **`--offline` 行为**：当用户传入 `--offline` 时，init 与模板解析仅使用 `~/.bmad-speckit/templates/` 下已有 cache，不发起任何 HTTP/HTTPS 或网络请求。若所需模板（由 `--template` 或默认 tag/latest 决定）在 cache 中不存在，则输出明确报错提示（含「离线」「cache 缺失」或等价表述），并以退出码 5 退出。
- **templateVersion 写入**：init 成功完成后（无论是否使用 `--offline`），将本次实际使用的模板版本（tag 或可识别的版本标识）写入项目级配置文件 `_bmad-output/config/bmad-speckit.json` 的 `templateVersion` 字段；若该文件或父目录不存在则创建；若已存在则合并更新该字段，不覆盖其他已有配置项。
- **退出码 5 与报错提示**：仅在「用户指定 `--offline` 且所需模板在本地 cache 中缺失」时使用退出码 5；报错信息须明确包含「离线」与「cache 缺失」（或等价表述），便于脚本与用户区分。

## 非本 Story 范围（由其他 Story 负责）

| 功能 | 负责 Story | 说明 |
|------|------------|------|
| 模板拉取、GitHub Release、cache 写入、--template tag/url、网络超时 | Story 11.1 | 由 Story 11.1 负责；本 Story 依赖其提供的 cache 结构与拉取语义。 |
| 异常路径退出码 1/2/3/4 及通用错误提示 | Story 13.2 | 由 Story 13.2 统一约定；本 Story 仅约定退出码 5 及 --offline + cache 缺失场景。 |
| ConfigCommand 对 templateVersion/templateSource 的 get/set/list | Story 13.4 | 由 Story 13.4 负责 config 子命令；本 Story 仅负责 init 完成后写入该文件。 |

## Acceptance Criteria

### AC-1: --offline 仅使用本地 cache、不发起网络

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 离线且 cache 存在 | 用户已通过 Story 11.1 将某 tag 拉取至 `~/.bmad-speckit/templates/<template-id>/<tag>/` | 用户执行 init 并传 `--offline` 且所需 tag 与 cache 一致 | 不发起任何网络请求，从 cache 读取模板并完成 init |
| 2 | 离线且 cache 缺失 | 用户传 `--offline`，所需模板（默认或 --template 指定）在 cache 中不存在 | init 执行模板解析 | 输出明确报错提示（含「离线」与「cache 缺失」或等价表述），退出码 5 |
| 3 | 未传 --offline | 与 Story 11.1 一致，允许拉取 | 用户不传 `--offline` | 行为与 Story 11.1 一致，可发起网络拉取；本 Story 不改变该路径 |

### AC-2: templateVersion 写入 _bmad-output/config/bmad-speckit.json

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 首次 init 成功 | 项目目录无 `_bmad-output/config/` 或该目录存在但无 bmad-speckit.json | init 成功完成（含模板解析与写入） | 创建 `_bmad-output/config/`（若不存在），创建或更新 `bmad-speckit.json`，写入本次使用的 `templateVersion`（如 tag 或 latest） |
| 2 | 已有配置合并 | `_bmad-output/config/bmad-speckit.json` 已存在且含其他字段（如 defaultAI、networkTimeoutMs） | init 成功完成 | 仅更新或新增 `templateVersion` 字段，不删除、不覆盖其他已有字段 |
| 3 | 版本可识别 | init 使用 GitHub Release tag（如 v1.0.0）或 latest | 写入 templateVersion | 写入值为该 tag 或 "latest" 等可识别标识；自定义 URL 拉取时由实现约定可写标识或占位 |

### AC-3: 退出码 5 与 --offline 及 cache 缺失时的报错提示

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 退出码 5 仅用于离线 cache 缺失 | 用户传 `--offline`，所需模板在 cache 中不存在 | init 检测到需用模板且 cache 无该版本 | 退出码 5；stderr 或 stdout 输出包含「离线」与「cache 缺失」（或等价表述）的报错信息 |
| 2 | 非离线不用 5 | 未传 `--offline`，网络拉取失败或超时 | 按 Story 11.1 处理 | 使用退出码 3 等，不使用退出码 5 |

## Tasks / Subtasks

- [ ] Task 1：实现 --offline 语义与 cache 校验（AC-1）
  - [ ] 1.1 init 与 TemplateFetcher 解析 `--offline`；当 `--offline` 为真时，仅从 `~/.bmad-speckit/templates/` 解析模板路径，不发起任何 HTTP(S) 请求
  - [ ] 1.2 当 `--offline` 为真且所需模板在 cache 中不存在时，输出含「离线」「cache 缺失」的报错并退出码 5
- [ ] Task 2：templateVersion 写入项目级配置（AC-2）
  - [ ] 2.1 init 成功完成后，将本次使用的 templateVersion（tag 或可识别标识）写入 `_bmad-output/config/bmad-speckit.json` 的 `templateVersion` 字段
  - [ ] 2.2 若文件或父目录不存在则创建；若文件已存在则合并更新，仅更新 templateVersion，不覆盖其他键
- [ ] Task 3：退出码 5 与报错提示验收（AC-3）
  - [ ] 3.1 确保仅「--offline 且 cache 缺失」场景使用退出码 5；其他错误路径使用 Story 11.1/13.2 约定码
  - [ ] 3.2 为 --offline、cache 存在/缺失、templateVersion 写入及退出码 5 补充或调整单元/集成测试

## Dev Notes

- **依赖**：本 Story 依赖 Story 11.1 的 TemplateFetcher 与 cache 结构（`~/.bmad-speckit/templates/<template-id>/<tag>/`）；实现时复用 11.1 的 cache 解析逻辑，仅增加 --offline 分支与 templateVersion 写入。
- **配置路径**：项目级配置为 `_bmad-output/config/bmad-speckit.json`，与 Story 10.4、13.4 约定一致；写入时使用 Node.js `fs`/`path`，跨平台兼容。
- **禁止词**：文档与实现中不得使用「可选」「可考虑」「后续」「先实现」「后续扩展」「待定」「酌情」「视情况」「技术债」等模糊表述；本 Story 不实现的功能已明确归属 Story 11.1 或 13.2、13.4。

### Project Structure Notes

- TemplateFetcher 与 init 入口与 Story 11.1 一致；新增逻辑限于 --offline 分支、cache 存在性校验、退出码 5、以及 init 成功后的 templateVersion 写盘。
- 与 epics.md 13.2 一致：退出码 5 专用于「离线 cache 缺失」；其他异常路径（网络超时、模板失败、路径不可用等）由 13.2 统一约定。

### Previous Story Intelligence（Story 11.1）

- **TemplateFetcher 位置**：`src/services/template-fetcher.js`（或项目现有等价路径）；init 与 TemplateFetcher 已有调用点，本 Story 在其上扩展 `--offline` 分支，不替换调用点。
- **Cache 结构**：`~/.bmad-speckit/templates/<template-id>/<tag>/`（含 `latest/`、`v1.2.3/` 等）；自定义 URL 时可采用 `url-<hash>/` 子目录；本 Story 复用该结构解析，仅增加 cache 存在性校验。
- **跨平台**：使用 Node.js `path`、`fs`、`os.homedir()`，禁止硬编码路径分隔符。
- **测试模式**：Story 11.1 采用 mock 网络请求以稳定测试；本 Story 测试可 mock `fs.existsSync` 等以模拟 cache 存在/缺失。

### References

- [Source: _bmad-output/planning-artifacts/dev/epics.md Epic 11、Story 11.2、Story 13.2]
- [Source: _bmad-output/implementation-artifacts/epic-11-speckit-template-offline/story-11-1-template-fetch/11-1-template-fetch.md 模板拉取、cache 结构、非本 Story 范围]
- [Source: _bmad-output/planning-artifacts/dev/ARCH_specify-cn-like-init-multi-ai-assistant.md §3.2 TemplateFetcher、§3.4 退出码约定、§4.3 cache 与配置]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
