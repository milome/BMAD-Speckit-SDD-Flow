# Implementation Plan: 模板拉取（Story 11.1）

**Epic**: 11 - speckit-template-offline  
**Story**: 11.1 - 模板拉取（template-fetch）  
**Created**: 2026-03-09  
**Status**: Draft  
**Input**: spec-E11-S1.md、Story 11-1、PRD §5.2/§5.4/§5.8/§5.9、ARCH §3.2/§4.3

---

## 需求映射清单（plan.md ↔ 需求文档 + spec.md）

| 需求文档章节 | spec.md 对应 | plan.md 对应 | 覆盖状态 |
|-------------|-------------|-------------|----------|
| Story 11-1 本 Story 范围 | spec §User Scenarios、§Requirements | Phase 1–4、§Integration Test Plan | ✅ |
| spec FR-001–FR-012 | spec §Requirements | Phase 1–4、§Module Design | ✅ |
| PRD §5.2/§5.4/§5.8/§5.9 | spec Key Entities、FR-006–FR-009 | §Phase 2 超时链、§Phase 1 cache 结构 | ✅ |
| ARCH §3.2/§4.3 | spec Implementation Constraints | §Module Design、§Data Flow | ✅ |

---

## Phase 0: Technical Context

### 现有实现（Story 10.1）

- **template-fetcher.js**：fetchFromGitHub(tag, opts)、fetchTemplate(tag, opts)；拉取到 os.tmpdir() 临时目录，不写入 cache；仅读取 process.env.SDD_NETWORK_TIMEOUT_MS，无配置链。
- **init.js**：交互式选择 tag 或 customTag，调用 fetchTemplate(tag, { githubToken, skipTls, debug })；无 --template 参数；未传 networkTimeoutMs。

### Tech Stack

- Node.js path、fs、os.homedir()、https/http、zlib、tar；ConfigManager 已存在（get('networkTimeoutMs', { cwd })）。
- 退出码：exit-codes.TEMPLATE_NETWORK_FAILURE 或等价（3）。

---

## Phase 1: Module Design

### 1.1 Cache 与 TemplateFetcher 扩展

- **Cache 根目录**：`path.join(os.homedir(), '.bmad-speckit', 'templates')`
- **Cache 结构**：`<cacheRoot>/<template-id>/latest/`、`<cacheRoot>/<template-id>/<tag>/`（如 v1.2.3）；自定义 URL：`<cacheRoot>/<template-id>/url-<hash>/`（hash 为 URL 的简短稳定哈希，如 crypto.createHash('sha256').update(url).digest('hex').slice(0, 12)）
- **template-id**：来自 templateSource 的 repo 名或固定 id（如 'bmad-method'），可从 ConfigManager.get('templateSource') 解析或默认 owner/repo 的 repo 部分
- **TemplateFetcher 职责**：
  - 接收 (templateSpec, opts)：templateSpec 为 'latest' | tag 字符串 | url 字符串；opts 含 githubToken、skipTls、debug、**networkTimeoutMs**、cwd（用于读项目级配置时）
  - 解析超时：若 opts.networkTimeoutMs 已传入则使用；否则由调用方按配置链传入（init 负责读取配置链并传入）
  - GitHub 拉取：同现有逻辑，拉取 tarball 后解压到 **cache 目录** `<cacheRoot>/<template-id>/<tag>/` 或 `latest/`，缺失目录时 mkdirSync(..., { recursive: true })
  - URL 拉取：对 --template \<url\> 直接 GET url，解压到 `<cacheRoot>/<template-id>/url-<hash>/`
  - 返回：解压根目录路径（cache 内路径），供 init 后续 generateSkeleton 使用
  - 错误：拉取 404/非 2xx、解压失败、超时 → throw Error(明确信息)；调用方 process.exit(3)
  - 超时错误信息必须含「网络超时」或 "Network timeout" 等等价表述

### 1.2 init 与 --template

- **init 子命令**：新增选项 --template \<tag|url\>；解析后若为 URL（以 http:// 或 https:// 开头）则传 url 字符串给 TemplateFetcher；否则传 tag（含 'latest'）
- **配置链在 init 中解析**：超时优先级 CLI > 环境变量 > 项目级 > 全局 > 30000。若支持 --network-timeout 则 CLI 优先；否则 init 读取 ConfigManager.get('networkTimeoutMs', { cwd }) 与 process.env.SDD_NETWORK_TIMEOUT_MS，将最终值传入 fetchTemplate/fetchTemplateToCache
- **调用**：init 调用 TemplateFetcher 时传入 tag 或 url 及 opts（含 networkTimeoutMs）；TemplateFetcher 先检查 cache 是否存在且有效（可选：存在则直接返回 cache 路径），否则拉取并写入 cache 后返回路径

### 1.3 超时配置链实现

- **顺序**：CLI 参数（--network-timeout 若有）> SDD_NETWORK_TIMEOUT_MS > 项目级 bmad-speckit.json networkTimeoutMs > 全局 ~/.bmad-speckit/config.json networkTimeoutMs > 30000
- **实现位置**：init.js 在调用 fetchTemplate 前，按上述顺序解析出 networkTimeoutMs 数值，传入 opts.networkTimeoutMs；template-fetcher.js 内所有 HTTP 请求使用 opts.timeout 或 opts.networkTimeoutMs，不再仅依赖环境变量

### 1.4 错误处理

- 拉取 404/非 2xx：throw new Error(`模板拉取失败: HTTP ${statusCode}`) 或等价；init catch 后 console.error、process.exit(3)
- 解压失败：throw new Error('模板解压失败: 无效的 tarball') 或等价；exit(3)
- 超时：throw new Error('网络超时') 或含「网络超时」的表述；exit(3)
- 确保 template-fetcher 内 fetchJson、downloadAndExtract 等均使用传入的 timeout，且超时 reject 的消息含「网络超时」或 "Network timeout"

---

## Phase 2: Data Flow

1. 用户执行 `init [path] --template latest|v1.2.3|https://...`
2. init 解析 --template；解析超时配置链得到 networkTimeoutMs
3. init 调用 fetchTemplate(templateSpec, { githubToken, skipTls, debug, networkTimeoutMs, cwd })
4. TemplateFetcher：若 templateSpec 为 url，则 GET url 解压到 cache url-\<hash\>；若为 tag/latest，则从 GitHub 拉取并解压到 cache \<tag\>/ 或 latest/
5. 返回 cache 内解压根目录；init 继续 generateSkeleton(finalPath, templateDir, modules, options.force)

---

## Phase 3: Integration Test Plan

- E2E：init 传 --template latest 或 v1.0.0，验证 cache 目录存在且含预期文件（可 mock GitHub 或使用已知 release）
- E2E：init 传 --template \<url\>（可 mock HTTP 返回 tarball），验证解压到 cache 且 init 完成
- E2E：超时：mock 请求延迟 > networkTimeoutMs，验证退出码 3 且 stderr 含「网络超时」
- 单元：超时配置链顺序（mock ConfigManager、env）；拉取 404/解压失败退出码 3

---

## Reference

- spec-E11-S1.md、Story 11-1、PRD、ARCH
- packages/bmad-speckit/src/services/template-fetcher.js（现有）
- packages/bmad-speckit/src/services/config-manager.js（get('networkTimeoutMs', { cwd })）

<!-- AUDIT: PASSED by code-reviewer -->
