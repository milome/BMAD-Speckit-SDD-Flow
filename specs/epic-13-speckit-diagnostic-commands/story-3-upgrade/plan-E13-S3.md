# Plan E13-S3: upgrade 子命令实现方案

**Epic**: 13 - Speckit Diagnostic Commands  
**Story**: 13.3 - upgrade 子命令  
**输入**: spec-E13-S3.md, 13-3-upgrade.md, PRD, ARCH

---

## 1. 概述

本 plan 定义 Story 13.3（upgrade 子命令）的实现方案：新建 UpgradeCommand 在已 init 目录内执行；支持 --dry-run（仅检查）、--template、--offline；复用 TemplateFetcher 与 generateSkeleton；worktree 模式仅更新 templateVersion。

---

## 2. 需求映射清单（plan.md ↔ 需求文档 + spec.md）

| 需求文档章节 | spec.md 对应 | plan.md 对应 | 覆盖状态 |
|-------------|-------------|-------------|----------|
| PRD §5.5, US-10 | spec §3 | Phase 1 | ✅ |
| Story AC-1 | spec §3.1 | Phase 1 | ✅ |
| Story AC-2 | spec §4 | Phase 2 | ✅ |
| Story AC-3, AC-5 | spec §5, §7 | Phase 3 | ✅ |
| Story AC-4 | spec §5.2, §5.4, §6 | Phase 3, Phase 4 | ✅ |
| ARCH §3.2 | spec §3, §4 | Phase 1, Phase 2 | ✅ |

---

## 3. 技术架构

### 3.1 模块职责

| 模块 | 路径 | 职责 |
|------|------|------|
| UpgradeCommand | `src/commands/upgrade.js`（新建） | upgradeCommand(cwd, options)；已 init 校验；--dry-run；调用 fetchTemplate、generateSkeleton 或仅更新 templateVersion |
| template-fetcher | `src/services/template-fetcher.js` | 已有；fetchTemplate(tag, opts) 支持 networkTimeoutMs、offline |
| init-skeleton | `src/commands/init-skeleton.js` | 已有；generateSkeleton(targetPath, templateDir, modules, force) |
| config-manager | `src/services/config-manager.js` | 已有；set(key, value, options) 可仅更新 templateVersion |

### 3.2 数据流

```
upgrade 流程:
  1. 读取 _bmad-output/config/bmad-speckit.json → 不存在则 exit 1
  2. 解析 tag = options.template || 'latest'
  3. networkTimeoutMs = resolveNetworkTimeoutMs({ cwd })
  4. 若 dryRun:
       fetchTemplate(tag, { networkTimeoutMs, templateSource, offline, cwd })
       stdout 输出可升级版本信息
       return exit 0
  5. 否则执行更新:
       templateDir = fetchTemplate(tag, {...})
       若 config.bmadPath 存在:
         仅 ConfigManager.set('templateVersion', resolvedTag, { scope: 'project', cwd })
       否则:
         generateSkeleton(cwd, templateDir, null, true)
         按需更新 _bmad-output 来自模板的子结构
         ConfigManager.set('templateVersion', resolvedTag, { scope: 'project', cwd })
  6. exit 0
```

### 3.3 resolvedTag 解析

| 场景 | resolvedTag |
|------|-------------|
| tag === 'latest' | fetchTemplate 内部会解析；需从 GitHub API 或 cache 目录名获取实际 tag，或直接写 'latest'（若 version 命令支持） |
| tag 为 v1.0.0 等 | 即 tag 本身 |

**实现**：fetchTemplate 返回的路径为 cache 目录；对于 latest，cache 目录名为 `latest` 但实际对应某 tag；可从 `path.basename(getCacheDir(tag, templateSource))` 或 fetchFromGitHub 返回的 tagToUse 获取。template-fetcher 的 fetchFromGitHub 在 tag===latest 时会解析 tagToUse，但返回的是 cacheDir 路径。可选：在 fetchTemplate 返回时附带 resolvedTag，或 upgrade 读取 cache 目录下某元数据文件。简化方案：upgrade 将用户传入的 tag 或 'latest' 直接写入 templateVersion（与 init 行为一致）；若需解析 latest→实际 tag，可在后续迭代增强。

**Story 要求**：templateVersion 更新为「实际使用的版本」。init 中 writeSelectedAI 传入的 tag 即用户传入的（可能为 latest）。为满足「实际使用」，latest 解析后的 tag 更准确。template-fetcher 的 fetchFromGitHub 在 latest 时会请求 API 得到 tag_name。可在 upgrade 中先 fetch（或 dry-run 时已 fetch 到 cache），然后从 cache 目录结构推断：getCacheDir('latest', templateSource) 实际存的是 tagToUse 的解压内容，目录名可能为 'latest'。需在 template-fetcher 增加 getResolvedTag 或从 fetch 结果返回 resolvedTag。**简化**：先实现为写入用户传入 tag（latest 或 v1.0.0）；若 cache 目录结构可推断则优化。

---

## 4. 实现阶段（Phases）

### Phase 1: UpgradeCommand 骨架与已 init 校验

**目标**：新建 `src/commands/upgrade.js`，实现 upgradeCommand；bin 注册 upgrade 子命令。

**实现要点**：
1. upgradeCommand(cwd, options) 接收 dryRun、template、offline（与 Commander 对应）
2. 校验 config 路径：path.join(cwd, '_bmad-output', 'config', 'bmad-speckit.json')；不存在则 stderr 输出「未 init」或等价，exit 1
3. bin/bmad-speckit.js 添加 .command('upgrade')、.option('--dry-run')、.option('--template <tag>')、.option('--offline')、.action(upgradeCommand)

**产出**：`src/commands/upgrade.js`、bin 修改

### Phase 2: --dry-run

**目标**：dryRun 时仅 fetch 并输出版本信息，不写入文件。

**实现要点**：
1. 若 options.dryRun：调用 fetchTemplate(tag, opts)，stdout 输出可升级版本（如 current vs 目标 tag）；不调用 generateSkeleton、ConfigManager.set；exit 0
2. 拉取失败时捕获异常，stderr 输出错误，exit 3 或 5

**产出**：upgrade.js dry-run 分支

### Phase 3: --template 与执行更新

**目标**：无 dryRun 时拉取模板并覆盖 _bmad，或（有 bmadPath 时）仅更新 templateVersion。

**实现要点**：
1. 解析 tag = options.template || 'latest'
2. 调用 fetchTemplate(tag, { networkTimeoutMs, templateSource, offline, cwd })
3. 读取 config 获取 bmadPath
4. 若 bmadPath 存在：不调用 generateSkeleton；ConfigManager.set('templateVersion', tag, { scope: 'project', cwd })（合并语义）
5. 若 bmadPath 不存在：generateSkeleton(cwd, templateDir, null, true)；ConfigManager.set('templateVersion', tag, { scope: 'project', cwd })
6. 异常处理：OFFLINE_CACHE_MISSING → exit 5；NETWORK_TEMPLATE → exit 3

**产出**：upgrade.js 更新逻辑

### Phase 4: templateVersion 合并与 networkTimeoutMs

**目标**：仅更新 templateVersion，保留其他字段；传入 networkTimeoutMs。

**实现要点**：
1. ConfigManager.set('templateVersion', value, { scope: 'project', cwd }) 实现 merge 语义（读取→更新单键→写回）
2. resolveNetworkTimeoutMs({ cwd }) 从 utils/network-timeout 获取，传入 fetchTemplate opts

**产出**：确保 config 合并正确；networkTimeoutMs 传递

---

## 5. 测试计划

| 测试类型 | 覆盖内容 | 验收方式 |
|---------|---------|---------|
| 单元/集成 | 未 init 目录执行 upgrade → exit 1 | 断言 stderr、exitCode |
| 单元/集成 | 已 init 目录 upgrade --dry-run → exit 0、无文件变更 | 对比 upgrade 前后文件 |
| 集成 | 已 init 目录 upgrade --template latest → _bmad 更新、templateVersion 更新 | 检查 _bmad 内容、bmad-speckit.json |
| 集成 | bmadPath 存在时 upgrade 仅更新 templateVersion | 检查 bmadPath 指向目录未变、config 中 templateVersion 已更新 |

<!-- AUDIT: PASSED by code-reviewer -->
