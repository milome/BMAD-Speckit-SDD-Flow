import * as fs from 'node:fs';
import * as path from 'node:path';
import yaml from 'js-yaml';
import Ajv2020 from 'ajv/dist/2020.js';
import {
  fileHash,
  sha256,
  slash,
  writeGovernedJson,
} from './requirements-contract-governed-write';

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

function createOnlyWrite(target: string, value: JsonRecord): void {
  if (fs.existsSync(target) || fs.existsSync(`${target}.safe-write-receipt.json`)) {
    throw new Error(`judge_provider_smoke_create_only_violation:${slash(target)}`);
  }
  writeGovernedJson(target, value);
}

function validate(value: JsonRecord, schemaName: string): void {
  const schemaPath = path.resolve(__dirname, '..', 'schemas', schemaName);
  const validator = new Ajv2020({ allErrors: true, strict: false }).compile(
    readJson(schemaPath)
  );
  if (!validator(value)) {
    throw new Error(`judge_provider_smoke_schema_invalid:${JSON.stringify(
      validator.errors ?? []
    )}`);
  }
}

function operationUrl(baseUrl: string, apiStyle: string): string {
  if (apiStyle !== 'chat_completions') {
    throw new Error(`judge_provider_smoke_api_style_unsupported:${apiStyle}`);
  }
  return new URL('/chat/completions', baseUrl).toString();
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
  if (
    contextPath !== phaseRoot &&
    !contextPath.startsWith(`${phaseRoot}${path.sep}`)
  ) {
    throw new Error('judge_provider_smoke_context_outside_phase_root');
  }
  const context = readJson(contextPath);
  if (
    context.phase !== options.phase ||
    context.phaseAuditAttemptId !== options.phaseAuditAttemptId
  ) {
    throw new Error('judge_provider_smoke_attempt_context_mismatch');
  }
  const configPath = resolveWithin(root, options.config);
  const config = yaml.load(fs.readFileSync(configPath, 'utf8')) as JsonRecord;
  const runtime = config.judgeRuntime;
  const providerRef = runtime?.activeProviderRef;
  const provider = runtime?.providers?.[providerRef];
  if (
    !runtime?.enabled ||
    !providerRef ||
    !provider ||
    runtime.selectionPolicy?.runtimeFallbackAllowed !== false
  ) {
    throw new Error('judge_provider_smoke_configuration_invalid');
  }
  const credentialPath = resolveWithin(root, runtime.credentialConfig?.path);
  const credentials = yaml.load(fs.readFileSync(credentialPath, 'utf8')) as JsonRecord;
  const credential = credentials.credentials?.[provider.credentialRef]?.value;
  if (typeof credential !== 'string' || credential.length === 0) {
    throw new Error('judge_provider_smoke_credential_missing');
  }
  const endpoint = operationUrl(provider.endpoint?.baseUrl, provider.apiStyle);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${credential}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: provider.model,
      messages: [
        { role: 'system', content: 'Return one structured Judge capability decision.' },
        { role: 'user', content: '{"probe":"requirements-contract-judge-provider-smoke/v1"}' },
      ],
      temperature: 0,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`judge_provider_smoke_transport_failed:${response.status}`);
  }
  const payload = (await response.json()) as JsonRecord;
  if (
    payload.model !== provider.model ||
    !Array.isArray(payload.choices) ||
    typeof payload.choices[0]?.message?.content !== 'string'
  ) {
    throw new Error('judge_provider_smoke_response_invalid');
  }
  const common = {
    phase: options.phase,
    phaseAuditAttemptId: options.phaseAuditAttemptId,
    providerRef,
    model: provider.model,
  };
  const capability = {
    schemaVersion: 'requirements-contract-judge-capability-receipt/v1',
    ...common,
    transport: provider.transport,
    apiStyle: provider.apiStyle,
    baseUrlOrigin: new URL(provider.endpoint.baseUrl).origin,
    reachable: true,
    responseModel: payload.model,
    responseStructureDecision: 'pass',
    allowPassAuthority: false,
    decision: 'pass',
  };
  const capabilityPath = resolveWithin(root, options.capabilityReceipt);
  validate(capability, 'requirements-contract-judge-capability-receipt.schema.json');
  createOnlyWrite(capabilityPath, capability);
  const selection = {
    schemaVersion: 'requirements-contract-judge-selection-receipt/v1',
    ...common,
    publicConfigRef: { path: slash(path.relative(root, configPath)), hash: fileHash(configPath) },
    privateCredentialPathHash: sha256(slash(credentialPath)),
    independenceClass: provider.auditPolicy?.independenceClass,
    runtimeFallbackAllowed: false,
    capabilityReceiptRef: {
      path: slash(path.relative(root, capabilityPath)),
      hash: fileHash(capabilityPath),
    },
    decision: 'pass',
  };
  const selectionPath = resolveWithin(root, options.selectionReceipt);
  validate(selection, 'requirements-contract-judge-selection-receipt.schema.json');
  createOnlyWrite(selectionPath, selection);
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
