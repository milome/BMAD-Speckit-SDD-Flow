import { createServer, type Server } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

function coverageRefs(value: unknown): string[] | null {
  if (typeof value === 'string') {
    const marker = '"requiredCoverageRefs"';
    const markerIndex = value.indexOf(marker);
    if (markerIndex < 0) return null;
    const start = value.indexOf('[', markerIndex + marker.length);
    const end = value.indexOf(']', start + 1);
    if (start < 0 || end < 0) return null;
    try {
      const parsed = JSON.parse(value.slice(start, end + 1));
      return Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')
        ? parsed
        : null;
    } catch {
      return null;
    }
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = coverageRefs(item);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value as Record<string, unknown>)) {
      const found = coverageRefs(item);
      if (found) return found;
    }
  }
  return null;
}

export interface StandaloneGoalJudgeHttpFixture {
  requests: number;
  close(): Promise<void>;
}

export async function materializeStandaloneGoalJudgeHttpFixture(
  projectRoot: string
): Promise<StandaloneGoalJudgeHttpFixture> {
  const providerRef = 'standalone-goal-local-judge';
  const token = 'standalone-goal-test-token';
  let requests = 0;
  const server: Server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    request.on('end', () => {
      if (
        request.url !== '/chat/completions' ||
        request.headers.authorization !== `Bearer ${token}`
      ) {
        response.statusCode = 400;
        response.end('invalid_request');
        return;
      }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
      const evidenceRefs = coverageRefs(body);
      if (!evidenceRefs || evidenceRefs.length === 0) {
        response.statusCode = 422;
        response.end('coverage_refs_missing');
        return;
      }
      requests += 1;
      response.setHeader('content-type', 'application/json');
      response.end(
        JSON.stringify({
          model: 'standalone-goal-judge-requested-model',
          id: `standalone-goal-judge-request-${requests}`,
          choices: [
            {
              finish_reason: 'stop',
              message: {
                content: JSON.stringify({
                  decision: 'pass',
                  findings: [],
                  challengeRequests: [],
                  evidenceRefs,
                }),
              },
            },
          ],
        })
      );
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('judge_fixture_address_missing');

  mkdirSync(path.join(projectRoot, '_bmad', '_config'), { recursive: true });
  mkdirSync(path.join(projectRoot, '_bmad-output', 'config', 'private'), { recursive: true });
  writeFileSync(
    path.join(projectRoot, '_bmad', '_config', 'governance-remediation.yaml'),
    [
      'judgeRuntime:',
      '  schemaVersion: requirements-contract-judge-runtime/v1',
      '  enabled: true',
      `  activeProviderRef: ${providerRef}`,
      '  selectionPolicy:',
      '    mode: contract_locked',
      '    runtimeFallbackAllowed: false',
      '    runtimeAutoDiscoveryAllowed: false',
      '    environmentOverrideAllowed: false',
      '    cliTransportAllowed: false',
      '    selectionReceiptRequired: true',
      '  credentialConfig:',
      '    source: config_file',
      '    path: _bmad-output/config/private/judge-provider.credentials.yaml',
      '    schemaVersion: requirements-contract-judge-credentials/v1',
      '    allowedRoot: _bmad-output/config/private',
      '    environmentFallbackAllowed: false',
      '  providers:',
      `    ${providerRef}:`,
      '      enabled: true',
      '      transport: openai-compatible',
      '      apiStyle: chat_completions',
      '      model: standalone-goal-judge-requested-model',
      `      credentialRef: ${providerRef}`,
      '      endpoint:',
      `        baseUrl: "http://127.0.0.1:${address.port}"`,
      '        resolutionMode: transport_managed',
      '        routingOwnership: transport_adapter',
      '        upstreamVersioning: gateway_managed',
      '        explicitOperationPath: null',
      '      authentication:',
      '        type: bearer',
      '        sensitivity: secret',
      '        arbitraryNonEmptyValueAllowed: false',
      '      auditPolicy:',
      '        independenceClass: different_provider_different_model',
      '        blindReview: true',
      '        allowPassAuthority: false',
      '        toolsAllowed: false',
      '        implementationWritesAllowed: false',
      '      requestPolicy:',
      '        timeoutMs: 10000',
      '        maximumAttempts: 1',
      '        structuredResponseRequired: true',
      '',
    ].join('\n'),
    'utf8'
  );
  writeFileSync(
    path.join(projectRoot, '_bmad-output', 'config', 'private', 'judge-provider.credentials.yaml'),
    [
      'schemaVersion: requirements-contract-judge-credentials/v1',
      'credentialRevision: 1',
      'providers:',
      `  ${providerRef}:`,
      '    authenticationType: bearer',
      `    apiKey: ${token}`,
      '',
    ].join('\n'),
    'utf8'
  );

  return {
    get requests() {
      return requests;
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
