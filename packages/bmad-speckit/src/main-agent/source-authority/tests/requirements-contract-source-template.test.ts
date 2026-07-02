import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { lintRequirementsContractSourceTemplate } from '../scripts/lint-requirements-contract-source-template';

const ROOT = process.cwd();
const SOURCE_AUTHORITY_ROOT = path.join(
  ROOT,
  'packages',
  'bmad-speckit',
  'src',
  'main-agent',
  'source-authority'
);
const TEMPLATE_PATH = path.join(
  SOURCE_AUTHORITY_ROOT,
  'templates',
  'requirements-contract-source-prd-template.md'
);
const SCHEMA_PATH = path.join(
  SOURCE_AUTHORITY_ROOT,
  'templates',
  'requirements-contract-source-prd-template.schema.json'
);
const LINT_SCRIPT_PATH = path.join(
  SOURCE_AUTHORITY_ROOT,
  'scripts',
  'lint-requirements-contract-source-template.ts'
);
const INTERNAL_CONTRACT_TEMPLATE_PATH = path.join(
  ROOT,
  '_bmad',
  'skills',
  'requirements-contract-authoring',
  'references',
  'contract-template.md'
);

describe('requirements contract source PRD template', () => {
  it('keeps the canonical source PRD template lint-clean', () => {
    const result = lintRequirementsContractSourceTemplate({
      template: TEMPLATE_PATH,
      schema: SCHEMA_PATH,
      json: true,
    });

    expect(result.ok, JSON.stringify(result.issues, null, 2)).toBe(true);
    expect(result.counts.requiredHeadings).toBeGreaterThanOrEqual(20);
    expect(result.counts.requiredFragments).toBeGreaterThanOrEqual(12);
    expect(result.counts.implementationConfirmationBlocks).toBe(0);
  });

  it('does not execute the CLI when imported by another bundled runtime entry', () => {
    const tsxCliPath = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
    const lintScriptUrl = pathToFileURL(LINT_SCRIPT_PATH).href;
    const output = execFileSync(
      process.execPath,
      [
        tsxCliPath,
        '-e',
        `(async()=>{ const before=process.exitCode; await import(${JSON.stringify(lintScriptUrl)}); console.log(JSON.stringify({ before: before ?? null, after: process.exitCode ?? null })); })().catch((error)=>{ console.error(error); process.exit(1); });`,
      ],
      {
        cwd: ROOT,
        encoding: 'utf8',
        maxBuffer: 5 * 1024 * 1024,
      }
    );

    expect(JSON.parse(output)).toEqual({ before: null, after: null });
  });

  it('keeps the source PRD template separate from the internal confirmation schema reference', () => {
    const sourceTemplate = fs.readFileSync(TEMPLATE_PATH, 'utf8');
    const internalContractTemplate = fs.readFileSync(INTERNAL_CONTRACT_TEMPLATE_PATH, 'utf8');

    expect(sourceTemplate).toContain(
      'does not replace `_bmad/skills/requirements-contract-authoring/references/contract-template.md`'
    );
    expect(sourceTemplate).toContain('starter template for an authoritative implementation source document');
    expect(sourceTemplate).toContain('## Source-to-Contract Projection Map');
    expect(sourceTemplate).not.toMatch(/^implementationConfirmation:\s*$/mu);
    expect(sourceTemplate).not.toContain('schemaVersion: requirements-contract-source/v1');
    expect(internalContractTemplate).toContain('implementationConfirmation');
    expect(internalContractTemplate).toContain('contractSchemaVersion: 1');
    expect(internalContractTemplate).not.toContain('# Requirements Contract Source PRD Template');
  });

  it('provides dedicated current-state and target-state source sections for HTML currentTargetMap rendering', () => {
    const sourceTemplate = fs.readFileSync(TEMPLATE_PATH, 'utf8');

    expect(sourceTemplate).toContain('## Source Current State');
    expect(sourceTemplate).toContain('## Source Target State');
    expect(sourceTemplate).toContain('currentSectionHeadings: ["Source Current State"]');
    expect(sourceTemplate).toContain('targetSectionHeadings: ["Source Target State"]');
    expect(sourceTemplate).toContain('currentSummary: []');
    expect(sourceTemplate).toContain('targetSummary: []');
    expect(sourceTemplate).toContain('diffRows: []');
    expect(sourceTemplate).toContain('requiredViewPacks:');
    expect(sourceTemplate).toContain('- currentTargetMap');
    expect(sourceTemplate).not.toContain('currentTargetMap: []');
  });

  it('maps every canonical contract field required for renderer-backed confirmation', () => {
    const sourceTemplate = fs.readFileSync(TEMPLATE_PATH, 'utf8');
    const internalContractTemplate = fs.readFileSync(INTERNAL_CONTRACT_TEMPLATE_PATH, 'utf8');
    const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8')) as {
      'x-templateRules': {
        canonicalContractFields: string[];
        sourceProjectionRequiredFields: string[];
      };
    };
    const rules = schema['x-templateRules'];

    expect(rules.canonicalContractFields).toEqual(
      expect.arrayContaining([
        'contractSchemaVersion',
        'recordId',
        'requirementSetId',
        'entryFlow',
        'contractAuthoringRequired',
        'confirmationLanguage',
        'confirmationRender',
        'preConfirmationDrilldown',
        'applicability',
        'must',
        'notDone',
        'mustNot',
        'evidence',
        'acceptanceTests',
        'e2eSuites',
        'traceRows',
        'sequenceViews',
        'flowViews',
        'edgeCaseViews',
        'boundaryViews',
        'targetModificationPaths',
        'requirementBoundary',
        'currentTargetMap',
        'artifactAutomationPlan',
        'aiTddContractExecutionManifestProjection',
      ])
    );
    for (const field of rules.canonicalContractFields) {
      expect(internalContractTemplate, `canonical contract field ${field}`).toContain(`${field}:`);
      expect(sourceTemplate, `source projection map field ${field}`).toContain(`finalField: ${field}`);
    }
    expect(rules.sourceProjectionRequiredFields).toEqual(rules.canonicalContractFields);
  });

  it('fails the semantic parity gate when the PRD template defines a final schema authority', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'source-prd-template-parity-'));
    try {
      const badTemplate = path.join(tempDir, 'requirements-contract-source-prd-template.md');
      fs.writeFileSync(
        badTemplate,
        `${fs.readFileSync(TEMPLATE_PATH, 'utf8')}\n\n\`\`\`yaml\nimplementationConfirmation:\n  schemaVersion: requirements-contract-source/v1\n\`\`\`\n`,
        'utf8'
      );

      const result = lintRequirementsContractSourceTemplate({
        template: badTemplate,
        schema: SCHEMA_PATH,
        json: true,
      });

      expect(result.ok).toBe(false);
      expect(result.issues.map((issue) => issue.code)).toEqual(
        expect.arrayContaining([
          'implementation_confirmation_block_count_invalid',
          'source_prd_final_schema_fragment_forbidden',
        ])
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('requires per-MUST oracle, assertion, and responsibility columns on renderer-facing source tables', () => {
    const sourceTemplate = fs.readFileSync(TEMPLATE_PATH, 'utf8');
    const expectedColumnsBySection: Record<string, string[]> = {
      'Functional Requirements': ['Per-MUST oracle', 'Assertion source', 'Responsibility mapping'],
      'Acceptance Evidence': ['Oracle', 'Assertion source', 'Responsibility mapping'],
      'Test And Verification Paths': ['Per-MUST oracle', 'Assertion source', 'Responsibility mapping', 'Target files'],
      'Trace Matrix Source': ['Acceptance refs', 'Per-MUST oracle', 'Per-MUST closure assertion', 'Responsibility mapping'],
      'Implementation Path Map': ['Per-MUST oracle', 'Assertion source', 'Responsibility mapping'],
      'Current Target Map': ['Per-MUST oracle', 'Assertion source', 'Responsibility mapping'],
    };

    for (const [section, columns] of Object.entries(expectedColumnsBySection)) {
      const sectionStart = sourceTemplate.indexOf(`## ${section}`);
      expect(sectionStart, `${section} heading`).toBeGreaterThanOrEqual(0);
      const sectionEnd = sourceTemplate.indexOf('\n## ', sectionStart + 1);
      const sectionBody = sourceTemplate.slice(
        sectionStart,
        sectionEnd === -1 ? sourceTemplate.length : sectionEnd
      );
      for (const column of columns) {
        expect(sectionBody, `${section} column ${column}`).toContain(column);
      }
    }
  });

  it('fails closed on weak semantic source-template regressions', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'source-prd-template-weak-semantics-'));
    try {
      const badTemplate = path.join(tempDir, 'requirements-contract-source-prd-template.md');
      fs.writeFileSync(
        badTemplate,
        [
          fs.readFileSync(TEMPLATE_PATH, 'utf8'),
          '',
          '## Weak Regression Fixture',
          '',
          '| ID | Weak pattern |',
          '| --- | --- |',
          '| MUST-FR-L1-001 | line-based MUST ID |',
          '| TRACE-ALL | one row covers all MUST |',
          '| VIEW-ALL | generic business visual |',
          '| CTM-ALL | generic currentTarget row |',
          '',
        ].join('\n'),
        'utf8'
      );

      const result = lintRequirementsContractSourceTemplate({
        template: badTemplate,
        schema: SCHEMA_PATH,
        json: true,
      });

      expect(result.ok).toBe(false);
      expect(result.issues.map((issue) => issue.code)).toEqual(
        expect.arrayContaining([
          'line_based_must_id_forbidden',
          'compressed_trace_oracle_forbidden',
          'generic_business_visual_forbidden',
          'generic_current_target_row_forbidden',
        ])
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('defines renderer-facing projection authority instead of allowing prose-derived MUST extraction', () => {
    const sourceTemplate = fs.readFileSync(TEMPLATE_PATH, 'utf8');
    const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8')) as {
      'x-templateRules': Record<string, unknown>;
      properties: Record<string, any>;
    };
    const rules = schema['x-templateRules'];

    expect(sourceTemplate).toContain('## Requirement Projection Authority');
    expect(sourceTemplate).toContain('## Renderer Field Source Schema');
    expect(sourceTemplate).toContain('## Negative Requirements And Not Done Conditions');
    expect(sourceTemplate).toContain('## Trace Matrix Source');
    expect(sourceTemplate).toContain('rendererFieldSourceSchema:');
    expect(sourceTemplate).toContain('canonicalMustList:');
    expect(sourceTemplate).toContain('applicabilityDomains:');
    expect(sourceTemplate).toContain('preConfirmationDrilldown:');
    expect(sourceTemplate).toContain('confirmationRender:');
    expect(sourceTemplate).toContain('requirementCreationAllowed: false');
    expect(sourceTemplate).toContain('mustSources:');
    expect(sourceTemplate).toContain('projectedIdPattern: "^MUST-FR-[0-9]{3}$"');
    expect(sourceTemplate).toContain('projectedIdPattern: "^MUST-NFR-[0-9]{3}$"');
    expect(sourceTemplate).toContain('deniedCanonicalMustIdPatterns:');
    expect(sourceTemplate).toContain('^MUST-.*-L[0-9]+-[0-9]+$');
    expect(sourceTemplate).toContain('projectionSupportingSections:');
    expect(sourceTemplate).toContain('Success Criteria');
    expect(sourceTemplate).toContain('Current Target Map');

    expect(rules.requiredHeadings).toContain('## Requirement Projection Authority');
    expect(rules.requiredHeadings).toContain('## Renderer Field Source Schema');
    expect(rules.requiredHeadings).toContain('## Negative Requirements And Not Done Conditions');
    expect(rules.requiredHeadings).toContain('## Trace Matrix Source');
    expect(rules.requiredFragments).toContain('projectionSupportingSections:');
    expect(rules.requiredFragments).toContain('rendererFieldSourceSchema:');
    expect(rules.requiredFragments).toContain('applicabilityDomains:');
    expect(rules.requiredFragments).toContain('preConfirmationDrilldown:');
    expect(rules.requiredFragments).toContain('confirmationRender:');
    expect(rules.requiredFragments).toContain('deniedCanonicalMustIdPatterns:');
    expect(rules.deniedCanonicalMustIdPatterns).toContain('^MUST-.*-L[0-9]+-[0-9]+$');
    expect(rules.allowedRequirementBearingSections).toEqual([
      'Functional Requirements',
      'Non-Functional Requirements',
      'Negative Requirements And Not Done Conditions',
      'Out Of Scope',
    ]);
    expect(
      ((schema.properties as any)['x-templateRules'].properties.allowedRequirementBearingSections as any)
        .minItems
    ).toBe(4);
    expect(rules.projectionSupportingSections).toEqual(
      expect.arrayContaining([
        'Success Criteria',
        'In Scope',
        'User Journeys',
        'Architecture Decision Records',
        'Failure Matrix',
        'Acceptance Evidence',
        'Test And Verification Paths',
        'Implementation Path Map',
        'Source Current State',
        'Source Target State',
        'Current Target Map',
        'Trace Matrix Source',
      ])
    );
  });

  it('publishes a schema-backed lint command for the canonical source PRD template', () => {
    const tsxCliPath = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
    const output = execFileSync(process.execPath, [tsxCliPath, LINT_SCRIPT_PATH, '--json'], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 5 * 1024 * 1024,
    });
    const report = JSON.parse(output);

    expect(report.ok).toBe(true);
    expect(report.templatePath.replace(/\\/g, '/')).toContain(
      'source-authority/templates/requirements-contract-source-prd-template.md'
    );
    expect(report.schemaPath.replace(/\\/g, '/')).toContain(
      'source-authority/templates/requirements-contract-source-prd-template.schema.json'
    );
  });

  it('ensures build-main-agent-dist copies the template schema JSON into dist', () => {
    const buildScript = fs.readFileSync(
      path.join(ROOT, 'packages', 'bmad-speckit', 'scripts', 'build-main-agent-dist.cjs'),
      'utf8'
    );

    expect(buildScript).toContain('allowedSourceAuthorityTemplateJsonAsset');
    expect(buildScript).toContain('runSourceAuthorityTemplateLint();');
    expect(buildScript).toContain('lint-requirements-contract-source-template.ts');
    expect(buildScript).toContain("relativePath.startsWith('source-authority/templates/')");
  });
});
