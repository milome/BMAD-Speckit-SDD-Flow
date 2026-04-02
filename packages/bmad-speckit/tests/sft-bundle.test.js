const { describe, it } = require('node:test');
const assert = require('node:assert');

let bundleModule;
try {
  bundleModule = require('../src/commands/sft-bundle.js');
} catch {
  bundleModule = null;
}

describe('sft-bundle command', () => {
  it('writes dataset bundle via runtime client and prints bundle directory', async () => {
    assert.ok(bundleModule, 'sft-bundle.js 模块应存在');
    assert.strictEqual(typeof bundleModule.sftBundleCommand, 'function', '应导出 sftBundleCommand');

    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));
    try {
      await bundleModule.sftBundleCommand(
        {
          minScore: '90',
          target: 'openai_chat',
          bundleDir: '_bmad-output/datasets',
          maxTokens: '4096',
          dropNoCodePair: true,
          sourceScope: {
            scope_type: 'story',
            epic_id: 'epic-15-runtime-governance-and-i18n',
            story_key: '2-i18n-bilingual-full-implementation',
            work_item_id: 'story:2-i18n-bilingual-full-implementation',
            board_group_id: 'epic:epic-15-runtime-governance-and-i18n',
          },
        },
        {
          createRuntimeClient() {
            return {
              async request(method, payload) {
                assert.strictEqual(method, 'writeSftBundle');
                assert.deepStrictEqual(payload, {
                  minScore: 90,
                  target: 'openai_chat',
                  bundleDir: '_bmad-output/datasets',
                  maxTokens: 4096,
                  dropNoCodePair: true,
                  sourceScope: {
                    scope_type: 'story',
                    epic_id: 'epic-15-runtime-governance-and-i18n',
                    story_key: '2-i18n-bilingual-full-implementation',
                    work_item_id: 'story:2-i18n-bilingual-full-implementation',
                    board_group_id: 'epic:epic-15-runtime-governance-and-i18n',
                  },
                });
                return {
                  bundle_dir: '_bmad-output/datasets/openai_chat-demo',
                  manifest_path: '_bmad-output/datasets/openai_chat-demo/manifest.json',
                  source_scope: {
                    scope_type: 'story',
                    epic_id: 'epic-15-runtime-governance-and-i18n',
                    story_key: '2-i18n-bilingual-full-implementation',
                    work_item_id: 'story:2-i18n-bilingual-full-implementation',
                    board_group_id: 'epic:epic-15-runtime-governance-and-i18n',
                  },
                  validation_summary: {
                    schema_valid: true,
                    training_ready_passed: true,
                  },
                };
              },
            };
          },
        }
      );
    } finally {
      console.log = originalLog;
    }

    assert.ok(logs.length > 0, '应输出 bundle 结果');
    const payload = JSON.parse(logs[0]);
    assert.deepStrictEqual(payload, {
      bundle_dir: '_bmad-output/datasets/openai_chat-demo',
      manifest_path: '_bmad-output/datasets/openai_chat-demo/manifest.json',
      source_scope: {
        scope_type: 'story',
        epic_id: 'epic-15-runtime-governance-and-i18n',
        story_key: '2-i18n-bilingual-full-implementation',
        work_item_id: 'story:2-i18n-bilingual-full-implementation',
        board_group_id: 'epic:epic-15-runtime-governance-and-i18n',
      },
      validation_summary: {
        schema_valid: true,
        training_ready_passed: true,
      },
    });
  });

  it('score command auto-writes scoped bundle after passing implement audit', async () => {
    const scoreModule = require('../src/commands/score.js');
    let parseCalled = false;
    const runtimeCalls = [];
    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));

    try {
      await scoreModule.scoreCommand(
        {
          reportPath: '_bmad-output/implementation-artifacts/epic-15-runtime-governance-and-i18n/story-2-i18n-bilingual-full-implementation/AUDIT_Story_15-2_stage4.md',
          artifactDocPath: '_bmad-output/implementation-artifacts/epic-15-runtime-governance-and-i18n/story-2-i18n-bilingual-full-implementation/AUDIT_Story_15-2_stage4.md',
          stage: 'implement',
          runId: 'dev-e15-s2-implement-auto-bundle',
          scenario: 'real_dev',
          event: 'stage_audit_complete',
          writeMode: 'single_file',
          skipTriggerCheck: true,
        },
        {
          parseAndWriteScore: async () => {
            parseCalled = true;
            return { phase_score: 95 };
          },
          createRuntimeClient: () => ({
            request: async (method, payload) => {
              runtimeCalls.push([method, payload]);
              return { bundle_id: 'openai_chat-auto-scope' };
            },
          }),
        }
      );
    } finally {
      console.log = originalLog;
    }

    assert.ok(parseCalled, '应先完成评分写入');
    assert.strictEqual(runtimeCalls.length, 1);
    assert.strictEqual(runtimeCalls[0][0], 'writeSftBundle');
    assert.deepStrictEqual(runtimeCalls[0][1].sourceScope, {
      scope_type: 'story',
      epic_id: 'epic-15-runtime-governance-and-i18n',
      story_key: '2-i18n-bilingual-full-implementation',
      work_item_id: 'story:2-i18n-bilingual-full-implementation',
      board_group_id: 'epic:epic-15-runtime-governance-and-i18n',
    });
    assert.ok(logs.some((line) => line.includes('sft-bundle: wrote scoped bundle openai_chat-auto-scope')));
  });

  it('does not auto-write scoped bundle for non-passed implement events', async () => {
    const scoreModule = require('../src/commands/score.js');
    const runtimeCalls = [];

    await scoreModule.scoreCommand(
      {
        reportPath: '_bmad-output/implementation-artifacts/epic-15-runtime-governance-and-i18n/story-2-i18n-bilingual-full-implementation/AUDIT_Story_15-2_stage4.md',
        artifactDocPath: '_bmad-output/implementation-artifacts/epic-15-runtime-governance-and-i18n/story-2-i18n-bilingual-full-implementation/AUDIT_Story_15-2_stage4.md',
        stage: 'implement',
        runId: 'dev-e15-s2-implement-no-auto-bundle',
        scenario: 'real_dev',
        event: 'user_explicit_request',
        writeMode: 'single_file',
        skipTriggerCheck: true,
      },
      {
        parseAndWriteScore: async () => ({ phase_score: 95 }),
        createRuntimeClient: () => ({
          request: async (method, payload) => {
            runtimeCalls.push([method, payload]);
            return { bundle_id: 'should-not-run' };
          },
        }),
      }
    );

    assert.strictEqual(runtimeCalls.length, 0);
  });
});
