# validate-audit-config.ps1
# GAP-CONV-10: 校验 audit_convergence 配置
# 项目级 audit_convergence: simple 禁止；仅 CLI --audit-mode simple 可启用
# 用法: 从项目根执行 .\validate-audit-config.ps1
# 若 .speckit/config.yaml 含 audit_convergence: simple，exit 1 并输出错误

param(
    [string]$ProjectRoot = (Get-Location).Path
)

$configPath = Join-Path $ProjectRoot ".speckit\config.yaml"
if (-not (Test-Path $configPath)) {
    exit 0
}

$content = Get-Content $configPath -Raw -ErrorAction SilentlyContinue
if (-not $content) {
    exit 0
}

# 检测 audit_convergence: simple
if ($content -match 'audit_convergence\s*:\s*simple') {
    Write-Error "AUDIT_CONVERGENCE_SIMPLE_FORBIDDEN: project-level audit_convergence: simple is forbidden. Use CLI --audit-mode simple for single-run only."
    exit 1
}

exit 0
