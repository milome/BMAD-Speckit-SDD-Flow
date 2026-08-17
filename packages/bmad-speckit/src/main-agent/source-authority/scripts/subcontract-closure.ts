import * as path from 'node:path';
import { publishGoalExecutionCanonicalRecord } from './subcontract-evidence';

type JsonRecord = Record<string, unknown>;

export function publishGoalExecutionAuthorityClosure(input: {
  projectRoot: string;
  outRoot: string;
  attemptRoot: string;
  authorityFileId: string;
  payload: JsonRecord;
}) {
  return publishGoalExecutionCanonicalRecord({
    projectRoot: input.projectRoot,
    outRoot: input.outRoot,
    targetPath: path.join(input.attemptRoot, 'closures', `${input.authorityFileId}.json`),
    schemaName: 'goal-execution-authority-closure.schema.json',
    hashField: 'closureHash',
    payload: input.payload,
  });
}
