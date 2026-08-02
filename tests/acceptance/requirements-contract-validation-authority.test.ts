import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  artifacts,
  createMinimalConsumerRequirementDescriptor,
  createSourceAuthorityProjectionDescriptor,
  createTempRoot,
  expectSourceHashUnchanged,
  issueCodes,
  readJson,
  removeTempRoot,
  runAuthoring,
  sha256File,
  writeMinimalConsumerRequirement,
  writeSourceAuthorityProjection,
  writeText,
} from './helpers/requirements-contract-authoring-fixture';

interface ValidationAuthorityArtifact {
  decision: string;
  accepted: Array<{
    command: string;
    source: string;
    executable: boolean;
    sourceCommandId?: string;
    commandFileRefs?: string[];
  }>;
  rejected: unknown[];
}

interface DraftConfirmationArtifact {
  implementationConfirmation: {
    requiredCommands: Array<{ id: string; command: string }>;
    traceRows: Array<{
      id: string;
      contractValidationCommandRefs: string[];
      deliveryEvidenceCommandRefs: string[];
    }>;
  };
}

describe('requirements contract validation authority', () => {
  it('accepts explicit executable validation commands linked to authorized target paths', () => {
    const root = createTempRoot('requirements-contract-explicit-command-');
    try {
      const descriptor = createMinimalConsumerRequirementDescriptor(
        'validation-authority-explicit-command'
      );
      const materialized = writeMinimalConsumerRequirement(
        root,
        'docs/requirements/explicit-command.md',
        descriptor
      );

      const result = runAuthoring(
        root,
        materialized.sourcePath,
        'REQ-EXPLICIT-COMMAND',
        materialized.authoringOptions
      );
      const paths = artifacts(root, 'REQ-EXPLICIT-COMMAND', 'REQ-EXPLICIT-COMMAND-SET');
      const validation = readJson<ValidationAuthorityArtifact>(paths.validationAuthorityReport);
      const draft = readJson<DraftConfirmationArtifact>(
        paths.draftImplementationConfirmation
      ).implementationConfirmation;

      expect(issueCodes(result)).toContain('critical_auditor_provider_mode_required');
      expect(validation.decision).toBe('pass');
      expect(validation.accepted).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            command: descriptor.verification.requiredCommand,
            source: 'explicit_option',
            executable: true,
          }),
        ])
      );
      expect(draft.requiredCommands.map((row: any) => row.command)).toContain(
        descriptor.verification.requiredCommand
      );
    } finally {
      removeTempRoot(root);
    }
  });

  it('derives executable validation commands from source validation sections', () => {
    const root = createTempRoot('requirements-contract-source-command-');
    try {
      const descriptor = createMinimalConsumerRequirementDescriptor(
        'validation-authority-source-command'
      );
      const materialized = writeMinimalConsumerRequirement(
        root,
        'docs/requirements/source-command.md',
        descriptor
      );
      const {
        targetPath: sourceDeclaredTarget,
        requiredCommand: sourceDeclaredCommand,
        ...authoringOptions
      } = materialized.authoringOptions;

      expect(sourceDeclaredTarget).toBe(descriptor.target.path);
      expect(sourceDeclaredCommand).toBe(descriptor.verification.requiredCommand);
      const result = runAuthoring(
        root,
        materialized.sourcePath,
        'REQ-SOURCE-COMMAND',
        authoringOptions
      );
      const paths = artifacts(root, 'REQ-SOURCE-COMMAND', 'REQ-SOURCE-COMMAND-SET');
      const validation = readJson<ValidationAuthorityArtifact>(paths.validationAuthorityReport);

      expect(issueCodes(result)).toContain('critical_auditor_provider_mode_required');
      expect(validation.accepted).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            command: descriptor.verification.requiredCommand,
            source: 'source_document',
            executable: true,
          }),
        ])
      );
    } finally {
      removeTempRoot(root);
    }
  });

  it('preserves source-only contract validation commands separately from delivery evidence', () => {
    const root = createTempRoot('requirements-contract-source-contract-validation-');
    try {
      const descriptor = createSourceAuthorityProjectionDescriptor(
        'source-contract-validation-command',
        {
          negativeCount: 2,
          sourcePath: 'docs/requirements/contract-validation-source.md',
        }
      );
      const materialized = writeSourceAuthorityProjection(root, descriptor);

      const result = runAuthoring(
        root,
        materialized.sourcePath,
        'REQ-SOURCE-CONTRACT-VALIDATION',
        materialized.authoringOptions
      );
      const paths = artifacts(
        root,
        'REQ-SOURCE-CONTRACT-VALIDATION',
        'REQ-SOURCE-CONTRACT-VALIDATION-SET'
      );
      const validation = readJson<ValidationAuthorityArtifact>(paths.validationAuthorityReport);
      const draft = readJson<DraftConfirmationArtifact>(
        paths.draftImplementationConfirmation
      ).implementationConfirmation;
      const primaryTrace = draft.traceRows.find(
        (row: any) => row.id === descriptor.primary.traceId
      );
      if (!primaryTrace) {
        throw new Error(`missing Source-authorized Trace row ${descriptor.primary.traceId}`);
      }

      expect(issueCodes(result)).toContain('critical_auditor_provider_mode_required');
      expect(issueCodes(result)).not.toContain('global_trace_missing_split_command_refs');
      expect(validation.accepted.map((row: any) => row.sourceCommandId)).toEqual(
        expect.arrayContaining([
          descriptor.primary.validationCommandId,
          descriptor.primary.commandId,
        ])
      );
      expect(draft.requiredCommands.map((row: any) => row.id)).toEqual(
        expect.arrayContaining([
          descriptor.primary.validationCommandId,
          descriptor.primary.commandId,
        ])
      );
      expect(primaryTrace.contractValidationCommandRefs).toEqual([
        descriptor.primary.validationCommandId,
      ]);
      expect(primaryTrace.deliveryEvidenceCommandRefs).toEqual([descriptor.primary.commandId]);
    } finally {
      removeTempRoot(root);
    }
  });

  it('preserves quoted source commands and accepts their project-local test targets', () => {
    const root = createTempRoot('requirements-contract-quoted-source-command-');
    try {
      const descriptor = createMinimalConsumerRequirementDescriptor(
        'validation-authority-quoted-source-command'
      );
      descriptor.verification.requiredCommand = `python -m pytest -q "${descriptor.verification.testPath}"`;
      const materialized = writeMinimalConsumerRequirement(
        root,
        'docs/requirements/quoted-source-command.md',
        descriptor
      );
      const {
        targetPath: sourceDeclaredTarget,
        requiredCommand: sourceDeclaredCommand,
        ...authoringOptions
      } = materialized.authoringOptions;

      expect(sourceDeclaredTarget).toBe(descriptor.target.path);
      expect(sourceDeclaredCommand).toBe(descriptor.verification.requiredCommand);
      const result = runAuthoring(
        root,
        materialized.sourcePath,
        'REQ-QUOTED-SOURCE-COMMAND',
        authoringOptions
      );
      const paths = artifacts(root, 'REQ-QUOTED-SOURCE-COMMAND', 'REQ-QUOTED-SOURCE-COMMAND-SET');
      const validation = readJson<ValidationAuthorityArtifact>(paths.validationAuthorityReport);
      const draft = readJson<DraftConfirmationArtifact>(
        paths.draftImplementationConfirmation
      ).implementationConfirmation;

      expect(issueCodes(result)).toContain('critical_auditor_provider_mode_required');
      expect(validation.accepted).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            sourceCommandId: descriptor.refs.commandId,
            command: descriptor.verification.requiredCommand,
            commandFileRefs: [descriptor.verification.testPath],
            source: 'source_document',
          }),
        ])
      );
      expect(draft.requiredCommands).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: descriptor.refs.commandId,
            command: descriptor.verification.requiredCommand,
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
      const descriptor = createMinimalConsumerRequirementDescriptor(
        'validation-authority-duplicate-command-id'
      );
      const materialized = writeMinimalConsumerRequirement(
        root,
        'docs/requirements/duplicate-command-id.md',
        descriptor
      );
      const original = readFileSync(materialized.sourcePath, 'utf8');
      const sourceRow = original
        .split(/\r?\n/u)
        .find((line) => line.startsWith(`| ${descriptor.refs.commandId} | delivery-evidence |`));
      expect(sourceRow).toBeDefined();
      const duplicateTestPath = descriptor.verification.testPath.replace(
        /\.test\.ts$/u,
        '-duplicate.test.ts'
      );
      writeText(root, duplicateTestPath, 'export {};\n');
      const duplicated = original.replace(
        sourceRow!,
        [
          sourceRow!,
          sourceRow!.replaceAll(descriptor.verification.testPath, duplicateTestPath),
        ].join('\n')
      );
      expect(duplicated).not.toBe(original);
      writeFileSync(materialized.sourcePath, duplicated, 'utf8');

      const result = runAuthoring(
        root,
        materialized.sourcePath,
        'REQ-DUPLICATE-SOURCE-COMMAND-ID',
        materialized.authoringOptions
      );

      expect(issueCodes(result)).toContain('validation_authority_duplicate_source_command_id');
    } finally {
      removeTempRoot(root);
    }
  });

  it('rejects manual QA text as non-executable and blocks source mutation', () => {
    const root = createTempRoot('requirements-contract-manual-qa-');
    try {
      const descriptor = createMinimalConsumerRequirementDescriptor(
        'validation-authority-manual-qa'
      );
      descriptor.verification.requiredCommand = 'manual QA screenshot review validates layout.';
      const materialized = writeMinimalConsumerRequirement(
        root,
        'docs/requirements/manual-qa.md',
        descriptor
      );
      const { requiredCommand: sourceDeclaredCommand, ...authoringOptions } =
        materialized.authoringOptions;
      const beforeHash = sha256File(materialized.sourcePath);

      expect(sourceDeclaredCommand).toBe(descriptor.verification.requiredCommand);
      const result = runAuthoring(root, materialized.sourcePath, 'REQ-MANUAL-QA', authoringOptions);
      const paths = artifacts(root, 'REQ-MANUAL-QA', 'REQ-MANUAL-QA-SET');
      const validation = readJson<ValidationAuthorityArtifact>(paths.validationAuthorityReport);
      const decision = readJson(paths.sourceMutationDecision);

      expect(issueCodes(result)).toContain('validation_authority_missing');
      expect(validation.decision).toBe('block');
      expect(JSON.stringify(validation.accepted)).not.toContain('manual QA');
      expect(decision.finalDecision).toBe('block_source_materialization');
      expectSourceHashUnchanged(materialized.sourcePath, beforeHash);
    } finally {
      removeTempRoot(root);
    }
  });

  it('rejects executable commands that are unrelated to the authorized target paths', () => {
    const root = createTempRoot('requirements-contract-unrelated-command-');
    try {
      const descriptor = createMinimalConsumerRequirementDescriptor(
        'validation-authority-unrelated-command'
      );
      const materialized = writeMinimalConsumerRequirement(
        root,
        'docs/requirements/unrelated-command.md',
        descriptor
      );
      const unrelatedDescriptor = createMinimalConsumerRequirementDescriptor(
        'validation-authority-independent-unrelated-command'
      );
      const unrelatedTestPath = `checks/isolated-${unrelatedDescriptor.seedHash.slice(
        'sha256:'.length,
        'sha256:'.length + 12
      )}.case.ts`;
      const unrelatedCommand = `npx vitest run ${unrelatedTestPath}`;
      writeText(root, unrelatedTestPath, 'export {};\n');
      const beforeHash = sha256File(materialized.sourcePath);

      const result = runAuthoring(root, materialized.sourcePath, 'REQ-UNRELATED-COMMAND', {
        ...materialized.authoringOptions,
        requiredCommand: unrelatedCommand,
      });
      const paths = artifacts(root, 'REQ-UNRELATED-COMMAND', 'REQ-UNRELATED-COMMAND-SET');
      const validation = readJson<ValidationAuthorityArtifact>(paths.validationAuthorityReport);
      const decision = readJson(paths.sourceMutationDecision);

      expect(issueCodes(result)).toContain('validation_authority_missing');
      expect(JSON.stringify(validation.rejected)).toContain(
        'validation_command_not_linked_to_target_path'
      );
      expect(decision.finalDecision).toBe('block_source_materialization');
      expectSourceHashUnchanged(materialized.sourcePath, beforeHash);
    } finally {
      removeTempRoot(root);
    }
  });

  it('blocks consumer sources that would receive a BMAD vitest validation command', () => {
    const root = createTempRoot('requirements-contract-bmad-command-');
    try {
      const descriptor = createMinimalConsumerRequirementDescriptor(
        'validation-authority-bmad-command'
      );
      const materialized = writeMinimalConsumerRequirement(
        root,
        'docs/requirements/bmad-command.md',
        descriptor
      );
      const beforeHash = sha256File(materialized.sourcePath);

      const result = runAuthoring(root, materialized.sourcePath, 'REQ-BMAD-COMMAND', {
        ...materialized.authoringOptions,
        requiredCommand:
          'npx vitest run tests/acceptance/main-agent-pre-confirmation-drilldown-lane.test.ts',
      });
      const paths = artifacts(root, 'REQ-BMAD-COMMAND', 'REQ-BMAD-COMMAND-SET');
      const sanity = readJson(paths.projectionDomainSanityReport);
      const decision = readJson(paths.sourceMutationDecision);

      expect(issueCodes(result)).toEqual(expect.arrayContaining(['validation_authority_missing']));
      expect(sanity.decision).toBe('pass');
      expect(decision.finalDecision).toBe('block_source_materialization');
      expectSourceHashUnchanged(materialized.sourcePath, beforeHash);
    } finally {
      removeTempRoot(root);
    }
  });

  it('rejects validation commands whose file references escape the project root', () => {
    const root = createTempRoot('requirements-contract-command-outside-root-');
    try {
      const descriptor = createMinimalConsumerRequirementDescriptor(
        'validation-authority-command-outside-root'
      );
      const materialized = writeMinimalConsumerRequirement(
        root,
        'docs/requirements/command-outside-root.md',
        descriptor
      );
      const beforeHash = sha256File(materialized.sourcePath);

      const result = runAuthoring(root, materialized.sourcePath, 'REQ-COMMAND-OUTSIDE-ROOT', {
        ...materialized.authoringOptions,
        requiredCommand: 'pytest ../outside_project/test_multi_timeframe.py',
      });
      const paths = artifacts(root, 'REQ-COMMAND-OUTSIDE-ROOT', 'REQ-COMMAND-OUTSIDE-ROOT-SET');
      const validation = readJson<ValidationAuthorityArtifact>(paths.validationAuthorityReport);
      const decision = readJson(paths.sourceMutationDecision);

      expect(issueCodes(result)).toContain('validation_authority_missing');
      expect(JSON.stringify(validation.rejected)).toContain(
        'validation_command_file_ref_outside_project_root'
      );
      expect(decision.finalDecision).toBe('block_source_materialization');
      expectSourceHashUnchanged(materialized.sourcePath, beforeHash);
    } finally {
      removeTempRoot(root);
    }
  });
});
