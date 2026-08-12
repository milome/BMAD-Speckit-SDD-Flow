import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  loadConfiguredRequirementsContractJudgePrompt,
  loadRequirementsContractJudgePromptAsset,
  loadRequirementsContractJudgePromptAssets,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-prompt-loader';

type JsonRecord = Record<string, unknown>;

const roots: string[] = [];
const promptRoot = path.resolve('_bmad/shared/requirements-contract/judge-prompts');
const schemaRoot = path.resolve('packages/bmad-speckit/src/main-agent/source-authority/schemas');

function sha256(value: string | Buffer): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function packageFixture(): string {
  const root = path.join(tmpdir(), `judge-prompt-loader-${process.pid}-${roots.length}`);
  rmSync(root, { recursive: true, force: true });
  roots.push(root);
  mkdirSync(path.join(root, '_bmad', 'shared', 'requirements-contract', 'judge-prompts'), {
    recursive: true,
  });
  mkdirSync(path.join(root, 'src', 'main-agent', 'source-authority', 'schemas'), {
    recursive: true,
  });
  for (const fileName of [
    'requirements-contract-critical-auditor.prompt.md',
  ]) {
    const source = path.join(promptRoot, fileName);
    writeFileSync(
      path.join(root, '_bmad', 'shared', 'requirements-contract', 'judge-prompts', fileName),
      readFileSync(source, 'utf8'),
      'utf8'
    );
  }
  for (const fileName of [
    'requirements-contract-judge-response.schema.json',
  ]) {
    writeFileSync(
      path.join(root, 'src', 'main-agent', 'source-authority', 'schemas', fileName),
      readFileSync(path.join(schemaRoot, fileName), 'utf8'),
      'utf8'
    );
  }
  writeFileSync(path.join(root, 'package.json'), '{"name":"bmad-speckit"}\n', 'utf8');
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('requirements contract Judge prompt loader', () => {
  it('loads both role assets from the package-owned prompt and schema roots', () => {
    const loaded = loadRequirementsContractJudgePromptAssets({ packageRoot: packageFixture() });

    expect(loaded.map((asset) => asset.judgeRole)).toEqual(['requirements_critical_auditor']);
    for (const asset of loaded) {
      expect(asset.schemaVersion).toBe('requirements-contract-judge-prompt-asset/v1');
      expect(asset.prompt.path).toMatch(/^_bmad\/shared\/requirements-contract\/judge-prompts\//u);
      expect(asset.schema.path).toMatch(
        /^(?:src|dist)\/main-agent\/source-authority\/schemas\/requirements-contract-/u
      );
      expect(asset.prompt.hash).toMatch(/^sha256:[a-f0-9]{64}$/u);
      expect(asset.schema.hash).toMatch(/^sha256:[a-f0-9]{64}$/u);
      expect(asset.requestBinding.promptTemplateHash).toBe(asset.prompt.hash);
      expect(asset.requestBinding.assessmentSchemaHash).toBe(asset.schema.hash);
      expect(JSON.stringify(asset)).not.toMatch(/[A-Z]:[\\/]|\/Users\/|\/home\//u);
    }
  });

  it('loads the configurable Requirements prompt body and v2 response schema for dispatch', () => {
    const root = packageFixture();
    const responseSchemaPath = path.join(
      root,
      'src',
      'main-agent',
      'source-authority',
      'schemas',
      'requirements-contract-judge-response.schema.json'
    );
    writeFileSync(
      responseSchemaPath,
      readFileSync(path.join(schemaRoot, 'requirements-contract-judge-response.schema.json'), 'utf8'),
      'utf8'
    );

    const loaded = loadRequirementsContractJudgePromptAsset({
      packageRoot: root,
      judgeRole: 'requirements_critical_auditor',
    });

    expect(loaded.systemPrompt).toContain('Requirements Contract Critical Auditor Judge');
    expect(loaded.structuredOutputSchema).toMatchObject({
      properties: {
        schemaVersion: { const: 'requirements-contract-judge-response/v2' },
        verdict: { enum: ['pass', 'fail'] },
      },
    });
    expect(loaded.prompt.hash).toBe(sha256(loaded.systemPrompt));
  });

  it('loads a project-configured Requirements prompt without a product fallback', () => {
    const root = packageFixture();
    const promptPath = path.join(root, 'config', 'custom-requirements-judge.md');
    mkdirSync(path.dirname(promptPath), { recursive: true });
    writeFileSync(promptPath, 'Consumer configured Requirements Judge prompt.\n', 'utf8');

    const loaded = loadConfiguredRequirementsContractJudgePrompt({
      projectRoot: root,
      promptConfig: {
        systemPromptPath: 'config/custom-requirements-judge.md',
        outputTokenReserve: 8192,
      },
    });

    expect(loaded).toMatchObject({
      systemPrompt: 'Consumer configured Requirements Judge prompt.\n',
      outputTokenReserve: 8192,
      structuredOutputSchema: {
        properties: { verdict: { enum: ['pass', 'fail'] } },
      },
    });
    expect(() =>
      loadConfiguredRequirementsContractJudgePrompt({
        projectRoot: root,
        promptConfig: {
          systemPromptPath: '../outside.md',
          outputTokenReserve: 8192,
        },
      })
    ).toThrow('requirements_contract_judge_prompt_path_escape');
  });

  it('rejects caller path overrides, repository-root fallback, stale hashes, role mismatch, and mutable includes', () => {
    expect(() =>
      loadRequirementsContractJudgePromptAsset({
        packageRoot: packageFixture(),
        judgeRole: 'requirements_critical_auditor',
        promptPath: path.resolve(
          '_bmad/shared/requirements-contract/judge-prompts/requirements-contract-critical-auditor.prompt.md'
        ),
      } as JsonRecord)
    ).toThrow(/judge_prompt_loader_path_override_forbidden/u);

    expect(() =>
      loadRequirementsContractJudgePromptAsset({
        packageRoot: process.cwd(),
        judgeRole: 'requirements_critical_auditor',
      })
    ).toThrow(/judge_prompt_loader_package_root_invalid/u);

    const staleRoot = packageFixture();
    const stalePrompt = path.join(
      staleRoot,
      '_bmad',
      'shared',
      'requirements-contract',
      'judge-prompts',
      'requirements-contract-critical-auditor.prompt.md'
    );
    writeFileSync(stalePrompt, `${readFileSync(stalePrompt, 'utf8')}\n`, 'utf8');
    expect(() =>
      loadRequirementsContractJudgePromptAsset({
        packageRoot: staleRoot,
        judgeRole: 'requirements_critical_auditor',
        expectedPromptHash: sha256('stale'),
      })
    ).toThrow(/judge_prompt_loader_stale_hash/u);

    const mismatchRoot = packageFixture();
    const mismatchPrompt = path.join(
      mismatchRoot,
      '_bmad',
      'shared',
      'requirements-contract',
      'judge-prompts',
      'requirements-contract-critical-auditor.prompt.md'
    );
    writeFileSync(
      mismatchPrompt,
      readFileSync(mismatchPrompt, 'utf8').replace(
        'judgeRole: requirements_critical_auditor',
        'judgeRole: final_acceptance_judge'
      ),
      'utf8'
    );
    expect(() =>
      loadRequirementsContractJudgePromptAsset({
        packageRoot: mismatchRoot,
        judgeRole: 'requirements_critical_auditor',
      })
    ).toThrow(/judge_prompt_loader_role_mismatch/u);

    const mutableRoot = packageFixture();
    const mutablePrompt = path.join(
      mutableRoot,
      '_bmad',
      'shared',
      'requirements-contract',
      'judge-prompts',
      'requirements-contract-critical-auditor.prompt.md'
    );
    writeFileSync(`${mutablePrompt}.include.md`, 'mutable include', 'utf8');
    writeFileSync(`${mutablePrompt}.hash`, 'mutable hash sidecar', 'utf8');
    writeFileSync(
      mutablePrompt,
      `${readFileSync(mutablePrompt, 'utf8')}\n@include ./requirements-contract-critical-auditor.prompt.md.include.md\n`,
      'utf8'
    );
    expect(() =>
      loadRequirementsContractJudgePromptAsset({
        packageRoot: mutableRoot,
        judgeRole: 'requirements_critical_auditor',
      })
    ).toThrow(/judge_prompt_loader_mutable_include_forbidden/u);
  });
});
