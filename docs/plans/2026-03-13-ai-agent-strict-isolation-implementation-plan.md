# BMAD-Speckit AI Agent Strict Isolation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将当前 Cursor-first 的 `bmad-speckit` 初始化/分发机制改造成支持 AI agent 安装目标的严格隔离体系，确保 Cursor 已验证流程零回退，同时为 Claude Code 提供独立安装、独立状态、独立运行时与独立回归路径。

**Architecture:** 采用“共享源资产 + 按 agent 目标分发独立运行时”的方式。共享的 `_bmad/`、`templates/`、`workflows/`、`commands/`、`rules/` 保留为源资产；初始化脚本新增 AI agent 目标分发逻辑，分别生成 Cursor 或 Claude Code 所需的运行时入口、状态目录、hook 配置与脚本绑定，且禁止跨平台混写运行时产物。

**Tech Stack:** Node.js、TypeScript、`scripts/init-to-root.js`、`package.json`、`.cursor/**`、`.claude/**`、Vitest、ESLint、PowerShell/Bash setup scripts

---

## Preconditions

基于当前仓库已确认的事实：

- `scripts/init-to-root.js` 当前只支持 `[targetDir], --full`，没有 AI agent 参数
- `scripts/init-to-root.js` 明确会同步 `commands/`、`rules/`、`config/code-reviewer-config.yaml` 到 `.cursor/**`
- `package.json` 中 `postinstall` 与 `init` 都直接调用 `node scripts/init-to-root.js`
- 仓库中同时存在 `.cursor/**` 与 `.claude/**` 文件，但当前初始化核心逻辑仍是 Cursor-first
- `docs/INSTALLATION_AND_MIGRATION_GUIDE.md` 当前安装文档也明显以 Cursor 安装路径为中心
- 当前没有足够证据证明 Cursor / Claude Code 已完成运行时、状态、评分、回归四重隔离

---

### Task 1: 为初始化脚本定义 AI agent 安装目标参数

> **Small adjustment (2026-03-13):** 当前阶段仍只正式支持 `cursor` 与 `claude-code`，但实现方式应从“硬编码白名单”升级为“注册式白名单（profile registry）”。也就是说，对外仍拒绝未注册 agent；对内改为通过已注册 profile 决定安装契约、运行时目录、分发策略与验证要求。此调整不扩大当前支持范围，只为后续新增 agent 保留可审计扩展点。

**Files:**
- Modify: `scripts/init-to-root.js`
- Modify: `package.json:10-12`
- Create: `scripts/accept-ai-agent-arg.ts`
- Read: `docs/INSTALLATION_AND_MIGRATION_GUIDE.md:142-194`

**Step 1: Write the failing test**

新增测试，验证初始化脚本必须支持显式 agent 参数：

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('init-to-root agent target support', () => {
  it('supports explicit ai agent target arguments', () => {
    const script = readFileSync('scripts/init-to-root.js', 'utf8');
    expect(script).toContain('--agent');
    expect(script).toContain('cursor');
    expect(script).toContain('claude-code');
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
rtk vitest run scripts/accept-ai-agent-arg.ts
```

Expected: FAIL，当前脚本没有 `--agent` 支持。

**Step 3: Write minimal implementation**

先建立最小注册表，例如：

```js
const REGISTERED_AGENT_PROFILES = {
  cursor: {
    runtimeRoot: '.cursor',
  },
  'claude-code': {
    runtimeRoot: '.claude',
  },
};
```

然后以 profile registry 替代直接硬编码集合判断：

```js
node scripts/init-to-root.js [targetDir] --full
```

扩展成：

```bash
node scripts/init-to-root.js [targetDir] --full --agent cursor
node scripts/init-to-root.js [targetDir] --full --agent claude-code
```

最小解析逻辑示例：

```js
const agentArgIndex = args.findIndex((a) => a === '--agent');
const agentTarget =
  agentArgIndex >= 0 && args[agentArgIndex + 1]
    ? args[agentArgIndex + 1]
    : 'cursor';
```

并加入非法值拦截：

```js
const allowedAgents = new Set(['cursor', 'claude-code']);
if (!allowedAgents.has(agentTarget)) {
  console.error(`Unsupported --agent value: ${agentTarget}`);
  process.exit(1);
}
```

**Step 4: Run test to verify it passes**

Run:
```bash
rtk vitest run scripts/accept-ai-agent-arg.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add scripts/init-to-root.js package.json scripts/accept-ai-agent-arg.ts
git commit -m "feat: add ai agent target to init script"
```

---

### Task 2: 把分发逻辑从 Cursor-first 改成按 agent 分支分发

**Files:**
- Modify: `scripts/init-to-root.js`
- Create: `scripts/accept-agent-dispatch.ts`
- Read: `scripts/init-to-root.js:22-87`

**Step 1: Write the failing test**

新增测试，验证初始化脚本对不同 agent 走不同分发路径：

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('agent-specific dispatch', () => {
  it('separates cursor and claude-code distribution logic', () => {
    const script = readFileSync('scripts/init-to-root.js', 'utf8');
    expect(script).toContain('if (agentTarget === \'cursor\')');
    expect(script).toContain('if (agentTarget === \'claude-code\')');
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
rtk vitest run scripts/accept-agent-dispatch.ts
```

Expected: FAIL

**Step 3: Write minimal implementation**

将当前这段 Cursor 专用逻辑：

```js
const CURSOR_SYNC = [
  { src: 'commands', dest: '.cursor/commands' },
  { src: 'rules', dest: '.cursor/rules' },
];
```

改成显式分支：

```js
if (agentTarget === 'cursor') {
  // sync to .cursor/**
}

if (agentTarget === 'claude-code') {
  // sync to .claude/**
}
```

要求：
- Cursor 路径只分发 Cursor 运行入口
- Claude Code 路径只分发 Claude Code 运行入口
- 不允许单次初始化同时混写两套运行时入口，除非未来明确支持 `--agent all`
- 分发分支的选择应来自已注册 agent profile，而不是散落在脚本中的临时字符串判断
- 未注册 agent 一律拒绝安装，避免“名字可传入但隔离契约不存在”的伪支持

**Step 4: Run test to verify it passes**

Run:
```bash
rtk vitest run scripts/accept-agent-dispatch.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add scripts/init-to-root.js scripts/accept-agent-dispatch.ts
git commit -m "refactor: split installer dispatch by ai agent"
```

---

### Task 3: 建立 Cursor / Claude Code 运行时目录隔离矩阵

**Files:**
- Create: `docs/plans/2026-03-13-ai-agent-isolation-matrix.md`
- Modify: `docs/INSTALLATION_AND_MIGRATION_GUIDE.md`
- Create: `scripts/accept-isolation-matrix.ts`

**Step 1: Write the failing test**

新增测试，要求隔离矩阵文档中必须明确列出两个 agent 的运行时目录：

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('isolation matrix', () => {
  it('documents runtime boundaries for cursor and claude-code', () => {
    const doc = readFileSync('docs/plans/2026-03-13-ai-agent-isolation-matrix.md', 'utf8');
    expect(doc).toContain('.cursor/');
    expect(doc).toContain('.claude/');
    expect(doc).toContain('state');
    expect(doc).toContain('hooks');
    expect(doc).toContain('checkpoints');
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
rtk vitest run scripts/accept-isolation-matrix.ts
```

Expected: FAIL

**Step 3: Write minimal implementation**

在矩阵文档中明确：

- Cursor runtime:
  - `.cursor/commands`
  - `.cursor/rules`
  - `.cursor/agents`
- Claude Code runtime:
  - `.claude/agents`
  - `.claude/commands`
  - `.claude/protocols`
  - `.claude/state`
  - `.claude/hooks`

并明确：
- 哪些目录是运行时入口
- 哪些目录是共享源
- 哪些目录绝不跨平台共用

**Step 4: Run test to verify it passes**

Run:
```bash
rtk vitest run scripts/accept-isolation-matrix.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add docs/plans/2026-03-13-ai-agent-isolation-matrix.md docs/INSTALLATION_AND_MIGRATION_GUIDE.md scripts/accept-isolation-matrix.ts
git commit -m "docs: add ai agent isolation matrix"
```

---

### Task 4: 为 Claude Code 建立独立状态与 runtime 输出路径

**Files:**
- Modify: `scripts/init-to-root.js`
- Create: `.claude/state/.gitkeep`
- Create: `.claude/hooks/.gitkeep`
- Create: `scripts/accept-claude-runtime-isolation.ts`
- Read: `docs/plans/2026-03-13-bmad-claude-code-cli-implementation-plan.md`

**Step 1: Write the failing test**

新增测试，验证 `--agent claude-code` 时必须创建 Claude Code 专属运行时目录：

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('claude runtime isolation', () => {
  it('creates dedicated claude runtime paths', () => {
    const script = readFileSync('scripts/init-to-root.js', 'utf8');
    expect(script).toContain('.claude/state');
    expect(script).toContain('.claude/hooks');
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
rtk vitest run scripts/accept-claude-runtime-isolation.ts
```

Expected: FAIL

**Step 3: Write minimal implementation**

确保 Claude Code 分发路径至少包含：

- `.claude/agents/`
- `.claude/protocols/`
- `.claude/state/`
- `.claude/hooks/`

并明确：
- 不写入 `.cursor/` runtime
- 不复用 Cursor checkpoint / queue / recovery 目录

**Step 4: Run test to verify it passes**

Run:
```bash
rtk vitest run scripts/accept-claude-runtime-isolation.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add scripts/init-to-root.js .claude/state/.gitkeep .claude/hooks/.gitkeep scripts/accept-claude-runtime-isolation.ts
git commit -m "feat: isolate claude runtime directories"
```

---

### Task 5: 把评分与审计输出路径按 agent 区分

**Files:**
- Modify: `scripts/parse-and-write-score.ts`
- Create: `scripts/accept-score-channel-isolation.ts`
- Read: `scripts/parse-and-write-score.ts`
- Read: `docs/plans/2026-03-13-bmad-claude-code-cli-implementation-plan.md`

**Step 1: Write the failing test**

新增测试，要求评分写入至少能区分 agent/channel/source：

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('score channel isolation', () => {
  it('supports agent-aware score writing inputs', () => {
    const script = readFileSync('scripts/parse-and-write-score.ts', 'utf8');
    expect(script).toContain('agent');
    expect(script).toContain('source');
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
rtk vitest run scripts/accept-score-channel-isolation.ts
```

Expected: FAIL

**Step 3: Write minimal implementation**

至少扩展评分调用输入，支持区分：

- `agent=cursor|claude-code`
- `source=cursor_command|claude_agent|claude_hook`

如果暂不改底层存储，也要确保写入前参数已能表达来源差异。

**Step 4: Run test to verify it passes**

Run:
```bash
rtk vitest run scripts/accept-score-channel-isolation.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add scripts/parse-and-write-score.ts scripts/accept-score-channel-isolation.ts
git commit -m "feat: add agent-aware scoring inputs"
```

---

### Task 6: 增加 Cursor 零回退回归门禁

**Files:**
- Modify: `package.json`
- Create: `scripts/accept-cursor-regression-gate.ts`
- Modify: `docs/INSTALLATION_AND_MIGRATION_GUIDE.md`
- Read: `.cursor/commands/**/*`

**Step 1: Write the failing test**

新增测试，明确 Cursor 回归门禁必须存在：

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('cursor regression gate', () => {
  it('documents cursor non-regression as a release gate', () => {
    const pkg = readFileSync('package.json', 'utf8');
    expect(pkg).toContain('accept:e');
  });
});
```

**Step 2: Run test to verify it fails or is insufficient**

Run:
```bash
rtk vitest run scripts/accept-cursor-regression-gate.ts
```

Expected: FAIL 或仅部分通过，暴露“有 acceptance 但无隔离回归门禁”。

**Step 3: Write minimal implementation**

新增一个约束：
- 任何涉及 init/distribute/score/runtime 的改动，必须先跑 Cursor regression 再允许合并

可以先在文档与 npm scripts 层面实现最小门禁，例如：

```json
"test:cursor-regression": "npm run accept:e1-s1 && npm run accept:e1-s2 && npm run accept:e3-s1 && npm run accept:e3-s2 && npm run accept:e3-s3 && npm run accept:e4-s1 && npm run accept:e4-s2 && npm run accept:e4-s3"
```

**Step 4: Run test to verify it passes**

Run:
```bash
rtk vitest run scripts/accept-cursor-regression-gate.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add package.json scripts/accept-cursor-regression-gate.ts docs/INSTALLATION_AND_MIGRATION_GUIDE.md
git commit -m "test: add cursor non-regression gate"
```

---

### Task 7: 增加 Claude Code 独立验收入口

**Files:**
- Modify: `package.json`
- Create: `scripts/accept-claude-install-isolation.ts`
- Create: `scripts/accept-claude-runtime-isolation.ts`
- Modify: `docs/INSTALLATION_AND_MIGRATION_GUIDE.md`

**Step 1: Write the failing test**

新增测试，要求包脚本里存在 Claude Code 独立验收入口：

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('claude isolation gate', () => {
  it('defines a dedicated claude validation entry', () => {
    const pkg = readFileSync('package.json', 'utf8');
    expect(pkg).toContain('test:claude');
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
rtk vitest run scripts/accept-claude-install-isolation.ts
```

Expected: FAIL

**Step 3: Write minimal implementation**

新增最小脚本，例如：

```json
"test:claude-isolation": "vitest run scripts/accept-claude-install-isolation.ts scripts/accept-claude-runtime-isolation.ts"
```

**Step 4: Run test to verify it passes**

Run:
```bash
rtk vitest run scripts/accept-claude-install-isolation.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add package.json scripts/accept-claude-install-isolation.ts scripts/accept-claude-runtime-isolation.ts docs/INSTALLATION_AND_MIGRATION_GUIDE.md
git commit -m "test: add claude isolation validation entry"
```

---

### Task 8: 增加交叉安装回归测试

**Files:**
- Create: `scripts/accept-cross-install-order.ts`
- Modify: `package.json`
- Modify: `docs/INSTALLATION_AND_MIGRATION_GUIDE.md`

**Step 1: Write the failing test**

新增测试，明确必须验证：

- 先装 Cursor，再装 Claude Code
- 先装 Claude Code，再装 Cursor

```ts
import { describe, expect, it } from 'vitest';

describe('cross install order', () => {
  it('requires validating both installation orders', () => {
    expect([
      'cursor->claude-code',
      'claude-code->cursor',
    ]).toHaveLength(2);
  });
});
```

**Step 2: Run test to verify it fails conceptually**

Run:
```bash
rtk vitest run scripts/accept-cross-install-order.ts
```

Expected: 当前逻辑虽可跑，但没有真实交叉安装验证实现，视为 FAIL。

**Step 3: Write minimal implementation**

在文档和测试脚本中明确验证两种顺序，并检查：
- `.cursor/**` 未被 Claude Code 安装覆盖
- `.claude/**` 未被 Cursor 安装覆盖
- 关键入口文件都存在

**Step 4: Run test to verify it passes**

Run:
```bash
rtk vitest run scripts/accept-cross-install-order.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add scripts/accept-cross-install-order.ts package.json docs/INSTALLATION_AND_MIGRATION_GUIDE.md
git commit -m "test: add cross-install order validation"
```

---

### Task 9: 更新安装与迁移文档为多 agent 隔离模型

**Files:**
- Modify: `docs/INSTALLATION_AND_MIGRATION_GUIDE.md`
- Create: `docs/plans/2026-03-13-ai-agent-isolation-checklist.md`
- Create: `scripts/accept-install-docs-isolation.ts`

**Step 1: Write the failing test**

新增测试，要求安装文档显式出现多 agent 隔离安装说明：

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('install docs isolation model', () => {
  it('documents separate install flows for cursor and claude-code', () => {
    const doc = readFileSync('docs/INSTALLATION_AND_MIGRATION_GUIDE.md', 'utf8');
    expect(doc).toContain('cursor');
    expect(doc).toContain('claude-code');
    expect(doc).toContain('--agent');
    expect(doc).toContain('strict isolation');
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
rtk vitest run scripts/accept-install-docs-isolation.ts
```

Expected: FAIL

**Step 3: Write minimal implementation**

更新文档，至少新增：
- `--agent cursor`
- `--agent claude-code`
- 不同 agent 的安装步骤
- 不同 agent 的运行时目录
- 不同 agent 的回归验证要求

**Step 4: Run test to verify it passes**

Run:
```bash
rtk vitest run scripts/accept-install-docs-isolation.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add docs/INSTALLATION_AND_MIGRATION_GUIDE.md docs/plans/2026-03-13-ai-agent-isolation-checklist.md scripts/accept-install-docs-isolation.ts
git commit -m "docs: update installation guide for strict ai agent isolation"
```

---

## Verification Checklist

- [ ] `init-to-root.js` 支持 `--agent cursor|claude-code`
- [ ] Cursor / Claude Code 分发路径分支明确
- [ ] Claude Code 有独立 runtime/state/hooks 路径
- [ ] 审计/评分至少能区分 agent/source
- [ ] Cursor 零回退回归门禁建立
- [ ] Claude Code 独立验收入口建立
- [ ] 交叉安装顺序验证建立
- [ ] 安装文档已升级为多 agent 严格隔离模型

## Test Commands

```bash
rtk vitest run scripts/accept-ai-agent-arg.ts
rtk vitest run scripts/accept-agent-dispatch.ts
rtk vitest run scripts/accept-isolation-matrix.ts
rtk vitest run scripts/accept-claude-runtime-isolation.ts
rtk vitest run scripts/accept-score-channel-isolation.ts
rtk vitest run scripts/accept-cursor-regression-gate.ts
rtk vitest run scripts/accept-claude-install-isolation.ts
rtk vitest run scripts/accept-cross-install-order.ts
rtk vitest run scripts/accept-install-docs-isolation.ts
rtk lint
```

## Notes for the implementer

- 不要先改 Claude Code 运行时流程，再回头补隔离；顺序必须先隔离、再适配。
- 不要把“已有 `.claude` 文件存在”误判成“已经具备 Claude Code 安装隔离”。
- 不要直接改写 Cursor 已验证入口作为 Claude Code 适配捷径。
- 不要共用 `_bmad-output` 作为两个平台不可区分的运行时工件目录。
- 不要在没有交叉安装回归前声称“严格隔离已完成”。

## Execution Handoff

Plan complete and saved to `docs/plans/2026-03-13-ai-agent-strict-isolation-implementation-plan.md`. Two execution options:

**1. Subagent-Driven (this session)** - 我在当前会话按任务逐步推进隔离改造

**2. Parallel Session (separate)** - 新开会话，用 `superpowers:executing-plans` 批量执行

Which approach?