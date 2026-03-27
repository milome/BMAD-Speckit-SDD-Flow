import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  resolvePromptHintUsage,
  type PromptRoutingGovernanceInput,
  type PromptHintUsageRecord,
} from './prompt-routing-governance';
import { type ModelGovernanceHintCandidate } from './model-governance-hints-schema';
import { resolvePromptRoutingHintsFromText } from './prompt-routing-hints';

export interface GovernanceRemediationArtifactInput {
  projectRoot: string;
  outputPath: string;
  promptText?: string;
  modelHintsCandidate?: ModelGovernanceHintCandidate | null;
  stageContextKnown: boolean;
  gateFailureExists: boolean;
  blockerOwnershipLocked: boolean;
  rootTargetLocked: boolean;
  equivalentAdapterCount: number;
  attemptId: string;
  sourceGateFailureIds: string[];
  capabilitySlot: string;
  canonicalAgent: string;
  actualExecutor: string;
  adapterPath: string;
  targetArtifacts: string[];
  expectedDelta: string;
  rerunOwner: string;
  rerunGate: string;
  outcome: string;
  sharedArtifactsUpdated?: string[];
  contradictionsDelta?: string;
  externalProofAdded?: string;
  readyToRerunGate?: boolean;
  stopReason?: string;
}

export interface GovernanceRemediationArtifactResult {
  markdown: string;
  promptHintUsage: PromptHintUsageRecord;
}

function yesNo(value: boolean): string {
  return value ? 'yes' : 'no';
}

function bulletList(items: string[]): string {
  if (items.length === 0) {
    return '- (none)';
  }
  return items.map((item) => `- ${item}`).join('\n');
}

function buildPromptHintUsageLines(usage: PromptHintUsageRecord): string[] {
  return [
    '- Prompt hint present: ' + (usage.promptHintPresent ? 'yes' : 'no'),
    `- Hint confidence: ${usage.hintConfidence}`,
    `- Consumed after: \`${usage.consumedAfter}\``,
    '- Hint applied to:',
    ...(
      usage.hintAppliedTo.length > 0
        ? usage.hintAppliedTo.map((item) => `  - ${item}`)
        : ['  - (none)']
    ),
    '- Hint ignored because:',
    ...(
      usage.hintIgnoredBecause.length > 0
        ? usage.hintIgnoredBecause.map((item) => `  - ${item}`)
        : ['  - (none)']
    ),
    '- Blocker ownership affected: no',
  ];
}

function buildModelHintUsageLines(usage: PromptHintUsageRecord): string[] {
  return [
    '- Model hint present: ' + (usage.modelHintPresent ? 'yes' : 'no'),
    `- Model hint confidence: ${usage.modelHintConfidence}`,
    '- Model hint applied to:',
    ...(
      usage.modelHintAppliedTo.length > 0
        ? usage.modelHintAppliedTo.map((item) => `  - ${item}`)
        : ['  - (none)']
    ),
    '- Model hint ignored because:',
    ...(
      usage.modelHintIgnoredBecause.length > 0
        ? usage.modelHintIgnoredBecause.map((item) => `  - ${item}`)
        : ['  - (none)']
    ),
    '- Model hint debug:',
    ...(usage.modelHintDebug
      ? [
          `  - Stripped forbidden overrides: ${
            usage.modelHintDebug.strippedForbiddenOverrides.join(', ') || '(none)'
          }`,
          `  - Policy ignored because: ${
            usage.modelHintDebug.ignoredBecause.join(', ') || '(none)'
          }`,
        ]
      : ['  - (none)']),
    '- Model hints remain advisory only: yes',
  ];
}

export function buildGovernanceRemediationArtifact(
  input: GovernanceRemediationArtifactInput
): GovernanceRemediationArtifactResult {
  const promptHints = input.promptText
    ? resolvePromptRoutingHintsFromText(input.projectRoot, input.promptText)
    : null;

  const governanceInput: PromptRoutingGovernanceInput = {
    stageContextKnown: input.stageContextKnown,
    gateFailure: {
      exists: input.gateFailureExists,
      blockerOwnershipLocked: input.blockerOwnershipLocked,
    },
    artifactState: {
      rootTargetLocked: input.rootTargetLocked,
      equivalentAdapterCount: input.equivalentAdapterCount,
    },
    promptHints,
    modelHintsCandidate: input.modelHintsCandidate,
  };

  const promptHintUsage = resolvePromptHintUsage(governanceInput);
  const markdown = [
    '# Remediation Attempt',
    '',
    '## PM Routing Resolution',
    '',
    '- Resolution order: `stage context -> gate failure -> artifact state -> PromptRoutingHints`',
    `- Stage context known: ${yesNo(input.stageContextKnown)}`,
    `- Gate failure exists: ${yesNo(input.gateFailureExists)}`,
    `- Blocker ownership locked: ${yesNo(input.blockerOwnershipLocked)}`,
    `- Root target locked: ${yesNo(input.rootTargetLocked)}`,
    `- Equivalent adapter count: ${input.equivalentAdapterCount}`,
    `- Prompt hints confidence: ${promptHintUsage.hintConfidence}`,
    '',
    '## Core Fields',
    '',
    `- Attempt ID: ${input.attemptId}`,
    `- Source GateFailure IDs: ${input.sourceGateFailureIds.join(', ') || '(none)'}`,
    `- Capability Slot: ${input.capabilitySlot}`,
    `- Canonical Agent: ${input.canonicalAgent}`,
    `- Actual Executor: ${input.actualExecutor}`,
    `- Adapter Path: ${input.adapterPath}`,
    '- Target Artifact(s):',
    bulletList(input.targetArtifacts),
    `- Expected Delta: ${input.expectedDelta}`,
    `- Rerun Owner: ${input.rerunOwner}`,
    `- Rerun Gate: ${input.rerunGate}`,
    `- Outcome: ${input.outcome}`,
    '',
    '## Prompt Hint Usage',
    '',
    ...buildPromptHintUsageLines(promptHintUsage),
    '',
    '## Model Hint Debug',
    '',
    ...buildModelHintUsageLines(promptHintUsage),
    '',
    '## Evidence Delta',
    '',
    '- Shared artifacts updated:',
    bulletList(input.sharedArtifactsUpdated ?? []),
    `- Contradictions opened/closed: ${input.contradictionsDelta ?? '(none)'}`,
    `- External proof added: ${input.externalProofAdded ?? '(none)'}`,
    '',
    '## Next Action',
    '',
    `- Ready to rerun gate: ${yesNo(input.readyToRerunGate ?? false)}`,
    `- If no, stop reason: ${input.stopReason ?? '(none)'}`,
    '',
  ].join('\n');

  return {
    markdown,
    promptHintUsage,
  };
}

export function writeGovernanceRemediationArtifact(
  input: GovernanceRemediationArtifactInput
): GovernanceRemediationArtifactResult {
  const result = buildGovernanceRemediationArtifact(input);
  const absoluteOutputPath = path.isAbsolute(input.outputPath)
    ? input.outputPath
    : path.join(input.projectRoot, input.outputPath);
  fs.mkdirSync(path.dirname(absoluteOutputPath), { recursive: true });
  fs.writeFileSync(absoluteOutputPath, result.markdown, 'utf8');
  return result;
}

function parseBooleanFlag(value: string | undefined, flagName: string): boolean {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  throw new Error(`Invalid ${flagName}: expected true|false`);
}

function parseList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function argValue(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}

function main(): void {
  if (require.main !== module) {
    return;
  }

  const args = process.argv.slice(2);
  const outputPath = argValue(args, '--outputPath');
  if (!outputPath) {
    throw new Error(
      'Usage: npx ts-node --transpile-only scripts/governance-remediation-artifact.ts --outputPath <path> --attemptId <id> --capabilitySlot <slot> --canonicalAgent <agent> --actualExecutor <executor> --adapterPath <path> --expectedDelta <text> --rerunOwner <owner> --rerunGate <gate> --outcome <text> --stageContextKnown true|false --gateFailureExists true|false --blockerOwnershipLocked true|false --rootTargetLocked true|false --equivalentAdapterCount <n> [--promptText <text>] [--sourceGateFailureIds a,b] [--targetArtifacts a,b]'
    );
  }

  const projectRoot = process.cwd();
  writeGovernanceRemediationArtifact({
    projectRoot,
    outputPath,
    promptText: argValue(args, '--promptText'),
    stageContextKnown: parseBooleanFlag(argValue(args, '--stageContextKnown'), '--stageContextKnown'),
    gateFailureExists: parseBooleanFlag(argValue(args, '--gateFailureExists'), '--gateFailureExists'),
    blockerOwnershipLocked: parseBooleanFlag(
      argValue(args, '--blockerOwnershipLocked'),
      '--blockerOwnershipLocked'
    ),
    rootTargetLocked: parseBooleanFlag(argValue(args, '--rootTargetLocked'), '--rootTargetLocked'),
    equivalentAdapterCount: Number(argValue(args, '--equivalentAdapterCount') ?? '0'),
    attemptId: argValue(args, '--attemptId') ?? 'attempt-unknown',
    sourceGateFailureIds: parseList(argValue(args, '--sourceGateFailureIds')),
    capabilitySlot: argValue(args, '--capabilitySlot') ?? 'unknown-slot',
    canonicalAgent: argValue(args, '--canonicalAgent') ?? 'unknown-agent',
    actualExecutor: argValue(args, '--actualExecutor') ?? 'unknown-executor',
    adapterPath: argValue(args, '--adapterPath') ?? 'unknown-adapter',
    targetArtifacts: parseList(argValue(args, '--targetArtifacts')),
    expectedDelta: argValue(args, '--expectedDelta') ?? 'n/a',
    rerunOwner: argValue(args, '--rerunOwner') ?? 'PM',
    rerunGate: argValue(args, '--rerunGate') ?? 'n/a',
    outcome: argValue(args, '--outcome') ?? 'n/a',
    sharedArtifactsUpdated: parseList(argValue(args, '--sharedArtifactsUpdated')),
    contradictionsDelta: argValue(args, '--contradictionsDelta'),
    externalProofAdded: argValue(args, '--externalProofAdded'),
    readyToRerunGate: argValue(args, '--readyToRerunGate')
      ? parseBooleanFlag(argValue(args, '--readyToRerunGate'), '--readyToRerunGate')
      : undefined,
    stopReason: argValue(args, '--stopReason'),
  });
}

main();
