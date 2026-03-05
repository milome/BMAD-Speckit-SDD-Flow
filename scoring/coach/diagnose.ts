import * as fs from 'fs';
import * as path from 'path';
import * as veto from '../veto';
import type { EpicStoryRecord } from '../veto';
import { clusterWeaknesses } from '../analytics/cluster-weaknesses';
import { loadCoachConfig } from './config';
import { loadRunRecords } from './loader';
import { loadForbiddenWords, validateForbiddenWords } from './forbidden';
import type {
  CoachDiagnoseOptions,
  CoachDiagnoseResult,
  CoachDiagnosisReport,
} from './types';

interface AiCoachPersona {
  role: string;
  identity: string;
  communication_style: string;
  principles: string[];
}

interface ManifestAgentRow {
  [key: string]: string;
}

const MIN_SAFE_FALLBACK_PERSONA: AiCoachPersona = {
  role: 'AI Code Coach + Iteration Gate Keeper',
  identity:
    '资深工程师视角，聚焦工业级可交付质量。仅基于既有 scoring 与审计结果进行短板诊断和改进建议输出。',
  communication_style: '精准、直接、可执行；结论明确，不使用模糊表述。',
  principles: [
    '只消费已有审计与 scoring 数据，不替代 Reviewer。',
    '未提供 run_id 或无 scoring 数据时，必须拒绝分析。',
    '不执行新的 code review 或审计流程。',
  ],
};

function isSkillAvailable(skillPath: string, forceSkillLoadError: boolean): boolean {
  if (forceSkillLoadError) {
    return false;
  }
  const resolved = path.isAbsolute(skillPath) ? skillPath : path.resolve(process.cwd(), skillPath);
  return fs.existsSync(resolved);
}

function resolveAbsolutePath(inputPath: string): string {
  return path.isAbsolute(inputPath) ? inputPath : path.resolve(process.cwd(), inputPath);
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function readManifestAgentRow(manifestPath: string, agentName: string): ManifestAgentRow | null {
  if (!fs.existsSync(manifestPath)) {
    return null;
  }

  const lines = fs
    .readFileSync(manifestPath, 'utf-8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    return null;
  }

  const header = parseCsvLine(lines[0]);
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length === 0) {
      continue;
    }

    const row: ManifestAgentRow = {};
    for (let j = 0; j < header.length; j++) {
      row[header[j]] = values[j] ?? '';
    }

    if ((row.name ?? '') === agentName) {
      return row;
    }
  }

  return null;
}

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const wrappedByDouble = trimmed.startsWith('"') && trimmed.endsWith('"');
    const wrappedBySingle = trimmed.startsWith("'") && trimmed.endsWith("'");
    if (wrappedByDouble || wrappedBySingle) {
      return trimmed.slice(1, -1).trim();
    }
  }
  return trimmed;
}

function parsePersonaYamlBlock(markdownSource: string): AiCoachPersona | null {
  const yamlBlock = markdownSource.match(/```yaml([\s\S]*?)```/);
  if (yamlBlock == null) {
    return null;
  }

  const lines = yamlBlock[1].split(/\r?\n/);
  let inPersonaSection = false;
  let inPrinciples = false;
  let role = '';
  let identity = '';
  let communicationStyle = '';
  const principles: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      continue;
    }

    if (!inPersonaSection) {
      if (trimmed === 'persona:') {
        inPersonaSection = true;
      }
      continue;
    }

    if (trimmed.startsWith('role:')) {
      role = stripQuotes(trimmed.slice('role:'.length));
      inPrinciples = false;
      continue;
    }
    if (trimmed.startsWith('identity:')) {
      identity = stripQuotes(trimmed.slice('identity:'.length));
      inPrinciples = false;
      continue;
    }
    if (trimmed.startsWith('communication_style:')) {
      communicationStyle = stripQuotes(trimmed.slice('communication_style:'.length));
      inPrinciples = false;
      continue;
    }
    if (trimmed.startsWith('principles:')) {
      inPrinciples = true;
      continue;
    }

    if (inPrinciples && trimmed.startsWith('- ')) {
      principles.push(stripQuotes(trimmed.slice(2)));
      continue;
    }

    if (inPrinciples && /^[a-z_]+:/i.test(trimmed)) {
      inPrinciples = false;
    }
  }

  if (role.length === 0 || identity.length === 0 || communicationStyle.length === 0) {
    return null;
  }
  if (principles.length === 0) {
    return null;
  }

  return {
    role,
    identity,
    communication_style: communicationStyle,
    principles,
  };
}

function loadPersonaFromMarkdownFile(personaPath: string): AiCoachPersona | null {
  if (!fs.existsSync(personaPath)) {
    return null;
  }

  const source = fs.readFileSync(personaPath, 'utf-8');
  return parsePersonaYamlBlock(source);
}

function loadAiCoachPersona(options: CoachDiagnoseOptions): AiCoachPersona {
  const manifestPath = resolveAbsolutePath(
    options.personaManifestPath ?? '_bmad/_config/agent-manifest.csv'
  );
  const manifestRow = readManifestAgentRow(manifestPath, 'ai-coach');

  if (manifestRow != null) {
    const manifestPersonaPath = manifestRow.path;
    if (manifestPersonaPath != null && manifestPersonaPath.trim().length > 0) {
      const fromManifestPath = loadPersonaFromMarkdownFile(resolveAbsolutePath(manifestPersonaPath));
      if (fromManifestPath != null) {
        return fromManifestPath;
      }
    }
  }

  const explicitPersonaPath = resolveAbsolutePath(
    options.personaPath ?? '_bmad/scoring/agents/ai-coach.md'
  );
  const fromExplicitFile = loadPersonaFromMarkdownFile(explicitPersonaPath);
  if (fromExplicitFile != null) {
    return fromExplicitFile;
  }

  return MIN_SAFE_FALLBACK_PERSONA;
}

function buildRecommendations(
  hasStageVeto: boolean,
  epicTriggered: boolean,
  fallbackMode: boolean,
  persona: AiCoachPersona
): string[] {
  const recommendations: string[] = [];
  if (fallbackMode) {
    recommendations.push('fallback 模式已启用：全链路 Skill 不可用，当前诊断基于既有 scoring 数据。');
  }
  if (hasStageVeto) {
    recommendations.push('存在环节 veto 触发，优先修复 veto 对应检查项后再执行下一轮迭代。');
  }
  if (epicTriggered) {
    recommendations.push('Epic veto 条件触发，建议优先处理触发条件对应的高风险问题。');
  }
  if (!hasStageVeto && !epicTriggered) {
    recommendations.push('本轮未触发 veto，建议继续提升低分阶段的稳定性与可维护性。');
  }

  const boundaryRule =
    persona.principles.find(
      (item) => item.includes('不替代') || item.includes('不执行') || item.includes('审计')
    ) ?? '不替代 Reviewer，不执行新审计流程。';
  if (!recommendations.includes(boundaryRule)) {
    recommendations.push(boundaryRule);
  }

  return recommendations;
}

function buildWeakAreas(phaseScores: Record<string, number>): string[] {
  return Object.entries(phaseScores)
    .filter(([, score]) => score < 70)
    .map(([stage]) => stage);
}

export async function coachDiagnose(
  runId: string,
  options: CoachDiagnoseOptions = {}
): Promise<CoachDiagnoseResult> {
  const normalizedRunId = runId.trim();
  const persona = loadAiCoachPersona(options);

  if (normalizedRunId.length === 0) {
    return { error: 'run_not_found', run_id: runId };
  }

  const records = loadRunRecords(normalizedRunId, options.dataPath);
  if (records.length === 0) {
    return { error: 'run_not_found', run_id: normalizedRunId };
  }

  const config = loadCoachConfig(options.configPath);
  const requiredSkillPath = options.requiredSkillPath ?? config.required_skill_path;
  const fallbackMode = !isSkillAvailable(requiredSkillPath, options.forceSkillLoadError === true);
  const rulesDir = options.rulesDir ?? path.resolve(process.cwd(), 'scoring', 'rules');

  const scored = records.map((record) => {
    const result = veto.applyTierAndVeto(
      { ...record, raw_phase_score: record.phase_score },
      { rulesDir }
    );
    return { record, result };
  });

  const phaseScores: Record<string, number> = {};
  for (const item of scored) {
    phaseScores[item.record.stage] = item.result.phase_score;
  }

  const storyRecords: EpicStoryRecord[] = scored.map((item) => ({
    veto_triggered: item.result.veto_triggered,
    phase_score: item.result.phase_score,
    iteration_count: item.record.iteration_count,
    first_pass: item.record.first_pass,
    iteration_records: item.record.iteration_records,
    check_items: item.record.check_items,
  }));

  const hasStageVeto = scored.some((item) => item.result.veto_triggered);
  const hasFatalPhaseZero = scored.some((item) => item.result.phase_score === 0);
  const epicStoryCount = options.epicStoryCount ?? storyRecords.length;
  const passedStoryCount =
    options.passedStoryCount ??
    scored.filter((item) => !item.result.veto_triggered && item.result.phase_score > 0).length;

  const epicVeto = veto.evaluateEpicVeto(
    {
      storyRecords,
      epicStoryCount,
      passedStoryCount,
      testStats: options.testStats,
    },
    { rulesDir }
  );

  // 公式来源：scoring/docs/VETO_AND_ITERATION_RULES.md §3.4.2（AI 代码教练一票否决权）
  const iterationPassed = !epicVeto.triggered && !hasStageVeto && !hasFatalPhaseZero;
  const weakAreas = buildWeakAreas(phaseScores);
  const recommendations = buildRecommendations(hasStageVeto, epicVeto.triggered, fallbackMode, persona);
  const summary = fallbackMode
    ? `fallback 模式诊断完成（run_id=${normalizedRunId}）。已基于既有评分记录输出结果。`
    : `诊断完成（run_id=${normalizedRunId}）。未触发全链路 Skill 降级。`;
  const boundedSummary = `${summary} 角色边界：${persona.role}，仅消费既有 scoring 结果。`;

  let weaknessClusters: CoachDiagnosisReport['weakness_clusters'];
  try {
    weaknessClusters = clusterWeaknesses(records);
  } catch {
    weaknessClusters = [];
  }

  const report: CoachDiagnosisReport = {
    summary: boundedSummary,
    phase_scores: phaseScores,
    weak_areas: weakAreas,
    recommendations,
    iteration_passed: iterationPassed,
    weakness_clusters: weaknessClusters,
  };

  const forbiddenWords = loadForbiddenWords(options.forbiddenWordsPath);
  const validationText = `${report.summary}\n${report.recommendations.join('\n')}`;
  const forbiddenValidation = validateForbiddenWords(validationText, forbiddenWords);
  if (!forbiddenValidation.passed) {
    throw new Error(
      `forbidden_dominant_terms: ${forbiddenValidation.violations.join(',')}`
    );
  }
  if (forbiddenValidation.warnings.length > 0) {
    report.recommendations.push(
      `措辞告警：检测到模糊表述 ${forbiddenValidation.warnings.join('、')}，请替换为明确承诺表达。`
    );
  }

  return report;
}

