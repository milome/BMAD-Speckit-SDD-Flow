import crypto from 'node:crypto';
import cp from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

interface Args {
  cwd: string;
  paths: string[];
  baseRef: string;
  json: boolean;
}

interface GuardIssue {
  code: string;
  path?: string;
  message: string;
}

function parseArgs(argv: string[]): Args {
  const out: Args = { cwd: process.cwd(), paths: [], baseRef: '', json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if ((token === '--cwd' || token === '--root') && argv[index + 1]) {
      out.cwd = path.resolve(argv[++index]);
    } else if (token === '--paths' && argv[index + 1]) {
      out.paths.push(
        ...argv[++index]
          .split(/[\r\n,;]+/u)
          .map((value) => value.trim())
          .filter(Boolean)
      );
    } else if (
      (token === '--base-ref' || token === '--baseRef' || token === '--compare-ref') &&
      argv[index + 1]
    ) {
      out.baseRef = argv[++index];
    } else if (token === '--json') {
      out.json = true;
    }
  }
  return out;
}

function sha256File(filePath: string): string {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

function toRootRelative(root: string, filePath: string): string {
  const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(root, filePath);
  const relative = path.relative(root, resolved);
  return (!relative.startsWith('..') && !path.isAbsolute(relative) ? relative : resolved).replace(
    /\\/g,
    '/'
  );
}

function splitGitPaths(output: string): string[] {
  return output
    .split(/\r?\n/u)
    .map((value) => value.trim())
    .filter(Boolean);
}

function gitOutput(root: string, args: string[]): string {
  return cp.execFileSync('git', args, { cwd: root, encoding: 'utf8' });
}

function gitRefExists(root: string, ref: string): boolean {
  try {
    gitOutput(root, ['rev-parse', '--verify', `${ref}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

function resolveBaseRef(root: string, baseRef: string): string {
  const normalized = baseRef.trim();
  if (!normalized) return '';
  const candidates = normalized.startsWith('origin/')
    ? [normalized]
    : [`origin/${normalized}`, `refs/remotes/origin/${normalized}`, normalized];
  return candidates.find((candidate) => gitRefExists(root, candidate)) ?? '';
}

function envBaseRef(): string {
  return (
    process.env.REQUIREMENTS_CONTRACT_SOURCE_WRITE_BASE ||
    process.env.GITHUB_BASE_REF ||
    ''
  );
}

function gitChangedDocsPlans(
  root: string,
  baseRef: string
): { paths: string[]; issues: GuardIssue[] } {
  const issues: GuardIssue[] = [];
  try {
    const requestedBase = baseRef.trim() || envBaseRef();
    const resolvedBase = requestedBase ? resolveBaseRef(root, requestedBase) : '';
    if (requestedBase && !resolvedBase) {
      return {
        paths: [],
        issues: [
          {
            code: 'requirements_contract_source_write_base_ref_missing',
            message: `Unable to resolve base ref for requirements contract source write guard: ${requestedBase}.`,
          },
        ],
      };
    }

    const changed = splitGitPaths(
      resolvedBase
        ? gitOutput(root, [
            'diff',
            '--name-only',
            '--diff-filter=ACMRTUXB',
            `${resolvedBase}...HEAD`,
            '--',
            'docs/plans/*.md',
          ])
        : gitOutput(root, [
            'diff',
            '--name-only',
            '--diff-filter=ACMRTUXB',
            'HEAD',
            '--',
            'docs/plans/*.md',
          ])
    );
    const untracked = resolvedBase
      ? []
      : splitGitPaths(
          gitOutput(root, ['ls-files', '--others', '--exclude-standard', '--', 'docs/plans/*.md'])
        );
    return { paths: Array.from(new Set([...changed, ...untracked])), issues };
  } catch {
    return { paths: [], issues };
  }
}

function nearestReceipt(root: string, targetPath: string): string {
  const targetRelative = toRootRelative(root, targetPath);
  const outputRoot = path.join(root, '_bmad-output', 'runtime', 'requirement-records');
  if (!fs.existsSync(outputRoot)) return '';
  const candidates: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (entry.isFile() && entry.name === 'promotion-receipt.json') {
        candidates.push(fullPath);
      }
    }
  };
  walk(outputRoot);
  for (const receiptPath of candidates) {
    try {
      const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8')) as Record<string, unknown>;
      if (String(receipt.targetPath ?? '').replace(/\\/g, '/') === targetRelative) {
        return receiptPath;
      }
    } catch {
      continue;
    }
  }
  return '';
}

function verifyPath(root: string, inputPath: string): GuardIssue[] {
  const targetPath = path.isAbsolute(inputPath) ? inputPath : path.resolve(root, inputPath);
  const targetRelative = toRootRelative(root, targetPath);
  const issues: GuardIssue[] = [];
  if (!/^docs\/plans\/.+\.md$/u.test(targetRelative)) {
    return issues;
  }
  if (!fs.existsSync(targetPath)) {
    issues.push({
      code: 'requirements_contract_source_write_target_missing',
      path: targetRelative,
      message: 'Changed docs/plans markdown target does not exist.',
    });
    return issues;
  }
  const text = fs.readFileSync(targetPath, 'utf8');
  if (!text.includes('implementationConfirmation:')) {
    return issues;
  }
  const receiptPath = nearestReceipt(root, targetPath);
  if (!receiptPath) {
    issues.push({
      code: 'requirements_contract_promotion_receipt_missing',
      path: targetRelative,
      message: 'Requirements contract source contains implementationConfirmation but has no matching promotion-receipt.json.',
    });
    return issues;
  }
  let receipt: Record<string, unknown>;
  try {
    receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8')) as Record<string, unknown>;
  } catch {
    issues.push({
      code: 'requirements_contract_promotion_receipt_invalid_json',
      path: targetRelative,
      message: 'Matching promotion-receipt.json is not valid JSON.',
    });
    return issues;
  }
  const targetHash = sha256File(targetPath);
  const gate = receipt.authoringPromotionGate as Record<string, unknown> | undefined;
  const checks: Array<[boolean, string, string]> = [
    [
      String(receipt.targetPath ?? '').replace(/\\/g, '/') === targetRelative,
      'requirements_contract_promotion_receipt_target_path_mismatch',
      'Promotion receipt targetPath does not match source document.',
    ],
    [
      String(receipt.targetHash ?? '') === targetHash,
      'requirements_contract_promotion_receipt_target_hash_stale',
      'Promotion receipt targetHash does not match current source document hash.',
    ],
    [
      receipt.promotionStage === 'authoring-draft',
      'requirements_contract_promotion_receipt_stage_invalid',
      'Promotion receipt promotionStage must equal authoring-draft.',
    ],
    [
      gate?.ok === true,
      'requirements_contract_promotion_receipt_authoring_gate_not_ok',
      'Promotion receipt authoringPromotionGate.ok must be true.',
    ],
  ];
  for (const [ok, code, message] of checks) {
    if (!ok) issues.push({ code, path: targetRelative, message });
  }
  return issues;
}

function main(): number {
  const args = parseArgs(process.argv.slice(2));
  const explicit = args.paths;
  const changedResult = gitChangedDocsPlans(args.cwd, args.baseRef);
  const changed = changedResult.paths;
  const paths = Array.from(new Set([...changed, ...explicit]));
  const issues: GuardIssue[] = [...changedResult.issues];
  for (const target of paths) {
    issues.push(...verifyPath(args.cwd, target));
  }
  const result = {
    ok: issues.length === 0,
    checkedPaths: paths.map((value) => toRootRelative(args.cwd, value)),
    issues,
  };
  if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else if (issues.length > 0) {
    process.stderr.write(`${issues.map((issue) => issue.code).join('\n')}\n`);
  } else {
    process.stdout.write('requirements contract source write guard ok\n');
  }
  return issues.length === 0 ? 0 : 1;
}

if (require.main === module) {
  process.exitCode = main();
}
