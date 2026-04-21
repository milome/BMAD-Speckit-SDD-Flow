import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020';
import {
  REVIEW_CLOSEOUT_ENVELOPE_V1_SCHEMA,
  REVIEW_GOVERNANCE_CLOSURE_V1_SCHEMA,
  REVIEW_HANDOFF_V1_SCHEMA,
  REVIEW_HOST_CLOSEOUT_V1_SCHEMA,
  REVIEW_INPUT_V1_SCHEMA,
  REVIEW_OUTPUT_V1_SCHEMA,
  buildReviewCloseoutEnvelopeV1,
  buildReviewGovernanceClosureV1,
  buildRunAuditorHostInput,
  deriveReviewCloseoutEnvelopeV1,
} from '../../scripts/reviewer-schema';

describe('reviewer schema contract', () => {
  it('validates minimal review input/output/handoff/closeout fixtures', () => {
    const ajv = new Ajv2020({ allErrors: true, strict: false });

    const validateInput = ajv.compile(REVIEW_INPUT_V1_SCHEMA);
    const validateOutput = ajv.compile(REVIEW_OUTPUT_V1_SCHEMA);
    const validateCloseout = ajv.compile(REVIEW_HOST_CLOSEOUT_V1_SCHEMA);
    const validateHandoff = ajv.compile(REVIEW_HANDOFF_V1_SCHEMA);
    const validateGovernanceClosure = ajv.compile(REVIEW_GOVERNANCE_CLOSURE_V1_SCHEMA);
    const validateCloseoutEnvelope = ajv.compile(REVIEW_CLOSEOUT_ENVELOPE_V1_SCHEMA);

    const governanceClosure = buildReviewGovernanceClosureV1();
    const closeoutEnvelope = buildReviewCloseoutEnvelopeV1({
      resultCode: 'approved',
      requiredFixes: [],
      requiredFixesDetail: [],
      rerunDecision: 'none',
      scoringFailureMode: 'succeeded',
      packetExecutionClosureStatus: 'gate_passed',
    });

    const reviewInput = {
      contractVersion: 'review_input_v1',
      identity: 'bmad_code_reviewer',
      profile: 'implement_audit',
      stage: 'implement',
      artifactDocPath: 'specs/epic-1/story-1/tasks.md',
      reportPath: 'specs/epic-1/story-1/tasks.audit.md',
      iterationCount: 1,
      strictness: 'strict',
      projectRoot: 'D:/repo',
    };

    const reviewOutput = {
      contractVersion: 'review_output_v1',
      identity: 'bmad_code_reviewer',
      profile: 'implement_audit',
      stage: 'implement',
      result: 'PASS',
      resultCode: 'approved',
      artifactDocPath: reviewInput.artifactDocPath,
      reportPath: reviewInput.reportPath,
      requiredFixes: [],
      requiredFixesDetail: [],
      governanceClosure,
      closeoutEnvelope,
    };

    const closeout = {
      contractVersion: 'review_host_closeout_v1',
      runner: 'runAuditorHost',
      projectRoot: 'D:/repo',
      profile: 'implement_audit',
      stage: 'implement',
      artifactPath: reviewInput.artifactDocPath,
      reportPath: reviewInput.reportPath,
      iterationCount: 1,
      governanceClosure,
      closeoutEnvelope,
    };

    const handoff = {
      contractVersion: 'review_handoff_v1',
      identity: 'bmad_code_reviewer',
      profile: 'implement_audit',
      output: reviewOutput,
      closeout,
    };

    expect(
      validateGovernanceClosure(governanceClosure),
      JSON.stringify(validateGovernanceClosure.errors)
    ).toBe(true);
    expect(
      validateCloseoutEnvelope(closeoutEnvelope),
      JSON.stringify(validateCloseoutEnvelope.errors)
    ).toBe(true);
    expect(validateInput(reviewInput), JSON.stringify(validateInput.errors)).toBe(true);
    expect(validateOutput(reviewOutput), JSON.stringify(validateOutput.errors)).toBe(true);
    expect(validateCloseout(closeout), JSON.stringify(validateCloseout.errors)).toBe(true);
    expect(validateHandoff(handoff), JSON.stringify(validateHandoff.errors)).toBe(true);
  });

  it('normalizes review_host_closeout_v1 into runAuditorHost input without dropping required fields', () => {
    expect(
      buildRunAuditorHostInput({
        contractVersion: 'review_host_closeout_v1',
        runner: 'runAuditorHost',
        projectRoot: 'D:/repo',
        profile: 'tasks_doc_audit',
        stage: 'standalone_tasks',
        artifactPath: 'D:/repo/_bmad-output/implementation-artifacts/_orphan/TASKS_demo.md',
        reportPath: 'D:/repo/_bmad-output/implementation-artifacts/_orphan/TASKS_demo.audit.md',
        iterationCount: 2,
      })
    ).toStrictEqual({
      projectRoot: 'D:/repo',
      stage: 'standalone_tasks',
      artifactPath: 'D:/repo/_bmad-output/implementation-artifacts/_orphan/TASKS_demo.md',
      reportPath: 'D:/repo/_bmad-output/implementation-artifacts/_orphan/TASKS_demo.audit.md',
      iterationCount: 2,
    });
  });

  it('derives a blocked closeout envelope when critical readiness drift exists', () => {
    const envelope = deriveReviewCloseoutEnvelopeV1({
      auditStatus: 'PASS',
      scoringFailureMode: 'succeeded',
      scoreRecord: {
        effective_verdict: 'blocked',
        blocking_reason: 'Critical readiness drift detected against the current implementation baseline.',
        re_readiness_required: true,
        drift_severity: 'critical',
      },
    });

    expect(envelope).toMatchObject({
      resultCode: 'blocked',
      rerunDecision: 'rerun_required',
      scoringFailureMode: 'succeeded',
      packetExecutionClosureStatus: 'retry_pending',
      requiredFixes: [
        'Critical readiness drift detected against the current implementation baseline.',
      ],
    });
  });

  it('derives awaiting_rerun_gate when implementation is blocked pending re-readiness baseline', () => {
    const envelope = deriveReviewCloseoutEnvelopeV1({
      auditStatus: 'PASS',
      scoringFailureMode: 'succeeded',
      scoreRecord: {
        effective_verdict: 'blocked_pending_rereadiness',
        blocking_reason: 'Missing implementation readiness baseline for implementation verdict.',
        re_readiness_required: true,
        drift_severity: 'major',
      },
    });

    expect(envelope).toMatchObject({
      resultCode: 'blocked',
      rerunDecision: 'rerun_required',
      packetExecutionClosureStatus: 'awaiting_rerun_gate',
      requiredFixes: ['Missing implementation readiness baseline for implementation verdict.'],
    });
  });
});
