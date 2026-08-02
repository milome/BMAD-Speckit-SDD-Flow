import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as fixtureModule from './helpers/requirements-contract-authoring-fixture';

interface SourceAuthorityProjectionDescriptor {
  language: string;
  sourcePath: string;
  requirement: {
    sourceId: string;
    mustId: string;
  };
  outOfScope: Array<{ id: string }>;
  negatives: Array<{
    id: string;
    acceptanceId: string;
    commandId: string;
    traceId: string;
    testPath: string;
    targetPath: string;
  }>;
  failure: {
    id: string;
  };
  primary: {
    acceptanceId: string;
    commandId: string;
    validationCommandId: string;
    endToEndId: string;
    traceId: string;
    pathId: string;
    testPath: string;
    targetPath: string;
  };
  execution: {
    sessionId: string;
    turnId: string;
    messageId: string;
    actorIdentityClass: string;
    branch: string;
    capturedAt: string;
    implementationAttemptId: string;
  };
}

interface StaleImplementationConfirmationDescriptor {
  recordId: string;
  requirementSetId: string;
  mustId: string;
  text: string;
}

type CreateSourceAuthorityProjectionDescriptor = (
  seed: string,
  options?: { negativeCount?: number; firstNegativeTargetPath?: string }
) => SourceAuthorityProjectionDescriptor;

type RenderSourceAuthorityProjection = (descriptor: SourceAuthorityProjectionDescriptor) => string;

type WriteSourceAuthorityProjection = (
  root: string,
  descriptor: SourceAuthorityProjectionDescriptor
) => {
  sourcePath: string;
  authoringOptions: {
    confirmationLanguage: string;
    sessionId: string;
    sessionTurnId: string;
    sessionMessageId: string;
    sessionActorIdentityClass: string;
    sessionBranch: string;
    sessionCapturedAt: string;
    implementationAttemptId: string;
  };
};

type CreateStaleImplementationConfirmationDescriptor = (
  seed: string
) => StaleImplementationConfirmationDescriptor;

describe('requirements contract source fixture authority', () => {
  it('derives a complete authority-projection Source from one seed descriptor', () => {
    const exports = fixtureModule as unknown as Record<string, unknown>;
    const createDescriptor = exports.createSourceAuthorityProjectionDescriptor;
    const renderSource = exports.renderSourceAuthorityProjection;

    expect(createDescriptor).toBeTypeOf('function');
    expect(renderSource).toBeTypeOf('function');
    if (typeof createDescriptor !== 'function' || typeof renderSource !== 'function') return;

    const create = createDescriptor as CreateSourceAuthorityProjectionDescriptor;
    const render = renderSource as RenderSourceAuthorityProjection;
    const primary = create('authority-primary', { negativeCount: 15 });
    const alternate = create('authority-alternate', { negativeCount: 15 });
    const source = render(primary);

    expect(primary.requirement).not.toEqual(alternate.requirement);
    expect(primary.primary.targetPath).not.toBe(alternate.primary.targetPath);
    expect(primary.primary.testPath).not.toBe(alternate.primary.testPath);
    expect(primary.negatives).toHaveLength(15);
    expect(new Set(primary.negatives.map((row) => row.id)).size).toBe(15);
    expect(source).toContain('## Failure Matrix');
    expect(source).toContain('## Out Of Scope');
    expect(source).toContain(primary.requirement.sourceId);
    expect(source).toContain(primary.requirement.mustId);
    expect(source).toContain(primary.failure.id);
    expect(source).toContain(primary.primary.targetPath);
    expect(source).toContain(primary.primary.testPath);
    expect(source).not.toContain(alternate.primary.targetPath);
  });

  it('derives distinct primary Source authority identities from distinct seeds', () => {
    const exports = fixtureModule as unknown as Record<string, unknown>;
    const createDescriptor = exports.createSourceAuthorityProjectionDescriptor;

    expect(createDescriptor).toBeTypeOf('function');
    if (typeof createDescriptor !== 'function') return;

    const create = createDescriptor as CreateSourceAuthorityProjectionDescriptor;
    const primary = create('authority-primary-identities', { negativeCount: 1 });
    const alternate = create('authority-alternate-identities', { negativeCount: 1 });

    expect(primary.primary.acceptanceId).not.toBe(alternate.primary.acceptanceId);
    expect(primary.primary.commandId).not.toBe(alternate.primary.commandId);
    expect(primary.primary.validationCommandId).not.toBe(alternate.primary.validationCommandId);
    expect(primary.primary.endToEndId).not.toBe(alternate.primary.endToEndId);
    expect(primary.primary.traceId).not.toBe(alternate.primary.traceId);
    expect(primary.primary.pathId).not.toBe(alternate.primary.pathId);
    expect(primary.failure.id).not.toBe(alternate.failure.id);
    expect(primary.execution).not.toEqual(alternate.execution);
    expect(primary.execution.implementationAttemptId).not.toBe(
      alternate.execution.implementationAttemptId
    );
  });

  it('materializes stale implementationConfirmation identity from a separate seed', () => {
    const exports = fixtureModule as unknown as Record<string, unknown>;
    const createStaleDescriptor = exports.createStaleImplementationConfirmationDescriptor;

    expect(createStaleDescriptor).toBeTypeOf('function');
    if (typeof createStaleDescriptor !== 'function') return;

    const create = createStaleDescriptor as CreateStaleImplementationConfirmationDescriptor;
    const primary = create('stale-primary');
    const alternate = create('stale-alternate');

    expect(primary).not.toEqual(alternate);
    expect(primary.recordId).not.toBe(alternate.recordId);
    expect(primary.requirementSetId).not.toBe(alternate.requirementSetId);
    expect(primary.mustId).not.toBe(alternate.mustId);
  });

  it('materializes every descriptor-owned Source, Target, and test path', () => {
    const exports = fixtureModule as unknown as Record<string, unknown>;
    const createDescriptor = exports.createSourceAuthorityProjectionDescriptor;
    const writeProjection = exports.writeSourceAuthorityProjection;

    expect(createDescriptor).toBeTypeOf('function');
    expect(writeProjection).toBeTypeOf('function');
    if (typeof createDescriptor !== 'function' || typeof writeProjection !== 'function') return;

    const descriptor = (createDescriptor as CreateSourceAuthorityProjectionDescriptor)(
      'authority-materialization',
      { negativeCount: 2 }
    );
    const root = fixtureModule.createTempRoot('source-authority-materialization-');
    try {
      const materialized = (writeProjection as WriteSourceAuthorityProjection)(root, descriptor);

      expect(materialized.sourcePath).toBe(path.join(root, descriptor.sourcePath));
      expect(materialized.authoringOptions.confirmationLanguage).toBe(descriptor.language);
      expect(materialized.authoringOptions).toMatchObject({
        sessionId: descriptor.execution.sessionId,
        sessionTurnId: descriptor.execution.turnId,
        sessionMessageId: descriptor.execution.messageId,
        sessionActorIdentityClass: descriptor.execution.actorIdentityClass,
        sessionBranch: descriptor.execution.branch,
        sessionCapturedAt: descriptor.execution.capturedAt,
        implementationAttemptId: descriptor.execution.implementationAttemptId,
      });
      expect(existsSync(materialized.sourcePath)).toBe(true);
      expect(existsSync(path.join(root, descriptor.primary.targetPath))).toBe(true);
      expect(existsSync(path.join(root, descriptor.primary.testPath))).toBe(true);
      expect(existsSync(path.join(root, descriptor.negatives[0].testPath))).toBe(true);
    } finally {
      fixtureModule.removeTempRoot(root);
    }
  });

  it('keeps migrated callers free of hand-written Source PRDs and selected Consumer identities', () => {
    const authorityGroundingSource = readFileSync(
      path.resolve('tests/acceptance/requirements-contract-authoring-authority-grounding.test.ts'),
      'utf8'
    );
    const existingSourcePromotionSource = readFileSync(
      path.resolve('tests/acceptance/requirements-contract-existing-source-promotion.test.ts'),
      'utf8'
    );

    expect(authorityGroundingSource).not.toContain('function sourceAuthorityProjectionFixture()');
    expect(existingSourcePromotionSource).not.toContain('vnpy/chart/multi_timeframe_widget.py');
    expect(existingSourcePromotionSource).not.toContain(
      'pytest tests/test_multi_timeframe_settings.py'
    );
  });
});
