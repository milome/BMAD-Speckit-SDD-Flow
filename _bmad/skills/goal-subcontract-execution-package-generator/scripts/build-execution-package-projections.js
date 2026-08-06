'use strict';

const { failure } = require('./build-execution-package-shared');

const COMMIT_VERIFICATION_FIELDS = [
  'hash',
  'parentHash',
  'treeHash',
  'subject',
  'changedPaths',
  'diff',
  'reachability',
  'trailers',
];
const REQUIRED_COMMIT_TRAILERS = [
  'Functional-Outcome',
  'Affected-Scope',
  'Child-Contract',
  'Contract-Hash',
  'Evidence',
  'Validation',
];
const ENGLISH_LIFECYCLE_PREFIX =
  /^(?:close(?:d|s|ing)?|complete(?:d|s|ing)?|execute(?:d|s|ing)?|process(?:ed|es|ing)?|implement(?:ed|s|ing)?|implementation)\b/iu;
const CHINESE_LIFECYCLE_PREFIX = /^(?:闭合|完成|执行|处理|实现)/u;
const GENERIC_ENGLISH_DOMAIN_LABEL =
  /^(?:authentication|authorization|payments?|reporting|settings?|configuration|infrastructure|frontend|backend|api|security|user management|data processing)(?:\s+(?:capability|feature|module|improvements?|changes?|updates?|work|implementation|api))?$/iu;
const GENERIC_CHINESE_DOMAIN_LABEL =
  /^(?:认证|授权|支付|报表|设置|配置|基础设施|前端|后端|接口|安全|用户管理|数据处理)(?:功能|能力|模块|改造|实现)?$/u;

function isIdentifierCharacter(value) {
  return Boolean(value && /[\p{L}\p{N}_]/u.test(value));
}

function containsDeclaredPartitionId(text, partitionIds) {
  const normalized = text.toLowerCase();
  return partitionIds.some((value) => {
    const partitionId = String(value || '')
      .trim()
      .toLowerCase();
    if (!partitionId) return false;
    let index = normalized.indexOf(partitionId);
    while (index !== -1) {
      const left = normalized[index - 1];
      const right = normalized[index + partitionId.length];
      if (!isIdentifierCharacter(left) && !isIdentifierCharacter(right)) return true;
      index = normalized.indexOf(partitionId, index + 1);
    }
    return false;
  });
}

function isNonFunctionalText(value, child = {}) {
  const text = String(value || '').trim();
  const displayTitle = String(child.displayTitle || '')
    .trim()
    .toLowerCase();
  const partitionIds = Array.isArray(child.partitionIds)
    ? child.partitionIds
    : [child.partitionId];
  return (
    !text ||
    CHINESE_LIFECYCLE_PREFIX.test(text) ||
    ENGLISH_LIFECYCLE_PREFIX.test(text) ||
    GENERIC_ENGLISH_DOMAIN_LABEL.test(text) ||
    GENERIC_CHINESE_DOMAIN_LABEL.test(text) ||
    /\b(?:implementation|subcontract|child\s+contract|goal\s+contract)\b/iu.test(text) ||
    containsDeclaredPartitionId(text, partitionIds) ||
    (displayTitle !== '' && text.toLowerCase() === displayTitle)
  );
}

function normalizeDisplayTitle(partition, partitionIds = [partition?.partitionId]) {
  const partitionId = String(partition?.partitionId || '').trim();
  const displayTitle = String(partition?.displayTitle || '').trim();
  if (isNonFunctionalText(displayTitle, { partitionIds })) {
    failure('child_display_title_not_human_readable', {
      partitionId,
      displayTitle,
    });
  }
  return displayTitle;
}

function formatChildIdentity(child) {
  return `${child.displayTitle} (${child.partitionId})`;
}

function projectChildIdentities(children) {
  return children.map(({ partitionId, displayTitle }) => ({
    partitionId,
    displayTitle,
  }));
}

function createChildIdentityMap(children) {
  const childByPartitionId = new Map(children.map((child) => [child.partitionId, child]));
  if (childByPartitionId.size !== children.length) failure('partition_manifest_not_final');
  for (const child of children) {
    if (
      !Array.isArray(child.predecessorPartitionIds) ||
      child.predecessorPartitionIds.some((partitionId) => !childByPartitionId.has(partitionId))
    ) {
      failure('partition_manifest_not_final', { partitionId: child.partitionId });
    }
  }
  return childByPartitionId;
}

function createCommitPolicy() {
  return {
    commitCount: 1,
    subjectPattern: '<type>(<functional-scope>): <specific functional capability>',
    requiredTrailers: REQUIRED_COMMIT_TRAILERS,
    forbiddenLifecycleSubjects: [
      '闭合令牌刷新子合同',
      '完成 AUTH-03',
      '执行认证改造',
      'complete AUTH-03 implementation',
    ],
  };
}

function createExecutionPolicy() {
  return {
    predecessorClosureRequired: true,
    stageOwnedPathsOnly: true,
    closureStatus: 'closed',
    commitVerificationFields: COMMIT_VERIFICATION_FIELDS,
  };
}

function createChildPacket({
  packageId,
  child,
  evidenceSchema,
  closureSchema,
  commitPolicy,
  executionPolicy,
}) {
  return {
    schemaVersion: 'goal-subcontract-child-prompt-packet/v2',
    packageId,
    ...child,
    evidenceSchema,
    closureSchema,
    executionPolicy,
    commitPolicy,
  };
}

function renderChildPrompt(
  child,
  childByPartitionId,
  evidenceSchema,
  closureSchema,
  executionPolicy
) {
  return [
    `# Execute ${formatChildIdentity(child)}`,
    '',
    `Contract: ${child.contract.path}#${child.contract.hash}`,
    `Predecessors: ${
      child.predecessorPartitionIds
        .map((partitionId) => formatChildIdentity(childByPartitionId.get(partitionId)))
        .join(', ') || 'none'
    }`,
    `Owned paths: ${child.ownedArtifactPaths.join(', ')}`,
    `Required commands: ${child.requiredCommandIds.join(', ')}`,
    `Evidence schema: ${evidenceSchema.path}#${evidenceSchema.hash}`,
    `Closure schema: ${closureSchema.path}#${closureSchema.hash}`,
    `Required closure status: ${executionPolicy.closureStatus}`,
    `Commit verification: ${executionPolicy.commitVerificationFields.join(', ')}`,
    '',
    'Start only after every predecessor has a schema-valid closed closure artifact.',
    'Validate evidence and closure JSON against the bound schemas before claiming closure.',
    'Stage only changed paths declared in Owned paths and create exactly one atomic local commit.',
    'Inspect the actual commit diff and verify it is non-empty and limited to Owned paths.',
    'Verify the actual commit hash, parent, tree, changed paths, diff, reachability, subject, and unique terminal trailers.',
    'The commit subject must describe the specific functional capability; lifecycle-only summaries fail.',
    'Use the partition ID only in trace fields; pair every human-facing reference with the display title or verified functional outcome.',
    '',
  ].join('\n');
}

function renderCampaignPrompt(children, collectionVerificationCommands) {
  return [
    '# Goal Child Campaign',
    '',
    `Execute in order: ${children.map(formatChildIdentity).join(' -> ')}.`,
    '',
    'Collection verification commands:',
    ...collectionVerificationCommands.map(({ id, command }) => `- ${id}: ${command}`),
    '',
    'Record schema-valid evidence for every collection command.',
    'Do not report done until every child and collection audit passes.',
    '',
  ].join('\n');
}

function createTaskReportTemplate({ packageId, children, requirementRecordBinding }) {
  return {
    schemaVersion: 'goal-subcontract-campaign-task-report-template/v2',
    status: 'pending_audit',
    packageId,
    childIdentities: projectChildIdentities(children),
    requirementRecordBinding,
  };
}

function createHandoffTemplate({
  packageId,
  goalContractHash,
  partitionManifestHash,
  children,
  requirementRecordBinding,
}) {
  return {
    schemaVersion: 'goal-subcontract-main-agent-handoff-template/v2',
    status: 'pending_audit',
    packageId,
    goalContractHash,
    partitionManifestHash,
    childIdentities: projectChildIdentities(children),
    requirementRecordBinding,
  };
}

module.exports = {
  containsDeclaredPartitionId,
  createChildIdentityMap,
  createChildPacket,
  createCommitPolicy,
  createExecutionPolicy,
  createHandoffTemplate,
  createTaskReportTemplate,
  formatChildIdentity,
  isNonFunctionalText,
  normalizeDisplayTitle,
  projectChildIdentities,
  renderCampaignPrompt,
  renderChildPrompt,
};
