[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, ValueFromRemainingArguments = $true)]
    [string[]] $Paths,
    [string] $PatternLibrary = "_bmad/cursor/skills/speckit-workflow/references/omissions-pattern-library.md",
    [string] $OutputJson
)

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PythonScript = Join-Path $ScriptDir "../python/ambiguity_linter.py"
$PythonScript = (Resolve-Path $PythonScript).Path

$argsList = @($PythonScript) + $Paths + @("--pattern-library", $PatternLibrary)
if ($OutputJson) {
    $argsList += @("--output-json", $OutputJson)
}

& python @argsList
exit $LASTEXITCODE
