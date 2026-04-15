#!/usr/bin/env pwsh
<#
.SYNOPSIS
  BMAD-Speckit-SDD-Flow 一键安装脚本

.DESCRIPTION
  部署核心 + 扩展目录、同步 .cursor/、安装全局 Skills，并运行验证。

.PARAMETER Target
  目标项目根目录（必须）

.PARAMETER SkipSkills
  跳过全局 Skills 安装

.PARAMETER DryRun
  仅输出计划，不执行

.PARAMETER Full
  完整模式，与 -Target 配合时确保执行完整安装（init-to-root --full）

.PARAMETER Agent
  AI agent 类型：cursor (默认), claude-code, 或逗号分隔多选 (cursor,claude-code)

.PARAMETER Help
  显示帮助
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$Target,
    [string]$Agent = 'cursor',
    [switch]$SkipSkills,
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
    'bmad-standalone-tasks-doc-review',
    'bmad-rca-helper',
    'bmad-customization-backup',
    'bmad-orchestrator',
    'using-git-worktrees',
    'pr-template-generator',
    'auto-commit-utf8',
    'git-push-monitor',
    'bmad-eval-analytics'
)
$V6_CORE_SKILLS = @(
    'bmad-party-mode',
    'bmad-brainstorming',
    'bmad-advanced-elicitation',
    'bmad-distillator',
    'bmad-editorial-review-prose',
    'bmad-editorial-review-structure',
    'bmad-help',
    'bmad-index-docs',
    'bmad-review-adversarial-general',
    'bmad-review-edge-case-hunter',
    'bmad-shard-doc'
)

function Show-Help {
    Write-Output "BMAD-Speckit-SDD-Flow setup script"
    Write-Output "Usage: pwsh scripts/setup.ps1 -Target <path> [options]"
    Write-Output "  -Target <path>    Target project root (required)"
    Write-Output "  -Agent <type>     AI agent: cursor (default), claude-code, or comma-separated"
    Write-Output "  -Full             Full install mode (default when using setup:full)"
    Write-Output "  -SkipSkills       Skip global Skills install"
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

$AgentAliases = @{ 'cursor-agent' = 'cursor'; 'claude' = 'claude-code' }
$AgentList = $Agent -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ } | ForEach-Object {
    if ($AgentAliases.ContainsKey($_)) { $AgentAliases[$_] } else { $_ }
}
$ValidAgents = @('cursor', 'claude-code')
foreach ($a in $AgentList) {
    if ($a -notin $ValidAgents) {
        Write-Error "Invalid -Agent value: $a. Valid: $($ValidAgents -join ', '), cursor-agent, claude"
        exit 1
    }
}

Write-Output "=== BMAD-Speckit-SDD-Flow Setup ==="
Write-Output "PKG_ROOT: $PKG_ROOT"
Write-Output "Target:   $TargetResolved"
Write-Output "Agent:    $($AgentList -join ', ')"
Write-Output ""

if ($DryRun) {
    Write-Output "[DryRun] Plan:"
    foreach ($ag in $AgentList) {
        Write-Output "  1. node scripts/init-to-root.js --full --agent $ag $TargetResolved"
    }
    Write-Output "  2. Agent sync (via init-to-root)"
    if (-not $SkipSkills) {
        Write-Output "  3. Copy REQUIRED_SKILLS: $($REQUIRED_SKILLS -join ', ')"
        Write-Output "  4. Copy OPTIONAL_SKILLS: $($OPTIONAL_SKILLS -join ', ')"
    } else {
        Write-Output "  3. Skip Skills install"
    }
    Write-Output "  5. Run validation"
    exit 0
}

# Step 1–2: init-to-root --full for each agent
foreach ($ag in $AgentList) {
    Write-Output "[1] Deploying core+extended dirs (agent=$ag)..."
    & node (Join-Path $PKG_ROOT 'scripts\init-to-root.js') --full --agent $ag $TargetResolved
    if ($LASTEXITCODE -ne 0) {
        Write-Error "init-to-root.js failed for agent=$ag"
        exit 1
    }
}

# Step 3–4: Skills 复制
if (-not $SkipSkills) {
    $skillTargets = @()
    foreach ($ag in $AgentList) {
        switch ($ag) {
            'cursor' { $skillTargets += Join-Path $env:USERPROFILE '.cursor\skills' }
            'claude-code' { $skillTargets += Join-Path $env:USERPROFILE '.claude\skills' }
        }
    }
    $skillTargets = $skillTargets | Select-Object -Unique

    $allSkills = $REQUIRED_SKILLS + $OPTIONAL_SKILLS + $V6_CORE_SKILLS

    function Find-SkillSource {
        param([string]$SkillName, [string]$AgentId)
        $candidates = @(
            (Join-Path $PKG_ROOT "skills\$SkillName"),
            (Join-Path $PKG_ROOT "_bmad\skills\$SkillName"),
            (Join-Path $PKG_ROOT "_bmad\core\skills\$SkillName")
        )
        if ($AgentId -eq 'cursor') {
            $candidates = @((Join-Path $PKG_ROOT "_bmad\cursor\skills\$SkillName")) + $candidates
        } elseif ($AgentId -eq 'claude-code') {
            $candidates = @((Join-Path $PKG_ROOT "_bmad\claude\skills\$SkillName")) + $candidates
        }
        foreach ($c in $candidates) {
            if (Test-Path $c) { return $c }
        }
        return $null
    }

    foreach ($skillsRoot in $skillTargets) {
        if (-not (Test-Path $skillsRoot)) {
            New-Item -ItemType Directory -Path $skillsRoot -Force | Out-Null
        }
        $currentAgent = if ($skillsRoot -match '\.cursor') { 'cursor' } else { 'claude-code' }
        foreach ($skill in $allSkills) {
            $src = Find-SkillSource -SkillName $skill -AgentId $currentAgent
            $dest = Join-Path $skillsRoot $skill
            if ($src) {
                Write-Output "[2] Copy skill: $skill -> $skillsRoot (from $(Split-Path $src -Parent | Split-Path -Leaf))"
                Copy-Item -Path $src -Destination $dest -Recurse -Force
                if (-not (Test-Path (Join-Path $dest 'SKILL.md'))) {
                    Write-Warning "  $skill - SKILL.md not found after copy"
                }
            } else {
                Write-Warning "  Skip (source missing): $skill"
            }
        }
    }
} else {
    Write-Output "[2] Skip Skills install"
}

# Step 5: 验证检查 (T-INSTALL-4)
Write-Output ""
Write-Output "=== Install Verification ==="

$checks = @(
    @{ Path = 'specs'; Desc = 'specs/ (Speckit feature output root)' }
    @{ Path = 'package.json'; Desc = 'package.json with bmad-speckit' }
    @{ Path = '_bmad/core/workflows/party-mode/workflow.md'; Desc = 'Party-Mode workflow' }
    @{ Path = '_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml'; Desc = 'Create Story workflow' }
    @{ Path = '_bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml'; Desc = 'Dev Story workflow' }
    @{ Path = '_bmad/_config/agent-manifest.csv'; Desc = 'Agent manifest' }
    @{ Path = '_bmad-output/config'; Desc = '_bmad-output/config dir' }
    @{ Path = '_bmad/_config/code-reviewer-config.yaml'; Desc = 'Code Reviewer config' }
    @{ Path = '_bmad/speckit/templates/spec-template.md'; Desc = 'Spec template' }
    @{ Path = '_bmad/speckit/workflows/specify.md'; Desc = 'Specify workflow' }
    @{ Path = '.specify/templates/spec-template.md'; Desc = '.specify template deployment' }
)

foreach ($ag in $AgentList) {
    switch ($ag) {
        'cursor' {
            $checks += @(
                @{ Path = '.cursor/rules/bmad-bug-auto-party-mode-rule.mdc'; Desc = 'Cursor rules' }
                @{ Path = '.cursor/commands/speckit.specify.md'; Desc = 'Cursor speckit command' }
                @{ Path = '.cursor/commands/bmad-bmm-create-story.md'; Desc = 'Cursor BMAD command' }
                @{ Path = '.cursor/agents/code-reviewer-config.yaml'; Desc = 'Cursor Code Reviewer' }
            )
        }
        'claude-code' {
            $checks += @(
                @{ Path = '.claude/commands'; Desc = 'Claude commands dir' }
                @{ Path = '.claude/rules'; Desc = 'Claude rules dir' }
                @{ Path = '.claude/agents'; Desc = 'Claude agents dir' }
                @{ Path = '.claude/hooks'; Desc = 'Claude hooks dir' }
                @{ Path = '.claude/settings.json'; Desc = 'Claude settings' }
                @{ Path = 'CLAUDE.md'; Desc = 'CLAUDE.md project file' }
            )
        }
    }
}

$ok = 0
$missing = 0
foreach ($c in $checks) {
    $fullPath = Join-Path $TargetResolved $c.Path
    if ($c.Path -eq 'package.json' -and -not (Test-Path $fullPath)) {
        Write-Output "  [OK] package.json absent (optional; init-to-root: add --with-package-json for local bmad-speckit devDependency)"
        $ok++
        continue
    }
    if ($c.Path -eq 'package.json' -and (Test-Path $fullPath)) {
        try {
            $pkgText = Get-Content -LiteralPath $fullPath -Raw -ErrorAction Stop
            if ($pkgText -notmatch 'bmad-speckit') {
                Write-Output "  [MISSING] package.json lacks bmad-speckit devDependency"
                $missing++
                continue
            }
        } catch {
            Write-Output "  [MISSING] package.json unreadable"
            $missing++
            continue
        }
    }
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
foreach ($ag in $AgentList) {
    $agentSkillRoot = switch ($ag) {
        'cursor'     { Join-Path $env:USERPROFILE '.cursor\skills' }
        'claude-code' { Join-Path $env:USERPROFILE '.claude\skills' }
    }
    foreach ($s in $skillChecks) {
        $p = Join-Path $agentSkillRoot "$s\SKILL.md"
        if (Test-Path $p) {
            Write-Output "  [OK] $s ($ag)"
            $ok++
        } elseif ($SkipSkills) {
            Write-Output "  [SKIP] $s ($ag) (Skills skipped)"
        } else {
            Write-Output "  [MISSING] $s ($ag)"
            $missing++
        }
    }
}

Write-Output ""
Write-Output "OK: $ok | Missing: $missing"
if ($missing -gt 0) {
    Write-Warning 'Some items missing, check installation'
    exit 1
}
Write-Output 'Install complete, all checks passed.'
