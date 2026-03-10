# AUDIT: ARCH + epics 与 PRD 一致性审计（Round 6）

**审计日期**: 2025-03-08  
**被审文档**: ARCH_specify-cn-like-init-multi-ai-assistant.md、epics.md（E10–E13 及 Architecture 组件映射）  
**需求依据**: PRD_specify-cn-like-init-multi-ai-assistant.md  
**审计模式**: ARCH 模式 + PRD 一致性

---

## 模型选择信息

| 项目 | 值 |
|------|-----|
| 配置来源 | .claude/agents/code-reviewer.md |
| 指定模型 | inherit（来自 frontmatter，继承主 Agent 模型） |
| 选择依据 | 子代理 YAML 中 model: inherit；可改为 fast 以节省审计成本（若环境支持） |

---

## 1. 审计维度与结论摘要

| 维度 | 结论 | 评分 |
|------|------|------|
| 技术可行性 | 通过 | 95/100 |
| 扩展性 | 通过 | 92/100 |
| 安全性 | 通过 | 88/100 |
| 成本效益 | 通过 | 90/100 |
| 与 PRD 一致性 | 通过 | 94/100 |
| epics 与 ARCH 一致性 | 通过 | 93/100 |

---

## 2. 逐维度审计详情

### 2.1 技术可行性

- **选型依据**：ARCH ADR-1～ADR-5 完整记录 Commander.js、Inquirer.js、chalk/boxen/ora、GitHub Release、configTemplate 决策理由，与 PRD §5.6–§5.7 一致。
- **可实现性**：Node.js 18+、npm 生态成熟，无不可实现项。
- **PRD §5.6–§5.7 对照**：CLI 框架、富终端、跨平台 path/UTF-8/CRLF 均已覆盖。

### 2.2 扩展性

- **registry**：ARCH §4.2 用户 + 项目 + 内置三级合并，epics 12.1 覆盖。
- **configTemplate**：每 AI 独立定义，禁止写死 .cursor/，与 spec-kit AGENTS.md 对齐。
- **19+ AI**：ai-builtin.js、configTemplate 含 opencode/bob/shai/codex 显式条目，可扩展。

### 2.3 安全性

- **威胁建模**：ARCH §6.1 覆盖模板篡改、敏感信息泄露、路径遍历、任意代码执行。
- **输入验证**：ARCH §6.2 覆盖 --ai、--template、--bmad-path、--ai-commands-dir。
- **PRD §6**：PRD §6 为 Success Metrics，安全对应 PRD §9.2 风险与缓解；ARCH §9 映射已明确「ARCH §6 安全考虑 ↔ PRD §9.2」。

### 2.4 成本效益

- **依赖**：Node.js 18+、commander、inquirer、chalk/boxen/ora、node-fetch、tar，合理。
- **外部服务**：仅 GitHub API，--offline、--github-token 可缓解。

### 2.5 与 PRD 一致性（§5.2–§5.5、§5.8–§5.12、§5.12.1）

| PRD 要点 | ARCH/epics 覆盖 | 验证 |
|----------|-----------------|------|
| configTemplate 按所选 AI 写入、禁止写死 .cursor/ | ARCH §3.2、§4.2、ADR-5；epics 12.2 | ✓ |
| check 按 selectedAI 验证 | ARCH §3.2 CheckCommand；epics 13.1 | ✓ |
| opencode/bob/shai/codex 显式条目 | ARCH §3.2、§4.2；epics 12.1、13.1 | ✓ |
| vscodeSettings | ARCH §4.2、§3.3；epics 12.2 | ✓ |
| subagentSupport | ARCH §4.2、§3.2；epics 12.1、13.1 | ✓ |
| --bmad-path 须与 --ai/--yes 配合 | ARCH §3.3；epics 10.5 | ✓ |
| 无 selectedAI 时跳过或验证 .cursor | ARCH §3.2；epics 13.1 | ✓ |
| networkTimeoutMs、SDD_NETWORK_TIMEOUT_MS | ARCH §3.2、§4.1；epics 11.1、13.2、13.4 | ✓ |
| --modules 须与 --ai/--yes 配合 | ARCH §3.3；epics 10.2 | ✓ |
| SDD_CLI_NAME | ARCH §4.1 配置优先级 | ✓ |

### 2.6 epics 与 ARCH 一致性

- **E10**：InitCommand、init 流程、--here、--bmad-path、--modules、TTY 检测与 ARCH §3.2、§3.3 一致。
- **E11**：TemplateFetcher、cache、networkTimeoutMs 与 ARCH §3.2 一致。
- **E12**：AIRegistry、configTemplate、SkillPublisher、vscodeSettings、subagentSupport 与 ARCH §3.2、§4.2 一致。
- **E13**：CheckCommand 验证清单（含 gemini、windsurf、kilocode、auggie、roo、opencode、bob、shai、codex）、退出码、config、feedback 与 ARCH §3.2、§3.4 一致。
- **Architecture 组件映射**：epics §4 表完整映射 InitCommand、TemplateFetcher、AIRegistry、ConfigManager、SkillPublisher、CheckCommand、VersionCommand、UpgradeCommand、ConfigCommand、FeedbackCommand、退出码约定。

---

## 3. 批判审计员结论

### 3.1 已检查维度列表

1. 技术可行性：选型依据、可实现性、与 PRD §5.6–§5.7 一致  
2. 扩展性：registry、configTemplate、19+ AI 可扩展  
3. 安全性：威胁建模、输入验证、与 PRD §9.2 一致  
4. 成本效益：依赖、外部服务  
5. 与 PRD 一致性：§5.2–§5.5、§5.8–§5.12、§5.12.1 逐条对照  
6. epics 与 ARCH 一致性：E10–E13 Story 与 ARCH 模块职责、init 流程、configTemplate 结构一致  

### 3.2 每维度批判性结论

**技术可行性**：ARCH 五则 ADR 均有背景、备选、决策理由、后果，与 PRD §5.6（Commander.js、Inquirer.js、chalk+boxen、ora）、§5.7（path、UTF-8、LF/CRLF）完全对齐。批判审计员质疑：Inquirer.js 与 prompts 的「主选/备选」切换条件未在 ARCH 中明确；ADR-3 提及 Windows 代码页，但 PRD §5.7 仅说「考虑 chcp 65001」，未强制实现路径。经复核，上述为实施阶段细节，架构层可接受。无技术不可行项。

**扩展性**：registry 支持用户/项目/内置三级；configTemplate 按 AI 定义，禁止写死 .cursor/；19+ AI 含 opencode（.opencode/command）、auggie（.augment/rules）、bob/shai/codex（.bob/commands、.shai/commands、.codex/commands）显式条目，与 spec-kit AGENTS.md 一致。批判审计员质疑：registry 与内置合并时的冲突解决策略（同 id 时谁覆盖谁）未在 ARCH 中写明。PRD §5.3 仅说「项目内 > 用户目录 > 内置」，未涉及同 id 覆盖。经复核，优先级即覆盖规则，项目内 > 用户 > 内置已隐含。新增 AI 可通过 registry 扩展，无需改代码。

**安全性**：ARCH §6.1 威胁建模覆盖模板篡改、敏感信息泄露、路径遍历、任意代码执行；§6.2 输入验证覆盖 --ai、--template、--bmad-path、--ai-commands-dir。批判审计员质疑：--skip-tls 的「明确警告」未在 ARCH 中定义具体输出内容或用户确认流程。PRD §5.2 仅说「不推荐，仅企业内网」。经复核，警告实现属实施细节，架构层已标注需明确警告。PRD 无独立安全章节，安全要求体现在 §9.2 风险与缓解；ARCH §9 映射已明确「ARCH §6 安全考虑」对应 PRD §9.2，无歧义。

**成本效益**：依赖均为常见 npm 包，无重依赖；外部仅 GitHub API，--offline、--github-token 可缓解限流与离线场景。批判审计员质疑：Node.js 18 内置 fetch，ARCH §8.1 仍列「node-fetch / 内置 fetch」，可能引入冗余依赖。经复核，表述为二选一，实施时可仅用内置 fetch，无强制 node-fetch。成本可控。

**与 PRD 一致性**：逐条对照结果如下。configTemplate 按所选 AI 写入、禁止写死 .cursor/：ARCH §3.2 InitCommand、§4.2、ADR-5 及 epics 12.2 均明确；批判审计员复核 InitCommand 职责描述「.cursor/、.claude/、.windsurf/ 等」为示例性列举，非写死，与「禁止写死」一致。check 按 selectedAI 验证：ARCH §3.2 CheckCommand 列出 cursor-agent、claude、gemini、windsurf、kilocode、auggie、roo、opencode、bob、shai、codex 等完整清单，与 PRD §5.5 验证清单逐一对应，epics 13.1 一致。opencode/bob/shai/codex 显式条目：ARCH §4.2 configTemplate 结构、§3.2 CheckCommand 及 epics 12.1、13.1 均已包含；auggie 的 .augment/rules 亦已显式列出。vscodeSettings：ARCH §4.2、§3.3 及 epics 12.2 覆盖；PRD §5.12 与 init 流程集成中明确「若 configTemplate 含 vscodeSettings，写入 .vscode/settings.json」。subagentSupport：ARCH §4.2 configTemplate 结构、§3.2 CheckCommand 输出子代理等级，epics 12.1、13.1 覆盖；PRD §5.12.1 要求 configTemplate 含 subagentSupport、check 输出等级、无子代理 AI 时 init 提示，三者均有对应。--bmad-path 须与 --ai、--yes 配合：ARCH §3.3 状态机、epics 10.5 明确；PRD §5.2 边界与异常行为中「须与 --ai、--yes 配合非交互使用」已体现。无 selectedAI 时跳过或验证 .cursor：ARCH §3.2、epics 13.1 一致；PRD §5.5 验证清单最后一项「若项目未 init 或 bmad-speckit.json 无 selectedAI：跳过本项验证（或验证 .cursor 作为向后兼容默认）」已覆盖。networkTimeoutMs、SDD_NETWORK_TIMEOUT_MS：ARCH §3.2 TemplateFetcher、§4.1 ConfigManager、epics 11.1、13.2、13.4 覆盖；PRD §5.8、§5.9、US-6 均要求支持，默认 30000ms。--modules 须与 --ai、--yes 配合：ARCH §3.3、epics 10.2 一致；PRD §5.2、§5.13 明确非交互模式下须配合。SDD_CLI_NAME：ARCH §4.1 配置优先级表已含环境变量 SDD_CLI_NAME；PRD OQ-1 与 §5.8 要求支持。上述要点均无遗漏。

**epics 与 ARCH 一致性**：E10.1 交互式 init 含 Banner、19+ AI、--modules、--force、--here 等，与 ARCH init 流程一致；批判审计员复核 epics 10.1 的「--debug/--github-token/--skip-tls」与 ARCH init 相关 flags 及 PRD §5.2 参数表一致。E10.2 非交互含 --ai、--yes、TTY、SDD_AI/SDD_YES、--modules 须与 --ai/--yes 配合，与 ARCH §3.3 一致。E10.5 --bmad-path 须与 --ai、--yes 配合，与 ARCH 一致。E11、E12、E13 各 Story 与 TemplateFetcher、AIRegistry、SkillPublisher、CheckCommand 等模块职责一一对应；批判审计员复核 epics §4 Architecture 组件映射表，InitCommand→10.1/10.2、TemplateFetcher→11.1/11.2、AIRegistry→12.1、ConfigManager→10.4/13.4、SkillPublisher→12.3、CheckCommand→12.2/13.1、VersionCommand/UpgradeCommand/ConfigCommand/FeedbackCommand→13.x、退出码→13.1/13.2，无遗漏。configTemplate 结构在 epics 12.1 与 ARCH §4.2 一致：commandsDir、rulesDir 至少其一，skillsDir 条件必填，agentsDir/configDir 二选一，vscodeSettings 可选，subagentSupport 必含。

### 3.3 边界情况与可操作性复核

**边界情况**：PRD §5.2 边界与异常行为共 8 项，批判审计员逐项核对 ARCH 与 epics 的可操作性表述。（1）--ai 无效：ARCH 退出码 2、epics 13.2 覆盖。（2）--yes 默认 AI：epics 10.2「defaultAI>内置第一项」、ARCH ConfigManager 支持 defaultAI。（3）目标路径已存在：ARCH init 流程「校验目标（空/存在/--force）」、epics 10.1「目标路径已存在时报错提示」。（4）网络超时/模板失败：ARCH TemplateFetcher networkTimeoutMs、epics 11.1、13.2。（5）--offline cache 缺失：ARCH 退出码 5、epics 13.2。（6）--bmad-path 路径不可用：ARCH 退出码 4、epics 10.5、13.2。（7）--ai generic 无 aiCommandsDir：ARCH 退出码 2、epics 12.1。（8）非 TTY 无 --ai/--yes 自动 --yes：ARCH §3.3、epics 10.2。全部可操作、可验证。

**可验证性**：check 结构验证清单的每项（_bmad、_bmad-output、bmadPath、按 selectedAI 验证目标目录、无 selectedAI 时跳过或验证 .cursor）均可在实施后通过 `bmad-speckit check` 执行并观察退出码 0/1 验证。init 流程的每步（解析路径、拉取模板、选择 AI、同步、发布 skills、initLog）均有可观测输出或文件产出。无伪实现或不可验证的抽象。

**被模型忽略风险**：批判审计员关注 PRD 中易被忽略的细节。（1）PRD §5.5 check 验证清单中「_bmad/cursor/ 存在时，含 commands/、rules/」— worktree 共享模式下验证 bmadPath 指向目录的 cursor 子目录，ARCH §3.2 CheckCommand 与 epics 13.1 已覆盖 bmadPath 验证。（2）PRD §5.12 initLog 的 skippedReasons— ARCH §3.2 SkillPublisher、epics 12.3 已含。（3）PRD §5.12.1 无子代理 AI 时 init 提示— epics 12.3「无子代理支持 AI 时 init/check 输出提示」已覆盖。未发现被忽略项。

**假 100 轮收敛风险**：若审计流于形式，可能宣称「无 gap」却遗漏实质问题。批判审计员通过以下方式降低此风险：（1）逐条对照 PRD §5.2–§5.5、§5.8–§5.12、§5.12.1 共 10+ 项要点；（2）复核 ARCH 与 epics 的交叉引用（如 CheckCommand 职责与 epics 13.1 描述是否一致）；（3）检查边界与异常行为的可操作性；（4）质疑每维度的潜在 gap 并给出「经复核可接受」或「需修改」的明确结论。本轮未发现需修改项。

### 3.4 本轮结论

**本轮无新 gap**。

经逐条对照、边界情况复核、可操作性验证、被模型忽略风险排查、假收敛风险缓解，ARCH 与 epics 在技术可行性、扩展性、安全性、成本效益、与 PRD 一致性、epics 与 ARCH 一致性六个维度上均满足要求。configTemplate 按所选 AI 写入、禁止写死 .cursor/、check 按 selectedAI 验证、opencode/bob/shai/codex 显式条目、vscodeSettings、subagentSupport、--bmad-path 与 --ai/--yes 配合、无 selectedAI 时跳过或验证 .cursor、networkTimeoutMs、--modules 与 --ai/--yes 配合等 PRD 要点均有明确对应，无需修改被审文档。

**收敛说明**：本轮无 gap，consecutive_pass_count + 1。需连续 3 轮无 gap 才收敛。

---

## 4. 可解析评分块（供 parseAndWriteScore）

```markdown
## 可解析评分块（供 parseAndWriteScore）

总体评级: A

维度评分:
- 需求完整性: 94/100
- 可测试性: 92/100
- 一致性: 95/100
- 可追溯性: 96/100
```
