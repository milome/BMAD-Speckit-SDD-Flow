import Ajv2020 from 'ajv/dist/2020.js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as semanticResolver from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import {
  applySemanticFieldValue,
  resolveSemanticField,
  sha256Stable,
  sha256Text,
  type SemanticResolutionCandidate,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

const schemaPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-semantic-resolution-receipt.schema.json'
);

function sourceContent(excerpt: string): string {
  return [...Array.from({ length: 6 }, (_, index) => `context-${index + 1}`), excerpt].join('\n');
}

const sourceAuthorityRegistry = new Map<string, Record<string, unknown>>();
const invocationContextRegistry = new Map<string, Record<string, unknown>>();

function sourcePremise(
  namespace: string,
  excerpt: string,
  fieldRef = `requirements.${namespace}.semantics.actor`,
  value: unknown = excerpt
) {
  const content = sourceContent(excerpt);
  const sourcePath = `docs/requirements/${namespace}.md`;
  const sourceSpan = { startLine: 7, endLine: 7 };
  const extractionPayload = {
    fieldRef,
    sourceSpan,
    excerptHash: sha256Text(excerpt),
    valueHash: sha256Stable(value),
    parserId: 'canonical-parser-test',
    parserHash: sha256Stable('canonical-parser-test-implementation'),
  };
  sourceAuthorityRegistry.set(sourcePath, {
    content,
    hash: sha256Text(content),
    extractions: [{
      ...extractionPayload,
      observationHash: sha256Stable(extractionPayload),
    }],
  });
  return {
    kind: 'source' as const,
    sourcePath,
    sourceSpan,
    excerpt,
    hash: sha256Text(content),
  };
}

function trustedSourceOptions(...candidates: SemanticResolutionCandidate[]) {
  const trustedSourceSnapshots = Object.fromEntries(
    candidates.flatMap((input) =>
      input.premises
        .filter((premise) => premise.kind === 'source')
        .map((premise) => [premise.sourcePath, sourceAuthorityRegistry.get(premise.sourcePath)])
    )
  );
  const trustedInvocationContext = candidates.length === 1
    ? invocationContextRegistry.get(candidates[0].resolutionId)
    : undefined;
  return { trustedSourceSnapshots, trustedInvocationContext };
}

function candidate(
  namespace: string,
  resolutionAuthorityClass: SemanticResolutionCandidate['resolutionAuthorityClass'],
  overrides: Partial<SemanticResolutionCandidate> = {}
): SemanticResolutionCandidate {
  const value = overrides.value ?? `${namespace}-value`;
  const fieldRef = overrides.fieldRef ?? `requirements.${namespace}.semantics.actor`;
  const sourceModelBefore =
    { requirements: { [namespace]: { semantics: {} } } };
  const resolutionId = `resolution-${namespace}`;
  const resolverId = 'semantic-resolver-test';
  const resolutionRunId = `run-${namespace}`;
  const input = {
    resolutionId,
    fieldRef,
    value,
    semanticKind: 'actor',
    resolutionAuthorityClass,
    premises:
      overrides.premises ??
      [sourcePremise(
        namespace,
        typeof value === 'string' ? value : JSON.stringify(value),
        fieldRef,
        value
      )],
    derivationRule: null,
    applicabilityProof: null,
    conflictingCandidates: [],
    ...overrides,
  } satisfies SemanticResolutionCandidate;
  invocationContextRegistry.set(resolutionId, {
    resolverId,
    resolutionRunId,
    sourceModelBefore,
  });
  return input;
}

function trustedRuleEvaluation(input: SemanticResolutionCandidate) {
  const sourcePremises = input.premises.filter((premise) => premise.kind === 'source');
  const payload = {
    resolutionId: input.resolutionId,
    fieldRef: input.fieldRef,
    ruleId: input.derivationRule!,
    ruleVersion: '1.0.0',
    ruleHash: sha256Stable(`rule:${input.derivationRule}`),
    premiseSetHash: sha256Stable(sourcePremises),
    outputValueHash: sha256Stable(input.value),
  };
  return {
    ...payload,
    evaluationReceiptHash: sha256Stable(payload),
  };
}

describe('proof-carrying semantic resolution', () => {
  it('authorizes only proved automatic classes and emits canonical schema-valid receipts', () => {
    const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as object;
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
    const sourceInput = candidate('source', 'source_extracted');
    const source = resolveSemanticField(sourceInput, trustedSourceOptions(sourceInput));
    const ruleInput = candidate('rule', 'rule_derived', {
      derivationRule: 'copy-source-value',
    });
    const rule = resolveSemanticField(
      ruleInput,
      {
        ...trustedSourceOptions(ruleInput),
        allowlistedDerivationRules: ['copy-source-value'],
        trustedRuleEvaluations: {
          [ruleInput.resolutionId]: trustedRuleEvaluation(ruleInput),
        },
      }
    );
    const repositoryValue = 'repository-owner';
    const repositoryPath = 'src/domain/owner.ts';
    const repositoryRef = 'domain-owner';
    const repositoryContent = 'repository-evidence';
    const repositoryHash = sha256Text(repositoryContent);
    const repositoryInput = candidate('repository', 'repository_derived', {
      value: repositoryValue,
      semanticKind: 'target_ownership',
      premises: [{
        kind: 'repository',
        artifactPath: repositoryPath,
        hash: repositoryHash,
        candidateRef: repositoryRef,
        candidateValueHash: sha256Stable(repositoryValue),
      }],
    });
    const repositoryCandidates = [{
      candidateRef: repositoryRef,
      valueHash: sha256Stable(repositoryValue),
    }];
    const repositoryEvidencePayload = {
      canonicalPath: repositoryPath,
      content: repositoryContent,
      hash: repositoryHash,
      producerId: 'repository-observer-test',
      producerHash: sha256Stable('repository-observer-test-implementation'),
      observationId: 'repository-observation-test',
      resolutionRunId: String(
        invocationContextRegistry.get(repositoryInput.resolutionId)?.resolutionRunId
      ),
      candidates: repositoryCandidates,
      conflictingCandidates: [],
      candidateUniverseHash: sha256Stable(repositoryCandidates),
    };
    const repository = resolveSemanticField(repositoryInput, {
      trustedInvocationContext: invocationContextRegistry.get(repositoryInput.resolutionId),
      trustedRepositoryEvidence: {
        [repositoryPath]: {
          ...repositoryEvidencePayload,
          observationReceiptHash: sha256Stable(repositoryEvidencePayload),
        },
      },
    });

    for (const result of [source, rule, repository]) {
      expect(result.status).toBe('authorized');
      expect(result.receipt && validate(result.receipt), JSON.stringify(validate.errors)).toBe(true);
      const { receiptHash, ...payload } = result.receipt!;
      expect(receiptHash).toBe(sha256Stable(payload));
      const validateReceipt = Reflect.get(semanticResolver, 'validateSemanticResolutionReceipt');
      expect(typeof validateReceipt).toBe('function');
      expect(validateReceipt(result.receipt)).toBe(true);
      expect(validate({ ...result.receipt, unexpected: true })).toBe(false);
      expect(validateReceipt({ ...result.receipt, receiptHash: sha256Stable(result.receipt) }))
        .toBe(false);
    }
    expect(source.authorityState).toBe('source_grounded');
    expect(rule.authorityState).toBe('derived');
    expect(repository.authorityState).toBe('derived');
  });

  it('keeps hypotheses, business decisions, conflicts, and incomplete source proof blocking', () => {
    const cases = [
      candidate('hypothesis', 'model_hypothesis', { confidence: 0.999 }),
      candidate('decision', 'business_decision_required', { confidence: 1 }),
      candidate('conflict', 'repository_derived', {
        conflictingCandidates: ['candidate-a', 'candidate-b'],
      }),
      candidate('incomplete', 'source_extracted', {
        premises: [{ ...sourcePremise('incomplete', 'incomplete-value'), excerpt: '' }],
      }),
    ];

    for (const input of cases) {
      const result = resolveSemanticField(input);
      expect(result).toMatchObject({
        status: 'unresolved',
        authorityState: 'unresolved',
        blocking: true,
        receipt: null,
      });
    }
  });

  it('allows an allowlisted deterministic rule to transform exact source premises', () => {
    const input = candidate('normalized', 'rule_derived', {
      value: 'normalized-value',
      premises: [sourcePremise('normalized', 'raw source value')],
      derivationRule: 'normalize-source-value',
    });
    const result = resolveSemanticField(
      input,
      {
        ...trustedSourceOptions(input),
        allowlistedDerivationRules: ['normalize-source-value'],
        trustedRuleEvaluations: {
          [input.resolutionId]: trustedRuleEvaluation(input),
        },
      }
    );

    expect(result.status).toBe('authorized');
    expect(result.authorityState).toBe('derived');
  });

  it('rejects self-reported source and repository evidence without matching trusted authority', () => {
    const sourceInput = candidate('trusted-source', 'source_extracted');
    const trustedSource = trustedSourceOptions(sourceInput);
    const sourcePath = sourceInput.premises[0].kind === 'source'
      ? sourceInput.premises[0].sourcePath
      : '';
    const mismatchedSource = candidate('trusted-source', 'source_extracted', {
      premises: [{
        ...sourceInput.premises[0],
        excerpt: 'candidate-tampered-excerpt',
      } as never],
    });
    const repositoryValue = 'trusted-owner';
    const artifactPath = 'src/domain/trusted-owner.ts';
    const repositoryInput = candidate('trusted-repository', 'repository_derived', {
      value: repositoryValue,
      premises: [{
        kind: 'repository',
        artifactPath,
        hash: sha256Text('trusted-repository-bytes'),
        candidateRef: 'trusted-owner-ref',
        candidateValueHash: sha256Stable(repositoryValue),
      }],
    });
    const trustedRepositoryEvidence = {
      [artifactPath]: {
        canonicalPath: artifactPath,
        content: 'trusted-repository-bytes',
        hash: sha256Text('trusted-repository-bytes'),
        producerId: 'repository-observer-test',
        producerHash: sha256Stable('repository-observer-test-implementation'),
        observationId: 'duplicate-owner-observation',
        resolutionRunId: String(
          invocationContextRegistry.get(repositoryInput.resolutionId)?.resolutionRunId
        ),
        candidates: [
          { candidateRef: 'trusted-owner-ref', valueHash: sha256Stable(repositoryValue) },
          { candidateRef: 'trusted-owner-ref', valueHash: sha256Stable(repositoryValue) },
        ],
        conflictingCandidates: [],
        candidateUniverseHash: sha256Stable([
          { candidateRef: 'trusted-owner-ref', valueHash: sha256Stable(repositoryValue) },
          { candidateRef: 'trusted-owner-ref', valueHash: sha256Stable(repositoryValue) },
        ]),
        observationReceiptHash: '',
      },
    };
    const { observationReceiptHash: _ignored, ...repositoryPayload } =
      trustedRepositoryEvidence[artifactPath];
    trustedRepositoryEvidence[artifactPath].observationReceiptHash =
      sha256Stable(repositoryPayload);

    expect(resolveSemanticField(sourceInput, {
      trustedInvocationContext: invocationContextRegistry.get(sourceInput.resolutionId),
    }).reasonCode).toBe('trusted_source_snapshot_missing');
    expect(resolveSemanticField(mismatchedSource, trustedSource).reasonCode)
      .toBe('trusted_source_snapshot_mismatch');
    expect(sourcePath).not.toBe('');
    expect(resolveSemanticField(repositoryInput, {
      trustedInvocationContext: invocationContextRegistry.get(repositoryInput.resolutionId),
    }).reasonCode)
      .toBe('trusted_repository_evidence_missing');
    expect(resolveSemanticField(repositoryInput, {
      trustedInvocationContext: invocationContextRegistry.get(repositoryInput.resolutionId),
      trustedRepositoryEvidence,
    }).reasonCode)
      .toBe('trusted_repository_evidence_ambiguous');
  });

  it('rejects substring source matches without an independent typed extraction observation', () => {
    const content = 'retry limit is 100';
    const sourcePath = 'docs/requirements/retry-limit.md';
    const input = candidate('substring', 'source_extracted', {
      fieldRef: 'requirements.retry.limit',
      value: '1',
      premises: [{
        kind: 'source',
        sourcePath,
        sourceSpan: { startLine: 1, endLine: 1 },
        excerpt: content,
        hash: sha256Text(content),
      }],
    });

    expect(resolveSemanticField(input, {
      trustedSourceSnapshots: {
        [sourcePath]: { content, hash: sha256Text(content), extractions: [] },
      },
      trustedInvocationContext: invocationContextRegistry.get(input.resolutionId),
    }).reasonCode).toBe('trusted_source_extraction_mismatch');
  });

  it('rejects an allowlisted rule name when no trusted rule evaluation proves the output', () => {
    const input = candidate('forged-rule-output', 'rule_derived', {
      value: 'fabricated-output',
      premises: [sourcePremise('forged-rule-output', 'raw-source')],
      derivationRule: 'copy-source-value',
    });

    expect(resolveSemanticField(input, {
      ...trustedSourceOptions(input),
      allowlistedDerivationRules: ['copy-source-value'],
    }).reasonCode).toBe('trusted_rule_evaluation_missing');
  });

  it('rejects repository observations without canonical bytes and readback provenance', () => {
    const value = 'repository-owner';
    const artifactPath = 'src/domain/repository-owner.ts';
    const artifactHash = sha256Text('claimed-repository-bytes');
    const input = candidate('repository-readback', 'repository_derived', {
      value,
      semanticKind: 'target_ownership',
      premises: [{
        kind: 'repository',
        artifactPath,
        hash: artifactHash,
        candidateRef: 'repository-owner-symbol',
        candidateValueHash: sha256Stable(value),
      }],
    });

    expect(resolveSemanticField(input, {
      trustedInvocationContext: invocationContextRegistry.get(input.resolutionId),
      trustedRepositoryEvidence: {
        [artifactPath]: {
          hash: artifactHash,
          candidates: [{
            candidateRef: 'repository-owner-symbol',
            valueHash: sha256Stable(value),
          }],
        },
      },
    }).reasonCode).toBe('trusted_repository_readback_invalid');
  });

  it('rejects a valid repository observation bound to a stale resolution run', () => {
    const value = 'stale-repository-owner';
    const artifactPath = 'src/domain/stale-repository-owner.ts';
    const content = 'stale-repository-observation';
    const hash = sha256Text(content);
    const input = candidate('repository-stale-run', 'repository_derived', {
      value,
      semanticKind: 'target_ownership',
      premises: [{
        kind: 'repository',
        artifactPath,
        hash,
        candidateRef: 'stale-repository-owner-symbol',
        candidateValueHash: sha256Stable(value),
      }],
    });
    const candidates = [{
      candidateRef: 'stale-repository-owner-symbol',
      valueHash: sha256Stable(value),
    }];
    const observationPayload = {
      canonicalPath: artifactPath,
      content,
      hash,
      producerId: 'repository-observer-test',
      producerHash: sha256Stable('repository-observer-test-implementation'),
      observationId: 'stale-repository-observation-test',
      resolutionRunId: 'stale-resolution-run',
      candidates,
      conflictingCandidates: [],
      candidateUniverseHash: sha256Stable(candidates),
    };

    expect(resolveSemanticField(input, {
      trustedInvocationContext: invocationContextRegistry.get(input.resolutionId),
      trustedRepositoryEvidence: {
        [artifactPath]: {
          ...observationPayload,
          observationReceiptHash: sha256Stable(observationPayload),
        },
      },
    }).reasonCode).toBe('trusted_repository_evidence_stale');
  });

  it('rejects extra candidate fields and mixed premise kinds instead of filtering them', () => {
    const strictInput = candidate('strict-shape', 'source_extracted') as
      SemanticResolutionCandidate & { unexpected: string };
    strictInput.unexpected = 'claimant-owned-extra';
    const mixedPremiseInput = candidate('mixed-premise', 'source_extracted', {
      premises: [
        sourcePremise('mixed-premise', 'mixed-premise-value'),
        { kind: 'unknown', payload: 'discard-me' } as never,
      ],
    });

    expect(resolveSemanticField(strictInput, trustedSourceOptions(strictInput)).reasonCode)
      .toBe('malformed_semantic_candidate');
    expect(resolveSemanticField(
      mixedPremiseInput,
      trustedSourceOptions(mixedPremiseInput)
    ).reasonCode).toBe('malformed_semantic_candidate');
  });

  it('rejects claimant-owned resolver identity and model transition context', () => {
    const authorityCandidate = candidate('claimant-context', 'source_extracted');
    const trustedContext = invocationContextRegistry.get(authorityCandidate.resolutionId)!;
    const claimantOwnedContext = {
      ...authorityCandidate,
      ...trustedContext,
      sourceModelAfter: applySemanticFieldValue(
        trustedContext.sourceModelBefore,
        authorityCandidate.fieldRef,
        authorityCandidate.value
      ),
    };

    expect(
      resolveSemanticField(claimantOwnedContext, trustedSourceOptions(authorityCandidate)).reasonCode
    ).toBe('malformed_semantic_candidate');
  });

  it('rejects rehashed receipts with impossible spans or proof-class mismatches', () => {
    const input = candidate('receipt-invariants', 'source_extracted');
    const result = resolveSemanticField(input, trustedSourceOptions(input));
    expect(result.status).toBe('authorized');
    const receipt = result.receipt!;
    const validateReceipt = Reflect.get(semanticResolver, 'validateSemanticResolutionReceipt') as
      (value: unknown) => boolean;
    const impossibleSpanPayload = {
      ...receipt,
      premises: [{
        ...receipt.premises[0],
        sourceSpan: { startLine: 3, endLine: 2 },
      }],
    } as Record<string, unknown>;
    delete impossibleSpanPayload.receiptHash;
    const wrongClassPayload = {
      ...receipt,
      resolutionAuthorityClass: 'repository_derived',
    } as Record<string, unknown>;
    delete wrongClassPayload.receiptHash;

    expect(validateReceipt({
      ...impossibleSpanPayload,
      receiptHash: sha256Stable(impossibleSpanPayload),
    })).toBe(false);
    expect(validateReceipt({
      ...wrongClassPayload,
      receiptHash: sha256Stable(wrongClassPayload),
    })).toBe(false);
  });

  it('fails closed for malformed unknown runtime input without throwing', () => {
    const malformed = [
      null,
      {},
      { resolutionAuthorityClass: 'source_extracted', premises: null },
      { resolutionAuthorityClass: 'repository_derived', conflictingCandidates: null },
    ];

    for (const input of malformed) {
      expect(() => resolveSemanticField(input as never)).not.toThrow();
      expect(resolveSemanticField(input as never).reasonCode).toBe('malformed_semantic_candidate');
    }
  });
});
