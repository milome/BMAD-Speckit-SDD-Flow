const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function resolveOutputPath(context) {
  const raw = context.args.reportPath || context.args.output || '';
  if (!raw) {
    return path.join(context.cwd, '_bmad-output', 'runtime', 'gates', 'main-agent-quality-gate-report.json');
  }
  return path.isAbsolute(raw) ? raw : path.resolve(context.cwd, raw);
}

function maybeWriteReport(context, report) {
  const reportPath = resolveOutputPath(context);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return reportPath;
}

function normalizeText(value) {
  return String(value || '').trim();
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function buildEvidenceProvenance(context) {
  const runId = normalizeText(context.args.runId) || `quality-gate-${Date.now()}`;
  const storyKey = normalizeText(context.args.storyKey) || 'S-release-gate';
  const evidenceBundleId = normalizeText(context.args.evidenceBundleId) || `${runId}:bundle`;
  const contractPath = path.join(context.cwd, '_bmad', '_config', 'orchestration-governance.contract.yaml');
  const provenance = {
    runId,
    storyKey,
    evidenceBundleId,
  };
  if (fs.existsSync(contractPath)) {
    provenance.contractHash = sha256(fs.readFileSync(contractPath));
  }
  return provenance;
}

function qualityGateAction(context) {
  const checks = [
    {
      id: 'package-runtime-dispatch',
      passed: true,
      summary: 'quality gate command resolved through package runtime',
    },
  ];
  if (context.args.codexProofPath) {
    const proofPath = path.isAbsolute(context.args.codexProofPath)
      ? context.args.codexProofPath
      : path.resolve(context.cwd, context.args.codexProofPath);
    checks.push({
      id: 'codex-run-scoped-proof',
      passed: fs.existsSync(proofPath),
      summary: fs.existsSync(proofPath)
        ? `proof=${path.relative(context.cwd, proofPath).replace(/\\/g, '/')}`
        : `missing Codex run-scoped proof: ${proofPath}`,
    });
  }
  const criticalFailures = checks.filter((check) => !check.passed).length;
  const evidence_provenance = buildEvidenceProvenance(context);
  const report = {
    reportType: 'main_agent_quality_gate_package_runtime',
    generatedAt: new Date().toISOString(),
    gate: 'main-agent-quality-gate',
    evidence_provenance,
    critical_failures: criticalFailures,
    criticalFailures,
    mode: 'package_runtime_module',
    checks,
  };
  report.evidence_provenance = {
    ...report.evidence_provenance,
    gateReportHash: sha256(
      JSON.stringify({
        reportType: report.reportType,
        critical_failures: report.critical_failures,
        checks: report.checks,
        mode: report.mode,
      })
    ),
  };
  const reportPath = maybeWriteReport(context, report);
  return {
    report,
    reportPath,
  };
}

module.exports = {
  qualityGateAction,
};
