import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  REVIEWER_SHARED_CORE_BASE_PROMPT_PATH,
  REVIEWER_SHARED_CORE_METADATA_PATH,
  REVIEWER_SHARED_CORE_PROFILE_PACK_PATH,
} from '../../scripts/reviewer-contract';
import {
  REVIEWER_SHARED_CORE_METADATA,
  REVIEWER_SHARED_CORE_PROFILE_PACK,
  REVIEWER_SHARED_CORE_VERSION,
  reviewerSharedCoreBasePromptPath,
} from '../../scripts/reviewer-shared-core';

describe('reviewer shared core contract', () => {
  it('loads reviewer shared core metadata and profile pack from host-neutral files', () => {
    expect(REVIEWER_SHARED_CORE_VERSION).toBe('reviewer_shared_core_v1');
    expect(REVIEWER_SHARED_CORE_METADATA.identity).toBe('bmad_code_reviewer');
    expect(REVIEWER_SHARED_CORE_METADATA.hostAdapterProjectionOnly).toBe(true);
    expect(REVIEWER_SHARED_CORE_METADATA.basePromptPath).toBe(REVIEWER_SHARED_CORE_BASE_PROMPT_PATH);
    expect(REVIEWER_SHARED_CORE_METADATA.profilePackPath).toBe(
      REVIEWER_SHARED_CORE_PROFILE_PACK_PATH
    );
    expect(REVIEWER_SHARED_CORE_PROFILE_PACK.map((entry) => entry.profile)).toStrictEqual([
      'story_audit',
      'spec_audit',
      'plan_audit',
      'tasks_audit',
      'implement_audit',
      'bugfix_doc_audit',
      'tasks_doc_audit',
    ]);
  });

  it('keeps shared core files present and readable from the repository root', () => {
    expect(existsSync(path.join(process.cwd(), REVIEWER_SHARED_CORE_METADATA_PATH))).toBe(true);
    expect(existsSync(path.join(process.cwd(), REVIEWER_SHARED_CORE_PROFILE_PACK_PATH))).toBe(true);
    expect(existsSync(reviewerSharedCoreBasePromptPath())).toBe(true);
    expect(readFileSync(reviewerSharedCoreBasePromptPath(), 'utf8')).toContain(
      'host-neutral semantic source'
    );
  });
});
