#!/usr/bin/env pwsh
# Create a new feature
[CmdletBinding()]
param(
    [switch]$Json,
    [string]$ShortName,
    [int]$Number = 0,
    [switch]$Help,
    [switch]$ModeBmad,
    [int]$Epic = 0,
    [int]$Story = 0,
    [string]$Slug = "",
    [switch]$CreateBranch,
    [switch]$CreateWorktree,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$FeatureDescription
)
$ErrorActionPreference = 'Stop'

# Show help if requested
if ($Help) {
    Write-Host "Usage: ./create-new-feature.ps1 [-Json] [-ShortName <name>] [-Number N] <feature description>"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -Json               Output in JSON format"
    Write-Host "  -ShortName <name>   Provide a custom short name (2-4 words) for the branch"
    Write-Host "  -Number N           Specify branch number manually (overrides auto-detection)"
    Write-Host "  -Help               Show this help message"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  ./create-new-feature.ps1 'Add user authentication system' -ShortName 'user-auth'"
    Write-Host "  ./create-new-feature.ps1 'Implement OAuth2 integration for API'"
    Write-Host ""
    Write-Host "  -ModeBmad          BMAD mode: create specs/epic-N[-slug]/story-N-{slug}/ (epic slug derived from _bmad-output/config or epics.md)"
    Write-Host "  -Epic N            Epic number (required when -ModeBmad)"
    Write-Host "  -Story N           Story number (required when -ModeBmad)"
    Write-Host "  -Slug <name>       Story slug for directory name (optional; derived from epics.md or _bmad-output/config when not passed)"
    Write-Host "  -CreateBranch      Create git branch (BMAD: default off; standalone: default on)"
    Write-Host "  -CreateWorktree   Create worktree via setup_worktree.ps1 (BMAD: default off)"
    Write-Host ""
    Write-Host "BMAD example:"
    Write-Host "  ./create-new-feature.ps1 -ModeBmad -Epic 4 -Story 1 -Slug implement-base-cache"
    Write-Host ""
    Write-Host "Solo quick iteration (no new branch/worktree):"
    Write-Host "  ./create-new-feature.ps1 -ModeBmad -Epic 4 -Story 1 -Slug my-story"
    Write-Host ""
    Write-Host "Full isolation (branch + worktree):"
    Write-Host "  ./create-new-feature.ps1 -ModeBmad -Epic 4 -Story 1 -Slug my-story -CreateBranch -CreateWorktree"
    exit 0
}

# Check if feature description provided (not required when -ModeBmad)
if (-not $ModeBmad -and (-not $FeatureDescription -or $FeatureDescription.Count -eq 0)) {
    Write-Error "Usage: ./create-new-feature.ps1 [-Json] [-ShortName <name>] <feature description>"
    exit 1
}

$featureDesc = ($FeatureDescription -join ' ').Trim()

# Resolve repository root. Prefer git information when available, but fall back
# to searching for repository markers so the workflow still functions in repositories that
# were initialized with --no-git.
function Find-RepositoryRoot {
    param(
        [string]$StartDir,
        [string[]]$Markers = @('.git', '.specify')
    )
    $current = Resolve-Path $StartDir
    while ($true) {
        foreach ($marker in $Markers) {
            if (Test-Path (Join-Path $current $marker)) {
                return $current
            }
        }
        $parent = Split-Path $current -Parent
        if ($parent -eq $current) {
            # Reached filesystem root without finding markers
            return $null
        }
        $current = $parent
    }
}

function Get-HighestNumberFromSpecs {
    param([string]$SpecsDir)
    
    $highest = 0
    if (Test-Path $SpecsDir) {
        Get-ChildItem -Path $SpecsDir -Directory | ForEach-Object {
            if ($_.Name -match '^(\d+)') {
                $num = [int]$matches[1]
                if ($num -gt $highest) { $highest = $num }
            }
        }
    }
    return $highest
}

function Get-HighestNumberFromBranches {
    param()
    
    $highest = 0
    try {
        $branches = git branch -a 2>$null
        if ($LASTEXITCODE -eq 0) {
            foreach ($branch in $branches) {
                # Clean branch name: remove leading markers and remote prefixes
                $cleanBranch = $branch.Trim() -replace '^\*?\s+', '' -replace '^remotes/[^/]+/', ''
                
                # Extract feature number if branch matches pattern ###-*
                if ($cleanBranch -match '^(\d+)-') {
                    $num = [int]$matches[1]
                    if ($num -gt $highest) { $highest = $num }
                }
            }
        }
    } catch {
        # If git command fails, return 0
        Write-Verbose "Could not check Git branches: $_"
    }
    return $highest
}

function Get-NextBranchNumber {
    param(
        [string]$ShortName,
        [string]$SpecsDir
    )
    
    # Fetch all remotes to get latest branch info (suppress errors if no remotes)
    try {
        git fetch --all --prune 2>$null | Out-Null
    } catch {
        # Ignore fetch errors
    }
    
    # Find remote branches matching the pattern using git ls-remote
    $remoteBranches = @()
    try {
        $remoteRefs = git ls-remote --heads origin 2>$null
        if ($remoteRefs) {
            $remoteBranches = $remoteRefs | Where-Object { $_ -match "refs/heads/(\d+)-$([regex]::Escape($ShortName))$" } | ForEach-Object {
                if ($_ -match "refs/heads/(\d+)-") {
                    [int]$matches[1]
                }
            }
        }
    } catch {
        # Ignore errors
    }
    
    # Check local branches
    $localBranches = @()
    try {
        $allBranches = git branch 2>$null
        if ($allBranches) {
            $localBranches = $allBranches | Where-Object { $_ -match "^\*?\s*(\d+)-$([regex]::Escape($ShortName))$" } | ForEach-Object {
                if ($_ -match "(\d+)-") {
                    [int]$matches[1]
                }
            }
        }
    } catch {
        # Ignore errors
    }
    
    # Check specs directory
    $specDirs = @()
    if (Test-Path $SpecsDir) {
        try {
            $specDirs = Get-ChildItem -Path $SpecsDir -Directory | Where-Object { $_.Name -match "^(\d+)-$([regex]::Escape($ShortName))$" } | ForEach-Object {
                if ($_.Name -match "^(\d+)-") {
                    [int]$matches[1]
                }
            }
        } catch {
            # Ignore errors
        }
    }
    
    # Combine all sources and get the highest number
    $maxNum = 0
    foreach ($num in ($remoteBranches + $localBranches + $specDirs)) {
        if ($num -gt $maxNum) {
            $maxNum = $num
        }
    }
    
    # Return next number
    return $maxNum + 1
}

function ConvertTo-CleanBranchName {
    param([string]$Name)
    
    return $Name.ToLower() -replace '[^a-z0-9]', '-' -replace '-{2,}', '-' -replace '^-', '' -replace '-$', ''
}

# BMAD: derive epic_slug from _bmad-output/config or epics.md (no new param; default behavior)
function Get-EpicSlugOrDefault {
    param(
        [string]$RepoRoot,
        [int]$EpicNum,
        [bool]$HasGit
    )
    $slug = $null
    # 1) _bmad-output/config/epic-{N}.json: slug or name
    $configPath = Join-Path (Join-Path (Join-Path $RepoRoot "_bmad-output") "config") "epic-$EpicNum.json"
    if (Test-Path $configPath) {
        try {
            $json = Get-Content -Path $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
            $raw = if ($json.PSObject.Properties['slug']) { $json.slug } elseif ($json.PSObject.Properties['name']) { $json.name } else { $null }
            if (-not [string]::IsNullOrWhiteSpace($raw)) {
                $slug = ConvertTo-CleanBranchName $raw
            }
        } catch {
            # Ignore parse errors
        }
    }
    # 2) _bmad-output/planning-artifacts/{branch}/epics.md: ## Epic N: Title
    if ([string]::IsNullOrWhiteSpace($slug) -and $HasGit) {
        try {
            $branch = git rev-parse --abbrev-ref HEAD 2>$null
            if ($LASTEXITCODE -eq 0 -and $branch -and $branch -ne "HEAD") {
                $branchSafe = $branch -replace '/', '-'
                $epicsPath = Join-Path (Join-Path $RepoRoot "_bmad-output") (Join-Path "planning-artifacts" (Join-Path $branchSafe "epics.md"))
                if (Test-Path $epicsPath) {
                    $line = Get-Content -Path $epicsPath -Encoding UTF8 | Where-Object { $_ -match "^\s*#{2,3}\s+Epic\s+$EpicNum\s*[:\uff1a]\s*(.+)$" } | Select-Object -First 1
                    if ($line -match "[:\uff1a]\s*(.+)$") {
                        $title = $matches[1].Trim()
                        if (-not [string]::IsNullOrWhiteSpace($title)) {
                            $slug = ConvertTo-CleanBranchName $title
                        }
                    }
                }
            }
        } catch {
            # Ignore
        }
    }
    return $slug
}

# BMAD: derive story_slug from _bmad-output/config or epics.md when -Slug not passed (default behavior)
function Get-StorySlugOrDefault {
    param(
        [string]$RepoRoot,
        [int]$EpicNum,
        [int]$StoryNum,
        [bool]$HasGit
    )
    $slug = $null
    # 1) _bmad-output/config/epic-{N}.json: stories[].slug or stories[].title for matching story index
    $configPath = Join-Path (Join-Path (Join-Path $RepoRoot "_bmad-output") "config") "epic-$EpicNum.json"
    if (Test-Path $configPath) {
        try {
            $json = Get-Content -Path $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
            $stories = $json.PSObject.Properties['stories'].Value
            if ($stories -is [Array] -and $StoryNum -ge 1 -and $StoryNum -le $stories.Count) {
                $s = $stories[$StoryNum - 1]
                if ($s -is [PSCustomObject]) {
                    $raw = if ($s.PSObject.Properties['slug']) { $s.slug } elseif ($s.PSObject.Properties['title']) { $s.title } else { $null }
                    if (-not [string]::IsNullOrWhiteSpace($raw)) {
                        $slug = ConvertTo-CleanBranchName $raw
                    }
                }
            }
        } catch {
            # Ignore parse errors
        }
    }
    # 2) _bmad-output/planning-artifacts/{branch}/epics.md: ### Story N.M: Title
    if ([string]::IsNullOrWhiteSpace($slug) -and $HasGit) {
        try {
            $branch = git rev-parse --abbrev-ref HEAD 2>$null
            if ($LASTEXITCODE -eq 0 -and $branch -and $branch -ne "HEAD") {
                $branchSafe = $branch -replace '/', '-'
                $epicsPath = Join-Path (Join-Path $RepoRoot "_bmad-output") (Join-Path "planning-artifacts" (Join-Path $branchSafe "epics.md"))
                if (Test-Path $epicsPath) {
                    $pattern = "^\s*###\s+Story\s+$EpicNum\.$StoryNum\s*:\s*(.+)$"
                    $line = Get-Content -Path $epicsPath -Encoding UTF8 | Where-Object { $_ -match $pattern } | Select-Object -First 1
                    if ($line -match ":\s*(.+)$") {
                        $title = $matches[1].Trim()
                        if (-not [string]::IsNullOrWhiteSpace($title)) {
                            $slug = ConvertTo-CleanBranchName $title
                        }
                    }
                }
            }
        } catch {
            # Ignore
        }
    }
    if (-not [string]::IsNullOrWhiteSpace($slug)) { return $slug }
    return "E$EpicNum-S$StoryNum"
}

# BMAD: resolve epic directory name (reuse existing or use epic-{N}[-{slug}])
function Get-EpicDirName {
    param(
        [string]$SpecsDir,
        [int]$EpicNum,
        [string]$DerivedSlug
    )
    $exact = "epic-$EpicNum"
    $withSlug = if ($DerivedSlug) { "epic-$EpicNum-$DerivedSlug" } else { $null }
    # Prefer existing dir: exact epic-N, then any epic-N-*
    $existing = Get-ChildItem -Path $SpecsDir -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq $exact -or ($_.Name -match "^epic-$EpicNum-") }
    if ($existing) {
        return $existing[0].Name
    }
    if ($withSlug) { return $withSlug }
    return $exact
}

$fallbackRoot = (Find-RepositoryRoot -StartDir $PSScriptRoot)
if (-not $fallbackRoot) {
    Write-Error "Error: Could not determine repository root. Please run this script from within the repository."
    exit 1
}

try {
    $repoRoot = git rev-parse --show-toplevel 2>$null
    if ($LASTEXITCODE -eq 0) {
        $hasGit = $true
    } else {
        throw "Git not available"
    }
} catch {
    $repoRoot = $fallbackRoot
    $hasGit = $false
}

Set-Location $repoRoot

# Default CreateBranch/CreateWorktree: standalone CreateBranch=true; BMAD both false; no git both false
if (-not $hasGit) {
    $CreateBranch = $false
    $CreateWorktree = $false
} elseif ($ModeBmad) {
    if (-not $PSBoundParameters.ContainsKey('CreateBranch')) { $CreateBranch = $false }
    if (-not $PSBoundParameters.ContainsKey('CreateWorktree')) { $CreateWorktree = $false }
} else {
    if (-not $PSBoundParameters.ContainsKey('CreateBranch')) { $CreateBranch = $true }
}

$specsDir = Join-Path $repoRoot 'specs'
New-Item -ItemType Directory -Path $specsDir -Force | Out-Null

# BMAD mode: create specs/epic-{epic}[-{epic_slug}]/story-{story}-{slug}/ (epic_slug derived by default, no new param)
if ($ModeBmad) {
    if ($Epic -le 0 -or $Story -le 0) {
        Write-Error "BMAD mode requires -Epic N -Story N (N>=1)"
        exit 1
    }
    if ([string]::IsNullOrWhiteSpace($Slug)) {
        $Slug = Get-StorySlugOrDefault -RepoRoot $repoRoot -EpicNum $Epic -StoryNum $Story -HasGit $hasGit
    }
    $epicSlug = Get-EpicSlugOrDefault -RepoRoot $repoRoot -EpicNum $Epic -HasGit $hasGit
    $epicDirName = Get-EpicDirName -SpecsDir $specsDir -EpicNum $Epic -DerivedSlug $epicSlug
    $targetDir = Join-Path $specsDir $epicDirName
    $storyDirName = "story-$Story-$Slug"
    $fullPath = Join-Path $targetDir $storyDirName
    $branchName = "story-$Epic-$Story"
    $specFile = Join-Path $fullPath "spec-E$Epic-S$Story.md"
    if (-not (Test-Path $fullPath)) {
        New-Item -ItemType Directory -Path $fullPath -Force | Out-Null
        @("# Spec E$Epic-S$Story`n`n*Generated by create-new-feature.ps1 -ModeBmad*") | Set-Content -Path $specFile -Encoding UTF8
    }
    # Sync create _bmad-output subdir (two-level: epic-{N}-{slug}/story-{N}-{slug}/)
    $bmadOutputBase = Join-Path $repoRoot "_bmad-output"
    $implArtifacts = Join-Path $bmadOutputBase "implementation-artifacts"
    $epicArtifactsDir = Join-Path $implArtifacts $epicDirName  # reuse $epicDirName (with slug)
    $storySubdir = Join-Path $epicArtifactsDir $storyDirName
    if (-not (Test-Path $storySubdir)) {
        New-Item -ItemType Directory -Path $storySubdir -Force | Out-Null
        Write-Host "[create-new-feature] Created _bmad-output subdir: $storySubdir"
    }
    # CreateBranch / CreateWorktree (BMAD mode)
    if ($hasGit) {
        $baseBranch = "dev"
        if ($CreateBranch) {
            try {
                $currentBranch = git rev-parse --abbrev-ref HEAD 2>$null
                $null = git rev-parse --verify $branchName 2>$null
                if ($LASTEXITCODE -ne 0) {
                    git checkout -b $branchName $baseBranch 2>$null
                    if ($LASTEXITCODE -eq 0) {
                        $restoreBranch = if ($currentBranch -and $currentBranch -ne "HEAD") { $currentBranch } else { $baseBranch }
                        git checkout $restoreBranch 2>$null
                    }
                }
            } catch {
                Write-Warning "Could not create branch $branchName for worktree"
            }
        }
        if ($CreateWorktree) {
            $wtBranch = if ($CreateBranch) { $branchName } else {
                $abbrev = git rev-parse --abbrev-ref HEAD 2>$null
                if ($LASTEXITCODE -eq 0 -and $abbrev -and $abbrev -ne "HEAD") {
                    $abbrev -replace '/', '-'
                } else {
                    $shortSha = git rev-parse --short HEAD 2>$null
                    "detached-$shortSha"
                }
            }
            $setupScript = Join-Path $PSScriptRoot "setup_worktree.ps1"
            if (Test-Path $setupScript) {
                & $setupScript create $wtBranch
            } else {
                Write-Warning "setup_worktree.ps1 not found at $setupScript"
            }
        }
    }
    if ($Json) {
        [PSCustomObject]@{ BRANCH_NAME = $branchName; SPEC_FILE = $specFile; SPEC_DIR = $fullPath } | ConvertTo-Json -Compress
    } else {
        Write-Output "BRANCH_NAME: $branchName"
        Write-Output "SPEC_FILE: $specFile"
        Write-Output "SPEC_DIR: $fullPath"
    }
    exit 0
}

# Function to generate branch name with stop word filtering and length filtering
function Get-BranchName {
    param([string]$Description)
    
    # Common stop words to filter out
    $stopWords = @(
        'i', 'a', 'an', 'the', 'to', 'for', 'of', 'in', 'on', 'at', 'by', 'with', 'from',
        'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
        'do', 'does', 'did', 'will', 'would', 'should', 'could', 'can', 'may', 'might', 'must', 'shall',
        'this', 'that', 'these', 'those', 'my', 'your', 'our', 'their',
        'want', 'need', 'add', 'get', 'set'
    )
    
    # Convert to lowercase and extract words (alphanumeric only)
    $cleanName = $Description.ToLower() -replace '[^a-z0-9\s]', ' '
    $words = $cleanName -split '\s+' | Where-Object { $_ }
    
    # Filter words: remove stop words and words shorter than 3 chars (unless they're uppercase acronyms in original)
    $meaningfulWords = @()
    foreach ($word in $words) {
        # Skip stop words
        if ($stopWords -contains $word) { continue }
        
        # Keep words that are length >= 3 OR appear as uppercase in original (likely acronyms)
        if ($word.Length -ge 3) {
            $meaningfulWords += $word
        } elseif ($Description -match "\b$($word.ToUpper())\b") {
            # Keep short words if they appear as uppercase in original (likely acronyms)
            $meaningfulWords += $word
        }
    }
    
    # If we have meaningful words, use first 3-4 of them
    if ($meaningfulWords.Count -gt 0) {
        $maxWords = if ($meaningfulWords.Count -eq 4) { 4 } else { 3 }
        $result = ($meaningfulWords | Select-Object -First $maxWords) -join '-'
        return $result
    } else {
        # Fallback to original logic if no meaningful words found
        $result = ConvertTo-CleanBranchName -Name $Description
        $fallbackWords = ($result -split '-') | Where-Object { $_ } | Select-Object -First 3
        return [string]::Join('-', $fallbackWords)
    }
}

# Generate branch name
if ($ShortName) {
    # Use provided short name, just clean it up
    $branchSuffix = ConvertTo-CleanBranchName -Name $ShortName
} else {
    # Generate from description with smart filtering
    $branchSuffix = Get-BranchName -Description $featureDesc
}

# Determine branch number
if ($Number -eq 0) {
    if ($hasGit) {
        # Check existing branches on remotes
        $Number = Get-NextBranchNumber -ShortName $branchSuffix -SpecsDir $specsDir
    } else {
        # Fall back to local directory check
        $Number = (Get-HighestNumberFromSpecs -SpecsDir $specsDir) + 1
    }
}

$featureNum = ('{0:000}' -f $Number)
$branchName = "$featureNum-$branchSuffix"

# GitHub enforces a 244-byte limit on branch names
# Validate and truncate if necessary
$maxBranchLength = 244
if ($branchName.Length -gt $maxBranchLength) {
    # Calculate how much we need to trim from suffix
    # Account for: feature number (3) + hyphen (1) = 4 chars
    $maxSuffixLength = $maxBranchLength - 4
    
    # Truncate suffix
    $truncatedSuffix = $branchSuffix.Substring(0, [Math]::Min($branchSuffix.Length, $maxSuffixLength))
    # Remove trailing hyphen if truncation created one
    $truncatedSuffix = $truncatedSuffix -replace '-$', ''
    
    $originalBranchName = $branchName
    $branchName = "$featureNum-$truncatedSuffix"
    
    Write-Warning "[specify] Branch name exceeded GitHub's 244-byte limit"
    Write-Warning "[specify] Original: $originalBranchName ($($originalBranchName.Length) bytes)"
    Write-Warning "[specify] Truncated to: $branchName ($($branchName.Length) bytes)"
}

if ($hasGit -and $CreateBranch) {
    try {
        git checkout -b $branchName | Out-Null
    } catch {
        Write-Warning "Failed to create git branch: $branchName"
    }
} elseif ($hasGit -and -not $CreateBranch) {
    Write-Host "[create-new-feature] Skipped branch creation (use -CreateBranch to create). Branch name would be: $branchName"
} else {
    Write-Warning "[specify] Warning: Git repository not detected; skipped branch creation for $branchName"
}

$featureDir = Join-Path $specsDir $branchName
New-Item -ItemType Directory -Path $featureDir -Force | Out-Null

$template = Join-Path $repoRoot '.specify/templates/spec-template.md'
$specFile = Join-Path $featureDir 'spec.md'
if (Test-Path $template) { 
    Copy-Item $template $specFile -Force 
} else { 
    New-Item -ItemType File -Path $specFile | Out-Null 
}

# Set the SPECIFY_FEATURE environment variable for the current session
$env:SPECIFY_FEATURE = $branchName

if ($Json) {
    $obj = [PSCustomObject]@{ 
        BRANCH_NAME = $branchName
        SPEC_FILE = $specFile
        FEATURE_NUM = $featureNum
        HAS_GIT = $hasGit
    }
    $obj | ConvertTo-Json -Compress
} else {
    Write-Output "BRANCH_NAME: $branchName"
    Write-Output "SPEC_FILE: $specFile"
    Write-Output "FEATURE_NUM: $featureNum"
    Write-Output "HAS_GIT: $hasGit"
    Write-Output "SPECIFY_FEATURE environment variable set to: $branchName"
}

