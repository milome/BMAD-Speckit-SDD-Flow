/**
 * Story 3.2 验收脚本
 * 必须 import parseAuditReport、writeScoreRecordSync，对 stage=prd/arch/story 各调用一次
 */
import * as path from 'path';
import * as fs from 'fs';
import { parseAuditReport } from '../packages/scoring/parsers';
import { writeScoreRecordSync } from '../packages/scoring/writer';

const FIXTURES = path.join(process.cwd(), 'packages', 'scoring', 'parsers', '__tests__', 'fixtures');
const TEMP_OUT = path.join(process.cwd(), '_bmad-output', 'implementation-artifacts', '3-2-eval-layer1-3-parser', 'accept-e3-s2-out');

async function main() {
  console.log('Accept E3-S2: parseAuditReport + writeScoreRecordSync');

  const stages: Array<'prd' | 'arch' | 'story'> = ['prd', 'arch', 'story'];
  const fixtureFiles = [
    path.join(FIXTURES, 'sample-prd-report.md'),
    path.join(FIXTURES, 'sample-arch-report.md'),
    path.join(FIXTURES, 'sample-story-report.md'),
  ];

  let passed = 0;
  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    const content = fs.readFileSync(fixtureFiles[i], 'utf-8');
    const runId = `accept-e3-s2-${stage}-${Date.now()}`;

    const record = await parseAuditReport({
      content,
      stage,
      runId,
      scenario: 'real_dev',
    });

    writeScoreRecordSync(record, 'single_file', { dataPath: TEMP_OUT });

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
    console.log('ACCEPT-E3-S2: PASS (all 3 stages)');
    process.exit(0);
  } else {
    console.error(`ACCEPT-E3-S2: FAIL (${passed}/3)`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
