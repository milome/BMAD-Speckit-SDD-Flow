import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

type PromptRole = 'requirements_critical_auditor' | 'final_acceptance_judge';

interface PromptContract {
  path: string;
  templateId: string;
  templateVersion: string;
  judgeRole: PromptRole;
  actorClass: string;
  forbiddenTerms: RegExp[];
  requiredTerms: RegExp[];
}

const prompts: PromptContract[] = [
  {
    path: '_bmad/shared/requirements-contract/judge-prompts/requirements-contract-critical-auditor.prompt.md',
    templateId: 'requirements-contract-critical-auditor-judge.prompt',
    templateVersion: '1.0.0',
    judgeRole: 'requirements_critical_auditor',
    actorClass: 'requirements_critical_auditor_judge',
    forbiddenTerms: [
      /final acceptance judge/iu,
      /implementation approval/iu,
      /delivery recommendation/iu,
    ],
    requiredTerms: [/requirements findings/iu, /source repair actions/iu, /requirements-only/iu],
  },
  {
    path: '_bmad/shared/requirements-contract/judge-prompts/audit-review-final-acceptance-judge.prompt.md',
    templateId: 'audit-review-final-acceptance-judge.prompt',
    templateVersion: '1.0.0',
    judgeRole: 'final_acceptance_judge',
    actorClass: 'final_acceptance_judge',
    forbiddenTerms: [
      /requirements critical auditor/iu,
      /source repair actions/iu,
      /requirements promotion/iu,
    ],
    requiredTerms: [
      /implementation evidence/iu,
      /acceptance evidence/iu,
      /final-acceptance-only/iu,
    ],
  },
];

function sha256(content: string): string {
  return `sha256:${createHash('sha256').update(content, 'utf8').digest('hex')}`;
}

function parsePrompt(content: string): { frontMatter: Record<string, string>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/u.exec(content);
  expect(match, 'prompt must start with YAML-like front matter').not.toBeNull();
  const frontMatter = Object.fromEntries(
    match![1]
      .split(/\r?\n/u)
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        const separator = line.indexOf(':');
        expect(separator, `front matter line must be key: value: ${line}`).toBeGreaterThan(0);
        return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
      })
  );
  return { frontMatter, body: content.slice(match![0].length) };
}

describe('requirements contract Judge prompt templates', () => {
  it.each(prompts)('publishes a standalone role-bound prompt at $path', (prompt) => {
    const promptPath = path.resolve(prompt.path);
    expect(existsSync(promptPath), `missing prompt: ${prompt.path}`).toBe(true);
    if (!existsSync(promptPath)) return;

    const content = readFileSync(promptPath, 'utf8');
    const { frontMatter, body } = parsePrompt(content);

    expect(frontMatter).toMatchObject({
      templateId: prompt.templateId,
      templateVersion: prompt.templateVersion,
      judgeRole: prompt.judgeRole,
      actorClass: prompt.actorClass,
      schemaVersion: 'requirements-contract-judge-prompt-template/v1',
    });
    expect(frontMatter.promptTemplateHash).toBe(sha256(body));
    expect(content).toContain('## Authority Binding');
    expect(content).toContain('## Required Output');
    expect(content).toContain('## Prohibited Behavior');
    expect(content).toContain('promptTemplateHash');
    expect(content).toContain('assessmentSchemaHash');
    expect(content).toContain('providerAuthority');
    expect(content).toContain('ledgerAuthority');
    expect(content).not.toMatch(/\{\{\s*(?:include|path|file|authority|schema|prompt)/iu);
    expect(content).not.toMatch(/<!--\s*include|@include|include:/iu);
    expect(content).not.toMatch(/[A-Z]:[\\/]|\/Users\/|\/home\//u);

    for (const required of prompt.requiredTerms) expect(content).toMatch(required);
    for (const forbidden of prompt.forbiddenTerms) expect(content).not.toMatch(forbidden);
  });

  it('keeps prompt hashes unique and stable for the two separated roles', () => {
    const manifests = prompts.map((prompt) => {
      const content = readFileSync(path.resolve(prompt.path), 'utf8');
      const { body } = parsePrompt(content);
      return {
        path: prompt.path,
        role: prompt.judgeRole,
        hash: sha256(body),
      };
    });

    expect(new Set(manifests.map((manifest) => manifest.hash)).size).toBe(manifests.length);
    expect(manifests.map((manifest) => manifest.role)).toEqual([
      'requirements_critical_auditor',
      'final_acceptance_judge',
    ]);
  });

});
