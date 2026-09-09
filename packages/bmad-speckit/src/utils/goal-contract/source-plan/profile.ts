const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const modulePath = (relativePath: string): string =>
  `${relativePath}${__filename.endsWith('.ts') ? '.ts' : ''}`;
const { hashReceiptPayload } = require(modulePath('../control-plane/canonical-hash'));
const { validateGoalContractSchema } = require(modulePath('../control-plane/schema-registry'));

interface StandaloneSourcePlanProfile extends Record<string, unknown> {
  schemaVersion: 'StandaloneSourcePlanProfile/v1';
  profileHash: string;
  templateHash: string;
  sourcePlanVersion: 'standalone-source-plan/v1';
  metadataRequired: string[];
  nodeKinds: string[];
  requirementOwnerKinds: string[];
  ownedNodeKinds: string[];
  identity: Record<string, unknown>;
  parser: Record<string, unknown>;
  commonNodeRequiredFields: string[];
  requiredFieldsByKind: Record<string, string[]>;
  referenceFields: Record<string, string[]>;
  ownerRules: Record<string, string[]>;
  globalBinding: Record<string, unknown>;
  purpose: Record<string, unknown>;
  normalization: Record<string, unknown>;
}

interface StandaloneSourcePlanProfileBinding {
  profile: StandaloneSourcePlanProfile;
  profilePath: string;
  templatePath: string;
}

function failure(failureClass: string, details: Record<string, unknown> = {}): Error {
  return Object.assign(new Error(failureClass), { failureClass, ...details });
}

function sha256(bytes: Buffer): string {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function candidateRoots(): string[] {
  const packageRoot = path.resolve(__dirname, '..', '..', '..', '..');
  const roots = [
    path.resolve(packageRoot, '..', '..'),
    packageRoot,
    process.cwd(),
    path.resolve(process.cwd(), '..', '..'),
  ];
  return [...new Set(roots)];
}

function resolveStandaloneSourcePlanAsset(name: string): string {
  if (path.basename(name) !== name) throw failure('source_plan_profile_invalid', { name });
  const searchedPaths: string[] = [];
  for (const root of candidateRoots()) {
    const candidate = path.join(root, '_bmad', 'shared', 'goal-contract', name);
    searchedPaths.push(candidate.replace(/\\/gu, '/'));
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  throw failure('source_plan_profile_missing', { name, searchedPaths });
}

export function loadStandaloneSourcePlanProfile(): StandaloneSourcePlanProfileBinding {
  const profilePath = resolveStandaloneSourcePlanAsset('standalone-source-plan-profile.json');
  const templatePath = resolveStandaloneSourcePlanAsset('standalone-source-plan-template.md');
  const profile = JSON.parse(
    fs.readFileSync(profilePath, 'utf8')
  ) as StandaloneSourcePlanProfile;
  validateGoalContractSchema('standalone-source-plan-profile.schema.json', profile);
  const computedProfileHash = hashReceiptPayload(profile, { selfHashField: 'profileHash' });
  if (computedProfileHash !== profile.profileHash) {
    throw failure('source_plan_profile_hash_mismatch', {
      expected: profile.profileHash,
      actual: computedProfileHash,
    });
  }
  const computedTemplateHash = sha256(fs.readFileSync(templatePath));
  if (computedTemplateHash !== profile.templateHash) {
    throw failure('source_plan_template_hash_mismatch', {
      expected: profile.templateHash,
      actual: computedTemplateHash,
    });
  }
  return { profile, profilePath, templatePath };
}

module.exports = {
  loadStandaloneSourcePlanProfile,
  resolveStandaloneSourcePlanAsset,
};
