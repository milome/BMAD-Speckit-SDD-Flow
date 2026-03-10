# BMAD-METHOD v6 与当前 _bmad 的 Gaps 及同步建议

**对比基准**：[bmad-code-org/BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) v6.0.4 (2026-03)  
**当前仓库**：BMAD-Speckit-SDD-Flow 内 `_bmad` 目录（源自 bmad-speckit-workflow 迁移，非直接 fork BMAD-METHOD）

---

## 一、架构与来源差异

| 维度 | BMAD-METHOD v6 | BMAD-Speckit-SDD-Flow _bmad |
|------|----------------|-----------------------------|
| **安装方式** | `npx bmad-method install` 从 npm 包部署 | `bmad-speckit init` 从 GitHub tarball (`bmad-method/bmad-method`) 拉取模板，或克隆本仓库复制 |
| **源码结构** | `src/`（bmm, core, utility）→ 安装时拷贝到项目 `_bmad/` | `_bmad/` 直接提交在仓库中 |
| **Agent 格式** | 迁移至 `.agent.yaml`（src/bmm/agents/*.agent.yaml） | 仍使用 `.md`（_bmad/core/agents/*.md、_bmad/bmm/agents/） |
| **模块范围** | BMM、BMB、CIS、TEA（外部）、BMGD（外部）、SDET（Beta.3 替代 TEA） | BMM、BMB、CIS、TEA、**scoring**（本项目独有） |
| **CLI** | `bmad` / `bmad-method`（install、uninstall、help） | `bmad-speckit`（init、check、version、upgrade、feedback、config） |

---

## 二、BMAD-METHOD v6 新功能（当前 _bmad 缺失）

### 2.1 核心功能

| 功能 | 版本 | 说明 |
|------|------|------|
| **bmad-help 智能引导** | 6.0.0-Beta.1 | AI 驱动的下一步引导，替代 workflow-init；读取项目 context、workflow 目录，生成 IDE 命令 |
| **bmad uninstall** | 6.0.0 | 交互/非交互选择性卸载组件 |
| **非交互安装** | 6.0.0-Beta.8 | `--directory`、`--modules`、`--tools`、`--custom-content`、`-y` 等 10+ 参数，CI/CD 支持 |
| **Path 标准化** | 6.0.2 | 104 处引用改为 `{project-root}/_bmad/` 统一语法 |
| **Edge Case Hunter** | 6.0.4 | 新 review task：穷尽分支路径与边界条件，仅报告未处理 gap |
| **bmad-os-root-cause-analysis** | 6.0.3 | Skill：分析 bug-fix commits，产出结构化根因报告（金字塔沟通格式） |
| **bmad-os-audit-file-refs** | 6.0.2 | `/bmad-os-audit-file-refs`：文件引用约定审计，并行 subagent |
| **bmad-os-review-pr** | 6.0.2 | `/bmad-os-review-pr`：PR 审查 skill |
| **CSV 引用校验** | 6.0.2 | 扫描 CSV 中 501 处 workflow 引用，检测断链 |
| **Party Mode Return Protocol** | 6.0.0-Beta.8 | 防止 Party Mode 完成后「lost-in-the-middle」 |
| **@clack/prompts 迁移** | 6.0.0-Beta.8 | 统一 CLI 体验，跨平台（含 Windows） |
| **版本检查** | 6.0.0-Beta.7 | 启动时检查 npm 新版本，提示更新 |

### 2.2 IDE 与平台支持

| 平台 | BMAD-METHOD v6 | 当前 _bmad |
|------|----------------|------------|
| CodeBuddy | ✅ 6.0.2 | 未验证 |
| OpenCode | ✅ 修复模板 | 未验证 |
| Kiro | ✅ config 驱动 | 未验证 |
| Codex | ✅ `.agents/skills` 迁移 | 未验证 |
| Rovo Dev | ✅ 6.0.2 | 未验证 |
| GitHub Copilot | ✅ 专用 installer | 未验证 |

### 2.3 工作流与数据

| 项目 | BMAD-METHOD v6 | 当前 _bmad |
|------|----------------|------------|
| PRD steps 2b/2c | ✅ vision、executive summary | 需对照 |
| Research 工作流分片 | ✅ domain/market/technical 独立 workflow | 需对照 |
| Workflow 直接调用 | ✅ `/domain-research`、`/create-prd` 等 slash 命令 | 部分 |
| generate-project-context | ✅ 3 步工作流 | 未验证 |
| 安装器模板 `@` 前缀 | ✅ 已替换为 `{project-root}` | 需检查 |

---

## 三、当前 _bmad 独有（需保留）

| 项目 | 说明 |
|------|------|
| **scoring 模块** | AI Coach、parseAndWriteScore、coach-diagnose、SFT 提取等；BMAD-METHOD 无 |
| **adversarial-reviewer + critical-auditor-guide** | 批判审计员详细操作指南；上游有 adversarial-review 文档与 bmad-review-adversarial-general task，但无同等深度 guide |
| **scripts/bmad-speckit/** | check-prerequisites.ps1、create-new-feature.ps1、setup_worktree.ps1、sync-manifest 等 |
| **bmad-speckit 集成** | constitution、spec、plan、tasks、implement 命令与 speckit 流程 |
| **agent-manifest.csv** | 含 adversarial-reviewer、ai-coach；上游可能使用不同 manifest 格式 |

---

## 四、同步建议

### 4.1 策略选择

| 策略 | 适用场景 | 风险 |
|------|----------|------|
| **A. 增量 cherry-pick** | 仅同步部分高价值功能（如 bmad-help、path 标准化、Party Mode Return Protocol） | 需逐项合并，可能有冲突 |
| **B. 模板来源升级** | 将 bmad-speckit init 的模板源从 `bmad-method/bmad-method` 升级到 v6.0.4 tag，重新拉取 | 会覆盖 _bmad 中与上游重叠部分，**scoring、批判审计员、bmad-speckit 脚本等需事先备份并合并回** |
| **C. 双轨维护** | 保持 _bmad 为「定制 fork」，定期从 BMAD-METHOD 拉取 core/bmm 更新，手动 merge | 工作量大，需明确哪些目录可覆盖 |

### 4.2 推荐：分阶段同步

**Phase 1（低风险）**：
1. **Path 标准化**：将 _bmad 内硬编码路径改为 `{project-root}/_bmad/`，与 v6.0.2 一致
2. **bmad-help**：若 bmad-method 模板已含 bmad-help.md，init 拉取时自动带入；否则从 BMAD-METHOD 复制 `docs` 或 `_bmad/core/tasks/help.md` 等效物到本仓库
3. **Party Mode Return Protocol**：从 v6.0.0-Beta.8 合并 step 或文档，防止 Party Mode 结束后 lost-in-the-middle

**Phase 2（中风险）**：
4. **Edge Case Hunter / bmad-os 系 skill**：评估是否纳入 `.claude/skills` 或 `skills/`
5. **Workflow 分片与 slash 命令**：若 create-prd、research 等有 v6 改进，可选择性合并
6. **非交互安装参数**：bmad-speckit init 已有 `-y`、`--ai` 等，对照 v6 `--modules`、`--directory` 补全

**Phase 3（需设计）**：
7. **Agent 格式迁移**：若上游全面切到 `.agent.yaml`，需评估 _bmad 是否跟随；当前 agent-manifest.csv + .md 仍可用
8. **TEA vs SDET**：v6 Beta.3 将 TEA 移出、引入 SDET；本项目若依赖 TEA，需确认外部 TEA 包兼容

### 4.3 禁止覆盖项

同步时**不得覆盖**以下定制：
- `_bmad/scoring/`  entire directory
- `_bmad/core/agents/adversarial-reviewer.md`、`critical-auditor-guide.md`、`README-critical-auditor.md`
- `_bmad/scripts/bmad-speckit/`
- `_bmad/_config/agent-manifest.csv` 中 adversarial-reviewer、ai-coach 条目
- `_bmad/cursor/commands/` 中 speckit.*、bmad-help（若有定制）

---

## 五、可执行的同步命令示例

```bash
# 1. 克隆 BMAD-METHOD 到临时目录
git clone --depth 1 --branch v6.0.4 https://github.com/bmad-code-org/BMAD-METHOD.git /tmp/bmad-method-v6

# 2. 对比 core、bmm 差异（排除 scoring、adversarial、scripts）
diff -rq /tmp/bmad-method-v6/src/core _bmad/core
diff -rq /tmp/bmad-method-v6/src/bmm _bmad/bmm

# 3. 使用 bmad-customization-backup 先备份当前 _bmad 定制
# （见 skills/bmad-customization-backup）

# 4. 选择性合并：如复制 bmad-help 相关、Party Mode Return Protocol
```

---

## 六、参考链接

- [BMAD-METHOD GitHub](https://github.com/bmad-code-org/BMAD-METHOD)
- [CHANGELOG v6.0.0–6.0.4](https://github.com/bmad-code-org/BMAD-METHOD/blob/main/CHANGELOG.md)
- [docs.bmad-method.org](https://docs.bmad-method.org)
- 本项目：`docs/INSTALLATION_AND_MIGRATION_GUIDE.md` §4.4 _bmad 定制迁移
