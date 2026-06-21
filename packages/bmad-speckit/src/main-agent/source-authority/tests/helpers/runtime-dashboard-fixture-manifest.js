"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REAL_TOOL_TRACE_FIXTURE_MANIFEST = exports.REAL_TOOL_TRACE_VARIANTS = exports.RUNTIME_DASHBOARD_HOOK_FIXTURE_ROOT = exports.RUNTIME_DASHBOARD_REPORT_FIXTURE_ROOT = void 0;
exports.getRealToolTraceVariantConfig = getRealToolTraceVariantConfig;
exports.getReportFixturePathForStage = getReportFixturePathForStage;
const path = require("node:path");
exports.RUNTIME_DASHBOARD_REPORT_FIXTURE_ROOT = path.join(process.cwd(), 'packages', 'scoring', 'parsers', '__tests__', 'fixtures');
exports.RUNTIME_DASHBOARD_HOOK_FIXTURE_ROOT = path.join(process.cwd(), 'tests', 'fixtures', 'runtime-hooks');
exports.REAL_TOOL_TRACE_VARIANTS = ['clean', 'redacted', 'blocked'];
exports.REAL_TOOL_TRACE_FIXTURE_MANIFEST = {
    clean: {
        fixtureFile: 'cursor-post-tool-use-real.stdin.json',
        stage: 'implement',
        reportFixture: 'sample-implement-report-high-score.md',
    },
    redacted: {
        fixtureFile: 'cursor-post-tool-use-real-redacted.stdin.json',
        stage: 'tasks',
        reportFixture: 'sample-tasks-report-逐条对照.md',
    },
    blocked: {
        fixtureFile: 'cursor-post-tool-use-real-blocked.stdin.json',
        stage: 'plan',
        reportFixture: 'sample-plan-report.md',
    },
};
function getRealToolTraceVariantConfig(variant) {
    const config = exports.REAL_TOOL_TRACE_FIXTURE_MANIFEST[variant];
    return {
        ...config,
        fixturePath: path.join(exports.RUNTIME_DASHBOARD_HOOK_FIXTURE_ROOT, config.fixtureFile),
        reportFixturePath: path.join(exports.RUNTIME_DASHBOARD_REPORT_FIXTURE_ROOT, config.reportFixture),
    };
}
function getReportFixturePathForStage(stage) {
    const entry = Object.values(exports.REAL_TOOL_TRACE_FIXTURE_MANIFEST).find((candidate) => candidate.stage === stage);
    if (!entry) {
        throw new Error(`no runtime dashboard report fixture configured for stage: ${stage}`);
    }
    return path.join(exports.RUNTIME_DASHBOARD_REPORT_FIXTURE_ROOT, entry.reportFixture);
}
