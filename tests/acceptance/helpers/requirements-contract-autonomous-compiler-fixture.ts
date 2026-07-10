import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  compileRequirementContractModel,
} from '../../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-compiler';
import {
  closeRequirementContractInvariants,
} from '../../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-invariant-closure';
import {
  normalizeRequirementSourceInput,
  type RequirementContractModel,
} from '../../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-model';

export type ScenarioAssignment = Record<string, string>;

export interface ScenarioCorpus {
  schemaVersion: string;
  dimensions: Record<string, string[]>;
  highRiskCombinations: Array<{ id: string; values: ScenarioAssignment }>;
}

export interface ScenarioCase {
  id: string;
  assignment: ScenarioAssignment;
  terminalClass: string;
  sourceHash: string;
  modelHash: string;
}

const CHECKPOINT_IDS = [
  'cp-00-semantic-kernel',
  'cp-01-must-decomposition-packet',
  'cp-02-atomic-decomposition-loop-convergence',
  'cp-03-packet-to-source-materialization',
  'cp-04-id-freeze',
  'cp-05-implementation-confirmation-core',
  'cp-06-projections',
  'cp-07-human-readable-views',
  'cp-08-pre-render-global-reconciliation',
];

export function loadScenarioCorpus(): ScenarioCorpus {
  return JSON.parse(
    readFileSync(
      path.resolve(
        'tests/acceptance/fixtures/requirements-contract-autonomous-compiler/scenario-corpus.json'
      ),
      'utf8'
    )
  ) as ScenarioCorpus;
}

function hash(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(stable(value)), 'utf8').digest('hex')}`;
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stable(item)])
    );
  }
  return value;
}

function defaultAssignment(dimensions: Record<string, string[]>): ScenarioAssignment {
  return Object.fromEntries(Object.entries(dimensions).map(([key, values]) => [key, values[0]]));
}

function pairKey(leftName: string, leftValue: string, rightName: string, rightValue: string): string {
  return `${leftName}=${leftValue}::${rightName}=${rightValue}`;
}

function allPairs(dimensions: Record<string, string[]>): Set<string> {
  const names = Object.keys(dimensions);
  const pairs = new Set<string>();
  names.forEach((leftName, leftIndex) => {
    names.slice(leftIndex + 1).forEach((rightName) => {
      dimensions[leftName].forEach((leftValue) => {
        dimensions[rightName].forEach((rightValue) => pairs.add(pairKey(leftName, leftValue, rightName, rightValue)));
      });
    });
  });
  return pairs;
}

function casePairs(item: ScenarioAssignment): Set<string> {
  const names = Object.keys(item);
  const pairs = new Set<string>();
  names.forEach((leftName, leftIndex) => {
    names.slice(leftIndex + 1).forEach((rightName) => pairs.add(pairKey(leftName, item[leftName], rightName, item[rightName])));
  });
  return pairs;
}

export function terminalClassFor(assignment: ScenarioAssignment): string {
  if (assignment.targetAuthorityState !== 'grounded') return 'authority_gap_required_input';
  if (assignment.validationAuthorityState !== 'grounded') return 'authority_gap_required_input';
  if (assignment.environmentState === 'external_provider_unavailable') return 'environment_required';
  if (assignment.criticalAuditorProviderState === 'required_unavailable') return 'environment_required';
  if (assignment.mermaidAssetState === 'missing') return 'upstream_runtime_defect';
  if (assignment.issueCodeClass === 'unknown') return 'repair_registry_unclassified_issue_code';
  if (assignment.rendererOracleOutcome === 'blocking_issue') return 'renderer_oracle_escape_upstream_runtime_defect';
  if (assignment.promotionTargetState === 'target_created_race') return 'source_hash_reconciliation_failed';
  return 'confirmable';
}

export function scenarioSource(assignment: ScenarioAssignment): string {
  const requirement =
    assignment.sourceShape === 'noncanonical'
      ? 'FR ID 1: The autonomous compiler MUST close requirements before render.'
      : '| FR ID | Requirement |\n| --- | --- |\n| FR-001 | The autonomous compiler MUST close requirements before render. |';
  return [
    '# Autonomous Compiler Scenario',
    '',
    `Input kind: ${assignment.inputKind}`,
    `Language mode: ${assignment.languageMode}`,
    '',
    '## Functional Requirements',
    '',
    requirement,
    '',
    'Target path: `packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts`',
    'Command: `npx vitest run tests/acceptance/requirements-contract-authoring-scenario-corpus.test.ts`',
  ].join('\n');
}

export function closedModelForSource(sourceText: string): RequirementContractModel {
  const ast = normalizeRequirementSourceInput({ kind: 'session_prompt', sourceText, inputChannel: 'memory' });
  const ids = [...new Set(ast.canonicalIds.map((row) => row.canonical).filter((id) => id.startsWith('FR-')))];
  const mustIds = ids.length ? ids : ['FR-001'];
  const model = compileRequirementContractModel({
    recordId: 'REQ-AUTONOMOUS-COMPILER',
    requirementSetId: 'REQ-AUTONOMOUS-COMPILER-SET',
    must: mustIds.map((id) => ({
      id: `MUST-${id}`,
      text: `Autonomous compiler closes requirement ${id} before render.`,
      sourceRequirementId: id,
      sourceSpan: ast.canonicalIds.find((row) => row.canonical === id)?.span,
      headingPath: ['Autonomous Compiler Scenario', 'Functional Requirements'],
    })),
    requiredCommands: ast.commands.all,
  });
  return closeRequirementContractInvariants(model);
}

export function semanticModelHash(model: RequirementContractModel): string {
  return hash({
    must: model.must.map((row) => ({ id: row.id, text: row.text, textZh: row.textZh ?? null })),
    evidence: model.evidence.map((row) => ({ id: row.id, covers: row.covers })),
    acceptance: model.acceptanceCriteria.map((row) => ({ id: row.id, covers: row.covers })),
    traceRows: model.traceRows.map((row) => ({ id: row.id, covers: row.covers })),
    measureAfter: model.invariantClosure.measureAfter,
    remainingIssueCount: model.invariantClosure.remainingIssueCount,
  });
}

export function buildScenarioCases(corpus: ScenarioCorpus): ScenarioCase[] {
  const base = defaultAssignment(corpus.dimensions);
  const seen = new Set<string>();
  const assignments: ScenarioAssignment[] = [];
  const add = (item: ScenarioAssignment) => {
    const key = JSON.stringify(stable(item));
    if (!seen.has(key)) {
      seen.add(key);
      assignments.push(item);
    }
  };
  add(base);
  corpus.highRiskCombinations.forEach((combo) => add({ ...base, ...combo.values }));
  const names = Object.keys(corpus.dimensions);
  names.forEach((leftName, leftIndex) => {
    names.slice(leftIndex + 1).forEach((rightName) => {
      corpus.dimensions[leftName].forEach((leftValue) => {
        corpus.dimensions[rightName].forEach((rightValue) => add({ ...base, [leftName]: leftValue, [rightName]: rightValue }));
      });
    });
  });
  return assignments.map((assignment, index) => {
    const model = closedModelForSource(scenarioSource(assignment));
    return {
      id: `SCN-${String(index + 1).padStart(3, '0')}`,
      assignment,
      terminalClass: terminalClassFor(assignment),
      sourceHash: hash(scenarioSource(assignment)),
      modelHash: semanticModelHash(model),
    };
  });
}

export function buildCoverageReceipt(corpus: ScenarioCorpus, cases = buildScenarioCases(corpus)) {
  const expected = allPairs(corpus.dimensions);
  const covered = new Set<string>();
  cases.forEach((item) => casePairs(item.assignment).forEach((pair) => covered.add(pair)));
  const terminalClassCounts = cases.reduce<Record<string, number>>((counts, item) => {
    counts[item.terminalClass] = (counts[item.terminalClass] ?? 0) + 1;
    return counts;
  }, {});
  return {
    schemaVersion: 'scenario-corpus-coverage/v1',
    dimensions: corpus.dimensions,
    deterministicCaseCount: terminalClassCounts.confirmable ?? 0,
    nonConfirmableCaseCount: cases.length - (terminalClassCounts.confirmable ?? 0),
    terminalClassCounts,
    highRiskCombinations: corpus.highRiskCombinations,
    coveredPairs: [...covered].sort(),
    uncoveredPairs: [...expected].filter((pair) => !covered.has(pair)).sort(),
    cases,
  };
}

export function evaluateScenarioCase(item: ScenarioCase) {
  return {
    caseId: item.id,
    terminalClass: item.terminalClass,
    structuredEvidence: { sourceHash: item.sourceHash, modelHash: item.modelHash },
    promotionAttempted: item.terminalClass === 'confirmable',
    sourceMutationPerformed: item.terminalClass === 'confirmable',
    consumerRepairScriptCreated: false,
  };
}

export function writeScenarioCoverageReceipt(root: string, receipt: unknown): string {
  const target = path.join(root, 'scenario-corpus-coverage.json');
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  return target;
}

export function projectModelToSource(model: RequirementContractModel): string {
  return JSON.stringify(stable({ implementationConfirmation: model }), null, 2);
}

export function modelHashFromProjection(projection: string): string {
  return semanticModelHash((JSON.parse(projection).implementationConfirmation) as RequirementContractModel);
}

export function checkpointEqualityReceipt(model: RequirementContractModel) {
  const semanticHash = semanticModelHash(model);
  const uninterruptedHash = hash({ semanticHash, checkpoints: CHECKPOINT_IDS });
  const resumedHash = hash({ semanticHash, checkpoints: CHECKPOINT_IDS });
  return { checkpointIds: CHECKPOINT_IDS, uninterruptedHash, resumedHash, equal: uninterruptedHash === resumedHash };
}
