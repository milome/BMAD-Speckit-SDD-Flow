/**
 * T5: parseAuditReport 统一入口集成测试
 */
import { describe, it, expect } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { parseAuditReport } from '../audit-index';
import { validateRunScoreRecord } from '../../writer/validate';

const FIXTURES = path.join(__dirname, 'fixtures');

describe('parseAuditReport', () => {
  it('dispatches to parsePrdReport when stage=prd', async () => {
    const content = fs.readFileSync(path.join(FIXTURES, 'sample-prd-report.md'), 'utf-8');
    const result = await parseAuditReport({
      content,
      stage: 'prd',
      runId: 'run-1',
      scenario: 'real_dev',
    });
    expect(result.stage).toBe('prd');
    expect(result.phase_score).toBe(80);
    validateRunScoreRecord(result);
  });

  it('dispatches to parseArchReport when stage=arch', async () => {
    const content = fs.readFileSync(path.join(FIXTURES, 'sample-arch-report.md'), 'utf-8');
    const result = await parseAuditReport({
      content,
      stage: 'arch',
      runId: 'run-2',
      scenario: 'real_dev',
    });
    expect(result.stage).toBe('arch');
    expect(result.phase_score).toBe(100);
    validateRunScoreRecord(result);
  });

  it('dispatches to parseStoryReport when stage=story', async () => {
    const content = fs.readFileSync(path.join(FIXTURES, 'sample-story-report.md'), 'utf-8');
    const result = await parseAuditReport({
      content,
      stage: 'story',
      runId: 'run-3',
      scenario: 'real_dev',
    });
    expect(result.stage).toBe('story');
    expect(result.phase_score).toBe(100);
    validateRunScoreRecord(result);
  });
});
