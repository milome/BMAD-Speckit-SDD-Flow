/**
 * Story 1.2 验收脚本：eval-system-storage-writer
 * 覆盖 AC-1～AC-7：单文件写入、JSONL 追加、三模式、check_items、目录创建、同 run_id 覆盖、schema 校验
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import {
  writeScoreRecordSync,
  type RunScoreRecord,
} from '../scoring/writer';

const validRecord: RunScoreRecord = {
  run_id: 'accept-e1-s2-run',
  scenario: 'real_dev',
  stage: 'implement',
  phase_score: 22,
  phase_weight: 0.25,
  check_items: [
    { item_id: 'func_correct', passed: true, score_delta: 0, note: '' },
  ],
  timestamp: new Date().toISOString(),
  iteration_count: 0,
  iteration_records: [],
  first_pass: true,
};

function main() {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'accept-e1-s2-'));
  const origEnv = process.env.SCORING_DATA_PATH;
  process.env.SCORING_DATA_PATH = testDir;

  try {
    const schemaPath = path.resolve(process.cwd(), 'scoring', 'schema', 'run-score-schema.json');
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
    const ajv = new Ajv();
    addFormats(ajv);
    const validate = ajv.compile(schema);

    // AC-1: 单条记录写入 JSON 文件，存在且内容一致
    writeScoreRecordSync(validRecord, 'single_file');
    const singlePath = path.join(testDir, `${validRecord.run_id}.json`);
    if (!fs.existsSync(singlePath)) {
      console.error('AC-1 FAIL: single file not created');
      process.exit(1);
    }
    const singleContent = JSON.parse(fs.readFileSync(singlePath, 'utf-8'));
    if (singleContent.run_id !== validRecord.run_id || singleContent.phase_score !== validRecord.phase_score) {
      console.error('AC-1 FAIL: content mismatch', singleContent);
      process.exit(1);
    }
    console.log('AC-1: single file write OK');

    // AC-2: JSONL 追加，行数递增、每行合法 JSON
    writeScoreRecordSync({ ...validRecord, run_id: 'r2' }, 'jsonl');
    writeScoreRecordSync({ ...validRecord, run_id: 'r3' }, 'jsonl');
    const jsonlPath = path.join(testDir, 'scores.jsonl');
    const lines = fs.readFileSync(jsonlPath, 'utf-8').trim().split('\n').filter(Boolean);
    if (lines.length !== 2) {
      console.error('AC-2 FAIL: expected 2 lines, got', lines.length);
      process.exit(1);
    }
    lines.forEach((line, i) => {
      try {
        JSON.parse(line);
      } catch {
        console.error('AC-2 FAIL: line', i, 'invalid JSON');
        process.exit(1);
      }
    });
    console.log('AC-2: JSONL append OK');

    // AC-3: 三种模式 — 使用新 run_id 验证 only-single / only-jsonl
    const dirSingle = fs.mkdtempSync(path.join(os.tmpdir(), 'accept-e1-s2-single-'));
    const dirJsonl = fs.mkdtempSync(path.join(os.tmpdir(), 'accept-e1-s2-jsonl-'));
    const dirBoth = fs.mkdtempSync(path.join(os.tmpdir(), 'accept-e1-s2-both-'));
    writeScoreRecordSync({ ...validRecord, run_id: 'only-single' }, 'single_file', { dataPath: dirSingle });
    writeScoreRecordSync({ ...validRecord, run_id: 'only-jsonl' }, 'jsonl', { dataPath: dirJsonl });
    writeScoreRecordSync({ ...validRecord, run_id: 'both' }, 'both', { dataPath: dirBoth });
    if (!fs.existsSync(path.join(dirSingle, 'only-single.json'))) {
      console.error('AC-3 FAIL: single_file mode did not create json');
      process.exit(1);
    }
    if (fs.existsSync(path.join(dirSingle, 'scores.jsonl'))) {
      console.error('AC-3 FAIL: single_file mode should not create jsonl');
      process.exit(1);
    }
    if (fs.existsSync(path.join(dirJsonl, 'only-jsonl.json'))) {
      console.error('AC-3 FAIL: jsonl mode should not create single file');
      process.exit(1);
    }
    if (!fs.existsSync(path.join(dirJsonl, 'scores.jsonl'))) {
      console.error('AC-3 FAIL: jsonl mode did not create scores.jsonl');
      process.exit(1);
    }
    const bothJsonExists = fs.existsSync(path.join(dirBoth, 'both.json'));
    const bothJsonlExists = fs.existsSync(path.join(dirBoth, 'scores.jsonl'));
    if (!bothJsonExists || !bothJsonlExists) {
      console.error('AC-3 FAIL: both mode should create both files');
      process.exit(1);
    }
    [dirSingle, dirJsonl, dirBoth].forEach((d) => fs.rmSync(d, { recursive: true, force: true }));
    console.log('AC-3: three modes OK');

    // AC-4: check_items 结构 item_id、passed、score_delta、note
    const withCheckItems: RunScoreRecord = {
      ...validRecord,
      run_id: 'ac4',
      check_items: [
        { item_id: 'a', passed: false, score_delta: -2, note: 'n' },
      ],
    };
    writeScoreRecordSync(withCheckItems, 'single_file', { dataPath: testDir });
    const ac4Content = JSON.parse(fs.readFileSync(path.join(testDir, 'ac4.json'), 'utf-8'));
    const ci = ac4Content.check_items?.[0];
    if (!ci || ci.item_id !== 'a' || ci.passed !== false || ci.score_delta !== -2 || ci.note !== 'n') {
      console.error('AC-4 FAIL: check_items structure', ac4Content.check_items);
      process.exit(1);
    }
    console.log('AC-4: check_items structure OK');

    // AC-5: 目录不存在时自动创建
    const newDir = path.join(testDir, 'nested', 'data');
    writeScoreRecordSync({ ...validRecord, run_id: 'ac5' }, 'single_file', { dataPath: newDir });
    if (!fs.existsSync(newDir) || !fs.existsSync(path.join(newDir, 'ac5.json'))) {
      console.error('AC-5 FAIL: dir/file not created');
      process.exit(1);
    }
    console.log('AC-5: dir creation OK');

    // AC-6: 单文件同 run_id 覆盖
    writeScoreRecordSync(validRecord, 'single_file');
    const overwrite = { ...validRecord, phase_score: 88 };
    writeScoreRecordSync(overwrite, 'single_file');
    const afterOverwrite = JSON.parse(fs.readFileSync(singlePath, 'utf-8'));
    if (afterOverwrite.phase_score !== 88) {
      console.error('AC-6 FAIL: overwrite expected 88, got', afterOverwrite.phase_score);
      process.exit(1);
    }
    console.log('AC-6: same run_id overwrite OK');

    // AC-7: 写入内容可被 run-score-schema 校验通过
    const written = JSON.parse(fs.readFileSync(singlePath, 'utf-8'));
    if (!validate(written)) {
      console.error('AC-7 FAIL: schema validation', validate.errors);
      process.exit(1);
    }
    const jsonlLine = fs.readFileSync(jsonlPath, 'utf-8').trim().split('\n')[0];
    if (!validate(JSON.parse(jsonlLine))) {
      console.error('AC-7 FAIL: jsonl line schema validation', validate.errors);
      process.exit(1);
    }
    console.log('AC-7: schema validation OK');

    console.log('Acceptance: PASS (AC-1～AC-7)');
  } finally {
    process.env.SCORING_DATA_PATH = origEnv;
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

main();
