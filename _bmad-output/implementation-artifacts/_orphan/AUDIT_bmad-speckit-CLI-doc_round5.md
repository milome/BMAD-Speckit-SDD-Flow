# bmad-speckit-CLI 功能说明 第 5 轮审计报告

## 模型选择信息

| 项目 | 值 |
|------|-----|
| 配置来源 | .claude/agents/code-reviewer.md |
| 指定模型 | inherit（来自 frontmatter，继承主 Agent 模型） |
| 选择依据 | 子代理 YAML 中 model: inherit；可改为 fast 以节省审计成本（若环境支持） |

---

## 1. 审计概述

- **被审对象**：docs/BMAD/bmad-speckit-CLI功能说明.md
- **审计轮次**：第 5 轮
- **审计依据**：§5 精神 + 完整性、正常/非正常 case、准确性、无模糊表述
- **验证方式**：源码对照（packages/bmad-speckit 下 bin、commands、constants）+ CLI 实际执行

---

## 2. 逐项验证结果

### 2.1 完整性

| 检查项 | 结果 |
|--------|------|
| init、check、version、upgrade、feedback、config 全命令 | ✅ 覆盖 |
| 各命令选项与 bin/bmad-speckit.js、各 command 模块 | ✅ 一致 |
| 退出码 0–5 与 exit-codes.js | ✅ 一致 |

### 2.2 正常 / 非正常 case

| 命令 | 正常示例 | 非正常场景 |
|------|----------|------------|
| init | 2.5 含多种示例 | 2.6 覆盖退出码 1/2/3/4/5 |
| check | 3.3 含 check、--list-ai、--list-ai --json、--json | 3.4 覆盖 1/4 |
| version | 4.3 含普通与 --json | 4.4 说明无 config 时行为 |
| upgrade | 5.3 含 upgrade、--dry-run、--template | 5.4 覆盖 1/3/5 |
| feedback | 6.2 有完整输出描述 | 6.3 说明无已知非零退出 |
| config | 7.1–7.3 各有正常与非正常 | get key 不存在→1 |

### 2.3 准确性（与源码对照）

| 项 | 文档 | 源码 | 结果 |
|----|------|------|------|
| 退出码常量 | PRD §5.2 0–5 | exit-codes.js | ✅ |
| check --list-ai --json | JSON 数组 | check.js JSON.stringify(ids) | ✅ |
| feedback 输出 | Feedback entry: + Full-flow AI 列表 | feedback.js | ✅ |
| config get 不存在 | "Error: 配置项不存在 (Key does not exist)" | config.js | ✅ |
| upgrade 未 init | "项目未 init，请先执行 bmad-speckit init" | upgrade.js | ✅ |
| version --json templateVersion | null（无 config） | version.js | ✅ |
| upgrade §5.2 --template 默认 | latest | upgrade.js options.template \|\| 'latest' | ✅ |
| check §3.3 Installed AI tools | 至少一个 detectCommand 成功则输出 | check.js detectInstalledAITools | ✅ |
| §9 AI id 列表 | 22 个 + generic | ai-registry-builtin.js | ✅ |

### 2.4 模糊表述

全篇未检出「可选、可考虑、酌情」等禁用词。✅

---

## 3. 批判审计员结论

**已检查维度**：遗漏需求点、边界未定义、验收不可执行、与前置文档/源码矛盾、行号路径漂移、准确性、无模糊表述、可被模型忽略风险、假完整性风险。

**每维度结论（批判审计员逐条质疑与验证）**：

- **遗漏需求点**：批判审计员质疑是否遗漏任何命令或选项。逐项对照 bin/bmad-speckit.js、init.js、check.js、version.js、upgrade.js、feedback.js、config.js，init 含 --here、--ai、--ai-commands-dir、-y、--template、--network-timeout、--modules、--force、--no-git、--script、--bmad-path、--ai-skills、--no-ai-skills、--debug、--github-token、--skip-tls、--offline；check 含 --list-ai、--json、--ignore-agent-tools；version 含 --json；upgrade 含 --dry-run、--template、--offline；feedback 无选项；config get/set/list 及 --json、--global。§8 配置项与 config-manager 支持的 key 一致。**通过**。

- **边界未定义**：批判审计员质疑非正常路径是否明确。init §2.6 列出 12 种场景及对应退出码；check §3.4 列出 4 种；upgrade §5.4 列出 3 种；config get 说明 key 不存在→1；version、feedback 明确「无已知非零退出」。**通过**。批判审计员追问：--ai generic 的退出 2 条件是否完整？经查 init.js resolveGenericAiCommandsDir，须 --ai-commands-dir 或 registry 中 generic.aiCommandsDir 任一满足；文档原仅写「未提供 --ai-commands-dir」，**存在 gap**，已修正。

- **验收不可执行**：批判审计员质疑文档宣称的输出是否可验证。审计已执行：check --list-ai --json 输出 `["cursor-agent","claude",...]`；feedback 输出 "Feedback entry:" 与 "Full-flow compatible AI" 列表；config get 不存在 key 时 stderr "配置项不存在"。与文档一致。**通过**。

- **与前置文档/源码矛盾**：批判审计员逐条对照源码，发现三处不一致或遗漏：① **--ai generic**：见上；② **config set**：config.js 第 39 行对 networkTimeoutMs 做 `Number(value)` 转换，文档未说明，**存在 gap**，已修正；③ **upgrade worktree**：upgrade.js 第 91–94 行，当 bmadPath 存在时仅 set templateVersion，不调用 generateSkeleton，文档未说明行为差异，**存在 gap**，已修正。**本轮存在 gap，已修改文档消除**。

- **行号路径漂移**：批判审计员检查文档引用的 PRD、ARCH 节号是否存在。文档引用 PRD §5.2、§5.5、§5.12.1，ARCH §3.4，为规范引用，无具体行号。**通过**。

- **准确性**：批判审计员对选项名、默认值、退出码、输出格式逐项核对。init --template 默认 latest（init.js 未显式 default，模板 fetch 使用 options.template \|\| 'latest' 逻辑在 template-fetcher）；upgrade --template 默认 latest（upgrade.js 第 41 行）；check --list-ai --json 输出数组（check.js 第 194 行）；feedback 列表与 feedback.js FULL_FLOW_AI_LIST 一致；config get 错误信息与 config.js 第 18 行一致。**通过**（三处 gap 已修正）。

- **无模糊表述**：批判审计员全文检索「可选、可考虑、酌情」等禁止词，未命中。修正后的 generic 条件、config set 类型转换、upgrade worktree 均为确定性表述。**通过**。

- **可被模型忽略风险**：批判审计员评估文档中易被下游模型忽略的细节。config set 的 networkTimeoutMs 数字解析、upgrade worktree 仅更新 config，若未写明可能导致用户误用或预期不符。**已通过修改消除**。

- **假完整性风险**：批判审计员质疑是否表面覆盖全面但存在隐蔽错误。--ai generic 条件若仅写「未提供 --ai-commands-dir」，用户通过 registry 配置 aiCommandsDir 时不会触发退出 2，文档与实现不符。**已通过修改消除**。

**本轮结论**：本轮存在 gap。具体项：1) --ai generic 退出 2 条件表述不完整；2) config set 未说明 networkTimeoutMs 数字解析；3) upgrade 未说明 worktree 模式行为。审计子代理已直接修改被审文档以消除上述 gap。不计数，下一轮需重新审计以验证修复后收敛。

---

## 4. 收敛条件

**本轮存在 gap，不计数**。已对被审文档进行三处修改，主 Agent 收到报告后应发起第 6 轮审计；累计连续 3 轮无 gap 后收敛。

---

## 5. 结论

本轮审计发现 3 处准确性/完整性 gap，已由审计子代理直接修改文档；修正后内容与源码一致。待下一轮审计通过后，可计为「完全覆盖、验证通过」。

---

## 可解析评分块（供 parseAndWriteScore）

总体评级: B

维度评分:
- 功能性: 88/100
- 代码质量: 85/100
- 测试覆盖: 82/100
- 安全性: 90/100
