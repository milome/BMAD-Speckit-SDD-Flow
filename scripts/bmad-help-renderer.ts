/* eslint-disable no-console */
import * as fs from 'node:fs';
import * as path from 'node:path';

type VisibleMode = 'state-prioritized' | 'all' | 'filtered';

export interface WorkflowGuidance {
  sourcePath: string;
  routingRules: string[];
  displayRules: string[];
  officialExecutionPaths: string[];
  additionalGuidance: string[];
}

export interface CatalogItem {
  module: string;
  phase: string;
  name: string;
  code: string;
  sequence: number;
  workflowFile: string;
  command: string;
  required: boolean;
  agentName: string;
  agentCommand: string;
  agentDisplayName: string;
  agentTitle: string;
  options: string;
  description: string;
  outputLocation: string;
  outputs: string;
}

export interface BmadHelpOutput {
  recommendedActions: Array<{
    code: string;
    command: string;
    name: string;
    phase: string;
    module: string;
    recommendedSkill: string;
    legacyCommand: string | null;
    agent: string;
    description: string;
    outputLocation: string;
    outputs: string;
    reason: string;
  }>;
  diagnostic: {
    taskPath: string;
    flow: string;
    sourceMode: string;
    contextMaturity: 'low' | 'medium' | 'high';
    complexity: 'low' | 'medium' | 'medium-high' | 'high';
    implementationReadinessStatus: string;
    module: string;
    summary: string[];
    evidenceFindings: string[];
    gatingNotes: string[];
    followUpQuestion: string | null;
  };
  catalog: {
    modules: Record<string, CatalogItem[]>;
    visibleMode: VisibleMode;
    totalItems: number;
  };
  workflowGuidance: WorkflowGuidance;
}

interface RenderOptions {
  projectRoot: string;
  all?: boolean;
  module?: string;
  phase?: string;
  json?: boolean;
  workflowGuidance?: boolean;
  rawWorkflow?: boolean;
  debug?: boolean;
  catalog?: boolean;
}

const CATALOG_HEADERS = [
  'module',
  'phase',
  'name',
  'code',
  'sequence',
  'workflow-file',
  'command',
  'required',
  'agent-name',
  'agent-command',
  'agent-display-name',
  'agent-title',
  'options',
  'description',
  'output-location',
  'outputs',
] as const;

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function loadCatalog(projectRoot: string): CatalogItem[] {
  const catalogPath = path.join(projectRoot, '_bmad', '_config', 'bmad-help.csv');
  const lines = fs.readFileSync(catalogPath, 'utf8').split(/\r?\n/u).filter(Boolean);
  const header = parseCsvLine(lines[0] ?? '');
  for (const requiredHeader of CATALOG_HEADERS) {
    if (!header.includes(requiredHeader)) {
      throw new Error(`bmad-help catalog missing header: ${requiredHeader}`);
    }
  }
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = Object.fromEntries(header.map((key, index) => [key, values[index] ?? '']));
    return {
      module: row.module,
      phase: row.phase,
      name: row.name,
      code: row.code,
      sequence: Number(row.sequence || 0),
      workflowFile: row['workflow-file'],
      command: row.command,
      required: row.required === 'true',
      agentName: row['agent-name'],
      agentCommand: row['agent-command'],
      agentDisplayName: row['agent-display-name'],
      agentTitle: row['agent-title'],
      options: row.options,
      description: row.description,
      outputLocation: row['output-location'],
      outputs: row.outputs,
    };
  });
}

function groupCatalog(items: CatalogItem[]): Record<string, CatalogItem[]> {
  return items.reduce<Record<string, CatalogItem[]>>((groups, item) => {
    groups[item.module] ??= [];
    groups[item.module]!.push(item);
    return groups;
  }, {});
}

function workflowPath(projectRoot: string): string {
  const candidates = [
    path.join(projectRoot, '_bmad', 'core', 'skills', 'bmad-help', 'workflow.md'),
    path.join(projectRoot, '_bmad', 'skills', 'bmad-help', 'workflow.md'),
  ];
  const match = candidates.find((candidate) => fs.existsSync(candidate));
  if (!match) {
    throw new Error('bmad-help workflow guidance not found under _bmad/core/skills or _bmad/skills');
  }
  return match;
}

export function loadRawBmadHelpWorkflow(projectRoot: string): string {
  return fs.readFileSync(workflowPath(projectRoot), 'utf8');
}

function helpTaskPath(projectRoot: string): string {
  const candidates = [
    path.join(projectRoot, '_bmad', 'core', 'tasks', 'help.md'),
    path.join(projectRoot, '_bmad', 'tasks', 'help.md'),
  ];
  const match = candidates.find((candidate) => fs.existsSync(candidate));
  return match ? path.relative(projectRoot, match).replace(/\\/g, '/') : '_bmad/core/tasks/help.md';
}

function extractSection(markdown: string, heading: string): string[] {
  const lines = markdown.split(/\r?\n/u);
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start < 0) return [];
  const headingLevel = heading.match(/^#+/u)?.[0].length ?? 2;
  const result: string[] = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    const match = line.match(/^(#+)\s+/u);
    if (match && match[1]!.length <= headingLevel) break;
    const trimmed = line.trim();
    if (trimmed) result.push(trimmed);
  }
  return result;
}

function stripMarkdown(value: string): string {
  return value.replace(/\*\*/gu, '').replace(/`/gu, '').replace(/^-\s*/u, '').trim();
}

function unique(lines: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const line of lines) {
    const key = line.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(line);
  }
  return result;
}

function loadWorkflowGuidance(projectRoot: string): WorkflowGuidance {
  const source = workflowPath(projectRoot);
  const markdown = fs.readFileSync(source, 'utf8');
  return {
    sourcePath: path.relative(projectRoot, source).replace(/\\/g, '/'),
    routingRules: extractSection(markdown, '## ROUTING RULES').map(stripMarkdown),
    displayRules: unique([
      ...extractSection(markdown, '## PRESENTATION PRIORITY'),
      ...extractSection(markdown, '### Command-Based Workflows'),
      ...extractSection(markdown, '### Skill-Referenced Workflows'),
      ...extractSection(markdown, '### Agent-Based Workflows'),
    ].map(stripMarkdown)),
    officialExecutionPaths: extractSection(markdown, '## OFFICIAL EXECUTION PATHS (BMAD-Speckit-SDD-Flow)').map(stripMarkdown),
    additionalGuidance: extractSection(markdown, '8. **Additional guidance to convey**:').map(stripMarkdown),
  };
}

function readJson(filePath: string): Record<string, unknown> | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function listFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const result: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(absolute);
      else result.push(absolute);
    }
  }
  return result;
}

function detectDiagnostic(projectRoot: string, recommendedActions: BmadHelpOutput['recommendedActions']): BmadHelpOutput['diagnostic'] {
  const runtimeContext = readJson(path.join(projectRoot, '_bmad-output', 'runtime', 'context', 'project.json'));
  const outputFiles = listFiles(path.join(projectRoot, '_bmad-output'));
  const hasPlanning = outputFiles.some((file) => /planning-artifacts[\\/].+\.(md|json)$/iu.test(file));
  const hasReadiness = outputFiles.some((file) => /implementation-readiness|readiness-report/iu.test(path.basename(file)));
  const hasStories = outputFiles.some((file) => /story|sprint/iu.test(file));
  const flow = typeof runtimeContext?.flow === 'string' ? runtimeContext.flow : hasStories ? 'story' : 'unknown';
  const stage = typeof runtimeContext?.stage === 'string' ? runtimeContext.stage : 'unknown';
  const contextMaturity = hasPlanning && hasReadiness ? 'high' : hasPlanning ? 'medium' : 'low';
  const implementationReadinessStatus = hasReadiness ? 'evidence_present_refresh_if_scope_changed' : 'missing_or_unknown';
  const summary = [
    `flow=${flow}`,
    `stage=${stage}`,
    `contextMaturity=${contextMaturity}`,
    `implementation-readiness=${implementationReadinessStatus}`,
  ];
  return {
    taskPath: helpTaskPath(projectRoot),
    flow,
    sourceMode: typeof runtimeContext?.sourceMode === 'string' ? runtimeContext.sourceMode : 'unknown',
    contextMaturity,
    complexity: contextMaturity === 'high' ? 'medium-high' : 'medium',
    implementationReadinessStatus,
    module: recommendedActions[0]?.module || 'bmm',
    summary,
    evidenceFindings: [
      hasPlanning ? 'planning artifacts detected' : 'planning artifacts not detected',
      hasReadiness ? 'implementation-readiness evidence detected' : 'implementation-readiness evidence not detected',
      hasStories ? 'story/sprint evidence detected' : 'story/sprint evidence not detected',
    ],
    gatingNotes: [
      'Implementation-first recommendations require ready_clean or repair_closed readiness evidence.',
    ],
    followUpQuestion: null,
  };
}

function skillFor(item: CatalogItem): string {
  if (item.workflowFile.startsWith('skill:')) return item.workflowFile.slice('skill:'.length);
  if (item.command) return item.command;
  return item.code;
}

function legacyCommandFor(item: CatalogItem): string | null {
  if (item.workflowFile.startsWith('skill:') && item.command) return item.command;
  return null;
}

function agentFor(item: CatalogItem): string {
  const display = item.agentDisplayName || item.agentName;
  return [display, item.agentTitle].filter(Boolean).join(' - ');
}

function chooseRecommended(catalog: CatalogItem[]): CatalogItem[] {
  const priority = [
    'bmad-bmm-correct-course',
    'bmad-bmm-sprint-status',
    'bmad-bmm-create-product-brief',
    'bmad-bmm-create-prd',
    'bmad-bmm-validate-prd',
    'bmad-bmm-sprint-planning',
    'bmad-bmm-create-story',
    'bmad-story-assistant',
    'bmad-standalone-tasks',
    'bmad-bug-assistant',
  ];
  const picked: CatalogItem[] = [];
  for (const command of priority) {
    const found = catalog.find((item) => item.command === command || item.workflowFile === `skill:${command}`);
    if (found && !picked.includes(found)) picked.push(found);
  }
  return picked.slice(0, 7);
}

function actionFor(item: CatalogItem): BmadHelpOutput['recommendedActions'][number] {
  return {
    code: item.code,
    command: item.command,
    name: item.name,
    phase: item.phase,
    module: item.module,
    recommendedSkill: skillFor(item),
    legacyCommand: legacyCommandFor(item),
    agent: agentFor(item),
    description: item.description,
    outputLocation: item.outputLocation,
    outputs: item.outputs,
    reason: item.required ? 'recommended: next required or blocking workflow' : 'recommended: useful optional workflow for the current context',
  };
}

function filterCatalog(input: {
  catalog: CatalogItem[];
  all?: boolean;
  module?: string;
  phase?: string;
  recommended: CatalogItem[];
}): { items: CatalogItem[]; visibleMode: VisibleMode } {
  let items = input.catalog;
  let visibleMode: VisibleMode = input.all ? 'all' : 'state-prioritized';
  if (input.module) {
    items = items.filter((item) => item.module === input.module);
    visibleMode = 'filtered';
  }
  if (input.phase) {
    items = items.filter((item) => item.phase === input.phase);
    visibleMode = 'filtered';
  }
  if (!input.all && visibleMode === 'state-prioritized') {
    const recommendedSet = new Set(input.recommended);
    items = [...input.recommended, ...items.filter((item) => !recommendedSet.has(item))];
  }
  return { items, visibleMode };
}

export function buildBmadHelpOutput(options: RenderOptions): BmadHelpOutput {
  const projectRoot = path.resolve(options.projectRoot);
  const catalog = loadCatalog(projectRoot);
  const recommendedItems = chooseRecommended(catalog);
  const recommendedActions = recommendedItems.map(actionFor);
  const filtered = filterCatalog({
    catalog,
    all: options.all,
    module: options.module,
    phase: options.phase,
    recommended: recommendedItems,
  });
  return {
    recommendedActions,
    diagnostic: detectDiagnostic(projectRoot, recommendedActions),
    catalog: {
      modules: groupCatalog(filtered.items),
      visibleMode: filtered.visibleMode,
      totalItems: filtered.items.length,
    },
    workflowGuidance: loadWorkflowGuidance(projectRoot),
  };
}

function formatAction(action: BmadHelpOutput['recommendedActions'][number], index: number): string {
  const lines = [
    `${index + 1}. ${action.name} (${action.code})`,
    `Recommended skill: \`${action.recommendedSkill}\``,
  ];
  if (action.legacyCommand) lines.push(`Legacy command: \`${action.legacyCommand}\``);
  else if (action.command) lines.push(`Command: \`${action.command}\``);
  if (action.agent) lines.push(`Agent: ${action.agent}`);
  if (action.description) lines.push(`Description: ${action.description}`);
  lines.push(`Why recommended/blocked: ${action.reason}`);
  return lines.join('\n');
}

function renderDiagnostic(output: BmadHelpOutput): string[] {
  return [
    '## Status Summary',
    '',
    `Source task: ${output.diagnostic.taskPath}`,
    '',
    '| Dimension | Value |',
    '|---|---|',
    `| flow | ${output.diagnostic.flow} |`,
    `| sourceMode | ${output.diagnostic.sourceMode} |`,
    `| contextMaturity | ${output.diagnostic.contextMaturity} |`,
    `| complexity | ${output.diagnostic.complexity} |`,
    `| implementation-readiness | ${output.diagnostic.implementationReadinessStatus} |`,
    `| module | ${output.diagnostic.module} |`,
    '',
    '### Evidence Findings',
    ...output.diagnostic.evidenceFindings.map((item) => `- ${item}`),
    '',
    '### Gate Notes',
    ...output.diagnostic.gatingNotes.map((item) => `- ${item}`),
  ];
}

function renderCatalog(output: BmadHelpOutput): string[] {
  const lines = [
    '## Catalog Reference',
    '',
    `Display mode: ${output.catalog.visibleMode}; total catalog rows: ${output.catalog.totalItems}`,
  ];
  for (const [module, items] of Object.entries(output.catalog.modules)) {
    lines.push('', `### ${module || 'global'} (${items.length})`);
    for (const item of items) {
      lines.push(`- ${item.name} (${item.code}) - ${item.command || item.workflowFile} - ${item.description}`);
    }
  }
  return lines;
}

function renderWorkflowGuidance(guidance: WorkflowGuidance): string[] {
  const lines = [
    '## Upstream Workflow Guidance',
    '',
    `Source: ${guidance.sourcePath}`,
    '',
    '### Routing Rules',
    ...guidance.routingRules.map((item) => `- ${item}`),
    '',
    '### Display Rules',
    ...guidance.displayRules.map((item) => `- ${item}`),
    '',
    '### Official Execution Paths',
    ...guidance.officialExecutionPaths.map((item) => `- ${item}`),
  ];
  if (guidance.additionalGuidance.length > 0) {
    lines.push('', '### Additional Guidance', ...guidance.additionalGuidance.map((item) => `- ${item}`));
  }
  return lines;
}

export function renderBmadHelp(
  output: BmadHelpOutput,
  options: { debug?: boolean; includeCatalog?: boolean } = {}
): string {
  const lines: string[] = ['# bmad-help', ''];
  lines.push(...renderDiagnostic(output));
  lines.push('', '## Recommended Next Steps', '');
  output.recommendedActions.forEach((action, index) => {
    lines.push(formatAction(action, index), '');
  });
  if (options.includeCatalog) lines.push('', ...renderCatalog(output));
  if (options.debug) lines.push('', '## Debug', '', ...output.diagnostic.summary.map((item) => `- ${item}`));
  lines.push('', ...renderWorkflowGuidance(output.workflowGuidance));
  return `${lines.join('\n')}\n`;
}

function parseArgs(argv: string[]): RenderOptions {
  const options: RenderOptions = { projectRoot: process.cwd() };
  const bareArgs: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--cwd') options.projectRoot = argv[++index] ?? options.projectRoot;
    else if (arg.startsWith('--cwd=')) options.projectRoot = arg.slice('--cwd='.length);
    else if (arg === '--all') options.all = true;
    else if (arg === '--module') options.module = argv[++index];
    else if (arg.startsWith('--module=')) options.module = arg.slice('--module='.length);
    else if (arg === '--phase') options.phase = argv[++index];
    else if (arg.startsWith('--phase=')) options.phase = arg.slice('--phase='.length);
    else if (arg === '--json') options.json = true;
    else if (arg === '--workflow-guidance') options.workflowGuidance = true;
    else if (arg === '--raw-workflow') options.rawWorkflow = true;
    else if (arg === '--debug') options.debug = true;
    else if (arg === '--catalog') options.catalog = true;
    else if (!arg.startsWith('-')) bareArgs.push(arg);
  }
  if (process.env.npm_config_json === 'true') options.json = true;
  if (process.env.npm_config_all === 'true') options.all = true;
  if (process.env.npm_config_workflow_guidance === 'true') options.workflowGuidance = true;
  if (process.env.npm_config_raw_workflow === 'true') options.rawWorkflow = true;
  if (process.env.npm_config_debug === 'true') options.debug = true;
  if (process.env.npm_config_catalog === 'true') options.catalog = true;
  if (process.env.npm_config_module && process.env.npm_config_module !== 'true') {
    options.module = process.env.npm_config_module;
  } else if (process.env.npm_config_module === 'true' && !options.module) {
    options.module = bareArgs.shift();
  }
  if (process.env.npm_config_phase && process.env.npm_config_phase !== 'true') {
    options.phase = process.env.npm_config_phase;
  } else if (process.env.npm_config_phase === 'true' && !options.phase) {
    options.phase = bareArgs.shift();
  }
  return options;
}

export function mainBmadHelpRenderer(argv: string[] = process.argv.slice(2)): number {
  try {
    const options = parseArgs(argv);
    if (options.rawWorkflow) {
      process.stdout.write(`${loadRawBmadHelpWorkflow(path.resolve(options.projectRoot))}\n`);
      return 0;
    }
    const output = buildBmadHelpOutput(options);
    if (options.json) {
      console.log(JSON.stringify(output, null, 2));
    } else if (options.workflowGuidance) {
      process.stdout.write(`${renderWorkflowGuidance(output.workflowGuidance).join('\n')}\n`);
    } else {
      process.stdout.write(
        renderBmadHelp(output, {
          debug: options.debug,
          includeCatalog: options.catalog || options.all || Boolean(options.module) || Boolean(options.phase),
        })
      );
    }
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

if (require.main === module) {
  process.exitCode = mainBmadHelpRenderer();
}
