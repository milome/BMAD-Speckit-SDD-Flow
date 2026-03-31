#!/usr/bin/env node
'use strict';

const { autoStartRuntimeDashboard, shouldAnnounceAutoStart } = require('../../runtime/hooks/runtime-dashboard-auto-start.js');

async function main() {
  try {
    const payload = await autoStartRuntimeDashboard({ projectRoot: process.cwd(), open: false });
    if (shouldAnnounceAutoStart(payload)) {
      process.stdout.write(JSON.stringify({ systemMessage: `[BMAD Dashboard] ${payload.url}` }));
      return;
    }
    process.stdout.write(JSON.stringify({ systemMessage: '' }));
  } catch (error) {
    process.stdout.write(JSON.stringify({ systemMessage: '' }));
  }
}

main().catch((error) => {
  process.stdout.write(JSON.stringify({ systemMessage: '' }));
  process.exit(0);
});
