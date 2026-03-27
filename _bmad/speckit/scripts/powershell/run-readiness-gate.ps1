[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string] $JourneyLedger,
    [Parameter(Mandatory = $true)]
    [string] $TraceMap,
    [string] $ArtifactRoot = ".",
    [string[]] $Docs = @(),
    [string] $OutputJson
)

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PythonScript = Join-Path $ScriptDir "../python/readiness_gate.py"
$PythonScript = (Resolve-Path $PythonScript).Path

$argsList = @(
    $PythonScript,
    "--journey-ledger", $JourneyLedger,
    "--trace-map", $TraceMap,
    "--artifact-root", $ArtifactRoot
)
if ($Docs.Count -gt 0) {
    $argsList += "--docs"
    $argsList += $Docs
}
if ($OutputJson) {
    $argsList += @("--output-json", $OutputJson)
}

& python @argsList
exit $LASTEXITCODE
