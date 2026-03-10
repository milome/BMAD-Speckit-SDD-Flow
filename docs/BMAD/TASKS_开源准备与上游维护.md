# 任务列表：开源准备与上游维护

**产出日期**：2026-03-10  
**依据**：BMAD-METHOD v6 Gaps、可持续维护策略、全流程对比、开源成熟实践讨论  
**路径**：`docs/BMAD/`

---

## §1 任务总览

| 类别 | 任务数 | 说明 |
|------|--------|------|
| 开源准备 | 8 | 配置清理、LICENSE、README、致谢、文档 |
| 上游维护 | 4 | 关系说明、同步策略、排除清单 |
| 必选增强 | 1 | CHANGELOG.md |
| 暂不做 | 2 | BMAD Phase 1 同步、CONTRIBUTING.md |

---

## §2 开源准备类任务

### T1：清理 bmm/config.yaml 中的项目专用信息

| 项目 | 内容 |
|------|------|
| **目标文件** | `_bmad/bmm/config.yaml` |
| **修改** | 将 `project_name` 改为占位或默认值（如 `{project-name}` 或 `my-project`）；将 `user_name` 改为占位（如 `{user-name}` 或 `Developer`） |
| **保留** | `Version`、`Date` 注释可保留或改为「由 init 时生成」的说明 |
| **验收** | `grep -E "project_name|user_name" _bmad/bmm/config.yaml` 不出现 micang-trader、Micang 等具体项目/用户名 |

---

### T2：全局检查并替换项目专用硬编码

| 项目 | 内容 |
|------|------|
| **搜索范围** | 仓库根目录，排除 `node_modules`、`.git`、`_bmad-output/implementation-artifacts` 中业务产出 |
| **搜索项** | `micang-trader`、`Micang`（及其他可能的项目/用户标识） |
| **处理** | 将硬编码改为占位、环境变量引用或 init 时写入的说明；业务示例产出可保留在 `_bmad-output` 子目录并加 README 说明为示例 |
| **验收** | `rg -l "micang-trader|Micang" --glob '!node_modules' --glob '!*.json' .` 在配置/模板类文件中无匹配；或在匹配处有明确「示例」标注 |

---

### T3：在仓库根添加 LICENSE 文件

| 项目 | 内容 |
|------|------|
| **文件** | `LICENSE`（仓库根） |
| **建议许可** | MIT（与 BMAD-METHOD、spec-kit 一致） |
| **内容** | 标准 MIT 文本；Copyright 行写 `[Year] [Your Name or Org]` |
| **验收** | 仓库根存在 `LICENSE` 文件；首行含 `MIT License` 或 `The MIT License` |

---

### T4：在 README 开头添加 Built on 与 Credits

| 项目 | 内容 |
|------|------|
| **位置** | `README.md` 第 1 段之后、第 2 段之前，或紧接标题后的独立小节 |
| **内容** | 明确写出：本项目管理于 [BMAD-METHOD](链接) 与 [spec-kit](链接)；扩展内容包括审计闭环、批判审计员、评分系统、AI Coach、SFT 微调数据；致谢两家上游 |
| **格式参考** | `**Built on:** BMAD-METHOD v6.x、github/spec-kit。**Extended with:** …` |
| **验收** | `grep -E "Built on|BMAD-METHOD|spec-kit" README.md` 有匹配 |

---

### T5：创建 NOTICES 或 ATTRIBUTIONS.md

| 项目 | 内容 |
|------|------|
| **文件** | `NOTICES` 或 `ATTRIBUTIONS.md`（仓库根） |
| **内容** | 列出 BMAD-METHOD、spec-kit 的项目名、版权、许可、源码链接；保留其原有 copyright 表述；可附加本项目管理部分的版权 |
| **验收** | 文件存在；含 BMAD-METHOD 与 spec-kit 的至少名称、许可、链接 |

---

### T6：创建 docs/UPSTREAM.md

| 项目 | 内容 |
|------|------|
| **文件** | `docs/UPSTREAM.md` |
| **内容** | （1）依赖 upstream 表：名称、版本/范围、用途、许可；（2）定制范围：_bmad-overlay、speckit-workflow、commands；（3）同步策略：BMAD 按需、spec-kit 按需评估，不设定期同步；（4）排除清单：同步时不得覆盖的路径 |
| **验收** | 文件存在；含「upstream」「定制」「同步策略」相关段落；可引用 `docs/BMAD/BMAD-METHOD-v6-Gaps与同步建议.md` |

---

### T7：检查 .gitignore 避免泄露

| 项目 | 内容 |
|------|------|
| **检查项** | 确保 `.gitignore` 排除：`.env`、`*.key`、`*secret*`、本地路径、token 文件等 |
| **验收** | 无包含密钥、token、绝对路径的已跟踪文件；运行 `git ls-files` 输出中不出现 `.env`、`*.key`、`*secret*`、含绝对路径的配置文件；`.env` 已被 `.gitignore` 忽略（`git check-ignore -v .env` 有输出） |

---

### T8：README 补充快速安装与使用

| 项目 | 内容 |
|------|------|
| **位置** | `README.md` 中「快速开始」或等价小节 |
| **内容** | 至少包含：`bmad-speckit init` 或 `npx bmad-speckit init` 示例；`bmad-speckit check` 验证；指向 `docs/INSTALLATION_AND_MIGRATION_GUIDE.md` 的链接 |
| **验收** | README 含可复制的 init/check 命令；链接有效 |

---

## §3 上游维护类任务

### T9：在 docs/UPSTREAM.md 中固化排除清单

| 项目 | 内容 |
|------|------|
| **清单项** | 从 BMAD 同步时永不覆盖：`_bmad/scoring/`、`_bmad/core/agents/adversarial-reviewer.md`、`_bmad/core/agents/critical-auditor-guide.md`、`_bmad/core/agents/README-critical-auditor.md`、`_bmad/scripts/bmad-speckit/`、`_bmad/_config/agent-manifest.csv` 中 adversarial-reviewer/ai-coach 条目；从 spec-kit 同步时永不覆盖：`skills/speckit-workflow/`、`_bmad/cursor/commands/speckit.*` |
| **验收** | `docs/UPSTREAM.md` 含完整排除路径列表；与 `scripts/bmad-sync-from-v6.ps1` 中的排除逻辑一致（或文档注明脚本为执行载体） |

---

### T10：确认同步脚本与文档的对应关系

| 项目 | 内容 |
|------|------|
| **动作** | 在 `docs/BMAD/BMAD-METHOD-v6-Sync-设计分析-200轮PartyMode.md` 或 `docs/UPSTREAM.md` 中注明：BMAD 同步可选用 `scripts/bmad-sync-from-v6.ps1`；Phase 1 修正 path、Phase 2 可选；禁止覆盖项以文档为准 |
| **验收** | 文档中存在对 `bmad-sync-from-v6.ps1` 的引用及使用说明 |

---

### T11：记录当前 upstream 版本

| 项目 | 内容 |
|------|------|
| **位置** | `docs/UPSTREAM.md` 或 `_bmad-output/config/` 下配置 |
| **内容** | BMAD：v6.0.1（来自 bmm/config.yaml）；spec-kit：未直接依赖，模板来源见 bmad-speckit |
| **验收** | 有明确记录，便于同步时对照 |

---

### T12：将「无定期同步」写入文档

| 项目 | 内容 |
|------|------|
| **结论** | BMAD：按需同步（约 2–3 个大版本一次或需要新功能时）；spec-kit：一般不定期同步，有明确需求时手工 cherry-pick |
| **验收** | `docs/UPSTREAM.md` 或等价文档含上述策略说明 |

---

## §4 必选增强类任务

### T14：建立 CHANGELOG.md（必选）

| 项目 | 内容 |
|------|------|
| **文件** | `CHANGELOG.md`（仓库根） |
| **格式** | 按 [Keep a Changelog](https://keepachangelog.com/) 或类似；仅记录本项目管理变更，不包含上游 |
| **验收** | 文件存在；至少有一个版本条目 |

---

## §4b 暂不执行的任务（本次不做）

### T13：执行 BMAD Phase 1 同步 — 暂不做

| 项目 | 内容 |
|------|------|
| **说明** | 若需 Path 标准化、step-04 修正等时再执行 |
| **动作** | 执行 `scripts/bmad-sync-from-v6.ps1 -Phase 1 -DryRun` 检查；通过后执行 `-Phase 1` |
| **验收** | step-04 引用为标准路径；bmad-help 或等价命令可正常列出 workflow |

---

### T15：创建 CONTRIBUTING.md — 暂不做

| 项目 | 内容 |
|------|------|
| **说明** | 待后续需要时再创建 |
| **文件** | `CONTRIBUTING.md`（仓库根） |
| **内容** | PR 流程；本地验证命令；与 speckit-workflow、bmad-story-assistant 的流程约束说明 |

---

## §5 任务依赖关系

```
T1 ─┬─ T2
    │
T3 ──┴─ T4 ─┬─ T5 ─ T6 ─ T9 ─ T10
            │
            ├─ T7
            └─ T8

T11 ─ T12（上游文档）

T14（必选）─ 建立 CHANGELOG.md

T13、T15 暂不做
```

---

## §6 验收命令速查

| 任务 | 验收命令（示例） |
|------|------------------|
| T1 | `grep -E "project_name|user_name" _bmad/bmm/config.yaml`，不出现 micang-trader、Micang |
| T2 | `rg -l "micang-trader|Micang" --glob '!node_modules' --glob '!*.json' .`，配置/模板类文件中无匹配 |
| T3 | `test -f LICENSE && head -1 LICENSE` |
| T4 | `grep -E "Built on|BMAD-METHOD|spec-kit" README.md` |
| T5 | `test -f NOTICES -o -f ATTRIBUTIONS.md` |
| T6 | `test -f docs/UPSTREAM.md` |
| T7 | `git ls-files` 输出无 .env、*.key、*secret*；`git check-ignore -v .env` 有输出 |
| T8 | `grep -E "init|check|INSTALLATION_AND_MIGRATION" README.md` |
| T9 | `grep -E "scoring|adversarial|critical-auditor|README-critical|bmad-speckit|agent-manifest|speckit-workflow|speckit\." docs/UPSTREAM.md` |
| T10 | `grep -E "bmad-sync-from-v6|Phase" docs/UPSTREAM.md docs/BMAD/*.md` |
| T11 | `grep -E "v6\.0|spec-kit|upstream" docs/UPSTREAM.md` |
| T12 | `grep -E "按需|同步" docs/UPSTREAM.md` |
| T13 | `grep "{project-root}/_bmad/core/tasks/help.md" _bmad/bmm/workflows/3-solutioning/create-epics-and-stories/steps/step-04-final-validation.md`；`bmad-help` 或等价命令可列出 workflow |
| T14 | `test -f CHANGELOG.md && grep -E "^\s*\[?[0-9]" CHANGELOG.md` |
| T15 | `test -f CONTRIBUTING.md && grep -E "PR|测试|流程" CONTRIBUTING.md` |

---

**文档结束**

<!-- AUDIT: PASSED by code-reviewer -->
