<#
.SYNOPSIS
    Generate PR Template from Git Commits
.DESCRIPTION
    Analyzes commits since last PR and generates a detailed PR template.
    Outputs to docs/PR directory by default.
#>

param(
    [string]$BaseBranch = "dev",
    [string]$CurrentBranch = "",
    [string]$OutputDir = "docs/PR",
    [string]$LastPRCommit = "",
    [switch]$AutoDetectLastPR
)

# Force UTF-8 encoding for console and file output
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
$env:LANG = "en_US.UTF-8"

# Auto-detect current branch if not provided
if ([string]::IsNullOrEmpty($CurrentBranch)) {
    $CurrentBranch = git rev-parse --abbrev-ref HEAD 2>$null
    if (-not $CurrentBranch) {
        Write-Host "ERROR: Could not detect current branch. Please specify -CurrentBranch" -ForegroundColor Red
        exit 1
    }
    Write-Host "Auto-detected branch: $CurrentBranch" -ForegroundColor Cyan
}

# Auto-detect last PR commit if requested
if ($AutoDetectLastPR -or [string]::IsNullOrEmpty($LastPRCommit)) {
    Write-Host "Detecting last PR merge commit..." -ForegroundColor Cyan
    
    $mergeCommits = git log --merges --oneline "$BaseBranch..HEAD" 2>$null | Select-Object -First 1
    
    if ($mergeCommits) {
        $LastPRCommit = ($mergeCommits -split '\s+')[0]
        Write-Host "Found merge commit: $LastPRCommit" -ForegroundColor Green
    } else {
        $mergeBase = git merge-base $BaseBranch HEAD 2>$null
        if ($mergeBase) {
            $LastPRCommit = $mergeBase
            Write-Host "Using merge base: $LastPRCommit" -ForegroundColor Yellow
        } else {
            Write-Host "WARNING: Could not find last PR commit. Using base branch: $BaseBranch" -ForegroundColor Yellow
            $LastPRCommit = $BaseBranch
        }
    }
}

Write-Host ""
Write-Host "=== PR Template Generator ===" -ForegroundColor Cyan
Write-Host "Base Branch: $BaseBranch" -ForegroundColor Cyan
Write-Host "Current Branch: $CurrentBranch" -ForegroundColor Cyan
Write-Host "Last PR Commit: $LastPRCommit" -ForegroundColor Cyan
Write-Host "Output Directory: $OutputDir" -ForegroundColor Cyan
Write-Host ""

# Get commit range
$commitRange = if ($LastPRCommit -eq $BaseBranch) { 
    "$BaseBranch..HEAD" 
} else { 
    "$LastPRCommit..HEAD" 
}

# Get commits with proper encoding
$commits = git -c core.quotepath=false log $commitRange --pretty=format:"%H|%s|%an|%ad" --date=short 2>$null
if (-not $commits) {
    Write-Host "ERROR: No commits found in range $commitRange" -ForegroundColor Red
    exit 1
}

$commitArray = $commits -split "`n" | Where-Object { $_.Trim() }
$commitCount = $commitArray.Count
Write-Host "Found $commitCount commits" -ForegroundColor Green

# Get file statistics
$fileStats = git -c core.quotepath=false diff --stat $commitRange 2>$null

# Get changed files count
$changedFiles = git -c core.quotepath=false diff --name-only $commitRange 2>$null
$changedFilesArray = $changedFiles -split "`n" | Where-Object { $_.Trim() }
$changedFilesCount = $changedFilesArray.Count

# Get latest commit info
$latestHash = git rev-parse --short HEAD
$latestMessage = git -c core.quotepath=false log -1 --pretty=format:"%s" HEAD

# Analyze commits by type
$featCommitsRaw = git -c core.quotepath=false log $commitRange --pretty=format:"%H|%s" --grep="^feat" 2>$null
$fixCommitsRaw = git -c core.quotepath=false log $commitRange --pretty=format:"%H|%s" --grep="^fix" 2>$null
$docsCommitsRaw = git -c core.quotepath=false log $commitRange --pretty=format:"%H|%s" --grep="^docs" 2>$null

# Build categorized lists
$features = @()
$improvements = @()
$bugfixes = @()
$documentation = @()
$existingHashes = @{}

# Helper function to parse commits
function Parse-Commits($raw, [ref]$list, [ref]$hashes) {
    if ($raw) {
        foreach ($commit in ($raw -split "`n")) {
            if ($commit.Trim()) {
                $parts = $commit -split '\|', 2
                $hash = $parts[0].Substring(0, 9)
                if (-not $hashes.Value.ContainsKey($hash)) {
                    $message = $parts[1]
                    $list.Value += [PSCustomObject]@{Hash=$hash; Message=$message}
                    $hashes.Value[$hash] = $true
                }
            }
        }
    }
}

Parse-Commits $featCommitsRaw ([ref]$features) ([ref]$existingHashes)
Parse-Commits $fixCommitsRaw ([ref]$bugfixes) ([ref]$existingHashes)
Parse-Commits $docsCommitsRaw ([ref]$documentation) ([ref]$existingHashes)

# Find Chinese commits (broader search)
foreach ($commit in $commitArray) {
    $parts = $commit -split '\|'
    $hash = $parts[0].Substring(0, 9)
    $message = $parts[1]
    
    if (-not $existingHashes.ContainsKey($hash)) {
        # Check for Chinese keywords
        if ($message -match "实现" -and $message -notmatch "修复") {
            $features += [PSCustomObject]@{Hash=$hash; Message=$message}
            $existingHashes[$hash] = $true
        }
        elseif ($message -match "修复|BUGFIX|Bug修复") {
            $bugfixes += [PSCustomObject]@{Hash=$hash; Message=$message}
            $existingHashes[$hash] = $true
        }
        elseif ($message -match "优化|改进|增强") {
            $improvements += [PSCustomObject]@{Hash=$hash; Message=$message}
            $existingHashes[$hash] = $true
        }
    }
}

# Find new documentation files
$newDocs = git -c core.quotepath=false diff --name-only --diff-filter=A $commitRange 2>$null | 
    Where-Object { $_ -match '\.(md|rst)$' }
$newDocsArray = if ($newDocs) { $newDocs -split "`n" | Where-Object { $_.Trim() } } else { @() }

# Build PR content using StringBuilder for proper encoding
$sb = [System.Text.StringBuilder]::new()

# Header
[void]$sb.AppendLine("# PR: $CurrentBranch 分支功能总结")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("## 概览")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("| 项目 | 内容 |")
[void]$sb.AppendLine("|------|------|")
[void]$sb.AppendLine("| **分支名称** | ``$CurrentBranch`` |")
[void]$sb.AppendLine("| **目标分支** | ``$BaseBranch`` |")
[void]$sb.AppendLine("| **起始提交** | ``$LastPRCommit`` |")
[void]$sb.AppendLine("| **最新提交** | ``$latestHash`` - ``$latestMessage`` |")
[void]$sb.AppendLine("| **待合并提交数** | $commitCount 个 |")
[void]$sb.AppendLine("| **状态** | 开发完成，待合并到 $BaseBranch |")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("---")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("## 主要改进总结")
[void]$sb.AppendLine("")

# Features
if ($features.Count -gt 0) {
    [void]$sb.AppendLine("### 功能新增 (New Features)")
    [void]$sb.AppendLine("")
    foreach ($item in $features) {
        [void]$sb.AppendLine("- **$($item.Hash)**: $($item.Message)")
    }
    [void]$sb.AppendLine("")
}

# Improvements
if ($improvements.Count -gt 0) {
    [void]$sb.AppendLine("### 功能改进 (Improvements)")
    [void]$sb.AppendLine("")
    foreach ($item in $improvements) {
        [void]$sb.AppendLine("- **$($item.Hash)**: $($item.Message)")
    }
    [void]$sb.AppendLine("")
}

# Bugfixes
if ($bugfixes.Count -gt 0) {
    [void]$sb.AppendLine("### Bug 修复 (Bug Fixes)")
    [void]$sb.AppendLine("")
    foreach ($item in $bugfixes) {
        [void]$sb.AppendLine("- **$($item.Hash)**: $($item.Message)")
    }
    [void]$sb.AppendLine("")
}

# Documentation
if ($documentation.Count -gt 0) {
    [void]$sb.AppendLine("### 文档更新 (Documentation)")
    [void]$sb.AppendLine("")
    foreach ($item in $documentation) {
        [void]$sb.AppendLine("- **$($item.Hash)**: $($item.Message)")
    }
    [void]$sb.AppendLine("")
}

# Commit history table
[void]$sb.AppendLine("---")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("## 提交历史")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("| # | 提交 | 描述 | 作者 | 日期 |")
[void]$sb.AppendLine("|---|------|------|------|------|")

$commitNum = 1
foreach ($commit in $commitArray) {
    if ($commit.Trim()) {
        $parts = $commit -split '\|'
        $hash = $parts[0].Substring(0, 9)
        $message = $parts[1]
        $author = $parts[2]
        $date = $parts[3]
        [void]$sb.AppendLine("| $commitNum | ``$hash`` | $message | $author | $date |")
        $commitNum++
    }
}

# Change statistics
[void]$sb.AppendLine("")
[void]$sb.AppendLine("---")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("## 改动统计")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("**文件变更**: $changedFilesCount 个文件")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("**代码统计**:")
[void]$sb.AppendLine("``````")
[void]$sb.AppendLine($fileStats)
[void]$sb.AppendLine("``````")

# Documentation
[void]$sb.AppendLine("")
[void]$sb.AppendLine("---")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("## 相关文档")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("### 新增文档")
[void]$sb.AppendLine("")

if ($newDocsArray.Count -gt 0) {
    foreach ($doc in $newDocsArray) {
        if ($doc.Trim()) {
            [void]$sb.AppendLine("- ``$doc``")
        }
    }
} else {
    [void]$sb.AppendLine("- 无新增文档")
}

# Test checklist
[void]$sb.AppendLine("")
[void]$sb.AppendLine("---")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("## 测试验证")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("- [ ] 单元测试通过")
[void]$sb.AppendLine("- [ ] 功能测试通过")
[void]$sb.AppendLine("- [ ] 代码审查完成")

# Commit log
[void]$sb.AppendLine("")
[void]$sb.AppendLine("---")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("## 完整提交日志")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("``````")
$commitLog = git -c core.quotepath=false log $commitRange --oneline 2>$null
[void]$sb.AppendLine($commitLog)
[void]$sb.AppendLine("``````")

$prContent = $sb.ToString()

# Create output directory
$currentDir = Get-Location
$outputPath = if ([System.IO.Path]::IsPathRooted($OutputDir)) {
    $OutputDir
} else {
    Join-Path $currentDir $OutputDir
}

if (-not (Test-Path $outputPath)) {
    New-Item -ItemType Directory -Path $outputPath -Force | Out-Null
    Write-Host "Created output directory: $outputPath" -ForegroundColor Green
}

# Generate filename
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$filename = Join-Path $outputPath "PR_$($CurrentBranch)_$timestamp.md"

# Save file with UTF-8 encoding (no BOM)
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText($filename, $prContent, $utf8NoBom)

Write-Host ""
Write-Host "PR template generated: $filename" -ForegroundColor Green
Write-Host "Total commits analyzed: $commitCount" -ForegroundColor Green
Write-Host "Features: $($features.Count), Improvements: $($improvements.Count), Bugfixes: $($bugfixes.Count)" -ForegroundColor Cyan
