import { createHash } from 'node:crypto';
import Ajv2020 from 'ajv/dist/2020.js';

type JsonRecord = Record<string, unknown>;
const WIRE_VERSION = 'requirements-contract-judge-json-response-envelope/v1';

function object(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

// Codex strict schemas cannot express native open advisory records or uniqueItems.
// Keep the native schema intact and validate it after lossless transport decoding.
export function createRequirementsJudgeJsonResponseEnvelope(schema: unknown) {
  if (!object(schema) || schema.$id !== 'requirements-contract-judge-response.schema.json') return null;
  const properties = object(schema.properties) ? schema.properties : {};
  if (!object(properties.schemaVersion) || properties.schemaVersion.const !== 'requirements-contract-judge-response/v2') {
    throw new Error('judge_json_response_envelope_native_version_unsupported');
  }
  const nativeSchemaJson = JSON.stringify(schema);
  const nativeSchemaHash = `sha256:${createHash('sha256').update(nativeSchemaJson).digest('hex')}`;
  const validateNative = new Ajv2020({ strict: false, allErrors: true }).compile(JSON.parse(nativeSchemaJson));
  const wireSchema = { type: 'object', additionalProperties: false,
    required: ['schemaVersion', 'nativeSchemaHash', 'responseJson'], properties: {
      schemaVersion: { type: 'string', const: WIRE_VERSION },
      nativeSchemaHash: { type: 'string', const: nativeSchemaHash },
      responseJson: { type: 'string' },
    } };
  const instruction = [
    'Transport serialization only: preserve the complete native Requirements response and all its fields.',
    `Return ${WIRE_VERSION} with nativeSchemaHash ${nativeSchemaHash}.`,
    'responseJson must contain the complete native JSON object serialized as a JSON string, not a summary.',
    'The native authority and required output rules still apply to the decoded object; no fields may be removed.',
    '<native-judge-response-schema-json>', nativeSchemaJson, '</native-judge-response-schema-json>',
  ].join('\n');
  function decode(value: unknown): JsonRecord {
    if (!object(value) || Object.keys(value).sort().join(',') !== 'nativeSchemaHash,responseJson,schemaVersion' ||
        value.schemaVersion !== WIRE_VERSION || value.nativeSchemaHash !== nativeSchemaHash ||
        typeof value.responseJson !== 'string') throw new Error('judge_json_response_envelope_invalid');
    let decoded: unknown;
    try { decoded = JSON.parse(value.responseJson); }
    catch { throw new Error('judge_json_response_envelope_json_invalid'); }
    if (!object(decoded) || !validateNative(decoded)) throw new Error('judge_json_response_envelope_native_invalid');
    return decoded;
  }
  return { wireSchema, instruction, nativeSchemaHash, decode };
}
