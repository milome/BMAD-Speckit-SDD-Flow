import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  resolveFreshRegressionRoot,
  validateFreshRoot,
  shouldRunRealSftExtract,
  runFreshRegressionMatrixMain,
  GOVERNANCE_VITEST_FILES,
  runOptionalNpmScript,
  resolveHostMatrixGateMode,
} from '../../scripts/run-fresh-regression-matrix';

describe('fresh-regression-matrix helpers', () => {
  let tmpBase: string;
  let prevFresh: string | undefined;

  beforeEach(() => {
    tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'fresh-reg-'));
    prevFresh = process.env.FRESH_REGRESSION_ROOT;
  });

  afterEach(() => {
    if (prevFresh === undefined) {
      delete process.env.FRESH_REGRESSION_ROOT;
    } else {
      process.env.FRESH_REGRESSION_ROOT = prevFresh;
    }
    fs.rmSync(tmpBase, { recursive: true, force: true });
  });

  it('resolveFreshRegressionRoot uses env when set', () => {
    process.env.FRESH_REGRESSION_ROOT = tmpBase;
    expect(resolveFreshRegressionRoot('/repo')).toBe(path.resolve(tmpBase));
  });

  it('resolveFreshRegressionRoot defaults to sibling worktree name', () => {
    delete process.env.FRESH_REGRESSION_ROOT;
    const repo = path.join(tmpBase, 'BMAD-Speckit-SDD-Flow');
    expect(resolveFreshRegressionRoot(repo)).toBe(
      path.join(tmpBase, 'BMAD-Speckit-SDD-Flow-01-fresh-regression')
    );
  });

  it('resolveFreshRegressionRoot normalizes feature worktree roots before resolving sibling fresh worktree', () => {
    delete process.env.FRESH_REGRESSION_ROOT;
    const repo = path.join(
      tmpBase,
      'BMAD-Speckit-SDD-Flow',
      '.worktrees',
      'runtime-dashboard-sft'
    );
    expect(resolveFreshRegressionRoot(repo)).toBe(
      path.join(tmpBase, 'BMAD-Speckit-SDD-Flow-01-fresh-regression')
    );
  });

  it('validateFreshRoot fails when directory missing', () => {
    const r = validateFreshRoot(path.join(tmpBase, 'nope'));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toContain('exist');
    }
  });

  it('validateFreshRoot fails when package.json missing', () => {
    const r = validateFreshRoot(tmpBase);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toContain('package.json');
    }
  });

  it('validateFreshRoot fails on invalid JSON', () => {
    fs.writeFileSync(path.join(tmpBase, 'package.json'), '{', 'utf8');
    const r = validateFreshRoot(tmpBase);
    expect(r.ok).toBe(false);
  });

  it('validateFreshRoot fails when name missing', () => {
    fs.writeFileSync(path.join(tmpBase, 'package.json'), JSON.stringify({}), 'utf8');
    const r = validateFreshRoot(tmpBase);
    expect(r.ok).toBe(false);
  });

  it('validateFreshRoot succeeds for minimal valid package.json', () => {
    fs.writeFileSync(
      path.join(tmpBase, 'package.json'),
      JSON.stringify({ name: 'x', version: '1.0.0' }),
      'utf8'
    );
    expect(validateFreshRoot(tmpBase).ok).toBe(true);
  });

  it('shouldRunRealSftExtract is true when AUDIT markdown exists under _bmad-output', () => {
    const auditDir = path.join(tmpBase, '_bmad-output', 'impl');
    fs.mkdirSync(auditDir, { recursive: true });
    fs.writeFileSync(path.join(auditDir, 'AUDIT_foo.md'), '# x\n', 'utf8');
    expect(shouldRunRealSftExtract(tmpBase)).toBe(true);
  });

  it('shouldRunRealSftExtract is true when scoring data dir has json', () => {
    const dataDir = path.join(tmpBase, 'packages', 'scoring', 'data');
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'a.json'), '{}', 'utf8');
    expect(shouldRunRealSftExtract(tmpBase)).toBe(true);
  });

  it('shouldRunRealSftExtract is false when no signals', () => {
    expect(shouldRunRealSftExtract(tmpBase)).toBe(false);
  });

  it('GOVERNANCE_VITEST_FILES matches PRODUCTION 搂0 row 3 file set', () => {
    const expected = [
      'tests/acceptance/bmad-config.test.ts',
      'tests/acceptance/runtime-governance-matrix.test.ts',
      'tests/acceptance/runtime-governance.test.ts',
      'tests/acceptance/runtime-governance-policy.test.ts',
      'tests/acceptance/runtime-governance-scoring-chain.test.ts',
      'tests/acceptance/runtime-governance-mandatory-granularity.test.ts',
    ];
    expect([...GOVERNANCE_VITEST_FILES]).toEqual(expected);
  });

  it('runOptionalNpmScript skips missing optional runtime build script', () => {
    const log: string[] = [];
    const code = runOptionalNpmScript(tmpBase, {}, 'build:runtime-emit', log);

    expect(code).toBe(0);
    expect(log).toContain('SKIP: build:runtime-emit missing; treat as OK');
  });

  it('resolveHostMatrixGateMode falls back to legacy split gate when host-matrix scripts are unavailable', () => {
    expect(resolveHostMatrixGateMode({ 'test:ci': 'npm run init:claude && vitest run' })).toBe(
      'legacy_split'
    );
    expect(
      resolveHostMatrixGateMode({
        'test:ci:host-matrix': 'npm run init:claude && npm run init:cursor && vitest run',
      })
    ).toBe('host_matrix_script');
  });

  it('keeps runtime dashboard and SFT smoke help commands in the fresh regression matrix', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../scripts/run-fresh-regression-matrix.ts'),
      'utf8'
    );

    expect(source).toContain('bmad-speckit runtime-mcp --help');
    expect(source).toContain('bmad-speckit dashboard-live --help');
    expect(source).toContain('bmad-speckit sft-preview --help');
    expect(source).toContain('bmad-speckit sft-bundle --help');
  });
});

describe.skipIf(process.env.RUN_FRESH_REGRESSION_MATRIX !== '1')(
  'fresh-regression-matrix integration',
  () => {
    it('runs full matrix (requires valid fresh worktree)', () => {
      const code = runFreshRegressionMatrixMain();
      expect(code).toBe(0);
    });
  }
);

