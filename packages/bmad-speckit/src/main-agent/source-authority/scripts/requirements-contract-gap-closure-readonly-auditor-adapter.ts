/* eslint-disable no-console */
import { spawnSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';

type JsonRecord = Record<string, unknown>;

export interface RequirementsContractGapClosureReadonlyAuditorAdapterOptions {
  cwd?: string;
  projectRoot: string;
  request: string;
  json?: boolean;
}

interface ParsedArgs {
  projectRoot?: string;
  request?: string;
  json?: boolean;
  help?: boolean;
}

function sha256(value: string | Buffer): string {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function fileHash(filePath: string): string {
  return sha256(fs.readFileSync(filePath));
}

function readJson(filePath: string): JsonRecord {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`gap_closure_auditor_adapter_json_invalid:${filePath}`);
  }
  return parsed as JsonRecord;
}

function schema(name: string): JsonRecord {
  return readJson(path.resolve(__dirname, '..', 'schemas', name));
}

function validateSchema(value: unknown, schemaName: string, code: string): void {
  const validate = new Ajv2020({
    allErrors: true,
    strict: false,
    validateFormats: false,
  }).compile(schema(schemaName));
  if (!validate(value)) {
    throw new Error(`${code}:${JSON.stringify(validate.errors ?? [])}`);
  }
}

function resolveWithin(root: string, value: string, code: string): string {
  const resolved = path.resolve(root, value);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(code);
  return resolved;
}

function resolveCodexCommand(): { command: string; prefixArgs: string[]; implementationPath: string } {
  const pathEntries = (process.env.PATH ?? process.env.Path ?? '')
    .split(path.delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);
  const visited = new Set<string>();
  for (const entry of pathEntries) {
    const resolvedEntry = path.resolve(entry);
    const identity = process.platform === 'win32'
      ? resolvedEntry.toLowerCase()
      : resolvedEntry;
    if (visited.has(identity)) continue;
    visited.add(identity);

    if (process.platform === 'win32') {
      const nativeExecutable = path.join(resolvedEntry, 'codex.exe');
      if (fs.existsSync(nativeExecutable) && fs.statSync(nativeExecutable).isFile()) {
        return {
          command: nativeExecutable,
          prefixArgs: [],
          implementationPath: nativeExecutable,
        };
      }
      const npmShim = path.join(resolvedEntry, 'codex.cmd');
      const javascriptEntry = path.join(
        resolvedEntry,
        'node_modules',
        '@openai',
        'codex',
        'bin',
        'codex.js'
      );
      if (
        fs.existsSync(npmShim) &&
        fs.existsSync(javascriptEntry) &&
        fs.statSync(javascriptEntry).isFile()
      ) {
        return {
          command: process.execPath,
          prefixArgs: [javascriptEntry],
          implementationPath: javascriptEntry,
        };
      }
      continue;
    }

    const executable = path.join(resolvedEntry, 'codex');
    if (fs.existsSync(executable) && fs.statSync(executable).isFile()) {
      return {
        command: executable,
        prefixArgs: [],
        implementationPath: executable,
      };
    }
  }
  throw new Error('gap_closure_auditor_adapter_codex_unavailable');
}

function writeUtf8(filePath: string, value: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
}

function parseProviderEvents(stdout: string): JsonRecord[] {
  const lines = stdout
    .split(/\r?\n/gu)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    throw new Error('gap_closure_auditor_adapter_provider_event_log_empty');
  }
  return lines.map((line) => {
    const parsed = JSON.parse(line) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('gap_closure_auditor_adapter_provider_event_invalid');
    }
    return parsed as JsonRecord;
  });
}

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--json') {
      args.json = true;
      continue;
    }
    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }
    if (!token.startsWith('--')) throw new Error(`unexpected positional argument: ${token}`);
    const key = token.slice(2).replace(/-([a-z])/gu, (_, letter: string) => letter.toUpperCase());
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`missing value for ${token}`);
    (args as Record<string, string | boolean | undefined>)[key] = value;
    index += 1;
  }
  return args;
}

function promptFor(requestPath: string): string {
  return [
    'Act as the independent readonly closure auditor for one software gap.',
    'Do not modify source, tests, configuration, receipts, evidence packets, or runtime state.',
    `Read the audit request at ${requestPath}.`,
    'Independently trace the public production entry to the implementation and run your own bounded verification commands.',
    'Check positive behavior, negative behavior, current hashes, producer receipts, hardcoded identities, result-injection seams, and clean materialization evidence.',
    'Return only the JSON object required by the output schema.',
    'Use decision FAIL when any required condition is unverified, missing, stale, replayed, or only asserted by the candidate.',
  ].join('\n');
}

export async function requirementsContractGapClosureReadonlyAuditorAdapterCommand(
  options: RequirementsContractGapClosureReadonlyAuditorAdapterOptions
): Promise<JsonRecord> {
  const root = path.resolve(options.projectRoot || options.cwd || process.cwd());
  const serializableInput = {
    projectRoot: root,
    request: options.request,
    json: Boolean(options.json),
  };
  validateSchema(
    serializableInput,
    'requirements-contract-gap-closure-readonly-auditor-adapter-input.schema.json',
    'gap_closure_auditor_adapter_input_invalid'
  );
  const requestPath = resolveWithin(
    root,
    options.request,
    'gap_closure_auditor_adapter_request_path_escape'
  );
  const request = readJson(requestPath);
  validateSchema(
    request,
    'requirements-contract-gap-closure-independent-audit-request.schema.json',
    'gap_closure_auditor_adapter_request_invalid'
  );

  const artifactRoot = path.dirname(requestPath);
  const rawResponsePath = path.join(artifactRoot, 'readonly-auditor-response.raw.json');
  const stdoutPath = path.join(artifactRoot, 'readonly-auditor-provider.stdout.jsonl');
  const stderrPath = path.join(artifactRoot, 'readonly-auditor-provider.stderr.log');
  if ([rawResponsePath, stdoutPath, stderrPath].some((filePath) => fs.existsSync(filePath))) {
    throw new Error('gap_closure_auditor_adapter_artifact_replay_forbidden');
  }
  const assessmentSchemaPath = path.resolve(
    __dirname,
    '..',
    'schemas',
    'requirements-contract-gap-closure-independent-audit-assessment.schema.json'
  );
  const transport = resolveCodexCommand();
  const startedAt = new Date().toISOString();
  const execution = spawnSync(
    transport.command,
    [
      ...transport.prefixArgs,
      'exec',
      '--sandbox',
      'read-only',
      '--ephemeral',
      '--skip-git-repo-check',
      '--output-schema',
      assessmentSchemaPath,
      '--output-last-message',
      rawResponsePath,
      '--json',
      '-C',
      root,
      '-',
    ],
    {
      cwd: root,
      encoding: 'utf8',
      input: promptFor(requestPath),
      shell: false,
      timeout: 120_000,
      maxBuffer: 5 * 1024 * 1024,
      windowsHide: true,
    }
  );
  const completedAt = new Date().toISOString();
  const stdout = execution.stdout ?? '';
  const stderr = `${execution.stderr ?? ''}${execution.error?.message ?? ''}`;
  writeUtf8(stdoutPath, stdout);
  writeUtf8(stderrPath, stderr);
  const exitCode = execution.status ?? (execution.error ? 1 : 0);
  if (exitCode !== 0 || !fs.existsSync(rawResponsePath)) {
    throw new Error(`gap_closure_auditor_adapter_provider_failed:${exitCode}`);
  }
  const providerEvents = parseProviderEvents(stdout);
  const assessment = readJson(rawResponsePath);
  validateSchema(
    assessment,
    'requirements-contract-gap-closure-independent-audit-assessment.schema.json',
    'gap_closure_auditor_adapter_assessment_invalid'
  );
  const providerInvocation = {
    transport: 'codex_cli',
    sandboxMode: 'read-only',
    ephemeral: true,
    implementationPath: transport.implementationPath.replace(/\\/gu, '/'),
    implementationHash: fileHash(transport.implementationPath),
    startedAt,
    completedAt,
    exitCode,
    stdoutPath: stdoutPath.replace(/\\/gu, '/'),
    stdoutHash: fileHash(stdoutPath),
    eventLogPath: stdoutPath.replace(/\\/gu, '/'),
    eventLogHash: fileHash(stdoutPath),
    eventCount: providerEvents.length,
    stderrPath: stderrPath.replace(/\\/gu, '/'),
    stderrHash: fileHash(stderrPath),
    rawResponsePath: rawResponsePath.replace(/\\/gu, '/'),
    rawResponseHash: fileHash(rawResponsePath),
  };
  const result = {
    schemaVersion: 'gap-closure-independent-audit-result/v1',
    requestHash: String(request.requestHash),
    gapId: String(request.gapId),
    candidateHash: String(request.candidateHash),
    auditorRole: 'readonly_independent_auditor',
    auditorRunId: `audit-run-${sha256(JSON.stringify(providerInvocation)).slice(-24)}`,
    decision: assessment.decision,
    findings: assessment.findings,
    verifiedConditions: assessment.verifiedConditions,
    verificationRuns: assessment.verificationRuns,
    rationale: assessment.rationale,
    providerInvocation,
  };
  validateSchema(
    result,
    'requirements-contract-gap-closure-independent-audit-result.schema.json',
    'gap_closure_auditor_adapter_result_invalid'
  );
  if (options.json) process.stdout.write(`${JSON.stringify(result)}\n`);
  return result;
}

export async function mainRequirementsContractGapClosureReadonlyAuditorAdapter(
  argv: string[]
): Promise<number> {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(
      'Usage: requirements-contract-gap-closure-readonly-auditor-adapter --project-root <path> --request <json> [--json]'
    );
    return 0;
  }
  if (!args.projectRoot || !args.request) {
    throw new Error('gap_closure_auditor_adapter_required_args_missing');
  }
  await requirementsContractGapClosureReadonlyAuditorAdapterCommand({
    cwd: args.projectRoot,
    projectRoot: args.projectRoot,
    request: args.request,
    json: Boolean(args.json),
  });
  return 0;
}

if (require.main === module) {
  mainRequirementsContractGapClosureReadonlyAuditorAdapter(process.argv.slice(2))
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error) => {
      console.error(
        JSON.stringify(
          { ok: false, error: error instanceof Error ? error.message : String(error) },
          null,
          2
        )
      );
      process.exitCode = 1;
    });
}
