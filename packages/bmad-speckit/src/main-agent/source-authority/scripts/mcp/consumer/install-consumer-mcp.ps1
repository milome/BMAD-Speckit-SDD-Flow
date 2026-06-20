param(
  [string]$TargetDir = ".",
  [string]$ServerName = "bmad-runtime",
  [switch]$Force
)

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$targetRoot = (Resolve-Path $TargetDir).Path
$templatesSrcRoot = Join-Path $repoRoot 'templates\consumer-mcp'
$runtimeEmitDistRoot = Join-Path $repoRoot 'packages\runtime-emit\dist'

$runtimeMcpRoot = Join-Path $targetRoot '.runtime-mcp'
$serverRoot = Join-Path $runtimeMcpRoot 'server'
$distRoot = Join-Path $serverRoot 'dist'
$configRoot = Join-Path $serverRoot 'config'
$logsRoot = Join-Path $runtimeMcpRoot 'logs'
$tmpRoot = Join-Path $runtimeMcpRoot 'tmp'

$dirs = @($runtimeMcpRoot, $serverRoot, $distRoot, $configRoot, $logsRoot, $tmpRoot)
foreach ($dir in $dirs) {
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
}

$entryPath = Join-Path $distRoot 'index.cjs'
$serverConfigPath = Join-Path $configRoot 'server.config.json'
$projectMcpPath = Join-Path $targetRoot '.mcp.json'
$readmePath = Join-Path $serverRoot 'README.md'
$templateMcpPath = Join-Path $templatesSrcRoot 'runtime.mcp.json.template'
$templateServerConfigPath = Join-Path $templatesSrcRoot 'server.config.json.template'

function Render-Template {
  param(
    [string]$TemplatePath,
    [string]$OutputPath,
    [hashtable]$Values
  )

  $content = Get-Content $TemplatePath -Raw
  foreach ($key in $Values.Keys) {
    $content = $content.Replace("{{$key}}", [string]$Values[$key])
  }
  Set-Content -Path $OutputPath -Value $content -Encoding UTF8
}

if (-not (Test-Path $templatesSrcRoot)) {
  throw "Missing consumer MCP templates: $templatesSrcRoot"
}
if (-not (Test-Path (Join-Path $runtimeEmitDistRoot 'consumer-mcp-server.cjs'))) {
  throw "Missing consumer MCP build artifact. Run: npm run build:runtime-emit"
}

Copy-Item (Join-Path $runtimeEmitDistRoot 'consumer-mcp-server.cjs') $entryPath -Force

Render-Template -TemplatePath $templateServerConfigPath -OutputPath $serverConfigPath -Values @{ SERVER_NAME = $ServerName }
Render-Template -TemplatePath $templateMcpPath -OutputPath $projectMcpPath -Values @{ SERVER_NAME = $ServerName }

if ((Test-Path $entryPath) -and -not $Force) {
  Write-Host "Consumer MCP server entry prepared: $entryPath"
}

$readme = @(
  "# $ServerName MCP Server",
  '',
  'This directory is generated for a consumer project.',
  '',
  '- Entry: `dist/index.cjs`',
  '- Config: `config/server.config.json`',
  '- Logs: `.runtime-mcp/logs/`',
  '- Temp: `.runtime-mcp/tmp/`',
  '',
  'Smoke test:',
  '',
  '```powershell',
  "node .runtime-mcp/server/dist/index.cjs --smoke",
  '```',
  ''
)
$readme -join "`r`n" | Set-Content -Path $readmePath -Encoding UTF8

Write-Host "Consumer MCP layout generated at: $targetRoot"
Write-Host "Project MCP config: $projectMcpPath"
Write-Host "Server entry: $entryPath"
