import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

type JsonRecord = Record<string, unknown>;

export type RequirementsContractJudgeRole =
  | 'requirements_critical_auditor'
  | 'final_acceptance_judge';

interface PromptDefinition {
  judgeRole: RequirementsContractJudgeRole;
  actorClass: string;
  promptPath: string;
  schemaName: string;
  templateId: string;
  templateVersion: string;
}

interface LoaderInput {
  packageRoot?: unknown;
  judgeRole: RequirementsContractJudgeRole;
  expectedPromptHash?: unknown;
  expectedSchemaHash?: unknown;
}

interface PromptFrontMatter {
  schemaVersion: string;
  templateId: string;
  templateVersion: string;
  judgeRole: RequirementsContractJudgeRole;
  actorClass: string;
  promptTemplateHash: string;
}

const PROMPT_DEFINITIONS: PromptDefinition[] = [
  {
    judgeRole: 'requirements_critical_auditor',
    actorClass: 'requirements_critical_auditor_judge',
    promptPath:
      '_bmad/shared/requirements-contract/judge-prompts/requirements-contract-critical-auditor.prompt.md',
    schemaName: 'requirements-contract-critical-auditor-judge-request.schema.json',
    templateId: 'requirements-contract-critical-auditor-judge.prompt',
    templateVersion: '1.0.0',
  },
  {
    judgeRole: 'final_acceptance_judge',
    actorClass: 'final_acceptance_judge',
    promptPath:
      '_bmad/shared/requirements-contract/judge-prompts/audit-review-final-acceptance-judge.prompt.md',
    schemaName: 'requirements-contract-final-acceptance-judge-request.schema.json',
    templateId: 'audit-review-final-acceptance-judge.prompt',
    templateVersion: '1.0.0',
  },
];

const CALLER_PATH_OVERRIDE_KEYS = [
  'promptPath',
  'schemaPath',
  'promptRoot',
  'schemaRoot',
  'assetPath',
  'assetsRoot',
] as const;

function sha256(value: string | Buffer): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function slash(value: string): string {
  return value.replace(/\\/gu, '/');
}

function isWithin(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function findPackageRoot(startDir: string): string | null {
  let current = path.resolve(startDir);
  let reachedFilesystemRoot = false;
  while (!reachedFilesystemRoot) {
    const packageJsonPath = path.join(current, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
        name?: string;
      };
      if (packageJson.name === 'bmad-speckit') return current;
    }
    const parent = path.dirname(current);
    reachedFilesystemRoot = parent === current;
    current = parent;
  }
  return null;
}

function resolvePackageRoot(value: unknown): string {
  const start = typeof value === 'string' && value.length > 0 ? value : __dirname;
  const root = findPackageRoot(start);
  if (!root) throw new Error('judge_prompt_loader_package_root_invalid');
  const bmadRoot = path.join(root, '_bmad');
  if (!fs.existsSync(bmadRoot) || !fs.statSync(bmadRoot).isDirectory()) {
    throw new Error('judge_prompt_loader_package_root_invalid');
  }
  return root;
}

function resolvePackageFile(packageRoot: string, relativePath: string, code: string): string {
  const resolved = path.resolve(packageRoot, relativePath);
  if (!isWithin(packageRoot, resolved)) throw new Error(code);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) throw new Error(code);
  const realRoot = fs.realpathSync(packageRoot);
  const realPath = fs.realpathSync(resolved);
  if (!isWithin(realRoot, realPath)) throw new Error(code);
  return resolved;
}

function resolveSchemaFile(packageRoot: string, schemaName: string): string {
  const candidates = [
    path.join('dist', 'main-agent', 'source-authority', 'schemas', schemaName),
    path.join('src', 'main-agent', 'source-authority', 'schemas', schemaName),
  ];
  for (const candidate of candidates) {
    try {
      return resolvePackageFile(packageRoot, candidate, 'judge_prompt_loader_schema_missing');
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'judge_prompt_loader_schema_missing') {
        throw error;
      }
    }
  }
  throw new Error('judge_prompt_loader_schema_missing');
}

function parseFrontMatter(content: string): {
  frontMatter: PromptFrontMatter;
  body: string;
} {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/u.exec(content);
  if (!match) throw new Error('judge_prompt_loader_front_matter_missing');
  const parsed = Object.fromEntries(
    match[1]
      .split(/\r?\n/u)
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        const separator = line.indexOf(':');
        if (separator <= 0) throw new Error('judge_prompt_loader_front_matter_invalid');
        return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
      })
  ) as JsonRecord;
  return {
    frontMatter: {
      schemaVersion: String(parsed.schemaVersion ?? ''),
      templateId: String(parsed.templateId ?? ''),
      templateVersion: String(parsed.templateVersion ?? ''),
      judgeRole: parsed.judgeRole as RequirementsContractJudgeRole,
      actorClass: String(parsed.actorClass ?? ''),
      promptTemplateHash: String(parsed.promptTemplateHash ?? ''),
    },
    body: content.slice(match[0].length),
  };
}

function rejectCallerPathOverrides(input: JsonRecord): void {
  for (const key of CALLER_PATH_OVERRIDE_KEYS) {
    if (Object.hasOwn(input, key) && input[key] !== undefined) {
      throw new Error('judge_prompt_loader_path_override_forbidden');
    }
  }
}

function rejectMutableInclude(content: string, promptPath: string): void {
  if (/\{\{\s*(?:include|path|file|authority|schema|prompt)/iu.test(content)) {
    throw new Error('judge_prompt_loader_mutable_include_forbidden');
  }
  if (/<!--\s*include|@include|include:/iu.test(content)) {
    throw new Error('judge_prompt_loader_mutable_include_forbidden');
  }
  for (const sidecar of [`${promptPath}.include.md`, `${promptPath}.hash`, `${promptPath}.lock`]) {
    if (fs.existsSync(sidecar)) throw new Error('judge_prompt_loader_mutable_include_forbidden');
  }
}

function expectedHash(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || !/^sha256:[a-f0-9]{64}$/u.test(value)) {
    throw new Error('judge_prompt_loader_expected_hash_invalid');
  }
  return value;
}

function definitionFor(role: RequirementsContractJudgeRole): PromptDefinition {
  const definition = PROMPT_DEFINITIONS.find((entry) => entry.judgeRole === role);
  if (!definition) throw new Error('judge_prompt_loader_role_unknown');
  return definition;
}

export function loadRequirementsContractJudgePromptAsset(input: LoaderInput) {
  rejectCallerPathOverrides(input as JsonRecord);
  const definition = definitionFor(input.judgeRole);
  const packageRoot = resolvePackageRoot(input.packageRoot);
  const promptPath = resolvePackageFile(
    packageRoot,
    definition.promptPath,
    'judge_prompt_loader_prompt_missing'
  );
  const schemaPath = resolveSchemaFile(packageRoot, definition.schemaName);
  const promptContent = fs.readFileSync(promptPath, 'utf8');
  rejectMutableInclude(promptContent, promptPath);
  const { frontMatter, body } = parseFrontMatter(promptContent);
  const promptHash = sha256(body);
  if (
    frontMatter.schemaVersion !== 'requirements-contract-judge-prompt-template/v1' ||
    frontMatter.templateId !== definition.templateId ||
    frontMatter.templateVersion !== definition.templateVersion ||
    frontMatter.actorClass !== definition.actorClass ||
    frontMatter.judgeRole !== definition.judgeRole
  ) {
    throw new Error('judge_prompt_loader_role_mismatch');
  }
  if (frontMatter.promptTemplateHash !== promptHash) {
    throw new Error('judge_prompt_loader_stale_hash');
  }
  const schemaContent = fs.readFileSync(schemaPath);
  const schemaHash = sha256(schemaContent);
  const expectedPromptHash = expectedHash(input.expectedPromptHash);
  const expectedSchemaHash = expectedHash(input.expectedSchemaHash);
  if (expectedPromptHash && expectedPromptHash !== promptHash) {
    throw new Error('judge_prompt_loader_stale_hash');
  }
  if (expectedSchemaHash && expectedSchemaHash !== schemaHash) {
    throw new Error('judge_prompt_loader_stale_hash');
  }
  return {
    schemaVersion: 'requirements-contract-judge-prompt-asset/v1',
    judgeRole: definition.judgeRole,
    actorClass: definition.actorClass,
    templateId: definition.templateId,
    templateVersion: definition.templateVersion,
    prompt: {
      path: slash(path.relative(packageRoot, promptPath)),
      hash: promptHash,
      bytes: Buffer.byteLength(promptContent, 'utf8'),
    },
    schema: {
      path: slash(path.relative(packageRoot, schemaPath)),
      hash: schemaHash,
      bytes: schemaContent.byteLength,
    },
    requestBinding: {
      judgeRole: definition.judgeRole,
      actorClass: definition.actorClass,
      promptTemplateHash: promptHash,
      assessmentSchemaHash: schemaHash,
    },
  } as const;
}

export function loadRequirementsContractJudgePromptAssets(input: { packageRoot?: unknown } = {}) {
  return PROMPT_DEFINITIONS.map((definition) =>
    loadRequirementsContractJudgePromptAsset({
      packageRoot: input.packageRoot,
      judgeRole: definition.judgeRole,
    })
  );
}
