import * as fs from 'fs';
import * as path from 'path';
import yaml from 'js-yaml';

export interface ForbiddenWords {
  dominant_terms: string[];
  ambiguous_terms: string[];
}

export interface ForbiddenValidationResult {
  passed: boolean;
  violations: string[];
  warnings: string[];
}

const DEFAULT_FORBIDDEN_WORDS: ForbiddenWords = {
  dominant_terms: ['面试', '面试官', '应聘', '候选人'],
  ambiguous_terms: ['可选', '可考虑', '后续', '先实现', '后续扩展', '待定', '酌情', '视情况', '技术债'],
};

function resolveForbiddenPath(forbiddenWordsPath?: string): string {
  if (forbiddenWordsPath == null || forbiddenWordsPath === '') {
    return path.resolve(process.cwd(), 'scoring', 'coach', 'forbidden-words.yaml');
  }
  return path.isAbsolute(forbiddenWordsPath)
    ? forbiddenWordsPath
    : path.resolve(process.cwd(), forbiddenWordsPath);
}

function uniqueMatches(text: string, terms: string[]): string[] {
  const hits: string[] = [];
  for (const term of terms) {
    if (text.includes(term) && !hits.includes(term)) {
      hits.push(term);
    }
  }
  return hits;
}

export function loadForbiddenWords(forbiddenWordsPath?: string): ForbiddenWords {
  const filePath = resolveForbiddenPath(forbiddenWordsPath);
  if (!fs.existsSync(filePath)) {
    return { ...DEFAULT_FORBIDDEN_WORDS };
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const parsed = yaml.load(content) as Partial<ForbiddenWords> | null;
  if (parsed == null || typeof parsed !== 'object') {
    return { ...DEFAULT_FORBIDDEN_WORDS };
  }

  return {
    dominant_terms: parsed.dominant_terms ?? DEFAULT_FORBIDDEN_WORDS.dominant_terms,
    ambiguous_terms: parsed.ambiguous_terms ?? DEFAULT_FORBIDDEN_WORDS.ambiguous_terms,
  };
}

export function validateForbiddenWords(
  text: string,
  words: ForbiddenWords = DEFAULT_FORBIDDEN_WORDS
): ForbiddenValidationResult {
  const violations = uniqueMatches(text, words.dominant_terms);
  const warnings = uniqueMatches(text, words.ambiguous_terms);
  return {
    passed: violations.length === 0,
    violations,
    warnings,
  };
}

