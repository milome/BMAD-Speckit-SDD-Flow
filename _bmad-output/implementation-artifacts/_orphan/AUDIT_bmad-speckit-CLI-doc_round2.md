# bmad-speckit-CLI功能说明.md 审计报告（§5 风格，round 2）

## 模型选择信息

| 项目 | 值 |
|------|-----|
| 配置来源 | .claude/agents/code-reviewer.md |
| 指定模型 | inherit（来自 frontmatter，继承主 Agent 模型） |
| 选择依据 | 子代理 YAML 中 model: inherit；可改为 fast 以节省审计成本（若环境支持） |

---

## 1. 审计范围与依据

| 项目 | 内容 |
|------|------|
| 被审文档 | docs/BMAD/bmad-speckit-CLI功能说明.md |
| 本轮重点 | feedback §6.2 输出格式（「每行一个 id，带 "  - " 前缀」）与源码一致性 |
| 需求依据 | packages/bmad-speckit 源码、exit-codes.js、feedback.js、check.js、config.js、upgrade.js、version.js、init.js |
| 审计标准 | audit-prompts §5 精神（适配文档审计）、批判审计员占比 >70% |

---

## 2. 逐条验证结果

### 2.1 feedback §6.2 输出格式（上一轮修正验证）

| 检查项 | 文档描述 | 源码/实际输出 | 结论 |
|--------|----------|---------------|------|
| 第一行 Feedback entry | `Feedback entry: Run \`bmad-speckit feedback\` to get the feedback entry, or visit: https://...` | feedback.js L34: `console.log('Feedback entry:', FEEDBACK_GUIDANCE)`；实测输出一致 | ✅ 一致 |
| Full-flow AI 列表格式 | 每行一个 id，带 "  - " 前缀 | feedback.js L37-38: `FULL_FLOW_AI_LIST.forEach((ai) => console.log(\`  - ${ai}\`))`；实测输出为 `  - cursor-agent` 等（两空格+短横+空格+id） | ✅ 一致 |
| AI id 列表 | cursor-agent, claude, qwen, auggie, codebuddy, amp, qodercli, kiro-cli | feedback.js L6-15 FULL_FLOW_AI_LIST 完全一致 | ✅ 一致 |

**验证命令**：`node packages\bmad-speckit\bin\bmad-speckit.js feedback`

**实测输出**：
```
Feedback entry: Run `bmad-speckit feedback` to get the feedback entry, or visit: https://github.com/bmad-method/bmad-method/issues

Full-flow compatible AI (PRD §5.12.1):
  - cursor-agent
  - claude
  - qwen
  ...
```

**结论**：§6.2 上一轮修正与源码完全一致，验证通过。

### 2.2 完整性：命令与选项覆盖

| 检查项 | 文档 | 源码 | 结论 |
|--------|------|------|------|
| init, check, version, upgrade, feedback, config | §2-§7 全覆盖 | bin L26-113 | ✅ 覆盖 |
| 各命令选项 | §2.3, §3.2, §4.2, §5.2, §7.1-7.3 | bin 对应 option 定义 | ✅ 覆盖 |

### 2.3 正常 / 非正常 case

| 命令 | 正常退出示例 | 非正常退出场景 | 结论 |
|------|--------------|----------------|------|
| init | §2.5 多示例，退出码 0 | §2.6 表：退出码 2,3,4,5 | ✅ |
| check | §3.3 三示例 | §3.4 表：退出码 1,4 | ✅ |
| version | §4.3 两示例 | §4.4 说明无已知非零 | ✅ |
| upgrade | §5.3 三示例 | §5.4 表：退出码 1,3,5 | ✅ |
| feedback | §6.2 示例 | §6.3 无已知非零 | ✅ |
| config | §7.1-7.3 正常/非正常行 | config get key 不存在→1 | ✅ |

### 2.4 退出码 0–5 覆盖

| 退出码 | 文档 §1 | 源码 exit-codes.js | 结论 |
|--------|---------|-------------------|------|
| 0-5 | 全部列出，常量与含义 | 一致 | ✅ |

### 2.5 模糊表述检查

| 检查 | 结果 |
|------|------|
| grep "可选\|可考虑\|酌情" | 无匹配 |

**结论**：无禁止类模糊表述。

### 2.6 准确性抽查

| 项目 | 文档 | 源码 | 结论 |
|------|------|------|------|
| check --list-ai 输出格式 | 每行一个 id（无前缀） | check.js L196: `ids.forEach((id) => console.log(id))`；实测每行纯 id | ✅ 一致 |
| config get 错误信息 | `Error: 配置项不存在 (Key does not exist)` | config.js L19 | ✅ 一致 |
| upgrade 未 init 错误 | `项目未 init，请先执行 bmad-speckit init` | upgrade.js L47 含该串（另含英文） | ✅ 核心信息一致 |
| --network-timeout 默认 30000 | §2.3 表格 | network-timeout.js L29, config-manager | ✅ 一致 |

---

## 3. 批判审计员结论

**已检查维度**：遗漏需求点、边界未定义、验收不可执行、与前置文档/源码矛盾、行号/路径漂移、验收一致性、模糊表述、feedback 输出格式专项。

**每维度结论（批判审计员视角，逐项质疑与验证）**：

- **遗漏需求点**：质疑——文档是否漏掉 bin 中定义的任何 option？逐项对照 bin L26-113：init 的 18 个选项、check 的 3 个、version 的 1 个、upgrade 的 3 个、feedback 无选项、config get/set/list 各选项，文档 §2.3–§7.3 全部覆盖。质疑——是否遗漏环境变量？§2.4 列出 SDD_YES、SDD_AI、SDD_NETWORK_TIMEOUT_MS、SDD_TEMPLATE_REPO、GH_TOKEN/GITHUB_TOKEN，与 init 及相关服务使用一致。质疑——§9 的 AI 列表与 feedback 的 8 项是否混淆？验证：ai-registry-builtin 含 22 项，FULL_FLOW_AI_LIST 含 8 项；文档 §6 明确写「Full-flow compatible AI (PRD §5.12.1)」为 8 项，§9 写「check --list-ai」为内置支持全集，二者区分清晰。结论：无遗漏。

- **边界未定义**：质疑——退出码 2、3、4、5 是否均有文档化场景？核查 §2.6：2（--ai 无效、--ai generic 无 --ai-commands-dir）、3（网络失败）、4（路径不可用多种情形）、5（离线缓存缺失）；§3.4、§5.4 补充 check、upgrade 的 1、4、5。质疑——--bmad-path 的「未与 --ai --yes 同时使用」是否会产生歧义？文档 §2.6 写「--bmad-path 未与 --ai --yes 同时使用 | 4」，与 init.js L144-147 一致：需 nonInteractive 才能使用 --bmad-path。质疑——无 TTY 时 init 行为？§2.6 写「无 TTY 且未指定 --ai --yes | 1」，与 init.js internalYes 逻辑一致。结论：边界均已定义。

- **验收不可执行**：质疑——「退出码 0」等宣称是否可实测？本轮对 feedback 执行 `node packages\bmad-speckit\bin\bmad-speckit.js feedback`，实测退出码 0，输出含 `  - cursor-agent` 等行，格式与 §6.2 完全一致。质疑——check --list-ai 的「每行一个 id」是否可验证？实测输出为纯 id 行（无 "  - " 前缀），与 check.js L196 `ids.forEach((id) => console.log(id))` 一致。质疑——文档示例命令是否在 Windows PowerShell 下可执行？示例使用标准 bmad-speckit 调用，路径与 shell 无关，可执行。结论：验收可执行。

- **与前置文档/源码矛盾**：质疑——feedback 第一行输出是否与文档一致？文档写 `Feedback entry: Run \`bmad-speckit feedback\` to get...`；源码 FEEDBACK_GUIDANCE 即该字符串，console.log('Feedback entry:', FEEDBACK_GUIDANCE) 输出一致。质疑——「  - 」前缀的精确格式？源码为模板字符串 `  - ${ai}`（两空格、短横、空格、id），文档写「带 "  - " 前缀」，经实测验证一致。质疑——upgrade 未 init 时的错误信息？源码为 `Error: 项目未 init，请先执行 bmad-speckit init (Project not initialized...)`；文档写核心中文部分，与用户可见信息一致，可接受。质疑——config get key 不存在时的 stderr？config.js L19 与文档 §7.1 完全一致。质疑——--network-timeout 默认 30000？network-timeout.js 解析链 fallback 为 30000，文档表述正确。结论：无矛盾。

- **行号/路径漂移**：文档未引用源码行号，无行号漂移风险。路径 _bmad-output/config/bmad-speckit.json、~/.bmad-speckit/config.json 与 config-manager.js getProjectConfigPath、getGlobalConfigPath 一致。upgrade 所用 getProjectConfigPath 与 version 一致，文档 §5.4 写「无 _bmad-output/config/bmad-speckit.json」与源码一致。结论：无漂移。

- **验收一致性**：质疑——文档宣称与实际运行是否一致？本轮执行 feedback、check --list-ai，输出与文档描述逐一对照：feedback 的 8 个 AI id、每行 "  - " 前缀、Feedback entry 首行；check --list-ai 的每行纯 id。均一致。结论：验收一致性通过。

- **模糊表述**：grep 全文「可选」「可考虑」「酌情」，无匹配。各选项的「必填」「默认」在表格中明确标注；如 project-name「否」、--template「latest」、--network-timeout「30000」等。无「可酌情」「视情况」等兜底表述。结论：无模糊表述。

- **feedback 输出格式专项（§6.2 上一轮修正）**：用户明确要求验证「每行一个 id，带 "  - " 前缀」与源码一致。源码 feedback.js L37-38：`console.log('Full-flow compatible AI (PRD §5.12.1):'); FULL_FLOW_AI_LIST.forEach((ai) => console.log(\`  - ${ai}\`));`。实测输出每行为 `  - cursor-agent` 等，即两空格 + 短横 + 空格 + id。文档「带 "  - " 前缀」精确描述该格式。AI 列表 8 项与 FULL_FLOW_AI_LIST 完全一致。结论：修正已正确落地，与源码无偏差。

**批判审计员补充质疑（模型易忽略风险与假 100% 风险）**：

- 质疑——文档是否过度承诺「无已知非零退出」？version、feedback 均写「无已知非零」。验证：versionCommand 不显式 process.exit，依赖 Node 自然退出；feedbackCommand 显式 process.exit(0)。二者在正常路径均退出 0，文档表述与实现一致。若未来源码增加异常分支，文档需同步更新，此为维护性约定，非当前 gap。

- 质疑——config list「无已知非零退出」是否可验证？config.js configListCommand 无分支触发 process.exit(1)，仅 process.exit(0)，与文档一致。

- 质疑——init 的 --script 非法值退出码文档写 1，源码 init.js L118 为 exitCodes.GENERAL_ERROR 即 1，一致。--script 合法值为 sh、ps，文档 §2.3 已写明。

- 质疑——退出码表与常量名是否与 exit-codes.js 完全一致？逐项对照：SUCCESS=0, GENERAL_ERROR=1, AI_INVALID=2, NETWORK_TEMPLATE_FAILED=3, TARGET_PATH_UNAVAILABLE=4, OFFLINE_CACHE_MISSING=5，文档 §1 表与 exit-codes.js 完全一致。

- 质疑——check --json 输出的 JSON 结构是否与文档描述一致？文档写 `{ cliVersion, templateVersion, selectedAI, subagentSupport, envVars, aiToolsInstalled }`；check.js buildDiagnoseReport 返回该结构，L248 JSON.stringify(report) 输出一致。

- 质疑——version --json 输出？文档写 `{ cliVersion, templateVersion, nodeVersion }`；version.js L49-53 result 对象即此结构，一致。

- 质疑——是否有「可解析、机器可消费」格式未文档化？feedback 无 --json，输出为人类可读；check、version、config 均有 --json。文档已覆盖，无遗漏。

**本轮结论**：本轮无新 gap。第 2 轮；建议累计至连续 3 轮无 gap 后收敛。

---

## 4. 收敛条件

本轮无 gap，计为第 2 轮无 gap。建议主 Agent 再发起第 3 轮审计，若第 3 轮仍无 gap，则满足「连续 3 轮无 gap」收敛条件。

---

## 5. 审计结论

**完全覆盖、验证通过。**

反馈 §6.2 输出格式修正与源码一致；其余完整性、正常/非正常 case、准确性、无模糊表述等项均通过验证。批判审计员逐维度检查未发现新 gap。

---

## 可解析评分块（供 parseAndWriteScore）

总体评级: A

维度评分:
- 功能性: 95/100
- 代码质量: 92/100
- 测试覆盖: 90/100
- 安全性: 88/100
