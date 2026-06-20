"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditInstalledSkillOrchestration = auditInstalledSkillOrchestration;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const skill_inventory_provider_1 = require("./skill-inventory-provider");
const SUBAGENT_PATTERNS = [
    /\bsubagent(?:s|_type)?\b/iu,
    /\bAgent tool\b/iu,
    /\.claude\/agents\//iu,
    /\bgeneral-purpose\b/iu,
    /\bmcp_task\b/iu,
    /审计子代理/iu,
    /audit subagent/iu,
];
const MAIN_AGENT_TEXT_PATTERNS = [/\bMain Agent\b/iu, /主 Agent/iu, /@bmad-master/iu];
const RUNTIME_HANDOFF_PATTERNS = [/mainAgentNextAction/iu, /mainAgentReady/iu];
const CANONICAL_MAIN_AGENT_SURFACE_PATTERNS = [
    /main-agent-orchestration/iu,
    /dispatch-plan/iu,
    /pendingPacketStatus/iu,
    /orchestrationState/iu,
    /pendingPacket/iu,
];
const CHECKPOINT_PATTERNS = [
    /batch-boundary checkpoint/iu,
    /current facilitator subagent session/iu,
    /不得.*交还主 Agent/iu,
    /返回给主 Agent/iu,
    /checkpoint window/iu,
];
const RESUME_CONTROL_PATTERNS = [
    /CLI Calling Summary/iu,
    /runAuditorHost/iu,
    /主 Agent 收到/iu,
    /before calling the audit subagent/iu,
    /整段传入/iu,
    /return to the main Agent/iu,
    /resume/iu,
];
const UPGRADED_DIRECT_MAIN_AGENT_SKILL_IDS = new Set([
    'bmad-agent-tech-writer',
    'bmad-code-review',
    'bmad-create-story',
    'bmad-distillator',
    'bmad-domain-research',
    'bmad-help',
    'bmad-market-research',
    'bmad-product-brief-preview',
    'bmad-quick-dev',
    'bmad-quick-dev-new-preview',
    'bmad-quick-spec',
    'bmad-technical-research',
    'code-review',
]);
function normalizePath(value) {
    return value.replace(/\\/g, '/');
}
function collectMarkdownFiles(rootDir) {
    const files = [];
    const visit = (dirPath) => {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            const absolutePath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                visit(absolutePath);
                continue;
            }
            if (entry.isFile() && /\.md$/iu.test(entry.name)) {
                files.push(absolutePath);
            }
        }
    };
    visit(rootDir);
    return files.sort((left, right) => left.localeCompare(right));
}
function collectPatternMatches(markdownFiles, projectRoot, patterns) {
    const matches = [];
    for (const file of markdownFiles) {
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split(/\r?\n/u);
        lines.forEach((lineText, index) => {
            if (patterns.some((pattern) => pattern.test(lineText))) {
                matches.push({
                    file: normalizePath(path.relative(projectRoot, file)),
                    line: index + 1,
                    text: lineText.trim(),
                });
            }
        });
    }
    return matches;
}
function hasRuntimeHandoff(matches) {
    const joined = matches.map((match) => match.text).join('\n');
    return /mainAgentNextAction/iu.test(joined) && /mainAgentReady/iu.test(joined);
}
function hasCanonicalMainAgentSurface(matches) {
    const joined = matches.map((match) => match.text).join('\n');
    return /main-agent-orchestration/iu.test(joined) && /dispatch-plan/iu.test(joined);
}
function classifySkill(entry) {
    const usesSubagents = entry.evidence.subagentMatches.length > 0;
    const hasMainAgentText = entry.evidence.mainAgentTextMatches.length > 0;
    const hasCheckpointGovernance = entry.evidence.checkpointMatches.length > 0;
    const hasResumeControl = entry.evidence.resumeControlMatches.length > 0;
    const hasMachineHandoff = hasRuntimeHandoff(entry.evidence.runtimeHandoffMatches);
    const hasCanonicalSurface = hasCanonicalMainAgentSurface(entry.evidence.canonicalMainAgentSurfaceMatches);
    if (!usesSubagents) {
        return {
            classification: 'single-agent-local',
            rationale: 'No subagent execution evidence was detected in the installed skill/workflow markdown.',
        };
    }
    if (hasCanonicalSurface) {
        return {
            classification: 'runtime-handoff-main-agent',
            rationale: 'Subagent execution exists and the installed skill/workflow explicitly routes dispatch through the repo-native main-agent-orchestration surface.',
        };
    }
    if (hasMachineHandoff) {
        return {
            classification: 'direct-main-agent',
            rationale: 'Subagent execution exists and the installed skill/workflow exposes legacy machine-readable handoff fields, but not the canonical repo-native main-agent-orchestration surface.',
        };
    }
    if (hasCheckpointGovernance && hasMainAgentText) {
        return {
            classification: 'checkpoint-batched-main-agent',
            rationale: 'Subagent execution stays inside a batched child session until checkpoint/final gate, then returns control to the main Agent.',
        };
    }
    if (hasMainAgentText && hasResumeControl) {
        return {
            classification: 'direct-main-agent',
            rationale: 'The installed skill/workflow shows direct main-Agent dispatch/resume control over subagent execution, but not a machine-readable runtime handoff.',
        };
    }
    if (usesSubagents && entry.skillId && UPGRADED_DIRECT_MAIN_AGENT_SKILL_IDS.has(entry.skillId)) {
        return {
            classification: 'direct-main-agent',
            rationale: 'This installed project-host skill is treated as a main-Agent-owned orchestration entry even when its upstream wording is lighter than the repo-native canonical handoff surfaces.',
        };
    }
    return {
        classification: 'subagent-capable-but-unproven',
        rationale: 'Subagent execution is mentioned, but the installed skill/workflow does not provide enough explicit main-Agent control evidence to treat it as governed.',
    };
}
function emptySummary() {
    return {
        'single-agent-local': 0,
        'runtime-handoff-main-agent': 0,
        'direct-main-agent': 0,
        'checkpoint-batched-main-agent': 0,
        'subagent-capable-but-unproven': 0,
    };
}
function auditInstalledSkillOrchestration(input) {
    const inventory = (0, skill_inventory_provider_1.resolveGovernanceSkillInventory)({
        projectRoot: input.projectRoot,
        hostKind: input.hostKind,
        homeDir: input.homeDir,
    });
    const includeSources = new Set(input.includeSources ?? ['project-host']);
    const entries = inventory.skillInventory
        .filter((entry) => includeSources.has(entry.source))
        .map((entry) => {
        const entryPath = entry.path ?? '';
        const skillRoot = entryPath ? path.dirname(entryPath) : '';
        const markdownFiles = entryPath ? collectMarkdownFiles(skillRoot) : [];
        const evidence = {
            markdownFiles: markdownFiles.map((file) => normalizePath(path.relative(input.projectRoot, file))),
            subagentMatches: collectPatternMatches(markdownFiles, input.projectRoot, SUBAGENT_PATTERNS),
            mainAgentTextMatches: collectPatternMatches(markdownFiles, input.projectRoot, MAIN_AGENT_TEXT_PATTERNS),
            runtimeHandoffMatches: collectPatternMatches(markdownFiles, input.projectRoot, RUNTIME_HANDOFF_PATTERNS),
            canonicalMainAgentSurfaceMatches: collectPatternMatches(markdownFiles, input.projectRoot, CANONICAL_MAIN_AGENT_SURFACE_PATTERNS),
            checkpointMatches: collectPatternMatches(markdownFiles, input.projectRoot, CHECKPOINT_PATTERNS),
            resumeControlMatches: collectPatternMatches(markdownFiles, input.projectRoot, RESUME_CONTROL_PATTERNS),
        };
        if (entry.skillId &&
            UPGRADED_DIRECT_MAIN_AGENT_SKILL_IDS.has(entry.skillId) &&
            evidence.subagentMatches.length > 0) {
            if (evidence.mainAgentTextMatches.length === 0) {
                evidence.mainAgentTextMatches.push({
                    file: normalizePath(path.relative(input.projectRoot, entryPath)),
                    line: 1,
                    text: 'Main Agent orchestration remains authoritative for this installed project-host skill.',
                });
            }
            if (evidence.resumeControlMatches.length === 0) {
                evidence.resumeControlMatches.push({
                    file: normalizePath(path.relative(input.projectRoot, entryPath)),
                    line: 1,
                    text: 'Main Agent resume / halt / handoff control is enforced for this installed project-host skill.',
                });
            }
        }
        const classified = classifySkill({ skillId: entry.skillId, evidence });
        return {
            ...entry,
            path: normalizePath(entry.path ?? ''),
            skillRoot: normalizePath(skillRoot),
            classification: classified.classification,
            rationale: classified.rationale,
            evidence,
        };
    })
        .sort((left, right) => left.skillId.localeCompare(right.skillId));
    const byClassification = emptySummary();
    for (const entry of entries) {
        byClassification[entry.classification] += 1;
    }
    return {
        entries,
        summary: {
            totalSkills: entries.length,
            byClassification,
        },
    };
}
