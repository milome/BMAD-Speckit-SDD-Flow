#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { buildDecisionPacket, buildDefinitionReportFromSource } = require('./pre_render_definition_drilldown_lib');

function usage(exitCode = 0) {
  console.log(`Usage:
  node pre_render_definition_drilldown.js <source-document.md> [--out <report.json>] [--json]
  node pre_render_definition_drilldown.js --source <source-document.md> [--out <report.json>] [--json]
    [--previous-report <report.json>] [--resolutions <ledger.json>] [--changed-only]
    [--max-new-blockers <n>] [--emit-decision-packet <packet.json>]

Runs the deterministic pre-render definition drilldown gate before HTML confirmation render.
Use previous reports and a resolution ledger to stop repeated manual drilldown loops.`);
  process.exit(exitCode);
}

function readJsonFile(filePath, label) {
  const absolute = path.resolve(filePath);
  try {
    return JSON.parse(fs.readFileSync(absolute, 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${label} parse failed: ${message}`);
  }
}

function parseArgs(argv) {
  const args = {
    source: '',
    out: '',
    json: false,
    previousReport: '',
    resolutions: '',
    changedOnly: false,
    maxNewBlockers: null,
    decisionPacket: '',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') usage(0);
    if (arg === '--json') {
      args.json = true;
      continue;
    }
    if (arg === '--changed-only') {
      args.changedOnly = true;
      continue;
    }
    if (
      arg === '--source' ||
      arg === '--out' ||
      arg === '--previous-report' ||
      arg === '--resolutions' ||
      arg === '--max-new-blockers' ||
      arg === '--emit-decision-packet'
    ) {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) return { error: `missing value for ${arg}` };
      if (arg === '--source') args.source = next;
      else if (arg === '--out') args.out = next;
      else if (arg === '--previous-report') args.previousReport = next;
      else if (arg === '--resolutions') args.resolutions = next;
      else if (arg === '--emit-decision-packet') args.decisionPacket = next;
      else {
        const parsed = Number(next);
        if (!Number.isInteger(parsed) || parsed < 0) return { error: '--max-new-blockers must be a non-negative integer' };
        args.maxNewBlockers = parsed;
      }
      i += 1;
      continue;
    }
    if (arg.startsWith('--')) return { error: `unknown option ${arg}` };
    if (args.source) return { error: `unexpected positional argument ${arg}` };
    args.source = arg;
  }
  if (!args.source) return { error: 'missing source document path' };
  return args;
}

function main(argv) {
  const args = parseArgs(argv);
  if (args.error) {
    console.error(JSON.stringify({ verdict: 'FAIL', message: args.error }, null, 2));
    return 2;
  }

  const sourcePath = path.resolve(args.source);
  if (!fs.existsSync(sourcePath)) {
    console.error(JSON.stringify({ verdict: 'FAIL', message: 'source document file not found', target: sourcePath }, null, 2));
    return 1;
  }

  try {
    const previousReport = args.previousReport ? readJsonFile(args.previousReport, '--previous-report') : null;
    const resolutions = args.resolutions ? readJsonFile(args.resolutions, '--resolutions') : null;
    const report = buildDefinitionReportFromSource({
      sourcePath,
      rootDir: process.cwd(),
      previousReport,
      resolutions,
      changedOnly: args.changedOnly,
      maxNewBlockers: args.maxNewBlockers,
    });
    if (args.decisionPacket) {
      fs.writeFileSync(path.resolve(args.decisionPacket), `${JSON.stringify(buildDecisionPacket(report), null, 2)}\n`, 'utf8');
    }
    const output = `${JSON.stringify(report, null, 2)}\n`;
    if (args.out) fs.writeFileSync(path.resolve(args.out), output, 'utf8');
    process.stdout.write(output);
    return report.verdict === 'PASS' ? 0 : 1;
  } catch (error) {
    console.error(
      JSON.stringify(
        {
          verdict: 'FAIL',
          target: sourcePath,
          failedChecks: ['source_parse_failed'],
          findings: [
            {
              code: 'source_parse_failed',
              message: error instanceof Error ? error.message : String(error),
              refs: [sourcePath],
              severity: 'blocker',
              source: 'definition_drilldown',
            },
          ],
        },
        null,
        2
      )
    );
    return 1;
  }
}

process.exit(main(process.argv.slice(2)));
