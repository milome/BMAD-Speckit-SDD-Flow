# Feature Specification: 离线与版本锁定（--offline、templateVersion 写入、退出码 5）（Story 11.2）

**Epic**: 11 - speckit-template-offline  
**Story**: 11.2 - 离线与版本锁定（offline-version-lock）  
**Created**: 2026-03-09  
**Status**: Draft  
**Input**: Story 11-2 文档、PRD §5.4、ARCH §3.2/§4.3、Epics 11.2/13.2

---

## 需求映射清单（spec.md ↔ 原始需求文档）

| 原始文档章节 | 原始需求要点 | spec.md 对应位置 | 覆盖状态 |
|-------------|-------------|------------------|----------|
| Story 11-2 本 Story 范围 | --offline 仅用本地 cache、不发起网络；templateVersion 写入 bmad-speckit.json；退出码 5 离线 cache 缺失 | spec §User Scenarios、§Requirements | ✅ |
| Story 11-2 AC-1 | --offline 仅使用本地 cache、不发起网络；离线且 cache 缺失时退出码 5 与报错提示 | spec §User Scenarios 1–3、FR-001–FR-004 | ✅ |
| Story 11-2 AC-2 | templateVersion 写入 _bmad-output/config/bmad-speckit.json；首次创建/已有合并；版本可识别 | spec §User Scenarios 4–6、FR-005–FR-007 | ✅ |
| Story 11-2 AC-3 | 退出码 5 仅用于 --offline 且 cache 缺失；报错含「离线」与「cache 缺失」 | spec FR-003、FR-004、§Key Entities | ✅ |
| PRD §5.4 | 模板来源：本地 cache；版本策略、版本持久化 | spec FR-005–FR-007 | ✅ |
| ARCH §3.2 | TemplateFetcher：本地 cache 读写；离线模式不发起网络 | spec FR-001、§Key Entities | ✅ |
| ARCH §4.3 | 模板 cache 结构；项目级配置 _bmad-output/config/bmad-speckit.json | spec FR-006、§Key Entities | ✅ |
| Epics 11.2 | 离线与版本锁定：--offline、templateVersion 写入 bmad-speckit.json | spec §Requirements | ✅ |
| Epics 13.2 | 退出码 5 离线 cache 缺失；--offline 与 cache 缺失报错提示 | spec FR-003、FR-004 | ✅ |

### 非本 Story 范围

| 功能 | 负责 Story | 说明 |
|------|------------|------|
| 模板拉取、GitHub Release、cache 写入、--template tag/url、网络超时 | Story 11.1 | 由 Story 11.1 负责；本 Story 依赖其提供的 cache 结构与拉取语义。 |
| 异常路径退出码 1/2/3/4 及通用错误提示 | Story 13.2 | 由 Story 13.2 统一约定；本 Story 仅约定退出码 5 及 --offline + cache 缺失场景。 |
| ConfigCommand 对 templateVersion/templateSource 的 get/set/list | Story 13.4 | 由 Story 13.4 负责 config 子命令；本 Story 仅负责 init 完成后写入该文件。 |

---

## User Scenarios & Testing

### User Story 1 - --offline 仅使用本地 cache、不发起网络 (Priority: P1)

独立开发者或 CI 工程师传 `--offline` 执行 init，系统仅从 `~/.bmad-speckit/templates/` 读取模板，不发起任何 HTTP/HTTPS 或网络请求。

**Acceptance Scenarios**:

1. **Given** 用户已通过 Story 11.1 将某 tag 拉取至 `~/.bmad-speckit/templates/<template-id>/<tag>/`，**When** 用户执行 init 并传 `--offline` 且所需 tag 与 cache 一致，**Then** 不发起任何网络请求，从 cache 读取模板并完成 init。
2. **Given** 用户传 `--offline`，所需模板（默认或 --template 指定）在 cache 中不存在，**When** init 执行模板解析，**Then** 输出明确报错提示（含「离线」与「cache 缺失」或等价表述），退出码 5。
3. **Given** 用户不传 `--offline`，**When** init 执行，**Then** 行为与 Story 11.1 一致，可发起网络拉取；本 Story 不改变该路径。

### User Story 2 - templateVersion 写入 _bmad-output/config/bmad-speckit.json (Priority: P1)

init 成功完成后（无论是否使用 `--offline`），将本次实际使用的模板版本（tag 或可识别标识）写入项目级配置文件 `_bmad-output/config/bmad-speckit.json` 的 `templateVersion` 字段。

**Acceptance Scenarios**:

1. **Given** 项目目录无 `_bmad-output/config/` 或该目录存在但无 bmad-speckit.json，**When** init 成功完成，**Then** 创建 `_bmad-output/config/`（若不存在），创建或更新 `bmad-speckit.json`，写入本次使用的 `templateVersion`（如 tag 或 latest）。
2. **Given** `_bmad-output/config/bmad-speckit.json` 已存在且含其他字段（如 defaultAI、networkTimeoutMs），**When** init 成功完成，**Then** 仅更新或新增 `templateVersion` 字段，不删除、不覆盖其他已有字段。
3. **Given** init 使用 GitHub Release tag（如 v1.0.0）或 latest，**When** 写入 templateVersion，**Then** 写入值为该 tag 或 "latest" 等可识别标识；自定义 URL 拉取时由实现约定可写标识或占位。

### User Story 3 - 退出码 5 与报错提示 (Priority: P1)

仅在「用户指定 `--offline` 且所需模板在本地 cache 中缺失」时使用退出码 5；报错信息须明确包含「离线」与「cache 缺失」（或等价表述）。

**Acceptance Scenarios**:

1. **Given** 用户传 `--offline`，所需模板在 cache 中不存在，**When** init 检测到需用模板且 cache 无该版本，**Then** 退出码 5；stderr 或 stdout 输出包含「离线」与「cache 缺失」（或等价表述）的报错信息。
2. **Given** 未传 `--offline`，网络拉取失败或超时，**When** 按 Story 11.1 处理，**Then** 使用退出码 3 等，不使用退出码 5。

---

## Requirements

### Functional Requirements

- **FR-001**: 系统必须在 init 与 TemplateFetcher 解析 `--offline` 参数；当 `--offline` 为真时，仅从 `~/.bmad-speckit/templates/` 解析模板路径，不发起任何 HTTP(S) 请求。
- **FR-002**: 系统必须在 `--offline` 为真时，先检查所需模板在 cache 中是否存在（`~/.bmad-speckit/templates/<template-id>/<tag>/` 或 `latest/`、url-<hash>/）；若存在则直接返回 cache 路径；若不存在则输出报错并退出码 5。
- **FR-003**: 系统必须在「--offline 且 cache 缺失」场景使用退出码 5（exitCodes.OFFLINE_CACHE_MISSING）；报错信息须含「离线」与「cache 缺失」（或等价表述，如 "offline"、"cache 缺失"/"cache missing"）。
- **FR-004**: 系统必须在未传 `--offline` 时保持 Story 11.1 行为；网络失败、超时等使用退出码 3，不使用退出码 5。
- **FR-005**: 系统必须在 init 成功完成后（含 offline 路径），将本次使用的 templateVersion（tag 或 latest 或可识别标识）写入 `_bmad-output/config/bmad-speckit.json` 的 `templateVersion` 字段。
- **FR-006**: 系统必须在该文件或父目录不存在时创建；若文件已存在则合并更新，仅更新 `templateVersion` 字段，不覆盖其他已有字段。
- **FR-007**: 系统必须使用 Node.js path、fs、os.homedir()，禁止硬编码路径分隔符；配置路径为 `<cwd>/_bmad-output/config/bmad-speckit.json`。
- **FR-008**: 系统必须为 --offline、cache 存在/缺失、templateVersion 写入及退出码 5 补充或调整单元/集成测试。

### Key Entities

- **TemplateFetcher**：位于 src/services/template-fetcher.js；新增 `opts.offline` 分支：当 offline 为真时仅检查 cache 存在性并返回路径，不发起网络请求；cache 缺失时 throw 含「离线」「cache 缺失」的 Error，调用方 process.exit(5)。
- **init.js**：解析 `--offline`，传入 TemplateFetcher；catch 含 OFFLINE_CACHE_MISSING 或等价错误码时 process.exit(5)；init 成功后通过 writeSelectedAI 或等价逻辑写入 templateVersion（已由 init-skeleton 的 writeSelectedAI 实现，需确认传入实际使用的 tag）。
- **Cache 结构**：复用 Story 11.1 的 `~/.bmad-speckit/templates/<template-id>/<tag>/`、`latest/`、`url-<hash>/`。
- **退出码**：5 表示离线 cache 缺失（exit-codes.OFFLINE_CACHE_MISSING）；3 表示网络/模板失败（Story 11.1）。

---

## Success Criteria

- **SC-001**: init --offline 且 cache 存在时，不发起网络，从 cache 完成 init。
- **SC-002**: init --offline 且 cache 缺失时，退出码 5，报错含「离线」与「cache 缺失」。
- **SC-003**: init 成功完成后，_bmad-output/config/bmad-speckit.json 含 templateVersion；已有配置时仅合并该字段。
- **SC-004**: 未传 --offline 时行为与 Story 11.1 一致，不使用退出码 5。

---

## Implementation Constraints

- **依赖**：本 Story 依赖 Story 11.1 的 TemplateFetcher 与 cache 结构；实现时复用 11.1 的 cache 解析逻辑，仅增加 --offline 分支与 templateVersion 写入确认。
- **路径**：Node.js path、os.homedir()，禁止硬编码 `/` 或 `\`。
- **禁止词**：不得使用「可选」「可考虑」「后续」「先实现」「后续扩展」「待定」「酌情」「视情况」「技术债」等模糊表述。

---

## Reference Documents

- Story 11-2: _bmad-output/implementation-artifacts/epic-11-speckit-template-offline/story-11-2-offline-version-lock/11-2-offline-version-lock.md
- Story 11-1: _bmad-output/implementation-artifacts/epic-11-speckit-template-offline/story-11-1-template-fetch/11-1-template-fetch.md
- PRD §5.4, ARCH §3.2, §4.3
- exit-codes.js: packages/bmad-speckit/src/constants/exit-codes.js（已有 OFFLINE_CACHE_MISSING: 5）

<!-- AUDIT: PASSED by code-reviewer -->
