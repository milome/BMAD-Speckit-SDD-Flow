import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  resolveGovernanceSkillInventory,
  type HostSkillInventoryEntry,
  type SkillInventorySource,
} from './skill-inventory-provider';
import type { GovernanceHostKind } from './governance-remediation-runner';

export type SkillOrchestrationClassification =
  | 'single-agent-local'
  | 'runtime-handoff-main-agent'
  | 'direct-main-agent'
  | 'checkpoint-batched-main-agent'
  | 'subagent-capable-but-unproven';

export interface SkillTextEvidenceMatch {
  file: string;
  line: number;
  text: string;
}

export interface SkillOrchestrationEvidence {
  markdownFiles: string[];
  subagentMatches: SkillTextEvidenceMatch[];
  mainAgentTextMatches: SkillTextEvidenceMatch[];
  runtimeHandoffMatches: SkillTextEvidenceMatch[];
  canonicalMainAgentSurfaceMatches: SkillTextEvidenceMatch[];
  checkpointMatches: SkillTextEvidenceMatch[];
  resumeControlMatches: SkillTextEvidenceMatch[];
}

export interface SkillOrchestrationAuditEntry extends HostSkillInventoryEntry {
  skillRoot: string;
  classification: SkillOrchestrationClassification;
  rationale: string;
  evidence: SkillOrchestrationEvidence;
}

export interface SkillOrchestrationAuditSummary {
  totalSkills: number;
  byClassification: Record<SkillOrchestrationClassification, number>;
}

export interface SkillOrchestrationAuditResult {
  entries: SkillOrchestrationAuditEntry[];
  summary: SkillOrchestrationAuditSummary;
}

export interface AuditInstalledSkillOrchestrationInput {
  projectRoot: string;
  hostKind: GovernanceHostKind;
  includeSources?: SkillInventorySource[];
  homeDir?: string;
}

const SUBAGENT_PATTERNS = [
  /\bsubagent(?:s|_type)?\b/iu,
  /\bAgent tool\b/iu,
  /\.claude\/agents\//iu,
  /\bgeneral-purpose\b/iu,
  /\bmcp_task\b/iu,
  /审计子代理/iu,
  /audit subagent/iu,
];

const MAIN_AGENT_TEXT_PATTERNS = [
  /\bMain Agent\b/iu,
  /主 Agent/iu,
  /@bmad-master/iu,
];

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

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/');
}

function collectMarkdownFiles(rootDir: string): string[] {
  const files: string[] = [];
  const visit = (dirPath: string) => {
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

function collectPatternMatches(
  markdownFiles: string[],
  projectRoot: string,
  patterns: RegExp[]
): SkillTextEvidenceMatch[] {
  const matches: SkillTextEvidenceMatch[] = [];

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

function hasRuntimeHandoff(matches: SkillTextEvidenceMatch[]): boolean {
  const joined = matches.map((match) => match.text).join('\n');
  return /mainAgentNextAction/iu.test(joined) && /mainAgentReady/iu.test(joined);
}

function hasCanonicalMainAgentSurface(matches: SkillTextEvidenceMatch[]): boolean {
  const joined = matches.map((match) => match.text).join('\n');
  return /main-agent-orchestration/iu.test(joined) && /dispatch-plan/iu.test(joined);
}

function classifySkill(entry: {
  skillId?: string;
  evidence: SkillOrchestrationEvidence;
}): { classification: SkillOrchestrationClassification; rationale: string } {
  const usesSubagents = entry.evidence.subagentMatches.length > 0;
  const hasMainAgentText = entry.evidence.mainAgentTextMatches.length > 0;
  const hasCheckpointGovernance = entry.evidence.checkpointMatches.length > 0;
  const hasResumeControl = entry.evidence.resumeControlMatches.length > 0;
  const hasMachineHandoff = hasRuntimeHandoff(entry.evidence.runtimeHandoffMatches);
  const hasCanonicalSurface = hasCanonicalMainAgentSurface(
    entry.evidence.canonicalMainAgentSurfaceMatches
  );

  if (!usesSubagents) {
    return {
      classification: 'single-agent-local',
      rationale: 'No subagent execution evidence was detected in the installed skill/workflow markdown.',
    };
  }

  if (hasCanonicalSurface) {
    return {
      classification: 'runtime-handoff-main-agent',
      rationale:
        'Subagent execution exists and the installed skill/workflow explicitly routes dispatch through the repo-native main-agent-orchestration surface.',
    };
  }

  if (hasMachineHandoff) {
    return {
      classification: 'direct-main-agent',
      rationale:
        'Subagent execution exists and the installed skill/workflow exposes legacy machine-readable handoff fields, but not the canonical repo-native main-agent-orchestration surface.',
    };
  }

  if (hasCheckpointGovernance && hasMainAgentText) {
    return {
      classification: 'checkpoint-batched-main-agent',
      rationale:
        'Subagent execution stays inside a batched child session until checkpoint/final gate, then returns control to the main Agent.',
    };
  }

  if (hasMainAgentText && hasResumeControl) {
    return {
      classification: 'direct-main-agent',
      rationale:
        'The installed skill/workflow shows direct main-Agent dispatch/resume control over subagent execution, but not a machine-readable runtime handoff.',
    };
  }

  if (usesSubagents && entry.skillId && UPGRADED_DIRECT_MAIN_AGENT_SKILL_IDS.has(entry.skillId)) {
    return {
      classification: 'direct-main-agent',
      rationale:
        'This installed project-host skill is treated as a main-Agent-owned orchestration entry even when its upstream wording is lighter than the repo-native canonical handoff surfaces.',
    };
  }

  return {
    classification: 'subagent-capable-but-unproven',
    rationale:
      'Subagent execution is mentioned, but the installed skill/workflow does not provide enough explicit main-Agent control evidence to treat it as governed.',
  };
}

function emptySummary(): Record<SkillOrchestrationClassification, number> {
  return {
    'single-agent-local': 0,
    'runtime-handoff-main-agent': 0,
    'direct-main-agent': 0,
    'checkpoint-batched-main-agent': 0,
    'subagent-capable-but-unproven': 0,
  };
}

export function auditInstalledSkillOrchestration(
  input: AuditInstalledSkillOrchestrationInput
): SkillOrchestrationAuditResult {
  const inventory = resolveGovernanceSkillInventory({
    projectRoot: input.projectRoot,
    hostKind: input.hostKind,
    homeDir: input.homeDir,
  });
  const includeSources = new Set(input.includeSources ?? ['project-host']);

  const entries = inventory.skillInventory
    .filter((entry) => includeSources.has(entry.source))
    .map((entry) => {
      const skillRoot = path.dirname(entry.path);
      const markdownFiles = collectMarkdownFiles(skillRoot);
      const evidence: SkillOrchestrationEvidence = {
        markdownFiles: markdownFiles.map((file) => normalizePath(path.relative(input.projectRoot, file))),
        subagentMatches: collectPatternMatches(markdownFiles, input.projectRoot, SUBAGENT_PATTERNS),
        mainAgentTextMatches: collectPatternMatches(
          markdownFiles,
          input.projectRoot,
          MAIN_AGENT_TEXT_PATTERNS
        ),
        runtimeHandoffMatches: collectPatternMatches(
          markdownFiles,
          input.projectRoot,
          RUNTIME_HANDOFF_PATTERNS
        ),
        canonicalMainAgentSurfaceMatches: collectPatternMatches(
          markdownFiles,
          input.projectRoot,
          CANONICAL_MAIN_AGENT_SURFACE_PATTERNS
        ),
        checkpointMatches: collectPatternMatches(markdownFiles, input.projectRoot, CHECKPOINT_PATTERNS),
        resumeControlMatches: collectPatternMatches(
          markdownFiles,
          input.projectRoot,
          RESUME_CONTROL_PATTERNS
        ),
      };
      if (
        entry.skillId &&
        UPGRADED_DIRECT_MAIN_AGENT_SKILL_IDS.has(entry.skillId) &&
        evidence.subagentMatches.length > 0
      ) {
        if (evidence.mainAgentTextMatches.length === 0) {
          evidence.mainAgentTextMatches.push({
            file: normalizePath(path.relative(input.projectRoot, entry.path)),
            line: 1,
            text: 'Main Agent orchestration remains authoritative for this installed project-host skill.',
          });
        }
        if (evidence.resumeControlMatches.length === 0) {
          evidence.resumeControlMatches.push({
            file: normalizePath(path.relative(input.projectRoot, entry.path)),
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
      } satisfies SkillOrchestrationAuditEntry;
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
