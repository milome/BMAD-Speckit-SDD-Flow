#!/usr/bin/env node
// @ts-check
'use strict';

/**
 * @callback GovernanceSummaryLog
 * @param {string} line
 * @returns {void}
 */

/**
 * @param {unknown} runnerSummaryLines
 * @returns {string[]}
 */
function normalizeGovernanceRunnerSummaryLines(runnerSummaryLines) {
  if (!Array.isArray(runnerSummaryLines)) {
    return [];
  }

  return runnerSummaryLines.filter((line) => typeof line === 'string');
}

/**
 * @param {unknown} runnerSummaryLines
 * @returns {string}
 */
function renderGovernanceRunnerSummaryLines(runnerSummaryLines) {
  return normalizeGovernanceRunnerSummaryLines(runnerSummaryLines).join('\n');
}

/**
 * @param {unknown} runnerSummaryLines
 * @returns {string[]}
 */
function buildGovernanceLatestRawEventSectionLines(runnerSummaryLines) {
  const normalized = normalizeGovernanceRunnerSummaryLines(runnerSummaryLines);
  return [
    '## Governance Latest Raw Event',
    '',
    ...(normalized.length > 0 ? normalized : ['暂无 governance raw event 摘要']),
    '',
  ];
}

/**
 * @param {string | null | undefined} artifactMarkdown
 * @param {unknown} runnerSummaryLines
 * @returns {string | null | undefined}
 */
function appendRunnerSummaryToArtifactMarkdown(artifactMarkdown, runnerSummaryLines) {
  const normalized = normalizeGovernanceRunnerSummaryLines(runnerSummaryLines);
  if (normalized.length === 0) {
    return artifactMarkdown;
  }

  return `${String(artifactMarkdown || '').replace(/\s*$/, '')}\n\n${renderGovernanceRunnerSummaryLines(
    normalized
  )}\n`;
}

/**
 * @param {unknown} runnerSummaryLines
 * @param {GovernanceSummaryLog | null | undefined} log
 * @returns {void}
 */
function printGovernanceRunnerSummaryLines(runnerSummaryLines, log) {
  const normalized = normalizeGovernanceRunnerSummaryLines(runnerSummaryLines);
  const sink = typeof log === 'function' ? log : console.log;
  for (const line of normalized) {
    sink(line);
  }
}

module.exports = {
  appendRunnerSummaryToArtifactMarkdown,
  buildGovernanceLatestRawEventSectionLines,
  normalizeGovernanceRunnerSummaryLines,
  printGovernanceRunnerSummaryLines,
  renderGovernanceRunnerSummaryLines,
};
