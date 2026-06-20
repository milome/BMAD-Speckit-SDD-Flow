"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderFieldView = renderFieldView;
function localizeText(text, language) {
    if (!text) {
        return '';
    }
    if (language === 'bilingual') {
        return `${text.zh} / ${text.en}`;
    }
    return text[language];
}
function formatBoolean(value, labels, language, viewMode) {
    if (!labels) {
        return String(value);
    }
    const localized = localizeText(labels[value ? 'true' : 'false'], language);
    if (viewMode === 'debug') {
        return `${localized} (${String(value)})`;
    }
    return localized;
}
function formatEnum(value, labels, language, viewMode) {
    const localized = labels?.[value] ? localizeText(labels[value], language) : value;
    if (viewMode === 'debug' && labels?.[value]) {
        return `${localized} (${value})`;
    }
    return localized;
}
function formatFieldValue(value, meta, language, viewMode) {
    if (value === undefined || value === null) {
        return '';
    }
    switch (meta.type) {
        case 'path':
        case 'command':
        case 'identifier':
        case 'stage_key':
        case 'url':
            return `\`${String(value)}\``;
        case 'boolean':
            return formatBoolean(Boolean(value), meta.boolean_labels, language, viewMode);
        case 'enum':
            return formatEnum(String(value), meta.enum_labels, language, viewMode);
        case 'number': {
            const localizedFormat = meta.format?.[language === 'bilingual' ? 'en' : language];
            if (localizedFormat) {
                return localizedFormat.replace('{value}', String(value));
            }
            return String(value);
        }
        default:
            return String(value);
    }
}
function includeField(meta, viewMode) {
    if (viewMode === 'doc') {
        return true;
    }
    if (viewMode === 'debug') {
        return true;
    }
    if (viewMode === 'advanced') {
        return meta.visibility === 'user' || meta.visibility === 'advanced';
    }
    return meta.visibility === 'user';
}
function orderedFieldKeys(input) {
    if (input.includeGroups && input.groupKey && input.registry.groups?.[input.groupKey]) {
        return input.registry.groups[input.groupKey].fields;
    }
    const importanceOrder = { high: 0, medium: 1, low: 2 };
    return Object.keys(input.registry.field_meta).sort((left, right) => {
        const leftMeta = input.registry.field_meta[left];
        const rightMeta = input.registry.field_meta[right];
        const leftImportance = importanceOrder[leftMeta.importance];
        const rightImportance = importanceOrder[rightMeta.importance];
        if (leftImportance !== rightImportance) {
            return leftImportance - rightImportance;
        }
        return left.localeCompare(right);
    });
}
function renderDocBlock(fieldKey, meta, language) {
    const lines = [
        `### ${localizeText(meta.label, language)}`,
        `- Internal key: \`${fieldKey}\``,
        `- Type: \`${meta.type}\``,
    ];
    const description = localizeText(meta.description, language);
    if (description) {
        lines.push(`- Meaning: ${description}`);
    }
    if (meta.examples?.[0]) {
        lines.push(`- Example: \`${meta.examples[0]}\``);
    }
    return lines.join('\n');
}
function renderListLine(fieldKey, meta, value, language, viewMode) {
    const label = localizeText(meta.label, language);
    if (viewMode === 'user') {
        return `- ${label}: ${value}`;
    }
    return `- ${label} (\`${fieldKey}\`): ${value}`;
}
function renderFieldView(input) {
    const outputFormat = input.outputFormat ?? 'list';
    const lines = [];
    for (const fieldKey of orderedFieldKeys(input)) {
        const meta = input.registry.field_meta[fieldKey];
        if (!includeField(meta, input.viewMode)) {
            continue;
        }
        if (input.viewMode !== 'doc' && !(fieldKey in input.data)) {
            continue;
        }
        if (outputFormat === 'doc' || input.viewMode === 'doc') {
            lines.push(renderDocBlock(fieldKey, meta, input.language));
            continue;
        }
        const renderedValue = formatFieldValue(input.data[fieldKey], meta, input.language, input.viewMode);
        lines.push(renderListLine(fieldKey, meta, renderedValue, input.language, input.viewMode));
    }
    if (input.viewMode === 'debug' && input.registry.defaults.show_unknown_fields_in_debug) {
        for (const [fieldKey, value] of Object.entries(input.data)) {
            if (!input.registry.field_meta[fieldKey]) {
                lines.push(`- Unknown field (\`${fieldKey}\`): ${String(value)}`);
            }
        }
    }
    if (outputFormat === 'table' && input.viewMode !== 'doc') {
        const rows = lines.map((line) => {
            const content = line.replace(/^- /, '');
            const splitIndex = content.indexOf(': ');
            const field = splitIndex === -1 ? content : content.slice(0, splitIndex);
            const value = splitIndex === -1 ? '' : content.slice(splitIndex + 2);
            return `| ${field} | ${value} |`;
        });
        return ['| Field | Value |', '|---|---|', ...rows].join('\n');
    }
    return lines.join('\n');
}
