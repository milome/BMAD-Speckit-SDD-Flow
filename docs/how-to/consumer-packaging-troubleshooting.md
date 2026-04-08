# Consumer Packaging Troubleshooting

这页文档只处理一种问题：**消费项目安装后，hooks / packaged worker / bundled schema 看起来都在，但治理链还是在真实执行时失败。**

适用读者：

- 维护 `bmad-speckit` 发布链的人
- 在消费项目中验证 runtime governance / zero-scripts 安装的人
- 遇到“本仓库本地能跑、消费项目里一跑就炸”的排障场景

## 结论先说

这次实际暴露出来的 consumer 回归问题有两类：

1. **hooks shared logic 回退到项目根 `scripts/`**
2. **packaged worker 缺少 schema 资产，或 governance rerun history 写入了 schema 不接受的 stage**

这两类问题都已经在仓库内修复，并且对应回归已补。

## 问题 1：zero-scripts consumer 里 hook 直接 `MODULE_NOT_FOUND`

### 现象

消费项目中执行：

```bash
node ./.claude/hooks/pre-continue-check.cjs check-implementation-readiness step-06-final-assessment
```

可能直接报：

```text
Cannot find module '../../../scripts/deferred-gap-governance.cjs'
```

### 根因

shared parser 一度只放在仓库根 `scripts/` 下，而 consumer 零脚本安装的设计前提就是：

- 可以没有项目根治理脚本
- 真正可执行的治理资产应落在：
  - `_bmad/runtime/hooks`
  - `.claude/hooks`
  - `.cursor/hooks`

所以一旦 hook `require('../../../scripts/...')`，消费项目就会因为路径不存在而崩。

### 修复方式

shared parser 已经下沉到：

- [_bmad/runtime/hooks/deferred-gap-governance.cjs](D:/Dev/BMAD-Speckit-SDD-Flow/_bmad/runtime/hooks/deferred-gap-governance.cjs)

仓库根的：

- [scripts/deferred-gap-governance.cjs](D:/Dev/BMAD-Speckit-SDD-Flow/scripts/deferred-gap-governance.cjs)

现在只是 repo 内 wrapper，不再是 consumer hook 的真实依赖面。

### 回归检查

在消费项目里，下面三个文件应该同时存在且内容已同步：

- `_bmad/runtime/hooks/deferred-gap-governance.cjs`
- `.claude/hooks/deferred-gap-governance.cjs`
- `.cursor/hooks/deferred-gap-governance.cjs`

## 问题 2：packaged worker 找不到 schema，或 governance rerun history 被 schema 拒绝

### 现象 A：schema 缺失

消费项目通过 tarball 或 bundled 安装触发治理 rerun 时，可能报：

```text
ENOENT: no such file or directory, open '...node_modules/bmad-speckit/node_modules/@bmad-speckit/schema/run-score-schema.json'
```

### 根因 A

`runtime-emit` 的 packaged worker 在运行时需要 `run-score-schema.json`，但 consumer 安装树里之前并没有正式的 `@bmad-speckit/schema` 包。

这会导致：

- 仓库源码模式下可能不报错
- tarball / bundled consumer 模式下才真实失败

### 修复方式 A

现在已经新增正式 schema workspace：

- [packages/schema/package.json](D:/Dev/BMAD-Speckit-SDD-Flow/packages/schema/package.json)

并接入：

- [packages/runtime-emit/package.json](D:/Dev/BMAD-Speckit-SDD-Flow/packages/runtime-emit/package.json)
- [packages/bmad-speckit/package.json](D:/Dev/BMAD-Speckit-SDD-Flow/packages/bmad-speckit/package.json)
- [scripts/prepublish-check.js](D:/Dev/BMAD-Speckit-SDD-Flow/scripts/prepublish-check.js)

现在 tarball 里应包含：

```text
node_modules/@bmad-speckit/schema/run-score-schema.json
```

### 现象 B：stage enum 校验失败

在 schema 已存在后，consumer 可能继续报：

```text
RunScoreRecord validation failed: ... /stage ... must be equal to one of the allowed values
```

### 根因 B

治理 rerun history 写入 score record 时，使用了 runtime lifecycle stage，如：

- `story_create`
- `story_audit`
- `post_audit`
- `epic_create`

但 `RunScoreRecord.stage` schema 允许的是 scoring stage：

- `story`
- `post_impl`
- `epics`

也就是说，问题不在 schema 本身，而在 **governance history 写入前没有做 stage 归一化**。

### 修复方式 B

现在已在：

- [packages/scoring/governance/write-rerun-history.ts](D:/Dev/BMAD-Speckit-SDD-Flow/packages/scoring/governance/write-rerun-history.ts)

显式做映射：

- `story_create` / `story_audit` → `story`
- `post_audit` → `post_impl`
- `epic_create` / `epic_complete` → `epics`

并补了针对性测试：

- [packages/scoring/governance/__tests__/write-rerun-history.test.ts](D:/Dev/BMAD-Speckit-SDD-Flow/packages/scoring/governance/__tests__/write-rerun-history.test.ts)

## 回归清单

### A. 仓库内发布链回归

```bash
node scripts/prepublish-check.js
node --test packages/bmad-speckit/tests/pack-bmad-mirror.test.js
```

期望：

- `prepublish-check` 通过
- tarball 包含 `@bmad-speckit/schema/run-score-schema.json`

### B. zero-scripts consumer 回归

```bash
npx vitest run tests/acceptance/accept-consumer-governance-zero-scripts.test.ts
```

期望：

- consumer 根目录不依赖治理 `scripts/`
- hooks / packaged worker 能真实执行
- 不再出现 `MODULE_NOT_FOUND` 或 schema 缺失

### C. hooks shared logic 回归

```bash
npx vitest run tests/acceptance/deferred-gap-governance.test.ts tests/acceptance/pre-continue-state-machine-binding.test.ts
```

期望：

- `pre-continue` 能在有 shared deferred gap parser 的情况下执行
- 不再依赖项目根 `scripts/deferred-gap-governance.cjs`

### D. governance history stage 归一化回归

```bash
npx vitest run packages/scoring/governance/__tests__/write-rerun-history.test.ts
```

期望：

- `story_create/story_audit` 写成 `story`
- `post_audit` 写成 `post_impl`
- `epic_create/epic_complete` 写成 `epics`

## 消费项目手工排障顺序

如果消费项目里 runtime governance 还不正常，建议按这个顺序查：

1. **先确认 hooks 是否真在跑**
   - 看 `.claude/hooks/*.cjs`、`.cursor/hooks/*.cjs`
   - 开 `BMAD_HOOKS_VERBOSE=1`
2. **再确认 zero-scripts 假设是否被破坏**
   - 不要先去找项目根 `scripts/governance-*`
   - 先看 `_bmad/runtime/hooks` 和宿主 hooks
3. **再确认 packaged subtree**
   - `node_modules/bmad-speckit/node_modules/@bmad-speckit/runtime-emit`
   - `node_modules/bmad-speckit/node_modules/@bmad-speckit/schema`
4. **最后看 rerun history 写分链**
   - 如果报 `/stage enum`，优先怀疑 stage 归一化
   - 如果报 schema 文件缺失，优先怀疑 bundle/install 树

## 推荐命令

在消费项目根执行：

```powershell
pwsh _bmad\speckit\scripts\powershell\check-prerequisites.ps1 -PathsOnly
npx bmad-speckit check
npx bmad-speckit-init --agent claude-code
npx bmad-speckit-init --agent cursor
```

如果你要专项验证 pre-continue：

```powershell
$env:BMAD_PRECONTINUE_ARTIFACT_PATH = "<readiness-report-path>"
node .\.claude\hooks\pre-continue-check.cjs check-implementation-readiness step-06-final-assessment
```

如果你要专项验证 post-tool-use → worker：

- 向 `post-tool-use.cjs` 喂一条 `governance-rerun-result`
- 再看：
  - `_bmad-output/runtime/governance/current-run.json`
  - `_bmad-output/runtime/governance/queue/last-failed-debug.json`

## 相关文档

- [consumer-installation.md](./consumer-installation.md)
- [runtime-dashboard.md](./runtime-dashboard.md)
- [deferred-gap-governance-operations.md](./deferred-gap-governance-operations.md)
