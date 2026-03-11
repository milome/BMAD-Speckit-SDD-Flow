/**
 * B04: scoring-trigger-modes.yaml 程序化加载器
 */
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import type { WriteMode } from '../writer/types';

export interface TriggerConfig {
  scoring_write_control: {
    enabled: boolean;
    fail_policy: string;
    call_mapping: Record<string, { event: string; stage: string }>;
  };
  event_to_write_mode: Record<string, Record<string, string>>;
}

export interface TriggerDecision {
  write: boolean;
  writeMode: WriteMode;
  reason: string;
}

let cachedConfig: TriggerConfig | null = null;

/**
 * 清空 trigger 配置缓存，用于测试或热重载。
 * @returns {void}
 */
export function resetTriggerConfigCache(): void {
  cachedConfig = null;
}

/**
 * 加载 scoring-trigger-modes.yaml 配置。
 * @param {string} [configPath] - 配置文件路径，默认 config/scoring-trigger-modes.yaml
 * @returns {TriggerConfig} TriggerConfig 对象
 * @throws 文件不存在或格式无效时抛错
 */
export function loadTriggerConfig(configPath?: string): TriggerConfig {
  if (cachedConfig) {
    return cachedConfig;
  }
  const base = configPath ?? path.resolve(process.cwd(), 'config', 'scoring-trigger-modes.yaml');
  const resolved = path.isAbsolute(base) ? base : path.resolve(process.cwd(), base);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Trigger config not found: ${resolved}`);
  }
  const content = fs.readFileSync(resolved, 'utf-8');
  const raw = yaml.load(content) as unknown;
  if (!raw || typeof raw !== 'object' || !('scoring_write_control' in raw) || !('event_to_write_mode' in raw)) {
    throw new Error(`Invalid trigger config: missing scoring_write_control or event_to_write_mode`);
  }
  cachedConfig = raw as unknown as TriggerConfig;
  return cachedConfig;
}

/**
 * 根据 event、stage、scenario 判断是否应写分及写分模式。
 * @param {string} event - 事件名
 * @param {string} stage - 阶段
 * @param {'real_dev' | 'eval_question'} scenario - real_dev | eval_question
 * @param {string} [configPath] - 可选配置路径
 * @returns {TriggerDecision} TriggerDecision 对象
 */
export function shouldWriteScore(
  event: string,
  stage: string,
  scenario: 'real_dev' | 'eval_question',
  configPath?: string
): TriggerDecision {
  const config = loadTriggerConfig(configPath);
  const { enabled, call_mapping } = config.scoring_write_control;
  if (!enabled) {
    return { write: false, writeMode: 'single_file', reason: 'scoring disabled' };
  }
  const entries = Object.values(call_mapping ?? {});
  const matched = entries.find((e) => e.event === event && e.stage === stage);
  if (!matched) {
    return { write: false, writeMode: 'single_file', reason: 'stage not registered' };
  }
  const eventModes = config.event_to_write_mode?.[event];
  if (!eventModes) {
    return { write: false, writeMode: 'single_file', reason: 'event not in event_to_write_mode' };
  }
  const modeStr = (eventModes[scenario] ?? eventModes.default ?? 'single_file') as string;
  const writeMode: WriteMode =
    modeStr === 'jsonl' ? 'jsonl' : modeStr === 'both' ? 'both' : 'single_file';
  return { write: true, writeMode, reason: 'matched' };
}
