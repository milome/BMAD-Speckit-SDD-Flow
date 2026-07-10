import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  RequirementContractCompilerInput,
  RequirementContractModel,
} from './requirements-contract-model';

function ordinal(index: number): string {
  return String(index + 1).padStart(3, '0');
}

export function compileRequirementContractModel(
  input: RequirementContractCompilerInput
): RequirementContractModel {
  const must = input.must.map((row, index) => ({
    ...row,
    id: row.id || `MUST-${ordinal(index)}`,
    authorityState: row.authorityState ?? 'source_grounded',
    provenance: row.provenance ?? {
      sourceRequirementId: row.sourceRequirementId ?? row.id ?? `MUST-${ordinal(index)}`,
      sourcePath: row.sourcePath ?? null,
      sourceSpan: row.sourceSpan ?? null,
      compiler: 'requirements-contract-compiler',
    },
  }));
  const outOfScope = input.outOfScope?.length
    ? input.outOfScope.map((row, index) => ({
        ...row,
        authorityState: row.authorityState ?? 'source_boundary',
        provenance: row.provenance ?? {
          sourcePath: null,
          sourceSpan: null,
          compiler: 'requirements-contract-compiler',
          boundaryOrdinal: index + 1,
        },
      }))
    : [
        {
          id: 'OUT-001',
          text: 'No additional scope is authorized by this source.',
          authorityState: 'compiler_default_boundary',
          provenance: {
            compiler: 'requirements-contract-compiler',
            reason: 'no_source_out_of_scope_rows',
          },
        },
      ];
  const notDone = [
    {
      id: 'NEG-001',
      text: 'Requirement contract confirmability must not be treated as implementation completion.',
    },
  ];
  const commandTexts = input.requiredCommands?.length
    ? input.requiredCommands
    : ['source-authorized validation command required'];
  const requiredCommands = commandTexts.map((command, index) => ({
    id: `CMD-${ordinal(index)}`,
    command,
    covers: must.map((row) => row.id),
  }));

  return {
    schemaVersion: 'requirement-contract-model/v1',
    recordId: input.recordId,
    requirementSetId: input.requirementSetId,
    must,
    notDone,
    outOfScope,
    evidence: [],
    acceptanceCriteria: [],
    requiredCommands,
    traceRows: [],
    businessViews: [],
    sequenceViews: [],
    flowViews: [],
    edgeCaseViews: [],
    boundaryViews: [],
    targetModificationPaths: [],
    applicability: {},
    invariantClosure: {
      appliedPasses: [],
      remainingIssueCount: 0,
      rendererBlockerPolicy: 'renderer_blocker_release_failure',
      issues: [],
    },
  };
}

export function writeRequirementContractModelArtifacts(input: {
  authoringDir: string;
  model: RequirementContractModel;
}): { modelPath: string; reportPath: string } {
  fs.mkdirSync(input.authoringDir, { recursive: true });
  const modelPath = path.join(input.authoringDir, 'requirement-contract-model.json');
  const reportPath = path.join(input.authoringDir, 'compiler-closure-report.json');
  fs.writeFileSync(modelPath, `${JSON.stringify(input.model, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    reportPath,
    `${JSON.stringify(
      {
        schemaVersion: 'requirement-contract-compiler-closure-report/v1',
        recordId: input.model.recordId,
        requirementSetId: input.model.requirementSetId,
        appliedPasses: input.model.invariantClosure.appliedPasses,
        remainingIssueCount: input.model.invariantClosure.remainingIssueCount,
        rendererBlockerPolicy: input.model.invariantClosure.rendererBlockerPolicy,
        renderer_blocker_release_failure: true,
        measureBefore: input.model.invariantClosure.measureBefore,
        measureAfter: input.model.invariantClosure.measureAfter,
        passRegistry: input.model.invariantClosure.passRegistry,
        roundReceipts: input.model.invariantClosure.roundReceipts,
        issues: input.model.invariantClosure.issues,
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  return { modelPath, reportPath };
}
