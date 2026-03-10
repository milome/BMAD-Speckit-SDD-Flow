#!/usr/bin/env pwsh
<#
.SYNOPSIS
  BMAD-Speckit-SDD-Flow 一键安装脚本

.DESCRIPTION
  部署核心 + 扩展目录、同步 .cursor/、安装全局 Skills、复制 scoring/，并运行验证。

.PARAMETER Target
  目标项目根目录（必须）

.PARAMETER SkipSkills
  跳过全局 Skills 安装

.PARAMETER SkipScoring
  跳过 scoring/ 目录复制

.PARAMETER DryRun
  仅输出计划，不执行

.PARAMETER Full
  完整模式，与 -Target 配合时确保执行完整安装（init-to-root --full）

.PARAMETER Help
  显示帮助
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$Target,
    [switch]$SkipSkills,
    [switch]$SkipScoring,
    [switch]$DryRun,
    [switch]$Full,
    [switch]$Help
)

$ErrorActionPreference = 'Stop'
$PKG_ROOT = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

# Skills 清单 (T-INSTALL-3)
$REQUIRED_SKILLS = @(
    'speckit-workflow',
    'bmad-story-assistant',
    'bmad-bug-assistant',
    'bmad-code-reviewer-lifecycle',
    'code-review'
)
$OPTIONAL_SKILLS = @(
    'bmad-standalone-tasks',
    'bmad-customization-backup',
    'bmad-orchestrator',
    'using-git-worktrees',
    'pr-template-generator',
    'auto-commit-utf8',
    'git-push-monitor'
)

function Show-Help {
    Write-Output "BMAD-Speckit-SDD-Flow setup script"
    Write-Output "Usage: pwsh scripts/setup.ps1 -Target <path> [options]"
    Write-Output "  -Target <path>    Target project root (required)"
    Write-Output "  -Full             Full install mode (default when using setup:full)"
    Write-Output "  -SkipSkills       Skip global Skills install"
    Write-Output "  -SkipScoring      Skip scoring/ copy"
    Write-Output "  -DryRun           Plan only, no execution"
    Write-Output "  -Help             Show help"
    exit 0
}

if ($Help) { Show-Help }

# G2: PowerShell >=7 version check
if (-not $DryRun -and $PSVersionTable.PSVersion.Major -lt 7) {
    Write-Error "PowerShell >= 7 is required (current: $($PSVersionTable.PSVersion)). Upgrade: https://github.com/PowerShell/PowerShell/releases"
    exit 1
}

if (-not $Target) {
    Write-Error 'Must specify -Target <path>'
    exit 1
}

$TargetResolved = $Target
if ((Test-Path $Target) -and ($Target -match '^[a-zA-Z]:\\.*')) {
    try { $TargetResolved = (Resolve-Path $Target).Path } catch { }
}

if (-not $DryRun) {
    $prereq = @(
        @{ N = 'Node.js'; C = 'node'; V = '18' }
        @{ N = 'Python'; C = 'python'; V = '3.8' }
        @{ N = 'PowerShell'; C = 'pwsh'; V = '7' }
        @{ N = 'Git'; C = 'git'; V = '2' }
    )
    foreach ($p in $prereq) {
        if (-not (Get-Command $p.C -ErrorAction SilentlyContinue)) {
            Write-Error "Missing prerequisite: $($p.N) ($($p.C) >= $($p.V))"
            exit 1
        }
    }
}

Write-Output "=== BMAD-Speckit-SDD-Flow Setup ==="
Write-Output "PKG_ROOT: $PKG_ROOT"
Write-Output "Target:   $TargetResolved"
Write-Output ""

if ($DryRun) {
    Write-Output "[DryRun] Plan:"
    Write-Output "  1. node scripts/init-to-root.js --full $TargetResolved"
    Write-Output "  2. .cursor/ sync (via init-to-root)"
    if (-not $SkipSkills) {
        Write-Output "  3. Copy REQUIRED_SKILLS: $($REQUIRED_SKILLS -join ', ')"
        Write-Output "  4. Copy OPTIONAL_SKILLS: $($OPTIONAL_SKILLS -join ', ')"
    } else {
        Write-Output "  3. Skip Skills install"
    }
    if (-not $SkipScoring) {
        Write-Output "  5. Copy scoring/ -> $TargetResolved\scoring\"
    } else {
        Write-Output "  5. Skip scoring copy"
    }
    Write-Output "  6. Run validation"
    exit 0
}

# Step 1–2: init-to-root --full (含 .cursor 同步)
Write-Output "[1] Deploying core+extended dirs..."
& node (Join-Path $PKG_ROOT 'scripts\init-to-root.js') --full $TargetResolved
if ($LASTEXITCODE -ne 0) {
    Write-Error 'init-to-root.js failed'
    exit 1
}

# Step 3–4: Skills 复制
if (-not $SkipSkills) {
    $skillsRoot = Join-Path $env:USERPROFILE '.cursor\skills'
    if (-not (Test-Path $skillsRoot)) {
        New-Item -ItemType Directory -Path $skillsRoot -Force | Out-Null
    }
    $allSkills = $REQUIRED_SKILLS + $OPTIONAL_SKILLS
    foreach ($skill in $allSkills) {
        $src = Join-Path $PKG_ROOT "skills\$skill"
        $dest = Join-Path $skillsRoot $skill
        if (Test-Path $src) {
            Write-Output "[2] Copy skill: $skill"
            Copy-Item -Path $src -Destination $dest -Recurse -Force
            if (-not (Test-Path (Join-Path $dest 'SKILL.md'))) {
                Write-Warning "  $skill - SKILL.md not found after copy"
            }
        } else {
            Write-Warning "  Skip (source missing): $skill"
        }
    }
} else {
    Write-Output "[2] Skip Skills install"
}

# Step 5: scoring 复制
if (-not $SkipScoring) {
    $scoringSrc = Join-Path $PKG_ROOT 'scoring'
    $scoringDest = Join-Path $TargetResolved 'scoring'
    if (Test-Path $scoringSrc) {
        Write-Output "[3] Copy scoring/ -> $scoringDest"
        Copy-Item -Path $scoringSrc -Destination $scoringDest -Recurse -Force
    } else {
        Write-Warning "[3] Skip scoring (source missing)"
    }
} else {
    Write-Output "[3] Skip scoring copy"
}

# Step 6: 验证检查 (T-INSTALL-4)
Write-Output ""
Write-Output "=== Install Verification ==="

$checks = @(
    @{ Path = '_bmad/core/workflows/party-mode/workflow.md'; Desc = 'Party-Mode workflow' }
    @{ Path = '_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml'; Desc = 'Create Story workflow' }
    @{ Path = '_bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml'; Desc = 'Dev Story workflow' }
    @{ Path = '_bmad/_config/agent-manifest.csv'; Desc = 'Agent manifest' }
    @{ Path = '_bmad-output/config/settings.json'; Desc = 'Worktree config' }
    @{ Path = 'commands/speckit.specify.md'; Desc = 'speckit command' }
    @{ Path = 'commands/bmad-bmm-create-story.md'; Desc = 'BMAD command' }
    @{ Path = 'rules/bmad-bug-auto-party-mode.mdc'; Desc = 'rules' }
    @{ Path = '.cursor/rules/bmad-bug-auto-party-mode.mdc'; Desc = 'Cursor rules' }
    @{ Path = '.cursor/commands/speckit.specify.md'; Desc = 'Cursor speckit command' }
    @{ Path = '.cursor/commands/bmad-bmm-create-story.md'; Desc = 'Cursor BMAD command' }
    @{ Path = '.cursor/agents/code-reviewer-config.yaml'; Desc = 'Cursor Code Reviewer' }
    @{ Path = 'config/code-reviewer-config.yaml'; Desc = 'Code Reviewer config' }
    @{ Path = 'templates/spec-template.md'; Desc = 'Spec template' }
    @{ Path = 'workflows/specify.md'; Desc = 'Specify workflow' }
)

$ok = 0
$missing = 0
foreach ($c in $checks) {
    $fullPath = Join-Path $TargetResolved $c.Path
    if (Test-Path $fullPath) {
        Write-Output "  [OK] $($c.Desc)"
        $ok++
    } else {
        Write-Output "  [MISSING] $($c.Desc) ($($c.Path))"
        $missing++
    }
}

# 全局 Skills 验证
$skillChecks = @(
    'speckit-workflow'
    'bmad-story-assistant'
    'bmad-bug-assistant'
    'bmad-code-reviewer-lifecycle'
    'code-review'
)
foreach ($s in $skillChecks) {
    $p = Join-Path $env:USERPROFILE ".cursor\skills\$s\SKILL.md"
    if (Test-Path $p) {
        Write-Output "  [OK] $s"
        $ok++
    } elseif ($SkipSkills) {
        Write-Output "  [SKIP] $s (Skills skipped)"
    } else {
        Write-Output "  [MISSING] $s"
        $missing++
    }
}

Write-Output ""
Write-Output "OK: $ok | Missing: $missing"
if ($missing -gt 0) {
    Write-Warning 'Some items missing, check installation'
    exit 1
}
Write-Output 'Install complete, all checks passed.'
