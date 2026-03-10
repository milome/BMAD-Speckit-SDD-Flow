/**
 * Story 8.1: 题库 manifest 加载器
 * Schema: scoring/eval-questions/MANIFEST_SCHEMA.md
 */
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

export interface EvalQuestionEntry {
  id: string;
  title: string;
  path: string;
  difficulty?: string;
  tags?: string[];
}

export interface EvalQuestionManifest {
  questions: EvalQuestionEntry[];
}

export function loadManifest(versionDir: string): EvalQuestionManifest {
  const resolvedDir = path.isAbsolute(versionDir)
    ? versionDir
    : path.resolve(process.cwd(), versionDir);
  const manifestPath = path.join(resolvedDir, 'manifest.yaml');

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest not found: ${manifestPath}`);
  }

  const content = fs.readFileSync(manifestPath, 'utf-8');
  const raw = yaml.load(content) as unknown;

  if (!raw || typeof raw !== 'object' || !('questions' in raw)) {
    throw new Error(`Invalid manifest: missing or invalid 'questions' at ${manifestPath}`);
  }

  const questions = (raw as { questions: unknown }).questions;
  if (!Array.isArray(questions)) {
    throw new Error(`Invalid manifest: 'questions' must be an array at ${manifestPath}`);
  }

  const ids = new Set<string>();

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!q || typeof q !== 'object') {
      throw new Error(`Invalid manifest: questions[${i}] must be an object at ${manifestPath}`);
    }
    const obj = q as Record<string, unknown>;

    if (typeof obj.id !== 'string' || !obj.id.trim()) {
      throw new Error(`Invalid manifest: questions[${i}] missing required 'id' at ${manifestPath}`);
    }
    if (typeof obj.title !== 'string' || !obj.title.trim()) {
      throw new Error(`Invalid manifest: questions[${i}] missing required 'title' at ${manifestPath}`);
    }
    if (typeof obj.path !== 'string' || !obj.path.trim()) {
      throw new Error(`Invalid manifest: questions[${i}] missing required 'path' at ${manifestPath}`);
    }

    if (ids.has(obj.id)) {
      throw new Error(`Invalid manifest: duplicate id '${obj.id}' at ${manifestPath}`);
    }
    ids.add(obj.id);

    const filePath = path.join(resolvedDir, obj.path);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Invalid manifest: path '${obj.path}' does not exist at ${manifestPath}`);
    }
  }

  const entries: EvalQuestionEntry[] = questions.map((q) => {
    const o = q as Record<string, unknown>;
    return {
      id: String(o.id),
      title: String(o.title),
      path: String(o.path),
      difficulty: typeof o.difficulty === 'string' ? o.difficulty : undefined,
      tags: Array.isArray(o.tags) ? (o.tags as string[]) : undefined,
    };
  });

  return { questions: entries };
}
