import { describe, expect, it } from 'vitest';
import { compileRequirementContractModel } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-compiler';
import {
  artifacts,
  createTempRoot,
  issueCodes,
  readJson,
  removeTempRoot,
  runAuthoring,
  writeText,
} from './helpers/requirements-contract-authoring-fixture';

describe('requirements contract authoring authority grounding', () => {
  it('grounds compiler semantic rows with authority state and provenance', () => {
    const model = compileRequirementContractModel({
      recordId: 'REQ-AUTHORITY-GROUNDING',
      requirementSetId: 'REQ-AUTHORITY-GROUNDING-SET',
      must: [
        {
          id: 'MUST-FR-001',
          text: 'Widget summary must stay synchronized.',
          sourceRequirementId: 'FR-001',
          sourcePath: 'docs/requirements/widget.md',
          sourceSpan: { startLine: 7, endLine: 7 },
        },
      ],
      outOfScope: [{ id: 'OUT-001', text: 'Do not rewrite unrelated engines.' }],
      requiredCommands: ['pytest tests/test_widget.py'],
      targetPaths: ['src/widget.py'],
    });

    expect(model.must[0]).toMatchObject({
      authorityState: 'source_grounded',
      provenance: {
        sourceRequirementId: 'FR-001',
        sourcePath: 'docs/requirements/widget.md',
        sourceSpan: { startLine: 7, endLine: 7 },
        compiler: 'requirements-contract-compiler',
      },
    });
    expect(model.outOfScope[0]).toMatchObject({
      authorityState: 'source_boundary',
      provenance: expect.objectContaining({ compiler: 'requirements-contract-compiler' }),
    });
  });

  it('persists source authority spans, hashes, and source requirement IDs through authoring artifacts', () => {
    const root = createTempRoot('requirements-contract-authority-grounding-');
    try {
      const source = writeText(
        root,
        'docs/requirements/authority-grounding.md',
        [
          '# Authority Grounding Requirement',
          '',
          '目标文件：`src/widget.py`',
          '',
          '## Functional Requirements',
          '',
          '| FR ID | Requirement |',
          '|---|---|',
          '| FR-001 | Widget summary must stay synchronized with selected settings. |',
          '',
          '## Validation',
          '',
          'pytest tests/test_widget.py',
          '',
        ].join('\n')
      );

      const result = runAuthoring(root, source, 'REQ-AUTHORITY-GROUNDING');
      const paths = artifacts(root, 'REQ-AUTHORITY-GROUNDING', 'REQ-AUTHORITY-GROUNDING-SET');
      const candidates = readJson(paths.controlledMustCandidates);
      const target = readJson(paths.targetAuthorityReport);
      const validation = readJson(paths.validationAuthorityReport);
      const candidate = candidates.candidates.find(
        (row: Record<string, unknown>) => row.sourceRequirementId === 'FR-001'
      );

      expect(issueCodes(result)).toContain('critical_auditor_provider_mode_required');
      expect(candidate).toMatchObject({
        sourceRequirementId: 'FR-001',
        projectedMustId: 'MUST-FR-001',
        sourcePath: 'docs/requirements/authority-grounding.md',
        sourceSpan: { startLine: 9, endLine: 9 },
        sourceDocumentHash: expect.stringMatching(/^sha256:/),
      });
      expect(target.accepted[0]).toMatchObject({
        source: 'source_document',
        sourceSpan: expect.objectContaining({ startLine: expect.any(Number) }),
      });
      expect(validation.accepted[0]).toMatchObject({
        source: 'source_document',
        sourceSpan: expect.objectContaining({ startLine: 13 }),
      });
    } finally {
      removeTempRoot(root);
    }
  });
});
