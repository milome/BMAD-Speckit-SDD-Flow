param(
  [string]$TargetDir = ".",
  [string]$ServerName = "bmad-runtime"
)

$ErrorActionPreference = 'Stop'
$targetRoot = (Resolve-Path $TargetDir).Path
$entryPath = Join-Path $targetRoot ".codex\mcp\$ServerName\server\dist\index.js"
$configPath = Join-Path $targetRoot '.mcp.json'

if (-not (Test-Path $entryPath)) { throw "Missing server entry: $entryPath" }
if (-not (Test-Path $configPath)) { throw "Missing MCP config: $configPath" }

Push-Location $targetRoot
try {
  node $entryPath --smoke
} finally {
  Pop-Location
}
