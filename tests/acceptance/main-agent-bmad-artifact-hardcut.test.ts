import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mainBmadArtifactHardcut } from '../../scripts/main-agent-bmad-artifact-hardcut';

function writeFile(filePath: string, value: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, 'utf8');
}

function writeJson(filePath: string, value: unknown): void {
  writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeBmadFixture(root: string): void {
  writeFile(
    path.join(root, '_bmad', '_config', 'bmad-help.csv'),
    [
      'module,phase,name,code,sequence,workflow-file,command,required,agent-name,agent-command,agent-display-name,agent-title,options,description,output-location,outputs',
      'bmm,2-planning,Create PRD,CP,10,_bmad/workflow.md,bmad-create-prd,true,pm,bmad-agent-pm,John,PM,,Create PRD,planning_artifacts,prd',
      'bmm,2-planning,Create Architecture,CA,20,_bmad/workflow.md,bmad-create-architecture,true,architect,bmad-agent-architect,Winston,Architect,,Create architecture,planning_artifacts,architecture',
      'bmm,3-planning,Create Epics,CE,30,_bmad/workflow.md,bmad-create-epics,true,pm,bmad-agent-pm,John,PM,,Create epics,planning_artifacts,epics',
      'bmm,4-build,Create Story,CS,40,_bmad/workflow.md,bmad-create-story,true,sm,bmad-agent-sm,Bob,SM,,Create story,implementation_artifacts,story',
      '',
    ].join('\n')
  );
  writeFile(
    path.join(root, '_bmad', 'core', 'skills', 'bmad-help', 'workflow.md'),
    [
      '# Task: BMAD Help',
      '## ROUTING RULES',
      '- Artifacts reveal completion by searching output paths.',
      '## OFFICIAL EXECUTION PATHS',
      '- Catalog source is _bmad/_config/bmad-help.csv.',
      '',
    ].join('\n')
  );
  writeFile(
    path.join(root, '_bmad', 'bmm', 'config.yaml'),
    [
      'planning_artifacts: "{project-root}/_bmad-output/planning-artifacts"',
      'implementation_artifacts: "{project-root}/_bmad-output/implementation-artifacts"',
      '',
    ].join('\n')
  );
  writeFile(
    path.join(root, '_bmad', '_config', 'stage-mapping.yaml'),
    [
      'layer_to_stages:',
      '  layer_1:',
      '    stages: [prd]',
      '  layer_2:',
      '    stages: [arch]',
      '  layer_3:',
      '    stages: [epics, story]',
      '  layer_4:',
      '    stages: [specify, plan, gaps, tasks, implement]',
      '  layer_5:',
      '    stages: [post_impl, pr_review, release_gate, delivery_truth_gate]',
      '',
    ].join('\n')
  );
}

function writeRecord(root: string, artifacts: Array<Record<string, unknown>> = []): string {
  const recordPath = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    'REQ-HARDCUT',
    'requirement-record.json'
  );
  writeJson(recordPath, {
    recordId: 'REQ-HARDCUT',
    requirementSetId: 'REQ-HARDCUT',
    sourceDocumentHash: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
    implementationConfirmationHash: 'sha256:2222222222222222222222222222222222222222222222222222222222222222',
    architectureConfirmationState: {
      status: 'active',
      currentArchitectureConfirmationHash: 'sha256:3333333333333333333333333333333333333333333333333333333333333333',
    },
    artifactIndex: artifacts,
  });
  return recordPath;
}

describe('main-agent BMAD artifact hardcut', () => {
  it('passes when BMAD authoring paths are preserved and new runtime artifacts are requirement-scoped', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'bmad-hardcut-pass-'));
    try {
      writeBmadFixture(root);
      const recordPath = writeRecord(root, [
        {
          artifactType: 'bmad_story_doc',
          sourceOfTruthRole: 'evidence',
          path: '_bmad-output/implementation-artifacts/epic-1/story-1/story.md',
          status: 'active',
        },
        {
          artifactType: 'bmad_workflow_projection',
          sourceOfTruthRole: 'projection',
          path: '_bmad-output/runtime/requirement-records/REQ-HARDCUT/workflow/bmad-workflow-routing-run-1.json',
          status: 'active',
        },
        {
          artifactType: 'requirement_record_schema',
          sourceOfTruthRole: 'schema',
          path: 'docs/reference/requirement-record.schema.json',
          status: 'active',
        },
      ]);
      const outPath = path.join(root, 'report.json');
      const code = mainBmadArtifactHardcut([
        '--project-root',
        root,
        '--requirement-record',
        recordPath,
        '--out',
        outPath,
        '--generated-at',
        '2026-05-19T00:00:00.000Z',
        '--json',
      ]);

      expect(code).toBe(0);
      expect(existsSync(outPath)).toBe(true);
      const report = JSON.parse(readFileSync(outPath, 'utf8'));
      expect(report.decision).toBe('pass');
      expect(report.checks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'bmad-catalog-loaded', decision: 'pass' }),
          expect.objectContaining({ id: 'bmad-native-workflow-preserved', decision: 'pass' }),
          expect.objectContaining({ id: 'artifact-boundary-hardcut', decision: 'pass' }),
        ])
      );
      expect(report.hardcutMatrix).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            pathPattern: '_bmad-output/runtime/bmad-help-five-layer/**',
            targetState: 'forbidden_for_new_outputs',
          }),
        ])
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks active legacy runtime artifacts and docs/reference completion evidence', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'bmad-hardcut-block-'));
    try {
      writeBmadFixture(root);
      const recordPath = writeRecord(root, [
        {
          artifactType: 'legacy_gate_report',
          sourceOfTruthRole: 'evidence',
          path: '_bmad-output/runtime/gates/main-agent-release-gate-report.json',
          status: 'active',
        },
        {
          artifactType: 'runtime_schema',
          sourceOfTruthRole: 'evidence',
          path: 'docs/reference/runtime-context.schema.json',
          status: 'active',
        },
      ]);
      const outPath = path.join(root, 'report.json');
      const code = mainBmadArtifactHardcut([
        '--project-root',
        root,
        '--requirement-record',
        recordPath,
        '--out',
        outPath,
      ]);

      expect(code).toBe(1);
      const report = JSON.parse(readFileSync(outPath, 'utf8'));
      expect(report.decision).toBe('blocked');
      expect(report.blockingIssues).toEqual(
        expect.arrayContaining([
          'legacy_runtime_artifact_still_active:_bmad-output/runtime/gates/main-agent-release-gate-report.json',
          'docs_reference_cannot_be_completion_evidence:docs/reference/runtime-context.schema.json',
        ])
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks when BMAD native workflow recommendation sources are missing', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'bmad-hardcut-no-workflow-'));
    try {
      writeBmadFixture(root);
      rmSync(path.join(root, '_bmad', 'core', 'skills', 'bmad-help', 'workflow.md'), { force: true });
      const recordPath = writeRecord(root);
      const outPath = path.join(root, 'report.json');
      const code = mainBmadArtifactHardcut([
        '--project-root',
        root,
        '--requirement-record',
        recordPath,
        '--out',
        outPath,
      ]);

      expect(code).toBe(1);
      const report = JSON.parse(readFileSync(outPath, 'utf8'));
      expect(report.checks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'bmad-native-workflow-preserved', decision: 'blocked' }),
        ])
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
