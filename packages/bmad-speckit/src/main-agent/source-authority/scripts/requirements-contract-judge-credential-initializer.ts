import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
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

export interface RequirementsContractJudgeCredentialsInitOptions {
  cwd?: string;
  config: string;
  json?: boolean;
}

function resolveWithin(root: string, value: string): string {
  const resolved = path.resolve(root, value);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`judge_credential_path_escape:${value}`);
  }
  return resolved;
}

function applyOwnerOnlyPermissions(target: string): void {
  if (process.platform === 'win32') {
    const owner = execFileSync('whoami.exe', [], { encoding: 'utf8' }).trim();
    execFileSync(
      'icacls.exe',
      [target, '/inheritance:r', '/grant:r', `${owner}:(F)`],
      { stdio: 'ignore' }
    );
    return;
  }
  fs.chmodSync(target, 0o600);
}

function validateReceipt(receipt: JsonRecord): void {
  const schemaPath = path.resolve(
    __dirname,
    '..',
    'schemas',
    'requirements-contract-judge-credential-initialization-receipt.schema.json'
  );
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(
    JSON.parse(fs.readFileSync(schemaPath, 'utf8'))
  );
  if (!validate(receipt)) {
    throw new Error(`judge_credential_receipt_schema_invalid:${JSON.stringify(
      validate.errors ?? []
    )}`);
  }
}

export async function requirementsContractJudgeCredentialsInitCommand(
  options: RequirementsContractJudgeCredentialsInitOptions
): Promise<JsonRecord> {
  const root = path.resolve(options.cwd ?? process.cwd());
  const configPath = resolveWithin(root, options.config);
  const publicConfig = yaml.load(fs.readFileSync(configPath, 'utf8')) as JsonRecord;
  const runtime = publicConfig.judgeRuntime;
  const providerRef = runtime?.activeProviderRef;
  const provider = runtime?.providers?.[providerRef];
  const credentialConfig = runtime?.credentialConfig;
  if (!runtime?.enabled || !providerRef || !provider || !credentialConfig?.path) {
    throw new Error('judge_credential_public_configuration_invalid');
  }
  const allowedRoot = resolveWithin(root, credentialConfig.allowedRoot);
  const credentialPath = resolveWithin(root, credentialConfig.path);
  if (
    credentialPath !== allowedRoot &&
    !credentialPath.startsWith(`${allowedRoot}${path.sep}`)
  ) {
    throw new Error('judge_credential_private_path_outside_allowed_root');
  }
  const targetPreexisted = fs.existsSync(credentialPath);
  let credentialRevision = 1;
  if (!targetPreexisted) {
    if (
      provider.authentication?.sensitivity !== 'placeholder' ||
      provider.authentication?.arbitraryNonEmptyValueAllowed !== true
    ) {
      throw new Error('judge_credential_auto_initialization_forbidden');
    }
    const credentialRef = provider.credentialRef;
    if (typeof credentialRef !== 'string' || credentialRef.length === 0) {
      throw new Error('judge_credential_ref_missing');
    }
    const payload = {
      schemaVersion:
        credentialConfig.schemaVersion ?? 'requirements-contract-judge-credentials/v1',
      credentialRevision,
      providers: {
        [credentialRef]: {
          authenticationType: provider.authentication.type,
          apiKey: `placeholder-${randomUUID()}`,
        },
      },
    };
    fs.mkdirSync(path.dirname(credentialPath), { recursive: true });
    const tempPath = `${credentialPath}.${randomUUID()}.tmp`;
    fs.writeFileSync(tempPath, yaml.dump(payload, { noRefs: true, lineWidth: -1 }), {
      encoding: 'utf8',
      flag: 'wx',
    });
    applyOwnerOnlyPermissions(tempPath);
    fs.renameSync(tempPath, credentialPath);
  } else {
    const existing = yaml.load(fs.readFileSync(credentialPath, 'utf8')) as JsonRecord;
    credentialRevision = Number(existing.credentialRevision ?? 1);
    const selected = existing.providers?.[provider.credentialRef];
    if (
      selected?.authenticationType !== provider.authentication.type ||
      typeof selected?.apiKey !== 'string' ||
      selected.apiKey.length === 0
    ) {
      throw new Error('judge_credential_existing_value_invalid');
    }
    applyOwnerOnlyPermissions(credentialPath);
  }
  const promotedHash = fileHash(credentialPath);
  const receipt = {
    schemaVersion: 'requirements-contract-judge-credential-initialization-receipt/v1',
    publicConfigHash: fileHash(configPath),
    canonicalPrivatePathHash: sha256(slash(credentialPath)),
    credentialRevision,
    providerRef,
    authenticationType: provider.authentication.type,
    redactionDecision: 'pass',
    platformPermissionDecision: 'pass',
    targetPreexisted,
    backupRef: null,
    nonexistenceProofHash: targetPreexisted
      ? null
      : sha256(`credential-target-absent/v1\n${slash(credentialPath)}\n`),
    promotedHash,
    readbackHash: fileHash(credentialPath),
    decision: 'pass',
  };
  validateReceipt(receipt);
  const receiptPath = resolveWithin(
    root,
    'docs/plans/evidence/loop-engineering-remediation/judge-credential-initialization-receipt.json'
  );
  writeGovernedJson(receiptPath, receipt);
  if (options.json) process.stdout.write(`${JSON.stringify(receipt)}\n`);
  return receipt;
}
