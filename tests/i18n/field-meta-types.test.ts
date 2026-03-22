import { describe, expect, it } from 'vitest';
import type { FieldMetaRegistry } from '../../scripts/i18n/field-meta-types';

describe('field-meta-types', () => {
  it('accepts the repository field meta registry shape', () => {
    const registry: FieldMetaRegistry = {
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
      },
    };

    expect(registry.kind).toBe('field_meta_registry');
    expect(registry.field_meta.status.type).toBe('enum');
  });
});
