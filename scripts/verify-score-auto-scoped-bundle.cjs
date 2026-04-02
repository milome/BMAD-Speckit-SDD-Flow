const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { scoreCommand } = require('../packages/bmad-speckit/src/commands/score.js');

async function main() {
  const root = process.cwd();
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'score-auto-bundle-verify-'));
  const reportPath = path.join(tempRoot, 'AUDIT_Story_15-2_stage4.md');
  const artifactDocPath =
    '_bmad-output/implementation-artifacts/epic-15-runtime-governance-and-i18n/story-2-i18n-bilingual-full-implementation/AUDIT_Story_15-2_stage4.md';

  fs.writeFileSync(
    reportPath,
    [
      'Implement 审计报告',
      '============',
      '',
      'Overall Grade: A',
      '',
      '## 可解析评分块（供 parseAndWriteScore）',
      '',
      '总体评级: A',
      '',
      '维度评分:',
      '- 功能性: 95/100',
      '- 代码质量: 92/100',
      '- 测试覆盖: 91/100',
      '- 安全性: 94/100',
      '',
      'Issue List:',
      '(none)',
      '',
    ].join('\n'),
    'utf8'
  );

  const capturedLogs = [];
  const originalLog = console.log;
  console.log = (...args) => {
    capturedLogs.push(args.join(' '));
  };

  try {
    await scoreCommand({
      reportPath,
      stage: 'implement',
      runId: 'dev-e15-s2-implement-post-audit-check',
      scenario: 'real_dev',
      event: 'post_audit_passed',
      writeMode: 'single_file',
      dataPath: 'packages/scoring/data',
      artifactDocPath,
      skipTriggerCheck: true,
    });
  } finally {
    console.log = originalLog;
  }

  const scoreOutput = capturedLogs.join('\n');

  const bundleLine = scoreOutput
    .split(/\r?\n/)
    .find((line) => line.includes('sft-bundle: wrote scoped bundle'));
  if (!bundleLine) {
    throw new Error(`scoped bundle line missing\n${scoreOutput}`);
  }

  const bundleId = bundleLine.trim().split(' ').pop();
  const manifestPath = path.join(root, '_bmad-output', 'datasets', bundleId, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const response = await fetch(
    'http://127.0.0.1:43123/api/snapshot?board_group_id=epic:epic-15-runtime-governance-and-i18n&work_item_id=story:2-i18n-bilingual-full-implementation'
  );
  if (!response.ok) {
    throw new Error(`dashboard snapshot request failed: ${response.status}`);
  }
  const snapshot = await response.json();

  const requiredScope = {
    scope_type: 'story',
    epic_id: 'epic-15-runtime-governance-and-i18n',
    story_key: '2-i18n-bilingual-full-implementation',
    work_item_id: 'story:2-i18n-bilingual-full-implementation',
    board_group_id: 'epic:epic-15-runtime-governance-and-i18n',
  };

  for (const [key, value] of Object.entries(requiredScope)) {
    if (manifest.source_scope?.[key] !== value) {
      throw new Error(`manifest source_scope mismatch for ${key}: expected ${value}, got ${manifest.source_scope?.[key]}`);
    }
    if (snapshot.sft_summary?.last_bundle?.source_scope?.[key] !== value) {
      throw new Error(`dashboard last_bundle source_scope mismatch for ${key}: expected ${value}, got ${snapshot.sft_summary?.last_bundle?.source_scope?.[key]}`);
    }
  }

  if (snapshot.sft_summary?.last_bundle?.bundle_id !== bundleId) {
    throw new Error(`dashboard last_bundle bundle_id mismatch: expected ${bundleId}, got ${snapshot.sft_summary?.last_bundle?.bundle_id}`);
  }

  console.log(
    JSON.stringify(
      {
        score_output: scoreOutput.trim(),
        bundle_id: bundleId,
        manifest_path: manifestPath,
        manifest_source_scope: manifest.source_scope,
        dashboard_last_bundle: snapshot.sft_summary.last_bundle,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
