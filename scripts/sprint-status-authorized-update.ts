import fs from 'node:fs';
import path from 'node:path';

type ReleaseGateReport = {
  critical_failures: number;
  blocked_sprint_status_update: boolean;
};

type UpdateInput = {
  storyKey: string;
  status: string;
  releaseGateReportPath: string;
  token: string;
  auditPath?: string;
};

const TOKEN_PREFIX = 'release-gate:pass:';

function parseArgs(argv: string[]): Partial<UpdateInput> {
  const out: Partial<UpdateInput> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const value = argv[index + 1];
    if (token === '--storyKey' && value) {
      out.storyKey = value;
      index += 1;
    } else if (token === '--status' && value) {
      out.status = value;
      index += 1;
    } else if (token === '--releaseGateReportPath' && value) {
      out.releaseGateReportPath = value;
      index += 1;
    } else if (token === '--token' && value) {
      out.token = value;
      index += 1;
    } else if (token === '--auditPath' && value) {
      out.auditPath = value;
      index += 1;
    }
  }
  return out;
}

function requireInput(input: Partial<UpdateInput>): UpdateInput {
  for (const key of ['storyKey', 'status', 'releaseGateReportPath', 'token'] as const) {
    if (!input[key]) {
      throw new Error(`missing required argument: --${key}`);
    }
  }
  return input as UpdateInput;
}

function readReleaseGateReport(root: string, reportPath: string): ReleaseGateReport {
  const fullPath = path.isAbsolute(reportPath) ? reportPath : path.resolve(root, reportPath);
  return JSON.parse(fs.readFileSync(fullPath, 'utf8')) as ReleaseGateReport;
}

function assertAuthorized(root: string, input: UpdateInput): void {
  if (!input.token.startsWith(TOKEN_PREFIX)) {
    throw new Error('sprint-status update denied: invalid release token');
  }
  const report = readReleaseGateReport(root, input.releaseGateReportPath);
  if (report.critical_failures !== 0 || report.blocked_sprint_status_update) {
    throw new Error('sprint-status update denied: release gate did not pass');
  }
}

function sprintStatusPath(root: string): string {
  return path.join(root, '_bmad-output', 'implementation-artifacts', 'sprint-status.yaml');
}

function updateSprintStatus(root: string, input: UpdateInput): string {
  const target = sprintStatusPath(root);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const existing = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : 'development_status:\n';
  const line = `  ${input.storyKey}: ${input.status}`;
  const next = existing.includes(`${input.storyKey}:`)
    ? existing.replace(new RegExp(`^\\s*${input.storyKey}:.*$`, 'm'), line)
    : `${existing.replace(/\s*$/, '\n')}${line}\n`;
  fs.writeFileSync(target, next, 'utf8');
  return target;
}

function writeAudit(root: string, input: UpdateInput, targetPath: string): void {
  const auditPath =
    input.auditPath ??
    path.join(root, '_bmad-output', 'runtime', 'governance', 'sprint-status-update-audit.json');
  fs.mkdirSync(path.dirname(auditPath), { recursive: true });
  fs.writeFileSync(
    auditPath,
    `${JSON.stringify(
      {
        storyKey: input.storyKey,
        status: input.status,
        targetPath,
        token: input.token,
        updatedAt: new Date().toISOString(),
      },
      null,
      2
    )}\n`,
    'utf8'
  );
}

export function runSprintStatusAuthorizedUpdate(root: string, input: UpdateInput): {
  updated: true;
  sprintStatusPath: string;
} {
  assertAuthorized(root, input);
  const targetPath = updateSprintStatus(root, input);
  writeAudit(root, input, targetPath);
  return { updated: true, sprintStatusPath: targetPath };
}

function main(): number {
  try {
    const input = requireInput(parseArgs(process.argv.slice(2)));
    const result = runSprintStatusAuthorizedUpdate(process.cwd(), input);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (require.main === module) {
  process.exit(main());
}
