/**
 * A deliberately small JSON Schema validator.
 *
 * It supports exactly the draft-07 subset used by `spec/*.schema.json` and nothing
 * more. Keeping it in-tree means the CLI has zero runtime dependencies, which matters:
 * this tool is meant to be run by people debugging a machine that is already misbehaving.
 *
 * Unsupported keywords are ignored rather than silently treated as satisfied — the schemas
 * in this repo are covered by tests that assert both acceptance and rejection.
 */

export interface SchemaError {
  path: string;
  message: string;
}

type Json = unknown;

interface Schema {
  [key: string]: any;
}

export function validate(schema: Schema, data: Json, root: Schema = schema): SchemaError[] {
  return check(schema, data, '', root);
}

function typeOf(value: Json): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value as number)) return 'integer';
  return typeof value;
}

function matchesType(expected: string, value: Json): boolean {
  const actual = typeOf(value);
  if (expected === 'number') return actual === 'number' || actual === 'integer';
  if (expected === 'integer') return actual === 'integer';
  return actual === expected;
}

function resolveRef(ref: string, root: Schema): Schema {
  if (!ref.startsWith('#/')) throw new Error(`unsupported $ref: ${ref}`);
  let node: any = root;
  for (const segment of ref.slice(2).split('/')) {
    node = node?.[segment.replace(/~1/g, '/').replace(/~0/g, '~')];
    if (node === undefined) throw new Error(`unresolvable $ref: ${ref}`);
  }
  return node as Schema;
}

function check(schema: Schema, data: Json, path: string, root: Schema): SchemaError[] {
  if (schema.$ref) return check(resolveRef(schema.$ref, root), data, path, root);

  const errors: SchemaError[] = [];
  const at = path || '(root)';

  if ('const' in schema && JSON.stringify(data) !== JSON.stringify(schema.const)) {
    errors.push({ path: at, message: `must be ${JSON.stringify(schema.const)}` });
    return errors;
  }

  if (schema.enum && !schema.enum.some((v: Json) => JSON.stringify(v) === JSON.stringify(data))) {
    errors.push({ path: at, message: `must be one of ${schema.enum.map((v: Json) => JSON.stringify(v)).join(', ')}` });
    return errors;
  }

  if (schema.type) {
    const types: string[] = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => matchesType(t, data))) {
      errors.push({ path: at, message: `expected ${types.join(' or ')}, got ${typeOf(data)}` });
      return errors;
    }
  }

  if (typeof data === 'string') {
    if (schema.pattern && !new RegExp(schema.pattern).test(data)) {
      errors.push({ path: at, message: `does not match ${schema.pattern}` });
    }
    if (typeof schema.minLength === 'number' && data.length < schema.minLength) {
      errors.push({ path: at, message: `must not be empty` });
    }
    if (typeof schema.maxLength === 'number' && data.length > schema.maxLength) {
      errors.push({ path: at, message: `must be at most ${schema.maxLength} characters` });
    }
  }

  if (typeof data === 'number') {
    if (typeof schema.minimum === 'number' && data < schema.minimum) {
      errors.push({ path: at, message: `must be >= ${schema.minimum}` });
    }
    if (typeof schema.maximum === 'number' && data > schema.maximum) {
      errors.push({ path: at, message: `must be <= ${schema.maximum}` });
    }
  }

  if (Array.isArray(data)) {
    if (typeof schema.minItems === 'number' && data.length < schema.minItems) {
      errors.push({ path: at, message: `must have at least ${schema.minItems} items` });
    }
    if (schema.items) {
      data.forEach((item, index) => {
        errors.push(...check(schema.items, item, `${path}[${index}]`, root));
      });
    }
  }

  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    const record = data as Record<string, Json>;

    for (const key of schema.required ?? []) {
      if (!(key in record)) {
        errors.push({ path: path ? `${path}.${key}` : key, message: 'is required' });
      }
    }

    const properties: Record<string, Schema> = schema.properties ?? {};
    for (const [key, value] of Object.entries(record)) {
      const child = properties[key];
      if (child) {
        errors.push(...check(child, value, path ? `${path}.${key}` : key, root));
      } else if (schema.additionalProperties === false) {
        errors.push({ path: path ? `${path}.${key}` : key, message: 'is not a recognised field' });
      }
    }
  }

  return errors;
}

export function formatErrors(errors: SchemaError[]): string {
  return errors.map((e) => `  ${e.path}: ${e.message}`).join('\n');
}
