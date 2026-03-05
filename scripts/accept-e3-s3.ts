/**
 * Story 3.3 验收脚本
 * 对 prd/arch/story 各调用 parseAndWriteScore 一次，校验 scoring/data 产出
 */
import * as path from 'path';
import * as fs from 'fs';
import { parseAndWriteScore } from '../scoring/orchestrator';

const FIXTURES = path.join(process.cwd(), 'scoring', 'parsers', '__tests__', 'fixtures');
const TEMP_OUT = path.join(process.cwd(), '_bmad-output', 'implementation-artifacts', '3-3-eval-skill-scoring-write', 'accept-e3-s3-out');

async function main() {
  console.log('Accept E3-S3: parseAndWriteScore (prd/arch/story)');

  const stages: Array<'prd' | 'arch' | 'story'> = ['prd', 'arch', 'story'];
  const fixtureFiles = [
    path.join(FIXTURES, 'sample-prd-report.md'),
    path.join(FIXTURES, 'sample-arch-report.md'),
    path.join(FIXTURES, 'sample-story-report.md'),
  ];

  let passed = 0;
  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    const reportPath = fixtureFiles[i];
    const runId = `accept-e3-s3-${stage}-${Date.now()}`;

    await parseAndWriteScore({
      reportPath,
      stage,
      runId,
      scenario: 'real_dev',
      writeMode: 'single_file',
      dataPath: TEMP_OUT,
    });

    const filePath = path.join(TEMP_OUT, `${runId}.json`);
    if (fs.existsSync(filePath)) {
      const written = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (written.run_id === runId && written.stage === stage) {
        passed++;
        console.log(`  [PASS] stage=${stage}`);
      } else {
        console.error(`  [FAIL] stage=${stage} - written data mismatch`);
      }
    } else {
      console.error(`  [FAIL] stage=${stage} - file not written`);
    }
  }

  if (passed === 3) {
    console.log('ACCEPT-E3-S3: PASS (all 3 stages)');
    process.exit(0);
  } else {
    console.error(`ACCEPT-E3-S3: FAIL (${passed}/3)`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
