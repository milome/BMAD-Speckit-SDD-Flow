# Tasks: Story 11.1 模板拉取

**Epic**: 11 - speckit-template-offline  
**Story**: 11.1 - 模板拉取（template-fetch）  
**Input**: spec-E11-S1.md、plan-E11-S1.md、IMPLEMENTATION_GAPS-E11-S1.md  
**Prerequisites**: spec、plan、GAPS 均已通过审计

---

## 本批任务 ↔ 需求追溯

| 任务 ID | 需求文档 | 章节 | 需求要点 |
|---------|----------|------|----------|
| T001–T003 | Story 11-1、spec、plan | Task 1、GAP-1.x | GitHub Release 拉取、解压写入 cache、目录创建、init 复用 cache 路径 |
| T004–T005 | Story 11-1、spec、plan | Task 2、GAP-2.x | --template tag/url 解析、URL 拉取与解压到 cache |
| T006–T007 | Story 11-1、spec、plan | Task 3、GAP-3.x | 超时配置链、所有请求应用超时、超时文案与退出码 3 |
| T008–T009 | Story 11-1、spec、plan | Task 4、GAP-4.x | 404/非 2xx/解压失败退出码 3、单元/集成测试 |

---

## Gaps → 任务映射

| 章节 | Gap ID | 本任务表行 | 对应任务 |
|------|--------|------------|----------|
| Task 1 | GAP-1.1, 1.2, 1.3 | ✓ 有 | T001, T002, T003 |
| Task 2 | GAP-2.1, 2.2 | ✓ 有 | T004, T005 |
| Task 3 | GAP-3.1, 3.2 | ✓ 有 | T006, T007 |
| Task 4 | GAP-4.1, 4.2 | ✓ 有 | T008, T009 |

---

## Phase 1: Cache 与 TemplateFetcher 扩展（AC-1）

**Purpose**: 拉取 → 解压 → 写入 ~/.bmad-speckit/templates/\<template-id\>/\<tag\>/，init 复用 cache 路径

- [ ] **T001** 在 template-fetcher.js 中定义 cache 根目录 `path.join(os.homedir(), '.bmad-speckit', 'templates')` 与 template-id（来自 templateSource 或默认 repo 名）；实现「拉取 tarball → 解压到 cache \<template-id\>/\<tag\>/ 或 latest/」，缺失目录时 mkdirSync(..., { recursive: true })（GAP-1.1, 1.2）
- [ ] **T002** 拉取前检查 cache 中是否已存在目标目录且含内容；若存在则直接返回该 cache 路径，否则拉取并写入后返回（GAP-1.3）
- [ ] **T003** init 调用 TemplateFetcher 时传入 tag 或 'latest'（来自交互或 --template，见 T004）；使用返回的 cache 路径作为 templateDir 调用 generateSkeleton（GAP-1.3）

**验收命令**: init 执行后 ~/.bmad-speckit/templates/\<template-id\>/latest/ 或 \<tag\>/ 存在且含解压内容；再次 init 同 tag 可复用

---

## Phase 2: --template 解析与 URL 拉取（AC-1、AC-2）

**Purpose**: init 支持 --template \<tag\>|latest|\<url\>；TemplateFetcher 支持 url 拉取并解压到 cache

- [ ] **T004** 在 init 子命令中新增选项 --template \<string\>；解析后若以 http:// 或 https:// 开头则传 url 给 TemplateFetcher，否则传 tag（含 'latest'）；非交互模式下可直接使用 --template，交互模式下可覆盖或默认（GAP-2.1）
- [ ] **T005** 在 template-fetcher.js 中实现 URL 拉取分支：对 templateSpec 为 url 时发起 GET，解压到 cache \<template-id\>/url-\<hash\>/（hash 为 URL 的短哈希），返回该路径；使用与 GitHub 相同的超时与错误码语义（GAP-2.2）

**验收命令**: `init . --template https://...`（可 mock）拉取并解压到 cache；`init . --template v1.0.0` 使用 tag 路径

---

## Phase 3: 网络超时配置链（AC-3）

**Purpose**: 超时五级优先级；所有请求应用超时；超时错误含「网络超时」、退出码 3

- [ ] **T006** 在 init 中实现超时配置读取：若存在 CLI 选项 --network-timeout 则优先；否则 process.env.SDD_NETWORK_TIMEOUT_MS；否则 ConfigManager.get('networkTimeoutMs', { cwd })（项目级）；否则 ConfigManager.get('networkTimeoutMs', {})（全局）；否则 30000。将结果以 opts.networkTimeoutMs 传入 TemplateFetcher（GAP-3.1）
- [ ] **T007** 在 template-fetcher.js 中所有 HTTP/HTTPS 请求使用 opts.networkTimeoutMs 或 opts.timeout（不再仅用环境变量）；超时 reject 时错误信息含「网络超时」或 "Network timeout"；init 侧 catch 后 console.error(err.message)、process.exit(exitCodes.NETWORK_TEMPLATE_FAILED)（GAP-3.2）

**验收命令**: 设置 SDD_NETWORK_TIMEOUT_MS=5000 且 mock 延迟 6s，验证退出码 3 且 stderr 含「网络超时」或等价

---

## Phase 4: 错误处理与测试（AC-4）

**Purpose**: 404/非 2xx/解压失败统一退出码 3；补充单元/集成测试

- [ ] **T008** 确保拉取 404 或非 2xx 时 TemplateFetcher throw 明确信息，init catch 后 process.exit(3)；解压失败时同样 exit(3) 与明确提示（GAP-4.1）
- [ ] **T009** 为 TemplateFetcher 与 init 拉取路径补充或调整单元/集成测试：覆盖 latest、指定 tag、--template url（可 mock）、超时配置链、超时触发退出码 3、404/解压失败退出码 3（GAP-4.2）

**验收命令**: 单元/集成测试通过；mock 404 与解压失败时退出码 3

---

## 验收汇总

| AC | 验收 |
|----|------|
| AC-1 | T001–T003 验收命令 + cache 目录存在且可复用 |
| AC-2 | T004–T005 验收命令 |
| AC-3 | T006–T007 验收命令 |
| AC-4 | T008–T009 验收命令 |

<!-- AUDIT: PASSED by code-reviewer -->
