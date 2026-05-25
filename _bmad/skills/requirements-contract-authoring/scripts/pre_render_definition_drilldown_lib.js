const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('./load-js-yaml');

const CONFIRMATION_BOOKKEEPING_FIELDS = new Set([
  'status',
  'confirmedAt',
  'confirmedBy',
  'sourceDocumentHash',
  'implementationConfirmationHash',
  'reconfirmationRequest',
  'confirmationRender',
]);

const VAGUE_TERMS = [
  'appropriate',
  'proper',
  'robust',
  'fast',
  'easy',
  'reasonable',
  'etc',
  'TBD',
  'later',
  'as needed',
  '适当',
  '合理',
  '完善',
  '尽快',
  '高效',
  '等',
  '待定',
  '后续',
  '按需',
];

const SIDE_EFFECT_TERMS = [
  'write',
  'delete',
  'publish',
  'persist',
  'emit',
  'send',
  'call external',
  'status change',
  'state change',
  '写入',
  '删除',
  '发布',
  '持久化',
  '发送',
  '调用外部',
  '状态变更',
];

const SIDE_EFFECT_SAFETY_TERMS = [
  'timeout',
  'failure',
  'fail',
  'rollback',
  'idempot',
  'recovery',
  'retry',
  'assert',
  '超时',
  '失败',
  '回滚',
  '幂等',
  '恢复',
  '重试',
  '断言',
];

function sha256(content) {
  return `sha256:${crypto.createHash('sha256').update(content, 'utf8').digest('hex')}`;
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}

function semanticConfirmationForHash(confirmation) {
  const semantic = {};
  for (const [key, value] of Object.entries(confirmation ?? {})) {
    if (!CONFIRMATION_BOOKKEEPING_FIELDS.has(key)) semantic[key] = value;
  }
  return semantic;
}

function sourceDocumentHashFor(sourceText, blockText, confirmation) {
  const normalizedBlock = `implementationConfirmation:${stableStringify(semanticConfirmationForHash(confirmation))}`;
  return sha256(sourceText.replace(blockText, normalizedBlock));
}

function implementationConfirmationHashFor(confirmation) {
  return sha256(stableStringify(semanticConfirmationForHash(confirmation)));
}

function normalizePathForReport(filePath) {
  return path.resolve(filePath).replace(/\\/g, '/');
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function stringList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function issue(code, message, refs = [], severity = 'blocker', source = 'definition_drilldown') {
  return { code, message, refs, severity, source };
}

const SUPPRESSING_RESOLUTION_STATUSES = new Set([
  'resolved',
  'waived',
  'converted_to_open_question',
  'converted_to_out_boundary',
]);

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function slug(value) {
  return String(value)
    .trim()
    .replace(/[^a-z0-9]+/giu, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
    .toUpperCase();
}

function shortHash(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex').slice(0, 16);
}

function normalizeForFingerprint(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function fingerprintForQuestion(question) {
  return `fp:${shortHash(
    stableStringify({
      category: question.category,
      refs: stringList(question.refs).sort(),
      question: normalizeForFingerprint(question.question),
      recommendedAnswer: normalizeForFingerprint(question.recommendedAnswer),
    })
  )}`;
}

function clusterIdForQuestion(question) {
  return `cluster:${slug(question.category)}:${shortHash(
    stableStringify({ category: question.category, refs: stringList(question.refs).sort() })
  ).slice(0, 10)}`;
}

function enrichQuestion(question) {
  const fingerprint = question.fingerprint ?? fingerprintForQuestion(question);
  const clusterId = question.clusterId ?? clusterIdForQuestion(question);
  return {
    ...question,
    fingerprint,
    clusterId,
    clusterCategory: question.category,
    clusterRefs: stringList(question.refs).sort(),
  };
}

function findingFromQuestion(question) {
  return {
    ...issue(
      `definition_${question.category}`,
      question.question,
      question.refs,
      question.severity === 'blocker' ? 'blocker' : 'warning'
    ),
    fingerprint: question.fingerprint,
    category: question.category,
    clusterId: question.clusterId,
    clusterCategory: question.clusterCategory,
    clusterRefs: question.clusterRefs,
    recommendedAnswer: question.recommendedAnswer,
    status: 'open',
    summary: question.question,
    requirementIds: question.refs,
  };
}

function actionForCategory(category) {
  if (category === 'contradiction_matrix') return ['split_requirement', 'convert_to_open_question'];
  if (category === 'external_side_effect_incomplete') return ['add_evidence_oracle'];
  if (category === 'unresolved_authority_ref') return ['add_evidence_oracle'];
  if (category === 'glossary_conflict') return ['convert_to_open_question'];
  if (category === 'missing_business_scenario') return ['split_requirement'];
  return ['convert_to_open_question'];
}

function buildClusters(findings, questions = []) {
  const byId = new Map();
  const questionByFingerprint = new Map(questions.map((question) => [question.fingerprint, question]));
  for (const finding of findings) {
    const clusterId = finding.clusterId ?? `cluster:${slug(finding.category ?? finding.code)}:${shortHash(finding.code)}`;
    if (!byId.has(clusterId)) {
      byId.set(clusterId, {
        id: clusterId,
        category: finding.clusterCategory ?? finding.category ?? finding.code,
        refs: [],
        severity: 'warning',
        fingerprints: [],
        findingCodes: [],
        questions: [],
        recommendedActions: [],
      });
    }
    const cluster = byId.get(clusterId);
    cluster.refs = unique([...cluster.refs, ...stringList(finding.refs)]).sort();
    cluster.fingerprints = unique([...cluster.fingerprints, finding.fingerprint]).sort();
    cluster.findingCodes = unique([...cluster.findingCodes, finding.code]).sort();
    if (finding.severity !== 'warning') cluster.severity = 'blocker';
    cluster.recommendedActions = unique([...cluster.recommendedActions, ...actionForCategory(cluster.category)]).sort();
    const question = questionByFingerprint.get(finding.fingerprint);
    if (question) {
      cluster.questions.push({
        id: question.id,
        fingerprint: question.fingerprint,
        question: question.question,
        recommendedAnswer: question.recommendedAnswer,
        refs: question.refs,
      });
    }
  }
  return [...byId.values()].map((cluster) => ({
    ...cluster,
    findingCount: cluster.fingerprints.length,
  }));
}

function extractImplementationConfirmation(sourceText) {
  const lines = sourceText.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((line) => /^implementationConfirmation:\s*$/u.test(line));
  if (start < 0) throw new Error('missing implementationConfirmation block');

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === '') continue;
    if (/^\S/u.test(line) && !/^implementationConfirmation:\s*$/u.test(line)) {
      end = i;
      break;
    }
  }

  const blockText = lines.slice(start, end).join('\n');
  const parsed = yaml.load(blockText);
  if (!parsed || typeof parsed !== 'object' || !parsed.implementationConfirmation) {
    throw new Error('implementationConfirmation block is not valid YAML');
  }
  return { blockText, confirmation: parsed.implementationConfirmation };
}

function collectContextPaths(rootDir, sourcePath) {
  const paths = [];
  const add = (candidate) => {
    if (!candidate) return;
    const absolute = path.resolve(rootDir, candidate);
    if (fs.existsSync(absolute) && fs.statSync(absolute).isFile()) paths.push(absolute);
  };

  add('CONTEXT.md');

  if (sourcePath) {
    let dir = path.dirname(path.resolve(sourcePath));
    const root = path.resolve(rootDir);
    while (dir.startsWith(root)) {
      add(path.relative(root, path.join(dir, 'CONTEXT.md')));
      const next = path.dirname(dir);
      if (next === dir) break;
      dir = next;
    }
  }

  const mapPath = path.join(rootDir, 'CONTEXT-MAP.md');
  if (fs.existsSync(mapPath)) {
    const mapText = fs.readFileSync(mapPath, 'utf8');
    for (const match of mapText.matchAll(/(?:^|[\s(`'"<])([A-Za-z0-9_./\\-]*CONTEXT\.md)\b/gm)) {
      add(match[1]);
    }
  }

  return unique(paths).sort();
}

function readContextGlossaries(rootDir, sourcePath) {
  const contextPaths = collectContextPaths(rootDir, sourcePath);
  const contexts = [];
  for (const contextPath of contextPaths) {
    const text = fs.readFileSync(contextPath, 'utf8');
    const terms = [...text.matchAll(/^\*\*([^*]+)\*\*:\s*\n([\s\S]*?)(?=\n\*\*|\n##|\n$)/gm)].map((match) => {
      const body = match[2].trim();
      const avoid = [...body.matchAll(/_Avoid_:\s*([^\n]+)/g)].flatMap((avoidMatch) =>
        avoidMatch[1]
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      );
      return {
        term: match[1].trim(),
        body,
        avoid,
        path: contextPath,
      };
    });
    contexts.push({ path: contextPath, text, terms });
  }
  return {
    contexts,
    terms: contexts.flatMap((context) => context.terms),
    paths: contextPaths,
    contextHash: sha256(contexts.map((context) => `${normalizePathForReport(context.path)}\n${context.text}`).join('\n---\n')),
  };
}

function requirementTextItems(confirmation) {
  return [
    ...asArray(confirmation.must).map((item) => ({ ...item, id: item.id, kind: 'must', text: item.text })),
    ...asArray(confirmation.notDone).map((item) => ({ ...item, id: item.id, kind: 'notDone', text: item.text })),
    ...asArray(confirmation.mustNot).map((item) => ({ ...item, id: item.id, kind: 'mustNot', text: item.text })),
    ...asArray(confirmation.failurePaths).map((item) => ({
      id: item.id,
      kind: 'failurePath',
      text: `${item.title ?? ''} ${item.trigger ?? ''} ${item.expectedBehavior ?? ''} ${item.forbiddenBehavior ?? ''}`,
    })),
    ...asArray(confirmation.edgeCases).map((item) => ({
      id: item.id,
      kind: 'edgeCase',
      text: `${item.condition ?? ''} ${item.expectedBehavior ?? ''} ${item.forbiddenBehavior ?? ''}`,
    })),
  ];
}

function tokenSet(text) {
  const tokens = String(text ?? '')
    .toLowerCase()
    .match(/[a-z0-9\u4e00-\u9fff]{2,}/gu);
  return new Set((tokens ?? []).filter((token) => !['must', 'not', 'the', 'and', 'for', 'with', 'this', 'that'].includes(token)));
}

function sharedTokens(left, right) {
  const a = tokenSet(left);
  const b = tokenSet(right);
  return [...a].filter((token) => b.has(token));
}

function hasAny(text, terms) {
  return terms.some((term) => new RegExp(escapeRegExp(term), 'iu').test(String(text ?? '')));
}

function joinedText(...values) {
  return values
    .flat(Infinity)
    .flatMap((value) => extractStringValues(value))
    .join('\n');
}

function extractStringValues(value) {
  if (value === null || value === undefined) return [];
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return [String(value)];
  if (Array.isArray(value)) return value.flatMap((item) => extractStringValues(item));
  if (typeof value === 'object') return Object.values(value).flatMap((item) => extractStringValues(item));
  return [];
}

function collectAmbiguousLanguageQuestions(items) {
  const questions = [];
  for (const item of items) {
    const sentence = String(item.text ?? '');
    const hits = VAGUE_TERMS.filter((term) =>
      new RegExp(`(^|\\b|[\\s，。；、])${escapeRegExp(term)}(\\b|[\\s，。；、]|$)`, 'iu').test(sentence)
    );
    if (hits.length) {
      questions.push({
        id: `DQ-${String(item.id).replace(/[^A-Z0-9-]/giu, '_')}`,
        severity: 'warning',
        category: 'ambiguous_language',
        refs: [item.id],
        question: `Clarify vague terms (${hits.join(', ')}) in ${item.id}.`,
        recommendedAnswer: 'Replace fuzzy adjectives with measurable behavior, threshold, owner, or explicit out-of-scope boundary.',
      });
    }
  }
  return questions;
}

function collectGlossaryConflictQuestions(items, glossary) {
  const questions = [];
  const definedTerms = new Set(glossary.terms.map((term) => normalizeGlossaryTerm(term.term)));
  for (const term of glossary.terms) {
    for (const avoided of term.avoid) {
      if (!avoided || avoided.length < 3) continue;
      if (definedTerms.has(normalizeGlossaryTerm(avoided))) continue;
      const pattern = new RegExp(`\\b${escapeRegExp(avoided)}\\b`, 'iu');
      const preferredPattern = new RegExp(`\\b${escapeRegExp(term.term)}\\b`, 'iu');
      const conflictingItems = items.filter((item) => {
        const text = String(item.text ?? '');
        return pattern.test(text) && !preferredPattern.test(text) && !usesAvoidedTermAsBoundary(text, avoided);
      });
      if (conflictingItems.length) {
        questions.push({
          id: `DQ-GLOSSARY-${slug(avoided)}`,
          severity: 'blocker',
          category: 'glossary_conflict',
          refs: unique([normalizePathForReport(term.path), ...conflictingItems.map((item) => item.id)]),
          question: `Source uses avoided domain term "${avoided}" while glossary prefers "${term.term}".`,
          recommendedAnswer: `Use "${term.term}" or explicitly document why this source needs a different meaning.`,
        });
      }
    }
  }
  return questions;
}

function normalizeGlossaryTerm(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[`_*'"]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function usesAvoidedTermAsBoundary(text, avoided) {
  const content = String(text ?? '');
  const boundaryPattern = new RegExp(
    `(do not|must not|forbid(?:den)?|outside|only|separate|not a|not as|legacy|migrat(?:e|ed|ion)|upcast|resolved|deprecated|forbidden|reject|deny|不得|不能|禁止|只(?:能|允许)|不得成为|不能作为|不属于|不是|旧|迁移|边界|拒绝|阻断)[^\\n。；;]{0,160}\\b${escapeRegExp(
      avoided
    )}\\b|\\b${escapeRegExp(
      avoided
    )}\\b[^\\n。；;]{0,160}(do not|must not|forbid(?:den)?|outside|only|separate|not a|not as|legacy|migrat(?:e|ed|ion)|upcast|resolved|deprecated|forbidden|reject|deny|不得|不能|禁止|只(?:能|允许)|不得成为|不能作为|不属于|不是|旧|迁移|边界|拒绝|阻断)`,
    'iu'
  );
  const domainExceptionPattern = new RegExp(
    `\\b${escapeRegExp(avoided)}\\b[^\\n。；;]{0,80}\\b(defect|incident|classification|classified|terminal|lifecycle|proof|evidence|scope|carrier)\\b|` +
      `\\b(defect|incident|classification|classified|terminal|lifecycle|proof|evidence|scope|carrier)\\b[^\\n。；;]{0,80}\\b${escapeRegExp(avoided)}\\b|` +
      `\\b${escapeRegExp(avoided)}\\b[^\\n。；;]{0,80}(缺陷|事件|分类|终态|生命周期|证明|证据|范围|载体)|` +
      `(缺陷|事件|分类|终态|生命周期|证明|证据|范围|载体)[^\\n。；;]{0,80}\\b${escapeRegExp(avoided)}\\b`,
    'iu'
  );
  return boundaryPattern.test(content) || domainExceptionPattern.test(content);
}

function collectLinkedSafetyText(confirmation, item) {
  const evidenceRefs = new Set(stringList(item.evidenceRefs));
  const failurePathIds = new Set(stringList(item.coveredByFailurePath));
  const artifactRefs = new Set();
  const traceIds = new Set(stringList(item.coveredByTraceRows));

  for (const traceRow of asArray(confirmation.traceRows)) {
    if (traceIds.has(traceRow.id) || stringList(traceRow.covers).includes(item.id)) {
      for (const ref of stringList(traceRow.evidenceRefs)) evidenceRefs.add(ref);
      for (const ref of stringList(traceRow.artifactRefs)) artifactRefs.add(ref);
    }
  }

  for (const evidence of asArray(confirmation.evidence)) {
    if (evidenceRefs.has(evidence.id)) {
      for (const ref of stringList(evidence.artifactRefs)) artifactRefs.add(ref);
    }
  }

  for (const failurePath of asArray(confirmation.failurePaths)) {
    if (
      failurePathIds.has(failurePath.id) ||
      stringList(failurePath.linkedNegIds).includes(item.id) ||
      stringList(failurePath.linkedEvidenceIds).some((ref) => evidenceRefs.has(ref))
    ) {
      failurePathIds.add(failurePath.id);
    }
  }

  return joinedText(
    asArray(confirmation.evidence).filter((evidence) => evidenceRefs.has(evidence.id)),
    asArray(confirmation.failurePaths).filter((failurePath) => failurePathIds.has(failurePath.id)),
    asArray(confirmation.edgeCases).filter((edgeCase) =>
      stringList(edgeCase.linkedFailurePathIds).some((ref) => failurePathIds.has(ref)) ||
      stringList(edgeCase.linkedEvidenceIds).some((ref) => evidenceRefs.has(ref))
    ),
    asArray(confirmation.artifactAutomationPlan).filter((artifact) =>
      artifactRefs.has(artifact.artifactId ?? artifact.id ?? artifact.path)
    )
  );
}

function sideEffectTopics(text) {
  const content = String(text ?? '');
  return {
    file: /file|artifact|path|persist|write|delete|文件|工件|路径|持久化|写入|删除/iu.test(content),
    external: /external|service|send|publish|call|http|api|外部|服务|发送|发布|调用/iu.test(content),
    state: /state|status|control|decision|record|状态|控制|决策|记录/iu.test(content),
  };
}

function hasSharedSideEffectTopic(itemText, safetyText) {
  const itemTopics = sideEffectTopics(itemText);
  const safetyTopics = sideEffectTopics(safetyText);
  return Object.keys(itemTopics).some((key) => itemTopics[key] && safetyTopics[key]);
}

function textSegments(text) {
  return String(text ?? '')
    .split(/[\n。；;]+/u)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function hasSideEffectSafetyCoverage(text, itemText = text) {
  const content = String(text ?? '');
  const ownContent = String(itemText ?? '');
  const strongSafetyPattern =
    /timeout|failure|fail[- ]closed|rollback|idempot|recovery|retry|\bassert(?:s|ed|ion)?\b|before\/after hash|beforeAfterHash|manual_resolution_required|missing_evidence|provenance|eventChainHead|atomic snapshot commit|current attempt|do not|does not|must not|forbidden|超时|失败|回滚|幂等|恢复|重试|断言|前后 hash|原子提交|当前尝试|不得|不能|禁止|只(?:能|允许)/iu;
  return textSegments(`${ownContent}\n${content}`).some(
    (segment) => strongSafetyPattern.test(segment) && hasSharedSideEffectTopic(itemText, segment)
  );
}

function hasControlFlowArtifactSafetyCoverage(text) {
  return /fail[- ]closed|block(?:ed|ing)?|reject(?:ed)?|deny|only|requires?|cannot|must not|forbidden|current attempt|current[-_ ]pass|before\/after hash|eventChainHead|atomic snapshot commit|idempot|receipt|failure handling|阻断|拒绝|只(?:能|允许)|不得|不能|禁止|当前尝试|原子提交|幂等|回执|失败处理/iu.test(
    String(text ?? '')
  );
}

function collectBusinessScenarioQuestions(confirmation, renderReport) {
  const boundary = renderReport?.requirementBoundary ?? confirmation?.requirementBoundary;
  if (boundary?.business?.requirementIds?.length && !boundary.business.diagramRefs?.length) {
    return [
      {
        id: 'DQ-BUSINESS-DIAGRAMS',
        severity: 'blocker',
        category: 'missing_business_scenario',
        refs: boundary.business.requirementIds,
        question: 'Business requirements exist but no business diagram/scenario is visible.',
        recommendedAnswer: 'Add at least one product-behavior sequence or flow view before rendering confirmation.',
      },
    ];
  }
  return [];
}

function collectAuthorityReferenceQuestions(confirmation) {
  const questions = [];
  const commandIds = new Set([
    ...asArray(confirmation.requiredCommands).map((item) => item.id),
    ...asArray(confirmation.suggestedCommands).map((item) => item.id),
  ]);
  const commandRefs = unique([
    ...asArray(confirmation.evidence).flatMap((item) => stringList(item.requiredCommandRefs)),
    ...asArray(confirmation.traceRows).flatMap((row) => [
      ...stringList(row.contractValidationCommandRefs),
      ...stringList(row.deliveryEvidenceCommandRefs),
      ...stringList(row.commandRefs),
    ]),
    ...stringList(confirmation.closeoutReadinessPreview?.requiredCommands),
  ]);
  for (const ref of commandRefs) {
    if (!commandIds.has(ref)) {
      questions.push({
        id: `DQ-COMMAND-${slug(ref)}`,
        severity: 'blocker',
        category: 'unresolved_authority_ref',
        refs: [ref],
        question: `Evidence or trace references command ${ref}, but requiredCommands/suggestedCommands do not define it.`,
        recommendedAnswer: 'Define the command with exact invocation and oracle, or remove the reference.',
      });
    }
  }
  return questions;
}

function collectContradictionQuestions(confirmation) {
  const questions = [];
  for (const must of asArray(confirmation.must)) {
    for (const out of asArray(confirmation.mustNot)) {
      const overlap = sharedTokens(must.text, out.text);
      if (overlap.length >= 1 && /do not|must not|forbid|outside|不得|禁止|不能/iu.test(String(out.text ?? ''))) {
        questions.push({
          id: `DQ-CONFLICT-${slug(`${must.id}-${out.id}`)}`,
          severity: 'blocker',
          category: 'contradiction_matrix',
          refs: [must.id, out.id],
          question: `${must.id} appears to require behavior that ${out.id} excludes; shared terms: ${overlap.join(', ')}.`,
          recommendedAnswer: 'Split the in-scope behavior from the out-of-scope boundary, or move one statement to openQuestions for user decision.',
        });
      }
    }
  }

  const negativeText = asArray(confirmation.notDone)
    .map((item) => `${item.id} ${item.text}`)
    .join('\n');
  for (const failure of asArray(confirmation.failurePaths)) {
    const expected = String(failure.expectedBehavior ?? '');
    const expectedAllowsCompletion = /mark done|complete|allow|proceed|放行|完成/u.test(expected);
    const expectedBlocksCompletion =
      /block(?:s|ed|ing)?|reject(?:s|ed|ing)?|fail[- ]closed|cannot|must not|阻断|拒绝|不得|不能|禁止/u.test(expected);
    if (expectedAllowsCompletion && !expectedBlocksCompletion && /must not|not treat|不得|不能|禁止/u.test(negativeText)) {
      questions.push({
        id: `DQ-CONFLICT-${slug(failure.id)}`,
        severity: 'blocker',
        category: 'contradiction_matrix',
        refs: [failure.id, ...stringList(failure.linkedNegIds)],
        question: `${failure.id} expectedBehavior appears to allow completion while a linked negative assertion forbids it.`,
        recommendedAnswer: 'Make the failure path fail closed, or move the exception into an explicit user decision.',
      });
    }
  }
  return questions;
}

function collectExternalSideEffectQuestions(confirmation) {
  const questions = [];
  const items = requirementTextItems(confirmation).filter((item) => ['must', 'notDone', 'mustNot'].includes(item.kind));
  for (const item of items) {
    const safetyText = collectLinkedSafetyText(confirmation, item);
    if (hasAny(item.text, SIDE_EFFECT_TERMS) && !hasSideEffectSafetyCoverage(safetyText, item.text)) {
      questions.push({
        id: `DQ-SIDE-EFFECT-${slug(item.id)}`,
        severity: 'blocker',
        category: 'external_side_effect_incomplete',
        refs: [item.id],
        question: `${item.id} describes an external side effect without timeout/failure/idempotency/recovery/assertion semantics.`,
        recommendedAnswer: 'Add failure behavior, timeout/retry, idempotency, rollback/recovery, and evidence assertions for the side effect.',
      });
    }
  }

  for (const artifact of asArray(confirmation.artifactAutomationPlan)) {
    if (artifact?.canAffectControlFlow === true) {
      const linkedEvidenceIds = new Set(stringList(artifact.linkedEvidenceIds));
      const artifactText = joinedText(
        artifact,
        asArray(confirmation.evidence).filter((evidence) => linkedEvidenceIds.has(evidence.id)),
        asArray(confirmation.failurePaths).filter((failurePath) =>
          stringList(failurePath.linkedEvidenceIds).some((ref) => linkedEvidenceIds.has(ref))
        )
      );
      if (!hasControlFlowArtifactSafetyCoverage(artifactText)) {
        questions.push({
          id: `DQ-SIDE-EFFECT-${slug(artifact.artifactId ?? artifact.id ?? artifact.path ?? 'artifact')}`,
          severity: 'blocker',
          category: 'external_side_effect_incomplete',
          refs: [artifact.artifactId ?? artifact.id ?? artifact.path ?? 'artifactAutomationPlan'],
          question: `Artifact ${artifact.artifactId ?? artifact.id ?? artifact.path ?? 'unknown'} can affect control flow but lacks failure/idempotency/recovery semantics.`,
          recommendedAnswer: 'Declare fail-closed behavior and evidence for any artifact that can affect control flow.',
        });
      }
    }
  }
  return questions;
}

function collectDefinitionDrilldownIssues({ confirmation, renderReport, rootDir, sourcePath }) {
  const blockers = [];
  const warnings = [];
  const glossary = readContextGlossaries(rootDir, sourcePath);
  const items = requirementTextItems(confirmation);
  const questions = [
    ...collectAmbiguousLanguageQuestions(items),
    ...collectGlossaryConflictQuestions(items, glossary),
    ...collectBusinessScenarioQuestions(confirmation, renderReport),
    ...collectAuthorityReferenceQuestions(confirmation),
    ...collectContradictionQuestions(confirmation),
    ...collectExternalSideEffectQuestions(confirmation),
  ].map(enrichQuestion);

  for (const question of questions) {
    const finding = findingFromQuestion(question);
    if (question.severity === 'blocker') blockers.push(finding);
    else warnings.push(finding);
  }

  const findings = [...blockers, ...warnings];
  const clusters = buildClusters(findings, questions);
  const blockingClusters = clusters.filter((cluster) => cluster.severity !== 'warning');

  return {
    verdict: blockers.length ? 'blocked' : 'pass',
    maxIterations: 3,
    iterationPolicy:
      'deterministic_fingerprint_until_fixed_point_then_decision_packet; do_not_increase_rounds_for_repeated_findings',
    stopReason: blockers.length ? 'blocking_definition_questions_found' : 'no_blocking_definition_questions',
    questions,
    blockers,
    warnings,
    clusters,
    blockingClusters,
    clusterCount: clusters.length,
    blockingClusterCount: blockingClusters.length,
    authoritySources: unique([
      'implementationConfirmation',
      renderReport ? 'confirmation-render-report.json' : '',
      ...glossary.paths.map((item) => normalizePathForReport(item)),
    ]),
    contextRefs: glossary.paths.map((item) => normalizePathForReport(item)),
    contextHash: glossary.contextHash,
  };
}

function collectFingerprints(value, out = new Set()) {
  if (!value || typeof value !== 'object') return out;
  if (typeof value.fingerprint === 'string' && value.fingerprint) out.add(value.fingerprint);
  if (Array.isArray(value)) {
    for (const item of value) collectFingerprints(item, out);
    return out;
  }
  for (const item of Object.values(value)) collectFingerprints(item, out);
  return out;
}

function resolutionEntries(resolutions) {
  if (!resolutions) return [];
  if (Array.isArray(resolutions)) return resolutions;
  if (Array.isArray(resolutions.resolutions)) return resolutions.resolutions;
  if (Array.isArray(resolutions.findings)) return resolutions.findings;
  if (Array.isArray(resolutions.entries)) return resolutions.entries;
  return [];
}

function resolutionAppliesToCurrent(entry, hashes, contextHash) {
  if (!entry || typeof entry !== 'object') return false;
  if (!entry.sourceDocumentHash || entry.sourceDocumentHash !== hashes.sourceDocumentHash) return false;
  if (!entry.implementationConfirmationHash || entry.implementationConfirmationHash !== hashes.implementationConfirmationHash) {
    return false;
  }
  if (!entry.contextHash || entry.contextHash !== contextHash) return false;
  return true;
}

function buildResolutionMap(resolutions, hashes, contextHash) {
  const byFingerprint = new Map();
  for (const entry of resolutionEntries(resolutions)) {
    const fingerprint = entry?.fingerprint;
    const status = String(entry?.status ?? '').toLowerCase();
    if (!fingerprint || !SUPPRESSING_RESOLUTION_STATUSES.has(status)) continue;
    if (!resolutionAppliesToCurrent(entry, hashes, contextHash)) continue;
    byFingerprint.set(fingerprint, {
      status,
      reason: entry.reason ?? entry.summary ?? entry.message ?? '',
      owner: entry.owner ?? entry.resolvedBy ?? entry.waivedBy ?? null,
    });
  }
  return byFingerprint;
}

function splitFindingsForReport({ findings, previousReport, resolutions, hashes, contextHash, changedOnly, maxNewBlockers }) {
  const previousFingerprints = collectFingerprints(previousReport);
  const resolutionMap = buildResolutionMap(resolutions, hashes, contextHash);
  const active = [];
  const suppressed = [];

  for (const finding of findings) {
    const resolution = resolutionMap.get(finding.fingerprint);
    if (resolution) {
      suppressed.push({
        ...finding,
        status: resolution.status,
        suppressedBy: 'resolution_ledger',
        resolutionReason: resolution.reason,
        resolutionOwner: resolution.owner,
      });
      continue;
    }
    if (changedOnly && previousFingerprints.has(finding.fingerprint)) {
      suppressed.push({
        ...finding,
        status: 'unchanged_previous',
        suppressedBy: 'previous_report',
      });
      continue;
    }
    active.push(finding);
  }

  const activeBlockers = active.filter((item) => item.severity !== 'warning');
  const activeWarnings = active.filter((item) => item.severity === 'warning');
  const limit =
    Number.isInteger(maxNewBlockers) && maxNewBlockers >= 0 ? Math.min(maxNewBlockers, activeBlockers.length) : null;
  const emittedBlockers = limit === null ? activeBlockers : activeBlockers.slice(0, limit);
  const emittedFindings = [...emittedBlockers, ...activeWarnings];
  const suppressedResolvedCount = suppressed.filter((item) => item.suppressedBy === 'resolution_ledger').length;
  const suppressedPreviousCount = suppressed.filter((item) => item.suppressedBy === 'previous_report').length;

  return {
    active,
    activeBlockers,
    activeWarnings,
    emittedFindings,
    suppressed,
    suppressedResolvedCount,
    suppressedPreviousCount,
    truncatedBlockingCount: limit === null ? 0 : activeBlockers.length - emittedBlockers.length,
  };
}

function stopReasonForReport({ activeBlockers, activeWarnings, changedOnly }) {
  if (activeBlockers.length) return 'blocking_definition_questions_found';
  if (changedOnly) return 'no_new_blockers';
  if (activeWarnings.length) return 'warning_only';
  return 'no_blocking_definition_questions';
}

function normalizeFindingForReport(item) {
  return {
    ...item,
    status: item.status ?? 'open',
    summary: item.summary ?? item.message,
    requirementIds: item.requirementIds ?? item.refs,
  };
}

function buildDefinitionOnlyReport({
  target,
  confirmation,
  hashes,
  definitionDrilldown,
  previousReport = null,
  resolutions = null,
  changedOnly = false,
  maxNewBlockers = null,
}) {
  const findings = [...definitionDrilldown.blockers, ...definitionDrilldown.warnings].map(normalizeFindingForReport);
  const split = splitFindingsForReport({
    findings,
    previousReport,
    resolutions,
    hashes,
    contextHash: definitionDrilldown.contextHash,
    changedOnly,
    maxNewBlockers,
  });
  const blockerFindings = split.activeBlockers;
  const warningFindings = split.activeWarnings;
  const emittedFindings = split.emittedFindings.map(normalizeFindingForReport);
  const remainingBlockingClusters = buildClusters(blockerFindings, definitionDrilldown.questions);
  const allClusters = buildClusters(split.active, definitionDrilldown.questions);
  const stopReason = stopReasonForReport({
    activeBlockers: blockerFindings,
    activeWarnings: warningFindings,
    changedOnly,
  });
  const status = blockerFindings.length === 0 ? 'pass' : 'blocked';
  return {
    schemaVersion: 'pre-render-definition-drilldown/v1',
    verdict: blockerFindings.length === 0 ? 'PASS' : 'FAIL',
    status,
    target: normalizePathForReport(target),
    mode: 'definition-only',
    sourceDocumentHash: hashes.sourceDocumentHash,
    implementationConfirmationHash: hashes.implementationConfirmationHash,
    contextHash: definitionDrilldown.contextHash,
    contextRefs: definitionDrilldown.contextRefs,
    requirementIdsReviewed: unique([
      ...asArray(confirmation.must).map((item) => item.id),
      ...asArray(confirmation.notDone).map((item) => item.id),
      ...asArray(confirmation.mustNot).map((item) => item.id),
      ...asArray(confirmation.failurePaths).map((item) => item.id),
      ...asArray(confirmation.edgeCases).map((item) => item.id),
    ]),
    convergence: {
      changedOnly: Boolean(changedOnly),
      maxNewBlockers,
      totalFindingCount: findings.length,
      totalBlockingCount: findings.filter((item) => item.severity !== 'warning').length,
      totalWarningCount: findings.filter((item) => item.severity === 'warning').length,
      newFindingCount: split.active.length,
      newBlockingCount: blockerFindings.length,
      newWarningCount: warningFindings.length,
      emittedFindingCount: emittedFindings.length,
      emittedBlockingCount: emittedFindings.filter((item) => item.severity !== 'warning').length,
      suppressedResolvedCount: split.suppressedResolvedCount,
      suppressedPreviousCount: split.suppressedPreviousCount,
      truncatedBlockingCount: split.truncatedBlockingCount,
      clusterCount: allClusters.length,
      blockingClusterCount: remainingBlockingClusters.length,
      stopReason,
    },
    definitionDrilldown: {
      ...definitionDrilldown,
      stopReason,
      activeQuestions: definitionDrilldown.questions.filter((question) =>
        split.active.some((finding) => finding.fingerprint === question.fingerprint)
      ),
      suppressedQuestions: definitionDrilldown.questions
        .filter((question) => split.suppressed.some((finding) => finding.fingerprint === question.fingerprint))
        .map((question) => {
          const suppressedFinding = split.suppressed.find((finding) => finding.fingerprint === question.fingerprint);
          return {
            ...question,
            status: suppressedFinding?.status,
            suppressedBy: suppressedFinding?.suppressedBy,
          };
        }),
      clusters: allClusters,
      remainingBlockingClusters,
    },
    failedChecks: blockerFindings.map((item) => item.code),
    warningChecks: warningFindings.map((item) => item.code),
    suppressedFindings: split.suppressed.map(normalizeFindingForReport),
    findings: emittedFindings,
  };
}

function buildDecisionPacket(report) {
  const remainingBlockingClusters = report?.definitionDrilldown?.remainingBlockingClusters ?? [];
  return {
    schemaVersion: 'pre-render-definition-drilldown-decision-packet/v1',
    target: report.target,
    sourceDocumentHash: report.sourceDocumentHash,
    implementationConfirmationHash: report.implementationConfirmationHash,
    contextHash: report.contextHash,
    stopReason:
      remainingBlockingClusters.length > 0
        ? 'requires_user_decision'
        : report?.convergence?.stopReason ?? 'no_blocking_definition_questions',
    remainingBlockingClusters,
    recommendedActions: unique(
      remainingBlockingClusters.flatMap((cluster) => cluster.recommendedActions ?? actionForCategory(cluster.category))
    ),
    instructions:
      remainingBlockingClusters.length > 0
        ? 'Resolve, waive, convert to an open question, convert to an OUT boundary, or split the clustered requirements before render.'
        : 'No remaining blocking definition clusters require a decision.',
  };
}

function buildDefinitionReportFromSource({
  sourcePath,
  rootDir,
  previousReport = null,
  resolutions = null,
  changedOnly = false,
  maxNewBlockers = null,
}) {
  const target = path.resolve(sourcePath);
  const text = fs.readFileSync(target, 'utf8');
  const extracted = extractImplementationConfirmation(text);
  const hashes = {
    sourceDocumentHash: sourceDocumentHashFor(text, extracted.blockText, extracted.confirmation),
    implementationConfirmationHash: implementationConfirmationHashFor(extracted.confirmation),
  };
  const definitionDrilldown = collectDefinitionDrilldownIssues({
    confirmation: extracted.confirmation,
    renderReport: null,
    rootDir,
    sourcePath: target,
  });
  return buildDefinitionOnlyReport({
    target,
    confirmation: extracted.confirmation,
    hashes,
    definitionDrilldown,
    previousReport,
    resolutions,
    changedOnly,
    maxNewBlockers,
  });
}

module.exports = {
  asArray,
  buildDecisionPacket,
  buildDefinitionOnlyReport,
  buildDefinitionReportFromSource,
  collectDefinitionDrilldownIssues,
  extractImplementationConfirmation,
  implementationConfirmationHashFor,
  normalizePathForReport,
  sourceDocumentHashFor,
  stableStringify,
  stringList,
  unique,
};
