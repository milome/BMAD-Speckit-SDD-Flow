import * as fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { resolveBmadHelpRuntimePolicy } from '../../scripts/bmad-config';
import { stableStringifyPolicy } from '../../scripts/stable-runtime-policy-json';

const repoRoot = process.cwd();

describe('runtime-policy-emit.schema.json (AJV)', () => {
  it('validates success policy JSON from resolveRuntimePolicy', () => {
    const raw = fs.readFileSync(
      path.join(repoRoot, 'docs/reference/runtime-policy-emit.schema.json'),
      'utf8'
    );
    const schema = JSON.parse(raw) as object;
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    const validate = ajv.compile(schema);
    const policy = resolveBmadHelpRuntimePolicy({ flow: 'story', stage: 'specify' });
    const obj = JSON.parse(stableStringifyPolicy(policy)) as object;
    const ok = validate(obj);
    expect(validate.errors).toBeFalsy();
    expect(ok).toBe(true);
    expect((obj as { reviewerContract?: { reviewerIdentity?: string } }).reviewerContract)
      .toMatchObject({ reviewerIdentity: 'bmad_code_reviewer' });
  });

  it('validates success policy JSON when identity carries story/run/artifact fields', () => {
    const raw = fs.readFileSync(
      path.join(repoRoot, 'docs/reference/runtime-policy-emit.schema.json'),
      'utf8'
    );
    const schema = JSON.parse(raw) as object;
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    const validate = ajv.compile(schema);
    const policy = resolveBmadHelpRuntimePolicy({
      flow: 'story',
      stage: 'implement',
      storyId: '14.1',
      runId: 'run-001',
      epicId: 'epic-14',
      artifactRoot: '_bmad-output/implementation-artifacts/epic-14/story-14.1',
      runtimeContext: {
        version: 1,
        flow: 'story',
        stage: 'implement',
        sourceMode: 'full_bmad',
        contextScope: 'story',
        epicId: 'epic-14',
        storyId: '14.1',
        runId: 'run-001',
        artifactRoot: '_bmad-output/implementation-artifacts/epic-14/story-14.1',
        updatedAt: new Date().toISOString(),
      },
    });
    const obj = JSON.parse(stableStringifyPolicy(policy)) as object;
    const ok = validate(obj);
    expect(validate.errors).toBeFalsy();
    expect(ok).toBe(true);
    expect(
      (
        obj as {
          reviewerContract?: { registryVersion?: string; activeAuditConsumer?: { scoreStage?: string } | null };
        }
      ).reviewerContract
    ).toMatchObject({
      registryVersion: 'reviewer_registry_v1',
      activeAuditConsumer: { scoreStage: 'implement' },
    });
  });
});
