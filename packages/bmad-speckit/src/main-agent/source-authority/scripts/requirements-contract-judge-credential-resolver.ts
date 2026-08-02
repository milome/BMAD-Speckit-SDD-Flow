import * as fs from 'node:fs';
import * as path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import yaml from 'js-yaml';

type JsonRecord = Record<string, unknown>;

const CREDENTIAL_SECRETS = new WeakMap<object, string>();
const OVERRIDE_KEYS = [
  'provider',
  'providerRef',
  'model',
  'baseUrl',
  'apiKey',
  'credentialPath',
  'endpoint',
] as const;
const OVERRIDE_ENV =
  /^(?:BMAD_)?JUDGE_(?:PROVIDER|PROVIDER_REF|MODEL|BASE_URL|API_KEY|CREDENTIAL_PATH|ENDPOINT)$/u;

export function resolveRequirementsContractJudgeCredentialEnvironmentVariable(input: {
  adapterRef: unknown;
  authenticationType: unknown;
}): string | null {
  const adapterRef =
    typeof input.adapterRef === 'string' ? input.adapterRef.trim() : '';
  const authenticationType =
    typeof input.authenticationType === 'string'
      ? input.authenticationType.trim()
      : '';
  if (
    adapterRef === 'ClaudeCodeCliJudgeAdapter' &&
    authenticationType === 'claude_code_session'
  ) {
    return null;
  }
  if (!['bearer', 'api_key'].includes(authenticationType)) {
    throw new Error('judge_credential_authentication_invalid');
  }
  if (adapterRef === 'CodexCliJudgeAdapter') {
    return 'BMAD_CODEX_JUDGE_API_KEY';
  }
  if (adapterRef === 'ClaudeCodeCliJudgeAdapter') {
    return authenticationType === 'bearer'
      ? 'ANTHROPIC_AUTH_TOKEN'
      : 'ANTHROPIC_API_KEY';
  }
  throw new Error('judge_credential_adapter_invalid');
}

export function readRequirementsContractJudgeCredentialSecret(handle: unknown): string {
  if (!handle || typeof handle !== 'object' || Array.isArray(handle)) {
    throw new Error('judge_credential_handle_invalid');
  }
  const secret = CREDENTIAL_SECRETS.get(handle);
  if (!secret) throw new Error('judge_credential_handle_invalid');
  return secret;
}

function createCredentialHandle(metadata: JsonRecord, secret: string): Readonly<JsonRecord> {
  const handle = Object.freeze({
    schemaVersion: 'requirements-contract-judge-credential-handle/v1',
    ...metadata,
  });
  CREDENTIAL_SECRETS.set(handle, secret);
  return handle;
}

function record(value: unknown, code: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as JsonRecord;
}

function rejectOverrides(input: JsonRecord): void {
  const environmentOverride = Object.keys(process.env).find((key) => OVERRIDE_ENV.test(key));
  if (environmentOverride) {
    throw new Error(`judge_credential_environment_override:${environmentOverride}`);
  }
  if (OVERRIDE_KEYS.some((key) => Object.hasOwn(input, key) && input[key] !== undefined)) {
    throw new Error('judge_credential_cli_override');
  }
}

function resolveProjectRelative(root: string, value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || path.isAbsolute(value)) {
    throw new Error('judge_credential_path_escape');
  }
  const resolved = path.resolve(root, value);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('judge_credential_path_escape');
  }
  return resolved;
}

function isWithin(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function assertRealPathWithin(parent: string, child: string): void {
  if (!fs.existsSync(parent) || !fs.existsSync(child)) return;
  if (!isWithin(fs.realpathSync(parent), fs.realpathSync(child))) {
    throw new Error('judge_credential_path_escape');
  }
}

function validateSchema(value: unknown, schemaName: string, code: string): void {
  const schemaPath = path.resolve(__dirname, '..', 'schemas', schemaName);
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8')) as object;
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  if (!validate(value)) throw new Error(`${code}:${JSON.stringify(validate.errors ?? [])}`);
}

function resolveRequirementsContractJudgeCredentialSelection(input: JsonRecord): {
  metadata: JsonRecord;
  secret: string;
} {
  rejectOverrides(input);
  const root = path.resolve(typeof input.cwd === 'string' ? input.cwd : process.cwd());
  const configPath = resolveProjectRelative(root, input.config);
  const publicConfig = record(
    yaml.load(fs.readFileSync(configPath, 'utf8')),
    'judge_credential_public_configuration_invalid'
  );
  const runtime = record(
    publicConfig.judgeRuntime,
    'judge_credential_public_configuration_invalid'
  );
  validateSchema(
    runtime,
    'requirements-contract-judge-runtime.schema.json',
    'judge_credential_runtime_schema_invalid'
  );
  const providerRef = runtime.activeProviderRef;
  const providers = record(runtime.providers, 'judge_credential_provider_missing');
  if (typeof providerRef !== 'string' || !Object.hasOwn(providers, providerRef)) {
    throw new Error('judge_credential_provider_missing');
  }
  const provider = record(providers[providerRef], 'judge_credential_provider_missing');
  const credentialRef = provider.credentialRef;
  const authentication = record(provider.authentication, 'judge_credential_authentication_invalid');
  if (typeof credentialRef !== 'string' || typeof authentication.type !== 'string') {
    throw new Error('judge_credential_authentication_invalid');
  }
  const credentialConfig = record(
    runtime.credentialConfig,
    'judge_credential_public_configuration_invalid'
  );
  const allowedRoot = resolveProjectRelative(root, credentialConfig.allowedRoot);
  const credentialPath = resolveProjectRelative(root, credentialConfig.path);
  if (!isWithin(allowedRoot, credentialPath)) {
    throw new Error('judge_credential_private_path_outside_allowed_root');
  }
  assertRealPathWithin(root, allowedRoot);
  assertRealPathWithin(allowedRoot, credentialPath);
  if (!fs.existsSync(credentialPath)) throw new Error('judge_credential_missing');
  const credentials = record(
    yaml.load(fs.readFileSync(credentialPath, 'utf8')),
    'judge_credential_schema_invalid'
  );
  validateSchema(
    credentials,
    'requirements-contract-judge-credentials.schema.json',
    'judge_credential_schema_invalid'
  );
  if (credentials.schemaVersion !== credentialConfig.schemaVersion) {
    throw new Error('judge_credential_schema_version_mismatch');
  }
  const credentialProviders = record(credentials.providers, 'judge_credential_provider_missing');
  if (!Object.hasOwn(credentialProviders, credentialRef)) {
    throw new Error('judge_credential_provider_missing');
  }
  const selected = record(credentialProviders[credentialRef], 'judge_credential_provider_missing');
  if (selected.authenticationType !== authentication.type) {
    throw new Error('judge_credential_authentication_mismatch');
  }
  if (typeof selected.apiKey !== 'string' || selected.apiKey.length === 0) {
    throw new Error('judge_credential_missing');
  }
  return {
    metadata: {
      providerRef,
      credentialRef,
      authenticationType: selected.authenticationType,
      credentialRevision: credentials.credentialRevision,
      credentialPath,
    },
    secret: selected.apiKey,
  };
}

export function resolveRequirementsContractJudgeCredentialMetadata(
  input: JsonRecord
): JsonRecord {
  return resolveRequirementsContractJudgeCredentialSelection(input).metadata;
}

export async function resolveRequirementsContractJudgeCredential(
  input: JsonRecord
): Promise<JsonRecord> {
  const selection = resolveRequirementsContractJudgeCredentialSelection(input);
  const credentialHandle = createCredentialHandle(
    {
      providerRef: selection.metadata.providerRef,
      credentialRef: selection.metadata.credentialRef,
      authenticationType: selection.metadata.authenticationType,
      credentialRevision: selection.metadata.credentialRevision,
    },
    selection.secret
  );
  return {
    ...selection.metadata,
    credentialHandle,
  };
}
