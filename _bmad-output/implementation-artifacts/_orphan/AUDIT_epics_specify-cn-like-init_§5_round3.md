# epics.md specify-cn-like-init（Epic 10–13）审计报告 §5 round3

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

本报告对 epics.md 中 Epic 10–13（specify-cn-like-init）进行第 3 轮审计。前置：第 1 轮 12 项 gap 已修改；第 2 轮结论「完全覆盖、验证通过」且本轮无新 gap。本轮为收敛判定轮：若结论仍为无 gap，则达成连续 3 轮无 gap，审计收敛。逐条对照 PRD §5–§7、ARCH 各章节及 US-1～US-12，验证需求完整性、可测试性、一致性与可追溯性。**本轮未发现新 gap**，无需修改 epics.md。

---

## 2. 逐条检查结果

### 2.1 PRD User Story 覆盖（US-1～US-12）

| US | PRD 要点 | 映射 Story | 结果 |
|----|----------|------------|------|
| US-1 | 交互式 init、Banner BMAD-Speckit、19+ AI、box-drawing 选择器、--modules、init . / --here | 10.1 | ✅ 已覆盖 |
| US-2 | --ai、--yes、TTY 检测、SDD_AI/SDD_YES、--modules 非交互 | 10.2 | ✅ 已覆盖 |
| US-3 | --template、--offline、templateVersion、cache | 11.1, 11.2 | ✅ 已覆盖 |
| US-4 | registry、configTemplate、detectCommand | 12.1 | ✅ 已覆盖 |
| US-5 | check、version、--list-ai、--json、结构验证退出码 0/1 | 13.1 | ✅ 已覆盖 |
| US-6 | 网络超时、模板失败、--offline cache 缺失、错误码、networkTimeoutMs | 13.2 | ✅ 已覆盖 |
| US-7 | --script sh/ps、路径/编码/换行符、Windows 默认 ps | 10.3 | ✅ 已覆盖 |
| US-8 | defaultAI、defaultScript、项目级覆盖 | 10.4 | ✅ 已覆盖 |
| US-9 | 引用完整性、Skill 发布、--bmad-path、check 验证 | 10.5, 12.2, 12.3, 12.4 | ✅ 已覆盖 |
| US-10 | upgrade、--dry-run、--template、templateVersion | 13.3 | ✅ 已覆盖 |
| US-11 | config get/set/list、--global、networkTimeoutMs、--json | 13.4 | ✅ 已覆盖 |
| US-12 | feedback、init 后 stdout 提示 | 13.5 | ✅ 已覆盖 |

### 2.2 PRD §5.2 init 参数与边界行为

| 参数/边界 | 覆盖 Story | 结果 |
|-----------|------------|------|
| init . / --here | 10.1 | ✅ |
| --no-git | 10.1 | ✅ |
| --force、目标路径已存在 | 10.1 | ✅ |
| --ignore-agent-tools | 13.1 | ✅ |
| --ai generic + --ai-commands-dir、退出码 2 | 12.1 | ✅ |
| --bmad-path 退出码 4 | 10.5、13.2 | ✅ |
| --yes 默认 AI、非 TTY 自动 --yes | 10.2 | ✅ |
| networkTimeoutMs/SDD_NETWORK_TIMEOUT_MS | 13.2 | ✅ |
| 错误码 1–5 与 PRD 表一致 | 13.2 | ✅ |
| --debug、--github-token、--skip-tls | 10.1 | ✅ |
| --ai-skills/--no-ai-skills | 12.3 | ✅ |

### 2.3 ARCH 模块覆盖

| 模块 | 映射 Story | 结果 |
|------|------------|------|
| InitCommand、init 流程状态机 | 10.1, 10.2 | ✅ |
| TemplateFetcher | 11.1, 11.2 | ✅ |
| AIRegistry、ai-builtin | 12.1 | ✅ |
| ConfigManager | 10.4, 13.4 | ✅ |
| SkillPublisher、initLog | 12.3 | ✅ |
| CheckCommand、结构验证 | 12.2, 13.1 | ✅ |
| VersionCommand、UpgradeCommand、ConfigCommand、FeedbackCommand | 13.1, 13.3, 13.4, 13.5 | ✅ |
| 退出码约定 | 13.1, 13.2 | ✅ |

### 2.4 依赖图一致性

E10.1 为核心；E10.2/10.3/10.4/10.5 依赖 E10.1；E11.1→E11.2；E12.1→E12.2→E12.3→E12.4；E13 依赖 E10、E11。与 Story 表依赖列一致。✅

---

## 3. 批判审计员结论

**已检查维度**：遗漏需求点、边界未定义、验收不可执行、与前置文档矛盾、FR/NFR 映射完整性、Epic–Story 依赖图一致性、可追溯性、可量化可验证性、术语一致性、孤岛模块风险、伪实现风险、行号/路径漂移、验收一致性。

**每维度结论**：

- **遗漏需求点**：逐条对照 PRD §5.0–§5.13、§7 User Stories US-1～US-12，以及 ARCH §1–§10 与 §3.2 模块职责表。PRD §5.0 调用方式约定（npx vs 持久安装、bin 配置）为实现层细节，epics 作为规划文档可引用 PRD，无需在 Story 中逐条展开，合理分层。PRD §5.2 所列 init 参数（init . / --here、--ai、--yes、--template、--script、--no-git、--offline、--force、--ignore-agent-tools、--ai-skills/--no-ai-skills、--ai-commands-dir、--debug、--github-token、--skip-tls、--modules、--bmad-path）均已映射至对应 Story。US-1 的「init . 与 init --here 在当前目录初始化」在 Story 10.1 中已体现为「路径确认（init . / --here 当前目录）」；US-1 的「box-drawing 风格选择器边框」在 10.1 中已体现。PRD §5.2 的 --no-git 在 10.1 中已体现为「--no-git 跳过 git init」。PRD §5.2 边界与异常行为（目标路径已存在时报错、--force 覆盖、--ai generic 须 --ai-commands-dir 否则退出码 2、--bmad-path 路径不可用退出码 4、--yes 默认 AI 来源、非 TTY 自动 --yes、networkTimeoutMs 可配置、错误码 1–5 含义）均已覆盖。PRD §5.5 check 结构验证、§5.12 initLog、§5.13 Post-init 引导在 12.2/13.1、12.3、12.4 中均有对应。PRD §5.9 配置持久化（~/.bmad-speckit/config.json、_bmad-output/config/bmad-speckit.json、defaultAI/defaultScript、项目级覆盖）在 10.4、13.4 中覆盖。PRD §5.3 内置 19+ AI、registry 格式、configTemplate、detectCommand 在 12.1 中覆盖。PRD §5.4 模板来源（GitHub Release、cache、--template tag/url）、§5.10 目录结构方案 A、§5.11 引用完整性、§5.12 全局 Skill 发布与 initLog 结构、§5.13 Post-init 引导与 --modules 均在对应 Story 中覆盖。**结论**：无遗漏需求点。

- **边界未定义**：round1 修改后，各边界条件已在 Story 描述中明确。init 目标路径已存在时的行为（报错、--force 覆盖）在 10.1 中定义。--ai generic 无 --ai-commands-dir 时的退出码 2 在 12.1 中定义。--bmad-path 路径不存在或结构不符合时的退出码 4 在 10.5、13.2 中定义。网络超时的可配置项（networkTimeoutMs/SDD_NETWORK_TIMEOUT_MS）与默认 30000 在 13.2 中定义。非 TTY 且无 --ai/--yes 时自动 --yes 在 10.2 中定义。--yes 时默认 AI 来源 defaultAI>内置第一项在 10.2 中定义。--offline 且 cache 无对应模板时退出码 5 在 13.2 中定义。check 结构验证失败退出码 1、成功退出码 0 在 13.1 中定义。upgrade 须在已 init 目录内执行在 13.3 中定义。**结论**：边界已定义，无未定义项。

- **验收不可执行**：各 Story 描述中的验收要点均可量化。10.1「Banner BMAD-Speckit（ASCII/box-drawing 风格）」可验证输出包含指定字符串或 Unicode 边框字符；「19+ AI 列表」可验证列表长度≥19；「路径确认（init . / --here 当前目录）」可编写 E2E 用例。10.2「非 TTY 且无 --ai/--yes 时自动 --yes」可编写「echo | bmad-speckit init」类用例验证无阻塞。13.2「退出码 1 通用/结构验证失败、2 --ai 无效、3 网络/模板、4 路径不可用、5 离线 cache 缺失」可编写精确 exitCode 断言。13.1「结构验证（含 worktree 共享 bmadPath 验证）」可验证 check 在 bmadPath 无效时退出码 1。12.1「--ai generic 时须 --ai-commands-dir 或 registry 含 aiCommandsDir，否则退出码 2」可编写 E2E 用例。12.3「initLog」可验证 _bmad-output/config/bmad-speckit.json 含 timestamp、selectedAI、templateVersion、skillsPublished、skippedReasons。**结论**：验收标准可执行，无不可验证项。

- **与前置文档矛盾**：Epic 10 与 Story 10.1 已统一为「19+ AI」，与 PRD §5.3、ARCH、Appendix D 一致。PRD 错误码表与 Story 13.2 的退出码 1–5 含义逐一对应，无矛盾。ARCH §3.2 模块职责与 Story 映射一致。PRD §5.5 check 结构验证失败退出码 1、成功退出码 0 与 Story 13.1 一致。**结论**：无与前置文档矛盾。

- **FR/NFR 映射完整性**：PRD 需求 → Story 映射表中 US-1～US-12（specify-cn）均已映射至 10.1、10.2、10.3、10.4、10.5、11.1、11.2、12.1、12.2、12.3、12.4、13.1、13.2、13.3、13.4、13.5。ARCH 组件 → Task 映射表中 InitCommand、TemplateFetcher、AIRegistry、ConfigManager、SkillPublisher、CheckCommand、VersionCommand、UpgradeCommand、ConfigCommand、FeedbackCommand、退出码约定均已映射。**结论**：FR/NFR 映射完整。

- **Epic–Story 依赖图一致性**：依赖图中 E10.1 为核心，E10.2/10.3/10.4/10.5 依赖 E10.1；E11.1→E11.2；E12.1→E12.2→E12.3→E12.4；E13 依赖 E10、E11。与各 Story 表的依赖列一致，无矛盾。**结论**：依赖图一致。

- **可追溯性**：每个 PRD 需求 ID（US-1～US-12）均可通过映射表追溯到具体 Story；每个 ARCH 组件均可通过映射表追溯到 Story。Story 描述中的参数、退出码、路径可追溯至 PRD §5.2、§5.5、§5.9 等章节。**结论**：可追溯性满足。

- **可量化可验证性**：Epic 10–13 的 Story 采用浓缩描述格式，与 Epic 6–8 的 Given/When/Then 或 AC 表格式不同，但关键验收点（参数、退出码、路径、配置项）均已明确，实施时可编写单元测试与 E2E 测试。**结论**：可量化可验证性满足。

- **术语一致性**：Epic 10–13 与 PRD、ARCH 在「19+ AI」「BMAD-Speckit」「box-drawing」「worktree 共享」「bmadPath」「initLog」「networkTimeoutMs」等术语上一致。**结论**：术语一致。

- **孤岛模块风险**：Epic 10–13 为规划层 Story 列表，尚未进入实施阶段。各 Story 描述的模块（InitCommand、TemplateFetcher、AIRegistry、ConfigManager、SkillPublisher、CheckCommand 等）在 ARCH 中均有明确职责与调用关系，依赖图正确，实施时按 ARCH §3.2 与 init 流程状态机集成，无孤岛模块设计风险。**结论**：无孤岛模块风险。

- **伪实现风险**：epics 为规划文档，不涉及代码实现。Story 描述均为具体功能点，无 TODO、预留、占位式表述。**结论**：无伪实现风险。

- **行号/路径漂移**：epics 引用 PRD、ARCH 章节号（§5.2、§5.5 等）及路径约定（~/.bmad-speckit、_bmad-output/config 等），均为稳定引用，无行号依赖。**结论**：无行号/路径漂移。

- **验收一致性**：各 Story 验收要点与 PRD User Story 验收标准一一对应，实施时按 PRD AC 执行验收命令即可。**结论**：验收一致性满足。

**质疑与反质疑（对抗视角复核）**：从批判审计员视角，对可能被忽略的边界进行二次质疑。（1）**质疑**：PRD §5.2 要求「非 TTY 且未传 --ai 且未传 --yes：自动视为 --yes」，若实施者仅实现 --yes 而忽略 TTY 检测，是否会导致 CI 管道阻塞？**反质疑**：Story 10.2 已明确「非 TTY 且无 --ai/--yes 时自动 --yes」，实施时须实现 TTY 检测逻辑，验收可编写「echo | bmad-speckit init」类用例验证无阻塞；epics 作为规划层已覆盖该需求。（2）**质疑**：Story 12.3 仅写「initLog」，未列出 timestamp、selectedAI、templateVersion、skillsPublished、skippedReasons 等字段，实施者是否可能漏字段？**反质疑**：PRD §5.12 已定义完整结构，Story 12.3 引用 initLog 即表示须符合 PRD 定义；epics 作为规划层可引用 PRD，不要求逐字段重复。（3）**质疑**：Epic 10–13 无显式「集成测试」或「E2E 测试」任务，是否存在仅单元测试通过但端到端失败的风险？**反质疑**：Epic 10–13 为规划层 Story 列表，实施阶段须按 speckit-workflow 与 TDD 红绿灯执行，每个 Story 完成时应有对应验收命令；epics 不强制要求每 Story 写「E2E 测试」字样，但验收标准可量化即隐含可编写 E2E。（4）**质疑**：PRD §5.5 check 结构验证清单的完整条目（_bmad 子目录 core/cursor/speckit/skills 等）在 PRD 中定义，Story 12.2、13.1 仅写「结构验证」「worktree 共享 bmadPath 验证」，实施者是否可能漏验？**反质疑**：Story 已引用「结构验证」与「worktree 共享 bmadPath 验证」，实施时查阅 PRD §5.5 验证清单即可；epics 合理分层，不要求重复 PRD 全文。（5）**质疑**：PRD §5.2 的 --ai-commands-dir 与 --ai generic 配合，Story 12.1 已覆盖「--ai generic 时须 --ai-commands-dir 或 registry 含 aiCommandsDir，否则退出码 2」，但 --ai-commands-dir 作为 init 参数是否应在 10.1 或 10.2 中显式提及？**反质疑**：--ai-commands-dir 为 --ai generic 的配套参数，逻辑上归属 AI 选择与 registry 范畴，12.1 已覆盖；10.1/10.2 侧重交互/非交互流程，参数解析可由 init 命令统一处理，不构成遗漏。综上，对抗视角复核未发现新 gap。

**本轮 gap 结论**：**本轮无新 gap**。第 1 轮 12 项 gap 已修改；第 2 轮结论「完全覆盖、验证通过」且本轮无新 gap；本轮逐条复核 PRD §5–§7、ARCH 各章节及 US-1～US-12，并执行质疑与反质疑复核，未发现遗漏、矛盾或不可验证项。**连续 3 轮无 gap 已达成**，审计收敛。

---

## 4. 结论

**完全覆盖、验证通过**。Epic 10–13 及对应 Story 已完整覆盖 PRD §5–§7、US-1～US-12 与 ARCH 各章节，验收标准可量化可验证，FR/NFR 映射完整，与前置文档一致。**本轮未发现 gap**，无需修改 epics.md。

**报告保存路径**：`_bmad-output/implementation-artifacts/_orphan/AUDIT_epics_specify-cn-like-init_§5_round3.md`  
**iteration_count**：0（本 stage 第 3 轮，通过）  
**收敛状态**：连续 3 轮无 gap，**审计已收敛**。

---

## 可解析评分块（供 parseAndWriteScore）

总体评级: A

维度评分:
- 需求完整性: 95/100
- 可测试性: 92/100
- 一致性: 95/100
- 可追溯性: 95/100
