# Spec E13-S3: upgrade 子命令

**Epic**: 13 - Speckit Diagnostic Commands  
**Story**: 13.3 - upgrade 子命令  
**输入**: 13-3-upgrade.md, PRD §5.5/US-10, ARCH §3.2 UpgradeCommand

---

## 1. 概述

本 spec 定义 Story 13.3（upgrade 子命令）的技术规格，覆盖：

- **upgrade 子命令**：在已 init 项目目录内执行；未 init 时退出码 1
- **--dry-run**：仅检查并输出可升级版本信息，不执行任何文件写入
- **--template \<tag\>**：指定目标版本（如 `latest`、`v1.0.0`），未传时默认 `latest`
- **--offline**：仅使用本地 cache，不发起网络请求；cache 缺失时退出码 5（与 Story 11.2 一致）
- **templateVersion 更新**：升级完成后将 `_bmad-output/config/bmad-speckit.json` 的 `templateVersion` 更新为实际使用的版本
- **worktree 共享模式（bmadPath）**：当 `bmad-speckit.json` 含 `bmadPath` 时，仅更新 `templateVersion`，不覆盖外部共享 `_bmad`

---

## 2. 需求映射清单（spec.md ↔ 原始需求文档）

| 原始文档章节 | 原始需求要点 | spec.md 对应位置 | 覆盖状态 |
|-------------|-------------|------------------|----------|
| PRD §5.5 | upgrade 子命令：检查并拉取模板最新版本，支持 --dry-run、--template | §3, §4, §5 | ✅ |
| PRD US-10 | 须在已 init 目录内执行；--dry-run 仅检查；--template 指定目标；templateVersion 正确反映 | §3.1, §4, §5.2 | ✅ |
| ARCH §3.2 | UpgradeCommand：拉取最新模板、更新项目内 _bmad；支持 --dry-run、--template | §3, §4 | ✅ |
| Story AC-1 | 未 init 目录执行 upgrade → 退出码 1 | §3.1 | ✅ |
| Story AC-2 | --dry-run 输出可升级版本、不写入文件 | §4 | ✅ |
| Story AC-3 | --template 与执行更新、拉取失败退出码 3 | §5.1, §5.3 | ✅ |
| Story AC-4 | templateVersion 更新、worktree 模式、已有配置合并 | §5.2, §5.4, §6 | ✅ |
| Story AC-5 | networkTimeoutMs 从配置链传入 TemplateFetcher | §7 | ✅ |
| E11.1 | 复用 TemplateFetcher fetchTemplate | §5.1, §7 | ✅ |

---

## 3. UpgradeCommand 骨架与已 init 校验

### 3.1 实现位置与接口

| 项 | 说明 |
|----|------|
| 实现文件 | `packages/bmad-speckit/src/commands/upgrade.js`（新建） |
| 入口函数 | `upgradeCommand(cwd, options)` |
| options | `dryRun`, `template`, `offline`（与 bin 注册对应） |

### 3.2 已 init 校验

| 场景 | 行为 |
|------|------|
| `_bmad-output/config/bmad-speckit.json` 不存在 | 输出 stderr 明确错误信息（含「未 init」或等价表述），提示用户先执行 `init`；退出码 1 |
| 存在 | 继续执行 |

**实现**：读取 `path.join(cwd, '_bmad-output', 'config', 'bmad-speckit.json')`；`fs.existsSync` 或等价判定。

### 3.3 bin 注册

在 `packages/bmad-speckit/bin/bmad-speckit.js` 添加：

```javascript
program
  .command('upgrade')
  .description('Upgrade template version in initialized project')
  .option('--dry-run', 'Only check upgrade info, no file writes')
  .option('--template <tag>', 'Target version (latest, v1.0.0)')
  .option('--offline', 'Use only local cache')
  .action((opts) => upgradeCommand(process.cwd(), opts));
```

---

## 4. --dry-run 行为

| 场景 | 行为 |
|------|------|
| `dryRun === true` | 调用 TemplateFetcher 获取目标版本信息（拉取到 cache 或读取 cache）；stdout 输出可升级版本信息（如 current vs latest、或目标 tag）；不写入任何文件、不覆盖 _bmad；退出码 0 |
| `upgrade --dry-run --template v1.2.0` | 输出目标版本 v1.2.0 的信息；不执行更新；退出码 0 |

**实现**：`fetchTemplate(tag, { ... })` 返回模板目录路径；可读取该目录下的版本元数据或 tag 信息输出；不调用 `generateSkeleton` 或 `writeSelectedAI`。

---

## 5. --template 与执行更新

### 5.1 模板 tag 解析

| 输入 | 使用的 tag |
|------|-----------|
| 未传 --template | `latest` |
| `--template latest` | `latest`（fetchTemplate 内部解析为实际 tag） |
| `--template v1.2.0` | `v1.2.0` |

### 5.2 无 bmadPath 时：覆盖 _bmad

| 步骤 | 行为 |
|------|------|
| 1 | 调用 `fetchTemplate(tag, opts)`，opts 含 `networkTimeoutMs`、`templateSource`、`offline` |
| 2 | 调用 `generateSkeleton(projectRoot, templateDir, modules, force)` 将拉取到的模板解压根目录内容覆盖项目内 `_bmad`；modules 从现有 config 读取或 null（全量）；force 为 true |
| 3 | 按需更新 `_bmad-output` 中来自模板的子结构（若 template 含 _bmad-output 模板结构） |
| 4 | 更新 `bmad-speckit.json` 的 `templateVersion` 至实际使用的版本（见 §6） |

### 5.3 拉取失败

| 场景 | 行为 |
|------|------|
| 网络超时、404、其他 fetchTemplate 抛出 | 捕获异常；stderr 输出含「网络超时」或等价表述；建议 `--offline` 或检查网络；退出码 3 |
| err.code === 'OFFLINE_CACHE_MISSING' | 退出码 5（与 Story 11.2 一致） |

### 5.4 有 bmadPath（worktree 共享模式）时

| 场景 | 行为 |
|------|------|
| `bmad-speckit.json` 含 `bmadPath` | 不调用 `generateSkeleton`；不覆盖 `bmadPath` 指向的外部 `_bmad`；仅更新 `templateVersion` 至目标版本；退出码 0 |

---

## 6. templateVersion 更新与配置合并

### 6.1 更新逻辑

| 场景 | 行为 |
|------|------|
| 无 bmadPath | 拉取成功后，将实际使用的版本（`latest` 解析后的 tag 或传入的 tag）写入 `templateVersion` |
| 有 bmadPath | 仅将目标版本写入 `templateVersion` |

### 6.2 已有配置合并

| 约束 | 说明 |
|------|------|
| 仅更新 templateVersion | 读取现有 `bmad-speckit.json`，仅更新 `templateVersion` 字段；保留 `defaultAI`、`networkTimeoutMs`、`bmadPath`、`initLog` 等其他字段 |
| 实现 | 使用 `ConfigManager`：读取 project config → 设置 `obj.templateVersion = resolvedTag` → 写回；或 `ConfigManager.set('templateVersion', resolvedTag, { scope: 'project', cwd })`（若 set 支持 merge） |

**注意**：当前 ConfigManager.setAll 会覆盖传入的 key；为仅更新 templateVersion，需读取完整 config、更新该字段、写回，或使用 set 单键更新（若 set 实现为 merge 语义）。

---

## 7. 网络超时与配置链

| 约束 | 说明 |
|------|------|
| networkTimeoutMs | 从 `resolveNetworkTimeoutMs({ cwd })`（`utils/network-timeout.js`）或 ConfigManager 获取；配置链：SDD_NETWORK_TIMEOUT_MS > 项目级 > 全局 > 默认 30000 |
| 传入 fetchTemplate | `fetchTemplate(tag, { networkTimeoutMs, templateSource, offline, cwd })` |

---

## 8. 退出码

| 场景 | 退出码 | 依据 |
|------|--------|------|
| 成功 | 0 | PRD §5.2 |
| 未 init、未分类异常 | 1 | Story 13.2 AC-1 |
| 网络超时、拉取失败 | 3 | Story 13.2 AC-3 |
| --offline 且 cache 缺失 | 5 | Story 11.2 |

---

## 9. 非本 Story 范围

| 功能 | 负责 Story | 说明 |
|------|------------|------|
| 退出码 2、4、错误提示格式 | Story 13.2、11.2 | 复用约定 |
| 模板拉取、cache、--offline | Story 11.1、11.2 | 本 Story 调用 fetchTemplate |
| config 子命令 get/set/list | Story 13.4 | - |
| check、version、feedback | Story 13.1、13.5 | - |

---

## 10. 实现依赖

| 模块 | 说明 |
|------|------|
| template-fetcher | `fetchTemplate(tag, opts)`；opts: networkTimeoutMs, templateSource, offline, cwd |
| init-skeleton | `generateSkeleton(targetPath, templateDir, modules, force)`；可选：抽取仅更新 templateVersion 的辅助函数 |
| config-manager | 读取/更新 project config；合并时仅改 templateVersion |
| network-timeout | `resolveNetworkTimeoutMs({ cwd })` |

---

## 11. 术语

| 术语 | 定义 |
|------|------|
| bmadPath | worktree 共享模式下指向外部 _bmad 的路径 |
| templateVersion | bmad-speckit.json 中记录的模板版本 |
| resolvedTag | `latest` 经 fetchTemplate 解析后的实际 tag，或用户传入的 tag |

<!-- AUDIT: PASSED by code-reviewer -->
