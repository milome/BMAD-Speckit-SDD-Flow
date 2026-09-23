import { readFileSync } from 'node:fs';

export const CURRENT_REQUIREMENTS_CONTRACT_RECORD_VERSION =
  'requirements-contract-record/v3' as const;

export class RequirementsAuthoringRecordVersionError extends Error {
  readonly issueCode = 'requirements_authoring_record_version_unsupported';

  constructor(
    readonly declaredVersion: string,
    readonly currentVersion = CURRENT_REQUIREMENTS_CONTRACT_RECORD_VERSION
  ) {
    super('requirements_authoring_record_version_unsupported');
    this.name = 'RequirementsAuthoringRecordVersionError';
  }
}

export interface RequirementsContractRecordV3 extends Record<string, unknown> {
  schemaVersion: typeof CURRENT_REQUIREMENTS_CONTRACT_RECORD_VERSION;
  recordId: string;
}

export function assertRequirementsContractRecordV3(
  value: unknown
): asserts value is RequirementsContractRecordV3 {
  const record =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  const declaredVersion = String(record?.schemaVersion ?? 'missing');
  if (declaredVersion !== CURRENT_REQUIREMENTS_CONTRACT_RECORD_VERSION) {
    throw new RequirementsAuthoringRecordVersionError(declaredVersion);
  }
}

export function openRequirementsContractRecord(recordPath: string): RequirementsContractRecordV3 {
  const record = JSON.parse(readFileSync(recordPath, 'utf8')) as unknown;
  assertRequirementsContractRecordV3(record);
  return record;
}
