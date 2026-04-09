param(
  [string]$ConsumerRoot = 'D:/Dev/claw-scope',
  [string]$SummaryRoot = '',
  [switch]$SkipBuild,
  [switch]$SkipCleanup,
  [int]$InitRetryCount = 3,
  [int]$PollTimeoutSeconds = 120
)

$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ConsumerRoot = (Resolve-Path $ConsumerRoot).Path
if (-not $SummaryRoot) { $SummaryRoot = Join-Path $ConsumerRoot '_bmad-output/validation-consumer-governance' }
$SummaryRoot = [System.IO.Path]::GetFullPath($SummaryRoot)
$LogsRoot = Join-Path $SummaryRoot 'logs'
$CanonicalConfigPath = Join-Path $ConsumerRoot '_bmad/_config/governance-remediation.yaml'
$ConfigBackupPath = Join-Path $SummaryRoot 'governance-remediation.backup.yaml'
$ValidationRunId = 'consumer-validation-' + (Get-Date -Format 'yyyyMMddHHmmssfff')
New-Item -ItemType Directory -Force -Path $SummaryRoot, $LogsRoot | Out-Null
$script:SummaryPath = Join-Path $SummaryRoot 'summary.json'
$script:Summary = [ordered]@{
  repoRoot = $RepoRoot; consumerRoot = $ConsumerRoot; summaryRoot = $SummaryRoot; startedAt = (Get-Date).ToString('o'); status = 'running'; steps = @()
}

function Save-Summary {
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $script:SummaryPath), $LogsRoot | Out-Null
  $script:Summary.finishedAt = (Get-Date).ToString('o')
  $script:Summary | ConvertTo-Json -Depth 20 | Set-Content -Path $script:SummaryPath -Encoding UTF8
}

function Add-Step($Name, $Status, $Data) {
  $step = [ordered]@{ name = $Name; status = $Status; at = (Get-Date).ToString('o') }
  if ($Data) { foreach ($key in $Data.Keys) { $step[$key] = $Data[$key] } }
  $script:Summary.steps += $step
  Save-Summary
}

function Invoke-External {
  param(
    [string]$FilePath,
    [string[]]$Arguments = @(),
    [string]$WorkingDirectory,
    [string]$LogName,
    [int[]]$ExpectedExitCodes = @(0),
    [hashtable]$Environment = @{},
    [string]$InputText = ''
  )
  $psi = [System.Diagnostics.ProcessStartInfo]::new()
  $psi.FileName = $FilePath
  foreach ($arg in $Arguments) { [void]$psi.ArgumentList.Add([string]$arg) }
  $psi.WorkingDirectory = $WorkingDirectory
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.RedirectStandardInput = $InputText -ne ''
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  foreach ($entry in $Environment.GetEnumerator()) { $psi.Environment[$entry.Key] = [string]$entry.Value }
  $proc = [System.Diagnostics.Process]::Start($psi)
  if ($InputText -ne '') { $proc.StandardInput.Write($InputText); $proc.StandardInput.Close() }
  $stdout = $proc.StandardOutput.ReadToEnd()
  $stderr = $proc.StandardError.ReadToEnd()
  $proc.WaitForExit()
  New-Item -ItemType Directory -Force -Path $LogsRoot | Out-Null
  Set-Content -Path (Join-Path $LogsRoot "$LogName.stdout.log") -Value $stdout -Encoding UTF8
  Set-Content -Path (Join-Path $LogsRoot "$LogName.stderr.log") -Value $stderr -Encoding UTF8
  if ($ExpectedExitCodes -notcontains $proc.ExitCode) { throw "Command failed [$LogName] exit=$($proc.ExitCode): $FilePath $($Arguments -join ' ')" }
  [ordered]@{ exitCode = $proc.ExitCode; stdout = $stdout; stderr = $stderr; logPrefix = (Join-Path $LogsRoot $LogName) }
}

function Run-Step($Name, [scriptblock]$Action) {
  try { $result = & $Action; Add-Step $Name 'passed' $result; return $result }
  catch { Add-Step $Name 'failed' @{ error = $_.Exception.Message }; throw }
}

function Remove-PathWithRetry([string]$PathValue) {
  for ($attempt = 1; $attempt -le 5; $attempt++) {
    if (-not (Test-Path $PathValue)) { return }
    try { Remove-Item -LiteralPath $PathValue -Recurse -Force -ErrorAction Stop; return }
    catch { if ($attempt -eq 5) { throw }; Start-Sleep -Seconds 2 }
  }
}

function Get-JsonFiles([string]$Dir) {
  if (-not (Test-Path $Dir)) { return @() }
  @(Get-ChildItem -Path $Dir -Filter *.json -File | Select-Object -ExpandProperty FullName)
}

function Wait-Until([scriptblock]$Predicate, [string]$Description) {
  $deadline = (Get-Date).AddSeconds($PollTimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (& $Predicate) { return }
    Start-Sleep -Milliseconds 500
  }
  throw "Timed out waiting for $Description"
}

function Invoke-InitWithRetry([string]$Agent) {
  for ($attempt = 1; $attempt -le $InitRetryCount; $attempt++) {
    try { return Invoke-External -FilePath 'npx.cmd' -Arguments @('bmad-speckit-init', '--agent', $Agent) -WorkingDirectory $ConsumerRoot -LogName "init-$Agent-$attempt" }
    catch {
      if ($attempt -eq $InitRetryCount -or $_.Exception.Message -notmatch 'EBUSY|busy') { throw }
      Start-Sleep -Seconds 2
    }
  }
}

Save-Summary

try {
  Run-Step 'validate-inputs' {
    if (-not (Test-Path (Join-Path $ConsumerRoot 'package.json'))) { throw "Missing consumer package.json: $ConsumerRoot" }
    [ordered]@{ packageJson = (Join-Path $ConsumerRoot 'package.json') }
  } | Out-Null

  if (-not $SkipCleanup) {
    Run-Step 'cleanup-install-surface' {
      $targets = @('_bmad', '.claude', '.cursor', 'node_modules/bmad-speckit-sdd-flow') | ForEach-Object { Join-Path $ConsumerRoot $_ }
      foreach ($target in $targets) { Remove-PathWithRetry $target }
      [ordered]@{
        removed = $targets
        preserved = @((Join-Path $ConsumerRoot '_bmad-output'))
        note = '_bmad-output contains runtime artifacts and must never be deleted during consumer reinstall.'
      }
    } | Out-Null
  }

  if (-not $SkipBuild) {
    Run-Step 'build-runtime-bundles' {
      Invoke-External -FilePath 'npm.cmd' -Arguments @('run', 'build:scoring') -WorkingDirectory $RepoRoot -LogName 'build-scoring' | Out-Null
      Invoke-External -FilePath 'npm.cmd' -Arguments @('run', 'build:runtime-context') -WorkingDirectory $RepoRoot -LogName 'build-runtime-context' | Out-Null
      Invoke-External -FilePath 'npm.cmd' -Arguments @('run', 'build:runtime-emit') -WorkingDirectory $RepoRoot -LogName 'build-runtime-emit' | Out-Null
      [ordered]@{ commands = @('npm run build:scoring', 'npm run build:runtime-context', 'npm run build:runtime-emit') }
    } | Out-Null
  }

  Run-Step 'install-consumer-deps' {
    $install = Invoke-External -FilePath 'npm.cmd' -Arguments @('install', '--force') -WorkingDirectory $ConsumerRoot -LogName 'consumer-install'
    [ordered]@{ exitCode = $install.exitCode }
  } | Out-Null

  Run-Step 'init-consumer-runtime' {
    Invoke-InitWithRetry 'cursor' | Out-Null
    Invoke-InitWithRetry 'claude-code' | Out-Null
    [ordered]@{ agents = @('cursor', 'claude-code') }
  } | Out-Null

  Run-Step 'verify-hook-local-files' {
    $required = @('governance-runtime-worker.cjs', 'governance-remediation-runner.cjs', 'governance-packet-dispatch-worker.cjs', 'governance-execution-result-ingestor.cjs', 'governance-packet-reconciler.cjs', 'post-tool-use.cjs', 'pre-continue-check.cjs')
    $missing = @()
    foreach ($hookRoot in @('.cursor', '.claude')) { foreach ($file in $required) { $full = Join-Path $ConsumerRoot "$hookRoot/hooks/$file"; if (-not (Test-Path $full)) { $missing += $full } } }
    if ($missing.Count -gt 0) { throw "Missing hook-local files: $($missing -join '; ')" }
    [ordered]@{ verifiedCount = $required.Count * 2 }
  } | Out-Null

  Run-Step 'verify-cli-version' {
    $version = Invoke-External -FilePath 'npx.cmd' -Arguments @('bmad-speckit', 'version') -WorkingDirectory $ConsumerRoot -LogName 'cli-version'
    if ($version.stdout -notmatch 'version') { throw 'CLI version output did not include version text' }
    [ordered]@{ output = $version.stdout.Trim() }
  } | Out-Null

  $artifactPath = Join-Path $SummaryRoot "$ValidationRunId-implementation-readiness-report.md"
  Run-Step 'verify-pre-continue-check' {
    @'
# Implementation Readiness Report

## Blockers Requiring Immediate Action

- IR-BLK-001: missing proof chain

## Deferred Gaps

- J04-Smoke-E2E: Journey J04 lacks Smoke E2E
  - Reason: P2 priority
  - Resolution Target: Sprint 2+
  - Owner: Dev Team

## Deferred Gaps Tracking

| Gap ID | Description | Reason | Resolution Target | Owner | Status Checkpoint |
|--------|-------------|--------|-------------------|-------|-------------------|
| J04-Smoke-E2E | Journey J04 lacks Smoke E2E | P2 priority | Sprint 2+ | Dev Team | Sprint Planning |
'@ | Set-Content -Path $artifactPath -Encoding UTF8
    $pendingEventsDir = Join-Path $ConsumerRoot '_bmad-output/runtime/governance/queue/pending-events'
    $before = Get-JsonFiles $pendingEventsDir
    $result = Invoke-External -FilePath 'node.exe' -Arguments @('.claude/hooks/pre-continue-check.cjs', 'check-implementation-readiness', 'step-06-final-assessment') -WorkingDirectory $ConsumerRoot -LogName 'pre-continue' -ExpectedExitCodes @(2) -Environment @{ BMAD_PRECONTINUE_ARTIFACT_PATH = $artifactPath; BMAD_HOOKS_VERBOSE = '1' }
    $after = Get-JsonFiles $pendingEventsDir
    $newFile = ($after | Where-Object { $before -notcontains $_ } | Sort-Object | Select-Object -Last 1)
    if (-not $newFile) { throw 'No pending-events file created by pre-continue hook' }
    $event = Get-Content -Raw $newFile | ConvertFrom-Json
    if ($event.type -ne 'governance-rerun-result') { throw "Unexpected pending-events type: $($event.type)" }
    [ordered]@{ exitCode = $result.exitCode; pendingEvent = $newFile; eventType = $event.type }
  } | Out-Null

  $configPath = Join-Path $SummaryRoot "$ValidationRunId-governance-remediation.validation.yaml"
  $configContent = @'
version: 2
primaryHost: cursor
packetHosts:
  - cursor
  - claude
provider:
  mode: stub
  id: consumer-validation-stub
execution:
  enabled: true
  authoritativeHost: cursor
  fallbackHosts:
    - claude
'@
  if (Test-Path $CanonicalConfigPath) { Copy-Item -Path $CanonicalConfigPath -Destination $ConfigBackupPath -Force }
  $configContent | Set-Content -Path $configPath -Encoding UTF8
  $configContent | Set-Content -Path $CanonicalConfigPath -Encoding UTF8
  $outputPath = Join-Path $SummaryRoot "$ValidationRunId-auto-attempt.md"
  $eventPayload = [ordered]@{
    type = 'governance-rerun-result'
    payload = [ordered]@{
      projectRoot = $ConsumerRoot
      sourceEventType = 'manual-validation'
      configPath = $configPath
      runnerInput = [ordered]@{
        projectRoot = $ConsumerRoot; outputPath = $outputPath; promptText = "consumer validation $ValidationRunId"; stageContextKnown = $true; gateFailureExists = $true; blockerOwnershipLocked = $true; rootTargetLocked = $true; equivalentAdapterCount = 1; attemptId = $ValidationRunId; sourceGateFailureIds = @("CONSUMER-$ValidationRunId"); capabilitySlot = "qa.readiness.$ValidationRunId"; canonicalAgent = 'PM + QA / readiness reviewer'; actualExecutor = 'implementation readiness workflow'; adapterPath = 'local workflow fallback'; targetArtifacts = @('prd.md', 'architecture.md', "$ValidationRunId.md"); expectedDelta = 'close readiness blockers'; rerunOwner = 'PM'; rerunGate = 'implementation-readiness'; outcome = 'blocked'; hostKind = 'cursor'
      }
      rerunGateResult = [ordered]@{ gate = 'implementation-readiness'; status = 'fail'; blockerIds = @("CONSUMER-$ValidationRunId"); summary = "Need validation attempt for $ValidationRunId." }
    }
  }
  $eventJson = $eventPayload | ConvertTo-Json -Depth 20
  $eventJson | Set-Content -Path (Join-Path $SummaryRoot 'post-tool-use-event.json') -Encoding UTF8

  Run-Step 'verify-post-tool-use-and-background-worker' {
    $doneDir = Join-Path $ConsumerRoot '_bmad-output/runtime/governance/queue/done'
    $executionsDir = Join-Path $ConsumerRoot '_bmad-output/runtime/governance/executions'
    $doneBefore = Get-JsonFiles $doneDir
    $executionBefore = @(Get-ChildItem -Path $executionsDir -Filter *.json -File -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.Name -ne 'reconciliation-report.json' } | Select-Object -ExpandProperty FullName)
    $failedDebug = Join-Path $ConsumerRoot '_bmad-output/runtime/governance/queue/last-failed-debug.json'
    $failedDebugMtimeBefore = if (Test-Path $failedDebug) { (Get-Item $failedDebug).LastWriteTimeUtc } else { $null }
    $hook = Invoke-External -FilePath 'node.exe' -Arguments @('.cursor/hooks/post-tool-use.cjs') -WorkingDirectory $ConsumerRoot -LogName 'post-tool-use' -InputText $eventJson
    if ($hook.stdout -notmatch 'received rerun-result' -or $hook.stdout -notmatch 'queued rerun event') { throw 'post-tool-use hook did not emit expected queue logs' }
    Wait-Until {
      if (Test-Path $failedDebug) {
        $failedDebugItem = Get-Item $failedDebug
        if (-not $failedDebugMtimeBefore -or $failedDebugItem.LastWriteTimeUtc -gt $failedDebugMtimeBefore) { throw (Get-Content -Raw $failedDebug) }
      }
      Test-Path $outputPath
    } 'worker artifact output'
    $newDoneFile = $null
    Wait-Until {
      $newDoneFile = (Get-JsonFiles $doneDir | Where-Object { $doneBefore -notcontains $_ } | Sort-Object | Select-Object -Last 1)
      [bool]$newDoneFile
    } 'queue done item'
    $packetPath = $outputPath -replace '\.md$', '.cursor-packet.md'
    Wait-Until { Test-Path $packetPath } 'cursor packet'
    $executionFile = $null
    Wait-Until {
      $executionFile = Get-ChildItem -Path $executionsDir -Filter *.json -File -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.Name -ne 'reconciliation-report.json' -and $executionBefore -notcontains $_.FullName } | Sort-Object LastWriteTime | Select-Object -Last 1
      if (-not $executionFile) { return $false }
      ((Get-Content -Raw $executionFile.FullName | ConvertFrom-Json).status -eq 'running')
    } 'execution record running'
    $record = Get-Content -Raw $executionFile.FullName | ConvertFrom-Json
    [ordered]@{ queueDone = $true; doneFile = $newDoneFile; artifactPath = $outputPath; packetPath = $packetPath; executionFile = $executionFile.FullName; loopStateId = $record.loopStateId; attemptNumber = [int]$record.attemptNumber; executionStatus = $record.status; note = 'Validation uses unique run id and preserves all existing _bmad-output artifacts.' }
  } | Out-Null

  $executionStep = $script:Summary.steps | Where-Object { $_.name -eq 'verify-post-tool-use-and-background-worker' } | Select-Object -Last 1
  $loopStateId = [string]$executionStep.loopStateId
  $attemptNumber = [int]$executionStep.attemptNumber
  Run-Step 'verify-execution-closure' {
    $executionPayload = ([ordered]@{ kind = 'execution'; projectRoot = $ConsumerRoot; loopStateId = $loopStateId; attemptNumber = $attemptNumber; result = [ordered]@{ outcome = 'completed'; observedAt = (Get-Date).ToString('o'); externalRunId = 'consumer-validation-run' } } | ConvertTo-Json -Compress -Depth 20)
    $awaiting = Invoke-External -FilePath 'node.exe' -Arguments @('.cursor/hooks/governance-execution-result-ingestor.cjs', $executionPayload) -WorkingDirectory $ConsumerRoot -LogName 'ingest-execution'
    $awaitingRecord = $awaiting.stdout | ConvertFrom-Json
    if ($awaitingRecord.status -ne 'awaiting_rerun_gate') { throw "Execution ingestor did not reach awaiting_rerun_gate: $($awaitingRecord.status)" }
    $gatePayload = ([ordered]@{ kind = 'rerunGate'; projectRoot = $ConsumerRoot; loopStateId = $loopStateId; attemptNumber = $attemptNumber; rerunGateResult = [ordered]@{ gate = 'implementation-readiness'; status = 'pass'; summary = 'all blockers resolved'; observedAt = (Get-Date).ToString('o') } } | ConvertTo-Json -Compress -Depth 20)
    $passed = Invoke-External -FilePath 'node.exe' -Arguments @('.cursor/hooks/governance-execution-result-ingestor.cjs', $gatePayload) -WorkingDirectory $ConsumerRoot -LogName 'ingest-rerun-gate'
    $passedRecord = $passed.stdout | ConvertFrom-Json
    if ($passedRecord.status -ne 'gate_passed') { throw "Rerun gate ingestor did not reach gate_passed: $($passedRecord.status)" }
    [ordered]@{ loopStateId = $loopStateId; attemptNumber = $attemptNumber; finalStatus = $passedRecord.status; executionId = $passedRecord.executionId }
  } | Out-Null

  $script:Summary.status = 'passed'
  Save-Summary
}
catch {
  $script:Summary.status = 'failed'
  $script:Summary.error = $_.Exception.Message
  Save-Summary
  throw
}
finally {
  if (Test-Path $ConfigBackupPath) { Copy-Item -Path $ConfigBackupPath -Destination $CanonicalConfigPath -Force }
}
