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

$serverRoot = Join-Path $targetRoot ".codex\mcp\$ServerName\server"
$distRoot = Join-Path $serverRoot 'dist'
$configRoot = Join-Path $serverRoot 'config'
$logsRoot = Join-Path $serverRoot 'logs'
$tmpRoot = Join-Path $serverRoot 'tmp'
$templatesRoot = Join-Path $targetRoot '.codex\mcp\templates'
$generatedRoot = Join-Path $targetRoot '.codex\generated'

$dirs = @($serverRoot, $distRoot, $configRoot, $logsRoot, $tmpRoot, $templatesRoot, $generatedRoot, (Join-Path $targetRoot '.codex\install'))
foreach ($dir in $dirs) {
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
}

$entryPath = Join-Path $distRoot 'index.js'
$serverConfigPath = Join-Path $configRoot 'server.config.json'
$projectMcpPath = Join-Path $targetRoot '.mcp.json'
$generatedMcpPath = Join-Path $generatedRoot 'mcp.json'
$readmePath = Join-Path $serverRoot 'README.md'
$templateMcpPath = Join-Path $templatesRoot 'codex.mcp.json.template'
$templateServerConfigPath = Join-Path $templatesRoot 'server.config.json.template'

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

Copy-Item (Join-Path $templatesSrcRoot 'codex.mcp.json.template') $templateMcpPath -Force
Copy-Item (Join-Path $templatesSrcRoot 'server.config.json.template') $templateServerConfigPath -Force
Copy-Item (Join-Path $runtimeEmitDistRoot 'consumer-mcp-server.cjs') $entryPath -Force

Render-Template -TemplatePath $templateServerConfigPath -OutputPath $serverConfigPath -Values @{ SERVER_NAME = $ServerName }
Render-Template -TemplatePath $templateMcpPath -OutputPath $generatedMcpPath -Values @{ SERVER_NAME = $ServerName }
Copy-Item $generatedMcpPath $projectMcpPath -Force

if ((Test-Path $entryPath) -and -not $Force) {
  Write-Host "Consumer MCP server entry prepared: $entryPath"
}

$readme = @(
  "# $ServerName MCP Server",
  '',
  'This directory is generated for a consumer project.',
  '',
  '- Entry: `dist/index.js`',
  '- Config: `config/server.config.json`',
  '- Logs: `logs/`',
  '- Temp: `tmp/`',
  '',
  'Smoke test:',
  '',
  '```powershell',
  "node .codex/mcp/$ServerName/server/dist/index.js --smoke",
  '```',
  ''
)
$readme -join "`r`n" | Set-Content -Path $readmePath -Encoding UTF8

Write-Host "Consumer MCP layout generated at: $targetRoot"
Write-Host "Project MCP config: $projectMcpPath"
Write-Host "Server entry: $entryPath"
