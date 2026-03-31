#!/usr/bin/env node
'use strict';

const path = require('node:path');
const fs = require('node:fs');

function shouldAutoStart(projectRoot) {
  if (process.env.BMAD_RUNTIME_DASHBOARD_AUTOSTART === '0') return false;
  if (!fs.existsSync(path.join(projectRoot, '_bmad'))) return false;
  return true;
}

async function autoStartRuntimeDashboard({ projectRoot, open = false }) {
  if (!shouldAutoStart(projectRoot)) {
    return null;
  }

  const helper = path.join(projectRoot, 'scripts', 'ensure-runtime-dashboard-server.cjs');
  const fallback = path.resolve(__dirname, '..', '..', '..', 'scripts', 'ensure-runtime-dashboard-server.cjs');
  const modulePath = fs.existsSync(helper) ? helper : fallback;
  const { ensureRuntimeDashboardServer } = require(modulePath);
  return ensureRuntimeDashboardServer({ root: projectRoot, open });
}

module.exports = { autoStartRuntimeDashboard, shouldAutoStart };
