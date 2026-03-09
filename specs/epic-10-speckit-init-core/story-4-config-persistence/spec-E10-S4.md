# Spec E10-S4: 配置持久化

**Epic**: 10 - Speckit Init Core  
**Story**: 10.4 - 配置持久化  
**原始需求文档**: 10-4-config-persistence.md

---

## 1. 概述

本 spec 定义 ConfigManager 模块：提供全局配置（`~/.bmad-speckit/config.json`）与项目级配置（`<cwd>/_bmad-output/config/bmad-speckit.json`）的统一读写接口，支持 defaultAI、defaultScript、templateSource、networkTimeoutMs 等 key；读取时项目级优先于全局；写入时由调用方指定 scope（global/project）。init 流程（Story 10.1/10.2）通过 ConfigManager 写入项目级 selectedAI、templateVersion、initLog；Story 10.2 未传 --ai 时通过 ConfigManager 读取 defaultAI；Story 10.3 未传 --script 时通过 ConfigManager 读取 defaultScript。

---

## 2. 功能范围

### 2.1 本 Story 范围

| 功能点 | 描述 | 边界条件 |
|--------|------|----------|
| 全局路径 | 解析全局配置路径 | `os.homedir()` + `path.join('.bmad-speckit', 'config.json')`，禁止硬编码 `/` 或 `\` |
| 项目级路径 | 解析项目级配置路径 | `<cwd>/_bmad-output/config/bmad-speckit.json`，使用 path 模块 |
| get(key, options) | 按 key 读取；项目级优先于全局 | options.cwd 为项目根；均无时返回 undefined；networkTimeoutMs 均无时返回 30000 |
| set(key, value, options) | 按 scope 写入 | scope: 'global' \| 'project'；cwd 在 project 时必传；合并写入不删其他 key |
| setAll(record, options) | 多键合并写入 | 供 init 写入 selectedAI、templateVersion、initLog 等 |
| list(options) | 合并视图 | 全局与项目级合并，同 key 时项目级覆盖全局 |
| 支持 key | defaultAI、defaultScript、templateSource、networkTimeoutMs | 类型：字符串/字符串/字符串/数值；networkTimeoutMs 默认 30000 |
| 项目级扩展 key | templateVersion、selectedAI、initLog 等 | 由 init 流程写入，ConfigManager 仅提供读写能力 |

### 2.2 非本 Story 范围

| 功能 | 负责 Story | 说明 |
|------|------------|------|
| 交互式 init、Banner、AI 选择、--force、--modules | Story 10.1 | 由 Story 10.1 负责 |
| 非交互式 init（--ai、--yes、TTY 检测） | Story 10.2 | 由 Story 10.2 负责；本 Story 提供 defaultAI 读取接口 |
| 跨平台脚本生成（--script、defaultScript 默认值） | Story 10.3 | 由 Story 10.3 负责；本 Story 提供 defaultScript 读写 |
| config 子命令（get/set/list、--global、--json） | Story 13.4 | CLI 层调用 ConfigManager，写入目标决策由 13.4 实现 |
| --bmad-path、bmadPath 写入项目配置 | Story 10.5 | 由 Story 10.5 负责 |

---

## 3. 验收标准（AC）技术规格

### AC-1: 全局与项目级路径与格式

| Scenario | Given | When | Then |
|----------|-------|------|------|
| 全局路径 | 用户主目录可用 | ConfigManager 解析全局配置路径 | 为 `~/.bmad-speckit/config.json`（os.homedir() + path.join） |
| 项目级路径 | 当前工作目录为已 init 项目根 | ConfigManager 解析项目级配置路径 | 为 `<cwd>/_bmad-output/config/bmad-speckit.json` |
| 文件格式 | 读写配置 | 持久化与读取 | JSON 格式；写入时保持合法 JSON 且不破坏已有键值 |

**实现要点**：路径使用 Node.js path 与 os.homedir()；目录不存在时创建（mkdirSync recursive）；读写 UTF-8。

### AC-2: get(key, options) 与优先级

| Scenario | Given | When | Then |
|----------|-------|------|------|
| 仅全局有值 | 全局 config 含 defaultAI，项目级不存在或无该 key | get('defaultAI', { cwd }) | 返回全局 defaultAI |
| 项目级有值 | 项目级 bmad-speckit.json 含 defaultAI | get('defaultAI', { cwd }) | 返回项目级值（项目级优先） |
| 均无 | 全局与项目级均无该 key | get('defaultAI', { cwd }) | 返回 undefined；除 networkTimeoutMs 外无内置默认；defaultAI/defaultScript 的回退由 10.2/10.3 负责 |
| 仅项目级存在 | 无全局文件，项目级有 defaultScript | get('defaultScript', { cwd }) | 返回项目级 defaultScript |

**实现要点**：先读项目级（若 cwd 下存在项目级文件且含 key），再读全局；均无则 undefined；networkTimeoutMs 特殊：均无时返回 30000。

### AC-3: set(key, value, options) 与目标

| Scenario | Given | When | Then |
|----------|-------|------|------|
| 写入全局 | 调用 set(key, value, { scope: 'global' }) | ConfigManager 执行 | 写入 ~/.bmad-speckit/config.json，必要时创建目录与文件 |
| 写入项目级 | 调用 set(key, value, { scope: 'project', cwd }) | ConfigManager 执行 | 写入 <cwd>/_bmad-output/config/bmad-speckit.json，必要时创建目录与文件 |
| 合并写入 | 目标文件已存在且含其他 key | set 单 key | 仅更新该 key，不删除其他 key |

**实现要点**：读入现有 JSON，合并单 key 或 setAll 多 key，写回 UTF-8。

### AC-4: list(options) 与合并视图

| Scenario | Given | When | Then |
|----------|-------|------|------|
| 合并列表 | 全局与项目级均存在且含不同 key | list({ cwd }) | 返回合并后的键值对；同 key 时项目级值覆盖全局 |
| 仅全局 | 无项目级文件 | list({ cwd }) | 返回全局配置的键值对 |

**实现要点**：先读全局对象，再读项目级对象（若存在），同 key 项目级覆盖，返回单一对象。

### AC-5: 支持的 key 与类型

| Scenario | Given | When | Then |
|----------|-------|------|------|
| defaultAI | 字符串 | get/set | 读写为字符串（AI id） |
| defaultScript | 字符串 | get/set | 读写为字符串（如 "sh"、"ps"） |
| templateSource | 字符串 | get/set | 读写为字符串 |
| networkTimeoutMs | 数值 | get/set | 读写为数字；未设置时 get 可返回 30000 作为默认 |

### AC-6: init 流程写入项目级

| Scenario | Given | When | Then |
|----------|-------|------|------|
| init 写入 | init 完成（Story 10.1/10.2） | 调用 ConfigManager 写入项目级 | selectedAI、templateVersion、initLog 等可写入 _bmad-output/config/bmad-speckit.json；ConfigManager 提供 set 或多键合并写入（setAll），供 init 调用 |

**实现要点**：init 完成后通过 ConfigManager.set 或 setAll 写入项目级；ConfigManager 可被 init 命令 require 并调用（如 src/services/config-manager.js）。

---

## 4. 架构约束与依赖

### 4.1 与 Story 10.1 / 10.2 / 10.3 的集成

- **InitCommand**：packages/bmad-speckit/src/commands/init.js；init 完成后通过 ConfigManager 写入项目级 bmad-speckit.json（selectedAI、templateVersion、initLog）。当前 init-skeleton.js 的 writeSelectedAI 直接写文件；本 Story 完成后可改为通过 ConfigManager.set 或 setAll。
- **Story 10.2**：getDefaultAI 已约定 ConfigManager.get('defaultAI', { cwd }) 有值则用，否则内置第一项；init.js 已 try/require 的 config-manager 路径为 `../services/config-manager`，故 ConfigManager 模块应置于 src/services/config-manager.js。
- **Story 10.3**：未传 --script 时调用 ConfigManager.get('defaultScript', { cwd })；无值时用平台默认（Windows→ps，非 Windows→sh）。init.js 已预留该调用。

### 4.2 架构约束（PRD §5.9、ARCH §3.2、§4.1）

- ConfigManager 为无 UI 的纯读写模块，不解析 CLI 参数；config 子命令的 get/set/list 与 --global 逻辑由 Story 13.4 实现。
- 配置优先级（ConfigManager 仅负责「项目级 > 全局」的读取合并与按 scope 写入）：CLI > 环境变量 > 项目级 > 全局 > 内置。
- 路径使用 Node.js path 与 os.homedir()，禁止硬编码 `/` 或 `\`。
- 全局目录 ~/.bmad-speckit、项目级 _bmad-output/config 若不存在须自动创建；读写使用 UTF-8。

---

## 5. 需求映射清单（spec.md ↔ 原始需求文档）

| 原始文档章节 | 原始需求要点 | spec.md 对应位置 | 覆盖状态 |
|-------------|-------------|------------------|----------|
| Story 陈述 | 配置持久化、全局与项目级、项目级覆盖、defaultAI/defaultScript、与 10.1/10.2/10.3 集成 | §1 概述、§2.1、§3 | ✅ |
| 需求追溯 PRD US-8 | 配置持久化与复用：~/.bmad-speckit/config.json、defaultAI/defaultScript、项目级覆盖 | §2.1、§3 AC-1～AC-6 | ✅ |
| 需求追溯 PRD §5.9 | 全局与项目级路径、key、格式 | §2.1、§3 AC-1、AC-5 | ✅ |
| 需求追溯 ARCH §3.2 ConfigManager | 读写两路径；defaultAI、defaultScript、templateSource、networkTimeoutMs（默认 30000） | §2.1、§3 AC-2、AC-5 | ✅ |
| 需求追溯 ARCH §4.1 | 配置优先级：项目级 > 全局（ConfigManager 职责内） | §3 AC-2、AC-4、§4.2 | ✅ |
| Epics 10.4 | 配置持久化、两路径、defaultAI/defaultScript、项目级覆盖 | §2.1、§3、§4 | ✅ |
| 本 Story 范围 ConfigManager、路径、key、优先级、set/list | 见 Story 文档 | §2.1、§3 AC-1～AC-6 | ✅ |
| 非本 Story 范围 | 10.1/10.2/10.3/13.4/10.5 职责 | §2.2 | ✅ |
| AC-1～AC-6 表 | 各 Scenario Given/When/Then | §3 对应 AC 节 | ✅ |
| Dev Notes 架构约束 | 无 UI、路径、优先级、与 init 集成 | §4 | ✅ |

<!-- AUDIT: PASSED by code-reviewer --> 参见 AUDIT_spec-E10-S4.md
