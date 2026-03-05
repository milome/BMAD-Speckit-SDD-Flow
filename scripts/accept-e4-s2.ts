/**
 * Story 4.2 验收脚本
 * 验证：
 * 1) coachDiagnose 能加载 run_id 并输出完整 schema
 * 2) 支持 JSON / Markdown 两种输出
 * 3) 禁止词校验通过/阻断样本符合 spec §2.7
 */
import {
  coachDiagnose,
  formatToMarkdown,
  loadForbiddenWords,
  validateForbiddenWords,
} from '../scoring/coach';

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      continue;
    }

    if (arg.includes('=')) {
      const idx = arg.indexOf('=');
      const key = arg.slice(2, idx);
      const value = arg.slice(idx + 1);
      args[key] = value;
      continue;
    }

    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next != null && !next.startsWith('--')) {
      args[key] = next;
      i++;
    }
  }
  return args;
}

function assertSchema(report: {
  summary: unknown;
  phase_scores: unknown;
  weak_areas: unknown;
  recommendations: unknown;
  iteration_passed: unknown;
}): void {
  if (typeof report.summary !== 'string') {
    throw new Error('schema error: summary must be string');
  }
  if (report.phase_scores == null || typeof report.phase_scores !== 'object') {
    throw new Error('schema error: phase_scores must be object');
  }
  if (!Array.isArray(report.weak_areas)) {
    throw new Error('schema error: weak_areas must be string[]');
  }
  if (!Array.isArray(report.recommendations)) {
    throw new Error('schema error: recommendations must be string[]');
  }
  if (typeof report.iteration_passed !== 'boolean') {
    throw new Error('schema error: iteration_passed must be boolean');
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const runId = args['run-id'] ?? args.runId ?? 'sample-run';
  const format = (args.format ?? 'json').toLowerCase();

  if (format !== 'json' && format !== 'markdown') {
    throw new Error(`invalid --format=${format}, expected json|markdown`);
  }

  const result = await coachDiagnose(runId);
  if ('error' in result) {
    throw new Error(`run_id not found: ${runId}`);
  }

  assertSchema(result);

  const words = loadForbiddenWords();
  const passCase = validateForbiddenWords(
    '本轮结论可用于对外能力说明等场景，建议补齐低分环节的验证用例。',
    words
  );
  if (!passCase.passed) {
    throw new Error(`forbidden pass-case should pass, got ${passCase.violations.join(',')}`);
  }

  const failCase = validateForbiddenWords('建议面试官围绕候选人表达继续追问。', words);
  if (failCase.passed) {
    throw new Error('forbidden fail-case should be blocked by dominant terms');
  }

  if (format === 'markdown') {
    const markdown = formatToMarkdown(result);
    if (!markdown.includes('## Summary') || !markdown.includes('## Iteration Passed')) {
      throw new Error('markdown output missing required sections');
    }
    console.log(markdown);
  } else {
    console.log(JSON.stringify(result, null, 2));
  }

  console.log('ACCEPT-E4-S2: PASS');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

