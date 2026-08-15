import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const SKILL_DIR = path.join(ROOT, '_bmad', 'skills', 'requirements-contract-authoring');
const SURFACE_SKILL_DIRS = [
  SKILL_DIR,
  path.join(ROOT, '.codex', 'skills', 'requirements-contract-authoring'),
  path.join(ROOT, '.claude', 'skills', 'requirements-contract-authoring'),
  path.join(ROOT, '.cursor', 'skills', 'requirements-contract-authoring'),
];

function readSkillFile(relativePath: string): string {
  return fs.readFileSync(path.join(SKILL_DIR, relativePath), 'utf8');
}

function readSkillSurface(relativePath: string): string[] {
  return SURFACE_SKILL_DIRS.filter((dir) => fs.existsSync(path.join(dir, relativePath))).map(
    (dir) => fs.readFileSync(path.join(dir, relativePath), 'utf8')
  );
}

describe('requirements-contract-authoring published contract', () => {
  it('keeps repository-local requirements-contract-authoring skill surfaces byte-synchronized', () => {
    const verifier = path.join(
      SKILL_DIR,
      'scripts',
      'verify-requirements-contract-authoring-skill-sync.js'
    );
    const output = execFileSync(process.execPath, [verifier, '--repo-only'], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
    const report = JSON.parse(output);

    expect(report.ok).toBe(true);
    expect(report.source.fileCount).toBeGreaterThan(0);
    expect(report.surfaces.map((surface: any) => surface.path).sort()).toEqual(
      [
        path.join(ROOT, '.codex', 'skills', 'requirements-contract-authoring').replace(/\\/g, '/'),
        path.join(ROOT, '.claude', 'skills', 'requirements-contract-authoring').replace(/\\/g, '/'),
        path.join(ROOT, '.cursor', 'skills', 'requirements-contract-authoring').replace(/\\/g, '/'),
        path
          .join(
            ROOT,
            'packages',
            'bmad-speckit',
            '_bmad',
            'skills',
            'requirements-contract-authoring'
          )
          .replace(/\\/g, '/'),
      ].sort()
    );
    for (const surface of report.surfaces) {
      expect(surface.ok, surface.path).toBe(true);
      expect(surface.fileCount, surface.path).toBe(report.source.fileCount);
      expect(surface.directoryHash, surface.path).toBe(report.source.directoryHash);
      expect(surface.missingFiles, surface.path).toEqual([]);
      expect(surface.extraFiles, surface.path).toEqual([]);
      expect(surface.mismatchedFiles, surface.path).toEqual([]);
      expect(surface.issues, surface.path).toEqual([]);
    }
  });

  it('documents governanceEventTypeRegistryPolicy as mandatory when governance events apply', () => {
    const skill = readSkillFile('SKILL.md');
    const template = readSkillFile(path.join('references', 'contract-template.md'));
    const rendererSpec = readSkillFile(
      path.join('references', 'html-confirmation-renderer-spec.md')
    );

    for (const content of [skill, template, rendererSpec]) {
      expect(content).toContain('governanceEventTypeRegistryPolicy');
      expect(content).toContain('controlFieldVocabulary');
      expect(content).toContain('payloadKindContracts');
      expect(content).toContain('controlWriteModePolicies');
      expect(content).toContain('eventSpecificRequirements');
    }

    expect(skill).toContain(
      'When governance events apply, require `governanceEventTypeRegistryPolicy`'
    );
    expect(template).toContain('governanceEventTypeRegistryPolicy:');
    expect(template).toContain('controlFieldVocabulary:');
    expect(rendererSpec).toContain(
      'the current event type must list it in `writesControlFields[]`'
    );
    expect(rendererSpec).toContain(
      'strict mode must require both `governanceEventTypeRegistryPolicy` and `governanceEventTypeRegistry[]`'
    );
  });

  it('documents controlledIngestWriterRegistry as the only writer permission authority', () => {
    const skill = readSkillFile('SKILL.md');
    const template = readSkillFile(path.join('references', 'contract-template.md'));
    const rendererSpec = readSkillFile(
      path.join('references', 'html-confirmation-renderer-spec.md')
    );

    for (const content of [skill, template, rendererSpec]) {
      expect(content).toContain('controlledIngestWriterRegistry');
      expect(content).toContain('allowedEventTypes');
      expect(content).toContain('payloadContractRefs');
      expect(content).toContain('beforeAfterHashRequired');
      expect(content).toContain('canModifyWriterRegistry');
    }

    expect(skill).toContain(
      'the only machine-readable authority for which writer may write control records'
    );
    expect(template).toContain(
      'A writer that receives a registered event type outside its `allowedEventTypes[]` must fail closed'
    );
    expect(rendererSpec).toContain('strict mode must require `controlledIngestWriterRegistry[]`');
  });

  it('publishes the package prepare action as the only architecture confirmation producer', () => {
    const skill = readSkillFile('SKILL.md');
    const rendererSpec = readSkillFile(
      path.join('references', 'html-confirmation-renderer-spec.md')
    );

    for (const content of [skill, rendererSpec]) {
      expect(content).toContain('prepare-architecture-confirmation-page.ts');
      expect(content).toContain(
        'bmad-speckit main-agent prepare-architecture-confirmation --request-id <requestId> --json'
      );
      expect(content).toContain(
        'The package action is the only public architecture confirmation producer'
      );
      expect(content).toContain('Caller-derived architecture inputs must fail closed');
      expect(content).toContain(
        'Initial prepare must not write `architecture_confirmation_state_checked`'
      );
      expect(content).toContain('exactConfirmationText');
      expect(content).not.toContain(
        'generate requirement-scoped `architecture-confirmation-<runId>.json`'
      );
    }

    expect(skill).toContain(
      'The skill-local prepare script is a request-id-only compatibility wrapper'
    );
    expect(rendererSpec).toContain(
      'The skill-local architecture renderer is projection-only compatibility surface'
    );
  });

  it('documents the automated controlled confirmation ingest that must run immediately after chat confirmation', () => {
    const skill = readSkillFile('SKILL.md');
    const template = readSkillFile(path.join('references', 'contract-template.md'));
    const rendererSpec = readSkillFile(
      path.join('references', 'html-confirmation-renderer-spec.md')
    );

    expect(skill).toContain(
      'Immediately after exact chat confirmation, the agent must run the high-level confirmation ingest action'
    );
    expect(skill).toContain('bmad-speckit confirm-scope');
    expect(skill).toContain('bmad-speckit main-agent confirm-scope');
    expect(skill).toContain('bmad-speckit main-agent:confirm-scope');
    expect(skill).toContain('installed package runtime');
    expect(skill).toContain(
      'Consumer-facing instructions must not route through root TypeScript orchestration scripts'
    );
    expect(skill).not.toContain('main-agent-orchestration.ts');
    expect(skill).not.toContain('--action confirm-scope');
    expect(skill).toContain('confirm-requirements-scope.js');
    expect(template).toContain('bmad-speckit confirm-scope');
    expect(template).toContain(
      'automated post-confirmation step that delegates to the skill-local controlled ingest wrapper'
    );
    expect(template).toContain(
      'Do not require the user or agent to remember lower-level ingest commands manually'
    );
    expect(rendererSpec).toContain(
      'Post-confirmation control writes are handled by the high-level confirmation ingest action, not by the renderer'
    );
    expect(rendererSpec).toContain('bmad-speckit confirm-scope');
    expect(rendererSpec).toContain('bmad-speckit main-agent:confirm-scope');
  });

  it('defaults contract generation to confirmation-ready source authoring without collapsing later gates', () => {
    const skill = readSkillFile('SKILL.md');

    expect(skill).toContain('Default to `author-confirmation-ready-source`');
    expect(skill).toContain('Do not collapse these modes into one long execution chain');
    expect(skill).toContain(
      '"Generate requirements contract document" means author the confirmation-ready source document'
    );
    expect(skill).toContain('The target is not a loose draft');
    expect(skill).toContain(
      'ready to render a confirmation page with minimal or no renderer repair'
    );
  });

  it('separates the semantic IR confirmation lane from delivery closeout', () => {
    const skill = readSkillFile('SKILL.md');

    expect(skill).toContain('## Requirements Semantic IR Production Lane');
    expect(skill).toContain('IR is the only semantic authority');
    expect(skill).toContain('`requestId + exactConfirmationText`');
    expect(skill).toContain('must not rerun Grill, cp00-cp08, Judge, or EffectivePass');
    expect(skill).toContain('loaded from the configured production prompt path');
    expect(skill).toContain('Requirements scope confirmation is not delivery closeout acceptance');
    expect(skill).toContain('must not read or require execution final Judge campaign identity');
  });

  it('normalizes requirements contract authoring intents into the visible authoring lane', () => {
    for (const skill of readSkillSurface('SKILL.md')) {
      expect(skill).toContain('## Intent Normalization');
      expect(skill).toContain('`生成需求契约文档` routes to `author-confirmation-ready-source`');
      expect(skill).toContain(
        '`更新文档为详细需求契约文档` routes to `author-confirmation-ready-source`'
      );
      expect(skill).toContain(
        '`补 implementationConfirmation` routes to `author-confirmation-ready-source`'
      );
      expect(skill).toContain('`完善需求合同` routes to `author-confirmation-ready-source`');
      expect(skill).toContain(
        'A source document without inline `implementationConfirmation` MUST NOT route to `authoring-repair preserve-existing`'
      );
      expect(skill).toContain(
        'A semantic update to an existing inline `implementationConfirmation` MUST enter the visible `author-confirmation-ready-source` lane first'
      );
      expect(skill).toContain(
        'Confirmation language selection and confirmation HTML rendering are post-authoring steps'
      );
      expect(skill).toContain('Missing confirmation language MUST remain `null` or `not_selected`');
      expect(skill).toContain(
        'Missing confirmation language MUST NOT skip lane selection, scale assessment, controlled MUST candidate detection, packet planning, or pre-write blocking gates'
      );
    }
  });

  it('requires visible initial scale assessment before any source-document write', () => {
    for (const skill of readSkillSurface('SKILL.md')) {
      expect(skill).toContain('## Pre-Write Scale Assessment Gate');
      expect(skill).toContain('Before any source-document write');
      expect(skill).toContain('assess_contract_authoring_scale.js');
      expect(skill).toContain('--phase initial_assessment');
      expect(skill).toContain('scale-assessment-initial.json');
      expect(skill).toContain('main-agent-orchestration --action author-confirmation-ready-source');
      expect(skill).toContain('safe-write helper, large-document replacement helper');
      expect(skill).toContain('visible scale-assessment `stderr` trace');
      expect(skill).toContain('pre_write_scale_assessment_required');
      expect(skill).toContain('Do not claim that checkpoint assessment is unnecessary');
    }

    for (const workflow of readSkillSurface(
      path.join('references', 'semantic-checkpoint-workflow.md')
    )) {
      expect(workflow).toContain(
        '`initial_assessment` is a pre-write gate for every source-document write in `author-confirmation-ready-source`'
      );
      expect(workflow).toContain('safe-write helper, large-document replacement helper');
      expect(workflow).toContain('scale-assessment-initial.json');
      expect(workflow).toContain('visible `initial_assessment` trace to `stderr`');
      expect(workflow).toContain('pre_write_scale_assessment_required');
    }
  });

  it('requires pre-write blocking gates before source materialization and keeps preserve-existing audit-only', () => {
    for (const skill of readSkillSurface('SKILL.md')) {
      expect(skill).not.toContain('source_materialization_before_deep_audit');
      expect(skill).toContain('pre_write_blocking_gate');
      expect(skill).toContain('MUST NOT mutate the implementation source document');
      expect(skill).toContain('source-mutation-decision.json.finalDecision');
      expect(skill).toContain('draft-source-preview.md');
      expect(skill).toContain('requirement coverage ledger');
      expect(skill).toContain('target authority');
      expect(skill).toContain('validation authority');
      expect(skill).toContain('projection-domain sanity');
      expect(skill).toContain('real Critical Auditor receipts');
      expect(skill).toContain('leave the source document unchanged');
      expect(skill).toContain('diagnostic authoring artifacts under `_bmad-output`');
      expect(skill).toContain(
        '`authoring-repair preserve-existing` MUST audit existing inline `implementationConfirmation` content only'
      );
      expect(skill).toContain('MUST NOT create a new `implementationConfirmation` block');
      expect(skill).toContain(
        '`grill-with-docs` / `docs-review` may review written source files or the persisted `draft-source-preview.md`'
      );
      expect(skill).toContain('chat-only drafts are not valid audit targets');
    }
  });

  it('distinguishes pre-materialization advisory scans from deep audit and checkpoint evidence', () => {
    for (const skill of readSkillSurface('SKILL.md')) {
      expect(skill).toContain('pre_materialization_advisory_scan');
      expect(skill).toContain('purpose=pre_materialization_advisory_scan');
      expect(skill).toContain('not_audit_evidence');
      expect(skill).toContain('MUST NOT write audit artifacts');
      expect(skill).toContain('MUST NOT run as a loop');
      expect(skill).toContain('MUST NOT be called checkpoint');
      expect(skill).toContain('MUST NOT be called Critical Auditor');
      expect(skill).toContain('MUST NOT count as convergence evidence');
      expect(skill).toContain('post_materialization_deep_audit');
      expect(skill).toContain('critical_auditor_round');
    }
  });

  it('splits atomic decomposition into pre-write convergence and post-materialization verification', () => {
    for (const skill of readSkillSurface('SKILL.md')) {
      expect(skill).toContain(
        'pre-write phase performs packet planning, source edit planning, real Critical Auditor convergence'
      );
      expect(skill).toContain(
        'may use quick scan and `pre_materialization_advisory_scan` only as read-only, non-audit guidance'
      );
      expect(skill).toContain(
        'Source materialization is allowed only after `source-mutation-decision.json.finalDecision` is `allow_source_materialization`'
      );
      expect(skill).toContain(
        'post-materialization phase verifies the written source, receipt, and current hashes'
      );
    }
  });

  it('documents that semantic checkpoints do not spawn subagents or perform audit reasoning', () => {
    for (const workflow of readSkillSurface(
      path.join('references', 'semantic-checkpoint-workflow.md')
    )) {
      expect(workflow).toContain('The checkpoint runner does not spawn subagents');
      expect(workflow).toContain(
        'Checkpoint mode does not review, audit, reason over semantic gaps'
      );
      expect(workflow).toContain('run three-perspective analysis');
      expect(workflow).toContain('perform Critical Auditor convergence');
      expect(workflow).toContain('persists only source edits that were already materialized');
      expect(workflow).toContain('human-readable status page to `stderr`');
      expect(workflow).toContain('must not replace JSON `stdout`');
    }
  });

  it('requires authority-first fact collection and ID matrix design before authoring prose', () => {
    const skill = readSkillFile('SKILL.md');

    expect(skill).toContain('Use authority-first, expand-on-signal fact collection');
    expect(skill).toContain('Do not run broad repository searches before authoring');
    expect(skill).toContain('Before writing the source document body, build the ID matrix');
    expect(skill).toContain(
      'Every `MUST-*` and `NEG-*` must have evidence, trace coverage, at least one view, and at least one `ACC-*` or `E2E-*` coverage row'
    );
    expect(skill).toContain(
      'Treat `acceptanceTests[]` and `e2eSuites[]` as first-class contract rows'
    );
    expect(skill).toContain('`OUT-*` must not appear in `traceRows[].covers`');
  });

  it('documents pre-render completeness checks that prevent renderer churn', () => {
    const skill = readSkillFile('SKILL.md');

    expect(skill).toContain('### 4a. Pre-Render Completeness Check');
    expect(skill).toContain('pre_render_definition_drilldown.js');
    expect(skill).toContain('deterministic automation equivalent of a `grill-with-docs` pass');
    expect(skill).toContain('direct contradiction matrix findings');
    expect(skill).toContain(
      'external side effects that lack timeout/failure/idempotency/recovery/evidence semantics'
    );
    expect(skill).toContain('Core arrays are present and non-empty');
    expect(skill).toContain(
      'Governance event types that write control fields have controlled writers'
    );
    expect(skill).toContain(
      'Mermaid diagrams reference only declared IDs and use renderer-compatible labels'
    );
    expect(skill).toContain(
      'repair renderer blocking issues until the page is confirmable or a real blocker is found'
    );
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
    const checkpointWorkflow = readSkillFile(
      path.join('references', 'semantic-checkpoint-workflow.md')
    );

    for (const content of [skill, checkpointWorkflow]) {
      expect(content).toContain('assess_contract_authoring_scale.js');
      expect(content).toContain('run_semantic_checkpoints.js');
      expect(content).toContain('checkpoint_required');
      expect(content).toContain('initial_assessment');
      expect(content).toContain('post_packet_assessment');
      expect(content).toContain('post_materialization_assessment');
      expect(content).toContain('scale-routing-decision.json');
      expect(content).toContain('checkpoint-persistence');
      expect(content).toContain('checkpoint-persistence-evidence');
      expect(content).toContain('monotonic');
      expect(content).toContain('single-file');
      expect(content).toContain('--mode plan|status|run|resume');
      expect(content).toContain('--until pre-render-ready');
    }
  });

  it('publishes semantic checkpoint workflow as a skill reference', () => {
    const skill = readSkillFile('SKILL.md');
    const checkpointWorkflow = readSkillFile(
      path.join('references', 'semantic-checkpoint-workflow.md')
    );

    expect(skill).toContain('semantic-checkpoint-workflow.md');
    expect(skill).toContain('normative checkpoint workflow');
    expect(skill).toContain('Every checkpoint remains a bounded source-document edit');
    expect(skill).toContain('degrade checkpoint work into status-only progress markers');
    expect(checkpointWorkflow).toContain(
      'This reference is part of `requirements-contract-authoring`'
    );
    expect(checkpointWorkflow).toContain(
      'one semantic checkpoint -> one bounded source-document edit'
    );
    expect(checkpointWorkflow).toContain(
      "The checkpoint runner's `--until pre-render-ready` scope covers checkpoints 1-8"
    );
    expect(checkpointWorkflow).toContain('The runner must preserve checkpoint authoring semantics');
    expect(checkpointWorkflow).toContain(
      '`run_semantic_checkpoints.js` is not the semantic authoring engine'
    );
    expect(checkpointWorkflow).toContain('append status-only checkpoint logs');
    expect(checkpointWorkflow).toContain('must already exist from `authoring-repair`');
  });

  it('keeps skill-local command references portable across installation roots', () => {
    const skill = readSkillFile('SKILL.md');
    const template = readSkillFile(path.join('references', 'contract-template.md'));
    const rendererSpec = readSkillFile(
      path.join('references', 'html-confirmation-renderer-spec.md')
    );
    const checkpointWorkflow = readSkillFile(
      path.join('references', 'semantic-checkpoint-workflow.md')
    );
    const portableDocs = [skill, template, rendererSpec, checkpointWorkflow];

    for (const content of portableDocs) {
      expect(content).not.toContain('_bmad/skills/requirements-contract-authoring/scripts');
      expect(content).not.toContain('node _bmad/skills/requirements-contract-authoring');
      expect(content).toContain('<skill-dir>/scripts/');
    }

    expect(skill).toContain('## Skill Directory Resolution');
    expect(skill).toContain(
      'Treat `<skill-dir>` as the directory that contains the `SKILL.md` loaded for this invocation'
    );
    expect(skill).toContain(
      'Do not assume the skill is installed under `_bmad/skills`, `.codex/skills`, `~/.codex/skills`, or any other fixed root'
    );
    expect(skill).toContain(
      'Scripts inside this skill must locate sibling files with `__dirname` or the ESM equivalent `import.meta.url`'
    );
    expect(template).toContain('commandRef:');
    expect(template).toContain('skill: requirements-contract-authoring');
    expect(template).toContain('script: scripts/render-requirements-confirmation-html.ts');
    expect(template).toContain('scriptRef:');
    expect(template).toContain('scriptPath: "<skill-dir>/scripts/ingest-confirmation-event.js"');
  });

  it('publishes the large-document draft promotion protocol without consumer-root scripts', () => {
    for (const skill of readSkillSurface('SKILL.md')) {
      expect(skill).toContain('## Large Document Draft Promotion Protocol');
      expect(skill).toContain('node <skill-dir>/scripts/promote-draft-large-doc.js');
      expect(skill).toContain('--retry-receipt');
      expect(skill).toContain('--promotion-stage confirmation-ready');
      expect(skill).toContain('--promotion-stage authoring-draft');
      expect(skill).toContain('--scale-assessment <authoring-dir>/scale-assessment-initial.json');
      expect(skill).toContain(
        '--scale-routing-decision <authoring-dir>/scale-routing-decision.json'
      );
      expect(skill).toContain(
        '--source-mutation-decision <authoring-dir>/source-mutation-decision.json'
      );
      expect(skill).toContain('--encoding-report <authoring-dir>/encoding-report.json');
      expect(skill).toContain('--receipt-out <authoring-dir>/promotion-receipt.json');
      expect(skill).toContain('--auto-repair');
      expect(skill).toContain('--preflight-only');
      expect(skill).toContain('--dry-run');
      expect(skill).toContain('normalize-draft-markdown.js');
      expect(skill).toContain('generate-draft-manifest.js');
      expect(skill).toContain('semantic_decision_required:expected_draft_gap_policy');
      expect(skill).toContain('Do not add or use `--allow-expected-draft-gap`');
      expect(skill).toContain(
        'plain source doc -> controlled MUST candidates -> draft implementationConfirmation -> safe promotion as draft -> render/audit -> explicit user confirmation -> status: user_confirmed'
      );
      expect(skill).toContain('`--promotion-stage authoring-draft` allows only');
      expect(skill).toContain(
        'not confirmation-ready, not implementation-ready, and not execution-ready'
      );
      expect(skill).toContain('`promotionStage`');
      expect(skill).toContain('`allowedStatuses`');
      expect(skill).toContain('`statusValue`');
      expect(skill).toContain('`confirmationReady: false`');
      expect(skill).toContain('`safePromotionAsDraft: true`');
      expect(skill).toContain('`requiresUserConfirmationBeforeExecution: true`');
      expect(skill).toContain('`authoringPromotionGate`');
      expect(skill).toContain('`receiptPath`');
      expect(skill).toContain('Authoring-draft promotion is guarded');
      expect(skill).toContain('`authoring_promotion_gate_failed`');
      expect(skill).toContain('`nextRequiredActions[]`');
      expect(skill).toContain('The target document must not be created or modified');
      expect(skill).toContain('may generate missing `scale-assessment-initial.json`');
      expect(skill).toContain('MUST NOT synthesize `source-mutation-decision.json`');
      expect(skill).toContain('Critical Auditor convergence');
      expect(skill).toContain('checkpoint persistence');
      expect(skill).toContain(
        'sourceDocumentHashBefore` bound to the current target raw document hash'
      );
      expect(skill).toContain(
        'sourceDocumentHashAfter` bound to the current draft manifest raw hash'
      );
      expect(skill).toContain(
        'semanticSourceHashAfter` bound to the current draft semantic `sourceDocumentHash`'
      );
      expect(skill).toContain('write-critical-auditor-no-new-gap-response.js');
      expect(skill).toContain('never writes receipt files');
      expect(skill).toContain('sourceDocumentExistedBefore: false');
      expect(skill).toContain('currentTargetState');
      expect(skill).toContain('expectedDraftHash');
      expect(skill).toContain('allows only `status: user_confirmed`');
      expect(skill).toContain(
        'The write flow must work when the current project root has no `scripts` directory'
      );
    }
  });

  it('rejects unsafe consumer-facing command text for large document writes', () => {
    const unsafeSamples = [
      'node scripts/safe-write-large-doc.mjs --target docs/plan.md',
      'node scripts/promote-draft-large-doc.js --draft draft.md --target docs/plan.md',
      'pwsh.exe -Command "& { $content = @\\"# body\\"@; $content | node writer.cjs }"',
      "node -e \"require('node:fs').writeFileSync('docs/plan.md', body)\"",
      'Get-Content draft.md | Set-Content docs/plan.md',
      'type draft.md >> docs/plan.md',
    ];
    const forbidden =
      /(?:^|\s)(?:node\s+scripts\/(?:safe-write-large-doc|promote-draft-large-doc)|pwsh(?:\.exe)?\s+-Command[\s\S]*(?:@["']|@\\["'])|node\s+-e|Set-Content|>>)/u;

    for (const sample of unsafeSamples) {
      expect(sample).toMatch(forbidden);
    }

    for (const skill of readSkillSurface('SKILL.md')) {
      expect(skill).toContain(
        'Do not instruct consumers to run `node scripts/safe-write-large-doc.mjs`'
      );
      const commandLines = skill
        .split(/\r?\n/u)
        .filter((line) => /^\s*(?:node|pwsh|pwsh\.exe|Get-Content|type)\b/u.test(line));
      for (const line of commandLines) {
        expect(line, line).not.toMatch(forbidden);
      }
    }
  });

  it('keeps skill resolution centralized with a package-owned fallback', () => {
    const installedSkillResolverFiles = [
      'packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts',
      'packages/bmad-speckit/src/main-agent/source-authority/scripts/target-artifact-realization-gate.ts',
    ];
    const packageOwnedResolverFiles = [
      'packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-implementation-readiness-gate.ts',
      'packages/bmad-speckit/src/main-agent/source-authority/scripts/ai-tdd-contract-gate.ts',
      'packages/bmad-speckit/src/main-agent/source-authority/scripts/strict-command-resolution-preflight.ts',
    ];

    for (const relativePath of installedSkillResolverFiles) {
      const content = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
      expect(content, `${relativePath} should use the installed skill resolver`).toContain(
        'resolveInstalledSkillPath'
      );
      expect(content).not.toMatch(/['"]\.(?:codex|cursor|claude|agents)['"],\s*['"]skills['"]/u);
    }

    for (const relativePath of packageOwnedResolverFiles) {
      const content = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
      expect(content, `${relativePath} should use the package-owned resolver`).toContain(
        'resolvePackageOwnedBmadPath'
      );
      expect(content, `${relativePath} should resolve the skill namespace`).toContain("'skills'");
      expect(content).not.toMatch(/['"]\.(?:codex|cursor|claude|agents)['"],\s*['"]skills['"]/u);
    }

    const packageResolver = fs.readFileSync(
      path.join(ROOT, 'packages/bmad-speckit/src/main-agent/runtime/package-bmad-root.ts'),
      'utf8'
    );
    expect(packageResolver).toContain("path.join(resolvePackageRoot(startDir), '_bmad')");
    expect(packageResolver).toContain("path.join(packageRoot, 'dist', 'main-agent')");
    expect(packageResolver).toContain("path.join(packageRoot, 'src', 'main-agent')");
    expect(packageResolver).toContain("path.join(projectRoot, '_bmad', 'skills')");
    expect(packageResolver).toContain("path.join(projectRoot, '.codex', 'skills')");
    expect(packageResolver).toContain("path.join(projectRoot, '.cursor', 'skills')");
    expect(packageResolver).toContain("path.join(projectRoot, '.claude', 'skills')");
    expect(packageResolver).toContain(
      "return resolvePackageOwnedBmadPath('skills', skillName, ...segments)"
    );
  });

  it('requires the pre-confirmation atomic decomposition loop before any confirmable HTML', () => {
    const skill = readSkillFile('SKILL.md');
    const template = readSkillFile(path.join('references', 'contract-template.md'));
    const rendererSpec = readSkillFile(
      path.join('references', 'html-confirmation-renderer-spec.md')
    );

    for (const content of [skill, template, rendererSpec]) {
      expect(content).toContain('pre-confirmation atomic decomposition loop');
      expect(content).toContain('semantic-kernel.json');
      expect(content).toContain('must_decomposition_packet.json');
      expect(content).toContain('Critical Auditor');
      expect(content).not.toContain('consecutiveNoNewGapRounds: 3');
      expect(content).toContain('pre_render_must_decomposition_gate.js');
    }

    expect(skill).toContain('receipts bound to the current input hash');
    expect(skill).toContain('must not fabricate no-new-gap receipts');
    expect(template).toContain('three current, hash-bound Critical Auditor receipt files');
    expect(template).toContain('synthetic `bounded_no_new_gap` claims');
    expect(rendererSpec).toContain('three current, hash-bound no-new-gap receipt files');

    expect(skill).toContain(
      'single_pass also cannot skip the pre-confirmation atomic decomposition loop'
    );
    expect(skill).toContain(
      'Checkpointing is only persistence, recovery, single-file commit, and receipt strategy'
    );
    expect(rendererSpec).toContain(
      'missing pre-confirmation semantic drilldown gate report -> confirmability=blocked'
    );
  });

  it('publishes staging-first main-session provider rules on every installed skill surface', () => {
    const surfaces = readSkillSurface('SKILL.md');
    expect(surfaces).toHaveLength(SURFACE_SKILL_DIRS.length);

    for (const content of surfaces) {
      expect(content).toContain('staging-first authoring transaction');
      expect(content).toContain('authoring/staging/draft-source.md');
      expect(content).toContain('source-promotion-decision.json');
      expect(content).toContain('Source materialization is the final promotion step');

      expect(content).toContain('provider missing continuation');
      expect(content).toContain('blockingStage: "critical_auditor_provider_mode_required"');
      expect(content).toContain('nextRequiredAction: "run_main_session_critical_auditor_round"');
      expect(content).toContain('sourceMutationPerformed: false');
      expect(content).toContain('promotion-receipt.json');
      expect(content).toContain('source-materialization-receipt.json');
      expect(content).toContain(
        'Legacy `source-materialization-receipt.json` is not a valid current source write receipt'
      );

      expect(content).toContain(
        '/goal main session owns Critical Auditor response generation, staging rework, receipt writing, and source promotion'
      );
      expect(content).toContain(
        'Long-running requirements-contract authoring work must stay visible in the main session'
      );
      expect(content).toContain('subagent provider modes are read-only response providers');
      expect(content).toContain('critical-auditor-round-response/v1');
      expect(content).toContain(
        'They must not write source documents, packets, receipts, requirement records, source promotion decisions, or convergence claims'
      );

      expect(content).toContain(
        'large-document-writer is transport only and is not semantic owner for requirements contracts'
      );
      expect(content).toContain('requirements-contract-authoring owns semantic extraction');
      expect(content).not.toContain('source_materialization_before_deep_audit');
    }
  });

  it('documents source PRD entry normalization and staging-only gap-fill boundaries', () => {
    for (const content of readSkillSurface('SKILL.md')) {
      expect(content).toContain('source PRD entry normalization');
      expect(content).toContain('entrySource=bmad_prd');
      expect(content).toContain('entrySource=session_requirements');
      expect(content).toContain('entrySource=source_prd_draft');
      expect(content).toContain('All three entry sources must run source PRD instance lint');
      expect(content).toContain('enter the same staging-first authoring lane');
      expect(content).toContain('source PRD draft status below confirmation readiness');
      expect(content).toContain('authoring gap-fill boundary');
      expect(content).toContain('authoring/staging/draft-source.md');
      expect(content).toContain('New rows must carry source refs');
      expect(content).toContain('blocking question, open question, or `OUT-*` boundary');
      expect(content).toContain(
        'must not fabricate `ACC-*`, `E2E-*`, `CMD-*`, `TRACE-*`, `PATH-*`, or `CTM-*` rows'
      );
      expect(content).toContain('BMAD source refs are inputs, not PASS evidence');
      expect(content).toContain(
        'Critical Auditor, packet/source reconciliation, source PRD instance lint, and pre-render gates must re-verify them'
      );
    }
  });

  it('publishes preConfirmationDrilldown metadata while keeping inline implementationConfirmation authoritative', () => {
    const skill = readSkillFile('SKILL.md');
    const template = readSkillFile(path.join('references', 'contract-template.md'));
    const rendererSpec = readSkillFile(
      path.join('references', 'html-confirmation-renderer-spec.md')
    );

    for (const content of [skill, template, rendererSpec]) {
      expect(content).toContain('preConfirmationDrilldown');
      expect(content).toContain('semanticKernelRef');
      expect(content).toContain('mustDecompositionPacketRef');
      expect(content).toContain('packetSourceReconciliation');
      expect(content).toContain('must_packet_source_reconciliation_report.json');
      expect(content).toContain('pre-render-must-decomposition-gate-report.json');
    }

    expect(template).toContain(
      'Final confirmation authority remains the inline `implementationConfirmation` block'
    );
  });

  it('documents the semantic checkpoint sequence as semantic-layer checkpoints rather than chapter checkpoints', () => {
    const skill = readSkillFile('SKILL.md');
    const checkpointWorkflow = readSkillFile(
      path.join('references', 'semantic-checkpoint-workflow.md')
    );

    for (const content of [skill, checkpointWorkflow]) {
      expect(content).toContain('cp-00 semantic kernel');
      expect(content).toContain('cp-01 must_decomposition_packet');
      expect(content).toContain('cp-02 atomic decomposition loop convergence');
      expect(content).toContain('cp-03 packet-to-source materialization');
      expect(content).toContain('cp-04 ID freeze');
      expect(content).toContain('cp-05 implementationConfirmation core');
      expect(content).toContain('cp-06 EVD/TRACE/ACC/E2E/failure/edge/currentTarget/AI-TDD');
      expect(content).toContain('cp-07 human-readable views');
      expect(content).toContain('cp-08 pre-render global reconciliation');
      expect(content).toContain('Checkpoint does not perform segmented reasoning');
    }
  });

  it('documents packet/source reconciliation as a two-way projection contract', () => {
    const skill = readSkillFile('SKILL.md');
    const matrixRules = readSkillFile(path.join('references', 'matrix-rules.md'));
    const reverseAuditGate = readSkillFile(path.join('references', 'reverse-audit-gate.md'));

    for (const content of [skill, matrixRules, reverseAuditGate]) {
      expect(content).toContain('MUST -> packet -> projections -> source rows');
      expect(content).toContain('packet projection -> implementationConfirmation row');
      expect(content).toContain('implementationConfirmation row -> packet projection');
      expect(content).toContain('source row independently invented');
      expect(content).toContain('packet projection not materialized');
    }
  });

  it('documents renderer drilldown sections and confirmation-only reverse audit layering', () => {
    const rendererSpec = readSkillFile(
      path.join('references', 'html-confirmation-renderer-spec.md')
    );
    const reverseAuditGate = readSkillFile(path.join('references', 'reverse-audit-gate.md'));

    for (const heading of [
      'Pre-Confirmation Semantic Drilldown',
      'Semantic Kernel Summary',
      'MUST Decomposition Packet',
      'Atomicity Drivers',
      'Atomic Task Baseline',
      'Projection Coverage',
      'Critical Auditor Convergence',
      'Gap History',
      'Packet-To-Source Reconciliation',
    ]) {
      expect(rendererSpec).toContain(heading);
    }

    for (const content of [rendererSpec, reverseAuditGate]) {
      expect(content).toContain('The user confirms only the requirements scope');
      expect(content).toContain('contract confirmability audit');
      expect(content).toContain('implementation readiness audit');
      expect(content).toContain('delivery verification audit');
      expect(content).toContain('closeout integrity audit');
      expect(content).toContain('deliveryReadiness must not be represented as ready');
    }
  });

  it('publishes a fixture catalog for valid and blocked pre-confirmation drilldown cases', () => {
    const catalog = JSON.parse(
      readSkillFile(path.join('fixtures', 'pre-confirmation-must-atomic-drilldown', 'catalog.json'))
    );

    expect(catalog.validFixtures.map((fixture: any) => fixture.kind)).toEqual(
      expect.arrayContaining(['small valid source', 'large checkpoint-required valid source'])
    );
    expect(catalog.blockedFixtures.map((fixture: any) => fixture.kind)).toEqual(
      expect.arrayContaining([
        'missing packet',
        'stale packet',
        'under-split MUST',
        'over-broad atomic task',
        'missing critic receipt',
        'less than 3 rounds',
        'source invented trace row',
        'projection not materialized',
      ])
    );
    expect(catalog.blockedFixtures.map((fixture: any) => fixture.expectedBlocker)).toEqual(
      expect.arrayContaining([
        'missing_must_decomposition_packet',
        'must_packet_source_hash_stale',
        'must_packet_under_split',
        'must_packet_over_broad_atomic_task',
        'critical_auditor_receipt_missing',
        'critical_auditor_less_than_three_no_new_gap_rounds',
        'source_row_independently_invented',
        'packet_projection_not_materialized',
      ])
    );
  });
});
