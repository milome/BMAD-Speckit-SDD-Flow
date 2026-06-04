# PowerShell wrapper for bmad-speckit (Story 10.3)
$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Resolve-Path (Join-Path $ScriptDir "..\..\..")
& node (Join-Path $Root "node_modules\.bin\bmad-speckit") @args
