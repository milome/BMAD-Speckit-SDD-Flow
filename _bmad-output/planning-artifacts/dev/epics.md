# AI 代码评测体系 — Epics 与 Story 列表

**版本**：1.3  
**来源**：prd.ai-code-eval-system.md、architecture.ai-code-eval-system.md、prd.eval-ux-last-mile.md、_bmad-output/planning-artifacts/dev/PRD_specify-cn-like-init-multi-ai-assistant.md、_bmad-output/planning-artifacts/dev/ARCH_specify-cn-like-init-multi-ai-assistant.md  
**v1.3 变更**：E10–E13 与 PRD AI 目录映射对齐（按所选 AI 写入对应目录、configTemplate 与 spec-kit AGENTS.md 一致、check 按 selectedAI 验证、子代理支持）

---

## 1. Epic 列表

| ID | 名称 | 描述 | 预估工时 | 优先级 |
|----|------|------|----------|--------|
| E1 | feature-eval-scoring-core | 评分核心：四层架构（六环节→四能力维度→综合百分制→L1-L5）、存储 schema、scoring 目录结构、表 A/B 映射 | 5d | P0 |
| E2 | feature-eval-rules-authority | 评分规则与权威文档：scoring/rules YAML、code-reviewer-config ref、SCORING_CRITERIA_AUTHORITATIVE.md、gaps/iteration_tier、环节 3–6 schema | 4d | P0 |
| E3 | feature-eval-lifecycle-skill | 全链路 Skill 与编排：全链路 Code Reviewer Skill、Layer 1–3 同机解析、审计产出解析、scoring 写入、与 speckit-workflow/bmad-story-assistant 协同 | 5d | P0 |
| E4 | feature-eval-coach-veto-integration | AI 代码教练、一票否决、场景与 BMAD 集成：教练定位与输出、角色/Epic 级一票否决、多次迭代阶梯式扣分、场景区分、迭代结束标准、BMAD 五层集成 | 4d | P0 |
| E5 | feature-eval-scoring-enhancement | Scoring 模块功能补充：版本锁定、三阶段评分规则、LLM 解析容错、聚类分析、SFT 提取、Prompt 优化、规则自优化、Bugfix 回写、回退建议等 12 项技术交底书声称功能 | 10-17d | P0 |
| E6 | eval-ux-coach-and-query | 用户体验层 Coach 与查询：零参数 Coach 诊断、Epic/Story 筛选、评分查询层、/bmad-scores、bmad-eval-analytics Skill | 5d | P0 |
| E7 | eval-ux-dashboard-and-sft | 仪表盘与 SFT 提取：项目健康度、四维雷达图、短板 Top 3、/bmad-dashboard、/bmad-sft-extract、bmad-eval-analytics 扩展 | 4d | P1 |
| E8 | eval-question-bank | 评测题库：manifest 目录结构、list/add 命令、run 与 eval_question 集成、版本隔离 | 3d | P2 |
| E9 | feature-scoring-full-pipeline | 评分全链路写入与仪表盘聚合：bmad-story-assistant 阶段四 parse-and-write-score、仪表盘按 epic/story 聚合、Story 完成自检、run_id 共享策略 | 5d | P0 |
| E10 | speckit-init-core | specify-cn 类 init 核心：交互式/非交互式初始化、Banner BMAD-Speckit、19+ AI 选择、--modules、--force、配置持久化、跨平台脚本生成 | 8d | P0 |
| E11 | speckit-template-offline | 模板拉取与离线：--template、--offline、cache、templateVersion 持久化 | 3d | P0 |
| E12 | speckit-ai-skill-publish | AI 扩展与 Skill 发布：registry、19+ 内置 configTemplate（与 spec-kit AGENTS.md 对齐）、按所选 AI 写入对应目录、引用完整性、worktree 共享（--bmad-path） | 6d | P0 |
| E13 | speckit-diagnostic-commands | 诊断与运维子命令：check、version、upgrade、config、feedback、异常路径与错误码 | 5d | P0 |

---

## 2. Story 列表

### Epic 1：feature-eval-scoring-core

| Story ID | 描述 | 依赖 | 预估工时 | 风险 |
|----------|------|------|----------|------|
| 1.1 | eval-system-scoring-core：实现四层架构（六环节分项评分、四能力维度聚合、综合百分制、L1-L5 等级）、六环节权重 20/25/25/15/10/5、存储 schema（run_id/scenario/stage/phase_score/check_items/iteration_count/iteration_records/first_pass）、scoring/data 与 scoring/rules 目录结构、表 A 表 B 映射 | 无 | 3d | 低 |
| 1.2 | eval-system-storage-writer：实现评分写入逻辑，支持 JSON/JSONL 追加模式，单次运行单文件与 scores.jsonl 双模式，check_items 明细结构 | E1.1 | 2d | 低 |

### Epic 2：feature-eval-rules-authority

| Story ID | 描述 | 依赖 | 预估工时 | 风险 |
|----------|------|------|----------|------|
| 2.1 | eval-rules-yaml-config：实现 scoring/rules 下环节 2/3/4 的 YAML schema，与 code-reviewer-config 通过 ref 衔接，veto_items、weights、items 结构，gaps-scoring.yaml、iteration-tier.yaml | E1.1 | 2d | 中 |
| 2.2 | eval-authority-doc：产出 scoring/docs/SCORING_CRITERIA_AUTHORITATIVE.md，含 24 项内容（BMAD 五层、阶段→环节映射、检查项清单、一票否决、L1-L5、schema、Code Reviewer 整合、Epic 综合评分等），与 scoring/rules 一致且可追溯；须含题量表述（区分已实现题数 vs 目标题池规模、与文档/产出一致）；spec/tasks 须含「24 项与需求 §3.10 逐一核对清单」以可验证 | E2.1 | 2d | 低 |

### Epic 3：feature-eval-lifecycle-skill

| Story ID | 描述 | 依赖 | 预估工时 | 风险 |
|----------|------|------|----------|------|
| 3.1 | eval-lifecycle-skill-def：定义全链路 Code Reviewer Skill（bmad-code-reviewer-lifecycle），引用 code-reviewer、audit-prompts、code-reviewer-config、scoring/rules，编排逻辑（触发时机、stage 映射、解析规则） | E1.2, E2.1 | 2d | 中 |
| 3.2 | eval-layer1-3-parser：实现 Layer 1（prd/arch）、Layer 3（story）审计产出的同机解析，从 audit-prompts-prd/arch、Create Story 审计报告提取维度，映射环节 1 检查项，约定 AUDIT_Story_{epic}-{story}.md 路径 | E3.1 | 2d | 中 |
| 3.3 | eval-skill-scoring-write：全链路 Skill 在 stage 审计通过后调用解析并写入 scoring 存储，与 speckit-workflow、bmad-story-assistant 协同，触发模式表实现 | E3.1, E3.2 | 1d | 低 |

### Epic 4：feature-eval-coach-veto-integration

| Story ID | 描述 | 依赖 | 预估工时 | 风险 |
|----------|------|------|----------|------|
| 4.1 | eval-veto-iteration-rules：实现一票否决项与环节映射（OWASP Top 10、CWE-798、核心需求遗漏等）、角色一票否决权（批判审计员、AI 代码教练）、Epic 级一票否决 8 项条件、多次迭代阶梯式扣分（1 次 100%/2 次 80%/3 次 50%/≥4 次 0%）、致命/严重问题差异化 | E2.1 | 2d | 中 |
| 4.2 | eval-ai-coach：实现 AI 代码教练定位、职责、人格、技能配置（引用全链路 Skill）、工作流、输出格式（summary/phase_scores/weak_areas/recommendations/iteration_passed）、一票否决权，禁止「面试」主导表述 | E3.3 | 1d | 低 |
| 4.3 | eval-scenario-bmad-integration：实现场景区分（real_dev/eval_question）、两种场景均走 Layer 1→5 完整路径、各阶段迭代结束标准、轻量化三原则（同机执行、可选启用、最小侵入）、数据污染防护（题目来源与时间隔离、定期迭代题池、混淆变量校验、私有闭卷与评测接口分离；操作要点与触发条件可置于 scoring/ 或项目 checklist）、与 BMAD 五层 workflows 集成点 | E3.3 | 1d | 低 |

### Epic 5：feature-eval-scoring-enhancement

| Story ID | 描述 | 依赖 | 预估工时 | 风险 |
|----------|------|------|----------|------|
| 5.1 | eval-foundation-modules：版本锁定校验（B02）、触发加载器（B04）、eval_question E2E（B10）、Bugfix 回写（B12）、Git 回退建议（B13） | E4 | 14-28h | 低 |
| 5.2 | eval-scoring-rules-expansion：spec/plan/tasks 三阶段评分规则（B03）、四维加权评分（B11） | E2.1 | 20-36h | 中 |
| 5.3 | eval-parser-llm-fallback：LLM 结构化提取容错层（B05） | E5.2 | 16-24h | 中 |
| 5.4 | eval-analytics-clustering：能力短板聚类分析（B06） | 无 | 8-12h | 低 |
| 5.5 | eval-analytics-advanced：SFT 提取（B07）、Prompt 优化建议（B08）、规则自优化建议（B09） | E5.4 | 20-36h | 中 |

### Epic 6：eval-ux-coach-and-query

| Story ID | 描述 | 依赖 | 预估工时 | 风险 |
|----------|------|------|----------|------|
| 6.1 | Coach Command 无参数运行：零参数 /bmad-coach 触发诊断，空目录友好提示，数据量限制 N（默认 100） | 无 | 1d | 低 |
| 6.2 | Coach 按 Epic/Story 筛选：--epic 3、--story 3.3，无约定数据时明确反馈 | E6.1 | 0.5d | 低 |
| 6.3 | 评分查询层（scoring/query/）：queryByEpic、queryByStory、queryLatest、queryByStage、queryByScenario，同 run_id+stage 去重 | E6.1 | 1d | 中 |
| 6.4 | Scores Command：/bmad-scores 全部或按 Epic/Story 筛选，表格格式汇总 | E6.3 | 0.5d | 低 |
| 6.5 | bmad-eval-analytics Skill 扩展：自然语言触发 Coach，复用 discoverLatestRunIds | E6.1 | 0.5d | 低 |

### Epic 7：eval-ux-dashboard-and-sft

| Story ID | 描述 | 依赖 | 预估工时 | 风险 |
|----------|------|------|----------|------|
| 7.1 | 仪表盘生成器：项目健康度总分、四维雷达图、短板 Top 3、Veto 统计、趋势，输出到 _bmad-output/dashboard.md | E6 | 1.5d | 低 |
| 7.2 | SFT 提取 Command：/bmad-sft-extract 无参数、阈值可配置、git diff fallback、去重、JSONL 输出 | E5.5 | 1d | 中 |
| 7.3 | SFT 纳入 bmad-eval-analytics Skill：自然语言触发「提取微调数据集」 | E7.2 | 0.5d | 低 |
| 7.4 | Coach discovery 仅 real_dev：discovery/Coach 加 scenario 过滤，`--scenario real_dev` 或默认仅诊断 real_dev | E6 | 0.5d | 低 |

### Epic 8：eval-question-bank

| Story ID | 描述 | 依赖 | 预估工时 | 风险 |
|----------|------|------|----------|------|
| 8.1 | 题库目录结构与 manifest：scoring/eval-questions/v1/、manifest.yaml schema（id、title、path、difficulty、tags） | 无 | 0.5d | 低 |
| 8.2 | 题库 list 与 add 命令：/bmad-eval-questions list、add --title，生成 q00X-{slug}.md 模板 | E8.1 | 0.5d | 低 |
| 8.3 | 题库 run 命令与 eval_question 集成：run --id --version，scenario=eval_question、question_version 注入，run_id 含 version | E8.2 | 1d | 中 |

### Epic 9：feature-scoring-full-pipeline

| Story ID | 描述 | 依赖 | 预估工时 | 风险 |
|----------|------|------|----------|------|
| 9.1 | 评分全链路实施：T1～T9、T11。T12、T10 已在 Phase 0 完成 | 无 | 5d | 中 |
| 9.2 | stage=implement 扩展（中期增强）：parse-and-write-score 支持 stage=implement，配套 implement 专用解析规则；当前采用 trigger_stage 短期方案，本 Story 为后续架构演进承接 | E9.1 | 待排期 | 低 |
| 9.3 | Epic 级仪表盘聚合：仅传 --epic N 时展示 Epic 下多 Story 聚合视图，采用方案 A（Per-Story 总分后简单平均） | E9.1 | 2d | 低 |
| 9.4 | 迭代评分演进存储：IterationRecord 新增 optional overall_grade、dimension_scores（scoring/writer/types.ts、run-score-schema.json）；parseAndWriteScore 支持 iterationReportPaths，pass 时一次性解析失败轮报告写入 iteration_records；CLI 新增 --iterationReportPaths；失败轮路径约定：AUDIT_{stage}-E{epic}-S{story}_round{N}.md 或 _orphan/AUDIT_{slug}_round{N}.md，验证轮报告不列入；Coach、仪表盘从 iteration_records 取 overall_grade 序列展示「第1轮 C → 第2轮 B → 第3轮 A」；文档更新 docs/BMAD/仪表盘健康度说明与数据分析指南.md | E9.1 | 3d | 低 |
| 9.5 | speckit 全 stage 评分写入规范：在 audit-prompts.md §1～§5 各节末尾追加【审计后动作】段落，要求审计通过时将报告保存至调用方指定的 reportPath 并在结论中注明 iteration_count；在 speckit-workflow SKILL §1.2～§5.2 各「审计通过后评分写入触发」段落中补充「发给子 Agent 的 prompt 必须包含落盘路径」；在 bmad-story-assistant SKILL 中强化 speckit 嵌套流程的审计 prompt 模板，显式包含落盘路径与 iteration_count 输出要求。任务详情见 _bmad-output/implementation-artifacts/epic-9-feature-scoring-full-pipeline/TASKS_speckit全stage评分写入改进.md、ANNEX_speckit全stage评分写入改进.md。可选任务：Story 9.3 全 stage 补齐或 implement-only 补齐（用户决策） | E9.3 | 1d | 低 |

### Epic 10：speckit-init-core

| Story ID | 描述 | 依赖 | 预估工时 | 风险 |
|----------|------|------|----------|------|
| 10.1 | 交互式 init：Banner BMAD-Speckit（ASCII/box-drawing 风格）、19+ AI 列表（支持过滤、box-drawing 选择器边框）、路径确认（init . / --here 当前目录）、模板版本选择、--modules 选择性初始化、--force 非空目录覆盖、--no-git 跳过 git init、目标路径已存在时报错提示、--debug/--github-token/--skip-tls | 无 | 3d | 低 |
| 10.2 | 非交互式 init：--ai、--yes、TTY 检测、环境变量 SDD_AI/SDD_YES、--modules 非交互（**须与 --ai、--yes 配合**）；--yes 时默认 AI 来源 defaultAI>内置第一项；非 TTY 且无 --ai/--yes 时自动 --yes | E10.1 | 1.5d | 低 |
| 10.3 | 跨平台脚本生成：--script sh/ps、路径/编码/换行符、Windows 默认 ps | E10.1 | 1d | 中 |
| 10.4 | 配置持久化：~/.bmad-speckit/config.json、_bmad-output/config/bmad-speckit.json、defaultAI/defaultScript、项目级覆盖 | E10.1 | 1d | 低 |
| 10.5 | --bmad-path worktree 共享：不复制 _bmad、仅创建 _bmad-output、bmadPath 记录、check 验证；**须与 --ai、--yes 配合非交互使用**；path 不存在或结构不符合时退出码 4 | E10.1 | 1.5d | 中 |

### Epic 11：speckit-template-offline

| Story ID | 描述 | 依赖 | 预估工时 | 风险 |
|----------|------|------|----------|------|
| 11.1 | 模板拉取：GitHub Release、cache 至 ~/.bmad-speckit/templates/、--template tag/url；网络超时由 networkTimeoutMs 或 SDD_NETWORK_TIMEOUT_MS 控制（默认 30000ms） | 无 | 1.5d | 中 |
| 11.2 | 离线与版本锁定：--offline、templateVersion 写入 bmad-speckit.json | E11.1 | 0.5d | 低 |

### Epic 12：speckit-ai-skill-publish

| Story ID | 描述 | 依赖 | 预估工时 | 风险 |
|----------|------|------|----------|------|
| 12.1 | AI Registry：~/.bmad-speckit/ai-registry.json、项目级覆盖、19+ 内置 configTemplate（与 spec-kit AGENTS.md 对齐：opencode→.opencode/command、auggie→.augment/rules、bob→.bob/commands、shai→.shai/commands、codex→.codex/commands）；configTemplate 须含 §5.3.1 适用字段（commandsDir、rulesDir 至少其一；skillsDir 若 AI 支持 skill 则必填；agentsDir 或 configDir 二选一；vscodeSettings 可选）及 §5.12.1 subagentSupport；detectCommand；--ai generic 时须 --ai-commands-dir 或 registry 含 aiCommandsDir，否则退出码 2 | 无 | 1.5d | 低 |
| 12.2 | 引用完整性：按 configTemplate 同步 commands/rules/config 到所选 AI 目标目录（禁止写死 .cursor/）；若 configTemplate 含 vscodeSettings，写入 .vscode/settings.json；check 按 selectedAI 验证对应目录（含 opencode/bob/shai/codex 显式条目）；--bmad-path 验证 | E10.1, E12.1 | 1.5d | 中 |
| 12.3 | Skill 发布：_bmad/skills/ 按 configTemplate.skillsDir 同步到所选 AI 全局目录、initLog、--ai-skills/--no-ai-skills；无子代理支持 AI 时 init/check 输出提示 | E12.2, E10.1 | 1.5d | 中 |
| 12.4 | Post-init 引导：stdout 输出 /bmad-help 提示、模板含 bmad-help、speckit.constitution | E10.1 | 0.5d | 低 |

### Epic 13：speckit-diagnostic-commands

| Story ID | 描述 | 依赖 | 预估工时 | 风险 |
|----------|------|------|----------|------|
| 13.1 | check 与 version：诊断输出、--list-ai、--json、结构验证（按 selectedAI 验证对应目标目录：cursor-agent→.cursor/、claude→.claude/、gemini→.gemini/、windsurf→.windsurf/workflows、kilocode→.kilocode/rules、auggie→.augment/rules、roo→.roo/rules、opencode→.opencode/command、bob→.bob/commands、shai→.shai/commands、codex→.codex/commands 等；worktree 共享 bmadPath 验证；**无 selectedAI 时跳过 AI 目标目录验证或验证 .cursor 向后兼容**）退出码 0/1、--ignore-agent-tools 跳过 AI 工具检测、子代理支持等级输出 | E10.1 | 1.5d | 低 |
| 13.2 | 异常路径：网络超时（networkTimeoutMs/SDD_NETWORK_TIMEOUT_MS 可配置，默认 30000）、模板失败、--offline cache 缺失、--bmad-path 路径不可用；退出码 1 通用/结构验证失败、2 --ai 无效（**须输出可用 AI 列表或提示运行 check --list-ai**）、3 网络/模板、4 路径不可用、5 离线 cache 缺失 | E11.1 | 0.5d | 低 |
| 13.3 | upgrade：已 init 目录内执行、--dry-run、--template、templateVersion 更新 | E11.1 | 1d | 低 |
| 13.4 | config：get/set/list、项目级优先、--global、defaultAI/defaultScript/templateSource/networkTimeoutMs、--json 输出 | E10.4 | 1d | 低 |
| 13.5 | feedback：init 后 stdout 提示、feedback 子命令输出反馈入口；**feedback 输出或关联文档须含全流程兼容 AI 清单**（PRD §5.12.1，建议 cursor-agent、claude、qwen、auggie、codebuddy、amp、qodercli、kiro-cli） | E10.1 | 0.5d | 低 |

---

## 3. PRD 需求 → Story 映射

| PRD 需求 ID | 映射 Story |
|-------------|------------|
| REQ-1.1~1.6 | 1.1, 4.3 |
| REQ-2.1~2.5 | 1.1, 3.2, 4.3 |
| REQ-3.1~3.10 | 1.1, 1.2, 2.1, 2.2, 4.1 |
| REQ-3.11 | 4.3 |
| REQ-3.12~3.17, REQ-3.13a | 2.1, 2.2, 3.1, 3.2, 3.3, 4.1, 4.2 |
| REQ-4.1, REQ-5.1, REQ-5.2, REQ-6.1, REQ-6.2 | 2.2, 4.3 |
| REQ-UX-1.1~1.7 | 6.1, 6.2, 6.5 |
| REQ-UX-2.1~2.6 | 6.3, 6.4 |
| REQ-UX-3.1~3.7 | 7.1 |
| REQ-UX-4.1~4.7 | 7.2, 7.3 |
| REQ-UX-5.1~5.9 | 8.1, 8.2, 8.3 |
| US-1（specify-cn） | 10.1 |
| US-2（specify-cn） | 10.2 |
| US-3（specify-cn） | 11.1, 11.2 |
| US-4（specify-cn） | 12.1 |
| US-5（specify-cn） | 13.1 |
| US-6（specify-cn） | 13.2 |
| US-7（specify-cn） | 10.3 |
| US-8（specify-cn） | 10.4 |
| US-9（specify-cn） | 10.5, 12.2, 12.3, 12.4 |
| US-10（specify-cn） | 13.3 |
| US-11（specify-cn） | 13.4 |
| US-12（specify-cn） | 13.5 |

---

## 4. Architecture 组件 → Task 映射

| Architecture 组件 | 映射 Story |
|-------------------|------------|
| 评分规则 scoring/rules/*.yaml | 2.1 |
| 权威文档 SCORING_CRITERIA_AUTHORITATIVE.md | 2.2 |
| 评分存储 scoring/data/、schema | 1.1, 1.2 |
| 全链路 Skill | 3.1, 3.2, 3.3 |
| code-reviewer-config 引用关系 | 2.1, 3.1 |
| audit-prompts 引用关系 | 3.1, 3.2 |
| 表 A 表 B | 1.1, 2.2 |
| 审计产出→评分环节映射 | 3.2, 2.2 |
| Layer 1–3 同机解析 | 3.2 |
| 数据流、BMAD 集成点 | 3.3, 4.3 |
| 数据污染防护（§3.7 四条） | 4.3 |
| 题量表述（§3.9 已实现 vs 目标规模） | 2.2 |
| InitCommand、init 流程状态机（specify-cn） | 10.1, 10.2 |
| TemplateFetcher（specify-cn） | 11.1, 11.2 |
| AIRegistry、ai-builtin、configTemplate 与 spec-kit 对齐（specify-cn） | 12.1 |
| ConfigManager（specify-cn） | 10.4, 13.4 |
| SkillPublisher、按 configTemplate.skillsDir 同步、initLog（specify-cn） | 12.3 |
| CheckCommand、按 selectedAI 验证目标目录、结构验证（specify-cn） | 12.2, 13.1 |
| VersionCommand、UpgradeCommand、ConfigCommand、FeedbackCommand（specify-cn） | 13.1, 13.3, 13.4, 13.5 |
| 退出码约定、错误码（specify-cn） | 13.1, 13.2 |

---

## 5. 依赖图

```
E1.1 (scoring-core)
    ├──→ E1.2 (storage-writer)
    └──→ E2.1 (rules-yaml)

E2.1 (rules-yaml)
    ├──→ E2.2 (authority-doc)
    └──→ E4.1 (veto-iteration)

E1.2, E2.1
    └──→ E3.1 (lifecycle-skill-def)

E3.1
    ├──→ E3.2 (layer1-3-parser)
    └──→ E3.3 (skill-scoring-write)

E3.2
    └──→ E3.3

E3.3
    └──→ E4.2 (ai-coach), E4.3 (scenario-bmad)

E2.1
    └──→ E4.1 (veto-iteration)
```

**关键路径**：E1.1 → E1.2 → E3.1 → E3.2 → E3.3 → E4.2/E4.3

```
E5 (已完成)
    └──→ E6 (eval-ux-coach-and-query)
              └──→ E7 (eval-ux-dashboard-and-sft)
E8 (eval-question-bank) 可独立或与 E6 并行
```

**E6–E8 路径**：E6.1 独立 → E6.2/E6.3 可并行 → E6.4/E6.5；E7 依赖 E6；E8 可独立启动

```
E10.1 (交互式 init)
    ├──→ E10.2 (非交互)
    ├──→ E10.3 (脚本生成)
    ├──→ E10.4 (配置持久化)
    └──→ E10.5 (--bmad-path)

E11.1 (模板拉取)
    └──→ E11.2 (离线)

E12.1 (Registry)
    └──→ E12.2 (引用完整性)
              └──→ E12.3 (Skill 发布)
                        └──→ E12.4 (Post-init 引导)

E10.1, E11.1 → E13.1 (check/version), E13.2 (异常路径), E13.3 (upgrade)
E10.4 → E13.4 (config)
E10.1 → E13.5 (feedback)
```

**E10–E13 路径**：E10.1 为核心；E11、E12 可并行；E13 依赖 E10、E11。

---

## 6. 命名规范

- **Epic**：feature-{domain}-{capability}（如 feature-eval-scoring-core）
- **Story**：{epic_num}.{story_num} {description}（如 1.1 eval-system-scoring-core）

---

*本文档确保每个 PRD 需求映射到至少一个 Story，每个 Architecture 组件映射到至少一个 task。*

---

# Epic 5: feature-eval-scoring-enhancement — Scoring 模块功能补充

**版本**：1.0  
**来源**：`_bmad-output/patent/TASKS_gaps功能补充实现.md` v2.1（三轮审计通过）、`_bmad-output/patent/技术交底书_BMAD-Speckit-SDD-Flow.md`  
**前置已完成**：GAP-B01（RunScoreRecord 版本追溯字段，路径 C：base_commit_hash + content_hash）

---

## 1. Epic 概述

### 1.1 目标

补充 Scoring 模块中技术交底书声称但尚未实现的 12 项功能（GAP-B02 至 GAP-B13），使系统具备：
1. 跨阶段版本锁定校验能力（B02）
2. spec/plan/tasks 三阶段完整评分规则（B03）
3. YAML 配置驱动的程序化触发控制（B04）
4. 审计报告解析容错层（B05）
5. 能力短板聚类分析与 AI Coach 增强（B06）
6. SFT 微调数据集提取能力（B07）
7. Prompt 模板优化建议生成（B08）
8. 评分规则自优化反馈（B09）
9. eval_question 场景端到端验证（B10）
10. 四维加权评分的程序化实现（B11）
11. Bugfix 数据自动回写到主 Story（B12）
12. D 级熔断后 Git 回退建议（B13）

### 1.2 范围

- **包含**：scoring/ 目录下的新增模块（gate、trigger、analytics、bugfix、parsers 扩展）及其测试
- **包含**：config/ 下评分规则 YAML 的补充
- **包含**：scripts/ 下 CLI 工具的新增和扩展
- **不包含**：技术交底书本身的文字修改（由 `TASKS_交底书改进.md` 单独管理）
- **不包含**：UI/前端展示层

### 1.3 成功标准

| 标准 | 度量 |
|------|------|
| 功能覆盖 | 12 个 GAP 全部实现，无降级方案 |
| 测试覆盖 | 新增 68 个测试用例全部通过，零回归 |
| 代码质量 | 每个 Story 实施后审计达到 B 级以上 |
| 向后兼容 | 现有 129+ 个测试持续通过，`RunScoreRecord` 新增字段全部可选 |
| 文档一致 | 技术交底书声称的功能与代码实现一致（无"声称但未实现"的 Gap） |

### 1.4 风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| B05 LLM API 依赖引入外部网络调用 | 离线环境不可用 | 严格 fallback 链：正则 → LLM → 抛异常；无 API key 时跳过 LLM |
| B05 审计报告发送至外部 LLM API | 数据安全 | 环境变量控制开关 + system prompt 限制输出 |
| Schema 膨胀（5 个新增字段） | 维护成本增加 | 所有字段可选，JSDoc 语义标注清晰 |
| B06-B09 分析模块实用性待验证 | 投入产出比不确定 | 独立于评分流水线，失败不影响核心功能 |

---

## 2. Story 列表

| Story ID | 名称 | 包含 GAP | 依赖 | 预估工期 |
|----------|------|---------|------|---------|
| 5.1 | eval-foundation-modules | B02, B04, B10, B12, B13 | E4（已完成） | 14-28h |
| 5.2 | eval-scoring-rules-expansion | B03, B11 | E2.1（已完成） | 20-36h |
| 5.3 | eval-parser-llm-fallback | B05 | Story 5.2（B03 的 audit-generic.ts） | 16-24h |
| 5.4 | eval-analytics-clustering | B06 | 无（可独立，但 B03 数据源扩大分析范围） | 8-12h |
| 5.5 | eval-analytics-advanced | B07, B08, B09 | Story 5.4（B06 聚类结果） | 20-36h |

---

## 3. Story 详细定义

### Story 5.1: eval-foundation-modules（基础模块 + 独立模块）

**As a** Scoring 系统的开发者，  
**I want** 跨阶段版本锁定校验、程序化触发控制、eval_question 端到端验证、Bugfix 回写、Git 回退建议，  
**So that** Scoring 系统具备完整的流转控制和闭环能力。

**包含 GAP**：B02（版本锁定）、B04（触发加载器）、B10（eval_question E2E）、B12（Bugfix 回写）、B13（回退建议）

**Acceptance Criteria:**

**Given** specify 阶段审计通过且 `source_hash` 已写入记录  
**When** plan 阶段启动时调用 `checkPreconditionHash`  
**Then** 系统比对 spec.md 当前 hash 与记录中的 `source_hash`，匹配则 proceed，不匹配则 block  
**And** 上一阶段无记录时返回 warn_and_proceed

**Given** `scoring-trigger-modes.yaml` 中 `enabled=true` 且 stage 已注册  
**When** 调用 `shouldWriteScore(event, stage, scenario)`  
**Then** 返回 `write=true` 和正确的 `writeMode`  
**And** `enabled=false` 或 stage 未注册时返回 `write=false`

**Given** eval_question 场景的审计报告  
**When** 执行 parse → write → coach diagnose 全链路  
**Then** 记录正确写入且 coach 诊断成功  
**And** content_hash 和 base_commit_hash 正确填充

**Given** BUGFIX 文档的 §7 已完成任务列表  
**When** 调用 `writebackBugfixToStory`  
**Then** progress.txt 追加格式化的回写行（时间戳 + branchId + storyId + 摘要）  
**And** 支持 `[x]`、`[X]`、`* [x]`、缩进等 Markdown checkbox 变体

**Given** D 级熔断触发  
**When** 调用 `suggestRollback`  
**Then** 返回包含告警前缀的回退建议和命令列表  
**And** 不自动执行任何 git 操作

**新增文件**: 5 实现 + 5 测试 + 2 fixture = 12  
**修改文件**: types.ts, run-score-schema.json, parse-and-write.ts, parse-and-write-score.ts = 4  
**新增测试**: 7+7+3+6+4 = 27

---

### Story 5.2: eval-scoring-rules-expansion（评分规则扩展 + 四维加权）

**As a** Scoring 系统的审计触发方，  
**I want** spec/plan/tasks 三阶段具备完整的百分制评分规则，且审计报告支持四维加权评分，  
**So that** 全流程每个节点都有程序化的评分标准，且评分维度权重由配置驱动。

**包含 GAP**：B03（评分规则）、B11（四维加权）

**Acceptance Criteria:**

**Given** spec 阶段的审计报告  
**When** 调用通用解析器 `parseGenericReport`  
**Then** 正确解析为 `RunScoreRecord`，stage='spec'，phaseWeight=0.2  
**And** check_items 包含 spec_demand_coverage 等 item_id  
**And** plan、tasks 阶段同理

**Given** spec-scoring.yaml 中定义了 4 个 items 和 1 个 veto_item  
**When** `applyTierAndVeto` 处理 spec 阶段记录  
**Then** 正确应用扣分和一票否决逻辑

**Given** 审计报告包含维度评分（`维度名: 分数/100` 格式）  
**When** 调用 `parseDimensionScores(content, mode)`  
**Then** 返回 DimensionScore 数组，加权总分 = Σ(score × weight / 100)  
**And** 报告无维度评分时返回空数组（fallback 到等级映射）

**Given** `stageToMode('spec')` 调用  
**When** 执行映射  
**Then** 返回 'prd' mode（spec/plan/tasks 共用 prd 维度定义）

**新增文件**: 2 实现 + 2 测试 + 4 fixture = 8  
**修改文件**: 3 YAML + audit-index.ts + parsers/index.ts + run-score-schema.json + parse-and-write-score.ts + audit-prd.ts + weights.ts = 9  
**新增测试**: 9+6 = 15

---

### Story 5.3: eval-parser-llm-fallback（LLM 结构化提取容错层）

**As a** Scoring 系统的解析模块，  
**I want** 在正则解析失败时自动调用 LLM 做结构化提取，  
**So that** 非标格式的审计报告也能被正确解析。

**包含 GAP**：B05

**前置依赖**: Story 5.2（`audit-generic.ts` 中的 `extractOverallGrade` 需已迁移）

**Acceptance Criteria:**

**Given** 审计报告正则解析成功  
**When** 执行解析流程  
**Then** 不调用 LLM API

**Given** 正则解析失败且 `SCORING_LLM_API_KEY` 已配置  
**When** 调用 `llmStructuredExtract`  
**Then** 返回 `{ grade, issues, veto_items }` 结构化结果  
**And** schema 校验失败时重试 1 次

**Given** `SCORING_LLM_API_KEY` 未配置  
**When** 正则解析失败  
**Then** 抛出原始 ParseError（与当前行为一致）

**新增文件**: 1 实现 + 1 测试 = 2  
**修改文件**: audit-prd.ts, audit-arch.ts, audit-story.ts, audit-generic.ts = 4  
**新增测试**: 6

---

### Story 5.4: eval-analytics-clustering（能力短板聚类分析）

**As a** AI Coach 模块，  
**I want** 基于 check_items 失败模式的两层聚类分析（item_id 频率 + 关键词聚合），  
**So that** 能力短板识别从简单阈值判定升级为结构化聚类分析。

**包含 GAP**：B06

**Acceptance Criteria:**

**Given** 多条 RunScoreRecord 中存在相同 item_id 的 check_items 失败  
**When** 调用 `clusterWeaknesses(records, minFrequency=2)`  
**Then** 聚合为 WeaknessCluster，包含 keywords、severity_distribution、affected_stages  
**And** severity 从 score_delta 反向映射（≤-10→高，-10~-5→中，>-5→低）

**Given** AI Coach `coachDiagnose` 调用  
**When** 执行诊断  
**Then** `weak_areas` 保持 string[] 向后兼容  
**And** 新增 `weakness_clusters` 字段包含完整聚类结果

**新增文件**: 1 实现 + 1 测试 + 1 CLI = 3  
**修改文件**: diagnose.ts, coach/types.ts = 2  
**新增测试**: 5

---

### Story 5.5: eval-analytics-advanced（SFT 提取 + Prompt 优化 + 规则建议）

**As a** 模型优化反馈闭环系统，  
**I want** 从 C/D 级审计记录中提取 SFT 数据集、生成 Prompt 优化建议、生成规则升级建议，  
**So that** 审计数据能反向驱动模型能力和管控规则的持续优化。

**包含 GAP**：B07（SFT 提取）、B08（Prompt 优化）、B09（规则建议）

**前置依赖**: Story 5.4（B06 聚类结果作为 B08/B09 输入）

**Acceptance Criteria:**

**Given** scores.jsonl 中存在 phase_score ≤ 60 的 C/D 级记录  
**When** 调用 `extractSftDataset`  
**Then** 从 source_path 关联 BUGFIX 文档，提取 §1/§4 作为 instruction  
**And** 通过 git diff 提取 bad/good 代码对  
**And** source_path 不存在或 git diff 失败时跳过该记录并 warn

**Given** WeaknessCluster 聚类结果  
**When** 调用 `generatePromptSuggestions(clusters)`  
**Then** 匹配 skills/ 目录下的 Skill 文件（关键词交集 ≥ 2）  
**And** 输出 PromptSuggestion 列表（priority 按 frequency 分级）

**Given** WeaknessCluster 聚类结果  
**When** 调用 `generateRuleSuggestions(clusters)`  
**Then** 失败率 >50% 且 deduct<8 → increase_deduct  
**And** 失败率 >80% → promote_to_veto  
**And** 输出 YAML 建议文件，不直接修改规则文件

**新增文件**: 3 实现 + 3 测试 + 3 CLI = 9  
**修改文件**: types.ts, run-score-schema.json, parse-and-write.ts = 3  
**新增测试**: 7+4+4 = 15

---

## 4. 需求 → Story 映射

| 来源需求（TASKS_gaps v2.1 中的 GAP） | 映射 Story |
|--------------------------------------|-----------|
| B02 版本锁定机制 | 5.1 |
| B03 spec/plan/tasks 评分规则 | 5.2 |
| B04 触发加载器 | 5.1 |
| B05 LLM 结构化提取 | 5.3 |
| B06 聚类分析 | 5.4 |
| B07 SFT 提取 | 5.5 |
| B08 Prompt 优化建议 | 5.5 |
| B09 规则自优化 | 5.5 |
| B10 eval_question E2E | 5.1 |
| B11 四维加权评分 | 5.2 |
| B12 Bugfix 回写 | 5.1 |
| B13 Git 回退建议 | 5.1 |

---

## 5. 依赖图

```
E1-E4 (已完成)
    └──→ E5.1 (foundation-modules)  [B02,B04,B10,B12,B13]
    └──→ E5.2 (scoring-rules)      [B03,B11]
              └──→ E5.3 (llm-fallback)    [B05]
    └──→ E5.4 (analytics-clustering) [B06]
              └──→ E5.5 (analytics-advanced) [B07,B08,B09]
```

**关键路径**：E5.2 → E5.3（B05 依赖 B03 的 audit-generic.ts）  
**并行路径**：E5.1 和 E5.2 和 E5.4 可并行执行

---

## 6. 汇总统计

| 指标 | 数值 |
|------|------|
| Story 数量 | 5 |
| GAP 覆盖 | 12/12（B02-B13 全部覆盖） |
| 新增测试 | 68 个 |
| 新增文件 | 33 个 |
| 修改文件 | ~15 个 |
| 总预估工期 | 78-136 小时 |

---

## Epic 6: eval-ux-coach-and-query

**Epic 目标**：使开发者与技术负责人无需了解 run-id 即可通过 Command 获取 Coach 诊断与评分汇总。

### Story 6.1: Coach Command 无参数运行

**Summary:** 零参数 Coach 诊断，让开发者无需 run-id 即可获得短板报告

**As a** 日常开发者（Dev）  
**I want to** 运行 `/bmad-coach` 而不提供任何参数  
**so that** 我能立刻看到最近一轮的 Coach 诊断报告

**Acceptance Criteria:**

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| AC-1 | 有数据时输出诊断 | scoring/data/ 下有至少一条评分记录 | 用户运行 `/bmad-coach` | 输出包含 phase_scores、weak_areas、recommendations 的 Markdown 诊断报告 |
| AC-2 | 空目录时友好提示 | scoring/data/ 为空或无评分数据 | 用户运行 `/bmad-coach` | 返回结构化 Markdown 提示「暂无评分数据，请先完成至少一轮 Dev Story」 |
| AC-3 | 数据量限制 | scoring/data/ 中记录超过 N（默认 100） | 用户运行 `/bmad-coach` | 仅取最新 N 条，必要时提示「仅展示最近 N 条」 |

---

### Story 6.2: Coach 按 Epic/Story 筛选

**Summary:** 支持按 Epic 或 Story 筛选 Coach 诊断数据

**As a** 日常开发者  
**I want to** 运行 `/bmad-coach --epic 3` 或 `/bmad-coach --story 3.3`  
**so that** 我只看到指定 Epic/Story 的短板诊断，不被其他数据干扰

**Acceptance Criteria:**

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| AC-1 | Epic 筛选 | 存在符合 run_id 约定或含 metadata 的 Epic 3 记录 | 用户运行 `/bmad-coach --epic 3` | 仅诊断 Epic 3 相关数据 |
| AC-2 | Story 筛选 | 存在 Story 3.3 的记录 | 用户运行 `/bmad-coach --story 3.3` | 仅诊断 Story 3.3（解析为 epicId=3, storyId=3） |
| AC-3 | 无约定数据 | 记录无 epic_id/story_id 可解析 | 用户运行 `--epic` 或 `--story` | 调用方得到明确反馈（无可筛选数据） |

---

### Story 6.3: 评分查询层（scoring/query/）

**Summary:** 实现评分数据索引层，支持按 Epic/Story/Stage/Scenario 查询

**As a** 系统（Command 与 Coach 的底层）  
**I want to** 通过 queryByEpic、queryByStory、queryLatest、queryByStage、queryByScenario 获取评分记录  
**so that** Coach 与 Scores Command 可以按条件筛选数据

**Acceptance Criteria:**

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| AC-1 | 按 Story 查询 | 存在 Story 3.3 的评分记录（符合 run_id 约定） | 调用 queryByStory(3, 3) | 返回 Story 3.3 的所有评分记录 |
| AC-2 | 去重 | 同 run_id+stage 存在多条记录 | 调用任一 query 方法 | 同 run_id+stage 仅返回 timestamp 最新一条 |
| AC-3 | 数据源 | scoring/data/*.json 与 scores.jsonl 存在 | 调用 queryLatest(10) | 返回按 timestamp 排序的最新 10 条 |
| AC-4 | Epic/Story 仅 real_dev | 记录含 scenario 字段 | Epic/Story 筛选 | 仅针对 real_dev；eval_question 数据隔离 |

---

### Story 6.4: Scores Command

**Summary:** 用户通过 /bmad-scores 查看评分汇总

**As a** 技术负责人（TechLead）  
**I want to** 运行 `/bmad-scores` 或 `/bmad-scores --epic 3` 或 `/bmad-scores --story 3.3`  
**so that** 我能以表格格式查看全部或指定范围的评分汇总

**Acceptance Criteria:**

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| AC-1 | 全部摘要 | 存在评分数据 | 用户运行 `/bmad-scores` | 输出表格格式的评分汇总 |
| AC-2 | Epic 汇总 | 存在 Epic 3 数据 | 用户运行 `/bmad-scores --epic 3` | 显示 Epic 3 各 Story 评分 |
| AC-3 | Story 明细 | 存在 Story 3.3 数据 | 用户运行 `/bmad-scores --story 3.3` | 显示 Story 3.3 各阶段评分明细 |

---

### Story 6.5: bmad-eval-analytics Skill 扩展

**Summary:** 用户通过自然语言触发 Coach 诊断

**As a** 日常开发者  
**I want to** 在 Cursor 中说「帮我看看短板」或「最近一轮的 Coach 报告」  
**so that** 无需记住 Command 名称即可获得诊断

**Acceptance Criteria:**

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| AC-1 | 自然语言触发 | bmad-eval-analytics Skill 已加载 | 用户说「帮我看看短板」 | Skill 调用 Coach 逻辑并输出诊断报告 |
| AC-2 | 最近一轮 | 存在多条评分记录 | 用户说「最近一轮的 Coach 报告」 | 以 timestamp 最近为准，输出对应诊断 |
| AC-3 | 共用逻辑 | — | Skill 被触发 | 复用 Command 的 discoverLatestRunIds 等共享逻辑 |

---

## Epic 7: eval-ux-dashboard-and-sft

**Epic 目标**：使技术负责人获得一页仪表盘，AI 研发效能工程师获得 SFT 提取 Command 入口。

### Story 7.1: 仪表盘生成器

**Summary:** 生成包含总分、四维、短板、Veto、趋势的一页仪表盘

**As a** 技术负责人（TechLead）  
**I want to** 运行 `/bmad-dashboard`  
**so that** 我能看到「项目 78 分，短板在测试覆盖」这类一句话结论

**Acceptance Criteria:**

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| AC-1 | 有数据时 | 存在评分记录 | 仪表盘生成 | 输出含项目健康度总分（PHASE_WEIGHTS 加权）、四维雷达图、短板 Top 3、Veto 触发统计、趋势（最近 5 run 升/降/持平） |
| AC-2 | 无数据时 | 无评分数据 | 仪表盘生成 | 输出「暂无数据，请先完成至少一轮 Dev Story」，写入 _bmad-output/dashboard.md |
| AC-3 | 无 dimension_scores | 部分 record 无 dimension_scores | 四维计算 | 该维度显示「无数据」 |
| AC-4 | 输出路径 | — | 用户运行 `/bmad-dashboard` | 输出到 _bmad-output/dashboard.md 且在对话中展示 |

---

### Story 7.2: SFT 提取 Command

**Summary:** 用户通过 /bmad-sft-extract 一键提取微调数据集

**As a** AI 研发效能工程师（AIEng）  
**I want to** 运行 `/bmad-sft-extract` 而不提供 run-id 或复杂参数  
**so that** 我能获得 sft-dataset.jsonl，用于模型 SFT 微调

**Acceptance Criteria:**

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| AC-1 | 无参数运行 | 存在 phase_score≤60 的记录 | 用户运行 `/bmad-sft-extract` | 输出到 scoring/data/sft-dataset.jsonl（或 --output 指定路径） |
| AC-2 | 阈值可配置 | — | 通过 env 或 CLI 参数设置阈值 | 使用该阈值筛选 phase_score |
| AC-3 | git diff 失败 | 某记录 git diff 无法生成代码对 | 提取该记录 | fallback 为 instruction-only（§1+§4），SftEntry 含 has_code_pair: false |
| AC-4 | 输出摘要 | 提取完成 | — | 含「共提取 N 条，覆盖 M 个 Story；跳过 K 条（原因：…）」 |
| AC-5 | 去重 | 存在重复 source_run_id+base_commit_hash+source_path | 写入 JSONL | 仅保留一条 |
| AC-6 | JSONL 格式 | — | 输出完成 | 每行含 instruction、input、output；has_code_pair: false 时 input/output 可为空 |

---

### Story 7.3: SFT 纳入 bmad-eval-analytics Skill

**Summary:** 用户通过自然语言触发 SFT 提取

**As a** AI 研发效能工程师  
**I want to** 在 Cursor 中说「提取微调数据集」或「生成 SFT 训练数据」  
**so that** 无需记住 Command 即可触发提取

**Acceptance Criteria:**

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| AC-1 | 自然语言触发 | bmad-eval-analytics Skill 已加载 | 用户说「提取微调数据集」 | Skill 调用 SFT 提取逻辑并输出摘要 |

---

### Story 7.4: Coach discovery 仅 real_dev

**Summary:** discovery/Coach 加 scenario 过滤，无参或 `--scenario real_dev` 时仅诊断 real_dev 评分数据，排除 eval_question sample

**As a** 日常开发者（Dev）  
**I want to** 运行 `/bmad-coach` 时默认仅诊断 real_dev 的 run  
**so that** eval_question 等 sample 不会被误选为「最新一轮」，诊断结果反映真实 Dev Story 产出

**Acceptance Criteria:**

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| AC-1 | 默认仅 real_dev | 存在 real_dev 与 eval_question 评分记录 | 用户运行 `/bmad-coach` 无参 | discovery 只考虑 scenario=real_dev，返回最新 real_dev run_id |
| AC-2 | 显式指定 scenario | 存在多种 scenario 记录 | 用户运行 `--scenario real_dev` 或 `--scenario eval_question` | 仅诊断指定 scenario 的记录 |
| AC-3 | 无 real_dev 数据 | 仅有 eval_question 记录 | 用户运行 `/bmad-coach` 默认 | 返回「暂无 real_dev 评分数据，请先完成至少一轮 Dev Story」 |
| AC-4 | 向后兼容 | — | 用户显式 `--run-id=xxx` | 跳过 discovery，直接诊断指定 run_id（不校验 scenario） |

---

## Epic 8: eval-question-bank

**Epic 目标**：使团队 Lead 可维护评测题库，执行题目并写入隔离的评分数据。

### Story 8.1: 题库目录结构与 manifest

**Summary:** 建立 scoring/eval-questions/v1/ 目录与 manifest.yaml schema

**As a** 团队 Lead（TeamLead）  
**I want to** 在 scoring/eval-questions/ 下建立版本化目录（v1、v2）及 manifest.yaml  
**so that** 题目有统一的结构与清单定义

**Acceptance Criteria:**

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| AC-1 | manifest schema | — | manifest.yaml 存在 | 含 questions: [{ id, title, path, difficulty?, tags[] }] |
| AC-2 | 版本隔离 | v1 与 v2 目录存在 | 查询题目 | v1 与 v2 的题目清单独立 |

---

### Story 8.2: 题库 list 与 add 命令

**Summary:** 用户可列出题目并添加新题（模板）

**As a** 团队 Lead  
**I want to** 运行 `/bmad-eval-questions list` 和 `/bmad-eval-questions add --title "xxx"`  
**so that** 我能查看当前题目并快速创建新题模板

**Acceptance Criteria:**

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| AC-1 | list | v1 下有题目 | 用户运行 `/bmad-eval-questions list` | 返回题目清单 |
| AC-2 | add | 当前版本为 v1 | 用户运行 `/bmad-eval-questions add --title "refactor-scoring"` | 生成 q00X-refactor-scoring.md 模板到 v1 目录 |

---

### Story 8.3: 题库 run 命令与 eval_question 集成

**Summary:** 用户执行题目评测，评分写入时注入 scenario 与 question_version

**As a** 团队 Lead  
**I want to** 运行 `/bmad-eval-questions run --id q001 --version v1`  
**so that** 题目被执行，评分写入时自动标记 scenario=eval_question、question_version=v1，实现 v1/v2 隔离

**Acceptance Criteria:**

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| AC-1 | run 成功 | q001 存在于 v1 | 用户运行 run --id q001 --version v1 | 加载题目→调用评审/Skill→写入评分时注入 scenario=eval_question、question_version=v1 |
| AC-2 | run_id 含 version | — | 写入评分 | run_id 含 version，如 eval-q001-v1-{timestamp} |
| AC-3 | question_version 校验 | scenario=eval_question | 写入时 question_version 缺失 | throw 明确错误 |
| AC-4 | run 失败 | 题目文件不存在或解析失败 | 用户运行 run | 输出明确错误信息（文件不存在、解析失败等） |
| AC-5 | 版本隔离 | v1 与 v2 均有 q001 | 查询 v1 与 v2 的评分 | 数据不混淆 |

---

## Deferred Gaps Roadmap（E6–E8 后续 Story 追踪）

| Gap ID | 描述 | 影响 | 归属 | 状态 |
|--------|------|------|------|------|
| GAP-024 | 组合 queryByFilters API | 复杂筛选需调用方多次 query+filter | E6 后续 Story 或 E7 前 | 待排期 |
| GAP-025 | 多 worktree 聚合扫描 | 多 worktree 用户需手动指定 dataPath | 后续迭代 | 待排期 |
| GAP-026 | 交互式 add 引导 | add 首版仅生成模板，无向导式创建 | E8 后续增强 | 待排期 |
| GAP-027 | SFT instruction max_instruction_tokens | 超长 instruction 可能影响 fine-tune | E7 可选配置，后续实现 | 待排期 |

---

*本文档统一管理 E1–E13；Epic 6/7/8 来源 prd.eval-ux-last-mile.md；Epic 10–13 来源 _bmad-output/planning-artifacts/dev/PRD_specify-cn-like-init-multi-ai-assistant.md、ARCH_specify-cn-like-init-multi-ai-assistant.md。*
