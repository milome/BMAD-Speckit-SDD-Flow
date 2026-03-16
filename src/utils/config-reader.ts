import * as fs from 'fs';
import * as path from 'path';

/**
 * Error thrown when configuration file is not found
 */
export class ConfigNotFoundError extends Error {
  readonly filePath: string;

  constructor(filePath: string) {
    super(`Configuration file not found: ${filePath}`);
    this.name = 'ConfigNotFoundError';
    this.filePath = filePath;
  }
}

/**
 * Error thrown when configuration file cannot be parsed
 */
export class ConfigParseError extends Error {
  readonly filePath: string;
  readonly originalError: Error;

  constructor(filePath: string, originalError: Error) {
    super(`Failed to parse configuration file ${filePath}: ${originalError.message}`);
    this.name = 'ConfigParseError';
    this.filePath = filePath;
    this.originalError = originalError;
  }
}

/**
 * Configuration reader options
 */
export interface ConfigReaderOptions {
  /** Path to configuration file (relative to project root) */
  configPath: string;
  /** Whether to cache configuration content */
  cache?: boolean;
}

/**
 * Configuration reader interface
 */
export interface ConfigReader {
  /**
   * Get configuration value by key
   * @param key - Key to retrieve (supports dot notation for nested values)
   * @param defaultValue - Default value if key not found
   * @returns The configuration value or defaultValue/undefined
   */
  get<T>(key: string, defaultValue?: T): T | undefined;

  /**
   * Reload configuration (clears cache)
   */
  reload(): void;
}

/**
 * Get nested value from object using dot notation key
 * @param obj - Source object
 * @param key - Dot notation key
 * @returns The value or undefined
 */
function getNestedValue(obj: Record<string, unknown>, key: string): unknown {
  const keys = key.split('.');
  let value: unknown = obj;

  for (const k of keys) {
    if (value === null || typeof value !== 'object') {
      return undefined;
    }
    value = (value as Record<string, unknown>)[k];
  }

  return value;
}

/**
 * Load configuration from file
 * @param filePath - Absolute path to config file
 * @returns Parsed configuration object
 */
function loadConfig(filePath: string): Record<string, unknown> {
  if (!fs.existsSync(filePath)) {
    throw new ConfigNotFoundError(filePath);
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch (error) {
    throw new ConfigParseError(filePath, error as Error);
  }
}

/**
 * Create a configuration reader
 * @param options - Configuration reader options
 * @returns ConfigReader instance
 */
export function createConfigReader(options: ConfigReaderOptions): ConfigReader {
  const fullPath = path.resolve(options.configPath);
  const useCache = options.cache ?? false;
  let cachedConfig: Record<string, unknown> | null = null;

  function getConfig(): Record<string, unknown> {
    if (useCache && cachedConfig !== null) {
      return cachedConfig;
    }
    const config = loadConfig(fullPath);
    if (useCache) {
      cachedConfig = config;
    }
    return config;
  }

  return {
    get<T>(key: string, defaultValue?: T): T | undefined {
      const config = getConfig();
      const value = getNestedValue(config, key);

      if (value === undefined) {
        return defaultValue;
      }

      return value as T;
    },

    reload(): void {
      cachedConfig = null;
    },
  };
}
