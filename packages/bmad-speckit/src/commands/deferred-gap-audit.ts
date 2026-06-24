const fs = require('node:fs');
const path = require('node:path');
const {
  loadDeferredGapGovernance,
} = require('../utils/deferred-gap-governance-loader');
const {
  buildDeferredGapAudit,
  renderDeferredGapMarkdownTable,
} = loadDeferredGapGovernance();

function renderMarkdown(audit) {
  return [
    '# Deferred Gap Audit',
    '',
    `- Generated At: ${audit.generated_at}`,
    `- Readiness Reports: ${audit.readiness_report_count}`,
    `- Deferred Gap Count: ${audit.deferred_gap_count}`,
    `- Deferred Gaps Explicit: ${audit.deferred_gaps_explicit ? 'yes' : 'no'}`,
    `- Alert Count: ${audit.alert_count}`,
    '',
    renderDeferredGapMarkdownTable(audit).trimEnd(),
    '',
  ].join('\n');
}

function deferredGapAuditCommand(opts = {}) {
  const audit = buildDeferredGapAudit(process.cwd());
  const printJson = Boolean(opts.json);
  const failOnAlert = Boolean(opts.failOnAlert);
  const outputPath = opts.output ? path.resolve(process.cwd(), opts.output) : null;
  const body = printJson ? JSON.stringify(audit, null, 2) : renderMarkdown(audit);

  if (outputPath) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${body.trimEnd()}\n`, 'utf8');
  }

  console.log(body.trimEnd());
  if (failOnAlert && audit.alert_count > 0) {
    process.exitCode = 1;
  }
}

module.exports = { deferredGapAuditCommand };
