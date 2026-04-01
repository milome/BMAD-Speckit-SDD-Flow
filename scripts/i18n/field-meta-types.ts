export type LocalizedText = {
  zh: string;
  en: string;
};

export type FieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'path'
  | 'command'
  | 'identifier'
  | 'enum'
  | 'stage_key'
  | 'url'
  | 'markdown';

export type FieldVisibility = 'user' | 'advanced' | 'debug';
export type ViewMode = 'user' | 'advanced' | 'debug' | 'doc';
export type RenderOutputFormat = 'list' | 'table' | 'doc';

export interface EnumLabelMap {
  [value: string]: LocalizedText;
}

export interface BooleanLabelMap {
  true: LocalizedText;
  false: LocalizedText;
}

export interface FieldFormat {
  zh?: string;
  en?: string;
}

export interface FieldMeta {
  type: FieldType;
  visibility: FieldVisibility;
  importance: 'high' | 'medium' | 'low';
  localizable_value: boolean;
  label: LocalizedText;
  description?: LocalizedText;
  examples?: string[];
  enum_labels?: EnumLabelMap;
  boolean_labels?: BooleanLabelMap;
  format?: FieldFormat;
}

export interface FieldGroup {
  label: LocalizedText;
  fields: string[];
}

export interface FieldMetaRegistry {
  version: number;
  kind: 'field_meta_registry';
  defaults: {
    fallback_language: 'zh' | 'en';
    default_view_mode: ViewMode;
    preserve_internal_keys: true;
    preserve_protocol_values: true;
    show_unknown_fields_in_debug: boolean;
  };
  field_meta: Record<string, FieldMeta>;
  groups?: Record<string, FieldGroup>;
}
