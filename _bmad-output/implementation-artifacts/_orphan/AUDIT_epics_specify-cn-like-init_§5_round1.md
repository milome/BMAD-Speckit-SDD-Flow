# epics.md specify-cn-like-init（Epic 10–13）审计报告 §5 round1

**被审文档**：`_bmad-output/planning-artifacts/dev/epics.md`  
**审计范围**：Epic 10–13 及对应 Story、PRD 映射、ARCH 映射、依赖图  
**前置文档**：PRD_specify-cn-like-init-multi-ai-assistant.md、ARCH_specify-cn-like-init-multi-ai-assistant.md  
**审计日期**：2025-03-07

---

## 模型选择信息

| 项目 | 值 |
|------|-----|
| 配置来源 | .claude/agents/code-reviewer.md |
| 指定模型 | inherit（来自 frontmatter，继承主 Agent 模型） |
| 选择依据 | 子代理 YAML 中 model: inherit；可改为 fast 以节省审计成本（若环境支持） |

---

## 1. 审计执行摘要

本报告对 epics.md 中 Epic 10–13（specify-cn-like-init）进行逐条审计，对照 PRD 与 ARCH 文档，验证需求完整性、可测试性、一致性与可追溯性。审计过程中发现若干 gap，**已在本轮内直接修改 epics.md 消除**，修改内容见 §4。

---

## 2. 逐条检查结果

### 2.1 PRD User Story 覆盖（US-1～US-12）

| US | PRD 要点 | 映射 Story | 结果 |
|----|----------|------------|------|
| US-1 | 交互式 init、Banner、19+ AI、box-drawing 选择器、--modules、init . / --here | 10.1 | ✅ 已覆盖（修改后） |
| US-2 | --ai、--yes、TTY 检测、SDD_AI/SDD_YES、--modules 非交互 | 10.2 | ✅ 已覆盖 |
| US-3 | --template、--offline、templateVersion、cache | 11.1, 11.2 | ✅ 已覆盖 |
| US-4 | registry、configTemplate、detectCommand | 12.1 | ✅ 已覆盖 |
| US-5 | check、version、--list-ai、--json、结构验证退出码 0/1 | 13.1 | ✅ 已覆盖 |
| US-6 | 网络超时、模板失败、--offline cache 缺失、错误码、networkTimeoutMs | 13.2 | ✅ 已覆盖（修改后） |
| US-7 | --script sh/ps、路径/编码/换行符、Windows 默认 ps | 10.3 | ✅ 已覆盖 |
| US-8 | defaultAI、defaultScript、项目级覆盖 | 10.4 | ✅ 已覆盖 |
| US-9 | 引用完整性、Skill 发布、--bmad-path、check 验证 | 10.5, 12.2, 12.3, 12.4 | ✅ 已覆盖 |
| US-10 | upgrade、--dry-run、--template、templateVersion | 13.3 | ✅ 已覆盖 |
| US-11 | config get/set/list、--global、networkTimeoutMs、--json | 13.4 | ✅ 已覆盖（修改后） |
| US-12 | feedback、init 后 stdout 提示 | 13.5 | ✅ 已覆盖 |

### 2.2 PRD Solution 章节与边界/异常行为

| 要点 | 来源 | 覆盖情况 |
|------|------|----------|
| --force 非空目录覆盖 | §5.2 | ✅ 10.1（修改后） |
| --ignore-agent-tools | §5.2 | ✅ 13.1（修改后） |
| --ai generic + --ai-commands-dir 边界、退出码 2 | §5.2 | ✅ 12.1（修改后） |
| --bmad-path 路径不可用退出码 4 | §5.2 | ✅ 10.5、13.2（修改后） |
| --yes 默认 AI 来源 defaultAI>内置第一项 | §5.2 | ✅ 10.2（修改后） |
| 非 TTY 自动 --yes | §5.8 | ✅ 10.2（修改后） |
| 目标路径已存在时报错、--force 覆盖 | §5.2 | ✅ 10.1（修改后） |
| networkTimeoutMs/SDD_NETWORK_TIMEOUT_MS | §5.2、US-6 | ✅ 13.2（修改后） |
| 错误码 1–5 与 PRD 表一致 | §5.2 | ✅ 13.2（修改后） |
| --debug、--github-token、--skip-tls | §5.2、Appendix D | ✅ 10.1（修改后） |

### 2.3 ARCH 模块覆盖

| 模块 | 映射 Story | 结果 |
|------|------------|------|
| InitCommand | 10.1, 10.2 | ✅ |
| TemplateFetcher | 11.1, 11.2 | ✅ |
| AIRegistry、ai-builtin | 12.1 | ✅ |
| ConfigManager | 10.4, 13.4 | ✅ |
| SkillPublisher、initLog | 12.3 | ✅ |
| CheckCommand、结构验证 | 12.2, 13.1 | ✅ |
| VersionCommand、UpgradeCommand、ConfigCommand、FeedbackCommand | 13.1, 13.3, 13.4, 13.5 | ✅ |
| 退出码约定 | 13.1, 13.2 | ✅ |

### 2.4 Epic–Story 依赖图一致性

依赖图与 Story 依赖列一致：E10.1 为核心；E11.1→E11.2；E12.1→E12.2→E12.3→E12.4；E13 依赖 E10、E11。✅

---

## 3. 批判审计员结论

**已检查维度**：遗漏需求点、边界未定义、验收不可执行、与前置文档矛盾、FR/NFR 映射完整性、Epic–Story 依赖图一致性、可追溯性。

**每维度结论**：

- **遗漏需求点**：初稿存在遗漏。PRD §5.2 明确要求的 `--force`（非空目录强制覆盖）在 Epic 10 与 Story 10.1 中未提及，实施时易被忽略；PRD §5.2 边界与异常行为中的「目标路径已存在时报错、提示使用 --force」同样缺失。PRD US-1 验收标准要求「box-drawing 风格选择器边框」，Story 10.1 仅提 Banner，未提选择器边框。PRD §5.2、§5.5 要求 `--ignore-agent-tools`（CheckCommand 跳过 AI 工具检测），epics 未覆盖。PRD §5.2、§5.3 要求 `--ai generic` 时须配合 `--ai-commands-dir` 或 registry 中 aiCommandsDir，否则退出码 2，该边界与错误码在 epics 中未体现。PRD §5.2 错误码表定义 1–5 的精确含义（1 通用、2 --ai 无效、3 网络/模板、4 路径不可用、5 离线 cache 缺失），Story 13.2 仅写「错误码 1-5」，未与 PRD 逐一对应，可测试性不足。PRD US-6、ARCH TemplateFetcher 要求 `networkTimeoutMs`（默认 30000）或 `SDD_NETWORK_TIMEOUT_MS` 可配置，Story 13.2 未明确。PRD §5.2 要求 `--debug`、`--github-token`、`--skip-tls`（Appendix D 采纳的 spec-kit-cn 改进点），epics 未提及。ARCH ConfigCommand 支持 `--json` 输出，Story 13.4 未提及。PRD §5.2 要求 `--yes` 时默认 AI 来源为 `defaultAI` > 内置第一项，Story 10.2 未明确。PRD §5.2 要求 `--bmad-path` 当 path 不存在或结构不符合时退出码 4，Story 10.5 与 13.2 未明确该场景与退出码。Epic 10 与 Story 10.1 描述为「15+ AI」，与 PRD §5.3、ARCH 的「19+ 种」不一致，存在与前置文档矛盾。**本轮已通过直接修改 epics.md 消除上述遗漏**，详见 §4。

- **边界未定义**：初稿中多处边界未在 Story 描述中定义。`init <path>` 当目标路径已存在且包含 `_bmad` 或 `_bmad-output` 时的行为、`--force` 的触发条件、`--ai generic` 无 `--ai-commands-dir` 时的处理、`--bmad-path` 指向路径不存在时的退出码、网络超时的可配置项与默认值，均未在 epics 中明确。**修改后**：Story 10.1 补充「目标路径已存在时报错提示」「--force 非空目录覆盖」；Story 10.2 补充「--yes 时默认 AI 来源 defaultAI>内置第一项」「非 TTY 且无 --ai/--yes 时自动 --yes」；Story 12.1 补充「--ai generic 时须 --ai-commands-dir 或 registry 含 aiCommandsDir，否则退出码 2」；Story 10.5 补充「path 不存在或结构不符合时退出码 4」；Story 13.2 补充 networkTimeoutMs/SDD_NETWORK_TIMEOUT_MS 可配置及默认 30000，以及退出码 1–5 与 PRD 的逐一对应。边界已定义。

- **验收不可执行**：初稿中部分验收标准不可量化。例如「错误码 1-5」未说明各码对应场景，无法编写精确断言；「结构验证」未说明 worktree 共享模式下 bmadPath 的验证要求。**修改后**：Story 13.2 明确退出码 1 通用/结构验证失败、2 --ai 无效、3 网络/模板、4 路径不可用、5 离线 cache 缺失；Story 13.1 明确「结构验证（含 worktree 共享 bmadPath 验证）」「--ignore-agent-tools 跳过 AI 工具检测」。验收可执行。

- **与前置文档矛盾**：初稿 Epic 10 与 Story 10.1 使用「15+ AI」，PRD §5.3 与 ARCH 明确为「19+ 种」内置 AI，存在术语与数量矛盾。**修改后**：Epic 10、Story 10.1 已统一为「19+ AI」，与 PRD/ARCH 一致。

- **FR/NFR 映射完整性**：PRD 需求 → Story 映射表中 US-1～US-12 均已映射至对应 Story；ARCH 组件 → Task 映射表中 InitCommand、TemplateFetcher、AIRegistry、ConfigManager、SkillPublisher、CheckCommand、VersionCommand、UpgradeCommand、ConfigCommand、FeedbackCommand、退出码约定均已映射。修改未改变映射关系，映射完整。

- **Epic–Story 依赖图一致性**：依赖图与各 Story 的依赖列一致，E10.1 为 E10–E13 核心，E11、E12 可并行，E13 依赖 E10、E11。无矛盾。

- **可追溯性**：PRD 需求 ID 与 Story 的映射、ARCH 组件与 Story 的映射均可在 epics.md 中追溯。修改后新增的边界、错误码、参数均在 Story 描述中可追溯至 PRD §5.2、§5.5、US-6 等。可追溯性满足。

**风险与残留不确定性**：即便修改后，仍有以下需下一轮审计或实施阶段验证的点。其一，Story 10.1 描述已包含 --debug、--github-token、--skip-tls，但 PRD §5.2 对 --skip-tls 有「不推荐、仅企业内网」的约束，epics 未体现该约束，实施时可能误用。其二，PRD §5.5 check 结构验证清单列明 _bmad 子目录（core/、cursor/、speckit/、skills/ 等）、worktree 共享模式下验证 bmadPath 指向目录，Story 13.1 与 12.2 已提及，但 epics 未将 §5.5 验证清单的完整条目逐条映射到 Story 验收标准，存在「实施时漏项」风险。其三，PRD §5.12 initLog 结构（timestamp、selectedAI、templateVersion、skillsPublished、skippedReasons）在 Story 12.3 中仅写「initLog」，未展开字段列表，可测试性依赖实施者自行查阅 PRD。其四，PRD §5.0 调用方式约定（npx 一次性 vs 持久安装、bin 配置）在 Epic 10–13 的 Story 中未显式提及，若实施者仅按 Story 描述开发，可能遗漏 package.json bin 与 npx 兼容性。上述残留点不构成本轮必须修复的 gap（因 epics 作为高层规划文档，可引用 PRD 细节），但建议下一轮审计时抽查是否需在 Story 中补充引用或验收要点。

**本轮 gap 结论**：**本轮存在 gap**。具体项：1) Epic 10/Story 10.1 使用「15+ AI」与 PRD/ARCH「19+」矛盾；2) --force、目标路径已存在时报错未覆盖；3) box-drawing 选择器边框未覆盖；4) --ignore-agent-tools 未覆盖；5) --ai generic + --ai-commands-dir 边界与退出码 2 未覆盖；6) --bmad-path 退出码 4 未明确；7) --yes 默认 AI 来源、非 TTY 自动 --yes 未明确；8) networkTimeoutMs/SDD_NETWORK_TIMEOUT_MS 未明确；9) 错误码 1–5 与 PRD 表未逐一对应；10) --debug、--github-token、--skip-tls 未覆盖；11) config --json 未覆盖；12) check 结构验证含 worktree 共享 bmadPath 未明确。**已在本轮内直接修改 epics.md 消除上述 gap**，不计数，建议主 Agent 发起下一轮审计验证修改后的文档。

---

## 4. 已修改内容（epics.md）

审计子代理在本轮内对 `_bmad-output/planning-artifacts/dev/epics.md` 进行了以下直接修改：

1. **Epic 10 描述**：将「15+ AI」改为「19+ AI」，并补充「--force」。
2. **Story 10.1**：补充「ASCII/box-drawing 风格」「19+ AI」「box-drawing 选择器边框」「--force 非空目录覆盖」「目标路径已存在时报错提示」「--debug/--github-token/--skip-tls」。
3. **Story 10.2**：补充「--yes 时默认 AI 来源 defaultAI>内置第一项」「非 TTY 且无 --ai/--yes 时自动 --yes」。
4. **Story 10.5**：补充「path 不存在或结构不符合时退出码 4」。
5. **Story 12.1**：补充「--ai generic 时须 --ai-commands-dir 或 registry 含 aiCommandsDir，否则退出码 2」。
6. **Story 13.1**：补充「结构验证（含 worktree 共享 bmadPath 验证）」「--ignore-agent-tools 跳过 AI 工具检测」。
7. **Story 13.2**：补充「networkTimeoutMs/SDD_NETWORK_TIMEOUT_MS 可配置，默认 30000」「--bmad-path 路径不可用」；将「错误码 1-5」细化为「退出码 1 通用/结构验证失败、2 --ai 无效、3 网络/模板、4 路径不可用、5 离线 cache 缺失」。
8. **Story 13.4**：补充「--json 输出」。

---

## 5. 结论

**未完全覆盖、验证未通过**（初稿）。审计发现 12 项 gap，已在本轮内直接修改 epics.md 消除。修改后的文档在需求完整性、边界定义、可测试性、与 PRD/ARCH 一致性方面已补齐。**建议主 Agent 发起下一轮审计**，验证修改后的 epics.md 是否满足「完全覆盖、验证通过」及「本轮无新 gap」，累计连续 3 轮无 gap 后收敛。

**报告保存路径**：`_bmad-output/implementation-artifacts/_orphan/AUDIT_epics_specify-cn-like-init_§5_round1.md`  
**iteration_count**：1（本 stage 审计未通过轮数）

---

## 可解析评分块（供 parseAndWriteScore）

总体评级: C

维度评分:
- 需求完整性: 72/100
- 可测试性: 75/100
- 一致性: 78/100
- 可追溯性: 85/100
