function heading(level, title) {
  if (!Number.isInteger(level) || level < 1 || level > 6) {
    throw new Error(`invalid markdown heading level: ${level}`);
  }
  return `${'#'.repeat(level)} ${title}`;
}

function defineHeadingSchema(entries) {
  const schema = {};
  for (const [id, level, title] of entries) {
    schema[id] = Object.freeze({ id, level, title });
  }
  return Object.freeze(schema);
}

function h1(title) {
  return heading(1, title);
}

function h2(title) {
  return heading(2, title);
}

function h3(title) {
  return heading(3, title);
}

function section(level, title, body = []) {
  return [heading(level, title), '', ...body];
}

const HEADING_SCHEMAS = Object.freeze({
  bmadHelp: defineHeadingSchema([
    ['pageTitle', 1, 'bmad-help'],
    ['statusSummary', 2, 'Status Summary'],
    ['evidenceCurrentPosition', 3, 'Evidence / Current Position'],
    ['gateBlockingState', 3, 'Gate Notes / Blocking State'],
    ['runtimeCrossEntry', 2, 'Runtime Cross-Entry'],
    ['recommendedNextSteps', 2, 'Recommended Next Steps'],
    ['catalogReference', 2, 'Catalog Reference'],
    ['upstreamWorkflowGuidance', 2, 'Upstream Workflow Guidance'],
    ['routingRules', 3, 'Routing Rules'],
    ['displayRules', 3, 'Display Rules'],
    ['officialExecutionPaths', 3, 'Official Execution Paths'],
    ['additionalGuidance', 3, 'Additional Guidance'],
    ['seeAlsoBmads', 2, 'See also: bmads'],
    ['debug', 2, 'Debug'],
  ]),
  bmads: defineHeadingSchema([
    ['pageTitle', 1, 'BMADS Runtime Console'],
    ['statusSummary', 2, 'Status Summary'],
    ['evidenceCurrentPosition', 3, 'Evidence / Current Position'],
    ['gateBlockingState', 3, 'Gate Notes / Blocking State'],
    ['decisionCard', 2, 'Decision Card'],
    ['recommendedNextSteps', 2, 'Recommended Next Steps'],
    ['availableNextActions', 2, 'Available Next Actions'],
    ['recommendedNow', 3, 'Recommended Now'],
    ['coreSkills', 3, 'Core Skills'],
    ['navigation', 3, 'Navigation'],
    ['currentActionableRequirementRecords', 2, 'Current Actionable Requirement Records'],
    ['sixMentalModelPanorama', 2, 'Six Mental Model Panorama'],
    ['runtimeWorkflowGuidance', 2, 'Runtime Workflow Guidance'],
    ['runtimeAuthority', 3, 'Runtime Authority'],
    ['safetyPriority', 3, 'Safety Priority'],
    ['officialExecutionPaths', 3, 'Official Execution Paths'],
    ['reconfirmationRoutes', 3, 'Reconfirmation Routes'],
    ['seeAlsoBmadHelp', 2, 'See also: bmad-help'],
    ['projectState', 2, 'Project State'],
    ['upstreamBmadArtifacts', 2, 'Upstream BMAD Artifacts'],
    ['completedLayerArtifacts', 2, 'Completed Layer Artifacts'],
    ['implementationReadiness', 2, 'Implementation Readiness'],
    ['currentRoute', 2, 'Current Route'],
    ['mainAgent', 2, 'Main Agent'],
    ['quickStart', 2, 'Quick Start'],
    ['contractStatus', 2, 'Contract Status'],
    ['stageEvidence', 2, 'Stage Evidence'],
    ['commandHints', 2, 'Command Hints'],
    ['bmadMethodAdvisory', 2, 'BMAD Method Advisory'],
  ]),
  bmadsZhCn: defineHeadingSchema([
    ['pageTitle', 1, 'BMADS Runtime Console'],
    ['statusSummary', 2, '状态摘要'],
    ['evidenceCurrentPosition', 3, '证据 / 当前位置'],
    ['gateBlockingState', 3, '门禁说明 / 阻塞状态'],
    ['decisionCard', 2, '决策卡'],
    ['recommendedNextSteps', 2, '推荐下一步'],
    ['availableNextActions', 2, '可用下一步'],
    ['recommendedNow', 3, '当前推荐'],
    ['coreSkills', 3, '核心技能'],
    ['navigation', 3, '导航'],
    ['currentActionableRequirementRecords', 2, '可继续推进的需求记录'],
    ['sixMentalModelPanorama', 2, '六心智模型全景'],
    ['runtimeWorkflowGuidance', 2, '运行时工作流指引'],
    ['runtimeAuthority', 3, '运行时权威'],
    ['safetyPriority', 3, '安全优先级'],
    ['officialExecutionPaths', 3, '官方执行路径'],
    ['reconfirmationRoutes', 3, 'Reconfirmation 路由'],
    ['seeAlsoBmadHelp', 2, '另见：bmad-help'],
    ['projectState', 2, 'Project State'],
    ['upstreamBmadArtifacts', 2, 'Upstream BMAD Artifacts'],
    ['completedLayerArtifacts', 2, 'Completed Layer Artifacts'],
    ['implementationReadiness', 2, 'Implementation Readiness'],
    ['currentRoute', 2, 'Current Route'],
    ['mainAgent', 2, 'Main Agent'],
    ['quickStart', 2, 'Quick Start'],
    ['contractStatus', 2, 'Contract Status'],
    ['stageEvidence', 2, 'Stage Evidence'],
    ['commandHints', 2, 'Command Hints'],
    ['bmadMethodAdvisory', 2, 'BMAD Method Advisory'],
  ]),
});

const BMADS_CORE_HEADING_KEYS = Object.freeze([
  'pageTitle',
  'statusSummary',
  'evidenceCurrentPosition',
  'gateBlockingState',
  'recommendedNextSteps',
  'availableNextActions',
  'recommendedNow',
  'coreSkills',
  'navigation',
  'currentActionableRequirementRecords',
  'sixMentalModelPanorama',
  'runtimeWorkflowGuidance',
  'runtimeAuthority',
  'safetyPriority',
  'officialExecutionPaths',
  'reconfirmationRoutes',
  'seeAlsoBmadHelp',
]);

function schemaHeading(schema, id) {
  const item = schema?.[id];
  if (!item) throw new Error(`unknown markdown heading schema id: ${id}`);
  return heading(item.level, item.title);
}

function schemaTitle(schema, id) {
  const item = schema?.[id];
  if (!item) throw new Error(`unknown markdown heading schema id: ${id}`);
  return item.title;
}

function schemaHeadingSequence(schema, ids) {
  return ids.map((id) => schemaHeading(schema, id));
}

module.exports = {
  BMADS_CORE_HEADING_KEYS,
  HEADING_SCHEMAS,
  h1,
  h2,
  h3,
  schemaHeading,
  schemaHeadingSequence,
  schemaTitle,
  section,
};
