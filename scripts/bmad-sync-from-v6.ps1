#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Sync core/bmm/utility from BMAD-METHOD to _bmad, excluding protected items.
.PARAMETER Phase
    1|2|3|all
.PARAMETER DryRun
    List operations only.
.PARAMETER BackupDir
    Backup directory.
.PARAMETER ProjectRoot
    Project root.
.PARAMETER V6Ref
    Git ref to sync from (tag or branch). Default: main
#>

[CmdletBinding()]
param(
    [ValidateSet('1', '2', '3', 'all')]
    [string]$Phase = '1',
    [switch]$DryRun,
    [string]$BackupDir,
    [string]$ProjectRoot,
    [string]$V6Ref = 'main'
)

$ErrorActionPreference = 'Stop'

# --- Constants ---
$BMAD_METHOD_REPO = 'https://github.com/bmad-code-org/BMAD-METHOD.git'
$EXCLUDE_PATTERNS = @(
    '_bmad/_config',
    '_bmad/_memory',
    '_bmad/bmb',
    '_bmad/scoring',
    '_bmad/speckit',
    '_bmad/core/agents/adversarial-reviewer.md',
    '_bmad/core/agents/critical-auditor-guide.md',
    '_bmad/core/agents/README-critical-auditor.md',
    '_bmad/_config/agent-manifest.csv',
    '_bmad/core/workflows/party-mode',
    'adversarial-reviewer.md',
    'critical-auditor-guide.md',
    'README-critical-auditor.md',
    'bmad-speckit',
    'agent-manifest.csv'
)

# Backup items: From (relative to project) -> To (in BackupDir)
$BACKUP_ITEMS = @(
    ,@{ From = "_bmad/scoring"; To = "_bmad_scoring" }
    ,@{ From = "_bmad/core/agents/adversarial-reviewer.md"; To = "adversarial-reviewer.md" }
    ,@{ From = "_bmad/core/agents/critical-auditor-guide.md"; To = "critical-auditor-guide.md" }
    ,@{ From = "_bmad/core/agents/README-critical-auditor.md"; To = "README-critical-auditor.md" }
    ,@{ From = "_bmad/speckit"; To = "bmad_speckit" }
    ,@{ From = "_bmad/_config/agent-manifest.csv"; To = "agent-manifest.csv" }
    ,@{ From = "_bmad/core/workflows/party-mode"; To = "party-mode-workflow" }
)

# --- Resolve ProjectRoot ---
if (-not $ProjectRoot) {
    try {
        $root = git rev-parse --show-toplevel 2>$null
        if ($LASTEXITCODE -eq 0 -and $root) {
            $ProjectRoot = $root
        }
    } catch { }
    if (-not $ProjectRoot) {
        $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
    }
}
$ProjectRoot = (Resolve-Path $ProjectRoot).Path

# --- Resolve BackupDir ---
if (-not $BackupDir) {
    $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $rand = -join ((65..90) + (97..122) | Get-Random -Count 4 | ForEach-Object { [char]$_ })
    $BackupDir = Join-Path $ProjectRoot "_bmad-output/bmad-sync-backups/$timestamp-$rand"
}
if (-not [System.IO.Path]::IsPathRooted($BackupDir)) {
    $BackupDir = Join-Path $ProjectRoot $BackupDir
}

# --- Exclude check ---
function Test-ExcludedPath {
    param([string]$RelativePath)
    $normalizedRel = $RelativePath -replace '\\', '/'
    foreach ($p in $EXCLUDE_PATTERNS) {
        if ($normalizedRel -like "*$p*" -or $normalizedRel -like "$p*") {
            return $true
        }
    }
    return $false
}

# --- Fetch v6 ---
function Get-V6SourcePath {
    $tempBase = [System.IO.Path]::GetTempPath()
    $tempDir = Join-Path $tempBase "bmad-method-$V6Ref-$(Get-Random)"
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

    try {
        $prevEAP = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        git clone --depth 1 --branch $V6Ref $BMAD_METHOD_REPO $tempDir 2>$null
        $cloneExit = $LASTEXITCODE
        $ErrorActionPreference = $prevEAP
        if ($cloneExit -ne 0) {
            throw "git clone failed (exit $cloneExit). Check network and V6Ref=$V6Ref."
        }
        $srcPath = Join-Path $tempDir 'src'
        if (-not (Test-Path $srcPath)) {
            throw "v6 source layout changed: src/ not found."
        }
        return $tempDir
    } catch {
        if (Test-Path $tempDir) {
            Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
        }
        Write-Error "Failed to fetch BMAD-METHOD $V6Ref : $_"
    }
}

# --- Backup ---
function Invoke-Backup {
    $ops = @()
    foreach ($item in $BACKUP_ITEMS) {
        $src = Join-Path $ProjectRoot $item.From
        if (Test-Path $src) {
            $dst = Join-Path $BackupDir $item.To
            $ops += @{ Action = 'Backup'; Source = $src; Dest = $dst }
        }
    }
    return $ops
}

# --- Phase 1 ---
function Get-Phase1Operations {
    $ops = @()

    # 1. Path fix: step-04 non-standard reference
    $step04 = Join-Path $ProjectRoot '_bmad/bmm/workflows/3-solutioning/create-epics-and-stories/steps/step-04-final-validation.md'
    if (Test-Path $step04) {
        $content = Get-Content $step04 -Raw
        if ($content -match '`_bmad/core/tasks/help\.md`') {
            $ops += @{ Action = 'Modify'; Path = $step04; Change = '_bmad/core/tasks/help.md -> {project-root}/_bmad/core/tasks/help.md' }
        }
    }

    # 2. Party Mode Return Protocol: try fetch v6 for step-03 diff
    try {
        $v6Root = Get-V6SourcePath
        try {
            $v6Step03 = Join-Path $v6Root "src/core/workflows/party-mode/steps/step-03-graceful-exit.md"
            $localStep03 = Join-Path $ProjectRoot '_bmad/core/workflows/party-mode/steps/step-03-graceful-exit.md'
            if ((Test-Path $v6Step03) -and (Test-Path $localStep03)) {
                $localContent = Get-Content $localStep03 -Raw
                if ($localContent -match 'RETURN PROTOCOL' -and $localContent -match 'Challenger Final Review') {
                    $ops += @{ Action = 'Info'; Message = 'step-03: Local has RETURN PROTOCOL + Challenger Final Review. Manual diff with v6 recommended if needed.' }
                }
            }
        } finally {
            if ($v6Root -and (Test-Path $v6Root)) { Remove-Item -Recurse -Force $v6Root -ErrorAction SilentlyContinue }
        }
    } catch {
        $errMsg = "step-03: Could not fetch v6. Local step-03 kept as-is. Error: " + $_.Exception.Message
$ops += @{ Action = 'Info'; Message = $errMsg }
    }

    return $ops
}

# --- Phase 2 ---
function Get-Phase2Operations {
    $v6Root = Get-V6SourcePath
    $ops = @()
    $v6Src = Join-Path $v6Root 'src'

    # Scan v6 src/core, src/bmm, src/utility for files to copy (exclude protected)
    $toCopy = @()
    foreach ($dir in @('core', 'bmm', 'utility')) {
        $srcDir = Join-Path $v6Src $dir
        if (-not (Test-Path $srcDir)) { continue }
        Get-ChildItem -Path $srcDir -Recurse -File | ForEach-Object {
            $rel = $_.FullName.Substring($srcDir.Length + 1)
            $destRel = "_bmad/$dir/$rel"
            if (-not (Test-ExcludedPath $destRel)) {
                $toCopy += @{ Source = $_.FullName; Dest = Join-Path $ProjectRoot $destRel }
            }
        }
    }

    foreach ($c in $toCopy) {
        $ops += @{ Action = 'Copy'; Source = $c.Source; Dest = $c.Dest }
    }

    # Edge Case Hunter, bmad-os paths follow v6 layout
    $ops += @{ Action = 'Info'; Message = 'Phase 2: After copy, verify task-manifest.csv or workflow-manifest.csv for Edge Case Hunter.' }

    # Auto-sync _bmad/core/skills/ -> _bmad/skills/ (universal skill distribution)
    $coreSkillsDir = Join-Path $ProjectRoot '_bmad/core/skills'
    if (Test-Path $coreSkillsDir) {
        $ops += @{ Action = 'SkillSync'; Source = $coreSkillsDir; Dest = (Join-Path $ProjectRoot '_bmad/skills') }
    }

    return @{ Ops = $ops; TempDir = $v6Root }
}

# --- Rollback commands ---
function Write-RollbackCommands {
    param([string]$BakDir, [string]$ProjRoot)
    Write-Host "`n--- Rollback commands ---" -ForegroundColor Yellow
    foreach ($item in $BACKUP_ITEMS) {
        $dest = Join-Path $ProjRoot $item.From
        $bak = Join-Path $BakDir $item.To
        if (-not (Test-Path $bak)) { continue }
        if (Test-Path $bak -PathType Container) {
            Write-Host "Remove-Item -Recurse -Force `"$dest`" -ErrorAction SilentlyContinue; Copy-Item -Recurse -Force `"$bak`" `"$dest`""
        } else {
            Write-Host "Copy-Item -Force `"$bak`" `"$dest`""
        }
    }
    Write-Host "---" -ForegroundColor Yellow
}

# --- Main ---
$script:HadError = $false

try {
    Write-Host "BMAD-METHOD v6 Sync | Phase=$Phase | DryRun=$DryRun | ProjectRoot=$ProjectRoot" -ForegroundColor Cyan

    # 1. Backup
    $backupOps = Invoke-Backup
    if ($DryRun) {
        Write-Host "`n[DryRun] Backups to perform:" -ForegroundColor Magenta
        foreach ($op in $backupOps) {
            Write-Host "  Backup: $($op.Source) -> $($op.Dest)"
        }
    } else {
        New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
        foreach ($op in $backupOps) {
            $destDir = Split-Path $op.Dest -Parent
            if (-not (Test-Path $destDir)) {
                New-Item -ItemType Directory -Path $destDir -Force | Out-Null
            }
            if (Test-Path $op.Source -PathType Container) {
                Copy-Item -Recurse -Force $op.Source $op.Dest
            } else {
                Copy-Item -Force $op.Source $op.Dest
            }
            Write-Host "  Backed up: $($op.Source) -> $($op.Dest)" -ForegroundColor Green
        }
    }

    # 2. Phase ops
    $phaseOps = @()
    $phase2TempDir = $null
    $phasesToRun = if ($Phase -eq 'all') { @('1', '2') } else { @($Phase) }
    foreach ($p in $phasesToRun) {
        if ($p -eq '1') {
            $phaseOps += Get-Phase1Operations
        } elseif ($p -eq '2') {
            $r = Get-Phase2Operations
            $phaseOps += $r.Ops
            $phase2TempDir = $r.TempDir
        } elseif ($p -eq '3') {
            Write-Host "`nPhase 3 not implemented (see design doc)." -ForegroundColor Yellow
        }
    }

    if ($DryRun) {
        Write-Host "`n[DryRun] Phase operations:" -ForegroundColor Magenta
        foreach ($op in $phaseOps) {
            if ($op.Action -eq 'Info') {
                Write-Host "  Info: $($op.Message)"
            } elseif ($op.Action -eq 'Modify') {
                Write-Host "  Modify: $($op.Path)"
                Write-Host "    Change: $($op.Change)"
            } elseif ($op.Action -eq 'Copy') {
                Write-Host "  Copy: $($op.Source) -> $($op.Dest)"
            }
        }
        Write-Host "`n[DryRun] Done. No files modified." -ForegroundColor Magenta
    } else {
        foreach ($op in $phaseOps) {
            if ($op.Action -eq 'Modify' -and $op.Path -like '*step-04*') {
                $content = Get-Content $op.Path -Raw
                $content = $content -replace '`_bmad/core/tasks/help\.md`', '`{project-root}/_bmad/core/tasks/help.md`'
                Set-Content -Path $op.Path -Value $content -NoNewline
                Write-Host "  Modified: $($op.Path)" -ForegroundColor Green
            } elseif ($op.Action -eq 'Copy') {
                $destDir = Split-Path $op.Dest -Parent
                if (-not (Test-Path $destDir)) {
                    New-Item -ItemType Directory -Path $destDir -Force | Out-Null
                }
                Copy-Item -Force $op.Source $op.Dest
                Write-Host "  Copied: $($op.Dest)" -ForegroundColor Green
            } elseif ($op.Action -eq 'SkillSync') {
                if (Test-Path $op.Source) {
                    if (-not (Test-Path $op.Dest)) {
                        New-Item -ItemType Directory -Path $op.Dest -Force | Out-Null
                    }
                    Copy-Item -Recurse -Force (Join-Path $op.Source '*') $op.Dest
                    Write-Host "  Skill sync: $($op.Source) -> $($op.Dest)" -ForegroundColor Green
                    Remove-Item -Recurse -Force $op.Source -ErrorAction SilentlyContinue
                    Write-Host "  Removed redundant: $($op.Source) (_bmad/skills/ is canonical)" -ForegroundColor Green
                }
            }
        }
        Write-RollbackCommands -BakDir $BackupDir -ProjRoot $ProjectRoot
    }

    # 3. Cleanup Phase 2 temp dir
    if ($phase2TempDir -and (Test-Path $phase2TempDir)) {
        Remove-Item -Recurse -Force $phase2TempDir -ErrorAction SilentlyContinue
    }

} catch {
    $script:HadError = $true
    Write-Error $_
    exit 1
}
