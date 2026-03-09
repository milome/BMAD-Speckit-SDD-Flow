# BUGFIX GAP-POST-1：移除 init-skeleton.js 中硬编码 .cursor/.claude 逻辑

## §1 问题描述

Story 12-2 实施后审计（AUDIT_Story_12-2_stage4.md）指出 **GAP-POST-1**：init-skeleton.js 中 generateWorktreeSkeleton 仍含硬编码 .cursor/ 复制逻辑；spec §5、plan Phase 2 要求移除；该函数未导出、未调用，属死代码。

经代码核查：
- **generateWorktreeSkeleton** 在当前代码库中已不存在（可能已在某次提交中删除）。
- **init-skeleton.js** 中仍存在与 .cursor/.claude 相关的硬编码逻辑：`copyDir` 函数第 32 行 `e.name !== '.cursor' && e.name !== '.claude'`，在 `opts.skipHidden` 为 true 时对 .cursor 和 .claude 做特殊处理。当前所有 `copyDir` 调用均未传入 `skipHidden: true`，故该分支为死代码；但为满足 spec §5「禁止 init-skeleton.js 中硬编码 .cursor/、.claude/」的要求，需移除该特殊逻辑。

## §2 根因分析

- spec §5.2 明确：init-skeleton.js 中 createWorktreeSkeleton、generateWorktreeSkeleton 的硬编码 `.cursor/`、`.claude/` 复制逻辑须移除，改为调用 SyncService。
- createWorktreeSkeleton 已改为仅建 _bmad-output 骨架，同步由 SyncService 完成。
- generateWorktreeSkeleton 若曾存在，现已不存在。
- copyDir 中的 `.cursor`、`.claude` 例外属于残留的硬编码，虽为死代码，但不符合 spec 要求。

## §3 影响范围

- 仅 `packages/bmad-speckit/src/commands/init-skeleton.js` 中 `copyDir` 函数。
- 当前该分支未被触发，移除后行为无变化；移除后满足 spec §5 与审计要求。

## §4 修复方案

移除 `copyDir` 函数中对 `.cursor` 和 `.claude` 的特殊处理。

**修改前**（约第 32 行）：
```javascript
if (opts.skipHidden && e.name.startsWith('.') && e.name !== '.cursor' && e.name !== '.claude') return;
```

**修改后**：
```javascript
if (opts.skipHidden && e.name.startsWith('.')) return;
```

含义：当 `opts.skipHidden` 为 true 时，跳过所有以 `.` 开头的目录（与常规隐藏目录处理一致）。当前无调用方传入 `skipHidden`，行为保持不变。

**删除 generateWorktreeSkeleton 后还能正确处理 cursor 分支吗？**  
能。cursor 分支（以及 opencode、bob 等）的 commands/rules 同步由 **SyncService.syncCommandsRulesConfig** 负责：
- 源：`projectRoot/_bmad/cursor/` 或 `bmadPath/cursor/`
- 目标：由 `configTemplate` 决定（如 cursor-agent → `.cursor/commands`，opencode → `.opencode/command`）
- 无硬编码，由 AIRegistry 的 configTemplate 驱动。init-skeleton 仅负责创建 _bmad-output 骨架，同步逻辑完全在 SyncService。

## §5 验收标准

1. init-skeleton.js 中 copyDir 不再包含 `.cursor`、`.claude` 字面量。
2. `node --test packages/bmad-speckit/tests/sync-service.test.js` 全部通过。
3. `node packages/bmad-speckit/tests/e2e/init-e2e.test.js` 中 E12-S2、E10-S5 相关用例通过。
4. grep 确认 `init-skeleton.js` 无 `generateWorktreeSkeleton` 且无 `.cursor`/`.claude` 硬编码。

## §7 任务列表

| ID | 修改路径 | 修改内容 | 验收标准 |
|----|----------|----------|----------|
| T1 | packages/bmad-speckit/src/commands/init-skeleton.js | 第 32 行：将 `if (opts.skipHidden && e.name.startsWith('.') && e.name !== '.cursor' && e.name !== '.claude') return;` 改为 `if (opts.skipHidden && e.name.startsWith('.')) return;` | 文件无 .cursor、.claude 硬编码；sync-service.test.js 10 用例通过；init-e2e 中 E12-S2、E10-S5 相关用例通过 |
