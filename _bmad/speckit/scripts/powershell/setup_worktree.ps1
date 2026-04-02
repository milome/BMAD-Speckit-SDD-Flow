# Git Worktree 快速设置脚本 (PowerShell 版本)
# 用于多 Agent 协作时快速创建独立的 worktree 环境

param(
    [Parameter(Position = 0)]
    [ValidateSet('create', 'list', 'remove', 'sync')]
    [string]$Command = 'list',

    [Parameter(Position = 1)]
    [string]$BranchName,

    [Parameter(Position = 2)]
    [string]$WorktreePath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Err {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Resolve-RepoDir {
    try {
        $repoDir = git rev-parse --show-toplevel 2>$null
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($repoDir)) {
            return $repoDir.Trim()
        }
    }
    catch {
    }

    $repoDir = Split-Path -Parent $PSScriptRoot
    while ($repoDir -and -not (Test-Path (Join-Path $repoDir '.git'))) {
        $parent = Split-Path -Parent $repoDir
        if ($parent -eq $repoDir) {
            break
        }
        $repoDir = $parent
    }

    if ($repoDir -and (Test-Path (Join-Path $repoDir '.git'))) {
        return $repoDir
    }

    return $null
}

function Resolve-RepoName {
    param([string]$RepoDir)

    if (-not [string]::IsNullOrWhiteSpace($env:REPO_NAME)) {
        return $env:REPO_NAME.Trim()
    }

    $item = Get-Item $RepoDir -ErrorAction SilentlyContinue
    if ($item -and -not [string]::IsNullOrWhiteSpace($item.Name)) {
        return $item.Name
    }

    $leaf = Split-Path -Leaf $RepoDir
    if (-not [string]::IsNullOrWhiteSpace($leaf) -and $leaf -ne '.' -and $leaf -ne '..') {
        return $leaf
    }

    Write-Warn 'Using fallback repo name: repo'
    return 'repo'
}

$RepoDir = Resolve-RepoDir
if (-not $RepoDir) {
    Write-Err 'Could not determine repository root'
    exit 1
}

$RepoDir = $RepoDir.TrimEnd('/', '\')
$WorktreeBaseDir = Split-Path -Parent $RepoDir
$RepoName = Resolve-RepoName -RepoDir $RepoDir
$BaseBranch = 'dev'

function Test-BranchExists {
    param([string]$Branch)

    $branches = git branch -a 2>$null
    return ($branches -match "remotes/origin/$Branch" -or $branches -match "^\s*${Branch}$")
}

function Test-WorktreeExists {
    param([string]$Branch)

    $worktrees = git worktree list 2>$null
    return ($worktrees -match [regex]::Escape($Branch))
}

function New-Worktree {
    param([string]$Branch)

    $resolvedWorktreePath = Join-Path $WorktreeBaseDir "$RepoName-$Branch"
    Write-Info "Creating worktree for branch: $Branch"

    if (Test-WorktreeExists -Branch $Branch) {
        Write-Warn "Worktree for branch '$Branch' already exists"
        if (Test-Path $resolvedWorktreePath) {
            Write-Info "Using existing worktree at: $resolvedWorktreePath"
            return $resolvedWorktreePath
        }
    }

    Push-Location $RepoDir
    try {
        if (-not (Test-BranchExists -Branch $Branch)) {
            Write-Info "Branch '$Branch' does not exist, creating from $BaseBranch"
            git fetch origin $BaseBranch | Out-Null
            git worktree add -b $Branch $resolvedWorktreePath "origin/$BaseBranch"
        }
        else {
            Write-Info "Branch '$Branch' exists, creating worktree"
            git fetch origin | Out-Null
            $localBranches = git branch --list $Branch
            if (-not [string]::IsNullOrWhiteSpace($localBranches)) {
                git worktree add $resolvedWorktreePath $Branch
            }
            else {
                git worktree add -b $Branch $resolvedWorktreePath "origin/$Branch"
            }
        }

        Write-Info "Worktree created at: $resolvedWorktreePath"
        return $resolvedWorktreePath
    }
    finally {
        Pop-Location
    }
}

function Get-Worktrees {
    Write-Info 'Current worktrees:'
    git worktree list
}

function Remove-Worktree {
    param([string]$Branch)

    $resolvedWorktreePath = Join-Path $WorktreeBaseDir "$RepoName-$Branch"
    if (-not (Test-Path $resolvedWorktreePath)) {
        Write-Err "Worktree path does not exist: $resolvedWorktreePath"
        return
    }

    Write-Info "Removing worktree: $resolvedWorktreePath"
    git worktree remove $resolvedWorktreePath
    Write-Info 'Worktree removed'
}

function Sync-Dev {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        Write-Err "Worktree path does not exist: $Path"
        return
    }

    Write-Info "Syncing with $BaseBranch branch..."
    Push-Location $Path
    try {
        git fetch origin
        git merge "origin/$BaseBranch"
        if ($LASTEXITCODE -ne 0) {
            Write-Warn 'Merge conflicts detected. Please resolve manually.'
        }
        else {
            Write-Info 'Sync completed'
        }
    }
    finally {
        Pop-Location
    }
}

Push-Location $RepoDir
try {
    switch ($Command) {
        'create' {
            if ([string]::IsNullOrWhiteSpace($BranchName)) {
                Write-Err 'Branch name required'
                Write-Host 'Usage: .\setup_worktree.ps1 create <branch-name>'
                exit 1
            }

            $createdPath = New-Worktree -Branch $BranchName
            if ($createdPath) {
                Write-Host ''
                Write-Info 'Worktree setup complete!'
                Write-Info 'To switch to worktree, run:'
                Write-Host "  cd $createdPath" -ForegroundColor Cyan
            }
        }
        'list' {
            Get-Worktrees
        }
        'remove' {
            if ([string]::IsNullOrWhiteSpace($BranchName)) {
                Write-Err 'Branch name required'
                Write-Host 'Usage: .\setup_worktree.ps1 remove <branch-name>'
                exit 1
            }

            Remove-Worktree -Branch $BranchName
        }
        'sync' {
            if ([string]::IsNullOrWhiteSpace($BranchName)) {
                Write-Err 'Worktree path required'
                Write-Host 'Usage: .\setup_worktree.ps1 sync <worktree-path>'
                exit 1
            }

            Sync-Dev -Path $BranchName
        }
        default {
            Write-Host 'Git Worktree Management Script (PowerShell)' -ForegroundColor Cyan
            Write-Host ''
            Write-Host 'Usage: .\setup_worktree.ps1 <command> [options]'
            Write-Host ''
            Write-Host 'Commands:'
            Write-Host '  create <branch-name>  Create a new worktree for the branch'
            Write-Host '  list                  List all existing worktrees'
            Write-Host '  remove <branch-name>  Remove a worktree'
            Write-Host '  sync <worktree-path>  Sync worktree with dev branch'
            Write-Host ''
            Write-Host 'Examples:'
            Write-Host '  .\setup_worktree.ps1 create 005-multi-timeframe-overlay'
            Write-Host '  .\setup_worktree.ps1 list'
            Write-Host '  .\setup_worktree.ps1 remove 005-multi-timeframe-overlay'
            Write-Host '  .\setup_worktree.ps1 sync ..\my-project-005-multi-timeframe-overlay'
            Write-Host ''
            Write-Host 'Note: Worktrees are created in the parent directory of the repository'
            Write-Host '      Path format: {parent-dir}/{repo-name}-{branch-name}'
        }
    }
}
finally {
    Pop-Location
}
