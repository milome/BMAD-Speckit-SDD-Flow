import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

type JsonRecord = Record<string, unknown>;

export interface DeterministicJudgeProvider {
  baseUrl: string;
  requests: JsonRecord[];
  close(): Promise<void>;
}

export interface DeterministicJudgeProviderOptions {
  verdict?: 'pass' | 'fail';
}

function readJson(request: IncomingMessage): Promise<JsonRecord> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    request.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) as JsonRecord);
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });
}

function requiredStrings(value: unknown, label: string): string[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((item) => typeof item !== 'string')
  ) {
    throw new Error(`deterministic_provider_${label}_invalid`);
  }
  return value;
}

function validateRequest(body: JsonRecord): JsonRecord {
  if (
    body.model !== 'deterministic-requirements-judge' ||
    (body.response_format as JsonRecord | undefined)?.type !== 'json_object'
  ) {
    throw new Error('deterministic_provider_transport_request_invalid');
  }
  if (!Array.isArray(body.messages) || body.messages.length !== 2) {
    throw new Error('deterministic_provider_messages_invalid');
  }
  const system = body.messages[0] as JsonRecord;
  const user = body.messages[1] as JsonRecord;
  if (
    system?.role !== 'system' ||
    typeof system.content !== 'string' ||
    system.content.length === 0
  ) {
    throw new Error('deterministic_provider_system_prompt_missing');
  }
  if (user?.role !== 'user' || typeof user.content !== 'string') {
    throw new Error('deterministic_provider_user_request_missing');
  }
  const request = JSON.parse(user.content) as JsonRecord;
  if (
    request.schemaVersion !== 'requirements-contract-judge-request/v2' ||
    typeof request.judgeRequestHash !== 'string' ||
    ((request.prompt as JsonRecord | undefined)?.structuredOutputSchema as
      | JsonRecord
      | undefined)?.$id !==
      'requirements-contract-judge-response.schema.json'
  ) {
    throw new Error('deterministic_provider_frozen_request_invalid');
  }
  const packetBody = (request.auditPacket as JsonRecord | undefined)?.body as
    | JsonRecord
    | undefined;
  const dimensions = requiredStrings(packetBody?.mandatoryDimensionIds, 'dimensions');
  const artifacts = requiredStrings(packetBody?.artifactIds, 'artifacts');
  const musts = requiredStrings(packetBody?.requirementIds, 'musts');
  const manifestIds = requiredStrings(
    Array.isArray(request.auditPacketArtifactManifest)
      ? request.auditPacketArtifactManifest.map(
          (entry) => (entry as JsonRecord).artifactId
        )
      : undefined,
    'artifact_manifest'
  );
  if (artifacts.some((artifactId) => !manifestIds.includes(artifactId))) {
    throw new Error('deterministic_provider_artifact_coverage_gap');
  }
  return { request, dimensions, artifacts, musts };
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}

export async function startOpenAICompatibleJudgeProvider(
  options: DeterministicJudgeProviderOptions = {}
): Promise<DeterministicJudgeProvider> {
  const requests: JsonRecord[] = [];
  let ordinal = 0;
  const server = createServer(async (incoming, response) => {
    try {
      if (incoming.method !== 'POST' || incoming.url !== '/chat/completions') {
        sendJson(response, 404, { error: 'not_found' });
        return;
      }
      if (incoming.headers.authorization !== 'Bearer deterministic-e2e-secret') {
        sendJson(response, 401, { error: 'unauthorized' });
        return;
      }
      const validated = validateRequest(await readJson(incoming));
      requests.push(validated.request);
      ordinal += 1;
      const finding = {
        findingId: 'F-PROJECTION-NO-DELTA-001',
        severity: 'Major',
        summary: 'The frozen requirement is not represented in the final projection.',
        affectedMustRefs: [validated.musts[0]],
        affectedArtifactRefs: [validated.artifacts[0]],
        logicalEvidenceRefs: [`EVIDENCE-CLAIM-${validated.musts[0]}`],
      };
      const failed = options.verdict === 'fail';
      const judgeResponse = {
        schemaVersion: 'requirements-contract-judge-response/v2',
        judgeRequestHash: validated.request.judgeRequestHash,
        verdict: failed ? 'fail' : 'pass',
        findings: failed ? [finding] : [],
        advisoryObservations: [],
        checkedDimensionIds: validated.dimensions,
        dimensionResults: validated.dimensions.map((dimensionId: string) => ({
          dimensionId,
          decision: failed ? 'fail' : 'pass',
          findingRefs: failed ? [finding.findingId] : [],
        })),
        reviewedArtifactRefs: validated.artifacts,
        reviewedMustRefs: validated.musts,
        insufficientAuditReasons: [],
      };
      sendJson(response, 200, {
        id: `deterministic-requirements-${ordinal}-${validated.request.judgeRequestHash.slice(-12)}`,
        model: 'deterministic-requirements-judge',
        choices: [
          {
            finish_reason: 'stop',
            message: { role: 'assistant', content: JSON.stringify(judgeResponse) },
          },
        ],
      });
    } catch (error) {
      sendJson(response, 400, {
        error: error instanceof Error ? error.message : 'deterministic_provider_invalid_request',
      });
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('deterministic_provider_address_invalid');
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    requests,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
