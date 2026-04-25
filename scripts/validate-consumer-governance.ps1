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

  Run-Step 'restore-root-package' {
    $install = Invoke-External -FilePath 'npm.cmd' -Arguments @('install', '--no-save', '--force', "file:$RepoRoot") -WorkingDirectory $ConsumerRoot -LogName 'consumer-root-package-install'
    [ordered]@{
      exitCode = $install.exitCode
      package = 'bmad-speckit-sdd-flow'
      installMode = 'file:no-save'
      note = 'Restore local root package into consumer node_modules so repaired .bin wrappers target an existing CLI entry.'
    }
  } | Out-Null

  Run-Step 'init-consumer-runtime' {
    Invoke-InitWithRetry 'cursor' | Out-Null
    Invoke-InitWithRetry 'claude-code' | Out-Null
    [ordered]@{ agents = @('cursor', 'claude-code') }
  } | Out-Null

  Run-Step 'verify-hook-local-main-agent-surfaces' {
    $requiredByHost = [ordered]@{
      '.cursor' = @('emit-runtime-policy.cjs', 'resolve-for-session.cjs', 'render-audit-block.cjs', 'runtime-policy-inject.cjs', 'post-tool-use.cjs', 'pre-continue-check.cjs', 'write-runtime-context.cjs')
      '.claude' = @('emit-runtime-policy.cjs', 'resolve-for-session.cjs', 'render-audit-block.cjs', 'runtime-policy-inject.cjs', 'post-tool-use.cjs', 'pre-continue-check.cjs', 'write-runtime-context.cjs')
    }
    $legacyHookPatterns = @(
      '^run-bmad-.*\.cjs$',
      '^governance-cursor-agent-.*\.cjs$',
      '^governance-.*worker\.cjs$',
      '^governance-.*runner\.cjs$',
      '^governance-.*(?:ingestor|reconciler)\.cjs$'
    )
    $missing = @()
    $unexpected = @()
    $verifiedCount = 0
    foreach ($hookRoot in $requiredByHost.Keys) {
      $hookDir = Join-Path $ConsumerRoot "$hookRoot/hooks"
      foreach ($file in $requiredByHost[$hookRoot]) {
        $full = Join-Path $hookDir $file
        if (-not (Test-Path $full)) {
          $missing += $full
        } else {
          $verifiedCount += 1
        }
      }
      if (Test-Path $hookDir) {
        $hookFiles = Get-ChildItem -LiteralPath $hookDir -File -ErrorAction SilentlyContinue
        foreach ($fileInfo in $hookFiles) {
          if ($requiredByHost[$hookRoot] -contains $fileInfo.Name) { continue }
          foreach ($pattern in $legacyHookPatterns) {
            if ($fileInfo.Name -match $pattern) {
              $unexpected += $fileInfo.FullName
              break
            }
          }
        }
      }
    }
    if ($missing.Count -gt 0) { throw "Missing hook-local main-agent files: $($missing -join '; ')" }
    if ($unexpected.Count -gt 0) { throw "Legacy worker hook-local files are still installed: $($unexpected -join '; ')" }
    [ordered]@{
      verifiedCount = $verifiedCount
      legacyHookPatterns = $legacyHookPatterns
      unexpectedLegacyFiles = $unexpected.Count
      note = 'Consumer install surface now accepts only hook-local main-agent governance entrypoints.'
    }
  } | Out-Null

  Run-Step 'verify-party-mode-helper-surfaces' {
    $required = @(
      (Join-Path $ConsumerRoot '.cursor/hooks/party-mode-read-current-session.cjs'),
      (Join-Path $ConsumerRoot '_bmad/runtime/hooks/party-mode-read-current-session.cjs')
    )
    $missing = @($required | Where-Object { -not (Test-Path $_) })
    if ($missing.Count -gt 0) {
      throw "Missing party-mode helper surfaces: $($missing -join '; ')"
    }
    [ordered]@{
      requiredHelpers = $required
      consumerScriptsRequired = $false
      note = 'Consumer validation requires installed hook/runtime helpers and does not require scripts/party-mode-gate-check.ts.'
    }
  } | Out-Null

  Run-Step 'verify-cli-version' {
    $version = Invoke-External -FilePath 'npx.cmd' -Arguments @('bmad-speckit', 'version') -WorkingDirectory $ConsumerRoot -LogName 'cli-version'
    if ($version.stdout -notmatch 'version') { throw 'CLI version output did not include version text' }
    [ordered]@{ output = $version.stdout.Trim() }
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
  interactiveMode: main-agent
  fallbackAutonomousMode: false
  authoritativeHost: claude
  fallbackHosts: []
'@
  if (Test-Path $CanonicalConfigPath) { Copy-Item -Path $CanonicalConfigPath -Destination $ConfigBackupPath -Force }
  $configContent | Set-Content -Path $configPath -Encoding UTF8
  $configContent | Set-Content -Path $CanonicalConfigPath -Encoding UTF8
  Run-Step 'verify-runtime-policy-main-agent-handoff' {
    $runtimeContextPath = Join-Path $ConsumerRoot '_bmad-output/runtime/context/project.json'
    $stateDir = Join-Path $ConsumerRoot '_bmad-output/runtime/governance/orchestration-state'
    $packetDir = Join-Path $ConsumerRoot '_bmad-output/runtime/governance/packets'
    $queuePendingDir = Join-Path $ConsumerRoot '_bmad-output/runtime/governance/queue/pending'
    $currentRunPath = Join-Path $ConsumerRoot '_bmad-output/runtime/governance/current-run.json'
    $hostChecks = @(
      [ordered]@{
        name = 'cursor'
        arguments = @('.cursor/hooks/runtime-policy-inject.cjs', '--cursor-host')
        input = '{"tool_name":"Task","tool_input":{"executor":"generalPurpose","prompt":"Execute Story implementation now."}}'
        environment = @{ CURSOR_PROJECT_ROOT = $ConsumerRoot; CLAUDE_PROJECT_DIR = $ConsumerRoot }
      },
      [ordered]@{
        name = 'claude'
        arguments = @('.claude/hooks/runtime-policy-inject.cjs')
        input = '{"tool_name":"Agent","tool_input":{"subagent_type":"general-purpose","prompt":"Execute Story implementation now."}}'
        environment = @{ CLAUDE_PROJECT_DIR = $ConsumerRoot }
      }
    )
    $results = @()
    foreach ($check in $hostChecks) {
      $runtimeContextWrite = Invoke-External -FilePath 'node.exe' -Arguments @('.cursor/hooks/write-runtime-context.cjs', $runtimeContextPath, 'story', 'implement', '', 'epic-20', "20.1-$($check.name)", "consumer-validation-$($check.name)", "$ValidationRunId-$($check.name)", "_bmad-output/implementation-artifacts/epic-20/story-20.1-$($check.name)", 'story', '', '', "_bmad-output/implementation-artifacts/epic-20/story-20.1-$($check.name)/spec.md") -WorkingDirectory $ConsumerRoot -LogName "write-runtime-context-$($check.name)"
      if ($runtimeContextWrite.stdout -notmatch 'Wrote') { throw "write-runtime-context did not confirm project context write for $($check.name)" }
      $stateBefore = if (Test-Path $stateDir) { @(Get-ChildItem -Path $stateDir -Filter *.json -File -ErrorAction SilentlyContinue).Count } else { 0 }
      $packetBefore = if (Test-Path $packetDir) { @(Get-ChildItem -Path $packetDir -Filter *.json -File -Recurse -ErrorAction SilentlyContinue).Count } else { 0 }
      $hook = Invoke-External -FilePath 'node.exe' -Arguments $check.arguments -WorkingDirectory $ConsumerRoot -LogName "runtime-policy-$($check.name)" -InputText $check.input -Environment $check.environment
      $parsed = $hook.stdout | ConvertFrom-Json
      if ($parsed.continue -ne $false) { throw "runtime-policy-inject ($($check.name)) did not hand control back to main agent" }
      if (($parsed.stopReason | Out-String) -notmatch 'Implementation Entry Gate') { throw "runtime-policy-inject ($($check.name)) did not fail closed through Implementation Entry Gate" }
      if (($parsed.systemMessage | Out-String) -notmatch 'Main Agent') { throw "runtime-policy-inject ($($check.name)) did not reference Main Agent handoff" }
      if (($parsed.systemMessage | Out-String) -notmatch 'orchestration_state') { throw "runtime-policy-inject ($($check.name)) did not surface orchestration_state" }
      if (($parsed.systemMessage | Out-String) -notmatch 'pending_packet') { throw "runtime-policy-inject ($($check.name)) did not surface pending_packet" }
      $stateAfter = if (Test-Path $stateDir) { @(Get-ChildItem -Path $stateDir -Filter *.json -File -ErrorAction SilentlyContinue).Count } else { 0 }
      $packetAfter = if (Test-Path $packetDir) { @(Get-ChildItem -Path $packetDir -Filter *.json -File -Recurse -ErrorAction SilentlyContinue).Count } else { 0 }
      if ($stateAfter -le $stateBefore) { throw "runtime-policy-inject ($($check.name)) did not materialize a new orchestration state file" }
      if ($packetAfter -le $packetBefore) { throw "runtime-policy-inject ($($check.name)) did not materialize a new pending packet" }
      $results += [ordered]@{
        host = $check.name
        continue = $parsed.continue
        stopReason = $parsed.stopReason
        stateFiles = $stateAfter
        packetFiles = $packetAfter
      }
    }
    if (Test-Path $queuePendingDir) {
      $pendingQueueItems = @(Get-ChildItem -Path $queuePendingDir -Filter *.json -File -ErrorAction SilentlyContinue)
      if ($pendingQueueItems.Count -gt 0) {
        throw "runtime-policy handoff unexpectedly queued autonomous worker items: $($pendingQueueItems.FullName -join '; ')"
      }
    }
    if (Test-Path $currentRunPath) { throw "Legacy worker current-run file should not be created by main-agent handoff validation: $currentRunPath" }
    [ordered]@{
      runtimeContextPath = $runtimeContextPath
      validatedHosts = $results
      configPath = $configPath
      note = 'Accepted consumer validation now proves runtime-policy-inject hands control back through orchestration_state + pending_packet with fallbackAutonomousMode=false.'
    }
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
