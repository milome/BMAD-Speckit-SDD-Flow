const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Ajv2020 = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

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
  const levelsToPackageRoot = __filename.endsWith('.ts') ? 6 : 4;
  let packageRoot = path.resolve(__dirname);
  for (let level = 0; level < levelsToPackageRoot; level += 1) {
    packageRoot = path.dirname(packageRoot);
  }
  return [packageRoot, path.resolve(packageRoot, '..', '..')];
}

function resolveGoalContractSchema(
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

function loadGoalContractSchema(
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

function validateGoalContractSchema<T>(
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

function goalContractSchemaArtifactHash(
  schemaName: string,
  options: GoalContractSchemaOptions = {}
): string {
  return loadGoalContractSchema(schemaName, options).schemaArtifactHash;
}

module.exports = {
  goalContractSchemaArtifactHash,
  loadGoalContractSchema,
  resolveGoalContractSchema,
  validateGoalContractSchema,
};
