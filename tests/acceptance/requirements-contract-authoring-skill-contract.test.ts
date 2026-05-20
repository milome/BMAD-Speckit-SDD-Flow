import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const SKILL_DIR = path.join(ROOT, '_bmad', 'skills', 'requirements-contract-authoring');

function readSkillFile(relativePath: string): string {
  return fs.readFileSync(path.join(SKILL_DIR, relativePath), 'utf8');
}

describe('requirements-contract-authoring published contract', () => {
  it('documents governanceEventTypeRegistryPolicy as mandatory when governance events apply', () => {
    const skill = readSkillFile('SKILL.md');
    const template = readSkillFile(path.join('references', 'contract-template.md'));
    const rendererSpec = readSkillFile(path.join('references', 'html-confirmation-renderer-spec.md'));

    for (const content of [skill, template, rendererSpec]) {
      expect(content).toContain('governanceEventTypeRegistryPolicy');
      expect(content).toContain('controlFieldVocabulary');
      expect(content).toContain('payloadKindContracts');
      expect(content).toContain('controlWriteModePolicies');
      expect(content).toContain('eventSpecificRequirements');
    }

    expect(skill).toContain('When governance events apply, require `governanceEventTypeRegistryPolicy`');
    expect(template).toContain('governanceEventTypeRegistryPolicy:');
    expect(template).toContain('controlFieldVocabulary:');
    expect(rendererSpec).toContain('the current event type must list it in `writesControlFields[]`');
    expect(rendererSpec).toContain('strict mode must require both `governanceEventTypeRegistryPolicy` and `governanceEventTypeRegistry[]`');
  });

  it('documents controlledIngestWriterRegistry as the only writer permission authority', () => {
    const skill = readSkillFile('SKILL.md');
    const template = readSkillFile(path.join('references', 'contract-template.md'));
    const rendererSpec = readSkillFile(path.join('references', 'html-confirmation-renderer-spec.md'));

    for (const content of [skill, template, rendererSpec]) {
      expect(content).toContain('controlledIngestWriterRegistry');
      expect(content).toContain('allowedEventTypes');
      expect(content).toContain('payloadContractRefs');
      expect(content).toContain('beforeAfterHashRequired');
      expect(content).toContain('canModifyWriterRegistry');
    }

    expect(skill).toContain('the only machine-readable authority for which writer may write control records');
    expect(template).toContain('A writer that receives a registered event type outside its `allowedEventTypes[]` must fail closed');
    expect(rendererSpec).toContain('strict mode must require `controlledIngestWriterRegistry[]`');
  });

  it('publishes architecture confirmation prepare as the user-facing entry', () => {
    const skill = readSkillFile('SKILL.md');
    const rendererSpec = readSkillFile(path.join('references', 'html-confirmation-renderer-spec.md'));

    for (const content of [skill, rendererSpec]) {
      expect(content).toContain('prepare-architecture-confirmation-page.ts');
      expect(content).toContain('architecture_confirmation_state_checked');
      expect(content).toContain('generate requirement-scoped `architecture-confirmation-<runId>.json`');
      expect(content).toContain('Do not expose stale check or JSON producer commands as manual user steps');
    }

    expect(skill).toContain('The user-facing next step is only to open the architecture confirmation HTML and confirm the hashes in chat');
    expect(rendererSpec).toContain('The user-facing next step must only be to open the architecture confirmation HTML and confirm the hashes in chat');
  });
});
