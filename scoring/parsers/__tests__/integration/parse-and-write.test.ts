/**
 * T6.2: 集成测试 - 解析产出传入 writeScoreRecordSync
 * plan §9: parseAuditReport 产出传入 writeScoreRecordSync，断言写入成功
 */
import { describe, it, expect } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { parseAuditReport } from '../../audit-index';
import { writeScoreRecordSync } from '../../../writer/write-score';

describe('parse-and-write integration', () => {
  it('parseAuditReport output can be written via writeScoreRecordSync', async () => {
    const content = fs.readFileSync(
      path.join(__dirname, '../fixtures', 'sample-prd-report.md'),
      'utf-8'
    );
    const record = await parseAuditReport({
      content,
      stage: 'prd',
      runId: 'integration-test-run-001',
      scenario: 'real_dev',
    });

    const tempDir = path.join(os.tmpdir(), `scoring-e3s2-${Date.now()}`);
    writeScoreRecordSync(record, 'single_file', { dataPath: tempDir });

    const filePath = path.join(tempDir, `${record.run_id}.json`);
    expect(fs.existsSync(filePath)).toBe(true);
    const written = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(written.run_id).toBe(record.run_id);
    expect(written.phase_score).toBe(record.phase_score);
    expect(written.check_items).toEqual(record.check_items);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
