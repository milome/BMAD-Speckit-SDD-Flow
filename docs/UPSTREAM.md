# Upstream Dependencies & Sync Strategy

本文档说明 BMAD-Speckit-SDD-Flow 对上游的依赖、定制范围与同步策略。可参考 [BMAD-METHOD v6 Gaps 与同步建议](BMAD/BMAD-METHOD-v6-Gaps与同步建议.md)。

---

## 1. Upstream 依赖表

| 名称 | 版本/范围 | 用途 | 许可 |
|------|-----------|------|------|
| **BMAD-METHOD** | main@45d125f（2026-03-16 同步） | 工作流、party-mode、bmm/core/utility 模块、V6 core skills | MIT |
| **spec-kit** | 模板来源见 bmad-speckit init | 规范驱动开发（specify→plan→tasks） | MIT |

- **BMAD-METHOD 源码**: [bmad-code-org/BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD)
- **spec-kit 来源**: `bmad-speckit init` 从 GitHub tarball 拉取，未直接依赖 npm 包

---

## 2. 定制范围

| 定制项 | 路径/说明 |
|--------|------------|
| **_bmad-overlay** | `_bmad/scoring/`、批判审计员、adversarial-reviewer、ai-coach |
| **speckit-workflow** | `.cursor/skills/speckit-workflow/`、`.cursor/commands/speckit.*` |
| **bmad-speckit CLI** | `_bmad/scripts/bmad-speckit/`、`packages/bmad-speckit/` |
| **agent-manifest** | `_bmad/_config/agent-manifest.csv` 中 adversarial-reviewer、ai-coach 条目 |
| **party-mode 定制** | `_bmad/core/workflows/party-mode/`（批判审计员角色注入、收敛条件定制） |
| **V6 core skills 分发** | `_bmad/skills/`（从 `_bmad/core/skills/` 复制，用于通用技能分发） |

---

## 3. 同步策略

- **BMAD**：按需同步（约 2–3 个大版本一次，或需要新功能时）。**无定期同步**。
- **spec-kit**：一般不定期同步；有明确需求时手工 cherry-pick 或评估后合并。

---

## 4. BMAD 同步排除清单

从 BMAD-METHOD 同步时**不得覆盖**以下路径（以 `scripts/bmad-sync-from-v6.ps1` 及文档为准）：

### 4.1 路径排除（永不覆盖）

| 类别 | 路径 |
|------|------|
| scoring | `_bmad/scoring/` |
| adversarial-reviewer | `_bmad/core/agents/adversarial-reviewer.md` |
| critical-auditor | `_bmad/core/agents/critical-auditor-guide.md`、`_bmad/core/agents/README-critical-auditor.md` |
| bmad-speckit | `_bmad/scripts/bmad-speckit/` |
| agent-manifest | `_bmad/_config/agent-manifest.csv` 中 adversarial-reviewer、ai-coach 条目 |
| speckit-workflow | `.cursor/skills/speckit-workflow/`（spec-kit 侧） |
| speckit commands | `_bmad/cursor/commands/speckit.*` 或 `.cursor/commands/speckit.*` |

### 4.2 同步脚本引用

BMAD 同步可选用 **`scripts/bmad-sync-from-v6.ps1`**：

```powershell
# 用法
pwsh scripts/bmad-sync-from-v6.ps1 -Phase 1 -DryRun   # 列出操作，不执行
pwsh scripts/bmad-sync-from-v6.ps1 -Phase 1            # Phase 1：path 标准化等
pwsh scripts/bmad-sync-from-v6.ps1 -Phase 2            # Phase 2：可选功能
pwsh scripts/bmad-sync-from-v6.ps1 -Phase all          # 全阶段
```

- **Phase 1**：Path 标准化、step-04 修正等  
- **Phase 2**：core/bmm/utility 模块同步（含 V6 core skills）  
- **禁止覆盖项**：以本文档 §4.1 为准；脚本内置 `$EXCLUDE_PATTERNS` 与其一致
- **默认分支**：`main`（脚本默认 `-V6Ref main`）

---

## 5. 当前上游版本记录

| 上游 | 版本 | 同步日期 |
|------|------|----------|
| BMAD-METHOD | main@45d125f | 2026-03-16 |
| spec-kit | 模板来源见 bmad-speckit，无直接依赖版本号 | — |

同步时对照上述版本，确认 merge 基准。

### 同步历史

| 日期 | 来源 | 范围 | 备注 |
|------|------|------|------|
| 2026-03-16 | main@45d125f | core/bmm/utility | V6 content sync：新增 11 个 core skills、utility 模块、party-mode skill（新路径 `_bmad/core/skills/bmad-party-mode/`） |
| 2026-02-22 | v6.0.1 | core/bmm | 初始 BMAD-METHOD v6 安装 |
