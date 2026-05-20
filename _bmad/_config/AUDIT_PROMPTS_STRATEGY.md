# audit-prompts 双语文件模型（TASKS 附录 A）

## 现状

- **`_bmad/i18n/manifests/*.yaml`**：已有 `zh` / `en` 键，由 `scripts/i18n/render-template.ts` 渲染，**与 `references/audit-prompts*.md` 不是同一条管线**。
- **`audit-prompts*.md`**：`code-reviewer-config.yaml` 的 `prompt_template` 写 **stem 文件名**（如 `audit-prompts-code.md`）；**按 locale 选实际文件**由 `resolveAuditPromptPath` + 当前 Requirement 的 `runtimePolicySnapshot.locale` 完成。不得再读取 `_bmad-output/runtime/context/project.json` 作为 locale 真相源。

## 维护约定：每个逻辑名 **3 个文件**

对同一 stem（如 `audit-prompts`、`audit-prompts-code`、`audit-prompts-prd` …）在 **cursor / claude 各一套 references** 下同时维护：

| 文件 | 语言 | 说明 |
|------|------|------|
| `{stem}.md` | **默认（中文）** | 主稿；历史与工具默认指向此文件时可不变更 stem。 |
| `{stem}.zh.md` | **中文** | 显式 zh；可与 `{stem}.md` **内容一致**（便于「默认改 zh 稿」时只同步一份），或仅作标注用。 |
| `{stem}.en.md` | **英文** | **仅在此文件做全英文**；不得要求把 `{stem}.md` 改成英文。 |

示例：`audit-prompts-code.md` + `audit-prompts-code.zh.md` + `audit-prompts-code.en.md`（共 7 组 stem × 2 套 skills ≈ 与现 14 个 `audit-prompts*.md` 对应扩展）。

## 加载规则（已实现）

1. **解析器**：`scripts/i18n/resolve-audit-prompt-path.ts`（单测 `tests/i18n/resolve-audit-prompt-path.test.ts`）。
2. **locale**：当前 active Requirement 的 `runtimePolicySnapshot.locale`（`en-US` → 英文侧车；`zh-CN` / `bilingual` → 中文稿）。缺 snapshot、hash 不匹配或字段无效时不得 fallback 到 `project.json`，应 fail closed 或重新 readiness。**禁止**依赖 `BMAD_AUDIT_PROMPTS_LOCALE` 等环境变量。
3. **解析顺序**：`en` → `{stem}.en.md`，缺则回退 `{stem}.md`；`zh` → `{stem}.zh.md`，缺则 `{stem}.md`。
4. **IDE/技能**：须在读取模板前调用上述解析器或等价逻辑；`prompt_template` 仍为 **stem 文件名**（如 `audit-prompts-code.md`）。

### CLI 加载入口（仓库约定）

- **命令**：`npm run audit-prompt:resolve -- <refsDir> <templateBasename> [projectRoot]`  
  例：`npm run audit-prompt:resolve -- _bmad/cursor/skills/speckit-workflow/references audit-prompts-code.md`
- **实现**：`scripts/i18n/print-resolved-audit-prompt.ts` — 向 stdout 打印 JSON：`locale`、`projectRoot`、`resolvedPath`、`usedFallback`、`variant`、`exists`。
- **用途**：子代理脚本、人工校验在**当前 active Requirement runtimePolicySnapshot** 下实际解析到的路径；**不**替代技能内联 `read_file` 逻辑，仅作确定性入口。

## 与 TASKS 策略 A/B/C

本模型对应 TASKS **策略 A（侧车）** 的变体：**双侧车** `.zh.md` + `.en.md`，默认 `.md` 仍为中文主文件；**不**采用「单文件内 zh/en 分段」策略 B，除非另有产品决策。

## 记录

- 2026-03-26：由「单文件策略 C」改为 **三文件双语**（默认/zh/en）。
- 与 `packages/scoring` 解析器约定仍见 TASKS 附录 B.3。
