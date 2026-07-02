import fs from 'node:fs';
import path from 'node:path';
import {
  REQUIREMENTS_CONTRACT_SOURCE_PRD_RULES,
  type RequirementsContractSourcePrdRules,
} from '../rules/requirements-contract-source-prd-rules';

interface Args {
  template: string;
  schema: string;
  json: boolean;
}

interface LintIssue {
  code: string;
  message: string;
  target: string;
}

type TemplateRules = RequirementsContractSourcePrdRules;

interface LintResult {
  ok: boolean;
  templatePath: string;
  schemaPath: string;
  issues: LintIssue[];
  counts: {
    requiredHeadings: number;
    requiredFragments: number;
    forbiddenFragments: number;
    implementationConfirmationBlocks: number;
  };
}

const SCRIPT_DIR = __dirname;
const SOURCE_AUTHORITY_ROOT = path.resolve(SCRIPT_DIR, '..');
const DEFAULT_TEMPLATE = path.join(
  SOURCE_AUTHORITY_ROOT,
  'templates',
  'requirements-contract-source-prd-template.md'
);
const DEFAULT_SCHEMA = path.join(
  SOURCE_AUTHORITY_ROOT,
  'templates',
  'requirements-contract-source-prd-template.schema.json'
);

function isDirectSourceTemplateLintCli(entry: string | undefined): boolean {
  return /(^|[\\/])lint-requirements-contract-source-template(\.[cm]?js|\.ts)?$/iu.test(entry ?? '');
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    template: DEFAULT_TEMPLATE,
    schema: DEFAULT_SCHEMA,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--template' && argv[index + 1]) {
      args.template = path.resolve(argv[++index]);
    } else if (token === '--schema' && argv[index + 1]) {
      args.schema = path.resolve(argv[++index]);
    } else if (token === '--json') {
      args.json = true;
    }
  }
  return args;
}

function readText(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

function readJson(filePath: string): Record<string, unknown> {
  return JSON.parse(readText(filePath)) as Record<string, unknown>;
}

function loadRules(schemaPath: string, issues: LintIssue[]): TemplateRules {
  const schema = readJson(schemaPath);
  const rules = schema['x-templateRules'] as Record<string, unknown> | undefined;
  if (!rules || typeof rules !== 'object') {
    issues.push({
      code: 'template_rules_missing',
      target: schemaPath,
      message: 'Schema must contain x-templateRules.',
    });
  }
  if (JSON.stringify(rules ?? {}) !== JSON.stringify(REQUIREMENTS_CONTRACT_SOURCE_PRD_RULES)) {
    issues.push({
      code: 'schema_registry_rule_mismatch',
      target: schemaPath,
      message: 'x-templateRules must equal requirements-contract-source-prd-rules.ts.',
    });
  }
  return REQUIREMENTS_CONTRACT_SOURCE_PRD_RULES;
}

function headingExists(markdown: string, heading: string): boolean {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  return new RegExp(`^${escaped}\\s*$`, 'mu').test(markdown);
}

function countImplementationConfirmationBlocks(markdown: string): number {
  const matches = markdown.match(/^implementationConfirmation:\s*$/gmu);
  return matches ? matches.length : 0;
}

function validateRulesShape(schemaPath: string, rules: TemplateRules, issues: LintIssue[]): void {
  const requiredArrays: Array<[keyof TemplateRules, number]> = [
    ['requiredHeadings', 20],
    ['requiredFragments', 12],
    ['allowedRequirementBearingSections', 4],
    ['projectionSupportingSections', 10],
    ['nonRequirementBearingSections', 8],
    ['deniedCanonicalMustIdPatterns', 1],
    ['separationFragments', 2],
    ['canonicalContractFields', 20],
    ['sourceProjectionRequiredFields', 20],
    ['finalSchemaForbiddenFragments', 2],
    ['semanticForbiddenFragments', 4],
  ];
  for (const [key, min] of requiredArrays) {
    if (rules[key].length < min) {
      issues.push({
        code: 'template_rule_array_too_small',
        target: schemaPath,
        message: `${String(key)} must contain at least ${min} entries.`,
      });
    }
  }
  if (rules.templatePath !== 'templates/requirements-contract-source-prd-template.md') {
    issues.push({
      code: 'template_rule_path_invalid',
      target: schemaPath,
      message: 'x-templateRules.templatePath must point to the canonical source PRD template.',
    });
  }
  if (Object.keys(rules.requiredTableColumns).length < 7) {
    issues.push({
      code: 'template_rule_table_columns_too_small',
      target: schemaPath,
      message: 'x-templateRules.requiredTableColumns must cover all renderer-facing source tables.',
    });
  }
}

function sectionBody(markdown: string, heading: string): string {
  const lines = markdown.split(/\r?\n/u);
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start < 0) return '';
  const end = lines.findIndex((line, index) => index > start && /^##\s+/u.test(line));
  return lines.slice(start + 1, end < 0 ? lines.length : end).join('\n');
}

function tableHeaderColumnsForSection(markdown: string, section: string): string[] {
  const body = sectionBody(markdown, section);
  const headerLine = body
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find((line) => /^\|.+\|$/u.test(line));
  if (!headerLine) return [];
  return headerLine
    .split('|')
    .map((column) => column.trim())
    .filter(Boolean);
}

function includesCaseInsensitive(source: string, fragment: string): boolean {
  return source.toLowerCase().includes(fragment.toLowerCase());
}

function validateTemplate(templatePath: string, markdown: string, rules: TemplateRules): LintIssue[] {
  const issues: LintIssue[] = [];
  for (const heading of rules.requiredHeadings) {
    if (!headingExists(markdown, heading)) {
      issues.push({
        code: 'required_heading_missing',
        target: templatePath,
        message: `Missing heading: ${heading}`,
      });
    }
  }
  for (const fragment of rules.requiredFragments) {
    if (!markdown.includes(fragment)) {
      issues.push({
        code: 'required_fragment_missing',
        target: templatePath,
        message: `Missing required fragment: ${fragment}`,
      });
    }
  }
  for (const fragment of rules.separationFragments) {
    if (!markdown.includes(fragment)) {
      issues.push({
        code: 'separation_fragment_missing',
        target: templatePath,
        message: `Missing skill/template separation fragment: ${fragment}`,
      });
    }
  }
  for (const fragment of rules.forbiddenFragments) {
    if (markdown.includes(fragment)) {
      issues.push({
        code: 'forbidden_fragment_present',
        target: templatePath,
        message: `Forbidden fragment is present: ${fragment}`,
      });
    }
  }
  for (const fragment of rules.finalSchemaForbiddenFragments) {
    if (markdown.includes(fragment)) {
      issues.push({
        code: 'source_prd_final_schema_fragment_forbidden',
        target: templatePath,
        message: `Source PRD template must not define final confirmation schema fragment: ${fragment}`,
      });
    }
  }
  for (const fragment of rules.semanticForbiddenFragments) {
    if (includesCaseInsensitive(markdown, fragment)) {
      const code =
        fragment.toLowerCase().includes('business visual')
          ? 'generic_business_visual_forbidden'
          : fragment.toLowerCase().includes('currenttarget') || fragment.toLowerCase().includes('current target')
            ? 'generic_current_target_row_forbidden'
            : 'compressed_trace_oracle_forbidden';
      issues.push({
        code,
        target: templatePath,
        message: `Source PRD template contains forbidden weak semantic fragment: ${fragment}`,
      });
    }
  }
  for (const match of markdown.matchAll(/\bMUST-[A-Z0-9_-]*-L\d+-\d+\b/giu)) {
    issues.push({
      code: 'line_based_must_id_forbidden',
      target: templatePath,
      message: `Line-based canonical MUST ID is forbidden in the source PRD template: ${match[0]}`,
    });
  }
  for (const section of rules.allowedRequirementBearingSections) {
    if (!markdown.includes(`- \`${section}\``) || !headingExists(markdown, `## ${section}`)) {
      issues.push({
        code: 'allowlisted_section_not_declared',
        target: templatePath,
        message: `Allowlisted requirement-bearing section is not declared and headed: ${section}`,
      });
    }
  }
  for (const section of rules.projectionSupportingSections) {
    if (!markdown.includes(`- \`${section}\``) || !headingExists(markdown, `## ${section}`)) {
      issues.push({
        code: 'projection_supporting_section_not_declared',
        target: templatePath,
        message: `Projection-supporting section is not declared and headed: ${section}`,
      });
    }
  }
  for (const pattern of rules.deniedCanonicalMustIdPatterns) {
    if (!markdown.includes(pattern)) {
      issues.push({
        code: 'denied_canonical_must_pattern_missing',
        target: templatePath,
        message: `Denied canonical MUST ID pattern is not declared: ${pattern}`,
      });
    }
  }
  for (const section of rules.nonRequirementBearingSections) {
    if (!markdown.includes(`- \`${section}\``) || !headingExists(markdown, `## ${section}`)) {
      issues.push({
        code: 'non_requirement_section_not_declared',
        target: templatePath,
        message: `Non-requirement-bearing section is not declared and headed: ${section}`,
      });
    }
  }
  for (const section of rules.generatedProjectionSections) {
    if (!headingExists(markdown, `## ${section}`)) {
      issues.push({
        code: 'generated_projection_section_missing',
        target: templatePath,
        message: `Generated projection section is missing: ${section}`,
      });
    }
  }
  for (const [section, requiredColumns] of Object.entries(rules.requiredTableColumns)) {
    const columns = tableHeaderColumnsForSection(markdown, section);
    if (!columns.length) {
      issues.push({
        code: 'source_table_missing',
        target: templatePath,
        message: `Source table missing for section: ${section}`,
      });
      continue;
    }
    for (const requiredColumn of requiredColumns) {
      if (!columns.includes(requiredColumn)) {
        issues.push({
          code: 'source_table_required_column_missing',
          target: templatePath,
          message: `${section} table must include required column: ${requiredColumn}`,
        });
      }
    }
  }
  const implementationConfirmationBlocks = countImplementationConfirmationBlocks(markdown);
  if (implementationConfirmationBlocks !== 0) {
    issues.push({
      code: 'implementation_confirmation_block_count_invalid',
      target: templatePath,
      message: `Expected zero implementationConfirmation block skeletons in the source PRD template; found ${implementationConfirmationBlocks}.`,
    });
  }
  for (const field of rules.canonicalContractFields) {
    if (!markdown.includes(`finalField: ${field}`)) {
      issues.push({
        code: 'source_projection_canonical_field_missing',
        target: templatePath,
        message: `Source-to-contract projection map must include finalField: ${field}`,
      });
    }
  }
  if (JSON.stringify(rules.sourceProjectionRequiredFields) !== JSON.stringify(rules.canonicalContractFields)) {
    issues.push({
      code: 'source_projection_required_fields_mismatch',
      target: templatePath,
      message: 'sourceProjectionRequiredFields must equal canonicalContractFields.',
    });
  }
  return issues;
}

export function lintRequirementsContractSourceTemplate(input: Partial<Args> = {}): LintResult {
  const templatePath = path.resolve(input.template ?? DEFAULT_TEMPLATE);
  const schemaPath = path.resolve(input.schema ?? DEFAULT_SCHEMA);
  const issues: LintIssue[] = [];
  if (!fs.existsSync(templatePath)) {
    issues.push({
      code: 'template_missing',
      target: templatePath,
      message: 'Canonical requirements contract source PRD template is missing.',
    });
  }
  if (!fs.existsSync(schemaPath)) {
    issues.push({
      code: 'schema_missing',
      target: schemaPath,
      message: 'Canonical requirements contract source PRD template schema is missing.',
    });
  }
  if (issues.length > 0) {
    return {
      ok: false,
      templatePath,
      schemaPath,
      issues,
      counts: {
        requiredHeadings: 0,
        requiredFragments: 0,
        forbiddenFragments: 0,
        implementationConfirmationBlocks: 0,
      },
    };
  }
  const rules = loadRules(schemaPath, issues);
  validateRulesShape(schemaPath, rules, issues);
  const markdown = readText(templatePath);
  issues.push(...validateTemplate(templatePath, markdown, rules));
  return {
    ok: issues.length === 0,
    templatePath,
    schemaPath,
    issues,
    counts: {
      requiredHeadings: rules.requiredHeadings.length,
      requiredFragments: rules.requiredFragments.length,
      forbiddenFragments: rules.forbiddenFragments.length,
      implementationConfirmationBlocks: countImplementationConfirmationBlocks(markdown),
    },
  };
}

function main(): number {
  const args = parseArgs(process.argv.slice(2));
  const result = lintRequirementsContractSourceTemplate(args);
  if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else if (result.ok) {
    process.stdout.write('requirements contract source PRD template lint ok\n');
  } else {
    process.stderr.write(`${result.issues.map((issue) => issue.code).join('\n')}\n`);
  }
  return result.ok ? 0 : 1;
}

if (require.main === module && isDirectSourceTemplateLintCli(process.argv[1])) {
  process.exitCode = main();
}
