import { describe, expect, it } from 'vitest';
import {
  renderFieldView,
  type FieldMetaRegistry,
} from '../../scripts/i18n/render-field-view';
import { loadConfig } from '../../scripts/bmad-config';
import { resolveRuntimePolicy } from '../../scripts/runtime-governance';

function createRegistry(): FieldMetaRegistry {
  return {
    version: 1,
    kind: 'field_meta_registry',
    defaults: {
      fallback_language: 'en',
      default_view_mode: 'user',
      preserve_internal_keys: true,
      preserve_protocol_values: true,
      show_unknown_fields_in_debug: true,
    },
    field_meta: {
      status: {
        type: 'enum',
        visibility: 'user',
        importance: 'high',
        localizable_value: true,
        label: {
          zh: '状态',
          en: 'Status',
        },
        enum_labels: {
          PASS: {
            zh: '通过',
            en: 'Pass',
          },
        },
      },
      artifactDocPath: {
        type: 'path',
        visibility: 'user',
        importance: 'high',
        localizable_value: false,
        label: {
          zh: '产物文档路径',
          en: 'Artifact document path',
        },
      },
      triggerStage: {
        type: 'stage_key',
        visibility: 'advanced',
        importance: 'medium',
        localizable_value: false,
        label: {
          zh: '触发阶段',
          en: 'Trigger stage',
        },
      },
      scoringEnabled: {
        type: 'boolean',
        visibility: 'advanced',
        importance: 'medium',
        localizable_value: false,
        label: { zh: '写分启用', en: 'Scoring enabled' },
        boolean_labels: {
          true: { zh: '是', en: 'Yes' },
          false: { zh: '否', en: 'No' },
        },
      },
      mandatoryGate: {
        type: 'boolean',
        visibility: 'advanced',
        importance: 'medium',
        localizable_value: false,
        label: { zh: '强制门控', en: 'Mandatory gate' },
        boolean_labels: {
          true: { zh: '是', en: 'Yes' },
          false: { zh: '否', en: 'No' },
        },
      },
      granularityGoverned: {
        type: 'boolean',
        visibility: 'advanced',
        importance: 'medium',
        localizable_value: false,
        label: { zh: '粒度受控', en: 'Granularity governed' },
        boolean_labels: {
          true: { zh: '是', en: 'Yes' },
          false: { zh: '否', en: 'No' },
        },
      },
      converged: {
        type: 'boolean',
        visibility: 'advanced',
        importance: 'medium',
        localizable_value: true,
        label: {
          zh: '是否收敛',
          en: 'Converged',
        },
        boolean_labels: {
          true: {
            zh: '是',
            en: 'Yes',
          },
          false: {
            zh: '否',
            en: 'No',
          },
        },
      },
    },
    groups: {
      audit_summary: {
        label: {
          zh: '审计摘要',
          en: 'Audit Summary',
        },
        fields: [
          'status',
          'artifactDocPath',
          'triggerStage',
          'scoringEnabled',
          'mandatoryGate',
          'granularityGoverned',
          'converged',
        ],
      },
    },
  };
}

describe('renderFieldView', () => {
  const registry = createRegistry();
  const data = {
    status: 'PASS',
    artifactDocPath: 'specs/epic-1/story-2/spec.md',
    triggerStage: 'speckit_4_2',
    converged: false,
    unknownField: 'mystery',
  };

  it('renders user view without internal keys', () => {
    const output = renderFieldView({
      data,
      registry,
      language: 'en',
      viewMode: 'user',
      outputFormat: 'list',
    });

    expect(output).toContain('Status: Pass');
    expect(output).toContain('Artifact document path: `specs/epic-1/story-2/spec.md`');
    expect(output).not.toContain('`status`');
    expect(output).not.toContain('Trigger stage');
  });

  it('renders advanced view with internal keys', () => {
    const output = renderFieldView({
      data,
      registry,
      language: 'en',
      viewMode: 'advanced',
      outputFormat: 'list',
    });

    expect(output).toContain('Status (`status`): Pass');
    expect(output).toContain('Trigger stage (`triggerStage`): `speckit_4_2`');
    expect(output).toContain('Converged (`converged`): No');
  });

  it('renders debug view with unknown fields when enabled', () => {
    const output = renderFieldView({
      data,
      registry,
      language: 'en',
      viewMode: 'debug',
      outputFormat: 'list',
    });

    expect(output).toContain('Unknown field (`unknownField`): mystery');
  });

  it('renders bilingual labels as zh / en', () => {
    const output = renderFieldView({
      data,
      registry,
      language: 'bilingual',
      viewMode: 'user',
      outputFormat: 'list',
    });

    expect(output).toContain('状态 / Status: 通过 / Pass');
    expect(output).toContain('产物文档路径 / Artifact document path: `specs/epic-1/story-2/spec.md`');
  });

  it('preserves path and stage_key values byte-for-byte across languages', () => {
    const zhOutput = renderFieldView({
      data,
      registry,
      language: 'zh',
      viewMode: 'advanced',
      outputFormat: 'list',
    });
    const enOutput = renderFieldView({
      data,
      registry,
      language: 'en',
      viewMode: 'advanced',
      outputFormat: 'list',
    });

    expect(zhOutput).toContain('`specs/epic-1/story-2/spec.md`');
    expect(enOutput).toContain('`specs/epic-1/story-2/spec.md`');
    expect(zhOutput).toContain('`speckit_4_2`');
    expect(enOutput).toContain('`speckit_4_2`');
  });

  it('renders doc mode field definitions', () => {
    const output = renderFieldView({
      data: {},
      registry,
      language: 'en',
      viewMode: 'doc',
      outputFormat: 'doc',
    });

    expect(output).toContain('### Status');
    expect(output).toContain('Internal key: `status`');
    expect(output).toContain('Type: `enum`');
  });

  it('NB-4: advanced view keeps governance identifiers (e.g. triggerStage) byte-stable across zh / en / bilingual', () => {
    const config = loadConfig();
    const p = resolveRuntimePolicy({ flow: 'story', stage: 'tasks', config });
    const govData = {
      status: 'PASS',
      artifactDocPath: 'specs/epic-1/story-2/spec.md',
      triggerStage: p.triggerStage,
      scoringEnabled: p.scoringEnabled,
      mandatoryGate: p.mandatoryGate,
      granularityGoverned: p.granularityGoverned,
      converged: false,
    };
    const reg = createRegistry();
    const modes = ['zh', 'en', 'bilingual'] as const;
    const advanced = modes.map((language) =>
      renderFieldView({
        data: govData,
        registry: reg,
        language,
        viewMode: 'advanced',
        outputFormat: 'list',
        includeGroups: true,
        groupKey: 'audit_summary',
      })
    );
    const needle = `\`triggerStage\`): \`${p.triggerStage}\``;
    for (const out of advanced) {
      expect(out).toContain(needle);
    }
  });

  it('keeps field order stable across languages', () => {
    const zhOutput = renderFieldView({
      data,
      registry,
      language: 'zh',
      viewMode: 'advanced',
      outputFormat: 'list',
      includeGroups: true,
      groupKey: 'audit_summary',
    });
    const enOutput = renderFieldView({
      data,
      registry,
      language: 'en',
      viewMode: 'advanced',
      outputFormat: 'list',
      includeGroups: true,
      groupKey: 'audit_summary',
    });

    const zhLines = zhOutput.split('\n').filter(Boolean);
    const enLines = enOutput.split('\n').filter(Boolean);

    expect(zhLines).toHaveLength(enLines.length);
    expect(zhLines[0]).toContain('status');
    expect(enLines[0]).toContain('status');
    expect(zhLines[1]).toContain('artifactDocPath');
    expect(enLines[1]).toContain('artifactDocPath');
  });
});
