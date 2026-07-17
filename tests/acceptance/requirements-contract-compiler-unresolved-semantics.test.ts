import { describe, expect, it } from 'vitest';
import { compileRequirementContractModel } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-compiler';

function requirementId(ordinal: number): string {
  return `MUST-FR-${String(ordinal).padStart(3, '0')}`;
}

describe('requirements contract compiler unresolved semantics', () => {
  it('keeps absent negative, boundary, command, and target authority unresolved', () => {
    const sourceRequirementId = requirementId(1);
    const model = compileRequirementContractModel({
      recordId: 'REQ-UNRESOLVED',
      requirementSetId: 'REQ-UNRESOLVED-SET',
      must: [
        {
          id: sourceRequirementId,
          text: 'The compiler MUST preserve only source-authorized semantics.',
          sourceRequirementId: 'FR-001',
          sourcePath: 'docs/requirements/compiler.md',
          sourceSpan: { startLine: 7, endLine: 7 },
        },
      ],
    });

    expect(model.notDone).toEqual([]);
    expect(model.outOfScope).toEqual([]);
    expect(model.requiredCommands).toEqual([]);
    expect(model.targetModificationPaths).toEqual([]);
    expect(model.invariantClosure.remainingIssueCount).toBe(4);
    expect(model.invariantClosure.issues.map((issue) => issue.code)).toEqual([
      'missing_negative_requirement_authority',
      'missing_out_of_scope_authority',
      'missing_validation_authority',
      'missing_target_authority',
    ]);
  });

  it('preserves explicitly scoped source semantics without all-to-all bindings', () => {
    const requirements = [
      {
        id: requirementId(1),
        text: 'The compiler MUST update the parser.',
        sourceRequirementId: 'FR-001',
        sourcePath: 'docs/requirements/compiler.md',
        sourceSpan: { startLine: 7, endLine: 7 },
      },
      {
        id: requirementId(2),
        text: 'The compiler MUST update the renderer.',
        sourceRequirementId: 'FR-002',
        sourcePath: 'docs/requirements/compiler.md',
        sourceSpan: { startLine: 8, endLine: 8 },
      },
    ];
    const commands = requirements.map((requirement, index) => ({
      id: `VALIDATION-${String(index + 1).padStart(3, '0')}`,
      command: `npx vitest run tests/requirement-${index + 1}.test.ts`,
      requirementRefs: [requirement.id],
    }));
    const targets = requirements.map((requirement, index) => ({
      id: `TARGET-${String(index + 1).padStart(3, '0')}`,
      path: `src/requirement-${index + 1}.ts`,
      requirementRefs: [requirement.id],
    }));
    const model = compileRequirementContractModel({
      recordId: 'REQ-SCOPED',
      requirementSetId: 'REQ-SCOPED-SET',
      must: requirements,
      notDone: [
        {
          id: 'NEG-001',
          text: 'The compiler MUST NOT bind one command to unrelated requirements.',
          sourceRequirementId: 'NEG-001',
          sourcePath: 'docs/requirements/compiler.md',
          sourceSpan: { startLine: 12, endLine: 12 },
        },
      ],
      outOfScope: [
        {
          id: 'OUT-001',
          text: 'Replacing the package manager is out of scope.',
          authorityState: 'source_boundary',
          provenance: {
            sourcePath: 'docs/requirements/compiler.md',
            sourceSpan: { startLine: 16, endLine: 16 },
          },
        },
      ],
      requiredCommands: commands,
      targetPaths: targets,
    });

    expect(model.requiredCommands).toEqual(
      commands.map(({ id, command, requirementRefs }) => ({
        id,
        command,
        covers: requirementRefs,
      }))
    );
    expect(model.targetModificationPaths).toEqual(targets);
    expect(model.invariantClosure).toMatchObject({
      remainingIssueCount: 0,
      issues: [],
    });
  });

  it('blocks ambiguous legacy command and target inputs for multi-requirement models', () => {
    const requirements = [requirementId(1), requirementId(2)].map((id, index) => ({
      id,
      text: `Requirement ${index + 1} MUST preserve source spans.`,
      sourceRequirementId: `FR-${String(index + 1).padStart(3, '0')}`,
      sourcePath: 'docs/requirements/shared.md',
      sourceSpan: { startLine: index + 7, endLine: index + 7 },
    }));
    const negativeRequirement = {
      id: `NEGATIVE-${requirements.length}`,
      text: 'The compiler MUST NOT invent bindings.',
      sourceRequirementId: `NEGATIVE-SOURCE-${requirements.length}`,
      sourcePath: requirements[0].sourcePath,
      sourceSpan: {
        startLine: requirements.at(-1)!.sourceSpan.endLine + 1,
        endLine: requirements.at(-1)!.sourceSpan.endLine + 1,
      },
    };
    const outOfScopeBoundary = {
      id: `BOUNDARY-${requirements.length}`,
      text: 'Unrelated files are out of scope.',
      authorityState: 'source_boundary' as const,
      provenance: {
        sourcePath: requirements[0].sourcePath,
        sourceSpan: {
          startLine: negativeRequirement.sourceSpan.endLine + 1,
          endLine: negativeRequirement.sourceSpan.endLine + 1,
        },
      },
    };
    const model = compileRequirementContractModel({
      recordId: 'REQ-AMBIGUOUS',
      requirementSetId: 'REQ-AMBIGUOUS-SET',
      must: requirements,
      notDone: [negativeRequirement],
      outOfScope: [outOfScopeBoundary],
      requiredCommands: ['npx vitest run tests/shared.test.ts'],
      targetPaths: ['src/shared.ts'],
    });

    expect(model.requiredCommands).toEqual([]);
    expect(model.targetModificationPaths).toEqual([]);
    expect(model.invariantClosure.issues.map((issue) => issue.code)).toEqual([
      'ambiguous_validation_authority',
      'ambiguous_target_authority',
    ]);
  });

  it('fails closed instead of throwing for malformed structured bindings', () => {
    const sourceRequirement = {
      id: requirementId(1),
      text: 'The compiler MUST reject malformed structured bindings.',
      sourceRequirementId: 'SOURCE-MALFORMED-BINDING',
      sourcePath: 'docs/requirements/malformed-binding.md',
      sourceSpan: { startLine: 7, endLine: 7 },
    };
    const negativeRequirement = {
      id: 'NEGATIVE-MALFORMED-BINDING',
      text: 'Malformed bindings MUST NOT reach downstream consumers.',
      sourceRequirementId: 'SOURCE-NEGATIVE-MALFORMED-BINDING',
      sourcePath: sourceRequirement.sourcePath,
      sourceSpan: { startLine: 8, endLine: 8 },
    };
    const sourceBoundary = {
      id: 'BOUNDARY-MALFORMED-BINDING',
      text: 'Recovering missing binding values is out of scope.',
      authorityState: 'source_boundary' as const,
      provenance: {
        sourceRequirementId: 'SOURCE-BOUNDARY-MALFORMED-BINDING',
        sourcePath: sourceRequirement.sourcePath,
        sourceSpan: { startLine: 9, endLine: 9 },
      },
    };
    const compileMalformed = () =>
      compileRequirementContractModel({
        recordId: 'MODEL-MALFORMED-BINDING',
        requirementSetId: 'MODEL-MALFORMED-BINDING-SET',
        must: [sourceRequirement],
        notDone: [negativeRequirement],
        outOfScope: [sourceBoundary],
        requiredCommands: [
          {
            id: 'VALIDATION-MALFORMED-BINDING',
            requirementRefs: [sourceRequirement.id],
          } as never,
        ],
        targetPaths: [
          {
            id: 'MODIFICATION-MALFORMED-BINDING',
            requirementRefs: [sourceRequirement.id],
          } as never,
        ],
      });

    expect(compileMalformed).not.toThrow();
    const model = compileMalformed();
    expect(model.requiredCommands).toEqual([]);
    expect(model.targetModificationPaths).toEqual([]);
    expect(model.invariantClosure.issues.map((issue) => issue.code)).toEqual([
      'invalid_validation_authority',
      'invalid_target_authority',
    ]);
  });
});
