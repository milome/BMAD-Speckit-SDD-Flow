# AGENTS.md

## Encoding Integrity Guardian

Mandatory skill: `_bmad/skills/encoding-integrity-guardian/SKILL.md`.

Load and follow `encoding-integrity-guardian` before and after any of these operations:

- batch editing markdown, CSV, YAML, TOML, skill, command, README, or AGENTS files
- generating or regenerating Codex, Cursor, Claude, or `_bmad/codex` surfaces
- npm pack, release, prepublish, or install-surface validation
- Windows PowerShell file read/write operations that touch project text files
- detecting mojibake marker patterns, private-use glyphs, replacement characters, or corrupted UTF-8 text

On Windows, Codex must use PowerShell 7 via `pwsh.exe` for shell commands. Never use `powershell.exe` for project text file read/write operations. For batch text rewrites, use Node `fs` with explicit `utf8` and run the encoding integrity gate before and after.

Required gate for those operations:

```powershell
node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js
```

If the gate reports findings, stop normal implementation. Classify affected files, identify whether they are source or generated surfaces, trace the first polluted commit or generator, and choose `restore`, `regenerate`, or `manual semantic rewrite`. Do not claim that encoding conversion fixed mojibake unless semantic content was restored from a clean source.

## Command Verification Rules

### PowerShell / rg Quoting Rules

- Windows 下调用 `pwsh.exe -Command` 时，`rg` 的 regex pattern 必须用单引号包裹，尤其包含 `|`, `(`, `)`, `$`, `?`, `*` 等 PowerShell / regex 易混字符时。
- 优先使用脚本块形式：

  ```powershell
  pwsh.exe -NoLogo -NoProfile -Command "& { rg -n -e 'foo|bar' -- 'path1' 'path2' }"
  ```

- 不要用 Bash 风格的反斜杠 `\"` 逃逸 PowerShell 字符串；PowerShell 中这经常导致引号提前结束，使 `|` 被解析成 pipeline。
- 复杂 pattern 优先拆成多个 `-e`：

  ```powershell
  rg -n -e 'foo' -e 'bar' -- 'path'
  ```

- 如果只是字面量搜索，优先用 `rg -F` 或多个 `-e`，不要写复杂正则。

## Karpathy-Inspired Guidelines

- Think Before Coding: Wrong assumptions, hidden confusion, missing tradeoffs
- Simplicity First: Overcomplication, bloated abstractions
- Surgical Changes: Orthogonal edits, touching code you shouldn't
- Goal-Driven Execution: Leverage through tests-first, verifiable success criteria

## Delivery Truth Gate: Long-Run Evidence Policy

- Real 8h development soak is no longer a hard delivery blocker for this project.
- `main-agent:delivery-truth-gate` completion is governed by current delivery evidence: release gate, host matrix, PR topology, sprint status audit, quality gate, same-run provenance for those delivery artifacts, and disabled test/dev seams.
- Long-run soak may still be produced as optional observability evidence, but missing, short, heartbeat-only, or stale soak evidence must not by itself block completion language.
- Do not use wall-clock heartbeat soak, empty timer, mock journey, contract fixture, deterministic replay, or background idle process to claim stronger runtime reliability than was actually proven.

## User Rules

- Multiple Roles: 多角色视角分析和评审
- Output Style: 简洁、直接、可执行
- Language Rules: 内部开发过程中的语言以中文优先

## 意图澄清

适用条件：不确定性可通过快速扫描 + 一轮提问消除。

1. 开场对齐（执行前必做）：先向用户回显“我理解的目标/范围/不做/关键假设”
2. 请求规范化（Prompt Refinement）：将用户原始请求收敛为可执行摘要（目标/范围/不做/验收）
3. 快速扫描：Glob/Grep 识别相关文件
4. 关键提问：有疑问时提问并等待回答
5. 生成方案：基于回答输出目标、范围、WHEN/THEN 行为规格、验收标准、不做项
6. 执行：需求明确且实现路径唯一时直接开始；涉及业务决策/关键输入缺失/重大歧义时等待用户确认后开始

提问规则：
- `Lite` 且需求明确、实现路径唯一：不提问，直接执行
- `Standard/Full` 且需求明确、实现路径唯一：开场对齐后直接执行
- 涉及业务决策、缺少关键输入、或存在多方案权衡：一次性提出全部关键问题并等待确认
- 已进入 `superpowers:brainstorming` 时，按其规则改为“一次一问”
- `AskUserQuestion` 不可用时，改为普通文本提问并暂停执行等待用户回复

需求模糊、跨模块交互或存在多个设计分歧时，调用 `superpowers:brainstorming` 收敛边界。

## 通用退出标准

所有任务交付前逐项检查（技能专属退出标准仅追加，不替代）：

| # | 标准 | 检查方式 |
|---|------|---------|
| 1 | 请求回看 | 逐条对照原始请求，标记 Done/Partial/Skipped |
| 2 | 产出物回读 | 审阅所有生成内容，检查遗漏/错误 |
| 3 | 验证证据 | 提供命令 + 输出摘要，或说明无法验证原因 |
| 4 | 质量门禁 | 按 `rules/code-quality.md` 检查：正确性→安全→性能→可维护性（按适用性验证） |

未通过则自动修复，最多 3 轮；仍失败必须明确残余风险，禁止隐藏。

## 任务追踪

默认由 `skills/superagents/SKILL.md` 的编排与追踪规则执行。

- 快速路径任务：按 `rules/fast-path.md` 执行，可跳过任务追踪
- 复杂任务（≥3 步或跨多文件）：使用 TaskCreate/TaskUpdate/TaskList
- 所有档位路径（Lite/Standard/Full）都必须满足最小追踪：步骤状态可见、阻塞关系可见、完成证据可追溯

## 用户交互决策

以下为 `rules/output-style.md` 确认规则的补充（前者管“是否确认”，此处管“是否询问方向”）：

| 场景 | 行为 |
|------|------|
| 技术方案唯一 | 直接执行 |
| 2-3 个等价方案 | 推荐首选 + 简短对比，AskUserQuestion |
| 涉及业务决策 | 必须 AskUserQuestion |
| 缺少关键输入 | 必须 AskUserQuestion |
| 用户说“帮我决定” | 分析后给推荐，不反问 |

补充：`AskUserQuestion` 不可用时，使用普通文本一次性提问（最多 3 个关键问题）并等待用户确认。

## Superpowers 使用准则

- 每次响应前必须先调用 `superpowers:using-superpowers`（见 `CLAUDE.md`）
- 固定顺序：`using-superpowers` → 选择最小 Skill 集合 → 执行对应 Skill → 验证与交付
- 所有请求强制进入 `superagents`（自动触发，无需显式 `$superagents`）
- `superagents` 内部按复杂度走 `Lite/Standard/Full` 三档流程
- `answer/git/github/handoff/fix-bug/develop-feature/refactor/review-code/architecture-review` 仅作为 `superagents` 内部 lane
- 规则冲突优先级：安全 > 正确性 > 用户明确要求 > `CLAUDE.md` 强制项 > 其余规则/技能说明

具体场景映射与编排细节以 `skills/superagents/SKILL.md` 为准。

## Agent 协作

职责边界保持两层：

- Skill：负责路由与流程编排
- Agent：负责单一职责执行（research/plan/implement/review/verify/report）

委派原则（全局最小约束）：

- 主 agent 只保留：编排决策、用户交互、任务协调、最终汇总
- 可委派工作默认委派，避免主上下文膨胀
- 多 Agent 并发、角色分工、冲突处理以 `skills/superagents/SKILL.md` 为准

## 文件引用规范

引用项目内文件时使用相对路径：
- Rules: `rules/code-quality.md`、`rules/fast-path.md`
- Skills: `skills/develop-feature/SKILL.md`
- Agents: `agents/reviewer.md`

避免仅写文件名（如 `code-quality.md`），确保可追溯。

## 中断恢复

技能执行中断时调用 `handoff`（详见其 SKILL.md）。

## Large File Safe Write Protocol

Mandatory when editing Markdown, YAML, CSV, TOML, README, AGENTS, requirements contracts, generated documentation, or any project text file that may be rewritten in large chunks.

Trigger conditions:
- The target file already exists and the intended change rewrites the whole file or a large section.
- The new content is larger than about 8 KB, more than about 120 lines, or generated from a template/LLM output.
- The target path is ignored by Git, untracked, or not protected by normal source control review.
- The edit is running on Windows or through a streaming tool call that may be interrupted.

Hard rules:
- Never use `apply_patch Delete File` on an existing document unless the user explicitly asks to delete that file.
- Never perform an existing-document rewrite as `Delete File` followed by `Add File`.
- Use `apply_patch Update File` only for small, localized diffs where the existing file remains present after every step.
- For large rewrites, first create and verify a timestamped backup before replacing the target.
- Write new large content to a same-directory draft/temp file with Node `fs` and explicit `utf8`, then verify required headings/IDs, byte length, and SHA256 before replacement.
- Replace only after verification, using a same-directory temp file and `fs.renameSync` or the repository safe-write script.
- After replacement, read the target back and verify SHA256 plus key `rg` checks.
- If any stream or tool call is interrupted, stop normal work and inspect target existence, target hash, backup hash, and temp files before continuing.
- Do not claim encoding integrity passed when the encoding gate fails; record the exact failure as residual risk.

Required command for large document rewrites in this repository:

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { node scripts/safe-write-large-doc.mjs --target <target> --content <draft> --require '<required heading>' --min-bytes <bytes> --json }"
```

Global Codex fallback command when the repository script is not available:

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { node C:/Users/milom/.codex/scripts/safe-write-large-doc.mjs --target <target> --content <draft> --require '<required heading>' --min-bytes <bytes> --json }"
```

Do not use PowerShell redirection, `Out-File`, or `Set-Content` for large source/docs rewrites. Use Node `fs` with explicit `utf8` and preserve backups until the user accepts the result.
