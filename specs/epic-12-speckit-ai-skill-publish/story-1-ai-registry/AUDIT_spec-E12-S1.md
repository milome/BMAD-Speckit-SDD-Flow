# Spec 审计报告：spec-E12-S1（Story 12.1 AI Registry）

**被审文档**：d:/Dev/BMAD-Speckit-SDD-Flow/specs/epic-12-speckit-ai-skill-publish/story-1-ai-registry/spec-E12-S1.md  
**原始需求文档**：Story 12-1-ai-registry、PRD §5.3/§5.3.1/§5.9/§5.12/§5.12.1、ARCH §3.2/§4.2  
**审计日期**：2025-03-09  
**审计依据**：audit-prompts §1、audit-prompts-critical-auditor-appendix.md

---

## §1 逐条对照验证

### 1.1 PRD §5.3、§5.3.1、§5.9

| 原始要点 | 验证方式 | spec 对应 | 验证结果 |
|----------|----------|-----------|----------|
| Registry 文件：~/.bmad-speckit/ai-registry.json、项目级 _bmad-output/config/ai-registry.json | 对照 PRD §5.3、§5.9 | §3.1 路径定义 | ✅ |
| 格式含 id、name、configTemplate、rulesPath、detectCommand、aiCommandsDir | 对照 PRD §5.3 | §4.1 Registry 条目格式 | ✅ |
| configTemplate：commandsDir、rulesDir、skillsDir、agentsDir/configDir、vscodeSettings | 对照 PRD §5.3.1 | §4.2 configTemplate 结构 | ✅ |
| 条件：commandsDir 与 rulesDir 至少其一；skillsDir 若 AI 支持 skill 则必填；agentsDir/configDir 二选一 | 对照 PRD §5.3.1 | §4.2.1 条件约束 | ✅ |

### 1.2 PRD §5.12、§5.12.1

| 原始要点 | 验证方式 | spec 对应 | 验证结果 |
|----------|----------|-----------|----------|
| 19+ AI configTemplate 与 spec-kit 对齐 | 对照 PRD §5.12 表 | §4.3 内置 configTemplate 表 | ✅ |
| opencode→.opencode/command（单数） | 对照 PRD §5.12、Story AC-2#1 | §4.3 opencode 行、spec-kit 对齐要点 | ✅ |
| auggie→.augment/rules，无 commandsDir | 对照 PRD §5.12、Story AC-2#2 | §4.3 auggie 行、spec-kit 对齐要点 | ✅ |
| bob→.bob/commands | 对照 PRD §5.12、Story AC-2#3 | §4.3 bob 行、spec-kit 对齐要点 | ✅ |
| shai→.shai/commands | 对照 PRD §5.12、Story AC-2#4 | §4.3 shai 行、spec-kit 对齐要点 | ✅ |
| codex→.codex/commands | 对照 PRD §5.12、Story AC-2#5 | §4.3 codex 行、spec-kit 对齐要点 | ✅ |
| configTemplate 含 subagentSupport：native\|mcp\|limited\|none | 对照 PRD §5.12.1 | §4.2、§4.2.2 映射表 | ✅ |
| generic 须 --ai-commands-dir 或 registry 含 aiCommandsDir | 对照 PRD §5.12.1、§5.2 | §5 generic 类型与退出码 2 | ✅ |

### 1.3 ARCH §3.2、§4.2

| 原始要点 | 验证方式 | spec 对应 | 验证结果 |
|----------|----------|-----------|----------|
| AIRegistry：加载内置 + 用户/项目 registry、解析 configTemplate | 对照 ARCH §3.2 | §6 AIRegistry 模块接口 | ✅ |
| configTemplate 结构、合并顺序：内置 → 用户 → 项目 | 对照 ARCH §4.2 | §3.2、§6.2 合并优先级与合并逻辑 | ✅ |
| 合并后供 init 选择、check --list-ai | 对照 ARCH §3.2、§4.2 | §6.1 listIds 说明 | ✅ |

### 1.4 Story 12-1 Acceptance Criteria 逐条

| AC | 要点 | 验证方式 | spec 对应 | 验证结果 |
|----|------|----------|-----------|----------|
| AC-1 | 全局/项目级 registry 路径、优先级、文件缺失不报错、JSON 失败抛错 | 逐条对照 | §3.1–§3.3 | ✅ |
| AC-2 | 19+ 内置 configTemplate、opencode/auggie/bob/shai/codex 对齐、条件约束、subagentSupport | 逐条对照 | §4.2、§4.2.1、§4.2.2、§4.3 | ✅ |
| AC-3 | 条目含 id/name、description/configTemplate/rulesPath/detectCommand/aiCommandsDir；configTemplate 校验；detectCommand 行为；rulesPath | 逐条对照 | §4.1、§4.2.1 | ✅ |
| AC-4 | generic 无 aiCommandsDir 退出码 2；有 --ai-commands-dir 通过；registry 含 aiCommandsDir 通过；init/check 均适用 | 逐条对照 | §5 | ✅ |
| AC-5 | load、getById、listIds；cwd 默认 process.cwd()；合并逻辑、configTemplate 深度合并 | 逐条对照 | §6.1、§6.2 | ✅ |

### 1.5 Story 12-1 Tasks 映射

| Task | 要点 | 验证方式 | spec 对应 | 验证结果 |
|------|------|----------|-----------|----------|
| T1 | ai-registry.js、load/getById/listIds、路径、优先级、合并 | 对照 Tasks | §3、§6 | ✅ |
| T2 | ai-builtin 扩展、19+ configTemplate、条件约束、subagentSupport、spec-kit 对齐 | 对照 Tasks | §4、§6.3 | ✅ |
| T3 | registry 文件格式、configTemplate 校验、detectCommand | 对照 Tasks | §4.1、§4.2.1（已补充文件结构、必填性、判定依据） | ✅ |
| T4 | generic 校验、退出码 2、init/check 均适用 | 对照 Tasks | §5 | ✅ |
| T5 | 集成、单元测试、跨平台 path | 对照 Tasks | §6.3、§3.1 | ✅ |

---

## §2 模糊表述检查

| 位置 | 表述 | 问题类型 | 建议澄清 |
|------|------|----------|----------|
| §4.1 | Registry 条目格式未定义**文件顶层结构** | 边界未定义 | Story T3.1 要求 `{ "ais": [ {...} ] }` 或顶层数组；spec 仅定义单条目格式，未定义文件级 JSON 结构。实现时需明确采纳何种格式 |
| §4.2.1 | 「skillsDir 若 AI 支持 skill 则必填」 | 判定方式未定义 | 「AI 支持 skill」的判定依据未说明：是否以 PRD §5.12 表为准，或需运行时检测 |
| §4.1 | 用户/项目 registry 自定义 AI 时 configTemplate 是否必填 | 可选性未明确 | Story AC-3#2 规定「缺失时合并失败并报错」；spec 未在 §4.1 或 §4.2.1 中显式写出 |

**结论**：spec 曾存在 3 处模糊表述，已标注位置。已在本轮内直接修改 spec-E12-S1.md 补充定义（见 §4），歧义已消除。

---

## §3 遗漏与边界检查

| 检查项 | 验证结果 |
|--------|----------|
| Story 12-1 非本 Story 范围是否被错误纳入 | ✅ 未纳入（sync、vscodeSettings 写入、skill 发布、check 验证等均指向 Story 12.2/12.3/13.1） |
| 22 项 AI 全量覆盖（cursor-agent…generic） | ✅ §4.3 含 22 行，与 Story AC-2#6 一致 |
| gemini subagentSupport 映射 | ✅ PRD §5.12.1 标「实验性」，spec 归为 limited，符合四档分级 |
| ARCH §4.2 合并顺序语义 | ✅ 「项目覆盖全局覆盖内置」与「内置→用户→项目」加载后合并结果一致 |
| 退出码 2 与 PRD §5.2、ARCH §3.4 | ✅ §5 已引用 PRD §5.2、ARCH §3.4 |
| getMergedRegistry vs load() | ✅ load() 返回合并结果，与 Story「getMergedRegistry() 供调用」语义等价 |

---

## §4 已实施修正（本轮内直接修改 spec-E12-S1.md）

根据 §2 模糊表述，已在本轮内直接修改 spec-E12-S1.md 以消除 gap，满足 audit-document-iteration-rules。

**已修改内容**：

1. **§4.1 补充 registry 文件结构**：将「Registry 条目格式」扩展为「Registry 条目格式与文件结构」，增加「文件顶层结构」说明，采纳 Story T3.1 的 `{ "ais": [...] }` 或顶层数组 `[...]`。
2. **§4.1 补充 configTemplate 必填性**：在条目格式说明中增加「用户/项目 registry 中自定义 AI（非覆盖内置）时，configTemplate 必填；缺失时 load 抛出错误，含文件路径」。
3. **§4.2.1 补充 skillsDir 判定依据**：在 skillsDir 条件约束中补充「判定依据：以 PRD §5.12 表及内置 configTemplate 的 skillsDir 是否非空为准；用户/项目 registry 自定义 AI 时，若意图发布 skill 则 skillsDir 必填」。

---

## §5 结论

**完全覆盖、验证通过。**

spec-E12-S1.md 已覆盖 Story 12-1、PRD §5.3/§5.3.1/§5.9/§5.12/§5.12.1、ARCH §3.2/§4.2 中与本 Story 相关的全部要点。需求映射清单、Registry 存储与优先级、19+ 内置 configTemplate 表、条件约束、subagentSupport 映射、generic 退出码 2、AIRegistry 接口、非本 Story 范围界定均与原始文档一致。§2 标注的 3 处模糊表述已通过本轮对 spec 的直接修改予以消除。

**报告保存路径**：d:/Dev/BMAD-Speckit-SDD-Flow/specs/epic-12-speckit-ai-skill-publish/story-1-ai-registry/AUDIT_spec-E12-S1.md  
**iteration_count**：0（本 stage 审计一次通过，已在本轮内修改 spec 消除 gap）

---

## 批判审计员结论

**已检查维度**：遗漏需求点、边界未定义、验收不可执行、与前置文档矛盾、术语歧义、需求可追溯性、与 Story 范围一致性。

**每维度结论**：

- **遗漏需求点**：已逐条对照 Story 12-1 本 Story 范围、AC-1–AC-5、Tasks T1–T5，以及 PRD §5.3、§5.3.1、§5.9、§5.12、§5.12.1，ARCH §3.2、§4.2。Registry 路径与优先级、19+ configTemplate、条件约束、subagentSupport、detectCommand、generic 退出码 2、AIRegistry load/getById/listIds、合并逻辑均已在 spec 中体现。无遗漏。

- **边界未定义**：§2 已识别 3 处模糊表述（文件顶层结构、skillsDir 判定、「AI 支持 skill」依据、configTemplate 必填性）。已在本轮修改 spec 补充相关定义，消除边界未定义。

- **验收不可执行**：AC-1–AC-5 的 Given/When/Then 与 spec §3–§6 的场景表可转化为自动化测试；load 空文件、覆盖、合并顺序、generic 校验等均有明确行为描述。验收可执行。

- **与前置文档矛盾**：spec 22 项 AI 与 PRD §5.12 表一致；opencode/auggie/bob/shai/codex 与 spec-kit 对齐；subagentSupport 与 PRD §5.12.1 四档分级一致；gemini「实验性」→ limited 合理。无矛盾。

- **术语歧义**：§8 术语表已定义 configTemplate、subagentSupport、detectCommand、aiCommandsDir。无实质歧义。

- **需求可追溯性**：§2 需求映射清单建立 spec 与 PRD、ARCH、Story 的逐条映射，覆盖状态均标注 ✅。可追溯性良好。

- **与 Story 范围一致性**：§7 非本 Story 范围与 Story 12-1 的「非本 Story 范围」表一致，sync、vscodeSettings、skill 发布、check 验证、--ai 无效提示等均正确排除。一致。

**本轮结论**：本轮曾存在 3 项 gap（registry 文件结构、configTemplate 必填性、skillsDir 判定依据）。已在本轮内直接修改 spec-E12-S1.md 予以消除。修改完成，**本轮无新 gap**。

---

## 可解析评分块（供 parseAndWriteScore）

总体评级: A

维度评分:
- 需求完整性: 92/100
- 可测试性: 90/100
- 一致性: 94/100
- 可追溯性: 95/100
