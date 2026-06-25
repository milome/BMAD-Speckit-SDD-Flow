import crypto from 'node:crypto';
import cp from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

interface Args {
  cwd: string;
  paths: string[];
  json: boolean;
}

interface GuardIssue {
  code: string;
  path?: string;
  message: string;
}

function parseArgs(argv: string[]): Args {
  const out: Args = { cwd: process.cwd(), paths: [], json: false };
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

function gitChangedDocsPlans(root: string): string[] {
  try {
    const output = cp.execFileSync(
      'git',
      ['diff', '--name-only', '--diff-filter=ACMRTUXB', '--', 'docs/plans/*.md'],
      { cwd: root, encoding: 'utf8' }
    );
    return output
      .split(/\r?\n/u)
      .map((value) => value.trim())
      .filter(Boolean);
  } catch {
    return [];
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
  const changed = gitChangedDocsPlans(args.cwd);
  const paths = Array.from(new Set([...changed, ...explicit]));
  const issues: GuardIssue[] = [];
  if (paths.length === 0) {
    issues.push({
      code: 'requirements_contract_source_write_path_required',
      message: 'No tracked docs/plans/*.md diff paths and no explicit --paths were provided.',
    });
  }
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
