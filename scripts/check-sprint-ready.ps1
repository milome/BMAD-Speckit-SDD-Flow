#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Check if sprint-status.yaml exists and contains valid sprint tracking structure.

.DESCRIPTION
    Centralized script for sprint-status existence and basic validity checking.
    Used by create-story, dev-story, bmad-story-assistant to enforce sprint-planning
    as a prerequisite before Story creation or development.

    Supported sprint-status structures: development_status, epics, or project-defined
    equivalent fields. See TASKS_sprint-planning-gate.md §2.

.PARAMETER Json
    Output result as JSON: { SPRINT_READY, SPRINT_STATUS_PATH, MESSAGE }

.PARAMETER RepoRoot
    Project root directory. If not provided, inferred from git or script location.

.EXAMPLE
    ./scripts/check-sprint-ready.ps1 -Json
    Output: {"SPRINT_READY":true,"SPRINT_STATUS_PATH":"...","MESSAGE":"..."}

.EXAMPLE
    ./scripts/check-sprint-ready.ps1 -RepoRoot D:\Dev\MyProject -Json

.NOTES
    Callers: create-story instructions.xml, dev-story instructions.xml,
    bmad-story-assistant SKILL (phase 1 pre-check), check-prerequisites.ps1
#>

[CmdletBinding()]
param(
    [switch]$Json,
    [string]$RepoRoot
)

$ErrorActionPreference = 'Stop'

# Resolve repo root
if (-not $RepoRoot) {
    try {
        $result = git rev-parse --show-toplevel 2>$null
        if ($LASTEXITCODE -eq 0) {
            $RepoRoot = $result
        }
    } catch { }
    if (-not $RepoRoot) {
        $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
    }
}

$implArtifacts = Join-Path $RepoRoot "_bmad-output/implementation-artifacts"
$sprintStatusPath = Join-Path $implArtifacts "sprint-status.yaml"

$sprintReady = $false
$message = ""

if (-not (Test-Path $sprintStatusPath -PathType Leaf)) {
    $message = "sprint-status.yaml not found. Run sprint-planning to initialize."
} else {
    try {
        # Parse YAML (minimal - we only need to detect development_status or epics)
        $content = Get-Content $sprintStatusPath -Raw
        $hasDevStatus = $content -match 'development_status\s*:'
        $hasEpics = $content -match 'epics\s*:'
        if ($hasDevStatus -or $hasEpics) {
            $sprintReady = $true
            $message = "Sprint status valid."
        } else {
            $message = "sprint-status.yaml exists but lacks development_status or epics. Run sprint-planning."
        }
    } catch {
        $message = "sprint-status.yaml unreadable or invalid: $($_.Exception.Message)"
    }
}

if ($Json) {
    $obj = [PSCustomObject]@{
        SPRINT_READY    = $sprintReady
        SPRINT_STATUS_PATH = $sprintStatusPath
        MESSAGE         = $message
    }
    $obj | ConvertTo-Json -Compress
} else {
    Write-Output "SPRINT_READY: $sprintReady"
    Write-Output "SPRINT_STATUS_PATH: $sprintStatusPath"
    Write-Output "MESSAGE: $message"
}

# Exit 0 for ready, 1 for not ready (callers can check JSON or exit code)
exit $(if ($sprintReady) { 0 } else { 1 })
