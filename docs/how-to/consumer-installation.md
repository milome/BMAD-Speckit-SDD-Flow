# 消费项目安装指南

本文档只面向“消费项目”的实际安装与接线，不假设你正在修改本仓库本身。

适用场景：

- 你有一个现有项目，想把 BMAD-Speckit-SDD-Flow 安装进去
- 你需要在该项目里启用 Cursor / Claude Code 运行时
- 你需要继续配置 provider 的 `baseUrl` / `apiKeyEnv` / `model`
- 你希望确认 hooks、dashboard 与主 Agent 编排入口是否完整

不适用场景：

- 修改本仓库源码或开发安装器本身
- 只想阅读 BMAD 方法论，不打算落地到消费项目

## 结论先说

如果你的目标是“把一套可运行的 BMAD/Speckit 能力装进一个消费项目”，当前最可执行的路径是：

1. 用 `setup.ps1` 或 `init-to-root.js` 把 `_bmad`、`.cursor`、`.claude` 等骨架部署到消费项目
2. 按需要补充 Cursor / Claude 的运行时配置
3. 如果要启用治理 provider，显式配置 `_bmad/_config/governance-remediation.yaml`
4. 最后执行最小验证命令，确认 hooks、dashboard 与主 Agent 主链都可用

补充说明：

- `dashboard` 属于默认支持能力
- `runtime-mcp` 属于增强能力，需要显式开关 `--with-mcp` 启用，不属于默认安装产物

---

## 最高优先级：另一台没有本仓库源码的机器

这是当前文档里必须优先考虑的场景：

- 目标机器上**没有** `BMAD-Speckit-SDD-Flow` 仓库
- 你要把本仓库的定制能力装进一个消费项目
- 你需要的不是“可能可用”，而是**已验证的安装路径**

当前文档中，**已验证** 的 off-repo 安装方式是：

```powershell
cd <consumer-root>
npx --yes --package .\bmad-speckit-sdd-flow-<version>.tgz bmad-speckit version
npx --yes --package .\bmad-speckit-sdd-flow-<version>.tgz bmad-speckit check
npx --yes --package .\bmad-speckit-sdd-flow-<version>.tgz bmad-speckit-init . --agent claude-code --full --no-package-json
npx --yes --package .\bmad-speckit-sdd-flow-<version>.tgz bmad-speckit-init . --agent cursor --full --no-package-json
```

这条路径是**非侵入式安装**：

- 不会把 `bmad-speckit-sdd-flow` 写入消费项目 `package.json`
- 不会重写消费项目 `package-lock.json`
- 只部署 install surface（如 `_bmad`、`.claude`、`.cursor`、`_bmad-output`）

如果目标是已有业务应用仓库，这应当是 off-repo 场景下的最高优先级默认方案。

这条路径对应的仓库内验证证据是：

- `tests/acceptance/accept-root-package-bmad-speckit-bin.test.ts`
- `tests/acceptance/accept-install-consumer-cli.test.ts`

反过来，下面这条：

```powershell
npx --yes --package bmad-speckit-sdd-flow bmad-speckit init . --ai cursor-agent --yes
```

在本文里只应被视为：

- 上游 bootstrap / 快速初始化入口
- **不是** 本仓库定制能力在 off-repo 场景下的最高优先级默认方案

---

## 当前 accepted runtime path

当前正式运行路径已经收敛为：

1. 宿主 hook 写入 `orchestration_state` 与 `pending_packet`
2. 主 Agent 执行 `npm run main-agent-orchestration -- --cwd <project-root> --action inspect`
3. 必要时主 Agent 执行 `npm run main-agent-orchestration -- --cwd <project-root> --action dispatch-plan`
4. 主 Agent claim / dispatch bounded packet
5. 子代理只执行 bounded work
6. 主 Agent 回读 state / packet / child result，决定下一步
7. `runAuditorHost` 只负责 post-audit close-out

以下内容不再是当前 accepted runtime path 的成功标准：

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

### 2. 仅完成 npm 安装，不等于两侧 hooks 已全部对齐

当前最稳妥的消费项目安装链分两步：

1. 安装包或临时执行包
2. 显式执行 agent 对齐

示例：

```powershell
cd <consumer-root>
npx --yes --package .\bmad-speckit-sdd-flow-<version>.tgz bmad-speckit-init . --agent claude-code --full --no-package-json
npx --yes --package .\bmad-speckit-sdd-flow-<version>.tgz bmad-speckit-init . --agent cursor --full --no-package-json
```

如果你走的是持久化依赖模式，只做了 `npm install` 而没有做第 2 步，可能已经拿到了 `_bmad` 和 CLI，但还没有把最新 hook 资产完整同步到 `.claude/hooks` / `.cursor/hooks`。

### 3. `npx` 要区分“快速初始化”与“已安装后的对齐”

- `npx --yes --package bmad-speckit-sdd-flow bmad-speckit init . --ai cursor-agent --yes`
  - 更接近“快速初始化入口”
  - 不保证等同于本仓库当前源码里的所有最新定制治理链

- `npm install --save-dev <本仓库>` 之后执行 `npx bmad-speckit-init --agent ...`
  - 这是当前推荐的消费者安装态对齐路径
  - 可以把包内 `_bmad/runtime/hooks` 与平台 hook 薄壳同步到项目实际运行目录

---

## 安装路径选择

### 路径 A：推荐，用本仓库源代码直接部署

```powershell
pwsh scripts/setup.ps1 -Target <消费项目根目录> -Full
```

或者：

```powershell
node scripts/init-to-root.js <消费项目根目录> --agent cursor --full
node scripts/init-to-root.js <消费项目根目录> --agent claude-code --full
```

### 路径 B：非侵入式 tgz 执行（推荐，应用仓库）

```powershell
npx --yes --package .\bmad-speckit-sdd-flow-<version>.tgz bmad-speckit version
npx --yes --package .\bmad-speckit-sdd-flow-<version>.tgz bmad-speckit check
npx --yes --package .\bmad-speckit-sdd-flow-<version>.tgz bmad-speckit-init . --agent claude-code --full --no-package-json
npx --yes --package .\bmad-speckit-sdd-flow-<version>.tgz bmad-speckit-init . --agent cursor --full --no-package-json
```

### 路径 C：公开 root 包快速初始化

```powershell
npx --yes --package bmad-speckit-sdd-flow bmad-speckit init . --ai cursor-agent --yes
```

这条路径更接近 bootstrap，不应被当作当前仓库定制治理链的最高置信安装答案。

---

## 安装后应该出现什么

至少应出现以下目录或文件：

```text
<consumer-root>/
├─ _bmad/
├─ _bmad-output/
├─ .cursor/
├─ .claude/
├─ specs/
└─ package.json        # 非 Node 项目可选
```

---

## 最小复验命令列表

```powershell
cd <consumer-root>

# 1. 基础骨架
pwsh _bmad\speckit\scripts\powershell\check-prerequisites.ps1 -PathsOnly

# 2. CLI 是否可用
npx bmad-speckit check

# 3. 强制对齐 Claude / Cursor hooks
npx bmad-speckit-init --agent claude-code
npx bmad-speckit-init --agent cursor

# 4. accepted main-agent path
Test-Path .claude\hooks\runtime-policy-inject.cjs
Test-Path .claude\hooks\pre-continue-check.cjs
Test-Path .cursor\hooks\runtime-policy-inject.cjs
Test-Path .cursor\hooks\pre-continue-check.cjs
npm run main-agent-orchestration -- --cwd . --action inspect
```

判定规则：

- 第 1、2 步必须成功
- 第 3 步必须无报错
- 第 4 步四个 `Test-Path` 都应返回 `True`
- `inspect` 必须可执行并返回 authoritative surface

必要时再执行：

```powershell
npm run main-agent-orchestration -- --cwd . --action dispatch-plan
```

---

## Dashboard 与排障

dashboard 可以作为安装校验或排障 fallback，但：

- 它**不代表治理或 post-audit 主路径需要人工触发**
- 它也**不代表**主 Agent 编排本身已经成功

相关命令：

```bash
npx bmad-speckit dashboard-start --open
npx bmad-speckit dashboard-status
npx bmad-speckit dashboard-stop
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
