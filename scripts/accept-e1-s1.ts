/**
 * Story 1.1 端到端验收脚本
 * 使用 getScoringDataPath、table-b、ajv、scoring/core
 */
import * as fs from 'fs';
import * as path from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { getScoringDataPath } from '../scoring/constants/path';
import { computeCompositeScore, aggregateFourDimensions, scoreToLevel } from '../scoring/core/calculator';
import { STAGE_TO_PHASE } from '../scoring/constants/table-b';
import { ALL_STAGES } from '../scoring/constants/table-a';

const ajv = new Ajv();
addFormats(ajv);

function main() {
  const dataPath = getScoringDataPath();
  const schemaPath = path.resolve(process.cwd(), 'scoring', 'schema', 'run-score-schema.json');
  const compositePath = path.join(dataPath, 'sample-composite.json');

  // 1. 校验 schema 与 sample-run.json
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
  const validate = ajv.compile(schema);
  const sampleRunPath = path.join(dataPath, 'sample-run.json');
  const sampleRun = JSON.parse(fs.readFileSync(sampleRunPath, 'utf-8')) as Record<string, unknown>;
  if (!validate(sampleRun)) {
    console.error('Schema validation failed:', validate.errors);
    process.exit(1);
  }
  // table-a: 校验 stage 合法性（ALL_STAGES）
  const stage = sampleRun.stage as string;
  if (!ALL_STAGES.includes(stage)) {
    console.error('Invalid stage:', stage);
    process.exit(1);
  }
  console.log('Schema validation: OK, stage', stage, '-> phases', STAGE_TO_PHASE[stage]);

  // 2. 读取 composite 数据并计算
  const composite = JSON.parse(fs.readFileSync(compositePath, 'utf-8'));
  const phaseScores = composite.phase_scores as number[];
  if (!phaseScores || phaseScores.length !== 6) {
    console.error('phase_scores must have 6 elements');
    process.exit(1);
  }

  const score = computeCompositeScore(phaseScores);
  const dims = aggregateFourDimensions(phaseScores);
  const level = scoreToLevel(score);

  console.log('Composite score:', score);
  console.log('Four dimensions:', dims);
  console.log('Level:', level);
  console.log('Acceptance: PASS');
}

main();
