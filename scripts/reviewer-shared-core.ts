import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  REVIEWER_PRODUCT_IDENTITY,
  REVIEWER_PROFILES,
  REVIEWER_SHARED_CORE_BASE_PROMPT_PATH,
  REVIEWER_SHARED_CORE_METADATA_PATH,
  REVIEWER_SHARED_CORE_PROFILE_PACK_PATH,
  REVIEWER_SHARED_CORE_ROOT,
  type ReviewerProfileId,
} from './reviewer-contract';

export const REVIEWER_SHARED_CORE_VERSION = 'reviewer_shared_core_v1' as const;

export interface ReviewerSharedCoreMetadata {
  version: typeof REVIEWER_SHARED_CORE_VERSION;
  identity: typeof REVIEWER_PRODUCT_IDENTITY;
  hostAdapterProjectionOnly: true;
  rootPath: typeof REVIEWER_SHARED_CORE_ROOT;
  basePromptPath: typeof REVIEWER_SHARED_CORE_BASE_PROMPT_PATH;
  profilePackPath: typeof REVIEWER_SHARED_CORE_PROFILE_PACK_PATH;
}

export interface ReviewerSharedProfileDefinition {
  profile: ReviewerProfileId;
  definitionSources: string[];
  summary: string;
  hostAdapterProjectionOnly: true;
}

function repoRoot(): string {
  const candidates = [
    process.cwd(),
    path.resolve(__dirname, '..'),
    path.resolve(__dirname, '..', '..'),
    path.resolve(__dirname, '..', '..', '..'),
    path.resolve(__dirname, '..', '..', '..', '..'),
  ];
  const uniqueCandidates = [...new Set(candidates.map((candidate) => path.resolve(candidate)))];
  for (const candidate of uniqueCandidates) {
    const marker = path.resolve(candidate, REVIEWER_SHARED_CORE_METADATA_PATH);
    if (fs.existsSync(marker)) {
      return candidate;
    }
  }
  return path.resolve(process.cwd());
}

function resolveRepoRelative(relativePath: string): string {
  return path.resolve(repoRoot(), relativePath);
}

function readJsonFile<T>(relativePath: string): T {
  const absolutePath = resolveRepoRelative(relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Reviewer shared core file missing: ${relativePath}`);
  }
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as T;
}

export function readReviewerSharedCoreMetadata(): ReviewerSharedCoreMetadata {
  return readJsonFile<ReviewerSharedCoreMetadata>(REVIEWER_SHARED_CORE_METADATA_PATH);
}

export function readReviewerSharedCoreProfilePack(): ReviewerSharedProfileDefinition[] {
  return readJsonFile<ReviewerSharedProfileDefinition[]>(REVIEWER_SHARED_CORE_PROFILE_PACK_PATH);
}

export function reviewerSharedCoreBasePromptPath(): string {
  return resolveRepoRelative(REVIEWER_SHARED_CORE_BASE_PROMPT_PATH);
}

export function assertReviewerSharedCoreMatchesContract(): void {
  const metadata = readReviewerSharedCoreMetadata();
  const profiles = readReviewerSharedCoreProfilePack();

  if (metadata.version !== REVIEWER_SHARED_CORE_VERSION) {
    throw new Error(
      `Reviewer shared core version mismatch: expected ${REVIEWER_SHARED_CORE_VERSION}, got ${metadata.version}`
    );
  }

  if (metadata.identity !== REVIEWER_PRODUCT_IDENTITY) {
    throw new Error(
      `Reviewer shared core identity mismatch: expected ${REVIEWER_PRODUCT_IDENTITY}, got ${metadata.identity}`
    );
  }

  const profileIds = profiles.map((entry) => entry.profile);
  if (JSON.stringify(profileIds) !== JSON.stringify([...REVIEWER_PROFILES])) {
    throw new Error(
      `Reviewer shared core profile pack mismatch: expected ${JSON.stringify(REVIEWER_PROFILES)}, got ${JSON.stringify(profileIds)}`
    );
  }
}

export const REVIEWER_SHARED_CORE_METADATA = readReviewerSharedCoreMetadata();
export const REVIEWER_SHARED_CORE_PROFILE_PACK = readReviewerSharedCoreProfilePack();

assertReviewerSharedCoreMatchesContract();
