import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

export interface GoalContractSchemaOptions {
  packageRoot?: string;
}

export interface GoalContractSchemaBinding {
  schema: Record<string, unknown>;
  schemaPath: string;
  schemaBytes: number;
  schemaArtifactHash: string;
}

type SchemaValidator = ((value: unknown) => boolean) & {
  errors?: readonly unknown[] | null;
};

const ASSET_SEGMENTS = ['_bmad', 'shared', 'goal-contract'] as const;
const schemaBindingCache = new Map<string, GoalContractSchemaBinding>();
const schemaValidatorCache = new Map<string, SchemaValidator>();

function failure(
  failureClass: string,
  details: Record<string, unknown> = {}
): Error {
  return Object.assign(new Error(failureClass), { failureClass, ...details });
}

function normalizePath(filePath: string): string {
  return path.resolve(filePath).replace(/\\/gu, '/');
}

function artifactHash(bytes: Buffer): string {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function assertSchemaName(schemaName: string): void {
  if (
    typeof schemaName !== 'string' ||
    schemaName.length === 0 ||
    path.basename(schemaName) !== schemaName ||
    !schemaName.endsWith('.schema.json')
  ) {
    throw failure('canonical_schema_missing', {
      schemaName,
      reason: 'schema_name_invalid',
    });
  }
}

function candidatePackageRoots(explicitRoot?: string): string[] {
  if (explicitRoot) return [path.resolve(explicitRoot)];
  const startDirectories = [
    typeof __dirname === 'string' ? __dirname : '',
    process.argv[1] ? path.dirname(path.resolve(process.argv[1])) : '',
    process.cwd(),
    path.join(process.cwd(), 'packages', 'bmad-speckit'),
  ];
  const prefersWorkspaceRoot =
    typeof __dirname !== 'string' ||
    (typeof __filename === 'string' && __filename.endsWith('.ts'));
  const roots: string[] = [];
  for (const startDirectory of startDirectories.filter(Boolean)) {
    const ancestorRoots: string[] = [];
    let current = path.resolve(startDirectory);
    for (let level = 0; level < 8; level += 1) {
      ancestorRoots.push(current);
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
    if (prefersWorkspaceRoot) {
      const workspacePackageRoot = ancestorRoots.find(
        (root) =>
          path.basename(root) === 'bmad-speckit' &&
          path.basename(path.dirname(root)) === 'packages'
      );
      if (workspacePackageRoot) {
        roots.push(path.resolve(workspacePackageRoot, '..', '..'));
      }
    }
    roots.push(...ancestorRoots);
  }
  return [...new Set(roots)];
}

export function resolveGoalContractSchema(
  schemaName: string,
  options: GoalContractSchemaOptions = {}
): string {
  assertSchemaName(schemaName);
  const searchedPaths: string[] = [];
  for (const root of candidatePackageRoots(options.packageRoot)) {
    const candidate = path.resolve(root, ...ASSET_SEGMENTS, schemaName);
    searchedPaths.push(normalizePath(candidate));
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  throw failure('canonical_schema_missing', {
    schemaName,
    searchedPaths,
  });
}

function compileSchemaValidator(
  schema: Record<string, unknown>,
  cacheKey: string,
  schemaPath: string
): SchemaValidator {
  const cached = schemaValidatorCache.get(cacheKey);
  if (cached) return cached;
  try {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    const validator = ajv.compile(schema) as SchemaValidator;
    schemaValidatorCache.set(cacheKey, validator);
    return validator;
  } catch (error) {
    throw failure('canonical_schema_invalid', {
      schemaPath: normalizePath(schemaPath),
      phase: 'compile',
      validationErrors: [
        error instanceof Error ? error.message : String(error),
      ],
    });
  }
}

export function loadGoalContractSchema(
  schemaName: string,
  options: GoalContractSchemaOptions = {}
): GoalContractSchemaBinding {
  const schemaPath = resolveGoalContractSchema(schemaName, options);
  const bytes = fs.readFileSync(schemaPath);
  const schemaArtifactHash = artifactHash(bytes);
  const cacheKey = `${normalizePath(schemaPath)}|${schemaArtifactHash}`;
  const cached = schemaBindingCache.get(cacheKey);
  if (cached) return cached;

  let schema: unknown;
  try {
    schema = JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    throw failure('canonical_schema_invalid', {
      schemaPath: normalizePath(schemaPath),
      phase: 'parse',
      parseError: error instanceof Error ? error.message : String(error),
    });
  }
  if (
    schema === null ||
    typeof schema !== 'object' ||
    Array.isArray(schema) ||
    Object.getPrototypeOf(schema) !== Object.prototype
  ) {
    throw failure('canonical_schema_invalid', {
      schemaPath: normalizePath(schemaPath),
      phase: 'shape',
    });
  }

  compileSchemaValidator(
    schema as Record<string, unknown>,
    cacheKey,
    schemaPath
  );
  const binding = Object.freeze({
    schema: Object.freeze(schema as Record<string, unknown>),
    schemaPath,
    schemaBytes: bytes.length,
    schemaArtifactHash,
  });
  schemaBindingCache.set(cacheKey, binding);
  return binding;
}

export function validateGoalContractSchema<T>(
  schemaName: string,
  value: T,
  options: GoalContractSchemaOptions = {}
): T {
  const binding = loadGoalContractSchema(schemaName, options);
  const cacheKey = `${normalizePath(binding.schemaPath)}|${binding.schemaArtifactHash}`;
  const validator = compileSchemaValidator(
    binding.schema,
    cacheKey,
    binding.schemaPath
  );
  if (!validator(value)) {
    throw failure('canonical_schema_invalid', {
      schemaPath: normalizePath(binding.schemaPath),
      schemaArtifactHash: binding.schemaArtifactHash,
      phase: 'validate',
      validationErrors: validator.errors ?? [],
    });
  }
  return value;
}

export function goalContractSchemaArtifactHash(
  schemaName: string,
  options: GoalContractSchemaOptions = {}
): string {
  return loadGoalContractSchema(schemaName, options).schemaArtifactHash;
}
