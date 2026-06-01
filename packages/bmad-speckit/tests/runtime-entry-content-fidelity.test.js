const { describe, it } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const PROJECT_ROOT = path.resolve(PACKAGE_ROOT, '..', '..');
const PACKAGE_CLI = path.join(PACKAGE_ROOT, 'bin', 'bmad-speckit.js');

function makeRuntimeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-entry-fidelity-'));
  const recordId = 'REQ-ENTRY-FIDELITY';
  const recordsRoot = path.join(root, '_bmad-output', 'runtime', 'requirement-records');
  const recordRoot = path.join(recordsRoot, recordId);
  fs.mkdirSync(recordRoot, { recursive: true });
  fs.writeFileSync(
    path.join(recordRoot, 'requirement-record.json'),
    `${JSON.stringify(
      {
        recordId,
        title: 'Runtime entry fidelity fixture',
        currentMentalModel: 'architecture_confirmation',
        sourceDocumentHash: 'sha256:fidelity-source',
        implementationConfirmationHash: 'sha256:fidelity-confirmation',
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
          recordId,
          recordPath: `_bmad-output/runtime/requirement-records/${recordId}/requirement-record.json`,
        },
        records: [
          {
            recordId,
            recordPath: `_bmad-output/runtime/requirement-records/${recordId}/requirement-record.json`,
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

function runCli(args) {
  return execFileSync(process.execPath, [PACKAGE_CLI, ...args], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      BMAD_LANG: '',
      LC_ALL: 'C',
      LC_MESSAGES: 'C',
      LANG: 'C',
    },
  });
}

function section(markdown, heading, nextHeadingPattern = /^## /mu) {
  const start = markdown.indexOf(heading);
  assert.notEqual(start, -1, `missing section ${heading}`);
  const bodyStart = start + heading.length;
  const rest = markdown.slice(bodyStart);
  const next = rest.search(nextHeadingPattern);
  return next === -1 ? rest : rest.slice(0, next);
}

function assertOrdered(text, headings) {
  let previous = -1;
  for (const heading of headings) {
    const current = text.indexOf(heading);
    assert.notEqual(current, -1, `missing heading ${heading}`);
    assert.ok(current > previous, `${heading} should appear after previous heading`);
    previous = current;
  }
}

function countMatches(text, pattern) {
  return [...text.matchAll(pattern)].length;
}

describe('runtime entry content fidelity contract', () => {
  it('keeps bmads and bmad-speckit stdout identical for the same runtime state', () => {
    const root = makeRuntimeRoot();
    try {
      const bmads = runCli(['bmads', '--cwd', root]);
      const alias = runCli(['bmad-speckit', '--cwd', root]);

      assert.equal(alias, bmads);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('preserves full Current Actionable Requirement Records fields in bmads stdout', () => {
    const root = makeRuntimeRoot();
    try {
      const text = runCli(['bmads', '--cwd', root]);
      const records = section(
        text,
        '## Current Actionable Requirement Records',
        /^## Six Mental Model Panorama/mu
      );

      for (const fragment of [
        '- recordId: REQ-ENTRY-FIDELITY (first safe action)',
        'source/title: Runtime entry fidelity fixture',
        'first safe-action reason: indexed_active_record',
        'selected by user: no',
        'runtime index pointer: yes',
        'runtime index pointer status: trusted_pointer',
        'activity state: current_actionable',
        'current mental model: architecture_confirmation',
        'schema model status: not_established',
        'display state: not_established',
        'blocker summary: none',
        'next safe action: prepare_architecture_confirmation',
        'updatedAt/current: 2026-06-01T00:00:00.000Z',
        'current attempt/hash: sha256:fidelity-source',
      ]) {
        assert.match(records, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('preserves all six panorama entries and does not highlight terminal events as actions', () => {
    const root = makeRuntimeRoot();
    try {
      const text = runCli(['bmads', '--cwd', root]);
      const panorama = section(
        text,
        '## Six Mental Model Panorama',
        /^## Runtime Workflow Guidance/mu
      );

      for (const fragment of [
        '1/6. Requirement Confirmation (requirement_confirmation)',
        '2/6. Architecture Confirmation (architecture_confirmation)',
        '3/6. Implementation Readiness (implementation_readiness)',
        '4/6. Execution Closure (execution_closure)',
        '5/6. Audit Review (audit_review)',
        '6/6. Delivery Confirmation (delivery_confirmation)',
      ]) {
        assert.match(panorama, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      }
      assert.equal(countMatches(panorama, /^ {2}Question: /gmu), 6);
      assert.equal(countMatches(panorama, /^ {2}Status: /gmu), 6);
      assert.equal(countMatches(panorama, /^ {2}Evidence source: /gmu), 6);
      assert.equal(countMatches(panorama, /^ {2}Route basis: /gmu), 6);
      assert.equal(countMatches(panorama, /^ {2}terminalEvent: /gmu), 6);
      assert.doesNotMatch(panorama, /current position is 2\/6/i);
      assert.doesNotMatch(text, /`record_closed`/u);

      for (const codeSpan of [
        '`bmad-speckit bmad-help`',
        '`requirements-contract-authoring`',
      ]) {
        assert.ok(text.includes(codeSpan), `missing code span ${codeSpan}`);
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('renders Available Next Actions with user-executable skills and prompt fallback', () => {
    const root = makeRuntimeRoot();
    try {
      const text = runCli(['bmads', '--cwd', root]);
      assertOrdered(text, [
        '## Recommended Next Steps',
        '## Available Next Actions',
        '## Current Actionable Requirement Records',
      ]);
      const actions = section(
        text,
        '## Available Next Actions',
        /^## Current Actionable Requirement Records/mu
      );

      for (const fragment of [
        '### Recommended Now',
        'Current route: architecture_confirmation',
        'Next safe action: prepare_architecture_confirmation',
        'This route has no dedicated public skill. Use the suggested prompt below.',
        'Suggested prompt:',
        'Do not proceed to implementation until architecture confirmation is complete.',
        '### Core Skills',
        '- Skill: `requirements-contract-authoring`',
        'Typical action: author-confirmation-ready-source',
        '- Skill: `req-trace-matrix-prompt-generator`',
        '- Skill: `goal-execution-contract-generator`',
        '- Skill: `grill-with-docs`',
        '- Skill: `docs-review`',
        '### Navigation',
        '- Runtime console: `bmad-speckit bmads`',
        '- BMAD workflow help: `bmad-speckit bmad-help`',
      ]) {
        assert.match(actions, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      }
      assert.doesNotMatch(actions, /^- Skill: `prepare_architecture_confirmation`/mu);
      assert.doesNotMatch(actions, /^- Skill: `author-confirmation-ready-source`/mu);
      assert.doesNotMatch(actions, /^- Skill: `confirm-closeout-acceptance`/mu);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('renders zh-CN Available Next Actions with the same executable skill set', () => {
    const root = makeRuntimeRoot();
    try {
      const text = runCli(['bmads', '--cwd', root, '--lang', 'zh-CN']);
      assertOrdered(text, ['## 推荐下一步', '## 可用下一步', '## 可继续推进的需求记录']);
      const actions = section(text, '## 可用下一步', /^## 可继续推进的需求记录/mu);

      for (const fragment of [
        '### 当前推荐',
        '当前 route：architecture_confirmation',
        '下一安全动作：prepare_architecture_confirmation',
        '这个 route 没有专属公开技能，请复制下面提示词执行。',
        '推荐提示词：',
        '不要进入实现，直到架构确认完成。',
        '### 核心技能',
        '- 技能： `requirements-contract-authoring`',
        '常用动作：author-confirmation-ready-source',
        '- 技能： `req-trace-matrix-prompt-generator`',
        '- 技能： `goal-execution-contract-generator`',
        '- 技能： `grill-with-docs`',
        '- 技能： `docs-review`',
        '### 导航',
        '- Runtime console：`bmad-speckit bmads`',
        '- BMAD workflow help：`bmad-speckit bmad-help`',
      ]) {
        assert.match(actions, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      }
      assert.doesNotMatch(actions, /^- 技能： `prepare_architecture_confirmation`/mu);
      assert.doesNotMatch(actions, /^- 技能： `author-confirmation-ready-source`/mu);
      assert.doesNotMatch(actions, /^- 技能： `confirm-closeout-acceptance`/mu);
      assert.doesNotMatch(text, /`record_closed`/u);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('preserves bmad-help owning workflow sections and code spans in renderer stdout', () => {
    const text = runCli(['bmad-help']);

    for (const fragment of [
      '# bmad-help',
      '## Status Summary',
      '## Runtime Cross-Entry',
      '## Recommended Next Steps',
      '## Upstream Workflow Guidance',
      '### Official Execution Paths',
      '## See also: bmads',
      '`bmad-speckit bmads`',
      '`bmad-bmm-correct-course`',
      '`bmad-bmm-sprint-status`',
    ]) {
      assert.match(text, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
    assert.doesNotMatch(text, /## Six Mental Model Panorama/);
    assert.doesNotMatch(text, /recordId: REQ-/);
  });

  it('does not treat NOT READY implementation-readiness reports as ready', () => {
    const root = makeRuntimeRoot();
    try {
      const artifactRoot = path.join(root, '_bmad-output', 'planning-artifacts');
      fs.mkdirSync(artifactRoot, { recursive: true });
      fs.writeFileSync(
        path.join(artifactRoot, 'implementation-readiness-report-2026-06-01.md'),
        '# Implementation Readiness\n\nOverall Readiness Status\n\n**NOT READY**\n',
        'utf8'
      );

      const text = runCli(['bmad-help', '--cwd', root]);

      assert.match(text, /implementation-readiness \| evidence_present_refresh_if_scope_changed/);
      assert.match(
        text,
        /Implementation-first recommendations require ready_clean or repair_closed readiness evidence/
      );
      assert.doesNotMatch(text, /implementation-readiness \| ready_clean/);
      assert.doesNotMatch(text, /implementation-readiness \| repair_closed/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
