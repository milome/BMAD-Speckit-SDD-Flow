import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REQUIREMENTS_CONTRACT_SOURCE_PRD_RULES } from '../rules/requirements-contract-source-prd-rules';

const ROOT = process.cwd();
const SOURCE_AUTHORITY_ROOT = path.join(
  ROOT,
  'packages',
  'bmad-speckit',
  'src',
  'main-agent',
  'source-authority'
);
const SCHEMA_PATH = path.join(
  SOURCE_AUTHORITY_ROOT,
  'templates',
  'requirements-contract-source-prd-template.schema.json'
);
const TEMPLATE_LINT_PATH = path.join(
  SOURCE_AUTHORITY_ROOT,
  'scripts',
  'lint-requirements-contract-source-template.ts'
);
const INSTANCE_LINT_PATH = path.join(
  SOURCE_AUTHORITY_ROOT,
  'scripts',
  'lint-requirements-contract-source-prd.ts'
);

describe('requirements contract source PRD rule parity', () => {
  it('keeps serialized template schema rules equal to the shared registry', () => {
    const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8')) as {
      'x-templateRules': unknown;
    };

    expect(schema['x-templateRules']).toEqual(REQUIREMENTS_CONTRACT_SOURCE_PRD_RULES);
  });

  it('forces template lint and instance lint to import the shared registry', () => {
    const templateLint = fs.readFileSync(TEMPLATE_LINT_PATH, 'utf8');
    const instanceLint = fs.readFileSync(INSTANCE_LINT_PATH, 'utf8');

    expect(templateLint).toContain("../rules/requirements-contract-source-prd-rules");
    expect(instanceLint).toContain("../rules/requirements-contract-source-prd-rules");
    expect(templateLint).not.toContain("requiredHeadings: [");
    expect(instanceLint).not.toContain("requiredHeadings: [");
    expect(templateLint).not.toContain("requiredTableColumns: {");
    expect(instanceLint).not.toContain("requiredTableColumns: {");
  });

  it('keeps template and instance renderer readiness on the same rule surface', () => {
    expect(REQUIREMENTS_CONTRACT_SOURCE_PRD_RULES.requiredHeadings).toEqual(
      expect.arrayContaining(
        REQUIREMENTS_CONTRACT_SOURCE_PRD_RULES.rendererReadinessSections.map((section) =>
          section === 'Business visual section'
            ? '## Human-Readable ID-Bound Views'
            : section === 'Target modification path list'
              ? '## Implementation Path Map'
              : section === 'Current versus target section'
                ? '## Current Target Map'
                : section === 'Trace Matrix'
                  ? '## Trace Matrix Source'
                  : section === 'Evidence and Acceptance'
                    ? '## Acceptance Evidence'
                    : section === 'Negative and Not Done'
                      ? '## Negative Requirements And Not Done Conditions'
                      : section === 'Scope Boundary'
                        ? '## Out Of Scope'
                        : '## Test And Verification Paths'
        )
      )
    );
    expect(REQUIREMENTS_CONTRACT_SOURCE_PRD_RULES.sourceProjectionRequiredFields).toEqual(
      REQUIREMENTS_CONTRACT_SOURCE_PRD_RULES.canonicalContractFields
    );
  });
});
