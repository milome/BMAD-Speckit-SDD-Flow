import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const VERIFY_SCRIPT = path.join(
  ROOT,
  '_bmad',
  'shared',
  'goal-contract',
  'scripts',
  'verify-goal-contract-profile.js'
);
const EXTRACT_SCRIPT = path.join(
  ROOT,
  '_bmad',
  'shared',
  'goal-contract',
  'scripts',
  'extract-goal-contract-profile.js'
);
const UPDATE_SCRIPT = path.join(
  ROOT,
  '_bmad',
  'shared',
  'goal-contract',
  'scripts',
  'update-goal-contract-profile.js'
);
const TEMPLATE = path.join(
  ROOT,
  '_bmad',
  'shared',
  'goal-contract',
  'goal-execution-contract-template.md'
);
const PROFILE = path.join(ROOT, '_bmad', 'shared', 'goal-contract', 'goal-contract-profile.json');
const LOCK = path.join(ROOT, '_bmad', 'shared', 'goal-contract', 'goal-contract-profile.lock.json');

function runNode(script: string, args: string[] = []) {
  return execFileSync(process.execPath, [script, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

describe('shared goal contract profile', () => {
  it('validates canonical template, profile, lock, and skill reference sync', () => {
    const output = JSON.parse(runNode(VERIFY_SCRIPT)) as {
      ok: boolean;
      issues: string[];
      templateHash: string;
      profileHash: string;
      profileVersion: string;
    };

    expect(output.ok).toBe(true);
    expect(output.issues).toEqual([]);
    expect(output.templateHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(output.profileHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(output.profileVersion).toBe('2.0.0');
  });

  it('uses one canonical template hash for LF, CRLF, and leading BOM template text', () => {
    const profileModule = require(EXTRACT_SCRIPT) as {
      canonicalTextForContractHash: (text: string) => string;
      extractTemplateProfile: (text: string) => { templateHash: string };
      sha256: (text: string) => string;
      templateHashFor: (text: string) => string;
    };
    const lfTemplate = fs.readFileSync(TEMPLATE, 'utf8').replace(/\r\n/g, '\n');
    const crlfTemplate = lfTemplate.replace(/\n/g, '\r\n');
    const bomCrlfTemplate = `\uFEFF${crlfTemplate}`;

    expect(profileModule.canonicalTextForContractHash(bomCrlfTemplate)).toBe(lfTemplate);
    expect(profileModule.templateHashFor(lfTemplate)).toBe(
      profileModule.templateHashFor(crlfTemplate)
    );
    expect(profileModule.templateHashFor(lfTemplate)).toBe(
      profileModule.templateHashFor(bomCrlfTemplate)
    );
    expect(profileModule.extractTemplateProfile(lfTemplate).templateHash).toBe(
      profileModule.extractTemplateProfile(crlfTemplate).templateHash
    );
    expect(profileModule.sha256(lfTemplate)).not.toBe(profileModule.sha256(crlfTemplate));
  });

  it('extracts required sections and slots from the Markdown template', () => {
    const output = JSON.parse(runNode(EXTRACT_SCRIPT, [TEMPLATE])) as {
      templatePath: string;
      sections: string[];
      slots: Array<{ name: string; required: boolean; dynamic: string }>;
      duplicateSlots: string[];
      unclosedSlots: string[];
    };

    expect(output.templatePath).toBe(
      '_bmad/shared/goal-contract/goal-execution-contract-template.md'
    );
    expect(output.sections).toEqual(
      expect.arrayContaining([
        '/goal Entry',
        'Authority Model',
        'Implementation Tasks',
        'Acceptance Traceability Matrix',
        'Stop Conditions',
      ])
    );
    expect(output.slots.map((slot) => slot.name)).toEqual(
      expect.arrayContaining([
        'frontMatter',
        'goalEntry',
        'implementationTasks',
        'acceptanceTraceabilityMatrix',
        'requiredTestCommands',
        'stopConditions',
      ])
    );
    expect(output.slots.filter((slot) => slot.required).length).toBeGreaterThanOrEqual(12);
    expect(output.duplicateSlots).toEqual([]);
    expect(output.unclosedSlots).toEqual([]);
  });

  it('verifies a CRLF template path with canonical LF-normalized profile and lock hashes', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'goal-profile-crlf-'));
    try {
      const profileModule = require(EXTRACT_SCRIPT) as {
        normalizeRepoPath: (file: string) => string;
        profileHashFor: (profile: Record<string, any>) => string;
        templateHashFor: (text: string) => string;
      };
      const verifier = require(VERIFY_SCRIPT) as {
        verifyGoalContractProfile: (input: {
          templatePath: string;
          profilePath: string;
          lockPath: string;
          checkSkillReference: boolean;
        }) => { ok: boolean; issues: string[]; templateHash: string; profileHash: string };
      };
      const lfTemplate = fs.readFileSync(TEMPLATE, 'utf8').replace(/\r\n/g, '\n');
      const crlfTemplate = lfTemplate.replace(/\n/g, '\r\n');
      const templatePath = path.join(tempDir, 'goal-execution-contract-template.md');
      const profilePath = path.join(tempDir, 'goal-contract-profile.json');
      const lockPath = path.join(tempDir, 'goal-contract-profile.lock.json');
      const baseProfile = readJson<Record<string, any>>(PROFILE);
      const baseLock = readJson<Record<string, any>>(LOCK);
      const templatePathRelative = profileModule.normalizeRepoPath(templatePath);
      const templateHash = profileModule.templateHashFor(crlfTemplate);

      fs.writeFileSync(templatePath, crlfTemplate, 'utf8');
      const profileDraft = {
        ...baseProfile,
        templatePath: templatePathRelative,
        templateHash,
      };
      const profile = {
        ...profileDraft,
        profileHash: profileModule.profileHashFor(profileDraft),
      };
      const lock = {
        ...baseLock,
        templatePath: profile.templatePath,
        templateHash: profile.templateHash,
        profileHash: profile.profileHash,
        profileVersion: profile.profileVersion,
      };
      fs.writeFileSync(profilePath, `${JSON.stringify(profile, null, 2)}\n`, 'utf8');
      fs.writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`, 'utf8');

      const result = verifier.verifyGoalContractProfile({
        templatePath,
        profilePath,
        lockPath,
        checkSkillReference: false,
      });
      expect(result.ok).toBe(true);
      expect(result.issues).toEqual([]);
      expect(result.templateHash).toBe(profileModule.templateHashFor(lfTemplate));
      expect(result.templateHash).toBe(profileModule.templateHashFor(crlfTemplate));
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('keeps profile as a machine index rather than full Markdown prose', () => {
    const profileText = fs.readFileSync(PROFILE, 'utf8');
    const templateText = fs.readFileSync(TEMPLATE, 'utf8');
    const profile = readJson<Record<string, any>>(PROFILE);
    const lock = readJson<Record<string, any>>(LOCK);

    expect(profile.governanceRules.profileIsGenerationSource).toBe(false);
    expect(profile.governanceRules.templateIsHumanCanonical).toBe(true);
    expect(profile.invariantFragments).toEqual(
      expect.arrayContaining([
        'model_packet.json is the machine-readable execution authority',
        'goal_execution.md is not execution authority',
        '/goal completion is not closeout proof',
      ])
    );
    expect(profileText).not.toContain(
      'Every checkbox must have direct evidence before completion is claimed.'
    );
    expect(profileText.length).toBeLessThan(templateText.length);
    expect(lock.templateHash).toBe(profile.templateHash);
    expect(lock.profileHash).toBe(profile.profileHash);
  });

  it('requires an explicit major bump for required structure changes', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'goal-profile-change-'));
    try {
      const module = require(
        path.join(
          ROOT,
          '_bmad',
          'shared',
          'goal-contract',
          'scripts',
          'update-goal-contract-profile.js'
        )
      ) as {
        classifyProfileChange: (
          beforeProfile: Record<string, any>,
          afterProfile: Record<string, any>
        ) => string;
      };
      const beforeProfile = readJson<Record<string, any>>(PROFILE);
      const afterProfile = {
        ...beforeProfile,
        requiredSlots: [...beforeProfile.requiredSlots, 'newRequiredSlot'],
      };
      const optionalProfile = {
        ...beforeProfile,
        optionalSlots: ['optionalFutureSlot'],
      };

      expect(module.classifyProfileChange(beforeProfile, afterProfile)).toBe('major');
      expect(module.classifyProfileChange(beforeProfile, optionalProfile)).toBe('minor');
      expect(fs.existsSync(UPDATE_SCRIPT)).toBe(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
