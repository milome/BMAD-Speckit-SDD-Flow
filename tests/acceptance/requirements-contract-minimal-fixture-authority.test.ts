import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as fixtureModule from './helpers/requirements-contract-authoring-fixture';

interface MinimalFixtureDescriptorProjection {
  seedHash: string;
  refs: {
    functionalRequirementId: string;
    mustRequirementId: string;
    negativeRequirementId: string;
    failureId: string;
    acceptanceId: string;
    negativeAcceptanceId: string;
    commandId: string;
    negativeCommandId: string;
    endToEndId: string;
    mustTraceId: string;
    negativeTraceId: string;
    pathId: string;
    outOfScopeId: string;
  };
  target: {
    path: string;
  };
  verification: {
    testPath: string;
    requiredCommand: string;
  };
  session: {
    sessionId: string;
    turnId: string;
    messageId: string;
    actorIdentityClass: string;
    branch: string;
    capturedAt: string;
  };
  attempt: {
    implementationAttemptId: string;
  };
  semantics: {
    language: string;
  };
}

interface MinimalFixtureMaterializationProjection {
  sourcePath: string;
  descriptor: MinimalFixtureDescriptorProjection;
  authoringOptions: {
    targetPath: string;
    requiredCommand: string;
    sessionId: string;
    sessionTurnId: string;
    sessionMessageId: string;
    sessionActorIdentityClass: string;
    sessionBranch: string;
    sessionCapturedAt: string;
    confirmationLanguage: string;
    implementationAttemptId: string;
  };
}

type DescriptorFactory = (seed: string) => MinimalFixtureDescriptorProjection;
type SourceWriter = (
  root: string,
  relativePath: string,
  descriptor: MinimalFixtureDescriptorProjection
) => MinimalFixtureMaterializationProjection;

describe('requirements contract minimal fixture authority', () => {
  it('derives source, target, command, and expected identities from one seed authority', () => {
    const exports = fixtureModule as unknown as Record<string, unknown>;
    expect(exports.createMinimalConsumerRequirementDescriptor).toBeTypeOf('function');

    const createDescriptor =
      exports.createMinimalConsumerRequirementDescriptor as DescriptorFactory;
    const writeRequirement = exports.writeMinimalConsumerRequirement as SourceWriter;
    const primary = createDescriptor('checkpoint-primary');
    const alternate = createDescriptor('checkpoint-alternate');

    for (const refName of Object.keys(primary.refs) as Array<keyof typeof primary.refs>) {
      expect(primary.refs[refName], refName).not.toBe(alternate.refs[refName]);
    }
    expect(primary.target.path).not.toBe(alternate.target.path);
    expect(primary.verification.testPath).not.toBe(alternate.verification.testPath);
    expect(primary.verification.requiredCommand).not.toBe(alternate.verification.requiredCommand);
    expect(primary.session.sessionId).not.toBe(alternate.session.sessionId);
    expect(primary.attempt.implementationAttemptId).not.toBe(
      alternate.attempt.implementationAttemptId
    );

    const root = fixtureModule.createTempRoot('minimal-fixture-authority-');
    try {
      const materialized = writeRequirement(root, 'docs/requirements/seed-derived.md', primary);
      const source = readFileSync(materialized.sourcePath, 'utf8');

      expect(materialized.descriptor).toEqual(primary);
      expect(materialized.authoringOptions).toEqual({
        targetPath: primary.target.path,
        requiredCommand: primary.verification.requiredCommand,
        sessionId: primary.session.sessionId,
        sessionTurnId: primary.session.turnId,
        sessionMessageId: primary.session.messageId,
        sessionActorIdentityClass: primary.session.actorIdentityClass,
        sessionBranch: primary.session.branch,
        sessionCapturedAt: primary.session.capturedAt,
        confirmationLanguage: primary.semantics.language,
        implementationAttemptId: primary.attempt.implementationAttemptId,
      });
      expect(source).toContain(primary.refs.functionalRequirementId);
      expect(source).toContain(primary.refs.mustRequirementId);
      expect(source).toContain(primary.refs.negativeRequirementId);
      expect(source).toContain(primary.target.path);
      expect(source).toContain(primary.verification.testPath);
      expect(source).toContain(primary.verification.requiredCommand);
      expect(source).not.toContain(alternate.target.path);
      expect(source).not.toContain(alternate.verification.requiredCommand);
    } finally {
      fixtureModule.removeTempRoot(root);
    }
  });

  it('contains no selected Consumer project identity in the reusable helper', () => {
    const helperSource = readFileSync(
      path.resolve('tests/acceptance/helpers/requirements-contract-authoring-fixture.ts'),
      'utf8'
    );
    const writerStart = helperSource.indexOf('export function writeMinimalConsumerRequirement(');
    const writerEnd = helperSource.indexOf(
      'export function expectSourceHashUnchanged(',
      writerStart
    );
    expect(writerStart).toBeGreaterThanOrEqual(0);
    expect(writerEnd).toBeGreaterThan(writerStart);
    const minimalWriterSource = helperSource.slice(writerStart, writerEnd);

    expect(minimalWriterSource).not.toContain('vnpy/chart/multi_timeframe_widget.py');
    expect(minimalWriterSource).not.toContain('pytest tests/test_multi_timeframe_settings.py');
    expect(helperSource).not.toContain('vnpy/chart/multi_timeframe_widget.py');
    expect(helperSource).not.toContain('pytest tests/test_multi_timeframe_settings.py');
  });

  it('keeps every migrated minimal-writer caller descriptor-derived', () => {
    const migratedCallers = [
      'tests/acceptance/requirements-contract-checkpoint-main-lane.test.ts',
      'tests/acceptance/requirements-contract-existing-source-promotion.test.ts',
      'tests/acceptance/requirements-contract-intake-promotion.test.ts',
      'tests/acceptance/requirements-contract-intake-first-authoring.test.ts',
      'tests/acceptance/requirements-contract-staging-transaction.test.ts',
      'tests/acceptance/requirements-contract-critical-auditor-provider.test.ts',
    ];

    for (const callerPath of migratedCallers) {
      const callerSource = readFileSync(path.resolve(callerPath), 'utf8');
      const callIndexes = Array.from(
        callerSource.matchAll(/write(?:LintReady)?MinimalConsumerRequirement\(/gu),
        (match) => match.index
      );
      expect(callIndexes.length, callerPath).toBeGreaterThan(0);

      for (const callIndex of callIndexes) {
        const callWindow = callerSource.slice(
          Math.max(0, callIndex - 500),
          Math.min(callerSource.length, callIndex + 900)
        );
        expect(callWindow).toContain('createMinimalConsumerRequirementDescriptor(');
        expect(callWindow).toContain('authoringOptions');
        expect(callWindow).not.toContain('vnpy/chart/multi_timeframe_widget.py');
        expect(callWindow).not.toContain('pytest tests/test_multi_timeframe_settings.py');
      }
    }
  });
});
