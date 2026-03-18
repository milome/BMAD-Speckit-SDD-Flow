# Start Git Push in Background and Monitor Progress
# Automatically launches git push in background and starts monitoring

param(
    [string]$BranchName = "",
    [string]$RemoteName = "origin",
    [int]$MaxWaitSeconds = 600,
    [int]$CheckInterval = 5
)

# Auto-detect branch if not provided
if ([string]::IsNullOrEmpty($BranchName)) {
    $BranchName = git rev-parse --abbrev-ref HEAD 2>$null
    if (-not $BranchName) {
        Write-Host "ERROR: Could not detect current branch. Please specify -BranchName" -ForegroundColor Red
        exit 1
    }
}

Write-Host "=== Starting Git Push with Monitor ===" -ForegroundColor Cyan
Write-Host "Branch: $BranchName" -ForegroundColor Cyan
Write-Host "Remote: $RemoteName`n" -ForegroundColor Cyan

# Get initial remote commit for monitoring
$remoteBranch = "$RemoteName/$BranchName"
$initialRemoteCommit = git rev-parse $remoteBranch 2>$null
$localCommit = git rev-parse HEAD

if ($initialRemoteCommit -eq $localCommit) {
    Write-Host "INFO: Local and remote are already in sync. Nothing to push." -ForegroundColor Yellow
    exit 0
}

# Start git push in background
Write-Host "Starting git push in background..." -ForegroundColor Green
$pushJob = Start-Job -ScriptBlock {
    param($branch, $remote)
    Set-Location $using:PWD
    git push --set-upstream $remote $branch 2>&1
} -ArgumentList $BranchName, $RemoteName

Write-Host "Push job started (ID: $($pushJob.Id))" -ForegroundColor Green
Write-Host "Starting monitor...`n" -ForegroundColor Green

# Get the script directory to find monitor script
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$monitorScript = Join-Path $scriptDir "monitor-push.ps1"

# Start monitoring
& $monitorScript -BranchName $BranchName -RemoteName $RemoteName -MaxWaitSeconds $MaxWaitSeconds -CheckInterval $CheckInterval

# Clean up job
Remove-Job $pushJob -Force -ErrorAction SilentlyContinue
