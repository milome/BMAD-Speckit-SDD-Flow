# PowerShell 与 Shell 脚本完整功能对等性 §5 执行阶段审计报告

**审计依据**：audit-prompts.md §5、docs/WSL_SHELL_SCRIPTS.md、项目要求「禁止简化版」  
**审计日期**：2026-03-10  
**轮次**：Round 1

---

## 模型选择信息

| 项目 | 值 |
|------|-----|
| 配置来源 | .claude/agents/code-reviewer.md |
| 指定模型 | inherit（来自 frontmatter，继承主 Agent 模型） |
| 选择依据 | 子代理 YAML 中 model: inherit；可改为 fast 以节省审计成本（若环境支持） |

---

## §5 审计项逐项验证

### 1. 完整性：14 对 PS/Shell 一一对应

| # | PowerShell | Shell | 存在 | 对应 |
|---|------------|-------|:----:|:----:|
| 1 | scripts/setup.ps1 | scripts/setup.sh | ✅ | ✅ |
| 2 | scripts/check-sprint-ready.ps1 | scripts/check-sprint-ready.sh | ✅ | ✅ |
| 3 | scripts/bmad-sync-from-v6.ps1 | scripts/bmad-sync-from-v6.sh | ✅ | ✅ |
| 4 | _bmad/.../check-prerequisites.ps1 | _bmad/.../check-prerequisites.sh | ✅ | ✅ |
| 5 | _bmad/.../create-new-feature.ps1 | _bmad/.../create-new-feature.sh | ✅ | ✅ |
| 6 | _bmad/.../validate-sync-manifest.ps1 | _bmad/.../validate-sync-manifest.sh | ✅ | ✅ |
| 7 | _bmad/.../validate-audit-config.ps1 | _bmad/.../validate-audit-config.sh | ✅ | ✅ |
| 8 | _bmad/.../setup_worktree.ps1 | _bmad/.../setup_worktree.sh | ✅ | ✅ |
| 9 | _bmad/.../update-agent-context.ps1 | _bmad/.../update-agent-context.sh | ✅ | ✅ |
| 10 | _bmad/.../setup-plan.ps1 | _bmad/.../setup-plan.sh | ✅ | ✅ |
| 11 | _bmad/.../find-related-docs.ps1 | _bmad/.../find-related-docs.sh | ✅ | ✅ |
| 12 | skills/.../monitor-push.ps1 | skills/.../monitor-push.sh | ✅ | ✅ |
| 13 | skills/.../start-push-with-monitor.ps1 | skills/.../start-push-with-monitor.sh | ✅ | ✅ |
| 14 | skills/.../generate-pr-template.ps1 | skills/.../generate-pr-template.sh | ✅ | ✅ |

**common.ps1 / common.sh**：作为库，不计入对，已确认 shell 脚本均 `source common.sh`。

### 2. 功能对等性（逐对核对）

- **setup**：-Target, -Full, -SkipSkills, -SkipScoring, -DryRun, -Help 全对应；REQUIRED_SKILLS / OPTIONAL_SKILLS 一致；init-to-root --full 逻辑一致。
- **check-sprint-ready**：-Json, -RepoRoot；development_status/epics 检测逻辑一致；JSON 输出格式一致；退出码 0/1 一致。
- **bmad-sync-from-v6**：-Phase, -DryRun, -BackupDir, -ProjectRoot, -V6Ref；EXCLUDE_PATTERNS、BACKUP_ITEMS 一致。
- **check-prerequisites**：-Json, -RequireTasks, -IncludeTasks, -RequireSprintStatus, -PathsOnly, -Help 全对应；feature branch 校验逻辑一致。
- **create-new-feature**：-ModeBmad, -Epic, -Story, -Slug, -CreateBranch, -CreateWorktree, -ShortName, -Number；BMAD 模式、get_epic_slug、分支/worktree 创建逻辑对等。
- **validate-sync-manifest**：PS 用 -ManifestPath/-RepoA/-RepoB；shell 调用 Python，参数 --manifest/--repo-a/--repo-b（WSL_SHELL_SCRIPTS.md 已明确映射）。
- **validate-audit-config**：audit_convergence: simple 检测、错误信息、退出码一致。
- **setup_worktree**：create/list/remove/sync 子命令、分支检测、worktree 路径逻辑一致。
- **update-agent-context**：16 种 agent（claude, gemini, copilot, cursor-agent, qwen, opencode, codex, windsurf, kilocode, auggie, roo, codebuddy, amp, shai, q, bob）全支持。
- **setup-plan**：-Json, -Help；plan 模板复制、路径输出一致。
- **find-related-docs**：-FeatureDescription, -ShortName, -Json, -RepoRoot；关键词提取、相关性打分、输出格式对等。
- **monitor-push**：-OutputFile, -BranchName/-b, -RemoteName/-r, -MaxWaitSeconds/-m, -CheckInterval/-i；输出文件自检测、同步检测逻辑一致。
- **start-push-with-monitor**：-b, -r, -m, -i 与 PS 参数对应；后台 push + 启动 monitor 流程一致。
- **generate-pr-template**：-BaseBranch, -CurrentBranch, -OutputDir, -LastPRCommit, -AutoDetectLastPR；调用 Python，参数映射正确；UTF-8 强制一致。

### 3. 可执行性：`bash -n` 语法检查

```text
bash -n scripts/setup.sh scripts/check-sprint-ready.sh scripts/bmad-sync-from-v6.sh     → 通过
bash -n _bmad/scripts/bmad-speckit/shell/*.sh                                            → 全部通过
bash -n skills/git-push-monitor/scripts/*.sh skills/pr-template-generator/scripts/generate-pr-template.sh → 通过
```

### 4. 实际测试执行（已实际运行）

| 命令 | 退出码 | 结果 |
|------|--------|------|
| `bash _bmad/scripts/bmad-speckit/shell/validate-audit-config.sh .` | 0 | 通过 |
| `bash scripts/check-sprint-ready.sh -Json -RepoRoot .` | 0 | JSON 输出正确 |
| `bash _bmad/scripts/bmad-speckit/shell/create-new-feature.sh -Help` | 0 | 用法正确显示 |
| `bash _bmad/scripts/bmad-speckit/shell/update-agent-context.sh` | 1 | 非 feature 分支时预期报错 |
| `bash _bmad/scripts/bmad-speckit/shell/check-prerequisites.sh -Help` | 0 | 帮助正确 |
| `bash _bmad/scripts/bmad-speckit/shell/validate-sync-manifest.sh` | 2 | Python 报缺参，符合预期 |
| `bash skills/pr-template-generator/scripts/generate-pr-template.sh` | 1 | 当前分支无新提交，预期行为 |

### 5. 文档：WSL_SHELL_SCRIPTS.md

- 14 对脚本均列于对照表，说明准确。
- validate-sync-manifest 参数映射（--manifest/--repo-a/--repo-b）已注明。
- 无「简化版」误导表述；明确「完整功能对应」。

### 6. 无占位/伪实现

- 所有 shell 脚本均含实质逻辑；无空壳、无仅 echo、无 TODO 占位。
- validate-sync-manifest.sh、generate-pr-template.sh 通过 Python 实现，为跨平台设计，非简化。

---

## 批判审计员结论

**已检查维度**：遗漏的 PS 脚本、功能差异（参数/逻辑/输出）、简化版残留、验收命令实际执行、行号/路径漂移、文档与实现一致性、边界情况（无 git、无 plan.md、分支不存在等）、占位/伪实现、参数命名与平台约定差异。

**每维度结论**：

1. **遗漏的 PS 脚本**  
   - 已扫描 `scripts/`、`_bmad/scripts/bmad-speckit/powershell/`、`skills/*/scripts/` 下所有 `.ps1`。  
   - 除 `common.ps1`（库，不计入对）外，所有可执行 PS 脚本均有对应 `.sh`。  
   - **结论**：无遗漏。

2. **功能差异：PS 有而 shell 无**  
   - setup：参数与逻辑全对应；shell 用 node/init-to-root，PS 用 pwsh，实现路径不同但行为等价。  
   - check-sprint-ready：逻辑与输出一致。  
   - bmad-sync-from-v6：Phase/排除模式/备份项一致；shell 用 `openssl rand` 或 `$RANDOM` 生成随机串，与 PS `Get-Random` 等价。  
   - check-prerequisites：6 个参数全支持，PathsOnly/RequireSprintStatus 等分支一致。  
   - create-new-feature：BMAD 模式、CreateBranch/CreateWorktree、epic slug 解析、分支号自增逻辑均已核对。  
   - validate-sync-manifest：PS 内嵌 YAML 解析与 SHA256；shell 调用 Python，算法一致，输出格式一致（OK/MISMATCH/MISSING_*）。  
   - validate-audit-config：单文件校验，逻辑等价。  
   - setup_worktree：create/list/remove/sync 四种子命令、worktree 路径计算、分支存在性检查均对等。  
   - update-agent-context：16 种 agent 逐一对照，无缺失。  
   - setup-plan、find-related-docs：参数与输出格式一致。  
   - monitor-push、start-push-with-monitor：参数对应（含短选项 -b/-r/-m/-i）；OutputFile 自检测逻辑在 WSL 下等效（`$HOME/.cursor/projects`）。  
   - generate-pr-template：BaseBranch/CurrentBranch/OutputDir/LastPRCommit/AutoDetectLastPR 全支持；UTF-8 强制一致。  
   - **结论**：无 PS 有而 shell 无的功能点。

3. **简化版残留**  
   - 逐脚本检查：无「简化版」「lite」「minimal」等表述。  
   - 逻辑分支（如 CreateBranch 默认值、BMAD vs standalone、RequireSprintStatus）与 PS 一致。  
   - **结论**：无简化版。

4. **验收命令是否实际执行**  
   - 所有 `bash -n` 均在 PowerShell 下通过 `Set-Location` + `bash -n` 执行，并取得 exit code。  
   - validate-audit-config.sh、check-sprint-ready.sh、create-new-feature.sh -Help、check-prerequisites.sh -Help、validate-sync-manifest.sh、generate-pr-template.sh 均已实际运行并记录退出码与输出。  
   - **结论**：非宣称，已实际执行。

5. **行号/路径漂移、文档与实现不一致**  
   - WSL_SHELL_SCRIPTS.md 中路径为 `_bmad/.../`，实际为 `_bmad/scripts/bmad-speckit/powershell|shell/`，符合常规省略写法。  
   - skills 路径为 `skills/git-push-monitor/scripts/`、`skills/pr-template-generator/scripts/`，与文档一致。  
   - **结论**：无漂移。

6. **边界情况：shell 是否与 PS 行为一致**  
   - **无 git**：check-prerequisites、create-new-feature、setup_worktree 等均有 repo root 回退逻辑（.specify/.git 搜索），与 PS 一致。  
   - **无 plan.md**：update-agent-context、setup-plan 在缺失时退出并报错，与 PS 一致。  
   - **分支不存在**：setup_worktree create 时创建分支，与 PS 一致。  
   - **当前分支 = base 分支**：generate-pr-template 报「No commits found」并 exit 1，与 PS 预期一致。  
   - **非 feature 分支**：update-agent-context、check-prerequisites 报错并 exit 1，与 PS 一致。  
   - **结论**：边界行为一致。

7. **参数命名与平台约定差异**  
   - validate-sync-manifest：PS 用 -ManifestPath/-RepoA/-RepoB，shell 用 --manifest/--repo-a/--repo-b（Python argparse 约定）。  
   - WSL_SHELL_SCRIPTS.md 已明确该映射，属合理平台差异，非功能缺失。  
   - monitor-push/start-push-with-monitor：shell 支持 -b/-r/-m/-i 短选项，便于命令行使用。  
   - **结论**：可接受，已文档化。

8. **占位/伪实现**  
   - 无空壳脚本；无仅 `echo "TODO"`；无 stub 返回。  
   - validate-sync-manifest.sh、generate-pr-template.sh 为薄封装，调用 Python 实现完整逻辑，属设计选择。  
   - **结论**：无占位实现。

9. **stat 命令跨平台**  
   - monitor-push.sh 使用 `stat -c %Y`（Linux）或 `stat -f %m`（macOS）检测 OutputFile 修改时间。  
   - WSL_SHELL_SCRIPTS.md 目标环境为 WSL/Linux/macOS，该用法合规。  
   - **结论**：无 gap。

10. **locale 警告**  
    - generate-pr-template.sh 在部分 Windows 环境下可能出现 `setlocale: LC_ALL: cannot change locale (en_US.UTF-8)`。  
    - 属环境配置问题，不影响脚本逻辑与退出码；脚本仍可正常执行。  
    - **结论**：非阻断，可记录为环境建议。

**本轮结论**：本轮无新 gap。第 1 轮；须连续 3 轮无 gap 后收敛。

---

## 可解析评分块（供 parseAndWriteScore）

总体评级: A

维度评分:
- 功能性: 95/100
- 代码质量: 92/100
- 测试覆盖: 90/100
- 安全性: 88/100

---

## 结论

**完全覆盖、验证通过。**

- 14 对 PS/Shell 脚本均存在且一一对应。  
- 功能对等性满足项目要求，无简化版，无占位实现。  
- 所有 `bash -n` 语法检查通过；关键脚本已实际运行并验证退出码与输出。  
- WSL_SHELL_SCRIPTS.md 描述准确，无误导。  
- 批判审计员检查 10 个维度，均无新 gap。

**收敛状态**：本轮无新 gap，第 1 轮；须连续 3 轮无 gap 后收敛。

**报告保存路径**：`_bmad-output/implementation-artifacts/_orphan/AUDIT_PS_shell_parity_round1.md`
