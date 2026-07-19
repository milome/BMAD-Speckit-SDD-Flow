import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import yaml from 'js-yaml';
import {
  REQUIREMENT_CONTRACT_MODEL_V2_ACTIVATION_STATE,
  type RequirementContractModelV2,
  type RequirementContractRequirementKind,
  type RequirementContractRequirementV2,
} from './requirements-contract-model';
import { parseRequirementsContractSourceText } from './requirements-contract-source-parser';
import { requirementsContractTraceEdgeTypeRegistryHash } from '../rules/requirements-contract-trace-edge-type-registry';
import { sha256Stable } from './requirements-contract-semantic-resolver';

export interface RequirementsContractV1LegacyInventoryRow {
  sourcePath: string;
  sourceHash: string;
  v1ParserFormatProofHash: string;
  requirementSetId: string;
  cutoverId: string;
  cutoverPredecessorArtifact12Hash: string;
  baselineInventoryProof: {
    path: string;
    hash: string;
  };
  legacyReadEligibility: 'eligible';
}

export interface RequirementsContractV1ReadEligibilityInput {
  projectRoot: string;
  source: {
    path: string;
    hash: string;
    requirementSetId: string;
    cutoverId: string;
  };
  expected: {
    v1FormatProofHash: string;
    cutoverPredecessorHash: string;
    writerHash: string;
    g00BaselineHash: string;
    freezeTransactionId: string;
  };
  authority: {
    kind: 'frozen_inventory';
    inventoryRef: { path: string; hash: string };
    freezeReceiptRef: { path: string; hash: string };
  };
}

export interface RequirementsContractV1ReadEligibilityIssue {
  code:
    | 'legacy_source_missing'
    | 'legacy_source_hash_mismatch'
    | 'legacy_inventory_missing'
    | 'legacy_inventory_hash_mismatch'
    | 'legacy_inventory_invalid'
    | 'legacy_inventory_freeze_missing'
    | 'legacy_inventory_freeze_hash_mismatch'
    | 'legacy_inventory_freeze_invalid'
    | 'legacy_inventory_freeze_schema_hash_mismatch'
    | 'legacy_inventory_freeze_writer_hash_mismatch'
    | 'legacy_inventory_freeze_cutover_mismatch'
    | 'legacy_inventory_freeze_predecessor_mismatch'
    | 'legacy_inventory_freeze_baseline_mismatch'
    | 'legacy_inventory_freeze_transaction_mismatch'
    | 'legacy_inventory_freeze_row_count_mismatch'
    | 'legacy_inventory_row_missing'
    | 'legacy_inventory_row_ambiguous'
    | 'legacy_inventory_row_source_mismatch'
    | 'legacy_inventory_row_format_proof_mismatch'
    | 'legacy_inventory_row_cutover_mismatch'
    | 'legacy_inventory_row_predecessor_mismatch';
  path: string;
  message: string;
}

export interface RequirementsContractV1ReadEligibilityResult {
  ok: boolean;
  decision: 'pass' | 'block';
  issues: RequirementsContractV1ReadEligibilityIssue[];
  row: RequirementsContractV1LegacyInventoryRow | null;
}

export interface RequirementsContractV1ReadResult {
  ok: boolean;
  decision: 'pass' | 'block';
  issues: Array<{
    code:
      | 'legacy_eligibility_invalid'
      | 'legacy_source_parse_failed'
      | 'legacy_confirmation_missing'
      | 'legacy_format_version_mismatch'
      | 'legacy_format_proof_mismatch'
      | 'legacy_requirement_invalid';
    path: string;
    message: string;
  }>;
  logicalModel: RequirementContractModelV2 | null;
  traceGraph: Record<string, unknown> | null;
}

function sha256File(filePath: string): string {
  return `sha256:${createHash('sha256').update(readFileSync(filePath)).digest('hex')}`;
}

function resolvesInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function resolveRef(projectRoot: string, ref: { path: string; hash: string }): string | null {
  const resolved = path.resolve(projectRoot, ref.path);
  return resolvesInside(path.resolve(projectRoot), resolved) ? resolved : null;
}

function schemaDocument(): Record<string, unknown> {
  const fileName = 'requirements-contract-v1-legacy-inventory.schema.json';
  const candidates = [
    path.resolve(
      process.cwd(),
      'packages',
      'bmad-speckit',
      'src',
      'main-agent',
      'source-authority',
      'schemas',
      fileName
    ),
    path.resolve(__dirname, '..', 'schemas', fileName),
  ];
  const schemaPath = candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
  return JSON.parse(readFileSync(schemaPath, 'utf8')) as Record<string, unknown>;
}

function schemaFilePath(): string {
  const fileName = 'requirements-contract-v1-legacy-inventory.schema.json';
  const candidates = [
    path.resolve(
      process.cwd(),
      'packages',
      'bmad-speckit',
      'src',
      'main-agent',
      'source-authority',
      'schemas',
      fileName
    ),
    path.resolve(__dirname, '..', 'schemas', fileName),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

function parseJsonObject(filePath: string): Record<string, unknown> {
  const value: unknown = JSON.parse(readFileSync(filePath, 'utf8'));
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('JSON root must be an object');
  }
  return value as Record<string, unknown>;
}

function addEligibilityIssue(
  issues: RequirementsContractV1ReadEligibilityIssue[],
  issue: RequirementsContractV1ReadEligibilityIssue
): void {
  if (issues.some((candidate) => candidate.code === issue.code && candidate.path === issue.path)) {
    return;
  }
  issues.push(issue);
}

export function resolveRequirementsContractV1ReadEligibility(
  input: RequirementsContractV1ReadEligibilityInput
): RequirementsContractV1ReadEligibilityResult {
  const issues: RequirementsContractV1ReadEligibilityIssue[] = [];
  const projectRoot = path.resolve(input.projectRoot);
  const sourcePath = path.resolve(projectRoot, input.source.path);
  if (!resolvesInside(projectRoot, sourcePath) || !existsSync(sourcePath)) {
    addEligibilityIssue(issues, {
      code: 'legacy_source_missing',
      path: input.source.path,
      message: 'legacy source is missing or outside the project root',
    });
  } else if (sha256File(sourcePath) !== input.source.hash) {
    addEligibilityIssue(issues, {
      code: 'legacy_source_hash_mismatch',
      path: input.source.path,
      message: 'legacy source bytes do not match the registered source hash',
    });
  }

  const inventoryPath = resolveRef(projectRoot, input.authority.inventoryRef);
  if (!inventoryPath || !existsSync(inventoryPath)) {
    addEligibilityIssue(issues, {
      code: 'legacy_inventory_missing',
      path: input.authority.inventoryRef.path,
      message: 'frozen legacy inventory is missing or outside the project root',
    });
    return { ok: false, decision: 'block', issues, row: null };
  }
  if (sha256File(inventoryPath) !== input.authority.inventoryRef.hash) {
    addEligibilityIssue(issues, {
      code: 'legacy_inventory_hash_mismatch',
      path: input.authority.inventoryRef.path,
      message: 'frozen legacy inventory bytes do not match the registered hash',
    });
  }

  let inventory: Record<string, unknown>;
  try {
    inventory = parseJsonObject(inventoryPath);
  } catch (error) {
    addEligibilityIssue(issues, {
      code: 'legacy_inventory_invalid',
      path: input.authority.inventoryRef.path,
      message: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, decision: 'block', issues, row: null };
  }
  const schema = schemaDocument();
  const validateInventory = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
  if (!validateInventory(inventory)) {
    addEligibilityIssue(issues, {
      code: 'legacy_inventory_invalid',
      path: input.authority.inventoryRef.path,
      message: JSON.stringify(validateInventory.errors ?? []),
    });
  }

  const freezePath = resolveRef(projectRoot, input.authority.freezeReceiptRef);
  if (!freezePath || !existsSync(freezePath)) {
    addEligibilityIssue(issues, {
      code: 'legacy_inventory_freeze_missing',
      path: input.authority.freezeReceiptRef.path,
      message: 'legacy inventory freeze receipt is missing or outside the project root',
    });
    return { ok: false, decision: 'block', issues, row: null };
  }
  if (sha256File(freezePath) !== input.authority.freezeReceiptRef.hash) {
    addEligibilityIssue(issues, {
      code: 'legacy_inventory_freeze_hash_mismatch',
      path: input.authority.freezeReceiptRef.path,
      message: 'legacy inventory freeze receipt bytes do not match the registered hash',
    });
  }

  let freezeReceipt: Record<string, unknown>;
  try {
    freezeReceipt = parseJsonObject(freezePath);
  } catch (error) {
    addEligibilityIssue(issues, {
      code: 'legacy_inventory_freeze_invalid',
      path: input.authority.freezeReceiptRef.path,
      message: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, decision: 'block', issues, row: null };
  }
  const definitions = schema.$defs as Record<string, unknown> | undefined;
  const validateFreeze = new Ajv2020({ allErrors: true, strict: false }).compile(
    (definitions?.freezeReceipt ?? {}) as object
  );
  if (!validateFreeze(freezeReceipt)) {
    addEligibilityIssue(issues, {
      code: 'legacy_inventory_freeze_invalid',
      path: input.authority.freezeReceiptRef.path,
      message: JSON.stringify(validateFreeze.errors ?? []),
    });
  }

  const rows = Array.isArray(inventory.rows) ? inventory.rows : [];
  const comparisons: Array<{
    matches: boolean;
    code: RequirementsContractV1ReadEligibilityIssue['code'];
    path: string;
    message: string;
  }> = [
    {
      matches: freezeReceipt.inventoryHash === input.authority.inventoryRef.hash,
      code: 'legacy_inventory_freeze_hash_mismatch',
      path: `${input.authority.freezeReceiptRef.path}#/inventoryHash`,
      message: 'freeze receipt inventory hash does not bind the frozen inventory bytes',
    },
    {
      matches: freezeReceipt.inventorySchemaHash === sha256File(schemaFilePath()),
      code: 'legacy_inventory_freeze_schema_hash_mismatch',
      path: `${input.authority.freezeReceiptRef.path}#/inventorySchemaHash`,
      message: 'freeze receipt schema hash does not bind the canonical inventory schema',
    },
    {
      matches: freezeReceipt.writerHash === input.expected.writerHash,
      code: 'legacy_inventory_freeze_writer_hash_mismatch',
      path: `${input.authority.freezeReceiptRef.path}#/writerHash`,
      message: 'freeze receipt writer hash does not match the registered writer',
    },
    {
      matches:
        freezeReceipt.cutoverId === input.source.cutoverId &&
        inventory.cutoverId === input.source.cutoverId,
      code: 'legacy_inventory_freeze_cutover_mismatch',
      path: `${input.authority.freezeReceiptRef.path}#/cutoverId`,
      message: 'freeze receipt or inventory cutover identity does not match the request',
    },
    {
      matches:
        freezeReceipt.predecessorHash === input.expected.cutoverPredecessorHash &&
        inventory.cutoverPredecessorArtifact12Hash ===
          input.expected.cutoverPredecessorHash,
      code: 'legacy_inventory_freeze_predecessor_mismatch',
      path: `${input.authority.freezeReceiptRef.path}#/predecessorHash`,
      message: 'freeze receipt or inventory predecessor hash does not match',
    },
    {
      matches:
        freezeReceipt.g00BaselineHash === input.expected.g00BaselineHash &&
        inventory.g00BaselineHash === input.expected.g00BaselineHash,
      code: 'legacy_inventory_freeze_baseline_mismatch',
      path: `${input.authority.freezeReceiptRef.path}#/g00BaselineHash`,
      message: 'freeze receipt and inventory do not bind the registered G00 baseline hash',
    },
    {
      matches: freezeReceipt.freezeTransactionId === input.expected.freezeTransactionId,
      code: 'legacy_inventory_freeze_transaction_mismatch',
      path: `${input.authority.freezeReceiptRef.path}#/freezeTransactionId`,
      message: 'freeze receipt transaction identity does not match the registered freeze',
    },
    {
      matches: freezeReceipt.rowCount === rows.length,
      code: 'legacy_inventory_freeze_row_count_mismatch',
      path: `${input.authority.freezeReceiptRef.path}#/rowCount`,
      message: 'freeze receipt row count does not bind the inventory',
    },
  ];
  for (const comparison of comparisons) {
    if (!comparison.matches) {
      addEligibilityIssue(issues, {
        code: comparison.code,
        path: comparison.path,
        message: comparison.message,
      });
    }
  }

  const requirementRows = rows.filter(
    (row) =>
      row &&
      typeof row === 'object' &&
      !Array.isArray(row) &&
      (row as Record<string, unknown>).requirementSetId === input.source.requirementSetId
  ) as unknown as RequirementsContractV1LegacyInventoryRow[];
  if (requirementRows.length === 0) {
    addEligibilityIssue(issues, {
      code: 'legacy_inventory_row_missing',
      path: input.authority.inventoryRef.path,
      message: `legacy inventory row is missing: ${input.source.requirementSetId}`,
    });
  } else if (requirementRows.length > 1) {
    addEligibilityIssue(issues, {
      code: 'legacy_inventory_row_ambiguous',
      path: input.authority.inventoryRef.path,
      message: `legacy inventory row is ambiguous: ${input.source.requirementSetId}`,
    });
  }
  const row = requirementRows.length === 1 ? requirementRows[0] : null;
  if (row) {
    if (row.sourcePath !== input.source.path || row.sourceHash !== input.source.hash) {
      addEligibilityIssue(issues, {
        code: 'legacy_inventory_row_source_mismatch',
        path: input.authority.inventoryRef.path,
        message: 'legacy inventory row source identity does not match the request',
      });
    }
    if (row.v1ParserFormatProofHash !== input.expected.v1FormatProofHash) {
      addEligibilityIssue(issues, {
        code: 'legacy_inventory_row_format_proof_mismatch',
        path: input.authority.inventoryRef.path,
        message: 'legacy inventory row format proof does not match the registered proof',
      });
    }
    if (row.cutoverId !== input.source.cutoverId) {
      addEligibilityIssue(issues, {
        code: 'legacy_inventory_row_cutover_mismatch',
        path: input.authority.inventoryRef.path,
        message: 'legacy inventory row cutover identity does not match',
      });
    }
    if (
      row.cutoverPredecessorArtifact12Hash !== input.expected.cutoverPredecessorHash
    ) {
      addEligibilityIssue(issues, {
        code: 'legacy_inventory_row_predecessor_mismatch',
        path: input.authority.inventoryRef.path,
        message: 'legacy inventory row predecessor hash does not match',
      });
    }
  }

  return {
    ok: issues.length === 0,
    decision: issues.length === 0 ? 'pass' : 'block',
    issues,
    row: issues.length === 0 && row ? structuredClone(row) : null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function requirementsContractV1FormatProofHash(
  confirmation: Record<string, unknown>
): string {
  return sha256Stable({
    rootKeys: Object.keys(confirmation).sort(),
    contractSchemaVersion: confirmation.contractSchemaVersion,
  });
}

function canonicalLegacyRequirementId(id: string, kind: RequirementContractRequirementKind): string {
  if (/^(?:MUST-(?:FR|NFR)-\d{3}|NEG-\d{3}|OUT-\d{3})$/u.test(id)) return id;
  const match = id.match(/(\d{1,5})$/u);
  if (!match) throw new Error(`legacy requirement id is invalid: ${id}`);
  const ordinal = String(Number(match[1])).padStart(3, '0');
  if (kind === 'negative') return `NEG-${ordinal}`;
  if (kind === 'out_of_scope') return `OUT-${ordinal}`;
  return `MUST-FR-${ordinal}`;
}

function legacyRequirements(
  confirmation: Record<string, unknown>,
  sourcePath: string,
  sourceHash: string,
  sourceLine: number
): RequirementContractRequirementV2[] {
  const groups: Array<{
    field: string;
    kind: RequirementContractRequirementKind;
  }> = [
    { field: 'must', kind: 'functional' },
    { field: 'notDone', kind: 'negative' },
    { field: 'outOfScope', kind: 'out_of_scope' },
  ];
  return groups.flatMap(({ field, kind }) => {
    const rows = Array.isArray(confirmation[field]) ? confirmation[field] : [];
    return rows.map((candidate, index) => {
      if (!isRecord(candidate) || typeof candidate.id !== 'string') {
        throw new Error(`legacy requirement row is invalid: ${field}[${index}]`);
      }
      const text =
        typeof candidate.text === 'string' && candidate.text.trim()
          ? candidate.text.trim()
          : String(candidate.id);
      const id = canonicalLegacyRequirementId(candidate.id, kind);
      return {
        id,
        kind,
        schemaVersion: 'requirement-contract-requirement/v2' as const,
        text,
        source: {
          sourcePath,
          sourceSpan: { startLine: sourceLine, endLine: sourceLine },
          sourceHash,
          sourceRequirementId: candidate.id,
          headingPath: ['implementationConfirmation', field],
        },
        semantics: {
          actor: typeof candidate.actor === 'string' ? candidate.actor : null,
          trigger: typeof candidate.trigger === 'string' ? candidate.trigger : null,
          preconditions: Array.isArray(candidate.preconditions)
            ? candidate.preconditions.map(String)
            : [],
          action: text,
          postconditions: Array.isArray(candidate.postconditions)
            ? candidate.postconditions.map(String)
            : [],
          invariants: Array.isArray(candidate.invariants)
            ? candidate.invariants.map(String)
            : [],
          thresholds: Array.isArray(candidate.thresholds)
            ? candidate.thresholds.map(String)
            : [],
        },
        authority: {
          authorityState: 'source_grounded' as const,
          derivation: 'v1_legacy_adapter',
          decisionReceiptRef: null,
        },
        applicability: {
          state: 'applicable' as const,
          reasonCode: 'frozen_v1_legacy_inventory',
        },
        unresolved: [],
        verification: {
          method: 'legacy_contract',
          oracleRef:
            typeof candidate.oracleRef === 'string' ? candidate.oracleRef : null,
          commandRefs: Array.isArray(candidate.commandRefs)
            ? candidate.commandRefs.map(String)
            : [],
          expectedObservationRefs: Array.isArray(candidate.expectedObservationRefs)
            ? candidate.expectedObservationRefs.map(String)
            : [],
        },
        bindings: {
          targetRefs: Array.isArray(candidate.targetRefs)
            ? candidate.targetRefs.map(String)
            : [],
          artifactRefs: Array.isArray(candidate.artifactRefs)
            ? candidate.artifactRefs.map(String)
            : [],
          traceEdgeRefs: Array.isArray(candidate.traceEdgeRefs)
            ? candidate.traceEdgeRefs.map(String)
            : [],
        },
      };
    });
  });
}

export function readRequirementsContractV1Source(input: {
  projectRoot: string;
  eligibility: RequirementsContractV1ReadEligibilityResult;
}): RequirementsContractV1ReadResult {
  if (!input.eligibility.ok || !input.eligibility.row) {
    return {
      ok: false,
      decision: 'block',
      issues: [
        {
          code: 'legacy_eligibility_invalid',
          path: '/',
          message: 'V1 source cannot be read without verified eligibility',
        },
      ],
      logicalModel: null,
      traceGraph: null,
    };
  }
  const row = input.eligibility.row;
  const sourcePath = path.resolve(input.projectRoot, row.sourcePath);
  const sourceText = readFileSync(sourcePath, 'utf8');
  const parsed = parseRequirementsContractSourceText(sourceText, {
    sourcePath: row.sourcePath,
  });
  if (!parsed.ok) {
    return {
      ok: false,
      decision: 'block',
      issues: parsed.issues.map((issue) => ({
        code: 'legacy_source_parse_failed' as const,
        path: row.sourcePath,
        message: `${issue.code}:${issue.startLine}:${issue.message}`,
      })),
      logicalModel: null,
      traceGraph: null,
    };
  }
  if (parsed.document.yamlRootBlocks.length !== 1) {
    return {
      ok: false,
      decision: 'block',
      issues: [
        {
          code: 'legacy_confirmation_missing',
          path: row.sourcePath,
          message: 'legacy source must contain exactly one implementationConfirmation block',
        },
      ],
      logicalModel: null,
      traceGraph: null,
    };
  }
  const block = parsed.document.yamlRootBlocks[0];
  const document = yaml.load(block.rawText);
  const root = isRecord(document) ? document : null;
  const confirmation = root && isRecord(root.implementationConfirmation)
    ? root.implementationConfirmation
    : null;
  if (!confirmation) {
    return {
      ok: false,
      decision: 'block',
      issues: [
        {
          code: 'legacy_confirmation_missing',
          path: row.sourcePath,
          message: 'legacy implementationConfirmation object is missing',
        },
      ],
      logicalModel: null,
      traceGraph: null,
    };
  }
  if (confirmation.contractSchemaVersion !== 1) {
    return {
      ok: false,
      decision: 'block',
      issues: [
        {
          code: 'legacy_format_version_mismatch',
          path: row.sourcePath,
          message: 'registered V1 source does not contain contractSchemaVersion 1',
        },
      ],
      logicalModel: null,
      traceGraph: null,
    };
  }
  if (requirementsContractV1FormatProofHash(confirmation) !== row.v1ParserFormatProofHash) {
    return {
      ok: false,
      decision: 'block',
      issues: [
        {
          code: 'legacy_format_proof_mismatch',
          path: row.sourcePath,
          message: 'legacy physical format proof does not match the frozen inventory',
        },
      ],
      logicalModel: null,
      traceGraph: null,
    };
  }

  let requirements: RequirementContractRequirementV2[];
  try {
    requirements = legacyRequirements(
      confirmation,
      row.sourcePath,
      row.sourceHash,
      block.startLine
    );
  } catch (error) {
    return {
      ok: false,
      decision: 'block',
      issues: [
        {
          code: 'legacy_requirement_invalid',
          path: row.sourcePath,
          message: error instanceof Error ? error.message : String(error),
        },
      ],
      logicalModel: null,
      traceGraph: null,
    };
  }
  const semanticBodies: Record<string, Record<string, unknown>> = {};
  const nodes: RequirementContractModelV2['nodes'] = {};
  const proofRef = `LEGACY-INVENTORY:${row.requirementSetId}`;
  for (const requirement of requirements) {
    const bodyHash = sha256Stable(requirement);
    semanticBodies[bodyHash] = requirement as unknown as Record<string, unknown>;
    nodes[requirement.id] = {
      nodeType: 'requirement',
      bodySchemaVersion: requirement.schemaVersion,
      bodyHash,
      applicability: {
        decision: 'applicable',
        reasonCode: 'source_authorized',
        proofRefs: [proofRef],
      },
      proofBindings: [proofRef],
    };
  }
  const preimage: Omit<RequirementContractModelV2, 'semanticModelHash'> = {
    schemaVersion: 'requirement-contract-model/v2',
    activationState: REQUIREMENT_CONTRACT_MODEL_V2_ACTIVATION_STATE,
    recordId: row.requirementSetId,
    requirementSetId: row.requirementSetId,
    sourceAuthorityHash: row.sourceHash,
    edgeTypeRegistryHash: requirementsContractTraceEdgeTypeRegistryHash(),
    authority: 'none',
    semanticBodies,
    nodes,
    edges: {},
  };
  const logicalModel: RequirementContractModelV2 = {
    ...preimage,
    semanticModelHash: sha256Stable(preimage),
  };
  const traceGraphPreimage = {
    schemaVersion: 'requirements-contract-trace-graph/v1',
    requirementSetId: row.requirementSetId,
    nodes: Object.keys(nodes).sort(),
    edges: {},
  };
  return {
    ok: true,
    decision: 'pass',
    issues: [],
    logicalModel,
    traceGraph: {
      ...traceGraphPreimage,
      traceGraphHash: sha256Stable(traceGraphPreimage),
    },
  };
}
