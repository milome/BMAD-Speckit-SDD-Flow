const { createHash } = require('node:crypto');

type CanonicalControlPlaneValue =
  | null
  | boolean
  | number
  | string
  | CanonicalControlPlaneValue[]
  | { [key: string]: CanonicalControlPlaneValue };

interface SetLikeArrayRegistration {
  path: string;
  identityFields?: readonly string[];
}

interface CanonicalControlPlaneOptions {
  setLikeArrays?: readonly SetLikeArrayRegistration[];
}

interface ReceiptHashOptions extends CanonicalControlPlaneOptions {
  selfHashField?: string;
}

type FailureDetails = Record<string, unknown>;
type SetLikeRuleMap = ReadonlyMap<string, readonly string[]>;

function failure(failureClass: string, details: FailureDetails = {}): Error {
  return Object.assign(new Error(failureClass), { failureClass, ...details });
}

function unsupported(path: string, reason: string, value?: unknown): never {
  throw failure('canonical_value_unsupported', {
    path,
    reason,
    valueType: value === null ? 'null' : typeof value,
  });
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function escapePointerSegment(value: string): string {
  return value.replace(/~/gu, '~0').replace(/\//gu, '~1');
}

function compileSetLikeRules(options: CanonicalControlPlaneOptions = {}): SetLikeRuleMap {
  if (!isPlainRecord(options)) unsupported('', 'options_not_plain_object', options);
  const typedOptions = options as CanonicalControlPlaneOptions;
  const unknownOptions = Object.keys(typedOptions).filter((key) => key !== 'setLikeArrays');
  if (unknownOptions.length > 0) {
    unsupported('', 'unknown_canonical_options', unknownOptions);
  }

  const rules = new Map<string, readonly string[]>();
  for (const registration of typedOptions.setLikeArrays ?? []) {
    if (!isPlainRecord(registration)) {
      unsupported('', 'set_like_registration_not_plain_object', registration);
    }
    const unknownFields = Object.keys(registration).filter(
      (key) => key !== 'path' && key !== 'identityFields'
    );
    if (unknownFields.length > 0) {
      unsupported('', 'unknown_set_like_registration_fields', unknownFields);
    }
    if (
      typeof registration.path !== 'string' ||
      (registration.path !== '' && !registration.path.startsWith('/')) ||
      rules.has(registration.path)
    ) {
      unsupported('', 'set_like_path_invalid', registration.path);
    }
    const identityFields = registration.identityFields ?? [];
    if (
      !Array.isArray(identityFields) ||
      identityFields.some((field) => typeof field !== 'string' || field.length === 0) ||
      new Set(identityFields).size !== identityFields.length
    ) {
      unsupported(registration.path, 'set_like_identity_fields_invalid');
    }
    rules.set(registration.path, [...identityFields]);
  }
  return rules;
}

function canonicalIdentity(
  value: CanonicalControlPlaneValue,
  identityFields: readonly string[],
  path: string
): string {
  if (identityFields.length === 0) return JSON.stringify(value);
  if (!isPlainRecord(value)) {
    unsupported(path, 'set_like_identity_requires_object', value);
  }
  const identity: Record<string, CanonicalControlPlaneValue> = {};
  for (const field of [...identityFields].sort()) {
    if (!Object.hasOwn(value, field)) {
      unsupported(path, 'set_like_identity_missing', field);
    }
    identity[field] = value[field] as CanonicalControlPlaneValue;
  }
  return JSON.stringify(identity);
}

function canonicalizeValue(
  value: unknown,
  rules: SetLikeRuleMap,
  path: string,
  ancestors: WeakSet<object>
): CanonicalControlPlaneValue {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) unsupported(path, 'number_not_finite', value);
    return Object.is(value, -0) ? 0 : value;
  }
  if (
    value === undefined ||
    typeof value === 'bigint' ||
    typeof value === 'function' ||
    typeof value === 'symbol'
  ) {
    unsupported(path, 'unsupported_primitive', value);
  }
  if (typeof value !== 'object') unsupported(path, 'unsupported_type', value);
  if (ancestors.has(value)) unsupported(path, 'cyclic_value', value);
  ancestors.add(value);

  try {
    if (Array.isArray(value)) {
      const canonicalItems: CanonicalControlPlaneValue[] = [];
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.hasOwn(value, index)) {
          unsupported(`${path}/${index}`, 'sparse_array', value);
        }
        canonicalItems.push(canonicalizeValue(value[index], rules, `${path}/${index}`, ancestors));
      }
      const identityFields = rules.get(path);
      if (!identityFields) return canonicalItems;
      return canonicalItems
        .map((item) => ({
          item,
          identity: canonicalIdentity(item, identityFields, path),
          canonical: JSON.stringify(item),
        }))
        .sort(
          (left, right) =>
            left.identity.localeCompare(right.identity, 'en') ||
            left.canonical.localeCompare(right.canonical, 'en')
        )
        .map(({ item }) => item);
    }

    if (!isPlainRecord(value)) {
      unsupported(path, 'object_prototype_unregistered', value);
    }
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.some((key) => typeof key !== 'string')) {
      unsupported(path, 'symbol_key_unsupported', value);
    }
    const result: Record<string, CanonicalControlPlaneValue> = {};
    for (const key of (ownKeys as string[]).sort()) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
        unsupported(path, 'property_descriptor_unsupported', key);
      }
      result[key] = canonicalizeValue(
        descriptor.value,
        rules,
        `${path}/${escapePointerSegment(key)}`,
        ancestors
      );
    }
    return result;
  } finally {
    ancestors.delete(value);
  }
}

function canonicalizeControlPlaneValue(
  value: unknown,
  options: CanonicalControlPlaneOptions = {}
): CanonicalControlPlaneValue {
  return canonicalizeValue(value, compileSetLikeRules(options), '', new WeakSet());
}

function stableControlPlaneStringify(
  value: unknown,
  options: CanonicalControlPlaneOptions = {}
): string {
  return JSON.stringify(canonicalizeControlPlaneValue(value, options));
}

function hashControlPlaneValue(value: unknown, options: CanonicalControlPlaneOptions = {}): string {
  return `sha256:${createHash('sha256')
    .update(stableControlPlaneStringify(value, options), 'utf8')
    .digest('hex')}`;
}

function normalizeReceiptOptions(
  options: ReceiptHashOptions | string = {}
): Required<Pick<ReceiptHashOptions, 'selfHashField'>> & CanonicalControlPlaneOptions {
  if (typeof options === 'string') {
    return { selfHashField: options, setLikeArrays: [] };
  }
  if (!isPlainRecord(options)) unsupported('', 'receipt_options_not_plain_object');
  const typedOptions = options as ReceiptHashOptions;
  if (Object.hasOwn(typedOptions, 'expectedHash')) {
    throw failure('canonical_value_unsupported', {
      reason: 'caller_expected_hash_forbidden',
    });
  }
  const unknownOptions = Object.keys(typedOptions).filter(
    (key) => key !== 'selfHashField' && key !== 'setLikeArrays'
  );
  if (unknownOptions.length > 0) {
    unsupported('', 'unknown_receipt_hash_options', unknownOptions);
  }
  const selfHashField = typedOptions.selfHashField ?? 'receiptHash';
  if (typeof selfHashField !== 'string' || selfHashField.length === 0) {
    unsupported('', 'self_hash_field_invalid', selfHashField);
  }
  return {
    selfHashField,
    setLikeArrays: typedOptions.setLikeArrays ?? [],
  };
}

function hashReceiptPayload(receipt: unknown, options: ReceiptHashOptions | string = {}): string {
  const normalizedOptions = normalizeReceiptOptions(options);
  const canonicalOptions = {
    setLikeArrays: normalizedOptions.setLikeArrays,
  };
  const canonical = canonicalizeControlPlaneValue(receipt, canonicalOptions);
  if (!isPlainRecord(canonical)) {
    unsupported('', 'receipt_payload_not_object', receipt);
  }
  const payload = { ...canonical };
  delete payload[normalizedOptions.selfHashField];
  return hashControlPlaneValue(payload, canonicalOptions);
}

function verifyReceiptSelfHash(
  receipt: unknown,
  options: ReceiptHashOptions | string = {}
): boolean {
  const normalizedOptions = normalizeReceiptOptions(options);
  if (!isPlainRecord(receipt)) return false;
  const actualHash = receipt[normalizedOptions.selfHashField];
  if (typeof actualHash !== 'string' || !/^sha256:[0-9a-f]{64}$/u.test(actualHash)) {
    return false;
  }
  return actualHash === hashReceiptPayload(receipt, normalizedOptions);
}

module.exports = {
  canonicalizeControlPlaneValue,
  hashControlPlaneValue,
  hashReceiptPayload,
  stableControlPlaneStringify,
  verifyReceiptSelfHash,
};
