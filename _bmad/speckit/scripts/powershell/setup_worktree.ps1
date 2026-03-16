# Git Worktree 快速设置脚本 (PowerShell版本)
# 用于多Agent协作时快速创建独立的worktree环境

param(
    [Parameter(Position=0)]
    [ValidateSet("create", "list", "remove", "sync")]
    [string]$Command,
    
    [Parameter(Position=1)]
    [string]$BranchName,
    
    [Parameter(Position=2)]
    [string]$WorktreePath
)

# 配置：使用 git 获取 repo 根，确保 worktree 创建在父目录（与主 repo 平级）
$RepoDir = $null
try {
    $RepoDir = git rev-parse --show-toplevel 2>$null
    if ($LASTEXITCODE -ne 0) { $RepoDir = $null }
}
catch {
    $RepoDir = $null
}
if (-not $RepoDir) {
    $RepoDir = Split-Path -Parent $PSScriptRoot
    while ($RepoDir -and -not (Test-Path (Join-Path $RepoDir '.git'))) {
        $parent = Split-Path -Parent $RepoDir
        if ($parent -eq $RepoDir) { break }
        $RepoDir = $parent
    }
}
if (-not $RepoDir) {
    Write-Host "[ERROR] Could not determine repository root" -ForegroundColor Red
    exit 1
}
$RepoDir = $RepoDir.TrimEnd('/', '\')
$WorktreeBaseDir = Split-Path -Parent $RepoDir

# 动态获取 repo 名称（替代硬编码 micang-trader）
$RepoName = $null
if ([string]::IsNullOrWhiteSpace($env:REPO_NAME) -eq $false) {
    $RepoName = $env:REPO_NAME.Trim()
}
if (-not $RepoName) {
    $RepoName = (Get-Item $RepoDir -ErrorAction SilentlyContinue).Name
}
if (-not $RepoName) {
    $RepoName = Split-Path -Leaf $RepoDir
}
if (-not $RepoName -or $RepoName -eq "." -or $RepoName -eq "..") {
    $RepoName = "repo"
    Write-Host "[WARN] Using fallback repo name: repo" -ForegroundColor Yellow
}

$BaseBranch = "dev"

# 函数：打印信息
function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# 函数：检查分支是否存在
function Test-BranchExists {
    param([string]$Branch)
    $branches = git branch -a
    return ($branches -match "remotes/origin/$Branch" -or $branches -match "^\s+$Branch")
}

# 函数：检查worktree是否存在
function Test-WorktreeExists {
    param([string]$Branch)
    $worktrees = git worktree list
    return ($worktrees -match $Branch)
}

# 函数：创建worktree
function New-Worktree {
    param([string]$Branch)
    
    $worktreePath = Join-Path $WorktreeBaseDir "$RepoName-$Branch"
    
    Write-Info "Creating worktree for branch: $Branch"
    
    # 检查worktree是否已存在
    if (Test-WorktreeExists $Branch) {
        Write-Warn "Worktree for branch '$Branch' already exists"
        $response = Read-Host "Remove existing worktree and create new one? (y/N)"
        if ($response -eq "y" -or $response -eq "Y") {
            git worktree remove $worktreePath --force 2>$null
        } else {
            Write-Info "Using existing worktree at: $worktreePath"
            return $worktreePath
        }
    }
    
    # 切换到repo目录
    Push-Location $RepoDir
    
    try {
        # 检查分支是否存在
        if (-not (Test-BranchExists $Branch)) {
            Write-Info "Branch '$Branch' does not exist, creating from $BaseBranch"
            git checkout $BaseBranch
            git pull origin $BaseBranch 2>$null
            git checkout -b $Branch
        } else {
            Write-Info "Branch '$Branch' exists, checking it out"
            git fetch origin
            $localBranches = git branch
            if ($localBranches -match "^\s+$Branch") {
                git checkout $Branch
            } else {
                git checkout -b $Branch "origin/$Branch"
            }
        }
        
        # 创建worktree
        git worktree add $worktreePath $Branch
        
        Write-Info "Worktree created at: $worktreePath"
        return $worktreePath
    } finally {
        Pop-Location
    }
}

# 函数：列出所有worktree
function Get-Worktrees {
    Write-Info "Current worktrees:"
    git worktree list
}

# 函数：删除worktree
function Remove-Worktree {
    param([string]$Branch)
    
    $worktreePath = Join-Path $WorktreeBaseDir "$RepoName-$Branch"
    
    if (-not (Test-Path $worktreePath)) {
        Write-Error "Worktree path does not exist: $worktreePath"
        return
    }
    
    Write-Info "Removing worktree: $worktreePath"
    git worktree remove $worktreePath
    Write-Info "Worktree removed"
}

# 函数：同步dev分支
function Sync-Dev {
    param([string]$Path)
    
    if (-not (Test-Path $Path)) {
        Write-Error "Worktree path does not exist: $Path"
        return
    }
    
    Write-Info "Syncing with $BaseBranch branch..."
    Push-Location $Path
    
    try {
        git fetch origin
        git merge "origin/$BaseBranch"
        if ($LASTEXITCODE -ne 0) {
            Write-Warn "Merge conflicts detected. Please resolve manually."
        } else {
            Write-Info "Sync completed"
        }
    } finally {
        Pop-Location
    }
}

# 主逻辑
Push-Location $RepoDir

try {
    switch ($Command) {
        "create" {
            if ([string]::IsNullOrEmpty($BranchName)) {
                Write-Error "Branch name required"
                Write-Host "Usage: .\setup_worktree.ps1 create <branch-name>"
                exit 1
            }
            $worktreePath = New-Worktree $BranchName
            if ($worktreePath) {
                Write-Host ""
                Write-Info "Worktree setup complete!"
                Write-Info "To switch to worktree, run:"
                Write-Host "  cd $worktreePath" -ForegroundColor Cyan
            }
        }
        "list" {
            Get-Worktrees
        }
        "remove" {
            if ([string]::IsNullOrEmpty($BranchName)) {
                Write-Error "Branch name required"
                Write-Host "Usage: .\setup_worktree.ps1 remove <branch-name>"
                exit 1
            }
            Remove-Worktree $BranchName
        }
        "sync" {
            if ([string]::IsNullOrEmpty($WorktreePath)) {
                Write-Error "Worktree path required"
                Write-Host "Usage: .\setup_worktree.ps1 sync <worktree-path>"
                exit 1
            }
            Sync-Dev $WorktreePath
        }
        default {
            Write-Host "Git Worktree Management Script (PowerShell)" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "Usage: .\setup_worktree.ps1 <command> [options]"
            Write-Host ""
            Write-Host "Commands:"
            Write-Host "  create <branch-name>  Create a new worktree for the branch"
            Write-Host "  list                  List all existing worktrees"
            Write-Host "  remove <branch-name>  Remove a worktree"
            Write-Host "  sync <worktree-path>  Sync worktree with dev branch"
            Write-Host ""
            Write-Host "Examples:"
            Write-Host "  .\setup_worktree.ps1 create 005-multi-timeframe-overlay"
            Write-Host "  .\setup_worktree.ps1 list"
            Write-Host "  .\setup_worktree.ps1 remove 005-multi-timeframe-overlay"
            Write-Host "  .\setup_worktree.ps1 sync ..\my-project-005-multi-timeframe-overlay"
            Write-Host ""
            Write-Host "Note: Worktrees are created in the parent directory of the repository"
            Write-Host "      Path format: {parent-dir}/{repo-name}-{branch-name}"
            Write-Host "      Example: If repo is at D:\Dev\my-project, worktree at D:\Dev\my-project-016-test"
            Write-Host "      Repo name = directory name of repo root (override with REPO_NAME env var)"
        }
    }
} finally {
    Pop-Location
}

