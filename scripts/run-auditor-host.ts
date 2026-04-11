/* eslint-disable no-console, @typescript-eslint/no-require-imports */

import { execSync } from 'child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseBmadAuditResult } from './parse-bmad-audit-result';
import { mainAuditorPostActions } from './auditor-post-actions';
const { scoreCommand: defaultScoreCommand } =
  require('../packages/bmad-speckit/src/commands/score.js') as {
    scoreCommand: (opts: Record<string, unknown>) => Promise<unknown>;
  };

interface RunAuditorHostInput {
  projectRoot: string;
  stage: string;
  artifactPath: string;
  reportPath?: string;
  iterationCount?: string | number;
}

interface RunAuditorHostDeps {
  scoreCommand?: (opts: Record<string, unknown>) => Promise<unknown>;
  executeAuditorScript?: (args: {
    projectRoot: string;
    auditorScript: string;
    artifactPath: string;
    iteration: string;
  }) => void;
}

function parseArgs(argv: string[]): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--projectRoot' && argv[i + 1]) {
      out.projectRoot = argv[++i];
    } else if (token === '--stage' && argv[i + 1]) {
      out.stage = argv[++i];
    } else if (token === '--artifactPath' && argv[i + 1]) {
      out.artifactPath = argv[++i];
    } else if (token === '--reportPath' && argv[i + 1]) {
      out.reportPath = argv[++i];
    } else if (token === '--iterationCount' && argv[i + 1]) {
      out.iterationCount = argv[++i];
    }
  }
  return out;
}

const SCORE_STAGE_MAP: Record<string, string> = {
  story: 'story',
  spec: 'spec',
  plan: 'plan',
  gaps: 'gaps',
  tasks: 'tasks',
  implement: 'implement',
  bugfix: 'implement',
  document: 'tasks',
  standalone_tasks: 'tasks',
};

const TRIGGER_STAGE_MAP: Record<string, string> = {
  story: 'bmad_story_stage2',
  spec: 'speckit_1_2',
  plan: 'speckit_2_2',
  gaps: 'speckit_3_2',
  tasks: 'speckit_4_2',
  implement: 'speckit_5_2',
  bugfix: 'speckit_5_2',
  document: 'speckit_4_2',
  standalone_tasks: 'speckit_4_2',
};

const AUDITOR_SCRIPT_MAP: Record<string, string> = {
  story: 'auditor-document',
  spec: 'auditor-spec',
  plan: 'auditor-plan',
  gaps: 'auditor-gaps',
  tasks: 'auditor-tasks',
  implement: 'auditor-implement',
  bugfix: 'auditor-bugfix',
  document: 'auditor-tasks-doc',
  standalone_tasks: 'auditor-tasks-doc',
};

function inferScoreStage(stage: string, artifactDocPath?: string): string {
  const mapped = SCORE_STAGE_MAP[stage];
  if (mapped) {
    return mapped;
  }
  if (/tasks/i.test(artifactDocPath ?? '')) {
    return 'tasks';
  }
  if (/gaps/i.test(artifactDocPath ?? '')) {
    return 'gaps';
  }
  if (/plan/i.test(artifactDocPath ?? '')) {
    return 'plan';
  }
  if (/spec/i.test(artifactDocPath ?? '')) {
    return 'spec';
  }
  return 'implement';
}

function inferTriggerStage(stage: string): string | undefined {
  return TRIGGER_STAGE_MAP[stage];
}

function inferEvent(stage: string): string {
  if (stage === 'story') {
    return 'story_status_change';
  }
  return 'stage_audit_complete';
}

function resolveDefaultReportPath(stage: string, artifactPath: string): string {
  if (stage === 'spec' || stage === 'plan' || stage === 'tasks') {
    return artifactPath.replace(/\.md$/i, '-audit.md');
  }
  return artifactPath.replace(/\.md$/i, '.audit.md');
}

export async function runAuditorHost(
  input: RunAuditorHostInput,
  deps: RunAuditorHostDeps = {}
): Promise<{ status: 'PASS' | 'FAIL' | 'UNKNOWN' }> {
  const resolvedReportPath =
    input.reportPath ?? resolveDefaultReportPath(input.stage, input.artifactPath);

  const auditor = AUDITOR_SCRIPT_MAP[input.stage];
  const auditorScript = auditor
    ? path.resolve(input.projectRoot, `scripts/${auditor}.ts`)
    : undefined;

  if (!fs.existsSync(resolvedReportPath)) {
    if (!auditorScript || !fs.existsSync(auditorScript)) {
      throw new Error(
        `missing audit report at ${resolvedReportPath} and no local auditor script is available for stage=${input.stage}`
      );
    }
    const iteration = String(input.iterationCount ?? '1');
    const executeAuditorScript =
      deps.executeAuditorScript ??
      ((args: {
        projectRoot: string;
        auditorScript: string;
        artifactPath: string;
        iteration: string;
      }) => {
        execSync(`npx ts-node ${args.auditorScript} ${args.artifactPath} ${args.iteration}`, {
          cwd: args.projectRoot,
          stdio: 'inherit',
        });
      });
    executeAuditorScript({
      projectRoot: input.projectRoot,
      auditorScript,
      artifactPath: input.artifactPath,
      iteration,
    });
  }

  const content = fs.readFileSync(resolvedReportPath, 'utf8');
  const parsed = parseBmadAuditResult(content);
  const status = parsed.status ?? 'UNKNOWN';

  const scoreCommand = deps.scoreCommand ?? defaultScoreCommand;
  if (parsed.scoreTriggerPresent && scoreCommand) {
    await scoreCommand({
      reportPath: resolvedReportPath,
      stage: inferScoreStage(input.stage, parsed.artifactDocPath),
      artifactDocPath: parsed.artifactDocPath,
      event: inferEvent(input.stage),
      triggerStage: inferTriggerStage(input.stage),
      iterationCount: String(input.iterationCount ?? parsed.iterationCount ?? '0'),
      skipTriggerCheck: true,
    });
  }

  mainAuditorPostActions([
    '--projectRoot',
    input.projectRoot,
    '--reportPath',
    resolvedReportPath,
    '--stage',
    input.stage,
  ]);

  return { status };
}

export async function mainRunAuditorHost(argv: string[]): Promise<number> {
  const args = parseArgs(argv);
  const projectRoot = args.projectRoot?.trim();
  const stage = args.stage?.trim();
  const artifactPath = args.artifactPath?.trim();

  if (!projectRoot || !stage || !artifactPath) {
    console.error(
      'run-auditor-host: usage --projectRoot <path> --stage <stage> --artifactPath <path> [--reportPath <path>] [--iterationCount <n>]'
    );
    return 1;
  }

  try {
    const result = await runAuditorHost({
      projectRoot,
      stage,
      artifactPath,
      reportPath: args.reportPath,
      iterationCount: args.iterationCount,
    });
    process.stdout.write(JSON.stringify(result));
    return result.status === 'PASS' ? 0 : 1;
  } catch (error) {
    console.error(`run-auditor-host: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

if (require.main === module) {
  mainRunAuditorHost(process.argv.slice(2)).then((code) => process.exit(code));
}
