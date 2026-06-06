# 消费项目安装指南

本文档只面向“消费项目”的实际安装与接线，不假设你正在修改本仓库本身。

适用场景：

- 你有一个现有项目，想把 BMAD-Speckit-SDD-Flow 安装进去
- 你需要在该项目里启用 Cursor / Claude Code / Codex 运行时
- 你需要继续配置 provider 的 `baseUrl` / `apiKeyEnv` / `model`
- 你希望确认 hooks、dashboard 与主 Agent 编排入口是否完整

不适用场景：

- 修改本仓库源码或开发安装器本身
- 只想阅读 BMAD 方法论，不打算落地到消费项目

## 结论先说

如果你的目标是“把一套可运行的 BMAD/Speckit 能力装进一个消费项目”，当前最可执行的路径是：

1. 把 `bmad-speckit-sdd-flow` 安装为消费项目本地依赖。
2. 用 `npx --no-install bmad-speckit ...` 调用项目本地 CLI。
3. 显式运行 `bmad-speckit init ...`，只生成你需要的 AI 宿主安装面。
4. 按需要补充 Cursor / Claude / Codex 的运行时配置。
5. 如果要启用治理 provider，显式配置 `_bmad/_config/governance-remediation.yaml`。
6. 最后执行最小验证命令，确认本地 shim、hooks、dashboard 与主 Agent 主链都可用。

补充说明：

- `dashboard` 属于默认支持能力
- `runtime-mcp` 属于增强能力，需要显式开关 `--with-mcp` 启用，不属于默认安装产物
- 默认安装命令建议带 `--ignore-scripts`，避免 npm `postinstall` 在你显式选择 AI 宿主前先写入默认安装面

---

## 最高优先级：另一台没有本仓库源码的机器

这是当前文档里必须优先考虑的场景：

- 目标机器上**没有** `BMAD-Speckit-SDD-Flow` 仓库
- 你要把本仓库的定制能力装进一个消费项目
- 你需要的不是“可能可用”，而是**已验证的安装路径**

当前最高置信安装方式是：先把包持久安装到消费项目，再显式 init。

```powershell
cd <consumer-root>
npm install --save-dev --ignore-scripts bmad-speckit-sdd-flow@latest
npm ls bmad-speckit-sdd-flow --depth=0
node -e "const fs=require('node:fs'); const p=process.platform==='win32'?'node_modules/.bin/bmad-speckit.cmd':'node_modules/.bin/bmad-speckit'; if(!fs.existsSync(p)){console.error('missing project-local '+p); process.exit(1)} console.log('found '+p)"
npx --no-install bmad-speckit version
npx --no-install bmad-speckit init . --ai claude,cursor-agent,codex --yes --force
npx --no-install bmad-speckit check
npx --no-install bmad-speckit dashboard-status
npx --no-install bmad-speckit bmads
```

如果你验证的是本地 CI artifact 或 release candidate，把第一条安装命令换成：

```powershell
npm install --save-dev --ignore-scripts .\bmad-speckit-sdd-flow-<version>.tgz
```

这条路径是**项目本地安装**：

- 会写入 `node_modules`
- 会更新 `package.json`
- 会更新 lockfile
- 会把后续生成 skills 需要的 runtime 固定到消费项目本地
- 不会在安装依赖阶段运行 package lifecycle scripts

如果目标是已有业务应用仓库，这应当是 off-repo 场景下的最高优先级默认方案。它的核心验收标准是：在没有 clone `BMAD-Speckit-SDD-Flow` 的机器上，只安装发布包后，公开 CLI/runtime 仍能运行。

这条路径对应的仓库内验证证据是：

- `tests/acceptance/accept-root-package-bmad-speckit-bin.test.ts`
- `tests/acceptance/accept-install-consumer-cli.test.ts`

反过来，下面这条：

```powershell
npx --yes --package bmad-speckit-sdd-flow bmad-speckit init . --ai cursor-agent --yes
```

在本文里只应被视为：

- 一次性 CLI 执行
- smoke test 或 CI artifact 检查
- 临时 bootstrap 入口
- **不是** 长期生成 skill runtime 的稳定安装方式

---

## 当前 accepted runtime path

当前正式运行路径已经收敛为：

1. 用户在 Cursor / Claude Code / Codex 等宿主会话中输入 `$bmad-speckit`、`/bmad-speckit` 或 `bmad-speckit`
2. 主 Agent 内部执行或等价消费 Main Agent control plane 的 `inspect`
3. 必要时主 Agent 内部执行或等价消费 `dispatch-plan`
4. 主 Agent 只从 `requirement-record.json`、`currentMentalModel`、六个心智模型链路和 controlled ingest 记录推导下一步
5. 子代理只执行 bounded work，不决定全局分支
6. 主 Agent 回读受控记录、当前 hash、当前 attempt 和 child result，决定下一步
7. `runAuditorHost` 只负责 post-audit close-out 证据收口，不能替代交付确认

以下内容不再是当前 accepted runtime path 的成功标准：

- 要求普通消费用户手动执行 `npm run main-agent-orchestration` 或 `npx bmad-speckit main-agent-orchestration ...`
- `background worker` 自动吃队列
- queue 自动从 `pending` 推进到 `done`
- autonomous fallback execution
- 把 `<consumer>/scripts/governance-runtime-worker.*` 当成正式运行入口

---

## 当前必须明确的安装事实

### 1. 消费项目根目录不是正式治理运行入口

当前设计下，消费项目**不应该**依赖根目录 `scripts/` 作为 interactive runtime governance 主运行面。换句话说，下面这种路径即使缺失，也**不是**当前 accepted path 的 bug：

- `<consumer>/scripts/governance-runtime-worker.*`
- `<consumer>/scripts/governance-remediation-runner.*`

interactive 模式下真正应该出现并被优先消费的是：

- `<consumer>/_bmad/runtime/hooks/runtime-policy-inject-core.cjs`
- `<consumer>/_bmad/runtime/hooks/pre-continue-check.cjs`
- `<consumer>/.claude/hooks/runtime-policy-inject.cjs`
- `<consumer>/.claude/hooks/pre-continue-check.cjs`
- `<consumer>/.cursor/hooks/runtime-policy-inject.cjs`
- `<consumer>/.cursor/hooks/pre-continue-check.cjs`

### 2. 仅完成依赖安装，不等于宿主安装面已全部对齐

当前最稳妥的消费项目安装链分两步：

1. 用 `npm install --save-dev --ignore-scripts ...` 安装项目本地依赖
2. 用 `npx --no-install bmad-speckit init ...` 显式生成目标宿主安装面

示例：

```powershell
cd <consumer-root>
npm install --save-dev --ignore-scripts bmad-speckit-sdd-flow@latest
npx --no-install bmad-speckit init . --ai claude,cursor-agent,codex --yes --force
```

如果只做依赖安装而没有显式执行第 2 步，你只能证明包已经进入项目本地 `node_modules`，不能证明 `.claude`、`.cursor`、`.codex`、hooks、skills 和 `_bmad` 安装面已经按目标宿主同步完成。

### 3. `npx` 要区分“临时执行”与“项目本地运行时”

- `npx --yes --package bmad-speckit-sdd-flow bmad-speckit init . --ai cursor-agent --yes`
  - 适合一次性 CLI 执行、smoke test、CI artifact 检查或临时 bootstrap
  - 不会把 runtime 依赖持久安装进消费项目
  - 不适合作为长期生成 skill runtime

- `npm install --save-dev --ignore-scripts bmad-speckit-sdd-flow@latest` 之后执行 `npx --no-install bmad-speckit init ...`
  - 是当前推荐的消费者安装态对齐路径
  - 可以固定项目本地 runtime 版本
  - 可以让生成后的 skills 后续继续调用同一个项目本地 CLI

---

## 安装路径选择

### 路径 A：推荐，registry 项目本地安装

```powershell
cd <consumer-root>
npm install --save-dev --ignore-scripts bmad-speckit-sdd-flow@latest
npm ls bmad-speckit-sdd-flow --depth=0
node -e "const fs=require('node:fs'); const p=process.platform==='win32'?'node_modules/.bin/bmad-speckit.cmd':'node_modules/.bin/bmad-speckit'; if(!fs.existsSync(p)){console.error('missing project-local '+p); process.exit(1)} console.log('found '+p)"
npx --no-install bmad-speckit init . --ai claude,cursor-agent,codex --yes --force
npx --no-install bmad-speckit check
npx --no-install bmad-speckit dashboard-status
npx --no-install bmad-speckit bmads
```

### 路径 B：推荐，tgz 项目本地安装

```powershell
cd <consumer-root>
npm install --save-dev --ignore-scripts .\bmad-speckit-sdd-flow-<version>.tgz
npm ls bmad-speckit-sdd-flow --depth=0
node -e "const fs=require('node:fs'); const p=process.platform==='win32'?'node_modules/.bin/bmad-speckit.cmd':'node_modules/.bin/bmad-speckit'; if(!fs.existsSync(p)){console.error('missing project-local '+p); process.exit(1)} console.log('found '+p)"
npx --no-install bmad-speckit init . --ai claude,cursor-agent,codex --yes --force
npx --no-install bmad-speckit check
npx --no-install bmad-speckit dashboard-status
npx --no-install bmad-speckit bmads
```

这条路径会修改 `node_modules`、`package.json` 和 lockfile，适合在真实消费项目中验证 CI artifact 或 release candidate。

### 路径 C：临时 tgz 执行

```powershell
npx --yes --package .\bmad-speckit-sdd-flow-<version>.tgz bmad-speckit version
npx --yes --package .\bmad-speckit-sdd-flow-<version>.tgz bmad-speckit check
npx --yes --package .\bmad-speckit-sdd-flow-<version>.tgz bmad-speckit init . --ai codex --yes --force
```

这条路径不会把 runtime 依赖持久安装到消费项目，因此只适合 smoke test、CI artifact 检查或一次性 bootstrap。

### 路径 D：源码仓库维护者部署

```powershell
pwsh scripts/setup.ps1 -Target <消费项目根目录> -Full
```

或者：

```powershell
node scripts/init-to-root.js <消费项目根目录> --agent cursor --full
node scripts/init-to-root.js <消费项目根目录> --agent claude-code --full
```

这条路径要求你已经 clone 本仓库，适合源码维护、调试和安装器开发。普通消费项目不应依赖它，因为目标机器可能没有本仓库源码。

### 路径 E：全局安装（不推荐用于受治理项目）

全局安装只适合作为受治理项目外的人工操作便利。它不会把 runtime 版本固定到消费项目，也不能证明项目本地 `node_modules/.bin/bmad-speckit` 存在。

如果生成后的 skills 依赖 `npx --no-install bmad-speckit ...`，全局安装不能替代项目本地依赖。只用全局命令做验证还可能掩盖本地依赖缺失。

---

## 安装后应该出现什么

至少应出现以下目录或文件：

```text
<consumer-root>/
├─ _bmad/
├─ _bmad-output/
├─ .cursor/
├─ .claude/
├─ .codex/
│  └─ skills/
├─ specs/
└─ package.json        # 非 Node 项目可选
```

`.claude/`、`.cursor/` 和 `.codex/skills/` 是否全部出现，取决于你在 `bmad-speckit init ... --ai ...` 中选择了哪些宿主。上面的树对应推荐的三宿主示例：`--ai claude,cursor-agent,codex`。

---

## 最小复验命令列表

```powershell
cd <consumer-root>

# 1. project-local runtime dependency and shim
npm ls bmad-speckit-sdd-flow --depth=0
node -e "const fs=require('node:fs'); const p=process.platform==='win32'?'node_modules/.bin/bmad-speckit.cmd':'node_modules/.bin/bmad-speckit'; if(!fs.existsSync(p)){console.error('missing project-local '+p); process.exit(1)} console.log('found '+p)"

# 2. 显式对齐目标宿主安装面
npx --no-install bmad-speckit init . --ai claude,cursor-agent,codex --yes --force

# 3. 基础骨架
pwsh _bmad\speckit\scripts\powershell\check-prerequisites.ps1 -PathsOnly

# 4. CLI 是否可用
npx --no-install bmad-speckit check

# 5. installed host assets and internal control plane availability
Test-Path .codex\skills
Test-Path .claude\hooks\runtime-policy-inject.cjs
Test-Path .claude\hooks\pre-continue-check.cjs
Test-Path .cursor\hooks\runtime-policy-inject.cjs
Test-Path .cursor\hooks\pre-continue-check.cjs
node -e "const fs=require('node:fs'); const manifest='_bmad-output/config/bmad-speckit-install-manifest.json'; if(!fs.existsSync(manifest)){console.error('missing '+manifest); process.exit(1)} const data=JSON.parse(fs.readFileSync(manifest,'utf8')); for (const tool of ['claude-code','cursor','codex']){ if(!Array.isArray(data.installed_tools)||!data.installed_tools.includes(tool)){ console.error('install manifest missing '+tool); process.exit(1); } } console.log('install manifest includes claude-code, cursor, codex')"
```

判定规则：

- 第 1 步必须证明项目本地依赖和 `.bin` shim 都存在
- 第 2 步必须无报错
- 第 3、4 步必须成功
- 第 5 步所有 `Test-Path` 都应返回 `True`，manifest 检查必须包含 `claude-code`、`cursor`、`codex`
- 普通消费用户应在宿主会话中使用 `$bmad-speckit`、`/bmad-speckit` 或 `bmad-speckit` 激活主控

安装验证、CI、debug 或 no-skill fallback 场景可以直接验证 stable package-local Main Agent runtime：

```powershell
npx --no-install bmad-speckit main-agent inspect --cwd . --json
```

必要时验证：

```powershell
npx --no-install bmad-speckit main-agent dispatch-plan --cwd . --json
```

`main-agent-orchestration` 仍是兼容 CLI 面，适合排查 legacy action 或迁移过渡问题：

```powershell
npx --no-install bmad-speckit main-agent-orchestration --cwd . --action inspect --json
npx --no-install bmad-speckit main-agent-orchestration --cwd . --action dispatch-plan --json
```

`bmad-speckit-init` 仍是兼容别名。新文档、生成后的 skills 和集成脚本应优先使用 `bmad-speckit init ...`。

---

## Dashboard 与排障

dashboard 可以作为安装校验或排障 fallback，但：

- 它**不代表治理或 post-audit 主路径需要人工触发**
- 它也**不代表**主 Agent 编排本身已经成功

相关命令：

```bash
npx --no-install bmad-speckit dashboard-start --open
npx --no-install bmad-speckit dashboard-status
npx --no-install bmad-speckit dashboard-stop
```

---

## Hook 提示开关

如果你希望本项目 hooks 在执行时把提示信息直接打印出来，可以打开：

```json
{
  "env": {
    "BMAD_HOOKS_VERBOSE": "1"
  }
}
```

推荐放置位置：

- Claude Code：`<consumer>/.claude/settings.json`
- 或宿主等效的项目级环境配置

当前语义：

- `BMAD_HOOKS_VERBOSE=0`
  - 默认静默，只保留必要 hook 结果
- `BMAD_HOOKS_VERBOSE=1`
  - 输出 hook 级提示，包括：
    - `pre-continue-check passed`
    - `pre-continue-check failed`
    - `pre-continue-check skipped: artifact self write`
    - `runtime-policy-inject` blocked-flow / handoff 相关提示

这能帮助你快速判断：

1. hook 是否真的被调用
2. 是否因为 self-write 被主动跳过
3. 是否真的命中了 continue gate 或 implementation-entry gate

---

## 推荐阅读顺序

1. 本文：消费者安装主路径
2. [migration.md](./migration.md)
3. [cursor-setup.md](./cursor-setup.md) 或 [claude-code-setup.md](./claude-code-setup.md)
4. [runtime-dashboard-stable-launcher.md](./runtime-dashboard-stable-launcher.md)
5. [provider-configuration.md](./provider-configuration.md)
6. [consumer-packaging-troubleshooting.md](./consumer-packaging-troubleshooting.md)

---

## 审计结论

现在这篇文档的职责很明确：

- 讲清楚消费项目**怎么装**
- 讲清楚当前 accepted runtime path **是什么**
- 讲清楚哪些旧 worker / background 口径**已经不再是当前成功标准**

如果你要的是 dashboard 观测、provider 配置或人工排障，这些仍然支持。  
但它们都不改变当前唯一 accepted runtime path：

> 主 Agent 读取 state、消费 packet、调度子代理、回写结果、决定下一步，直到 closeout。
