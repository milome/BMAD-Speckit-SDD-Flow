import type { GoalExecutionIR } from './goal-execution-ir';
import { sha256Stable, stableStringify } from '../../../main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import { assertJudgePayloadBudget } from '../../../main-agent/source-authority/scripts/requirements-contract-judge-payload-budget';
import {
  decodeGoalSemanticDictionary,
  encodeGoalSemanticDictionary,
  encodeGoalSemanticDictionaryForEncoding,
  type GoalSemanticDictionary,
} from './goal-semantic-dictionary';
import { validateGoalExecutionIR } from './goal-execution-ir';
import { projectRequirementsTypedGoalObligations } from './goal-requirements-typed-bridge';
import { validateGoalContractSchema } from './schema-registry';

type Row = Record<string, unknown>;
const VERSION = 'GoalExecutionAuthority/v2';
const record = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const fail = (code: string): never => { throw new Error(`goal_execution_authority_${code}`); };

function validateExpanded(value: unknown): GoalExecutionIR {
  if (validateGoalExecutionIR(value).decision !== 'pass') fail('semantic_invalid');
  return value as GoalExecutionIR;
}

function buildAuthority(
  ir: GoalExecutionIR,
  recipe = ir.profile === 'requirements_backed' ? 'requirements_typed_obligations/v1' : 'standalone_obligation_aliases/v1',
  encodingSource?: GoalSemanticDictionary,
): Row {
  const projection = structuredClone(ir) as Row;
  const aliases = ir.obligations.map((obligation) => ({ aliasId: `${ir.profile}:${obligation.obligationId}`,
    obligationId: obligation.obligationId, sourceRefs: obligation.sourceRefs }));
  if (recipe !== 'full_goal/v1') {
    if (sha256Stable(ir.aliases) !== sha256Stable(aliases)) fail('projection_invalid');
    delete projection.aliases;
  }
  if (ir.profile === 'requirements_backed') {
    const expected = projectRequirementsTypedGoalObligations(ir.semanticSource, ir.logicalSpecSpans);
    if (sha256Stable(ir.obligations) !== sha256Stable(expected)) fail('projection_invalid');
    projection.obligations = ir.obligations.map((obligation) => ({ typedSourceNodeRef: obligation.obligationId }));
  }
  const goal = encodingSource === undefined
    ? encodeGoalSemanticDictionary(projection)
    : encodeGoalSemanticDictionaryForEncoding(projection, encodingSource.nodeEncoding);
  const payload = { schemaVersion: VERSION, projectionRecipe: recipe,
    goalExecutionIRHash: ir.goalExecutionIRHash, goal };
  return { ...payload, goalExecutionAuthorityHash: sha256Stable(payload) };
}

function budget(authority: Row): void {
  assertJudgePayloadBudget({ serializedPayload: `${stableStringify(authority)}\n`, stage: 'goal_execution_authority',
    sourceHash: String(authority.goalExecutionIRHash) });
}

export function normalizeGoalExecutionAuthority(value: GoalExecutionIR): GoalExecutionIR | Row {
  const ir = validateExpanded(value);
  if (ir.schemaVersion === 'GoalExecutionIR/v1') return ir;
  const authority = buildAuthority(ir);
  validateGoalContractSchema('goal-execution-authority.schema.json', authority);
  budget(authority);
  return authority;
}

export function resolveGoalExecutionAuthority(value: unknown): GoalExecutionIR {
  const authority = record(value);
  if (authority.schemaVersion === 'GoalExecutionIR/v1') return validateExpanded(authority);
  if (authority.schemaVersion !== VERSION) fail('version_invalid');
  validateGoalContractSchema('goal-execution-authority.schema.json', authority);
  budget(authority);
  const { goalExecutionAuthorityHash, ...payload } = authority;
  if (goalExecutionAuthorityHash !== sha256Stable(payload)) fail('hash_mismatch');
  const expanded = record(decodeGoalSemanticDictionary(authority.goal));
  if (!['GoalExecutionIR/v2', 'GoalExecutionIR/v3'].includes(String(expanded.schemaVersion))) fail('version_invalid');
  if (authority.projectionRecipe === 'requirements_typed_obligations/v1') {
    if (expanded.profile !== 'requirements_backed' || expanded.aliases !== undefined || !Array.isArray(expanded.obligations)) fail('projection_invalid');
    const expected = projectRequirementsTypedGoalObligations(record(expanded.semanticSource), expanded.logicalSpecSpans as Row[]);
    const expectedRefs = expected.map((obligation) => ({ typedSourceNodeRef: obligation.obligationId }));
    if (sha256Stable(expanded.obligations) !== sha256Stable(expectedRefs)) fail('source_node_refs_invalid');
    expanded.obligations = expected;
    expanded.aliases = expected.map((obligation) => ({ aliasId: `requirements_backed:${obligation.obligationId}`,
      obligationId: obligation.obligationId, sourceRefs: obligation.sourceRefs }));
  } else {
    if (expanded.profile !== 'standalone') fail('projection_invalid');
    if (authority.projectionRecipe === 'standalone_obligation_aliases/v1') {
      if (expanded.aliases !== undefined || !Array.isArray(expanded.obligations)) fail('projection_invalid');
      expanded.aliases = (expanded.obligations as Row[]).map((obligation) => ({ aliasId: `standalone:${obligation.obligationId}`,
        obligationId: obligation.obligationId, sourceRefs: obligation.sourceRefs }));
    }
  }
  const ir = validateExpanded(expanded);
  if (ir.goalExecutionIRHash !== authority.goalExecutionIRHash) fail('semantic_hash_mismatch');
  if (sha256Stable(buildAuthority(ir, String(authority.projectionRecipe), authority.goal as GoalSemanticDictionary)) !== sha256Stable(authority)) fail('canonical_projection_mismatch');
  return ir;
}
