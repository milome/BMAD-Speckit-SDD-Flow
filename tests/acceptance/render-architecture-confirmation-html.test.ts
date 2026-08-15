import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  architectureConfirmationHashFor,
  resolveArchitectureConfirmationHashRecipe,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/architecture-confirmation-hash-recipe';

const ROOT = process.cwd();
const SCRIPT = path.join(
  ROOT,
  '_bmad',
  'skills',
  'requirements-contract-authoring',
  'scripts',
  'render-architecture-confirmation-html.ts'
);

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arch-confirm-html-'));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

const requiredArchitectureDiagramTypes = [
  'system_architecture',
  'deployment',
  'class',
  'swimlane',
  'state_machine',
  'sequence',
  'activity',
];

function defaultArchitectureDiagrams(scope = 'business_architecture'): Array<Record<string, unknown>> {
  const isBusiness = scope === 'business_architecture';
  return [
    {
      id: 'ARCH-VIEW-SYSTEM',
      type: 'system_architecture',
      scope,
      title: isBusiness ? 'Display Settings System Architecture Diagram' : 'Governance System Architecture Diagram',
      description: isBusiness
        ? 'Business system boundary for display settings.'
        : 'Requirement-scoped governance system architecture boundary.',
      mermaid:
        isBusiness
          ? 'flowchart LR\n  User[User] --> Widget[DisplaySettingsWidget]\n  Widget --> Dialog[DisplaySettingsDialog]\n  Dialog --> Settings[DisplaySettingsSnapshot]'
          : 'flowchart LR\n  Source[Source Document] --> Artifact[Architecture Artifact]\n  Artifact --> Html[Confirmation HTML]',
      evidenceRefs: ['EVD-036', 'EVD-037'],
      targetPathRefs: ['_bmad/_schemas/requirement-record.schema.json'],
    },
    {
      id: 'ARCH-VIEW-DEPLOYMENT',
      type: 'deployment',
      scope,
      title: 'Deployment Diagram',
      description: 'Runtime and artifact placement.',
      mermaid:
        'flowchart TB\n  Workspace[Consumer Workspace] --> Output[_bmad-output]\n  Package[Installed Package] --> Workspace',
      evidenceRefs: ['EVD-036', 'EVD-037'],
      targetPathRefs: ['src/product/display_settings_widget.py'],
    },
    {
      id: 'ARCH-VIEW-CLASS',
      type: 'class',
      scope,
      title: 'Class Diagram',
      description: 'Core data contracts.',
      mermaid:
        'classDiagram\n  class RequirementRecord\n  class ArchitectureConfirmationArtifact\n  RequirementRecord --> ArchitectureConfirmationArtifact',
      evidenceRefs: ['EVD-036', 'EVD-037'],
      targetPathRefs: ['_bmad/_schemas/requirement-record.schema.json'],
    },
    {
      id: 'ARCH-VIEW-SWIMLANE',
      type: 'swimlane',
      scope,
      title: 'Swimlane Diagram',
      description: 'Responsibilities across user, agent, scripts, and record.',
      mermaid:
        'flowchart LR\n  subgraph UserLane[User]\n    UserConfirm[Review And Confirm]\n  end\n  subgraph AgentLane[Main Agent]\n    Prepare[Prepare Page]\n  end\n  UserConfirm --> Prepare',
      evidenceRefs: ['EVD-036', 'EVD-037'],
      targetPathRefs: ['src/product/display_settings_widget.py'],
    },
    {
      id: 'ARCH-VIEW-STATE',
      type: 'state_machine',
      scope,
      title: 'State Machine Diagram',
      description: 'Architecture confirmation states.',
      mermaid: 'stateDiagram-v2\n  [*] --> Missing\n  Missing --> Draft\n  Draft --> Active',
      evidenceRefs: ['EVD-036', 'EVD-037'],
      targetPathRefs: ['_bmad/_schemas/requirement-record.schema.json'],
    },
    {
      id: 'ARCH-VIEW-SEQUENCE',
      type: 'sequence',
      scope,
      title: 'Sequence Diagram',
      description: 'Prepare and render sequence.',
      mermaid:
        'sequenceDiagram\n  participant Agent\n  participant Producer\n  participant Renderer\n  Agent->>Producer: Generate artifact\n  Producer->>Renderer: Render HTML',
      evidenceRefs: ['EVD-036', 'EVD-037'],
      targetPathRefs: ['src/product/display_settings_widget.py'],
    },
    {
      id: 'ARCH-VIEW-ACTIVITY',
      type: 'activity',
      scope,
      title: 'Activity Diagram',
      description: 'Confirmation activity flow.',
      mermaid:
        'flowchart TD\n  Start([Start]) --> Validate[Validate Inputs]\n  Validate --> Render[Render Confirmation]\n  Render --> Stop([Stop])',
      evidenceRefs: ['EVD-036', 'EVD-037'],
      targetPathRefs: ['src/product/display_settings_widget.py'],
    },
  ].map((diagram) => ({
    ...diagram,
    titleZh: `${isBusiness ? '业务' : '治理'}${diagram.type}架构图`,
    descriptionZh: isBusiness
      ? '由 authoring agent 提供的消费项目业务架构中文说明。'
      : '由 authoring agent 提供的需求治理架构中文说明。',
    mermaidZh: isBusiness
      ? 'flowchart LR\n  用户["用户"] --> 业务界面["业务界面"]\n  业务界面 --> 目标状态["目标状态"]'
      : 'flowchart LR\n  源文档["源文档"] --> 架构工件["架构确认工件"]\n  架构工件 --> 受控写入["受控写入"]',
  }));
}

function writeArchitectureConfirmation(overrides: Record<string, unknown> = {}): string {
  const recipe = resolveArchitectureConfirmationHashRecipe();
  const file = path.join(tempDir, 'architecture-confirmation.json');
  const base: Record<string, unknown> = {
    schemaVersion: 'architecture-confirmation/v1',
    recordId: 'REQ-ARCH-HTML',
    requirementSetId: 'REQ-ARCH-HTML',
    runId: 'arch-confirm-test-001',
    status: 'draft',
    entryFlow: 'standalone_tasks',
    decision: 'full_architecture_confirmed',
    outcome: 'full_architecture_confirmed',
    sourceDocumentHash: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
    implementationConfirmationHash:
      'sha256:2222222222222222222222222222222222222222222222222222222222222222',
    architectureConfirmationHashRecipe: recipe,
    resolvedRecipeHash: recipe.resolvedRecipeHash,
    targetPaths: [
      '_bmad/_schemas/requirement-record.schema.json',
      'src/product/display_settings_widget.py',
    ],
    targetPathsHash: 'sha256:3333333333333333333333333333333333333333333333333333333333333333',
    consumerImpactScan: [
      {
        category: 'data_model',
        categoryZh: '数据模型',
        status: 'triggered',
        statusZh: '已触发',
        summary: 'schema changes require architecture confirmation',
        summaryZh: '模式变更需要架构确认。',
        descriptionZh: '共享数据契约将受到影响。',
        requiredDecisionZh: '确认数据模型所有权和兼容边界。',
      },
      {
        category: 'frontend_ux',
        categoryZh: '前端体验',
        status: 'not_triggered',
        statusZh: '未触发',
        summary: 'no UI change',
        summaryZh: '没有用户界面变更。',
        descriptionZh: '现有界面行为保持不变。',
        requiredDecisionZh: '无需扩大架构范围。',
      },
    ],
    consumerImpactScanHash:
      'sha256:4444444444444444444444444444444444444444444444444444444444444444',
    governanceImpactScan: [
      {
        category: 'orchestration_hook_gate_ingest_rerun_closeout',
        categoryZh: '编排、门禁与受控写入',
        status: 'triggered',
        statusZh: '已触发',
        summary: 'readiness gate and controlled ingest are affected',
        summaryZh: '实施准备门禁和受控写入路径受到影响。',
        descriptionZh: '架构确认必须保持需求范围和 hash 绑定。',
        requiredDecisionZh: '确认治理推进仍由受控事件驱动。',
      },
    ],
    governanceImpactScanHash:
      'sha256:5555555555555555555555555555555555555555555555555555555555555555',
    fullArchitectureTriggerMatrix: [
      {
        trigger: 'shared_schema_or_contract_changed',
        triggerZh: '共享模式或契约发生变更',
        decision: 'triggered',
        decisionZh: '已触发',
        reason: 'record schema is affected',
        reasonZh: '需求记录模式受到影响。',
        requiredDecisionZh: '确认共享契约的兼容和回滚边界。',
      },
      {
        trigger: 'frontend_ux_changed',
        triggerZh: '前端体验发生变更',
        decision: 'not_triggered',
        decisionZh: '未触发',
        reason: 'no user-facing UI change',
        reasonZh: '没有面向用户的界面变更。',
        requiredDecisionZh: '无需扩大架构范围。',
      },
    ],
    riskStatement: 'Fixture architecture risk statement.',
    riskStatementZh: '错误的架构边界可能导致共享契约冲突和不安全的状态推进。',
    rollbackPlan: 'Fixture rollback plan.',
    rollbackPlanZh: '拒绝本次架构确认并基于已确认需求重新生成架构工件。',
    decisionZh: '完整架构待确认',
    outcomeZh: '确认后进入实施准备',
    evidenceRefs: ['EVD-036', 'EVD-037'],
    businessArchitectureDiagrams: defaultArchitectureDiagrams('business_architecture'),
    governanceArchitectureDiagrams: defaultArchitectureDiagrams('governance_architecture'),
    architectureDiagrams: defaultArchitectureDiagrams('business_architecture'),
    staleInputs: {
      sourceDocumentHash: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
      implementationConfirmationHash:
        'sha256:2222222222222222222222222222222222222222222222222222222222222222',
      targetPathsHash: 'sha256:3333333333333333333333333333333333333333333333333333333333333333',
      consumerImpactScanHash:
        'sha256:4444444444444444444444444444444444444444444444444444444444444444',
      governanceImpactScanHash:
        'sha256:5555555555555555555555555555555555555555555555555555555555555555',
      resolvedRecipeHash: recipe.resolvedRecipeHash,
    },
    architectureConfirmationArtifactRef: {
      artifactType: 'architecture_confirmation',
      sourceOfTruthRole: 'evidence',
      path: '_bmad-output/runtime/requirement-records/REQ-ARCH-HTML/architecture/architecture-confirmation.json',
      producer: 'test',
      purpose: 'fixture',
      relatedRequirementIds: ['MUST-035', 'EVD-036'],
      status: 'active',
      inputVersion: 'fixture',
      outputVersion: 'architecture-confirmation-v1',
    },
    ...overrides,
  };
  const hash = architectureConfirmationHashFor(base, recipe);
  base.artifactHash = hash;
  base.architectureConfirmationArtifactHash = hash;
  base.confirmationPhrase = [
    '确认架构确认进入实施准备',
    `sourceDocumentHash=${base.sourceDocumentHash}`,
    `implementationConfirmationHash=${base.implementationConfirmationHash}`,
    `resolvedRecipeHash=${recipe.resolvedRecipeHash}`,
    `architectureConfirmationArtifactHash=${hash}`,
  ].join('\n');
  (base.architectureConfirmationArtifactRef as Record<string, unknown>).hash = hash;
  fs.writeFileSync(file, `${JSON.stringify(base, null, 2)}\n`, 'utf8');
  return file;
}

function runRenderer(args: string[]) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

function runRendererFrom(script: string, cwd: string, args: string[]) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_PATH: path.join(ROOT, 'node_modules'),
    },
  });
}

describe('render-architecture-confirmation-html', () => {
  function canonicalCandidate(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      schemaVersion: 'ArchitectureConfirmationCandidate/v1',
      requestId: 'REQ-ARCH-HTML',
      requirementsLineage: {
        recordId: 'REQ-ARCH-HTML',
        semanticRevisionId: 'semantic-revision-001',
        scopeSemanticHash:
          'sha256:1111111111111111111111111111111111111111111111111111111111111111',
        executionConstraintRegistryHash:
          'sha256:2222222222222222222222222222222222222222222222222222222222222222',
        technicalExecutionClosure: 'pass',
      },
      pinnedPremises: [
        {
          premiseId: 'policy-refund-worker',
          authorityRole: 'policy_authority',
          mediaType: 'application/json',
          sourceSnapshotHash:
            'sha256:3333333333333333333333333333333333333333333333333333333333333333',
        },
        {
          premiseId: 'repo-refund-worker',
          authorityRole: 'repository_authority',
          mediaType: 'application/json',
          sourceSnapshotHash:
            'sha256:4444444444444444444444444444444444444444444444444444444444444444',
        },
      ],
      logicalScope: {
        targetPaths: ['src/refund-worker.ts'],
        forbiddenPaths: ['.git/**'],
      },
      ownership: [
        {
          targetPath: 'src/refund-worker.ts',
          owner: 'requirements_backed_main_agent',
          basisRefs: ['PATH-refund-worker', 'policy-refund-worker'],
        },
      ],
      toolchain: {
        commands: [
          {
            commandId: 'CMD-refund-worker-test',
            invocation: 'npm test -- refund-worker.test.ts',
            basisRefs: ['CMD-refund-worker-test'],
          },
        ],
        artifacts: [
          {
            premiseId: 'ART-refund-worker-output',
            kind: 'ART',
            value: 'dist/refund-worker.js',
            basisRefs: ['ART-refund-worker-output'],
          },
        ],
        evidenceRequirements: [
          {
            premiseId: 'EVDREQ-refund-worker-red-green',
            kind: 'EVDREQ',
            value: 'refund-worker RED/GREEN evidence',
            basisRefs: ['EVDREQ-refund-worker-red-green'],
          },
        ],
      },
      isolation: {
        mode: 'consumer_worktree',
        forbiddenPaths: ['.git/**'],
        basisRefs: ['PATH-refund-worker', 'STOP-refund-worker-forbidden'],
      },
      consumerImpact: [
        {
          impactId: 'consumer:logical-targets',
          status: 'applicable',
          basisRefs: ['PATH-refund-worker', 'repo-refund-worker'],
        },
      ],
      governanceImpact: [
        {
          impactId: 'governance:pinned-policy',
          status: 'applicable',
          basisRefs: ['policy-refund-worker'],
        },
      ],
      triggerMatrix: [
        {
          triggerId: 'architecture:target-scope',
          triggered: true,
          basisRefs: ['PATH-refund-worker'],
        },
        {
          triggerId: 'architecture:toolchain',
          triggered: true,
          basisRefs: ['CMD-refund-worker-test'],
        },
        {
          triggerId: 'architecture:governance',
          triggered: true,
          basisRefs: ['policy-refund-worker'],
        },
        {
          triggerId: 'architecture:execution-structure',
          triggered: true,
          basisRefs: ['CTM-refund-worker-slice'],
        },
      ],
      architectureDecisions: [
        {
          decisionId: 'ARCH-OWNERSHIP-1',
          decisionType: 'ownership',
          selection: 'requirements_backed_main_agent:src/refund-worker.ts',
          basisRefs: ['PATH-refund-worker', 'policy-refund-worker'],
        },
        {
          decisionId: 'ARCH-TOOLCHAIN-1',
          decisionType: 'toolchain',
          selection: 'npm test -- refund-worker.test.ts',
          basisRefs: ['CMD-refund-worker-test'],
        },
        {
          decisionId: 'ARCH-ISOLATION-1',
          decisionType: 'isolation',
          selection: 'consumer_worktree',
          basisRefs: ['PATH-refund-worker', 'STOP-refund-worker-forbidden'],
        },
        {
          decisionId: 'ARCH-STRUCTURE-1',
          decisionType: 'execution_structure',
          selection: 'refund-worker vertical slice',
          basisRefs: ['CTM-refund-worker-slice'],
        },
      ],
      goalExecutionStructurePremises: [
        {
          premiseId: 'CTM-refund-worker-slice',
          kind: 'CTM',
          value: 'refund-worker vertical slice',
          basisRefs: ['CTM-refund-worker-slice'],
        },
      ],
      architectureConfirmationCandidateHash:
        'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      ...overrides,
    };
  }

  function writeCandidate(candidate: Record<string, unknown>): string {
    const source = path.join(tempDir, 'architecture-confirmation-candidate.json');
    fs.writeFileSync(
      source,
      `${JSON.stringify(candidate, null, 2)}\n`,
      'utf8'
    );
    return source;
  }

  function writeCanonicalCandidate(overrides: Record<string, unknown> = {}): string {
    return writeCandidate(canonicalCandidate(overrides));
  }

  it('renders only a canonical ArchitectureConfirmationCandidate projection', () => {
    const source = writeCanonicalCandidate();
    const before = fs.readFileSync(source, 'utf8');
    const out = path.join(tempDir, 'architecture-confirmation.html');
    const result = runRenderer([
      '--architecture-confirmation-candidate',
      source,
      '--out',
      out,
      '--json',
    ]);

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      schemaVersion: 'architecture-confirmation-projection-result/v1',
      ok: true,
      architectureConfirmationCandidateHash:
        'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    });
    expect(fs.existsSync(out)).toBe(true);
    const html = fs.readFileSync(out, 'utf8');
    expect(html).toContain('REQ-ARCH-HTML');
    expect(html).toContain('src/refund-worker.ts');
    expect(html).toContain('.git/**');
    expect(html).toContain('policy-refund-worker');
    expect(html).toContain('repository_authority');
    expect(html).toContain('requirements_backed_main_agent');
    expect(html).toContain('PATH-refund-worker');
    expect(html).toContain('npm test -- refund-worker.test.ts');
    expect(html).toContain('dist/refund-worker.js');
    expect(html).toContain('refund-worker RED/GREEN evidence');
    expect(html).toContain('consumer_worktree');
    expect(html).toContain('consumer:logical-targets');
    expect(html).toContain('governance:pinned-policy');
    expect(html).toContain('architecture:target-scope');
    expect(html).toContain('architecture:toolchain');
    expect(html).toContain('architecture:governance');
    expect(html).toContain('architecture:execution-structure');
    expect(html).toContain('execution_structure');
    expect(html).toContain('refund-worker vertical slice');
    expect(html).toContain(
      'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    );
    expect(html).not.toContain('immutableBlobRef');
    expect(html).not.toContain('citation-refund-worker');
    expect(fs.readFileSync(source, 'utf8')).toBe(before);
    expect(fs.existsSync(path.join(tempDir, 'architecture-confirmation.summary.json'))).toBe(false);
    expect(fs.existsSync(path.join(tempDir, 'architecture-confirmation.render-report.json'))).toBe(
      false
    );
  });

  it('does not recompute candidate identity or currentness', () => {
    const source = writeCanonicalCandidate({
      logicalScope: { targetPaths: ['src/changed-after-hash.ts'], forbiddenPaths: [] },
    });
    const out = path.join(tempDir, 'projection-only.html');
    const result = runRenderer([
      '--architecture-confirmation-candidate',
      source,
      '--out',
      out,
      '--json',
    ]);

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(fs.readFileSync(out, 'utf8')).toContain(
      'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    );
  });

  it('resolves and enforces the candidate schema from an installed consumer package', () => {
    const projectRoot = path.join(tempDir, 'consumer-project');
    const consumerScriptRoot = path.join(
      projectRoot,
      '_bmad',
      'skills',
      'requirements-contract-authoring',
      'scripts'
    );
    fs.cpSync(
      path.join(ROOT, '_bmad', 'skills', 'requirements-contract-authoring'),
      path.join(projectRoot, '_bmad', 'skills', 'requirements-contract-authoring'),
      { recursive: true }
    );
    fs.cpSync(
      path.join(ROOT, '_bmad', 'shared', 'skill-runtime'),
      path.join(projectRoot, '_bmad', 'shared', 'skill-runtime'),
      { recursive: true }
    );
    const consumerScript = path.join(consumerScriptRoot, path.basename(SCRIPT));

    const installedPackageRoot = path.join(projectRoot, 'node_modules', 'bmad-speckit');
    fs.mkdirSync(installedPackageRoot, { recursive: true });
    fs.writeFileSync(
      path.join(installedPackageRoot, 'package.json'),
      `${JSON.stringify({ name: 'bmad-speckit', version: '0.0.0' }, null, 2)}\n`,
      'utf8'
    );
    const installedSchema = path.join(
      installedPackageRoot,
      'dist',
      'main-agent',
      'source-authority',
      'schemas',
      'architecture-confirmation-candidate.schema.json'
    );
    fs.mkdirSync(path.dirname(installedSchema), { recursive: true });
    fs.copyFileSync(
      path.join(
        ROOT,
        'packages',
        'bmad-speckit',
        'src',
        'main-agent',
        'source-authority',
        'schemas',
        'main-agent-architecture-confirmation-candidate.schema.json'
      ),
      installedSchema
    );

    const candidatePath = path.join(projectRoot, 'candidate.json');
    fs.writeFileSync(
      candidatePath,
      `${JSON.stringify(canonicalCandidate(), null, 2)}\n`,
      'utf8'
    );
    const validOut = path.join(projectRoot, 'valid.html');
    const valid = runRendererFrom(consumerScript, projectRoot, [
      '--architecture-confirmation-candidate',
      candidatePath,
      '--out',
      validOut,
      '--json',
    ]);

    expect(valid.status, `${valid.stdout}\n${valid.stderr}`).toBe(0);
    expect(fs.readFileSync(validOut, 'utf8')).toContain('refund-worker vertical slice');

    const incomplete = canonicalCandidate();
    delete incomplete.ownership;
    fs.writeFileSync(candidatePath, `${JSON.stringify(incomplete, null, 2)}\n`, 'utf8');
    const invalidOut = path.join(projectRoot, 'invalid.html');
    const invalid = runRendererFrom(consumerScript, projectRoot, [
      '--architecture-confirmation-candidate',
      candidatePath,
      '--out',
      invalidOut,
      '--json',
    ]);

    expect(invalid.status).toBe(2);
    expect(invalid.stderr).toContain('architecture_confirmation_candidate_schema_invalid');
    expect(fs.existsSync(invalidOut)).toBe(false);
  });

  it('HTML-escapes every displayed free-text technical field', () => {
    const source = writeCanonicalCandidate({
      pinnedPremises: [
        {
          premiseId: 'policy-refund-worker',
          authorityRole: 'policy_authority',
          mediaType: 'application/json; profile="<policy>&"',
          sourceSnapshotHash:
            'sha256:3333333333333333333333333333333333333333333333333333333333333333',
        },
      ],
      logicalScope: {
        targetPaths: ['src/refund<worker>&"quoted".ts'],
        forbiddenPaths: ['.git/<private>&"quoted"/**'],
      },
      ownership: [
        {
          targetPath: 'src/refund<worker>&"quoted".ts',
          owner: 'requirements_backed_main_agent',
          basisRefs: ['PATH-refund-worker', 'policy-refund-worker'],
        },
      ],
      toolchain: {
        commands: [
          {
            commandId: 'CMD-refund-worker-test',
            invocation: 'npm test -- "refund<worker>&quoted"',
            basisRefs: ['CMD-refund-worker-test'],
          },
        ],
        artifacts: [
          {
            premiseId: 'ART-refund-worker-output',
            kind: 'ART',
            value: 'dist/refund<worker>&"quoted".js',
            basisRefs: ['ART-refund-worker-output'],
          },
        ],
        evidenceRequirements: [
          {
            premiseId: 'EVDREQ-refund-worker-red-green',
            kind: 'EVDREQ',
            value: 'refund<worker>&"quoted" evidence',
            basisRefs: ['EVDREQ-refund-worker-red-green'],
          },
        ],
      },
      isolation: {
        mode: 'consumer_worktree',
        forbiddenPaths: ['.git/<private>&"quoted"/**'],
        basisRefs: ['PATH-refund-worker', 'STOP-refund-worker-forbidden'],
      },
      architectureDecisions: [
        {
          decisionId: 'ARCH-STRUCTURE-1',
          decisionType: 'execution_structure',
          selection: 'refund<worker>&"quoted" structure',
          basisRefs: ['CTM-refund-worker-slice'],
        },
      ],
      goalExecutionStructurePremises: [
        {
          premiseId: 'CTM-refund-worker-slice',
          kind: 'CTM',
          value: 'refund<worker>&"quoted" slice',
          basisRefs: ['CTM-refund-worker-slice'],
        },
      ],
    });
    const out = path.join(tempDir, 'escaped-projection.html');
    const result = runRenderer([
      '--architecture-confirmation-candidate',
      source,
      '--out',
      out,
      '--json',
    ]);

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const html = fs.readFileSync(out, 'utf8');
    expect(html).toContain('src/refund&lt;worker&gt;&amp;&quot;quoted&quot;.ts');
    expect(html).toContain('.git/&lt;private&gt;&amp;&quot;quoted&quot;/**');
    expect(html).toContain('application/json; profile=&quot;&lt;policy&gt;&amp;&quot;');
    expect(html).toContain('npm test -- &quot;refund&lt;worker&gt;&amp;quoted&quot;');
    expect(html).toContain('dist/refund&lt;worker&gt;&amp;&quot;quoted&quot;.js');
    expect(html).toContain('refund&lt;worker&gt;&amp;&quot;quoted&quot; evidence');
    expect(html).toContain('refund&lt;worker&gt;&amp;&quot;quoted&quot; structure');
    expect(html).toContain('refund&lt;worker&gt;&amp;&quot;quoted&quot; slice');
    expect(html).not.toContain('refund<worker>');
  });

  it('fails closed on the legacy architecture artifact input', () => {
    const source = writeArchitectureConfirmation();
    const out = path.join(tempDir, 'legacy-architecture-confirmation.html');
    const result = runRenderer([
      '--architecture-confirmation',
      source,
      '--out',
      out,
      '--json',
    ]);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('caller_derived_input_forbidden:architecture-confirmation');
    expect(fs.existsSync(out)).toBe(false);
  });

  it('fails closed when the projection input is not the canonical candidate schema', () => {
    const source = writeCanonicalCandidate({ schemaVersion: 'ArchitectureConfirmation/v1' });
    const out = path.join(tempDir, 'invalid-candidate.html');
    const result = runRenderer([
      '--architecture-confirmation-candidate',
      source,
      '--out',
      out,
      '--json',
    ]);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('architecture_confirmation_candidate_schema_invalid');
    expect(fs.existsSync(out)).toBe(false);
  });

  it.each([
    'schemaVersion',
    'requestId',
    'requirementsLineage',
    'pinnedPremises',
    'logicalScope',
    'ownership',
    'toolchain',
    'isolation',
    'consumerImpact',
    'governanceImpact',
    'triggerMatrix',
    'architectureDecisions',
    'goalExecutionStructurePremises',
    'architectureConfirmationCandidateHash',
  ])('fails closed when required candidate field %s is missing', (field) => {
    const candidate = canonicalCandidate();
    delete candidate[field];
    const source = writeCandidate(candidate);
    const out = path.join(tempDir, `missing-${field}.html`);
    const result = runRenderer([
      '--architecture-confirmation-candidate',
      source,
      '--out',
      out,
      '--json',
    ]);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('architecture_confirmation_candidate_schema_invalid');
    expect(fs.existsSync(out)).toBe(false);
  });
});
