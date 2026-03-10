#!/usr/bin/env pwsh
# Find related design documents for a feature
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$FeatureDescription,
    
    [Parameter(Mandatory = $true)]
    [string]$ShortName,
    
    [switch]$Json,
    
    [string]$RepoRoot
)

$ErrorActionPreference = 'Stop'

# Resolve repository root
if (-not $RepoRoot) {
    $RepoRoot = git rev-parse --show-toplevel 2>$null
    if ($LASTEXITCODE -ne 0) {
        # Fallback: search for .git or .specify
        $current = $PSScriptRoot
        while ($true) {
            if (Test-Path (Join-Path $current '.git') -or Test-Path (Join-Path $current '.specify')) {
                $RepoRoot = $current
                break
            }
            $parent = Split-Path $current -Parent
            if ($parent -eq $current) {
                Write-Error "Could not determine repository root"
                exit 1
            }
            $current = $parent
        }
    }
}

# Extract keywords from feature description
function Get-Keywords {
    param([string]$Text)
    
    # Remove common stop words
    $stopWords = @('的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这',
                   'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'can', 'may', 'might', 'must')
    
    # Convert to lowercase and split into words
    $words = $Text.ToLower() -split '[^\w\u4e00-\u9fa5]+' | Where-Object { $_ -and $_.Length -ge 2 }
    
    # Filter stop words
    $keywords = $words | Where-Object { $stopWords -notcontains $_ }
    
    return $keywords
}

# Calculate relevance score for a document
function Get-DocumentRelevance {
    param(
        [string]$FilePath,
        [string[]]$Keywords,
        [string]$ShortName
    )
    
    $score = 0
    $fileName = [System.IO.Path]::GetFileNameWithoutExtension($FilePath)
    $fileNameLower = $fileName.ToLower()
    
    # Read file content (first 5000 chars for performance)
    try {
        $content = Get-Content -Path $FilePath -TotalCount 100 -ErrorAction SilentlyContinue | Out-String
        $contentLower = $content.ToLower()
    } catch {
        return 0
    }
    
    # Check filename match
    foreach ($keyword in $Keywords) {
        if ($fileNameLower -match [regex]::Escape($keyword)) {
            $score += 10
        }
        if ($contentLower -match [regex]::Escape($keyword)) {
            $score += 5
        }
    }
    
    # Check short name match
    if ($fileNameLower -match [regex]::Escape($ShortName)) {
        $score += 20
    }
    
    # Check for design document indicators
    $designIndicators = @('设计', 'design', '分析', 'analysis', '方案', 'solution', '架构', 'architecture', 'poc', 'proposal')
    foreach ($indicator in $designIndicators) {
        if ($fileNameLower -match [regex]::Escape($indicator)) {
            $score += 15
        }
    }
    
    return $score
}

# Search directories for related documents
function Find-RelatedDocuments {
    param(
        [string]$RootPath,
        [string[]]$Keywords,
        [string]$ShortName
    )
    
    $results = @()
    
    # Search locations
    $searchPaths = @(
        (Join-Path $RootPath 'specs\000-Overview\*.md'),
        (Join-Path $RootPath 'specs\TBD - *\*.md'),
        (Join-Path $RootPath 'poc\*\*.md'),
        (Join-Path $RootPath 'docs\*.md')
    )
    
    foreach ($pattern in $searchPaths) {
        try {
            $files = Get-ChildItem -Path $pattern -ErrorAction SilentlyContinue
            foreach ($file in $files) {
                $relevance = Get-DocumentRelevance -FilePath $file.FullName -Keywords $Keywords -ShortName $ShortName
                if ($relevance -gt 0) {
                    $results += [PSCustomObject]@{
                        Path = $file.FullName
                        Name = $file.Name
                        Relevance = $relevance
                        RelativePath = $file.FullName.Replace($RootPath, '').TrimStart('\', '/')
                    }
                }
            }
        } catch {
            # Ignore errors for non-existent paths
        }
    }
    
    # Sort by relevance and return top 10
    return $results | Sort-Object -Property Relevance -Descending | Select-Object -First 10
}

# Main execution
$keywords = Get-Keywords -Text $FeatureDescription
$documents = Find-RelatedDocuments -RootPath $RepoRoot -Keywords $keywords -ShortName $ShortName

if ($Json) {
    $output = @{
        Documents = $documents | ForEach-Object {
            @{
                Path = $_.Path
                Name = $_.Name
                Relevance = $_.Relevance
                RelativePath = $_.RelativePath
            }
        }
        Keywords = $keywords
    }
    $output | ConvertTo-Json -Depth 10
} else {
    Write-Output "Found $($documents.Count) related documents:"
    foreach ($doc in $documents) {
        Write-Output "  [$($doc.Relevance)] $($doc.RelativePath)"
    }
}
