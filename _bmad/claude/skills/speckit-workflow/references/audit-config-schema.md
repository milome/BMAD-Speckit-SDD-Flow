# audit_convergence 配置说明（GAP-CONV-10）

## 配置位置与优先级

| 优先级 | 来源 | 说明 |
|--------|------|------|
| 1 | CLI 参数 `--audit-mode` | 单次命令覆盖 |
| 2 | 项目 `config/speckit.yaml` | 项目级默认 |
| 3 | skill 默认 | standard |

## 取值

| 值 | 说明 | 适用 |
|----|------|------|
| strict | 连续 3 轮无 gap + 批判审计员 >50% | 实施后审计、发布前门控 |
| standard | 单次 + 批判审计员 >50% | 默认，常规开发 |
| simple | 单次通过即可，可省略批判审计员 | **仅 CLI 可选**，快速验证，不保证质量 |

## 禁止事项

**项目级 simple 禁止**：`config/speckit.yaml` 中不得设置 `audit_convergence: simple`。若设置，skill 入口或校验脚本应拒绝并报错（exit code ≠ 0）。

**校验脚本**：`_bmad/speckit/scripts/powershell/validate-audit-config.ps1`。执行该脚本时，若项目 config 含 `audit_convergence: simple`，预期报错且 exit code ≠ 0。

## 验收示例

```powershell
# 1. 写入 config/speckit.yaml 并设置 audit_convergence: simple
Set-Content -Path "config\speckit.yaml" -Value "audit_convergence: simple"

# 2. 执行校验脚本
& "_bmad\scripts\bmad-speckit\powershell\validate-audit-config.ps1"

# 3. 预期：$LASTEXITCODE -ne 0，且输出含 AUDIT_CONVERGENCE_SIMPLE_FORBIDDEN
```
