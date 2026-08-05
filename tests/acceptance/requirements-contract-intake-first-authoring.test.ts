import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  artifacts,
  createMinimalConsumerRequirementDescriptor,
  createTempRoot,
  issueCodes,
  readJson,
  removeTempRoot,
  runIntakeAuthoring,
  writeLintReadyMinimalConsumerRequirement,
} from './helpers/requirements-contract-authoring-fixture';

describe('requirements contract intake first authoring', () => {
  it('uses intake source and keeps target absent before promotion', () => {
    const root = createTempRoot('requirements-contract-intake-first-');
    try {
      const intakeDir = path.join(
        root,
        '_bmad-output/runtime/requirement-records/REQ-INTAKE-FIRST/authoring/intake'
      );
      mkdirSync(intakeDir, { recursive: true });
      const { sourcePath: intake, authoringOptions } = writeLintReadyMinimalConsumerRequirement(
        root,
        '_bmad-output/runtime/requirement-records/REQ-INTAKE-FIRST/authoring/intake/intake-source.md',
        createMinimalConsumerRequirementDescriptor('REQ-INTAKE-FIRST')
      );
      const target = path.join(root, 'docs/plans/new-intake-source.md');

      const result = runIntakeAuthoring(root, intake, target, 'REQ-INTAKE-FIRST', {
        ...authoringOptions,
      });
      const paths = artifacts(root, 'REQ-INTAKE-FIRST', 'REQ-INTAKE-FIRST-SET');
      const ledger = readJson<Record<string, unknown>>(paths.authoringTransaction);

      expect(issueCodes(result)).toContain('critical_auditor_provider_mode_required');
      expect(existsSync(paths.draftSourcePreview)).toBe(true);
      expect(existsSync(paths.promotionReceipt)).toBe(false);
      expect(existsSync(target)).toBe(false);
      expect(ledger).toMatchObject({
        schemaVersion: 'requirements-authoring-transaction/v1',
        lane: 'author-confirmation-ready-source',
        entryMode: 'intake_to_new_source',
        substate: 'critical_auditor_round_required',
      });
      expect(String(ledger.intakePath)).toBe(
        '_bmad-output/runtime/requirement-records/REQ-INTAKE-FIRST/authoring/intake/intake-source.md'
      );
      expect(String(ledger.targetSourcePath)).toBe('docs/plans/new-intake-source.md');
    } finally {
      removeTempRoot(root);
    }
  });
});
