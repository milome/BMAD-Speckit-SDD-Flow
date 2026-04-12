import { describe, expect, it } from 'vitest';
import { REVIEWER_PROFILES } from '../../scripts/reviewer-contract';
import {
  REVIEWER_REGISTRY_VERSION,
  getReviewerConsumerByAuditStage,
  getReviewerRegistration,
  isReviewerAuditEntryStage,
  listReviewerRegistrations,
} from '../../scripts/reviewer-registry';

describe('reviewer registry contract', () => {
  it('registers every frozen reviewer profile with host routes and host closeout binding', () => {
    expect(REVIEWER_REGISTRY_VERSION).toBe('reviewer_registry_v1');

    const registrations = listReviewerRegistrations();
    expect(registrations.map((entry) => entry.profile)).toStrictEqual(REVIEWER_PROFILES);

    for (const registration of registrations) {
      expect(registration.identity).toBe('bmad_code_reviewer');
      expect(registration.hosts.cursor.preferredRoute.tool).toBe('cursor-task');
      expect(registration.hosts.cursor.fallbackRoute.tool).toBe('mcp_task');
      expect(registration.hosts.cursor.closeout.runner).toBe('runAuditorHost');
      expect(registration.hosts.cursor.closeout.contractVersion).toBe('review_host_closeout_v1');

      expect(registration.hosts.claude.preferredRoute.tool).toBe('Agent');
      expect(registration.hosts.claude.fallbackRoute.tool).toBe('Agent');
      expect(registration.hosts.claude.closeout.runner).toBe('runAuditorHost');
      expect(registration.hosts.claude.closeout.contractVersion).toBe('review_host_closeout_v1');
    }
  });

  it('freezes canonical route and closeout stage details for the specialized profiles', () => {
    expect(getReviewerRegistration('story_audit').hosts.cursor.preferredRoute.subtypeOrExecutor).toBe(
      'code-reviewer'
    );
    expect(getReviewerRegistration('story_audit').hosts.cursor.fallbackRoute.subtypeOrExecutor).toBe(
      'generalPurpose'
    );
    expect(getReviewerRegistration('implement_audit').hosts.claude.preferredRoute.subtypeOrExecutor).toBe(
      'code-reviewer'
    );
    expect(getReviewerRegistration('implement_audit').hosts.claude.fallbackRoute.subtypeOrExecutor).toBe(
      'general-purpose'
    );
    expect(getReviewerRegistration('implement_audit').hosts.cursor.closeout.stage).toBe(
      'implement'
    );
    expect(getReviewerRegistration('bugfix_doc_audit').hosts.cursor.closeout.stage).toBe(
      'bugfix'
    );
    expect(getReviewerRegistration('tasks_doc_audit').hosts.cursor.closeout.stage).toBe(
      'standalone_tasks'
    );
  });

  it('publishes registry-backed real consumer mappings for audit entry stages', () => {
    expect(isReviewerAuditEntryStage('document')).toBe(true);
    expect(isReviewerAuditEntryStage('standalone_tasks')).toBe(true);
    expect(isReviewerAuditEntryStage('unknown-stage')).toBe(false);

    expect(getReviewerConsumerByAuditStage('story')).toMatchObject({
      entryStage: 'story',
      profile: 'story_audit',
      closeoutStage: 'story',
      auditorScript: 'auditor-document',
      scoreStage: 'story',
      triggerStage: 'bmad_story_stage2',
    });

    expect(getReviewerConsumerByAuditStage('document')).toMatchObject({
      entryStage: 'document',
      profile: 'tasks_doc_audit',
      closeoutStage: 'standalone_tasks',
      auditorScript: 'auditor-tasks-doc',
      scoreStage: 'tasks',
      triggerStage: 'speckit_4_2',
    });
  });
});
