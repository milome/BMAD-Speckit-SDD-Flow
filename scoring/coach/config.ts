import * as fs from 'fs';
import * as path from 'path';
import yaml from 'js-yaml';
import type { CoachConfig } from './types';

const DEFAULT_CONFIG: CoachConfig = {
  required_skill_path: path.join(process.env.USERPROFILE || process.env.HOME || '', '.cursor', 'skills', 'bmad-code-reviewer-lifecycle', 'SKILL.md'),
  auto_trigger_post_impl: false,
  run_mode: 'manual_or_post_impl',
};

function resolveConfigPath(configPath?: string): string {
  if (configPath == null || configPath === '') {
    return path.resolve(process.cwd(), 'config', 'coach-trigger.yaml');
  }
  return path.isAbsolute(configPath) ? configPath : path.resolve(process.cwd(), configPath);
}

export function loadCoachConfig(configPath?: string): CoachConfig {
  const targetPath = resolveConfigPath(configPath);
  if (!fs.existsSync(targetPath)) {
    return { ...DEFAULT_CONFIG };
  }

  const content = fs.readFileSync(targetPath, 'utf-8');
  const parsed = yaml.load(content) as Partial<CoachConfig> | null;
  if (parsed == null || typeof parsed !== 'object') {
    return { ...DEFAULT_CONFIG };
  }

  const rawPath = parsed.required_skill_path ?? DEFAULT_CONFIG.required_skill_path;
  const expanded =
    typeof rawPath === 'string' && rawPath.includes('%USERPROFILE%')
      ? rawPath.replace(/%USERPROFILE%/g, process.env.USERPROFILE || process.env.HOME || '')
      : rawPath;

  return {
    required_skill_path: expanded,
    auto_trigger_post_impl:
      parsed.auto_trigger_post_impl ?? DEFAULT_CONFIG.auto_trigger_post_impl,
    run_mode: parsed.run_mode ?? DEFAULT_CONFIG.run_mode,
  };
}

