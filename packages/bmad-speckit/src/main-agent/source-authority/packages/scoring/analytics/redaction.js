"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyCanonicalRedaction = applyCanonicalRedaction;
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const SECRET_TOKEN_RE = /\bsk-[A-Za-z0-9]{16,}\b/g;
const PRIVATE_KEY_RE = /BEGIN [A-Z ]+ PRIVATE KEY/;
function isRecord(value) {
    return value != null && typeof value === 'object' && !Array.isArray(value);
}
function redactStringField(value, fieldPath) {
    const findings = [];
    const redactedFields = [];
    const appliedRules = [];
    let status = 'clean';
    let nextContent = value;
    EMAIL_RE.lastIndex = 0;
    if (EMAIL_RE.test(nextContent)) {
        EMAIL_RE.lastIndex = 0;
        nextContent = nextContent.replace(EMAIL_RE, '[REDACTED_EMAIL]');
        findings.push({
            kind: 'pii_email',
            severity: 'medium',
            field_path: fieldPath,
            action: 'redact',
        });
        appliedRules.push('email');
        redactedFields.push(fieldPath);
        status = 'redacted';
    }
    SECRET_TOKEN_RE.lastIndex = 0;
    if (SECRET_TOKEN_RE.test(nextContent)) {
        SECRET_TOKEN_RE.lastIndex = 0;
        nextContent = nextContent.replace(SECRET_TOKEN_RE, '[REDACTED_SECRET]');
        findings.push({
            kind: 'secret_token',
            severity: 'high',
            field_path: fieldPath,
            action: 'redact',
        });
        appliedRules.push('secret-token');
        redactedFields.push(fieldPath);
        status = 'redacted';
    }
    if (PRIVATE_KEY_RE.test(nextContent)) {
        findings.push({
            kind: 'private_key',
            severity: 'critical',
            field_path: fieldPath,
            action: 'block',
        });
        appliedRules.push('private-key');
        redactedFields.push(fieldPath);
        status = 'blocked';
    }
    return {
        value: nextContent,
        findings,
        redactedFields,
        appliedRules,
        status,
    };
}
function redactMessageContent(message, fieldPath) {
    const result = redactUnknownStringLeaves(message.content, fieldPath);
    return {
        message: { ...message, content: result.value },
        findings: result.findings,
        redactedFields: result.redactedFields,
        appliedRules: result.appliedRules,
        status: result.status,
    };
}
function redactUnknownStringLeaves(value, fieldPath) {
    if (typeof value === 'string') {
        const result = redactStringField(value, fieldPath);
        return {
            value: result.value,
            findings: result.findings,
            redactedFields: result.redactedFields,
            appliedRules: result.appliedRules,
            status: result.status,
        };
    }
    if (Array.isArray(value)) {
        const findings = [];
        const redactedFields = [];
        const appliedRules = new Set();
        let status = 'clean';
        const nextValue = value.map((item, index) => {
            const nested = redactUnknownStringLeaves(item, `${fieldPath}[${index}]`);
            findings.push(...nested.findings);
            redactedFields.push(...nested.redactedFields);
            nested.appliedRules.forEach((rule) => appliedRules.add(rule));
            if (nested.status === 'blocked')
                status = 'blocked';
            if (status !== 'blocked' && nested.status === 'redacted')
                status = 'redacted';
            return nested.value;
        });
        return {
            value: nextValue,
            findings,
            redactedFields,
            appliedRules: [...appliedRules],
            status,
        };
    }
    if (isRecord(value)) {
        const findings = [];
        const redactedFields = [];
        const appliedRules = new Set();
        let status = 'clean';
        const nextValue = {};
        for (const [key, nestedValue] of Object.entries(value)) {
            const nested = redactUnknownStringLeaves(nestedValue, `${fieldPath}.${key}`);
            findings.push(...nested.findings);
            redactedFields.push(...nested.redactedFields);
            nested.appliedRules.forEach((rule) => appliedRules.add(rule));
            if (nested.status === 'blocked')
                status = 'blocked';
            if (status !== 'blocked' && nested.status === 'redacted')
                status = 'redacted';
            nextValue[key] = nested.value;
        }
        return {
            value: nextValue,
            findings,
            redactedFields,
            appliedRules: [...appliedRules],
            status,
        };
    }
    return {
        value,
        findings: [],
        redactedFields: [],
        appliedRules: [],
        status: 'clean',
    };
}
function mergeRedactionResult(target, result) {
    target.findings.push(...result.findings);
    target.redactedFields.push(...result.redactedFields);
    result.appliedRules.forEach((rule) => target.appliedRules.add(rule));
    if (result.status === 'blocked') {
        return 'blocked';
    }
    if (target.status !== 'blocked' && result.status === 'redacted') {
        return 'redacted';
    }
    return target.status;
}
function applyCanonicalRedaction(sample) {
    const findings = [];
    const redactedFields = [];
    const appliedRules = new Set();
    let status = 'clean';
    const messages = sample.messages.map((message, index) => {
        const result = redactMessageContent(message, `messages[${index}].content`);
        status = mergeRedactionResult({ findings, redactedFields, appliedRules, status }, result);
        if (!result.message.tool_calls || result.message.tool_calls.length === 0) {
            return result.message;
        }
        const toolCalls = result.message.tool_calls.map((toolCall, toolCallIndex) => {
            const argumentResult = redactStringField(toolCall.function.arguments, `messages[${index}].tool_calls[${toolCallIndex}].function.arguments`);
            status = mergeRedactionResult({ findings, redactedFields, appliedRules, status }, argumentResult);
            return {
                ...toolCall,
                function: {
                    ...toolCall.function,
                    arguments: argumentResult.value,
                },
            };
        });
        return {
            ...result.message,
            tool_calls: toolCalls,
        };
    });
    const tools = sample.tools?.map((tool, toolIndex) => {
        const descriptionResult = tool.function.description != null
            ? redactStringField(tool.function.description, `tools[${toolIndex}].function.description`)
            : {
                value: undefined,
                findings: [],
                redactedFields: [],
                appliedRules: [],
                status: 'clean',
            };
        status = mergeRedactionResult({ findings, redactedFields, appliedRules, status }, descriptionResult);
        const parametersResult = redactUnknownStringLeaves(tool.function.parameters, `tools[${toolIndex}].function.parameters`);
        status = mergeRedactionResult({ findings, redactedFields, appliedRules, status }, parametersResult);
        return {
            ...tool,
            function: {
                ...tool.function,
                ...(tool.function.description != null ? { description: descriptionResult.value } : {}),
                parameters: parametersResult.value,
            },
        };
    });
    return {
        ...sample,
        messages,
        ...(tools ? { tools } : {}),
        redaction: {
            status,
            applied_rules: [...appliedRules],
            findings,
            redacted_fields: redactedFields,
        },
    };
}
