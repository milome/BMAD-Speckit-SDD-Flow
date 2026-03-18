import { readFileSync } from 'node:fs';
import { loadConfig, getCurrentMode, getStageConfig, getSubagentParams, type StageName } from './bmad-config';

const CURSOR_RULE_PATH = '.cursor/rules/bmad-story-assistant.mdc';
const REQUIRED_KEYWORDS = [
  '--audit-granularity',
  'BMAD_AUDIT_GRANULARITY',
  'mcp_task',
  'generalPurpose',
  'shouldAudit',
  'getStageConfig',
  'full',
  'story',
  'epic',
  'basic',
  'test_only',
] as const;

const STAGES: StageName[] = [
  'story_create',
  'story_audit',
  'specify',
  'plan',
  'gaps',
  'tasks',
  'implement',
  'post_audit',
  'epic_create',
  'epic_complete',
];

function readCursorRule(): string {
  return readFileSync(CURSOR_RULE_PATH, 'utf8');
}

function classifyStage(stage: StageName, config = loadConfig()): 'AUDIT' | 'VALIDATE' | 'SKIP' {
  const stageConfig = getStageConfig(stage, config);
  if (stageConfig?.audit) {
    return 'AUDIT';
  }
  if (stageConfig?.validation) {
    return 'VALIDATE';
  }
  return 'SKIP';
}

function main(): void {
  process.env.BMAD_PLATFORM = 'cursor';

  const rule = readCursorRule();
  const missingKeywords = REQUIRED_KEYWORDS.filter((keyword) => !rule.includes(keyword));

  if (missingKeywords.length > 0) {
    console.error('❌ Cursor 规则缺少关键字:');
    for (const keyword of missingKeywords) {
      console.error(`  - ${keyword}`);
    }
    process.exit(1);
  }

  const config = loadConfig();
  const mode = getCurrentMode(config);
  const subagentParams = getSubagentParams(config);

  console.log('========================================');
  console.log('Cursor Audit Granularity Verification');
  console.log('========================================');
  console.log(`Mode: ${mode}`);
  console.log(`Tool: ${subagentParams.tool}`);
  console.log(`Subagent Type: ${subagentParams.subagent_type}`);
  console.log('');
  console.log('Stage Routing Matrix:');

  for (const stage of STAGES) {
    const stageConfig = getStageConfig(stage, config);
    const route = classifyStage(stage, config);
    const validation = stageConfig?.validation ?? 'null';
    console.log(`- ${stage}: ${route} (validation=${validation})`);
  }

  console.log('');
  console.log('✅ Cursor audit granularity verification passed');
}

main();
