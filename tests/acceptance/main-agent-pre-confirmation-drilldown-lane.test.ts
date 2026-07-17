import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import * as crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import * as yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import {
  runMainAgentAuthoringRepair,
  mainMainAgentOrchestration,
  resolveMainAgentOrchestrationSurface,
  runMainAgentPreConfirmationDrilldown,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration';
import {
  installJudgeRuntimeConfig,
  withIndependentProviderEvidence,
} from './helpers/requirements-contract-authoring-fixture';

const PROJECTION_QUALITY_RULE_CODES = [
  'projection_per_must_acceptance_not_independent',
  'projection_shared_evidence_without_per_must_oracle',
  'required_command_all_cover_all_without_per_must_assertions',
  'target_modification_path_all_cover_all',
  'current_target_map_not_product_specific',
  'business_visual_generic_or_compressed',
];

function checkedProjectionQualityRuleCodesForRequest(input: any): string[] {
  return (
    input.requiredResponseSchema?.checkedProjectionQualityRuleCodes ??
    input.projectionQualityGate?.requiredRuleCodes ??
    PROJECTION_QUALITY_RULE_CODES
  );
}

function writeDraftSource(root: string, name = 'source.md'): string {
  const source = path.join(root, 'docs', 'requirements', name);
  const sourcePath = `docs/requirements/${name}`;
  const command = `npx vitest run tests/acceptance/main-agent-pre-confirmation-drilldown-lane.test.ts ${name}`;
  mkdirSync(path.dirname(source), { recursive: true });
  writeFileSync(
    source,
    [
      '# Draft Requirement',
      '',
      '## Functional Requirements',
      '',
      '| ID | Requirement | Acceptance link |',
      '| --- | --- | --- |',
      '| FR-001 | 主 Agent 的需求确认 lane 只能在原子拆解、投影同步、审计收敛和预渲染门禁通过后渲染确认页。 | ACC-001 |',
      '',
      '## Negative Requirements And Not Done Conditions',
      '',
      '| ID | Not-done condition | Negative assertion | Blocks completion when | Failure refs | Evidence refs |',
      '| --- | --- | --- | --- | --- | --- |',
      '| NEG-001 | controlled confirmation ingest 前不得宣称 delivery readiness。 | 未完成受控确认时保持非交付就绪。 | 确认流程被绕过或错误宣称交付完成。 | FAIL-001 | ACC-001 CMD-001 |',
      '',
      '## Failure Matrix',
      '',
      '| ID | Failure condition | Required system behavior | Negative requirement refs | Evidence | Requirement refs |',
      '| --- | --- | --- | --- | --- | --- |',
      '| FAIL-001 | 原子拆解、投影同步、审计收敛或预渲染门禁任一未通过。 | 阻止确认页进入可确认状态，并保持 requirement_confirmation lane。 | NEG-001 | ACC-001 E2E-001 | MUST-FR-001 |',
      '',
      '## Acceptance Evidence',
      '',
      '| ID | Evidence target | Covers | Required evidence | Oracle | Assertion source | Responsibility mapping |',
      '| --- | --- | --- | --- | --- | --- | --- |',
      `| ACC-001 | Authoring lane gate closure | MUST-FR-001 NEG-001 | ${command} | 所有前置门禁通过后才允许渲染，缺任一门禁时保持阻塞。 | CMD-001 TRACE-001 TRACE-002 | PATH-001 owns remediation. |`,
      '',
      '## Test And Verification Paths',
      '',
      '| ID | Type | Covers | Command or evidence path | Completion rule | Per-MUST oracle | Assertion source | Responsibility mapping | Target files |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      `| CMD-001 | delivery-evidence | MUST-FR-001 NEG-001 | ${command} | Exit code 0. | 所有前置门禁通过后才允许渲染，未受控确认前不得宣称交付就绪。 | ACC-001 E2E-001 TRACE-001 TRACE-002 | PATH-001 owns remediation. | ${sourcePath} |`,
      `| E2E-001 | e2e | MUST-FR-001 NEG-001 | ${command} | Exit code 0. | Authoring lane preserves fail-closed confirmation behavior. | ACC-001 CMD-001 TRACE-001 TRACE-002 | PATH-001 owns remediation. | ${sourcePath} |`,
      '',
      '## Trace Matrix Source',
      '',
      '| ID | Covers | Evidence refs | Acceptance refs | Contract validation command refs | Delivery evidence command refs | View refs | Artifact refs | Boundary refs | Per-MUST oracle | Per-MUST closure assertion | Responsibility mapping |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      '| TRACE-001 | MUST-FR-001 | ACC-001 | ACC-001 E2E-001 | CMD-001 | CMD-001 | none | PATH-001 | none | 所有前置门禁通过后才允许渲染。 | MUST-FR-001 closes through ACC-001 and TRACE-001. | PATH-001 owns remediation. |',
      '| TRACE-002 | NEG-001 | ACC-001 | ACC-001 E2E-001 | CMD-001 | CMD-001 | none | PATH-001 | none | 未受控确认前保持非交付就绪。 | NEG-001 closes through ACC-001 negative control. | PATH-001 owns remediation. |',
      '',
      '## Implementation Path Map',
      '',
      '| ID | Repository path | Ownership | Required change | Requirement refs | Per-MUST oracle | Assertion source | Responsibility mapping |',
      '| --- | --- | --- | --- | --- | --- | --- | --- |',
      `| PATH-001 | \`${sourcePath}\` | Requirements authoring owner | Preserve the fail-closed authoring lane contract. | MUST-FR-001 NEG-001 | ACC-001 passes. | ACC-001 CMD-001 TRACE-001 TRACE-002 | Requirements authoring owner owns remediation. |`,
      '',
      '## Out Of Scope',
      '',
      '| ID | Out of scope | Boundary assertion |',
      '| --- | --- | --- |',
      '| OUT-001 | Rewriting unrelated authoring workflows is outside this requirement. | Keep unrelated authoring workflows unchanged. |',
      '',
    ].join('\n'),
    'utf8'
  );
  return source;
}

function writePlansDraftSource(root: string, name = 'source-plan.md'): string {
  const source = path.join(root, 'docs', 'plans', name);
  const targetPath = 'src/requirements-contract-authoring.ts';
  const command = `npx vitest run tests/acceptance/main-agent-pre-confirmation-drilldown-lane.test.ts ${targetPath}`;
  mkdirSync(path.dirname(source), { recursive: true });
  writeFileSync(
    source,
    [
      '# Draft Plan Requirement',
      '',
      '## Functional Requirements',
      '',
      '| ID | Requirement | Acceptance link |',
      '| --- | --- | --- |',
      '| FR-001 | Formal docs/plans requirement contracts must pass staging, scale, checkpoint, encoding, and promotion Receipt gates before source writeback. | ACC-001 |',
      '',
      '## Negative Requirements And Not Done Conditions',
      '',
      '| ID | Not-done condition | Negative assertion | Blocks completion when | Failure refs | Evidence refs |',
      '| --- | --- | --- | --- | --- | --- |',
      '| NEG-001 | Missing Critical Auditor convergence or promotion evidence must not mutate the source. | The original source remains byte-identical. | Source mutation occurs before controlled evidence exists. | FAIL-001 | ACC-001 CMD-001 |',
      '',
      '## Failure Matrix',
      '',
      '| ID | Failure condition | Required system behavior | Negative requirement refs | Evidence | Requirement refs |',
      '| --- | --- | --- | --- | --- | --- |',
      '| FAIL-001 | Critical Auditor or promotion evidence is missing. | Block source mutation and preserve the original source. | NEG-001 | ACC-001 | MUST-FR-001 |',
      '',
      '## Acceptance Evidence',
      '',
      '| ID | Evidence target | Covers | Required evidence | Oracle | Assertion source | Responsibility mapping |',
      '| --- | --- | --- | --- | --- | --- | --- |',
      `| ACC-001 | Source mutation gate | MUST-FR-001 NEG-001 | ${command} | Source remains byte-identical without controlled evidence. | CMD-001 TRACE-001 TRACE-002 | PATH-001 owns remediation. |`,
      '',
      '## Test And Verification Paths',
      '',
      '| ID | Type | Covers | Command or evidence path | Completion rule | Per-MUST oracle | Assertion source | Responsibility mapping | Target files |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      `| CMD-001 | contract-validation | MUST-FR-001 NEG-001 | ${command} | Exit code 0. | Source mutation remains blocked without controlled evidence. | ACC-001 E2E-001 TRACE-001 TRACE-002 | PATH-001 owns remediation. | ${targetPath} |`,
      `| E2E-001 | e2e | MUST-FR-001 NEG-001 | ${command} | Exit code 0. | Source writeback remains byte-identical until Critical Auditor convergence and promotion evidence exist. | ACC-001 CMD-001 TRACE-001 TRACE-002 | PATH-001 owns end-to-end proof. | ${targetPath} |`,
      '',
      '## Trace Matrix Source',
      '',
      '| ID | Covers | Evidence refs | Acceptance refs | Contract validation command refs | Delivery evidence command refs | View refs | Artifact refs | Boundary refs | Per-MUST oracle | Per-MUST closure assertion | Responsibility mapping |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      '| TRACE-001 | MUST-FR-001 | ACC-001 | ACC-001 E2E-001 | CMD-001 | CMD-001 | none | PATH-001 | none | All writeback gates pass before mutation. | MUST-FR-001 closes through ACC-001 and E2E-001. | PATH-001 owns remediation. |',
      '| TRACE-002 | NEG-001 | ACC-001 | ACC-001 E2E-001 | CMD-001 | CMD-001 | none | PATH-001 | none | Missing evidence preserves the source. | NEG-001 closes through ACC-001 and E2E-001 negative control. | PATH-001 owns remediation. |',
      '',
      '## Implementation Path Map',
      '',
      '| ID | Repository path | Ownership | Required change | Requirement refs | Per-MUST oracle | Assertion source | Responsibility mapping |',
      '| --- | --- | --- | --- | --- | --- | --- | --- |',
      `| PATH-001 | \`${targetPath}\` | Requirements authoring owner | Preserve the source mutation gate in the production authoring target. | MUST-FR-001 NEG-001 | ACC-001 and E2E-001 pass. | ACC-001 E2E-001 CMD-001 TRACE-001 TRACE-002 | Requirements authoring owner owns remediation. |`,
      '',
      '## Out Of Scope',
      '',
      '| ID | Out of scope | Boundary assertion |',
      '| --- | --- | --- |',
      '| OUT-001 | Rewriting unrelated source documents is outside this requirement. | Keep unrelated source documents unchanged. |',
      '',
    ].join('\n'),
    'utf8'
  );
  return source;
}

function writeDraftSourceWithoutMust(root: string, name = 'source-without-must.md'): string {
  const source = path.join(root, 'docs', 'requirements', name);
  mkdirSync(path.dirname(source), { recursive: true });
  writeFileSync(
    source,
    [
      '# Background Notes',
      '',
      'This note describes prior discussion and intentionally contains no normative requirement.',
      'It has no inline implementationConfirmation block and no executable behavior request.',
      '',
    ].join('\n'),
    'utf8'
  );
  return source;
}

function writePlainSourceWithControlledCandidate(
  root: string,
  name = 'plain-controlled-candidate.md'
): string {
  const source = path.join(root, 'docs', 'requirements', name);
  mkdirSync(path.dirname(source), { recursive: true });
  writeFileSync(
    source,
    [
      '# Plain Controlled Candidate Requirement',
      '',
      '## Functional Requirements',
      '',
      '| ID | Requirement | Source rationale | Acceptance link |',
      '| --- | --- | --- | --- |',
      '| FR-001 | The authoring lane must persist a draft implementationConfirmation block without marking it user_confirmed. | Prevent draft confirmation from being confused with user confirmation. | ACC-001 |',
      '',
    ].join('\n'),
    'utf8'
  );
  return source;
}

function writePlainSourceWithUncontrolledNormativeProse(
  root: string,
  name = 'plain-uncontrolled-normative-prose.md'
): string {
  const source = path.join(root, 'docs', 'requirements', name);
  mkdirSync(path.dirname(source), { recursive: true });
  writeFileSync(
    source,
    [
      '# DataService GDS Trigger Service PRD',
      '',
      '## Success Criteria',
      '',
      '最终产品包含以下能力，且全部属于同一目标状态，不拆分交付阶段或临时目标。',
      '',
      '## Data Contracts',
      '',
      'The file schema is fixed:',
      '',
      '| Field | Meaning |',
      '| --- | --- |',
      '| profile_id | The selected gateway profile. |',
      '',
    ].join('\n'),
    'utf8'
  );
  return source;
}

function writeSourceWithLineBasedInlineMust(
  root: string,
  name = 'line-based-inline-must.md'
): string {
  const source = path.join(root, 'docs', 'requirements', name);
  mkdirSync(path.dirname(source), { recursive: true });
  writeFileSync(
    source,
    [
      '# Line Based Inline MUST Requirement',
      '',
      'implementationConfirmation:',
      '  status: draft',
      '  must:',
      '    - id: MUST-REQ-DATASERVICE-GDS-TRIG-L104-002',
      '      text: This line-based generated requirement must not enter canonical confirmation.',
      '',
    ].join('\n'),
    'utf8'
  );
  return source;
}

function writeSourceWithLegacyInlineMustAndFrNfrTables(
  root: string,
  name = 'legacy-inline-must-with-fr-nfr-tables.md'
): {
  source: string;
  sourceRequirementIds: string[];
  mustRequirementIds: string[];
  staleMustId: string;
} {
  const source = path.join(root, 'docs', 'requirements', name);
  const fixtureId = (prefix: string, index: number): string =>
    `${prefix}-${String(index + 1).padStart(3, '0')}`;
  const functionalRequirements = [
    {
      text: 'The authoring lane must rebuild source-bound functional MUST rows from FR ID tables.',
      rationale: 'Prevent stale inline projection from controlling source authoring.',
    },
    {
      text: 'The authoring lane must preserve every subsequent source-bound functional row in the same table.',
      rationale: 'Prevent table header loss after the first data row.',
    },
  ].map((row, index) => ({
    ...row,
    sourceId: fixtureId('FR', index),
    mustId: `MUST-${fixtureId('FR', index)}`,
    acceptanceId: fixtureId('ACC', index),
    e2eId: fixtureId('E2E', index),
    traceId: fixtureId('TRACE', index),
  }));
  const nonFunctionalRequirements = [
    {
      text: 'The authoring lane must rebuild source-bound quality MUST rows from NFR ID tables.',
      rationale: 'Preserve controlled NFR coverage when replacing old projections.',
    },
    {
      text: 'The authoring lane must preserve every subsequent source-bound quality row in the same table.',
      rationale: 'Prevent table header loss after the first NFR data row.',
    },
  ].map((row, index) => ({
    ...row,
    sourceId: fixtureId('NFR', index),
    mustId: `MUST-${fixtureId('NFR', index)}`,
    acceptanceId: fixtureId('ACC', functionalRequirements.length + index),
    e2eId: fixtureId('E2E', functionalRequirements.length + index),
    traceId: fixtureId('TRACE', functionalRequirements.length + index),
  }));
  const requirements = [...functionalRequirements, ...nonFunctionalRequirements];
  const negativeId = fixtureId('NEG', 0);
  const failureId = fixtureId('FAIL', 0);
  const targetPath = 'src/requirements-contract-authoring.ts';
  const command = `npx vitest run tests/acceptance/main-agent-pre-confirmation-drilldown-lane.test.ts ${targetPath}`;
  const staleMustId = `MUST-${path
    .basename(name, path.extname(name))
    .replace(/[^A-Z0-9]+/giu, '-')
    .toUpperCase()}-L001-001`;
  mkdirSync(path.dirname(source), { recursive: true });
  writeFileSync(
    source,
    [
      '# Legacy Inline MUST With Source Tables',
      '',
      'implementationConfirmation:',
      '  status: draft',
      '  must:',
      `    - id: ${staleMustId}`,
      '      text: This stale line-based projection must be ignored as an extraction source.',
      '',
      '## Functional Requirements',
      '',
      '| FR ID | Requirement | Source rationale | Acceptance link |',
      '| --- | --- | --- | --- |',
      ...functionalRequirements.map(
        (row) => `| ${row.sourceId} | ${row.text} | ${row.rationale} | ${row.acceptanceId} |`
      ),
      '',
      '## Non Functional Requirements',
      '',
      '| NFR ID | Requirement | Source rationale | Acceptance link |',
      '| --- | --- | --- | --- |',
      ...nonFunctionalRequirements.map(
        (row) => `| ${row.sourceId} | ${row.text} | ${row.rationale} | ${row.acceptanceId} |`
      ),
      '',
      '## Negative Requirements And Not Done Conditions',
      '',
      '| ID | Not-done condition | Negative assertion | Blocks completion when |',
      '| --- | --- | --- | --- |',
      `| ${negativeId} | Reusing the stale inline MUST projection does not count as completion. | The FR/NFR tables must remain the only positive requirement authority. | Any stale line-based MUST enters the rebuilt projection. |`,
      '',
      '## Failure Matrix',
      '',
      '| ID | Failure condition | Required system behavior | Negative requirement refs | Evidence | Requirement refs |',
      '| --- | --- | --- | --- | --- | --- |',
      `| ${failureId} | A stale inline MUST projection is reused as source authority. | Block the stale projection and rebuild every controlled row from the FR/NFR source tables. | ${negativeId} | none | ${requirements
        .map((row) => row.mustId)
        .join(' ')} |`,
      '',
      '## Acceptance Evidence',
      '',
      '| ID | Evidence target | Covers | Required evidence | Oracle | Assertion source | Responsibility mapping |',
      '| --- | --- | --- | --- | --- | --- | --- |',
      ...requirements.map(
        (row) =>
          `| ${row.acceptanceId} | ${row.sourceId} source-row reconstruction | ${row.mustId} | ${command} | ${row.text} | CMD-001 ${row.traceId} | PATH-001 owns ${row.mustId} reconstruction. |`
      ),
      '',
      '## Test And Verification Paths',
      '',
      '| ID | Type | Covers | Command or evidence path | Completion rule | Per-MUST oracle | Assertion source | Responsibility mapping | Target files |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      `| CMD-001 | contract-validation | ${requirements
        .map((row) => row.mustId)
        .join(
          ' '
        )} ${negativeId} | ${command} | Exit code 0. | Each controlled MUST closes through its own ACC, E2E, and TRACE authority. | ${requirements
        .flatMap((row) => [row.acceptanceId, row.e2eId, row.traceId])
        .join(
          ' '
        )} PATH-001 | PATH-001 owns validation and remediation. | ${targetPath} |`,
      ...requirements.map(
        (row) =>
          `| ${row.e2eId} | e2e | ${row.mustId} | ${command} | Exit code 0. | ${row.text} | ${row.acceptanceId} CMD-001 ${row.traceId} PATH-001 | PATH-001 owns ${row.mustId} end-to-end proof. | ${targetPath} |`
      ),
      '',
      '## Trace Matrix Source',
      '',
      '| ID | Covers | Evidence refs | Acceptance refs | Contract validation command refs | Delivery evidence command refs | View refs | Artifact refs | Boundary refs | Per-MUST oracle | Per-MUST closure assertion | Responsibility mapping |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      ...requirements.map(
        (row) =>
          `| ${row.traceId} | ${row.mustId} | ${row.acceptanceId} | ${row.acceptanceId} ${row.e2eId} | CMD-001 | CMD-001 | none | PATH-001 | ${negativeId} | ${row.text} | ${row.mustId} closes through ${row.acceptanceId}, ${row.e2eId}, and ${row.traceId}. | PATH-001 owns ${row.mustId} reconstruction. |`
      ),
      '',
      '## Implementation Path Map',
      '',
      '| ID | Repository path | Ownership | Required change | Requirement refs | Per-MUST oracle | Assertion source | Responsibility mapping |',
      '| --- | --- | --- | --- | --- | --- | --- | --- |',
      `| PATH-001 | \`${targetPath}\` | Requirements contract authoring owner | Rebuild controlled MUST rows from FR/NFR tables without trusting stale inline projections. | ${requirements
        .map((row) => row.mustId)
        .join(' ')} ${negativeId} | ${requirements
        .map((row) => `${row.mustId} closes independently`)
        .join('; ')}. | CMD-001 ${requirements
        .flatMap((row) => [row.acceptanceId, row.e2eId, row.traceId])
        .join(' ')} | Requirements contract authoring owner owns rollback and remediation. |`,
      '',
      '## Out Of Scope',
      '',
      '| ID | Out of scope | Boundary assertion |',
      '| --- | --- | --- |',
      '| OUT-001 | Rewriting unrelated authoring workflows is outside this migration. | Keep unrelated authoring workflows unchanged. |',
      '',
    ].join('\n'),
    'utf8'
  );
  return {
    source,
    sourceRequirementIds: requirements.map((row) => row.sourceId),
    mustRequirementIds: requirements.map((row) => row.mustId),
    staleMustId,
  };
}

function writeSourceDrivenRequirement(root: string, name = 'source-driven.md'): string {
  const source = path.join(root, 'docs', 'requirements', name);
  const sourcePath = `docs/requirements/${name}`;
  const command = `npx vitest run tests/acceptance/main-agent-pre-confirmation-drilldown-lane.test.ts ${name}`;
  mkdirSync(path.dirname(source), { recursive: true });
  writeFileSync(
    source,
    [
      '# Source Driven Requirement',
      '',
      'The source document intentionally starts without an implementationConfirmation block.',
      '',
      '## Functional Requirements',
      '',
      '| ID | Requirement | Acceptance link |',
      '| --- | --- | --- |',
      '| FR-001 | Preserve the user-supplied requirement sentence as a first-class MUST row before rendering. | ACC-001 |',
      '| FR-002 | Split every authored MUST row into packet-backed atomic tasks before materialization. | ACC-002 |',
      '| FR-003 | Pass Critical Auditor only after the auditor can see all source-derived MUST references. | ACC-003 |',
      '',
      '## Negative Requirements And Not Done Conditions',
      '',
      '| ID | Not-done condition | Negative assertion | Blocks completion when | Failure refs | Evidence refs |',
      '| --- | --- | --- | --- | --- | --- |',
      '| NEG-001 | A shared or missing projection does not count as source-driven closure. | Every source MUST keeps an independent packet, trace, acceptance, command, and target mapping. | Any source MUST is absent or only covered by a generic shared row. | FAIL-001 | ACC-001 ACC-002 ACC-003 CMD-001 |',
      '',
      '## Failure Matrix',
      '',
      '| ID | Failure condition | Required system behavior | Negative requirement refs | Evidence | Requirement refs |',
      '| --- | --- | --- | --- | --- | --- |',
      '| FAIL-001 | A source MUST is omitted, over-compressed, or hidden from Critical Auditor. | Block source promotion and retain the staging draft until independent projection closure is restored. | NEG-001 | ACC-001 ACC-002 ACC-003 E2E-001 | MUST-FR-001 MUST-FR-002 MUST-FR-003 |',
      '',
      '## Acceptance Evidence',
      '',
      '| ID | Evidence target | Covers | Required evidence | Oracle | Assertion source | Responsibility mapping |',
      '| --- | --- | --- | --- | --- | --- | --- |',
      `| ACC-001 | Source sentence preservation | MUST-FR-001 | ${command} | The source sentence remains a first-class MUST row. | CMD-001 TRACE-001 | PATH-001 owns remediation. |`,
      `| ACC-002 | Atomic packet decomposition | MUST-FR-002 | ${command} | The MUST has packet-backed atomic tasks before materialization. | CMD-001 TRACE-002 | PATH-001 owns remediation. |`,
      `| ACC-003 | Critical Auditor visibility | MUST-FR-003 NEG-001 | ${command} | Critical Auditor receives all current source-derived MUST and projection refs. | CMD-001 TRACE-003 TRACE-004 | PATH-001 owns remediation. |`,
      '',
      '## Test And Verification Paths',
      '',
      '| ID | Type | Covers | Command or evidence path | Completion rule | Per-MUST oracle | Assertion source | Responsibility mapping | Target files |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      `| CMD-001 | delivery-evidence | MUST-FR-001 MUST-FR-002 MUST-FR-003 NEG-001 | ${command} | Exit code 0. | Each source MUST closes through its own ACC and TRACE row. | ACC-001 ACC-002 ACC-003 E2E-001 TRACE-001 TRACE-002 TRACE-003 TRACE-004 | PATH-001 owns remediation. | ${sourcePath} |`,
      `| E2E-001 | e2e | MUST-FR-001 MUST-FR-002 MUST-FR-003 NEG-001 | ${command} | Exit code 0. | Source authoring preserves independent closure through promotion gating. | ACC-001 ACC-002 ACC-003 CMD-001 TRACE-001 TRACE-002 TRACE-003 TRACE-004 | PATH-001 owns remediation. | ${sourcePath} |`,
      '',
      '## Trace Matrix Source',
      '',
      '| ID | Covers | Evidence refs | Acceptance refs | Contract validation command refs | Delivery evidence command refs | View refs | Artifact refs | Boundary refs | Per-MUST oracle | Per-MUST closure assertion | Responsibility mapping |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      '| TRACE-001 | MUST-FR-001 | ACC-001 | ACC-001 E2E-001 | CMD-001 | CMD-001 | none | PATH-001 | none | The source sentence remains a first-class MUST row. | MUST-FR-001 closes through ACC-001 and TRACE-001. | PATH-001 owns remediation. |',
      '| TRACE-002 | MUST-FR-002 | ACC-002 | ACC-002 E2E-001 | CMD-001 | CMD-001 | none | PATH-001 | none | Atomic tasks exist before materialization. | MUST-FR-002 closes through ACC-002 and TRACE-002. | PATH-001 owns remediation. |',
      '| TRACE-003 | MUST-FR-003 | ACC-003 | ACC-003 E2E-001 | CMD-001 | CMD-001 | none | PATH-001 | none | Critical Auditor sees all source-derived refs. | MUST-FR-003 closes through ACC-003 and TRACE-003. | PATH-001 owns remediation. |',
      '| TRACE-004 | NEG-001 | ACC-003 | ACC-003 E2E-001 | CMD-001 | CMD-001 | none | PATH-001 | none | Missing or shared-only projection remains blocking. | NEG-001 closes through ACC-003 negative control. | PATH-001 owns remediation. |',
      '',
      '## Implementation Path Map',
      '',
      '| ID | Repository path | Ownership | Required change | Requirement refs | Per-MUST oracle | Assertion source | Responsibility mapping |',
      '| --- | --- | --- | --- | --- | --- | --- | --- |',
      `| PATH-001 | \`${sourcePath}\` | Source authoring owner | Preserve source MUST, packet, trace, acceptance, and auditor visibility. | MUST-FR-001 MUST-FR-002 MUST-FR-003 NEG-001 | ACC-001, ACC-002, and ACC-003 pass independently. | ACC-001 ACC-002 ACC-003 CMD-001 TRACE-001 TRACE-002 TRACE-003 TRACE-004 | Source authoring owner owns rollback and remediation. |`,
      '',
      '## Out Of Scope',
      '',
      '| ID | Out of scope | Boundary assertion |',
      '| --- | --- | --- |',
      '| OUT-001 | Rewriting unrelated authoring workflows is outside this requirement. | Keep unrelated authoring workflows unchanged. |',
      '',
    ].join('\n'),
    'utf8'
  );
  return source;
}

function writeSourceWithBusinessFailureMatrix(
  root: string,
  name = 'source-with-business-failure-matrix.md'
): string {
  const source = path.join(root, 'docs', 'requirements', name);
  mkdirSync(path.dirname(source), { recursive: true });
  writeFileSync(
    source,
    [
      '# Consumer Market Data Requirement',
      '',
      '## Functional Requirements',
      '',
      '| FR ID | Requirement | Source rationale | Acceptance link |',
      '| --- | --- | --- | --- |',
      '| FR-001 | Consumer attaches to a compatible market-data manifest before treating quotes as live. | Avoid unsafe stale or incompatible data use. | ACC-001 |',
      '| FR-002 | Trigger evaluation fails closed on continuity timeout or gap, applies an idempotent paused state before emitting an order intent, and resumes only after recovery evidence plus an acceptance assertion pass. | Prevent unsafe automatic trading. | ACC-002 |',
      '',
      '## Negative Requirements And Not Done Conditions',
      '',
      '| ID | Not-done condition | Negative assertion | Blocks completion when | Failure refs | Evidence refs |',
      '| --- | --- | --- | --- | --- | --- |',
      '| NEG-001 | Incompatible market data must not be treated as live. | The consumer remains non-live and emits no order intent. | Schema mismatch can still reach trigger evaluation. | FAIL-001 | ACC-003 CMD-001 |',
      '| NEG-002 | A detected stream gap must not be ignored. | Trigger evaluation pauses before another order intent. | A stream gap can produce an automatic order intent. | FAIL-002 | ACC-004 CMD-001 |',
      '',
      '## Failure Matrix',
      '',
      '| ID | Failure condition | Required system behavior | Negative requirement refs | Evidence | Requirement refs |',
      '| --- | --- | --- | --- | --- | --- |',
      '| FAIL-001 | DataBus schema mismatch; impact: consumer attach is unsafe. | Consumer rejects live attach with schema_mismatch and remains in incompatible non-live state. | NEG-001 | ACC-003 | MUST-FR-001 |',
      '| FAIL-002 | Ordered tick sequence gap; impact: trigger correctness is unsafe. | TriggerService pauses automatic evaluation before any new OrderIntent and records tick_gap. | NEG-002 | ACC-004 | MUST-FR-002 |',
      '',
      '## Acceptance Evidence',
      '',
      '| ID | Evidence target | Covers | Required evidence | Oracle | Assertion source | Responsibility mapping |',
      '| --- | --- | --- | --- | --- | --- | --- |',
      '| ACC-001 | Compatible manifest attach | MUST-FR-001 | npx vitest run tests/market-data-consumer.test.ts | Compatible data attaches before quotes become live. | CMD-001 TRACE-001 | PATH-001 owns remediation. |',
      '| ACC-002 | Gap-safe trigger evaluation | MUST-FR-002 | npx vitest run tests/market-data-consumer.test.ts | Timeout or gap pauses evaluation before any order intent and resumes only after recovery proof. | CMD-001 TRACE-002 | PATH-001 owns remediation. |',
      '| ACC-003 | Incompatible schema rejection | NEG-001 | npx vitest run tests/market-data-consumer.test.ts | Schema mismatch remains non-live and emits no order intent. | CMD-001 TRACE-003 | PATH-001 owns remediation. |',
      '| ACC-004 | Tick gap rejection | NEG-002 | npx vitest run tests/market-data-consumer.test.ts | Tick gap pauses automatic evaluation before a new order intent. | CMD-001 TRACE-004 | PATH-001 owns remediation. |',
      '',
      '## Out Of Scope',
      '',
      '| ID | Out of scope | Boundary assertion |',
      '| --- | --- | --- |',
      '| OUT-001 | Rewriting unrelated market-data workflows is outside this requirement. | Keep unrelated market-data workflows unchanged. |',
      '',
      '## Trace Matrix Source',
      '',
      '| ID | Covers | Evidence refs | Acceptance refs | Contract validation command refs | Delivery evidence command refs | View refs | Artifact refs | Boundary refs | Per-MUST oracle | Per-MUST closure assertion | Responsibility mapping |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      '| TRACE-001 | MUST-FR-001 | ACC-001 | ACC-001 E2E-001 | CMD-001 | CMD-001 | none | PATH-001 | none | Compatible data attaches before quotes become live. | MUST-FR-001 closes through ACC-001 and TRACE-001. | PATH-001 owns remediation. |',
      '| TRACE-002 | MUST-FR-002 | ACC-002 | ACC-002 E2E-001 | CMD-001 | CMD-001 | none | PATH-001 | none | Timeout or gap pauses evaluation before order intent and resumes only after recovery proof. | MUST-FR-002 closes through ACC-002 and TRACE-002. | PATH-001 owns remediation. |',
      '| TRACE-003 | NEG-001 | ACC-003 | ACC-003 E2E-001 | CMD-001 | CMD-001 | none | PATH-001 | none | Schema mismatch remains non-live and emits no order intent. | NEG-001 closes through ACC-003 negative control. | PATH-001 owns remediation. |',
      '| TRACE-004 | NEG-002 | ACC-004 | ACC-004 E2E-001 | CMD-001 | CMD-001 | none | PATH-001 | none | Tick gap pauses automatic evaluation before a new order intent. | NEG-002 closes through ACC-004 negative control. | PATH-001 owns remediation. |',
      '',
      '## Test And Verification Paths',
      '',
      '| ID | Type | Covers | Command or evidence path | Completion rule | Per-MUST oracle | Assertion source | Responsibility mapping | Target files |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      '| CMD-001 | delivery-evidence | MUST-FR-001 MUST-FR-002 NEG-001 NEG-002 | npx vitest run tests/market-data-consumer.test.ts | Exit code 0. | Each requirement closes through its independent ACC and TRACE row. | ACC-001 ACC-002 ACC-003 ACC-004 E2E-001 TRACE-001 TRACE-002 TRACE-003 TRACE-004 | PATH-001 owns remediation. | tests/market-data-consumer.test.ts src/market-data-consumer.ts |',
      '| E2E-001 | e2e | MUST-FR-001 MUST-FR-002 NEG-001 NEG-002 | npx vitest run tests/market-data-consumer.test.ts | Exit code 0. | Consumer attach, gap handling, and negative controls remain fail closed. | ACC-001 ACC-002 ACC-003 ACC-004 CMD-001 TRACE-001 TRACE-002 TRACE-003 TRACE-004 | PATH-001 owns remediation. | tests/market-data-consumer.test.ts src/market-data-consumer.ts |',
      '',
      '## Implementation Path Map',
      '',
      '| ID | Repository path | Ownership | Required change | Requirement refs | Per-MUST oracle | Assertion source | Responsibility mapping |',
      '| --- | --- | --- | --- | --- | --- | --- | --- |',
      '| PATH-001 | `src/market-data-consumer.ts` | Market data consumer owner | Implement compatible attach and fail-closed gap handling. | MUST-FR-001 MUST-FR-002 NEG-001 NEG-002 | ACC-001 through ACC-004 pass independently. | ACC-001 ACC-002 ACC-003 ACC-004 CMD-001 TRACE-001 TRACE-002 TRACE-003 TRACE-004 | Market data consumer owner owns rollback and remediation. |',
      '',
    ].join('\n'),
    'utf8'
  );
  return source;
}

function writeRichPreserveExistingRequirement(
  root: string,
  name = 'rich-preserve-existing.md'
): string {
  const source = path.join(root, 'docs', 'requirements', name);
  mkdirSync(path.dirname(source), { recursive: true });
  writeFileSync(
    source,
    [
      '# Rich Preserve Existing Requirement',
      '',
      'CUSTOM-PRESERVE-ANCHOR: this prose must not be overwritten by authoring repair.',
      '',
      'implementationConfirmation:',
      '  contractSchemaVersion: 1',
      '  status: draft',
      '  recordId: REQ-PRE-CONFIRMATION-PRESERVE-EXISTING',
      '  requirementSetId: REQSET-PRE-CONFIRMATION-PRESERVE-EXISTING',
      '  entryFlow: standalone_tasks',
      '  entryFlowClass: task_packet_entry',
      '  workflowAdapter: direct',
      '  contractAuthoringRequired: true',
      '  confirmationLanguage: zh-CN',
      '  confirmationProfile: implementation_confirmation',
      '  requiredViewPacks: ["currentTargetMap"]',
      '  optionalViewPacks: []',
      '  confirmedAt: null',
      '  confirmedBy: null',
      '  sourceDocumentHash: null',
      '  confirmationRender:',
      '    htmlPath: null',
      '    summaryPath: null',
      '    reportPath: null',
      '    htmlHash: null',
      '    confirmationPhrase: null',
      '  must:',
      '    - id: MUST-900',
      '      text: "Preserve rich implementationConfirmation rows before confirmation rendering."',
      '      evidenceRefs: ["EVD-900"]',
      '      coveredByTraceRows: ["TRACE-900"]',
      '      coveredBySequenceViews: ["SEQ-900"]',
      '  notDone:',
      '    - id: NEG-900',
      '      text: "Do not replace the existing contract with generated simplified YAML."',
      '      evidenceRefs: ["EVD-900"]',
      '      whyItBlocksCompletion: "Overwrite loses author intent."',
      '      negativeAssertionRequired: true',
      '  mustNot:',
      '    - id: OUT-900',
      '      text: "Confirmation renderability is not delivery readiness."',
      '      scopeBoundary: confirmation_only',
      '      userApprovalRequiredIfChanged: true',
      '  evidence:',
      '    - id: EVD-900',
      '      text: "Repair emits authoring artifacts without mutating source."',
      '      gate: "npx vitest run tests/acceptance/main-agent-pre-confirmation-drilldown-lane.test.ts"',
      '      oracle: "Source content remains unchanged."',
      '      requiredCommandRefs: ["CMD-900"]',
      '      artifactRefs: ["ART-900"]',
      '  traceRows:',
      '    - id: TRACE-900',
      '      covers: ["MUST-900", "NEG-900"]',
      '      taskRefs: []',
      '      evidenceRefs: ["EVD-900"]',
      '      contractValidationCommandRefs: ["CMD-900"]',
      '      deliveryEvidenceCommandRefs: ["CMD-900"]',
      '      acceptanceRefs: ["ACC-900"]',
      '      sequenceViewRefs: ["SEQ-900"]',
      '      boundaryViewRefs: []',
      '      artifactRefs: ["ART-900"]',
      '      status: PENDING',
      '  acceptanceTests:',
      '    - id: ACC-900',
      '      file: tests/acceptance/main-agent-pre-confirmation-drilldown-lane.test.ts',
      '      covers: ["MUST-900"]',
      '      traceRows: ["TRACE-900"]',
      '      evidenceRefs: ["EVD-900"]',
      '      commandRefs: ["CMD-900"]',
      '      positiveControl: true',
      '      expectedPreImplementationState: expected_red',
      '      oracle: "Preserve-existing repair blocks before response artifact."',
      '  requiredCommands:',
      '    - id: CMD-900',
      '      command: "npx vitest run tests/acceptance/main-agent-pre-confirmation-drilldown-lane.test.ts"',
      '      purpose: "Validate preserve-existing repair entry."',
      '      expected: "Targeted test passes."',
      '      targetFiles: ["packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts"]',
      '      traceRows: ["TRACE-900"]',
      '      evidenceRefs: ["EVD-900"]',
      '  currentTargetMap:',
      '    schemaVersion: current-target-map/v1',
      '    displayProfile: closed_loop_current_target_map',
      '    currentSummary:',
      '      - title: "Existing source"',
      '        detail: "Rich source already exists."',
      '    targetSummary:',
      '      - title: "Repaired source"',
      '        detail: "Authoring artifacts are synchronized without source overwrite."',
      '    diffRows:',
      '      - dimension: "Authoring repair"',
      '        currentState: "pre-render gate missing"',
      '        targetState: "Critical Auditor request emitted"',
      '        action: "write response artifact"',
      '  customAuditRows:',
      '    - id: CUSTOM-ROW-900',
      '      text: "custom section must stay"',
      '',
    ].join('\n'),
    'utf8'
  );
  return source;
}

function readJson(file: string): any {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map(
      (key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`
    )
    .join(',')}}`;
}

function sha256Text(value: string): string {
  return `sha256:${crypto.createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function sha256Json(value: unknown): string {
  return sha256Text(stableStringify(value));
}

function authorityForSource(
  root: string,
  source: string
): {
  targetPath: string;
  requiredCommand: string;
} {
  const targetPath = path.relative(root, source).replace(/\\/g, '/');
  return {
    targetPath,
    requiredCommand: `npx vitest run tests/acceptance/main-agent-pre-confirmation-drilldown-lane.test.ts ${path.basename(targetPath)}`,
  };
}

function writeValidationAuthorityTarget(root: string): {
  targetPath: string;
  requiredCommand: string;
} {
  const targetPath = 'src/requirements-contract-authoring.ts';
  const absoluteTargetPath = path.join(root, targetPath);
  mkdirSync(path.dirname(absoluteTargetPath), { recursive: true });
  writeFileSync(
    absoluteTargetPath,
    'export const requirementsContractAuthoringTarget = true;\n',
    'utf8'
  );
  return {
    targetPath,
    requiredCommand: `npx vitest run tests/acceptance/main-agent-pre-confirmation-drilldown-lane.test.ts ${targetPath}`,
  };
}

function writeConsumerMarketDataAuthorityTarget(root: string): {
  targetPath: string;
  requiredCommand: string;
} {
  const targetPath = 'src/market-data-consumer.ts';
  const testPath = 'tests/market-data-consumer.test.ts';
  const absoluteTargetPath = path.join(root, targetPath);
  const absoluteTestPath = path.join(root, testPath);
  mkdirSync(path.dirname(absoluteTargetPath), { recursive: true });
  mkdirSync(path.dirname(absoluteTestPath), { recursive: true });
  writeFileSync(absoluteTargetPath, 'export const marketDataConsumer = true;\n', 'utf8');
  writeFileSync(
    absoluteTestPath,
    "import { marketDataConsumer } from '../src/market-data-consumer';\nvoid marketDataConsumer;\n",
    'utf8'
  );
  return {
    targetPath,
    requiredCommand: `npx vitest run ${testPath}`,
  };
}

function semanticConfirmationForHash(
  confirmation: Record<string, unknown>
): Record<string, unknown> {
  const bookkeeping = new Set([
    'status',
    'confirmedAt',
    'confirmedBy',
    'sourceDocumentHash',
    'implementationConfirmationHash',
    'reconfirmationRequest',
    'confirmationRender',
  ]);
  return Object.fromEntries(Object.entries(confirmation).filter(([key]) => !bookkeeping.has(key)));
}

function currentSourceHashes(source: string): {
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
} {
  const text = readFileSync(source, 'utf8');
  const match = text.match(/^implementationConfirmation:\n[\s\S]*$/m);
  expect(match, 'implementationConfirmation block').toBeTruthy();
  const confirmation = (yaml.load(match![0]) as any).implementationConfirmation;
  const semantic = semanticConfirmationForHash(confirmation);
  const normalizedBlock = `implementationConfirmation:${stableStringify(semantic)}`;
  return {
    sourceDocumentHash: sha256Text(text.replace(match![0], normalizedBlock)),
    implementationConfirmationHash: sha256Json(semantic),
  };
}

function writePromotionReceipt(
  root: string,
  source: string,
  recordId: string,
  requirementSetId: string
): string {
  const hashes = currentSourceHashes(source);
  const sourcePath = path.relative(root, source).replace(/\\/g, '/');
  const targetHash = sha256Text(readFileSync(source, 'utf8'));
  const receiptPath = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    recordId,
    'authoring',
    'promotion-receipt.json'
  );
  const receipt: Record<string, unknown> = {
    ok: true,
    dryRun: false,
    preflightOnly: false,
    draftPath: `_bmad-output/runtime/requirement-records/${recordId}/authoring/draft-source-preview.md`,
    targetPath: sourcePath,
    promotionStage: 'authoring-draft',
    allowedStatuses: ['draft', 'draft_updated_not_confirmation_ready', 'reconfirm_required'],
    statusValue: 'draft',
    confirmationReady: false,
    safePromotionAsDraft: true,
    requiresUserConfirmationBeforeExecution: true,
    manifestPath: `_bmad-output/runtime/requirement-records/${recordId}/authoring/draft-manifest.json`,
    targetHash,
    writeReceipt: {
      schemaVersion: 'large-document-writer-safe-write/v1',
      targetPath: sourcePath,
      finalHash: targetHash,
      mode: 'replace',
    },
    backupPath: `_bmad-output/runtime/requirement-records/${recordId}/authoring/promotion-backup.md`,
    preflight: {
      manifest: {
        targetPath: sourcePath,
        draftHash: targetHash,
        statusValue: 'draft',
        recordId,
        requirementSetId,
      },
    },
    authoringPromotionGate: {
      required: true,
      ok: true,
      decisions: {
        sourceMutation: {
          finalDecision: 'allow_source_materialization',
          sourceMutationAllowed: true,
          sourceDocumentExistedBefore: true,
          sourceDocumentHashBefore: hashes.sourceDocumentHash,
          sourceDocumentHashAfter: targetHash,
        },
      },
    },
    receiptPath: path.relative(root, receiptPath).replace(/\\/g, '/'),
    failureClass: null,
  };
  mkdirSync(path.dirname(receiptPath), { recursive: true });
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  return receiptPath;
}

function readImplementationConfirmation(source: string): any {
  const text = readFileSync(source, 'utf8');
  const match = text.match(/^implementationConfirmation:\n[\s\S]*$/m);
  expect(match, 'implementationConfirmation block').toBeTruthy();
  return (yaml.load(match![0]) as any).implementationConfirmation;
}

function readDraftPreviewImplementationConfirmation(paths: ReturnType<typeof artifacts>): any {
  expect(existsSync(paths.draftSourcePreview), 'draft source preview').toBe(true);
  return readImplementationConfirmation(paths.draftSourcePreview);
}

function unwrapArtifact(value: any): any {
  return (
    value.semanticKernel ?? value.must_decomposition_packet ?? value.criticalAuditorReceipt ?? value
  );
}

function expectArtifactContract(file: string, recordId: string): void {
  const artifact = unwrapArtifact(readJson(file));
  expect(artifact.schemaVersion, `${file} schemaVersion`).toBeTruthy();
  expect(artifact.recordId, `${file} recordId`).toBe(recordId);
  expect(artifact.sourceDocumentHash, `${file} sourceDocumentHash`).toMatch(/^sha256:/);
  expect(artifact.implementationConfirmationHash, `${file} implementationConfirmationHash`).toMatch(
    /^sha256:/
  );
  expect(
    artifact.contentHash ??
      artifact.receiptHash ??
      artifact.kernelHash ??
      artifact.packetHash ??
      artifact.progressHash ??
      artifact.reportHash ??
      artifact.reconciliationHash,
    `${file} content or receipt hash`
  ).toMatch(/^sha256:/);
  expect(artifact.createdBy, `${file} createdBy`).toBeTruthy();
  expect(artifact.createdAt, `${file} createdAt`).toBeTruthy();
  const checkpointReceiptRefs = Array.isArray(artifact.resumeLedger?.checkpointReceiptRefs)
    ? artifact.resumeLedger.checkpointReceiptRefs.filter(
        (ref: any) =>
          ref &&
          typeof ref === 'object' &&
          typeof ref.checkpointId === 'string' &&
          typeof ref.path === 'string' &&
          typeof ref.hash === 'string' &&
          ref.hash.startsWith('sha256:')
      )
    : null;
  const inputRefs = Array.isArray(artifact.inputRefs)
    ? artifact.inputRefs
    : checkpointReceiptRefs &&
        checkpointReceiptRefs.length === artifact.resumeLedger.checkpointReceiptRefs.length
      ? checkpointReceiptRefs
      : null;
  expect(Array.isArray(inputRefs), `${file} inputRefs`).toBe(true);
  expect(inputRefs?.length ?? 0, `${file} inputRefs length`).toBeGreaterThan(0);
}

function expectCheckpointAutoPromoted(result: any, paths: ReturnType<typeof artifacts>): void {
  expect(
    result.blockingIssues.map((issue: any) => issue.code),
    JSON.stringify(
      {
        blockingStage: result.blockingStage,
        blockingIssues: result.blockingIssues,
        checkpointPersistenceEvidenceExists: existsSync(paths.checkpointPersistenceEvidence),
        progressExists: existsSync(paths.progress),
        scaleRoutingDecisionExists: existsSync(paths.scaleRoutingDecision),
      },
      null,
      2
    )
  ).not.toContain('checkpoint_required_before_source_materialization');
  expect(existsSync(paths.checkpointPersistenceEvidence)).toBe(true);
  expect(existsSync(paths.encodingReport)).toBe(true);
  expect(existsSync(paths.sourceMutationDecision)).toBe(true);
  const sourceMutationDecision = readJson(paths.sourceMutationDecision);
  expect(sourceMutationDecision).toMatchObject({
    finalDecision: 'allow_source_materialization',
    sourceMutationAllowed: true,
    sourceMutationPerformed: false,
    scaleRoutingDecision: 'single_pass_final_allowed',
  });
  const routeDecision = readJson(paths.scaleRoutingDecision);
  expect(routeDecision.decision).toBe('single_pass_final_allowed');
  expect(routeDecision.checkpointPersistenceSatisfied).toBe(true);
  const evidence = readJson(paths.checkpointPersistenceEvidence);
  expect(evidence.checkpointPersistenceSatisfiedCandidate).toBe(true);
  expect(existsSync(paths.sourceMaterializationReceipt)).toBe(false);
  expect(existsSync(paths.promotionReceipt)).toBe(true);
  const promotionReceipt = readJson(paths.promotionReceipt);
  expect(promotionReceipt).toMatchObject({
    ok: true,
    promotionStage: 'authoring-draft',
    safePromotionAsDraft: true,
  });
}

function artifacts(root: string, recordId: string, requirementSetId = recordId) {
  const authoring = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    recordId,
    'authoring'
  );
  const confirmation = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    recordId,
    'confirmation'
  );
  return {
    authoring,
    confirmation,
    semanticKernel: path.join(authoring, 'semantic-kernel.json'),
    semanticIr: path.join(authoring, 'semantic-ir.json'),
    packet: path.join(authoring, 'must_decomposition_packet.json'),
    controlledMustCandidates: path.join(authoring, 'controlled-must-candidates.json'),
    requirementCoverageLedger: path.join(authoring, 'requirement-coverage-ledger.json'),
    targetAuthorityReport: path.join(authoring, 'target-authority-report.json'),
    validationAuthorityReport: path.join(authoring, 'validation-authority-report.json'),
    projectionDomainSanityReport: path.join(authoring, 'projection-domain-sanity-report.json'),
    intakeReceipt: path.join(authoring, 'intake', 'intake-receipt.json'),
    intentLineageLedger: path.join(authoring, 'intake', 'intent-lineage-ledger.json'),
    sourceMutationDecision: path.join(authoring, 'source-mutation-decision.json'),
    draftSourcePreview: path.join(authoring, 'draft-source-preview.md'),
    promotionReceipt: path.join(authoring, 'promotion-receipt.json'),
    draftImplementationConfirmation: path.join(authoring, 'draft-implementation-confirmation.json'),
    authoringMaterializationReceipt: path.join(authoring, 'authoring-materialization-receipt.json'),
    scaleAssessmentInitial: path.join(authoring, 'scale-assessment-initial.json'),
    scaleAssessmentPostPacket: path.join(authoring, 'scale-assessment-post-packet.json'),
    scaleAssessmentPostMaterialization: path.join(
      authoring,
      'scale-assessment-post-materialization.json'
    ),
    scaleRoutingDecision: path.join(authoring, 'scale-routing-decision.json'),
    checkpointPersistenceEvidence: path.join(authoring, 'checkpoint-persistence-evidence.json'),
    encodingReport: path.join(authoring, 'encoding-report.json'),
    receipt1: path.join(authoring, 'critical-auditor-receipt-round-1.json'),
    receipt2: path.join(authoring, 'critical-auditor-receipt-round-2.json'),
    receipt3: path.join(authoring, 'critical-auditor-receipt-round-3.json'),
    reconciliation: path.join(authoring, 'must_packet_source_reconciliation_report.json'),
    progress: path.join(authoring, 'semantic-checkpoint-progress.json'),
    sourceMaterializationReceipt: path.join(
      root,
      '_bmad-output',
      'runtime',
      'requirement-records',
      requirementSetId,
      'authoring',
      'source-materialization-receipt.json'
    ),
    mustGate: path.join(authoring, 'pre-render-must-decomposition-gate-report.json'),
    globalGate: path.join(authoring, 'pre-render-global-consistency-report.json'),
    html: path.join(confirmation, 'confirmation.html'),
    summary: path.join(confirmation, 'confirmation-summary.json'),
    renderReport: path.join(confirmation, 'confirmation-render-report.json'),
  };
}

function runWithAuthoringLocalization(
  root: string,
  options: Parameters<typeof runMainAgentPreConfirmationDrilldown>[1]
) {
  const boundOptions = {
    ...options,
    implementationAttemptId:
      options.implementationAttemptId ??
      `implementation-attempt-${options.requirementSetId ?? options.recordId ?? 'test'}`,
  };
  const first = runMainAgentPreConfirmationDrilldown(root, boundOptions);
  if (first.substate !== 'localization_translation_required') {
    return first;
  }
  const requestPath = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    first.recordId,
    'authoring',
    'localization-request.json'
  );
  const request = readJson(requestPath);
  const responsePath = path.join(path.dirname(requestPath), 'localization-response.test.json');
  writeFileSync(
    responsePath,
    `${JSON.stringify(
      {
        schemaVersion: 'requirements-contract-localization-response/v1',
        requestHash: request.requestHash,
        sourceDocumentHash: request.sourceDocumentHash,
        confirmationLanguage: request.confirmationLanguage,
        providerMode: 'main_session_authoring_agent',
        semanticEquivalenceAttested: true,
        translations: request.entries.map((entry: any) => ({
          key: entry.key,
          sourceTextHash: entry.sourceTextHash,
          translatedText: `${entry.rowId} 的${entry.field}中文语义译文`,
        })),
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  return runMainAgentPreConfirmationDrilldown(root, {
    ...boundOptions,
    localizationResponseFile: responsePath,
  });
}

function cleanCriticalAuditorRound(input: any) {
  const { roundIndex, gateDryRun, packetProjectionSummary } = input;
  return withIndependentProviderEvidence(input, {
    verdict: 'no_new_valid_gap' as const,
    gateDryRunHash: gateDryRun.hash,
    reconciliationIssueCount: gateDryRun.reconciliation.issueCount,
    checkedProjectionGroups: packetProjectionSummary.projectionGroups,
    checkedProjectionQualityRuleCodes: checkedProjectionQualityRuleCodesForRequest(input),
    reviewedProjectionRefs: packetProjectionSummary.projectionRefs.slice(0, 1),
    priorFindingsDisposition: [
      {
        findingRef: `ROUND-${roundIndex}-BASELINE`,
        disposition: roundIndex === 1 ? 'new' : 'unchanged',
        evidenceRefs: [gateDryRun.reportPath],
      },
    ],
    rejectedGapCandidates: [{ id: `REJ-${roundIndex}`, reason: 'no new valid gap detected' }],
    falsePositiveProofs: (gateDryRun.actionableBlockingIssues ?? []).map((issue: any) => ({
      blockerCode: String(issue.code ?? ''),
      proofType: 'current_source_packet_hash_match',
      evidenceRefs: [gateDryRun.reportPath],
    })),
    rationale: `Round ${roundIndex} found no new valid gap.`,
  });
}

function captureMainAgentCli(args: string[]): {
  exitCode: number;
  stdout: string;
  stderr: string;
} {
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  let stdout = '';
  let stderr = '';
  try {
    (process.stdout.write as any) = (chunk: unknown) => {
      stdout += String(chunk);
      return true;
    };
    (process.stderr.write as any) = (chunk: unknown) => {
      stderr += String(chunk);
      return true;
    };
    const exitCode = mainMainAgentOrchestration(args);
    return { exitCode, stdout, stderr };
  } finally {
    process.stdout.write = originalStdoutWrite as any;
    process.stderr.write = originalStderrWrite as any;
  }
}

function installFailingPostPacketScaleAssessment(root: string): void {
  const skillDir = path.join(root, '_bmad', 'skills', 'requirements-contract-authoring');
  const scriptDir = path.join(skillDir, 'scripts');
  const sourceSkillDir = path.join(
    process.cwd(),
    '_bmad',
    'skills',
    'requirements-contract-authoring'
  );
  mkdirSync(scriptDir, { recursive: true });
  cpSync(path.join(sourceSkillDir, 'SKILL.md'), path.join(skillDir, 'SKILL.md'));

  const realScript = path.join(sourceSkillDir, 'scripts', 'assess_contract_authoring_scale.js');
  writeFileSync(
    path.join(scriptDir, 'assess_contract_authoring_scale.js'),
    [
      "const { spawnSync } = require('node:child_process');",
      "const phaseIndex = process.argv.indexOf('--phase');",
      "const phase = phaseIndex >= 0 ? process.argv[phaseIndex + 1] : '';",
      "if (phase === 'post_packet_assessment') {",
      "  process.stderr.write('forced post-packet assessment failure\\n');",
      '  process.exit(1);',
      '}',
      `const result = spawnSync(process.execPath, [${JSON.stringify(
        realScript
      )}, ...process.argv.slice(2)], { stdio: 'inherit' });`,
      'process.exit(result.status ?? 1);',
      '',
    ].join('\n'),
    'utf8'
  );
}

describe('main-agent requirement_confirmation.pre_confirmation_drilldown lane', () => {
  it('auto-persists checkpoints and promotes through the authoring-draft source writer', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-pre-confirmation-'));
    installJudgeRuntimeConfig(root);
    try {
      const source = writeDraftSource(root);
      const beforeSourceText = readFileSync(source, 'utf8');

      const result = runWithAuthoringLocalization(root, {
        source,
        recordId: 'REQ-PRE-CONFIRMATION-E2E',
        requirementSetId: 'REQSET-PRE-CONFIRMATION-E2E',
        confirmationLanguage: 'zh-CN',
        ...authorityForSource(root, source),
        criticalAuditorRound: cleanCriticalAuditorRound,
      });

      const paths = artifacts(root, 'REQ-PRE-CONFIRMATION-E2E', 'REQSET-PRE-CONFIRMATION-E2E');
      expect(result.currentMentalModel).toBe('requirement_confirmation');
      expect(result.lane).toBe('pre_confirmation_drilldown');
      expectCheckpointAutoPromoted(result, paths);
      expect(readFileSync(source, 'utf8')).not.toBe(beforeSourceText);
      expect(result.nextMentalModel).toBeNull();
      expect(result.deliveryReadiness.ready).toBe(false);
      expect(existsSync(paths.promotionReceipt)).toBe(true);
      expect(result.finalStandards).toMatchObject({
        newSkillFlowEntersAtomicDecompositionLoopBeforeMaterialization: true,
        singlePassCannotSkipAtomicDecompositionLoop: true,
        threeConsecutiveNoNewValidGapRoundsRequired: true,
        mustDecompositionPacketSynchronizedBeforeMaterialization: true,
        packetSourceReconciliationPassesBidirectionally: true,
        preRenderGateBlocksMissingCoreSurfaces: true,
        rendererShowsFullDrilldownInteraction: true,
      });

      for (const file of [
        paths.semanticKernel,
        paths.packet,
        paths.scaleAssessmentInitial,
        paths.scaleAssessmentPostPacket,
        paths.scaleAssessmentPostMaterialization,
        paths.scaleRoutingDecision,
        paths.sourceMutationDecision,
        paths.receipt1,
        paths.receipt2,
        paths.receipt3,
        paths.reconciliation,
        paths.progress,
        paths.mustGate,
        paths.globalGate,
      ]) {
        expect(existsSync(file), file).toBe(true);
      }
      expect(existsSync(paths.checkpointPersistenceEvidence)).toBe(true);

      for (const file of [
        paths.semanticKernel,
        paths.packet,
        paths.receipt1,
        paths.receipt2,
        paths.receipt3,
        paths.reconciliation,
        paths.progress,
        paths.mustGate,
        paths.globalGate,
      ]) {
        expectArtifactContract(file, 'REQ-PRE-CONFIRMATION-E2E');
      }

      const packet = readJson(paths.packet).must_decomposition_packet;
      const initialAssessment = readJson(paths.scaleAssessmentInitial);
      const postPacketAssessment = readJson(paths.scaleAssessmentPostPacket);
      const postMaterializationAssessment = readJson(paths.scaleAssessmentPostMaterialization);
      const scaleRoutingDecision = readJson(paths.scaleRoutingDecision);
      const mustGate = readJson(paths.mustGate);
      const globalGate = readJson(paths.globalGate);
      const reconciliation = readJson(paths.reconciliation);
      const progress = readJson(paths.progress);
      expect(packet.status).toBe('synchronized');
      expect(initialAssessment.phase).toBe('initial_assessment');
      expect(initialAssessment.provisionalDecision).toBe('provisional_single_pass_allowed');
      expect(postPacketAssessment.phase).toBe('post_packet_assessment');
      expect(postPacketAssessment.signals.conditionalDomainCount).toBe(
        postPacketAssessment.signals.applicableConditionalDomains.length
      );
      expect(postMaterializationAssessment.phase).toBe('post_materialization_assessment');
      expect(scaleRoutingDecision.decision).toBe('single_pass_final_allowed');
      expect(scaleRoutingDecision.latestCompletedPhase).toBe('post_materialization_assessment');
      expect(scaleRoutingDecision.checkpointPersistenceSatisfied).toBe(true);
      expect(scaleRoutingDecision.routeDecisionHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
      expect(progress.documentHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
      expect(progress.checkpoints.map((checkpoint: any) => checkpoint.id)).toEqual([
        'cp-00-semantic-kernel',
        'cp-01-must-decomposition-packet',
        'cp-02-atomic-decomposition-loop-convergence',
        'cp-03-packet-to-source-materialization',
        'cp-04-id-freeze',
        'cp-05-implementation-confirmation-core',
        'cp-06-projections',
        'cp-07-human-readable-views',
        'cp-08-pre-render-global-reconciliation',
      ]);
      expect(progress.checkpoints.every((checkpoint: any) => checkpoint.status === 'passed')).toBe(
        true
      );
      expect(packet.lifecycle.atomicDecompositionLoopEnteredBeforeMaterialization).toBe(true);
      expect(packet.lifecycle.singlePassBypassPrevented).toBe(true);
      expect(packet.lifecycle.materializedAfterStatus).toBe('synchronized');
      expect(packet.consecutiveNoNewValidGapRounds).toBe(3);
      expect(packet.mustPackets[0].mustAtomicTasks.length).toBeGreaterThanOrEqual(1);
      expect(packet.mustPackets[0].atomicityCompleteness.actualTaskCount).toBe(
        packet.mustPackets[0].mustAtomicTasks.length
      );
      expect(packet.mustPackets[0].atomicityCompleteness.expectedTaskCount).toBe(
        packet.mustPackets[0].mustAtomicTasks.length
      );
      expect(mustGate.verdict).toBe('PASS');
      expect(mustGate.confirmability).toBe('confirmable');
      expect(mustGate.criticalAuditor.consecutiveNoNewGapRounds).toBe(3);
      expect(globalGate.verdict).toBe('PASS');
      expect(reconciliation.verdict).toBe('pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('registers a current confirmation render without recording user confirmation', () => {
    const root = mkdtempSync(
      path.join(os.tmpdir(), 'main-agent-pre-confirmation-render-registration-')
    );
    installJudgeRuntimeConfig(root);
    try {
      const recordId = 'REQ-PRE-CONFIRMATION-RENDER-REGISTRATION';
      const requirementSetId = `${recordId}-SET`;
      const source = writeDraftSource(root);
      const result = runWithAuthoringLocalization(root, {
        source,
        recordId,
        requirementSetId,
        confirmationLanguage: 'zh-CN',
        ...authorityForSource(root, source),
        criticalAuditorRound: cleanCriticalAuditorRound,
      });
      const paths = artifacts(root, recordId, requirementSetId);
      const recordPath = path.join(
        root,
        '_bmad-output',
        'runtime',
        'requirement-records',
        recordId,
        'requirement-record.json'
      );
      const renderReport = readJson(paths.renderReport);
      const staleRecord = readJson(recordPath);
      staleRecord.sourceDocumentHash = `sha256:${'1'.repeat(64)}`;
      staleRecord.implementationConfirmationHash = `sha256:${'2'.repeat(64)}`;
      staleRecord.confirmationPageHash = `sha256:${'3'.repeat(64)}`;
      staleRecord.preConfirmationDrilldownLane.substate = 'blocked_by_render_gate';
      writeFileSync(recordPath, `${JSON.stringify(staleRecord, null, 2)}\n`, 'utf8');

      expect(result.substate).toBe('user_confirmable');
      const captured = captureMainAgentCli([
        '--cwd',
        root,
        '--action',
        'register-pre-confirmation-render',
        '--source',
        source,
        '--render-report',
        paths.renderReport,
        '--requirement-record',
        recordPath,
        '--record-id',
        recordId,
        '--requirement-set-id',
        requirementSetId,
      ]);

      expect(captured.exitCode, captured.stderr).toBe(0);
      const payload = JSON.parse(captured.stdout);
      expect(payload).toMatchObject({
        ok: true,
        action: 'register-pre-confirmation-render',
        substate: 'user_confirmable',
        sourceDocumentHash: renderReport.sourceDocumentHash,
        implementationConfirmationHash: renderReport.implementationConfirmationHash,
        confirmationPageHash: renderReport.confirmationPageHash,
      });
      const registeredRecord = readJson(recordPath);
      expect(registeredRecord).toMatchObject({
        status: 'draft',
        lastEventType: 'pre_confirmation_drilldown_user_confirmable',
        sourceDocumentHash: renderReport.sourceDocumentHash,
        implementationConfirmationHash: renderReport.implementationConfirmationHash,
        confirmationPageHash: renderReport.confirmationPageHash,
        preConfirmationDrilldownLane: {
          currentMentalModel: 'requirement_confirmation',
          substate: 'user_confirmable',
          controlledIngestRequiredBeforeProgression: true,
        },
      });
      expect(registeredRecord.confirmationHistory ?? []).not.toContainEqual(
        expect.objectContaining({ eventType: 'confirmation_recorded' })
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects single_pass because it would skip the atomic decomposition loop', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-pre-confirmation-single-pass-'));
    try {
      const source = writeDraftSource(root);

      const result = runWithAuthoringLocalization(root, {
        source,
        recordId: 'REQ-PRE-CONFIRMATION-SINGLE-PASS',
        ...authorityForSource(root, source),
        mode: 'single_pass',
      });

      expect(result.substate).toBe('blocked_by_under_split_task');
      expect(result.confirmability).toBe('blocked');
      expect(result.blockingIssues.map((issue) => issue.code)).toContain(
        'single_pass_cannot_skip_atomic_decomposition_loop'
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when no explicit MUST rows or inline implementationConfirmation.must entries exist', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-pre-confirmation-missing-must-'));
    try {
      const source = writeDraftSourceWithoutMust(root);

      const result = runWithAuthoringLocalization(root, {
        source,
        recordId: 'REQ-PRE-CONFIRMATION-MISSING-MUST',
        requirementSetId: 'REQSET-PRE-CONFIRMATION-MISSING-MUST',
        confirmationLanguage: 'zh-CN',
        ...authorityForSource(root, source),
        criticalAuditorRound: cleanCriticalAuditorRound,
      });

      const paths = artifacts(root, 'REQ-PRE-CONFIRMATION-MISSING-MUST');
      expect(result.substate).toBe('blocked_by_semantic_gap');
      expect(result.confirmability).toBe('blocked');
      expect(result.blockingIssues.map((issue) => issue.code)).toContain(
        'controlled_must_candidates_missing'
      );
      expect(existsSync(paths.controlledMustCandidates)).toBe(true);
      expect(existsSync(paths.draftImplementationConfirmation)).toBe(true);
      expect(existsSync(paths.authoringMaterializationReceipt)).toBe(true);
      const candidates = readJson(paths.controlledMustCandidates);
      const draftProjection = readJson(paths.draftImplementationConfirmation);
      const receipt = readJson(paths.authoringMaterializationReceipt);
      expect(candidates).toMatchObject({
        schemaVersion: 'requirements-authoring-controlled-must-candidates/v1',
        sourcePath: 'docs/requirements/source-without-must.md',
        candidateCount: 0,
        acceptedCandidateCount: 0,
        mustCount: 0,
        failClosed: true,
        decision: 'controlled_must_candidates_missing',
      });
      expect(draftProjection).toMatchObject({
        schemaVersion: 'requirements-authoring-draft-implementation-confirmation/v1',
        candidateCount: 0,
        acceptedCandidateCount: 0,
        mustCount: 0,
        failClosed: true,
        decision: 'controlled_must_candidates_missing',
      });
      expect(receipt).toMatchObject({
        schemaVersion: 'requirements-authoring-materialization-receipt/v1',
        candidateCount: 0,
        acceptedCandidateCount: 0,
        mustCount: 0,
        failClosed: true,
        decision: 'controlled_must_candidates_missing',
        requiresUserConfirmationBeforeExecution: true,
      });
      expect(existsSync(paths.semanticKernel)).toBe(false);
      expect(existsSync(paths.packet)).toBe(false);
      expect(existsSync(paths.receipt1)).toBe(false);
      expect(existsSync(paths.renderReport)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('materializes controlled MUST candidates from plain source before draft confirmation', () => {
    const root = mkdtempSync(
      path.join(os.tmpdir(), 'main-agent-pre-confirmation-plain-candidate-')
    );
    try {
      const source = writePlainSourceWithControlledCandidate(root);

      const result = runMainAgentPreConfirmationDrilldown(root, {
        source,
        recordId: 'REQ-PRE-CONFIRMATION-PLAIN-CANDIDATE',
        requirementSetId: 'REQSET-PRE-CONFIRMATION-PLAIN-CANDIDATE',
        ...authorityForSource(root, source),
        criticalAuditorRound: cleanCriticalAuditorRound,
      });

      const paths = artifacts(
        root,
        'REQ-PRE-CONFIRMATION-PLAIN-CANDIDATE',
        'REQSET-PRE-CONFIRMATION-PLAIN-CANDIDATE'
      );
      const candidates = readJson(paths.controlledMustCandidates);
      const draftProjection = readJson(paths.draftImplementationConfirmation);
      const receipt = readJson(paths.authoringMaterializationReceipt);

      expect(result.blockingIssues.map((issue) => issue.code)).not.toContain(
        'controlled_must_candidates_missing'
      );
      expect(existsSync(paths.controlledMustCandidates)).toBe(true);
      expect(existsSync(paths.draftImplementationConfirmation)).toBe(true);
      expect(existsSync(paths.authoringMaterializationReceipt)).toBe(true);
      expect(candidates).toMatchObject({
        schemaVersion: 'requirements-authoring-controlled-must-candidates/v1',
        candidateCount: 1,
        acceptedCandidateCount: 1,
        mustCount: 1,
        failClosed: true,
        decision: 'pre_confirmation_gate_blocked',
      });
      expect(candidates.candidates[0]).toMatchObject({
        candidateId: 'MUST-CAND-001',
        sourcePath: 'docs/requirements/plain-controlled-candidate.md',
        sourceSpan: { startLine: 7, endLine: 7 },
        headingPath: ['Plain Controlled Candidate Requirement', 'Functional Requirements'],
        sourceRequirementId: 'FR-001',
        projectedMustId: 'MUST-FR-001',
        decision: 'accepted_for_draft',
        requiresHumanReview: true,
      });
      expect(candidates.candidates[0].sourceDocumentHash).toMatch(/^sha256:/u);
      expect(draftProjection).toMatchObject({
        schemaVersion: 'requirements-authoring-draft-implementation-confirmation/v1',
        status: 'draft',
        candidateCount: 1,
        acceptedCandidateCount: 1,
        mustCount: 1,
        failClosed: true,
        implementationConfirmation: null,
        decision: 'pre_confirmation_gate_blocked',
      });
      expect(receipt).toMatchObject({
        schemaVersion: 'requirements-authoring-materialization-receipt/v1',
        candidateCount: 1,
        acceptedCandidateCount: 1,
        mustCount: 1,
        failClosed: true,
        decision: 'pre_confirmation_gate_blocked',
        requiresUserConfirmationBeforeExecution: true,
      });
      expect(existsSync(paths.draftSourcePreview)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not report controlled candidates missing when authority gates block existing source-bound candidates', () => {
    const root = mkdtempSync(
      path.join(os.tmpdir(), 'main-agent-pre-confirmation-candidates-authority-block-')
    );
    try {
      const source = writePlainSourceWithControlledCandidate(root);

      const result = runMainAgentPreConfirmationDrilldown(root, {
        source,
        recordId: 'REQ-PRE-CONFIRMATION-CANDIDATES-AUTHORITY-BLOCK',
        requirementSetId: 'REQSET-PRE-CONFIRMATION-CANDIDATES-AUTHORITY-BLOCK',
        criticalAuditorRound: cleanCriticalAuditorRound,
      });

      const paths = artifacts(
        root,
        'REQ-PRE-CONFIRMATION-CANDIDATES-AUTHORITY-BLOCK',
        'REQSET-PRE-CONFIRMATION-CANDIDATES-AUTHORITY-BLOCK'
      );
      const issueCodes = result.blockingIssues.map((issue) => issue.code);
      const candidates = readJson(paths.controlledMustCandidates);

      expect(issueCodes).toContain('validation_authority_missing');
      expect(issueCodes).not.toContain('controlled_must_candidates_missing');
      expect(candidates).toMatchObject({
        candidateCount: 1,
        acceptedCandidateCount: 1,
        mustCount: 1,
        failClosed: true,
        decision: 'pre_confirmation_gate_blocked',
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed instead of materializing line-based MUST ids from uncontrolled source prose', () => {
    const root = mkdtempSync(
      path.join(os.tmpdir(), 'main-agent-pre-confirmation-uncontrolled-prose-')
    );
    try {
      const source = writePlainSourceWithUncontrolledNormativeProse(root);

      const result = runMainAgentPreConfirmationDrilldown(root, {
        source,
        recordId: 'REQ-PRE-CONFIRMATION-UNCONTROLLED-PROSE',
        requirementSetId: 'REQSET-PRE-CONFIRMATION-UNCONTROLLED-PROSE',
        ...authorityForSource(root, source),
        criticalAuditorRound: cleanCriticalAuditorRound,
      });

      const paths = artifacts(
        root,
        'REQ-PRE-CONFIRMATION-UNCONTROLLED-PROSE',
        'REQSET-PRE-CONFIRMATION-UNCONTROLLED-PROSE'
      );
      const issueCodes = result.blockingIssues.map((issue) => issue.code);
      const candidates = readJson(paths.controlledMustCandidates);
      const draftProjection = readJson(paths.draftImplementationConfirmation);
      const serializedCandidates = JSON.stringify(candidates);

      expect(issueCodes).toContain('controlled_must_candidates_missing');
      expect(issueCodes).not.toContain('line_based_must_id_allowed');
      expect(candidates).toMatchObject({
        candidateCount: 0,
        acceptedCandidateCount: 0,
        mustCount: 0,
        failClosed: true,
        decision: 'controlled_must_candidates_missing',
      });
      expect(draftProjection).toMatchObject({
        candidateCount: 0,
        acceptedCandidateCount: 0,
        mustCount: 0,
        failClosed: true,
        implementationConfirmation: null,
        decision: 'controlled_must_candidates_missing',
      });
      expect(serializedCandidates).not.toMatch(/MUST-[A-Z0-9-]+-L\d+-\d+/u);
      expect(existsSync(paths.authoringMaterializationReceipt)).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed without draft confirmation when inline implementationConfirmation contains line-based MUST ids', () => {
    const root = mkdtempSync(
      path.join(os.tmpdir(), 'main-agent-pre-confirmation-line-based-inline-must-')
    );
    try {
      const source = writeSourceWithLineBasedInlineMust(root);

      const result = runMainAgentPreConfirmationDrilldown(root, {
        source,
        recordId: 'REQ-PRE-CONFIRMATION-LINE-BASED-INLINE-MUST',
        requirementSetId: 'REQSET-PRE-CONFIRMATION-LINE-BASED-INLINE-MUST',
        ...authorityForSource(root, source),
        criticalAuditorRound: cleanCriticalAuditorRound,
      });

      const paths = artifacts(
        root,
        'REQ-PRE-CONFIRMATION-LINE-BASED-INLINE-MUST',
        'REQSET-PRE-CONFIRMATION-LINE-BASED-INLINE-MUST'
      );
      const issueCodes = result.blockingIssues.map((issue) => issue.code);
      const draftProjection = readJson(paths.draftImplementationConfirmation);

      expect(issueCodes).toContain('line_based_must_id_forbidden');
      expect(draftProjection).toMatchObject({
        implementationConfirmation: null,
        decision: 'line_based_must_id_forbidden',
      });
      expect(JSON.stringify(draftProjection)).not.toMatch(/MUST-[A-Z0-9-]+-L\d+-\d+[^"]*"text"/u);
      expect(readFileSync(source, 'utf8')).toContain('MUST-REQ-DATASERVICE-GDS-TRIG-L104-002');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rebuilds controlled MUST rows from FR ID and NFR ID tables when stale line-based inline projection exists', () => {
    const root = mkdtempSync(
      path.join(os.tmpdir(), 'main-agent-pre-confirmation-fr-nfr-legacy-inline-')
    );
    try {
      const fixture = writeSourceWithLegacyInlineMustAndFrNfrTables(root);
      const { source } = fixture;

      const result = runMainAgentPreConfirmationDrilldown(root, {
        source,
        recordId: 'REQ-PRE-CONFIRMATION-FR-NFR-LEGACY-INLINE',
        requirementSetId: 'REQSET-PRE-CONFIRMATION-FR-NFR-LEGACY-INLINE',
        ...writeValidationAuthorityTarget(root),
        criticalAuditorRound: cleanCriticalAuditorRound,
      });

      const paths = artifacts(
        root,
        'REQ-PRE-CONFIRMATION-FR-NFR-LEGACY-INLINE',
        'REQSET-PRE-CONFIRMATION-FR-NFR-LEGACY-INLINE'
      );
      const issueCodes = result.blockingIssues.map((issue) => issue.code);
      expect(
        existsSync(paths.controlledMustCandidates),
        JSON.stringify(
          {
            blockingStage: result.blockingStage,
            blockingIssues: result.blockingIssues,
          },
          null,
          2
        )
      ).toBe(true);
      const candidates = readJson(paths.controlledMustCandidates);
      const draftProjection = readJson(paths.draftImplementationConfirmation);
      const confirmation = draftProjection.implementationConfirmation;
      const intakeReceipt = readJson(paths.intakeReceipt);
      const intentLineageLedger = readJson(paths.intentLineageLedger);
      const classificationBySpanId = new Map(
        intentLineageLedger.classifications.map((classification: any) => [
          classification.spanId,
          classification,
        ])
      );

      expect(issueCodes).not.toContain('line_based_must_id_forbidden');
      expect(issueCodes).not.toContain('controlled_must_candidates_missing');
      expect(
        existsSync(paths.draftSourcePreview),
        JSON.stringify({
          issueCodes,
          controlledMustCandidatesExists: existsSync(paths.controlledMustCandidates),
          draftImplementationConfirmationExists: existsSync(paths.draftImplementationConfirmation),
        })
      ).toBe(true);
      expect(candidates).toMatchObject({
        candidateCount: 4,
        acceptedCandidateCount: 4,
        mustCount: 4,
        failClosed: false,
        decision: 'draft_materialization_allowed',
      });
      expect(candidates.candidates.map((candidate: any) => candidate.sourceRequirementId)).toEqual(
        fixture.sourceRequirementIds
      );
      expect(confirmation.must.map((row: any) => row.id)).toEqual(fixture.mustRequirementIds);
      expect(JSON.stringify(draftProjection)).not.toContain(fixture.staleMustId);
      for (const [index, sourceRequirementId] of fixture.sourceRequirementIds.entries()) {
        const excerpt = intakeReceipt.excerpts.find((row: any) =>
          row.content.includes(sourceRequirementId)
        );
        expect(excerpt, `intake excerpt for ${sourceRequirementId}`).toBeTruthy();
        expect(classificationBySpanId.get(excerpt.excerptId)).toMatchObject({
          disposition: 'source_root',
          sourceRootRefs: [fixture.mustRequirementIds[index]],
        });
      }
      const staleProjectionExcerpt = intakeReceipt.excerpts.find((row: any) =>
        row.content.includes(fixture.staleMustId)
      );
      expect(staleProjectionExcerpt, 'stale projection intake excerpt').toBeTruthy();
      expect(classificationBySpanId.get(staleProjectionExcerpt.excerptId)).toMatchObject({
        disposition: 'excluded',
        exclusionRuleRef: 'non-semantic-source-line/v1',
      });
      const titleExcerpt = intakeReceipt.excerpts.find((row: any) =>
        row.content.includes('# Legacy Inline MUST With Source Tables')
      );
      expect(titleExcerpt, 'source title intake excerpt').toBeTruthy();
      expect(classificationBySpanId.get(titleExcerpt.excerptId)).toMatchObject({
        disposition: 'excluded',
        exclusionRuleRef: 'non-semantic-source-line/v1',
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks missing controlled MUST candidates before initial scale assessment', () => {
    const root = mkdtempSync(
      path.join(os.tmpdir(), 'main-agent-pre-confirmation-missing-must-scale-')
    );
    try {
      const source = writeDraftSourceWithoutMust(root);
      const authority = authorityForSource(root, source);

      const captured = captureMainAgentCli([
        '--cwd',
        root,
        '--action',
        'author-confirmation-ready-source',
        '--source',
        source,
        '--record-id',
        'REQ-PRE-CONFIRMATION-MISSING-MUST-SCALE',
        '--requirement-set-id',
        'REQSET-PRE-CONFIRMATION-MISSING-MUST-SCALE',
        '--target-path',
        authority.targetPath,
        '--required-command',
        authority.requiredCommand,
      ]);

      expect(captured.exitCode).toBe(1);
      expect(captured.stderr).not.toContain(
        '[requirements-contract-authoring] scale assessment started'
      );
      expect(captured.stderr).not.toContain(
        '[requirements-contract-authoring] scale assessment result'
      );
      expect(captured.stdout).toContain('controlled_must_candidates_missing');

      const parsed = JSON.parse(captured.stdout);
      const paths = artifacts(root, 'REQ-PRE-CONFIRMATION-MISSING-MUST-SCALE');
      expect(parsed.selectedAuthoringLane).toBe('author-confirmation-ready-source');
      expect(parsed.advisoryScan).toMatchObject({
        purpose: 'pre_materialization_advisory_scan',
        evidenceClass: 'not_audit_evidence',
        notAuditEvidence: true,
        readOnly: true,
        loopAllowed: false,
        artifactWriteAllowed: false,
      });
      expect(parsed.visibleAuthoringLaneMessage).toContain(
        'author-confirmation-ready-source lane selected'
      );
      expect(parsed.confirmationLanguage).toBeNull();
      expect(parsed.blockingIssues.map((issue: any) => issue.code)).toContain(
        'controlled_must_candidates_missing'
      );
      expect(parsed.blockingIssues.map((issue: any) => issue.code)).toContain(
        'renderer_blocker_release_failure'
      );
      expect(existsSync(paths.semanticIr)).toBe(true);
      expect(existsSync(path.join(paths.authoring, 'requirement-contract-model.json'))).toBe(true);
      expect(existsSync(paths.scaleAssessmentInitial)).toBe(false);
      expect(existsSync(paths.html)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('routes post-packet scale assessment failure back to assessment instead of Critical Auditor repair', () => {
    const root = mkdtempSync(
      path.join(os.tmpdir(), 'main-agent-pre-confirmation-post-packet-scale-failure-')
    );
    try {
      installFailingPostPacketScaleAssessment(root);
      const source = writeDraftSource(root);
      const beforeSourceText = readFileSync(source, 'utf8');
      const recordId = 'REQ-PRE-CONFIRMATION-POST-PACKET-SCALE-FAILURE';
      const requirementSetId = 'REQSET-PRE-CONFIRMATION-POST-PACKET-SCALE-FAILURE';

      const result = runWithAuthoringLocalization(root, {
        source,
        recordId,
        requirementSetId,
        confirmationLanguage: 'zh-CN',
        ...authorityForSource(root, source),
        criticalAuditorRound: cleanCriticalAuditorRound,
      });
      const paths = artifacts(root, recordId, requirementSetId);
      const transaction = readJson(path.join(paths.authoring, 'authoring-transaction.json'));

      expect(
        result.substate,
        JSON.stringify({
          blockingIssues: result.blockingIssues,
          nextRequiredAction: result.nextRequiredAction,
        })
      ).toBe('blocked_by_render_gate');
      expect(result.blockingIssues.map((issue: any) => issue.code)).toContain(
        'scale_assessment_report_missing'
      );
      expect(result.nextRequiredAction).toBe('rerun_post_packet_scale_assessment');
      expect(transaction.nextRequiredAction).toBe('rerun_post_packet_scale_assessment');
      expect(existsSync(paths.receipt1)).toBe(false);
      expect(readFileSync(source, 'utf8')).toBe(beforeSourceText);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not create or mutate docs/plans source without Critical Auditor and promotion evidence', () => {
    const root = mkdtempSync(
      path.join(os.tmpdir(), 'main-agent-pre-confirmation-plans-no-receipt-')
    );
    try {
      const source = writePlansDraftSource(root);
      const beforeSourceText = readFileSync(source, 'utf8');
      const beforeSourceHash = sha256Text(beforeSourceText);
      const authority = writeValidationAuthorityTarget(root);

      const captured = captureMainAgentCli([
        '--cwd',
        root,
        '--action',
        'author-confirmation-ready-source',
        '--source',
        source,
        '--record-id',
        'REQ-PRE-CONFIRMATION-PLANS-NO-RECEIPT',
        '--requirement-set-id',
        'REQSET-PRE-CONFIRMATION-PLANS-NO-RECEIPT',
        '--target-path',
        authority.targetPath,
        '--required-command',
        authority.requiredCommand,
      ]);
      const parsed = JSON.parse(captured.stdout);
      const paths = artifacts(
        root,
        'REQ-PRE-CONFIRMATION-PLANS-NO-RECEIPT',
        'REQSET-PRE-CONFIRMATION-PLANS-NO-RECEIPT'
      );

      expect(captured.exitCode).toBe(1);
      expect(parsed.sourcePath).toBe('docs/plans/source-plan.md');
      expect(parsed.blockingStage).toBe('critical_auditor_provider_mode_required');
      expect(parsed.sourceMutationPerformed).toBe(false);
      expect(parsed.forbiddenArtifacts).toContain('promotion-receipt');
      expect(parsed.forbiddenArtifacts).toContain('source-materialization-receipt');
      expect(readFileSync(source, 'utf8')).toBe(beforeSourceText);
      expect(sha256Text(readFileSync(source, 'utf8'))).toBe(beforeSourceHash);
      expect(existsSync(paths.scaleAssessmentInitial)).toBe(true);
      expect(existsSync(paths.scaleRoutingDecision)).toBe(true);
      expect(existsSync(paths.checkpointPersistenceEvidence)).toBe(false);
      expect(existsSync(paths.encodingReport)).toBe(false);
      expect(existsSync(paths.sourceMutationDecision)).toBe(true);
      expect(existsSync(paths.sourceMaterializationReceipt)).toBe(false);
      expect(existsSync(paths.promotionReceipt)).toBe(false);
      expect(existsSync(paths.draftSourcePreview)).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed instead of synthesizing clean Critical Auditor receipts', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-pre-confirmation-no-auditor-'));
    try {
      const source = writeDraftSource(root);
      const authority = writeValidationAuthorityTarget(root);

      const result = runWithAuthoringLocalization(root, {
        source,
        recordId: 'REQ-PRE-CONFIRMATION-NO-AUDITOR',
        requirementSetId: 'REQSET-PRE-CONFIRMATION-NO-AUDITOR',
        confirmationLanguage: 'zh-CN',
        ...authority,
      });

      const paths = artifacts(root, 'REQ-PRE-CONFIRMATION-NO-AUDITOR');
      expect(result.substate).toBe('critical_auditor_round_required');
      expect(result.confirmability).toBe('blocked');
      expect(result.blockingIssues.map((issue) => issue.code)).toContain(
        'critical_auditor_provider_mode_required'
      );
      expect(result.blockingStage).toBe('critical_auditor_provider_mode_required');
      expect(result.nextRequiredAction).toBe('run_main_session_critical_auditor_round');
      expect(result.criticalAuditorContinuation).toMatchObject({
        providerMode: 'main_session_inline',
        roundIndex: 1,
        nextRequiredAction: 'run_main_session_critical_auditor_round',
      });
      expect(existsSync(paths.receipt1)).toBe(false);
      expect(existsSync(paths.sourceMaterializationReceipt)).toBe(false);
      expect(existsSync(paths.renderReport)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('authoring-repair preserve-existing keeps a rich implementationConfirmation and blocks with a repair command', () => {
    const root = mkdtempSync(
      path.join(os.tmpdir(), 'main-agent-pre-confirmation-preserve-existing-')
    );
    try {
      const source = writeRichPreserveExistingRequirement(root);
      const implementationAttemptId =
        'implementation-attempt-REQSET-PRE-CONFIRMATION-PRESERVE-EXISTING';
      writePromotionReceipt(
        root,
        source,
        'REQ-PRE-CONFIRMATION-PRESERVE-EXISTING',
        'REQSET-PRE-CONFIRMATION-PRESERVE-EXISTING'
      );
      const original = readFileSync(source, 'utf8');

      const result = runMainAgentAuthoringRepair(root, {
        source,
        recordId: 'REQ-PRE-CONFIRMATION-PRESERVE-EXISTING',
        requirementSetId: 'REQSET-PRE-CONFIRMATION-PRESERVE-EXISTING',
        implementationAttemptId,
        mode: 'preserve-existing',
      });
      const paths = artifacts(
        root,
        'REQ-PRE-CONFIRMATION-PRESERVE-EXISTING',
        'REQSET-PRE-CONFIRMATION-PRESERVE-EXISTING'
      );

      expect(result.status).toBe('blocked');
      expect(
        result.blockingStage,
        JSON.stringify(
          {
            blockingIssues: result.blockingIssues,
            artifacts: result.artifacts,
          },
          null,
          2
        )
      ).toBe('critical_auditor_round_required');
      expect(result.nextRequiredAction).toBe('write_critical_auditor_round_response');
      expect(existsSync(paths.checkpointPersistenceEvidence)).toBe(true);
      const checkpointEvidence = readJson(paths.checkpointPersistenceEvidence);
      expect(checkpointEvidence.checkpointPersistenceSatisfiedCandidate).toBe(false);
      expect(checkpointEvidence.checkpointPersistenceRef.completedCheckpointIds).toEqual([
        'cp-00-semantic-kernel',
        'cp-01-must-decomposition-packet',
      ]);
      const deferredCheckpointPolicy =
        checkpointEvidence.checkpointPersistenceRef.preRenderGatePolicy;
      expect(deferredCheckpointPolicy).toMatchObject({
        mode: 'source_gap_fix_materialization',
        auditorConvergenceDeferredToNextRound: true,
      });
      const deferredCheckpointBlockerCodes =
        deferredCheckpointPolicy.deferredCriticalAuditorBlockers.map(
          (blocker: { code: string }) => blocker.code
        );
      expect(deferredCheckpointBlockerCodes).toContain(
        'critical_auditor_receipts_required_before_checkpoint'
      );
      expect(
        deferredCheckpointBlockerCodes.every((code: string) =>
          [
            'critical_auditor_receipt_missing',
            'critical_auditor_receipt_input_hash_stale',
            'critical_auditor_less_than_three_no_new_gap_rounds',
            'critical_auditor_validated_gap_unresolved',
            'critical_auditor_receipts_required_before_checkpoint',
            'author_claim_lacks_critic_disposition',
          ].includes(code)
        )
      ).toBe(true);
      const checkpointReceipt = (index: number) =>
        path.join(
          paths.authoring,
          `checkpoint-receipt-cp-${String(index).padStart(2, '0')}.json`
        );
      expect(readJson(checkpointReceipt(0))).toMatchObject({
        checkpointId: 'cp-00-semantic-kernel',
        decision: 'pass',
      });
      expect(readJson(checkpointReceipt(1))).toMatchObject({
        checkpointId: 'cp-01-must-decomposition-packet',
        decision: 'pass',
      });
      expect(readJson(checkpointReceipt(2))).toMatchObject({
        checkpointId: 'cp-02-atomic-decomposition-loop-convergence',
        persistenceStatus: 'committed',
        semanticValidationStatus: 'block',
        decision: 'block',
        blockers: [
          {
            code: 'critical_auditor_receipts_required_before_checkpoint',
          },
        ],
      });
      for (let checkpointIndex = 3; checkpointIndex <= 8; checkpointIndex += 1) {
        expect(existsSync(checkpointReceipt(checkpointIndex))).toBe(false);
      }
      expect(result.repairCommand).toContain(
        'main-agent-orchestration --action authoring-repair --mode preserve-existing'
      );
      expect(existsSync(path.join(root, result.paths.semanticKernel))).toBe(true);
      expect(existsSync(path.join(root, result.paths.mustDecompositionPacket))).toBe(true);
      expect(
        existsSync(
          path.join(
            root,
            '_bmad-output',
            'runtime',
            'requirement-records',
            'REQ-PRE-CONFIRMATION-PRESERVE-EXISTING',
            'authoring',
            'critical-auditor-round-request-1.json'
          )
        )
      ).toBe(true);
      const repairedText = readFileSync(source, 'utf8');
      const repairedConfirmation = readImplementationConfirmation(source);
      const repairedLines = repairedText.replace(/\r\n/gu, '\n').split('\n');
      const inlineRowSourceSpan = (id: string) => {
        const startLine =
          repairedLines.findIndex(
            (line) => new RegExp(`^\\s*-\\s+id:\\s*${id}\\s*$`, 'u').test(line)
          ) + 1;
        const nextConfirmationFieldIndex = repairedLines.findIndex(
          (line, index) =>
            index >= startLine && line.trim().length > 0 && /^\s{2}\S/u.test(line)
        );
        return {
          startLine,
          endLine:
            nextConfirmationFieldIndex >= 0
              ? nextConfirmationFieldIndex
              : repairedLines.length,
        };
      };
      const mustSourceSpan = inlineRowSourceSpan('MUST-900');
      const expectedMustSource = {
        sourceLine: mustSourceSpan.startLine,
        sourcePath: 'docs/requirements/rich-preserve-existing.md',
        sourceDocumentHash: sha256Text(repairedText),
        sourceSpan: mustSourceSpan,
        headingPath: ['implementationConfirmation', 'must', 'MUST-900'],
      };
      const semanticKernel = readJson(paths.semanticKernel).semanticKernel;
      const semanticIr = readJson(paths.semanticIr);
      const packet = readJson(paths.packet).must_decomposition_packet;
      const canonicalMustNode = semanticIr.nodes['MUST-FR-900'];
      const canonicalMustBody = semanticIr.semanticBodies[canonicalMustNode?.bodyHash];
      const canonicalNegativeNode = semanticIr.nodes['NEG-900'];
      const canonicalNegativeBody = semanticIr.semanticBodies[canonicalNegativeNode?.bodyHash];
      const canonicalBoundaryNode = semanticIr.nodes['OUT-900'];
      const canonicalBoundaryBody = semanticIr.semanticBodies[canonicalBoundaryNode?.bodyHash];
      expect(mustSourceSpan.startLine).toBeGreaterThan(0);
      expect(
        semanticKernel.sourceRequirementMap.find((row: any) => row.id === 'MUST-900')
      ).toMatchObject(expectedMustSource);
      expect(packet.mustPackets.find((row: any) => row.mustRef === 'MUST-900')).toMatchObject(
        expectedMustSource
      );
      expect(canonicalMustNode).toMatchObject({
        nodeType: 'requirement',
      });
      expect(canonicalMustBody).toMatchObject({
        id: 'MUST-FR-900',
        kind: 'functional',
        source: {
          sourceRequirementId: 'MUST-900',
          sourceSpan: expectedMustSource.sourceSpan,
          headingPath: expectedMustSource.headingPath,
        },
      });
      expect(canonicalNegativeBody).toMatchObject({
        id: 'NEG-900',
        kind: 'negative',
        source: {
          sourceRequirementId: 'NEG-900',
          sourceSpan: inlineRowSourceSpan('NEG-900'),
          headingPath: [
            'implementationConfirmation',
            'Negative Requirements And Not Done Conditions',
            'NEG-900',
          ],
        },
      });
      expect(canonicalBoundaryBody).toMatchObject({
        id: 'OUT-900',
        kind: 'out_of_scope',
        source: {
          sourceRequirementId: 'OUT-900',
          sourceSpan: inlineRowSourceSpan('OUT-900'),
          headingPath: ['implementationConfirmation', 'Out Of Scope', 'OUT-900'],
        },
      });
      expect(repairedText).toContain('CUSTOM-PRESERVE-ANCHOR');
      expect(repairedText).toContain('customAuditRows:');
      expect(repairedConfirmation.must.map((row: any) => row.id)).toContain('MUST-900');
      expect(repairedConfirmation.notDone.map((row: any) => row.id)).toContain('NEG-900');
      expect(repairedConfirmation.mustNot.map((row: any) => row.id)).toContain('OUT-900');
      expect(repairedConfirmation.customAuditRows).toEqual([
        { id: 'CUSTOM-ROW-900', text: 'custom section must stay' },
      ]);
      expect(repairedText.length).toBeGreaterThan(original.length);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('continues Critical Auditor rounds until three consecutive no-new-gap receipts', () => {
    const root = mkdtempSync(
      path.join(os.tmpdir(), 'main-agent-pre-confirmation-real-audit-loop-')
    );
    installJudgeRuntimeConfig(root);
    try {
      const source = writeDraftSource(root);
      const seenRounds: number[] = [];

      const result = runWithAuthoringLocalization(root, {
        source,
        recordId: 'REQ-PRE-CONFIRMATION-REAL-AUDIT-LOOP',
        requirementSetId: 'REQSET-PRE-CONFIRMATION-REAL-AUDIT-LOOP',
        confirmationLanguage: 'zh-CN',
        ...authorityForSource(root, source),
        criticalAuditorRound: (input) => {
          const { roundIndex } = input;
          seenRounds.push(roundIndex);
          if (roundIndex <= 2) {
            return {
              verdict: 'new_valid_gap',
              gateDryRunHash: input.gateDryRun.hash,
              reconciliationIssueCount: input.gateDryRun.reconciliation.issueCount,
              checkedProjectionGroups: input.packetProjectionSummary.projectionGroups,
              checkedProjectionQualityRuleCodes: checkedProjectionQualityRuleCodesForRequest(input),
              reviewedProjectionRefs: input.packetProjectionSummary.projectionRefs.slice(0, 1),
              priorFindingsDisposition: [
                {
                  findingRef: `ROUND-${roundIndex}-GAP`,
                  disposition: 'new',
                  evidenceRefs: [input.gateDryRun.reportPath],
                },
              ],
              gapCandidates: [{ id: `GAP-${roundIndex}`, status: 'resolved' }],
              validatedGaps: [{ id: `GAP-${roundIndex}`, status: 'resolved' }],
              rationale: `Round ${roundIndex} found a valid gap and reset convergence.`,
            };
          }
          return withIndependentProviderEvidence(input, {
            verdict: 'no_new_valid_gap',
            gateDryRunHash: input.gateDryRun.hash,
            reconciliationIssueCount: input.gateDryRun.reconciliation.issueCount,
            checkedProjectionGroups: input.packetProjectionSummary.projectionGroups,
            checkedProjectionQualityRuleCodes: checkedProjectionQualityRuleCodesForRequest(input),
            reviewedProjectionRefs: input.packetProjectionSummary.projectionRefs.slice(0, 1),
            priorFindingsDisposition: [
              {
                findingRef: `ROUND-${roundIndex}-BASELINE`,
                disposition: 'unchanged',
                evidenceRefs: [input.gateDryRun.reportPath],
              },
            ],
            rejectedGapCandidates: [
              { id: `REJ-${roundIndex}`, reason: 'no new valid gap after repairs' },
            ],
            rationale: `Round ${roundIndex} found no new valid gap.`,
          });
        },
      });

      const paths = artifacts(root, 'REQ-PRE-CONFIRMATION-REAL-AUDIT-LOOP');
      const receipt4 = path.join(paths.authoring, 'critical-auditor-receipt-round-4.json');
      const receipt5 = path.join(paths.authoring, 'critical-auditor-receipt-round-5.json');
      const receipt6 = path.join(paths.authoring, 'critical-auditor-receipt-round-6.json');
      const mustGate = readJson(paths.mustGate);

      expectCheckpointAutoPromoted(result, paths);
      expect(seenRounds).toEqual([1, 2, 3, 4, 5]);
      expect(existsSync(paths.receipt1)).toBe(true);
      expect(existsSync(paths.receipt2)).toBe(true);
      expect(existsSync(paths.receipt3)).toBe(true);
      expect(existsSync(receipt4)).toBe(true);
      expect(existsSync(receipt5)).toBe(true);
      expect(readJson(paths.receipt1).criticalAuditorReceipt.convergenceDecision.verdict).toBe(
        'new_valid_gap'
      );
      expect(readJson(paths.receipt2).criticalAuditorReceipt.convergenceDecision.verdict).toBe(
        'new_valid_gap'
      );
      expect(readJson(paths.receipt3).criticalAuditorReceipt.convergenceDecision.verdict).toBe(
        'no_new_valid_gap'
      );
      expect(readJson(receipt4).criticalAuditorReceipt.convergenceDecision.verdict).toBe(
        'no_new_valid_gap'
      );
      expect(readJson(receipt5).criticalAuditorReceipt.convergenceDecision.verdict).toBe(
        'no_new_valid_gap'
      );
      expect(existsSync(receipt6)).toBe(false);
      expect(mustGate.verdict).toBe('PASS');
      expect(mustGate.criticalAuditor.consecutiveNoNewGapRounds).toBe(3);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('authors source-derived MUST rows into packet projections and audits until three clean rounds', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-pre-confirmation-source-driven-'));
    installJudgeRuntimeConfig(root);
    try {
      const source = writeSourceDrivenRequirement(root);
      const expectedMustTexts = [
        'Preserve the user-supplied requirement sentence as a first-class MUST row before rendering.',
        'Split every authored MUST row into packet-backed atomic tasks before materialization.',
        'Pass Critical Auditor only after the auditor can see all source-derived MUST references.',
      ];
      const seenAuditorInputs: any[] = [];

      const result = runMainAgentPreConfirmationDrilldown(root, {
        source,
        recordId: 'REQ-PRE-CONFIRMATION-SOURCE-DRIVEN',
        requirementSetId: 'REQSET-PRE-CONFIRMATION-SOURCE-DRIVEN',
        implementationAttemptId:
          'implementation-attempt-REQSET-PRE-CONFIRMATION-SOURCE-DRIVEN',
        confirmationLanguage: 'en-US',
        ...writeValidationAuthorityTarget(root),
        criticalAuditorRound: (input) => {
          seenAuditorInputs.push(input);
          if (input.roundIndex === 1) {
            return {
              verdict: 'new_valid_gap',
              gateDryRunHash: input.gateDryRun.hash,
              reconciliationIssueCount: input.gateDryRun.reconciliation.issueCount,
              checkedProjectionGroups: input.packetProjectionSummary.projectionGroups,
              checkedProjectionQualityRuleCodes: checkedProjectionQualityRuleCodesForRequest(input),
              reviewedProjectionRefs: input.packetProjectionSummary.projectionRefs.slice(0, 1),
              priorFindingsDisposition: [
                {
                  findingRef: 'GAP-SOURCE-ROUND-1',
                  disposition: 'new',
                  evidenceRefs: [input.gateDryRun.reportPath],
                },
              ],
              gapCandidates: [{ id: 'GAP-SOURCE-ROUND-1', status: 'resolved' }],
              validatedGaps: [{ id: 'GAP-SOURCE-ROUND-1', status: 'resolved' }],
              rationale: 'First audit round found a resolved source-driven decomposition gap.',
            };
          }
          return withIndependentProviderEvidence(input, {
            verdict: 'no_new_valid_gap',
            gateDryRunHash: input.gateDryRun.hash,
            reconciliationIssueCount: input.gateDryRun.reconciliation.issueCount,
            checkedProjectionGroups: input.packetProjectionSummary.projectionGroups,
            checkedProjectionQualityRuleCodes: checkedProjectionQualityRuleCodesForRequest(input),
            reviewedProjectionRefs: input.packetProjectionSummary.projectionRefs.slice(0, 1),
            priorFindingsDisposition: [
              {
                findingRef: `ROUND-${input.roundIndex}-SOURCE`,
                disposition: 'unchanged',
                evidenceRefs: [input.gateDryRun.reportPath],
              },
            ],
            rejectedGapCandidates: [
              { id: `REJ-SOURCE-${input.roundIndex}`, reason: 'all source-derived MUSTs visible' },
            ],
            rationale: `Round ${input.roundIndex} found no new source-derived gap.`,
          });
        },
      });

      const paths = artifacts(root, 'REQ-PRE-CONFIRMATION-SOURCE-DRIVEN');
      expect(
        existsSync(paths.mustGate),
        JSON.stringify(
          {
            blockingStage: result.blockingStage,
            blockingIssues: result.blockingIssues,
            renderRoundTripReport: existsSync(
              path.join(paths.authoring, 'proofs', 'render-roundtrip-report.json')
            )
              ? readJson(path.join(paths.authoring, 'proofs', 'render-roundtrip-report.json'))
              : null,
          },
          null,
          2
        )
      ).toBe(true);
      const confirmation = readDraftPreviewImplementationConfirmation(paths);
      const kernel = readJson(paths.semanticKernel).semanticKernel;
      const packet = readJson(paths.packet).must_decomposition_packet;
      const mustGate = readJson(paths.mustGate);
      const sourceText = readFileSync(paths.draftSourcePreview, 'utf8');

      expectCheckpointAutoPromoted(result, paths);
      expect(seenAuditorInputs.map((input) => input.roundIndex)).toEqual([1, 2, 3, 4]);
      expect(mustGate.criticalAuditor.consecutiveNoNewGapRounds).toBe(3);

      const mustRows = confirmation.must as Array<{ id: string; text: string }>;
      const mustTexts = mustRows.map((row) => row.text);
      expect(mustRows).toHaveLength(3);
      expect(mustRows.map((row) => row.id)).toEqual(['MUST-FR-001', 'MUST-FR-002', 'MUST-FR-003']);
      expect(mustRows.some((row) => /^MUST-.*-L[0-9]+-[0-9]+$/u.test(row.id))).toBe(false);
      expect(mustTexts).toEqual(expectedMustTexts);
      expect(sourceText).toContain(expectedMustTexts[0]);
      expect(sourceText).toContain(expectedMustTexts[1]);
      expect(sourceText).toContain(expectedMustTexts[2]);

      const mustRefs = mustRows.map((row) => row.id);
      expect(kernel.mustCandidates).toEqual(mustRefs);
      expect(packet.mustPackets.map((row: any) => row.mustRef)).toEqual(mustRefs);
      expect(packet.mustPackets.map((row: any) => row.mustIntent)).toEqual(expectedMustTexts);

      for (const mustPacket of packet.mustPackets) {
        expect(mustPacket.sourceRequirementText).toBe(
          expectedMustTexts[mustRefs.indexOf(mustPacket.mustRef)]
        );
        expect(mustPacket.mustAtomicTasks.length).toBeGreaterThanOrEqual(1);
        expect(mustPacket.atomicityCompleteness.actualTaskCount).toBe(
          mustPacket.mustAtomicTasks.length
        );
        expect(mustPacket.atomicityCompleteness.expectedTaskCount).toBe(
          mustPacket.mustAtomicTasks.length
        );
        expect(
          mustPacket.mustAtomicTasks.every(
            (task: any) => task.derivedFromMustRef === mustPacket.mustRef
          )
        ).toBe(true);
        expect(mustPacket.mustExecutionDecompositionMatrix[0].mustRef).toBe(mustPacket.mustRef);
      }

      expect(
        seenAuditorInputs.every((input) => input.mustRefs.join(',') === mustRefs.join(','))
      ).toBe(true);
      expect(seenAuditorInputs.every((input) => input.mustPacketCount === 3)).toBe(true);

      const sourceDefinedBusinessViews = [
        ...confirmation.sequenceViews,
        ...confirmation.flowViews,
        ...confirmation.edgeCaseViews,
      ].filter((view: any) => view.scope === 'business' && view.visualKind);
      expect(sourceDefinedBusinessViews.map((view: any) => view.visualKind).sort()).toEqual([
        'edge',
        'failure',
        'flow',
        'happy',
        'state',
      ]);
      const traceRowsById = new Map(confirmation.traceRows.map((row: any) => [row.id, row]));
      for (const view of sourceDefinedBusinessViews) {
        expect(view.traceRows.length, `${view.id} traceRows`).toBeGreaterThan(0);
        expect(view.evidenceRefs.length, `${view.id} evidenceRefs`).toBeGreaterThan(0);
        expect(view.acceptanceRefs.length, `${view.id} acceptanceRefs`).toBeGreaterThan(0);
        expect(
          view.traceRows.every((ref: string) => traceRowsById.has(ref)),
          `${view.id} traceRows resolve`
        ).toBe(true);
        expect(
          view.evidenceRefs.every((ref: string) =>
            confirmation.evidence.some((row: any) => row.id === ref)
          ),
          `${view.id} evidenceRefs resolve`
        ).toBe(true);
        expect(
          view.acceptanceRefs.every((ref: string) =>
            [...confirmation.acceptanceTests, ...confirmation.e2eSuites].some(
              (row: any) => row.id === ref
            )
          ),
          `${view.id} acceptanceRefs resolve`
        ).toBe(true);
        for (const traceRef of view.traceRows) {
          const trace = traceRowsById.get(traceRef) as any;
          expect(
            [
              ...(trace.sequenceViewRefs ?? []),
              ...(trace.flowViewRefs ?? []),
              ...(trace.edgeCaseViewRefs ?? []),
              ...(trace.viewRefs ?? []),
              ...(trace.diagramRefs ?? []),
            ],
            `${traceRef} reciprocates ${view.id}`
          ).toContain(view.id);
          expect(trace.evidenceRefs.some((ref: string) => view.evidenceRefs.includes(ref))).toBe(
            true
          );
          expect(
            trace.acceptanceRefs.some((ref: string) => view.acceptanceRefs.includes(ref))
          ).toBe(true);
        }
      }
      expect(
        sourceDefinedBusinessViews.find((view: any) => view.visualKind === 'failure')
          ?.failurePathRefs
      ).toEqual(expect.arrayContaining(confirmation.failurePaths.map((row: any) => row.id)));
      expect(
        sourceDefinedBusinessViews.find((view: any) => view.visualKind === 'edge')?.edgeCaseRefs
      ).toEqual(expect.arrayContaining(confirmation.edgeCases.map((row: any) => row.id)));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('materializes source Failure Matrix rows as consumer business failure paths', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-business-failure-matrix-'));
    installJudgeRuntimeConfig(root);
    try {
      const source = writeSourceWithBusinessFailureMatrix(root);

      const result = runMainAgentPreConfirmationDrilldown(root, {
        source,
        recordId: 'REQ-BUSINESS-FAILURE-MATRIX',
        requirementSetId: 'REQSET-BUSINESS-FAILURE-MATRIX',
        implementationAttemptId: 'implementation-attempt-REQSET-BUSINESS-FAILURE-MATRIX',
        confirmationLanguage: 'en-US',
        ...writeConsumerMarketDataAuthorityTarget(root),
        criticalAuditorRound: (input) =>
          withIndependentProviderEvidence(input, {
            verdict: 'no_new_valid_gap',
            gateDryRunHash: input.gateDryRun.hash,
            reconciliationIssueCount: input.gateDryRun.reconciliation.issueCount,
            checkedProjectionGroups: input.packetProjectionSummary.projectionGroups,
            checkedProjectionQualityRuleCodes: checkedProjectionQualityRuleCodesForRequest(input),
            reviewedProjectionRefs: input.packetProjectionSummary.projectionRefs.slice(0, 1),
            priorFindingsDisposition: [
              {
                findingRef: `ROUND-${input.roundIndex}-BUSINESS-FAILURE-MATRIX`,
                disposition: 'unchanged',
                evidenceRefs: [input.gateDryRun.reportPath],
              },
            ],
            rejectedGapCandidates: [
              {
                id: `REJ-BUSINESS-FAILURE-MATRIX-${input.roundIndex}`,
                reason: 'source business failure matrix is projected into the packet and source',
              },
            ],
            rationale:
              'The source-defined consumer failure paths remain visible and independently traceable.',
          }),
      });

      const paths = artifacts(root, 'REQ-BUSINESS-FAILURE-MATRIX');
      expect(
        result.blockingIssues,
        JSON.stringify(
          {
            blockingIssues: result.blockingIssues,
            renderRoundTripReport: existsSync(
              path.join(paths.authoring, 'proofs', 'render-roundtrip-report.json')
            )
              ? readJson(path.join(paths.authoring, 'proofs', 'render-roundtrip-report.json'))
              : null,
          },
          null,
          2
        )
      ).toEqual([]);
      const confirmation = readDraftPreviewImplementationConfirmation(paths);
      const packet = readJson(paths.packet).must_decomposition_packet;
      const failurePaths = confirmation.failurePaths as Array<Record<string, unknown>>;

      expect(failurePaths.map((row) => row.id)).toEqual(['FAIL-001', 'FAIL-002']);
      expect(failurePaths[0]).toMatchObject({
        title: 'DataBus schema mismatch',
        trigger: 'DataBus schema mismatch; impact: consumer attach is unsafe.',
        expectedBehavior:
          'Consumer rejects live attach with schema_mismatch and remains in incompatible non-live state.',
        linkedNegIds: ['NEG-001'],
      });
      expect(failurePaths[1]).toMatchObject({
        title: 'Ordered tick sequence gap',
        trigger: 'Ordered tick sequence gap; impact: trigger correctness is unsafe.',
        expectedBehavior:
          'TriggerService pauses automatic evaluation before any new OrderIntent and records tick_gap.',
        linkedNegIds: ['NEG-002'],
      });
      expect(JSON.stringify(failurePaths).toLowerCase()).not.toContain('drilldown');
      expect(
        packet.mustPackets
          .flatMap((row: any) => row.mustFailureEdgeProjection)
          .map((row: any) => row.id)
      ).toEqual(expect.arrayContaining(['FAIL-001', 'FAIL-002']));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('requires a controlled confirmation_recorded event before mental model progression', () => {
    const root = mkdtempSync(
      path.join(os.tmpdir(), 'main-agent-pre-confirmation-controlled-ingest-')
    );
    try {
      const source = writeDraftSource(root);
      const recordId = 'REQ-PRE-CONFIRMATION-CONTROLLED-INGEST';
      const requirementSetId = 'REQSET-PRE-CONFIRMATION-CONTROLLED-INGEST';
      const sourceDocumentHash = sha256Text(readFileSync(source, 'utf8'));
      const implementationConfirmationHash = sha256Json({
        recordId,
        requirementSetId,
        status: 'draft',
      });
      const recordPath = path.join(
        root,
        '_bmad-output',
        'runtime',
        'requirement-records',
        requirementSetId,
        'requirement-record.json'
      );
      mkdirSync(path.dirname(recordPath), { recursive: true });
      const record = {
        recordId,
        requirementSetId,
        status: 'draft',
        flow: 'standalone_tasks',
        stage: 'implement',
        sourcePath: path.relative(root, source).replace(/\\/g, '/'),
        sourceDocumentHash,
        implementationConfirmationHash,
        preConfirmationDrilldownLane: {
          currentMentalModel: 'requirement_confirmation',
          lane: 'pre_confirmation_drilldown',
          substate: 'user_confirmable',
          nextMentalModel: null,
          controlledIngestRequiredBeforeProgression: true,
        },
        architectureConfirmationState: {
          status: 'missing',
          reasonCode: 'blocked_until_controlled_requirement_confirmation_ingest',
        },
      };
      writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');

      const forgedSurface = resolveMainAgentOrchestrationSurface({
        projectRoot: root,
        recordId,
        requirementSetId,
        flow: 'standalone_tasks',
        stage: 'implement',
      });
      expect(forgedSurface.preConfirmationDrilldownLane?.currentSubstate).toBe('user_confirmable');
      expect(forgedSurface.preConfirmationDrilldownLane?.nextMentalModel).toBeNull();
      expect(
        forgedSurface.preConfirmationDrilldownLane?.controlledIngestRequiredBeforeProgression
      ).toBe(true);

      writeFileSync(
        recordPath,
        `${JSON.stringify(
          {
            ...record,
            status: 'user_confirmed',
            confirmationHistory: [
              {
                eventType: 'confirmation_recorded',
                sourceDocumentHash,
                implementationConfirmationHash,
              },
            ],
          },
          null,
          2
        )}\n`,
        'utf8'
      );
      const controlledSurface = resolveMainAgentOrchestrationSurface({
        projectRoot: root,
        recordId,
        requirementSetId,
        flow: 'standalone_tasks',
        stage: 'implement',
      });
      expect(controlledSurface.preConfirmationDrilldownLane?.currentSubstate).toBe(
        'user_confirmed'
      );
      expect(controlledSurface.preConfirmationDrilldownLane?.nextMentalModel).toBe(
        'architecture_confirmation'
      );
      expect(
        controlledSurface.preConfirmationDrilldownLane?.controlledIngestRequiredBeforeProgression
      ).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when drilldown surfaces are missing and exposes the CLI action through main-agent orchestration', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-pre-confirmation-cli-'));
    try {
      const source = writeDraftSource(root);
      const missing = runMainAgentPreConfirmationDrilldown(root, {
        source,
        recordId: 'REQ-PRE-CONFIRMATION-MISSING-SURFACES',
        ...authorityForSource(root, source),
        skipDrilldownArtifacts: true,
      });
      expect(missing.substate).toBe('critical_auditor_round_required');
      expect(missing.confirmability).toBe('blocked');
      expect(missing.blockingIssues.map((issue: any) => issue.code)).toContain(
        'critical_auditor_provider_mode_required'
      );
      expect(readFileSync(source, 'utf8')).not.toContain('implementationConfirmation:');

      const exitCode = mainMainAgentOrchestration([
        '--cwd',
        root,
        '--action',
        'pre-confirmation-drilldown',
        '--source',
        source,
        '--record-id',
        'REQ-PRE-CONFIRMATION-CLI',
        '--requirement-set-id',
        'REQSET-PRE-CONFIRMATION-CLI',
        '--confirmation-language',
        'zh-CN',
        '--target-path',
        authorityForSource(root, source).targetPath,
        '--required-command',
        authorityForSource(root, source).requiredCommand,
      ]);
      expect(exitCode).toBe(1);
      expect(existsSync(artifacts(root, 'REQ-PRE-CONFIRMATION-CLI').renderReport)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each(['author-confirmation-ready-source', 'author_confirmation_ready_source'])(
    'exposes %s as the visible authoring lane action',
    (action) => {
      const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-authoring-lane-action-'));
      try {
        const source = writeDraftSourceWithoutMust(root);
        const authority = authorityForSource(root, source);

        const captured = captureMainAgentCli([
          '--cwd',
          root,
          '--action',
          action,
          '--source',
          source,
          '--record-id',
          `REQ-AUTHORING-LANE-${action.replace(/[^A-Z0-9]/giu, '-').toUpperCase()}`,
          '--requirement-set-id',
          `REQSET-AUTHORING-LANE-${action.replace(/[^A-Z0-9]/giu, '-').toUpperCase()}`,
          '--target-path',
          authority.targetPath,
          '--required-command',
          authority.requiredCommand,
        ]);

        expect(captured.exitCode).toBe(1);
        const parsed = JSON.parse(captured.stdout);
        expect(parsed.selectedAuthoringLane).toBe('author-confirmation-ready-source');
        expect(parsed.visibleAuthoringLaneMessage).toContain(
          'author-confirmation-ready-source lane selected'
        );
        expect(parsed.blockingIssues.map((issue: any) => issue.code)).toContain(
          'controlled_must_candidates_missing'
        );
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  );

  it('promotes source before render and then blocks rendering when confirmation language is missing', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-authoring-language-boundary-'));
    installJudgeRuntimeConfig(root);
    try {
      const source = writeDraftSource(root);
      const beforeSourceText = readFileSync(source, 'utf8');

      const result = runMainAgentPreConfirmationDrilldown(root, {
        source,
        recordId: 'REQ-AUTHORING-LANGUAGE-BOUNDARY',
        requirementSetId: 'REQSET-AUTHORING-LANGUAGE-BOUNDARY',
        implementationAttemptId: 'implementation-attempt-REQSET-AUTHORING-LANGUAGE-BOUNDARY',
        ...authorityForSource(root, source),
        criticalAuditorRound: cleanCriticalAuditorRound,
      });
      const paths = artifacts(root, 'REQ-AUTHORING-LANGUAGE-BOUNDARY');
      const confirmation = readDraftPreviewImplementationConfirmation(paths);

      expectCheckpointAutoPromoted(result, paths);
      expect(readFileSync(source, 'utf8')).not.toBe(beforeSourceText);
      expect(result.status).toBe('draft_updated_not_confirmation_ready');
      expect(result.substate).toBe('pre_render_ready');
      expect(result.confirmationLanguage).toBeNull();
      expect(confirmation.confirmationLanguage).toBe('not_selected');
      expect(result.blockingIssues.map((issue: any) => issue.code)).toContain(
        'language_required_before_render'
      );
      expect(result.currentBlockingReason).toBe('confirmation_language_not_selected');
      expect(result.nextRequiredAction).toBe(
        'select_confirmation_language_then_render_confirmation'
      );
      expect(result.nextUserPrompt).toContain('确认页语言');
      expect(result.changedSections ?? []).toContain('TARGET-MOD-001');
      expect(result.updatedSourceSections ?? []).toContain('TARGET-MOD-001');
      expect(existsSync(paths.semanticKernel)).toBe(true);
      expect(existsSync(paths.packet)).toBe(true);
      expect(existsSync(paths.mustGate)).toBe(true);
      expect(existsSync(paths.globalGate)).toBe(true);
      expect(existsSync(paths.html)).toBe(false);
      expect(existsSync(paths.renderReport)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each(['.codex', '.cursor', '.claude'])(
    'resolves skill-local scripts from a consumer %s skill install without _bmad skills',
    (surface) => {
      const root = mkdtempSync(
        path.join(os.tmpdir(), `main-agent-pre-confirmation-${surface.slice(1)}-skill-`)
      );
      installJudgeRuntimeConfig(root);
      try {
        const sourceSkill = path.join(
          process.cwd(),
          '_bmad',
          'skills',
          'requirements-contract-authoring'
        );
        const targetSkill = path.join(root, surface, 'skills', 'requirements-contract-authoring');
        mkdirSync(path.dirname(targetSkill), { recursive: true });
        cpSync(sourceSkill, targetSkill, { recursive: true });
        cpSync(path.join(process.cwd(), '_bmad', 'shared'), path.join(root, surface, 'shared'), {
          recursive: true,
        });
        const source = writeDraftSource(root);
        const recordId = `REQ-PRE-CONFIRMATION-${surface.slice(1).toUpperCase()}-SKILL`;

        const result = runWithAuthoringLocalization(root, {
          source,
          recordId,
          requirementSetId: `${recordId}-SET`,
          confirmationLanguage: 'zh-CN',
          ...authorityForSource(root, source),
          criticalAuditorRound: cleanCriticalAuditorRound,
        });

        const skillArtifacts = artifacts(root, recordId);
        expect(
          result.substate,
          JSON.stringify(
            {
              blockingIssues: result.blockingIssues,
              renderReport: existsSync(skillArtifacts.renderReport)
                ? readJson(skillArtifacts.renderReport)
                : null,
              mustGate: existsSync(skillArtifacts.mustGate)
                ? readJson(skillArtifacts.mustGate)
                : null,
              globalGate: existsSync(skillArtifacts.globalGate)
                ? readJson(skillArtifacts.globalGate)
                : null,
            },
            null,
            2
          )
        ).toBe('blocked_by_render_gate');
        expect(result.blockingIssues.map((issue: any) => issue.code)).not.toContain(
          'checkpoint_required_before_source_materialization'
        );
        expect(existsSync(skillArtifacts.mustGate)).toBe(true);
        expect(existsSync(skillArtifacts.globalGate)).toBe(true);
        expect(existsSync(skillArtifacts.sourceMaterializationReceipt)).toBe(false);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  );
});
