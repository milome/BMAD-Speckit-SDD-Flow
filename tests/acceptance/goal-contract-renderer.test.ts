import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const TEMPLATE = path.join(
  ROOT,
  '_bmad',
  'shared',
  'goal-contract',
  'goal-execution-contract-template.md'
);
const PROFILE = path.join(ROOT, '_bmad', 'shared', 'goal-contract', 'goal-contract-profile.json');

function loadRenderer() {
  return require(
    path.join(ROOT, '_bmad', 'shared', 'goal-contract', 'scripts', 'render-goal-contract.js')
  ) as {
    renderGoalContract: (input: {
      templateText: string;
      profile: Record<string, any>;
      slotData: Record<string, string>;
      validateHashes?: boolean;
    }) => { document: string; audit: Record<string, any> };
  };
}

function loadProfileModule() {
  return require(
    path.join(
      ROOT,
      '_bmad',
      'shared',
      'goal-contract',
      'scripts',
      'extract-goal-contract-profile.js'
    )
  ) as {
    profileHashFor: (profile: Record<string, any>) => string;
    templateHashFor: (text: string) => string;
  };
}

function slotData(overrides: Record<string, string> = {}) {
  return {
    frontMatter: [
      '```yaml',
      'goalContractVersion: goal-execution-contract/v1',
      'goalContractProfileVersion: 1.1.0',
      'goalContractProfileHash: sha256:a1971090837806dd1c36fa5dc4c32da9cc7d92cc77289e82ad6ce135e27f62f5',
      'contractMode: frozen',
      'rewritePolicy: forbidden',
      'executionMode: execute_only',
      'sourcePlanPath: model_packet.json',
      'sourcePlanHash: sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'runtimeRecordId: REQ-TEST',
      'entryFlow: standalone_tasks',
      'taskRange: G00-G01',
      'acceptanceRange: AC-01-AC-03',
      'completionGate: required',
      'repairPolicy: fix_in_place',
      'stopPolicy: stop_only_on_success_or_true_blocker',
      'generatedBy: test',
      'generatedAt: 2026-05-27T00:00:00.000Z',
      '```',
    ].join('\n'),
    goalEntry: '```text\n/goal Follow goal_execution.md and model_packet.json.\n```',
    authorityModel: [
      '**Machine-readable authority:** `model_packet.json is the machine-readable execution authority`.',
      '**Human-facing projection:** `goal_execution.md is not execution authority`.',
      '**Completion boundary:** `/goal completion is not closeout proof`.',
    ].join('\n\n'),
    rootCause:
      '- Current behavior: local hardcoded rendering.\n- Required behavior: shared slot renderer.',
    domainAddenda: '- Renderer may replace slot contents only.',
    implementationTasks: '### G00 Baseline\n\n**Purpose:** Verify baseline.',
    strictAcceptanceChecklist:
      '- [ ] `AC-01` Renderer preserves static prose.\n- [ ] `AC-02` Invariants render.\n- [ ] `AC-03` Commands exist.',
    acceptanceTraceabilityMatrix:
      '| AC ID | Requirement | Owning Task | Evidence Command |\n| --- | --- | --- | --- |\n| AC-01 | Static prose preserved. | G00 | `node test` |',
    requiredTestCommands: '```powershell\nnode test\n```',
    manualVerificationScenarios:
      '### Scenario A\n\n- Setup: valid slots.\n- Expected: pass.\n- Forbidden: prose rewrite.',
    completionEvidencePacket: '- Files changed.\n- Commands run.',
    stopConditions: '- Stop on semantic gap.\n\nDo not stop merely because tests need fixtures.',
    ...overrides,
  };
}

describe('shared goal contract renderer', () => {
  it('renders required slots and preserves static Markdown prose', () => {
    const templateText = fs.readFileSync(TEMPLATE, 'utf8');
    const profile = JSON.parse(fs.readFileSync(PROFILE, 'utf8'));
    const { renderGoalContract } = loadRenderer();
    const result = renderGoalContract({ templateText, profile, slotData: slotData() });

    expect(result.document).toContain(
      'The Markdown template is the human canonical contract source.'
    );
    expect(result.document).toContain(
      'Every checkbox must have direct evidence before completion is claimed.'
    );
    expect(result.document).toContain(
      'model_packet.json is the machine-readable execution authority'
    );
    expect(result.document).toContain('goal_execution.md is not execution authority');
    expect(result.document).toContain('/goal completion is not closeout proof');
    expect(result.audit.requiredSlotsPassed).toBe(true);
    expect(result.audit.requiredSectionsPassed).toBe(true);
    expect(result.audit.invariantFragmentsPassed).toBe(true);
    expect(result.audit.rendererVersion).toBe('req-trace-goal-contract-renderer/v1');
  });

  it('accepts a CRLF template when the profile contains the canonical template hash', () => {
    const lfTemplate = fs.readFileSync(TEMPLATE, 'utf8').replace(/\r\n/g, '\n');
    const crlfTemplate = lfTemplate.replace(/\n/g, '\r\n');
    const baseProfile = JSON.parse(fs.readFileSync(PROFILE, 'utf8'));
    const { profileHashFor, templateHashFor } = loadProfileModule();
    const { renderGoalContract } = loadRenderer();
    const profileDraft = {
      ...baseProfile,
      templateHash: templateHashFor(lfTemplate),
    };
    const profile = {
      ...profileDraft,
      profileHash: profileHashFor(profileDraft),
    };

    const result = renderGoalContract({
      templateText: crlfTemplate,
      profile,
      slotData: slotData(),
    });

    expect(result.audit.templateHash).toBe(templateHashFor(lfTemplate));
    expect(result.audit.templateHash).toBe(templateHashFor(crlfTemplate));
    expect(result.audit.contentHash).toMatch(/^sha256:/);
    expect(result.audit.compatibilityDecision).toBe('pass');
  });

  it('still blocks real semantic template hash mismatches', () => {
    const templateText = `${fs.readFileSync(TEMPLATE, 'utf8')}\n## Semantic Drift\n`;
    const profile = JSON.parse(fs.readFileSync(PROFILE, 'utf8'));
    const { renderGoalContract } = loadRenderer();

    expect(() =>
      renderGoalContract({
        templateText,
        profile,
        slotData: slotData(),
      })
    ).toThrow(/GOAL_CONTRACT_PROFILE_HASH_MISMATCH/);
  });

  it('rejects missing, empty, duplicate, or unclosed required slots', () => {
    const templateText = fs.readFileSync(TEMPLATE, 'utf8');
    const profile = JSON.parse(fs.readFileSync(PROFILE, 'utf8'));
    const { renderGoalContract } = loadRenderer();

    expect(() =>
      renderGoalContract({
        templateText,
        profile,
        slotData: slotData({ implementationTasks: '' }),
      })
    ).toThrow(/GOAL_CONTRACT_INCOMPLETE/);

    expect(() =>
      renderGoalContract({
        templateText: `${templateText}\n<!-- goal-slot:frontMatter required --><!-- /goal-slot:frontMatter -->`,
        profile,
        slotData: slotData(),
        validateHashes: false,
      })
    ).toThrow(/duplicate slots/);

    expect(() =>
      renderGoalContract({
        templateText: `${templateText}\n<!-- goal-slot:future required -->`,
        profile: { ...profile, requiredSlots: [...profile.requiredSlots, 'future'] },
        slotData: slotData({ future: 'future slot' }),
        validateHashes: false,
      })
    ).toThrow(/unclosed slots/);
  });

  it('blocks missing invariant fragments after rendering', () => {
    const templateText = fs.readFileSync(TEMPLATE, 'utf8');
    const profile = JSON.parse(fs.readFileSync(PROFILE, 'utf8'));
    const { renderGoalContract } = loadRenderer();

    expect(() =>
      renderGoalContract({
        templateText,
        profile,
        slotData: slotData({
          authorityModel: [
            '**Machine-readable authority:** packet.',
            '**Human-facing projection:** goal document.',
            '**Completion boundary:** final commands.',
          ].join('\n'),
        }),
      })
    ).toThrow(/GOAL_CONTRACT_INCOMPLETE/);
  });
});
