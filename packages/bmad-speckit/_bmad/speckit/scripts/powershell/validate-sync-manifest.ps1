<#
.SYNOPSIS
  双 repo 同步清单校验脚本（与 双repo_bmad_speckit_智能同步方案.md §7.1 一致）。
  读取 sync-manifest，对每条路径在两边计算 SHA256 checksum，输出一致/不一致列表。

.PARAMETER ManifestPath
   sync-manifest.yaml 路径（或相对当前目录）

.PARAMETER RepoA
  Repo A 根路径（如 your-project）

.PARAMETER RepoB
  Repo B 根路径（如 BMAD-Speckit-SDD-Flow）

.EXAMPLE
  & ".\_bmad\scripts\bmad-speckit\powershell\validate-sync-manifest.ps1" -ManifestPath ".\sync-manifest.yaml" -RepoA "D:\path\to\your-project" -RepoB "D:\path\to\BMAD-Speckit-SDD-Flow"
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string] $ManifestPath,
    [Parameter(Mandatory = $true)]
    [string] $RepoA,
    [Parameter(Mandatory = $true)]
    [string] $RepoB
)

$ErrorActionPreference = 'Stop'
$ManifestPath = $PSCmdlet.GetUnresolvedProviderPathFromPSPath($ManifestPath)
$RepoA = $PSCmdlet.GetUnresolvedProviderPathFromPSPath($RepoA)
$RepoB = $PSCmdlet.GetUnresolvedProviderPathFromPSPath($RepoB)

if (-not (Test-Path -LiteralPath $ManifestPath -PathType Leaf)) {
    Write-Error "Manifest not found: $ManifestPath"
    exit 2
}
if (-not (Test-Path -LiteralPath $RepoA -PathType Container)) {
    Write-Error "RepoA not a directory: $RepoA"
    exit 2
}
if (-not (Test-Path -LiteralPath $RepoB -PathType Container)) {
    Write-Error "RepoB not a directory: $RepoB"
    exit 2
}

# 简单解析 YAML：paths: 下 - path_a: "x" path_b: "y"
$content = Get-Content -LiteralPath $ManifestPath -Raw -Encoding UTF8
$pairs = @()
$block = $null
foreach ($line in ($content -split "`r?`n")) {
    $t = $line.Trim()
    if (-not $t -or $t.StartsWith('#')) { continue }
    if ($t -eq 'paths:') { continue }
    if ($t.StartsWith('- ')) {
        if ($block -and $block.path_a -ne $null -and $block.path_b -ne $null) {
            $pairs += $block
        }
        $block = @{ path_a = ''; path_b = '' }
        if ($t -match 'path_a:\s*["'']?([^"''\s]+)["'']?') { $block.path_a = $Matches[1].Trim('"''') }
        if ($t -match 'path_b:\s*["'']?([^"''\s]+)["'']?') { $block.path_b = $Matches[1].Trim('"''') }
        continue
    }
    if ($block -ne $null) {
        if ($line -match 'path_a:\s*(.+)') { $block.path_a = ($Matches[1].Trim() -replace '^["'']|["'']$', '').Trim() }
        if ($line -match 'path_b:\s*(.+)') { $block.path_b = ($Matches[1].Trim() -replace '^["'']|["'']$', '').Trim() }
    }
}
if ($block -and ($block.path_a -or $block.path_b)) {
    $pairs += $block
}

if ($pairs.Count -eq 0) {
    Write-Warning "No paths in manifest (or YAML format not recognized). Expected: paths: - path_a: `"_bmad/`" path_b: `"_bmad/`""
    exit 2
}

function Get-FileSha256 {
    param([string]$FilePath)
    $bytes = [System.IO.File]::ReadAllBytes($FilePath)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    [BitConverter]::ToString($sha.ComputeHash($bytes)).Replace('-', '').ToLowerInvariant()
}

function Get-FilesUnderDir {
    param([string]$DirRoot)
    if (-not (Test-Path -LiteralPath $DirRoot -PathType Container)) { return @() }
    Get-ChildItem -LiteralPath $DirRoot -Recurse -File | ForEach-Object {
        $_.FullName.Substring($DirRoot.Length).TrimStart('\', '/')
    } | Sort-Object
}

$allResults = @()
foreach ($p in $pairs) {
    $pathA = $p.path_a.Trim()
    $pathB = $p.path_b.Trim()
    $fullA = Join-Path $RepoA $pathA
    $fullB = Join-Path $RepoB $pathB

    $isFileA = Test-Path -LiteralPath $fullA -PathType Leaf
    $isFileB = Test-Path -LiteralPath $fullB -PathType Leaf
    $isDirA = Test-Path -LiteralPath $fullA -PathType Container
    $isDirB = Test-Path -LiteralPath $fullB -PathType Container

    if ($isFileA -and $isFileB) {
        $ha = Get-FileSha256 $fullA
        $hb = Get-FileSha256 $fullB
        if ($ha -eq $hb) {
            $allResults += @{ rel = $pathA; status = 'OK'; detail = 'checksum match' }
        } else {
            $allResults += @{ rel = $pathA; status = 'MISMATCH'; detail = "checksum A=$($ha.Substring(0, [Math]::Min(16, $ha.Length)))... B=$($hb.Substring(0, [Math]::Min(16, $hb.Length)))..." }
        }
        continue
    }
    if ($isFileA -and -not (Test-Path -LiteralPath $fullB)) {
        $allResults += @{ rel = $pathA; status = 'MISSING_B'; detail = $fullB }
        continue
    }
    if ($isFileB -and -not (Test-Path -LiteralPath $fullA)) {
        $allResults += @{ rel = $pathB; status = 'MISSING_A'; detail = $fullA }
        continue
    }
    if (-not (Test-Path -LiteralPath $fullA) -and -not (Test-Path -LiteralPath $fullB)) {
        $allResults += @{ rel = $pathA; status = 'MISSING_BOTH'; detail = "A=$fullA B=$fullB" }
        continue
    }
    if ($isFileA -or $isFileB) {
        $allResults += @{ rel = $pathA; status = 'MISMATCH'; detail = 'one is file, other is dir or missing' }
        continue
    }

    # 两边均为目录
    $filesA = @(Get-FilesUnderDir $fullA)
    $filesB = @(Get-FilesUnderDir $fullB)
    $allRel = ($filesA + $filesB) | Sort-Object -Unique
    foreach ($rel in $allRel) {
        $fa = Join-Path $fullA $rel
        $fb = Join-Path $fullB $rel
        $relNorm = $rel -replace '\\', '/'
        if ((Test-Path -LiteralPath $fa -PathType Leaf) -and (Test-Path -LiteralPath $fb -PathType Leaf)) {
            $ha = Get-FileSha256 $fa
            $hb = Get-FileSha256 $fb
            if ($ha -eq $hb) {
                $allResults += @{ rel = $relNorm; status = 'OK'; detail = 'match' }
            } else {
                $allResults += @{ rel = $relNorm; status = 'MISMATCH'; detail = "A=$($ha.Substring(0, [Math]::Min(12, $ha.Length)))... B=$($hb.Substring(0, [Math]::Min(12, $hb.Length)))..." }
            }
        } elseif (Test-Path -LiteralPath $fa -PathType Leaf) {
            $allResults += @{ rel = $relNorm; status = 'MISSING_B'; detail = $fb }
        } elseif (Test-Path -LiteralPath $fb -PathType Leaf) {
            $allResults += @{ rel = $relNorm; status = 'MISSING_A'; detail = $fa }
        }
    }
}

$ok = ($allResults | Where-Object { $_.status -eq 'OK' }).Count
$mismatch = ($allResults | Where-Object { $_.status -eq 'MISMATCH' }).Count
$missing = ($allResults | Where-Object { $_.status -like 'MISSING*' }).Count

foreach ($r in $allResults) {
    if ($r.status -eq 'OK') {
        Write-Host "  OK   $($r.rel)"
    } else {
        Write-Host "  $($r.status.PadRight(12)) $($r.rel)  ($($r.detail))"
    }
}
Write-Host ""
Write-Host "Summary: OK=$ok  MISMATCH=$mismatch  MISSING=$missing  total=$($allResults.Count)"
if ($mismatch -gt 0 -or $missing -gt 0) {
    Write-Host "Result: 清单内项存在不一致，请检查上述输出。"
    exit 1
}
Write-Host "Result: 清单内项一致。"
exit 0
