# Implementation Plan: 离线与版本锁定（Story 11.2）

**Epic**: 11 - speckit-template-offline  
**Story**: 11.2 - 离线与版本锁定（offline-version-lock）  
**Created**: 2026-03-09  
**Status**: Draft  
**Input**: spec-E11-S2.md、Story 11-2、PRD §5.4、ARCH §3.2/§4.3

---

## 需求映射清单（plan.md ↔ 需求文档 + spec.md）

| 需求文档章节 | spec.md 对应 | plan.md 对应 | 覆盖状态 |
|-------------|-------------|-------------|----------|
| Story 11-2 本 Story 范围 | spec §User Scenarios、§Requirements | Phase 1–4、§Integration Test Plan | ✅ |
| spec FR-001–FR-008 | spec §Requirements | Phase 1–4、§Module Design | ✅ |
| spec AC-1–AC-3 | spec User Stories 1–3 | Phase 1–4、§Data Flow | ✅ |
| PRD §5.4、ARCH §3.2/§4.3 | spec Key Entities | §Phase 0 技术栈、§Phase 1 模块设计 | ✅ |

---

## Phase 0: Technical Context

### 现有实现（Story 11.1 + 10.4）

- **template-fetcher.js**：fetchTemplate(templateSpec, opts)、getCacheDir、isCacheValid；支持 cache 写入与复用；opts 含 networkTimeoutMs、templateSource；无 opts.offline。
- **init.js**：解析 --template、调用 fetchTemplate；runNonInteractiveFlow、runInteractiveFlow 传入 tag 与 opts；catch NETWORK_TEMPLATE 时 exit(3)；无 --offline 参数。
- **init-skeleton.js**：writeSelectedAI(targetPath, selectedAI, templateVersion, bmadPath) 通过 ConfigManager.setAll 写入 _bmad-output/config/bmad-speckit.json（含 selectedAI、templateVersion、initLog）；已写入 templateVersion。
- **exit-codes.js**：已有 OFFLINE_CACHE_MISSING: 5。

### Tech Stack

- Node.js path、fs、os.homedir()；ConfigManager、init-skeleton 已存在。
- 退出码：5（离线 cache 缺失）、3（网络/模板失败）。

---

## Phase 1: Module Design

### 1.1 TemplateFetcher 扩展（--offline 分支）

- **新增 opts.offline**：TemplateFetcher.fetchTemplate(templateSpec, opts) 接收 opts.offline（boolean）；init 解析 --offline 后传入 opts.offline = true。
- **offline 为真时的逻辑**：
  1. 解析所需 cache 路径：getCacheDir(tag, templateSource) 或 url-<hash>（templateSpec 为 url 时）；tag 来自 templateSpec 或 'latest'。
  2. 检查 isCacheValid(cacheDir)；若有效则直接返回 cacheDir。
  3. 若无效（不存在或空）：throw new Error('离线模式下模板 cache 缺失 (Offline mode: template cache missing)') 或含「离线」「cache 缺失」的等价表述；err.code = 'OFFLINE_CACHE_MISSING'。
  4. **禁止**：offline 为真时不得发起任何 HTTP/HTTPS 请求；不得调用 fetchJson、downloadAndExtract。
- **offline 为假**：保持现有 fetchFromGitHub、fetchFromUrl 逻辑；无变更。

### 1.2 init 与 --offline 解析

- **init 子命令**：新增选项 --offline（boolean，无参数）；解析后以 opts.offline 传入 fetchTemplate。
- **调用链**：init → fetchTemplate(templateSpec, { ...opts, offline: options.offline })；runNonInteractiveFlow、runInteractiveFlow 均需传入 offline。
- **catch 逻辑**：当 err.code === 'OFFLINE_CACHE_MISSING' 时，console.error(err.message)、process.exit(exitCodes.OFFLINE_CACHE_MISSING)。
- **templateVersion 写入**：init 成功后 writeSelectedAI 已传入 tag；需确认 tag 为实际使用的版本（如 latest 或 v1.0.0）；当前 init 传 tag 即可，AC-2.3 允许 "latest" 等可识别标识。

### 1.3 本地 _bmad 与 offline 的交互

- **getLocalTemplatePath()**：当检测到项目内 _bmad 存在时，直接返回本地路径，不访问 cache；此路径下 init 不涉及模板拉取，--offline 不改变该分支。
- **offline 与 local**：若 getLocalTemplatePath() 有值，则直接返回，不进入 fetchFromGitHub/fetchFromUrl，也不进入 offline cache 检查；逻辑上 local 优先，与 11.1 一致。

---

## Phase 2: Data Flow

1. 用户执行 `init [path] --offline` 或 `init [path] --offline --template v1.0.0`（非交互）或交互模式下传 `--offline`。
2. bin/bmad-speckit.js 解析 init 子命令的 --offline 选项；init.js（initCommand）从 options.offline 接收。
3. runNonInteractiveFlow 与 runInteractiveFlow 均将 options.offline 传入 fetchTemplate 的 opts。
4. init 调用 fetchTemplate(templateSpec, { ..., offline: true })。
5. TemplateFetcher：若 opts.offline 为真，仅检查 cache 存在性；cache 有效则返回路径；cache 缺失则 throw OFFLINE_CACHE_MISSING。
6. init catch OFFLINE_CACHE_MISSING → console.error、process.exit(5)。
7. init 成功（含 offline 路径）→ generateSkeleton、writeSelectedAI(targetPath, selectedAI, tag)；templateVersion 已写入 bmad-speckit.json。

---

## Phase 3: Integration Test Plan

### 端到端功能测试（E2E，用户可见流程）

- **E2E-1**：init --offline 且 cache 存在（可预先拉取或 mock cache 目录）→ 不发起网络，init 成功完成；验证 _bmad-output/config/bmad-speckit.json 含 templateVersion。
- **E2E-2**：init --offline 且 cache 缺失（清空或使用不存在的 tag）→ 退出码 5，stderr 含「离线」与「cache 缺失」或等价表述。
- **E2E-3**：init 未传 --offline（网络可用或 mock）→ 行为与 11.1 一致；网络失败时退出码 3，非 5。
- **E2E-4**（AC-2.2）：已有配置合并 — 项目已有 _bmad-output/config/bmad-speckit.json 且含 defaultAI、networkTimeoutMs 等；init 成功完成后，验证仅 templateVersion 被更新，其他字段保留。

### 集成测试（模块间协作、生产代码关键路径）

- **INT-1**：init（runNonInteractiveFlow/runInteractiveFlow）调用 fetchTemplate(templateSpec, { offline: true }) 时，TemplateFetcher 仅走 cache 路径、不调用 fetchFromGitHub/fetchFromUrl；可 mock 网络层验证无请求发出。
- **INT-2**：init catch err.code === 'OFFLINE_CACHE_MISSING' 时正确 process.exit(5)；可 mock TemplateFetcher throw 该错误验证。
- **INT-3**：init 成功路径下 writeSelectedAI(targetPath, selectedAI, tag) 被调用，生产代码链条：init → fetchTemplate → generateSkeleton → writeSelectedAI；验证 bmad-speckit.json 最终含 templateVersion。
- **INT-4**：bin/bmad-speckit.js init 子命令 --offline 选项解析后传入 initCommand；集成验证从 CLI 入口到 init 的完整路径。

### 单元测试

- **UNIT-1**：TemplateFetcher 在 opts.offline 为真且 cache 存在时返回路径、不发起请求；cache 缺失时 throw 含 code OFFLINE_CACHE_MISSING；mock fs.existsSync、fs.readdirSync。
- **UNIT-2**：init 解析 --offline 并传入 opts；catch OFFLINE_CACHE_MISSING 时 exit(5)。

---

## Phase 4: 接口与测试策略汇总

### 接口变更

| 模块 | 变更 | 说明 |
|------|------|------|
| template-fetcher.js | fetchTemplate(templateSpec, opts) 新增 opts.offline | offline 为真时仅 cache 检查，不发起网络 |
| init.js | 新增 --offline 选项 | 解析后传入 TemplateFetcher；catch OFFLINE_CACHE_MISSING 时 exit(5) |
| bin/bmad-speckit.js | init 子命令新增 --offline | 与 init.js 选项对齐 |

### 测试策略

- **单元**：TemplateFetcher offline 分支（cache 存在/缺失）；init --offline 解析与 exit(5) 路径。
- **集成**：init → fetchTemplate(offline) → generateSkeleton → writeSelectedAI 完整链条；OFFLINE_CACHE_MISSING catch 与 exit(5)；bin 到 init 的 CLI 路径。
- **E2E**：离线 cache 存在/缺失、未传 --offline 网络失败；已有配置合并（AC-2.2）；验证退出码、stderr 与 bmad-speckit.json 内容。

---

## Reference

- spec-E11-S2.md、Story 11-2、PRD、ARCH
- packages/bmad-speckit/src/services/template-fetcher.js
- packages/bmad-speckit/src/commands/init.js
- packages/bmad-speckit/src/constants/exit-codes.js

<!-- AUDIT: PASSED by code-reviewer -->
