import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const SKILL_DIR = path.join(ROOT, '_bmad', 'skills', 'requirements-contract-authoring');

function readSkillFile(relativePath: string): string {
  return fs.readFileSync(path.join(SKILL_DIR, relativePath), 'utf8');
}

describe('requirements-contract-authoring published contract', () => {
  it('documents governanceEventTypeRegistryPolicy as mandatory when governance events apply', () => {
    const skill = readSkillFile('SKILL.md');
    const template = readSkillFile(path.join('references', 'contract-template.md'));
    const rendererSpec = readSkillFile(path.join('references', 'html-confirmation-renderer-spec.md'));

    for (const content of [skill, template, rendererSpec]) {
      expect(content).toContain('governanceEventTypeRegistryPolicy');
      expect(content).toContain('controlFieldVocabulary');
      expect(content).toContain('payloadKindContracts');
      expect(content).toContain('controlWriteModePolicies');
      expect(content).toContain('eventSpecificRequirements');
    }

    expect(skill).toContain('When governance events apply, require `governanceEventTypeRegistryPolicy`');
    expect(template).toContain('governanceEventTypeRegistryPolicy:');
    expect(template).toContain('controlFieldVocabulary:');
    expect(rendererSpec).toContain('the current event type must list it in `writesControlFields[]`');
    expect(rendererSpec).toContain('strict mode must require both `governanceEventTypeRegistryPolicy` and `governanceEventTypeRegistry[]`');
  });

  it('documents controlledIngestWriterRegistry as the only writer permission authority', () => {
    const skill = readSkillFile('SKILL.md');
    const template = readSkillFile(path.join('references', 'contract-template.md'));
    const rendererSpec = readSkillFile(path.join('references', 'html-confirmation-renderer-spec.md'));

    for (const content of [skill, template, rendererSpec]) {
      expect(content).toContain('controlledIngestWriterRegistry');
      expect(content).toContain('allowedEventTypes');
      expect(content).toContain('payloadContractRefs');
      expect(content).toContain('beforeAfterHashRequired');
      expect(content).toContain('canModifyWriterRegistry');
    }

    expect(skill).toContain('the only machine-readable authority for which writer may write control records');
    expect(template).toContain('A writer that receives a registered event type outside its `allowedEventTypes[]` must fail closed');
    expect(rendererSpec).toContain('strict mode must require `controlledIngestWriterRegistry[]`');
  });

  it('publishes architecture confirmation prepare as the user-facing entry', () => {
    const skill = readSkillFile('SKILL.md');
    const rendererSpec = readSkillFile(path.join('references', 'html-confirmation-renderer-spec.md'));

    for (const content of [skill, rendererSpec]) {
      expect(content).toContain('prepare-architecture-confirmation-page.ts');
      expect(content).toContain('architecture_confirmation_state_checked');
      expect(content).toContain('generate requirement-scoped `architecture-confirmation-<runId>.json`');
      expect(content).toContain('Do not expose stale check or JSON producer commands as manual user steps');
    }

    expect(skill).toContain('The user-facing next step is only to open the architecture confirmation HTML and confirm the hashes in chat');
    expect(rendererSpec).toContain('The user-facing next step must only be to open the architecture confirmation HTML and confirm the hashes in chat');
  });

  it('documents the automated controlled confirmation ingest that must run immediately after chat confirmation', () => {
    const skill = readSkillFile('SKILL.md');
    const template = readSkillFile(path.join('references', 'contract-template.md'));
    const rendererSpec = readSkillFile(path.join('references', 'html-confirmation-renderer-spec.md'));

    expect(skill).toContain('Immediately after exact chat confirmation, the agent must run the high-level confirmation ingest action');
    expect(skill).toContain('bmad-speckit confirm-scope');
    expect(skill).toContain('bmad-speckit main-agent:confirm-scope');
    expect(skill).toContain('main-agent-orchestration.ts');
    expect(skill).toContain('--action confirm-scope');
    expect(skill).toContain('confirm-requirements-scope.js');
    expect(template).toContain('bmad-speckit confirm-scope');
    expect(template).toContain('automated post-confirmation step that delegates to the skill-local controlled ingest wrapper');
    expect(template).toContain('Do not require the user or agent to remember lower-level ingest commands manually');
    expect(rendererSpec).toContain('Post-confirmation control writes are handled by the high-level confirmation ingest action, not by the renderer');
    expect(rendererSpec).toContain('bmad-speckit confirm-scope');
    expect(rendererSpec).toContain('bmad-speckit main-agent:confirm-scope');
  });

  it('defaults contract generation to confirmation-ready source authoring without collapsing later gates', () => {
    const skill = readSkillFile('SKILL.md');

    expect(skill).toContain('Default to `author-confirmation-ready-source`');
    expect(skill).toContain('Do not collapse these modes into one long execution chain');
    expect(skill).toContain('"Generate requirements contract document" means author the confirmation-ready source document');
    expect(skill).toContain('The target is not a loose draft');
    expect(skill).toContain('ready to render a confirmation page with minimal or no renderer repair');
  });

  it('requires authority-first fact collection and ID matrix design before authoring prose', () => {
    const skill = readSkillFile('SKILL.md');

    expect(skill).toContain('Use authority-first, expand-on-signal fact collection');
    expect(skill).toContain('Do not run broad repository searches before authoring');
    expect(skill).toContain('Before writing the source document body, build the ID matrix');
    expect(skill).toContain('Every `MUST-*` and `NEG-*` must have evidence, trace coverage, at least one view, and at least one `ACC-*` or `E2E-*` coverage row');
    expect(skill).toContain('Treat `acceptanceTests[]` and `e2eSuites[]` as first-class contract rows');
    expect(skill).toContain('`OUT-*` must not appear in `traceRows[].covers`');
  });

  it('documents pre-render completeness checks that prevent renderer churn', () => {
    const skill = readSkillFile('SKILL.md');

    expect(skill).toContain('### 4a. Pre-Render Completeness Check');
    expect(skill).toContain('pre_render_definition_drilldown.js');
    expect(skill).toContain('deterministic automation equivalent of a `grill-with-docs` pass');
    expect(skill).toContain('direct contradiction matrix findings');
    expect(skill).toContain('external side effects that lack timeout/failure/idempotency/recovery/evidence semantics');
    expect(skill).toContain('Core arrays are present and non-empty');
    expect(skill).toContain('Governance event types that write control fields have controlled writers');
    expect(skill).toContain('Mermaid diagrams reference only declared IDs and use renderer-compatible labels');
    expect(skill).toContain('repair renderer blocking issues until the page is confirmable or a real blocker is found');
  });

  it('documents stage-specific reverse audit CLIs and deprecated generic wrapper semantics', () => {
    const skill = readSkillFile('SKILL.md');
    const reverseAuditGate = readSkillFile(path.join('references', 'reverse-audit-gate.md'));

    for (const content of [skill, reverseAuditGate]) {
      expect(content).toContain('audit_contract_confirmability.js');
      expect(content).toContain('audit_implementation_readiness.js');
      expect(content).toContain('audit_delivery_verification.js');
      expect(content).toContain('audit_closeout_integrity.js');
      expect(content).toContain('reverse_audit_stage_common.js');
      expect(content).toContain('compatibility wrapper');
      expect(content).toContain('generic `PASS`');
      expect(content).toContain('stageAudit');
    }
  });

  it('documents convergent pre-render drilldown instead of unbounded question loops', () => {
    const skill = readSkillFile('SKILL.md');
    const reverseAuditGate = readSkillFile(path.join('references', 'reverse-audit-gate.md'));

    for (const content of [skill, reverseAuditGate]) {
      expect(content).toContain('--previous-report');
      expect(content).toContain('--resolutions');
      expect(content).toContain('--changed-only');
      expect(content).toContain('--max-new-blockers');
      expect(content).toContain('--emit-decision-packet');
      expect(content).toContain('fingerprint');
      expect(content).toContain('clusterId');
      expect(content).toContain('resolved');
      expect(content).toContain('waived');
      expect(content).toContain('converted_to_open_question');
      expect(content).toContain('converted_to_out_boundary');
      expect(content).toContain('no_new_blockers');
      expect(content).toContain('remainingBlockingClusters');
    }
  });

  it('documents scale assessment and semantic checkpoint runner before render', () => {
    const skill = readSkillFile('SKILL.md');
    const reverseAuditGate = readSkillFile(path.join('references', 'reverse-audit-gate.md'));

    for (const content of [skill, reverseAuditGate]) {
      expect(content).toContain('assess_contract_authoring_scale.js');
      expect(content).toContain('run_semantic_checkpoints.js');
      expect(content).toContain('checkpoint_required');
      expect(content).toContain('single-file');
      expect(content).toContain('--mode plan|status|run|resume');
      expect(content).toContain('--until pre-render-ready');
    }
  });

  it('publishes semantic checkpoint workflow as a skill reference', () => {
    const skill = readSkillFile('SKILL.md');
    const checkpointWorkflow = readSkillFile(path.join('references', 'semantic-checkpoint-workflow.md'));

    expect(skill).toContain('semantic-checkpoint-workflow.md');
    expect(skill).toContain('normative checkpoint workflow');
    expect(skill).toContain('Every checkpoint remains a bounded source-document edit');
    expect(skill).toContain('degrade checkpoint work into status-only progress markers');
    expect(checkpointWorkflow).toContain('This reference is part of `requirements-contract-authoring`');
    expect(checkpointWorkflow).toContain('one semantic checkpoint -> one bounded source-document edit');
    expect(checkpointWorkflow).toContain("The checkpoint runner's `--until pre-render-ready` scope covers checkpoints 1-8");
    expect(checkpointWorkflow).toContain('The runner must preserve checkpoint authoring semantics');
  });
});
