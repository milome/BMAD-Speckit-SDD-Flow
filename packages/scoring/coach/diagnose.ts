import * as fs from 'fs';
import * as path from 'path';
import * as veto from '../veto';
import { resolveRulesDir } from '../constants/path';
import type { EpicStoryRecord } from '../veto';
import { clusterWeaknesses } from '../analytics/cluster-weaknesses';
import { buildJourneyContractRemediationHints } from '../analytics/journey-contract-remediation';
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
    'Senior-engineer lens: industrial-grade deliverables. Diagnosis uses only existing scoring and audit artifacts.',
  communication_style: 'Precise, direct, actionable; clear conclusions, no vague wording.',
  principles: [
    'Consume only existing audit and scoring data; do not replace the Reviewer.',
    'Refuse analysis when run_id is missing or there is no scoring data.',
    'Do not run new code review or audit flows.',
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
    recommendations.push(
      'Fallback mode: end-to-end Skill unavailable; diagnosis uses existing scoring data only.'
    );
  }
  if (hasStageVeto) {
    recommendations.push(
      'Stage veto triggered: fix the corresponding check items before the next iteration.'
    );
  }
  if (epicTriggered) {
    recommendations.push(
      'Epic veto triggered: prioritize high-risk issues that match the trigger conditions.'
    );
  }
  if (!hasStageVeto && !epicTriggered) {
    recommendations.push(
      'No veto this run: continue improving stability and maintainability of lower-scoring stages.'
    );
  }

  const boundaryRule =
    persona.principles.find(
      (item) =>
        /Reviewer|audit flow|does not replace|Do not run/i.test(item) ||
        item.includes('不替代') ||
        item.includes('不执行') ||
        item.includes('审计')
    ) ?? 'Does not replace Reviewer; does not run new audit flows.';
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

/**
 * Coach 诊断入口：基于 scoring 记录对指定 run_id 输出短板诊断与改进建议。
 * 加载 persona、应用 veto/tier、聚类弱点、输出报告；受 forbidden words 校验约束。
 *
 * @param {string} runId - 评分 run_id（用于 loadRunRecords 或 options.records）。
 * @param {CoachDiagnoseOptions} [options] - dataPath、rulesDir、configPath、personaPath、records 等可选。
 * @returns {Promise<CoachDiagnoseResult>} CoachDiagnosisReport 或 CoachRunNotFound（run_id 无记录时）。
 * @throws Error when forbidden_dominant_terms validation fails.
 */
export async function coachDiagnose(
  runId: string,
  options: CoachDiagnoseOptions = {}
): Promise<CoachDiagnoseResult> {
  const normalizedRunId = runId.trim();
  const persona = loadAiCoachPersona(options);

  if (normalizedRunId.length === 0) {
    return { error: 'run_not_found', run_id: runId };
  }

  let records: import('../writer/types').RunScoreRecord[];
  if (options.records != null && options.records.length > 0) {
    records = [...options.records].sort((a, b) => {
      const ta = new Date(a.timestamp).getTime();
      const tb = new Date(b.timestamp).getTime();
      return ta - tb;
    });
  } else {
    records = loadRunRecords(normalizedRunId, options.dataPath);
  }
  if (records.length === 0) {
    return { error: 'run_not_found', run_id: normalizedRunId };
  }

  const config = loadCoachConfig(options.configPath);
  const requiredSkillPath = options.requiredSkillPath ?? config.required_skill_path;
  const fallbackMode = !isSkillAvailable(requiredSkillPath, options.forceSkillLoadError === true);
  const rulesDir = options.rulesDir ?? resolveRulesDir();

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

  const phaseIterationCounts: Record<string, number> = {};
  const byStage = new Map<string, { record: typeof scored[0]['record']; timestamp: number }[]>();
  for (const item of scored) {
    const ts = new Date(item.record.timestamp).getTime();
    const arr = byStage.get(item.record.stage) ?? [];
    arr.push({ record: item.record, timestamp: ts });
    byStage.set(item.record.stage, arr);
  }
  for (const [stage, arr] of byStage) {
    const latest = arr.reduce((a, b) => (a.timestamp >= b.timestamp ? a : b));
    phaseIterationCounts[stage] = latest.record.iteration_count ?? 0;
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
  let recommendations = buildRecommendations(hasStageVeto, epicVeto.triggered, fallbackMode, persona);
  const hasHighIteration = Object.values(phaseIterationCounts).some((c) => c > 0);
  if (hasHighIteration) {
    recommendations = [
      ...recommendations,
      'Focus on stages with high remediation iteration counts to improve first-pass rate.',
    ];
  }
  const journeyContractHints = buildJourneyContractRemediationHints(records);
  if (journeyContractHints.length > 0) {
    recommendations = [
      ...recommendations,
      ...journeyContractHints.map((item) => item.recommendation),
    ];
  }
  const summary = fallbackMode
    ? `Fallback diagnosis complete (run_id=${normalizedRunId}). Output is based on existing score records.`
    : `Diagnosis complete (run_id=${normalizedRunId}). End-to-end Skill was not downgraded.`;
  const boundedSummary = `${summary} Role boundary: ${persona.role}; consumes existing scoring only.`;

  let weaknessClusters: CoachDiagnosisReport['weakness_clusters'];
  try {
    weaknessClusters = clusterWeaknesses(records);
  } catch {
    weaknessClusters = [];
  }

  const stageEvolutionTraces: Record<string, string> = {};
  for (const item of scored) {
    const recs = item.record.iteration_records ?? [];
    if (recs.length === 0) continue;
    const hasGrade = recs.some((r) => r.overall_grade != null && r.overall_grade.length > 0);
    if (!hasGrade) continue;
    const parts = recs.map((r, i) => `Round ${i + 1} ${r.overall_grade ?? '?'}`);
    stageEvolutionTraces[item.record.stage] = parts.join(' → ');
  }

  const report: CoachDiagnosisReport = {
    summary: boundedSummary,
    phase_scores: phaseScores,
    phase_iteration_counts: phaseIterationCounts,
    stage_evolution_traces:
      Object.keys(stageEvolutionTraces).length > 0 ? stageEvolutionTraces : undefined,
    weak_areas: weakAreas,
    recommendations,
    iteration_passed: iterationPassed,
    weakness_clusters: weaknessClusters,
    journey_contract_hints: journeyContractHints.length > 0 ? journeyContractHints : undefined,
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
      `Wording alert: ambiguous terms detected (${forbiddenValidation.warnings.join(', ')}). Replace with explicit commitments.`
    );
  }

  return report;
}
