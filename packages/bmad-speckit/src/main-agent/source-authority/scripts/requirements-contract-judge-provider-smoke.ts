import * as fs from 'node:fs';
import * as path from 'node:path';
import yaml from 'js-yaml';
import Ajv2020 from 'ajv/dist/2020.js';
import { resolveRequirementsContractJudgeCredential } from './requirements-contract-judge-credential-resolver';
import {
  createRequirementsContractJudgeProviderRegistry,
  resolveRequirementsContractJudgeProvider,
} from './requirements-contract-judge-provider-registry';
import { resolveRequirementsContractJudgeRuntimeBindings } from './requirements-contract-judge-runtime-bindings';
import { createRequirementsContractJudgeSelectionReceipt } from './requirements-contract-judge-selection';
import { fileHash, sha256, slash, writeGovernedJson } from './requirements-contract-governed-write';

type JsonRecord = Record<string, ReturnType<typeof JSON.parse>>;

export interface RequirementsContractJudgeProviderSmokeOptions {
  cwd?: string;
  config: string;
  phase: 'pre-candidate' | 'final';
  phaseRoot: string;
  phaseAuditAttemptId: string;
  auditContext: string;
  capabilityReceipt: string;
  selectionReceipt: string;
  securityParity: string;
  projectionMode: 'final-only';
  json?: boolean;
}

function resolveWithin(root: string, value: string): string {
  const resolved = path.resolve(root, value);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`judge_provider_smoke_path_escape:${value}`);
  }
  return resolved;
}

function readJson(filePath: string): JsonRecord {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as JsonRecord;
}

function record(value: unknown, code: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(code);
  }
  return value as JsonRecord;
}

function createOnlyWrite(target: string, value: JsonRecord): void {
  if (fs.existsSync(target) || fs.existsSync(`${target}.safe-write-receipt.json`)) {
    throw new Error(`judge_provider_smoke_create_only_violation:${slash(target)}`);
  }
  writeGovernedJson(target, value);
}

function validate(value: JsonRecord, schemaName: string): void {
  const schemaPath = path.resolve(__dirname, '..', 'schemas', schemaName);
  const validator = new Ajv2020({ allErrors: true, strict: false }).compile(readJson(schemaPath));
  if (!validator(value)) {
    throw new Error(
      `judge_provider_smoke_schema_invalid:${JSON.stringify(validator.errors ?? [])}`
    );
  }
}

function structuredProbeResult(payload: unknown): {
  returnedModel: string;
  structuredOutputSupport: true;
} {
  const response = record(payload, 'judge_provider_smoke_response_invalid');
  const choices = response.choices;
  const content = Array.isArray(choices)
    ? record(choices[0], 'judge_provider_smoke_response_invalid').message
    : undefined;
  const message = record(content, 'judge_provider_smoke_response_invalid');
  if (typeof response.model !== 'string' || typeof message.content !== 'string') {
    throw new Error('judge_provider_smoke_response_invalid');
  }
  try {
    record(JSON.parse(message.content), 'judge_provider_smoke_response_invalid');
  } catch {
    throw new Error('judge_provider_smoke_response_invalid');
  }
  return {
    returnedModel: response.model,
    structuredOutputSupport: true,
  };
}

export async function requirementsContractJudgeProviderSmokeCommand(
  options: RequirementsContractJudgeProviderSmokeOptions
): Promise<JsonRecord> {
  const root = path.resolve(options.cwd ?? process.cwd());
  if (!['pre-candidate', 'final'].includes(options.phase)) {
    throw new Error('judge_provider_smoke_phase_invalid');
  }
  if (options.projectionMode !== 'final-only') {
    throw new Error('judge_provider_smoke_projection_mode_invalid');
  }
  const phaseRoot = resolveWithin(root, options.phaseRoot);
  const contextPath = resolveWithin(root, options.auditContext);
  if (contextPath !== phaseRoot && !contextPath.startsWith(`${phaseRoot}${path.sep}`)) {
    throw new Error('judge_provider_smoke_context_outside_phase_root');
  }
  const context = readJson(contextPath);
  validate(context, 'requirements-contract-stage-audit-context.schema.json');
  if (
    context.phase !== options.phase ||
    context.phaseAuditAttemptId !== options.phaseAuditAttemptId
  ) {
    throw new Error('judge_provider_smoke_attempt_context_mismatch');
  }
  resolveRequirementsContractJudgeRuntimeBindings({
    root,
    phaseRoot,
    phase: options.phase,
    phaseAuditAttemptId: options.phaseAuditAttemptId,
    context,
  });
  const configPath = resolveWithin(root, options.config);
  const config = record(
    yaml.load(fs.readFileSync(configPath, 'utf8')),
    'judge_provider_smoke_configuration_invalid'
  );
  const runtime = record(config.judgeRuntime, 'judge_provider_smoke_configuration_invalid');
  const credential = await resolveRequirementsContractJudgeCredential({
    cwd: root,
    config: slash(path.relative(root, configPath)),
  });
  const registry = createRequirementsContractJudgeProviderRegistry({
    judgeRuntime: runtime,
    runtime,
  });
  const providerSelection = await resolveRequirementsContractJudgeProvider({
    registry,
    judgeRuntime: runtime,
    runtime,
    activeProviderRef: runtime.activeProviderRef,
  });
  const provider = record(providerSelection.provider, 'judge_provider_smoke_configuration_invalid');
  const adapter = record(providerSelection.adapter, 'judge_provider_smoke_adapter_missing');
  if (
    typeof providerSelection.providerRef !== 'string' ||
    providerSelection.providerRef !== credential.providerRef ||
    !credential.credentialHandle ||
    typeof credential.credentialHandle !== 'object' ||
    typeof adapter.probe !== 'function'
  ) {
    throw new Error('judge_provider_smoke_selection_mismatch');
  }
  const probe = record(
    await adapter.probe({
      provider,
      credential: credential.credentialHandle,
    }),
    'judge_provider_smoke_response_invalid'
  );
  const normalizedProbe = structuredProbeResult(probe.payload);
  if (probe.originPreservationDecision !== 'pass') {
    throw new Error('judge_provider_smoke_response_invalid');
  }
  if (JSON.stringify(credential).includes('apiKey')) {
    throw new Error('judge_provider_smoke_credential_leak');
  }
  const publicProviderConfigHash = fileHash(configPath);
  const configuredBaseUrlHash = sha256(provider.endpoint.baseUrl);
  const configuredModel = provider.model ?? null;
  const capability = {
    schemaVersion: 'requirements-contract-judge-capability-receipt/v1',
    transactionId: context.transactionId,
    auditAttemptId: options.phaseAuditAttemptId,
    providerRef: providerSelection.providerRef,
    publicProviderConfigHash,
    credentialRevision: credential.credentialRevision,
    credentialResolutionDecision: 'pass',
    credentialRedactionDecision: 'pass',
    configuredBaseUrlHash,
    transport: provider.transport,
    apiStyle: provider.apiStyle,
    endpointResolutionMode: provider.endpoint.resolutionMode,
    upstreamVersioning: provider.endpoint.upstreamVersioning,
    configuredModel,
    returnedModel: normalizedProbe.returnedModel,
    transportSuccess: true,
    structuredOutputSupport: normalizedProbe.structuredOutputSupport,
    originPreservationDecision: probe.originPreservationDecision,
    fallbackObserved: false,
    probeRequestHash: probe.requestHash,
    probeResponseHash: probe.responseHash,
    decision: 'pass',
  };
  const capabilityPath = resolveWithin(root, options.capabilityReceipt);
  validate(capability, 'requirements-contract-judge-capability-receipt.schema.json');
  createOnlyWrite(capabilityPath, capability);
  const adapterRef =
    provider.transport === 'openai-compatible'
      ? 'OpenAICompatibleJudgeAdapter'
      : provider.transport === 'anthropic-compatible'
        ? 'AnthropicCompatibleJudgeAdapter'
        : provider.transport === 'claude-code-cli'
          ? 'ClaudeCodeCliJudgeAdapter'
          : 'CodexCliJudgeAdapter';
  const selectionReceipt = createRequirementsContractJudgeSelectionReceipt({
    providerRef: providerSelection.providerRef,
    provider,
    adapterRef,
    providerRegistryHash: registry.registryHash,
  });
  const selectionPath = resolveWithin(root, options.selectionReceipt);
  validate(selectionReceipt, 'requirements-contract-judge-selection-receipt.schema.json');
  createOnlyWrite(selectionPath, selectionReceipt);
  if (JSON.stringify({ capability, selectionReceipt }).includes('apiKey')) {
    throw new Error('judge_provider_smoke_credential_leak');
  }
  const common = {
    phase: options.phase,
    phaseAuditAttemptId: options.phaseAuditAttemptId,
    providerRef: providerSelection.providerRef,
    model: configuredModel,
  };
  const security = {
    schemaVersion: 'requirements-contract-judge-runtime-security-parity/v1',
    ...common,
    credentialValueEmissionCount: 0,
    environmentOverrideCount: 0,
    endpointOverrideCount: 0,
    fallbackProviderCount: 0,
    operationPathOwner: 'transport_adapter',
    allowPassAuthority: false,
    decision: 'pass',
  };
  const securityPath = resolveWithin(root, options.securityParity);
  validate(security, 'requirements-contract-judge-runtime-security-parity.schema.json');
  createOnlyWrite(securityPath, security);
  const result = {
    ...common,
    capabilityReceiptRef: { path: slash(capabilityPath), hash: fileHash(capabilityPath) },
    selectionReceiptRef: { path: slash(selectionPath), hash: fileHash(selectionPath) },
    securityParityRef: { path: slash(securityPath), hash: fileHash(securityPath) },
    decision: 'pass',
  };
  if (options.json) process.stdout.write(`${JSON.stringify(result)}\n`);
  return result;
}
