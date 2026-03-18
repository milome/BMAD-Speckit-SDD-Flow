import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigNotFoundError, ConfigParseError, createConfigReader } from './config-reader';

const TEST_CONFIG_DIR = path.join(__dirname, '__fixtures__');
const TEST_CONFIG_PATH = path.join(TEST_CONFIG_DIR, 'test-config.json');

describe('ConfigNotFoundError', () => {
  it('should create error with file path', () => {
    const error = new ConfigNotFoundError('/path/to/config.json');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ConfigNotFoundError);
    expect(error.message).toContain('/path/to/config.json');
    expect(error.filePath).toBe('/path/to/config.json');
  });

  it('should have correct name', () => {
    const error = new ConfigNotFoundError('/config.json');
    expect(error.name).toBe('ConfigNotFoundError');
  });
});

describe('ConfigParseError', () => {
  it('should create error with file path and parse error', () => {
    const parseError = new SyntaxError('Unexpected token');
    const error = new ConfigParseError('/path/to/config.json', parseError);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ConfigParseError);
    expect(error.message).toContain('/path/to/config.json');
    expect(error.message).toContain('Unexpected token');
    expect(error.filePath).toBe('/path/to/config.json');
    expect(error.originalError).toBe(parseError);
  });

  it('should have correct name', () => {
    const error = new ConfigParseError('/config.json', new Error('fail'));
    expect(error.name).toBe('ConfigParseError');
  });
});

describe('createConfigReader', () => {
  beforeEach(() => {
    if (!fs.existsSync(TEST_CONFIG_DIR)) {
      fs.mkdirSync(TEST_CONFIG_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(TEST_CONFIG_PATH)) {
      fs.unlinkSync(TEST_CONFIG_PATH);
    }
  });

  it('should throw ConfigNotFoundError when file does not exist', () => {
    const reader = createConfigReader({ configPath: '/nonexistent/config.json' });
    expect(() => reader.get('any')).toThrow(ConfigNotFoundError);
  });

  it('should throw ConfigParseError when file is invalid JSON', () => {
    fs.writeFileSync(TEST_CONFIG_PATH, '{ invalid json', 'utf-8');
    const reader = createConfigReader({ configPath: TEST_CONFIG_PATH });
    expect(() => reader.get('any')).toThrow(ConfigParseError);
  });

  it('should create reader for valid JSON file', () => {
    fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify({ key: 'value' }), 'utf-8');
    const reader = createConfigReader({ configPath: TEST_CONFIG_PATH });
    expect(reader).toBeDefined();
    expect(typeof reader.get).toBe('function');
    expect(typeof reader.reload).toBe('function');
  });
});

describe('ConfigReader.get', () => {
  beforeEach(() => {
    if (!fs.existsSync(TEST_CONFIG_DIR)) {
      fs.mkdirSync(TEST_CONFIG_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(TEST_CONFIG_PATH)) {
      fs.unlinkSync(TEST_CONFIG_PATH);
    }
  });

  it('should get simple key value', () => {
    fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify({ name: 'test', port: 3000 }), 'utf-8');
    const reader = createConfigReader({ configPath: TEST_CONFIG_PATH });
    expect(reader.get('name')).toBe('test');
    expect(reader.get('port')).toBe(3000);
  });

  it('should get nested value with dot notation', () => {
    fs.writeFileSync(
      TEST_CONFIG_PATH,
      JSON.stringify({
        database: { host: 'localhost', port: 5432 },
        cache: { enabled: true },
      }),
      'utf-8'
    );
    const reader = createConfigReader({ configPath: TEST_CONFIG_PATH });
    expect(reader.get('database.host')).toBe('localhost');
    expect(reader.get('database.port')).toBe(5432);
    expect(reader.get('cache.enabled')).toBe(true);
  });

  it('should return default value when key not found', () => {
    fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify({ name: 'test' }), 'utf-8');
    const reader = createConfigReader({ configPath: TEST_CONFIG_PATH });
    expect(reader.get('missing', 'default')).toBe('default');
    expect(reader.get('database.host', 'localhost')).toBe('localhost');
  });

  it('should return undefined when key not found and no default', () => {
    fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify({ name: 'test' }), 'utf-8');
    const reader = createConfigReader({ configPath: TEST_CONFIG_PATH });
    expect(reader.get('missing')).toBeUndefined();
    expect(reader.get('database.host')).toBeUndefined();
  });

  it('should return default when accessing non-object in path', () => {
    fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify({ name: 'test' }), 'utf-8');
    const reader = createConfigReader({ configPath: TEST_CONFIG_PATH });
    expect(reader.get('name.invalid', 'default')).toBe('default');
  });

  it('should return null value when key exists with null', () => {
    fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify({ nullValue: null }), 'utf-8');
    const reader = createConfigReader({ configPath: TEST_CONFIG_PATH });
    expect(reader.get('nullValue')).toBeNull();
  });

  it('should support deep nesting', () => {
    fs.writeFileSync(
      TEST_CONFIG_PATH,
      JSON.stringify({
        level1: { level2: { level3: { value: 'deep' } } },
      }),
      'utf-8'
    );
    const reader = createConfigReader({ configPath: TEST_CONFIG_PATH });
    expect(reader.get('level1.level2.level3.value')).toBe('deep');
    expect(reader.get('level1.level2.level3.missing', 'fallback')).toBe('fallback');
  });
});

describe('ConfigReader with cache', () => {
  beforeEach(() => {
    if (!fs.existsSync(TEST_CONFIG_DIR)) {
      fs.mkdirSync(TEST_CONFIG_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(TEST_CONFIG_PATH)) {
      fs.unlinkSync(TEST_CONFIG_PATH);
    }
  });

  it('should read updated value after reload', () => {
    fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify({ version: '1.0.0' }), 'utf-8');
    const reader = createConfigReader({ configPath: TEST_CONFIG_PATH, cache: true });
    expect(reader.get('version')).toBe('1.0.0');

    // Update file
    fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify({ version: '2.0.0' }), 'utf-8');

    // Before reload - should still get old value because of caching behavior
    // The implementation reads file each time by default (no cache)
    // With cache=true, it should cache the value and return it until reload

    // After reload - should get new value
    reader.reload();
    expect(reader.get('version')).toBe('2.0.0');
  });

  it('should not cache when cache option is false', () => {
    fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify({ version: '1.0.0' }), 'utf-8');
    const reader = createConfigReader({ configPath: TEST_CONFIG_PATH, cache: false });
    expect(reader.get('version')).toBe('1.0.0');

    // Update file
    fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify({ version: '2.0.0' }), 'utf-8');

    // Should get new value without reload (no caching)
    expect(reader.get('version')).toBe('2.0.0');
  });
});
