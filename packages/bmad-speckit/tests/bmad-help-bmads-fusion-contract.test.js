const { describe, it } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildBmadHelpOutput, renderBmadHelp } = require('../src/runtime/bmad-help-renderer');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

function materializePackageMirror() {
  const result = spawnSync('node', ['scripts/prepublish-check.js'], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, BMAD_PREPUBLISH_SILENT: '1' },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-help-fusion-'));
  fs.cpSync(path.join(PROJECT_ROOT, '_bmad'), path.join(root, '_bmad'), { recursive: true });
  fs.mkdirSync(path.join(root, '_bmad-output', 'runtime', 'context'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '_bmad-output', 'runtime', 'context', 'project.json'),
    '{"flow":"story","stage":"prd"}\n',
    'utf8'
  );
  const recordsRoot = path.join(root, '_bmad-output', 'runtime', 'requirement-records');
  const recordDir = path.join(recordsRoot, 'REQ-BMAD-HELP-CROSS');
  fs.mkdirSync(recordDir, { recursive: true });
  fs.writeFileSync(
    path.join(recordDir, 'requirement-record.json'),
    `${JSON.stringify(
      {
        recordId: 'REQ-BMAD-HELP-CROSS',
        title: 'BMAD help cross entry',
        currentMentalModel: 'implementation_readiness',
        sourceDocumentHash: 'sha256:source',
        implementationConfirmationHash: 'sha256:confirmation',
        sixModelResults: {
          implementation_readiness: { status: 'pass' },
        },
        updatedAt: '2026-06-01T00:00:00.000Z',
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  fs.writeFileSync(
    path.join(recordsRoot, 'index.json'),
    `${JSON.stringify(
      {
        active: {
          recordId: 'REQ-BMAD-HELP-CROSS',
          recordPath:
            '_bmad-output/runtime/requirement-records/REQ-BMAD-HELP-CROSS/requirement-record.json',
        },
        records: [
          {
            recordId: 'REQ-BMAD-HELP-CROSS',
            recordPath:
              '_bmad-output/runtime/requirement-records/REQ-BMAD-HELP-CROSS/requirement-record.json',
          },
        ],
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  return root;
}

function makeConsumerLikeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-help-consumer-like-'));
  fs.mkdirSync(path.join(root, '_bmad-output', 'runtime', 'context'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '_bmad-output', 'runtime', 'context', 'project.json'),
    '{"flow":"story","stage":"prd"}\n',
    'utf8'
  );
  return root;
}

function headings(markdown) {
  return markdown
    .split(/\r?\n/)
    .filter((line) => /^##\s+/u.test(line))
    .map((line) => line.replace(/^##\s+/u, '').trim());
}

describe('bmad-help and bmads fusion contract', () => {
  it('runs from a consumer project without a local _bmad source tree', () => {
    const root = makeConsumerLikeRoot();
    try {
      const text = renderBmadHelp(buildBmadHelpOutput({ projectRoot: root }));

      assert.equal(fs.existsSync(path.join(root, '_bmad')), false);
      assert.match(text, /# bmad-help/);
      assert.match(text, /## Recommended Next Steps/);
      assert.match(text, /## Upstream Workflow Guidance/);
      assert.match(text, /## See also: bmads/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('preserves bmad-help owning section order while adding only a short runtime cross-entry', () => {
    const root = makeRoot();
    try {
      const text = renderBmadHelp(buildBmadHelpOutput({ projectRoot: root, budget: 'route' }));
      const labels = headings(text);

      assert.ok(labels.indexOf('Status Summary') < labels.indexOf('Recommended Next Steps'));
      assert.ok(labels.indexOf('Recommended Next Steps') < labels.indexOf('Upstream Workflow Guidance'));
      assert.ok(labels.indexOf('Upstream Workflow Guidance') < labels.indexOf('See also: bmads'));
      assert.match(text, /## Runtime Cross-Entry/);
      assert.match(text, /bmad-speckit bmads/);
      assert.match(text, /View Mode: AI-TDD Runtime Six-Model Panorama/);
      assert.match(text, /Primary route or skill: req-trace-matrix-prompt-generator/);
      assert.match(text, /RequirementRecord next safe action wins/);
      assert.doesNotMatch(text, /## Active Requirement Records/);
      assert.doesNotMatch(text, /## Six Mental Model Panorama/);
      assert.doesNotMatch(text, /recordId: REQ-BMAD-HELP-CROSS/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('preserves catalog reference behavior when requested', () => {
    const root = makeRoot();
    try {
      const text = renderBmadHelp(buildBmadHelpOutput({ projectRoot: root }), {
        includeCatalog: true,
      });

      assert.match(text, /## Catalog Reference/);
      assert.match(text, /Display mode:/);
      assert.match(text, /Recommended skill:/);
      assert.match(text, /## Upstream Workflow Guidance/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('documents internal navigator workflow without creating a public skill alias', () => {
    materializePackageMirror();

    const workflow = path.join(PROJECT_ROOT, '_bmad', 'skills', 'ai-tdd-runtime-navigator', 'workflow.md');
    const packageWorkflow = path.join(
      PROJECT_ROOT,
      'packages',
      'bmad-speckit',
      '_bmad',
      'skills',
      'ai-tdd-runtime-navigator',
      'workflow.md'
    );

    assert.equal(fs.existsSync(workflow), true);
    assert.equal(fs.existsSync(packageWorkflow), true);
    assert.equal(
      fs.existsSync(path.join(PROJECT_ROOT, '_bmad', 'skills', 'ai-tdd-runtime-navigator', 'SKILL.md')),
      false
    );
    assert.equal(
      fs.existsSync(
        path.join(
          PROJECT_ROOT,
          'packages',
          'bmad-speckit',
          '_bmad',
          'skills',
          'ai-tdd-runtime-navigator',
          'SKILL.md'
        )
      ),
      false
    );
  });
});
