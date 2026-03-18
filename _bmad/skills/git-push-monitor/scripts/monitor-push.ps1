# Monitor Git Push Background Task Status
# Continuously check until push completes

param(
    [string]$OutputFile = "",
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
    Write-Host "Auto-detected branch: $BranchName" -ForegroundColor Cyan
}

# Auto-detect output file if not provided
if ([string]::IsNullOrEmpty($OutputFile)) {
    # Try to find the most recent terminal output file in Cursor's terminal directory
    $projectPath = (Get-Location).Path
    $projectName = Split-Path $projectPath -Leaf
    $terminalBasePath = "$env:USERPROFILE\.cursor\projects"
    
    # Try to find terminal output files
    $terminalFiles = Get-ChildItem -Path $terminalBasePath -Recurse -Filter "*.txt" -ErrorAction SilentlyContinue | 
        Where-Object { $_.LastWriteTime -gt (Get-Date).AddMinutes(-10) } |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    
    if ($terminalFiles) {
        $OutputFile = $terminalFiles.FullName
        Write-Host "Auto-detected output file: $OutputFile" -ForegroundColor Cyan
    }
}

Write-Host "=== Git Push Status Monitor ===" -ForegroundColor Cyan
Write-Host "Branch: $BranchName" -ForegroundColor Cyan
if ($OutputFile) {
    Write-Host "Output File: $OutputFile" -ForegroundColor Cyan
}
Write-Host "Max Wait: $MaxWaitSeconds seconds" -ForegroundColor Cyan
Write-Host "Check Interval: $CheckInterval seconds`n" -ForegroundColor Cyan

# Get initial state
$remoteBranch = "$RemoteName/$BranchName"
$initialRemoteCommit = git rev-parse $remoteBranch 2>$null
$localCommit = git rev-parse HEAD

Write-Host "Initial State:" -ForegroundColor Yellow
Write-Host "  Remote: $initialRemoteCommit" -ForegroundColor Gray
Write-Host "  Local:  $localCommit" -ForegroundColor Gray

# Early check: if already in sync, exit immediately
if ($initialRemoteCommit -and $localCommit -and $initialRemoteCommit -eq $localCommit) {
    Write-Host "`n✅ Local and remote are already in sync!" -ForegroundColor Green
    Write-Host "No push needed. Latest commits:" -ForegroundColor Cyan
    git log $remoteBranch --oneline -3
    exit 0
}

Write-Host "`nStarting monitor...`n" -ForegroundColor Green

$elapsed = 0
$lastOutputTime = 0

while ($elapsed -lt $MaxWaitSeconds) {
    Start-Sleep -Seconds $CheckInterval
    $elapsed += $CheckInterval
    
    # Check if remote branch updated
    $currentRemoteCommit = git rev-parse $remoteBranch 2>$null
    
    if ($currentRemoteCommit -and $currentRemoteCommit -ne $initialRemoteCommit) {
        Write-Host "`n*** PUSH SUCCESS! Remote branch updated ***" -ForegroundColor Green
        Write-Host "  Initial: $initialRemoteCommit" -ForegroundColor Gray
        Write-Host "  Current: $currentRemoteCommit" -ForegroundColor Green
        Write-Host "`nLatest 3 commits:" -ForegroundColor Cyan
        git log $remoteBranch --oneline -3
        Write-Host "`nMonitor complete!" -ForegroundColor Green
        exit 0
    }
    
    # Check output file if provided
    if ($OutputFile -and (Test-Path $OutputFile)) {
        $fileInfo = Get-Item $OutputFile
        $lastModified = $fileInfo.LastWriteTime
        
        # Show latest output if file was recently modified
        if (($lastModified -gt (Get-Date).AddSeconds(-30)) -or ($elapsed - $lastOutputTime) -gt 30) {
            $lastLines = Get-Content $OutputFile -Tail 10 -ErrorAction SilentlyContinue
            if ($lastLines) {
                Write-Host "`n[$elapsed sec] Latest output:" -ForegroundColor Cyan
                $lastLines | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
                $lastOutputTime = $elapsed
            }
        }
    }
    
    # Show status every 30 seconds
    if ($elapsed % 30 -eq 0) {
        Write-Host "[$elapsed sec] Checking... Remote: $currentRemoteCommit" -ForegroundColor Gray
    }
}

Write-Host "`nWARNING: Monitor timeout ($MaxWaitSeconds seconds)" -ForegroundColor Yellow
Write-Host "Please check push status manually:" -ForegroundColor Yellow
Write-Host "  git log $remoteBranch --oneline -5" -ForegroundColor Gray
Write-Host "  git log HEAD --oneline -5" -ForegroundColor Gray

# Final check
$finalRemoteCommit = git rev-parse $remoteBranch 2>$null
if ($finalRemoteCommit -and $finalRemoteCommit -ne $initialRemoteCommit) {
    Write-Host "`nSUCCESS: Push actually completed!" -ForegroundColor Green
    git log $remoteBranch --oneline -3
    exit 0
} else {
    Write-Host "`nERROR: Push may not have completed, please check" -ForegroundColor Red
    exit 1
}
