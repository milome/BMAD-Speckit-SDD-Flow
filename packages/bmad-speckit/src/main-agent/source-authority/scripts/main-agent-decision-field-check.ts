/* eslint-disable no-console */
import * as fs from 'node:fs';
import * as path from 'node:path';

type JsonObject = Record<string, unknown>;

interface ParsedArgs {
  requirementRecord?: string;
  reportPath?: string;
  target?: string;
  json?: boolean;
  help?: boolean;
}

const VALID_DECISIONS = new Set(['pass', 'fail', 'blocked', 'not_applicable', 'skipped_by_policy']);

function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg === '--json') out.json = true;
    else if (arg.startsWith('--')) {
      const key = arg.slice(2).replace(/-([a-z])/gu, (_, letter: string) => letter.toUpperCase());
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      (out as Record<string, string | boolean | undefined>)[key] = value;
      index += 1;
    } else {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }
  }
  return out;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function objects(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is JsonObject =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item)
      )
    : [];
}

function readJson(file: string): JsonObject {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`JSON object expected: ${file}`);
  }
  return parsed as JsonObject;
}

function normalizePathForRecord(value: string): string {
  return value.replace(/\\/gu, '/');
}

function evaluateDecisionChecks(
  record: JsonObject,
  target: 'gateChecks' | 'contractChecks'
): { blockingReasons: string[]; checks: JsonObject[] } {
  const blockingReasons: string[] = [];
  const checks: JsonObject[] = [];
  const checkItems = objects(record[target]);
  const label = target === 'gateChecks' ? 'gate-checks' : 'contract-checks';
  const reasonPrefix = target === 'gateChecks' ? 'gate_check' : 'contract_check';
  const identityField = target === 'gateChecks' ? 'gate' : 'contract';
  checks.push({ id: `${label}-present`, passed: checkItems.length > 0, count: checkItems.length });
  for (const [index, item] of checkItems.entries()) {
    const itemId = text(item.checkId) || `${text(item[identityField]) || '<missing>'}:${index}`;
    if (Object.prototype.hasOwnProperty.call(item, 'result')) {
      blockingReasons.push(`${reasonPrefix}_result_forbidden:${itemId}`);
    }
    if (!VALID_DECISIONS.has(text(item.decision))) {
      blockingReasons.push(`${reasonPrefix}_decision_invalid:${itemId}`);
    }
  }
  checks.push({
    id: `${label}-decision-only`,
    passed: blockingReasons.length === 0,
    invalidCount: blockingReasons.length,
  });
  return { blockingReasons, checks };
}

export function mainDecisionFieldCheck(argv: string[]): number {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(
      'Usage: main-agent-decision-field-check --requirement-record <json> [--target gateChecks|contractChecks] [--json]'
    );
    return 0;
  }
  if (!args.requirementRecord) throw new Error('missing required args: requirementRecord');
  const target = args.target ?? 'gateChecks';
  if (target !== 'gateChecks' && target !== 'contractChecks')
    throw new Error(`unsupported target: ${target}`);
  const recordPath = path.resolve(args.requirementRecord);
  const record = readJson(recordPath);
  const evaluated = evaluateDecisionChecks(record, target);
  const decision = evaluated.blockingReasons.length === 0 ? 'pass' : 'blocked';
  const reportPath = path.resolve(
    args.reportPath ?? path.join(path.dirname(recordPath), 'decision-field-check.json')
  );
  const report = {
    reportType: 'decision_field_check',
    target,
    recordId: text(record.recordId),
    requirementSetId: text(record.requirementSetId),
    decision,
    blockingReasons: evaluated.blockingReasons,
    checks: evaluated.checks,
  };
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  const output = {
    ok: true,
    reportPath: normalizePathForRecord(reportPath),
    decision,
    blockingReasons: evaluated.blockingReasons,
  };
  process.stdout.write(
    args.json ? `${JSON.stringify(output, null, 2)}\n` : `decision_field=${decision}\n`
  );
  return decision === 'pass' ? 0 : 1;
}

if (require.main === module) {
  try {
    process.exitCode = mainDecisionFieldCheck(process.argv.slice(2));
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
