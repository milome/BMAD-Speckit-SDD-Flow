import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const SKILL_DIR = path.join(ROOT, '_bmad', 'skills', 'requirements-contract-authoring');
const SURFACE_SKILL_DIRS = [
  SKILL_DIR,
  path.join(ROOT, '.codex', 'skills', 'requirements-contract-authoring'),
  path.join(ROOT, '.claude', 'skills', 'requirements-contract-authoring'),
  path.join(ROOT, '.cursor', 'skills', 'requirements-contract-authoring'),
  path.join(
    ROOT,
    'packages',
    'bmad-speckit',
    '_bmad',
    'skills',
    'requirements-contract-authoring'
  ),
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

  it('publishes architecture confirmation prepare as the user-facing entry', () => {
    const skill = readSkillFile('SKILL.md');
    const rendererSpec = readSkillFile(
      path.join('references', 'html-confirmation-renderer-spec.md')
    );

    for (const content of [skill, rendererSpec]) {
      expect(content).toContain('prepare-architecture-confirmation-page.ts');
      expect(content).toContain('architecture_confirmation_state_checked');
      expect(content).toContain(
        'generate requirement-scoped `architecture-confirmation-<runId>.json`'
      );
      expect(content).toContain(
        'Do not expose stale check or JSON producer commands as manual user steps'
      );
    }

    expect(skill).toContain(
      'The user-facing next step is only to open the architecture confirmation HTML and confirm the hashes in chat'
    );
    expect(rendererSpec).toContain(
      'The user-facing next step must only be to open the architecture confirmation HTML and confirm the hashes in chat'
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
    expect(skill).toContain('bmad-speckit main-agent:confirm-scope');
    expect(skill).toContain('main-agent-orchestration.ts');
    expect(skill).toContain('--action confirm-scope');
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
      expect(skill).toContain(
        'Missing confirmation language MUST remain `null` or `not_selected`'
      );
      expect(skill).toContain(
        'Missing confirmation language MUST NOT skip lane selection, scale assessment, controlled MUST candidate detection, packet planning, or source materialization'
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

  it('requires source materialization before deep audit and keeps preserve-existing audit-only', () => {
    for (const skill of readSkillSurface('SKILL.md')) {
      expect(skill).toContain('source_materialization_before_deep_audit');
      expect(skill).toContain(
        '`author-confirmation-ready-source` MUST write the source document before Critical Auditor, multi-subagent audit, `grill-with-docs`, or `docs-review` starts a deep review loop'
      );
      expect(skill).toContain(
        'only quick scan, atomic decomposition draft creation, packet generation, and source edit planning are allowed'
      );
      expect(skill).toContain(
        '`authoring-repair preserve-existing` MUST audit existing inline `implementationConfirmation` content only'
      );
      expect(skill).toContain('MUST NOT create a new `implementationConfirmation` block');
      expect(skill).toContain(
        '`grill-with-docs` / `docs-review` MUST audit written files only instead of chat-only drafts'
      );
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

  it('splits atomic decomposition into packet planning before materialization and auditor convergence after materialization', () => {
    for (const skill of readSkillSurface('SKILL.md')) {
      expect(skill).toContain('pre-materialization phase performs packet planning and source edit planning');
      expect(skill).toContain('may use quick scan and `pre_materialization_advisory_scan` only as read-only, non-audit guidance');
      expect(skill).toContain('post-materialization phase performs auditor convergence');
    }
  });

  it('documents that semantic checkpoints do not spawn subagents or perform audit reasoning', () => {
    for (const workflow of readSkillSurface(
      path.join('references', 'semantic-checkpoint-workflow.md')
    )) {
      expect(workflow).toContain('The checkpoint runner does not spawn subagents');
      expect(workflow).toContain('Checkpoint mode does not review, audit, reason over semantic gaps');
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
      expect(skill).toContain('--preflight-only');
      expect(skill).toContain('--dry-run');
      expect(skill).toContain('normalize-draft-markdown.js');
      expect(skill).toContain('generate-draft-manifest.js');
      expect(skill).toContain('semantic_decision_required:expected_draft_gap_policy');
      expect(skill).toContain('Do not add or use `--allow-expected-draft-gap`');
      expect(skill).toContain('The write flow must work when the current project root has no `scripts` directory');
    }
  });

  it('rejects unsafe consumer-facing command text for large document writes', () => {
    const unsafeSamples = [
      'node scripts/safe-write-large-doc.mjs --target docs/plan.md',
      'node scripts/promote-draft-large-doc.js --draft draft.md --target docs/plan.md',
      'pwsh.exe -Command "& { $content = @\\"# body\\"@; $content | node writer.cjs }"',
      'node -e "require(\'node:fs\').writeFileSync(\'docs/plan.md\', body)"',
      'Get-Content draft.md | Set-Content docs/plan.md',
      'type draft.md >> docs/plan.md',
    ];
    const forbidden = /(?:^|\s)(?:node\s+scripts\/(?:safe-write-large-doc|promote-draft-large-doc)|pwsh(?:\.exe)?\s+-Command[\s\S]*(?:@["']|@\\["'])|node\s+-e|Set-Content|>>)/u;

    for (const sample of unsafeSamples) {
      expect(sample).toMatch(forbidden);
    }

    for (const skill of readSkillSurface('SKILL.md')) {
      expect(skill).toContain('Do not instruct consumers to run `node scripts/safe-write-large-doc.mjs`');
      const commandLines = skill
        .split(/\r?\n/u)
        .filter((line) => /^\s*(?:node|pwsh|pwsh\.exe|Get-Content|type)\b/u.test(line));
      for (const line of commandLines) {
        expect(line, line).not.toMatch(forbidden);
      }
    }
  });

  it('keeps skill resolver candidates aligned with supported host surfaces', () => {
    const resolverFiles = [
      'scripts/main-agent-orchestration.ts',
      'scripts/main-agent-implementation-readiness-gate.ts',
      'scripts/ai-tdd-contract-gate.ts',
      'scripts/strict-command-resolution-preflight.ts',
      'scripts/target-artifact-realization-gate.ts',
    ];

    for (const relativePath of resolverFiles) {
      const content = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
      for (const surface of ['.codex', '.cursor', '.claude', '.agents']) {
        expect(content, `${relativePath} should resolve ${surface}/skills`).toContain(
          `'${surface}', 'skills'`
        );
      }
      expect(content, `${relativePath} should retain source skill fallback`).toContain(
        "'_bmad', 'skills'"
      );
      expect(content, `${relativePath} should resolve global Cursor skills`).toContain(
        "path.join(home, '.cursor', 'skills'"
      );
      expect(content, `${relativePath} should resolve global Claude skills`).toContain(
        "path.join(home, '.claude', 'skills'"
      );
    }
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
      expect(content).toContain('consecutiveNoNewGapRounds: 3');
      expect(content).toContain('pre_render_must_decomposition_gate.js');
    }

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
