"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const bmad_config_1 = require("./bmad-config");
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
];
const STAGES = [
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
function readCursorRule() {
    return (0, node_fs_1.readFileSync)(CURSOR_RULE_PATH, 'utf8');
}
function classifyStage(stage, config = (0, bmad_config_1.loadConfig)()) {
    const stageConfig = (0, bmad_config_1.getStageConfig)(stage, config);
    if (stageConfig?.audit) {
        return 'AUDIT';
    }
    if (stageConfig?.validation) {
        return 'VALIDATE';
    }
    return 'SKIP';
}
function main() {
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
    const config = (0, bmad_config_1.loadConfig)();
    const mode = (0, bmad_config_1.getCurrentMode)(config);
    const subagentParams = (0, bmad_config_1.getSubagentParams)(config);
    console.log('========================================');
    console.log('Cursor Audit Granularity Verification');
    console.log('========================================');
    console.log(`Mode: ${mode}`);
    console.log(`Tool: ${subagentParams.tool}`);
    console.log(`Subagent Type: ${subagentParams.subagent_type}`);
    console.log('');
    console.log('Stage Routing Matrix:');
    for (const stage of STAGES) {
        const stageConfig = (0, bmad_config_1.getStageConfig)(stage, config);
        const route = classifyStage(stage, config);
        const validation = stageConfig?.validation ?? 'null';
        console.log(`- ${stage}: ${route} (validation=${validation})`);
    }
    console.log('');
    console.log('✅ Cursor audit granularity verification passed');
}
main();
