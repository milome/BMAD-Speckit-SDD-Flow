const http = require('node:http');
const https = require('node:https');
const { spawn } = require('node:child_process');
const { sha256Buffer, stableStringify } = require(
  __filename.endsWith('.ts')
    ? '../large-document-writer/receipts.ts'
    : '../large-document-writer/receipts'
);

export type GoalContractSemanticProviderTransportModule = never;

const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;

type SemanticProviderObservation = {
  responseBytes: Buffer;
  exitCode: number;
  status: number | null;
  completedAt: string;
};

function failure(failureClass, extra = {}) {
  return Object.assign(new Error(failureClass), { failureClass, ...extra });
}

function executableForPlatform(command) {
  return process.platform === 'win32' && /^(?:npm|npx|pnpm|yarn)$/iu.test(command)
    ? `${command}.cmd`
    : command;
}

function validateRoleResponse({ roleContract, requestHash, responseBytes }) {
  let response;
  try {
    response = JSON.parse(responseBytes.toString('utf8'));
  } catch {
    throw failure('semantic_provider_response_invalid');
  }
  if (
    response?.roleContract !== roleContract ||
    response?.requestHash !== requestHash ||
    typeof response?.sessionIdentity !== 'string' ||
    !response.sessionIdentity ||
    !response.result ||
    typeof response.result !== 'object' ||
    Array.isArray(response.result)
  ) {
    throw failure('semantic_provider_response_invalid');
  }
  return response;
}

function invokeControlledProcess(binding, requestBytes) {
  return new Promise<SemanticProviderObservation>((resolve, reject) => {
    const child = spawn(executableForPlatform(binding.provider.command), binding.provider.args, {
      cwd: binding.packageRoot,
      env: { ...process.env, ...binding.environment },
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const stdout = [];
    const stderr = [];
    let stdoutBytes = 0;
    const timer = setTimeout(() => {
      child.kill();
      reject(failure('semantic_provider_process_failed', { reason: 'timeout' }));
    }, binding.provider.timeoutMs || 120000);
    child.stdout.on('data', (chunk) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > MAX_RESPONSE_BYTES) child.kill();
      else stdout.push(chunk);
    });
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(failure('semantic_provider_process_failed', { cause: error.message }));
    });
    child.once('close', (exitCode) => {
      clearTimeout(timer);
      if (exitCode !== 0 || stdoutBytes > MAX_RESPONSE_BYTES) {
        reject(
          failure('semantic_provider_process_failed', {
            exitCode,
            stderr: Buffer.concat(stderr).toString('utf8').slice(0, 4000),
          })
        );
        return;
      }
      resolve({
        responseBytes: Buffer.concat(stdout),
        exitCode: 0,
        status: null,
        completedAt: new Date().toISOString(),
      });
    });
    child.stdin.end(requestBytes);
  });
}

function invokeControlledHttp(binding, requestBytes) {
  return new Promise<SemanticProviderObservation>((resolve, reject) => {
    const target = new URL(binding.providerUrl);
    const client = target.protocol === 'https:' ? https : http;
    const request = client.request(
      target,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': requestBytes.length,
        },
      },
      (response) => {
        const chunks = [];
        let size = 0;
        response.on('data', (chunk) => {
          size += chunk.length;
          if (size > MAX_RESPONSE_BYTES) request.destroy();
          else chunks.push(chunk);
        });
        response.on('end', () => {
          const status = response.statusCode || 0;
          if (status < 200 || status >= 300 || size > MAX_RESPONSE_BYTES) {
            reject(failure('semantic_provider_http_failed', { status }));
            return;
          }
          resolve({
            responseBytes: Buffer.concat(chunks),
            exitCode: 0,
            status,
            completedAt: new Date().toISOString(),
          });
        });
      }
    );
    request.setTimeout(binding.provider.timeoutMs, () => {
      request.destroy(failure('semantic_provider_http_failed', { reason: 'timeout' }));
    });
    request.once('error', (error) => {
      reject(
        error.failureClass
          ? error
          : failure('semantic_provider_http_failed', { cause: error.message })
      );
    });
    request.end(requestBytes);
  });
}

async function invokeSemanticProvider({ registryBinding, roleContract, request }) {
  const requestBytes = Buffer.from(stableStringify(request), 'utf8');
  const requestHash = sha256Buffer(requestBytes);
  const observed =
    registryBinding.provider.providerType === 'process'
      ? await invokeControlledProcess(registryBinding, requestBytes)
      : await invokeControlledHttp(registryBinding, requestBytes);
  const parsed = validateRoleResponse({
    roleContract,
    requestHash,
    responseBytes: observed.responseBytes,
  });
  return {
    result: parsed.result,
    responseBytes: observed.responseBytes,
    receipt: Object.freeze({
      schemaVersion: 'goal-contract-semantic-provider-invocation-receipt/v1',
      providerRegistryHash: registryBinding.registryHash,
      configuredProviderRef: registryBinding.providerRef,
      observedProviderIdentity: parsed.providerIdentity || null,
      observedModelIdentity: parsed.modelIdentity || null,
      roleContract,
      roleContractHash: request.roleContractHash,
      sessionIdentity: parsed.sessionIdentity,
      sourceSnapshotHash: request.sourceSnapshotHash,
      sourceObligationGraphHash: request.sourceObligationGraphHash,
      methodologyProfileHash: request.methodologyProfileHash,
      repositoryFactsHash: request.repositoryFactsHash,
      requestHash,
      responseHash: sha256Buffer(observed.responseBytes),
      transportType: registryBinding.provider.providerType,
      transportExitCode: observed.exitCode,
      transportStatus: observed.status,
      completedAt: observed.completedAt,
      reused: false,
    }),
  };
}

module.exports = {
  invokeSemanticProvider,
  validateRoleResponse,
};
