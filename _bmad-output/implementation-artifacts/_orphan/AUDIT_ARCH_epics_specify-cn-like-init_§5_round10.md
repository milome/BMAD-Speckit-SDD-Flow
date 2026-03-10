# AUDIT: ARCH + epics 与 PRD 一致性审计（Round 10）

**审计日期**: 2025-03-08  
**被审文档**: ARCH_specify-cn-like-init-multi-ai-assistant.md、epics.md（E10–E13 及 Architecture 组件映射）  
**需求依据**: PRD_specify-cn-like-init-multi-ai-assistant.md  
**审计模式**: ARCH 模式 + PRD 一致性  
**收敛状态**: Round 8、9 已连续 2 轮无 gap；本轮若无 gap 则达成「连续 3 轮无 gap」收敛

---

## 模型选择信息

| 项目 | 值 |
|------|-----|
| 配置来源 | .claude/agents/code-reviewer.md |
| 指定模型 | inherit（来自 frontmatter，继承主 Agent 模型） |
| 选择依据 | 子代理 YAML 中 model: inherit；可改为 fast 以节省审计成本（若环境支持） |

---

## 1. 专项检查逐项验证

### §5.2 边界与异常（含 --ai 无效时输出可用 AI 列表或 check --list-ai）

| 检查项 | PRD 要求 | ARCH | epics | 结论 |
|--------|----------|------|-------|------|
| --ai 无效时输出 | 报错退出，输出可用 AI 列表（check --list-ai 或等价），退出码 2 | §3.2 InitCommand 明确「输出可用 AI 列表或提示运行 check --list-ai，退出码 2」 | 13.2 明确「须输出可用 AI 列表或提示运行 check --list-ai」 | ✓ |
| --ai generic 无 aiCommandsDir | 退出码 2 | §6.2 输入验证；epics 12.1 显式 | 12.1 明确 | ✓ |
| --bmad-path 须与 --ai/--yes 配合 | 非交互使用 | §3.3 状态机明确「--bmad-path 须与 --ai、--yes 配合非交互使用」 | 10.5 明确 | ✓ |
| --modules 非交互约束 | 须与 --ai、--yes 配合 | §3.3 状态机明确「--modules 须与 --ai、--yes 配合非交互使用」 | 10.2 明确 | ✓ |
| 边界行为 8 项 | 全部必须实现 | §3.3 init 流程、§3.4 退出码、§3.2 各模块职责覆盖 | E10–E13 对应 Story 覆盖 | ✓ |

### §5.3.1 configTemplate

| 检查项 | PRD 要求 | ARCH | epics | 结论 |
|--------|----------|------|-------|------|
| commandsDir/rulesDir 至少其一 | 条件约束 | §4.2 明确「commandsDir 与 rulesDir 至少其一」 | 12.1 明确 | ✓ |
| agentsDir/configDir 二选一 | 同一 AI 只能填其一 | §4.2 明确「agentsDir 与 configDir 二选一，同一 AI 只能填其一」 | 12.1 明确「agentsDir 或 configDir 二选一」 | ✓ |
| skillsDir 条件 | 若 AI 支持 skill 则必填 | §4.2 明确「skillsDir 若 AI 支持 skill 则必填」 | 12.1 明确 | ✓ |
| spec-kit 对齐 | opencode→.opencode/command、auggie→.augment/rules、bob/shai/codex | §4.2、§3.2 CheckCommand 显式条目 | 12.1、13.1 显式条目 | ✓ |

### §5.5 check 按 selectedAI 验证

| 检查项 | PRD 要求 | ARCH | epics | 结论 |
|--------|----------|------|-------|------|
| opencode/bob/shai/codex 显式条目 | 验证清单含显式映射 | §3.2 CheckCommand 含 opencode→.opencode/command、bob→.bob/commands、shai→.shai/commands、codex→.codex/commands | 13.1 完整映射 | ✓ |
| 无 selectedAI 时行为 | 跳过或验证 .cursor 向后兼容 | §3.2 明确「若项目未 init 或 bmad-speckit.json 无 selectedAI：跳过 AI 目标目录验证或验证 .cursor 向后兼容」 | 13.1 明确 | ✓ |
| 退出码 | 结构验证失败 1、成功 0 | §3.4 一致 | 13.2 一致 | ✓ |

### §5.10 同步步骤

| 检查项 | PRD 要求 | ARCH | epics | 结论 |
|--------|----------|------|-------|------|
| 按 configTemplate 写入 | 禁止写死 .cursor/ | §3.3 明确「按 configTemplate 同步」「禁止写死 .cursor/」 | 12.2 明确 | ✓ |
| vscodeSettings | 若 configTemplate 含则写入 .vscode/settings.json | §3.3 明确「若 configTemplate 含 vscodeSettings，写入 .vscode/settings.json」 | 12.2 明确 | ✓ |
| skills 发布 | 按 configTemplate.skillsDir | §3.3、§3.2 SkillPublisher | 12.3 明确 | ✓ |

### §5.12.1 子代理支持

| 检查项 | PRD 要求 | ARCH | epics | 结论 |
|--------|----------|------|-------|------|
| configTemplate.subagentSupport | native\|mcp\|limited\|none | §4.2 明确 | 12.1 明确 | ✓ |
| check 输出子代理等级 | 输出所选 AI 子代理支持等级 | §3.2 CheckCommand 明确 | 13.1 明确 | ✓ |
| init 无子代理 AI 提示 | 选 tabnine 等在 stdout 提示 | §9 映射 §5.12.1；epics 12.3 覆盖 | 12.3 明确 | ✓ |
| 全流程兼容 AI 清单 | feedback 输出或关联文档须含 | §3.2 FeedbackCommand 明确 | 13.5 明确 | ✓ |

### §5.8 networkTimeoutMs、§5.2 --bmad-path、--modules

| 检查项 | PRD 要求 | ARCH | epics | 结论 |
|--------|----------|------|-------|------|
| networkTimeoutMs | 默认 30000，config 与 env 支持 | §3.2 TemplateFetcher、ConfigManager；§4.1 环境变量 SDD_NETWORK_TIMEOUT_MS | 11.1、13.2、13.4 覆盖 | ✓ |
| --bmad-path 须与 --ai/--yes 配合 | 非交互使用 | §3.3 状态机 | 10.5 | ✓ |
| --modules 非交互约束 | 须与 --ai、--yes 配合 | §3.3 状态机 | 10.2 | ✓ |

---

## 2. 批判审计员结论

### 2.1 已检查维度列表

本轮审计对以下十个维度进行了逐项验证：

1. **需求完整性**：逐条对照 PRD §5.2–§5.5、§5.8–§5.12、§5.12.1、§7.0，验证 ARCH 与 epics 是否覆盖全部强制要求，包括边界与异常行为 8 项、configTemplate 结构、check 验证清单、同步步骤、子代理支持四点、networkTimeoutMs、--bmad-path 与 --modules 非交互约束。

2. **可测试性**：每项需求是否具备可验证的验收标准或可观测产出；check 结构验证、init 流程各步骤、--ai 无效时输出、feedback 全流程兼容 AI 清单、--ai generic 无 aiCommandsDir 等是否可通过自动化或人工测试验证。

3. **一致性**：ARCH 与 epics 之间、epics 与 PRD 之间的表述是否一致，无矛盾；configTemplate 字段定义、check 验证清单 AI 目录映射、全流程兼容 AI 清单、退出码约定等是否三文档一致。

4. **可追溯性**：PRD 需求 → ARCH 模块 → epics Story 的映射是否完整、无断链；US-1 至 US-12、§5.12.1 四点、Architecture 组件映射是否一一对应。

5. **技术可行性**：ADR 决策、技术选型是否可实现；Node.js 18+、Commander.js、Inquirer.js、configTemplate 文件系统同步等是否有不可行项。

6. **扩展性**：registry 三级、configTemplate 按 AI 定义、19+ AI 与 spec-kit 对齐、新增 AI 扩展机制是否清晰。

7. **安全性**：威胁建模、输入验证是否覆盖 PRD §9.2 风险；--ai、--template、--bmad-path、--ai-commands-dir 等输入校验是否完整。

8. **成本效益**：依赖与外部服务是否合理；GitHub API、npm 包、无持久化数据库等是否可接受。

9. **与 PRD 一致性**：§5.2 边界与异常、§5.3.1 configTemplate、§5.5 check 验证清单、§5.10 同步步骤、§5.12.1 子代理支持及第 4 点、§5.8 networkTimeoutMs、--bmad-path 与 --modules 非交互约束是否与 PRD 逐字对齐。

10. **epics 与 ARCH 一致性**：E10–E13 各 Story 与 ARCH InitCommand、TemplateFetcher、AIRegistry、ConfigManager、SkillPublisher、CheckCommand、VersionCommand、UpgradeCommand、ConfigCommand、FeedbackCommand 职责是否一一对应；epics §4 Architecture 组件映射表是否完整。

### 2.2 每维度批判性结论

**需求完整性**：经逐条对照 PRD §5.2–§5.12.1，Round 7 已补 GAP-1（--ai 无效时输出要求）与 GAP-2（§5.12.1 文档要求）。本轮复核确认：ARCH §3.2 InitCommand 含「输出可用 AI 列表或提示运行 check --list-ai，退出码 2」；ARCH §3.2 FeedbackCommand 含「输出或关联文档须含全流程兼容 AI 清单」；epics 13.2、13.5 对应覆盖。PRD §5.2 边界与异常行为 8 项（--ai 无效、--yes 默认 AI、目标路径已存在、网络超时/模板失败、--offline cache 缺失、--bmad-path 路径不可用、--ai generic 无 aiCommandsDir、非 TTY 自动 --yes）均在 ARCH §3.3、§3.4、§3.2 及 epics E10–E13 中有明确可操作表述。§5.5 check 验证清单（cursor-agent、claude、gemini、windsurf、kilocode、auggie、roo、opencode、bob、shai、codex 及无 selectedAI 时处理）在 ARCH §3.2 CheckCommand 与 epics 13.1 中完整覆盖。§5.12.1 实现要求 4 点（configTemplate.subagentSupport、check 输出等级、init 无子代理提示、feedback 全流程兼容 AI 清单）已映射至 12.1、12.3、13.1、13.5。configTemplate 结构（commandsDir/rulesDir 至少其一、agentsDir/configDir 二选一、skillsDir 条件）、vscodeSettings、--bmad-path 与 --ai/--yes 配合、networkTimeoutMs、--modules 与 --ai/--yes 配合等要点均已覆盖。**结论**：需求完整性达标，无遗漏。

**可测试性**：check 结构验证可通过 `bmad-speckit check` 及退出码 0/1 验证；init 流程每步有可观测输出或文件产出（initLog、_bmad-output 结构、所选 AI 目标目录）；--ai 无效时可通过 `init --ai invalid-ai` 验证 stdout 含可用 AI 列表或 check --list-ai 提示；feedback 全流程兼容 AI 清单可通过 `bmad-speckit feedback` 或关联文档验证；--ai generic 无 aiCommandsDir 可通过 `init --ai generic --yes`（无 registry 配置）验证退出码 2；--bmad-path 路径不可用可通过指定不存在路径验证退出码 4；networkTimeoutMs 可通过 config set 或环境变量配置并触发超时验证。每项 User Story 均有验收标准或可观测行为。**结论**：可测试性达标。

**一致性**：ARCH 与 epics 在 InitCommand、CheckCommand、SkillPublisher、FeedbackCommand、configTemplate、退出码、--bmad-path 与 --ai/--yes 配合、--modules 非交互约束等表述上一致。PRD §5.5 check 验证清单与 ARCH §3.2 CheckCommand、epics 13.1 的 AI 目录映射一致（cursor-agent→.cursor/、claude→.claude/、opencode→.opencode/command、auggie→.augment/rules、bob→.bob/commands、shai→.shai/commands、codex→.codex/commands）。全流程兼容 AI 清单（cursor-agent、claude、qwen、auggie、codebuddy、amp、qodercli、kiro-cli）在 PRD、ARCH、epics 中表述一致。configTemplate 条件约束（commandsDir/rulesDir 至少其一、agentsDir/configDir 二选一、skillsDir 若 AI 支持 skill 则必填）三文档一致。**结论**：一致性达标。

**可追溯性**：PRD §7.0 与 epics §3 映射完整；US-1 至 US-12 均映射到 E10–E13；§5.12.1 四点已映射至 12.1（configTemplate）、12.3（init 提示）、13.1（check 输出）、13.5（feedback 清单）。Architecture 组件 → Task 映射表（epics §4）与 ARCH §3.2 一一对应：InitCommand→10.1/10.2、TemplateFetcher→11.1/11.2、AIRegistry→12.1、ConfigManager→10.4/13.4、SkillPublisher→12.3、CheckCommand→12.2/13.1、VersionCommand/UpgradeCommand/ConfigCommand/FeedbackCommand→13.1/13.3/13.4/13.5、退出码→13.1/13.2。**结论**：可追溯性达标。

**技术可行性**：ARCH 五则 ADR 完整（Commander.js、Inquirer.js、chalk+boxen+ora、GitHub Release+cache、configTemplate+registry）。Node.js 18+、Commander.js、Inquirer.js 等均为成熟技术。PRD §5.10 同步步骤、§5.12 发布目标映射均可在文件系统层面实现；按 configTemplate 映射 commands/rules/config 到各 AI 目标目录、skills 发布到全局目录均为标准文件操作；check 结构验证为目录存在性与子目录检查。无不可行项。**结论**：技术可行性达标。

**扩展性**：registry 三级（内置、用户、项目）清晰；configTemplate 按 AI 定义，新增 AI 通过 registry 添加；19+ AI 与 spec-kit AGENTS.md 对齐；ADR-5 明确「新增 AI 需更新内置或 registry」。**结论**：扩展性达标。

**安全性**：ARCH §6 威胁建模覆盖模板来源篡改、敏感信息泄露、路径遍历、任意代码执行；§6.2 输入验证覆盖 --ai、--template、--bmad-path、--ai-commands-dir。与 PRD §9.2 风险（模板源不可用、AI 列表过时、Windows 编码、网络超时、模板版本不兼容）对应。**结论**：安全性达标。

**成本效益**：依赖合理（Node.js 18+、commander、inquirer、chalk、boxen、ora、node-fetch、tar）；外部仅 GitHub API，可配置 --github-token 提升限额；无持久化数据库，仅文件系统。**结论**：成本效益达标。

**与 PRD 一致性**：专项检查 6 项全部通过。§5.2 边界与异常 8 项、§5.3.1 configTemplate、§5.5 check 按 selectedAI、§5.10 同步步骤、§5.12.1 子代理支持及第 4 点、§5.8 networkTimeoutMs、--bmad-path 与 --modules 非交互约束均与 PRD 一致。**结论**：与 PRD 一致性达标。

**epics 与 ARCH 一致性**：epics §4 Architecture 组件映射表与 ARCH §3.2 一一对应。E10.1–E10.5 覆盖 InitCommand 交互式/非交互式/脚本/配置/--bmad-path；E11.1–E11.2 覆盖 TemplateFetcher；E12.1–E12.4 覆盖 AIRegistry、引用完整性、SkillPublisher、Post-init 引导；E13.1–E13.5 覆盖 check、version、upgrade、config、feedback 及异常路径。**结论**：epics 与 ARCH 一致性达标。

### 2.3 边界情况与可操作性复核

**边界情况**：PRD §5.2 边界与异常行为 8 项经复核全部可操作、可验证。--ai 无效时输出可用 AI 列表或 check --list-ai 提示，可通过 stdout 断言验证。--ai generic 无 aiCommandsDir 时退出码 2，epics 12.1 与 ARCH §6.2 覆盖。--bmad-path 路径不存在或结构不符合时退出码 4，epics 10.5、13.2 与 ARCH §3.4 覆盖。非 TTY 且无 --ai/--yes 时自动 --yes，epics 10.2 与 ARCH §3.3 覆盖。

**被模型忽略风险**：Round 7 已补全易忽略项（--ai 无效输出、§5.12.1 第 4 点）。本轮逐项专项检查、逐维度批判性复核，未发现新的易忽略项。

**假收敛风险**：通过逐条对照、专项检查 6 项、边界复核、可操作性验证，降低假收敛概率。本轮未发现新 gap。

### 2.4 本轮结论

**本轮无新 gap**。

Round 7 已补 GAP-1、GAP-2，Round 8、9 为连续无 gap 第 1、2 轮。本轮复核确认被审文档与 PRD 完全对齐。专项检查 §5.2、§5.3.1、§5.5、§5.10、§5.12.1（含第 4 点）、§5.8 networkTimeoutMs、--bmad-path、--modules 全部通过。

**连续 3 轮无 gap，审计收敛。**

---

## 3. 可解析评分块（供 parseAndWriteScore）

```markdown
## 可解析评分块（供 parseAndWriteScore）

总体评级: A

维度评分:
- 需求完整性: 97/100
- 可测试性: 95/100
- 一致性: 96/100
- 可追溯性: 98/100
```
