/* eslint-disable no-console */
import * as fs from 'node:fs';
import * as path from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

export type JsonObject = Record<string, unknown>;

export interface RequirementRecordSchemaValidationResult {
  ok: boolean;
  errorCount: number;
  errors: JsonObject[];
}

function readJson(file: string): JsonObject {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`JSON object expected: ${file}`);
  }
  return parsed as JsonObject;
}

function schemaPath(): string {
  return path.resolve(__dirname, '..', '_bmad', '_schemas', 'requirement-record.schema.json');
}

function compileValidator() {
  const schema = readJson(schemaPath());
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(schema);
}

export function validateRequirementRecordSchemaObject(
  record: JsonObject
): RequirementRecordSchemaValidationResult {
  const validate = compileValidator();
  const ok = validate(record);
  const errors = (validate.errors ?? []) as unknown as JsonObject[];
  return { ok, errorCount: errors.length, errors };
}

export function validateRequirementRecordSchema(
  recordPath: string
): RequirementRecordSchemaValidationResult {
  return validateRequirementRecordSchemaObject(readJson(recordPath));
}

function isDirectCli(entry: string | undefined): boolean {
  return /(^|[\\/])requirement-record-live-schema-gate(\.[cm]?js|\.ts)?$/iu.test(entry ?? '');
}

export function mainRequirementRecordLiveSchemaGate(argv: string[]): number {
  const recordArg = argv.find((arg) => !arg.startsWith('--'));
  const json = argv.includes('--json');
  if (!recordArg || argv.includes('--help') || argv.includes('-h')) {
    console.log('Usage: requirement-record-live-schema-gate <requirement-record.json> [--json]');
    return recordArg ? 0 : 2;
  }
  const recordPath = path.resolve(recordArg);
  const result = validateRequirementRecordSchema(recordPath);
  const output = {
    ok: result.ok,
    requirementRecordPath: recordPath.replace(/\\/gu, '/'),
    errorCount: result.errorCount,
    errors: result.errors.slice(0, 50),
  };
  process.stdout.write(
    json
      ? `${JSON.stringify(output, null, 2)}\n`
      : `requirement_record_schema=${result.ok ? 'pass' : 'fail'} errors=${result.errorCount}\n`
  );
  return result.ok ? 0 : 1;
}

if (require.main === module && isDirectCli(process.argv[1])) {
  try {
    process.exitCode = mainRequirementRecordLiveSchemaGate(process.argv.slice(2));
  } catch (error) {
    console.error(
      JSON.stringify(
        { ok: false, error: error instanceof Error ? error.message : String(error) },
        null,
        2
      )
    );
    process.exitCode = 2;
  }
}
