#!/usr/bin/env node
// @ts-nocheck
/* eslint-disable no-console */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('./load-js-yaml');

const RECIPE_PATH = '_bmad/_config/architecture-confirmation-hash-recipe.contract.yaml';
const BOOKKEEPING_FIELDS = new Set([
  'status',
  'confirmedAt',
  'confirmedBy',
  'sourceDocumentHash',
  'implementationConfirmationHash',
  'reconfirmationRequest',
  'confirmationRender',
]);
const REQUIRED_ARCHITECTURE_DIAGRAM_TYPES = [
  'system_architecture',
  'deployment',
  'class',
  'swimlane',
  'state_machine',
  'sequence',
  'activity',
];

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }
    if (arg === '--json') {
      args.json = true;
      continue;
    }
    if (!arg.startsWith('--')) throw new Error(`Unexpected positional argument: ${arg}`);
    const key = arg.slice(2).replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase());
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
    args[key] = value;
    index += 1;
  }
  return args;
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}

function sha256Text(value) {
  return `sha256:${crypto.createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeRepoPath(value, repoRoot = process.cwd()) {
  const raw = String(value || '').replace(/\\/gu, '/').trim();
  const root = repoRoot.replace(/\\/gu, '/').replace(/\/$/u, '');
  const withoutRoot = raw.startsWith(`${root}/`) ? raw.slice(root.length + 1) : raw;
  return path.posix.normalize(withoutRoot).replace(/^\.\//u, '').replace(/\/$/u, '');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readJsonOption(value, label) {
  if (!value) throw new Error(`missing ${label}`);
  const maybePath = path.resolve(value);
  const raw = fs.existsSync(maybePath) ? fs.readFileSync(maybePath, 'utf8') : value;
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error(`${label} must be a JSON array`);
  return parsed;
}

function extractImplementationConfirmation(sourceText) {
  const lines = sourceText.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((line) => /^implementationConfirmation:\s*$/u.test(line));
  if (start < 0) throw new Error('missing implementationConfirmation block');
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === '') continue;
    if (/^\S/u.test(line) && !/^implementationConfirmation:\s*$/u.test(line)) {
      end = index;
      break;
    }
  }
  const blockText = lines.slice(start, end).join('\n');
  const parsed = yaml.load(blockText);
  if (!parsed?.implementationConfirmation) throw new Error('implementationConfirmation block is not valid YAML');
  return { blockText, confirmation: parsed.implementationConfirmation };
}

function semanticConfirmationForHash(confirmation) {
  const semantic = {};
  for (const [key, value] of Object.entries(confirmation ?? {})) {
    if (!BOOKKEEPING_FIELDS.has(key)) semantic[key] = value;
  }
  normalizePreConfirmationDrilldownForHash(semantic);
  return semantic;
}

function normalizePreConfirmationDrilldownForHash(semantic) {
  if (
    !semantic.preConfirmationDrilldown ||
    typeof semantic.preConfirmationDrilldown !== 'object' ||
    Array.isArray(semantic.preConfirmationDrilldown)
  ) {
    return;
  }
  const drilldown = { ...semantic.preConfirmationDrilldown };
  if (
    drilldown.semanticKernelRef &&
    typeof drilldown.semanticKernelRef === 'object' &&
    !Array.isArray(drilldown.semanticKernelRef)
  ) {
    const semanticKernelRef = { ...drilldown.semanticKernelRef };
    delete semanticKernelRef.hash;
    drilldown.semanticKernelRef = semanticKernelRef;
  }
  if (
    drilldown.mustDecompositionPacketRef &&
    typeof drilldown.mustDecompositionPacketRef === 'object' &&
    !Array.isArray(drilldown.mustDecompositionPacketRef)
  ) {
    const mustDecompositionPacketRef = { ...drilldown.mustDecompositionPacketRef };
    delete mustDecompositionPacketRef.hash;
    drilldown.mustDecompositionPacketRef = mustDecompositionPacketRef;
  }
  if (
    drilldown.criticalAuditor &&
    typeof drilldown.criticalAuditor === 'object' &&
    !Array.isArray(drilldown.criticalAuditor)
  ) {
    const criticalAuditor = { ...drilldown.criticalAuditor };
    delete criticalAuditor.consecutiveNoNewGapRounds;
    delete criticalAuditor.latestReceiptHash;
    delete criticalAuditor.convergenceVerdict;
    drilldown.criticalAuditor = criticalAuditor;
  }
  semantic.preConfirmationDrilldown = drilldown;
}

function sourceDocumentHashFor(sourceText, blockText, confirmation) {
  const normalizedBlock = `implementationConfirmation:${stableStringify(semanticConfirmationForHash(confirmation))}`;
  return sha256Text(sourceText.replace(blockText, normalizedBlock));
}

function implementationConfirmationHashFor(confirmation) {
  return sha256Text(stableStringify(semanticConfirmationForHash(confirmation)));
}

function resolveRecipe(configPath = RECIPE_PATH) {
  const absolute = path.resolve(configPath);
  const config = yaml.load(fs.readFileSync(absolute, 'utf8'));
  const resolvedWithoutHash = {
    schemaVersion: text(config.schemaVersion),
    recipeVersion: text(config.recipeVersion),
    configPath: normalizeRepoPath(absolute),
    canonicalization: object(config.canonicalization),
    pathNormalization: object(config.pathNormalization),
    fixedCategoryOrder: object(config.fixedCategoryOrder),
    volatileFieldsExcludedFromArtifactHash: array(config.volatileFieldsExcludedFromArtifactHash).map(text).filter(Boolean),
    stateTransitionHashCoverage: object(config.stateTransitionHashCoverage),
    controlledIngestRules: object(config.controlledIngestRules),
  };
  if (resolvedWithoutHash.recipeVersion !== 'architecture-confirmation-hash/v1') {
    throw new Error(`invalid architecture hash recipe: ${resolvedWithoutHash.recipeVersion || '<missing>'}`);
  }
  return { ...resolvedWithoutHash, resolvedRecipeHash: sha256Text(stableStringify(resolvedWithoutHash)) };
}

function architectureHashFor(confirmation, recipe) {
  const volatile = new Set([
    ...recipe.volatileFieldsExcludedFromArtifactHash,
    'artifactHash',
    'architectureConfirmationArtifactHash',
    'confirmationPhrase',
    'architectureConfirmationArtifactRef',
  ]);
  const semantic = {};
  for (const [key, value] of Object.entries(confirmation)) {
    if (!volatile.has(key)) semantic[key] = value;
  }
  return sha256Text(stableStringify(semantic));
}

function mermaidLabel(value, fallback) {
  const raw = text(value) || fallback;
  return raw
    .replace(/[\\"]/gu, "'")
    .replace(/[\r\n\t]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .slice(0, 96);
}

function triggeredRows(rows) {
  return array(rows)
    .map((row) => object(row))
    .filter((row) => {
      const decision = text(row.status || row.decision).toLowerCase();
      return decision.includes('triggered') && !decision.includes('not_triggered');
    });
}

function compactPathLabel(value, fallback) {
  const normalized = text(value);
  if (!normalized) return fallback;
  const parts = normalized.split('/');
  return parts.slice(-2).join('/') || normalized;
}

function stringList(value) {
  return array(value).map(text).filter(Boolean);
}

function firstBusinessViews(confirmation) {
  return [
    ...array(confirmation.sequenceViews),
    ...array(confirmation.flowViews),
    ...array(confirmation.edgeCaseViews),
    ...array(confirmation.boundaryViews),
  ]
    .map((row) => object(row))
    .filter((row) => text(row.scope).toLowerCase() === 'business');
}

function findBusinessView(views, kinds) {
  return (
    views.find((view) => kinds.includes(text(view.visualKind).toLowerCase())) ||
    views.find((view) => text(view.mermaid)) ||
    {}
  );
}

function targetRowsFromCurrentTargetMap(confirmation, field) {
  const map = object(confirmation.currentTargetMap);
  return [
    ...array(map[field]),
    ...array(object(map.sourceStateProjection)[field === 'currentSummary' ? 'currentRows' : 'targetRows']),
  ].map((row) => object(row));
}

function firstRowText(rows, fallback) {
  const row = rows.find((item) => text(item.text || item.summary || item.title));
  return mermaidLabel(row?.text || row?.summary || row?.title, fallback);
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  const output = [];
  for (const item of items) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

function mermaidNodeId(value, fallback = 'Node') {
  const raw = text(value) || fallback;
  const cleaned = raw
    .replace(/[^A-Za-z0-9_]+/gu, '_')
    .replace(/^_+|_+$/gu, '')
    .slice(0, 48);
  const candidate = cleaned || fallback;
  return /^[A-Za-z]/u.test(candidate) ? candidate : `N_${candidate}`;
}

function mermaidMethodName(value, fallback = 'sourceBoundBehavior') {
  const raw = text(value) || fallback;
  const cleaned = raw
    .replace(/[^A-Za-z0-9_]+/gu, '_')
    .replace(/_+$/gu, '')
    .slice(0, 64);
  const candidate = cleaned || fallback;
  return /^[A-Za-z_]/u.test(candidate) ? candidate : `m_${candidate}`;
}

function mermaidStateLabel(value, fallback) {
  return mermaidLabel(value, fallback).replace(/[:;{}[\]]/gu, ' ');
}

function mermaidEdgeLabel(value, fallback) {
  return mermaidLabel(value, fallback)
    .replace(/\[([A-Z]+-\d+)\]/gu, '$1')
    .replace(/[|<>]/gu, ' ')
    .replace(/[:;{}[\]]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function extractSequenceParticipants(views) {
  const participants = [];
  for (const view of views) {
    const mermaid = text(view.mermaid);
    if (!mermaid.startsWith('sequenceDiagram')) continue;
    for (const line of mermaid.split(/\r?\n/u)) {
      const actorMatch = line.match(/^\s*(actor|participant)\s+([A-Za-z][A-Za-z0-9_]*)\s*(?:as\s+(.+?))?\s*$/u);
      if (actorMatch) {
        const kind = actorMatch[1] === 'actor' ? 'actor' : 'participant';
        const alias = actorMatch[2];
        const label = mermaidLabel(actorMatch[3] || alias, alias);
        participants.push({ kind, alias, label, id: mermaidNodeId(label || alias, alias) });
      }
    }
  }
  return uniqueBy(participants, (item) => `${item.kind}:${item.label}`);
}

function extractSequenceMessages(views) {
  const messages = [];
  for (const view of views) {
    const mermaid = text(view.mermaid);
    if (!mermaid.startsWith('sequenceDiagram')) continue;
    for (const line of mermaid.split(/\r?\n/u)) {
      const messageMatch = line.match(/:\s*(.+?)\s*$/u);
      if (messageMatch) messages.push(mermaidLabel(messageMatch[1], 'business step'));
    }
  }
  return [...new Set(messages)].slice(0, 8);
}

function extractFlowLabels(views) {
  const labels = [];
  for (const view of views) {
    const mermaid = text(view.mermaid);
    if (!/^flowchart|^graph/u.test(mermaid)) continue;
    for (const line of mermaid.split(/\r?\n/u)) {
      for (const match of line.matchAll(/[\[{(]([^()[\]{}]{4,160})[\]})]/gu)) {
        labels.push(mermaidLabel(match[1], 'business step'));
      }
    }
  }
  return [...new Set(labels)].slice(0, 10);
}

function pascalFromPath(value) {
  const basename = text(value)
    .split('/')
    .pop()
    ?.replace(/\.[^.]+$/u, '');
  if (!basename) return '';
  return basename
    .split(/[^A-Za-z0-9]+/u)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join('');
}

function isBusinessClassLikeTerm(value) {
  const normalized = text(value).replace(/[^A-Za-z0-9_]+/gu, '');
  if (!normalized) return false;
  if (/^(MUST|TRACE|EVD|ACC|EDGE|FAIL|OUT|JSON|HTML|HTTP|UI|OK)$/u.test(normalized)) return false;
  if (/^(User|Open|Multi|Current|Target|Default|Cancel|Confirm|Restore|Apply|Preview)$/u.test(normalized)) return false;
  if (/^(?:Test|Mock|Fake|Stub)/u.test(normalized)) return false;
  if (/(?:Requirement|Requirements|Spec|Specification|Contract|Confirmation)$/u.test(normalized)) return false;
  if (/^(Widget|Dialog|Settings|Panel|View|Model|State|Config|Store)$/u.test(normalized)) return false;
  return (
    /[A-Z][a-z0-9]+[A-Z][A-Za-z0-9_]*/u.test(normalized) ||
    /(?:Widget|Dialog|Settings|Panel|Controller|Service|Manager|View|Model|State|Config|Store|Presenter|Repository)$/u.test(
      normalized
    )
  );
}

function extractClassLikeTerms({ views, targetPathRefs }) {
  const terms = [];
  for (const participant of extractSequenceParticipants(views)) {
    if (participant.kind === 'actor') continue;
    if (isBusinessClassLikeTerm(participant.label)) terms.push(participant.label);
  }
  for (const targetPath of targetPathRefs) {
    if (isTestTargetPath(targetPath) || isEvidenceTargetPath(targetPath) || isDocumentationTargetPath(targetPath)) {
      continue;
    }
    const candidate = pascalFromPath(targetPath);
    if (isBusinessClassLikeTerm(candidate)) terms.push(candidate);
  }
  return [...new Set(terms)].slice(0, 6);
}

function extractMethodLikeTerms(views) {
  const sourceText = views.map((view) => `${text(view.title)}\n${text(view.mermaid)}`).join('\n');
  const methods = [];
  for (const match of sourceText.matchAll(/\b_?[a-z][A-Za-z0-9_]{2,}\b(?=\s*(?:\(|\b))/gu)) {
    const value = match[0];
    if (/^(actor|participant|as|alt|else|end|flowchart|sequenceDiagram|stateDiagram)$/u.test(value)) continue;
    if (value.includes('_') || /apply|preview|persist|rollback|cancel|confirm|show|open|load/u.test(value)) {
      methods.push(value);
    }
  }
  return [...new Set(methods)].slice(0, 5);
}

function isTestTargetPath(value) {
  return /(?:^|\/)tests?\//iu.test(text(value));
}

function isEvidenceTargetPath(value) {
  return text(value).startsWith('_bmad-output/');
}

function isDocumentationTargetPath(value) {
  return /(?:^|\/)docs?\//iu.test(text(value)) || /\.(?:md|mdx|txt|json|ya?ml)$/iu.test(text(value));
}

function isProductSourceTargetPath(value) {
  const target = text(value);
  if (!target || isTestTargetPath(target) || isEvidenceTargetPath(target) || isDocumentationTargetPath(target)) {
    return false;
  }
  return /\.(?:py|ts|tsx|js|jsx|mjs|cjs|vue|svelte)$/iu.test(target);
}

function resolveExistingTargetFile(targetPath) {
  const raw = text(targetPath);
  if (!raw) return '';
  const normalized = raw.replace(/\\/gu, path.sep);
  const candidates = path.isAbsolute(normalized)
    ? [normalized]
    : [path.resolve(process.cwd(), normalized), path.resolve(normalized)];
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) || '';
}

function extractPythonSourceFacts(source, filePath) {
  const classes = [];
  const functions = [];
  const uiControls = [];
  const signalConnections = [];
  const calledClasses = [];
  const updateCalls = [];
  const lines = source.replace(/\r\n/gu, '\n').split('\n');
  let pendingDecorators = [];
  let currentClass = null;
  let currentMethod = null;
  for (const line of lines) {
    const decoratorMatch = line.match(/^\s*@([A-Za-z_][A-Za-z0-9_]*)/u);
    if (decoratorMatch) {
      pendingDecorators.push(decoratorMatch[1]);
      continue;
    }
    const classMatch = line.match(/^class\s+([A-Za-z_][A-Za-z0-9_]*)/u);
    if (classMatch) {
      currentClass = {
        name: classMatch[1],
        filePath,
        decorators: pendingDecorators,
        methods: [],
        fields: [],
        uiControls: [],
        signalConnections: [],
        calledClasses: [],
        updateCalls: [],
      };
      classes.push(currentClass);
      pendingDecorators = [];
      currentMethod = null;
      continue;
    }
    if (/^\S/u.test(line)) {
      currentClass = null;
      currentMethod = null;
    }
    const topFunctionMatch = line.match(/^def\s+([A-Za-z_][A-Za-z0-9_]*)/u);
    if (topFunctionMatch) {
      functions.push({ name: topFunctionMatch[1], filePath });
      pendingDecorators = [];
      continue;
    }
    const methodMatch = line.match(/^\s{4}def\s+([A-Za-z_][A-Za-z0-9_]*)/u);
    if (methodMatch && currentClass) {
      currentMethod = methodMatch[1];
      currentClass.methods.push(currentMethod);
      pendingDecorators = [];
    }
    const fieldMatch = line.match(/^\s{4}([A-Za-z_][A-Za-z0-9_]*)\s*:/u);
    if (fieldMatch && currentClass && !currentClass.methods.length) {
      currentClass.fields.push(fieldMatch[1]);
    }
    const selfFieldMatch = line.match(/\bself\.([A-Za-z_][A-Za-z0-9_]*)\s*(?::[^=]+)?=/u);
    if (selfFieldMatch && currentClass) currentClass.fields.push(selfFieldMatch[1]);
    const uiMatch = line.match(/\bself\.([A-Za-z_][A-Za-z0-9_]*)\s*(?::[^=]+)?=\s*(?:QtWidgets\.)?(Q[A-Za-z_][A-Za-z0-9_]*)\s*\(/u);
    if (uiMatch) {
      const row = { ownerClass: currentClass?.name || '', field: uiMatch[1], widget: uiMatch[2], filePath };
      uiControls.push(row);
      if (currentClass) currentClass.uiControls.push(row);
    }
    const signalMatch = line.match(
      /([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)\.(clicked|toggled|valueChanged|stateChanged|currentIndexChanged|accepted|rejected)\.connect\(([^)]+)\)/u
    );
    if (signalMatch) {
      const row = {
        ownerClass: currentClass?.name || '',
        source: signalMatch[1],
        signal: signalMatch[2],
        target: signalMatch[3].trim(),
        method: currentMethod || '',
        filePath,
      };
      signalConnections.push(row);
      if (currentClass) currentClass.signalConnections.push(row);
    }
    for (const match of line.matchAll(/\b([A-Z][A-Za-z0-9_]{2,})\s*\(/gu)) {
      const name = match[1];
      if (/^(QtWidgets|QtCore|QtGui|Optional|Callable|List|Dict|Set|Tuple)$/u.test(name)) continue;
      calledClasses.push({ name, ownerClass: currentClass?.name || '', method: currentMethod || '', filePath });
      if (currentClass) currentClass.calledClasses.push(name);
    }
    if (/\b(?:update|setVisible|setChecked|setValue|set_bearish_fill_opacity|save_policy|write_log)\s*\(/u.test(line)) {
      const label = line
        .trim()
        .replace(/^#/u, '')
        .replace(/\s+/gu, ' ')
        .slice(0, 140);
      const row = { ownerClass: currentClass?.name || '', method: currentMethod || '', label, filePath };
      updateCalls.push(row);
      if (currentClass) currentClass.updateCalls.push(row);
    }
  }
  for (const item of classes) {
    item.methods = [...new Set(item.methods)];
    item.fields = [...new Set(item.fields)];
    item.calledClasses = [...new Set(item.calledClasses)];
  }
  return { classes, functions, uiControls, signalConnections, calledClasses, updateCalls };
}

function extractSourceArchitectureFacts(targetPathRefs) {
  const files = [];
  const classes = [];
  const functions = [];
  const uiControls = [];
  const signalConnections = [];
  const calledClasses = [];
  const updateCalls = [];
  for (const targetPath of targetPathRefs.filter(isProductSourceTargetPath)) {
    const absolute = resolveExistingTargetFile(targetPath);
    if (!absolute) continue;
    const source = fs.readFileSync(absolute, 'utf8');
    const filePath = normalizeRepoPath(absolute);
    files.push({ path: filePath, byteLength: Buffer.byteLength(source, 'utf8') });
    if (/\.py$/iu.test(absolute)) {
      const facts = extractPythonSourceFacts(source, filePath);
      classes.push(...facts.classes);
      functions.push(...facts.functions);
      uiControls.push(...facts.uiControls);
      signalConnections.push(...facts.signalConnections);
      calledClasses.push(...facts.calledClasses);
      updateCalls.push(...facts.updateCalls);
    }
  }
  return {
    files,
    classes: uniqueBy(classes, (item) => `${item.filePath}:${item.name}`),
    functions: uniqueBy(functions, (item) => `${item.filePath}:${item.name}`),
    uiControls: uniqueBy(uiControls, (item) => `${item.filePath}:${item.ownerClass}:${item.field}:${item.widget}`),
    signalConnections: uniqueBy(
      signalConnections,
      (item) => `${item.filePath}:${item.ownerClass}:${item.source}:${item.signal}:${item.target}`
    ),
    calledClasses: uniqueBy(calledClasses, (item) => `${item.filePath}:${item.ownerClass}:${item.method}:${item.name}`),
    updateCalls: uniqueBy(updateCalls, (item) => `${item.filePath}:${item.ownerClass}:${item.method}:${item.label}`),
  };
}

function findSourceClass(facts, predicate) {
  return facts.classes.find(predicate) || null;
}

function classNameOrFallback(row, fallback) {
  return row?.name || fallback;
}

function classMethod(row, pattern, fallback) {
  return row?.methods?.find((method) => pattern.test(method)) || fallback;
}

function sourceFactsAreUseful(facts) {
  return facts.files.length > 0 && facts.classes.length > 0;
}

function sourceDrivenBusinessAnchors(facts, fallbackAnchors) {
  if (!sourceFactsAreUseful(facts)) return null;
  const settingControl =
    facts.uiControls.find((row) => /settings|display|period|timeframe/iu.test(row.field)) ||
    facts.signalConnections.find((row) => /settings|display|period|timeframe/iu.test(row.source));
  const host =
    findSourceClass(
      facts,
      (row) =>
        row.name === settingControl?.ownerClass &&
        row.signalConnections.some(
          (conn) =>
            conn.source === settingControl?.field ||
            conn.source === settingControl?.source ||
            conn.source.endsWith(`.${settingControl?.field || ''}`)
        )
    ) ||
    findSourceClass(facts, (row) =>
      row.signalConnections.some(
        (conn) => /settings|display|period|timeframe/iu.test(conn.source) && /settings|display|period|timeframe/iu.test(conn.target)
      )
    ) ||
    findSourceClass(facts, (row) => /(?:Window|Page|View|Controller|Presenter)$/u.test(row.name)) ||
    null;
  const widget =
    findSourceClass(facts, (row) =>
      row.methods.some((method) => /_apply.*settings|apply.*settings/iu.test(method))
    ) ||
    findSourceClass(facts, (row) => /Widget$/u.test(row.name)) ||
    findSourceClass(facts, (row) => row.methods.some((method) => /show.*settings|open.*settings/iu.test(method))) ||
    null;
  const dialog =
    findSourceClass(facts, (row) => /Dialog$/u.test(row.name)) ||
    findSourceClass(facts, (row) => row.methods.some((method) => /_on_cancel|_on_reset|get_settings/iu.test(method))) ||
    null;
  const settings =
    findSourceClass(
      facts,
      (row) =>
        row.decorators.includes('dataclass') &&
        /Settings(?:Snapshot|State)?$/u.test(row.name) &&
        !/Dialog$/u.test(row.name)
    ) ||
    findSourceClass(
      facts,
      (row) => /Settings(?:Snapshot|State)?$/u.test(row.name) && !/Dialog$/u.test(row.name)
    );
  const style =
    findSourceClass(facts, (row) => /Style(?:State)?$/u.test(row.name)) ||
    findSourceClass(facts, (row) => row.fields.some((field) => /opacity|visible/iu.test(field)));
  const policy = facts.calledClasses.find((row) => /PolicyManager|Policy|Store|Repository/u.test(row.name));
  const renderUpdate =
    facts.updateCalls.find((row) =>
      /\b(?:update|refresh|render|repaint|setVisible|setChecked|setValue)\s*\(/iu.test(row.label)
    ) || facts.updateCalls[0];
  return {
    actor: fallbackAnchors.actor,
    host: {
      label: classNameOrFallback(host, 'Host window'),
      method: classMethod(host, /show.*settings|open.*settings|settings/iu, 'settings entrypoint'),
      control: settingControl?.field || settingControl?.source || 'settings button',
      signal:
        host?.signalConnections?.[0] ||
        facts.signalConnections.find((row) => row.ownerClass === host?.name) ||
        facts.signalConnections[0] ||
        null,
    },
    widget: {
      label: classNameOrFallback(widget, fallbackAnchors.surface.label),
      showMethod: classMethod(widget, /show_settings_dialog|show.*settings|open.*settings/iu, 'show_settings_dialog'),
      applyMethod: classMethod(widget, /_apply.*settings|apply_settings|apply/iu, '_apply_settings'),
      policyMethod: classMethod(widget, /_update_policy_opacity|policy|persist/iu, '_update_policy_opacity'),
    },
    dialog: {
      label: classNameOrFallback(dialog, fallbackAnchors.dialog.label),
      cancelMethod: classMethod(dialog, /_on_cancel|cancel|reject/iu, '_on_cancel'),
      resetMethod: classMethod(dialog, /_on_reset|reset/iu, '_on_reset'),
      getMethod: classMethod(dialog, /get_settings|settings/iu, 'get_settings'),
    },
    settings: {
      label: classNameOrFallback(settings, 'Settings snapshot'),
      fields: (settings?.fields || []).filter((field) => /opacity|visible|enabled|selected|hidden/iu.test(field)).slice(0, 8),
    },
    style: {
      label: classNameOrFallback(style, 'Display style state'),
      fields: (style?.fields || []).filter((field) => /opacity|visible|enabled|selected|hidden/iu.test(field)).slice(0, 8),
    },
    policy: { label: policy?.name || 'Policy persistence' },
    chartState: {
      label: renderUpdate ? 'Rendered product state update' : 'Rendered product state',
      updateLabel: renderUpdate?.label || 'render/update state',
    },
    facts,
  };
}

function sourceAnchorsForBusinessDiagrams({ businessViews, targetPathRefs, currentRows, targetRows }) {
  const participants = extractSequenceParticipants(businessViews);
  const actor = participants.find((item) => item.kind === 'actor') || participants[0] || {
    label: 'User',
    id: 'User',
  };
  const nonActors = participants.filter((item) => item.kind !== 'actor');
  const surface =
    nonActors.find((item) => /widget|panel|view|window|surface|ui/u.test(item.label.toLowerCase())) ||
    nonActors[0] || {
      label: firstRowText(targetRows, 'target UI surface'),
      id: 'TargetSurface',
    };
  const dialog =
    nonActors.find((item) => /dialog|settings|modal|form|panel/u.test(item.label.toLowerCase()) && item !== surface) ||
    nonActors[1] || {
      label: firstRowText(currentRows, 'settings interaction'),
      id: 'SettingsInteraction',
    };
  const apply =
    nonActors.find((item) => /apply|service|controller|manager|handler|sync|update/u.test(item.label.toLowerCase())) ||
    nonActors[2] || {
      label: 'source-defined apply path',
      id: 'ApplyPath',
    };
  const messages = extractSequenceMessages(businessViews);
  const flowLabels = extractFlowLabels(businessViews);
  const participantClassTerms = participants
    .map((item) => item.label)
    .filter(isBusinessClassLikeTerm);
  const classTerms = [
    ...new Set([
      ...participantClassTerms,
      ...extractClassLikeTerms({ views: businessViews, targetPathRefs }),
    ]),
  ];
  const methodTerms = extractMethodLikeTerms(businessViews);
  return {
    participants,
    actor,
    surface,
    dialog,
    apply,
    messages,
    flowLabels,
    classTerms,
    methodTerms,
  };
}

function firstProductTarget(targetPathRefs) {
  return (
    targetPathRefs.find((item) => !isTestTargetPath(item) && !isEvidenceTargetPath(item) && !isDocumentationTargetPath(item)) ||
    targetPathRefs[0]
  );
}

function splitTargetsForDeployment(targetPathRefs) {
  return {
    productTargets: targetPathRefs
      .filter((item) => !isTestTargetPath(item) && !isEvidenceTargetPath(item) && !isDocumentationTargetPath(item))
      .slice(0, 4),
    testTargets: targetPathRefs.filter((item) => isTestTargetPath(item)).slice(0, 3),
    evidenceTargets: targetPathRefs.filter((item) => isEvidenceTargetPath(item)).slice(0, 3),
  };
}

function businessDiagramCommon({ evidenceRefs, targetPathRefs, triggerRows }) {
  return {
    schemaVersion: 'architecture-confirmation-diagram/v1',
    scope: 'business_architecture',
    evidenceRefs,
    targetPathRefs,
    triggerRefs: triggerRows.map((row) => text(row.trigger || row.category || row.reason)).filter(Boolean),
  };
}

function buildBusinessArchitectureDiagrams({
  confirmation,
  targetPaths,
  consumerImpactScan,
  fullArchitectureTriggerMatrix,
  evidenceRefs,
}) {
  const targetPathRefs = targetPaths.slice(0, 12);
  const businessViews = firstBusinessViews(confirmation);
  const happyView = findBusinessView(businessViews, ['happy']);
  const failureView = findBusinessView(businessViews, ['failure']);
  const stateView = findBusinessView(businessViews, ['state']);
  const flowView = findBusinessView(businessViews, ['flow']);
  const edgeView = findBusinessView(businessViews, ['edge']);
  const triggerRows = triggeredRows(fullArchitectureTriggerMatrix);
  const consumerRows = triggeredRows(consumerImpactScan);
  const currentRows = targetRowsFromCurrentTargetMap(confirmation, 'currentSummary');
  const targetRows = targetRowsFromCurrentTargetMap(confirmation, 'targetSummary');
  const businessTitle = mermaidLabel(
    happyView.title || flowView.title || object(confirmation.currentTargetMap).introduction,
    'Consumer business behavior'
  );
  const currentState = firstRowText(currentRows, 'Current product behavior');
  const targetState = firstRowText(targetRows, 'Target product behavior');
  const primaryTarget = mermaidLabel(compactPathLabel(firstProductTarget(targetPathRefs), 'primary target'), 'primary target');
  const deploymentTargets = splitTargetsForDeployment(targetPathRefs);
  const anchors = sourceAnchorsForBusinessDiagrams({ businessViews, targetPathRefs, currentRows, targetRows });
  const actorId = mermaidNodeId(anchors.actor.id || anchors.actor.label, 'Actor');
  const surfaceId = mermaidNodeId(anchors.surface.id || anchors.surface.label, 'Surface');
  const dialogId = mermaidNodeId(anchors.dialog.id || anchors.dialog.label, 'Dialog');
  const applyId = mermaidNodeId(anchors.apply.id || anchors.apply.label, 'Apply');
  const sourceFacts = extractSourceArchitectureFacts(targetPathRefs);
  const sourceDriven = sourceDrivenBusinessAnchors(sourceFacts, anchors);
  const messageA = anchors.messages[0] || anchors.flowLabels[0] || 'open source-defined business flow';
  const messageB = anchors.messages[1] || anchors.flowLabels[1] || 'show source-defined target state';
  const messageC = anchors.messages[2] || anchors.flowLabels[2] || 'apply source-defined business change';
  const messageD = anchors.messages[3] || anchors.flowLabels[3] || 'verify source-defined acceptance result';
  const edgeMessageA = mermaidEdgeLabel(messageA, 'open source-defined business flow');
  const edgeMessageB = mermaidEdgeLabel(messageB, 'show source-defined target state');
  const edgeMessageC = mermaidEdgeLabel(messageC, 'apply source-defined business change');
  const edgeMessageD = mermaidEdgeLabel(messageD, 'verify source-defined acceptance result');
  const classTerms = anchors.classTerms.length > 0 ? anchors.classTerms : [
    mermaidNodeId(anchors.surface.label, 'Surface'),
    mermaidNodeId(anchors.dialog.label, 'Dialog'),
    mermaidNodeId(anchors.apply.label, 'ApplyPath'),
  ];
  const classIds = uniqueBy(
    classTerms.map((term) => ({ id: mermaidNodeId(term, 'SourceClass'), label: mermaidLabel(term, 'SourceClass') })),
    (item) => item.id
  ).slice(0, 5);
  const methodTerms = anchors.methodTerms.length > 0 ? anchors.methodTerms : ['preview', 'persist', 'rollback'];
  const sourceSteps = [...anchors.messages, ...anchors.flowLabels].slice(0, 6);
  const common = businessDiagramCommon({ evidenceRefs, targetPathRefs, triggerRows });
  const sourceDrivenIds = sourceDriven
    ? {
        host: mermaidNodeId(sourceDriven.host.label, 'HostWindow'),
        widget: mermaidNodeId(sourceDriven.widget.label, 'BusinessWidget'),
        dialog: mermaidNodeId(sourceDriven.dialog.label, 'SettingsDialog'),
        settings: mermaidNodeId(sourceDriven.settings.label, 'SettingsSnapshot'),
        style: mermaidNodeId(sourceDriven.style.label, 'DisplayStyle'),
        policy: mermaidNodeId(sourceDriven.policy.label, 'PolicyPersistence'),
        chart: mermaidNodeId(sourceDriven.chartState.label, 'RenderState'),
      }
    : null;
  const sourceDrivenControl = sourceDriven
    ? mermaidLabel(sourceDriven.host.control, 'settings control')
    : 'settings control';
  const sourceDrivenSystemMermaid =
    sourceDriven && sourceDrivenIds
      ? [
          'flowchart LR',
          `  User["${mermaidLabel(sourceDriven.actor.label, 'User')}"] -->|"open ${sourceDrivenControl}"| ${sourceDrivenIds.host}["${mermaidLabel(sourceDriven.host.label, 'Host window')}"]`,
          `  ${sourceDrivenIds.host} -->|"${mermaidEdgeLabel(`${sourceDriven.host.signal?.signal || 'clicked'}.connect(${sourceDriven.host.method})`, 'settings signal')}"| ${sourceDrivenIds.widget}["${mermaidLabel(`${sourceDriven.widget.label}.${sourceDriven.widget.showMethod}`, 'business widget')}"]`,
          `  ${sourceDrivenIds.widget} -->|"snapshot current visible/opacity state"| ${sourceDrivenIds.settings}["${mermaidLabel(sourceDriven.settings.label, 'settings snapshot')}"]`,
          `  ${sourceDrivenIds.widget} -->|"show dialog with on_preview/on_apply callbacks"| ${sourceDrivenIds.dialog}["${mermaidLabel(sourceDriven.dialog.label, 'settings dialog')}"]`,
          `  ${sourceDrivenIds.dialog} -->|"checkbox/slider changed -> on_preview"| ${sourceDrivenIds.widget}`,
          `  ${sourceDrivenIds.dialog} -->|"cancel rollback via ${mermaidEdgeLabel(sourceDriven.dialog.cancelMethod, 'cancel')}"| ${sourceDrivenIds.widget}`,
          `  ${sourceDrivenIds.widget} -->|"${mermaidEdgeLabel(sourceDriven.widget.applyMethod, 'apply settings')}"| ${sourceDrivenIds.style}["${mermaidLabel(`${sourceDriven.style.label} visibility/opacity`, 'display style state')}"]`,
          `  ${sourceDrivenIds.style} -->|"${mermaidEdgeLabel(sourceDriven.widget.policyMethod, 'persist policy')}"| ${sourceDrivenIds.policy}["${mermaidLabel(sourceDriven.policy.label, 'policy persistence')}"]`,
          `  ${sourceDrivenIds.style} -->|"${mermaidEdgeLabel(sourceDriven.chartState.updateLabel, 'render update')}"| ${sourceDrivenIds.chart}["${mermaidLabel(sourceDriven.chartState.label, 'rendered state update')}"]`,
          `  ${sourceDrivenIds.chart} --> Evidence["${mermaidLabel(evidenceRefs.join(' / '), 'Acceptance evidence')}"]`,
        ].join('\n')
      : '';
  const sourceDrivenClassNames = sourceDriven
    ? uniqueBy(
        [
          { name: sourceDriven.host.label, methods: [sourceDriven.host.method] },
          { name: sourceDriven.widget.label, methods: [sourceDriven.widget.showMethod, sourceDriven.widget.applyMethod, sourceDriven.widget.policyMethod] },
          { name: sourceDriven.dialog.label, methods: [sourceDriven.dialog.getMethod, sourceDriven.dialog.cancelMethod, sourceDriven.dialog.resetMethod] },
          { name: sourceDriven.settings.label, methods: sourceDriven.settings.fields.length ? sourceDriven.settings.fields : ['visible', 'opacity'] },
          { name: sourceDriven.style.label, methods: sourceDriven.style.fields.length ? sourceDriven.style.fields : ['visible', 'opacity'] },
          { name: sourceDriven.policy.label, methods: ['save_policy'] },
          { name: sourceDriven.chartState.label, methods: ['update'] },
        ],
        (item) => item.name
      ).filter((item) => text(item.name))
    : [];
  const sourceDrivenClassMermaid =
    sourceDriven && sourceDrivenIds
      ? [
          'classDiagram',
          ...sourceDrivenClassNames.flatMap((item) => {
            const id = mermaidNodeId(item.name, 'SourceClass');
            return [
              `  class ${id} {`,
              ...item.methods
                .filter(Boolean)
                .slice(0, 4)
                .map((method) => `    +${mermaidMethodName(method, 'sourceBoundBehavior')}()`),
              '  }',
            ];
          }),
          `  ${sourceDrivenIds.host} --> ${sourceDrivenIds.widget}`,
          `  ${sourceDrivenIds.widget} --> ${sourceDrivenIds.dialog}`,
          `  ${sourceDrivenIds.dialog} --> ${sourceDrivenIds.settings}`,
          `  ${sourceDrivenIds.widget} --> ${sourceDrivenIds.style}`,
          `  ${sourceDrivenIds.widget} --> ${sourceDrivenIds.policy}`,
          `  ${sourceDrivenIds.widget} --> ${sourceDrivenIds.chart}`,
        ].join('\n')
      : '';
  const sourceDrivenSwimlaneMermaid =
    sourceDriven && sourceDrivenIds
      ? [
          'flowchart LR',
          '  subgraph UserLane["User"]',
          `    UserOpen["open ${sourceDrivenControl}"]`,
          '    UserAdjust["change visible/opacity"]',
          '    UserDecision["confirm or cancel"]',
          '  end',
          `  subgraph HostSurfaceLane["${mermaidLabel(sourceDriven.host.label, 'Host surface')}"]`,
          `    HostSignal["${mermaidLabel(`${sourceDrivenControl}.${sourceDriven.host.signal?.signal || 'clicked'}.connect`, 'clicked.connect')}"]`,
          `    HostDelegate["delegate ${mermaidLabel(sourceDriven.host.method, 'settings entrypoint')}"]`,
          '  end',
          `  subgraph WidgetLane["${mermaidLabel(sourceDriven.widget.label, 'Business widget')}"]`,
          `    WidgetSnapshot["build ${mermaidLabel(sourceDriven.settings.label, 'settings snapshot')}"]`,
          '    WidgetCallbacks["wire on_preview / on_apply"]',
          `    WidgetApply["${mermaidLabel(sourceDriven.widget.applyMethod, 'apply settings')} writes item/style/control/policy"]`,
          '  end',
          `  subgraph DialogLane["${mermaidLabel(sourceDriven.dialog.label, 'Settings dialog')}"]`,
          '    DialogControls["QCheckBox / QSlider valueChanged,toggled"]',
          `    DialogGet["${mermaidLabel(sourceDriven.dialog.getMethod, 'get settings')}"]`,
          `    DialogCancel["cancel rollback via ${mermaidLabel(sourceDriven.dialog.cancelMethod, 'cancel')} + original snapshot"]`,
          '  end',
          '  subgraph RenderStateLane["Rendered product state"]',
          `    ItemState["${mermaidLabel(sourceDriven.style.label, 'item/style')} visible + opacity"]`,
          `    PolicyState["${mermaidLabel(sourceDriven.policy.label, 'policy persistence')}"]`,
          `    RenderUpdate["${mermaidLabel(sourceDriven.chartState.label, 'rendered state update')}"]`,
          '  end',
          '  UserOpen --> HostSignal --> HostDelegate --> WidgetSnapshot --> WidgetCallbacks --> DialogControls',
          '  UserAdjust --> DialogControls --> DialogGet --> WidgetApply --> ItemState --> PolicyState --> RenderUpdate',
          '  UserDecision --> DialogCancel --> WidgetApply',
        ].join('\n')
      : '';
  const sourceDrivenStateMermaid =
    sourceDriven && sourceDrivenIds
      ? [
          'stateDiagram-v2',
          `  state "${mermaidStateLabel(currentState, 'Current product behavior')}" as Current`,
          '  state "Settings snapshot opened from source code" as Snapshot',
          '  state "Preview applies visibility and opacity to rendered product state" as Preview',
          '  state "Confirmed settings persisted and rendered state updated" as Committed',
          '  state "Cancel rollback restores original selected/opacity state" as RolledBack',
          '  [*] --> Current',
          `  Current --> Snapshot: ${mermaidStateLabel(sourceDriven.host.method, 'open settings')}`,
          `  Snapshot --> Preview: on_preview -> ${mermaidStateLabel(sourceDriven.widget.applyMethod, 'apply settings')}`,
          '  Preview --> Committed: dialog accepted / on_apply',
          '  Preview --> RolledBack: cancel rollback',
          '  RolledBack --> Current',
          `  Committed --> Target: ${mermaidStateLabel(targetState, 'target behavior')}`,
        ].join('\n')
      : '';
  const sourceDrivenSequenceMermaid =
    sourceDriven && sourceDrivenIds
      ? [
          'sequenceDiagram',
          '  actor U as User',
          `  participant H as ${mermaidLabel(sourceDriven.host.label, 'Host window')}`,
          `  participant W as ${mermaidLabel(sourceDriven.widget.label, 'Business widget')}`,
          `  participant D as ${mermaidLabel(sourceDriven.dialog.label, 'Settings dialog')}`,
          `  participant S as ${mermaidLabel(sourceDriven.settings.label, 'Settings snapshot')}`,
          `  participant C as ${mermaidLabel(sourceDriven.chartState.label, 'Rendered state update')}`,
          `  U->>H: click ${sourceDrivenControl}`,
          `  H->>W: ${mermaidEdgeLabel(sourceDriven.host.method, 'open settings')}`,
          `  W->>S: build current visible/opacity snapshot`,
          '  W->>D: show_settings_dialog(current_settings,on_preview,on_apply)',
          '  U->>D: toggle visible / adjust opacity',
          `  D->>W: on_preview(get_settings())`,
          `  W->>C: ${mermaidEdgeLabel(sourceDriven.widget.applyMethod, 'apply settings')} updates item/style/policy/rendered state`,
          '  alt cancel',
          '    D->>W: on_preview(_original_settings) rollback',
          '  else confirm',
          '    D->>W: on_apply(new_settings) persist',
          '  end',
        ].join('\n')
      : '';
  const sourceDrivenActivityMermaid =
    sourceDriven && sourceDrivenIds
      ? [
          'flowchart TD',
          `  A["User opens ${sourceDrivenControl}"] --> B["${mermaidLabel(sourceDriven.host.label, 'Host')} delegates to ${mermaidLabel(sourceDriven.widget.label, 'Widget')}"]`,
          `  B --> C["${mermaidLabel(sourceDriven.widget.label, 'Widget')} snapshots ${mermaidLabel(sourceDriven.settings.label, 'settings')}"]`,
          `  C --> D["${mermaidLabel(sourceDriven.dialog.label, 'Dialog')} renders checkbox/slider controls"]`,
          '  D --> E{User changes settings?}',
          `  E -->|preview| F["${mermaidLabel(sourceDriven.widget.applyMethod, 'apply')} updates item/style/control/policy"]`,
          `  F --> G["${mermaidLabel(sourceDriven.chartState.label, 'Rendered state update')}"]`,
          '  E -->|cancel| H["cancel rollback restores original snapshot"]',
          '  H --> F',
          '  G --> I([Architecture-backed target behavior])',
        ].join('\n')
      : '';
  return [
    {
      ...common,
      id: 'BUS-ARCH-VIEW-SYSTEM',
      type: 'system_architecture',
      title: `${businessTitle} System Architecture Diagram`,
      description: 'Consumer-facing system boundary derived from source-defined business views.',
      mermaid: sourceDrivenSystemMermaid || [
        'flowchart LR',
        `  ${actorId}["${mermaidLabel(anchors.actor.label, 'User')}"] -->|${edgeMessageA}| ${surfaceId}["${mermaidLabel(anchors.surface.label, 'Source UI surface')}"]`,
        `  ${surfaceId} -->|${edgeMessageB}| ${dialogId}["${mermaidLabel(anchors.dialog.label, 'Source interaction surface')}"]`,
        `  ${dialogId} -->|${edgeMessageC}| ${applyId}["${mermaidLabel(anchors.apply.label, 'Source apply path')}"]`,
        `  ${applyId} --> TargetState["${targetState}"]`,
        `  TargetState --> Evidence["${mermaidLabel(evidenceRefs.join(' / '), 'Acceptance evidence')}"]`,
      ].join('\n'),
    },
    {
      ...common,
      id: 'BUS-ARCH-VIEW-DEPLOYMENT',
      type: 'deployment',
      title: `${businessTitle} Deployment Diagram`,
      description: 'Consumer project runtime surfaces and product code targets affected by the source-defined business requirement.',
      mermaid: [
        'flowchart TB',
        `  subgraph Runtime["${businessTitle} runtime"]`,
        `    RuntimeActor["${mermaidLabel(anchors.actor.label, 'User')}"] --> RuntimeSurface["${mermaidLabel(anchors.surface.label, 'Source UI surface')}"]`,
        `    RuntimeSurface --> RuntimeDialog["${mermaidLabel(anchors.dialog.label, 'Source interaction surface')}"]`,
        `    RuntimeDialog --> RuntimeApply["${mermaidLabel(anchors.apply.label, 'Source apply path')}"]`,
        '  end',
        '  subgraph ProductCode["Product code targets"]',
        ...deploymentTargets.productTargets.map(
          (target, index) => `    ProductTarget${index}["${mermaidLabel(compactPathLabel(target, 'product target'), 'product target')}"]`
        ),
        '  end',
        '  subgraph TestCode["Acceptance and E2E targets"]',
        ...deploymentTargets.testTargets.map(
          (target, index) => `    TestTarget${index}["${mermaidLabel(compactPathLabel(target, 'test target'), 'test target')}"]`
        ),
        '  end',
        '  subgraph EvidenceArtifacts["Contract evidence artifacts"]',
        ...deploymentTargets.evidenceTargets.map(
          (target, index) => `    EvidenceTarget${index}["${mermaidLabel(compactPathLabel(target, 'evidence artifact'), 'evidence artifact')}"]`
        ),
        '  end',
        `  RuntimeApply --> ProductTarget0["${primaryTarget}"]`,
        ...(deploymentTargets.productTargets.length > 1
          ? deploymentTargets.productTargets.slice(1).map((_, index) => `  RuntimeSurface --> ProductTarget${index + 1}`)
          : []),
        ...(deploymentTargets.testTargets.length > 0 ? ['  RuntimeApply --> TestTarget0'] : []),
        ...(deploymentTargets.testTargets.length > 0 && deploymentTargets.evidenceTargets.length > 0
          ? ['  TestTarget0 --> EvidenceTarget0']
          : []),
      ].join('\n'),
    },
    {
      ...common,
      id: 'BUS-ARCH-VIEW-CLASS',
      type: 'class',
      title: `${businessTitle} Class Diagram`,
      description: sourceDriven
        ? 'Business-facing classes and operations derived from source code target paths.'
        : 'Business-facing classes and operations derived from source views and target paths.',
      mermaid: sourceDrivenClassMermaid || [
        'classDiagram',
        ...classIds.flatMap((item, index) => [
          `  class ${item.id} {`,
          `    +${mermaidMethodName(methodTerms[index] || methodTerms[0] || 'sourceBoundBehavior', 'sourceBoundBehavior')}()`,
          '  }',
        ]),
        ...classIds.slice(0, -1).map((item, index) => `  ${item.id} --> ${classIds[index + 1].id}`),
      ].join('\n'),
    },
    {
      ...common,
      id: 'BUS-ARCH-VIEW-SWIMLANE',
      type: 'swimlane',
      title: `${businessTitle} Swimlane Diagram`,
      description: sourceDriven
        ? 'Business responsibilities across source-code actors, host window, widget, settings dialog, and chart state.'
        : 'Business responsibilities across source-defined actors, UI surfaces, apply path, and evidence.',
      mermaid: sourceDrivenSwimlaneMermaid || [
        'flowchart LR',
        `  subgraph ActorLane["${mermaidLabel(anchors.actor.label, 'User')}"]`,
        `    ActorStep["${messageA}"]`,
        '  end',
        `  subgraph SurfaceLane["${mermaidLabel(anchors.surface.label, 'Source UI surface')}"]`,
        `    SurfaceStep["${messageB}"]`,
        '  end',
        `  subgraph DialogLane["${mermaidLabel(anchors.dialog.label, 'Source interaction surface')}"]`,
        `    DialogStep["${messageC}"]`,
        '  end',
        `  subgraph ApplyLane["${mermaidLabel(anchors.apply.label, 'Source apply path')}"]`,
        `    ApplyStep["${messageD}"]`,
        '  end',
        '  ActorStep --> SurfaceStep --> DialogStep --> ApplyStep',
      ].join('\n'),
    },
    {
      ...common,
      id: 'BUS-ARCH-VIEW-STATE',
      type: 'state_machine',
      title: `${businessTitle} State Machine Diagram`,
      description: 'Business state transitions from source current limitation to source target behavior.',
      mermaid: sourceDrivenStateMermaid || [
        'stateDiagram-v2',
        `  state "${mermaidStateLabel(currentState, 'Current product behavior')}" as Current`,
        `  state "${mermaidStateLabel(targetState, 'Target product behavior')}" as Target`,
        `  state "${mermaidStateLabel(sourceSteps[1] || messageB, 'Source interaction')}" as Interaction`,
        `  state "${mermaidStateLabel(sourceSteps[2] || messageC, 'Source preview or apply')}" as Previewed`,
        '  [*] --> Current',
        `  Current --> Interaction: ${mermaidStateLabel(sourceSteps[0] || messageA, 'open')}`,
        `  Interaction --> Previewed: ${mermaidStateLabel(sourceSteps[2] || messageC, 'change')}`,
        '  Previewed --> Target: confirm',
        '  Previewed --> Current: cancel or rollback',
      ].join('\n'),
    },
    {
      ...common,
      id: 'BUS-ARCH-VIEW-SEQUENCE',
      type: 'sequence',
      title: `${businessTitle} Sequence Diagram`,
      description: 'Primary business sequence from the source-defined happy path when available.',
      mermaid:
        sourceDrivenSequenceMermaid ||
        text(happyView.mermaid) ||
        [
          'sequenceDiagram',
          `  actor ${actorId} as ${mermaidLabel(anchors.actor.label, 'User')}`,
          `  participant ${surfaceId} as ${mermaidLabel(anchors.surface.label, 'Source UI surface')}`,
          `  participant ${dialogId} as ${mermaidLabel(anchors.dialog.label, 'Source interaction surface')}`,
          `  participant ${applyId} as ${mermaidLabel(anchors.apply.label, 'Source apply path')}`,
          `  ${actorId}->>${surfaceId}: ${edgeMessageA}`,
          `  ${surfaceId}->>${dialogId}: ${edgeMessageB}`,
          `  ${dialogId}->>${applyId}: ${edgeMessageC}`,
          `  ${applyId}-->>${actorId}: ${edgeMessageD}`,
        ].join('\n'),
    },
    {
      ...common,
      id: 'BUS-ARCH-VIEW-ACTIVITY',
      type: 'activity',
      title: `${businessTitle} Activity Diagram`,
      description: 'Business activity flow derived from source-defined flow/failure/edge views.',
      mermaid:
        sourceDrivenActivityMermaid ||
        text(flowView.mermaid) ||
        [
          'flowchart TD',
          '  Start([Start]) --> ShowCurrent["Show current business state"]',
          '  ShowCurrent --> Edit["Edit settings"]',
          '  Edit --> Valid{Valid business choice?}',
          '  Valid -->|yes| Apply["Apply target behavior"]',
          '  Valid -->|no| Failure["Show failure or edge handling"]',
          '  Failure --> Edit',
          '  Apply --> Done([Accepted business result])',
        ].join('\n'),
      sourceViewRefs: stringList(flowView.id ? [flowView.id] : []).concat(
        stringList(failureView.id ? [failureView.id] : []),
        stringList(stateView.id ? [stateView.id] : []),
        stringList(edgeView.id ? [edgeView.id] : [])
      ),
    },
  ];
}

function buildGovernanceArchitectureDiagrams({
  recordId,
  runId,
  targetPaths,
  consumerImpactScan,
  governanceImpactScan,
  fullArchitectureTriggerMatrix,
  evidenceRefs,
}) {
  const targetPathRefs = targetPaths.slice(0, 12);
  const consumerTriggered = triggeredRows(consumerImpactScan);
  const governanceTriggered = triggeredRows(governanceImpactScan);
  const triggerRows = triggeredRows(fullArchitectureTriggerMatrix);
  const primaryPath = targetPathRefs[0] || 'target-paths';
  const secondaryPath = targetPathRefs[1] || primaryPath;
  const consumerImpactLabel = mermaidLabel(
    consumerTriggered[0]?.category || consumerTriggered[0]?.summary,
    'Consumer impact scan'
  );
  const governanceImpactLabel = mermaidLabel(
    governanceTriggered[0]?.category || governanceTriggered[0]?.summary,
    'Governance impact scan'
  );
  const triggerLabel = mermaidLabel(triggerRows[0]?.trigger || triggerRows[0]?.reason, 'Architecture trigger');
  const common = {
    schemaVersion: 'architecture-confirmation-diagram/v1',
    scope: 'governance_architecture',
    evidenceRefs,
    targetPathRefs,
    triggerRefs: triggerRows.map((row) => text(row.trigger || row.category || row.reason)).filter(Boolean),
  };
  return [
    {
      ...common,
      id: 'ARCH-VIEW-SYSTEM',
      type: 'system_architecture',
      title: 'System Architecture Diagram',
      description: 'Requirement-scoped system boundary from source confirmation through controlled architecture ingest.',
      mermaid: [
        'flowchart LR',
        '  Source["Implementation Source Document"] --> Contract["implementationConfirmation"]',
        '  Contract --> Artifact["Architecture Confirmation Artifact"]',
        '  Impact["Impact Scans"] --> Artifact',
        '  Paths["Target Paths"] --> Artifact',
        '  Artifact --> Html["Architecture Confirmation HTML"]',
        '  Html --> Chat["User Hash Confirmation In Chat"]',
        '  Chat --> Ingest["Controlled Architecture Ingest"]',
        '  Ingest --> Record["Requirement Record architectureConfirmations"]',
      ].join('\n'),
    },
    {
      ...common,
      id: 'ARCH-VIEW-DEPLOYMENT',
      type: 'deployment',
      title: 'Deployment Diagram',
      description: 'Where source, installed skill runtime, architecture artifacts, and requirement record projections live.',
      mermaid: [
        'flowchart TB',
        '  subgraph Workspace["Consumer Workspace"]',
        '    Source["docs/plans source document"]',
        '    Output["_bmad-output requirement records"]',
        '    Html["architecture-confirmation.html"]',
        '  end',
        '  subgraph SkillRuntime["Installed requirements-contract-authoring skill"]',
        '    Prepare["prepare-architecture-confirmation-page"]',
        '    Producer["generate-architecture-confirmation-artifact"]',
        '    Renderer["render-architecture-confirmation-html"]',
        '  end',
        '  Prepare --> Producer --> Renderer --> Html',
        '  Producer --> Output',
        '  Source --> Prepare',
      ].join('\n'),
    },
    {
      ...common,
      id: 'ARCH-VIEW-CLASS',
      type: 'class',
      title: 'Class Diagram',
      description: 'Core architecture confirmation data contracts and references.',
      mermaid: [
        'classDiagram',
        '  class ImplementationConfirmation {',
        '    +recordId',
        '    +sourceDocumentHash',
        '    +implementationConfirmationHash',
        '    +architectureImpacts',
        '  }',
        '  class RequirementRecord {',
        '    +status',
        '    +sourceDocumentHash',
        '    +architectureConfirmationState',
        '    +architectureConfirmations',
        '  }',
        '  class ArchitectureConfirmationArtifact {',
        '    +runId',
        '    +targetPathsHash',
        '    +architectureDiagrams',
        '    +architectureConfirmationArtifactHash',
        '  }',
        '  class ArchitectureDiagram {',
        '    +type',
        '    +mermaid',
        '    +evidenceRefs',
        '    +targetPathRefs',
        '  }',
        '  ImplementationConfirmation --> RequirementRecord',
        '  ArchitectureConfirmationArtifact --> ArchitectureDiagram',
        '  RequirementRecord --> ArchitectureConfirmationArtifact',
      ].join('\n'),
    },
    {
      ...common,
      id: 'ARCH-VIEW-SWIMLANE',
      type: 'swimlane',
      title: 'Swimlane Diagram',
      description: 'Responsibility lanes for architecture confirmation preparation, review, and ingest.',
      mermaid: [
        'flowchart LR',
        '  subgraph UserLane["User"]',
        '    Review["Review architecture page"]',
        '    Confirm["Paste exact hash phrase"]',
        '  end',
        '  subgraph AgentLane["Main Agent"]',
        '    Prepare["Run prepare page entry"]',
        '    Wait["Stop before ingest"]',
        '  end',
        '  subgraph SkillLane["Skill Scripts"]',
        '    Check["Check stale state"]',
        '    Build["Build artifact"]',
        '    Render["Render HTML"]',
        '  end',
        '  subgraph RecordLane["Requirement Record"]',
        '    State["architectureConfirmationState"]',
        '    Confirmations["architectureConfirmations"]',
        '  end',
        '  Prepare --> Check --> Build --> Render --> Review --> Confirm --> Confirmations',
        '  Check --> State',
        '  Wait --> Review',
      ].join('\n'),
    },
    {
      ...common,
      id: 'ARCH-VIEW-STATE',
      type: 'state_machine',
      title: 'State Machine Diagram',
      description: 'Fail-closed architecture confirmation state transitions.',
      mermaid: [
        'stateDiagram-v2',
        '  [*] --> Missing',
        '  Missing --> Draft: prepare page creates artifact',
        '  Stale --> Draft: regenerate current-hash artifact',
        '  Draft --> AwaitingUserConfirmation: HTML rendered',
        '  AwaitingUserConfirmation --> Active: controlled ingest accepts exact hashes',
        '  AwaitingUserConfirmation --> Rejected: user rejects or changes scope',
        '  Active --> Stale: source/hash/recipe/input mismatch',
        '  Rejected --> Draft: regenerate artifact',
      ].join('\n'),
    },
    {
      ...common,
      id: 'ARCH-VIEW-SEQUENCE',
      type: 'sequence',
      title: 'Sequence Diagram',
      description: 'Temporal interaction sequence for the controlled architecture confirmation page.',
      mermaid: [
        'sequenceDiagram',
        '  actor User',
        '  participant Agent as Main Agent',
        '  participant Prepare as Prepare Entry',
        '  participant Producer as Artifact Producer',
        '  participant Renderer as HTML Renderer',
        '  participant Record as Requirement Record',
        '  Agent->>Prepare: prepare architecture confirmation page',
        '  Prepare->>Record: record architecture_confirmation_state_checked',
        '  Prepare->>Producer: generate current-hash artifact',
        '  Producer-->>Prepare: artifact hash and JSON',
        '  Prepare->>Renderer: render architecture HTML',
        '  Renderer-->>Agent: report and confirmation phrase',
        '  Agent-->>User: request exact hash confirmation',
      ].join('\n'),
    },
    {
      ...common,
      id: 'ARCH-VIEW-ACTIVITY',
      type: 'activity',
      title: 'Activity Diagram',
      description: 'Architecture confirmation activity flow and fail-closed decision points.',
      mermaid: [
        'flowchart TD',
        `  Start([Start ${mermaidLabel(runId, 'architecture run')}]) --> Validate["Validate confirmed source and record hashes"]`,
        `  Validate --> Scan["Bind impact scans: ${consumerImpactLabel} / ${governanceImpactLabel}"]`,
        `  Scan --> Trigger["Evaluate trigger: ${triggerLabel}"]`,
        `  Trigger --> Paths["Bind target path: ${mermaidLabel(compactPathLabel(primaryPath, 'primary target'), 'primary target')}"]`,
        `  Paths --> Secondary["Review secondary path: ${mermaidLabel(compactPathLabel(secondaryPath, 'secondary target'), 'secondary target')}"]`,
        '  Secondary --> Render["Render architecture diagrams and hash recipe"]',
        '  Render --> UserDecision{User confirms exact hashes?}',
        '  UserDecision -->|yes| Ingest["Controlled architecture ingest"]',
        '  UserDecision -->|no| Stop([Stop and repair scope])',
        '  Ingest --> Done([Architecture confirmed])',
      ].join('\n'),
    },
  ];
}

function requireConfirmedSource(sourcePath, recordPath) {
  const sourceText = fs.readFileSync(sourcePath, 'utf8');
  const extracted = extractImplementationConfirmation(sourceText);
  const confirmation = extracted.confirmation;
  const record = readJson(recordPath);
  if (text(confirmation.status) !== 'user_confirmed') throw new Error('implementationConfirmation is not user_confirmed');
  if (text(record.status) !== 'user_confirmed') throw new Error('requirement record is not user_confirmed');
  const sourceHash = sourceDocumentHashFor(sourceText, extracted.blockText, confirmation);
  const implementationHash = implementationConfirmationHashFor(confirmation);
  const mismatches = [];
  if (text(record.sourceDocumentHash) !== sourceHash) mismatches.push('record_source_hash_mismatch');
  if (text(record.implementationConfirmationHash) !== implementationHash) {
    mismatches.push('record_implementation_confirmation_hash_mismatch');
  }
  if (text(confirmation.sourceDocumentHash) && text(confirmation.sourceDocumentHash) !== sourceHash) {
    mismatches.push('source_bookkeeping_source_hash_mismatch');
  }
  if (text(confirmation.implementationConfirmationHash) && text(confirmation.implementationConfirmationHash) !== implementationHash) {
    mismatches.push('source_bookkeeping_implementation_confirmation_hash_mismatch');
  }
  if (mismatches.length) throw new Error(mismatches.join(','));
  return { confirmation, record, sourceHash, implementationHash };
}

function buildArtifact(args) {
  const sourcePath = path.resolve(args.source);
  const recordPath = path.resolve(args.requirementRecord);
  const outPath = path.resolve(args.out);
  const targetPaths = readJsonOption(args.targetPaths, 'targetPaths').map((item) => normalizeRepoPath(item));
  const consumerImpactScan = readJsonOption(args.consumerImpactScan, 'consumerImpactScan');
  const governanceImpactScan = readJsonOption(args.governanceImpactScan, 'governanceImpactScan');
  const fullArchitectureTriggerMatrix = readJsonOption(args.fullArchitectureTriggerMatrix, 'fullArchitectureTriggerMatrix');
  if (targetPaths.length === 0) throw new Error('targetPaths must not be empty');
  if (consumerImpactScan.length === 0) throw new Error('consumerImpactScan must not be empty');
  if (governanceImpactScan.length === 0) throw new Error('governanceImpactScan must not be empty');
  const { confirmation, record, sourceHash, implementationHash } = requireConfirmedSource(sourcePath, recordPath);
  const recipe = resolveRecipe(args.recipe);
  const runId = text(args.runId) || `arch-confirm-${Date.now()}`;
  const evidenceRefs = args.evidenceRefs ? readJsonOption(args.evidenceRefs, 'evidenceRefs') : ['EVD-036', 'EVD-037'];
  const relatedRequirementIds = args.relatedRequirementIds
    ? readJsonOption(args.relatedRequirementIds, 'relatedRequirementIds')
    : ['MUST-035', 'MUST-036', 'MUST-037', ...evidenceRefs];
  const targetPathsHash = sha256Text(stableStringify(targetPaths));
  const consumerImpactScanHash = sha256Text(stableStringify(consumerImpactScan));
  const governanceImpactScanHash = sha256Text(stableStringify(governanceImpactScan));
  const businessArchitectureDiagrams = buildBusinessArchitectureDiagrams({
    confirmation,
    targetPaths,
    consumerImpactScan,
    fullArchitectureTriggerMatrix,
    evidenceRefs,
  });
  const governanceArchitectureDiagrams = buildGovernanceArchitectureDiagrams({
    recordId: text(confirmation.recordId) || text(record.recordId),
    runId,
    targetPaths,
    consumerImpactScan,
    governanceImpactScan,
    fullArchitectureTriggerMatrix,
    evidenceRefs,
  });
  const artifact = {
    schemaVersion: 'architecture-confirmation/v1',
    recordId: text(confirmation.recordId) || text(record.recordId),
    requirementSetId: text(confirmation.requirementSetId) || text(record.requirementSetId),
    runId,
    status: 'draft',
    entryFlow: text(confirmation.entryFlow),
    entryFlowClass: text(confirmation.entryFlowClass),
    workflowAdapter: text(confirmation.workflowAdapter),
    decision: text(args.decision) || 'full_architecture_confirmed',
    outcome: text(args.outcome) || text(args.decision) || 'full_architecture_confirmed',
    sourceDocumentHash: sourceHash,
    implementationConfirmationHash: implementationHash,
    architectureConfirmationHashRecipe: recipe,
    resolvedRecipeHash: recipe.resolvedRecipeHash,
    targetPaths,
    targetPathsHash,
    consumerImpactScan,
    consumerImpactScanHash,
    governanceImpactScan,
    governanceImpactScanHash,
    fullArchitectureTriggerMatrix,
    businessArchitectureDiagrams,
    governanceArchitectureDiagrams,
    architectureDiagrams: businessArchitectureDiagrams,
    riskStatement: text(args.riskStatement) || 'Architecture confirmation risk statement must be reviewed in the source confirmation context.',
    rollbackPlan: text(args.rollbackPlan) || 'Rollback by rejecting this architecture confirmation and regenerating a new requirement-scoped artifact.',
    evidenceRefs,
    staleInputs: {
      sourceDocumentHash: sourceHash,
      implementationConfirmationHash: implementationHash,
      targetPathsHash,
      consumerImpactScanHash,
      governanceImpactScanHash,
      resolvedRecipeHash: recipe.resolvedRecipeHash,
    },
    architectureConfirmationArtifactRef: {
      artifactType: 'architecture_confirmation',
      sourceOfTruthRole: 'evidence',
      path: normalizeRepoPath(outPath),
      producer: 'requirements-contract-authoring/generate-architecture-confirmation-artifact',
      purpose: 'requirement-scoped architecture confirmation artifact',
      relatedRequirementIds,
      status: 'draft',
      inputVersion: sourceHash,
      outputVersion: 'architecture-confirmation-v1',
    },
  };
  const artifactHash = architectureHashFor(artifact, recipe);
  artifact.artifactHash = artifactHash;
  artifact.architectureConfirmationArtifactHash = artifactHash;
  artifact.confirmationPhrase = [
    '确认架构确认进入实施准备',
    `sourceDocumentHash=${sourceHash}`,
    `implementationConfirmationHash=${implementationHash}`,
    `resolvedRecipeHash=${recipe.resolvedRecipeHash}`,
    `architectureConfirmationArtifactHash=${artifactHash}`,
  ].join('\n');
  artifact.architectureConfirmationArtifactRef.hash = artifactHash;
  return { artifact, outPath };
}

function main(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log('Usage: node generate-architecture-confirmation-artifact.ts --source <source.md> --requirement-record <record.json> --out <architecture-confirmation.json> --target-paths <json|file> --consumer-impact-scan <json|file> --governance-impact-scan <json|file> --full-architecture-trigger-matrix <json|file> [--run-id <id>] [--json]');
    return 0;
  }
  for (const key of ['source', 'requirementRecord', 'out', 'targetPaths', 'consumerImpactScan', 'governanceImpactScan', 'fullArchitectureTriggerMatrix']) {
    if (!args[key]) throw new Error(`missing required arg: ${key}`);
  }
  const { artifact, outPath } = buildArtifact(args);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  const result = {
    ok: true,
    architectureConfirmationPath: normalizeRepoPath(outPath),
    architectureConfirmationArtifactHash: artifact.architectureConfirmationArtifactHash,
    sourceDocumentHash: artifact.sourceDocumentHash,
    implementationConfirmationHash: artifact.implementationConfirmationHash,
    resolvedRecipeHash: artifact.resolvedRecipeHash,
  };
  process.stdout.write(args.json ? `${JSON.stringify(result, null, 2)}\n` : `architecture_confirmation=${result.architectureConfirmationPath}\n`);
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 2;
  }
}
