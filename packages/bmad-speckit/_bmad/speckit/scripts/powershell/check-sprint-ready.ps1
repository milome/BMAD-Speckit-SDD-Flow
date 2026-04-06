#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Canonical Speckit sprint-status gate implementation.

.DESCRIPTION
    This is the canonical implementation under `_bmad/speckit/scripts/`.
    Project-root `scripts/check-sprint-ready.ps1` should remain a thin wrapper.

.PARAMETER Json
    Output result as JSON: { SPRINT_READY, SPRINT_STATUS_PATH, MESSAGE }

.PARAMETER RepoRoot
    Project root directory. If not provided, inferred from git or from this script's canonical location.
#>

[CmdletBinding()]
param(
    [switch]$Json,
    [string]$RepoRoot
)

$ErrorActionPreference = 'Stop'

if (-not $RepoRoot) {
    try {
        $result = git rev-parse --show-toplevel 2>$null
        if ($LASTEXITCODE -eq 0) {
            $RepoRoot = $result
        }
    } catch { }

    if (-not $RepoRoot) {
        $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..")).Path
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
    [PSCustomObject]@{
        SPRINT_READY      = $sprintReady
        SPRINT_STATUS_PATH = $sprintStatusPath
        MESSAGE           = $message
    } | ConvertTo-Json -Compress
} else {
    Write-Output "SPRINT_READY: $sprintReady"
    Write-Output "SPRINT_STATUS_PATH: $sprintStatusPath"
    Write-Output "MESSAGE: $message"
}

exit $(if ($sprintReady) { 0 } else { 1 })
