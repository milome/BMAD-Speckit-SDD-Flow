import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  artifacts,
  createTempRoot,
  expectSourceHashUnchanged,
  issueCodes,
  readJson,
  removeTempRoot,
  runAuthoring,
  sha256File,
  writeConsumerRequirement,
  writeText,
} from './helpers/requirements-contract-authoring-fixture';

describe('requirements contract validation authority', () => {
  it('accepts explicit executable validation commands linked to authorized target paths', () => {
    const root = createTempRoot('requirements-contract-explicit-command-');
    try {
      const source = writeConsumerRequirement(root);

      const result = runAuthoring(root, source, 'REQ-EXPLICIT-COMMAND', {
        targetPath: 'vnpy/chart/multi_timeframe_widget.py',
        requiredCommand: 'pytest tests/test_multi_timeframe_settings.py',
      });
      const paths = artifacts(root, 'REQ-EXPLICIT-COMMAND', 'REQ-EXPLICIT-COMMAND-SET');
      const validation = readJson(paths.validationAuthorityReport);
      const draft = readJson(paths.draftImplementationConfirmation).implementationConfirmation;

      expect(issueCodes(result)).toContain('critical_auditor_provider_mode_required');
      expect(validation.decision).toBe('pass');
      expect(validation.accepted[0]).toMatchObject({
        command: 'pytest tests/test_multi_timeframe_settings.py',
        source: 'explicit_option',
        executable: true,
      });
      expect(draft.requiredCommands.map((row: any) => row.command)).toContain(
        'pytest tests/test_multi_timeframe_settings.py'
      );
    } finally {
      removeTempRoot(root);
    }
  });

  it('derives executable validation commands from source validation sections', () => {
    const root = createTempRoot('requirements-contract-source-command-');
    try {
      const source = writeConsumerRequirement(root);

      const result = runAuthoring(root, source, 'REQ-SOURCE-COMMAND');
      const paths = artifacts(root, 'REQ-SOURCE-COMMAND', 'REQ-SOURCE-COMMAND-SET');
      const validation = readJson(paths.validationAuthorityReport);

      expect(issueCodes(result)).toContain('critical_auditor_provider_mode_required');
      expect(validation.accepted).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            command: 'pytest tests/test_multi_timeframe_settings.py',
            source: 'source_document',
            executable: true,
          }),
        ])
      );
    } finally {
      removeTempRoot(root);
    }
  });

  it('preserves quoted source commands and accepts their project-local test targets', () => {
    const root = createTempRoot('requirements-contract-quoted-source-command-');
    try {
      const source = writeText(
        root,
        'docs/requirements/quoted-source-command.md',
        [
          '# Quoted Source Command',
          '',
          '目标文件：`src/widget.py`',
          '',
          '## Functional Requirements',
          '',
          '| ID | Requirement | Source rationale | Acceptance link | Per-MUST oracle | Assertion source | Responsibility mapping |',
          '| --- | --- | --- | --- | --- | --- | --- |',
          '| FR-001 | Widget behavior must remain independently verifiable. | Product requirement. | ACC-001 E2E-001 | Given the widget changes, when verification runs, then the product assertion passes. | ACC-001 CMD-084 TRACE-001; tests/acceptance/negative-001.test.ts | PATH-001 owns remediation. |',
          '',
          '## Test And Verification Paths',
          '',
          '| ID | Type | Covers | Command or evidence path | Completion rule | Per-MUST oracle | Assertion source | Responsibility mapping | Target files |',
          '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
          '| E2E-001 | e2e | MUST-FR-001 | python -m pytest -q "tests/acceptance/negative-001.test.ts" | Exit code 0. | Product assertion passes. | ACC-001 CMD-084 TRACE-001 | PATH-001 owns remediation. | tests/acceptance/negative-001.test.ts src/widget.py |',
          '| CMD-084 | delivery-evidence | MUST-FR-001 | python -m pytest -q "tests/acceptance/negative-001.test.ts" | Exit code 0. | Product assertion passes. | ACC-001 TRACE-001 | PATH-001 owns remediation. | tests/acceptance/negative-001.test.ts src/widget.py |',
          '',
        ].join('\n')
      );

      const result = runAuthoring(root, source, 'REQ-QUOTED-SOURCE-COMMAND');
      const paths = artifacts(root, 'REQ-QUOTED-SOURCE-COMMAND', 'REQ-QUOTED-SOURCE-COMMAND-SET');
      const validation = readJson(paths.validationAuthorityReport);
      const draft = readJson(paths.draftImplementationConfirmation).implementationConfirmation;

      expect(issueCodes(result)).toContain('critical_auditor_provider_mode_required');
      expect(validation.accepted).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            sourceCommandId: 'CMD-084',
            command: 'python -m pytest -q "tests/acceptance/negative-001.test.ts"',
            commandFileRefs: ['tests/acceptance/negative-001.test.ts'],
            source: 'source_document',
          }),
        ])
      );
      expect(draft.requiredCommands).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'CMD-084',
            command: 'python -m pytest -q "tests/acceptance/negative-001.test.ts"',
          }),
        ])
      );
    } finally {
      removeTempRoot(root);
    }
  });

  it('fails closed when duplicate source CMD IDs declare multiple authority rows', () => {
    const root = createTempRoot('requirements-contract-duplicate-source-command-id-');
    try {
      const source = writeConsumerRequirement(root);
      const original = readFileSync(source, 'utf8');
      const duplicated = original.replace(
        /(\| CMD-001 \| delivery-evidence[^\n]+\|)/u,
        [
          '$1',
          '| CMD-001 | delivery-evidence | MUST-FR-001 | pytest tests/test_multi_timeframe_settings_duplicate.py | Exit code 0. | Duplicate authority must be rejected. | ACC-001 TRACE-001 | PATH-001 owns remediation. | tests/test_multi_timeframe_settings_duplicate.py vnpy/chart/multi_timeframe_widget.py |',
        ].join('\n')
      );
      expect(duplicated).not.toBe(original);
      writeFileSync(source, duplicated, 'utf8');

      const result = runAuthoring(root, source, 'REQ-DUPLICATE-SOURCE-COMMAND-ID');

      expect(issueCodes(result)).toContain('validation_authority_duplicate_source_command_id');
    } finally {
      removeTempRoot(root);
    }
  });

  it('rejects manual QA text as non-executable and blocks source mutation', () => {
    const root = createTempRoot('requirements-contract-manual-qa-');
    try {
      const source = writeText(
        root,
        'docs/requirements/manual-qa.md',
        [
          '# Multi Timeframe Display Settings',
          '',
          '目标文件：`vnpy/chart/multi_timeframe_widget.py`',
          '',
          '## 验收标准',
          '',
          '主图摘要必须展示所有启用周期。',
          'manual QA screenshot review validates layout.',
          '',
        ].join('\n')
      );
      const beforeHash = sha256File(source);

      const result = runAuthoring(root, source, 'REQ-MANUAL-QA');
      const paths = artifacts(root, 'REQ-MANUAL-QA', 'REQ-MANUAL-QA-SET');
      const validation = readJson(paths.validationAuthorityReport);
      const decision = readJson(paths.sourceMutationDecision);

      expect(issueCodes(result)).toContain('validation_authority_missing');
      expect(validation.decision).toBe('block');
      expect(JSON.stringify(validation.accepted)).not.toContain('manual QA');
      expect(decision.finalDecision).toBe('block_source_materialization');
      expectSourceHashUnchanged(source, beforeHash);
    } finally {
      removeTempRoot(root);
    }
  });

  it('rejects executable commands that are unrelated to the authorized target paths', () => {
    const root = createTempRoot('requirements-contract-unrelated-command-');
    try {
      const source = writeConsumerRequirement(root);
      const beforeHash = sha256File(source);

      const result = runAuthoring(root, source, 'REQ-UNRELATED-COMMAND', {
        targetPath: 'vnpy/chart/multi_timeframe_widget.py',
        requiredCommand: 'pytest tests/test_order_gateway.py',
      });
      const paths = artifacts(root, 'REQ-UNRELATED-COMMAND', 'REQ-UNRELATED-COMMAND-SET');
      const validation = readJson(paths.validationAuthorityReport);
      const decision = readJson(paths.sourceMutationDecision);

      expect(issueCodes(result)).toContain('validation_authority_missing');
      expect(JSON.stringify(validation.rejected)).toContain(
        'validation_command_not_linked_to_target_path'
      );
      expect(decision.finalDecision).toBe('block_source_materialization');
      expectSourceHashUnchanged(source, beforeHash);
    } finally {
      removeTempRoot(root);
    }
  });

  it('blocks consumer sources that would receive a BMAD vitest validation command', () => {
    const root = createTempRoot('requirements-contract-bmad-command-');
    try {
      const source = writeConsumerRequirement(root);
      const beforeHash = sha256File(source);

      const result = runAuthoring(root, source, 'REQ-BMAD-COMMAND', {
        targetPath: 'vnpy/chart/multi_timeframe_widget.py',
        requiredCommand:
          'npx vitest run tests/acceptance/main-agent-pre-confirmation-drilldown-lane.test.ts',
      });
      const paths = artifacts(root, 'REQ-BMAD-COMMAND', 'REQ-BMAD-COMMAND-SET');
      const sanity = readJson(paths.projectionDomainSanityReport);
      const decision = readJson(paths.sourceMutationDecision);

      expect(issueCodes(result)).toEqual(expect.arrayContaining(['validation_authority_missing']));
      expect(sanity.decision).toBe('pass');
      expect(decision.finalDecision).toBe('block_source_materialization');
      expectSourceHashUnchanged(source, beforeHash);
    } finally {
      removeTempRoot(root);
    }
  });

  it('rejects validation commands whose file references escape the project root', () => {
    const root = createTempRoot('requirements-contract-command-outside-root-');
    try {
      const source = writeConsumerRequirement(root);
      const beforeHash = sha256File(source);

      const result = runAuthoring(root, source, 'REQ-COMMAND-OUTSIDE-ROOT', {
        targetPath: 'vnpy/chart/multi_timeframe_widget.py',
        requiredCommand: 'pytest ../outside_project/test_multi_timeframe.py',
      });
      const paths = artifacts(root, 'REQ-COMMAND-OUTSIDE-ROOT', 'REQ-COMMAND-OUTSIDE-ROOT-SET');
      const validation = readJson(paths.validationAuthorityReport);
      const decision = readJson(paths.sourceMutationDecision);

      expect(issueCodes(result)).toContain('validation_authority_missing');
      expect(JSON.stringify(validation.rejected)).toContain(
        'validation_command_file_ref_outside_project_root'
      );
      expect(decision.finalDecision).toBe('block_source_materialization');
      expectSourceHashUnchanged(source, beforeHash);
    } finally {
      removeTempRoot(root);
    }
  });
});
