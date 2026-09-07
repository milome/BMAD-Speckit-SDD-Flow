function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function typeMatches(value, type) {
  if (type === 'null') return value === null;
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (type === 'integer') return Number.isInteger(value);
  return typeof value === type;
}

function schemaMatches(value, schema) {
  const errors = [];
  validateNode(value, schema, '$', errors);
  return errors.length === 0;
}

function validateNode(value, schema, instancePath, errors) {
  if (schema === true || schema === undefined) return;
  if (schema === false) {
    errors.push(`${instancePath} is forbidden by schema`);
    return;
  }
  if (schema.allOf) {
    for (const child of schema.allOf) validateNode(value, child, instancePath, errors);
  }
  if (schema.oneOf && schema.oneOf.filter((child) => schemaMatches(value, child)).length !== 1) errors.push(`${instancePath} must match exactly one oneOf schema`);
  if (schema.if && schemaMatches(value, schema.if) && schema.then) validateNode(value, schema.then, instancePath, errors);

  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((type) => typeMatches(value, type))) {
      errors.push(`${instancePath} must have type ${types.join('|')}`);
      return;
    }
  }
  if (Object.hasOwn(schema, 'const') && stableJson(value) !== stableJson(schema.const)) errors.push(`${instancePath} must equal the schema constant`);
  if (schema.enum && !schema.enum.some((entry) => stableJson(value) === stableJson(entry))) errors.push(`${instancePath} must be one of the schema enum values`);

  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${instancePath} is shorter than ${schema.minLength}`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(`${instancePath} is longer than ${schema.maxLength}`);
    if (schema.pattern && !new RegExp(schema.pattern, 'u').test(value)) errors.push(`${instancePath} does not match ${schema.pattern}`);
    if (schema.format === 'date-time' && (!Number.isFinite(Date.parse(value)) || !/^\d{4}-\d{2}-\d{2}T/u.test(value))) errors.push(`${instancePath} is not a date-time`);
  }
  if (typeof value === 'number' && schema.minimum !== undefined && value < schema.minimum) errors.push(`${instancePath} is less than ${schema.minimum}`);

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${instancePath} has fewer than ${schema.minItems} items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${instancePath} has more than ${schema.maxItems} items`);
    if (schema.uniqueItems && new Set(value.map(stableJson)).size !== value.length) errors.push(`${instancePath} must contain unique items`);
    if (schema.items) value.forEach((entry, index) => validateNode(entry, schema.items, `${instancePath}[${index}]`, errors));
  }

  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    if (schema.minProperties !== undefined && Object.keys(value).length < schema.minProperties) errors.push(`${instancePath} has fewer than ${schema.minProperties} properties`);
    for (const key of schema.required ?? []) {
      if (!Object.hasOwn(value, key)) errors.push(`${instancePath} is missing required property ${key}`);
    }
    const properties = schema.properties ?? {};
    for (const [key, entry] of Object.entries(value)) {
      const childPath = `${instancePath}.${key}`;
      if (Object.hasOwn(properties, key)) validateNode(entry, properties[key], childPath, errors);
      else if (schema.additionalProperties === false) errors.push(`${childPath} is not allowed`);
      else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') validateNode(entry, schema.additionalProperties, childPath, errors);
    }
  }
}

export function validateJsonSchema(value, schema) {
  const errors = [];
  validateNode(value, schema, '$', errors);
  return errors;
}

export function assertJsonSchema(value, schema, label = 'document') {
  const errors = validateJsonSchema(value, schema);
  if (errors.length) throw new Error(`${label} failed schema validation: ${errors.slice(0, 5).join('; ')}`);
}
