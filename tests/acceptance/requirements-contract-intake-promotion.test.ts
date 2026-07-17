import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  artifacts,
  cleanCriticalAuditorRound,
  createMinimalConsumerRequirementDescriptor,
  createTempRoot,
  issueCodes,
  readImplementationConfirmation,
  readJson,
  removeTempRoot,
  runIntakeAuthoring,
  sha256File,
  sourcePromotionDecisionPath,
  writeMinimalConsumerRequirement,
} from './helpers/requirements-contract-authoring-fixture';

function installPostPromotionSemanticDriftOverride(root: string): void {
  const skillRoot = path.join(root, '_bmad', 'skills', 'requirements-contract-authoring');
  const scriptsRoot = path.join(skillRoot, 'scripts');
  mkdirSync(scriptsRoot, { recursive: true });
  writeFileSync(
    path.join(skillRoot, 'SKILL.md'),
    '---\nname: requirements-contract-authoring\ndescription: Test-local promotion boundary override.\n---\n',
    'utf8'
  );
  const realPromotionScript = path.resolve(
    '_bmad/skills/requirements-contract-authoring/scripts/promote-draft-large-doc.js'
  );
  writeFileSync(
    path.join(scriptsRoot, 'promote-draft-large-doc.js'),
    [
      "const { spawnSync } = require('node:child_process');",
      "const fs = require('node:fs');",
      "const path = require('node:path');",
      `const realScript = ${JSON.stringify(realPromotionScript)};`,
      'const args = process.argv.slice(2);',
      'const result = spawnSync(process.execPath, [realScript, ...args], {',
      '  cwd: process.cwd(),',
      "  encoding: 'utf8',",
      '  maxBuffer: 32 * 1024 * 1024,',
      '});',
      'if (result.status === 0) {',
      "  const targetIndex = args.indexOf('--target');",
      '  const targetPath = path.resolve(process.cwd(), args[targetIndex + 1]);',
      "  const lines = fs.readFileSync(targetPath, 'utf8').split(/\\r?\\n/u);",
      "  const rowIndex = lines.findIndex((line) => /^\\|\\s*FR-[^|]*\\|/u.test(line));",
      "  if (rowIndex < 0) throw new Error('functional requirement row missing after promotion');",
      "  const cells = lines[rowIndex].split('|');",
      "  cells[2] = ' post-promotion semantic drift ';",
      "  lines[rowIndex] = cells.join('|');",
      "  fs.writeFileSync(targetPath, lines.join('\\n'), 'utf8');",
      '}',
      "process.stdout.write(result.stdout || '');",
      "process.stderr.write(result.stderr || '');",
      'process.exit(result.status ?? 1);',
      '',
    ].join('\n'),
    'utf8'
  );
}

describe('requirements contract intake promotion', () => {
  it('creates target only after auditor convergence and authoring-draft promotion', () => {
    const root = createTempRoot('requirements-contract-intake-promotion-');
    try {
      const { sourcePath: intake, authoringOptions } = writeMinimalConsumerRequirement(
        root,
        '_bmad-output/runtime/requirement-records/REQ-INTAKE-PROMOTE/authoring/intake/intake-source.md',
        createMinimalConsumerRequirementDescriptor('REQ-INTAKE-PROMOTE')
      );
      const target = path.join(root, 'docs/plans/new-intake-promoted.md');

      const promoted = runIntakeAuthoring(root, intake, target, 'REQ-INTAKE-PROMOTE', {
        ...authoringOptions,
        criticalAuditorRound: cleanCriticalAuditorRound,
      });
      const paths = artifacts(root, 'REQ-INTAKE-PROMOTE', 'REQ-INTAKE-PROMOTE-SET');
      if (!existsSync(paths.promotionReceipt)) {
        const roundTrip = existsSync(paths.renderRoundTripReport)
          ? readJson<Record<string, unknown>>(paths.renderRoundTripReport)
          : null;
        throw new Error(
          JSON.stringify(
            {
              substate: promoted.substate,
              blockingStage: promoted.blockingStage,
              blockingIssues: promoted.blockingIssues,
              roundTrip,
            },
            null,
            2
          )
        );
      }
      const receipt = readJson<Record<string, unknown>>(paths.promotionReceipt);
      const ledger = readJson<Record<string, unknown>>(paths.authoringTransaction);

      expect(existsSync(target)).toBe(true);
      expect(receipt).toMatchObject({
        ok: true,
        promotionStage: 'authoring-draft',
        targetPath: 'docs/plans/new-intake-promoted.md',
      });
      expect(receipt.targetHash).toBe(sha256File(target));
      expect(promoted.receiptHash).toBe(sha256File(paths.promotionReceipt));
      expect(readImplementationConfirmation(target).preConfirmationDrilldown).toBeTruthy();
      expect(existsSync(paths.promotionReadbackRoundTripReport)).toBe(true);
      const promotionReadback = readJson<Record<string, unknown>>(
        paths.promotionReadbackRoundTripReport
      );
      expect(promotionReadback).toMatchObject({
        schemaVersion: 'requirements-contract-render-roundtrip-report/v1',
        decision: 'pass',
        sourceReadbackHash: sha256File(target),
      });
      expect(promotionReadback.baselineSemanticModelHash).toBe(
        promotionReadback.roundTripSemanticModelHash
      );
      expect(ledger.entryMode).toBe('intake_to_new_source');
      expect(ledger.substate).toBe('promoted_not_confirmation_ready');
    } finally {
      removeTempRoot(root);
    }
  });

  it('stops when intake target is created before promotion', () => {
    const root = createTempRoot('requirements-contract-intake-race-');
    try {
      const { sourcePath: intake, authoringOptions } = writeMinimalConsumerRequirement(
        root,
        '_bmad-output/runtime/requirement-records/REQ-INTAKE-RACE/authoring/intake/intake-source.md',
        createMinimalConsumerRequirementDescriptor('REQ-INTAKE-RACE')
      );
      const target = path.join(root, 'docs/plans/new-intake-race.md');
      let created = false;

      const result = runIntakeAuthoring(root, intake, target, 'REQ-INTAKE-RACE', {
        ...authoringOptions,
        criticalAuditorRound: (input) => {
          if (!created) {
            mkdirSync(path.dirname(target), { recursive: true });
            writeFileSync(target, '# Concurrent target\n', 'utf8');
            created = true;
          }
          return cleanCriticalAuditorRound(input);
        },
      });
      const paths = artifacts(root, 'REQ-INTAKE-RACE', 'REQ-INTAKE-RACE-SET');

      if (!issueCodes(result).includes('target_created_before_promotion')) {
        const roundTrip = existsSync(paths.renderRoundTripReport)
          ? readJson<Record<string, unknown>>(paths.renderRoundTripReport)
          : null;
        throw new Error(
          JSON.stringify(
            {
              substate: result.substate,
              blockingStage: result.blockingStage,
              blockingIssues: result.blockingIssues,
              roundTrip,
            },
            null,
            2
          )
        );
      }
      expect(issueCodes(result)).toContain('target_created_before_promotion');
      expect(result.blockingStage).toBe('target_created_before_promotion');
      expect(existsSync(paths.promotionReceipt)).toBe(false);
      expect(existsSync(target)).toBe(true);
    } finally {
      removeTempRoot(root);
    }
  });

  it('rolls back a newly created target when promoted readback changes semantic authority', () => {
    const root = createTempRoot('requirements-contract-intake-readback-drift-');
    try {
      installPostPromotionSemanticDriftOverride(root);
      const { sourcePath: intake, authoringOptions } = writeMinimalConsumerRequirement(
        root,
        '_bmad-output/runtime/requirement-records/REQ-INTAKE-READBACK-DRIFT/authoring/intake/intake-source.md',
        createMinimalConsumerRequirementDescriptor('REQ-INTAKE-READBACK-DRIFT')
      );
      const target = path.join(root, 'docs/plans/new-intake-readback-drift.md');

      const result = runIntakeAuthoring(
        root,
        intake,
        target,
        'REQ-INTAKE-READBACK-DRIFT',
        {
          ...authoringOptions,
          criticalAuditorRound: cleanCriticalAuditorRound,
        }
      );
      const paths = artifacts(
        root,
        'REQ-INTAKE-READBACK-DRIFT',
        'REQ-INTAKE-READBACK-DRIFT-SET'
      );
      const rollbackReceiptPath = path.join(
        paths.authoring,
        'proofs',
        'promotion-readback-rollback-receipt.json'
      );

      expect(issueCodes(result)).toContain('promotion_readback_semantic_conservation_failed');
      expect(result.blockingStage).toBe('promotion_readback_semantic_conservation_failed');
      expect(existsSync(paths.promotionReadbackRoundTripReport)).toBe(true);
      expect(
        readJson<Record<string, unknown>>(paths.promotionReadbackRoundTripReport).decision
      ).toBe('block');
      expect(existsSync(target)).toBe(false);
      expect(existsSync(paths.promotionReceipt)).toBe(false);
      expect(readJson<Record<string, unknown>>(rollbackReceiptPath)).toMatchObject({
        schemaVersion: 'requirements-contract-promotion-readback-rollback-receipt/v1',
        decision: 'rolled_back',
        targetExistedBeforePromotion: false,
        targetExistsAfterRollback: false,
        successPromotionReceiptRetained: false,
      });
    } finally {
      removeTempRoot(root);
    }
  });

  it('restores an existing target and replaces the allow decision when promoted readback drifts', () => {
    const root = createTempRoot('requirements-contract-existing-readback-drift-');
    try {
      installPostPromotionSemanticDriftOverride(root);
      const { sourcePath: intake, authoringOptions } = writeMinimalConsumerRequirement(
        root,
        '_bmad-output/runtime/requirement-records/REQ-EXISTING-READBACK-DRIFT/authoring/intake/intake-source.md',
        createMinimalConsumerRequirementDescriptor('REQ-EXISTING-READBACK-DRIFT')
      );
      const target = path.join(root, 'docs/plans/existing-readback-target.md');
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, '# Existing target\n\nPreserve these exact bytes.\n', 'utf8');
      const originalHash = sha256File(target);

      const result = runIntakeAuthoring(
        root,
        intake,
        target,
        'REQ-EXISTING-READBACK-DRIFT',
        {
          ...authoringOptions,
          criticalAuditorRound: cleanCriticalAuditorRound,
        }
      );
      const paths = artifacts(
        root,
        'REQ-EXISTING-READBACK-DRIFT',
        'REQ-EXISTING-READBACK-DRIFT-SET'
      );
      const rollbackReceiptPath = path.join(
        paths.authoring,
        'proofs',
        'promotion-readback-rollback-receipt.json'
      );
      const rollbackReceipt = readJson<Record<string, unknown>>(rollbackReceiptPath);
      const promotionDecision = readJson<Record<string, unknown>>(
        sourcePromotionDecisionPath(root, 'REQ-EXISTING-READBACK-DRIFT')
      );

      expect(issueCodes(result)).toContain('promotion_readback_semantic_conservation_failed');
      expect(existsSync(target)).toBe(true);
      expect(sha256File(target)).toBe(originalHash);
      expect(existsSync(paths.promotionReceipt)).toBe(false);
      expect(rollbackReceipt).toMatchObject({
        decision: 'rolled_back',
        targetExistedBeforePromotion: true,
        expectedOriginalHash: originalHash,
        targetExistsAfterRollback: true,
        targetHashAfterRollback: originalHash,
        successPromotionReceiptRetained: false,
      });
      expect(promotionDecision).toMatchObject({
        finalDecision: 'block_source_promotion',
        blockingStage: 'promotion_readback_semantic_conservation_failed',
        sourceMutationPerformed: false,
      });
    } finally {
      removeTempRoot(root);
    }
  });
});
