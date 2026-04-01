#!/usr/bin/env pwsh

$ErrorActionPreference = 'Stop'
$canonical = Join-Path $PSScriptRoot '..\_bmad\speckit\scripts\powershell\check-sprint-ready.ps1'

if (-not (Test-Path $canonical -PathType Leaf)) {
    Write-Error "Canonical sprint gate script not found: $canonical"
    exit 1
}

& $canonical @args
exit $LASTEXITCODE
