# Feature Specification: 模板拉取（GitHub Release、cache、--template、网络超时）（Story 11.1）

**Epic**: 11 - speckit-template-offline  
**Story**: 11.1 - 模板拉取（template-fetch）  
**Created**: 2026-03-09  
**Status**: Draft  
**Input**: Story 11-1 文档、PRD §5.2/§5.4/§5.8/§5.9、ARCH §3.2/§4.3

---

## 需求映射清单（spec.md ↔ 原始需求文档）

| 原始文档章节 | 原始需求要点 | spec.md 对应位置 | 覆盖状态 |
|-------------|-------------|------------------|----------|
| Story 11-1 本 Story 范围 | TemplateFetcher 扩展、GitHub Release 拉取、cache 写入、--template tag/url、网络超时、配置链 | spec §User Scenarios、§Requirements | ✅ |
| PRD §5.2 | --template \<url\|tag\>、网络超时/模板拉取失败错误码 3 | spec §Requirements FR-001–FR-012 | ✅ |
| PRD §5.4 | 模板来源：GitHub Release、本地 cache、自定义 URL；版本策略 latest/指定 tag | spec §Key Entities、FR-002–FR-004 | ✅ |
| PRD §5.8 | 环境变量 SDD_NETWORK_TIMEOUT_MS（默认 30000） | spec FR-009、§Implementation Constraints | ✅ |
| PRD §5.9 | 全局配置 networkTimeoutMs（默认 30000） | spec FR-009 | ✅ |
| ARCH §3.2 | TemplateFetcher：GitHub Release、本地 cache；网络超时由 networkTimeoutMs 或 SDD_NETWORK_TIMEOUT_MS 控制 | spec §Requirements | ✅ |
| ARCH §4.3 | 模板 cache 结构：~/.bmad-speckit/templates/\<template-id\>/latest/、\<tag\>/ | spec FR-003、§Key Entities | ✅ |

---

## User Scenarios & Testing

### User Story 1 - GitHub Release 拉取与 cache 写入 (Priority: P1)

独立开发者或 CI 工程师执行 init（未传 --template 或传 --template latest / --template v1.2.3），从可配置的 GitHub repo 拉取 release tarball，解压并写入 ~/.bmad-speckit/templates/\<template-id\>/latest/ 或 \<tag\>/；目录不存在时自动创建。

**Acceptance Scenarios**:

1. **Given** 默认或配置的 templateSource 指向有效 GitHub repo，**When** 用户执行 init 且未传 --template 或传 --template latest，**Then** 从该 repo 的 latest release 拉取 tarball，解压并写入 ~/.bmad-speckit/templates/\<template-id\>/latest/
2. **Given** 同上，**When** 用户传 --template v1.2.3，**Then** 拉取该 tag 的 release tarball，解压并写入 ~/.bmad-speckit/templates/\<template-id\>/v1.2.3/
3. **Given** ~/.bmad-speckit/templates/ 或其中 \<template-id\>/\<tag\>/ 不存在，**When** 拉取成功，**Then** 自动创建所需目录后再写入解压内容
4. **Given** 本地已存在 ~/.bmad-speckit/templates/\<template-id\>/v1.2.3/ 且内容完整，**When** 用户再次 init 并指定同一 tag，**Then** 可复用本地 cache（实现可先校验再决定是否跳过拉取）；cache 写入语义一致

### User Story 2 - --template \<url\> (Priority: P1)

用户传 --template https://example.com/template.tar.gz，init 使用该 URL 发起 HTTP(S) 请求（受 networkTimeoutMs/SDD_NETWORK_TIMEOUT_MS 约束），拉取成功后解压到 cache 下可识别目录（如按 URL 指纹或固定子目录名），供 init 后续步骤使用；版本与内容由用户负责。

**Acceptance Scenarios**:

1. **Given** 用户传 --template https://example.com/template.tar.gz，**When** init 执行拉取，**Then** 使用该 URL 发起 HTTP(S) 请求，受 networkTimeoutMs/SDD_NETWORK_TIMEOUT_MS 约束
2. **Given** 拉取成功且为 tarball，**When** 解压，**Then** 解压到 cache 下可识别目录，供 init 后续步骤使用；不要求写入 latest/ 或 tag 子目录
3. **Given** 用户使用自定义 URL，**Then** 文档或注释明确：版本与内容由用户负责，CLI 不保证 templateVersion 可读性（templateVersion 持久化由 Story 11.2 负责）

### User Story 3 - 网络超时 (Priority: P1)

所有模板拉取 HTTP(S) 请求的超时由配置链决定：CLI 参数 > SDD_NETWORK_TIMEOUT_MS > 项目级 networkTimeoutMs > 全局 networkTimeoutMs > 默认 30000ms。超时发生时输出明确错误信息（含「网络超时」或等价表述），退出码 3。

**Acceptance Scenarios**:

1. **Given** 未设置环境变量与配置文件，**When** 发起模板拉取请求，**Then** 使用 30000ms 超时
2. **Given** 设置 SDD_NETWORK_TIMEOUT_MS=60000，**When** 发起模板拉取请求，**Then** 使用 60000ms 超时
3. **Given** ~/.bmad-speckit/config.json 含 networkTimeoutMs: 15000 且无环境变量覆盖，**When** 发起模板拉取请求，**Then** 使用 15000ms 超时
4. **Given** 网络在限定时间内未返回，**When** 拉取请求超时，**Then** 输出明确错误信息，包含「网络超时」或等价表述，退出码 3

### User Story 4 - 错误码与提示 (Priority: P1)

拉取返回 404 或非 2xx、或解压失败时，统一退出码 3，输出明确错误信息。

**Acceptance Scenarios**:

1. **Given** 拉取返回 404 或非 2xx，**When** 拉取请求完成，**Then** 输出明确错误信息，退出码 3
2. **Given** 下载内容非有效 tarball，**When** 解压步骤，**Then** 输出明确错误信息，退出码 3

---

## Requirements

### Functional Requirements

- **FR-001**: 系统必须扩展 TemplateFetcher，在 Story 10.1 最小实现基础上实现完整「拉取 → 解压 → 写入 cache」流程
- **FR-002**: 系统必须从可配置的 owner/repo（默认或 templateSource）拉取 release tarball；支持 latest 与指定 tag
- **FR-003**: 系统必须将拉取结果写入 ~/.bmad-speckit/templates/\<template-id\>/\<tag\>/（如 latest/、v1.2.3/）；目录不存在时创建
- **FR-004**: 系统必须支持 --template \<tag\>（含 latest）与 --template \<url\>；init 与 TemplateFetcher 接收该参数
- **FR-005**: 系统必须对 --template \<url\> 使用相同超时与错误码 3 语义；解压到 cache 下可识别目录（如 url-\<hash\>/）
- **FR-006**: 系统必须实现超时配置读取顺序：CLI 参数 > 环境变量 SDD_NETWORK_TIMEOUT_MS > 项目级 _bmad-output/config/bmad-speckit.json 的 networkTimeoutMs > 全局 ~/.bmad-speckit/config.json 的 networkTimeoutMs > 默认 30000
- **FR-007**: 系统必须对所有模板拉取 HTTP(S) 请求应用上述超时；超时后输出含「网络超时」或等价表述的错误信息，退出码 3
- **FR-008**: 系统必须在拉取 404/非 2xx 或解压失败时输出明确错误信息，退出码 3
- **FR-009**: 系统必须使用 exit code 3 表示网络/模板失败（与 PRD §5.2、现有 exit-codes 一致）
- **FR-010**: 系统必须保证 init 流程调用 TemplateFetcher 时传入 tag 或 latest 或 url，并复用已写入的 cache 路径
- **FR-011**: 系统必须使用 Node.js path 与 fs，cache 根目录使用 os.homedir() 解析，禁止硬编码路径分隔符
- **FR-012**: 系统必须为 TemplateFetcher 与 init 中拉取路径补充或调整单元/集成测试，覆盖 latest、tag、url、超时、失败场景

### Key Entities

- **TemplateFetcher**：位于 src/services/template-fetcher.js；扩展「拉取 → 解压 → cache 写入」及 --template、超时配置链
- **templateSource**：owner/repo，从 ~/.bmad-speckit/config.json 或项目级配置读取；默认见 PRD/ARCH（如 bmad-method/bmad-method 或可配置）
- **Cache 结构**：~/.bmad-speckit/templates/\<template-id\>/latest/、\<template-id\>/\<tag\>/；自定义 URL 时 \<template-id\>/url-\<hash\>/ 或等价
- **退出码**：3 表示网络/模板失败（与现有 exit-codes.js 一致）

---

## Success Criteria

- **SC-001**: init 未传 --template 或传 --template latest 时，拉取 latest release 并写入 cache 对应目录
- **SC-002**: init 传 --template v1.2.3 时，拉取该 tag 并写入 cache 对应子目录
- **SC-003**: init 传 --template \<url\> 时，使用该 URL 拉取并解压到 cache 下可识别目录
- **SC-004**: 超时配置链五级优先级正确；超时发生时退出码 3 且错误信息含「网络超时」或等价表述
- **SC-005**: 404/非 2xx/解压失败时退出码 3，明确错误信息

---

## Implementation Constraints

- **路径**：Node.js path、os.homedir()，禁止硬编码 `/` 或 `\`
- **包结构**：与 Story 10.1 一致，template-fetcher.js 在 packages/bmad-speckit/src/services/
- **配置读取**：超时由 ConfigManager.get('networkTimeoutMs', { cwd }) 及环境变量、CLI 参数参与优先级链（CLI 需新增 --network-timeout 或由 init 从 ConfigManager 读入后传入 TemplateFetcher）
- **禁止词**：不得使用「可选」「可考虑」「后续」「先实现」「待定」「酌情」「技术债」等模糊表述

---

## Reference Documents

- Story 11-1: _bmad-output/implementation-artifacts/epic-11-speckit-template-offline/story-11-1-template-fetch/11-1-template-fetch.md
- PRD §5.2, §5.4, §5.8, §5.9
- ARCH §3.2, §4.3
- Story 10.1 TemplateFetcher 最小实现：packages/bmad-speckit/src/services/template-fetcher.js

<!-- AUDIT: PASSED by code-reviewer -->
