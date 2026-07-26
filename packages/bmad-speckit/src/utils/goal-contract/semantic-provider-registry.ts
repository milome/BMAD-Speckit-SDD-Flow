const fs = require('node:fs');
const path = require('node:path');
const Ajv2020 = require('ajv/dist/2020');
const {
  sha256Buffer,
  sha256Text,
  stableStringify,
} = require(
  __filename.endsWith('.ts')
    ? '../large-document-writer/receipts.ts'
    : '../large-document-writer/receipts'
);
const {
  invokeSemanticProvider,
  validateRoleResponse,
} = require(
  __filename.endsWith('.ts')
    ? './semantic-provider-transport.ts'
    : './semantic-provider-transport'
);

export type GoalContractSemanticProviderRegistryModule = never;

function failure(failureClass, extra = {}) {
  return Object.assign(new Error(failureClass), { failureClass, ...extra });
}

function containsCredentialMaterial(value, key = '') {
  if (Array.isArray(value)) {
    return value.some((item) => containsCredentialMaterial(item, key));
  }
  if (!value || typeof value !== 'object') {
    return (
      !['credentialEnvRefs', 'urlEnvRef'].includes(key) &&
      /(?:api.?key|credential|password|secret|token)/iu.test(key)
    );
  }
  return Object.entries(value).some(([childKey, child]) =>
    containsCredentialMaterial(child, childKey)
  );
}

function loadGoalContractSemanticProviderRegistry({ packageRoot, env = process.env }) {
  const directory = path.join(packageRoot, '_bmad', 'shared', 'goal-contract');
  const registryPath = path.join(
    directory,
    'goal-contract-semantic-provider-registry.json'
  );
  const schemaPath = path.join(
    directory,
    'goal-contract-semantic-provider-registry.schema.json'
  );
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  if (containsCredentialMaterial(registry)) {
    throw failure('semantic_provider_registry_contains_secret');
  }
  if (/requirements?[_ -]contract[_ -]judge/iu.test(JSON.stringify(registry))) {
    throw failure('semantic_provider_role_mismatch');
  }
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(
    schema
  );
  if (!validate(registry)) {
    throw failure('semantic_provider_registry_invalid', {
      validationErrors: validate.errors || [],
    });
  }
  const providerRef = registry.activeProviderRef;
  const provider = providerRef ? registry.providers[providerRef] : null;
  if (registry.enabled && !provider) {
    throw failure('semantic_provider_unavailable', { providerRef });
  }
  const environment = {};
  for (const envRef of provider?.credentialEnvRefs || []) {
    if (!env[envRef]) throw failure('semantic_provider_unavailable', { envRef });
    environment[envRef] = env[envRef];
  }
  const providerUrl =
    provider?.providerType === 'http' ? env[provider.urlEnvRef] : null;
  if (provider?.providerType === 'http' && !providerUrl) {
    throw failure('semantic_provider_unavailable', {
      envRef: provider.urlEnvRef,
    });
  }
  return Object.freeze({
    packageRoot,
    registry,
    registryPath: registryPath.replace(/\\/gu, '/'),
    registryHash: sha256Text(stableStringify(registry)),
    providerRef,
    provider,
    providerUrl,
    environment,
  });
}

function assertNoForbiddenPartitionAuthorityArgs(args) {
  const forbidden = (args || []).find((arg) =>
    /^--(?:semantic-response(?:-file)?|implementation-view-file|acceptance-evidence-view-file)(?:=|$)/u.test(
      String(arg)
    )
  );
  if (forbidden) {
    throw failure('partition_authority_argument_forbidden', {
      argument: forbidden,
    });
  }
}

function receiptFile(receiptsDir, roleContract, requestHash) {
  const identity = sha256Text(`${roleContract}:${requestHash}`).slice(7);
  return path.join(receiptsDir, `${identity}.json`);
}

function readTrustedInvocation({ receiptsDir, roleContract, requestHash, request, binding }) {
  if (!receiptsDir) return null;
  const target = receiptFile(receiptsDir, roleContract, requestHash);
  if (!fs.existsSync(target)) return null;
  try {
    const envelope = JSON.parse(fs.readFileSync(target, 'utf8'));
    const responseBytes = Buffer.from(envelope.responseBytesBase64, 'base64');
    const parsed = validateRoleResponse({ roleContract, requestHash, responseBytes });
    const receipt = envelope.receipt;
    const valid =
      receipt.providerRegistryHash === binding.registryHash &&
      receipt.configuredProviderRef === binding.providerRef &&
      receipt.roleContract === roleContract &&
      receipt.roleContractHash === request.roleContractHash &&
      receipt.requestHash === requestHash &&
      receipt.sessionIdentity === parsed.sessionIdentity &&
      receipt.responseHash === sha256Buffer(responseBytes) &&
      receipt.sourceSnapshotHash === request.sourceSnapshotHash &&
      receipt.sourceObligationGraphHash === request.sourceObligationGraphHash &&
      receipt.methodologyProfileHash === request.methodologyProfileHash &&
      receipt.repositoryFactsHash === request.repositoryFactsHash &&
      stableStringify(parsed.result) === stableStringify(envelope.result);
    if (!valid) throw new Error('stale');
    return {
      result: parsed.result,
      view: parsed.result,
      receipt: Object.freeze({ ...receipt, reused: true }),
    };
  } catch {
    fs.renameSync(target, `${target}.quarantine-${Date.now()}`);
    return null;
  }
}

function writeTrustedInvocation({ receiptsDir, roleContract, requestHash, outcome }) {
  if (!receiptsDir) return;
  fs.mkdirSync(receiptsDir, { recursive: true });
  const target = receiptFile(receiptsDir, roleContract, requestHash);
  const temp = `${target}.tmp-${process.pid}`;
  fs.writeFileSync(
    temp,
    stableStringify({
      schemaVersion: 'goal-contract-semantic-provider-trusted-invocation/v1',
      result: outcome.result,
      receipt: outcome.receipt,
      responseBytesBase64: outcome.responseBytes.toString('base64'),
    }),
    'utf8'
  );
  fs.renameSync(temp, target);
}

function createGoalContractSemanticProvider({
  packageRoot,
  env = process.env,
  receiptsDir = null,
}) {
  const binding = loadGoalContractSemanticProviderRegistry({ packageRoot, env });
  if (!binding.registry.enabled || !binding.provider) {
    throw failure('semantic_provider_unavailable');
  }
  const invoked = new Set();
  const sessions = new Map();
  const invokeRole = async (roleKey, input) => {
    const roleContract = binding.registry.roleContracts[roleKey];
    const request = {
      ...input,
      roleContract,
      roleContractHash: sha256Text(roleContract),
    };
    for (const field of [
      'sourceSnapshotHash',
      'sourceObligationGraphHash',
      'methodologyProfileHash',
      'repositoryFactsHash',
    ]) {
      if (!/^sha256:[0-9a-f]{64}$/u.test(request[field] || '')) {
        throw failure('semantic_provider_request_invalid', { field });
      }
    }
    const requestHash = sha256Buffer(
      Buffer.from(stableStringify(request), 'utf8')
    );
    const trusted = readTrustedInvocation({
      receiptsDir,
      roleContract,
      requestHash,
      request,
      binding,
    });
    if (trusted) return trusted;
    const invocationKey = `${roleContract}:${requestHash}`;
    if (invoked.has(invocationKey)) {
      throw failure('semantic_provider_duplicate_invocation');
    }
    invoked.add(invocationKey);
    const outcome = await invokeSemanticProvider({
      registryBinding: binding,
      roleContract,
      request,
    });
    const priorRole = sessions.get(outcome.receipt.sessionIdentity);
    if (priorRole && priorRole !== roleContract) {
      throw failure('view_isolation_violation');
    }
    sessions.set(outcome.receipt.sessionIdentity, roleContract);
    writeTrustedInvocation({
      receiptsDir,
      roleContract,
      requestHash,
      outcome,
    });
    return { result: outcome.result, view: outcome.result, receipt: outcome.receipt };
  };
  return Object.freeze({
    deriveImplementationView: (input) =>
      invokeRole('implementation_view', input),
    deriveAcceptanceEvidenceView: (input) =>
      invokeRole('acceptance_evidence_view', input),
  });
}

module.exports = {
  assertNoForbiddenPartitionAuthorityArgs,
  createGoalContractSemanticProvider,
  loadGoalContractSemanticProviderRegistry,
};
