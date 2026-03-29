import type { CanonicalMessage, CanonicalSftSample } from './types';

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const SECRET_TOKEN_RE = /\bsk-[A-Za-z0-9]{16,}\b/g;
const PRIVATE_KEY_RE = /BEGIN [A-Z ]+ PRIVATE KEY/;

function redactMessageContent(
  message: CanonicalMessage,
  fieldPath: string
): {
  message: CanonicalMessage;
  findings: CanonicalSftSample['redaction']['findings'];
  redactedFields: string[];
  appliedRules: string[];
  status: CanonicalSftSample['redaction']['status'];
} {
  const findings: CanonicalSftSample['redaction']['findings'] = [];
  const redactedFields: string[] = [];
  const appliedRules: string[] = [];
  let status: CanonicalSftSample['redaction']['status'] = 'clean';

  if (typeof message.content !== 'string') {
    return { message, findings, redactedFields, appliedRules, status };
  }

  let nextContent = message.content;

  if (EMAIL_RE.test(nextContent)) {
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

  if (SECRET_TOKEN_RE.test(nextContent)) {
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
    message: { ...message, content: nextContent },
    findings,
    redactedFields,
    appliedRules,
    status,
  };
}

export function applyCanonicalRedaction(sample: CanonicalSftSample): CanonicalSftSample {
  const findings: CanonicalSftSample['redaction']['findings'] = [];
  const redactedFields: string[] = [];
  const appliedRules = new Set<string>();
  let status: CanonicalSftSample['redaction']['status'] = 'clean';

  const messages = sample.messages.map((message, index) => {
    const result = redactMessageContent(message, `messages[${index}].content`);
    findings.push(...result.findings);
    redactedFields.push(...result.redactedFields);
    result.appliedRules.forEach((rule) => appliedRules.add(rule));
    if (result.status === 'blocked') status = 'blocked';
    if (status !== 'blocked' && result.status === 'redacted') status = 'redacted';
    return result.message;
  });

  return {
    ...sample,
    messages,
    redaction: {
      status,
      applied_rules: [...appliedRules],
      findings,
      redacted_fields: redactedFields,
    },
  };
}
