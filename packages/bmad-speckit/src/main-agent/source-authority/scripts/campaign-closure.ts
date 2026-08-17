import * as path from 'node:path';
import { publishGoalExecutionCanonicalRecord } from './subcontract-evidence';

type JsonRecord = Record<string, unknown>;

export function publishGoalExecutionCampaignClosure(input: {
  projectRoot: string;
  outRoot: string;
  attemptRoot: string;
  payload: JsonRecord;
}) {
  return publishGoalExecutionCanonicalRecord({
    projectRoot: input.projectRoot,
    outRoot: input.outRoot,
    targetPath: path.join(input.attemptRoot, 'campaign-closure.json'),
    schemaName: 'goal-execution-campaign-closure.schema.json',
    hashField: 'campaignClosureHash',
    payload: input.payload,
  });
}
