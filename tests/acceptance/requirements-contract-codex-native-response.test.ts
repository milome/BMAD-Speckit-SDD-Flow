import { readFileSync, mkdtempSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCodexCliJudgeAdapter } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-codex-cli-judge-adapter';
import { createRequirementsJudgeJsonResponseEnvelope } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-json-response-envelope';

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));
const schema = JSON.parse(readFileSync(path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-judge-response.schema.json'), 'utf8'));

function fixture() {
    const root = mkdtempSync(path.join(os.tmpdir(), 'test-only-native-response-'));
    roots.push(root);
    const executeCommand = vi.fn();
    const readCredentialSecret = vi.fn();
    const adapter = createCodexCliJudgeAdapter({ executeCommand, readCredentialSecret });
    const request = { judgeRequestHash: `sha256:${'a'.repeat(64)}` };
    const input = { providerRef: 'test-only-provider',
      credential: { providerRef: 'test-only-provider', credentialRef: 'test-only-secret',
        authenticationType: 'bearer', credentialRevision: 1 },
      provider: { transport: 'cli', apiStyle: 'cli', adapterRef: 'CodexCliJudgeAdapter', model: null,
        credentialRef: 'test-only-secret',
        endpoint: { command: 'codex', baseUrl: 'https://test-only.invalid', resolutionMode: 'path_search',
          routingOwnership: 'transport_adapter', upstreamVersioning: 'gateway_managed', explicitOperationPath: null },
        authentication: { type: 'bearer', sensitivity: 'secret', arbitraryNonEmptyValueAllowed: false },
        auditPolicy: { blindReview: true, allowPassAuthority: false, toolsAllowed: true,
          allowedTools: ['Read'], implementationWritesAllowed: false },
        requestPolicy: { timeoutMs: 1000, maximumAttempts: 1, transportByteLimit: 1048576 } },
      payload: { systemPrompt: 'Return the complete native Requirements response.', request,
        structuredOutputSchema: schema,
        executionContext: { projectRoot: root, requestPath: 'request.json', outputDir: 'transport',
          requestFileContent: `${JSON.stringify(request)}\n` } } };
    return { root, input, adapter, executeCommand, readCredentialSecret };
}

function nativeResponse() {
  return { schemaVersion: 'requirements-contract-judge-response/v2', judgeRequestHash: `sha256:${'a'.repeat(64)}`,
    verdict: 'fail', findings: [], advisoryObservations: [{ customField: '\u4e2d\u6587\ud83d\ude00',
      arbitraryNestedRecord: { values: [false, 5, null, '"\\\n'] } }],
    checkedDimensionIds: ['DIM-1'], dimensionResults: [{ dimensionId: 'DIM-1', decision: 'insufficient', findingRefs: [] }],
    reviewedArtifactRefs: ['ART-1'], reviewedMustRefs: ['MUST-1'], insufficientAuditReasons: ['Test-only insufficient evidence.'] };
}

describe('official native Requirements response through Codex, test-only without Judge', () => {
  it('preflights the complete official schema without weakening open advisory records or unique refs', () => {
    const { root, input, adapter, executeCommand, readCredentialSecret } = fixture();
    const before = JSON.stringify(schema);
    const result = adapter.preflight(input);
    expect(result.totalBytes).toBeLessThanOrEqual(1048576);
    expect(result.serializedPayloadBytes).toBeGreaterThan(Buffer.byteLength(before));
    expect(JSON.stringify(schema)).toBe(before);
    expect(readdirSync(root)).toEqual([]);
    expect(executeCommand).not.toHaveBeenCalled();
    expect(readCredentialSecret).not.toHaveBeenCalled();
  });

  it('restores every native field, including open advisory objects, deterministically', () => {
    const envelope = createRequirementsJudgeJsonResponseEnvelope(schema)!;
    const response = nativeResponse();
    const value = { schemaVersion: envelope.wireSchema.properties.schemaVersion.const,
      nativeSchemaHash: envelope.nativeSchemaHash, responseJson: JSON.stringify(response) };
    expect(envelope.decode(value)).toEqual(response);
    expect(createRequirementsJudgeJsonResponseEnvelope(structuredClone(schema))!.nativeSchemaHash).toBe(envelope.nativeSchemaHash);
    expect(envelope.instruction).toContain(JSON.stringify(schema));
  });

  it.each(['version', 'schema-hash', 'raw-native', 'json', 'duplicate-refs', 'missing-field', 'extra-field', 'verdict'])(
    'rejects %s without accepting a weakened native response', (damage) => {
      const envelope = createRequirementsJudgeJsonResponseEnvelope(schema)!;
      const response: Record<string, unknown> = nativeResponse();
      const value = { schemaVersion: envelope.wireSchema.properties.schemaVersion.const,
        nativeSchemaHash: envelope.nativeSchemaHash, responseJson: JSON.stringify(response) };
      if (damage === 'version') value.schemaVersion = 'unknown/v999';
      if (damage === 'schema-hash') value.nativeSchemaHash = `sha256:${'0'.repeat(64)}`;
      if (damage === 'duplicate-refs') response.reviewedMustRefs = ['MUST-1', 'MUST-1'];
      if (damage === 'missing-field') delete response.advisoryObservations;
      if (damage === 'extra-field') response.unapprovedAuthority = 'pass';
      if (damage === 'verdict') response.verdict = 'unconditional-pass';
      value.responseJson = damage === 'json' ? '{' : JSON.stringify(response);
      expect(() => envelope.decode(damage === 'raw-native' ? response : value)).toThrow('judge_json_response_envelope_');
    });

  it.each(['valid', 'duplicate-refs', 'wire-hash'])(
    'uses the wire schema in the injected transport and validates %s before a decision receipt', async (variant) => {
    const test = fixture();
    const response = nativeResponse();
    if (variant === 'duplicate-refs') response.reviewedMustRefs = ['MUST-1', 'MUST-1'];
    test.readCredentialSecret.mockReturnValue('test-only-secret-never-real');
    writeFileSync(path.join(test.root, 'request.json'), test.input.payload.executionContext.requestFileContent, 'utf8');
    test.executeCommand.mockImplementation(async (invocation) => {
      const outputSchema = JSON.parse(readFileSync(path.resolve(invocation.cwd,
        invocation.args[invocation.args.indexOf('--output-schema') + 1]), 'utf8'));
      expect(outputSchema.additionalProperties).toBe(false);
      expect(invocation.stdin).toContain(JSON.stringify(schema));
      writeFileSync(invocation.outputPath, JSON.stringify({
        schemaVersion: outputSchema.properties.schemaVersion.const,
        nativeSchemaHash: variant === 'wire-hash' ? `sha256:${'0'.repeat(64)}` : outputSchema.properties.nativeSchemaHash.const,
        responseJson: JSON.stringify(response),
      }), 'utf8');
      return { exitCode: 0, stdout: '{"type":"thread.started","thread_id":"test-only-native-response"}\n', stderr: '' };
    });
    if (variant !== 'valid') {
      await expect(test.adapter.judge(test.input)).rejects.toThrow('judge_json_response_envelope_');
      expect(test.executeCommand).toHaveBeenCalledOnce();
      expect(existsSync(path.join(test.root, 'transport/judge-invocation-receipt.json'))).toBe(false);
      return;
    }
    expect(await test.adapter.judge(test.input)).toEqual(response);
    expect(test.executeCommand).toHaveBeenCalledOnce();
    const receipt = JSON.parse(readFileSync(path.join(test.root, 'transport/judge-invocation-receipt.json'), 'utf8'));
    expect(receipt.decision).toBe('block');
  });
});
