[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string] $JourneyLedger,
    [Parameter(Mandatory = $true)]
    [string] $OutputRoot,
    [switch] $Overwrite
)

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PythonScript = Join-Path $ScriptDir "../python/generate_smoke_skeleton.py"
$PythonScript = (Resolve-Path $PythonScript).Path

$argsList = @(
    $PythonScript,
    "--journey-ledger", $JourneyLedger,
    "--output-root", $OutputRoot
)
if ($Overwrite) {
    $argsList += "--overwrite"
}

& python @argsList
exit $LASTEXITCODE
