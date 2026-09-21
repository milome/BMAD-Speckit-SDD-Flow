import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  executeRequirementsContractRecordGc,
  planRequirementsContractRecordGc,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-record-gc';

const roots: string[] = [];
const hash = (digit: string) => `sha256:${digit.repeat(64)}`;

function root(): string {
  const value = mkdtempSync(path.join(os.tmpdir(), 'requirements-record-gc-'));
  roots.push(value);
  return value;
}

function json(recordRoot: string, relativePath: string, value: unknown): void {
  const target = path.join(recordRoot, ...relativePath.split('/'));
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(value)}\n`, 'utf8');
}

describe('requirements record mark-and-sweep GC', () => {
  afterEach(() => {
    for (const recordRoot of roots.splice(0)) rmSync(recordRoot, { recursive: true, force: true });
  });

  it('retains active roots and live leases while deleting only expired unreachable state', () => {
    const recordRoot = root();
    const active = hash('1');
    const previous = hash('2');
    json(recordRoot, 'record/requirement-record.json', {
      activeAuthority: {
        activeBuildHash: active,
        activeBuildManifestPath: `authoring/builds/${active.slice(7)}/manifest.json`,
        previousBuildHash: previous,
        previousBuildManifestPath: `authoring/builds/${previous.slice(7)}/manifest.json`,
      },
    });
    json(recordRoot, `authoring/builds/${active.slice(7)}/manifest.json`, { schemaVersion: 'build/v1' });
    json(recordRoot, `authoring/builds/${previous.slice(7)}/manifest.json`, { schemaVersion: 'build/v1' });
    json(recordRoot, `authoring/builds/${'3'.repeat(64)}/manifest.json`, { schemaVersion: 'build/v1' });
    json(recordRoot, 'authoring/operations/OP-LIVE/operation.json', {
      status: 'in_progress', leaseExpiresAt: '2026-09-23T00:00:00.000Z', checkpointRefs: [],
    });
    json(recordRoot, 'authoring/operations/OP-OLD/operation.json', {
      status: 'interrupted', leaseExpiresAt: '2026-09-19T00:00:00.000Z', checkpointRefs: [],
    });
    const oldStage = path.join(recordRoot, 'authoring', '.staging', 'OP-OLD');
    const newStage = path.join(recordRoot, 'authoring', '.staging', 'OP-NEW');
    mkdirSync(oldStage, { recursive: true });
    mkdirSync(newStage, { recursive: true });
    writeFileSync(path.join(oldStage, 'manifest.json'), '{}', 'utf8');
    writeFileSync(path.join(newStage, 'manifest.json'), '{}', 'utf8');
    utimesSync(oldStage, new Date('2026-09-18T00:00:00.000Z'), new Date('2026-09-18T00:00:00.000Z'));
    utimesSync(newStage, new Date('2026-09-20T12:00:00.000Z'), new Date('2026-09-20T12:00:00.000Z'));

    const plan = planRequirementsContractRecordGc({ recordRoot, now: '2026-09-21T00:00:00.000Z' });
    expect(plan.retainedPaths).toEqual(expect.arrayContaining([
      `authoring/builds/${active.slice(7)}/manifest.json`,
      `authoring/builds/${previous.slice(7)}/manifest.json`,
      'authoring/operations/OP-LIVE',
    ]));
    expect(plan.deletionPaths).toEqual(expect.arrayContaining([
      `authoring/builds/${'3'.repeat(64)}`,
      'authoring/operations/OP-OLD',
      'authoring/.staging/OP-OLD',
    ]));
    expect(plan.deletionPaths).not.toContain('authoring/.staging/OP-NEW');
    expect(executeRequirementsContractRecordGc({ recordRoot, plan, now: '2026-09-21T00:00:00.000Z' }))
      .toMatchObject({ decision: 'pass', deletedCount: plan.deletionPaths.length });
  });

  it('aborts without deletion when the authority root set changes', () => {
    const recordRoot = root();
    json(recordRoot, 'record/requirement-record.json', { activeAuthority: null });
    const oldStage = path.join(recordRoot, 'authoring', '.staging', 'OP-OLD');
    mkdirSync(oldStage, { recursive: true });
    writeFileSync(path.join(oldStage, 'manifest.json'), '{}', 'utf8');
    utimesSync(oldStage, new Date('2026-09-18T00:00:00.000Z'), new Date('2026-09-18T00:00:00.000Z'));
    const plan = planRequirementsContractRecordGc({ recordRoot, now: '2026-09-21T00:00:00.000Z' });
    json(recordRoot, 'record/requirement-record.json', { activeAuthority: { activeBuildHash: hash('4') } });
    expect(() => executeRequirementsContractRecordGc({ recordRoot, plan, now: '2026-09-21T00:00:00.000Z' }))
      .toThrow('requirements_record_gc_root_set_changed');
    expect(readFileSync(path.join(oldStage, 'manifest.json'), 'utf8')).toBe('{}');
  });

  it('rejects a symlink escape in the deletion path', () => {
    const recordRoot = root();
    const outside = root();
    json(recordRoot, 'record/requirement-record.json', { activeAuthority: null });
    mkdirSync(path.join(recordRoot, 'authoring', '.staging'), { recursive: true });
    symlinkSync(outside, path.join(recordRoot, 'authoring', '.staging', 'ESCAPE'), 'junction');
    const plan = {
      ...planRequirementsContractRecordGc({ recordRoot, now: '2026-09-21T00:00:00.000Z' }),
      deletionPaths: ['authoring/.staging/ESCAPE'],
    };
    expect(() => executeRequirementsContractRecordGc({ recordRoot, plan, now: '2026-09-21T00:00:00.000Z' }))
      .toThrow('requirements_record_gc_path_invalid');
  });
});
